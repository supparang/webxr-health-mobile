// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — DOM Target Engine + Coach + Goals
// ใช้ร่วมกับ #fg-layer, CSS .fg-target*, ui-fever.js

(() => {
  'use strict';

  // ---------- config ----------
  const GAME = {
    durationSec: 60,
    goalScore: 150,
    miniGood: 12,
    maxActive: 3,
    targetLifetime: 2600,
    spawnIntervalMs: 250,   // gameTick ทุก 250 ms
    spawnProb: 0.45         // โอกาส spawn ต่อ tick
  };

  const SIZE_BY_DIFF = {
    easy:   1.25,
    normal: 1.0,
    hard:   0.8
  };

  const GOOD_EMOJIS = ['🥦', '🥕', '🍎', '🍊', '🍚', '🥚'];
  const JUNK_EMOJIS = ['🍩', '🍕', '🍟', '🍰', '🥤'];

  // ---------- state ----------
  const STATE = {
    running: false,
    timeLeft: GAME.durationSec,
    score: 0,
    combo: 0,
    misses: 0,
    goodHits: 0,
    totalTargets: 0,
    activeTargets: 0,
    diff: 'normal',
    sizeFactor: 1.0,
    tickTimer: null
  };

  const $ = (sel) => document.querySelector(sel);

  // ---------- coach ----------
  let coachTimer = null;

  function setCoachMessage(text, emoji) {
    const bubble = $('#coach-bubble');
    const avatar = $('#coach-avatar');
    const textEl = $('#coach-text');
    if (!bubble || !textEl) return;

    if (emoji && avatar) avatar.textContent = emoji;
    textEl.textContent = text;
    bubble.classList.add('show');

    if (coachTimer) clearTimeout(coachTimer);
    coachTimer = setTimeout(() => {
      bubble.classList.remove('show');
    }, 3500);
  }

  // ---------- helpers ----------
  function clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomScreenPos() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;

    const topSafe = 120;     // กัน HUD + fever
    const bottomSafe = 180;  // กัน coach ด้านล่าง
    const leftSafe = w * 0.15;
    const rightSafe = w * 0.85;

    const x = leftSafe + Math.random() * (rightSafe - leftSafe);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);
    return { x, y };
  }

  // ---------- HUD ----------
  function updateTopHUD() {
    const scoreEl = document.querySelector('[data-role="score-value"]');
    if (scoreEl) scoreEl.textContent = STATE.score.toString();

    const diffLabel = $('#diff-label');
    if (diffLabel) {
      diffLabel.textContent =
        STATE.diff.toUpperCase() + ' • ' + STATE.timeLeft.toFixed(0) + 's';
    }

    const goalEl = $('#goal-progress');
    const miniEl = $('#mini-progress');

    if (goalEl) {
      const shown = clamp(STATE.score, 0, GAME.goalScore);
      goalEl.textContent = `${shown} / ${GAME.goalScore}`;
    }
    if (miniEl) {
      const shownGood = clamp(STATE.goodHits, 0, GAME.miniGood);
      miniEl.textContent = `${shownGood} / ${GAME.miniGood}`;
    }
  }

  // ---------- result overlay ----------
  function showResultOverlay() {
    const ov = $('#result-overlay');
    if (!ov) return;

    $('#res-score').textContent = STATE.score.toString();
    $('#res-good').textContent = STATE.goodHits.toString();
    $('#res-miss').textContent = STATE.misses.toString();

    const goalFlag = STATE.score >= GAME.goalScore ? 'ผ่าน ✅' : 'ยังไม่ถึง ❌';
    const miniFlag = STATE.goodHits >= GAME.miniGood ? 'ผ่าน ✅' : 'ยังไม่ถึง ❌';

    $('#res-goal-flag').textContent = goalFlag;
    $('#res-mini-flag').textContent = miniFlag;

    ov.classList.add('show');
  }

  function hideResultOverlay() {
    const ov = $('#result-overlay');
    if (!ov) return;
    ov.classList.remove('show');
  }

  // ---------- target ----------
  function spawnTarget() {
    if (!STATE.running) return;
    if (STATE.activeTargets >= GAME.maxActive) return;

    const layer = $('#fg-layer');
    if (!layer) return; // ถ้าไม่มีเลเยอร์ -> ไม่มีเป้าโผล่

    const { x, y } = randomScreenPos();
    const isGood = Math.random() < 0.65;

    const el = document.createElement('div');
    el.className = 'fg-target ' + (isGood ? 'fg-good' : 'fg-junk');
    el.dataset.good = isGood ? '1' : '0';
    el.dataset.hit = '0';
    el.dataset.birth = String(performance.now());

    const emojiChar = isGood ? randomFrom(GOOD_EMOJIS) : randomFrom(JUNK_EMOJIS);
    el.setAttribute('data-emoji', emojiChar);

    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = `translate(-50%, -50%) scale(${STATE.sizeFactor})`;

    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      handleHit(el);
    });

    layer.appendChild(el);
    STATE.activeTargets++;
    STATE.totalTargets++;

    setTimeout(() => {
      if (!el.isConnected) return;
      if (el.dataset.hit === '1') return;
      handleMiss(el);
    }, GAME.targetLifetime);
  }

  function handleHit(el) {
    if (!STATE.running) return;
    if (!el || !el.isConnected) return;

    el.dataset.hit = '1';

    const isGood = el.dataset.good === '1';
    let scoreDelta = isGood ? 10 : -8;

    STATE.combo = isGood ? STATE.combo + 1 : 0;
    if (STATE.combo >= 5 && isGood) {
      scoreDelta += 5;
    }

    STATE.score = Math.max(0, STATE.score + scoreDelta);
    if (isGood) STATE.goodHits++;

    STATE.activeTargets = Math.max(0, STATE.activeTargets - 1);

    el.classList.add('hit');
    setTimeout(() => {
      if (el.isConnected) el.remove();
    }, 120);

    updateTopHUD();

    if (isGood && STATE.goodHits === 1) {
      setCoachMessage('เยี่ยมเลย เริ่มเก็บอาหารดีได้แล้ว 🎉', '😄');
    } else if (!isGood && STATE.misses % 3 === 0) {
      setCoachMessage('ระวังของมันของหวานหน่อยน้า 🍩', '😅');
    }
  }

  function handleMiss(el) {
    if (!STATE.running) {
      if (el && el.isConnected) el.remove();
      return;
    }

    STATE.misses++;
    STATE.combo = 0;
    STATE.activeTargets = Math.max(0, STATE.activeTargets - 1);

    if (el && el.isConnected) {
      el.classList.add('hit');
      setTimeout(() => {
        if (el.isConnected) el.remove();
      }, 100);
    }

    updateTopHUD();

    if (STATE.misses === 3) {
      setCoachMessage('พลาดไปบ้างไม่เป็นไร ค่อย ๆ เล็งใหม่นะ 😊', '🙂');
    }
  }

  function clearAllTargets() {
    document.querySelectorAll('.fg-target').forEach((el) => el.remove());
    STATE.activeTargets = 0;
  }

  // ---------- game loop ----------
  function gameTick() {
    if (!STATE.running) return;

    STATE.timeLeft -= GAME.spawnIntervalMs / 1000;
    if (STATE.timeLeft <= 0) {
      STATE.timeLeft = 0;
      updateTopHUD();
      endGame();
      return;
    }

    if (STATE.activeTargets < GAME.maxActive && Math.random() < GAME.spawnProb) {
      spawnTarget();
    }

    updateTopHUD();
  }

  function startGame() {
    hideResultOverlay();
    clearAllTargets();

    STATE.running = true;
    STATE.timeLeft = GAME.durationSec;
    STATE.score = 0;
    STATE.combo = 0;
    STATE.misses = 0;
    STATE.goodHits = 0;
    STATE.totalTargets = 0;
    STATE.activeTargets = 0;

    updateTopHUD();

    if (STATE.tickTimer) clearInterval(STATE.tickTimer);
    STATE.tickTimer = setInterval(gameTick, GAME.spawnIntervalMs);

    // เริ่มมีเป้า 1–2 อัน
    spawnTarget();
    spawnTarget();

    setCoachMessage('แตะเป้าอาหารให้ตรงกลุ่มหมวดนะ!', '🥦');

    if (window.FeverUI && window.FeverUI.ensureFeverBar) {
      window.FeverUI.ensureFeverBar();
      if (window.FeverUI.setFever) window.FeverUI.setFever(0);
      if (window.FeverUI.setShield) window.FeverUI.setShield(0);
    }
  }

  function endGame() {
    STATE.running = false;
    if (STATE.tickTimer) clearInterval(STATE.tickTimer);
    clearAllTargets();

    showResultOverlay();

    if (STATE.score >= GAME.goalScore && STATE.goodHits >= GAME.miniGood) {
      setCoachMessage('สุดยอด! ทำครบทั้ง Goal และ Mini quest เลย 🎉', '🤩');
    } else {
      setCoachMessage('เก่งมากแล้ว รอบหน้าลองทำให้เต็มเป้านะ 💪', '😊');
    }
  }

  // ---------- init ----------
  function init() {
    try {
      const url = new URL(window.location.href);
      const diffParam = (url.searchParams.get('diff') || 'normal').toLowerCase();
      if (diffParam === 'easy' || diffParam === 'hard' || diffParam === 'normal') {
        STATE.diff = diffParam;
      }
    } catch (e) {}

    STATE.sizeFactor = SIZE_BY_DIFF[STATE.diff] || 1.0;

    const restartBtn = $('#res-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        startGame();
      });
    }

    startGame();
  }

  window.addEventListener('load', init);
})();
