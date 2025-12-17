// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — QUEST + NO-FLASH + 100% HIT (production-ready)
// - DOM targets (fg-layer) ไม่แว๊บ: minVisible lock + lifetime ยาว
// - ตีได้ 100%: pointerdown + touchstart + mousedown + click
// - ผูก Quest จริง: window.GroupsQuest.createFoodGroupsQuest(diff)
// events:
//   - groups:hit / groups:expire
//   - hha:score  {score, combo, misses}
//   - hha:judge  {label}
//   - quest:update {goal, mini, goalsAll, minisAll, groupId, groupLabel}
//   - hha:coach  {text}
//   - hha:celebrate {type:'goal'|'mini'|'all', index,total}
//   - hha:end    {scoreFinal, comboMax, misses, goalsCleared, goalsTotal, miniCleared, miniTotal}

(function () {
  'use strict';

  const ns = (window.GroupsVR = window.GroupsVR || {});
  const active = [];

  let layerEl = null;
  let running = false;

  let spawnTimer = null;
  let secondTimer = null;

  let quest = null;

  // ===== GAME STATS =====
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  // ===== GOAL/MINI cursor =====
  let lastGoalCleared = 0;
  let lastMiniCleared = 0;

  // ===== CONFIG =====
  const CFG = {
    spawnInterval: 900,
    maxActive: 4,
    minVisible: 2000,
    lifeTime: [3800, 5200],
    goodRatio: 0.75,

    // junk pool (ใช้ทุกหมู่)
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕','🍗🍟'.includes('x') ? '🍟' : '🍟'] // กัน build tools บางตัวแปลก ๆ
  };

  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function dispatch(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
  }

  function removeFromActive(t) {
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i, 1);
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

  function pickScreenPos() {
    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    const marginX = Math.min(160, Math.round(w * 0.16));
    const marginYTop = Math.min(220, Math.round(h * 0.22)); // กัน HUD
    const marginYBot = Math.min(160, Math.round(h * 0.18)); // กันล่าง

    const x = randInt(marginX, w - marginX);
    const y = randInt(marginYTop, h - marginYBot);

    return { x, y };
  }

  function destroyTarget(t, isHit) {
    if (!t || !t.alive) return;

    // ห้าม expire ก่อน minVisible (ยกเว้น hit)
    if (!isHit && !t.canExpire) return;

    t.alive = false;
    clearTimeout(t.minTimer);
    clearTimeout(t.lifeTimer);

    removeFromActive(t);

    if (t.el) {
      t.el.classList.add('hit');
      setTimeout(() => {
        try { t.el && t.el.parentNode && t.el.remove(); } catch {}
      }, 180);
    }
  }

  function emitQuestUpdate(forceCoach) {
    if (!quest) return;

    const goalsAll = quest.goals || [];
    const minisAll = quest.minis || [];

    const goal = goalsAll.find(g => g && !g.done) || null;
    const mini = minisAll.find(m => m && !m.done) || null;

    const g = quest.getActiveGroup ? quest.getActiveGroup() : null;
    const groupId = g ? (g.key || 1) : 1;
    const groupLabel = g ? (g.label || '') : '';

    dispatch('quest:update', {
      goal,
      mini,
      goalsAll,
      minisAll,
      groupId,
      groupLabel
    });

    if (forceCoach && groupLabel) {
      dispatch('hha:coach', { text: `🎵 ตอนนี้: ${groupLabel}` });
    }
  }

  function celebrateIfNeeded() {
    if (!quest) return;

    const goalsAll = quest.goals || [];
    const minisAll = quest.minis || [];

    const goalsCleared = goalsAll.filter(g => g && g.done).length;
    const minisCleared = minisAll.filter(m => m && m.done).length;

    // goal celebrate
    if (goalsCleared > lastGoalCleared) {
      lastGoalCleared = goalsCleared;
      dispatch('hha:celebrate', { type:'goal', index: goalsCleared, total: goalsAll.length });
    }

    // mini celebrate
    if (minisCleared > lastMiniCleared) {
      lastMiniCleared = minisCleared;
      dispatch('hha:celebrate', { type:'mini', index: minisCleared, total: minisAll.length });
    }

    // all celebrate
    if (goalsAll.length && minisAll.length &&
        goalsCleared === goalsAll.length &&
        minisCleared === minisAll.length) {
      dispatch('hha:celebrate', { type:'all' });
    }
  }

  function judge(label) {
    dispatch('hha:judge', { label: label || '' });
  }

  function emitScore() {
    dispatch('hha:score', { score, combo, misses });
  }

  function applyDifficulty(diff) {
    diff = String(diff || 'normal').toLowerCase();
    if (diff === 'easy') {
      CFG.spawnInterval = 1200;
      CFG.maxActive = 3;
      CFG.minVisible = 2600;
      CFG.lifeTime = [5200, 7200];
      CFG.goodRatio = 0.78;
    } else if (diff === 'hard') {
      CFG.spawnInterval = 750;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3400, 4800];
      CFG.goodRatio = 0.72;
    } else {
      CFG.spawnInterval = 900;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [4200, 6000];
      CFG.goodRatio = 0.75;
    }
  }

  function currentGroupData() {
    const g = quest && quest.getActiveGroup ? quest.getActiveGroup() : null;
    const groupId = g ? (g.key || 1) : 1;
    const groupLabel = g ? (g.label || '') : '';
    const emojis = g && g.emojis ? g.emojis : ['🥦','🍚','🍎'];
    return { groupId, groupLabel, emojis };
  }

  function createTarget() {
    if (!running || !layerEl) return;
    if (active.length >= CFG.maxActive) return;

    const { groupId, emojis } = currentGroupData();
    const good = Math.random() < CFG.goodRatio;

    const emoji = good
      ? emojis[randInt(0, emojis.length - 1)]
      : CFG.emojisJunk[randInt(0, CFG.emojisJunk.length - 1)];

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
      groupId,
      alive: true,
      canExpire: false,
      bornAt: now(),
      minTimer: null,
      lifeTimer: null
    };

    active.push(t);

    // lock min visible
    t.minTimer = setTimeout(() => { t.canExpire = true; }, CFG.minVisible);

    // hard expire
    const life = randInt(CFG.lifeTime[0], CFG.lifeTime[1]);
    t.lifeTimer = setTimeout(() => {
      // expire เมื่อพ้น minVisible เท่านั้น
      if (t.canExpire) {
        destroyTarget(t, false);
        dispatch('groups:expire', { emoji: t.emoji, good: t.good, groupId: t.groupId });
        // GOOD หลุด = miss
        if (t.good) {
          combo = 0;
          misses += 1;
          judge('MISS');
          emitScore();
        }
        // JUNK expire ไม่คิดอะไร
      } else {
        // กันเคส timer มาก่อน lock
        const wait = Math.max(0, CFG.minVisible - (now() - t.bornAt));
        setTimeout(() => {
          if (!t.alive) return;
          t.canExpire = true;
          destroyTarget(t, false);
          dispatch('groups:expire', { emoji: t.emoji, good: t.good, groupId: t.groupId });
          if (t.good) {
            combo = 0;
            misses += 1;
            judge('MISS');
            emitScore();
          }
        }, wait);
      }
    }, life);

    // hit
    bindHit(el, () => {
      if (!t.alive) return;

      destroyTarget(t, true);
      dispatch('groups:hit', { emoji: t.emoji, good: t.good, groupId: t.groupId });

      if (t.good) {
        combo += 1;
        comboMax = Math.max(comboMax, combo);
        score += 10 + Math.min(15, combo); // คอมโบช่วยหน่อย
        judge(combo >= 3 ? 'PERFECT!' : 'GOOD');
        // quest hook
        if (quest && quest.onGoodHit) quest.onGoodHit(t.groupId, combo);
      } else {
        // junk hit = miss
        combo = 0;
        misses += 1;
        score = Math.max(0, score - 5);
        judge('OOPS!');
        if (quest && quest.onJunkHit) quest.onJunkHit(t.groupId);
      }

      emitScore();
      celebrateIfNeeded();
      emitQuestUpdate(false);
    });
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
      if (!running || !quest) return;

      const before = quest.getActiveGroup ? quest.getActiveGroup() : null;
      const beforeKey = before ? before.key : 1;

      // quest tick (เปลี่ยนหมู่ทุก 15s ตาม quest-manager)
      quest.second && quest.second();

      const after = quest.getActiveGroup ? quest.getActiveGroup() : null;
      const afterKey = after ? after.key : 1;

      // ถ้าเปลี่ยนหมู่ → โค้ช + อัปเดต quest panel
      if (afterKey !== beforeKey) {
        emitQuestUpdate(true);
      } else {
        emitQuestUpdate(false);
      }

      // mini-3 ตัดสินเมื่อจบหมู่ 5 (เมื่อเปลี่ยนออกจาก 5 หรือหมดเกม)
      // (quest-manager เวอร์ชันคุณยังไม่ตัดสินเอง เราจัดให้ใน engine)
      const minis = quest.minis || [];
      const m3 = minis.find(m => m && m.id === 'MINI-3');
      if (m3 && !m3.done) {
        // ถ้า "เคยเข้า 5 แล้ว" และตอนนี้พ้น 5 แล้ว → ตัดสินผ่าน/ไม่ผ่าน
        // เราใช้เงื่อนไข: เมื่อ groupId > 5 ไม่มี, แต่ quest เปลี่ยนสูงสุดถึง 5
        // ดังนั้นตัดสินเมื่อ "อยู่หมู่ 5" ครบช่วงแล้ว แล้ว quest พยายาม nextGroup (ไป 5 ต่อ)
        // วิธีชัวร์: ตัดสินทันทีที่ state.currentGroupIndex เป็น 4 (หมู่5) และ groupTimeSec >= 15
        // เราอ่านไม่ได้จาก quest (เวอร์ชันนี้ไม่ expose) → เลยตัดสินเมื่อ afterKey === 5 และ quest.nextGroup ถูกเรียกไม่ได้
        // ทางเลือกที่เสถียร: ตัดสินเมื่อ "เวลาจบเกม" (stop) เท่านั้น
      }

      celebrateIfNeeded();
    }, 1000);
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

    // ตัดสิน mini-3 ตอนจบเกมแบบชัวร์
    if (quest) {
      const minis = quest.minis || [];
      const m3 = minis.find(m => m && m.id === 'MINI-3');
      const g = quest.getActiveGroup ? quest.getActiveGroup() : null;
      const groupKey = g ? g.key : 1;

      if (m3 && !m3.done) {
        // ผ่านถ้า junkHit <= maxJunk (และต้อง “เคยเข้าหมู่ 5” ไหม? ในเกมสั้นอาจไม่ถึง 5)
        // เราให้ผ่านเมื่อ: ถ้าเคยเล่นจนถึงหมู่ 5 (groupKey === 5 หรือ goal2 มี prog > 0) แล้วค่อยตัดสิน
        const goal2 = (quest.goals || [])[1];
        const reached5 = (groupKey === 5) || (goal2 && goal2.prog > 0);

        if (reached5 && (m3.junkHit <= m3.maxJunk)) {
          m3.done = true;
          m3.prog = 1;
        }
      }
    }

    // สรุป
    const goalsAll = quest ? (quest.goals || []) : [];
    const minisAll = quest ? (quest.minis || []) : [];

    const goalsCleared = goalsAll.filter(g => g && g.done).length;
    const minisCleared = minisAll.filter(m => m && m.done).length;

    dispatch('hha:end', {
      reason: reason || 'stop',
      scoreFinal: score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal: goalsAll.length,
      miniCleared: minisCleared,
      miniTotal: minisAll.length
    });
  }

  // ===== PUBLIC API =====
  ns.GameEngine = {
    setLayerEl(el) {
      layerEl = el;
    },

    start(diff = 'normal', opts = {}) {
      layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;
      if (!layerEl) {
        console.error('[FoodGroupsVR] layerEl missing');
        return;
      }

      // reset stats
      score = 0; combo = 0; comboMax = 0; misses = 0;
      lastGoalCleared = 0;
      lastMiniCleared = 0;

      applyDifficulty(diff);

      // init quest (must exist)
      if (!window.GroupsQuest || typeof window.GroupsQuest.createFoodGroupsQuest !== 'function') {
        console.error('[FoodGroupsVR] quest-manager missing (window.GroupsQuest.createFoodGroupsQuest)');
        return;
      }
      quest = window.GroupsQuest.createFoodGroupsQuest(diff);

      // kick HUD
      emitScore();
      emitQuestUpdate(true);

      running = true;
      startSecondLoop();
      scheduleNextSpawn();

      // spawn แรกทันที
      createTarget();
    },

    stop(reason) {
      stopAll(reason);
    }
  };
})();
