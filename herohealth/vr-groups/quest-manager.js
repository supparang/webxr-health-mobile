// === /herohealth/vr-groups/quest-manager.js ===
// Food Groups Quest Manager (NON-MODULE VERSION)
// ✅ mini quest แบบมีเวลา (timer)
// ✅ ส่ง mini.timeLeftSec ออกมาให้ HUD โชว์ได้
// expose: window.GroupsQuest.createFoodGroupsQuest(diff, runMode)

(function (ROOT) {
  'use strict';

  const FOOD_GROUPS = [
    { id:'G1', key:1, label:'หมู่ 1 เนื้อ นม ไข่ ถั่วเมล็ด', emojis:['🍗','🥩','🍖','🐟','🍳','🥛','🧀','🥜'] },
    { id:'G2', key:2, label:'หมู่ 2 ข้าว แป้ง เผือก มัน',       emojis:['🍚','🍞','🥖','🥔','🥐','🥯'] },
    { id:'G3', key:3, label:'หมู่ 3 ผักต่าง ๆ',                 emojis:['🥦','🥕','🥬','🍅','🧄','🧅'] },
    { id:'G4', key:4, label:'หมู่ 4 ผลไม้',                     emojis:['🍎','🍌','🍊','🍇','🍓','🍍','🍑'] },
    { id:'G5', key:5, label:'หมู่ 5 ไขมัน',                     emojis:['🥑','🧈','🥓'] }
  ];

  function createFoodGroupsQuest(diff = 'normal', runMode = 'play') {
    diff = String(diff || 'normal').toLowerCase();
    runMode = (String(runMode || 'play').toLowerCase() === 'research') ? 'research' : 'play';

    // ===== difficulty knobs =====
    let goal1Target, goal2Target;
    let miniComboNeed, miniTimerSec, miniNoJunkMax, groupSwitchSec;

    if (diff === 'easy') {
      goal1Target = 10; goal2Target = 8;
      miniComboNeed = 3;
      miniTimerSec = 10;
      miniNoJunkMax = 2;
      groupSwitchSec = 16;
    } else if (diff === 'hard') {
      goal1Target = 18; goal2Target = 16;
      miniComboNeed = 5;
      miniTimerSec = 7;
      miniNoJunkMax = 1;
      groupSwitchSec = 14;
    } else {
      goal1Target = 14; goal2Target = 12;
      miniComboNeed = 4;
      miniTimerSec = 8;
      miniNoJunkMax = 1;
      groupSwitchSec = 15;
    }

    const state = {
      currentGroupIndex: 0,
      groupTimeSec: 0,

      goals: [
        { id:'GOAL-1', label:`เก็บอาหารดีหมู่ 1–3 ให้ครบ ${goal1Target} ชิ้น`, target:goal1Target, prog:0, done:false },
        { id:'GOAL-2', label:`เก็บอาหารดีหมู่ 4–5 ให้ครบ ${goal2Target} ชิ้น`, target:goal2Target, prog:0, done:false }
      ],

      minis: [],

      // mini system
      miniIndex: 0,
      miniLeftSec: 0,
      miniComboBest: 0,
      miniNoJunkHit: 0
    };

    function currentGroup() {
      return FOOD_GROUPS[state.currentGroupIndex] || FOOD_GROUPS[0];
    }

    function pushMini(m) {
      state.minis.push(m);
    }

    function newMiniCard(idx) {
      // ✅ 3 แบบวน: combo, timer collect, no-junk (กลุ่ม 5)
      const mod = idx % 3;

      if (mod === 0) {
        // combo mini (no timer)
        return {
          id: `MINI-COMBO-${idx+1}`,
          type: 'combo',
          label: `ทำคอมโบ x${miniComboNeed} ให้ได้!`,
          target: 1,
          prog: 0,
          done: false,
          failed: false,
          timeLeftSec: null
        };
      }

      if (mod === 1) {
        // timed mini (มีเวลา)
        return {
          id: `MINI-TIMER-${idx+1}`,
          type: 'timer',
          label: `เก็บอาหารดีให้ได้ 6 ชิ้นใน ${miniTimerSec} วิ`,
          target: 6,
          prog: 0,
          done: false,
          failed: false,
          timeLeftSec: miniTimerSec
        };
      }

      // no-junk mini (โฟกัสหมู่ 5)
      return {
        id: `MINI-NOJUNK-${idx+1}`,
        type: 'nojunk',
        label: `ช่วงหมู่ 5 ห้ามโดนขยะเกิน ${miniNoJunkMax} ครั้ง`,
        target: 1,
        prog: 0,
        done: false,
        failed: false,
        timeLeftSec: null
      };
    }

    function startNextMini() {
      const card = newMiniCard(state.miniIndex);
      state.miniIndex++;

      // init per type
      state.miniComboBest = 0;
      state.miniNoJunkHit = 0;

      if (card.type === 'timer') {
        state.miniLeftSec = card.timeLeftSec | 0;
      } else {
        state.miniLeftSec = 0;
      }

      pushMini(card);

      ROOT.dispatchEvent?.(new CustomEvent('hha:coach', {
        detail: { text: `Mini Quest มาแล้ว! ${card.label} ⭐` }
      }));
    }

    function activeMini() {
      for (let i = 0; i < state.minis.length; i++) {
        const m = state.minis[i];
        if (m && !m.done && !m.failed) return m;
      }
      return null;
    }

    function ensureMini() {
      if (!activeMini()) startNextMini();
    }

    function nextGroup() {
      state.currentGroupIndex++;
      if (state.currentGroupIndex >= FOOD_GROUPS.length) {
        state.currentGroupIndex = FOOD_GROUPS.length - 1;
      }
      state.groupTimeSec = 0;

      const g = currentGroup();
      ROOT.dispatchEvent?.(new CustomEvent('hha:coach', { detail:{ text:`เข้าสู่ ${g.label}` } }));
    }

    // init
    state.currentGroupIndex = 0;
    ensureMini();

    // ===== hooks =====
    function onGoodHit(groupId, comboNow) {
      // goals
      if (groupId <= 3) {
        const g1 = state.goals[0];
        if (!g1.done && ++g1.prog >= g1.target) g1.done = true;
      } else {
        const g2 = state.goals[1];
        if (!g2.done && ++g2.prog >= g2.target) g2.done = true;
      }

      ensureMini();
      const m = activeMini();
      if (!m) return;

      if (m.type === 'combo') {
        state.miniComboBest = Math.max(state.miniComboBest, comboNow|0);
        if (comboNow >= miniComboNeed) {
          m.prog = 1; m.done = true;
          ROOT.dispatchEvent?.(new CustomEvent('hha:coach', { detail:{ text:'คอมโบผ่านแล้ว! โหดมาก 😼' } }));
          ensureMini();
        }
      } else if (m.type === 'timer') {
        m.prog = (m.prog|0) + 1;
        if (m.prog >= m.target) {
          m.done = true;
          ROOT.dispatchEvent?.(new CustomEvent('hha:coach', { detail:{ text:'สปีดเควสต์ผ่าน! เร็วมากก ⚡' } }));
          ensureMini();
        }
      } else if (m.type === 'nojunk') {
        // mini นี้สำเร็จเมื่อ “ผ่านช่วงหมู่ 5” โดยไม่โดนขยะเกินที่กำหนด
        // (ให้ engine เรียก onJunkHit จะนับเอง)
      }
    }

    function onJunkHit(groupId, blocked) {
      // blocked ไม่ถือว่าโดน (ไม่เพิ่ม)
      if (blocked) return;

      const m = activeMini();
      if (!m) return;

      if (m.type === 'nojunk' && groupId === 5) {
        state.miniNoJunkHit++;
        if (state.miniNoJunkHit > miniNoJunkMax) {
          m.failed = true;
          ROOT.dispatchEvent?.(new CustomEvent('hha:coach', { detail:{ text:'Mini Quest พลาดแล้ว! ระวังขยะหน่อยนะ 😵' } }));
          ensureMini();
        }
      }
    }

    function second() {
      // group switching
      state.groupTimeSec++;
      if (state.groupTimeSec >= groupSwitchSec && state.currentGroupIndex < FOOD_GROUPS.length - 1) {
        nextGroup();
      }

      // mini timer tick
      const m = activeMini();
      if (m && m.type === 'timer') {
        state.miniLeftSec = Math.max(0, (state.miniLeftSec|0) - 1);
        m.timeLeftSec = state.miniLeftSec;

        if (state.miniLeftSec <= 0 && !m.done) {
          m.failed = true;
          ROOT.dispatchEvent?.(new CustomEvent('hha:coach', { detail:{ text:'หมดเวลา! Mini Quest เปลี่ยนข้อใหม่ ✨' } }));
          ensureMini();
        }
      }

      // “nojunk” success condition: ถ้าอยู่หมู่ 5 จนครบช่วงนึงและยังไม่ fail → ให้ผ่าน
      // (ทำให้เด็กป.5 ได้ลุ้น)
      const g = currentGroup();
      if (m && m.type === 'nojunk' && g && g.key === 5) {
        // ถ้าผ่านไป 6 วินาทีในหมู่ 5 และยังไม่ fail → done
        if (!m.failed && state.groupTimeSec >= 6) {
          m.prog = 1;
          m.done = true;
          ROOT.dispatchEvent?.(new CustomEvent('hha:coach', { detail:{ text:'หมู่ 5 ผ่านแบบเนียน ๆ! เก่งมาก 🥑✨' } }));
          ensureMini();
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
      nextGroup
    };
  }

  ROOT.GroupsQuest = { createFoodGroupsQuest };
})(window);