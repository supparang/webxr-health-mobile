/* Rhythm Stretch VR — core gameplay
   - ไม่มีไฟล์เสียงภายนอก ใช้ WebAudio สร้าง metronome/sfx
   - Training: ช้าลง + แสดงตัวเลข 1-2-3-4 บนโน้ต
   - Challenge: หนาแน่นขึ้น, timing เข้มขึ้น
*/

const $ = id => document.getElementById(id);

// Elements
const hudText = $("hudText");
const hudScore = $("hudScore");
const sky = $("sky");
const root = $("root");
const btnStart = $("btnStart");
const btnReset = $("btnReset");

// Hit rings
const rings = {
  U: $("hitU"), D: $("hitD"), L: $("hitL"), R: $("hitR")
};

// Mobile helper buttons
["keyU","keyD","keyL","keyR"].forEach(id=>{
  const el=$(id); if(el) el.addEventListener('click',()=> manualHit(id.slice(-1).toUpperCase()));
});

// Theme → sky color
const THEME_COLOR = {
  beach: "#002034",
  city:  "#0f141a",
  galaxy:"#070022"
};

// State
const state = {
  running:false, paused:false,
  bpm:120, secPerBeat:0.5,
  mode:"training", theme:"beach",
  time0:0, now:0, raf:0,
  notes:[], idx:0, laneTimeAhead:4, // spawn notes 4s ahead
  score:0, combo:0, bestCombo:0,
  hitWindow:0.18, // seconds
  spawnEvery:1,   // beats between notes
  nextBeatT:0,
  metronomeOn:true
};

// Audio
let actx=null, sfxGain=null, metroGain=null;
function ensureAudio(){
  if(actx) return;
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  actx=new AC();
  sfxGain=actx.createGain(); sfxGain.gain.value=0.12; sfxGain.connect(actx.destination);
  metroGain=actx.createGain(); metroGain.gain.value=0.06; metroGain.connect(actx.destination);
}
function beep(freq=880, dur=0.05, gain=0.12, out=sfxGain){
  ensureAudio(); if(!actx) return;
  const o=actx.createOscillator(), g=actx.createGain();
  o.type="sine"; o.frequency.value=freq; o.connect(g); g.connect(out);
  const t=actx.currentTime;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.start(t); o.stop(t+dur+0.01);
}
function metronomeTick(beatCount){
  if(!state.metronomeOn) return;
  // beat 1 สูงกว่า
  const f = (beatCount%4===0)? 1200 : 880;
  beep(f, 0.04, 0.08, metroGain);
}

// Helpers
function setHUD(msg){ if(hudText) hudText.textContent = msg; }
function setScore(){ if(hudScore) hudScore.textContent = `คะแนน: ${state.score} • Combo: ${state.combo}`; }
function skyTheme(theme){ if(sky) sky.setAttribute('color', THEME_COLOR[theme]||"#0b1220"); }

// Build / Reset
function clearNodes(){ while(root && root.firstChild) root.removeChild(root.firstChild); }
function makeNote(lane, time, label=""){
  // lane: 'U','D','L','R'; time: absolute seconds when it should hit rings
  const el=document.createElement('a-entity');
  el.classList.add('note');
  el.setAttribute('geometry', 'primitive: sphere; radius: 0.14; segmentsWidth: 16; segmentsHeight: 12');
  const color = lane==='U'?'#94a3ff':lane==='D'?'#ff9ea0':lane==='L'?'#86f7a5':'#ffd683';
  el.setAttribute('material', `color:${color}; opacity:0.98; shader:flat`);
  // start position away from ring (z positive means farther)
  const p = lane==='U' ? [0,  0.7, 2.8] :
            lane==='D' ? [0, -0.7, 2.8] :
            lane==='L' ? [-1.2, 0, 2.8] : [1.2, 0, 2.8];
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

function scheduleNotes(){
  state.notes=[]; state.idx=0;
  // Pattern: สลับ 4 ทิศ (U,D,L,R) ตามจังหวะ 4/4
  // Training: เว้นจังหวะมากกว่า + ใส่ฉลาก 1-2-3-4
  const spb = state.secPerBeat;
  const beats = state.mode==="training" ? 32 : 48;
  const every = state.mode==="training" ? 2 : 1; // training ยิงทุก 2 beat
  let t0 = state.time0 + 2.0; // ให้เวลานับถอยหลัง 2 วินาที
  let order = ['U','D','L','R'];
  let beatCount=0;
  for(let b=0;b<beats;b+=every){
    const lane = order[(b/ every)%4|0];
    const label = state.mode==="training" ? String((b/ every)%4+1) : "";
    const hitT = t0 + b*spb;
    state.notes.push({lane, t:hitT, el:null, label});
  }
}

function applyModeBpm(){
  const bpmSel = $("bpm"), modeSel = $("mode");
  state.bpm = parseInt((bpmSel && bpmSel.value) || "120", 10);
  state.mode = (modeSel && modeSel.value) || "training";
  state.secPerBeat = 60/state.bpm;
  state.hitWindow = (state.mode==="training") ? 0.22 : 0.16;
  state.spawnEvery = (state.mode==="training") ? 2 : 1;
}

function startGame(){
  ensureAudio(); state.running=true; state.paused=false;
  applyModeBpm();
  state.theme = (($("theme") && $("theme").value) || "beach");
  skyTheme(state.theme);
  state.time0 = performance.now()/1000;
  state.score=0; state.combo=0; state.bestCombo=0;
  clearNodes(); scheduleNotes();
  state.nextBeatT = state.time0; beatLoopCount=0;
  setHUD(`เริ่ม! โหมด: ${state.mode} • ${state.bpm} BPM`);
  setScore();
  loop();
}
function resetGame(){
  state.running=false; state.paused=false; cancelAnimationFrame(state.raf);
  clearNodes(); setHUD("พร้อมเริ่ม"); state.score=0; state.combo=0; setScore();
}

// Metronome driving
let beatLoopCount=0;
function tickMetronome(now){
  const spb=state.secPerBeat;
  while(now >= state.nextBeatT){
    metronomeTick(beatLoopCount);
    beatLoopCount++;
    state.nextBeatT += spb;
  }
}

// Hit / Judge
function judge(note, lane){
  if(note.__judged) return;
  const t = state.now;
  const dt = Math.abs(note.__hitTime - t);
  if(dt <= state.hitWindow){
    note.__judged = true; note.__hit = true;
    // pop
    try{ note.setAttribute("animation__pop","property: scale; to: 1.4 1.4 1.4; dur: 90; dir: alternate"); }catch(e){}
    setTimeout(()=>{ if(note.parentNode) note.parentNode.removeChild(note); }, 110);
    // score
    const perfect = dt <= state.hitWindow*0.5;
    state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo);
    state.score += perfect ? 300 : 150;
    setScore(); beep(perfect? 980:760,0.06,0.12);
    flashRing(lane, perfect? 1.0 : 0.7);
  } else {
    // too early/late -> ignore (ผู้เล่นกดไม่เป๊ะ จะไปพิจารณาตอนเลยวง)
  }
}
function miss(note){
  if(note.__judged) return;
  note.__judged = true; note.__hit=false;
  state.combo=0; setScore(); beep(240,0.06,0.12);
  fadeOut(note);
}
function flashRing(lane, strength=0.8){
  const r = rings[lane]; if(!r) return;
  try{
    r.setAttribute("animation__flash",`property: material.opacity; from:${0.95}; to:${Math.min(1.0,0.95+0.2*strength)}; dur:80; dir:alternate`);
  }catch(e){}
}
function fadeOut(el){
  try{
    el.setAttribute("animation__fade","property: material.opacity; to:0; dur:120; easing:easeOutQuad");
    setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, 140);
  }catch(e){ if(el.parentNode) el.parentNode.removeChild(el); }
}

// Manual hit (keyboard / on-screen)
function manualHit(lane){
  // หาโน้ตของเลนนั้นที่ใกล้ hitTime ที่สุด
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

// Loop
function loop(){
  if(!state.running) return;
  state.now = performance.now()/1000;

  tickMetronome(state.now);

  // Spawn notes a bit before their hit time
  while(state.idx < state.notes.length && state.notes[state.idx].t - state.now <= state.laneTimeAhead){
    const n = state.notes[state.idx];
    if(!n.el) n.el = makeNote(n.lane, n.t, n.label);
    state.idx++;
  }
  // Move & auto-judge miss
  const speed = 2.8 / state.laneTimeAhead; // z from ~2.8 -> 0
  const children = Array.from(root.children||[]);
  for(const el of children){
    if(!el.__hitTime) continue;
    const remain = el.__hitTime - state.now; // seconds left to hit
    const z = Math.max(0, remain * speed);   // linear towards ring plane (z=0)
    const pos = el.getAttribute('position');
    el.setAttribute('position', `${pos.x} ${pos.y} ${z.toFixed(3)}`);
    // miss if passed
    if(!el.__judged && remain < -state.hitWindow){
      miss(el);
    }
  }

  // End when all processed and no active notes
  const anyActive = children.some(c=>!c.__judged);
  if(state.idx >= state.notes.length && !anyActive){
    state.running=false;
    setHUD(`จบเพลง! คะแนน: ${state.score} • Best Combo: ${state.bestCombo}`);
    beep(1200,0.08,0.16); setScore();
    return;
  }
  state.raf = requestAnimationFrame(loop);
}

// Controls
btnStart && btnStart.addEventListener('click',()=>{ if(!state.running) startGame(); });
btnReset && btnReset.addEventListener('click',()=> resetGame());

window.addEventListener('keydown', (e)=>{
  const k=e.key.toLowerCase();
  if(k==='arrowup' || k==='w') manualHit('U');
  if(k==='arrowdown' || k==='s') manualHit('D');
  if(k==='arrowleft' || k==='a') manualHit('L');
  if(k==='arrowright' || k==='d') manualHit('R');
});

// Pause on tab hidden
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){ state.paused=true; cancelAnimationFrame(state.raf); setHUD("หยุดชั่วคราว"); }
  else if(state.running){ state.paused=false; setHUD("เล่นต่อ"); loop(); }
});

// Gaze fuse → นับเป็น hit เมื่อโฟกัส ring (ช่วยโหมด mobile/VR)
Object.entries(rings).forEach(([lane, el])=>{
  if(!el) return;
  el.classList.add('btn');
  el.addEventListener('click', ()=> manualHit(lane));
});

// Init
(function init(){
  const modeSel=$("mode"), bpmSel=$("bpm"), themeSel=$("theme");
  const apply=()=>{ applyModeBpm(); skyTheme(themeSel.value); setHUD(`พร้อมเริ่ม • โหมด: ${modeSel.value} @ ${bpmSel.value} BPM`); };
  if(modeSel) modeSel.addEventListener('change', apply);
  if(bpmSel) bpmSel.addEventListener('change', apply);
  if(themeSel) themeSel.addEventListener('change', apply);
  apply(); setScore();
})();
