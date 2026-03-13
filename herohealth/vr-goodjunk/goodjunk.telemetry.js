// === /herohealth/vr-goodjunk/goodjunk.telemetry.js ===
// GoodJunk Solo Master Pack
// FULL PATCH v20260313c-GJ-TELEMETRY-SOLO-MASTER

'use strict';

function safePush(arr, row, max = 5000) {
  arr.push(row);
  if (arr.length > max) {
    arr.splice(0, arr.length - max);
  }
}

export function createTelemetryStore({
  game = 'goodjunk',
  pid = 'anon',
  seed = '',
  mode = 'solo',
  diff = 'normal',
  view = 'mobile'
} = {}) {
  return {
    meta: {
      game,
      pid,
      seed,
      mode,
      diff,
      view,
      startedAtIso: new Date().toISOString()
    },
    events: [],
    predictionSnapshots: [],
    flushCount: 0
  };
}

export function buildEventRow({
  store,
  eventName,
  tGameMs = 0,
  phase = '',
  payload = {}
}) {
  return {
    game: store?.meta?.game || 'goodjunk',
    pid: store?.meta?.pid || 'anon',
    seed: store?.meta?.seed || '',
    mode: store?.meta?.mode || 'solo',
    diff: store?.meta?.diff || 'normal',
    view: store?.meta?.view || 'mobile',
    atIso: new Date().toISOString(),
    tGameMs: Math.max(0, Math.round(Number(tGameMs || 0))),
    phase: String(phase || ''),
    eventName: String(eventName || ''),
    payload: payload || {}
  };
}

export function logTelemetryEvent(store, row) {
  if (!store || !Array.isArray(store.events) || !row) return;
  safePush(store.events, row, 6000);
}

export function logPredictionSnapshot(store, row) {
  if (!store || !Array.isArray(store.predictionSnapshots) || !row) return;
  safePush(store.predictionSnapshots, row, 500);
  safePush(store.events, row, 6000);
}

export function buildPredictionRow({
  store,
  tGameMs = 0,
  phase = '',
  prediction,
  assistMode = 'none'
}) {
  return buildEventRow({
    store,
    eventName: 'prediction-snapshot',
    tGameMs,
    phase,
    payload: {
      hazardRisk: Number(prediction?.hazardRisk ?? 0),
      frustrationRisk: Number(prediction?.frustrationRisk ?? 0),
      winChance: Number(prediction?.winChance ?? 0),
      fatigueRisk: Number(prediction?.fatigueRisk ?? 0),
      junkConfusionRisk: Number(prediction?.junkConfusionRisk ?? 0),
      attentionDropRisk: Number(prediction?.attentionDropRisk ?? 0),
      coach: String(prediction?.coach || ''),
      explainText: String(prediction?.explainText || ''),
      topFactors: Array.isArray(prediction?.topFactors) ? prediction.topFactors : [],
      assistMode: String(assistMode || 'none')
    }
  });
}

export function buildSummaryRow({
  store,
  tGameMs = 0,
  phase = '',
  detail,
  summary
}) {
  return buildEventRow({
    store,
    eventName: 'summary',
    tGameMs,
    phase,
    payload: {
      outcome: String(summary?.outcome || ''),
      title: String(summary?.title || ''),
      scoreFinal: Number(summary?.scoreFinal ?? detail?.scoreFinal ?? detail?.score ?? 0),
      scoreTarget: Number(summary?.scoreTarget ?? detail?.scoreTarget ?? 0),
      accPct: Number(summary?.accPct ?? detail?.accPct ?? 0),
      missTotal: Number(summary?.missTotal ?? detail?.missTotal ?? 0),
      comboBest: Number(summary?.comboBest ?? detail?.comboBest ?? 0),
      grade: String(summary?.grade ?? detail?.grade ?? ''),
      stars: Number(summary?.stars ?? 1),
      bestMoment: String(summary?.bestMoment || ''),
      weakness: String(summary?.weakness || ''),
      nextTip: String(summary?.nextTip || ''),
      reason: String(detail?.reason || ''),
      bossCleared: !!detail?.bossCleared,
      stageFinal: String(detail?.stageFinal || '')
    }
  });
}

export function buildFlowRow({
  store,
  tGameMs = 0,
  phase = '',
  eventName = 'flow-next',
  payload = {}
}) {
  return buildEventRow({
    store,
    eventName,
    tGameMs,
    phase,
    payload
  });
}

export function deriveWindowFeatures(events = []) {
  const rows = Array.isArray(events) ? events : [];
  const hits = rows.filter(r => r.eventName === 'hit' || r.eventName === 'boss-hit');
  const spawns = rows.filter(r => r.eventName === 'spawn');
  const expires = rows.filter(r => r.eventName === 'expire');
  const misses = rows.filter(r => r.eventName === 'miss-shot');
  const predictions = rows.filter(r => r.eventName === 'prediction-snapshot');

  const hitGood = hits.filter(r => !!r.payload?.good).length;
  const hitJunk = hits.filter(r => !!r.payload?.junk).length;
  const accBase = hitGood + hitJunk + misses.length;

  return {
    totalEvents: rows.length,
    spawnCount: spawns.length,
    hitCount: hits.length,
    hitGood,
    hitJunk,
    expireCount: expires.length,
    missShotCount: misses.length,
    predictionCount: predictions.length,
    accPctApprox: accBase ? Math.round((hitGood / accBase) * 100) : 0,
    junkConfusionRateApprox: hits.length ? +(hitJunk / hits.length).toFixed(3) : 0,
    expireRateApprox: (hitGood + expires.length) ? +(expires.length / (hitGood + expires.length)).toFixed(3) : 0
  };
}

export function exportTelemetryBundle(store, extra = {}) {
  const bundle = {
    meta: {
      ...(store?.meta || {}),
      endedAtIso: new Date().toISOString()
    },
    stats: deriveWindowFeatures(store?.events || []),
    events: store?.events || [],
    predictionSnapshots: store?.predictionSnapshots || [],
    extra
  };
  return bundle;
}

export function persistTelemetryBundle({
  store,
  key = 'HHA_GJ_TELEMETRY_LAST',
  extra = {}
}) {
  const bundle = exportTelemetryBundle(store, extra);
  try {
    localStorage.setItem(key, JSON.stringify(bundle));
  } catch {}
  return bundle;
}

export function flushTelemetry({
  store,
  key = 'HHA_GJ_TELEMETRY_LAST',
  extra = {}
}) {
  if (!store) return null;
  store.flushCount = Number(store.flushCount || 0) + 1;
  return persistTelemetryBundle({ store, key, extra: { ...extra, flushCount: store.flushCount } });
}
