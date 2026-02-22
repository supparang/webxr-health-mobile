// /herohealth/core/warmcool-orchestrator.js
'use strict';

export function localDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function safeLSGet(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function safeLSSet(k, v) {
  try { localStorage.setItem(k, v); } catch {}
}

export function zoneWarmupKey(zone, dayKey = localDayKey()) {
  return `HHA_ZONE_WARMUP_DONE_${dayKey}_${String(zone || 'unknown').toLowerCase()}`;
}

export function shouldRunWarmup({ zone }) {
  const k = zoneWarmupKey(zone);
  return safeLSGet(k) !== '1';
}

export function markWarmupDone({ zone }) {
  const k = zoneWarmupKey(zone);
  safeLSSet(k, '1');
}

export function resolveMainHubUrl() {
  // default hub หลักตามที่คุยกัน
  return `${location.origin}/webxr-health-mobile/herohealth/hub.html`;
}

export function appendParams(url, params = {}) {
  const u = new URL(url, location.href);
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === '') return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

export function pickWarmupTheme({ zone, game }) {
  const z = String(zone || '').toLowerCase();
  const g = String(game || '').toLowerCase();
  if (z === 'nutrition' && g === 'goodjunk') return 'goodjunk-aim-prime';
  if (z === 'nutrition') return 'nutrition-focus';
  return `${z || 'general'}-warmup`;
}

export function pickCooldownTheme({ zone, game }) {
  const z = String(zone || '').toLowerCase();
  const g = String(game || '').toLowerCase();
  if (z === 'nutrition' && g === 'goodjunk') return 'goodjunk-reset-reflect';
  if (z === 'nutrition') return 'nutrition-breath';
  return `${z || 'general'}-cooldown`;
}

export function buildWarmupUrl(ctx = {}) {
  // TODO: เปลี่ยน path ให้ตรง mini-game warmup ของคุณ
  const warmupBase = `${location.origin}/webxr-health-mobile/herohealth/mini/warmup.html`;
  const next = appendParams(ctx.mainUrl, {
    flow: 'main',
    zone: ctx.zone,
    game: ctx.game,
    theme: ctx.gameTheme || ctx.theme || '',
    run: ctx.run,
    diff: ctx.diff,
    time: ctx.time,
    seed: ctx.seed,
    hub: ctx.hub || resolveMainHubUrl()
  });

  return appendParams(warmupBase, {
    flow: 'warmup',
    zone: ctx.zone,
    game: ctx.game,
    theme: pickWarmupTheme(ctx),
    next,
    hub: ctx.hub || resolveMainHubUrl()
  });
}

export function buildCooldownUrl(ctx = {}) {
  // TODO: เปลี่ยน path ให้ตรง mini-game cooldown ของคุณ
  const cooldownBase = `${location.origin}/webxr-health-mobile/herohealth/mini/cooldown.html`;
  const ret = ctx.returnUrl || ctx.hub || resolveMainHubUrl();

  return appendParams(cooldownBase, {
    flow: 'cooldown',
    zone: ctx.zone,
    game: ctx.game,
    theme: pickCooldownTheme(ctx),
    return: ret,
    score: ctx.score,
    grade: ctx.grade,
    reason: ctx.reason,
    hub: ctx.hub || resolveMainHubUrl()
  });
}