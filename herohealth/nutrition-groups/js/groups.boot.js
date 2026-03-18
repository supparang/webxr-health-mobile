// === /herohealth/nutrition-groups/js/groups.boot.js ===
// Boot file for Nutrition Groups
// PATCH v20260318-GROUPS-VSLICE-A

import { createCtx, saveLastSummary } from '../../shared/nutrition-common.js';
import { createLogger } from '../../shared/nutrition-logging.js';
import { GroupsEngine } from './groups.engine.js';
import { createGroupsUI } from './groups.ui.js';

const ctx = createCtx('nutrition-groups');
const logger = createLogger(ctx, 'nutrition-groups');
const engine = new GroupsEngine(ctx, logger);

const ui = createGroupsUI(ctx, {
  onAnswer: async (answerId) => {
    const result = engine.submit(answerId);
    ui.showFeedback(result.evaluation);

    if (result.finished) {
      saveLastSummary(result.summary.payload);
      logger.flush('groups-finished');
      setTimeout(() => ui.showSummary(result.summary), 700);
      return;
    }

    setTimeout(() => {
      ui.renderQuestion(result.viewState, result.question);
    }, 650);
  },

  onReplay: () => {
    logger.flush('groups-replay-before-reset');
    window.location.reload();
  }
});

const firstQuestion = engine.getCurrentQuestion();
const firstState = engine.getViewState();
ui.renderQuestion(firstState, firstQuestion);

window.addEventListener('beforeunload', () => {
  logger.flush('groups-beforeunload');
});