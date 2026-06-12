/* =========================================================
   EAP Word Quest • Academic Vocabulary Mission
   File: /herohealth/eap-word-quest/eap-word-engine-v14.js
   Version: v1.5.1-STUDENT-HOME-SIMPLIFY
========================================================= */

"use strict";

(function(){
  const APP_VERSION = window.APP_VERSION || "v1.5.1-STUDENT-HOME-SIMPLIFY";
  const SESSIONS = Array.isArray(window.SESSIONS) ? window.SESSIONS : [];
  const QUESTION_BANK = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];

  const STORAGE_KEY = "EAP_WORD_QUEST_STATS_V150";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const RECENT_KEY = "EAP_WORD_QUEST_RECENT_V01";
  const DAILY_KEY = "EAP_WORD_QUEST_DAILY_V01";

  const CONTENT_SESSIONS = [
    "S1","S2","S3",
    "S4","S5","S6",
    "S7","S8","S9",
    "S10","S11","S12",
    "S13","S14","S15"
  ];

  const BOSS_SESSIONS = ["BG1","BG2","BG3","BG4","BG5"];

  const COURSE_FLOW = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];

  const ARC_HEADERS = {
    S1:{
      title:"Arc 1 • Academic Profile + Project Foundation",
      desc:"เรียนคำศัพท์สำหรับแนะนำตัวเชิงวิชาการ อธิบายโปรเจกต์ เหตุผล และผู้ใช้เป้าหมาย"
    },
    S4:{
      title:"Arc 2 • Career + Workplace Communication",
      desc:"เรียนคำศัพท์อาชีพ เทคโนโลยี การสื่อสารในทีม และความรับผิดชอบของงาน"
    },
    S7:{
      title:"Arc 3 • Email + Meeting + Summary",
      desc:"เรียนอีเมลทางการ การประชุม การสรุปประเด็น และ action items"
    },
    S10:{
      title:"Arc 4 • System + Bug + Technical Guide",
      desc:"เรียนการอธิบายระบบ รายงานปัญหา และเขียนคู่มือ/ขั้นตอนเชิงเทคนิค"
    },
    S13:{
      title:"Arc 5 • AI Report + Career Pitch + Final Presentation",
      desc:"เรียนการสรุปรายงาน AI, CV/interview/pitch และการสะท้อนผลลัพธ์โปรเจกต์"
    }
  };

  const BOSS_GATE_CONFIG = {
    BG1:{
      label:"Boss Gate 1",
      sessions:["S1","S2","S3"],
      minRound:24,
      hp:190,
      passAccuracy:70
    },
    BG2:{
      label:"Boss Gate 2",
      sessions:["S4","S5","S6"],
      minRound:24,
      hp:220,
      passAccuracy:70
    },
    BG3:{
      label:"Boss Gate 3",
      sessions:["S7","S8","S9"],
      minRound:24,
      hp:250,
      passAccuracy:70
    },
    BG4:{
      label:"Boss Gate 4",
      sessions:["S10","S11","S12"],
      minRound:26,
      hp:285,
      passAccuracy:70
    },
    BG5:{
      label:"Final Boss Gate",
      sessions:CONTENT_SESSIONS.slice(),
      minRound:30,
      hp:340,
      passAccuracy:75
    }
  };

  const BOSS_TYPE_PRIORITY = [
    "academic_upgrade",
    "academic_phrase",
    "near_miss",
    "word_form",
    "context",
    "collocation",
    "sentence_fill",
    "meaning"
  ];

  const BOSS_TYPE_QUOTA = {
    academic_upgrade:0.18,
    academic_phrase:0.18,
    near_miss:0.14,
    word_form:0.14,
    context:0.13,
    collocation:0.11,
    sentence_fill:0.07,
    meaning:0.05
  };

  const TYPE_LABEL = {
    meaning:"Meaning",
    sentence_fill:"Sentence Fill",
    collocation:"Collocation",
    context:"Context",
    word_form:"Word Form",
    near_miss:"Near Miss",
    academic_phrase:"Academic Phrase",
    academic_upgrade:"Academic Upgrade"
  };

  const LEVEL_TIME = {
    A2:24,
    "A2+":22,
    B1:20,
    "B1+":18
  };

  const DEFAULT_PROFILE = {
    studentName:"",
    studentId:"",
    section:"101"
  };

  let questionTimer = null;
  let toastTimer = null;

  const state = {
    session:"S1",
    mode:"mixed",
    round:[],
    index:0,
    selected:false,
    correct:0,
    wrong:0,
    combo:0,
    maxCombo:0,
    xp:0,
    aiHelp:2,
    startedAt:null,
    questionStartedAt:null,
    timeLimit:20,
    timeLeft:20,
    weakWords:[],
    isBoss:false,
    bossHp:0,
    bossMaxHp:0,
    isWeakTraining:false,
    isDailyChallenge:false,
    isSpeedRun:false,
    speedDeadline:0,
    nextMission:"S1"
  };

  function $(id){
    return document.getElementById(id);
  }

  function escapeHtml(value){
    return String(value == null ? "" : value)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function normalizeText(value){
    return String(value == null ? "" : value).replace(/\s+/g," ").trim();
  }

  function normalizeSection(value){
    const raw = normalizeText(value || "101").toUpperCase();

    if(raw === "SEC01" || raw === "SEC 01" || raw === "SECTION01" || raw === "SECTION 01"){
      return "101";
    }

    if(!raw) return "101";

    return raw.replace(/^SEC/i,"").replace(/^SECTION/i,"").trim() || "101";
  }

  function clamp(n,min,max){
    return Math.max(min,Math.min(max,n));
  }

  function percent(correct,total){
    const c = Number(correct || 0);
    const t = Number(total || 0);

    if(!t) return 0;

    return Math.round((c / t) * 100);
  }

  function shuffle(arr){
    const a = arr.slice();

    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i],a[j]] = [a[j],a[i]];
    }

    return a;
  }

  function sample(arr,count){
    return shuffle(arr).slice(0,count);
  }

  function todayLocalKey(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");

    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDateTime(value){
    if(!value) return "-";

    try{
      const d = new Date(value);

      if(Number.isNaN(d.getTime())) return "-";

      return d.toLocaleString("th-TH",{
        year:"numeric",
        month:"short",
        day:"2-digit",
        hour:"2-digit",
        minute:"2-digit"
      });
    }catch(err){
      return "-";
    }
  }

  function showToast(message){
    const el = $("toast");
    if(!el) return;

    el.textContent = message;
    el.hidden = false;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    },2600);
  }

  function setScreen(screenId){
    document.querySelectorAll(".screen").forEach(screen => {
      screen.classList.toggle("active",screen.id === screenId);
    });

    polishMobileAfterRender();

    window.scrollTo({
      top:0,
      behavior:window.matchMedia && window.matchMedia("(max-width: 640px)").matches ? "auto" : "smooth"
    });
  }

  function downloadTextFile(filename,content,mime){
    const blob = new Blob([content],{type:mime || "text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    },200);
  }

  function csvEscape(value){
    const s = String(value == null ? "" : value);

    if(/[",\n\r]/.test(s)){
      return `"${s.replace(/"/g,'""')}"`;
    }

    return s;
  }

  /* =========================================================
     Profile / Storage
  ========================================================= */

  function loadProfile(){
    try{
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");

      return {
        studentName:normalizeText(raw.studentName || ""),
        studentId:normalizeText(raw.studentId || ""),
        section:normalizeSection(raw.section || "101")
      };
    }catch(err){
      return Object.assign({},DEFAULT_PROFILE);
    }
  }

  function saveProfile(profile){
    const next = {
      studentName:normalizeText(profile.studentName || ""),
      studentId:normalizeText(profile.studentId || ""),
      section:normalizeSection(profile.section || "101")
    };

    localStorage.setItem(PROFILE_KEY,JSON.stringify(next));

    return next;
  }

  function renderProfile(){
    const profile = loadProfile();

    if($("studentNameInput")) $("studentNameInput").value = profile.studentName;
    if($("studentIdInput")) $("studentIdInput").value = profile.studentId;
    if($("sectionInput")) $("sectionInput").value = profile.section || "101";

    const status = $("profileStatus");

    if(status){
      const hasProfile = profile.studentName || profile.studentId;

      status.innerHTML = hasProfile
        ? `
          <span class="tag good">Profile saved</span>
          <span class="tag">Name: ${escapeHtml(profile.studentName || "-")}</span>
          <span class="tag">ID: ${escapeHtml(profile.studentId || "-")}</span>
          <span class="tag primary">Section ${escapeHtml(profile.section || "101")}</span>
        `
        : `<span class="tag warn">ยังไม่ได้บันทึก Profile</span><span class="tag primary">Section 101</span>`;
    }

    return profile;
  }

  function handleSaveProfile(){
    const profile = saveProfile({
      studentName:$("studentNameInput") ? $("studentNameInput").value : "",
      studentId:$("studentIdInput") ? $("studentIdInput").value : "",
      section:$("sectionInput") ? $("sectionInput").value : "101"
    });

    renderProfile();
    renderHomeStats();
    showToast(`Saved profile • Section ${profile.section}`);
  }

  function resetProfile(){
    localStorage.removeItem(PROFILE_KEY);
    renderProfile();
    showToast("Profile reset");
  }

  function defaultStats(){
    return {
      version:APP_VERSION,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      rounds:0,
      correct:0,
      total:0,
      totalXp:0,
      sessions:{},
      words:{},
      history:[],
      profileSnapshot:loadProfile()
    };
  }

  function normalizeWordStats(w){
    const old = w && typeof w === "object" ? w : {};

    return {
      seen:Number(old.seen || 0),
      correct:Number(old.correct || 0),
      wrong:Number(old.wrong || 0),
      levels:old.levels && typeof old.levels === "object" ? old.levels : {},
      types:old.types && typeof old.types === "object" ? old.types : {},
      sessions:old.sessions && typeof old.sessions === "object" ? old.sessions : {},
      lastSeen:old.lastSeen || null
    };
  }

  function normalizeSessionStats(s){
    const old = s && typeof s === "object" ? s : {};

    return {
      rounds:Number(old.rounds || 0),
      correct:Number(old.correct || 0),
      total:Number(old.total || 0),
      xp:Number(old.xp || 0),
      lastPlayed:old.lastPlayed || null,
      bestAccuracy:Number(old.bestAccuracy || 0),
      bestXp:Number(old.bestXp || 0),
      played:Boolean(old.played || old.rounds),
      passed:Boolean(old.passed || false),
      lastPassed:old.lastPassed || null
    };
  }

  function normalizeStats(stats){
    const next = stats && typeof stats === "object" ? stats : defaultStats();

    next.version = APP_VERSION;
    next.createdAt = next.createdAt || new Date().toISOString();
    next.updatedAt = next.updatedAt || new Date().toISOString();
    next.rounds = Number(next.rounds || 0);
    next.correct = Number(next.correct || 0);
    next.total = Number(next.total || 0);
    next.totalXp = Number(next.totalXp || 0);
    next.profileSnapshot = next.profileSnapshot || loadProfile();

    next.sessions = next.sessions && typeof next.sessions === "object" ? next.sessions : {};
    Object.keys(next.sessions).forEach(key => {
      next.sessions[key] = normalizeSessionStats(next.sessions[key]);
    });

    next.words = next.words && typeof next.words === "object" ? next.words : {};
    Object.keys(next.words).forEach(key => {
      next.words[key] = normalizeWordStats(next.words[key]);
    });

    next.history = Array.isArray(next.history) ? next.history.slice(0,80) : [];

    return next;
  }

  function loadStats(){
    try{
      return normalizeStats(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    }catch(err){
      return defaultStats();
    }
  }

  function saveStats(stats){
    const next = normalizeStats(stats);
    next.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY,JSON.stringify(next));

    return next;
  }

  function getSessionProgress(sessionId){
    const stats = loadStats();
    const s = stats.sessions && stats.sessions[sessionId]
      ? normalizeSessionStats(stats.sessions[sessionId])
      : normalizeSessionStats(null);

    s.played = Boolean(s.played || s.rounds);

    return s;
  }

  function masteryLabel(w){
    const seen = Number(w && w.seen || 0);
    const correct = Number(w && w.correct || 0);
    const wrong = Number(w && w.wrong || 0);
    const acc = seen ? Math.round((correct / seen) * 100) : 0;

    if(wrong >= 2 && acc < 70) return "Weak";
    if(seen >= 6 && acc >= 90) return "Mastered";
    if(seen >= 4 && acc >= 80) return "Strong";
    if(seen >= 2 && acc >= 65) return "Familiar";
    if(seen >= 1) return "Learned";

    return "New";
  }

  function updateWordStats(stats,q,isCorrect){
    const key = q.word || q.answer || q.id;
    if(!key) return;

    if(!stats.words[key]) stats.words[key] = normalizeWordStats(null);

    const w = stats.words[key];

    if(!w.levels || typeof w.levels !== "object") w.levels = {};
    if(!w.types || typeof w.types !== "object") w.types = {};
    if(!w.sessions || typeof w.sessions !== "object") w.sessions = {};

    w.seen = Number(w.seen || 0) + 1;
    w.correct = Number(w.correct || 0) + (isCorrect ? 1 : 0);
    w.wrong = Number(w.wrong || 0) + (isCorrect ? 0 : 1);
    w.levels[q.level] = Number(w.levels[q.level] || 0) + 1;
    w.types[q.type] = Number(w.types[q.type] || 0) + 1;
    w.sessions[q.session] = Number(w.sessions[q.session] || 0) + 1;
    w.lastSeen = new Date().toISOString();
  }

  /* =========================================================
     Session / Unlock / Boss Gate Helpers
  ========================================================= */

  function isBossGate(sessionId){
    return BOSS_SESSIONS.includes(sessionId);
  }

  function getBossGateConfig(sessionId){
    return BOSS_GATE_CONFIG[sessionId] || null;
  }

  function bossTargetSessions(sessionId){
    const cfg = getBossGateConfig(sessionId);
    return cfg ? cfg.sessions.slice() : [];
  }

  function sessionPassThreshold(sessionId){
    if(sessionId === "BG5") return 75;
    if(sessionId === "BG1" || sessionId === "BG2" || sessionId === "BG3" || sessionId === "BG4") return 70;
    if(sessionId === "DAILY" || sessionId === "SPEED" || sessionId === "WEAK") return 0;

    return 60;
  }

  function isRoundPassed(sessionId,acc){
    const threshold = sessionPassThreshold(sessionId);

    if(threshold <= 0) return false;

    if(isBossGate(sessionId)){
      return acc >= threshold && state.bossHp <= 0;
    }

    return acc >= threshold;
  }

  function passOf(sessionId){
    return Boolean(getSessionProgress(sessionId).passed);
  }

  function canUnlockBossGate1(){
    return passOf("S1") && passOf("S2") && passOf("S3");
  }

  function canUnlockArc2(){
    return passOf("BG1");
  }

  function canUnlockBossGate2(){
    return passOf("S4") && passOf("S5") && passOf("S6");
  }

  function canUnlockArc3(){
    return passOf("BG2");
  }

  function canUnlockBossGate3(){
    return passOf("S7") && passOf("S8") && passOf("S9");
  }

  function canUnlockArc4(){
    return passOf("BG3");
  }

  function canUnlockBossGate4(){
    return passOf("S10") && passOf("S11") && passOf("S12");
  }

  function canUnlockFinalArc(){
    return passOf("BG4");
  }

  function canUnlockFinalBossGate(){
    return passOf("S13") && passOf("S14") && passOf("S15");
  }

  function isMissionUnlocked(sessionId){
    if(sessionId === "S1" || sessionId === "S2" || sessionId === "S3") return true;

    if(sessionId === "BG1") return canUnlockBossGate1();

    if(sessionId === "S4" || sessionId === "S5" || sessionId === "S6") return canUnlockArc2();
    if(sessionId === "BG2") return canUnlockBossGate2();

    if(sessionId === "S7" || sessionId === "S8" || sessionId === "S9") return canUnlockArc3();
    if(sessionId === "BG3") return canUnlockBossGate3();

    if(sessionId === "S10" || sessionId === "S11" || sessionId === "S12") return canUnlockArc4();
    if(sessionId === "BG4") return canUnlockBossGate4();

    if(sessionId === "S13" || sessionId === "S14" || sessionId === "S15") return canUnlockFinalArc();
    if(sessionId === "BG5") return canUnlockFinalBossGate();

    return false;
  }

  function getFirstUnlockedMission(){
    for(const id of COURSE_FLOW){
      const sessionObj = SESSIONS.find(s => s.id === id);
      if(!sessionObj) continue;

      if(isMissionUnlocked(id)){
        const p = getSessionProgress(id);
        if(!p.passed) return id;
      }
    }

    return "S1";
  }

  function getNextMissionId(currentId,passedThisRound){
    const idx = COURSE_FLOW.indexOf(currentId);

    if(idx === -1) return getFirstUnlockedMission();

    if(!passedThisRound) return currentId;

    for(let i = idx + 1; i < COURSE_FLOW.length; i++){
      if(isMissionUnlocked(COURSE_FLOW[i])) return COURSE_FLOW[i];
    }

    return currentId;
  }

  function getSessionName(sessionId){
    if(sessionId === "WEAK") return "Weak Word Training";
    if(sessionId === "DAILY") return "Daily Challenge";
    if(sessionId === "SPEED") return "Speed Run 60s";

    const cfg = getBossGateConfig(sessionId);
    if(cfg) return cfg.label;

    const s = SESSIONS.find(x => x.id === sessionId);
    return s ? s.title : sessionId;
  }

  function getPoolBySession(sessionId){
    let target = [];

    if(sessionId === "WEAK" || sessionId === "DAILY" || sessionId === "SPEED"){
      target = CONTENT_SESSIONS.slice();
    }else if(isBossGate(sessionId)){
      target = bossTargetSessions(sessionId);
    }else{
      target = [sessionId];
    }

    return QUESTION_BANK.filter(q => target.includes(q.session));
  }

  function filterPoolByMode(pool,mode){
    if(!mode || mode === "mixed") return pool.slice();

    return pool.filter(q => q.level === mode);
  }

  function sortBossPriority(a,b){
    const ai = BOSS_TYPE_PRIORITY.indexOf(a.type);
    const bi = BOSS_TYPE_PRIORITY.indexOf(b.type);
    const av = ai === -1 ? 999 : ai;
    const bv = bi === -1 ? 999 : bi;

    if(av !== bv) return av - bv;

    return Math.random() - .5;
  }

  function addUniqueQuestion(out,seen,q){
    if(!q || seen.has(q.id)) return false;

    out.push(q);
    seen.add(q.id);

    return true;
  }

  function pickFromPool(pool,count,seen){
    const out = [];
    const shuffled = shuffle(pool);

    for(const q of shuffled){
      if(out.length >= count) break;
      if(seen && seen.has(q.id)) continue;

      out.push(q);
    }

    return out;
  }

  function distributeCount(total,parts){
    const base = Math.floor(total / parts);
    const extra = total % parts;

    return Array.from({length:parts},(_,i) => base + (i < extra ? 1 : 0));
  }

  function buildBossGateRound(sessionId,mode,roundSize){
    const cfg = getBossGateConfig(sessionId);
    const size = Math.max(Number(roundSize || 0),cfg ? cfg.minRound : 24);
    const sessions = cfg ? cfg.sessions : bossTargetSessions(sessionId);

    let pool = getPoolBySession(sessionId);
    pool = filterPoolByMode(pool,mode);

    if(pool.length < size){
      pool = getPoolBySession(sessionId);
    }

    const out = [];
    const seen = new Set();
    const quotas = distributeCount(size,sessions.length);

    sessions.forEach((s,idx) => {
      const sessionPool = pool
        .filter(q => q.session === s)
        .sort(sortBossPriority);

      pickFromPool(sessionPool,quotas[idx],seen).forEach(q => addUniqueQuestion(out,seen,q));
    });

    Object.entries(BOSS_TYPE_QUOTA).forEach(([type,ratio]) => {
      const target = Math.max(1,Math.round(size * ratio));
      const current = out.filter(q => q.type === type).length;

      if(current >= target) return;

      const needed = target - current;
      const typePool = pool
        .filter(q => q.type === type)
        .sort(sortBossPriority);

      pickFromPool(typePool,needed,seen).forEach(q => addUniqueQuestion(out,seen,q));
    });

    if(out.length < size){
      pool.sort(sortBossPriority);
      pickFromPool(pool,size - out.length,seen).forEach(q => addUniqueQuestion(out,seen,q));
    }

    return shuffle(out).slice(0,size);
  }

  function buildRound(sessionId,mode,roundSize){
    if(isBossGate(sessionId)){
      return buildBossGateRound(sessionId,mode,roundSize);
    }

    let pool = getPoolBySession(sessionId);
    pool = filterPoolByMode(pool,mode);

    if(!pool.length){
      pool = getPoolBySession(sessionId);
    }

    const size = Math.min(Number(roundSize || 12),pool.length);

    const hard = pool.filter(q =>
      q.type === "academic_upgrade" ||
      q.type === "academic_phrase" ||
      q.type === "near_miss" ||
      q.type === "word_form"
    );

    const support = pool.filter(q =>
      q.type === "meaning" ||
      q.type === "sentence_fill" ||
      q.type === "collocation" ||
      q.type === "context"
    );

    const out = [];
    const seen = new Set();

    pickFromPool(hard,Math.ceil(size * .45),seen).forEach(q => addUniqueQuestion(out,seen,q));
    pickFromPool(support,size - out.length,seen).forEach(q => addUniqueQuestion(out,seen,q));

    if(out.length < size){
      pickFromPool(pool,size - out.length,seen).forEach(q => addUniqueQuestion(out,seen,q));
    }

    return shuffle(out).slice(0,size);
  }

  /* =========================================================
     Home / Session Map
  ========================================================= */

  function renderHomeStats(){
    const stats = loadStats();
    const words = getDeckWords();

    const mastered = words.filter(w => w.mastery === "Mastered").length;
    const weak = words.filter(w => w.mastery === "Weak" || w.wrong > 0).length;
    const overallAcc = percent(stats.correct,stats.total);
    const nextMission = getFirstUnlockedMission();

    const missionRows = getMissionSummaryRows();
    const passedMissions = missionRows.filter(r => r.passed).length;
    const totalMissions = missionRows.length;

    const quickBtn = $("quickStartBtn");
    if(quickBtn){
      quickBtn.textContent = `เล่นต่อ: ${nextMission}`;
    }

    const el = $("homeStats");
    if(!el) return;

    el.innerHTML = `
      <div class="stat"><b>${escapeHtml(nextMission)}</b><span>ภารกิจถัดไป</span></div>
      <div class="stat"><b>${passedMissions}/${totalMissions}</b><span>ผ่านแล้ว</span></div>
      <div class="stat"><b>${stats.totalXp || 0}</b><span>XP สะสม</span></div>
      <div class="stat"><b>${overallAcc}%</b><span>ความถูกต้อง</span></div>
      <div class="stat"><b>${mastered}</b><span>คำที่จำได้ดี</span></div>
      <div class="stat"><b>${weak}</b><span>คำที่ควรทบทวน</span></div>
    `;
  }

  function renderSessions(){
    const grid = $("sessionGrid");
    if(!grid) return;

    const parts = [];

    SESSIONS.forEach(s => {
      if(ARC_HEADERS[s.id]){
        parts.push(`
          <div class="arc-header">
            <h3>${escapeHtml(ARC_HEADERS[s.id].title)}</h3>
            <p>${escapeHtml(ARC_HEADERS[s.id].desc)}</p>
          </div>
        `);
      }

      const progress = getSessionProgress(s.id);
      const unlocked = isMissionUnlocked(s.id);
      const active = (s.status === "playable" || s.status === "boss") && unlocked;

      const statusTag = !unlocked
        ? `<span class="tag warn">Locked</span>`
        : progress.passed
          ? `<span class="tag good">Passed</span>`
          : progress.played
            ? `<span class="tag primary">Played</span>`
            : s.status === "boss"
              ? `<span class="tag bad">Boss Gate Ready</span>`
              : `<span class="tag good">Playable</span>`;

      const bossTag = s.boss
        ? `<span class="tag bad">Boss Gate</span>`
        : `<span class="tag">Session</span>`;

      const progressTag = progress.played ? `<span class="tag">Best ${progress.bestAccuracy || 0}%</span>` : "";

      let lockText = "Locked";

      if(!unlocked){
        if(s.id === "BG1") lockText = "ต้องผ่าน S1/S2/S3 ก่อน";
        else if(s.id === "S4" || s.id === "S5" || s.id === "S6") lockText = "ต้องผ่าน Boss Gate 1 ก่อน";
        else if(s.id === "BG2") lockText = "ต้องผ่าน S4/S5/S6 ก่อน";
        else if(s.id === "S7" || s.id === "S8" || s.id === "S9") lockText = "ต้องผ่าน Boss Gate 2 ก่อน";
        else if(s.id === "BG3") lockText = "ต้องผ่าน S7/S8/S9 ก่อน";
        else if(s.id === "S10" || s.id === "S11" || s.id === "S12") lockText = "ต้องผ่าน Boss Gate 3 ก่อน";
        else if(s.id === "BG4") lockText = "ต้องผ่าน S10/S11/S12 ก่อน";
        else if(s.id === "S13" || s.id === "S14" || s.id === "S15") lockText = "ต้องผ่าน Boss Gate 4 ก่อน";
        else if(s.id === "BG5") lockText = "ต้องผ่าน S13/S14/S15 ก่อน";
      }

      const buttonText = active
        ? s.boss
          ? (s.id === "BG5" ? "สู้ Final Boss Gate" : "สู้ Boss Gate")
          : "เริ่ม Session"
        : lockText;

      const passLine = s.boss
        ? (
            s.id === "BG5"
              ? "ภารกิจใหญ่สุดท้าย: ตอบให้แม่นและลด Boss HP ให้หมด"
              : "ด่านทบทวนท้าย Arc: ตอบให้แม่นและลด Boss HP ให้หมด"
          )
        : "เล่นให้ผ่านเพื่อปลดล็อกภารกิจถัดไป";

      parts.push(`
        <article class="session-card ${s.boss ? "boss" : ""} ${active ? "" : "locked"}">
          <div class="session-top">
            <h4>${escapeHtml(s.id)} • ${escapeHtml(s.title)}</h4>
            <p>${escapeHtml(s.desc)}</p>
            <div class="session-meta">${statusTag}${bossTag}${progressTag}</div>
            <div class="next-hint">${escapeHtml(passLine)}</div>
          </div>
          <div class="session-actions">
            <button class="btn ${active ? "" : "secondary"} small"
              type="button"
              ${active ? "" : "disabled"}
              onclick="window.startSession('${escapeHtml(s.id)}')">
              ${escapeHtml(buttonText)}
            </button>
          </div>
        </article>
      `);
    });

    grid.innerHTML = parts.join("");
  }

  /* =========================================================
     Game Flow
  ========================================================= */

  function validateStart(sessionId){
    const canPlay = COURSE_FLOW.includes(sessionId);

    if(!canPlay){
      showToast("ไม่พบ Session นี้");
      return false;
    }

    if(!isMissionUnlocked(sessionId)){
      if(sessionId === "BG1") showToast("ต้องผ่าน S1, S2 และ S3 ก่อนเข้า Boss Gate 1");
      else if(sessionId === "S4" || sessionId === "S5" || sessionId === "S6") showToast("ต้องผ่าน Boss Gate 1 ก่อนปลดล็อก Arc 2");
      else if(sessionId === "BG2") showToast("ต้องผ่าน S4, S5 และ S6 ก่อนเข้า Boss Gate 2");
      else if(sessionId === "S7" || sessionId === "S8" || sessionId === "S9") showToast("ต้องผ่าน Boss Gate 2 ก่อนปลดล็อก Arc 3");
      else if(sessionId === "BG3") showToast("ต้องผ่าน S7, S8 และ S9 ก่อนเข้า Boss Gate 3");
      else if(sessionId === "S10" || sessionId === "S11" || sessionId === "S12") showToast("ต้องผ่าน Boss Gate 3 ก่อนปลดล็อก Arc 4");
      else if(sessionId === "BG4") showToast("ต้องผ่าน S10, S11 และ S12 ก่อนเข้า Boss Gate 4");
      else if(sessionId === "S13" || sessionId === "S14" || sessionId === "S15") showToast("ต้องผ่าน Boss Gate 4 ก่อนปลดล็อก Arc 5");
      else if(sessionId === "BG5") showToast("ต้องผ่าน S13, S14 และ S15 ก่อนเข้า Final Boss Gate");
      else showToast("ด่านนี้ยังถูกล็อก");

      return false;
    }

    return true;
  }

  function resetRoundFlags(){
    state.selected = false;
    state.correct = 0;
    state.wrong = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.xp = 0;
    state.weakWords = [];
    state.isWeakTraining = false;
    state.isDailyChallenge = false;
    state.isSpeedRun = false;
    state.speedDeadline = 0;
  }

  function startSession(sessionId){
    if(!validateStart(sessionId)) return;

    clearQuestionTimer();

    const cfg = getBossGateConfig(sessionId);
    const isBoss = isBossGate(sessionId);
    const requestedRoundSize = Number($("roundSizeSelect") ? $("roundSizeSelect").value : 12);
    const roundSize = isBoss ? Math.max(requestedRoundSize,cfg ? cfg.minRound : 24) : requestedRoundSize;
    const mode = isBoss ? "mixed" : ($("modeSelect") ? $("modeSelect").value : "mixed");
    const round = buildRound(sessionId,mode,roundSize);

    if(!round.length){
      showToast("ไม่มีคำถามใน Session นี้");
      return;
    }

    state.session = sessionId;
    state.mode = mode;
    state.round = round;
    state.index = 0;
    state.startedAt = new Date().toISOString();
    state.aiHelp = sessionId === "BG5" ? 0 : isBoss ? 1 : 2;
    state.isBoss = isBoss;
    state.bossMaxHp = isBoss ? ((cfg && cfg.hp) || 190) : 0;
    state.bossHp = state.bossMaxHp;
    state.nextMission = getNextMissionId(sessionId,false);

    resetRoundFlags();

    if(isBoss){
      showToast(`${getSessionName(sessionId)} เริ่มแล้ว • ลด Boss HP ให้เหลือ 0`);
    }else{
      showToast(`${sessionId} เริ่มแล้ว`);
    }

    setScreen("gameScreen");
    renderQuestion();
  }

  function startWeakTraining(){
    const stats = loadStats();
    const weakKeys = Object.entries(stats.words || {})
      .filter(([,w]) => masteryLabel(w) === "Weak" || Number(w.wrong || 0) > 0)
      .sort((a,b) => Number(b[1].wrong || 0) - Number(a[1].wrong || 0))
      .map(([word]) => word);

    if(!weakKeys.length){
      showToast("ยังไม่มี Weak Words ให้ฝึก");
      return;
    }

    let pool = QUESTION_BANK.filter(q => weakKeys.includes(q.word));
    if(!pool.length) pool = QUESTION_BANK.filter(q => CONTENT_SESSIONS.includes(q.session));

    clearQuestionTimer();
    resetRoundFlags();

    state.session = "WEAK";
    state.mode = "mixed";
    state.round = sample(pool,Math.min(12,pool.length));
    state.index = 0;
    state.startedAt = new Date().toISOString();
    state.aiHelp = 2;
    state.isWeakTraining = true;
    state.isBoss = false;
    state.bossHp = 0;
    state.bossMaxHp = 0;

    setScreen("gameScreen");
    renderQuestion();
  }

  function startDailyChallenge(){
    const today = todayLocalKey();
    const stored = localStorage.getItem(DAILY_KEY);

    if(stored === today){
      const ok = confirm("วันนี้เล่น Daily Challenge แล้ว ต้องการเล่นซ้ำแบบไม่บันทึก Daily ใหม่ใช่ไหม?");
      if(!ok) return;
    }

    let pool = QUESTION_BANK.filter(q =>
      CONTENT_SESSIONS.includes(q.session) &&
      (q.level === "B1" || q.level === "B1+")
    );

    if(pool.length < 15) pool = QUESTION_BANK.filter(q => CONTENT_SESSIONS.includes(q.session));

    clearQuestionTimer();
    resetRoundFlags();

    state.session = "DAILY";
    state.mode = "mixed";
    state.round = sample(pool,Math.min(15,pool.length));
    state.index = 0;
    state.startedAt = new Date().toISOString();
    state.aiHelp = 1;
    state.isDailyChallenge = true;
    state.isBoss = false;
    state.bossHp = 0;
    state.bossMaxHp = 0;

    localStorage.setItem(DAILY_KEY,today);

    setScreen("gameScreen");
    renderQuestion();
  }

  function startSpeedRun(){
    const pool = QUESTION_BANK.filter(q => CONTENT_SESSIONS.includes(q.session));

    clearQuestionTimer();
    resetRoundFlags();

    state.session = "SPEED";
    state.mode = "mixed";
    state.round = sample(pool,Math.min(40,pool.length));
    state.index = 0;
    state.startedAt = new Date().toISOString();
    state.aiHelp = 0;
    state.isSpeedRun = true;
    state.speedDeadline = Date.now() + 60000;
    state.isBoss = false;
    state.bossHp = 0;
    state.bossMaxHp = 0;

    setScreen("gameScreen");
    renderQuestion();
  }

  function questionTimeLimit(q){
    if(state.isSpeedRun) return Math.max(5,Math.ceil((state.speedDeadline - Date.now()) / 1000));
    if(q && LEVEL_TIME[q.level]) return LEVEL_TIME[q.level];

    return 20;
  }

  function renderQuestion(){
    clearQuestionTimer();

    const q = state.round[state.index];

    if(!q){
      finishRound();
      return;
    }

    state.selected = false;
    state.questionStartedAt = Date.now();
    state.timeLimit = questionTimeLimit(q);
    state.timeLeft = state.timeLimit;

    const isBoss = state.isBoss;
    const title = isBoss
      ? (state.session === "BG5" ? "Final Boss Gate" : "Boss Gate Battle")
      : getSessionName(state.session);

    if($("gameModeText")){
      $("gameModeText").textContent = isBoss
        ? `${state.session} • Boss Gate`
        : state.isWeakTraining
          ? "Weak Word Training"
          : state.isDailyChallenge
            ? "Daily Challenge"
            : state.isSpeedRun
              ? "Speed Run"
              : `${state.session} • ${state.mode}`;
    }

    if($("gameTitle")) $("gameTitle").textContent = title;

    const total = state.round.length;
    const current = state.index + 1;
    const progress = Math.round(((current - 1) / total) * 100);

    if($("progressText")) $("progressText").textContent = `Question ${current}/${total}`;
    if($("progressPercent")) $("progressPercent").textContent = `${progress}%`;
    if($("progressFill")) $("progressFill").style.width = `${progress}%`;
    if($("timeFill")) $("timeFill").style.width = "100%";

    if($("questionTags")){
      const bossHpTag = state.isBoss
        ? `<span class="tag bad">Boss HP ${Math.max(0,state.bossHp)}/${state.bossMaxHp}</span>`
        : "";

      $("questionTags").innerHTML = `
        <span class="tag primary">${escapeHtml(q.level)}</span>
        <span class="tag">${escapeHtml(TYPE_LABEL[q.type] || q.type)}</span>
        <span class="tag">${escapeHtml(q.session)}</span>
        <span class="tag good">Combo ${state.combo}</span>
        ${bossHpTag}
      `;
    }

    if($("promptText")) $("promptText").textContent = q.prompt;

    const choices = shuffle(q.choices || []);

    if($("choicesEl")){
      $("choicesEl").innerHTML = choices.map(choice => `
        <button class="choice-btn" type="button" data-choice="${escapeHtml(choice)}">
          ${escapeHtml(choice)}
        </button>
      `).join("");

      document.querySelectorAll(".choice-btn").forEach(btn => {
        btn.addEventListener("click",() => handleAnswer(btn.dataset.choice));
      });
    }

    if($("feedbackBox")){
      $("feedbackBox").hidden = true;
      $("feedbackBox").className = "feedback-box";
    }

    if($("nextBtn")) $("nextBtn").disabled = true;

    if($("aiHelpBtn")){
      $("aiHelpBtn").textContent = state.session === "BG5"
        ? "AI Help 0"
        : `AI Help ${state.aiHelp}`;

      $("aiHelpBtn").disabled = state.aiHelp <= 0 || state.selected || state.session === "BG5";
    }

    renderGameStats();
    startQuestionTimer();
  }

  function startQuestionTimer(){
    clearQuestionTimer();

    questionTimer = setInterval(() => {
      if(state.selected) return;

      if(state.isSpeedRun){
        state.timeLeft = Math.max(0,Math.ceil((state.speedDeadline - Date.now()) / 1000));
        state.timeLimit = Math.max(state.timeLimit,state.timeLeft);
      }else{
        state.timeLeft = Math.max(0,state.timeLeft - .1);
      }

      const pct = state.timeLimit ? clamp((state.timeLeft / state.timeLimit) * 100,0,100) : 0;

      if($("timeFill")) $("timeFill").style.width = `${pct}%`;

      if(state.timeLeft <= 0){
        handleTimeout();
      }
    },100);
  }

  function clearQuestionTimer(){
    if(questionTimer){
      clearInterval(questionTimer);
      questionTimer = null;
    }
  }

  function handleTimeout(){
    if(state.selected) return;

    const q = state.round[state.index];
    if(!q) return;

    handleAnswer("__TIMEOUT__");
  }

  function handleAnswer(choice){
    if(state.selected) return;

    clearQuestionTimer();

    const q = state.round[state.index];
    if(!q) return;

    state.selected = true;

    const answer = normalizeText(q.answer);
    const selected = normalizeText(choice);
    const isCorrect = selected === answer;

    document.querySelectorAll(".choice-btn").forEach(btn => {
      const value = normalizeText(btn.dataset.choice);

      btn.disabled = true;

      if(value === answer) btn.classList.add("correct");
      else if(value === selected) btn.classList.add("wrong");
      else btn.classList.add("dim");
    });

    if(isCorrect){
      state.correct += 1;
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo,state.combo);

      const speedBonus = state.timeLeft > state.timeLimit * .6 ? 8 : state.timeLeft > state.timeLimit * .3 ? 4 : 0;
      const comboBonus = Math.min(20,state.combo * 2);
      const base = q.level === "B1+" ? 28 : q.level === "B1" ? 22 : q.level === "A2+" ? 18 : 14;

      state.xp += base + comboBonus + speedBonus;

      if(state.isBoss){
        const bossBonus =
          state.session === "BG5" ? 140 :
          state.session === "BG4" ? 100 :
          state.session === "BG3" ? 90 :
          state.session === "BG2" ? 75 :
          60;

        const damage = bossBonus + comboBonus + speedBonus;
        state.bossHp = Math.max(0,state.bossHp - damage);
      }

      showFeedback(true,"ถูกต้อง!",q.explanation);
    }else{
      state.wrong += 1;
      state.combo = 0;

      if(q.word && !state.weakWords.includes(q.word)){
        state.weakWords.push(q.word);
      }

      if(state.isBoss){
        state.bossHp = Math.min(state.bossMaxHp,state.bossHp + 20);
      }

      const msg = choice === "__TIMEOUT__"
        ? `หมดเวลา • คำตอบคือ “${q.answer}”`
        : `คำตอบที่ถูกคือ “${q.answer}”`;

      showFeedback(false,"ยังไม่ถูก",`${msg}. ${q.explanation || ""}`);
    }

    const stats = loadStats();
    updateWordStats(stats,q,isCorrect);
    saveStats(stats);

    if($("nextBtn")){
      $("nextBtn").disabled = false;
      $("nextBtn").textContent = state.index >= state.round.length - 1 ? "ดูสรุปผล" : "ข้อต่อไป";
    }

    if($("aiHelpBtn")) $("aiHelpBtn").disabled = true;

    renderGameStats();
  }

  function showFeedback(good,title,text){
    const box = $("feedbackBox");
    if(!box) return;

    box.hidden = false;
    box.className = `feedback-box ${good ? "good" : "bad"}`;

    if($("feedbackTitle")) $("feedbackTitle").textContent = title;
    if($("feedbackText")) $("feedbackText").textContent = text || "";
  }

  function nextQuestion(){
    if(!state.selected) return;

    state.index += 1;

    if(state.isSpeedRun && Date.now() >= state.speedDeadline){
      finishRound();
      return;
    }

    if(state.index >= state.round.length){
      finishRound();
      return;
    }

    renderQuestion();
  }

  function renderGameStats(){
    const acc = percent(state.correct,state.correct + state.wrong);

    const boss = state.isBoss
      ? `<div class="mini"><b>${Math.max(0,state.bossHp)}</b><span>Boss HP</span></div>`
      : `<div class="mini"><b>${state.weakWords.length}</b><span>Weak Words</span></div>`;

    if($("gameStats")){
      $("gameStats").innerHTML = `
        <div class="mini"><b>${state.correct}</b><span>Correct</span></div>
        <div class="mini"><b>${state.wrong}</b><span>Wrong</span></div>
        <div class="mini"><b>${acc}%</b><span>Accuracy</span></div>
        <div class="mini"><b>${state.xp}</b><span>XP</span></div>
        <div class="mini"><b>${state.combo}</b><span>Combo</span></div>
        <div class="mini"><b>${state.maxCombo}</b><span>Max Combo</span></div>
        ${boss}
        <div class="mini"><b>${Math.max(0,Math.ceil(state.timeLeft))}</b><span>Time</span></div>
      `;
    }
  }

  function useAiHelp(){
    if(state.selected) return;
    if(state.session === "BG5") return;
    if(state.aiHelp <= 0) return;

    const q = state.round[state.index];
    if(!q) return;

    const wrongButtons = Array.from(document.querySelectorAll(".choice-btn"))
      .filter(btn => normalizeText(btn.dataset.choice) !== normalizeText(q.answer) && !btn.disabled);

    sample(wrongButtons,Math.min(2,wrongButtons.length)).forEach(btn => {
      btn.disabled = true;
      btn.classList.add("dim");
    });

    state.aiHelp -= 1;

    if($("aiHelpBtn")){
      $("aiHelpBtn").textContent = `AI Help ${state.aiHelp}`;
      $("aiHelpBtn").disabled = state.aiHelp <= 0;
    }

    showToast("AI Help: ตัดตัวเลือกหลอกออกแล้ว");
  }

  function finishRound(){
    clearQuestionTimer();

    const total = state.correct + state.wrong;
    const acc = percent(state.correct,total);
    const passedThisRound = isRoundPassed(state.session,acc);
    const nextMission = getNextMissionId(state.session,passedThisRound);

    state.nextMission = nextMission;

    const stats = loadStats();
    const profile = loadProfile();
    const now = new Date().toISOString();

    if(!stats.sessions[state.session]){
      stats.sessions[state.session] = normalizeSessionStats(null);
    }

    const s = stats.sessions[state.session];

    s.rounds = Number(s.rounds || 0) + 1;
    s.correct = Number(s.correct || 0) + state.correct;
    s.total = Number(s.total || 0) + total;
    s.xp = Number(s.xp || 0) + state.xp;
    s.lastPlayed = now;
    s.played = true;
    s.bestAccuracy = Math.max(Number(s.bestAccuracy || 0),acc);
    s.bestXp = Math.max(Number(s.bestXp || 0),state.xp);

    if(passedThisRound){
      s.passed = true;
      s.lastPassed = now;
    }

    stats.rounds = Number(stats.rounds || 0) + 1;
    stats.correct = Number(stats.correct || 0) + state.correct;
    stats.total = Number(stats.total || 0) + total;
    stats.totalXp = Number(stats.totalXp || 0) + state.xp;
    stats.profileSnapshot = profile;

    stats.history = Array.isArray(stats.history) ? stats.history : [];
    stats.history.unshift({
      at:now,
      profile,
      section:profile.section || "101",
      studentName:profile.studentName || "",
      studentId:profile.studentId || "",
      session:state.session,
      name:getSessionName(state.session),
      mode:state.mode,
      questions:total,
      correct:state.correct,
      accuracy:acc,
      passed:passedThisRound,
      xp:state.xp,
      maxCombo:state.maxCombo,
      weakWords:state.weakWords.slice(),
      isBoss:state.isBoss,
      bossHp:state.bossHp,
      bossMaxHp:state.bossMaxHp,
      isWeakTraining:state.isWeakTraining,
      isDailyChallenge:state.isDailyChallenge,
      isSpeedRun:state.isSpeedRun
    });

    stats.history = stats.history.slice(0,80);

    saveStats(stats);

    const stars = acc >= 90 ? "⭐⭐⭐" : acc >= 75 ? "⭐⭐" : acc >= 60 ? "⭐" : "💪";
    const passText = passedThisRound ? "ผ่านแล้ว" : state.isBoss ? "ยังไม่ผ่าน Boss Gate" : "ยังไม่ผ่าน";
    const bossText = state.isBoss
      ? ` • Boss HP เหลือ ${Math.max(0,state.bossHp)}/${state.bossMaxHp}`
      : "";

    if($("summaryStars")) $("summaryStars").textContent = stars;

    if($("summaryTitle")){
      if(state.session === "BG5" && passedThisRound){
        $("summaryTitle").textContent = "Final Boss Gate Cleared!";
      }else if(state.isBoss && passedThisRound){
        $("summaryTitle").textContent = "Boss Gate Cleared!";
      }else{
        $("summaryTitle").textContent = passedThisRound ? "Mission Passed!" : "Mission Complete";
      }
    }

    if($("summarySubtitle")){
      $("summarySubtitle").textContent =
        `${getSessionName(state.session)} • ${passText} • Accuracy ${acc}%${bossText}`;
    }

    if($("summaryStats")){
      $("summaryStats").innerHTML = `
        <div class="stat"><b>${state.correct}/${total}</b><span>Correct</span></div>
        <div class="stat"><b>${acc}%</b><span>Accuracy</span></div>
        <div class="stat"><b>${state.xp}</b><span>XP</span></div>
        <div class="stat"><b>${state.maxCombo}</b><span>Max Combo</span></div>
        <div class="stat"><b>${passedThisRound ? "YES" : "NO"}</b><span>Passed</span></div>
        <div class="stat"><b>${escapeHtml(nextMission)}</b><span>Next Mission</span></div>
      `;
    }

    if($("summaryWeakWords")){
      $("summaryWeakWords").innerHTML = state.weakWords.length
        ? state.weakWords.map(w => `<span class="word-pill">${escapeHtml(w)}</span>`).join("")
        : `<span class="tag good">ไม่มี Weak Words ในรอบนี้</span>`;
    }

    const nextBtn = $("nextMissionBtn");
    if(nextBtn){
      if(passedThisRound){
        nextBtn.textContent = nextMission === state.session
          ? "จบคอร์ส / กลับหน้าแรก"
          : `ไปด่านถัดไป: ${nextMission}`;
      }else{
        nextBtn.textContent = `ลองอีกครั้ง: ${state.session}`;
      }
    }

    polishMobileAfterRender();
    setScreen("summaryScreen");
  }

  /* =========================================================
     Word Deck
  ========================================================= */

  function getDeckWords(){
    const stats = loadStats();
    const map = new Map();

    QUESTION_BANK
      .filter(q => CONTENT_SESSIONS.includes(q.session))
      .forEach(q => {
        if(!map.has(q.word)){
          map.set(q.word,{
            word:q.word,
            session:q.session,
            level:q.level,
            meaning:"",
            types:new Set()
          });
        }

        const item = map.get(q.word);
        item.types.add(q.type);
      });

    return Array.from(map.values()).map(item => {
      const w = stats.words[item.word] ? normalizeWordStats(stats.words[item.word]) : normalizeWordStats(null);

      return {
        word:item.word,
        session:item.session,
        level:item.level,
        seen:w.seen,
        correct:w.correct,
        wrong:w.wrong,
        accuracy:percent(w.correct,w.seen),
        mastery:masteryLabel(w),
        types:Array.from(item.types)
      };
    }).sort((a,b) => {
      const ai = CONTENT_SESSIONS.indexOf(a.session);
      const bi = CONTENT_SESSIONS.indexOf(b.session);

      if(ai !== bi) return ai - bi;

      return a.word.localeCompare(b.word);
    });
  }

  function renderWordDeck(){
    const words = getDeckWords();
    const sessionFilter = $("deckSessionFilter") ? $("deckSessionFilter").value : "ALL";
    const masteryFilter = $("deckMasteryFilter") ? $("deckMasteryFilter").value : "ALL";

    let filtered = words;

    if(sessionFilter !== "ALL"){
      filtered = filtered.filter(w => w.session === sessionFilter);
    }

    if(masteryFilter === "Weak"){
      filtered = filtered.filter(w => w.mastery === "Weak" || w.wrong > 0);
    }else if(masteryFilter !== "ALL"){
      filtered = filtered.filter(w => w.mastery === masteryFilter);
    }

    if($("deckStats")){
      const mastered = words.filter(w => w.mastery === "Mastered").length;
      const weak = words.filter(w => w.mastery === "Weak" || w.wrong > 0).length;

      $("deckStats").innerHTML = `
        <div class="stat"><b>${words.length}</b><span>Total Words</span></div>
        <div class="stat"><b>${mastered}</b><span>Mastered</span></div>
        <div class="stat"><b>${weak}</b><span>Weak</span></div>
        <div class="stat"><b>${filtered.length}</b><span>Shown</span></div>
      `;
    }

    const grid = $("wordDeckGrid");
    if(!grid) return;

    if(!filtered.length){
      grid.innerHTML = `<div class="deck-empty">ไม่พบคำศัพท์ตามตัวกรองนี้</div>`;
      polishMobileAfterRender();
      return;
    }

    grid.innerHTML = filtered.map(w => {
      const cls = w.mastery === "Mastered" ? "mastered" : w.mastery === "Weak" ? "weak" : "";
      const meter = clamp(w.accuracy,0,100);

      return `
        <article class="word-card2 ${cls}">
          <div class="word-card-head">
            <div>
              <h4>${escapeHtml(w.word)}</h4>
              <small>${escapeHtml(w.session)} • ${escapeHtml(w.level)} • ${escapeHtml(w.types.join(", "))}</small>
            </div>
            <span class="tag ${w.mastery === "Mastered" ? "good" : w.mastery === "Weak" ? "bad" : "primary"}">
              ${escapeHtml(w.mastery)}
            </span>
          </div>

          <div class="mastery-meter">
            <div class="mastery-fill" style="width:${meter}%"></div>
          </div>

          <div class="session-meta">
            <span class="tag">Seen ${w.seen}</span>
            <span class="tag good">Correct ${w.correct}</span>
            <span class="tag bad">Wrong ${w.wrong}</span>
            <span class="tag primary">${w.accuracy}%</span>
          </div>
        </article>
      `;
    }).join("");

    polishMobileAfterRender();
  }

  /* =========================================================
     Teacher Dashboard / Export
  ========================================================= */

  function getMissionAccuracy(sessionId){
    const stats = loadStats();
    const s = stats.sessions && stats.sessions[sessionId];

    if(!s || !s.total) return 0;

    return Math.round((Number(s.correct || 0) / Number(s.total || 0)) * 100);
  }

  function getMissionSummaryRows(){
    return COURSE_FLOW.map(id => {
      const p = getSessionProgress(id);
      const acc = getMissionAccuracy(id);
      const threshold = sessionPassThreshold(id);
      const isBoss = isBossGate(id);

      return {
        mission:id,
        name:getSessionName(id),
        type:isBoss ? "Boss Gate" : "Session",
        unlocked:isMissionUnlocked(id),
        played:p.played,
        passed:p.passed,
        rounds:p.rounds,
        bestAccuracy:p.bestAccuracy || 0,
        averageAccuracy:acc,
        bestXp:p.bestXp || 0,
        threshold:threshold,
        requirement:isBoss
          ? `Accuracy ≥ ${threshold}% and Boss HP = 0`
          : `Accuracy ≥ ${threshold}%`
      };
    });
  }

  function getWeakPriorityWords(limit){
    const stats = loadStats();

    return Object.entries(stats.words || {})
      .filter(([,w]) => Number(w.wrong || 0) > 0)
      .map(([word,w]) => {
        const seen = Number(w.seen || 0);
        const correct = Number(w.correct || 0);
        const wrong = Number(w.wrong || 0);
        const acc = seen ? Math.round((correct / seen) * 100) : 0;
        const sessions = Object.keys(w.sessions || {});
        const types = Object.keys(w.types || {});
        const priorityScore = (wrong * 3) + Math.max(0,70 - acc) + Math.min(10,seen);

        return {
          word,
          seen,
          correct,
          wrong,
          accuracy:acc,
          mastery:masteryLabel(w),
          sessions:sessions.join("/"),
          types:types.join("/"),
          lastSeen:w.lastSeen || "",
          priorityScore
        };
      })
      .sort((a,b) => {
        if(b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
        if(b.wrong !== a.wrong) return b.wrong - a.wrong;

        return a.accuracy - b.accuracy;
      })
      .slice(0,limit || 15);
  }

  function getCourseCompletionReport(){
    const profile = loadProfile();
    const stats = loadStats();
    const rows = getMissionSummaryRows();

    const sessionRows = rows.filter(r => r.type === "Session");
    const bossRows = rows.filter(r => r.type === "Boss Gate");

    const passedSessions = sessionRows.filter(r => r.passed).length;
    const passedBossGates = bossRows.filter(r => r.passed).length;
    const passedMissions = rows.filter(r => r.passed).length;

    const completionPercent = rows.length
      ? Math.round((passedMissions / rows.length) * 100)
      : 0;

    const nextMission = getFirstUnlockedMission();
    const nextRow = rows.find(r => r.mission === nextMission);
    const weakPriority = getWeakPriorityWords(10);

    let courseStatus = "IN_PROGRESS";

    if(passedBossGates >= 5 && passedSessions >= 15){
      courseStatus = "COURSE_COMPLETE";
    }else if(nextRow && nextRow.type === "Boss Gate"){
      courseStatus = "BOSS_GATE_PENDING";
    }else if(weakPriority.length >= 8){
      courseStatus = "WEAK_WORD_REVIEW_RECOMMENDED";
    }

    return {
      exportedAt:new Date().toISOString(),
      appVersion:APP_VERSION,
      profile:{
        studentName:profile.studentName || "",
        studentId:profile.studentId || "",
        section:profile.section || "101"
      },
      courseStatus,
      completionPercent,
      passedMissions,
      totalMissions:rows.length,
      passedSessions,
      totalSessions:sessionRows.length,
      passedBossGates,
      totalBossGates:bossRows.length,
      nextRecommendedMission:nextMission,
      nextRecommendedMissionName:nextRow ? nextRow.name : "",
      totalXp:stats.totalXp || 0,
      totalRounds:stats.rounds || 0,
      overallAccuracy:percent(stats.correct || 0,stats.total || 0),
      weakPriorityCount:weakPriority.length,
      weakPriority,
      missions:rows
    };
  }

  function renderTeacherDashboard(){
    const profile = loadProfile();
    const stats = loadStats();
    const allDeck = getDeckWords();
    const masteredWords = allDeck.filter(w => w.mastery === "Mastered");
    const weakWords = getWeakPriorityWords(20);
    const overallAcc = percent(stats.correct,stats.total);
    const course = getCourseCompletionReport();

    if($("teacherProfileBox")){
      $("teacherProfileBox").innerHTML = `
        <b>Student:</b> ${escapeHtml(profile.studentName || "-")}
        &nbsp; <b>ID:</b> ${escapeHtml(profile.studentId || "-")}
        &nbsp; <b>Section:</b> ${escapeHtml(profile.section || "101")}
        <br>
        <b>Status:</b> ${escapeHtml(course.courseStatus)}
        &nbsp; <b>Next:</b> ${escapeHtml(course.nextRecommendedMission)}
      `;
    }

    if($("teacherStats")){
      $("teacherStats").innerHTML = `
        <div class="stat"><b>${stats.rounds}</b><span>Total Rounds</span></div>
        <div class="stat"><b>${stats.totalXp}</b><span>Total XP</span></div>
        <div class="stat"><b>${overallAcc}%</b><span>Overall Accuracy</span></div>
        <div class="stat"><b>${masteredWords.length}/${allDeck.length}</b><span>Mastered Cards</span></div>
        <div class="stat"><b>${course.completionPercent}%</b><span>Course Completion</span></div>
        <div class="stat"><b>${course.passedSessions}/${course.totalSessions}</b><span>Sessions Passed</span></div>
        <div class="stat"><b>${course.passedBossGates}/${course.totalBossGates}</b><span>Boss Gates Passed</span></div>
        <div class="stat"><b>${escapeHtml(course.nextRecommendedMission)}</b><span>Next Mission</span></div>
        <div class="stat"><b>${escapeHtml(profile.section || "101")}</b><span>Section</span></div>
        <div class="stat"><b>${escapeHtml(profile.studentId || "-")}</b><span>Student ID</span></div>
      `;
    }

    renderSessionProgress(stats);
    renderWeakWordsTable(stats,weakWords);
    renderMasteryOverview(stats,allDeck);
    renderRecentRounds(stats);
    polishMobileAfterRender();
  }

  function renderSessionProgress(stats){
    const rows = getMissionSummaryRows();

    if(!rows.length){
      $("sessionProgressBody").innerHTML = `<tr><td colspan="9">ยังไม่มีข้อมูลการเล่น</td></tr>`;
      return;
    }

    $("sessionProgressBody").innerHTML = rows.map(r => {
      const s = stats.sessions && stats.sessions[r.mission] ? stats.sessions[r.mission] : {};
      const lockedText = r.unlocked ? "" : `<br><span class="tag warn">Locked</span>`;
      const passText = r.passed ? `<span class="tag good">YES</span>` : "-";

      return `
        <tr>
          <td>
            <b>${escapeHtml(r.mission)}</b><br>
            <span class="empty">${escapeHtml(r.name)}</span>
            ${lockedText}
          </td>
          <td>${s.rounds || 0}</td>
          <td>${s.total || 0}</td>
          <td>${s.correct || 0}</td>
          <td>${r.averageAccuracy}%</td>
          <td>${s.xp || 0}</td>
          <td>${passText}</td>
          <td>${r.bestAccuracy || 0}%</td>
          <td>${escapeHtml(formatDateTime(s.lastPlayed))}</td>
        </tr>
      `;
    }).join("");
  }

  function renderWeakWordsTable(stats,weakWords){
    const body = $("weakWordsTableBody");
    if(!body) return;

    if(!weakWords.length){
      body.innerHTML = `<tr><td colspan="6">ยังไม่มี Weak Words</td></tr>`;
      return;
    }

    body.innerHTML = weakWords.map(w => `
      <tr>
        <td><b>${escapeHtml(w.word)}</b></td>
        <td>${w.seen}</td>
        <td>${w.correct}</td>
        <td>${w.wrong}</td>
        <td>${w.accuracy}%</td>
        <td><span class="tag ${w.mastery === "Weak" ? "bad" : "primary"}">${escapeHtml(w.mastery)}</span></td>
      </tr>
    `).join("");
  }

  function renderMasteryOverview(stats,deck){
    const body = $("masteryOverviewBody");
    if(!body) return;

    const groups = ["New","Learned","Familiar","Strong","Mastered","Weak"];

    body.innerHTML = groups.map(label => {
      const items = deck.filter(w => label === "Weak" ? (w.mastery === "Weak" || w.wrong > 0) : w.mastery === label);
      const examples = items.slice(0,8).map(w => w.word).join(", ");

      return `
        <tr>
          <td><span class="tag ${label === "Mastered" ? "good" : label === "Weak" ? "bad" : "primary"}">${label}</span></td>
          <td>${items.length}</td>
          <td>${escapeHtml(examples || "-")}</td>
        </tr>
      `;
    }).join("");
  }

  function renderRecentRounds(stats){
    const body = $("recentRoundsBody");
    if(!body) return;

    const rows = Array.isArray(stats.history) ? stats.history.slice(0,30) : [];

    if(!rows.length){
      body.innerHTML = `<tr><td colspan="10">ยังไม่มีประวัติการเล่น</td></tr>`;
      return;
    }

    body.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(formatDateTime(r.at))}</td>
        <td>${escapeHtml(r.studentName || "-")}</td>
        <td>${escapeHtml(r.section || "101")}</td>
        <td>${escapeHtml(r.session || "-")}</td>
        <td>${r.questions || 0}</td>
        <td>${r.correct || 0}</td>
        <td>${r.accuracy || 0}%</td>
        <td>${r.xp || 0}</td>
        <td>${r.passed ? `<span class="tag good">YES</span>` : "-"}</td>
        <td>${escapeHtml((r.weakWords || []).slice(0,8).join(", ") || "-")}</td>
      </tr>
    `).join("");
  }

  function exportDashboardJson(){
    const stats = loadStats();
    const course = getCourseCompletionReport();

    const payload = {
      exportedAt:new Date().toISOString(),
      appVersion:APP_VERSION,
      profile:loadProfile(),
      courseSummary:course,
      stats,
      deck:getDeckWords(),
      qaReport:window.EAP_QA_REPORT || null
    };

    downloadTextFile(
      `eap-word-quest-dashboard-${course.profile.studentId || "student"}-${todayLocalKey()}.json`,
      JSON.stringify(payload,null,2),
      "application/json;charset=utf-8"
    );

    showToast("Export JSON พร้อม Course Summary แล้ว");
  }

  function exportDashboardCsv(){
    const stats = loadStats();
    const profile = loadProfile();
    const course = getCourseCompletionReport();

    const lines = [];

    lines.push([
      "type",
      "studentName",
      "studentId",
      "section",
      "courseStatus",
      "completionPercent",
      "mission",
      "missionName",
      "missionType",
      "unlocked",
      "passed",
      "rounds",
      "questions",
      "correct",
      "wrong",
      "accuracy",
      "bestAccuracy",
      "xp",
      "word",
      "mastery",
      "priorityScore",
      "sessions",
      "types",
      "lastPlayed",
      "lastSeen",
      "recommendation"
    ].map(csvEscape).join(","));

    lines.push([
      "course_summary",
      profile.studentName || "",
      profile.studentId || "",
      profile.section || "101",
      course.courseStatus,
      course.completionPercent,
      course.nextRecommendedMission,
      course.nextRecommendedMissionName,
      "",
      "",
      "",
      course.totalRounds,
      stats.total || 0,
      stats.correct || 0,
      Math.max(0,(stats.total || 0) - (stats.correct || 0)),
      course.overallAccuracy,
      "",
      course.totalXp,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      `Next recommended mission: ${course.nextRecommendedMission}`
    ].map(csvEscape).join(","));

    course.missions.forEach(r => {
      const s = stats.sessions && stats.sessions[r.mission] ? stats.sessions[r.mission] : {};
      const wrong = Math.max(0,Number(s.total || 0) - Number(s.correct || 0));

      lines.push([
        "mission",
        profile.studentName || "",
        profile.studentId || "",
        profile.section || "101",
        course.courseStatus,
        course.completionPercent,
        r.mission,
        r.name,
        r.type,
        r.unlocked ? "YES" : "NO",
        r.passed ? "YES" : "NO",
        s.rounds || 0,
        s.total || 0,
        s.correct || 0,
        wrong,
        r.averageAccuracy || 0,
        r.bestAccuracy || 0,
        s.xp || 0,
        "",
        "",
        "",
        "",
        "",
        s.lastPlayed || "",
        "",
        r.requirement
      ].map(csvEscape).join(","));
    });

    Object.entries(stats.words || {}).forEach(([word,w]) => {
      const seen = Number(w.seen || 0);
      const correct = Number(w.correct || 0);
      const wrong = Number(w.wrong || 0);
      const acc = seen ? Math.round((correct / seen) * 100) : 0;

      lines.push([
        "word_mastery",
        profile.studentName || "",
        profile.studentId || "",
        profile.section || "101",
        course.courseStatus,
        course.completionPercent,
        "",
        "",
        "",
        "",
        "",
        "",
        seen,
        correct,
        wrong,
        acc,
        "",
        "",
        word,
        masteryLabel(w),
        "",
        Object.keys(w.sessions || {}).join("/"),
        Object.keys(w.types || {}).join("/"),
        "",
        w.lastSeen || "",
        wrong > 0 ? "Review recommended" : ""
      ].map(csvEscape).join(","));
    });

    course.weakPriority.forEach(w => {
      lines.push([
        "weak_priority",
        profile.studentName || "",
        profile.studentId || "",
        profile.section || "101",
        course.courseStatus,
        course.completionPercent,
        course.nextRecommendedMission,
        course.nextRecommendedMissionName,
        "",
        "",
        "",
        "",
        w.seen,
        w.correct,
        w.wrong,
        w.accuracy,
        "",
        "",
        w.word,
        w.mastery,
        w.priorityScore,
        w.sessions,
        w.types,
        "",
        w.lastSeen,
        "High priority weak word"
      ].map(csvEscape).join(","));
    });

    (stats.history || []).slice(0,60).forEach(r => {
      const wrong = Math.max(0,Number(r.questions || 0) - Number(r.correct || 0));

      lines.push([
        "recent_round",
        r.studentName || profile.studentName || "",
        r.studentId || profile.studentId || "",
        r.section || profile.section || "101",
        course.courseStatus,
        course.completionPercent,
        r.session || "",
        r.name || "",
        r.isBoss ? "Boss Gate" : "Session",
        "",
        r.passed ? "YES" : "NO",
        "",
        r.questions || 0,
        r.correct || 0,
        wrong,
        r.accuracy || 0,
        "",
        r.xp || 0,
        "",
        "",
        "",
        "",
        "",
        r.at || "",
        "",
        (r.weakWords || []).length ? `Weak: ${(r.weakWords || []).join("/")}` : ""
      ].map(csvEscape).join(","));
    });

    downloadTextFile(
      `eap-word-quest-dashboard-${profile.studentId || "student"}-${todayLocalKey()}.csv`,
      lines.join("\n"),
      "text/csv;charset=utf-8"
    );

    showToast("Export CSV พร้อม Course Summary แล้ว");
  }

  function clearLocalStats(){
    const ok = confirm("ล้างข้อมูลคะแนนในเครื่องนี้ทั้งหมดใช่ไหม? Profile จะยังอยู่");
    if(!ok) return;

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RECENT_KEY);
    localStorage.removeItem(DAILY_KEY);

    renderHomeStats();
    renderSessions();
    renderTeacherDashboard();

    showToast("ล้างข้อมูลคะแนนแล้ว");
  }

  /* =========================================================
     QA LOCK
  ========================================================= */

  function qaNormalize(value){
    return String(value == null ? "" : value).replace(/\s+/g," ").trim();
  }

  function qaHasBadDistractor(item){
    const badWords = [
      "banana",
      "chair",
      "weather",
      "sandwich",
      "shoe",
      "food menu",
      "travel plan",
      "classroom color",
      "option 1",
      "option 2",
      "option 3",
      "option 4",
      "near alternative"
    ];

    return (item.choices || []).some(choice => {
      const c = qaNormalize(choice).toLowerCase();
      return badWords.some(bad => c.includes(bad));
    });
  }

  function qaChoiceIssue(item){
    const choices = Array.isArray(item.choices) ? item.choices.map(qaNormalize) : [];
    const answer = qaNormalize(item.answer);
    const unique = new Set(choices.map(c => c.toLowerCase()));

    if(!item.id) return "missing-id";
    if(!item.session) return "missing-session";
    if(!item.word) return "missing-word";
    if(!item.type) return "missing-type";
    if(!item.level) return "missing-level";
    if(!answer) return "missing-answer";
    if(choices.length !== 4) return "choices-not-4";
    if(unique.size !== choices.length) return "duplicate-choices";
    if(!choices.includes(answer)) return "answer-not-in-choices";
    if(qaHasBadDistractor(item)) return "weak-distractor";

    return "";
  }

  function runEapQaLock(){
    const specs = window.EAP_VOCAB_SPECS || {};
    const bank = window.QUESTION_BANK || [];
    const sessions = CONTENT_SESSIONS.slice();

    const idMap = new Map();
    const duplicateIds = [];

    bank.forEach(item => {
      if(!item || !item.id) return;

      if(idMap.has(item.id)){
        duplicateIds.push(item.id);
      }else{
        idMap.set(item.id,true);
      }
    });

    const issueItems = bank
      .map(item => ({
        id:item && item.id,
        session:item && item.session,
        word:item && item.word,
        type:item && item.type,
        level:item && item.level,
        issue:qaChoiceIssue(item || {})
      }))
      .filter(row => row.issue);

    const sessionRows = sessions.map(sessionId => {
      const words = specs[sessionId] && Array.isArray(specs[sessionId].words)
        ? specs[sessionId].words.length
        : 0;

      const items = bank.filter(q => q.session === sessionId).length;
      const badChoices = issueItems.filter(q => q.session === sessionId).length;

      const levels = {
        A2:bank.filter(q => q.session === sessionId && q.level === "A2").length,
        "A2+":bank.filter(q => q.session === sessionId && q.level === "A2+").length,
        B1:bank.filter(q => q.session === sessionId && q.level === "B1").length,
        "B1+":bank.filter(q => q.session === sessionId && q.level === "B1+").length
      };

      const hardItems = bank.filter(q =>
        q.session === sessionId &&
        (
          q.type === "near_miss" ||
          q.type === "word_form" ||
          q.type === "academic_phrase" ||
          q.type === "academic_upgrade"
        )
      ).length;

      const status =
        words >= 20 &&
        items >= 160 &&
        badChoices === 0
          ? "PASS"
          : "CHECK";

      return {
        session:sessionId,
        words,
        items,
        expectedMinItems:160,
        A2:levels.A2,
        A2plus:levels["A2+"],
        B1:levels.B1,
        B1plus:levels["B1+"],
        hardItems,
        badChoices,
        status
      };
    });

    const bossRows = BOSS_SESSIONS.map(gateId => {
      const cfg = getBossGateConfig(gateId);
      const pool = getPoolBySession(gateId);
      const sessionsInGate = cfg && cfg.sessions ? cfg.sessions : [];
      const bySession = {};

      sessionsInGate.forEach(s => {
        bySession[s] = pool.filter(q => q.session === s).length;
      });

      const hardPool = pool.filter(q =>
        q.type === "near_miss" ||
        q.type === "word_form" ||
        q.type === "academic_phrase" ||
        q.type === "academic_upgrade"
      ).length;

      const minPool = gateId === "BG5" ? 2400 : 480;
      const minRound = cfg && cfg.minRound ? cfg.minRound : (gateId === "BG5" ? 30 : 24);

      return {
        gate:gateId,
        label:cfg ? cfg.label : gateId,
        minRound,
        pool:pool.length,
        hardPool,
        sessions:sessionsInGate.join("/"),
        distribution:JSON.stringify(bySession),
        status:pool.length >= minPool && hardPool >= Math.round(pool.length * 0.35) ? "PASS" : "CHECK"
      };
    });

    const totalWords = sessionRows.reduce((sum,row) => sum + row.words,0);
    const totalItems = bank.length;
    const weakDistractors = bank.filter(qaHasBadDistractor).length;

    const summary = {
      version:APP_VERSION,
      totalWords,
      totalItems,
      duplicateIds:duplicateIds.length,
      choiceIssues:issueItems.length,
      weakDistractors,
      sessionsPass:sessionRows.filter(r => r.status === "PASS").length + "/" + sessionRows.length,
      bossGatesPass:bossRows.filter(r => r.status === "PASS").length + "/" + bossRows.length,
      finalStatus:
        totalWords >= 300 &&
        totalItems >= 2400 &&
        duplicateIds.length === 0 &&
        issueItems.length === 0 &&
        sessionRows.every(r => r.status === "PASS") &&
        bossRows.every(r => r.status === "PASS")
          ? "QA PASS"
          : "QA CHECK"
    };

    console.group("[EAP Word Quest] QA LOCK v1.5.1");
    console.log("Summary:",summary);
    console.table(sessionRows);
    console.table(bossRows);

    if(duplicateIds.length){
      console.warn("Duplicate IDs:",duplicateIds.slice(0,50));
    }

    if(issueItems.length){
      console.warn("Choice / Item issues:",issueItems.slice(0,80));
    }

    console.groupEnd();

    window.EAP_QA_REPORT = {
      summary,
      sessions:sessionRows,
      bossGates:bossRows,
      duplicateIds,
      issueItems
    };

    return window.EAP_QA_REPORT;
  }

  window.runEapQaLock = runEapQaLock;

  /* =========================================================
     TEST HARDENING
  ========================================================= */

  function testNow(){
    return new Date().toISOString();
  }

  function testValidMissionId(sessionId){
    return COURSE_FLOW.includes(sessionId);
  }

  function testPassAccuracy(sessionId){
    return sessionId === "BG5" ? 80 : isBossGate(sessionId) ? 75 : 70;
  }

  function testQuestionCount(sessionId){
    if(sessionId === "BG5") return 30;
    if(isBossGate(sessionId)) return 24;

    return 12;
  }

  function testXp(sessionId){
    if(sessionId === "BG5") return 900;
    if(isBossGate(sessionId)) return 650;

    return 260;
  }

  function testRefreshUi(message){
    try{
      renderHomeStats();
      renderSessions();

      if($("teacherScreen") && $("teacherScreen").classList.contains("active")){
        renderTeacherDashboard();
      }

      if(message){
        showToast(message);
      }
    }catch(err){
      console.warn("[EAP Word Quest] Test UI refresh warning:",err);
    }
  }

  function testSetSessionProgress(sessionId,passed,accuracy){
    if(!testValidMissionId(sessionId)){
      console.warn("[EAP Word Quest] Invalid mission id:",sessionId);
      return null;
    }

    const stats = loadStats();
    const profile = loadProfile();
    const now = testNow();
    const total = testQuestionCount(sessionId);
    const acc = Number(accuracy || (passed ? testPassAccuracy(sessionId) : 45));
    const correct = Math.max(0,Math.min(total,Math.round((acc / 100) * total)));
    const xp = passed ? testXp(sessionId) : 40;

    if(!stats.sessions[sessionId]){
      stats.sessions[sessionId] = normalizeSessionStats(null);
    }

    stats.sessions[sessionId].rounds = Number(stats.sessions[sessionId].rounds || 0) + 1;
    stats.sessions[sessionId].correct = Number(stats.sessions[sessionId].correct || 0) + correct;
    stats.sessions[sessionId].total = Number(stats.sessions[sessionId].total || 0) + total;
    stats.sessions[sessionId].xp = Number(stats.sessions[sessionId].xp || 0) + xp;
    stats.sessions[sessionId].lastPlayed = now;
    stats.sessions[sessionId].played = true;
    stats.sessions[sessionId].bestAccuracy = Math.max(Number(stats.sessions[sessionId].bestAccuracy || 0),acc);
    stats.sessions[sessionId].bestXp = Math.max(Number(stats.sessions[sessionId].bestXp || 0),xp);

    if(passed){
      stats.sessions[sessionId].passed = true;
      stats.sessions[sessionId].lastPassed = now;
    }

    stats.rounds = Number(stats.rounds || 0) + 1;
    stats.correct = Number(stats.correct || 0) + correct;
    stats.total = Number(stats.total || 0) + total;
    stats.totalXp = Number(stats.totalXp || 0) + xp;
    stats.profileSnapshot = profile;

    stats.history = Array.isArray(stats.history) ? stats.history : [];
    stats.history.unshift({
      at:now,
      profile,
      section:profile.section || "101",
      studentName:profile.studentName || "",
      studentId:profile.studentId || "",
      session:sessionId,
      name:getSessionName(sessionId),
      mode:"TEST",
      questions:total,
      correct,
      accuracy:acc,
      passed:Boolean(passed),
      xp,
      weakWords:[],
      isBoss:isBossGate(sessionId),
      isWeakTraining:false,
      isDailyChallenge:false,
      isSpeedRun:false,
      testMode:true
    });

    stats.history = stats.history.slice(0,60);
    saveStats(stats);

    return {
      session:sessionId,
      passed:Boolean(passed),
      accuracy:acc,
      correct,
      total,
      xp
    };
  }

  function simulatePass(sessionId,accuracy){
    const result = testSetSessionProgress(sessionId,true,accuracy);

    if(result){
      console.info("[EAP Word Quest] simulatePass:",result);
      testRefreshUi(`TEST PASS: ${sessionId}`);
    }

    return result;
  }

  function simulateFail(sessionId,accuracy){
    const result = testSetSessionProgress(sessionId,false,accuracy || 45);

    if(result){
      console.info("[EAP Word Quest] simulateFail:",result);
      testRefreshUi(`TEST FAIL: ${sessionId}`);
    }

    return result;
  }

  function unlockAllForTest(){
    const results = COURSE_FLOW.map(id => testSetSessionProgress(id,true,testPassAccuracy(id)));

    console.table(results);
    testRefreshUi("TEST: Unlock all missions completed");

    return results;
  }

  function resetCourseProgressOnly(){
    const stats = loadStats();

    stats.sessions = {};
    stats.history = [];
    stats.rounds = 0;
    stats.correct = 0;
    stats.total = 0;
    stats.totalXp = 0;

    saveStats(stats);

    localStorage.removeItem(RECENT_KEY);
    localStorage.removeItem(DAILY_KEY);

    testRefreshUi("TEST: Course progress reset");

    console.info("[EAP Word Quest] Course progress reset. Word mastery was kept.");

    return loadStats();
  }

  function resetAllGameStatsExceptProfile(){
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RECENT_KEY);
    localStorage.removeItem(DAILY_KEY);

    testRefreshUi("TEST: All game stats reset");

    console.info("[EAP Word Quest] All game stats reset. Student profile was kept.");

    return loadStats();
  }

  function setTestProfile(name,id,section){
    const profile = saveProfile({
      studentName:name || "Test Student",
      studentId:id || "TEST001",
      section:section || "101"
    });

    renderProfile();
    testRefreshUi("TEST Profile ready");

    console.info("[EAP Word Quest] Test profile saved:",profile);

    return profile;
  }

  function printCourseProgress(){
    const rows = COURSE_FLOW.map(id => {
      const p = getSessionProgress(id);

      return {
        mission:id,
        name:getSessionName(id),
        unlocked:isMissionUnlocked(id),
        played:p.played,
        passed:p.passed,
        rounds:p.rounds,
        bestAccuracy:p.bestAccuracy,
        bestXp:p.bestXp
      };
    });

    console.table(rows);

    return rows;
  }

  function testBossGateDistribution(gateId,rounds){
    const id = gateId || "BG1";
    const n = Number(rounds || 5);

    if(!isBossGate(id)){
      console.warn("[EAP Word Quest] Not a boss gate:",id);
      return [];
    }

    const cfg = getBossGateConfig(id);
    const rows = [];

    for(let i = 1; i <= n; i++){
      const round = buildRound(id,"mixed",cfg ? cfg.minRound : 24);
      const bySession = {};
      const byType = {};
      const byLevel = {};

      round.forEach(q => {
        bySession[q.session] = (bySession[q.session] || 0) + 1;
        byType[q.type] = (byType[q.type] || 0) + 1;
        byLevel[q.level] = (byLevel[q.level] || 0) + 1;
      });

      const hardItems = round.filter(q =>
        q.type === "near_miss" ||
        q.type === "word_form" ||
        q.type === "academic_phrase" ||
        q.type === "academic_upgrade"
      ).length;

      rows.push({
        round:i,
        gate:id,
        total:round.length,
        hardItems,
        bySession:JSON.stringify(bySession),
        byLevel:JSON.stringify(byLevel),
        byType:JSON.stringify(byType),
        status:round.length >= (cfg ? cfg.minRound : 24) ? "PASS" : "CHECK"
      });
    }

    console.table(rows);

    return rows;
  }

  function backupTestStorage(){
    return {
      stats:localStorage.getItem(STORAGE_KEY),
      recent:localStorage.getItem(RECENT_KEY),
      daily:localStorage.getItem(DAILY_KEY),
      profile:localStorage.getItem(PROFILE_KEY)
    };
  }

  function restoreTestStorage(backup){
    if(!backup) return;

    if(backup.stats == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY,backup.stats);

    if(backup.recent == null) localStorage.removeItem(RECENT_KEY);
    else localStorage.setItem(RECENT_KEY,backup.recent);

    if(backup.daily == null) localStorage.removeItem(DAILY_KEY);
    else localStorage.setItem(DAILY_KEY,backup.daily);

    if(backup.profile == null) localStorage.removeItem(PROFILE_KEY);
    else localStorage.setItem(PROFILE_KEY,backup.profile);
  }

  function runCourseFlowSmokeTest(){
    const backup = backupTestStorage();
    const rows = [];

    try{
      setTestProfile("Smoke Test Student","SMOKE001","101");
      resetCourseProgressOnly();

      function snap(step){
        rows.push({
          step,
          S1:isMissionUnlocked("S1"),
          S2:isMissionUnlocked("S2"),
          S3:isMissionUnlocked("S3"),
          BG1:isMissionUnlocked("BG1"),
          S4:isMissionUnlocked("S4"),
          S5:isMissionUnlocked("S5"),
          S6:isMissionUnlocked("S6"),
          BG2:isMissionUnlocked("BG2"),
          S7:isMissionUnlocked("S7"),
          S8:isMissionUnlocked("S8"),
          S9:isMissionUnlocked("S9"),
          BG3:isMissionUnlocked("BG3"),
          S10:isMissionUnlocked("S10"),
          S11:isMissionUnlocked("S11"),
          S12:isMissionUnlocked("S12"),
          BG4:isMissionUnlocked("BG4"),
          S13:isMissionUnlocked("S13"),
          S14:isMissionUnlocked("S14"),
          S15:isMissionUnlocked("S15"),
          BG5:isMissionUnlocked("BG5")
        });
      }

      snap("initial");

      ["S1","S2","S3"].forEach(id => simulatePass(id));
      snap("after S1-S3");

      simulatePass("BG1");
      snap("after BG1");

      ["S4","S5","S6"].forEach(id => simulatePass(id));
      snap("after S4-S6");

      simulatePass("BG2");
      snap("after BG2");

      ["S7","S8","S9"].forEach(id => simulatePass(id));
      snap("after S7-S9");

      simulatePass("BG3");
      snap("after BG3");

      ["S10","S11","S12"].forEach(id => simulatePass(id));
      snap("after S10-S12");

      simulatePass("BG4");
      snap("after BG4");

      ["S13","S14","S15"].forEach(id => simulatePass(id));
      snap("after S13-S15");

      simulatePass("BG5");
      snap("after BG5");

      const checks = [
        rows[0].S1 === true && rows[0].S2 === true && rows[0].S3 === true && rows[0].BG1 === false,
        rows[1].BG1 === true,
        rows[2].S4 === true && rows[2].S5 === true && rows[2].S6 === true,
        rows[3].BG2 === true,
        rows[4].S7 === true && rows[4].S8 === true && rows[4].S9 === true,
        rows[5].BG3 === true,
        rows[6].S10 === true && rows[6].S11 === true && rows[6].S12 === true,
        rows[7].BG4 === true,
        rows[8].S13 === true && rows[8].S14 === true && rows[8].S15 === true,
        rows[9].BG5 === true
      ];

      const summary = {
        version:APP_VERSION,
        checksPassed:checks.filter(Boolean).length + "/" + checks.length,
        status:checks.every(Boolean) ? "SMOKE PASS" : "SMOKE CHECK"
      };

      console.group("[EAP Word Quest] Course Flow Smoke Test");
      console.log("Summary:",summary);
      console.table(rows);
      console.groupEnd();

      return {summary,rows};

    }finally{
      restoreTestStorage(backup);
      renderProfile();
      testRefreshUi("Smoke test finished; real data restored");
    }
  }

  window.setTestProfile = setTestProfile;
  window.simulatePass = simulatePass;
  window.simulateFail = simulateFail;
  window.unlockAllForTest = unlockAllForTest;
  window.resetCourseProgressOnly = resetCourseProgressOnly;
  window.resetAllGameStatsExceptProfile = resetAllGameStatsExceptProfile;
  window.printCourseProgress = printCourseProgress;
  window.testBossGateDistribution = testBossGateDistribution;
  window.runCourseFlowSmokeTest = runCourseFlowSmokeTest;

  window.eapTest = {
    setProfile:setTestProfile,
    pass:simulatePass,
    fail:simulateFail,
    unlockAll:unlockAllForTest,
    resetProgress:resetCourseProgressOnly,
    resetAll:resetAllGameStatsExceptProfile,
    progress:printCourseProgress,
    boss:testBossGateDistribution,
    smoke:runCourseFlowSmokeTest,
    qa:window.runEapQaLock
  };

  /* =========================================================
     Mobile UX Polish
  ========================================================= */

  function updateMobileClass(){
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    document.body.classList.toggle("is-mobile",Boolean(isMobile));
  }

  function wrapWideTablesForMobile(){
    const tables = document.querySelectorAll(
      "#teacherScreen table, #summaryScreen table, #wordDeckScreen table"
    );

    tables.forEach(table => {
      if(!table || !table.parentElement) return;
      if(table.parentElement.classList.contains("wide-table-wrap")) return;

      const wrap = document.createElement("div");
      wrap.className = "wide-table-wrap";

      table.parentElement.insertBefore(wrap,table);
      wrap.appendChild(table);
    });
  }

  function polishMobileAfterRender(){
    updateMobileClass();
    wrapWideTablesForMobile();
  }

  /* =========================================================
     FINAL RELEASE LOCK
  ========================================================= */

  function getFinalReleaseChecklist(){
    const qa = window.EAP_QA_REPORT && window.EAP_QA_REPORT.summary
      ? window.EAP_QA_REPORT.summary
      : null;

    const course = typeof getCourseCompletionReport === "function"
      ? getCourseCompletionReport()
      : null;

    const testHelpersReady =
      typeof window.runEapQaLock === "function" &&
      typeof window.runCourseFlowSmokeTest === "function" &&
      typeof window.printCourseProgress === "function" &&
      typeof window.testBossGateDistribution === "function";

    const exportReady =
      typeof exportDashboardCsv === "function" &&
      typeof exportDashboardJson === "function" &&
      typeof getCourseCompletionReport === "function";

    const bossReady = BOSS_SESSIONS.every(gateId => {
      const pool = getPoolBySession(gateId);
      const cfg = getBossGateConfig(gateId);
      const min = gateId === "BG5" ? 2400 : 480;

      return cfg && pool && pool.length >= min;
    });

    const profileSystemReady =
      typeof loadProfile === "function" &&
      typeof saveProfile === "function" &&
      PROFILE_KEY === "EAP_WORD_QUEST_PROFILE_V01";

    const mobileReady =
      typeof updateMobileClass === "function" &&
      typeof polishMobileAfterRender === "function";

    return [
      {
        id:"QA_PASS",
        label:"Content QA must pass",
        status:qa && qa.finalStatus === "QA PASS" ? "PASS" : "CHECK",
        evidence:qa ? qa.finalStatus : "QA report not available"
      },
      {
        id:"PROFILE_READY",
        label:"Student profile system ready",
        status:profileSystemReady ? "PASS" : "CHECK",
        evidence:"PROFILE_KEY / loadProfile / saveProfile"
      },
      {
        id:"BOSS_GATES_READY",
        label:"Boss Gates ready",
        status:bossReady ? "PASS" : "CHECK",
        evidence:BOSS_SESSIONS.map(g => `${g}:${getPoolBySession(g).length}`).join(" | ")
      },
      {
        id:"EXPORT_READY",
        label:"Teacher export ready",
        status:exportReady ? "PASS" : "CHECK",
        evidence:course ? `Course summary ready: ${course.totalMissions} missions` : "Course summary not available"
      },
      {
        id:"MOBILE_READY",
        label:"Mobile UX ready",
        status:mobileReady ? "PASS" : "CHECK",
        evidence:"updateMobileClass / polishMobileAfterRender"
      },
      {
        id:"TEST_HELPERS_READY",
        label:"Test helpers ready",
        status:testHelpersReady ? "PASS" : "CHECK",
        evidence:"QA / smoke / progress / boss distribution helpers"
      }
    ];
  }

  function printFinalReleaseChecklist(){
    const rows = getFinalReleaseChecklist();

    console.group("[EAP Word Quest] Final Release Checklist v1.5.1");
    console.table(rows);
    console.groupEnd();

    return rows;
  }

  function runFinalReleaseCheck(){
    let qaReport = null;
    let smokeReport = null;
    let smokeStatus = "CHECK";

    try{
      qaReport = runEapQaLock();
    }catch(err){
      console.warn("[EAP Word Quest] Final QA failed:",err);
    }

    try{
      smokeReport = runCourseFlowSmokeTest();
      smokeStatus = smokeReport &&
        smokeReport.summary &&
        smokeReport.summary.status === "SMOKE PASS"
          ? "PASS"
          : "CHECK";
    }catch(err){
      console.warn("[EAP Word Quest] Final smoke test failed:",err);
    }

    const checklist = getFinalReleaseChecklist();

    checklist.push({
      id:"SMOKE_PASS",
      label:"Course flow smoke test must pass",
      status:smokeStatus,
      evidence:smokeReport && smokeReport.summary ? smokeReport.summary.status : "Smoke report not available"
    });

    const allPass = checklist.every(row => row.status === "PASS");

    const report = {
      version:APP_VERSION,
      checkedAt:new Date().toISOString(),
      finalStatus:allPass ? "FINAL READY" : "FINAL CHECK",
      qaStatus:qaReport && qaReport.summary ? qaReport.summary.finalStatus : "QA CHECK",
      smokeStatus:smokeReport && smokeReport.summary ? smokeReport.summary.status : "SMOKE CHECK",
      checklist,
      qaReport,
      smokeReport
    };

    window.EAP_FINAL_RELEASE_REPORT = report;

    console.group("[EAP Word Quest] FINAL RELEASE CHECK v1.5.1");
    console.log("Final Status:",report.finalStatus);
    console.log("QA Status:",report.qaStatus);
    console.log("Smoke Status:",report.smokeStatus);
    console.table(checklist);
    console.groupEnd();

    if(report.finalStatus === "FINAL READY"){
      showToast("FINAL READY: EAP Word Quest พร้อมใช้สอนแล้ว");
    }else{
      showToast("FINAL CHECK: ยังมีจุดที่ต้องตรวจใน Console");
    }

    renderHomeStats();
    renderSessions();

    return report;
  }

  window.printFinalReleaseChecklist = printFinalReleaseChecklist;
  window.runFinalReleaseCheck = runFinalReleaseCheck;

  window.eapRelease = {
    checklist:printFinalReleaseChecklist,
    check:runFinalReleaseCheck,
    qa:window.runEapQaLock,
    smoke:window.runCourseFlowSmokeTest,
    progress:window.printCourseProgress
  };

  /* =========================================================
     Events
  ========================================================= */

  function bindEvents(){
    function on(id,event,handler){
      const el = $(id);
      if(el) el.addEventListener(event,handler);
    }

    on("quickStartBtn","click",() => startSession(getFirstUnlockedMission()));

    on("weakStartBtn","click",() => startWeakTraining());
    on("dailyBtn","click",() => startDailyChallenge());
    on("speedRunBtn","click",() => startSpeedRun());

    on("saveProfileBtn","click",() => handleSaveProfile());
    on("resetProfileBtn","click",() => resetProfile());

    ["studentNameInput","studentIdInput","sectionInput"].forEach(id => {
      const el = $(id);

      if(el){
        el.addEventListener("keydown",(e) => {
          if(e.key === "Enter"){
            handleSaveProfile();
          }
        });
      }
    });

    on("aiHelpBtn","click",() => useAiHelp());
    on("nextBtn","click",() => nextQuestion());

    on("quitBtn","click",() => {
      const ok = confirm("ออกจากรอบนี้และกลับหน้า Session ใช่ไหม?");
      if(!ok) return;

      clearQuestionTimer();
      setScreen("homeScreen");
      renderHomeStats();
      renderSessions();
    });

    on("nextMissionBtn","click",() => {
      const target = state.nextMission || getFirstUnlockedMission();

      if(target === state.session && getSessionProgress(target).passed && target === "BG5"){
        setScreen("homeScreen");
        renderHomeStats();
        renderSessions();
        return;
      }

      startSession(target);
    });

    on("replayBtn","click",() => {
      if(state.isWeakTraining || state.session === "WEAK"){
        startWeakTraining();
      }else if(state.isDailyChallenge || state.session === "DAILY"){
        startDailyChallenge();
      }else if(state.isSpeedRun || state.session === "SPEED"){
        startSpeedRun();
      }else{
        startSession(state.session || "S1");
      }
    });

    on("homeBtn","click",() => {
      setScreen("homeScreen");
      renderHomeStats();
      renderSessions();
    });

    on("wordDeckBtn","click",() => {
      renderWordDeck();
      setScreen("wordDeckScreen");
    });

    on("summaryDeckBtn","click",() => {
      renderWordDeck();
      setScreen("wordDeckScreen");
    });

    on("deckBackBtn","click",() => {
      setScreen("homeScreen");
      renderHomeStats();
      renderSessions();
    });

    on("deckSessionFilter","change",() => renderWordDeck());
    on("deckMasteryFilter","change",() => renderWordDeck());

    on("teacherBtn","click",() => {
      renderTeacherDashboard();
      setScreen("teacherScreen");
    });

    on("summaryTeacherBtn","click",() => {
      renderTeacherDashboard();
      setScreen("teacherScreen");
    });

    on("teacherBackBtn","click",() => {
      setScreen("homeScreen");
      renderHomeStats();
      renderSessions();
    });

    on("teacherRefreshBtn","click",() => {
      renderTeacherDashboard();
      showToast("Dashboard updated");
    });

    on("exportCsvBtn","click",() => exportDashboardCsv());
    on("exportJsonBtn","click",() => exportDashboardJson());
    on("clearStatsBtn","click",() => clearLocalStats());
  }

  /* =========================================================
     Init
  ========================================================= */

  function init(){
    if($("versionPill")){
      $("versionPill").textContent = "Student Mode";
      $("versionPill").title = APP_VERSION;
    }

    renderProfile();
    bindEvents();

    updateMobileClass();

    window.addEventListener("resize",() => {
      updateMobileClass();
    });

    console.info("[EAP Word Quest] Engine ready:",{
      version:APP_VERSION,
      items:QUESTION_BANK.length,
      sessions:SESSIONS.length
    });

    try{
      runEapQaLock();
    }catch(err){
      console.warn("[EAP Word Quest] QA Lock could not run:",err);
    }

    console.info("[EAP Word Quest] Test helpers ready:",[
      "setTestProfile()",
      "simulatePass('S1')",
      "simulateFail('S1')",
      "unlockAllForTest()",
      "resetCourseProgressOnly()",
      "printCourseProgress()",
      "testBossGateDistribution('BG1',5)",
      "runCourseFlowSmokeTest()"
    ]);

    console.info("[EAP Word Quest] Export polish ready:",[
      "Course Summary",
      "Mission Progress",
      "Word Mastery",
      "Weak Priority",
      "Recent Rounds",
      "QA Report in JSON"
    ]);

    console.info("[EAP Word Quest] Mobile UX polish ready:",{
      mobileClass:"body.is-mobile",
      wideTables:"wide-table-wrap",
      version:APP_VERSION
    });

    console.info("[EAP Word Quest] Final release helpers ready:",[
      "printFinalReleaseChecklist()",
      "runFinalReleaseCheck()",
      "eapRelease.check()",
      "eapRelease.checklist()"
    ]);

    renderHomeStats();
    renderSessions();
    polishMobileAfterRender();
  }

  window.startSession = startSession;
  window.renderHomeStats = renderHomeStats;
  window.renderSessions = renderSessions;

  init();
})();
