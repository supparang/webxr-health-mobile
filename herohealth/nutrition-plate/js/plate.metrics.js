// === /herohealth/nutrition-plate/js/plate.metrics.js ===
// Metric builder for Nutrition Plate
// PATCH v20260318-PLATE-VSLICE-B

export function buildPlateMetrics(ctx, stats, sessionMeta) {
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

    quizPreTotal: preTotal,
    quizPreCorrect: preCorrect,
    quizPostTotal: postTotal,
    quizPostCorrect: postCorrect,
    quizDelta: postCorrect - preCorrect,

    buildSelections: stats.build.total,
    buildBalanceScore: stats.build.balanceScore,
    buildBalanceLevel: stats.build.balanceLevel,

    fixTotal: stats.fix.total,
    fixCorrect: stats.fix.correct,

    swapTotal: stats.swap.total,
    swapCorrect: stats.swap.correct,

    vegChosen: stats.build.vegChosen,
    fruitChosen: stats.build.fruitChosen,
    healthyDrinkChosen: stats.build.healthyDrinkChosen,

    durationMs: sessionMeta.durationMs,
    sessionId: sessionMeta.sessionId
  };
}