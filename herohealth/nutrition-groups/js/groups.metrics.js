// === /herohealth/nutrition-groups/js/groups.metrics.js ===
// Metric builder for Nutrition Groups
// PATCH v20260318-GROUPS-RUN-FULL

export function buildGroupsMetrics(ctx, stats, sessionMeta) {
  const preCorrect = stats.quiz.pre.correct;
  const preTotal = stats.quiz.pre.total;
  const postCorrect = stats.quiz.post.correct;
  const postTotal = stats.quiz.post.total;

  return {
    gameId: ctx.gameId,
    pid: ctx.pid,
    studyId: ctx.studyId,
    classId: ctx.classId,
    sectionId: ctx.sectionId,
    phase: ctx.phase,
    run: ctx.run,
    diff: ctx.diff,
    seed: ctx.seed,
    mode: ctx.mode,
    conditionGroup: ctx.conditionGroup,

    totalScore: stats.score,
    streakBest: stats.bestStreak,

    sortTotal: stats.sort.total,
    sortCorrect: stats.sort.correct,
    sortAccuracy: stats.sort.total ? Number((stats.sort.correct / stats.sort.total).toFixed(4)) : 0,

    compareTotal: stats.compare.total,
    compareCorrect: stats.compare.correct,
    compareAccuracy: stats.compare.total ? Number((stats.compare.correct / stats.compare.total).toFixed(4)) : 0,

    reasonTotal: stats.reason.total,
    reasonCorrect: stats.reason.correct,
    reasonAccuracy: stats.reason.total ? Number((stats.reason.correct / stats.reason.total).toFixed(4)) : 0,

    retryTotal: stats.retry.total,
    retryCorrect: stats.retry.correct,
    retryAccuracy: stats.retry.total ? Number((stats.retry.correct / stats.retry.total).toFixed(4)) : 0,
    retryCorrectedSort: stats.retry.correctedByType.sort,
    retryCorrectedCompare: stats.retry.correctedByType.compare,
    retryCorrectedReason: stats.retry.correctedByType.reason,

    quizPreTotal: preTotal,
    quizPreCorrect: preCorrect,
    quizPostTotal: postTotal,
    quizPostCorrect: postCorrect,
    quizDelta: postCorrect - preCorrect,

    durationMs: sessionMeta.durationMs,
    sessionId: sessionMeta.sessionId
  };
}