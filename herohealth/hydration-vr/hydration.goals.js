// === /herohealth/hydration-vr/hydration.goals.js ===
// Goal ภารกิจหลักของโหมด Hydration (ใช้ 2 ภารกิจต่อเกม)
//
// ใช้ร่วมกับ: hydration.quest.js / hydration.safe.js
//
// interface ของแต่ละ goal:
//   {
//     id: string,
//     label: string,   // ข้อความโชว์ใน HUD
//     target: number,  // เป้าหมายหลัก (หน่วยขึ้นกับภารกิจ)
//     check(state) -> bool,
//     prog(state)  -> number (ค่าความคืบหน้า ใช้ทำ progress bar)
//   }
//
// state มาจาก mapHydrationState(stats) มี field สำคัญ:
//   score, combo, comboMax,
//   goodCount, junkMiss,
//   timeSec, tick,
//   greenTick, greenRatio, zone

'use strict';

export function hydrationGoalsFor (diffRaw = 'normal') {
  const diff = String(diffRaw || 'normal').toLowerCase();

  // ---------- EASY ----------
  if (diff === 'easy') {
    return [
      // Goal 1: รักษาโซนน้ำสมดุล (GREEN) รวม 25 วินาที
      {
        id: 'g-easy-green-25s',
        label: 'รักษาโซนสมดุล (GREEN) รวม 25 วินาที ⏱️',
        target: 25, // วินาทีในโซน GREEN
        check (s) {
          const g = Number(s.greenTick || 0);
          return g >= 25;
        },
        prog (s) {
          const g = Number(s.greenTick || 0);
          return Math.min(g, 25);
        }
      },

      // Goal 2: เก็บน้ำดีให้ได้อย่างน้อย 25 แก้ว
      {
        id: 'g-easy-good-25',
        label: 'เก็บน้ำดีให้ได้อย่างน้อย 25 แก้ว 💧',
        target: 25, // จำนวนแก้วน้ำดี
        check (s) {
          const c = Number(s.goodCount || 0);
          return c >= 25;
        },
        prog (s) {
          const c = Number(s.goodCount || 0);
          return Math.min(c, 25);
        }
      }
    ];
  }

  // ---------- HARD ----------
  if (diff === 'hard') {
    return [
      // Goal 1: รักษา GREEN รวม 45 วินาที
      {
        id: 'g-hard-green-45s',
        label: 'รักษาโซนสมดุล (GREEN) รวม 45 วินาที ⏱️',
        target: 45,
        check (s) {
          const g = Number(s.greenTick || 0);
          return g >= 45;
        },
        prog (s) {
          const g = Number(s.greenTick || 0);
          return Math.min(g, 45);
        }
      },

      // Goal 2: เก็บน้ำดีให้ได้อย่างน้อย 40 แก้ว
      {
        id: 'g-hard-good-40',
        label: 'เก็บน้ำดีให้ได้อย่างน้อย 40 แก้ว 💧',
        target: 40,
        check (s) {
          const c = Number(s.goodCount || 0);
          return c >= 40;
        },
        prog (s) {
          const c = Number(s.goodCount || 0);
          return Math.min(c, 40);
        }
      }
    ];
  }

  // ---------- NORMAL (default) ----------
  // ถ้า diff ไม่ใช่ easy/hard ให้ถือว่าเป็น normal
  return [
    // Goal 1: รักษา GREEN รวม 35 วินาที
    {
      id: 'g-normal-green-35s',
      label: 'รักษาโซนสมดุล (GREEN) รวม 35 วินาที ⏱️',
      target: 35,
      check (s) {
        const g = Number(s.greenTick || 0);
        return g >= 35;
      },
      prog (s) {
        const g = Number(s.greenTick || 0);
        return Math.min(g, 35);
      }
    },

    // Goal 2: เก็บน้ำดีให้ได้อย่างน้อย 30 แก้ว
    {
      id: 'g-normal-good-30',
      label: 'เก็บน้ำดีให้ได้อย่างน้อย 30 แก้ว 💧',
      target: 30,
      check (s) {
        const c = Number(s.goodCount || 0);
        return c >= 30;
      },
      prog (s) {
        const c = Number(s.goodCount || 0);
        return Math.min(c, 30);
      }
    }
  ];
}

export default { hydrationGoalsFor };