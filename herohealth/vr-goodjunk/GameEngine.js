// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Pop Targets + Multi-Quest + Fever + Shield + Coach + FX
// 2025-12-07 — เป้าเล็กตามระดับ, spawn responsive, ยกเป้าสูงขึ้น,
// goals / mini quests สุ่มจาก pool (10 / 15) และ scale ตามระดับ (Easy≈60%, Hard≈130%)

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

  // ---------- Particles DOM FX (shared) ----------
  const Particles =
    (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
    window.Particles || {
      burstAt() {},
      scorePop() {}
    };

  // ---------- emoji ชุดอาหาร ----------
  const GOOD = [
    '🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
    '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'
  ];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  // special targets
  const STAR_EMOJI    = '⭐';
  const DIAMOND_EMOJI = '💎';
  const SHIELD_EMOJI  = '🛡️';

  // ---------- ค่าพื้นฐาน (จะถูก override ตาม diff) ----------
  let GOOD_RATE       = 0.65;
  let SPAWN_INTERVAL  = 900;
  let TARGET_LIFETIME = 900;
  let MAX_ACTIVE      = 4;
  let SIZE_FACTOR     = 0.8; // scale ขนาดเป้า

  // type weights (จะปรับตาม diff)
  let TYPE_WEIGHTS = {
    good:    70,
    junk:    20,
    star:     4,
    diamond:  3,
    shield:   3
  };

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
  let shieldCount = 0;

  // Fever state
  let fever = 0;
  let feverActive = false;
  let feverTimer = null;

  // ---------- Quest pool แยกตามระดับ + scale ตามโจทย์วิจัย ----------
  // ใช้ Normal เป็น baseline วิจัย จากนั้น Easy≈60%, Hard≈130%

  // จำนวน good ที่อยากได้ใน Normal (10 ภารกิจ)
  const GOAL_BASE_NORMAL = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];

  // ค่าคอมโบเป้าหมายใน Normal (15 ภารกิจ)
  const MINI_BASE_NORMAL = [3,4,5,6,7,8,9,10,4,6,8,5,7,9,10];

  function buildScaledGoals(baseArr, scale, prefix) {
    return baseArr.map((base, idx) => {
      const target = Math.max(1, Math.round(base * scale));
      return {
        id: `${prefix}${idx + 1}`,
        label: `เก็บอาหารดีให้ครบ ${target} ชิ้น`,
        target
      };
    });
  }

  function buildScaledMinis(baseArr, scale, prefix) {
    return baseArr.map((base, idx) => {
      const thr = Math.max(2, Math.round(base * scale));
      return {
        id: `${prefix}${idx + 1}`,
        label: `ทำคอมโบให้ถึง x${thr} อย่างน้อย 1 ครั้ง`,
        threshold: thr
      };
    });
  }

  // ★ scale ตามระดับ: Easy≈60%, Normal=100%, Hard≈130%
  const GOAL_POOLS = {
    easy:   buildScaledGoals(GOAL_BASE_NORMAL, 0.6, 'ge'),
    normal: buildScaledGoals(GOAL_BASE_NORMAL, 1.0, 'gn'),
    hard:   buildScaledGoals(GOAL_BASE_NORMAL, 1.3, 'gh')
  };

  const MINI_POOLS = {
    easy:   buildScaledMinis(MINI_BASE_NORMAL, 0.6, 'me'),
    normal: buildScaledMinis(MINI_BASE_NORMAL, 1.0, 'mn'),
    hard:   buildScaledMinis(MINI_BASE_NORMAL, 1.3, 'mh')
  };

  let activeGoals = [];    // goal ที่ใช้ใน run นี้ (สุ่มมา 2 ภารกิจจาก 10)
  let activeMinis = [];    // mini ที่ใช้ใน run นี้ (สุ่มมา 3 ภารกิจจาก 15)
  let miniComboNeed = 5;   // ใช้กับข้อความโค้ช (xN แล้ว!)
  let goalPool = GOAL_POOLS.normal;   // จะสลับใน applyDifficulty()
  let miniPool = MINI_POOLS.normal;

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

  function pickSome(list, count) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr.slice(0, Math.min(count, arr.length));
  }

  // world → screen สำหรับ FX
  function worldToScreen(objLike) {
    try {
      const THREE = window.THREE || (window.AFRAME && window.AFRAME.THREE);
      if (!THREE || !sceneEl || !sceneEl.camera || !objLike.object3D) {
        return {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        };
      }
      const vec = new THREE.Vector3();
      vec.setFromMatrixPosition(objLike.object3D.matrixWorld);
      vec.project(sceneEl.camera);
      const x = (vec.x + 1) / 2 * window.innerWidth;
      const y = (1 - vec.y) / 2 * window.innerHeight;
      return { x, y };
    } catch (err) {
      return {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      };
    }
  }

  // judgment ตามอายุเป้า
  function getJudgment(el) {
    const born = Number(el.dataset.born || '0');
    if (!born || !TARGET_LIFETIME) return 'good';

    const age = performance.now() - born;
    const t = TARGET_LIFETIME;

    if (age < t * 0.45) return 'perfect';
    if (age < t * 0.90) return 'good';
    return 'late';
  }

  // ---------- FX ตอนยิงโดน ----------
  function showHitFx(el, kind, judgment, scoreDelta) {
    const pos = worldToScreen(el);
    const x = pos.x;
    const y = pos.y;

    // particle แตกกลางเป้า
    if (Particles && typeof Particles.burstAt === 'function') {
      const opts = {};
      if (kind === 'good')    opts.good = true;
      if (kind === 'junk')    opts.bad = true;
      if (kind === 'star')    opts.star = true;
      if (kind === 'diamond') opts.diamond = true;
      if (kind === 'shield')  opts.shield = true;
      Particles.burstAt(x, y, opts);
    }

    const yScore = y;       // คะแนนอยู่กลางเป้า
    const yLabel = y - 24;  // Miss / Late / Good / Perfect ลอยขึ้นหน่อย

    if (Particles && typeof Particles.scorePop === 'function') {
      // คะแนน + / -
      if (typeof scoreDelta === 'number' && scoreDelta !== 0) {
        const txt = (scoreDelta > 0 ? '+' : '') + scoreDelta;
        Particles.scorePop(x, yScore, txt, {
          good: kind === 'good' || kind === 'star' || kind === 'diamond' || kind === 'shield',
          bad:  kind === 'junk'
        });
      }

      // ข้อความ judgment
      if (judgment) {
        let label = '';
        if (judgment === 'perfect') label = 'Perfect';
        else if (judgment === 'good') label = 'Good';
        else if (judgment === 'late') label = 'Late';
        else if (judgment === 'miss') label = 'Miss';

        if (label) {
          Particles.scorePop(x, yLabel, label, { small: true });
        }
      }
    }
  }

  function showMissFx(el) {
    const pos = worldToScreen(el);
    const x = pos.x;
    const y = pos.y;

    if (Particles && typeof Particles.burstAt === 'function') {
      Particles.burstAt(x, y, { bad: true });
    }
    if (Particles && typeof Particles.scorePop === 'function') {
      Particles.scorePop(x, y - 16, 'Miss', { bad: true, small: true });
    }
  }

  // ---------- Fever ----------
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

    if (FeverUI && FeverUI.setFeverActive) FeverUI.setFeverActive(true);
    if (FeverUI && FeverUI.setFever)       FeverUI.setFever(fever);

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

    if (FeverUI && FeverUI.setFeverActive) FeverUI.setFeverActive(false);
    if (FeverUI && FeverUI.setFever)       FeverUI.setFever(fever);

    emit('hha:fever', { state:'end', value: fever, max: FEVER_MAX });
  }

  // ---------- Quest logic ----------
  function setupQuestsForRun() {
    const gPool = goalPool || GOAL_POOLS.normal;
    const mPool = miniPool || MINI_POOLS.normal;

    // goal 2 ภารกิจจาก pool 10
    activeGoals = pickSome(gPool, 2).map(g => ({
      id: g.id,
      label: g.label,
      target: g.target,
      prog: 0,
      done: false
    }));

    // mini 3 ภารกิจจาก pool 15
    activeMinis = pickSome(mPool, 3).map(m => ({
      id: m.id,
      label: m.label,
      threshold: m.threshold,
      target: m.threshold,
      prog: 0,
      done: false
    }));

    miniComboNeed = activeMinis[0] ? activeMinis[0].threshold : 5;
  }

  function pushQuest(hint) {
    const goalsUi = activeGoals.map(g => ({
      label: g.label,
      prog: Math.min(g.prog, g.target),
      target: g.target,
      done: g.done
    }));
    const minisUi = activeMinis.map(m => ({
      label: m.label,
      prog: Math.min(m.prog, m.target),
      target: m.target,
      done: m.done
    }));

    const primaryGoal = goalsUi[0] || null;
    const primaryMini = minisUi[0] || null;

    const goalsCleared = goalsUi.filter(g => g.done).length;
    const minisCleared = minisUi.filter(m => m.done).length;

    const statusText =
      `Goals ${goalsCleared}/2 (จาก 10) • Mini ${minisCleared}/3 (จาก 15)`;

    emit('quest:update', {
      goal: primaryGoal,
      mini: primaryMini,
      goalsAll: goalsUi,
      minisAll: minisUi,
      hint: hint || statusText,
      status: statusText
    });
  }

  function updateGoalsFromGoodHit() {
    if (!activeGoals.length) {
      pushQuest('');
      return;
    }
    let allDone = true;
    activeGoals.forEach(g => {
      g.prog = goodHit;
      if (!g.done && g.prog >= g.target) {
        g.done = true;
      }
      if (!g.done) allDone = false;
    });
    if (allDone) {
      coach('ภารกิจหลักทั้งหมดสำเร็จแล้ว! เยี่ยมมาก 🎉');
    }
    pushQuest('');
  }

  function updateMinisFromCombo() {
    if (!activeMinis.length) {
      pushQuest('');
      return;
    }
    let allDone = true;
    activeMinis.forEach(m => {
      m.prog = Math.min(comboMax, m.target);
      if (!m.done && comboMax >= m.threshold) {
        m.done = true;
      }
      if (!m.done) allDone = false;
    });
    if (allDone) {
      coach('Mini quest ทั้งหมดสำเร็จแล้ว ✨');
    }
    pushQuest('');
  }

  function emitEnd() {
    const goalsCleared = activeGoals.filter(g => g.done).length;
    const minisCleared = activeMinis.filter(m => m.done).length;

    emit('hha:end', {
      mode: 'Good vs Junk (VR)',
      score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal: activeGoals.length,
      miniCleared: minisCleared,
      miniTotal: activeMinis.length
    });
  }

  // ---------- ลบเป้า ----------
  function removeTarget(el) {
    activeTargets = activeTargets.filter(t => t !== el);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  // ---------- ตำแหน่ง spawn แบบ responsive (ยกเป้าขึ้นด้านบน) ----------
  function pickSpawnPosition() {
    const z = -3.0;

    const aspect = window.innerWidth / window.innerHeight;
    const halfX = 1.2 * Math.max(1, aspect);
    const minX = -halfX;
    const maxX = halfX;

    // ยก y ขึ้นด้านบน
    const minY = 2.6;
    const maxY = 3.4;

    let x = 0, y = 0;

    for (let i = 0; i < 10; i++) {
      x = minX + Math.random() * (maxX - minX);
      y = minY + Math.random() * (maxY - minY);

      const THREE = window.THREE || (window.AFRAME && window.AFRAME.THREE);
      if (sceneEl && sceneEl.camera && THREE) {
        const dummyObj = new THREE.Object3D();
        dummyObj.position.set(x, y, z);
        const screen = worldToScreen({ object3D: dummyObj });
        const sx = screen.x;
        const sy = screen.y;

        const marginX   = 72;
        const topHUD    = 80;
        const bottomHUD = 260; // เผื่อ coach + fever ล่าง

        if (
          sx > marginX &&
          sx < window.innerWidth - marginX &&
          sy > topHUD &&
          sy < window.innerHeight - bottomHUD
        ) {
          return { x, y, z };
        }
      } else {
        return { x, y, z };
      }
    }

    return {
      x: clamp(x, -halfX, halfX),
      y: clamp(y, minY, maxY),
      z
    };
  }

  // ---------- สร้างเป้า (emoji pop) ----------
  function createTargetEntity(emoji, kind) {
    if (!sceneEl) return null;

    const root = document.createElement('a-entity');

    const pos = pickSpawnPosition();
    root.setAttribute('position', pos);
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.classList.add('gj-target');
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;
    root.dataset.born = String(performance.now());

    let color = '#22c55e';
    if (kind === 'junk')   color = '#f97316';
    if (kind === 'star')   color = '#fde047';
    if (kind === 'diamond')color = '#38bdf8';
    if (kind === 'shield') color = '#60a5fa';

    const baseRadius =
      kind === 'good' ? 0.45 :
      kind === 'junk' ? 0.42 : 0.40;

    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', baseRadius * SIZE_FACTOR);
    circle.setAttribute('material', {
      color,
      opacity: 0.30,
      metalness: 0,
      roughness: 1
    });

    const baseSize = 0.8 * SIZE_FACTOR;
    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', baseSize);
    sprite.setAttribute('height', baseSize);
    sprite.setAttribute('position', { x: 0, y: 0, z: 0.01 });
    sprite.setAttribute('material', {
      src: getEmojiTexture(emoji),
      transparent: true,
      alphaTest: 0.01
    });

    circle.setAttribute('data-hha-tgt', '1');
    sprite.setAttribute('data-hha-tgt', '1');

    const hitHandler = () => onHit(root);
    circle.addEventListener('click', hitHandler);
    sprite.addEventListener('click', hitHandler);

    root.appendChild(circle);
    root.appendChild(sprite);
    sceneEl.appendChild(root);

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
    const judgmentRaw = getJudgment(el);
    const judgment = (kind === 'junk') ? 'miss' : judgmentRaw;

    const scoreBefore = score;

    if (kind === 'shield') {
      shieldCount += 1;
      if (FeverUI && FeverUI.setShield) FeverUI.setShield(shieldCount);
      coach('ได้เกราะป้องกัน 1 ชิ้น! ถ้าเผลอแตะของขยะจะไม่เสียแต้มทันที 🛡️');
      showHitFx(el, kind, null, 0);
      emitScore();
      removeTarget(el);
      return;
    }

    if (kind === 'star') {
      const mult = feverActive ? 2 : 1;
      score += 80 * mult;
      coach('ดวงดาวโบนัส! ได้แต้มพิเศษเพิ่มขึ้น ⭐');
      showHitFx(el, kind, judgment, score - scoreBefore);
      emitScore();
      removeTarget(el);
      return;
    }

    if (kind === 'diamond') {
      const mult = feverActive ? 2 : 1;
      score += 60 * mult;
      setFever(fever + 30, 'charge');
      coach('ได้เพชรพลังงาน! Fever ขึ้นไวขึ้น 💎');
      showHitFx(el, kind, judgment, score - scoreBefore);
      emitScore();
      removeTarget(el);
      return;
    }

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

      updateGoalsFromGoodHit();
      updateMinisFromCombo();
    } else {
      // junk
      if (shieldCount > 0) {
        shieldCount -= 1;
        if (FeverUI && FeverUI.setShield) FeverUI.setShield(shieldCount);
        coach('โชคดีมีเกราะกันไว้ ของขยะไม่ทำร้ายคะแนนรอบนี้ 🛡️');
        showHitFx(el, kind, 'miss', 0);
        emitScore();
        removeTarget(el);
        return;
      }

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
      updateGoalsFromGoodHit();
      pushQuest('');
    }

    showHitFx(el, kind, judgment, score - scoreBefore);
    emitScore();
    removeTarget(el);
  }

  // ---------- เป้าหายเพราะหมดเวลา ----------
  function onExpire(el) {
    if (!running || !el) return;
    if (!el.parentNode) return;

    const kind = el.dataset.kind || 'junk';

    if (kind === 'good') {
      showMissFx(el);
      removeTarget(el);

      misses++;
      combo = 0;
      coach('พลาดของดีไปนะ ลองเล็งให้ตรงเป้ามากขึ้น 😊');

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFever(nextFever, 'charge');
      }

      emitMiss();
      emitScore();
      updateGoalsFromGoodHit();
      pushQuest('');
    } else {
      removeTarget(el);
    }
  }

  // ---------- สุ่มชนิดเป้า ----------
  function pickType() {
    const w = TYPE_WEIGHTS;
    const sum =
      (w.good   || 0) +
      (w.junk   || 0) +
      (w.star   || 0) +
      (w.diamond|| 0) +
      (w.shield || 0);

    let r = Math.random() * sum;

    if ((r -= w.good) <= 0)    return 'good';
    if ((r -= w.junk) <= 0)    return 'junk';
    if ((r -= w.star) <= 0)    return 'star';
    if ((r -= w.diamond) <= 0) return 'diamond';
    return 'shield';
  }

  function tickSpawn() {
    if (!running) return;
    if (activeTargets.length >= MAX_ACTIVE) return;

    const type = pickType();

    let emoji, kind;
    if (type === 'good') {
      emoji = GOOD[Math.floor(Math.random() * GOOD.length)];
      kind  = 'good';
    } else if (type === 'junk') {
      emoji = JUNK[Math.floor(Math.random() * JUNK.length)];
      kind  = 'junk';
    } else if (type === 'star') {
      emoji = STAR_EMOJI;
      kind  = 'star';
    } else if (type === 'diamond') {
      emoji = DIAMOND_EMOJI;
      kind  = 'diamond';
    } else {
      emoji = SHIELD_EMOJI;
      kind  = 'shield';
    }

    const el = createTargetEntity(emoji, kind);
    if (el) activeTargets.push(el);
  }

  // ---------- ตั้งค่า difficulty ----------
  function applyDifficulty(diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();

    if (d === 'easy') {
      // ง่าย: เป้าใหญ่ขึ้น อยู่นานขึ้น spawn ช้าลง
      SPAWN_INTERVAL  = 1200;
      TARGET_LIFETIME = 1800;
      MAX_ACTIVE      = 3;
      GOOD_RATE       = 0.75;
      SIZE_FACTOR     = 0.90;

      TYPE_WEIGHTS = {
        good:    78,
        junk:    12,
        star:     4,
        diamond:  3,
        shield:   3
      };

      goalPool = GOAL_POOLS.easy;
      miniPool = MINI_POOLS.easy;

    } else if (d === 'hard') {
      // ยาก: เป้าเล็กลง อยู่น้อยลง spawn ถี่ขึ้น
      SPAWN_INTERVAL  = 800;
      TARGET_LIFETIME = 1200;
      MAX_ACTIVE      = 5;
      GOOD_RATE       = 0.60;
      SIZE_FACTOR     = 0.50;

      TYPE_WEIGHTS = {
        good:    65,
        junk:    22,
        star:     5,
        diamond:  4,
        shield:   4
      };

      goalPool = GOAL_POOLS.hard;
      miniPool = MINI_POOLS.hard;

    } else {
      // normal = baseline
      SPAWN_INTERVAL  = 1000;
      TARGET_LIFETIME = 1500;
      MAX_ACTIVE      = 4;
      GOOD_RATE       = 0.66;
      SIZE_FACTOR     = 0.70;

      TYPE_WEIGHTS = {
        good:    70,
        junk:    18,
        star:     4,
        diamond:  4,
        shield:   4
      };

      goalPool = GOAL_POOLS.normal;
      miniPool = MINI_POOLS.normal;
    }
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
    shieldCount = 0;

    applyDifficulty(diffKey);
    setupQuestsForRun();

    // reset Fever UI
    if (FeverUI && FeverUI.ensureFeverBar) FeverUI.ensureFeverBar();
    if (FeverUI && FeverUI.setFever)      FeverUI.setFever(0);
    if (FeverUI && FeverUI.setShield)     FeverUI.setShield(shieldCount);
    if (FeverUI && FeverUI.setFeverActive)FeverUI.setFeverActive(false);

    fever = 0;
    feverActive = false;
    if (feverTimer) clearTimeout(feverTimer);
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
      sceneEl.addEventListener('loaded', function () {
        _startCore(diffKey);
      }, { once: true });
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
