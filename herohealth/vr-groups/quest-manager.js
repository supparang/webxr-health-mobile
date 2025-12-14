// === /herohealth/vr-groups/quest-manager.js ===
// สร้าง Goal 2 อัน + Mini 3 อัน + phase 5 หมู่
'use strict';

const FOOD_GROUPS = [
  {
    id: 'G1',
    key: 1,
    label: 'หมู่ 1 เนื้อ นม ไข่ ถั่วเมล็ด',
    emojis: ['🍗','🥩','🍖','🐟','🍳','🥛','🧀','🥜']
  },
  {
    id: 'G2',
    key: 2,
    label: 'หมู่ 2 ข้าว แป้ง เผือก มัน',
    emojis: ['🍚','🍞','🥖','🥔','🥐','🥯']
  },
  {
    id: 'G3',
    key: 3,
    label: 'หมู่ 3 ผักต่าง ๆ',
    emojis: ['🥦','🥕','🥬','🍅','🧄','🧅']
  },
  {
    id: 'G4',
    key: 4,
    label: 'หมู่ 4 ผลไม้',
    emojis: ['🍎','🍌','🍊','🍇','🍓','🍍','🍑']
  },
  {
    id: 'G5',
    key: 5,
    label: 'หมู่ 5 ไขมัน',
    emojis: ['🥑','🧈','🥓','🧴'] // เลือกที่เป็น “ดี” เป็นหลัก
  }
];

export function createFoodGroupsQuest(diff = 'normal') {
  diff = String(diff || 'normal').toLowerCase();

  // ปรับเป้าแต่ละระดับ
  let goal1Target, goal2Target;
  let mini1Combo, mini2Combo, mini3Need;

  if (diff === 'easy') {
    goal1Target = 10;  // หมู่ 1–3
    goal2Target = 8;   // หมู่ 4–5
    mini1Combo  = 3;
    mini2Combo  = 4;
    mini3Need   = 2;   // เช่น ไม่พลาด junk ในหมู่ 5 เกิน 2 ครั้ง
  } else if (diff === 'hard') {
    goal1Target = 18;
    goal2Target = 16;
    mini1Combo  = 4;
    mini2Combo  = 6;
    mini3Need   = 1;   // ห้ามโดน junk ช่วงหมู่ 5 เลย
  } else {
    goal1Target = 14;
    goal2Target = 12;
    mini1Combo  = 4;
    mini2Combo  = 5;
    mini3Need   = 1;
  }

  const state = {
    // Phase หมู่ที่เล่นอยู่ (1–5)
    currentGroupIndex: 0,
    groupTimeSec: 0,

    // นับตาม Quest
    goals: [
      {
        id: 'GOAL-1',
        label: 'Goal 1: เก็บอาหารดีจากหมู่ 1–3 ให้ครบ ' + goal1Target + ' ชิ้น',
        target: goal1Target,
        prog: 0,
        done: false
      },
      {
        id: 'GOAL-2',
        label: 'Goal 2: เก็บอาหารดีจากหมู่ 4–5 ให้ครบ ' + goal2Target + ' ชิ้น',
        target: goal2Target,
        prog: 0,
        done: false
      }
    ],
    minis: [
      {
        id: 'MINI-1',
        groupRange: [1,2],
        label: `Mini 1: คอมโบถึง x${mini1Combo} อย่างน้อย 1 ครั้ง (หมู่ 1–2)`,
        comboNeed: mini1Combo,
        prog: 0,
        target: 1,
        done: false
      },
      {
        id: 'MINI-2',
        groupRange: [3,4],
        label: `Mini 2: คอมโบถึง x${mini2Combo} อย่างน้อย 1 ครั้ง (หมู่ 3–4)`,
        comboNeed: mini2Combo,
        prog: 0,
        target: 1,
        done: false
      },
      {
        id: 'MINI-3',
        groupRange: [5,5],
        label: 'Mini 3: ช่วงหมู่ 5 อย่าโดนของขยะเกิน ' + mini3Need + ' ครั้ง',
        maxJunk: mini3Need,
        junkHit: 0,
        prog: 0,
        target: 1,
        done: false
      }
    ],
    stats: {
      activeGroupId: 1,
      greenTick: 0
    }
  };

  function currentGroup() {
    return FOOD_GROUPS[state.currentGroupIndex] || FOOD_GROUPS[0];
  }

  // เรียกเมื่อเริ่มเล่น / เปลี่ยนหมู่
  function nextGroup() {
    state.currentGroupIndex++;
    if (state.currentGroupIndex > FOOD_GROUPS.length) {
      state.currentGroupIndex = FOOD_GROUPS.length;
      return;
    }
    const g = currentGroup();
    state.stats.activeGroupId = g.key;
    state.groupTimeSec = 0;

    // ยิงโค้ชตามหมู่
    if (window && window.dispatchEvent) {
      let text = '';
      if (g.key === 1) {
        text = 'หมู่ 1 เนื้อนมไข่ถั่วเมล็ดช่วยให้เติบโตแข็งแรง 💪 เลือก 🥩🍗🥛 ให้เยอะ ๆ นะ';
      } else if (g.key === 2) {
        text = 'หมู่ 2 ข้าว แป้ง เผือก มัน ให้พลังงานทั้งวัน 🍚 เลือกแบบไม่หวานจัดนะ';
      } else if (g.key === 3) {
        text = 'หมู่ 3 ผักสีต่าง ๆ เพิ่มวิตามิน แร่ธาตุ 🥦 ลองเก็บให้ครบหลายสีดูสิ';
      } else if (g.key === 4) {
        text = 'หมู่ 4 ผลไม้ช่วยให้สดชื่น 🍎🍊 ลองเลือกผลไม้แทนขนมหวานดูนะ';
      } else if (g.key === 5) {
        text = 'หมู่ 5 ไขมัน อย่าลืมแต่เอาแบบดี ๆ อย่าง 🥑 แล้วหลบของทอดนะ';
      }
      window.dispatchEvent(new CustomEvent('hha:coach', {
        detail: { text }
      }));
    }
  }

  // เรียกตอนเริ่มเกม
  nextGroup();

  // --- Hooks ให้ GameEngine เรียก ---

  function onGoodHit(groupId, comboNow) {
    // อัปเดต Goal
    if (groupId <= 3) {
      const g1 = state.goals[0];
      if (!g1.done) {
        g1.prog++;
        if (g1.prog >= g1.target) {
          g1.done = true;
        }
      }
    } else {
      const g2 = state.goals[1];
      if (!g2.done) {
        g2.prog++;
        if (g2.prog >= g2.target) {
          g2.done = true;
        }
      }
    }

    // อัปเดต Mini 1 / 2
    for (const m of state.minis) {
      if (m.id === 'MINI-3') continue;
      const [a,b] = m.groupRange;
      if (!m.done && groupId >= a && groupId <= b && comboNow >= m.comboNeed) {
        m.prog = 1;
        m.done = true;
      }
    }
  }

  function onJunkHit(groupId) {
    const m3 = state.minis[2];
    if (groupId === 5 && !m3.done) {
      m3.junkHit++;
      if (m3.junkHit > m3.maxJunk) {
        // ไม่ผ่าน mini แต่ไม่ต้องทำอะไร เพิ่มแค่สถิติ
      }
    }
  }

  // เรียกทุกวินาที
  function second() {
    state.groupTimeSec++;
    // เช่น ทุก 15 วิ เปลี่ยนหมู่
    if (state.groupTimeSec >= 15 && state.currentGroupIndex < FOOD_GROUPS.length) {
      nextGroup();
    }
  }

  function getProgress(kind) {
    if (kind === 'goals') return state.goals;
    if (kind === 'mini')  return state.minis;
    return {
      goals: state.goals,
      minis: state.minis
    };
  }

  function getActiveGroup() {
    return currentGroup();
  }

  return {
    state,
    goals: state.goals,
    minis: state.minis,
    onGoodHit,
    onJunkHit,
    second,
    getProgress,
    getActiveGroup,
    nextGroup
  };
}