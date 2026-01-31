// === /fitness/js/rb-boss.js ===
// Rhythm Boxer Boss Phases (play-only). Research-safe (engine will disable in research).
(function(){
  'use strict';

  function clamp(v,a,b){ return v<a?a:v>b?b:v; }

  // Mirror mapping: L2<->R2, L1<->R1, C stays
  function mirrorLane(lane){
    if (lane === 0) return 4;
    if (lane === 1) return 3;
    if (lane === 3) return 1;
    if (lane === 4) return 0;
    return 2;
  }

  function buildBossTimeline(track, diff){
    const dur = (track && track.durationSec) || 32;

    // 2 boss windows near mid & late (tuneable)
    const bossA = {
      id: 'bossA_mirror',
      kind: 'mirror',
      start: Math.max(6, dur * 0.38),      // ~12s for 32s
      end:   Math.max(10, dur * 0.38 + 6), // 6s window
      label: 'MIRROR SWAP'
    };

    const bossB = {
      id: 'bossB_hold',
      kind: 'hold-combo',
      start: Math.max(14, dur * 0.70),      // ~22s for 32s
      end:   Math.max(18, dur * 0.70 + 6),  // 6s window
      label: 'HOLD COMBO'
    };

    // Required combo depends on diff
    const req =
      (diff === 'easy') ? 8 :
      (diff === 'hard') ? 12 : 10;

    bossB.requiredCombo = req;

    // Ensure ordering
    const out = [bossA, bossB].sort((a,b)=>a.start-b.start);
    // clamp within duration
    for(const b of out){
      b.start = clamp(b.start, 0, Math.max(0, dur-1));
      b.end   = clamp(b.end,   b.start+1, dur);
    }
    return out;
  }

  window.RBBoss = {
    buildBossTimeline,
    mirrorLane
  };
})();