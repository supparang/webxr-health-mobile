// === /herohealth/shared/nutrition-common.js ===
// Shared helpers for nutrition games
// PATCH v20260318-NUTRITION-CLOUD-WIRING-A

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function parseQuery(search = window.location.search) {
  const sp = new URLSearchParams(search);
  const out = {};
  for (const [k, v] of sp.entries()) out[k] = v;
  return out;
}

export function normalizeGameKey(gameId = '') {
  return String(gameId || 'nutrition')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'NUTRITION';
}

export function createCtx(gameId) {
  const qs = parseQuery();
  const seed = Number(qs.seed || Date.now());

  return {
    gameId,
    gameKey: normalizeGameKey(gameId),

    cat: qs.cat || 'nutrition',
    theme: qs.theme || gameId,
    game: qs.game || gameId,

    pid: qs.pid || 'anon',
    studentId: qs.studentId || qs.pid || 'anon',
    studyId: qs.studyId || '',
    classId: qs.classId || '',
    sectionId: qs.sectionId || '',
    sessionLabel: qs.sessionLabel || '',
    phase: qs.phase || 'play',
    run: qs.run || 'play',
    mode: qs.mode || qs.run || 'play',
    diff: qs.diff || 'normal',
    time: Number(qs.time || 90),
    seed,

    conditionGroup: qs.conditionGroup || '',
    group: qs.group || '',
    cohort: qs.cohort || '',

    hub: qs.hub || '../hub.html',
    launcher: qs.launcher || '',
    next: qs.next || '',
    returnTo: qs.returnTo || '',
    gatePhase: qs.gatePhase || '',
    view: qs.view || 'mobile',
    engine: qs.engine || 'v2',

    logEndpoint: qs.logEndpoint || qs.log || '',
    cloudMode: qs.cloudMode || qs.logMode || 'auto',

    query: qs
  };
}

export function createRng(seedInput) {
  let seed = (Number(seedInput) || Date.now()) >>> 0;
  return function rng() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

export function shuffle(list, rng) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function sample(list, count, rng) {
  return shuffle(list, rng).slice(0, Math.max(0, count));
}

export function formatPercent(correct, total) {
  if (!total) return '0%';
  return `${Math.round((correct / total) * 100)}%`;
}

export function buildUrl(base, params = {}) {
  const url = new URL(base, window.location.href);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function safeParseArray(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLastSummary(payload) {
  try {
    const gameKey = normalizeGameKey(payload?.gameId || payload?.ctx?.gameId || 'nutrition');
    const ts = Date.now();
    const summary = {
      ...payload,
      ts: payload?.ts || ts
    };

    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    localStorage.setItem(`HHA_LAST_SUMMARY_${gameKey}`, JSON.stringify(summary));

    const history = safeParseArray(localStorage.getItem('HHA_SUMMARY_HISTORY'));
    history.unshift(summary);
    localStorage.setItem('HHA_SUMMARY_HISTORY', JSON.stringify(history.slice(0, 30)));

    const historyByGame = safeParseArray(localStorage.getItem(`HHA_SUMMARY_HISTORY_${gameKey}`));
    historyByGame.unshift(summary);
    localStorage.setItem(`HHA_SUMMARY_HISTORY_${gameKey}`, JSON.stringify(historyByGame.slice(0, 30)));
  } catch (err) {
    console.warn('[nutrition-common] saveLastSummary failed:', err);
  }
}

export function goHub(ctx, extra = {}) {
  const target = buildUrl(ctx.hub, {
    ...ctx.query,
    ...extra
  });
  window.location.href = target;
}