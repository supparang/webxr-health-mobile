// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Emoji Pop Targets + 2 Goals + 3 Mini Quests
// เดินตามเพลง 5 หมู่ + ใช้ร่วม HUD + Fever เดิม (GoodJunkVR Style)
// ไม่ใช้ import/export — ผูกเป็น window.GroupsVR.GameEngine

'use strict';

window.GroupsVR = window.GroupsVR || {};

window.GroupsVR.GameEngine = (function () {
  const A = window.AFRAME;
  if (!A) {
    console.error('[FoodGroupsVR] AFRAME not found');
    return { start () {}, stop () {} };
  }

  // ---------- Fever UI (shared) ----------
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar () {},
      setFever () {},
      setFeverActive () {},
      setShield () {}
    };

  // ---------- 5 หมู่หลัก + JUNK ----------
  const FOOD_GROUPS = {
    1: ['🍗','🥩','🍖','🍳','🥛','🧀','🥜'],        // หมู่ 1 เนื้อ นม ไข่ ถั่ว
    2: ['🍚','🍞','🥖','🥐','🥯','🥔'],            // หมู่ 2 ข้าว แป้ง เผือก มัน
    3: ['🥦','🥕','🥬','🍅'],                      // หมู่ 3 ผัก
    4: ['🍎','🍌','🍊','🍇','🍓','🍉','🍍'],        // หมู่ 4 ผลไม้
    5: ['🧈','🥓','🥞','🥐','🥑','🌰']             // หมู่ 5 ไขมัน/น้ำมัน (แทนสัญลักษณ์)
  };

  const JUNK = ['🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧋','🥤','🍫'];

  // ---------- state หลัก ----------
  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  // metrics เบื้องต้นสำหรับวิจัย
  let nTargetGoodSpawned = 0;
  let nTargetJunkSpawned = 0;
  let nHitGood = 0;
  let nHitJunk = 0;
  let nExpireGood = 0;

  // Fever
  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 16;
  const FEVER_MISS_LOSS = 30;
  const FEVER_DURATION  = 5000; // ms
  let fever = 0;
  let feverActive = false;
  let feverTimer = null;

  // difficulty
  let SPAWN_INTERVAL  = 1000;
  let TARGET_LIFETIME = 1300;
  let MAX_ACTIVE      = 4;
  let currentDiff     = 'normal';

  // session / runMode
  let sessionId = '';
  let sessionStart = null;
  let sessionStartMs = 0;
  let currentRunMode = 'play';
  let hasEnded = false;

  // ---------- Quest: 2 Goals + 3 Minis ----------
  let goals = [];
  let minis = [];
  let currentGoalIndex = 0;
  let currentMiniIndex = 0;
  let miniComboNeed = 5;
  let questsFinished = false;

  // ---------- emoji → texture ----------
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

  function nowMs () {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
  }

  function elapsedFromStartMs () {
    if (!sessionStartMs) return '';
    return Math.round(nowMs() - sessionStartMs);
  }

  // ---------- Fever ----------
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

  // ---------- Quest helpers ----------
  function currentGoal () {
    return goals[currentGoalIndex] || null;
  }

  function currentMini () {
    return minis[currentMiniIndex] || null;
  }

  function countDone (list) {
    return list.filter(q => q && q.done).length;
  }

  function allQuestsDone () {
    const goalsTotal = goals.length;
    const minisTotal = minis.length;
    const goalsDone = goalsTotal > 0 && goals.every(g => g.done);
    const minisDone = minisTotal > 0 && minis.every(m => m.done);
    return goalsTotal > 0 && minisTotal > 0 && goalsDone && minisDone;
  }

  function pushQuest (hint) {
    const g = currentGoal();
    const m = currentMini();

    let goalObj;
    if (g) {
      goalObj = {
        id: g.id,
        label: g.label,
        prog: Math.min(g.prog, g.target),
        target: g.target,
        done: g.done
      };
    } else {
      goalObj = {
        id: 'ALL',
        label: 'ภารกิจหลักครบแล้ว 🎉',
        prog: 1,
        target: 1,
        done: true
      };
    }

    let miniObj;
    if (m) {
      miniObj = {
        id: m.id,
        label: m.label,
        prog: Math.min(m.prog, m.target),
        target: m.target,
        done: m.done
      };
    } else {
      miniObj = {
        id: 'ALL',
        label: 'Mini quest ครบแล้ว ✅',
        prog: 1,
        target: 1,
        done: true
      };
    }

    emit('quest:update', {
      goal: goalObj,
      mini: miniObj,
      goalsAll: goals.map(x => ({
        id: x.id,
        label: x.label,
        prog: x.prog,
        target: x.target,
        done: x.done
      })),
      minisAll: minis.map(x => ({
        id: x.id,
        label: x.label,
        prog: x.prog,
        target: x.target,
        done: x.done
      })),
      hint: hint || ''
    });

    // จบทุกภารกิจ → ฉลองใหญ่ก่อนจบเกม
    if (allQuestsDone() && running && !questsFinished) {
      questsFinished = true;
      emit('quest:all-complete', {
        goalsTotal: goals.length,
        minisTotal: minis.length
      });

      coach('สุดยอด! ทำภารกิจทั้ง 5 หมู่ครบทุกข้อแล้ว 🎉');
      running = false;
      clearInterval(spawnTimer);
      if (feverTimer) clearTimeout(feverTimer);
      activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
      activeTargets = [];

      // หน่วงให้ effect ฉลองทำงานก่อน แล้วค่อยยิง end → เปิดหน้าสรุป
      setTimeout(() => {
        emitEnd('quest-complete');
      }, 900);
    }
  }

  function updateGoalFromGoodHit () {
    const g = currentGoal();
    if (!g || g.done) return;

    g.prog += 1;
    if (g.prog >= g.target) {
      g.prog = g.target;
      g.done = true;
      const doneCount = countDone(goals);
      const total = goals.length;

      // ฉลองจบ goal
      emit('quest:celebrate', {
        kind: 'goal',
        id: g.id,
        label: g.label,
        index: doneCount,
        total
      });

      if (doneCount < total) {
        currentGoalIndex = doneCount;

        // เดินตามเพลง 5 หมู่
        const verse = (doneCount === 1)
          ? 'หมู่ 3 มีผักต่าง ๆ สีเขียวเหลืองบ้างมีวิตามิน 🥦🥕'
          : 'หมู่ 4 มีผลไม้มากมาย กินประจำให้ร่างกายสดชื่น 🍎🍇';

        coach(`Goal ${doneCount} สำเร็จแล้ว! ${verse}`);
        pushQuest('Goal ถัดไปเริ่มแล้ว');
      } else {
        coach('Goal ครบทั้ง 2 ภารกิจแล้ว 🎉');
        pushQuest('Goals ครบแล้ว');
      }
    } else {
      pushQuest('');
    }
  }

  function updateMiniFromCombo () {
    const m = currentMini();
    if (!m || m.done) return;

    const need = m.comboNeed || miniComboNeed || 5;
    if (combo >= need) {
      m.prog = 1;
      m.done = true;

      const doneCount = countDone(minis);
      const total = minis.length;

      emit('quest:celebrate', {
        kind: 'mini',
        id: m.id,
        label: m.label,
        index: doneCount,
        total
      });

      // โค้ชพูดตามหมู่
      let verse = '';
      if (m.id === 'M1') {
        verse = 'หมู่ 2 ข้าวแป้งเผือกมันและน้ำตาลเพิ่มพลัง 🍚🍞🥔';
      } else if (m.id === 'M2') {
        verse = 'หมู่ 4 มีผลไม้ทั้งอาหารมากมายกินเป็นอาจิณ 🍊🍎🍇';
      } else if (m.id === 'M3') {
        verse = 'หมู่ 5 อย่าได้ลืมกินไขมันทั้งสิ้นอบอุ่นร่างกาย 🧈🥑';
      }
      coach(`Mini quest สำเร็จ! ${verse}`);

      if (doneCount < total) {
        currentMiniIndex = doneCount;
        const next = currentMini();
        miniComboNeed = (next && next.comboNeed) ? next.comboNeed : miniComboNeed;
        pushQuest('Mini quest ถัดไปเริ่มแล้ว');
      } else {
        pushQuest('Mini quests ครบแล้ว');
      }
    } else {
      pushQuest('');
    }
  }

  function buildSessionMetrics () {
    return {
      nTargetGoodSpawned,
      nTargetJunkSpawned,
      nHitGood,
      nHitJunk,
      nExpireGood
    };
  }

  // ---------- logger event ----------
  function emitGameEvent (base) {
    const timeFromStartMs = elapsedFromStartMs();
    const g = currentGoal();
    const m = currentMini();

    let goalProgress = '';
    if (g) {
      goalProgress = `${g.prog}/${g.target}`;
    } else if (goals.length) {
      goalProgress = `${countDone(goals)}/${goals.length}`;
    }

    let miniProgress = '';
    if (m) {
      miniProgress = `${m.prog}/${m.target}`;
    } else if (minis.length) {
      miniProgress = `${countDone(minis)}/${minis.length}`;
    }

    emit('hha:event', {
      sessionId,
      mode: 'FoodGroupsVR',
      runMode: currentRunMode,
      difficulty: currentDiff,
      timeFromStartMs,
      goalProgress,
      miniProgress,
      ...base
    });
  }

  function emitEnd (reason) {
    if (hasEnded) return;
    hasEnded = true;

    const goalsTotal = goals.length;
    const minisTotal = minis.length;
    const goalsCleared = countDone(goals);
    const miniCleared  = countDone(minis);

    const metrics = buildSessionMetrics();

    emit('hha:end', {
      mode: 'FoodGroupsVR',
      runMode: currentRunMode,
      score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal: minisTotal,
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
        runMode: currentRunMode,
        difficulty: currentDiff,
        startTimeIso: sessionStart ? sessionStart.toISOString() : '',
        endTimeIso: endTime.toISOString(),
        durationSecPlayed,
        scoreFinal: score,
        comboMax,
        misses,
        goalsCleared,
        goalsTotal,
        miniCleared,
        miniTotal: minisTotal,
        reason: reason || 'normal',
        ...metrics
      });
    } catch (err) {
      console.warn('[FoodGroupsVR] emit session error', err);
    }
  }

  // ---------- ลบเป้า ----------
  function removeTarget (el) {
    activeTargets = activeTargets.filter(t => t !== el);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ---------- สร้าง emoji target ใน A-Frame ----------
  function createTargetEntity (emoji, kind, foodGroup) {
    if (!sceneEl) return null;

    const root = document.createElement('a-entity');

    const x = -1.3 + Math.random() * 2.6;  // [-1.3, 1.3]
    const y = 2.0  + Math.random() * 1.0;  // [2.0, 3.0]
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.classList.add('fg-target');
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;
    root.dataset.group = foodGroup != null ? String(foodGroup) : '';
    root.dataset.spawnAt = String(nowMs());

    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', kind === 'good' ? 0.42 : 0.38);
    circle.setAttribute('material', {
      color: kind === 'good' ? '#22c55e' : '#f97316',
      opacity: 0.30,
      metalness: 0,
      roughness: 1
    });

    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', 0.72);
    sprite.setAttribute('height', 0.72);
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

  function getParticles () {
    return (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
           window.Particles ||
           null;
  }

  // ---------- ยิงโดน ----------
  function onHit (el) {
    if (!running || !el || !el.parentNode) return;

    const kind = el.dataset.kind || 'good';
    const emoji = el.dataset.emoji || '';

    removeTarget(el);

    if (kind === 'good') {
      nHitGood++;

      const beforeScore = score;

      combo += 1;
      comboMax = Math.max(comboMax, combo);

      const base = 10 + combo * 2;
      const mult = feverActive ? 2 : 1;
      score += base * mult;
      const gain = score - beforeScore;

      const nextFever = fever + FEVER_HIT_GAIN;
      if (!feverActive && nextFever >= FEVER_MAX) {
        startFever();
      } else {
        setFeverValue(nextFever, 'charge');
      }

      if (combo === 1) {
        coach('เริ่มคอมโบแล้ว ลองเก็บอาหารดีต่อเนื่องให้ได้หลายชิ้นเลย 🥦🍎');
      }

      updateGoalFromGoodHit();
      updateMiniFromCombo();

      emitScore();
      emitJudge('Good +' + gain);

      emitGameEvent({
        type: 'hit-good',
        eventType: 'hit-good',
        emoji,
        itemType: 'good',
        totalScore: score,
        combo,
        misses
      });

      const P = getParticles();
      if (P) {
        const pos = { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
        P.burstAt(pos.x, pos.y, {
          color: '#22c55e',
          count: 20,
          radius: 70
        });
        P.scorePop(pos.x, pos.y, '+' + gain, {
          kind: 'score',
          judgment: 'GOOD',
          good: true
        });
      }
    } else {
      nHitJunk++;

      const beforeScore = score;
      misses += 1;
      combo = 0;
      score = Math.max(0, score - 8);
      const loss = score - beforeScore;

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFeverValue(nextFever, 'charge');
      }

      coach('โดนของขยะแล้ว ระวังพวก 🍔🍟🍩 ให้มากขึ้นนะ');
      emitMiss();
      emitScore();
      emitJudge('Miss ' + loss);
      pushQuest('');

      emitGameEvent({
        type: 'hit-junk',
        eventType: 'hit-junk',
        emoji,
        itemType: 'junk',
        totalScore: score,
        combo,
        misses
      });

      const P = getParticles();
      if (P) {
        const pos = { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
        P.burstAt(pos.x, pos.y, {
          color: '#f97316',
          count: 16,
          radius: 50
        });
        P.scorePop(pos.x, pos.y, 'MISS', {
          kind: 'judge',
          judgment: 'MISS',
          good: false
        });
      }
    }
  }

  // ---------- เป้าหมดเวลา ----------
  function onExpire (el) {
    if (!running || !el || !el.parentNode) return;

    const kind = el.dataset.kind || 'good';
    const emoji = el.dataset.emoji || '';

    removeTarget(el);

    if (kind === 'good') {
      nExpireGood++;
      misses += 1;
      combo = 0;

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFeverValue(nextFever, 'charge');
      }

      coach(`พลาด ${emoji} ไป ลองเล็งให้ตรงขึ้นอีกนิดนะ 😊`);
      emitMiss();
      emitScore();
      emitJudge('Miss');
      pushQuest('');

      emitGameEvent({
        type: 'expire-good',
        eventType: 'expire-good',
        emoji,
        itemType: 'good',
        totalScore: score,
        combo,
        misses
      });
    } else {
      emitGameEvent({
        type: 'expire-' + kind,
        eventType: 'expire-' + kind,
        emoji,
        itemType: kind,
        totalScore: score,
        combo,
        misses
      });
    }
  }

  // ---------- สุ่ม emoji ----------
  function pickGoodEmoji () {
    const groupKeys = Object.keys(FOOD_GROUPS);
    const idxGroup = Math.floor(Math.random() * groupKeys.length);
    const gKey = parseInt(groupKeys[idxGroup], 10);
    const pool = FOOD_GROUPS[gKey] || FOOD_GROUPS[1];
    const emoji = pool[Math.floor(Math.random() * pool.length)];
    return { emoji, group: gKey };
  }

  function pickType () {
    // ของดีเยอะกว่า
    return Math.random() < 0.78 ? 'good' : 'junk';
  }

  function tickSpawn () {
    if (!running) return;
    if (activeTargets.length >= MAX_ACTIVE) return;

    const type = pickType();
    if (type === 'good') {
      const info = pickGoodEmoji();
      const el = createTargetEntity(info.emoji, 'good', info.group);
      if (el) {
        activeTargets.push(el);
        nTargetGoodSpawned++;
      }
    } else {
      const emoji = JUNK[Math.floor(Math.random() * JUNK.length)];
      const el = createTargetEntity(emoji, 'junk', 0);
      if (el) {
        activeTargets.push(el);
        nTargetJunkSpawned++;
      }
    }
  }

  // ---------- สร้าง 2 Goals + 3 Minis ตาม diff ----------
  function setupQuestsForDifficulty (d) {
    goals = [];
    minis = [];
    currentGoalIndex = 0;
    currentMiniIndex = 0;

    let g1, g2, c1, c2, c3;
    if (d === 'easy') {
      g1 = 12;
      g2 = 16;
      c1 = 3;
      c2 = 4;
      c3 = 5;
    } else if (d === 'hard') {
      g1 = 22;
      g2 = 26;
      c1 = 5;
      c2 = 7;
      c3 = 8;
    } else {
      g1 = 18;
      g2 = 22;
      c1 = 4;
      c2 = 6;
      c3 = 7;
    }

    goals.push(
      {
        id: 'G1',
        label: `Goal 1: เก็บอาหารดีจากทุกหมู่ให้ครบ ${g1} ชิ้น`,
        target: g1,
        prog: 0,
        done: false
      },
      {
        id: 'G2',
        label: `Goal 2: เก็บอาหารดีเพิ่มรวมให้ครบ ${g2} ชิ้น`,
        target: g2,
        prog: 0,
        done: false
      }
    );

    minis.push(
      {
        id: 'M1',
        label: `Mini 1: คอมโบให้ถึง x${c1} อย่างน้อย 1 ครั้ง (หมู่ 1–2)`,
        target: 1,
        prog: 0,
        done: false,
        comboNeed: c1
      },
      {
        id: 'M2',
        label: `Mini 2: คอมโบให้ถึง x${c2} อย่างน้อย 1 ครั้ง (หมู่ 3–4)`,
        target: 1,
        prog: 0,
        done: false,
        comboNeed: c2
      },
      {
        id: 'M3',
        label: `Mini 3: คอมโบให้ถึง x${c3} อย่างน้อย 1 ครั้ง (หมู่ 5 + รวม)`,
        target: 1,
        prog: 0,
        done: false,
        comboNeed: c3
      }
    );

    const firstMini = minis[0] || null;
    miniComboNeed = firstMini ? firstMini.comboNeed : 5;
  }

  function applyDifficulty (diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    currentDiff = d;

    if (d === 'easy') {
      SPAWN_INTERVAL  = 1300;
      TARGET_LIFETIME = 1600;
      MAX_ACTIVE      = 3;
    } else if (d === 'hard') {
      SPAWN_INTERVAL  = 800;
      TARGET_LIFETIME = 1100;
      MAX_ACTIVE      = 5;
    } else {
      SPAWN_INTERVAL  = 1000;
      TARGET_LIFETIME = 1300;
      MAX_ACTIVE      = 4;
    }

    setupQuestsForDifficulty(d);
  }

  function detectRunMode () {
    try {
      const url = new URL(window.location.href);
      const raw = (url.searchParams.get('run') || 'play').toLowerCase();
      return raw === 'research' ? 'research' : 'play';
    } catch (err) {
      return 'play';
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
    hasEnded = false;
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    fever = 0;
    feverActive = false;
    if (feverTimer) clearTimeout(feverTimer);

    nTargetGoodSpawned = 0;
    nTargetJunkSpawned = 0;
    nHitGood = 0;
    nHitJunk = 0;
    nExpireGood = 0;

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    sessionId = 'fgvr-' + Date.now().toString(36) + '-' +
      Math.random().toString(16).slice(2, 8);
    sessionStart = new Date();
    sessionStartMs = nowMs();
    currentRunMode = detectRunMode();
    questsFinished = false;

    applyDifficulty(diffKey);

    if (FeverUI.ensureFeverBar) FeverUI.ensureFeverBar();
    if (FeverUI.setFever)       FeverUI.setFever(0);
    if (FeverUI.setFeverActive) FeverUI.setFeverActive(false);

    emitScore();
    emitJudge('');

    // เปิดด้วยเพลงหมู่ 1
    coach('หมู่ 1 มีเนื้อนมไข่ถั่วเมล็ดช่วยให้เติบโตแข็งแรง 🥩🥚🥛 ลองเก็บอาหารดีทีละหมู่ไปพร้อมเพลงกันเลย 🎵');

    pushQuest('เริ่มภารกิจ 5 หมู่');

    tickSpawn();
    spawnTimer = setInterval(tickSpawn, SPAWN_INTERVAL);
  }

  function stop (reason) {
    // ถ้า engine ยิง end ไปแล้วจาก quest-complete ก็ไม่ต้องทำซ้ำ
    if (!running && hasEnded) return;

    running = false;
    clearInterval(spawnTimer);
    spawnTimer = null;

    if (feverTimer) clearTimeout(feverTimer);
    endFever();

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    coach('จบเกมแล้ว! ดูสรุปคะแนนด้านบนได้เลย 🎉');
    emitEnd(reason || 'manual-stop');
  }

  return { start, stop };
})();
