// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION HYBRID ENGINE (FIX-ALL + FUN PACK)
// ✅ Quest update ALWAYS emits (even when quest missing → questOk:false)
// ✅ Fever emits hha:fever for UI compatibility
// ✅ Research mode = deterministic (seeded Math.random while running) + restore on stop
// ✅ Emoji textContent fix (kept)
// ✅ Decoy = Invert (kept)
// ✅ Rage = Double-Feint (kept)
// ✅ GOLD bonus + STORM mode + Anti-same-spot + VR drift + Panic tick SFX

(function () {
  'use strict';

  const ns = (window.GroupsVR = window.GroupsVR || {});
  const ROOT = window;

  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles ||
    { scorePop() {}, burstAt() {}, celebrateQuestFX() {}, celebrateAllQuestsFX() {} };

  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI ||
    { ensureFeverBar() {}, setFever() {}, setFeverActive() {}, setShield() {} };

  function now() { return (performance && performance.now) ? performance.now() : Date.now(); }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function dispatch(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch {} }
  function coach(text) { if (text) dispatch('hha:coach', { text: String(text) }); }

  // ---------- logging ----------
  let sessionId = '';
  function isoNow(){ try { return new Date().toISOString(); } catch { return ''; } }
  function uid(){ return 'fg_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16); }
  function logSessionStart(meta){
    if (!sessionId) sessionId = uid();
    dispatch('hha:log_session', Object.assign({
      sessionId,
      startedIso: isoNow(),
      game: 'FoodGroupsVR'
    }, meta || {}));
  }
  function logEvent(meta){
    dispatch('hha:log_event', Object.assign({
      sessionId: sessionId || '',
      tMs: Math.round(now()),
      tsIso: isoNow(),
      game: 'FoodGroupsVR'
    }, meta || {}));
  }

  // ---------- audio/haptic ----------
  let audioCtx = null;
  function tone(freq=880, dur=0.06, gain=0.05, type='square'){
    try{
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    }catch{}
  }
  function haptic(p){ try{ if (navigator.vibrate) navigator.vibrate(p); }catch{} }

  // ---------- math/camera ----------
  function toRad(deg){ return (Number(deg)||0) * Math.PI / 180; }
  function normAngleRad(a){
    let x = a;
    while (x > Math.PI) x -= Math.PI*2;
    while (x < -Math.PI) x += Math.PI*2;
    return x;
  }
  function centerXY(el) {
    try {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    } catch {
      return { x: window.innerWidth / 2, y: window.innerHeight * 0.52 };
    }
  }

  function normalizeGrade(g){
    const x = String(g || '').toUpperCase().trim();
    if (['SSS','SS','S','A','B','C'].includes(x)) return x;
    return 'C';
  }

  // =========================
  //  RESEARCH FIX (seeded random)
  // =========================
  const _nativeRandom = Math.random;
  let _seededOn = false;

  function xmur3(str){
    let h = 1779033703 ^ (str.length || 0);
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function enableSeededRandom(seedStr){
    try{
      const seedFn = xmur3(String(seedStr||'seed'));
      const seed = seedFn();
      Math.random = mulberry32(seed);
      _seededOn = true;
      logEvent({ kind:'seed_on', seed: String(seedStr||''), seed32: seed });
    }catch{}
  }
  function restoreRandom(){
    if (_seededOn){
      try{ Math.random = _nativeRandom; }catch{}
      _seededOn = false;
    }
  }

  // ---------- state ----------
  const active = [];
  let layerEl = null;
  let camEl = null;
  let running = false;

  let spawnTimer = null;
  let secondTimer = null;
  let rafId = null;

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  let goodHits = 0;
  let junkHits = 0;
  let goodExpires = 0;
  let junkExpires = 0;
  let startedAt = 0;

  const FEVER_MAX = 100;
  let fever = 0;
  let feverOn = false;
  let feverEndsAt = 0;
  let shield = 0;

  let quest = null;
  let goalIndexShown = -1;
  let miniIndexShown = -1;
  let allClearedShown = false;

  let runMode = 'play';
  let lastGrade = 'C';

  // adaptive
  let skill = 0;
  let sizeMul = 1.0;
  let adaptiveTick = 0;
  let consecutiveGood = 0;

  // time systems
  let remainingSec = 0;
  let panicOn = false;

  let rushOn = false;
  let rushEndsAt = 0;
  let rushCooldownSec = 0;

  // storm (NEW)
  let stormOn = false;
  let stormEndsAt = 0;
  let stormCooldownSec = 0;

  // boss wave
  let bossWaveEndsAt = 0;

  // camera angles
  let camYaw = 0;
  let camPitch = 0;

  // lock-on + fuse + charge + burst
  let gazeEnabled = true;
  let gazeHoldMs = 0;
  let gazeChargeMs = 0;
  let gazeChargeArmed = false;
  let gazeTarget = null;
  let lockElPrev = null;
  let lockProgPrev = -1;
  let chargeProgPrev = -1;

  let burstInFlight = false;
  let burstTimerIds = [];

  // spawn anti-repeat
  let lastSpawnX = -9999;
  let lastSpawnY = -9999;

  // ---------- config ----------
  const CFG = {
    // spawn
    spawnInterval: 900,
    maxActive: 4,

    // world-anchor/parallax
    fovXRad: 1.05,
    fovYRad: 0.78,
    worldYawRangeRad: 0.62,
    worldPitchRangeRad: 0.34,
    parallaxDepthMin: 0.85,
    parallaxDepthMax: 1.15,
    floatSwayPx: 8,
    floatSwayMs: 1400,

    // safe HUD clamp
    safeLeftPx: 28,
    safeRightPx: 28,
    safeTopPx: 118,
    safeBottomPx: 150,

    // visibility
    minVisible: 2000,
    lifeTime: [3800, 5200],

    // base size
    targetSizePx: 132,
    targetSizeMinMul: 0.78,
    targetSizeMaxMul: 1.18,

    // emoji sets (fallback)
    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚','🍞','🥔','🍊'],
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕'],

    // scoring
    pointsGood: 10,
    pointsGoodFever: 14,
    pointsJunkHit: -8,
    pointsGoodExpire: -4,
    pointsGoodRushMul: 2,

    // fever
    feverGainGood: 14,
    feverLossMiss: 18,
    feverDurationMs: 8000,
    shieldPerFever: 1,

    // boss junk
    bossJunkChance: 0.08,
    bossJunkEmoji: ['☠️','🧨','💣','👿'],
    bossJunkPenalty: -18,
    bossJunkShieldCost: 2,
    bossJunkScaleMul: 1.28,
    bossHP: 3,
    bossBreakBonus: 16,

    // adaptive
    adaptiveEnabledPlay: true,
    adaptiveEverySec: 3,
    skillGainGood: 8,
    skillGainPerfect: 10,
    skillLossMiss: 14,
    skillLossExpire: 12,
    skillClamp: 100,

    // hype
    coachHypeEveryCombo: 6,

    // panic
    panicLastSec: 10,
    panicSpawnMul: 0.85,
    panicMaxActiveAdd: 1,
    panicTickLastSec: 6,

    // rush
    rushEnabled: true,
    rushMinSec: 6,
    rushMaxSec: 8,
    rushSpawnMul: 0.62,
    rushMaxActiveAdd: 2,
    rushMinStartAfterSec: 10,
    rushChancePerSec: 0.10,
    rushCooldownAfter: 12,

    // storm (NEW)
    stormEnabled: true,
    stormChancePerSec: 0.08,
    stormMinSec: 6,
    stormMaxSec: 9,
    stormSpawnMul: 0.52,
    stormMaxActiveAdd: 3,
    stormCooldownAfter: 14,

    // boss wave
    bossWaveEnabled: true,
    bossWaveChancePerSec: 0.06,
    bossWaveSec: 5,

    // aim assist
    aimAssistRadiusPx: 130,
    aimAssistAngleRad: 0.22,

    // LOCK-ON + FUSE
    lockOnEnabled: true,
    lockOnMinHoldMs: 90,
    lockUpdateEveryMs: 60,

    // burst
    burstCountBase: 2,
    burstCountFever: 3,
    burstCountRush: 3,
    burstGapMsBase: 110,
    burstGapMsRapid: 85,

    // fuse speed
    gazeFuseMsEasy: 560,
    gazeFuseMsNormal: 520,
    gazeFuseMsHard: 460,
    fuseMsRapidMul: 0.72,
    fuseMsBossWaveMul: 0.86,

    // CHARGE SHOT
    chargeEnabled: true,
    chargeAfterMs: 420,
    chargeDamageBoss: 2,
    chargeGoodBonus: 12,
    chargeLabel: 'CHARGE!',
    chargeCooldownMs: 220,

    // CHAIN
    chainEnabled: true,
    chainRadiusPx: 240,
    chainDelayMs: 70,
    chainMul: 0.65,
    chainShotsRapid: 1,
    chainShotsCharge: 2,

    // ===== DECOY (Invert) =====
    decoyEnabled: true,
    decoyChance: 0.10,
    decoyPenalty: -12,
    decoyFeverLoss: 14,
    decoyShieldCost: 1,

    // ===== RAGE / DOUBLE-FEINT =====
    rageEnabled: true,
    rageChanceBoss: 0.55,
    feint1AtProg: 0.46,
    feint2AtProg: 0.86,
    feint1Kick: 0.0022,
    feint2Kick: 0.0046,
    feint2CenterBias: 0.10,

    // ===== GOLD BONUS (FUN) =====
    goldEnabled: true,
    goldChance: 0.10,
    goldBonusPts: 18,
    goldFeverGain: 24,
    goldShieldGain: 1,

    // ===== VR DRIFT (ลอยแบบ VR) =====
    driftEnabled: true,
    driftKickMin: 0.00018,
    driftKickMax: 0.00042,

    // ===== ANTI SAME SPOT =====
    resampleSpawnTries: 7,
    minSpawnDistPx: 150
  };

  let gazeFuseMsBase = CFG.gazeFuseMsNormal;
  let lastChargeAt = 0;

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

  function updateCamAngles(){
    if (!camEl) return;
    const r = camEl.getAttribute && camEl.getAttribute('rotation');
    if (!r) return;
    camYaw = toRad(r.y || 0);
    camPitch = toRad(r.x || 0);
  }

  function worldToScreen(yaw, pitch, depth){
    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    const relYaw = normAngleRad(yaw - camYaw);
    const relPitch = (pitch - camPitch);

    const nx = clamp(relYaw / (CFG.fovXRad || 1.0), -1, 1);
    const ny = clamp(relPitch / (CFG.fovYRad || 1.0), -1, 1);

    const d = clamp(depth || 1.0, 0.7, 1.4);

    let x = (w * 0.5) + (nx * w * 0.38) * d;
    let y = (h * 0.52) - (ny * h * 0.34) * d;

    x = clamp(x, (CFG.safeLeftPx|0), w - (CFG.safeRightPx|0));
    y = clamp(y, (CFG.safeTopPx|0),  h - (CFG.safeBottomPx|0));

    return { x, y, relYaw, relPitch };
  }

  function clampSkill(v){
    const c = CFG.skillClamp | 0;
    return clamp(v, -c, c);
  }

  function applyTargetSizeToEl(el, scaleMul = 1.0){
    if (!el) return;
    const base = CFG.targetSizePx | 0;
    const mul = (runMode === 'play') ? (sizeMul || 1.0) : 1.0;
    const s = clamp(Math.round(base * mul * (scaleMul || 1.0)), 92, 178);
    el.style.width = s + 'px';
    el.style.height = s + 'px';
  }

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
    fever = clamp(v, 0, FEVER_MAX);
    FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
    FeverUI.setFever && FeverUI.setFever(fever);
    dispatch('hha:score', { score, combo, misses, shield, fever });
    dispatch('hha:fever', { value: fever, on: !!feverOn, endsAt: feverEndsAt||0, shield });
  }
  function setShieldValue(v) {
    shield = Math.max(0, Number(v) || 0);
    FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
    FeverUI.setShield && FeverUI.setShield(shield);
    dispatch('hha:score', { score, combo, misses, shield, fever });
    dispatch('hha:fever', { value: fever, on: !!feverOn, endsAt: feverEndsAt||0, shield });
  }
  function setFeverActive(on) {
    feverOn = !!on;
    FeverUI.setFeverActive && FeverUI.setFeverActive(feverOn);
    dispatch('hha:fever', { value: fever, on: !!feverOn, endsAt: feverEndsAt||0, shield });
  }

  function maybeEnterFever() {
    if (feverOn) return;
    if (fever < FEVER_MAX) return;

    setFeverActive(true);
    feverEndsAt = now() + CFG.feverDurationMs;
    setShieldValue(shield + (CFG.shieldPerFever | 0));

    dispatch('hha:judge', { label:'FEVER', x: window.innerWidth/2, y: window.innerHeight*0.52, good:true });
    coach('🔥 FEVER! จ้องแล้วรัวเป็นชุด + มี CHAIN!');
    logEvent({ kind:'fever_start', timeLeft: remainingSec, shield, rushOn, stormOn });

    setFeverValue(0);
  }
  function tickFever() {
    if (!feverOn) return;
    if (now() >= feverEndsAt) {
      setFeverActive(false);
      coach('เฟเวอร์หมดแล้ว! ไปต่อ! ✨');
      logEvent({ kind:'fever_end', timeLeft: remainingSec, score, misses, comboMax });
    }
  }

  // ---------- afterimage ----------
  function spawnAfterimage(x, y, emoji, cls){
    if (!layerEl) return;
    try{
      const a = document.createElement('div');
      a.className = 'fg-afterimage ' + (cls ? String(cls) : '');
      a.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0) translate(-50%,-50%)`;
      const inner = document.createElement('div');
      inner.className = 'fg-afterimage-inner';
      inner.textContent = String(emoji || '');
      a.appendChild(inner);
      layerEl.appendChild(a);
      setTimeout(()=>{ try{ a.remove(); }catch{} }, 420);
    }catch{}
  }

  // ---------- quest ----------
  function resolveQuestFactory(){
    return (window.GroupsQuest && typeof window.GroupsQuest.createFoodGroupsQuest === 'function')
      ? window.GroupsQuest
      : null;
  }

  function emitQuestUpdate() {
    const questOk = !!quest;

    if (!quest){
      dispatch('quest:update', {
        questOk:false,
        goal:null, mini:null,
        goalsAll:[], minisAll:[],
        groupLabel:'', groupKey:0
      });
      return;
    }

    const goalsAll = quest.goals || [];
    const minisAll = quest.minis || [];

    const goal = goalsAll.find(g => g && !g.done) || null;
    const mini = minisAll.find(m => m && !m.done) || null;

    const g = quest.getActiveGroup ? quest.getActiveGroup() : null;

    dispatch('quest:update', {
      questOk,
      goal: goal ? { label: goal.label, prog: goal.prog, target: goal.target } : null,
      mini: mini ? { label: mini.label, prog: mini.prog, target: mini.target, tLeft: mini.tLeft, windowSec: mini.windowSec } : null,
      goalsAll, minisAll,
      groupLabel: g ? g.label : '',
      groupKey: g ? (g.key || 0) : 0
    });

    const goalsCleared = goalsAll.filter(x => x && x.done).length;
    if (goalsCleared !== goalIndexShown && goalsCleared > 0) {
      goalIndexShown = goalsCleared;
      dispatch('hha:celebrate', { kind:'goal', type:'goal', index: goalsCleared, total: goalsAll.length });
      coach('🎯 GOAL ผ่านแล้ว!');
      logEvent({ kind:'quest_goal_clear', idx: goalsCleared, total: goalsAll.length, timeLeft: remainingSec });
    }

    const minisCleared = minisAll.filter(x => x && x.done).length;
    if (minisCleared !== miniIndexShown && minisCleared > 0) {
      miniIndexShown = minisCleared;
      dispatch('hha:celebrate', { kind:'mini', type:'mini', index: minisCleared, total: minisAll.length });
      coach('⭐ MINI ผ่าน!');
      logEvent({ kind:'quest_mini_clear', idx: minisCleared, total: minisAll.length, timeLeft: remainingSec });
    }

    if (!allClearedShown && goalsCleared === goalsAll.length && minisCleared === minisAll.length) {
      allClearedShown = true;
      dispatch('hha:celebrate', { kind:'all', type:'all' });
      coach('🎉 เคลียร์ทุกภารกิจแล้ววว!');
      logEvent({ kind:'quest_all_clear', timeLeft: remainingSec, score, misses, comboMax });
    }
  }

  function emojiToGroupId(emoji) {
    if (quest && typeof quest.getActiveGroup === 'function') {
      const g = quest.getActiveGroup();
      if (g && Array.isArray(g.emojis) && g.emojis.includes(emoji)) return g.key || 1;
    }
    return 1;
  }

  // ---------- rank ----------
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
    const qp  = questsPct();
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

  // ---------- panic/rush/storm/wave ----------
  function setPanic(on, secLeft){
    const next = !!on;
    if (panicOn === next) return;
    panicOn = next;
    dispatch('hha:panic', { on: panicOn, secLeft: secLeft|0 });
    if (panicOn) coach('⏰ 10 วิสุดท้าย! เร่งแล้วนะ!!!');
  }

  function bossWaveOn(){ return bossWaveEndsAt && now() < bossWaveEndsAt; }

  function tryBossWave(){
    if (!CFG.bossWaveEnabled) return;
    if (runMode !== 'play') return;
    if (panicOn) return;
    if (remainingSec <= 14) return;
    if (bossWaveOn()) return;
    if (rushOn || stormOn) return;

    const elapsed = Math.floor((now() - startedAt) / 1000);
    if (elapsed < 12) return;

    if (Math.random() > CFG.bossWaveChancePerSec) return;

    bossWaveEndsAt = now() + (CFG.bossWaveSec * 1000);
    dispatch('groups:danger', { on:true });
    coach('⚠️ WAVE! บอสขยะมาเป็นชุด!');
    tone(220,0.08,0.08,'square'); setTimeout(()=>tone(180,0.08,0.08,'square'),140);
    haptic([18,18,18,30]);
    logEvent({ kind:'boss_wave_start', sec: CFG.bossWaveSec, timeLeft: remainingSec });
  }

  function tryStartRush(){
    if (!CFG.rushEnabled) return;
    if (rushOn) return;
    if (rushCooldownSec > 0) return;
    if (remainingSec <= (CFG.panicLastSec + 2)) return;
    if (stormOn) return;

    const elapsed = Math.floor((now() - startedAt) / 1000);
    if (elapsed < CFG.rushMinStartAfterSec) return;
    if (Math.random() > CFG.rushChancePerSec) return;

    rushOn = true;
    const dur = randInt(CFG.rushMinSec, CFG.rushMaxSec);
    rushEndsAt = now() + (dur * 1000);

    dispatch('hha:rush', { on:true, sec: dur });
    coach('🚀 RUSH! คะแนน x2 + CHAIN!');
    tone(660,0.06,0.06,'square'); setTimeout(()=>tone(880,0.06,0.06,'square'),80); setTimeout(()=>tone(990,0.06,0.06,'square'),160);
    haptic([15,10,15]);
    logEvent({ kind:'rush_start', sec: dur, timeLeft: remainingSec });
  }

  function tickRush(){
    if (!CFG.rushEnabled) return;

    if (rushOn) {
      if (now() >= rushEndsAt) {
        rushOn = false;
        rushEndsAt = 0;
        rushCooldownSec = CFG.rushCooldownAfter | 0;
        dispatch('hha:rush', { on:false, sec: 0 });
        coach('จบ RUSH แล้ว ไปต่อ!');
        logEvent({ kind:'rush_end', timeLeft: remainingSec, score, misses, comboMax });
      }
    } else {
      if (rushCooldownSec > 0) rushCooldownSec--;
      tryStartRush();
    }
  }

  function tryStartStorm(){
    if (!CFG.stormEnabled) return;
    if (runMode !== 'play') return;
    if (stormOn) return;
    if (stormCooldownSec > 0) return;
    if (panicOn) return;
    if (rushOn) return;
    if (bossWaveOn()) return;

    const elapsed = Math.floor((now() - startedAt) / 1000);
    if (elapsed < 12) return;
    if (remainingSec <= (CFG.panicLastSec + 3)) return;
    if (Math.random() > (CFG.stormChancePerSec || 0.08)) return;

    stormOn = true;
    const dur = randInt(CFG.stormMinSec||6, CFG.stormMaxSec||9);
    stormEndsAt = now() + dur*1000;

    dispatch('groups:storm', { on:true, sec: dur });
    coach('🌪️ STORM! เป้ามาเป็นฝน—จ้องแล้วรัวให้สะใจ!');
    tone(300,0.07,0.07,'square'); setTimeout(()=>tone(420,0.06,0.06,'square'),90); setTimeout(()=>tone(520,0.06,0.06,'square'),180);
    haptic([14,10,14,20]);
    logEvent({ kind:'storm_start', sec: dur, timeLeft: remainingSec });
  }

  function tickStorm(){
    if (!CFG.stormEnabled) return;

    if (stormOn){
      if (now() >= stormEndsAt){
        stormOn = false;
        stormEndsAt = 0;
        stormCooldownSec = (CFG.stormCooldownAfter|0) || 14;
        dispatch('groups:storm', { on:false, sec: 0 });
        coach('🌪️ STORM จบแล้ว! ไปต่อ!');
        logEvent({ kind:'storm_end', timeLeft: remainingSec, score, misses, comboMax });
      }
    } else {
      if (stormCooldownSec > 0) stormCooldownSec--;
      tryStartStorm();
    }
  }

  function effectiveSpawnInterval(){
    let si = CFG.spawnInterval;
    if (stormOn) si = Math.round(si * (CFG.stormSpawnMul || 0.52));
    if (rushOn)  si = Math.round(si * CFG.rushSpawnMul);
    if (panicOn) si = Math.round(si * CFG.panicSpawnMul);
    if (bossWaveOn()) si = Math.round(si * 0.78);
    return clamp(si, 360, 1600);
  }
  function effectiveMaxActive(){
    let ma = CFG.maxActive;
    if (stormOn) ma += (CFG.stormMaxActiveAdd|0) || 3;
    if (rushOn)  ma += (CFG.rushMaxActiveAdd|0);
    if (panicOn) ma += (CFG.panicMaxActiveAdd|0);
    if (bossWaveOn()) ma += 1;
    return clamp(ma, 2, 11);
  }

  // ---------- aim assist ----------
  function pickNearestTargetAt(x, y){
    let best = null, bestD = Infinity;
    for (let i=0;i<active.length;i++){
      const t = active[i];
      if (!t || !t.alive) continue;
      const dx = (t.sx - x), dy = (t.sy - y);
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < bestD){ bestD = d; best = t; }
    }
    return best;
  }

  function pickNearestToCenter(){
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    let best = null, bestD = Infinity;

    for (let i=0;i<active.length;i++){
      const t = active[i];
      if (!t || !t.alive) continue;

      const px = (typeof t.sx === 'number') ? t.sx : cx;
      const py = (typeof t.sy === 'number') ? t.sy : cy;

      const dx = px - cx;
      const dy = py - cy;
      const d = Math.sqrt(dx*dx + dy*dy);

      const relYaw = normAngleRad(t.yaw - camYaw);
      const relPitch = (t.pitch - camPitch);
      const ang = Math.sqrt(relYaw*relYaw + relPitch*relPitch);
      if (ang > (CFG.aimAssistAngleRad || 0.22)) continue;

      if (d < bestD){ bestD = d; best = t; }
    }

    const radius = (CFG.aimAssistRadiusPx|0) + (rushOn ? 60 : 0) + (stormOn ? 80 : 0);
    if (best && bestD <= radius) return best;
    return null;
  }

  function pickNearestWithin(x, y, radius, predicate, excludeSet){
    let best = null, bestD = Infinity;
    const r = Math.max(10, radius|0);
    for (let i=0;i<active.length;i++){
      const t = active[i];
      if (!t || !t.alive) continue;
      if (excludeSet && excludeSet.has(t)) continue;
      if (predicate && !predicate(t)) continue;

      const dx = (t.sx - x), dy = (t.sy - y);
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d <= r && d < bestD){ bestD = d; best = t; }
    }
    return best;
  }

  // ---------- tap-anywhere ----------
  function bindTapAnywhere(el){
    if (!el) return;

    const onDown = (ev) => {
      if (!running) return;

      const targetEl = ev.target && ev.target.closest ? ev.target.closest('.fg-target') : null;
      if (targetEl) return;

      let x = 0, y = 0;
      try{
        if (ev.touches && ev.touches[0]) { x = ev.touches[0].clientX; y = ev.touches[0].clientY; }
        else { x = ev.clientX; y = ev.clientY; }
      }catch{
        x = window.innerWidth/2; y = window.innerHeight/2;
      }

      const t = pickNearestTargetAt(x, y) || pickNearestToCenter();

      if (t){
        logEvent({ kind:'tap_shoot', x, y, pickedEmoji: t.emoji, pickedGood: t.good, boss: !!t.boss, decoy: !!t.decoy, gold: !!t.gold, timeLeft: remainingSec, rushOn, stormOn, feverOn, shield });
        hitTarget(t, { source:'tap' });
      } else {
        addMiss(); setCombo(0);
        setFeverValue(fever - Math.round(CFG.feverLossMiss * 0.6));
        tone(180, 0.06, 0.07, 'square');
        haptic([35,40,35]);
        dispatch('groups:reticle', { state:'miss' });
        logEvent({ kind:'tap_shoot_miss', x, y, timeLeft: remainingSec });
      }
    };

    el.addEventListener('pointerdown', onDown, { passive: true });
    el.addEventListener('touchstart', onDown, { passive: true });
  }

  // ---------- lock visuals ----------
  function setLockEl(el){
    if (lockElPrev && lockElPrev !== el){
      try { lockElPrev.classList.remove('lock'); } catch {}
    }
    lockElPrev = el || null;
    if (lockElPrev){
      try { lockElPrev.classList.add('lock'); } catch {}
    }
  }

  function clearLock(silent){
    gazeTarget = null;
    gazeHoldMs = 0;
    gazeChargeMs = 0;
    gazeChargeArmed = false;
    lockProgPrev = -1;
    chargeProgPrev = -1;

    if (lockElPrev){
      try { lockElPrev.classList.remove('lock'); } catch {}
      lockElPrev = null;
    }
    dispatch('groups:lock', { on:false, prog:0, charge:0, silent: !!silent });
  }

  function updateLockEvent(t, prog, charge){
    const p = clamp(prog, 0, 1);
    const c = clamp(charge, 0, 1);

    const msStep = CFG.lockUpdateEveryMs|0;
    const bucket = Math.floor((p*1000)/ (msStep>0?msStep:60));
    const prevBucket = Math.floor(((lockProgPrev<0? -1: lockProgPrev)*1000)/ (msStep>0?msStep:60));
    const cbucket = Math.floor((c*1000)/ (msStep>0?msStep:60));
    const cprev = Math.floor(((chargeProgPrev<0? -1: chargeProgPrev)*1000)/ (msStep>0?msStep:60));
    if (bucket === prevBucket && cbucket === cprev) return;

    lockProgPrev = p;
    chargeProgPrev = c;

    dispatch('groups:lock', {
      on:true,
      x: (t && typeof t.sx === 'number') ? t.sx : (window.innerWidth/2),
      y: (t && typeof t.sy === 'number') ? t.sy : (window.innerHeight/2),
      prog: p,
      charge: c,
      boss: !!(t && t.boss),
      good: !!(t && t.good),
      decoy: !!(t && t.decoy),
      gold: !!(t && t.gold)
    });
  }

  // ---------- burst ----------
  function cancelBurst(){
    burstInFlight = false;
    for (let i=0;i<burstTimerIds.length;i++){
      try { clearTimeout(burstTimerIds[i]); } catch {}
    }
    burstTimerIds = [];
  }

  function effectiveFuseMs(){
    let ms = gazeFuseMsBase;
    if (feverOn || rushOn || stormOn) ms = Math.round(ms * CFG.fuseMsRapidMul);
    if (bossWaveOn()) ms = Math.round(ms * CFG.fuseMsBossWaveMul);
    return clamp(ms, 240, 900);
  }
  function effectiveBurstCount(){
    if (feverOn) return (CFG.burstCountFever|0);
    if (rushOn)  return (CFG.burstCountRush|0);
    if (stormOn) return 3;
    return (CFG.burstCountBase|0);
  }
  function effectiveBurstGap(){
    if (feverOn || rushOn || stormOn) return (CFG.burstGapMsRapid|0);
    return (CFG.burstGapMsBase|0);
  }

  function burstFire(){
    if (!running || !gazeEnabled) return;
    if (burstInFlight) return;

    burstInFlight = true;
    burstTimerIds = [];

    const count = clamp(effectiveBurstCount(), 1, 5);
    const gap = clamp(effectiveBurstGap(), 60, 240);

    logEvent({ kind:'gaze_burst_start', count, gap, timeLeft: remainingSec, rushOn, stormOn, feverOn, wave: bossWaveOn() });

    for (let i=0;i<count;i++){
      const id = setTimeout(() => {
        if (!running) return;
        const t = pickNearestToCenter();
        if (t){
          tone((feverOn||rushOn||stormOn)?980:860, 0.045, 0.05, 'triangle');
          hitTarget(t, { source:'gaze', burst:true, shot:(i+1), burstCount:count, timeLeft: remainingSec });
        } else {
          tone(220, 0.03, 0.03, 'square');
          dispatch('groups:reticle', { state:'miss' });
          logEvent({ kind:'gaze_burst_dry', shot:(i+1), burstCount:count, timeLeft: remainingSec });
        }

        if (i === count - 1){
          burstInFlight = false;
          logEvent({ kind:'gaze_burst_end', timeLeft: remainingSec, score, misses, comboMax });
        }
      }, i * gap);
      burstTimerIds.push(id);
    }
  }

  // ---------- chain ----------
  function chainFromHit(x, y, basePts, options){
    if (!CFG.chainEnabled) return;
    const shots = Math.max(0, (options && options.shots) | 0);
    if (shots <= 0) return;

    const exclude = (options && options.excludeSet) ? options.excludeSet : new Set();
    let lastX = x, lastY = y;

    for (let k=0;k<shots;k++){
      setTimeout(() => {
        if (!running) return;
        const t2 = pickNearestWithin(lastX, lastY, CFG.chainRadiusPx|0,
          (t) => (t.good === true) && !t.decoy, exclude);

        if (!t2) return;

        exclude.add(t2);

        const pos2 = centerXY(t2.el);
        lastX = pos2.x; lastY = pos2.y;

        const pts = Math.round((basePts|0) * (CFG.chainMul || 0.65));
        hitTarget(t2, {
          source:'chain',
          chain:true,
          chainIdx: (k+1),
          chainPts: pts
        });
      }, (CFG.chainDelayMs|0) * (k+1));
    }
  }

  // ---------- boss bar helpers ----------
  function ensureBossBar(t){
    if (!t || !t.el) return;
    if (!t.boss) return;
    if (t.el.querySelector('.bossbar')) return;

    const bar = document.createElement('div');
    bar.className = 'bossbar';
    const fill = document.createElement('div');
    fill.className = 'bossbar-fill';
    bar.appendChild(fill);
    t.el.appendChild(bar);
  }

  function setBossBar(t){
    if (!t || !t.el || !t.boss) return;
    ensureBossBar(t);
    const fill = t.el.querySelector('.bossbar-fill');
    if (!fill) return;
    const pct = (t.hpMax > 0) ? clamp(t.hp / t.hpMax, 0, 1) : 0;
    fill.style.width = Math.round(pct * 100) + '%';
  }

  // ---------- target lifecycle ----------
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
      t.el.classList.add('hit');
      setTimeout(() => { try { t.el && t.el.remove(); } catch {} }, 180);
    }
  }

  function spawnWorldAngles(){
    const y = camYaw + (Math.random() * 2 - 1) * (CFG.worldYawRangeRad || 0.6);
    const p = camPitch + (Math.random() * 2 - 1) * (CFG.worldPitchRangeRad || 0.34);
    const depth = (CFG.parallaxDepthMin + Math.random() * (CFG.parallaxDepthMax - CFG.parallaxDepthMin));
    return { yaw: y, pitch: p, depth };
  }

  // ===== RAGE DOUBLE-FEINT helper =====
  function doFeint(t, step){
    if (!t || !t.alive) return;

    spawnAfterimage(t.sx, t.sy, t.emoji, 'a1');
    setTimeout(()=>spawnAfterimage(t.sx, t.sy, t.emoji, 'a2'), 55);

    if (step === 1){
      t.scaleMul = 1.10;
      t.vYaw   = (Math.random()<0.5?-1:1) * (CFG.feint1Kick||0.0022);
      t.vPitch = (Math.random()<0.5?-1:1) * (CFG.feint1Kick||0.0022) * 0.70;

      tone(420,0.03,0.04,'sine');
      haptic([8,12]);
      logEvent({ kind:'feint1', emoji:t.emoji, timeLeft: remainingSec });

    } else {
      t.scaleMul = 1.22;

      const bias = clamp(Number(CFG.feint2CenterBias||0.10), 0.06, 0.20);
      t.yaw   = camYaw   + (Math.random()*2-1) * (CFG.worldYawRangeRad * bias);
      t.pitch = camPitch + (Math.random()*2-1) * (CFG.worldPitchRangeRad * bias);

      t.vYaw   = (Math.random()<0.5?-1:1) * (CFG.feint2Kick||0.0046);
      t.vPitch = (Math.random()<0.5?-1:1) * (CFG.feint2Kick||0.0046) * 0.75;

      tone(520,0.04,0.05,'square');
      haptic([12,10,18]);
      logEvent({ kind:'feint2', emoji:t.emoji, timeLeft: remainingSec });
    }
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
      const bossChance = bossWaveOn() ? Math.min(0.22, CFG.bossJunkChance * 2.4) : CFG.bossJunkChance;
      isBoss = (Math.random() < bossChance);
      if (isBoss) emoji = CFG.bossJunkEmoji[randInt(0, CFG.bossJunkEmoji.length - 1)];
      else emoji = CFG.emojisJunk[randInt(0, CFG.emojisJunk.length - 1)];
    }

    const isDecoy = !!(CFG.decoyEnabled && good && (runMode === 'play') && (Math.random() < (CFG.decoyChance || 0)));
    const isGold  = !!(CFG.goldEnabled  && good && (runMode === 'play') && !isDecoy && (Math.random() < (CFG.goldChance || 0.10)));

    const el = document.createElement('div');
    el.className =
      'fg-target ' +
      (good
        ? ('fg-good' + (isDecoy ? ' fg-decoy' : '') + (isGold ? ' fg-gold' : ''))
        : (isBoss ? 'fg-junk fg-boss' : 'fg-junk'));

    el.setAttribute('data-emoji', emoji);

    // ✅ emoji textContent
    el.textContent = emoji;

    el.classList.add('spawn');

    applyTargetSizeToEl(el, isBoss ? CFG.bossJunkScaleMul : 1.0);

    // ✅ spawn angles + anti-same-spot (resample)
    let wp = spawnWorldAngles();
    const tries = clamp(CFG.resampleSpawnTries||7, 1, 12);
    const minD  = clamp(CFG.minSpawnDistPx||150, 80, 260);

    for (let k=0;k<tries;k++){
      const p0 = worldToScreen(wp.yaw, wp.pitch, wp.depth);
      const dx = (p0.x - lastSpawnX);
      const dy = (p0.y - lastSpawnY);
      const d2 = dx*dx + dy*dy;
      if (d2 >= (minD*minD)) break;
      wp = spawnWorldAngles();
    }

    layerEl.appendChild(el);

    const driftKick =
      (CFG.driftEnabled)
        ? (CFG.driftKickMin + Math.random()*(CFG.driftKickMax - CFG.driftKickMin))
        : 0;

    const t = {
      el, good, emoji,
      boss: isBoss,
      hp: isBoss ? (CFG.bossHP|0) : 1,
      hpMax: isBoss ? (CFG.bossHP|0) : 1,

      decoy: isDecoy,
      gold: isGold,

      alive: true,
      canExpire: false,
      bornAt: now(),
      minTimer: null,
      lifeTimer: null,

      yaw: wp.yaw,
      pitch: wp.pitch,
      depth: wp.depth,
      sx: window.innerWidth/2,
      sy: window.innerHeight*0.52,

      swaySeed: Math.random()*9999,
      hitCdUntil: 0,

      rage: false,
      feintStep: 0,

      // ✅ VR drift feel
      vYaw: (driftKick ? ((Math.random()<0.5?-1:1) * driftKick) : 0),
      vPitch:(driftKick ? ((Math.random()<0.5?-1:1) * driftKick * 0.75) : 0),

      scaleMul: 1.0
    };

    // set last spawn point (ใช้ center คร่าว ๆ)
    const p1 = worldToScreen(t.yaw, t.pitch, t.depth);
    lastSpawnX = p1.x; lastSpawnY = p1.y;

    if (t.boss && CFG.rageEnabled){
      t.rage = (Math.random() < (CFG.rageChanceBoss || 0.55));
      if (t.rage){
        try { el.classList.add('rage'); } catch {}
      }
    }

    if (t.boss){
      ensureBossBar(t);
      setBossBar(t);
      dispatch('groups:danger', { on:true });
      tone(260,0.08,0.07,'square'); setTimeout(()=>tone(220,0.08,0.07,'square'),120);
      haptic([18,18,18]);
      logEvent({ kind:'boss_spawn', hp: t.hp, timeLeft: remainingSec, wave: bossWaveOn() });
    }

    active.push(t);

    requestAnimationFrame(() => {
      try { el.classList.add('show'); } catch {}
    });

    t.minTimer = setTimeout(() => { t.canExpire = true; }, CFG.minVisible);

    const life = randInt(CFG.lifeTime[0], CFG.lifeTime[1]);
    t.lifeTimer = setTimeout(() => {
      if (!t.canExpire) {
        const wait = Math.max(0, CFG.minVisible - (now() - t.bornAt));
        setTimeout(() => expireTarget(t), wait);
      } else expireTarget(t);
    }, life);

    const onHit = (ev) => {
      try { ev && ev.preventDefault && ev.preventDefault(); } catch {}
      try { ev && ev.stopPropagation && ev.stopPropagation(); } catch {}
      hitTarget(t, { source:'direct' });
      return false;
    };
    el.addEventListener('pointerdown', onHit, { passive: false });
    el.addEventListener('touchstart',  onHit, { passive: false });
    el.addEventListener('mousedown',   onHit);
    el.addEventListener('click',       onHit);

    logEvent({ kind:'spawn', emoji, good, boss: !!t.boss, decoy: !!t.decoy, gold: !!t.gold, hp: t.hp, timeLeft: remainingSec, rushOn, stormOn, feverOn, wave: bossWaveOn() });
  }

  // ---------- CHARGE SHOT ----------
  function tryChargeShot(){
    if (!CFG.chargeEnabled) return;
    if (!gazeEnabled) return;
    if (!running) return;
    if (!gazeTarget || !gazeTarget.alive) return;

    const tNow = now();
    if (tNow - lastChargeAt < (CFG.chargeCooldownMs|0)) return;

    const t = gazeTarget || pickNearestToCenter();
    if (!t) return;

    lastChargeAt = tNow;
    gazeChargeMs = 0;
    gazeChargeArmed = false;
    chargeProgPrev = -1;

    dispatch('groups:charge', { on:true });
    tone(1320,0.06,0.06,'triangle'); setTimeout(()=>tone(1100,0.06,0.05,'triangle'),80);
    haptic([18,10,18]);

    logEvent({ kind:'charge_fire', emoji: t.emoji, boss: !!t.boss, good: !!t.good, decoy: !!t.decoy, gold: !!t.gold, timeLeft: remainingSec });

    hitTarget(t, { source:'charge', charge:true });
  }

  // ---------- HIT ----------
  function hitTarget(t, meta) {
    if (!running || !t || !t.alive) return;

    if (t.boss && now() < (t.hitCdUntil||0)) return;
    if (t.boss) t.hitCdUntil = now() + 70;

    const pos = centerXY(t.el);

    // ===== DECOY (Invert) =====
    if (t.good && t.decoy) {
      destroyTarget(t, true);
      consecutiveGood = 0;

      const penalty = (CFG.decoyPenalty|0);

      if (shield > 0){
        setShieldValue(shield - (CFG.decoyShieldCost|0));
        setCombo(0);

        dispatch('hha:judge', { label:'DECOY BLOCK', x: pos.x, y: pos.y, good:true, emoji:t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment:'DECOY', good:true });
        coach('😼 เกือบแล้ว! นั่น Decoy แต่โล่ช่วยไว้');
        tone(520,0.05,0.05,'sine'); haptic([10]);

        logEvent({ kind:'decoy_block', emoji:t.emoji, timeLeft: remainingSec, shield });

      } else {
        addMiss();
        addScore(penalty);
        setCombo(0);
        setFeverValue(fever - (CFG.decoyFeverLoss|0));

        dispatch('hha:judge', { label:'DECOY!', x: pos.x, y: pos.y, good:false, emoji:t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(penalty), { judgment:'DECOY', good:false });
        coach('🧠 โดนหลอก! Decoy = Invert!');
        tone(150,0.08,0.08,'square'); haptic([35,40,35]);

        spawnAfterimage(pos.x, pos.y, t.emoji, 'a1');
        setTimeout(()=>spawnAfterimage(pos.x, pos.y, t.emoji, 'a2'), 55);

        if (runMode === 'play') skill = clampSkill(skill - Math.round(CFG.skillLossMiss * 0.8));

        logEvent({ kind:'decoy_hit', emoji:t.emoji, penalty, timeLeft: remainingSec });
      }

      dispatch('groups:hit', { emoji: t.emoji, good:false, decoy:true, x: pos.x, y: pos.y });
      emitQuestUpdate();
      emitRank();
      return;
    }

    // -------- GOOD --------
    if (t.good) {
      const chainPts = meta && meta.chainPts ? (meta.chainPts|0) : 0;

      destroyTarget(t, true);

      goodHits++;
      consecutiveGood++;

      const isPerfect = feverOn || (consecutiveGood >= 6);
      let pts = feverOn ? CFG.pointsGoodFever : CFG.pointsGood;

      if (rushOn || stormOn) pts = Math.round(pts * CFG.pointsGoodRushMul);
      if (meta && meta.charge) pts = pts + (CFG.chargeGoodBonus|0);
      if (meta && meta.chain && chainPts) pts = chainPts;

      addScore(pts);
      setCombo(combo + 1);

      setFeverValue(fever + CFG.feverGainGood);
      maybeEnterFever();

      if (quest && typeof quest.onGoodHit === 'function') {
        const gid = emojiToGroupId(t.emoji);
        quest.onGoodHit(gid, combo);
      }

      let label = 'GOOD';
      if (meta && meta.charge) label = CFG.chargeLabel || 'CHARGE!';
      else if (meta && meta.chain) label = 'CHAIN';
      else if (isPerfect) label = 'PERFECT';
      else if (stormOn) label = 'STORM+';
      else if (rushOn) label = 'RUSH+';

      dispatch('hha:judge', { label, x: pos.x, y: pos.y, good: true, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: label, good: true });

      // ✅ GOLD bonus
      if (t.gold){
        addScore(CFG.goldBonusPts|0);
        setFeverValue(fever + (CFG.goldFeverGain|0));
        if (CFG.goldShieldGain) setShieldValue(shield + (CFG.goldShieldGain|0));

        dispatch('hha:judge', { label:'GOLD!', x: pos.x, y: pos.y, good:true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '✨+' + (CFG.goldBonusPts|0), { judgment:'GOLD', good:true });
        coach('✨ GOLD! แต้มพุ่ง + โล่เพิ่ม!');
        tone(980,0.05,0.06,'triangle'); tone(1320,0.03,0.04,'triangle');
      }

      dispatch('groups:reticle', { state: (meta && meta.charge) ? 'perfect' : (isPerfect ? 'perfect' : 'ok') });
      haptic([12]);
      tone((meta && meta.charge) ? 1220 : (isPerfect ? 1040 : 880), 0.055, 0.05, 'triangle');

      if (runMode === 'play') {
        skill = clampSkill(skill + (isPerfect ? CFG.skillGainPerfect : CFG.skillGainGood));
      }

      if (CFG.chainEnabled){
        const shots =
          (meta && meta.charge) ? (CFG.chainShotsCharge|0) :
          ((feverOn || rushOn || stormOn) ? (CFG.chainShotsRapid|0) : 0);

        if (shots > 0){
          const exclude = new Set([t]);
          chainFromHit(pos.x, pos.y, pts, { shots, excludeSet: exclude });
          logEvent({ kind:'chain_trigger', shots, basePts: pts, timeLeft: remainingSec });
        }
      }

      if (CFG.coachHypeEveryCombo && combo > 0 && (combo % CFG.coachHypeEveryCombo === 0)) {
        coach(`คอมโบ ${combo} แล้ว! 🚀`);
      }

      logEvent(Object.assign({
        kind:'hit_good',
        emoji: t.emoji,
        pts,
        label,
        combo,
        score,
        feverOn,
        rushOn,
        stormOn,
        shield,
        timeLeft: remainingSec,
        gold: !!t.gold
      }, meta || {}));

    // -------- JUNK --------
    } else {
      const isBoss = !!t.boss;

      if (isBoss){
        const dmg = (meta && meta.charge) ? (CFG.chargeDamageBoss|0) : 1;

        if (shield > 0) {
          junkHits++;
          const cost = (CFG.bossJunkShieldCost|0);
          setShieldValue(shield - cost);

          t.hp = Math.max(0, (t.hp|0) - dmg);
          setBossBar(t);

          if (t.hp <= 0){
            destroyTarget(t, true);
            addScore(CFG.bossBreakBonus|0);
            dispatch('hha:judge', { label:'BOSS BREAK', x: pos.x, y: pos.y, good:true, emoji: t.emoji });
            Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+'+(CFG.bossBreakBonus|0), { judgment:'BOSS BREAK', good:true });
            coach('🛡️💥 ทุบโล่บอสแตกแล้ว! สะใจ!');
            logEvent({ kind:'boss_break', via:'shield', dmg, bonus: CFG.bossBreakBonus|0, timeLeft: remainingSec });
          } else {
            dispatch('hha:judge', { label:'BOSS BLOCK', x: pos.x, y: pos.y, good:true, emoji: t.emoji });
            Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️🛡️', { judgment:'BOSS BLOCK', good:true });
            coach(`กันบอสได้! เหลือ ${t.hp}/${t.hpMax} 😱`);
            logEvent({ kind:'boss_hit_shield', dmg, hpLeft: t.hp, timeLeft: remainingSec });
          }

          dispatch('groups:reticle', { state:'ok' });
          tone(520,0.05,0.05,'sine');
          haptic([10]);

        } else {
          junkHits++;
          addMiss();
          addScore(CFG.bossJunkPenalty|0);
          setCombo(0);
          setFeverValue(fever - CFG.feverLossMiss);

          t.hp = Math.max(0, (t.hp|0) - dmg);
          setBossBar(t);

          dispatch('hha:judge', { label:'BOSS HIT!', x: pos.x, y: pos.y, good:false, emoji: t.emoji });
          Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.bossJunkPenalty|0), { judgment:'BOSS', good:false });
          coach(`😈 โดนบอส! (เหลือ ${t.hp}/${t.hpMax})`);

          dispatch('groups:reticle', { state:'miss' });
          tone(120,0.08,0.08,'square');
          haptic([25,25,25,60]);

          if (runMode === 'play') skill = clampSkill(skill - CFG.skillLossMiss);

          logEvent({ kind:'boss_hit_noshield', dmg, hpLeft: t.hp, penalty: CFG.bossJunkPenalty|0, timeLeft: remainingSec });

          if (t.hp <= 0){
            destroyTarget(t, true);
            coach('💥 บอสแตกแล้ว! แต่เจ็บหนักเลยนะ!');
            logEvent({ kind:'boss_break', via:'noshield', dmg, timeLeft: remainingSec });
          }
        }

        if (quest && typeof quest.onJunkHit === 'function') {
          const gid = emojiToGroupId(t.emoji);
          quest.onJunkHit(gid);
        }

      } else {
        destroyTarget(t, true);
        consecutiveGood = 0;

        if (shield > 0) {
          junkHits++;
          setShieldValue(shield - 1);

          dispatch('hha:judge', { label:'BLOCK', x: pos.x, y: pos.y, good:true, emoji: t.emoji });
          Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment:'BLOCK', good:true });
          coach('โล่กันไว้แล้ว! 🛡️');

          dispatch('groups:reticle', { state:'ok' });
          tone(520,0.05,0.05,'sine');
          haptic([10]);

          logEvent({ kind:'hit_junk_block', emoji: t.emoji, timeLeft: remainingSec });

        } else {
          junkHits++;
          addMiss();
          addScore(CFG.pointsJunkHit|0);
          setCombo(0);
          setFeverValue(fever - CFG.feverLossMiss);

          if (quest && typeof quest.onJunkHit === 'function') {
            const gid = emojiToGroupId(t.emoji);
            quest.onJunkHit(gid);
          }

          dispatch('hha:judge', { label:'MISS', x: pos.x, y: pos.y, good:false, emoji: t.emoji });
          Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsJunkHit|0), { judgment:'MISS', good:false });

          coach('โอ๊ะ! โดนขยะ 😵');

          dispatch('groups:reticle', { state:'miss' });
          tone(160,0.08,0.08,'square');
          haptic([35,40,35]);

          if (runMode === 'play') skill = clampSkill(skill - CFG.skillLossMiss);

          logEvent({ kind:'hit_junk_miss', emoji: t.emoji, penalty: CFG.pointsJunkHit|0, timeLeft: remainingSec });
        }
      }
    }

    dispatch('groups:hit', { emoji: t.emoji, good: t.good, decoy: !!t.decoy, gold: !!t.gold, x: pos.x, y: pos.y });
    emitQuestUpdate();
    emitRank();
  }

  function expireTarget(t) {
    if (!running || !t || !t.alive) return;
    if (!t.canExpire) return;

    const pos = centerXY(t.el);
    try { t.el && t.el.classList.add('out'); } catch {}

    if (t.boss){
      junkExpires++;
      destroyTarget(t, false);
      logEvent({ kind:'expire_boss', hpLeft: t.hp, timeLeft: remainingSec });
      return;
    }

    destroyTarget(t, false);

    if (t.good) {
      goodExpires++;
      addMiss();
      addScore(CFG.pointsGoodExpire|0);
      setCombo(0);
      consecutiveGood = 0;

      setFeverValue(fever - CFG.feverLossMiss);

      dispatch('hha:judge', { label:'MISS', x: pos.x, y: pos.y, good:false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsGoodExpire|0), { judgment:'MISS', good:false });

      if (runMode === 'play') skill = clampSkill(skill - CFG.skillLossExpire);
      logEvent({ kind:'expire_good', emoji: t.emoji, penalty: CFG.pointsGoodExpire|0, timeLeft: remainingSec });

    } else {
      junkExpires++;
      logEvent({ kind:'expire_junk', emoji: t.emoji, timeLeft: remainingSec });
    }

    dispatch('groups:expire', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y });
    emitQuestUpdate();
    emitRank();
  }

  // ---------- adaptive ----------
  function updateAdaptiveSoon(){
    if (runMode !== 'play') return;
    if (!CFG.adaptiveEnabledPlay) return;

    adaptiveTick++;
    if (adaptiveTick % (CFG.adaptiveEverySec | 0) !== 0) return;

    const t = clampSkill(skill) / (CFG.skillClamp || 100); // -1..1
    sizeMul = clamp(1.0 - (t * 0.10), CFG.targetSizeMinMul, CFG.targetSizeMaxMul);

    const baseSI = CFG._baseSpawnInterval || CFG.spawnInterval;
    const baseMA = CFG._baseMaxActive || CFG.maxActive;

    const si = clamp(baseSI * (1.0 - (t * 0.12)), 520, 1600);
    const ma = clamp(baseMA + (t > 0.55 ? 1 : 0) + (t > 0.85 ? 1 : 0), 2, 7);

    CFG.spawnInterval = Math.round(si);
    CFG.maxActive = Math.round(ma);

    logEvent({ kind:'adaptive_tick', t: Number(t.toFixed(2)), sizeMul: Number(sizeMul.toFixed(2)), spawnInterval: CFG.spawnInterval, maxActive: CFG.maxActive });
  }

  // ---------- render loop (parallax + lock/fuse/charge) ----------
  function renderTargets(){
    updateCamAngles();
    const tNow = now();
    const sway = (CFG.floatSwayPx || 0);
    const swayMs = (CFG.floatSwayMs || 1400);

    const dt = Math.min(80, Math.max(0, tNow - (renderTargets._last || tNow)));
    renderTargets._last = tNow;

    for (let i=0;i<active.length;i++){
      const t = active[i];
      if (!t || !t.alive || !t.el) continue;

      const vy = (t.vYaw||0), vp = (t.vPitch||0);
      if (vy || vp){
        t.yaw   += vy * dt;
        t.pitch += vp * dt;
        t.vYaw  *= 0.90;
        t.vPitch*= 0.90;
      }

      const wp = worldToScreen(t.yaw, t.pitch, t.depth);
      let x = wp.x, y = wp.y;

      const s = (Math.sin((tNow + t.swaySeed) / swayMs) * sway);
      x += s * 0.6;
      y += s * 0.35;

      t.sx = x; t.sy = y;

      const sm = (typeof t.scaleMul === 'number') ? t.scaleMul : 1.0;
      t.scaleMul = sm + (1.0 - sm) * 0.06;

      t.el.style.setProperty('--x', Math.round(x) + 'px');
      t.el.style.setProperty('--y', Math.round(y) + 'px');
      t.el.style.setProperty('--s', String(clamp(t.scaleMul, 0.85, 1.45)));
    }
  }

  function tickGaze(dt){
    if (!gazeEnabled || !CFG.lockOnEnabled) return;
    if (!running) return;

    const fuseMs = effectiveFuseMs();
    const t = pickNearestToCenter();

    if (!t){
      if (gazeTarget) clearLock(false);
      return;
    }

    if (gazeTarget !== t){
      gazeTarget = t;
      gazeHoldMs = 0;
      gazeChargeMs = 0;
      gazeChargeArmed = false;
      lockProgPrev = -1;
      chargeProgPrev = -1;

      setLockEl(t.el);

      dispatch('groups:lock', { on:true, x:t.sx, y:t.sy, prog:0, charge:0, boss:!!t.boss, good:!!t.good, decoy:!!t.decoy, gold:!!t.gold });
      tone(t.boss ? 300 : 420, 0.03, 0.04, 'sine');
      logEvent({ kind:'lock_acquire', emoji: t.emoji, boss:!!t.boss, good:!!t.good, decoy:!!t.decoy, gold:!!t.gold, timeLeft: remainingSec });
      return;
    }

    gazeHoldMs += dt;

    let prog = 0;
    if (gazeHoldMs >= (CFG.lockOnMinHoldMs|0)){
      prog = clamp(gazeHoldMs / fuseMs, 0, 1);
    }

    if (t.rage && t.boss){
      if (t.feintStep < 1 && prog >= (CFG.feint1AtProg||0.46)){
        t.feintStep = 1;
        doFeint(t, 1);
      } else if (t.feintStep < 2 && prog >= (CFG.feint2AtProg||0.86)){
        t.feintStep = 2;
        doFeint(t, 2);
      }
    }

    if (prog >= 1){
      gazeHoldMs = 0;
      lockProgPrev = -1;

      burstFire();
      logEvent({ kind:'lock_fire_burst', emoji:t.emoji, timeLeft: remainingSec });

      gazeChargeMs = 0;
      gazeChargeArmed = true;
      prog = 0;
    }

    let charge = 0;
    if (CFG.chargeEnabled && gazeChargeArmed){
      gazeChargeMs += dt;
      charge = clamp(gazeChargeMs / (CFG.chargeAfterMs|0), 0, 1);

      if (charge >= 1){
        tryChargeShot();
        gazeChargeMs = 0;
        gazeChargeArmed = false;
        charge = 0;
      }
    }

    updateLockEvent(t, prog, charge);

    if (charge > 0.86 && Math.random() < 0.14) tone(720,0.02,0.02,'square');
  }

  function renderLoop(){
    if (!running) return;

    renderTargets();
    tickGaze(Math.min(80, Math.max(0, (now() - (renderLoop._last || now())) )));
    renderLoop._last = now();

    rafId = requestAnimationFrame(renderLoop);
  }

  // ---------- loops ----------
  function scheduleNextSpawn() {
    if (!running) return;
    clearTimeout(spawnTimer);

    spawnTimer = setTimeout(() => {
      createTarget();
      scheduleNextSpawn();
    }, effectiveSpawnInterval());
  }

  function startSecondLoop() {
    clearInterval(secondTimer);
    secondTimer = setInterval(() => {
      if (!running) return;

      if (remainingSec > 0) remainingSec--;
      dispatch('hha:time', { left: remainingSec });

      tickFever();
      tickRush();
      tickStorm();
      tryBossWave();

      if (remainingSec > 0 && remainingSec <= (CFG.panicLastSec | 0)) setPanic(true, remainingSec);
      else setPanic(false, remainingSec);

      // ✅ panic tick SFX (6 วิท้าย)
      const lastN = (CFG.panicTickLastSec|0) || 6;
      if (remainingSec > 0 && remainingSec <= lastN){
        tone(880, 0.02, 0.02, 'square');
        if (remainingSec <= 3) haptic([12]);
      }

      if (quest && typeof quest.second === 'function') quest.second();
      updateAdaptiveSoon();

      emitQuestUpdate();
      emitRank();

      if (remainingSec <= 0){
        stopAll('time_up');
      }
    }, 1000);
  }

  function resetState() {
    active.slice().forEach(t => destroyTarget(t, true));
    active.length = 0;

    score = 0; combo = 0; comboMax = 0; misses = 0;
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
    consecutiveGood = 0;

    panicOn = false;

    rushOn = false;
    rushEndsAt = 0;
    rushCooldownSec = 0;

    stormOn = false;
    stormEndsAt = 0;
    stormCooldownSec = 0;

    bossWaveEndsAt = 0;

    lastSpawnX = -9999;
    lastSpawnY = -9999;

    clearLock(true);
    cancelBurst();
  }

  function stopAll(reason) {
    running = false;
    clearTimeout(spawnTimer); spawnTimer = null;
    clearInterval(secondTimer); secondTimer = null;
    if (rafId) { try { cancelAnimationFrame(rafId); } catch {} rafId = null; }

    cancelBurst();
    clearLock(true);

    // reset flags
    if (stormOn){ dispatch('groups:storm', { on:false, sec:0 }); }
    if (rushOn) { dispatch('hha:rush', { on:false, sec:0 }); }

    active.slice().forEach(t => destroyTarget(t, true));
    active.length = 0;

    const goalsAll = quest ? (quest.goals || []) : [];
    const minisAll = quest ? (quest.minis || []) : [];
    const goalsCleared = goalsAll.filter(g => g && g.done).length;
    const minisCleared = minisAll.filter(m => m && m.done).length;

    const finalGrade = normalizeGrade(lastGrade || emitRank() || 'C');

    logEvent({
      kind:'end',
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

    restoreRandom();
  }

  // ---------- public api ----------
  ns.GameEngine = {
    setLayerEl(el) {
      layerEl = el;
      bindTapAnywhere(layerEl);
    },
    setCameraEl(el){
      camEl = el || null;
      updateCamAngles();
    },
    setTimeLeft(sec) {
      remainingSec = Math.max(0, sec | 0);
      dispatch('hha:time', { left: remainingSec });
    },
    setGaze(on){
      gazeEnabled = !!on;
      if (!gazeEnabled) { clearLock(false); cancelBurst(); }
      logEvent({ kind:'gaze_toggle', on: gazeEnabled });
    },

    start(diff = 'normal', opts = {}) {
      layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;
      if (!layerEl) { console.error('[FoodGroupsVR] layerEl missing'); return; }

      runMode = String((opts && opts.runMode) ? opts.runMode : 'play').toLowerCase();
      if (runMode !== 'research') runMode = 'play';

      if (opts && opts.config) Object.assign(CFG, opts.config);

      applyDifficulty(diff);

      CFG._baseSpawnInterval = CFG.spawnInterval;
      CFG._baseMaxActive = CFG.maxActive;

      resetState();

      FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
      FeverUI.setFever && FeverUI.setFever(0);
      FeverUI.setFeverActive && FeverUI.setFeverActive(false);
      FeverUI.setShield && FeverUI.setShield(0);
      dispatch('hha:fever', { value: 0, on:false, endsAt: 0, shield: 0 });

      const QuestFactory = resolveQuestFactory();
      if (QuestFactory && typeof QuestFactory.createFoodGroupsQuest === 'function') {
        quest = QuestFactory.createFoodGroupsQuest(diff);
      } else {
        quest = null;
        console.warn('[FoodGroupsVR] quest-manager not found');
      }

      if (runMode === 'research') {
        sizeMul = 1.0;
        CFG.adaptiveEnabledPlay = false;
        CFG.rushEnabled = false;
        CFG.stormEnabled = false;
        CFG.bossWaveEnabled = false;
        CFG.decoyEnabled = false;
        CFG.rageEnabled = false;

        const sp = new URLSearchParams(location.search);
        const seedStr =
          (opts && opts.seed) ? String(opts.seed) :
          (sp.get('seed') ? String(sp.get('seed')) :
           ('research|' + String(diff) + '|' + String(remainingSec||0)));
        enableSeededRandom(seedStr);

      } else {
        CFG.adaptiveEnabledPlay = true;
        CFG.rushEnabled = true;
        CFG.stormEnabled = true;
        CFG.bossWaveEnabled = true;
        CFG.decoyEnabled = true;
        CFG.rageEnabled = true;
        restoreRandom();
      }

      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      coach(g ? `เริ่มเลย! หมู่ปัจจุบัน: ${g.label} ✨` : (quest ? 'เริ่มเลย! แตะ/จ้องอาหารดีให้ได้เยอะ ๆ ✨' : '⚠️ QUEST ไม่พร้อม (เช็คไฟล์ groups-quests.js)'));

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

      renderLoop._last = now();
      rafId = requestAnimationFrame(renderLoop);

      createTarget();
      setTimeout(() => createTarget(), 220);
      setTimeout(() => createTarget(), 420);

      dispatch('hha:score', { score, combo, misses, shield, fever });
      logEvent({ kind:'start', diff, runMode });
    },

    stop(reason) {
      stopAll(reason || 'stop');
    }
  };

})();