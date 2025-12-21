// === /herohealth/vr-groups/groups-quests.js ===
// Food Groups VR — Quest Pack (IIFE, NO import)
// ✅ exposes: window.GroupsQuest.createFoodGroupsQuest(diff)
// ✅ goals + minis + group rotation
// ✅ works with GameEngine.js (emitQuestUpdate / quest.second / onGoodHit / onJunkHit)

(function (root) {
  'use strict';

  const FOOD_GROUPS = [
    { key: 1, label: 'หมู่ 1 โปรตีน', emojis: ['🍗','🥩','🐟','🍳','🥚','🫘','🥛','🧀'] },
    { key: 2, label: 'หมู่ 2 คาร์บ',   emojis: ['🍚','🍞','🥖','🥔','🍜','🥨'] },
    { key: 3, label: 'หมู่ 3 ผัก',     emojis: ['🥦','🥕','🥬','🍅','🥒','🫑'] },
    { key: 4, label: 'หมู่ 4 ผลไม้',   emojis: ['🍎','🍌','🍊','🍉','🍇','🍓'] },
    { key: 5, label: 'หมู่ 5 ไขมัน',   emojis: ['🥑','🧈','🥜','🌰','🫒'] },
  ];

  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  function createFoodGroupsQuest(diff){
    diff = String(diff||'normal').toLowerCase();

    // --- tuning ---
    const goalTarget = (diff==='easy') ? 9 : (diff==='hard' ? 12 : 10);
    const miniCombo  = (diff==='easy') ? 5 : (diff==='hard' ? 7 : 6);
    const noJunkSec  = (diff==='easy') ? 4 : (diff==='hard' ? 6 : 5);

    const st = {
      groupIndex: 0,

      // mini states
      streak: 0,
      safeSec: 0,
      lastJunkHitAtMs: 0,

      rushActive: false,
      rushLeft: 0,
      rushNeed: 5,
      rushGot: 0,
      rushNoJunk: true,
    };

    const goals = [
      { id:'g1', label:'', target: goalTarget, prog:0, done:false },
      { id:'g2', label:'', target: goalTarget, prog:0, done:false },
    ];

    const minis = [
      { id:'m1', label:'', target: miniCombo, prog:0, done:false },
      { id:'m2', label:'', target: noJunkSec, prog:0, done:false },
      { id:'m3', label:'', target: 5, prog:0, done:false }, // Plate Rush (5 in 8s + no junk)
    ];

    function getActiveGroup(){
      return FOOD_GROUPS[st.groupIndex] || FOOD_GROUPS[0];
    }

    function refreshLabels(){
      const g = getActiveGroup();
      if (goals[0] && !goals[0].done && !goals[0].label) {
        goals[0].label = `เก็บอาหาร ${g.label} ให้ได้ ${goals[0].target} ชิ้น`;
      }
      if (goals[1] && !goals[1].done && !goals[1].label) {
        goals[1].label = `เก็บอาหาร ${g.label} ให้ได้ ${goals[1].target} ชิ้น`;
      }

      minis[0].label = `คอมโบ ${minis[0].target} (อย่าพลาด!)`;
      minis[1].label = `อยู่รอด ${minis[1].target} วิ ไม่โดนขยะ`;
      minis[2].label = `Plate Rush: เก็บ 5 ใน 8 วิ + ห้ามโดนขยะ`;
    }

    function advanceGroup(){
      st.groupIndex = (st.groupIndex + 1) % FOOD_GROUPS.length;

      // reset goal label to reflect new group
      const g = getActiveGroup();
      const activeGoal = goals.find(x=>x && !x.done);
      if (activeGoal){
        activeGoal.label = `เก็บอาหาร ${g.label} ให้ได้ ${activeGoal.target} ชิ้น`;
        activeGoal.prog = 0;
      }

      // minis soft reset
      st.streak = 0; minis[0].prog = 0;
    }

    function activeGoal(){
      return goals.find(x=>x && !x.done) || null;
    }

    function markDone(item){
      if (!item || item.done) return;
      item.done = true;
      item.prog = item.target;
    }

    function startRush(){
      st.rushActive = true;
      st.rushLeft = 8;
      st.rushNeed = 5;
      st.rushGot = 0;
      st.rushNoJunk = true;
      minis[2].prog = 0;
    }

    function resetRush(){
      st.rushActive = false;
      st.rushLeft = 0;
      st.rushGot = 0;
      st.rushNoJunk = true;
      minis[2].prog = 0;
    }

    // initialize labels
    refreshLabels();
    // ensure goal label includes first group
    goals[0].label = `เก็บอาหาร ${getActiveGroup().label} ให้ได้ ${goals[0].target} ชิ้น`;
    goals[1].label = `เก็บอาหาร ${getActiveGroup().label} ให้ได้ ${goals[1].target} ชิ้น`;

    return {
      goals,
      minis,

      getActiveGroup,

      onGoodHit(groupId, combo){
        refreshLabels();

        // --- GOAL progress ---
        const g = activeGoal();
        if (g){
          g.prog = clamp(g.prog + 1, 0, g.target);
          if (g.prog >= g.target){
            markDone(g);

            // ถ้ายังมี goal ถัดไป -> เปลี่ยนหมู่
            const next = activeGoal();
            if (next){
              advanceGroup();
              refreshLabels();
            }
          }
        }

        // --- MINI 1: combo streak ---
        st.streak = clamp(st.streak + 1, 0, 99);
        minis[0].prog = clamp(st.streak, 0, minis[0].target);
        if (!minis[0].done && minis[0].prog >= minis[0].target) markDone(minis[0]);

        // --- MINI 3: Plate Rush auto-start (โหดแบบเห็นผล) ---
        if (!minis[2].done){
          if (!st.rushActive && Math.random() < 0.14) startRush(); // โผล่เป็นระยะ
          if (st.rushActive){
            st.rushGot++;
            minis[2].prog = clamp(st.rushGot, 0, minis[2].target);
            if (st.rushNoJunk && st.rushGot >= st.rushNeed && st.rushLeft > 0){
              markDone(minis[2]);
              resetRush();
            }
          }
        }
      },

      onJunkHit(groupId){
        // reset combo mini
        st.streak = 0;
        minis[0].prog = 0;

        // reset safe mini
        st.safeSec = 0;
        minis[1].prog = 0;
        st.lastJunkHitAtMs = Date.now();

        // break rush
        if (st.rushActive){
          st.rushNoJunk = false;
          resetRush();
        }
      },

      second(){
        refreshLabels();

        // MINI 2: no junk for N sec
        st.safeSec = clamp(st.safeSec + 1, 0, 99);
        minis[1].prog = clamp(st.safeSec, 0, minis[1].target);
        if (!minis[1].done && minis[1].prog >= minis[1].target) markDone(minis[1]);

        // Rush countdown
        if (!minis[2].done && st.rushActive){
          st.rushLeft--;
          if (st.rushLeft <= 0){
            resetRush();
          }
        }
      }
    };
  }

  root.GroupsQuest = root.GroupsQuest || {};
  root.GroupsQuest.createFoodGroupsQuest = createFoodGroupsQuest;

})(window);