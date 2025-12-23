// === /herohealth/vr-groups/groups-quests.js ===
// Food Groups Quest Manager (IIFE) — Goals(2) + Minis(7) + Auto Rotate Groups (FUN+CHALLENGE)
// Exposes: window.GroupsQuest.createFoodGroupsQuest(diff)

(function(){
  'use strict';

  const FOOD_GROUPS = [
    { key:1, label:'หมู่ 1 โปรตีน 💪', emojis:['🍗','🥩','🐟','🍳','🥛','🧀','🥜'] },
    { key:2, label:'หมู่ 2 คาร์บ/พลังงาน ⚡', emojis:['🍚','🍞','🥔','🌽','🥨'] },
    { key:3, label:'หมู่ 3 ผัก 🥦', emojis:['🥦','🥕','🥬','🥒','🌶️'] },
    { key:4, label:'หมู่ 4 ผลไม้ 🍎', emojis:['🍎','🍌','🍊','🍉','🍍'] },
    { key:5, label:'หมู่ 5 ไขมัน 🥑', emojis:['🥑','🧈','🫒','🍫','🧀'] }
  ];

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function makeGoals(diff){
    const d = String(diff||'normal').toLowerCase();
    const isEasy = d==='easy';
    const isHard = d==='hard';
    const comboTarget = isEasy ? 10 : (isHard ? 16 : 12);
    const uniqTarget  = isEasy ? 4  : (isHard ? 5  : 4);

    return [
      { id:'g1', label:`ทำคอมโบให้ถึง ${comboTarget} 🔥`, target: comboTarget, prog:0, done:false },
      { id:'g2', label:`เก็บถูกหมู่ให้ครบ ${uniqTarget} หมู่ ✅`, target: uniqTarget, prog:0, done:false },
    ];
  }

  function makeMinis(diff){
    const d = String(diff||'normal').toLowerCase();
    const isEasy = d==='easy';
    const isHard = d==='hard';

    return [
      { id:'m1', label:`เก็บหมู่ปัจจุบัน ${isHard?6:(isEasy?4:5)} ชิ้น`, target: (isHard?6:(isEasy?4:5)), prog:0, done:false, kind:'group_hits' },
      { id:'m2', label:`ห้ามโดนขยะ ${isHard?12:(isEasy?9:10)} วิ`, target: (isHard?12:(isEasy?9:10)), prog:0, done:false, kind:'safe_seconds' },
      { id:'m3', label:`เก็บดีติดกัน ${isHard?8:(isEasy?5:6)} ครั้ง`, target: (isHard?8:(isEasy?5:6)), prog:0, done:false, kind:'streak_good' },
      { id:'m4', label:`เก็บครบ 2 หมู่ (อย่างละ 3) 🌀`, target: 6, prog:0, done:false, kind:'two_groups_mix' },
      { id:'m5', label:`คอมโบแตะ ${isHard?12:(isEasy?8:10)}`, target: (isHard?12:(isEasy?8:10)), prog:0, done:false, kind:'combo_reach' },
      { id:'m6', label:`เก็บหมู่ปัจจุบัน 3 ชิ้นใน 8 วิ ⏱️`, target: 3, prog:0, done:false, kind:'rush_window', windowSec: 8, tLeft: 8, active:true },
      { id:'m7', label:`ปิดเกมแบบหล่อ ๆ: เก็บดีอีก 10 ชิ้น ✨`, target: 10, prog:0, done:false, kind:'good_total' },
    ];
  }

  function createFoodGroupsQuest(diff){
    const d = String(diff||'normal').toLowerCase();
    const isEasy = d==='easy';
    const isHard = d==='hard';

    const rotateEvery = isEasy ? 12 : (isHard ? 9 : 10); // ✅ FUN: หมุนไวขึ้น
    const goals = makeGoals(d);
    const minis = makeMinis(d);

    let groupIndex = 0;
    let sec = 0;

    // trackers
    let uniqGroups = new Set();
    let streakGood = 0;
    let safeSec = 0;

    // mini trackers
    let miniIdx = 0;
    let mixCounts = { a:0, b:0, aKey:1, bKey:2 };

    function activeMini(){ return minis[miniIdx] || null; }

    function prepMini(m2){
      if (!m2) return;
      if (m2.kind === 'rush_window'){
        m2.tLeft = m2.windowSec || 8;
        m2.active = true;
        m2.prog = 0;
      }
      if (m2.kind === 'two_groups_mix'){
        mixCounts = { a:0, b:0, aKey: FOOD_GROUPS[groupIndex].key, bKey: FOOD_GROUPS[(groupIndex+1)%FOOD_GROUPS.length].key };
        m2.prog = 0;
      }
      if (m2.kind === 'safe_seconds'){
        safeSec = 0;
        m2.prog = 0;
      }
      if (m2.kind === 'group_hits'){
        m2.prog = 0;
      }
    }

    function nextMini(){
      const cur = activeMini();
      if (!cur || cur.done) miniIdx = clamp(miniIdx+1, 0, minis.length);
      prepMini(activeMini());
    }

    function getActiveGroup(){
      return FOOD_GROUPS[groupIndex] || FOOD_GROUPS[0];
    }

    function rotateGroup(){
      groupIndex = (groupIndex + 1) % FOOD_GROUPS.length;
      // ให้ mini ที่เกี่ยวกับ “หมู่ปัจจุบัน” รีเซ็ตแบบแฟร์
      const m = activeMini();
      if (m && (m.kind === 'group_hits' || m.kind === 'rush_window')){
        prepMini(m);
      }
      if (m && m.kind === 'two_groups_mix'){
        prepMini(m);
      }
    }

    function onGoodHit(groupKey, combo){
      streakGood += 1;
      uniqGroups.add(Number(groupKey)||1);

      // Goal1 combo reach
      const g1 = goals[0];
      if (g1 && !g1.done){
        g1.prog = Math.max(g1.prog|0, combo|0);
        if (g1.prog >= g1.target) g1.done = true;
      }

      // Goal2 unique groups
      const g2 = goals[1];
      if (g2 && !g2.done){
        g2.prog = uniqGroups.size;
        if (g2.prog >= g2.target) g2.done = true;
      }

      const m = activeMini();
      if (!m) return;

      if (m.kind === 'group_hits'){
        const g = getActiveGroup();
        if ((Number(groupKey)||0) === (g.key||0)){
          m.prog += 1;
          if (m.prog >= m.target){ m.done = true; nextMini(); }
        }
      } else if (m.kind === 'streak_good'){
        m.prog = Math.max(m.prog|0, streakGood|0);
        if (m.prog >= m.target){ m.done = true; nextMini(); }
      } else if (m.kind === 'combo_reach'){
        m.prog = Math.max(m.prog|0, combo|0);
        if (m.prog >= m.target){ m.done = true; nextMini(); }
      } else if (m.kind === 'two_groups_mix'){
        if ((Number(groupKey)||0) === mixCounts.aKey) mixCounts.a++;
        if ((Number(groupKey)||0) === mixCounts.bKey) mixCounts.b++;
        m.prog = clamp(mixCounts.a + mixCounts.b, 0, m.target);
        if (mixCounts.a >= 3 && mixCounts.b >= 3){ m.done = true; nextMini(); }
      } else if (m.kind === 'rush_window'){
        if (!m.active) return;
        const g = getActiveGroup();
        if ((Number(groupKey)||0) === (g.key||0)){
          m.prog += 1;
          if (m.prog >= m.target){
            m.done = true;
            m.active = false;
            nextMini();
          }
        }
      } else if (m.kind === 'good_total'){
        m.prog += 1;
        if (m.prog >= m.target){ m.done = true; nextMini(); }
      }
    }

    function onJunkHit(){
      streakGood = 0;
      safeSec = 0;

      const m = activeMini();
      if (m && m.kind === 'safe_seconds') m.prog = 0;

      if (m && m.kind === 'rush_window'){
        m.tLeft = m.windowSec || 8;
        m.prog = 0;
        m.active = true;
      }
    }

    function second(){
      sec += 1;

      // ✅ หมุนหมู่ไวขึ้นตามระดับ
      if (sec % rotateEvery === 0){
        rotateGroup();
      }

      const m = activeMini();

      if (m && m.kind === 'safe_seconds'){
        safeSec += 1;
        m.prog = clamp(safeSec, 0, m.target);
        if (m.prog >= m.target){ m.done = true; nextMini(); }
      }

      if (m && m.kind === 'rush_window' && m.active){
        m.tLeft -= 1;
        if (m.tLeft <= 0){
          m.tLeft = m.windowSec || 8;
          m.prog = 0;
        }
      }
    }

    // init mini state
    prepMini(activeMini());

    return { goals, minis, getActiveGroup, onGoodHit, onJunkHit, second };
  }

  window.GroupsQuest = window.GroupsQuest || {};
  window.GroupsQuest.createFoodGroupsQuest = createFoodGroupsQuest;

})();