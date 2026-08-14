window.HH_CONFIG = window.HH_CONFIG || {};

window.HH_CONFIG.backend = {
  enabled: true,
  webAppUrl: "https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec",
  queueOffline: true,
  duplicateGuard: true,
  syncIntervalMs: 15000,
  transportPolicy: "full-payload-single-submit",
  gameShellVersion: "20260809-GAME-SHELL-R50-ANALYTICS-R5-E2E29",
  launcherVersion: "20260801-GAME-SHELL-LAUNCHER-R52-STRICT-AUTHORITY",
  receiptGuardVersion: "20260801-GAME-SHELL-AUTO-RETURN-R41.2-STRICT-AUTHORITY",
  balanceAnalyticsVersion: "20260731-BALANCE-ANALYTICS-V50-1-STABILITY",
  handwashClassroomVersion: "20260804-HANDWASH-R52-FIREBASE-EXCLUSIVE",
  handwashSchemaCompatibilityVersion: "20260731-GAME-SHELL-HANDWASH-SCHEMA-V2-R49",
  toothbrushScoreVersion: "20260731-TOOTHBRUSH-NORMALIZED-SKILL-SCORE-R53",
  toothbrushFirebaseReceiptVersion: "20260814-TOOTHBRUSH-FIREBASE-RECEIPT-R4-COMPLETION-VS-MASTERY",
  reflectionRecoveryVersion: "20260809-REFLECTION-RECEIPT-RECOVERY-R13-E2E29",
  reflectionPendingQueueVersion: "20260801-REFLECTION-PENDING-QUEUE-R56",
  loginRouteGuardVersion: "20260809-PROFILE-CONFIRM-ROUTE-GUARD-R54-E2E29"
};

window.HH_CONFIG.teacherAccess = { sessionKey: "herohealth_teacher_authorized_v1", pin: "7319" };

const hhRuntimePath = String(location.pathname || '');
const hhRuntimeAuthority = String(new URLSearchParams(location.search).get('authority') || window.HH_AUTHORITY_MODE || 'sheet').toLowerCase();
const hhFirebaseRuntime = hhRuntimeAuthority === 'firebase';

if (/\/HeroHealth_Learning1\/(?:index\.html)?$/i.test(hhRuntimePath) || /\/HeroHealth_Learning1\/assessment\/reflection\.html$/i.test(hhRuntimePath)) {
  if (!hhFirebaseRuntime) {
    const reflectionQueue = document.createElement('script');
    reflectionQueue.src = /\/assessment\/reflection\.html$/i.test(hhRuntimePath)
      ? '../assets/reflection-pending-queue-client-r56.js?v=20260801-r56-server-pending'
      : './assets/reflection-pending-queue-client-r56.js?v=20260801-r56-server-pending';
    reflectionQueue.async = false;
    reflectionQueue.dataset.hhPatch = 'reflection-pending-queue-client-r56';
    document.head.appendChild(reflectionQueue);
  }
}

if (/\/HeroHealth_Learning1\/(?:index\.html)?$/i.test(hhRuntimePath)) {
  const loginGuard = document.createElement('script');
  loginGuard.src = './assets/profile-confirm-route-guard-r42.js?v=20260809-r54-e2e29';
  loginGuard.async = false;
  loginGuard.dataset.hhPatch = 'profile-confirm-route-guard-r54-e2e29';
  document.head.appendChild(loginGuard);
  if (!hhFirebaseRuntime) {
    const launcherHotfix = document.createElement('script');
    launcherHotfix.src = './assets/game-shell-launcher-v50-hotfix.js?v=20260801-r52-strict-authority';
    launcherHotfix.async = false;
    launcherHotfix.dataset.hhPatch = 'game-shell-launcher-r52-strict-authority';
    document.head.appendChild(launcherHotfix);
    const reflectionRecovery = document.createElement('script');
    reflectionRecovery.src = './assets/reflection-recovery-manager-r55.js?v=20260801-r55-sheet-authority';
    reflectionRecovery.async = false;
    reflectionRecovery.dataset.hhPatch = 'reflection-recovery-manager-r55';
    document.head.appendChild(reflectionRecovery);
  }
}

if (/toothbrush-classroom-challenge-v27\.html$/i.test(hhRuntimePath) && hhFirebaseRuntime) {
  const toothbrushFirebaseReceipt = document.createElement('script');
  toothbrushFirebaseReceipt.src = './assets/toothbrush-firebase-receipt-bridge-r1.js?v=20260814-r4-completion-vs-mastery';
  toothbrushFirebaseReceipt.async = false;
  toothbrushFirebaseReceipt.dataset.hhPatch = 'toothbrush-firebase-receipt-r4-completion-vs-mastery';
  document.head.appendChild(toothbrushFirebaseReceipt);
}

if (/game-shell-authority-r4(?:0|2)\.html$/i.test(hhRuntimePath)) {
  const handwashSchema = document.createElement('script');
  handwashSchema.src = './assets/game-shell-handwash-schema-v2-r49.js?v=20260731-r49-v2-contract';
  handwashSchema.async = false;
  handwashSchema.dataset.hhPatch = 'game-shell-handwash-schema-v2-r49';
  document.head.appendChild(handwashSchema);
  const TOOTHBRUSH_SCORE_RELEASE = '20260731-TOOTHBRUSH-NORMALIZED-SKILL-SCORE-R53';
  const clampPct = value => { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0; };
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
    const coveragePct = total > 0 ? clampPct(cleared * 100 / total) : totalZones > 0 ? clampPct(zones * 100 / totalZones) : 0;
    const directionPct = clampPct(game.directionAccuracy ?? game.direction_accuracy ?? game.accuracy);
    const precisionPct = clampPct(game.precisionAccuracy ?? game.precision_accuracy ?? game.successRate);
    const score = round1(coveragePct * 0.40 + directionPct * 0.35 + precisionPct * 0.25);
    game.score = score; game.scoreAvailable = true; game.scoreScale = 100; game.scoreType = 'normalized_skill_score'; game.scoreFormulaVersion = 'TOOTHBRUSH-MASTERY-V1';
    game.scoreComponents = { plaqueCoveragePct: round1(coveragePct), directionAccuracyPct: round1(directionPct), precisionAccuracyPct: round1(precisionPct), weights: { plaqueCoveragePct: 0.40, directionAccuracyPct: 0.35, precisionAccuracyPct: 0.25 } };
    game.masteryPct = score; game.scoreDerived = true; game.scoreDerivationRelease = TOOTHBRUSH_SCORE_RELEASE;
    game.skillCriteriaMet = score >= 70 && totalZones > 0 && zones >= totalZones && directionPct >= 55 && precisionPct >= 70;
    return payload;
  }
  window.HH_normalizeToothbrushScore = normalizeToothbrushScore;
  window.addEventListener('message', event => { if (event.origin !== location.origin) return; const message = event.data || {}; if (message.type !== 'HEROHEALTH_GAME_COMPLETE' || !message.payload) return; normalizeToothbrushScore(message.payload); }, true);
  const patchToothbrushRecoveryCache = () => {
    const query = new URLSearchParams(location.search); if (String(query.get('gameId') || '').toLowerCase() !== 'toothbrush') return;
    const frame = document.getElementById('game'); if (!frame || !frame.contentWindow) return;
    for (const key of ['HHA_TOOTHBRUSH_LAST_RESULT', 'toothbrush_pending_result']) {
      try { const raw = frame.contentWindow.localStorage.getItem(key); if (!raw) continue; const parsed = JSON.parse(raw); normalizeToothbrushScore(parsed); frame.contentWindow.localStorage.setItem(key, JSON.stringify(parsed)); } catch (_) {}
    }
  };
  window.setInterval(patchToothbrushRecoveryCache, 350);
  console.info('[Toothbrush Score R53] installed', { release: TOOTHBRUSH_SCORE_RELEASE, formula: '40% coverage + 35% direction + 25% precision', scale: 100 });
  if (!hhFirebaseRuntime) {
    const script = document.createElement('script');
    script.src = './assets/game-shell-auto-return-r41.js?v=20260801-r41-2-strict-authority';
    script.async = false;
    script.dataset.hhPatch = 'game-shell-auto-return-r41-2';
    document.head.appendChild(script);
  }
}

console.info('[HeroHealth Backend Config]', { authority: hhRuntimeAuthority, firebaseRuntime: hhFirebaseRuntime, loginRouteGuardVersion: window.HH_CONFIG.backend.loginRouteGuardVersion, toothbrushFirebaseReceiptVersion: window.HH_CONFIG.backend.toothbrushFirebaseReceiptVersion });