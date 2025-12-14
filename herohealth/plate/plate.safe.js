// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — Safe Engine (DOM targets + fixed quests + adaptive size in Play)
//
// คุณสมบัติ:
// - อ่านโหมดจาก window.HHA_RUNMODE  -> 'play' หรือ 'research'
//   - play: ขนาดเป้า = base ตาม diff แล้ว adaptive ตามฝีมือ
//   - research: ขนาดเป้า = base ตาม diff แบบคงที่ (no adaptive)
// - diff = easy / normal / hard มีผลต่อ spawn rate, maxActive, baseScale
// - Goal = 2 ภารกิจหลัก, Mini = 3 ภารกิจย่อย ใช้ชุดเดียวกันทุกเกม (fixed)
// - ยิง event ให้ HUD:
//   - hha:stat    -> { score, combo, misses, platesDone, totalCounts }
//   - quest:update-> { goalsAll, minisAll, goal, mini, hint }
//   - hha:end     -> summary เมื่อจบเกม
// - ใช้ .hha-target (DOM emoji) ให้คลิก / gaze ยิงได้

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
//
// ถ้าเดิมคุณมี data แยกไฟล์อยู่ สามารถเปลี่ยนมาใช้ชุดนั้นแทนได้
// ตอนนี้ใช้ emoji ง่าย ๆ ให้ขั้นต่ำเล่นได้จริง

const FOODS = [
  // group 1 ข้าว-แป้ง (ส่วนใหญ่ good)
  { emoji: '🍚', group: 1, good: true },
  { emoji: '🍞', group: 1, good: true },
  { emoji: '🍜', group: 1, good: false }, // บะหมี่น้ำมันเยิ้ม

  // group 2 โปรตีน
  { emoji: '🍗', group: 2, good: true },
  { emoji: '🥚', group: 2, good: true },
  { emoji: '🍖', group: 2, good: false }, // มันเยอะ

  // group 3 ผัก
  { emoji: '🥦', group: 3, good: true },
  { emoji: '🥕', group: 3, good: true },
  { emoji: '🍟', group: 3, good: false }, // เฟรนช์ฟรายส์

  // group 4 ผลไม้
  { emoji: '🍎', group: 4, good: true },
  { emoji: '🍌', group: 4, good: true },
  { emoji: '🍩', group: 4, good: false }, // ของหวานจัด

  // group 5 นม
  { emoji: '🥛', group: 5, good: true },
  { emoji: '🧀', group: 5, good: true },
  { emoji: '🧋', group: 5, good: false }  // ชานมหวานมาก
];

// ---------- Fixed Quests: Goal 2 + Mini 3 ----------
//
// ใช้ชุดเดียวกันทุกเกม (ไม่สุ่ม)

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
      prog: 0,     // ใช้สะสมจำนวน MISS
      done: false,
      kind: 'miss-max'
    },
    {
      id: 'plate-mini-combo-8',
      label: 'ทำคอมโบให้ถึง 8',
      target: 8,
      prog: 0,     // comboMax
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

// ---------- Helper ทั่วไป ----------

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

// ---------- Engine หลัก ----------

export function boot(opts = {}) {
  const diffKey = String(opts.difficulty || 'normal').toLowerCase();
  const durationSec = Number(opts.duration || 60) || 60;

  const cfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;

  const runMode = String(window.HHA_RUNMODE || 'play').toLowerCase();
  const adaptiveEnabled = (runMode === 'play'); // โหมดวิจัย = ปิด adaptive

  // scale ปัจจุบัน = baseScale * adaptFactor
  let adaptFactor = 1.0;

  function getCurrentScale() {
    return cfg.baseScale * adaptFactor;
  }

  // state หลักของเกม
  let gameOver = false;
  let spawnTimer = null;

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  let hitsGood = 0;
  let totalShots = 0;

  let platesDone = 0;
  const groupCounts = [0, 0, 0, 0, 0]; // 1..5

  let vegFruitCount = 0; // group 3+4
  let proteinCount = 0;  // group 2

  // ใช้ตัดสิน adaptive
  let missStreak = 0;

  // Quest
  const { goals, minis } = makeFixedQuests();

  // จัดการ active targets
  const activeTargets = new Map(); // id -> { el, food }
  let nextTargetId = 1;

  // --------- HUD / Event helper ----------

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
    // ผูก prog กับ state ปัจจุบัน
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
        // ระหว่างเกมยังไม่รู้ว่าจะจบต่ำกว่าหรือเปล่า จึงถือว่าทำไม่เสร็จไปก่อน
        if (!gameOver) m.done = false;
      } else if (m.kind === 'combo-max') {
        m.prog = comboMax;
        m.done = m.prog >= m.target;
      } else if (m.kind === 'protein') {
        m.prog = proteinCount;
        m.done = m.prog >= m.target;
      }
    });

    // เลือก goal / mini ปัจจุบัน (อันที่ยังไม่ done)
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

    // เคลียร์เป้าที่เหลือ
    activeTargets.forEach(t => {
      if (t.el && t.el.parentNode) {
        t.el.parentNode.removeChild(t.el);
      }
    });
    activeTargets.clear();

    emitQuestUpdate(); // อัปเดตสถานะ mini miss-max ตอนจบเกมด้วย

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

  // ---------- Adaptive target size (เฉพาะ Play mode) ----------

  function maybeUpdateAdaptiveSize() {
    if (!adaptiveEnabled) return; // โหมดวิจัยไม่ adaptive

    if (totalShots < 8) return; // ยังน้อยไป ไม่ต้องขยับ
    const accuracy = hitsGood / totalShots;

    // เงื่อนไขคร่าว ๆ:
    // - แม่นมาก (accuracy > 0.85 และ comboMax >= 10) → ทำให้ยากขึ้น (เป้าเล็กลง)
    // - พลาดบ่อย (accuracy < 0.6 หรือ missStreak >= 3) → ทำให้ง่ายขึ้น (เป้าใหญ่ขึ้น)

    if (accuracy > 0.85 && comboMax >= 10 && missStreak <= 1) {
      adaptFactor = clamp(adaptFactor - 0.08, ADAPT_MIN, ADAPT_MAX);
    } else if (accuracy < 0.6 || missStreak >= 3) {
      adaptFactor = clamp(adaptFactor + 0.08, ADAPT_MIN, ADAPT_MAX);
      missStreak = 0; // ผ่อนให้แล้ว reset streak
    }

    // ไม่ต้อง emit อะไรเป็นพิเศษ เป้าถัดไปจะใช้ scale ใหม่อัตโนมัติ
  }

  // ---------- สร้าง / ลบเป้า ----------

  function applyTargetStyle(el) {
    const scale = getCurrentScale();
    el.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(2)})`;
  }

  function spawnTarget() {
    if (gameOver) return;
    if (activeTargets.size >= cfg.maxActive) return;

    const food = pickRandom(FOODS);
    if (!food) return;

    const id = nextTargetId++;
    const el = document.createElement('div');
    el.className = 'hha-target ' + (food.good ? 'hha-target-good' : 'hha-target-bad');
    el.textContent = food.emoji;

    // หาตำแหน่งแบบสุ่ม (เลี่ยง HUD บน/ล่าง)
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const marginX = 70;
    const topSafe = 90;
    const bottomSafe = 220;

    const x = randomBetween(marginX, vw - marginX);
    const y = randomBetween(topSafe, vh - bottomSafe);

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    applyTargetStyle(el);

    const targetObj = { id, el, food };
    activeTargets.set(id, targetObj);

    // handler ยิงเป้า
    el.addEventListener('click', () => {
      handleHit(targetObj);
    });

    document.body.appendChild(el);

    // ให้เป้าอยู่สักพักแล้วหายไปเอง
    const lifeMs = 3500;
    setTimeout(() => {
      if (!activeTargets.has(id) || gameOver) return;
      // ไม่ถือว่าเป็น MISS เพื่อไม่ให้ดุเกินไป
      removeTarget(id);
    }, lifeMs);
  }

  function removeTarget(id) {
    const t = activeTargets.get(id);
    if (!t) return;
    if (t.el && t.el.parentNode) {
      t.el.parentNode.removeChild(t.el);
    }
    activeTargets.delete(id);
  }

  // ---------- ยิงเป้า ----------

  function handleHit(targetObj) {
    if (!targetObj || gameOver) return;

    const { id, el, food } = targetObj;

    // ป้องกันยิงซ้ำ
    if (!activeTargets.has(id)) return;

    totalShots++;

    if (food.good) {
      // โดนของดี
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

      // ทุก ๆ 5 hit นับเป็น 1 "จานสมดุล" แบบง่าย ๆ
      if (hitsGood % 5 === 0) {
        platesDone++;
        emitCoach(`เยี่ยมมาก! ตอนนี้จัดจานสมดุลได้ ${platesDone} จานแล้ว 🍽️`);
      }
    } else {
      // โดนของไม่ดี = MISS
      misses++;
      combo = 0;
      missStreak++;

      emitCoach('มีของไม่ดีหลุดเข้ามาในจาน ลองเน้นผัก ผลไม้ และนมเพิ่มอีกหน่อยนะ 😌');
    }

    emitStat();
    emitQuestUpdate();
    maybeUpdateAdaptiveSize();

    // ลบเป้า
    removeTarget(id);
  }

  // ---------- ผูกกับตัวจับเวลา hha:time ----------

  function onTimeTick(e) {
    if (!e || !e.detail) return;
    const sec = e.detail.sec | 0;
    if (sec <= 0 && !gameOver) {
      endGame('timeup');
    }
  }

  window.addEventListener('hha:time', onTimeTick);

  // ---------- Boot ตอนเริ่มเกม ----------

  (function init() {
    // เริ่มด้วยสถานะเริ่มต้น
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

    // ข้อความโค้ชเปิดเกม
    if (runMode === 'research') {
      emitCoach('โหมดวิจัย: ขนาดเป้าคงที่ตามระดับความยาก เพื่อให้เงื่อนไขการทดลองเหมือนกันทุกคน 🎓');
    } else {
      emitCoach('โหมดเล่นธรรมดา: เริ่มจากระดับ ' + diffKey.toUpperCase() +
        ' ถ้าเล่นเก่งเป้าจะค่อย ๆ เล็กลงให้ท้าทายขึ้น ✨');
    }

    // เริ่ม spawn เป้า
    spawnTimer = setInterval(spawnTarget, cfg.spawnMs);

    // กันกรณีแท็บหาย / unload แล้วไม่เคลียร์
    window.addEventListener('beforeunload', () => {
      endGame('unload');
      window.removeEventListener('hha:time', onTimeTick);
    });
  })();
}
