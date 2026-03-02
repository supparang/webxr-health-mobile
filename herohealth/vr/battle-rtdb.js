// === /herohealth/vr/battle-rtdb.js ===
// Battle RTDB (stub-safe) — comparator: score→acc→miss→medianRT
// PATCH v20260302-BATTLE-STUB
'use strict';

function cmp(a,b){
  // higher score wins
  if((a.score|0) !== (b.score|0)) return (b.score|0) - (a.score|0);

  // higher acc wins
  const aAcc = Number(a.accPct||0);
  const bAcc = Number(b.accPct||0);
  if(aAcc !== bAcc) return (bAcc - aAcc);

  // lower miss wins
  if((a.miss|0) !== (b.miss|0)) return (a.miss|0) - (b.miss|0);

  // lower median RT wins
  return (Number(a.medianRtGoodMs||0) - Number(b.medianRtGoodMs||0));
}

export async function initBattle(opts){
  opts = opts || {};
  if(!opts.enabled) return null;

  // NOTE: This is a stub. Replace with Firebase/RTDB implementation later.
  const state = {
    room: opts.room || 'local',
    pid:  opts.pid || 'anon',
    gameKey: opts.gameKey || 'game',
    lastScore: null,
    ended: false
  };

  function pushScore(payload){
    state.lastScore = payload;
    // in real impl: write to RTDB
  }

  function finalizeEnd(summary){
    state.ended = true;
    // in real impl: write end summary + decide winner between players
    // here: no-op
  }

  return {
    pushScore,
    finalizeEnd,
    comparator: cmp,
    getState: ()=> ({...state})
  };
}