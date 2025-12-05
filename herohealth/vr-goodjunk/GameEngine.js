// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Circle Targets + Coach events

'use strict';

export const GameEngine = (function () {
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
               '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  const GOOD_RATE  = 0.65;     // โอกาสเป็นของดี
  const SPAWN_MS   = 950;      // ความถี่การเกิดเป้า (ms)
  const FALL_SPEED = 0.012;    // ความเร็วตก
  const DESPAWN_Y  = 0.15;     // ต่ำกว่านี้ถือว่าหลุดจอ

  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let moveTimer  = null;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  // ---------- helper: emit event ----------
  function emit(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function coach(text) {
    if (!text) return;
    emit('hha:coach', { text });
  }

  function emitScore() {
    emit('hha:score', { score, combo, misses });
  }

  function emitMiss() {
    emit('hha:miss', { misses });
  }

  function emitEnd() {
    emit('hha:end', {
      mode: 'Good vs Junk (VR)',
      score,
      comboMax,
      misses,
      goalsCleared: 0,
      goalsTotal: 0,
      miniCleared: 0,
      miniTotal: 0
    });
  }

  // ---------- สร้างเป้า (วงกลม + emoji) ----------
  function createTargetEntity(emoji, kind) {
    if (!sceneEl) return null;

    const root = document.createElement('a-entity');

    // สุ่มตำแหน่ง X / Y
    const x = -1.0 + Math.random() * 2.0;  // -1 ถึง +1
    const y = 2.1 + Math.random() * 0.6;   // สูงเหนือศีรษะนิดหน่อย
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1.0, y: 1.0, z: 1.0 });
    root.setAttribute('data-hha-tgt', '1');
    root.classList.add('gj-target');
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;

    // วงกลมสีให้เห็นชัด
    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', kind === 'good' ? 0.32 : 0.28);
    circle.setAttribute('material', {
      color: kind === 'good' ? '#22c55e' : '#f97316',
      opacity: 0.95,
      metalness: 0,
      roughness: 1
    });

    // emoji อยู่ด้านหน้า
    const txt = document.createElement('a-entity');
    txt.setAttribute('text', {
      value: emoji,
      align: 'center',
      width: 4,
      color: '#111827'
    });
    txt.setAttribute('position', { x: 0, y: 0, z: 0.01 });

    root.appendChild(circle);
    root.appendChild(txt);

    // คลิกโดนเป้า
    root.addEventListener('click', () => onHit(root));

    sceneEl.appendChild(root);
    return root;
  }

  // ---------- โดนเป้า ----------
  function onHit(el) {
    if (!running || !el) return;

    const kind = el.dataset.kind || 'junk';

    activeTargets = activeTargets.filter(t => t !== el);
    el.parentNode && el.parentNode.removeChild(el);

    if (kind === 'good') {
      score += 10 + combo * 2;
      combo++;
      comboMax = Math.max(comboMax, combo);

      if (combo === 1)       coach('เปิดคอมโบแล้ว! เลือกผัก ผลไม้ นมต่อเลย 🥦🥛');
      else if (combo === 5) coach('คอมโบ x5 แล้ว เยี่ยมมาก! 🔥');
      else if (combo === 10)coach('สุดยอด! โปรโหมดแล้ว x10 💪');

    } else { // junk
      score = Math.max(0, score - 8);
      combo = 0;
      misses++;
      coach('โดนของขยะแล้ว ระวังพวก 🍔🍩 อีกนะ');
      emitMiss();
    }

    emitScore();
  }

  // ---------- เป้าตกหลุดจอ ----------
  function onMissFall(el) {
    if (!running || !el) return;

    const kind = el.dataset.kind || 'junk';

    activeTargets = activeTargets.filter(t => t !== el);
    el.parentNode && el.parentNode.removeChild(el);

    if (kind === 'good') {
      misses++;
      combo = 0;
      coach('พลาดของดีไปนะ ลองเล็งให้ตรงเป้ามากขึ้น 😊');
      emitMiss();
      emitScore();
    }
    // ถ้าเป็น junk หลุดจอเฉย ๆ ไม่ถือว่าพลาด
  }

  // ---------- อัปเดตตำแหน่งทุกเฟรม ----------
  function tickMove() {
    if (!running) return;
    for (let i = activeTargets.length - 1; i >= 0; i--) {
      const el = activeTargets[i];
      if (!el) continue;
      const pos = el.getAttribute('position');
      pos.y -= FALL_SPEED;
      el.setAttribute('position', pos);
      if (pos.y < DESPAWN_Y) {
        onMissFall(el);
      }
    }
  }

  // ---------- สุ่ม spawn เป้าใหม่ ----------
  function tickSpawn() {
    if (!running) return;
    const isGood = Math.random() < GOOD_RATE;
    const pool = isGood ? GOOD : JUNK;
    const emoji = pool[Math.floor(Math.random() * pool.length)];
    const kind = isGood ? 'good' : 'junk';
    const el = createTargetEntity(emoji, kind);
    if (el) activeTargets.push(el);
  }

  // ---------- start / stop ----------
  function _startCore(diff) {
    running = true;
    score = 0;
    combo = 0;
    misses = 0;
    comboMax = 0;

    // ล้างเป้าเก่า
    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    emitScore();
    coach('แตะเฉพาะอาหารดี เช่น ผัก ผลไม้ นม เลี่ยงของขยะนะ 🥦🍎🥛');

    tickSpawn(); // spawn ทันที 1 ลูก
    spawnTimer = setInterval(tickSpawn, SPAWN_MS);
    moveTimer  = setInterval(tickMove, 16);
  }

  function start(diff) {
    if (running) return;
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[GoodJunkVR] ไม่พบ <a-scene>');
      return;
    }
    // รอให้ A-Frame โหลดก่อน
    if (sceneEl.hasLoaded) {
      _startCore(diff);
    } else {
      sceneEl.addEventListener('loaded', () => _startCore(diff), { once: true });
    }
  }

  function stop() {
    if (!running) return;
    running = false;

    clearInterval(spawnTimer);
    clearInterval(moveTimer);

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    coach('จบเกมแล้ว! ดูสรุปคะแนนด้านบนได้เลย 🎉');
    emitEnd();
  }

  return { start, stop };
})();