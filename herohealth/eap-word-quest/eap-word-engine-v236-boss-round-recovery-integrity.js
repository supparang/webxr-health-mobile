/* =========================================================
   EAP Word Quest • Boss Recovery Round Integrity
   File: /herohealth/eap-word-quest/eap-word-engine-v236-boss-round-recovery-integrity.js
   Version: v2.3.6-BOSS-RECOVERY-ROUND-INTEGRITY-122

   Boss Gates are fixed assessments:
   - BG1–BG4: 18 questions
   - BG5: 24 questions

   The Core controller removes recently-used item IDs before it forms a round.
   On a Boss replay that can shrink a legitimate fixed Boss round (for example
   BG5 10/14). Each new Boss launch therefore receives a fresh internal item
   token. Questions, answers, score rules, pass marks, logs and weak-word
   records are unchanged; only the history key is renewed so the full Boss
   pool remains eligible for the fixed round size.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.3.6-BOSS-RECOVERY-ROUND-INTEGRITY-122";
  const BOSS = new Set(["BG1","BG2","BG3","BG4","BG5"]);

  if (window.__EAP_WORD_V236_BOSS_ROUND_INTEGRITY__) return;
  window.__EAP_WORD_V236_BOSS_ROUND_INTEGRITY__ = true;

  if (typeof window.getEapCoreBankItems !== "function") {
    console.warn("[EAP Word Quest] v236 needs the Core question bank before it.");
    return;
  }

  const baseGetItems = window.getEapCoreBankItems;
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  const roundToken = Object.create(null);
  let serial = 0;

  function isBoss(id) {
    return BOSS.has(norm(id).toUpperCase());
  }

  function newToken(sessionId) {
    const id = norm(sessionId).toUpperCase();
    if (!isBoss(id)) return "";
    serial += 1;
    roundToken[id] = `${Date.now().toString(36)}-${serial.toString(36)}`;
    return roundToken[id];
  }

  function currentBossResult() {
    const result = window.EAP_V196_LAST_RESULT || window.EAP_V203_LAST_RESULT || window.EAP_V195_LAST_RESULT || window.EAP_V192_LAST_RESULT || {};
    return isBoss(result.sessionId) ? norm(result.sessionId).toUpperCase() : "";
  }

  function nextBossMission() {
    try {
      const progress = typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null;
      return progress && isBoss(progress.next) ? norm(progress.next).toUpperCase() : "";
    } catch (err) {
      return "";
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target && event.target.closest ? event.target.closest("button,a") : null;
    if (!target) return;

    const direct = norm(target.dataset && target.dataset.startSession).toUpperCase();
    if (isBoss(direct)) {
      newToken(direct);
      return;
    }

    const id = target.id || "";
    if (id === "nextMissionBtn" || id === "quickStartBtn") {
      const next = nextBossMission();
      if (next) newToken(next);
      return;
    }

    if (id === "replayBtn") {
      const current = currentBossResult();
      if (current) newToken(current);
    }
  }, true);

  window.getEapCoreBankItems = function bossRecoveryEligibleItems(sessionId) {
    const id = norm(sessionId).toUpperCase();
    const rows = baseGetItems(sessionId) || [];
    if (!isBoss(id)) return rows;

    const token = roundToken[id] || "initial";
    return rows.map((item, index) => Object.assign({}, item, {
      /* Keep all integrated Boss items in the internal middle band. This
         prevents an A2/A2+ recovery policy from discarding a full Boss pool. */
      level: "B1",
      /* A per-launch history key prevents prior Boss attempts from shrinking
         the next fixed round. The source item is otherwise unchanged. */
      id: `${norm(item.id)}__bossround_v236_${id}_${token}_${index}`
    }));
  };

  window.inspectEapV236 = (sessionId = "BG5") => {
    const id = norm(sessionId).toUpperCase();
    const rows = window.getEapCoreBankItems(id) || [];
    return {
      version: VERSION,
      sessionId: id,
      configuredRound: id === "BG5" ? 24 : 18,
      activeToken: roundToken[id] || "initial",
      eligibleItems: rows.length,
      uniqueIds: new Set(rows.map((row) => row.id)).size
    };
  };

  console.info("[EAP Word Quest] v236 Boss round integrity ready", { version:VERSION });
})();
