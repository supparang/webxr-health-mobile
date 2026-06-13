/* =========================================================
   EAP Word Quest • Boss Gate Summary Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v170-boss-gate-summary-hotfix.js
   Version: v1.7.0-BOSS-GATE-SUMMARY-FIX

   Fix:
   - Boss Gate summary must save BG2/BG3/BG4/BG5, not source session S7/S8/S9
   - Prioritize gameModeText mission id over questionTags
   - questionTags in Boss Gate is only source session, not current mission
   - Force summary screen reliably
   - Includes helper: forceBossGateSummary("BG2")
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.7.0-BOSS-GATE-SUMMARY-FIX";

  if(window.__EAP_WORD_QUEST_V170_BOSS_SUMMARY__){
    console.info("[EAP Word Quest] v170 boss summary already loaded");
    return;
  }

  window.__EAP_WORD_QUEST_V170_BOSS_SUMMARY__ = true;

  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const STATS_KEYS = [
    "EAP_WORD_QUEST_STATS_V160",
    "EAP_WORD_QUEST_STATS_V161",
    "EAP_WORD_QUEST_STATS_V01"
  ];

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

  let finishLock = false;

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

  function readJson(key,fallback){
    try{
      return JSON.parse(localStorage.getItem(key) || "");
    }catch(err){
      return fallback;
    }
  }

  function readProfile(){
    const p = readJson(PROFILE_KEY,{});

    return {
      studentName:normalize(p.studentName || ""),
      studentId:normalize(p.studentId || ""),
      section:normalize(p.section || "101") || "101"
    };
  }

  function activeStatsKey(){
    for(const key of STATS_KEYS){
      if(localStorage.getItem(key)) return key;
    }

    return "EAP_WORD_QUEST_STATS_V160";
  }

  function readStats(){
    const key = activeStatsKey();
    const stats = readJson(key,{}) || {};

    stats.__key = key;
    stats.sessions = stats.sessions && typeof stats.sessions === "object" ? stats.sessions : {};
    stats.words = stats.words && typeof stats.words === "object" ? stats.words : {};
    stats.history = Array.isArray(stats.history) ? stats.history : [];
    stats.rounds = Number(stats.rounds || 0);
    stats.correct = Number(stats.correct || 0);
    stats.total = Number(stats.total || 0);
    stats.totalXp = Number(stats.totalXp || 0);
    stats.createdAt = stats.createdAt || new Date().toISOString();

    return stats;
  }

  function safeSetItem(key,value){
    try{
      localStorage.setItem(key,value);
      return true;
    }catch(err){
      console.warn("[EAP Word Quest] v170 storage save skipped:",err);
      window.EAP_V170_MEMORY_STATS = value;
      return false;
    }
  }

  function saveStats(stats){
    const key = stats.__key || activeStatsKey();
    const copy = Object.assign({},stats);

    delete copy.__key;

    copy.version = HOTFIX_VERSION;
    copy.updatedAt = new Date().toISOString();

    safeSetItem(key,JSON.stringify(copy));
  }

  function ensureSession(stats,sessionId){
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

    return stats.sessions[sessionId];
  }

  function passed(stats,id){
    return Boolean(stats.sessions && stats.sessions[id] && stats.sessions[id].passed);
  }

  function unlocked(stats,id){
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

  function nextMission(stats,currentId,passedThisRound){
    if(!passedThisRound) return currentId;

    const idx = COURSE_FLOW.indexOf(currentId);

    for(let i = idx + 1; i < COURSE_FLOW.length; i++){
      const id = COURSE_FLOW[i];

      if(unlocked(stats,id) && !passed(stats,id)){
        return id;
      }
    }

    for(const id of COURSE_FLOW){
      if(unlocked(stats,id) && !passed(stats,id)){
        return id;
      }
    }

    return "DONE";
  }

  function findMissionIdInText(text){
    const t = normalize(text);
    const m = t.match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/);
    return m ? m[1] : "";
  }

  function currentMissionFromDom(){
    /*
      สำคัญที่สุด:
      ใน Boss Gate, questionTags จะเป็น source session เช่น S9
      แต่ mission จริงอยู่ใน gameModeText เช่น BG2 • Boss Gate
      ดังนั้นต้องอ่าน gameModeText ก่อนเสมอ
    */
    const modeText = normalize($("gameModeText") ? $("gameModeText").textContent : "");
    const modeMission = findMissionIdInText(modeText);

    if(modeMission){
      return modeMission;
    }

    const titleText = normalize($("gameTitle") ? $("gameTitle").textContent : "");

    if(/boss gate/i.test(titleText)){
      /*
        ถ้า title เป็น Boss Gate Battle แต่ modeText หาย
        ห้ามเดา S จาก questionTags เพราะอาจเป็น source session
        ให้ลองดู marker ล่าสุดจาก window ก่อน
      */
      if(window.EAP_CURRENT_BOSS_GATE){
        return window.EAP_CURRENT_BOSS_GATE;
      }
    }

    const tagText = normalize($("questionTags") ? $("questionTags").textContent : "");
    const tagMission = findMissionIdInText(tagText);

    return tagMission || "S1";
  }

  function miniStat(labelName){
    const root = $("gameStats");
    if(!root) return 0;

    const cards = Array.from(root.querySelectorAll(".mini"));

    for(const card of cards){
      const label = normalize(card.querySelector("span") ? card.querySelector("span").textContent : "");
      const value = normalize(card.querySelector("b") ? card.querySelector("b").textContent : "");

      if(label.toLowerCase() === labelName.toLowerCase()){
        return numberFromText(value);
      }
    }

    return 0;
  }

  function statFromSummary(labelName){
    const root = $("summaryStats");
    if(!root) return "";

    const cards = Array.from(root.querySelectorAll(".stat"));

    for(const card of cards){
      const label = normalize(card.querySelector("span") ? card.querySelector("span").textContent : "");
      const value = normalize(card.querySelector("b") ? card.querySelector("b").textContent : "");

      if(label.toLowerCase() === labelName.toLowerCase()){
        return value;
      }
    }

    return "";
  }

  function bossHp(){
    const text = normalize($("questionTags") ? $("questionTags").textContent : "");
    const m = text.match(/Boss\s*HP\s*(\d+)\s*\/\s*(\d+)/i);

    return m ? { hp:Number(m[1]), max:Number(m[2]) } : { hp:0, max:0 };
  }

  function threshold(sessionId){
    if(sessionId === "BG5") return 75;
    if(/^BG[1-4]$/.test(sessionId)) return 70;
    return 60;
  }

  function isFinalButtonReady(){
    const game = $("gameScreen");
    const summary = $("summaryScreen");
    const nextBtn = $("nextBtn");
    const feedback = $("feedbackBox");
    const progress = normalize($("progressText") ? $("progressText").textContent : "");

    if(!game || !game.classList.contains("active")) return false;
    if(summary && summary.classList.contains("active")) return false;
    if(!nextBtn) return false;
    if(feedback && feedback.hidden) return false;
    if(!/ดูสรุปผล|summary/i.test(normalize(nextBtn.textContent))) return false;

    const m = progress.match(/(\d+)\s*\/\s*(\d+)/);
    if(!m) return false;

    return Number(m[1]) >= Number(m[2]);
  }

  function buildResultFromGame(forcedMission){
    const sessionId = forcedMission || currentMissionFromDom();
    const title = SESSION_TITLES[sessionId] || normalize($("gameTitle") ? $("gameTitle").textContent : sessionId);

    const correct = miniStat("Correct");
    const wrong = miniStat("Wrong");
    const total = Math.max(1,correct + wrong);
    const accuracy = Math.round((correct / total) * 100);
    const xp = miniStat("XP");
    const combo = miniStat("Combo");
    const maxCombo = miniStat("Max Combo") || combo;
    const boss = bossHp();
    const isBoss = /^BG[1-5]$/.test(sessionId);

    const passedThisRound = isBoss
      ? accuracy >= threshold(sessionId) && boss.hp <= 0
      : accuracy >= threshold(sessionId);

    return {
      sessionId,
      title,
      correct,
      wrong,
      total,
      accuracy,
      xp,
      maxCombo,
      passedThisRound,
      boss,
      isBoss
    };
  }

  function buildResultFromSummary(forcedMission){
    const sessionId = forcedMission || "BG2";
    const title = SESSION_TITLES[sessionId] || sessionId;

    const correctText = statFromSummary("Correct");
    let correct = 0;
    let total = 1;

    const m = correctText.match(/(\d+)\s*\/\s*(\d+)/);
    if(m){
      correct = Number(m[1]);
      total = Number(m[2]);
    }else{
      correct = numberFromText(correctText);
      total = correct || 1;
    }

    const accuracy = numberFromText(statFromSummary("Accuracy")) || Math.round((correct / total) * 100);
    const xp = numberFromText(statFromSummary("XP"));
    const maxCombo = numberFromText(statFromSummary("Max Combo"));
    const isBoss = /^BG[1-5]$/.test(sessionId);

    return {
      sessionId,
      title,
      correct,
      wrong:Math.max(0,total - correct),
      total,
      accuracy,
      xp,
      maxCombo,
      passedThisRound:accuracy >= threshold(sessionId),
      boss:{ hp:0, max:0 },
      isBoss
    };
  }

  function saveResult(result){
    const stats = readStats();
    const profile = readProfile();
    const now = new Date().toISOString();
    const s = ensureSession(stats,result.sessionId);

    const latest = stats.history && stats.history[0];
    const duplicate = latest &&
      latest.session === result.sessionId &&
      latest.bossSummaryHotfix === HOTFIX_VERSION &&
      Date.now() - new Date(latest.at).getTime() < 8000;

    if(!duplicate){
      s.rounds = Number(s.rounds || 0) + 1;
      s.correct = Number(s.correct || 0) + result.correct;
      s.total = Number(s.total || 0) + result.total;
      s.xp = Number(s.xp || 0) + result.xp;
      s.lastPlayed = now;
      s.played = true;
      s.bestAccuracy = Math.max(Number(s.bestAccuracy || 0),result.accuracy);
      s.bestXp = Math.max(Number(s.bestXp || 0),result.xp);

      if(result.passedThisRound){
        s.passed = true;
        s.lastPassed = now;
      }

      stats.rounds = Number(stats.rounds || 0) + 1;
      stats.correct = Number(stats.correct || 0) + result.correct;
      stats.total = Number(stats.total || 0) + result.total;
      stats.totalXp = Number(stats.totalXp || 0) + result.xp;
      stats.profileSnapshot = profile;

      stats.history.unshift({
        at:now,
        profile,
        section:profile.section || "101",
        studentName:profile.studentName || "",
        studentId:profile.studentId || "",
        session:result.sessionId,
        name:result.title,
        mode:"boss-summary-fix",
        questions:result.total,
        correct:result.correct,
        accuracy:result.accuracy,
        passed:result.passedThisRound,
        xp:result.xp,
        maxCombo:result.maxCombo,
        weakWords:[],
        isBoss:result.isBoss,
        bossHp:result.boss.hp,
        bossMaxHp:result.boss.max,
        bossSummaryHotfix:HOTFIX_VERSION
      });

      stats.history = stats.history.slice(0,20);
      saveStats(stats);
    }

    result.next = nextMission(stats,result.sessionId,result.passedThisRound);

    return result;
  }

  function stars(acc){
    if(acc >= 90) return "⭐⭐⭐";
    if(acc >= 75) return "⭐⭐";
    if(acc >= 60) return "⭐";
    return "💪";
  }

  function forceShowSummary(){
    document.querySelectorAll(".screen").forEach(screen => {
      const active = screen.id === "summaryScreen";
      screen.classList.toggle("active",active);
      screen.hidden = false;
      screen.style.display = active ? "block" : "none";
      screen.style.visibility = active ? "visible" : "hidden";
      screen.style.opacity = active ? "1" : "0";
      screen.style.pointerEvents = active ? "auto" : "none";
    });

    window.scrollTo({ top:0, behavior:"auto" });
  }

  function renderSummary(result){
    if($("summaryStars")) $("summaryStars").textContent = stars(result.accuracy);

    if($("summaryTitle")){
      if(result.isBoss && result.passedThisRound){
        $("summaryTitle").textContent = result.sessionId === "BG5"
          ? "Final Boss Gate Cleared!"
          : "Boss Gate Cleared!";
      }else{
        $("summaryTitle").textContent = result.passedThisRound ? "Mission Passed!" : "Mission Complete";
      }
    }

    if($("summarySubtitle")){
      const bossText = result.isBoss
        ? ` • Boss HP เหลือ ${Math.max(0,result.boss.hp)}/${result.boss.max || 0}`
        : "";

      $("summarySubtitle").textContent =
        `${result.title} • ${result.passedThisRound ? "ผ่านแล้ว" : "ยังไม่ผ่าน"} • Accuracy ${result.accuracy}%${bossText}`;
    }

    if($("summaryStats")){
      $("summaryStats").innerHTML = `
        <div class="stat"><b>${result.correct}/${result.total}</b><span>Correct</span></div>
        <div class="stat"><b>${result.accuracy}%</b><span>Accuracy</span></div>
        <div class="stat"><b>${result.xp}</b><span>XP</span></div>
        <div class="stat"><b>${result.maxCombo}</b><span>Max Combo</span></div>
        <div class="stat"><b>${result.passedThisRound ? "YES" : "NO"}</b><span>Passed</span></div>
        <div class="stat"><b>${result.passedThisRound ? result.next : result.sessionId}</b><span>Next Mission</span></div>
      `;
    }

    if($("summaryWeakWords")){
      $("summaryWeakWords").innerHTML = `<span class="tag good">ไม่มี Weak Words ในรอบนี้</span>`;
    }

    const next = result.passedThisRound ? result.next : result.sessionId;

    if($("nextMissionBtn")){
      $("nextMissionBtn").textContent = next === "DONE"
        ? "จบคอร์ส / กลับหน้าแรก"
        : result.passedThisRound
          ? `ไปด่านถัดไป: ${next}`
          : `ลองอีกครั้ง: ${next}`;

      $("nextMissionBtn").dataset.v170NextMission = next;
    }

    if($("summaryTeacherBtn")){
      $("summaryTeacherBtn").hidden = true;
      $("summaryTeacherBtn").setAttribute("aria-hidden","true");
      $("summaryTeacherBtn").style.display = "none";
    }

    forceShowSummary();

    window.EAP_V170_BOSS_SUMMARY_STATE = {
      version:HOTFIX_VERSION,
      result,
      appliedAt:new Date().toISOString()
    };

    console.warn("[EAP Word Quest] v170 boss summary rendered:",window.EAP_V170_BOSS_SUMMARY_STATE);
  }

  function finishCurrentRound(){
    if(finishLock) return true;
    if(!isFinalButtonReady()) return false;

    finishLock = true;

    try{
      const result = saveResult(buildResultFromGame());
      renderSummary(result);
      return true;
    }catch(err){
      finishLock = false;
      console.error("[EAP Word Quest] v170 finish failed:",err);
      return false;
    }
  }

  function forceBossGateSummary(gateId){
    const id = gateId || "BG2";
    const summaryActive = $("summaryScreen") && $("summaryScreen").classList.contains("active");

    finishLock = false;

    const result = summaryActive
      ? saveResult(buildResultFromSummary(id))
      : saveResult(buildResultFromGame(id));

    renderSummary(result);

    return result;
  }

  document.addEventListener("click",function(e){
    const btn = e.target && e.target.closest ? e.target.closest("#nextBtn") : null;
    if(!btn) return;

    if(!isFinalButtonReady()) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    finishCurrentRound();
  },true);

  document.addEventListener("click",function(e){
    const btn = e.target && e.target.closest ? e.target.closest("#nextMissionBtn") : null;
    if(!btn) return;

    const next = btn.dataset.v170NextMission;
    if(!next) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    finishLock = false;

    document.querySelectorAll(".screen").forEach(screen => {
      screen.style.display = "";
      screen.style.visibility = "";
      screen.style.opacity = "";
      screen.style.pointerEvents = "";
    });

    if(next === "DONE"){
      const homeBtn = $("homeBtn");
      if(homeBtn) homeBtn.click();
      return;
    }

    if(typeof window.startSession === "function"){
      window.startSession(next);
    }
  },true);

  window.forceBossGateSummary = forceBossGateSummary;
  window.forceHardSummary = finishCurrentRound;

  window.APP_VERSION = HOTFIX_VERSION;

  const versionPill = $("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  console.info("[EAP Word Quest] Boss Gate summary hotfix ready:",{
    version:HOTFIX_VERSION,
    helpers:[
      "forceBossGateSummary('BG2')",
      "forceHardSummary()"
    ]
  });
})();
