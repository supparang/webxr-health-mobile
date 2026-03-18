// === /herohealth/shared/nutrition-common.js ===
// Shared helpers for nutrition games
// PATCH v20260318-GROUPS-VSLICE-A

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

export function createCtx(gameId) {
  const qs = parseQuery();
  const seed = Number(qs.seed || Date.now());

  return {
    gameId,
    cat: qs.cat || 'nutrition',
    theme: qs.theme || gameId,
    pid: qs.pid || 'anon',
    studyId: qs.studyId || '',
    phase: qs.phase || 'play',
    run: qs.run || 'play',
    diff: qs.diff || 'normal',
    time: Number(qs.time || 90),
    seed,
    hub: qs.hub || '../hub.html',
    view: qs.view || 'mobile',
    engine: qs.engine || 'v1',
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

export function saveLastSummary(payload) {
  try {
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));

    const prev = JSON.parse(localStorage.getItem('HHA_SUMMARY_HISTORY') || '[]');
    prev.unshift(payload);
    localStorage.setItem('HHA_SUMMARY_HISTORY', JSON.stringify(prev.slice(0, 30)));
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