// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (Production-ready 2025-12-05)

(function (ns) {
  'use strict';

  const DROP_Y_START = 3.2;
  const DROP_Y_END   = 0.4;
  const DROP_SPEED   = 0.65;      // ปรับให้เหมาะสมกับมือถือ Samsung A15
  const MAX_ACTIVE   = 4;

  let scene;
  let root;
  let activeTargets = [];
  let running = false;
  let score = 0;
  let diff = 'normal';

  // Modules
  const emoji = ns.foodGroupsEmoji;
  const quest = ns.foodGroupsQuest;
  const ui    = ns.foodGroupsUI;
  const fx    = ns.foodGroupsFX;
  const logger = ns.foodGroupsCloudLogger;

  // ------------------------------------------------
  // Start
  // ------------------------------------------------
  function start(difficulty = 'normal') {
    diff = difficulty;
    running = true;
    score = 0;
    activeTargets = [];

    scene = document.querySelector('a-scene');
    root = document.querySelector('#fg-root');

    // เคาะค่าหน่วงตามระดับเกม
    let spawnInterval = diff === 'easy'   ? 1200 :
                        diff === 'normal' ? 900 :
                                            750;

    // เริ่มระบบภารกิจ
    quest.start(diff);

    // เริ่มแสดงคะแนน
    ui.setScore(0);

    // เริ่มส่ง event coach
    window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text:'เริ่มภารกิจ! เลือกอาหารให้ถูกกลุ่มนะ!'} }));

    // วน spawn สุ่ม emoji
    spawnLoop(spawnInterval);

    logger.beginSession({
      diff,
      deviceType: navigator.userAgent,
      gameDuration: 60,
    });
  }

  // ------------------------------------------------
  // Spawn สุ่ม emoji ตกลงมา
  // ------------------------------------------------
  function spawnLoop(interval) {
    if (!running) return;

    if (activeTargets.length < MAX_ACTIVE) {
      spawnOne();
    }
    setTimeout(() => spawnLoop(interval), interval);
  }

  // ------------------------------------------------
  // สร้างเป้า emoji
  // ------------------------------------------------
  function spawnOne() {
    const set = emoji.pickRandom();
    const id = 'tgt_' + Math.random().toString(36).substr(2, 6);

    const el = document.createElement('a-entity');
    el.setAttribute('id', id);

    // geometry: plane + emoji texture
    el.setAttribute('geometry', {
      primitive: 'plane',
      height: 0.55,
      width:  0.55
    });

    el.setAttribute('material', {
      shader: 'flat',
      src: set.url,
      transparent: true
    });

    // ตำแหน่ง x แบบสุ่ม
    const px = (Math.random() * 2 - 1.1) * 1.4;
    el.object3D.position.set(px, DROP_Y_START, -3);

    // ทำให้ยิงได้
    el.setAttribute('data-hha-tgt', '1');
    el.dataset.emoji = set.emoji;
    el.dataset.group = set.group;

    // Event ยิงเป้า
    el.addEventListener('click', () => onHit(el));

    root.appendChild(el);
    activeTargets.push(el);

    animateDrop(el);
  }

  // ------------------------------------------------
  // การตกลงมาแบบ animation
  // ------------------------------------------------
  function animateDrop(el) {
    const dt = 16; 
    function tick() {
      if (!running || !el.parentNode) return;

      el.object3D.position.y -= DROP_SPEED * (dt / 1000);

      if (el.object3D.position.y <= DROP_Y_END) {
        onMiss(el);
        return;
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  // ------------------------------------------------
  // ยิงโดนเป้า
  // ------------------------------------------------
  function onHit(el) {
    if (!running) return;

    const emoji = el.dataset.emoji;
    const group = el.dataset.group;

    fx.pop(el);
    removeTarget(el);

    score += 10;
    ui.setScore(score);

    logger.logEvent({
      emoji,
      groupId: group,
      hitOrMiss: 'hit',
      scoreDelta: 10
    });

    // เพิ่ม progress ภารกิจ
    quest.addProgress('goal', 1);
    quest.addProgress('mini', 1);

    // โค้ชพิเศษในบางจังหวะ
    if (Math.random() < 0.2) {
      window.dispatchEvent(new CustomEvent('hha:coach', {
        detail:{ text: 'ดีมาก! เลือกได้ถูกต้องเลย ⭐' }
      }));
    }
  }

  // ------------------------------------------------
  // ตกพื้น = miss
  // ------------------------------------------------
  function onMiss(el) {
    removeTarget(el);

    logger.logEvent({
      emoji: el.dataset.emoji,
      groupId: el.dataset.group,
      hitOrMiss: 'miss',
      scoreDelta: 0
    });

    window.dispatchEvent(new CustomEvent('hha:coach', {
      detail:{ text: 'พลาดไป! ลองใหม่อีกครั้งนะ!' }
    }));
  }

  // ------------------------------------------------
  // ลบเป้าจากเกม
  // ------------------------------------------------
  function removeTarget(el) {
    const i = activeTargets.indexOf(el);
    if (i >= 0) activeTargets.splice(i, 1);
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  // ------------------------------------------------
  // หยุดเกม
  // ------------------------------------------------
  function stop() {
    if (!running) return;

    running = false;

    // ล้างเป้าค้าง
    activeTargets.forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    activeTargets = [];

    // ส่ง event summary
    quest.finish();

    logger.endSession({ score });

    window.dispatchEvent(new CustomEvent('fg-game-over',{
      detail:{ score }
    }));
  }

  ns.foodGroupsGame = { start, stop };

  // A-Frame component
  AFRAME.registerComponent('food-groups-game', {
    init() {
      this.el.addEventListener('fg-start', e => {
        const diff = (e.detail?.diff) || 'normal';
        start(diff);
      });
    }
  });

})(window.GAME_MODULES || (window.GAME_MODULES = {}));