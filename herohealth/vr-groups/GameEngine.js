// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION SAFE ENGINE (NO-FLASH + HIT 100% + QUEST + FX + FEVER)
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
//   - quest:update{ goal, mini, goalsAll, minisAll }
//   - hha:coach   { text }
//   - hha:celebrate { type:'goal'|'mini'|'all', index, total, label }
//   - hha:end     { reason, scoreFinal, comboMax, misses, goalsTotal, goalsCleared, miniTotal, miniCleared }
//
// Miss policy (เหมือนที่คุยไว้ใน GoodJunk แนวเดียวกัน):
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

  // ---------- config ----------
  const CFG = {
    // spawn
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
    pointsJunkHit: -8,          // ถ้าโดนขยะ (ไม่มี shield) หักคะแนน
    pointsGoodExpire: -4,       // ถ้าปล่อยของดีหลุด (expire)
    pointsJunkExpire: 0,

    // fever
    feverGainGood: 14,
    feverLossMiss: 18,
    feverDurationMs: 8000,      // ระยะเวลา fever active
    shieldPerFever: 1           // ได้เกราะเพิ่มเมื่อเข้า fever (ต่อครั้ง)
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
    } else if (diff === 'hard') {
      CFG.spawnInterval = 750;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4600];
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
    } else { // normal
      CFG.spawnInterval = 900;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
    }
  }

  function pickScreenPos() {
    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    // กันขอบ + กัน HUD บน/ล่าง (เข้ากับ layout ที่คุณใช้)
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

    // reset fever bar ให้ไต่ใหม่ (เล่นสนุกกว่า)
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

    // active goal = goal ที่ยังไม่ done ตัวแรก
    const goal = goalsAll.find(g => g && !g.done) || null;
    // active mini = mini ที่ยังไม่ done ตัวแรก
    const mini = minisAll.find(m => m && !m.done) || null;

    dispatch('quest:update', {
      goal: goal ? { label: goal.label, prog: goal.prog, target: goal.target } : null,
      mini: mini ? { label: mini.label, prog: mini.prog, target: mini.target } : null,
      goalsAll,
      minisAll
    });

    // celebrate goal เมื่อมี goal เสร็จใหม่
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

    // celebrate mini เมื่อมี mini เสร็จใหม่
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

    // all complete
    if (!allClearedShown && goalsCleared === goalsAll.length && minisCleared === minisAll.length) {
      allClearedShown = true;
      dispatch('hha:celebrate', { type: 'all' });
      coach('เคลียร์ทุกภารกิจแล้ว! เก่งมากกก 🎉');
    }
  }

  function emojiToGroupId(emoji) {
    // ใช้ mapping จาก quest active group เป็นหลัก (แม่นที่สุด)
    if (quest && typeof quest.getActiveGroup === 'function') {
      const g = quest.getActiveGroup();
      if (g && Array.isArray(g.emojis) && g.emojis.includes(emoji)) return g.key || 1;
    }
    // fallback: เดาง่าย ๆ (ไม่ critical)
    return 1;
  }

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

    // ===== MIN VISIBLE LOCK =====
    t.minTimer = setTimeout(() => { t.canExpire = true; }, CFG.minVisible);

    // ===== HARD EXPIRE =====
    const life = randInt(CFG.lifeTime[0], CFG.lifeTime[1]);
    t.lifeTimer = setTimeout(() => {
      // expire ได้เมื่อพ้น minVisible เท่านั้น
      if (!t.canExpire) {
        const wait = Math.max(0, CFG.minVisible - (now() - t.bornAt));
        setTimeout(() => expireTarget(t), wait);
      } else {
        expireTarget(t);
      }
    }, life);

    // ===== HIT =====
    bindHit(el, () => hitTarget(t));
  }

  function hitTarget(t) {
    if (!running || !t || !t.alive) return;

    const pos = centerXY(t.el);

    if (t.good) {
      // good hit: คะแนน + คอมโบ
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

    } else {
      // junk hit: ถ้ามี shield → กัน (ไม่เป็น miss)
      destroyTarget(t, true);

      if (shield > 0) {
        setShieldValue(shield - 1);
        // ไม่ตัดคอมโบ (เล่นลื่น)
        dispatch('hha:judge', { label: 'BLOCK', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment: 'BLOCK', good: true });
        coach('โล่กันไว้แล้ว! ระวังขยะนะ 🛡️');
      } else {
        // นับเป็น miss
        addMiss();
        addScore(CFG.pointsJunkHit);
        setCombo(0);

        setFeverValue(fever - CFG.feverLossMiss);

        // quest update
        if (quest && typeof quest.onJunkHit === 'function') {
          const gid = emojiToGroupId(t.emoji);
          quest.onJunkHit(gid);
        }

        dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsJunkHit), { judgment: 'MISS', good: false });
        coach('โอ๊ะ! โดนขยะแล้ว 😵 เล็งอาหารดีก่อนนะ');
      }
    }

    // log-friendly hooks
    dispatch('groups:hit', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y });

    emitQuestUpdate();
  }

  function expireTarget(t) {
    if (!running || !t || !t.alive) return;

    // ถ้ายังไม่ถึง minVisible ห้ามลบ
    if (!t.canExpire) return;

    const pos = centerXY(t.el);
    destroyTarget(t, false);

    // expire = นับ miss เฉพาะ "good หลุด"
    if (t.good) {
      addMiss();
      addScore(CFG.pointsGoodExpire);
      setCombo(0);
      setFeverValue(fever - CFG.feverLossMiss);

      dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsGoodExpire), { judgment: 'MISS', good: false });
    } else {
      // junk expire ไม่เป็น miss
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

      if (quest && typeof quest.second === 'function') {
        quest.second();
      }

      // อัปเดต quest panel/celebrate
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
  }

  function stopAll(reason) {
    running = false;
    clearTimeout(spawnTimer);
    spawnTimer = null;
    clearInterval(secondTimer);
    secondTimer = null;

    // ลบเป้าทั้งหมดทันที
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
      coach(g ? `เริ่มเลย! เก็บอาหารดี: ${g.label} ✨` : 'เริ่มเลย! แตะอาหารดีให้ได้เยอะ ๆ ✨');

      // show initial quest panel
      emitQuestUpdate();

      running = true;
      startSecondLoop();
      scheduleNextSpawn();

      // spawn แรกทันที 1–2 ตัวเพื่อไม่ให้โล่ง
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
