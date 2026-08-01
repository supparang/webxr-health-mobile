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
  reflectionRecoveryVersion: "20260801-REFLECTION-RECOVERY-MANAGER-R55",
  reflectionPendingQueueVersion: "20260801-REFLECTION-PENDING-QUEUE-R56",
  loginRouteGuardVersion: "20260731-PROFILE-CONFIRM-ROUTE-GUARD-R42"
};

window.HH_CONFIG.teacherAccess = {
  sessionKey: "herohealth_teacher_authorized_v1",
  pin: "7319"
};

const hhRuntimePath = String(location.pathname || '');

// Reflection Pending Queue R56 runs on Passport and Reflection pages.
// It stores a server-side Pending copy before committing the final Reflection,
// and can recover the same answers after the learner changes device.
if (/\/HeroHealth_Learning1\/(?:index\.html)?$/i.test(hhRuntimePath) || /\/HeroHealth_Learning1\/assessment\/reflection\.html$/i.test(hhRuntimePath)) {
  const reflectionQueue = document.createElement('script');
  reflectionQueue.src = /\/assessment\/reflection\.html$/i.test(hhRuntimePath)
    ? '../assets/reflection-pending-queue-client-r56.js?v=20260801-r56-server-pending'
    : './assets/reflection-pending-queue-client-r56.js?v=20260801-r56-server-pending';
  reflectionQueue.async = false;
  reflectionQueue.dataset.hhPatch = 'reflection-pending-queue-client-r56';
  document.head.appendChild(reflectionQueue);
}

// Keep the newly verified student identity in the URL before the authority login reload.
if (/\/HeroHealth_Learning1\/(?:index\.html)?$/i.test(hhRuntimePath)) {
  const loginGuard = document.createElement('script');
  loginGuard.src = './assets/profile-confirm-route-guard-r42.js?v=20260731-r42-stale-student-route';
  loginGuard.async = false;
  loginGuard.dataset.hhPatch = 'profile-confirm-route-guard-r42';
  document.head.appendChild(loginGuard);

  const launcherHotfix = document.createElement('script');
  launcherHotfix.src = './assets/game-shell-launcher-v50-hotfix.js?v=20260731-v50-1-stability';
  launcherHotfix.async = false;
  launcherHotfix.dataset.hhPatch = 'game-shell-launcher-v50-hotfix';
  document.head.appendChild(launcherHotfix);

  const reflectionRecovery = document.createElement('script');
  reflectionRecovery.src = './assets/reflection-recovery-manager-r55.js?v=20260801-r55-sheet-authority';
  reflectionRecovery.async = false;
  reflectionRecovery.dataset.hhPatch = 'reflection-recovery-manager-r55';
  document.head.appendChild(reflectionRecovery);
}

if (/game-shell-authority-r40\.html$/i.test(hhRuntimePath)) {
  const handwashSchema = document.createElement('script');
  handwashSchema.src = './assets/game-shell-handwash-schema-v2-r49.js?v=20260731-r49-v2-contract';
  handwashSchema.async = false;
  handwashSchema.dataset.hhPatch = 'game-shell-handwash-schema-v2-r49';
  document.head.appendChild(handwashSchema);

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
    const score = round1(coveragePct * 0.40 + directionPct * 0.35 + precisionPct * 0.25);

    game.score = score;
    game.scoreAvailable = true;
    game.scoreScale = 100;
    game.scoreType = 'normalized_skill_score';
    game.scoreFormulaVersion = 'TOOTHBRUSH-MASTERY-V1';
    game.scoreComponents = {
      plaqueCoveragePct: round1(coveragePct),
      directionAccuracyPct: round1(directionPct),
      precisionAccuracyPct: round1(precisionPct),
      weights: { plaqueCoveragePct: 0.40, directionAccuracyPct: 0.35, precisionAccuracyPct: 0.25 }
    };
    game.masteryPct = score;
    game.scoreDerived = true;
    game.scoreDerivationRelease = TOOTHBRUSH_SCORE_RELEASE;
    game.skillCriteriaMet = score >= 70 && zones >= totalZones && directionPct >= 55 && precisionPct >= 70;
    return payload;
  }

  window.HH_normalizeToothbrushScore = normalizeToothbrushScore;

  window.addEventListener('message', event => {
    if (event.origin !== location.origin) return;
    const message = event.data || {};
    if (message.type !== 'HEROHEALTH_GAME_COMPLETE' || !message.payload) return;
    normalizeToothbrushScore(message.payload);
  }, true);

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

  const script = document.createElement('script');
  script.src = './assets/game-shell-auto-return-r41.js?v=20260731-r41-1-receipt-guard';
  script.async = false;
  script.dataset.hhPatch = 'game-shell-auto-return-r41-1';
  document.head.appendChild(script);
}
