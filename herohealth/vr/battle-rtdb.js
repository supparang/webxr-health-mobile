// === /herohealth/vr/battle-rtdb.js ===
// Battle RTDB (SAFE stub / drop-in) — PRODUCTION
// PATCH v20260303-BATTLE-SAFE-STUB
// ✅ initBattle({enabled, room, pid, gameKey, autostartMs, forfeitMs})
// ✅ pushScore(payload)
// ✅ finalizeEnd(summary)
// ✅ comparator: score→acc→miss→medianRT

'use strict';

function num(v,d=0){ v=+v; return Number.isFinite(v)?v:d; }

function compare(a,b){
  // higher is better: score, acc; lower is better: miss, medianRT
  const sA=num(a?.score), sB=num(b?.score);
  if(sA!==sB) return sB - sA;

  const accA=num(a?.accPct), accB=num(b?.accPct);
  if(accA!==accB) return accB - accA;

  const mA=num(a?.miss), mB=num(b?.miss);
  if(mA!==mB) return mA - mB;

  const rtA=num(a?.medianRtGoodMs, 1e9), rtB=num(b?.medianRtGoodMs, 1e9);
  if(rtA!==rtB) return rtA - rtB;

  return 0;
}

export async function initBattle(cfg){
  cfg = cfg || {};
  if(!cfg.enabled) return null;

  // SAFE local-only session (no network)
  const state = {
    room: String(cfg.room||''),
    pid: String(cfg.pid||'anon'),
    gameKey: String(cfg.gameKey||''),
    last: null,
    ended: false,
    winner: null
  };

  function pushScore(payload){
    state.last = payload || null;
  }

  function finalizeEnd(summary){
    state.ended = true;

    // local-only: winner cannot be decided without opponent
    // but we keep API stable + expose result in window for debug
    const me = {
      score: num(summary?.scoreFinal),
      accPct: num(summary?.accPct),
      miss: num(summary?.missTotal),
      medianRtGoodMs: num(summary?.medianRtGoodMs)
    };

    state.winner = { decided:false, me, note:'RTDB not configured (safe stub)' };

    try{
      window.__HHA_BATTLE_LAST__ = {
        room: state.room,
        pid: state.pid,
        gameKey: state.gameKey,
        me,
        tieBreakOrder: 'score→acc→miss→medianRT',
        decided:false
      };
    }catch(e){}
  }

  return { pushScore, finalizeEnd, compare };
}