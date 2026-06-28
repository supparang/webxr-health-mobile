/* =========================================================
   EAP Word Quest • Summary Buttons Restore + Core Summary Guard
   File: /herohealth/eap-word-quest/eap-word-engine-v171-summary-buttons-hotfix.js
   Version: v1.9.10-SUMMARY-BUTTONS-CORE-GUARD-122

   Fix:
   - Restore Home / Replay / Word Deck buttons after legacy summary render.
   - Clear inline styles left by hard summary screen forcing.
   - Keep v170 Boss Gate summary logic for legacy mode.
   - Let the Core Bank controller own the final summary when Core Bank is active.
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.9.10-SUMMARY-BUTTONS-CORE-GUARD-122";

  if(window.__EAP_WORD_QUEST_V171_SUMMARY_BUTTONS__){
    console.info("[EAP Word Quest] v171 summary buttons already loaded");
    return;
  }

  window.__EAP_WORD_QUEST_V171_SUMMARY_BUTTONS__ = true;

  function $(id){
    return document.getElementById(id);
  }

  function clearScreenInlineStyles(){
    document.querySelectorAll(".screen").forEach(screen => {
      screen.hidden = false;
      screen.style.display = "";
      screen.style.visibility = "";
      screen.style.opacity = "";
      screen.style.pointerEvents = "";
      screen.style.transform = "";
      screen.style.position = "";
      screen.style.zIndex = "";
    });

    document.body.classList.remove("game-lock","modal-open","is-playing");
  }

  function showOnlyScreen(screenId){
    clearScreenInlineStyles();

    document.querySelectorAll(".screen").forEach(screen => {
      screen.classList.toggle("active",screen.id === screenId);
    });

    window.scrollTo({
      top:0,
      behavior:"auto"
    });
  }

  function activeScreenId(){
    const active = document.querySelector(".screen.active");
    return active ? active.id : "";
  }

  function repairActiveScreen(){
    const id = activeScreenId();

    clearScreenInlineStyles();

    if(id){
      document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.toggle("active",screen.id === id);
      });
    }

    window.EAP_V171_LAST_REPAIR = {
      version:HOTFIX_VERSION,
      activeScreen:id,
      repairedAt:new Date().toISOString()
    };
  }

  function goHome(){
    clearScreenInlineStyles();

    try{
      if(typeof window.renderHomeStats === "function"){
        window.renderHomeStats();
      }

      if(typeof window.renderSessions === "function"){
        window.renderSessions();
      }
    }catch(err){
      console.warn("[EAP Word Quest] v171 home render warning:",err);
    }

    showOnlyScreen("homeScreen");
  }

  function replayCurrentFromSummary(){
    clearScreenInlineStyles();

    setTimeout(() => {
      repairActiveScreen();

      const id = activeScreenId();
      if(!id || id === "summaryScreen"){
        goHome();
      }
    },80);
  }

  function openDeckFromSummary(){
    clearScreenInlineStyles();

    setTimeout(() => {
      repairActiveScreen();

      const deck = $("wordDeckScreen");
      if(deck && deck.classList.contains("active")){
        showOnlyScreen("wordDeckScreen");
      }
    },80);
  }

  function fixSummaryButtonClick(e){
    const target = e.target && e.target.closest
      ? e.target.closest("#homeBtn,#replayBtn,#summaryDeckBtn,#deckBackBtn,#teacherBackBtn,#quitBtn")
      : null;

    if(!target) return;

    const id = target.id;

    if(id === "homeBtn" || id === "teacherBackBtn"){
      e.preventDefault();
      e.stopImmediatePropagation();
      goHome();
      return;
    }

    if(id === "summaryDeckBtn"){
      openDeckFromSummary();
      return;
    }

    if(id === "replayBtn"){
      replayCurrentFromSummary();
      return;
    }

    if(id === "deckBackBtn"){
      setTimeout(goHome,60);
      return;
    }

    if(id === "quitBtn"){
      setTimeout(goHome,60);
    }
  }

  /*
    v172 registers a window capture listener for #nextBtn immediately after
    this file loads. That listener was essential for the legacy engine, but it
    intercepts the Core Bank's final Next button before the Core controller can
    call finishRun(). This guard wraps only that one v172 registration and
    lets the Core controller own its own summary/result/logging path.
  */
  function installCoreSummaryGuardHook(){
    if(window.__EAP_V171_CORE_SUMMARY_HOOK__) return;
    window.__EAP_V171_CORE_SUMMARY_HOOK__ = true;

    const nativeAdd = window.addEventListener;
    let armed = true;

    window.addEventListener = function(type, listener, options){
      const source = typeof listener === "function"
        ? Function.prototype.toString.call(listener)
        : "";
      const isV172FinalCapture =
        armed &&
        type === "click" &&
        options === true &&
        source.includes("isFinalReady") &&
        source.includes("finishNow") &&
        source.includes("#nextBtn");

      if(isV172FinalCapture){
        armed = false;
        const guardedListener = function(event){
          const coreBankActive = Boolean(
            window.EAP_CORE_QUESTION_BANK &&
            window.EAP_CORE_QUESTION_BANK.coreAligned
          );
          if(coreBankActive || window.__EAP_CORE_CONTROLLER_ACTIVE__ === true){
            return;
          }
          return listener.call(this,event);
        };
        window.__EAP_V172_LEGACY_FINAL_CAPTURE_GUARDED__ = true;
        window.__EAP_V172_LEGACY_FINAL_CAPTURE_ORIGINAL__ = listener;
        window.addEventListener = nativeAdd;
        return nativeAdd.call(window,type,guardedListener,options);
      }

      return nativeAdd.call(window,type,listener,options);
    };

    setTimeout(() => {
      if(armed){
        window.addEventListener = nativeAdd;
      }
    },1800);
  }

  document.addEventListener("click",fixSummaryButtonClick,true);
  installCoreSummaryGuardHook();

  function safetyRepair(){
    const active = document.querySelector(".screen.active");
    if(!active) return;

    const style = window.getComputedStyle(active);
    const blocked =
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.pointerEvents === "none" ||
      style.opacity === "0";

    if(blocked){
      repairActiveScreen();
    }
  }

  window.repairEapSummaryButtons = repairActiveScreen;
  window.goEapHome = goHome;
  window.inspectEapV171CoreSummaryGuard = () => ({
    version:HOTFIX_VERSION,
    guarded:Boolean(window.__EAP_V172_LEGACY_FINAL_CAPTURE_GUARDED__),
    coreBank:Boolean(window.EAP_CORE_QUESTION_BANK && window.EAP_CORE_QUESTION_BANK.coreAligned)
  });

  window.APP_VERSION = HOTFIX_VERSION;

  const versionPill = $("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  setTimeout(safetyRepair,120);
  setTimeout(safetyRepair,500);

  console.info("[EAP Word Quest] Summary buttons + Core summary guard ready:",{
    version:HOTFIX_VERSION,
    helpers:[
      "repairEapSummaryButtons()",
      "goEapHome()",
      "inspectEapV171CoreSummaryGuard()"
    ]
  });
})();
