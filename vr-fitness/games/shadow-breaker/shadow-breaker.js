// === Shadow Breaker — DOM target prototype (ใช้ร่วมกับ VRFGameShell) ===
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  const stage = $('#sb-stage');
  const msgEl = $('#sb-message');

  let shell = null;
  let spawnTimer = 0;
  let spawnInterval = 1.0;     // จะปรับตาม diff
  let targetLifetime = 1.2;    // วินาที ก่อนถือว่าพลาด
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
    } else {
      VRFGameShell.addMiss();
    }
  }

  function spawnTarget() {
    if (!stage || !shell) return;

    const rect = stage.getBoundingClientRect();
    // ไม่ให้ชิดขอบเกินไป
    const x = rand(rect.width * 0.15, rect.width * 0.85);
    const y = rand(rect.height * 0.2, rect.height * 0.8);

    const el = document.createElement('div');
    el.className = 'sb-target sb-pop' + (shell.difficulty === 'hard' ? ' sb-target-hard' : '');
    el.textContent = pick(EMOJIS);
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    const createdAt = performance.now();
    el.dataset.createdAt = String(createdAt);

    el.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (!shell || shell.state !== 'playing') return;
      removeTarget(el, true);
    }, { passive: false });

    stage.appendChild(el);
    targets.add(el);
  }

  function clearAllTargets() {
    targets.forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    targets.clear();
  }

  // จูนตามระดับความยาก
  function applyDifficulty() {
    if (!shell) return;
    const diff = shell.difficulty || 'normal';

    if (diff === 'easy') {
      spawnInterval = 1.3;
      targetLifetime = 1.6;
    } else if (diff === 'hard') {
      spawnInterval = 0.75;
      targetLifetime = 1.0;
    } else {
      spawnInterval = 1.0;
      targetLifetime = 1.3;
    }
  }

  // เรียกจาก shell.onTick(dt)
  function gameTick(dt) {
    if (!shell || shell.state !== 'playing') return;

    spawnTimer += dt;
    const t = shell.elapsed / shell.duration;        // 0 → 1
    const dynamicInterval = Math.max(spawnInterval * (1.0 - 0.4 * t), 0.4);

    if (spawnTimer >= dynamicInterval) {
      spawnTimer = 0;
      spawnTarget();
    }

    // เช็กเป้าที่หมดอายุ
    const now = performance.now();
    targets.forEach((el) => {
      const createdAt = Number(el.dataset.createdAt || now);
      const age = (now - createdAt) / 1000;
      if (age >= targetLifetime) {
        removeTarget(el, false);
      }
    });
  }

  function onStartGame() {
    if (msgEl) {
      msgEl.textContent = 'รีบต่อยเป้าให้ทัน! ยิ่งต่อยติดกันหลายลูก Combo ยิ่งแรง 🔥';
    }
    spawnTimer = 0;
    clearAllTargets();
    applyDifficulty();
  }

  function onEndGame() {
    clearAllTargets();
    if (msgEl) {
      msgEl.textContent = 'หมดเวลาแล้ว! ดูสรุปผลด้านล่าง แล้วลองเล่นใหม่อีกครั้ง 💪';
    }
  }

  function onResetGame() {
    spawnTimer = 0;
    clearAllTargets();
    if (msgEl) {
      msgEl.textContent = 'แตะปุ่ม ▶ เริ่มเล่น เพื่อเริ่มต่อยเป้าอีกครั้ง';
    }
  }

  function init() {
    if (!window.VRFGameShell) {
      console.error('VRFGameShell not found. ตรวจ path: ../../common/game-shell.js');
      return;
    }

    shell = VRFGameShell.init({
      onStart(shellState) {
        shell = shellState;
        onStartGame();
      },
      onTick(shellState, dt) {
        shell = shellState;
        gameTick(dt);
      },
      onEnd(shellState) {
        shell = shellState;
        onEndGame();
      },
      onReset(shellState) {
        shell = shellState;
        onResetGame();
      },
      onBack() {
        window.location.href = './index.html';
      }
    });
  }

  window.addEventListener('load', init);
})();
