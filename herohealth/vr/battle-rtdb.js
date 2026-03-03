// === /herohealth/vr/battle-rtdb.js ===
// Battle (Race skeleton) — SAFE NO-OP when backend not configured
// PATCH v20260303-BATTLE-SAFE-SKELETON
'use strict';

function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; }
}
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

export async function initBattle(opts){
  opts = opts || {};
  const enabled = !!opts.enabled;
  const room = String(opts.room || qs('room',''));
  const pid  = String(opts.pid || 'anon');
  const gameKey = String(opts.gameKey || 'game');

  const autostartMs = Number(opts.autostartMs || 3000) || 3000;
  const forfeitMs   = Number(opts.forfeitMs || 5000) || 5000;

  // If later you configure real backend, you can pass ?rtdb=... or similar.
  // For now, keep SAFE local-only.
  const backend = String(qs('rtdb','')); // empty by default

  let startedAt = nowMs() + autostartMs;
  let lastPayload = null;
  let finalized = false;

  // Optional: local "same-device" race via BroadcastChannel (works on same origin)
  let bc = null;
  try{
    bc = new BroadcastChannel('HHA_BATTLE_' + (room||'default') + '_' + gameKey);
    bc.onmessage = (ev)=>{
      // could listen opponent updates later
    };
    bc.postMessage({ t:'join', pid, gameKey, at: nowMs() });
  }catch(e){
    bc = null;
  }

  function pushScore(payload){
    if(!enabled || finalized) return;
    lastPayload = payload || null;
    try{
      bc?.postMessage({ t:'score', pid, gameKey, at: nowMs(), payload: lastPayload });
    }catch(e){}
  }

  function finalizeEnd(summary){
    if(finalized) return;
    finalized = true;
    try{
      bc?.postMessage({ t:'end', pid, gameKey, at: nowMs(), summary });
      bc?.close?.();
    }catch(e){}
  }

  return {
    enabled,
    backend,
    room,
    pid,
    gameKey,
    autostartMs,
    forfeitMs,
    startedAt,
    pushScore,
    finalizeEnd,
    getLastScore(){ return lastPayload; }
  };
}