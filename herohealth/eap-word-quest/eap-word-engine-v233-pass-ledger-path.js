/* =========================================================
   EAP Word Quest • Pass Ledger + Path Authority
   File: /herohealth/eap-word-quest/eap-word-engine-v233-pass-ledger-path.js
   Version: v2.3.3-PASS-LEDGER-PATH-122

   Why this exists:
   Earlier summary helpers could read a stale Core snapshot while another
   helper was refreshing the same Summary. This runtime keeps one compact,
   learner-scoped pass ledger, mirrors that ledger into the exact Core state
   key used by v196, and renders the Arc Path from the merged truth.

   It never invents a result: a ledger entry is accepted only when the visible
   Summary says “ผ่านแล้ว!” and its displayed score meets the official mark.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.3.3-PASS-LEDGER-PATH-122";
  const GROUP = "122";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const CORE_PREFIX = "EAP_WORD_QUEST_CORE_V196_STATE";
  const LEDGER_PREFIX = "EAP_WORD_QUEST_VISIBLE_PASS_LEDGER_V233";
  const ORDER = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];
  const ARCS = [
    { id:"ARC1", title:"Foundation Arc", sessions:["S1","S2","S3"], boss:"BG1" },
    { id:"ARC2", title:"Evidence Arc", sessions:["S4","S5","S6"], boss:"BG2" },
    { id:"ARC3", title:"Academic Writing Arc", sessions:["S7","S8","S9"], boss:"BG3" },
    { id:"ARC4", title:"Professional Academic Communication", sessions:["S10","S11","S12"], boss:"BG4" },
    { id:"ARC5", title:"Global Academic Communication", sessions:["S13","S14","S15"], boss:"BG5" }
  ];

  if (window.__EAP_WORD_V233_PASS_LEDGER_PATH__) return;
  window.__EAP_WORD_V233_PASS_LEDGER_PATH__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const esc = (value) => norm(value).replace(/[&<>"']/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const threshold = (id) => id === "BG5" ? 75 : /^BG/i.test(id) ? 70 : 60;
  let queued = false;
  let baseProgress = null;

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
      console.warn("[EAP Word Quest] v233 local state write skipped", err);
      return false;
    }
  }

  function profileId() {
    const saved = readJson(PROFILE_KEY,{}) || {};
    const input = $("studentIdInput");
    const id = norm((input && input.value) || saved.studentId || saved.id || "no-id");
    return id.replace(/[^a-z0-9_-]/gi,"_") || "no-id";
  }

  function coreStateKey() {
    return `${CORE_PREFIX}_${GROUP}_${profileId()}`;
  }

  function ledgerKey() {
    return `${LEDGER_PREFIX}_${GROUP}_${profileId()}`;
  }

  function emptyState() {
    return {
      version:"v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122",
      group:GROUP,
      coreOnly:true,
      sessions:{},
      recentItemIds:[],
      weakTargets:{},
      createdAt:new Date().toISOString()
    };
  }

  function screenSummary() {
    const screen = $("summaryScreen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function visiblePass() {
    if (!screenSummary()) return null;
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
    const correct = Math.max(0,Math.round(num(sameRun ? live.correct : pair && pair[1],0)));
    const total = Math.max(1,Math.round(num(sameRun ? live.total : pair && pair[2],1)));
    const accuracy = Math.max(0,Math.min(100,Math.round(num(
      sameRun ? live.accuracy : pct && pct[1],
      (correct / total) * 100
    ))));
    const passAt = threshold(sessionId);
    if (accuracy < passAt || correct < Math.ceil(total * passAt / 100)) return null;

    return {
      sessionId,
      correct,
      total,
      accuracy,
      score:Math.max(0,Math.round(num(live.score,live.xp))),
      xp:Math.max(0,Math.round(num(live.xp,live.score))),
      maxCombo:Math.max(0,Math.round(num(live.maxCombo))),
      passed:true,
      passThreshold:passAt,
      playedAt:norm(live.playedAt || live.endedAt || new Date().toISOString())
    };
  }

  function readLedger() {
    const ledger = readJson(ledgerKey(),{});
    return ledger && typeof ledger === "object" ? ledger : {};
  }

  function recordVisiblePass() {
    const result = visiblePass();
    if (!result) return null;
    const ledger = readLedger();
    const old = ledger[result.sessionId] || {};
    ledger[result.sessionId] = {
      passed:true,
      accuracy:Math.max(result.accuracy,Math.round(num(old.accuracy))),
      bestAccuracy:Math.max(result.accuracy,Math.round(num(old.bestAccuracy,old.accuracy))),
      bestScore:Math.max(result.score,Math.round(num(old.bestScore,old.lastScore))),
      lastAccuracy:result.accuracy,
      lastScore:result.score,
      totalAttempts:Math.max(1,Math.round(num(old.totalAttempts,0))),
      lastPlayed:result.playedAt
    };
    writeJson(ledgerKey(),ledger);
    window.EAP_WORD_V233_VISIBLE_PASS = result;
    return result;
  }

  function mergedState() {
    const state = readJson(coreStateKey(),emptyState()) || emptyState();
    state.version = state.version || "v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";
    state.group = GROUP;
    state.coreOnly = true;
    state.sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
    state.recentItemIds = Array.isArray(state.recentItemIds) ? state.recentItemIds.slice(0,36) : [];
    state.weakTargets = state.weakTargets && typeof state.weakTargets === "object" ? state.weakTargets : {};
    state.createdAt = state.createdAt || new Date().toISOString();

    const ledger = readLedger();
    Object.entries(ledger).forEach(([sessionId,row]) => {
      if (!ORDER.includes(sessionId) || !row || !row.passed) return;
      const old = state.sessions[sessionId] || {};
      state.sessions[sessionId] = Object.assign({},old,{
        played:true,
        passed:true,
        accuracy:Math.max(Math.round(num(row.accuracy)),Math.round(num(old.accuracy))),
        bestAccuracy:Math.max(Math.round(num(row.bestAccuracy,row.accuracy)),Math.round(num(old.bestAccuracy,old.accuracy))),
        bestScore:Math.max(Math.round(num(row.bestScore,row.lastScore)),Math.round(num(old.bestScore,old.lastScore))),
        lastAccuracy:old.lastAccuracy == null ? Math.round(num(row.lastAccuracy,row.accuracy)) : Math.round(num(old.lastAccuracy)),
        lastScore:old.lastScore == null ? Math.round(num(row.lastScore)) : Math.round(num(old.lastScore)),
        totalAttempts:Math.max(1,Math.round(num(old.totalAttempts,0))),
        lastPlayed:old.lastPlayed || norm(row.lastPlayed)
      });
    });
    state.updatedAt = new Date().toISOString();
    return state;
  }

  function syncCoreState() {
    recordVisiblePass();
    const state = mergedState();
    const saved = writeJson(coreStateKey(),state);
    window.EAP_WORD_V233_SYNC = {
      saved,
      stateKey:coreStateKey(),
      ledgerKey:ledgerKey(),
      passed:ORDER.filter((id)=>Boolean(state.sessions[id] && state.sessions[id].passed)).length
    };
    return state;
  }

  function passed(state,id) {
    return Boolean(state && state.sessions && state.sessions[id] && state.sessions[id].passed);
  }

  function unlocked(state,id) {
    const arcIndex = ARCS.findIndex((arc)=>arc.sessions.includes(id) || arc.boss === id);
    if (arcIndex < 0) return true;
    if (arcIndex > 0 && !passed(state,ARCS[arcIndex - 1].boss)) return false;
    const arc = ARCS[arcIndex];
    return arc.boss !== id || arc.sessions.every((sessionId)=>passed(state,sessionId));
  }

  function progressFrom(state) {
    const count = ORDER.filter((id)=>passed(state,id)).length;
    const next = ORDER.find((id)=>unlocked(state,id) && !passed(state,id)) || "DONE";
    return { passed:count,total:ORDER.length,percent:Math.round((count/ORDER.length)*100),next,stateKey:coreStateKey() };
  }

  function titleFor(id) {
    try {
      if (/^BG/i.test(id) && typeof window.getEapCoreBoss === "function") return (window.getEapCoreBoss(id) || {}).title || id;
      if (typeof window.getEapCoreSession === "function") return (window.getEapCoreSession(id) || {}).title || id;
    } catch (err) {}
    return id;
  }

  function activeArc(state) {
    return ARCS.find((arc)=>!arc.sessions.every((id)=>passed(state,id)) || !passed(state,arc.boss)) || ARCS[ARCS.length - 1];
  }

  function addStyle() {
    if ($("eapV233Style")) return;
    const style = document.createElement("style");
    style.id = "eapV233Style";
    style.textContent = `
      #eapV203PathBox,#eapV220PathTruth{display:none!important}
      #eapV233Path{margin:12px 0;border:1px solid #c7d2fe;border-radius:16px;padding:12px 14px;background:#f8faff;color:#312e81;line-height:1.5;font-weight:850}
      #eapV233Path b{color:#3730a3}
      #eapV233Path .eap233-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      #eapV233Path .eap233-chip{display:inline-flex;align-items:center;border:1px solid #c7d2fe;background:#fff;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:950;color:#3730a3}
      #eapV233Path .good{border-color:#bbf7d0;color:#166534}
      #nextMissionBtn[data-eap-v233-label]{position:relative!important;color:transparent!important;font-size:0!important;line-height:0!important;text-shadow:none!important;min-width:205px!important}
      #nextMissionBtn[data-eap-v233-label]::after{content:attr(data-eap-v233-label)!important;position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:18px!important;font-weight:950!important;line-height:1.15!important;white-space:nowrap!important;pointer-events:none!important}
      @media(max-width:680px){#nextMissionBtn[data-eap-v233-label]{width:100%!important;min-width:0!important}#nextMissionBtn[data-eap-v233-label]::after{font-size:17px!important}}
    `;
    document.head.appendChild(style);
  }

  function renderPath() {
    const root = screenSummary() && ($("summaryScreen").querySelector(".summary-card") || $("summaryScreen"));
    if (!root) return;
    const state = syncCoreState();
    const progress = progressFrom(state);
    const arc = activeArc(state);
    const done = arc.sessions.filter((id)=>passed(state,id));
    const missing = arc.sessions.filter((id)=>!passed(state,id));
    const bossDone = passed(state,arc.boss);
    const visible = visiblePass();
    let box = $("eapV233Path");
    if (!box) {
      box = document.createElement("section");
      box.id = "eapV233Path";
      const actions = root.querySelector(".summary-actions");
      if (actions) actions.insertAdjacentElement("beforebegin",box); else root.appendChild(box);
    }
    const line = bossDone ? `${arc.title} ผ่าน Vocabulary Boss แล้ว` : `Arc นี้ผ่านแล้ว ${done.length}/${arc.sessions.length} Session`;
    const detail = bossDone
      ? "ระบบเปิด Arc ถัดไปแล้ว"
      : missing.length
        ? `ยังต้องผ่าน ${missing.map((id)=>`${id} · ${titleFor(id)}`).join(" และ ")} เพื่อปลดล็อก ${arc.boss} · ${titleFor(arc.boss)}`
        : `ผ่าน Session ครบแล้ว เหลือ ${arc.boss} · ${titleFor(arc.boss)} เพื่อปลดล็อก Arc ถัดไป`;
    box.innerHTML = `
      <b>เส้นทาง Vocabulary Arc</b><br>
      ${esc(line)} • ความก้าวหน้ารวม ${progress.passed}/${progress.total} (${progress.percent}%)<br>
      ${esc(detail)}
      <div class="eap233-row">
        <span class="eap233-chip good">สถานะสะสม: ${esc(visible ? `${visible.sessionId} ผ่านแล้ว` : "บันทึกความก้าวหน้าแล้ว")}</span>
        <span class="eap233-chip">ภารกิจที่ควรทำต่อ: ${progress.next === "DONE" ? "ครบแล้ว" : `${esc(progress.next)} · ${esc(titleFor(progress.next))}`}</span>
      </div>`;

    const nextButton = $("nextMissionBtn");
    if (nextButton && progress.next !== "DONE") {
      const label = `ไปทำ ${progress.next} ต่อ`;
      nextButton.dataset.eapV233Label = label;
      nextButton.setAttribute("aria-label",label);
      nextButton.title = `ไปยังภารกิจถัดไป ${progress.next}`;
    }
  }

  function installProgressFacade() {
    if (!baseProgress && typeof window.getEapCoreProgress === "function") baseProgress = window.getEapCoreProgress;
    if (!baseProgress || window.getEapCoreProgress === eapV233Progress) return;
    window.getEapCoreProgress = eapV233Progress;
  }

  function eapV233Progress() {
    const original = (()=>{ try { return baseProgress ? baseProgress() : {}; } catch (err) { return {}; } })();
    const state = syncCoreState();
    return Object.assign({},original,progressFrom(state));
  }

  function refresh() {
    queued = false;
    installProgressFacade();
    addStyle();
    renderPath();
  }

  function requestRefresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  }

  const observer = new MutationObserver(requestRefresh);
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener("eap-core-run-finished",()=>[0,100,280,650,1200].forEach((delay)=>setTimeout(requestRefresh,delay)));
  document.addEventListener("click",()=>[80,250,620,1100].forEach((delay)=>setTimeout(requestRefresh,delay)),true);
  [0,100,300,700,1400,2400,3600].forEach((delay)=>setTimeout(requestRefresh,delay));

  window.inspectEapV233 = () => {
    const state = syncCoreState();
    return {
      version:VERSION,
      stateKey:coreStateKey(),
      ledgerKey:ledgerKey(),
      visiblePass:visiblePass(),
      ledger:readLedger(),
      progress:progressFrom(state)
    };
  };

  console.info("[EAP Word Quest] v233 pass ledger path ready",{version:VERSION});
})();
