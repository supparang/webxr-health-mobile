/* Hygiene Rhythm Game – STABLE LITE
   - รูปทรงเสถียร: circle (wash), box (brush), box-rotated 45° (cover)
   - ไม่มี emoji/text บนโน้ต, ไม่มี burst ซับซ้อน -> กันค้าง
   - ลดโน้ต: ทุก 2 บีต, ลดงาน animation, ป้องกันการเรียกใช้ prop ที่ไม่มี
*/

const $ = (id) => document.getElementById(id);
const hud = $("hudText");
const fb = $("feedback");
const btnStart = $("btnStart");
const btnReset = $("btnReset");
const selectDiff = $("difficulty");
const root = document.getElementById("root");

let state = {
  running: false,
  startTime: 0,
  elapsed: 0,
  bpm: 100,
  beatSec: 0.6,
  hitWindow: 0.35,
  score: 0,
  combo: 0,
  maxCombo: 0,
  notes: [],
  lanes: {},
  rafId: null,
  duration: 60,
  hitLine: null,
  countdownEl: null
};

// ---------- Beat Map (ลดความถี่: ทุก 2 บีต) ----------
const BEATMAPS = {
  easy:   { bpm: 80,  duration: 40, notes: makePattern(80,  40, true, false, 2) },
  normal: { bpm: 100, duration: 60, notes: makePattern(100, 60, true, false, 2) },
  hard:   { bpm: 120, duration: 60, notes: makePattern(120, 60, false, true, 2) }
};

/* สร้างแพทเทิร์น:
   - warmup: เผื่อเวลาเริ่ม
   - hard: แทรกคั่นครึ่งบีตบางครั้ง (ยังคงจำกัดความถี่)
   - stepBeats: วางโน้ตทุก n บีต (ค่า 2 = ทุกสองบีต)
*/
function makePattern(bpm, duration, warmup=false, hard=false, stepBeats=2) {
  const beat = 60 / bpm;
  const step = beat * stepBeats;
  const notes = [];
  const order = ["wash","brush","cover"];
  let i=0;
  const start = warmup ? beat*2 : beat;
  for (let t = start; t < duration; t += step) {
    const lane = order[i % order.length];
    notes.push(makeNote(t, lane));
    if (hard && i % 4 === 2) {
      // แทรกอีกโน้ตเลนถัดไป ครึ่งสเต็ป (ยังช้า)
      notes.push(makeNote(t + step/2, order[(i+1)%3]));
    }
    i++;
  }
  return notes;
}
function makeNote(time, lane){ return { time, lane, z0:-4, z: -4, judged:false, el:null }; }

// ---------- Scene ----------
function clearChildren(el){ while (el.firstChild) el.removeChild(el.firstChild); }

function buildScene(){
  clearChildren(root);
  state.lanes = {};

  // เส้น Hit line (เมโทรนอม)
  const hit = document.createElement("a-entity");
  hit.setAttribute("geometry","primitive: plane; width: 3.6; height: 0.03");
  hit.setAttribute("material","color:#0ea5e9; opacity:0.95; shader:flat");
  hit.setAttribute("position","0 -0.25 0");
  root.appendChild(hit);
  state.hitLine = hit;

  // 3 lanes
  const lanes = [
    {key:"wash",  x:-1.2, color:"#22c55e", label:"ล้างมือ"},
    {key:"brush", x: 0.0, color:"#eab308", label:"แปรงฟัน"},
    {key:"cover", x: 1.2, color:"#ef4444", label:"ปิดปาก"}
  ];
  lanes.forEach(l=>{
    const lane = document.createElement("a-entity");
    lane.setAttribute("position", `${l.x} 0 0`);

    // ป้ายเลน (ปุ่มกด)
    const panel = document.createElement("a-entity");
    panel.classList.add("selectable");
    panel.setAttribute("geometry","primitive: plane; width: 1.0; height: 0.5");
    panel.setAttribute("material", `color:${l.color}; opacity:0.88; shader:flat`);
    panel.setAttribute("position", `0 -0.55 0`);
    lane.appendChild(panel);

    const txt = document.createElement("a-entity");
    txt.setAttribute("text", `value:${l.label}; width:4.2; align:center; color:#0b1220`);
    txt.setAttribute("position", `0 -0.55 0.02`);
    lane.appendChild(txt);

    panel.addEventListener("click", ()=> tryHit(l.key));

    root.appendChild(lane);
    state.lanes[l.key] = lane;
  });

  // Countdown
  const cd = document.createElement("a-entity");
  cd.setAttribute("position","0 0.3 0.01");
  cd.setAttribute("text","value: ; width:4.8; align:center; color:#0b1220");
  root.appendChild(cd);
  state.countdownEl = cd;
}

function spawnNotes(map){
  map.notes.forEach(n=>{
    const group = makeNoteEntity(n.lane);
    const x = n.lane==="wash" ? -1.2 : n.lane==="brush" ? 0.0 : 1.2;
    group.setAttribute("position", `${x} 0 ${n.z0}`);
    n.el = group;
    root.appendChild(group);
    state.notes.push(n);
  });
}

/* รูปร่างเสถียรสูง:
   wash  = circle (เขียว)
   brush = box (เหลือง)
   cover = box (แดง) + หมุน 45°
*/
function makeNoteEntity(lane){
  const node = document.createElement("a-entity");
  let color = "#22c55e";

  if (lane === "wash") {
    const circle = document.createElement("a-entity");
    circle.setAttribute("geometry","primitive: circle; radius: 0.18; segments: 48");
    circle.setAttribute("material","color:#22c55e; opacity:0.98; shader:flat");
    node.appendChild(circle);
  } else if (lane === "brush") {
    const box = document.createElement("a-entity");
    box.setAttribute("geometry","primitive: box; width: 0.34; height: 0.34; depth: 0.02");
    box.setAttribute("material","color:#eab308; opacity:0.98; shader:flat");
    node.appendChild(box);
    color = "#eab308";
  } else { // cover
    const diamond = document.createElement("a-entity");
    diamond.setAttribute("geometry","primitive: box; width: 0.3; height: 0.3; depth: 0.02");
    diamond.setAttribute("material","color:#ef4444; opacity:0.98; shader:flat");
    diamond.setAttribute("rotation","0 0 45");
    node.appendChild(diamond);
    color = "#ef4444";
  }

  // ขอบบางๆ (ปลอดภัย: plane ring/box อีกชั้น)
  const border = document.createElement("a-entity");
  if (lane === "wash") {
    border.setAttribute("geometry","primitive: ring; radiusInner: 0.18; radiusOuter: 0.205; segmentsTheta: 48");
  } else {
    border.setAttribute("geometry","primitive: box; width: 0.36; height: 0.36; depth: 0.005");
    if (lane === "cover") border.setAttribute("rotation","0 0 45");
  }
  border.setAttribute("material","color:#0b1220; opacity:0.5; shader:flat");
  node.appendChild(border);

  // เก็บอ้างอิงชิ้นส่วนที่มี material เพื่อ fade ได้ปลอดภัย
  node.__parts = { mats: [] };
  // วนเก็บลูกที่มี material
  Array.from(node.children).forEach(ch=>{
    if (ch.hasAttribute && ch.hasAttribute("material")) node.__parts.mats.push(ch);
  });

  return node;
}

// ---------- Game ----------
function startGame(){
  const diff = selectDiff.value;
  const map = BEATMAPS[diff];

  state.bpm = map.bpm;
  state.beatSec = 60/state.bpm;
  state.duration = map.duration;

  state.running = true;
  state.startTime = performance.now()/1000;
  state.elapsed = 0;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.notes = [];
  fb.textContent = "";
  hud.textContent = "เริ่มเพลง…";

  buildScene();
  spawnNotes(map);

  runCountdown(3, ()=> {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    tick();
  });
}

function runCountdown(sec, onDone){
  let t = sec;
  const step = ()=>{
    if (!state.countdownEl) return;
    state.countdownEl.setAttribute("text", `value:${t>0?t:"Go!"}; width:4.8; align:center; color:#0b1220`);
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
  hud.textContent =
    `จบเพลง\nคะแนน: ${state.score}\nคอมโบสูงสุด: ${state.maxCombo}\n${stars}`;
}

function tick(){
  if (!state.running) return;
  const now = performance.now()/1000;
  state.elapsed = now - state.startTime;

  // HUD
  const remain = Math.max(0, Math.ceil(state.duration - state.elapsed));
  hud.textContent = `เวลา: ${remain} วิ\nคะแนน: ${state.score}\nคอมโบ: x${state.combo}`;

  // Metronome: กระพริบเล็กน้อย (คำนวณเบา)
  if (state.hitLine) {
    const phase = (state.elapsed % state.beatSec) / state.beatSec;
    const op = 0.75 + 0.2 * (phase < 0.5 ? 1 : 0); // on/off ครึ่งบีต
    state.hitLine.setAttribute("material", `color:#0ea5e9; opacity:${op}; shader:flat`);
  }

  // Move notes
  for (const n of state.notes) {
    if (!n.el || n.judged) continue;
    const dt = n.time - state.elapsed;
    const z = dt * 2.0;      // ช้าลงอีกนิดให้อ่านง่าย/เบาเครื่อง
    const x = n.lane==="wash" ? -1.2 : n.lane==="brush" ? 0.0 : 1.2;
    n.el.setAttribute("position", `${x} 0 ${z}`);
    if (dt < -state.hitWindow && !n.judged) judge(n, "miss");
  }

  if (state.elapsed >= state.duration) {
    state.notes.forEach(n=>{ if(!n.judged) judge(n,"miss"); });
    finishGame();
    return;
  }

  state.rafId = requestAnimationFrame(tick);
}

function tryHit(lane){
  if (!state.running) return;
  let best = null, bestAbs = Infinity;
  for (const n of state.notes) {
    if (n.lane !== lane || n.judged || !n.el) continue;
    const abs = Math.abs(n.time - state.elapsed);
    if (abs < bestAbs) { bestAbs = abs; best = n; }
  }
  if (!best) return;

  if (bestAbs <= state.hitWindow*0.35) judge(best, "perfect");
  else if (bestAbs <= state.hitWindow*0.65) judge(best, "great");
  else if (bestAbs <= state.hitWindow)      judge(best, "good");
  else                                      judge(best, "miss");
}

function judge(note, type){
  note.judged = true;

  // คะแนน
  let add = 0, text = "", color = "";
  switch(type){
    case "perfect": add = 30; text="Perfect!"; color="#38bdf8"; state.combo++; break;
    case "great":   add = 20; text="Great!";   color="#22c55e"; state.combo++; break;
    case "good":    add = 10; text="Good";     color="#eab308"; state.combo=0; break;
    default:        add = 0;  text="Miss";     color="#ef4444"; state.combo=0; break;
  }
  state.score += add + Math.max(0, state.combo-1)*2;
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  fb.innerHTML = `<span style="color:${color};font-weight:800;">${text}</span>`;
  setTimeout(()=> fb.textContent="", 450);

  // เอฟเฟกต์เบาๆ: scale pop + fade mats
  const el = note.el;
  if (el && el.parentNode) {
    try { el.setAttribute("animation__pop","property: scale; to: 1.4 1.4 1; dur: 90; dir: alternate; easing: easeOutQuad"); } catch(e){}
    const mats = (el.__parts && el.__parts.mats) ? el.__parts.mats : [];
    mats.forEach((m,i)=>{
      try { m.setAttribute("animation__fade"+i, "property: material.opacity; to: 0; dur: 140; easing: easeOutQuad"); } catch(e){}
    });
    setTimeout(()=>{ if (el && el.parentNode) el.parentNode.removeChild(el); }, 160);
  }
}
