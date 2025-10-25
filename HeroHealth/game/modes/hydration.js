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
// 10) Telemetry สถิติการเล่น ส่งคืนผ่าน window.HHAHydration.telemetry()
// -----------------------------------------------------------

const clamp   = (v,a,b)=>Math.max(a,Math.min(b,v));
const between = (x,a,b)=> x>=a && x<=b;

// ---------- HUD helpers ----------
function setHydroHUD(hud, value, label, color){
  if (hud?.setHydration) { hud.setHydration(value, label, color); return; }
  const bar = document.getElementById('hydroBar');
  const lab = document.getElementById('hydroLabel');
  const wrap= document.getElementById('hydroWrap');
  if (wrap) wrap.style.display = 'block';
  if (bar){ bar.style.width = clamp(value,0,100)+'%'; bar.style.background = color || 'linear-gradient(90deg,#3dd6ff,#00ffa2)'; }
  if (lab){ lab.textContent = label || `${value|0}%`; }
}
function coachSay(coach, thMsg, enMsg, lang){
  coach?.say?.(lang==='TH' ? thMsg : enMsg);
}

// ---------- Environment & Scene ----------
const ENV = { name:'normal', drift:-0.35, until:0 }; // base Δ/วินาที (ลบคือลด)
function rollEnv(){
  const r = Math.random();
  if (r < 0.33)      { ENV.name='heat';  ENV.drift=-0.60; ENV.until=Date.now()+24000; }
  else if (r < 0.66) { ENV.name='cool';  ENV.drift=-0.20; ENV.until=Date.now()+20000; }
  else               { ENV.name='normal';ENV.drift=-0.35; ENV.until=Date.now()+22000; }
}
function envLabel(){
  return ENV.name==='heat' ? 'HeatWave 🔥' : ENV.name==='cool' ? 'CoolBreeze ❄️' : 'Normal';
}
// ตัวคูณดริฟท์ตามฉาก
function sceneDriftMul(sceneKey){
  switch(sceneKey){
    case 'desert': return 1.45;  // ร้อน/แห้ง
    case 'snow':   return 0.70;  // หนาว
    case 'forest': return 1.00;
    case 'city':   return 1.10;
    case 'ship':   return 0.95;  // ยาน/ในร่ม
    default:       return 1.00;
  }
}

// ---------- Powers (Manual) ----------
const POW = { normalizeCD:0, guardUntil:0 }; // timestamps (ms)
function useNormalize(state, hud, systems){
  const now=Date.now(); if (now < POW.normalizeCD) return false;
  POW.normalizeCD = now + 25000; // 25s
  state.hyd = 55;
  setHydroHUD(hud, state.hyd, `${state.hyd|0}% • Normalized`, 'linear-gradient(90deg,#3dd6ff,#00ffa2)');
  systems?.fx?.spawn3D?.(null,'Normalize → 55%','good');
  systems?.sfx?.play?.('sfx-perfect');
  return true;
}
function useGuard(systems){
  POW.guardUntil = Date.now()+5000; // 5s
  systems?.fx?.spawn3D?.(null,'Drop Guard 5s','good');
  systems?.sfx?.play?.('sfx-good');
}

// ---------- Mode State ----------
const MODE = {
  mission: null,            // ภารกิจหลัก 30s
  streakInRange: 0,
  deltaOverTime: 0,         // สะสมโอเวอร์ไทม์
  deltaDecay: 0.65,         // ลดทอนโอเวอร์ไทม์ต่อวิ
  lastZone: null,
  __safeTick: 0,            // safe zone counter
  micro: null,              // ภารกิจย่อยหมุนเวียน
  drinkStacks: {},          // สแตกของไอเท็มบางชนิด
  adaptScore: 0,            // ตัวชี้ฟอร์มผู้เล่น (ขึ้นลง)
  // Telemetry
  stat: {
    secInRange: 0,
    secOutRange: 0,
    enterLow: 0,
    enterHigh: 0,
    items: {},         // {key: count}
    useNormalize: 0,
    useGuard: 0,
    microSuccess: 0,
    microFail: 0
  }
};

// ---------- Drinks (items) ----------
const DRINKS = [
  // key, char, hints, instant, over, type
  { key:'water',        char:'💧', hint:'+8 instant',             instant:+8,  over:0,  type:'good' },
  { key:'mineral',      char:'⚗️', hint:'+1 now +4 over-time',    instant:+1,  over:+4, type:'good' },
  { key:'juice',        char:'🧃', hint:'+5 now +2 over-time',    instant:+5,  over:+2, type:'ok'   },
  { key:'milk',         char:'🥛', hint:'+4 instant (mild)',      instant:+4,  over:0,  type:'ok'   },
  { key:'sugary',       char:'🥤', hint:'-8 instant',             instant:-8,  over:0,  type:'bad'  },
  { key:'coffee',       char:'☕',  hint:'-6 instant',             instant:-6,  over:0,  type:'bad'  },

  // 7) Behavioral
  { key:'mineral_plus', char:'⚗️✨',hint:'+2 now +6 over-time (stackable)', instant:+2, over:+6, type:'good+' },
  { key:'coffee_strong',char:'☕️🔥',hint:'-9 now & extra drift for 6s',     instant:-9, over:0,  type:'bad+'  },

  // Manual power drops (ไอคอน)
  { key:'normalize',    char:'🛎️', hint:'Power: Normalize to 55%', instant:0, over:0, type:'power' },
  { key:'guard',        char:'🛡️', hint:'Power: Drop Guard 5s',    instant:0, over:0, type:'power' },
];

// โอกาสสุ่ม ตาม Adaptive & สภาพแวดล้อม
function pickDrink(state){
  // base weight
  let w = {
    good: 40, ok: 22, bad: 26, goodPlus: 6, badPlus: 4, power: 2
  };
  // 9) Adaptive: ถ้าฟอร์มดี เพิ่ม bad
  if (MODE.adaptScore > 6) { w.bad += 8; w.badPlus += 3; w.good -= 6; }
  if (MODE.adaptScore < -6){ w.good += 8; w.ok += 4;    w.bad -= 6; }

  // Normalize weights
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
function byKey(k){ return DRINKS.find(d=>d.key===k); }
function randFrom(arr){ return arr[(Math.random()*arr.length)|0]; }

// ---------- Micro Missions (6) ----------
function newMicro(){
  // เลือกหนึ่งในชุด mission ย่อย
  const pool = [
    { id:'hold_mid',   label:'Keep 52–58% for 15s',        dur:15, cond:(st)=> between(st.hyd,52,58) },
    { id:'no_low',     label:'Stay ≥46% for 12s',          dur:12, cond:(st)=> st.hyd>=46 },
    { id:'no_high',    label:'Stay ≤60% for 12s',          dur:12, cond:(st)=> st.hyd<=60 },
    { id:'no_sugar',   label:'Avoid 🥤 for 15s',           dur:15, cond:(st)=> !MODE.__touchedSugar },
  ];
  return { ...pool[(Math.random()*pool.length)|0], left:0, ok:true, started:false };
}

// ---------- Public API ----------
export function init(state, hud, diff){
  // ช่วงเหมาะสม
  state.hydMin = 45;
  state.hydMax = 65;
  state.hyd = (typeof state.hyd === 'number' ? state.hyd : 50);

  // Reset mode state
  MODE.mission = { name:'keep_range', remainSec:30, inProgress:true, success:false };
  MODE.streakInRange = 0;
  MODE.deltaOverTime = 0;
  MODE.lastZone = null;
  MODE.__safeTick = 0;
  MODE.drinkStacks = {}; // e.g., { mineral_plus: count }
  MODE.adaptScore = 0;
  MODE.stat = { secInRange:0, secOutRange:0, enterLow:0, enterHigh:0, items:{}, useNormalize:0, useGuard:0, microSuccess:0, microFail:0 };
  MODE.__touchedSugar = false;

  rollEnv();
  // แสดง environment บน missionLine
  const ml = document.getElementById('missionLine');
  if (ml){ ml.style.display='block'; ml.textContent = `Env: ${envLabel()}`; }

  // เปิด HUD น้ำ
  if (hud?.showHydration) hud.showHydration();
  applyHydAndHUD(state, hud, 0);

  // บันทึกไว้ให้เรียกพาวเวอร์ด้วยปุ่ม (Optional)
  window.HHAHydration = window.HHAHydration || {};
  window.HHAHydration.useNormalize = ()=> useNormalize(state, hud, lastSystems);
  window.HHAHydration.useGuard     = ()=> { MODE.stat.useGuard++; return useGuard(lastSystems); };
  window.HHAHydration.telemetry    = ()=> JSON.parse(JSON.stringify(MODE.stat));

  // สร้าง micro mission
  MODE.micro = newMicro();
  MODE.micro.left = MODE.micro.dur;
}

// สุ่มไอเท็ม
export function pickMeta(diff, state){
  const d = pickDrink(state);
  return {
    char: d.char,
    drink: d.key,
    instant: d.instant|0,
    over: d.over|0,
    type: d.type,          // good/ok/bad/power/...
    good: d.type==='good' || d.type==='good+',
    ok:   d.type==='ok',
  };
}

// เก็บไอเท็ม
export function onHit(meta, systems, state, hud){
  const { score, fx, sfx, coach } = systems || {};
  MODE.stat.items[meta.drink] = (MODE.stat.items[meta.drink]||0)+1;

  // Power icons
  if (meta.type==='power'){
    if (meta.drink==='normalize'){ if (useNormalize(state, hud, systems)) MODE.stat.useNormalize++; return; }
    if (meta.drink==='guard'){ useGuard(systems); MODE.stat.useGuard++; return; }
  }

  // พฤติกรรมไอเท็มทั่วไป
  const dNow  = meta.instant|0;
  const dOver = meta.over|0;

  // 7) สแตกพิเศษ: mineral_plus สะสมได้
  if (meta.drink==='mineral_plus'){
    MODE.drinkStacks.mineral_plus = (MODE.drinkStacks.mineral_plus||0)+1;
  }
  // 7) กาแฟเข้ม: ใส่ drift พิเศษชั่วคราว (เราจะจัดการใน tick)
  if (meta.drink==='coffee_strong'){
    MODE.__coffeeStrongUntil = Date.now()+6000; // 6s
  }

  // ปรับค่า hyd
  applyHydAndHUD(state, hud, dNow);
  MODE.deltaOverTime += dOver;

  // 3) พิเศษ “น้ำหวาน” ตามเงื่อนไขของผู้ใช้
  if (meta.drink === 'sugary') {
    MODE.__touchedSugar = true;
    if (state.hyd > state.hydMax) {
      score?.add?.(5);
      fx?.spawn3D?.(null,'🥤 ช่วยลดสมดุลน้ำ','good');
      sfx?.play?.('sfx-good');
    } else if (state.hyd < state.hydMin) {
      score?.add?.(-5);
      fx?.spawn3D?.(null,'🥤 ทำให้ร่างกายแห้งลง!','bad');
      sfx?.play?.('sfx-bad');
    }
  }

  // เสียง/FX เบื้องต้น
  if (meta.type?.startsWith('good')){ fx?.spawn3D?.(null,'+HYD','good'); sfx?.play?.('sfx-good'); }
  else if (meta.type?.startsWith('bad')){ fx?.spawn3D?.(null,'-HYD','bad'); sfx?.play?.('sfx-bad'); }
  else { sfx?.play?.('sfx-good', {volume:.5}); }

  // โบนัสเล็กน้อยตามเหมาะสม
  const inRange = between(state.hyd, state.hydMin, state.hydMax);
  if (!inRange && (meta.type?.startsWith('good'))) score?.add?.(3);
  if ( inRange && (meta.type?.startsWith('bad')))  score?.add?.(-2);
}

// tick ต่อวินาที
let lastSystems = null;
export function tick(state, systems, hud){
  lastSystems = systems; // เก็บไว้ให้ powers เรียก

  // 3/7) โอเวอร์ไทม์ + สแตก mineral_plus ทำให้ over-time แรงขึ้นตามสแตก
  if (Math.abs(MODE.deltaOverTime) > 0.01){
    // บูสต์โอเวอร์ไทม์ถ้ามีสแตก mineral_plus
    const stack = (MODE.drinkStacks.mineral_plus||0);
    const mul = 1 + Math.min(0.5, stack*0.12); // +12% ต่อสแตก สูงสุด +50%
    const step = MODE.deltaOverTime * MODE.deltaDecay * 0.2 * mul;
    applyHydAndHUD(state, hud, step);
    MODE.deltaOverTime *= MODE.deltaDecay;
  }

  // 1/8) ดริฟท์สิ่งแวดล้อม + ตัวคูณฉาก
  const sceneMul = sceneDriftMul(state.sceneKey || state.scene || 'forest');
  let drift = ENV.drift * sceneMul;

  // 7) โทษเพิ่มจากกาแฟเข้ม 6s (ทำให้แห้งไวขึ้น)
  if (Date.now() < (MODE.__coffeeStrongUntil||0)) drift += -0.20;

  // Guard: กันต่ำกว่า 45% (จะไปล็อกใน applyHydAndHUD อีกชั้น)
  applyHydAndHUD(state, hud, drift);

  // 1) เปลี่ยนสภาพแวดล้อมเมื่อหมดเวลา
  if (Date.now() > ENV.until) {
    rollEnv();
    const ml = document.getElementById('missionLine');
    if (ml) ml.textContent = `Env: ${envLabel()}`;
  }

  // 2) คะแนนตามช่วง + นับวินาที
  const inRange = between(state.hyd, state.hydMin, state.hydMax);
  if (inRange){
    systems?.score?.add?.(2);
    MODE.streakInRange++;
    MODE.stat.secInRange++;
  }else{
    systems?.score?.add?.(-1);
    if (systems?.score?.combo>0) systems.score.combo--;
    MODE.streakInRange = 0;
    MODE.stat.secOutRange++;
  }

  // 4) โค้ชเตือนเมื่อ “เปลี่ยนโซน”
  const zone = (state.hyd < state.hydMin) ? 'low' : (state.hyd > state.hydMax ? 'high' : 'ok');
  if (zone !== MODE.lastZone){
    if (zone==='low'){
      MODE.stat.enterLow++;
      coachSay(systems?.coach, 'ค่าน้ำต่ำ! หา 💧 เร็ว!', 'Low hydration! Grab 💧!', state.lang);
    }else if (zone==='high'){
      MODE.stat.enterHigh++;
      coachSay(systems?.coach, 'ค่าน้ำสูงไป! หลีกเลี่ยงน้ำหวาน!', 'Too high! Avoid sugary drinks!', state.lang);
    }else{
      coachSay(systems?.coach, 'ดีมาก! รักษาค่านี้ไว้', 'Great! Keep it here.', state.lang);
    }
    MODE.lastZone = zone;
  }

  // 2) Pre-warning: คาดว่าจะหลุดช่วงใน ≤5 วิ
  const predict = state.hyd + drift*5 + (MODE.deltaOverTime*0.15);
  const aboutToLeave = (predict < state.hydMin) || (predict > state.hydMax);
  const hudBox = document.querySelector('.hud > div');
  if(hudBox){
    hudBox.style.boxShadow = aboutToLeave ? '0 0 18px rgba(255,120,80,.55)' : '';
  }
  if (aboutToLeave) systems?.sfx?.play?.('sfx-tick');

  // 3) Safe zone combo bonus (50–58%)
  const safe = state.hyd>=50 && state.hyd<=58;
  if (safe && systems?.score){
    MODE.__safeTick = (MODE.__safeTick||0)+1;
    if (MODE.__safeTick % 4 === 0 && systems.score.combo < 5) {
      systems.score.combo++;
      hud?.setCombo?.(systems.score.combo);
    }
  }else{
    MODE.__safeTick = 0;
  }

  // 5) ภารกิจหลัก 30s
  if (MODE.mission && MODE.mission.inProgress){
    MODE.mission.remainSec = Math.max(0, (MODE.mission.remainSec|0) - 1);
    if (MODE.streakInRange >= 30){
      MODE.mission.inProgress = false;
      MODE.mission.success = true;
      systems?.score?.add?.(50);
      systems?.fx?.spawn3D?.(null, '🏁 Hydration Mission Complete', 'good');
      systems?.sfx?.play?.('sfx-perfect');
    }else if (MODE.mission.remainSec===0){
      MODE.mission.inProgress = false;
      systems?.fx?.spawn3D?.(null, '⌛ Mission Failed', 'bad');
    }
  }

  // 6) Micro mission progress
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
          MODE.stat.microSuccess++;
          systems?.score?.add?.(25);
          systems?.fx?.spawn3D?.(null,'🎉 Micro Mission Success','good');
          systems?.sfx?.play?.('sfx-perfect');
          // เพิ่ม adaptive เมื่อเล่นดี
          MODE.adaptScore += 2;
        }else{
          MODE.stat.microFail++;
          // ลด adaptive เล็กน้อย
          MODE.adaptScore -= 1;
        }
        MODE.micro = newMicro();
        MODE.micro.left = MODE.micro.dur;
        MODE.micro.ok = true;
        MODE.micro.started = false;
      }
    }
  }

  // 9) Adaptive (ตัวชี้ฟอร์ม) — ถ้า inRange เพิ่ม, outRange ลด (นุ่ม ๆ)
  MODE.adaptScore += inRange ? 0.25 : -0.3;
  MODE.adaptScore = clamp(MODE.adaptScore, -12, 12);
}

// ---------- Internal helpers ----------
function applyHydAndHUD(state, hud, delta){
  const before = state.hyd||50;
  let next = before + (delta||0);

  // Guard: ห้ามต่ำกว่า min ระหว่างคุ้มกัน
  if (Date.now() < POW.guardUntil && next < (state.hydMin||45)) {
    next = state.hydMin||45;
  }

  state.hyd = clamp(next, 0, 100);

  // สี/ป้ายสถานะ
  let color = 'linear-gradient(90deg,#3dd6ff,#00ffa2)';
  let label = `${state.hyd|0}% • Normal`;
  if (state.hyd < (state.hydMin||45)){
    color = 'linear-gradient(90deg,#2f80ed,#56ccf2)'; // น้ำเงิน
    label = `${state.hyd|0}% • Dehydrated`;
  }else if (state.hyd > (state.hydMax||65)){
    color = 'linear-gradient(90deg,#ff8a00,#ff2770)'; // ส้ม-ชมพู
    label = `${state.hyd|0}% • Overhydrated`;
  }
  setHydroHUD(hud, state.hyd, label, color);
}

// ---------- Optional keyboard mapping for manual powers ----------
if (!window.__HHA_HYD_KEYS_BOUND__){
  window.__HHA_HYD_KEYS_BOUND__ = true;
  window.addEventListener('keydown',(e)=>{
    if (e.key==='n') { window.HHAHydration?.useNormalize?.(); }
    if (e.key==='g') { window.HHAHydration?.useGuard?.(); }
  });
}

// ---------- Export default ----------
export default { init, pickMeta, onHit, tick };
