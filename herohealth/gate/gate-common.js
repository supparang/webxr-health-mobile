// === /herohealth/gate/gate-common.js ===
// HeroHealth Gate Common
// FULL PATCH v20260314a-GATE-COMMON-DAILY-ONCE-ALLGAMES

import { normalizeGameId } from './gate-games.js?v=20260313c';

function qs(url, key, fallback = '') {
  try {
    return url.searchParams.get(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeUrl(raw, fallback = '') {
  try {
    if (!raw) return fallback;
    return new URL(raw, window.location.href).toString();
  } catch {
    return fallback || '';
  }
}

function hhDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function lsGet(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}

function lsSet(k, v) {
  try { localStorage.setItem(k, v); } catch {}
}

function lsRemove(k) {
  try { localStorage.removeItem(k); } catch {}
}

export function setText(el, value = '') {
  if (el) el.textContent = String(value ?? '');
}

export function sanitizeBuffs(obj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v == null) continue;
    if (typeof v === 'number') {
      out[k] = Number.isFinite(v) ? v : 0;
    } else if (typeof v === 'string' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

export function saveLastSummary(summary = {}) {
  try {
    const game = normalizeGameId(String(summary.game || summary.gameKey || '').toLowerCase());
    const pid = String(summary.pid || 'anon').trim() || 'anon';

    const row = {
      ...summary,
      game,
      pid,
      ts: Number(summary.ts || Date.now()),
      iso: new Date(Number(summary.ts || Date.now())).toISOString()
    };

    lsSet('HHA_LAST_SUMMARY', JSON.stringify(row));
    if (game) {
      lsSet(`HHA_LAST_SUMMARY:${game}:${pid}`, JSON.stringify(row));
    }
    return row;
  } catch {
    return null;
  }
}

export function buildCtx(url = new URL(window.location.href)) {
  const game = normalizeGameId(String(qs(url, 'game', '')).toLowerCase());
  const theme = normalizeGameId(String(qs(url, 'theme', game)).toLowerCase());
  const cat = String(qs(url, 'cat', qs(url, 'zone', ''))).toLowerCase() || 'nutrition';

  return {
    game,
    theme,
    cat,
    zone: String(qs(url, 'zone', cat)).toLowerCase() || cat,
    pid: String(qs(url, 'pid', 'anon')).trim() || 'anon',
    run: String(qs(url, 'run', 'play')).toLowerCase(),
    mode: String(qs(url, 'mode', qs(url, 'phase', 'warmup'))).toLowerCase(),
    phase: String(qs(url, 'phase', 'warmup')).toLowerCase(),
    diff: String(qs(url, 'diff', 'easy')).toLowerCase(),
    view: String(qs(url, 'view', 'mobile')).toLowerCase(),
    seed: String(qs(url, 'seed', '')),
    time: Number(qs(url, 'time', 60) || 60),
    hub: safeUrl(qs(url, 'hub', './hub.html'), './hub.html'),
    next: safeUrl(qs(url, 'next', ''), ''),
    runUrl: safeUrl(qs(url, 'runUrl', ''), ''),
    studyId: String(qs(url, 'studyId', '')),
    conditionGroup: String(qs(url, 'conditionGroup', ''))
  };
}

export function getDailyDone(ctx = {}) {
  const mode = String(ctx.mode || ctx.phase || 'warmup').toLowerCase() === 'cooldown' ? 'cooldown' : 'warmup';
  const cat = String(ctx.cat || ctx.zone || 'nutrition').toLowerCase();
  const game = normalizeGameId(String(ctx.game || ctx.theme || '').toLowerCase());
  const pid = String(ctx.pid || 'anon').trim() || 'anon';
  const day = hhDayKey();

  if (!game) return false;

  const key =
    mode === 'cooldown'
      ? `HHA_COOLDOWN_DONE:${cat}:${game}:${pid}:${day}`
      : `HHA_WARMUP_DONE:${cat}:${game}:${pid}:${day}`;

  return lsGet(key) === '1';
}

export function setDailyDone(ctx = {}, done = true) {
  const mode = String(ctx.mode || ctx.phase || 'warmup').toLowerCase() === 'cooldown' ? 'cooldown' : 'warmup';
  const cat = String(ctx.cat || ctx.zone || 'nutrition').toLowerCase();
  const game = normalizeGameId(String(ctx.game || ctx.theme || '').toLowerCase());
  const pid = String(ctx.pid || 'anon').trim() || 'anon';
  const day = hhDayKey();

  if (!game) return;

  const key =
    mode === 'cooldown'
      ? `HHA_COOLDOWN_DONE:${cat}:${game}:${pid}:${day}`
      : `HHA_WARMUP_DONE:${cat}:${game}:${pid}:${day}`;

  if (done) lsSet(key, '1');
  else lsRemove(key);
}