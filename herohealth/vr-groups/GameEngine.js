// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — HYBRID PRODUCTION SAFE ENGINE (UPGRADE: LOCK-ON + BURST)
// ✅ world-anchored/parallax (DOM targets follow camera yaw/pitch)
// ✅ VR-look ready (uses camera rotation from touch-look + deviceorientation)
// ✅ tap-anywhere (shoot) + aim assist (center)
// ✅ gaze/fuse auto-fire (VR headset feel)
// ✅ NEW: LOCK-ON beam + fuse progress + BURST (2–3 shots) + fever/rush rapid fire
// ✅ emoji sticker + fade-in/out
// ✅ quest + FX + fever + shield + rank + adaptive
// ✅ PANIC (last 10s) + RUSH (random) + RUSH magnet + boss junk + boss wave
// ✅ detailed log events (hha:log_event / hha:log_session)

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

  const QuestFactory =
    (ROOT.GroupsQuest && ROOT.GroupsQuest.createFoodGroupsQuest)
      ? ROOT.GroupsQuest
      : null;

  function now() { return (performance && performance.now) ? performance.now() : Date.now(); }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }

  function dispatch(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch {}
  }
  function coach(text) { if (text) dispatch('hha:coach', { text: String(text) }); }

  function normalizeGrade(g){
    const x = String(g || '').toUpperCase().trim();
    if (x === 'SSS' || x === 'SS' || x === 'S' || x === 'A' || x === 'B' || x === 'C') return x;
    return 'C';
  }

  function centerXY(el) {
    try {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    } catch {
      return { x: window.innerWidth / 2, y: window.innerHeight * 0.52 };
    }
  }

  // ---------------- LOGGING (ละเอียด) ----------------
  let sessionId = '';
  let sessionStartedIso = '';
  function isoNow(){ try { return new Date().toISOString(); } catch { return ''; } }
  function uid(){
    return 'fg_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }
  function logSessionStart(meta){
    if (!sessionId) sessionId = uid();
    sessionStartedIso = isoNow();
    dispatch('hha:log_session', Object.assign({
      sessionId,
      startedIso: sessionStartedIso,
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

  // ---------------- AUDIO / HAPTIC / HITSTOP ----------------
  let audioCtx = null;
  function tone(freq=880, dur=0.06, gain=0.06, type='square'){
    try{
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    }catch{}
  }
  function haptic(pattern){
    try{ if (navigator.vibrate) navigator.vibrate(pattern); }catch{}
  }
  let hitStopUntil = 0;
  function hitStop(ms){
    const t = now() + (ms|0);
    hitStopUntil = Math.max(hitStopUntil, t);
    try{
      document.body.classList.add('hitstop');
      setTimeout(()=>document.body.classList.remove('hitstop'), Math.max(60, ms|0));
    }catch{}
  }

  // ---------------- STATE ----------------
  const active = [];
  let layerEl = null;
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

  // adaptive (play only)
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

  // --------- NEW: LOCK-ON + BURST (gaze) ---------
  let gazeEnabled = true;

  // base fuse (จะถูกปรับตาม fever/rush)
  let gazeFuseMsBase = 520;

  // lock/fuse state
  let gazeHoldMs = 0;
  let gazeTarget = null;

  // lock highlight
  let lockElPrev = null;
  let lockProgPrev = -1;

  // burst control
  let burstInFlight = false;
  let burstShotIndex = 0;
  let burstTimerIds = [];

  // camera yaw/pitch tracking (from A-Frame camera entity rotation)
  let camEl = null;
  let camYaw = 0;
  let camPitch = 0;

  // ---------------- CONFIG ----------------
  const CFG = {
    // spawn
    spawnInterval: 900,
    maxActive: 4,

    // world anchor
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

    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚','🍞','🥔','🍊'],
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕'],

    // scoring
    pointsGood: 10,
    pointsGoodFever: 14,
    pointsJunkHit: -8,
    pointsGoodExpire: -4,

    // rush bonus
    pointsGoodRushMul: 2,

    // boss junk
    bossJunkChance: 0.08,
    bossJunkEmoji: ['☠️','🧨','💣','👿'],
    bossJunkPenalty: -18,
    bossJunkShieldCost: 2,
    bossJunkScaleMul: 1.28,

    // fever
    feverGainGood: 14,
    feverLossMiss: 18,
    feverDurationMs: 8000,
    shieldPerFever: 1,

    // adaptive tuning (play)
    adaptiveEnabledPlay: true,
    adaptiveEverySec: 3,
    skillGainGood: 8,
    skillGainPerfect: 10,
    skillLossMiss: 14,
    skillLossExpire: 12,
    skillClamp: 100,
    coachHypeEveryCombo: 6,

    // panic time
    panicLastSec: 10,
    panicSpawnMul: 0.85,
    panicMaxActiveAdd: 1,

    // rush mode
    rushEnabled: true,
    rushMinSec: 6,
    rushMaxSec: 8,
    rushSpawnMul: 0.62,
    rushMaxActiveAdd: 2,
    rushMinStartAfterSec: 10,
    rushChancePerSec: 0.10,
    rushCooldownAfter: 12,

    // aim assist
    aimAssistRadiusPx: 130,
    aimAssistAngleRad: 0.22,

    // impact
    hitStopMs: 70,
    hapticGood: [12],
    hapticMiss: [35, 40, 35],
    hapticBoss: [25, 25, 25, 60],

    // boss telegraph
    bossTelegraphMs: 650,

    // rush magnet
    rushMagnetOn: true,
    rushMagnetStrength: 0.22,
    rushAimAssistBoost: 60,

    // boss wave
    bossWaveEnabled: true,
    bossWaveChancePerSec: 0.06,
    bossWaveSec: 5,
    bossWaveEndsAt: 0,

    // -------- NEW: LOCK-ON + BURST tuning --------
    lockOnEnabled: true,
    lockOnMinHoldMs: 90,        // ติด lock เร็ว
    lockUpdateEveryMs: 60,      // ลด event spam
    gazeDryFirePenalty: false,  // ยิงลมไม่โดน -> ไม่ลงโทษ (ปลอดภัย)

    burstCountBase: 2,          // ปกติ 2 นัด
    burstCountFever: 3,         // FEVER 3 นัด
    burstCountRush: 3,          // RUSH 3 นัด
    burstGapMsBase: 110,        // เว้นระหว่างนัด
    burstGapMsRapid: 85,        // ช่วงโหด
    fuseMsRapidMul: 0.72,       // ลด fuse ช่วงโหด (FEVER/RUSH)
    fuseMsBossWaveMul: 0.86     // ลดนิดหน่อยตอน wave
  };

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
      gazeFuseMsBase = 560;
    } else if (diff === 'hard') {
      CFG.spawnInterval = 750;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4600];
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
      CFG.targetSizePx = 122;
      gazeFuseMsBase = 460;
    } else {
      CFG.spawnInterval = 900;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
      CFG.targetSizePx = 132;
      gazeFuseMsBase = 520;
    }
  }

  // ---------------- CAMERA HELPERS ----------------
  function toRad(deg){ return (Number(deg)||0) * Math.PI / 180; }
  function normAngleRad(a){
    let x = a;
    while (x > Math.PI) x -= Math.PI*2;
    while (x < -Math.PI) x += Math.PI*2;
    return x;
  }

  function updateCamAngles(){
    if (!camEl) return;
    const r = camEl.getAttribute && camEl.getAttribute('rotation');
    if (!r) return;
    camYaw = toRad(r.y || 0);
    camPitch = toRad(r.x || 0);
  }

  function getCamYawPitch(){
    return { yaw: camYaw, pitch: camPitch };
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

  // ---------------- TAP + AIM ASSIST ----------------
  function pickNearestTargetAt(x, y){
    let best = null;
    let bestD = Infinity;
    for (let i=0;i<active.length;i++){
      const t = active[i];
      if (!t || !t.alive) continue;
      const dx = (t.sx - x);
      const dy = (t.sy - y);
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < bestD){
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  function pickNearestToCenter(){
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    let best = null;
    let bestD = Infinity;

    const cam = getCamYawPitch();

    for (let i=0;i<active.length;i++){
      const t = active[i];
      if (!t || !t.alive) continue;

      const px = (typeof t.sx === 'number') ? t.sx : cx;
      const py = (typeof t.sy === 'number') ? t.sy : cy;

      const dx = px - cx;
      const dy = py - cy;
      const d = Math.sqrt(dx*dx + dy*dy);

      const relYaw = normAngleRad(t.yaw - cam.yaw);
      const relPitch = (t.pitch - cam.pitch);
      const ang = Math.sqrt(relYaw*relYaw + relPitch*relPitch);
      if (ang > (CFG.aimAssistAngleRad || 0.22)) continue;

      if (d < bestD){
        bestD = d;
        best = t;
      }
    }

    const boost = (rushOn && CFG.rushMagnetOn) ? (CFG.rushAimAssistBoost|0) : 0;
    const radius = (CFG.aimAssistRadiusPx|0) + boost;
    if (best && bestD <= radius) return best;
    return null;
  }

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
        logEvent({ kind:'tap_shoot', x, y, pickedEmoji: t.emoji, pickedGood: t.good, boss: !!t.boss, timeLeft: remainingSec, rushOn, feverOn, shield });
        hitTarget(t, { source:'tap' });
      } else {
        dispatch('groups:reticle', { state:'miss' });
        haptic(CFG.hapticMiss);
        tone(180, 0.06, 0.07, 'square');
        addMiss();
        setCombo(0);
        setFeverValue(fever - Math.round(CFG.feverLossMiss * 0.6));
        logEvent({ kind:'tap_shoot_miss', x, y, timeLeft: remainingSec, score, misses, rushOn, feverOn });
      }
    };

    el.addEventListener('pointerdown', onDown, { passive: true });
    el.addEventListener('touchstart', onDown, { passive: true });
  }

  // ---------------- TARGET LIFE ----------------
  function removeFromActive(t) {
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i, 1);
  }

  function destroyTarget(t, isHit) {
    if (!t || !t.alive) return;
    if (!isHit && !t.canExpire) return;

    // ถ้ากำลัง lock เป้านี้อยู่ -> เคลียร์
    if (gazeTarget === t) {
      clearLock(true);
    }

    t.alive = false;
    clearTimeout(t.minTimer);
    clearTimeout(t.lifeTimer);

    removeFromActive(t);

    if (t.el) {
      t.el.classList.add('hit');
      setTimeout(() => { try { t.el && t.el.remove(); } catch {} }, 180);
    }
  }

  // ---------------- FEVER ----------------
  function setFeverValue(v) {
    fever = clamp(v, 0, FEVER_MAX);
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
    if (fever < FEVER_MAX) return;

    setFeverActive(true);
    feverEndsAt = now() + CFG.feverDurationMs;

    setShieldValue(shield + (CFG.shieldPerFever | 0));

    dispatch('hha:judge', {
      label: 'FEVER',
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.52,
      good: true
    });

    coach('🔥 FEVER TIME! “จ้อง” แล้วรัวเป็นชุดเลย!');
    logEvent({ kind:'fever_start', timeLeft: remainingSec, shield, rushOn });

    setFeverValue(0);
  }

  function tickFever() {
    if (!feverOn) return;
    if (now() >= feverEndsAt) {
      setFeverActive(false);
      coach('เฟเวอร์หมดแล้ว! ไปต่อแบบนิ่ง ๆ ✨');
      logEvent({ kind:'fever_end', timeLeft: remainingSec, score, comboMax, misses });
    }
  }

  // ---------------- SCORE/COMBO/MISS ----------------
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

  // ---------------- QUEST ----------------
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

  // ---------------- ADAPTIVE (play only) ----------------
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

  // ---------------- RANK ----------------
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

  // ---------------- PANIC + RUSH + BOSS WAVE ----------------
  function setPanic(on, secLeft){
    const next = !!on;
    if (panicOn === next) return;
    panicOn = next;
    dispatch('hha:panic', { on: panicOn, secLeft: secLeft|0 });
    if (panicOn){
      coach('⏰ 10 วิสุดท้าย! เร่งแล้วนะ!!!');
      logEvent({ kind:'panic_on', timeLeft: secLeft|0 });
    } else {
      logEvent({ kind:'panic_off', timeLeft: secLeft|0 });
    }
  }

  function tryStartRush(){
    if (!CFG.rushEnabled) return;
    if (rushOn) return;
    if (rushCooldownSec > 0) return;
    if (remainingSec <= (CFG.panicLastSec + 2)) return;

    const elapsed = Math.floor((now() - startedAt) / 1000);
    if (elapsed < CFG.rushMinStartAfterSec) return;
    if (Math.random() > CFG.rushChancePerSec) return;

    rushOn = true;
    const dur = randInt(CFG.rushMinSec, CFG.rushMaxSec);
    rushEndsAt = now() + (dur * 1000);

    dispatch('hha:rush', { on:true, sec: dur });
    coach('🚀 RUSH! คะแนน x2 + “จ้องแล้วรัวเป็นชุด”!');
    tone(660,0.06,0.06,'square'); setTimeout(()=>tone(880,0.06,0.06,'square'),80); setTimeout(()=>tone(990,0.06,0.06,'square'),160);
    haptic([15,10,15]);

    logEvent({ kind:'rush_start', sec: dur, timeLeft: remainingSec, score, misses, combo });
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

  function tryBossWave(){
    if (!CFG.bossWaveEnabled) return;
    if (runMode !== 'play') return;
    if (panicOn) return;
    if (remainingSec <= 14) return;
    const elapsed = Math.floor((now() - startedAt) / 1000);
    if (elapsed < 12) return;
    if (CFG.bossWaveEndsAt && now() < CFG.bossWaveEndsAt) return;

    if (Math.random() > CFG.bossWaveChancePerSec) return;

    CFG.bossWaveEndsAt = now() + (CFG.bossWaveSec * 1000);
    dispatch('groups:danger', { on:true });
    coach('⚠️ WAVE! ระวังบอสขยะมาเป็นชุด!');
    tone(240,0.08,0.08,'square'); setTimeout(()=>tone(200,0.08,0.08,'square'),140);
    haptic([18,18,18,30]);
    logEvent({ kind:'boss_wave_start', sec: CFG.bossWaveSec, timeLeft: remainingSec });
  }

  function bossWaveOn(){
    return CFG.bossWaveEndsAt && now() < CFG.bossWaveEndsAt;
  }

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

  // ---------------- WORLD ANCHORED SPAWN ----------------
  function spawnWorldAngles(){
    const y = camYaw + (Math.random() * 2 - 1) * (CFG.worldYawRangeRad || 0.6);
    const p = camPitch + (Math.random() * 2 - 1) * (CFG.worldPitchRangeRad || 0.34);
    const depth = (CFG.parallaxDepthMin + Math.random() * (CFG.parallaxDepthMax - CFG.parallaxDepthMin));
    return { yaw: y, pitch: p, depth };
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

    const el = document.createElement('div');
    el.className = 'fg-target ' + (good ? 'fg-good' : (isBoss ? 'fg-junk fg-boss' : 'fg-junk'));
    el.setAttribute('data-emoji', emoji);
    el.classList.add('spawn');

    applyTargetSizeToEl(el, isBoss ? CFG.bossJunkScaleMul : 1.0);

    const wp = spawnWorldAngles();

    layerEl.appendChild(el);

    const t = {
      el, good, emoji,
      boss: isBoss,
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

      swaySeed: Math.random()*9999
    };
    active.push(t);

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

    if (t.boss){
      dispatch('groups:danger', { on:true });
      haptic([18,18,18]);
      tone(260,0.08,0.07,'square'); setTimeout(()=>tone(220,0.08,0.07,'square'),120);
      logEvent({ kind:'boss_telegraph', timeLeft: remainingSec });
    }

    logEvent({ kind:'spawn', emoji, good, boss: !!t.boss, timeLeft: remainingSec, rushOn, feverOn, wave: bossWaveOn() });
  }

  // ---------------- HIT / EXPIRE ----------------
  function hitTarget(t, meta) {
    if (!running || !t || !t.alive) return;

    const pos = centerXY(t.el);

    if (t.good) {
      destroyTarget(t, true);

      goodHits++;
      consecutiveGood++;

      const isPerfect = feverOn || (consecutiveGood >= 6);
      let pts = feverOn ? CFG.pointsGoodFever : CFG.pointsGood;

      if (rushOn) pts = Math.round(pts * CFG.pointsGoodRushMul);

      addScore(pts);
      setCombo(combo + 1);

      setFeverValue(fever + CFG.feverGainGood);
      maybeEnterFever();

      if (quest && typeof quest.onGoodHit === 'function') {
        const gid = emojiToGroupId(t.emoji);
        quest.onGoodHit(gid, combo);
      }

      const label = isPerfect ? 'PERFECT' : (rushOn ? 'RUSH+' : 'GOOD');

      dispatch('hha:judge', { label, x: pos.x, y: pos.y, good: true, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: label, good: true });

      dispatch('groups:reticle', { state: isPerfect ? 'perfect' : 'ok' });
      haptic(isPerfect ? [14,20,14] : CFG.hapticGood);
      tone(isPerfect ? 1040 : 880, 0.06, 0.05, 'triangle');
      if (isPerfect) hitStop(CFG.hitStopMs);

      if (runMode === 'play') {
        skill = clampSkill(skill + (isPerfect ? CFG.skillGainPerfect : CFG.skillGainGood));
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
        shield,
        timeLeft: remainingSec
      }, meta || {}));

    } else {
      destroyTarget(t, true);

      consecutiveGood = 0;
      const isBoss = !!t.boss;

      if (shield > 0) {
        junkHits++;
        const cost = isBoss ? (CFG.bossJunkShieldCost | 0) : 1;
        setShieldValue(shield - cost);

        const label = isBoss ? 'BOSS BLOCK' : 'BLOCK';
        dispatch('hha:judge', { label, x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, isBoss ? '🛡️🛡️' : '🛡️', { judgment: label, good: true });

        dispatch('groups:reticle', { state:'perfect' });
        haptic([10]);
        tone(520, 0.05, 0.05, 'sine');

        coach(isBoss ? 'บอสมา! กันได้ แต่โล่หาย 2 😱' : 'โล่กันไว้แล้ว! 🛡️');

        logEvent(Object.assign({
          kind:'hit_junk_block',
          emoji: t.emoji,
          boss: isBoss,
          shieldCost: cost,
          shieldLeft: shield,
          timeLeft: remainingSec
        }, meta || {}));

      } else {
        junkHits++;
        addMiss();
        const penalty = isBoss ? (CFG.bossJunkPenalty | 0) : (CFG.pointsJunkHit | 0);
        addScore(penalty);
        setCombo(0);

        setFeverValue(fever - CFG.feverLossMiss);

        if (quest && typeof quest.onJunkHit === 'function') {
          const gid = emojiToGroupId(t.emoji);
          quest.onJunkHit(gid);
        }

        dispatch('hha:judge', { label: isBoss ? 'BOSS HIT!' : 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(penalty), { judgment: isBoss ? 'BOSS' : 'MISS', good: false });

        dispatch('groups:reticle', { state:'miss' });
        haptic(isBoss ? CFG.hapticBoss : CFG.hapticMiss);
        tone(isBoss ? 120 : 160, 0.08, 0.08, 'square');
        hitStop(isBoss ? (CFG.hitStopMs + 40) : CFG.hitStopMs);

        coach(isBoss ? '😈 โดนบอส! เจ็บหนัก!' : 'โอ๊ะ! โดนขยะ 😵');

        if (runMode === 'play') {
          skill = clampSkill(skill - CFG.skillLossMiss);
        }

        logEvent(Object.assign({
          kind:'hit_junk_miss',
          emoji: t.emoji,
          boss: isBoss,
          penalty,
          score,
          misses,
          timeLeft: remainingSec
        }, meta || {}));
      }
    }

    dispatch('groups:hit', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y });

    emitQuestUpdate();
    emitRank();
  }

  function expireTarget(t) {
    if (!running || !t || !t.alive) return;
    if (!t.canExpire) return;

    const pos = centerXY(t.el);

    try { t.el && t.el.classList.add('out'); } catch {}
    destroyTarget(t, false);

    if (t.good) {
      goodExpires++;
      addMiss();
      addScore(CFG.pointsGoodExpire);
      setCombo(0);
      consecutiveGood = 0;

      setFeverValue(fever - CFG.feverLossMiss);

      dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsGoodExpire), { judgment: 'MISS', good: false });

      if (runMode === 'play') skill = clampSkill(skill - CFG.skillLossExpire);

      logEvent({ kind:'expire_good', emoji: t.emoji, penalty: CFG.pointsGoodExpire, timeLeft: remainingSec, score, misses });

    } else {
      junkExpires++;
      logEvent({ kind:'expire_junk', emoji: t.emoji, timeLeft: remainingSec });
    }

    dispatch('groups:expire', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y });
    emitQuestUpdate();
    emitRank();
  }

  // ---------------- SCHEDULE LOOPS ----------------
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

      tickFever();
      tickRush();
      tryBossWave();

      if (remainingSec > 0 && remainingSec <= (CFG.panicLastSec | 0)) setPanic(true, remainingSec);
      else setPanic(false, remainingSec);

      if (quest && typeof quest.second === 'function') quest.second();

      updateAdaptiveSoon();

      emitQuestUpdate();
      emitRank();

    }, 1000);
  }

  // ---------------- RENDER LOOP (parallax + LOCK-ON + burst gaze) ----------------
  function rushMagnetStep(t){
    if (!CFG.rushMagnetOn) return;
    if (!rushOn) return;
    if (!t.good) return;
    t.yaw   = t.yaw + (normAngleRad(camYaw - t.yaw) * CFG.rushMagnetStrength);
    t.pitch = t.pitch + ((camPitch - t.pitch) * CFG.rushMagnetStrength * 0.85);
  }

  function renderTargets(){
    updateCamAngles();

    const tNow = now();
    const sway = (CFG.floatSwayPx || 0);
    const swayMs = (CFG.floatSwayMs || 1400);

    for (let i=0;i<active.length;i++){
      const t = active[i];
      if (!t || !t.alive || !t.el) continue;

      rushMagnetStep(t);

      const wp = worldToScreen(t.yaw, t.pitch, t.depth);
      let x = wp.x;
      let y = wp.y;

      const s = (Math.sin((tNow + t.swaySeed) / swayMs) * sway);
      x += s * 0.6;
      y += s * 0.35;

      t.sx = x;
      t.sy = y;

      t.el.style.transform = `translate(-50%,-50%) translate3d(${x}px,${y}px,0)`;
    }
  }

  // -------- NEW: effective fuse/burst parameters --------
  function effectiveFuseMs(){
    let ms = gazeFuseMsBase;
    if (feverOn || rushOn) ms = Math.round(ms * CFG.fuseMsRapidMul);
    if (bossWaveOn()) ms = Math.round(ms * CFG.fuseMsBossWaveMul);
    return clamp(ms, 240, 900);
  }
  function effectiveBurstCount(){
    if (feverOn) return (CFG.burstCountFever|0);
    if (rushOn)  return (CFG.burstCountRush|0);
    return (CFG.burstCountBase|0);
  }
  function effectiveBurstGap(){
    if (feverOn || rushOn) return (CFG.burstGapMsRapid|0);
    return (CFG.burstGapMsBase|0);
  }

  function clearLock(silent){
    gazeTarget = null;
    gazeHoldMs = 0;
    lockProgPrev = -1;

    if (lockElPrev){
      try { lockElPrev.classList.remove('lock'); } catch {}
      lockElPrev = null;
    }
    if (!silent){
      dispatch('groups:lock', { on:false, prog:0 });
    } else {
      dispatch('groups:lock', { on:false, prog:0, silent:true });
    }
  }

  function setLockEl(el){
    if (lockElPrev && lockElPrev !== el){
      try { lockElPrev.classList.remove('lock'); } catch {}
    }
    lockElPrev = el || null;
    if (lockElPrev){
      try { lockElPrev.classList.add('lock'); } catch {}
    }
  }

  function updateLockEvent(t, prog){
    if (!CFG.lockOnEnabled) return;
    const p = clamp(prog, 0, 1);
    // throttling
    const msStep = CFG.lockUpdateEveryMs|0;
    const bucket = Math.floor((p*1000)/ (msStep>0?msStep:60));
    const prevBucket = Math.floor(((lockProgPrev<0? -1: lockProgPrev)*1000)/ (msStep>0?msStep:60));
    if (bucket === prevBucket) return;
    lockProgPrev = p;

    dispatch('groups:lock', {
      on:true,
      x: (t && typeof t.sx === 'number') ? t.sx : (window.innerWidth/2),
      y: (t && typeof t.sy === 'number') ? t.sy : (window.innerHeight/2),
      prog: p,
      boss: !!(t && t.boss),
      good: !!(t && t.good),
      fuseMs: effectiveFuseMs(),
      burst: effectiveBurstCount()
    });
  }

  function cancelBurst(){
    burstInFlight = false;
    burstShotIndex = 0;
    for (let i=0;i<burstTimerIds.length;i++){
      try { clearTimeout(burstTimerIds[i]); } catch {}
    }
    burstTimerIds = [];
  }

  function burstFire(){
    if (!running || !gazeEnabled) return;
    if (burstInFlight) return;

    burstInFlight = true;
    burstShotIndex = 0;
    burstTimerIds = [];

    const count = clamp(effectiveBurstCount(), 1, 5);
    const gap = clamp(effectiveBurstGap(), 60, 240);

    logEvent({ kind:'gaze_burst_start', count, gap, timeLeft: remainingSec, rushOn, feverOn, wave: bossWaveOn() });

    for (let i=0;i<count;i++){
      const id = setTimeout(() => {
        if (!running) return;

        const t = pickNearestToCenter();

        // ยิงโดน -> hit
        if (t){
          burstShotIndex = i + 1;
          // เสียงยิงชุด
          const f = (feverOn || rushOn) ? 980 : 860;
          tone(f + i*50, 0.045, 0.05, 'triangle');
          hitTarget(t, {
            source:'gaze',
            burst:true,
            shot:(i+1),
            burstCount:count,
            timeLeft: remainingSec
          });
        } else {
          // ยิงลม: ไม่ลงโทษ (ให้รู้สึก “โหดแต่แฟร์”)
          tone(220, 0.03, 0.03, 'square');
          dispatch('groups:reticle', { state:'miss' });
          logEvent({ kind:'gaze_burst_dry', shot:(i+1), burstCount:count, timeLeft: remainingSec });
          if (CFG.gazeDryFirePenalty && (runMode === 'play')) {
            addMiss();
            setCombo(0);
            setFeverValue(fever - Math.round(CFG.feverLossMiss * 0.4));
          }
        }

        // นัดสุดท้าย -> ปลด burst
        if (i === count - 1){
          burstInFlight = false;
          logEvent({ kind:'gaze_burst_end', timeLeft: remainingSec, score, misses, comboMax });
        }
      }, i * gap);

      burstTimerIds.push(id);
    }
  }

  function tickGazeLockAndFire(dt){
    if (!gazeEnabled || !CFG.lockOnEnabled) return;
    if (!running) return;

    // ถ้ามี hitstop -> ไม่อัปเดต lock
    if (now() < hitStopUntil) return;

    const fuseMs = effectiveFuseMs();

    // เลือกเป้าใกล้กลางจอที่สุด (aim assist)
    const t = pickNearestToCenter();

    if (!t){
      // ไม่มีเป้า -> เคลียร์ lock
      if (gazeTarget) clearLock(false);
      return;
    }

    // ถ้าเปลี่ยนเป้า -> รีเซ็ตการชาร์จ
    if (gazeTarget !== t){
      gazeTarget = t;
      gazeHoldMs = 0;
      lockProgPrev = -1;
      setLockEl(t.el);

      // event lock เริ่ม
      dispatch('groups:lock', {
        on:true,
        x: t.sx, y: t.sy,
        prog: 0,
        boss: !!t.boss, good: !!t.good,
        fuseMs, burst: effectiveBurstCount()
      });

      // lock sound เล็ก ๆ
      tone(t.boss ? 300 : 420, 0.03, 0.04, 'sine');
      logEvent({ kind:'lock_acquire', emoji: t.emoji, boss: !!t.boss, good: !!t.good, timeLeft: remainingSec });
      return;
    }

    // ชาร์จ
    gazeHoldMs += dt;

    // lock ต้องถือขั้นต่ำก่อนโชว์ progress (กันกระพริบ)
    if (gazeHoldMs >= (CFG.lockOnMinHoldMs|0)){
      const prog = clamp(gazeHoldMs / fuseMs, 0, 1);
      updateLockEvent(t, prog);

      // ใกล้เต็ม -> เพิ่มเสียงติ๊ก
      if (prog > 0.86 && (Math.random() < 0.18)) tone(720,0.02,0.02,'square');
    }

    // ครบ fuse -> ยิง BURST
    if (gazeHoldMs >= fuseMs){
      gazeHoldMs = 0;
      lockProgPrev = -1;

      // “ยิง” จะทำให้เป้าหายเร็ว -> lock beam จะโดน update ผ่าน hit/destroy
      logEvent({ kind:'lock_fire', emoji: t.emoji, boss: !!t.boss, good: !!t.good, fuseMs, timeLeft: remainingSec });
      haptic([10, 20, 10]);
      burstFire();
    }
  }

  function renderLoop(){
    if (!running) return;

    if (now() < hitStopUntil){
      rafId = requestAnimationFrame(renderLoop);
      return;
    }

    const tNow = now();
    const dt = Math.min(80, Math.max(0, tNow - (renderLoop._last || tNow)));
    renderLoop._last = tNow;

    renderTargets();

    // NEW: lock-on + burst fire
    tickGazeLockAndFire(dt);

    rafId = requestAnimationFrame(renderLoop);
  }

  // ---------------- RESET / STOP ----------------
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

    remainingSec = 0;
    panicOn = false;

    rushOn = false;
    rushEndsAt = 0;
    rushCooldownSec = 0;

    CFG.bossWaveEndsAt = 0;

    // NEW: lock/burst reset
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
  }

  // ---------------- PUBLIC API ----------------
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
        CFG.bossWaveEnabled = false;
        gazeEnabled = true; // ให้จ้องได้ แต่ไม่สุ่ม rush/wave
      } else {
        CFG.adaptiveEnabledPlay = true;
        CFG.rushEnabled = true;
        CFG.bossWaveEnabled = true;
        gazeEnabled = true;
      }

      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      coach(g ? `เริ่มเลย! หมู่ปัจจุบัน: ${g.label} ✨` : 'เริ่มเลย! แตะ/จ้องอาหารดีให้ได้เยอะ ๆ ✨');

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
