// === /herohealth/hydration-vr/hydration.ml-export.js ===
// Hydration ML Export Helpers
// PATCH v20260315-HYD-ML-EXPORT

function toNum(v, d=0){
  v = Number(v);
  return Number.isFinite(v) ? v : d;
}

function bool01(v){
  return v ? 1 : 0;
}

export function createHydrationMLExporter(opts = {}){
  const schemaVersion = String(opts.schemaVersion || 'hyd-ml-v1');

  function makePredictionSnapshot(ts, prediction = {}, features = {}){
    return {
      schemaVersion,
      ts: toNum(ts),
      phase: String(features.phase || ''),
      bossLevel: toNum(features.bossLevel),
      missRisk: toNum(prediction.missRisk),
      failRisk: toNum(prediction.failRisk),
      dropoffRisk: toNum(prediction.dropoffRisk),
      needHelp: toNum(prediction.needHelp),
      confidence: toNum(prediction.confidence),
      modelVersion: String(prediction.modelVersion || ''),
      modelSource: String(prediction.source || '')
    };
  }

  function makeCoachSnapshot(ts, coachRow = {}, features = {}, prediction = {}){
    return {
      schemaVersion,
      ts: toNum(ts),
      phase: String(features.phase || ''),
      reasonCode: String(coachRow.reasonCode || ''),
      text: String(coachRow.text || ''),
      severity: String(coachRow.severity || ''),
      confidence: toNum(coachRow.confidence ?? prediction.confidence ?? 0),
      mode: String(coachRow.mode || ''),
      triggered: bool01(!!coachRow.text)
    };
  }

  function makeFeatureRow(base = {}, extra = {}){
    return {
      schemaVersion,
      ts: toNum(base.ts),
      phase: String(base.phase || ''),
      bossLevel: toNum(base.bossLevel),

      score: toNum(base.score),
      missBadHit: toNum(base.missBadHit),
      missGoodExpired: toNum(base.missGoodExpired),
      combo: toNum(base.combo),
      bestCombo: toNum(base.bestCombo),
      waterPct: toNum(base.waterPct),
      shield: toNum(base.shield),
      blockCount: toNum(base.blockCount),
      timeLeft: toNum(base.timeLeft),
      feverOn: bool01(base.feverOn),
      inDangerPhase: bool01(base.inDangerPhase),
      inCorrectZone: bool01(base.inCorrectZone),

      missRateRecent: toNum(base.missRateRecent),
      goodHitRateRecent: toNum(base.goodHitRateRecent),
      badHitRateRecent: toNum(base.badHitRateRecent),
      expireRateRecent: toNum(base.expireRateRecent),

      hitQualityRatio: toNum(base.hitQualityRatio),
      comboStability: toNum(base.comboStability),
      waterRecoverySlope: toNum(base.waterRecoverySlope),
      shieldUsageEfficiency: toNum(base.shieldUsageEfficiency),
      stormSurvivalQuality: toNum(base.stormSurvivalQuality),
      bossPhasePerformance: toNum(base.bossPhasePerformance),

      fatigueProxy: toNum(base.fatigueProxy),
      frustrationProxy: toNum(base.frustrationProxy),

      ...extra
    };
  }

  function makeLabelRow(featureRow = {}, ctx = {}){
    const waterPct = toNum(featureRow.waterPct);
    const missRateRecent = toNum(featureRow.missRateRecent);
    const badHitRateRecent = toNum(featureRow.badHitRateRecent);
    const frustrationProxy = toNum(featureRow.frustrationProxy);
    const fatigueProxy = toNum(featureRow.fatigueProxy);
    const phase = String(featureRow.phase || '');
    const outcome = String(ctx.outcome || '');

    const failSoon =
      waterPct < 12 ||
      (featureRow.inDangerPhase && !featureRow.inCorrectZone && toNum(featureRow.shield) <= 0) ||
      missRateRecent > 0.75;

    const assistanceNeeded =
      frustrationProxy >= 0.60 ||
      badHitRateRecent >= 0.30 ||
      (waterPct < 25 && toNum(featureRow.shield) <= 0);

    const frustrationSegment =
      frustrationProxy >= 0.55 ||
      (badHitRateRecent >= 0.28 && fatigueProxy >= 0.45);

    const highMissSegment =
      missRateRecent >= 0.55 || badHitRateRecent >= 0.32;

    const survive =
      outcome === 'final-clear' ||
      outcome === 'time' ||
      (waterPct > 0 && ctx.sessionEnded ? 1 : 0);

    const bossClearQuality =
      phase.startsWith('boss') || phase === 'final'
        ? (
            toNum(featureRow.bossPhasePerformance) >= 0.70 ? 2 :
            toNum(featureRow.bossPhasePerformance) >= 0.45 ? 1 : 0
          )
        : 0;

    return {
      schemaVersion,
      ts: toNum(featureRow.ts),
      phase,
      fail_soon_5s: bool01(failSoon),
      survive: bool01(survive),
      high_miss_segment: bool01(highMissSegment),
      frustration_segment: bool01(frustrationSegment),
      assistance_needed: bool01(assistanceNeeded),
      boss_clear_quality: bossClearQuality
    };
  }

  function packageSession(args = {}){
    return {
      schemaVersion,
      sessionMeta: args.sessionMeta || {},
      featureRows: Array.isArray(args.featureRows) ? args.featureRows : [],
      labelRows: Array.isArray(args.labelRows) ? args.labelRows : [],
      predictionSnapshots: Array.isArray(args.predictionSnapshots) ? args.predictionSnapshots : [],
      coachSnapshots: Array.isArray(args.coachSnapshots) ? args.coachSnapshots : [],
      directorActions: Array.isArray(args.directorActions) ? args.directorActions : [],
      outcomePerPhase: args.outcomePerPhase || {},
      sessionSummary: args.sessionSummary || {}
    };
  }

  return {
    schemaVersion,
    makeFeatureRow,
    makeLabelRow,
    makePredictionSnapshot,
    makeCoachSnapshot,
    packageSession
  };
}