function saveSessionResult(sessionId, result) {
  const progress = loadProgress();

  const passed = evaluateSessionPass(result);
  const stars = calculateStars(result, passed);

  progress.sessions[sessionId] = {
    ...result,
    passed,
    stars,
    status: passed ? "passed" : "completed",
    completedAt: new Date().toISOString()
  };

  saveProgress(progress);
  return progress.sessions[sessionId];
}
