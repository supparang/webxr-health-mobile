// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Emoji Targets in A-Frame (3D) + Fever + Goal(2) + Mini(3)
// เป้าเป็นวัตถุ 3D ในฉาก A-Frame ไม่เลื่อนตามจอเวลาหมุนกล้อง
// ใช้ร่วมกับ groups-vr.html (เรียก window.GroupsVR.GameEngine.start(diff, { layerEl }))

(function (ROOT) {
  'use strict';

  ROOT = ROOT || (typeof window !== 'undefined' ? window : globalThis);
  const doc = ROOT.document;

  // ----- Fever UI / Particles (ถ้ามี) -----
  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI ||
    {
      ensureFeverBar () {},
      setFever () {},
      setFeverActive () {},
      setShield () {}
    };

  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles ||
    {
      scorePop () {},
      burstAt () {}
    };

  const {
    ensureFeverBar,
    setFever,
    setFeverActive,
    setShield
  } = FeverUI;

  function emit (type, detail) {
    try {
      ROOT.dispatchEvent(new CustomEvent(type, { detail }));
    } catch (e) {
      console.warn('[FoodGroupsVR] emit error', type, e);
    }
  }

  function randOf (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clamp (v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  // ----- Coach helper -----
  let lastCoachAt = 0;
  function coach (text, minGap) {
    if (!text) return;
    const now = Date.now();
    const gap = minGap || 2200;
    if (now - lastCoachAt < gap) return;
    lastCoachAt = now;
    emit('hha:coach', { text });
  }

  // ----- กลุ่มอาหาร 5 หมู่ (ไทย) -----
  const GROUPS = [
    {
      id: 1,
      label: 'หมู่ 1 เนื้อ นม ไข่ ถั่ว',
      emoji: ['🍗', '🥚', '🥛', '🫘', '🧀']
    },
    {
      id: 2,
      label: 'หมู่ 2 ข้าว แป้ง เผือก มัน',
      emoji: ['🍚', '🍙', '🍞', '🥖', '🥨']
    },
    {
      id: 3,
      label: 'หมู่ 3 ผักต่าง ๆ',
      emoji: ['🥦', '🥕', '🥬', '🍅', '🧅']
    },
    {
      id: 4,
      label: 'หมู่ 4 ผลไม้',
      emoji: ['🍎', '🍌', '🍊', '🍇', '🍓']
    },
    {
      id: 5,
      label: 'หมู่ 5 ไขมันที่ดี',
      emoji: ['🧈', '🥑', '🥜', '🌰', '🫒']
    }
  ];

  const JUNK = ['🍔', '🍟', '🍕', '🌭', '🍩', '🍪', '🍰', '🧋', '🥤', '🍫'];

  // ---------------------------------------------------
  //  STATE
  // ---------------------------------------------------
  const state = {
    running: false,
    diff: 'normal',
    sceneEl: null,
    targetRoot: null,     // <a-entity id="fg-targets-root">
    spawnTimer: null,
    spawnInterval: 1000,
    targetLifetime: 1200,
    maxActive: 4,
    goodRate: 0.74,
    junkBurstEvery: 8,
    waveEvery: 6,

    targets: [],

    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,

    fever: 0,
    feverActive: false,
    shield: 0,

    // quests
    goals: [],
    minis: [],
    groupHits: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    rainbowSet: new Set(),
    streakNoJunk: 0,

    // meta
    sessionId: '',
    sessionStart: null,
    spawnCount: 0
  };

  // ---------------------------------------------------
  //  Difficulty
  // ---------------------------------------------------
  function applyDifficulty (diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    state.diff = d;

    if (d === 'easy') {
      state.spawnInterval = 1100;
      state.targetLifetime = 1400;
      state.maxActive = 3;
      state.goodRate = 0.8;
      state.junkBurstEvery = 10;
      state.waveEvery = 7;
    } else if (d === 'hard') {
      state.spawnInterval = 800;
      state.targetLifetime = 1100;
      state.maxActive = 5;
      state.goodRate = 0.68;
      state.junkBurstEvery = 7;
      state.waveEvery = 5;
    } else {
      state.spawnInterval = 950;
      state.targetLifetime = 1250;
      state.maxActive = 4;
      state.goodRate = 0.74;
      state.junkBurstEvery = 8;
      state.waveEvery = 6;
    }
  }

  // ---------------------------------------------------
  //  QUESTS (Goal 2 + Mini 3)
  // ---------------------------------------------------
  function setupQuests () {
    state.goals = [
      {
        id: 'G1',
        label: 'Goal 1: เก็บอาหารดีจากหมู่ 1–3 ให้ครบ 11 ชิ้น',
        prog: 0,
        target: 11,
        done: false,
        type: 'good-from-1-3'
      },
      {
        id: 'G2',
        label: 'Goal 2: เก็บอาหารดีให้ครบทุกหมู่ (1–5) อย่างน้อยหมู่ละ 1 ชิ้น',
        prog: 0,
        target: 5,
        done: false,
        type: 'rainbow'
      }
    ];

    state.minis = [
      {
        id: 'M1',
        label: 'Mini 1: ทำคอมโบให้ถึง x3 อย่างน้อย 1 ครั้ง',
        prog: 0,
        target: 1,
        done: false,
        type: 'combo',
        combo: 3
      },
      {
        id: 'M2',
        label: 'Mini 2: ทำคอมโบให้ถึง x5 อย่างน้อย 1 ครั้ง',
        prog: 0,
        target: 1,
        done: false,
        type: 'combo',
        combo: 5
      },
      {
        id: 'M3',
        label: 'Mini 3: เลือกอาหารดีติดกัน 8 ชิ้น โดยไม่โดนของขยะ',
        prog: 0,
        target: 1,
        done: false,
        type: 'streak-good',
        need: 8
      }
    ];

    state.groupHits = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    state.rainbowSet = new Set();
    state.streakNoJunk = 0;

    pushQuestUpdate('เริ่มภารกิจ Food Groups!');
    coach('เริ่มแล้ว! เล็งที่อาหารดีแต่ละหมู่ แล้วแตะให้ทันเวลาก่อนหายไปนะ ✨');
  }

  function pushQuestUpdate (hint) {
    const goalsAll = state.goals;
    const minisAll = state.minis;

    const nextGoal = goalsAll.find(g => !g.done) || goalsAll[goalsAll.length - 1] || null;
    const nextMini = minisAll.find(m => !m.done) || minisAll[minisAll.length - 1] || null;

    const goalIndex = nextGoal ? (goalsAll.indexOf(nextGoal) + 1) : 0;
    const miniIndex = nextMini ? (minisAll.indexOf(nextMini) + 1) : 0;

    emit('quest:update', {
      goal: nextGoal,
      mini: nextMini,
      goalsAll,
      minisAll,
      goalIndex,
      goalTotal: goalsAll.length,
      miniIndex,
      miniTotal: minisAll.length,
      hint: hint || ''
    });
  }

  function celebrateGoal (g, index) {
    emit('quest:goal-cleared', {
      index,
      total: state.goals.length,
      title: g.label,
      heading: g.label
    });
    coach(`Goal ${index}/${state.goals.length} สำเร็จแล้ว! ${g.label}`, 3200);
  }

  function celebrateMini (m, index) {
    emit('quest:mini-cleared', {
      index,
      total: state.minis.length,
      title: m.label,
      heading: m.label
    });
    coach(`Mini quest ${index}/${state.minis.length} สำเร็จแล้ว! ${m.label}`, 3200);
  }

  function maybeAllCleared () {
    const allGoal = state.goals.length && state.goals.every(g => g.done);
    const allMini = state.minis.length && state.minis.every(m => m.done);
    if (!state.running || !allGoal || !allMini) return;

    emit('quest:all-cleared', {
      goals: state.goals.length,
      minis: state.minis.length,
      goalsTotal: state.goals.length,
      minisTotal: state.minis.length
    });

    coach('สุดยอด! เคลียร์ทุก Goal และ Mini quest แล้ว 🎉 มาดูสรุปคะแนนกัน!', 3500);

    stop('quests-complete');
  }

  function updateQuestsOnGood (groupId) {
    // Goal 1: หมู่ 1–3
    const g1 = state.goals[0];
    if (g1 && !g1.done && groupId >= 1 && groupId <= 3) {
      g1.prog = Math.min(g1.target, g1.prog + 1);
      if (g1.prog >= g1.target) {
        g1.done = true;
        celebrateGoal(g1, 1);
      }
    }

    // Goal 2: rainbow
    const g2 = state.goals[1];
    if (g2 && !g2.done && groupId >= 1 && groupId <= 5) {
      state.rainbowSet.add(groupId);
      g2.prog = Math.min(g2.target, state.rainbowSet.size);
      if (g2.prog >= g2.target) {
        g2.done = true;
        celebrateGoal(g2, 2);
      }
    }

    // Minis
    const maxCombo = state.combo;

    state.minis.forEach((m, idx) => {
      if (m.done) return;

      if (m.type === 'combo') {
        if (maxCombo >= m.combo) {
          m.prog = 1;
          m.done = true;
          celebrateMini(m, idx + 1);
        }
      } else if (m.type === 'streak-good') {
        if (state.streakNoJunk >= m.need) {
          m.prog = 1;
          m.done = true;
          celebrateMini(m, idx + 1);
        }
      }
    });

    pushQuestUpdate('');
    maybeAllCleared();
  }

  function updateQuestsOnJunk () {
    state.streakNoJunk = 0;
    pushQuestUpdate('');
  }

  // ---------------------------------------------------
  //  Fever & HUD
  // ---------------------------------------------------
  const FEVER_MAX = 100;

  function feverMult () {
    return state.feverActive ? 2 : 1;
  }

  function applyFeverUI () {
    setFever(state.fever);
    setFeverActive(state.feverActive);
    setShield(state.shield);
  }

  function gainFever (n) {
    const prev = state.fever;
    let v = clamp(prev + n, 0, FEVER_MAX);
    let changed = v !== prev;

    if (!state.feverActive && v >= FEVER_MAX) {
      state.feverActive = true;
      v = FEVER_MAX;
      emit('hha:fever', { state: 'start', value: v, max: FEVER_MAX });
      coach('เข้าโหมดไฟแล้ว! เล็งอาหารดีให้รัว ๆ เลย 🔥', 3000);
    } else if (changed) {
      emit('hha:fever', { state: 'charge', value: v, max: FEVER_MAX });
    }

    state.fever = v;
    applyFeverUI();
  }

  function loseFever (n) {
    const prev = state.fever;
    let v = clamp(prev - n, 0, FEVER_MAX);
    let changed = v !== prev;

    if (state.feverActive && v <= 0) {
      state.feverActive = false;
      v = 0;
      emit('hha:fever', { state: 'end', value: v, max: FEVER_MAX });
    } else if (changed) {
      emit('hha:fever', { state: 'charge', value: v, max: FEVER_MAX });
    }

    state.fever = v;
    applyFeverUI();
  }

  function pushScoreHud (extra) {
    emit('hha:score', {
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      score: state.score,
      combo: state.combo,
      comboMax: state.comboMax,
      misses: state.misses,
      ...(extra || {})
    });
  }

  function judgeLabel (txt) {
    emit('hha:judge', { label: txt });
  }

  // ---------------------------------------------------
  //  Targets (A-Frame 3D)
  // ---------------------------------------------------
  function ensureTargetRoot () {
    if (state.targetRoot && state.targetRoot.parentNode) return state.targetRoot;
    if (!state.sceneEl) return null;

    let root = state.sceneEl.querySelector('#fg-targets-root');
    if (!root) {
      root = doc.createElement('a-entity');
      root.setAttribute('id', 'fg-targets-root');
      state.sceneEl.appendChild(root);
    }
    state.targetRoot = root;
    return root;
  }

  function removeTarget (el) {
    if (!el) return;
    if (el._lifeTimer) {
      ROOT.clearTimeout(el._lifeTimer);
      el._lifeTimer = null;
    }
    const idx = state.targets.indexOf(el);
    if (idx >= 0) state.targets.splice(idx, 1);
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  function spawnTarget (kind, groupIdOverride) {
    if (!state.running) return;
    if (!state.sceneEl) return;

    const root = ensureTargetRoot();
    if (!root) return;

    const target = doc.createElement('a-entity');

    // สุ่มตำแหน่งลอยอยู่ "ข้างหน้า" ผู้เล่น
    const x = -1.6 + Math.random() * 3.2;  // [-1.6, 1.6]
    const y = 1.2 + Math.random() * 1.6;   // [1.2, 2.8]
    const z = -3.2 - Math.random() * 1.4;  // [-3.2, -4.6]

    target.setAttribute('position', { x, y, z });

    let emoji = '';
    let groupId = 0;

    if (kind === 'good') {
      let g;
      if (typeof groupIdOverride === 'number' && groupIdOverride >= 1 && groupIdOverride <= 5) {
        g = GROUPS.find(xg => xg.id === groupIdOverride) || randOf(GROUPS);
      } else {
        g = randOf(GROUPS);
      }
      groupId = g.id;
      emoji = randOf(g.emoji);
    } else {
      emoji = randOf(JUNK);
      groupId = 0;
    }

    target.setAttribute('data-kind', kind);
    target.setAttribute('data-emoji', emoji);
    target.setAttribute('data-group', groupId);

    // วงกลมพื้นหลัง
    const circle = doc.createElement('a-circle');
    circle.setAttribute('radius', kind === 'good' ? 0.45 : 0.40);
    circle.setAttribute('material', {
      color: kind === 'good' ? '#22c55e' : '#f97316',
      opacity: 0.4,
      metalness: 0,
      roughness: 1
    });

    // emoji text (ใช้ a-text ให้เห็น emoji ใน 3D)
    const text = doc.createElement('a-text');
    text.setAttribute('value', emoji);
    text.setAttribute('align', 'center');
    text.setAttribute('width', 2);
    text.setAttribute('color', '#ffffff');
    text.setAttribute('position', { x: 0, y: 0, z: 0.01 });

    const hitHandler = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      onHit(target, evt);
    };

    circle.addEventListener('click', hitHandler);
    text.addEventListener('click', hitHandler);

    target.appendChild(circle);
    target.appendChild(text);
    root.appendChild(target);

    state.targets.push(target);

    // ตั้งเวลาให้หายไปเอง
    target._lifeTimer = ROOT.setTimeout(() => {
      onExpire(target);
    }, state.targetLifetime);
  }

  function getScreenCenter () {
    return {
      x: ROOT.innerWidth / 2,
      y: ROOT.innerHeight / 2
    };
  }

  function onHit (target, evt) {
    if (!state.running) return;
    if (!target || !target.parentNode) return;

    const kind = target.getAttribute('data-kind') || 'good';
    const emoji = target.getAttribute('data-emoji') || '';
    const groupId = parseInt(target.getAttribute('data-group') || '0', 10) || 0;

    removeTarget(target);

    let pt = getScreenCenter();
    if (evt && evt.detail && evt.detail.cursorEl) {
      // A-Frame click จาก cursor → ใช้กลางจอพอ
      pt = getScreenCenter();
    }

    if (kind === 'good') {
      state.streakNoJunk += 1;

      const base = 12 + state.combo * 2;
      const gain = base * feverMult();
      state.score += gain;
      state.combo += 1;
      state.comboMax = Math.max(state.comboMax, state.combo);

      gainFever(8);

      if (groupId >= 1 && groupId <= 5) {
        state.groupHits[groupId] = (state.groupHits[groupId] || 0) + 1;
      }

      try {
        Particles.scorePop(pt.x, pt.y, '+' + gain, { good: true, judgment: 'GOOD' });
        Particles.burstAt(pt.x, pt.y, { color: '#22c55e' });
      } catch {}

      const lbl = state.combo >= 8 ? 'PERFECT' : 'GOOD +' + gain;
      judgeLabel(lbl);
      pushScoreHud();

      if (state.combo === 3) {
        coach('คอมโบ x3 แล้ว! รักษาจังหวะนี้ไว้ให้ได้ยาว ๆ 💪', 2800);
      } else if (state.combo === 5) {
        coach('คอมโบ x5 เลย เก่งมาก! ระวังของขยะให้ดีนะ 🍔❌', 3200);
      } else if (state.combo === 8) {
        coach('เทพมาก! คอมโบยาว ๆ แบบนี้ร่างกายชอบสุด ๆ 🎉', 3200);
      }

      updateQuestsOnGood(groupId);

      emit('hha:event', {
        sessionId: state.sessionId,
        mode: 'FoodGroupsVR',
        difficulty: state.diff,
        type: 'hit-good',
        emoji,
        groupId,
        totalScore: state.score,
        combo: state.combo,
        misses: state.misses
      });
    } else {
      // junk
      state.streakNoJunk = 0;

      state.misses += 1;
      state.combo = 0;
      const before = state.score;
      state.score = Math.max(0, state.score - 10);
      const loss = state.score - before;

      loseFever(18);

      try {
        Particles.scorePop(pt.x, pt.y, String(loss), { good: false, judgment: 'MISS' });
        Particles.burstAt(pt.x, pt.y, { color: '#f97316' });
      } catch {}

      emit('hha:miss', { misses: state.misses });
      judgeLabel('MISS');
      pushScoreHud();

      updateQuestsOnJunk();

      if (state.misses === 1) {
        coach('โดนของขยะแล้วหนึ่งครั้ง 😅 ลองโฟกัสพวกข้าว ผัก ผลไม้ให้มากขึ้นนะ', 3500);
      } else if (state.misses === 3) {
        coach('ของขยะเริ่มเยอะแล้ว ลองตั้งใจหลบพวก 🍔🍟🍩 ให้หมดสักช่วงนึง!', 3500);
      }

      emit('hha:event', {
        sessionId: state.sessionId,
        mode: 'FoodGroupsVR',
        difficulty: state.diff,
        type: 'hit-junk',
        emoji,
        groupId: 0,
        totalScore: state.score,
        combo: state.combo,
        misses: state.misses
      });
    }
  }

  function onExpire (target) {
    if (!state.running) return;
    if (!target || !target.parentNode) return;

    const kind = target.getAttribute('data-kind') || 'good';
    const emoji = target.getAttribute('data-emoji') || '';
    const groupId = parseInt(target.getAttribute('data-group') || '0', 10) || 0;

    removeTarget(target);

    if (kind === 'good') {
      state.misses += 1;
      state.combo = 0;
      state.streakNoJunk = 0;
      loseFever(10);

      emit('hha:miss', { misses: state.misses });
      pushScoreHud();

      updateQuestsOnJunk();
    }

    emit('hha:event', {
      sessionId: state.sessionId,
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      type: 'expire-' + kind,
      emoji,
      groupId,
      totalScore: state.score,
      combo: state.combo,
      misses: state.misses
    });
  }

  // wave / spawn pattern
  function tickSpawn () {
    if (!state.running) return;
    if (state.targets.length >= state.maxActive) return;

    state.spawnCount += 1;

    let burst = 1;

    // wave เล็ก ๆ บางครั้งให้ 2–3 เป้าโผล่พร้อมกัน
    if (state.spawnCount % state.waveEvery === 0) {
      burst = Math.min(state.maxActive - state.targets.length, 2 + Math.round(Math.random()));
    }

    for (let i = 0; i < burst; i++) {
      if (state.targets.length >= state.maxActive) break;

      let kind;
      if (state.spawnCount % state.junkBurstEvery === 0 && Math.random() < 0.7) {
        // wave เน้น junk
        kind = Math.random() < 0.6 ? 'junk' : 'good';
      } else {
        kind = Math.random() < state.goodRate ? 'good' : 'junk';
      }

      let groupOverride = null;
      if (kind === 'good') {
        // ดันหมู่ 1–3 ช่วยเคลียร์ Goal 1
        if (state.goals[0] && !state.goals[0].done && Math.random() < 0.4) {
          groupOverride = 1 + Math.floor(Math.random() * 3);
        } else if (state.goals[1] && !state.goals[1].done && Math.random() < 0.3) {
          const missing = GROUPS
            .map(g => g.id)
            .filter(id => !state.rainbowSet.has(id));
          if (missing.length) groupOverride = randOf(missing);
        }
      }

      spawnTarget(kind, groupOverride);
    }
  }

  // ---------------------------------------------------
  //  START / STOP
  // ---------------------------------------------------
  function start (diffKey, opts) {
    if (state.running) return;

    const sceneEl = doc.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[FoodGroupsVR] ไม่พบ <a-scene>');
      return;
    }
    state.sceneEl = sceneEl;

    applyDifficulty(diffKey);
    setupQuests();

    state.running = true;
    state.targets.forEach(removeTarget);
    state.targets = [];

    state.score = 0;
    state.combo = 0;
    state.comboMax = 0;
    state.misses = 0;
    state.fever = 0;
    state.feverActive = false;
    state.shield = 0;
    state.spawnCount = 0;

    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    setShield(0);

    state.sessionId =
      'fgvr-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(16).slice(2, 8);
    state.sessionStart = new Date();

    pushScoreHud();
    judgeLabel('');

    // เริ่ม spawn
    tickSpawn();
    state.spawnTimer = ROOT.setInterval(tickSpawn, state.spawnInterval);
  }

  function stop (reason) {
    if (!state.running) return;
    state.running = false;

    if (state.spawnTimer) {
      ROOT.clearInterval(state.spawnTimer);
      state.spawnTimer = null;
    }

    state.targets.forEach(removeTarget);
    state.targets = [];

    const endTime = new Date();
    const durationSec = state.sessionStart
      ? Math.round((endTime - state.sessionStart) / 1000)
      : 0;

    const goalsCleared = state.goals.filter(g => g.done).length;
    const minisCleared = state.minis.filter(m => m.done).length;

    emit('hha:end', {
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      score: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      goalsCleared,
      goalsTotal: state.goals.length,
      miniCleared: minisCleared,
      miniTotal: state.minis.length,
      reason: reason || 'normal'
    });

    emit('hha:session', {
      sessionId: state.sessionId,
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      startTimeIso: state.sessionStart ? state.sessionStart.toISOString() : '',
      endTimeIso: endTime.toISOString(),
      durationSecPlayed: durationSec,
      scoreFinal: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      goalsCleared,
      goalsTotal: state.goals.length,
      miniCleared: minisCleared,
      miniTotal: state.minis.length,
      reason: reason || 'normal'
    });
  }

  // ---------------------------------------------------
  //  EXPORT
  // ---------------------------------------------------
  ROOT.GroupsVR = ROOT.GroupsVR || {};
  ROOT.GroupsVR.GameEngine = {
    start,
    stop
  };
})(typeof window !== 'undefined' ? window : this);