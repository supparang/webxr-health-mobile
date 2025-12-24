// === /herohealth/vr-groups/groups-quests.js ===
// Food Groups Quest Manager (IIFE) — Goals(2) + Minis(7) + Auto Rotate Groups (FIX-ALL)
// Exposes: window.GroupsQuest.createFoodGroupsQuest(diff)
// Designed to work with GameEngine.js that calls:
//   quest.onGoodHit(groupKey, combo)
//   quest.onJunkHit(groupKey)
//   quest.second()

(function () {
  'use strict';

  const FOOD_GROUPS = [
    { key: 1, label: 'หมู่ 1 โปรตีน 💪', emojis: ['🍗','🥩','🐟','🍳','🥛','🧀','🥜'] },
    { key: 2, label: 'หมู่ 2 คาร์บ/พลังงาน ⚡', emojis: ['🍚','🍞','🥔','🌽','🥨'] },
    { key: 3, label: 'หมู่ 3 ผัก 🥦', emojis: ['🥦','🥕','🥬','🥒','🌶️'] },
    { key: 4, label: 'หมู่ 4 ผลไม้ 🍎', emojis: ['🍎','🍌','🍊','🍉','🍍'] },
    { key: 5, label: 'หมู่ 5 ไขมัน 🥑', emojis: ['🥑','🧈','🫒','🍫','🧀'] }
  ];

  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function pick(arr, i, fallback){ return (Array.isArray(arr) && arr[i] != null) ? arr[i] : fallback; }

  function diffFlags(diff){
    const d = String(diff || 'normal').toLowerCase();
    return { isEasy: d === 'easy', isHard: d === 'hard', d };
  }

  function makeGoals(diff){
    const { isEasy, isHard } = diffFlags(diff);
    const comboTarget = isEasy ? 10 : (isHard ? 16 : 12);
    const uniqTarget  = isEasy ? 4  : (isHard ? 5  : 4);

    return [
      { id:'g1', label:`ทำคอมโบให้ถึง ${comboTarget} 🔥`, target: comboTarget, prog:0, done:false },
      { id:'g2', label:`เก็บถูกหมู่ให้ครบ ${uniqTarget} หมู่ ✅`, target: uniqTarget, prog:0, done:false },
    ];
  }

  function makeMinis(diff){
    const { isEasy, isHard } = diffFlags(diff);

    return [
      // 1) เก็บหมู่ปัจจุบัน
      { id:'m1', label:`เก็บหมู่ปัจจุบัน ${isHard?6:(isEasy?4:5)} ชิ้น`, target:(isHard?6:(isEasy?4:5)), prog:0, done:false, kind:'group_hits' },

      // 2) ไม่โดนขยะ X วินาที
      { id:'m2', label:`ห้ามโดนขยะ ${isHard?12:(isEasy?9:10)} วิ`, target:(isHard?12:(isEasy?9:10)), prog:0, done:false, kind:'safe_seconds' },

      // 3) streak good
      { id:'m3', label:`เก็บดีติดกัน ${isHard?8:(isEasy?5:6)} ครั้ง`, target:(isHard?8:(isEasy?5:6)), prog:0, done:false, kind:'streak_good' },

      // 4) mix 2 groups
      { id:'m4', label:`เก็บครบ 2 หมู่ (อย่างละ 3) 🌀`, target: 6, prog:0, done:false, kind:'two_groups_mix' },

      // 5) แตะคอมโบถึง
      { id:'m5', label:`คอมโบแตะ ${isHard?12:(isEasy?8:10)}`, target:(isHard?12:(isEasy?8:10)), prog:0, done:false, kind:'combo_reach' },

      // 6) rush window
      { id:'m6', label:`เก็บหมู่ปัจจุบัน 3 ชิ้นใน 8 วิ ⏱️`, target: 3, prog:0, done:false, kind:'rush_window', windowSec: 8, tLeft: 8, active:true },

      // 7) ปิดเกมเท่ ๆ
      { id:'m7', label:`ปิดเกมแบบหล่อ ๆ: เก็บดีอีก 10 ชิ้น ✨`, target: 10, prog:0, done:false, kind:'good_total' }
    ];
  }

  function createFoodGroupsQuest(diff){
    const goals = makeGoals(diff);
    const minis = makeMinis(diff);

    // group rotation
    let groupIndex = 0;

    // global trackers
    let sec = 0;
    let uniqGroups = new Set();
    let streakGood = 0;
    let safeSec = 0;

    // mini tracking
    let miniIdx = 0;

    // for two_groups_mix
    let mix = { a:0, b:0, aKey:FOOD_GROUPS[0].key, bKey:FOOD_GROUPS[1].key };

    // rush window state (per active mini)
    let lastRushTickAt = 0;

    function activeMini(){
      // find next not-done starting from miniIdx
      for (let i = miniIdx; i < minis.length; i++){
        if (minis[i] && !minis[i].done) { miniIdx = i; return minis[i]; }
      }
      return null;
    }

    function initMiniState(m){
      if (!m) return;

      if (m.kind === 'rush_window'){
        m.windowSec = Number(m.windowSec || 8) || 8;
        m.tLeft = m.windowSec;
        m.prog = 0;
        m.active = true;
        lastRushTickAt = sec;
      }

      if (m.kind === 'group_hits'){
        m.prog = 0;
      }

      if (m.kind === 'safe_seconds'){
        m.prog = 0;
        safeSec = 0;
      }

      if (m.kind === 'two_groups_mix'){
        // pick current and next group (rotates with groupIndex)
        const aG = FOOD_GROUPS[groupIndex] || FOOD_GROUPS[0];
        const bG = FOOD_GROUPS[(groupIndex + 1) % FOOD_GROUPS.length] || FOOD_GROUPS[1];
        mix = { a:0, b:0, aKey: aG.key, bKey: bG.key };
        m.prog = 0;
      }

      if (m.kind === 'streak_good'){
        m.prog = 0;
      }

      if (m.kind === 'combo_reach'){
        m.prog = 0;
      }

      if (m.kind === 'good_total'){
        // keep as is (accumulates)
        m.prog = m.prog || 0;
      }
    }

    function nextMini(){
      const cur = activeMini();
      if (cur) cur.done = true;

      miniIdx = clamp(miniIdx + 1, 0, minis.length);
      const nxt = activeMini();
      initMiniState(nxt);
    }

    function getActiveGroup(){
      return FOOD_GROUPS[groupIndex] || FOOD_GROUPS[0];
    }

    function rotateGroup(){
      groupIndex = (groupIndex + 1) % FOOD_GROUPS.length;

      // when rotate, some mini kinds should reset fairly
      const m = activeMini();
      if (!m) return;

      if (m.kind === 'group_hits'){
        m.prog = 0;
      }
      if (m.kind === 'rush_window'){
        // keep the rush window running but reset progress to be fair
        m.prog = 0;
        m.tLeft = m.windowSec || 8;
        m.active = true;
        lastRushTickAt = sec;
      }
      if (m.kind === 'two_groups_mix'){
        initMiniState(m);
      }
    }

    function updateGoals(groupKey, combo){
      // Goal1: combo max reach
      const g1 = goals[0];
      if (g1 && !g1.done){
        g1.prog = Math.max(g1.prog|0, combo|0);
        if (g1.prog >= g1.target) g1.done = true;
      }

      // Goal2: unique groups
      const g2 = goals[1];
      if (g2 && !g2.done){
        g2.prog = uniqGroups.size;
        if (g2.prog >= g2.target) g2.done = true;
      }
    }

    function onGoodHit(groupKey, combo){
      const gk = Number(groupKey) || 1;

      // trackers
      streakGood += 1;
      uniqGroups.add(gk);

      updateGoals(gk, combo);

      const m = activeMini();
      if (!m) return;

      if (m.kind === 'group_hits'){
        const g = getActiveGroup();
        if (g && g.key === gk){
          m.prog += 1;
          if (m.prog >= m.target) nextMini();
        }

      } else if (m.kind === 'safe_seconds'){
        // nothing (tick in second)
        m.prog = clamp(safeSec, 0, m.target);

      } else if (m.kind === 'streak_good'){
        m.prog = Math.max(m.prog|0, streakGood|0);
        if (m.prog >= m.target) nextMini();

      } else if (m.kind === 'two_groups_mix'){
        if (gk === mix.aKey) mix.a++;
        if (gk === mix.bKey) mix.b++;
        m.prog = clamp(mix.a + mix.b, 0, m.target);

        if (mix.a >= 3 && mix.b >= 3) nextMini();

      } else if (m.kind === 'combo_reach'){
        m.prog = Math.max(m.prog|0, combo|0);
        if (m.prog >= m.target) nextMini();

      } else if (m.kind === 'rush_window'){
        if (!m.active) return;
        const g = getActiveGroup();
        if (g && g.key === gk){
          m.prog += 1;
          if (m.prog >= m.target){
            m.active = false;
            nextMini();
          }
        }

      } else if (m.kind === 'good_total'){
        m.prog += 1;
        if (m.prog >= m.target) nextMini();
      }
    }

    function onJunkHit(){
      // reset trackers on junk
      streakGood = 0;
      safeSec = 0;

      const m = activeMini();
      if (!m) return;

      if (m.kind === 'safe_seconds'){
        m.prog = 0;
      }

      if (m.kind === 'streak_good'){
        m.prog = 0;
      }

      if (m.kind === 'rush_window'){
        // punish fairly: reset timer & progress
        m.prog = 0;
        m.tLeft = m.windowSec || 8;
        m.active = true;
        lastRushTickAt = sec;
      }
    }

    function second(){
      sec += 1;

      // rotate every 12 sec
      if (sec % 12 === 0){
        rotateGroup();
      }

      const m = activeMini();
      if (!m) return;

      // safe_seconds mini
      if (m.kind === 'safe_seconds'){
        safeSec += 1;
        m.prog = clamp(safeSec, 0, m.target);
        if (m.prog >= m.target) nextMini();
      }

      // rush_window mini: countdown
      if (m.kind === 'rush_window' && m.active){
        // keep stable tick even if second() called multiple times accidentally
        if (sec === lastRushTickAt) return;
        lastRushTickAt = sec;

        m.tLeft = (Number(m.tLeft)||0) - 1;
        if (m.tLeft <= 0){
          // window expired -> reset window/prog (still active)
          m.tLeft = m.windowSec || 8;
          m.prog = 0;
        }
      }
    }

    // init first mini state
    initMiniState(activeMini());

    return {
      goals,
      minis,
      getActiveGroup,
      onGoodHit,
      onJunkHit,
      second
    };
  }

  window.GroupsQuest = window.GroupsQuest || {};
  window.GroupsQuest.createFoodGroupsQuest = createFoodGroupsQuest;

})();