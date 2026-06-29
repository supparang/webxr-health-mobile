/* =========================================================
   EAP Word Quest • Recovery Round Integrity
   File: /herohealth/eap-word-quest/eap-word-engine-v229-recovery-round-integrity.js
   Version: v2.2.9-RECOVERY-ROUND-INTEGRITY-122

   A supportive recovery mix must still be a full learning round. The Core
   selector can find fewer than 12 eligible items after a narrow AI-level
   filter, producing 5/9 or 6/8 rounds. During recovery only, this guard lets
   every same-Session item remain eligible for selection; it does not change
   item text, answers, scoring, thresholds, gates, logs, or Boss Gate length.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.9-RECOVERY-ROUND-INTEGRITY-122";
  const BOSS = new Set(["BG1","BG2","BG3","BG4","BG5"]);

  if (window.__EAP_WORD_V229_RECOVERY_ROUND_INTEGRITY__) return;
  window.__EAP_WORD_V229_RECOVERY_ROUND_INTEGRITY__ = true;

  if (typeof window.getEapCoreBankItems !== "function") {
    console.warn("[EAP Word Quest] v229 needs the Core bank before it.");
    return;
  }

  const baseGetItems = window.getEapCoreBankItems;
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g," ").trim();

  function recoveryPolicy() {
    try {
      const policy = typeof window.getEapCoreAiPolicy === "function" ? window.getEapCoreAiPolicy() : null;
      const mix = policy && policy.roundMix || {};
      return Boolean(
        policy && policy.sessionCalibrated &&
        Number(mix.warm) >= 6 &&
        Number(mix.core) >= 4 &&
        Number(mix.challenge) <= 1
      );
    } catch (err) {
      return false;
    }
  }

  window.getEapCoreBankItems = function recoveryRoundEligibleItems(sessionId) {
    const id = norm(sessionId).toUpperCase();
    const rows = baseGetItems(sessionId) || [];
    if (BOSS.has(id) || !recoveryPolicy()) return rows;

    /* The level is an internal selection tag. Keeping it at A2+ only while
       recovery is active prevents the filter from throwing away otherwise
       valid same-Session core/context items before the 12-item round forms. */
    return rows.map((item) => Object.assign({}, item, { level:"A2+" }));
  };

  window.inspectEapV229 = (sessionId = "S12") => {
    const id = norm(sessionId).toUpperCase();
    const rows = window.getEapCoreBankItems(id) || [];
    return {
      version:VERSION,
      recoveryActive:recoveryPolicy(),
      sessionId:id,
      eligibleItems:rows.length,
      itemLevels:[...new Set(rows.map((row)=>row.level).filter(Boolean))]
    };
  };

  console.info("[EAP Word Quest] v229 recovery round integrity ready",{version:VERSION});
})();
