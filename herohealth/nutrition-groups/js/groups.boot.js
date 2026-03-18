// === /herohealth/nutrition-groups/js/groups.boot.js ===
// Boot file for Nutrition Groups
// PATCH v20260318-NUTRITION-CLOUD-WIRING-A

import { createCtx, saveLastSummary } from '../../shared/nutrition-common.js';
import { createLogger } from '../../shared/nutrition-logging.js';
import { restartFromLauncherOrRun } from '../../shared/nutrition-integration.js';
import { goCooldownGate } from '../../shared/nutrition-gate.js';
import { buildCloudPacket, sendOrQueuePacket, flushPendingQueue } from '../../shared/nutrition-cloud.js';
import { createCloudStatus } from '../../shared/nutrition-cloud-status.js';
import { GroupsEngine } from './groups.engine.js';
import { createGroupsUI } from './groups.ui.js';
import { createGroupsCoach } from './groups.coach.js';

const ctx = createCtx('nutrition-groups');
const logger = createLogger(ctx, 'nutrition-groups');
const engine = new GroupsEngine(ctx, logger);
const coach = createGroupsCoach();
const cloudStatus = createCloudStatus();

let latestSummary = null;

async function tryFlushQueueOnStart() {
  const result = await flushPendingQueue(ctx);
  if (result.skipped) {
    cloudStatus.show('ยังไม่ได้ตั้ง Apps Script endpoint — ระบบจะเก็บข้อมูลไว้ในเครื่องก่อน', 'warn', 3200);
    return;
  }

  if (result.sent > 0) {
    cloudStatus.show(`ส่งข้อมูลค้างแล้ว ${result.sent} รายการ`, 'ok', 2400);
  }
}

tryFlushQueueOnStart();

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
      latestSummary = result.summary;
      saveLastSummary(result.summary.payload);
      logger.flush('groups-finished');

      const packet = buildCloudPacket({
        ctx,
        sessionMeta: logger.getSessionMeta(),
        payloadType: 'summary',
        metrics: result.summary.payload?.metrics || {},
        summary: {
          title: result.summary.title,
          subtitle: result.summary.subtitle,
          notes: result.summary.notes,
          items: result.summary.items
        },
        raw: {
          summaryPayload: result.summary.payload
        }
      });

      const sendResult = await sendOrQueuePacket(ctx, packet);
      if (sendResult.ok) {
        cloudStatus.show('บันทึกข้อมูลวิจัยขึ้น cloud แล้ว', 'ok', 2200);
      } else if (sendResult.queued) {
        cloudStatus.show('บันทึกไว้ในเครื่องก่อน ยังไม่ได้ส่ง cloud', 'warn', 2800);
      }

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
    restartFromLauncherOrRun(ctx, './groups-run.html', { seed: Date.now() });
  },

  onSummaryBack: () => {
    logger.flush('groups-go-cooldown');
    goCooldownGate(ctx, latestSummary?.payload, {
      cat: 'nutrition',
      theme: 'groups',
      game: 'groups',
      launcher: ctx.launcher || './groups-launcher.html',
      hub: ctx.hub
    });
  },

  summaryBackLabel: 'ไปคูลดาวน์'
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