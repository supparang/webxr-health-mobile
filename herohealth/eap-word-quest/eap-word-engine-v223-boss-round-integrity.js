/* =========================================================
   EAP Word Quest • Boss Round Integrity
   File: /herohealth/eap-word-quest/eap-word-engine-v223-boss-round-integrity.js
   Version: v2.2.3-BOSS-ROUND-INTEGRITY-122

   Boss Gates are fixed assessments:
   - BG1–BG4: up to 18 items
   - BG5: up to 24 items

   The Core controller deliberately filters normal Session items by recent
   history and AI level. Those filters can accidentally shrink a Boss replay
   after a recovery attempt (for example 10/10 instead of 18 questions).
   This bridge keeps every Boss item eligible for the controller's fixed-size
   round, without changing the source pool, scoring, pass mark, choice order,
   weak words, teacher logs, or Arc gates.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.3-BOSS-ROUND-INTEGRITY-122";
  const BOSS = new Set(["BG1","BG2","BG3","BG4","BG5"]);

  if (window.__EAP_WORD_V223_BOSS_ROUND_INTEGRITY__) return;
  window.__EAP_WORD_V223_BOSS_ROUND_INTEGRITY__ = true;

  if (typeof window.getEapCoreBankItems !== "function") {
    console.warn("[EAP Word Quest] v223 needs the Core question bank before it.");
    return;
  }

  const baseGetItems = window.getEapCoreBankItems;
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  window.getEapCoreBankItems = function getBossIntegrityItems(sessionId) {
    const id = norm(sessionId).toUpperCase();
    const rows = baseGetItems(sessionId) || [];
    if (!BOSS.has(id)) return rows;

    return rows.map((item) => Object.assign({}, item, {
      /* All integrated Boss items must survive the normal-session level
         filter. B1 is the middle selection band used only internally. */
      level: "B1",
      /* Separate IDs from pre-v223 attempt history so a replay starts with
         the complete Boss pool; later full rounds naturally fall back to
         the pool when all IDs are recent. */
      id: `${norm(item.id)}__bossfull_v223`
    }));
  };

  window.inspectEapBossRoundIntegrity = (sessionId = "BG3") => {
    const id = norm(sessionId).toUpperCase();
    const rows = window.getEapCoreBankItems(id) || [];
    return {
      version: VERSION,
      sessionId: id,
      configuredRound: id === "BG5" ? 24 : 18,
      eligibleItems: rows.length,
      uniqueIds: new Set(rows.map((row) => row.id)).size,
      sourceSessions: [...new Set(rows.map((row) => row.sourceSessionId).filter(Boolean))]
    };
  };

  console.info("[EAP Word Quest] v223 boss round integrity ready", {
    BG1: window.getEapCoreBankItems("BG1").length,
    BG2: window.getEapCoreBankItems("BG2").length,
    BG3: window.getEapCoreBankItems("BG3").length,
    BG4: window.getEapCoreBankItems("BG4").length,
    BG5: window.getEapCoreBankItems("BG5").length
  });
})();
