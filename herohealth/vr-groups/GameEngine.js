// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION SAFE ENGINE (NO-FLASH + HIT 100% + QUEST + FX + FEVER + ADAPTIVE SIZE)
// DOM target layer (ไม่ใช่ A-Frame target) — เล่นได้ทั้งมือถือ/PC
//
// ✅ Research mode: size “ล็อกตาม diff เท่านั้น” (no adaptive)
// ✅ Play mode: size “เริ่มตาม diff แล้ว adaptive ตามความสามารถ”
// ✅ Adaptive อิง: combo, fever, miss, hit-rate, reaction-time, timeLeft
//
// API:
//   window.GroupsVR.GameEngine.start(diff, { layerEl?, runMode?, config? })
//   window.GroupsVR.GameEngine.stop(reason?)
//   window.GroupsVR.GameEngine.setLayerEl(el)
//
// Events ที่ยิงออก:
//   - hha:score   { score, combo, misses, shield, fever }
//   - hha:judge   { label, x, y, good, emoji }
//   - quest:update{ goal, mini, goalsAll, minisAll }
//   - hha:coach   { text }
//   - hha:celebrate { type:'goal'|'mini'|'all', index, total, label }
//   - hha:adaptive { runMode, diff, tier, sizePx, spawnInterval, maxActive, minVisible, lifeMin, lifeMax }
//   - hha:end     { reason, scoreFinal, comboMax, misses, goalsTotal, goalsCleared, miniTotal, miniCleared }
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

  // timeLeft from page (hha:time)
  let timeLeft = 0;
  let onTimeHandler = null;

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

  // run mode + diff
  let RUN_MODE = 'play'; // 'play' | 'research'
  let DIFF = 'normal';

  // adaptive state (play only)
  let sizePx = 132;
  let tier = 0; // -2..+2
  let hitCount = 0;
  let goodHits = 0;
  let junkHits = 0;
  let goodExpires = 0;

  // rolling performance window
  const perf = {
    window: [], // {good, hit, rtMs, ts}
    max: 14
  };

  // ---------- config ----------
  const CFG = {
    // spawn base
    spawnInterval: 900,
    maxActive: 4,

    // visibility policy
    minVisible: 2000,
    lifeTime: [3800, 5200],

    // size (base by diff) — research lock uses these only
    sizeByDiff: { easy: 150, normal: 132, hard: 118 },

    // adaptive bounds (play)
    sizeMin: 96,
    sizeMax: 168,

    // anti-overlap
    minDistFactor: 0.85, // * sizePx

    // emoji pools (fallback)
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

    // adaptive tuning cadence
    adaptiveEveryHits: 6,
    adaptiveMinHitsBefore: 8
  };

  function applyDifficulty(diff) {
    diff = String(diff || 'normal').toLowerCase();
    DIFF = diff;

    if (diff === 'easy') {
      CFG.spawnInterval = 1200;
      CFG.maxActive = 3;
      CFG.minVisible = 2600;
      CFG.lifeTime = [5200, 7200];
      CFG.feverGainGood = 16;
      CFG.feverLossMiss = 16;
    } else if (diff === 'hard') {
      CFG.spawnInterval = 760;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4700];
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
    } else { // normal
      CFG.spawnInterval = 920;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3900, 5600];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
    }

    // base size by diff
    sizePx = CFG.sizeByDiff[diff] || 132;
    tier = 0;
  }

  function pickScreenPosAvoidOverlap() {
    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    // กัน HUD บน/ล่าง
    const marginX = Math.min(170, Math.round(w * 0.16));
    const marginYTop = Math.min(240, Math.round(h * 0.24));
    const marginYBot = Math.min(180, Math.round(h * 0.20));

    const minDist = Math.max(70, (sizePx * CFG.minDistFactor) | 0);

    for (let tries = 0; tries < 10; tries++) {
      const x = randInt(marginX, w - marginX);
      const y = randInt(marginYTop, h - marginYBot);

      let ok = true;
      for (let i = 0; i < active.length; i++) {
        const t = active[i];
        if (!t || !t.alive) continue;
        const dx = (t.x || 0) - x;
        const dy = (t.y || 0) - y;
        if (Math.hypot(dx, dy) < minDist) { ok = false; break; }
      }
      if (ok) return { x, y };
    }

    // fallback
    return {
      x: randInt(marginX, w - marginX),
      y: randInt(marginYTop, h - marginYBot)
    };
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

    // ❗ห้ามลบก่อนเวลา (ยกเว้น hit)
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

    // ได้เกราะเมื่อเข้า fever
    setShieldValue(shield + (CFG.shieldPerFever | 0));

    dispatch('hha:judge', {
      label: 'FEVER',
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.52,
      good: true
    });

    // reset fever bar ให้ไต่ใหม่
    setFeverValue(0);
    coach('เข้า FEVER แล้ววว! รีบเก็บอาหารดีรัว ๆ 🔥');
  }

  function tickFever() {
    if (!feverOn) return;
    if (now() >= feverEndsAt) {
      setFeverActive(false);
      coach('หมด FEVER แล้ว! ตั้งสติแล้วลุยต่อ 😄');
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
      minisAll
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
      coach('เคลียร์ทุกภารกิจแล้ว! โหดมากกก 🎉');
    }
  }

  function emojiToGroupId(emoji) {
    if (quest && typeof quest.getActiveGroup === 'function') {
      const g = quest.getActiveGroup();
      if (g && Array.isArray(g.emojis) && g.emojis.includes(emoji)) return g.key || 1;
    }
    return 1;
  }

  // ---------- ADAPTIVE ----------
  function pushPerfSample(sample) {
    perf.window.push(sample);
    while (perf.window.length > perf.max) perf.window.shift();
  }

  function perfStats() {
    const w = perf.window;
    if (!w.length) return { acc: 0, rt: 9999, n: 0, hitRate: 0 };

    let hits = 0, correct = 0, rtSum = 0, rtN = 0;
    let firstTs = w[0].ts, lastTs = w[w.length - 1].ts;

    for (let i = 0; i < w.length; i++) {
      const s = w[i];
      if (s.hit) hits++;
      if (s.hit && s.good) correct++;
      if (typeof s.rtMs === 'number' && s.rtMs > 0) { rtSum += s.rtMs; rtN++; }
    }
    const acc = hits ? (correct / hits) : 0;
    const rt = rtN ? (rtSum / rtN) : 9999;
    const dt = Math.max(0.5, (lastTs - firstTs) / 1000);
    const hitRate = hits / dt; // hits/sec ใน window ล่าสุด

    return { acc, rt, n: w.length, hitRate };
  }

  function applyTierToDifficulty() {
    // tier: -2..+2
    // เด็ก ป.5: ทำให้ “เก่งขึ้น = เล็กลง/เร็วขึ้น/มากขึ้น” แบบค่อยเป็นค่อยไป
    const t = clamp(tier, -2, 2);

    // size: 1 step ~ 10px
    const base = (CFG.sizeByDiff[DIFF] || 132);
    const target = base + (t * -10); // tier + => ยากขึ้น => size ลด
    sizePx = clamp(target, CFG.sizeMin, CFG.sizeMax);

    // spawn pace: ยากขึ้นลด interval
    const baseInterval = (DIFF === 'easy') ? 1200 : (DIFF === 'hard') ? 760 : 920;
    const interval = clamp(baseInterval + (t * -70), 620, 1400);
    CFG.spawnInterval = interval;

    // maxActive: ยากขึ้นเพิ่มจำนวน
    const baseMax = (DIFF === 'easy') ? 3 : (DIFF === 'hard') ? 5 : 4;
    CFG.maxActive = clamp(baseMax + (t >= 1 ? 1 : 0) + (t >= 2 ? 1 : 0), 3, 7);

    // life/minVisible: ยากขึ้นทำให้หายไวขึ้นเล็กน้อย แต่ยังไม่แว๊บ
    const baseMinVis = (DIFF === 'easy') ? 2600 : (DIFF === 'hard') ? 1600 : 2000;
    CFG.minVisible = clamp(baseMinVis + (t * -120), 1200, 3200);

    const baseLifeMin = (DIFF === 'easy') ? 5200 : (DIFF === 'hard') ? 3200 : 3900;
    const baseLifeMax = (DIFF === 'easy') ? 7200 : (DIFF === 'hard') ? 4700 : 5600;

    CFG.lifeTime = [
      clamp(baseLifeMin + (t * -180), 1800, 9000),
      clamp(baseLifeMax + (t * -220), 2400, 11000)
    ];

    dispatch('hha:adaptive', {
      runMode: RUN_MODE,
      diff: DIFF,
      tier: t,
      sizePx,
      spawnInterval: CFG.spawnInterval,
      maxActive: CFG.maxActive,
      minVisible: CFG.minVisible,
      lifeMin: CFG.lifeTime[0],
      lifeMax: CFG.lifeTime[1]
    });
  }

  function maybeAdaptiveTune() {
    if (RUN_MODE !== 'play') return;
    if (hitCount < CFG.adaptiveMinHitsBefore) return;
    if (hitCount % CFG.adaptiveEveryHits !== 0) return;

    const s = perfStats();

    // signals
    const doingGreat =
      (combo >= 5) ||
      (s.acc >= 0.78 && s.rt <= 950) ||
      (feverOn) ||
      (s.hitRate >= 1.1);

    const struggling =
      (s.acc <= 0.55 && s.n >= 10) ||
      (s.rt >= 1350 && s.n >= 8) ||
      (misses >= 3 && goodHits < 10);

    // time pressure: ช่วงท้าย “เร้าใจ” เพิ่มนิด แต่ไม่ทำให้ยากเกิน
    const clutch = (timeLeft > 0 && timeLeft <= 12);

    if (doingGreat && !struggling) {
      tier = clamp(tier + 1, -2, 2);
    } else if (struggling && !doingGreat) {
      tier = clamp(tier - 1, -2, 2);
    } else {
      // คงที่
    }

    // clutch: เพิ่มความเร็วเล็กน้อย (แต่ไม่ลด size เพิ่ม)
    if (clutch) {
      CFG.spawnInterval = clamp(CFG.spawnInterval - 60, 560, 1400);
      CFG.maxActive = clamp(CFG.maxActive + 1, 3, 7);
    }

    applyTierToDifficulty();

    // โค้ชช่วยกระตุ้นแบบเด็ก ป.5
    if (tier >= 2) coach('โหดมาก! รอบนี้ “โปร” แล้วนะ 😎✨');
    else if (tier <= -2) coach('ไม่เป็นไร ค่อย ๆ เอาใหม่! ลองโฟกัสอาหารดี 🥦');
    else if (clutch) coach('เหลือเวลาน้อยแล้วว! รีบเก็บให้ทัน! ⏱️🔥');
  }

  function lockResearchSizeOnly() {
    // research = ล็อกตาม diff เท่านั้น (ไม่ปรับตามความสามารถ)
    sizePx = CFG.sizeByDiff[DIFF] || 132;

    // research pace: ให้เทียบได้ในการทดลอง
    if (DIFF === 'easy') {
      CFG.spawnInterval = 1200;
      CFG.maxActive = 3;
      CFG.minVisible = 2600;
      CFG.lifeTime = [5200, 7200];
    } else if (DIFF === 'hard') {
      CFG.spawnInterval = 760;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4700];
    } else {
      CFG.spawnInterval = 920;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3900, 5600];
    }

    dispatch('hha:adaptive', {
      runMode: RUN_MODE,
      diff: DIFF,
      tier: 0,
      sizePx,
      spawnInterval: CFG.spawnInterval,
      maxActive: CFG.maxActive,
      minVisible: CFG.minVisible,
      lifeMin: CFG.lifeTime[0],
      lifeMax: CFG.lifeTime[1]
    });
  }

  // ---------- spawn / targets ----------
  function createTarget() {
    if (!running || !layerEl) return;
    if (active.length >= CFG.maxActive) return;

    // active food group (จาก quest)
    const g = (quest && quest.getActiveGroup) ? quest.getActiveGroup() : null;

    // เลือก emoji
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

    // ✅ size via CSS var
    el.style.setProperty('--fg-size', (sizePx | 0) + 'px');

    const p = pickScreenPosAvoidOverlap();
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
      lifeTimer: null,
      x: p.x,
      y: p.y
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

  function hitTarget(t) {
    if (!running || !t || !t.alive) return;

    const pos = centerXY(t.el);
    const rt = Math.max(0, now() - (t.bornAt || now()));

    hitCount++;

    if (t.good) {
      goodHits++;
      destroyTarget(t, true);

      const pts = feverOn ? CFG.pointsGoodFever : CFG.pointsGood;
      addScore(pts);
      setCombo(combo + 1);

      // fever gain
      setFeverValue(fever + CFG.feverGainGood);
      maybeEnterFever();

      // quest update
      if (quest && typeof quest.onGoodHit === 'function') {
        const gid = emojiToGroupId(t.emoji);
        quest.onGoodHit(gid, combo);
      }

      dispatch('hha:judge', { label: feverOn ? 'PERFECT' : 'GOOD', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: feverOn ? 'PERFECT' : 'GOOD', good: true });

      pushPerfSample({ hit: true, good: true, rtMs: rt, ts: now() });

    } else {
      junkHits++;
      destroyTarget(t, true);

      if (shield > 0) {
        setShieldValue(shield - 1);

        dispatch('hha:judge', { label: 'BLOCK', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment: 'BLOCK', good: true });
        coach('โล่กันไว้แล้ว! เล็งอาหารดีต่อเลย 🛡️');

        // ถือว่า hit แต่ไม่ใช่ good
        pushPerfSample({ hit: true, good: false, rtMs: rt, ts: now() });

      } else {
        // miss: junk hit
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

        pushPerfSample({ hit: true, good: false, rtMs: rt, ts: now() });
      }
    }

    dispatch('groups:hit', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y, rtMs: rt });

    emitQuestUpdate();
    maybeAdaptiveTune();
  }

  function expireTarget(t) {
    if (!running || !t || !t.alive) return;
    if (!t.canExpire) return;

    const pos = centerXY(t.el);
    destroyTarget(t, false);

    // expire = miss เฉพาะ good หลุด
    if (t.good) {
      goodExpires++;
      addMiss();
      addScore(CFG.pointsGoodExpire);
      setCombo(0);
      setFeverValue(fever - CFG.feverLossMiss);

      dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsGoodExpire), { judgment: 'MISS', good: false });

      pushPerfSample({ hit: false, good: true, rtMs: null, ts: now() });
    } else {
      addScore(CFG.pointsJunkExpire);
      pushPerfSample({ hit: false, good: false, rtMs: null, ts: now() });
    }

    dispatch('groups:expire', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y });

    emitQuestUpdate();
    maybeAdaptiveTune();
  }

  function scheduleNextSpawn() {
    if (!running) return;
    clearTimeout(spawnTimer);

    spawnTimer = setTimeout(() => {
      createTarget();

      // ✅ ช่วงเร้าใจ: ถ้า fever หรือ clutch ให้มีโอกาส “เติมอีก 1”
      const clutch = (timeLeft > 0 && timeLeft <= 12);
      if ((feverOn || clutch) && active.length < CFG.maxActive && Math.random() < 0.35) {
        setTimeout(() => createTarget(), 90);
      }

      scheduleNextSpawn();
    }, CFG.spawnInterval);
  }

  function startSecondLoop() {
    clearInterval(secondTimer);
    secondTimer = setInterval(() => {
      if (!running) return;

      tickFever();

      if (quest && typeof quest.second === 'function') {
        quest.second();
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

    RUN_MODE = 'play';
    timeLeft = 0;

    sizePx = 132;
    tier = 0;
    hitCount = 0;
    goodHits = 0;
    junkHits = 0;
    goodExpires = 0;

    perf.window.length = 0;
  }

  function unbindTimeListener() {
    if (onTimeHandler) {
      try { window.removeEventListener('hha:time', onTimeHandler); } catch {}
      onTimeHandler = null;
    }
  }

  function stopAll(reason) {
    running = false;

    clearTimeout(spawnTimer);
    spawnTimer = null;

    clearInterval(secondTimer);
    secondTimer = null;

    unbindTimeListener();

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

      // optional override
      if (opts && opts.config) Object.assign(CFG, opts.config);

      resetState();
      applyDifficulty(diff);

      RUN_MODE = String((opts && opts.runMode) ? opts.runMode : 'play').toLowerCase();
      if (RUN_MODE !== 'research') RUN_MODE = 'play';

      // listen to time left from page
      unbindTimeListener();
      onTimeHandler = (e) => {
        const d = (e && e.detail) || {};
        const sec = (d.sec | 0);
        if (sec >= 0) timeLeft = sec;
      };
      window.addEventListener('hha:time', onTimeHandler);

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

      // ✅ MODE RULES
      if (RUN_MODE === 'research') {
        lockResearchSizeOnly(); // size+pace lock by diff
        coach('โหมดวิจัย: ขนาดเป้าล็อกตามระดับเท่านั้น 🧪');
      } else {
        applyTierToDifficulty(); // initialize tier 0
        coach('โหมดเล่น: เก็บดีให้รัว! เกมจะปรับความยากตามฝีมือ 😄🔥');
      }

      // first coach (group)
      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      if (g) coach(`เริ่มเลย! โฟกัส ${g.label} ✨`);

      // show initial quest panel
      emitQuestUpdate();

      running = true;
      startSecondLoop();
      scheduleNextSpawn();

      // spawn แรกทันที 1–2 ตัว (ให้รู้สึก “เริ่มแล้ว!”)
      createTarget();
      setTimeout(() => createTarget(), Math.min(260, CFG.spawnInterval * 0.35));

      // push initial score
      dispatch('hha:score', { score, combo, misses, shield, fever });
    },

    stop(reason) {
      stopAll(reason || 'stop');
    }
  };

})();