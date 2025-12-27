// === /herohealth/hydration-vr/hydration.quest.js ===
// Hydration Quest — Goals sequential + Minis chain (PRODUCTION) — PATCHED
// Emits:
// - onUpdate(payload)  -> now includes BOTH (old fields) + (quest:update friendly fields)
// - onCelebrate(kind:'goal'|'mini', payload)
//
// ✅ Add: tick(nowSec?) for timer minis (call each second from engine)
// ✅ Make timer minis deterministic even if Date.now jitter
// ✅ Provide quest:update fields: title, line1..line4, goalText, goalProgress, miniText, stateText

'use strict';

export function createHydrationQuest(opts = {}){
  const onUpdate = typeof opts.onUpdate === 'function' ? opts.onUpdate : ()=>{};
  const onCelebrate = typeof opts.onCelebrate === 'function' ? opts.onCelebrate : ()=>{};

  // optional: allow external clock (sec) for deterministic research mode
  const useExternalClock = !!opts.useExternalClock;

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

    curGoalCount: 0,
    curMiniCount: 0,

    combo: 0,
    noJunkUntil: 0,
    rushUntil: 0,
    rushStart: 0,
    streakPerfect: 0,

    // tick clock
    lastTickSec: 0,
    startedAtSec: 0,
  };

  function activeGoal(){ return Q.goalsAll[Q.goalIndex] || null; }
  function activeMini(){ return Q.minisAll[Q.miniIndex] || null; }

  function buildCompatPayload(){
    const g = activeGoal();
    const m = activeMini();

    const goalTitle = g ? g.title : 'ALL CLEAR';
    const miniTitle = m ? m.title : '—';

    const goalProg = g ? `${Q.curGoalCount}/${g.need}` : `—`;
    const miniProg = m ? `${Q.curMiniCount}/${m.need}` : `—`;

    // quest:update friendly (line1..line4)
    const title = `Hydration Quest`;
    const line1 = g ? `Goal: ${g.title}` : `Goal: ALL CLEAR ✅`;
    const line2 = g ? `Progress: ${goalProg}` : `Progress: —`;
    const line3 = m ? `Mini: ${m.title}` : `Mini: —`;
    const line4 = m ? `State: ${miniProg}` : `State: —`;

    return {
      // original fields
      goalTitle,
      miniTitle,
      goalsCleared: Q.goalsCleared,
      goalsTotal: Q.goalsAll.length,
      minisCleared: Q.minisCleared,
      miniTotal: Q.minisAll.length,
      goalProg,
      miniProg,

      // compatibility fields for your HUD binder / cache system
      title,
      line1,
      line2,
      line3,
      line4,

      goalText: line1,
      goalProgress: goalProg,
      miniText: line3,
      stateText: line4,
    };
  }

  function emit(){
    onUpdate(buildCompatPayload());
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

    // reset mini state
    Q.rushUntil = 0;
    Q.noJunkUntil = 0;
    Q.streakPerfect = 0;

    onCelebrate('mini', { title: m.title });
    emit();
  }

  // ✅ tick with stable clock
  function tick(nowSec){
    const m = activeMini();
    if (!m) return;

    const t = (useExternalClock && Number.isFinite(nowSec))
      ? Number(nowSec)
      : (Date.now()/1000);

    if (!Q.startedAtSec) Q.startedAtSec = t;
    if (!Q.lastTickSec) Q.lastTickSec = t;

    // guard
    if (t < Q.lastTickSec) Q.lastTickSec = t;
    Q.lastTickSec = t;

    if (m.kind === 'timerNoJunk'){
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
    // ev: {kind:'good'|'junk'|'power', perfect:boolean}
    const g = activeGoal();
    const m = activeMini();
    const now = Date.now()/1000;

    // ----- goals -----
    if (g){
      if (g.kind === 'good' && ev.kind === 'good'){
        Q.curGoalCount++;
        if (Q.curGoalCount >= g.need) clearGoal(); else emit();
      }
      if (g.kind === 'perfect' && ev.perfect){
        Q.curGoalCount++;
        if (Q.curGoalCount >= g.need) clearGoal(); else emit();
      }
      // combo handled via setCombo
    }

    // ----- minis -----
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

      if (m.kind === 'streakPerfect'){
        if (ev.perfect){
          Q.streakPerfect++;
          Q.curMiniCount = Q.streakPerfect;
          if (Q.curMiniCount >= m.need) clearMini(); else emit();
        } else if (ev.kind === 'good'){
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
      // shieldBlock handled via onSpecial
      // combo handled via setCombo
    }

    // keep timers updated
    tick();
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

    tick,
    onHit,
    onSpecial,
    setCombo,
  };
}
