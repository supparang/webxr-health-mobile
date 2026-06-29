/* =========================================================
   EAP Word Quest • Summary State Authority
   File: /herohealth/eap-word-quest/eap-word-engine-v231-summary-state-authority.js
   Version: v2.3.1-SUMMARY-STATE-AUTHORITY-122

   A passed Summary is authoritative for the active local learner. When the
   visible screen says “BG4 ผ่านแล้ว!” (or any valid Session/Boss) and the
   displayed score meets the official threshold, write that pass into the
   exact compact Core state key before any Arc renderer reads progress.

   This is intentionally a narrow safety bridge: it cannot create a pass
   without the passed title plus an above-threshold displayed score.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.3.1-SUMMARY-STATE-AUTHORITY-122";
  const GROUP = "122";
  const VALID = new Set([
    "S1","S2","S3","BG1","S4","S5","S6","BG2",
    "S7","S8","S9","BG3","S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ]);

  if (window.__EAP_WORD_V231_SUMMARY_STATE_AUTHORITY__) return;
  window.__EAP_WORD_V231_SUMMARY_STATE_AUTHORITY__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const required = (id) => id === "BG5" ? 75 : /^BG/i.test(id) ? 70 : 60;

  let baseProgress = null;
  let committing = false;
  let lastStamp = "";
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
      console.warn("[EAP Word Quest] v231 cannot write state", err);
      return false;
    }
  }

  function baseCoreProgress() {
    try {
      if (!baseProgress && typeof window.getEapCoreProgress === "function") {
        baseProgress = window.getEapCoreProgress;
      }
      return baseProgress ? baseProgress() : null;
    } catch (err) {
      return null;
    }
  }

  function screenIsSummary() {
    const screen = $("summaryScreen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function visiblePassedResult() {
    if (!screenIsSummary()) return null;
    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    const match = title.match(/^(S(?:1[0-5]|[1-9])|BG[1-5])\s+(?:ผ่านแล้ว!|Complete)$/i);
    if (!match) return null;

    const sessionId = match[1].toUpperCase();
    if (!VALID.has(sessionId)) return null;

    const summaryText = norm($("summaryStats") && $("summaryStats").textContent);
    const scorePair = summaryText.match(/(\d+)\s*\/\s*(\d+)/);
    const percent = summaryText.match(/(\d+)\s*%/);
    const live = window.EAP_V196_LAST_RESULT || window.EAP_V203_LAST_RESULT || window.EAP_V195_LAST_RESULT || {};
    const liveMatches = norm(live.sessionId).toUpperCase() === sessionId;
    const correct = Math.max(0, Math.round(number(liveMatches ? live.correct : scorePair && scorePair[1], 0)));
    const total = Math.max(1, Math.round(number(liveMatches ? live.total : scorePair && scorePair[2], 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(number(
      liveMatches ? live.accuracy : percent && percent[1],
      (correct / total) * 100
    ))));
    const passAt = required(sessionId);
    if (accuracy < passAt || correct < Math.ceil(total * passAt / 100)) return null;

    return {
      sessionId,
      correct,
      total,
      accuracy,
      score: Math.max(0, Math.round(number(live.score, live.xp))),
      xp: Math.max(0, Math.round(number(live.xp, live.score))),
      maxCombo: Math.max(0, Math.round(number(live.maxCombo))),
      passed: true,
      passThreshold: passAt,
      playedAt: norm(live.playedAt || live.endedAt || new Date().toISOString()),
      raw: live
    };
  }

  function commit() {
    if (committing) return { committed:false, reason:"busy" };
    const result = visiblePassedResult();
    const progress = baseCoreProgress();
    const key = norm(progress && progress.stateKey);
    if (!result || !key) return { committed:false, reason:result ? "missing_state_key" : "no_visible_pass" };

    committing = true;
    try {
      const state = readJson(key, {}) || {};
      state.version = state.version || "v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";
      state.group = GROUP;
      state.coreOnly = true;
      state.sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
      state.recentItemIds = Array.isArray(state.recentItemIds) ? state.recentItemIds.slice(0,36) : [];
      state.weakTargets = state.weakTargets && typeof state.weakTargets === "object" ? state.weakTargets : {};
      state.createdAt = state.createdAt || new Date().toISOString();

      const old = state.sessions[result.sessionId] || {};
      const already = Boolean(old.passed) && Math.max(number(old.bestAccuracy,old.accuracy), number(old.accuracy)) >= result.accuracy;
      state.sessions[result.sessionId] = Object.assign({}, old, {
        played:true,
        passed:true,
        accuracy:Math.max(result.accuracy, Math.round(number(old.accuracy))),
        bestAccuracy:Math.max(result.accuracy, Math.round(number(old.bestAccuracy,old.accuracy))),
        bestScore:Math.max(result.score, Math.round(number(old.bestScore,old.lastScore))),
        lastAccuracy:result.accuracy,
        lastScore:result.score,
        totalAttempts:Math.max(1, Math.round(number(old.totalAttempts,0))),
        lastPlayed:result.playedAt
      });
      state.updatedAt = new Date().toISOString();

      const stamp = `${key}|${result.sessionId}|${result.correct}/${result.total}|${result.accuracy}`;
      const committed = already || writeJson(key,state);
      const report = { committed, already, sessionId:result.sessionId, accuracy:result.accuracy, stateKey:key };
      window.EAP_WORD_V231_AUTHORITY = report;

      if (committed && stamp !== lastStamp) {
        lastStamp = stamp;
        const detail = Object.assign({}, result.raw || {}, result, { raw:undefined });
        window.EAP_V196_LAST_RESULT = detail;
        window.EAP_V195_LAST_RESULT = detail;
        window.EAP_V203_LAST_RESULT = detail;
        setTimeout(() => window.dispatchEvent(new CustomEvent("eap-core-run-finished", { detail })), 0);
      }
      return report;
    } finally {
      committing = false;
    }
  }

  function installProgressAuthority() {
    if (!baseProgress && typeof window.getEapCoreProgress === "function") {
      baseProgress = window.getEapCoreProgress;
    }
    if (!baseProgress || window.__EAP_WORD_V231_PROGRESS_WRAPPED__) return;
    window.__EAP_WORD_V231_PROGRESS_WRAPPED__ = true;
    window.getEapCoreProgress = function eapProgressWithVisiblePassAuthority() {
      if (!committing) commit();
      return baseProgress();
    };
  }

  function renderNextAction() {
    const report = commit();
    if (!report.committed) return;
    const progress = baseCoreProgress();
    const next = norm(progress && progress.next);
    const button = $("nextMissionBtn");
    if (!button || !next || next === "DONE") return;
    const label = `ไปทำ ${next} ต่อ`;
    button.dataset.eapV231Label = label;
    button.setAttribute("aria-label",label);
    button.title = `ไปยังภารกิจถัดไป ${next}`;
  }

  function addStyle() {
    if ($("eapV231AuthorityStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV231AuthorityStyle";
    style.textContent = `
      #nextMissionBtn[data-eap-v231-label]{position:relative!important;color:transparent!important;font-size:0!important;line-height:0!important;text-shadow:none!important;min-width:205px!important}
      #nextMissionBtn[data-eap-v231-label]::after{content:attr(data-eap-v231-label)!important;position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:18px!important;font-weight:950!important;line-height:1.15!important;white-space:nowrap!important;pointer-events:none!important}
      @media(max-width:680px){#nextMissionBtn[data-eap-v231-label]{width:100%!important;min-width:0!important}#nextMissionBtn[data-eap-v231-label]::after{font-size:17px!important}}
    `;
    document.head.appendChild(style);
  }

  function run() {
    queued = false;
    installProgressAuthority();
    addStyle();
    renderNextAction();
  }

  function requestRun() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  }

  const observer = new MutationObserver(requestRun);
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener("eap-core-run-finished",()=>[0,100,320,750,1400].forEach((delay)=>setTimeout(requestRun,delay)));
  document.addEventListener("click",()=>[80,260,600,1100].forEach((delay)=>setTimeout(requestRun,delay)),true);
  [0,120,360,800,1600,2600,3600].forEach((delay)=>setTimeout(requestRun,delay));

  window.inspectEapV231 = () => ({
    version:VERSION,
    visiblePass:visiblePassedResult(),
    report:window.EAP_WORD_V231_AUTHORITY || null,
    progress:baseCoreProgress(),
    nextLabel:norm($("nextMissionBtn") && $("nextMissionBtn").dataset.eapV231Label)
  });

  console.info("[EAP Word Quest] v231 summary state authority ready",{version:VERSION});
})();
