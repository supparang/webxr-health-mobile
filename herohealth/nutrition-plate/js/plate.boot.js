// === /herohealth/nutrition-plate/js/plate.boot.js ===
// Boot file for Nutrition Plate
// PATCH v20260318-NUTRITION-SHARED-HARDENING-A

import { createCtx, saveLastSummary } from '../../shared/nutrition-common.js';
import { createLogger } from '../../shared/nutrition-logging.js';
import { restartCurrentPage } from '../../shared/nutrition-router.js';
import { PlateEngine } from './plate.engine.js';
import { createPlateUI } from './plate.ui.js';
import { createPlateCoach } from './plate.coach.js';

const ctx = createCtx('nutrition-plate');
const logger = createLogger(ctx, 'nutrition-plate');
const engine = new PlateEngine(ctx, logger);
const coach = createPlateCoach();

const ui = createPlateUI(ctx, {
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
      logger.flush('plate-finished');
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
    logger.flush('plate-replay-before-reset');
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
    console.warn('[plate.boot] safeFlush failed:', err);
  }
}

window.addEventListener('beforeunload', () => safeFlush('plate-beforeunload'));
window.addEventListener('pagehide', () => safeFlush('plate-pagehide'));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') safeFlush('plate-hidden');
});