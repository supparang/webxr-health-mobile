// === /herohealth/vr/battle-rtdb.js ===
// Battle RTDB (optional) for HeroHealth
// PATCH v20260304-BATTLE-OPTIONAL
//
// Usage: import('../vr/battle-rtdb.js') then initBattle({ room, pid, gameKey ... })
// Enabled only when caller decides (?battle=1)
// Safe: if Firebase not configured, it runs "local-only" (no crash).

'use strict';

function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

const FIREBASE_CONFIG = null; // <-- ใส่ config ทีหลังถ้าจะใช้จริง

async function loadFirebaseIfPossible(){
  if(!FIREBASE_CONFIG) return null;

  // dynamic import from official CDN (ESM)
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const dbMod  = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');

  const app = appMod.initializeApp(FIREBASE_CONFIG);
  const db  = dbMod.getDatabase(app);

  return { db, ...dbMod };
}

function safeRoomKey(s){
  s = String(s||'').trim();
  if(!s) return 'room-default';
  return s.replace(/[^a-zA-Z0-9_\-]/g,'-').slice(0,60) || 'room-default';
}

function scoreComparator(a,b){
  // winner by score → acc → miss → medianRT (lower better)
  const as = Number(a?.score||0);
  const bs = Number(b?.score||0);
  if(as!==bs) return bs - as;

  const aa = Number(a?.accPct||0);
  const ba = Number(b?.accPct||0);
  if(aa!==ba) return ba - aa;

  const am = Number(a?.miss||0);
  const bm = Number(b?.miss||0);
  if(am!==bm) return am - bm;

  const art = Number(a?.medianRtGoodMs||999999);
  const brt = Number(b?.medianRtGoodMs||999999);
  if(art!==brt) return art - brt;

  return 0;
}

export async function initBattle(opts={}){
  const enabled = !!opts.enabled;
  if(!enabled) return null;

  const pid = String(opts.pid||'anon');
  const gameKey = String(opts.gameKey||'game');
  const room = safeRoomKey(opts.room||'');
  const autostartMs = clamp(opts.autostartMs ?? 3000, 500, 15000);
  const forfeitMs = clamp(opts.forfeitMs ?? 5000, 1000, 60000);

  const state = {
    enabled:true,
    room, pid, gameKey,
    startedAt: nowMs() + autostartMs,
    lastPushAt: 0,
    myScore: null,
    peerScore: null,
    winner: null,
    mode: 'local', // or 'rtdb'
  };

  // ---- Local-only bus (works even without Firebase) ----
  const bcName = `HHA_BATTLE_${room}_${gameKey}`;
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel(bcName) : null;
  if(bc){
    bc.onmessage = (ev)=>{
      const msg = ev?.data || null;
      if(!msg || msg.gameKey!==gameKey || msg.room!==room) return;
      if(msg.pid === pid) return; // ignore self
      if(msg.type==='score') state.peerScore = msg.payload || null;
      if(msg.type==='end') state.peerScore = msg.payload || null;
    };
  }

  // ---- Try Firebase RTDB if configured ----
  let fb = null;
  try{
    fb = await loadFirebaseIfPossible();
    if(fb && fb.db){
      state.mode = 'rtdb';
    }
  }catch(e){
    console.warn('[battle] firebase not ready (ok)', e);
    fb = null;
    state.mode = 'local';
  }

  // ---- RTDB wiring ----
  let rtdbRefMy = null;
  let rtdbRefPeer = null;
  let unsubPeer = null;

  if(state.mode==='rtdb'){
    try{
      const pathBase = `herohealth/battle/${room}/${gameKey}`;
      rtdbRefMy = fb.ref(fb.db, `${pathBase}/players/${pid}`);
      // listen all players, pick first other
      const playersRef = fb.ref(fb.db, `${pathBase}/players`);
      unsubPeer = fb.onValue(playersRef, (snap)=>{
        const v = snap.val() || {};
        const keys = Object.keys(v);
        let peer = null;
        for(const k of keys){
          if(k !== pid){ peer = v[k]; break; }
        }
        state.peerScore = peer?.score || null;
      });
      // mark presence
      await fb.set(rtdbRefMy, { pid, ts: Date.now(), score: null });
    }catch(e){
      console.warn('[battle] rtdb setup failed (fallback local)', e);
      state.mode='local';
      try{ unsubPeer?.(); }catch(_){}
      unsubPeer=null;
    }
  }

  function pushBus(type, payload){
    if(bc){
      try{ bc.postMessage({ type, room, gameKey, pid, payload }); }catch(e){}
    }
  }

  async function pushRtdbScore(payload){
    if(state.mode!=='rtdb' || !fb || !rtdbRefMy) return;
    try{
      await fb.update(rtdbRefMy, { ts: Date.now(), score: payload });
    }catch(e){
      console.warn('[battle] rtdb push failed (ok)', e);
    }
  }

  function pushScore(payload){
    state.myScore = payload || null;

    // local bus always
    pushBus('score', payload);

    // rtdb optional
    const t = nowMs();
    if(t - state.lastPushAt < 220) return; // throttle
    state.lastPushAt = t;
    pushRtdbScore(payload).catch(()=>{});
  }

  function decideWinner(){
    const a = state.myScore || null;
    const b = state.peerScore || null;
    if(!a && !b) return null;
    if(a && !b) return { winnerPid: pid, why:'peer-missing' };
    if(!a && b) return { winnerPid: 'peer', why:'self-missing' };

    // compare
    const cmp = scoreComparator(a,b);
    if(cmp < 0) return { winnerPid:'peer', why:'compare' };
    if(cmp > 0) return { winnerPid: pid, why:'compare' };
    return { winnerPid:'draw', why:'tie' };
  }

  function finalizeEnd(summary){
    // ensure latest score pushed
    try{ pushScore(summary); }catch(e){}

    // announce end on bus
    pushBus('end', summary);

    // if peer hasn't responded, wait briefly then decide
    const t0 = nowMs();
    const tEnd = t0 + forfeitMs;

    function poll(){
      const d = decideWinner();
      if(d && (state.peerScore || nowMs() >= tEnd)){
        state.winner = d;
        return;
      }
      requestAnimationFrame(poll);
    }
    requestAnimationFrame(poll);
  }

  function getWinner(){
    return state.winner;
  }

  function dispose(){
    try{ bc?.close?.(); }catch(e){}
    try{ unsubPeer?.(); }catch(e){}
  }

  return {
    enabled:true,
    mode: state.mode,
    room,
    pushScore,
    finalizeEnd,
    getWinner,
    dispose
  };
}