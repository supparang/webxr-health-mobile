// === /herohealth/vr-goodjunk/difficulty.js ===
// Central difficulty config for Good vs Junk (DOM / VR)
// note: field หลัก size/rate/life ยังเหมือนเดิม เพื่อไม่ให้โค้ดเก่าเสีย

export class Difficulty {
  constructor () {
    this.level = 'normal';

    // size = ขนาดเป้า (ยิ่งมากยิ่งใหญ่)
    // rate = ช่วงเวลา spawn (ms)
    // life = อายุของเป้า (ms)
    this.table = {
      easy: {
        size: 1.2,
        rate: 950,
        life: 2600,
        maxActive: 3,
        typeWeights: {
          good: 80,
          junk: 12,
          star: 3,
          diamond: 3,
          shield: 2
        },
        goals: [
          { min: 12, max: 16 },
          { min: 22, max: 26 }
        ],
        miniCombos: [3, 5, 7],
        adaptive: {
          intervalMin: 900,
          intervalMax: 1300,
          lifeMin: 2100,
          lifeMax: 2800,
          maxActiveMin: 2,
          maxActiveMax: 4
        },
        assist: true
      },
      normal: {
        size: 1.05,
        rate: 820,
        life: 2300,
        maxActive: 4,
        typeWeights: {
          good: 70,
          junk: 18,
          star: 4,
          diamond: 4,
          shield: 4
        },
        goals: [
          { min: 16, max: 20 },
          { min: 26, max: 32 }
        ],
        miniCombos: [4, 6, 8],
        adaptive: {
          intervalMin: 800,
          intervalMax: 1150,
          lifeMin: 1700,
          lifeMax: 2400,
          maxActiveMin: 3,
          maxActiveMax: 5
        },
        assist: false
      },
      hard: {
        size: 0.95,
        rate: 680,
        life: 2100,
        maxActive: 5,
        typeWeights: {
          good: 62,
          junk: 26,
          star: 4,
          diamond: 4,
          shield: 4
        },
        goals: [
          { min: 20, max: 24 },
          { min: 32, max: 38 }
        ],
        miniCombos: [5, 7, 10],
        adaptive: {
          intervalMin: 650,
          intervalMax: 950,
          lifeMin: 1500,
          lifeMax: 2100,
          maxActiveMin: 4,
          maxActiveMax: 6
        },
        assist: false
      }
    };
  }

  set (level) {
    const lv = String(level || 'normal').toLowerCase();
    if (lv === 'easy' || lv === 'hard') this.level = lv;
    else this.level = 'normal';
  }

  get () {
    return this.table[this.level] || this.table.normal;
  }
}

export default Difficulty;
