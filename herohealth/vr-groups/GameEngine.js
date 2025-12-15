// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Emoji Pop Targets + Fever + 2 Goals / 3 Mini Quests
// ผูกเป็น window.GroupsVR.GameEngine ให้ groups-vr.html ใช้งาน

'use strict';

window.GroupsVR = window.GroupsVR || {};

window.GroupsVR.GameEngine = (function () {
  const A = window.AFRAME;
  if (!A) {
    console.error('[FoodGroupsVR] AFRAME not found');
    return { start () {}, stop () {}, setLayerEl () {} };
  }

  // ----- Fever UI (แชร์จาก GoodJunk / Hydration) -----
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar () {},
      setFever () {},
      setFeverActive () {},
      setShield () {}
    };

  const Particles =
    (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
    window.Particles || null;

  // ---------- Emoji pools ----------
  const GOOD = [
    // หมู่ 2: ข้าว-แป้ง
    '🍚','🍞','🥖','🥐',
    // หมู่ 1: โปรตีน
    '🍗','🥩','🍖','🐟','🍳',
    // นม
    '🥛','🧀',
    // หมู่ 3-4: ผัก-ผลไม้
    '🥦','🥕','🍅','🥬','🍎','🍌','🍊','🍇'
  ];

  const JUNK = [
    '🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧋','🥤','🍫'
  ];

  // ---------- Difficulty table ----------
  function pickDifficulty (diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();

    // ถ้ามีตาราง difficulty จากไฟล์อื่น ให้ใช้
    const table = window.foodGroupsDifficulty;
    if (table && typeof table.get === 'function') {
      return table.get(d);
    }

    // fallback
    if (d === 'easy') {
      return {
        spawnInterval: 1100,
        targetLifetime: 1600,
        maxActive: 3,
        goodRatio: 0.78,
        goal1: 11,
        goal2: 9
      };
    }
    if (d === 'hard') {
      return {
        spawnInterval: 800,
        targetLifetime: 1200,
        maxActive: 5,
        goodRatio: 0.72,
        goal1: 14,
        goal2: 12
      };
    }
    // normal
    return {
      spawnInterval: 950,
      targetLifetime: 1400,
      maxActive: 4,
      goodRatio: 0.75,
      goal1: 12,
      goal2: 10
    };
  }

  // ---------- Fever ----------
  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 14;
  const FEVER_MISS_LOSS = 26;

  // ---------- State ----------
  const state = {
    sceneEl: null,
    running: false,
    diff: 'normal',

    spawnTimer: null,
    spawnInterval: 1000,
    targetLifetime: 1300,
    maxActive: 4,
    goodRatio: 0.75,

    activeTargets: [],

    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,

    fever: 0,
    feverActive: false,
    shield: 0,

    sessionId: '',
    sessionStart: null,

    // Quest: 2 Goals + 3 Minis ต่อเกม
    goals: [],
    minis: [],
    currentGoalIndex: 0,
    currentMiniIndex: 0
  };

  // ---------- Utilities ----------
  function emit (type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function coach (text, minGapMs) {
    if (!text) return;
    const gap = minGapMs || 2300;
    const now = Date.now();
    if (!coach._last || now - coach._last > gap) {
      coach._last = now;
      emit('hha:coach', { text });
    }
  }

  function clamp (v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function setFeverValue (value, stateHint) {
    state.fever = clamp(value, 0, FEVER_MAX);
    if (FeverUI.setFever) FeverUI.setFever(state.fever);
    emit('hha:fever', {
      state: stateHint || (state.feverActive ? 'active' : 'charge'),
      value: state.fever,
      max: FEVER_MAX
    });
  }

  function startFever () {
    if (state.feverActive) return;
    state.feverActive = true;
    setFeverValue(FEVER_MAX, 'start');
    if (FeverUI.setFeverActive) FeverUI.setFeverActive(true);
    emit('hha:fever', { state: 'start', value: FEVER_MAX, max: FEVER_MAX });
    coach('เข้าโหมดไฟแล้ว! เลือกอาหารดีรัว ๆ เลย 🔥', 3000);
  }

  function endFever () {
    if (!state.feverActive) return;
    state.feverActive = false;
    if (FeverUI.setFeverActive) FeverUI.setFeverActive(false);
    setFeverValue(0, 'end');
    emit('hha:fever', { state: 'end', value: 0, max: FEVER_MAX });
  }

  function gainFever (delta) {
    const next = state.fever + delta;
    if (!state.feverActive && next >= FEVER_MAX) {
      startFever();
    } else {
      setFeverValue(next, 'charge');
    }
  }

  function loseFever (delta) {
    const next = state.fever - delta;
    if (state.feverActive && next <= 0) {
      endFever();
    } else {
      setFeverValue(next, 'charge');
    }
  }

  function mult () {
    return state.feverActive ? 2 : 1;
  }

  // ---------- Score HUD ----------
  function emitScore () {
    emit('hha:score', {
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      score: state.score,
      combo: state.combo,
      comboMax: state.comboMax,
      misses: state.misses
    });
  }

  function emitMiss () {
    emit('hha:miss', {
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      misses: state.misses
    });
  }

  function emitJudge (label) {
    emit('hha:judge', { label });
  }

  // ---------- Quest setup ----------
  function setupQuests (cfg) {
    const g1Target = cfg.goal1 | 0;
    const g2Target = cfg.goal2 | 0;

    state.goals = [
      {
        id: 'G1',
        label: `เก็บอาหารดีจากหมู่ 1–3 ให้ครบ ${g1Target} ชิ้น`,
        target: g1Target,
        prog: 0,
        done: false
      },
      {
        id: 'G2',
        label: `เก็บอาหารดีจากหมู่ 4–5 ให้ครบ ${g2Target} ชิ้น`,
        target: g2Target,
        prog: 0,
        done: false
      }
    ];

    state.minis = [
      {
        id: 'M1',
        label: 'ทำคอมโบให้ถึง x3 อย่างน้อย 1 ครั้ง',
        target: 1,
        prog: 0,
        done: false
      },
      {
        id: 'M2',
        label: 'ทำคอมโบให้ถึง x5 อย่างน้อย 1 ครั้ง',
        target: 1,
        prog: 0,
        done: false
      },
      {
        id: 'M3',
        label: 'เลือกอาหารดีติดกัน 8 ชิ้น โดยไม่โดนของขยะ',
        target: 1,
        prog: 0,
        done: false
      }
    ];

    state.currentGoalIndex = 0;
    state.currentMiniIndex = 0;
  }

  function getQuestMeta () {
    const goalsAll = state.goals.slice();
    const minisAll = state.minis.slice();

    const goalsDone = goalsAll.filter(g => g.done).length;
    const minisDone = minisAll.filter(m => m.done).length;

    return {
      goalsAll,
      minisAll,
      goalsDone,
      minisDone,
      goalsTotal: goalsAll.length,
      minisTotal: minisAll.length
    };
  }

  function pushQuest (hint) {
    const meta = getQuestMeta();
    const goal = state.goals[state.currentGoalIndex] || null;
    const mini = state.minis[state.currentMiniIndex] || null;

    emit('quest:update', {
      goal,
      mini,
      goalsAll: meta.goalsAll,
      minisAll: meta.minisAll,
      goalIndex: state.currentGoalIndex + 1,
      goalTotal: meta.goalsTotal,
      miniIndex: state.currentMiniIndex + 1,
      miniTotal: meta.minisTotal,
      hint: hint || ''
    });
  }

  function checkQuestProgressOnGood () {
    const metaBefore = getQuestMeta();

    // ----- Goals -----
    const g = state.goals[state.currentGoalIndex];
    if (g && !g.done) {
      g.prog += 1;
      if (g.prog >= g.target) {
        g.done = true;
        emit('quest:goal-cleared', {
          index: state.currentGoalIndex + 1,
          total: metaBefore.goalsTotal,
          title: g.label,
          meta: getQuestMeta()
        });
        coach(`Goal ${state.currentGoalIndex + 1}/${metaBefore.goalsTotal} สำเร็จแล้ว! 🎯`, 3500);

        // เลื่อนไป goal ถัดไป ถ้ามี
        const nextIdx = state.goals.findIndex(x => !x.done);
        state.currentGoalIndex = nextIdx === -1 ? state.currentGoalIndex : nextIdx;
      }
    }

    // ----- Minis -----
    const m1 = state.minis[0];
    const m2 = state.minis[1];
    const m3 = state.minis[2];

    // M1: combo >= 3 อย่างน้อย 1 ครั้ง
    if (m1 && !m1.done && state.combo >= 3) {
      m1.done = true;
      m1.prog = 1;
      emit('quest:mini-cleared', {
        index: 1,
        total: metaBefore.minisTotal,
        title: m1.label,
        meta: getQuestMeta()
      });
      coach('Mini quest 1 สำเร็จ! คอมโบถึง x3 แล้ว 🎉', 3200);
    }

    // M2: combo >= 5 อย่างน้อย 1 ครั้ง
    if (m2 && !m2.done && state.combo >= 5) {
      m2.done = true;
      m2.prog = 1;
      emit('quest:mini-cleared', {
        index: 2,
        total: metaBefore.minisTotal,
        title: m2.label,
        meta: getQuestMeta()
      });
      coach('สุดยอด! คอมโบถึง x5 แล้ว 🎉', 3200);
    }

    // M3: good ติดกัน 8 ชิ้น — ใช้ combo ต่อเนื่อง
    if (m3 && !m3.done && state.combo >= 8) {
      m3.done = true;
      m3.prog = 1;
      emit('quest:mini-cleared', {
        index: 3,
        total: metaBefore.minisTotal,
        title: m3.label,
        meta: getQuestMeta()
      });
      coach('Mini quest 3 สำเร็จ! เลือกอาหารดีติดกัน 8 ชิ้นโดยไม่โดนของขยะ ⭐', 3500);
    }

    // เลือก mini ปัจจุบัน = ตัวแรกที่ยังไม่ done
    const nextMiniIdx = state.minis.findIndex(x => !x.done);
    if (nextMiniIdx !== -1) state.currentMiniIndex = nextMiniIdx;

    // ถ้าจบทุก Goal + Mini แล้ว
    const metaAfter = getQuestMeta();
    if (metaAfter.goalsDone >= metaAfter.goalsTotal &&
        metaAfter.minisDone >= metaAfter.minisTotal &&
        state.running) {
      emit('quest:all-complete', {
        goals: metaAfter.goalsDone,
        minis: metaAfter.minisDone,
        goalsTotal: metaAfter.goalsTotal,
        minisTotal: metaAfter.minisTotal,
        meta: metaAfter
      });
      coach('สุดยอด! เคลียร์ทุกภารกิจแล้ว 🎉 ฉลองใหญ่แล้วมาดูสรุปคะแนนกัน!', 4000);
      stop('quests-complete');
      return;
    }

    pushQuest('');
  }

  // ---------- Emoji texture (canvas → dataURL) ----------
  const emojiTexCache = new Map();

  function getEmojiTexture (ch) {
    if (emojiTexCache.has(ch)) return emojiTexCache.get(ch);

    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '200px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
    ctx.fillText(ch, 128, 140);
    const url = cv.toDataURL('image/png');
    emojiTexCache.set(ch, url);
    return url;
  }

  // ---------- Target helpers ----------
  function removeTarget (el) {
    state.activeTargets = state.activeTargets.filter(t => t !== el);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function explodeTargetFx (root, isGood) {
    // scale + fade out
    try {
      root.setAttribute('animation__hit_scale', {
        property: 'scale',
        to: '1.4 1.4 1.4',
        dur: 120,
        easing: 'easeOutQuad'
      });
      root.setAttribute('animation__hit_fade', {
        property: 'components.material.material.opacity',
        to: 0,
        dur: 150
      });
    } catch {}

    if (Particles && typeof Particles.burstAt === 'function' && root.object3D) {
      try {
        const v = new A.THREE.Vector3();
        root.object3D.getWorldPosition(v);
        Particles.burstAt(v.x, v.y, v.z, { good: !!isGood });
      } catch {}
    }
  }

  function createTargetEntity (emoji, kind) {
    if (!state.sceneEl) return null;

    const root = document.createElement('a-entity');

    const x = -1.4 + Math.random() * 2.8; // [-1.4, 1.4]
    const y = 1.6  + Math.random() * 1.4; // [1.6, 3.0]
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.setAttribute('data-kind', kind);
    root.setAttribute('data-emoji', emoji);
    root.setAttribute('data-hit-done', '0');

    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', kind === 'good' ? 0.45 : 0.4);
    circle.setAttribute('material', {
      color: kind === 'good' ? '#22c55e' : '#f97316',
      opacity: 0.32,
      metalness: 0,
      roughness: 1
    });

    // สำคัญ: ให้ raycaster / cursor ยิงโดน
    circle.setAttribute('data-hha-tgt', '1');
    circle.setAttribute('data-raycastable', 'true');

    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', 0.75);
    sprite.setAttribute('height', 0.75);
    sprite.setAttribute('position', { x: 0, y: 0, z: 0.01 });
    sprite.setAttribute('material', {
      src: getEmojiTexture(emoji),
      transparent: true,
      alphaTest: 0.01
    });
    sprite.setAttribute('data-hha-tgt', '1');
    sprite.setAttribute('data-raycastable', 'true');

    const hitOnce = (evt) => {
      if (!state.running) return;
      if (root.getAttribute('data-hit-done') === '1') return;
      root.setAttribute('data-hit-done', '1');
      if (evt && evt.stopPropagation) evt.stopPropagation();
      onHit(root);
    };

    ['mousedown', 'touchstart', 'click'].forEach(evName => {
      circle.addEventListener(evName, hitOnce);
      sprite.addEventListener(evName, hitOnce);
    });

    root.appendChild(circle);
    root.appendChild(sprite);
    state.sceneEl.appendChild(root);

    // หมดเวลาเป้าหายเอง
    setTimeout(() => {
      if (!state.running || !root.parentNode) return;
      onExpire(root);
    }, state.targetLifetime);

    return root;
  }

  function pickType () {
    return Math.random() < state.goodRatio ? 'good' : 'junk';
  }

  function tickSpawn () {
    if (!state.running) return;
    if (state.activeTargets.length >= state.maxActive) return;

    const type = pickType();
    const emoji = (type === 'good'
      ? GOOD[Math.floor(Math.random() * GOOD.length)]
      : JUNK[Math.floor(Math.random() * JUNK.length)]
    );

    const el = createTargetEntity(emoji, type);
    if (el) state.activeTargets.push(el);
  }

  // ---------- Hit / Expire ----------
  function onHit (el) {
    if (!state.running || !el || !el.parentNode) return;

    const kind = el.getAttribute('data-kind') || 'good';
    const emoji = el.getAttribute('data-emoji') || '';

    removeTarget(el);
    explodeTargetFx(el, kind === 'good');

    if (kind === 'good') {
      const base = 12 + state.combo * 2;
      const gain = base * mult();
      state.score += gain;

      state.combo += 1;
      if (state.combo > state.comboMax) state.comboMax = state.combo;

      gainFever(FEVER_HIT_GAIN);
      emitJudge(state.combo >= 8 ? 'PERFECT' : 'GOOD +' + gain);

      checkQuestProgressOnGood();
      emitScore();

      emit('hha:event', {
        sessionId: state.sessionId,
        mode: 'FoodGroupsVR',
        difficulty: state.diff,
        type: 'hit-good',
        emoji,
        totalScore: state.score,
        combo: state.combo,
        misses: state.misses
      });
    } else {
      // junk
      if (state.shield > 0) {
        state.shield -= 1;
        FeverUI.setShield && FeverUI.setShield(state.shield);
        explodeTargetFx(el, false);
        emitJudge('BLOCK');
        coach('เกราะช่วยกันของขยะให้แล้วนะ 🛡️ ระวังอย่าโดนบ่อยเกินไป', 3500);
        return;
      }

      const loss = -10;
      state.score = Math.max(0, state.score + loss);
      state.combo = 0;
      state.misses += 1;
      loseFever(FEVER_MISS_LOSS);

      emitMiss();
      emitScore();
      emitJudge('MISS');
      coach('โดนของขยะแล้ว ลองสังเกตพวก 🍔🍟🍩 แล้วหลบให้ทันนะ', 3500);

      emit('hha:event', {
        sessionId: state.sessionId,
        mode: 'FoodGroupsVR',
        difficulty: state.diff,
        type: 'hit-junk',
        emoji,
        totalScore: state.score,
        combo: state.combo,
        misses: state.misses
      });
    }
  }

  function onExpire (el) {
    if (!state.running || !el || !el.parentNode) return;

    const kind = el.getAttribute('data-kind') || 'good';
    const emoji = el.getAttribute('data-emoji') || '';

    removeTarget(el);

    if (kind === 'good') {
      state.misses += 1;
      state.combo = 0;
      loseFever(FEVER_MISS_LOSS * 0.7);
      emitMiss();
      emitScore();
      emitJudge('MISS');
      coach('พลาดอาหารดีไปนิด ลองโฟกัสให้มากขึ้นนะ 😊', 3500);
    }

    emit('hha:event', {
      sessionId: state.sessionId,
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      type: 'expire-' + kind,
      emoji,
      totalScore: state.score,
      combo: state.combo,
      misses: state.misses
    });
  }

  // ---------- Start / Stop ----------
  function start (diffKey) {
    if (state.running) return;

    state.sceneEl = document.querySelector('a-scene');
    if (!state.sceneEl) {
      console.error('[FoodGroupsVR] ไม่พบ <a-scene>');
      return;
    }

    const cfg = pickDifficulty(diffKey);
    state.diff = String(diffKey || 'normal').toLowerCase();
    state.spawnInterval  = cfg.spawnInterval;
    state.targetLifetime = cfg.targetLifetime;
    state.maxActive      = cfg.maxActive;
    state.goodRatio      = cfg.goodRatio;

    setupQuests(cfg);

    state.running = true;
    state.score = 0;
    state.combo = 0;
    state.comboMax = 0;
    state.misses = 0;
    state.fever = 0;
    state.feverActive = false;
    state.shield = 0;

    state.activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    state.activeTargets = [];

    FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
    FeverUI.setFever && FeverUI.setFever(0);
    FeverUI.setFeverActive && FeverUI.setFeverActive(false);
    FeverUI.setShield && FeverUI.setShield(0);

    state.sessionId = 'fgvr-' + Date.now().toString(36) + '-' +
      Math.random().toString(16).slice(2, 8);
    state.sessionStart = new Date();

    emitScore();
    pushQuest('เริ่มภารกิจหมู่อาหารไทย 5 หมู่');

    coach('ภารกิจคือเลือกอาหารดีจากทั้ง 5 หมู่ให้ครบ พร้อมหลบของขยะให้ทันนะ 🥦🍎', 4000);

    tickSpawn();
    state.spawnTimer = setInterval(tickSpawn, state.spawnInterval);
  }

  function stop (reason) {
    if (!state.running) return;
    state.running = false;

    clearInterval(state.spawnTimer);
    state.spawnTimer = null;

    state.activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    state.activeTargets = [];

    endFever();

    const meta = getQuestMeta();
    const endTime = new Date();
    const durationSecPlayed = state.sessionStart
      ? Math.round((endTime - state.sessionStart) / 1000)
      : 0;

    emit('hha:end', {
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      scoreFinal: state.score,
      score: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      goalsCleared: meta.goalsDone,
      goalsTotal: meta.goalsTotal,
      miniCleared: meta.minisDone,
      miniTotal: meta.minisTotal,
      reason: reason || 'normal'
    });

    emit('hha:session', {
      sessionId: state.sessionId,
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      startTimeIso: state.sessionStart ? state.sessionStart.toISOString() : '',
      endTimeIso: endTime.toISOString(),
      durationSecPlayed,
      scoreFinal: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      goalsCleared: meta.goalsDone,
      goalsTotal: meta.goalsTotal,
      miniCleared: meta.minisDone,
      miniTotal: meta.minisTotal,
      reason: reason || 'normal'
    });
  }

  // เผื่ออนาคตอยากให้ Engine รู้ layer DOM
  function setLayerEl (el) {
    state.layerEl = el || null;
  }

  return { start, stop, setLayerEl };
})();