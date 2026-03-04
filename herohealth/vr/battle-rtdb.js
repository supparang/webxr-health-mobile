// === /herohealth/vr/battle-rtdb.js ===
// Battle RTDB (optional) for HeroHealth
// FULL v20260304-BATTLE-RTDB-REAL
//
// Enabled only when caller passes enabled:true (?battle=1).
// Safe fallback to BroadcastChannel when Firebase not configured.

'use strict';

function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

function safeRoomKey(s){
  s = String(s||'').trim();
  if(!s) return 'room-default';
  return s.replace(/[^a-zA-Z0-9_\-]/g,'-').slice(0,60) || 'room-default';
}

function scoreComparator(a,b){
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

// -------------------- Firebase Config --------------------
// ✅ ใส่ config ของคุณตรงนี้ เพื่อใช้ RTDB จริง
// ตัวอย่าง:
// const FIREBASE_CONFIG = { apiKey:"...", authDomain:"...", databaseURL:"...", projectId:"...", appId:"..." };
const FIREBASE_CONFIG = null;

async function loadFirebaseIfPossible(){
  if(!FIREBASE_CONFIG) return null;
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const dbMod  = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  const db  = dbMod.getDatabase(app);
  return { db, ...dbMod };
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
    mode:'local',         // 'local' | 'rtdb'
    room, pid, gameKey,
    startedAt: nowMs() + autostartMs,
    lastPushAt: 0,
    myScore: null,
    peerScore: null,
    peerPid: null,
    winner: null,
  };

  // -------- Local bus fallback (always available) --------
  const bcName = `HHA_BATTLE_${room}_${gameKey}`;
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel(bcName) : null;

  function pushBus(type, payload){
    if(!bc) return;
    try{ bc.postMessage({ type, room, gameKey, pid, payload }); }catch(e){}
  }

  if(bc){
    bc.onmessage = (ev)=>{
      const msg = ev?.data || null;
      if(!msg || msg.gameKey!==gameKey || msg.room!==room) return;
      if(msg.pid === pid) return;
      if(msg.type==='score' || msg.type==='end'){
        state.peerPid = msg.pid || 'peer';
        state.peerScore = Object.assign({ pid: state.peerPid }, msg.payload || {});
      }
    };
  }

  // -------- Try RTDB --------
  let fb = null;
  let unsubPlayers = null;
  let myRef = null;

  try{
    fb = await loadFirebaseIfPossible();
    if(fb && fb.db) state.mode = 'rtdb';
  }catch(e){
    fb = null;
    state.mode = 'local';
  }

  if(state.mode === 'rtdb'){
    try{
      const base = `herohealth/battle/${room}/${gameKey}`;
      const playersRef = fb.ref(fb.db, `${base}/players`);
      myRef = fb.ref(fb.db, `${base}/players/${pid}`);

      // Presence + initial
      await fb.set(myRef, { pid, ts: Date.now(), score: null });

      // Listen players, pick first other as peer
      unsubPlayers = fb.onValue(playersRef, (snap)=>{
        const v = snap.val() || {};
        const keys = Object.keys(v);
        let peer = null;
        for(const k of keys){
          if(k !== pid){ peer = v[k]; state.peerPid = k; break; }
        }
        state.peerScore = peer?.score ? Object.assign({ pid: state.peerPid }, peer.score) : state.peerScore;
      });
    }catch(e){
      // fallback to local safely
      state.mode = 'local';
      try{ unsubPlayers?.(); }catch(_){}
      unsubPlayers = null;
      myRef = null;
    }
  }

  async function pushRtdbScore(payload){
    if(state.mode!=='rtdb' || !fb || !myRef) return;
    try{
      await fb.update(myRef, { ts: Date.now(), score: payload });
    }catch(e){
      // ignore
    }
  }

  function pushScore(payload){
    const p = Object.assign({ pid }, payload || {});
    state.myScore = p;

    // local always
    pushBus('score', p);

    // rtdb throttle
    const t = nowMs();
    if(t - state.lastPushAt < 220) return;
    state.lastPushAt = t;
    pushRtdbScore(p).catch(()=>{});
  }

  function decideWinner(){
    const a = state.myScore || null;
    const b = state.peerScore || null;
    if(!a && !b) return null;
    if(a && !b) return { winnerPid: pid, why:'peer-missing' };
    if(!a && b) return { winnerPid: (state.peerPid||'peer'), why:'self-missing' };

    const cmp = scoreComparator(a,b);
    if(cmp > 0) return { winnerPid: pid, why:'compare' };
    if(cmp < 0) return { winnerPid: (state.peerPid||'peer'), why:'compare' };
    return { winnerPid:'draw', why:'tie' };
  }

  function finalizeEnd(summary){
    // push final
    try{ pushScore(summary); }catch(e){}
    pushBus('end', Object.assign({ pid }, summary||{}));

    const tEnd = nowMs() + forfeitMs;

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

  function getWinner(){ return state.winner; }
  function getPeerScore(){ return state.peerScore; }
  function dispose(){
    try{ bc?.close?.(); }catch(e){}
    try{ unsubPlayers?.(); }catch(e){}
  }

  return {
    enabled:true,
    mode: state.mode,
    room,
    pushScore,
    finalizeEnd,
    getWinner,
    getPeerScore,
    dispose
  };
}