// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — DOM Emoji Targets + Fever + QuestManager(phase 1–5) + Celebration + Logger
// FULL FIX PACK:
// ✅ ใช้ window.GroupsQuest.createFoodGroupsQuest (quest-manager.js) จริง
// ✅ Phase 5 หมู่: spawn “อาหารดี” ตามหมู่ที่กำลังเล่น (หมู่เปลี่ยนทุก 15s ตาม quest-manager)
// ✅ Clamp safe zone ไม่ให้ชน HUD / ขอบจอ + Smooth movement กัน “วิ่งวุ่น”
// ✅ ไม่กด 2 ที: ใช้ pointerdown อย่างเดียว (ตัด click ซ้ำ)
// ✅ VR gaze/fuse: จ้องกลางจอค้างเพื่อ “ตี” เป้า (DOM targets) ได้ใน VR
// ✅ hha:miss ส่งเป็นค่าจริง (HTML ต้องไม่ +1 ซ้ำ)
// ✅ ยิง hha:event / hha:session / hha:stat ตามเดิม

(function (ns) {
  'use strict';

  const ROOT = (typeof window !== 'undefined' ? window : globalThis);
  const THREE = ROOT.THREE;

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

  // Quest manager (non-module)
  const QuestFactory = ROOT.GroupsQuest && typeof ROOT.GroupsQuest.createFoodGroupsQuest === 'function'
    ? ROOT.GroupsQuest.createFoodGroupsQuest
    : null;

  // Difficulty table
  function getDifficultyFromTable (key) {
    const HH = (ROOT.HeroHealth || {});
    const tbl = HH.foodGroupsDifficulty;
    if (tbl && typeof tbl.get === 'function') return tbl.get(key);
    return null;
  }

  // ---------- DOM helpers ----------
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

  function emit (type, detail) {
    try { ROOT.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
  }
  function emitScore (state) { emit('hha:score', state); }
  function emitJudge (label) { emit('hha:judge', { label }); }
  function emitMissCount (misses) { emit('hha:miss', { misses }); }

  function coach (text, minGapMs) {
    if (!text) return;
    const now = Date.now();
    coach._last = coach._last || 0;
    if (minGapMs && now - coach._last < minGapMs) return;
    coach._last = now;
    emit('hha:coach', { text });
  }

  // ---------- Emoji pools ----------
  // junk
  const JUNK = ['🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧋','🥤','🍫','🧁'];

  // powerups
  const POWER_STAR   = '⭐';
  const POWER_FIRE   = '🔥';
  const POWER_SHIELD = '🛡️';
  const POWERUPS = [POWER_STAR, POWER_FIRE, POWER_SHIELD];

  // fallback good pools (ถ้า quest-manager ไม่อยู่)
  const GROUPS_FALLBACK = {
    1: ['🍗','🥩','🍖','🐟','🍳','🥚','🫘','🥜','🧀','🥛'],
    2: ['🍚','🍞','🥖','🥐','🥯','🥨','🥔','🍠','🥣'],
    3: ['🥦','🥕','🍅','🥬','🥒','🌽'],
    4: ['🍎','🍌','🍊','🍇','🍉','🍓','🍍'],
    5: ['🥑','🧈','🥓']
  };

  function clamp (v, min, max) { v = Number(v) || 0; return v < min ? min : (v > max ? max : v); }

  // ---------- Core runtime ----------
  let layerEl = null;
  let running = false;

  let rafId = null;         // project loop
  let spawnTimer = null;    // spawn loop
  let secTimer = null;      // quest second timer
  let statTimer = null;     // play stat tick

  let activeTargets = [];

  // runtime params
  let diffKey = 'normal';
  let runMode = 'play'; // play | research

  // quest manager instance
  let QM = null;

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

  // adaptive (play only)
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

  let fever = 0;
  let feverActive = false;
  let shield = 0;

  // analytics
  let nTargetGoodSpawned = 0;
  let nTargetJunkSpawned = 0;
  let nTargetStarSpawned = 0;
  let nTargetShieldSpawned = 0;
  let nTargetDiamondSpawned = 0;
  let nHitGood = 0;
  let nHitJunk = 0;
  let nHitJunkGuard = 0;
  let nExpireGood = 0;

  let rtGoodArr = [];
  let fastHitCount = 0;

  function nowFromStartMs () {
    return startMs ? (performance.now() - startMs) : 0;
  }

  // ---------- Fever ----------
  const FEVER_MAX = 100;
  function setFeverValue (next, hint) {
    fever = clamp(next, 0, FEVER_MAX);
    setFever(fever);
    emit('hha:fever', { state: hint || (feverActive ? 'active' : 'charge'), value: fever, max: FEVER_MAX });
  }
  function startFever () {
    if (feverActive) return;
    feverActive = true;
    setFeverActive(true);
    setFeverValue(FEVER_MAX, 'start');
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

  // ---------- Logger emitters ----------
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
    return { avg: Math.round(avg), median: Math.round(median), fastRate: Math.round(fastRate * 10) / 10 };
  }

  function emitSessionEnd(reason) {
    const rt = computeRtStats();
    const denomGood = (nHitGood + nExpireGood);
    const accuracyGoodPct = denomGood ? Math.round((nHitGood / denomGood) * 1000) / 10 : '';
    const denomAllHit = (nHitGood + nHitJunk);
    const junkErrorPct = denomAllHit ? Math.round((nHitJunk / denomAllHit) * 1000) / 10 : '';

    // quest meta จาก QM (ถ้ามี)
    let goalsCleared = 0, goalsTotal = 0, miniCleared = 0, miniTotal = 0;
    if (QM && QM.goals && QM.minis) {
      goalsTotal = QM.goals.length;
      miniTotal = QM.minis.length;
      goalsCleared = QM.goals.filter(g => g && g.done).length;
      miniCleared  = QM.minis.filter(m => m && m.done).length;
    }

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

      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal,

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

      gameVersion: 'FoodGroupsVR-2025-12-full-fixed'
    });
  }

  // ---------- Difficulty apply ----------
  function applyDifficulty (key) {
    diffKey = String(key || 'normal').toLowerCase();

    D = getDifficultyFromTable(diffKey) || {
      spawnInterval: 1100,
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

  // ---------- Adaptive ----------
  function currentScale () {
    return (runMode === 'research') ? baseScale : adaptiveScale;
  }

  function adaptive_onHit () {
    if (runMode !== 'play') return;
    missStreak = 0;
    const now = performance.now();
    if (now < adjustCooldownUntil) return;

    if (combo >= 6) {
      adaptiveScale = clamp(adaptiveScale * 0.97, baseScale * 0.78, baseScale * 1.40);
      adaptiveSpawn = clamp(adaptiveSpawn * 0.96, 0.80, 1.20);
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
      adaptiveScale = clamp(adaptiveScale * 1.10, baseScale * 0.78, baseScale * 1.55);
      adaptiveSpawn = clamp(adaptiveSpawn * 1.10, 0.80, 1.45);
      adaptiveMaxActive = clamp(adaptiveMaxActive - 1, -1, 0);
      adjustCooldownUntil = now + 1800;
      emitStat({ reason: 'adaptive-miss' });
    }
  }

  // ---------- 3D anchor → 2D projection ----------
  const tmpV = THREE ? new THREE.Vector3() : null;
  const tmpCamPos = THREE ? new THREE.Vector3() : null;
  const tmpDir = THREE ? new THREE.Vector3() : null;
  const tmpRight = THREE ? new THREE.Vector3() : null;
  const tmpUp = THREE ? new THREE.Vector3() : null;

  // “safe zone” กันชน HUD + fever + ปุ่ม VR
  function safeMarginsPx () {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const top = (w <= 640) ? 230 : 150;   // มือถือ HUD ซ้อน
    const bottom = 130;                  // fever + bottom bubble
    const side = 18;
    return { top, bottom, side };
  }

  function spawnAnchorWorldPos () {
    const camEl = getCamEl();
    if (!THREE || !camEl || !camEl.object3D) return null;

    // ระยะและการกระจาย “นุ่ม ๆ” ไม่โผล่สุดขอบจนดูวุ่น
    const dist = 2.25;
    const ox = (Math.random() - 0.5) * 1.35; // แคบลงจากเดิม
    const oy = (Math.random() - 0.5) * 0.95;

    camEl.object3D.getWorldPosition(tmpCamPos);
    camEl.object3D.getWorldDirection(tmpDir);

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

    tmpV.copy(posWorld).project(cam);
    if (tmpV.z < -1 || tmpV.z > 1) return null;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = (tmpV.x * 0.5 + 0.5) * w;
    const y = (-tmpV.y * 0.5 + 0.5) * h;
    return { x, y };
  }

  // ---------- FX ----------
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

  // ---------- Targets ----------
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

  function pickGoodEmojiByActiveGroup () {
    // ถ้ามี quest-manager: ใช้ emoji ของหมู่ปัจจุบันจริง
    if (QM && typeof QM.getActiveGroup === 'function') {
      const g = QM.getActiveGroup();
      const arr = (g && g.emojis && g.emojis.length) ? g.emojis : null;
      if (arr) return arr[Math.floor(Math.random() * arr.length)];
    }
    // fallback
    const gid = 1 + Math.floor(Math.random() * 5);
    const arr = GROUPS_FALLBACK[gid] || GROUPS_FALLBACK[1];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getActiveGroupId () {
    if (QM && typeof QM.getActiveGroup === 'function') {
      const g = QM.getActiveGroup();
      return (g && g.key) ? (g.key | 0) : 1;
    }
    return 1;
  }

  function createTarget (kindWanted) {
    if (!layerEl) return null;

    const el = document.createElement('div');
    el.className = 'fg-target ' + (kindWanted === 'good' ? 'fg-good' : 'fg-junk');
    el.style.left = '50%';
    el.style.top  = '50%';

    let emoji = '';
    let kind = kindWanted;

    if (kindWanted === 'good') {
      if (Math.random() < 0.08) {
        emoji = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
        kind = 'power';
      } else {
        emoji = pickGoodEmojiByActiveGroup();
        kind = 'good';
      }
    } else {
      emoji = JUNK[Math.floor(Math.random() * JUNK.length)];
      kind = 'junk';
    }

    el.dataset.kind = kind;
    el.dataset.emoji = emoji;
    el.setAttribute('data-emoji', emoji);

    // counts
    if (kind === 'good') nTargetGoodSpawned++;
    else if (kind === 'junk') nTargetJunkSpawned++;
    else if (kind === 'power') {
      if (emoji === POWER_STAR) nTargetStarSpawned++;
      else if (emoji === POWER_SHIELD) nTargetShieldSpawned++;
      else if (emoji === POWER_FIRE) nTargetDiamondSpawned++;
    }

    const posWorld = spawnAnchorWorldPos();

    const tObj = {
      el,
      type: kind,
      emoji,
      posWorld,
      bornAt: performance.now(),
      timeout: null,
      targetId: 't_' + Math.floor(Math.random() * 1e9).toString(16),

      // smooth state
      sx: null,
      sy: null
    };

    activeTargets.push(tObj);
    layerEl.appendChild(el);

    // ✅ FIX: ไม่ bind click ซ้ำ (pointerdown อย่างเดียว)
    const onPointer = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = (ev.clientX != null) ? ev.clientX : (rect.left + rect.width / 2);
      const cy = (ev.clientY != null) ? ev.clientY : (rect.top + rect.height / 2);
      handleHit(tObj, cx, cy, 'pointer');
    };
    el.addEventListener('pointerdown', onPointer, { passive: false });

    // lifetime
    const life = Math.max(650, lifetimeBase + (Math.random() * 420 - 210));
    tObj.timeout = setTimeout(() => {
      if (!running) return;
      destroyTarget(tObj, false);

      // expire good -> MISS
      if (kind === 'good') {
        nExpireGood++;
        misses += 1;
        combo = 0;

        adaptive_onMiss();
        loseFever(feverLossMiss);

        emitMissCount(misses);
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
          feverValue: fever,
          groupId: getActiveGroupId()
        });
      }
    }, life);

    return tObj;
  }

  function handleHit (tObj, x, y, via) {
    if (!running || !tObj || !tObj.el) return;

    const type = tObj.type;
    const ch = tObj.emoji;
    const rtMs = Math.max(0, Math.round(performance.now() - (tObj.bornAt || performance.now())));
    const groupId = getActiveGroupId();

    destroyTarget(tObj, true);

    // ----- Power -----
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
          type: 'hit', eventType: 'hit',
          itemType: 'power', emoji: ch, isGood: true,
          rtMs, via: via || 'pointer',
          targetId: tObj.targetId,
          judgment: 'STAR',
          totalScore: score, combo, misses,
          feverState: feverActive ? 'active' : 'charge',
          feverValue: fever,
          groupId
        });

        // quest hooks
        if (QM && QM.onGoodHit) QM.onGoodHit(groupId, combo);
        pushQuestUpdate('⭐ โบนัส!');
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
          type: 'hit', eventType: 'hit',
          itemType: 'power', emoji: ch, isGood: true,
          rtMs, via: via || 'pointer',
          targetId: tObj.targetId,
          judgment: 'FEVER',
          totalScore: score, combo, misses,
          feverState: 'active',
          feverValue: fever,
          groupId
        });

        if (QM && QM.onGoodHit) QM.onGoodHit(groupId, combo);
        pushQuestUpdate('🔥 FEVER!');
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

        coach('ได้เกราะแล้ว เผลอโดนขยะจะไม่พลาดทันที 🛡️', 3500);
        emitJudge('SHIELD');
        emitScore({ score, combo, misses });

        emitGameEvent({
          type: 'hit', eventType: 'hit',
          itemType: 'power', emoji: ch, isGood: true,
          rtMs, via: via || 'pointer',
          targetId: tObj.targetId,
          judgment: 'SHIELD',
          totalScore: score, combo, misses,
          feverState: feverActive ? 'active' : 'charge',
          feverValue: fever,
          groupId
        });

        if (QM && QM.onGoodHit) QM.onGoodHit(groupId, combo);
        pushQuestUpdate('🛡️ เกราะ!');
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

      rtGoodArr.push(rtMs);
      if (rtMs <= 450) fastHitCount++;

      adaptive_onHit();
      gainFever(feverGainHit);

      fxScore(x, y, gain, combo >= 8 ? 'PERFECT' : 'GOOD', true);
      emitJudge(combo >= 8 ? 'PERFECT' : 'GOOD');
      emitScore({ score, combo, misses });

      emitGameEvent({
        type: 'hit', eventType: 'hit',
        itemType: 'good', emoji: ch, isGood: true,
        rtMs, via: via || 'pointer',
        targetId: tObj.targetId,
        judgment: (combo >= 8 ? 'PERFECT' : 'GOOD'),
        totalScore: score, combo, misses,
        feverState: feverActive ? 'active' : 'charge',
        feverValue: fever,
        groupId
      });

      if (QM && QM.onGoodHit) QM.onGoodHit(groupId, combo);

      if (combo === 3) coach('คอมโบ x3 แล้ว 💪', 2500);
      if (combo === 6) coach('คอมโบเริ่มยาวแล้ว ระวังของขยะ ✨', 2800);

      pushQuestUpdate();
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
        coach('เกราะกันไว้ให้แล้ว แต่ระวังอย่าโดนบ่อยนะ 🛡️', 3200);

        emitGameEvent({
          type: 'hit', eventType: 'hit',
          itemType: 'junk', emoji: ch, isGood: false,
          rtMs, via: via || 'pointer',
          targetId: tObj.targetId,
          judgment: 'BLOCK',
          totalScore: score, combo, misses,
          feverState: feverActive ? 'active' : 'charge',
          feverValue: fever,
          groupId
        });

        if (QM && QM.onJunkHit) QM.onJunkHit(groupId);
        pushQuestUpdate();
        return;
      }

      nHitJunk++;

      score = Math.max(0, score - 10);
      combo = 0;
      misses += 1;

      adaptive_onMiss();
      loseFever(feverLossMiss);

      fxScore(x, y, -10, 'MISS', false);
      emitMissCount(misses);
      emitJudge('MISS');
      emitScore({ score, combo, misses });

      emitGameEvent({
        type: 'hit', eventType: 'hit',
        itemType: 'junk', emoji: ch, isGood: false,
        rtMs, via: via || 'pointer',
        targetId: tObj.targetId,
        judgment: 'MISS',
        totalScore: score, combo, misses,
        feverState: feverActive ? 'active' : 'charge',
        feverValue: fever,
        groupId
      });

      if (QM && QM.onJunkHit) QM.onJunkHit(groupId);

      coach('โดนของขยะแล้ว ลองโฟกัส “หมู่ปัจจุบัน” ให้ชัดขึ้นนะ 🍔🍟', 3200);
      pushQuestUpdate();
    }
  }

  // ---------- Quest update emitter ----------
  function pushQuestUpdate(hintText) {
    if (!QM || !QM.goals || !QM.minis) {
      // fallback: ส่ง null ให้ UI แสดงข้อความ default
      emit('quest:update', {
        goal: null, mini: null,
        goalsAll: [], minisAll: [],
        hint: hintText || '',
        meta: { goalsCleared: 0, goalsTotal: 0, minisCleared: 0, minisTotal: 0 }
      });
      return;
    }

    const goalsAll = QM.goals.map(g => ({
      id: g.id, label: g.label, target: g.target, prog: g.prog, done: !!g.done
    }));
    const minisAll = QM.minis.map(m => ({
      id: m.id, label: m.label, target: m.target, prog: m.prog, done: !!m.done
    }));

    const goalsCleared = goalsAll.filter(g => g.done).length;
    const minisCleared = minisAll.filter(m => m.done).length;

    // current goal/mini = ตัวแรกที่ยังไม่ done (ถ้าไม่มีให้ null)
    const goal = goalsAll.find(g => !g.done) || null;
    const mini = minisAll.find(m => !m.done) || null;

    emit('quest:update', {
      goal,
      mini,
      goalsAll,
      minisAll,
      hint: hintText || '',
      meta: {
        goalsCleared,
        goalsTotal: goalsAll.length,
        minisCleared,
        minisTotal: minisAll.length
      }
    });

    // เคลียร์ครบ -> celebrate + stop
    if (goalsCleared >= goalsAll.length && minisCleared >= minisAll.length) {
      emit('hha:celebrate', { type: 'all' });
      coach('สุดยอด! เคลียร์ครบทุกภารกิจแล้ว 🎉', 4000);
      stop('quest-complete');
    }
  }

  // ---------- Spawn loop ----------
  function tickSpawn () {
    if (!running) return;

    const cap = maxActive + ((runMode === 'play') ? adaptiveMaxActive : 0);
    if (activeTargets.length >= cap) return;

    // สัดส่วน junk ลดลงนิดให้ไม่ “วุ่น”
    const kind = Math.random() < 0.84 ? 'good' : 'junk';
    createTarget(kind);
  }

  function scheduleNextSpawn () {
    if (!running) return;
    const mult = (runMode === 'play') ? adaptiveSpawn : 1.0;
    const nextMs = Math.max(240, Math.round(spawnInterval * mult));
    spawnTimer = setTimeout(() => {
      tickSpawn();
      scheduleNextSpawn();
    }, nextMs);
  }

  // ---------- VR gaze/fuse for DOM targets ----------
  function isVRMode () {
    const scene = getSceneEl();
    try { return !!(scene && scene.is && scene.is('vr-mode')); } catch { return false; }
  }

  let gazeHoldId = '';
  let gazeHoldStart = 0;

  function tickGazeFuse() {
    if (!isVRMode()) {
      gazeHoldId = '';
      gazeHoldStart = 0;
      return;
    }

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    // หาเป้าที่ “ใกล้กึ่งกลาง” ที่สุดใน safe zone
    let best = null;
    let bestD = 1e9;

    for (const t of activeTargets) {
      if (!t || !t.el || !t.posWorld) continue;
      const p = projectToScreen(t.posWorld);
      if (!p) continue;

      const dx = p.x - cx;
      const dy = p.y - cy;
      const d2 = dx*dx + dy*dy;

      if (d2 < bestD) {
        bestD = d2;
        best = { t, p, d2 };
      }
    }

    // ต้องใกล้พอ (รัศมี ~ 60px)
    const THRESH2 = 60 * 60;
    if (!best || best.d2 > THRESH2) {
      gazeHoldId = '';
      gazeHoldStart = 0;
      return;
    }

    const id = best.t.targetId;
    const now = performance.now();

    if (gazeHoldId !== id) {
      gazeHoldId = id;
      gazeHoldStart = now;
      return;
    }

    // fuse time
    const fuseMs = 650;
    if (now - gazeHoldStart >= fuseMs) {
      // ยิง hit ด้วยพิกัด center
      handleHit(best.t, cx, cy, 'gaze');
      gazeHoldId = '';
      gazeHoldStart = 0;
    }
  }

  // ---------- Project loop (smooth + clamp safe zone) ----------
  function tickProjectLoop () {
    if (!running) return;

    const m = safeMarginsPx();
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const t of activeTargets) {
      if (!t || !t.el || !t.posWorld) continue;
      const p = projectToScreen(t.posWorld);

      if (!p) {
        t.el.style.opacity = '0';
        continue;
      }

      // clamp safe zone
      let x = clamp(p.x, m.side, w - m.side);
      let y = clamp(p.y, m.top, h - m.bottom);

      // smooth movement
      if (t.sx == null) { t.sx = x; t.sy = y; }
      const alpha = 0.18; // ยิ่งต่ำยิ่งนิ่ง
      t.sx = t.sx + (x - t.sx) * alpha;
      t.sy = t.sy + (y - t.sy) * alpha;

      t.el.style.opacity = '1';
      t.el.style.left = t.sx + 'px';
      t.el.style.top  = t.sy + 'px';
      t.el.style.transform = `translate(-50%, -50%) scale(${currentScale().toFixed(3)})`;
    }

    // VR gaze fuse
    tickGazeFuse();

    rafId = requestAnimationFrame(tickProjectLoop);
  }

  // ---------- Public API ----------
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

    // reset gameplay
    score = 0; combo = 0; comboMax = 0; misses = 0;
    fever = 0; feverActive = false; shield = 0;

    // reset analytics
    nTargetGoodSpawned = 0; nTargetJunkSpawned = 0;
    nTargetStarSpawned = 0; nTargetShieldSpawned = 0; nTargetDiamondSpawned = 0;
    nHitGood = 0; nHitJunk = 0; nHitJunkGuard = 0; nExpireGood = 0;
    rtGoodArr = []; fastHitCount = 0;

    // clear targets
    activeTargets.forEach(t => destroyTarget(t, false));
    activeTargets = [];

    // ui fever
    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    setShield(0);

    applyDifficulty(String(diff || 'normal').toLowerCase());

    // create quest manager
    QM = QuestFactory ? QuestFactory(diffKey) : null;

    coach(runMode === 'research'
      ? 'โหมดวิจัย: ค่าคงที่ตาม easy/normal/hard ✅'
      : 'โหมดธรรมดา: เกมปรับความยากแบบนุ่ม ๆ (adaptive+) ✅', 2200);

    emitScore({ score, combo, misses });
    emitJudge('');

    pushQuestUpdate('เริ่มเกม Food Groups');

    // project loop
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tickProjectLoop);

    // spawn loop
    if (spawnTimer) clearTimeout(spawnTimer);
    tickSpawn();
    scheduleNextSpawn();

    // quest second loop (sync กับ quest-manager)
    if (secTimer) clearInterval(secTimer);
    secTimer = setInterval(() => {
      if (!running) return;
      if (QM && typeof QM.second === 'function') {
        QM.second();
        pushQuestUpdate(); // refresh HUD goal/mini เมื่อหมู่เปลี่ยน
      }
    }, 1000);

    // stat tick
    if (statTimer) clearInterval(statTimer);
    statTimer = setInterval(() => {
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
    if (secTimer) { clearInterval(secTimer); secTimer = null; }
    if (statTimer) { clearInterval(statTimer); statTimer = null; }

    activeTargets.forEach(t => destroyTarget(t, false));
    activeTargets = [];

    emitSessionEnd(reason || 'manual');

    // quest meta
    let goalsCleared = 0, goalsTotal = 0, miniCleared = 0, miniTotal = 0;
    if (QM && QM.goals && QM.minis) {
      goalsTotal = QM.goals.length;
      miniTotal = QM.minis.length;
      goalsCleared = QM.goals.filter(g => g && g.done).length;
      miniCleared  = QM.minis.filter(m => m && m.done).length;
    }

    emit('hha:end', {
      mode: 'FoodGroupsVR',
      runMode,
      difficulty: diffKey,
      score,
      scoreFinal: score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal,
      reason: reason || 'manual'
    });

    emitGameEvent({
      type: 'end', eventType: 'end',
      totalScore: score,
      combo: comboMax,
      misses,
      judgment: String(reason || 'end')
    });

    emitStat({ reason: 'end' });
    coach('จบเกมแล้ว! ดูสรุปคะแนนได้เลย 🎉', 3200);
  }

  function setLayerEl (el) { layerEl = el; }

  ns.GameEngine = { start, stop, setLayerEl };

})(window.GroupsVR = window.GroupsVR || {});
