// === /herohealth/js/hub-nutrition-wiring.js ===
// Production hub wiring for nutrition entries
// PATCH v20260318-NUTRITION-PRODUCTION-WIRING-A

import { createCtx } from '../shared/nutrition-common.js';
import { bindNutritionHubCard } from '../shared/nutrition-entry.js';

const ctx = createCtx('hub-nutrition');

bindNutritionHubCard({
  button: document.getElementById('hubNutritionBtn'),
  ctx,
  mode: 'zone'
});

bindNutritionHubCard({
  button: document.getElementById('hubGroupsBtn'),
  ctx,
  mode: 'groups'
});

bindNutritionHubCard({
  button: document.getElementById('hubPlateBtn'),
  ctx,
  mode: 'plate'
});