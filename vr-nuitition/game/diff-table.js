// === Hero Health — HHA_DIFF_TABLE (Research Tuning v1 — ES Module) ===

// ตาราง config ตามโหมด + ระดับความยาก
export const HHA_DIFF_TABLE = {
  goodjunk: {
    easy: {
      engine: {
        SPAWN_INTERVAL: 1000,
        ITEM_LIFETIME: 2300,
        MAX_ACTIVE: 3,
        MISSION_GOOD_TARGET: 15,
        SIZE_FACTOR: 1.25,
        FEVER_DURATION: 5,
        DIAMOND_TIME_BONUS: 3,
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
        note: 'โหมดฝึกพื้นฐาน แยกของดี/ขยะให้ชัด เหมาะใช้สอนครั้งแรก ๆ'
      }
    },
    normal: {
      engine: {
        SPAWN_INTERVAL: 650,
        ITEM_LIFETIME: 1500,
        MAX_ACTIVE: 4,
        MISSION_GOOD_TARGET: 20,
        SIZE_FACTOR: 1.0,
        FEVER_DURATION: 6,
        DIAMOND_TIME_BONUS: 2,
        TYPE_WEIGHTS: {
          good:   48,
          junk:   30,
          star:    7,
          gold:    6,
          diamond: 4,
          shield:  3,
          fever:   4,
          rainbow: 1
        }
      },
      benchmark: {
        targetAccuracyPct: 75,
        targetMissionSuccessPct: 70,
        expectedAvgRTms: 750,
        note: 'ระดับมาตรฐานสำหรับเก็บข้อมูลก่อน–หลังการสอน'
      }
    },
    hard: {
      engine: {
        SPAWN_INTERVAL: 480,
        ITEM_LIFETIME: 1050,
        MAX_ACTIVE: 6,
        MISSION_GOOD_TARGET: 26,
        SIZE_FACTOR: 0.9,
        FEVER_DURATION: 7,
        DIAMOND_TIME_BONUS: 1,
        TYPE_WEIGHTS: {
          good:   34,
          junk:   42,
          star:    6,
          gold:    5,
          diamond: 5,
          shield:  3,
          fever:   7,
          rainbow: 3
        }
      },
      benchmark: {
        targetAccuracyPct: 60,
        targetMissionSuccessPct: 50,
        expectedAvgRTms: 700,
        note: 'ใช้แยกเด็กที่มีการควบคุมตนเองดี / สมาธิดี (executive function)'
      }
    }
  },

  groups: {
    easy: {
      engine: {
        SPAWN_INTERVAL: 1050,
        ITEM_LIFETIME: 2400,
        MAX_ACTIVE: 3,
        MISSION_GOOD_TARGET: 14,
        SIZE_FACTOR: 1.2,
        FEVER_DURATION: 5,
        DIAMOND_TIME_BONUS: 3,
        TYPE_WEIGHTS: {
          good:   68,
          junk:   14,
          star:    6,
          gold:    5,
          diamond: 2,
          shield:  3,
          fever:   2,
          rainbow: 0
        }
      },
      benchmark: {
        targetAccuracyPct: 85,
        targetMissionSuccessPct: 90,
        expectedAvgRTms: 950,
        note: 'ใช้เป็น pre-test เบา ๆ ว่าเข้าใจหมู่อาหารเบื้องต้นไหม'
      }
    },
    normal: {
      engine: {
        SPAWN_INTERVAL: 720,
        ITEM_LIFETIME: 1650,
        MAX_ACTIVE: 4,
        MISSION_GOOD_TARGET: 18,
        SIZE_FACTOR: 1.0,
        FEVER_DURATION: 6,
        DIAMOND_TIME_BONUS: 2,
        TYPE_WEIGHTS: {
          good:   52,
          junk:   24,
          star:    7,
          gold:    5,
          diamond: 4,
          shield:  4,
          fever:   4,
          rainbow: 2
        }
      },
      benchmark: {
        targetAccuracyPct: 75,
        targetMissionSuccessPct: 70,
        expectedAvgRTms: 800,
        note: 'เหมาะสำหรับเก็บคะแนนหลังเรียนเรื่องหมู่อาหาร + วัด EF ด้าน working memory'
      }
    },
    hard: {
      engine: {
        SPAWN_INTERVAL: 520,
        ITEM_LIFETIME: 1150,
        MAX_ACTIVE: 6,
        MISSION_GOOD_TARGET: 24,
        SIZE_FACTOR: 0.9,
        FEVER_DURATION: 7,
        DIAMOND_TIME_BONUS: 1,
        TYPE_WEIGHTS: {
          good:   36,
          junk:   40,
          star:    6,
          gold:    5,
          diamond: 5,
          shield:  3,
          fever:   7,
          rainbow: 3
        }
      },
      benchmark: {
        targetAccuracyPct: 60,
        targetMissionSuccessPct: 50,
        expectedAvgRTms: 720,
        note: 'ใช้แยกเด็กที่จำหมู่อาหารได้แม่น + ตอบสนองเร็ว'
      }
    }
  },

  hydration: {
    easy: {
      engine: {
        SPAWN_INTERVAL: 1000,
        ITEM_LIFETIME: 2400,
        MAX_ACTIVE: 3,
        MISSION_GOOD_TARGET: 14,
        SIZE_FACTOR: 1.15,
        FEVER_DURATION: 5,
        DIAMOND_TIME_BONUS: 3,
        TYPE_WEIGHTS: {
          good:   68,
          junk:   14,
          star:    6,
          gold:    4,
          diamond: 3,
          shield:  3,
          fever:   2,
          rainbow: 0
        }
      },
      benchmark: {
        targetAccuracyPct: 88,
        targetMissionSuccessPct: 92,
        expectedAvgRTms: 900,
        note: 'เน้นให้เด็กแยก “น้ำเปล่า vs น้ำหวาน” ได้ชัดเจนมาก ๆ'
      }
    },
    normal: {
      engine: {
        SPAWN_INTERVAL: 750,
        ITEM_LIFETIME: 1700,
        MAX_ACTIVE: 4,
        MISSION_GOOD_TARGET: 18,
        SIZE_FACTOR: 1.0,
        FEVER_DURATION: 6,
        DIAMOND_TIME_BONUS: 2,
        TYPE_WEIGHTS: {
          good:   52,
          junk:   24,
          star:    6,
          gold:    5,
          diamond: 4,
          shield:  4,
          fever:   4,
          rainbow: 1
        }
      },
      benchmark: {
        targetAccuracyPct: 75,
        targetMissionSuccessPct: 70,
        expectedAvgRTms: 780,
        note: 'ใช้วัดผลหลังการสอนเรื่องการดื่มน้ำอย่างเหมาะสม'
      }
    },
    hard: {
      engine: {
        SPAWN_INTERVAL: 520,
        ITEM_LIFETIME: 1150,
        MAX_ACTIVE: 6,
        MISSION_GOOD_TARGET: 22,
        SIZE_FACTOR: 0.9,
        FEVER_DURATION: 7,
        DIAMOND_TIME_BONUS: 1,
        TYPE_WEIGHTS: {
          good:   38,
          junk:   40,
          star:    6,
          gold:    5,
          diamond: 5,
          shield:  3,
          fever:   7,
          rainbow: 3
        }
      },
      benchmark: {
        targetAccuracyPct: 60,
        targetMissionSuccessPct: 50,
        expectedAvgRTms: 720,
        note: 'เหมาะใช้ฝึกเด็กที่ดื่มน้ำหวานบ่อย ให้ฝึกแยกและปฏิเสธได้เร็ว'
      }
    }
  },

  plate: {
    easy: {
      engine: {
        SPAWN_INTERVAL: 980,
        ITEM_LIFETIME: 2300,
        MAX_ACTIVE: 3,
        MISSION_GOOD_TARGET: 16,
        SIZE_FACTOR: 1.2,
        FEVER_DURATION: 5,
        DIAMOND_TIME_BONUS: 3,
        TYPE_WEIGHTS: {
          good:   64,
          junk:   16,
          star:    8,
          gold:    5,
          diamond: 3,
          shield:  2,
          fever:   2,
          rainbow: 0
        }
      },
      benchmark: {
        targetAccuracyPct: 85,
        targetMissionSuccessPct: 90,
        expectedAvgRTms: 900,
        note: 'ใช้สอน concept “จานสุขภาพ” แบบสนุก ๆ ครั้งแรก'
      }
    },
    normal: {
      engine: {
        SPAWN_INTERVAL: 720,
        ITEM_LIFETIME: 1650,
        MAX_ACTIVE: 4,
        MISSION_GOOD_TARGET: 20,
        SIZE_FACTOR: 1.0,
        FEVER_DURATION: 6,
        DIAMOND_TIME_BONUS: 2,
        TYPE_WEIGHTS: {
          good:   48,
          junk:   28,
          star:    7,
          gold:    6,
          diamond: 4,
          shield:  3,
          fever:   4,
          rainbow: 0
        }
      },
      benchmark: {
        targetAccuracyPct: 75,
        targetMissionSuccessPct: 70,
        expectedAvgRTms: 780,
        note: 'ใช้เก็บคะแนนหลังสอนเรื่องจานสุขภาพ 5 หมู่'
      }
    },
    hard: {
      engine: {
        SPAWN_INTERVAL: 500,
        ITEM_LIFETIME: 1100,
        MAX_ACTIVE: 6,
        MISSION_GOOD_TARGET: 24,
        SIZE_FACTOR: 0.9,
        FEVER_DURATION: 7,
        DIAMOND_TIME_BONUS: 1,
        TYPE_WEIGHTS: {
          good:   34,
          junk:   42,
          star:    6,
          gold:    5,
          diamond: 5,
          shield:  3,
          fever:   7,
          rainbow: 3
        }
      },
      benchmark: {
        targetAccuracyPct: 60,
        targetMissionSuccessPct: 50,
        expectedAvgRTms: 720,
        note: 'ใช้สำหรับเด็กที่เข้าใจหมู่–ปริมาณแล้ว อยากเพิ่ม challenge การตัดสินใจเร็ว'
      }
    }
  }
};

// helper สำหรับโหมดต่าง ๆ
export function getEngineConfig(mode, diff) {
  const m = String(mode || '').toLowerCase();
  const d = String(diff || '').toLowerCase();

  const byMode = HHA_DIFF_TABLE[m];
  if (!byMode) return null;
  const byDiff = byMode[d] || byMode.normal || Object.values(byMode)[0];
  return byDiff ? byDiff.engine : null;
}

export function getBenchmark(mode, diff) {
  const m = String(mode || '').toLowerCase();
  const d = String(diff || '').toLowerCase();

  const byMode = HHA_DIFF_TABLE[m];
  if (!byMode) return null;
  const byDiff = byMode[d] || byMode.normal || Object.values(byMode)[0];
  return byDiff ? byDiff.benchmark : null;
}

// ผูกเป็น global สำหรับโค้ดเดิมที่ยังอ้าง window.HHA_DIFF_TABLE
if (typeof window !== 'undefined') {
  window.HHA_DIFF_TABLE = HHA_DIFF_TABLE;
  window.HHA_getEngineConfig = getEngineConfig;
  window.HHA_getBenchmark = getBenchmark;
}

export default HHA_DIFF_TABLE;