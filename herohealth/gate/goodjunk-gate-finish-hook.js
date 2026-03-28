// === /herohealth/gate/goodjunk-gate-finish-hook.js ===
// FULL PATCH v20260328-GOODJUNK-GATE-FINISH-HOOK

import { resolveGoodJunkGateNextUrl } from './goodjunk-gate-route.js?v=20260328a';

function clean(v) {
  return String(v || '').trim();
}

function getQuery() {
  return new URLSearchParams(location.search);
}

function getPhaseFromArgOrQuery(phase) {
  const q = getQuery();
  return clean(phase || q.get('phase') || '').toLowerCase();
}

function isGoodJunkQuery(q = getQuery()) {
  const game = clean(q.get('game') || q.get('gameId') || q.get('theme')).toLowerCase();
  return game === 'goodjunk' || game === 'good-junk' || game === 'good_junk';
}

function safeLocationHref(url) {
  if (!url) return false;
  location.href = url;
  return true;
}

export function redirectGoodJunkGateFinish({
  phase = '',
  warmupResult = null
} = {}) {
  const q = getQuery();
  const phaseNow = getPhaseFromArgOrQuery(phase);

  if (!isGoodJunkQuery(q)) return false;
  if (phaseNow !== 'warmup' && phaseNow !== 'cooldown') return false;

  const nextUrl = resolveGoodJunkGateNextUrl({
    query: q,
    phase: phaseNow,
    warmupResult
  });

  if (!nextUrl) return false;
  return safeLocationHref(nextUrl);
}

export function redirectGoodJunkWarmupFinish(warmupResult = null) {
  return redirectGoodJunkGateFinish({
    phase: 'warmup',
    warmupResult
  });
}

export function redirectGoodJunkCooldownFinish() {
  return redirectGoodJunkGateFinish({
    phase: 'cooldown'
  });
}

export function exposeGoodJunkGateFinishOnWindow() {
  window.GoodJunkGateFinish = {
    redirectGoodJunkGateFinish,
    redirectGoodJunkWarmupFinish,
    redirectGoodJunkCooldownFinish
  };
  return window.GoodJunkGateFinish;
}

exposeGoodJunkGateFinishOnWindow();