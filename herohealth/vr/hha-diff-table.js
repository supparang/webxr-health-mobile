// === Hero Health — HHA_DIFF_TABLE (เฉพาะส่วน Hydration ปรับขนาดเป้า) ===

const HHA_DIFF_TABLE = {
  // ... โหมดอื่น ๆ ของคุณ (goodjunk, plate, groups ฯลฯ) คงไว้ตามเดิม ...

  hydration: {
    easy: {
      engine: {
        // ระดับง่าย: เป้าใหญ่หน่อย แต่ลดลงจากเดิม
        SPAWN_INTERVAL: 1100,   // ช้าสุด เล็งง่าย
        ITEM_LIFETIME: 2400,
        MAX_ACTIVE: 3,
        SIZE_FACTOR: 0.80,      // ⬅️ ปรับให้เล็กลงจาก 1.0 / 0.9 เดิม

        GOOD_RATIO: 0.70,
        POWER_RATIO: 0.10,
        FEVER_GAIN_HIT: 7,
        FEVER_DECAY_SEC: 5
      },
      benchmark: {
        targetScore: 1800,
        targetCombo: 10,
        maxMiss: 6
      }
    },

    normal: {
      engine: {
        // ระดับปกติ: เป้ากลาง ๆ แต่เล็กกว่า easy ชัดเจน
        SPAWN_INTERVAL: 900,
        ITEM_LIFETIME: 2200,
        MAX_ACTIVE: 4,
        SIZE_FACTOR: 0.72,      // ⬅️ เล็กกว่าระดับ easy

        GOOD_RATIO: 0.65,
        POWER_RATIO: 0.10,
        FEVER_GAIN_HIT: 6,
        FEVER_DECAY_SEC: 5
      },
      benchmark: {
        targetScore: 2200,
        targetCombo: 16,
        maxMiss: 5
      }
    },

    hard: {
      engine: {
        // ระดับยาก: เป้าเล็กสุด แต่ไม่ต้องเล็กมากเกินไป
        SPAWN_INTERVAL: 750,
        ITEM_LIFETIME: 2000,
        MAX_ACTIVE: 5,
        SIZE_FACTOR: 0.68,      // ⬅️ ยังคงเล็กกว่าปกติเล็กน้อย

        GOOD_RATIO: 0.60,
        POWER_RATIO: 0.10,
        FEVER_GAIN_HIT: 5,
        FEVER_DECAY_SEC: 5
      },
      benchmark: {
        targetScore: 2600,
        targetCombo: 20,
        maxMiss: 4
      }
    }
  }

  // ... โหมดอื่น ๆ ต่อจากนี้ ...
};

// ถ้าไฟล์เดิมมี export อยู่แล้ว ก็ใช้รูปแบบเดิมได้เลย
export { HHA_DIFF_TABLE };
export default HHA_DIFF_TABLE;