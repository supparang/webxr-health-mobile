// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Pop Targets + Difficulty Quest + Fever + Powerups + Coach
// (2025-12-06, shared FeverUI + STAR/DIAMOND/SHIELD)

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

  // ---------- emoji ชุดอาหาร + powerups ----------
  const GOOD = [
    '🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
    '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'
  ];
  const JUNK  = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  const STAR        = '⭐';
  const DIA         = '💎';
  const SHIELD_ICON = '🛡️';
  const POWERUP_SET = [STAR, DIA, SHIELD_ICON];

  // ---------- ค่าพื้นฐาน (จะถูก override ตาม diff) ----------
  let GOOD_RATE       = 0.65;
  let SPAWN_INTERVAL  = 900;
  let TARGET_LIFETIME = 900;
  let MAX_ACTIVE      = 4;
  const POWER_RATE    = 0.14;   // โอกาส spawn powerup (ที่เหลือเป็น good / junk)

  // Fever
  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 18;
  const FEVER_MISS_LOSS = 30;
  const FEVER_DURATION  = 5000;   // ms

  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let activeTargets = [];

  let score    = 0;
  let combo    = 0;
  let comboMax = 0;
  let misses   = 0;
  let goodHit  = 0;
  let junkHit  = 0;

  // Fever state
  let fever       = 0;
  let feverActive = false;
  let feverTimer  = null;

  // Shield state
  let shield = 0;           // จำนวนเกราะปัจจุบัน (0–3)

  // ---------- Quest state (ง่าย ๆ ชุดเดียว) ----------
  const GOAL = {
    label: 'เก็บอาหารดีให้ครบ 25 ชิ้น',
    prog: 0,
    target: 25,
    done: false
  };

  const MINI = {
    label: 'รักษาคอมโบให้ถึง x5 อย่างน้อย 1 ครั้ง',
    prog: 0,
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

  // ---------- Fever (ใช้ร่วม FeverUI + hha:fever) ----------
  function setFever(value, stateHint) {
    fever = clamp(value, 0, FEVER_MAX);

    if (FeverUI && typeof FeverUI.setFever === 'function') {
      FeverUI.setFever(fever);
    }

    emit('hha:fever', {
      state: stateHint || (feverActive ? 'active' : 'charge'),
      value: fever,
      max:   FEVER_MAX
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

  // ---------- Quest ----------
  function pushQuest(hint) {
    const goalObj = {
      label: GOAL.label,
      prog:  Math.min(GOAL.prog, GOAL.target),
      target:GOAL.target,
      done:  GOAL.done
    };
    const miniObj = {
      label: MINI.label,
      prog:  Math.min(MINI.prog, MINI.target),
      target:MINI.target,
      done:  MINI.done
    };

    emit('quest:update', {
      goal:     goalObj,
      mini:     miniObj,
      goalsAll: [goalObj],
      minisAll: [miniObj],
      hint:     hint || ''
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
      goalsTotal:   1,
      miniCleared:  MINI.done ? 1 : 0,
      miniTotal:    1
    });
  }

  // ---------- ลบเป้า ----------
  function removeTarget(el) {
    activeTargets = activeTargets.filter(t => t !== el);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  // ---------- สร้างเป้า (emoji pop กลางจอ) ----------
  function createTargetEntity(emoji, kind) {
    if (!sceneEl) return null;

    const root = document.createElement('a-entity');

    // กล้องอยู่ประมาณ (0,1.6,0)
    // → ให้สุ่มในกรอบกลางจอ: x ~ [-0.7,0.7], y ~ [1.4,2.1]
    const x = -0.7 + Math.random() * 1.4;
    const y =  1.4 + Math.random() * 0.7;
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.classList.add('gj-target');
    root.dataset.kind  = kind;
    root.dataset.emoji = emoji;

    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', kind === 'junk' ? 0.38 : 0.45);
    circle.setAttribute('material', {
      color:   kind === 'junk' ? '#f97316' : '#22c55e',
      opacity: 0.32,
      metalness: 0,
      roughness: 1
    });

    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', 0.8);
    sprite.setAttribute('height',0.8);
    sprite.setAttribute('position', { x: 0, y: 0, z: 0.01 });
    sprite.setAttribute('material', {
      src:         getEmojiTexture(emoji),
      transparent: true,
      alphaTest:   0.01
    });

    // ★ geometry ที่ raycaster ยิงได้
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
    removeTarget(el);

    // ----- Powerups -----
    if (kind === 'star') {
      const base = 60;
      const mult = feverActive ? 2 : 1;
      score += base * mult;

      setFever(fever + 28, 'charge');

      coach('ได้ ⭐ โบนัสใหญ่! คะแนนพุ่งเลย ✨');
      emitScore();
      pushQuest('');
      return;
    }

    if (kind === 'diamond') {
      const base = 90;
      const mult = feverActive ? 2 : 1;
      score += base * mult;

      setFever(fever + 40, 'charge');

      coach('ว้าว! 💎 เพชรโภชนาการ ได้คะแนนก้อนใหญ่เลย! 💎');
      emitScore();
      pushQuest('');
      return;
    }

    if (kind === 'shield') {
      shield = Math.min(3, shield + 1);
      if (FeverUI && typeof FeverUI.setShield === 'function') {
        FeverUI.setShield(shield);
      }
      score += 20;

      coach('ได้ 🛡️ เกราะป้องกันแล้ว! พลาดครั้งหน้าเกราะจะช่วยรับให้นะ');
      emitScore();
      pushQuest('');
      return;
    }

    // ----- ปกติ: good / junk -----
    if (kind === 'good') {
      goodHit++;

      combo++;
      comboMax = Math.max(comboMax, combo);

      const base = 10 + combo * 2;
      const mult = feverActive ? 2 : 1;
      score += base * mult;

      const nextF = fever + FEVER_HIT_GAIN;
      if (!feverActive && nextF >= FEVER_MAX) {
        startFever();
      } else {
        setFever(nextF, 'charge');
      }

      if (combo === 1)
        coach('เปิดคอมโบแล้ว! เลือกผัก ผลไม้ นมต่อเลย 🥦🍎🥛');
      else if (combo === miniComboNeed)
        coach(`คอมโบ x${miniComboNeed} แล้ว เยี่ยมมาก! 🔥`);
      else if (combo === 10)
        coach('สุดยอด! โปรโหมดแล้ว x10 เลย! 💪');

      updateGoalFromGoodHit();
      updateMiniFromCombo();
    } else {
      // ---- ตีของขยะ ----
      if (shield > 0) {
        // ใช้เกราะกันพลาด: ไม่เพิ่ม miss, แค่หักเกราะ + fever นิดหน่อย
        shield -= 1;
        if (FeverUI && typeof FeverUI.setShield === 'function') {
          FeverUI.setShield(shield);
        }

        combo = Math.max(0, combo - 1);
        setFever(fever - FEVER_MISS_LOSS * 0.5, 'charge');

        coach('เกราะ 🛡️ ช่วยกันของขยะให้แล้ว รอบหน้าลองเล็งให้แม่นขึ้นนะ!');
        emitScore();
        pushQuest('');
        return;
      }

      junkHit++;
      score  = Math.max(0, score - 8);
      combo  = 0;
      misses++;

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFever(nextFever, 'charge');
      }

      coach('โดนของขยะแล้ว ระวังพวก 🍔🍩 อีกนะ');
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

    // powerups หมดเวลา: ไม่ลงโทษ
    if (kind !== 'good') return;

    // ของดีหลุดจอ
    if (shield > 0) {
      // เกราะช่วยรับของดีที่พลาด → ไม่เพิ่ม miss
      shield -= 1;
      if (FeverUI && typeof FeverUI.setShield === 'function') {
        FeverUI.setShield(shield);
      }
      setFever(fever - FEVER_MISS_LOSS * 0.5, 'charge');
      coach('เกราะช่วยรับของดีที่พลาดไป ลองแตะให้ทันครั้งหน้านะ 😊');
      emitScore();
      pushQuest('');
      return;
    }

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

  // ---------- สุ่ม spawn ----------
  function tickSpawn() {
    if (!running) return;
    if (activeTargets.length >= MAX_ACTIVE) return;

    let emoji, kind;

    // สุ่มว่าจะเป็น powerup หรือไม่
    if (Math.random() < POWER_RATE) {
      const p = POWERUP_SET[Math.floor(Math.random() * POWERUP_SET.length)];
      emoji = p;
      if (p === STAR)        kind = 'star';
      else if (p === DIA)    kind = 'diamond';
      else                   kind = 'shield';
    } else {
      const isGood = Math.random() < GOOD_RATE;
      const pool   = isGood ? GOOD : JUNK;
      emoji = pool[Math.floor(Math.random() * pool.length)];
      kind  = isGood ? 'good' : 'junk';
    }

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
    miniComboNeed    = randInt(comboMin, comboMaxVal);

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
    score    = 0;
    combo    = 0;
    comboMax = 0;
    misses   = 0;
    goodHit  = 0;
    junkHit  = 0;
    shield   = 0;

    applyDifficulty(diffKey);

    fever       = 0;
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
