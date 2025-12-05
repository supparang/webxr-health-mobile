// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Target Engine (ชัด ๆ)
// สร้างเป้าเป็นแผ่นการ์ด + emoji 3D ให้เล็งแล้วคลิกได้

'use strict';

export const GameEngine = (function () {

  // ----- กำหนดชุด emoji -----
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  const GOOD_RATE   = 0.65;   // โอกาสของดี
  const SPAWN_MS    = 900;    // ช่วงห่างการ spawn
  const FALL_SPEED  = 0.015;  // ความเร็วตก
  const DESPAWN_Y   = 0.2;    // ต่ำกว่านี้ถือว่าหลุดเฟรม

  let sceneEl        = null;
  let running        = false;
  let spawnTimer     = null;
  let moveTimer      = null;
  let activeTargets  = [];

  let score    = 0;
  let combo    = 0;
  let comboMax = 0;
  let misses   = 0;

  // ----- helper ยิง event ให้ HUD -----
  function emitScore() {
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: { score, combo, misses }
    }));
  }

  function emitMiss() {
    window.dispatchEvent(new CustomEvent('hha:miss', {
      detail: { misses }
    }));
  }

  function emitEnd() {
    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        mode:         'Good vs Junk (VR)',
        score,
        comboMax,
        misses,
        goalsCleared: 0,
        goalsTotal:   0,
        miniCleared:  0,
        miniTotal:    0
      }
    }));
  }

  // ----- สร้างเป้าเป็น “การ์ด + emoji” -----
  function createTargetEntity(emoji, kind) {
    if (!sceneEl) return null;

    // parent entity
    const root = document.createElement('a-entity');

    // random ตำแหน่งข้างหน้า player
    const x = -1.2 + Math.random() * 2.4;   // -1.2 .. 1.2
    const y = 2.0 + Math.random() * 0.7;    // 2.0 .. 2.7
    const z = -2.4 - Math.random() * 0.6;   // -2.4 .. -3.0

    root.setAttribute('position', { x, y, z });
    root.dataset.kind  = kind;    // good / junk
    root.dataset.emoji = emoji;

    // แผ่นการ์ดพื้นหลัง (ให้ raycaster โดนง่าย ๆ)
    const card = document.createElement('a-plane');
    card.setAttribute('width', 0.8);
    card.setAttribute('height', 0.8);
    card.setAttribute('material',
      'color: #020617; opacity: 0.92; metalness: 0; roughness: 1');
    card.setAttribute('data-hha-tgt', '1');   // raycaster จะยิง element นี้
    card.classList.add('gj-target');

    // emoji text อยู่ด้านหน้าเล็กน้อย
    const txt = document.createElement('a-entity');
    txt.setAttribute('text', {
      value: emoji,
      align: 'center',
      width: 4,
      color: '#ffffff'
    });
    txt.setAttribute('position', { x: 0, y: 0, z: 0.01 });

    // คลิกการ์ด = โดนเป้า
    card.addEventListener('click', () => {
      onHit(root);
    });

    root.appendChild(card);
    root.appendChild(txt);
    sceneEl.appendChild(root);
    return root;
  }

  // ----- โดนเป้า -----
  function onHit(root) {
    if (!running) return;
    if (!root || !root.parentNode) return;

    const kind = root.dataset.kind || 'junk';

    activeTargets = activeTargets.filter(t => t.el !== root);
    root.parentNode.removeChild(root);

    if (kind === 'good') {
      const delta = 10 + combo * 2;
      score += delta;
      combo += 1;
      comboMax = Math.max(comboMax, combo);
    } else {
      const delta = -8;
      score  = Math.max(0, score + delta);
      combo  = 0;
      misses += 1;
      emitMiss();
    }
    emitScore();
  }

  // ----- หลุดเฟรมด้านล่าง -----
  function onMissFall(root) {
    if (!running) return;
    if (!root || !root.parentNode) return;

    const kind = root.dataset.kind || 'junk';

    activeTargets = activeTargets.filter(t => t.el !== root);
    root.parentNode.removeChild(root);

    // ถ้าของดีหลุด = miss, ของขยะหลุด = ปล่อยผ่าน
    if (kind === 'good') {
      misses += 1;
      combo = 0;
      emitMiss();
      emitScore();
    }
  }

  // ----- ขยับเป้าลงทุกเฟรม -----
  function tickMove() {
    if (!running) return;
    for (let i = activeTargets.length - 1; i >= 0; i--) {
      const t   = activeTargets[i];
      const el  = t.el;
      if (!el || !el.parentNode) {
        activeTargets.splice(i, 1);
        continue;
      }
      const pos = el.getAttribute('position');
      if (!pos) continue;
      pos.y -= FALL_SPEED;
      el.setAttribute('position', pos);

      if (pos.y <= DESPAWN_Y) {
        onMissFall(el);
      }
    }
  }

  // ----- สร้างเป้าใหม่เรื่อย ๆ -----
  function tickSpawn() {
    if (!running) return;
    const isGood = Math.random() < GOOD_RATE;
    const pool   = isGood ? GOOD : JUNK;
    const emoji  = pool[(Math.random() * pool.length) | 0];
    const kind   = isGood ? 'good' : 'junk';

    const el = createTargetEntity(emoji, kind);
    if (el) activeTargets.push({ el });
  }

  // ----- public API -----
  function start(diff) {
    if (running) return;
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[GoodJunkVR] a-scene not found');
      return;
    }

    running = true;
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    activeTargets = [];

    emitScore();

    // เริ่มเกม: spawn + move
    tickSpawn(); // ลูกแรกทันที
    spawnTimer = setInterval(tickSpawn, SPAWN_MS);
    moveTimer  = setInterval(tickMove, 16); // ~60 FPS

    console.log('[GoodJunkVR] GameEngine started, diff =', diff);
  }

  function stop() {
    if (!running) return;
    running = false;

    if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
    if (moveTimer)  { clearInterval(moveTimer);  moveTimer  = null; }

    activeTargets.forEach(t => {
      if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
    });
    activeTargets = [];

    emitEnd();
    console.log('[GoodJunkVR] GameEngine stopped');
  }

  return { start, stop };
})();