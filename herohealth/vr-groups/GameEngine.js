// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Emoji Pop Targets + 5 หมู่โภชนาการไทย (เดินตามเพลงทีละหมู่)
// - เป้า Emoji โผล่ใน A-Frame เหมือน GoodJunk VR
// - Quest: 5 Goals ตามหมู่ 1–5 + Mini quest คอมโบ
// - Coach script พูดตามเพลง: หมู่ 1..5
//
// NOTE: ไม่ใช้ import/export, ผูกเป็น window.GroupsVR.GameEngine

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

  // --------------------------------------------------
  //    กลุ่มอาหาร 5 หมู่ (อิงเพลงโภชนาการไทย)
  // --------------------------------------------------
  const GROUP_SONG_LINES = {
    1: 'หมู่ 1 มีเนื้อ นม ไข่ ถั่วเมล็ด ช่วยให้เติบโตแข็งแรง 💪',
    2: 'หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล เพิ่มพลังให้ร่างกาย ⚡',
    3: 'หมู่ 3 ผักต่าง ๆ สีเขียวเหลือง มีวิตามินและใยอาหาร 🥦',
    4: 'หมู่ 4 ผลไม้หลากสี สดชื่นและดีต่อสุขภาพ 🍎🍌🍊',
    5: 'หมู่ 5 ไขมันและน้ำมัน ช่วยให้อบอุ่น แต่กินแต่พอดีนะ 🥑🧈'
  };

  // goodEmojis แบ่งตามหมู่ 1–5
  const FOOD_GROUPS = [
    {
      id: 1,
      labelShort: 'หมู่ 1 โปรตีน',
      goodEmojis: [
        '🍗','🥩','🍖','🐟','🍤','🍳',
        '🥛','🧀','🥜'
      ]
    },
    {
      id: 2,
      labelShort: 'หมู่ 2 พลังงาน',
      goodEmojis: [
        '🍚','🍞','🥖','🥐','🥯','🧇',
        '🥨','🥟','🍙','🍘'
      ]
    },
    {
      id: 3,
      labelShort: 'หมู่ 3 ผัก',
      goodEmojis: [
        '🥦','🥕','🍅','🥬','🫑','🧅',
        '🍄'
      ]
    },
    {
      id: 4,
      labelShort: 'หมู่ 4 ผลไม้',
      goodEmojis: [
        '🍎','🍌','🍊','🍇','🍓','🍉',
        '🍍','🥭','🍐','🍑'
      ]
    },
    {
      id: 5,
      labelShort: 'หมู่ 5 ไขมัน',
      goodEmojis: [
        '🥑','🥓','🧈','🫒','🌰'
      ]
    }
  ];

  // ของขยะรวม (ใช้ร่วมทุกหมู่)
  const JUNK = [
    '🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧋','🥤','🍫','🍬'
  ];

  function findGroupConfig (groupId) {
    return FOOD_GROUPS.find(g => g.id === groupId) || FOOD_GROUPS[0];
  }

  // --------------------------------------------------
  // state หลัก
  // --------------------------------------------------
  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  // ----- Quest: 5 Goals ตามหมู่ + 1 Mini (คอมโบ) -----
  let goals = [];
  let currentGoalIndex = 0;

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

  // --------------------------------------------------
  // emoji → texture (ใช้ canvas ในไฟล์นี้เลย)
  // --------------------------------------------------
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

  // --------------------------------------------------
  // helpers + HUD events
  // --------------------------------------------------
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

  // --------------------------------------------------
  // Quest utils (5 หมู่ + Mini)
  // --------------------------------------------------
  function currentGoal () {
    return goals[currentGoalIndex] || null;
  }

  function allGoalsDone () {
    return goals.length > 0 && goals.every(g => g.done);
  }

  function countGoalsCleared () {
    return goals.filter(g => g && g.done).length;
  }

  function setupGoalsForDifficulty (diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    currentDiff = d;
    goals = [];
    currentGoalIndex = 0;

    let g1, g2, g3, g4, g5;
    if (d === 'easy') {
      g1 = 6; g2 = 6; g3 = 5; g4 = 5; g5 = 3;
      SPAWN_INTERVAL  = 1300;
      TARGET_LIFETIME = 1600;
      MAX_ACTIVE      = 3;
      miniNeedCombo   = 3;
    } else if (d === 'hard') {
      g1 = 12; g2 = 12; g3 = 10; g4 = 10; g5 = 5;
      SPAWN_INTERVAL  = 800;
      TARGET_LIFETIME = 1100;
      MAX_ACTIVE      = 5;
      miniNeedCombo   = 6;
    } else {
      // normal
      g1 = 9; g2 = 9; g3 = 8; g4 = 8; g5 = 4;
      SPAWN_INTERVAL  = 1000;
      TARGET_LIFETIME = 1300;
      MAX_ACTIVE      = 4;
      miniNeedCombo   = 4;
    }

    goals.push(
      {
        id: 'G1',
        groupId: 1,
        label: `Goal 1 • หมู่ 1 โปรตีน — เก็บอาหารหมู่ 1 ให้ครบ ${g1} ชิ้น`,
        target: g1,
        prog: 0,
        done: false
      },
      {
        id: 'G2',
        groupId: 2,
        label: `Goal 2 • หมู่ 2 พลังงาน — เก็บหมู่ 2 ให้ครบ ${g2} ชิ้น`,
        target: g2,
        prog: 0,
        done: false
      },
      {
        id: 'G3',
        groupId: 3,
        label: `Goal 3 • หมู่ 3 ผัก — เก็บผักสีเขียวเหลืองให้ครบ ${g3} ชิ้น`,
        target: g3,
        prog: 0,
        done: false
      },
      {
        id: 'G4',
        groupId: 4,
        label: `Goal 4 • หมู่ 4 ผลไม้ — เก็บผลไม้หลากสีให้ครบ ${g4} ชิ้น`,
        target: g4,
        prog: 0,
        done: false
      },
      {
        id: 'G5',
        groupId: 5,
        label: `Goal 5 • หมู่ 5 ไขมัน — รู้จักหมู่ 5 ให้ครบ ${g5} ชิ้น (กินแต่พอดี)`,
        target: g5,
        prog: 0,
        done: false
      }
    );
  }

  function coachIntro () {
    coach('วันนี้เราจะมาเดินตามเพลงโภชนาการไทยทีละหมู่กันนะ 🎵');
    setTimeout(() => {
      coach('ฟังโค้ชดี ๆ แล้วแตะอาหารให้ถูกหมู่ไปทีละขั้น หมู่ 1 ถึงหมู่ 5 เลย!');
    }, 2600);
  }

  function coachGoalStart (g) {
    if (!g) return;
    const groupId = g.groupId || 0;
    const line = GROUP_SONG_LINES[groupId] || '';

    if (groupId === 1) {
      coach(`เริ่มหมู่ 1 เนื้อ นม ไข่ ถั่วเมล็ด ช่วยให้เติบโตแข็งแรง 💪 \nลองเก็บหมู่ 1 ให้ครบตามเป้านะ`);
    } else if (groupId === 2) {
      coach(`ต่อไปหมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล เพิ่มพลังให้ร่างกาย ⚡ \nเลือกแบบไม่หวานจัดเกินไป`);
    } else if (groupId === 3) {
      coach('หมู่ 3 ผักต่าง ๆ สีเขียว เหลือง ช่วยให้ได้วิตามินและใยอาหาร 🥦 ลองเก็บผักให้เยอะ ๆ เลย');
    } else if (groupId === 4) {
      coach('หมู่ 4 ผลไม้หลากสี สดชื่นและดีต่อสุขภาพ 🍎🍌🍊');
    } else if (groupId === 5) {
      coach('หมู่ 5 ไขมันและน้ำมัน ช่วยให้อบอุ่น แต่ต้องกินแต่นิดเดียวพอ 🥑🧈');
    } else if (line) {
      coach(line);
    } else {
      coach('เริ่มภารกิจใหม่แล้ว ลองเก็บอาหารให้ครบตามหมู่ดูนะ!');
    }
  }

  function coachGoalProgress (g) {
    if (!g) return;
    const remain = (g.target | 0) - (g.prog | 0);
    if (remain <= 0) return;
    if (remain === 1) {
      coach(`หมู่ ${g.groupId} เหลืออีกแค่ 1 ชิ้นสุดท้ายแล้ว สุดยอดเลย ✨`);
    } else if (remain <= 3) {
      coach(`อีกแค่ ${remain} ชิ้นก็ครบหมู่ ${g.groupId} แล้ว สู้ ๆ 🔥`);
    }
  }

  function coachGoalComplete (g, cleared, total) {
    if (!g) return;
    const groupId = g.groupId || 0;
    if (groupId === 1) {
      coach('เยี่ยมมาก! หมู่ 1 โปรตีนครบแล้ว ร่างกายแข็งแรง เติบโตดี 💪🎉');
    } else if (groupId === 2) {
      coach('เก่งมาก! หมู่ 2 พลังงานครบแล้ว ⚡ พร้อมไปต่อหมู่ถัดไป');
    } else if (groupId === 3) {
      coach('ภารกิจหมู่ 3 ผักสำเร็จแล้ว ได้วิตามินและใยอาหารเพียบ 🥦✨');
    } else if (groupId === 4) {
      coach('หมู่ 4 ผลไม้ครบแล้ว สดชื่นและได้วิตามินเต็ม ๆ 🍎🍌🍊');
    } else if (groupId === 5) {
      coach('หมู่ 5 ไขมันรู้จักครบแล้ว จำไว้ว่ากินนิดเดียวก็พอนะ 🥑🧈');
    } else {
      coach(`ภารกิจหมู่ ${groupId} สำเร็จแล้ว เยี่ยมมาก 🎉`);
    }

    if (cleared < total) {
      const next = cleared + 1;
      if (next <= 5) {
        setTimeout(() => {
          coach(`พร้อมไปหมู่ ${next} ต่อเลยไหม? ลองนึกคำในเพลงแล้วหาอาหารให้ตรงหมู่ดูนะ 🎵`);
        }, 2600);
      }
    } else {
      // ครบทั้ง 5 หมู่
      setTimeout(() => {
        coach('สุดยอด! ตอนนี้เก็บครบทั้ง 5 หมู่ตามเพลงแล้ว 🎵 ลองจำให้ได้ว่าในจานนึงควรมีอะไรบ้างบ้างนะ');
      }, 2600);
    }
  }

  // push ข้อมูล quest → HUD
  function pushQuest (hint) {
    const g = currentGoal();
    const goalDoneAll = allGoalsDone();
    const miniProg = miniDone ? 1 : 0;

    let goalObj;
    if (g) {
      goalObj = {
        id: g.id,
        label: g.label,
        prog: g.prog,
        target: g.target,
        done: !!g.done
      };
    } else {
      goalObj = {
        id: 'ALL',
        label: 'ครบทั้ง 5 หมู่แล้ว 🎉',
        prog: 1,
        target: 1,
        done: true
      };
    }

    const miniObj = {
      id: 'M1',
      label: `Mini • รักษาคอมโบให้ถึง x${miniNeedCombo} อย่างน้อย 1 ครั้ง`,
      prog: miniProg,
      target: 1,
      done: miniDone
    };

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
      minisAll: [miniObj],
      hint: hint || ''
    });

    if (goalDoneAll && miniDone && running) {
      emit('quest:all-complete', {
        goalsTotal: goals.length,
        minisTotal: 1
      });
      coach('สุดยอด! ทำภารกิจ 5 หมู่และ Mini quest ครบหมดแล้ว 🎉');
      stop('quest-complete');
    }
  }

  // --------------------------------------------------
  // ลบเป้า
  // --------------------------------------------------
  function removeTarget (el) {
    activeTargets = activeTargets.filter(t => t !== el);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // --------------------------------------------------
  // สร้างเป้าใน A-Frame
  // --------------------------------------------------
  function createTargetEntity (emoji, kind, groupId) {
    if (!sceneEl) return null;

    const root = document.createElement('a-entity');

    const x = -1.2 + Math.random() * 2.4;  // [-1.2, 1.2]
    const y = 1.8  + Math.random() * 1.2;  // [1.8, 3.0]
    const z = -3.2;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;
    root.dataset.groupId = groupId ? String(groupId) : '';
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

  // --------------------------------------------------
  // เมื่อโดนเป้า
  // --------------------------------------------------
  function onHit (el) {
    if (!running || !el || !el.parentNode) return;

    const kind = el.dataset.kind || 'good';
    const emoji = el.dataset.emoji || '';
    const groupId = parseInt(el.dataset.groupId || '0', 10) || 0;

    removeTarget(el);

    if (kind === 'good') {
      // ----- อัปเดต goal ตามหมู่ปัจจุบัน -----
      const g = currentGoal();
      if (g && !g.done) {
        g.prog += 1;
        if (g.prog >= g.target) {
          g.prog = g.target;
          g.done = true;
          const cleared = countGoalsCleared();
          const total = goals.length;
          coachGoalComplete(g, cleared, total);

          if (cleared < total) {
            currentGoalIndex = cleared; // ไปหมู่ถัดไป
            const nextGoal = currentGoal();
            setTimeout(() => {
              coachGoalStart(nextGoal);
            }, 2600);
          }
        } else {
          coachGoalProgress(g);
        }
      }

      // ----- คะแนน / คอมโบ / Fever -----
      combo += 1;
      comboMax = Math.max(comboMax, combo);

      const base = 10 + combo * 2;
      const mult = feverActive ? 2 : 1;
      const before = score;
      score += base * mult;
      const gain = score - before;

      // Mini quest: คอมโบถึงเป้า
      if (!miniDone && combo >= miniNeedCombo) {
        miniDone = true;
        coach(`สุดยอด! ทำคอมโบถึง x${miniNeedCombo} แล้ว 🎯`);
      } else if (combo === 1) {
        coach('เริ่มคอมโบแล้ว เลือกอาหารดีต่อไปเรื่อย ๆ เลย 🥦🍎');
      }

      const nextFever = fever + FEVER_HIT_GAIN;
      if (!feverActive && nextFever >= FEVER_MAX) {
        startFever();
      } else {
        setFeverValue(nextFever, 'charge');
      }

      emitScore();
      emitJudge('Good +' + gain);
      pushQuest('');
    } else {
      // ----- junk -----
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

    // event สำหรับ logger (แบบย่อ + groupId)
    emit('hha:event', {
      sessionId,
      mode: 'FoodGroupsVR',
      difficulty: currentDiff,
      type: kind === 'good' ? 'hit-good' : 'hit-junk',
      emoji,
      itemType: kind,
      groupId,
      totalScore: score,
      combo,
      misses
    });
  }

  // --------------------------------------------------
  // เป้าหมดเวลา
  // --------------------------------------------------
  function onExpire (el) {
    if (!running || !el || !el.parentNode) return;

    const kind = el.dataset.kind || 'good';
    const emoji = el.dataset.emoji || '';
    const groupId = parseInt(el.dataset.groupId || '0', 10) || 0;

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
      groupId,
      totalScore: score,
      combo,
      misses
    });
  }

  // --------------------------------------------------
  // สุ่มชนิดเป้า + spawn
  // --------------------------------------------------
  function pickType () {
    // ของดีเยอะหน่อย
    return Math.random() < 0.78 ? 'good' : 'junk';
  }

  function tickSpawn () {
    if (!running) return;
    if (activeTargets.length >= MAX_ACTIVE) return;

    const type = pickType();
    let emoji;
    let groupId = 0;

    if (type === 'good') {
      const g = currentGoal();
      const groupCfg = g ? findGroupConfig(g.groupId) : findGroupConfig(1);
      const arr = groupCfg.goodEmojis;
      emoji = arr[Math.floor(Math.random() * arr.length)];
      groupId = groupCfg.id;
    } else {
      emoji = JUNK[Math.floor(Math.random() * JUNK.length)];
      groupId = 0;
    }

    const el = createTargetEntity(emoji, type, groupId);
    if (el) activeTargets.push(el);
  }

  // --------------------------------------------------
  // start / stop
  // --------------------------------------------------
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

    miniDone = false;
    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    sessionId = 'fgvr-' + Date.now().toString(36) + '-' +
      Math.random().toString(16).slice(2, 8);
    sessionStart = new Date();

    setupGoalsForDifficulty(diffKey);

    if (FeverUI.ensureFeverBar) FeverUI.ensureFeverBar();
    if (FeverUI.setFever)       FeverUI.setFever(0);
    if (FeverUI.setFeverActive) FeverUI.setFeverActive(false);

    emitScore();
    emitJudge('');
    coachIntro();

    const firstGoal = currentGoal();
    setTimeout(() => {
      coachGoalStart(firstGoal);
    }, 2600);

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

    const goalsTotal = goals.length;
    const goalsCleared = countGoalsCleared();

    emit('hha:end', {
      mode: 'FoodGroupsVR',
      score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal,
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
        goalsCleared,
        goalsTotal,
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
