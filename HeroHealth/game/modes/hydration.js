// game/modes/hydration.js
// -----------------------------------------------------------
// Hydration Mode v2 — ครบ 1–10:
// 1) ดริฟท์สภาพแวดล้อม + HUD สี/สถานะ
// 2) คะแนนตามช่วง (in-range / out-of-range)
// 3) ไอเท็มใหม่ + พฤติกรรมต่างกัน (รวมโอเวอร์ไทม์/สแตก)
// 4) โค้ชเตือนเมื่อโซนเปลี่ยน / ใกล้หลุดช่วง
// 5) ภารกิจหลัก 30s: รักษาสมดุลต่อเนื่อง
// 6) Micro-Missions หมุนเวียนสั้น ๆ
// 7) ไอเท็มเชิงพฤติกรรม (เกลือแร่เข้มข้น/กาแฟเข้ม) และสแตก
// 8) ตัวคูณดริฟท์ตามฉาก (ทะเลทราย/หิมะ/ป่า/เมือง/ยาน)
// 9) Adaptive: ปรับโอกาสสุ่ม bad drink ตามฟอร์มผู้เล่น
// 10) Telemetry สถิติการเล่น
// + เงื่อนไขพิเศษน้ำหวาน: >65 ได้แต้ม, <45 หักแต้ม
// -----------------------------------------------------------

const clamp   = (v,a,b)=>Math.max(a,Math.min(b,v));
const between = (x,a,b)=> x>=a && x<=b;

// HUD
function setHydroHUD(hud, value, label, color){
  if (hud?.setHydration) { hud.setHydration(value, label, color); return; }
  const bar = document.getElementById('hydroBar');
  const lab = document.getElementById('hydroLabel');
  const wrap= document.getElementById('hydroWrap');
  if (wrap) wrap.style.display = 'block';
  if (bar){ bar.style.width = clamp(value,0,100)+'%'; bar.style.background = color || 'linear-gradient(90deg,#3dd6ff,#00ffa2)'; }
  if (lab){ lab.textContent = label || `${value|0}%`; }
}
function coachSay(coach, thMsg, enMsg, lang){ coach?.say?.(lang==='TH' ? thMsg : enMsg); }

// Env & Scene
const ENV = { name:'normal', drift:-0.35, until:0 };
function rollEnv(){
  const r = Math.random();
  if (r < 0.33)      { ENV.name='heat';  ENV.drift=-0.60; ENV.until=Date.now()+24000; }
  else if (r < 0.66) { ENV.name='cool';  ENV.drift=-0.20; ENV.until=Date.now()+20000; }
  else               { ENV.name='normal';ENV.drift=-0.35; ENV.until=Date.now()+22000; }
}
function envLabel(){ return ENV.name==='heat' ? 'HeatWave 🔥' : ENV.name==='cool' ? 'CoolBreeze ❄️' : 'Normal'; }
function sceneDriftMul(sceneKey){
  switch(sceneKey){
    case 'desert': return 1.45;
    case 'snow':   return 0.70;
    case 'forest': return 1.00;
    case 'city':   return 1.10;
    case 'ship':   return 0.95;
    default:       return 1.00;
  }
}

// Powers
const POW = { normalizeCD:0, guardUntil:0 };
function useNormalize(state, hud, systems){
  const now=Date.now(); if (now < POW.normalizeCD) return false;
  POW.normalizeCD = now + 25000;
  state.hyd = 55;
  setHydroHUD(hud, state.hyd, `${state.hyd|0}% • Normalized`, 'linear-gradient(90deg,#3dd6ff,#00ffa2)');
  systems?.fx?.spawn3D?.(null,'Normalize → 55%','good');
  systems?.sfx?.play?.('sfx-perfect');
  return true;
}
function useGuard(systems){
  POW.guardUntil = Date.now()+5000;
  systems?.fx?.spawn3D?.(null,'Drop Guard 5s','good');
  systems?.sfx?.play?.('sfx-good');
}

// Mode state
const MODE = {
  mission: null,
  streakInRange: 0,
  deltaOverTime: 0,
  deltaDecay: 0.65,
  lastZone: null,
  __safeTick: 0,
  micro: null,
  drinkStacks: {},
  adaptScore: 0,
  __touchedSugar:false,
  // stats
  stat: { secInRange:0, secOutRange:0, enterLow:0, enterHigh:0, items:{}, useNormalize:0, useGuard:0, microSuccess:0, microFail:0 }
};

// Drinks
const DRINKS = [
  { key:'water',        char:'💧', hint:'+8 instant',             instant:+8,  over:0,  type:'good' },
  { key:'mineral',      char:'⚗️', hint:'+1 now +4 over-time',    instant:+1,  over:+4, type:'good' },
  { key:'juice',        char:'🧃', hint:'+5 now +2 over-time',    instant:+5,  over:+2, type:'ok'   },
  { key:'milk',         char:'🥛', hint:'+4 instant (mild)',      instant:+4,  over:0,  type:'ok'   },
  { key:'sugary',       char:'🥤', hint:'-8 instant',             instant:-8,  over:0,  type:'bad'  },
  { key:'coffee',       char:'☕',  hint:'-6 instant',             instant:-6,  over:0,  type:'bad'  },
  // behavioral
  { key:'mineral_plus', char:'⚗️✨',hint:'+2 now +6 over-time',    instant:+2, over:+6, type:'good+' },
  { key:'coffee_strong',char:'☕️🔥',hint:'-9 now & extra drift',   instant:-9, over:0,  type:'bad+'  },
  // powers
  { key:'normalize',    char:'🛎️', hint:'Power: Normalize 55%',   instant:0,  over:0,  type:'power' },
  { key:'guard',        char:'🛡️', hint:'Power: Drop Guard 5s',   instant:0,  over:0,  type:'power' },
];

function byKey(k){ return DRINKS.find(d=>d.key===k); }
function randFrom(arr){ return arr[(Math.random()*arr.length)|0]; }
function pickDrink(state){
  let w = { good: 40, ok: 22, bad: 26, goodPlus: 6, badPlus: 4, power: 2 };
  if (MODE.adaptScore > 6) { w.bad += 8; w.badPlus += 3; w.good -= 6; }
  if (MODE.adaptScore < -6){ w.good += 8; w.ok += 4;    w.bad -= 6;   }
  const total = w.good + w.ok + w.bad + w.goodPlus + w.badPlus + w.power;
  let r = Math.random()*total;
  const take = (x)=> (r< x ? true : (r-=x, false));
  if (take(w.good))     return randFrom(['water','mineral','juice'].map(k=>byKey(k)));
  if (take(w.ok))       return byKey('milk');
  if (take(w.bad))      return randFrom(['sugary','coffee'].map(k=>byKey(k)));
  if (take(w.goodPlus)) return byKey('mineral_plus');
  if (take(w.badPlus))  return byKey('coffee_strong');
  return Math.random()<0.5 ? byKey('normalize') : byKey('guard');
}

// Micro-missions
function newMicro(){
  const pool = [
    { id:'hold_mid',   label:'Keep 52–58% for 15s', dur:15, cond:(st)=> between(st.hyd,52,58) },
    { id:'no_low',     label:'Stay ≥46% for 12s',   dur:12, cond:(st)=> st.hyd>=46 },
    { id:'no_high',    label:'Stay ≤60% for 12s',   dur:12, cond:(st)=> st.hyd<=60 },
    { id:'no_sugar',   label:'Avoid 🥤 for 15s',    dur:15, cond:(st)=> !MODE.__touchedSugar },
  ];
  return { ...pool[(Math.random()*pool.length)|0], left:0, ok:true, started:false };
}

// API
export function init(state, hud, diff){
  state.hydMin = 45; state.hydMax = 65;
  state.hyd = (typeof state.hyd === 'number' ? state.hyd : 50);

  MODE.mission = { name:'keep_range', remainSec:30, inProgress:true, success:false };
  MODE.streakInRange = 0; MODE.deltaOverTime = 0; MODE.lastZone = null; MODE.__safeTick = 0;
  MODE.drinkStacks = {}; MODE.adaptScore = 0; MODE.__touchedSugar=false;
  MODE.stat = { secInRange:0, secOutRange:0, enterLow:0, enterHigh:0, items:{}, useNormalize:0, useGuard:0, microSuccess:0, microFail:0 };

  rollEnv();
  const ml = document.getElementById('missionLine');
  if (ml){ ml.style.display='block'; ml.textContent = `Env: ${envLabel()}`; }

  if (hud?.showHydration) hud.showHydration();
  applyHydAndHUD(state, hud, 0);

  window.HHAHydration = window.HHAHydration || {};
  window.HHAHydration.useNormalize = ()=> useNormalize(state, hud, lastSystems);
  window.HHAHydration.useGuard     = ()=> { MODE.stat.useGuard++; return useGuard(lastSystems); };
  window.HHAHydration.telemetry    = ()=> JSON.parse(JSON.stringify(MODE.stat));

  MODE.micro = newMicro();
  MODE.micro.left = MODE.micro.dur;
}

export function pickMeta(diff, state){
  const d = pickDrink(state);
  return {
    char: d.char, drink: d.key,
    instant: d.instant|0, over: d.over|0,
    type: d.type, good: d.type==='good'||d.type==='good+', ok: d.type==='ok'
  };
}

export function onHit(meta, systems, state, hud){
  const { score, fx, sfx } = systems || {};
  MODE.stat.items[meta.drink] = (MODE.stat.items[meta.drink]||0)+1;

  if (meta.type==='power'){
    if (meta.drink==='normalize'){ if (useNormalize(state, hud, systems)) MODE.stat.useNormalize++; return; }
    if (meta.drink==='guard'){ useGuard(systems); MODE.stat.useGuard++; return; }
  }

  if (meta.drink==='mineral_plus'){ MODE.drinkStacks.mineral_plus = (MODE.drinkStacks.mineral_plus||0)+1; }
  if (meta.drink==='coffee_strong'){ MODE.__coffeeStrongUntil = Date.now()+6000; }

  const dNow  = meta.instant|0;
  const dOver = meta.over|0;

  applyHydAndHUD(state, hud, dNow);
  MODE.deltaOverTime += dOver;

  // น้ำหวาน: >65 ได้แต้ม, <45 หักแต้ม
  if (meta.drink === 'sugary') {
    MODE.__touchedSugar = true;
    if (state.hyd > state.hydMax) { score?.add?.(5);  fx?.spawn3D?.(null,'🥤 ช่วยลดสมดุลน้ำ','good'); sfx?.play?.('sfx-good'); }
    else if (state.hyd < state.hydMin) { score?.add?.(-5); fx?.spawn3D?.(null,'🥤 ทำให้ร่างกายแห้งลง!','bad'); sfx?.play?.('sfx-bad'); }
  }

  if (meta.type?.startsWith('good')){ fx?.spawn3D?.(null,'+HYD','good'); sfx?.play?.('sfx-good'); }
  else if (meta.type?.startsWith('bad')){ fx?.spawn3D?.(null,'-HYD','bad'); sfx?.play?.('sfx-bad'); }
  else { sfx?.play?.('sfx-good', {volume:.5}); }

  const inRange = between(state.hyd, state.hydMin, state.hydMax);
  if (!inRange && (meta.type?.startsWith('good'))) score?.add?.(3);
  if ( inRange && (meta.type?.startsWith('bad')))  score?.add?.(-2);
}

let lastSystems = null;
export function tick(state, systems, hud){
  lastSystems = systems;

  if (Math.abs(MODE.deltaOverTime) > 0.01){
    const stack = (MODE.drinkStacks.mineral_plus||0);
    const mul = 1 + Math.min(0.5, stack*0.12);
    const step = MODE.deltaOverTime * MODE.deltaDecay * 0.2 * mul;
    applyHydAndHUD(state, hud, step);
    MODE.deltaOverTime *= MODE.deltaDecay;
  }

  const sceneMul = sceneDriftMul(state.sceneKey || state.scene || 'forest');
  let drift = ENV.drift * sceneMul;
  if (Date.now() < (MODE.__coffeeStrongUntil||0)) drift += -0.20;

  applyHydAndHUD(state, hud, drift);

  if (Date.now() > ENV.until) {
    rollEnv();
    const ml = document.getElementById('missionLine');
    if (ml) ml.textContent = `Env: ${envLabel()}`;
  }

  const inRange = between(state.hyd, state.hydMin, state.hydMax);
  if (inRange){ systems?.score?.add?.(2); MODE.streakInRange++; MODE.stat.secInRange++; }
  else{ systems?.score?.add?.(-1); if (systems?.score?.combo>0) systems.score.combo--; MODE.streakInRange=0; MODE.stat.secOutRange++; }

  const zone = (state.hyd < state.hydMin) ? 'low' : (state.hyd > state.hydMax ? 'high' : 'ok');
  if (zone !== MODE.lastZone){
    if (zone==='low'){ MODE.stat.enterLow++;  coachSay(systems?.coach,'ค่าน้ำต่ำ! หา 💧 เร็ว!','Low hydration! Grab 💧!', state.lang); }
    else if (zone==='high'){ MODE.stat.enterHigh++; coachSay(systems?.coach,'ค่าน้ำสูงไป! หลีกเลี่ยงน้ำหวาน!','Too high! Avoid sugary drinks!', state.lang); }
    else{ coachSay(systems?.coach,'ดีมาก! รักษาค่านี้ไว้','Great! Keep it here.', state.lang); }
    MODE.lastZone = zone;
  }

  // เตือนล่วงหน้า ≤5 วิ
  const predict = state.hyd + drift*5 + (MODE.deltaOverTime*0.15);
  const aboutToLeave = (predict < state.hydMin) || (predict > state.hydMax);
  const hudBox = document.querySelector('.hud .hud-line');
  if(hudBox){ hudBox.style.boxShadow = aboutToLeave ? '0 0 18px rgba(255,120,80,.55)' : ''; }
  if (aboutToLeave) systems?.sfx?.play?.('sfx-tick');

  // Safe zone combo (50–58%)
  const safe = state.hyd>=50 && state.hyd<=58;
  if (safe && systems?.score){
    MODE.__safeTick = (MODE.__safeTick||0)+1;
    if (MODE.__safeTick % 4 === 0 && systems.score.combo < 5) {
      systems.score.combo++; hud?.setCombo?.(systems.score.combo);
    }
  }else{ MODE.__safeTick = 0; }

  // ภารกิจหลัก 30s
  if (MODE.mission && MODE.mission.inProgress){
    MODE.mission.remainSec = Math.max(0, (MODE.mission.remainSec|0) - 1);
    if (MODE.streakInRange >= 30){
      MODE.mission.inProgress = false; MODE.mission.success = true;
      systems?.score?.add?.(50); systems?.fx?.spawn3D?.(null, '🏁 Hydration Mission Complete', 'good'); systems?.sfx?.play?.('sfx-perfect');
    }else if (MODE.mission.remainSec===0){
      MODE.mission.inProgress = false; systems?.fx?.spawn3D?.(null, '⌛ Mission Failed', 'bad');
    }
  }

  // Micro mission
  if (MODE.micro){
    if (!MODE.micro.started){
      MODE.micro.started = true;
      MODE.micro.left = MODE.micro.dur;
      systems?.fx?.spawn3D?.(null, `🎯 ${MODE.micro.label}`, 'good');
    }else{
      MODE.micro.left = Math.max(0, MODE.micro.left-1);
      const ok = MODE.micro.cond(state);
      if (!ok) MODE.micro.ok = false;
      if (MODE.micro.left===0){
        if (MODE.micro.ok){
          MODE.stat.microSuccess++; systems?.score?.add?.(25);
          systems?.fx?.spawn3D?.(null,'🎉 Micro Mission Success','good'); systems?.sfx?.play?.('sfx-perfect');
          MODE.adaptScore += 2;
        }else{ MODE.stat.microFail++; MODE.adaptScore -= 1; }
        MODE.micro = newMicro(); MODE.micro.left = MODE.micro.dur; MODE.micro.ok = true; MODE.micro.started = false;
      }
    }
  }

  MODE.adaptScore += inRange ? 0.25 : -0.3;
  MODE.adaptScore = clamp(MODE.adaptScore, -12, 12);
}

// Helpers
function applyHydAndHUD(state, hud, delta){
  const before = state.hyd||50;
  let next = before + (delta||0);
  if (Date.now() < POW.guardUntil && next < (state.hydMin||45)) next = (state.hydMin||45);
  state.hyd = clamp(next, 0, 100);

  let color = 'linear-gradient(90deg,#3dd6ff,#00ffa2)';
  let label = `${state.hyd|0}% • Normal`;
  if (state.hyd < (state.hydMin||45)){ color = 'linear-gradient(90deg,#2f80ed,#56ccf2)'; label = `${state.hyd|0}% • Dehydrated`; }
  else if (state.hyd > (state.hydMax||65)){ color = 'linear-gradient(90deg,#ff8a00,#ff2770)'; label = `${state.hyd|0}% • Overhydrated`; }
  setHydroHUD(hud, state.hyd, label, color);
}

// Optional keyboard for powers
if (!window.__HHA_HYD_KEYS_BOUND__){
  window.__HHA_HYD_KEYS_BOUND__ = true;
  window.addEventListener('keydown',(e)=>{
    if (e.key==='n') { window.HHAHydration?.useNormalize?.(); }
    if (e.key==='g') { window.HHAHydration?.useGuard?.(); }
  });
}

export default { init, pickMeta, onHit, tick };
