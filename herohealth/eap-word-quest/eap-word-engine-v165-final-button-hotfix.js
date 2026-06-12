/* =========================================================
   EAP Word Quest • Final Button Fallback Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v165-final-button-hotfix.js
   Version: v1.6.5-FINAL-BUTTON-FALLBACK

   Fix:
   - If final question button "ดูสรุปผล" does not advance
   - Save current session result from DOM
   - Render Summary screen
   - Compute next mission after saved pass status
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.6.5-FINAL-BUTTON-FALLBACK";

  const STORAGE_KEYS = [
    "EAP_WORD_QUEST_STATS_V161",
    "EAP_WORD_QUEST_STATS_V160",
    "EAP_WORD_QUEST_STATS_V01"
  ];

  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";

  const COURSE_FLOW = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];

  const SESSION_TITLES = {
    S1:"Academic Profile",
    S2:"Project Introduction",
    S3:"Project Rationale & Target Users",
    BG1:"Boss Gate 1",

    S4:"Tech Jobs / Careers",
    S5:"Workplace Communication",
    S6:"Team Progress & Responsibility",
    BG2:"Boss Gate 2",

    S7:"Professional Email",
    S8:"Meeting / Discussion",
    S9:"Discussion Summary & Action Items",
    BG3:"Boss Gate 3",

    S10:"System Explanation",
    S11:"Bug Report / Problem Solving",
    S12:"User Guide / Technical Instruction",
    BG4:"Boss Gate 4",

    S13:"AI Report / Academic Summary",
    S14:"CV / Interview / Pitch",
    S15:"Final Project Presentation & Reflection",
    BG5:"Final Boss Gate"
  };

  function $(id){
    return document.getElementById(id);
  }

  function normalize(value){
    return String(value == null ? "" : value).replace(/\s+/g," ").trim();
  }

  function numberFromText(value){
    const m = normalize(value).match(/-?\d+/);
    return m ? Number(m[0]) : 0;
  }

  function readProfile(){
    try{
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");

      return {
        studentName:normalize(raw.studentName || ""),
        studentId:normalize(raw.studentId || ""),
        section:normalize(raw.section || "101") || "101"
      };
    }catch(err){
      return {
        studentName:"",
        studentId:"",
        section:"101"
      };
    }
  }

  function findStatsKey(){
    for(const key of STORAGE_KEYS){
      if(localStorage.getItem(key)) return key;
    }

    return "EAP_WORD_QUEST_STATS_V161";
  }

  function readStats(){
    const key = findStatsKey();

    try{
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : {};

      if(!data.sessions) data.sessions = {};
      if(!data.words) data.words = {};
      if(!Array.isArray(data.history)) data.history = [];
      if(!data.createdAt) data.createdAt = new Date().toISOString();

      data.__storageKey = key;
      return data;
    }catch(err){
      return {
        __storageKey:key,
        createdAt:new Date().toISOString(),
        sessions:{},
        words:{},
        history:[],
        rounds:0,
        correct:0,
        total:0,
        totalXp:0
      };
    }
  }

  function saveStats(stats){
    const key = stats.__storageKey || findStatsKey();
    const copy = Object.assign({},stats);

    delete copy.__storageKey;

    copy.version = HOTFIX_VERSION;
    copy.updatedAt = new Date().toISOString();

    localStorage.setItem(key,JSON.stringify(copy));
  }

  function passed(stats,id){
    return Boolean(
      stats &&
      stats.sessions &&
      stats.sessions[id] &&
      stats.sessions[id].passed
    );
  }

  function isUnlocked(stats,id){
    if(id === "S1" || id === "S2" || id === "S3") return true;

    if(id === "BG1") return passed(stats,"S1") && passed(stats,"S2") && passed(stats,"S3");

    if(id === "S4" || id === "S5" || id === "S6") return passed(stats,"BG1");
    if(id === "BG2") return passed(stats,"S4") && passed(stats,"S5") && passed(stats,"S6");

    if(id === "S7" || id === "S8" || id === "S9") return passed(stats,"BG2");
    if(id === "BG3") return passed(stats,"S7") && passed(stats,"S8") && passed(stats,"S9");

    if(id === "S10" || id === "S11" || id === "S12") return passed(stats,"BG3");
    if(id === "BG4") return passed(stats,"S10") && passed(stats,"S11") && passed(stats,"S12");

    if(id === "S13" || id === "S14" || id === "S15") return passed(stats,"BG4");
    if(id === "BG5") return passed(stats,"S13") && passed(stats,"S14") && passed(stats,"S15");

    return false;
  }

  function firstRecommendedMission(stats){
    for(const id of COURSE_FLOW){
      if(isUnlocked(stats,id) && !passed(stats,id)){
        return id;
      }
    }

    return "DONE";
  }

  function computeNextMission(stats,currentId){
    const currentIndex = COURSE_FLOW.indexOf(currentId);

    if(currentIndex < 0){
      return firstRecommendedMission(stats);
    }

    for(let i = currentIndex + 1; i < COURSE_FLOW.length; i++){
      const id = COURSE_FLOW[i];

      if(isUnlocked(stats,id) && !passed(stats,id)){
        return id;
      }
    }

    return firstRecommendedMission(stats);
  }

  function currentSessionFromDom(){
    const tagText = normalize($("questionTags") ? $("questionTags").textContent : "");
    let m = tagText.match(/\b(BG[1-5]|S(?:1[0-5]|[1-9])|DAILY|SPEED|WEAK)\b/);

    if(m) return m[1];

    const modeText = normalize($("gameModeText") ? $("gameModeText").textContent : "");
    m = modeText.match(/\b(BG[1-5]|S(?:1[0-5]|[1-9])|DAILY|SPEED|WEAK)\b/);

    if(m) return m[1];

    return "S1";
  }

  function getMiniStat(labelName){
    const root = $("gameStats");
    if(!root) return 0;

    const minis = Array.from(root.querySelectorAll(".mini"));

    for(const mini of minis){
      const label = normalize(mini.querySelector("span") ? mini.querySelector("span").textContent : "");
      const value = normalize(mini.querySelector("b") ? mini.querySelector("b").textContent : "");

      if(label.toLowerCase() === labelName.toLowerCase()){
        return numberFromText(value);
      }
    }

    return 0;
  }

  function isFinalQuestionAnswered(){
    const game = $("gameScreen");
    const summary = $("summaryScreen");
    const nextBtn = $("nextBtn");
    const feedback = $("feedbackBox");
    const progress = normalize($("progressText") ? $("progressText").textContent : "");

    if(!game || !game.classList.contains("active")) return false;
    if(summary && summary.classList.contains("active")) return false;
    if(!nextBtn) return false;
    if(!/ดูสรุปผล|summary/i.test(normalize(nextBtn.textContent))) return false;
    if(feedback && feedback.hidden) return false;

    const m = progress.match(/(\d+)\s*\/\s*(\d+)/);
    if(!m) return false;

    return Number(m[1]) >= Number(m[2]);
  }

  function thresholdFor(sessionId){
    if(sessionId === "BG5") return 75;
    if(/^BG[1-4]$/.test(sessionId)) return 70;
    if(sessionId === "DAILY" || sessionId === "SPEED" || sessionId === "WEAK") return 0;

    return 60;
  }

  function bossHpFromDom(){
    const tagText = normalize($("questionTags") ? $("questionTags").textContent : "");
    const m = tagText.match(/Boss\s*HP\s*(\d+)\s*\/\s*(\d+)/i);

    if(m){
      return {
        hp:Number(m[1]),
        max:Number(m[2])
      };
    }

    return {
      hp:0,
      max:0
    };
  }

  function saveFallbackRound(){
    const sessionId = currentSessionFromDom();
    const title = SESSION_TITLES[sessionId] || normalize($("gameTitle") ? $("gameTitle").textContent : sessionId);

    const correct = getMiniStat("Correct");
    const wrong = getMiniStat("Wrong");
    const total = Math.max(1,correct + wrong);
    const accuracy = Math.round((correct / total) * 100);
    const xp = getMiniStat("XP");
    const maxCombo = getMiniStat("Max Combo") || getMiniStat("Combo");
    const weakCount = getMiniStat("Weak Words");
    const boss = bossHpFromDom();

    const threshold = thresholdFor(sessionId);
    const isBoss = /^BG[1-5]$/.test(sessionId);

    const passedThisRound = threshold > 0
      ? isBoss
        ? accuracy >= threshold && boss.hp <= 0
        : accuracy >= threshold
      : false;

    const stats = readStats();
    const profile = readProfile();
    const now = new Date().toISOString();

    if(!stats.sessions) stats.sessions = {};
    if(!stats.sessions[sessionId]){
      stats.sessions[sessionId] = {
        rounds:0,
        correct:0,
        total:0,
        xp:0,
        lastPlayed:null,
        bestAccuracy:0,
        bestXp:0,
        played:false,
        passed:false,
        lastPassed:null
      };
    }

    const s = stats.sessions[sessionId];

    s.rounds = Number(s.rounds || 0) + 1;
    s.correct = Number(s.correct || 0) + correct;
    s.total = Number(s.total || 0) + total;
    s.xp = Number(s.xp || 0) + xp;
    s.lastPlayed = now;
    s.played = true;
    s.bestAccuracy = Math.max(Number(s.bestAccuracy || 0),accuracy);
    s.bestXp = Math.max(Number(s.bestXp || 0),xp);

    if(passedThisRound){
      s.passed = true;
      s.lastPassed = now;
    }

    stats.rounds = Number(stats.rounds || 0) + 1;
    stats.correct = Number(stats.correct || 0) + correct;
    stats.total = Number(stats.total || 0) + total;
    stats.totalXp = Number(stats.totalXp || 0) + xp;
    stats.profileSnapshot = profile;

    if(!Array.isArray(stats.history)) stats.history = [];

    stats.history.unshift({
      at:now,
      profile,
      section:profile.section || "101",
      studentName:profile.studentName || "",
      studentId:profile.studentId || "",
      session:sessionId,
      name:title,
      mode:"fallback",
      questions:total,
      correct,
      accuracy,
      passed:passedThisRound,
      xp,
      maxCombo,
      weakWords:[],
      isBoss,
      bossHp:boss.hp,
      bossMaxHp:boss.max,
      fallbackHotfix:HOTFIX_VERSION
    });

    stats.history = stats.history.slice(0,80);

    saveStats(stats);

    const nextMission = computeNextMission(stats,sessionId);

    return {
      sessionId,
      title,
      correct,
      wrong,
      total,
      accuracy,
      xp,
      maxCombo,
      weakCount,
      passedThisRound,
      nextMission,
      boss
    };
  }

  function setScreen(screenId){
    document.querySelectorAll(".screen").forEach(screen => {
      screen.classList.toggle("active",screen.id === screenId);
    });

    window.scrollTo({top:0,behavior:"auto"});
  }

  function starsFor(acc){
    if(acc >= 90) return "⭐⭐⭐";
    if(acc >= 75) return "⭐⭐";
    if(acc >= 60) return "⭐";

    return "💪";
  }

  function renderFallbackSummary(result){
    if($("summaryStars")) $("summaryStars").textContent = starsFor(result.accuracy);

    if($("summaryTitle")){
      $("summaryTitle").textContent = result.passedThisRound
        ? /^BG/.test(result.sessionId)
          ? "Boss Gate Cleared!"
          : "Mission Passed!"
        : "Mission Complete";
    }

    if($("summarySubtitle")){
      $("summarySubtitle").textContent =
        `${result.title} • ${result.passedThisRound ? "ผ่านแล้ว" : "ยังไม่ผ่าน"} • Accuracy ${result.accuracy}%`;
    }

    if($("summaryStats")){
      $("summaryStats").innerHTML = `
        <div class="stat"><b>${result.correct}/${result.total}</b><span>Correct</span></div>
        <div class="stat"><b>${result.accuracy}%</b><span>Accuracy</span></div>
        <div class="stat"><b>${result.xp}</b><span>XP</span></div>
        <div class="stat"><b>${result.maxCombo}</b><span>Max Combo</span></div>
        <div class="stat"><b>${result.passedThisRound ? "YES" : "NO"}</b><span>Passed</span></div>
        <div class="stat"><b>${result.nextMission}</b><span>Next Mission</span></div>
      `;
    }

    if($("summaryWeakWords")){
      $("summaryWeakWords").innerHTML = result.weakCount
        ? `<span class="word-pill">ดูคำที่ควรทบทวนใน Word Deck</span>`
        : `<span class="tag good">ไม่มี Weak Words ในรอบนี้</span>`;
    }

    if($("nextMissionBtn")){
      const next = result.passedThisRound ? result.nextMission : result.sessionId;

      $("nextMissionBtn").textContent = next === "DONE"
        ? "จบคอร์ส / กลับหน้าแรก"
        : result.passedThisRound
          ? `ไปด่านถัดไป: ${next}`
          : `ลองอีกครั้ง: ${next}`;

      $("nextMissionBtn").dataset.hotfixNextMission = next;
      $("nextMissionBtn").dataset.v165NextMission = next;
    }

    if($("summaryTeacherBtn")){
      $("summaryTeacherBtn").hidden = true;
      $("summaryTeacherBtn").setAttribute("aria-hidden","true");
    }

    setScreen("summaryScreen");
  }

  function fallbackFinishRound(){
    if(!isFinalQuestionAnswered()) return false;

    const result = saveFallbackRound();
    renderFallbackSummary(result);

    window.EAP_FINAL_BUTTON_FALLBACK_STATE = {
      version:HOTFIX_VERSION,
      result,
      appliedAt:new Date().toISOString()
    };

    console.warn("[EAP Word Quest] Final button fallback applied:",window.EAP_FINAL_BUTTON_FALLBACK_STATE);

    return true;
  }

  document.addEventListener("click",function(e){
    const btn = e.target && e.target.closest ? e.target.closest("#nextBtn") : null;
    if(!btn) return;

    const shouldCheck = isFinalQuestionAnswered();

    if(!shouldCheck) return;

    setTimeout(() => {
      const summary = $("summaryScreen");
      const summaryActive = summary && summary.classList.contains("active");

      if(!summaryActive && isFinalQuestionAnswered()){
        fallbackFinishRound();
      }
    },360);
  },false);

  document.addEventListener("click",function(e){
    const btn = e.target && e.target.closest ? e.target.closest("#nextMissionBtn") : null;
    if(!btn) return;

    const next = btn.dataset.v165NextMission || btn.dataset.hotfixNextMission;
    if(!next) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if(next === "DONE"){
      const homeBtn = $("homeBtn");
      if(homeBtn) homeBtn.click();
      else setScreen("homeScreen");
      return;
    }

    if(typeof window.startSession === "function"){
      window.startSession(next);
    }
  },true);

  window.forceFinishCurrentRound = fallbackFinishRound;

  window.APP_VERSION = HOTFIX_VERSION;

  const versionPill = $("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  console.info("[EAP Word Quest] Final button fallback hotfix ready:",{
    version:HOTFIX_VERSION,
    helper:"forceFinishCurrentRound()"
  });
})();
