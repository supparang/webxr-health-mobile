// === /fitness/js/ai-director.js — AI Prediction (Lite) + spawn weights ===
'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

export function createAIDirector(){
  const st = {
    fatiguePred: 0,   // 0..1
    skillPred: 0.5,   // 0..1
    lastUpdateAt: 0
  };

  function update(state, now){
    if (!state) return;
    if (state.mode !== 'play') return;

    const dt = now - (st.lastUpdateAt || now);
    if (dt < 350) return; // throttle
    st.lastUpdateAt = now;

    const total = (state.totalHits || 0) + (state.miss || 0);
    const acc = total > 0 ? (state.totalHits / total) : 0;

    // fatigue signals: low HP time + many miss + fever off long
    const lowHpRatio = state.lowHpMs ? clamp(state.lowHpMs / (state.durationSec*1000), 0, 1) : 0;
    const missRate = total > 0 ? clamp(state.miss / total, 0, 1) : 0;

    // simple predictors
    const fatigue = clamp(0.15 + lowHpRatio*0.55 + missRate*0.40, 0, 1);
    const skill = clamp(0.10 + acc*0.75 + (state.maxCombo ? clamp(state.maxCombo/20,0,1)*0.25 : 0), 0, 1);

    // smooth
    st.fatiguePred = st.fatiguePred*0.75 + fatigue*0.25;
    st.skillPred = st.skillPred*0.80 + skill*0.20;
  }

  function weightsForSpawn(base){
    // base = {normal, decoy, bomb, heal, shield}
    const f = st.fatiguePred;
    const k = st.skillPred;

    // if fatigued -> more heal/shield, less bomb/decoy
    // if skilled -> more bomb/decoy + slightly less heal
    const healBoost = 1 + (f*0.9) - (k*0.25);
    const shieldBoost = 1 + (f*0.7) - (k*0.15);
    const bombBoost = 1 + (k*0.65) - (f*0.55);
    const decoyBoost = 1 + (k*0.55) - (f*0.45);
    const normalBoost = 1 + (k*0.10) - (f*0.10);

    return {
      normal: Math.max(6, base.normal * normalBoost),
      decoy:  Math.max(1, base.decoy  * decoyBoost),
      bomb:   Math.max(1, base.bomb   * bombBoost),
      heal:   Math.max(1, base.heal   * healBoost),
      shield: Math.max(1, base.shield * shieldBoost),
      fatigue_pred: +st.fatiguePred.toFixed(3),
      skill_pred: +st.skillPred.toFixed(3)
    };
  }

  return { update, weightsForSpawn, state: st };
}