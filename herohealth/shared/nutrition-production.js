// === /herohealth/shared/nutrition-production.js ===
// Canonical production paths for nutrition games
// PATCH v20260318-NUTRITION-PRODUCTION-WIRING-A

export const NUTRITION_PATHS = {
  zoneEntry: './nutrition-zone-entry.html',
  zone: './nutrition-zone.html',

  groups: {
    launcher: './nutrition-groups/groups-launcher.html',
    run: './nutrition-groups/groups-run.html',
    launcherAlias: './groups-vr.html',
    runAlias: './vr-groups/groups.html'
  },

  plate: {
    launcher: './nutrition-plate/plate-launcher.html',
    run: './nutrition-plate/plate-run.html',
    launcherAlias: './plate-vr.html',
    runAlias: './plate/plate-vr.html'
  }
};

export function getNutritionGamePaths(game) {
  if (game === 'groups') return NUTRITION_PATHS.groups;
  if (game === 'plate') return NUTRITION_PATHS.plate;
  return null;
}