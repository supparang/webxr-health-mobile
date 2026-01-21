// === /herohealth/vr/ai-predict.js ===
// AI Prediction Hooks — HHA Standard
// ✅ Predict: next 10s risk (miss surge / fatigue / storm fail)
// ✅ No external ML (rule-based proxy) but structured as ML-ready features
// ✅ Deterministic friendly (no random)

export function createAIPredictor(opts={}){
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const cfg = Object.assign({
    horizonSec: 10,
    emaA: 0.18,
  }, opts);

  const S = {
    emaAcc: 0.70,
    emaMissRate: 0.10,
    emaFrustration: 0.20,
    emaFatigue: 0.20,
    last: null
  };

  function update(input){
    const {
      acc=0.7, missRate=0.1, frustration=0.2, fatigue=0.2,
      inStorm=false, inEndWindow=false, zone='GREEN', shield=0,
      timeK=0.0, combo=0, kids=false
    } = (input||{});

    S.emaAcc = S.emaAcc*(1-cfg.emaA) + clamp(acc,0,1)*cfg.emaA;
    S.emaMissRate = S.emaMissRate*(1-cfg.emaA) + clamp(missRate,0,1)*cfg.emaA;
    S.emaFrustration = S.emaFrustration*(1-cfg.emaA) + clamp(frustration,0,1)*cfg.emaA;
    S.emaFatigue = S.emaFatigue*(1-cfg.emaA) + clamp(fatigue,0,1)*cfg.emaA;

    // risk proxies
    const riskMissSurge = clamp(
      (S.emaMissRate*0.55 + (1-S.emaAcc)*0.45) + (kids? -0.05 : 0),
      0, 1
    );

    const riskFatigue = clamp(
      S.emaFatigue*0.65 + timeK*0.35,
      0, 1
    );

    // storm pass probability proxy
    let stormPassProb = 0.65;
    if (inStorm){
      stormPassProb =
        clamp(
          0.78
          - (riskMissSurge*0.40)
          - (zone==='GREEN' ? 0.18 : 0)
          - (inEndWindow && shield<=0 ? 0.22 : 0)
          + (shield>0 ? 0.10 : 0)
          + clamp(combo/18,0,1)*0.08
          + (kids ? 0.06 : 0),
          0.05, 0.95
        );
    }

    // signals for coach/director
    const signals = {
      missSurge: riskMissSurge >= 0.62,
      fatigueHigh: riskFatigue >= 0.70,
      stormFailRisk: inStorm && stormPassProb <= 0.45,
      endWindowNow: !!inEndWindow,
      needShield: inStorm && inEndWindow && shield<=0,
      stuckGreenInStorm: inStorm && zone==='GREEN'
    };

    const out = {
      features: {
        acc: S.emaAcc,
        missRate: S.emaMissRate,
        frustration: S.emaFrustration,
        fatigue: S.emaFatigue,
        timeK: clamp(timeK,0,1),
        combo: combo|0,
        shield: shield|0,
        zone
      },
      risk: { missSurge: riskMissSurge, fatigue: riskFatigue, stormPassProb },
      signals
    };

    S.last = out;
    return out;
  }

  function getLast(){ return S.last; }

  return { update, getLast };
}