// === /herohealth/shared/nutrition-entry.js ===
// Entry helpers for nutrition zone / hub cards
// PATCH v20260318-NUTRITION-SHARED-FULL

import { buildUrl } from './nutrition-common.js';
import { NUTRITION_PATHS } from './nutrition-production.js';

export function buildNutritionZoneUrl(ctx, extra = {}) {
  return buildUrl(NUTRITION_PATHS.zone, {
    ...ctx.query,
    cat: 'nutrition',
    theme: extra.theme ?? 'nutrition',
    zone: 'nutrition',
    hub: extra.hub ?? ctx.hub,
    returnTo: extra.returnTo ?? ctx.returnTo,
    launcher: NUTRITION_PATHS.zone,
    view: extra.view ?? ctx.view,
    run: extra.run ?? ctx.run,
    phase: extra.phase ?? ctx.phase,
    diff: extra.diff ?? ctx.diff,
    time: extra.time ?? ctx.time,
    engine: extra.engine ?? ctx.engine
  });
}

export function buildGroupsLauncherUrl(ctx, extra = {}) {
  return buildUrl(NUTRITION_PATHS.groups.launcher, {
    ...ctx.query,
    cat: 'nutrition',
    theme: 'groups',
    game: 'groups',
    hub: extra.hub ?? ctx.hub,
    returnTo: extra.returnTo ?? ctx.returnTo,
    launcher: NUTRITION_PATHS.groups.launcher,
    view: extra.view ?? ctx.view,
    run: extra.run ?? ctx.run,
    phase: extra.phase ?? ctx.phase,
    diff: extra.diff ?? ctx.diff,
    time: extra.time ?? ctx.time,
    engine: extra.engine ?? ctx.engine
  });
}

export function buildPlateLauncherUrl(ctx, extra = {}) {
  return buildUrl(NUTRITION_PATHS.plate.launcher, {
    ...ctx.query,
    cat: 'nutrition',
    theme: 'plate',
    game: 'plate',
    hub: extra.hub ?? ctx.hub,
    returnTo: extra.returnTo ?? ctx.returnTo,
    launcher: NUTRITION_PATHS.plate.launcher,
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
        returnTo: NUTRITION_PATHS.zone
      });
      return;
    }

    if (mode === 'plate') {
      window.location.href = buildPlateLauncherUrl(ctx, {
        hub: ctx.hub,
        returnTo: NUTRITION_PATHS.zone
      });
      return;
    }

    window.location.href = buildNutritionZoneUrl(ctx, {
      hub: ctx.hub,
      returnTo: ctx.returnTo
    });
  });
}