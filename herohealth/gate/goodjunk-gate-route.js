// === /herohealth/gate/goodjunk-gate-route.js ===
// FULL PATCH v20260328-GOODJUNK-GATE-ROUTE

import { normalizeGameId, getRunUrl } from './gate-games.js';

function clean(v) {
  return String(v || '').trim();
}

function decodeMaybe(v) {
  const x = clean(v);
  if (!x) return '';
  try { return decodeURIComponent(x); } catch { return x; }
}

function toQuery(queryLike) {
  if (queryLike instanceof URLSearchParams) return queryLike;
  return new URLSearchParams(queryLike || '');
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const x = clean(v);
    if (x) return x;
  }
  return '';
}

function defaultHubUrl() {
  return new URL('/herohealth/hub.html', location.origin).toString();
}

function normalizeWarmupBuff(warmupResult = {}, q = new URLSearchParams()) {
  const src = warmupResult || {};
  return {
    wType: firstNonEmpty(src.wType, src.type, src.buffType, q.get('wType')),
    wPct: firstNonEmpty(src.wPct, src.pct, src.buffPct, q.get('wPct')),
    wCrit: firstNonEmpty(src.wCrit, src.crit, src.buffCrit, q.get('wCrit')),
    wDmg: firstNonEmpty(src.wDmg, src.dmg, src.buffDmg, q.get('wDmg')),
    wHeal: firstNonEmpty(src.wHeal, src.heal, src.buffHeal, q.get('wHeal')),
    rank: firstNonEmpty(src.rank, src.grade, q.get('rank')),
    calm: firstNonEmpty(src.calm, src.focus, q.get('calm'))
  };
}

function buildBaseParamsFromQuery(q) {
  return {
    pid: firstNonEmpty(q.get('pid'), 'anon'),
    name: firstNonEmpty(q.get('name'), q.get('nickName'), 'Hero'),
    studyId: clean(q.get('studyId')),
    diff: firstNonEmpty(q.get('diff'), 'normal'),
    time: firstNonEmpty(q.get('time'), '150'),
    seed: firstNonEmpty(q.get('seed'), String(Date.now())),
    hub: firstNonEmpty(q.get('hub'), defaultHubUrl()),
    view: firstNonEmpty(q.get('view'), 'mobile'),
    run: firstNonEmpty(q.get('run'), 'play'),
    api: clean(q.get('api')),
    conditionGroup: clean(q.get('conditionGroup')),
    phaseTag: firstNonEmpty(q.get('phaseTag'), q.get('phase')),
    studentKey: clean(q.get('studentKey')),
    schoolCode: clean(q.get('schoolCode')),
    classRoom: clean(q.get('classRoom')),
    studentNo: clean(q.get('studentNo')),
    nickName: clean(q.get('nickName'))
  };
}

function appendParamsToUrl(urlText, extra = {}) {
  const url = new URL(urlText, location.origin);
  Object.entries(extra || {}).forEach(([k, v]) => {
    const x = clean(v);
    if (x) url.searchParams.set(k, x);
  });
  return url.toString();
}

function explicitWarmupNext(q, buff) {
  const raw = firstNonEmpty(q.get('next'), q.get('nextUrl'));
  if (!raw) return '';
  return appendParamsToUrl(decodeMaybe(raw), buff);
}

export function resolveGoodJunkGateNextUrl({
  query = new URLSearchParams(location.search),
  phase = '',
  warmupResult = null
} = {}) {
  const q = toQuery(query);
  const gameId = normalizeGameId(q.get('gameId') || q.get('game') || q.get('theme'));
  const phaseNow = clean(phase || q.get('phase') || 'warmup').toLowerCase();

  const hubUrl = firstNonEmpty(
    decodeMaybe(q.get('nextAfterCooldown')),
    decodeMaybe(q.get('cdnext')),
    clean(q.get('hub')),
    defaultHubUrl()
  );

  if (phaseNow === 'cooldown') {
    return hubUrl;
  }

  const buff = normalizeWarmupBuff(warmupResult, q);
  const explicit = explicitWarmupNext(q, buff);
  if (explicit) return explicit;

  if (gameId === 'goodjunk') {
    const params = {
      ...buildBaseParamsFromQuery(q),
      ...buff
    };
    return getRunUrl('goodjunk', params);
  }

  return '';
}