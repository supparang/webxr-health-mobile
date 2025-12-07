// === /herohealth/plate/plate.quest.js ===
// Mission / Quest Deck สำหรับ Balanced Plate VR
// ใช้ร่วมกับ plate.safe.js
//
// API ที่ plate.safe.js เรียกใช้:
//   - export const QUOTA = { easy: [...], normal: [...], hard: [...] }
//   - export function createPlateQuest(diff) -> deck {
//        deck.stats        (object)
//        deck.updateScore(score)
//        deck.updateCombo(combo)
//        deck.getProgress(kind: 'goals' | 'mini')
//        deck.drawGoals(n)
//        deck.draw3()      // วาด mini quest 3 อัน
//        deck.onGood()
//        deck.onJunk()
//        deck.second()
//     }

export const QUOTA = {
  // [หมู่ 1, หมู่ 2, หมู่ 3, หมู่ 4, หมู่ 5]
  // ปรับตามระดับความยาก: ยิ่งยาก ต้องเก็บผัก/โปรตีนมากขึ้นใน "หนึ่งจาน"
  easy:   [1, 1, 1, 1, 1],  // จานพื้นฐานครบ 5 หมู่
  normal: [1, 1, 2, 1, 1],  // ผักเพิ่มขึ้น
  hard:   [1, 2, 2, 1, 1]   // โปรตีน + ผักมากขึ้น
};

// สร้าง deck สำหรับโหมด plate ตาม diff
export function createPlateQuest(diff = 'normal') {
  diff = String(diff || 'normal').toLowerCase();
  if (!['easy', 'normal', 'hard'].includes(diff)) diff = 'normal';

  // ===== Stats กลางที่ engine จะมาอัปเดต =====
  const stats = {
    score: 0,
    combo: 0,
    gCounts: [0, 0, 0, 0, 0], // รวมทั้งเกม หมู่ 1–5
    star: 0,
    diamond: 0,
    goodHits: 0,
    junkHits: 0,
    timeSec: 0
  };

  // ===== Template ของ Goal (เป้าหมายใหญ่) =====
  // ใช้ check(stats) -> true แปลว่า quest นี้สำเร็จ
  const goalPool = [
    {
      id: 'cover_all_groups',
      type: 'goal',
      level: 'all',
      text: 'เก็บอาหารให้ครบทั้ง 5 หมู่ในเกมนี้',
      check(s) {
        return s.gCounts.filter(v => v > 0).length >= 5;
      }
    },
    {
      id: 'veg_focus',
      type: 'goal',
      level: 'normal+',
      text: 'เก็บอาหารหมู่ผัก (หมู่ 3) อย่างน้อย 5 ชิ้นรวมทั้งเกม',
      check(s) {
        return (s.gCounts[2] || 0) >= 5;
      }
    },
    {
      id: 'fruit_focus',
      type: 'goal',
      level: 'normal+',
      text: 'เก็บอาหารหมู่ผลไม้ (หมู่ 4) อย่างน้อย 4 ชิ้นรวมทั้งเกม',
      check(s) {
        return (s.gCounts[3] || 0) >= 4;
      }
    },
    {
      id: 'low_junk',
      type: 'goal',
      level: 'all',
      text: 'รักษาจำนวนการแตะของไม่ดี (MISS) ไม่เกิน 3 ครั้งตลอดเกม',
      check(s) {
        return s.timeSec >= 20 && s.junkHits <= 3;
      }
    },
    {
      id: 'combo_goal',
      type: 'goal',
      level: 'hard',
      text: 'ทำคอมโบให้ถึงอย่างน้อย 8 ครั้งในเกมนี้',
      check(s) {
        return s.combo >= 8;
      }
    }
  ];

  // ===== Template ของ Mini Quest (ภารกิจย่อย) =====
  const miniPool = [
    {
      id: 'mini_veg2',
      type: 'mini',
      level: 'all',
      text: 'เก็บผัก (หมู่ 3) ให้ครบ 2 ชิ้น',
      check(s) {
        return (s.gCounts[2] || 0) >= 2;
      }
    },
    {
      id: 'mini_fruit2',
      type: 'mini',
      level: 'all',
      text: 'เก็บผลไม้ (หมู่ 4) ให้ครบ 2 ชิ้น',
      check(s) {
        return (s.gCounts[3] || 0) >= 2;
      }
    },
    {
      id: 'mini_protein2',
      type: 'mini',
      level: 'normal+',
      text: 'เก็บอาหารหมู่โปรตีน (หมู่ 2) ให้ครบ 2 ชิ้น',
      check(s) {
        return (s.gCounts[1] || 0) >= 2;
      }
    },
    {
      id: 'mini_combo3',
      type: 'mini',
      level: 'all',
      text: 'ทำคอมโบให้ถึงอย่างน้อย 3 ครั้ง',
      check(s) {
        return s.combo >= 3;
      }
    },
    {
      id: 'mini_low_junk1',
      type: 'mini',
      level: 'all',
      text: 'ลองเล่นช่วงต้นเกมให้ MISS ไม่เกิน 1 ครั้งภายใน 20 วินาทีแรก',
      check(s) {
        return s.timeSec >= 20 && s.junkHits <= 1;
      }
    }
  ];

  // กรอง quest ตามระดับความยาก
  function filterByDiff(pool) {
    return pool.filter(q => {
      if (q.level === 'all') return true;
      if (q.level === 'normal+' && (diff === 'normal' || diff === 'hard')) return true;
      if (q.level === 'hard' && diff === 'hard') return true;
      return false;
    });
  }

  const goalTemplates = filterByDiff(goalPool);
  const miniTemplates = filterByDiff(miniPool);

  // ===== ก้อนเก็บภารกิจที่ "ใช้งานอยู่" =====
  let activeGoals = [];
  let activeMinis = [];

  function cloneQuest(tpl) {
    return {
      id: tpl.id,
      type: tpl.type,
      text: tpl.text,
      level: tpl.level,
      done: false,
      check: tpl.check
    };
  }

  function recomputeDone() {
    for (const g of activeGoals) {
      if (!g.done && typeof g.check === 'function') {
        if (g.check(stats)) g.done = true;
      }
    }
    for (const m of activeMinis) {
      if (!m.done && typeof m.check === 'function') {
        if (m.check(stats)) m.done = true;
      }
    }
  }

  // วาด Goal ใหม่ (แทนชุดเดิมทั้งหมด)
  function drawGoals(n = 2) {
    activeGoals = [];
    if (!goalTemplates.length) return;
    for (let i = 0; i < n; i++) {
      const tpl = goalTemplates[i % goalTemplates.length];
      activeGoals.push(cloneQuest(tpl));
    }
    recomputeDone();
  }

  // วาด Mini Quest 3 อัน
  function draw3() {
    const n = 3;
    activeMinis = [];
    if (!miniTemplates.length) return;
    for (let i = 0; i < n; i++) {
      const tpl = miniTemplates[i % miniTemplates.length];
      activeMinis.push(cloneQuest(tpl));
    }
    recomputeDone();
  }

  const deck = {
    stats,

    updateScore(v) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        stats.score = v;
      }
      recomputeDone();
    },

    updateCombo(v) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        stats.combo = v;
      }
      recomputeDone();
    },

    getProgress(kind) {
      if (kind === 'goals') return activeGoals;
      if (kind === 'mini')  return activeMinis;
      return [];
    },

    drawGoals,
    draw3,

    onGood() {
      stats.goodHits++;
      recomputeDone();
    },

    onJunk() {
      stats.junkHits++;
      recomputeDone();
    },

    second() {
      stats.timeSec++;
      recomputeDone();
    }
  };

  return deck;
}

export default { createPlateQuest, QUOTA };
