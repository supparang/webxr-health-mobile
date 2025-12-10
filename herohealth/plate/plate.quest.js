// === /herohealth/plate/plate.quest.js ===
// Quest deck สำหรับ Balanced Plate VR
// - เลือก Goal ครั้งละ 2 ภารกิจ
// - เลือก Mini Quest ครั้งละ 3 ภารกิจ
// - เงื่อนไขแตกต่างตามระดับความยาก (easy / normal / hard)

'use strict';

/**
 * QUOTA = โควตาอาหารใน "หนึ่งจาน" ตามระดับความยาก
 * plate.safe.js ใช้ค่านี้เพื่อตัดสินว่า จานนี้ครบหมู่รึยัง
 * index: [หมู่1, หมู่2, หมู่3, หมู่4, หมู่5]
 */
export const QUOTA = {
  easy:   [1, 1, 1, 1, 1],  // อย่างน้อยหมู่ละ 1 ชิ้น
  normal: [1, 1, 2, 2, 1],  // ผัก/ผลไม้มากขึ้น
  hard:   [2, 2, 2, 2, 1]   // ทุกหมู่ต้องเยอะขึ้น
};

// ---------- Helper ----------

function cloneStats(s = {}) {
  return {
    score:      s.score      || 0,
    combo:      s.combo      || 0,
    misses:     s.misses     || 0,
    platesDone: s.platesDone || 0,
    gCounts: Array.isArray(s.gCounts) ? [...s.gCounts] : [0, 0, 0, 0, 0],
    star:   s.star   || 0,
    diamond:s.diamond|| 0
  };
}

function pickRandom(pool, n) {
  const src = [...pool];
  const out = [];
  while (src.length && out.length < n) {
    const idx = Math.floor(Math.random() * src.length);
    out.push(src.splice(idx, 1)[0]);
  }
  if (!out.length && pool.length) {
    out.push(pool[0]); // กันกรณี pool ว่างผิดปกติ
  }
  return out;
}

function wrapQuest(raw, type) {
  return {
    ...raw,
    type,
    done: false,
    status: 'active',   // 'active' | 'done'
    progress: 0,
    target: raw.target || 1,
    base: null          // baseline stats ตอนเริ่มภารกิจ
  };
}

// ---------- Quest Pools ----------

/**
 * GOAL = ภารกิจระดับ "เป้าหมายใหญ่" ของเกม
 * ใช้ตัวแปรรวม เช่น platesDone, misses
 */
const GOAL_POOL = {
  easy: [
    {
      id: 'g_easy_plate1',
      text: 'เสิร์ฟจานสมดุลให้ได้อย่างน้อย 1 จาน',
      target: 1,
      check(stats, base) {
        return (stats.platesDone - (base.platesDone || 0)) >= 1;
      }
    },
    {
      id: 'g_easy_plate2',
      text: 'เสิร์ฟจานสมดุลให้ได้อย่างน้อย 2 จาน',
      target: 2,
      check(stats, base) {
        return (stats.platesDone - (base.platesDone || 0)) >= 2;
      }
    },
    {
      id: 'g_easy_allgroups',
      text: 'เก็บอาหารให้ครบทั้ง 5 หมู่ อย่างน้อยหมู่ละ 1 ชิ้น',
      target: 1,
      check(stats, base) {
        const cur = stats.gCounts || [];
        const b   = base.gCounts || [];
        for (let i = 0; i < 5; i++) {
          const diff = (cur[i] || 0) - (b[i] || 0);
          if (diff < 1) return false;
        }
        return true;
      }
    }
  ],
  normal: [
    {
      id: 'g_normal_plate2',
      text: 'เสิร์ฟจานสมดุลให้ได้ 2 จาน',
      target: 2,
      check(stats, base) {
        return (stats.platesDone - (base.platesDone || 0)) >= 2;
      }
    },
    {
      id: 'g_normal_plate3',
      text: 'เสิร์ฟจานสมดุลให้ได้ 3 จาน',
      target: 3,
      check(stats, base) {
        return (stats.platesDone - (base.platesDone || 0)) >= 3;
      }
    },
    {
      id: 'g_normal_lowmiss',
      text: 'ในช่วงภารกิจนี้ แตะของไม่ดี (MISS) ได้ไม่เกิน 2 ครั้ง',
      target: 1,
      check(stats, base) {
        const missDiff = (stats.misses - (base.misses || 0));
        return missDiff <= 2 && (stats.platesDone - (base.platesDone || 0)) >= 1;
      }
    }
  ],
  hard: [
    {
      id: 'g_hard_plate3',
      text: 'เสิร์ฟจานสมดุลให้ได้ 3 จาน',
      target: 3,
      check(stats, base) {
        return (stats.platesDone - (base.platesDone || 0)) >= 3;
      }
    },
    {
      id: 'g_hard_plate4',
      text: 'เสิร์ฟจานสมดุลให้ได้ 4 จาน',
      target: 4,
      check(stats, base) {
        return (stats.platesDone - (base.platesDone || 0)) >= 4;
      }
    },
    {
      id: 'g_hard_combo',
      text: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 8 ครั้งในช่วงภารกิจ',
      target: 1,
      check(stats) {
        return stats.combo >= 8;
      }
    }
  ]
};

/**
 * MINI QUEST = ภารกิจย่อย เน้นหมู่ใดหมู่หนึ่ง / พฤติกรรมเฉพาะ
 */
const MINI_POOL = {
  easy: [
    {
      id: 'm_easy_g3_veg2',
      text: 'เก็บผัก (หมู่ 3) ให้ครบ 2 ชิ้น',
      target: 2,
      check(stats, base) {
        const cur = stats.gCounts?.[2] || 0;
        const b   = base.gCounts?.[2] || 0;
        return (cur - b) >= 2;
      }
    },
    {
      id: 'm_easy_g4_fruit2',
      text: 'เก็บผลไม้ (หมู่ 4) ให้ครบ 2 ชิ้น',
      target: 2,
      check(stats, base) {
        const cur = stats.gCounts?.[3] || 0;
        const b   = base.gCounts?.[3] || 0;
        return (cur - b) >= 2;
      }
    },
    {
      id: 'm_easy_g2_protein2',
      text: 'เก็บโปรตีน (หมู่ 2) ให้ครบ 2 ชิ้น',
      target: 2,
      check(stats, base) {
        const cur = stats.gCounts?.[1] || 0;
        const b   = base.gCounts?.[1] || 0;
        return (cur - b) >= 2;
      }
    },
    {
      id: 'm_easy_nosweet',
      text: 'พยายามไม่แตะของหวาน/ของทอดเกิน 1 ครั้งในระหว่างภารกิจ',
      target: 1,
      check(stats, base) {
        const missDiff = (stats.misses - (base.misses || 0));
        return missDiff <= 1;
      }
    }
  ],
  normal: [
    {
      id: 'm_normal_g3_veg3',
      text: 'เก็บผัก (หมู่ 3) ให้ครบ 3 ชิ้น',
      target: 3,
      check(stats, base) {
        const cur = stats.gCounts?.[2] || 0;
        const b   = base.gCounts?.[2] || 0;
        return (cur - b) >= 3;
      }
    },
    {
      id: 'm_normal_g4_fruit3',
      text: 'เก็บผลไม้ (หมู่ 4) ให้ครบ 3 ชิ้น',
      target: 3,
      check(stats, base) {
        const cur = stats.gCounts?.[3] || 0;
        const b   = base.gCounts?.[3] || 0;
        return (cur - b) >= 3;
      }
    },
    {
      id: 'm_normal_mix',
      text: 'เก็บอาหารอย่างน้อย 1 ชิ้นจากหมู่ 1–4 ภายในภารกิจนี้',
      target: 1,
      check(stats, base) {
        const cur = stats.gCounts || [];
        const b   = base.gCounts || [];
        for (let i = 0; i < 4; i++) {
          const diff = (cur[i] || 0) - (b[i] || 0);
          if (diff < 1) return false;
        }
        return true;
      }
    },
    {
      id: 'm_normal_combo5',
      text: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 5 ครั้ง',
      target: 1,
      check(stats) {
        return stats.combo >= 5;
      }
    }
  ],
  hard: [
    {
      id: 'm_hard_g3_veg4',
      text: 'เก็บผัก (หมู่ 3) ให้ครบ 4 ชิ้น',
      target: 4,
      check(stats, base) {
        const cur = stats.gCounts?.[2] || 0;
        const b   = base.gCounts?.[2] || 0;
        return (cur - b) >= 4;
      }
    },
    {
      id: 'm_hard_g4_fruit4',
      text: 'เก็บผลไม้ (หมู่ 4) ให้ครบ 4 ชิ้น',
      target: 4,
      check(stats, base) {
        const cur = stats.gCounts?.[3] || 0;
        const b   = base.gCounts?.[3] || 0;
        return (cur - b) >= 4;
      }
    },
    {
      id: 'm_hard_lowmiss',
      text: 'ระหว่างภารกิจนี้แตะของไม่ดี (MISS) ไม่เกิน 1 ครั้ง',
      target: 1,
      check(stats, base) {
        const missDiff = (stats.misses - (base.misses || 0));
        return missDiff <= 1;
      }
    },
    {
      id: 'm_hard_combo7',
      text: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 7 ครั้ง',
      target: 1,
      check(stats) {
        return stats.combo >= 7;
      }
    }
  ]
};

// ---------- Main factory ----------

export function createPlateQuest(diffKey = 'normal') {
  const key = (diffKey === 'easy' || diffKey === 'hard' || diffKey === 'normal')
    ? diffKey
    : 'normal';

  const stats = {
    score: 0,
    combo: 0,
    misses: 0,
    platesDone: 0,
    gCounts: [0, 0, 0, 0, 0],
    star: 0,
    diamond: 0
  };

  const deck = {
    stats,
    goals: [],
    minis: [],

    // เลือก Goal ครั้งละ 2 ภารกิจ จาก pool ตามระดับ
    drawGoals(n = 2) {
      const pool = GOAL_POOL[key] || GOAL_POOL.normal;
      this.goals = pickRandom(pool, n).map(q => wrapQuest(q, 'goal'));
      return this.goals;
    },

    // เลือก Mini Quest ครั้งละ 3 ภารกิจ จาก pool ตามระดับ
    draw3() {
      const pool = MINI_POOL[key] || MINI_POOL.normal;
      this.minis = pickRandom(pool, 3).map(q => wrapQuest(q, 'mini'));
      return this.minis;
    },

    getProgress(kind) {
      if (kind === 'goals') return this.goals;
      if (kind === 'mini')  return this.minis;
      return [];
    },

    updateScore(v) {
      stats.score = Number(v) || 0;
    },
    updateCombo(v) {
      stats.combo = Number(v) || 0;
    },

    // plate.safe.js จะอัปเดต stats.gCounts, stats.misses, stats.platesDone, star, diamond ให้เอง
    onGood() {
      this._checkAll(false);
    },
    onJunk() {
      this._checkAll(false);
    },
    second() {
      this._checkAll(true);
    },

    _checkAll(isTick) {
      const all = [...this.goals, ...this.minis];
      const cleared = [];

      for (const q of all) {
        if (q.done || typeof q.check !== 'function') continue;
        if (!q.base) {
          q.base = cloneStats(stats);  // เก็บ baseline ตอนเริ่มภารกิจ
        }
        if (q.check(stats, q.base, isTick)) {
          q.done = true;
          q.status = 'done';
          q.progress = q.target || 1;
          cleared.push(q);
        }
      }

      // ถ้ามีภารกิจสำเร็จ แจ้ง HUD / coach ผ่าน event กลาง
      if (cleared.length && typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('quest:cleared', {
            detail: {
              cleared,
              goals: this.goals,
              minis: this.minis
            }
          }));
        } catch (err) {
          console.warn('[PlateQuest] quest:cleared dispatch error', err);
        }
      }
    }
  };

  return deck;
}