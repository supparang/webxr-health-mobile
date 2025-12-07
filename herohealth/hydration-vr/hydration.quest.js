// === /herohealth/hydration-vr/hydration.quest.js ===
// Mission Deck สำหรับ Hydration VR
// - Goal: สุ่ม 2 จาก 10
// - Mini quest: สุ่ม 3 จาก 15
// - เควสต์ "พลาดไม่เกิน..." จะอยู่ในกลุ่ม miss-type และถูกสุ่มหลังสุด
// 2025-12-07

'use strict';

// -----------------------------
// 1) ค่าพื้นฐานตามระดับความยาก
// -----------------------------
function diffConfig(diffKey) {
  const d = String(diffKey || 'normal').toLowerCase();
  if (d === 'easy') {
    return {
      missGoalCap: 4,
      missMiniCap: 8,
      goodGoal1: 10,
      goodGoal2: 14,
      comboGoal: 6,
      comboGoalHard: 8,
      streakMini1: 5,
      streakMini2: 6,
      greenSec1: 12,
      greenSec2: 18,
      accGoal: 80,
      accMini: 75
    };
  }
  if (d === 'hard') {
    return {
      missGoalCap: 6,
      missMiniCap: 5,
      goodGoal1: 16,
      goodGoal2: 20,
      comboGoal: 10,
      comboGoalHard: 12,
      streakMini1: 8,
      streakMini2: 10,
      greenSec1: 20,
      greenSec2: 26,
      accGoal: 90,
      accMini: 85
    };
  }
  // normal (default)
  return {
    missGoalCap: 5,
    missMiniCap: 6,
    goodGoal1: 12,
    goodGoal2: 16,
    comboGoal: 8,
    comboGoalHard: 10,
    streakMini1: 6,
    streakMini2: 8,
    greenSec1: 16,
    greenSec2: 22,
    accGoal: 85,
    accMini: 80
  };
}

// -----------------------------
// 2) สร้าง Template Goals / Minis
// -----------------------------
function buildGoalTemplates(cfg) {
  // ทั้งหมด 10 เป้า (แยก non-miss / miss)
  const nonMiss = [
    {
      id: 'G_GOOD_TOTAL_1',
      kind: 'goodTotal',
      label: `เก็บน้ำดีอย่างน้อย ${cfg.goodGoal1} ครั้ง`,
      target: cfg.goodGoal1
    },
    {
      id: 'G_GOOD_TOTAL_2',
      kind: 'goodTotal',
      label: `เก็บน้ำดีอย่างน้อย ${cfg.goodGoal2} ครั้ง`,
      target: cfg.goodGoal2
    },
    {
      id: 'G_COMBO_MAX',
      kind: 'comboMax',
      label: `คอมโบสูงสุดให้ถึงอย่างน้อย x${cfg.comboGoal}`,
      target: cfg.comboGoal
    },
    {
      id: 'G_COMBO_MAX_HARD',
      kind: 'comboMax',
      label: `คอมโบสูงสุดให้ถึงอย่างน้อย x${cfg.comboGoalHard}`,
      target: cfg.comboGoalHard
    },
    {
      id: 'G_ACC',
      kind: 'accuracy',
      label: `ความแม่นยำไม่ต่ำกว่า ${cfg.accGoal}%`,
      target: cfg.accGoal
    },
    {
      id: 'G_GREEN_TIME_1',
      kind: 'greenTime',
      label: `อยู่ในโซน GREEN อย่างน้อย ${cfg.greenSec1} วินาที`,
      target: cfg.greenSec1
    },
    {
      id: 'G_GREEN_TIME_2',
      kind: 'greenTime',
      label: `อยู่ในโซน GREEN อย่างน้อย ${cfg.greenSec2} วินาที`,
      target: cfg.greenSec2
    }
  ];

  const missType = [
    {
      id: 'G_MISS_CAP',
      kind: 'missCap',
      label: `พลาดไม่เกิน ${cfg.missGoalCap}`,
      target: cfg.missGoalCap,
      isMissType: true
    },
    {
      id: 'G_MISS_RATE',
      kind: 'missRate',
      label: 'พลาดให้น้อยกว่า 20% ของทั้งหมด',
      target: 20,
      isMissType: true
    },
    {
      id: 'G_LOW_ZONE',
      kind: 'avoidLow',
      label: 'อยู่โซน LOW ให้น้อยกว่า ¼ ของเวลา',
      target: 25, // เปอร์เซ็นต์เวลา LOW สูงสุด
      isMissType: true
    }
  ];

  return { nonMiss, missType };
}

function buildMiniTemplates(cfg) {
  // 15 mini quest (5 easy-ish + 5 medium + 5 hard-ish), แบ่ง non-miss / miss
  const nonMiss = [
    // EASY-LIKE
    {
      id: 'M_STREAK_GOOD_1',
      kind: 'goodStreak',
      label: `เก็บน้ำดีต่อเนื่องให้ได้ ${cfg.streakMini1} ครั้ง`,
      target: cfg.streakMini1
    },
    {
      id: 'M_STREAK_GOOD_2',
      kind: 'goodStreak',
      label: `เก็บน้ำดีต่อเนื่องให้ได้ ${cfg.streakMini2} ครั้ง`,
      target: cfg.streakMini2
    },
    {
      id: 'M_COMBO_REACH_1',
      kind: 'comboReach',
      label: 'ทำคอมโบให้ถึงอย่างน้อย x4 สัก 1 ครั้ง',
      target: 4
    },
    {
      id: 'M_COMBO_REACH_2',
      kind: 'comboReach',
      label: 'ทำคอมโบให้ถึงอย่างน้อย x6 สัก 1 ครั้ง',
      target: 6
    },
    {
      id: 'M_ACC_MID',
      kind: 'accuracy',
      label: `รักษาความแม่นยำไม่ต่ำกว่า ${cfg.accMini}%`,
      target: cfg.accMini
    },

    // MEDIUM
    {
      id: 'M_GOOD_TOTAL_1',
      kind: 'goodTotal',
      label: 'เก็บน้ำดีอย่างน้อย 10 ครั้ง',
      target: 10
    },
    {
      id: 'M_GREEN_TICKS',
      kind: 'greenTime',
      label: 'อยู่โซน GREEN ต่อเนื่องให้ได้อย่างน้อย 8 วินาที',
      target: 8
    },
    {
      id: 'M_COMBO_CHAIN',
      kind: 'comboChain',
      label: 'ทำคอมโบ ≥ x5 ให้ได้อย่างน้อย 2 ครั้งในเกมเดียว',
      target: 5, // เก็บที่ค่า combo, ใช้นับจำนวนครั้งใน state
      extra: { neededTimes: 2 }
    },
    {
      id: 'M_FAST_START',
      kind: 'fastStart',
      label: 'ใน 20 วินาทีแรก ให้คอมโบสูงสุดถึงอย่างน้อย x4',
      target: 4
    },
    {
      id: 'M_GREEN_BONUS',
      kind: 'greenBonus',
      label: 'จบเกมด้วยโซนน้ำ GREEN',
      target: 1
    }
  ];

  const missType = [
    {
      id: 'M_MISS_CAP_ALL',
      kind: 'missCap',
      label: `ทั้งเกมพลาดไม่เกิน ${cfg.missMiniCap}`,
      target: cfg.missMiniCap,
      isMissType: true
    },
    {
      id: 'M_MISS_STREAK',
      kind: 'avoidMissStreak',
      label: 'อย่าพลาดติดกันเกิน 2 ครั้ง',
      target: 2,
      isMissType: true
    },
    {
      id: 'M_BAD_RATIO',
      kind: 'missRate',
      label: 'เก็บน้ำไม่ดี (junk) ไม่เกิน ¼ ของทั้งหมด',
      target: 25,
      isMissType: true
    },
    {
      id: 'M_LOW_AVOID',
      kind: 'avoidLow',
      label: 'ระวังอย่าให้โซนน้ำตกไป LOW บ่อยเกินไป',
      target: 30,
      isMissType: true
    },
    {
      id: 'M_ZERO_MISS_WINDOW',
      kind: 'zeroMissWindow',
      label: 'เล่นแบบไม่พลาดเลย 10 วินาทีติดกันสัก 1 ครั้ง',
      target: 10,
      isMissType: true
    }
  ];

  return { nonMiss, missType };
}

// -----------------------------
// 3) ตัวช่วยสุ่ม & clone
// -----------------------------
function randPick(arr) {
  if (!arr.length) return null;
  const i = Math.floor(Math.random() * arr.length);
  return arr.splice(i, 1)[0];
}

function cloneQuest(q) {
  return {
    id: q.id,
    kind: q.kind,
    label: q.label,
    target: q.target || 0,
    prog: 0,
    done: false,
    isMissType: !!q.isMissType,
    extra: q.extra ? { ...q.extra } : undefined
  };
}

// -----------------------------
// 4) สร้าง Deck หลัก
// -----------------------------
export function createHydrationQuest(diffKey) {
  const cfg = diffConfig(diffKey);

  // สถานะรวมสำหรับนับสถิติ
  const stats = {
    score: 0,
    combo: 0,
    comboMax: 0,
    goodHits: 0,
    badHits: 0, // ใช้แทน miss
    totalHits: 0,
    greenTick: 0, // จะถูก hydration.safe.js เซ็ตจากภายนอก
    zone: 'GREEN',
    secPlayed: 0,
    secNoMissStreak: 0,
    missStreak: 0,
    goodStreak: 0,
    maxGoodStreak: 0,
    fastWindowMaxCombo: 0, // ภายใน 20 วินาทีแรก
    timesComboGE5: 0
  };

  // template pool
  const goalTpl = buildGoalTemplates(cfg);
  const miniTpl = buildMiniTemplates(cfg);

  // pool ที่จะถูกใช้สุ่มจริง (clone แยก)
  const poolGoalsNonMiss = goalTpl.nonMiss.map(cloneQuest);
  const poolGoalsMiss    = goalTpl.missType.map(cloneQuest);
  const poolMiniNonMiss  = miniTpl.nonMiss.map(cloneQuest);
  const poolMiniMiss     = miniTpl.missType.map(cloneQuest);

  // เควสต์ที่ "ใช้งานอยู่" ตอนนี้
  let activeGoals = [];
  let activeMini  = [];

  // -------------------------
  // 4.1 ฟังก์ชันคำนวณ progress
  // -------------------------
  function updateQuestProgress(q) {
    switch (q.kind) {
      case 'goodTotal': {
        q.prog = Math.min(stats.goodHits, q.target);
        q.done = stats.goodHits >= q.target;
        break;
      }
      case 'comboMax': {
        q.prog = Math.min(stats.comboMax, q.target);
        q.done = stats.comboMax >= q.target;
        break;
      }
      case 'accuracy': {
        const total = stats.totalHits || 1;
        const acc = (stats.goodHits / total) * 100;
        q.prog = Math.round(acc);
        q.done = acc >= q.target;
        break;
      }
      case 'greenTime': {
        q.prog = Math.min(stats.greenTick, q.target);
        q.done = stats.greenTick >= q.target;
        break;
      }
      case 'missCap': {
        q.prog = Math.min(stats.badHits, q.target);
        q.done = stats.badHits <= q.target;
        break;
      }
      case 'missRate': {
        const total2 = stats.totalHits || 1;
        const missPct = (stats.badHits / total2) * 100;
        q.prog = Math.round(missPct);
        q.done = missPct <= q.target;
        break;
      }
      case 'avoidLow': {
        // ประเมินแบบง่าย ๆ: ถ้า zone ส่วนใหญ่เป็น GREEN/HIGH ถือว่าผ่าน
        // ให้ใช้ greenTick เป็นตัวแทน "ไม่ LOW มาก"
        const sec = stats.secPlayed || 1;
        const lowSec = Math.max(0, sec - stats.greenTick);
        const lowPct = (lowSec / sec) * 100;
        q.prog = Math.round(lowPct);
        q.done = lowPct <= q.target;
        break;
      }

      // -------- Mini-only kinds --------
      case 'goodStreak': {
        q.prog = Math.min(stats.maxGoodStreak, q.target);
        q.done = stats.maxGoodStreak >= q.target;
        break;
      }
      case 'comboReach': {
        q.prog = Math.min(stats.comboMax, q.target);
        q.done = stats.comboMax >= q.target;
        break;
      }
      case 'comboChain': {
        q.prog = Math.min(stats.timesComboGE5, (q.extra && q.extra.neededTimes) || 2);
        q.done = stats.timesComboGE5 >= ((q.extra && q.extra.neededTimes) || 2);
        break;
      }
      case 'fastStart': {
        q.prog = Math.min(stats.fastWindowMaxCombo, q.target);
        q.done = stats.fastWindowMaxCombo >= q.target;
        break;
      }
      case 'greenBonus': {
        q.prog = stats.zone === 'GREEN' ? 1 : 0;
        q.done = stats.zone === 'GREEN';
        break;
      }
      case 'avoidMissStreak': {
        q.prog = stats.missStreak;
        q.done = stats.missStreak <= q.target;
        break;
      }
      case 'zeroMissWindow': {
        q.prog = Math.min(stats.secNoMissStreak, q.target);
        q.done = stats.secNoMissStreak >= q.target;
        break;
      }
      default:
        break;
    }
  }

  function updateAllProgress() {
    activeGoals.forEach(updateQuestProgress);
    activeMini.forEach(updateQuestProgress);
  }

  // -------------------------
  // 4.2 ฟังก์ชันสุ่ม Goal / Mini
  // -------------------------
  function drawGoals(count) {
    const result = [];

    // เลือกจาก non-miss ก่อน
    while (result.length < count && poolGoalsNonMiss.length) {
      const q = randPick(poolGoalsNonMiss);
      if (q) result.push(q);
    }
    // ถ้ายังไม่ครบ ค่อยดึง miss-type
    while (result.length < count && poolGoalsMiss.length) {
      const q = randPick(poolGoalsMiss);
      if (q) result.push(q);
    }

    activeGoals = result;
    updateAllProgress();
    return activeGoals;
  }

  function draw3() {
    const result = [];

    while (result.length < 3 && poolMiniNonMiss.length) {
      const q = randPick(poolMiniNonMiss);
      if (q) result.push(q);
    }
    while (result.length < 3 && poolMiniMiss.length) {
      const q = randPick(poolMiniMiss);
      if (q) result.push(q);
    }

    activeMini = result;
    updateAllProgress();
    return activeMini;
  }

  // -------------------------
  // 4.3 Hook จากเกมหลัก
  // -------------------------
  function updateScore(v) {
    stats.score = Number(v) || 0;
  }

  function updateCombo(v) {
    const c = Number(v) || 0;
    stats.combo = c;
    if (c > stats.comboMax) stats.comboMax = c;

    // ใช้ combo สำหรับนับ timesComboGE5
    if (c >= 5) {
      // ถ้าเพิ่งข้าม threshold ให้เพิ่ม 1 ครั้ง
      if (!stats._lastComboGE5) {
        stats.timesComboGE5 += 1;
        stats._lastComboGE5 = true;
      }
    } else {
      stats._lastComboGE5 = false;
    }

    // ภายใน 20 วินาทีแรก ใช้ max combo สำหรับ fastStart
    if (stats.secPlayed <= 20 && c > stats.fastWindowMaxCombo) {
      stats.fastWindowMaxCombo = c;
    }

    updateAllProgress();
  }

  function onGood() {
    stats.goodHits += 1;
    stats.totalHits += 1;
    stats.goodStreak += 1;
    if (stats.goodStreak > stats.maxGoodStreak) stats.maxGoodStreak = stats.goodStreak;

    // reset miss streak
    stats.missStreak = 0;

    updateAllProgress();
  }

  function onJunk() {
    stats.badHits += 1;
    stats.totalHits += 1;

    stats.goodStreak = 0;
    stats.missStreak += 1;
    stats.secNoMissStreak = 0; // รีเซ็ต streak แบบ "ไม่พลาดเลย"

    updateAllProgress();
  }

  // เรียกทุก 1 วินาทีจาก hydration.safe.js
  function second() {
    stats.secPlayed += 1;

    // ถ้าไม่มี miss ใหม่ในวินาทีนั้น (ใช้ missStreak เป็นตัวบอกคร่าว ๆ)
    if (stats.missStreak === 0) {
      stats.secNoMissStreak += 1;
    } else {
      // วินาทีนี้มี miss แล้ว ถูกรีเซ็ตใน onJunk ไปแล้ว
    }

    updateAllProgress();
  }

  // -------------------------
  // 4.4 อ่าน progress ให้ HUD
  // -------------------------
  function getProgress(kind) {
    if (kind === 'goals') {
      return activeGoals.map(q => ({
        id: q.id,
        label: q.label,
        prog: q.prog,
        target: q.target,
        done: !!q.done
      }));
    }
    if (kind === 'mini') {
      return activeMini.map(q => ({
        id: q.id,
        label: q.label,
        prog: q.prog,
        target: q.target,
        done: !!q.done
      }));
    }
    return [];
  }

  // -------------------------
  // 4.5 คืนค่าตัว deck
  // -------------------------
  const deck = {
    stats,              // hydration.safe.js จะเซ็ต zone / greenTick เพิ่ม
    updateScore,
    updateCombo,
    onGood,
    onJunk,
    second,
    getProgress,
    drawGoals,
    draw3
  };

  return deck;
}

// เผื่อกรณี import default
export default { createHydrationQuest };
