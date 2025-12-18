// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION SAFE ENGINE (NO-FLASH + HIT 100% + QUEST + FX + FEVER)
// ✅ Size policy (ตามที่บอสสั่ง):
//    - run=play:  เริ่มขนาดตาม diff (easy/normal/hard) + ADAPTIVE ตามความสามารถ
//    - run=research: ล็อกขนาดตาม diff เท่านั้น (NO adaptive)
// DOM target layer (ไม่ใช่ A-Frame target) — เล่นได้ทั้งมือถือ/PC
//
// API:
//   window.GroupsVR.GameEngine.start(diff, { layerEl?, runMode?, config? })
//   window.GroupsVR.GameEngine.stop(reason?)
//   window.GroupsVR.GameEngine.setLayerEl(el)
//
// Events:
//   - hha:score   { score, combo, misses, shield, fever }
//   - hha:judge   { label, x, y, good, emoji }
//   - quest:update{ goal, mini, goalsAll, minisAll }
//   - hha:coach   { text }
//   - hha:celebrate { type:'goal'|'mini'|'all', index, total, label }
//   - hha:end     { reason, scoreFinal, comboMax, misses, goalsTotal, goalsCleared, miniTotal, miniCleared }
//
// Miss policy:
//   miss = good expired + junk hit (shield block = NO miss)

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
  let runMode = 'play'; // 'play' | 'research'

  // size/adaptive state
  let baseScale = 1.0;     // ตาม diff
  let targetScale = 1.0;   // ใช้ลื่น ๆ (lerp)
  let currentScale = 1.0;
  let adaptiveT = 0;       // 0..1
  let emaHit = 0.65;       // ความแม่นโดยประมาณ
  let emaSpeed = 0.55;     // ความเร็ว (ตีถี่)
  let lastHitAt = 0;

  // ---------- config ----------
  const CFG = {
    // spawn (base)
    spawnInterval: 900,
    maxActive: 4,

    // visibility policy
    minVisible: 2000,
    lifeTime: [3800, 5200],

    // emoji pools
    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚','🍞','🥔','🍊'],
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕'],

    // scoring
    pointsGood: 10,
    pointsGoodFever: 14,
    pointsJunkHit: -8,
    pointsGoodExpire: -4,
    pointsJunkExpire: 0,

    // fever
    feverGainGood: 14,
    feverLossMiss: 18,
    feverDurationMs: 8000,
    shieldPerFever: 1,

    // ===== Size policy =====
    // base size per diff (เริ่มต้น)
    baseScaleEasy: 1.18,
    baseScaleNormal: 1.00,
    baseScaleHard: 0.88,

    // adaptive envelope (ใช้เฉพาะ play)
    adaptiveMinDelta: -0.16, // เล็กลงสุดจาก base
    adaptiveMaxDelta: +0.18, // ใหญ่ขึ้นสุดจาก base
    scaleLerp: 0.14,         // ความลื่นของการเปลี่ยนขนาด

    // adaptive triggers
    comboForHarder: 10,      // คอมโบสูง → ยากขึ้น
    missForEasier: 4,        // miss เยอะ → ง่ายขึ้น
    adaptStepUp: 0.08,       // เพิ่มความยากต่อรอบประเมิน
    adaptStepDown: 0.10,     // ลดความยากต่อรอบประเมิน

    // spawn adaptive (play only)
    spawnMin: 620,
    spawnMax: 1350,
    spawnAdaptStrength: 0.18 // 0..1
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
      baseScale = CFG.baseScaleEasy;
    } else if (diff === 'hard') {
      CFG.spawnInterval = 750;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4600];
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
      baseScale = CFG.baseScaleHard;
    } else {
      CFG.spawnInterval = 900;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
      baseScale = CFG.baseScaleNormal;
    }

    // init scale
    adaptiveT = 0;
    targetScale = baseScale;
    currentScale = baseScale;
    applyLayerScale(currentScale);
  }

  function applyLayerScale(scale) {
    if (!layerEl) return;
    const s = clamp(scale, 0.72, 1.38);
    layerEl.style.setProperty('--fg-scale', String(s));
  }

  function evalAdaptiveTick() {
    // โหมดวิจัย: ล็อก 100%
    if (runMode === 'research') {
      targetScale = baseScale;
      applyLayerScale(baseScale);
      return;
    }

    // โหมดเล่น: ปรับตามความสามารถแบบ “เด็ก ป.5 สนุก”
    // ใช้สัญญาณง่าย ๆ: คอมโบ, miss, ความถี่การตี
    const comboNow = combo | 0;
    const missNow = misses | 0;

    // ปรับความยาก (adaptiveT 0..1)
    if (comboNow >= CFG.comboForHarder) adaptiveT += CFG.adaptStepUp;
    if (missNow >= CFG.missForEasier)  adaptiveT -= CFG.adaptStepDown;

    // ใช้ EMA ความเร็วตีช่วยเสริม
    // emaSpeed สูง → ยากขึ้นเล็กน้อย, ต่ำมาก → ง่ายลงเล็กน้อย
    adaptiveT += (emaSpeed - 0.55) * 0.10;

    adaptiveT = clamp(adaptiveT, 0, 1);

    // แปลงเป็น scale delta: เก่งขึ้น → เล็กลง (negative)
    const delta = (CFG.adaptiveMaxDelta) * (1 - adaptiveT) + (CFG.adaptiveMinDelta) * (adaptiveT);
    // delta: adaptiveT=0 → +max (ง่ายขึ้น), adaptiveT=1 → -min (ยากขึ้น)
    targetScale = clamp(baseScale + delta, 0.72, 1.38);
  }

  function adaptiveSpawnInterval() {
    // โหมดวิจัย: ล็อก spawn ตาม diff
    if (runMode === 'research') return CFG.spawnInterval;

    // โหมดเล่น: เก่งขึ้น → spawn เร็วขึ้นนิด
    const t = clamp(adaptiveT, 0, 1);
    const base = CFG.spawnInterval;
    const towardFast = clamp(base * (1 - CFG.spawnAdaptStrength), CFG.spawnMin, CFG.spawnMax);
    const towardSlow = clamp(base * (1 + CFG.spawnAdaptStrength), CFG.spawnMin, CFG.spawnMax);

    // t=1 (เก่ง) → towardFast, t=0 (ยังไม่เก่ง) → towardSlow
    const v = towardSlow + (towardFast - towardSlow) * t;
    return clamp(v, CFG.spawnMin, CFG.spawnMax);
  }

  function smoothScaleStep() {
    // current → target
    currentScale = currentScale + (targetScale - currentScale) * CFG.scaleLerp;
    applyLayerScale(currentScale);
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

    setFeverValue(0);
  }

  function tickFever() {
    if (!feverOn) return;
    if (now() >= feverEndsAt) {
      setFeverActive(false);
    }
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

  function emitQuestUpdate() {
    if (!quest) return;

    const goalsAll = quest.goals || [];
    const minisAll = quest.minis || [];

    const goal = goalsAll.find(g => g && !g.done) || null;
    const mini = minisAll.find(m => m && !m.done) || null;

    dispatch('quest:update', {
      goal: goal ? { label: goal.label, prog: goal.prog, target: goal.target } : null,
      mini: mini ? { label: mini.label, prog: mini.prog, target: mini.target } : null,
      goalsAll,
      minisAll,
      groupLabel: (quest.getActiveGroup && quest.getActiveGroup()) ? (quest.getActiveGroup().label || '') : ''
    });

    const goalsCleared = goalsAll.filter(g => g && g.done).length;
    if (goalsCleared !== goalIndexShown && goalsCleared > 0) {
      goalIndexShown = goalsCleared;
      dispatch('hha:celebrate', {
        type: 'goal',
        index: goalsCleared,
        total: goalsAll.length,
        label: 'GOAL CLEAR!'
      });
    }

    const minisCleared = minisAll.filter(m => m && m.done).length;
    if (minisCleared !== miniIndexShown && minisCleared > 0) {
      miniIndexShown = minisCleared;
      dispatch('hha:celebrate', {
        type: 'mini',
        index: minisCleared,
        total: minisAll.length,
        label: 'MINI CLEAR!'
      });
    }

    if (!allClearedShown && goalsCleared === goalsAll.length && minisCleared === minisAll.length) {
      allClearedShown = true;
      dispatch('hha:celebrate', { type: 'all' });
      coach('เคลียร์ทุกภารกิจแล้ว! เก่งมากกก 🎉');
    }
  }

  function emojiToGroupId(emoji) {
    if (quest && typeof quest.getActiveGroup === 'function') {
      const g = quest.getActiveGroup();
      if (g && Array.isArray(g.emojis) && g.emojis.includes(emoji)) return g.key || 1;
    }
    return 1;
  }

  function createTarget() {
    if (!running || !layerEl) return;
    if (active.length >= CFG.maxActive) return;

    const g = (quest && quest.getActiveGroup) ? quest.getActiveGroup() : null;

    const good = Math.random() < 0.75;
    let emoji = '';
    if (good) {
      if (g && Array.isArray(g.emojis) && g.emojis.length) {
        emoji = g.emojis[randInt(0, g.emojis.length - 1)];
      } else {
        emoji = CFG.emojisGood[randInt(0, CFG.emojisGood.length - 1)];
      }
    } else {
      emoji = CFG.emojisJunk[randInt(0, CFG.emojisJunk.length - 1)];
    }

    const el = document.createElement('div');
    el.className = 'fg-target ' + (good ? 'fg-good' : 'fg-junk');
    el.setAttribute('data-emoji', emoji);

    const p = pickScreenPos();
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';

    layerEl.appendChild(el);

    const t = {
      el,
      good,
      emoji,
      alive: true,
      canExpire: false,
      bornAt: now(),
      minTimer: null,
      lifeTimer: null
    };
    active.push(t);

    t.minTimer = setTimeout(() => { t.canExpire = true; }, CFG.minVisible);

    const life = randInt(CFG.lifeTime[0], CFG.lifeTime[1]);
    t.lifeTimer = setTimeout(() => {
      if (!t.canExpire) {
        const wait = Math.max(0, CFG.minVisible - (now() - t.bornAt));
        setTimeout(() => expireTarget(t), wait);
      } else {
        expireTarget(t);
      }
    }, life);

    bindHit(el, () => hitTarget(t));
  }

  function updateEMAs(isHitGood) {
    // emaHit: ตีของดี = 1, พลาด/โดนขยะ = 0
    const x = isHitGood ? 1 : 0;
    emaHit = emaHit * 0.86 + x * 0.14;

    const t = now();
    if (lastHitAt > 0) {
      const dt = clamp((t - lastHitAt) / 1000, 0.1, 3.0); // sec
      const speed = clamp(1.0 / dt, 0.2, 6.0); // hits/sec
      const norm = clamp(speed / 3.0, 0, 1);
      emaSpeed = emaSpeed * 0.85 + norm * 0.15;
    }
    lastHitAt = t;
  }

  function hitTarget(t) {
    if (!running || !t || !t.alive) return;

    const pos = centerXY(t.el);

    if (t.good) {
      destroyTarget(t, true);

      const pts = feverOn ? CFG.pointsGoodFever : CFG.pointsGood;
      addScore(pts);
      setCombo(combo + 1);

      setFeverValue(fever + CFG.feverGainGood);
      maybeEnterFever();

      if (quest && typeof quest.onGoodHit === 'function') {
        const gid = emojiToGroupId(t.emoji);
        quest.onGoodHit(gid, combo);
      }

      updateEMAs(true);

      dispatch('hha:judge', { label: feverOn ? 'PERFECT' : 'GOOD', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: feverOn ? 'PERFECT' : 'GOOD', good: true });

    } else {
      destroyTarget(t, true);

      if (shield > 0) {
        setShieldValue(shield - 1);
        dispatch('hha:judge', { label: 'BLOCK', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment: 'BLOCK', good: true });
        coach('โล่กันไว้แล้ว! ระวังขยะนะ 🛡️');
        updateEMAs(false);
      } else {
        addMiss();
        addScore(CFG.pointsJunkHit);
        setCombo(0);

        setFeverValue(fever - CFG.feverLossMiss);

        if (quest && typeof quest.onJunkHit === 'function') {
          const gid = emojiToGroupId(t.emoji);
          quest.onJunkHit(gid);
        }

        updateEMAs(false);

        dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsJunkHit), { judgment: 'MISS', good: false });
        coach('โอ๊ะ! โดนขยะแล้ว 😵 เล็งอาหารดีก่อนนะ');
      }
    }

    dispatch('groups:hit', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y });

    emitQuestUpdate();
  }

  function expireTarget(t) {
    if (!running || !t || !t.alive) return;
    if (!t.canExpire) return;

    const pos = centerXY(t.el);
    destroyTarget(t, false);

    if (t.good) {
      addMiss();
      addScore(CFG.pointsGoodExpire);
      setCombo(0);
      setFeverValue(fever - CFG.feverLossMiss);

      updateEMAs(false);

      dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsGoodExpire), { judgment: 'MISS', good: false });
    } else {
      addScore(CFG.pointsJunkExpire);
    }

    dispatch('groups:expire', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y });

    emitQuestUpdate();
  }

  function scheduleNextSpawn() {
    if (!running) return;
    clearTimeout(spawnTimer);

    const interval = adaptiveSpawnInterval();
    spawnTimer = setTimeout(() => {
      createTarget();
      scheduleNextSpawn();
    }, interval);
  }

  function startSecondLoop() {
    clearInterval(secondTimer);
    secondTimer = setInterval(() => {
      if (!running) return;

      tickFever();

      if (quest && typeof quest.second === 'function') quest.second();

      // ===== adaptive sizing step =====
      evalAdaptiveTick();
      smoothScaleStep();

      emitQuestUpdate();
    }, 1000);
  }

  function resetState() {
    active.slice().forEach(t => destroyTarget(t, true));
    active.length = 0;

    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;

    fever = 0;
    feverOn = false;
    feverEndsAt = 0;
    shield = 0;

    goalIndexShown = -1;
    miniIndexShown = -1;
    allClearedShown = false;

    emaHit = 0.65;
    emaSpeed = 0.55;
    lastHitAt = 0;

    adaptiveT = 0;
    targetScale = baseScale;
    currentScale = baseScale;
    applyLayerScale(baseScale);
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
      miniCleared: minisCleared
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

      // run mode
      runMode = String((opts && opts.runMode) ? opts.runMode : 'play').toLowerCase();
      if (runMode !== 'research') runMode = 'play';

      // optional override
      if (opts && opts.config) Object.assign(CFG, opts.config);

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

      // first coach
      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      if (runMode === 'research') {
        coach(g ? `โหมดวิจัย: เริ่มที่ ${g.label} (ขนาดล็อกตามระดับ) 📋` : 'โหมดวิจัย: เริ่มเลย (ขนาดล็อกตามระดับ) 📋');
      } else {
        coach(g ? `โหมดเล่น: เริ่มที่ ${g.label} (จะปรับความยากอัตโนมัติ) 🔥` : 'โหมดเล่น: จะปรับความยากอัตโนมัติ 🔥');
      }

      emitQuestUpdate();

      running = true;
      startSecondLoop();
      scheduleNextSpawn();

      createTarget();
      setTimeout(() => createTarget(), Math.min(260, CFG.spawnInterval * 0.35));

      dispatch('hha:score', { score, combo, misses, shield, fever });
    },

    stop(reason) {
      stopAll(reason || 'stop');
    }
  };

})();