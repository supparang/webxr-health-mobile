/* =========================================================
   EAP Word Quest • Summary Pass Commit
   File: /herohealth/eap-word-quest/eap-word-engine-v226-summary-pass-commit.js
   Version: v2.2.6-SUMMARY-PASS-COMMIT-122

   Final reconciliation boundary:
   A visible completed Summary is the learner-facing source of truth. When it
   says “S12 ผ่านแล้ว!”, this guard commits that exact passed Session to the
   exact state key returned by the Core controller, then asks existing summary
   renderers to recompute the Arc Path once. It never fabricates a pass:
   title, correct/total and threshold must agree before any state write.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.6-SUMMARY-PASS-COMMIT-122";
  const GROUP = "122";
  const VALID = new Set([
    "S1","S2","S3","BG1","S4","S5","S6","BG2",
    "S7","S8","S9","BG3","S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ]);

  if (window.__EAP_WORD_V226_SUMMARY_PASS_COMMIT__) return;
  window.__EAP_WORD_V226_SUMMARY_PASS_COMMIT__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  const asNum = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const threshold = (id) => id === "BG5" ? 75 : /^BG/i.test(id) ? 70 : 60;
  const commits = new Set();

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
      console.warn("[EAP Word Quest] v226 cannot commit summary pass", err);
      return false;
    }
  }

  function screenActive() {
    return Boolean($("summaryScreen") && $("summaryScreen").classList.contains("active"));
  }

  function titleResult() {
    if (!screenActive()) return null;
    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    const match = title.match(/^(S(?:1[0-5]|[1-9])|BG[1-5])\s+ผ่านแล้ว!/i);
    if (!match) return null;

    const id = match[1].toUpperCase();
    if (!VALID.has(id)) return null;

    const live = window.EAP_V196_LAST_RESULT || window.EAP_V203_LAST_RESULT || window.EAP_V195_LAST_RESULT || {};
    const liveId = norm(live.sessionId).toUpperCase();
    const statText = norm($("summaryStats") && $("summaryStats").textContent);
    const countMatch = statText.match(/(\d+)\s*\/\s*(\d+)/);
    const accuracyMatch = statText.match(/(\d+)\s*%/);
    const correct = Math.max(0, Math.round(asNum(liveId === id ? live.correct : countMatch && countMatch[1], 0)));
    const total = Math.max(1, Math.round(asNum(liveId === id ? live.total : countMatch && countMatch[2], 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(asNum(liveId === id ? live.accuracy : accuracyMatch && accuracyMatch[1], (correct / total) * 100))));
    const passed = accuracy >= threshold(id) && correct >= Math.ceil(total * threshold(id) / 100);
    if (!passed) return null;

    return {
      sessionId:id,
      correct,
      total,
      accuracy,
      score:Math.max(0,Math.round(asNum(live.score, live.xp))),
      xp:Math.max(0,Math.round(asNum(live.xp, live.score))),
      maxCombo:Math.max(0,Math.round(asNum(live.maxCombo))),
      passed:true,
      passThreshold:threshold(id),
      playedAt:norm(live.playedAt || live.endedAt || new Date().toISOString()),
      sessionTitle:norm(live.sessionTitle),
      raw:live
    };
  }

  function exactStateKey() {
    try {
      const progress = typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null;
      return norm(progress && progress.stateKey);
    } catch (err) {
      return "";
    }
  }

  function commit(result) {
    if (!result) return { committed:false, reason:"no_visible_pass" };
    const stateKey = exactStateKey();
    if (!stateKey) return { committed:false, reason:"missing_core_state_key", sessionId:result.sessionId };

    const stamp = `${stateKey}|${result.sessionId}|${result.correct}/${result.total}|${result.accuracy}`;
    const state = readJson(stateKey,{}) || {};
    state.version = state.version || "v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";
    state.group = GROUP;
    state.coreOnly = true;
    state.sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
    state.recentItemIds = Array.isArray(state.recentItemIds) ? state.recentItemIds.slice(0,36) : [];
    state.weakTargets = state.weakTargets && typeof state.weakTargets === "object" ? state.weakTargets : {};
    state.createdAt = state.createdAt || new Date().toISOString();

    const previous = state.sessions[result.sessionId] || {};
    const next = Object.assign({}, previous, {
      played:true,
      passed:true,
      accuracy:Math.max(result.accuracy,Math.round(asNum(previous.accuracy))),
      bestAccuracy:Math.max(result.accuracy,Math.round(asNum(previous.bestAccuracy,previous.accuracy))),
      bestScore:Math.max(result.score,Math.round(asNum(previous.bestScore,previous.lastScore))),
      lastAccuracy:result.accuracy,
      lastScore:result.score,
      totalAttempts:Math.max(1,Math.round(asNum(previous.totalAttempts,0))),
      lastPlayed:result.playedAt
    });
    state.sessions[result.sessionId] = next;
    state.updatedAt = new Date().toISOString();

    const alreadyEquivalent = previous.passed && previous.lastAccuracy === next.lastAccuracy && previous.lastPlayed === next.lastPlayed;
    const committed = alreadyEquivalent || writeJson(stateKey,state);
    const report = { committed, alreadyEquivalent, stateKey, sessionId:result.sessionId, accuracy:result.accuracy };
    window.EAP_WORD_V226_LAST_COMMIT = report;

    if (committed && !commits.has(stamp)) {
      commits.add(stamp);
      /* Existing v195/v220 cards schedule a fresh path calculation from the
         Core state. Dispatch once only to prevent render churn. */
      setTimeout(() => {
        const latest = Object.assign({}, result.raw || {}, result, { raw:undefined });
        window.EAP_V196_LAST_RESULT = latest;
        window.EAP_V195_LAST_RESULT = latest;
        window.EAP_V203_LAST_RESULT = latest;
        window.dispatchEvent(new CustomEvent("eap-core-run-finished", { detail:latest }));
      }, 0);
    }
    return report;
  }

  function runCommit() {
    return commit(titleResult());
  }

  window.addEventListener("eap-core-run-finished", () => {
    [0,80,240,600,1200].forEach((delay) => setTimeout(runCommit,delay));
  });
  document.addEventListener("click", () => [120,420,900].forEach((delay) => setTimeout(runCommit,delay)), true);
  [100,350,800,1500,2400].forEach((delay) => setTimeout(runCommit,delay));

  window.inspectEapV226 = () => ({
    version:VERSION,
    visibleResult:titleResult(),
    lastCommit:window.EAP_WORD_V226_LAST_COMMIT || null,
    stateKey:exactStateKey()
  });

  console.info("[EAP Word Quest] v226 summary pass commit ready",{version:VERSION});
})();
