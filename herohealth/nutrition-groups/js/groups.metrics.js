// === /herohealth/nutrition-groups/js/groups.metrics.js ===
// Metric builder for Nutrition Groups
// PATCH v20260318-GROUPS-VSLICE-C

export function buildGroupsMetrics(ctx, stats, sessionMeta) {
  const preCorrect = stats.quiz.pre.correct;
  const preTotal = stats.quiz.pre.total;
  const postCorrect = stats.quiz.post.correct;
  const postTotal = stats.quiz.post.total;

  return {
    gameId: ctx.gameId,
    pid: ctx.pid,
    studyId: ctx.studyId,
    phase: ctx.phase,
    run: ctx.run,
    diff: ctx.diff,
    seed: ctx.seed,

    totalScore: stats.score,
    streakBest: stats.bestStreak,

    sortTotal: stats.sort.total,
    sortCorrect: stats.sort.correct,

    compareTotal: stats.compare.total,
    compareCorrect: stats.compare.correct,

    reasonTotal: stats.reason.total,
    reasonCorrect: stats.reason.correct,

    retryTotal: stats.retry.total,
    retryCorrect: stats.retry.correct,
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