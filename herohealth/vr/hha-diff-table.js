// === /herohealth/vr/hha-diff-table.js ===
// ตารางรวมค่าความยากของแต่ละโหมด (ใช้โดย mode-factory.js)
//
// หมายเหตุ field ที่ engine ใช้จริงมีอย่างน้อย:
//   SPAWN_INTERVAL   = ช่วงเวลา spawn (ms)
//   ITEM_LIFETIME    = อายุเป้า (ms)
//   MAX_ACTIVE       = จำนวนเป้าพร้อมกันสูงสุด
//   SIZE_FACTOR      = ตัวคูณขนาดเป้า (1 = ปกติ, >1 = ใหญ่ขึ้น, <1 = เล็กลง)
//   GOOD_RATIO       = สัดส่วนเป้าดีทั้งหมด (0–1)
//   POWER_RATIO      = สัดส่วน power-ups ทั้งหมด (0–1 จาก good)
//   POWER_EVERY      = อย่างน้อยทุกกี่ hit ถึงจะการันตี power-up หนึ่งครั้ง
//   FEVER_GAIN_HIT   = ได้เกจ Fever ต่อ 1 hit
//   FEVER_DECAY_SEC  = ลดเกจ Fever ต่อ 1 วินาที
//
// ส่วน field ใน benchmark ใช้เพื่อวิจัย / ปรับแต่งภายหลัง ไม่กระทบ engine ตรง ๆ

export const HHA_DIFF_TABLE = {
  // ---------------------------------------------------------
  // 1) NUTRITION — Good vs Junk (ตัวอย่างเดิม)
  // ---------------------------------------------------------
  goodjunk: {
    easy: {
      engine: {
        SPAWN_INTERVAL: 1000,
        ITEM_LIFETIME: 2300,
        MAX_ACTIVE: 3,
        SIZE_FACTOR: 1.25,

        GOOD_RATIO: 0.70,
        POWER_RATIO: 0.16, // star / gold / diamond / shield / fever รวมกัน
        POWER_EVERY: 6,

        FEVER_GAIN_HIT: 7,
        FEVER_DECAY_SEC: 4,

        TYPE_WEIGHTS: {
          good:   62,
          junk:   14,
          star:    8,
          gold:    6,
          diamond: 3,
          shield:  5,
          fever:   2,
          rainbow: 0
        }
      },
      benchmark: {
        targetAccuracyPct: 85,
        targetMissionSuccessPct: 90,
        expectedAvgRTms: 900,
        note: 'โหมดฝึกพื้นฐานสำหรับ ป.5–ป.6 / เล่นครั้งแรก'
      }
    },

    normal: {
      engine: {
        SPAWN_INTERVAL: 820,
        ITEM_LIFETIME: 2200,
        MAX_ACTIVE: 4,
        SIZE_FACTOR: 1.05,

        GOOD_RATIO: 0.65,
        POWER_RATIO: 0.14,
        POWER_EVERY: 6,

        FEVER_GAIN_HIT: 7,
        FEVER_DECAY_SEC: 5,

        TYPE_WEIGHTS: {
          good:   60,
          junk:   18,
          star:    7,
          gold:    5,
          diamond: 3,
          shield:  5,
          fever:   2,
          rainbow: 0
        }
      },
      benchmark: {
        targetAccuracyPct: 80,
        targetMissionSuccessPct: 80,
        expectedAvgRTms: 800,
        note: 'โหมดมาตรฐานใช้เก็บข้อมูลวิจัย'
      }
    },

    hard: {
      engine: {
        SPAWN_INTERVAL: 680,
        ITEM_LIFETIME: 2000,
        MAX_ACTIVE: 5,
        SIZE_FACTOR: 0.92,

        GOOD_RATIO: 0.60,
        POWER_RATIO: 0.12,
        POWER_EVERY: 7,

        FEVER_GAIN_HIT: 8,
        FEVER_DECAY_SEC: 6,

        TYPE_WEIGHTS: {
          good:   56,
          junk:   24,
          star:    6,
          gold:    4,
          diamond: 3,
          shield:  5,
          fever:   2,
          rainbow: 0
        }
      },
      benchmark: {
        targetAccuracyPct: 75,
        targetMissionSuccessPct: 65,
        expectedAvgRTms: 720,
        note: 'โหมดท้าทาย / ใช้ทดสอบการพัฒนาทักษะต่อเนื่อง'
      }
    }
  },

  // ---------------------------------------------------------
  // 2) HYDRATION VR — เก็บน้ำดี / หลบของหวาน
  //     ใช้ร่วมกับ hydration.safe.js + hydration-vr.html
  // ---------------------------------------------------------
  'hydration-vr': {
    // --------- ง่าย ---------
    easy: {
      engine: {
        // เป้าใหญ่ + ช้า + ไม่เกิน 3 เป้าพร้อมกัน
        SPAWN_INTERVAL: 1100,   // ms (ระหว่างเป้าดี/เสีย)
        ITEM_LIFETIME:  2600,   // ms (เวลาที่เป้าลอยอยู่)
        MAX_ACTIVE:     3,
        SIZE_FACTOR:    1.22,   // ✅ ง่าย: เป้าใหญ่เห็นชัด

        // โอกาสเจอเป้าดี / power-up
        GOOD_RATIO:   0.78,     // เป้าน้ำดีส่วนใหญ่
        POWER_RATIO:  0.10,     // star / diamond / shield / fever
        POWER_EVERY:  6,        // อย่างดีก็ 6 hit การันตี 1 power-up

        // Fever gauge
        FEVER_GAIN_HIT: 6,      // ได้เกจไวขึ้นเล็กน้อย
        FEVER_DECAY_SEC: 4      // ลดช้าหน่อย เผื่อผู้เล่นใหม่

        // (type weights จริง ๆ จะไปคอนฟิกใน hydration.safe.js ผ่าน pools)
      },
      benchmark: {
        targetAccuracyPct: 85,
        targetMissionSuccessPct: 85,
        expectedAvgRTms: 900,
        waterZoneExpectation: 'ส่วนใหญ่ GREEN, ไม่ค่อยเข้า HIGH/LOW',
        note: 'เหมาะกับเริ่มเล่นครั้งแรก / ป.5–ป.6 ที่ยังไม่ถนัด VR'
      }
    },

    // --------- ปกติ ---------
    normal: {
      engine: {
        // ขนาดปานกลาง + spawn เร็วขึ้น + เป้าพร้อมกันได้มากขึ้น
        SPAWN_INTERVAL: 900,
        ITEM_LIFETIME:  2300,
        MAX_ACTIVE:     4,
        SIZE_FACTOR:    1.0,    // ✅ ปกติ: ขนาดมาตรฐาน

        GOOD_RATIO:   0.72,
        POWER_RATIO:  0.12,
        POWER_EVERY:  6,

        FEVER_GAIN_HIT: 6,
        FEVER_DECAY_SEC: 5
      },
      benchmark: {
        targetAccuracyPct: 80,
        targetMissionSuccessPct: 75,
        expectedAvgRTms: 820,
        waterZoneExpectation: 'GREEN 50–70% ของเวลา, HIGH/LOW บ้างตามพฤติกรรมดื่ม',
        note: 'โหมดมาตรฐานสำหรับเก็บข้อมูลวิจัย hydration'
      }
    },

    // --------- ยาก ---------
    hard: {
      engine: {
        // เป้าเล็กลง + spawn ไว + เป้าพร้อมกันเยอะขึ้น
        SPAWN_INTERVAL: 720,
        ITEM_LIFETIME:  2100,
        MAX_ACTIVE:     5,
        SIZE_FACTOR:    0.88,   // ✅ ยาก: เป้าเล็ก ต้องเล็งดี ๆ

        GOOD_RATIO:   0.66,    // ของไม่ดีออกถี่ขึ้น
        POWER_RATIO:  0.14,
        POWER_EVERY:  7,

        FEVER_GAIN_HIT: 7,
        FEVER_DECAY_SEC: 6
      },
      benchmark: {
        targetAccuracyPct: 75,
        targetMissionSuccessPct: 60,
        expectedAvgRTms: 750,
        waterZoneExpectation: 'ผู้เล่นเก่งจะรักษา GREEN ได้แม้ spawn ไว',
        note: 'ใช้ทดสอบฝีมือ/การเรียนรู้ซ้ำและการควบคุม impulse ของน้ำหวาน'
      }
    }
  }

  // สามารถเพิ่ม entry อื่น ๆ ได้ เช่น 'plate-vr', 'fitness-shadow' ฯลฯ
};

export default HHA_DIFF_TABLE;
