/* =========================================================
   EAP Word Quest • Retained Pass Repair
   File: /herohealth/eap-word-quest/eap-word-engine-v227-retained-pass-repair.js
   Version: v2.2.7-RETAINED-PASS-REPAIR-122

   A lower replay must never erase a legitimately passed Session.
   When the current Summary is a replay below threshold, this guard checks
   only the SAME Session's prior local learning records for the active learner.
   If a prior pass exists, it restores that pass into the exact Core state key
   returned by the controller. It does not unlock other Sessions or invent
   scores, and it leaves the current replay result visible as current feedback.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.7-RETAINED-PASS-REPAIR-122";
  const GROUP = "122";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const LOG_KEY = "EAP_WORD_QUEST_LEARNING_LOGS_V182";
  const VALID = new Set([
    "S1","S2","S3","BG1","S4","S5","S6","BG2",
    "S7","S8","S9","BG3","S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ]);

  if (window.__EAP_WORD_V227_RETAINED_PASS_REPAIR__) return;
  window.__EAP_WORD_V227_RETAINED_PASS_REPAIR__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const threshold = (id) => id === "BG5" ? 75 : /^BG/i.test(id) ? 70 : 60;
  let lastDispatch = "";

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
      console.warn("[EAP Word Quest] v227 retained pass write skipped", err);
      return false;
    }
  }

  function activeProfile() {
    const saved = readJson(PROFILE_KEY, {}) || {};
    const id = norm(($("studentIdInput") && $("studentIdInput").value) || saved.studentId || saved.id || "");
    const name = norm(($("studentNameInput") && $("studentNameInput").value) || saved.studentName || saved.name || "");
    return { id, name };
  }

  function stateKey() {
    try {
      const progress = typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null;
      return norm(progress && progress.stateKey);
    } catch (err) {
      return "";
    }
  }

  function normalize(raw) {
    const row = raw && typeof raw === "object" ? raw : {};
    const sessionId = norm(row.sessionId).toUpperCase();
    const correct = Math.max(0, Math.round(num(row.correct)));
    const total = Math.max(1, Math.round(num(row.total, 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(num(row.accuracy, (correct / total) * 100))));
    return {
      raw:row,
      sessionId,
      correct,
      total,
      accuracy,
      score:Math.max(0,Math.round(num(row.score, row.xp))),
      passed:Boolean(row.passed || accuracy >= threshold(sessionId)),
      playedAt:norm(row.playedAt || row.endedAt || row.at || "")
    };
  }

  function summarySession() {
    const screen = $("summaryScreen");
    if (!screen || !screen.classList.contains("active")) return "";
    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    const matched = title.match(/^(S(?:1[0-5]|[1-9])|BG[1-5])\s+(?:ผ่านแล้ว!|ฝึกเพิ่มอีกนิด)/i);
    return matched ? matched[1].toUpperCase() : "";
  }

  function sameLearner(row, profile) {
    const loggedId = norm(row.raw.studentId || row.raw.id || "");
    const loggedName = norm(row.raw.studentName || row.raw.name || "");
    const stableId = profile.id && !["anon","no-id"].includes(profile.id.toLowerCase());
    if (stableId) return !loggedId || loggedId === profile.id;
    const stableName = profile.name && !["anonymous","hero"].includes(profile.name.toLowerCase());
    if (stableName && loggedName) return loggedName === profile.name;
    /* Default/dev profile: accept the same group only, not arbitrary data. */
    const group = norm(row.raw.group || row.raw.section || GROUP);
    return group === GROUP && (!loggedId || ["anon","no-id"].includes(loggedId.toLowerCase()));
  }

  function bestPriorPass(sessionId) {
    if (!VALID.has(sessionId)) return null;
    const profile = activeProfile();
    const rows = readJson(LOG_KEY, []);
    if (!Array.isArray(rows)) return null;
    return rows
      .map(normalize)
      .filter((row) => row.sessionId === sessionId && row.passed && sameLearner(row, profile))
      .sort((a,b) => {
        const scoreDiff = b.accuracy - a.accuracy;
        return scoreDiff || (new Date(b.playedAt || 0) - new Date(a.playedAt || 0));
      })[0] || null;
  }

  function statePassed(sessionId) {
    const key = stateKey();
    const state = key ? readJson(key,{}) : {};
    return Boolean(state && state.sessions && state.sessions[sessionId] && state.sessions[sessionId].passed);
  }

  function retain(sessionId) {
    const prior = bestPriorPass(sessionId);
    const key = stateKey();
    if (!prior || !key) return { repaired:false, reason:prior ? "missing_state_key" : "no_prior_same_session_pass", sessionId };

    const state = readJson(key,{}) || {};
    state.version = state.version || "v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";
    state.group = GROUP;
    state.coreOnly = true;
    state.sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
    state.recentItemIds = Array.isArray(state.recentItemIds) ? state.recentItemIds.slice(0,36) : [];
    state.weakTargets = state.weakTargets && typeof state.weakTargets === "object" ? state.weakTargets : {};
    state.createdAt = state.createdAt || new Date().toISOString();

    const old = state.sessions[sessionId] || {};
    const wasPassed = Boolean(old.passed);
    state.sessions[sessionId] = Object.assign({}, old, {
      played:true,
      passed:true,
      accuracy:Math.max(prior.accuracy,Math.round(num(old.accuracy))),
      bestAccuracy:Math.max(prior.accuracy,Math.round(num(old.bestAccuracy,old.accuracy))),
      bestScore:Math.max(prior.score,Math.round(num(old.bestScore,old.lastScore))),
      /* Preserve the latest replay result when it exists; the pass is the
         gate record, not a rewrite of today's feedback. */
      lastAccuracy:old.lastAccuracy == null ? prior.accuracy : Math.round(num(old.lastAccuracy)),
      lastScore:old.lastScore == null ? prior.score : Math.round(num(old.lastScore)),
      totalAttempts:Math.max(1,Math.round(num(old.totalAttempts,0))),
      lastPlayed:old.lastPlayed || prior.playedAt || new Date().toISOString()
    });
    state.updatedAt = new Date().toISOString();
    const wrote = writeJson(key,state);
    const report = { repaired:wrote, sessionId, stateKey:key, prior:{correct:prior.correct,total:prior.total,accuracy:prior.accuracy,playedAt:prior.playedAt}, wasPassed };
    window.EAP_WORD_V227_RETAINED_PASS = report;

    if (wrote) {
      const stamp = `${key}|${sessionId}|${prior.playedAt}|${prior.accuracy}`;
      if (lastDispatch !== stamp) {
        lastDispatch = stamp;
        setTimeout(() => {
          const current = window.EAP_V196_LAST_RESULT || window.EAP_V203_LAST_RESULT || prior.raw;
          window.dispatchEvent(new CustomEvent("eap-core-run-finished", { detail:current }));
        }, 0);
      }
    }
    return report;
  }

  function repairCurrentSummary() {
    const sessionId = summarySession();
    if (!sessionId || statePassed(sessionId)) return { repaired:false, reason:sessionId ? "already_passed_or_no_change" : "not_summary", sessionId };
    return retain(sessionId);
  }

  window.addEventListener("eap-core-run-finished", () => [80,260,700].forEach((delay)=>setTimeout(repairCurrentSummary,delay)));
  document.addEventListener("click", () => [180,500,1100].forEach((delay)=>setTimeout(repairCurrentSummary,delay)), true);
  [220,700,1500,2600].forEach((delay)=>setTimeout(repairCurrentSummary,delay));

  window.inspectEapV227 = () => {
    const sessionId = summarySession();
    return { version:VERSION, sessionId, stateKey:stateKey(), statePassed:sessionId ? statePassed(sessionId) : false, prior:sessionId ? bestPriorPass(sessionId) : null, lastRepair:window.EAP_WORD_V227_RETAINED_PASS || null };
  };

  console.info("[EAP Word Quest] v227 retained pass repair ready", { version:VERSION });
})();
