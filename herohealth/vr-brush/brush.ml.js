// === /herohealth/vr-brush/brush.ml.js ===
// BrushML — prediction-only stub (NO adaptive)
// Emits: brush:ml {type:'features'|'predict'|'snapshot'}
// PATCH v20260304-BRUSH-ML-STUB
(function(){
  'use strict';
  const WIN = window;

  function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return v<a?a:(v>b?b:v); }

  function emit(detail){
    try{ WIN.dispatchEvent(new CustomEvent('brush:ml', { detail })); }catch(_){}
  }

  function features(state){
    // state: {shots,hits,miss,combo,clean,eviTotal,stage,quizDone,quizCorrect,feverOn,diff,timeLeftSec}
    const shots = Number(state.shots)||0;
    const hits = Number(state.hits)||0;
    const miss = Number(state.miss)||0;
    const acc = shots>0 ? hits/shots : 0;

    const x = {
      acc,                     // 0..1
      missRate: shots>0 ? miss/shots : 0,
      combo: Number(state.combo)||0,
      clean: clamp((Number(state.clean)||0)/100, 0, 1),
      evi: clamp((Number(state.eviTotal)||0)/3, 0, 1),
      stageA: state.stage==='A'?1:0,
      stageB: state.stage==='B'?1:0,
      stageC: state.stage==='C'?1:0,
      quizDone: state.quizDone?1:0,
      quizCorrect: state.quizCorrect?1:0,
      feverOn: state.feverOn?1:0,
      diffEasy: state.diff==='easy'?1:0,
      diffHard: state.diff==='hard'?1:0,
      tLeft: clamp((Number(state.timeLeftSec)||0)/120, 0, 1),
    };

    emit({ type:'features', x, ts: Date.now() });
    return x;
  }

  function predictRisk(x){
    // simple logistic-ish score (placeholder)
    let z = 0.4;
    z += x.missRate * 1.2;
    z += (x.acc < 0.55 ? 0.35 : (x.acc > 0.82 ? -0.18 : 0));
    z += (x.combo === 0 ? 0.18 : (x.combo >= 7 ? -0.10 : -0.04));
    z += (x.stageB && x.evi < 0.67 ? 0.12 : 0);
    z += (x.stageC && !x.quizDone ? 0.10 : 0);
    z += (x.diffHard ? 0.08 : 0);

    const risk = clamp(z, 0, 1);
    emit({ type:'predict', risk, band: risk>0.68?'high':(risk>0.45?'mid':'low'), ts: Date.now() });
    return risk;
  }

  function snapshot(state){
    const x = features(state);
    const risk = predictRisk(x);
    emit({ type:'snapshot', x, risk, ts: Date.now() });
    return { x, risk };
  }

  WIN.BrushML = { features, predictRisk, snapshot };
})();