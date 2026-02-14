// === /herohealth/ai/skill-estimator.js ===
// Explainable, deterministic-friendly, no external deps.
// Inputs: rolling stats + recent events
// Outputs: skillScore (0-1), riskMiss5s (0-1), tier + reasons
'use strict';

export function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

export function makeSkillEstimator(opts={}){
  const cfg = {
    // smoothing
    emaA: 0.18,          // EMA alpha
    riskEmaA: 0.22,
    // thresholds
    tierA: 0.78,
    tierB: 0.58,
    // risk weights (explainable)
    wMissStreak: 0.30,
    wJunkRate:   0.22,
    wExpireRate: 0.18,
    wLowCombo:   0.15,
    wLowAcc:     0.15,
    ...opts
  };

  const S = {
    // EMA tracked
    emaAcc: 0.65,
    emaCombo: 0.25,
    emaJunkRate: 0.10,
    emaExpireRate: 0.08,
    emaMissStreak: 0.00,
    emaRisk: 0.22,
    // raw counters snapshot
    last: { hitGood:0, hitJunk:0, expireGood:0, miss:0, shots:0 },
    missStreak: 0,
  };

  function updateFromSummaryLike(st){
    // st: {hitGood, hitJunk, expireGood, miss, combo, comboMax, shots?}
    const hitGood = st.hitGood|0;
    const hitJunk = st.hitJunk|0;
    const expireGood = st.expireGood|0;
    const miss = st.miss|0;
    const combo = st.combo|0;

    const denom = Math.max(1, hitGood + hitJunk + expireGood + miss);
    const acc = hitGood / denom;

    const junkRate = hitJunk / denom;
    const expireRate = expireGood / denom;

    // normalize combo to 0..1 (soft)
    const comboN = clamp(combo / 12, 0, 1);

    // miss streak normalized 0..1
    const msN = clamp(S.missStreak / 4, 0, 1);

    // EMA update
    const a = cfg.emaA;
    S.emaAcc = (1-a)*S.emaAcc + a*acc;
    S.emaCombo = (1-a)*S.emaCombo + a*comboN;
    S.emaJunkRate = (1-a)*S.emaJunkRate + a*junkRate;
    S.emaExpireRate = (1-a)*S.emaExpireRate + a*expireRate;
    S.emaMissStreak = (1-a)*S.emaMissStreak + a*msN;

    // risk (explainable linear mix)
    const risk =
      cfg.wMissStreak * S.emaMissStreak +
      cfg.wJunkRate   * clamp(S.emaJunkRate/0.30, 0, 1) +
      cfg.wExpireRate * clamp(S.emaExpireRate/0.25, 0, 1) +
      cfg.wLowCombo   * (1 - S.emaCombo) +
      cfg.wLowAcc     * (1 - clamp(S.emaAcc/0.85, 0, 1));

    const ra = cfg.riskEmaA;
    S.emaRisk = (1-ra)*S.emaRisk + ra*clamp(risk,0,1);

    // skill score (higher better): acc + combo - risk
    const skill = clamp(0.62*S.emaAcc + 0.26*S.emaCombo + 0.12*(1-S.emaRisk), 0, 1);

    const tier = (skill >= cfg.tierA) ? 'A' : (skill >= cfg.tierB) ? 'B' : 'C';

    const reasons = [];
    if(S.emaRisk > 0.62) reasons.push('เสี่ยงพลาดสูง (ช่วงนี้พลาด/โดนของเสียถี่)');
    if(S.emaAcc < 0.65) reasons.push('ความแม่นยำยังต่ำ');
    if(S.emaCombo < 0.30) reasons.push('คอมโบยังไม่คงที่');
    if(S.emaExpireRate > 0.18) reasons.push('ของดีหมดอายุเยอะ → ต้องเล็งเร็วขึ้น');
    if(S.emaJunkRate > 0.18) reasons.push('โดนของเสียบ่อย → แยกให้ชัด');

    return {
      skillScore: skill,
      riskMiss5s: clamp(S.emaRisk, 0, 1),
      tier,
      reasons
    };
  }

  function onEvent(name){
    // use only simple streak logic for explainable prediction
    if(name === 'hitGood' || name === 'star' || name === 'shield'){
      S.missStreak = 0;
    }else if(name === 'hitJunk' || name === 'miss'){
      S.missStreak = Math.min(6, S.missStreak + 1);
    }else if(name === 'shoot'){
      // no-op
    }
  }

  return { updateFromSummaryLike, onEvent, _state:S };
}