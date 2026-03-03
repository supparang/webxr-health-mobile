// === /herohealth/vr-brush/brush.missions.js ===
'use strict';

export function bootMissions(cfg){
  cfg = cfg || {};
  const S = { stage:1, stageHit:0, stageNeed:12, junkLimit:3, junkHit:0, cleared:0, total:3 };

  function tune(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy'){ S.stageNeed = 10; S.junkLimit = 4; }
    else if (diff === 'hard'){ S.stageNeed = 14; S.junkLimit = 2; }
    else { S.stageNeed = 12; S.junkLimit = 3; }
    reset();
  }

  function reset(){ S.stage=1; S.stageHit=0; S.junkHit=0; S.cleared=0; }

  function text(){
    if (S.stage === 1) return `M1 เก็บคราบ ${S.stageHit}/${S.stageNeed}`;
    if (S.stage === 2) return `M2 หลีกเชื้อ ${S.junkHit}/${S.junkLimit}`;
    return `M3 เร่งสปีด ${S.stageHit}/${S.stageNeed}`;
  }

  function onGoodHit(){
    if (S.stage === 1 || S.stage === 3){
      S.stageHit++;
      if (S.stageHit >= S.stageNeed){
        S.cleared++;
        if (S.stage === 1){ S.stage = 2; S.stageHit = 0; }
        else { S.stage = 1; S.stageHit = 0; S.junkHit = 0; }
        return { advanced:true };
      }
    } else if (S.stage === 2){
      S.stageHit++;
      if (S.stageHit >= Math.max(6, Math.floor(S.stageNeed/2))){
        S.cleared++;
        S.stage = 3; S.stageHit = 0;
        return { advanced:true };
      }
    }
    return { advanced:false };
  }

  function onJunkHit(){
    if (S.stage === 2){
      S.junkHit++;
      if (S.junkHit > S.junkLimit){
        S.stage = 1; S.stageHit = 0; S.junkHit = 0;
        return { failed:true };
      }
    }
    return { failed:false };
  }

  tune(cfg.diff || 'normal');
  return { S, tune, reset, text, onGoodHit, onJunkHit };
}