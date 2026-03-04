// === /herohealth/vr/battle-rtdb.js ===
// Battle RTDB (stub/no-op safe)
// PATCH v20260304-BATTLE-NOOP
'use strict';

export async function initBattle(opts={}){
  const enabled = !!opts.enabled;
  if(!enabled){
    return {
      pushScore(){},
      finalizeEnd(){},
    };
  }

  // If later you add Firebase, replace this whole file with real RTDB sync.
  console.warn('[battle-rtdb] stub mode: no backend connected', opts);

  return {
    pushScore(payload){
      // no-op
      void payload;
    },
    finalizeEnd(summary){
      // no-op
      void summary;
    }
  };
}