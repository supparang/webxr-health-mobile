// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION SAFE ENGINE (NO-FLASH + HIT 100% + QUEST + FX + FEVER + RANK + ADAPTIVE)
// + PANIC TIME (10s) + RUSH MODE (random) + BOSS JUNK
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

  const active = [];
  let layerEl = null;
  let running = false;
  let spawnTimer = null;
  let secondTimer = null;

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

  // ✅ “สะใจ” systems
  let remainingSec = 0;
  let panicOn = false;
  let rushOn = false;
  let rushEndsAt = 0;
  let rushCooldownSec = 0;

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

    // ✅ rush bonus
    pointsGoodRushMul: 2,

    // ✅ boss junk
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

    // ✅ panic time
    panicLastSec: 10,
    panicSpawnMul: 0.85,         // สปอว์นถี่ขึ้นเล็กน้อย
    panicMaxActiveAdd: 1,

    // ✅ rush mode
    rushEnabled: true,
    rushMinSec: 6,
    rushMaxSec: 8,
    rushSpawnMul: 0.62,          // ถี่ขึ้นชัด ๆ
    rushMaxActiveAdd: 2,
    rushMinStartAfterSec: 10,    // อย่าเพิ่งมาเร็วเกิน
    rushChancePerSec: 0.10,      // โอกาสเริ่มต่อวินาที (ตอน cooldown=0)
    rushCooldownAfter: 12        // cooldown หลังจบ
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

  function pickScreenPos() {
    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    const marginX = Math.min(170, Math.round(w * 0.16));
    const marginYTop = Math.min(240, Math.round(h * 0.24));
    const marginYBot = Math.min(180, Math.round(h * 0.20));

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
    if (!isHit && !t.canExpire) return;

    t.alive = false;
    clearTimeout(t.minTimer);
    clearTimeout(t.lifeTimer);

    removeFromActive(t);

    if (t.el) {
      t.el.classList.add('hit');
      setTimeout(() => { try { t.el && t.el.remove(); } catch {} }, 180);
    }
  }

  // fever
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

  // score/combo/miss
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

  // quest
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

  // adaptive (play only)
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

  // rank
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

  // ✅ PANIC + RUSH
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
    if (remainingSec <= (CFG.panicLastSec + 2)) return; // อย่าชน panic
    // เริ่มหลังผ่านช่วงต้นเกม
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

    if (rushOn) si = Math.round(si * CFG.rushSpawnMul);
    if (panicOn) si = Math.round(si * CFG.panicSpawnMul);

    return clamp(si, 420, 1600);
  }

  function effectiveMaxActive(){
    let ma = CFG.maxActive;
    if (rushOn) ma += (CFG.rushMaxActiveAdd | 0);
    if (panicOn) ma += (CFG.panicMaxActiveAdd | 0);
    return clamp(ma, 2, 9);
  }

  // targets
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
      // ✅ boss junk chance
      isBoss = (Math.random() < CFG.bossJunkChance);
      if (isBoss) emoji = CFG.bossJunkEmoji[randInt(0, CFG.bossJunkEmoji.length - 1)];
      else emoji = CFG.emojisJunk[randInt(0, CFG.emojisJunk.length - 1)];
    }

    const el = document.createElement('div');
    el.className = 'fg-target ' + (good ? 'fg-good' : (isBoss ? 'fg-junk fg-boss' : 'fg-junk'));
    el.setAttribute('data-emoji', emoji);

    applyTargetSizeToEl(el, isBoss ? CFG.bossJunkScaleMul : 1.0);

    const p = pickScreenPos();
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';

    layerEl.appendChild(el);

    const t = {
      el, good, emoji,
      boss: isBoss,
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

      // ✅ rush x2 for good
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

      // ✅ boss junk special
      const isBoss = !!t.boss;

      if (shield > 0) {
        // block (not miss) แต่ boss กินโล่ 2
        junkHits++;
        const cost = isBoss ? (CFG.bossJunkShieldCost | 0) : 1;
        setShieldValue(shield - cost);

        const label = isBoss ? 'BOSS BLOCK' : 'BLOCK';
        dispatch('hha:judge', { label, x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, isBoss ? '🛡️🛡️' : '🛡️', { judgment: label, good: true });

        coach(isBoss ? 'บอสมา! กันได้ แต่โล่หาย 2 😱' : 'โล่กันไว้แล้ว! ระวังขยะนะ 🛡️');

      } else {
        // miss (boss หนักกว่า)
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
      // junk expire = no penalty
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

      // PANIC check by remainingSec (set from HTML via Engine.setTimeLeft)
      if (remainingSec > 0 && remainingSec <= (CFG.panicLastSec | 0)) setPanic(true, remainingSec);
      else setPanic(false, remainingSec);

      if (quest && typeof quest.second === 'function') quest.second();

      updateAdaptiveSoon();

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

    // panic/rush
    remainingSec = 0;
    panicOn = false;
    rushOn = false;
    rushEndsAt = 0;
    rushCooldownSec = 0;
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

  // PUBLIC API
  ns.GameEngine = {
    setLayerEl(el) { layerEl = el; },

    // ✅ HTML ส่ง timeLeft เข้ามา เพื่อ PANIC TIME ทำงานเป๊ะ
    setTimeLeft(sec) {
      remainingSec = Math.max(0, sec | 0);
      dispatch('hha:time', { left: remainingSec });
    },

    start(diff = 'normal', opts = {}) {
      layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;
      if (!layerEl) { console.error('[FoodGroupsVR] layerEl missing'); return; }

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
        CFG.rushEnabled = false; // ✅ โหมดวิจัยไม่สุ่ม rush ให้กวน
      } else {
        CFG.adaptiveEnabledPlay = true;
        CFG.rushEnabled = true;
      }

      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      coach(g ? `เริ่มเลย! หมู่ปัจจุบัน: ${g.label} ✨` : 'เริ่มเลย! แตะอาหารดีให้ได้เยอะ ๆ ✨');

      emitQuestUpdate();
      emitRank();

      running = true;
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