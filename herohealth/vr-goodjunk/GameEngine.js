// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Pop Targets (no falling) + Coach events (2025-12-05)

'use strict';

export const GameEngine = (function () {
  // ---------- emoji ชุดอาหาร ----------
  const GOOD = [
    '🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
    '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'
  ];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  const GOOD_RATE       = 0.65;   // โอกาสเป็นของดี
  const SPAWN_INTERVAL  = 900;    // ms ความถี่เกิดเป้า
  const TARGET_LIFETIME = 900;    // ms อยู่บนจอแป๊บเดียวแล้วหาย
  const MAX_ACTIVE      = 4;      // เป้าพร้อมกันสูงสุด

  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  // ---------- emoji → texture cache ----------
  const emojiTexCache = new Map();

  function getEmojiTexture(ch) {
    if (emojiTexCache.has(ch)) return emojiTexCache.get(ch);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 256, 256);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font =
      '200px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
    ctx.fillText(ch, 128, 140);

    const url = canvas.toDataURL('image/png');
    emojiTexCache.set(ch, url);
    return url;
  }

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

  // ---------- ลบเป้า ----------
  function removeTarget(el) {
    activeTargets = activeTargets.filter(t => t !== el);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  // ---------- สร้างเป้า (emoji โผล่มาเฉย ๆ) ----------
  function createTargetEntity(emoji, kind) {
    if (!sceneEl) return null;

    const root = document.createElement('a-entity');

    // สุ่มตำแหน่งรอบ ๆ กลางจอ
    const x = -0.9 + Math.random() * 1.8;   // -0.9 ถึง +0.9
    const y = 0.9 + Math.random() * 0.7;    // 0.9–1.6 (ระดับสายตา)
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.setAttribute('data-hha-tgt', '1');
    root.classList.add('gj-target');
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;

    // วงกลมพื้นหลังบาง ๆ
    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', kind === 'good' ? 0.45 : 0.4);
    circle.setAttribute('material', {
      color: kind === 'good' ? '#22c55e' : '#f97316',
      opacity: 0.35,
      metalness: 0,
      roughness: 1
    });

    // emoji เป็น sprite ทับด้านหน้า
    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', 0.8);
    sprite.setAttribute('height', 0.8);
    sprite.setAttribute('position', { x: 0, y: 0, z: 0.01 });
    sprite.setAttribute('material', {
      src: getEmojiTexture(emoji),
      transparent: true,
      alphaTest: 0.01
    });

    root.appendChild(circle);
    root.appendChild(sprite);

    // ยิงโดนเป้า
    root.addEventListener('click', () => onHit(root));

    sceneEl.appendChild(root);

    // ตั้งเวลาให้เป้าหายไปเอง (ถือว่าพลาดถ้าเป็นของดี)
    setTimeout(() => {
      if (!running) return;
      if (!root.parentNode) return; // โดนยิงไปแล้ว
      onExpire(root);
    }, TARGET_LIFETIME);

    return root;
  }

  // ---------- ยิงโดน ----------
  function onHit(el) {
    if (!running || !el) return;
    if (!el.parentNode) return; // กันยิงซ้ำ

    const kind = el.dataset.kind || 'junk';
    removeTarget(el);

    if (kind === 'good') {
      score += 10 + combo * 2;
      combo++;
      comboMax = Math.max(comboMax, combo);

      if (combo === 1)
        coach('เปิดคอมโบแล้ว! เลือกผัก ผลไม้ นมต่อเลย 🥦🍎🥛');
      else if (combo === 5)
        coach('คอมโบ x5 แล้ว เยี่ยมมาก! 🔥');
      else if (combo === 10)
        coach('สุดยอด! โปรโหมดแล้ว x10 เลย! 💪');
    } else {
      score = Math.max(0, score - 8);
      combo = 0;
      misses++;
      coach('โดนของขยะแล้ว ระวังพวก 🍔🍩 อีกนะ');
      emitMiss();
    }

    emitScore();
  }

  // ---------- เป้าหายเพราะหมดเวลา ----------
  function onExpire(el) {
    if (!running || !el) return;
    if (!el.parentNode) return;

    const kind = el.dataset.kind || 'junk';
    removeTarget(el);

    if (kind === 'good') {
      // พลาดของดี
      misses++;
      combo = 0;
      coach('พลาดของดีไปนะ ลองเล็งให้ตรงเป้ามากขึ้น 😊');
      emitMiss();
      emitScore();
    }
    // ถ้า junk หายไป ไม่ถือว่าพลาด
  }

  // ---------- สุ่ม spawn เป้า ----------
  function tickSpawn() {
    if (!running) return;
    if (activeTargets.length >= MAX_ACTIVE) return;

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
    comboMax = 0;
    misses = 0;

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    emitScore();
    coach('แตะเฉพาะอาหารดี เช่น ผัก ผลไม้ นม เลี่ยงของขยะนะ 🥦🍎🥛');

    // spawn ทันที 1 ลูก แล้วค่อย spawn ต่อเนื่อง
    tickSpawn();
    spawnTimer = setInterval(tickSpawn, SPAWN_INTERVAL);
  }

  function start(diff) {
    if (running) return;
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[GoodJunkVR] ไม่พบ <a-scene>');
      return;
    }
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

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    coach('จบเกมแล้ว! ดูสรุปคะแนนด้านบนได้เลย 🎉');
    emitEnd();
  }

  return { start, stop };
})();