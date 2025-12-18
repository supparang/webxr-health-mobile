// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION SAFE ENGINE (v4)
// ✅ NO-FLASH + HIT 100% (pointer/touch/mouse/click)
// ✅ QUEST + FX + FEVER + SHIELD
// ✅ (1) Boss Rush 10s (play mode only)
// ✅ (2) Multiplier x1–x4 (combo thresholds)
// ✅ (3) Golden Target (good only) + big reward
// ✅ (4) Trap Target (sweet-looking junk) + punish if hit / reward if avoided
// ✅ (5) Streak reward every 5 good hits: +Shield + short slow-time
// ✅ (6) Adaptive (play mode only): size + spawn + junkRatio (research locked)
// ✅ (7) Audio + Haptics + last-10s heartbeat cue (via coach/labels)
//
// API:
//   window.GroupsVR.GameEngine.start(diff, { layerEl?, runMode?, config? })
//   window.GroupsVR.GameEngine.stop(reason?)
//   window.GroupsVR.GameEngine.setLayerEl(el)
//
// Events:
//   - hha:score    { score, combo, misses, shield, fever, multiplier, boss, avoid }
//   - hha:judge    { label, x, y, good, emoji }
//   - quest:update { goal, mini, goalsAll, minisAll, groupLabel }
//   - hha:coach    { text }
//   - hha:celebrate{ type:'goal'|'mini'|'all', index, total, label }
//   - hha:end      { reason, scoreFinal, comboMax, misses, goalsTotal, goalsCleared, miniTotal, miniCleared, avoid }
//
// Miss policy:
//   miss = good expired + junk/trap hit (shield block = NO miss)

(function () {
  'use strict';

  const ns = (window.GroupsVR = window.GroupsVR || {});
  const ROOT = window;

  // ---------- deps (optional) ----------
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

  // ---------- helpers ----------
  function now() { return (performance && performance.now) ? performance.now() : Date.now(); }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }

  function centerXY(el) {
    try {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    } catch {
      return { x: window.innerWidth / 2, y: window.innerHeight * 0.52 };
    }
  }

  function dispatch(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch {}
  }

  function coach(text) {
    if (!text) return;
    dispatch('hha:coach', { text: String(text) });
  }

  // ---------- tiny audio (no external files) ----------
  let __audioCtx = null;
  function beep(freq, durMs, type, gain) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      __audioCtx = __audioCtx || new AC();
      if (__audioCtx.state === 'suspended') { try { __audioCtx.resume(); } catch {} }

      const ctx = __audioCtx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = Math.max(80, Number(freq) || 440);

      const gg = Math.max(0.0001, Math.min(0.25, Number(gain) || 0.06));
      g.gain.setValueAtTime(gg, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (durMs / 1000));

      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + (durMs / 1000) + 0.02);
    } catch {}
  }

  function haptic(ms) {
    try {
      if (navigator && navigator.vibrate) navigator.vibrate(Math.max(0, ms | 0));
    } catch {}
  }

  // ---------- engine state ----------
  const active = [];
  let layerEl = null;
  let running = false;
  let spawnTimer = null;
  let secondTimer = null;

  // gameplay stats
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let avoid = 0;

  // multiplier
  let multiplier = 1;

  // fever / shield
  const FEVER_MAX = 100;
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
  let runMode = 'play';     // 'play' | 'research'
  let diffKey = 'normal';
  let durationSec = 70;
  let gameStartAt = 0;

  // adaptive window
  const perf = {
    events: [], // { t, ok:boolean, kind:'good'|'junk'|'expire-good'|'trap' }
    goodStreak: 0
  };

  // boss rush (play only)
  let bossActive = false;
  let bossEndsAt = 0;
  let nextBossAt = 0;

  // slow-time (reward)
  let slowEndsAt = 0;

  // ---------- config (base) ----------
  const CFG = {
    // spawn
    spawnInterval: 900,
    maxActive: 4,

    // visibility policy
    minVisible: 2000,
    lifeTime: [3800, 5200],

    // ratios (play can adapt)
    goodRatio: 0.72,   // good vs junk (trap separate)
    junkRatio: 0.23,   // derived
    trapRatio: 0.05,   // trap sweet-looking
    goldenRatio: 0.07, // only on good

    // emoji pools
    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚','🍞','🥔','🍊'],
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕'],
    emojisTrap: ['🍭','🍪','🧁','🍬','🍫','🍡'],

    // scoring
    pointsGood: 10,
    pointsGoodFever: 14,
    pointsGolden: 50,
    pointsGoldenFever: 70,
    pointsTrapHit: -16,
    pointsJunkHit: -8,
    pointsGoodExpire: -4,
    pointsTrapAvoid: +6,     // ปล่อยกับดักให้หายเองได้โบนัสเล็ก
    pointsJunkExpire: 0,

    // fever
    feverGainGood: 14,
    feverGainGolden: 26,
    feverLossMiss: 18,
    feverDurationMs: 8000,
    shieldPerFever: 1,

    // streak reward
    streakNeed: 5,
    streakShield: 1,
    slowTimeMs: 1800,

    // multiplier thresholds (combo)
    multi2: 3,
    multi3: 6,
    multi4: 10,

    // target scaling (base by diff)
    baseScaleEasy: 1.08,
    baseScaleNormal: 1.00,
    baseScaleHard: 0.92,

    // adaptive bounds (play)
    adaptScaleMin: 0.78,
    adaptScaleMax: 1.18,
    adaptSpawnMin: 650,
    adaptSpawnMax: 1300,
    adaptJunkMin: 0.18,
    adaptJunkMax: 0.35,

    // boss (play only)
    bossEverySec: 22,     // เริ่มบอสทุก ~22 วิ
    bossDurationMs: 10000,
    bossSpawnMult: 0.60,  // spawn ถี่ขึ้น
    bossScaleDelta: -0.08,
    bossScoreMult: 2.0
  };

  // runtime tuned
  const RT = {
    baseScale: 1.0,
    adaptScale: 1.0,
    currentScale: 1.0,
    currentSpawn: 900,
    currentJunk: 0.23,
    currentTrap: 0.05,
    currentGolden: 0.07
  };

  function applyDifficulty(diff) {
    diff = String(diff || 'normal').toLowerCase();
    diffKey = diff;

    if (diff === 'easy') {
      CFG.spawnInterval = 1200;
      CFG.maxActive = 3;
      CFG.minVisible = 2600;
      CFG.lifeTime = [4800, 6500];
      CFG.feverGainGood = 16;
      CFG.feverLossMiss = 16;
      RT.baseScale = CFG.baseScaleEasy;
    } else if (diff === 'hard') {
      CFG.spawnInterval = 750;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4600];
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
      RT.baseScale = CFG.baseScaleHard;
    } else {
      CFG.spawnInterval = 900;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
      RT.baseScale = CFG.baseScaleNormal;
    }

    RT.currentSpawn = CFG.spawnInterval;
    RT.currentScale = RT.baseScale;
    RT.adaptScale = 1.0;
    RT.currentJunk = CFG.junkRatio;
    RT.currentTrap = CFG.trapRatio;
    RT.currentGolden = CFG.goldenRatio;
  }

  function pickScreenPos() {
    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    const marginX = Math.min(170, Math.round(w * 0.16));
    const marginYTop = Math.min(240, Math.round(h * 0.24));
    const marginYBot = Math.min(180, Math.round(h * 0.20));

    const x = randInt(marginX, w - marginX);
    const y = randInt(marginYTop, h - marginYBot);
    return { x, y };
  }

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

  function destroyTarget(t, isHit) {
    if (!t || !t.alive) return;
    if (!isHit && !t.canExpire) return;

    t.alive = false;
    clearTimeout(t.minTimer);
    clearTimeout(t.lifeTimer);

    removeFromActive(t);

    if (t.el) {
      t.el.classList.add('hit');
      setTimeout(() => {
        if (t.el && t.el.parentNode) t.el.remove();
      }, 180);
    }
  }

  // ---------- score/hud ----------
  function pushScore() {
    dispatch('hha:score', { score, combo, misses, shield, fever, multiplier, boss: bossActive, avoid });
  }

  function setFeverValue(v) {
    fever = clamp(v, 0, FEVER_MAX);
    FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
    FeverUI.setFever && FeverUI.setFever(fever);
    pushScore();
  }

  function setShieldValue(v) {
    shield = Math.max(0, Number(v) || 0);
    FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
    FeverUI.setShield && FeverUI.setShield(shield);
    pushScore();
  }

  function setFeverActive(on) {
    feverOn = !!on;
    FeverUI.setFeverActive && FeverUI.setFeverActive(feverOn);
  }

  function addScore(delta) {
    score = (score + (delta | 0)) | 0;
    pushScore();
  }

  function setCombo(v) {
    combo = Math.max(0, v | 0);
    comboMax = Math.max(comboMax, combo);
    updateMultiplier();
    pushScore();
  }

  function addMiss() {
    misses = (misses + 1) | 0;
    pushScore();
  }

  function updateMultiplier() {
    const c = combo | 0;
    let m = 1;
    if (c >= CFG.multi4) m = 4;
    else if (c >= CFG.multi3) m = 3;
    else if (c >= CFG.multi2) m = 2;
    multiplier = m;
  }

  function scoreMult(v) {
    const bossMul = bossActive ? CFG.bossScoreMult : 1.0;
    return Math.round((v | 0) * multiplier * bossMul);
  }

  // ---------- fever ----------
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
    Particles.scorePop && Particles.scorePop(window.innerWidth / 2, window.innerHeight * 0.52, '🔥', { judgment: 'FEVER', good: true });
    beep(740, 120, 'triangle', 0.08);
    haptic(35);

    setFeverValue(0);
  }

  function tickFever() {
    if (!feverOn) return;
    if (now() >= feverEndsAt) {
      setFeverActive(false);
      coach('Fever หมดแล้ว! รักษาคอมโบนะ ✨');
    }
  }

  // ---------- quests ----------
  function emitQuestUpdate() {
    if (!quest) return;

    const goalsAll = quest.goals || [];
    const minisAll = quest.minis || [];

    const goal = goalsAll.find(g => g && !g.done) || null;
    const mini = minisAll.find(m => m && !m.done) || null;

    const g = (quest.getActiveGroup && quest.getActiveGroup()) ? quest.getActiveGroup() : null;
    dispatch('quest:update', {
      goal: goal ? { label: goal.label, prog: goal.prog, target: goal.target } : null,
      mini: mini ? { label: mini.label, prog: mini.prog, target: mini.target } : null,
      goalsAll,
      minisAll,
      groupLabel: g ? g.label : ''
    });

    const goalsCleared = goalsAll.filter(x => x && x.done).length;
    if (goalsCleared !== goalIndexShown && goalsCleared > 0) {
      goalIndexShown = goalsCleared;
      dispatch('hha:celebrate', { type: 'goal', index: goalsCleared, total: goalsAll.length, label: 'GOAL CLEAR!' });
      beep(660, 90, 'sine', 0.08);
      beep(880, 120, 'sine', 0.09);
      haptic(45);
    }

    const minisCleared = minisAll.filter(x => x && x.done).length;
    if (minisCleared !== miniIndexShown && minisCleared > 0) {
      miniIndexShown = minisCleared;
      dispatch('hha:celebrate', { type: 'mini', index: minisCleared, total: minisAll.length, label: 'MINI CLEAR!' });
      beep(740, 90, 'square', 0.06);
      beep(990, 110, 'square', 0.07);
      haptic(35);
    }

    if (!allClearedShown && goalsCleared === goalsAll.length && minisCleared === minisAll.length) {
      allClearedShown = true;
      dispatch('hha:celebrate', { type: 'all' });
      coach('เคลียร์ทุกภารกิจแล้ว! เก่งมากกก 🎉');
      beep(523, 120, 'triangle', 0.08);
      beep(659, 120, 'triangle', 0.09);
      beep(784, 160, 'triangle', 0.10);
      haptic(70);
    }
  }

  function emojiToGroupId(emoji) {
    if (quest && typeof quest.getActiveGroup === 'function') {
      const g = quest.getActiveGroup();
      if (g && Array.isArray(g.emojis) && g.emojis.includes(emoji)) return g.key || 1;
    }
    return 1;
  }

  // ---------- adaptive (play only) ----------
  function pushPerf(ok, kind) {
    const t = now();
    perf.events.push({ t, ok: !!ok, kind: String(kind || '') });
    while (perf.events.length > 24) perf.events.shift();
  }

  function computeHitRate() {
    const evs = perf.events.slice(-18);
    if (!evs.length) return 0.75;
    let ok = 0;
    for (let i = 0; i < evs.length; i++) if (evs[i].ok) ok++;
    return ok / evs.length;
  }

  function applyAdaptiveIfPlay() {
    if (runMode !== 'play') return;

    const hitRate = computeHitRate(); // 0..1
    // เป้าหมาย: hitRate ~ 0.72–0.85
    // ถ้าเก่งมาก → ยากขึ้น (เล็กลง + spawn ถี่ขึ้น + ขยะมากขึ้น)
    // ถ้าอ่อน → ง่ายขึ้น (ใหญ่ขึ้น + spawn ช้าลง + ขยะน้อยลง)
    let skill = 0.0;
    if (hitRate >= 0.88) skill = +1.0;
    else if (hitRate >= 0.82) skill = +0.6;
    else if (hitRate >= 0.74) skill = +0.25;
    else if (hitRate >= 0.66) skill = -0.15;
    else if (hitRate >= 0.58) skill = -0.35;
    else skill = -0.6;

    // scale adjust
    const scale = clamp(
      RT.baseScale * (1.0 - 0.14 * skill),  // skill + => เล็กลง
      CFG.adaptScaleMin,
      CFG.adaptScaleMax
    );

    // spawn adjust
    const base = CFG.spawnInterval;
    const spawn = clamp(
      base * (1.0 - 0.22 * skill),          // skill + => ถี่ขึ้น
      CFG.adaptSpawnMin,
      CFG.adaptSpawnMax
    );

    // junk ratio adjust
    const junk = clamp(
      0.23 + 0.08 * skill,                  // skill + => ขยะมากขึ้น
      CFG.adaptJunkMin,
      CFG.adaptJunkMax
    );

    RT.currentScale = scale;
    RT.currentSpawn = spawn;
    RT.currentJunk = junk;

    // trap/golden คงไว้เพื่อความรู้สึกเกม (แต่ไม่แรงเกิน)
    RT.currentTrap = CFG.trapRatio;
    RT.currentGolden = CFG.goldenRatio;
  }

  // ---------- boss (play only) ----------
  function startBoss() {
    if (runMode !== 'play') return;
    if (bossActive) return;

    bossActive = true;
    bossEndsAt = now() + CFG.bossDurationMs;

    dispatch('hha:judge', { label: 'BOSS', x: window.innerWidth/2, y: window.innerHeight*0.30, good: true });
    Particles.scorePop && Particles.scorePop(window.innerWidth/2, window.innerHeight*0.30, '⚡', { judgment: 'BOSS', good: true });
    coach('บอสมาแล้วว! 10 วิทองคำ! คะแนนคูณ + เป้าถี่ขึ้น 🔥');
    beep(220, 120, 'sawtooth', 0.08);
    beep(330, 120, 'sawtooth', 0.08);
    haptic(60);

    // แก้ spawn loop ให้ถี่ขึ้นทันที
    scheduleNextSpawn(true);
  }

  function tickBoss() {
    if (runMode !== 'play') return;

    const t = now();
    if (!bossActive && t >= nextBossAt) startBoss();

    if (bossActive && t >= bossEndsAt) {
      bossActive = false;
      coach('บอสหมดเวลา! กลับสู่โหมดปกติ ✨');
      beep(440, 90, 'sine', 0.06);
      scheduleNextSpawn(true);
      // ตั้งบอสครั้งต่อไป
      nextBossAt = t + (CFG.bossEverySec * 1000);
    }
  }

  // ---------- slow-time reward ----------
  function triggerSlowTime() {
    slowEndsAt = now() + CFG.slowTimeMs;
    dispatch('hha:judge', { label: 'SLOW', x: window.innerWidth/2, y: window.innerHeight*0.40, good: true });
    Particles.scorePop && Particles.scorePop(window.innerWidth/2, window.innerHeight*0.40, '⏳', { judgment: 'SLOW', good: true });
    beep(520, 70, 'triangle', 0.06);
    haptic(25);
  }

  function isSlow() {
    return now() < slowEndsAt;
  }

  // ---------- target creation ----------
  function decideKind() {
    // research: no golden/trap/boss variance (ล็อกความเที่ยง)
    if (runMode === 'research') {
      const good = Math.random() < 0.75;
      return { kind: good ? 'good' : 'junk' };
    }

    // play: trap separate
    const r = Math.random();
    if (r < RT.currentTrap) return { kind: 'trap' };
    const junkP = RT.currentJunk;
    if (r < (RT.currentTrap + junkP)) return { kind: 'junk' };
    // else good
    // golden only on good
    const golden = Math.random() < RT.currentGolden;
    return { kind: golden ? 'golden' : 'good' };
  }

  function pickEmoji(kind) {
    const g = (quest && quest.getActiveGroup) ? quest.getActiveGroup() : null;

    if (kind === 'good' || kind === 'golden') {
      if (g && Array.isArray(g.emojis) && g.emojis.length) {
        return g.emojis[randInt(0, g.emojis.length - 1)];
      }
      return CFG.emojisGood[randInt(0, CFG.emojisGood.length - 1)];
    }
    if (kind === 'trap') {
      return CFG.emojisTrap[randInt(0, CFG.emojisTrap.length - 1)];
    }
    return CFG.emojisJunk[randInt(0, CFG.emojisJunk.length - 1)];
  }

  function currentTargetScale() {
    // research: fixed by diff
    let s = RT.baseScale;

    // play: adaptive
    if (runMode === 'play') s = RT.currentScale;

    // boss delta (play)
    if (bossActive) s = s + CFG.bossScaleDelta;

    // clamp
    return clamp(s, 0.70, 1.22);
  }

  function applyScaleToEl(el) {
    if (!el) return;
    const s = currentTargetScale();
    // ใช้ css var เพื่อให้ transition ลื่น (CSS จะใช้ transform: translate(-50%,-50%) scale(var(--fg-scale,1)))
    el.style.setProperty('--fg-scale', String(s.toFixed(3)));
  }

  function createTarget() {
    if (!running || !layerEl) return;
    if (active.length >= CFG.maxActive) return;

    // adaptive update (play)
    applyAdaptiveIfPlay();

    const { kind } = decideKind();
    const emoji = pickEmoji(kind);

    const el = document.createElement('div');
    el.className = 'fg-target';

    // class
    if (kind === 'good') el.classList.add('fg-good');
    else if (kind === 'golden') el.classList.add('fg-good', 'fg-golden');
    else if (kind === 'trap') el.classList.add('fg-trap');
    else el.classList.add('fg-junk');

    el.setAttribute('data-emoji', emoji);

    const p = pickScreenPos();
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    applyScaleToEl(el);

    layerEl.appendChild(el);

    const t = {
      el,
      kind,           // 'good'|'golden'|'junk'|'trap'
      emoji,
      alive: true,
      canExpire: false,
      bornAt: now(),
      minTimer: null,
      lifeTimer: null
    };
    active.push(t);

    // MIN VISIBLE LOCK
    t.minTimer = setTimeout(() => { t.canExpire = true; }, CFG.minVisible);

    // LIFE
    const life = randInt(CFG.lifeTime[0], CFG.lifeTime[1]);
    t.lifeTimer = setTimeout(() => {
      if (!t.canExpire) {
        const wait = Math.max(0, CFG.minVisible - (now() - t.bornAt));
        setTimeout(() => expireTarget(t), wait);
      } else {
        expireTarget(t);
      }
    }, life);

    // HIT
    bindHit(el, () => hitTarget(t));
  }

  // ---------- hit/expire logic ----------
  function rewardStreakIfNeeded() {
    if (runMode !== 'play') return;
    if (perf.goodStreak > 0 && (perf.goodStreak % CFG.streakNeed) === 0) {
      setShieldValue(shield + CFG.streakShield);
      dispatch('hha:judge', { label: 'STREAK', x: window.innerWidth/2, y: window.innerHeight*0.60, good: true });
      Particles.scorePop && Particles.scorePop(window.innerWidth/2, window.innerHeight*0.60, '🛡️+1', { judgment: 'STREAK', good: true });
      coach('คอมโบสวย! ได้โล่เพิ่ม + ชะลอเวลา! 🛡️⏳');
      triggerSlowTime();
      beep(880, 80, 'square', 0.07);
      haptic(45);
    }
  }

  function hitTarget(t) {
    if (!running || !t || !t.alive) return;

    const pos = centerXY(t.el);
    destroyTarget(t, true);

    const isGood = (t.kind === 'good' || t.kind === 'golden');
    const isGolden = (t.kind === 'golden');
    const isTrap = (t.kind === 'trap');
    const isJunk = (t.kind === 'junk' || isTrap);

    if (isGood) {
      // good/golden hit
      const basePts = isGolden
        ? (feverOn ? CFG.pointsGoldenFever : CFG.pointsGolden)
        : (feverOn ? CFG.pointsGoodFever : CFG.pointsGood);

      const pts = scoreMult(basePts);
      addScore(pts);
      setCombo(combo + 1);

      // fever gain
      const fg = isGolden ? CFG.feverGainGolden : CFG.feverGainGood;
      setFeverValue(fever + fg);
      maybeEnterFever();

      // quest update
      if (quest && typeof quest.onGoodHit === 'function') {
        const gid = emojiToGroupId(t.emoji);
        quest.onGoodHit(gid, combo);
      }

      // perf
      perf.goodStreak += 1;
      pushPerf(true, isGolden ? 'golden' : 'good');
      rewardStreakIfNeeded();

      // feedback
      const label = isGolden ? 'GOLD' : (feverOn ? 'PERFECT' : 'GOOD');
      dispatch('hha:judge', { label, x: pos.x, y: pos.y, good: true, emoji: t.emoji });

      Particles.scorePop && Particles.scorePop(
        pos.x, pos.y,
        '+' + pts,
        { judgment: label, good: true }
      );

      if (isGolden) {
        coach('โกลเด้น! โบนัสก้อนโต ✨✨');
        beep(988, 90, 'triangle', 0.10);
        beep(1318, 120, 'triangle', 0.10);
        haptic(30);
      } else {
        beep(660, 55, 'sine', 0.05);
        haptic(12);
      }

    } else if (isJunk) {
      // junk/trap hit
      // shield blocks miss
      if (shield > 0) {
        setShieldValue(shield - 1);
        dispatch('hha:judge', { label: 'BLOCK', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment: 'BLOCK', good: true });
        coach('โล่กันไว้แล้ว! ระวังขยะนะ 🛡️');
        beep(220, 70, 'square', 0.04);
        haptic(20);
        // perf: still ok-ish
        pushPerf(true, 'block');
        // ไม่ตัดคอมโบ
      } else {
        // miss
        addMiss();
        const basePenalty = isTrap ? CFG.pointsTrapHit : CFG.pointsJunkHit;
        addScore(scoreMult(basePenalty));
        setCombo(0);

        setFeverValue(fever - CFG.feverLossMiss);

        // quest update
        if (quest && typeof quest.onJunkHit === 'function') {
          const gid = emojiToGroupId(t.emoji);
          quest.onJunkHit(gid);
        }

        perf.goodStreak = 0;
        pushPerf(false, isTrap ? 'trap' : 'junk');

        const label = isTrap ? 'TRAP' : 'MISS';
        dispatch('hha:judge', { label, x: pos.x, y: pos.y, good: false, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(basePenalty), { judgment: label, good: false });

        if (isTrap) {
          coach('กับดักหวาน ๆ! อย่าเผลอนะ 😈');
          beep(140, 120, 'sawtooth', 0.08);
          haptic(40);
        } else {
          coach('โอ๊ะ! โดนขยะแล้ว 😵 เล็งอาหารดีก่อนนะ');
          beep(160, 110, 'square', 0.06);
          haptic(35);
        }
      }
    }

    // log-friendly
    dispatch('groups:hit', { emoji: t.emoji, good: isGood, kind: t.kind, x: pos.x, y: pos.y });

    emitQuestUpdate();
  }

  function expireTarget(t) {
    if (!running || !t || !t.alive) return;
    if (!t.canExpire) return;

    const pos = centerXY(t.el);
    destroyTarget(t, false);

    const isGood = (t.kind === 'good' || t.kind === 'golden');
    const isTrap = (t.kind === 'trap');

    if (isGood) {
      // good expired => miss
      addMiss();
      addScore(scoreMult(CFG.pointsGoodExpire));
      setCombo(0);
      setFeverValue(fever - CFG.feverLossMiss);

      perf.goodStreak = 0;
      pushPerf(false, 'expire-good');

      dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsGoodExpire), { judgment: 'MISS', good: false });
      beep(170, 90, 'square', 0.05);

    } else if (isTrap) {
      // trap expired => avoided bonus (play only)
      if (runMode === 'play') {
        avoid = (avoid + 1) | 0;
        const pts = scoreMult(CFG.pointsTrapAvoid);
        addScore(pts);
        dispatch('hha:judge', { label: 'AVOID', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: 'AVOID', good: true });
        beep(520, 70, 'sine', 0.05);
        haptic(12);
        pushPerf(true, 'avoid');
      } else {
        // research: no bonus
        pushPerf(true, 'trap-expire');
      }

    } else {
      // junk expired: no miss
      addScore(scoreMult(CFG.pointsJunkExpire));
      pushPerf(true, 'junk-expire');
    }

    dispatch('groups:expire', { emoji: t.emoji, good: isGood, kind: t.kind, x: pos.x, y: pos.y });

    emitQuestUpdate();
  }

  // ---------- spawn loop ----------
  function effectiveSpawnInterval() {
    let s = RT.currentSpawn || CFG.spawnInterval;

    // boss rush (play only)
    if (bossActive) s = s * CFG.bossSpawnMult;

    // slow-time reward
    if (isSlow()) s = s * 1.35;

    // clamp
    return clamp(s, 520, 1500);
  }

  function scheduleNextSpawn(force) {
    if (!running) return;
    if (force) { clearTimeout(spawnTimer); spawnTimer = null; }

    clearTimeout(spawnTimer);
    const wait = effectiveSpawnInterval();
    spawnTimer = setTimeout(() => {
      createTarget();
      scheduleNextSpawn(false);
    }, wait);
  }

  function startSecondLoop() {
    clearInterval(secondTimer);
    secondTimer = setInterval(() => {
      if (!running) return;

      tickFever();
      tickBoss();

      // quest tick
      if (quest && typeof quest.second === 'function') {
        quest.second();
      }

      // adaptive tick
      applyAdaptiveIfPlay();

      emitQuestUpdate();
      pushScore();
    }, 1000);
  }

  function resetState() {
    active.slice().forEach(t => destroyTarget(t, true));
    active.length = 0;

    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    avoid = 0;

    multiplier = 1;

    fever = 0;
    feverOn = false;
    feverEndsAt = 0;
    shield = 0;

    perf.events = [];
    perf.goodStreak = 0;

    bossActive = false;
    bossEndsAt = 0;
    nextBossAt = 0;
    slowEndsAt = 0;

    goalIndexShown = -1;
    miniIndexShown = -1;
    allClearedShown = false;
  }

  function stopAll(reason) {
    running = false;
    clearTimeout(spawnTimer);
    spawnTimer = null;
    clearInterval(secondTimer);
    secondTimer = null;

    active.slice().forEach(t => destroyTarget(t, true));
    active.length = 0;

    const goalsAll = quest ? (quest.goals || []) : [];
    const minisAll = quest ? (quest.minis || []) : [];
    const goalsCleared = goalsAll.filter(g => g && g.done).length;
    const minisCleared = minisAll.filter(m => m && m.done).length;

    dispatch('hha:end', {
      reason: reason || 'stop',
      scoreFinal: score,
      comboMax,
      misses,
      goalsTotal: goalsAll.length,
      goalsCleared,
      miniTotal: minisAll.length,
      miniCleared: minisCleared,
      avoid
    });
  }

  // ---------- PUBLIC API ----------
  ns.GameEngine = {
    setLayerEl(el) { layerEl = el; },

    start(diff = 'normal', opts = {}) {
      layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;
      if (!layerEl) {
        console.error('[FoodGroupsVR] layerEl missing');
        return;
      }

      // runMode
      runMode = String((opts && opts.runMode) || 'play').toLowerCase();
      if (runMode !== 'research') runMode = 'play';

      // optional override
      if (opts && opts.config) Object.assign(CFG, opts.config);

      // optional duration (for boss schedule + last 10s cue)
      durationSec = Math.max(20, Math.min(180, Number(opts.durationSec) || durationSec));

      applyDifficulty(diff);
      resetState();

      // fever HUD init
      FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
      FeverUI.setFever && FeverUI.setFever(0);
      FeverUI.setFeverActive && FeverUI.setFeverActive(false);
      FeverUI.setShield && FeverUI.setShield(0);

      // quest init
      if (QuestFactory && typeof QuestFactory.createFoodGroupsQuest === 'function') {
        quest = QuestFactory.createFoodGroupsQuest(diff);
      } else {
        quest = null;
        console.warn('[FoodGroupsVR] quest-manager not found: window.GroupsQuest.createFoodGroupsQuest');
      }

      // boss schedule (play only)
      gameStartAt = now();
      if (runMode === 'play') {
        nextBossAt = gameStartAt + (CFG.bossEverySec * 1000);
      }

      // first coach
      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      if (runMode === 'research') {
        coach(g ? `โหมดวิจัย: เริ่มเก็บ ${g.label} ตามภารกิจ ✍️` : 'โหมดวิจัย: เริ่มทำภารกิจ ✍️');
      } else {
        coach(g ? `เริ่มเลย! เก็บอาหารดี: ${g.label} ✨ (มีบอสเป็นช่วง ๆ!)` : 'เริ่มเลย! แตะอาหารดีให้ได้เยอะ ๆ ✨');
      }

      emitQuestUpdate();

      running = true;
      startSecondLoop();

      // spawn start
      createTarget();
      setTimeout(() => createTarget(), 220);

      pushScore();
    },

    stop(reason) {
      stopAll(reason || 'stop');
    }
  };

})();
