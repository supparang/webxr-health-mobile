// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Emoji Pop + Fever + Quest (2 Goals, 3 Mini) + Particles
// ผูกเป็น window.GroupsVR.GameEngine เพื่อให้ groups-vr.html เรียกได้

(function (ns) {
  'use strict';

  const ROOT  = (typeof window !== 'undefined' ? window : globalThis);
  const A     = ROOT.AFRAME;

  if (!A) {
    console.error('[FoodGroupsVR] AFRAME not found');
    ns.GameEngine = { start () {}, stop () {}, setLayerEl () {} };
    return;
  }

  const THREE = A.THREE;

  // Fever UI (IIFE)
  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI || {
      ensureFeverBar () {},
      setFever () {},
      setFeverActive () {},
      setShield () {}
    };

  // Particles (IIFE)
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles || {
      scorePop () {},
      burstAt () {}
    };

  // ---------- Emoji Pools + กลุ่มอาหาร (หมู่ 1–5) ----------

  // groupId:
  // 1 = โปรตีน (เนื้อ นม ไข่ ถั่ว)
  // 2 = ข้าว-แป้ง-เผือก-มัน
  // 3 = ผัก
  // 4 = ผลไม้
  // 5 = ไขมัน
  const GOOD_POOL = [
    // หมู่ 2 — ข้าว-แป้ง
    { ch: '🍚', group: 2 },
    { ch: '🍞', group: 2 },
    { ch: '🥖', group: 2 },
    { ch: '🥐', group: 2 },
    // หมู่ 1 — โปรตีน
    { ch: '🍗', group: 1 },
    { ch: '🥩', group: 1 },
    { ch: '🍖', group: 1 },
    { ch: '🐟', group: 1 },
    { ch: '🍳', group: 1 },
    { ch: '🥚', group: 1 },
    // นม / ชีส
    { ch: '🥛', group: 1 },
    { ch: '🧀', group: 1 },
    // หมู่ 3 — ผัก
    { ch: '🥦', group: 3 },
    { ch: '🥕', group: 3 },
    { ch: '🥬', group: 3 },
    { ch: '🍅', group: 3 },
    // หมู่ 4 — ผลไม้
    { ch: '🍎', group: 4 },
    { ch: '🍌', group: 4 },
    { ch: '🍊', group: 4 },
    { ch: '🍇', group: 4 },
    { ch: '🍓', group: 4 },
    // หมู่ 5 — ไขมันดี (ถั่ว / อะโวคาโดเลียนแบบ)
    { ch: '🥜', group: 5 },
    { ch: '🥑', group: 5 }
  ];

  const JUNK_POOL = [
    '🍔', '🍟', '🍕', '🌭',
    '🍩', '🍪', '🍰', '🍫',
    '🧋', '🥤', '🍭'
  ];

  // ---------- Cache emoji → texture ----------

  const emojiTexCache = new Map();

  function getEmojiTexture (ch) {
    if (!emojiTexCache.has(ch)) {
      const size = 256;
      const cv   = document.createElement('canvas');
      cv.width = cv.height = size;
      const ctx = cv.getContext('2d');

      ctx.clearRect(0, 0, size, size);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font =
        '200px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
      ctx.fillText(ch, size / 2, size / 2 + 10);

      const url = cv.toDataURL('image/png');
      emojiTexCache.set(ch, url);
    }
    return emojiTexCache.get(ch);
  }

  // ---------- world → screen helper (ให้เป้าแตกตรงตำแหน่ง) ----------

  function worldToScreen (obj3D, fallbackCenter = true) {
    if (!obj3D || !ROOT.innerWidth || !ROOT.innerHeight || !A || !THREE) {
      if (!fallbackCenter) {
        return { x: 0, y: 0 };
      }
      return {
        x: ROOT.innerWidth / 2,
        y: ROOT.innerHeight / 2
      };
    }

    const scene = document.querySelector('a-scene');
    if (!scene || !scene.camera) {
      return {
        x: ROOT.innerWidth / 2,
        y: ROOT.innerHeight / 2
      };
    }

    const v = new THREE.Vector3();
    obj3D.getWorldPosition(v);
    v.project(scene.camera);

    const x = (v.x * 0.5 + 0.5) * ROOT.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * ROOT.innerHeight;
    return { x, y };
  }

  // ---------- state หลัก ----------

  const state = {
    sceneEl: null,
    running: false,
    diff: 'normal',

    spawnTimer: null,
    spawnInterval: 1000,
    targetLifetime: 1300,
    maxActive: 4,

    activeTargets: [],

    // score
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,

    // streak สำหรับ mini quest
    streakNoJunk: 0,
    bestStreak: 0,

    // กลุ่มอาหาร
    groupHits: {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0
    },

    // fever
    fever: 0,
    feverActive: false,

    // quest meta
    goalsCleared: 0,
    goalsTotal: 2,
    miniCleared: 0,
    miniTotal: 3,

    // session
    sessionId: '',
    sessionStart: null
  };

  const GOAL_TARGETS = {
    // Goal1: หมู่ 1–3 รวม 11 ชิ้น
    G1: 11,
    // Goal2: หมู่ 4–5 รวม 11 ชิ้น
    G2: 11
  };

  // ---------- helper events ----------

  function emit (type, detail) {
    try {
      ROOT.dispatchEvent(new CustomEvent(type, { detail }));
    } catch (err) {
      console.warn('[FoodGroupsVR] emit error', type, err);
    }
  }

  let lastCoachAt = 0;
  function coach (text, minGap) {
    if (!text) return;
    const now = Date.now();
    if (now - lastCoachAt < (minGap || 2000)) return;
    lastCoachAt = now;
    emit('hha:coach', { text });
  }

  function pushScoreHud () {
    emit('hha:score', {
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      score: state.score,
      combo: state.combo,
      comboMax: state.comboMax,
      misses: state.misses
    });
  }

  function judgeLabel (label) {
    emit('hha:judge', { label });
  }

  function pushFeverEvent (stateName) {
    emit('hha:fever', {
      state: stateName,
      value: state.fever,
      active: state.feverActive
    });
  }

  function applyFeverUI () {
    FeverUI.setFever && FeverUI.setFever(state.fever);
    FeverUI.setFeverActive && FeverUI.setFeverActive(state.feverActive);
  }

  function feverMult () {
    return state.feverActive ? 2 : 1;
  }

  function gainFever (n) {
    const prevActive = state.feverActive;
    state.fever = Math.max(0, Math.min(100, state.fever + n));
    if (!state.feverActive && state.fever >= 100) {
      state.feverActive = true;
      coach('เข้าโหมดไฟแล้ว! เลือกอาหารดีรัว ๆ ได้เลย 🔥', 2800);
      pushFeverEvent('start');
    } else {
      pushFeverEvent('change');
    }
    applyFeverUI();
  }

  function loseFever (n) {
    const prevActive = state.feverActive;
    const d = state.feverActive ? Math.max(10, n) : n;
    state.fever = Math.max(0, state.fever - d);
    if (state.feverActive && state.fever <= 0) {
      state.feverActive = false;
    }
    if (prevActive && !state.feverActive) pushFeverEvent('end');
    else pushFeverEvent('change');
    applyFeverUI();
  }

  // ---------- Quest HUD (2 goals, 3 mini) ----------

  function buildQuestSnapshot () {
    const g1Hits = (state.groupHits[1] || 0) +
                   (state.groupHits[2] || 0) +
                   (state.groupHits[3] || 0);
    const g2Hits = (state.groupHits[4] || 0) +
                   (state.groupHits[5] || 0);

    const goal1 = {
      id: 'G1',
      label: 'เก็บอาหารดีจากหมู่ 1–3 ให้ครบ 11 ชิ้น',
      prog: g1Hits,
      target: GOAL_TARGETS.G1,
      done: g1Hits >= GOAL_TARGETS.G1
    };

    const goal2 = {
      id: 'G2',
      label: 'เก็บอาหารดีจากหมู่ 4–5 ให้ครบ 11 ชิ้น',
      prog: g2Hits,
      target: GOAL_TARGETS.G2,
      done: g2Hits >= GOAL_TARGETS.G2
    };

    const goalsAll = [goal1, goal2];

    const mini1Done = state.comboMax >= 3;
    const mini2Done = state.bestStreak >= 6;
    const mini3Done = state.bestStreak >= 8;

    const mini1 = {
      id: 'M1',
      label: 'ทำคอมโบให้ถึง x3 อย่างน้อย 1 ครั้ง',
      prog: mini1Done ? 1 : 0,
      target: 1,
      done: mini1Done
    };
    const mini2 = {
      id: 'M2',
      label: 'เลือกอาหารดีติดกัน 6 ชิ้น โดยไม่โดนของขยะ',
      prog: Math.min(state.bestStreak, 6),
      target: 6,
      done: mini2Done
    };
    const mini3 = {
      id: 'M3',
      label: 'เลือกอาหารดีติดกัน 8 ชิ้น โดยไม่โดนของขยะ',
      prog: Math.min(state.bestStreak, 8),
      target: 8,
      done: mini3Done
    };

    const minisAll = [mini1, mini2, mini3];

    const goalsCleared = goalsAll.filter(g => g.done).length;
    const minisCleared = minisAll.filter(m => m.done).length;

    state.goalsCleared = goalsCleared;
    state.miniCleared = minisCleared;
    state.goalsTotal  = goalsAll.length;
    state.miniTotal   = minisAll.length;

    let activeGoal = null;
    if (!goal1.done) activeGoal = goal1;
    else if (!goal2.done) activeGoal = goal2;

    let activeMini = null;
    if (!mini1.done) activeMini = mini1;
    else if (!mini2.done) activeMini = mini2;
    else if (!mini3.done) activeMini = mini3;

    return {
      goal: activeGoal,
      mini: activeMini,
      goalsAll,
      minisAll
    };
  }

  function pushQuestHud (hint) {
    const snap = buildQuestSnapshot();
    emit('quest:update', {
      goal: snap.goal,
      mini: snap.mini,
      goalsAll: snap.goalsAll,
      minisAll: snap.minisAll,
      hint: hint || ''
    });

    // จบทุก Goal + Mini → ฉลองแล้วจบเกม
    if (state.running &&
        state.goalsCleared >= state.goalsTotal &&
        state.miniCleared >= state.miniTotal) {
      emit('quest:all-cleared', {
        goals: state.goalsCleared,
        minis: state.miniCleared,
        goalsTotal: state.goalsTotal,
        minisTotal: state.miniTotal
      });
      coach('สุดยอด! เคลียร์ทุกภารกิจแล้ว 🎉 มาดูสรุปคะแนนกัน!', 4000);
      stop('quest-complete');
    }
  }

  // ---------- Target helpers ----------

  function removeTarget (el) {
    state.activeTargets = state.activeTargets.filter(t => t !== el);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function createTargetEntity (emoji, kind, groupId) {
    if (!state.sceneEl) return null;

    const root = document.createElement('a-entity');

    const x = -1.4 + Math.random() * 2.8; // [-1.4, 1.4]
    const y = 1.6  + Math.random() * 1.4; // [1.6, 3.0]
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.setAttribute('data-kind', kind);
    root.setAttribute('data-emoji', emoji);
    root.setAttribute('data-group', String(groupId || 0));
    // ล็อกกันโดนซ้ำหลาย event (touchstart + click)
    root.setAttribute('data-hit-done', '0');

    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', kind === 'good' ? 0.45 : 0.4);
    circle.setAttribute('material', {
      color: kind === 'good' ? '#22c55e' : '#f97316',
      opacity: 0.32,
      metalness: 0,
      roughness: 1
    });
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
    sprite.setAttribute('data-raycastable', 'true');

    // ★ แก้ปัญหาต้องกด 2 ที: ใช้ mousedown/touchstart และล็อกให้ยิงครั้งเดียว
    const hitOnce = (evt) => {
      if (root.getAttribute('data-hit-done') === '1') return;
      root.setAttribute('data-hit-done', '1');
      if (evt && evt.stopPropagation) evt.stopPropagation();
      onHit(root, evt);
    };

    ['mousedown', 'touchstart', 'click'].forEach(evName => {
      circle.addEventListener(evName, hitOnce);
      sprite.addEventListener(evName, hitOnce);
    });

    root.appendChild(circle);
    root.appendChild(sprite);
    state.sceneEl.appendChild(root);

    ROOT.setTimeout(() => {
      if (!state.running || !root.parentNode) return;
      onExpire(root);
    }, state.targetLifetime);

    return root;
  }

  function pickGood () {
    const idx = Math.floor(Math.random() * GOOD_POOL.length);
    return GOOD_POOL[idx];
  }

  function pickType () {
    // ดีประมาณ 75%
    return Math.random() < 0.75 ? 'good' : 'junk';
  }

  function tickSpawn () {
    if (!state.running) return;
    if (state.activeTargets.length >= state.maxActive) return;

    const kind = pickType();
    let emoji = '';
    let groupId = 0;

    if (kind === 'good') {
      const g = pickGood();
      emoji   = g.ch;
      groupId = g.group || 0;
    } else {
      emoji = JUNK_POOL[Math.floor(Math.random() * JUNK_POOL.length)];
      groupId = 0;
    }

    const el = createTargetEntity(emoji, kind, groupId);
    if (el) state.activeTargets.push(el);
  }

  // ---------- Difficulty ----------

  function applyDifficulty (diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    state.diff = d;

    if (d === 'easy') {
      state.spawnInterval  = 1150;
      state.targetLifetime = 1600;
      state.maxActive      = 3;
    } else if (d === 'hard') {
      state.spawnInterval  = 800;
      state.targetLifetime = 1250;
      state.maxActive      = 5;
    } else {
      state.spawnInterval  = 1000;
      state.targetLifetime = 1400;
      state.maxActive      = 4;
    }
  }

  // ---------- Hit / Expire ----------

  function onHit (target, evt) {
    if (!state.running || !target || !target.parentNode) return;

    const kind    = target.getAttribute('data-kind')  || 'good';
    const emoji   = target.getAttribute('data-emoji') || '';
    const groupId = parseInt(target.getAttribute('data-group') || '0', 10) || 0;

    // ตำแหน่งสำหรับเอฟเฟกต์
    const pt = worldToScreen(target.object3D);

    // แอนิเมชันย่อก่อนลบ
    target.setAttribute('animation__hit', {
      property: 'scale',
      to:       '0.1 0.1 0.1',
      dur:      130,
      easing:   'ease-out'
    });

    ROOT.setTimeout(() => removeTarget(target), 140);

    if (kind === 'good') {
      state.streakNoJunk += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streakNoJunk);

      const base = 12 + state.combo * 2;
      const gain = base * feverMult();
      const prevScore = state.score;

      state.score += gain;
      state.combo += 1;
      state.comboMax = Math.max(state.comboMax, state.combo);

      gainFever(8);

      if (groupId >= 1 && groupId <= 5) {
        state.groupHits[groupId] = (state.groupHits[groupId] || 0) + 1;
      }

      try {
        Particles.scorePop(pt.x, pt.y, '+' + gain, {
          good: true,
          judgment: (state.combo >= 8 ? 'PERFECT' : 'GOOD')
        });
        Particles.burstAt(pt.x, pt.y, { color: '#22c55e' });
      } catch {}

      const lbl = state.combo >= 8 ? 'PERFECT' : 'GOOD +' + gain;
      judgeLabel(lbl);
      pushScoreHud();
      pushQuestHud();

      if (state.combo === 3) {
        coach('คอมโบ x3 แล้ว! รักษาจังหวะนี้ไว้ให้ได้นาน ๆ 💪', 2600);
      } else if (state.combo === 5) {
        coach('คอมโบ x5 เลย เก่งมาก! ระวังของขยะให้ดีนะ 🍔❌', 3200);
      } else if (state.combo === 8) {
        coach('เทพมาก! คอมโบยาว ๆ แบบนี้ร่างกายชอบสุด ๆ 🎉', 3200);
      }

      emit('hha:event', {
        sessionId:  state.sessionId,
        mode:       'FoodGroupsVR',
        difficulty: state.diff,
        type:       'hit-good',
        emoji,
        groupId,
        totalScore: state.score,
        combo:      state.combo,
        misses:     state.misses
      });
    } else {
      // JUNK
      state.streakNoJunk = 0;

      state.misses += 1;
      state.combo = 0;
      const before = state.score;
      state.score = Math.max(0, state.score - 10);
      const loss = state.score - before;

      loseFever(18);

      try {
        Particles.scorePop(pt.x, pt.y, String(loss), {
          good: false,
          judgment: 'MISS'
        });
        Particles.burstAt(pt.x, pt.y, { color: '#f97316' });
      } catch {}

      emit('hha:miss', { misses: state.misses });
      judgeLabel('MISS');
      pushScoreHud();
      pushQuestHud();

      if (state.misses === 1) {
        coach('โดนของขยะแล้วหนึ่งครั้ง 😅 ลองโฟกัสพวกข้าว ผัก ผลไม้ให้มากขึ้นนะ', 3600);
      } else if (state.misses === 3) {
        coach('ของขยะเริ่มเยอะแล้ว ลองตั้งใจหลบพวก 🍔🍟🍩 ให้หมดสักช่วงนึง!', 3600);
      }

      emit('hha:event', {
        sessionId:  state.sessionId,
        mode:       'FoodGroupsVR',
        difficulty: state.diff,
        type:       'hit-junk',
        emoji,
        groupId:    0,
        totalScore: state.score,
        combo:      state.combo,
        misses:     state.misses
      });
    }
  }

  function onExpire (target) {
    if (!state.running || !target || !target.parentNode) return;

    const kind  = target.getAttribute('data-kind')  || 'good';
    const emoji = target.getAttribute('data-emoji') || '';

    removeTarget(target);

    if (kind === 'good') {
      state.streakNoJunk = 0;
      state.misses += 1;
      loseFever(10);
      emit('hha:miss', { misses: state.misses });
      pushScoreHud();
      pushQuestHud();
    }

    emit('hha:event', {
      sessionId:  state.sessionId,
      mode:       'FoodGroupsVR',
      difficulty: state.diff,
      type:       'expire-' + kind,
      emoji,
      totalScore: state.score,
      combo:      state.combo,
      misses:     state.misses
    });
  }

  // ---------- start / stop / setLayerEl ----------

  function start (diffKey, opts) {
    if (state.running) return;

    state.sceneEl = document.querySelector('a-scene');
    if (!state.sceneEl) {
      console.error('[FoodGroupsVR] <a-scene> not found');
      return;
    }

    state.running = true;

    state.score = 0;
    state.combo = 0;
    state.comboMax = 0;
    state.misses = 0;
    state.streakNoJunk = 0;
    state.bestStreak = 0;
    state.groupHits = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    state.fever = 0;
    state.feverActive = false;
    applyFeverUI();

    state.goalsCleared = 0;
    state.miniCleared = 0;

    state.activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    state.activeTargets = [];

    state.sessionId = 'fgvr-' + Date.now().toString(36) + '-' +
      Math.random().toString(16).slice(2, 8);
    state.sessionStart = new Date();

    FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();

    applyDifficulty(diffKey);

    pushScoreHud();
    pushQuestHud('เริ่มภารกิจหมู่ 1–5');
    coach('แตะอาหารดีจากแต่ละหมู่ให้ครบตามภารกิจเลย ✨', 2000);

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

    state.activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    state.activeTargets = [];

    const endTime = new Date();
    const durationSec = state.sessionStart
      ? Math.round((endTime - state.sessionStart) / 1000)
      : 0;

    emit('hha:end', {
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      score: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      goalsCleared: state.goalsCleared,
      goalsTotal: state.goalsTotal,
      miniCleared: state.miniCleared,
      miniTotal: state.miniTotal,
      reason: reason || 'normal'
    });

    emit('hha:session', {
      sessionId: state.sessionId,
      mode: 'FoodGroupsVR',
      difficulty: state.diff,
      startTimeIso: state.sessionStart ? state.sessionStart.toISOString() : '',
      endTimeIso: endTime.toISOString(),
      durationSec,
      scoreFinal: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      goalsCleared: state.goalsCleared,
      goalsTotal: state.goalsTotal,
      miniCleared: state.miniCleared,
      miniTotal: state.miniTotal,
      reason: reason || 'normal'
    });
  }

  function setLayerEl () {
    // compat กับ groups-vr.html (ตอนนี้ไม่ได้ใช้ layer DOM แล้ว)
  }

  ns.GameEngine = {
    start,
    stop,
    setLayerEl
  };
})(window.GroupsVR = window.GroupsVR || {});