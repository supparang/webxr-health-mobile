// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION SAFE ENGINE (NO-FLASH + HIT 100% + QUEST + FX + FEVER + RANK + ADAPTIVE)
// DOM target layer (ไม่ใช่ A-Frame target) — เล่นได้ทั้งมือถือ/PC
//
// API:
//   window.GroupsVR.GameEngine.start(diff, { layerEl?, runMode?, config? })
//   window.GroupsVR.GameEngine.stop(reason?)
//   window.GroupsVR.GameEngine.setLayerEl(el)
//
// Events ที่ยิงออก:
//   - hha:score   { score, combo, misses, shield, fever }
//   - hha:judge   { label, x, y, good, emoji }
//   - quest:update{ goal, mini, goalsAll, minisAll, groupLabel, groupKey }
//   - hha:coach   { text }
//   - hha:celebrate { kind:'goal'|'mini'|'all', type:'goal'|'mini'|'all', index, total, label }
//   - hha:rank    { grade, scorePerSec, accuracy, questsPct }
//   - hha:end     { reason, scoreFinal, comboMax, misses, goalsTotal, goalsCleared, miniTotal, miniCleared, grade }
//
// Miss policy:
//   miss = good expired (ปล่อยของดีหลุด) + junk hit (โดนขยะ)
//   * ถ้าโดนขยะตอนมี Shield แล้วกันไว้ → ไม่ถือเป็น miss
//
// Size policy:
//   - โหมดธรรมดา (runMode='play'):
//       ขนาดเริ่มต้นตาม diff (easy/normal/hard) + ADAPTIVE ตามความสามารถ (ทำให้สนุก/ท้าทายขึ้น)
//   - โหมดวิจัย (runMode='research'):
//       ล็อกขนาดตาม diff เท่านั้น (ไม่ adaptive)

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

  function normalizeGrade(g){
    const x = String(g || '').toUpperCase().trim();
    if (x === 'SSS' || x === 'SS' || x === 'S' || x === 'A' || x === 'B' || x === 'C') return x;
    return 'C';
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

  // hit stats
  let goodHits = 0;
  let junkHits = 0;
  let goodExpires = 0;
  let junkExpires = 0;
  let startedAt = 0;

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

  // rank
  let lastGrade = 'C';

  // adaptive (เฉพาะ play)
  let skill = 0;                 // -100..100
  let sizeMul = 1.0;             // ปรับขนาดเป้า
  let adaptiveTick = 0;          // นับวินาที
  let consecutiveGood = 0;

  // ---------- config ----------
  const CFG = {
    // spawn
    spawnInterval: 900,
    maxActive: 4,

    // visibility policy
    minVisible: 2000,
    lifeTime: [3800, 5200],

    // size base (px)
    targetSizePx: 132,            // จะถูกตั้งตาม diff ตอน start()
    targetSizeMinMul: 0.78,       // clamp เฉพาะ play
    targetSizeMaxMul: 1.18,

    // emoji pools (fallback)
    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚','🍞','🥔','🍊'],
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕'],

    // scoring
    pointsGood: 10,
    pointsGoodFever: 14,
    pointsJunkHit: -8,           // โดนขยะ (ไม่มี shield)
    pointsGoodExpire: -4,        // ปล่อยของดีหลุด
    pointsJunkExpire: 0,

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

    // excitement
    coachHypeEveryCombo: 6,       // ทุก ๆ กี่คอมโบ โค้ชปลุกใจ
    feverHype: true
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
    } else { // normal
      CFG.spawnInterval = 900;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
      CFG.targetSizePx = 132;
    }
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

    if (CFG.feverHype) coach('🔥 FEVER TIME! แตะรัว ๆ เลยยย!');

    // reset fever bar
    setFeverValue(0);
  }

  function tickFever() {
    if (!feverOn) return;
    if (now() >= feverEndsAt) {
      setFeverActive(false);
      coach('เฟเวอร์หมดแล้ว! ตั้งใจต่อ! ✨');
    }
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

  // ---------- quest / celebrate ----------
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
      groupLabel: g ? g.label : '',
      groupKey: g ? (g.key || 0) : 0
    });

    const goalsCleared = goalsAll.filter(x => x && x.done).length;
    if (goalsCleared !== goalIndexShown && goalsCleared > 0) {
      goalIndexShown = goalsCleared;
      dispatch('hha:celebrate', {
        kind: 'goal', type: 'goal',
        index: goalsCleared,
        total: goalsAll.length,
        label: 'GOAL CLEAR!'
      });
      coach('🎯 GOAL ผ่านแล้ว! สุดยอด!');
    }

    const minisCleared = minisAll.filter(x => x && x.done).length;
    if (minisCleared !== miniIndexShown && minisCleared > 0) {
      miniIndexShown = minisCleared;
      dispatch('hha:celebrate', {
        kind: 'mini', type: 'mini',
        index: minisCleared,
        total: minisAll.length,
        label: 'MINI CLEAR!'
      });
      coach('⭐ MINI ผ่าน! เก่งมาก!');
    }

    if (!allClearedShown && goalsCleared === goalsAll.length && minisCleared === minisAll.length) {
      allClearedShown = true;
      dispatch('hha:celebrate', { kind: 'all', type: 'all' });
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

  // ---------- adaptive (play only) ----------
  function clampSkill(v){
    const c = CFG.skillClamp | 0;
    return clamp(v, -c, c);
  }

  function updateAdaptiveSoon(){
    if (runMode !== 'play') return;
    if (!CFG.adaptiveEnabledPlay) return;

    // ปรับทุก ๆ N วินาที
    adaptiveTick++;
    if (adaptiveTick % (CFG.adaptiveEverySec | 0) !== 0) return;

    // skill -> sizeMul (ง่ายขึ้น = เป้าใหญ่ขึ้น)
    // skill > 0 แปลว่าเล่นเก่ง → ลดขนาดลงนิด + เพิ่มความหนาแน่นนิด
    const t = clampSkill(skill) / (CFG.skillClamp || 100); // -1..1
    // sizeMul: จาก 1.10 (ยังไม่เก่ง) ไป 0.90 (เก่งมาก)
    sizeMul = clamp(1.0 - (t * 0.10), CFG.targetSizeMinMul, CFG.targetSizeMaxMul);

    // จูน spawn ตาม skill (สนุก/เร้าใจขึ้น)
    // เก่งมาก → spawn ถี่ขึ้นเล็กน้อย, maxActive เพิ่มนิด
    const baseSI = CFG.spawnInterval;
    const baseMA = CFG.maxActive;

    const si = clamp(baseSI * (1.0 - (t * 0.12)), 520, 1600);
    const ma = clamp(baseMA + (t > 0.55 ? 1 : 0) + (t > 0.85 ? 1 : 0), 2, 7);

    CFG.spawnInterval = Math.round(si);
    CFG.maxActive = Math.round(ma);

    // โค้ชปลุกใจ
    if (t > 0.65) coach('สปีดเพิ่มแล้วนะ! เก่งขึ้นแล้ว! ⚡');
    else if (t < -0.45) coach('ค่อย ๆ เล็งนะ โค้ชเพิ่มเวลาให้แล้ว ✨');
  }

  function applyTargetSizeToEl(el){
    if (!el) return;
    const base = CFG.targetSizePx | 0;
    const mul = (runMode === 'play') ? (sizeMul || 1.0) : 1.0; // research = fixed
    const s = clamp(Math.round(base * mul), 96, 168);
    el.style.width = s + 'px';
    el.style.height = s + 'px';
  }

  // ---------- RANK (SSS/SS/S/A/B/C) ----------
  function accuracy() {
    const total = goodHits + junkHits + goodExpires; // junkExpire ไม่นับ
    if (total <= 0) return 0;
    // accuracy: good hit เป็น +, miss (junk hit + good expire) เป็น -
    const good = goodHits;
    return clamp(good / total, 0, 1);
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
    // ✅ เน้น “สนุกแบบป.5”: ทำเควสสำคัญสุด, ตามด้วยความแม่นและสปีด
    // เกณฑ์นี้ปรับได้ แต่จะออก 6 ระดับเท่านั้น
    const q = qp;           // 0..1
    const a = acc;          // 0..1
    const p = clamp(sps / 3.0, 0, 1); // normalize โดยประมาณ (3 คะแนน/วิ = เก่งมาก)
    const m = clamp(missCount / 12, 0, 1); // miss เยอะ → ลด

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

  // ---------- targets ----------
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

    // size (diff base + adaptive)
    applyTargetSizeToEl(el);

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

    // MIN VISIBLE
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

    if (t.good) {
      destroyTarget(t, true);

      goodHits++;
      consecutiveGood++;

      const isPerfect = feverOn || (consecutiveGood >= 6); // ให้มี “perfect” แบบป.5 เร้าใจ
      const pts = feverOn ? CFG.pointsGoodFever : CFG.pointsGood;

      addScore(pts);
      setCombo(combo + 1);

      // fever gain
      setFeverValue(fever + CFG.feverGainGood);
      maybeEnterFever();

      // quest
      if (quest && typeof quest.onGoodHit === 'function') {
        const gid = emojiToGroupId(t.emoji);
        quest.onGoodHit(gid, combo);
      }

      // judge + fx
      const label = isPerfect ? 'PERFECT' : 'GOOD';
      dispatch('hha:judge', { label, x: pos.x, y: pos.y, good: true, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: label, good: true });

      // skill up (play only)
      if (runMode === 'play') {
        skill = clampSkill(skill + (isPerfect ? CFG.skillGainPerfect : CFG.skillGainGood));
      }

      // coach hype
      if (CFG.coachHypeEveryCombo && combo > 0 && (combo % CFG.coachHypeEveryCombo === 0)) {
        coach(`คอมโบ ${combo} แล้ว! โคตรเก่ง! 🚀`);
      }

    } else {
      destroyTarget(t, true);

      consecutiveGood = 0;

      if (shield > 0) {
        // block (not miss)
        junkHits++; // นับเหตุการณ์ไว้เฉย ๆ
        setShieldValue(shield - 1);

        dispatch('hha:judge', { label: 'BLOCK', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment: 'BLOCK', good: true });
        coach('โล่กันไว้แล้ว! ระวังขยะนะ 🛡️');

      } else {
        // miss
        junkHits++;
        addMiss();
        addScore(CFG.pointsJunkHit);
        setCombo(0);

        setFeverValue(fever - CFG.feverLossMiss);

        // quest
        if (quest && typeof quest.onJunkHit === 'function') {
          const gid = emojiToGroupId(t.emoji);
          quest.onJunkHit(gid);
        }

        dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsJunkHit), { judgment: 'MISS', good: false });
        coach('โอ๊ะ! โดนขยะแล้ว 😵 เล็งอาหารดีก่อนนะ');

        // skill down (play only)
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

      if (runMode === 'play') {
        skill = clampSkill(skill - CFG.skillLossExpire);
      }

    } else {
      junkExpires++;
      addScore(CFG.pointsJunkExpire);
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

      // adaptive (play only)
      updateAdaptiveSoon();

      // refresh quest + rank
      emitQuestUpdate();
      emitRank();

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
  }

  function stopAll(reason) {
    running = false;
    clearTimeout(spawnTimer); spawnTimer = null;
    clearInterval(secondTimer); secondTimer = null;

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

  // ---------- PUBLIC API ----------
  ns.GameEngine = {
    setLayerEl(el) { layerEl = el; },

    start(diff = 'normal', opts = {}) {
      layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;
      if (!layerEl) {
        console.error('[FoodGroupsVR] layerEl missing');
        return;
      }

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

      // research mode: lock adaptive
      if (runMode === 'research') {
        sizeMul = 1.0;
        CFG.adaptiveEnabledPlay = false;
      } else {
        // play mode: enable adaptive (ตามความสามารถ)
        CFG.adaptiveEnabledPlay = true;
      }

      // first coach
      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      coach(g ? `เริ่มเลย! หมู่ปัจจุบัน: ${g.label} ✨` : 'เริ่มเลย! แตะอาหารดีให้ได้เยอะ ๆ ✨');

      emitQuestUpdate();
      emitRank();

      running = true;
      startSecondLoop();
      scheduleNextSpawn();

      // spawn แรกทันที 2 ตัว (สนุกตั้งแต่เริ่ม)
      createTarget();
      setTimeout(() => createTarget(), Math.min(260, CFG.spawnInterval * 0.35));

      dispatch('hha:score', { score, combo, misses, shield, fever });
    },

    stop(reason) {
      stopAll(reason || 'stop');
    }
  };

})();