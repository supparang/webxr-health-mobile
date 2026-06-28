/* =========================================================
   EAP Word Quest • Core Truth + Progress Controller
   File: /herohealth/eap-word-quest/eap-word-engine-v196-core-compact-progress-controller.js
   Version: v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122

   Requires:
   - eap-core-vocabulary-map-v189.js
   - eap-word-data-v191-core-aligned-bank.js
   - eap-word-engine-v195-core-ai-student-scoped.js (recommended)

   Role:
   - Force Student play to use the Core-Aligned Question Bank
   - Keep Arc gating: S sessions within an Arc are flexible; Boss opens after all Arc sessions pass
   - Use anti-repeat selection, weak-word recovery, difficulty-aware item picking
   - Log results for Teacher Dashboard / CSV
   - Preserve local-only workflow; no external API
========================================================= */

(() => {
  "use strict";

  const VERSION = "v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";
  const GROUP = "122";

  if (window.__EAP_WORD_V196_CORE_CONTROLLER__) {
    console.info("[EAP Word Quest] v196 core controller already loaded");
    return;
  }
  window.__EAP_WORD_V196_CORE_CONTROLLER__ = true;

  const STATE_KEY_PREFIX = "EAP_WORD_QUEST_CORE_V196_STATE";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";

  const SESSION_ORDER = [
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

  const BOSS_IDS = new Set(["BG1","BG2","BG3","BG4","BG5"]);

  let run = null;

  function $(id){ return document.getElementById(id); }

  function norm(v){ return String(v == null ? "" : v).replace(/\s+/g," ").trim(); }

  function num(v, fallback = 0){
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

  function escapeHtml(v){
    return String(v == null ? "" : v)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function readJson(key,fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(err){
      return fallback;
    }
  }

  function writeJson(key,value){
    try{
      localStorage.setItem(key,JSON.stringify(value));
      return true;
    }catch(err){
      console.warn("[EAP Word Quest] Cannot write localStorage",key,err);
      return false;
    }
  }

  function hasCoreBank(){
    return Boolean(
      window.EAP_CORE_VOCAB_MAP &&
      window.EAP_CORE_QUESTION_BANK &&
      typeof window.getEapCoreBankItems === "function"
    );
  }

  function getSession(sessionId){
    if (BOSS_IDS.has(sessionId) && typeof window.getEapCoreBoss === "function") {
      const boss = window.getEapCoreBoss(sessionId);
      if (boss) {
        return {
          id: sessionId,
          title: boss.title || sessionId,
          arcId: boss.arcId || "",
          arcTitle: boss.arcTitle || "Boss Gate",
          mission: boss.mission || "Boss Gate",
          skillFocus: boss.skillFocus || "integrated vocabulary application",
          sourceSessions: boss.sourceSessions || []
        };
      }
    }
    if (typeof window.getEapCoreSession === "function") {
      return window.getEapCoreSession(sessionId) || null;
    }
    return null;
  }

  function sessionTitle(sessionId){
    const s = getSession(sessionId);
    return s ? (s.title || sessionId) : sessionId;
  }

  function arcForSession(sessionId){
    return ARCS.find(arc => arc.sessions.includes(sessionId) || arc.boss === sessionId) || ARCS[0];
  }

  function threshold(sessionId){
    if (sessionId === "BG5") return 75;
    if (BOSS_IDS.has(sessionId)) return 70;
    return 60;
  }

  function defaultRoundSize(sessionId){
    if (sessionId === "BG5") return 24;
    if (BOSS_IDS.has(sessionId)) return 18;
    const sel = $("roundSizeSelect");
    return clamp(num(sel && sel.value,12),8,24);
  }

  function passStatus(acc){
    if (acc >= 90) return "Vocabulary Mastery";
    if (acc >= 75) return "Vocabulary Strong";
    if (acc >= 60) return "Vocabulary Ready";
    return "Keep Practicing";
  }

  function displayStatus(acc, passed){
    if (!passed) return "Needs Review";
    if (acc >= 90) return "Mastery";
    if (acc >= 75) return "Strong";
    return "Ready";
  }

  function readProfile(){
    const stored = readJson(PROFILE_KEY,{}) || {};
    const studentName = norm(($("studentNameInput") && $("studentNameInput").value) || stored.studentName || stored.name || "Hero");
    const studentId = norm(($("studentIdInput") && $("studentIdInput").value) || stored.studentId || stored.id || "no-id");
    const section = norm(($("sectionInput") && $("sectionInput").value) || stored.section || stored.group || GROUP) || GROUP;
    return { studentName, studentId, section, group:GROUP };
  }

  function saveProfile(){
    const p = readProfile();
    writeJson(PROFILE_KEY,p);
    const status = $("profileStatus");
    if (status) status.textContent = `บันทึกแล้ว: ${p.studentName} / ${p.studentId} / Group ${GROUP}`;
    toast("Profile saved");
    return p;
  }

  function coreStateKey(){
    const p = readProfile();
    const id = norm(p.studentId || "anon").replace(/[^a-z0-9_-]/gi,"_") || "anon";
    return `${STATE_KEY_PREFIX}_${GROUP}_${id}`;
  }

  /*
    V196 keeps local state intentionally tiny. Detailed attempts live in the
    learning log; this state only controls Core unlocks, weak targets, and
    anti-repeat memory. That avoids localStorage quota exhaustion.
  */
  function blankState(){
    return {
      version: VERSION,
      group: GROUP,
      coreOnly: true,
      sessions: {},
      recentItemIds: [],
      weakTargets: {},
      createdAt: new Date().toISOString()
    };
  }

  function compactSession(row){
    const source = row && typeof row === "object" ? row : {};
    return {
      played: Boolean(source.played),
      passed: Boolean(source.passed),
      accuracy: clamp(Math.round(num(source.accuracy,0)),0,100),
      bestAccuracy: clamp(Math.round(num(source.bestAccuracy,source.accuracy)),0,100),
      bestScore: Math.max(0,Math.round(num(source.bestScore,source.lastScore))),
      lastAccuracy: clamp(Math.round(num(source.lastAccuracy,source.accuracy)),0,100),
      lastScore: Math.max(0,Math.round(num(source.lastScore,0))),
      totalAttempts: Math.max(0,Math.round(num(source.totalAttempts,0))),
      lastPlayed: norm(source.lastPlayed)
    };
  }

  function compactState(input){
    const source = input && typeof input === "object" ? input : {};
    const sessions = {};
    Object.entries(source.sessions || {}).forEach(([sessionId,row]) => {
      if (!SESSION_ORDER.includes(sessionId)) return;
      sessions[sessionId] = compactSession(row);
    });

    const weakRows = Object.entries(source.weakTargets || {})
      .map(([key,row]) => ({ key, row: row && typeof row === "object" ? row : {} }))
      .filter(({row}) => norm(row.term))
      .sort((a,b) => num(b.row.count) - num(a.row.count) || String(b.row.lastAt || "").localeCompare(String(a.row.lastAt || "")))
      .slice(0,40);
    const weakTargets = {};
    weakRows.forEach(({key,row}) => {
      weakTargets[key] = {
        term: norm(row.term).slice(0,80),
        sessionId: norm(row.sessionId).slice(0,12),
        sourceSessionId: norm(row.sourceSessionId || row.sessionId).slice(0,12),
        count: Math.max(1,Math.round(num(row.count,1))),
        lastAt: norm(row.lastAt)
      };
    });

    return {
      version: VERSION,
      group: GROUP,
      coreOnly: true,
      sessions,
      recentItemIds: Array.isArray(source.recentItemIds) ? source.recentItemIds.filter(Boolean).slice(0,36) : [],
      weakTargets,
      createdAt: source.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function readState(){
    const key = coreStateKey();
    const existing = readJson(key,null);
    const base = compactState(existing || blankState());
    return base;
  }

  function writeState(state){
    const compact = compactState(state);
    return writeJson(coreStateKey(),compact);
  }

  /* V196 deliberately ignores legacy bank results. Only core-aligned runs may unlock the Core path. */
  function bestRecord(sessionId){
    const state = readState();
    const core = state.sessions[sessionId];
    return core && core.played ? core : null;
  }

  function isPassed(sessionId){
    const r = bestRecord(sessionId);
    return Boolean(r && r.passed);
  }

  function isArcUnlocked(arcIndex){
    if (arcIndex <= 0) return true;
    const prev = ARCS[arcIndex - 1];
    return isPassed(prev.boss);
  }

  function isSessionUnlocked(sessionId){
    const arcIndex = ARCS.findIndex(arc => arc.sessions.includes(sessionId) || arc.boss === sessionId);
    if (arcIndex < 0) return true;
    if (!isArcUnlocked(arcIndex)) return false;

    const arc = ARCS[arcIndex];
    if (arc.boss === sessionId) {
      return arc.sessions.every(isPassed);
    }
    return true;
  }

  function completedCount(){
    return SESSION_ORDER.filter(isPassed).length;
  }

  function nextMission(){
    return SESSION_ORDER.find(id => isSessionUnlocked(id) && !isPassed(id)) || "DONE";
  }

  function levelRank(level){
    return ({"A2":1,"A2+":2,"B1":3,"B1+":4})[level] || 2;
  }

  function policyDifficulty(){
    if (typeof window.getEapCoreAiPolicy === "function") {
      const p = window.getEapCoreAiPolicy();
      if (p && p.difficulty) return p.difficulty;
    }
    return "A2+";
  }

  function shuffle(rows, seedPrefix = ""){
    const seed = `${seedPrefix}|${Date.now()}|${Math.random()}`;
    return rows.slice().map((item,idx) => ({
      item,
      rank: hash(`${seed}|${idx}|${item.id || item.text || ""}`)
    })).sort((a,b) => a.rank - b.rank).map(row => row.item);
  }

  function hash(text){
    let h = 2166136261;
    String(text || "").split("").forEach(ch => {
      h ^= ch.charCodeAt(0);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    });
    return Math.abs(h >>> 0);
  }

  function targetKey(term){ return norm(term).toLowerCase().replace(/[’']/g,"").replace(/…/g,""); }

  function weakTermsFor(sessionId){
    const state = readState();
    const rows = Object.values(state.weakTargets || {})
      .filter(row => sessionId === "ALL" || row.sessionId === sessionId || row.sourceSessionId === sessionId)
      .sort((a,b) => num(b.count) - num(a.count));

    if (typeof window.getEapCoreWeakTargets === "function") {
      try{
        const aiRows = window.getEapCoreWeakTargets(sessionId,8) || [];
        aiRows.forEach(row => rows.push(row));
      }catch(err){}
    }

    const seen = new Set();
    return rows.map(row => norm(row.term || row.target || row.word)).filter(term => {
      const k = targetKey(term);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0,12);
  }

  function recordWeak(item){
    const state = readState();
    const term = norm(item.target || item.answerTerm);
    if (!term) return;
    const k = `${item.sessionId || run.sessionId}|${targetKey(term)}`;
    const old = state.weakTargets[k] || {
      term,
      sessionId: item.sessionId || run.sessionId,
      sourceSessionId: item.sourceSessionId || item.sessionId || run.sessionId,
      count:0
    };
    old.count += 1;
    old.lastAt = new Date().toISOString();
    state.weakTargets[k] = old;
    writeState(state);
  }

  function markRecent(itemId){
    const state = readState();
    state.recentItemIds = [itemId, ...state.recentItemIds.filter(id => id !== itemId)].slice(0,36);
    writeState(state);
  }

  function itemPool(sessionId, mode = "normal"){
    if (!hasCoreBank()) return [];
    let rows = window.getEapCoreBankItems(sessionId) || [];

    if (mode === "weak") {
      const weak = new Set(weakTermsFor(sessionId).map(targetKey));
      const focused = rows.filter(item => weak.has(targetKey(item.target)) || weak.has(targetKey(item.answerTerm)));
      if (focused.length >= 4) rows = focused;
    }

    const state = readState();
    const recent = new Set(state.recentItemIds || []);
    const fresh = rows.filter(item => !recent.has(item.id));
    if (fresh.length >= Math.min(8, rows.length)) rows = fresh;

    const desired = policyDifficulty();
    const desiredRank = levelRank(desired);
    const close = rows.filter(item => Math.abs(levelRank(item.level) - desiredRank) <= 1);
    if (close.length >= Math.min(8, rows.length)) rows = close;

    if (BOSS_IDS.has(sessionId)) {
      return shuffle(rows,`${sessionId}|boss`);
    }

    const core = rows.filter(item => item.targetBand === "core");
    const chunk = rows.filter(item => item.targetBand === "chunk");
    const stretch = rows.filter(item => item.targetBand === "stretch" || item.level === "B1+");
    const mixed = [
      ...shuffle(core,`${sessionId}|core`).slice(0,8),
      ...shuffle(chunk,`${sessionId}|chunk`).slice(0,4),
      ...shuffle(stretch,`${sessionId}|stretch`).slice(0,3),
      ...shuffle(rows,`${sessionId}|rest`)
    ];

    const seen = new Set();
    return mixed.filter(item => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function selectRoundItems(sessionId, mode = "normal"){
    const size = defaultRoundSize(sessionId);
    const rows = itemPool(sessionId, mode);
    const wanted = BOSS_IDS.has(sessionId) ? Math.min(rows.length, defaultRoundSize(sessionId)) : Math.min(rows.length, size);
    return rows.slice(0,wanted);
  }

  function showScreen(id){
    document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
    const target = $(id);
    if (target) {
      target.hidden = false;
      target.style.display = "";
      target.classList.add("active");
    }
  }

  function toast(message){
    const t = $("toast");
    if (!t) return;
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { t.hidden = true; }, 2000);
  }

  function injectStyle(){
    if ($("eapV195Style")) return;
    const style = document.createElement("style");
    style.id = "eapV195Style";
    style.textContent = `
      .eap192-core-badge{
        display:inline-flex;align-items:center;gap:6px;border:1px solid #bbf7d0;background:#ecfdf5;color:#047857;
        border-radius:999px;padding:7px 10px;font-weight:950;font-size:12px;margin-left:8px;
      }
      .eap192-session-card{
        border:1px solid #dbe4f0;background:#fff;border-radius:20px;padding:16px;min-height:170px;
        box-shadow:0 12px 30px rgba(15,23,42,.06);display:flex;flex-direction:column;gap:10px;position:relative;overflow:hidden;
      }
      .eap192-session-card.locked{opacity:.55;filter:grayscale(.2)}
      .eap192-session-card.passed{border-color:#bbf7d0;background:linear-gradient(180deg,#fff,#ecfdf5)}
      .eap192-session-card.boss{border-color:#c7d2fe;background:linear-gradient(180deg,#fff,#eef2ff)}
      .eap192-card-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .eap192-card-top h3{margin:0;font-size:17px;line-height:1.22}
      .eap192-card-top p{margin:4px 0 0;color:#64748b;font-weight:800;font-size:13px;line-height:1.35}
      .eap192-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}
      .eap192-tag{display:inline-flex;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:950}
      .eap192-tag.good{background:#ecfdf5;border-color:#bbf7d0;color:#047857}.eap192-tag.warn{background:#fff7ed;border-color:#fed7aa;color:#c2410c}.eap192-tag.ai{background:#eef2ff;border-color:#c7d2fe;color:#3730a3}
      .eap192-start{margin-top:4px;width:100%}
      #choicesEl .eap192-choice{position:relative;text-align:left;justify-content:flex-start;min-height:58px;line-height:1.35}
      #choicesEl .eap192-choice.correct{border-color:#bbf7d0!important;background:#ecfdf5!important;color:#047857!important}
      #choicesEl .eap192-choice.wrong{border-color:#fecaca!important;background:#fef2f2!important;color:#b91c1c!important}
      #choicesEl .eap192-choice.reveal{border-color:#bbf7d0!important;background:#f0fdf4!important}
      .eap192-feedback-good{color:#047857}.eap192-feedback-bad{color:#b91c1c}
      .eap192-summary-box{border:1px solid #dbe4f0;border-radius:18px;background:#fff;padding:14px;margin-top:12px;line-height:1.5;font-weight:780}
      .eap192-summary-box b{font-weight:950}.eap192-small{color:#64748b;font-size:13px;font-weight:800}
      .eap192-boss-hp{height:10px;background:#fee2e2;border-radius:999px;overflow:hidden;margin-top:8px}.eap192-boss-hp i{display:block;height:100%;background:linear-gradient(90deg,#ef4444,#f97316);width:100%}
      @media(max-width:720px){.eap192-session-card{min-height:auto}.eap192-card-top{display:block}}
    `;
    document.head.appendChild(style);
  }

  function renderHomeStats(){
    const box = $("homeStats");
    if (!box) return;
    const state = readState();
    const done = completedCount();
    const corePlayed = Object.values(state.sessions || {}).filter(s => s && s.played).length;
    const passed = SESSION_ORDER.filter(isPassed).length;
    const accs = Object.values(state.sessions || {}).filter(s => s && s.played).map(s => num(s.accuracy));
    const avg = accs.length ? Math.round(accs.reduce((a,b)=>a+b,0)/accs.length) : 0;
    const weakCount = Object.keys(state.weakTargets || {}).length;

    box.innerHTML = `
      <div class="stat"><b>${done}/20</b><span>Mission Progress</span></div>
      <div class="stat good"><b>${passed}</b><span>Passed Missions</span></div>
      <div class="stat"><b>${avg}%</b><span>Core Bank Avg</span></div>
      <div class="stat warn"><b>${weakCount}</b><span>Weak Targets</span></div>
      <div class="stat"><b>${corePlayed}</b><span>Core Runs</span></div>
    `;
  }

  function renderSessionGrid(){
    const grid = $("sessionGrid");
    if (!grid || !hasCoreBank()) return;
    injectStyle();

    const html = ARCS.map((arc,arcIndex) => {
      const unlockedArc = isArcUnlocked(arcIndex);
      const cards = [...arc.sessions, arc.boss].map(sessionId => {
        const s = getSession(sessionId) || {};
        const unlocked = isSessionUnlocked(sessionId);
        const rec = bestRecord(sessionId);
        const passed = isPassed(sessionId);
        const targets = BOSS_IDS.has(sessionId)
          ? (typeof window.getEapCoreBossTargets === "function" ? window.getEapCoreBossTargets(sessionId,{unique:true}).length : 0)
          : (typeof window.getEapCoreSessionTargets === "function" ? window.getEapCoreSessionTargets(sessionId,{unique:true}).length : 0);
        const items = window.getEapCoreBankItems ? window.getEapCoreBankItems(sessionId).length : 0;
        const cls = ["eap192-session-card", BOSS_IDS.has(sessionId) ? "boss" : "", passed ? "passed" : "", unlocked ? "" : "locked"].join(" ");
        const status = passed ? "Passed" : (unlocked ? "Open" : "Locked");
        const acc = rec && rec.accuracy != null ? `${Math.round(num(rec.accuracy))}%` : "-";
        return `
          <article class="${cls}" data-session-id="${sessionId}">
            <div class="eap192-card-top">
              <div>
                <h3>${escapeHtml(sessionId)} · ${escapeHtml(s.title || sessionId)}</h3>
                <p>${escapeHtml(s.mission || s.skillFocus || "Core vocabulary mission")}</p>
              </div>
              <span class="eap192-tag ${passed ? "good" : unlocked ? "ai" : "warn"}">${escapeHtml(status)}</span>
            </div>
            <div class="eap192-tags">
              <span class="eap192-tag">${targets} targets</span>
              <span class="eap192-tag">${items} item variants</span>
              <span class="eap192-tag">Best ${escapeHtml(acc)}</span>
              <span class="eap192-tag ai">Core Aligned</span>
            </div>
            <button class="btn eap192-start" type="button" data-start-session="${sessionId}" ${unlocked ? "" : "disabled"}>${passed ? "Replay" : "Start"}</button>
          </article>
        `;
      }).join("");
      return `
        <div class="eap192-arc" data-arc="${arc.id}">
          <h3 style="margin:18px 0 10px;">${escapeHtml(arc.title)} ${unlockedArc ? "" : "🔒"}</h3>
          <div class="session-grid">${cards}</div>
        </div>
      `;
    }).join("");

    grid.innerHTML = html;
  }

  function updateHeader(){
    const pill = $("versionPill");
    if (pill && !pill.querySelector(".eap192-core-badge")) {
      pill.insertAdjacentHTML("afterend",`<span class="eap192-core-badge">Core AI v196</span>`);
    }
  }

  function renderAllHome(){
    updateHeader();
    renderHomeStats();
    renderSessionGrid();
  }

  function makeChoiceButton(choice,index){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn secondary eap192-choice";
    btn.dataset.index = String(index);
    btn.dataset.correct = choice.correct ? "true" : "false";
    btn.dataset.target = choice.targetId || "";
    btn.textContent = choice.text;
    return btn;
  }

  function renderQuestion(){
    if (!run) return;
    const item = run.items[run.index];
    if (!item) return finishRun();

    markRecent(item.id);

    const s = getSession(run.sessionId) || {};
    const qNum = run.index + 1;
    const total = run.items.length;
    const pct = Math.round(((qNum - 1) / Math.max(1,total)) * 100);

    const modeText = $("gameModeText");
    const gameTitle = $("gameTitle");
    const progressText = $("progressText");
    const progressPercent = $("progressPercent");
    const progressFill = $("progressFill");
    const timeFill = $("timeFill");
    const tags = $("questionTags");
    const prompt = $("promptText");
    const choicesEl = $("choicesEl");
    const feedback = $("feedbackBox");
    const feedbackTitle = $("feedbackTitle");
    const feedbackText = $("feedbackText");
    const nextBtn = $("nextBtn");

    if (modeText) modeText.textContent = `${run.sessionId} • ${s.arcTitle || "Core Mission"}`;
    if (gameTitle) gameTitle.textContent = `${s.title || run.sessionId} — ${s.mission || "Vocabulary Mission"}`;
    if (progressText) progressText.textContent = `Question ${qNum}/${total}`;
    if (progressPercent) progressPercent.textContent = `${pct}%`;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (timeFill) timeFill.style.width = `${Math.max(12,100 - pct)}%`;
    if (tags) {
      tags.innerHTML = `
        <span>${escapeHtml(item.level || "A2+")}</span>
        <span>${escapeHtml(item.type || "core")}</span>
        <span>${escapeHtml(item.targetBand || "core")}</span>
        <span>Target: ${escapeHtml(item.target || item.answerTerm || "")}</span>
      `;
    }
    if (prompt) {
      prompt.innerHTML = `
        <b>${escapeHtml(item.question || "Choose the best answer.")}</b>
        <br><span class="eap192-small">${escapeHtml(item.context || "")}</span>
      `;
    }

    if (feedback) feedback.hidden = true;
    if (feedbackTitle) feedbackTitle.textContent = "Feedback";
    if (feedbackText) feedbackText.textContent = "";
    if (nextBtn) nextBtn.disabled = true;

    if (choicesEl) {
      choicesEl.innerHTML = "";
      const choiceRows = shuffle(item.choices || [], item.id).slice(0,4);
      choiceRows.forEach((choice,index) => choicesEl.appendChild(makeChoiceButton(choice,index)));
    }

    run.questionStartedAt = Date.now();
    run.answered = false;
    updateRunStats();

    window.__EAP_CORE_AI_LAST_KEY__ = "";
    window.__EAP_CORE_AI_ITEM_STARTED_AT__ = Date.now();
  }

  function updateRunStats(){
    const box = $("gameStats");
    if (!box || !run) return;
    const acc = run.answeredCount ? Math.round((run.correct / run.answeredCount) * 100) : 0;
    const bossHp = BOSS_IDS.has(run.sessionId) ? Math.max(0, run.items.length - run.correct) : 0;
    box.innerHTML = `
      <div class="mini"><b>${run.score}</b><span>Score</span></div>
      <div class="mini"><b>${run.correct}</b><span>Correct</span></div>
      <div class="mini"><b>${run.wrong}</b><span>Wrong</span></div>
      <div class="mini"><b>${run.combo}</b><span>Combo</span></div>
      <div class="mini"><b>${acc}%</b><span>Accuracy</span></div>
      <div class="mini"><b>${policyDifficulty()}</b><span>AI Level</span></div>
      ${BOSS_IDS.has(run.sessionId) ? `<div class="mini"><b>${bossHp}</b><span>Boss HP</span></div>` : ""}
    `;
  }

  function answerChoice(button){
    if (!run || run.answered) return;
    const item = run.items[run.index];
    const correct = String(button.dataset.correct).toLowerCase() === "true";
    run.answered = true;
    run.answeredCount += 1;
    const seconds = (Date.now() - run.questionStartedAt) / 1000;
    run.responseTimes.push(seconds);

    const buttons = Array.from(document.querySelectorAll("#choicesEl .eap192-choice"));
    buttons.forEach(btn => {
      btn.disabled = true;
      if (String(btn.dataset.correct).toLowerCase() === "true") btn.classList.add("reveal");
    });

    if (correct) {
      button.classList.add("correct");
      run.correct += 1;
      run.combo += 1;
      run.maxCombo = Math.max(run.maxCombo,run.combo);
      run.score += 100 + Math.min(50, run.combo * 5) + Math.max(0, Math.round(20 - seconds));
    } else {
      button.classList.add("wrong");
      run.wrong += 1;
      run.combo = 0;
      run.weakWords.push(item.target || item.answerTerm);
      run.itemTypeWeak.push(item.type || item.itemType || "core");
      run.levelWeak.push(item.level || "A2+");
      recordWeak(item);
    }

    const feedback = $("feedbackBox");
    const title = $("feedbackTitle");
    const text = $("feedbackText");
    const nextBtn = $("nextBtn");

    if (feedback) feedback.hidden = false;
    if (title) {
      title.textContent = correct ? "Correct" : "Not correct yet";
      title.className = correct ? "eap192-feedback-good" : "eap192-feedback-bad";
    }
    if (text) {
      text.textContent = item.feedback || (correct ? "Good choice." : `Review the target: ${item.answerTerm || item.target}.`);
    }
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.textContent = run.index >= run.items.length - 1 ? "ดูสรุปผล" : "ข้อต่อไป";
    }

    updateRunStats();
  }

  function nextQuestion(){
    if (!run) return;
    if (!run.answered) return;
    run.index += 1;
    if (run.index >= run.items.length) return finishRun();
    renderQuestion();
  }

  function startSession(sessionId, mode = "normal"){
    if (!hasCoreBank()) {
      toast("Core question bank ยังไม่โหลด");
      console.error("[EAP Word Quest] Missing Core bank v191");
      return;
    }

    if (!isSessionUnlocked(sessionId)) {
      toast("ด่านนี้ยังล็อกอยู่");
      return;
    }

    saveProfile();
    const items = selectRoundItems(sessionId, mode);
    if (!items.length) {
      toast(`ไม่พบข้อใน ${sessionId}`);
      return;
    }

    run = {
      version: VERSION,
      sessionId,
      mode,
      items,
      index:0,
      score:0,
      correct:0,
      wrong:0,
      answeredCount:0,
      combo:0,
      maxCombo:0,
      responseTimes:[],
      weakWords:[],
      itemTypeWeak:[],
      levelWeak:[],
      startedAt:new Date().toISOString(),
      questionStartedAt:Date.now(),
      answered:false
    };

    showScreen("gameScreen");
    renderQuestion();
    toast(`${sessionId} Core Bank started`);
  }

  function finishRun(){
    if (!run) return;
    const profile = readProfile();
    const session = getSession(run.sessionId) || {};
    const arc = arcForSession(run.sessionId);
    const total = run.items.length;
    const acc = Math.round((run.correct / Math.max(1,total)) * 100);
    const required = threshold(run.sessionId);
    const passed = acc >= required;
    const bossHp = BOSS_IDS.has(run.sessionId) ? (passed ? 0 : Math.max(1,total - run.correct)) : 0;
    const avgResponse = run.responseTimes.length
      ? Math.round((run.responseTimes.reduce((a,b)=>a+b,0)/run.responseTimes.length)*10)/10
      : 0;
    const weakWords = Array.from(new Set(run.weakWords.filter(Boolean))).slice(0,12);
    const itemTypeWeak = Array.from(new Set(run.itemTypeWeak.filter(Boolean))).slice(0,8);
    const levelWeak = Array.from(new Set(run.levelWeak.filter(Boolean))).slice(0,8);

    const result = {
      logVersion: VERSION,
      source: "core-bank-v196",
      coreAligned: true,
      coreProgressVersion: VERSION,
      course: "EAP",
      game: "EAP Word Quest",
      role: "Vocabulary Side Quest",
      mainGame: "EAP Hero Save the Society",
      group: GROUP,
      section: GROUP,
      studentName: profile.studentName,
      studentId: profile.studentId,
      arcId: arc.id,
      arc: arc.title,
      sessionId: run.sessionId,
      sessionTitle: session.title || run.sessionId,
      sessionType: BOSS_IDS.has(run.sessionId) ? (run.sessionId === "BG5" ? "finalBoss" : "boss") : "session",
      mode: run.mode,
      correct: run.correct,
      total,
      accuracy: acc,
      xp: run.score,
      score: run.score,
      maxCombo: run.maxCombo,
      passed,
      passThreshold: required,
      passStatus: passStatus(acc),
      displayStatus: displayStatus(acc,passed),
      bossHp,
      bossMaxHp: BOSS_IDS.has(run.sessionId) ? total : 0,
      isBoss: BOSS_IDS.has(run.sessionId),
      weakWords,
      itemTypeWeak,
      levelWeak,
      responseTimeAvg: avgResponse,
      itemBankVersion: window.EAP_CORE_QUESTION_BANK && window.EAP_CORE_QUESTION_BANK.version,
      coreMapVersion: window.EAP_CORE_VOCAB_MAP && window.EAP_CORE_VOCAB_MAP.version,
      aiDifficulty: typeof window.getEapCoreAiPolicy === "function" ? window.getEapCoreAiPolicy().difficulty : "A2+",
      aiPrediction: typeof window.getEapCoreAiPolicy === "function" ? window.getEapCoreAiPolicy().prediction : passStatus(acc),
      playedAt: new Date().toISOString(),
      startedAt: run.startedAt,
      endedAt: new Date().toISOString()
    };

    const state = readState();
    const old = state.sessions[run.sessionId] || {};
    const oldBest = num(old.bestAccuracy, -1);
    state.sessions[run.sessionId] = {
      played:true,
      passed: Boolean(old.passed || passed),
      accuracy: Math.max(acc, num(old.accuracy,0)),
      bestAccuracy: Math.max(acc, oldBest < 0 ? 0 : oldBest),
      bestScore: Math.max(run.score, num(old.bestScore,0)),
      lastAccuracy: acc,
      lastScore: run.score,
      totalAttempts: num(old.totalAttempts,0) + 1,
      lastPlayed: result.playedAt,
      lastResult: result
    };
    state.runs = [result, ...(state.runs || [])].slice(0,120);
    writeState(state);

    if (typeof window.logEapWordQuestResult === "function") {
      try { window.logEapWordQuestResult(result); } catch(err){ console.warn("[EAP Word Quest] logger failed",err); }
    }

    window.EAP_V192_LAST_RESULT = result;
    window.EAP_V196_LAST_RESULT = result;
    window.EAP_V195_LAST_RESULT = result;
    window.EAP_V172_SUMMARY_STATE = {
      renderedAt: new Date().toISOString(),
      result
    };

    showSummary(result);
    window.dispatchEvent(new CustomEvent("eap-core-run-finished",{ detail: result }));
    run = null;
    renderAllHome();
  }

  function showSummary(result){
    showScreen("summaryScreen");
    const stars = result.accuracy >= 90 ? "⭐⭐⭐" : result.accuracy >= 75 ? "⭐⭐" : result.accuracy >= 60 ? "⭐" : "✨";
    const title = $("summaryTitle");
    const subtitle = $("summarySubtitle");
    const starEl = $("summaryStars");
    const stats = $("summaryStats");
    const weak = $("summaryWeakWords");

    if (starEl) starEl.textContent = stars;
    if (title) title.textContent = result.passed ? `${result.sessionId} Complete` : `${result.sessionId} Needs Review`;
    if (subtitle) subtitle.textContent = `${result.sessionTitle} • ${result.passStatus} • Required ${result.passThreshold}%`;
    if (stats) {
      stats.innerHTML = `
        <div class="stat"><b>${result.accuracy}%</b><span>Accuracy</span></div>
        <div class="stat good"><b>${result.correct}/${result.total}</b><span>Correct</span></div>
        <div class="stat"><b>${result.score}</b><span>XP</span></div>
        <div class="stat"><b>${result.maxCombo}</b><span>Max Combo</span></div>
        <div class="stat ${result.passed ? "good" : "warn"}"><b>${result.passed ? "PASS" : "REPLAY"}</b><span>Status</span></div>
      `;
    }
    if (weak) {
      weak.innerHTML = result.weakWords && result.weakWords.length
        ? result.weakWords.map(w => `<span class="weak-word">${escapeHtml(w)}</span>`).join("")
        : `<span class="tag ready">No weak words this round</span>`;
    }

    let box = $("eapV195SummaryBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "eapV195SummaryBox";
      box.className = "eap192-summary-box";
      const card = document.querySelector("#summaryScreen .summary-card");
      if (card) card.appendChild(box);
    }
    if (box) {
      const next = nextMission();
      const progress = getCoreProgress();
      box.innerHTML = `
        <b>Core Bank Result</b><br>
        Core Progress: ${progress.passed}/20 passed • ${progress.percent}%<br>
        AI Difficulty: ${escapeHtml(result.aiDifficulty)}<br>
        AI Prediction: ${escapeHtml(result.aiPrediction)}<br>
        Next Mission: ${escapeHtml(next)}
      `;
    }
  }

  function goHome(){
    run = null;
    showScreen("homeScreen");
    renderAllHome();
  }

  function startNext(){
    const next = nextMission();
    if (next === "DONE") {
      toast("ครบทุกด่านแล้ว");
      goHome();
      return;
    }
    startSession(next);
  }

  function startWeak(){
    const next = nextMission();
    const sid = next === "DONE" ? "S1" : next;
    startSession(sid,"weak");
  }

  function resetState(){
    if (!confirm("Reset Core v195 local progress? ข้อมูล logger เก่าจะไม่ถูกลบ แต่ progress ของ controller นี้จะเริ่มใหม่")) return;
    localStorage.removeItem(coreStateKey());
    toast("Core v195 progress reset");
    renderAllHome();
  }

  function installEvents(){
    document.addEventListener("click", event => {
      const target = event.target && event.target.closest ? event.target.closest("button,a") : null;
      if (!target) return;

      const startSid = target.dataset && target.dataset.startSession;
      const id = target.id || "";

      if (startSid) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        startSession(startSid);
        return;
      }

      if (["quickStartBtn","weakStartBtn","quitBtn","nextBtn","replayBtn","homeBtn","nextMissionBtn","saveProfileBtn","resetProfileBtn"].includes(id)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (id === "quickStartBtn") return startNext();
        if (id === "weakStartBtn") return startWeak();
        if (id === "quitBtn" || id === "homeBtn") return goHome();
        if (id === "nextBtn") return nextQuestion();
        if (id === "replayBtn") return startSession((window.EAP_V192_LAST_RESULT && window.EAP_V192_LAST_RESULT.sessionId) || nextMission() || "S1");
        if (id === "nextMissionBtn") return startNext();
        if (id === "saveProfileBtn") { saveProfile(); return; }
        if (id === "resetProfileBtn") { resetState(); return; }
      }

      const choice = event.target.closest && event.target.closest("#choicesEl .eap192-choice");
      if (choice) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        answerChoice(choice);
      }
    }, true);
  }

  function prefillProfile(){
    const p = readJson(PROFILE_KEY,{}) || {};
    if ($("studentNameInput") && !$("studentNameInput").value) $("studentNameInput").value = p.studentName || p.name || "";
    if ($("studentIdInput") && !$("studentIdInput").value) $("studentIdInput").value = p.studentId || p.id || "";
    if ($("sectionInput")) $("sectionInput").value = GROUP;
  }

  function getCoreProgress(){
    const passed = SESSION_ORDER.filter(isPassed).length;
    const next = nextMission();
    return {
      version: VERSION,
      coreOnly: true,
      passed,
      total: SESSION_ORDER.length,
      percent: Math.round((passed / SESSION_ORDER.length) * 100),
      next,
      stateKey: coreStateKey()
    };
  }

  function inspect(){
    const bank = typeof window.inspectEapCoreQuestionBank === "function" ? window.inspectEapCoreQuestionBank() : null;
    const counts = typeof window.getEapCoreTargetCounts === "function" ? window.getEapCoreTargetCounts() : null;
    const state = readState();
    return {
      version: VERSION,
      group: GROUP,
      hasCoreBank: hasCoreBank(),
      targetCounts: counts,
      bank,
      nextMission: nextMission(),
      completed: completedCount(),
      sessions: state.sessions,
      weakTargets: state.weakTargets,
      loadedScripts: Array.from(document.scripts).map(s => s.src).filter(src => src.includes("eap-word") || src.includes("eap-core"))
    };
  }

  function boot(){
    injectStyle();
    prefillProfile();
    installEvents();
    renderAllHome();
    setTimeout(renderAllHome,300);
    setTimeout(renderAllHome,900);
    console.info("[EAP Word Quest] v196 compact core progress controller ready", inspect());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.startEapCoreSession = startSession;
  window.inspectEapV192 = inspect;
  window.inspectEapV195 = inspect;
  window.inspectEapV196 = inspect;
  window.resetEapCoreV192State = resetState;
  window.resetEapCoreV195State = resetState;
  window.resetEapCoreV196State = resetState;
  window.getEapCoreProgress = getCoreProgress;
  window.EAP_WORD_V196_VERSION = VERSION;
})();
