// === /herohealth/vr/battle-rtdb.js ===
// Battle RTDB — Optional realtime sync for HeroHealth
// PATCH v20260304-BATTLE-RTDB-SAFE
// Winner comparator: score → accPct → miss → medianRtGoodMs (lower is better)

'use strict';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

function cmp(a,b){
  // return +1 if a better than b
  const as = Number(a?.score||0), bs = Number(b?.score||0);
  if(as !== bs) return as > bs ? 1 : -1;

  const aa = Number(a?.accPct||0), ba = Number(b?.accPct||0);
  if(aa !== ba) return aa > ba ? 1 : -1;

  const am = Number(a?.miss||0), bm = Number(b?.miss||0);
  if(am !== bm) return am < bm ? 1 : -1; // lower miss better

  const art = Number(a?.medianRtGoodMs||0), brt = Number(b?.medianRtGoodMs||0);
  if(art !== brt) return art < brt ? 1 : -1; // lower RT better

  return 0;
}

async function loadFirebase(){
  // use modular v9 CDN
  const appMod = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js');
  const dbMod  = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js');
  return { appMod, dbMod };
}

function safeRoomId(room){
  room = String(room||'').trim();
  if(!room) room = 'room-default';
  room = room.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,48);
  return room || 'room-default';
}

export async function initBattle(opts = {}){
  const enabled = !!opts.enabled;
  if(!enabled) return null;

  const config = window.HHA_FIREBASE_CONFIG || window.__HHA_FIREBASE_CONFIG__ || null;
  if(!config){
    console.warn('[battle] missing Firebase config -> disabled (ok)');
    return {
      enabled:false,
      pushScore(){},
      finalizeEnd(){}
    };
  }

  const room = safeRoomId(opts.room);
  const pid  = String(opts.pid||'anon').trim() || 'anon';
  const gameKey = String(opts.gameKey||'game').trim() || 'game';

  const autostartMs = clamp(opts.autostartMs, 0, 30000);
  const forfeitMs   = clamp(opts.forfeitMs,   1000, 600000);

  const { appMod, dbMod } = await loadFirebase();
  const { initializeApp } = appMod;
  const { getDatabase, ref, set, update, onValue, serverTimestamp } = dbMod;

  const app = initializeApp(config, 'HHA_BATTLE_'+gameKey);
  const db  = getDatabase(app);

  const basePath = `hha_battle/${gameKey}/${room}`;
  const mePath   = `${basePath}/players/${pid}`;
  const statePath= `${basePath}/state`;

  const meRef    = ref(db, mePath);
  const stateRef = ref(db, statePath);

  let lastScore = null;
  let lastPushMs = 0;

  // init player
  await set(meRef, {
    pid,
    joinedAt: serverTimestamp(),
    score: 0, miss:0, accPct:0, medianRtGoodMs:0,
    shots:0, hits:0,
    alive:true
  });

  // autostart state (best-effort)
  if(autostartMs > 0){
    setTimeout(async ()=>{
      try{
        await update(stateRef, { startedAt: serverTimestamp(), status:'playing' });
      }catch(e){}
    }, autostartMs);
  }

  // listen (optional; handy for debug)
  let snapshotCache = null;
  onValue(ref(db, `${basePath}/players`), (snap)=>{
    snapshotCache = snap.val() || null;
  });

  function pushScore(payload){
    const t = Date.now();
    if(t - lastPushMs < 220) return; // ~4-5 Hz
    lastPushMs = t;

    lastScore = payload || lastScore;
    if(!payload) return;

    update(meRef, {
      score: Number(payload.score||0),
      miss: Number(payload.miss||0),
      accPct: Number(payload.accPct||0),
      medianRtGoodMs: Number(payload.medianRtGoodMs||0),
      shots: Number(payload.shots||0),
      hits: Number(payload.hits||0),
      updatedAt: serverTimestamp(),
      alive:true
    }).catch(()=>{});
  }

  async function finalizeEnd(summary){
    // mark me ended
    try{
      await update(meRef, {
        alive:false,
        endedAt: serverTimestamp(),
        endReason: String(summary?.reason||'')
      });
    }catch(e){}

    // wait for opponents a bit; if no update -> forfeit rule can be used by host later
    // decide winner client-side best-effort (not authoritative, but enough for classroom)
    try{
      const players = snapshotCache || {};
      const ids = Object.keys(players||{});
      if(ids.length <= 1) return;

      // choose best
      let bestId = ids[0];
      for(const id of ids.slice(1)){
        const c = cmp(players[id], players[bestId]);
        if(c > 0) bestId = id;
      }

      await update(stateRef, {
        status:'ended',
        winnerPid: bestId,
        endedAt: serverTimestamp(),
        tieBreak: 'score→acc→miss→medianRT'
      });
    }catch(e){}
  }

  // forfeit detector (if others stop updating)
  setInterval(async ()=>{
    try{
      if(!snapshotCache) return;
      const now = Date.now();
      const players = snapshotCache || {};
      // if any player hasn't updated in forfeitMs, mark them inactive (best-effort)
      for(const id of Object.keys(players)){
        // we can't read serverTimestamp reliably here; keep it light
        // (This is optional; you can extend if you store clientUpdatedMs too.)
      }
    }catch(e){}
  }, Math.min(4000, Math.max(1500, forfeitMs/5)));

  return {
    enabled:true,
    room,
    pid,
    gameKey,
    pushScore,
    finalizeEnd
  };
}