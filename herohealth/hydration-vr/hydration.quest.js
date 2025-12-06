// === /herohealth/hydration-vr/hydration.quest.js ===
// Deck ภารกิจสำหรับโหมด Hydration
// เงื่อนไข:
//   - goal สุ่มจากทั้งหมด 10 ใบ (2 ใบใช้งานพร้อมกัน)  → MissionDeck ดูแลอยู่แล้ว
//   - mini quest สุ่มจาก 15 ใบ (3 ใบใช้งานพร้อมกัน)
//   - เควสต์ประเภท “พลาดไม่เกิน … / miss ≤ …” ต้องมา “ท้ายสุด”
//   - โหมด easy จะไม่ใช้เควสต์แบบพลาดไม่เกินเลย (ง่ายจริง ๆ)
//   - โหมด normal / hard มีเควสต์พลาดไม่เกิน แต่จะเริ่มใช้เมื่อเควสต์ชุดอื่นหมดก่อน

import { MissionDeck } from '../vr/mission.js';
import { hydrationGoalsFor } from './hydration.goals.js';
import { hydrationMinisFor } from './hydration.minis.js';
import { normalizeHydrationDiff } from './hydration.state.js';

// ----------------- helper แยก pool -----------------

function isMissLimitMission(m) {
  const txt = (m.label || m.title || m.text || m.desc || '').toString();
  return /พลาดไม่เกิน|miss/i.test(txt);
}

/**
 * แยก mission ออกเป็น 2 กลุ่ม
 *  - basePool  : ภารกิจทั่วไป (ง่าย–กลาง)
 *  - missPool  : ภารกิจแบบ "พลาดไม่เกิน …" (ยากสุด)
 *  - ถ้า diff = 'easy' จะตัด missPool ทิ้งไปเลย
 */
function splitPool(pool, diff) {
  const basePool = [];
  const missPool = [];

  for (const m of (pool || [])) {
    const miss = isMissLimitMission(m);

    if (diff === 'easy' && miss) {
      // โหมดง่าย: ไม่เอาเควสต์พลาดเลย
      continue;
    }
    if (miss) {
      missPool.push(m);
    } else {
      basePool.push(m);
    }
  }

  return { basePool, missPool };
}

// ------------------------------------------------------------------
// createHydrationQuest(diff)
//   ใช้ MissionDeck 2 กอง:
//     - baseDeck: เควสต์ทั่วไป (ออกก่อน)
//     - missDeck: เควสต์พลาดไม่เกิน (ออกทีหลัง เมื่อ baseDeck เคลียร์แล้ว)
//   แล้วห่อเป็น “เด็คตัวกลาง” ที่มี API เหมือน MissionDeck
// ------------------------------------------------------------------

export function createHydrationQuest(diffRaw = 'normal') {
  const diff = normalizeHydrationDiff(diffRaw); // 'easy' | 'normal' | 'hard'

  // ดึงภารกิจตามระดับที่ออกแบบไว้ (10 goals / 15 minis ต่อระดับ)
  const goalsAll = hydrationGoalsFor(diff);
  const minisAll = hydrationMinisFor(diff);

  // แยก pool ตามประเภท
  const { basePool: goalBase,  missPool: goalMiss }  = splitPool(goalsAll, diff);
  const { basePool: miniBase,  missPool: miniMiss }  = splitPool(minisAll, diff);

  // deck หลัก (ภารกิจทั่วไป)
  const baseDeck = new MissionDeck({
    goalPool: goalBase,
    miniPool: miniBase
  });

  // deck ภารกิจพลาด (อาจไม่มีถ้า diff = easy)
  const hasMissPool = (goalMiss.length > 0 || miniMiss.length > 0);
  const missDeck = hasMissPool
    ? new MissionDeck({
        goalPool: goalMiss,
        miniPool: miniMiss
      })
    : null;

  // ให้ stats ใช้ object ร่วมกันกับ hydration.safe.js
  const sharedStats = {
    greenTick: 0,
    zone: 'GREEN'
  };
  baseDeck.stats = sharedStats;
  if (missDeck) missDeck.stats = sharedStats;

  // phase ปัจจุบันของ goal / mini
  //   'base' = ยังใช้เด็คทั่วไป
  //   'miss' = เริ่มใช้เด็คพลาดแล้ว
  let goalPhase = 'base';
  let miniPhase = 'base';

  // ----------------- wrapper deck -----------------

  const deck = {
    stats: sharedStats,

    // score/combo เดินเหมือนเดิม แต่ broadcast ให้ทั้งสองเด็ค
    updateScore(v) {
      if (typeof baseDeck.updateScore === 'function') baseDeck.updateScore(v);
      if (missDeck && typeof missDeck.updateScore === 'function') missDeck.updateScore(v);
    },

    updateCombo(v) {
      if (typeof baseDeck.updateCombo === 'function') baseDeck.updateCombo(v);
      if (missDeck && typeof missDeck.updateCombo === 'function') missDeck.updateCombo(v);
    },

    onGood() {
      if (typeof baseDeck.onGood === 'function') baseDeck.onGood();
      if (missDeck && typeof missDeck.onGood === 'function') missDeck.onGood();
    },

    onJunk() {
      if (typeof baseDeck.onJunk === 'function') baseDeck.onJunk();
      if (missDeck && typeof missDeck.onJunk === 'function') missDeck.onJunk();
    },

    second() {
      if (typeof baseDeck.second === 'function') baseDeck.second();
      if (missDeck && typeof missDeck.second === 'function') missDeck.second();
    },

    /**
     * getProgress('goals' | 'mini')
     *   - ขณะยังอยู่ phase 'base' ให้ใช้ของ baseDeck ก่อน
     *   - ถ้าเคลียร์หมดแล้วค่อยสลับไป missDeck
     */
    getProgress(kind) {
      if (kind !== 'goals' && kind !== 'mini') {
        return baseDeck.getProgress ? baseDeck.getProgress(kind) : [];
      }

      const baseList = baseDeck.getProgress ? (baseDeck.getProgress(kind) || []) : [];
      const missList = missDeck && missDeck.getProgress
        ? (missDeck.getProgress(kind) || [])
        : [];

      const hasBaseActive = baseList.some(m => !m.done);
      const hasMissActive = missList.some(m => !m.done);

      if (kind === 'goals') {
        // ถ้ายังใช้ phase base อยู่ และยังมี goal ปกติให้เล่น → return base ก่อน
        if (goalPhase === 'base' && (hasBaseActive || !missDeck)) {
          return baseList;
        }
        // เริ่มใช้ missDeck
        goalPhase = 'miss';
        return missList.length ? missList : baseList;
      }

      // kind === 'mini'
      if (miniPhase === 'base' && (hasBaseActive || !missDeck)) {
        return baseList;
      }
      miniPhase = 'miss';
      return missList.length ? missList : baseList;
    },

    /**
     * drawGoals(2) – เรียกจาก hydration.safe.js
     *   - ถ้ายังมี goal ปกติที่ยังไม่เสร็จ → อยู่ใน phase base ต่อ
     *   - ถ้า goal ปกติหมดและมี missDeck → สลับไป phase 'miss'
     */
    drawGoals(n) {
      if (typeof baseDeck.getProgress === 'function') {
        const g = baseDeck.getProgress('goals') || [];
        const hasBaseActive = g.some(x => !x.done);
        if (!hasBaseActive && missDeck) {
          goalPhase = 'miss';
        }
      }

      if (goalPhase === 'base' || !missDeck) {
        if (typeof baseDeck.drawGoals === 'function') baseDeck.drawGoals(n);
      } else if (typeof missDeck.drawGoals === 'function') {
        missDeck.drawGoals(n);
      }
    },

    /**
     * drawMini(3) หรือ draw3() – แล้วแต่ MissionDeck ที่คุณใช้เดิม
     *   เราพยายามรองรับทั้งสองแบบ
     */
    drawMini(n) {
      if (typeof baseDeck.getProgress === 'function') {
        const m = baseDeck.getProgress('mini') || baseDeck.getProgress('minis') || [];
        const hasBaseActive = m.some(x => !x.done);
        if (!hasBaseActive && missDeck) {
          miniPhase = 'miss';
        }
      }

      if (miniPhase === 'base' || !missDeck) {
        if (typeof baseDeck.drawMini === 'function') {
          baseDeck.drawMini(n);
        } else if (typeof baseDeck.draw3 === 'function') {
          baseDeck.draw3();
        }
      } else if (missDeck) {
        if (typeof missDeck.drawMini === 'function') {
          missDeck.drawMini(n);
        } else if (typeof missDeck.draw3 === 'function') {
          missDeck.draw3();
        }
      }
    },

    // เผื่อ hydration.safe.js ยังเรียกชื่อเดิม draw3()
    draw3() {
      this.drawMini(3);
    }
  };

  return deck;
}

export default { createHydrationQuest };
