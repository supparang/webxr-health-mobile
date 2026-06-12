/* =========================================================
   EAP Word Quest • Summary Next Mission Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v164-summary-next-hotfix.js
   Version: v1.6.4-SUMMARY-NEXT-MISSION-FIX

   Fix:
   - After S3 passed, summary must show BG1, not S3
   - After S6 passed, summary must show BG2
   - After S9 passed, summary must show BG3
   - After S12 passed, summary must show BG4
   - After S15 passed, summary must show BG5
   - Override nextMissionBtn on summary screen using saved stats
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.6.4-SUMMARY-NEXT-MISSION-FIX";

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

  function normalize(value){
    return String(value == null ? "" : value).replace(/\s+/g," ").trim();
  }

  function readStats(){
    for(const key of STORAGE_KEYS){
      try{
        const raw = localStorage.getItem(key);
        if(!raw) continue;

        const data = JSON.parse(raw);
        if(data && typeof data === "object"){
          data.__storageKey = key;
          return data;
        }
      }catch(err){
        console.warn("[EAP Word Quest] Summary next hotfix cannot read",key,err);
      }
    }

    return {
      sessions:{},
      history:[]
    };
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

  function latestPlayedSession(stats){
    const history = Array.isArray(stats.history) ? stats.history : [];
    const latest = history[0];

    if(latest && latest.session){
      return latest.session;
    }

    for(let i = COURSE_FLOW.length - 1; i >= 0; i--){
      const id = COURSE_FLOW[i];
      if(stats.sessions && stats.sessions[id] && stats.sessions[id].lastPlayed){
        return id;
      }
    }

    return "S1";
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

    if(currentId === "BG5" && passed(stats,"BG5")){
      return "DONE";
    }

    return firstRecommendedMission(stats);
  }

  function firstRecommendedMission(stats){
    for(const id of COURSE_FLOW){
      if(isUnlocked(stats,id) && !passed(stats,id)){
        return id;
      }
    }

    return "DONE";
  }

  function setNextMissionCard(nextId){
    const box = document.getElementById("summaryStats");
    if(!box) return;

    const cards = Array.from(box.querySelectorAll(".stat"));

    cards.forEach(card => {
      const label = card.querySelector("span");
      const value = card.querySelector("b");

      if(!label || !value) return;

      if(normalize(label.textContent).toLowerCase() === "next mission"){
        value.textContent = nextId === "DONE" ? "DONE" : nextId;
      }
    });
  }

  function setNextMissionButton(nextId){
    const btn = document.getElementById("nextMissionBtn");
    if(!btn) return;

    if(nextId === "DONE"){
      btn.textContent = "จบคอร์ส / กลับหน้าแรก";
    }else{
      btn.textContent = `ไปด่านถัดไป: ${nextId}`;
    }

    btn.dataset.hotfixNextMission = nextId;
  }

  function patchSummaryNextMission(){
    const summaryScreen = document.getElementById("summaryScreen");
    if(!summaryScreen || !summaryScreen.classList.contains("active")) return;

    const stats = readStats();
    const current = latestPlayedSession(stats);
    const next = computeNextMission(stats,current);

    setNextMissionCard(next);
    setNextMissionButton(next);

    window.EAP_SUMMARY_NEXT_HOTFIX_STATE = {
      version:HOTFIX_VERSION,
      current,
      next,
      storageKey:stats.__storageKey || "",
      checkedAt:new Date().toISOString()
    };

    console.info("[EAP Word Quest] Summary next mission hotfix applied:",window.EAP_SUMMARY_NEXT_HOTFIX_STATE);
  }

  document.addEventListener("click",function(e){
    const btn = e.target && e.target.closest ? e.target.closest("#nextMissionBtn") : null;
    if(!btn) return;

    const summaryScreen = document.getElementById("summaryScreen");
    if(!summaryScreen || !summaryScreen.classList.contains("active")) return;

    const stats = readStats();
    const current = latestPlayedSession(stats);
    const next = btn.dataset.hotfixNextMission || computeNextMission(stats,current);

    e.preventDefault();
    e.stopImmediatePropagation();

    if(next === "DONE"){
      const homeBtn = document.getElementById("homeBtn");
      if(homeBtn) homeBtn.click();
      return;
    }

    if(typeof window.startSession === "function"){
      window.startSession(next);
    }else{
      console.warn("[EAP Word Quest] startSession is not available for next mission:",next);
    }
  },true);

  const observer = new MutationObserver(() => {
    patchSummaryNextMission();
  });

  observer.observe(document.body,{
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:["class"]
  });

  window.fixSummaryNextMission = patchSummaryNextMission;

  window.APP_VERSION = HOTFIX_VERSION;

  const versionPill = document.getElementById("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  setTimeout(patchSummaryNextMission,120);

  console.info("[EAP Word Quest] Summary next mission hotfix ready:",HOTFIX_VERSION);
})();
