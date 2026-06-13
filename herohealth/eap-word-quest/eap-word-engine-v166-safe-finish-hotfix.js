/* =========================================================
   EAP Word Quest • Safe Finish Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v166-safe-finish-hotfix.js
   Version: v1.6.6-SAFE-FINISH-NO-FREEZE

   Fix:
   - Remove freeze caused by stacked summary/observer hotfixes
   - Intercept final button before original engine can hang
   - Save current round safely
   - Render summary safely
   - Compute next mission after saved pass status
   - No MutationObserver
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.6.6-SAFE-FINISH-NO-FREEZE";

  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";

  const STORAGE_KEYS = [
    "EAP_WORD_QUEST_STATS_V161",
    "EAP_WORD_QUEST_STATS_V160",
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

  function emptyStats(key){
    return {
      __storageKey:key || "EAP_WORD_QUEST_STATS_V161",
      version:HOTFIX_VERSION,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      rounds:0,
      correct:0,
      total:0,
      totalXp:0,
      sessions:{},
      words:{},
      history:[],
      profileSnapshot:readProfile()
    };
  }

  function readStats(){
    const key = findStatsKey();

    try{
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : emptyStats(key);

      if(!data || typeof data !== "object") return emptyStats(key);

      data.__storageKey = key;
      data.sessions = data.sessions && typeof data.sessions === "object" ? data.sessions : {};
      data.words = data.words && typeof data.words === "object" ? data.words : {};
      data.history = Array.isArray(data.history) ? data.history : [];
      data.rounds = Number(data.rounds || 0);
      data.correct = Number(data.correct || 0);
      data.total = Number(data.total || 0);
      data.totalXp = Number(data.totalXp || 0);
      data.createdAt = data.createdAt || new Date().toISOString();

      return data;
    }catch(err){
      console.warn("[EAP Word Quest] v166 cannot read stats:",err);
      return emptyStats(key);
    }
  }

  function saveStats(stats){
    const key = stats.__storageKey || findStatsKey();
    const copy = Object.assign({},stats);

    delete copy.__storageKey;

    copy.version = HOTFIX_VERSION;
    copy.updatedAt = new Date().toISOString();

    localStorage.setItem(key,JSON.stringify(copy));

    return copy;
  }

  function ensureSessionStats(stats,sessionId){
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

    return stats.sessions[sessionId];
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

  function computeNextMission(stats,currentId,passedThisRound){
    if(!passedThisRound) return currentId;

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

    const titleText = normalize($("gameTitle") ? $("gameTitle").textContent : "");

    for(const [id,title] of Object.entries(SESSION_TITLES)){
      if(titleText.includes(title)) return id;
    }

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

  function getProgressNumbers(){
    const progress = normalize($("progressText") ? $("progressText").textContent : "");
    const m = progress.match(/(\d+)\s*\/\s*(\d+)/);

    if(!m){
      return {
        current:0,
        total:0
      };
    }

    return {
      current:Number(m[1]),
      total:Number(m[2])
    };
  }

  function isFinalQuestionReady(){
    const game = $("gameScreen");
    const summary = $("summaryScreen");
    const nextBtn = $("nextBtn");
    const feedback = $("feedbackBox");

    if(!game || !game.classList.contains("active")) return false;
    if(summary && summary.classList.contains("active")) return false;
    if(!nextBtn) return false;
    if(feedback && feedback.hidden) return false;

    const text = normalize(nextBtn.textContent);
    if(!/ดูสรุปผล|summary/i.test(text)) return false;

    const p = getProgressNumbers();

    return p.total > 0 && p.current >= p.total;
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

  function extractWeakWordsFallback(){
    const root = $("summaryWeakWords");
    if(root){
      return Array.from(root.querySelectorAll(".word-pill"))
        .map(el => normalize(el.textContent))
        .filter(Boolean);
    }

    const weakCount = getMiniStat("Weak Words");
    return weakCount > 0 ? ["ดูคำที่ควรทบทวนใน Word Deck"] : [];
  }

  function saveCurrentRoundSafely(){
    const sessionId = currentSessionFromDom();
    const title = SESSION_TITLES[sessionId] || normalize($("gameTitle") ? $("gameTitle").textContent : sessionId);

    const correct = getMiniStat("Correct");
    const wrong = getMiniStat("Wrong");
    const total = Math.max(1,correct + wrong);
    const accuracy = Math.round((correct / total) * 100);
    const xp = getMiniStat("XP");
    const combo = getMiniStat("Combo");
    const maxCombo = getMiniStat("Max Combo") || combo;
    const weakCount = getMiniStat("Weak Words");
    const boss = bossHpFromDom();

    const isBoss = /^BG[1-5]$/.test(sessionId);
    const threshold = thresholdFor(sessionId);

    const passedThisRound = threshold > 0
      ? isBoss
        ? accuracy >= threshold && boss.hp <= 0
        : accuracy >= threshold
      : false;

    const stats = readStats();
    const profile = readProfile();
    const now = new Date().toISOString();
    const s = ensureSessionStats(stats,sessionId);

    /*
      กันบันทึกซ้ำจากการกดหลายครั้ง:
      ถ้า history ล่าสุดเป็น hotfix ตัวเดียวกัน session เดียวกัน ภายใน 5 วินาที ให้ใช้ผลเดิม
    */
    const latest = Array.isArray(stats.history) ? stats.history[0] : null;
    if(
      latest &&
      latest.fallbackHotfix === HOTFIX_VERSION &&
      latest.session === sessionId &&
      Date.now() - new Date(latest.at).getTime() < 5000
    ){
      return {
        sessionId,
        title,
        correct:latest.correct || correct,
        wrong:Math.max(0,(latest.questions || total) - (latest.correct || correct)),
        total:latest.questions || total,
        accuracy:latest.accuracy || accuracy,
        xp:latest.xp || xp,
        maxCombo:latest.maxCombo || maxCombo,
        weakWords:latest.weakWords || [],
        weakCount,
        passedThisRound:Boolean(latest.passed),
        nextMission:computeNextMission(stats,sessionId,Boolean(latest.passed)),
        boss
      };
    }

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

    const weakWords = extractWeakWordsFallback();

    stats.history = Array.isArray(stats.history) ? stats.history : [];
    stats.history.unshift({
      at:now,
      profile,
      section:profile.section || "101",
      studentName:profile.studentName || "",
      studentId:profile.studentId || "",
      session:sessionId,
      name:title,
      mode:"safe-finish",
      questions:total,
      correct,
      accuracy,
      passed:passedThisRound,
      xp,
      maxCombo,
      weakWords,
      isBoss,
      bossHp:boss.hp,
      bossMaxHp:boss.max,
      fallbackHotfix:HOTFIX_VERSION
    });

    stats.history = stats.history.slice(0,80);

    saveStats(stats);

    const nextMission = computeNextMission(stats,sessionId,passedThisRound);

    return {
      sessionId,
      title,
      correct,
      wrong,
      total,
      accuracy,
      xp,
      maxCombo,
      weakWords,
      weakCount,
      passedThisRound,
      nextMission,
      boss
    };
  }

  function starsFor(acc){
    if(acc >= 90) return "⭐⭐⭐";
    if(acc >= 75) return "⭐⭐";
    if(acc >= 60) return "⭐";

    return "💪";
  }

  function setScreen(screenId){
    document.querySelectorAll(".screen").forEach(screen => {
      screen.classList.toggle("active",screen.id === screenId);
    });

    window.scrollTo({
      top:0,
      behavior:"auto"
    });
  }

  function renderSummary(result){
    if($("summaryStars")) $("summaryStars").textContent = starsFor(result.accuracy);

    if($("summaryTitle")){
      if(/^BG/.test(result.sessionId) && result.passedThisRound){
        $("summaryTitle").textContent = result.sessionId === "BG5"
          ? "Final Boss Gate Cleared!"
          : "Boss Gate Cleared!";
      }else{
        $("summaryTitle").textContent = result.passedThisRound
          ? "Mission Passed!"
          : "Mission Complete";
      }
    }

    if($("summarySubtitle")){
      const bossText = /^BG/.test(result.sessionId)
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
        <div class="stat"><b>${result.passedThisRound ? result.nextMission : result.sessionId}</b><span>Next Mission</span></div>
      `;
    }

    if($("summaryWeakWords")){
      if(result.weakWords && result.weakWords.length){
        $("summaryWeakWords").innerHTML = result.weakWords
          .map(w => `<span class="word-pill">${w}</span>`)
          .join("");
      }else if(result.weakCount > 0){
        $("summaryWeakWords").innerHTML = `<span class="word-pill">ดูคำที่ควรทบทวนใน Word Deck</span>`;
      }else{
        $("summaryWeakWords").innerHTML = `<span class="tag good">ไม่มี Weak Words ในรอบนี้</span>`;
      }
    }

    const next = result.passedThisRound ? result.nextMission : result.sessionId;

    if($("nextMissionBtn")){
      $("nextMissionBtn").textContent = next === "DONE"
        ? "จบคอร์ส / กลับหน้าแรก"
        : result.passedThisRound
          ? `ไปด่านถัดไป: ${next}`
          : `ลองอีกครั้ง: ${next}`;

      $("nextMissionBtn").dataset.v166NextMission = next;
    }

    if($("summaryTeacherBtn")){
      $("summaryTeacherBtn").hidden = true;
      $("summaryTeacherBtn").setAttribute("aria-hidden","true");
    }

    setScreen("summaryScreen");
  }

  function finishCurrentRoundSafely(){
    if(finishLock) return false;
    if(!isFinalQuestionReady()) return false;

    finishLock = true;

    try{
      const result = saveCurrentRoundSafely();
      renderSummary(result);

      window.EAP_SAFE_FINISH_STATE = {
        version:HOTFIX_VERSION,
        result,
        appliedAt:new Date().toISOString()
      };

      console.warn("[EAP Word Quest] v166 safe finish applied:",window.EAP_SAFE_FINISH_STATE);

      return true;
    }catch(err){
      finishLock = false;
      console.error("[EAP Word Quest] v166 safe finish failed:",err);
      return false;
    }
  }

  /*
    สำคัญ:
    ใช้ capture phase เพื่อดักก่อน listener เดิมของ engine
    ป้องกัน engine เดิมเข้า loop/ค้างตอนข้อสุดท้าย
  */
  document.addEventListener("click",function(e){
    const btn = e.target && e.target.closest ? e.target.closest("#nextBtn") : null;
    if(!btn) return;

    if(!isFinalQuestionReady()) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    setTimeout(() => {
      finishCurrentRoundSafely();
    },0);
  },true);

  document.addEventListener("click",function(e){
    const btn = e.target && e.target.closest ? e.target.closest("#nextMissionBtn") : null;
    if(!btn) return;

    const next = btn.dataset.v166NextMission;
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
      finishLock = false;
      window.startSession(next);
    }else{
      console.warn("[EAP Word Quest] startSession not available:",next);
    }
  },true);

  window.forceFinishCurrentRound = finishCurrentRoundSafely;

  window.APP_VERSION = HOTFIX_VERSION;

  const versionPill = $("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  console.info("[EAP Word Quest] Safe finish hotfix ready:",{
    version:HOTFIX_VERSION,
    note:"Remove v164 and v165 scripts from index.html. Use v166 only.",
    helper:"forceFinishCurrentRound()"
  });
})();
