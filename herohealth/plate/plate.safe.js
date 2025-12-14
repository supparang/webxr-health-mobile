// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — Safe Engine (DOM targets projected from 3D world)
// คุณสมบัติ:
// - เป้าแต่ละอันมีตำแหน่ง 3D รอบตัวผู้เล่น (radius ~ 4m)
// - ใช้ THREE + A-Frame camera project 3D → 2D ให้ .hha-target ขยับตามมุมกล้อง
// - โหมด play: ขนาดเป้า base ตาม diff + adaptive ตามฝีมือ
// - โหมด research: ขนาดเป้า base ตาม diff (ไม่ adaptive)
// - Fixed Quest: Goal 2 + Mini quest 3 ใช้ชุดเดียวกันทุกเกม
// - ยิง event:
//   - hha:stat       -> HUD คะแนน ฯลฯ
//   - quest:update   -> HUD quest bar
//   - hha:end        -> summary ตอนจบเกม

'use strict';

// ---------- Config ความยาก & ขนาดเป้า ----------

const DIFF_CONFIG = {
  easy: {
    spawnMs: 1300,
    maxActive: 4,
    baseScale: 1.18  // เป้าใหญ่สุด
  },
  normal: {
    spawnMs: 950,
    maxActive: 5,
    baseScale: 1.0
  },
  hard: {
    spawnMs: 750,
    maxActive: 6,
    baseScale: 0.85 // เป้าเล็กสุด
  }
};

// ขอบเขตการ adaptive (เทียบกับ baseScale)
const ADAPT_MIN = 0.7;
const ADAPT_MAX = 1.4;

// ---------- ชุดอาหาร (ตัวอย่าง) ----------

const FOODS = [
  // group 1 ข้าว-แป้ง
  { emoji: '🍚', group: 1, good: true },
  { emoji: '🍞', group: 1, good: true },
  { emoji: '🍜', group: 1, good: false },

  // group 2 โปรตีน
  { emoji: '🍗', group: 2, good: true },
  { emoji: '🥚', group: 2, good: true },
  { emoji: '🍖', group: 2, good: false },

  // group 3 ผัก
  { emoji: '🥦', group: 3, good: true },
  { emoji: '🥕', group: 3, good: true },
  { emoji: '🍟', group: 3, good: false },

  // group 4 ผลไม้
  { emoji: '🍎', group: 4, good: true },
  { emoji: '🍌', group: 4, good: true },
  { emoji: '🍩', group: 4, good: false },

  // group 5 นม
  { emoji: '🥛', group: 5, good: true },
  { emoji: '🧀', group: 5, good: true },
  { emoji: '🧋', group: 5, good: false }
];

// ---------- Fixed Quests: Goal 2 + Mini 3 ----------

function makeFixedQuests() {
  const goals = [
    {
      id: 'plate-goal-plates-3',
      label: 'ทำจานสมดุลให้ได้ 3 จาน',
      target: 3,
      prog: 0,
      done: false,
      kind: 'plates'
    },
    {
      id: 'plate-goal-vegfruit-10',
      label: 'เก็บผัก + ผลไม้ รวม 10 ชิ้น',
      target: 10,
      prog: 0,
      done: false,
      kind: 'vegfruit'
    }
  ];

  const minis = [
    {
      id: 'plate-mini-miss-5',
      label: 'MISS ไม่เกิน 5 ครั้ง',
      target: 5,
      prog: 0,
      done: false,
      kind: 'miss-max'
    },
    {
      id: 'plate-mini-combo-8',
      label: 'ทำคอมโบให้ถึง 8',
      target: 8,
      prog: 0,
      done: false,
      kind: 'combo-max'
    },
    {
      id: 'plate-mini-protein-6',
      label: 'เก็บโปรตีนอย่างน้อย 6 ชิ้น',
      target: 6,
      prog: 0,
      done: false,
      kind: 'protein'
    }
  ];

  return { goals, minis };
}

// ---------- Helper ----------

function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function pickRandom(arr) {
  if (!arr || !arr.length) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// ---------- Particles (optional) ----------

function getParticlesAPI() {
  const gm = window.GAME_MODULES || {};
  return gm.Particles || window.Particles || null;
}

// ---------- Engine หลัก ----------

export function boot(opts = {}) {
  const diffKey = String(opts.difficulty || 'normal').toLowerCase();
  const durationSec = Number(opts.duration || 60) || 60;

  const cfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;

  const runMode = String(window.HHA_RUNMODE || 'play').toLowerCase();
  const adaptiveEnabled = (runMode === 'play'); // research = no adaptive

  let adaptFactor = 1.0;
  function getCurrentScale() {
    return cfg.baseScale * adaptFactor;
  }

  const sceneEl = document.querySelector('a-scene');
  const cameraEl = document.querySelector('#plate-camera');
  const THREE = window.THREE;

  if (!sceneEl || !cameraEl || !THREE) {
    console.error('[PlateVR] scene/camera/THREE not ready');
  }

  let cameraObj = null;
  if (cameraEl && THREE) {
    cameraObj = cameraEl.getObject3D('camera') || cameraEl.object3D;
  }

  // --------- state หลัก ----------

  let gameOver = false;
  let spawnTimer = null;

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  let hitsGood = 0;
  let totalShots = 0;

  let platesDone = 0;
  const groupCounts = [0, 0, 0, 0, 0];

  let vegFruitCount = 0;
  let proteinCount = 0;

  let missStreak = 0;

  const { goals, minis } = makeFixedQuests();

  // DOM target list (แต่อิงตำแหน่ง 3D)
  const activeTargets = new Map(); // id -> { el, food, pos:{x,y,z} }
  let nextTargetId = 1;

  // --------- HUD / Events ----------

  function emitStat() {
    window.dispatchEvent(new CustomEvent('hha:stat', {
      detail: {
        score,
        combo,
        misses,
        platesDone,
        totalCounts: groupCounts.slice()
      }
    }));
  }

  function emitCoach(text) {
    if (!text) return;
    window.dispatchEvent(new CustomEvent('hha:coach', {
      detail: { text }
    }));
  }

  function emitQuestUpdate() {
    // sync prog จาก state
    goals.forEach(g => {
      if (g.kind === 'plates') {
        g.prog = platesDone;
        g.done = g.prog >= g.target;
      } else if (g.kind === 'vegfruit') {
        g.prog = vegFruitCount;
        g.done = g.prog >= g.target;
      }
    });

    minis.forEach(m => {
      if (m.kind === 'miss-max') {
        m.prog = misses;
        m.done = (misses <= m.target && gameOver) ? true : false;
        if (!gameOver) m.done = false;
      } else if (m.kind === 'combo-max') {
        m.prog = comboMax;
        m.done = m.prog >= m.target;
      } else if (m.kind === 'protein') {
        m.prog = proteinCount;
        m.done = m.prog >= m.target;
      }
    });

    const currentGoal = goals.find(g => !g.done) || goals[goals.length - 1];
    const currentMini = minis.find(m => !m.done) || minis[minis.length - 1];

    let hint = '';
    if (currentGoal && currentGoal.kind === 'plates') {
      hint = 'โฟกัสจัดจานให้ครบก่อน แล้วค่อยเก็บเงื่อนไขย่อย ✨';
    } else if (currentGoal && currentGoal.kind === 'vegfruit') {
      hint = 'ลองเน้นผัก 🥦 และผลไม้ 🍎 เพิ่มขึ้นอีกหน่อย';
    }

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goalsAll: goals,
        minisAll: minis,
        goal: currentGoal,
        mini: currentMini,
        hint
      }
    }));
  }

  function endGame(reason) {
    if (gameOver) return;
    gameOver = true;

    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnTimer = null;
    }

    // ลบเป้าทั้งหมด
    activeTargets.forEach(t => {
      if (t.el && t.el.parentNode) {
        t.el.parentNode.removeChild(t.el);
      }
    });
    activeTargets.clear();

    emitQuestUpdate();

    const goalsCleared = goals.filter(g => g.done).length;
    const minisCleared = minis.filter(m => m.done).length;
    const allCleared = (goalsCleared === goals.length && minisCleared === minis.length);

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        reason,
        score,
        comboMax,
        misses,
        platesDone,
        groupCounts: groupCounts.slice(),
        goalsCleared,
        goalsTotal: goals.length,
        questsCleared: minisCleared,
        questsTotal: minis.length,
        allCleared
      }
    }));

    if (allCleared) {
      emitCoach('สุดยอดเลย! ทำครบทั้ง Goal และ Mini quest แล้ว 🎉');
    } else {
      emitCoach('จบเกมแล้ว รอบหน้าลองเก็บให้ครบทุกภารกิจดูนะ ✨');
    }
  }

  // ---------- Adaptive size (เฉพาะ Play) ----------

  function maybeUpdateAdaptiveSize() {
    if (!adaptiveEnabled) return;

    if (totalShots < 8) return;
    const accuracy = hitsGood / totalShots;

    if (accuracy > 0.85 && comboMax >= 10 && missStreak <= 1) {
      adaptFactor = clamp(adaptFactor - 0.08, ADAPT_MIN, ADAPT_MAX);
    } else if (accuracy < 0.6 || missStreak >= 3) {
      adaptFactor = clamp(adaptFactor + 0.08, ADAPT_MIN, ADAPT_MAX);
      missStreak = 0;
    }
  }

  // ---------- 3D → 2D projection ----------

  function projectWorldToScreen(pos3) {
    if (!cameraObj || !THREE) return null;

    const v = new THREE.Vector3(pos3.x, pos3.y, pos3.z);
    v.project(cameraObj); // NDC

    // ถ้าอยู่ข้างหลังกล้อง หรือไกลเกิน
    if (v.z > 1 || v.z < -1) {
      return null;
    }

    const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;

    return { x: sx, y: sy };
  }

  function applyTargetStyle(el) {
    const scale = getCurrentScale();
    el.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(2)})`;
  }

  function updateTargetScreenPositions() {
    if (gameOver) return;

    activeTargets.forEach(t => {
      if (!t.el || !t.pos) return;
      const screen = projectWorldToScreen(t.pos);
      if (!screen) {
        t.el.style.display = 'none';
        return;
      }
      t.el.style.display = 'flex';
      t.el.style.left = screen.x + 'px';
      t.el.style.top = screen.y + 'px';
      applyTargetStyle(t.el);
    });
  }

  function startDomUpdateLoop() {
    function loop() {
      if (gameOver) return;
      updateTargetScreenPositions();
      window.requestAnimationFrame(loop);
    }
    window.requestAnimationFrame(loop);
  }

  // ---------- สร้าง / ลบเป้า ----------

  function spawnTarget() {
    if (gameOver) return;
    if (activeTargets.size >= cfg.maxActive) return;

    const food = pickRandom(FOODS);
    if (!food) return;

    const id = nextTargetId++;

    // ตำแหน่งในโลก 3D (วงรอบตัวผู้เล่น)
    const radius = 4.0;
    const yawDeg = randomBetween(-80, 80); // กระจายด้านหน้า
    const yawRad = yawDeg * Math.PI / 180;
    const height = randomBetween(1.1, 2.0);

    const pos = {
      x: Math.sin(yawRad) * radius,
      y: height,
      z: -Math.cos(yawRad) * radius
    };

    const el = document.createElement('div');
    el.className = 'hha-target ' + (food.good ? 'hha-target-good' : 'hha-target-bad');
    el.textContent = food.emoji;

    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '360';

    // click ยิงเป้า
    el.addEventListener('click', () => {
      handleHit(id);
    });

    document.body.appendChild(el);

    activeTargets.set(id, { id, el, food, pos });

    // อายุของเป้า (ไม่ถือเป็น MISS ถ้าหายไปเอง)
    const lifeMs = 3500;
    setTimeout(() => {
      if (gameOver) return;
      if (!activeTargets.has(id)) return;
      removeTarget(id, /*byTimeout*/true);
    }, lifeMs);
  }

  function removeTarget(id, byTimeout) {
    const t = activeTargets.get(id);
    if (!t) return;
    if (t.el && t.el.parentNode) {
      t.el.parentNode.removeChild(t.el);
    }
    activeTargets.delete(id);
  }

  // ---------- ยิงเป้า ----------

  function handleHit(id) {
    if (gameOver) return;
    const t = activeTargets.get(id);
    if (!t) return;

    const { food, el } = t;

    totalShots++;

    if (food.good) {
      hitsGood++;
      combo++;
      missStreak = 0;

      score += 100;
      comboMax = Math.max(comboMax, combo);

      const idx = (food.group || 1) - 1;
      if (idx >= 0 && idx < groupCounts.length) {
        groupCounts[idx]++;
      }

      if (food.group === 3 || food.group === 4) {
        vegFruitCount++;
      }
      if (food.group === 2) {
        proteinCount++;
      }

      if (hitsGood % 5 === 0) {
        platesDone++;
        emitCoach(`เยี่ยมมาก! ตอนนี้จัดจานสมดุลได้ ${platesDone} จานแล้ว 🍽️`);
      }

      // effect ตีเป้าแตก
      const P = getParticlesAPI();
      if (P && el) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        if (P.burstAt) {
          P.burstAt(cx, cy, {
            color: '#22c55e',
            count: 18
          });
        }
        if (P.scorePop) {
          P.scorePop(cx, cy, '+100', {
            judgment: 'GOOD',
            good: true
          });
        }
      }
    } else {
      // โดนของไม่ดี = MISS
      misses++;
      combo = 0;
      missStreak++;

      emitCoach('มีของไม่ดีหลุดเข้าจาน ลองเน้นผัก ผลไม้ และนมเพิ่มอีกหน่อยนะ 😌');

      const P = getParticlesAPI();
      if (P && el) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        if (P.burstAt) {
          P.burstAt(cx, cy, {
            color: '#f97316',
            count: 14
          });
        }
        if (P.scorePop) {
          P.scorePop(cx, cy, 'MISS', {
            judgment: 'MISS',
            good: false
          });
        }
      }

      // แจ้ง HUD miss แบบกลางให้ด้วย (ถ้า HTML ฟัง event นี้อยู่)
      window.dispatchEvent(new CustomEvent('hha:miss', { detail: {} }));
    }

    emitStat();
    emitQuestUpdate();
    maybeUpdateAdaptiveSize();

    removeTarget(id, /*byTimeout*/false);
  }

  // ---------- ฟัง hha:time ----------

  function onTimeTick(e) {
    if (!e || !e.detail) return;
    const sec = e.detail.sec | 0;
    if (sec <= 0 && !gameOver) {
      endGame('timeup');
    }
  }

  window.addEventListener('hha:time', onTimeTick);

  // ---------- Init ----------

  (function init() {
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    hitsGood = 0;
    totalShots = 0;
    platesDone = 0;
    vegFruitCount = 0;
    proteinCount = 0;
    missStreak = 0;
    for (let i = 0; i < groupCounts.length; i++) groupCounts[i] = 0;

    emitStat();
    emitQuestUpdate();

    if (runMode === 'research') {
      emitCoach('โหมดวิจัย: ขนาดเป้าคงที่ตามระดับความยาก เพื่อให้เงื่อนไขการทดลองเหมือนกันทุกคน 🎓');
    } else {
      emitCoach('โหมดเล่นธรรมดา: เริ่มจากระดับ ' +
        diffKey.toUpperCase() +
        ' ถ้าเล่นเก่ง เป้าจะค่อย ๆ เล็กลงให้ท้าทายขึ้น ✨');
    }

    // เริ่ม spawn เป้า
    spawnTimer = setInterval(spawnTarget, cfg.spawnMs);

    // loop อัปเดตตำแหน่งเป้าให้หมุนตามกล้อง
    startDomUpdateLoop();

    window.addEventListener('beforeunload', () => {
      endGame('unload');
      window.removeEventListener('hha:time', onTimeTick);
    });

    // เผื่อกล้อง reload / เปลี่ยน object
    setTimeout(() => {
      if (cameraEl) {
        cameraObj = cameraEl.getObject3D('camera') || cameraEl.object3D;
      }
    }, 500);
  })();
}
