/* =========================================================
   EAP Word Quest • Summary Overlay Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v172-summary-overlay-hotfix.js
   Version: v1.7.2-SUMMARY-OVERLAY-NO-STUCK

   Fix:
   - v170 logs "summary rendered" but UI remains on game screen
   - Use hard overlay summary instead of depending on .screen switching
   - Capture final summary button at window level before older handlers
   - Keeps Boss Gate mission id correct
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.7.2-SUMMARY-OVERLAY-NO-STUCK";

  if(window.__EAP_WORD_QUEST_V172_SUMMARY_OVERLAY__){
    console.info("[EAP Word Quest] v172 summary overlay already loaded");
    return;
  }

  window.__EAP_WORD_QUEST_V172_SUMMARY_OVERLAY__ = true;

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

  const TITLES = {
    S1:"Academic Profile",
    S2:"Project Introduction",
    S3:"Project Rationale & Target Users",
    BG1:"Vocabulary Boss 1",
    S4:"Tech Careers & Academic Roles",
    S5:"Team Communication",
    S6:"Progress Report & Responsibility",
    BG2:"Vocabulary Boss 2",
    S7:"Academic Email",
    S8:"Discussion & Meeting Language",
    S9:"Summary & Action Items",
    BG3:"Vocabulary Boss 3",
    S10:"System Explanation",
    S11:"Problem Report & Solution",
    S12:"User Guide & Instruction",
    BG4:"Vocabulary Boss 4",
    S13:"AI Report / Academic Summary",
    S14:"Portfolio, CV & Pitch",
    S15:"Final Presentation & Reflection",
    BG5:"Final Vocabulary Boss"
  };

  function $(id){
    return document.getElementById(id);
  }

  function norm(v){
    return String(v == null ? "" : v).replace(/\s+/g," ").trim();
  }

  function num(v){
    const m = norm(v).match(/-?\d+/);
    return m ? Number(m[0]) : 0;
  }

  function readJson(key,fallback){
    try{
      return JSON.parse(localStorage.getItem(key) || "");
    }catch(err){
      return fallback;
    }
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

  function readProfile(){
    const p = readJson(PROFILE_KEY,{}) || {};
    return {
      studentName:norm(p.studentName || ""),
      studentId:norm(p.studentId || ""),
      section:norm(p.section || window.EAP_DEFAULT_SECTION || "122") || "122"
    };
  }

  function saveStats(stats){
    const key = stats.__key || activeStatsKey();
    const copy = Object.assign({},stats);
    delete copy.__key;

    copy.version = HOTFIX_VERSION;
    copy.updatedAt = new Date().toISOString();

    try{
      localStorage.setItem(key,JSON.stringify(copy));
    }catch(err){
      console.warn("[EAP Word Quest] v172 storage skipped:",err);
      window.EAP_V172_MEMORY_STATS = copy;
    }
  }

  function ensureSession(stats,id){
    if(!stats.sessions[id]){
      stats.sessions[id] = {
        rounds:0,
        correct:0,
        total:0,
        xp:0,
        bestAccuracy:0,
        bestXp:0,
        played:false,
        passed:false,
        lastPlayed:null,
        lastPassed:null
      };
    }
    return stats.sessions[id];
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

  function findMission(text){
    const m = norm(text).match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/);
    return m ? m[1] : "";
  }

  function currentMission(){
    /*
      สำคัญ:
      Boss Gate ต้องอ่านจาก gameModeText ก่อน
      เพราะ questionTags อาจเป็น source session เช่น S2/S3
    */
    const mode = findMission($("gameModeText") ? $("gameModeText").textContent : "");
    if(mode) return mode;

    const title = norm($("gameTitle") ? $("gameTitle").textContent : "");
    if(/boss/i.test(title) && window.EAP_CURRENT_BOSS_GATE){
      return window.EAP_CURRENT_BOSS_GATE;
    }

    const tag = findMission($("questionTags") ? $("questionTags").textContent : "");
    return tag || "S1";
  }

  function miniStat(labelName){
    const root = $("gameStats");
    if(!root) return 0;

    const cards = Array.from(root.querySelectorAll(".mini,.stat"));
    for(const card of cards){
      const label = norm(card.querySelector("span") ? card.querySelector("span").textContent : "");
      const value = norm(card.querySelector("b") ? card.querySelector("b").textContent : "");
      if(label.toLowerCase() === labelName.toLowerCase()){
        return num(value);
      }
    }

    return 0;
  }

  function bossHp(){
    const t = norm($("questionTags") ? $("questionTags").textContent : "");
    const m = t.match(/Boss\s*HP\s*(\d+)\s*\/\s*(\d+)/i);
    return m ? { hp:Number(m[1]), max:Number(m[2]) } : { hp:0, max:0 };
  }

  function threshold(id){
    if(id === "BG5") return 75;
    if(/^BG[1-4]$/.test(id)) return 70;
    return 60;
  }

  function isFinalReady(){
    const nextBtn = $("nextBtn");
    const game = $("gameScreen");
    const feedback = $("feedbackBox");
    const progress = norm($("progressText") ? $("progressText").textContent : "");

    if(!nextBtn) return false;
    if(game && !game.classList.contains("active")) return false;
    if(feedback && feedback.hidden) return false;
    if(!/ดูสรุปผล|summary/i.test(norm(nextBtn.textContent))) return false;

    const m = progress.match(/(\d+)\s*\/\s*(\d+)/);
    if(!m) return false;

    return Number(m[1]) >= Number(m[2]);
  }

  function buildResult(){
    const id = currentMission();
    const correct = miniStat("Correct");
    const wrong = miniStat("Wrong");
    const total = Math.max(1,correct + wrong);
    const accuracy = Math.round((correct / total) * 100);
    const xp = miniStat("XP");
    const combo = miniStat("Max Combo") || miniStat("Combo");
    const boss = bossHp();
    const isBoss = /^BG[1-5]$/.test(id);

    const passedThisRound = isBoss
      ? accuracy >= threshold(id) && boss.hp <= 0
      : accuracy >= threshold(id);

    return {
      id,
      title:TITLES[id] || id,
      correct,
      wrong,
      total,
      accuracy,
      xp,
      maxCombo:combo,
      boss,
      isBoss,
      passed:passedThisRound
    };
  }

  function saveResult(result){
    const stats = readStats();
    const profile = readProfile();
    const now = new Date().toISOString();

    const latest = stats.history && stats.history[0];
    const duplicate =
      latest &&
      latest.session === result.id &&
      Number(latest.correct || 0) === result.correct &&
      Number(latest.questions || latest.total || 0) === result.total &&
      Date.now() - new Date(latest.at || latest.updatedAt || 0).getTime() < 30000;

    if(!duplicate){
      const s = ensureSession(stats,result.id);

      s.rounds = Number(s.rounds || 0) + 1;
      s.correct = Number(s.correct || 0) + result.correct;
      s.total = Number(s.total || 0) + result.total;
      s.xp = Number(s.xp || 0) + result.xp;
      s.bestAccuracy = Math.max(Number(s.bestAccuracy || 0),result.accuracy);
      s.bestXp = Math.max(Number(s.bestXp || 0),result.xp);
      s.played = true;
      s.lastPlayed = now;

      if(result.passed){
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
        section:profile.section || "122",
        studentName:profile.studentName || "",
        studentId:profile.studentId || "",
        session:result.id,
        name:result.title,
        mode:"summary-overlay",
        questions:result.total,
        correct:result.correct,
        accuracy:result.accuracy,
        passed:result.passed,
        xp:result.xp,
        maxCombo:result.maxCombo,
        isBoss:result.isBoss,
        bossHp:result.boss.hp,
        bossMaxHp:result.boss.max,
        summaryOverlayHotfix:HOTFIX_VERSION
      });

      stats.history = stats.history.slice(0,20);
      saveStats(stats);
    }

    result.next = nextMission(stats,result.id,result.passed);
    return result;
  }

  function levelLabel(acc){
    if(acc >= 90) return "Vocabulary Mastery";
    if(acc >= 75) return "Vocabulary Strong";
    if(acc >= 60) return "Vocabulary Ready";
    return "Keep Practicing";
  }

  function stars(acc){
    if(acc >= 90) return "⭐⭐⭐";
    if(acc >= 75) return "⭐⭐";
    if(acc >= 60) return "⭐";
    return "💪";
  }

  function removeOverlay(){
    const old = $("eapV172SummaryOverlay");
    if(old) old.remove();
  }

  function escapeHtml(v){
    return String(v == null ? "" : v)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function showOverlay(result){
    removeOverlay();

    const nextText = result.next === "DONE"
      ? "จบคอร์ส / กลับหน้าแรก"
      : result.passed
        ? `ไปด่านถัดไป: ${result.next}`
        : `ฝึกอีกครั้ง: ${result.id}`;

    const title = result.isBoss && result.passed
      ? (result.id === "BG5" ? "Final Vocabulary Boss Cleared!" : "Vocabulary Boss Cleared!")
      : result.passed
        ? "Vocabulary Ready!"
        : "Keep Practicing";

    const bossLine = result.isBoss
      ? `<div class="eap172-chip">Boss HP ${Math.max(0,result.boss.hp)}/${result.boss.max || 0}</div>`
      : "";

    const overlay = document.createElement("div");
    overlay.id = "eapV172SummaryOverlay";
    overlay.innerHTML = `
      <style>
        #eapV172SummaryOverlay{
          position:fixed;
          inset:0;
          z-index:2147483647;
          background:linear-gradient(135deg,rgba(240,244,255,.96),rgba(236,253,245,.97));
          display:flex;
          align-items:center;
          justify-content:center;
          padding:22px;
          font-family:inherit;
          color:#0f172a;
        }
        #eapV172SummaryOverlay .eap172-card{
          width:min(920px,100%);
          background:#fff;
          border:1px solid #e2e8f0;
          border-radius:28px;
          box-shadow:0 30px 80px rgba(15,23,42,.18);
          padding:28px;
        }
        #eapV172SummaryOverlay .eap172-stars{
          text-align:center;
          font-size:34px;
          margin-bottom:8px;
        }
        #eapV172SummaryOverlay h2{
          text-align:center;
          font-size:34px;
          line-height:1.1;
          margin:0 0 8px;
        }
        #eapV172SummaryOverlay .eap172-sub{
          text-align:center;
          color:#64748b;
          font-weight:700;
          margin-bottom:20px;
        }
        #eapV172SummaryOverlay .eap172-grid{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:12px;
          margin:18px 0;
        }
        #eapV172SummaryOverlay .eap172-stat{
          border:1px solid #e5e7eb;
          border-radius:18px;
          padding:16px;
          background:linear-gradient(180deg,#fff,#f8fafc);
        }
        #eapV172SummaryOverlay .eap172-stat b{
          display:block;
          font-size:22px;
          margin-bottom:4px;
        }
        #eapV172SummaryOverlay .eap172-stat span{
          color:#64748b;
          font-size:13px;
          font-weight:800;
        }
        #eapV172SummaryOverlay .eap172-report{
          border:1px solid #dbeafe;
          background:#eff6ff;
          border-radius:18px;
          padding:16px;
          margin-top:12px;
          color:#1e3a8a;
          font-weight:700;
        }
        #eapV172SummaryOverlay .eap172-chips{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          justify-content:center;
          margin:10px 0 16px;
        }
        #eapV172SummaryOverlay .eap172-chip{
          border:1px solid #c7d2fe;
          background:#eef2ff;
          color:#3730a3;
          border-radius:999px;
          padding:7px 11px;
          font-weight:900;
          font-size:13px;
        }
        #eapV172SummaryOverlay .eap172-actions{
          display:flex;
          flex-wrap:wrap;
          gap:10px;
          margin-top:18px;
        }
        #eapV172SummaryOverlay button{
          border:0;
          border-radius:14px;
          padding:13px 16px;
          font-weight:900;
          font-size:15px;
          cursor:pointer;
        }
        #eap172Next{
          background:#5b5cf6;
          color:#fff;
          box-shadow:0 14px 28px rgba(91,92,246,.24);
        }
        #eap172Replay,#eap172Deck,#eap172Home{
          background:#f8fafc;
          color:#0f172a;
          border:1px solid #e2e8f0 !important;
        }
        @media(max-width:720px){
          #eapV172SummaryOverlay{
            align-items:flex-start;
            overflow:auto;
            padding:14px;
          }
          #eapV172SummaryOverlay .eap172-card{
            border-radius:22px;
            padding:18px;
          }
          #eapV172SummaryOverlay h2{
            font-size:26px;
          }
          #eapV172SummaryOverlay .eap172-grid{
            grid-template-columns:repeat(2,1fr);
          }
          #eapV172SummaryOverlay .eap172-actions button{
            width:100%;
          }
        }
      </style>

      <div class="eap172-card">
        <div class="eap172-stars">${stars(result.accuracy)}</div>
        <h2>${escapeHtml(title)}</h2>
        <div class="eap172-sub">
          ${escapeHtml(result.title)} • ${result.passed ? "ผ่านแล้ว" : "ยังไม่ผ่าน"} • Accuracy ${result.accuracy}%
        </div>

        <div class="eap172-chips">
          <div class="eap172-chip">${escapeHtml(result.id)}</div>
          <div class="eap172-chip">${escapeHtml(levelLabel(result.accuracy))}</div>
          <div class="eap172-chip">Group 122</div>
          ${bossLine}
        </div>

        <div class="eap172-grid">
          <div class="eap172-stat"><b>${result.correct}/${result.total}</b><span>Correct</span></div>
          <div class="eap172-stat"><b>${result.accuracy}%</b><span>Accuracy</span></div>
          <div class="eap172-stat"><b>${result.xp}</b><span>XP</span></div>
          <div class="eap172-stat"><b>${result.maxCombo}</b><span>Max Combo</span></div>
          <div class="eap172-stat"><b>${result.passed ? "YES" : "NO"}</b><span>Passed</span></div>
          <div class="eap172-stat"><b>${result.passed ? result.next : result.id}</b><span>Next Mission</span></div>
        </div>

        <div class="eap172-report">
          AI Prediction: ${result.accuracy >= 75 ? "Ready for Main Mission" : result.accuracy >= 60 ? "Ready, but review recommended" : "At Risk — replay with AI Help"}
        </div>

        <div class="eap172-actions">
          <button id="eap172Next">${escapeHtml(nextText)}</button>
          <button id="eap172Replay">เล่นอีกครั้ง</button>
          <button id="eap172Deck">เปิด Word Deck</button>
          <button id="eap172Home">กลับหน้าแรก</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    $("eap172Next").onclick = function(){
      removeOverlay();

      if(result.next === "DONE"){
        goHome();
        return;
      }

      startMission(result.passed ? result.next : result.id);
    };

    $("eap172Replay").onclick = function(){
      removeOverlay();
      startMission(result.id);
    };

    $("eap172Deck").onclick = function(){
      removeOverlay();
      openDeck();
    };

    $("eap172Home").onclick = function(){
      removeOverlay();
      goHome();
    };

    window.EAP_V172_SUMMARY_STATE = {
      version:HOTFIX_VERSION,
      result,
      renderedAt:new Date().toISOString()
    };

    console.warn("[EAP Word Quest] v172 overlay summary rendered:",window.EAP_V172_SUMMARY_STATE);
  }

  function clearScreenStyles(){
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
  }

  function showScreen(id){
    clearScreenStyles();
    document.querySelectorAll(".screen").forEach(screen => {
      screen.classList.toggle("active",screen.id === id);
    });
    window.scrollTo({top:0,behavior:"auto"});
  }

  function goHome(){
    try{
      if(typeof window.renderHomeStats === "function") window.renderHomeStats();
      if(typeof window.renderSessions === "function") window.renderSessions();
    }catch(err){
      console.warn("[EAP Word Quest] v172 home render warning:",err);
    }

    showScreen("homeScreen");
  }

  function startMission(id){
    clearScreenStyles();

    if(typeof window.startSession === "function"){
      window.startSession(id);
      return;
    }

    console.warn("[EAP Word Quest] startSession() not found, returning home.");
    goHome();
  }

  function openDeck(){
    clearScreenStyles();

    if(typeof window.renderWordDeck === "function"){
      try{
        window.renderWordDeck();
        showScreen("wordDeckScreen");
        return;
      }catch(err){
        console.warn("[EAP Word Quest] renderWordDeck warning:",err);
      }
    }

    const deckBtn = $("summaryDeckBtn");
    if(deckBtn){
      deckBtn.click();
      return;
    }

    goHome();
  }

  function finishNow(){
    const result = saveResult(buildResult());
    showOverlay(result);
    return result;
  }

  /*
    สำคัญ:
    ใช้ window capture เพื่อดักก่อน v170/v14
  */
  window.addEventListener("click",function(e){
    const btn = e.target && e.target.closest ? e.target.closest("#nextBtn") : null;
    if(!btn) return;
    if(!isFinalReady()) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    finishNow();
  },true);

  window.showEap172SummaryNow = finishNow;
  window.closeEap172Summary = removeOverlay;

  window.APP_VERSION = HOTFIX_VERSION;

  const versionPill = $("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  console.info("[EAP Word Quest] v172 summary overlay hotfix ready:",{
    version:HOTFIX_VERSION,
    helpers:[
      "showEap172SummaryNow()",
      "closeEap172Summary()"
    ]
  });
})();
