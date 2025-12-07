// === /herohealth/plate/plate.quest.js
// เด็คภารกิจสำหรับ Balanced Plate

export const QUOTA = {
  easy:   [2, 2, 2, 1, 1],  // หมู่ 1–5
  normal: [3, 3, 3, 2, 2],
  hard:   [4, 4, 4, 3, 3]
};

function clampDiff(diff) {
  diff = String(diff || 'normal').toLowerCase();
  if (!['easy','normal','hard'].includes(diff)) return 'normal';
  return diff;
}

export function createPlateQuest(diff = 'normal') {
  diff = clampDiff(diff);
  const quota = QUOTA[diff] || QUOTA.normal;

  const stats = {
    score: 0,
    combo: 0,
    seconds: 0,
    goodHits: 0,
    junkMiss: 0,
    gCounts: [0,0,0,0,0],
    star: 0,
    diamond: 0
  };

  const deck = {
    stats,
    goals: [],
    minis: [],

    updateScore(v) { stats.score = v | 0; },
    updateCombo(v) { stats.combo = v | 0; },

    getProgress(kind) {
      if (kind === 'goals') return deck.goals;
      if (kind === 'mini')  return deck.minis;
      return [];
    },

    drawGoals(n = 2) {
      const pool = buildGoalPool(quota);
      shuffle(pool);
      deck.goals = pool.slice(0, n);
      refreshDone();
    },

    draw3() {
      const pool = buildMiniPool(quota);
      shuffle(pool);
      deck.minis = pool.slice(0, 3);
      refreshDone();
    },

    onGood() {
      stats.goodHits++;
      refreshDone();
    },

    onJunk() {
      stats.junkMiss++;
      refreshDone();
    },

    second() {
      stats.seconds++;
      refreshDone();
    }
  };

  function refreshDone() {
    for (const g of deck.goals) {
      g.done = !!g.check(stats);
    }
    for (const m of deck.minis) {
      m.done = !!m.check(stats);
    }
  }

  return deck;
}

// ---------- Goal & Mini definitions ----------

function buildGoalPool(quota) {
  const labels = {
    0: 'หมู่ 1 ข้าว-แป้ง',
    1: 'หมู่ 2 เนื้อสัตว์/โปรตีน',
    2: 'หมู่ 3 ผัก',
    3: 'หมู่ 4 ผลไม้',
    4: 'หมู่ 5 นม/ผลิตภัณฑ์นม'
  };

  return [
    {
      id: 'all-5',
      label: 'จัดจานให้ครบทั้ง 5 หมู่ตามโควตา',
      check: (s) => s.gCounts.every((v,i) => v >= (quota[i] ?? 0)),
      done: false
    },
    {
      id: 'grp1',
      label: `เก็บ ${labels[0]} อย่างน้อย ${quota[0]} ชิ้น`,
      check: (s) => s.gCounts[0] >= (quota[0] ?? 0),
      done: false
    },
    {
      id: 'grp2',
      label: `เก็บ ${labels[1]} อย่างน้อย ${quota[1]} ชิ้น`,
      check: (s) => s.gCounts[1] >= (quota[1] ?? 0),
      done: false
    },
    {
      id: 'grp3',
      label: `เก็บ ${labels[2]} อย่างน้อย ${quota[2]} ชิ้น`,
      check: (s) => s.gCounts[2] >= (quota[2] ?? 0),
      done: false
    },
    {
      id: 'grp4',
      label: `เก็บ ${labels[3]} ให้ได้ตามโควตา`,
      check: (s) => s.gCounts[3] >= (quota[3] ?? 0),
      done: false
    },
    {
      id: 'grp5',
      label: `เก็บ ${labels[4]} ให้ได้ตามโควตา`,
      check: (s) => s.gCounts[4] >= (quota[4] ?? 0),
      done: false
    }
  ];
}

function buildMiniPool(quota) {
  return [
    {
      id: 'good-10',
      label: 'เก็บอาหารดีรวม 10 ชิ้น',
      check: (s) => s.goodHits >= 10,
      done: false
    },
    {
      id: 'good-20',
      label: 'เก็บอาหารดีรวม 20 ชิ้น',
      check: (s) => s.goodHits >= 20,
      done: false
    },
    {
      id: 'nojunk-2',
      label: 'พยายามแตะของไม่ดีไม่เกิน 2 ครั้ง',
      check: (s) => s.junkMiss <= 2 && s.seconds > 0,
      done: false
    },
    {
      id: 'combo-5',
      label: 'ทำคอมโบให้ถึง 5 ขึ้นไปอย่างน้อยหนึ่งครั้ง',
      check: (s) => s.combo >= 5,
      done: false
    },
    {
      id: 'veg-focus',
      label: 'โฟกัสเก็บผัก (หมู่ 3) ให้มากกว่า 3 ชิ้น',
      check: (s) => s.gCounts[2] >= Math.max(3, quota[2] ?? 0),
      done: false
    },
    {
      id: 'fruit-focus',
      label: 'โฟกัสเก็บผลไม้ (หมู่ 4) ให้มากกว่า 3 ชิ้น',
      check: (s) => s.gCounts[3] >= Math.max(3, quota[3] ?? 0),
      done: false
    }
  ];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
