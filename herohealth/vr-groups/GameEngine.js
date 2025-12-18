// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION SAFE ENGINE (DOM Targets, PC/Mobile/VR)
//
// ✅ Research mode: ขนาดเป้า "ล็อก" ตาม diff (easy/normal/hard) เท่านั้น (ไม่มี adaptive)
// ✅ Play mode: เริ่มตาม diff แล้ว "adaptive" ตามความสามารถ (ปรับ scale + spawn tempo)
//
// ✅ เพิ่ม 3 อย่าง (เร้าใจ ป.5):
//   (1) Golden Target 🌟 +50 (โผล่เป็นครั้งคราว)
//   (2) PERFECT 3 ติด → FREEZE 2s (หยุด spawn + เป้าค้างชั่วคราว)
//   (3) Boss Mini 10 วิท้าย: spawn รัว + คะแนน x2 + golden เพิ่ม
//
// API:
//   window.GroupsVR.GameEngine.start(diff, { layerEl?, runMode?, durationSec?, config? })
//   window.GroupsVR.GameEngine.stop(reason?)
//   window.GroupsVR.GameEngine.setLayerEl(el)
//   window.GroupsVR.GameEngine.setTimeLeft(sec)
//
// Events:
//   - hha:score   { score, combo, misses, shield, fever }
//   - hha:judge   { label, x, y, good, emoji }
//   - quest:update{ goal, mini, goalsAll, minisAll, groupLabel }
//   - hha:coach   { text }
//   - hha:celebrate { type:'goal'|'mini'|'all', index, total, label }
//   - hha:end     { reason, scoreFinal, comboMax, misses, goalsTotal, goalsCleared, miniTotal, miniCleared }

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

  // Quest factory (non-module)
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

  // modes
  let runMode = 'play';   // 'play' | 'research'
  let diffKey = 'normal';
  let durationSec = 70;
  let timeLeftSec = 999;

  // adaptive
  let baseScale = 1.0;
  let currentScale = 1.0;
  let adaptiveEnabled = true;
  const perfWindow = []; // {hit:boolean, perfect:boolean, t:number}
  let perfWindowMax = 14;
  let lastAdaptiveAt = 0;

  // freeze / boss
  let freezeUntil = 0;
  let perfectStreak = 0;
  let bossMode = false;
  let bossAnnounced = false;

  // ---------- config ----------
  const CFG = {
    // spawn base
    spawnInterval: 900,
    maxActive: 4,

    // visibility policy
    minVisible: 2000,
    lifeTime: [3800, 5200],

    // emoji pools (fallback; quest จะใช้ mapping เอง)
    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚','🍞','🥔','🍊'],
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕'],

    // scoring
    pointsGood: 10,
    pointsGoodFever: 14,
    pointsGoodBossMul: 2,     // boss x2
    pointsJunkHit: -8,        // ถ้าโดนขยะ (ไม่มี shield) หักคะแนน
    pointsGoodExpire: -4,     // ถ้าปล่อยของดีหลุด (expire)
    pointsJunkExpire: 0,

    // golden
    goldenChance: 0.06,       // ปรับตาม diff ใน applyDifficulty
    goldenPoints: 50,
    goldenFeverGain: 30,

    // perfect
    perfectTimeMs: 700,       // ตีไวภายในนี้ = PERFECT
    freezeNeed: 3,
    freezeMs: 2000,

    // fever
    feverGainGood: 14,
    feverLossMiss: 18,
    feverDurationMs: 8000,    // ระยะเวลา fever active
    shieldPerFever: 1,        // ได้เกราะเพิ่มเมื่อเข้า fever

    // adaptive
    scaleMin: 0.78,
    scaleMax: 1.22,
    scaleStep: 0.05,
    adaptiveEveryMs: 3200,    // คิดปรับทุก ~3.2s
    targetHitHigh: 0.80,
    targetHitLow: 0.55,

    // boss
    bossLastSec: 10,
    bossSpawnInterval: 520,
    bossMaxActiveBonus: 2
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
      CFG.goldenChance = 0.05;

      baseScale = 1.12;
    } else if (diff === 'hard') {
      CFG.spawnInterval = 750;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4600];
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
      CFG.goldenChance = 0.07;

      baseScale = 0.92;
    } else { // normal
      CFG.spawnInterval = 900;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
      CFG.goldenChance = 0.06;

      baseScale = 1.00;
    }

    // mode rules
    if (runMode === 'research') {
      adaptiveEnabled = false;
      currentScale = baseScale;         // 🔒 fixed
    } else {
      adaptiveEnabled = true;
      currentScale = baseScale;         // เริ่มจาก base แล้วค่อยปรับ
    }

    setScale(currentScale);
  }

  function setScale(s) {
    currentScale = clamp(s, CFG.scaleMin, CFG.scaleMax);

    // ตั้งเป็น CSS var ที่ชั้น layer (ดีที่สุด)
    try {
      if (layerEl && layerEl.style) layerEl.style.setProperty('--fg-scale', String(currentScale));
      else document.documentElement.style.setProperty('--fg-scale', String(currentScale));
    } catch {}
  }

  function pickScreenPos() {
    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    // กันขอบ + กัน HUD บน/ล่าง
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

    // ห้ามลบก่อนเวลา (ยกเว้น hit)
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

  // ---------- fever ----------
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

    // ได้เกราะเมื่อเข้า fever
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

  // ---------- score/combo/miss ----------
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

  // ---------- adaptive ----------
  function pushPerf(hit, perfect) {
    perfWindow.push({ hit: !!hit, perfect: !!perfect, t: now() });
    while (perfWindow.length > perfWindowMax) perfWindow.shift();
  }

  function computeHitRate() {
    if (!perfWindow.length) return 0.5;
    const hits = perfWindow.filter(x => x.hit).length;
    return hits / perfWindow.length;
  }

  function maybeAdaptive() {
    if (!adaptiveEnabled) return;
    if (runMode !== 'play') return;
    if (bossMode) return; // ช่วงบอส เรา fix ให้เร้าใจ ไม่แกว่งเยอะ

    const t = now();
    if (t - lastAdaptiveAt < CFG.adaptiveEveryMs) return;
    lastAdaptiveAt = t;

    const hitRate = computeHitRate();
    let next = currentScale;

    // เก่งมาก → เป้าเล็กลง
    if (hitRate >= CFG.targetHitHigh && comboMax >= 8) next -= CFG.scaleStep;

    // ยากไป → เป้าใหญ่ขึ้น
    if (hitRate <= CFG.targetHitLow) next += CFG.scaleStep;

    next = clamp(next, CFG.scaleMin, CFG.scaleMax);

    if (Math.abs(next - currentScale) >= 0.01) {
      setScale(next);
      dispatch('hha:judge', {
        label: next < currentScale ? 'LEVEL UP' : 'HELP',
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.25,
        good: true
      });

      // เล่นให้มันส์ขึ้น: ถ้าเก่ง → เร็วขึ้นนิด
      if (hitRate >= CFG.targetHitHigh && CFG.spawnInterval > 650) {
        CFG.spawnInterval = Math.max(650, Math.round(CFG.spawnInterval * 0.94));
      }
      // ถ้าพลาดบ่อย → ช้าลงนิด
      if (hitRate <= CFG.targetHitLow && CFG.spawnInterval < 1300) {
        CFG.spawnInterval = Math.min(1300, Math.round(CFG.spawnInterval * 1.06));
      }
    }
  }

  // ---------- quest update ----------
  function emitQuestUpdate() {
    if (!quest) return;

    const goalsAll = quest.goals || [];
    const minisAll = quest.minis || [];

    const goal = goalsAll.find(g => g && !g.done) || null;

    // mini = active mini ตัวเดียว
    const mini = (typeof quest.getActiveMini === 'function')
      ? quest.getActiveMini()
      : (minisAll.find(m => m && !m.done && !m.failed) || null);

    const g = (quest.getActiveGroup && quest.getActiveGroup()) ? quest.getActiveGroup() : null;

    dispatch('quest:update', {
      goal: goal ? { label: goal.label, prog: goal.prog, target: goal.target } : null,
      mini: mini ? {
        label: mini.label,
        prog: mini.prog,
        target: mini.target,
        timeLeftSec: (typeof mini.timeLeftSec === 'number') ? mini.timeLeftSec : undefined
      } : null,
      goalsAll,
      minisAll,
      groupLabel: g ? g.label : undefined
    });

    // celebrate goal
    const goalsCleared = goalsAll.filter(g2 => g2 && g2.done).length;
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
    const minisCleared = minisAll.filter(m2 => m2 && m2.done).length;
    if (minisCleared !== miniIndexShown && minisCleared > 0) {
      miniIndexShown = minisCleared;
      dispatch('hha:celebrate', {
        type: 'mini',
        index: minisCleared,
        total: minisAll.length,
        label: 'MINI CLEAR!'
      });
    }

    // all complete
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

  // ---------- spawn ----------
  function canSpawnNow() {
    if (!running) return false;
    if (!layerEl) return false;
    if (now() < freezeUntil) return false;
    return true;
  }

  function currentMaxActive() {
    return CFG.maxActive + (bossMode ? (CFG.bossMaxActiveBonus | 0) : 0);
  }

  function pickEmoji(g, good) {
    if (good) {
      if (g && Array.isArray(g.emojis) && g.emojis.length) {
        return g.emojis[randInt(0, g.emojis.length - 1)];
      }
      return CFG.emojisGood[randInt(0, CFG.emojisGood.length - 1)];
    }
    return CFG.emojisJunk[randInt(0, CFG.emojisJunk.length - 1)];
  }

  function createTarget() {
    if (!canSpawnNow()) return;
    if (active.length >= currentMaxActive()) return;

    const g = (quest && quest.getActiveGroup) ? quest.getActiveGroup() : null;

    // good ratio (ให้เด็กสนุก) + บอสท้ายเกมเพิ่มความกดดัน
    const goodRatio = bossMode ? 0.68 : 0.75;
    const good = Math.random() < goodRatio;

    // golden target (เป็น good เสมอ)
    const goldenChance = (bossMode ? Math.min(0.14, CFG.goldenChance + 0.06) : CFG.goldenChance);
    const isGolden = (good && Math.random() < goldenChance);

    let emoji = isGolden ? '🌟' : pickEmoji(g, good);

    const el = document.createElement('div');
    el.className = 'fg-target ' + (good ? 'fg-good' : 'fg-junk');
    el.setAttribute('data-emoji', emoji);
    if (isGolden) el.classList.add('fg-golden');

    const p = pickScreenPos();
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';

    layerEl.appendChild(el);

    const t = {
      el,
      good: good,
      emoji,
      golden: isGolden,
      alive: true,
      canExpire: false,
      bornAt: now(),
      minTimer: null,
      lifeTimer: null
    };
    active.push(t);

    // MIN VISIBLE LOCK
    t.minTimer = setTimeout(() => { t.canExpire = true; }, CFG.minVisible);

    // HARD EXPIRE
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

  // ---------- perfect/freeze ----------
  function triggerFreeze() {
    freezeUntil = now() + (CFG.freezeMs | 0);
    dispatch('hha:judge', {
      label: 'FREEZE',
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.40,
      good: true
    });
    Particles.scorePop && Particles.scorePop(window.innerWidth / 2, window.innerHeight * 0.40, '❄️', { judgment: 'FREEZE', good: true });
    coach('โห! PERFECT 3 ติดเลย ❄️ แช่แข็ง 2 วิ!');
  }

  // ---------- boss ----------
  function maybeBoss() {
    const last = (CFG.bossLastSec | 0);
    if (bossMode) return;

    if (typeof timeLeftSec === 'number' && timeLeftSec <= last) {
      bossMode = true;
      if (!bossAnnounced) {
        bossAnnounced = true;
        coach('บอสมาแล้ววว! 🔥 10 วิท้าย คะแนน x2!');
        dispatch('hha:judge', { label: 'BOSS', x: window.innerWidth / 2, y: window.innerHeight * 0.30, good: true });
      }
    }
  }

  // ---------- hit/expire ----------
  function hitTarget(t) {
    if (!running || !t || !t.alive) return;

    const pos = centerXY(t.el);
    const dt = now() - (t.bornAt || now());
    const isPerfect = (t.good && (feverOn || dt <= CFG.perfectTimeMs) && !t.golden);

    if (t.good) {
      destroyTarget(t, true);

      // points
      let pts = feverOn ? CFG.pointsGoodFever : CFG.pointsGood;

      if (bossMode) pts = (pts * (CFG.pointsGoodBossMul | 0)) | 0;

      // golden
      if (t.golden) {
        pts = (CFG.goldenPoints | 0);
        if (bossMode) pts = (pts * 2) | 0;
        setFeverValue(fever + (CFG.goldenFeverGain | 0));
      } else {
        setFeverValue(fever + CFG.feverGainGood);
      }

      addScore(pts);
      setCombo(combo + 1);

      maybeEnterFever();

      // quest update
      if (quest && typeof quest.onGoodHit === 'function') {
        const gid = (t.golden ? (quest.getActiveGroup ? (quest.getActiveGroup().key || 1) : 1) : emojiToGroupId(t.emoji));
        quest.onGoodHit(gid, combo);
      }

      // perfect / freeze
      if (t.golden) {
        perfectStreak = 0;
        dispatch('hha:judge', { label: 'GOLDEN', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: 'GOLDEN', good: true });
      } else if (isPerfect) {
        perfectStreak++;
        dispatch('hha:judge', { label: 'PERFECT', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: 'PERFECT', good: true });

        if (perfectStreak >= (CFG.freezeNeed | 0)) {
          perfectStreak = 0;
          triggerFreeze();
        }
      } else {
        perfectStreak = 0;
        dispatch('hha:judge', { label: feverOn ? 'PERFECT' : 'GOOD', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: feverOn ? 'PERFECT' : 'GOOD', good: true });
      }

      pushPerf(true, !!isPerfect);
      maybeAdaptive();

    } else {
      destroyTarget(t, true);

      if (shield > 0) {
        setShieldValue(shield - 1);

        // quest hook: blocked = true (ไม่เป็น miss / mini no-junk ไม่ควรนับ)
        if (quest && typeof quest.onJunkHit === 'function') {
          quest.onJunkHit(emojiToGroupId(t.emoji), true);
        }

        dispatch('hha:judge', { label: 'BLOCK', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment: 'BLOCK', good: true });
        coach('โล่กันไว้แล้ว! ระวังขยะนะ 🛡️');

        pushPerf(true, false); // ถือว่ารอด
        maybeAdaptive();
      } else {
        addMiss();
        addScore(CFG.pointsJunkHit);
        setCombo(0);
        setFeverValue(fever - CFG.feverLossMiss);

        // quest hook: blocked = false (โดนจริง)
        if (quest && typeof quest.onJunkHit === 'function') {
          quest.onJunkHit(emojiToGroupId(t.emoji), false);
        }

        perfectStreak = 0;
        dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsJunkHit), { judgment: 'MISS', good: false });
        coach('โอ๊ะ! โดนขยะแล้ว 😵 เล็งอาหารดีก่อนนะ');

        pushPerf(false, false);
        maybeAdaptive();
      }
    }

    // log-friendly hooks
    dispatch('groups:hit', { emoji: t.emoji, good: t.good, golden: !!t.golden, x: pos.x, y: pos.y });

    emitQuestUpdate();
  }

  function expireTarget(t) {
    if (!running || !t || !t.alive) return;
    if (!t.canExpire) return;

    // ถ้ากำลัง freeze → ขยายเวลาให้อยู่ต่อ
    if (now() < freezeUntil) {
      // postpone
      setTimeout(() => expireTarget(t), 220);
      return;
    }

    const pos = centerXY(t.el);
    destroyTarget(t, false);

    // expire = miss เฉพาะ "good หลุด" (golden หลุดนับเป็น miss หนักกว่า)
    if (t.good) {
      addMiss();

      const penalty = t.golden ? (CFG.pointsGoodExpire * 2) : CFG.pointsGoodExpire;
      addScore(penalty);

      setCombo(0);
      setFeverValue(fever - CFG.feverLossMiss);

      perfectStreak = 0;
      dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(penalty), { judgment: 'MISS', good: false });

      pushPerf(false, false);
      maybeAdaptive();
    } else {
      addScore(CFG.pointsJunkExpire);
    }

    dispatch('groups:expire', { emoji: t.emoji, good: t.good, golden: !!t.golden, x: pos.x, y: pos.y });

    emitQuestUpdate();
  }

  // ---------- loops ----------
  function scheduleNextSpawn() {
    if (!running) return;
    clearTimeout(spawnTimer);

    const base = bossMode ? CFG.bossSpawnInterval : CFG.spawnInterval;

    // ระหว่าง freeze ให้รอ
    const waitFreeze = Math.max(0, freezeUntil - now());
    const delay = waitFreeze > 0 ? (waitFreeze + 30) : base;

    spawnTimer = setTimeout(() => {
      createTarget();
      scheduleNextSpawn();
    }, delay);
  }

  function startSecondLoop() {
    clearInterval(secondTimer);
    secondTimer = setInterval(() => {
      if (!running) return;

      tickFever();
      maybeBoss();

      if (quest && typeof quest.second === 'function') quest.second();

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

    perfWindow.length = 0;
    lastAdaptiveAt = 0;

    freezeUntil = 0;
    perfectStreak = 0;

    bossMode = false;
    bossAnnounced = false;

    setScale(baseScale);
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

    setTimeLeft(sec) {
      timeLeftSec = (sec == null) ? timeLeftSec : (sec | 0);
      // boss check แบบ realtime
      if (running) maybeBoss();
    },

    start(diff = 'normal', opts = {}) {
      layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;
      if (!layerEl) {
        console.error('[FoodGroupsVR] layerEl missing');
        return;
      }

      diffKey = String(diff || 'normal').toLowerCase();
      runMode = String((opts && opts.runMode) || 'play').toLowerCase();
      if (runMode !== 'research') runMode = 'play';

      durationSec = (opts && opts.durationSec) ? (opts.durationSec | 0) : durationSec;
      timeLeftSec = durationSec;

      // optional override config
      if (opts && opts.config) Object.assign(CFG, opts.config);

      applyDifficulty(diffKey);
      resetState();

      // fever HUD init
      FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
      FeverUI.setFever && FeverUI.setFever(0);
      FeverUI.setFeverActive && FeverUI.setFeverActive(false);
      FeverUI.setShield && FeverUI.setShield(0);

      // quest init
      if (QuestFactory && typeof QuestFactory.createFoodGroupsQuest === 'function') {
        quest = QuestFactory.createFoodGroupsQuest(diffKey, runMode);
      } else {
        quest = null;
        console.warn('[FoodGroupsVR] quest-manager not found: window.GroupsQuest.createFoodGroupsQuest');
      }

      // first coach
      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      coach(runMode === 'research'
        ? `โหมดวิจัย: ขนาดเป้าคงที่ (${diffKey.toUpperCase()}) เริ่มที่: ${g ? g.label : 'Food Groups'} ✨`
        : `โหมดเล่น: เริ่มเลย! เก็บอาหารดี: ${g ? g.label : 'Food Groups'} 🔥`);

      emitQuestUpdate();

      running = true;
      startSecondLoop();
      scheduleNextSpawn();

      // spawn แรกทันที 1–2 ตัว
      createTarget();
      setTimeout(() => createTarget(), Math.min(260, CFG.spawnInterval * 0.35));

      dispatch('hha:score', { score, combo, misses, shield, fever });
    },

    stop(reason) {
      stopAll(reason || 'stop');
    }
  };

})();