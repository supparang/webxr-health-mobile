// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Quest + Fever + FX)
// ใช้ร่วมกับ groups-vr.html (import { GameEngine } from './vr-groups/GameEngine.js')
// 2025-12-09

'use strict';

// ----- Difficulty table -----
const DIFF_TABLE = {
  easy: {
    spawnInterval: 1100,
    lifeMs: 2600,
    maxActive: 3,
    goodRatio: 0.7,
    sizeFactor: 1.1
  },
  normal: {
    spawnInterval: 900,
    lifeMs: 2400,
    maxActive: 4,
    goodRatio: 0.65,
    sizeFactor: 1.0
  },
  hard: {
    spawnInterval: 750,
    lifeMs: 2200,
    maxActive: 5,
    goodRatio: 0.6,
    sizeFactor: 0.9
  }
};

// ----- Emoji per group (แบบคร่าว ๆ 5 หมู่) -----
const GOOD_EMOJI = [
  // หมู่ 1 โปรตีน
  '🍗', '🥚', '🥩', '🐟',
  // หมู่ 2 ข้าว-แป้ง
  '🍚', '🍞', '🥖',
  // หมู่ 3 ผัก
  '🥦', '🥕', '🥬', '🍅',
  // หมู่ 4 ผลไม้
  '🍎', '🍌', '🍇', '🍊',
  // หมู่ 5 นม
  '🥛', '🧀'
];

const JUNK_EMOJI = [
  '🍩', '🍟', '🍕', '🍰', '🍫', '🍭', '🥤', '🧃'
];

function pickEmoji(isGood) {
  const arr = isGood ? GOOD_EMOJI : JUNK_EMOJI;
  if (!arr.length) return '🍽️';
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

// ----- Fever UI (global from ui-fever.js) -----
const FeverUI = (window.FeverUI ||
  (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
  {
    ensureFeverBar () {},
    setFever () {},
    setFeverActive () {},
    setShield () {}
  });

// Particles (global from vr/particles.js)
const Particles = (window.HHA_PARTICLES ||
  (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
  {
    scorePop () {},
    burstAt () {}
  });

// ===== Utility =====
function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function randomScreenPos() {
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;

  const topSafe = 120;     // หลบ HUD บน
  const bottomSafe = 160;  // หลบโค้ช + Fever ล่าง
  const left = w * 0.14;
  const right = w * 0.86;

  const x = left + Math.random() * (right - left);
  const y = topSafe + Math.random() * (h - topSafe - bottomSafe);
  return { x, y };
}

function ensureLayer() {
  let layer = document.getElementById('fg-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fg-layer';
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '640';
    document.body.appendChild(layer);
  }
  return layer;
}

// ===== GameEngine (singleton) =====
const GameEngine = (() => {
  let running = false;
  let diffKey = 'normal';
  let cfg = DIFF_TABLE.normal;

  let layer = null;
  let targets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let goodHits = 0;

  let fever = 0;
  const FEVER_MAX = 100;
  const FEVER_HIT_GAIN = 8;
  const FEVER_MISS_LOSS = 20;
  let feverActive = false;

  let gameTime = 0;      // ms
  let spawnTimer = 0;    // ms
  let rafId = null;
  let lastTs = 0;

  // Quest state (ให้ HTML ไป render)
  const questMain = {
    label: 'ทำคะแนนตามเป้าหมายจากหมู่อาหารดี',
    target: 500,
    prog: 0,
    done: false
  };
  const questMini = {
    label: 'เก็บอาหารดีให้ครบตามกำหนด',
    target: 22,
    prog: 0,
    done: false
  };
  let questHint = 'โฟกัสอาหารดีจากทุกหมู่ เลี่ยงของขยะ 🍚🥦🍊';

  // ---------- Fever ----------
  function resetFever() {
    fever = 0;
    feverActive = false;
    FeverUI.ensureFeverBar();
    FeverUI.setFever(0);
    FeverUI.setFeverActive(false);
    FeverUI.setShield(0);
  }

  function updateFever(delta) {
    fever = clamp(fever + delta, 0, FEVER_MAX);
    FeverUI.setFever(fever);

    const nowActive = (fever >= FEVER_MAX);
    if (nowActive && !feverActive) {
      feverActive = true;
      FeverUI.setFeverActive(true);
      emit('hha:fever', { state: 'start', value: fever });
    } else if (!nowActive && feverActive) {
      feverActive = false;
      FeverUI.setFeverActive(false);
      emit('hha:fever', { state: 'end', value: fever });
    }
  }

  // ---------- Quest ----------
  function setupDifficulty(d) {
    diffKey = String(d || 'normal').toLowerCase();
    cfg = DIFF_TABLE[diffKey] || DIFF_TABLE.normal;

    if (diffKey === 'easy') {
      questMain.target = 350;
      questMini.target = 18;
      questHint = 'เริ่มจากหมู่อาหารหลัก เลือกแต่ของดี เลี่ยงของขยะ 🍚🥦';
    } else if (diffKey === 'hard') {
      questMain.target = 750;
      questMini.target = 26;
      questHint = 'โหมดยาก! ต้องเลือกอาหารดีจากทุกหมู่ให้เร็วและแม่น 💪';
    } else {
      questMain.target = 500;
      questMini.target = 22;
      questHint = 'จำหมู่ให้ครบ แล้วเลือกอาหารดีให้ถึงเป้าในเวลาจำกัด ⏱️';
    }
    questMain.prog = 0;
    questMini.prog = 0;
    questMain.done = false;
    questMini.done = false;

    emitQuestUpdate();
  }

  function emitQuestUpdate() {
    emit('quest:update', {
      goal: {
        label: questMain.label,
        target: questMain.target,
        prog: questMain.prog,
        done: questMain.done
      },
      mini: {
        label: questMini.label,
        target: questMini.target,
        prog: questMini.prog,
        done: questMini.done
      },
      hint: questHint
    });
  }

  function updateQuestByScoreAndHits() {
    questMain.prog = Math.min(score, questMain.target);
    questMini.prog = Math.min(goodHits, questMini.target);
    questMain.done = questMain.prog >= questMain.target;
    questMini.done = questMini.prog >= questMini.target;
    emitQuestUpdate();
  }

  // ---------- Score / HUD events ----------
  function emitScoreAndCombo() {
    emit('hha:score', {
      score,
      combo,
      misses
    });
  }

  function emitJudge(label) {
    emit('hha:judge', { label });
  }

  // ---------- Targets ----------
  function spawnTarget() {
    layer = layer || ensureLayer();
    if (!layer) return;

    if (targets.length >= cfg.maxActive) return;

    const isGood = Math.random() < cfg.goodRatio;
    const emoji = pickEmoji(isGood);
    const pos = randomScreenPos();

    const el = document.createElement('div');
    el.className = 'fg-target ' + (isGood ? 'fg-good' : 'fg-junk');
    el.style.position = 'absolute';
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.style.transform = 'translate(-50%, -50%) scale(' + (cfg.sizeFactor || 1) + ')';
    el.setAttribute('data-emoji', emoji);
    el.style.pointerEvents = 'auto';
    el.style.cursor = 'pointer';

    const targetObj = {
      el,
      isGood,
      spawnAt: gameTime,
      lifeMs: cfg.lifeMs || 2400,
      consumed: false
    };
    targets.push(targetObj);

    const onHit = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      handleHit(targetObj);
    };

    el.addEventListener('click', onHit);
    el.addEventListener('pointerdown', onHit);

    layer.appendChild(el);
  }

  function handleHit(target) {
    if (!running) return;
    if (!target || target.consumed) return;

    const el = target.el;
    if (!el || !el.parentNode) return;

    target.consumed = true;

    const age = Math.max(0, gameTime - target.spawnAt);
    const life = target.lifeMs || cfg.lifeMs || 2400;
    const ratio = clamp(age / life, 0, 1);

    let judgment = 'MISS';
    let delta = 0;
    let goodHit = false;

    if (target.isGood) {
      // PERFECT / GOOD / LATE
      if (ratio <= 0.35) {
        judgment = 'PERFECT';
        delta = 15;
      } else if (ratio <= 0.8) {
        judgment = 'GOOD';
        delta = 10;
      } else {
        judgment = 'LATE';
        delta = 5;
      }
      goodHit = true;
      goodHits += 1;
      combo += 1;
      comboMax = Math.max(comboMax, combo);
      updateFever(FEVER_HIT_GAIN + (judgment === 'PERFECT' ? 5 : 0));
    } else {
      // ตีโดนของขยะ = MISS
      judgment = 'MISS';
      delta = -10;
      misses += 1;
      combo = 0;
      updateFever(-FEVER_MISS_LOSS);
      emit('hha:miss', {});
    }

    score = Math.max(0, score + delta);
    emitScoreAndCombo();
    emitJudge(judgment);

    updateQuestByScoreAndHits();

    // FX
    try {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      const label = `${judgment} ${delta > 0 ? '+' + delta : delta}`;
      Particles.scorePop(x, y, label, { good: delta > 0 });
      Particles.burstAt(x, y, {
        color: goodHit ? '#22c55e' : '#f97316',
        count: goodHit ? 18 : 12,
        radius: 60
      });
    } catch (err) {
      console.warn('[FoodGroupsVR] FX error:', err);
    }

    el.classList.add('hit');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 120);

    targets = targets.filter(t => t !== target);
  }

  function handleTimeout(target) {
    if (!running) return;
    if (!target || target.consumed) return;

    const el = target.el;
    target.consumed = true;

    misses += 1;
    combo = 0;
    updateFever(-FEVER_MISS_LOSS);
    emitScoreAndCombo();
    emit('hha:miss', {});

    // FX miss
    try {
      if (el) {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        Particles.scorePop(x, y, 'MISS 0', { good: false });
        Particles.burstAt(x, y, {
          color: '#f97316',
          count: 10,
          radius: 50
        });
      }
    } catch (_) {}

    if (el && el.parentNode) {
      el.classList.add('hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 100);
    }

    targets = targets.filter(t => t !== target);
  }

  function clearTargets() {
    targets.forEach(t => {
      if (t && t.el && t.el.parentNode) {
        t.el.parentNode.removeChild(t.el);
      }
    });
    targets = [];
  }

  // ---------- Main loop ----------
  function loop(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;

    gameTime += dt;
    spawnTimer += dt;

    if (spawnTimer >= cfg.spawnInterval) {
      spawnTimer = 0;
      spawnTarget();
    }

    const lifeMs = cfg.lifeMs || 2400;
    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      if (!t || t.consumed) continue;
      const age = gameTime - t.spawnAt;
      if (age >= (t.lifeMs || lifeMs)) {
        handleTimeout(t);
      }
    }

    rafId = window.requestAnimationFrame(loop);
  }

  // ---------- Public API ----------
  function start(diff) {
    // reset state
    if (running) stop('restart');

    running = true;
    gameTime = 0;
    spawnTimer = 0;
    lastTs = 0;

    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    goodHits = 0;

    layer = ensureLayer();
    clearTargets();
    resetFever();
    setupDifficulty(diff || 'normal');

    emitScoreAndCombo();
    emitJudge('');

    // ให้โค้ชช่วยเตือน (HTML ฟัง hha:coach อยู่)
    emit('hha:coach', {
      text: 'จำหมู่อาหารให้ครบ แล้วเลือกแต่ของดีจากทุกหมู่ เลี่ยงของขยะให้ได้เยอะที่สุดนะ 🥦🍚🍊'
    });

    rafId = window.requestAnimationFrame(loop);
  }

  function stop(reason) {
    if (!running) return;
    running = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    clearTargets();

    const goalsCleared = questMain.done ? 1 : 0;
    const goalsTotal = 1;
    const miniCleared = questMini.done ? 1 : 0;
    const miniTotal = 1;

    emit('hha:end', {
      scoreFinal: score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal,
      reason: reason || 'manual'
    });
  }

  return {
    start,
    stop
  };
})();

// export สำหรับ groups-vr.html
export { GameEngine };