// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION SAFE ENGINE (NO-FLASH + HIT 100% + QUEST + FX + FEVER)
// + PLAY MODE EXTRAS: Adaptive + Boss + Golden(TimeBonus) + Trap
// + RESEARCH MODE: lock-by-diff only (no adaptive / boss / golden / trap)
//
// API:
//   window.GroupsVR.GameEngine.start(diff, { layerEl?, runMode?, config? })
//   window.GroupsVR.GameEngine.stop(reason?)
//   window.GroupsVR.GameEngine.setLayerEl(el)
//
// Events ที่ยิงออก:
//   - hha:score        { score, combo, misses, shield, fever }
//   - hha:judge        { label, x, y, good, emoji }
//   - quest:update     { goal, mini, goalsAll, minisAll, groupLabel? }
//   - hha:coach        { text }
//   - hha:celebrate    { type:'goal'|'mini'|'all', index, total, label }
//   - hha:timeBonus    { addSec, reason }   // NEW (play only)
//   - hha:end          { reason, scoreFinal, comboMax, misses, goalsTotal, goalsCleared, miniTotal, miniCleared }
//
// Miss policy:
//   miss = good expired (ปล่อยของดีหลุด) + junk hit (โดนขยะ)
//   * ถ้าโดนขยะตอนมี Shield แล้วกันไว้ → ไม่ถือเป็น miss

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
  function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }

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

  // run mode
  let runMode = 'play'; // 'play' | 'research'

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

  // difficulty base + sizing/adaptive
  let diffKey = 'normal';
  let sizeScale = 1.0;           // current applied scale
  let sizeBaseByDiff = 1.0;      // base by diff (research uses only this)
  let targetSizePx = 132;        // base px from CSS; we multiply scale in JS
  let skill = 0.0;               // [-1..+1] (play only)

  // adaptive rolling window (play only)
  const perfWin = []; // {t, kind:'goodHit'|'junkHit'|'goodExpire', comboAtHit}
  const PERF_MAX = 14;

  // boss
  let bossOn = false;
  let bossEndsAt = 0;
  let bossNextAt = 0;

  // ---------- config ----------
  const CFG = {
    // spawn base (จะโดน diff + adaptive + boss ปรับ)
    spawnInterval: 900,
    maxActive: 4,

    // visibility policy
    minVisible: 2000,
    lifeTime: [3800, 5200],

    // ratio
    goodRatio: 0.75,

    // emoji pools (fallback)
    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚','🍞','🥔','🍊'],
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕'],

    // extras (play only)
    goldenChance: 0.12,           // โอกาส “เป้าทอง” (เฉพาะ good)
    trapChance: 0.07,             // โอกาส “กับดัก” 💣
    trapEmoji: '💣',
    timeBonusSec: 2,              // เวลา +2s เมื่อโดนทอง

    // scoring
    pointsGood: 10,
    pointsGoodFever: 14,
    pointsGolden: 22,             // ทองให้เยอะขึ้น
    pointsGoldenFever: 28,
    pointsTrapHit: -18,           // โดนกับดัก
    pointsJunkHit: -8,            // โดนขยะ (ไม่มี shield)
    pointsGoodExpire: -4,         // ปล่อย good หลุด
    pointsJunkExpire: 0,

    // fever
    feverGainGood: 14,
    feverGainGolden: 28,
    feverLossMiss: 18,
    feverLossTrap: 26,
    feverDurationMs: 8000,
    shieldPerFever: 1,

    // boss tuning (play only)
    bossEverySec: 20,             // ✅ เร้าใจขึ้น (เดิม ~22)
    bossDurationSec: 10,
    bossSpawnMul: 0.72,           // spawnInterval * mul  (ถี่ขึ้น)
    bossMaxActiveAdd: 2,
    bossSizeMul: 0.88,            // เล็กลงนิด
    bossGoodRatio: 0.62,          // ขยะเยอะขึ้น

    // adaptive strength (play only)
    adaptTickSec: 3,              // ปรับทุก 3 วิ
    adaptStrength: 1.10,          // ✅ คมขึ้นนิด (เดิมสมมุติ 1.0)
    adaptMinSize: 0.78,
    adaptMaxSize: 1.18,
    adaptMinSpawn: 620,
    adaptMaxSpawn: 1400,
    adaptMinLifeMul: 0.78,
    adaptMaxLifeMul: 1.20,
    adaptMinActive: 3,
    adaptMaxActive: 6
  };

  function applyDifficulty(diff) {
    diffKey = String(diff || 'normal').toLowerCase();

    if (diffKey === 'easy') {
      CFG.spawnInterval = 1200;
      CFG.maxActive = 3;
      CFG.minVisible = 2600;
      CFG.lifeTime = [4800, 6500];
      CFG.feverGainGood = 16;
      CFG.feverLossMiss = 16;
      sizeBaseByDiff = 1.08; // ✅ เริ่มใหญ่
    } else if (diffKey === 'hard') {
      CFG.spawnInterval = 780;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4600];
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
      sizeBaseByDiff = 0.92; // ✅ เริ่มเล็ก
    } else { // normal
      CFG.spawnInterval = 930;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
      sizeBaseByDiff = 1.00;
    }

    // initialize
    sizeScale = sizeBaseByDiff;
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
    if (now() >= feverEndsAt) setFeverActive(false);
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

  function pushPerf(kind) {
    if (runMode !== 'play') return;
    perfWin.push({ t: now(), kind: String(kind || '') });
    while (perfWin.length > PERF_MAX) perfWin.shift();
  }

  function computeSkill() {
    // skill ∈ [-1..+1] : + = เก่ง (hit good เยอะ), - = พลาด/โดนขยะ
    if (runMode !== 'play') return 0;

    let goodHit = 0, junkHit = 0, goodExpire = 0;
    for (const p of perfWin) {
      if (p.kind === 'goodHit') goodHit++;
      else if (p.kind === 'junkHit') junkHit++;
      else if (p.kind === 'goodExpire') goodExpire++;
    }

    const total = Math.max(1, perfWin.length);
    const hitRate = goodHit / total;
    const badRate = (junkHit + goodExpire) / total;

    // เน้น “ความแม่น” มากกว่าอื่น
    let s = (hitRate * 1.35) - (badRate * 1.55);
    s = clamp(s, -1, 1);

    // ทำให้ response “คม” ขึ้นนิด
    s *= CFG.adaptStrength;
    return clamp(s, -1, 1);
  }

  function applyAdaptiveIfPlay() {
    if (runMode !== 'play') return;
    if (bossOn) return; // ตอนบอสไม่ปรับ adaptive ให้คุมได้

    skill = computeSkill();

    // sizeScale: เก่งแล้วเล็กลง / พลาดแล้วใหญ่ขึ้น
    const targetSize = clamp(sizeBaseByDiff * (1 - 0.16 * skill), CFG.adaptMinSize, CFG.adaptMaxSize);
    sizeScale = lerp(sizeScale, targetSize, 0.55);

    // spawn interval: เก่งแล้วถี่ขึ้น
    const baseSpawn = CFG.spawnInterval;
    const desiredSpawn = clamp(baseSpawn * (1 - 0.22 * skill), CFG.adaptMinSpawn, CFG.adaptMaxSpawn);
    CFG.spawnInterval = Math.round(lerp(CFG.spawnInterval, desiredSpawn, 0.55));

    // maxActive: เก่งแล้วเพิ่ม (แต่ไม่กระชาก)
    const desiredActive = clamp(Math.round((CFG.maxActive) + (skill > 0 ? 1 : 0)), CFG.adaptMinActive, CFG.adaptMaxActive);
    CFG.maxActive = Math.round(lerp(CFG.maxActive, desiredActive, 0.40));

    // lifeTime mul: เก่งแล้วสั้นลง
    const baseLife0 = (diffKey === 'easy') ? 4800 : (diffKey === 'hard' ? 3200 : 3800);
    const baseLife1 = (diffKey === 'easy') ? 6500 : (diffKey === 'hard' ? 4600 : 5200);
    const lifeMul = clamp(1 - 0.18 * skill, CFG.adaptMinLifeMul, CFG.adaptMaxLifeMul);
    CFG.lifeTime = [Math.round(baseLife0 * lifeMul), Math.round(baseLife1 * lifeMul)];

    // goodRatio: เก่งแล้วขยะเพิ่มนิด
    CFG.goodRatio = clamp(0.75 - 0.08 * skill, 0.58, 0.84);

    dispatch('hha:adaptive', {
      skill: Number(skill.toFixed(2)),
      sizeScale: Number(sizeScale.toFixed(2)),
      spawnInterval: CFG.spawnInterval,
      maxActive: CFG.maxActive
    });
  }

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
      goalsAll,
      minisAll,
      groupLabel: g ? g.label : ''
    });

    const goalsCleared = goalsAll.filter(x => x && x.done).length;
    if (goalsCleared !== goalIndexShown && goalsCleared > 0) {
      goalIndexShown = goalsCleared;
      dispatch('hha:celebrate', {
        type: 'goal',
        index: goalsCleared,
        total: goalsAll.length,
        label: 'GOAL CLEAR!'
      });
    }

    const minisCleared = minisAll.filter(x => x && x.done).length;
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

  function applyTargetScale(el, scale) {
    if (!el) return;
    const s = clamp(scale, 0.65, 1.35);
    el.style.width = Math.round(targetSizePx * s) + 'px';
    el.style.height = Math.round(targetSizePx * s) + 'px';
  }

  function maybeStartBoss() {
    if (runMode !== 'play') return;
    const t = now();
    if (bossOn) return;
    if (t < bossNextAt) return;

    bossOn = true;
    bossEndsAt = t + CFG.bossDurationSec * 1000;

    coach('🔥 BOSS TIME! เป้ามารัว ๆ ระวังขยะ! 🔥');

    dispatch('hha:judge', {
      label: 'BOSS',
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.40,
      good: true
    });

    // ติดเอฟเฟกต์สั่นเล็ก ๆ
    if (layerEl) layerEl.classList.add('boss-on');

    // ตั้ง next boss
    bossNextAt = bossEndsAt + (CFG.bossEverySec * 1000);
  }

  function tickBoss() {
    if (runMode !== 'play') return;
    if (!bossOn) {
      maybeStartBoss();
      return;
    }
    if (now() >= bossEndsAt) {
      bossOn = false;
      if (layerEl) layerEl.classList.remove('boss-on');
      coach('บอสจบแล้ว! กลับไปเก็บแต้มต่อเลย ✨');
    }
  }

  function createTarget() {
    if (!running || !layerEl) return;
    if (active.length >= CFG.maxActive + (bossOn ? CFG.bossMaxActiveAdd : 0)) return;

    const g = (quest && quest.getActiveGroup) ? quest.getActiveGroup() : null;

    // determine type
    let isTrap = false;
    let isGolden = false;

    const goodRoll = Math.random() < (bossOn ? CFG.bossGoodRatio : CFG.goodRatio);
    let good = goodRoll;

    if (runMode === 'play') {
      // trap occasionally
      if (Math.random() < CFG.trapChance) {
        isTrap = true;
        good = false; // trap behaves like hazard
      } else if (good && Math.random() < CFG.goldenChance) {
        isGolden = true;
      }
    }

    // pick emoji
    let emoji = '';
    if (isTrap) {
      emoji = CFG.trapEmoji;
    } else if (good) {
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
    if (isGolden) el.classList.add('fg-golden');
    if (isTrap) el.classList.add('fg-trap');
    if (bossOn) el.classList.add('fg-boss');

    el.setAttribute('data-emoji', emoji);

    const p = pickScreenPos();
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';

    layerEl.appendChild(el);

    // apply sizing
    const bossMul = bossOn ? CFG.bossSizeMul : 1.0;
    const finalScale = (runMode === 'research')
      ? sizeBaseByDiff
      : (sizeScale * bossMul);

    applyTargetScale(el, finalScale);

    const t = {
      el,
      good,
      emoji,
      golden: !!isGolden,
      trap: !!isTrap,
      alive: true,
      canExpire: false,
      bornAt: now(),
      minTimer: null,
      lifeTimer: null
    };
    active.push(t);

    // min visible
    t.minTimer = setTimeout(() => { t.canExpire = true; }, CFG.minVisible);

    // life (boss speeds it up a bit)
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

  function hitTarget(t) {
    if (!running || !t || !t.alive) return;
    const pos = centerXY(t.el);

    // TRAP
    if (t.trap) {
      destroyTarget(t, true);
      pushPerf('junkHit');

      addMiss();
      addScore(CFG.pointsTrapHit);
      setCombo(0);

      setFeverValue(fever - CFG.feverLossTrap);

      dispatch('hha:judge', { label: 'TRAP', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsTrapHit), { judgment: 'TRAP', good: false });
      coach('💣 โอ๊ะ! กับดัก! ตั้งสติแล้วไปต่อ!');
      dispatch('groups:hit', { emoji: t.emoji, good: false, x: pos.x, y: pos.y, trap: true });

      emitQuestUpdate();
      return;
    }

    if (t.good) {
      destroyTarget(t, true);
      pushPerf('goodHit');

      const isGold = !!t.golden;
      const pts = isGold
        ? (feverOn ? CFG.pointsGoldenFever : CFG.pointsGolden)
        : (feverOn ? CFG.pointsGoodFever : CFG.pointsGood);

      addScore(pts);
      setCombo(combo + 1);

      // fever gain
      const gain = isGold ? CFG.feverGainGolden : CFG.feverGainGood;
      setFeverValue(fever + gain);
      maybeEnterFever();

      // quest update
      if (quest && typeof quest.onGoodHit === 'function') {
        const gid = emojiToGroupId(t.emoji);
        quest.onGoodHit(gid, combo);
      }

      const label = isGold ? 'GOLD!' : (feverOn ? 'PERFECT' : 'GOOD');
      dispatch('hha:judge', { label, x: pos.x, y: pos.y, good: true, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: label, good: true });

      // time bonus (play only, golden only)
      if (runMode === 'play' && isGold) {
        dispatch('hha:timeBonus', { addSec: CFG.timeBonusSec, reason: 'golden' });
        coach(`✨ เป้าทอง! +${CFG.timeBonusSec}s ไปต่อเลย!`);
      }

    } else {
      destroyTarget(t, true);
      pushPerf('junkHit');

      if (shield > 0) {
        setShieldValue(shield - 1);
        dispatch('hha:judge', { label: 'BLOCK', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment: 'BLOCK', good: true });
        coach('โล่กันไว้แล้ว! ระวังขยะนะ 🛡️');
      } else {
        addMiss();
        addScore(CFG.pointsJunkHit);
        setCombo(0);

        setFeverValue(fever - CFG.feverLossMiss);

        if (quest && typeof quest.onJunkHit === 'function') {
          const gid = emojiToGroupId(t.emoji);
          quest.onJunkHit(gid);
        }

        dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsJunkHit), { judgment: 'MISS', good: false });
        coach('โอ๊ะ! โดนขยะแล้ว 😵 เล็งอาหารดีก่อนนะ');
      }
    }

    dispatch('groups:hit', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y, golden: !!t.golden });

    emitQuestUpdate();
  }

  function expireTarget(t) {
    if (!running || !t || !t.alive) return;
    if (!t.canExpire) return;

    const pos = centerXY(t.el);
    destroyTarget(t, false);

    // expire: miss เฉพาะ good หลุด (golden ก็ถือเป็น good หลุดด้วย)
    if (t.good) {
      pushPerf('goodExpire');

      addMiss();
      addScore(CFG.pointsGoodExpire);
      setCombo(0);
      setFeverValue(fever - CFG.feverLossMiss);

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

    const interval = bossOn ? Math.max(420, Math.round(CFG.spawnInterval * CFG.bossSpawnMul)) : CFG.spawnInterval;

    spawnTimer = setTimeout(() => {
      createTarget();
      scheduleNextSpawn();
    }, interval);
  }

  function startSecondLoop() {
    clearInterval(secondTimer);

    let adaptTick = 0;

    secondTimer = setInterval(() => {
      if (!running) return;

      tickFever();

      // boss tick (play only)
      tickBoss();

      // quest second
      if (quest && typeof quest.second === 'function') quest.second();

      // adaptive tick (play only)
      adaptTick++;
      if (runMode === 'play' && !bossOn && (adaptTick % CFG.adaptTickSec === 0)) {
        applyAdaptiveIfPlay();
      }

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

    perfWin.length = 0;
    skill = 0;

    bossOn = false;
    bossEndsAt = 0;
    bossNextAt = now() + (CFG.bossEverySec * 1000); // first boss after N sec
    if (layerEl) layerEl.classList.remove('boss-on');
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

      runMode = (opts && String(opts.runMode || 'play').toLowerCase() === 'research') ? 'research' : 'play';

      // optional override
      if (opts && opts.config) Object.assign(CFG, opts.config);

      applyDifficulty(diff);
      resetState();

      // research lock: disable extras
      if (runMode === 'research') {
        CFG.goldenChance = 0;
        CFG.trapChance = 0;
        // boss disabled by making nextAt huge
        bossNextAt = Number.POSITIVE_INFINITY;
      }

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

      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      coach(g ? `เริ่มเลย! เก็บอาหารดี: ${g.label} ✨` : 'เริ่มเลย! แตะอาหารดีให้ได้เยอะ ๆ ✨');

      emitQuestUpdate();

      running = true;
      startSecondLoop();
      scheduleNextSpawn();

      // spawn แรกทันที 2 ตัว
      createTarget();
      setTimeout(() => createTarget(), Math.min(260, CFG.spawnInterval * 0.35));

      dispatch('hha:score', { score, combo, misses, shield, fever });
    },

    stop(reason) {
      stopAll(reason || 'stop');
    }
  };

})();
