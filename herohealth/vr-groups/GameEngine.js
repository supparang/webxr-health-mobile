// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — HYPE ENGINE v3 (Grade5 Fun Pack)
// ✅ NO-FLASH + HIT 100% (pointerdown/touchstart/mousedown/click)
// ✅ Quest Goals (จาก quest-manager.js) + ✅ Mini-Quest "Cards" ต่อเนื่อง
// ✅ Turbo Rush (5s) + Bonus Target + Boss (Phase 2) + Risk–Reward + Final Countdown
// ✅ Adaptive (โหมดเล่นธรรมดา) / Research locked-by-diff only (โหมดวิจัย)
//
// API:
//   window.GroupsVR.GameEngine.start(diff, { layerEl?, runMode?, config? })
//   window.GroupsVR.GameEngine.stop(reason?)
//   window.GroupsVR.GameEngine.setLayerEl(el)
//
// Events:
//   hha:score    { score, combo, misses, shield, fever, turbo, brave, tier, size }
//   hha:judge    { label, x, y, good, emoji }
//   quest:update { goal, mini, goalsAll, minisAll, miniCleared, miniShown }
//   hha:coach    { text }
//   hha:celebrate{ type:'goal'|'mini'|'all', index, total, label }
//   hha:end      { reason, scoreFinal, comboMax, misses, goalsTotal, goalsCleared, miniTotal, miniCleared, miniShown }
//
// Miss policy (ตามที่คุยไว้):
//   miss = good expired + junk hit
//   * junk hit ตอนมี Shield กันไว้ => ไม่เป็น miss

(function () {
  'use strict';

  const ns = (window.GroupsVR = window.GroupsVR || {});
  const ROOT = window;

  // ---------- optional deps ----------
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles ||
    { scorePop() {}, burstAt() {}, celebrateQuestFX() {}, celebrateAllQuestsFX() {} };

  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI ||
    { ensureFeverBar() {}, setFever() {}, setFeverActive() {}, setShield() {} };

  const QuestFactory =
    (ROOT.GroupsQuest && typeof ROOT.GroupsQuest.createFoodGroupsQuest === 'function')
      ? ROOT.GroupsQuest
      : null;

  // ---------- helpers ----------
  function now() { return (performance && performance.now) ? performance.now() : Date.now(); }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }

  function dispatch(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch {}
  }

  function coach(text) {
    if (!text) return;
    dispatch('hha:coach', { text: String(text) });
  }

  function centerXY(el) {
    try {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    } catch {
      return { x: window.innerWidth / 2, y: window.innerHeight * 0.52 };
    }
  }

  function getParam(name, fallback) {
    try {
      const u = new URL(window.location.href);
      const v = u.searchParams.get(name);
      return (v !== null && v !== '') ? v : fallback;
    } catch {
      return fallback;
    }
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

  // time
  let timeLeft = -1;
  let finalMode = false;

  // quest (goals)
  let quest = null;
  let goalIndexShown = -1;
  let allClearedShown = false;

  // mini-quest cards (continuous)
  const MINI_HISTORY_MAX = 6;
  let miniCard = null;         // current card object
  let miniShown = 0;           // total cards issued
  let miniCleared = 0;         // cleared cards count
  const miniHistory = [];      // last N cards (for result/quest:update)
  let miniCelebrateShown = -1; // gate celebrate

  // turbo
  let turboOn = false;
  let turboEndsAt = 0;
  let turboCooldownUntil = 0;

  // risk-reward
  let braveMode = false;

  // adaptive
  let runMode = 'play'; // 'play' | 'research'
  let diffKey = 'normal';
  let tier = 0; // adaptive tier 0..4
  let emaSkill = 0.5; // 0..1
  let hitGood = 0, hitJunk = 0, expGood = 0;
  let secondsPlayed = 0;

  // boss
  let bossActive = false;
  let bossHP = 0;
  let bossMaxHP = 0;
  let bossMoveTimer = null;
  let bossSpawned = false;

  // ---------- config (base) ----------
  const CFG = {
    // spawn base
    spawnInterval: 900,
    maxActive: 4,

    // visibility
    minVisible: 2000,
    lifeTime: [3800, 5200],

    // chance
    goodRatio: 0.74,
    bonusEverySec: [10, 15], // spawn bonus every 10–15 sec (play mode)

    // size by diff (RESEARCH LOCK + initial for PLAY)
    sizeByDiff: {
      easy:   { base: 152, min: 118, max: 182 },
      normal: { base: 132, min: 104, max: 168 },
      hard:   { base: 118, min: 92,  max: 152 }
    },

    // scoring
    pointsGood: 10,
    pointsGoodFever: 14,
    pointsBonus: 28,
    pointsBoss: 22,
    pointsJunkHit: -8,       // no shield => miss
    pointsGoodExpire: -4,    // good expired => miss
    pointsJunkExpire: 0,

    // fever
    feverGainGood: 14,
    feverGainBonus: 26,
    feverGainBoss: 22,
    feverLossMiss: 18,
    feverDurationMs: 8000,
    shieldPerFever: 1,

    // turbo
    turboNeedCombo: 6,
    turboDurationMs: 5000,
    turboCooldownMs: 6500,
    turboSpawnMult: 0.78,     // faster spawns during turbo
    turboScoreMult: 1.15,     // +15% during turbo

    // final
    finalSec: 10,
    finalSpawnMult: 0.72,
    finalGoodBoost: 0.08,     // good ratio up in final

    // boss
    bossTriggerSec: 20,       // if timeLeft <= 20 => allow boss
    bossBaseHP: { easy: 5, normal: 6, hard: 7 },
    bossPhase2At: 1,          // hp <= 1 => phase2
    bossMoveEveryMs: 520,     // phase 1
    bossMoveEveryMs2: 320,    // phase 2

    // anti-rage (junk streak cap)
    maxJunkStreak: 2
  };

  // emoji pools fallback
  const EMOJI_GOOD = ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚','🍞','🥔','🍊'];
  const EMOJI_JUNK = ['🧋','🍟','🍩','🍔','🍕'];

  // internal spawn anti-streak
  let junkStreak = 0;

  // bonus spawn timer
  let nextBonusAtSec = 0;

  // ---------- difficulty ----------
  function applyDifficulty(diff) {
    diff = String(diff || 'normal').toLowerCase();

    if (diff === 'easy') {
      CFG.spawnInterval = 1120;
      CFG.maxActive = 3;
      CFG.minVisible = 2600;
      CFG.lifeTime = [5200, 6800];
      CFG.feverGainGood = 16;
      CFG.feverLossMiss = 16;
      CFG.goodRatio = 0.76;
    } else if (diff === 'hard') {
      CFG.spawnInterval = 760;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4600];
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
      CFG.goodRatio = 0.72;
    } else {
      CFG.spawnInterval = 900;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
      CFG.goodRatio = 0.74;
    }
  }

  // ---------- sizing (research lock vs play adaptive) ----------
  function getBaseSize() {
    const map = CFG.sizeByDiff[diffKey] || CFG.sizeByDiff.normal;
    return map.base | 0;
  }
  function getSizeBounds() {
    const map = CFG.sizeByDiff[diffKey] || CFG.sizeByDiff.normal;
    return { min: map.min | 0, max: map.max | 0 };
  }

  function computeAdaptiveTier() {
    // skill in [0..1], based on: good hit ratio, comboMax, misses rate
    const totalInteract = hitGood + hitJunk + expGood;
    const goodRate = totalInteract > 0 ? (hitGood / totalInteract) : 0.5;

    // normalize comboMax (0..12 -> 0..1)
    const comboN = clamp(comboMax / 12, 0, 1);

    // misses per 30s (0..8 -> 1..0)
    const missRate = (secondsPlayed > 0) ? (misses / Math.max(1, secondsPlayed / 30)) : 0;
    const missN = clamp(1 - (missRate / 8), 0, 1);

    const raw = (0.52 * goodRate) + (0.28 * comboN) + (0.20 * missN);
    // EMA smooth
    emaSkill = (0.86 * emaSkill) + (0.14 * raw);

    // map to tiers
    if (emaSkill < 0.42) return 0;
    if (emaSkill < 0.52) return 1;
    if (emaSkill < 0.64) return 2;
    if (emaSkill < 0.74) return 3;
    return 4;
  }

  function applyAdaptiveIfPlay() {
    if (runMode !== 'play') return;

    tier = computeAdaptiveTier();

    // adjust spawn / maxActive / life slightly by tier (ให้มันส์ขึ้นแต่ไม่รก)
    const base = String(diffKey);
    const t = tier;

    // spawn multiplier (tier higher => faster)
    const spawnMult = [1.06, 1.00, 0.94, 0.88, 0.82][t];
    const maxAdd    = [0, 0, 1, 1, 2][t];

    const baseSpawn = (base === 'easy') ? 1120 : (base === 'hard' ? 760 : 900);
    CFG.spawnInterval = Math.round(baseSpawn * spawnMult);

    const baseMax = (base === 'easy') ? 3 : (base === 'hard' ? 5 : 4);
    CFG.maxActive = clamp(baseMax + maxAdd, 3, 6);

    // life shorter a bit when tier high (แต่ไม่ให้แว๊บ)
    const map = (base === 'easy')
      ? { a: 5200, b: 6800 }
      : (base === 'hard')
        ? { a: 3200, b: 4600 }
        : { a: 3800, b: 5200 };

    const shrink = [1.00, 0.98, 0.95, 0.92, 0.90][t];
    CFG.lifeTime = [Math.round(map.a * shrink), Math.round(map.b * shrink)];

    // minVisible ให้ยัง “ไม่แว๊บ”
    const mvBase = (base === 'easy') ? 2600 : (base === 'hard' ? 1600 : 2000);
    CFG.minVisible = Math.round(mvBase * (t >= 3 ? 0.92 : 1.00));

    // size adaptive: skill สูง => เล็กลงนิด (แต่มี clamp)
    const bounds = getSizeBounds();
    const baseSize = getBaseSize();
    const sizeMult = [1.06, 1.02, 0.98, 0.94, 0.90][t];
    const nextSize = clamp(Math.round(baseSize * sizeMult), bounds.min, bounds.max);
    return nextSize;
  }

  function getCurrentTargetSize() {
    // research: lock by diff only
    if (runMode === 'research') return getBaseSize();
    // play: adaptive
    const s = applyAdaptiveIfPlay();
    return (typeof s === 'number' && s > 0) ? s : getBaseSize();
  }

  // ---------- positioning ----------
  function pickScreenPos() {
    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    const marginX = Math.min(170, Math.round(w * 0.16));
    const marginYTop = Math.min(240, Math.round(h * 0.24));
    const marginYBot = Math.min(190, Math.round(h * 0.22));

    const x = randInt(marginX, w - marginX);
    const y = randInt(marginYTop, h - marginYBot);
    return { x, y };
  }

  // ---------- hit binding ----------
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

  // ---------- fever/shield ----------
  function setFeverValue(v) {
    fever = clamp(v, 0, FEVER_MAX);
    FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
    FeverUI.setFever && FeverUI.setFever(fever);
    dispatchScore();
  }

  function setShieldValue(v) {
    shield = Math.max(0, Number(v) || 0);
    FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
    FeverUI.setShield && FeverUI.setShield(shield);
    dispatchScore();
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

    // reset fever bar ให้ไต่ใหม่
    setFeverValue(0);

    // turbo feels better when fever triggers
    coach('🔥 FEVER TIME! ได้โล่เพิ่มแล้ว! 🛡️');
  }

  function tickFever() {
    if (!feverOn) return;
    if (now() >= feverEndsAt) setFeverActive(false);
  }

  // ---------- turbo ----------
  function setTurbo(on) {
    turboOn = !!on;
    document.body && document.body.classList.toggle('turbo-on', turboOn);
    dispatchScore();
  }

  function tryEnterTurbo() {
    if (turboOn) return;
    const t = now();
    if (t < turboCooldownUntil) return;
    if (combo < CFG.turboNeedCombo) return;

    setTurbo(true);
    turboEndsAt = t + CFG.turboDurationMs;
    turboCooldownUntil = t + CFG.turboDurationMs + CFG.turboCooldownMs;

    coach('🚀 TURBO RUSH! 5 วิ เร่งสปีด!');
    dispatch('hha:judge', { label: 'TURBO', x: window.innerWidth/2, y: window.innerHeight*0.45, good: true });
  }

  function tickTurbo() {
    if (!turboOn) return;
    if (now() >= turboEndsAt) {
      setTurbo(false);
      coach('หมด TURBO แล้ว! เก็บคอมโบใหม่ได้เลย ✨');
    }
  }

  // ---------- score/combo/miss ----------
  function addScore(delta) {
    score = (score + (delta | 0)) | 0;
    dispatchScore();
  }

  function setCombo(v) {
    combo = Math.max(0, v | 0);
    comboMax = Math.max(comboMax, combo);
    dispatchScore();
    // turbo trigger
    tryEnterTurbo();
  }

  function addMiss() {
    misses = (misses + 1) | 0;
    dispatchScore();
  }

  function dispatchScore() {
    dispatch('hha:score', {
      score,
      combo,
      misses,
      shield,
      fever,
      turbo: turboOn,
      brave: braveMode,
      tier,
      size: getCurrentTargetSize()
    });
  }

  // ---------- quest (goals) + mini cards ----------
  function emitQuestUpdate() {
    const goalsAll = quest ? (quest.goals || []) : [];
    const minisAll = [];

    // active goal = first not done
    const goal = goalsAll.find(g => g && !g.done) || null;

    // mini from cards (current only)
    const mini = miniCard && !miniCard.done
      ? { label: miniCard.label, prog: miniCard.prog, target: miniCard.target }
      : null;

    // build minisAll for UI/history (last N)
    miniHistory.slice(-MINI_HISTORY_MAX).forEach(m => minisAll.push(m));

    dispatch('quest:update', {
      goal: goal ? { label: goal.label, prog: goal.prog, target: goal.target } : null,
      mini,
      goalsAll,
      minisAll,
      miniCleared,
      miniShown
    });

    // celebrate goal
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

    // celebrate mini
    if (miniCleared !== miniCelebrateShown && miniCleared > 0) {
      miniCelebrateShown = miniCleared;
      dispatch('hha:celebrate', {
        type: 'mini',
        index: miniCleared,
        total: Math.max(miniShown, miniCleared),
        label: 'MINI CLEAR!'
      });
    }

    // all complete (goals all done + at least 3 mini cleared OR time final)
    if (!allClearedShown && goalsAll.length && goalsCleared === goalsAll.length && miniCleared >= 3) {
      allClearedShown = true;
      dispatch('hha:celebrate', { type: 'all' });
      coach('🏆 เคลียร์ครบแล้ว! เตรียมสู้บอสได้เลย!');
      // allow boss spawn soon
      maybeSpawnBoss(true);
    }
  }

  function makeMiniCardPool() {
    // cards tuned for Grade 5: ชัด, สั้น, เร้าใจ
    return [
      {
        id: 'C-VEG-3',
        type: 'streak',
        label: '🥦 ผัก 3 ครั้งติด!',
        target: 3,
        prog: 0,
        test: (ev) => ev.good && ev.groupId === 3, // หมู่ 3 ผัก
        resetOnFail: true
      },
      {
        id: 'C-G2-SPEED',
        type: 'timer',
        label: '⚡ หมู่ 2 ให้ได้ 5 ชิ้นใน 8 วิ!',
        target: 5,
        prog: 0,
        windowSec: 8,
        test: (ev) => ev.good && ev.groupId === 2
      },
      {
        id: 'C-NO-JUNK-6',
        type: 'nojunk',
        label: '🛡️ 6 วิ ห้ามโดนขยะ!',
        target: 1,
        prog: 0,
        windowSec: 6,
        test: (ev) => true
      },
      {
        id: 'C-FRUIT-4',
        type: 'count',
        label: '🍎 ผลไม้ 4 ชิ้น!',
        target: 4,
        prog: 0,
        test: (ev) => ev.good && ev.groupId === 4
      },
      {
        id: 'C-G1-4',
        type: 'count',
        label: '💪 หมู่ 1 เก็บ 4 ชิ้น!',
        target: 4,
        prog: 0,
        test: (ev) => ev.good && ev.groupId === 1
      }
    ];
  }

  let miniPool = makeMiniCardPool();
  let miniTimerLeft = 0;      // for timer cards
  let miniNoJunkLeft = 0;     // for no-junk card

  function issueNewMiniCard() {
    const pick = miniPool[randInt(0, miniPool.length - 1)];
    const card = {
      id: pick.id,
      label: pick.label,
      type: pick.type,
      target: pick.target,
      prog: 0,
      done: false,
      windowSec: pick.windowSec || 0,
      resetOnFail: !!pick.resetOnFail,
      test: pick.test
    };

    miniCard = card;
    miniShown++;

    // timers init
    if (card.type === 'timer') miniTimerLeft = card.windowSec;
    if (card.type === 'nojunk') miniNoJunkLeft = card.windowSec;

    // history push (clone)
    miniHistory.push({ id: card.id, label: card.label, prog: 0, target: card.target, done: false });
    while (miniHistory.length > MINI_HISTORY_MAX) miniHistory.shift();

    coach('⭐ MINI QUEST: ' + card.label);
    emitQuestUpdate();
  }

  function markMiniDone() {
    if (!miniCard || miniCard.done) return;
    miniCard.done = true;
    miniCleared++;

    // update last history as done
    for (let i = miniHistory.length - 1; i >= 0; i--) {
      if (miniHistory[i] && miniHistory[i].id === miniCard.id && !miniHistory[i].done) {
        miniHistory[i].done = true;
        miniHistory[i].prog = miniCard.target;
        break;
      }
    }

    // celebration / FX
    dispatch('hha:celebrate', {
      type: 'mini',
      index: miniCleared,
      total: Math.max(miniShown, miniCleared),
      label: miniCard.label
    });
    Particles.celebrateQuestFX && Particles.celebrateQuestFX('mini', miniCleared, Math.max(miniShown, miniCleared), miniCard.label);

    // chain next card quickly
    setTimeout(() => issueNewMiniCard(), 550);
  }

  function updateMiniProgressDisplay() {
    if (!miniCard || miniCard.done) return;

    // keep history prog sync
    for (let i = miniHistory.length - 1; i >= 0; i--) {
      if (miniHistory[i] && miniHistory[i].id === miniCard.id && !miniHistory[i].done) {
        miniHistory[i].prog = miniCard.prog;
        break;
      }
    }
  }

  // ---------- group mapping ----------
  function emojiToGroupId(emoji) {
    // best: quest active group mapping
    if (quest && typeof quest.getActiveGroup === 'function') {
      const g = quest.getActiveGroup();
      if (g && Array.isArray(g.emojis) && g.emojis.includes(emoji)) return g.key || 1;
    }
    // fallback guess
    if (['🥦','🥕','🥬','🍅','🧄','🧅'].includes(emoji)) return 3;
    if (['🍎','🍌','🍊','🍇','🍓','🍍','🍑'].includes(emoji)) return 4;
    if (['🍚','🍞','🥖','🥔','🥐','🥯'].includes(emoji)) return 2;
    if (['🥑','🧈','🥓'].includes(emoji)) return 5;
    return 1;
  }

  function pickGoodEmoji() {
    const g = (quest && quest.getActiveGroup) ? quest.getActiveGroup() : null;
    if (g && Array.isArray(g.emojis) && g.emojis.length) {
      return g.emojis[randInt(0, g.emojis.length - 1)];
    }
    return EMOJI_GOOD[randInt(0, EMOJI_GOOD.length - 1)];
  }
  function pickJunkEmoji() {
    return EMOJI_JUNK[randInt(0, EMOJI_JUNK.length - 1)];
  }

  // ---------- spawn decision (anti-rage + final boost) ----------
  function decideGood() {
    let r = CFG.goodRatio;

    // final: good boost
    if (finalMode) r = clamp(r + CFG.finalGoodBoost, 0.55, 0.92);

    // turbo: slightly more good
    if (turboOn) r = clamp(r + 0.04, 0.55, 0.92);

    // anti-junk streak
    if (junkStreak >= CFG.maxJunkStreak) return true;

    const good = Math.random() < r;
    if (good) junkStreak = 0;
    else junkStreak++;
    return good;
  }

  // ---------- element build ----------
  function applySizeToEl(el, px) {
    const s = px | 0;
    el.style.width = s + 'px';
    el.style.height = s + 'px';
    el.style.setProperty('--emojiSize', Math.round(s * 0.48) + 'px');
  }

  function createTarget(kind) {
    if (!running || !layerEl) return;
    if (active.length >= CFG.maxActive && kind !== 'boss') return;

    const p = pickScreenPos();
    const size = getCurrentTargetSize();

    let type = kind || 'normal'; // normal | bonus | boss
    let good = true;
    let emoji = '🥦';

    if (type === 'boss') {
      good = true;
      emoji = '👾';
    } else if (type === 'bonus') {
      good = true;
      emoji = '⭐';
    } else {
      good = decideGood();
      emoji = good ? pickGoodEmoji() : pickJunkEmoji();
    }

    const el = document.createElement('div');
    el.className =
      'fg-target ' +
      (type === 'boss' ? 'fg-boss' : type === 'bonus' ? 'fg-bonus' : (good ? 'fg-good' : 'fg-junk'));

    el.setAttribute('data-emoji', emoji);
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';

    applySizeToEl(el, size);
    layerEl.appendChild(el);

    const t = {
      el,
      kind: type,
      good,
      emoji,
      alive: true,
      canExpire: false,
      bornAt: now(),
      minTimer: null,
      lifeTimer: null,
      // boss
      hp: (type === 'boss') ? bossHP : 0
    };

    active.push(t);

    // lock visible (no flash)
    t.minTimer = setTimeout(() => { t.canExpire = true; }, CFG.minVisible);

    // boss should not auto-expire
    if (type !== 'boss') {
      const life = randInt(CFG.lifeTime[0], CFG.lifeTime[1]);
      t.lifeTimer = setTimeout(() => {
        if (!t.canExpire) {
          const wait = Math.max(0, CFG.minVisible - (now() - t.bornAt));
          setTimeout(() => expireTarget(t), wait);
        } else {
          expireTarget(t);
        }
      }, life);
    }

    // hit
    bindHit(el, () => hitTarget(t));
  }

  // ---------- spawn loop ----------
  function getSpawnIntervalNow() {
    let iv = CFG.spawnInterval;

    if (turboOn) iv = Math.round(iv * CFG.turboSpawnMult);
    if (finalMode) iv = Math.round(iv * CFG.finalSpawnMult);

    // clamp
    return clamp(iv, 520, 1800);
  }

  function scheduleNextSpawn() {
    if (!running) return;
    clearTimeout(spawnTimer);

    spawnTimer = setTimeout(() => {
      // spawn 1 normal
      createTarget('normal');

      // sometimes spawn 2 targets in turbo/final for hype (ไม่ให้รกเกิน maxActive)
      if ((turboOn || finalMode) && active.length < CFG.maxActive && Math.random() < 0.35) {
        setTimeout(() => createTarget('normal'), 110);
      }

      scheduleNextSpawn();
    }, getSpawnIntervalNow());
  }

  // ---------- bonus target ----------
  function scheduleNextBonus() {
    const a = CFG.bonusEverySec[0] | 0;
    const b = CFG.bonusEverySec[1] | 0;
    nextBonusAtSec = secondsPlayed + randInt(a, b);
  }

  function maybeSpawnBonus() {
    if (runMode !== 'play') return;
    if (!running) return;
    if (secondsPlayed < 3) return;

    if (secondsPlayed >= nextBonusAtSec) {
      // bonus 1 target (doesn't count miss if expires)
      createTarget('bonus');
      scheduleNextBonus();
    }
  }

  // ---------- boss ----------
  function moveBossEl(el) {
    if (!el || !el.isConnected) return;
    const p = pickScreenPos();
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
  }

  function startBossMover(bossEl) {
    clearInterval(bossMoveTimer);
    bossMoveTimer = setInterval(() => {
      if (!running || !bossActive || !bossEl || !bossEl.isConnected) return;
      const phase2 = (bossHP <= CFG.bossPhase2At);
      moveBossEl(bossEl);
      // phase2 shake
      if (phase2) bossEl.classList.add('boss-phase2');
    }, (bossHP <= CFG.bossPhase2At) ? CFG.bossMoveEveryMs2 : CFG.bossMoveEveryMs);
  }

  function stopBossMover() {
    clearInterval(bossMoveTimer);
    bossMoveTimer = null;
  }

  function maybeSpawnBoss(force) {
    if (bossSpawned) return;
    if (runMode !== 'play') return; // เอาไว้เล่นธรรมดาให้มันส์
    if (!force) {
      // allow when time <= bossTriggerSec OR goals complete
      const goalsAll = quest ? (quest.goals || []) : [];
      const goalsCleared = goalsAll.filter(g => g && g.done).length;
      const goalsDone = goalsAll.length && goalsCleared === goalsAll.length;
      const allowByTime = (timeLeft >= 0 && timeLeft <= CFG.bossTriggerSec);
      if (!goalsDone && !allowByTime) return;
    }

    bossSpawned = true;
    bossActive = true;
    bossHP = (CFG.bossBaseHP[diffKey] || CFG.bossBaseHP.normal) | 0;
    bossMaxHP = bossHP;

    coach('👾 บอสมาแล้ว! ตีให้แตก!');
    dispatch('hha:judge', { label: 'BOSS!', x: window.innerWidth/2, y: window.innerHeight*0.42, good: true });

    // spawn boss
    createTarget('boss');

    // attach mover to last boss element
    setTimeout(() => {
      const bossT = active.find(t => t && t.kind === 'boss' && t.alive);
      if (bossT && bossT.el) startBossMover(bossT.el);
    }, 80);
  }

  // ---------- hit / expire ----------
  function scoreMultNow() {
    let m = 1.0;
    if (turboOn) m *= CFG.turboScoreMult;
    if (braveMode) m *= 1.20;
    return m;
  }

  function hitTarget(t) {
    if (!running || !t || !t.alive) return;

    // visual press feedback
    try { t.el.classList.add('press'); setTimeout(() => t.el.classList.remove('press'), 120); } catch {}

    const pos = centerXY(t.el);

    // BONUS
    if (t.kind === 'bonus') {
      destroyTarget(t, true);

      const pts = Math.round(CFG.pointsBonus * scoreMultNow());
      addScore(pts);
      setCombo(combo + 1);

      setFeverValue(fever + CFG.feverGainBonus);
      maybeEnterFever();

      dispatch('hha:judge', { label: 'BONUS', x: pos.x, y: pos.y, good: true, emoji: '⭐' });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: 'BONUS', good: true });

      // mini card progress can count as "any good"
      applyMiniEvent({ type:'hit', good:true, groupId: 0, emoji:'⭐' });

      dispatch('groups:hit', { emoji: '⭐', good: true, x: pos.x, y: pos.y });
      emitQuestUpdate();
      return;
    }

    // BOSS
    if (t.kind === 'boss') {
      // boss hit: reduce hp, never miss
      bossHP = Math.max(0, bossHP - 1);
      // keep boss alive until hp 0
      if (bossHP > 0) {
        // move immediately a bit for hype
        moveBossEl(t.el);

        const pts = Math.round(CFG.pointsBoss * scoreMultNow());
        addScore(pts);
        setCombo(combo + 1);

        setFeverValue(fever + CFG.feverGainBoss);
        maybeEnterFever();

        dispatch('hha:judge', { label: (bossHP <= CFG.bossPhase2At ? 'BOSS PHASE 2!' : 'BOSS HIT'), x: pos.x, y: pos.y, good: true, emoji: '👾' });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: 'BOSS', good: true });

        // phase2 speed up mover
        stopBossMover();
        startBossMover(t.el);

        dispatch('groups:hit', { emoji: '👾', good: true, x: pos.x, y: pos.y });
        emitQuestUpdate();
        return;
      }

      // boss down
      destroyTarget(t, true);
      bossActive = false;
      stopBossMover();

      addScore(99);
      dispatch('hha:celebrate', { type:'all' });
      Particles.celebrateAllQuestsFX && Particles.celebrateAllQuestsFX({});

      coach('🎉 BOSS DOWN! เก่งมากกก!');
      dispatch('hha:judge', { label: 'BOSS DOWN', x: window.innerWidth/2, y: window.innerHeight*0.38, good: true });

      dispatch('groups:hit', { emoji: '👾', good: true, x: pos.x, y: pos.y });
      emitQuestUpdate();
      return;
    }

    // NORMAL (good/junk)
    if (t.good) {
      destroyTarget(t, true);

      const basePts = feverOn ? CFG.pointsGoodFever : CFG.pointsGood;
      const pts = Math.round(basePts * scoreMultNow());
      addScore(pts);
      setCombo(combo + 1);

      setFeverValue(fever + CFG.feverGainGood);
      maybeEnterFever();

      // quest goals update
      if (quest && typeof quest.onGoodHit === 'function') {
        const gid = emojiToGroupId(t.emoji);
        quest.onGoodHit(gid, combo);
      }

      const gid2 = emojiToGroupId(t.emoji);
      applyMiniEvent({ type:'hit', good:true, groupId: gid2, emoji:t.emoji });

      dispatch('hha:judge', { label: feverOn ? 'PERFECT' : 'GOOD', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: feverOn ? 'PERFECT' : 'GOOD', good: true });

      hitGood++;

    } else {
      destroyTarget(t, true);

      if (shield > 0) {
        setShieldValue(shield - 1);
        dispatch('hha:judge', { label: 'BLOCK', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment: 'BLOCK', good: true });
        coach('โล่กันไว้แล้ว! ระวังขยะนะ 🛡️');

        hitJunk++;
        // ไม่ถือ miss

      } else {
        addMiss();
        const pts = Math.round(CFG.pointsJunkHit * scoreMultNow());
        addScore(pts);
        setCombo(0);

        // brave penalty extra (risk-reward)
        const missLoss = braveMode ? (CFG.feverLossMiss + 8) : CFG.feverLossMiss;
        setFeverValue(fever - missLoss);

        // quest junk update
        if (quest && typeof quest.onJunkHit === 'function') {
          const gid = emojiToGroupId(t.emoji);
          quest.onJunkHit(gid);
        }

        applyMiniEvent({ type:'hit', good:false, groupId: 0, emoji:t.emoji });

        dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(pts), { judgment: 'MISS', good: false });
        coach('โอ๊ะ! โดนขยะแล้ว 😵 เล็งอาหารดีก่อนนะ');

        hitJunk++;
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

    // bonus expire: ไม่เป็น miss (กันหัวร้อน)
    if (t.kind === 'bonus') {
      dispatch('groups:expire', { emoji: '⭐', good: true, x: pos.x, y: pos.y });
      return;
    }

    // good expired => miss
    if (t.good) {
      addMiss();
      const pts = Math.round(CFG.pointsGoodExpire * scoreMultNow());
      addScore(pts);
      setCombo(0);

      const missLoss = braveMode ? (CFG.feverLossMiss + 8) : CFG.feverLossMiss;
      setFeverValue(fever - missLoss);

      dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(pts), { judgment: 'MISS', good: false });

      expGood++;
      applyMiniEvent({ type:'expire', good:true, groupId: emojiToGroupId(t.emoji), emoji:t.emoji });

    } else {
      // junk expired => no miss
      addScore(CFG.pointsJunkExpire);
      applyMiniEvent({ type:'expire', good:false, groupId: 0, emoji:t.emoji });
    }

    dispatch('groups:expire', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y });
    emitQuestUpdate();
  }

  // ---------- mini card logic ----------
  function applyMiniEvent(ev) {
    if (!miniCard || miniCard.done) return;

    // card types:
    // - count: prog++ when test() true
    // - streak: prog++ when test() true, else reset to 0 if resetOnFail
    // - timer: must reach target within windowSec
    // - nojunk: fail if junk hit without shield (we treat ev.good===false + label MISS path)
    const card = miniCard;
    let changed = false;

    if (card.type === 'nojunk') {
      // passively handled by timer; fail on junk miss
      if (ev.type === 'hit' && ev.good === false) {
        // fail: reset card immediately (but keep it as not done)
        coach('😵 โดนขยะ! MINI ล้มเหลว รีบเริ่มใหม่!');
        card.prog = 0;
        miniNoJunkLeft = card.windowSec;
        changed = true;
      }
      // success is when timer reaches 0 (handled in second loop)
    }

    if (card.type === 'timer') {
      if (ev.type === 'hit' && ev.good && card.test(ev)) {
        card.prog++;
        changed = true;
        if (card.prog >= card.target) {
          markMiniDone();
          return;
        }
      }
      // timer countdown handled in second loop; if time runs out => reset
    }

    if (card.type === 'count') {
      if (ev.type === 'hit' && ev.good && card.test(ev)) {
        card.prog++;
        changed = true;
        if (card.prog >= card.target) {
          markMiniDone();
          return;
        }
      }
    }

    if (card.type === 'streak') {
      if (ev.type === 'hit' && ev.good && card.test(ev)) {
        card.prog++;
        changed = true;
        if (card.prog >= card.target) {
          markMiniDone();
          return;
        }
      } else if (ev.type === 'hit' && card.resetOnFail) {
        // not matching hit => reset streak
        if (card.prog !== 0) {
          card.prog = 0;
          changed = true;
        }
      }
    }

    if (changed) {
      updateMiniProgressDisplay();
      emitQuestUpdate();
    }
  }

  // ---------- second loop ----------
  function tickFinalCountdown() {
    if (timeLeft < 0) return;
    if (!finalMode && timeLeft <= CFG.finalSec) {
      finalMode = true;
      document.body && document.body.classList.add('final-on');
      coach('⏳ 10 วิสุดท้าย! เร่งเลยย!');
      dispatch('hha:judge', { label: 'FINAL!', x: window.innerWidth/2, y: window.innerHeight*0.44, good: true });
    }
  }

  function tickMiniTimers() {
    if (!miniCard || miniCard.done) return;

    if (miniCard.type === 'timer') {
      miniTimerLeft = Math.max(0, miniTimerLeft - 1);
      // show progress like "prog/target (เหลือ x วิ)" via label tweak
      // (UI ฝั่ง html จะโชว์ label เดิม + prog/target อยู่แล้ว)
      if (miniTimerLeft <= 0) {
        coach('⌛ หมดเวลา! MINI รีเซ็ต ลองใหม่!');
        miniCard.prog = 0;
        miniTimerLeft = miniCard.windowSec;
        updateMiniProgressDisplay();
        emitQuestUpdate();
      }
    }

    if (miniCard.type === 'nojunk') {
      miniNoJunkLeft = Math.max(0, miniNoJunkLeft - 1);
      if (miniNoJunkLeft <= 0) {
        // success
        miniCard.prog = 1;
        updateMiniProgressDisplay();
        markMiniDone();
      }
    }
  }

  function startSecondLoop() {
    clearInterval(secondTimer);
    secondTimer = setInterval(() => {
      if (!running) return;

      secondsPlayed++;
      tickFever();
      tickTurbo();

      // quest rotation
      if (quest && typeof quest.second === 'function') quest.second();

      // bonus schedule
      maybeSpawnBonus();

      // final mode
      tickFinalCountdown();

      // boss spawn gating
      if (!bossSpawned) maybeSpawnBoss(false);

      // mini timers
      tickMiniTimers();

      // adaptive recalculation every 4s (play only)
      if (runMode === 'play' && (secondsPlayed % 4 === 0)) {
        applyAdaptiveIfPlay();
      }

      emitQuestUpdate();
    }, 1000);
  }

  // ---------- time listener from outer page ----------
  function onTimeEvent(e) {
    try {
      const d = (e && e.detail) || {};
      const sec = (d.sec | 0);
      timeLeft = sec;
    } catch {}
  }

  // ---------- reset/stop ----------
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

    secondsPlayed = 0;
    timeLeft = -1;
    finalMode = false;

    turboOn = false;
    turboEndsAt = 0;
    turboCooldownUntil = 0;

    emaSkill = 0.5;
    tier = 0;
    hitGood = 0;
    hitJunk = 0;
    expGood = 0;

    junkStreak = 0;

    // mini
    miniCard = null;
    miniShown = 0;
    miniCleared = 0;
    miniHistory.length = 0;
    miniCelebrateShown = -1;

    // quest celebrate
    goalIndexShown = -1;
    allClearedShown = false;

    // boss
    bossActive = false;
    bossHP = 0;
    bossMaxHP = 0;
    bossSpawned = false;
    stopBossMover();

    try {
      document.body && document.body.classList.remove('final-on','turbo-on','brave-on');
    } catch {}
  }

  function stopAll(reason) {
    running = false;
    clearTimeout(spawnTimer);
    spawnTimer = null;
    clearInterval(secondTimer);
    secondTimer = null;

    stopBossMover();

    // remove time listener
    window.removeEventListener('hha:time', onTimeEvent);

    // clear targets
    active.slice().forEach(t => destroyTarget(t, true));
    active.length = 0;

    const goalsAll = quest ? (quest.goals || []) : [];
    const goalsCleared = goalsAll.filter(g => g && g.done).length;

    dispatch('hha:end', {
      reason: reason || 'stop',
      scoreFinal: score,
      comboMax,
      misses,
      goalsTotal: goalsAll.length,
      goalsCleared,
      miniTotal: Math.max(miniShown, miniCleared),
      miniShown,
      miniCleared
    });
  }

  // ---------- public API ----------
  ns.GameEngine = {
    setLayerEl(el) { layerEl = el; },

    start(diff = 'normal', opts = {}) {
      layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;
      if (!layerEl) {
        console.error('[FoodGroupsVR] layerEl missing');
        return;
      }

      diffKey = String(diff || 'normal').toLowerCase();
      runMode = String((opts && opts.runMode) || getParam('run', 'play')).toLowerCase();
      runMode = (runMode === 'research') ? 'research' : 'play';

      // brave toggle (risk–reward)
      braveMode = String(getParam('brave','0')) === '1';
      document.body && document.body.classList.toggle('brave-on', braveMode);

      // overrides
      if (opts && opts.config) Object.assign(CFG, opts.config);

      applyDifficulty(diffKey);
      resetState();

      // fever HUD init
      FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
      FeverUI.setFever && FeverUI.setFever(0);
      FeverUI.setFeverActive && FeverUI.setFeverActive(false);
      FeverUI.setShield && FeverUI.setShield(0);

      // quest init (goals)
      if (QuestFactory && typeof QuestFactory.createFoodGroupsQuest === 'function') {
        quest = QuestFactory.createFoodGroupsQuest(diffKey);
      } else {
        quest = null;
        console.warn('[FoodGroupsVR] quest-manager not found: window.GroupsQuest.createFoodGroupsQuest');
      }

      // mini cards start
      scheduleNextBonus();
      issueNewMiniCard();

      // time listener for final countdown + boss gating
      window.addEventListener('hha:time', onTimeEvent);

      // coach intro
      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      if (runMode === 'research') {
        coach('🧪 โหมดวิจัย: ขนาดเป้าล็อกตามระดับเท่านั้น');
      } else {
        coach('🎮 โหมดเล่น: เกมจะปรับความยากตามความสามารถของเรา!');
      }
      coach(g ? `เริ่มเลย! โซนนี้คือ ${g.label} ✨` : 'เริ่มเลย! แตะอาหารดีให้ได้เยอะ ๆ ✨');
      if (braveMode) coach('⚠️ โหมดกล้าเปิดอยู่: คะแนน+ แต่พลาดโดนตัด Fever หนักขึ้น!');

      // initial UI
      emitQuestUpdate();

      running = true;
      startSecondLoop();
      scheduleNextSpawn();

      // spawn initial 2 targets (ไม่โล่ง)
      createTarget('normal');
      setTimeout(() => createTarget('normal'), 220);

      dispatchScore();
    },

    stop(reason) {
      stopAll(reason || 'stop');
    }
  };
})();