// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Pop Targets + Difficulty Quest + Fever + Shield + Coach
// Research-ready (Session + Event logging + Particles) — 2025-12-07

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

  // ---------- Particles (DOM FX layer) ----------
  const Particles = window.Particles || null;

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
  let TARGET_LIFETIME = 1100; // ms
  let MAX_ACTIVE      = 4;

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

  // Session สำหรับวิจัย
  let sessionId = null;
  let sessionStartMs = 0;
  let lastDiffKey = 'normal';

  // ---------- Quest state (goal + mini ปรับตาม diff) ----------
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

  // threshold คอมโบที่ใช้สำหรับ Mini (สุ่มตาม diff)
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
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function randInt(min, max){
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  // world → screen (ไว้ใช้กับ Particles)
  function projectToScreen(el) {
    try {
      const A = window.AFRAME;
      if (!A || !sceneEl || !sceneEl.camera || !el || !el.object3D) {
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      }
      const THREE = A.THREE;
      const v = new THREE.Vector3();
      el.object3D.getWorldPosition(v);
      v.project(sceneEl.camera);
      const sx = (v.x + 1) / 2 * window.innerWidth;
      const sy = (1 - v.y) / 2 * window.innerHeight;
      return { x: sx, y: sy };
    } catch (err) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
  }

  // ---------- Particles FX ----------
  function spawnHitFx(x, y, scoreDelta, judgment, isGood) {
    if (!Particles || typeof Particles.scorePop !== 'function' || typeof Particles.burstAt !== 'function') {
      return;
    }
    const labelScore = (scoreDelta > 0 ? '+' : '') + (scoreDelta|0);
    const opts = {
      good: !!isGood,
      judgment: judgment || ''
    };
    Particles.scorePop(x, y, labelScore, opts);
    const color = isGood ? '#22c55e' : '#f97316';
    Particles.burstAt(x, y, { color, count: 14, radius: 60 });
  }

  function spawnBonusFx(x, y, kind) {
    if (!Particles || typeof Particles.scorePop !== 'function' || typeof Particles.burstAt !== 'function') {
      return;
    }
    let text = '';
    let color = '#38bdf8';
    if (kind === 'star') {
      text = 'BONUS ⭐';
      color = '#fde047';
    } else if (kind === 'diamond') {
      text = 'FEVER+ 💎';
      color = '#38bdf8';
    } else if (kind === 'shield') {
      text = 'SHIELD 🛡️';
      color = '#60a5fa';
    }
    Particles.scorePop(x, y, text, { good:true, judgment:'' });
    Particles.burstAt(x, y, { color, count: 16, radius: 70 });
  }

  // ---------- logging ไป Google Sheet ----------
  function logEvent(ev) {
    if (!sessionId) return;
    const data = Object.assign({
      sessionId,
      mode: 'GoodJunkVR',
      difficulty: lastDiffKey
    }, ev || {});
    emit('hha:event', data);
  }

  function logSessionStart(diffKey) {
    sessionId = 'GJVR-' + Date.now().toString(36) + '-' + Math.floor(Math.random()*1e5).toString(36);
    sessionStartMs = Date.now();
    emit('hha:session', {
      type: 'start',
      sessionId,
      mode: 'GoodJunkVR',
      difficulty: diffKey || 'normal',
      device: navigator.userAgent || '',
      startTimeIso: new Date(sessionStartMs).toISOString(),
      gameVersion: 'GJ-VR-2025-12-07'
    });
  }

  function logSessionEnd(reason) {
    if (!sessionId) return;
    const endMs = Date.now();
    const durSec = sessionStartMs ? Math.max(0, Math.round((endMs - sessionStartMs)/1000)) : 0;
    emit('hha:session', {
      type: 'end',
      sessionId,
      mode: 'GoodJunkVR',
      difficulty: lastDiffKey,
      device: navigator.userAgent || '',
      startTimeIso: sessionStartMs ? new Date(sessionStartMs).toISOString() : '',
      endTimeIso: new Date(endMs).toISOString(),
      durationSecPlayed: durSec,
      scoreFinal: score,
      comboMax,
      misses,
      gameVersion: 'GJ-VR-2025-12-07',
      reason: reason || 'normal-end'
    });
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

  // ---------- Quest ----------
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
      coach(`สุดยอด! คอมโบถึง x${miniComboNeed} แล้ว Mini quest ผ่านเรียบร้อย 🎯`);
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

    // กล้อง (0,1.6,0) → ให้เป้าสูงขึ้น + กระจายเต็มจอ
    // x ~ [-1.4,1.4], y ~ [2.1,3.0]
    const x = -1.4 + Math.random() * 2.8;
    const y = 2.1  + Math.random() * 0.9;
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.classList.add('gj-target');
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;
    root.dataset.spawnTime = String(Date.now());

    // วงกลมพื้นหลัง
    const circle = document.createElement('a-circle');
    let color = '#22c55e';
    if (kind === 'junk')   color = '#f97316';
    if (kind === 'star')   color = '#fde047';
    if (kind === 'diamond')color = '#38bdf8';
    if (kind === 'shield') color = '#60a5fa';

    circle.setAttribute('radius',
      kind === 'good' ? 0.42 :
      kind === 'junk' ? 0.40 : 0.36
    );
    circle.setAttribute('material', {
      color,
      opacity: 0.30,
      metalness: 0,
      roughness: 1
    });

    // emoji sprite
    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', 0.78);
    sprite.setAttribute('height', 0.78);
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

    const kind  = el.dataset.kind  || 'junk';
    const emoji = el.dataset.emoji || '';
    const spawnTime = parseInt(el.dataset.spawnTime || '0', 10) || 0;
    const rtMs = spawnTime ? (Date.now() - spawnTime) : null;

    const screenPos = projectToScreen(el);
    removeTarget(el);

    // ---------- shield / star / diamond ----------
    if (kind === 'shield') {
      shieldCount += 1;
      if (FeverUI && FeverUI.setShield) FeverUI.setShield(shieldCount);
      coach('ได้เกราะป้องกัน 1 ชิ้น! ถ้าเผลอแตะของขยะจะไม่เสียแต้มทันที 🛡️');
      spawnBonusFx(screenPos.x, screenPos.y, 'shield');
      emitScore();
      logEvent({
        type: 'bonus',
        emoji,
        itemType: 'shield',
        rtMs,
        totalScore: score,
        combo,
        isGood: true
      });
      return;
    }

    if (kind === 'star') {
      const mult = feverActive ? 2 : 1;
      const delta = 80 * mult;
      score += delta;
      coach('ดวงดาวโบนัส! ได้แต้มพิเศษเพิ่มขึ้น ⭐');
      spawnBonusFx(screenPos.x, screenPos.y, 'star');
      emitScore();
      logEvent({
        type: 'bonus',
        emoji,
        itemType: 'star',
        rtMs,
        totalScore: score,
        combo,
        isGood: true,
        scoreDelta: delta
      });
      return;
    }

    if (kind === 'diamond') {
      const mult = feverActive ? 2 : 1;
      const delta = 60 * mult;
      score += delta;
      setFever(fever + 30, 'charge');
      coach('ได้เพชรพลังงาน! Fever ขึ้นไวขึ้น 💎');
      spawnBonusFx(screenPos.x, screenPos.y, 'diamond');
      emitScore();
      logEvent({
        type: 'bonus',
        emoji,
        itemType: 'diamond',
        rtMs,
        totalScore: score,
        combo,
        isGood: true,
        scoreDelta: delta
      });
      return;
    }

    // ---------- good / junk ----------
    if (kind === 'good') {
      goodHit++;

      combo++;
      comboMax = Math.max(comboMax, combo);

      const base = 10 + combo * 2;
      const mult = feverActive ? 2 : 1;
      const delta = base * mult;
      score += delta;

      // judgment ตาม RT / lifetime
      let judgment = 'good';
      if (rtMs != null && TARGET_LIFETIME > 0) {
        const ratio = rtMs / TARGET_LIFETIME;
        if (ratio <= 0.35) judgment = 'perfect';
        else if (ratio <= 0.75) judgment = 'good';
        else judgment = 'late';
      }

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

      spawnHitFx(screenPos.x, screenPos.y, delta, judgment, true);

      emitScore();
      logEvent({
        type: 'hit',
        emoji,
        itemType: 'good',
        rtMs,
        totalScore: score,
        combo,
        isGood: true,
        judgment,
        scoreDelta: delta
      });
    } else { // junk
      // ถ้ามี shield ใช้กันก่อน ไม่เสียแต้ม
      if (shieldCount > 0) {
        shieldCount -= 1;
        if (FeverUI && FeverUI.setShield) FeverUI.setShield(shieldCount);
        coach('โชคดีมีเกราะกันไว้ ของขยะไม่ทำร้ายคะแนนรอบนี้ 🛡️');
        spawnHitFx(screenPos.x, screenPos.y, 0, 'blocked', false);
        emitScore();
        logEvent({
          type: 'hit',
          emoji,
          itemType: 'junk-blocked',
          rtMs,
          totalScore: score,
          combo,
          isGood: false,
          judgment: 'blocked'
        });
        return;
      }

      junkHit++;
      const delta = -8;
      score = Math.max(0, score + delta);
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

      spawnHitFx(screenPos.x, screenPos.y, delta, 'miss', false);

      emitScore();
      logEvent({
        type: 'hit',
        emoji,
        itemType: 'junk',
        rtMs,
        totalScore: score,
        combo,
        isGood: false,
        judgment: 'miss',
        scoreDelta: delta
      });
    }
  }

  // ---------- เป้าหายเพราะหมดเวลา ----------
  function onExpire(el) {
    if (!running || !el) return;
    if (!el.parentNode) return;

    const kind  = el.dataset.kind  || 'junk';
    const emoji = el.dataset.emoji || '';
    const screenPos = projectToScreen(el);

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

      // เอฟเฟกต์ Miss
      spawnHitFx(screenPos.x, screenPos.y, 0, 'miss', false);

      logEvent({
        type: 'expire',
        emoji,
        itemType: 'good',
        rtMs: TARGET_LIFETIME,
        totalScore: score,
        combo,
        isGood: false,
        judgment: 'miss'
      });
    }
    // star / diamond / shield / junk หมดเวลา: ไม่ทำโทษ และไม่ log ก็ได้
  }

  // ---------- สุ่ม spawn ----------
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
    lastDiffKey = d;

    let goalMin, goalMax, comboMin, comboMaxVal;

    if (d === 'easy') {
      SPAWN_INTERVAL  = 1150;
      TARGET_LIFETIME = 1350;
      MAX_ACTIVE      = 3;
      GOOD_RATE       = 0.72;

      TYPE_WEIGHTS = {
        good:    78,
        junk:    14,
        star:     3,
        diamond:  3,
        shield:   2
      };

      goalMin = 14; goalMax = 18;
      comboMin = 3; comboMaxVal = 4;
    } else if (d === 'hard') {
      SPAWN_INTERVAL  = 800;
      TARGET_LIFETIME = 950;
      MAX_ACTIVE      = 5;
      GOOD_RATE       = 0.6;

      TYPE_WEIGHTS = {
        good:    64,
        junk:    22,
        star:     5,
        diamond:  5,
        shield:   4
      };

      goalMin = 22; goalMax = 28;
      comboMin = 6; comboMaxVal = 8;
    } else { // normal
      SPAWN_INTERVAL  = 950;
      TARGET_LIFETIME = 1150;
      MAX_ACTIVE      = 4;
      GOOD_RATE       = 0.66;

      TYPE_WEIGHTS = {
        good:    70,
        junk:    18,
        star:     4,
        diamond:  4,
        shield:   4
      };

      goalMin = 18; goalMax = 22;
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
    shieldCount = 0;

    applyDifficulty(diffKey);

    // reset fever + UI กลาง
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

    logSessionStart(diffKey || 'normal');

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

  function stop(reason) {
    if (!running) return;
    running = false;

    clearInterval(spawnTimer);
    spawnTimer = null;
    if (feverTimer) clearTimeout(feverTimer);
    endFever();

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    coach('จบเกมแล้ว! ดูสรุปคะแนนด้านบนได้เลย 🎉');
    emitEnd();
    logSessionEnd(reason || 'normal-end');
  }

  return { start, stop };
})();
