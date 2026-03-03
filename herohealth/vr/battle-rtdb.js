// === /herohealth/vr/battle-rtdb.js ===
// Battle RTDB — FAIL-SAFE scaffold
// PATCH v20260302-BATTLE-SAFE
'use strict';

export async function initBattle(opts){
  opts = opts || {};
  if(!opts.enabled) return null;

  const room = String(opts.room || '').trim() || 'room1';
  const pid = String(opts.pid || 'anon');
  const gameKey = String(opts.gameKey || 'game');

  // NOTE: put your real RTDB implementation here (Firebase / WS / etc.)
  // This scaffold never throws to keep game stable.

  const state = {
    enabled: true,
    room, pid, gameKey,
    started: false,
    last: null,
    winner: null
  };

  function cmp(a,b){
    // score → acc → miss → median RT (lower is better)
    const as = +a.score||0, bs=+b.score||0;
    if(as !== bs) return bs - as;

    const aa = +a.accPct||0, ba=+b.accPct||0;
    if(aa !== ba) return ba - aa;

    const am = +a.miss||0, bm=+b.miss||0;
    if(am !== bm) return am - bm;

    const art = +a.medianRtGoodMs||0, brt=+b.medianRtGoodMs||0;
    if(art !== brt) return art - brt;

    return 0;
  }

  function pushScore(payload){
    state.last = payload || null;
    // TODO: publish to RTDB
  }

  function finalizeEnd(summary){
    // TODO: fetch opponent + decide winner
    // For now, just keep local
    state.started = true;
    return { ok:true };
  }

  return {
    pushScore,
    finalizeEnd,
    _state: state,
    _cmp: cmp
  };
}