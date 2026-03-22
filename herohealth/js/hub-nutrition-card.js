// === /herohealth/js/hub-nutrition-card.js ===
// Bind nutrition card/button in existing hub
// PATCH v20260318-NUTRITION-HUB-CARD-A

import { createCtx } from '../shared/nutrition-common.js';
import { bindNutritionHubCard } from '../shared/nutrition-entry.js';

const ctx = createCtx('hub-nutrition-entry');

const hubNutritionBtn = document.getElementById('hubNutritionBtn');
bindNutritionHubCard({
  button: hubNutritionBtn,
  ctx,
  mode: 'zone'
});