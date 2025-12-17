// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION SAFE ENGINE
// ✅ research: fixed target size by diff
// ✅ play: adaptive target size by performance
// ✅ mini timer support (mini.timeLeftSec)
// ✅ more exciting for ป.5 (panic mini, streak hype, perfect window)

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

  // stats
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

  // mode
  let runMode = 'play';  // 'play' | 'research'
  let difficultyDiff = 'normal';

  // sizing
  let baseScale = 1.00;      // by diff
  let adaptiveScale = 1.00;  // play only

  // performance window
  let hitsGood = 0;
  let hitsJunk = 0;
  let expiresGood = 0;
  let lastAdjustAt = 0;

  // streak hype
  let streakSinceCoach = 0;

  const CFG = {
    // spawn
    spawnInterval: 880,
    maxActive: 4,

    // visibility policy
    minVisible: 2000,
    lifeTime: [3800, 5200],

    // scoring
    pointsGood: 10,
    pointsGoodFever: 14,
    pointsPerfectWindowBonus: 2, // เพิ่มความเร้าใจ
    pointsJunkHit: -8,
    pointsGoodExpire: -4,
    pointsJunkExpire: 0,

    // fever
    feverGainGood: 14,
    feverLossMiss: 18,
    feverDurationMs: 8000,
    shieldPerFever: 1,

    // base scale by diff
    scaleEasy: 1.10,
    scaleNormal: 1.00,
    scaleHard: 0.92,

    // adaptive tuning (play only)
    adaptEveryMs: 3500,
    adaptStep: 0.06,
    adaptMin: 0.78,
    adaptMax: 1.18,

    // perfect window: ถ้าตีเร็วภายในเวลานี้หลังโผล่ = PERFECT
    perfectWindowMs: 520,

    // emoji pools fallback
    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚','🍞','🥔','🍊'],
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕'],
  };

  function applyDifficulty(diff) {
    diff = String(diff || 'normal').toLowerCase();
    difficultyDiff = diff;

    if (diff === 'easy') {
      CFG.spawnInterval = 1100;
      CFG.maxActive = 3;
      CFG.minVisible = 2400;
      CFG.lifeTime = [5200, 7200];
      CFG.feverGainGood = 16;
      CFG.feverLossMiss = 16;
      baseScale = CFG.scaleEasy;
    } else if (diff === 'hard') {
      CFG.spawnInterval = 720;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3000, 4400];
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
      baseScale = CFG.scaleHard;
    } else {
      CFG.spawnInterval = 880;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
      baseScale = CFG.scaleNormal;
    }

    adaptiveScale = baseScale;
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

    dispatch('hha:judge', { label: 'FEVER', x: window.innerWidth / 2, y: window.innerHeight * 0.52, good: true });
    setFeverValue(0);
    coach('FEVER! 🔥 ได้โล่เพิ่มแล้ว! ลุยยย 🛡️');
  }

  function tickFever() {
    if (!feverOn) return;
    if (now() >= feverEndsAt) {
      setFeverActive(false);
      coach('หมด FEVER แล้ว—คุมจังหวะต่อเลย ✨');
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

  // ---------- sizing ----------
  function targetScaleNow() {
    if (runMode === 'research') return baseScale;
    return clamp(adaptiveScale, CFG.adaptMin, CFG.adaptMax);
  }

  function computePerf() {
    const total = Math.max(1, hitsGood + hitsJunk + expiresGood);
    const missRate = (hitsJunk + expiresGood) / total;
    const comboFactor = clamp(comboMax / 10, 0, 1.2);
    const feverBoost = feverOn ? 0.25 : 0;
    return (comboFactor + feverBoost) - (missRate * 1.25);
  }

  function adaptIfNeeded() {
    if (runMode !== 'play') return;

    const t = now();
    if (t - lastAdjustAt < CFG.adaptEveryMs) return;
    lastAdjustAt = t;

    const perf = computePerf();

    if (perf > 0.35) {
      adaptiveScale -= CFG.adaptStep;
      coach('เริ่มเก่งแล้ว! เป้าเล็กลงนิดนึงนะ 😼');
    } else if (perf < -0.15) {
      adaptiveScale += CFG.adaptStep;
      coach('สู้ ๆ! ขยายเป้าให้จับง่ายขึ้น ✨');
    }

    adaptiveScale = clamp(adaptiveScale, CFG.adaptMin, CFG.adaptMax);

    hitsGood = 0;
    hitsJunk = 0;
    expiresGood = 0;

    dispatch('hha:adaptive', { scale: adaptiveScale, baseScale, runMode, diff: difficultyDiff });
  }

  // ---------- quest panel ----------
  function emitQuestUpdate() {
    if (!quest) return;

    const goalsAll = quest.goals || [];
    const minisAll = quest.minis || [];

    const goal = goalsAll.find(g => g && !g.done) || null;
    const mini = minisAll.find(m => m && !m.done && !m.failed) || null;

    const g = (quest.getActiveGroup && quest.getActiveGroup()) ? quest.getActiveGroup() : null;

    dispatch('quest:update', {
      groupLabel: g ? g.label : null,
      goal: goal ? { label: goal.label, prog: goal.prog, target: goal.target } : null,
      mini: mini ? {
        label: mini.label,
        prog: mini.prog,
        target: mini.target,
        timeLeftSec: (typeof mini.timeLeftSec === 'number') ? mini.timeLeftSec : null,
        type: mini.type || null
      } : null,
      goalsAll,
      minisAll
    });

    const goalsCleared = goalsAll.filter(x => x && x.done).length;
    if (goalsCleared !== goalIndexShown && goalsCleared > 0) {
      goalIndexShown = goalsCleared;
      dispatch('hha:celebrate', { type:'goal', index:goalsCleared, total:goalsAll.length, label:'GOAL CLEAR!' });
    }

    const minisCleared = minisAll.filter(x => x && x.done).length;
    if (minisCleared !== miniIndexShown && minisCleared > 0) {
      miniIndexShown = minisCleared;
      dispatch('hha:celebrate', { type:'mini', index:minisCleared, total:minisAll.length, label:'MINI CLEAR!' });
    }

    if (!allClearedShown && goalsCleared === goalsAll.length && minisCleared === minisAll.length) {
      allClearedShown = true;
      dispatch('hha:celebrate', { type:'all' });
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

    // สัดส่วนดี/ขยะ: ให้ลุ้นแต่ไม่โหดเกิน
    const good = Math.random() < 0.76;
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

    el.style.setProperty('--fg-scale', String(targetScaleNow().toFixed(3)));

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

  function hypeCoachOnStreak() {
    // ทุก ๆ 6 good hits ให้โค้ชชมแบบเร้าใจ
    streakSinceCoach++;
    if (streakSinceCoach >= 6) {
      streakSinceCoach = 0;
      coach('โหดมาก! ต่อคอมโบอีก! ⚡😼');
    }
  }

  function hitTarget(t) {
    if (!running || !t || !t.alive) return;

    const pos = centerXY(t.el);
    const ageMs = now() - t.bornAt;

    if (t.good) {
      destroyTarget(t, true);

      const isPerfectWindow = ageMs <= CFG.perfectWindowMs;
      const basePts = feverOn ? CFG.pointsGoodFever : CFG.pointsGood;
      const pts = basePts + (isPerfectWindow ? CFG.pointsPerfectWindowBonus : 0);

      addScore(pts);
      setCombo(combo + 1);
      hitsGood++;
      hypeCoachOnStreak();

      setFeverValue(fever + CFG.feverGainGood);
      maybeEnterFever();

      if (quest && typeof quest.onGoodHit === 'function') {
        const gid = emojiToGroupId(t.emoji);
        quest.onGoodHit(gid, combo);
      }

      const label = feverOn ? 'PERFECT' : (isPerfectWindow ? 'PERFECT' : 'GOOD');
      dispatch('hha:judge', { label, x: pos.x, y: pos.y, good: true, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: label, good: true });

    } else {
      destroyTarget(t, true);

      if (shield > 0) {
        setShieldValue(shield - 1);

        dispatch('hha:judge', { label: 'BLOCK', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment: 'BLOCK', good: true });

        if (quest && typeof quest.onJunkHit === 'function') {
          const gid = emojiToGroupId(t.emoji);
          quest.onJunkHit(gid, true);
        }

      } else {
        hitsJunk++;
        addMiss();
        addScore(CFG.pointsJunkHit);
        setCombo(0);

        streakSinceCoach = 0;
        setFeverValue(fever - CFG.feverLossMiss);

        if (quest && typeof quest.onJunkHit === 'function') {
          const gid = emojiToGroupId(t.emoji);
          quest.onJunkHit(gid, false);
        }

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
      expiresGood++;
      addMiss();
      addScore(CFG.pointsGoodExpire);
      setCombo(0);

      streakSinceCoach = 0;
      setFeverValue(fever - CFG.feverLossMiss);

      dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsGoodExpire), { judgment: 'MISS', good: false });

      coach('เร็ว ๆ! อาหารดีหลุดไปแล้ว 😵');

    } else {
      addScore(CFG.pointsJunkExpire);
    }

    dispatch('groups:expire', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y });
    emitQuestUpdate();
  }

  function scheduleNextSpawn() {
    if (!running) return;
    clearTimeout(spawnTimer);

    spawnTimer = setTimeout(() => {
      createTarget();
      scheduleNextSpawn();
    }, CFG.spawnInterval);
  }

  function startSecondLoop() {
    clearInterval(secondTimer);
    secondTimer = setInterval(() => {
      if (!running) return;

      tickFever();

      if (quest && typeof quest.second === 'function') quest.second();

      adaptIfNeeded();

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

    hitsGood = 0;
    hitsJunk = 0;
    expiresGood = 0;
    lastAdjustAt = 0;

    streakSinceCoach = 0;
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

  ns.GameEngine = {
    setLayerEl(el) { layerEl = el; },

    start(diff = 'normal', opts = {}) {
      layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;
      if (!layerEl) {
        console.error('[FoodGroupsVR] layerEl missing');
        return;
      }

      runMode = (opts && String(opts.runMode || '').toLowerCase() === 'research') ? 'research' : 'play';

      if (opts && opts.config) Object.assign(CFG, opts.config);

      applyDifficulty(diff);
      resetState();

      FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
      FeverUI.setFever && FeverUI.setFever(0);
      FeverUI.setFeverActive && FeverUI.setFeverActive(false);
      FeverUI.setShield && FeverUI.setShield(0);

      if (QuestFactory && typeof QuestFactory.createFoodGroupsQuest === 'function') {
        quest = QuestFactory.createFoodGroupsQuest(diff, runMode);
      } else {
        quest = null;
        console.warn('[FoodGroupsVR] quest-manager not found: window.GroupsQuest.createFoodGroupsQuest');
      }

      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;

      coach(
        runMode === 'research'
          ? (g ? `โหมดวิจัย: เริ่มที่ ${g.label} (ขนาดเป้าคงที่ตามระดับ)` : 'โหมดวิจัย: เริ่มเกม')
          : (g ? `โหมดเล่น: เริ่มที่ ${g.label} (มี adaptive!)` : 'โหมดเล่น: เริ่มเกม')
      );

      emitQuestUpdate();

      running = true;
      startSecondLoop();
      scheduleNextSpawn();

      createTarget();
      setTimeout(() => createTarget(), Math.min(260, CFG.spawnInterval * 0.35));

      dispatch('hha:score', { score, combo, misses, shield, fever });
    },

    stop(reason) { stopAll(reason || 'stop'); }
  };
})();