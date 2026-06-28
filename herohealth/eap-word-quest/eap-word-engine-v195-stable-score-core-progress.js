/* =========================================================
   EAP Word Quest • Stable Summary Reward + Logger Guard
   File: /herohealth/eap-word-quest/eap-word-engine-v195-stable-score-core-progress.js
   Runtime Version: v1.9.9-SUMMARY-REWARD-LOGGER-STABILITY-122

   Purpose:
   - Stop recurring logger bridge rebuilds without wrapping the logger again.
   - Render XP / combo from the real Core run result in the v172 summary overlay.
   - Keep rewards visible even when the legacy summary UI redraws itself.
   - Hide the internal Target tag so the game never reveals the answer.
   - Add a concise Thai explanation of score and pass threshold.
========================================================= */

(() => {
  "use strict";

  const VERSION = "v1.9.9-SUMMARY-REWARD-LOGGER-STABILITY-122";
  const GROUP = "122";
  const BOSS_IDS = new Set(["BG1","BG2","BG3","BG4","BG5"]);

  if (window.__EAP_WORD_V199_SUMMARY_STABILITY__) {
    console.info("[EAP Word Quest] v199 summary stability already loaded");
    return;
  }
  window.__EAP_WORD_V199_SUMMARY_STABILITY__ = true;

  const $ = id => document.getElementById(id);

  function norm(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function threshold(sessionId) {
    if (sessionId === "BG5") return 75;
    if (BOSS_IDS.has(norm(sessionId))) return 70;
    return 60;
  }

  function setLoggerMarkers() {
    const logger = window.logEapWordQuestResult;
    if (typeof logger !== "function") return false;

    /*
      v195 Core AI checks this marker every 650 ms. Marking the final current
      logger prevents it from repeatedly wrapping the storage/logging chain.
    */
    logger.__eapV190Wrapped = true;
    logger.__eapV195Wrapped = true;
    logger.__eapV193Wrapped = true;
    logger.__eapV194Wrapped = true;
    logger.__eapV199Marked = true;
    return true;
  }

  function sourceResult() {
    return window.EAP_V196_LAST_RESULT ||
      window.EAP_V195_LAST_RESULT ||
      window.EAP_V192_LAST_RESULT ||
      (window.EAP_V172_SUMMARY_STATE && window.EAP_V172_SUMMARY_STATE.result) ||
      window.EAP_V199_LAST_RESULT ||
      null;
  }

  function normalizeReward(input) {
    const source = input && typeof input === "object" ? input : {};
    const correct = Math.max(0, num(source.correct));
    const total = Math.max(1, num(source.total, 1));
    const accuracy = clamp(Math.round(num(source.accuracy, (correct / total) * 100)), 0, 100);
    const sessionId = norm(source.sessionId) || "S1";
    const passed = Boolean(source.passed || accuracy >= threshold(sessionId));
    const maxCombo = correct > 0 ? Math.max(1, num(source.maxCombo)) : 0;

    /* Controller score is preferred. The floor protects results from old UI values. */
    const controllerScore = Math.max(0, num(source.score), num(source.xp));
    const base = Math.max(controllerScore, correct * 60);
    const comboBonus = maxCombo >= 2 ? Math.min(90, (maxCombo - 1) * 15 + (maxCombo >= 4 ? 20 : 0)) : 0;
    const passBonus = passed ? (BOSS_IDS.has(sessionId) ? 220 : 140) : 0;
    const noHintBonus = passed && Math.max(num(source.hintUsed), num(source.hintsUsed)) === 0 ? 30 : 0;
    const perfectBonus = accuracy === 100 ? (BOSS_IDS.has(sessionId) ? 160 : 100) : 0;

    /* Do not double-count controller bonus; only use calculated bonus when controller had no score. */
    const xp = controllerScore > 0 ? controllerScore : base + comboBonus + passBonus + noHintBonus + perfectBonus;

    return Object.assign({}, source, {
      correct,
      total,
      accuracy,
      sessionId,
      passed,
      maxCombo,
      score: xp,
      xp,
      rewardVersion: VERSION,
      rewardBreakdown: {
        base,
        comboBonus: controllerScore > 0 ? 0 : comboBonus,
        passBonus: controllerScore > 0 ? 0 : passBonus,
        noHintBonus: controllerScore > 0 ? 0 : noHintBonus,
        perfectBonus: controllerScore > 0 ? 0 : perfectBonus,
        xp
      }
    });
  }

  function visibleSummaryRoot() {
    const overlay = $("eapV172SummaryOverlay");
    if (overlay && !overlay.hidden && overlay.offsetParent !== null) {
      return overlay.querySelector(".eap172-card") || overlay;
    }
    const screen = $("summaryScreen");
    if (screen && screen.classList.contains("active")) {
      return screen.querySelector(".summary-card") || screen;
    }
    return null;
  }

  function setSummaryStat(root, label, value) {
    if (!root) return;
    const wanted = norm(label).toLowerCase();
    const cards = Array.from(root.querySelectorAll(".eap172-stat,.summary-stat,.stat,.mini"));

    for (const card of cards) {
      const text = norm(card.textContent).toLowerCase();
      if (!text.includes(wanted)) continue;
      const valueNode = card.querySelector("b,strong,.value");
      if (valueNode) valueNode.textContent = String(value);
    }
  }

  function injectStyle() {
    if ($("eapV199Style")) return;
    const style = document.createElement("style");
    style.id = "eapV199Style";
    style.textContent = `
      #eapV199RewardBox{
        margin:12px 0;
        border:1px solid #bbf7d0;
        border-radius:16px;
        padding:12px 14px;
        background:linear-gradient(135deg,#ecfdf5,#eff6ff);
        color:#14532d;
        line-height:1.5;
        font-weight:850;
      }
      #eapV199RewardBox b{color:#166534}
      #eapV199RewardBox .eap199-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      #eapV199RewardBox .eap199-chip{display:inline-flex;align-items:center;border:1px solid #bbf7d0;background:#fff;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:950;color:#166534}
    `;
    document.head.appendChild(style);
  }

  function renderRewardSummary() {
    const root = visibleSummaryRoot();
    const raw = sourceResult();
    if (!root || !raw) return;

    const result = normalizeReward(raw);
    window.EAP_V199_LAST_RESULT = result;

    /* Keep shared result objects truthful for all later UI/report reads. */
    if (window.EAP_V196_LAST_RESULT) Object.assign(window.EAP_V196_LAST_RESULT, result);
    if (window.EAP_V195_LAST_RESULT) Object.assign(window.EAP_V195_LAST_RESULT, result);
    if (window.EAP_V172_SUMMARY_STATE && window.EAP_V172_SUMMARY_STATE.result) {
      Object.assign(window.EAP_V172_SUMMARY_STATE.result, result);
    }

    setSummaryStat(root, "XP", result.xp);
    setSummaryStat(root, "Score", result.xp);
    setSummaryStat(root, "Max Combo", result.maxCombo);
    setSummaryStat(root, "Combo", result.maxCombo);

    let box = $("eapV199RewardBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "eapV199RewardBox";
      const actions = root.querySelector(".summary-actions,.eap172-actions");
      if (actions) actions.insertAdjacentElement("beforebegin", box);
      else root.appendChild(box);
    }

    const needed = Math.ceil(result.total * threshold(result.sessionId) / 100);
    const outcome = result.passed
      ? `ผ่านเกณฑ์ ${threshold(result.sessionId)}% แล้ว พร้อมไปต่อ ${result.sessionId === "BG5" ? "สรุปรายวิชา" : "Session ถัดไป"}`
      : `ยังต้องตอบถูกอย่างน้อย ${needed}/${result.total} ข้อเพื่อผ่าน ลองใช้ AI Help และทบทวน Weak Words ก่อนเล่นซ้ำ`;

    box.innerHTML = `
      <b>🎯 XP รอบนี้: ${result.xp}</b><br>
      ได้ ${result.correct}/${result.total} ข้อ • Accuracy ${result.accuracy}% • ${outcome}
      <div class="eap199-row">
        <span class="eap199-chip">Base ${Math.max(result.correct * 60, result.rewardBreakdown.base || 0)}</span>
        <span class="eap199-chip">Max Combo ${result.maxCombo}</span>
        <span class="eap199-chip">Pass ${result.passed ? "✓" : "–"}</span>
      </div>`;
  }

  function hideAnswerLeak() {
    const tagBox = $("questionTags");
    if (!tagBox) return;
    Array.from(tagBox.querySelectorAll("span")).forEach(tag => {
      const text = norm(tag.textContent);
      if (/^Target\s*:/i.test(text)) {
        tag.textContent = "Mission target";
        tag.title = "คำศัพท์เป้าหมายจะเฉลยผ่าน feedback หลังตอบ";
      }
    });
  }

  function tick() {
    setLoggerMarkers();
    hideAnswerLeak();
    renderRewardSummary();
  }

  window.addEventListener("eap-core-run-finished", event => {
    if (event && event.detail) {
      window.EAP_V199_LAST_RESULT = normalizeReward(event.detail);
      Object.assign(event.detail, window.EAP_V199_LAST_RESULT);
    }
    [0,80,250,600,1100].forEach(delay => setTimeout(tick, delay));
  });

  document.addEventListener("click", event => {
    const watched = event.target && event.target.closest
      ? event.target.closest("#choicesEl .eap192-choice,#nextBtn,#replayBtn,#nextMissionBtn")
      : null;
    if (watched) [40,180,500].forEach(delay => setTimeout(tick, delay));
  }, true);

  injectStyle();
  [0,100,350,800,1500].forEach(delay => setTimeout(tick, delay));
  setInterval(tick, 1000);

  window.inspectEapV199 = () => {
    const result = sourceResult();
    const logger = window.logEapWordQuestResult;
    return {
      version: VERSION,
      result: result ? normalizeReward(result) : null,
      loggerMarked: Boolean(logger && logger.__eapV190Wrapped && logger.__eapV195Wrapped),
      summaryVisible: Boolean(visibleSummaryRoot()),
      targetHidden: !Array.from(document.querySelectorAll("#questionTags span")).some(tag => /^Target\s*:/i.test(norm(tag.textContent)))
    };
  };

  console.info("[EAP Word Quest] v199 stable reward + summary truth ready", {
    version: VERSION,
    loggerMarked: setLoggerMarkers()
  });
})();
