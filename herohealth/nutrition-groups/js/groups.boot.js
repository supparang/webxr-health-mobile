// === /herohealth/nutrition-groups/js/groups.boot.js ===
// Boot file for Nutrition Groups
// PATCH v20260318-NUTRITION-SHARED-HARDENING-A

import { createCtx, saveLastSummary } from '../../shared/nutrition-common.js';
import { createLogger } from '../../shared/nutrition-logging.js';
import { restartCurrentPage } from '../../shared/nutrition-router.js';
import { GroupsEngine } from './groups.engine.js';
import { createGroupsUI } from './groups.ui.js';
import { createGroupsCoach } from './groups.coach.js';

const ctx = createCtx('nutrition-groups');
const logger = createLogger(ctx, 'nutrition-groups');
const engine = new GroupsEngine(ctx, logger);
const coach = createGroupsCoach();

const ui = createGroupsUI(ctx, {
  onAnswer: async (answerId) => {
    const beforeState = engine.getViewState();
    const result = engine.submit(answerId);

    ui.showFeedback(result.evaluation);

    const answerCoach = coach.maybeAfterAnswer({
      phaseKey: beforeState.phaseKey,
      evaluation: result.evaluation,
      stats: engine.stats
    });
    if (answerCoach) ui.showCoach(answerCoach);

    if (result.finished) {
      saveLastSummary(result.summary.payload);
      logger.flush('groups-finished');
      setTimeout(() => ui.showSummary(result.summary), 700);
      return;
    }

    setTimeout(() => {
      ui.renderQuestion(result.viewState, result.question);
      const phaseCoach = coach.maybePhase(result.viewState.phaseKey);
      if (phaseCoach) ui.showCoach(phaseCoach);
    }, 650);
  },

  onReplay: () => {
    logger.flush('groups-replay-before-reset');
    restartCurrentPage({ seed: Date.now() });
  }
});

const firstQuestion = engine.getCurrentQuestion();
const firstState = engine.getViewState();
ui.renderQuestion(firstState, firstQuestion);
ui.showCoach(coach.maybePhase(firstState.phaseKey, true));

function safeFlush(reason) {
  try {
    logger.flush(reason);
  } catch (err) {
    console.warn('[groups.boot] safeFlush failed:', err);
  }
}

window.addEventListener('beforeunload', () => safeFlush('groups-beforeunload'));
window.addEventListener('pagehide', () => safeFlush('groups-pagehide'));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') safeFlush('groups-hidden');
});