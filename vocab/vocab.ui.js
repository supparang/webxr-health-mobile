/* =========================================================
   /vocab/vocab.ui.js — Leaderboard First Page Fix
   PATCH: v20260503f
   Fix:
   - render leaderboard on first menu
   - support new id: vocabLeaderboardBox
   - support old id: v68LeaderboardBox
   - read from VocabStorage + legacy localStorage
   - expose renderLeaderboardV68 alias
========================================================= */
(function(){
  "use strict";

  const VERSION = "vocab-leaderboard-fix-v20260503f";

  function $(id){
    return document.getElementById(id);
  }

  function esc(s){
    if(window.VocabUtils && typeof VocabUtils.escapeHtml === "function"){
      return VocabUtils.escapeHtml(s);
    }

    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function readJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      return fallback;
    }
  }

  function getSelectedMode(){
    try{
      return (
        window.VOCAB_APP?.selectedMode ||
        window.VocabState?.get?.().selectedMode ||
        window.vocabGame?.mode ||
        "learn"
      );
    }catch(e){
      return "learn";
    }
  }

  function getStudentId(){
    try{
      const p =
        window.VocabStorage && typeof VocabStorage.loadStudentProfile === "function"
          ? VocabStorage.loadStudentProfile()
          : {};

      return String(p.student_id || p.studentId || "anon");
    }catch(e){
      return "anon";
    }
  }

  function modeInfo(mode){
    const map = {
      learn: {
        icon: "🤖",
        label: "AI Training"
      },
      speed: {
        icon: "⚡",
        label: "Speed Run"
      },
      mission: {
        icon: "🎯",
        label: "Debug Mission"
      },
      battle: {
        icon: "👾",
        label: "Boss Battle"
      },
      bossrush: {
        icon: "💀",
        label: "Boss Rush"
      }
    };

    return map[mode] || map.learn;
  }

  function normalizeBoard(board){
    const fallback = {
      learn: [],
      speed: [],
      mission: [],
      battle: [],
      bossrush: []
    };

    if(!board || typeof board !== "object"){
      return fallback;
    }

    Object.keys(fallback).forEach(function(mode){
      if(!Array.isArray(board[mode])){
        board[mode] = [];
      }
    });

    return board;
  }

  function readBoard(){
    let board = null;

    if(window.VocabStorage && typeof VocabStorage.readLeaderboard === "function"){
      try{
        board = VocabStorage.readLeaderboard();
      }catch(e){
        board = null;
      }
    }

    /*
      fallback key ใหม่ / เก่า
    */
    if(!board){
      board =
        readJson("VOCAB_SPLIT_LEADERBOARD", null) ||
        readJson("VOCAB_V71_LEADERBOARD", null) ||
        readJson("VOCAB_LEADERBOARD", null);
    }

    return normalizeBoard(board);
  }

  function saveBoard(board){
    try{
      if(window.VocabStorage && typeof VocabStorage.saveLeaderboard === "function"){
        VocabStorage.saveLeaderboard(board);
      }else{
        localStorage.setItem("VOCAB_SPLIT_LEADERBOARD", JSON.stringify(board));
      }
    }catch(e){
      console.warn("[VOCAB LB] save board failed", e);
    }
  }

  function getLeaderboardBox(){
    return $("vocabLeaderboardBox") || $("v68LeaderboardBox");
  }

  function getLeaderboardTabs(){
    return Array.from(document.querySelectorAll("[data-lb-mode]"));
  }

  function rowHtml(row, rank){
    const medal =
      rank === 1 ? "🥇" :
      rank === 2 ? "🥈" :
      rank === 3 ? "🥉" :
      "#" + rank;

    const score = Number(row.fair_score || row.score || 0);
    const acc = Number(row.accuracy || 0);
    const diff = row.difficulty || "-";
    const bank = row.bank || "-";
    const name = row.display_name || row.displayName || "Hero";
    const assisted = Number(row.ai_assisted || row.aiHelpUsed || row.ai_help_used || 0) > 0;

    return `
      <div class="vocab-lb-row v68-lb-row">
        <div class="vocab-rank v68-rank">${medal}</div>

        <div class="vocab-lb-name v68-lb-name">
          <b>${esc(name)}</b>
          <small>Bank ${esc(bank)} • ${esc(diff)}</small>
        </div>

        <div class="vocab-lb-score v68-lb-score">${score}</div>

        <div class="v68-hide-mobile">
          <span class="vocab-lb-chip v68-lb-chip">${acc}%</span>
        </div>

        <div class="v68-hide-mobile">
          ${
            assisted
              ? `<span class="vocab-lb-chip v68-lb-chip assisted">🤖 Assisted</span>`
              : `<span class="vocab-lb-chip v68-lb-chip">🏅 No Help</span>`
          }
        </div>
      </div>
    `;
  }

  function personalBestHtml(mode, rows){
    const sid = getStudentId();

    const mine = rows.filter(function(r){
      return String(r.student_id || r.studentId || "anon") === sid;
    });

    if(!mine.length){
      return `
        <div class="vocab-personal-best v68-personal-best">
          ⭐ Personal Best: ยังไม่มีคะแนนของคุณในโหมดนี้
        </div>
      `;
    }

    const best = mine.reduce(function(a, b){
      return Number(a.fair_score || a.score || 0) >= Number(b.fair_score || b.score || 0)
        ? a
        : b;
    });

    const rank = rows.findIndex(function(r){
      return String(r.session_id || r.sessionId || "") === String(best.session_id || best.sessionId || "");
    }) + 1;

    return `
      <div class="vocab-personal-best v68-personal-best">
        ⭐ Personal Best:
        <b>${Number(best.fair_score || best.score || 0)}</b>
        • Rank #${rank || "-"}
        • Accuracy ${Number(best.accuracy || 0)}%
      </div>
    `;
  }

  function renderLeaderboard(mode){
    mode = mode || getSelectedMode() || "learn";

    const box = getLeaderboardBox();
    if(!box) {
      console.warn("[VOCAB LB] leaderboard box not found");
      return;
    }

    const board = readBoard();
    const rows = Array.isArray(board[mode]) ? board[mode] : [];
    const info = modeInfo(mode);

    getLeaderboardTabs().forEach(function(tab){
      tab.classList.toggle("active", tab.dataset.lbMode === mode);
    });

    if(!rows.length){
      box.innerHTML = `
        <div class="vocab-lb-empty v68-lb-empty">
          ${info.icon} ${esc(info.label)}: ยังไม่มีคะแนนในโหมดนี้
        </div>
      `;
      return;
    }

    const sorted = rows.slice().sort(function(a, b){
      const s =
        Number(b.fair_score || b.score || 0) -
        Number(a.fair_score || a.score || 0);

      if(s !== 0) return s;

      const acc =
        Number(b.accuracy || 0) -
        Number(a.accuracy || 0);

      if(acc !== 0) return acc;

      return Number(b.combo_max || b.comboMax || 0) - Number(a.combo_max || a.comboMax || 0);
    });

    box.innerHTML =
      sorted.slice(0, 5).map(function(row, index){
        return rowHtml(row, index + 1);
      }).join("") +
      personalBestHtml(mode, sorted);
  }

  function updateLeaderboardFromResult(result){
    result = result || {};

    let update = null;

    if(window.VocabStorage && typeof VocabStorage.updateLeaderboard === "function"){
      update = VocabStorage.updateLeaderboard(result);
      renderLeaderboard(result.mode || getSelectedMode());
      return update;
    }

    const board = readBoard();
    const mode = String(result.mode || getSelectedMode() || "learn").toLowerCase();

    if(!Array.isArray(board[mode])){
      board[mode] = [];
    }

    const aiHelpUsed = Number(result.aiHelpUsed || result.ai_help_used || 0);
    const rawScore = Number(result.score || 0);
    const fairScore = aiHelpUsed > 0 ? Math.round(rawScore * 0.95) : rawScore;

    const entry = {
      session_id: result.session_id || result.sessionId || "vocab_" + Date.now(),
      timestamp: new Date().toISOString(),
      display_name: result.display_name || result.displayName || "Hero",
      student_id: result.student_id || result.studentId || getStudentId(),
      bank: result.bank || "A",
      difficulty: result.difficulty || "normal",
      mode: mode,
      score: rawScore,
      fair_score: fairScore,
      accuracy: Number(result.accuracy || 0),
      combo_max: Number(result.comboMax || result.combo_max || 0),
      ai_help_used: aiHelpUsed,
      ai_assisted: aiHelpUsed > 0 ? 1 : 0
    };

    board[mode].push(entry);
    board[mode] = board[mode]
      .sort(function(a, b){
        return Number(b.fair_score || b.score || 0) - Number(a.fair_score || a.score || 0);
      })
      .slice(0, 50);

    saveBoard(board);
    renderLeaderboard(mode);

    return {
      entry: entry,
      rank: board[mode].findIndex(function(r){
        return r.session_id === entry.session_id;
      }) + 1,
      fairScore: fairScore
    };
  }

  function bindTabs(){
    getLeaderboardTabs().forEach(function(tab){
      if(tab.__vocabLbBound) return;
      tab.__vocabLbBound = true;

      tab.addEventListener("click", function(){
        const mode = tab.dataset.lbMode || "learn";

        try{
          if(window.VOCAB_APP){
            VOCAB_APP.selectedMode = mode;
          }
        }catch(e){}

        renderLeaderboard(mode);
      });
    });
  }

  function ensureCssCompat(){
    if($("vocabLbCompatCss")) return;

    const style = document.createElement("style");
    style.id = "vocabLbCompatCss";
    style.textContent = `
      .vocab-lb-box{
        border-radius:22px;
        border:1px solid rgba(255,255,255,.16);
        background:rgba(255,255,255,.07);
        overflow:hidden;
      }

      .vocab-lb-row{
        display:grid;
        grid-template-columns:52px 1fr 100px 90px 110px;
        gap:10px;
        align-items:center;
        padding:12px 14px;
        border-bottom:1px solid rgba(255,255,255,.10);
      }

      .vocab-lb-row:last-child{
        border-bottom:0;
      }

      .vocab-rank{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        border-radius:14px;
        background:rgba(255,255,255,.10);
        font-weight:1000;
      }

      .vocab-lb-name b{
        display:block;
      }

      .vocab-lb-name small{
        display:block;
        color:var(--muted);
        margin-top:3px;
      }

      .vocab-lb-score{
        font-size:20px;
        font-weight:1000;
        text-align:right;
      }

      .vocab-lb-chip{
        display:inline-flex;
        justify-content:center;
        padding:6px 9px;
        border-radius:999px;
        background:rgba(255,255,255,.10);
        border:1px solid rgba(255,255,255,.14);
        color:var(--muted);
        font-weight:900;
        font-size:12px;
      }

      .vocab-lb-chip.assisted{
        color:#f5d0fe;
        background:rgba(139,92,246,.16);
        border-color:rgba(139,92,246,.38);
      }

      .vocab-lb-empty{
        padding:16px;
        color:var(--muted);
        font-weight:900;
        text-align:center;
      }

      .vocab-personal-best{
        margin:12px;
        padding:12px 14px;
        border-radius:18px;
        background:rgba(68,223,147,.12);
        border:1px solid rgba(68,223,147,.35);
        color:var(--text);
        font-weight:900;
        line-height:1.45;
      }

      @media(max-width:720px){
        .vocab-lb-row{
          grid-template-columns:42px 1fr 80px;
        }

        .vocab-lb-row .v68-hide-mobile{
          display:none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function bootLeaderboard(){
    ensureCssCompat();
    bindTabs();
    renderLeaderboard(getSelectedMode());

    /*
      กันกรณี UI inject / boot ช้ากว่า
    */
    setTimeout(function(){
      bindTabs();
      renderLeaderboard(getSelectedMode());
    }, 400);

    setTimeout(function(){
      bindTabs();
      renderLeaderboard(getSelectedMode());
    }, 1200);
  }

  /*
    Public API
  */
  window.VocabLeaderboard = {
    version: VERSION,
    render: renderLeaderboard,
    updateFromResult: updateLeaderboardFromResult,
    readBoard: readBoard
  };

  /*
    Legacy aliases
  */
  window.renderLeaderboardV68 = renderLeaderboard;
  window.updateLeaderboardV68 = function(result, reward){
    return updateLeaderboardFromResult(result, reward);
  };

  /*
    Module flags
  */
  window.VocabModules = window.VocabModules || {};
  window.VocabModules.leaderboard = true;

  window.__VOCAB_MODULES__ = window.__VOCAB_MODULES__ || {};
  window.__VOCAB_MODULES__.leaderboard = true;

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bootLeaderboard, { once:true });
  }else{
    bootLeaderboard();
  }

  console.log("[VOCAB LB] loaded", VERSION);
})();
