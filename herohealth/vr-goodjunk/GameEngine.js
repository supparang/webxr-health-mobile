// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Pop Targets + Simple Quest + Fever + Coach (2025-12-05c)

'use strict';

export const GameEngine = (function () {
  // ---------- emoji ชุดอาหาร ----------
  const GOOD = [
    '🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
    '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'
  ];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  // ---------- พารามิเตอร์เกม ----------
  const GOOD_RATE       = 0.65;   // โอกาสเป็นของดี
  const SPAWN_INTERVAL  = 900;    // ms ความถี่เกิดเป้า
  const TARGET_LIFETIME = 900;    // ms เป้าอยู่บนจอแป๊บเดียวแล้วหาย
  const MAX_ACTIVE      = 4;      // เป้าพร้อมกันสูงสุด

  // Fever
  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 18;     // ได้จากการตีของดี
  const FEVER_MISS_LOSS = 30;     // หายเมื่อพลาด/ตีของขยะ
  const FEVER_DURATION  = 5000;   // ms ช่วงเปิด fever

  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let goodHit = 0;     // ตีของดีสำเร็จ
  let junkHit = 0;     // เผลอตีของขยะ

  // Fever state
  let fever = 0;
  let feverActive = false;
  let feverTimer = null;

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

  // ---------- emit events ----------
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

  // ---------- Fever helpers ----------
  function clamp(v, min, max){
    return v < min ? min : (v > max ? max : v);
  }

  function setFever(value, stateHint) {
    fever = clamp(value, 0, FEVER_MAX);
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
    emit('hha:fever', { state:'end', value: fever, max: FEVER_MAX });
  }

  // ---------- Quest แบบง่าย ----------
  const GOAL = {
    label: 'เก็บอาหารดีให้ครบ 25 ชิ้น',
    prog: 0,
    target: 25,
    done: false
  };

  const MINI = {
    label: 'รักษาคอมโบให้ถึง x5 อย่างน้อย 1 ครั้ง',
    prog: 0,       // เก็บ “จำนวนครั้งที่เคยถึง x5”
    target: 1,
    done: false
  };

  function pushQuest(hint) {
    const goalObj = {
      label: GOAL.label,
      prog: GOAL.prog,
      target: GOAL.target,
      done: GOAL.done
    };
    const miniObj = {
      label: MINI.label,
      prog: MINI.prog,
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
    // ถึงคอมโบ 5 เมื่อไหร่ นับว่า mini สำเร็จแล้ว 1 ครั้ง
    if (!MINI.done && combo >= 5) {
      MINI.prog = 1;
      MINI.done = true;
      coach('สุดยอด! คอมโบถึง x5 แล้ว Mini quest ผ่านเรียบร้อย 🎯');
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

    // กล้องจริงอยู่ที่ (0,1.6,0) → ให้เป้าโผล่ระดับสายตาใกล้ crosshair
    const x = -0.55 + Math.random() * 1.1;   // -0.55 ถึง +0.55
    const yBase = 1.6;
    const yJitter = (Math.random() * 0.1) - 0.05; // 1.55–1.65 (ไม่ต่ำเกิน)
    const y = yBase + yJitter;
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.classList.add('gj-target');
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;

    // วงกลมพื้นหลังสีอ่อน
    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', kind === 'good' ? 0.45 : 0.4);
    circle.setAttribute('material', {
      color: kind === 'good' ? '#22c55e' : '#f97316',
      opacity: 0.32,
      metalness: 0,
      roughness: 1
    });

    // emoji sprite ทับด้านหน้า
    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', 0.8);
    sprite.setAttribute('height', 0.8);
    sprite.setAttribute('position', { x: 0, y: 0, z: 0.01 });
    sprite.setAttribute('material', {
      src: getEmojiTexture(emoji),
      transparent: true,
      alphaTest: 0.01
    });

    // ★ สำคัญ: geometry ที่ถูกยิงจะต้องมี data-hha-tgt ให้ raycaster เห็น
    circle.setAttribute('data-hha-tgt', '1');
    sprite.setAttribute('data-hha-tgt', '1');

    // ยิงโดน (ให้ event ไปที่ root เพื่อรวม logic ที่เดียว)
    const hitHandler = () => onHit(root);
    circle.addEventListener('click', hitHandler);
    sprite.addEventListener('click', hitHandler);

    root.appendChild(circle);
    root.appendChild(sprite);
    sceneEl.appendChild(root);

    // ตั้งเวลาให้เป้าหายไปเอง
    setTimeout(() => {
      if (!running) return;
      if (!root.parentNode) return; // ยิงไปแล้ว
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
      goodHit++;

      // คะแนน + combo + fever
      combo++;
      comboMax = Math.max(comboMax, combo);

      const base = 10 + combo * 2;
      const mult = feverActive ? 2 : 1;   // fever คูณ 2
      score += base * mult;

      // ปั่น fever
      const nextFever = fever + FEVER_HIT_GAIN;
      if (!feverActive && nextFever >= FEVER_MAX) {
        startFever();
      } else {
        setFever(nextFever, 'charge');
      }

      if (combo === 1)
        coach('เปิดคอมโบแล้ว! เลือกผัก ผลไม้ นมต่อเลย 🥦🍎🥛');
      else if (combo === 5)
        coach('คอมโบ x5 แล้ว เยี่ยมมาก! 🔥');
      else if (combo === 10)
        coach('สุดยอด! โปรโหมดแล้ว x10 เลย! 💪');

      updateGoalFromGoodHit();
      updateMiniFromCombo();
    } else {
      // ตีของขยะ
      junkHit++;
      score = Math.max(0, score - 8);
      combo = 0;
      misses++;
      coach('โดนของขยะแล้ว ระวังพวก 🍔🍩 อีกนะ');

      // ลด fever และอาจตัด fever ทิ้ง
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
      coach('พลาดของดีไปนะ ลองเล็งให้ตรงเป้มากขึ้น 😊');

      // พลาดก็ทำให้ fever ลด
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
    goodHit = 0;
    junkHit = 0;

    // reset quest
    GOAL.prog = 0; GOAL.done = false;
    MINI.prog = 0; MINI.done = false;

    // reset fever
    fever = 0;
    feverActive = false;
    if (feverTimer) clearTimeout(feverTimer);
    setFever(0, 'charge');

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    emitScore();
    coach('แตะเฉพาะอาหารดี เช่น ผัก ผลไม้ นม เลี่ยงของขยะนะ 🥦🍎🥛');
    pushQuest('เริ่มเกม');

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
    if (feverTimer) clearTimeout(feverTimer);
    endFever();

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    coach('จบเกมแล้ว! ดูสรุปคะแนนด้านบนได้เลย 🎉');
    emitEnd();
  }

  return { start, stop };
})();
