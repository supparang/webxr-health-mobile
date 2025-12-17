// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — PRODUCTION + FUN TUNED ENGINE (vFinal)
// - NO-FLASH: minVisible lock + expire after time only
// - HIT 100%: pointerdown + touchstart + mousedown + click
// - PLAY mode: Adaptive difficulty (size + spawn pressure) "สนุก เร้าใจ"
// - RESEARCH mode: Locked by diff only (reproducible)
// - Anti-overlap + Avoid HUD/Coach/Fever safe rects
// - Quest + FX + Fever + Shield + Miss policy
//
// API:
//   window.GroupsVR.GameEngine.start(diff, { layerEl?, runMode?, config?, seed? })
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
//   miss = good expired + junk hit (when NOT blocked by Shield)
//   * junk hit while Shield>0 => BLOCK (not miss)

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
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }

  // deterministic RNG (optional seed) for research reproducibility
  function makeRng(seed) {
    let s = (Number(seed) || 0) >>> 0;
    if (!s) s = ((Date.now() ^ (Math.random() * 1e9)) >>> 0) || 123456789;
    return function rnd() {
      // LCG
      s = (1664525 * s + 1013904223) >>> 0;
      return (s / 4294967296);
    };
  }

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

  function rectIntersects(a, b, pad) {
    const p = pad || 0;
    return !(
      (a.right + p) < (b.left - p) ||
      (a.left - p) > (b.right + p) ||
      (a.bottom + p) < (b.top - p) ||
      (a.top - p) > (b.bottom + p)
    );
  }

  // ---------- engine state ----------
  const active = [];
  let layerEl = null;
  let running = false;

  let spawnTimer = null;
  let secondTimer = null;
  let adaptTimer = null;

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

  // mode / diff
  let diffKey = 'normal';
  let runMode = 'play'; // 'play' | 'research'

  // RNG
  let rnd = Math.random;

  // adaptive state
  const perf = {
    // rolling window
    wHitsGood: 0,
    wHitJunk: 0,
    wExpireGood: 0,
    wAttempts: 0,      // goodHit + junkHit + goodExpire
    wRtSum: 0,
    wRtN: 0,
    wComboMax: 0,
    wSeconds: 0,
    // stabilization
    lastAdjustAt: 0
  };

  // ---------- config ----------
  // Base by diff (locked values) — for RESEARCH mode or initial PLAY baseline
  const DIFF_BASE = {
    easy: {
      targetSize: 162,
      spawnInterval: 1150,
      maxActive: 3,
      minVisible: 2600,
      lifeTime: [5200, 7000],
      goodRatio: 0.78
    },
    normal: {
      targetSize: 138,
      spawnInterval: 920,
      maxActive: 4,
      minVisible: 2050,
      lifeTime: [4100, 5800],
      goodRatio: 0.75
    },
    hard: {
      targetSize: 118,
      spawnInterval: 760,
      maxActive: 5,
      minVisible: 1650,
      lifeTime: [3300, 4900],
      goodRatio: 0.72
    }
  };

  // Adaptive clamps by diff (PLAY mode only)
  const PLAY_BOUNDS = {
    easy:   { sizeMin: 130, sizeMax: 175, spawnMin: 820,  spawnMax: 1400, maxActiveMin: 3, maxActiveMax: 4, goodMin: 0.74, goodMax: 0.82 },
    normal: { sizeMin: 110, sizeMax: 155, spawnMin: 700,  spawnMax: 1200, maxActiveMin: 4, maxActiveMax: 5, goodMin: 0.70, goodMax: 0.79 },
    hard:   { sizeMin:  95, sizeMax: 135, spawnMin: 600,  spawnMax:  980, maxActiveMin: 5, maxActiveMax: 6, goodMin: 0.66, goodMax: 0.76 }
  };

  const CFG = {
    // dynamic (will be set from DIFF_BASE + adaptive)
    targetSize: 138,
    spawnInterval: 920,
    maxActive: 4,
    minVisible: 2050,
    lifeTime: [4100, 5800],
    goodRatio: 0.75,

    // emoji pools (fallback)
    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚','🍞','🥔','🍊'],
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕'],

    // scoring
    pointsGood: 10,
    pointsGoodFever: 14,
    pointsJunkHit: -9,          // เร้าใจขึ้นนิด
    pointsGoodExpire: -4,
    pointsJunkExpire: 0,

    // fever
    feverGainGood: 14,
    feverLossMiss: 18,
    feverDurationMs: 8000,
    shieldPerFever: 1,

    // adaptive knobs (PLAY mode)
    adaptEverySec: 5,
    adaptCooldownMs: 4500,  // กันแกว่ง
    deadzone: 0.06,         // ถ้า skill แกว่งเล็กน้อย ไม่ปรับ
    targetStep: 8,          // ขนาดเป้าปรับครั้งละเท่านี้
    spawnStep: 70,          // spawnInterval ปรับครั้งละเท่านี้
    maxActiveStep: 1,
    ratioStep: 0.015,

    // placement
    safePad: 12,
    avoidDist: 120,         // กันซ้อนกันระหว่างเป้า
    triesPlace: 14
  };

  function applyBaseFromDiff(d) {
    const k = (String(d || 'normal').toLowerCase() === 'easy') ? 'easy'
            : (String(d || 'normal').toLowerCase() === 'hard') ? 'hard'
            : 'normal';
    const b = DIFF_BASE[k];
    CFG.targetSize = b.targetSize;
    CFG.spawnInterval = b.spawnInterval;
    CFG.maxActive = b.maxActive;
    CFG.minVisible = b.minVisible;
    CFG.lifeTime = [b.lifeTime[0], b.lifeTime[1]];
    CFG.goodRatio = b.goodRatio;

    // fever tuning slightly by diff
    if (k === 'easy') {
      CFG.feverGainGood = 16;
      CFG.feverLossMiss = 16;
      CFG.pointsJunkHit = -8;
    } else if (k === 'hard') {
      CFG.feverGainGood = 13;
      CFG.feverLossMiss = 20;
      CFG.pointsJunkHit = -10;
    } else {
      CFG.feverGainGood = 14;
      CFG.feverLossMiss = 18;
      CFG.pointsJunkHit = -9;
    }
  }

  function resetPerfWindow() {
    perf.wHitsGood = 0;
    perf.wHitJunk = 0;
    perf.wExpireGood = 0;
    perf.wAttempts = 0;
    perf.wRtSum = 0;
    perf.wRtN = 0;
    perf.wComboMax = 0;
    perf.wSeconds = 0;
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
      }, 170);
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

    // fun gate (optional): ใน hard/play ให้เข้า fever ต้องมี combo อย่างน้อย 3
    if (runMode === 'play' && diffKey === 'hard' && combo < 3) {
      // แค่รีเซ็ตให้รู้สึกใกล้ถึง แต่ไม่ปล่อย fever ง่ายเกิน
      setFeverValue(84);
      return;
    }

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
    perf.wComboMax = Math.max(perf.wComboMax, combo);
    dispatch('hha:score', { score, combo, misses, shield, fever });
  }

  function addMiss() {
    misses = (misses + 1) | 0;
    dispatch('hha:score', { score, combo, misses, shield, fever });
  }

  // ---------- quest UI + celebrate ----------
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

  // ---------- placement (avoid HUD + overlap) ----------
  function collectAvoidRects() {
    const rects = [];
    const doc = document;

    // HUD top
    const hudTop = doc.querySelector('.hud-top');
    if (hudTop) rects.push(hudTop.getBoundingClientRect());

    // coach bubble
    const coachBubble = doc.getElementById('coach-bubble');
    if (coachBubble && coachBubble.classList.contains('show')) {
      rects.push(coachBubble.getBoundingClientRect());
    } else {
      // กันพื้นที่ล่างกลางไว้บางส่วน เผื่อโค้ชจะโผล่
      rects.push({
        left: window.innerWidth * 0.18,
        right: window.innerWidth * 0.82,
        top: window.innerHeight - 170,
        bottom: window.innerHeight - 60
      });
    }

    // fever
    const feverWrap = doc.querySelector('.hha-fever-wrap') || doc.getElementById('hha-fever-wrap');
    if (feverWrap) rects.push(feverWrap.getBoundingClientRect());

    // VR button
    const vrBtn = doc.getElementById('btn-vr');
    if (vrBtn) rects.push(vrBtn.getBoundingClientRect());

    return rects;
  }

  function tooCloseToExisting(x, y, minDist) {
    const d2 = (minDist || 100) * (minDist || 100);
    for (let i = 0; i < active.length; i++) {
      const t = active[i];
      if (!t || !t.el || !t.alive) continue;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (cx - x);
      const dy = (cy - y);
      if ((dx*dx + dy*dy) < d2) return true;
    }
    return false;
  }

  function pickScreenPos(sizePx) {
    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    const s = Math.max(88, Number(sizePx) || 132);
    const half = s / 2;

    // base margins
    const marginX = Math.max(half + 10, Math.min(190, Math.round(w * 0.14)));
    const marginYTop = Math.max(half + 10, Math.min(260, Math.round(h * 0.24)));
    const marginYBot = Math.max(half + 10, Math.min(200, Math.round(h * 0.20)));

    const avoid = collectAvoidRects();
    const pad = CFG.safePad;

    for (let k = 0; k < CFG.triesPlace; k++) {
      const x = Math.floor((rnd() * (w - marginX * 2)) + marginX);
      const y = Math.floor((rnd() * (h - (marginYTop + marginYBot))) + marginYTop);

      // candidate rect of target
      const cand = { left: x - half, right: x + half, top: y - half, bottom: y + half };

      // avoid rects
      let bad = false;
      for (let i = 0; i < avoid.length; i++) {
        const r = avoid[i];
        if (!r) continue;
        if (rectIntersects(cand, r, pad)) { bad = true; break; }
      }
      if (bad) continue;

      // overlap with existing targets
      if (tooCloseToExisting(x, y, CFG.avoidDist)) continue;

      return { x, y };
    }

    // fallback center-ish
    return { x: w * 0.5, y: h * 0.56 };
  }

  // ---------- target creation ----------
  function pickEmoji(good) {
    const g = (quest && quest.getActiveGroup) ? quest.getActiveGroup() : null;
    if (good) {
      if (g && Array.isArray(g.emojis) && g.emojis.length) {
        return g.emojis[Math.floor(rnd() * g.emojis.length)];
      }
      return CFG.emojisGood[Math.floor(rnd() * CFG.emojisGood.length)];
    }
    return CFG.emojisJunk[Math.floor(rnd() * CFG.emojisJunk.length)];
  }

  function createTarget() {
    if (!running || !layerEl) return;
    if (active.length >= CFG.maxActive) return;

    const good = (rnd() < CFG.goodRatio);
    const emoji = pickEmoji(good);

    const el = document.createElement('div');
    el.className = 'fg-target ' + (good ? 'fg-good' : 'fg-junk');
    el.setAttribute('data-emoji', emoji);

    // size adaptive
    const size = Math.round(CFG.targetSize);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    const p = pickScreenPos(size);
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

    // MIN VISIBLE LOCK
    t.minTimer = setTimeout(() => { t.canExpire = true; }, CFG.minVisible);

    // HARD EXPIRE (ensure lifeTimeMin >= minVisible + 800)
    const minLife = Math.max(CFG.lifeTime[0], CFG.minVisible + 800);
    const maxLife = Math.max(CFG.lifeTime[1], minLife + 400);
    const life = Math.floor(minLife + rnd() * (maxLife - minLife));

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

  // ---------- gameplay ----------
  function hitTarget(t) {
    if (!running || !t || !t.alive) return;

    const pos = centerXY(t.el);
    const rt = Math.max(0, (now() - (t.bornAt || now())));
    perf.wRtSum += rt;
    perf.wRtN++;

    if (t.good) {
      destroyTarget(t, true);

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

      dispatch('hha:judge', { label: feverOn ? 'PERFECT' : 'GOOD', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, '+' + pts, { judgment: feverOn ? 'PERFECT' : 'GOOD', good: true });

      // perf window
      perf.wHitsGood++;
      perf.wAttempts++;

    } else {
      destroyTarget(t, true);

      if (shield > 0) {
        setShieldValue(shield - 1);
        dispatch('hha:judge', { label: 'BLOCK', x: pos.x, y: pos.y, good: true, emoji: t.emoji });
        Particles.scorePop && Particles.scorePop(pos.x, pos.y, '🛡️', { judgment: 'BLOCK', good: true });
        coach('โล่กันไว้แล้ว! ระวังขยะนะ 🛡️');

        // perf window counts as attempt (แต่ไม่เป็น miss)
        perf.wHitJunk++;
        perf.wAttempts++;

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

        // perf window
        perf.wHitJunk++;
        perf.wAttempts++;
      }
    }

    dispatch('groups:hit', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y, rt });

    emitQuestUpdate();
  }

  function expireTarget(t) {
    if (!running || !t || !t.alive) return;
    if (!t.canExpire) return;

    const pos = centerXY(t.el);
    destroyTarget(t, false);

    // expire => miss only for GOOD
    if (t.good) {
      addMiss();
      addScore(CFG.pointsGoodExpire);
      setCombo(0);
      setFeverValue(fever - CFG.feverLossMiss);

      dispatch('hha:judge', { label: 'MISS', x: pos.x, y: pos.y, good: false, emoji: t.emoji });
      Particles.scorePop && Particles.scorePop(pos.x, pos.y, String(CFG.pointsGoodExpire), { judgment: 'MISS', good: false });

      perf.wExpireGood++;
      perf.wAttempts++;
    } else {
      addScore(CFG.pointsJunkExpire);
      // junk expire not miss
    }

    dispatch('groups:expire', { emoji: t.emoji, good: t.good, x: pos.x, y: pos.y });

    emitQuestUpdate();
  }

  // ---------- spawning ----------
  function scheduleNextSpawn() {
    if (!running) return;
    clearTimeout(spawnTimer);
    spawnTimer = setTimeout(() => {
      createTarget();
      scheduleNextSpawn();
    }, Math.max(420, CFG.spawnInterval | 0));
  }

  // ---------- adaptive (PLAY only) ----------
  function applyAdaptive(deltaSkill) {
    const k = diffKey;
    const b = PLAY_BOUNDS[k];
    if (!b) return;

    // deltaSkill > 0 => player doing well => harder
    // deltaSkill < 0 => player struggling => easier
    const step = (deltaSkill > 0) ? 1 : -1;

    // size
    CFG.targetSize = clamp(CFG.targetSize + (-step * CFG.targetStep), b.sizeMin, b.sizeMax);

    // spawn pressure
    CFG.spawnInterval = clamp(CFG.spawnInterval + (-step * CFG.spawnStep), b.spawnMin, b.spawnMax);

    // maxActive
    const ma = CFG.maxActive + (step * CFG.maxActiveStep);
    CFG.maxActive = clamp(ma, b.maxActiveMin, b.maxActiveMax);

    // goodRatio (เก่ง -> junk เพิ่มนิด, อ่อน -> good เพิ่มนิด)
    CFG.goodRatio = clamp(CFG.goodRatio + (-step * CFG.ratioStep), b.goodMin, b.goodMax);
  }

  function computeSkill() {
    const attempts = Math.max(1, perf.wAttempts);
    const goodHitRate = perf.wHitsGood / attempts;
    const missRate = (perf.wExpireGood + Math.max(0, (perf.wHitJunk))) / attempts;

    const rtAvg = perf.wRtN ? (perf.wRtSum / perf.wRtN) : 1200;
    const rtScore = clamp((1300 - rtAvg) / 900, -1, 1); // เร็วกว่า 1300ms => บวก

    const comboScore = clamp((perf.wComboMax - 3) / 6, -0.5, 0.8);

    // รวมคะแนน skill (เน้นสนุก: goodHitRate + combo + speed, หักด้วย miss)
    let s = 0;
    s += (goodHitRate - 0.58) * 1.1;
    s += (rtScore) * 0.35;
    s += (comboScore) * 0.35;
    s -= (missRate - 0.22) * 1.2;

    // clamp
    return clamp(s, -1, 1);
  }

  function adaptiveTick() {
    if (!running) return;
    if (runMode !== 'play') return;

    perf.wSeconds++;
    if (perf.wSeconds < CFG.adaptEverySec) return;

    const tNow = now();
    if ((tNow - perf.lastAdjustAt) < CFG.adaptCooldownMs) {
      // รีเซ็ตหน้าต่างเพื่อกันแกว่ง
      resetPerfWindow();
      return;
    }

    const skill = computeSkill();

    // deadzone
    if (Math.abs(skill) < CFG.deadzone) {
      resetPerfWindow();
      return;
    }

    // ปรับแบบ "เร้าใจ" แต่ไม่เหวี่ยง
    applyAdaptive(skill);
    perf.lastAdjustAt = tNow;

    // แจ้ง debug แบบเบา ๆ (ถ้าอยากโชว์)
    dispatch('hha:adaptive', {
      skill,
      targetSize: CFG.targetSize | 0,
      spawnInterval: CFG.spawnInterval | 0,
      maxActive: CFG.maxActive | 0,
      goodRatio: Number(CFG.goodRatio.toFixed(3))
    });

    // โค้ชพูดบ้างให้รู้สึกเกม “มีชีวิต”
    if (skill > 0.35) coach('เริ่มเก่งแล้วนะ! เกมจะเร้าใจขึ้นอีกนิด 🔥');
    else if (skill < -0.35) coach('ไม่เป็นไร เดี๋ยวช่วยให้ง่ายขึ้นนิดนะ ✨');

    resetPerfWindow();
  }

  // ---------- loops ----------
  function startSecondLoop() {
    clearInterval(secondTimer);
    secondTimer = setInterval(() => {
      if (!running) return;

      tickFever();

      if (quest && typeof quest.second === 'function') quest.second();

      emitQuestUpdate();
    }, 1000);
  }

  function startAdaptiveLoop() {
    clearInterval(adaptTimer);
    adaptTimer = setInterval(adaptiveTick, 1000);
  }

  // ---------- lifecycle ----------
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

    resetPerfWindow();
    perf.lastAdjustAt = 0;
  }

  function stopAll(reason) {
    running = false;

    clearTimeout(spawnTimer);
    spawnTimer = null;

    clearInterval(secondTimer);
    secondTimer = null;

    clearInterval(adaptTimer);
    adaptTimer = null;

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
      diffKey = (String(diff || 'normal').toLowerCase() === 'easy') ? 'easy'
              : (String(diff || 'normal').toLowerCase() === 'hard') ? 'hard'
              : 'normal';

      runMode = (opts && String(opts.runMode || '').toLowerCase() === 'research') ? 'research' : 'play';

      // seed (optional) — recommended for RESEARCH mode
      const seed = (opts && opts.seed != null) ? opts.seed : null;
      rnd = makeRng(seed);

      layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;
      if (!layerEl) {
        console.error('[FoodGroupsVR] layerEl missing');
        return;
      }

      // override config (optional)
      if (opts && opts.config) Object.assign(CFG, opts.config);

      // set base by diff
      applyBaseFromDiff(diffKey);

      // ✅ research lock: force base and DO NOT adaptive
      if (runMode === 'research') {
        // ensure reproducible feel
        coach(`โหมดวิจัย: ล็อกระดับ ${diffKey.toUpperCase()} ✅`);
      } else {
        coach(`โหมดเล่น: เริ่มระดับ ${diffKey.toUpperCase()} แล้วปรับตามความสามารถ 🔥`);
      }

      resetState();

      // fever HUD init
      FeverUI.ensureFeverBar && FeverUI.ensureFeverBar();
      FeverUI.setFever && FeverUI.setFever(0);
      FeverUI.setFeverActive && FeverUI.setFeverActive(false);
      FeverUI.setShield && FeverUI.setShield(0);

      // quest init
      if (QuestFactory && typeof QuestFactory.createFoodGroupsQuest === 'function') {
        quest = QuestFactory.createFoodGroupsQuest(diffKey);
      } else {
        quest = null;
        console.warn('[FoodGroupsVR] quest-manager not found: window.GroupsQuest.createFoodGroupsQuest');
      }

      // first coach group
      const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
      coach(g ? `เริ่มเลย! โฟกัส ${g.label} ✨` : 'เริ่มเลย! แตะอาหารดีให้ได้เยอะ ๆ ✨');

      // show initial quest panel
      emitQuestUpdate();

      running = true;

      startSecondLoop();
      if (runMode === 'play') startAdaptiveLoop();

      scheduleNextSpawn();

      // spawn แรกทันที 2 ตัวให้รู้สึกเร้าใจ
      createTarget();
      setTimeout(() => createTarget(), Math.min(260, (CFG.spawnInterval * 0.35) | 0));

      dispatch('hha:score', { score, combo, misses, shield, fever });
    },

    stop(reason) {
      stopAll(reason || 'stop');
    }
  };

})();