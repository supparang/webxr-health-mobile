// === /HeroHealth/modes/plate.quest.js (2025-11-13 FULL, 5-Group Plate) ===
import { MissionDeck } from '../vr/mission.js';

// กำหนดจำนวน "จาน 5 หมู่" ตามระดับความยาก
const PLATE_TARGET = {
  easy:   2,   // ต้องจัดให้ครบ 2 จาน
  normal: 3,   // 3 จาน
  hard:   4    // 4 จาน
};

// ประมาณจำนวนชิ้นอาหารต่อจาน (ใช้กับตัวเลขเป้าใน progress bar)
const ITEMS_PER_PLATE = {
  easy:   6,   // แป้ง 1, โปรตีน 1, ผัก 2, ผลไม้ 1, นม 1  ~ 6 ชิ้น
  normal: 7,   // เพิ่มผัก/ผลไม้ขึ้นเล็กน้อย
  hard:   8    // 5 หมู่ครบ + ผัก/ผลไม้เพิ่ม
};

// แปลง diff ให้ปลอดภัย
function normDiff(diff){
  const d = String(diff||'normal').toLowerCase();
  return (d === 'easy' || d === 'hard') ? d : 'normal';
}

// ---------- Goal (จาน 5 หมู่) ----------

function makeMainGoal(diff){
  const d = normDiff(diff);
  const plateCount = PLATE_TARGET[d] || 3;
  const perPlate   = ITEMS_PER_PLATE[d] || 7;
  const target     = plateCount * perPlate;

  return {
    id: 'plate-main',
    label: `จัด “จาน 5 หมู่” ให้ครบ ${plateCount} จาน`,
    target,
    // ใช้จำนวนของดีที่วางถูกที่เป็นตัวแทนความคืบหน้า
    prog(stats){
      return (stats && stats.goodCount) ? stats.goodCount|0 : 0;
    },
    check(stats){
      const good = (stats && stats.goodCount) ? stats.goodCount|0 : 0;
      return good >= target;
    }
  };
}

// ---------- Mini Quest Pool ----------

function makeMiniPool(diff){
  const d = normDiff(diff);

  const comboNeed = (d === 'easy') ? 8 : (d === 'hard' ? 16 : 12);
  const missAllow = (d === 'easy') ? 6 : (d === 'hard' ? 3 : 4);
  const goodBurst = (d === 'easy') ? 10 : (d === 'hard' ? 20 : 15);

  return [
    {
      id: 'plate_combo',
      label: `ทำคอมโบต่อเนื่อง ${comboNeed} ครั้ง`,
      target: comboNeed,
      prog(stats){
        return (stats && stats.comboMax) ? stats.comboMax|0 : 0;
      },
      check(stats){
        const mx = (stats && stats.comboMax) ? stats.comboMax|0 : 0;
        return mx >= comboNeed;
      }
    },
    {
      id: 'plate_low_miss',
      label: `พลาด (หยิบผิด/ของเสีย) ไม่เกิน ${missAllow} ครั้ง`,
      target: missAllow,
      // แสดงจำนวนครั้งที่พลาดไปแล้ว
      prog(stats){
        return (stats && stats.junkMiss) ? stats.junkMiss|0 : 0;
      },
      check(stats){
        const miss = (stats && stats.junkMiss) ? stats.junkMiss|0 : 0;
        return miss <= missAllow;
      }
    },
    {
      id: 'plate_good_focus',
      label: `จัดของดีให้ถูกหมู่รวมอย่างน้อย ${goodBurst} ชิ้น`,
      target: goodBurst,
      prog(stats){
        return (stats && stats.goodCount) ? stats.goodCount|0 : 0;
      },
      check(stats){
        const good = (stats && stats.goodCount) ? stats.goodCount|0 : 0;
        return good >= goodBurst;
      }
    }
  ];
}

// ---------- Factory สร้าง MissionDeck สำหรับโหมด plate ----------

export function createPlateDeck(options = {}){
  const diff = normDiff(options.difficulty || options.diff || 'normal');

  const goal  = makeMainGoal(diff);
  const minis = makeMiniPool(diff);

  // สร้าง Deck
  const deck = new MissionDeck({
    goalPool: [goal],
    miniPool: minis
  });

  // เลือกเป้า (มี goal เดียว แต่เรียกตามรูปแบบเดียวกับโหมดอื่น)
  deck.drawGoals(1);
  deck.draw3();   // random mini quests 3 อันแรก

  return deck;
}

// default export เผื่อโหมด import แบบ default
export default {
  createPlateDeck
};
