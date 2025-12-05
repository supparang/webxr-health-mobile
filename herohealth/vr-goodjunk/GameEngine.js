// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Minimal Emoji Target Engine (A-Frame)
// สร้างเป้า emoji 3D ให้คลิกได้ + ส่ง event ให้ HUD

'use strict';

export const GameEngine = (function () {

  // ---- Config พื้นฐาน ----
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  const GOOD_RATE   = 0.65;   // โอกาสออกของดี
  const SPAWN_MS    = 900;    // เวลาห่างระหว่าง spawn
  const FALL_SPEED  = 0.013;  // ความเร็วตกลง (หน่วย = world units / tick)
  const DESPAWN_Y   = 0.2;    // ต่ำกว่านี้ถือว่าหล่นหลุดเฟรม

  let sceneEl        = null;
  let running        = false;
  let spawnTimer     = null;
  let moveTimer      = null;
  let activeTargets  = [];

  let score  = 0;
  let combo  = 0;
  let misses = 0;

  // ---- Helper: ส่ง event ให้ HUD ----
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
        mode:       'Good vs Junk (VR)',
        score,
        comboMax:   combo,   // ใน engine นี้ comboMax = combo สูงสุด ณ จบเกม (simple)
        misses,
        goalsCleared: 0,
        goalsTotal:   0,
        miniCleared:  0,
        miniTotal:    0
      }
    }));
  }

  // ---- สร้างเป้า emoji 3D ----
  function createTargetEntity(emoji, kind) {
    if (!sceneEl) return null;

    const el = document.createElement('a-entity');

    // ซ่อน hitbox ให้ raycaster โดน
    el.setAttribute('geometry', 'primitive: circle; radius: 0.35');
    el.setAttribute('material', 'color: #000; opacity: 0; transparent: true');

    // แปะ emoji เป็น text ด้านหน้า
    el.setAttribute('text', `value: ${emoji}; align: center; color: #ffffff; width: 4`);

    // ตำแหน่งเริ่ม: สูงหน่อย ๆ ด้านหน้า player
    const x = -1.4 + Math.random() * 2.8;   // -1.4 .. +1.4
    const y = 2.0 + Math.random() * 0.8;    // 2.0 .. 2.8
    const z = -3.0 - Math.random() * 0.5;   // -3.0 .. -3.5

    el.setAttribute('position', { x, y, z });

    // ให้ raycaster เล็งได้
    el.setAttribute('data-hha-tgt', '1');
    el.classList.add('gj-target');

    // metadata บอกว่า good/junk อะไร
    el.dataset.kind  = kind;   // 'good' หรือ 'junk'
    el.dataset.emoji = emoji;

    // คลิก = โดนเป้า
    el.addEventListener('click', (ev) => {
      onHit(el);
    });

    sceneEl.appendChild(el);
    return el;
  }

  // ---- เวลาโดนเป้า ----
  function onHit(el) {
    if (!running) return;
    if (!el || !el.parentNode) return;

    const kind = el.dataset.kind || 'junk';

    // ลบออกจาก activeTargets
    activeTargets = activeTargets.filter(t => t.el !== el);
    el.parentNode.removeChild(el);

    if (kind === 'good') {
      const delta = 10 + combo * 2;
      score += delta;
      combo += 1;
    } else {
      // junk
      const delta = -8;
      score = Math.max(0, score + delta);
      combo  = 0;
      misses += 1;
      emitMiss();
    }

    emitScore();
  }

  // ---- เวลาเป้าตกหลุดจอ ----
  function onMissFall(el) {
    if (!running) return;
    if (!el || !el.parentNode) return;

    const kind = el.dataset.kind || 'junk';

    activeTargets = activeTargets.filter(t => t.el !== el);
    el.parentNode.removeChild(el);

    // default: ถ้าของดีหลุด = miss, ถ้าของขยะหลุด = ไม่ถือว่าพลาด (ปล่อยผ่าน)
    if (kind === 'good') {
      misses += 1;
      combo = 0;
      emitMiss();
      emitScore();
    }
  }

  // ---- อัปเดตตำแหน่งเป้าทุกเฟรม ----
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

  // ---- spawn เป้าใหม่สม่ำเสมอ ----
  function tickSpawn() {
    if (!running) return;
    const isGood = Math.random() < GOOD_RATE;
    const pool   = isGood ? GOOD : JUNK;
    const emoji  = pool[(Math.random() * pool.length) | 0];
    const kind   = isGood ? 'good' : 'junk';

    const el = createTargetEntity(emoji, kind);
    if (el) {
      activeTargets.push({ el });
    }
  }

  // ---- Public API ----
  function start(diff) {
    if (running) return;
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[GoodJunkVR] a-scene not found — เป้าจะไม่ถูกสร้าง');
      return;
    }

    running = true;
    score   = 0;
    combo   = 0;
    misses  = 0;
    activeTargets = [];

    emitScore();

    // เริ่ม spawn + move loop
    tickSpawn(); // spawn ทันทีลูกแรก
    spawnTimer = setInterval(tickSpawn, SPAWN_MS);
    moveTimer  = setInterval(tickMove, 16); // ~60 FPS

    console.log('[GoodJunkVR] GameEngine started, diff =', diff);
  }

  function stop() {
    if (!running) return;
    running = false;

    if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
    if (moveTimer)  { clearInterval(moveTimer);  moveTimer  = null; }

    // ลบเป้าทิ้งหมด
    activeTargets.forEach(t => {
      if (t.el && t.el.parentNode) {
        t.el.parentNode.removeChild(t.el);
      }
    });
    activeTargets = [];

    emitEnd();
    console.log('[GoodJunkVR] GameEngine stopped');
  }

  return { start, stop };
})();