/* =========================================================
   EAP Word Quest • Recovery CTA + Pass State Bridge
   File: /herohealth/eap-word-quest/eap-word-engine-v222-recovery-cta-clarity.js
   Version: v2.2.2-PASS-STATE-BRIDGE-122

   Student-facing safeguards:
   - Keeps one stable Recovery CTA for an unpassed Session.
   - On every passed Session, reaffirms the Core state from the exact
     completed result event before summary/path patches refresh.
   - Restores only the most recent passed learning-log record after reload.
   - Does not generate a score, change pass thresholds, alter questions,
     answer order, weak words, gate rules, or teacher logs.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.2-PASS-STATE-BRIDGE-122";
  const GROUP = "122";
  const LOG_KEY = "EAP_WORD_QUEST_LEARNING_LOGS_V182";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const STATE_PREFIX = "EAP_WORD_QUEST_CORE_V196_STATE";
  const ORDER = [
    "S1","S2","S3","BG1","S4","S5","S6","BG2",
    "S7","S8","S9","BG3","S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];
  let lastCompleted = null;

  if (window.__EAP_WORD_V222_RECOVERY_CTA__) return;
  window.__EAP_WORD_V222_RECOVERY_CTA__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const isSessionId = (value) => ORDER.includes(norm(value).toUpperCase());
  const threshold = (id) => id === "BG5" ? 75 : /^BG/i.test(id) ? 70 : 60;

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
      console.warn("[EAP Word Quest] v222 state write skipped", err);
      return false;
    }
  }

  function profileId() {
    const saved = readJson(PROFILE_KEY, {}) || {};
    const input = $("studentIdInput");
    return norm((input && input.value) || saved.studentId || saved.id || "anon");
  }

  function stateKey() {
    try {
      const progress = typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null;
      if (progress && progress.stateKey) return norm(progress.stateKey);
    } catch (err) {}
    return `${STATE_PREFIX}_${GROUP}_${profileId().replace(/[^a-z0-9_-]/gi,"_") || "anon"}`;
  }

  function normalize(source) {
    const raw = source && typeof source === "object" ? source : {};
    const sessionId = norm(raw.sessionId).toUpperCase();
    const correct = Math.max(0, Math.round(num(raw.correct)));
    const total = Math.max(1, Math.round(num(raw.total, 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(num(raw.accuracy, (correct / total) * 100))));
    return {
      raw,
      sessionId,
      correct,
      total,
      accuracy,
      score:Math.max(0,Math.round(num(raw.score, raw.xp))),
      passed:Boolean(raw.passed || accuracy >= threshold(sessionId)),
      playedAt:norm(raw.playedAt || raw.endedAt || raw.at || "")
    };
  }

  function latestPassedLog() {
    const ownId = profileId();
    const now = Date.now();
    const rows = readJson(LOG_KEY, []);
    if (!Array.isArray(rows)) return null;
    return rows.map(normalize).filter((row) => {
      const loggedId = norm(row.raw.studentId || row.raw.id || "");
      const when = new Date(row.playedAt).getTime();
      const age = now - when;
      return row.passed && isSessionId(row.sessionId) &&
        (!ownId || ownId === "anon" || !loggedId || loggedId === ownId) &&
        Number.isFinite(when) && age >= -60000 && age <= 24 * 60 * 60 * 1000;
    }).sort((a,b) => new Date(b.playedAt) - new Date(a.playedAt))[0] || null;
  }

  function currentResult() {
    const direct = lastCompleted || window.EAP_V196_LAST_RESULT || window.EAP_V203_LAST_RESULT || window.EAP_V195_LAST_RESULT || window.EAP_V192_LAST_RESULT || null;
    if (direct && isSessionId(direct.sessionId)) return direct;
    const logged = latestPassedLog();
    return logged ? logged.raw : null;
  }

  function syncPassedState(source) {
    const result = normalize(source || currentResult());
    if (!result.passed || !isSessionId(result.sessionId)) {
      return { synced:false, reason:"not_a_current_pass", sessionId:result.sessionId };
    }

    const key = stateKey();
    if (!key) return { synced:false, reason:"missing_state_key", sessionId:result.sessionId };
    const state = readJson(key, {}) || {};
    state.version = state.version || "v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";
    state.group = GROUP;
    state.coreOnly = true;
    state.sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
    state.recentItemIds = Array.isArray(state.recentItemIds) ? state.recentItemIds.slice(0,36) : [];
    state.weakTargets = state.weakTargets && typeof state.weakTargets === "object" ? state.weakTargets : {};
    state.createdAt = state.createdAt || new Date().toISOString();

    const old = state.sessions[result.sessionId] || {};
    const beforePassed = Boolean(old.passed);
    state.sessions[result.sessionId] = Object.assign({}, old, {
      played:true,
      passed:true,
      accuracy:Math.max(result.accuracy,Math.round(num(old.accuracy))),
      bestAccuracy:Math.max(result.accuracy,Math.round(num(old.bestAccuracy,old.accuracy))),
      bestScore:Math.max(result.score,Math.round(num(old.bestScore,old.lastScore))),
      lastAccuracy:result.accuracy,
      lastScore:result.score,
      totalAttempts:Math.max(1,Math.round(num(old.totalAttempts,0))),
      lastPlayed:result.playedAt || old.lastPlayed || new Date().toISOString()
    });
    state.updatedAt = new Date().toISOString();
    const saved = writeJson(key,state);
    const report = { synced:saved, sessionId:result.sessionId, accuracy:result.accuracy, stateKey:key, wasPassed:beforePassed };
    window.EAP_WORD_V222_PASS_SYNC = report;
    return report;
  }

  function summaryActive() {
    return Boolean($("summaryScreen") && $("summaryScreen").classList.contains("active"));
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function addStyle() {
    if ($("eapV222RecoveryCtaStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV222RecoveryCtaStyle";
    style.textContent = `
      #nextMissionBtn[data-eap-v222-visible-label]{position:relative!important;color:transparent!important;text-shadow:none!important}
      #nextMissionBtn[data-eap-v222-visible-label]::after{content:attr(data-eap-v222-visible-label);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font:inherit;font-weight:900;line-height:inherit;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function clearVisibleLock() {
    const next = $("nextMissionBtn");
    if (!next) return;
    delete next.dataset.eapV222VisibleLabel;
    next.removeAttribute("aria-label");
  }

  function applyCta() {
    addStyle();
    const result = currentResult();
    if (result && normalize(result).passed) syncPassedState(result);

    if (!summaryActive()) {
      clearVisibleLock();
      return;
    }
    if (!result) return;

    const row = normalize(result);
    const sessionId = row.sessionId;
    if (!isSessionId(sessionId) || row.passed) {
      clearVisibleLock();
      return;
    }

    const neededToPass = Math.max(0, Math.ceil((threshold(sessionId) / 100) * row.total) - row.correct);
    const next = $("nextMissionBtn");
    const replay = $("replayBtn");
    const recoveryLabel = `เริ่ม ${sessionId} Recovery`;

    if (next) {
      setText(next,recoveryLabel);
      next.dataset.eapV222VisibleLabel = recoveryLabel;
      next.setAttribute("aria-label",recoveryLabel);
      next.title = neededToPass ? `ต้องตอบถูกเพิ่มอีก ${neededToPass} ข้อเพื่อผ่าน ${sessionId}` : recoveryLabel;
      next.dataset.eapV222Recovery = sessionId;
    }
    if (replay) {
      setText(replay,`เล่น ${sessionId} อีกครั้ง`);
      replay.title = "เล่น Session เดิมอีกครั้งโดยใช้ชุดโจทย์ใหม่";
    }

    const plan = $("eapV218RecoveryPlan");
    if (plan && neededToPass > 0) {
      let note = $("eapV222NearPassNote");
      if (!note) {
        note = document.createElement("div");
        note.id = "eapV222NearPassNote";
        note.style.marginTop = "7px";
        note.style.fontWeight = "950";
        plan.appendChild(note);
      }
      setText(note,`เป้าหมายรอบถัดไป: ตอบถูกเพิ่มอีก ${neededToPass} ข้อเพื่อผ่าน ${sessionId}`);
    }
  }

  function prepareSession(event) {
    const button = event.target && event.target.closest ? event.target.closest("#nextMissionBtn,#replayBtn") : null;
    const result = normalize(currentResult());
    if (!button || result.passed || !isSessionId(result.sessionId)) return;
    if (document.body && document.body.dataset) document.body.dataset.sessionId = result.sessionId;
    const game = $("gameScreen");
    if (game && game.dataset) game.dataset.sessionId = result.sessionId;
  }

  window.addEventListener("eap-core-run-finished", (event) => {
    if (event && event.detail && isSessionId(event.detail.sessionId)) {
      lastCompleted = event.detail;
      if (normalize(event.detail).passed) syncPassedState(event.detail);
    }
    [0,80,220,520,1000].forEach((delay) => setTimeout(applyCta,delay));
  });
  document.addEventListener("click", (event) => {
    prepareSession(event);
    [100,320,700].forEach((delay) => setTimeout(applyCta,delay));
  }, true);
  [220,700,1400].forEach((delay) => setTimeout(applyCta,delay));
  setInterval(applyCta,1000);

  window.inspectEapV222 = () => {
    const result = normalize(currentResult());
    const next = $("nextMissionBtn");
    return {
      version:VERSION,
      sessionId:result.sessionId,
      passed:result.passed,
      passSync:window.EAP_WORD_V222_PASS_SYNC || null,
      visibleLabel:norm(next && next.dataset.eapV222VisibleLabel),
      semanticLabel:norm(next && next.textContent),
      replayLabel:norm($("replayBtn") && $("replayBtn").textContent)
    };
  };

  console.info("[EAP Word Quest] v222 pass-state bridge ready", { version:VERSION });
})();
