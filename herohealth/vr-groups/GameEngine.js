// === vr-groups/GameEngine.js (2025-12-03 Production Ready) ===
// Food Groups VR – ระบบยิงเป้า emoji, Quest, Coach, FX, Logging

(function (ns) {
  'use strict';

  const emojiDB = ns.foodGroupsEmoji;
  const UI      = ns.foodGroupsUI;
  const FX      = ns.foodGroupsFX;
  const Coach   = ns.foodGroupsCoach;
  const Logger  = ns.foodGroupsCloudLogger;
  const { QuestManager } = ns.foodGroupsQuest;

  let scene;
  let root;
  let activeTargets = [];
  let running = false;
  let score = 0;

  let quest;
  let diff = 'normal';

  // spawn speed ตามระดับความยาก
  const DIFF_TABLE = {
    easy:   { spawnInterval: 1200, speed: 0.005 },
    normal: { spawnInterval: 900,  speed: 0.0065 },
    hard:   { spawnInterval: 700,  speed: 0.008 }
  };

  // ------------------------------------------------------------
  // สร้างเป้า emoji
  // ------------------------------------------------------------
  function createTarget(emojiItem) {
    const id = 'tgt-' + Math.random().toString(36).substr(2, 8);

    const el = document.createElement('a-entity');
    el.setAttribute('id', id);
    el.setAttribute('data-hha-tgt', '1');
    el.setAttribute('position', randPos());

    // emoji → 3D billboard texture
    el.setAttribute('text', {
      value: emojiItem.emoji,
      align: 'center',
      width: 2.2,
      color: '#FFF'
    });

    el.dataset.group = emojiGroup(emojiItem.group);
    el.dataset.emoji = emojiItem.emoji;
    el.dataset.good  = emojiItem.isGood ? '1' : '0';

    root.appendChild(el);

    return {
      id,
      el,
      group: el.dataset.group,
      emoji: emojiItem.emoji,
      good: emojiItem.isGood,
      y: 1.6,
      speed: DIFF_TABLE[diff].speed
    };
  }

  function emojiGroup(groupId) {
    const map = {
      1: 'grain',
      2: 'veg',
      3: 'fruit',
      4: 'protein',
      5: 'dairy',
      9: 'junk'
    };
    return map[groupId] || 'unknown';
  }

  function randPos() {
    const x = (Math.random() * 6 - 3).toFixed(2);
    const z = (Math.random() * -4 - 2).toFixed(2);
    return `${x} 1.6 ${z}`;
  }

  // ------------------------------------------------------------
  // ยิงโดน
  // ------------------------------------------------------------
  function onHit(tgt, hitPos) {
    score += tgt.good ? 10 : -5;

    UI.setScore(score);
    FX.burst(hitPos, tgt.emoji, tgt.good);
    Coach.sayHit(tgt.good);

    // อัปเดต progress quest
    quest.onHit(tgt.group);

    Logger.sendHit({
      groupId: tgt.group,
      emoji: tgt.emoji,
      isGood: tgt.good,
      pos: hitPos
    });
  }

  // ------------------------------------------------------------
  // พลาด (ยิงไม่โดน)
  // ------------------------------------------------------------
  function onMiss() {
    Coach.sayMiss();
    Logger.sendMiss();
  }

  // ------------------------------------------------------------
  // อัปเดตตำแหน่งเป้า
  // ------------------------------------------------------------
  function updateTargets(dt) {
    const out = [];

    for (const tgt of activeTargets) {
      tgt.y -= tgt.speed * dt;
      tgt.el.setAttribute('position', `0 ${tgt.y} -3`);

      if (tgt.y < 0.3) {
        tgt.el.remove();
      } else {
        out.push(tgt);
      }
    }
    activeTargets = out;
  }

  // ------------------------------------------------------------
  // Loop
  // ------------------------------------------------------------
  let last = 0;
  function tick(t) {
    if (!running) return;
    if (!last) last = t;
    const dt = t - last;
    last = t;

    updateTargets(dt);

    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------
  // spawn เป้าใหม่
  // ------------------------------------------------------------
  function spawnLoop() {
    if (!running) return;

    const item = emojiDB.pickRandomGroup();
    const tgt = createTarget(item);
    activeTargets.push(tgt);

    setTimeout(spawnLoop, DIFF_TABLE[diff].spawnInterval);
  }

  // ------------------------------------------------------------
  // เริ่มเกม
  // ------------------------------------------------------------
  function start(d='normal') {
    diff = d;
    running = true;
    score = 0;
    UI.setScore(0);

    quest = new QuestManager(diff);
    quest.start();

    Logger.startSession(diff);

    spawnLoop();
    tick(0);
  }

  // ------------------------------------------------------------
  // หยุดเกม
  // ------------------------------------------------------------
  function stop() {
    running = false;

    activeTargets.forEach(t => t.el.remove());
    activeTargets = [];

    Logger.endSession({ score, questsCleared: quest.currentGoal });

    UI.showEnd(score, quest.currentGoal, quest.goals.length);
  }

  // ------------------------------------------------------------
  // A-Frame component
  // ------------------------------------------------------------
  AFRAME.registerComponent('food-groups-game', {
    init() {
      scene = this.el.sceneEl;
      root  = this.el;

      // คลิกยิงเป้า
      scene.addEventListener('click', e => {
        const ray = scene.components.raycaster || null;
        if (!ray || !ray.intersections || ray.intersections.length === 0) {
          onMiss();
          return;
        }

        const obj = ray.intersections[0].object.el;
        if (!obj || !obj.dataset || !obj.dataset.hhaTgt) {
          onMiss();
          return;
        }

        const tgt = activeTargets.find(t => t.el === obj);
        if (!tgt) return;

        const pos = ray.intersections[0].point || { x:0,y:0,z:0 };
        onHit(tgt, pos);

        obj.remove();
        activeTargets = activeTargets.filter(t => t.el !== obj);
      });

      // เริ่มเกมเมื่อ engine พร้อม
      scene.addEventListener('fg-start', e => {
        start(e.detail?.diff || 'normal');
      });
    }
  });

  ns.FoodGroupsEngine = { start, stop };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));