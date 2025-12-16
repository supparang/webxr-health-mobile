// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — DOM Emoji Targets + Fever + Quest + Celebration
// 2025-12 — FULL UPDATE (STABLE)
// ✅ FIX: เป้าไม่โผล่ -> รอ camera + fallback 2D + auto re-anchor
// ✅ FIX: เป้าเลื่อนตามกล้อง (3D anchor + project)
// ✅ FIX: difficulty.foodgroups.js จริง
// ✅ NEW: Adaptive+ (play only)
// ✅ NEW: Research fixed (no adaptive)
// ✅ NEW: logger events/stat/session

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
  const THREE = ROOT.THREE;

  function getSceneEl () { return document.querySelector('a-scene'); }
  function getCamEl () { return document.querySelector('#fg-camera') || document.querySelector('a-camera'); }

  function getThreeCamera () {
    const scene = getSceneEl();
    const camEl = getCamEl();
    const c = camEl && camEl.getObject3D ? camEl.getObject3D('camera') : null;
    if (c) return c;
    if (scene && scene.camera) return scene.camera;
    return null;
  }

  // ---------- Emoji pools ----------
  const GROUPS = {
    1: ['🍗', '🥩', '🍖', '🐟', '🍳', '🥚', '🫘', '🥜', '🧀', '🥛'],
    2: ['🍚', '🍞', '🥖', '🥐', '🥯', '🥨', '🥔', '🍠', '🥣'],
    3: ['🥦', '🥕', '🍅', '🥬', '🥒', '🌽'],
    4: ['🍎', '🍌', '🍊', '🍇', '🍉', '🍓', '🍍'],
    5: ['🧈', '🥓', '🧇', '🥑']
  };

  const GOOD_GROUP_POOL = [
    { id: 1, weight: 1.2 },
    { id: 2, weight: 1.2 },
    { id: 3, weight: 1.0 },
    { id: 4, weight: 1.0 },
    { id: 5, weight: 0.5 }
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

  let rafId = null;
  let spawnTimer = null;

  let activeTargets = [];

  // runtime params
  let diffKey = 'normal';
  let runMode = 'play'; // play | research

  // session
  let sessionId = '';
  let startMs = 0;

  // difficulty
  let D = null;
  let spawnInterval = 1000;
  let maxActive = 4;
  let lifetimeBase = 2200;
  let baseScale = 1.0;
  let feverGainHit = 7;
  let feverLossMiss = 16;

  // adaptive+ (play only)
  let adaptiveScale = 1.0;
  let adaptiveSpawn = 1.0;
  let adaptiveMaxActive = 0;
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

  // analytics
  let nTargetGoodSpawned = 0;
  let nTargetJunkSpawned = 0;
  let nTargetStarSpawned = 0;
  let nTargetShieldSpawned = 0;
  let nTargetDiamondSpawned = 0; // FIRE
  let nHitGood = 0;
  let nHitJunk = 0;
  let nHitJunkGuard = 0;
  let nExpireGood = 0;

  let rtGoodArr = [];
  let fastHitCount = 0;

  // 3D projection temps
  const tmpV = THREE ? new THREE.Vector3() : null;
  const tmpCamPos = THREE ? new THREE.Vector3() : null;
  const tmpDir = THREE ? new THREE.Vector3() : null;
  const tmpRight = THREE ? new THREE.Vector3() : null;
  const tmpUp = THREE ? new THREE.Vector3() : null;

  function clamp (v, min, max) { return v < min ? min : (v > max ? max : v); }

  function nowFromStartMs () {
    return startMs ? (performance.now() - startMs) : 0;
  }

  // ---------- Safe fallback 2D pos (กันทับ HUD/fever/VR button) ----------
  function randomScreenPosSafe(){
    const w = window.innerWidth;
    const h = window.innerHeight;

    const padTop = 190;
    const padBot = 130;
    const padSide = 40;

    const x = padSide + Math.random() * Math.max(1, (w - padSide*2));
    const y = padTop + Math.random() * Math.max(1, (h - padTop - padBot));
    return { x, y };
  }

  // ---------- Difficulty ----------
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
      feverLossMiss: 16
    };

    spawnInterval = D.spawnInterval | 0;
    maxActive = D.maxActive | 0;
    lifetimeBase = D.lifetime | 0;
    baseScale = Number(D.scale) || 1.0;
    feverGainHit = Number(D.feverGainHit) || 7;
    feverLossMiss = Number(D.feverLossMiss) || 16;

    adaptiveScale = baseScale;
    adaptiveSpawn = 1.0;
    adaptiveMaxActive = 0;
    missStreak = 0;
    adjustCooldownUntil = 0;
  }

  // ---------- Fever ----------
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

  // ---------- Logger helpers ----------
  function emitGameEvent(payload) {
    emit('hha:event', Object.assign({
      sessionId,
      mode: 'FoodGroupsVR',
      difficulty: diffKey,
      timeFromStartMs: Math.round(nowFromStartMs())
    }, payload || {}));
  }

  function emitStat(extra = {}) {
    if (runMode !== 'play') return;
    emit('hha:stat', Object.assign({
      sessionId,
      mode: 'FoodGroupsVR',
      difficulty: diffKey,
      adaptiveScale,
      adaptiveSpawn,
      adaptiveMaxActive,
      score,
      combo,
      misses,
      timeFromStartMs: Math.round(nowFromStartMs())
    }, extra));
  }

  function computeRtStats() {
    const arr = rtGoodArr.slice().filter(n => typeof n === 'number' && isFinite(n) && n >= 0);
    if (!arr.length) return { avg: '', median: '', fastRate: '' };
    const sum = arr.reduce((a,b)=>a+b,0);
    const avg = sum / arr.length;
    arr.sort((a,b)=>a-b);
    const mid = Math.floor(arr.length/2);
    const median = (arr.length % 2) ? arr[mid] : (arr[mid-1] + arr[mid]) / 2;
    const fastRate = (fastHitCount / arr.length) * 100;
    return {
      avg: Math.round(avg),
      median: Math.round(median),
      fastRate: Math.round(fastRate * 10) / 10
    };
  }

  function emitSessionEnd(reason) {
    const rt = computeRtStats();

    const denomGood = (nHitGood + nExpireGood);
    const accuracyGoodPct = denomGood ? Math.round((nHitGood / denomGood) * 1000) / 10 : '';

    const denomAllHit = (nHitGood + nHitJunk);
    const junkErrorPct = denomAllHit ? Math.round((nHitJunk / denomAllHit) * 1000) / 10 : '';

    emit('hha:session', {
      sessionId,
      mode: 'FoodGroupsVR',
      runMode,
      difficulty: diffKey,
      durationSecPlayed: Math.round(nowFromStartMs() / 1000),

      scoreFinal: score,
      score,
      comboMax,
      misses,

      goalsCleared: questMeta().goalsCleared,
      goalsTotal: GOALS.length,
      miniCleared: questMeta().minisCleared,
      miniTotal: MINIS.length,

      nTargetGoodSpawned,
      nTargetJunkSpawned,
      nTargetStarSpawned,
      nTargetDiamondSpawned,
      nTargetShieldSpawned,

      nHitGood,
      nHitJunk,
      nHitJunkGuard,
      nExpireGood,

      accuracyGoodPct,
      junkErrorPct,

      avgRtGoodMs: rt.avg,
      medianRtGoodMs: rt.median,
      fastHitRatePct: rt.fastRate,

      reason: reason || 'manual',
      startTimeIso: new Date(Date.now() - Math.round(nowFromStartMs())).toISOString(),
      endTimeIso: new Date().toISOString(),

      gameVersion: 'FoodGroupsVR-2025-12-stable'
    });
  }

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
      celebrate('all', {
        goals: meta.goalsCleared,
        minis: meta.minisCleared,
        goalsTotal: GOALS.length,
        minisTotal: MINIS.length
      });
      emit('quest:all-cleared', {
        goals: meta.goalsCleared,
        minis: meta.minisCleared,
        goalsTotal: GOALS.length,
        minisTotal: MINIS.length
      });
      coach('สุดยอด! เคลียร์ทุกภารกิจแล้ว 🎉 ฉลองใหญ่แล้วมาดูสรุปคะแนนกัน!', 4000);
      stop('quest-complete');
      return;
    }
  }

  // ---------- Adaptive+ (play only) ----------
  function currentScale () {
    return (runMode === 'research') ? baseScale : adaptiveScale;
  }

  function adaptive_onHit () {
    if (runMode !== 'play') return;

    missStreak = 0;
    const now = performance.now();
    if (now < adjustCooldownUntil) return;

    if (combo >= 6) {
      adaptiveScale *= 0.96;
      adaptiveScale = clamp(adaptiveScale, baseScale * 0.70, baseScale * 1.55);

      adaptiveSpawn *= 0.95;
      adaptiveSpawn = clamp(adaptiveSpawn, 0.75, 1.25);

      adaptiveMaxActive = clamp(adaptiveMaxActive + 1, 0, 2);

      adjustCooldownUntil = now + 1500;
      emitStat({ reason: 'adaptive-hit' });
    }
  }

  function adaptive_onMiss () {
    if (runMode !== 'play') return;

    missStreak += 1;
    const now = performance.now();
    if (now < adjustCooldownUntil) return;

    if (missStreak >= 3) {
      adaptiveScale *= 1.12;
      adaptiveScale = clamp(adaptiveScale, baseScale * 0.70, baseScale * 1.55);

      adaptiveSpawn *= 1.12;
      adaptiveSpawn = clamp(adaptiveSpawn, 0.75, 1.45);

      adaptiveMaxActive = clamp(adaptiveMaxActive - 1, -1, 0);

      adjustCooldownUntil = now + 1800;
      emitStat({ reason: 'adaptive-miss' });
    }
  }

  // ---------- 3D anchor -> 2D projection ----------
  function spawnAnchorWorldPos () {
    const camEl = getCamEl();
    if (!THREE || !camEl || !camEl.object3D || !tmpCamPos || !tmpDir || !tmpRight || !tmpUp) return null;

    const dist = 2.2;
    const ox = (Math.random() - 0.5) * 1.8;
    const oy = (Math.random() - 0.5) * 1.2;

    camEl.object3D.getWorldPosition(tmpCamPos);
    camEl.object3D.getWorldDirection(tmpDir);

    tmpRight.set(1, 0, 0).applyQuaternion(camEl.object3D.quaternion).normalize();
    tmpUp.set(0, 1, 0).applyQuaternion(camEl.object3D.quaternion).normalize();

    const pos = new THREE.Vector3().copy(tmpCamPos)
      .add(tmpDir.clone().multiplyScalar(dist))
      .add(tmpRight.clone().multiplyScalar(ox))
      .add(tmpUp.clone().multiplyScalar(oy));

    return pos;
  }

  function projectToScreen (posWorld, cam) {
    if (!THREE || !cam || !posWorld || !tmpV) return null;

    tmpV.copy(posWorld).project(cam);
    if (tmpV.z < -1 || tmpV.z > 1) return null;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = (tmpV.x * 0.5 + 0.5) * w;
    const y = (-tmpV.y * 0.5 + 0.5) * h;
    return { x, y };
  }

  // ✅ Project loop (camera ready? -> project / else fallback 2D)
  function tickProjectLoop () {
    if (!running) return;

    const cam = getThreeCamera();
    const hasCam = !!cam;

    for (const t of activeTargets) {
      if (!t || !t.el) continue;

      t.el.style.transform = `translate(-50%, -50%) scale(${currentScale().toFixed(3)})`;

      if (!hasCam) {
        const p = t.fallback2D || randomScreenPosSafe();
        t.fallback2D = p;
        t.el.style.opacity = '1';
        t.el.style.left = p.x + 'px';
        t.el.style.top  = p.y + 'px';
        continue;
      }

      const p = projectToScreen(t.posWorld, cam);
      if (!p) {
        const now = performance.now();
        if (!t.offscreenSince) t.offscreenSince = now;

        if (now - t.offscreenSince > 250) {
          t.posWorld = spawnAnchorWorldPos();
          t.fallback2D = randomScreenPosSafe();
          t.offscreenSince = 0;
        }

        const fb = t.fallback2D || randomScreenPosSafe();
        t.fallback2D = fb;
        t.el.style.opacity = '1';
        t.el.style.left = fb.x + 'px';
        t.el.style.top  = fb.y + 'px';
        continue;
      }

      t.offscreenSince = 0;
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

  function createTarget (kindWanted) {
    if (!layerEl) return null;

    const el = document.createElement('div');
    el.className = 'fg-target ' + (kindWanted === 'good' ? 'fg-good' : 'fg-junk');

    let emoji = '';
    let kind = kindWanted;

    if (kindWanted === 'good') {
      if (Math.random() < 0.08) {
        emoji = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
        kind = 'power';
      } else {
        emoji = pickGoodEmoji();
        kind = 'good';
      }
    } else {
      emoji = JUNK[Math.floor(Math.random() * JUNK.length)];
      kind = 'junk';
    }

    el.dataset.kind = kind;
    el.dataset.emoji = emoji;
    el.setAttribute('data-emoji', emoji);

    if (kind === 'good') nTargetGoodSpawned++;
    else if (kind === 'junk') nTargetJunkSpawned++;
    else if (kind === 'power') {
      if (emoji === POWER_STAR) nTargetStarSpawned++;
      else if (emoji === POWER_SHIELD) nTargetShieldSpawned++;
      else if (emoji === POWER_FIRE) nTargetDiamondSpawned++;
    }

    const posWorld = spawnAnchorWorldPos();
    const fb = randomScreenPosSafe();

    const tObj = {
      el,
      type: kind,
      emoji,
      posWorld,
      fallback2D: fb,
      offscreenSince: 0,
      bornAt: performance.now(),
      timeout: null,
      targetId: 't_' + Math.floor(Math.random() * 1e9).toString(16)
    };

    // ✅ โผล่แน่นอนตั้งแต่เฟรมแรก
    el.style.left = fb.x + 'px';
    el.style.top  = fb.y + 'px';

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

    el.addEventListener('pointerdown', onClick, { passive:false });
    el.addEventListener('click', onClick, { passive:false });

    const life = Math.max(650, lifetimeBase + (Math.random() * 450 - 220));
    tObj.timeout = setTimeout(() => {
      if (!running) return;
      destroyTarget(tObj, false);

      if (kind === 'good') {
        nExpireGood++;
        misses += 1;
        combo = 0;
        goodStreak = 0;

        adaptive_onMiss();
        loseFever(feverLossMiss);

        emitMiss(misses);
        emitJudge('MISS');
        emitScore({ score, combo, misses });

        emitGameEvent({
          type: 'expire',
          eventType: 'expire',
          itemType: 'good',
          isGood: true,
          emoji,
          targetId: tObj.targetId,
          totalScore: score,
          combo,
          misses,
          judgment: 'MISS',
          feverState: feverActive ? 'active' : 'charge',
          feverValue: fever
        });
      }
    }, life);

    return tObj;
  }

  function handleHit (tObj, x, y) {
    if (!running || !tObj || !tObj.el) return;

    const type = tObj.type;
    const ch = tObj.emoji;

    const rtMs = Math.max(0, Math.round(performance.now() - (tObj.bornAt || performance.now())));

    destroyTarget(tObj, true);

    // ----- Power-ups -----
    if (type === 'power') {
      if (ch === POWER_STAR) {
        const d = 40 * scoreMultiplier();
        score += d;
        combo += 1;
        comboMax = Math.max(comboMax, combo);

        adaptive_onHit();
        gainFever(20);

        fxScore(x, y, d, 'STAR', true);
        emitJudge('STAR BONUS');
        emitScore({ score, combo, misses });

        emitGameEvent({
          type: 'hit',
          eventType: 'hit',
          itemType: 'power',
          emoji: ch,
          isGood: true,
          rtMs,
          targetId: tObj.targetId,
          judgment: 'STAR',
          totalScore: score,
          combo,
          feverState: feverActive ? 'active' : 'charge',
          feverValue: fever
        });

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

        adaptive_onHit();
        fxScore(x, y, d, 'FEVER', true);

        coach('โหมดไฟ! เลือกอาหารดีรัว ๆ แล้วเลี่ยงของขยะนะ 🔥', 3500);
        emitJudge('FEVER');
        emitScore({ score, combo, misses });

        emitGameEvent({
          type: 'hit',
          eventType: 'hit',
          itemType: 'power',
          emoji: ch,
          isGood: true,
          rtMs,
          targetId: tObj.targetId,
          judgment: 'FEVER',
          totalScore: score,
          combo,
          feverState: 'active',
          feverValue: fever
        });

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

        adaptive_onHit();
        fxScore(x, y, d, 'SHIELD', true);

        coach('ได้เกราะกันของขยะแล้ว ถ้าเผลอแตะจะไม่ถือว่าพลาด 1 ครั้ง 🛡️', 4000);
        emitJudge('SHIELD');
        emitScore({ score, combo, misses });

        emitGameEvent({
          type: 'hit',
          eventType: 'hit',
          itemType: 'power',
          emoji: ch,
          isGood: true,
          rtMs,
          targetId: tObj.targetId,
          judgment: 'SHIELD',
          totalScore: score,
          combo,
          feverState: feverActive ? 'active' : 'charge',
          feverValue: fever
        });

        updateGoalOnHit(ch);
        updateMiniOnHit(ch, true);
        pushQuest();
        return;
      }
    }

    // ----- Good -----
    if (type === 'good') {
      nHitGood++;

      const base = 10 + combo * 2;
      const gain = base * scoreMultiplier();
      score += gain;
      combo += 1;
      comboMax = Math.max(comboMax, combo);
      goodStreak += 1;

      rtGoodArr.push(rtMs);
      if (rtMs <= 450) fastHitCount++;

      adaptive_onHit();
      gainFever(feverGainHit);

      fxScore(x, y, gain, combo >= 8 ? 'PERFECT' : 'GOOD', true);
      emitJudge(combo >= 8 ? 'PERFECT' : 'GOOD');
      emitScore({ score, combo, misses });

      emitGameEvent({
        type: 'hit',
        eventType: 'hit',
        itemType: 'good',
        emoji: ch,
        isGood: true,
        rtMs,
        targetId: tObj.targetId,
        judgment: (combo >= 8 ? 'PERFECT' : 'GOOD'),
        totalScore: score,
        combo,
        misses,
        feverState: feverActive ? 'active' : 'charge',
        feverValue: fever
      });

      if (combo === 3) coach('คอมโบ x3 แล้ว เก็บต่อให้ยาว ๆ เลย 💪', 3200);
      if (combo === 6) coach('สุดยอด! คอมโบเริ่มยาวแล้ว ระวังของขยะให้ดีนะ ✨', 3200);

      updateGoalOnHit(ch);
      updateMiniOnHit(ch, true);
      pushQuest();
      return;
    }

    // ----- Junk -----
    if (type === 'junk') {
      if (shield > 0) {
        shield -= 1;
        setShield(shield);
        nHitJunkGuard++;

        fxScore(x, y, 0, 'BLOCK', false);
        emitJudge('BLOCK');
        coach('เกราะช่วยกันของขยะไว้ให้แล้ว แต่ระวังอย่าเผลอบ่อยเกินไปนะ 🛡️', 3800);

        emitGameEvent({
          type: 'hit',
          eventType: 'hit',
          itemType: 'junk',
          emoji: ch,
          isGood: false,
          rtMs,
          targetId: tObj.targetId,
          judgment: 'BLOCK',
          totalScore: score,
          combo,
          misses,
          feverState: feverActive ? 'active' : 'charge',
          feverValue: fever
        });

        return;
      }

      nHitJunk++;

      const loss = -10;
      score = Math.max(0, score + loss);

      combo = 0;
      goodStreak = 0;
      misses += 1;

      adaptive_onMiss();
      loseFever(feverLossMiss);

      fxScore(x, y, loss, 'MISS', false);
      emitMiss(misses);
      emitJudge('MISS');
      emitScore({ score, combo, misses });

      emitGameEvent({
        type: 'hit',
        eventType: 'hit',
        itemType: 'junk',
        emoji: ch,
        isGood: false,
        rtMs,
        targetId: tObj.targetId,
        judgment: 'MISS',
        totalScore: score,
        combo,
        misses,
        feverState: feverActive ? 'active' : 'charge',
        feverValue: fever
      });

      coach('โดนของขยะแล้ว ลองสังเกตสีและรูปร่างให้ดีขึ้นอีกนิดนะ 🍔🍟🍩', 3800);

      updateMiniOnHit(ch, false);
      pushQuest();
    }
  }

  // ---------- Spawn loop ----------
  function tickSpawn () {
    if (!running) return;

    const capRaw = maxActive + ((runMode === 'play') ? adaptiveMaxActive : 0);
    const cap = Math.max(1, capRaw);

    if (activeTargets.length >= cap) return;

    const kind = Math.random() < 0.8 ? 'good' : 'junk';
    createTarget(kind);
  }

  function scheduleNextSpawn () {
    if (!running) return;

    const mult = (runMode === 'play') ? adaptiveSpawn : 1.0;
    const nextMs = Math.max(220, Math.round(spawnInterval * mult));

    spawnTimer = setTimeout(() => {
      tickSpawn();
      scheduleNextSpawn();
    }, nextMs);
  }

  // ---------- Start / Stop ----------
  function start (diff, opts = {}) {
    if (running) return;

    layerEl = opts.layerEl || document.getElementById('fg-layer') || document.body;

    const url = new URL(window.location.href);
    const runParam = String(opts.runMode || url.searchParams.get('run') || 'play').toLowerCase();
    runMode = (runParam === 'research') ? 'research' : 'play';

    try {
      sessionId = (ROOT.crypto && typeof ROOT.crypto.randomUUID === 'function')
        ? ROOT.crypto.randomUUID()
        : ('sess_' + Date.now() + '_' + Math.floor(Math.random() * 9999));
    } catch {
      sessionId = ('sess_' + Date.now() + '_' + Math.floor(Math.random() * 9999));
    }

    startMs = performance.now();

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

    nTargetGoodSpawned = 0;
    nTargetJunkSpawned = 0;
    nTargetStarSpawned = 0;
    nTargetShieldSpawned = 0;
    nTargetDiamondSpawned = 0;
    nHitGood = 0;
    nHitJunk = 0;
    nHitJunkGuard = 0;
    nExpireGood = 0;
    rtGoodArr = [];
    fastHitCount = 0;

    activeTargets.forEach(t => destroyTarget(t, false));
    activeTargets = [];

    applyDifficulty(String(diff || 'normal').toLowerCase());

    coach(runMode === 'research'
      ? 'โหมดวิจัย: ขนาด/จังหวะคงที่ตามระดับความยาก ✅'
      : 'โหมดธรรมดา: ขนาดเป้า + จังหวะเกมจะปรับ (adaptive+) ตามการเล่น ✅', 2500);

    emitScore({ score, combo, misses });
    emitJudge('');
    pushQuest('เริ่มเกม Food Groups');

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tickProjectLoop);

    if (spawnTimer) clearTimeout(spawnTimer);
    tickSpawn();
    scheduleNextSpawn();

    if (ns.__statTimer) clearInterval(ns.__statTimer);
    ns.__statTimer = setInterval(() => {
      if (!running) return;
      emitStat({ reason: 'tick' });
    }, 1500);

    emitStat({ reason: 'start' });
    emitGameEvent({ type: 'start', eventType: 'start', totalScore: 0, combo: 0, misses: 0 });
  }

  function stop (reason) {
    if (!running) return;
    running = false;

    if (spawnTimer) { clearTimeout(spawnTimer); spawnTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

    if (ns.__statTimer) {
      clearInterval(ns.__statTimer);
      ns.__statTimer = null;
    }

    activeTargets.forEach(t => destroyTarget(t, false));
    activeTargets = [];

    emitSessionEnd(reason || 'manual');

    const meta = questMeta();
    emit('hha:end', {
      mode: 'FoodGroupsVR',
      runMode,
      difficulty: diffKey,
      score,
      scoreFinal: score,
      comboMax,
      misses,
      goalsCleared: meta.goalsCleared,
      goalsTotal: GOALS.length,
      miniCleared: meta.minisCleared,
      miniTotal: MINIS.length,
      reason: reason || 'manual'
    });

    emitGameEvent({ type: 'end', eventType: 'end', totalScore: score, combo: comboMax, misses, judgment: String(reason || 'end') });
    emitStat({ reason: 'end' });

    coach('จบเกมแล้ว! ลองดูสรุปคะแนนด้านบนได้เลย 🎉', 3200);
  }

  function setLayer (el) { layerEl = el; }

  ns.GameEngine = { start, stop, setLayerEl: setLayer };

})(window.GroupsVR = window.GroupsVR || {});
