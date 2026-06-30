/* =========================================================
   EAP Word Quest • Final Progress Authority
   File: /herohealth/eap-word-quest/eap-word-engine-v232-final-progress-authority.js
   Version: v2.3.2-FINAL-PROGRESS-AUTHORITY-122

   One final authority boundary for the Student Summary:
   - A visible “S.. ผ่านแล้ว!” / “BG.. ผ่านแล้ว!” with a score that meets
     the official threshold is committed to the active Core state key.
   - getEapCoreProgress() and inspectEapV196() expose the same merged state
     immediately, so Arc cards and the next action cannot lag behind.
   - Only the currently visible, validated result is reconciled. No score,
     threshold, item, answer order, weak-word record, or unrelated learner
     state is created or modified.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.3.2-FINAL-PROGRESS-AUTHORITY-122";
  const GROUP = "122";
  const ORDER = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];
  const ARCS = [
    { sessions:["S1","S2","S3"], boss:"BG1" },
    { sessions:["S4","S5","S6"], boss:"BG2" },
    { sessions:["S7","S8","S9"], boss:"BG3" },
    { sessions:["S10","S11","S12"], boss:"BG4" },
    { sessions:["S13","S14","S15"], boss:"BG5" }
  ];

  if (window.__EAP_WORD_V232_FINAL_PROGRESS_AUTHORITY__) return;
  window.__EAP_WORD_V232_FINAL_PROGRESS_AUTHORITY__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const threshold = (id) => id === "BG5" ? 75 : /^BG/i.test(id) ? 70 : 60;

  let baseProgress = null;
  let baseInspect = null;
  let installing = false;
  let queued = false;
  let lastDispatch = "";
  const memoryPasses = Object.create(null);

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
      console.warn("[EAP Word Quest] v232 cannot write active progress state", err);
      return false;
    }
  }

  function summaryActive() {
    const screen = $("summaryScreen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function visiblePassedResult() {
    if (!summaryActive()) return null;
    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    const match = title.match(/^(S(?:1[0-5]|[1-9])|BG[1-5])\s+(?:ผ่านแล้ว!|Complete)$/i);
    if (!match) return null;

    const sessionId = match[1].toUpperCase();
    if (!ORDER.includes(sessionId)) return null;

    const live = window.EAP_V196_LAST_RESULT || window.EAP_V203_LAST_RESULT || window.EAP_V195_LAST_RESULT || {};
    const sameRun = norm(live.sessionId).toUpperCase() === sessionId;
    const summaryText = norm($("summaryStats") && $("summaryStats").textContent);
    const pair = summaryText.match(/(\d+)\s*\/\s*(\d+)/);
    const pct = summaryText.match(/(\d+)\s*%/);
    const correct = Math.max(0, Math.round(num(sameRun ? live.correct : pair && pair[1], 0)));
    const total = Math.max(1, Math.round(num(sameRun ? live.total : pair && pair[2], 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(num(
      sameRun ? live.accuracy : pct && pct[1],
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

  function originalProgress() {
    try {
      if (!baseProgress && typeof window.getEapCoreProgress === "function") {
        baseProgress = window.getEapCoreProgress;
      }
      return baseProgress ? baseProgress() : null;
    } catch (err) {
      return null;
    }
  }

  function activeStateKey() {
    const progress = originalProgress();
    return norm(progress && progress.stateKey);
  }

  function mergeVisiblePass(state, result) {
    const next = state && typeof state === "object" ? state : {};
    next.version = next.version || "v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";
    next.group = GROUP;
    next.coreOnly = true;
    next.sessions = next.sessions && typeof next.sessions === "object" ? next.sessions : {};
    next.recentItemIds = Array.isArray(next.recentItemIds) ? next.recentItemIds.slice(0,36) : [];
    next.weakTargets = next.weakTargets && typeof next.weakTargets === "object" ? next.weakTargets : {};
    next.createdAt = next.createdAt || new Date().toISOString();
    if (!result) return next;

    const old = next.sessions[result.sessionId] || {};
    next.sessions[result.sessionId] = Object.assign({}, old, {
      played:true,
      passed:true,
      accuracy:Math.max(result.accuracy, Math.round(num(old.accuracy))),
      bestAccuracy:Math.max(result.accuracy, Math.round(num(old.bestAccuracy, old.accuracy))),
      bestScore:Math.max(result.score, Math.round(num(old.bestScore, old.lastScore))),
      lastAccuracy:result.accuracy,
      lastScore:result.score,
      totalAttempts:Math.max(1, Math.round(num(old.totalAttempts,0))),
      lastPlayed:result.playedAt
    });
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function resolvedState() {
    const key = activeStateKey();
    const visible = visiblePassedResult();
    const source = key ? readJson(key,{}) : {};
    const state = mergeVisiblePass(source, visible);
    if (visible) memoryPasses[visible.sessionId] = state.sessions[visible.sessionId];
    Object.keys(memoryPasses).forEach((id) => {
      if (!state.sessions[id] || !state.sessions[id].passed) {
        state.sessions[id] = Object.assign({}, memoryPasses[id]);
      }
    });
    return { key, state, visible };
  }

  function writeVisiblePass() {
    const model = resolvedState();
    if (!model.visible || !model.key) return { committed:false, reason:model.visible ? "missing_state_key" : "no_visible_pass" };
    const saved = writeJson(model.key, model.state);
    const report = {
      committed:saved,
      sessionId:model.visible.sessionId,
      accuracy:model.visible.accuracy,
      stateKey:model.key
    };
    window.EAP_WORD_V232_REPORT = report;
    return report;
  }

  function sessionPassed(state, id) {
    return Boolean(state && state.sessions && state.sessions[id] && state.sessions[id].passed);
  }

  function unlocked(state, id) {
    const arcIndex = ARCS.findIndex((arc) => arc.sessions.includes(id) || arc.boss === id);
    if (arcIndex < 0) return true;
    if (arcIndex > 0 && !sessionPassed(state, ARCS[arcIndex - 1].boss)) return false;
    const arc = ARCS[arcIndex];
    return arc.boss !== id || arc.sessions.every((sessionId) => sessionPassed(state, sessionId));
  }

  function mergedProgress() {
    const original = originalProgress() || { version:"v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122", total:ORDER.length, stateKey:"" };
    const model = resolvedState();
    const passed = ORDER.filter((id) => sessionPassed(model.state,id)).length;
    const next = ORDER.find((id) => unlocked(model.state,id) && !sessionPassed(model.state,id)) || "DONE";
    return Object.assign({}, original, {
      passed,
      total:ORDER.length,
      percent:Math.round((passed / ORDER.length) * 100),
      next,
      stateKey:model.key || original.stateKey
    });
  }

  function installAuthority() {
    if (installing) return;
    installing = true;
    try {
      if (!baseProgress && typeof window.getEapCoreProgress === "function") baseProgress = window.getEapCoreProgress;
      if (!baseInspect && typeof window.inspectEapV196 === "function") baseInspect = window.inspectEapV196;

      if (baseProgress && window.getEapCoreProgress !== authorityProgress) {
        window.getEapCoreProgress = authorityProgress;
      }
      if (baseInspect && window.inspectEapV196 !== authorityInspect) {
        window.inspectEapV196 = authorityInspect;
      }
    } finally {
      installing = false;
    }
  }

  function authorityProgress() {
    writeVisiblePass();
    return mergedProgress();
  }

  function authorityInspect() {
    const snapshot = baseInspect ? baseInspect() : {};
    const model = resolvedState();
    return Object.assign({}, snapshot || {}, {
      sessions:model.state.sessions,
      completed:ORDER.filter((id)=>sessionPassed(model.state,id)).length,
      nextMission:mergedProgress().next
    });
  }

  function renderNextLabel() {
    const result = visiblePassedResult();
    if (!result) return;
    const progress = mergedProgress();
    const next = progress.next;
    const button = $("nextMissionBtn");
    if (!button || !next || next === "DONE") return;
    const label = `ไปทำ ${next} ต่อ`;
    button.dataset.eapV232Label = label;
    button.setAttribute("aria-label",label);
    button.title = `ไปยังภารกิจถัดไป ${next}`;
  }

  function addStyle() {
    if ($("eapV232Style")) return;
    const style = document.createElement("style");
    style.id = "eapV232Style";
    style.textContent = `
      #nextMissionBtn[data-eap-v232-label]{position:relative!important;color:transparent!important;font-size:0!important;line-height:0!important;text-shadow:none!important;min-width:205px!important}
      #nextMissionBtn[data-eap-v232-label]::after{content:attr(data-eap-v232-label)!important;position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:18px!important;font-weight:950!important;line-height:1.15!important;white-space:nowrap!important;pointer-events:none!important}
      @media(max-width:680px){#nextMissionBtn[data-eap-v232-label]{width:100%!important;min-width:0!important}#nextMissionBtn[data-eap-v232-label]::after{font-size:17px!important}}
    `;
    document.head.appendChild(style);
  }

  function refresh() {
    queued = false;
    installAuthority();
    addStyle();
    const report = writeVisiblePass();
    if (report.committed) {
      const visible = visiblePassedResult();
      const stamp = `${report.stateKey}|${report.sessionId}|${report.accuracy}`;
      if (visible && lastDispatch !== stamp) {
        lastDispatch = stamp;
        const detail = Object.assign({}, visible.raw || {}, visible, { raw:undefined });
        window.EAP_V196_LAST_RESULT = detail;
        window.EAP_V195_LAST_RESULT = detail;
        window.EAP_V203_LAST_RESULT = detail;
        setTimeout(() => window.dispatchEvent(new CustomEvent("eap-core-run-finished", { detail })), 0);
      }
    }
    renderNextLabel();
  }

  function requestRefresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  }

  const observer = new MutationObserver(requestRefresh);
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener("eap-core-run-finished",()=>[0,120,350,800,1400].forEach((delay)=>setTimeout(requestRefresh,delay)));
  document.addEventListener("click",()=>[80,250,600,1100].forEach((delay)=>setTimeout(requestRefresh,delay)),true);
  [0,120,360,800,1600,2600,3600].forEach((delay)=>setTimeout(requestRefresh,delay));

  window.inspectEapV232 = () => ({
    version:VERSION,
    visiblePass:visiblePassedResult(),
    report:window.EAP_WORD_V232_REPORT || null,
    progress:mergedProgress(),
    nextLabel:norm($("nextMissionBtn") && $("nextMissionBtn").dataset.eapV232Label)
  });

  console.info("[EAP Word Quest] v232 final progress authority ready",{version:VERSION});
})();
