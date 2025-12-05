// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Float Engine (เป้าเป็น emoji ลอย)
// มี event hha:coach

'use strict';

export const GameEngine = (function () {

  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  const GOOD_RATE  = 0.65;
  const SPAWN_MS   = 1000;
  const FALL_SPEED = 0.012;
  const DESPAWN_Y  = 0.3;

  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let moveTimer  = null;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  function emit(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function coach(text) {
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

  // --- เป้าเป็น emoji ---
  function createTargetEntity(emoji, kind) {
    if (!sceneEl) return null;
    const el = document.createElement('a-entity');
    el.setAttribute('text', {
      value: emoji,
      align: 'center',
      width: 6,
      color: '#fff'
    });

    // สุ่มตำแหน่ง
    const x = -1.4 + Math.random() * 2.8;
    const y = 2.0 + Math.random() * 0.8;
    const z = -3;
    el.setAttribute('position', { x, y, z });
    el.setAttribute('scale', { x: 1.2, y: 1.2, z: 1.2 });
    el.setAttribute('data-hha-tgt', '1');
    el.classList.add('gj-target');
    el.dataset.kind = kind;
    el.dataset.emoji = emoji;

    el.addEventListener('click', () => onHit(el));
    sceneEl.appendChild(el);
    return el;
  }

  function onHit(el) {
    if (!running || !el) return;
    const kind = el.dataset.kind || 'junk';
    activeTargets = activeTargets.filter(t => t.el !== el);
    el.parentNode?.removeChild(el);

    if (kind === 'good') {
      score += 10 + combo * 2;
      combo++;
      comboMax = Math.max(comboMax, combo);
      if (combo === 1) coach('เริ่มต้นได้ดีมาก! 🥦');
      if (combo % 5 === 0) coach('คอมโบแรงสุด ๆ x' + combo + ' 🔥');
    } else {
      score = Math.max(0, score - 8);
      combo = 0;
      misses++;
      coach('ระวังของขยะ! 🍔');
      emitMiss();
    }
    emitScore();
  }

  function onMissFall(el) {
    if (!running || !el) return;
    const kind = el.dataset.kind || 'junk';
    activeTargets = activeTargets.filter(t => t.el !== el);
    el.parentNode?.removeChild(el);

    if (kind === 'good') {
      misses++;
      combo = 0;
      coach('พลาดของดีไปนะ 😅');
      emitMiss();
      emitScore();
    }
  }

  function tickMove() {
    if (!running) return;
    for (let i = activeTargets.length - 1; i >= 0; i--) {
      const t = activeTargets[i];
      const el = t.el;
      if (!el) continue;
      const pos = el.getAttribute('position');
      pos.y -= FALL_SPEED;
      el.setAttribute('position', pos);
      if (pos.y < DESPAWN_Y) onMissFall(el);
    }
  }

  function tickSpawn() {
    if (!running) return;
    const isGood = Math.random() < GOOD_RATE;
    const pool = isGood ? GOOD : JUNK;
    const emoji = pool[Math.floor(Math.random() * pool.length)];
    const kind = isGood ? 'good' : 'junk';
    const el = createTargetEntity(emoji, kind);
    if (el) activeTargets.push({ el });
  }

  function start(diff) {
    if (running) return;
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return console.error('no scene');

    running = true;
    score = 0; combo = 0; misses = 0; comboMax = 0;
    activeTargets = [];

    emitScore();
    coach('แตะของดี ผัก ผลไม้ นมเท่านั้นนะ 🥕🥛');

    tickSpawn();
    spawnTimer = setInterval(tickSpawn, SPAWN_MS);
    moveTimer = setInterval(tickMove, 16);
  }

  function stop() {
    if (!running) return;
    running = false;
    clearInterval(spawnTimer);
    clearInterval(moveTimer);
    activeTargets.forEach(t => t.el?.parentNode?.removeChild(t.el));
    activeTargets = [];
    coach('จบเกมแล้ว! ดูผลสรุปด้านบนได้เลย 🎉');
    emitEnd();
  }

  return { start, stop };
})();