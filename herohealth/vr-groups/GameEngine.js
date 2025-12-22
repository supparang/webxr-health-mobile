// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION HYBRID ENGINE (DOM emoji targets + VR look parallax)
// ✅ IIFE -> window.GroupsVR.GameEngine
// ✅ Quest (IIFE) -> window.GroupsQuest.createFoodGroupsQuest(diff)
// ✅ Tap-anywhere + Aim assist (near finger / near center)
// ✅ Gaze Lock/Fuse ring + Burst + Charge shot (lockUI via events)
// ✅ Rush (x2) + Boss Wave + Boss HP + Decoy(Invert trap) + Rage(Double-feint)
// ✅ Adaptive (play mode only)
// ✅ CLUTCH: 3..2..1 tick + edge pulse (requires #edgePulse in HTML; auto-create if missing)

(function () {
  'use strict';

  const ns = (window.GroupsVR = window.GroupsVR || {});
  const ROOT = window;

  // --- Optional global helpers (IIFE modules) ---
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles ||
    { scorePop() {}, burstAt() {}, celebrateQuestFX() {}, celebrateAllQuestsFX() {} };

  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI ||
    { ensureFeverBar() {}, setFever() {}, setFeverActive() {}, setShield() {} };

  // --- small utils ---
  function now() { return (performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function dispatch(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch {} }
  function coach(text) { if (text) dispatch('hha:coach', { text: String(text) }); }
  function toRad(deg) { return (Number(deg) || 0) * Math.PI / 180; }
  function normAngleRad(a) {
    let x = a;
    while (x > Math.PI) x -= Math.PI * 2;
    while (x < -Math.PI) x += Math.PI * 2;
    return x;
  }

  // --- logging (uses your hha-cloud-logger.js listener) ---
  let sessionId = '';
  function isoNow() { try { return new Date().toISOString(); } catch { return ''; } }
  function uid() { return 'fg_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16); }
  function logSessionStart(meta) {
    if (!sessionId) sessionId = uid();
    dispatch('hha:log_session', Object.assign({
      sessionId,
      startedIso: isoNow(),
      game: 'FoodGroupsVR'
    }, meta || {}));
  }
  function logEvent(meta) {
    dispatch('hha:log_event', Object.assign({
      sessionId: sessionId || '',
      tMs: Math.round(now()),
      tsIso: isoNow(),
      game: 'FoodGroupsVR'
    }, meta || {}));
  }

  // --- audio / haptic ---
  let audioCtx = null;
  function tone(freq = 880, dur = 0.06, gain = 0.05, type = 'square') {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch {}
  }
  function haptic(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch {} }

  // --- Edge pulse overlay (CLUTCH) ---
  let edgeEl = null;
  function ensureEdge() {
    if (edgeEl && edgeEl.isConnected) return edgeEl;
    edgeEl = document.getElementById('edgePulse');
    if (!edgeEl) {
      edgeEl = document.createElement('div');
      edgeEl.id = 'edgePulse';
      edgeEl.setAttribute('aria-hidden', 'true');
      Object.assign(edgeEl.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity .12s ease',
        borderRadius: '24px',
        boxShadow: 'inset 0 0 0 2px rgba(245,158,11,0), inset 0 0 38px rgba(245,158,11,0)'
      });
      const hud = document.querySelector('.hud') || document.body;
      hud.appendChild(edgeEl);
    }
    return edgeEl;
  }
  function setEdgeOn(on) {
    const el = ensureEdge();
    if (!el) return;
    if (on) {
      el.style.opacity = '1';
      el.style.boxShadow = 'inset 0 0 0 2px rgba(245,158,11,.16), inset 0 0 38px rgba(245,158,11,.10)';
    } else {
      el.style.opacity = '0';
      el.style.boxShadow = 'inset 0 0 0 2px rgba(245,158,11,0), inset 0 0 38px rgba(245,158,11,0)';
    }
  }
  function edgeBeat() {
    const el = ensureEdge();
    if (!el) return;
    // small “pulse” via temporary stronger shadow
    el.style.opacity = '1';
    el.style.boxShadow = 'inset 0 0 0 3px rgba(245,158,11,.34), inset 0 0 72px rgba(245,158,11,.22)';
    setTimeout(() => {
      try { el.style.boxShadow = 'inset 0 0 0 2px rgba(245,158,11,.16), inset 0 0 38px rgba(245,158,11,.10)'; } catch {}
    }, 220);
  }

  // --- Quest factory (IIFE) ---
  function getQuestFactory() {
    return (ROOT.GroupsQuest && typeof ROOT.GroupsQuest.createFoodGroupsQuest === 'function')
      ? ROOT.GroupsQuest
      : null;
  }

  // --- Screen helper ---
  function centerXY(el) {
    try {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    } catch {
      return { x: window.innerWidth / 2, y: window.innerHeight * 0.52 };
    }
  }

  // ========== CONFIG ==========
  const CFG = {
    // base spawn / life
    spawnInterval: 900,
    maxActive: 4,
    minVisible: 2000,
    lifeTime: [3800, 5200],

    // safe zone (avoid HUD)
    safeLeftPx: 28,
    safeRightPx: 28,
    safeTopPx: 118,
    safeBottomPx: 150,

    // camera->screen mapping (pseudo VR)
    fovXRad: 1.05,
    fovYRad: 0.78,
    worldYawRangeRad: 0.62,
    worldPitchRangeRad: 0.34,
    parallaxDepthMin: 0.85,
    parallaxDepthMax: 1.15,

    // float
    floatSwayPx: 8,
    floatSwayMs: 1400,

    // size
    targetSizePx: 132,
    targetSizeMinMul: 0.78,
    targetSizeMaxMul: 1.18,

    // emoji pools (fallback)
    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚','🍞','🥔','🍊'],
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕'],

    // scoring
    pointsGood: 10,
    pointsGoodFever: 14,
    pointsGoodPerfect: 14,     // extra for perfect (added on top)
    pointsJunkHit: -8,
    pointsJunkBossHit: -18,
    pointsGoodExpire: -4,
    pointsGoodRushMul: 2,

    // fever/shield
    feverGainGood: 14,
    feverGainPerfectBonus: 5,
    feverLossMiss: 18,
    feverMax: 100,
    feverDurationMs: 8000,
    shieldPerFever: 1,

    // boss / wave
    bossJunkChance: 0.08,
    bossJunkEmoji: ['☠️','🧨','💣','👿'],
    bossJunkScaleMul: 1.28,
    bossHP: 3,
    bossBreakBonus: 16,
    bossJunkShieldCost: 2,

    bossWaveEnabled: true,
    bossWaveChancePerSec: 0.06,
    bossWaveSec: 5,

    // rush
    rushEnabled: true,
    rushMinSec: 6,
    rushMaxSec: 8,
    rushSpawnMul: 0.62,
    rushMaxActiveAdd: 2,
    rushMinStartAfterSec: 10,
    rushChancePerSec: 0.10,
    rushCooldownAfter: 12,

    // panic
    panicLastSec: 10,
    panicSpawnMul: 0.85,
    panicMaxActiveAdd: 1,

    // aim assist
    aimAssistRadiusPx: 130,
    aimAssistAngleRad: 0.22,

    // gaze/lock
    lockOnEnabled: true,
    lockOnMinHoldMs: 90,
    lockUpdateEveryMs: 60,

    gazeFuseMsEasy: 560,
    gazeFuseMsNormal: 520,
    gazeFuseMsHard: 460,
    fuseMsRapidMul: 0.72,
    fuseMsBossWaveMul: 0.86,

    // burst
    burstCountBase: 2,
    burstCountFever: 3,
    burstCountRush: 3,
    burstGapMsBase: 110,
    burstGapMsRapid: 85,

    // charge
    chargeEnabled: true,
    chargeAfterMs: 420,
    chargeDamageBoss: 2,
    chargeGoodBonus: 12,
    chargeCooldownMs: 220,

    // chain
    chainEnabled: true,
    chainRadiusPx: 240,
    chainDelayMs: 70,
    chainMul: 0.65,
    chainShotsRapid: 1,
    chainShotsCharge: 2,

    // decoy (invert trap)
    decoyEnabled: true,
    decoyChance: 0.10,
    decoyPenalty: -12,
    decoyFeverLoss: 14,
    decoyShieldCost: 1,

    // rage (double-feint on boss)
    rageEnabled: true,
    rageChanceBoss: 0.55,
    feint1AtProg: 0.46,
    feint2AtProg: 0.86,
    feint1Kick: 0.0022,
    feint2Kick: 0.0046,
    feint2CenterBias: 0.10,

    // adaptive
    adaptiveEnabledPlay: true,
    adaptiveEverySec: 3,
    skillGainGood: 8,
    skillGainPerfect: 10,
    skillLossMiss: 14,
    skillLossExpire: 12,
    skillClamp: 100,

    // clutch window
    clutchLastSec: 3
  };

  // ========== STATE ==========
  const active = [];
  let layerEl = null;
  let camEl = null;

  let running = false;
  let rafId = null;
  let spawnTimer = null;
  let secondTimer = null;

  let score = 0;
  let combo = 0;
  let comboMax = 0;

  // IMPORTANT: miss definition aligns with your note:
  // miss = good expired + junk/decoy hit (if shield blocks => NOT miss)
  let misses = 0;

  let goodHits = 0;
  let junkHits = 0;
  let goodExpires = 0;
  let junkExpires = 0;

  let startedAt = 0;
  let remainingSec = 0;

  // fever / shield
  let fever = 0;
  let feverOn = false;
  let feverEndsAt = 0;
  let shield = 0;

  // quest
  let quest = null;
  let goalIndexShown = -1;
  let miniIndexShown = -1;
  let allClearedShown = false;

  // run mode
  let runMode = 'play'; // play|research
  let lastGrade = 'C';

  // camera angles
  let camYaw = 0;
  let camPitch = 0;

  // difficulty derived
  let gazeFuseMsBase = CFG.gazeFuseMsNormal;

  // adaptive
  let skill = 0;
  let sizeMul = 1.0;
  let adaptiveTick = 0;

  // panic/rush/wave
  let panicOn = false;
  let rushOn = false;
  let rushEndsAt = 0;
  let rushCooldownSec = 0;
  let bossWaveEndsAt = 0;

  // gaze lock/burst/charge
  let gazeEnabled = true;
  let gazeHoldMs = 0;
  let gazeChargeMs = 0;
  let gazeChargeArmed = false;
  let gazeTarget = null;

  let lockElPrev = null;
  let lockProgPrev = -1;
  let chargeProgPrev = -1;

  let lastLockUpdateAt = 0;

  let burstInFlight = false;
  let burstTimerIds = [];

  let lastChargeAt = 0;

  // CLUTCH ticks
  let lastClutchTickSec = -1;

  // ========== CORE MATH ==========
  function updateCamAngles() {
    if (!camEl) return;
    const r = camEl.getAttribute && camEl.getAttribute('rotation');
    if (!r) return;
    camYaw = toRad(r.y || 0);
    camPitch = toRad(r.x || 0);
  }

  function worldToScreen(yaw, pitch, depth) {
    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    const relYaw = normAngleRad(yaw - camYaw);
    const relPitch = (pitch - camPitch);

    const nx = clamp(relYaw / (CFG.fovXRad || 1.0), -1, 1);
    const ny = clamp(relPitch / (CFG.fovYRad || 1.0), -1, 1);

    const d = clamp(depth || 1.0, 0.7, 1.4);

    let x = (w * 0.5) + (nx * w * 0.38) * d;
    let y = (h * 0.52) - (ny * h * 0.34) * d;

    x = clamp(x, (CFG.safeLeftPx | 0), w - (CFG.safeRightPx | 0));
    y = clamp(y, (CFG.safeTopPx | 0), h - (CFG.safeBottomPx | 0));

    return { x, y, relYaw, relPitch };
  }

  function spawnWorldAngles() {
    const y = camYaw + (Math.random() * 2 - 1) * (CFG.worldYawRangeRad || 0.6);
    const p = camPitch + (Math.random() * 2 - 1) * (CFG.worldPitchRangeRad || 0.34);
    const depth = (CFG.parallaxDepthMin + Math.random() * (CFG.parallaxDepthMax - CFG.parallaxDepthMin));
    return { yaw: y, pitch: p, depth };
  }

  // ========== UI / SCORE / FEVER ==========
  function addScore(delta) {
    score = (score + (delta | 0)) | 0;
    dispatch('hha:score', { score, combo, misses, shield, fever });
  }
  function setCombo(v) {
    combo = Math.max(0, v | 0);
    comboMax = Math.max(comboMax, combo);
    dispatch('hha:score', { score, combo, misses, shield, fever });
  }
  function addMiss() {
    misses = (misses + 1) | 0;
    dispatch('hha:score', { score, combo, misses, shield, fever });
  }

  function setFeverValue(v) {
    fever = clamp(v, 0, CFG.feverMax | 0);
    FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
    FeverUI.setFever && FeverUI.setFever(fever);
    dispatch('hha:score', { score, combo, misses, shield, fever });
  }
  function setShieldValue(v) {
    shield = Math.max(0, Number(v) || 0);
    FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
    FeverUI.setShield && FeverUI.setShield(shield);
    dispatch('hha:score', { score, combo, misses, shield, fever });
  }
  function setFeverActive(on) {
    feverOn = !!on;
    FeverUI.setFeverActive && FeverUI.setFeverActive(feverOn);
  }

  function maybeEnterFever() {
    if (feverOn) return;
    if (fever < (CFG.feverMax | 0)) return;

    setFeverActive(true);
    feverEndsAt = now() + (CFG.feverDurationMs | 0);
    setShieldValue(shield + (CFG.shieldPerFever | 0));

    dispatch('hha:judge', { label: 'FEVER', x: window.innerWidth / 2, y: window.innerHeight * 0.52, good: true });
    coach('🔥 FEVER! จ้องแล้วรัวเป็นชุด + มี CHAIN!');
    logEvent({ kind: 'fever_start', timeLeft: remainingSec, shield, rushOn });

    setFeverValue(0);
  }

  function tickFever() {
    if (!feverOn) return;
    if (now() >= feverEndsAt) {
      setFeverActive(false);
      coach('เฟเวอร์หมดแล้ว! ไปต่อ! ✨');
      logEvent({ kind: 'fever_end', timeLeft: remainingSec, score, misses, comboMax });
    }
  }

  // ========== DIFFICULTY / MODES ==========
  function applyDifficulty(diff) {
    diff = String(diff || 'normal').toLowerCase();

    if (diff === 'easy') {
      CFG.spawnInterval = 1200;
      CFG.maxActive = 3;
      CFG.minVisible = 2600;
      CFG.lifeTime = [4800, 6500];
      CFG.feverGainGood = 16;
      CFG.feverLossMiss = 16;
      CFG.targetSizePx = 142;
      CFG.bossHP = 2;
      gazeFuseMsBase = CFG.gazeFuseMsEasy;
    } else if (diff === 'hard') {
      CFG.spawnInterval = 750;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4600];
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
      CFG.targetSizePx = 122;
      CFG.bossHP = 4;
      gazeFuseMsBase = CFG.gazeFuseMsHard;
    } else {
      CFG.spawnInterval = 900;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
      CFG.targetSizePx = 132;
      CFG.bossHP = 3;
      gazeFuseMsBase = CFG.gazeFuseMsNormal;
    }
  }

  function applyTargetSizeToEl(el, scaleMul = 1.0) {
    if (!el) return;
    const base = CFG.targetSizePx | 0;
    const mul = (runMode === 'play') ? (sizeMul || 1.0) : 1.0;
    const s = clamp(Math.round(base * mul * (scaleMul || 1.0)), 92, 178);
    el.style.width = s + 'px';
    el.style.height = s + 'px';
  }

  function normalizeGrade(g) {
    const x = String(g || '').toUpperCase().trim();
    if (['SSS', 'SS', 'S', 'A', 'B', 'C'].includes(x)) return x;
    return 'C';
  }

  // ========== PANIC / RUSH / WAVE ==========
  function bossWaveOn() { return bossWaveEndsAt && now() < bossWaveEndsAt; }

  function setPanic(on, secLeft) {
    const next = !!on;
    if (panicOn === next) return;
    panicOn = next;
    dispatch('hha:panic', { on: panicOn, secLeft: secLeft | 0 });
    if (panicOn) coach('⏰ 10 วิสุดท้าย! เร่งแล้วนะ!!!');
  }

  function tryBossWave() {
    if (!CFG.bossWaveEnabled) return;
    if (runMode !== 'play') return;
    if (panicOn) return;
    if (remainingSec <= 14) return;
    if (bossWaveOn()) return;

    const elapsed = Math.floor((now() - startedAt) / 1000);
    if (elapsed < 12) return;

    if (Math.random() > (CFG.bossWaveChancePerSec || 0.06)) return;

    bossWaveEndsAt = now() + ((CFG.bossWaveSec | 0) * 1000);
    dispatch('groups:danger', { on: true });
    coach('⚠️ WAVE! บอสขยะมาเป็นชุด!');
    tone(220, 0.08, 0.08, 'square'); setTimeout(() => tone(180, 0.08, 0.08, 'square'), 140);
    haptic([18, 18, 18, 30]);
    logEvent({ kind: 'boss_wave_start', sec: (CFG.bossWaveSec | 0), timeLeft: remainingSec });
  }

  function tryStartRush() {
    if (!CFG.rushEnabled) return;
    if (rushOn) return;
    if (rushCooldownSec > 0) return;
    if (remainingSec <= ((CFG.panicLastSec | 0) + 2)) return;

    const elapsed = Math.floor((now() - startedAt) / 1000);
    if (elapsed < (CFG.rushMinStartAfterSec | 0)) return;

    if (Math.random() > (CFG.rushChancePerSec || 0.10)) return;

    rushOn = true;
    const dur = randInt(CFG.rushMinSec | 0, CFG.rushMaxSec | 0);
    rushEndsAt = now() + (dur * 1000);

    dispatch('hha:rush', { on: true, sec: dur });
    coach('🚀 RUSH! คะแนน x2 + CHAIN!');
    tone(660, 0.06, 0.06, 'square');
    setTimeout(() => tone(880, 0.06, 0.06, 'square'), 80);
    setTimeout(() => tone(990, 0.06, 0.06, 'square'), 160);
    haptic([15, 10, 15]);
    logEvent({ kind: 'rush_start', sec: dur, timeLeft: remainingSec });
  }

  function tickRush() {
    if (!CFG.rushEnabled) return;

    if (rushOn) {
      if (now() >= rushEndsAt) {
        rushOn = false;
        rushEndsAt = 0;
        rushCooldownSec = CFG.rushCooldownAfter | 0;
        dispatch('hha:rush', { on: false, sec: 0 });
        coach('จบ RUSH แล้ว ไปต่อ!');
        logEvent({ kind: 'rush_end', timeLeft: remainingSec, score, misses, comboMax });
      }
    } else {
      if (rushCooldownSec > 0) rushCooldownSec--;
      tryStartRush();
    }
  }

  function effectiveSpawnInterval() {
    let si = CFG.spawnInterval | 0;
    if (rushOn) si = Math.round(si * (CFG.rushSpawnMul || 0.62));
    if (panicOn) si = Math.round(si * (CFG.panicSpawnMul || 0.85));
    if (bossWaveOn()) si = Math.round(si * 0.78);
    return clamp(si, 420, 1600);
  }

  function effectiveMaxActive() {
    let ma = CFG.maxActive | 0;
    if (rushOn) ma += (CFG.rushMaxActiveAdd | 0);
    if (panicOn) ma += (CFG.panicMaxActiveAdd | 0);
    if (bossWaveOn()) ma += 1;
    return clamp(ma, 2, 9);
  }

  // ========== AIM ASSIST ==========
  function pickNearestTargetAt(x, y) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < active.length; i++) {
      const t = active[i];
      if (!t || !t.alive) continue;
      const dx = (t.sx - x), dy = (t.sy - y);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  function pickNearestToCenter() {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    let best = null, bestD = Infinity;

    for (let i = 0; i < active.length; i++) {
      const t = active[i];
      if (!t || !t.alive) continue;

      const px = (typeof t.sx === 'number') ? t.sx : cx;
      const py = (typeof t.sy === 'number') ? t.sy : cy;

      const dx = px - cx;
      const dy = py - cy;
      const d = Math.sqrt(dx * dx + dy * dy);

      const relYaw = normAngleRad(t.yaw - camYaw);
      const relPitch = (t.pitch - camPitch);
      const ang = Math.sqrt(relYaw * relYaw + relPitch * relPitch);
      if (ang > (CFG.aimAssistAngleRad || 0.22)) continue;

      if (d < bestD) { bestD = d; best = t; }
    }

    const radius = (CFG.aimAssistRadiusPx | 0) + (rushOn ? 60 : 0);
    if (best && bestD <= radius) return best;
    return null;
  }

  function pickNearestWithin(x, y, radius, predicate, excludeSet) {
    let best = null, bestD = Infinity;
    const r = Math.max(10, radius | 0);
    for (let i = 0; i < active.length; i++) {
      const t = active[i];
      if (!t || !t.alive) continue;
      if (excludeSet && excludeSet.has(t)) continue;
      if (predicate && !predicate(t)) continue;

      const dx = (t.sx - x), dy = (t.sy - y);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r && d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  // ========== TAP ANYWHERE ==========
  function bindTapAnywhere(el) {
    if (!el) return;

    const onDown = (ev) => {
      if (!running) return;

      const targetEl = ev.target && ev.target.closest ? ev.target.closest('.fg-target') : null;
      if (targetEl) return; // direct hit handled by target listener

      let x = 0, y = 0;
      try {
        if (ev.touches && ev.touches[0]) { x = ev.touches[0].clientX; y = ev.touches[0].clientY; }
        else { x = ev.clientX; y = ev.clientY; }
      } catch {
        x = window.innerWidth / 2; y = window.innerHeight / 2;
      }

      const t = pickNearestTargetAt(x, y) || pickNearestToCenter();

      if (t) {
        logEvent({ kind: 'tap_shoot', x, y, pickedEmoji: t.emoji, pickedGood: t.good, boss: !!t.boss, decoy: !!t.decoy, timeLeft: remainingSec, rushOn, feverOn, shield });
        hitTarget(t, { source: 'tap' });
      } else {
        // empty shot: small penalty
        addMiss();
        setCombo(0);
        setFeverValue(fever - Math.round((CFG.feverLossMiss | 0) * 0.6));
        tone(180, 0.06, 0.07, 'square');
        haptic([35, 40, 35]);
        dispatch('groups:reticle', { state: 'miss' });
        logEvent({ kind: 'tap_shoot_miss', x, y, timeLeft: remainingSec });
      }
    };

    el.addEventListener('pointerdown', onDown, { passive: true });
    el.addEventListener('touchstart', onDown, { passive: true });
  }

  // ========== LOCK UI EVENTS ==========
  function setLockEl(el) {
    if (lockElPrev && lockElPrev !== el) {
      try { lockElPrev.classList.remove('lock'); } catch {}
    }
    lockElPrev = el || null;
    if (lockElPrev) {
      try { lockElPrev.classList.add('lock'); } catch {}
    }
  }

  function clearLock(silent) {
    gazeTarget = null;
    gazeHoldMs = 0;
    gazeChargeMs = 0;
    gazeChargeArmed = false;
    lockProgPrev = -1;
    chargeProgPrev = -1;

    if (lockElPrev) {
      try { lockElPrev.classList.remove('lock'); } catch {}
      lockElPrev = null;
    }
    dispatch('groups:lock', { on: false, prog: 0, charge: 0, silent: !!silent });
  }

  function updateLockEvent(t, prog, charge) {
    const p = clamp(prog, 0, 1);
    const c = clamp(charge, 0, 1);

    const msStep = CFG.lockUpdateEveryMs | 0;
    const bucket = Math.floor((p * 1000) / (msStep > 0 ? msStep : 60));
    const prevBucket = Math.floor(((lockProgPrev < 0 ? -1 : lockProgPrev) * 1000) / (msStep > 0 ? msStep : 60));
    const cbucket = Math.floor((c * 1000) / (msStep > 0 ? msStep : 60));
    const cprev = Math.floor(((chargeProgPrev < 0 ? -1 : chargeProgPrev) * 1000) / (msStep > 0 ? msStep : 60));

    if (bucket === prevBucket && cbucket === cprev) return;

    lockProgPrev = p;
    chargeProgPrev = c;

    dispatch('groups:lock', {
      on: true,
      x: (t && typeof t.sx === 'number') ? t.sx : (window.innerWidth / 2),
      y: (t && typeof t.sy === 'number') ? t.sy : (window.innerHeight / 2),
      prog: p,
      charge: c,
      boss: !!(t && t.boss),
      good: !!(t && t.good),
      decoy: !!(t && t.decoy)
    });
  }

  // ========== BURST / CHARGE / CHAIN ==========
  function cancelBurst() {
    burstInFlight = false;
    for (let i = 0; i < burstTimerIds.length; i++) {
      try { clearTimeout(burstTimerIds[i]); } catch {}
    }
    burstTimerIds = [];
  }

  function effectiveFuseMs() {
    let ms = gazeFuseMsBase | 0;
    if (feverOn || rushOn) ms = Math.round(ms * (CFG.fuseMsRapidMul || 0.72));
    if (bossWaveOn()) ms = Math.round(ms * (CFG.fuseMsBossWaveMul || 0.86));
    return clamp(ms, 240, 900);
  }

  function effectiveBurstCount() {
    if (feverOn) return (CFG.burstCountFever | 0);
    if (rushOn) return (CFG.burstCountRush | 0);
    return (CFG.burstCountBase | 0);
  }

  function effectiveBurstGap() {
    if (feverOn || rushOn) return (CFG.burstGapMsRapid | 0);
    return (CFG.burstGapMsBase | 0);
  }

  function burstFire() {
    if (!running || !gazeEnabled) return;
    if (burstInFlight) return;

    burstInFlight = true;
    burstTimerIds = [];

    const count = clamp(effectiveBurstCount(), 1, 5);
    const gap = clamp(effectiveBurstGap(), 60, 240);

    logEvent({ kind: 'gaze_burst_start', count, gap, timeLeft: remainingSec, rushOn, feverOn, wave: bossWaveOn() });

    for (let i = 0; i < count; i++) {
      const id = setTimeout(() => {
        if (!running) return;

        const t = pickNearestToCenter();
        if (t) {
          tone((feverOn || rushOn) ? 980 : 860, 0.045, 0.05, 'triangle');
          hitTarget(t, { source: 'gaze', burst: true, shot: (i + 1), burstCount: count, timeLeft: remainingSec });
        } else {
          tone(220, 0.03, 0.03, 'square');
          dispatch('groups:reticle', { state: 'miss' });
          logEvent({ kind: 'gaze_burst_dry', shot: (i + 1), burstCount: count, timeLeft: remainingSec });
        }

        if (i === count - 1) {
          burstInFlight = false;
          logEvent({ kind: 'gaze_burst_end', timeLeft: remainingSec, score, misses, comboMax });
        }
      }, i * gap);
      burstTimerIds.push(id);
    }
  }

  function tryChargeShot() {
    if (!CFG.chargeEnabled) return;
    if (!gazeEnabled) return;
    if (!running) return;
    if (!gazeTarget || !gazeTarget.alive) return;

    const tNow = now();
    if (tNow - lastChargeAt < (CFG.chargeCooldownMs | 0)) return;

    const t = gazeTarget || pickNearestToCenter();
    if (!t) return;

    lastChargeAt = tNow;
    gazeChargeMs = 0;
    gazeChargeArmed = false;
    chargeProgPrev = -1;

    dispatch('groups:charge', { on: true });
    tone(1320, 0.06, 0.06, 'triangle'); setTimeout(() => tone(1100, 0.06, 0.05, 'triangle'), 80);
    haptic([18, 10, 18]);

    logEvent({ kind: 'charge_fire', emoji: t.emoji, boss: !!t.boss, good: !!t.good, decoy: !!t.decoy, timeLeft: remainingSec });

    hitTarget(t, { source: 'charge', charge: true });
  }

  function chainFromHit(x, y, basePts, options) {
    if (!CFG.chainEnabled) return;
    const shots = Math.max(0, (options && options.shots) | 0);
    if (shots <= 0) return;

    const exclude = (options && options.excludeSet) ? options.excludeSet : new Set();
    let lastX = x, lastY = y;

    for (let k = 0; k < shots; k++) {
      setTimeout(() => {
        if (!running) return;

        const t2 = pickNearestWithin(lastX, lastY, CFG.chainRadiusPx | 0,
          (t) => (t.good === true) && !t.decoy, exclude);

        if (!t2) return;

        exclude.add(t2);

        const pos2 = centerXY(t2.el);
        lastX = pos2.x; lastY = pos2.y;

        const pts = Math.round((basePts | 0) * (CFG.chainMul || 0.65));
        hitTarget(t2, { source: 'chain', chain: true, chainIdx: (k + 1), chainPts: pts });
      }, (CFG.chainDelayMs | 0) * (k + 1));
    }
  }

  // ========== RAGE FEINT (double) ==========
  function spawnAfterimage(x, y, emoji, cls) {
    if (!layerEl) return;
    try {
      const a = document.createElement('div');
      a.className = 'fg-afterimage ' + (cls ? String(cls) : '');
      a.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0) translate(-50%,-50%)`;
      a.style.position = 'absolute';
      a.style.left = '0';
      a.style.top = '0';
      a.style.zIndex = '4';
      a.style.pointerEvents = 'none';
      a.style.opacity = (cls === 'a2') ? '.16' : '.22';
      a.style.filter = 'blur(.2px)';
      a.style.animation = 'aiFade .42s ease-out forwards';

      const inner = document.createElement('div');
      inner.className = 'fg-afterimage-inner';
      inner.textContent = String(emoji || '');
      Object.assign(inner.style, {
        width: '110px', height: '110px', borderRadius: '999px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '54px', lineHeight: '1',
        background: 'rgba(255,255,255,.06)',
        border: '1px solid rgba(255,255,255,.10)',
        transform: 'scale(1.04)'
      });

      a.appendChild(inner);
      layerEl.appendChild(a);
      setTimeout(() => { try { a.remove(); } catch {} }, 420);
    } catch {}
  }

  function doFeint(t, step) {
    if (!t || !t.alive) return;

    spawnAfterimage(t.sx, t.sy, t.emoji, 'a1');
    setTimeout(() => spawnAfterimage(t.sx, t.sy, t.emoji, 'a2'), 55);

    if (step === 1) {
      t.scaleMul = 1.10;
      t.vYaw = (Math.random() < 0.5 ? -1 : 1) * (CFG.feint1Kick || 0.0022);
      t.vPitch = (Math.random() < 0.5 ? -1 : 1) * (CFG.feint1Kick || 0.0022) * 0.70;
      tone(420, 0.03, 0.04, 'sine');
      haptic([8, 12]);
      logEvent({ kind: 'feint1', emoji: t.emoji, timeLeft: remainingSec });
    } else {
      t.scaleMul = 1.22;
      const bias = clamp(Number(CFG.feint2CenterBias || 0.10), 0.06, 0.20);
      t.yaw = camYaw + (Math.random() * 2 - 1) * (CFG.worldYawRangeRad * bias);
      t.pitch = camPitch + (Math.random() * 2 - 1) * (CFG.worldPitchRangeRad * bias);
      t.vYaw = (Math.random() < 0.5 ? -1 : 1) * (CFG.feint2Kick || 0.0046);
      t.vPitch = (Math.random() < 0.5 ? -1 : 1) * (CFG.feint2Kick || 0.0046) * 0.75;
      tone(520, 0.04, 0.05, 'square');
      haptic([12, 10, 18]);
      logEvent({ kind: 'feint2', emoji: t.emoji, timeLeft: remainingSec });
    }
  }

  // ========== QUEST UPDATE ==========
  function emitQuestUpdate() {
    if (!quest) return;

    const goalsAll = quest.goals || [];
    const minisAll = quest.minis || [];

    const goal = goalsAll.find(g => g && !g.done) || null;
    const mini = minisAll.find(m => m && !m.done) || null;

    const g = quest.getActiveGroup ? quest.getActiveGroup() : null;

    dispatch('quest:update', {
      goal: goal ? { label: goal.label, prog: goal.prog, target: goal.target } : null,
      mini: mini ? { label: mini.label, prog: mini.prog, target: mini.target } : null,
      goalsAll, minisAll,
      groupLabel: g ? g.label : '',
      groupKey: g ? (g.key || 0) : 0
    });

    const goalsCleared = goalsAll.filter(x => x && x.done).length;
    if (goalsCleared !== goalIndexShown && goalsCleared > 0) {
      goalIndexShown = goalsCleared;
      dispatch('hha:celebrate', { kind: 'goal', type: 'goal', index: goalsCleared, total: goalsAll.length });
      coach('🎯 GOAL ผ่านแล้ว!');
      logEvent({ kind: 'quest_goal_clear', idx: goalsCleared, total: goalsAll.length, timeLeft: remainingSec });
    }

    const minisCleared = minisAll.filter(x => x && x.done).length;
    if (minisCleared !== miniIndexShown && minisCleared > 0) {
      miniIndexShown = minisCleared;
      dispatch('hha:celebrate', { kind: 'mini', type: 'mini', index: minisCleared, total: minisAll.length });
      coach('⭐ MINI ผ่าน!');
      logEvent({ kind: 'quest_mini_clear', idx: minisCleared, total: minisAll.length, timeLeft: remainingSec });
    }

    if (!allClearedShown && goalsCleared === goalsAll.length && minisCleared === minisAll.length) {
      allClearedShown = true;
      dispatch('hha:celebrate', { kind: 'all', type: 'all' });
      coach('🎉 เคลียร์ทุกภารกิจแล้ววว!');
      logEvent({ kind: 'quest_all_clear', timeLeft: remainingSec, score, misses, comboMax });
    }
  }

  // ========== RANK / GRADE ==========
  function accuracy() {
    const total = goodHits + junkHits + goodExpires;
    if (total <= 0) return 0;
    return clamp(goodHits / total, 0, 1);
  }
  function questsPct() {
    if (!quest) return 0;
    const gAll = quest.goals || [];
    const mAll = quest.minis || [];
    const g = gAll.filter(x => x && x.done).length;
    const m = mAll.filter(x => x && x.done).length;
    const total = (gAll.length || 0) + (mAll.length || 0);
    if (total <= 0) return 0;
    return clamp((g + m) / total, 0, 1);
  }
  function scorePerSecond() {
    const t = Math.max(1, Math.floor((now() - startedAt) / 1000));
    return score / t;
  }
  function gradeFromMetrics(sps, acc, qp, missCount) {
    const q = qp;
    const a = acc;
    const p = clamp(sps / 3.0, 0, 1);
    const m = clamp(missCount / 12, 0, 1);
    const overall = (q * 0.46) + (a * 0.34) + (p * 0.20) - (m * 0.18);

    if (overall >= 0.92 && q >= 0.95 && a >= 0.85) return 'SSS';
    if (overall >= 0.82 && q >= 0.80) return 'SS';
    if (overall >= 0.70 && q >= 0.60) return 'S';
    if (overall >= 0.56) return 'A';
    if (overall >= 0.40) return 'B';
    return 'C';
  }
  function emitRank() {
    const acc = accuracy();
    const qp = questsPct();
    const sps = scorePerSecond();

    let g = gradeFromMetrics(sps, acc, qp, misses);
    g = normalizeGrade(g);

    dispatch('hha:rank', {
      grade: g,
      scorePerSec: Number(sps.toFixed(2)),
      accuracy: Number((acc * 100).toFixed(0)),
      questsPct: Number((qp * 100).toFixed(0))
    });

    lastGrade = g;
    return g;
  }

  // ========== ADAPTIVE ==========
  function clampSkill(v) {
    const c = CFG.skillClamp | 0;
    return clamp(v, -c, c);
  }

  function updateAdaptiveSoon() {
    if (runMode !== 'play') return;
    if (!CFG.adaptiveEnabledPlay) return;

    adaptiveTick++;
    if (adaptiveTick % (CFG.adaptiveEverySec | 0) !== 0) return;

    const t = clampSkill(skill) / (CFG.skillClamp || 100);

    // size: skilled => slightly smaller targets
    sizeMul = clamp(1.0 - (t * 0.10), CFG.targetSizeMinMul, CFG.targetSizeMaxMul);

    // spawn/max: skilled => slightly faster / more
    const baseSI = CFG._baseSpawnInterval || CFG.spawnInterval;
    const baseMA = CFG._baseMaxActive || CFG.maxActive;

    const si = clamp(baseSI * (1.0 - (t * 0.12)), 520, 1600);
    const ma = clamp(baseMA + (t > 0.55 ? 1 : 0) + (t > 0.85 ? 1 : 0), 2, 7);

    CFG.spawnInterval = Math.round(si);
    CFG.maxActive = Math.round(ma);

    logEvent({ kind: 'adaptive_tick', t: Number(t.toFixed(2)), sizeMul: Number(sizeMul.toFixed(2)), spawnInterval: CFG.spawnInterval, maxActive: CFG.maxActive });
  }

  // ========== TARGET LIFECYCLE ==========
  function removeFromActive(t) {
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i, 1);
  }

  function destroyTarget(t, isHit) {
    if (!t || !t.alive) return;
    if (!isHit && !t.canExpire) return;

    if (gazeTarget === t) clearLock(true);

    t.alive = false;
    clearTimeout(t.minTimer);
    clearTimeout(t.lifeTimer);

    removeFromActive(t);

    if (t.el) {
      try { t.el.classList.add(isHit ? 'hit' : 'out'); } catch {}
      setTimeout(() => { try { t.el && t.el.remove(); } catch {} }, 200);
    }
  }

  function ensureBossBar(t) {
    if (!t || !t.el || !t.boss) return;
    if (t.el.querySelector('.bossbar')) return;

    const bar = document.createElement('div');
    bar.className = 'bossbar';
    Object.assign(bar.style, {
      position: 'absolute',
      left: '12px',
      right: '12px',
      bottom: '10px',
      height: '8px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,.10)',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,.14)'
    });

    const fill = document.createElement('div');
    fill.className = 'bossbar-fill';
    Object.assign(fill.style, {
      height: '100%',
      width: '100%',
      borderRadius: '999px',
      background: 'linear-gradient(90deg, rgba(168,85,247,.95), rgba(59,130,246,.85))'
    });

    bar.appendChild(fill);
    t.el.appendChild(bar);
  }

  function setBossBar(t) {
    if (!t || !t.el || !t.boss) return;
    ensureBossBar(t);
    const fill = t.el.querySelector('.bossbar-fill');
    if (!fill) return;
    const pct = (t.hpMax > 0) ? clamp(t.hp / t.hpMax, 0, 1) : 0;
    fill.style.width = Math.round(pct * 100) + '%';
  }

  function createTarget() {
    if (!running || !layerEl) return;
    if (active.length >= effectiveMaxActive()) return;

    const g = (quest && quest.getActiveGroup) ? quest.getActiveGroup() : null;

    const good = Math.random() < 0.75;

    let emoji = '';
    let isBoss = false;

    if (good) {
      if (g && Array.isArray(g.emojis) && g.emojis.length) emoji = g.emojis[randInt(0, g.emojis.length - 1)];
      else emoji = CFG.emojisGood[randInt(0, CFG.emojisGood.length - 1)];
    } else {
      const bossChance = bossWaveOn() ? Math.min(0.22, (CFG.bossJunkChance || 0.08) * 2.4) : (CFG.bossJunkChance || 0.08);
      isBoss = (Math.random() < bossChance);
      if (isBoss) emoji = CFG.bossJunkEmoji[randInt(0, CFG.bossJunkEmoji.length - 1)];
      else emoji = CFG.emojisJunk[randInt(0, CFG.emojisJunk.length - 1)];
    }

    // Decoy: looks like good, but is a trap
    const isDecoy = !!(CFG.decoyEnabled && good && (runMode === 'play') && (Math.random() < (CFG.decoyChance || 0.10)));

    const el = document.createElement('div');
    el.className =
      'fg-target ' +
      (good
        ? ('fg-good' + (isDecoy ? ' fg-decoy' : ''))
        : (isBoss ? 'fg-junk fg-boss' : 'fg-junk'));

    el.setAttribute('data-emoji', emoji);
    el.textContent = emoji;
    el.classList.add('spawn');

    applyTargetSizeToEl(el, isBoss ? (CFG.bossJunkScaleMul || 1.28) : 1.0);

    const wp = spawnWorldAngles();
    layerEl.appendChild(el);

    const t = {
      el,
      good,
      emoji,
      boss: isBoss,
      hp: isBoss ? (CFG.bossHP | 0) : 1,
      hpMax: isBoss ? (CFG.bossHP | 0) : 1,

      decoy: isDecoy,

      alive: true,
      canExpire: false,
      bornAt: now(),
      minTimer: null,
      lifeTimer: null,

      yaw: wp.yaw,
      pitch: wp.pitch,
      depth: wp.depth,
      sx: window.innerWidth / 2,
      sy: window.innerHeight * 0.52,

      swaySeed: Math.random() * 9999,
      hitCdUntil: 0,

      rage: false,
      feintStep: 0,
      vYaw: 0,
      vPitch: 0,
      scaleMul: 1.0
    };

    // Rage (boss only)
    if (t.boss && CFG.rageEnabled) {
      t.rage = (Math.random() < (CFG.rageChanceBoss || 0.55));
      if (t.rage) {
        try { el.classList.add('rage'); } catch {}
      }
    }

    if (t.boss) {
      ensureBossBar(t);
      setBossBar(t);
      dispatch('groups:danger', { on: true });
      tone(260, 0.08, 0.07, 'square');
      setTimeout(() => tone(220, 0.08, 0.07, 'square'), 120);
      haptic([18, 18, 18]);
      logEvent({ kind: 'boss_spawn', hp: t.hp, timeLeft: remainingSec, wave: bossWaveOn() });
    }

    active.push(t);

    requestAnimationFrame(() => {
      try { el.classList.add('show'); } catch {}
    });

    // cannot expire before minimum visible time
    t.minTimer = setTimeout(() => { t.canExpire = true; }, CFG.minVisible | 0);

    // life timer -> expire
    const life = randInt(CFG.lifeTime[0] | 0, CFG.lifeTime[1] | 0);
    t.lifeTimer = setTimeout(() => {
      if (!t.canExpire) {
        const wait = Math.max(0, (CFG.minVisible | 0) - (now() - t.bornAt));
        setTimeout(() => expireTarget(t), wait);
      } else {
        expireTarget(t);
      }
    }, life);

    // direct hit listeners
    const onHit = (ev) => {
      try { ev && ev.preventDefault && ev.preventDefault(); } catch {}
      try { ev && ev.stopPropagation && ev.stopPropagation(); } catch {}
      hitTarget(t, { source: 'direct' });
      return false;
    };
    el.addEventListener('pointerdown', onHit, { passive: false });
    el.addEventListener('touchstart', onHit, { passive: false });
    el.addEventListener('mousedown', onHit);
    el.addEventListener('click', onHit);

    logEvent({ kind: 'spawn', emoji, good, boss: !!t.boss, decoy: !!t.decoy, hp: t.hp, timeLeft: remainingSec, rushOn, feverOn, wave: bossWaveOn() });
  }

  // ========== HIT / EXPIRE RULES ==========
  function distToCenter(x, y) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = x - cx, dy = y - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function addSkill(delta) {
    skill = clampSkill(skill + (delta | 0));
  }

  function scoreFxAt(x, y, label, good) {
    try { Particles.scorePop && Particles.scorePop(x, y, label, good); } catch {}
    try { Particles.burstAt && Particles.burstAt(x, y, { kind: good ? 'GOOD' : 'BAD' }); } catch {}
    dispatch('hha:judge', { label: String(label || ''), x, y, good: !!good });
  }

  function badHit(kind, t, opts) {
    const isBoss = !!(t && t.boss);
    const isDecoy = !!(t && t.decoy);
    const cost = isBoss ? (CFG.bossJunkShieldCost | 0) : (isDecoy ? (CFG.decoyShieldCost | 0) : 1);

    // Shield block => NOT MISS (per your rule)
    if (shield >= cost && cost > 0) {
      setShieldValue(shield - cost);
      // keep combo (shield feels powerful), but still minor fever drop
      setFeverValue(fever - Math.round((CFG.feverLossMiss | 0) * 0.35));
      tone(520, 0.04, 0.05, 'square');
      haptic(18);
      dispatch('groups:reticle', { state: 'ok' });
      scoreFxAt(t.sx, t.sy, 'BLOCK', true);
      logEvent({ kind: 'shield_block', type: kind, boss: isBoss, decoy: isDecoy, cost, timeLeft: remainingSec });
      destroyTarget(t, true);
      return;
    }

    // No shield (or insufficient) => MISS
    addMiss();
    setCombo(0);
    addSkill(-(CFG.skillLossMiss | 0));

    if (isDecoy) {
      addScore(CFG.decoyPenalty | 0);
      setFeverValue(fever - (CFG.decoyFeverLoss | 0));
      tone(180, 0.06, 0.07, 'square');
      haptic([35, 40, 35]);
      dispatch('groups:reticle', { state: 'miss' });
      scoreFxAt(t.sx, t.sy, 'TRAP', false);
      logEvent({ kind: 'hit_decoy', timeLeft: remainingSec, score, misses, comboMax });
      destroyTarget(t, true);
      return;
    }

    // junk / boss hit
    junkHits += 1;

    if (isBoss) addScore(CFG.pointsJunkBossHit | 0);
    else addScore(CFG.pointsJunkHit | 0);

    setFeverValue(fever - (CFG.feverLossMiss | 0));
    tone(160, 0.08, 0.08, 'square');
    haptic([45, 60, 45]);
    dispatch('groups:reticle', { state: 'miss' });

    scoreFxAt(t.sx, t.sy, isBoss ? 'BOSS!' : 'JUNK', false);
    logEvent({ kind: 'hit_junk', boss: isBoss, timeLeft: remainingSec, score, misses, comboMax });

    // Boss HP system: only charge shots can “clean” safely; normal hits still damage boss (at cost).
    if (isBoss) {
      const dmg = (opts && opts.charge) ? (CFG.chargeDamageBoss | 0) : 1;
      t.hp = Math.max(0, (t.hp | 0) - dmg);
      setBossBar(t);

      if (t.hp <= 0) {
        addScore(CFG.bossBreakBonus | 0);
        scoreFxAt(t.sx, t.sy, 'BREAK!', true);
        dispatch('hha:celebrate', { kind: 'boss_break', type: 'boss' });
        tone(880, 0.06, 0.06, 'triangle');
        haptic([20, 30, 20]);
        logEvent({ kind: 'boss_break', timeLeft: remainingSec, score });
        destroyTarget(t, true);
        return;
      }
    }

    destroyTarget(t, true);
  }

  function goodHit(t, opts) {
    goodHits += 1;

    const pos = centerXY(t.el);
    const d = distToCenter(pos.x, pos.y);
    const perfect = (d <= 44);

    const base = feverOn ? (CFG.pointsGoodFever | 0) : (CFG.pointsGood | 0);
    const mul = rushOn ? (CFG.pointsGoodRushMul | 0) : 1;
    const pts = (opts && typeof opts.chainPts === 'number') ? (opts.chainPts | 0) : (base * mul);

    addScore(pts + (perfect ? (CFG.pointsGoodPerfect | 0) : 0));
    setCombo(combo + 1);

    // fever gain
    setFeverValue(fever + (CFG.feverGainGood | 0) + (perfect ? (CFG.feverGainPerfectBonus | 0) : 0));
    maybeEnterFever();

    // skill
    addSkill(perfect ? (CFG.skillGainPerfect | 0) : (CFG.skillGainGood | 0));

    // fx
    dispatch('groups:reticle', { state: perfect ? 'perfect' : 'ok' });
    scoreFxAt(pos.x, pos.y, perfect ? 'PERFECT' : 'GOOD', true);
    try { Particles.burstAt && Particles.burstAt(pos.x, pos.y, { kind: perfect ? 'PERFECT' : 'GOOD' }); } catch {}

    // quest update
    try {
      if (quest && typeof quest.onGoodHit === 'function') {
        const g = quest.getActiveGroup ? quest.getActiveGroup() : null;
        const groupKey = g ? (g.key || 1) : 1;
        quest.onGoodHit(groupKey, combo);
      }
    } catch {}

    // chain shots (FEVER/RUSH/CHARGE)
    const exclude = new Set([t]);
    if ((feverOn || rushOn) && CFG.chainEnabled && !t.decoy) {
      chainFromHit(pos.x, pos.y, pts, { shots: (CFG.chainShotsRapid | 0), excludeSet: exclude });
    }
    if (opts && opts.charge && CFG.chainEnabled && !t.decoy) {
      chainFromHit(pos.x, pos.y, pts + (CFG.chargeGoodBonus | 0), { shots: (CFG.chainShotsCharge | 0), excludeSet: exclude });
      addScore(CFG.chargeGoodBonus | 0);
    }

    // hype coach
    if ((combo > 0) && (combo % 6 === 0)) {
      coach('🔥 คอมโบสวย! ไปต่อ!');
    }

    logEvent({ kind: 'hit_good', emoji: t.emoji, perfect, pts, timeLeft: remainingSec, combo, feverOn, rushOn });

    destroyTarget(t, true);
  }

  function hitTarget(t, opts) {
    if (!t || !t.alive) return;

    const tNow = now();
    if ((t.hitCdUntil || 0) > tNow) return;
    t.hitCdUntil = tNow + 45;

    // decoy is trap (treated as bad)
    if (t.decoy) {
      badHit('decoy', t, opts);
      return;
    }

    // junk/boss
    if (!t.good) {
      badHit('junk', t, opts);
      return;
    }

    // good
    goodHit(t, opts);
  }

  function expireTarget(t) {
    if (!t || !t.alive) return;
    if (!t.canExpire) return;

    // decoy expiration => no penalty (trap disappears)
    if (t.decoy) {
      logEvent({ kind: 'decoy_expire', timeLeft: remainingSec });
      destroyTarget(t, false);
      return;
    }

    // good expires => MISS (per your miss definition)
    if (t.good) {
      goodExpires += 1;
      addMiss();
      setCombo(0);
      addScore(CFG.pointsGoodExpire | 0);
      setFeverValue(fever - (CFG.feverLossMiss | 0));
      addSkill(-(CFG.skillLossExpire | 0));

      tone(140, 0.08, 0.08, 'square');
      haptic([35, 60, 35]);
      dispatch('groups:reticle', { state: 'miss' });

      scoreFxAt(t.sx, t.sy, 'MISS', false);
      logEvent({ kind: 'good_expire', emoji: t.emoji, timeLeft: remainingSec, score, misses, comboMax });

      destroyTarget(t, false);
      return;
    }

    // junk expires => no miss (you avoided it)
    junkExpires += 1;
    logEvent({ kind: 'junk_expire', boss: !!t.boss, timeLeft: remainingSec });
    destroyTarget(t, false);
  }

  // ========== RENDER LOOP ==========
  function renderTargets() {
    updateCamAngles();
    const tNow = now();
    const sway = (CFG.floatSwayPx || 0);
    const swayMs = (CFG.floatSwayMs || 1400);

    const dt = Math.min(80, Math.max(0, tNow - (renderTargets._last || tNow)));
    renderTargets._last = tNow;

    for (let i = 0; i < active.length; i++) {
      const t = active[i];
      if (!t || !t.alive || !t.el) continue;

      // velocity from feints
      const vy = (t.vYaw || 0), vp = (t.vPitch || 0);
      if (vy || vp) {
        t.yaw += vy * dt;
        t.pitch += vp * dt;
        t.vYaw *= 0.90;
        t.vPitch *= 0.90;
      }

      const wp = worldToScreen(t.yaw, t.pitch, t.depth);
      let x = wp.x, y = wp.y;

      const s = (Math.sin((tNow + t.swaySeed) / swayMs) * sway);
      x += s * 0.6;
      y += s * 0.35;

      t.sx = x; t.sy = y;

      // ease scale back
      const sm = (typeof t.scaleMul === 'number') ? t.scaleMul : 1.0;
      t.scaleMul = sm + (1.0 - sm) * 0.06;

      t.el.style.setProperty('--x', Math.round(x) + 'px');
      t.el.style.setProperty('--y', Math.round(y) + 'px');
      t.el.style.setProperty('--s', String(clamp(t.scaleMul, 0.85, 1.45)));
    }
  }

  function tickGaze() {
    if (!running) return;
    if (!gazeEnabled) {
      if (gazeTarget) clearLock(true);
      return;
    }
    if (!CFG.lockOnEnabled) return;

    const tNow = now();

    // throttle lock updates
    if (tNow - lastLockUpdateAt < (CFG.lockUpdateEveryMs | 0)) return;
    lastLockUpdateAt = tNow;

    const t = pickNearestToCenter();

    if (!t || !t.alive) {
      clearLock(false);
      return;
    }

    // switch target
    if (gazeTarget !== t) {
      gazeTarget = t;
      gazeHoldMs = 0;
      gazeChargeMs = 0;
      gazeChargeArmed = false;
      lockProgPrev = -1;
      chargeProgPrev = -1;
      setLockEl(t.el);
      logEvent({ kind: 'lock_acquire', emoji: t.emoji, good: !!t.good, boss: !!t.boss, decoy: !!t.decoy, timeLeft: remainingSec });
    }

    // progress
    gazeHoldMs += (CFG.lockUpdateEveryMs | 0);
    const fuseMs = effectiveFuseMs();
    const prog = clamp(gazeHoldMs / fuseMs, 0, 1);

    // Rage feints (boss)
    if (t.boss && t.rage && CFG.rageEnabled) {
      if (t.feintStep === 0 && prog >= (CFG.feint1AtProg || 0.46)) {
        t.feintStep = 1;
        doFeint(t, 1);
      } else if (t.feintStep === 1 && prog >= (CFG.feint2AtProg || 0.86)) {
        t.feintStep = 2;
        doFeint(t, 2);
      }
    }

    // charge ring when armed
    let cprog = 0;
    if (gazeChargeArmed && !burstInFlight) {
      gazeChargeMs += (CFG.lockUpdateEveryMs | 0);
      cprog = clamp(gazeChargeMs / (CFG.chargeAfterMs | 0), 0, 1);
    }

    updateLockEvent(t, prog, cprog);

    // fuse complete => burst
    if (prog >= 1 && !burstInFlight) {
      // fire burst and arm charge if player keeps staring
      burstFire();
      gazeHoldMs = 0;
      gazeChargeArmed = true;
      gazeChargeMs = 0;
      // subtle feedback
      haptic(10);
      dispatch('groups:reticle', { state: 'ok' });
    }

    // charge complete
    if (gazeChargeArmed && !burstInFlight && cprog >= 1) {
      tryChargeShot();
    }
  }

  function mainLoop() {
    if (!running) return;
    renderTargets();
    tickGaze();
    rafId = requestAnimationFrame(mainLoop);
  }

  // ========== SPAWN / SECOND LOOP ==========
  function scheduleNextSpawn() {
    if (!running) return;
    clearTimeout(spawnTimer);
    spawnTimer = setTimeout(() => {
      createTarget();
      scheduleNextSpawn();
    }, effectiveSpawnInterval());
  }

  function isClutch() {
    const n = (CFG.clutchLastSec | 0) || 3;
    return remainingSec > 0 && remainingSec <= n;
  }

  function startSecondLoop() {
    clearInterval(secondTimer);
    secondTimer = setInterval(() => {
      if (!running) return;

      if (remainingSec > 0) remainingSec--;
      dispatch('hha:time', { left: remainingSec });

      // CLUTCH: 3..2..1 tick + edge pulse
      if (isClutch()) {
        setEdgeOn(true);

        if (remainingSec !== lastClutchTickSec && remainingSec > 0) {
          lastClutchTickSec = remainingSec;
          const f = (remainingSec === 1) ? 980 : (remainingSec === 2 ? 820 : 720);
          tone(f, 0.04, 0.055, 'square');
          haptic(remainingSec === 1 ? [18, 18] : 12);
          edgeBeat();
          logEvent({ kind: 'clutch_tick', secLeft: remainingSec });
        }
      } else {
        setEdgeOn(false);
        lastClutchTickSec = -1;
      }

      // panic window
      if (remainingSec > 0 && remainingSec <= (CFG.panicLastSec | 0)) setPanic(true, remainingSec);
      else setPanic(false, remainingSec);

      tickFever();
      tickRush();
      tryBossWave();

      // quest second tick
      try { if (quest && typeof quest.second === 'function') quest.second(); } catch {}

      updateAdaptiveSoon();
      emitQuestUpdate();
      emitRank();

      if (remainingSec <= 0) stopAll('time_up');
    }, 1000);
  }

  // ========== RESET / STOP ==========
  function resetState() {
    active.slice().forEach(t => destroyTarget(t, true));
    active.length = 0;

    score = 0; combo = 0; comboMax = 0;
    misses = 0;

    goodHits = 0; junkHits = 0; goodExpires = 0; junkExpires = 0;

    startedAt = now();
    fever = 0; feverOn = false; feverEndsAt = 0; shield = 0;

    goalIndexShown = -1;
    miniIndexShown = -1;
    allClearedShown = false;

    lastGrade = 'C';

    skill = 0;
    sizeMul = 1.0;
    adaptiveTick = 0;

    panicOn = false;
    rushOn = false;
    rushEndsAt = 0;
    rushCooldownSec = 0;
    bossWaveEndsAt = 0;

    clearLock(true);
    cancelBurst();

    setEdgeOn(false);
    lastClutchTickSec = -1;
  }

  function stopAll(reason) {
    running = false;

    clearTimeout(spawnTimer); spawnTimer = null;
    clearInterval(secondTimer); secondTimer = null;
    if (rafId) { try { cancelAnimationFrame(rafId); } catch {} rafId = null; }

    cancelBurst();
    clearLock(true);

    active.slice().forEach(t => destroyTarget(t, true));
    active.length = 0;

    const goalsAll = quest ? (quest.goals || []) : [];
    const minisAll = quest ? (quest.minis || []) : [];
    const goalsCleared = goalsAll.filter(g => g && g.done).length;
    const minisCleared = minisAll.filter(m => m && m.done).length;

    const finalGrade = normalizeGrade(lastGrade || emitRank() || 'C');

    logEvent({
      kind: 'end',
      reason: reason || 'stop',
      scoreFinal: score,
      comboMax,
      misses,
      goalsTotal: goalsAll.length,
      goalsCleared,
      miniTotal: minisAll.length,
      miniCleared: minisCleared,
      grade: finalGrade
    });

    dispatch('hha:end', {
      reason: reason || 'stop',
      scoreFinal: score,
      comboMax,
      misses,
      goalsTotal: goalsAll.length,
      goalsCleared,
      miniTotal: minisAll.length,
      miniCleared: minisCleared,
      grade: finalGrade
    });

    setEdgeOn(false);
    lastClutchTickSec = -1;
  }

  // ========== START ==========
  function start(diff = 'normal', opts = {}) {
    layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;
    if (!layerEl) { console.error('[FoodGroupsVR] layerEl missing'); return; }

    runMode = String((opts && opts.runMode) ? opts.runMode : 'play').toLowerCase();
    if (runMode !== 'research') runMode = 'play';

    if (opts && opts.config) Object.assign(CFG, opts.config);

    applyDifficulty(diff);

    // base values for adaptive
    CFG._baseSpawnInterval = CFG.spawnInterval;
    CFG._baseMaxActive = CFG.maxActive;

    resetState();

    ensureEdge();

    // fever ui
    FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
    FeverUI.setFever && FeverUI.setFever(0);
    FeverUI.setFeverActive && FeverUI.setFeverActive(false);
    FeverUI.setShield && FeverUI.setShield(0);

    // quest
    const QF = getQuestFactory();
    if (QF) quest = QF.createFoodGroupsQuest(diff);
    else { quest = null; console.warn('[FoodGroupsVR] quest-manager not found'); }

    // research mode: freeze randomness features to control variables
    if (runMode === 'research') {
      sizeMul = 1.0;
      CFG.adaptiveEnabledPlay = false;
      CFG.rushEnabled = false;
      CFG.bossWaveEnabled = false;
      CFG.decoyEnabled = false;
      CFG.rageEnabled = false;
    } else {
      CFG.adaptiveEnabledPlay = true;
      CFG.rushEnabled = true;
      CFG.bossWaveEnabled = true;
      CFG.decoyEnabled = true;
      CFG.rageEnabled = true;
    }

    // intro coach
    const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
    coach(g ? `เริ่มเลย! หมู่ปัจจุบัน: ${g.label} ✨` : 'เริ่มเลย! แตะ/จ้องอาหารดีให้ได้เยอะ ๆ ✨');

    // log session
    logSessionStart({
      diff,
      runMode,
      durationSec: remainingSec || 0,
      ua: navigator.userAgent || '',
      screenW: window.innerWidth || 0,
      screenH: window.innerHeight || 0
    });

    emitQuestUpdate();
    emitRank();

    running = true;

    startSecondLoop();
    scheduleNextSpawn();

    // quick warm spawns
    createTarget();
    setTimeout(() => createTarget(), 220);
    setTimeout(() => createTarget(), 420);

    dispatch('hha:score', { score, combo, misses, shield, fever });
    logEvent({ kind: 'start', diff, runMode });

    // raf
    rafId = requestAnimationFrame(mainLoop);
  }

  // ========== PUBLIC API ==========
  ns.GameEngine = {
    setLayerEl(el) {
      layerEl = el;
      bindTapAnywhere(layerEl);
    },
    setCameraEl(el) {
      camEl = el || null;
      updateCamAngles();
    },
    setTimeLeft(sec) {
      remainingSec = Math.max(0, sec | 0);
      dispatch('hha:time', { left: remainingSec });
    },
    setGaze(on) {
      gazeEnabled = !!on;
      if (!gazeEnabled) { clearLock(false); cancelBurst(); }
      logEvent({ kind: 'gaze_toggle', on: gazeEnabled });
    },
    start,
    stop(reason) { stopAll(reason || 'stop'); }
  };

})();