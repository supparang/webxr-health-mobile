// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Pop Targets + Difficulty Quest + Fever + Coach
// (2025-12-06 + เป้าอยู่กลางจอ + FX แตก + GOOD/MISS float text)

'use strict';

export const GameEngine = (function () {
  // ---------- Fever UI (shared across modes) ----------
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar() {},
      setFever() {},
      setFeverActive() {},
      setShield() {}
    };

  // ---------- emoji ชุดอาหาร ----------
  const GOOD = [
    '🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
    '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'
  ];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  // ---------- ค่าพื้นฐาน (จะถูก override ตาม diff) ----------
  let GOOD_RATE       = 0.65;
  let SPAWN_INTERVAL  = 900;
  let TARGET_LIFETIME = 900;
  let MAX_ACTIVE      = 4;

  // Fever
  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 18;
  const FEVER_MISS_LOSS = 30;
  const FEVER_DURATION  = 5000;   // ms

  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let goodHit = 0;
  let junkHit = 0;

  // Fever state
  let fever = 0;
  let feverActive = false;
  let feverTimer = null;

  // ---------- Quest state (เวอร์ชันง่าย 1 Goal + 1 Mini) ----------
  const GOAL = {
    label: 'เก็บอาหารดีให้ครบ 25 ชิ้น',
    prog: 0,
    target: 25,
    done: false
  };

  const MINI = {
    label: 'รักษาคอมโบให้ถึง x5 อย่างน้อย 1 ครั้ง',
    prog: 0,      // 0 หรือ 1 (ผ่าน/ไม่ผ่าน)
    target: 1,
    done: false
  };

  // threshold คอมโบที่ใช้สำหรับ Mini (จะสุ่มตาม diff)
  let miniComboNeed = 5;

  // ---------- Emoji → texture cache ----------
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

  // ---------- helpers ----------
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

  function clamp(v, min, max){
    return v < min ? min : (v > max ? max : v);
  }

  function randInt(min, max){
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  // ---------- FX: เป้าแตก + GOOD/MISS เด้งตรงเป้า ----------
  function playHitFx(el, isGood) {
    if (!sceneEl || !el) {
      removeTarget(el);
      return;
    }

    try {
      const circle = el.querySelector('a-circle');
      const sprite = el.querySelector('a-plane');

      // scale & fade วงกลมพื้นหลัง
      if (circle) {
        circle.setAttribute(
          'animation__scale',
          'property: scale; to: 1.4 1.4 1; dur: 120; easing: ease-out'
        );
        circle.setAttribute(
          'animation__fade',
          'property: material.opacity; to: 0; dur: 200; delay: 80; easing: linear'
        );
      }

      // emoji เด้งเล็กน้อยแล้วค่อยเฟด
      if (sprite) {
        sprite.setAttribute(
          'animation__pop',
          'property: scale; to: 1.2 1.2 1; dur: 80; dir: alternate; easing: ease-out'
        );
        sprite.setAttribute(
          'animation__fade',
          'property: material.opacity; to: 0; dur: 200; delay: 80; easing: linear'
        );
      }

      // ตัวหนังสือ GOOD / MISS ลอยขึ้น
      const pos = el.getAttribute('position') || { x: 0, y: 1.8, z: -3 };
      const label = isGood ? 'GOOD' : 'MISS';
      const color = isGood ? '#bbf7d0' : '#fecaca';

      const fx = document.createElement('a-entity');
      fx.setAttribute('position', { x: pos.x, y: pos.y + 0.3, z: pos.z });
      fx.setAttribute('text', {
        value: label,
        align: 'center',
        width: 3,
        color
      });
      fx.setAttribute(
        'animation__move',
        `property: position; to: ${pos.x} ${pos.y + 0.9} ${pos.z}; dur: 450; easing: ease-out`
      );
      fx.setAttribute(
        'animation__fade',
        'property: text.opacity; to: 0; dur: 450; easing: linear'
      );
      sceneEl.appendChild(fx);
      setTimeout(() => {
        if (fx.parentNode) fx.parentNode.removeChild(fx);
      }, 520);

      // รอให้แอนิเมชันจบก่อนค่อยลบเป้า
      setTimeout(() => removeTarget(el), 240);
    } catch (e) {
      removeTarget(el);
    }
  }

  // ---------- Fever (ใช้ร่วม FeverUI + ยิง event เดิม) ----------
  function setFever(value, stateHint) {
    fever = clamp(value, 0, FEVER_MAX);

    if (FeverUI && typeof FeverUI.setFever === 'function') {
      FeverUI.setFever(fever);
    }

    emit('hha:fever', {
      state: stateHint || (feverActive ? 'active' : 'charge'),
      value: fever,
      max: FEVER_MAX
    });
  }

  function startFever() {
    if (feverActive) return;
    feverActive = true;
    fever = FEVER_MAX;

    if (FeverUI && typeof FeverUI.setFeverActive === 'function') {
      FeverUI.setFeverActive(true);
    }
    if (FeverUI && typeof FeverUI.setFever === 'function') {
      FeverUI.setFever(fever);
    }

    emit('hha:fever', { state:'start', value: fever, max: FEVER_MAX });

    if (feverTimer) clearTimeout(feverTimer);
    feverTimer = setTimeout(() => {
      endFever();
    }, FEVER_DURATION);
  }

  function endFever() {
    if (!feverActive) return;
    feverActive = false;
    fever = 0;

    if (FeverUI && typeof FeverUI.setFeverActive === 'function') {
      FeverUI.setFeverActive(false);
    }
    if (FeverUI && typeof FeverUI.setFever === 'function') {
      FeverUI.setFever(fever);
    }

    emit('hha:fever', { state:'end', value: fever, max: FEVER_MAX });
  }

  // ---------- Quest (เวอร์ชันง่าย) ----------
  function pushQuest(hint) {
    const goalObj = {
      label: GOAL.label,
      prog: Math.min(GOAL.prog, GOAL.target),
      target: GOAL.target,
      done: GOAL.done
    };
    const miniObj = {
      label: MINI.label,
      prog: Math.min(MINI.prog, MINI.target),
      target: MINI.target,
      done: MINI.done
    };

    emit('quest:update', {
      goal: goalObj,
      mini: miniObj,
      goalsAll: [goalObj],
      minisAll: [miniObj],
      hint: hint || ''
    });
  }

  function updateGoalFromGoodHit() {
    GOAL.prog = goodHit;
    if (!GOAL.done && GOAL.prog >= GOAL.target) {
      GOAL.done = true;
      coach('ภารกิจหลักสำเร็จแล้ว! เก็บผัก ผลไม้ครบตามเป้าแล้ว 🎉');
      pushQuest('Goal สำเร็จแล้ว');
    } else {
      pushQuest('');
    }
  }

  function updateMiniFromCombo() {
    if (!MINI.done && combo >= miniComboNeed) {
      MINI.prog = 1;
      MINI.done = true;
      coach(
        `สุดยอด! คอมโบถึง x${miniComboNeed} แล้ว Mini quest ผ่านเรียบร้อย 🎯`
      );
      pushQuest('Mini quest สำเร็จแล้ว');
    } else {
      pushQuest('');
    }
  }

  function emitEnd() {
    emit('hha:end', {
      mode: 'Good vs Junk (VR)',
      score,
      comboMax,
      misses,
      goalsCleared: GOAL.done ? 1 : 0,
      goalsTotal: 1,
      miniCleared: MINI.done ? 1 : 0,
      miniTotal: 1
    });
  }

  // ---------- ลบเป้า ----------
  function removeTarget(el) {
    activeTargets = activeTargets.filter(t => t !== el);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  // ---------- สร้างเป้า (emoji pop) ----------
  function createTargetEntity(emoji, kind) {
    if (!sceneEl) return null;

    const root = document.createElement('a-entity');

    // ★ ยกเป้าขึ้นกลางจอ และกระจายซ้ายขวาให้กว้างขึ้น
    // กล้อง ~ (0,1.6,0) → ให้สุ่ม x [-1,1], y [1.8,2.4]
    const x = -1.0 + Math.random() * 2.0;
    const y = 1.8 + Math.random() * 0.6;
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.classList.add('gj-target');
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;

    // วงกลมพื้นหลัง
    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', kind === 'good' ? 0.45 : 0.4);
    circle.setAttribute('material', {
      color: kind === 'good' ? '#22c55e' : '#f97316',
      opacity: 0.32,
      metalness: 0,
      roughness: 1
    });

    // emoji sprite
    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', 0.8);
    sprite.setAttribute('height', 0.8);
    sprite.setAttribute('position', { x: 0, y: 0, z: 0.01 });
    sprite.setAttribute('material', {
      src: getEmojiTexture(emoji),
      transparent: true,
      alphaTest: 0.01
    });

    // geometry ที่ถูกยิงต้องมี data-hha-tgt
    circle.setAttribute('data-hha-tgt', '1');
    sprite.setAttribute('data-hha-tgt', '1');

    const hitHandler = () => onHit(root);
    circle.addEventListener('click', hitHandler);
    sprite.addEventListener('click', hitHandler);

    root.appendChild(circle);
    root.appendChild(sprite);
    sceneEl.appendChild(root);

    // ให้เป้าอยู่แป๊บเดียวแล้วหาย (ไม่มีตกลงมา)
    setTimeout(() => {
      if (!running) return;
      if (!root.parentNode) return;
      onExpire(root);
    }, TARGET_LIFETIME);

    return root;
  }

  // ---------- ยิงโดน ----------
  function onHit(el) {
    if (!running || !el) return;
    if (!el.parentNode) return;

    const kind = el.dataset.kind || 'junk';

    if (kind === 'good') {
      goodHit++;

      combo++;
      comboMax = Math.max(comboMax, combo);

      const base = 10 + combo * 2;
      const mult = feverActive ? 2 : 1;
      score += base * mult;

      const nextFever = fever + FEVER_HIT_GAIN;
      if (!feverActive && nextFever >= FEVER_MAX) {
        startFever();
      } else {
        setFever(nextFever, 'charge');
      }

      if (combo === 1)
        coach('เปิดคอมโบแล้ว! เลือกผัก ผลไม้ นมต่อเลย 🥦🍎🥛');
      else if (combo === miniComboNeed)
        coach(`คอมโบ x${miniComboNeed} แล้ว เยี่ยมมาก! 🔥`);
      else if (combo === 10)
        coach('สุดยอด! โปรโหมดแล้ว x10 เลย! 💪');

      updateGoalFromGoodHit();
      updateMiniFromCombo();

      playHitFx(el, true);
    } else {
      junkHit++;
      score = Math.max(0, score - 8);
      combo = 0;
      misses++;
      coach('โดนของขยะแล้ว ระวังพวก 🍔🍩 อีกนะ');

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFever(nextFever, 'charge');
      }

      emitMiss();
      updateGoalFromGoodHit();
      pushQuest('');

      playHitFx(el, false);
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
      misses++;
      combo = 0;
      coach('พลาดของดีไปนะ ลองเล็งให้ตรงเป้มากขึ้น 😊');

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFever(nextFever, 'charge');
      }

      emitMiss();
      emitScore();
      updateGoalFromGoodHit();
      pushQuest('');
    }
  }

  // ---------- สุ่ม spawn ----------
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

  // ---------- ตั้งค่า difficulty ----------
  function applyDifficulty(diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    let goalMin, goalMax, comboMin, comboMaxVal;

    if (d === 'easy') {
      SPAWN_INTERVAL  = 1100;
      TARGET_LIFETIME = 1100;
      MAX_ACTIVE      = 3;
      GOOD_RATE       = 0.7;
      goalMin = 15; goalMax = 20;
      comboMin = 3; comboMaxVal = 4;
    } else if (d === 'hard') {
      SPAWN_INTERVAL  = 750;
      TARGET_LIFETIME = 850;
      MAX_ACTIVE      = 5;
      GOOD_RATE       = 0.6;
      goalMin = 25; goalMax = 30;
      comboMin = 6; comboMaxVal = 8;
    } else { // normal
      SPAWN_INTERVAL  = 900;
      TARGET_LIFETIME = 900;
      MAX_ACTIVE      = 4;
      GOOD_RATE       = 0.65;
      goalMin = 20; goalMax = 25;
      comboMin = 4; comboMaxVal = 6;
    }

    const goalTarget = randInt(goalMin, goalMax);
    miniComboNeed = randInt(comboMin, comboMaxVal);

    GOAL.target = goalTarget;
    GOAL.label  = `เก็บอาหารดีให้ครบ ${goalTarget} ชิ้น`;
    GOAL.prog   = 0;
    GOAL.done   = false;

    MINI.target = 1;
    MINI.prog   = 0;
    MINI.done   = false;
    MINI.label  = `รักษาคอมโบให้ถึง x${miniComboNeed} อย่างน้อย 1 ครั้ง`;
  }

  // ---------- start / stop ----------
  function _startCore(diffKey) {
    running = true;
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    goodHit = 0;
    junkHit = 0;

    applyDifficulty(diffKey);

    // reset fever + UI กลาง
    fever = 0;
    feverActive = false;
    if (feverTimer) clearTimeout(feverTimer);
    if (FeverUI && typeof FeverUI.ensureFeverBar === 'function') {
      FeverUI.ensureFeverBar();
    }
    if (FeverUI && typeof FeverUI.setFever === 'function') {
      FeverUI.setFever(0);
    }
    if (FeverUI && typeof FeverUI.setFeverActive === 'function') {
      FeverUI.setFeverActive(false);
    }
    if (FeverUI && typeof FeverUI.setShield === 'function') {
      FeverUI.setShield(0);
    }
    setFever(0, 'charge');

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    emitScore();
    coach('แตะเฉพาะอาหารดี เช่น ผัก ผลไม้ นม เลี่ยงของขยะนะ 🥦🍎🥛');
    pushQuest('เริ่มเกม');

    tickSpawn();
    spawnTimer = setInterval(tickSpawn, SPAWN_INTERVAL);
  }

  function start(diffKey) {
    if (running) return;
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[GoodJunkVR] ไม่พบ <a-scene>');
      return;
    }
    if (sceneEl.hasLoaded) {
      _startCore(diffKey);
    } else {
      sceneEl.addEventListener('loaded', () => _startCore(diffKey), { once: true });
    }
  }

  function stop() {
    if (!running) return;
    running = false;

    clearInterval(spawnTimer);
    if (feverTimer) clearTimeout(feverTimer);
    endFever();

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    coach('จบเกมแล้ว! ดูสรุปคะแนนด้านบนได้เลย 🎉');
    emitEnd();
  }

  return { start, stop };
})();
