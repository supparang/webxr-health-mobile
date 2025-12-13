// === /herohealth/hydration-vr/hydration.minis.js ===
// Mini quest สำหรับโหมด Hydration (ใช้ 3 ภารกิจต่อเกม)
//
// interface mini quest เหมือน goal:
//   { id, label, target, check(state), prog(state) }
//
// การตั้งชื่อ:
//   - ภารกิจเกี่ยวกับ "พลาดไม่เกิน ..." ให้มีคำว่า 'nomiss' หรือ 'miss' ใน id
//     เพื่อให้ระบบจัดเข้ากลุ่ม miss quest อัตโนมัติ

'use strict';

export function hydrationMinisFor (diffRaw = 'normal') {
  const diff = String(diffRaw || 'normal').toLowerCase();

  // ---------- EASY ----------
  if (diff === 'easy') {
    return [
      // Mini 1: เก็บน้ำดีให้ได้ 12 แก้ว
      {
        id: 'm-easy-good-12',
        label: 'มินิ: เก็บน้ำดีให้ได้ 12 แก้ว 💧',
        target: 12,
        check (s) {
          const c = Number(s.goodCount || 0);
          return c >= 12;
        },
        prog (s) {
          const c = Number(s.goodCount || 0);
          return Math.min(c, 12);
        }
      },

      // Mini 2: GREEN ≥ 50% ของเวลาที่เล่นทั้งหมด
      {
        id: 'm-easy-greenratio-50',
        label: 'มินิ: ให้เวลา GREEN ≥ 50% ของเวลาที่เล่นทั้งหมด 💚',
        target: 0.5, // อัตราส่วน 0–1
        check (s) {
          const r = Number(s.greenRatio || 0);
          return r >= 0.5;
        },
        prog (s) {
          const r = Number(s.greenRatio || 0);
          // ให้ progress ไม่เกิน target
          return Math.min(r, 0.5);
        }
      },

      // Mini 3: ทำคะแนนให้ถึง 1500 แต้ม
      {
        id: 'm-easy-score-1500',
        label: 'มินิ: ทำคะแนนให้ถึง 1500 แต้ม 📊',
        target: 1500,
        check (s) {
          const sc = Number(s.score || 0);
          return sc >= 1500;
        },
        prog (s) {
          const sc = Number(s.score || 0);
          return Math.min(sc, 1500);
        }
      }
    ];
  }

  // ---------- HARD ----------
  if (diff === 'hard') {
    return [
      // Mini 1: เก็บน้ำดีให้ได้ 25 แก้ว
      {
        id: 'm-hard-good-25',
        label: 'มินิ: เก็บน้ำดีให้ได้ 25 แก้ว 💧',
        target: 25,
        check (s) {
          const c = Number(s.goodCount || 0);
          return c >= 25;
        },
        prog (s) {
          const c = Number(s.goodCount || 0);
          return Math.min(c, 25);
        }
      },

      // Mini 2: GREEN ≥ 70% ของเวลาที่เล่นทั้งหมด
      {
        id: 'm-hard-greenratio-70',
        label: 'มินิ: ให้เวลา GREEN ≥ 70% ของเวลาที่เล่นทั้งหมด 💚',
        target: 0.7,
        check (s) {
          const r = Number(s.greenRatio || 0);
          return r >= 0.7;
        },
        prog (s) {
          const r = Number(s.greenRatio || 0);
          return Math.min(r, 0.7);
        }
      },

      // Mini 3 (miss quest): พลาดไม่เกิน 1 ครั้ง
      {
        id: 'm-hard-nomiss-1',
        label: 'มินิ: พลาดไม่เกิน 1 ครั้ง ❌',
        target: 1, // อนุญาตให้ miss ได้ 1 ครั้ง
        check (s) {
          const m = Number(s.junkMiss || 0);
          return m <= 1;
        },
        prog (s) {
          const m = Number(s.junkMiss || 0);
          // แสดงเป็น "เหลือโควตาพลาด" จาก 1 → 0
          const remain = Math.max(0, 1 - m);
          return remain;
        }
      }
    ];
  }

  // ---------- NORMAL (default) ----------
  return [
    // Mini 1: เก็บน้ำดีให้ได้ 20 แก้ว
    {
      id: 'm-normal-good-20',
      label: 'มินิ: เก็บน้ำดีให้ได้ 20 แก้ว 💧',
      target: 20,
      check (s) {
        const c = Number(s.goodCount || 0);
        return c >= 20;
      },
      prog (s) {
        const c = Number(s.goodCount || 0);
        return Math.min(c, 20);
      }
    },

    // Mini 2: GREEN ≥ 60% ของเวลาที่เล่นทั้งหมด
    {
      id: 'm-normal-greenratio-60',
      label: 'มินิ: ให้เวลา GREEN ≥ 60% ของเวลาที่เล่นทั้งหมด 💚',
      target: 0.6,
      check (s) {
        const r = Number(s.greenRatio || 0);
        return r >= 0.6;
      },
      prog (s) {
        const r = Number(s.greenRatio || 0);
        return Math.min(r, 0.6);
      }
    },

    // Mini 3: ทำคอมโบให้ถึง 30 ครั้งต่อเนื่อง
    {
      id: 'm-normal-combo-30',
      label: 'มินิ: ทำคอมโบให้ถึง 30 ครั้งต่อเนื่อง 🔗',
      target: 30,
      check (s) {
        const c = Number(s.comboMax || 0);
        return c >= 30;
      },
      prog (s) {
        const c = Number(s.comboMax || 0);
        return Math.min(c, 30);
      }
    }
  ];
}

export default { hydrationMinisFor };