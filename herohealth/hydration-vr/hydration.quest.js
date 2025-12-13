// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest system สำหรับโหมด Hydration (ใช้ร่วมกับ hydration.safe.js)
//
// ดีไซน์ชุดนี้:
// - มี Goal หลัก "ตาม diff" จำนวน 2 ภารกิจต่อเกม
// - มี Mini quest จำนวน 3 ภารกิจต่อเกม
// - ใช้ state จาก stats เดียวกัน (score, goodCount, miss, tick, greenTick ฯลฯ)
// - getProgress('goals') คืน "รายการเต็มทุกภารกิจ" (ไม่ใช่แค่ตัว active เดียว)
//   → ให้ hydration.safe.js นับ Goals / Mini quests ได้ตรงกับสรุป

'use strict';

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

// ใช้ mark ว่าเป็นภารกิจเกี่ยวกับ "พลาดไม่เกิน..."
function isMissQuest (item) {
  const id = String(item.id || '').toLowerCase();
  const label = String(item.label || '');
  if (id.includes('nomiss') || id.includes('miss')) return true;
  if (label.includes('พลาด')) return true;
  return false;
}

/**
 * สร้าง Deck สำหรับ Hydration ที่ใช้กับ hydration.safe.js
 * คืน object ที่มี:
 *   stats, updateScore, updateCombo, onGood, onJunk, second,
 *   getProgress(kind), drawGoals(), draw3()
 */
export function createHydrationQuest (diffRaw = 'normal') {
  const diff = normalizeHydrationDiff(diffRaw);

  // ดึงภารกิจตามระดับความยาก
  const goals = hydrationGoalsFor(diff).map(q => ({
    ...q,
    _done: false,
    _value: 0,
    _isMiss: isMissQuest(q)
  }));

  const minis = hydrationMinisFor(diff).map(q => ({
    ...q,
    _done: false,
    _value: 0,
    _isMiss: isMissQuest(q)
  }));

  // stats ที่ hydration.safe.js จะ sync เข้ามา
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

    goals.forEach(updateItem);
    minis.forEach(updateItem);
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

  // แปลง internal quest → view ที่ safe.js / HUD ใช้
  function makeView (arr) {
    return arr.map(q => ({
      id: q.id,
      label: q.label,
      target: q.target,
      prog: q._value,
      done: !!q._done,
      isMiss: !!q._isMiss
    }));
  }

  /**
   * getProgress(kind):
   *   - 'goals' → คืน goal ทั้ง 2 ภารกิจ (พร้อม field done)
   *   - 'mini'  → คืน mini ทั้ง 3 ภารกิจ
   *   - อื่น ๆ  → รวมทั้งสองกลุ่ม
   * safe.js จะใช้ข้อมูลนี้ไปนับ goalsDone / minisDone / goalsTotal / minisTotal
   */
  function getProgress (kind) {
    if (kind === 'goals') return makeView(goals);
    if (kind === 'mini')  return makeView(minis);
    return [
      ...makeView(goals),
      ...makeView(minis)
    ];
  }

  // สำหรับ compatibility กับ safe.js (ถึงจะไม่ได้ใช้ก็ให้มีไว้)
  function drawGoals () {}
  function draw3 () {}

  // initial sync ครั้งแรก
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