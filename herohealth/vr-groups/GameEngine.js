// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Emoji Pop Targets (แบบง่าย ใช้ร่วม HUD + Fever เดิม)
// สร้างเป้า emoji ในฉาก A-Frame เหมือน GoodJunk VR
// ผูกเป็น window.GroupsVR.GameEngine ให้ groups-vr.html ใช้งานได้เลย

'use strict';

window.GroupsVR = window.GroupsVR || {};

window.GroupsVR.GameEngine = (function () {
  const A = window.AFRAME;
  if (!A) {
    console.error('[FoodGroupsVR] AFRAME not found');
    return { start () {}, stop () {} };
  }

  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar () {},
      setFever () {},
      setFeverActive () {},
      setShield () {}
    };

  // ---------- ชุด emoji: หมู่อาหารหลัก vs ของขยะ ----------
  const GOOD = [
    // ข้าว-แป้ง
    '🍚','🍞','🥖','🥐','🥯',
    // โปรตีน
    '🍗','🥩','🍖','🐟','🍳',
    // นม
    '🥛','🧀',
    // ผัก-ผลไม้
    '🥦','🥕','🍅','🥬','🍎','🍌','🍊','🍇'
  ];

  const JUNK = [
    '🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧋','🥤','🍫'
  ];

  // ---------- state หลัก ----------
  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  // quest แบบง่าย: 1 goal + 1 mini
  let goalTarget = 0;
  let goalProg   = 0;

  let miniNeedCombo = 0;
  let miniDone = false;

  // difficulty
  let SPAWN_INTERVAL  = 1000;
  let TARGET_LIFETIME = 1300;
  let MAX_ACTIVE      = 4;
  let currentDiff     = 'normal';

  // fever ง่าย ๆ
  const FEVER_MAX        = 100;
  const FEVER_HIT_GAIN   = 16;
  const FEVER_MISS_LOSS  = 30;
  const FEVER_DURATION   = 5000; // ms
  let fever = 0;
  let feverActive = false;
  let feverTimer = null;

  // session id สำหรับ logger
  let sessionId = '';
  let sessionStart = null;

  // ---------- emoji → texture (ใช้ canvas ในไฟล์นี้เลย) ----------
  const emojiTexCache = new Map();

  function getEmojiTexture (ch) {
    if (emojiTexCache.has(ch)) return emojiTexCache.get(ch);

    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.clearRect(0, 0, 256, 256);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font =
      '200px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
    ctx.fillText(ch, 128, 140);

    const url = cv.toDataURL('image/png');
    emojiTexCache.set(ch, url);
    return url;
  }

  // ---------- helpers ----------
  function emit (type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function coach (text) {
    if (!text) return;
    emit('hha:coach', { text });
  }

  function emitScore () {
    emit('hha:score', { score, combo, misses });
  }

  function emitMiss () {
    emit('hha:miss', { misses });
  }

  function emitJudge (label) {
    emit('hha:judge', { label });
  }

  function clamp (v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function setFeverValue (value, stateHint) {
    fever = clamp(value, 0, FEVER_MAX);
    if (FeverUI.setFever) FeverUI.setFever(fever);
    emit('hha:fever', {
      state: stateHint || (feverActive ? 'active' : 'charge'),
      value: fever,
      max: FEVER_MAX
    });
  }

  function startFever () {
    if (feverActive) return;
    feverActive = true;
    setFeverValue(FEVER_MAX, 'start');
    if (FeverUI.setFeverActive) FeverUI.setFeverActive(true);
    emit('hha:fever', { state: 'start', value: FEVER_MAX, max: FEVER_MAX });

    if (feverTimer) clearTimeout(feverTimer);
    feverTimer = setTimeout(() => {
      endFever();
    }, FEVER_DURATION);
  }

  function endFever () {
    if (!feverActive) return;
    feverActive = false;
    if (FeverUI.setFeverActive) FeverUI.setFeverActive(false);
    setFeverValue(0, 'end');
    emit('hha:fever', { state: 'end', value: 0, max: FEVER_MAX });
  }

  // ---------- Quest HUD ----------
  function pushQuest (hint) {
    const goalDone = goalProg >= goalTarget && goalTarget > 0;
    const miniProg = miniDone ? 1 : 0;

    const goalObj = {
      id: 'G1',
      label: `เก็บอาหารดีให้ครบ ${goalTarget} ชิ้น`,
      prog: Math.min(goalProg, goalTarget),
      target: goalTarget,
      done: goalDone
    };

    const miniObj = {
      id: 'M1',
      label: `คอมโบให้ถึง x${miniNeedCombo} อย่างน้อย 1 ครั้ง`,
      prog: miniProg,
      target: 1,
      done: miniDone
    };

    emit('quest:update', {
      goal: goalObj,
      mini: miniObj,
      goalsAll: [goalObj],
      minisAll: [miniObj],
      hint: hint || ''
    });

    if (goalDone && miniDone && running) {
      // จบทุกภารกิจ → ฉลอง + stop เกม
      emit('quest:all-complete', {
        goalsTotal: 1,
        minisTotal: 1
      });
      coach('สุดยอด! ทำภารกิจหลักและ Mini quest ครบแล้ว 🎉');
      stop('quest-complete');
    }
  }

  // ---------- ลบเป้า ----------
  function removeTarget (el) {
    activeTargets = activeTargets.filter(t => t !== el);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ---------- สร้างเป้าใน A-Frame ----------
  function createTargetEntity (emoji, kind) {
    if (!sceneEl) return null;

    const root = document.createElement('a-entity');

    const x = -1.2 + Math.random() * 2.4;  // [-1.2, 1.2]
    const y = 1.8  + Math.random() * 1.2;  // [1.8, 3.0]
    const z = -3.2;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;
    root.dataset.spawnAt = String(performance.now() || Date.now());

    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', kind === 'good' ? 0.45 : 0.40);
    circle.setAttribute('material', {
      color: kind === 'good' ? '#22c55e' : '#f97316',
      opacity: 0.32,
      metalness: 0,
      roughness: 1
    });

    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', 0.75);
    sprite.setAttribute('height', 0.75);
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

  // ---------- เมื่อโดนเป้า ----------
  function onHit (el) {
    if (!running || !el || !el.parentNode) return;

    const kind = el.dataset.kind || 'good';
    const emoji = el.dataset.emoji || '';

    removeTarget(el);

    if (kind === 'good') {
      goalProg += 1;

      combo += 1;
      comboMax = Math.max(comboMax, combo);

      const base = 10 + combo * 2;
      const mult = feverActive ? 2 : 1;
      const before = score;
      score += base * mult;
      const gain = score - before;

      // ชาร์จ fever
      const nextFever = fever + FEVER_HIT_GAIN;
      if (!feverActive && nextFever >= FEVER_MAX) {
        startFever();
      } else {
        setFeverValue(nextFever, 'charge');
      }

      // mini quest จากคอมโบ
      if (!miniDone && combo >= miniNeedCombo) {
        miniDone = true;
        coach(`สุดยอด! ทำคอมโบถึง x${miniNeedCombo} แล้ว 🎯`);
      } else if (combo === 1) {
        coach('เริ่มคอมโบแล้ว เลือกอาหารดีต่อไปเรื่อย ๆ เลย 🥦🍎');
      }

      emitScore();
      emitJudge('Good +' + gain);
      pushQuest('');
    } else {
      // junk
      misses += 1;
      combo = 0;
      const before = score;
      score = Math.max(0, score - 8);
      const loss = score - before;

      const nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
      } else {
        setFeverValue(nextFever, 'charge');
      }

      coach('โดนของขยะแล้ว ระวังพวก 🍔🍟🍩 ให้มากขึ้นนะ');
      emitMiss();
      emitScore();
      emitJudge('Miss ' + loss);
      pushQuest('');
    }

    // event สำหรับ logger (แบบย่อ)
    emit('hha:event', {
      sessionId,
      mode: 'FoodGroupsVR',
      difficulty: currentDiff,
      type: kind === 'good' ? 'hit-good' : 'hit-junk',
      emoji,
      itemType: kind,
      totalScore: score,
      combo,
      misses
    });
  }

  // ---------- เป้าหมดเวลา ----------
  function onExpire (el) {
    if (!running || !el || !el.parentNode) return;

    const kind = el.dataset.kind || 'good';
    const emoji = el.dataset.emoji || '';

    removeTarget(el);

    if (kind === 'good') {
      misses += 1;
      combo = 0;

      const nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
      } else {
        setFeverValue(nextFever, 'charge');
      }

      coach(`พลาด ${emoji} ไป ลองเล็งให้ตรงขึ้นอีกนิดนะ 😊`);
      emitMiss();
      emitScore();
      emitJudge('Miss');
      pushQuest('');
    }

    emit('hha:event', {
      sessionId,
      mode: 'FoodGroupsVR',
      difficulty: currentDiff,
      type: 'expire-' + kind,
      emoji,
      itemType: kind,
      totalScore: score,
      combo,
      misses
    });
  }

  // ---------- สุ่มชนิดเป้า + spawn ----------
  function pickType () {
    // สัดส่วนของดีเยอะหน่อย
    return Math.random() < 0.78 ? 'good' : 'junk';
  }

  function tickSpawn () {
    if (!running) return;
    if (activeTargets.length >= MAX_ACTIVE) return;

    const type = pickType();
    const emoji = (type === 'good'
      ? GOOD[Math.floor(Math.random() * GOOD.length)]
      : JUNK[Math.floor(Math.random() * JUNK.length)]
    );

    const el = createTargetEntity(emoji, type);
    if (el) activeTargets.push(el);
  }

  // ---------- ตั้งค่า difficulty ----------
  function applyDifficulty (diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    currentDiff = d;

    if (d === 'easy') {
      SPAWN_INTERVAL  = 1300;
      TARGET_LIFETIME = 1600;
      MAX_ACTIVE      = 3;
      goalTarget      = 14;
      miniNeedCombo   = 3;
    } else if (d === 'hard') {
      SPAWN_INTERVAL  = 800;
      TARGET_LIFETIME = 1100;
      MAX_ACTIVE      = 5;
      goalTarget      = 26;
      miniNeedCombo   = 6;
    } else {
      SPAWN_INTERVAL  = 1000;
      TARGET_LIFETIME = 1300;
      MAX_ACTIVE      = 4;
      goalTarget      = 20;
      miniNeedCombo   = 4;
    }
  }

  // ---------- start / stop ----------
  function start (diffKey) {
    if (running) return;

    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[FoodGroupsVR] ไม่พบ <a-scene>');
      return;
    }

    running = true;
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    fever = 0;
    feverActive = false;
    if (feverTimer) clearTimeout(feverTimer);

    goalProg = 0;
    miniDone = false;

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    sessionId = 'fgvr-' + Date.now().toString(36) + '-' +
      Math.random().toString(16).slice(2, 8);
    sessionStart = new Date();

    applyDifficulty(diffKey);

    if (FeverUI.ensureFeverBar) FeverUI.ensureFeverBar();
    if (FeverUI.setFever)       FeverUI.setFever(0);
    if (FeverUI.setFeverActive) FeverUI.setFeverActive(false);

    emitScore();
    emitJudge('');
    coach('แตะอาหารดีจากแต่ละหมู่ให้ครบตามภารกิจเลย ✨');
    pushQuest('เริ่มเกม');

    tickSpawn();
    spawnTimer = setInterval(tickSpawn, SPAWN_INTERVAL);
  }

  function stop (reason) {
    if (!running) return;
    running = false;

    clearInterval(spawnTimer);
    spawnTimer = null;

    if (feverTimer) clearTimeout(feverTimer);
    endFever();

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    coach('จบเกมแล้ว! ดูสรุปคะแนนด้านบนได้เลย 🎉');

    emit('hha:end', {
      mode: 'FoodGroupsVR',
      score,
      comboMax,
      misses,
      goalsCleared: goalProg >= goalTarget ? 1 : 0,
      goalsTotal: 1,
      miniCleared: miniDone ? 1 : 0,
      miniTotal: 1,
      reason: reason || 'normal'
    });

    try {
      const endTime = new Date();
      const durationSecPlayed = sessionStart
        ? Math.round((endTime - sessionStart) / 1000)
        : 0;

      emit('hha:session', {
        sessionId,
        mode: 'FoodGroupsVR',
        difficulty: currentDiff,
        startTimeIso: sessionStart ? sessionStart.toISOString() : '',
        endTimeIso: endTime.toISOString(),
        durationSecPlayed,
        scoreFinal: score,
        comboMax,
        misses,
        goalsCleared: goalProg >= goalTarget ? 1 : 0,
        goalsTotal: 1,
        miniCleared: miniDone ? 1 : 0,
        miniTotal: 1,
        reason: reason || 'normal'
      });
    } catch (err) {
      console.warn('[FoodGroupsVR] emit session error', err);
    }
  }

  return { start, stop };
})();
