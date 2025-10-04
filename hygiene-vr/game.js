/* Hygiene Rhythm Game – Ultra-Lite Mobile Build
   จุดเด่น:
   - object pool สำหรับโน้ต (ลดการสร้าง/ลบ entity บ่อย)
   - อัปเดตตำแหน่งด้วย object3D.position (เร็วกว่า setAttribute)
   - เมโทรนอมใช้ animation loop ไม่อัปเดต material ทุกเฟรม
   - Throttle HUD/Beat Counter บนมือถือ
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
  mapNotes:[],            // schedule notes (time,lane) — we pop into pool when time near
  nextSpawnIdx:0,

  countdownEl:null,
  beatCounterEl:null,
  lastBeatIndex:-1,

  rafId:null,

  // throttling HUD
  lastHudTs:0,
  hudInterval: isMobile ? 250 : 120, // ms
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
  let child;
  if (lane==="wash"){ // วงกลม (เขียว)
    child = document.createElement("a-entity");
    child.setAttribute("geometry","primitive: circle; radius:0.18; segments:48");
    child.setAttribute("material","color:#22c55e; opacity:0.98; shader:flat");
    node.appendChild(child);
    // ขอบ
    const border = document.createElement("a-entity");
    border.setAttribute("geometry","primitive: ring; radiusInner:0.18; radiusOuter:0.205; segmentsTheta:48");
    border.setAttribute("material","color:#0b1220; opacity:0.5; shader:flat");
    node.appendChild(border);
  } else if (lane==="brush"){ // สี่เหลี่ยม (เหลือง)
    child = document.createElement("a-entity");
    child.setAttribute("geometry","primitive: box; width:0.34; height:0.34; depth:0.02");
    child.setAttribute("material","color:#eab308; opacity:0.98; shader:flat");
    node.appendChild(child);
    const border = document.createElement("a-entity");
    border.setAttribute("geometry","primitive: box; width:0.36; height:0.36; depth:0.005");
    border.setAttribute("material","color:#0b1220; opacity:0.5; shader:flat");
    node.appendChild(border);
  } else { // เพชร (แดง) box หมุน 45°
    child = document.createElement("a-entity");
    child.setAttribute("geometry","primitive: box; width:0.3; height:0.3; depth:0.02");
    child.setAttribute("material","color:#ef4444; opacity:0.98; shader:flat");
    child.setAttribute("rotation","0 0 45");
    node.appendChild(child);
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
    // เก็บประเภทเลนไว้
    e.dataset = { lane };
    root.appendChild(e);
    state.pool.push({el:e, inUse:false, lane});
  }
}

// ขอโน้ตจากพูล (ตามเลน)
function acquireNote(lane){
  // หาในพูลที่ lane เดียวกันและว่าง
  for (const p of state.pool){
    if (!p.inUse && p.lane===lane){
      p.inUse = true;
      p.el.setAttribute("visible","true");
      return p;
    }
  }
  return null; // ถ้าหมด ก็ข้าม (จะไม่มีโน้ตเกินกำลัง)
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

  // แผงกดเลน (รับคลิก/fuse)
  const laneDefs = [
    {key:"wash",  x:-1.2, color:"#22c55e", label:"ล้างมือ"},
    {key:"brush", x: 0.0, color:"#eab308", label:"แปรงฟัน"},
    {key:"cover", x: 1.2, color:"#ef4444", label:"ปิดปาก"}
  ];
  // เส้น Hit
  const hit = document.createElement("a-entity");
  hit.setAttribute("geometry","primitive: plane; width:3.6; height:0.03");
  hit.setAttribute("material","color:#0ea5e9; opacity:0.9; shader:flat");
  hit.setAttribute("position","0 -0.25 0");
  // เมโทรนอม: ให้กระพริบด้วย animation (ไม่ต้องอัปเดตทุกเฟรม)
  hit.setAttribute("animation__pulse","property: material.opacity; dir: alternate; dur: 250; easing: easeInOutSine; from:0.55; to:0.95; loop:true");
  root.appendChild(hit);

  laneDefs.forEach(L=>{
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

  // เตรียมพูล (มือถือ: เล็กลง)
  const poolSize = isMobile ? 24 : 36;
  buildPool(poolSize);

  // ตั้งตารางโน้ต
  state.mapNotes = map.notes.slice(); // copy
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

  // Spawn ตามเวลา (ล่วงหน้าก่อนถึงเส้น ~2.5s)
  const lead = 2.2; // วินาทีที่ต้องใช้เดินทางจาก zStart = -lead*speedFactor ถึง 0
  while (state.nextSpawnIdx < state.mapNotes.length){
    const n = state.mapNotes[state.nextSpawnIdx];
    if (n.time - state.elapsed <= lead){
      // ขอจากพูล
      const p = acquireNote(n.lane);
      if (p){
        // ติดข้อมูล
        p.time = n.time;
        // ตั้งตำแหน่งเริ่ม (ไกลขึ้นถ้าช้าลง)
        const zStart = -lead * state.speedFactor;
        p.el.object3D.position.set( (n.lane==="wash"?-1.2: n.lane==="brush"?0:1.2), 0, zStart );
        p.lane = n.lane;
        p.judged = false;
        state.active.push(p);
      }
      state.nextSpawnIdx++;
    }else break;
  }

  // อัปเดต active (ตำแหน่ง/ตัดสิน miss)
  for (let i=0;i<state.active.length;i++){
    const p = state.active[i];
    if (!p || p.judged) continue;
    const dt = p.time - state.elapsed; // 0 ที่เส้น hit
    const z = dt * state.speedFactor;
    p.el.object3D.position.z = z;

    if (dt < -state.hitWindow && !p.judged){
      judge(p, "miss");
    }
  }

  // HUD throttle
  const ms = performance.now();
  if (ms - state.lastHudTs > state.hudInterval){
    state.lastHudTs = ms;
    const remain = Math.max(0, Math.ceil(state.duration - state.elapsed));
    hud.textContent = `เวลา: ${remain} วิ\nคะแนน: ${state.score}\nคอมโบ: x${state.combo}`;
  }

  // Beat counter เฉพาะ Training
  if (selectDiff.value === "training" && state.beatCounterEl){
    const idx = (Math.floor(state.elapsed / state.beatSec) % 4) + 1;
    if (idx !== state.lastBeatIndex){
      state.lastBeatIndex = idx;
      state.beatCounterEl.setAttribute("text", `value:${idx}; width:6; align:center; color:#0b1220`);
    }
  }

  // End
  if (state.elapsed >= state.duration){
    // คลียร์ที่ยังไม่ตัดสินให้ miss
    for (const p of state.active){ if (p && !p.judged) judge(p,"miss"); }
    finishGame();
    return;
  }

  state.rafId = requestAnimationFrame(tick);
}

// ---------------- Input & Judgement ----------------
function tryHit(lane){
  if (!state.running) return;
  // หา active ในเลนนั้นที่ใกล้ที่สุด
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

  // เอฟเฟกต์เบาๆ: scale โหนดทั้งก้อน (ไม่มี fade ชิ้นส่วน เพื่อลดงาน)
  try { p.el.setAttribute("animation__pop","property: scale; to: 1.25 1.25 1; dur: 80; dir: alternate; easing: easeOutQuad"); } catch(e){}

  // คืนพูลหลังดีเลย์สั้น ๆ
  setTimeout(()=>{
    if (p && p.el && p.el.parentNode) {
      releaseNote(p);
    }
  }, 120);
}

// ---------------- Buttons ----------------
btnStart.onclick = ()=>{ if(!state.running) startGame(); else finishGame(); };
btnReset.onclick = resetGame;

// Init
resetGame();
