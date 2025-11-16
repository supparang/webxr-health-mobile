// === Shadow Breaker — DOM target prototype (ใช้ร่วมกับ VRFGameShell) ===
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  const stage = $('#sb-stage');
  const msgEl = $('#sb-message');

  let shell = null;
  let spawnTimer = 0;
  let spawnInterval = 1.0;
  let targetLifetime = 1.2;
  const targets = new Set();

  const EMOJIS = ['🥊', '💥', '⭐', '⚡', '🔥'];

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function removeTarget(el, isHit) {
    if (!el || !targets.has(el)) return;
    targets.delete(el);
    if (el.parentNode) el.parentNode.removeChild(el);

    if (!shell) return;
    if (isHit) {
      VRFGameShell.addScore(10);
      console.log('[SB] HIT +10');
    } else {
      VRFGameShell.addMiss();
      console.log('[SB] MISS');
    }
  }

  function spawnTarget() {
    if (!stage || !shell || shell.state !== 'playing') return;

    const rect = stage.getBoundingClientRect();
    const x = rand(rect.width * 0.15, rect.width * 0.85);
    const y = rand(rect.height * 0.20, rect.height * 0.80);

    const el = document.createElement('div');
    el.className = 'sb-target sb-pop' + (shell.difficulty === 'hard' ? ' sb-target-hard' : '');
    el.textContent = pick(EMOJIS);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.dataset.createdAt = performance.now();

    const onHit = (e) => {
      e.stopPropagation();
      removeTarget(el, true);
    };

    el.addEventListener('click', onHit, { passive: false });
    el.addEventListener('pointerdown', onHit, { passive: false });

    stage.appendChild(el);
    targets.add(el);
  }

  function clearAllTargets() {
    targets.forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    targets.clear();
  }

  function applyDifficulty() {
    switch (shell.difficulty) {
      case 'easy':
        spawnInterval = 1.3;
        targetLifetime = 1.6;
        break;
      case 'hard':
        spawnInterval = 0.75;
        targetLifetime = 1.0;
        break;
      default:
        spawnInterval = 1.0;
        targetLifetime = 1.3;
    }
  }

  function gameTick(dt) {
    if (!shell || shell.state !== 'playing') return;

    spawnTimer += dt;
    const t = shell.elapsed / shell.duration;
    const dynamicInterval = Math.max(spawnInterval * (1.0 - 0.4 * t), 0.35);

    if (spawnTimer >= dynamicInterval) {
      spawnTimer = 0;
      spawnTarget();
    }

    const now = performance.now();
    targets.forEach((el) => {
      if ((now - Number(el.dataset.createdAt)) / 1000 >= targetLifetime) {
        removeTarget(el, false);
      }
    });
  }

  function onStartGame() {
    spawnTimer = 0;
    clearAllTargets();
    applyDifficulty();
    msgEl.textContent = 'รีบต่อยเป้าให้ทัน! ต่อยติดกันหลายครั้ง Combo จะยิ่งแรง 🔥';
  }

  function onEndGame() {
    clearAllTargets();
    msgEl.textContent = 'หมดเวลาแล้ว! ดูผลคะแนนด้านล่าง แล้วมาลองใหม่ 🎯';
  }

  function onResetGame() {
    spawnTimer = 0;
    clearAllTargets();
    msgEl.textContent = 'แตะ ▶ เริ่มเล่น เพื่อเริ่มใหม่';
  }

  function init() {
    if (!window.VRFGameShell) {
      console.error("VRFGameShell missing → ตรวจ path '../../common/game-shell.js'");
      return;
    }

    shell = VRFGameShell.init({
      onStart: () => onStartGame(),
      onTick: (_, dt) => gameTick(dt),
      onEnd: () => onEndGame(),
      onReset: () => onResetGame(),
      onBack: () => (window.location.href = './index.html'),
    });
  }

  window.addEventListener('load', init);
})();
