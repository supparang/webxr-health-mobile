/* =========================================================
   EAP Word Quest • Summary Buttons Restore Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v171-summary-buttons-hotfix.js
   Version: v1.7.1-SUMMARY-BUTTONS-RESTORE

   Fix:
   - After hard summary render, only Next Mission works
   - Restore Home / Replay / Word Deck buttons
   - Clear inline styles left by hard summary screen forcing
   - Keep v170 Boss Gate summary logic
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.7.1-SUMMARY-BUTTONS-RESTORE";

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

    /*
      ให้ handler เดิมของปุ่ม replay ทำงานก่อน แล้วซ่อม screen style ตามหลัง
      เพราะ engine หลักถือ state รอบล่าสุดไว้
    */
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

    /*
      ให้ handler เดิม renderWordDeck() ทำงานก่อน แล้วล้าง inline style ตามหลัง
    */
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
      /*
        ไม่ stopImmediatePropagation เพื่อให้ handler เดิม render deck ก่อน
      */
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
    ใช้ capture เฉพาะ Home/Back ที่ต้อง override
    ปุ่มอื่นปล่อย handler เดิมทำงาน แล้ว repair ตามหลัง
  */
  document.addEventListener("click",fixSummaryButtonClick,true);

  /*
    Safety repair:
    ถ้ามี screen active แต่ยังโดน inline hidden จาก v170 ให้ซ่อมอัตโนมัติสั้น ๆ
  */
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

  window.APP_VERSION = HOTFIX_VERSION;

  const versionPill = $("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  setTimeout(safetyRepair,120);
  setTimeout(safetyRepair,500);

  console.info("[EAP Word Quest] Summary buttons restore hotfix ready:",{
    version:HOTFIX_VERSION,
    helpers:[
      "repairEapSummaryButtons()",
      "goEapHome()"
    ]
  });
})();