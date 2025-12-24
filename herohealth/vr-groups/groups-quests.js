// === /herohealth/vr-groups/groups-quests.js ===
// Food Groups Quest Manager (IIFE) — Goals(2) + Minis(7) + Smart Rotate Groups (PLAY)
// Exposes: window.GroupsQuest.createFoodGroupsQuest(diff, opts?)
// ✅ FIX-ALL: stable HUD payload, shield-aware safe-seconds, real rush-window timer,
//            smart rotate (play only), no crashes if engine passes params.

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
  function lc(x){ return String(x||'').toLowerCase(); }

  // -------- goals/minis --------
  function makeGoals(diff){
    const d = lc(diff||'normal');
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
    const d = lc(diff||'normal');
    const isEasy = d==='easy';
    const isHard = d==='hard';

    return [
      { id:'m1', label:`เก็บหมู่ปัจจุบัน ${isHard?6:(isEasy?4:5)} ชิ้น`, target: (isHard?6:(isEasy?4:5)), prog:0, done:false, kind:'group_hits' },

      // shield-aware safe seconds (do not reset if junk was blocked)
      { id:'m2', label:`ห้ามโดนขยะ ${isHard?12:(isEasy?9:10)} วิ`, target: (isHard?12:(isEasy?9:10)), prog:0, done:false, kind:'safe_seconds' },

      { id:'m3', label:`เก็บดีติดกัน ${isHard?8:(isEasy?5:6)} ครั้ง`, target: (isHard?8:(isEasy?5:6)), prog:0, done:false, kind:'streak_good' },

      // two groups mix (A,B depend on current rotation)
      { id:'m4', label:`เก็บครบ 2 หมู่ (อย่างละ 3) 🌀`, target: 6, prog:0, done:false, kind:'two_groups_mix' },

      { id:'m5', label:`คอมโบแตะ ${isHard?12:(isEasy?8:10)}`, target: (isHard?12:(isEasy?8:10)), prog:0, done:false, kind:'combo_reach' },

      // rush window (real countdown; resets properly)
      { id:'m6', label:`เก็บหมู่ปัจจุบัน 3 ชิ้นใน 8 วิ ⏱️`, target: 3, prog:0, done:false, kind:'rush_window', windowSec: 8, tLeft: 8, active:true },

      { id:'m7', label:`ปิดเกมแบบหล่อ ๆ: เก็บดีอีก 10 ชิ้น ✨`, target: 10, prog:0, done:false, kind:'good_total' },
    ];
  }

  // ===== create =====
  function createFoodGroupsQuest(diff, opts){
    opts = opts || {};
    const runMode = lc(opts.runMode || 'play'); // 'play'|'research' (engine may pass)
    const goals = makeGoals(diff);
    const minis = makeMinis(diff);

    // rotation
    let groupIndex = 0;
    let sec = 0;

    // trackers
    let uniqGroups = new Set();
    let streakGood = 0;
    let safeSec = 0;
    let bestComboSeen = 0;

    // mini progression pointer
    let miniIdx = 0;

    // two_groups_mix tracker
    let mixCounts = { a:0, b:0, aKey:1, bKey:2 };

    // rush-window tracker
    let rushStartAtSec = 0;

    function activeMini(){ return minis[miniIdx] || null; }

    function resetMiniStateIfNeeded(m){
      if (!m) return;

      if (m.kind === 'rush_window'){
        m.windowSec = Number(m.windowSec)||8;
        m.tLeft = m.windowSec;
        m.prog = 0;
        m.active = true;
        rushStartAtSec = sec;
      }

      if (m.kind === 'two_groups_mix'){
        const aK = (FOOD_GROUPS[groupIndex]||FOOD_GROUPS[0]).key;
        const bK = (FOOD_GROUPS[(groupIndex+1)%FOOD_GROUPS.length]||FOOD_GROUPS[1]).key;
        mixCounts = { a:0, b:0, aKey:aK, bKey:bK };
        m.prog = 0;
      }

      if (m.kind === 'group_hits'){
        m.prog = 0;
      }

      if (m.kind === 'safe_seconds'){
        // keep safeSec as is; but update prog for HUD
        m.prog = clamp(safeSec, 0, m.target);
      }
    }

    function nextMini(){
      const m = activeMini();
      if (m && m.done) miniIdx = clamp(miniIdx + 1, 0, minis.length);
      resetMiniStateIfNeeded(activeMini());
    }

    function getActiveGroup(){
      return FOOD_GROUPS[groupIndex] || FOOD_GROUPS[0];
    }

    function rotateGroup(force){
      // research mode = stable (optional). In research we still rotate every 12 sec, but no "smart" changes.
      groupIndex = (groupIndex + 1) % FOOD_GROUPS.length;

      // reset some minis when group changes
      const m = activeMini();
      if (m && m.kind === 'group_hits') m.prog = 0;

      // refresh two-groups pairing after rotate
      if (m && m.kind === 'two_groups_mix'){
        resetMiniStateIfNeeded(m);
      }

      // refresh rush group context (still same window but now new group)
      if (m && m.kind === 'rush_window'){
        // restart the window on rotation to keep it fair + exciting
        resetMiniStateIfNeeded(m);
      }

      // optional hook for HUD/coach (engine may listen)
      try{
        window.dispatchEvent(new CustomEvent('groups:groupRotate', { detail:{ group: getActiveGroup(), forced: !!force } }));
      }catch{}
    }

    // smart rotate: if player is too strong, rotate faster to keep pressure; if struggling, give more time
    function effectiveRotateEvery(){
      const base = 12; // seconds
      if (runMode !== 'play') return base;

      // bestComboSeen: if high -> faster
      if (bestComboSeen >= 14) return 9;
      if (bestComboSeen >= 10) return 10;

      // streak low + many misses (unknown here) -> keep base or slower
      if (streakGood <= 1 && bestComboSeen <= 4) return 13;
      return base;
    }

    // ===== hooks called by engine =====
    function onGoodHit(groupKey, combo){
      const gk = Number(groupKey)||1;
      const cb = Number(combo)||0;

      bestComboSeen = Math.max(bestComboSeen, cb);
      streakGood += 1;
      uniqGroups.add(gk);

      // ----- Goals -----
      const g1 = goals[0];
      if (g1 && !g1.done){
        g1.prog = Math.max(g1.prog|0, cb|0);
        if (g1.prog >= g1.target) g1.done = true;
      }

      const g2 = goals[1];
      if (g2 && !g2.done){
        g2.prog = uniqGroups.size;
        if (g2.prog >= g2.target) g2.done = true;
      }

      // ----- Minis -----
      const m = activeMini();
      if (!m) return;

      if (m.kind === 'group_hits'){
        const g = getActiveGroup();
        if (g && g.key === gk){
          m.prog += 1;
          if (m.prog >= m.target){ m.done = true; nextMini(); }
        }
      }
      else if (m.kind === 'streak_good'){
        m.prog = Math.max(m.prog|0, streakGood|0);
        if (m.prog >= m.target){ m.done = true; nextMini(); }
      }
      else if (m.kind === 'combo_reach'){
        m.prog = Math.max(m.prog|0, cb|0);
        if (m.prog >= m.target){ m.done = true; nextMini(); }
      }
      else if (m.kind === 'two_groups_mix'){
        if (gk === mixCounts.aKey) mixCounts.a++;
        if (gk === mixCounts.bKey) mixCounts.b++;
        m.prog = clamp(mixCounts.a + mixCounts.b, 0, m.target);
        if (mixCounts.a >= 3 && mixCounts.b >= 3){
          m.done = true; nextMini();
        }
      }
      else if (m.kind === 'rush_window'){
        if (!m.active) return;
        const g = getActiveGroup();
        if (g && g.key === gk){
          m.prog += 1;
          if (m.prog >= m.target){
            m.done = true;
            m.active = false;
            nextMini();
          }
        }
      }
      else if (m.kind === 'good_total'){
        m.prog += 1;
        if (m.prog >= m.target){ m.done = true; nextMini(); }
      }
    }

    // Engine may call onJunkHit(gid) but gid may be undefined.
    // opts: { blocked:true } for shield-block events (if you decide to pass later)
    function onJunkHit(_groupKey, meta){
      const blocked = !!(meta && meta.blocked);

      // streak always breaks if junk really hits; if blocked by shield, keep streak? -> keep fun: streak continues
      if (!blocked) streakGood = 0;

      // safe seconds: reset only if not blocked
      if (!blocked) safeSec = 0;

      const m = activeMini();
      if (!m) return;

      if (m.kind === 'safe_seconds'){
        if (!blocked){
          m.prog = 0;
        }else{
          // keep progress; but clamp
          m.prog = clamp(safeSec, 0, m.target);
        }
      }

      if (m.kind === 'rush_window'){
        // if junk hit and not blocked → restart window
        if (!blocked){
          resetMiniStateIfNeeded(m);
        }
      }
    }

    function second(){
      sec += 1;

      // rotate group on schedule
      const rotEvery = effectiveRotateEvery();
      if (rotEvery > 0 && (sec % rotEvery === 0)){
        rotateGroup(false);
      }

      const m = activeMini();

      // safe seconds mini
      if (m && m.kind === 'safe_seconds'){
        safeSec += 1;
        m.prog = clamp(safeSec, 0, m.target);
        if (m.prog >= m.target){
          m.done = true;
          nextMini();
        }
      }

      // rush window countdown (real)
      if (m && m.kind === 'rush_window' && m.active){
        const w = Number(m.windowSec)||8;
        const elapsed = sec - (rushStartAtSec||0);
        const left = Math.max(0, w - elapsed);
        m.tLeft = left;

        if (left <= 0){
          // reset window, keep it “pressure but fair”
          rushStartAtSec = sec;
          m.tLeft = w;
          m.prog = 0;
        }
      }

      // keep HUD values tidy for other minis too
      if (m && (m.kind === 'group_hits' || m.kind === 'two_groups_mix' || m.kind === 'combo_reach' || m.kind === 'streak_good' || m.kind === 'good_total')){
        m.prog = clamp(m.prog, 0, m.target);
      }
    }

    // --- helper for HUD/debug (optional) ---
    function toHud(){
      const g = getActiveGroup();
      const goal = (goals.find(x=>x && !x.done) || null);
      const mini = (minis.find(x=>x && !x.done) || null);
      return {
        goalsAll: goals,
        minisAll: minis,
        goal: goal ? { label: goal.label, prog: goal.prog, target: goal.target } : null,
        mini: mini ? { label: mini.label, prog: mini.prog, target: mini.target, tLeft: mini.tLeft, windowSec: mini.windowSec } : null,
        groupLabel: g ? g.label : '',
        groupKey: g ? (g.key||0) : 0
      };
    }

    // init special states for first active mini
    resetMiniStateIfNeeded(activeMini());

    return {
      goals,
      minis,
      getActiveGroup,
      rotateGroup,      // engine may call later if needed
      onGoodHit,
      onJunkHit,
      second,
      toHud
    };
  }

  window.GroupsQuest = window.GroupsQuest || {};
  window.GroupsQuest.createFoodGroupsQuest = createFoodGroupsQuest;

})();