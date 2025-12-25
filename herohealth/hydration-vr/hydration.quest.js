// === /herohealth/hydration-vr/hydration.quest.js ===
// Hydration Quest Director — Goals sequential + Minis chain (PRODUCTION)
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function nowMs(){ return (typeof performance!=='undefined' ? performance.now() : Date.now()); }

const DIFF = {
  easy:   { greenHoldSec: 14, avoidBadStreak: 6, rushCount: 5, rushSec: 9, powerCount: 2 },
  normal: { greenHoldSec: 18, avoidBadStreak: 8, rushCount: 6, rushSec: 9, powerCount: 3 },
  hard:   { greenHoldSec: 22, avoidBadStreak: 10, rushCount: 7, rushSec: 8, powerCount: 4 }
};

export function createHydrationQuest(opts={}){
  const diff = String(opts.diff||'normal').toLowerCase();
  const run  = String(opts.run ||'play').toLowerCase();

  const t = DIFF[diff] || DIFF.normal;

  const st = {
    started:false,

    // stats signals (from engine)
    waterZone:'GREEN',
    lastSec: 999,

    // goal progress
    goalIndex: 0,
    goalsDone: 0,
    minisDone: 0,

    // goal1: hold green seconds (cumulative)
    greenHold: 0,

    // goal2: good hits
    goodHits: 0,

    // mini chain state
    miniIndex: 0,

    // mini A: avoid bad streak
    avoidBad: 0,

    // mini B: rush window
    rushActive:false,
    rushStart:0,
    rushGood:0,
    rushBadDuring:false,

    // mini C: power count
    powerGot:0,

    // last events
    lastCelebrateAt:0
  };

  const goals = [
    { id:'g1', label:`รักษาโซน GREEN ให้ได้ ${t.greenHoldSec} วิ`, target:t.greenHoldSec },
    { id:'g2', label:`เก็บน้ำดีให้ได้`, target: (diff==='hard'? 22 : diff==='easy'? 16 : 19) }
  ];

  const minis = [
    { id:'m1', label:`No Sugary Streak ⚡ (หลบ 🥤 ให้ได้ติดกัน)`, target:t.avoidBadStreak },
    { id:'m2', label:`Hydration Rush 💧 (${t.rushCount} ภายใน ${t.rushSec} วิ + ห้ามโดนขยะ)`, target:t.rushCount },
  ];

  // research mode: mini chain ลด RNG/ความเร้าใจ (ยังคงได้ แต่ไม่สุ่มอีเวนต์เพิ่ม)
  if (run !== 'research') minis.push({ id:'m3', label:`Power Grab ⭐ (เก็บพาวเวอร์)`, target:t.powerCount });

  function activeGoal(){ return goals[clamp(st.goalIndex, 0, goals.length-1)] || goals[0]; }
  function activeMini(){ return minis[clamp(st.miniIndex, 0, minis.length-1)] || minis[0]; }

  function ui(){
    const g = activeGoal();
    const m = activeMini();

    let gVal = 0;
    if (g.id==='g1') gVal = st.greenHold;
    if (g.id==='g2') gVal = st.goodHits;

    let mVal = 0;
    if (m.id==='m1') mVal = st.avoidBad;
    if (m.id==='m2') mVal = st.rushGood;
    if (m.id==='m3') mVal = st.powerGot;

    emit('quest:update', {
      questNum: st.goalIndex + 1,
      text: `Goal: ${g.label} (${gVal}/${g.target})`,
      sub: `Mini: ${m.label} (${mVal}/${m.target}) • Zone: ${st.waterZone}`,
      done: `Goals done: ${st.goalsDone} • Minis done: ${st.minisDone}`
    });
  }

  function celebrate(kind='mini'){
    const ts = nowMs();
    if (ts - st.lastCelebrateAt < 350) return;
    st.lastCelebrateAt = ts;
    emit('hha:celebrate', { kind, ts, id: kind==='goal' ? activeGoal().id : activeMini().id });
  }

  function passGoal(){
    st.goalsDone++;
    celebrate('goal');
    st.goalIndex = clamp(st.goalIndex + 1, 0, goals.length); // อาจเกินได้ (จบ goal)
    ui();
  }

  function passMini(){
    st.minisDone++;
    celebrate('mini');
    st.miniIndex = (st.miniIndex + 1) % minis.length;

    // reset mini-specific
    st.avoidBad = 0;
    st.rushActive = false;
    st.rushGood = 0;
    st.rushBadDuring = false;
    st.powerGot = 0;

    ui();
  }

  function tick(sec, waterZone){
    st.waterZone = waterZone || st.waterZone;

    // goal1: count green seconds (cumulative)
    if (activeGoal().id === 'g1'){
      if (st.waterZone === 'GREEN') st.greenHold++;
      if (st.greenHold >= activeGoal().target) passGoal();
    }

    // mini2: rush timer handling
    const m = activeMini();
    if (m.id === 'm2'){
      if (!st.rushActive){
        // start automatically when entering GREEN (ครั้งแรกในช่วง)
        if (st.waterZone === 'GREEN'){
          st.rushActive = true;
          st.rushStart = nowMs();
          st.rushGood = 0;
          st.rushBadDuring = false;
        }
      } else {
        const dt = (nowMs() - st.rushStart) / 1000;
        if (dt > t.rushSec){
          // fail window -> restart if still green
          st.rushActive = false;
          st.rushGood = 0;
          st.rushBadDuring = false;
        }
      }
    }

    ui();
  }

  function onHit(info){
    // info: {isGood,isPower,itemType,perfect,blocked}
    const isGood = !!info.isGood;
    const isPower = !!info.isPower || info.itemType==='power';
    const isBad = !isGood || info.itemType==='bad' || info.itemType==='fakeGood';

    // goal2: good hits
    if (activeGoal().id === 'g2' && isGood && !isBad){
      st.goodHits++;
      if (st.goodHits >= activeGoal().target) passGoal();
    }

    // minis
    const m = activeMini();
    if (m.id === 'm1'){
      if (isBad && !info.blocked){
        st.avoidBad = 0;
      } else if (!isBad){
        st.avoidBad++;
        if (st.avoidBad >= m.target) passMini();
      }
    }

    if (m.id === 'm2'){
      if (isBad && !info.blocked) st.rushBadDuring = true;
      if (isGood && !isBad){
        if (!st.rushActive) {
          st.rushActive = true;
          st.rushStart = nowMs();
          st.rushGood = 0;
          st.rushBadDuring = false;
        }
        st.rushGood++;
        const dt = (nowMs() - st.rushStart) / 1000;
        if (st.rushGood >= m.target && dt <= t.rushSec && !st.rushBadDuring){
          passMini();
        }
      }
    }

    if (m.id === 'm3'){
      if (isPower){
        st.powerGot++;
        if (st.powerGot >= m.target) passMini();
      }
    }

    ui();
  }

  function start(){
    st.started = true;
    ui();
  }

  return { start, tick, onHit, getState:()=>({ ...st, goals, minis }) };
}