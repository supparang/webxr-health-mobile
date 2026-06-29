/* =========================================================
   EAP Word Quest • Recovery Round Size Lock
   File: /herohealth/eap-word-quest/eap-word-engine-v219-recovery-round-lock.js
   Version: v2.1.9-RECOVERY-ROUND-LOCK-122

   A low-score recovery plan is supportive, not shorter assessment.
   v209 uses 8 Warm-up + 4 Core. Its A2 selector could filter a Session
   down to only 8 visible rows before the Core controller takes its round.

   This guard keeps that same supportive 8+4 mix, but asks the controller
   for the A2+ selection window (A2/A2+/B1) so all 12 planned items remain
   available. It never changes the pass threshold, score, stored results,
   gates, logging, answer order, or a completed result.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.1.9-RECOVERY-ROUND-LOCK-122";
  if (window.__EAP_WORD_V219_RECOVERY_ROUND_LOCK__) return;
  window.__EAP_WORD_V219_RECOVERY_ROUND_LOCK__ = true;

  const originalPolicy = typeof window.getEapCoreAiPolicy === "function"
    ? window.getEapCoreAiPolicy
    : null;

  if (!originalPolicy) {
    console.warn("[EAP Word Quest] v219 needs v209 policy before it.");
    return;
  }

  function isLowRecovery(policy) {
    const mix = policy && policy.roundMix || {};
    return Boolean(
      policy &&
      policy.sessionCalibrated &&
      policy.difficulty === "A2" &&
      Number(mix.warm) === 8 &&
      Number(mix.core) === 4 &&
      Number(mix.challenge) === 0
    );
  }

  window.getEapCoreAiPolicy = function recoveryRoundLockedPolicy() {
    const policy = originalPolicy() || {};
    if (!isLowRecovery(policy)) return policy;

    return Object.assign({}, policy, {
      /* Selection floor only: learner-facing plan stays Recovery Foundation. */
      difficulty: "A2+",
      recoverySelectionFloor: "A2+",
      plannedRoundSize: 12,
      recoveryRoundLocked: true,
      prediction: "Recovery round: rebuild key evidence vocabulary before challenge items"
    });
  };

  function liveStatus() {
    try {
      const policy = window.getEapCoreAiPolicy() || {};
      return {
        version: VERSION,
        recoveryRoundLocked: Boolean(policy.recoveryRoundLocked),
        selectionDifficulty: policy.difficulty || "",
        plannedRoundSize: policy.plannedRoundSize || 12,
        mix: policy.roundMix || null
      };
    } catch (err) {
      return { version: VERSION, error: String(err && err.message || err) };
    }
  }

  window.inspectEapV219RecoveryRound = liveStatus;
  console.info("[EAP Word Quest] v219 recovery 12-question lock ready", liveStatus());
})();
