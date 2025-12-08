// === /herohealth/hydration-vr/difficulty.js ===
// Central difficulty config for Hydration VR
// ใช้ pattern เดียวกับ vr-goodjunk/difficulty.js แต่จูนตามลักษณะเกมน้ำ

export class HydrationDifficulty {
  constructor () {
    this.level = 'normal';

    // หมายเหตุ field หลัก:
    // size  = ขนาดเป้า (ยิ่งมากยิ่งใหญ่ / กดง่าย)
    // rate  = ช่วงเวลา spawn (ms) ยิ่งน้อย = โผล่ถี่ / ยากขึ้น
    // life  = อายุของเป้า (ms) ยิ่งน้อย = หายเร็ว / ยากขึ้น
    // maxActive = จำนวนเป้าบนจอพร้อมกันสูงสุด
    //
    // typeWeights = สัดส่วนประเภทเป้า (ใช้คำนวณ GOOD_RATIO / POWER_RATIO)
    //   good    = น้ำดี / น้ำเปล่า
    //   junk    = น้ำหวาน / น้ำอัดลม
    //   star    = คะแนนพิเศษ
    //   diamond = คะแนนเยอะ + fever
    //   shield  = เกราะกัน miss จาก junk
    //   fire    = โหมดไฟ (เก็บคะแนนได้เร็ว)
    //
    // greenTarget = เปอร์เซ็นต์เวลาที่อยากให้อยู่โซน GREEN (ใช้ design quest)
    // missLimit   = MISS โดยประมาณที่ "ยอมได้" ต่อเกมในระดับนั้น
    // feverGainHit / feverDecaySec ใช้จูนความยากของเกจไฟ

    this.table = {
      easy: {
        size: 1.15,
        rate: 1000,
        life: 2600,
        maxActive: 3,
        typeWeights: {
          good: 78,
          junk: 10,
          star: 4,
          diamond: 3,
          shield: 3,
          fire: 2
        },
        greenTarget: 0.40,
        missLimit: 6,
        feverGainHit: 8,
        feverDecaySec: 4,
        assist: true,
        adaptive: {
          intervalMin: 950,
          intervalMax: 1300,
          lifeMin: 2200,
          lifeMax: 2800,
          maxActiveMin: 2,
          maxActiveMax: 4
        }
      },

      normal: {
        size: 1.0,
        rate: 850,
        life: 2300,
        maxActive: 4,
        typeWeights: {
          good: 70,
          junk: 16,
          star: 4,
          diamond: 4,
          shield: 3,
          fire: 3
        },
        greenTarget: 0.50,
        missLimit: 4,
        feverGainHit: 6,
        feverDecaySec: 5,
        assist: false,
        adaptive: {
          intervalMin: 800,
          intervalMax: 1150,
          lifeMin: 1900,
          lifeMax: 2400,
          maxActiveMin: 3,
          maxActiveMax: 5
        }
      },

      hard: {
        size: 0.9,
        rate: 700,
        life: 2000,
        maxActive: 5,
        typeWeights: {
          good: 62,
          junk: 22,
          star: 4,
          diamond: 4,
          shield: 4,
          fire: 4
        },
        greenTarget: 0.60,
        missLimit: 2,
        feverGainHit: 5,
        feverDecaySec: 7,
        assist: false,
        adaptive: {
          intervalMin: 650,
          intervalMax: 950,
          lifeMin: 1600,
          lifeMax: 2100,
          maxActiveMin: 4,
          maxActiveMax: 6
        }
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

export default HydrationDifficulty;
