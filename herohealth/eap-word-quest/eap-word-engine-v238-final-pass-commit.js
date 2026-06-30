/* =========================================================
   EAP Word Quest • Final BG5 Pass Commit
   File: /herohealth/eap-word-quest/eap-word-engine-v238-final-pass-commit.js
   Version: v2.3.8-FINAL-PASS-COMMIT-122

   A completion safeguard for the only 20/20 transition.
   When the visible BG5 Summary is a valid full 24-question pass, commit it
   into the active Core state and the learner's v233 ledger before rendering
   the path. The old Arc card can therefore never remain 19/20 after BG5.

   No fabricated pass: this runs only for BG5 Summary "ผ่านแล้ว!" with a
   24-question score at or above the official 75% mark (18/24).
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.3.8-FINAL-PASS-COMMIT-122";
  const GROUP = "122";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const CORE_PREFIX = "EAP_WORD_QUEST_CORE_V196_STATE";
  const LEDGER_PREFIX = "EAP_WORD_QUEST_VISIBLE_PASS_LEDGER_V233";
  const PRE_FINAL = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15"
  ];
  const ALL = [...PRE_FINAL,"BG5"];

  if (window.__EAP_WORD_V238_FINAL_PASS_COMMIT__) return;
  window.__EAP_WORD_V238_FINAL_PASS_COMMIT__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
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
      console.warn("[EAP Word Quest] v238 could not write completion state", err);
      return false;
    }
  }

  function profileSuffix() {
    const saved = readJson(PROFILE_KEY,{}) || {};
    const input = $("studentIdInput");
    const raw = norm((input && input.value) || saved.studentId || saved.id || "no-id");
    return raw.replace(/[^a-z0-9_-]/gi,"_") || "no-id";
  }

  function summaryFinalResult() {
    const screen = $("summaryScreen");
    if (!screen || !screen.classList.contains("active")) return null;
    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    if (!/^BG5\s+(?:ผ่านแล้ว!|Complete)$/i.test(title)) return null;

    const text = norm($("summaryStats") && $("summaryStats").textContent);
    const pair = text.match(/(\d+)\s*\/\s*(\d+)/);
    const pct = text.match(/(\d+)\s*%/);
    const live = window.EAP_V196_LAST_RESULT || window.EAP_V203_LAST_RESULT || window.EAP_V195_LAST_RESULT || {};
    const sameRun = norm(live.sessionId).toUpperCase() === "BG5";
    const correct = Math.max(0,Math.round(num(sameRun ? live.correct : pair && pair[1],0)));
    const total = Math.max(1,Math.round(num(sameRun ? live.total : pair && pair[2],1)));
    const accuracy = Math.max(0,Math.min(100,Math.round(num(sameRun ? live.accuracy : pct && pct[1],(correct/total)*100))));
    const required = 75;
    const requiredCorrect = 18;

    /* Final completion is valid only on the fixed BG5 24-question round. */
    if (total !== 24 || accuracy < required || correct < requiredCorrect) return null;

    return {
      sessionId:"BG5",
      correct,
      total,
      accuracy,
      score:Math.max(0,Math.round(num(live.score,live.xp))),
      xp:Math.max(0,Math.round(num(live.xp,live.score))),
      maxCombo:Math.max(0,Math.round(num(live.maxCombo))),
      passed:true,
      passThreshold:required,
      lastPlayed:norm(live.playedAt || live.endedAt || new Date().toISOString())
    };
  }

  function passed(state, id) {
    return Boolean(state && state.sessions && state.sessions[id] && state.sessions[id].passed);
  }

  function passCount(state) {
    return ALL.filter((id)=>passed(state,id)).length;
  }

  function candidateCoreKeys() {
    const preferred = `${CORE_PREFIX}_${GROUP}_${profileSuffix()}`;
    const fromProgress = (() => {
      try {
        const progress = typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null;
        return norm(progress && progress.stateKey);
      } catch (err) {
        return "";
      }
    })();
    const keys = [preferred, fromProgress].filter(Boolean);

    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || "";
        if (!key.startsWith(`${CORE_PREFIX}_${GROUP}_`) || keys.includes(key)) continue;
        const state = readJson(key,{});
        /* A 19/20 path is a safe signature for this learner's final transition. */
        if (PRE_FINAL.every((id)=>passed(state,id)) && !passed(state,"BG5")) keys.push(key);
      }
    } catch (err) {}
    return [...new Set(keys)];
  }

  function updateCoreState(key, result) {
    const state = readJson(key,{}) || {};
    state.version = state.version || "v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";
    state.group = GROUP;
    state.coreOnly = true;
    state.sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
    state.recentItemIds = Array.isArray(state.recentItemIds) ? state.recentItemIds.slice(0,36) : [];
    state.weakTargets = state.weakTargets && typeof state.weakTargets === "object" ? state.weakTargets : {};
    state.createdAt = state.createdAt || new Date().toISOString();

    const old = state.sessions.BG5 || {};
    state.sessions.BG5 = Object.assign({},old,{
      played:true,
      passed:true,
      accuracy:Math.max(result.accuracy,Math.round(num(old.accuracy))),
      bestAccuracy:Math.max(result.accuracy,Math.round(num(old.bestAccuracy,old.accuracy))),
      bestScore:Math.max(result.score,Math.round(num(old.bestScore,old.lastScore))),
      lastAccuracy:result.accuracy,
      lastScore:result.score,
      totalAttempts:Math.max(1,Math.round(num(old.totalAttempts,0))),
      lastPlayed:result.lastPlayed
    });
    state.updatedAt = new Date().toISOString();
    return writeJson(key,state) ? state : null;
  }

  function updateLedgerFromKey(coreKey, result) {
    const suffix = coreKey.replace(`${CORE_PREFIX}_${GROUP}_`,"");
    if (!suffix || suffix === coreKey) return false;
    const key = `${LEDGER_PREFIX}_${GROUP}_${suffix}`;
    const ledger = readJson(key,{}) || {};
    const old = ledger.BG5 || {};
    ledger.BG5 = Object.assign({},old,{
      passed:true,
      accuracy:Math.max(result.accuracy,Math.round(num(old.accuracy))),
      bestAccuracy:Math.max(result.accuracy,Math.round(num(old.bestAccuracy,old.accuracy))),
      bestScore:Math.max(result.score,Math.round(num(old.bestScore,old.lastScore))),
      lastAccuracy:result.accuracy,
      lastScore:result.score,
      totalAttempts:Math.max(1,Math.round(num(old.totalAttempts,0))),
      lastPlayed:result.lastPlayed
    });
    return writeJson(key,ledger);
  }

  function commitFinalPass() {
    const result = summaryFinalResult();
    if (!result) return { committed:false, result:null, keys:[], finalState:null };
    const keys = candidateCoreKeys();
    let finalState = null;
    keys.forEach((key) => {
      const before = readJson(key,{});
      /* Update only the active profile key or a true 19/20 candidate. */
      const safe = key === `${CORE_PREFIX}_${GROUP}_${profileSuffix()}` ||
        (PRE_FINAL.every((id)=>passed(before,id)) && !passed(before,"BG5"));
      if (!safe) return;
      const state = updateCoreState(key,result);
      if (state) {
        updateLedgerFromKey(key,result);
        if (!finalState || passCount(state) >= passCount(finalState)) finalState = state;
      }
    });
    const report = { committed:Boolean(finalState), result, keys, completed:finalState ? passCount(finalState) : 0 };
    window.EAP_WORD_V238_REPORT = report;
    return Object.assign(report,{finalState});
  }

  function addStyle() {
    if ($("eapV238FinalStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV238FinalStyle";
    style.textContent = `
      #eapV233Path,#eapV218RecoveryPlan{display:none!important}
      #eapV238FinalPath{margin:12px 0;border:1px solid #86efac;border-radius:16px;padding:15px 16px;background:linear-gradient(135deg,#ecfdf5,#eff6ff);color:#14532d;line-height:1.5;font-weight:850}
      #eapV238FinalPath b{display:block;color:#166534;font-size:19px;margin-bottom:4px}
      #eapV238FinalPath .eap238-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
      #eapV238FinalPath .eap238-chip{display:inline-flex;align-items:center;border:1px solid #86efac;background:#fff;border-radius:999px;padding:5px 9px;color:#166534;font-size:12px;font-weight:950}
      #nextMissionBtn[data-eap-v238-label]{position:relative!important;color:transparent!important;font-size:0!important;line-height:0!important;text-shadow:none!important;min-width:205px!important}
      #nextMissionBtn[data-eap-v238-label]::after{content:attr(data-eap-v238-label)!important;position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:18px!important;font-weight:950!important;line-height:1.15!important;white-space:nowrap!important;pointer-events:none!important}
      @media(max-width:680px){#nextMissionBtn[data-eap-v238-label]{width:100%!important;min-width:0!important}#nextMissionBtn[data-eap-v238-label]::after{font-size:17px!important}}
    `;
    document.head.appendChild(style);
  }

  function renderFinal(report) {
    const screen = $("summaryScreen");
    const root = screen && (screen.querySelector(".summary-card") || screen);
    const button = $("nextMissionBtn");
    if (!root || !button || !report || !report.committed || report.completed < 20) return;

    let card = $("eapV238FinalPath");
    if (!card) {
      card = document.createElement("section");
      card.id = "eapV238FinalPath";
      const actions = root.querySelector(".summary-actions");
      if (actions) actions.insertAdjacentElement("beforebegin",card); else root.appendChild(card);
    }
    card.innerHTML = `
      <b>🏆 EAP Word Quest สำเร็จครบแล้ว!</b>
      คุณผ่านครบ 20/20 ภารกิจ รวม BG5 · Human Override Summit แล้ว<br>
      ความก้าวหน้าถูกบันทึกเรียบร้อย สามารถกลับหน้าแรกเพื่อดูเส้นทางทั้งหมด หรือเปิด Word Deck เพื่อทบทวน Weak Words ได้
      <div class="eap238-chips"><span class="eap238-chip">20/20 Missions</span><span class="eap238-chip">Boss Gates 5/5</span><span class="eap238-chip">Group 122</span></div>`;

    const label = "กลับหน้าหลัก";
    button.dataset.eapV238Label = label;
    button.setAttribute("aria-label",label);
    button.title = "กลับหน้าแรกหลังจบ EAP Word Quest";
  }

  function finalActive() {
    const report = window.EAP_WORD_V238_REPORT || {};
    return Boolean(report.committed && report.completed >= 20 && summaryFinalResult());
  }

  function interceptFinalButton(event) {
    const button = event.target && event.target.closest ? event.target.closest("#nextMissionBtn") : null;
    if (!button || !finalActive()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const home = $("homeBtn");
    if (home) home.click();
  }

  function refresh() {
    queued = false;
    addStyle();
    const report = commitFinalPass();
    renderFinal(report);
  }

  function requestRefresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  }

  document.addEventListener("click",interceptFinalButton,true);
  const observer = new MutationObserver(requestRefresh);
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener("eap-core-run-finished",()=>[0,120,350,800,1500,2500].forEach((delay)=>setTimeout(requestRefresh,delay)));
  document.addEventListener("click",()=>[80,260,620,1200].forEach((delay)=>setTimeout(requestRefresh,delay)),true);
  [0,120,360,800,1500,2400,3600,5000].forEach((delay)=>setTimeout(requestRefresh,delay));

  window.inspectEapV238 = () => ({ version:VERSION, report:window.EAP_WORD_V238_REPORT || null, finalActive:finalActive() });
  console.info("[EAP Word Quest] v238 final-pass commit ready",{version:VERSION});
})();
