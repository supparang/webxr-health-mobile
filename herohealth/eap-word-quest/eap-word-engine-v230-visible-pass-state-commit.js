/* =========================================================
   EAP Word Quest • Visible Pass State Commit
   File: /herohealth/eap-word-quest/eap-word-engine-v230-visible-pass-state-commit.js
   Version: v2.3.0-VISIBLE-PASS-STATE-COMMIT-122

   Summary UI and Core state must never disagree. When the visible Summary
   confirms a passed Session/Boss (for example “BG4 ผ่านแล้ว!”), this guard
   validates the displayed score against the official threshold and commits
   that exact result to the Core controller's active state key. It then asks
   existing UI renderers to recompute their Arc Path one time.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.3.0-VISIBLE-PASS-STATE-COMMIT-122";
  const GROUP = "122";
  const VALID = new Set([
    "S1","S2","S3","BG1","S4","S5","S6","BG2",
    "S7","S8","S9","BG3","S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ]);

  if (window.__EAP_WORD_V230_VISIBLE_PASS__) return;
  window.__EAP_WORD_V230_VISIBLE_PASS__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const threshold = (id) => id === "BG5" ? 75 : /^BG/i.test(id) ? 70 : 60;
  let lastCommit = "";
  let queued = false;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn("[EAP Word Quest] v230 state write skipped", err);
      return false;
    }
  }

  function coreProgress() {
    try {
      return typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null;
    } catch (err) {
      return null;
    }
  }

  function activeSummary() {
    const screen = $("summaryScreen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function visiblePass() {
    if (!activeSummary()) return null;
    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    const match = title.match(/^(S(?:1[0-5]|[1-9])|BG[1-5])\s+(?:ผ่านแล้ว!|Complete)$/i);
    if (!match) return null;

    const sessionId = match[1].toUpperCase();
    if (!VALID.has(sessionId)) return null;

    const live = window.EAP_V196_LAST_RESULT || window.EAP_V203_LAST_RESULT || window.EAP_V195_LAST_RESULT || {};
    const text = norm($("summaryStats") && $("summaryStats").textContent);
    const pair = text.match(/(\d+)\s*\/\s*(\d+)/);
    const percent = text.match(/(\d+)\s*%/);
    const correct = Math.max(0, Math.round(num(
      norm(live.sessionId).toUpperCase() === sessionId ? live.correct : pair && pair[1], 0
    )));
    const total = Math.max(1, Math.round(num(
      norm(live.sessionId).toUpperCase() === sessionId ? live.total : pair && pair[2], 1
    )));
    const accuracy = Math.max(0, Math.min(100, Math.round(num(
      norm(live.sessionId).toUpperCase() === sessionId ? live.accuracy : percent && percent[1],
      (correct / total) * 100
    ))));
    const required = threshold(sessionId);
    if (accuracy < required || correct < Math.ceil((total * required) / 100)) return null;

    return {
      sessionId,
      correct,
      total,
      accuracy,
      score: Math.max(0, Math.round(num(live.score, live.xp))),
      xp: Math.max(0, Math.round(num(live.xp, live.score))),
      maxCombo: Math.max(0, Math.round(num(live.maxCombo))),
      passed: true,
      passThreshold: required,
      playedAt: norm(live.playedAt || live.endedAt || new Date().toISOString()),
      raw: live
    };
  }

  function commitVisiblePass() {
    const result = visiblePass();
    const progress = coreProgress();
    const key = norm(progress && progress.stateKey);
    if (!result || !key) return { committed:false, reason:result ? "missing_state_key" : "no_visible_pass" };

    const state = readJson(key, {}) || {};
    state.version = state.version || "v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";
    state.group = GROUP;
    state.coreOnly = true;
    state.sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
    state.recentItemIds = Array.isArray(state.recentItemIds) ? state.recentItemIds.slice(0, 36) : [];
    state.weakTargets = state.weakTargets && typeof state.weakTargets === "object" ? state.weakTargets : {};
    state.createdAt = state.createdAt || new Date().toISOString();

    const old = state.sessions[result.sessionId] || {};
    const alreadyGood = Boolean(old.passed) && Number(old.bestAccuracy || old.accuracy || 0) >= result.accuracy;
    state.sessions[result.sessionId] = Object.assign({}, old, {
      played: true,
      passed: true,
      accuracy: Math.max(result.accuracy, Math.round(num(old.accuracy))),
      bestAccuracy: Math.max(result.accuracy, Math.round(num(old.bestAccuracy, old.accuracy))),
      bestScore: Math.max(result.score, Math.round(num(old.bestScore, old.lastScore))),
      lastAccuracy: result.accuracy,
      lastScore: result.score,
      totalAttempts: Math.max(1, Math.round(num(old.totalAttempts, 0))),
      lastPlayed: result.playedAt
    });
    state.updatedAt = new Date().toISOString();

    const stamp = `${key}|${result.sessionId}|${result.correct}/${result.total}|${result.accuracy}`;
    const committed = alreadyGood || writeJson(key, state);
    const report = { committed, alreadyGood, sessionId:result.sessionId, accuracy:result.accuracy, stateKey:key };
    window.EAP_WORD_V230_VISIBLE_PASS_REPORT = report;

    if (committed && lastCommit !== stamp) {
      lastCommit = stamp;
      const dispatchResult = Object.assign({}, result.raw || {}, result, { raw: undefined });
      window.EAP_V196_LAST_RESULT = dispatchResult;
      window.EAP_V195_LAST_RESULT = dispatchResult;
      window.EAP_V203_LAST_RESULT = dispatchResult;
      setTimeout(() => window.dispatchEvent(new CustomEvent("eap-core-run-finished", { detail:dispatchResult })), 0);
    }
    return report;
  }

  function updateVisibleNext() {
    const report = commitVisiblePass();
    if (!report.committed) return report;
    const progress = coreProgress();
    const nextButton = $("nextMissionBtn");
    const next = norm(progress && progress.next);
    if (nextButton && next && next !== "DONE") {
      const label = `ไปทำ ${next} ต่อ`;
      nextButton.dataset.eapV230Label = label;
      nextButton.setAttribute("aria-label", label);
      nextButton.title = `ไปยังภารกิจถัดไป ${next}`;
    }
    return report;
  }

  function addStyle() {
    if ($("eapV230VisiblePassStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV230VisiblePassStyle";
    style.textContent = `
      #nextMissionBtn[data-eap-v230-label]{position:relative!important;color:transparent!important;font-size:0!important;line-height:0!important;text-shadow:none!important;min-width:205px!important}
      #nextMissionBtn[data-eap-v230-label]::after{content:attr(data-eap-v230-label)!important;position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:18px!important;font-weight:950!important;line-height:1.15!important;white-space:nowrap!important;pointer-events:none!important}
      @media(max-width:680px){#nextMissionBtn[data-eap-v230-label]{width:100%!important;min-width:0!important}#nextMissionBtn[data-eap-v230-label]::after{font-size:17px!important}}
    `;
    document.head.appendChild(style);
  }

  function run() {
    queued = false;
    addStyle();
    updateVisibleNext();
  }

  function requestRun() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  }

  const observer = new MutationObserver(requestRun);
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });
  window.addEventListener("eap-core-run-finished", () => [0,100,280,650,1200].forEach((delay) => setTimeout(requestRun, delay)));
  document.addEventListener("click", () => [80,250,600].forEach((delay) => setTimeout(requestRun, delay)), true);
  [0,120,360,800,1600,2600].forEach((delay) => setTimeout(requestRun, delay));

  window.inspectEapV230 = () => ({
    version: VERSION,
    visiblePass: visiblePass(),
    report: window.EAP_WORD_V230_VISIBLE_PASS_REPORT || null,
    progress: coreProgress(),
    label: norm($("nextMissionBtn") && $("nextMissionBtn").dataset.eapV230Label)
  });

  console.info("[EAP Word Quest] v230 visible-pass state commit ready", { version:VERSION });
})();
