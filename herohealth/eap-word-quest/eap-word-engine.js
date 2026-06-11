/* =========================================================
   EAP Word Quest • Academic Vocabulary Mission
   File: /herohealth/eap-word-quest/eap-word-engine.js
   Version: v1.4.0-FINAL-ACADEMIC-ARC
========================================================= */

"use strict";

(function(){
  /* =========================================================
     Constants
  ========================================================= */

  const APP_VERSION = window.APP_VERSION || "v1.4.0-FINAL-ACADEMIC-ARC";
  const SESSIONS = window.SESSIONS || [];
  const QUESTION_BANK = window.QUESTION_BANK || [];

  const STORAGE_KEY = "EAP_WORD_QUEST_STATS_V01";
  const RECENT_KEY = "EAP_WORD_QUEST_RECENT_V01";
  const DAILY_KEY = "EAP_WORD_QUEST_DAILY_V01";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";

  const LEVEL_XP = {
    "A2":10,
    "A2+":13,
    "B1":17,
    "B1+":22
  };

  const LEVEL_SECONDS = {
    "A2":13,
    "A2+":15,
    "B1":18,
    "B1+":22
  };

  const BOSS_SESSIONS = ["S3","S6","S9","S12","S15"];
  const PLAYABLE_SESSIONS = ["S1","S2","S4","S5","S7","S8","S10","S11","S13","S14"];

  /* =========================================================
     State
  ========================================================= */

  const state = {
    session:null,
    mode:"mixed",
    roundSize:12,
    questions:[],
    index:0,
    current:null,
    answered:false,
    timeLeft:0,
    timeMax:0,
    timer:null,

    xp:0,
    combo:0,
    maxCombo:0,
    correct:0,
    answers:[],
    weakWords:[],
    aiHelp:2,

    isBoss:false,
    isWeakTraining:false,
    isDailyChallenge:false,
    isSpeedRun:false,
    speedDeadline:0,
    dailyBonus:0,

    forcedEnd:false,
    bossHp:0,
    bossMaxHp:0,
    playerHp:100,
    bossBonusGiven:false
  };

  /* =========================================================
     DOM / Helpers
  ========================================================= */

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

  function shuffle(arr){
    const a = Array.isArray(arr) ? arr.slice() : [];
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function uniq(arr){
    return Array.from(new Set(arr));
  }

  function clamp(n,min,max){
    return Math.max(min,Math.min(max,n));
  }

  function percent(part,total){
    return total ? Math.round((part / total) * 100) : 0;
  }

  function todayLocalKey(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  function formatDateTime(iso){
    if(!iso) return "-";
    try{
      const d = new Date(iso);
      return d.toLocaleString("th-TH",{
        year:"numeric",
        month:"2-digit",
        day:"2-digit",
        hour:"2-digit",
        minute:"2-digit"
      });
    }catch(e){
      return iso;
    }
  }

  function downloadTextFile(filename,content,mime){
    const blob = new Blob([content],{type:mime || "text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value){
    const s = String(value == null ? "" : value);
    return `"${s.replace(/"/g,'""')}"`;
  }

  function showToast(message){
    const el = $("toast");
    if(!el) return;

    el.textContent = message;
    el.hidden = false;

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      el.hidden = true;
    }, 2500);
  }

  function setScreen(screenId){
    ["homeScreen","gameScreen","teacherScreen","wordDeckScreen","summaryScreen"].forEach(id => {
      const el = $(id);
      if(el) el.classList.remove("active");
    });

    const target = $(screenId);
    if(target) target.classList.add("active");

    window.scrollTo({top:0,behavior:"smooth"});
  }

  function typeLabel(type){
    const map = {
      meaning:"Meaning",
      sentence_fill:"Sentence Fill",
      context:"Context",
      collocation:"Collocation",
      academic_upgrade:"Academic Upgrade",
      academic_phrase:"Academic Phrase",
      trap:"Trap Room",
      word_form:"Word Form",
      near_miss:"Near Miss"
    };
    return map[type] || type;
  }

  function levelTag(level){
    const cls = level === "B1+" ? "bad" : level === "B1" ? "warn" : level === "A2+" ? "primary" : "good";
    return `<span class="tag ${cls}">${escapeHtml(level)}</span>`;
  }

  /* =========================================================
     Storage: Profile
  ========================================================= */

  function defaultProfile(){
    return {
      studentName:"",
      studentId:"",
      section:"101",
      updatedAt:null
    };
  }

  function loadProfile(){
    try{
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY));
      return Object.assign(defaultProfile(),raw || {});
    }catch(e){
      return defaultProfile();
    }
  }

  function saveProfile(profile){
    const clean = Object.assign(defaultProfile(),profile || {});
    clean.studentName = String(clean.studentName || "").trim();
    clean.studentId = String(clean.studentId || "").trim();
    clean.section = String(clean.section || "101").trim() || "101";
    if(clean.section.toUpperCase() === "SEC01") clean.section = "101";
    clean.updatedAt = new Date().toISOString();

    localStorage.setItem(PROFILE_KEY,JSON.stringify(clean));
    return clean;
  }

  function getProfileLabel(){
    const p = loadProfile();
    const name = p.studentName || "No name";
    const sid = p.studentId || "No ID";
    const sec = p.section || "101";
    return `${name} • ${sid} • Section ${sec}`;
  }

  function isProfileReady(){
    const p = loadProfile();
    return Boolean(String(p.studentName || "").trim() && String(p.studentId || "").trim());
  }

  function requireProfile(actionName){
    if(isProfileReady()) return true;

    showToast(`กรุณาใส่ Student Name และ Student ID ก่อน${actionName ? "เพื่อ " + actionName : ""}`);
    renderProfile();
    setScreen("homeScreen");

    setTimeout(() => {
      const input = $("studentNameInput");
      if(input) input.focus();
    },120);

    return false;
  }

  function renderProfile(){
    const p = loadProfile();

    if($("studentNameInput")) $("studentNameInput").value = p.studentName || "";
    if($("studentIdInput")) $("studentIdInput").value = p.studentId || "";
    if($("sectionInput")) $("sectionInput").value = p.section || "101";

    if($("profileStatus")){
      const hasProfile = Boolean(p.studentName || p.studentId);
      $("profileStatus").innerHTML = `
        <span class="tag ${hasProfile ? "good" : "warn"}">
          ${hasProfile ? "Profile Saved" : "Profile Not Set"}
        </span>
        <span class="tag">Name: ${escapeHtml(p.studentName || "-")}</span>
        <span class="tag">ID: ${escapeHtml(p.studentId || "-")}</span>
        <span class="tag">Section: ${escapeHtml(p.section || "101")}</span>
      `;
    }
  }

  function handleSaveProfile(){
    const profile = saveProfile({
      studentName:$("studentNameInput").value,
      studentId:$("studentIdInput").value,
      section:$("sectionInput").value || "101"
    });

    renderProfile();
    renderHomeStats();
    renderSessions();

    showToast(`Profile saved: ${profile.studentName || "No name"} • Section ${profile.section}`);
  }

  function resetProfile(){
    const ok = confirm("ลบ Student Profile ในเครื่องนี้ใช่ไหม? คะแนนและประวัติการเล่นจะยังอยู่");
    if(!ok) return;

    localStorage.removeItem(PROFILE_KEY);
    renderProfile();
    renderHomeStats();
    renderSessions();

    showToast("Reset Profile แล้ว");
  }

  /* =========================================================
     Storage: Stats
  ========================================================= */

  function defaultStats(){
    return {
      totalXp:0,
      rounds:0,
      correct:0,
      total:0,
      words:{},
      sessions:{},
      history:[],
      profileSnapshot:null
    };
  }

  function normalizeStats(raw){
    const stats = Object.assign(defaultStats(),raw || {});

    if(!stats.words || typeof stats.words !== "object") stats.words = {};
    if(!stats.sessions || typeof stats.sessions !== "object") stats.sessions = {};
    if(!Array.isArray(stats.history)) stats.history = [];

    stats.totalXp = Number(stats.totalXp || 0);
    stats.rounds = Number(stats.rounds || 0);
    stats.correct = Number(stats.correct || 0);
    stats.total = Number(stats.total || 0);

    return stats;
  }

  function loadStats(){
    try{
      return normalizeStats(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    }catch(e){
      return defaultStats();
    }
  }

  function saveStats(stats){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(normalizeStats(stats)));
  }

  function loadRecent(){
    try{
      return JSON.parse(localStorage.getItem(RECENT_KEY)) || {};
    }catch(e){
      return {};
    }
  }

  function saveRecent(recent){
    localStorage.setItem(RECENT_KEY,JSON.stringify(recent || {}));
  }

  function loadDaily(){
    try{
      return JSON.parse(localStorage.getItem(DAILY_KEY)) || {
        lastBonusDate:null,
        completedDates:[],
        streak:0
      };
    }catch(e){
      return {lastBonusDate:null,completedDates:[],streak:0};
    }
  }

  function saveDaily(data){
    localStorage.setItem(DAILY_KEY,JSON.stringify(data || {}));
  }

  function claimDailyBonusIfNeeded(){
    if(!state.isDailyChallenge) return 0;

    const daily = loadDaily();
    const today = todayLocalKey();

    if(daily.lastBonusDate === today){
      state.dailyBonus = 0;
      return 0;
    }

    daily.lastBonusDate = today;

    if(!daily.completedDates.includes(today)){
      daily.completedDates.push(today);
    }

    daily.completedDates = daily.completedDates.slice(-30);
    daily.streak = (daily.streak || 0) + 1;

    saveDaily(daily);

    state.dailyBonus = 50;
    state.xp += 50;

    return 50;
  }

  /* =========================================================
     Progress / Mastery
  ========================================================= */

  function masteryLabel(wordStats){
    if(!wordStats || !wordStats.seen) return "New";

    const seen = wordStats.seen || 0;
    const correct = wordStats.correct || 0;
    const wrong = wordStats.wrong || 0;
    const acc = percent(correct,seen);
    const levels = Object.keys(wordStats.levels || {}).length;

    if(seen >= 8 && acc >= 88 && wrong <= 1 && levels >= 3) return "Mastered";
    if(seen >= 6 && acc >= 78 && levels >= 2) return "Strong";
    if(seen >= 4 && acc >= 65) return "Familiar";
    if(seen >= 2) return "Learned";
    return "New";
  }

  function masteryPercent(wordStats){
    const label = masteryLabel(wordStats);
    if(label === "Mastered") return 100;
    if(label === "Strong") return 75;
    if(label === "Familiar") return 50;
    if(label === "Learned") return 25;
    return 8;
  }

  function masteryClass(wordStats){
    const label = masteryLabel(wordStats);
    if(label === "Mastered") return "mastered";
    if(wordStats && (wordStats.wrong || 0) > 0) return "weak";
    return "";
  }

  function getSessionProgress(sessionId){
    const stats = loadStats();
    const s = stats.sessions && stats.sessions[sessionId];

    if(!s){
      return {
        played:false,
        passed:false,
        rounds:0,
        bestAccuracy:0,
        bestXp:0
      };
    }

    return {
      played:(s.rounds || 0) > 0,
      passed:Boolean(s.passed),
      rounds:s.rounds || 0,
      bestAccuracy:s.bestAccuracy || 0,
      bestXp:s.bestXp || 0
    };
  }

  function canUnlockBoss1(){
    return getSessionProgress("S1").passed && getSessionProgress("S2").passed;
  }

  function canUnlockCareerArc(){
    return getSessionProgress("S3").passed;
  }

  function canUnlockBoss2(){
    return getSessionProgress("S4").passed && getSessionProgress("S5").passed;
  }

  function canUnlockEmailArc(){
    return getSessionProgress("S6").passed;
  }

  function canUnlockBoss3(){
    return getSessionProgress("S7").passed && getSessionProgress("S8").passed;
  }

  function canUnlockTechnicalArc(){
    return getSessionProgress("S9").passed;
  }

  function canUnlockBoss4(){
    return getSessionProgress("S10").passed && getSessionProgress("S11").passed;
  }

  function canUnlockFinalArc(){
    return getSessionProgress("S12").passed;
  }

  function canUnlockFinalBoss(){
    return getSessionProgress("S13").passed && getSessionProgress("S14").passed;
  }

  function sessionPassThreshold(sessionId){
    if(sessionId === "S15") return 75;
    if(sessionId === "S3" || sessionId === "S6" || sessionId === "S9" || sessionId === "S12") return 70;
    if(sessionId === "DAILY" || sessionId === "SPEED" || sessionId === "WEAK") return 0;
    return 60;
  }

  function isRoundPassed(sessionId,acc){
    const threshold = sessionPassThreshold(sessionId);
    if(threshold <= 0) return false;

    if(BOSS_SESSIONS.includes(sessionId)){
      return acc >= threshold && state.bossHp <= 0;
    }

    return acc >= threshold;
  }

  function updateWordStats(q,isCorrect){
    const stats = loadStats();
    const now = new Date().toISOString();
    const key = q.word || q.answer || q.id;

    if(!stats.words[key]){
      stats.words[key] = {
        seen:0,
        correct:0,
        wrong:0,
        levels:{},
        types:{},
        sessions:{},
        lastSeen:null
      };
    }

    const w = stats.words[key];
    w.seen = (w.seen || 0) + 1;
    w.correct = (w.correct || 0) + (isCorrect ? 1 : 0);
    w.wrong = (w.wrong || 0) + (isCorrect ? 0 : 1);
    w.levels[q.level] = (w.levels[q.level] || 0) + 1;
    w.types[q.type] = (w.types[q.type] || 0) + 1;
    w.sessions[q.session] = (w.sessions[q.session] || 0) + 1;
    w.lastSeen = now;

    saveStats(stats);
  }

  function updateRoundStatsAtEnd(){
    const stats = loadStats();
    const profile = loadProfile();

    const answeredCount = state.answers.length || state.questions.length;
    const sessionKey = state.session || "UNKNOWN";
    const now = new Date().toISOString();

    stats.profileSnapshot = profile;

    stats.rounds = (stats.rounds || 0) + 1;
    stats.totalXp = (stats.totalXp || 0) + state.xp;
    stats.correct = (stats.correct || 0) + state.correct;
    stats.total = (stats.total || 0) + answeredCount;

    if(!stats.sessions[sessionKey]){
      stats.sessions[sessionKey] = {
        rounds:0,
        correct:0,
        total:0,
        xp:0,
        lastPlayed:null,
        bestAccuracy:0,
        bestXp:0,
        passed:false,
        lastPassed:null
      };
    }

    const acc = answeredCount ? Math.round((state.correct / answeredCount) * 100) : 0;
    const passedThisRound = isRoundPassed(sessionKey,acc);

    stats.sessions[sessionKey].rounds++;
    stats.sessions[sessionKey].correct += state.correct;
    stats.sessions[sessionKey].total += answeredCount;
    stats.sessions[sessionKey].xp += state.xp;
    stats.sessions[sessionKey].lastPlayed = now;
    stats.sessions[sessionKey].bestAccuracy = Math.max(stats.sessions[sessionKey].bestAccuracy || 0,acc);
    stats.sessions[sessionKey].bestXp = Math.max(stats.sessions[sessionKey].bestXp || 0,state.xp);
    stats.sessions[sessionKey].passed = Boolean(stats.sessions[sessionKey].passed || passedThisRound);
    stats.sessions[sessionKey].lastPassed = passedThisRound ? now : (stats.sessions[sessionKey].lastPassed || null);

    stats.history.unshift({
      at:now,
      profile,
      section:profile.section || "101",
      studentName:profile.studentName || "",
      studentId:profile.studentId || "",
      session:sessionKey,
      name:getSessionName(sessionKey),
      mode:state.mode,
      questions:answeredCount,
      correct:state.correct,
      accuracy:acc,
      passed:passedThisRound,
      xp:state.xp,
      weakWords:state.weakWords.slice(),
      isBoss:state.isBoss,
      isWeakTraining:state.isWeakTraining,
      isDailyChallenge:state.isDailyChallenge,
      isSpeedRun:state.isSpeedRun
    });

    stats.history = stats.history.slice(0,60);

    saveStats(stats);

    const recent = loadRecent();
    const current = recent[sessionKey] || [];
    const addIds = state.questions.map(q => q.id);
    recent[sessionKey] = uniq(current.concat(addIds)).slice(-120);
    saveRecent(recent);
  }

  /* =========================================================
     Session / Pool
  ========================================================= */

  function getSessionName(session){
    if(session === "WEAK") return "Weak Word Training";
    if(session === "DAILY") return "Daily Challenge";
    if(session === "SPEED") return "Speed Run 60s";
    if(session === "S3") return "Boss 1";
    if(session === "S6") return "Communication Boss";
    if(session === "S9") return "Email & Meeting Boss";
    if(session === "S12") return "System & Problem Boss";
    if(session === "S15") return "Final Academic Boss";

    const found = SESSIONS.find(s => s.id === session);
    return found ? found.title : session;
  }

  function getPoolBySession(session){
    if(session === "S3"){
      return QUESTION_BANK.filter(q => q.session === "S1" || q.session === "S2");
    }

    if(session === "S6"){
      return QUESTION_BANK.filter(q =>
        q.session === "S1" ||
        q.session === "S2" ||
        q.session === "S4" ||
        q.session === "S5"
      );
    }

    if(session === "S9"){
      return QUESTION_BANK.filter(q =>
        q.session === "S7" ||
        q.session === "S8"
      );
    }

    if(session === "S12"){
      return QUESTION_BANK.filter(q =>
        q.session === "S10" ||
        q.session === "S11"
      );
    }

    if(session === "S15"){
      return QUESTION_BANK.filter(q =>
        q.session === "S1" ||
        q.session === "S2" ||
        q.session === "S4" ||
        q.session === "S5" ||
        q.session === "S7" ||
        q.session === "S8" ||
        q.session === "S10" ||
        q.session === "S11" ||
        q.session === "S13" ||
        q.session === "S14"
      );
    }

    if(session === "WEAK" || session === "DAILY" || session === "SPEED"){
      return QUESTION_BANK.filter(q =>
        q.session === "S1" ||
        q.session === "S2" ||
        q.session === "S4" ||
        q.session === "S5" ||
        q.session === "S7" ||
        q.session === "S8" ||
        q.session === "S10" ||
        q.session === "S11" ||
        q.session === "S13" ||
        q.session === "S14"
      );
    }

    return QUESTION_BANK.filter(q => q.session === session);
  }

  function filterPoolByMode(pool,mode){
    if(!mode || mode === "mixed") return pool.slice();
    return pool.filter(q => q.level === mode);
  }

  function bossTargetSessions(session){
    if(session === "S3") return ["S1","S2"];
    if(session === "S6") return ["S4","S5"];
    if(session === "S9") return ["S7","S8"];
    if(session === "S12") return ["S10","S11"];
    if(session === "S15") return ["S13","S14"];
    return [];
  }

  function buildRound(session,mode,roundSize){
    const pool = filterPoolByMode(getPoolBySession(session),mode);
    const recent = loadRecent();
    const recentIds = new Set(recent[session] || []);

    let candidates = pool.filter(q => !recentIds.has(q.id));
    if(candidates.length < roundSize) candidates = pool.slice();

    const selected = [];
    const selectedIds = new Set();

    const stats = loadStats();

    const weakItems = shuffle(candidates.filter(q => {
      const w = stats.words[q.word];
      return w && (w.wrong || 0) > 0;
    })).slice(0,Math.min(4,Math.floor(roundSize * .25)));

    weakItems.forEach(q => {
      if(!selectedIds.has(q.id)){
        selected.push(q);
        selectedIds.add(q.id);
      }
    });

    if(BOSS_SESSIONS.includes(session)){
      let bossTrapPool = pool.filter(q =>
        (q.type === "trap" || q.type === "near_miss" || q.type === "word_form") &&
        !selectedIds.has(q.id)
      );

      if(session !== "S15"){
        const target = bossTargetSessions(session);
        bossTrapPool = bossTrapPool.filter(q => target.includes(q.session));
      }

      const trapItems = shuffle(bossTrapPool)
        .slice(0,Math.min(7,Math.floor(roundSize * .3)));

      trapItems.forEach(q => {
        if(!selectedIds.has(q.id)){
          selected.push(q);
          selectedIds.add(q.id);
        }
      });

      const targetSessions = bossTargetSessions(session);
      const proItems = shuffle(pool.filter(q =>
        targetSessions.includes(q.session) &&
        q.level === "B1+" &&
        !selectedIds.has(q.id)
      )).slice(0,session === "S15" ? 8 : 5);

      proItems.forEach(q => {
        if(!selectedIds.has(q.id)){
          selected.push(q);
          selectedIds.add(q.id);
        }
      });
    }

    if(session === "S15"){
      const arcGroups = [
        ["S1","S2"],
        ["S4","S5"],
        ["S7","S8"],
        ["S10","S11"],
        ["S13","S14"]
      ];

      arcGroups.forEach(group => {
        const arcPick = shuffle(pool.filter(q =>
          group.includes(q.session) &&
          !selectedIds.has(q.id)
        )).slice(0,4);

        arcPick.forEach(q => {
          if(selected.length < roundSize && !selectedIds.has(q.id)){
            selected.push(q);
            selectedIds.add(q.id);
          }
        });
      });
    }

    const remaining = shuffle(candidates.filter(q => !selectedIds.has(q.id)));
    for(const q of remaining){
      if(selected.length >= roundSize) break;
      selected.push(q);
      selectedIds.add(q.id);
    }

    if(selected.length < roundSize){
      const backup = shuffle(pool.filter(q => !selectedIds.has(q.id)));
      for(const q of backup){
        if(selected.length >= roundSize) break;
        selected.push(q);
        selectedIds.add(q.id);
      }
    }

    return shuffle(selected).slice(0,roundSize);
  }

  /* =========================================================
     Weak / Daily / Speed
  ========================================================= */

  function getWeakWordList(){
    const stats = loadStats();

    return Object.entries(stats.words || {})
      .filter(([,v]) => (v.wrong || 0) > 0)
      .sort((a,b) => {
        const aw = a[1].wrong || 0;
        const bw = b[1].wrong || 0;
        if(bw !== aw) return bw - aw;
        return (b[1].seen || 0) - (a[1].seen || 0);
      })
      .map(([word]) => word);
  }

  function buildWeakRound(roundSize){
    const weakWords = getWeakWordList();
    const weakSet = new Set(weakWords);

    let pool = getPoolBySession("WEAK").filter(q => weakSet.has(q.word));

    if(!pool.length) return [];

    const selected = [];
    const selectedIds = new Set();

    const trapPool = shuffle(pool.filter(q =>
      q.type === "trap" ||
      q.type === "near_miss" ||
      q.type === "word_form" ||
      q.type === "academic_upgrade"
    ));

    for(const q of trapPool){
      if(selected.length >= Math.ceil(roundSize * .6)) break;
      if(!selectedIds.has(q.id)){
        selected.push(q);
        selectedIds.add(q.id);
      }
    }

    const supportPool = shuffle(pool.filter(q => !selectedIds.has(q.id)));
    for(const q of supportPool){
      if(selected.length >= roundSize) break;
      selected.push(q);
      selectedIds.add(q.id);
    }

    if(selected.length < Math.min(8,roundSize)){
      const backupPool = shuffle(getPoolBySession("WEAK").filter(q =>
        !selectedIds.has(q.id) &&
        (q.type === "trap" || q.type === "near_miss" || q.type === "word_form")
      ));

      for(const q of backupPool){
        if(selected.length >= Math.min(8,roundSize)) break;
        selected.push(q);
        selectedIds.add(q.id);
      }
    }

    return shuffle(selected).slice(0,roundSize);
  }

  function buildDailyRound(){
    const stats = loadStats();
    const pool = getPoolBySession("DAILY");

    const weak = pool.filter(q => {
      const w = stats.words[q.word];
      return w && (w.wrong || 0) > 0;
    });

    const notMastered = pool.filter(q => {
      const w = stats.words[q.word];
      return masteryLabel(w) !== "Mastered";
    });

    const traps = pool.filter(q =>
      q.type === "trap" ||
      q.type === "near_miss" ||
      q.type === "word_form" ||
      q.type === "academic_upgrade"
    );

    const selected = [];
    const selectedIds = new Set();

    function addFrom(list,max){
      for(const q of shuffle(list)){
        if(selected.length >= max) break;
        if(!selectedIds.has(q.id)){
          selected.push(q);
          selectedIds.add(q.id);
        }
      }
    }

    addFrom(weak,3);
    addFrom(notMastered,7);
    addFrom(traps,9);
    addFrom(pool,10);

    return shuffle(selected).slice(0,10);
  }

  function buildSpeedRound(){
    const pool = getPoolBySession("SPEED");

    const priority = pool.filter(q =>
      q.type === "meaning" ||
      q.type === "sentence_fill" ||
      q.type === "context" ||
      q.type === "collocation" ||
      q.type === "near_miss"
    );

    const hard = pool.filter(q =>
      q.type === "trap" ||
      q.type === "word_form" ||
      q.type === "academic_upgrade" ||
      q.type === "academic_phrase"
    );

    const mixed = shuffle(priority).concat(shuffle(hard));
    const unique = [];
    const ids = new Set();

    mixed.forEach(q => {
      if(!ids.has(q.id)){
        unique.push(q);
        ids.add(q.id);
      }
    });

    return unique.slice(0,80);
  }

  function resetRoundCommon(){
    state.index = 0;
    state.answered = false;
    state.current = null;
    state.xp = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.correct = 0;
    state.answers = [];
    state.weakWords = [];
    state.forcedEnd = false;
    state.bossMaxHp = 0;
    state.bossHp = 0;
    state.playerHp = 100;
    state.bossBonusGiven = false;
    clearQuestionTimer();
  }

  function startWeakTraining(){
    if(!requireProfile("ฝึกคำที่เคยผิด")) return;

    const weakWords = getWeakWordList();

    if(!weakWords.length){
      showToast("ยังไม่มีคำที่เคยผิด ลองเล่น Session ก่อนค่ะ");
      return;
    }

    state.session = "WEAK";
    state.mode = "weak";
    state.roundSize = Math.max(8,Math.min(18,Number($("roundSizeSelect").value || 12)));
    state.questions = buildWeakRound(state.roundSize);

    resetRoundCommon();

    state.aiHelp = 1;
    state.isBoss = false;
    state.isWeakTraining = true;
    state.isDailyChallenge = false;
    state.isSpeedRun = false;
    state.speedDeadline = 0;
    state.dailyBonus = 0;

    if(!state.questions.length){
      showToast("ยังไม่มีข้อที่ตรงกับ Weak Words ตอนนี้");
      return;
    }

    setScreen("gameScreen");
    renderQuestion();
    showToast(`Weak Word Training: ${weakWords.length} คำที่ควรทบทวน`);
  }

  function startDailyChallenge(){
    if(!requireProfile("Daily Challenge")) return;

    state.session = "DAILY";
    state.mode = "daily";
    state.roundSize = 10;
    state.questions = buildDailyRound();

    resetRoundCommon();

    state.aiHelp = 1;
    state.isBoss = false;
    state.isWeakTraining = false;
    state.isDailyChallenge = true;
    state.isSpeedRun = false;
    state.speedDeadline = 0;
    state.dailyBonus = 0;

    if(!state.questions.length){
      showToast("ยังไม่มีคำถามสำหรับ Daily Challenge");
      return;
    }

    setScreen("gameScreen");
    renderQuestion();

    const daily = loadDaily();
    const today = todayLocalKey();

    showToast(daily.lastBonusDate === today
      ? "Daily Challenge: วันนี้รับโบนัสแล้ว"
      : "Daily Challenge: ผ่านรอบนี้รับ +50 XP"
    );
  }

  function startSpeedRun(){
    if(!requireProfile("Speed Run")) return;

    state.session = "SPEED";
    state.mode = "speed";
    state.roundSize = 80;
    state.questions = buildSpeedRound();

    resetRoundCommon();

    state.aiHelp = 0;
    state.isBoss = false;
    state.isWeakTraining = false;
    state.isDailyChallenge = false;
    state.isSpeedRun = true;
    state.speedDeadline = Date.now() + 60000;
    state.dailyBonus = 0;

    if(!state.questions.length){
      showToast("ยังไม่มีคำถามสำหรับ Speed Run");
      return;
    }

    setScreen("gameScreen");
    renderQuestion();
    showToast("Speed Run 60s เริ่มแล้ว! ทำคะแนนให้มากที่สุด");
  }

  /* =========================================================
     Render Home / Sessions
  ========================================================= */

  function renderHomeStats(){
    const stats = loadStats();
    const overallAcc = percent(stats.correct,stats.total);
    const words = Object.keys(stats.words || {});
    const weak = words.filter(w => (stats.words[w].wrong || 0) > 0).length;
    const mastered = words.filter(w => masteryLabel(stats.words[w]) === "Mastered").length;

    $("homeStats").innerHTML = `
      <div class="stat"><b>${stats.rounds || 0}</b><span>Rounds</span></div>
      <div class="stat"><b>${stats.totalXp || 0}</b><span>Total XP</span></div>
      <div class="stat"><b>${overallAcc}%</b><span>Accuracy</span></div>
      <div class="stat"><b>${mastered}/${words.length}</b><span>Mastered</span></div>
    `;

    const weakBtn = $("weakStartBtn");
    if(weakBtn){
      weakBtn.textContent = weak > 0 ? `ฝึกคำที่เคยผิด (${weak})` : "ฝึกคำที่เคยผิด";
    }

    const dailyBtn = $("dailyBtn");
    if(dailyBtn){
      const daily = loadDaily();
      const today = todayLocalKey();
      dailyBtn.textContent = daily.lastBonusDate === today
        ? "Daily Challenge ✓"
        : "Daily Challenge +50 XP";
    }

    const s4Btn = $("startS4Btn");
    const s5Btn = $("startS5Btn");
    const s7Btn = $("startS7Btn");
    const s8Btn = $("startS8Btn");
    const s10Btn = $("startS10Btn");
    const s11Btn = $("startS11Btn");
    const s13Btn = $("startS13Btn");
    const s14Btn = $("startS14Btn");

    if(s4Btn) s4Btn.textContent = canUnlockCareerArc() ? "Start S4" : "S4 Locked";
    if(s5Btn) s5Btn.textContent = canUnlockCareerArc() ? "Start S5" : "S5 Locked";
    if(s7Btn) s7Btn.textContent = canUnlockEmailArc() ? "Start S7" : "S7 Locked";
    if(s8Btn) s8Btn.textContent = canUnlockEmailArc() ? "Start S8" : "S8 Locked";
    if(s10Btn) s10Btn.textContent = canUnlockTechnicalArc() ? "Start S10" : "S10 Locked";
    if(s11Btn) s11Btn.textContent = canUnlockTechnicalArc() ? "Start S11" : "S11 Locked";
    if(s13Btn) s13Btn.textContent = canUnlockFinalArc() ? "Start S13" : "S13 Locked";
    if(s14Btn) s14Btn.textContent = canUnlockFinalArc() ? "Start S14" : "S14 Locked";
  }

  function renderSessions(){
    const grid = $("sessionGrid");
    if(!grid) return;

    grid.innerHTML = SESSIONS.map(s => {
      const progress = getSessionProgress(s.id);

      const bossLocked =
        (s.id === "S3" && !canUnlockBoss1()) ||
        (s.id === "S6" && !canUnlockBoss2()) ||
        (s.id === "S9" && !canUnlockBoss3()) ||
        (s.id === "S12" && !canUnlockBoss4()) ||
        (s.id === "S15" && !canUnlockFinalBoss());

      const careerLocked = (s.id === "S4" || s.id === "S5") && !canUnlockCareerArc();
      const emailLocked = (s.id === "S7" || s.id === "S8") && !canUnlockEmailArc();
      const technicalLocked = (s.id === "S10" || s.id === "S11") && !canUnlockTechnicalArc();
      const finalArcLocked = (s.id === "S13" || s.id === "S14") && !canUnlockFinalArc();

      const active =
        (s.status === "playable" || s.status === "boss") &&
        !bossLocked &&
        !careerLocked &&
        !emailLocked &&
        !technicalLocked &&
        !finalArcLocked;

      const statusTag = (bossLocked || careerLocked || emailLocked || technicalLocked || finalArcLocked)
        ? `<span class="tag warn">Locked</span>`
        : progress.passed
          ? `<span class="tag good">Passed</span>`
          : progress.played
            ? `<span class="tag primary">Played</span>`
            : s.status === "playable"
              ? `<span class="tag good">Playable</span>`
              : s.status === "boss"
                ? `<span class="tag bad">Boss Ready</span>`
                : s.status === "soon"
                  ? `<span class="tag primary">Data Soon</span>`
                  : `<span class="tag warn">Locked</span>`;

      const bossTag = s.boss ? `<span class="tag bad">Boss</span>` : `<span class="tag">Mission</span>`;
      const itemCount = getPoolBySession(s.id).length;
      const countTag = itemCount ? `<span class="tag">${itemCount} items</span>` : `<span class="tag">0 items</span>`;
      const progressTag = progress.played ? `<span class="tag">Best ${progress.bestAccuracy || 0}%</span>` : "";

      const buttonText = active
        ? (s.boss ? (s.id === "S15" ? "สู้ Final Boss" : "สู้ Boss") : "เริ่มเล่น")
        : bossLocked
          ? (
              s.id === "S15" ? "ต้องผ่าน S13/S14 ก่อน" :
              s.id === "S12" ? "ต้องผ่าน S10/S11 ก่อน" :
              s.id === "S9" ? "ต้องผ่าน S7/S8 ก่อน" :
              s.id === "S6" ? "ต้องผ่าน S4/S5 ก่อน" :
              "ต้องผ่าน S1/S2 ก่อน"
            )
          : careerLocked
            ? "ต้องผ่าน Boss S3 ก่อน"
            : emailLocked
              ? "ต้องผ่าน Boss S6 ก่อน"
              : technicalLocked
                ? "ต้องผ่าน Boss S9 ก่อน"
                : finalArcLocked
                  ? "ต้องผ่าน Boss S12 ก่อน"
                  : "รอเพิ่มคลังคำศัพท์";

      return `
        <article class="session-card ${s.boss ? "boss" : ""} ${active ? "" : "locked"}">
          <div class="session-top">
            <h4>${escapeHtml(s.id)} • ${escapeHtml(s.title)}</h4>
            <p>${escapeHtml(s.desc)}</p>
            <div class="session-meta">${statusTag}${bossTag}${countTag}${progressTag}</div>
          </div>
          <div class="session-actions">
            <button class="btn ${active ? "" : "secondary"} small"
              type="button"
              ${active ? "" : "disabled"}
              onclick="window.startSession('${escapeHtml(s.id)}')">
              ${buttonText}
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  /* =========================================================
     Game Start
  ========================================================= */

  window.startSession = function(sessionId){
    const canPlay = [
      "S1","S2","S3",
      "S4","S5","S6",
      "S7","S8","S9",
      "S10","S11","S12",
      "S13","S14","S15"
    ].includes(sessionId);

    if(!requireProfile(sessionId)) return;

    if(sessionId === "S3" && !canUnlockBoss1()){
      showToast("ต้องผ่าน S1 และ S2 ก่อน จึงจะปลดล็อก Boss S3");
      return;
    }

    if((sessionId === "S4" || sessionId === "S5") && !canUnlockCareerArc()){
      showToast("ต้องผ่าน Boss S3 ก่อน จึงจะปลดล็อก S4/S5");
      return;
    }

    if(sessionId === "S6" && !canUnlockBoss2()){
      showToast("ต้องผ่าน S4 และ S5 ก่อน จึงจะปลดล็อก Boss S6");
      return;
    }

    if((sessionId === "S7" || sessionId === "S8") && !canUnlockEmailArc()){
      showToast("ต้องผ่าน Boss S6 ก่อน จึงจะปลดล็อก S7/S8");
      return;
    }

    if(sessionId === "S9" && !canUnlockBoss3()){
      showToast("ต้องผ่าน S7 และ S8 ก่อน จึงจะปลดล็อก Boss S9");
      return;
    }

    if((sessionId === "S10" || sessionId === "S11") && !canUnlockTechnicalArc()){
      showToast("ต้องผ่าน Boss S9 ก่อน จึงจะปลดล็อก S10/S11");
      return;
    }

    if(sessionId === "S12" && !canUnlockBoss4()){
      showToast("ต้องผ่าน S10 และ S11 ก่อน จึงจะปลดล็อก Boss S12");
      return;
    }

    if((sessionId === "S13" || sessionId === "S14") && !canUnlockFinalArc()){
      showToast("ต้องผ่าน Boss S12 ก่อน จึงจะปลดล็อก S13/S14");
      return;
    }

    if(sessionId === "S15" && !canUnlockFinalBoss()){
      showToast("ต้องผ่าน S13 และ S14 ก่อน จึงจะปลดล็อก Final Boss S15");
      return;
    }

    if(!canPlay){
      showToast("Session นี้ยังรอเพิ่มคลังคำศัพท์ค่ะ");
      return;
    }

    state.session = sessionId;
    state.mode = BOSS_SESSIONS.includes(sessionId) ? "mixed" : $("modeSelect").value;
    state.roundSize = Number($("roundSizeSelect").value || 12);

    if(sessionId === "S15"){
      state.roundSize = Math.max(30,state.roundSize);
    }else if(BOSS_SESSIONS.includes(sessionId)){
      state.roundSize = Math.max(22,state.roundSize);
    }

    state.questions = buildRound(sessionId,state.mode,state.roundSize);

    resetRoundCommon();

    state.aiHelp = sessionId === "S15" ? 0 : BOSS_SESSIONS.includes(sessionId) ? 1 : 2;
    state.isBoss = BOSS_SESSIONS.includes(sessionId);
    state.isWeakTraining = false;
    state.isDailyChallenge = false;
    state.isSpeedRun = false;
    state.speedDeadline = 0;
    state.dailyBonus = 0;

    state.bossMaxHp = state.isBoss
      ? (
          sessionId === "S15" ? 320 :
          sessionId === "S12" ? 260 :
          sessionId === "S9" ? 240 :
          sessionId === "S6" ? 220 :
          180
        )
      : 0;

    state.bossHp = state.bossMaxHp;
    state.playerHp = 100;

    if(!state.questions.length){
      showToast("ยังไม่มีคำถามสำหรับ Session นี้");
      return;
    }

    setScreen("gameScreen");
    renderQuestion();

    if(state.isBoss){
      showToast(
        sessionId === "S15"
          ? "Final Boss เริ่มแล้ว! รวม Academic Vocabulary ทั้งคอร์ส ไม่มี AI Help"
          : sessionId === "S12"
            ? "Boss 4 เริ่มแล้ว! อธิบายระบบและรายงานปัญหาให้แม่น"
            : sessionId === "S9"
              ? "Boss 3 เริ่มแล้ว! ใช้ Email + Meeting phrases ให้แม่น"
              : sessionId === "S6"
                ? "Boss 2 เริ่มแล้ว! ใช้คำศัพท์ Career + Communication ให้รอด"
                : "Boss 1 เริ่มแล้ว! ตอบถูกเพื่อลด HP Boss"
      );
    }
  };

  /* =========================================================
     Render Question / Timer
  ========================================================= */

  function renderQuestion(){
    clearQuestionTimer();

    if(state.index >= state.questions.length || state.forcedEnd){
      finishRound();
      return;
    }

    const q = state.questions[state.index];
    state.current = q;
    state.answered = false;

    const renderedChoices = shuffle(q.choices || []);
    q._renderChoices = renderedChoices;

    $("feedbackBox").hidden = true;
    $("feedbackBox").className = "feedback-box";
    $("nextBtn").disabled = true;

    $("gameModeText").textContent = `${state.session} • ${getSessionName(state.session)}`;
    $("gameTitle").textContent = state.isBoss
      ? state.session === "S15" ? "Final Boss Battle" : "Boss Battle"
      : state.isWeakTraining
        ? "Weak Word Training"
        : state.isDailyChallenge
          ? "Daily Challenge"
          : state.isSpeedRun
            ? "Speed Run 60s"
            : "Vocabulary Mission";

    if(state.isSpeedRun){
      const left = Math.max(0,Math.ceil((state.speedDeadline - Date.now()) / 1000));
      $("progressText").textContent = `Speed Run • Question ${state.index + 1} • ${left}s left`;
    }else if(state.isDailyChallenge){
      $("progressText").textContent = `Daily Challenge • Question ${state.index + 1}/${state.questions.length}`;
    }else{
      $("progressText").textContent = `Question ${state.index + 1}/${state.questions.length}`;
    }

    const progress = percent(state.index,state.questions.length);
    $("progressPercent").textContent = `${progress}%`;
    $("progressFill").style.width = `${progress}%`;

    $("questionTags").innerHTML = `
      ${levelTag(q.level)}
      <span class="tag">${escapeHtml(typeLabel(q.type))}</span>
      <span class="word-chip">Word: ${escapeHtml(q.word)}</span>
      ${state.isWeakTraining ? `<span class="tag bad">Weak Word Training</span>` : ""}
      ${state.isDailyChallenge ? `<span class="tag primary">Daily Challenge</span>` : ""}
      ${state.isSpeedRun ? `<span class="tag warn">Speed Run 60s</span>` : ""}
      ${state.isBoss ? `<span class="tag bad">Boss HP ${state.bossHp}/${state.bossMaxHp}</span>` : ""}
      ${state.isBoss ? `<span class="tag good">Player HP ${state.playerHp}/100</span>` : ""}
    `;

    $("promptText").textContent = q.prompt;

    $("choicesEl").innerHTML = renderedChoices.map((choice,idx) => `
      <button class="choice-btn" type="button" data-choice="${escapeHtml(choice)}" data-index="${idx}">
        ${escapeHtml(choice)}
      </button>
    `).join("");

    Array.from($("choicesEl").querySelectorAll(".choice-btn")).forEach(btn => {
      btn.addEventListener("click",() => handleAnswer(btn.dataset.choice,false));
    });

    $("aiHelpBtn").disabled = state.aiHelp <= 0 || state.isSpeedRun || state.session === "S15";
    $("aiHelpBtn").textContent = `AI Help ${state.aiHelp}`;

    updateSideStats();

    let seconds = LEVEL_SECONDS[q.level] || 14;

    if(state.isSpeedRun){
      const left = Math.max(1,Math.ceil((state.speedDeadline - Date.now()) / 1000));
      seconds = Math.min(seconds,left);
    }

    startQuestionTimer(seconds);
  }

  function startQuestionTimer(seconds){
    clearQuestionTimer();

    state.timeMax = seconds;
    state.timeLeft = seconds;

    updateTimeFill();

    state.timer = setInterval(() => {
      state.timeLeft -= .1;

      if(state.isSpeedRun && Date.now() >= state.speedDeadline){
        state.timeLeft = 0;
      }

      updateTimeFill();

      if(state.timeLeft <= 0){
        clearQuestionTimer();
        handleAnswer(null,true);
      }
    },100);
  }

  function clearQuestionTimer(){
    if(state.timer){
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function updateTimeFill(){
    const ratio = state.timeMax ? clamp(state.timeLeft / state.timeMax,0,1) : 0;
    $("timeFill").style.width = `${Math.round(ratio * 100)}%`;

    if(state.isSpeedRun && state.current){
      const left = Math.max(0,Math.ceil((state.speedDeadline - Date.now()) / 1000));
      $("progressText").textContent = `Speed Run • Question ${state.index + 1} • ${left}s left`;
    }
  }

  function updateSideStats(){
    $("gameStats").innerHTML = `
      <div class="mini"><b>${state.xp}</b><span>XP</span></div>
      <div class="mini"><b>${state.combo}</b><span>Combo</span></div>
      <div class="mini"><b>${state.correct}/${state.answers.length}</b><span>Correct</span></div>
      <div class="mini"><b>${state.aiHelp}</b><span>AI Help</span></div>
    `;
  }

  /* =========================================================
     Answer
  ========================================================= */

  function handleAnswer(choice,timedOut){
    if(state.answered) return;

    const q = state.current;
    if(!q) return;

    clearQuestionTimer();

    state.answered = true;

    const isCorrect = choice === q.answer;
    let gained = 0;

    if(isCorrect){
      state.correct++;
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo,state.combo);

      const base = LEVEL_XP[q.level] || 10;
      const comboBonus = Math.min(12,Math.floor(state.combo / 2) * 2);
      const speedBonus = state.timeLeft >= 6 ? 5 : state.timeLeft >= 3 ? 2 : 0;
      const comebackBonus = state.isWeakTraining ? 8 : 0;
      const dailyTinyBonus = state.isDailyChallenge ? 3 : 0;

      gained = base + comboBonus + speedBonus + comebackBonus + dailyTinyBonus;
      state.xp += gained;

      if(state.isBoss){
        const trapBonus = (q.type === "trap" || q.type === "near_miss" || q.type === "word_form") ? 6 : 0;
        const damage = 12 + trapBonus + Math.min(18,state.combo * 3);

        state.bossHp = Math.max(0,state.bossHp - damage);

        if(state.bossHp <= 0 && !state.bossBonusGiven){
          const bossBonus = state.session === "S15" ? 120 : state.session === "S12" ? 90 : state.session === "S9" ? 80 : state.session === "S6" ? 70 : 50;
          state.xp += bossBonus;
          state.bossBonusGiven = true;
          showFeedback(true,`ถูกต้อง +${gained} XP • Boss -${damage} HP • Trophy Bonus +${bossBonus} XP`,`${q.explanation} คุณชนะ Boss แล้ว!`);
          state.forcedEnd = true;
        }else{
          showFeedback(true,`ถูกต้อง +${gained} XP • Boss -${damage} HP`,q.explanation);
        }
      }else{
        showFeedback(
          true,
          state.isWeakTraining ? `Comeback! +${gained} XP` : `ถูกต้อง +${gained} XP`,
          state.isWeakTraining ? `${q.explanation} คุณแก้ Weak Word ได้แล้ว` : q.explanation
        );
      }
    }else{
      state.combo = 0;

      if(q.word && !state.weakWords.includes(q.word)){
        state.weakWords.push(q.word);
      }

      if(state.isBoss){
        const trapHit = (q.type === "trap" || q.type === "near_miss" || q.type === "word_form") ? 4 : 0;
        const hit = (q.level === "B1+" ? 16 : q.level === "B1" ? 13 : 10) + trapHit;
        state.playerHp = Math.max(0,state.playerHp - hit);

        if(state.playerHp <= 0){
          state.forcedEnd = true;
        }

        showFeedback(false,`ผิด • Boss โจมตี -${hit} HP`,timedOut ? `หมดเวลา คำตอบคือ “${q.answer}”. ${q.explanation}` : `คำตอบคือ “${q.answer}”. ${q.explanation}`);
      }else{
        showFeedback(false,timedOut ? "หมดเวลา" : "ยังไม่ถูก",`คำตอบคือ “${q.answer}”. ${q.explanation}`);
      }
    }

    state.answers.push({
      id:q.id,
      session:q.session,
      word:q.word,
      level:q.level,
      type:q.type,
      prompt:q.prompt,
      answer:q.answer,
      selected:choice || "",
      correct:isCorrect,
      timedOut:Boolean(timedOut),
      xp:gained
    });

    if(state.isSpeedRun && Date.now() >= state.speedDeadline){
      state.forcedEnd = true;
    }

    updateWordStats(q,isCorrect);
    markChoiceButtons(choice,q.answer);
    updateSideStats();
    renderQuestionTagsAfterAnswer();

    $("nextBtn").disabled = false;
    $("nextBtn").textContent =
      state.isBoss ? "โจมตีต่อ" :
      state.isWeakTraining ? "ฝึกคำต่อไป" :
      state.isDailyChallenge ? "Daily ข้อต่อไป" :
      state.isSpeedRun ? "Speed ต่อ" :
      "ข้อต่อไป";
  }

  function markChoiceButtons(selected,answer){
    Array.from($("choicesEl").querySelectorAll(".choice-btn")).forEach(btn => {
      const val = btn.dataset.choice;
      btn.disabled = true;

      if(val === answer){
        btn.classList.add("correct");
      }else if(val === selected){
        btn.classList.add("wrong");
      }else{
        btn.classList.add("dim");
      }
    });
  }

  function renderQuestionTagsAfterAnswer(){
    const q = state.current;
    if(!q) return;

    $("questionTags").innerHTML = `
      ${levelTag(q.level)}
      <span class="tag">${escapeHtml(typeLabel(q.type))}</span>
      <span class="word-chip">Word: ${escapeHtml(q.word)}</span>
      ${state.isWeakTraining ? `<span class="tag bad">Weak Word Training</span>` : ""}
      ${state.isDailyChallenge ? `<span class="tag primary">Daily Challenge</span>` : ""}
      ${state.isSpeedRun ? `<span class="tag warn">Speed Run 60s</span>` : ""}
      ${state.isBoss ? `<span class="tag bad">Boss HP ${state.bossHp}/${state.bossMaxHp}</span>` : ""}
      ${state.isBoss ? `<span class="tag good">Player HP ${state.playerHp}/100</span>` : ""}
    `;
  }

  function showFeedback(good,title,text){
    const box = $("feedbackBox");
    box.hidden = false;
    box.className = `feedback-box ${good ? "good" : "bad"}`;
    $("feedbackTitle").textContent = title;
    $("feedbackText").textContent = text;
  }

  function useAiHelp(){
    if(state.answered || state.aiHelp <= 0 || state.isSpeedRun || state.session === "S15") return;

    const q = state.current;
    if(!q) return;

    state.aiHelp--;

    const wrongButtons = Array.from($("choicesEl").querySelectorAll(".choice-btn"))
      .filter(btn => btn.dataset.choice !== q.answer);

    shuffle(wrongButtons).slice(0,2).forEach(btn => {
      btn.disabled = true;
      btn.classList.add("dim");
    });

    $("aiHelpBtn").disabled = state.aiHelp <= 0;
    $("aiHelpBtn").textContent = `AI Help ${state.aiHelp}`;

    showToast(`Hint: ระวังคำว่า “${q.word}” และดูบริบทของประโยค`);
    updateSideStats();
  }

  function nextQuestion(){
    if(!state.answered) return;

    if(state.forcedEnd){
      finishRound();
      return;
    }

    state.index++;

    if(state.index >= state.questions.length){
      finishRound();
      return;
    }

    renderQuestion();
  }

  /* =========================================================
     Finish / Summary
  ========================================================= */

  function finishRound(){
    clearQuestionTimer();

    const bonus = claimDailyBonusIfNeeded();
    if(bonus > 0){
      showToast(`Daily Bonus +${bonus} XP`);
    }

    updateRoundStatsAtEnd();

    const answered = state.answers.length;
    const acc = answered ? Math.round((state.correct / answered) * 100) : 0;
    const passedThisRound = isRoundPassed(state.session,acc);

    let stars = "⭐";
    if(acc >= 90) stars = "⭐⭐⭐";
    else if(acc >= 75) stars = "⭐⭐";
    else stars = "⭐";

    let title = acc >= 90 ? "Excellent Academic Mission!" :
                acc >= 75 ? "Good Progress!" :
                acc >= 60 ? "Mission Clear" :
                "Try Again Mission";

    if(!state.isBoss && !state.isWeakTraining && !state.isDailyChallenge && !state.isSpeedRun){
      title = passedThisRound ? `${state.session} Passed!` : `${state.session} Needs Practice`;
    }

    if(state.isBoss){
      if(state.bossHp <= 0){
        title = state.session === "S15" ? "Final Academic Boss Defeated!" : "Boss Defeated!";
      }else if(state.playerHp <= 0){
        title = state.session === "S15" ? "Final Boss Rematch Needed" : "Boss Rematch Needed";
      }else{
        title = state.session === "S15" ? "Final Boss Complete" : "Boss Battle Complete";
      }
    }

    if(state.isWeakTraining){
      title = acc >= 80 ? "Weak Words Defeated!" :
              acc >= 60 ? "Weak Words Improved" :
              "Weak Words Need Rematch";
    }

    if(state.isDailyChallenge){
      title = acc >= 90 ? "Daily Challenge Perfect!" :
              acc >= 70 ? "Daily Challenge Complete!" :
              "Daily Challenge Practice";
    }

    if(state.isSpeedRun){
      title = acc >= 85 && answered >= 12 ? "Speed Scholar!" :
              answered >= 8 ? "Fast Progress!" :
              "Speed Run Complete";
    }

    $("summaryTitle").textContent = title;
    $("summaryStars").textContent = stars;

    const profileLabel = getProfileLabel();

    $("summarySubtitle").textContent =
      `${profileLabel} • ${state.session} • ${getSessionName(state.session)} • ${state.mode === "mixed" ? "Mixed A2–B1+" : state.mode} • ${answered}/${state.questions.length} questions` +
      (state.isBoss ? ` • Boss HP ${state.bossHp}/${state.bossMaxHp} • Player HP ${state.playerHp}/100` : "") +
      (state.isWeakTraining ? ` • Personalized Review` : "") +
      (state.isDailyChallenge ? ` • Daily Bonus ${state.dailyBonus > 0 ? "+" + state.dailyBonus + " XP" : "claimed today"}` : "") +
      (state.isSpeedRun ? ` • 60s Sprint • Answered ${answered}` : "") +
      (passedThisRound ? ` • PASSED` : (sessionPassThreshold(state.session) > 0 ? ` • Not Passed Yet` : ""));

    $("summaryStats").innerHTML = `
      <div class="stat"><b>${state.xp}</b><span>XP Earned</span></div>
      <div class="stat"><b>${acc}%</b><span>Accuracy</span></div>
      <div class="stat"><b>${state.correct}/${answered}</b><span>Correct</span></div>
      <div class="stat"><b>${state.maxCombo}</b><span>Max Combo</span></div>
    `;

    if(state.weakWords.length){
      $("summaryWeakWords").innerHTML = state.weakWords
        .map(w => `<span class="word-pill">${escapeHtml(w)}</span>`)
        .join("");
    }else{
      $("summaryWeakWords").innerHTML = `<span class="word-pill">ไม่มี weak word ในรอบนี้ เยี่ยมมาก</span>`;
    }

    renderHomeStats();
    renderSessions();

    setScreen("summaryScreen");
  }

  /* =========================================================
     Word Deck
  ========================================================= */

  function getDeckWords(){
    const map = new Map();

    QUESTION_BANK
      .filter(q =>
        q.session === "S1" ||
        q.session === "S2" ||
        q.session === "S4" ||
        q.session === "S5" ||
        q.session === "S7" ||
        q.session === "S8" ||
        q.session === "S10" ||
        q.session === "S11" ||
        q.session === "S13" ||
        q.session === "S14"
      )
      .forEach(q => {
        if(!map.has(q.word)){
          map.set(q.word,{
            word:q.word,
            sessions:new Set(),
            levels:new Set(),
            types:new Set(),
            examples:[]
          });
        }

        const item = map.get(q.word);
        item.sessions.add(q.session);
        item.levels.add(q.level);
        item.types.add(q.type);

        if(item.examples.length < 2){
          item.examples.push(q.prompt);
        }
      });

    return Array.from(map.values()).map(item => ({
      word:item.word,
      sessions:Array.from(item.sessions),
      levels:Array.from(item.levels),
      types:Array.from(item.types),
      examples:item.examples
    })).sort((a,b) => a.word.localeCompare(b.word));
  }

  function renderWordDeck(){
    const stats = loadStats();
    const allWords = getDeckWords();

    const sessionFilter = $("deckSessionFilter") ? $("deckSessionFilter").value : "ALL";
    const masteryFilter = $("deckMasteryFilter") ? $("deckMasteryFilter").value : "ALL";

    let filtered = allWords.filter(item => {
      if(sessionFilter !== "ALL" && !item.sessions.includes(sessionFilter)) return false;

      const wStats = stats.words[item.word];
      const label = masteryLabel(wStats);
      const isWeak = wStats && (wStats.wrong || 0) > 0;

      if(masteryFilter === "Weak") return isWeak;
      if(masteryFilter !== "ALL") return label === masteryFilter;

      return true;
    });

    const total = allWords.length;
    const learned = allWords.filter(item => masteryLabel(stats.words[item.word]) !== "New").length;
    const mastered = allWords.filter(item => masteryLabel(stats.words[item.word]) === "Mastered").length;
    const weak = allWords.filter(item => stats.words[item.word] && (stats.words[item.word].wrong || 0) > 0).length;

    $("deckStats").innerHTML = `
      <div class="stat"><b>${total}</b><span>Total Cards</span></div>
      <div class="stat"><b>${learned}</b><span>Learned+</span></div>
      <div class="stat"><b>${mastered}</b><span>Mastered</span></div>
      <div class="stat"><b>${weak}</b><span>Weak Words</span></div>
    `;

    if(!filtered.length){
      $("wordDeckGrid").innerHTML = `
        <div class="deck-empty" style="grid-column:1/-1">
          ยังไม่มีการ์ดตามตัวกรองนี้ ลองเปลี่ยน Filter หรือกลับไปเล่น Session ก่อนค่ะ
        </div>
      `;
      return;
    }

    $("wordDeckGrid").innerHTML = filtered.map(item => {
      const wStats = stats.words[item.word] || {seen:0,correct:0,wrong:0,levels:{}};
      const label = masteryLabel(wStats);
      const pct = masteryPercent(wStats);
      const cls = masteryClass(wStats);

      const tagClass =
        label === "Mastered" ? "good" :
        label === "Strong" ? "primary" :
        label === "Familiar" ? "warn" :
        label === "Learned" ? "" :
        "bad";

      return `
        <div class="word-card2 ${cls}">
          <div class="word-card-head">
            <div>
              <h4>${escapeHtml(item.word)}</h4>
              <small>${escapeHtml(item.sessions.join(" / "))} • ${escapeHtml(item.levels.join(", "))}</small>
            </div>
            <span class="tag ${tagClass}">${label}</span>
          </div>

          <div class="mastery-meter">
            <div class="mastery-fill" style="width:${pct}%"></div>
          </div>

          <div class="mini-stats">
            <div class="mini"><b>${wStats.seen || 0}</b><span>Seen</span></div>
            <div class="mini"><b>${wStats.correct || 0}</b><span>Correct</span></div>
            <div class="mini"><b>${wStats.wrong || 0}</b><span>Wrong</span></div>
            <div class="mini"><b>${Object.keys(wStats.levels || {}).length}</b><span>Levels</span></div>
          </div>

          <div class="word-list">
            ${item.types.slice(0,4).map(t => `<span class="word-pill">${escapeHtml(typeLabel(t))}</span>`).join("")}
          </div>

          <p class="empty" style="margin:0">
            ${escapeHtml(item.examples[0] || "No example yet")}
          </p>
        </div>
      `;
    }).join("");
  }

  /* =========================================================
     Teacher Dashboard
  ========================================================= */

  function renderTeacherDashboard(){
    const stats = loadStats();
    const profile = loadProfile();
    const overallAcc = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;

    $("teacherProfileBox").innerHTML = `
      <b>Student Profile:</b>
      ${escapeHtml(profile.studentName || "-")}
      • ID: ${escapeHtml(profile.studentId || "-")}
      • Section: ${escapeHtml(profile.section || "101")}
    `;

    const allDeck = getDeckWords();
    const knownWords = Object.keys(stats.words || {});
    const masteredWords = knownWords.filter(w => masteryLabel(stats.words[w]) === "Mastered");
    const weakWords = Object.entries(stats.words || {})
      .filter(([,v]) => (v.wrong || 0) > 0)
      .sort((a,b) => (b[1].wrong || 0) - (a[1].wrong || 0));

    $("teacherStats").innerHTML = `
      <div class="stat"><b>${stats.rounds}</b><span>Total Rounds</span></div>
      <div class="stat"><b>${stats.totalXp}</b><span>Total XP</span></div>
      <div class="stat"><b>${overallAcc}%</b><span>Overall Accuracy</span></div>
      <div class="stat"><b>${masteredWords.length}/${allDeck.length}</b><span>Mastered Cards</span></div>
      <div class="stat"><b>${escapeHtml(profile.section || "101")}</b><span>Section</span></div>
      <div class="stat"><b>${escapeHtml(profile.studentId || "-")}</b><span>Student ID</span></div>
    `;

    renderSessionProgress(stats);
    renderWeakWordsTable(stats,weakWords);
    renderMasteryOverview(stats,allDeck);
    renderRecentRounds(stats);
  }

  function renderSessionProgress(stats){
    const rows = Object.entries(stats.sessions || {})
      .sort((a,b) => a[0].localeCompare(b[0]));

    if(!rows.length){
      $("sessionProgressBody").innerHTML = `<tr><td colspan="9">ยังไม่มีข้อมูลการเล่น</td></tr>`;
      return;
    }

    $("sessionProgressBody").innerHTML = rows.map(([session,s]) => {
      const acc = s.total ? Math.round((s.correct / s.total) * 100) : 0;
      return `
        <tr>
          <td><b>${escapeHtml(session)}</b><br><span class="empty">${escapeHtml(getSessionName(session))}</span></td>
          <td>${s.rounds || 0}</td>
          <td>${s.total || 0}</td>
          <td>${s.correct || 0}</td>
          <td>${acc}%</td>
          <td>${s.xp || 0}</td>
          <td>${s.passed ? "YES" : "-"}</td>
          <td>${s.bestAccuracy || 0}%</td>
          <td>${escapeHtml(formatDateTime(s.lastPlayed))}</td>
        </tr>
      `;
    }).join("");
  }

  function renderWeakWordsTable(stats,weakRows){
    const rows = weakRows.slice(0,25);

    if(!rows.length){
      $("weakWordsTableBody").innerHTML = `<tr><td colspan="6">ยังไม่มี Weak Words</td></tr>`;
      return;
    }

    $("weakWordsTableBody").innerHTML = rows.map(([word,w]) => {
      const acc = w.seen ? Math.round(((w.correct || 0) / w.seen) * 100) : 0;
      return `
        <tr>
          <td><b>${escapeHtml(word)}</b></td>
          <td>${w.seen || 0}</td>
          <td>${w.correct || 0}</td>
          <td>${w.wrong || 0}</td>
          <td>${acc}%</td>
          <td>${escapeHtml(masteryLabel(w))}</td>
        </tr>
      `;
    }).join("");
  }

  function renderMasteryOverview(stats,allDeck){
    const groups = {
      New:[],
      Learned:[],
      Familiar:[],
      Strong:[],
      Mastered:[]
    };

    allDeck.forEach(item => {
      const label = masteryLabel(stats.words[item.word]);
      groups[label].push(item.word);
    });

    $("masteryOverviewBody").innerHTML = Object.entries(groups).map(([label,words]) => {
      const examples = words.slice(0,10).join(", ") || "-";
      return `
        <tr>
          <td><b>${label}</b></td>
          <td>${words.length}</td>
          <td>${escapeHtml(examples)}</td>
        </tr>
      `;
    }).join("");
  }

  function renderRecentRounds(stats){
    const rows = (stats.history || []).slice(0,20);

    if(!rows.length){
      $("recentRoundsBody").innerHTML = `<tr><td colspan="10">ยังไม่มีประวัติการเล่น</td></tr>`;
      return;
    }

    $("recentRoundsBody").innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(formatDateTime(r.at))}</td>
        <td>
          <b>${escapeHtml(r.studentName || "-")}</b><br>
          <span class="empty">${escapeHtml(r.studentId || "-")}</span>
        </td>
        <td>${escapeHtml(r.section || "101")}</td>
        <td><b>${escapeHtml(r.session)}</b><br><span class="empty">${escapeHtml(r.name || "")}</span></td>
        <td>${r.questions || 0}</td>
        <td>${r.correct || 0}</td>
        <td>${r.accuracy || 0}%</td>
        <td>${r.xp || 0}</td>
        <td>${r.passed ? "YES" : "-"}</td>
        <td>${escapeHtml((r.weakWords || []).join(", ") || "-")}</td>
      </tr>
    `).join("");
  }

  function exportDashboardJson(){
    const stats = loadStats();
    const payload = {
      exportedAt:new Date().toISOString(),
      appVersion:APP_VERSION,
      profile:loadProfile(),
      stats,
      deck:getDeckWords()
    };

    downloadTextFile(
      `eap-word-quest-dashboard-${todayLocalKey()}.json`,
      JSON.stringify(payload,null,2),
      "application/json;charset=utf-8"
    );

    showToast("Export JSON เรียบร้อย");
  }

  function exportDashboardCsv(){
    const stats = loadStats();
    const profile = loadProfile();

    const lines = [];
    lines.push([
      "type",
      "studentName",
      "studentId",
      "section",
      "session",
      "name",
      "word",
      "rounds",
      "questions",
      "correct",
      "wrong",
      "accuracy",
      "xp",
      "mastery",
      "passed",
      "lastPlayed"
    ].map(csvEscape).join(","));

    Object.entries(stats.sessions || {}).forEach(([session,s]) => {
      const acc = s.total ? Math.round((s.correct / s.total) * 100) : 0;
      lines.push([
        "session",
        profile.studentName || "",
        profile.studentId || "",
        profile.section || "101",
        session,
        getSessionName(session),
        "",
        s.rounds || 0,
        s.total || 0,
        s.correct || 0,
        "",
        acc,
        s.xp || 0,
        "",
        s.passed ? "YES" : "",
        s.lastPlayed || ""
      ].map(csvEscape).join(","));
    });

    Object.entries(stats.words || {}).forEach(([word,w]) => {
      const acc = w.seen ? Math.round(((w.correct || 0) / w.seen) * 100) : 0;
      lines.push([
        "word",
        profile.studentName || "",
        profile.studentId || "",
        profile.section || "101",
        "",
        "",
        word,
        "",
        w.seen || 0,
        w.correct || 0,
        w.wrong || 0,
        acc,
        "",
        masteryLabel(w),
        "",
        w.lastSeen || ""
      ].map(csvEscape).join(","));
    });

    downloadTextFile(
      `eap-word-quest-dashboard-${todayLocalKey()}.csv`,
      lines.join("\n"),
      "text/csv;charset=utf-8"
    );

    showToast("Export CSV เรียบร้อย");
  }

  function clearLocalStats(){
    const ok = confirm("ลบข้อมูลคะแนน/ประวัติ/คำศัพท์ของเกมนี้ในเครื่องนี้ใช่ไหม? ระบบจะยังเก็บ Student Profile ไว้");
    if(!ok) return;

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RECENT_KEY);
    localStorage.removeItem(DAILY_KEY);

    renderTeacherDashboard();
    renderHomeStats();
    renderSessions();

    showToast("ลบข้อมูล local แล้ว");
  }

  /* =========================================================
     Events
  ========================================================= */

  function bindEvents(){
    $("quickStartBtn").addEventListener("click",() => startSession("S1"));
    $("startS2Btn").addEventListener("click",() => startSession("S2"));
    $("startS4Btn").addEventListener("click",() => startSession("S4"));
    $("startS5Btn").addEventListener("click",() => startSession("S5"));
    $("startS7Btn").addEventListener("click",() => startSession("S7"));
    $("startS8Btn").addEventListener("click",() => startSession("S8"));
    $("startS10Btn").addEventListener("click",() => startSession("S10"));
    $("startS11Btn").addEventListener("click",() => startSession("S11"));
    $("startS13Btn").addEventListener("click",() => startSession("S13"));
    $("startS14Btn").addEventListener("click",() => startSession("S14"));

    $("weakStartBtn").addEventListener("click",() => startWeakTraining());
    $("dailyBtn").addEventListener("click",() => startDailyChallenge());
    $("speedRunBtn").addEventListener("click",() => startSpeedRun());

    $("saveProfileBtn").addEventListener("click",() => handleSaveProfile());
    $("resetProfileBtn").addEventListener("click",() => resetProfile());

    ["studentNameInput","studentIdInput","sectionInput"].forEach(id => {
      $(id).addEventListener("keydown",(e) => {
        if(e.key === "Enter"){
          handleSaveProfile();
        }
      });
    });

    $("aiHelpBtn").addEventListener("click",() => useAiHelp());
    $("nextBtn").addEventListener("click",() => nextQuestion());

    $("quitBtn").addEventListener("click",() => {
      const ok = confirm("ออกจากรอบนี้และกลับหน้า Session ใช่ไหม?");
      if(!ok) return;
      clearQuestionTimer();
      setScreen("homeScreen");
      renderHomeStats();
      renderSessions();
    });

    $("replayBtn").addEventListener("click",() => {
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

    $("homeBtn").addEventListener("click",() => {
      setScreen("homeScreen");
      renderHomeStats();
      renderSessions();
    });

    $("wordDeckBtn").addEventListener("click",() => {
      renderWordDeck();
      setScreen("wordDeckScreen");
    });

    $("summaryDeckBtn").addEventListener("click",() => {
      renderWordDeck();
      setScreen("wordDeckScreen");
    });

    $("deckBackBtn").addEventListener("click",() => {
      setScreen("homeScreen");
      renderHomeStats();
      renderSessions();
    });

    $("deckSessionFilter").addEventListener("change",() => renderWordDeck());
    $("deckMasteryFilter").addEventListener("change",() => renderWordDeck());

    $("teacherBtn").addEventListener("click",() => {
      renderTeacherDashboard();
      setScreen("teacherScreen");
    });

    $("summaryTeacherBtn").addEventListener("click",() => {
      renderTeacherDashboard();
      setScreen("teacherScreen");
    });

    $("teacherBackBtn").addEventListener("click",() => {
      setScreen("homeScreen");
      renderHomeStats();
      renderSessions();
    });

    $("teacherRefreshBtn").addEventListener("click",() => {
      renderTeacherDashboard();
      showToast("Dashboard updated");
    });

    $("exportCsvBtn").addEventListener("click",() => exportDashboardCsv());
    $("exportJsonBtn").addEventListener("click",() => exportDashboardJson());
    $("clearStatsBtn").addEventListener("click",() => clearLocalStats());
  }

  /* =========================================================
     Init
  ========================================================= */

  function init(){
    if($("versionPill")){
      $("versionPill").textContent = APP_VERSION;
    }

    renderProfile();
    renderHomeStats();
    renderSessions();
    bindEvents();

    console.info("[EAP Word Quest] Engine ready:",{
      version:APP_VERSION,
      items:QUESTION_BANK.length,
      sessions:SESSIONS.length
    });
  }

  init();
})();
