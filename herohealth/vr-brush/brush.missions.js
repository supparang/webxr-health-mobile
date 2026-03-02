// === /herohealth/vr-brush/brush.missions.js ===
// Brush Missions — simple 3-stage loop (optional module)
// FULL v20260302-BRUSH-MISSIONS
'use strict';

export function bootMissions(cfg){
  cfg = cfg || {};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b, Number(v)||0));

  const S = {
    stage: 1,          // 1..3
    stageHit: 0,
    stageNeed: 0,
    junkLimit: 0,
    junkHit: 0,
    cleared: 0,
    total: 3
  };

  function tune(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy'){
      S.stageNeed = 10; S.junkLimit = 4;
    } else if (diff === 'hard'){
      S.stageNeed = 14; S.junkLimit = 2;
    } else {
      S.stageNeed = 12; S.junkLimit = 3;
    }
    reset();
  }

  function reset(){
    S.stage = 1;
    S.stageHit = 0;
    S.junkHit = 0;
    S.cleared = 0;
  }

  function text(){
    if (S.stage === 1) return `MISSION 1: เก็บคราบ ${S.stageHit}/${S.stageNeed}`;
    if (S.stage === 2) return `MISSION 2: หลีกเลี่ยงเชื้อ (โดน ${S.junkHit}/${S.junkLimit})`;
    return `MISSION 3: เก็บคราบให้ครบ (เร็วขึ้น!) ${S.stageHit}/${S.stageNeed}`;
  }

  function onGoodHit(){
    if (S.stage === 1 || S.stage === 3){
      S.stageHit++;
      if (S.stageHit >= S.stageNeed){
        S.cleared++;
        if (S.stage === 1){ S.stage = 2; S.stageHit = 0; }
        else { S.stage = 1; S.stageHit = 0; S.junkHit = 0; } // loop
        return { advanced:true, stage:S.stage, cleared:S.cleared, total:S.total };
      }
    }
    return { advanced:false };
  }

  function onJunkHit(){
    if (S.stage === 2){
      S.junkHit++;
      if (S.junkHit > S.junkLimit){
        // fail the stage → reset to stage1
        S.stage = 1;
        S.stageHit = 0;
        S.junkHit = 0;
        return { failed:true, stage:S.stage };
      }
      // pass stage2 when survive long enough: use “good hits” as timer surrogate
      // (caller can call tick to count time; to keep simple we’ll advance after N good hits outside stage2)
    }
    return { failed:false };
  }

  function tick(ms){
    // optional hook for future
    return ms;
  }

  tune(cfg.diff || 'normal');
  return { S, tune, reset, text, onGoodHit, onJunkHit, tick };
}