function getSessionLockState(sessionId, progress, mode = "student") {
  if (mode === "teacher" || mode === "preview") {
    return {
      locked: false,
      reason: "Teacher preview mode"
    };
  }

  if (sessionId === 1) {
    return {
      locked: false,
      reason: "First session"
    };
  }

  if (sessionId === 4 && !progress.bosses.boss1?.passed) {
    return {
      locked: true,
      reason: "Pass Boss 1 first"
    };
  }

  if (sessionId === 7 && !progress.bosses.boss2?.passed) {
    return {
      locked: true,
      reason: "Pass Boss 2 first"
    };
  }

  if (sessionId === 10 && !progress.bosses.boss3?.passed) {
    return {
      locked: true,
      reason: "Pass Boss 3 first"
    };
  }

  if (sessionId === 13 && !progress.bosses.boss4?.passed) {
    return {
      locked: true,
      reason: "Pass Boss 4 first"
    };
  }

  const previous = progress.sessions[sessionId - 1];

  if (!previous?.passed) {
    return {
      locked: true,
      reason: `Pass Session ${sessionId - 1} first`
    };
  }

  return {
    locked: false,
    reason: "Unlocked"
  };
}
