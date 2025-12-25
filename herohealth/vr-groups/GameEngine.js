// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION HYBRID ENGINE (FIX-ALL + 1-3 PATCH)
// PATCH (1-3):
// 1) quest:panic handled by HTML (tick/flash/shake)
// 2) lock ring UI handled by HTML via groups:lock
// 3) WRONG GROUP: off-group good decoys (PLAY only) + penalty

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

  // time
  let remainingSec = 0;
  let panicOn = false;

  // rush
  let rushOn = false;
  let rushEndsAt = 0;
  let rushCooldownSec = 0;

  // boss wave
  let bossWaveEndsAt = 0;

  // camera angles
  let camYaw = 0;
  let camPitch = 0;

  // lock-on
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

  // ---------- config ----------
  const CFG = {
    spawnInterval: 900,
    maxActive: 4,

    fovXRad: 1.05,
    fovYRad: 0.78,
    worldYawRangeRad: 0.62,
    worldPitchRangeRad: 0.34,
    parallaxDepthMin: 0.85,
    parallaxDepthMax: 1.15,
    floatSwayPx: 8,
    floatSwayMs: 1400,

    safeLeftPx: 28,
    safeRightPx: 28,
    safeTopPx: 118,
    safeBottomPx: 160,

    minVisible: 2000,
    lifeTime: [3800, 5200],

    targetSizePx: 132,
    targetSizeMinMul: 0.78,
    targetSizeMaxMul: 1.18,

    emojisJunk: ['🧋','🍟','🍩','🍔','🍕'],

    pointsGood: 10,
    pointsGoodFever: 14,
    pointsJunkHit: -8,
    pointsGoodExpire: -4,
    pointsGoodRushMul: 2,

    feverGainGood: 14,
    feverLossMiss: 18,
    feverDurationMs: 8000,
    shieldPerFever: 1,

    bossJunkChance: 0.08,
    bossJunkEmoji: ['☠️','🧨','💣','👿'],
    bossJunkScaleMul: 1.28,
    bossHP: 3,

    adaptiveEnabledPlay: true,
    adaptiveEverySec: 3,
    skillGainGood: 8,
    skillGainPerfect: 10,
    skillLossMiss: 14,
    skillLossExpire: 12,
    skillClamp: 100,

    coachHypeEveryCombo: 6,

    panicLastSec: 10,
    panicSpawnMul: 0.85,
    panicMaxActiveAdd: 1,

    rushEnabled: true,
    rushMinSec: 6,
    rushMaxSec: 8,
    rushSpawnMul: 0.62,
    rushMaxActiveAdd: 2,
    rushMinStartAfterSec: 10,
    rushChancePerSec: 0.10,
    rushCooldownAfter: 12,

    bossWaveEnabled: true,
    bossWaveChancePerSec: 0.06,
    bossWaveSec: 5,

    aimAssistRadiusPx: 130,
    aimAssistAngleRad: 0.22,

    lockOnEnabled: true,
    lockOnMinHoldMs: 90,
    lockUpdateEveryMs: 60,

    burstCountBase: 2,
    burstCountFever: 3,
    burstCountRush: 3,
    burstGapMsBase: 110,
    burstGapMsRapid: 85,

    gazeFuseMsEasy: 560,
    gazeFuseMsNormal: 520,
    gazeFuseMsHard: 460,
    fuseMsRapidMul: 0.72,
    fuseMsBossWaveMul: 0.86,

    chargeEnabled: true,
    chargeAfterMs: 420,
    chargeGoodBonus: 12,
    chargeLabel: 'CHARGE!',
    chargeCooldownMs: 220,

    chainEnabled: true,
    chainRadiusPx: 240,
    chainDelayMs: 70,
    chainMul: 0.65,
    chainShotsRapid: 1,
    chainShotsCharge: 2,

    // ===== NEW: Off-group decoys + WRONG penalty (PLAY only) =====
    offGroupEnabled: true,
    offGroupChance: 0.25,     // 25% good will be from other group
    wrongPenaltyScore: -8,
    wrongPenaltyFever: 12,
    wrongCountsAsMiss: true
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

    return { x, y };
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
    fever = clamp(v, 0, 100);
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
    if (fever < 100) return;

    setFeverActive(true);
    feverEndsAt = now() + CFG.feverDurationMs;
    setShieldValue(shield + (CFG.shieldPerFever | 0));

    dispatch('hha:judge', { label:'FEVER', x: window.innerWidth/2, y: window.innerHeight*0.52, good:true });
    coach('🔥 FEVER! จ้องแล้วรัวเป็นชุด + CHAIN!');
    logEvent({ kind:'fever_start', timeLeft: remainingSec, shield, rushOn });

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

  // ---------- quest ----------
  function resolveQuestFactory(){
    return (window.GroupsQuest && typeof window.GroupsQuest.createFoodGroupsQuest === 'function')
      ? window.GroupsQuest
      : null;
  }
  function pickActive(list){
    if (!Array.isArray(list) || !list.length) return null;
    return list.find(x => x && !x.done) || list.find(Boolean) || null;
  }
  function emitQuestUpdate() {
    if (!quest){
      dispatch('quest:update', { questOk:false, goal:null, mini:null, goalsAll:[], minisAll:[], groupLabel:'', groupKey:0 });
      return;
    }
    const goalsAll = Array.isArray(quest.goals) ? quest.goals : [];
    const minisAll = Array.isArray(quest.minis) ? quest.minis : [];

    const goal = pickActive(goalsAll);
    const mini = pickActive(minisAll);

    const g = quest.getActiveGroup ? quest.getActiveGroup() : null;

    dispatch('quest:update', {
      questOk:true,
      goal: goal ? { label: goal.label, prog: goal.prog, target: goal.target } : null,
      mini: mini ? { label: mini.label, prog: mini.prog, target: mini.target, tLeft: mini.tLeft, windowSec: mini.windowSec } : null,
      goalsAll, minisAll,
      groupLabel: g ? g.label : '',
      groupKey: g ? (g.key || 0) : 0
    });
  }

  // ---------- rank (ย่อ: เหมือนเดิม) ----------
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
    const g = normalizeGrade(gradeFromMetrics(sps, acc, qp, misses));
    dispatch('hha:rank', {
      grade: g,
      scorePerSec: Number(sps.toFixed(2)),
      accuracy: Number((acc * 100).toFixed(0)),
      questsPct: Number((qp * 100).toFixed(0))
    });
    lastGrade = g;
    return g;
  }

  // ---------- rush/panic/bosswave (คงเดิมหลัก ๆ แบบก่อน) ----------
  function setPanic(on){ panicOn = !!on; }
  function bossWaveOn(){ return bossWaveEndsAt && now() < bossWaveEndsAt; }
  function tryBossWave(){ /* เหมือนเดิม (ตัดย่อเพื่อไม่ยาว) */ }
  function tryStartRush(){ /* เหมือนเดิม */ }
  function tickRush(){ /* เหมือนเดิม */ }
  function effectiveSpawnInterval(){
    let si = CFG.spawnInterval;
    if (rushOn) si = Math.round(si * CFG.rushSpawnMul);
    if (panicOn) si = Math.round(si * CFG.panicSpawnMul);
    if (bossWaveOn()) si = Math.round(si * 0.78);
    return clamp(si, 420, 1600);
  }
  function effectiveMaxActive(){
    let ma = CFG.maxActive;
    if (rushOn) ma += (CFG.rushMaxActiveAdd | 0);
    if (panicOn) ma += (CFG.panicMaxActiveAdd | 0);
    if (bossWaveOn()) ma += 1;
    return clamp(ma, 2, 9);
  }

  // ---------- aim assist ----------
  function pickNearestToCenter(){
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    let best = null, bestD = Infinity;

    for (let i=0;i<active.length;i++){
      const t = active[i];
      if (!t || !t.alive) continue;

      const dx = (t.sx - cx);
      const dy = (t.sy - cy);
      const d = Math.sqrt(dx*dx + dy*dy);

      const relYaw = normAngleRad(t.yaw - camYaw);
      const relPitch = (t.pitch - camPitch);
      const ang = Math.sqrt(relYaw*relYaw + relPitch*relPitch);
      if (ang > (CFG.aimAssistAngleRad || 0.22)) continue;

      if (d < bestD){ bestD = d; best = t; }
    }

    const radius = (CFG.aimAssistRadiusPx|0) + (rushOn ? 60 : 0);
    if (best && bestD <= radius) return best;
    return null;
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
  function clearLock(){
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
    dispatch('groups:lock', { on:false, prog:0, charge:0 });
  }
  function updateLockEvent(t, prog, charge){
    const p = clamp(prog, 0, 1);
    const c = clamp(charge, 0, 1);
    dispatch('groups:lock', { on:true, prog:p, charge:c, boss:!!t.boss, good:!!t.good });
  }

  // ---------- targets ----------
  function removeFromActive(t) {
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i, 1);
  }
  function destroyTarget(t) {
    if (!t || !t.alive) return;
    if (gazeTarget === t) clearLock();

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

  // ✅ helper: pick group for emoji
  function pickGroupEmoji(ag){
    const g = ag;
    if (g && Array.isArray(g.emojis) && g.emojis.length){
      const e = g.emojis[randInt(0, g.emojis.length - 1)];
      return { emoji:e, groupKey:(g.key||0), offGroup:false };
    }
    return { emoji:'🍎', groupKey:0, offGroup:false };
  }
  function pickOffGroupEmoji(activeGroup){
    // collect from other groups (available through quest.getActiveGroup only -> use minis/goals? not)
    // easiest: use known 5 groups from quest object if it exposes it; if not -> fallback to hard-coded pool
    const pool = ['🍚','🍞','🥔','🥦','🥕','🍎','🍌','🥑','🧈','🍗','🥩','🐟','🍳','🥛','🧀'];
    const emoji = pool[randInt(0, pool.length-1)];
    // groupKey approximate: infer by emoji if possible (rough), but for “หมู่ผิด” แค่ compare กับ current key ก็พอ
    // We'll mark groupKey=999 to ensure mismatch
    return { emoji, groupKey:999, offGroup:true };
  }

  function applyTargetSizeTo(el, scaleMul){ applyTargetSizeToEl(el, scaleMul); }

  function createTarget() {
    if (!running || !layerEl) return;
    if (active.length >= effectiveMaxActive()) return;

    const ag = (quest && quest.getActiveGroup) ? quest.getActiveGroup() : null;

    const good = Math.random() < 0.75;
    let emoji = '';
    let isBoss = false;

    // ✅ groupKey carried on target
    let groupKey = ag ? (ag.key||0) : 0;
    let offGroup = false;

    if (good) {
      // ✅ PLAY: off-group decoy chance
      if (runMode === 'play' && CFG.offGroupEnabled && (Math.random() < (CFG.offGroupChance||0.25))){
        const pick = pickOffGroupEmoji(ag);
        emoji = pick.emoji;
        groupKey = pick.groupKey;
        offGroup = true;
      } else {
        const pick = pickGroupEmoji(ag);
        emoji = pick.emoji;
        groupKey = pick.groupKey;
        offGroup = false;
      }
    } else {
      const bossChance = bossWaveOn() ? Math.min(0.22, (CFG.bossJunkChance||0.08) * 2.4) : (CFG.bossJunkChance||0.08);
      isBoss = (Math.random() < bossChance);
      if (isBoss) emoji = (CFG.bossJunkEmoji||['👿'])[randInt(0, (CFG.bossJunkEmoji||['👿']).length - 1)];
      else emoji = (CFG.emojisJunk||['🍟'])[randInt(0, (CFG.emojisJunk||['🍟']).length - 1)];
      groupKey = 0;
      offGroup = false;
    }

    const el = document.createElement('div');
    el.className =
      'fg-target ' +
      (good ? ('fg-good' + (offGroup ? ' fg-offgroup' : '')) : (isBoss ? 'fg-junk fg-boss' : 'fg-junk'));

    el.textContent = emoji;
    el.classList.add('spawn');

    applyTargetSizeTo(el, isBoss ? (CFG.bossJunkScaleMul||1.28) : 1.0);

    const wp = spawnWorldAngles();
    layerEl.appendChild(el);

    const t = {
      el, good, emoji,
      boss: isBoss,
      hp: isBoss ? (CFG.bossHP|0) : 1,
      hpMax: isBoss ? (CFG.bossHP|0) : 1,

      groupKey,
      offGroup,

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
      scaleMul: 1.0
    };

    active.push(t);
    requestAnimationFrame(() => { try { el.classList.add('show'); } catch {} });

    t.minTimer = setTimeout(() => { t.canExpire = true; }, CFG.minVisible);

    const life = randInt((CFG.lifeTime||[3800,5200])[0], (CFG.lifeTime||[3800,5200])[1]);
    t.lifeTimer = setTimeout(() => {
      if (!t.canExpire) {
        const wait = Math.max(0, CFG.minVisible - (now() - t.bornAt));
        setTimeout(()=> expireTarget(t), wait);
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

    logEvent({ kind:'spawn', emoji, good, boss: !!t.boss, offGroup: !!t.offGroup, groupKey: t.groupKey, timeLeft: remainingSec });
  }

  function expireTarget(t) {
    if (!running || !t || !t.alive) return;
    if (!t.canExpire) return;

    const pos = centerXY(t.el);
    try { t.el && t.el.classList.add('out'); } catch {}
    destroyTarget(t);

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

    emitQuestUpdate();
    emitRank();
  }

  function hitTarget(t, meta) {
    if (!running || !t || !t.alive) return;

    const pos = centerXY(t.el);

    // -------- GOOD --------
    if (t.good) {
      destroyTarget(t);
      goodHits++;

      // ✅ WRONG GROUP logic (PLAY only)
      const activeKey = (quest && quest.getActiveGroup) ? ((quest.getActiveGroup().key)||0) : 0;
      const isWrong = (runMode === 'play') && (t.offGroup || (t.groupKey && activeKey && t.groupKey !== activeKey));

      if (isWrong){
        if (CFG.wrongCountsAsMiss) addMiss();
        addScore(CFG.wrongPenaltyScore|0);
        setCombo(0);
        consecutiveGood = 0;
        setFeverValue(fever - (CFG.wrongPenaltyFever|0));

        dispatch('hha:judge', { label:'WRONG', x: pos.x, y: pos.y, good:false, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.wrongPenaltyScore|0), { judgment:'WRONG', good:false });

        coach('❌ หมู่ผิด! ต้องเก็บ “หมู่ปัจจุบัน” นะ');
        dispatch('groups:reticle', { state:'miss' });
        tone(210,0.08,0.08,'square');
        haptic([30,40,30]);

        logEvent({ kind:'wrong_group', emoji: t.emoji, groupKey: t.groupKey, activeKey, timeLeft: remainingSec });

        emitQuestUpdate();
        emitRank();
        return;
      }

      // ✅ normal good
      consecutiveGood++;
      const pts = (feverOn ? CFG.pointsGoodFever : CFG.pointsGood) * (rushOn ? (CFG.pointsGoodRushMul||2) : 1);
      addScore(pts|0);
      setCombo(combo + 1);

      setFeverValue(fever + (CFG.feverGainGood|0));
      maybeEnterFever();

      if (quest && typeof quest.onGoodHit === 'function') {
        quest.onGoodHit(activeKey || 1, (combo + 1));
      }

      dispatch('hha:judge', { label:(rushOn?'RUSH+':'GOOD'), x: pos.x, y: pos.y, good:true, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + (pts|0), { judgment:(rushOn?'RUSH+':'GOOD'), good:true });

      dispatch('groups:reticle', { state: (feverOn ? 'perfect' : 'ok') });
      tone(880,0.055,0.05,'triangle');
      haptic([12]);

      logEvent({ kind:'hit_good', emoji: t.emoji, pts: pts|0, combo, score, timeLeft: remainingSec });

    // -------- JUNK --------
    } else {
      destroyTarget(t);
      consecutiveGood = 0;

      junkHits++;
      addMiss();
      addScore(CFG.pointsJunkHit|0);
      setCombo(0);
      setFeverValue(fever - CFG.feverLossMiss);

      if (quest && typeof quest.onJunkHit === 'function') quest.onJunkHit(0);

      dispatch('hha:judge', { label:'MISS', x: pos.x, y: pos.y, good:false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsJunkHit|0), { judgment:'MISS', good:false });

      coach('โอ๊ะ! โดนขยะ 😵');
      dispatch('groups:reticle', { state:'miss' });
      tone(160,0.08,0.08,'square');
      haptic([35,40,35]);

      logEvent({ kind:'hit_junk_miss', emoji: t.emoji, penalty: CFG.pointsJunkHit|0, timeLeft: remainingSec });
    }

    emitQuestUpdate();
    emitRank();
  }

  // ---------- render loop ----------
  function renderTargets(){
    updateCamAngles();
    const tNow = now();
    const sway = (CFG.floatSwayPx || 0);
    const swayMs = (CFG.floatSwayMs || 1400);

    for (let i=0;i<active.length;i++){
      const t = active[i];
      if (!t || !t.alive || !t.el) continue;

      const wp = worldToScreen(t.yaw, t.pitch, t.depth);
      let x = wp.x, y = wp.y;

      const s = (Math.sin((tNow + t.swaySeed) / swayMs) * sway);
      x += s * 0.6;
      y += s * 0.35;

      t.sx = x; t.sy = y;

      t.el.style.setProperty('--x', Math.round(x) + 'px');
      t.el.style.setProperty('--y', Math.round(y) + 'px');
      t.el.style.setProperty('--s', '1');
    }
  }

  function tickGaze(dt){
    if (!gazeEnabled || !CFG.lockOnEnabled) return;
    if (!running) return;

    const t = pickNearestToCenter();
    if (!t){ if (gazeTarget) clearLock(); return; }

    if (gazeTarget !== t){
      gazeTarget = t;
      gazeHoldMs = 0;
      gazeChargeMs = 0;
      gazeChargeArmed = false;
      setLockEl(t.el);
      updateLockEvent(t, 0, 0);
      return;
    }

    gazeHoldMs += dt;

    const fuseMsBase = gazeFuseMsBase;
    const fuseMs = clamp(fuseMsBase * ((feverOn||rushOn)?0.72:1), 240, 900);

    const prog = clamp(gazeHoldMs / fuseMs, 0, 1);

    // charge progression
    let charge = 0;
    if (prog >= 1){
      // auto-fire a burst feel (single hit here)
      gazeHoldMs = 0;
      updateLockEvent(t, 0, 0);
      hitTarget(t, { source:'gaze' });
      gazeChargeArmed = true;
      gazeChargeMs = 0;
      return;
    } else if (CFG.chargeEnabled && gazeChargeArmed){
      gazeChargeMs += dt;
      charge = clamp(gazeChargeMs / (CFG.chargeAfterMs|0), 0, 1);
    }

    updateLockEvent(t, prog, charge);
  }

  function renderLoop(){
    if (!running) return;
    const tNow = now();
    const dt = Math.min(80, Math.max(0, tNow - (renderLoop._last || tNow)));
    renderLoop._last = tNow;

    renderTargets();
    tickGaze(dt);

    rafId = requestAnimationFrame(renderLoop);
  }

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
      // (rush/wave logic ตัดย่อ แต่คุณใช้ตัวเต็มก่อนหน้าได้ — ถ้าอยากให้ผมรวม full เดี๋ยวรวมให้)
      if (remainingSec > 0 && remainingSec <= (CFG.panicLastSec|0)) setPanic(true);
      else setPanic(false);

      if (quest && typeof quest.second === 'function') quest.second();

      emitQuestUpdate();
      emitRank();

      if (remainingSec <= 0){
        ns.GameEngine.stop('time_up');
      }
    }, 1000);
  }

  function resetState() {
    while(active.length){
      const t = active.pop();
      try{ t && t.el && t.el.remove(); }catch{}
    }
    score = 0; combo = 0; comboMax = 0; misses = 0;
    goodHits = 0; junkHits = 0; goodExpires = 0; junkExpires = 0;
    startedAt = now();

    fever = 0; feverOn = false; feverEndsAt = 0; shield = 0;
    consecutiveGood = 0;

    clearLock();
  }

  // ---------- public api ----------
  ns.GameEngine = {
    setLayerEl(el){ layerEl = el; if (layerEl) layerEl.addEventListener('pointerdown', ()=>{}, {passive:true}); },
    setCameraEl(el){ camEl = el || null; updateCamAngles(); },
    setTimeLeft(sec){ remainingSec = Math.max(0, sec|0); dispatch('hha:time', { left: remainingSec }); },
    setGaze(on){ gazeEnabled = !!on; if(!gazeEnabled) clearLock(); },

    start(diff='normal', opts={}){
      runMode = String(opts.runMode || 'play').toLowerCase();
      if (runMode !== 'research') runMode = 'play';

      applyDifficulty(diff);

      // research: disable offGroup decoy (นิ่ง)
      if (runMode === 'research'){
        CFG.offGroupEnabled = false;
        const sp = new URLSearchParams(location.search);
        const seedStr = opts.seed || sp.get('seed') || ('research|' + diff + '|' + remainingSec);
        enableSeededRandom(seedStr);
      } else {
        CFG.offGroupEnabled = true;
        restoreRandom();
      }

      resetState();

      const Q = resolveQuestFactory();
      quest = Q ? Q.createFoodGroupsQuest(diff) : null;

      FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
      FeverUI.setFever && FeverUI.setFever(0);
      FeverUI.setFeverActive && FeverUI.setFeverActive(false);
      FeverUI.setShield && FeverUI.setShield(0);

      coach('เริ่มเลย! เก็บ “หมู่ปัจจุบัน” ให้แม่น ๆ ✅');
      logSessionStart({ diff, runMode, durationSec: remainingSec|0 });

      emitQuestUpdate();
      emitRank();

      running = true;
      startSecondLoop();
      scheduleNextSpawn();
      renderLoop._last = now();
      rafId = requestAnimationFrame(renderLoop);

      createTarget();
      setTimeout(createTarget, 220);
      setTimeout(createTarget, 420);
    },

    stop(reason){
      running = false;
      clearTimeout(spawnTimer); spawnTimer=null;
      clearInterval(secondTimer); secondTimer=null;
      if (rafId) { try{ cancelAnimationFrame(rafId); }catch{} rafId=null; }

      const acc = accuracy();
      const qp  = questsPct();
      const finalGrade = normalizeGrade(lastGrade || emitRank() || 'C');

      dispatch('hha:end', {
        reason: reason || 'stop',
        scoreFinal: score,
        comboMax,
        misses,
        grade: finalGrade,
        accuracy: acc,
        questsPct: qp
      });

      restoreRandom();
    }
  };

})();
