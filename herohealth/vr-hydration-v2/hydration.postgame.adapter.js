// === /herohealth/vr-hydration-v2/hydration.postgame.adapter.js ===
// HeroHealth Hydration V2 — Postgame Adapter
// FULL PATCH v20260326-HYD-V2-POSTGAME-ADAPTER

'use strict';

import { createHydrationPostgame } from './hydration.postgame.js?v=20260326-hyd-postgame-ui';

function safeJsonParse(raw, fallback = null) {
  try { return JSON.parse(raw); } catch (_) { return fallback; }
}

function nowIso() {
  return new Date().toISOString();
}

function q(name, fallback = '') {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get(name) || fallback;
  } catch (_) {
    return fallback;
  }
}

function clamp(n, a, b) {
  n = Number(n);
  if (!Number.isFinite(n)) n = a;
  return Math.max(a, Math.min(b, n));
}

function resolveHubUrl() {
  const hub = q('hub', '');
  if (hub) return hub;
  return 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html';
}

function resolveFormId() {
  const explicit = (q('form', '') || q('postForm', '') || '').toUpperCase();
  if (explicit === 'A' || explicit === 'B' || explicit === 'C') return explicit;

  const phase = (q('test', '') || q('phase', '') || q('runPhase', '') || '').toLowerCase();
  if (phase === 'pre' || phase === 'pretest') return 'A';
  if (phase === 'delayed' || phase === 'followup' || phase === 'retention') return 'C';
  return 'B';
}

function shouldOpenPostgame() {
  const off = q('postgame', '').toLowerCase();
  if (off === '0' || off === 'false' || off === 'off' || off === 'no') return false;
  return true;
}

function pushHistory(summary) {
  try {
    const oldArr = safeJsonParse(localStorage.getItem('HHA_SUMMARY_HISTORY'), []);
    const arr = Array.isArray(oldArr) ? oldArr : [];
    arr.unshift(summary);
    localStorage.setItem('HHA_SUMMARY_HISTORY', JSON.stringify(arr.slice(0, 50)));
  } catch (_) {}
}

function saveMergedSummary(merged) {
  try {
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(merged));
  } catch (_) {}
  try {
    localStorage.setItem('HHA_HYDRATION_POSTGAME_LAST', JSON.stringify(merged));
  } catch (_) {}
  pushHistory(merged);
}

function mergeGameAndPostgame(baseSummary = {}, postgameSummary = {}) {
  const ingame = {
    score: Number(baseSummary.score || baseSummary.finalScore || 0),
    hit: Number(baseSummary.hit || baseSummary.hits || 0),
    miss: Number(baseSummary.miss || baseSummary.misses || 0),
    accuracy: Number(baseSummary.accuracy || 0),
    playTimeSec: Number(baseSummary.playTimeSec || baseSummary.timeSec || baseSummary.durationSec || 0),
    waterPct: Number(baseSummary.waterPct || baseSummary.waterPercent || 0),
    bestCombo: Number(baseSummary.bestCombo || baseSummary.comboBest || 0),
    shieldUsed: Number(baseSummary.shieldUsed || baseSummary.shield || 0),
    difficulty: String(baseSummary.diff || baseSummary.difficulty || q('diff', 'normal')),
    runMode: String(baseSummary.run || baseSummary.runMode || q('run', 'play')),
    seed: baseSummary.seed ?? q('seed', ''),
    view: String(baseSummary.view || q('view', 'mobile'))
  };

  const merged = {
    pid: String(postgameSummary.pid || baseSummary.pid || q('pid', 'anon')),
    nick: String(baseSummary.nick || q('nick', '')),
    sessionId: String(postgameSummary.sessionId || baseSummary.sessionId || `sess_${Date.now()}`),
    studyId: String(postgameSummary.studyId || baseSummary.studyId || q('studyId', '')),
    phase: String(baseSummary.phase || q('phase', '')),
    conditionGroup: String(baseSummary.conditionGroup || q('conditionGroup', '')),
    game: 'hydration',
    gameVersion: String(baseSummary.gameVersion || 'v2'),
    formId: String(postgameSummary.formId || resolveFormId()),
    zone: 'nutrition',
    hub: resolveHubUrl(),
    timestamp: nowIso(),
    ingame,
    postgame: {
      skipped: !!postgameSummary.skipped,
      decisionItems: Number(postgameSummary.decisionItems || 0),
      decisionScoreTotal: Number(postgameSummary.decisionScoreTotal || 0),
      reasonScoreTotal: Number(postgameSummary.reasonScoreTotal || 0),
      confidenceMean: Number(postgameSummary.confidenceMean || 0),
      createId: String(postgameSummary.createId || ''),
      createScore: Number(postgameSummary.createScore || 0),
      totalPostgameScore: Number(postgameSummary.totalPostgameScore || 0),
      details: postgameSummary.details || null
    },
    composite: {
      ingameScore: ingame.score,
      postgameScore: Number(postgameSummary.totalPostgameScore || 0),
      totalScore: Number(ingame.score || 0) + Number(postgameSummary.totalPostgameScore || 0)
    }
  };

  return merged;
}

function defaultEventSink(evt) {
  try {
    const arr = safeJsonParse(sessionStorage.getItem('HHA_HYD_POSTGAME_EVENTS'), []);
    const next = Array.isArray(arr) ? arr : [];
    next.push(evt);
    sessionStorage.setItem('HHA_HYD_POSTGAME_EVENTS', JSON.stringify(next.slice(-200)));
  } catch (_) {}
}

export function goBackHydrationHub(extraParams = {}) {
  try {
    const hub = new URL(resolveHubUrl(), window.location.href);
    Object.entries(extraParams || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      hub.searchParams.set(k, String(v));
    });
    window.location.href = hub.toString();
  } catch (_) {
    window.location.href = resolveHubUrl();
  }
}

export function openHydrationV2PostgameFlow(config = {}) {
  if (!shouldOpenPostgame()) {
    const merged = mergeGameAndPostgame(config.baseSummary || {}, { skipped: true });
    saveMergedSummary(merged);
    if (typeof config.onDone === 'function') config.onDone(merged);
    return null;
  }

  if (window.__HHA_HYD_V2_POSTGAME_OPEN__) return null;
  window.__HHA_HYD_V2_POSTGAME_OPEN__ = true;

  const pid = String(config.pid || config.baseSummary?.pid || q('pid', 'anon'));
  const sessionId = String(config.sessionId || config.baseSummary?.sessionId || `sess_${Date.now()}`);
  const studyId = String(config.studyId || config.baseSummary?.studyId || q('studyId', ''));
  const formId = String(config.formId || resolveFormId());
  const seed = config.seed ?? config.baseSummary?.seed ?? q('seed', '');

  const emit = typeof config.onEvent === 'function' ? config.onEvent : defaultEventSink;

  return createHydrationPostgame({
    mountTo: config.mountTo || document.body,
    formId,
    decisionCount: clamp(config.decisionCount ?? 2, 1, 3),
    pid,
    sessionId,
    studyId,
    phase: 'postgame',
    gameVersion: 'v2',
    seed,
    allowSkip: !!config.allowSkip,
    textReason: config.textReason !== false,
    onEvent(evt) {
      emit(evt);
      if (config.logger && typeof config.logger.push === 'function') {
        try { config.logger.push(evt.event, evt); } catch (_) {}
      }
      if (config.logger && typeof config.logger.logEvent === 'function') {
        try { config.logger.logEvent(evt.event, evt); } catch (_) {}
      }
    },
    onFinish(postgameSummary) {
      window.__HHA_HYD_V2_POSTGAME_OPEN__ = false;

      const merged = mergeGameAndPostgame(config.baseSummary || {}, postgameSummary || {});
      saveMergedSummary(merged);

      if (config.logger && typeof config.logger.push === 'function') {
        try { config.logger.push('hydration_v2_postgame_merged_summary', merged); } catch (_) {}
      }
      if (config.logger && typeof config.logger.logSession === 'function') {
        try { config.logger.logSession('hydration_v2_postgame_merged_summary', merged); } catch (_) {}
      }

      if (typeof config.onDone === 'function') {
        try { config.onDone(merged); } catch (_) {}
      }
    }
  });
}