/* Hygiene Rhythm Game – Readable Notes Edition
   - เลน = 3 แบบ: wash(วงกลม🧼) / brush(สี่เหลี่ยม🪥) / cover(สามเหลี่ยม🤧)
   - ป้ายไอคอนเหนือเลน + Legend กลางจอ
   - Countdown 3-2-1-Go + เส้น Hit กระพริบตาม BPM (เมโทรนอม)
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
  hitWindow: 0.35,  // วินาทีที่นับว่าโดน (±)
  score: 0,
  combo: 0,
  maxCombo: 0,
  notes: [],
  lanes: {},
  feedbackTimer: null,
  rafId: null,
  duration: 60,
  hitLine: null,
  legend: null,
  countdownEl: null
};

// ---------- Beat Map ----------
const BEATMAPS = {
  easy:   { bpm: 80,  duration: 40, notes: makePattern(80,  40, true) },
  normal: { bpm: 100, duration: 60, notes: makePattern(100, 60, true) },
  hard:   { bpm: 120, duration: 60, notes: makePattern(120, 60, false, true) }
};

/* สร้างแพทเทิร์นอย่างง่าย:
   every beat สลับเลน A→B→C; hard มีโน้ตคั่นครึ่งบีท
*/
function makePattern(bpm, duration, warmup=false, hard=false) {
  const beat = 60/bpm;
  const notes = [];
  const order = ["wash","brush","cover"];
  let i=0;
  const start = warmup? beat*2 : beat; // เผื่อเวลานับถอยหลัง
  for (let t=start; t<duration; t+=beat) {
    const lane = order[i%order.length];
    notes.push(makeNote(t, lane));
    if (hard && i%5===2) notes.push(makeNote(t+beat/2, order[(i+1)%3]));
    i++;
  }
  return notes;
}

function makeNote(time, lane){
  return { time, lane, z0:-4, z: -4, judged:false, el:null };
}

// ---------- สร้างฉาก ----------
function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

function buildScene(){
  clearChildren(root);
  state.lanes = {};
  // Legend กลางบน: ไอคอน + คำอธิบาย
  const legend = document.createElement("a-entity");
  legend.setAttribute("position","0 0.8 0");
  const legendBg = document.createElement("a-plane");
  legendBg.setAttribute("width","3.4");
  legendBg.setAttribute("height","0.35");
  legendBg.setAttribute("material","color:#ffffff; opacity:0.9; shader:flat");
  legend.appendChild(legendBg);
  const legendText = document.createElement("a-entity");
  legendText.setAttribute("text","value:🧼 วงกลม=ล้างมือ   🪥 สี่เหลี่ยม=แปรงฟัน   🤧 สามเหลี่ยม=ปิดปาก; width:6.5; align:center; color:#0b1220");
  legendText.setAttribute("position","0 0 0.02");
  legend.appendChild(legendText);
  root.appendChild(legend);
  state.legend = legend;

  // เส้น Hit line + เมโทรนอม
  const hit = document.createElement("a-plane");
  hit.setAttribute("width","3.6");
  hit.setAttribute("height","0.03");
  hit.setAttribute("material","color:#0ea5e9; opacity:0.95; shader:flat");
  hit.setAttribute("position","0 -0.25 0");
  root.appendChild(hit);
  state.hitLine = hit;

  // 3 เลน: ป้ายไอคอนใหญ่ด้านบน + ปุ่มเลนด้านล่าง
  const lanes = [
    {key:"wash",  x:-1.2, color:"#22c55e", label:"🧼 ล้างมือ", icon:"🧼"},
    {key:"brush", x: 0.0, color:"#eab308", label:"🪥 แปรงฟัน", icon:"🪥"},
    {key:"cover", x: 1.2, color:"#ef4444", label:"🤧 ปิดปาก", icon:"🤧"}
  ];

  lanes.forEach(l=>{
    const lane = document.createElement("a-entity");
    lane.setAttribute("position", `${l.x} 0 0`);

    // ป้ายไอคอนใหญ่อยู่เหนือเลน
    const laneIconBg = document.createElement("a-plane");
    laneIconBg.setAttribute("width","0.9");
    laneIconBg.setAttribute("height","0.35");
    laneIconBg.setAttribute("material","color:#ffffff; opacity:0.95; shader:flat");
    laneIconBg.setAttribute("position","0 0.45 0");
    lane.appendChild(laneIconBg);

    const laneIcon = document.createElement("a-entity");
    laneIcon.setAttribute("text", `value:${l.icon}; width:3.0; align:center; color:#0b1220`);
    laneIcon.setAttribute("position","0 0.45 0.02");
    lane.appendChild(laneIcon);

    // แผงเลือก (รับคลิก/fuse) ด้านล่าง
    const panel = document.createElement("a-plane");
    panel.classList.add("selectable");
    panel.setAttribute("width","1.0");
    panel.setAttribute("height","0.5");
    panel.setAttribute("material", `color:${l.color}; opacity:0.85; shader:flat`);
    panel.setAttribute("position", `0 -0.55 0`);
    lane.appendChild(panel);

    const txt = document.createElement("a-entity");
    txt.setAttribute("text", `value:${l.label}; width:4.0; align:center; color:#0b1220`);
    txt.setAttribute("position", `0 -0.55 0.02`);
    lane.appendChild(txt);

    panel.addEventListener("click", ()=> tryHit(l.key));

    root.appendChild(lane);
    state.lanes[l.key] = lane;
  });

  // Countdown element
  const cd = document.createElement("a-entity");
  cd.setAttribute("position","0 0.3 0.01");
  cd.setAttribute("text","value: ; width:4.5; align:center; color:#0b1220");
  root.appendChild(cd);
  state.countdownEl = cd;
}

function spawnNotes(map){
  map.notes.forEach(n=>{
    const note = makeNoteEntity(n.lane);
    const x = n.lane==="wash" ? -1.2 : n.lane==="brush" ? 0.0 : 1.2;
    note.setAttribute("position", `${x} 0 ${n.z0}`);
    n.el = note;
    root.appendChild(note);
    state.notes.push(n);
  });
}

function makeNoteEntity(lane){
  // รูปร่างต่างกัน: wash=circle, brush=box, cover=triangle (ใช้ plane + text)
  const node = document.createElement("a-entity");
  let shape;
  if (lane==="wash") {
    shape = document.createElement("a-circle");
    shape.setAttribute("radius","0.16");
  } else if (lane==="brush") {
    shape = document.createElement("a-box");
    shape.setAttribute("depth","0.02");
    shape.setAttribute("height","0.30");
    shape.setAttribute("width","0.30");
  } else {
    // สามเหลี่ยม: ใช้ a-triangle (มีใน A-Frame geometry)
    shape = document.createElement("a-triangle");
    shape.setAttribute("vertex-a","0 0.18 0");
    shape.setAttribute("vertex-b","-0.18 -0.18 0");
    shape.setAttribute("vertex-c","0.18 -0.18 0");
  }
  const color = lane==="wash" ? "#22c55e" : lane==="brush" ? "#f59e0b" : "#ef4444";
  shape.setAttribute("material", `color:${color}; opacity:0.95; shader:flat`);
  node.appendChild(shape);

  // Emoji กลางโน้ต ให้บอกความหมายชัด ๆ
  const em = document.createElement("a-entity");
  const emoji = lane==="wash" ? "🧼" : lane==="brush" ? "🪥" : "🤧";
  em.setAttribute("text", `value:${emoji}; width:2.2; align:center; color:#0b1220`);
  em.setAttribute("position","0 0 0.02");
  node.appendChild(em);

  return node;
}

// ---------- เกมเพลย์ ----------
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

  // นับถอยหลังก่อนเริ่มจริงเล็กน้อย (แสดงเลขบนจอ)
  runCountdown(3, ()=> {
    // เริ่ม loop
    if (state.rafId) cancelAnimationFrame(state.rafId);
    tick();
  });
}

function runCountdown(sec, onDone){
  let t = sec;
  const step = ()=>{
    if (!state.countdownEl) return;
    if (t>0) {
      state.countdownEl.setAttribute("text", `value:${t}`);
      t--;
      setTimeout(step, 700);
    } else {
      state.countdownEl.setAttribute("text", "value:Go!");
      setTimeout(()=> state.countdownEl.setAttribute("text","value: "), 400);
      if (onDone) onDone();
    }
  };
  step();
}

function resetGame(){
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  clearTimeout(state.feedbackTimer);
  fb.textContent = "";
  clearChildren(root);
  hud.textContent = "พร้อมเริ่ม";
}

function finishGame(){
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  clearTimeout(state.feedbackTimer);
  const stars = state.score >= 500 ? "⭐⭐⭐" : state.score >= 320 ? "⭐⭐" : "⭐";
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

  // เมโทรนอม: ให้เส้น hit กระพริบทุก beat
  const beatPhase = (state.elapsed % state.beatSec)/state.beatSec;
  if (state.hitLine) {
    const op = 0.7 + 0.25*Math.cos(beatPhase*2*Math.PI);
    state.hitLine.setAttribute("material", `color:#0ea5e9; opacity:${op}; shader:flat`);
  }

  // ขยับโน้ตให้ชนเส้น z=0 ตอนเวลา note.time
  for (const n of state.notes) {
    if (!n.el) continue;
    const dt = n.time - state.elapsed; // 0 = ถึงเส้น Hit
    const z = dt * 2.2; // ปรับความเร็วให้อ่านง่าย
    n.z = z;
    const x = n.lane==="wash" ? -1.2 : n.lane==="brush" ? 0.0 : 1.2;
    n.el.setAttribute("position", `${x} 0 ${z}`);

    // ผ่านเส้นเกินหน้าต่างเวลา → Miss อัตโนมัติ
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
  // หาโน้ตที่ใกล้เวลาในเลนนั้น
  let best = null, bestAbs = Infinity;
  for (const n of state.notes) {
    if (n.lane !== lane || n.judged) continue;
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

  // เอฟเฟกต์ Pop & Fade
  if (note.el) {
    note.el.setAttribute("animation__pop","property: scale; to: 1.6 1.6 1; dur: 110; dir: alternate; easing: easeOutQuad");
    note.el.setAttribute("animation__fade","property: components.material.material.opacity; to: 0; dur: 180; easing: easeOutQuad");
    setTimeout(()=>{ if(note.el && note.el.parentNode){ note.el.parentNode.removeChild(note.el); } }, 200);
  }

  let add = 0, text = "", color = "";
  switch(type){
    case "perfect": add = 30; text="Perfect!"; color="#38bdf8"; state.combo++; break;
    case "great":   add = 20; text="Great!";   color:"#22c55e"; state.combo++; break;
    case "good":    add = 10; text="Good";     color="#eab308"; state.combo=0; break;
    default:        add = 0;  text="Miss";     color="#ef4444"; state.combo=0; break;
  }
  state.score += add + Math.max(0, state.combo-1)*2;
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  fb.innerHTML = `<span style="color:${color};font-weight:800;">${text}</span>`;
  clearTimeout(state.feedbackTimer);
  state.feedbackTimer = setTimeout(()=> fb.textContent="", 600);
}

// ---------- ปุ่ม ----------
btnStart.onclick = ()=> { if(!state.running) startGame(); else finishGame(); };
btnReset.onclick = resetGame;

// เริ่มต้น
resetGame();
