// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — DOM Emoji Targets + Fever + Quest (2 Goals, 3 Minis) + Celebration
// ✅ FIX: เป้าเลื่อนตามการหมุนกล้อง/เลื่อนจอ (camera-relative 3D anchor + project to 2D)
// ✅ FIX: ใช้ difficulty.foodgroups.js จริง (spawnInterval/lifetime/maxActive/scale/feverGain/feverLoss/questTarget)
// ✅ NEW: size adaptive+ เฉพาะ run=play, run=research = FIX scale ตาม easy/normal/hard เท่านั้น

(function (ns) {
  'use strict';

  const ROOT = (typeof window !== 'undefined' ? window : globalThis);

  // ---------- Dependencies ----------
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles ||
    { scorePop () {}, burstAt () {} };

  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI ||
    { ensureFeverBar () {}, setFever () {}, setFeverActive () {}, setShield () {} };

  const { ensureFeverBar, setFever, setFeverActive, setShield } = FeverUI;

  // ---------- A-Frame / THREE ----------
  const A = ROOT.AFRAME;
  const THREE = ROOT.THREE;

  function getSceneEl () { return document.querySelector('a-scene'); }
  function getCamEl () { return document.querySelector('#fg-camera') || document.querySelector('a-camera'); }

  // ---------- Emoji pools ----------
  const GROUPS = {
    1: ['🍗', '🥩', '🍖', '🐟', '🍳', '🥚', '🫘', '🥜', '🧀', '🥛'],
    2: ['🍚', '🍞', '🥖', '🥐', '🥯', '🥨', '🥔', '🍠', '🥣'],
    3: ['🥦', '🥕', '🍅', '🥬', '🥒', '🌽'],
    4: ['🍎', '🍌', '🍊', '🍇', '🍉', '🍓', '🍍'],
    5: ['🧈', '🥓', '🧇']
  };

  const GOOD_GROUP_POOL = [
    { id: 1, weight: 1.2 },
    { id: 2, weight: 1.2 },
    { id: 3, weight: 1.0 },
    { id: 4, weight: 1.0 },
    { id: 5, weight: 0.4 }
  ];

  const JUNK = ['🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧋','🥤','🍫'];

  const POWER_STAR   = '⭐';
  const POWER_FIRE   = '🔥';
  const POWER_SHIELD = '🛡️';
  const POWERUPS = [POWER_STAR, POWER_FIRE, POWER_SHIELD];

  function emojiGroup (ch) {
    for (const k in GROUPS) {
      if (GROUPS[k].includes(ch)) return parseInt(k, 10);
    }
    return 0;
  }

  function pickGoodEmoji () {
    let total = 0;
    for (const g of GOOD_GROUP_POOL) total += g.weight;
    let r = Math.random() * total;
    let chosenId = GOOD_GROUP_POOL[0].id;
    for (const g of GOOD_GROUP_POOL) {
      r -= g.weight;
      if (r <= 0) { chosenId = g.id; break; }
    }
    const arr = GROUPS[chosenId] || GROUPS[1];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Quest design ----------
  const GOALS = [
    { id: 'G1', label: 'เก็บอาหารดีจากหมู่ 1–3 ให้ครบ 11 ชิ้น', target: 11 },
    { id: 'G2', label: 'เก็บอาหารดีจากหมู่ 4–5 ให้ครบ 9 ชิ้น', target: 9 }
  ];

  const MINIS = [
    { id: 'M1', label: 'ทำคอมโบให้ถึง x3 อย่างน้อย 1 ครั้ง', type: 'combo',  needCombo: 3 },
    { id: 'M2', label: 'เลือกอาหารดีติดกัน 8 ชิ้น โดยไม่โดนของขยะ', type: 'streak', needStreak: 8 },
    { id: 'M3', label: 'เก็บอาหารดีจากครบทั้ง 5 หมู่ อย่างน้อยหมู่ละ 1 ชิ้น', type: 'groups', needGroups: 5 }
  ];

  // ---------- Fever ----------
  const FEVER_MAX = 100;

  // ---------- Helper: events ----------
  function emit (type, detail) {
    try { ROOT.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
  }
  function emitScore (state) { emit('hha:score', state); }
  function emitMiss (misses) { emit('hha:miss', { misses }); }
  function emitJudge (label) { emit('hha:judge', { label }); }

  function coach (text, minGapMs) {
    if (!text) return;
    const now = Date.now();
    coach._last = coach._last || 0;
    if (minGapMs && now - coach._last < minGapMs) return;
    coach._last = now;
    emit('hha:coach', { text });
  }

  // ---------- Celebration FX ----------
  function celebrate (type, payload) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const count = (type === 'all') ? 32 : (type === 'goal' ? 20 : 16);
    const color = (type === 'goal') ? '#22c55e' : (type === 'mini' ? '#facc15' : '#38bdf8');

    try {
      for (let i = 0; i < count; i++) {
        const dx = (Math.random() - 0.5) * 220;
        const dy = (Math.random() - 0.5) * 140;
        Particles.burstAt(cx + dx, cy + dy, { color });
      }
    } catch {}
    emit('hha:celebrate', { type, ...(payload || {}) });
  }

  function fxScore (x, y, scoreDelta, judgment, isGood) {
    try {
      Particles.scorePop(x, y, String(scoreDelta || (isGood ? '+0' : '0')), {
        good: !!isGood,
        judgment: judgment || ''
      });
    } catch {}

    try {
      Particles.burstAt(x, y, { color: isGood ? '#22c55e' : '#f97316' });
    } catch {}
  }

  // ---------- Core state ----------
  let layerEl = null;
  let running = false;
  let spawnTimer = null;
  let rafId = null;

  let activeTargets = [];

  // runtime params
  let diffKey = 'normal';
  let runMode = 'play'; // play | research

  // difficulty (from difficulty.foodgroups.js)
  let D = null;
  let spawnInterval = 1000;
  let maxActive = 4;
  let lifetimeBase = 2200;
  let baseScale = 1.0;
  let feverGainHit = 7;
  let feverLossMiss = 16;

  // adaptive+ (เฉพาะ play)
  let adaptiveScale = 1.0;
  let missStreak = 0;
  let adjustCooldownUntil = 0;

  // gameplay state
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let goodStreak = 0;

  let fever = 0;
  let feverActive = false;
  let shield = 0;

  // Quest state
  let currentGoalIdx = 0;
  let currentMiniIdx = 0;
  let goalProg = 0;
  let miniFlags = { comboDone: false, streakDone: false, groupsDone: false };
  let seenGroups = new Set();

  // camera projection helpers
  const tmpV = THREE ? new THREE.Vector3() : null;
  const tmpCamPos = THREE ? new THREE.Vector3() : null;
  const tmpDir = THREE ? new THREE.Vector3() : null;
  const tmpRight = THREE ? new THREE.Vector3() : null;
  const tmpUp = THREE ? new THREE.Vector3() : null;

  function clamp (v, min, max) { return v < min ? min : (v > max ? max : v); }

  function getDifficultyFromTable (key) {
    const HH = (ROOT.HeroHealth || {});
    const tbl = HH.foodGroupsDifficulty;
    if (tbl && typeof tbl.get === 'function') return tbl.get(key);
    return null;
  }

  function applyDifficulty (key) {
    diffKey = String(key || 'normal').toLowerCase();

    D = getDifficultyFromTable(diffKey) || {
      spawnInterval: 1000,
      lifetime: 2200,
      maxActive: 4,
      scale: 1.0,
      feverGainHit: 7,
      feverLossMiss: 16,
      questTarget: 5
    };

    spawnInterval = D.spawnInterval | 0;
    maxActive = D.maxActive | 0;
    lifetimeBase = D.lifetime | 0;
    baseScale = Number(D.scale) || 1.0;
    feverGainHit = Number(D.feverGainHit) || 7;
    feverLossMiss = Number(D.feverLossMiss) || 16;

    // init adaptive scale
    adaptiveScale = baseScale;
    missStreak = 0;
    adjustCooldownUntil = 0;
  }

  function setFeverValue (next, stateHint) {
    fever = clamp(next, 0, FEVER_MAX);
    setFever(fever);
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
    setFeverActive(true);
    emit('hha:fever', { state: 'start', value: FEVER_MAX, max: FEVER_MAX });
  }

  function endFever () {
    if (!feverActive) return;
    feverActive = false;
    setFeverActive(false);
    setFeverValue(0, 'end');
    emit('hha:fever', { state: 'end', value: 0, max: FEVER_MAX });
  }

  function gainFever (n) {
    const next = fever + n;
    if (!feverActive && next >= FEVER_MAX) startFever();
    else setFeverValue(next, 'charge');
  }

  function loseFever (n) {
    const next = fever - n;
    if (feverActive && next <= 0) endFever();
    else setFeverValue(next, 'charge');
  }

  function scoreMultiplier () { return feverActive ? 2 : 1; }

  // ---------- Quest helpers ----------
  function questMeta () {
    const goalsAll = GOALS.map((g, idx) => ({
      id: g.id,
      label: g.label,
      target: g.target,
      prog: idx === currentGoalIdx ? goalProg : (idx < currentGoalIdx ? g.target : 0),
      done: idx < currentGoalIdx || (idx === currentGoalIdx && goalProg >= g.target)
    }));

    const minisAll = MINIS.map((m, idx) => {
      let done = false;
      if (idx === 0) done = miniFlags.comboDone;
      else if (idx === 1) done = miniFlags.streakDone;
      else if (idx === 2) done = miniFlags.groupsDone;
      return { id: m.id, label: m.label, target: 1, prog: done ? 1 : 0, done };
    });

    return {
      goalsAll,
      minisAll,
      goalsCleared: goalsAll.filter(g => g.done).length,
      minisCleared: minisAll.filter(m => m.done).length
    };
  }

  function pushQuest (hintText) {
    const meta = questMeta();
    const goalsAll = meta.goalsAll;
    const minisAll = meta.minisAll;

    const goal = goalsAll[currentGoalIdx] || null;
    const mini = minisAll[currentMiniIdx] || null;

    emit('quest:update', {
      goal,
      mini,
      goalsAll,
      minisAll,
      hint: hintText || '',
      meta: {
        goalsCleared: meta.goalsCleared,
        goalsTotal: GOALS.length,
        minisCleared: meta.minisCleared,
        minisTotal: MINIS.length
      }
    });
  }

  function updateGoalOnHit (ch) {
    const g = GOALS[currentGoalIdx];
    if (!g) return;

    const gp = emojiGroup(ch);

    if (currentGoalIdx === 0) {
      if (gp >= 1 && gp <= 3) goalProg += 1;
    } else if (currentGoalIdx === 1) {
      if (gp === 4 || gp === 5) goalProg += 1;
    }

    if (goalProg >= g.target) {
      goalProg = g.target;

      const idxNow = currentGoalIdx;
      const total = GOALS.length;

      celebrate('goal', { index: idxNow + 1, total, title: g.label });
      emit('quest:goal-cleared', { index: idxNow + 1, total, title: g.label, reward: 'shield' });
      coach(`Goal ${idxNow + 1}/${total} สำเร็จแล้ว! ${g.label} 🎯`, 3500);

      if (currentGoalIdx < GOALS.length - 1) {
        currentGoalIdx++;
        goalProg = 0;
      }
    }
  }

  function updateMiniOnHit (ch, isGood) {
    const gp = emojiGroup(ch);

    if (isGood && gp >= 1 && gp <= 5) seenGroups.add(gp);

    if (isGood) goodStreak += 1;
    else goodStreak = 0;

    if (!miniFlags.comboDone && combo >= MINIS[0].needCombo) {
      miniFlags.comboDone = true;
      celebrate('mini', { index: 1, total: MINIS.length, title: MINIS[0].label });
      emit('quest:mini-cleared', { index: 1, total: MINIS.length, title: MINIS[0].label, reward: 'star' });
      coach(`Mini quest 1 สำเร็จแล้ว! ${MINIS[0].label} ⭐`, 3500);
      if (currentMiniIdx === 0) currentMiniIdx = 1;
    }

    if (!miniFlags.streakDone && goodStreak >= MINIS[1].needStreak) {
      miniFlags.streakDone = true;
      celebrate('mini', { index: 2, total: MINIS.length, title: MINIS[1].label });
      emit('quest:mini-cleared', { index: 2, total: MINIS.length, title: MINIS[1].label, reward: 'star' });
      coach('สุดยอด! Mini quest 2 ผ่านแล้ว 🎉', 3500);
      if (currentMiniIdx === 1) currentMiniIdx = 2;
    }

    if (!miniFlags.groupsDone && seenGroups.size >= MINIS[2].needGroups) {
      miniFlags.groupsDone = true;
      celebrate('mini', { index: 3, total: MINIS.length, title: MINIS[2].label });
      emit('quest:mini-cleared', { index: 3, total: MINIS.length, title: MINIS[2].label, reward: 'star' });
      coach('เยี่ยมมาก! เก็บอาหารดีครบทั้ง 5 หมู่แล้ว 🥦🍚🍎', 3500);
    }

    const meta = questMeta();
    if (meta.goalsCleared >= GOALS.length && meta.minisCleared >= MINIS.length) {
      celebrate('all', { goals: meta.goalsCleared, minis: meta.minisCleared, goalsTotal: GOALS.length, minisTotal: MINIS.length });
      emit('quest:all-cleared', { goals: meta.goalsCleared, minis: meta.minisCleared, goalsTotal: GOALS.length, minisTotal: MINIS.length });
      coach('สุดยอด! เคลียร์ทุกภารกิจแล้ว 🎉 ฉลองใหญ่แล้วมาดูสรุปคะแนนกัน!', 4000);
      stop('quest-complete');
      return;
    }
  }

  // ---------- Adaptive+ (เฉพาะ play) ----------
  function currentScale () {
    return (runMode === 'research') ? baseScale : adaptiveScale;
  }

  function adjustOnHit () {
    if (runMode !== 'play') return;

    missStreak = 0;
    const now = performance.now();
    if (now < adjustCooldownUntil) return;

    // เล่นแม่นต่อเนื่อง -> ลดขนาดให้ท้าทายขึ้น (เบา ๆ)
    if (combo >= 6) {
      adaptiveScale *= 0.96;
      adaptiveScale = clamp(adaptiveScale, baseScale * 0.70, baseScale * 1.40);
      adjustCooldownUntil = now + 1200;
    }
  }

  function adjustOnMiss () {
    if (runMode !== 'play') return;

    missStreak += 1;
    const now = performance.now();
    if (now < adjustCooldownUntil) return;

    // พลาดติดกัน -> ขยายให้กลับมาไหว
    if (missStreak >= 3) {
      adaptiveScale *= 1.12;
      adaptiveScale = clamp(adaptiveScale, baseScale * 0.70, baseScale * 1.55);
      adjustCooldownUntil = now + 1400;
    }
  }

  // ---------- 3D anchor -> 2D projection (แก้เป้าเลื่อนตามกล้อง) ----------
  function getThreeCamera () {
    const scene = getSceneEl();
    const camEl = getCamEl();
    // A-Frame camera
    const c = camEl && camEl.getObject3D ? camEl.getObject3D('camera') : null;
    if (c) return c;
    if (scene && scene.camera) return scene.camera;
    return null;
  }

  function spawnAnchorWorldPos () {
    const camEl = getCamEl();
    if (!THREE || !camEl || !camEl.object3D) return null;

    // ตำแหน่งฐาน: หน้า camera ระยะ ~2.2m
    const dist = 2.2;

    // offset ในกรอบมุมมอง (ซ้าย-ขวา / บน-ล่าง)
    const ox = (Math.random() - 0.5) * 1.8; // ~[-0.9..0.9]
    const oy = (Math.random() - 0.5) * 1.2; // ~[-0.6..0.6]

    camEl.object3D.getWorldPosition(tmpCamPos);
    camEl.object3D.getWorldDirection(tmpDir);

    // สร้าง right/up จาก quaternion
    tmpRight.set(1, 0, 0).applyQuaternion(camEl.object3D.quaternion).normalize();
    tmpUp.set(0, 1, 0).applyQuaternion(camEl.object3D.quaternion).normalize();

    const pos = new THREE.Vector3().copy(tmpCamPos)
      .add(tmpDir.multiplyScalar(dist))
      .add(tmpRight.multiplyScalar(ox))
      .add(tmpUp.multiplyScalar(oy));

    return pos;
  }

  function projectToScreen (posWorld) {
    const cam = getThreeCamera();
    if (!THREE || !cam || !posWorld) return null;

    // clone -> project
    tmpV.copy(posWorld).project(cam);

    // ถ้าอยู่นอกมุมมองมาก ๆ ก็ซ่อน
    if (tmpV.z < -1 || tmpV.z > 1) return null;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const x = (tmpV.x * 0.5 + 0.5) * w;
    const y = (-tmpV.y * 0.5 + 0.5) * h;

    return { x, y };
  }

  function tickProjectLoop () {
    if (!running) return;

    for (const t of activeTargets) {
      if (!t || !t.el || !t.posWorld) continue;

      const p = projectToScreen(t.posWorld);
      if (!p) {
        t.el.style.opacity = '0';
        continue;
      }

      t.el.style.opacity = '1';
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
    }

    rafId = requestAnimationFrame(tickProjectLoop);
  }

  // ---------- Target helpers ----------
  function destroyTarget (t, isHit) {
    if (!t) return;
    const el = t.el || t;

    const idx = activeTargets.indexOf(t);
    if (idx >= 0) activeTargets.splice(idx, 1);

    if (t.timeout) { clearTimeout(t.timeout); t.timeout = null; }

    if (el && el.parentNode) {
      if (isHit) {
        el.classList.add('hit');
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 140);
      } else {
        el.parentNode.removeChild(el);
      }
    }
  }

  function createTarget (type) {
    if (!layerEl) return null;

    const el = document.createElement('div');
    el.className = 'fg-target ' + (type === 'good' ? 'fg-good' : 'fg-junk');

    // ✅ ใช้ px (ไม่ใช้ vw/vh แล้ว) เพราะเราจะ project 3D->2D ทุกเฟรม
    el.style.left = '50%';
    el.style.top  = '50%';

    let emoji;
    let kind = type;

    if (type === 'good') {
      if (Math.random() < 0.08) {
        emoji = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
        kind = 'power';
      } else {
        emoji = pickGoodEmoji();
      }
    } else {
      emoji = JUNK[Math.floor(Math.random() * JUNK.length)];
      kind = 'junk';
    }

    // ✅ ขนาด: run=research ใช้ baseScale เท่านั้น / run=play ใช้ adaptiveScale
    const sc = currentScale();
    el.style.transform = `translate(-50%, -50%) scale(${sc.toFixed(3)})`;

    el.dataset.kind = kind;
    el.dataset.emoji = emoji;
    el.setAttribute('data-emoji', emoji);

    // ✅ 3D anchor world position (ผูกกับกล้องตอน spawn)
    const posWorld = spawnAnchorWorldPos();

    const tObj = { el, type: kind, emoji, posWorld, bornAt: performance.now(), timeout: null };
    activeTargets.push(tObj);
    layerEl.appendChild(el);

    const onClick = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = (ev.clientX != null) ? ev.clientX : (rect.left + rect.width / 2);
      const cy = (ev.clientY != null) ? ev.clientY : (rect.top + rect.height / 2);
      handleHit(tObj, cx, cy);
    };

    el.addEventListener('pointerdown', onClick);
    el.addEventListener('click', onClick);

    // ✅ lifetime จาก difficulty table
    const life = Math.max(600, lifetimeBase + (Math.random() * 450 - 220));
    tObj.timeout = setTimeout(() => {
      if (!running) return;
      destroyTarget(tObj, false);

      // miss เฉพาะ good (เหมือนเดิม)
      if (kind === 'good') {
        misses += 1;
        combo = 0;
        goodStreak = 0;

        adjustOnMiss();           // ✅ adaptive+ (play only)
        loseFever(feverLossMiss); // ✅ จาก table

        emitMiss(misses);
        emitJudge('MISS');
        emitScore({ score, combo, misses });
      }
    }, life);

    return tObj;
  }

  function handleHit (tObj, x, y) {
    if (!running || !tObj || !tObj.el) return;

    const type = tObj.type;
    const ch = tObj.emoji;

    // ก่อนลบ แสดง burst ณ จุด DOM
    destroyTarget(tObj, true);

    // ----- Power-ups -----
    if (type === 'power') {
      if (ch === POWER_STAR) {
        const d = 40 * scoreMultiplier();
        score += d;
        combo += 1;
        comboMax = Math.max(comboMax, combo);

        adjustOnHit();      // ✅ adaptive+ (play only)
        gainFever(20);

        fxScore(x, y, d, 'STAR', true);
        emitJudge('STAR BONUS');
        emitScore({ score, combo, misses });

        updateGoalOnHit(ch);
        updateMiniOnHit(ch, true);
        pushQuest();
        return;
      }

      if (ch === POWER_FIRE) {
        startFever();
        const d = 25;
        score += d;
        combo += 1;
        comboMax = Math.max(comboMax, combo);

        adjustOnHit();
        fxScore(x, y, d, 'FEVER', true);

        coach('โหมดไฟ! เลือกอาหารดีรัว ๆ แล้วเลี่ยงของขยะนะ 🔥', 3500);
        emitJudge('FEVER');
        emitScore({ score, combo, misses });

        updateGoalOnHit(ch);
        updateMiniOnHit(ch, true);
        pushQuest();
        return;
      }

      if (ch === POWER_SHIELD) {
        shield = Math.min(3, shield + 1);
        setShield(shield);

        const d = 20;
        score += d;
        combo += 1;
        comboMax = Math.max(comboMax, combo);

        adjustOnHit();
        fxScore(x, y, d, 'SHIELD', true);

        coach('ได้เกราะกันของขยะแล้ว ถ้าเผลอแตะจะไม่ถือว่าพลาด 1 ครั้ง 🛡️', 4000);
        emitJudge('SHIELD');
        emitScore({ score, combo, misses });

        updateGoalOnHit(ch);
        updateMiniOnHit(ch, true);
        pushQuest();
        return;
      }
    }

    // ----- Good / Junk -----
    if (type === 'good') {
      const base = 10 + combo * 2;
      const gain = base * scoreMultiplier();
      score += gain;
      combo += 1;
      comboMax = Math.max(comboMax, combo);
      goodStreak += 1;

      adjustOnHit();                // ✅ adaptive+ (play only)
      gainFever(feverGainHit);      // ✅ จาก table

      fxScore(x, y, gain, combo >= 8 ? 'PERFECT' : 'GOOD', true);
      emitJudge(combo >= 8 ? 'PERFECT' : 'GOOD');
      emitScore({ score, combo, misses });

      if (combo === 3) coach('คอมโบ x3 แล้ว เก็บต่อให้ยาว ๆ เลย 💪', 3200);
      if (combo === 6) coach('สุดยอด! คอมโบเริ่มยาวแล้ว ระวังของขยะให้ดีนะ ✨', 3200);

      updateGoalOnHit(ch);
      updateMiniOnHit(ch, true);
      pushQuest();
      return;
    }

    if (type === 'junk') {
      if (shield > 0) {
        shield -= 1;
        setShield(shield);
        fxScore(x, y, 0, 'BLOCK', false);
        emitJudge('BLOCK');
        coach('เกราะช่วยกันของขยะไว้ให้แล้ว แต่ระวังอย่าเผลอบ่อยเกินไปนะ 🛡️', 3800);
        return;
      }

      const loss = -10;
      score = Math.max(0, score + loss);

      combo = 0;
      goodStreak = 0;
      misses += 1;

      adjustOnMiss();               // ✅ adaptive+ (play only)
      loseFever(feverLossMiss);     // ✅ จาก table

      fxScore(x, y, loss, 'MISS', false);
      emitMiss(misses);
      emitJudge('MISS');
      emitScore({ score, combo, misses });

      coach('โดนของขยะแล้ว ลองสังเกตสีและรูปร่างให้ดีขึ้นอีกนิดนะ 🍔🍟🍩', 3800);

      updateMiniOnHit(ch, false);
      pushQuest();
    }
  }

  // ---------- Start / Stop / Public API ----------
  function start (diff, opts = {}) {
    if (running) return;

    // layer
    layerEl = opts.layerEl || document.getElementById('fg-layer') || document.body;

    // runMode: จาก opts.runMode หรือ URL param run
    const url = new URL(window.location.href);
    const runParam = String(opts.runMode || url.searchParams.get('run') || 'play').toLowerCase();
    runMode = (runParam === 'research') ? 'research' : 'play';

    // reset
    running = true;

    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    goodStreak = 0;

    fever = 0;
    feverActive = false;
    shield = 0;

    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    setShield(0);

    currentGoalIdx = 0;
    currentMiniIdx = 0;
    goalProg = 0;
    miniFlags = { comboDone: false, streakDone: false, groupsDone: false };
    seenGroups = new Set();

    // clear targets
    activeTargets.forEach(t => destroyTarget(t, false));
    activeTargets = [];

    applyDifficulty(String(diff || 'normal').toLowerCase());

    coach(runMode === 'research'
      ? 'โหมดวิจัย: ขนาดเป้าคงที่ตามระดับความยาก (easy/normal/hard) ✅'
      : 'โหมดธรรมดา: ขนาดเป้าจะปรับ (adaptive+) ตามการเล่นของเรา ✅', 2500);

    emitScore({ score, combo, misses });
    emitJudge('');
    pushQuest('เริ่มเกม Food Groups');

    // start projection loop (สำคัญ)
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tickProjectLoop);

    // spawn loop
    tickSpawn();
    spawnTimer = setInterval(tickSpawn, spawnInterval);
  }

  function tickSpawn () {
    if (!running) return;
    if (activeTargets.length >= maxActive) return;

    const type = Math.random() < 0.8 ? 'good' : 'junk';
    createTarget(type);
  }

  function stop (reason) {
    if (!running) return;
    running = false;

    if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

    activeTargets.forEach(t => destroyTarget(t, false));
    activeTargets = [];

    const meta = questMeta();
    const { goalsCleared, minisCleared } = meta;

    emit('hha:end', {
      mode: 'FoodGroupsVR',
      runMode,
      difficulty: diffKey,
      score,
      scoreFinal: score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal: GOALS.length,
      miniCleared: minisCleared,
      miniTotal: MINIS.length,
      reason: reason || 'manual'
    });

    coach('จบเกมแล้ว! ลองดูสรุปคะแนนด้านบนได้เลย 🎉', 3200);
  }

  function setLayer (el) { layerEl = el; }

  ns.GameEngine = { start, stop, setLayerEl: setLayer };

})(window.GroupsVR = window.GroupsVR || {});