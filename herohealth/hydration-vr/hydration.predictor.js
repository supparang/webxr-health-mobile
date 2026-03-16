// === /herohealth/hydration-vr/hydration.predictor.js ===
// Hydration Baseline Predictor
// PATCH v20260315-HYD-PREDICTOR

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

export function createHydrationPredictor(opts = {}){
  const version = String(opts.version || 'hyd-baseline-v1');

  function predictMissRisk(fv){
    return clamp(
      fv.badHitRateRecent * 1.2 +
      fv.expireRateRecent * 0.8 +
      (fv.inDangerPhase && !fv.inCorrectZone ? 0.18 : 0),
      0, 1
    );
  }

  function predictFailRisk(fv, missRisk){
    return clamp(
      (fv.waterPct < 25 ? (25 - fv.waterPct) / 25 : 0) * 0.45 +
      missRisk * 0.35 +
      (fv.shield <= 0 && fv.inDangerPhase ? 0.16 : 0) +
      fv.frustrationProxy * 0.25,
      0, 1
    );
  }

  function predictDropoffRisk(fv){
    return clamp(
      fv.fatigueProxy * 0.45 +
      (fv.goodHitRateRecent < 0.7 ? 0.20 : 0) +
      (fv.combo <= 1 ? 0.15 : 0),
      0, 1
    );
  }

  function predictNeedHelp(missRisk, failRisk, dropoffRisk){
    return clamp(
      Math.max(missRisk, failRisk * 0.95, dropoffRisk * 0.85),
      0, 1
    );
  }

  function predictConfidence(fv){
    return clamp(
      0.55 +
      (fv.valid ? 0.15 : 0) +
      Math.min(0.20, (fv.missRateRecent + fv.goodHitRateRecent) * 0.08),
      0, 0.95
    );
  }

  function predict(fv, ctx = {}){
    if(!fv?.valid){
      return {
        missRisk: 0,
        failRisk: 0,
        dropoffRisk: 0,
        needHelp: 0,
        confidence: 0,
        source: 'baseline',
        modelVersion: version
      };
    }

    const noise = Number(ctx?.noise || 0);

    const missRisk = clamp(predictMissRisk(fv) + noise, 0, 1);
    const failRisk = clamp(predictFailRisk(fv, missRisk) + noise * 0.5, 0, 1);
    const dropoffRisk = clamp(predictDropoffRisk(fv) + noise * 0.4, 0, 1);
    const needHelp = predictNeedHelp(missRisk, failRisk, dropoffRisk);
    const confidence = predictConfidence(fv);

    return {
      missRisk: +missRisk.toFixed(4),
      failRisk: +failRisk.toFixed(4),
      dropoffRisk: +dropoffRisk.toFixed(4),
      needHelp: +needHelp.toFixed(4),
      confidence: +confidence.toFixed(4),
      source: 'baseline',
      modelVersion: version
    };
  }

  return {
    version,
    predictMissRisk,
    predictFailRisk,
    predictDropoffRisk,
    predictNeedHelp,
    predict
  };
}