// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — DOM Target Engine (good vs junk)
// ใช้ร่วมกับ groups-vr.html, vr/ui-fever.js, vr/particles.js
// สร้าง global: window.GameEngine.start(diff, durationSec), stop(reason)

(function (global) {
  'use strict';

  const FX = global.HHA_PARTICLES || null;

  // ตัวอย่าง icon อาหาร (จะไม่ไปยุ่งไฟล์ emoji-image.js เดิม)
  const GOOD_FOODS = ['🥦', '🥕', '🍎', '🍇', '🍚', '🥛', '🍌', '🥬'];
  const JUNK_FOODS = ['🍩', '🍟', '🍫', '🧃', '🍬', '🍕'];

  // ตารางความยาก
  const DIFF_TABLE = {
    easy: {
      spawnInterval: 1100,
      lifetime: 2600,
      maxActive: 3,
      goodRatio: 0.75
    },
    normal: {
      spawnInterval: 900,
      lifetime: 2200,
      maxActive: 4,
      goodRatio: 0.65
    },
    hard: {
      spawnInterval: 750,
      lifetime: 1900,
      maxActive: 5,
      goodRatio: 0.55
    }
  };

  let state = null;

  function rand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function dispatch(name, detail) {
    try {
      global.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (err) {
      console.warn('[GroupsVR] dispatch error', name, err);
    }
  }

  function updateScoreHUD() {
    if (!state) return;
    dispatch('hha:score', {
      score: state.score,
      combo: state.combo,
      misses: state.misses
    });
  }

  function updateJudge(label) {
    dispatch('hha:judge', { label });
  }

  function updateQuestHUD() {
    if (!state) return;

    const good = state.goodHits;
    const miss = state.misses;
    const goalTarget = state.goalTarget;
    const miniTarget = state.miniTarget;

    const goal = {
      label: 'จัดหมู่อาหารดีจากหมู่ที่กำหนดให้ได้ตามเป้า',
      prog: good,
      target: goalTarget,
      done: good >= goalTarget
    };

    const mini = {
      label: 'เก็บอาหารดีให้ครบจำนวน เลี่ยงของขยะให้ได้มากที่สุด',
      prog: good,
      target: miniTarget,
      done: good >= miniTarget && miss <= state.miniMaxMiss
    };

    const remain = Math.max(0, goalTarget - good);
    const hint =
      remain > 0
        ? `เก็บอาหารดีอีก ${remain} ชิ้น จะครบเป้าหมายหลัก`
        : 'ตอนนี้เก็บอาหารดีได้ครบตามเป้าแล้ว 🎉';

    dispatch('quest:update', {
      goal,
      mini,
      hint
    });
  }

  function registerGoodHit(x, y) {
    if (!state) return;
    state.goodHits += 1;
    state.combo += 1;
    if (state.combo > state.comboMax) state.comboMax = state.comboMax = state.combo;
    state.score += 50;

    if (FX) {
      FX.scorePop(x, y, '+50', { good: true });
      FX.burstAt(x, y, { color: '#22c55e', count: 14, radius: 60 });
    }

    updateJudge('GOOD ✓');
    updateScoreHUD();
    updateQuestHUD();
  }

  function registerMiss(reason, x, y) {
    if (!state) return;
    state.misses += 1;
    state.combo = 0;

    if (FX && typeof x === 'number' && typeof y === 'number') {
      FX.scorePop(x, y, 'MISS', { good: false });
      FX.burstAt(x, y, { color: '#f97316', count: 12, radius: 50 });
    }

    dispatch('hha:miss', { reason });
    updateJudge('MISS');
    updateScoreHUD();
    updateQuestHUD();
  }

  function spawnTarget() {
    if (!state || !state.running) return;

    const layer = document.getElementById('fg-layer') || document.body;
    const activeCount = state.targets.size;
    if (activeCount >= state.cfg.maxActive) return;

    const isGood = Math.random() < state.cfg.goodRatio;
    const type = isGood ? 'good' : 'junk';

    const vw = global.innerWidth || 360;
    const vh = global.innerHeight || 640;

    // หลีกเลี่ยง HUD บนและโค้ชล่าง
    const marginX = 60;
    const marginTop = 120;
    const marginBottom = 140;

    const x = clamp(
      marginX + Math.random() * (vw - marginX * 2),
      marginX,
      vw - marginX
    );
    const y = clamp(
      marginTop + Math.random() * (vh - marginTop - marginBottom),
      marginTop,
      vh - marginBottom
    );

    const el = document.createElement('div');
    el.className = 'fg-target ' + (isGood ? 'fg-good' : 'fg-junk');
    el.dataset.emoji = isGood ? rand(GOOD_FOODS) : rand(JUNK_FOODS);
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    const id = state.nextId++;
    const target = {
      id,
      type,
      x,
      y,
      el,
      timeoutId: null,
      alive: true
    };

    function clearTarget() {
      target.alive = false;
      state.targets.delete(id);
      try {
        el.remove();
      } catch (_) {}
    }

    function onClick(ev) {
      if (!state || !state.running || !target.alive) return;
      target.alive = false;
      el.classList.add('hit');
      if (target.timeoutId) clearTimeout(target.timeoutId);
      const cx = ev.clientX || x;
      const cy = ev.clientY || y;

      if (type === 'good') {
        registerGoodHit(cx, cy);
      } else {
        registerMiss('hit-junk', cx, cy);
      }

      setTimeout(clearTarget, 140);
    }

    el.addEventListener('click', onClick);
    el.addEventListener('touchstart', function (ev) {
      if (!ev.touches || !ev.touches[0]) return;
      const t = ev.touches[0];
      onClick(t);
    });

    layer.appendChild(el);

    target.timeoutId = setTimeout(function () {
      if (!state || !state.running || !target.alive) return;
      target.alive = false;
      // ถ้าเป็นอาหารดี แล้วยังไม่ได้ตี -> ถือว่าพลาด
      if (type === 'good') {
        registerMiss('timeout-good', x, y);
      }
      el.classList.add('hit');
      setTimeout(clearTarget, 140);
    }, state.cfg.lifetime);

    state.targets.set(id, target);
  }

  function clearAllTargets() {
    if (!state) return;
    state.targets.forEach(function (t) {
      if (t.timeoutId) clearTimeout(t.timeoutId);
      try {
        t.el.remove();
      } catch (_) {}
    });
    state.targets.clear();
  }

  function start(diffKey, durationSec) {
    stop('restart');

    diffKey = String(diffKey || 'normal').toLowerCase();
    const cfg = DIFF_TABLE[diffKey] || DIFF_TABLE.normal;

    const goalTarget = 18;
    const miniTarget = 24;
    const miniMaxMiss = 4;

    state = {
      running: true,
      diff: diffKey,
      cfg,
      score: 0,
      combo: 0,
      comboMax: 0,
      misses: 0,
      goodHits: 0,
      spawnTimer: null,
      targets: new Map(),
      nextId: 1,
      goalTarget,
      miniTarget,
      miniMaxMiss,
      durationSec: durationSec || 60
    };

    updateScoreHUD();
    updateQuestHUD();
    updateJudge('');

    // เริ่ม spawn เป้า
    state.spawnTimer = setInterval(spawnTarget, cfg.spawnInterval);

    dispatch('hha:coach', {
      text: 'ภารกิจวันนี้: เลือกอาหารดีจากหมู่ที่กำหนด และหลบของขยะให้ได้มากที่สุดนะ 🥦🍚'
    });

    console.log('[GroupsVR] GameEngine started', diffKey, cfg);
  }

  function stop(reason) {
    if (!state) return;

    if (state.spawnTimer) clearInterval(state.spawnTimer);
    state.spawnTimer = null;

    clearAllTargets();

    const summary = {
      reason: reason || 'manual',
      scoreFinal: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      goalsCleared: state.goodHits >= state.goalTarget ? 1 : 0,
      goalsTotal: 1,
      miniCleared:
        state.goodHits >= state.miniTarget && state.misses <= state.miniMaxMiss
          ? 1
          : 0,
      miniTotal: 1
    };

    dispatch('hha:end', summary);

    console.log('[GroupsVR] GameEngine stopped:', summary);
    state.running = false;
    state = null;
  }

  // ผูก global
  global.GameEngine = {
    start,
    stop
  };
  global.GAME_MODULES = global.GAME_MODULES || {};
  global.GAME_MODULES.FoodGroupsGame = global.GameEngine;

})(window);
