// === /herohealth/shared/nutrition-integration.js ===
// Shared integration helpers for nutrition games
// PATCH v20260318-NUTRITION-SHARED-FULL

import { buildUrl } from './nutrition-common.js';

export function getLauncherTarget(ctx, fallback = '') {
  return (
    ctx.launcher ||
    ctx.returnTo ||
    fallback ||
    ''
  );
}

export function getHubTarget(ctx, fallback = '../hub.html') {
  return ctx.hub || fallback;
}

export function getExitTarget(ctx, fallback = '../hub.html') {
  return (
    ctx.returnTo ||
    ctx.launcher ||
    ctx.hub ||
    fallback
  );
}

export function buildLauncherUrl(ctx, launcherPath, extra = {}) {
  return buildUrl(launcherPath, {
    ...ctx.query,
    launcher: launcherPath,
    returnTo: extra.returnTo ?? ctx.returnTo,
    hub: extra.hub ?? ctx.hub,
    cat: extra.cat ?? ctx.cat,
    theme: extra.theme ?? ctx.theme,
    game: extra.game ?? ctx.game,
    run: extra.run ?? ctx.run,
    mode: extra.mode ?? ctx.mode,
    phase: extra.phase ?? ctx.phase,
    diff: extra.diff ?? ctx.diff,
    time: extra.time ?? ctx.time,
    view: extra.view ?? ctx.view,
    engine: extra.engine ?? ctx.engine,
    logEndpoint: extra.logEndpoint ?? ctx.logEndpoint,
    cloudMode: extra.cloudMode ?? ctx.cloudMode
  });
}

export function buildRunUrl(ctx, runPath, extra = {}) {
  return buildUrl(runPath, {
    ...ctx.query,
    launcher: extra.launcher ?? ctx.launcher,
    returnTo: extra.returnTo ?? ctx.returnTo,
    hub: extra.hub ?? ctx.hub,
    cat: extra.cat ?? ctx.cat,
    theme: extra.theme ?? ctx.theme,
    game: extra.game ?? ctx.game,
    run: extra.run ?? ctx.run,
    mode: extra.mode ?? ctx.mode,
    phase: extra.phase ?? ctx.phase,
    diff: extra.diff ?? ctx.diff,
    time: extra.time ?? ctx.time,
    view: extra.view ?? ctx.view,
    engine: extra.engine ?? ctx.engine,
    logEndpoint: extra.logEndpoint ?? ctx.logEndpoint,
    cloudMode: extra.cloudMode ?? ctx.cloudMode,
    seed: extra.seed ?? Date.now()
  });
}

export function goExit(ctx, fallback = '../hub.html', extra = {}) {
  const target = getExitTarget(ctx, fallback);
  window.location.href = buildUrl(target, {
    ...ctx.query,
    ...extra
  });
}

export function restartFromLauncherOrRun(ctx, currentRunPath, extra = {}) {
  const target = currentRunPath || window.location.pathname;
  window.location.replace(buildRunUrl(ctx, target, {
    ...extra,
    seed: Date.now()
  }));
}