// === /herohealth/vr-groups/quest-manager.js ===
// Food Groups Quest Manager (NON-MODULE VERSION)
// ใช้กับ <script src="..."> ได้ทันที
// expose: window.GroupsQuest.createFoodGroupsQuest()

(function (ROOT) {
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
      emojis: ['🥑','🧈','🥓']
    }
  ];

  function createFoodGroupsQuest(diff = 'normal') {
    diff = String(diff || 'normal').toLowerCase();

    // ===== ปรับค่า quest ตามระดับ =====
    let goal1Target, goal2Target;
    let mini1Combo, mini2Combo, mini3MaxJunk;

    if (diff === 'easy') {
      goal1Target = 10;
      goal2Target = 8;
      mini1Combo  = 3;
      mini2Combo  = 4;
      mini3MaxJunk = 2;
    } else if (diff === 'hard') {
      goal1Target = 18;
      goal2Target = 16;
      mini1Combo  = 4;
      mini2Combo  = 6;
      mini3MaxJunk = 1;
    } else {
      goal1Target = 14;
      goal2Target = 12;
      mini1Combo  = 4;
      mini2Combo  = 5;
      mini3MaxJunk = 1;
    }

    const state = {
      currentGroupIndex: 0,
      groupTimeSec: 0,

      goals: [
        {
          id: 'GOAL-1',
          label: `เก็บอาหารดีหมู่ 1–3 ให้ครบ ${goal1Target} ชิ้น`,
          target: goal1Target,
          prog: 0,
          done: false
        },
        {
          id: 'GOAL-2',
          label: `เก็บอาหารดีหมู่ 4–5 ให้ครบ ${goal2Target} ชิ้น`,
          target: goal2Target,
          prog: 0,
          done: false
        }
      ],

      minis: [
        {
          id: 'MINI-1',
          label: `คอมโบ x${mini1Combo} (หมู่ 1–2)`,
          comboNeed: mini1Combo,
          prog: 0,
          target: 1,
          done: false
        },
        {
          id: 'MINI-2',
          label: `คอมโบ x${mini2Combo} (หมู่ 3–4)`,
          comboNeed: mini2Combo,
          prog: 0,
          target: 1,
          done: false
        },
        {
          id: 'MINI-3',
          label: `หมู่ 5 อย่าโดนขยะเกิน ${mini3MaxJunk} ครั้ง`,
          junkHit: 0,
          maxJunk: mini3MaxJunk,
          prog: 0,
          target: 1,
          done: false
        }
      ]
    };

    function currentGroup() {
      return FOOD_GROUPS[state.currentGroupIndex] || FOOD_GROUPS[0];
    }

    function nextGroup() {
      state.currentGroupIndex++;
      if (state.currentGroupIndex >= FOOD_GROUPS.length) {
        state.currentGroupIndex = FOOD_GROUPS.length - 1;
      }
      state.groupTimeSec = 0;

      const g = currentGroup();
      ROOT.dispatchEvent?.(new CustomEvent('hha:coach', {
        detail: { text: `เข้าสู่ ${g.label}` }
      }));
    }

    // เริ่มที่หมู่ 1
    state.currentGroupIndex = 0;

    // ===== Hooks ให้ GameEngine เรียก =====

    function onGoodHit(groupId, comboNow) {
      if (groupId <= 3) {
        const g1 = state.goals[0];
        if (!g1.done && ++g1.prog >= g1.target) g1.done = true;
      } else {
        const g2 = state.goals[1];
        if (!g2.done && ++g2.prog >= g2.target) g2.done = true;
      }

      state.minis.forEach(m => {
        if (!m.done && m.comboNeed && comboNow >= m.comboNeed) {
          m.prog = 1;
          m.done = true;
        }
      });
    }

    function onJunkHit(groupId) {
      const m3 = state.minis[2];
      if (groupId === 5 && !m3.done) {
        m3.junkHit++;
        if (m3.junkHit <= m3.maxJunk) {
          m3.prog = 1;
          m3.done = true;
        }
      }
    }

    function second() {
      state.groupTimeSec++;
      if (state.groupTimeSec >= 15 && state.currentGroupIndex < FOOD_GROUPS.length - 1) {
        nextGroup();
      }
    }

    return {
      goals: state.goals,
      minis: state.minis,
      onGoodHit,
      onJunkHit,
      second,
      getActiveGroup: currentGroup,
      nextGroup
    };
  }

  // ✅ expose แบบ non-module
  ROOT.GroupsQuest = {
    createFoodGroupsQuest
  };

})(window);
