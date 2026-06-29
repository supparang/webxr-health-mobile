/* =========================================================
   EAP Word Quest • Progress Truth Enforcer
   File: /herohealth/eap-word-quest/eap-word-engine-v220-progress-truth-enforcer.js
   Version: v2.2.0-PROGRESS-TRUTH-ENFORCER-122

   Protects the learner from a stale summary card after a passed Session.
   The Core controller remains the owner of scoring, gates and selection.
   This guard only reconciles the just-finished passed result into the exact
   state key reported by the Core controller, then renders an authoritative
   Arc card from that same state.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.0-PROGRESS-TRUTH-ENFORCER-122";
  const TOTAL = 20;
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

  if (window.__EAP_WORD_V220_PROGRESS_TRUTH__) return;
  window.__EAP_WORD_V220_PROGRESS_TRUTH__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const esc = (value) => norm(value).replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
  const threshold = (sessionId) => sessionId === "BG5" ? 75 : /^BG/i.test(sessionId) ? 70 : 60;
  const validId = (value) => ORDER.includes(norm(value).toUpperCase());

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
      console.warn("[EAP Word Quest] v220 cannot write progress", err);
      return false;
    }
  }

  function coreProgress() {
    try {
      return typeof window.getEapCoreProgress === "function"
        ? window.getEapCoreProgress()
        : null;
    } catch (err) {
      return null;
    }
  }

  function stateKey() {
    const progress = coreProgress();
    return norm(progress && progress.stateKey);
  }

  function latestResult() {
    return window.EAP_V196_LAST_RESULT ||
      window.EAP_V203_LAST_RESULT ||
      window.EAP_V195_LAST_RESULT ||
      window.EAP_V192_LAST_RESULT ||
      null;
  }

  function normaliseResult(source) {
    const raw = source && typeof source === "object" ? source : {};
    const sessionId = norm(raw.sessionId).toUpperCase();
    const correct = Math.max(0, Math.round(num(raw.correct)));
    const total = Math.max(1, Math.round(num(raw.total, 1)));
    const accuracy = clamp(Math.round(num(raw.accuracy, (correct / total) * 100)), 0, 100);
    return {
      sessionId,
      correct,
      total,
      accuracy,
      score: Math.max(0, Math.round(num(raw.score, raw.xp))),
      passed: Boolean(raw.passed || accuracy >= threshold(sessionId)),
      playedAt: norm(raw.playedAt || raw.endedAt || new Date().toISOString())
    };
  }

  function reconcileLatestPass() {
    const result = normaliseResult(latestResult());
    const key = stateKey();
    if (!result.passed || !validId(result.sessionId) || !key) {
      return { repaired:false, reason:"no_current_pass", result, stateKey:key };
    }

    const state = readJson(key, {}) || {};
    state.version = state.version || "v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";
    state.group = "122";
    state.coreOnly = true;
    state.sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
    state.recentItemIds = Array.isArray(state.recentItemIds) ? state.recentItemIds.slice(0, 36) : [];
    state.weakTargets = state.weakTargets && typeof state.weakTargets === "object" ? state.weakTargets : {};
    state.createdAt = state.createdAt || new Date().toISOString();

    const old = state.sessions[result.sessionId] || {};
    const oldBest = Math.max(0, Math.round(num(old.bestAccuracy, old.accuracy)));
    const oldScore = Math.max(0, Math.round(num(old.bestScore, old.lastScore)));
    const needed = !old.passed || oldBest < result.accuracy || norm(old.lastPlayed) !== result.playedAt;

    if (needed) {
      state.sessions[result.sessionId] = Object.assign({}, old, {
        played:true,
        passed:true,
        accuracy:Math.max(result.accuracy, Math.round(num(old.accuracy))),
        bestAccuracy:Math.max(result.accuracy, oldBest),
        bestScore:Math.max(result.score, oldScore),
        lastAccuracy:result.accuracy,
        lastScore:result.score,
        totalAttempts:Math.max(1, Math.round(num(old.totalAttempts, 0))),
        lastPlayed:result.playedAt
      });
      state.updatedAt = new Date().toISOString();
      writeJson(key, state);
    }

    const report = { repaired:needed, sessionId:result.sessionId, accuracy:result.accuracy, stateKey:key };
    window.EAP_WORD_V220_RECONCILE = report;
    return report;
  }

  function titleFor(sessionId) {
    try {
      if (/^BG/i.test(sessionId) && typeof window.getEapCoreBoss === "function") {
        const boss = window.getEapCoreBoss(sessionId);
        if (boss && boss.title) return boss.title;
      }
      if (typeof window.getEapCoreSession === "function") {
        const session = window.getEapCoreSession(sessionId);
        if (session && session.title) return session.title;
      }
    } catch (err) {
      // Keep a compact fallback below.
    }
    return sessionId;
  }

  function activeArc(state) {
    const passed = (id) => Boolean(state && state.sessions && state.sessions[id] && state.sessions[id].passed);
    return ARCS.find((arc) => !arc.sessions.every(passed) || !passed(arc.boss)) || ARCS[ARCS.length - 1];
  }

  function pathModel() {
    const key = stateKey();
    const state = key ? readJson(key, {}) : {};
    const progress = coreProgress() || { passed:0, total:TOTAL, percent:0, next:"S1" };
    const arc = activeArc(state);
    const passed = (id) => Boolean(state && state.sessions && state.sessions[id] && state.sessions[id].passed);
    const doneSessions = arc.sessions.filter(passed);
    const pending = arc.sessions.filter((id) => !passed(id));
    const bossPassed = passed(arc.boss);
    const next = norm(progress.next || "DONE") || "DONE";
    return { state, progress, arc, doneSessions, pending, bossPassed, next };
  }

  function addStyle() {
    if ($("eapV220ProgressTruthStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV220ProgressTruthStyle";
    style.textContent = `
      #eapV203PathBox{display:none!important}
      #eapV220PathTruth{margin:12px 0;border:1px solid #c7d2fe;border-radius:16px;padding:12px 14px;background:#f8faff;color:#312e81;line-height:1.5;font-weight:850}
      #eapV220PathTruth b{color:#3730a3}
      #eapV220PathTruth .eap220-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      #eapV220PathTruth .eap220-chip{display:inline-flex;align-items:center;border:1px solid #c7d2fe;background:#fff;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:950;color:#3730a3}
      #eapV220PathTruth .eap220-chip.good{border-color:#bbf7d0;color:#166534}
    `;
    document.head.appendChild(style);
  }

  function renderTruthPath() {
    addStyle();
    const screen = $("summaryScreen");
    const root = screen && screen.classList.contains("active")
      ? screen.querySelector(".summary-card") || screen
      : null;
    if (!root) return;

    const model = pathModel();
    const result = normaliseResult(latestResult());
    const nextTitle = model.next === "DONE" ? "ครบทุกภารกิจแล้ว" : titleFor(model.next);
    const missing = model.pending.map((id) => `${id} · ${titleFor(id)}`);
    const arcLine = model.bossPassed
      ? `${model.arc.title} ผ่าน Vocabulary Boss แล้ว`
      : `Arc นี้ผ่านแล้ว ${model.doneSessions.length}/${model.arc.sessions.length} Session`;
    const unlockLine = model.bossPassed
      ? "ระบบเปิด Arc ถัดไปแล้ว"
      : missing.length
        ? `ยังต้องผ่าน ${missing.join(" และ ")} เพื่อปลดล็อก ${model.arc.boss} · ${titleFor(model.arc.boss)}`
        : `ผ่าน Session ครบแล้ว เหลือ ${model.arc.boss} · ${titleFor(model.arc.boss)} เพื่อปลดล็อก Arc ถัดไป`;

    let box = $("eapV220PathTruth");
    if (!box) {
      box = document.createElement("section");
      box.id = "eapV220PathTruth";
      const actions = root.querySelector(".summary-actions");
      if (actions) actions.insertAdjacentElement("beforebegin", box);
      else root.appendChild(box);
    }

    const signature = [
      result.sessionId,
      model.progress.passed,
      model.progress.next,
      model.arc.id,
      model.doneSessions.join(","),
      model.bossPassed
    ].join("|");
    if (box.dataset.eapV220Signature !== signature) {
      box.dataset.eapV220Signature = signature;
      box.innerHTML = `
        <b>เส้นทาง Vocabulary Arc</b><br>
        ${esc(arcLine)} • ความก้าวหน้ารวม ${esc(model.progress.passed)}/${esc(model.progress.total || TOTAL)} (${esc(model.progress.percent)}%)<br>
        ${esc(unlockLine)}
        <div class="eap220-row">
          <span class="eap220-chip good">สถานะสะสม: ${esc(result.sessionId)} ${model.state.sessions && model.state.sessions[result.sessionId] && model.state.sessions[result.sessionId].passed ? "ผ่านแล้ว" : "ยังไม่ผ่าน"}</span>
          <span class="eap220-chip">ภารกิจที่ควรทำต่อ: ${model.next === "DONE" ? "ครบแล้ว" : `${esc(model.next)} · ${esc(nextTitle)}`}</span>
        </div>`;
    }

    const nextButton = $("nextMissionBtn");
    if (nextButton) {
      const label = model.next === "DONE" ? "สรุปผลการเรียน" : `ไปทำ ${model.next} ต่อ`;
      if (nextButton.textContent !== label) nextButton.textContent = label;
      nextButton.title = model.next === "DONE" ? "ครบทุก Vocabulary Mission แล้ว" : `${model.next} · ${nextTitle}`;
    }
  }

  function syncAndRender() {
    reconcileLatestPass();
    renderTruthPath();
  }

  window.addEventListener("eap-core-run-finished", () => {
    [0, 80, 240, 560, 1000].forEach((delay) => setTimeout(syncAndRender, delay));
  });
  document.addEventListener("click", () => [120, 350, 760].forEach((delay) => setTimeout(syncAndRender, delay)), true);
  [160, 520, 1100, 1800].forEach((delay) => setTimeout(syncAndRender, delay));
  setInterval(syncAndRender, 900);

  window.inspectEapV220 = () => {
    const reconcile = reconcileLatestPass();
    const model = pathModel();
    return {
      version:VERSION,
      reconcile,
      progress:model.progress,
      activeArc:model.arc.id,
      doneSessions:model.doneSessions,
      next:model.next
    };
  };

  console.info("[EAP Word Quest] v220 progress truth enforcer ready", { version:VERSION });
})();
