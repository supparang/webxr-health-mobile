// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest system สำหรับโหมด Hydration (ใช้ร่วมกับ hydration.safe.js)
//
// คุณสมบัติ:
// - แยก goal / mini ตาม diff: easy / normal / hard (จาก hydration.goals/minis)
// - ทั้งเกมมี 2 goals และ 3 mini quests (จำนวนจริงต่อเกมไปกำหนดที่ safe.js)
// - ภารกิจกลุ่ม "พลาดไม่เกิน ..." (nomiss / miss) จะถูกสุ่มใช้ทีหลังสุด
// - ภายในแต่ละกลุ่ม (ปกติ / miss) จัดลำดับจากง่าย → ยาก ตาม target
// - ส่งข้อมูลให้ HUD ผ่าน getProgress('goals'|'mini') เป็น "รายการทั้งหมด"
//   แล้วให้ safe.js เป็นคนเลือกว่าจะโชว์อันไหนเป็นปัจจุบัน

import { hydrationGoalsFor } from './hydration.goals.js';
import { hydrationMinisFor } from './hydration.minis.js';

// ---------- helper แปลง diff ----------
function normalizeHydrationDiff (raw) {
  const t = String(raw || 'normal').toLowerCase();
  if (t === 'easy' || t === 'normal' || t === 'hard') return t;
  return 'normal';
}

// ---------- helper map stats → state ที่ quest ใช้ ----------
function mapHydrationState (stats) {
  const s = stats || {};
  const tick = Number(s.tick || 0);
  const greenTick = Number(s.greenTick || 0);

  return {
    // คะแนน / combo
    score: Number(s.score || 0),
    combo: Number(s.combo || 0),
    comboMax: Number(s.comboMax || 0),

    // นับเป้าดี / miss
    good: Number(s.goodCount || 0),
    goodCount: Number(s.goodCount || 0),
    miss: Number(s.junkMiss || 0),
    junkMiss: Number(s.junkMiss || 0),

    // เวลา
    timeSec: tick,
    tick,

    // เวลาโซนเขียว
    greenTick,
    greenRatio: tick > 0 ? greenTick / tick : 0,

    // โซนล่าสุด
    zone: s.zone || 'GREEN'
  };
}

/**
 * แบ่งประเภท goal/mini:
 * - isMiss: ภารกิจเกี่ยวกับ "พลาดไม่เกิน", "MISS" ฯลฯ
 */
function isMissQuest (item) {
  const id = String(item.id || '').toLowerCase();
  const label = String(item.label || '');
  if (id.includes('nomiss') || id.includes('miss')) return true;
  if (label.includes('พลาด')) return true;
  return false;
}

/**
 * สร้าง meta ให้แต่ละ quest สำหรับจัดลำดับง่าย → ยาก
 * - ภารกิจทั่วไป: target น้อย → ง่าย
 * - ภารกิจ miss: target มาก → ง่าย (พลาดได้เยอะ = ง่าย)
 */
function decorateQuest (item) {
  const q = { ...item };
  q._isMiss = isMissQuest(item);
  const t = Number(item.target || 0);

  if (q._isMiss) {
    // พลาดได้เยอะ → ง่ายกว่า
    q._difficultyScore = isNaN(t) ? 0 : t;
  } else {
    // target มาก = ยาก
    q._difficultyScore = isNaN(t) ? 0 : -t;
  }

  // runtime state
  q._done = false;
  q._value = 0;

  return q;
}

/**
 * แยกเป็น 2 กลุ่ม: nonMiss / miss แล้วจัดเรียงตามความง่าย
 */
function splitAndSort (pool) {
  const decorated = pool.map(decorateQuest);

  const nonMiss = decorated
    .filter(q => !q._isMiss)
    .sort((a, b) => a._difficultyScore - b._difficultyScore);

  const miss = decorated
    .filter(q => q._isMiss)
    .sort((a, b) => a._difficultyScore - b._difficultyScore);

  return { nonMiss, miss };
}

/**
 * สุ่มหยิบ 1 ตัวจาก array แล้วเอาออก (ถ้า random = true)
 */
function takeOne (arr, random = true) {
  if (!arr.length) return null;
  if (!random) return arr.shift();
  const idx = Math.floor(Math.random() * arr.length);
  const item = arr[idx];
  arr.splice(idx, 1);
  return item;
}

// ======================================================
//  สร้าง Deck สำหรับ Hydration ที่ใช้กับ hydration.safe.js
// ======================================================
export function createHydrationQuest (diffRaw = 'normal') {
  const diff = normalizeHydrationDiff(diffRaw);

  // ดึง pool ตาม diff (easy / normal / hard)
  const goalPool = hydrationGoalsFor(diff);
  const miniPool = hydrationMinisFor(diff);

  // แยก nonMiss / miss + จัดง่าย → ยาก
  const goalBuckets = splitAndSort(goalPool);
  const miniBuckets = splitAndSort(miniPool);

  // เหลือให้สุ่ม
  let goalsNonMissLeft = [...goalBuckets.nonMiss];
  let goalsMissLeft    = [...goalBuckets.miss];

  let minisNonMissLeft = [...miniBuckets.nonMiss];
  let minisMissLeft    = [...miniBuckets.miss];

  // active ชุดปัจจุบัน
  //   - goal: 2 อันต่อเกม
  //   - mini: 3 อันต่อเกม
  let activeGoals = [];
  let activeMinis = [];

  // stats ที่ hydration.safe.js จะ sync เข้า
  const stats = {
    score: 0,
    combo: 0,
    comboMax: 0,
    goodCount: 0,
    junkMiss: 0,
    tick: 0,        // เวลาเล่นสะสม (sec) — เพิ่มใน second()
    greenTick: 0,   // อัปเดตจาก hydration.safe.js
    zone: 'GREEN'
  };

  // ----- helper: refresh สถานะ done / prog ของทุก quest -----
  function refreshProgress () {
    const s = mapHydrationState(stats);

    // กันเคสเริ่มเกมปุ๊บภารกิจครบ (ยังไม่เริ่มเล่นจริง)
    if (s.tick <= 0 && s.goodCount <= 0 && s.junkMiss <= 0) {
      activeGoals.forEach(q => { q._done = false; q._value = 0; });
      activeMinis.forEach(q => { q._done = false; q._value = 0; });
      return;
    }

    function updateItem (q) {
      try {
        const done = typeof q.check === 'function' ? !!q.check(s) : false;
        const val  = typeof q.prog === 'function' ? q.prog(s) : 0;
        q._done   = done;
        q._value  = val;
      } catch (e) {
        q._done  = false;
        q._value = 0;
      }
    }

    activeGoals.forEach(updateItem);
    activeMinis.forEach(updateItem);
  }

  // ----- API ที่ hydration.safe.js จะเรียก -----

  function updateScore (v) {
    stats.score = Number(v) || 0;
    refreshProgress();
  }

  function updateCombo (v) {
    const c = Number(v) || 0;
    stats.combo = c;
    if (c > stats.comboMax) stats.comboMax = c;
    refreshProgress();
  }

  function onGood () {
    stats.goodCount += 1;
    refreshProgress();
  }

  function onJunk () {
    stats.junkMiss += 1;
    refreshProgress();
  }

  function second () {
    stats.tick += 1;
    refreshProgress();
  }

  /**
   * สุ่ม goal 2 อันสำหรับเกมนี้
   */
  function drawGoals (n = 2) {
    activeGoals = [];

    for (let i = 0; i < n; i++) {
      const pool = goalsNonMissLeft.length ? goalsNonMissLeft : goalsMissLeft;
      if (!pool.length) break;
      const q = takeOne(pool, true);
      if (q) {
        q._done = false;
        q._value = 0;
        activeGoals.push(q);
      }
    }

    // ถ้าใช้หมดแล้วทั้งสอง bucket → reset loop ใหม่ (เผื่อเล่นนาน / เล่นหลายเกม)
    if (!goalsNonMissLeft.length && !goalsMissLeft.length) {
      goalsNonMissLeft = [...goalBuckets.nonMiss];
      goalsMissLeft    = [...goalBuckets.miss];
    }

    refreshProgress();
  }

  /**
   * สุ่ม mini quest 3 อันสำหรับเกมนี้
   */
  function draw3 () {
    const n = 3;
    activeMinis = [];

    for (let i = 0; i < n; i++) {
      const pool = minisNonMissLeft.length ? minisNonMissLeft : minisMissLeft;
      if (!pool.length) break;
      const q = takeOne(pool, true);
      if (q) {
        q._done = false;
        q._value = 0;
        activeMinis.push(q);
      }
    }

    if (!minisNonMissLeft.length && !minisMissLeft.length) {
      minisNonMissLeft = [...miniBuckets.nonMiss];
      minisMissLeft    = [...miniBuckets.miss];
    }

    refreshProgress();
  }

  /**
   * คืน progress ตามประเภท
   *   - 'goals' → goal ทั้ง 2 อัน (พร้อม field done/prog)
   *   - 'mini'  → mini ทั้ง 3 อัน
   * safe.js จะเป็นคนเลือกเองว่าอันไหนคือ current
   */
  function getProgress (kind) {
    if (kind === 'goals') {
      if (!activeGoals.length) {
        drawGoals(2);
      }
      return activeGoals;
    }

    if (kind === 'mini') {
      if (!activeMinis.length) {
        draw3();
      }
      return activeMinis;
    }

    // กรณีขอรวม (ถ้าอนาคตอยากใช้)
    if (!activeGoals.length) drawGoals(2);
    if (!activeMinis.length) draw3();

    return [...activeGoals, ...activeMinis];
  }

  // ----- เริ่มต้นครั้งแรก -----
  drawGoals(2); // เตรียม goal 2 อัน
  draw3();      // เตรียม mini 3 อัน
  refreshProgress();

  return {
    stats,
    updateScore,
    updateCombo,
    onGood,
    onJunk,
    second,
    getProgress,
    drawGoals,
    draw3
  };
}

export default { createHydrationQuest };
