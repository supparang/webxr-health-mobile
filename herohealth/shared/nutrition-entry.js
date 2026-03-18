// === /herohealth/shared/nutrition-entry.js ===
// Entry helpers for nutrition zone / hub cards
// PATCH v20260318-NUTRITION-HUB-ENTRY-A

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