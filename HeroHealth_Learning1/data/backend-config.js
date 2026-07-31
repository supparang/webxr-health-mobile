window.HH_CONFIG = window.HH_CONFIG || {};

window.HH_CONFIG.backend = {
  enabled: true,
  webAppUrl: "https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec",
  queueOffline: true,
  duplicateGuard: true,
  syncIntervalMs: 15000,
  transportPolicy: "full-payload-single-submit",
  gameShellVersion: "20260731-GAME-SHELL-RECEIPT-GUARD-R41.1",
  receiptGuardVersion: "20260731-GAME-SHELL-AUTO-RETURN-R41.1-RECEIPT-GUARD",
  balanceAnalyticsVersion: "20260731-BALANCE-ANALYTICS-V50-1-STABILITY",
  handwashClassroomVersion: "20260731-HANDWASH-STABLE-R49-1-STUDENT-UI",
  handwashSchemaCompatibilityVersion: "20260731-GAME-SHELL-HANDWASH-SCHEMA-V2-R49",
  toothbrushScoreVersion: "20260731-TOOTHBRUSH-NORMALIZED-SKILL-SCORE-R53",
  loginRouteGuardVersion: "20260731-PROFILE-CONFIRM-ROUTE-GUARD-R42"
};

window.HH_CONFIG.teacherAccess = {
  sessionKey: "herohealth_teacher_authorized_v1",
  pin: "7319"
};

const hhRuntimePath = String(location.pathname || '');

// Keep the newly verified student identity in the URL before the authority login reload.
// This prevents a stale sid/studentId from the previous learner from resetting the new profile.
if (/\/HeroHealth_Learning1\/(?:index\.html)?$/i.test(hhRuntimePath)) {
  const loginGuard = document.createElement('script');
  loginGuard.src = './assets/profile-confirm-route-guard-r42.js?v=20260731-r42-stale-student-route';
  loginGuard.async = false;
  loginGuard.dataset.hhPatch = 'profile-confirm-route-guard-r42';
  document.head.appendChild(loginGuard);

  // Install after the Passport runtime becomes available. This overrides any cached older
  // launcher and forces Balance Hold through the V50 direct-finish analytics wrapper.
  const launcherHotfix = document.createElement('script');
  launcherHotfix.src = './assets/game-shell-launcher-v50-hotfix.js?v=20260731-v50-1-stability';
  launcherHotfix.async = false;
  launcherHotfix.dataset.hhPatch = 'game-shell-launcher-v50-hotfix';
  document.head.appendChild(launcherHotfix);
}

// Load transport compatibility before the classroom shell submits a Handwash payload.
// The current Sheet receiver validates HH-UNIFIED-GAME-ANALYTICS-V2 for Handwash.
if (/game-shell-authority-r40\.html$/i.test(hhRuntimePath)) {
  const handwashSchema = document.createElement('script');
  handwashSchema.src = './assets/game-shell-handwash-schema-v2-r49.js?v=20260731-r49-v2-contract';
  handwashSchema.async = false;
  handwashSchema.dataset.hhPatch = 'game-shell-handwash-schema-v2-r49';
  document.head.appendChild(handwashSchema);

  // Toothbrush uses a normalized 0-100 skill score instead of an unrelated arcade total.
  // Coverage, direction accuracy and precision are all authentic gameplay evidence.
  const TOOTHBRUSH_SCORE_RELEASE = '20260731-TOOTHBRUSH-NORMALIZED-SKILL-SCORE-R53';
  const clampPct = value => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
  };
  const round1 = value => Math.round(Number(value || 0) * 10) / 10;

  function normalizeToothbrushScore(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const game = payload.game && typeof payload.game === 'object' ? payload.game : payload;
    const gameId = String(game.gameId || game.game_id || game.game_key || '').trim().toLowerCase();
    if (gameId !== 'toothbrush') return payload;

    const cleared = Number(game.plaqueTargetsCleared ?? game.completedCorrectStrokes ?? game.successfulPlaqueStrokes);
    const total = Number(game.plaqueTargetsTotal ?? game.requiredStrokesTotal);
    const zones = Number(game.coverageZones ?? game.zonesCompleted);
    const totalZones = Number(game.totalZones ?? game.zonesTotal);

    const coveragePct = total > 0
      ? clampPct(cleared * 100 / total)
      : totalZones > 0
        ? clampPct(zones * 100 / totalZones)
        : 0;
    const directionPct = clampPct(game.directionAccuracy ?? game.direction_accuracy ?? game.accuracy);
    const precisionPct = clampPct(game.precisionAccuracy ?? game.precision_accuracy ?? game.successRate);
    const score = round1(
      coveragePct * 0.40 +
      directionPct * 0.35 +
      precisionPct * 0.25
    );

    game.score = score;
    game.scoreAvailable = true;
    game.scoreScale = 100;
    game.scoreType = 'normalized_skill_score';
    game.scoreFormulaVersion = 'TOOTHBRUSH-MASTERY-V1';
    game.scoreComponents = {
      plaqueCoveragePct: round1(coveragePct),
      directionAccuracyPct: round1(directionPct),
      precisionAccuracyPct: round1(precisionPct),
      weights: {
        plaqueCoveragePct: 0.40,
        directionAccuracyPct: 0.35,
        precisionAccuracyPct: 0.25
      }
    };
    game.masteryPct = score;
    game.scoreDerived = true;
    game.scoreDerivationRelease = TOOTHBRUSH_SCORE_RELEASE;
    game.skillCriteriaMet =
      score >= 70 &&
      zones >= totalZones &&
      directionPct >= 55 &&
      precisionPct >= 70;

    return payload;
  }

  window.HH_normalizeToothbrushScore = normalizeToothbrushScore;

  // Registered before the Game Shell inline listener, so the payload is normalized
  // before show() builds the Sheet submission.
  window.addEventListener('message', event => {
    if (event.origin !== location.origin) return;
    const message = event.data || {};
    if (message.type !== 'HEROHEALTH_GAME_COMPLETE' || !message.payload) return;
    normalizeToothbrushScore(message.payload);
  }, true);

  // Keep the same normalized payload in the game's same-origin recovery cache.
  // This covers the shell's localStorage fallback if a completion message is delayed.
  const patchToothbrushRecoveryCache = () => {
    const query = new URLSearchParams(location.search);
    if (String(query.get('gameId') || '').toLowerCase() !== 'toothbrush') return;
    const frame = document.getElementById('game');
    if (!frame || !frame.contentWindow) return;
    for (const key of ['HHA_TOOTHBRUSH_LAST_RESULT', 'toothbrush_pending_result']) {
      try {
        const raw = frame.contentWindow.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        normalizeToothbrushScore(parsed);
        frame.contentWindow.localStorage.setItem(key, JSON.stringify(parsed));
      } catch (_) {}
    }
  };
  window.setInterval(patchToothbrushRecoveryCache, 350);

  console.info('[Toothbrush Score R53] installed', {
    release: TOOTHBRUSH_SCORE_RELEASE,
    formula: '40% coverage + 35% direction + 25% precision',
    scale: 100
  });

  // Load the authority-confirmed auto-return repair only inside the classroom game shell.
  // The guard blocks early Passport exit after completion, verifies the current attempt,
  // and returns the learner only after the current Sheet receipt is confirmed.
  const script = document.createElement('script');
  script.src = './assets/game-shell-auto-return-r41.js?v=20260731-r41-1-receipt-guard';
  script.async = false;
  script.dataset.hhPatch = 'game-shell-auto-return-r41-1';
  document.head.appendChild(script);
}
