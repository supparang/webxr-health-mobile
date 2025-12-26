// === /herohealth/hydration-vr/hydration.quest.js ===
// Hydration Quest Director (Goals sequential + Minis chain)
// Emits quest:update (global event via binder in hydration.safe.js)

'use strict';

export function createHydrationQuest(opts = {}){
  const duration = Number(opts.duration || 60) || 60;
  const onCoach = (typeof opts.onCoach === 'function') ? opts.onCoach : ()=>{};
  const onCelebrate = (typeof opts.onCelebrate === 'function') ? opts.onCelebrate : ()=>{};

  // ---- Goal definitions (sequential) ----
  const GOALS = [
    {
      id:'g1',
      title:'สมดุลน้ำให้ได้',
      desc:'ทำให้น้ำอยู่โซน BALANCED อย่างน้อย 6 ครั้ง (นับตอน “เก็บน้ำดี” แล้วอยู่ BALANCED)',
      need: 6
    },
    {
      id:'g2',
      title:'คอมโบสายชุ่มฉ่ำ',
      desc:'ทำ COMBO ถึง 12 ขึ้นไป (ห้ามพลาดระหว่างทาง)',
      need: 12
    }
  ];

  // ---- Mini chain (ต่อเนื่อง) ----
  const MINIS = [
    {
      id:'m1',
      title:'Perfect Streak ✨',
      desc:'ทำ PERFECT 3 ครั้ง',
      need: 3
    },
    {
      id:'m2',
      title:'No Junk Zone 🚫',
      desc:'ห้ามโดนขยะ 10 วินาที',
      need: 10, // seconds
      timeBased:true
    },
    {
      id:'m3',
      title:'Diamond Rescue 💎',
      desc:'เก็บเพชร 1 ครั้ง',
      need: 1
    },
    {
      id:'m4',
      title:'Shield Master 🛡️',
      desc:'กันขยะด้วยโล่ 2 ครั้ง',
      need: 2
    }
  ];

  const state = {
    started:false,
    goalsAll: GOALS,
    minisAll: MINIS,

    goalIndex: 0,
    goalProg: 0,

    miniIndex: 0,
    miniProg: 0,

    miniTimerOn:false,
    miniSecLeft: 0,
    lastMiniTickAt: 0,

    // counters (from gameplay)
    perfectCount: 0,
    diamondCount: 0,
    shieldBlockCount: 0,

    comboMaxSeen: 0,
    balancedHits: 0,
  };

  let cb = {
    onQuestUpdate: null,
    onGoalClear: null,
    onMiniClear: null,
    onAllClear: null
  };

  function curGoal(){ return state.goalsAll[state.goalIndex] || null; }
  function curMini(){ return state.minisAll[state.miniIndex] || null; }

  function pushUpdate(extra = {}){
    const g = curGoal();
    const m = curMini();

    const payload = {
      // goal
      goalId: g ? g.id : '',
      goalTitle: g ? g.title : '',
      goalDesc: g ? g.desc : '',
      goalsCleared: state.goalIndex,
      goalsTotal: state.goalsAll.length,

      // mini
      miniId: m ? m.id : '',
      miniTitle: m ? m.title : '',
      miniDesc: m ? m.desc : '',
      minisCleared: state.miniIndex,
      miniTotal: state.minisAll.length,

      // progress
      goalProg: state.goalProg,
      goalNeed: g ? g.need : 0,
      miniProg: state.miniProg,
      miniNeed: m ? m.need : 0,
      miniSecLeft: state.miniTimerOn ? state.miniSecLeft : null,

      ...extra
    };

    if (typeof cb.onQuestUpdate === 'function') cb.onQuestUpdate(payload);
  }

  function clearGoal(){
    const g = curGoal();
    if (!g) return;

    onCelebrate('GOAL', g.title);
    onCoach(`ผ่าน GOAL: ${g.title} ✅`, 'happy');

    if (typeof cb.onGoalClear === 'function') cb.onGoalClear(g);

    state.goalIndex++;
    state.goalProg = 0;

    if (state.goalIndex >= state.goalsAll.length){
      // all goals done
      onCelebrate('ALL', 'ALL GOALS CLEAR!');
      onCoach('เคลียร์ GOAL ทั้งหมดแล้ว! 🎉', 'happy');
      if (typeof cb.onAllClear === 'function') cb.onAllClear({ kind:'goals' });
    }

    pushUpdate({ justCleared:'goal', justClearedId:g.id });
  }

  function clearMini(){
    const m = curMini();
    if (!m) return;

    onCelebrate('MINI', m.title);
    onCoach(`ผ่าน MINI: ${m.title} ⭐`, 'happy');

    if (typeof cb.onMiniClear === 'function') cb.onMiniClear(m);

    state.miniIndex++;
    state.miniProg = 0;

    // reset timer mini
    state.miniTimerOn = false;
    state.miniSecLeft = 0;
    state.lastMiniTickAt = 0;

    pushUpdate({ justCleared:'mini', justClearedId:m.id });
  }

  function startMiniTimerIfNeeded(){
    const m = curMini();
    if (!m || !m.timeBased) return;
    if (state.miniTimerOn) return;
    state.miniTimerOn = true;
    state.miniSecLeft = Number(m.need || 10) || 10;
    state.lastMiniTickAt = 0;
    onCoach(`MINI เริ่มแล้ว: ${m.title} ⏱️`, 'neutral');
  }

  function tickMiniTimer(ts){
    const m = curMini();
    if (!m || !m.timeBased) return;
    if (!state.miniTimerOn) return;

    if (!state.lastMiniTickAt) state.lastMiniTickAt = ts;
    const dt = ts - state.lastMiniTickAt;
    if (dt < 1000) return;

    const steps = Math.floor(dt/1000);
    state.miniSecLeft -= steps;
    state.lastMiniTickAt += steps*1000;

    if (state.miniSecLeft <= 0){
      // success
      state.miniTimerOn = false;
      state.miniProg = m.need;
      clearMini();
    } else {
      pushUpdate({ miniSecLeft: state.miniSecLeft });
    }
  }

  function onHit(ev){
    // ev: { kind:'good'|'fakeGood'|'junk'|'star'|'diamond'|'shield', perfect:boolean }
    const kind = String(ev.kind || '');
    const perfect = !!ev.perfect;

    // ---- Goal logic ----
    const g = curGoal();
    if (g){
      if (g.id === 'g1'){
        // this goal expects "balancedHits" to be incremented externally
        // we accept a signal via ev.zoneBalanced === true
        if (ev.zoneBalanced === true){
          state.balancedHits++;
          state.goalProg = state.balancedHits;
          if (state.goalProg >= g.need) clearGoal();
        }
      }
      if (g.id === 'g2'){
        // expects comboMaxSeen updated externally via ev.comboMax
        if (typeof ev.comboMax === 'number'){
          state.comboMaxSeen = Math.max(state.comboMaxSeen, ev.comboMax);
          state.goalProg = state.comboMaxSeen;
          if (state.goalProg >= g.need) clearGoal();
        }
      }
    }

    // ---- Mini logic ----
    const m = curMini();
    if (m){
      if (m.id === 'm1'){
        if (perfect && (kind === 'good' || kind === 'fakeGood' || kind === 'star' || kind === 'diamond')){
          state.perfectCount++;
          state.miniProg = state.perfectCount;
          if (state.miniProg >= m.need) clearMini();
        }
      } else if (m.id === 'm2'){
        // time based: starts when mini becomes active; resets if junk hit
        startMiniTimerIfNeeded();
        // no direct prog, timer ticks in update loop
      } else if (m.id === 'm3'){
        if (kind === 'diamond'){
          state.diamondCount++;
          state.miniProg = state.diamondCount;
          if (state.miniProg >= m.need) clearMini();
        }
      } else if (m.id === 'm4'){
        // handled by onBlock (shield block)
      }
    }

    pushUpdate();
  }

  function onBlock(ev){
    // shield_block
    const m = curMini();
    if (m && m.id === 'm4'){
      state.shieldBlockCount++;
      state.miniProg = state.shieldBlockCount;
      if (state.miniProg >= m.need) clearMini();
      pushUpdate();
    }
  }

  function onMiss(ev){
    // misses reset some minis/timers
    const m = curMini();
    if (m && m.id === 'm2'){
      // fail and restart timer
      state.miniTimerOn = false;
      state.miniSecLeft = 0;
      state.lastMiniTickAt = 0;
      onCoach('โดนขยะ/พลาด! MINI No Junk รีเซ็ต 😅', 'sad');
      startMiniTimerIfNeeded();
      pushUpdate();
    }
  }

  function bind(bindings = {}){
    cb = { ...cb, ...bindings };
    state.started = true;
    onCoach('เริ่มภารกิจ! รักษาน้ำให้สมดุล 💧⚖️', 'neutral');
    pushUpdate();
  }

  function update(ts){
    // tick time-based mini
    tickMiniTimer(ts || performance.now());
  }

  function getGoalsState(){
    return { cleared: state.goalIndex, total: state.goalsAll.length };
  }
  function getMiniState(){
    return { cleared: state.miniIndex, total: state.minisAll.length };
  }

  return {
    bind,
    update,
    onHit,
    onBlock,
    onMiss,
    getGoalsState,
    getMiniState
  };
}