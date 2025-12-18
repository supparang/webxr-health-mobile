// === /herohealth/vr-groups/quest-manager.js ===
// Food Groups Quest Manager (NON-MODULE VERSION)
// ✅ mini แบบจับเวลา → ส่ง mini.timeLeftSec ให้ HUD ใช้ได้จริง
// ✅ หมุนหมู่ทุก 15s + ส่ง groupLabel
// expose: window.GroupsQuest.createFoodGroupsQuest(diff, runMode?)

(function (ROOT) {
  'use strict';

  const FOOD_GROUPS = [
    { id: 'G1', key: 1, label: 'หมู่ 1 เนื้อ นม ไข่ ถั่วเมล็ด', emojis: ['🍗','🥩','🍖','🐟','🍳','🥛','🧀','🥜'] },
    { id: 'G2', key: 2, label: 'หมู่ 2 ข้าว แป้ง เผือก มัน',       emojis: ['🍚','🍞','🥖','🥔','🥐','🥯'] },
    { id: 'G3', key: 3, label: 'หมู่ 3 ผักต่าง ๆ',                 emojis: ['🥦','🥕','🥬','🍅','🧄','🧅'] },
    { id: 'G4', key: 4, label: 'หมู่ 4 ผลไม้',                      emojis: ['🍎','🍌','🍊','🍇','🍓','🍍','🍑'] },
    { id: 'G5', key: 5, label: 'หมู่ 5 ไขมัน',                       emojis: ['🥑','🧈','🥓'] }
  ];

  function createFoodGroupsQuest(diff = 'normal', runMode = 'play') {
    diff = String(diff || 'normal').toLowerCase();
    runMode = String(runMode || 'play').toLowerCase();

    let goal1Target, goal2Target;
    let miniComboNeed, miniTimeSec, miniNoJunkMax;

    if (diff === 'easy') {
      goal1Target = 10; goal2Target = 8;
      miniComboNeed = 3;
      miniTimeSec = 10;
      miniNoJunkMax = 2;
    } else if (diff === 'hard') {
      goal1Target = 18; goal2Target = 16;
      miniComboNeed = 5;
      miniTimeSec = 8;
      miniNoJunkMax = 1;
    } else {
      goal1Target = 14; goal2Target = 12;
      miniComboNeed = 4;
      miniTimeSec = 9;
      miniNoJunkMax = 1;
    }

    const state = {
      currentGroupIndex: 0,
      groupTimeSec: 0,

      goals: [
        { id:'GOAL-1', label:`เก็บอาหารดีหมู่ 1–3 ให้ครบ ${goal1Target} ชิ้น`, target:goal1Target, prog:0, done:false },
        { id:'GOAL-2', label:`เก็บอาหารดีหมู่ 4–5 ให้ครบ ${goal2Target} ชิ้น`, target:goal2Target, prog:0, done:false }
      ],

      minis: [
        {
          id:'MINI-1',
          type:'timed-combo',
          label:`ทำคอมโบให้ถึง x${miniComboNeed} ภายใน ${miniTimeSec} วินาที`,
          target: 1, prog: 0, done:false, failed:false,
          durationSec: miniTimeSec,
          timeLeftSec: miniTimeSec,
          comboNeed: miniComboNeed
        },
        {
          id:'MINI-2',
          type:'no-junk',
          label:`ช่วงหมู่ 5 ห้ามโดนขยะเกิน ${miniNoJunkMax} ครั้ง`,
          target: 1, prog: 0, done:false, failed:false,
          maxJunk: miniNoJunkMax,
          junkHit: 0
        },
        {
          id:'MINI-3',
          type:'timed-combo',
          label:`ทำคอมโบให้ถึง x${miniComboNeed + 1} ภายใน ${Math.max(6, miniTimeSec - 1)} วินาที`,
          target: 1, prog: 0, done:false, failed:false,
          durationSec: Math.max(6, miniTimeSec - 1),
          timeLeftSec: Math.max(6, miniTimeSec - 1),
          comboNeed: miniComboNeed + 1
        }
      ],

      activeMiniIndex: 0
    };

    function currentGroup() {
      return FOOD_GROUPS[state.currentGroupIndex] || FOOD_GROUPS[0];
    }

    function activeMini() {
      const m = state.minis[state.activeMiniIndex] || null;
      if (!m) return null;
      if (m.done || m.failed) return null;
      return m;
    }

    function advanceMini() {
      for (let i = state.activeMiniIndex + 1; i < state.minis.length; i++) {
        const m = state.minis[i];
        if (m && !m.done && !m.failed) {
          state.activeMiniIndex = i;
          if (m.type === 'timed-combo' && typeof m.durationSec === 'number') {
            m.timeLeftSec = m.durationSec;
          }
          ROOT.dispatchEvent?.(new CustomEvent('hha:coach', { detail: { text: 'ภารกิจเสริมใหม่มาแล้ว! ⭐' } }));
          return;
        }
      }
    }

    function markMiniDone(m) {
      if (!m || m.done || m.failed) return;
      m.done = true;
      m.prog = m.target;
      advanceMini();
    }

    function markMiniFailed(m) {
      if (!m || m.done || m.failed) return;
      m.failed = true;
      advanceMini();
    }

    function nextGroup() {
      state.currentGroupIndex++;
      if (state.currentGroupIndex >= FOOD_GROUPS.length) state.currentGroupIndex = FOOD_GROUPS.length - 1;
      state.groupTimeSec = 0;

      const g = currentGroup();
      ROOT.dispatchEvent?.(new CustomEvent('hha:coach', { detail: { text: `เข้าสู่ ${g.label}` } }));
    }

    function onGoodHit(groupId, comboNow) {
      if (groupId <= 3) {
        const g1 = state.goals[0];
        if (!g1.done && ++g1.prog >= g1.target) g1.done = true;
      } else {
        const g2 = state.goals[1];
        if (!g2.done && ++g2.prog >= g2.target) g2.done = true;
      }

      const m = activeMini();
      if (!m) return;

      if (m.type === 'timed-combo') {
        if (comboNow >= (m.comboNeed || 0)) markMiniDone(m);
      }
    }

    function onJunkHit(groupId, blocked) {
      const m = activeMini();
      if (!m) return;

      if (m.type === 'no-junk') {
        if (groupId === 5 && !blocked) {
          m.junkHit++;
          if (m.junkHit > m.maxJunk) {
            markMiniFailed(m);
            ROOT.dispatchEvent?.(new CustomEvent('hha:coach', { detail: { text: 'มินิพลาดแล้ว 😵 เดี๋ยวมีภารกิจใหม่!' } }));
          } else {
            markMiniDone(m);
          }
        }
      }
    }

    function second() {
      state.groupTimeSec++;
      if (state.groupTimeSec >= 15 && state.currentGroupIndex < FOOD_GROUPS.length - 1) nextGroup();

      const m = activeMini();
      if (m && m.type === 'timed-combo' && typeof m.timeLeftSec === 'number') {
        m.timeLeftSec = Math.max(0, (m.timeLeftSec | 0) - 1);
        if (m.timeLeftSec <= 0) {
          markMiniFailed(m);
          ROOT.dispatchEvent?.(new CustomEvent('hha:coach', { detail: { text: 'หมดเวลา! ลองภารกิจใหม่ ⭐' } }));
        }
      }
    }

    return {
      goals: state.goals,
      minis: state.minis,
      onGoodHit,
      onJunkHit,
      second,
      getActiveGroup: currentGroup,
      nextGroup,
      getActiveMini: activeMini
    };
  }

  ROOT.GroupsQuest = { createFoodGroupsQuest };
})(window);