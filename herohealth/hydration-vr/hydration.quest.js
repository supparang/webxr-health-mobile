// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest system สำหรับโหมด Hydration (ใช้ร่วมกับ hydration.safe.js)
//
// คุณสมบัติ:
// - แยก goal / mini ตาม diff: easy / normal / hard (จาก hydration.goals/minis)
// - เลือก goal ทีละ 2 จาก pool 10 อัน
// - เลือก mini ทีละ 3 จาก pool 15 อัน
// - ภารกิจกลุ่ม "พลาดไม่เกิน ..." (nomiss / miss) จะถูกสุ่มใช้ทีหลังสุด
// - ภายในแต่ละกลุ่ม (ปกติ / miss) จัดลำดับจากง่าย → ยาก ตาม target
// - ส่งข้อมูลให้ HUD ผ่าน getProgress('goals'|'mini') เป็น {id,label,target,prog,done}

import { hydrationGoalsFor } from './hydration.goals.js';
import { hydrationMinisFor } from './hydration.minis.js';
import { mapHydrationState, normalizeHydrationDiff } from './hydration.state.js';

/**
 * แบ่งประเภท goal/mini:
 * - isMiss: ภารกิจเกี่ยวกับ "พลาดไม่เกิน", "MISS" ฯลฯ
 * ใช้ทั้ง id และ label ในการเดา
 */
function isMissQuest(item) {
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
function decorateQuest(item) {
  const q = { ...item };
  q._isMiss = isMissQuest(item);
  const t = Number(item.target || 0);

  if (q._isMiss) {
    // พลาดได้เยอะ → ง่ายกว่า → score สูง
    q._difficultyScore = isNaN(t) ? 0 : t * 1; // target มาก = ง่าย
  } else {
    // ภารกิจทั่วไป → target น้อย = ง่าย
    q._difficultyScore = isNaN(t) ? 0 : -t;    // target มาก = ยาก
  }

  // runtime state
  q._done = false;
  q._value = 0;

  return q;
}

/**
 * แยกเป็น 2 กลุ่ม: nonMiss / miss แล้วจัดเรียงตามความง่าย
 */
function splitAndSort(pool) {
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
function takeOne(arr, random = true) {
  if (!arr.length) return null;
  if (!random) return arr.shift();
  const idx = Math.floor(Math.random() * arr.length);
  const item = arr[idx];
  arr.splice(idx, 1);
  return item;
}

/**
 * แปลง list ของ quest ให้เหลือ "ตัวที่กำลังทำอยู่ทีละ 1 อัน" สำหรับ HUD
 * - ถ้ามี quest ที่ยังไม่ done → แสดงอันแรกนั้น
 * - ถ้าทำครบทุกอันแล้ว → แสดงบรรทัดสรุปว่าเคลียร์ครบแล้ว (x/x)
 * - ถ้า list ว่าง → คืนข้อความว่า "ยังไม่มีภารกิจในรอบนี้"
 */
function singleActiveView(arr, labelPrefix) {
  if (!arr || !arr.length) {
    return [{
      id: `${labelPrefix.toLowerCase()}-none`,
      label: `ยังไม่มี ${labelPrefix} ในรอบนี้`,
      target: 0,
      prog: 0,
      done: false,
      isMiss: false
    }];
  }

  const active = arr.find(q => !q._done);
  if (active) {
    return [{
      id: active.id,
      label: active.label,
      target: active.target,
      prog: active._value,
      done: !!active._done,
      isMiss: !!active._isMiss
    }];
  }

  const total   = arr.length;
  const cleared = arr.filter(q => q._done).length;

  return [{
    id: `${labelPrefix.toLowerCase()}-summary`,
    label: `${labelPrefix}: สำเร็จครบแล้ว (${cleared}/${total}) 🎉`,
    target: total,
    prog: cleared,
    done: true,
    isMiss: false
  }];
}

/**
 * สร้าง Deck สำหรับ Hydration ที่ใช้กับ hydration.safe.js
 * คืน object ที่มี:
 *   stats, updateScore, updateCombo, onGood, onJunk, second,
 *   getProgress(kind), drawGoals(n), draw3()
 */
export function createHydrationQuest(diffRaw = 'normal') {
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
  let activeGoals = [];
  let activeMinis = [];

  // stats ที่ hydration.safe.js จะใช้ mapHydrationState()
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
  function refreshProgress() {
    const s = mapHydrationState(stats);

    function updateItem(q) {
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

  function updateScore(v) {
    stats.score = Number(v) || 0;
    refreshProgress();
  }

  function updateCombo(v) {
    const c = Number(v) || 0;
    stats.combo = c;
    if (c > stats.comboMax) stats.comboMax = c;
    refreshProgress();
  }

  function onGood() {
    stats.goodCount += 1;
    refreshProgress();
  }

  function onJunk() {
    stats.junkMiss += 1;
    refreshProgress();
  }

  function second() {
    stats.tick += 1;
    refreshProgress();
  }

  /**
   * สุ่ม goal ชุดใหม่:
   * - เลือกจาก nonMiss ก่อนจนหมด แล้วค่อยใช้ miss
   * - n ปกติ = 2 (ตามที่ hydration.safe.js เรียก)
   */
  function drawGoals(n = 2) {
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

    // ถ้าใช้หมดแล้วทั้งสอง bucket → reset loop ใหม่ (เผื่อเล่นนาน)
    if (!goalsNonMissLeft.length && !goalsMissLeft.length) {
      goalsNonMissLeft = [...goalBuckets.nonMiss];
      goalsMissLeft    = [...goalBuckets.miss];
    }

    refreshProgress();
  }

  /**
   * สุ่ม mini quest 3 อัน:
   * - เลือก nonMiss ก่อน แล้วค่อย miss
   * - hydration.safe.js เรียกผ่าน deck.draw3()
   */
  function draw3() {
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
   * คืน progress ตามประเภท (ใช้ single-active view)
   * - 'goals' → goal ปัจจุบันทีละ 1 อัน (จากชุด 2)
   * - 'mini'  → mini ปัจจุบันทีละ 1 อัน (จากชุด 3)
   * ถ้า list ว่าง จะสุ่มชุดใหม่ก่อนเสมอ
   */
  function getProgress(kind) {
    if (kind === 'goals') {
      if (!activeGoals.length) {
        drawGoals(2);
      }
      return singleActiveView(activeGoals, 'Goal');
    }

    if (kind === 'mini') {
      if (!activeMinis.length) {
        draw3();
      }
      return singleActiveView(activeMinis, 'Mini quest');
    }

    // กรณีขอรวม
    if (!activeGoals.length) {
      drawGoals(2);
    }
    if (!activeMinis.length) {
      draw3();
    }

    return [
      ...singleActiveView(activeGoals, 'Goal'),
      ...singleActiveView(activeMinis, 'Mini quest')
    ];
  }

  // ----- เริ่มต้นครั้งแรก -----
  drawGoals(2);
  draw3();

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