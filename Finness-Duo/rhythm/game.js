/* Rhythm Stretch VR — Difficulty Tuning:
   + Multi-BPM sections (rise/wave)
   + Speed Curve (scroll เร็วขึ้นเรื่อย ๆ)
   + Fever Time (combo boost + สีฉากเปลี่ยนชั่วคราว)
   + Hidden Notes (โปร่งใส จนใกล้ถึงเวลา)
   + Perfect/Good/Miss floating text (มีอยู่แล้ว)
*/

const $ = id => document.getElementById(id);

// Elements
const hudText = $("hudText");
const hudScore = $("hudScore");
const sky = $("sky");
const root = $("root");
const btnStart = $("btnStart");
const btnReset = $("btnReset");
const rings = { U: $("hitU"), D: $("hitD"), L: $("hitL"), R: $("hitR") };
["keyU","keyD","keyL","keyR"].forEach(id=>{
  const el=$(id); if(el) el.addEventListener('click',()=> manualHit(id.slice(-1).toUpperCase()));
});

// Theme → color
const THEME_COLOR = { beach: "#002034", city: "#0f141a", galaxy:"#070022" };
function skyTheme(theme){ if(sky) sky.setAttribute('color', THEME_COLOR[theme]||"#0b1220"); }

// State
const state = {
  running:false, paused:false,
  bpm:120, secPerBeat:0.5,
  mode:"training", theme:"beach",

  // timing / sequencing
  time0:0, now:0, raf:0,
  notes:[], idx:0, laneTimeAhead:4,               // base view window (seconds)
  scrollBase: 2.8,                                // distance (z) from spawn to ring plane
  curveK: 0.01,                                   // speed curve factor (seconds -> multiplier)
  useCurve: false,

  // scoring
  score:0, combo:0, bestCombo:0,
  hitWindow:0.18, perfectWindowRatio:0.5,
  stat:{perfect:0, good:0, miss:0},

  // metronome
  nextBeatT:0, metronomeOn:true,

  // difficulty toggles
  useMultiBpm:false,
  multiPattern:"rise",   // rise | wave
  useFever:false,
  feverNeed:8,
  feverActive:false,
  feverUntil:0,

  // hidden notes
  useHidden:false,
  revealWindow:0.6,      // seconds before hit to reveal fully

  // audio
  actx:null, sfxGain:null, metroGain:null
};

// ---------- Audio ----------
function ensureAudio(){
  if(state.actx) return;
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  state.actx=new AC();
  state.sfxGain=state.actx.createGain(); state.sfxGain.gain.value=0.12; state.sfxGain.connect(state.actx.destination);
  state.metroGain=state.actx.createGain(); state.metroGain.gain.value=0.06; state.metroGain.connect(state.actx.destination);
}
function beep(freq=880, dur=0.05, gain=0.12, out){
  ensureAudio(); if(!state.actx) return;
  const o=state.actx.createOscillator(), g=state.actx.createGain();
  o.type="sine"; o.frequency.value=freq; o.connect(g); g.connect(out || state.sfxGain);
  const t=state.actx.currentTime;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.start(t); o.stop(t+dur+0.01);
}
let beatLoopCount=0;
function metronomeTick(beatCount){
  if(!state.metronomeOn) return;
  const f = (beatCount%4===0)? 1200 : 880;
  beep(f, 0.04, state.feverActive ? 0.12 : 0.08, state.metroGain);
}

// ---------- UI helpers ----------
function setHUD(msg){ if(hudText) hudText.textContent = msg; }
function setScore(){
  if(hudScore){
    const mul = state.feverActive ? " x2 Fever" : "";
    hudScore.textContent = `คะแนน: ${state.score}${mul} • Combo: ${state.combo} | P:${state.stat.perfect} G:${state.stat.good} M:${state.stat.miss}`;
  }
}
function clearNodes(){ while(root && root.firstChild) root.removeChild(root.firstChild); }
function lanePos(lane){ if(lane==='U')return{x:0,y:0.7,z:0.05}; if(lane==='D')return{x:0,y:-0.7,z:0.05}; if(lane==='L')return{x:-1.2,y:0,z:0.05}; return{x:1.2,y:0,z:0.05}; }
function feedbackText(lane, text, color="#fff"){
  const p = lanePos(lane);
  const el=document.createElement('a-entity');
  el.setAttribute('text', `value:${text}; width:3.5; align:center; color:${color}`);
  el.setAttribute('position', `${p.x} ${p.y} ${p.z}`);
  el.setAttribute('scale', '0.8 0.8 0.8');
  root.appendChild(el);
  try{
    el.setAttribute('animation__pop','property: scale; to: 1.2 1.2 1.2; dur: 90; dir: alternate; easing: easeOutBack');
    el.setAttribute('animation__up','property: position; to: '+`${p.x} ${p.y+0.25} ${p.z}`+'; dur: 360; easing: easeOutCubic');
    el.setAttribute('animation__fade','property: opacity; to: 0; dur: 380; delay:80; easing: linear');
  }catch(e){}
  setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, 420);
}

// ---------- Options from UI ----------
function readOptions(){
  const modeSel=$("mode"), bpmSel=$("bpm"), themeSel=$("theme");
  state.mode = (modeSel && modeSel.value) || "training";
  state.bpm  = parseInt((bpmSel && bpmSel.value) || "120",10);
  state.secPerBeat = 60/state.bpm;
  state.hitWindow = (state.mode==="training") ? 0.22 : 0.16;
  state.perfectWindowRatio = (state.mode==="training") ? 0.55 : 0.5;
  state.theme = (themeSel && themeSel.value) || "beach";

  state.useMultiBpm = $("optMultiBpm")?.checked || false;
  state.multiPattern= $("multiPattern")?.value || "rise";
  state.useCurve    = $("optSpeedCurve")?.checked || false;
  state.curveK      = parseFloat(($("curveK")?.value)||"0.00");
  state.useFever    = $("optFever")?.checked || false;
  state.feverNeed   = parseInt(($("feverNeed")?.value)||"8",10);
  state.useHidden   = $("optHidden")?.checked || false;
}

// ---------- Note building ----------
function makeNote(lane, time, label=""){
  const el=document.createElement('a-entity');
  el.classList.add('note');
  el.setAttribute('geometry', 'primitive: sphere; radius: 0.14; segmentsWidth: 16; segmentsHeight: 12');
  const color = lane==='U'?'#94a3ff':lane==='D'?'#ff9ea0':lane==='L'?'#86f7a5':'#ffd683';
  // initial opacity (hidden notes)
  const op = state.useHidden ? 0.12 : 0.98;
  el.setAttribute('material', `color:${color}; opacity:${op}; shader:flat`);

  const p = lane==='U' ? [0,  0.7, state.scrollBase] :
            lane==='D' ? [0, -0.7, state.scrollBase] :
            lane==='L' ? [-1.2, 0, state.scrollBase] : [1.2, 0, state.scrollBase];
  el.setAttribute('position', `${p[0]} ${p[1]} ${p[2]}`);

  if(state.mode==="training" && label){
    const t=document.createElement('a-entity');
    t.setAttribute('text', `value:${label}; width:2; align:center; color:#001`);
    t.setAttribute('position', `0 0 0.16`);
    el.appendChild(t);
  }
  el.__lane=lane; el.__hitTime=time; el.__hit=false; el.__judged=false;
  root.appendChild(el);
  return el;
}

// สร้าง pattern หลาย BPM (ง่ายและชัด)
function buildSections(){
  // คืนค่า array ของ {bpm, beats}
  const base = state.bpm;
  if(!state.useMultiBpm){
    return [{ bpm: base, beats: (state.mode==="training"? 32 : 48) }];
  }
  if(state.multiPattern==="wave"){
    // ขึ้น-ลงเป็นคลื่น
    return [
      { bpm: base,      beats: 16 },
      { bpm: base+20,   beats: 16 },
      { bpm: base,      beats: 16 }
    ];
  }
  // rise (ขึ้นช้า->เร็ว)
  return [
    { bpm: base,      beats: 16 },
    { bpm: base+20,   beats: 16 },
    { bpm: base+30,   beats: 16 }
  ];
}

function scheduleNotes(){
  state.notes=[]; state.idx=0;
  const sections = buildSections();
  let t = state.time0 + 2.0; // เคาน์ดาวน์ก่อนเริ่ม
  const every = (state.mode==="training") ? 2 : 1;
  let order = ['U','D','L','R'];
  let stepCount=0;

  for(const sec of sections){
    const spb = 60/sec.bpm;
    const beats = sec.beats;
    for(let b=0; b<beats; b+=every){
      const lane = order[(stepCount++)%4];
      const label = (state.mode==="training") ? String((stepCount-1)%4+1) : "";
      const hitT = t + b*spb;
      state.notes.push({lane, t:hitT, el:null, label});
    }
    t += beats*spb; // เวลาสะสมจนจบ section
  }
}

// ---------- Fever ----------
function maybeEnterFever(){
  if(!state.useFever || state.feverActive) return;
  if(state.combo >= state.feverNeed){
    state.feverActive = true;
    // กำหนดเวลาจบ fever ประมาณ 8 จังหวะจาก "BPM ปัจจุบัน"
    const spb = state.secPerBeat; // ใช้ bpm ตั้งต้นเป็นเกณฑ์กลาง
    state.feverUntil = state.now + 8*spb;
    // เอฟเฟกต์ภาพ: กระพริบสีฟ้า-เขียวเบา ๆ
    try{
      sky.setAttribute('animation__fev','property: color; to: #013a2c; dir: alternate; loop: true; dur: 240');
    }catch(e){}
  }
}
function updateFever(){
  if(!state.feverActive) return;
  if(state.now >= state.feverUntil){
    state.feverActive=false;
    try{ sky.removeAttribute('animation__fev'); skyTheme(state.theme); }catch(e){}
  }
}

// ---------- Judging ----------
function judgeCategory(dt){
  const perfectWin = state.hitWindow * state.perfectWindowRatio;
  if(dt <= perfectWin) return "perfect";
  if(dt <= state.hitWindow) return "good";
  return "miss";
}
function flashRing(lane, strength=0.8){
  const r = rings[lane]; if(!r) return;
  try{ r.setAttribute("animation__flash",`property: material.opacity; from:0.95; to:${Math.min(1.0,0.95+0.25*strength)}; dur:90; dir:alternate`);}catch(e){}
}
function fadeOut(el){
  try{
    el.setAttribute("animation__fade","property: material.opacity; to:0; dur:120; easing:easeOutQuad");
    setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, 140);
  }catch(e){ if(el.parentNode) el.parentNode.removeChild(el); }
}

function judge(note, lane){
  if(note.__judged) return;
  const t = state.now;
  const dt = Math.abs(note.__hitTime - t);
  const cat = judgeCategory(dt);
  if(cat==="miss") return;

  note.__judged = true; note.__hit = true;

  // score & stats (+ fever multiplier)
  const baseScore = (cat==="perfect") ? 300 : 150;
  const mul = state.feverActive ? 2 : 1;
  state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo);
  state.score += baseScore * mul;
  state.stat[cat]++;

  setScore(); beep(cat==="perfect" ? 1000 : 780, 0.06, 0.12);
  flashRing(lane, cat==="perfect" ? 1.0 : 0.7);
  feedbackText(lane, (state.feverActive?"★ ":"") + (cat==="perfect" ? "Perfect" : "Good"),
               cat==="perfect" ? "#7dfcc6" : "#a7f3d0");

  // เข้าสู่ Fever เมื่อถึงเกณฑ์
  maybeEnterFever();

  try{ note.setAttribute("animation__pop","property: scale; to: 1.4 1.4 1.4; dur: 90; dir: alternate"); }catch(e){}
  setTimeout(()=>{ if(note.parentNode) note.parentNode.removeChild(note); }, 110);
}
function miss(note){
  if(note.__judged) return;
  note.__judged = true; note.__hit=false;
  state.combo=0; state.stat.miss++; setScore();
  beep(240,0.06,0.12);
  feedbackText(note.__lane, "Miss", "#ff9ea0");
  fadeOut(note);
}

// ---------- Manual hit ----------
function manualHit(lane){
  let best=null, bestDt=999;
  const now=state.now;
  for(const n of state.notes){
    if(n.el && !n.el.__judged && n.lane===lane){
      const dt=Math.abs(n.el.__hitTime - now);
      if(dt<bestDt){ best=n.el; bestDt=dt; }
    }
  }
  if(best) judge(best, lane);
}

// ---------- Loop ----------
function tickMetronome(now){
  const spb=state.secPerBeat;
  while(now >= state.nextBeatT){
    metronomeTick(beatLoopCount);
    beatLoopCount++;
    state.nextBeatT += spb;
  }
}

function loop(){
  if(!state.running) return;
  state.now = performance.now()/1000;

  tickMetronome(state.now);
  updateFever();

  // Spawn notes ahead of time
  while(state.idx < state.notes.length && state.notes[state.idx].t - state.now <= state.laneTimeAhead){
    const n = state.notes[state.idx];
    if(!n.el) n.el = makeNote(n.lane, n.t, n.label);
    state.idx++;
  }

  // Speed curve (เลื่อนเร็วขึ้นเรื่อย ๆ)
  // factor ~ 1 + k * elapsedFromStart
  const elapsed = state.now - state.time0;
  const curveFactor = state.useCurve ? Math.max(1.0, 1.0 + state.curveK * elapsed) : 1.0;
  const speed = (state.scrollBase / state.laneTimeAhead) * curveFactor;

  const children = Array.from(root.children||[]);
  for(const el of children){
    if(!el.__hitTime) continue;
    const remain = el.__hitTime - state.now;
    // Hidden → ใกล้ถึงเวลา ค่อยเผย
    if(state.useHidden){
      const m = el.getAttribute('material');
      if(remain <= state.revealWindow && m && m.opacity < 0.98){
        try{ el.setAttribute('material', m.color ? `color:${m.color}; opacity:0.98; shader:flat` : 'opacity:0.98; shader:flat'); }catch(e){}
      }
    }
    // move towards ring (z decreases to 0)
    const z = Math.max(0, remain * speed);
    const pos = el.getAttribute('position');
    el.setAttribute('position', `${pos.x} ${pos.y} ${z.toFixed(3)}`);

    if(!el.__judged && remain < -state.hitWindow){
      miss(el);
    }
  }

  const anyActive = children.some(c=>!c.__judged);
  if(state.idx >= state.notes.length && !anyActive){
    state.running=false;
    setHUD(`จบเพลง! คะแนน: ${state.score}${state.feverActive?' (Fever)':''} • Best Combo: ${state.bestCombo} • P:${state.stat.perfect} G:${state.stat.good} M:${state.stat.miss}`);
    beep(1200,0.08,0.16); setScore();
    state.feverActive=false; try{ sky.removeAttribute('animation__fev'); skyTheme(state.theme); }catch(e){}
    return;
  }
  state.raf = requestAnimationFrame(loop);
}

// ---------- Start/Reset ----------
function startGame(){
  ensureAudio(); state.running=true; state.paused=false;
  readOptions(); skyTheme(state.theme);
  state.time0 = performance.now()/1000;
  state.score=0; state.combo=0; state.bestCombo=0; state.stat={perfect:0,good:0,miss:0};
  clearNodes(); scheduleNotes();
  state.nextBeatT = state.time0; beatLoopCount=0;
  setHUD(`เริ่ม! ${state.mode} • BPM ${state.bpm}${state.useMultiBpm?' (Multi-BPM)':''}${state.useCurve?' • SpeedCurve':''}${state.useHidden?' • Hidden':''}${state.useFever?' • Fever':''}`);
  setScore();
  loop();
}
function resetGame(){
  state.running=false; state.paused=false; cancelAnimationFrame(state.raf);
  state.feverActive=false; try{ sky.removeAttribute('animation__fev'); }catch(e){}
  clearNodes(); setHUD("พร้อมเริ่ม"); state.score=0; state.combo=0; state.stat={perfect:0,good:0,miss:0}; setScore();
}

// ---------- Controls / lifecycle ----------
btnStart && btnStart.addEventListener('click',()=>{ if(!state.running) startGame(); });
btnReset && btnReset.addEventListener('click',()=> resetGame());
window.addEventListener('keydown', (e)=>{
  const k=e.key.toLowerCase();
  if(k==='arrowup' || k==='w') manualHit('U');
  if(k==='arrowdown' || k==='s') manualHit('D');
  if(k==='arrowleft' || k==='a') manualHit('L');
  if(k==='arrowright' || k==='d') manualHit('R');
});
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){ state.paused=true; cancelAnimationFrame(state.raf); setHUD("หยุดชั่วคราว"); }
  else if(state.running){ state.paused=false; setHUD("เล่นต่อ"); loop(); }
});
// gaze click on rings
Object.entries(rings).forEach(([lane, el])=>{
  if(!el) return; el.classList.add('btn'); el.addEventListener('click', ()=> manualHit(lane));
});

// init preview text
(function init(){
  const apply=()=>{ readOptions(); skyTheme(state.theme); setHUD(`พร้อมเริ่ม • โหมด: ${state.mode} @ ${state.bpm} BPM`); };
  ["mode","bpm","theme","optMultiBpm","multiPattern","optSpeedCurve","curveK","optFever","feverNeed","optHidden"]
    .forEach(id=>{ const el=$(id); if(el) el.addEventListener(el.type==='checkbox'?'change':'input', apply); });
  apply(); setScore();
})();
