// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — prediction only (NO adaptive)
// Provides hazardRisk + next5 (watchout hints)
// Can optionally use exported model on window.HHA_GOODJUNK_MODEL
// FULL v20260301-AI-PRED
'use strict';

export function createGoodJunkAI(opts){
  opts = opts || {};
  const model = opts.model || null;

  const state = {
    seed: String(opts.seed||'0'),
    pid: String(opts.pid||'anon'),
    diff: String(opts.diff||'normal'),
    view: String(opts.view||'mobile'),
    lastPred: null,
    inputs: {
      missGoodExpired:0, missJunkHit:0, shield:0, fever:0, combo:0,
      tLeft:0, score:0
    }
  };

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function updateInputs(partial){
    Object.assign(state.inputs, partial || {});
  }

  function heuristicPredict(){
    const x = state.inputs;
    // risk increases with: low shield, high miss rate, low time, high combo pressure
    const miss = (Number(x.missGoodExpired||0) + Number(x.missJunkHit||0));
    const shield = Number(x.shield||0);
    const fever = Number(x.fever||0);
    const combo = Number(x.combo||0);
    const tLeft = Number(x.tLeft||0);

    let r = 0.18;
    r += clamp(miss/12, 0, 0.55);
    r += (shield<=0 ? 0.16 : 0.03);
    r += (tLeft<=10 ? 0.10 : 0.0);
    r += (combo>=6 ? 0.08 : 0.0);
    r += (fever>=90 ? 0.04 : 0.0); // overconfidence risk
    if(String(state.diff)==='hard') r += 0.06;
    if(String(state.view)==='cvr') r += 0.05;

    r = clamp(r, 0, 0.98);

    const hint = (shield<=0 && r>=0.55)
      ? 'หา 🛡️ ก่อน'
      : (miss>=4 && r>=0.55)
        ? 'โฟกัส GOOD ไม่เสี่ยง'
        : (combo>=6 && r>=0.55)
          ? 'อย่าฝืนคอมโบ'
          : 'คุมจังหวะ';

    return { hazardRisk: r, next5: [hint, 'เลี่ยง JUNK', 'เก็บ BONUS', 'คุมสายตา', 'นิ่งก่อนยิง'] };
  }

  function modelPredict(){
    if(!model || typeof model.predict !== 'function') return null;
    try{
      return model.predict({ ...state.inputs, diff: state.diff, view: state.view });
    }catch(e){
      return null;
    }
  }

  function onTick(dt, inputs){
    updateInputs(inputs);

    // prefer model if available, else fallback heuristic
    const mp = modelPredict();
    const pred = mp || heuristicPredict();

    state.lastPred = pred;
    return pred;
  }

  function onSpawn(kind, info){
    // reserved hook for future supervised labeling, no-op
  }

  function onHit(kind, info){
    // reserved hook for future supervised labeling, no-op
  }

  function onExpire(kind, info){
    // reserved hook for future supervised labeling, no-op
  }

  function onEnd(summary){
    return { usedModel: !!model, lastPred: state.lastPred };
  }

  function getPrediction(){
    return state.lastPred;
  }

  return {
    updateInputs,
    onTick,
    onSpawn,
    onHit,
    onExpire,
    onEnd,
    getPrediction
  };
}
