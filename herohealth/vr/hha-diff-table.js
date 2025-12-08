// === /herohealth/vr/hha-diff-table.js (เฉพาะ block hydration-vr) ===
export const HHA_DIFF_TABLE = {
  // ... โหมดอื่นๆ เช่น goodjunk, plate ฯลฯ ...

  'hydration-vr': {
    easy: {
      engine: {
        // ง่าย: เป้าใหญ่ หน่อย / spawn ช้า / อยู่บนจอนาน
        SPAWN_INTERVAL: 1200,   // ms ระหว่าง spawn
        ITEM_LIFETIME:  2700,   // ms อายุเป้า
        MAX_ACTIVE:     3,      // เป้าบนจอพร้อมกัน
        SIZE_FACTOR:    1.18,   // ขนาดเป้าใหญ่สุด

        // สัดส่วนของดี vs ขยะหวาน
        GOOD_RATIO:     0.80,   // 80% เป็นน้ำดี / power-up
        POWER_RATIO:    0.12,   // โอกาสเจอ power-up (💎⭐🛡️🔥)

        // Fever: เติมง่าย ดับช้า
        FEVER_GAIN_HIT: 8,      // ได้ fever ต่อ hit น้ำดี 1 ครั้ง
        FEVER_DECAY_SEC: 4      // ลด fever ต่อวินาที (ยิ่งน้อยยิ่งค่อย ๆ ลด)
      },
      benchmark: {
        targetAccuracyPct: 85,
        targetMissPerGame: 5,
        expectedZoneGreenPct: 70   // เด็กส่วนใหญ่ควรอยู่ GREEN ≥ 70%
      }
    },

    normal: {
      engine: {
        // ปกติ: สำหรับใช้วิจัยหลัก
        SPAWN_INTERVAL: 950,
        ITEM_LIFETIME:  2400,
        MAX_ACTIVE:     4,
        SIZE_FACTOR:    1.02,

        GOOD_RATIO:     0.70,
        POWER_RATIO:    0.10,

        // เติม fever ปานกลาง / ลดเร็วขึ้นหน่อย
        FEVER_GAIN_HIT: 7,
        FEVER_DECAY_SEC: 5
      },
      benchmark: {
        targetAccuracyPct: 78,
        targetMissPerGame: 8,
        expectedZoneGreenPct: 60   // GREEN ประมาณ 55–65%
      }
    },

    hard: {
      engine: {
        // ยาก: เป้าเล็ก / spawn ไว / เป้าหายเร็ว / junk เยอะ
        SPAWN_INTERVAL: 780,
        ITEM_LIFETIME:  2100,
        MAX_ACTIVE:     5,
        SIZE_FACTOR:    0.90,

        GOOD_RATIO:     0.60,
        POWER_RATIO:    0.09,

        // fever เติมยาก / ลดไว
        FEVER_GAIN_HIT: 6,
        FEVER_DECAY_SEC: 6
      },
      benchmark: {
        targetAccuracyPct: 70,
        targetMissPerGame: 12,
        expectedZoneGreenPct: 50   // GREEN ประมาณครึ่งเกม
      }
    }
  }

  // ... ปิดท้ายตารางโหมดอื่น ...
};
