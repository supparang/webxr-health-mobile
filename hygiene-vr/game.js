/* Hygiene Rhythm Game (VR / A-Frame)
   - 3 เลน: wash (🧼), brush (🪥), cover (🤧)
   - เล่นด้วย gaze+fuse หรือคลิก
   - ไม่มีเสียง: ใช้ BPM/BeatMap ขยับโน้ตตามเวลา
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
  hitWindow: 0.35,  // วินาทีที่นับว่าโดน (±)
  score: 0,
  combo: 0,
  maxCombo: 0,
  notes: [],       // โหนดทั้งหมด
  lanes: {},       // lane panels
  feedbackTimer: null,
  timerId: null,
  duration: 60,    // ความยาวเพลง (วิ)
};

// ---------- Beat Map ----------
/* ออกแบบให้เล่นได้ทันที: โครงสร้าง 3 เลน
   time = วินาที (นับจากเริ่ม), lane = wash/brush/cover
*/
const BEATMAPS = {
  easy: {
    bpm: 80, duration: 40,
    notes: makePattern(80, 40, {wash:0.0, brush:1.0, cover:2.0}, 1.2)
  },
  normal: {
    bpm: 100, duration: 60,
    notes: makePattern(100, 60, {wash:0.0, brush:1.0, cover:2.0}, 1.0)
  },
  hard: {
    bpm: 120, duration: 60,
    notes: makePattern(120, 60, {wash:0.0, brush:1.0, cover:2.0}, 0.75, true)
  }
};

/* สร้างแพทเทิร์นโน้ตอย่างง่าย:
   - ทุก 1 beat สุ่มหนึ่งเลน หรือสลับลำดับแบบ A-B-C
   - spacingZ = ระยะเริ่มต้นของโน้ต (เมตร) เมื่อ time ยังไม่ถึง
   - hardMode = เพิ่มโน้ตซ้อน (syncopation) บางจุด
*/
function makePattern(bpm, duration, laneOffsets, spacingZ=1.0, hardMode=false) {
  const beatSec = 60/bpm;
  const notes = [];
  let order = ["wash","brush","cover"];
  let i = 0;
  for (let t=2*beatSec; t<duration; t+=beatSec) {
    const lane = order[i % order.length];
    notes.push({ time: t, lane, z0: -4.0, zHit: 0, z: -4.0, speed: (4.0)/(t) });
    if (hardMode && (i%6===3)) { // ใส่โน้ตคั่นครึ่งบีท
      notes.push({ time: t + beatSec/2, lane: order[(i+1)%3], z0: -4.0, zHit: 0, z: -4.0, speed: (4.0)/(t+beatSec/2) });
    }
    i++;
  }
  return notes;
}

// ---------- สร้างฉาก ----------
function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

function buildScene(){
  clearChildren(root);

  // เส้น Hit line
  const hitLine = document.createElement("a-plane");
  hitLine.setAttribute("width","3.6");
  hitLine.setAttribute("height","0.02");
  hitLine.setAttribute("material","color:#0ea5e9; opacity:0.95; shader:flat");
  hitLine.setAttribute("position","0 -0.25 0");
  root.appendChild(hitLine);

  // 3 เลน: wash / brush / cover
  const lanes = [
    {key:"wash",  x:-1.2, color:"#16a34a", label:"🧼 ล้างมือ"},
    {key:"brush", x: 0.0, color:"#eab308", label:"🪥 แปรงฟัน"},
    {key:"cover", x: 1.2, color:"#ef4444", label:"🤧 ปิดปาก"}
  ];

  lanes.forEach(l=>{
    const lane = document.createElement("a-entity");
    lane.setAttribute("position", `${l.x} 0 0`);

    // แผงเลือก (รับคลิก/fuse)
    const panel = document.createElement("a-plane");
    panel.classList.add("selectable");
    panel.setAttribute("width","1.0");
    panel.setAttribute("height","0.5");
    panel.setAttribute("material", `color:${l.color}; opacity:0.85; shader:flat`);
    panel.setAttribute("position", `0 -0.55 0`);
    lane.appendChild(panel);

    // ป้ายชื่อเลน
    const txt = document.createElement("a-entity");
    txt.setAttribute("text", `value:${l.label}; width:4.0; align:center; color:#0b1220`);
    txt.setAttribute("position", `0 -0.55 0.02`);
    lane.appendChild(txt);

    // เมื่อกดที่เลน = พยายาม Hit
    panel.addEventListener("click", ()=> tryHit(l.key));

    root.appendChild(lane);
    state.lanes[l.key] = lane;
  });
}

function spawnNotes(map){
  // โน้ตเป็นทรงกระบอกกลม ๆ
  map.notes.forEach(n=>{
    const note = document.createElement("a-circle");
    const color = n.lane==="wash" ? "#22c55e" : n.lane==="brush" ? "#f59e0b" : "#ef4444";
    note.setAttribute("radius","0.13");
    note.setAttribute("material", `color:${color}; opacity:0.95; shader:flat`);
    const x = n.lane==="wash" ? -1.2 : n.lane==="brush" ? 0.0 : 1.2;
    note.setAttribute("position", `${x} 0 ${n.z0}`);
    note.dataset.time = n.time.toString();
    note.dataset.lane = n.lane;
    n.el = note;
    root.appendChild(note);
    state.notes.push(n);
  });
}

// ---------- เกมเพลย์ ----------
function startGame(){
  const diff = selectDiff.value;
  const map = BEATMAPS[diff];
  state.bpm = map.bpm;
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

  if (state.timerId) { cancelAnimationFrame(state.timerId); }
  tick();
}

function resetGame(){
  state.running = false;
  clearTimeout(state.feedbackTimer);
  fb.textContent = "";
  clearChildren(root);
  hud.textContent = "พร้อมเริ่ม";
}

function finishGame(){
  state.running = false;
  clearTimeout(state.feedbackTimer);
  const stars = state.score >= 400 ? "⭐⭐⭐" : state.score >= 250 ? "⭐⭐" : "⭐";
  hud.textContent =
    `จบเพลง\nคะแนน: ${state.score}\nคอมโบสูงสุด: ${state.maxCombo}\n${stars}`;
}

function tick(){
  if (!state.running) return;
  const now = performance.now()/1000;
  state.elapsed = now - state.startTime;

  // อัปเดต HUD เวลา
  const remain = Math.max(0, Math.ceil(state.duration - state.elapsed));
  hud.textContent = `เวลา: ${remain} วิ\nคะแนน: ${state.score}\nคอมโบ: x${state.combo}`;

  // ขยับโน้ต: ให้ชนเส้น z=0 ตอนเวลา note.time
  for (const n of state.notes) {
    if (!n.el) continue;
    const tToHit = n.time - state.elapsed; // ถ้าศูนย์ => อยู่ที่เส้น
    const z = tToHit * 2.0; // scale ความเร็ว (เมตร/วิ) ให้พอดู
    n.z = z;
    // อัปเดตตำแหน่ง
    const x = n.lane==="wash" ? -1.2 : n.lane==="brush" ? 0.0 : 1.2;
    n.el.setAttribute("position", `${x} 0 ${z}`);

    // เลยเส้นไปนานแล้ว = Miss อัตโนมัติ
    if (tToHit < -state.hitWindow && !n.judged) {
      judge(n, "miss");
    }
  }

  // หมดเวลาเพลง → จบเกม
  if (state.elapsed >= state.duration) {
    // ให้โน้ตที่ยังไม่ตัดสินเป็น miss
    state.notes.forEach(n=>{ if(!n.judged) judge(n,"miss"); });
    finishGame();
    return;
  }

  state.timerId = requestAnimationFrame(tick);
}

function tryHit(lane){
  if (!state.running) return;
  // หาโน้ตในเลนนั้นที่ใกล้เวลา (|Δt| ต่ำสุด และยังไม่ถูกตัดสิน)
  let best = null, bestAbs = Infinity;
  for (const n of state.notes) {
    if (n.lane !== lane || n.judged) continue;
    const dt = n.time - state.elapsed;
    const abs = Math.abs(dt);
    if (abs < bestAbs) { bestAbs = abs; best = n; }
  }
  if (!best) return;

  // ตัดสินตามหน้าต่างเวลา
  if (bestAbs <= state.hitWindow*0.35) judge(best, "perfect");
  else if (bestAbs <= state.hitWindow*0.65) judge(best, "great");
  else if (bestAbs <= state.hitWindow) judge(best, "good");
  else judge(best, "miss");
}

function judge(note, type){
  note.judged = true;
  // เอฟเฟกต์หาย + ป๊อป
  if (note.el) {
    note.el.setAttribute("animation__pop","property: scale; to: 1.6 1.6 1; dur: 90; dir: alternate; easing: easeOutQuad");
    note.el.setAttribute("animation__fade","property: material.opacity; to: 0; dur: 140; easing: easeOutQuad");
    setTimeout(()=>{ if(note.el && note.el.parentNode){ note.el.parentNode.removeChild(note.el); } }, 160);
  }

  let add = 0, text = "", color = "";
  switch(type){
    case "perfect": add = 30; text="Perfect!"; color="#38bdf8"; state.combo++; break;
    case "great":   add = 20; text="Great!";   color="#22c55e"; state.combo++; break;
    case "good":    add = 10; text="Good";     color="#eab308"; state.combo=0; break;
    default:        add = 0;  text="Miss";     color="#ef4444"; state.combo=0; break;
  }
  state.score += add + Math.max(0, state.combo-1)*2; // โบนัสคอมโบเล็กน้อย
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  fb.innerHTML = `<span style="color:${color};font-weight:800;">${text}</span>`;
  clearTimeout(state.feedbackTimer);
  state.feedbackTimer = setTimeout(()=> fb.textContent="", 600);
}

// ---------- ปุ่มควบคุม ----------
btnStart.onclick = ()=> { if(!state.running) startGame(); else finishGame(); };
btnReset.onclick = resetGame;

// เริ่มต้น
resetGame();
