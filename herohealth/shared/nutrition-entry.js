// === /herohealth/shared/nutrition-entry.js ===
// Entry helpers for nutrition zone / hub cards
// PATCH v20260318-NUTRITION-HUB-ENTRY-B

import { buildUrl } from './nutrition-common.js';

export function buildNutritionZoneUrl(ctx, extra = {}) {
  return buildUrl('./nutrition-zone.html', {
    ...ctx.query,
    cat: 'nutrition',
    theme: extra.theme ?? 'nutrition',
    zone: 'nutrition',
    hub: extra.hub ?? ctx.hub,
    returnTo: extra.returnTo ?? ctx.returnTo,
    launcher: './nutrition-zone.html',
    view: extra.view ?? ctx.view,
    run: extra.run ?? ctx.run,
    phase: extra.phase ?? ctx.phase,
    diff: extra.diff ?? ctx.diff,
    time: extra.time ?? ctx.time,
    engine: extra.engine ?? ctx.engine
  });
}

export function buildGroupsLauncherUrl(ctx, extra = {}) {
  return buildUrl('./nutrition-groups/groups-launcher.html', {
    ...ctx.query,
    cat: 'nutrition',
    theme: 'groups',
    game: 'groups',
    hub: extra.hub ?? ctx.hub,
    returnTo: extra.returnTo ?? ctx.returnTo,
    launcher: './nutrition-groups/groups-launcher.html',
    view: extra.view ?? ctx.view,
    run: extra.run ?? ctx.run,
    phase: extra.phase ?? ctx.phase,
    diff: extra.diff ?? ctx.diff,
    time: extra.time ?? ctx.time,
    engine: extra.engine ?? ctx.engine
  });
}

export function buildPlateLauncherUrl(ctx, extra = {}) {
  return buildUrl('./nutrition-plate/plate-launcher.html', {
    ...ctx.query,
    cat: 'nutrition',
    theme: 'plate',
    game: 'plate',
    hub: extra.hub ?? ctx.hub,
    returnTo: extra.returnTo ?? ctx.returnTo,
    launcher: './nutrition-plate/plate-launcher.html',
    view: extra.view ?? ctx.view,
    run: extra.run ?? ctx.run,
    phase: extra.phase ?? ctx.phase,
    diff: extra.diff ?? ctx.diff,
    time: extra.time ?? ctx.time,
    engine: extra.engine ?? ctx.engine
  });
}

export function bindNutritionHubCard({
  button,
  ctx,
  mode = 'zone'
}) {
  if (!button || !ctx) return;

  button.addEventListener('click', () => {
    if (mode === 'groups') {
      window.location.href = buildGroupsLauncherUrl(ctx, {
        hub: ctx.hub,
        returnTo: './nutrition-zone.html'
      });
      return;
    }

    if (mode === 'plate') {
      window.location.href = buildPlateLauncherUrl(ctx, {
        hub: ctx.hub,
        returnTo: './nutrition-zone.html'
      });
      return;
    }

    window.location.href = buildNutritionZoneUrl(ctx, {
      hub: ctx.hub,
      returnTo: ctx.returnTo
    });
  });
}