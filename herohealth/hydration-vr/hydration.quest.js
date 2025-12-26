// === /herohealth/hydration-vr/hydration.quest.js ===
// Hydration Quest — Goals sequential + Minis chain (PRODUCTION)
// Emits:
// - onUpdate({goalTitle, miniTitle, goalsCleared, goalsTotal, miniCleared, miniTotal, goalProg, miniProg})
// - onCelebrate(kind:'goal'|'mini', payload)

'use strict';

export function createHydrationQuest(opts = {}){
  const onUpdate = typeof opts.onUpdate === 'function' ? opts.onUpdate : ()=>{};
  const onCelebrate = typeof opts.onCelebrate === 'function' ? opts.onCelebrate : ()=>{};

  const goals = [
    { title:'เก็บน้ำดี 12 ครั้ง', need:12, kind:'good' },
    { title:'Perfect 6 ครั้ง', need:6, kind:'perfect' },
    { title:'คอมโบถึง 15', need:15, kind:'combo' }
  ];

  const minis = [
    { title:'No-Junk Zone (8 วิ ห้ามโดนขยะ)', need:8, kind:'timerNoJunk' },
    { title:'Water Rush (เก็บน้ำดี 6 ภายใน 9 วิ)', need:6, kind:'rushGood', window:9 },
    { title:'Shield Save (บล็อกเลเซอร์/ขยะ 1 ครั้ง)', need:1, kind:'shieldBlock' },
    { title:'Streak Perfect (Perfect ติดกัน 4)', need:4, kind:'streakPerfect' },
    { title:'Endurance (คอมโบ 20 ก่อนหมดเวลา)', need:20, kind:'combo' }
  ];

  const Q = {
    goalsAll: goals,
    minisAll: minis,
    goalIndex: 0,
    miniIndex: 0,

    goalsCleared: 0,
    minisCleared: 0,

    // runtime counters
    curGoalCount: 0,
    curMiniCount: 0,

    // state
    combo: 0,
    noJunkUntil: 0,
    rushUntil: 0,
    rushStart: 0,
    streakPerfect: 0
  };

  function activeGoal(){
    return Q.goalsAll[Q.goalIndex] || null;
  }
  function activeMini(){
    return Q.minisAll[Q.miniIndex] || null;
  }

  function emit(){
    const g = activeGoal();
    const m = activeMini();
    onUpdate({
      goalTitle: g ? g.title : 'ALL CLEAR',
      miniTitle: m ? m.title : '—',
      goalsCleared: Q.goalsCleared,
      goalsTotal: Q.goalsAll.length,
      minisCleared: Q.minisCleared,
      miniTotal: Q.minisAll.length,
      goalProg: g ? `${Q.curGoalCount}/${g.need}` : `—`,
      miniProg: m ? `${Q.curMiniCount}/${m.need}` : `—`,
    });
  }

  function clearGoal(){
    const g = activeGoal();
    if (!g) return;
    Q.goalsCleared++;
    Q.goalIndex++;
    Q.curGoalCount = 0;
    onCelebrate('goal', { title: g.title });
    emit();
  }

  function clearMini(){
    const m = activeMini();
    if (!m) return;
    Q.minisCleared++;
    Q.miniIndex++;
    Q.curMiniCount = 0;

    // reset some mini state
    Q.rushUntil = 0;
    Q.noJunkUntil = 0;
    Q.streakPerfect = 0;

    onCelebrate('mini', { title: m.title });
    emit();
  }

  function tickTimers(){
    const t = Date.now()/1000;
    const m = activeMini();
    if (!m) return;

    if (m.kind === 'timerNoJunk'){
      // progress only while timer active
      if (Q.noJunkUntil > 0){
        const left = Math.max(0, Q.noJunkUntil - t);
        Q.curMiniCount = Math.round((m.need - left));
        if (left <= 0){
          Q.curMiniCount = m.need;
          clearMini();
        } else emit();
      }
    }

    if (m.kind === 'rushGood'){
      if (Q.rushUntil > 0 && t > Q.rushUntil){
        // failed rush → restart
        Q.rushUntil = 0;
        Q.curMiniCount = 0;
        emit();
      }
    }
  }

  function onHit(ev){
    // ev: {kind:'good'|'junk'|'power', good:boolean, perfect:boolean}
    const g = activeGoal();
    const m = activeMini();
    const now = Date.now()/1000;

    // goal update
    if (g){
      if (g.kind === 'good' && ev.kind === 'good'){
        Q.curGoalCount++;
        if (Q.curGoalCount >= g.need) clearGoal(); else emit();
      }
      if (g.kind === 'perfect' && ev.perfect){
        Q.curGoalCount++;
        if (Q.curGoalCount >= g.need) clearGoal(); else emit();
      }
      if (g.kind === 'combo'){
        // combo handled externally via setCombo
      }
    }

    // mini update
    if (m){
      if (m.kind === 'timerNoJunk'){
        // start timer when first good hit
        if (Q.noJunkUntil <= 0 && ev.kind === 'good'){
          Q.noJunkUntil = now + m.need;
          Q.curMiniCount = 0;
          emit();
        }
        // if junk happens -> fail
        if (ev.kind === 'junk'){
          Q.noJunkUntil = 0;
          Q.curMiniCount = 0;
          emit();
        }
      }

      if (m.kind === 'rushGood'){
        if (ev.kind === 'good'){
          if (Q.rushUntil <= 0){
            Q.rushStart = now;
            Q.rushUntil = now + (m.window || 9);
            Q.curMiniCount = 0;
          }
          Q.curMiniCount++;
          if (Q.curMiniCount >= m.need){
            clearMini();
          } else emit();
        }
        if (ev.kind === 'junk'){
          Q.rushUntil = 0;
          Q.curMiniCount = 0;
          emit();
        }
      }

      if (m.kind === 'shieldBlock'){
        // will be triggered via onSpecial('shieldBlock')
      }

      if (m.kind === 'streakPerfect'){
        if (ev.perfect){
          Q.streakPerfect++;
          Q.curMiniCount = Q.streakPerfect;
          if (Q.curMiniCount >= m.need) clearMini(); else emit();
        } else if (ev.kind === 'good'){
          // good but not perfect breaks streak
          Q.streakPerfect = 0;
          Q.curMiniCount = 0;
          emit();
        }
        if (ev.kind === 'junk'){
          Q.streakPerfect = 0;
          Q.curMiniCount = 0;
          emit();
        }
      }

      if (m.kind === 'combo'){
        // combo handled via setCombo
      }
    }

    tickTimers();
  }

  function onSpecial(name){
    const m = activeMini();
    if (!m) return;

    if (m.kind === 'shieldBlock' && name === 'shieldBlock'){
      Q.curMiniCount = 1;
      clearMini();
      return;
    }
  }

  function setCombo(combo){
    Q.combo = Math.max(0, combo|0);

    // goal combo
    const g = activeGoal();
    if (g && g.kind === 'combo'){
      Q.curGoalCount = Math.max(Q.curGoalCount, Q.combo);
      if (Q.curGoalCount >= g.need) clearGoal(); else emit();
    }

    // mini combo
    const m = activeMini();
    if (m && m.kind === 'combo'){
      Q.curMiniCount = Math.max(Q.curMiniCount, Q.combo);
      if (Q.curMiniCount >= m.need) clearMini(); else emit();
    }
  }

  // initial emit
  emit();

  return {
    get goalsCleared(){ return Q.goalsCleared; },
    get goalsTotal(){ return Q.goalsAll.length; },
    get minisCleared(){ return Q.minisCleared; },
    get miniTotal(){ return Q.minisAll.length; },

    onHit,
    onSpecial,
    setCombo
  };
}