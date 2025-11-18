// === shadow-breaker.js — Emoji Targets + Boss Face + FEVER ===
'use strict';

(function () {
  const arena = document.getElementById('gameArena');
  if (!arena) return;

  const startBtn = document.getElementById('startBtn');

  const timeEl = document.getElementById('timeVal');
  const scoreEl = document.getElementById('scoreVal');
  const hitEl = document.getElementById('hitVal');
  const missEl = document.getElementById('missVal');
  const comboEl = document.getElementById('comboVal');

  const bossFaceEl = document.getElementById('bossFace');
  const bossIndexEl = document.getElementById('bossIndexVal');
  const bossHpBarEl = document.getElementById('bossHpBar');
  const coachLine = document.getElementById('coachLine');
  const flashMsg = document.getElementById('flashMsg');

  const overlay = document.getElementById('resultOverlay');
  const rScore = document.getElementById('rScore');
  const rTimeUsed = document.getElementById('rTimeUsed');
  const rMaxCombo = document.getElementById('rMaxCombo');
  const rBossCleared = document.getElementById('rBossCleared');

  const playAgainBtn = document.getElementById('playAgainBtn');
  const backBtn = document.getElementById('backBtn');

  // ---------- inject CSS (shake + score float + shards) ----------
  function injectCSS() {
    if (document.getElementById('sbExtraCSS')) return;
    const st = document.createElement('