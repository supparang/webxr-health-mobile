// === /herohealth/vr/battle-rtdb.js ===
// Battle RTDB — SAFE STUB (no networking)
// FULL v20260304-BATTLE-STUB
'use strict';

export async function initBattle(cfg = {}){
  const room = String(cfg.room||'');
  const pid  = String(cfg.pid||'anon');
  const gameKey = String(cfg.gameKey||'goodjunk');

  console.warn('[battle-rtdb] STUB active (no sync). room=', room, 'pid=', pid, 'game=', gameKey);

  let last = null;

  return {
    pushScore(payload){
      last = payload;
      // no-op
    },
    finalizeEnd(summary){
      // no-op winner decision stub
      void(summary);
    },
    getLast(){ return last; }
  };
}