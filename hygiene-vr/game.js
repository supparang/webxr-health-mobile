/* Hygiene Rhythm Game – Ultra-Lite Mobile + Training + Desktop Click Patch
   - Object pool + object3D.position (เร็วบนมือถือ)
   - Training: BPM ช้า + เคาน์เตอร์ 1-2-3-4
   - ปุ่ม Start/Reset บนเดสก์ท็อปกดได้แน่นอน + คีย์ลัด Space / R
*/

const $ = (id)=>document.getElementById(id);
const hud = $("hudText");
const fb = $("feedback");
const btnStart = $("btnStart");
const btnReset = $("btnReset");
const selectDiff = $("difficulty");
const root = document.getElementById("root");

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ---------------- State ----------------
let state = {
  running:false,
  startTime:0,
  elapsed:0,
  bpm:100,
  beatSec:0.6,
  hitWindow:0.35,
  speedFactor:2.0,
  duration:60,

  score:0, combo:0, maxCombo:0,

  lanes:{},               // lane roots
  pool:[],                // pooled note entities
  active:[],              // active notes (objects holding ref to pooled entity)
  mapNotes:[],            // schedule notes (time,lane)
  nextSpawnIdx:0,

  countdownEl:null,
  beatCounterEl:null,
  lastBeatIndex:-1,

  rafId:null,

  lastHudTs:0,
  hudInterval: isMobile ? 250 : 120, // ms (throttle HUD)
};

// ---------------- Beatmaps ----------------
function makePattern(bpm, duration, warmup=false, hard=false, stepBeats=2){
  const beat = 60/bpm;
  const step = beat*stepBeats;
  const order = ["wash","brush","cover"];
  let tStart = warmup ? beat*2 : beat;
  let arr = [];
  let i=0;
  for(let t=tStart; t<duration; t+=step){
    arr.push({time:t, lane:order[i%3]});
    if(hard && i%4===2) arr.push({time: t+step/2, lane: order[(i+1)%3]});
    i++;
  }
  return arr;
}
const BEATMAPS = {
  training: { bpm:60,  duration:40, notes: makePattern(60,40,true,false,4), hitWindow:0.5, speed:1.2 },
  easy:     { bpm:80,  duration:40, notes: makePattern(80,40,true,false,2), hitWindow:0.38, speed:2.0 },
  normal:   { bpm:100, duration:60, notes: makePattern(100,60,true,false,2),hitWindow:0.35, speed:2.2 },
  hard:     { bpm:120, duration:60, notes: makePattern(120,60,false,true,2),hitWindow:0.30, speed:2.4 },
};

// ---------------- Helpers ----------------
function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

// สร้างรูปทรงโน้ตแบบเบาสุด
function createNoteMesh(lane){
  const node = document.createElement("a-entity");
  if (lane==="wash"){ // วงกลม (เขียว)
    const body = document.createElement("a-entity");
    body.setAttribute("geometry","primitive: circle; radius:0.18; segments:48");
    body.setAttribute("material","color:#22c55e; opacity:0.98; shader:flat");
    node.appendChild(body);
    const border = document.createElement("a-entity");
    border.setAttribute("geometry","primitive: ring; radiusInner:0.18; radiusOuter:0.205; segmentsTheta:48");
    border.setAttribute("material","color:#0b1220; opacity:0.5; shader:flat");
    node.appendChild(border);
  } else if (lane==="brush"){ // สี่เหลี่ยม (เหลือง)
    const body = document.createElement("a-entity");
    body.setAttribute("geometry","primitive: box; width:0.34; height:0.34; depth:0.02");
    body.setAttribute("material","color:#eab308; opacity:0.98; shader:flat");
    node.appendChild(body);
    const border = document.createElement("a-entity");
    border.setAttribute("geometry","primitive: box; width:0.36; height:0.36; depth:0.005");
    border.setAttribute("material","color:#0b1220; opacity:0.5; shader:flat");
    node.appendChild(border);
  } else { // เพชร (แดง) = box หมุน 45°
    const body = document.createElement("a-entity");
    body.setAttribute("geometry","primitive: box; width:0.3; height:0.3; depth:0.02");
    body.setAttribute("material","color:#ef4444; opacity:0.98; shader:flat");
    body.setAttribute("rotation","0 0 45");
    node.appendChild(body);
    const border = document.createElement("a-entity");
    border.setAttribute("geometry","primitive: box; width:0.32; height:0.32; depth:0.005");
    border.setAttribute("material","color:#0b1220; opacity:0.5; shader:flat");
    border.setAttribute("rotation","0 0 45");
    node.appendChild(border);
  }
  return node;
}

// พูลเอนทิตีโน้ตล่วงหน้า
function buildPool(poolSize){
  state.pool = [];
  const lanes = ["wash","brush","cover"];
  for(let i=0;i<poolSize;i++){
    const lane = lanes[i%3];
    const e = createNoteMesh(lane);
    e.object3D.position.set( (lane==="wash"?-1.2: lane==="brush"?0:1.2), 0, -10 );
    e.setAttribute("visible","false");
    e.dataset = { lane };
    root.appendChild(e);
    state.pool.push({el:e, inUse:false, lane});
  }
}

function acquireNote(lane){
  for (const p of state.pool){
    if (!p.inUse && p.lane===lane){
      p.inUse = true;
      p.el.setAttribute("visible","true");
      return p;
    }
  }
  return null;
}
function releaseNote(p){
  if (!p) return;
  p.inUse = false;
  p.el.setAttribute("visible","false");
  p.el.object3D.position.set( (p.lane==="wash"?-1.2: p.lane==="brush"?0:1.2), 0, -10 );
}

// ---------------- Scene ----------------
function buildScene(){
  clearChildren(root);
  state.lanes={};

  // เส้น Hit + pulse animation (ไม่อัปเดตทุกเฟรม)
  const hit = document.createElement("a-entity");
  hit.setAttribute("geometry","primitive: plane; width:3.6; height:0.03");
  hit.setAttribute("material","color:#0ea5e9; opacity:0.9; shader:flat");
  hit.setAttribute("position","0 -0.25 0");
  hit.setAttribute("animation__pulse","property: material.opacity; dir: alternate; dur: 250; easing: easeInOutSine; from:0.55; to:0.95; loop:true");
  root.appendChild(hit);

  // 3 lanes (ปุ่มกด)
  const defs = [
    {key:"wash",  x:-1.2, color:"#22c55e", label:"ล้างมือ"},
    {key:"brush", x: 0.0, color:"#eab308", label:"แปรงฟัน"},
    {key:"cover", x: 1.2, color:"#ef4444", label:"ปิดปาก"}
  ];
  defs.forEach(L=>{
    const lane = document.createElement("a-entity");
    lane.setAttribute("position", `${L.x} 0 0`);

    const panel = document.createElement("a-entity");
    panel.classList.add("selectable");
    panel.setAttribute("geometry","primitive: plane; width:1.0; height:0.5");
    panel.setAttribute("material", `color:${L.color}; opacity:0.88; shader:flat`);
    panel.setAttribute("position", `0 -0.55 0`);
    lane.appendChild(panel);

    const txt = document.createElement("a-entity");
    txt.setAttribute("text", `value:${L.label}; width:4.2; align:center; color:#0b1220`);
    txt.setAttribute("position", `0 -0.55 0.02`);
    lane.appendChild(txt);

    panel.addEventListener("click", ()=> tryHit(L.key));

    root.appendChild(lane);
    state.lanes[L.key] = lane;
  });

  // Countdown
  const cd = document.createElement("a-entity");
  cd.setAttribute("position","0 0.4 0.01");
  cd.setAttribute("text","value: ; width:5.2; align:center; color:#0b1220");
  root.appendChild(cd);
  state.countdownEl = cd;

  // Beat Counter (Training)
  const bc = document.createElement("a-entity");
  bc.setAttribute("position","0 0.75 0.01");
  bc.setAttribute("text","value: ; width:6; align:center; color:#0b1220");
  root.appendChild(bc);
  state.beatCounterEl = bc;
}

// ---------------- Game Flow ----------------
function startGame(){
  const diff = selectDiff.value;
  const map = BEATMAPS[diff];

  state.running = true;
  state.startTime = performance.now()/1000;
  state.elapsed = 0;

  state.bpm = map.bpm;
  state.beatSec = 60/state.bpm;
  state.duration = map.duration;
  state.hitWindow = map.hitWindow ?? 0.35;
  state.speedFactor = map.speed ?? 2.0;
  state.score = 0; state.combo=0; state.maxCombo=0;
  state.lastBeatIndex = -1;

  fb.textContent = "";
  hud.textContent = "เริ่มเพลง…";

  buildScene();

  // สร้างพูล (มือถือเล็กกว่า)
  const poolSize = isMobile ? 24 : 36;
  buildPool(poolSize);

  // ตารางโน้ต
  state.mapNotes = map.notes.slice();
  state.nextSpawnIdx = 0;
  state.active = [];

  runCountdown(3, ()=>{
    if (state.rafId) cancelAnimationFrame(state.rafId);
    tick();
  });
}

function runCountdown(sec, onDone){
  let t = sec;
  const step = ()=>{
    if (!state.countdownEl) return;
    state.countdownEl.setAttribute("text", `value:${t>0?t:"Go!"}; width:5.2; align:center; color:#0b1220`);
    if (t>0) setTimeout(()=>{ t--; step(); }, 700);
    else setTimeout(()=>{ state.countdownEl.setAttribute("text","value: "); onDone&&onDone(); }, 400);
  };
  step();
}

function resetGame(){
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  fb.textContent = "";
  clearChildren(root);
  hud.textContent = "พร้อมเริ่ม";
}

function finishGame(){
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  const stars = state.score >= 400 ? "⭐⭐⭐" : state.score >= 250 ? "⭐⭐" : "⭐";
  hud.textContent = `จบเพลง\nคะแนน: ${state.score}\nคอมโบสูงสุด: ${state.maxCombo}\n${stars}`;
}

// ---------------- Loop ----------------
function tick(){
  if (!state.running) return;
  const now = performance.now()/1000;
  state.elapsed = now - state.startTime;

  // Spawn ล่วงหน้า ~2.2 วิ
  const lead = 2.2;
  while (state.nextSpawnIdx < state.mapNotes.length){
    const n = state.mapNotes[state.nextSpawnIdx];
    if (n.time - state.elapsed <= lead){
      const p = acquireNote(n.lane);
      if (p){
        p.time = n.time;
        const zStart = -lead * state.speedFactor;
        p.el.object3D.position.set( (n.lane==="wash"?-1.2: n.lane==="brush"?0:1.2), 0, zStart );
        p.lane = n.lane;
        p.judged = false;
        state.active.push(p);
      }
      state.nextSpawnIdx++;
    } else break;
  }

  // Move & miss
  for (const p of state.active){
    if (!p || p.judged) continue;
    const dt = p.time - state.elapsed;     // 0 ที่เส้น hit
    p.el.object3D.position.z = dt * state.speedFactor;
    if (dt < -state.hitWindow && !p.judged) judge(p, "miss");
  }

  // HUD throttle
  const ms = performance.now();
  if (ms - state.lastHudTs > state.hudInterval){
    state.lastHudTs = ms;
    const remain = Math.max(0, Math.ceil(state.duration - state.elapsed));
    hud.textContent = `เวลา: ${remain} วิ\nคะแนน: ${state.score}\nคอมโบ: x${state.combo}`;
  }

  // Beat counter (เฉพาะ Training)
  if (selectDiff.value === "training" && state.beatCounterEl){
    const idx = (Math.floor(state.elapsed / state.beatSec) % 4) + 1;
    if (idx !== state.lastBeatIndex){
      state.lastBeatIndex = idx;
      state.beatCounterEl.setAttribute("text", `value:${idx}; width:6; align:center; color:#0b1220`);
    }
  }

  // End
  if (state.elapsed >= state.duration){
    for (const p of state.active){ if (p && !p.judged) judge(p,"miss"); }
    finishGame();
    return;
  }

  state.rafId = requestAnimationFrame(tick);
}

// ---------------- Input & Judgement ----------------
function tryHit(lane){
  if (!state.running) return;
  let best=null, bestAbs=Infinity;
  for (const p of state.active){
    if (!p || p.judged || p.lane!==lane) continue;
    const abs = Math.abs(p.time - state.elapsed);
    if (abs < bestAbs){ bestAbs = abs; best = p; }
  }
  if (!best) return;

  if (bestAbs <= state.hitWindow*0.35) judge(best,"perfect");
  else if (bestAbs <= state.hitWindow*0.65) judge(best,"great");
  else if (bestAbs <= state.hitWindow)      judge(best,"good");
  else                                      judge(best,"miss");
}

function judge(p, type){
  p.judged = true;

  // คะแนน
  let add=0, text="", color="";
  switch(type){
    case "perfect": add=30; text="Perfect!"; color="#38bdf8"; state.combo++; break;
    case "great":   add=20; text="Great!";   color="#22c55e"; state.combo++; break;
    case "good":    add=10; text="Good";     color="#eab308"; state.combo=0; break;
    default:        add=0;  text="Miss";     color="#ef4444"; state.combo=0; break;
  }
  state.score += add + Math.max(0, state.combo-1)*2;
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  fb.innerHTML = `<span style="color:${color};font-weight:800;">${text}</span>`;
  setTimeout(()=> fb.textContent="", 350);

  // pop เบา ๆ แล้วคืนพูล
  try { p.el.setAttribute("animation__pop","property: scale; to: 1.25 1.25 1; dur: 80; dir: alternate; easing: easeOutQuad"); } catch(e){}
  setTimeout(()=>{ releaseNote(p); }, 120);
}

// ---------------- Buttons & Shortcuts ----------------
btnStart.style.pointerEvents = 'auto';
btnReset.style.pointerEvents = 'auto';
btnStart.onclick = ()=>{ if(!state.running) startGame(); else finishGame(); };
btnReset.onclick = resetGame;

// คีย์ลัดบนเดสก์ท็อป: Space = Start/Finish, R = Reset
window.addEventListener('keydown', (e)=>{
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); if (!state.running) startGame(); else finishGame(); }
  if (k === 'r') { e.preventDefault(); resetGame(); }
});

// Init
resetGame();
