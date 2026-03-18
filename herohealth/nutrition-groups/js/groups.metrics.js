// === /herohealth/nutrition-groups/js/groups.metrics.js ===
// Metric builder for Nutrition Groups
// PATCH v20260318-GROUPS-VSLICE-A

export function buildGroupsMetrics(ctx, stats, sessionMeta) {
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

    durationMs: sessionMeta.durationMs,
    sessionId: sessionMeta.sessionId
  };
}