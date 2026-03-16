// === /herohealth/hydration-vr/hydration.features.js ===
// Hydration Feature Extraction
// PATCH v20260315-HYD-AI-FEATURES

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function mean(arr){
  if(!arr?.length) return 0;
  return arr.reduce((s,v)=> s + Number(v || 0), 0) / arr.length;
}

function sum(arr){
  if(!arr?.length) return 0;
  return arr.reduce((s,v)=> s + Number(v || 0), 0);
}

function slope(points){
  if(!points || points.length < 2) return 0;
  const n = points.length;
  const xs = points.map((_,i)=> i + 1);
  const ys = points.map(v => Number(v || 0));
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, den = 0;
  for(let i=0;i<n;i++){
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  return den ? num / den : 0;
}

function stddev(arr){
  if(!arr?.length) return 0;
  const m = mean(arr);
  const v = mean(arr.map(x => {
    const d = Number(x || 0) - m;
    return d * d;
  }));
  return Math.sqrt(v);
}

function ratio(a, b){
  a = Number(a || 0);
  b = Number(b || 0);
  return b <= 0 ? a : a / b;
}

export function createHydrationFeatureExtractor(opts = {}){
  const windowSec = Math.max(5, Number(opts.windowSec || 12));
  const sampleHz = Math.max(1, Number(opts.sampleHz || 2));
  const keepMs = windowSec * 1000;

  const samples = [];
  const events = [];

  function prune(nowMs){
    const minTs = nowMs - keepMs;
    while(samples.length && samples[0].ts < minTs) samples.shift();
    while(events.length && events[0].ts < minTs) events.shift();
  }

  function ingestState(snapshot){
    const row = {
      ts: Number(snapshot?.ts || 0),
      phase: String(snapshot?.phase || 'normal'),
      score: Number(snapshot?.score || 0),
      missBadHit: Number(snapshot?.missBadHit || 0),
      missGoodExpired: Number(snapshot?.missGoodExpired || 0),
      combo: Number(snapshot?.combo || 0),
      bestCombo: Number(snapshot?.bestCombo || 0),
      waterPct: Number(snapshot?.waterPct || 0),
      shield: Number(snapshot?.shield || 0),
      blockCount: Number(snapshot?.blockCount || 0),
      timeLeft: Number(snapshot?.timeLeft || 0),
      bossLevel: Number(snapshot?.bossLevel || 0),
      feverOn: snapshot?.feverOn ? 1 : 0,
      inDangerPhase: snapshot?.inDangerPhase ? 1 : 0,
      inCorrectZone: snapshot?.inCorrectZone ? 1 : 0
    };
    samples.push(row);
    prune(row.ts);
    return row;
  }

  function ingestEvent(evt){
    const row = {
      ts: Number(evt?.ts || 0),
      type: String(evt?.type || ''),
      phase: String(evt?.phase || 'normal'),
      payload: evt?.payload || null
    };
    events.push(row);
    prune(row.ts);
    return row;
  }

  function countEvents(types){
    const set = new Set(Array.isArray(types) ? types : [types]);
    return events.filter(e => set.has(e.type)).length;
  }

  function countEventsInPhase(types, phasePrefix){
    const set = new Set(Array.isArray(types) ? types : [types]);
    return events.filter(e => set.has(e.type) && String(e.phase || '').startsWith(phasePrefix)).length;
  }

  function latest(){
    return samples.length ? samples[samples.length - 1] : null;
  }

  function extract(nowMeta = {}){
    const cur = latest();
    if(!cur){
      return {
        featureVersion: 'hyd-v1',
        valid: 0
      };
    }

    const waterSeries = samples.map(s => s.waterPct);
    const comboSeries = samples.map(s => s.combo);
    const shieldSeries = samples.map(s => s.shield);

    const goodHits = countEvents('good_hit');
    const badHits = countEvents('bad_hit');
    const goodExpires = countEvents('good_expire');
    const blocks = countEvents(['bad_block', 'lightning_block']);
    const bonusHits = countEvents('bonus_hit');
    const lightningHits = countEvents('lightning_hit');

    const totalNegative = badHits + goodExpires + lightningHits;
    const totalPositive = goodHits + bonusHits + blocks;

    const recentSec = Math.max(1, samples.length / sampleHz);

    const missRateRecent = ratio(totalNegative, recentSec);
    const goodHitRateRecent = ratio(goodHits + bonusHits, recentSec);
    const badHitRateRecent = ratio(badHits, recentSec);
    const expireRateRecent = ratio(goodExpires, recentSec);

    const comboStability = Math.max(0, 1 - clamp(stddev(comboSeries) / 10, 0, 1));
    const waterRecoverySlope = slope(waterSeries);
    const shieldUsageEfficiency = ratio(blocks, Math.max(1, blocks + lightningHits + badHits));
    const hitQualityRatio = ratio(totalPositive, Math.max(1, totalPositive + totalNegative));

    const stormGood = countEventsInPhase(['good_hit','bonus_hit'], 'storm');
    const stormNeg = countEventsInPhase(['bad_hit','good_expire','lightning_hit'], 'storm');
    const stormSurvivalQuality = ratio(stormGood, Math.max(1, stormGood + stormNeg));

    const bossGood =
      countEventsInPhase(['good_hit','bonus_hit'], 'boss1') +
      countEventsInPhase(['good_hit','bonus_hit'], 'boss2') +
      countEventsInPhase(['good_hit','bonus_hit'], 'boss3');

    const bossNeg =
      countEventsInPhase(['bad_hit','good_expire','lightning_hit'], 'boss1') +
      countEventsInPhase(['bad_hit','good_expire','lightning_hit'], 'boss2') +
      countEventsInPhase(['bad_hit','good_expire','lightning_hit'], 'boss3');

    const bossPhasePerformance = ratio(bossGood, Math.max(1, bossGood + bossNeg));

    const fatigueProxy = clamp(
      (cur.timeLeft < 20 ? 0.2 : 0) +
      (cur.combo <= 1 ? 0.15 : 0) +
      (waterRecoverySlope < 0 ? Math.min(0.35, Math.abs(waterRecoverySlope) * 0.08) : 0) +
      (goodHitRateRecent < 0.8 ? 0.18 : 0),
      0, 1
    );

    const frustrationProxy = clamp(
      (badHitRateRecent > 0.35 ? 0.25 : 0) +
      (expireRateRecent > 0.25 ? 0.20 : 0) +
      (cur.waterPct < 25 ? 0.22 : 0) +
      (cur.inDangerPhase && !cur.inCorrectZone ? 0.18 : 0),
      0, 1
    );

    return {
      featureVersion: 'hyd-v1',
      valid: 1,

      ts: Number(nowMeta?.ts || cur.ts || 0),
      phase: cur.phase,
      bossLevel: cur.bossLevel,

      score: cur.score,
      missBadHit: cur.missBadHit,
      missGoodExpired: cur.missGoodExpired,
      combo: cur.combo,
      bestCombo: cur.bestCombo,
      waterPct: cur.waterPct,
      shield: cur.shield,
      blockCount: cur.blockCount,
      timeLeft: cur.timeLeft,
      feverOn: cur.feverOn,
      inDangerPhase: cur.inDangerPhase,
      inCorrectZone: cur.inCorrectZone,

      missRateRecent: +missRateRecent.toFixed(4),
      goodHitRateRecent: +goodHitRateRecent.toFixed(4),
      badHitRateRecent: +badHitRateRecent.toFixed(4),
      expireRateRecent: +expireRateRecent.toFixed(4),

      hitQualityRatio: +hitQualityRatio.toFixed(4),
      comboStability: +comboStability.toFixed(4),
      waterRecoverySlope: +waterRecoverySlope.toFixed(4),
      shieldUsageEfficiency: +shieldUsageEfficiency.toFixed(4),
      stormSurvivalQuality: +stormSurvivalQuality.toFixed(4),
      bossPhasePerformance: +bossPhasePerformance.toFixed(4),

      fatigueProxy: +fatigueProxy.toFixed(4),
      frustrationProxy: +frustrationProxy.toFixed(4)
    };
  }

  function exportState(){
    return {
      windowSec,
      sampleHz,
      sampleCount: samples.length,
      eventCount: events.length
    };
  }

  return {
    ingestState,
    ingestEvent,
    extract,
    exportState
  };
}