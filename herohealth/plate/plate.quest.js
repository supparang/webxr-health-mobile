// === /herohealth/plate/plate.quest.js ===
// PlateVR Quest Director (Goals sequential + Minis chain)
// แยก logic Quest ออกจาก plate.safe.js ให้แก้ง่าย/เพิ่มง่าย
//
// Required opts (callbacks):
// - getState(): state object (S)
// - now(): ms
// - setTxt(el, text)
// - HUD: { goalLine, miniLine, miniHint }
// - logEvent(type, data)
// - fxCelebrate(kind, intensity)
// - fxJudge(label)
// - flash(kind, ms)
// - vibe(ms)
// - AudioX: { warn(), tick() }
// - dispatchEvt(name, detail)  (for quest:update optional)
// - doc (for body class urgent)
// - clamp(v,a,b)

'use strict';

import { PLATE_GOALS } from './plate.goals.js';
import { PLATE_MINIS } from './plate.minis.js';

export function createPlateQuestDirector(opts = {}){
  const getState = opts.getState || (()=>({}));
  const now = opts.now || (()=>Date.now());
  const setTxt = opts.setTxt || (()=>{});
  const HUD = opts.HUD || {};
  const logEvent = opts.logEvent || (()=>{});
  const fxCelebrate = opts.fxCelebrate || (()=>{});
  const fxJudge = opts.fxJudge || (()=>{});
  const flash = opts.flash || (()=>{});
  const vibe = opts.vibe || (()=>{});
  const AudioX = opts.AudioX || {};
  const dispatchEvt = opts.dispatchEvt || (()=>{});
  const doc = opts.doc || null;
  const clamp = opts.clamp || ((v,a,b)=>Math.max(a,Math.min(b,v)));

  const Q = {
    goals: PLATE_GOALS,
    minis: PLATE_MINIS,

    goalIndex: 0,
    activeGoal: null,

    activeMini: null,
    miniEndsAt: 0,
    miniUrgentArmed: false,
    miniTickAt: 0,
    mctx: null, // per-mini context

    // public mirror
    goalsTotal: 2,
    minisTotal: 7,
  };

  function goalProgressText(){
    const S = getState();
    const g = Q.activeGoal;
    if(!g) return '0';
    if(typeof g.progressText === 'function') return g.progressText(S);
    return '0';
  }

  function emitUpdate(){
    const S = getState();
    const g = Q.activeGoal;
    const m = Q.activeMini;

    const leftMs = Math.max(0, Q.miniEndsAt - now());
    const leftSec = leftMs / 1000;

    const goalText = g
      ? `GOAL ${Q.goalIndex+1}/${Q.goalsTotal}: ${g.title} (${goalProgressText()})`
      : `GOAL: …`;

    let prog = '';
    if(m && typeof m.progress === 'function'){
      try{ prog = m.progress(Q.mctx || {}, S) || ''; }catch(_){}
    }
    const p = prog ? ` • ${prog}` : '';
    const miniText = m
      ? `MINI: ${m.title}${p} • ${leftSec.toFixed(1)}s`
      : `MINI: …`;

    setTxt(HUD.goalLine, goalText);
    setTxt(HUD.miniLine, miniText);
    setTxt(HUD.miniHint, (m && m.hint) ? m.hint : '…');

    // optional event for HUD binder / logging
    dispatchEvt('quest:update', {
      goalIndex: Q.goalIndex,
      goalsTotal: Q.goalsTotal,
      goalKey: g ? g.key : null,
      goalTitle: g ? g.title : null,
      goalProgressText: goalProgressText(),

      miniKey: m ? m.key : null,
      miniTitle: m ? m.title : null,
      miniHint: m ? m.hint : null,
      miniLeftMs: leftMs,
      miniProgressText: prog,
      minisCleared: S.minisCleared || 0,
      minisTotal: Q.minisTotal
    });
  }

  function setGoal(i){
    Q.goalIndex = clamp(i, 0, Q.goals.length-1);
    Q.activeGoal = Q.goals[Q.goalIndex] || null;
    emitUpdate();
  }

  function checkGoalClear(){
    const S = getState();
    const g = Q.activeGoal;
    if(!g) return false;
    if(typeof g.isClear === 'function') return !!g.isClear(S);
    return false;
  }

  function onGoalCleared(){
    fxCelebrate('GOAL CLEAR!', 1.25);
    flash('gold', 140);
    vibe(60);
    logEvent('goal_clear', { goal: Q.activeGoal ? Q.activeGoal.key : null });

    if(Q.goalIndex + 1 < Q.goals.length) setGoal(Q.goalIndex + 1);
    else emitUpdate();
  }

  function startMini(){
    const S = getState();
    const idx = (S.minisCleared || 0) % Q.minis.length;
    const m = Q.minis[idx];

    Q.activeMini = m;
    Q.mctx = {};
    Q.miniEndsAt = now() + (m.dur || 8000);
    Q.miniUrgentArmed = false;
    Q.miniTickAt = 0;

    try{
      if(typeof m.init === 'function') m.init(Q.mctx, S);
    }catch(_){}

    logEvent('mini_start', { mini: m.key, dur: m.dur });
    emitUpdate();
  }

  function setUrgent(on){
    if(!doc || !doc.body) return;
    if(on) doc.body.classList.add('hha-mini-urgent');
    else doc.body.classList.remove('hha-mini-urgent');
  }

  function tick(){
    const S = getState();
    const m = Q.activeMini;
    if(!m) return;

    // mini tick hook
    try{
      if(typeof m.tick === 'function') m.tick(Q.mctx || {}, S);
    }catch(_){}

    const leftMs = Q.miniEndsAt - now();
    const urgent = (leftMs <= 3000 && leftMs > 0);

    if(urgent && !Q.miniUrgentArmed){
      Q.miniUrgentArmed = true;
      setUrgent(true);
      try{ AudioX.warn && AudioX.warn(); }catch(_){}
      vibe(20);
    }
    if(!urgent && Q.miniUrgentArmed){
      Q.miniUrgentArmed = false;
      setUrgent(false);
    }
    if(urgent){
      const sec = Math.ceil(leftMs/1000);
      if(sec !== Q.miniTickAt){
        Q.miniTickAt = sec;
        try{ AudioX.tick && AudioX.tick(); }catch(_){}
      }
    }

    if(leftMs <= 0){
      setUrgent(false);

      let ok = false;
      try{
        ok = (typeof m.isClear === 'function') ? !!m.isClear(Q.mctx || {}, S) : false;
      }catch(_){ ok = false; }

      if(ok){
        // ผลลัพธ์ mini ผ่าน/ไม่ผ่าน ให้ plate.safe.js เป็นคนให้คะแนน/fever
        logEvent('mini_clear', { mini: m.key });
      }else{
        logEvent('mini_fail', { mini: m.key });
      }

      // ปล่อย event ให้ plate.safe.js รับไปให้รางวัล/ลงโทษ (รวมไว้ที่เดียว)
      dispatchEvt('hha:quest_mini_end', { miniKey: m.key, ok });

      startMini();
      return;
    }

    emitUpdate();
  }

  // --- External hooks from game ---
  function onHit(hit, judge){
    const S = getState();
    const m = Q.activeMini;
    if(m && typeof m.onHit === 'function'){
      try{ m.onHit(Q.mctx || {}, S, hit, judge); }catch(_){}
    }
    emitUpdate();
  }

  function onJudge(judge){
    const S = getState();
    const m = Q.activeMini;
    if(m && typeof m.onJudge === 'function'){
      try{ m.onJudge(Q.mctx || {}, S, judge); }catch(_){}
    }
    emitUpdate();

    // goal check (perfect goal)
    if(checkGoalClear()) onGoalCleared();
  }

  function onPower(kind){
    const S = getState();
    const m = Q.activeMini;
    if(m && typeof m.onPower === 'function'){
      try{ m.onPower(Q.mctx || {}, S, kind); }catch(_){}
    }
    emitUpdate();
  }

  function onPlateCompleted(){
    // plate.safe.js จะเพิ่ม goalsCleared อยู่แล้ว — ที่นี่แค่เช็ก goal
    if(checkGoalClear()) onGoalCleared();
    else emitUpdate();
  }

  function reset(){
    Q.goalIndex = 0;
    Q.activeGoal = null;
    Q.activeMini = null;
    Q.mctx = null;
    Q.miniEndsAt = 0;
    Q.miniUrgentArmed = false;
    Q.miniTickAt = 0;

    setGoal(0);
    startMini();
  }

  // init
  setGoal(0);
  startMini();

  return {
    reset,
    tick,
    onHit,
    onJudge,
    onPower,
    onPlateCompleted,
    setGoal, // เผื่ออยากบังคับ
  };
}