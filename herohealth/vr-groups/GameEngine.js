// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION SAFE ENGINE (NO-FLASH + HIT 100% + QUEST + FX + FEVER + RANK + ADAPTIVE)
// ✅ PATCH 1: world-anchored / parallax targets ตาม camera + inertia เบา ๆ (optional look controls)
// ✅ PATCH 2: clamp safe zone กันทับ HUD 4 ด้าน (อ่าน avoid rects จาก element จริง)
// ✅ Emoji sticker feel: fade-in / fade-out + “sticker” styling hooks
//
// Size policy:
//   - play: base by diff + adaptive
//   - research: base by diff only (no adaptive)

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
  function lerp(a, b, t){ return a + (b - a) * t; }
  function wrapDeg(d){
    d = Number(d) || 0;
    d = ((d + 180) % 360) - 180;
    return d;
  }

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

  // -------------------------
  // Runtime state
  // -------------------------
  const active = [];
  let layerEl = null;
  let running = false;
  let spawnTimer = null;
  let secondTimer = null;

  // camera/look/parallax
  let camEl = null;

  // PATCH 1: parallax base rotation + smoothed rotation
  let baseRot = { yaw: 0, pitch: 0 };          // baseline at start
  let smoothRot = { yaw: 0, pitch: 0 };        // smoothed current
  let desiredRot = { yaw: 0, pitch: 0 };       // desired from camera or look controls
  let rafId = 0;

  // PATCH 2: safe zone avoid UI rects
  let avoidEls = [];
  let safeRect = null;
  let safeRectAt = 0;

  // optional look controls (drag + deviceorientation + inertia)
  let lookEnabled = false;
  let lookAreaEl = null;
  let dragging = false;
  let dragLastX = 0;
  let dragLastY = 0;
  let velYaw = 0;
  let velPitch = 0;
  let lastMoveAt = 0;

  let devOriEnabled = false;
  let devOriLast = { yaw: 0, pitch: 0, has: false };
  let devOriListener = null;

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

  // “สะใจ” systems
  let remainingSec = 0;
  let panicOn = false;
  let rushOn = false;
  let rushEndsAt = 0;
  let rushCooldownSec = 0;

  // -------------------------
  // Config
  // -------------------------
  const CFG = {
    // spawn
    spawnInterval: 900,
    maxActive: 4,

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
    bossJunkChance: 0.08,        // 8% ของ junk จะเป็น boss
    bossJunkEmoji: ['☠️','🧨','💣','👿'],
    bossJunkPenalty: -18,        // โดนหนัก
    bossJunkShieldCost: 2,       // กันได้แต่กินโล่ 2
    bossJunkScaleMul: 1.28,      // ใหญ่กว่า

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

    // coach hype
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

    // PATCH 1: parallax factors (deg -> px)
    parallaxYawPxPer90w: 0.35,   // x = dy * (w/90)*factor
    parallaxPitchPxPer90h: 0.22, // y = -dp * (h/90)*factor
    parallaxClampPitch: 45,

    // sticker feel
    appearDelayMs: 16,
    fadeOutMs: 180,

    // safe zone padding
    safePad: 12,
    safeMinW: 180,
    safeMinH: 220,

    // optional look controls defaults
    lookSensitivity: 0.25,        // deg per px-ish (we scale)
    lookInertia: 0.92,            // velocity decay
    lookDamp: 0.14,               // smoothing (0..1)
    lookMaxPitch: 55
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
    } else if (diff === 'hard') {
      CFG.spawnInterval = 750;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4600];
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
      CFG.targetSizePx = 122;
    } else {
      CFG.spawnInterval = 900;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
      CFG.targetSizePx = 132;
    }
  }

  // -------------------------
  // PATCH 2: Safe zone (avoid HUD)
  // -------------------------
  function isElUsable(el){
    if (!el) return false;
    try {
      const r = el.getBoundingClientRect();
      if (!r || r.width <= 0 || r.height <= 0) return false;
      // allow even if outside viewport; we just ignore later
      return true;
    } catch {
      return false;
    }
  }

  function getAvoidRects(){
    const rects = [];
    for (const el of avoidEls) {
      if (!isElUsable(el)) continue;
      try {
        const r = el.getBoundingClientRect();
        rects.push({
          left: r.left, top: r.top, right: r.right, bottom: r.bottom,
          width: r.width, height: r.height
        });
      } catch {}
    }
    return rects;
  }

  function computeSafeRect(force=false){
    const t = now();
    if (!force && safeRect && (t - safeRectAt) < 250) return safeRect;

    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    // fallback margins (old behavior)
    const defLeft  = Math.min(170, Math.round(w * 0.16));
    const defRight = defLeft;
    const defTop   = Math.min(240, Math.round(h * 0.24));
    const defBot   = Math.min(180, Math.round(h * 0.20));

    let topBand = 0, botBand = 0, leftBand = 0, rightBand = 0;
    const pad = CFG.safePad | 0;

    const rects = getAvoidRects();
    for (const r of rects) {
      // only consider rects that are actually near edges (to avoid over-excluding)
      const nearTop    = r.top < Math.max(48, h * 0.22);
      const nearBottom = r.bottom > Math.min(h - 48, h * 0.78);
      const nearLeft   = r.left < Math.max(48, w * 0.22);
      const nearRight  = r.right > Math.min(w - 48, w * 0.78);

      if (nearTop)    topBand    = Math.max(topBand, r.bottom);
      if (nearBottom) botBand    = Math.max(botBand, h - r.top);
      if (nearLeft)   leftBand   = Math.max(leftBand, r.right);
      if (nearRight)  rightBand  = Math.max(rightBand, w - r.left);
    }

    const left  = Math.max(defLeft,  Math.round(leftBand + pad));
    const right = w - Math.max(defRight, Math.round(rightBand + pad));
    const top   = Math.max(defTop,   Math.round(topBand + pad));
    const bottom= h - Math.max(defBot, Math.round(botBand + pad));

    // minimum safe size
    let L = left, R = right, T = top, B = bottom;
    if ((R - L) < CFG.safeMinW) {
      const mid = (L + R) / 2;
      L = clamp(mid - CFG.safeMinW/2, 0, w - CFG.safeMinW);
      R = L + CFG.safeMinW;
    }
    if ((B - T) < CFG.safeMinH) {
      const mid = (T + B) / 2;
      T = clamp(mid - CFG.safeMinH/2, 0, h - CFG.safeMinH);
      B = T + CFG.safeMinH;
    }

    safeRect = { left: L, right: R, top: T, bottom: B, w, h };
    safeRectAt = t;
    return safeRect;
  }

  function pickBasePos(){
    const sr = computeSafeRect(true);
    // base in “world space”: normalized [-1..1] within safe rect
    const u = Math.random(); // 0..1
    const v = Math.random(); // 0..1
    // bias slightly away from edges
    const uu = 0.08 + u * 0.84;
    const vv = 0.10 + v * 0.80;

    const x = sr.left + uu * (sr.right - sr.left);
    const y = sr.top  + vv * (sr.bottom - sr.top);

    return {
      // store normalized too (optional future)
      baseX: x,
      baseY: y
    };
  }

  // -------------------------
  // Look / camera rotation
  // -------------------------
  function getCamRot(){
    if (!camEl || !camEl.getAttribute) return { yaw: desiredRot.yaw, pitch: desiredRot.pitch };
    try {
      const r = camEl.getAttribute('rotation') || { x:0, y:0, z:0 };
      return { yaw: Number(r.y)||0, pitch: Number(r.x)||0 };
    } catch {
      return { yaw: desiredRot.yaw, pitch: desiredRot.pitch };
    }
  }

  function setCamRot(yaw, pitch){
    if (!camEl || !camEl.setAttribute) return;
    try {
      camEl.setAttribute('rotation', { x: pitch, y: yaw, z: 0 });
    } catch {}
  }

  // Optional: internal look controls (drag + deviceorientation + inertia)
  function detachLook(){
    if (!lookAreaEl) return;
    try {
      lookAreaEl.removeEventListener('pointerdown', onPointerDown, { passive:false });
      lookAreaEl.removeEventListener('pointermove', onPointerMove, { passive:false });
      lookAreaEl.removeEventListener('pointerup', onPointerUp, { passive:false });
      lookAreaEl.removeEventListener('pointercancel', onPointerUp, { passive:false });
      lookAreaEl.removeEventListener('touchstart', onPointerDown, { passive:false });
      lookAreaEl.removeEventListener('touchmove', onPointerMove, { passive:false });
      lookAreaEl.removeEventListener('touchend', onPointerUp, { passive:false });
    } catch {}
    lookAreaEl = null;

    if (devOriListener) {
      try { window.removeEventListener('deviceorientation', devOriListener); } catch {}
      devOriListener = null;
    }
    devOriEnabled = false;
    dragging = false;
  }

  function enableLook(opts){
    detachLook();
    lookEnabled = true;

    const area = (opts && opts.areaEl) ? opts.areaEl : document.body;
    lookAreaEl = area;

    const sens = (opts && typeof opts.sensitivity === 'number') ? opts.sensitivity : CFG.lookSensitivity;
    const inertia = (opts && typeof opts.inertia === 'number') ? opts.inertia : CFG.lookInertia;
    const maxPitch = (opts && typeof opts.maxPitch === 'number') ? opts.maxPitch : CFG.lookMaxPitch;

    CFG.lookSensitivity = sens;
    CFG.lookInertia = inertia;
    CFG.lookMaxPitch = maxPitch;

    // init desiredRot from camera if present
    const r0 = getCamRot();
    desiredRot.yaw = r0.yaw;
    desiredRot.pitch = r0.pitch;

    // device orientation
    const useDO = !!(opts && opts.useDeviceOrientation);
    if (useDO) {
      devOriEnabled = true;
      devOriListener = (ev) => {
        try {
          // alpha (0..360) ~ yaw, beta (-180..180) ~ pitch
          const a = (typeof ev.alpha === 'number') ? ev.alpha : null;
          const b = (typeof ev.beta === 'number') ? ev.beta : null;
          if (a === null || b === null) return;

          // map: yaw = alpha, pitch = (beta - 60) rough (phone upright)
          const yaw = wrapDeg(a);
          const pitch = clamp((b - 60), -CFG.lookMaxPitch, CFG.lookMaxPitch);

          devOriLast.yaw = yaw;
          devOriLast.pitch = pitch;
          devOriLast.has = true;
        } catch {}
      };
      try { window.addEventListener('deviceorientation', devOriListener, { passive:true }); } catch {}
    } else {
      devOriEnabled = false;
    }

    // attach pointer listeners
    try {
      lookAreaEl.addEventListener('pointerdown', onPointerDown, { passive:false });
      lookAreaEl.addEventListener('pointermove', onPointerMove, { passive:false });
      lookAreaEl.addEventListener('pointerup', onPointerUp, { passive:false });
      lookAreaEl.addEventListener('pointercancel', onPointerUp, { passive:false });

      // fallback touch (บางเครื่อง)
      lookAreaEl.addEventListener('touchstart', onPointerDown, { passive:false });
      lookAreaEl.addEventListener('touchmove', onPointerMove, { passive:false });
      lookAreaEl.addEventListener('touchend', onPointerUp, { passive:false });
    } catch {}
  }

  function disableLook(){
    lookEnabled = false;
    detachLook();
  }

  function onPointerDown(ev){
    try { ev.preventDefault(); } catch {}
    try { ev.stopPropagation(); } catch {}

    dragging = true;
    lastMoveAt = now();

    const p = getEventXY(ev);
    dragLastX = p.x;
    dragLastY = p.y;
    velYaw = 0;
    velPitch = 0;
  }

  function onPointerMove(ev){
    if (!dragging) return;
    try { ev.preventDefault(); } catch {}
    try { ev.stopPropagation(); } catch {}

    const p = getEventXY(ev);
    const dx = (p.x - dragLastX);
    const dy = (p.y - dragLastY);
    dragLastX = p.x;
    dragLastY = p.y;

    // sensitivity scaling: px -> degrees
    const k = CFG.lookSensitivity;
    const yawDelta = dx * k;
    const pitchDelta = dy * k;

    // update desired (drag-to-look)
    desiredRot.yaw = wrapDeg(desiredRot.yaw + yawDelta);
    desiredRot.pitch = clamp(desiredRot.pitch + pitchDelta, -CFG.lookMaxPitch, CFG.lookMaxPitch);

    // velocity for inertia
    velYaw = lerp(velYaw, yawDelta, 0.35);
    velPitch = lerp(velPitch, pitchDelta, 0.35);
    lastMoveAt = now();
  }

  function onPointerUp(ev){
    try { ev.preventDefault(); } catch {}
    try { ev.stopPropagation(); } catch {}
    dragging = false;
  }

  function getEventXY(ev){
    try {
      if (ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
      if (typeof ev.clientX === 'number') return { x: ev.clientX, y: ev.clientY };
    } catch {}
    return { x: window.innerWidth/2, y: window.innerHeight/2 };
  }

  // Parallax + “world anchored” screen projection
  function updateDesiredRot(){
    // If we have a camera element AND look controls are NOT explicitly enabled,
    // prefer camera's rotation (because A-Frame/look-controls or your attachTouchLook will drive it).
    if (camEl && !lookEnabled) {
      const r = getCamRot();
      desiredRot.yaw = r.yaw;
      desiredRot.pitch = r.pitch;
      return;
    }

    // If look controls enabled: apply device orientation when not dragging recently
    if (lookEnabled) {
      const t = now();
      const idle = (!dragging && (t - lastMoveAt) > 90);

      if (devOriEnabled && devOriLast.has && idle) {
        // soft follow device orientation
        desiredRot.yaw = lerp(desiredRot.yaw, devOriLast.yaw, 0.10);
        desiredRot.pitch = lerp(desiredRot.pitch, devOriLast.pitch, 0.10);
      }

      // inertia after drag release
      if (!dragging) {
        velYaw *= CFG.lookInertia;
        velPitch *= CFG.lookInertia;

        if (Math.abs(velYaw) > 0.02 || Math.abs(velPitch) > 0.02) {
          desiredRot.yaw = wrapDeg(desiredRot.yaw + velYaw);
          desiredRot.pitch = clamp(desiredRot.pitch + velPitch, -CFG.lookMaxPitch, CFG.lookMaxPitch);
        } else {
          velYaw = 0; velPitch = 0;
        }
      }

      // if camEl exists, drive camera too
      if (camEl) setCamRot(desiredRot.yaw, desiredRot.pitch);
    }
  }

  function startParallaxLoop(){
    cancelAnimationFrame(rafId);
    // baseline
    const r0 = getCamRot();
    baseRot = { yaw: r0.yaw, pitch: r0.pitch };
    smoothRot = { yaw: r0.yaw, pitch: r0.pitch };
    desiredRot = { yaw: r0.yaw, pitch: r0.pitch };

    const step = () => {
      if (!running) return;

      // update desired rotation source (camera vs look controls)
      updateDesiredRot();

      // smooth rotation
      const damp = clamp(CFG.lookDamp, 0.02, 0.35);
      smoothRot.yaw = wrapDeg(lerp(smoothRot.yaw, desiredRot.yaw, damp));
      smoothRot.pitch = lerp(smoothRot.pitch, desiredRot.pitch, damp);

      // compute parallax offset vs baseline
      const sr = computeSafeRect(false);
      const dy = wrapDeg(smoothRot.yaw - baseRot.yaw);
      const dp = clamp(smoothRot.pitch - baseRot.pitch, -CFG.parallaxClampPitch, CFG.parallaxClampPitch);

      const ox = dy * (sr.w / 90) * CFG.parallaxYawPxPer90w;
      const oy = -dp * (sr.h / 90) * CFG.parallaxPitchPxPer90h;

      // apply to every alive target, clamp within safe rect
      for (const t of active) {
        if (!t || !t.alive || !t.el) continue;
        const x = clamp(t.baseX + ox, sr.left, sr.right);
        const y = clamp(t.baseY + oy, sr.top, sr.bottom);
        t.el.style.left = x + 'px';
        t.el.style.top  = y + 'px';
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
  }

  function stopParallaxLoop(){
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // -------------------------
  // Input / Targets
  // -------------------------
  function bindHit(el, handler) {
    const on = (ev) => {
      try { ev.preventDefault(); } catch {}
      try { ev.stopPropagation(); } catch {}
      handler(ev);
      return false;
    };
    el.addEventListener('pointerdown', on, { passive: false });
    el.addEventListener('touchstart',  on, { passive: false });
    el.addEventListener('mousedown',   on);
    el.addEventListener('click',       on);
  }

  function removeFromActive(t) {
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i, 1);
  }

  function stickerAppear(el){
    if (!el) return;
    // fade-in: start hidden then show
    el.classList.add('fg-sticker');
    el.classList.add('fg-appear');     // optional hook
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%,-50%) scale(0.86)';
    setTimeout(() => {
      try {
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%,-50%) scale(1)';
        el.classList.add('show');
      } catch {}
    }, CFG.appearDelayMs | 0);
  }

  function stickerFadeOut(el){
    if (!el) return;
    try {
      el.classList.add('hit'); // uses your CSS transition scale+opacity
      el.style.opacity = '0';
    } catch {}
  }

  function destroyTarget(t, isHit) {
    if (!t || !t.alive) return;
    if (!isHit && !t.canExpire) return;

    t.alive = false;
    clearTimeout(t.minTimer);
    clearTimeout(t.lifeTimer);

    removeFromActive(t);

    if (t.el) {
      stickerFadeOut(t.el);
      setTimeout(() => { try { t.el && t.el.remove(); } catch {} }, CFG.fadeOutMs | 0);
    }
  }

  // -------------------------
  // Fever
  // -------------------------
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

    coach('🔥 FEVER TIME! แตะรัว ๆ เลยยย!');
    setFeverValue(0);
  }

  function tickFever() {
    if (!feverOn) return;
    if (now() >= feverEndsAt) {
      setFeverActive(false);
      coach('เฟเวอร์หมดแล้ว! ตั้งใจต่อ! ✨');
    }
  }

  // -------------------------
  // Score / Combo / Miss
  // -------------------------
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

  // -------------------------
  // Quest
  // -------------------------
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
      coach('🎯 GOAL ผ่านแล้ว! สุดยอด!');
    }

    const minisCleared = minisAll.filter(x => x && x.done).length;
    if (minisCleared !== miniIndexShown && minisCleared > 0) {
      miniIndexShown = minisCleared;
      dispatch('hha:celebrate', { kind:'mini', type:'mini', index: minisCleared, total: minisAll.length });
      coach('⭐ MINI ผ่าน! เก่งมาก!');
    }

    if (!allClearedShown && goalsCleared === goalsAll.length && minisCleared === minisAll.length) {
      allClearedShown = true;
      dispatch('hha:celebrate', { kind:'all', type:'all' });
      coach('🎉 เคลียร์ทุกภารกิจแล้ววว! ป.5 เทพมาก!');
    }
  }

  function emojiToGroupId(emoji) {
    if (quest && typeof quest.getActiveGroup === 'function') {
      const g = quest.getActiveGroup();
      if (g && Array.isArray(g.emojis) && g.emojis.includes(emoji)) return g.key || 1;
    }
    return 1;
  }

  // -------------------------
  // Adaptive (play only)
  // -------------------------
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

    // base tuning (แล้วค่อยโดน rush/panic ปรับเพิ่มทีหลัง)
    const baseSI = CFG._baseSpawnInterval || CFG.spawnInterval;
    const baseMA = CFG._baseMaxActive || CFG.maxActive;

    const si = clamp(baseSI * (1.0 - (t * 0.12)), 520, 1600);
    const ma = clamp(baseMA + (t > 0.55 ? 1 : 0) + (t > 0.85 ? 1 : 0), 2, 7);

    CFG.spawnInterval = Math.round(si);
    CFG.maxActive = Math.round(ma);

    if (t > 0.65) coach('สปีดเพิ่มแล้วนะ! เก่งขึ้นแล้ว! ⚡');
    else if (t < -0.45) coach('ค่อย ๆ เล็งนะ โค้ชเพิ่มเวลาให้แล้ว ✨');
  }

  // -------------------------
  // Rank
  // -------------------------
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

  // -------------------------
  // PANIC + RUSH
  // -------------------------
  function setPanic(on, secLeft){
    const next = !!on;
    if (panicOn === next) return;
    panicOn = next;
    dispatch('hha:panic', { on: panicOn, secLeft: secLeft|0 });
    if (panicOn) coach('⏰ 10 วิสุดท้าย! เร่งแล้วนะ!!!');
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
    coach('🚀 RUSH! คะแนน x2 แตะให้ไววว!');
  }

  function tickRush(){
    if (!CFG.rushEnabled) return;

    if (rushOn) {
      if (now() >= rushEndsAt) {
        rushOn = false;
        rushEndsAt = 0;
        rushCooldownSec = CFG.rushCooldownAfter | 0;
        dispatch('hha:rush', { on:false, sec: 0 });
        coach('โอเค! จบ RUSH แล้ว ไปต่อ!');
      }
    } else {
      if (rushCooldownSec > 0) rushCooldownSec--;
      tryStartRush();
    }
  }

  function effectiveSpawnInterval(){
    let si = CFG.spawnInterval;
    if (rushOn)  si = Math.round(si * CFG.rushSpawnMul);
    if (panicOn) si = Math.round(si * CFG.panicSpawnMul);
    return clamp(si, 420, 1600);
  }

  function effectiveMaxActive(){
    let ma = CFG.maxActive;
    if (rushOn)  ma += (CFG.rushMaxActiveAdd | 0);
    if (panicOn) ma += (CFG.panicMaxActiveAdd | 0);
    return clamp(ma, 2, 9);
  }

  // -------------------------
  // Targets
  // -------------------------
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
      isBoss = (Math.random() < CFG.bossJunkChance);
      if (isBoss) emoji = CFG.bossJunkEmoji[randInt(0, CFG.bossJunkEmoji.length - 1)];
      else emoji = CFG.emojisJunk[randInt(0, CFG.emojisJunk.length - 1)];
    }

    const el = document.createElement('div');
    el.className = 'fg-target ' + (good ? 'fg-good' : (isBoss ? 'fg-junk fg-boss' : 'fg-junk'));
    el.setAttribute('data-emoji', emoji);

    // sticker hooks (CSS optional)
    el.classList.add('fg-sticker');

    applyTargetSizeToEl(el, isBoss ? CFG.bossJunkScaleMul : 1.0);

    // PATCH 2: pick inside safe rect
    const p = pickBasePos();
    el.style.left = p.baseX + 'px';
    el.style.top  = p.baseY + 'px';

    // appear animation
    stickerAppear(el);

    layerEl.appendChild(el);

    const t = {
      el, good, emoji,
      boss: isBoss,
      alive: true,
      canExpire: false,
      bornAt: now(),
      minTimer: null,
      lifeTimer: null,

      // PATCH 1: store “world anchored” base screen pos (will be parallax-shifted each frame)
      baseX: p.baseX,
      baseY: p.baseY
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

    bindHit(el, () => hitTarget(t));
  }

  function hitTarget(t) {
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

      if (runMode === 'play') {
        skill = clampSkill(skill + (isPerfect ? CFG.skillGainPerfect : CFG.skillGainGood));
      }

      if (CFG.coachHypeEveryCombo && combo > 0 && (combo % CFG.coachHypeEveryCombo === 0)) {
        coach(`คอมโบ ${combo} แล้ว! โคตรเก่ง! 🚀`);
      }

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

        coach(isBoss ? 'บอสมา! กันได้ แต่โล่หาย 2 😱' : 'โล่กันไว้แล้ว! ระวังขยะนะ 🛡️');

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

        coach(isBoss ? '😈 โดนบอส! เจ็บหนัก! เลี่ยงขยะบอส!' : 'โอ๊ะ! โดนขยะแล้ว 😵 เล็งอาหารดีก่อนนะ');

        if (runMode === 'play') {
          skill = clampSkill(skill - CFG.skillLossMiss);
        }
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

    } else {
      junkExpires++;
    }

    dispatch('groups:expire', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y });
    emitQuestUpdate();
    emitRank();
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

      tickFever();
      tickRush();

      if (remainingSec > 0 && remainingSec <= (CFG.panicLastSec | 0)) setPanic(true, remainingSec);
      else setPanic(false, remainingSec);

      if (quest && typeof quest.second === 'function') quest.second();

      updateAdaptiveSoon();

      emitQuestUpdate();
      emitRank();

      // refresh safe rect a bit more often during play (HUD may animate)
      computeSafeRect(false);

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

    // adaptive
    skill = 0;
    sizeMul = 1.0;
    adaptiveTick = 0;
    consecutiveGood = 0;

    // panic/rush
    remainingSec = 0;
    panicOn = false;
    rushOn = false;
    rushEndsAt = 0;
    rushCooldownSec = 0;

    // parallax safe rect
    safeRect = null;
    safeRectAt = 0;
  }

  function stopAll(reason) {
    running = false;
    clearTimeout(spawnTimer); spawnTimer = null;
    clearInterval(secondTimer); secondTimer = null;

    stopParallaxLoop();

    active.slice().forEach(t => destroyTarget(t, true));
    active.length = 0;

    const goalsAll = quest ? (quest.goals || []) : [];
    const minisAll = quest ? (quest.minis || []) : [];
    const goalsCleared = goalsAll.filter(g => g && g.done).length;
    const minisCleared = minisAll.filter(m => m && m.done).length;

    const finalGrade = normalizeGrade(lastGrade || emitRank() || 'C');

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

  // -------------------------
  // PUBLIC API
  // -------------------------
  ns.GameEngine = {
    setLayerEl(el) { layerEl = el; },

    // PATCH 1: camera element (A-Frame camera)
    setCameraEl(el){ camEl = el; },

    // PATCH 2: avoid UI elements (real clamp safe zone)
    // accept: [Element,...] or ['#id','.class',...]
    setAvoidEls(list){
      const out = [];
      if (Array.isArray(list)) {
        for (const it of list) {
          if (!it) continue;
          if (typeof it === 'string') {
            try { const el = document.querySelector(it); if (el) out.push(el); } catch {}
          } else if (it && typeof it.getBoundingClientRect === 'function') {
            out.push(it);
          }
        }
      }
      avoidEls = out;
      computeSafeRect(true);
    },

    // Optional: internal VR-look (drag + deviceorientation + inertia)
    enableLook(opts){ enableLook(opts || {}); },
    disableLook(){ disableLook(); },

    // HTML ส่ง timeLeft เข้ามา เพื่อ PANIC TIME ทำงานเป๊ะ
    setTimeLeft(sec) {
      remainingSec = Math.max(0, sec | 0);
      dispatch('hha:time', { left: remainingSec });
    },

    start(diff = 'normal', opts = {}) {
      layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;
      if (!layerEl) { console.error('[FoodGroupsVR] layerEl missing'); return; }

      // accept camera + avoid in start opts
      if (opts.cameraEl) camEl = opts.cameraEl;
      if (opts.avoidEls) this.setAvoidEls(opts.avoidEls);

      runMode = String((opts && opts.runMode) ? opts.runMode : 'play').toLowerCase();
      if (runMode !== 'research') runMode = 'play';

      if (opts && opts.config) Object.assign(CFG, opts.config);

      applyDifficulty(diff);

      // เก็บ base เพื่อ adaptive ปรับจากฐาน ไม่ทำให้ drift
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

      // research = lock adaptive
      if (runMode === 'research') {
        sizeMul = 1.0;
        CFG.adaptiveEnabledPlay = false;
        CFG.rushEnabled = false; // โหมดวิจัยไม่สุ่ม rush
      } else {
        CFG.adaptiveEnabledPlay = true;
        CFG.rushEnabled = true;
      }

      // Optional: enable built-in look controls via start opts (to replace external attachTouchLook if you want)
      if (opts && opts.look && opts.look.enabled) {
        this.enableLook({
          areaEl: (opts.look.areaEl || document.body),
          sensitivity: (typeof opts.look.sensitivity === 'number' ? opts.look.sensitivity : CFG.lookSensitivity),
          inertia: (typeof opts.look.inertia === 'number' ? opts.look.inertia : CFG.lookInertia),
          maxPitch: (typeof opts.look.maxPitch === 'number' ? opts.look.maxPitch : CFG.lookMaxPitch),
          useDeviceOrientation: !!opts.look.useDeviceOrientation
        });
      }

      // safe rect ready
      computeSafeRect(true);

      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      coach(g ? `เริ่มเลย! หมู่ปัจจุบัน: ${g.label} ✨` : 'เริ่มเลย! แตะอาหารดีให้ได้เยอะ ๆ ✨');

      emitQuestUpdate();
      emitRank();

      running = true;

      // PATCH 1: start parallax loop (world-anchored targets)
      startParallaxLoop();

      startSecondLoop();
      scheduleNextSpawn();

      // เปิดฉากให้สะใจ
      createTarget();
      setTimeout(() => createTarget(), 220);
      setTimeout(() => createTarget(), 420);

      dispatch('hha:score', { score, combo, misses, shield, fever });
    },

    stop(reason) {
      stopAll(reason || 'stop');
    }
  };

})();
