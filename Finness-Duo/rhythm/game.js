/* Rhythm Stretch VR — Sections + Shapes/Colors + Timing Calibration
   - เลือก beats ต่อ section
   - ปรับรูปร่าง/สีของโน้ตตาม section
   - Timing calibration (ms): offset เมื่อเปรียบเทียบเวลา (ค่าบวก = เร่งตัดสิน)
   - รวมฟีเจอร์ก่อนหน้า: Multi-BPM, Speed Curve, Fever, Hidden, Perfect/Good/Miss
*/

const $ = id => document.getElementById(id);
const hudText = $("hudText"), hudScore = $("hudScore"), sky = $("sky"), root = $("root");
const btnStart = $("btnStart"), btnReset = $("btnReset");
const rings = { U: $("hitU"), D: $("hitD"), L: $("hitL"), R: $("hitR") };
["keyU","keyD","keyL","keyR"].forEach(id=>$(id)?.addEventListener('click',()=> manualHit(id.slice(-1).toUpperCase())));

const THEME_COLOR = { beach:"#002034", city:"#0f141a", galaxy:"#070022" };
function skyTheme(theme){ if(sky) sky.setAttribute('color', THEME_COLOR[theme]||"#0b1220"); }

const state = {
  running:false, paused:false,
  bpm:120, secPerBeat:0.5,
  mode:"training", theme:"beach",

  time0:0, now:0, raf:0, notes:[], idx:0,
  laneTimeAhead:4, scrollBase:2.8,

  useCurve:false, curveK:0.01,

  score:0, combo:0, bestCombo:0,
  hitWindow:0.18, perfectWindowRatio:0.5,
  stat:{perfect:0,good:0,miss:0},

  nextBeatT:0, metronomeOn:true,

  useMultiBpm:false, multiPattern:"rise",
  multiCount:3, multiDeltas:[0,20,30],
  beatsPerSection:16,

  // รูปทรง/สี per-section (วนซ้ำถ้าน้อยกว่าจำนวน section)
  secShapes:["sphere","box","sphere"],
  secColors:["#94a3ff","#86f7a5","#ffd683"],

  useFever:false, feverNeed:8, feverBeats:8, feverActive:false, feverUntil:0,

  useHidden:false, revealWindow:0.6,

  // timing calibration (ms)
  calibMs:0,

  actx:null, sfxGain:null, metroGain:null
};

// ------- Audio -------
function ensureAudio(){
  if(state.actx) return;
  const AC = window.AudioContext||window.webkitAudioContext; if(!AC) return;
  state.actx = new AC();
  state.sfxGain = state.actx.createGain(); state.sfxGain.gain.value=0.12; state.sfxGain.connect(state.actx.destination);
  state.metroGain= state.actx.createGain(); state.metroGain.gain.value=0.06; state.metroGain.connect(state.actx.destination);
}
function beep(freq=880, dur=0.05, gain=0.12, out){
  ensureAudio(); if(!state.actx) return;
  const o=state.actx.createOscillator(), g=state.actx.createGain();
  o.type="sine"; o.frequency.value=freq; o.connect(g); g.connect(out||state.sfxGain);
  const t=state.actx.currentTime;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.start(t); o.stop(t+dur+0.01);
}
let beatLoopCount=0;
function metronomeTick(bc){ if(!state.metronomeOn) return; const f=(bc%4===0)?1200:880; beep(f,0.04, state.feverActive?0.12:0.08, state.metroGain); }

// ------- HUD -------
function setHUD(m){ if(hudText) hudText.textContent=m; }
function setScore(){
  if(hudScore){
    const mul = state.feverActive ? " x2 Fever" : "";
    hudScore.textContent = `คะแนน: ${state.score}${mul} • Combo: ${state.combo} | P:${state.stat.perfect} G:${state.stat.good} M:${state.stat.miss}`;
  }
}
function clearNodes(){ while(root.firstChild) root.removeChild(root.firstChild); }
function lanePos(l){ if(l==='U')return{x:0,y:0.7,z:0.05}; if(l==='D')return{x:0,y:-0.7,z:0.05}; if(l==='L')return{x:-1.2,y:0,z:0.05}; return{x:1.2,y:0,z:0.05}; }
function feedbackText(l, text, color="#fff"){
  const p=lanePos(l); const el=document.createElement('a-entity');
  el.setAttribute('text',`value:${text}; width:3.5; align:center; color:${color}`); el.setAttribute('position',`${p.x} ${p.y} ${p.z}`); el.setAttribute('scale','0.8 0.8 0.8');
  root.appendChild(el);
  try{
    el.setAttribute('animation__pop','property: scale; to: 1.2 1.2 1.2; dur: 90; dir: alternate; easing: easeOutBack');
    el.setAttribute('animation__up','property: position; to: '+`${p.x} ${p.y+0.25} ${p.z}`+'; dur: 360; easing: easeOutCubic');
    el.setAttribute('animation__fade','property: opacity; to: 0; dur: 380; delay:80; easing: linear');
  }catch(e){}
  setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, 420);
}

// ------- Read options -------
function parseList(str, fallback){
  const arr = (str||"").split(",").map(s=>s.trim()).filter(Boolean);
  return arr.length? arr : fallback.slice();
}
function readOptions(){
  const modeSel=$("mode"), bpmSel=$("bpm"), themeSel=$("theme");
  state.mode = modeSel?.value || "training";
  state.bpm  = parseInt(bpmSel?.value||"120",10);
  state.secPerBeat = 60/state.bpm;

  // timing windows + calibration
  const goodMs = parseInt(($("goodMs")?.value)||"180",10);
  state.hitWindow = Math.max(0.08, Math.min(0.30, goodMs/1000));
  state.perfectWindowRatio = Math.max(0.3, Math.min(0.9, parseFloat(($("perfectRatio")?.value)||"0.5")));
  if(state.mode==="training"){ state.perfectWindowRatio=Math.max(state.perfectWindowRatio, 0.5); }
  state.calibMs = parseInt(($("calibMs")?.value)||"0",10) || 0;

  state.theme = themeSel?.value || "beach";

  // Multi-BPM + sections
  state.useMultiBpm = $("optMultiBpm")?.checked || false;
  state.multiPattern= $("multiPattern")?.value || "rise";
  state.multiCount  = Math.max(1, Math.min(8, parseInt(($("multiCount")?.value)||"3",10)));
  state.multiDeltas = parseList($("multiDeltas")?.value, [0,20,30]).map(v=>parseInt(v,10)).map(v=>isNaN(v)?0:v);
  if(state.multiDeltas.length < state.multiCount){ while(state.multiDeltas.length < state.multiCount) state.multiDeltas.push(state.multiDeltas[state.multiDeltas.length-1]||0); }
  if(state.multiDeltas.length > state.multiCount){ state.multiDeltas = state.multiDeltas.slice(0, state.multiCount); }
  state.beatsPerSection = Math.max(8, Math.min(64, parseInt(($("beatsPerSec")?.value)||"16",10)));

  // per-section shape/color
  state.secShapes = parseList($("secShapes")?.value, ["sphere","box","sphere"]);
  state.secColors = parseList($("secColors")?.value, ["#94a3ff","#86f7a5","#ffd683"]);

  // curve / fever / hidden
  state.useCurve = $("optSpeedCurve")?.checked || false;
  state.curveK   = parseFloat(($("curveK")?.value)||"0.00");

  state.useFever = $("optFever")?.checked || false;
  state.feverNeed= parseInt(($("feverNeed")?.value)||"8",10);
  state.feverBeats = Math.max(4, Math.min(32, parseInt(($("feverBeats")?.value)||"8",10)));

  state.useHidden = $("optHidden")?.checked || false;
}

// ------- Sections (Multi-BPM) -------
function buildSections(){
  const base = state.bpm;
  if(!state.useMultiBpm) return [{ bpm: base, beats: (state.mode==="training"? 32 : 48), secIdx:0 }];
  const secs=[];
  for(let i=0;i<state.multiCount;i++){
    const d = state.multiDeltas[i]||0;
    const sBpm = (state.multiPattern==="wave" && i%2===1) ? base - Math.abs(d) : base + d;
    secs.push({ bpm: sBpm, beats: state.beatsPerSection, secIdx:i });
  }
  return secs;
}

// ------- Note geometry by shape keyword -------
function applyShape(el, shape){
  switch((shape||"sphere").toLowerCase()){
    case "box":       el.setAttribute('geometry','primitive: box; width:0.28; height:0.28; depth:0.28'); break;
    case "cone":      el.setAttribute('geometry','primitive: cone; radiusBottom:0.18; radiusTop:0.02; height:0.32; segmentsRadial:16'); break;
    case "cylinder":  el.setAttribute('geometry','primitive: cylinder; radius:0.16; height:0.28; segmentsRadial:18'); break;
    case "torus":     el.setAttribute('geometry','primitive: torus; radius:0.22; radiusTubular:0.04; segmentsRadial:16; segmentsTubular:24'); break;
    case "dodeca":    el.setAttribute('geometry','primitive: dodecahedron; radius:0.18'); break;
    default:          el.setAttribute('geometry','primitive: sphere; radius:0.14; segmentsWidth:16; segmentsHeight:12');
  }
}

// ------- Make/Schedule notes -------
function makeNote(lane, time, label, secIdx){
  const el=document.createElement('a-entity'); el.classList.add('note');
  applyShape(el, state.secShapes[secIdx % state.secShapes.length]);
  const color = state.secColors[secIdx % state.secColors.length] || '#ffd683';
  const op = state.useHidden ? 0.12 : 0.98;
  el.setAttribute('material',`color:${color}; opacity:${op}; shader:flat`);

  const p = lane==='U' ? [0,  0.7, state.scrollBase] :
            lane==='D' ? [0, -0.7, state.scrollBase] :
            lane==='L' ? [-1.2, 0, state.scrollBase] : [1.2, 0, state.scrollBase];
  el.setAttribute('position', `${p[0]} ${p[1]} ${p[2]}`);

  if(state.mode==="training" && label){
    const t=document.createElement('a-entity'); t.setAttribute('text',`value:${label}; width:2; align:center; color:#001`); t.setAttribute('position','0 0 0.16'); el.appendChild(t);
  }
  el.__lane=lane; el.__hitTime=time; el.__hit=false; el.__judged=false; el.__secIdx=secIdx;
  root.appendChild(el); return el;
}

function scheduleNotes(){
  state.notes=[]; state.idx=0;
  const secs = buildSections();
  let t = state.time0 + 2.0;                    // 2s countdown
  const every = (state.mode==="training")? 2 : 1;
  const order = ['U','D','L','R']; let step=0;

  for(const sec of secs){
    const spb = 60/sec.bpm;
    for(let b=0; b<sec.beats; b+=every){
      const lane = order[(step++)%4];
      const label = (state.mode==="training") ? String((step-1)%4+1) : "";
      const hitT = t + b*spb;
      state.notes.push({ lane, t: hitT, el:null, label, secIdx: sec.secIdx });
    }
    t += sec.beats * spb;
  }
}

// ------- Fever -------
function maybeEnterFever(){
  if(!state.useFever || state.feverActive) return;
  if(state.combo >= state.feverNeed){
    state.feverActive = true;
    const spb = state.secPerBeat;
    state.feverUntil = state.now + state.feverBeats * spb;
    try{ sky.setAttribute('animation__fev','property: color; to: #013a2c; dir: alternate; loop: true; dur: 240'); }catch(e){}
  }
}
function updateFever(){
  if(!state.feverActive) return;
  if(state.now >= state.feverUntil){
    state.feverActive=false; try{ sky.removeAttribute('animation__fev'); skyTheme(state.theme); }catch(e){}
  }
}

// ------- Judge -------
function judgeCategory(dt){
  const perfectWin = state.hitWindow * state.perfectWindowRatio;
  if(dt <= perfectWin) return "perfect";
  if(dt <= state.hitWindow) return "good";
  return "miss";
}
function flashRing(l, strength=0.8){
  const r=rings[l]; if(!r) return;
  try{ r.setAttribute("animation__flash",`property: material.opacity; from:0.95; to:${Math.min(1.0,0.95+0.25*strength)}; dur:90; dir:alternate`);}catch(e){}
}
function fadeOut(el){
  try{ el.setAttribute("animation__fade","property: material.opacity; to:0; dur:120; easing:easeOutQuad"); setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, 140); }
  catch(e){ if(el.parentNode) el.parentNode.removeChild(el); }
}

function judge(note, lane){
  if(note.__judged) return;
  // timing calibration: เปรียบเทียบกับ (now + calib)
  const nowAdj = state.now + state.calibMs/1000;
  const dt = Math.abs(note.__hitTime - nowAdj);
  const cat = judgeCategory(dt);
  if(cat==="miss") return;

  note.__judged=true; note.__hit=true;
  const base = (cat==="perfect")? 300 : 150;
  const mul = state.feverActive? 2 : 1;
  state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo);
  state.score += base*mul; state.stat[cat]++;
  setScore();
  beep(cat==="perfect"?1000:780,0.06,0.12);
  flashRing(lane, cat==="perfect"?1.0:0.7);
  feedbackText(lane, (state.feverActive?"★ ":"") + (cat==="perfect"?"Perfect":"Good"), cat==="perfect"?"#7dfcc6":"#a7f3d0");
  maybeEnterFever();

  try{ note.setAttribute("animation__pop","property: scale; to: 1.4 1.4 1.4; dur: 90; dir: alternate"); }catch(e){}
  setTimeout(()=>{ if(note.parentNode) note.parentNode.removeChild(note); },110);
}
function miss(note){
  if(note.__judged) return;
  note.__judged=true; note.__hit=false;
  state.combo=0; state.stat.miss++; setScore();
  beep(240,0.06,0.12); feedbackText(note.__lane,"Miss","#ff9ea0");
  fadeOut(note);
}

// ------- Manual input -------
function manualHit(l){
  const nowAdj = state.now + state.calibMs/1000;
  let best=null, bestDt=999;
  for(const n of state.notes){
    if(n.el && !n.el.__judged && n.lane===l){
      const dt = Math.abs(n.el.__hitTime - nowAdj);
      if(dt<bestDt){ best=n.el; bestDt=dt; }
    }
  }
  if(best) judge(best, l);
}

// ------- Loop -------
function tickMetronome(now){
  const spb=state.secPerBeat;
  while(now >= state.nextBeatT){ metronomeTick(beatLoopCount); beatLoopCount++; state.nextBeatT += spb; }
}
function loop(){
  if(!state.running) return;
  state.now = performance.now()/1000;

  tickMetronome(state.now);
  updateFever();

  while(state.idx < state.notes.length && state.notes[state.idx].t - state.now <= state.laneTimeAhead){
    const n=state.notes[state.idx]; if(!n.el) n.el = makeNote(n.lane, n.t, n.label, n.secIdx); state.idx++;
  }

  const elapsed = state.now - state.time0;
  const curveFactor = state.useCurve ? Math.max(1, 1 + state.curveK * elapsed) : 1;
  const speed = (state.scrollBase / state.laneTimeAhead) * curveFactor;

  const children = Array.from(root.children||[]);
  for(const el of children){
    if(!el.__hitTime) continue;
    const remain = el.__hitTime - state.now;

    if(state.useHidden){
      const m = el.getAttribute('material');
      if(remain <= state.revealWindow && m && m.opacity < 0.98){
        try{ el.setAttribute('material', m.color ? `color:${m.color}; opacity:0.98; shader:flat` : 'opacity:0.98; shader:flat'); }catch(e){}
      }
    }
    const z = Math.max(0, remain*speed); const pos = el.getAttribute('position');
    el.setAttribute('position', `${pos.x} ${pos.y} ${z.toFixed(3)}`);

    if(!el.__judged && remain < -state.hitWindow){ miss(el); }
  }

  const anyActive = children.some(c=>!c.__judged);
  if(state.idx>=state.notes.length && !anyActive){
    state.running=false; setHUD(`จบเพลง! คะแนน: ${state.score}${state.feverActive?' (Fever)':''} • Best Combo: ${state.bestCombo} • P:${state.stat.perfect} G:${state.stat.good} M:${state.stat.miss}`);
    beep(1200,0.08,0.16); setScore(); state.feverActive=false; try{ sky.removeAttribute('animation__fev'); skyTheme(state.theme); }catch(e){}
    return;
  }
  state.raf = requestAnimationFrame(loop);
}

// ------- Start/Reset -------
function startGame(){
  ensureAudio(); state.running=true; state.paused=false;
  readOptions(); skyTheme(state.theme);
  state.time0=performance.now()/1000;
  state.score=0; state.combo=0; state.bestCombo=0; state.stat={perfect:0,good:0,miss:0};
  clearNodes(); scheduleNotes();
  state.nextBeatT=state.time0; beatLoopCount=0;
  setHUD(`เริ่ม! ${state.mode} • BPM ${state.bpm}${state.useMultiBpm?' (Multi-BPM)':''} • beats/section ${state.beatsPerSection} • calib ${state.calibMs}ms`);
  setScore(); loop();
}
function resetGame(){
  state.running=false; state.paused=false; cancelAnimationFrame(state.raf);
  state.feverActive=false; try{ sky.removeAttribute('animation__fev'); }catch(e){}
  clearNodes(); setHUD("พร้อมเริ่ม"); state.score=0; state.combo=0; state.stat={perfect:0,good:0,miss:0}; setScore();
}

// ------- Controls -------
btnStart?.addEventListener('click',()=>{ if(!state.running) startGame(); });
btnReset?.addEventListener('click',()=> resetGame());
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(k==='arrowup'||k==='w') manualHit('U');
  if(k==='arrowdown'||k==='s') manualHit('D');
  if(k==='arrowleft'||k==='a') manualHit('L');
  if(k==='arrowright'||k==='d') manualHit('R');
});
document.addEventListener('visibilitychange', ()=>{ if(document.hidden){ state.paused=true; cancelAnimationFrame(state.raf); setHUD("หยุดชั่วคราว"); } else if(state.running){ state.paused=false; setHUD("เล่นต่อ"); loop(); }});
Object.entries(rings).forEach(([l,el])=>{ el?.classList.add('btn'); el?.addEventListener('click',()=> manualHit(l)); });

// ------- Init -------
(function init(){
  const apply=()=>{ readOptions(); skyTheme(state.theme); setHUD(`พร้อมเริ่ม • โหมด: ${state.mode} @ ${state.bpm} BPM`); };
  ["mode","bpm","theme","optMultiBpm","multiPattern","multiCount","multiDeltas","beatsPerSec",
   "secShapes","secColors","optSpeedCurve","curveK","optFever","feverNeed","feverBeats","optHidden",
   "goodMs","perfectRatio","calibMs"]
    .forEach(id=>$(id)?.addEventListener('input',apply));
  ["optMultiBpm","optSpeedCurve","optFever","optHidden"].forEach(id=>$(id)?.addEventListener('change',apply));
  apply(); setScore();
})();
