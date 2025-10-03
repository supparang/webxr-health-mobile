/* Hygiene Rhythm Game – Stable Build
   - แยกรูปร่างชัด: wash=circle 🧼, brush=box 🪥, cover=triangle 🤧
   - กันค้าง: ยิง animation เฉพาะ element ที่มี material / ใช้ text.opacity กับข้อความ
   - เพิ่ม try-safe checks ก่อนลบ/อ่าน attribute ทุกครั้ง
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

function makePattern(bpm, duration, warmup=false, hard=false) {
  const beat = 60/bpm;
  const notes = [];
  const order = ["wash","brush","cover"];
  let i=0;
  const start = warmup? beat*2 : beat;
  for (let t=start; t<duration; t+=beat) {
    const lane = order[i%order.length];
    notes.push(makeNote(t, lane));
    if (hard && i%5===2) notes.push(makeNote(t+beat/2, order[(i+1)%3]));
    i++;
  }
  return notes;
}
function makeNote(time, lane){ return { time, lane, z0:-4, z: -4, judged:false, el:null }; }

// ---------- Scene ----------
function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

function buildScene(){
  clearChildren(root);
  state.lanes = {};

  // Legend
  const legend = document.createElement("a-entity");
  legend.setAttribute("position","0 0.8 0");
  const legendBg = document.createElement("a-entity");
  legendBg.setAttribute("geometry","primitive: plane; width: 3.6; height: 0.36");
  legendBg.setAttribute("material","color:#ffffff; opacity:0.92; shader:flat");
  legend.appendChild(legendBg);
  const legendText = document.createElement("a-entity");
  legendText.setAttribute("text","value:🧼 วงกลม=ล้างมือ   🪥 สี่เหลี่ยม=แปรงฟัน   🤧 สามเหลี่ยม=ปิดปาก; width:7.0; align:center; color:#0b1220");
  legendText.setAttribute("position","0 0 0.02");
  legend.appendChild(legendText);
  root.appendChild(legend);
  state.legend = legend;

  // Hit line
  const hit = document.createElement("a-entity");
  hit.setAttribute("geometry","primitive: plane; width: 3.6; height: 0.03");
  hit.setAttribute("material","color:#0ea5e9; opacity:0.95; shader:flat");
  hit.setAttribute("position","0 -0.25 0");
  root.appendChild(hit);
  state.hitLine = hit;

  // 3 lanes
  const lanes = [
    {key:"wash",  x:-1.2, color:"#22c55e", label:"🧼 ล้างมือ", icon:"🧼"},
    {key:"brush", x: 0.0, color:"#eab308", label:"🪥 แปรงฟัน", icon:"🪥"},
    {key:"cover", x: 1.2, color:"#ef4444", label:"🤧 ปิดปาก", icon:"🤧"}
  ];

  lanes.forEach(l=>{
    const lane = document.createElement("a-entity");
    lane.setAttribute("position", `${l.x} 0 0`);

    const laneIconBg = document.createElement("a-entity");
    laneIconBg.setAttribute("geometry","primitive: plane; width: 0.9; height: 0.35");
    laneIconBg.setAttribute("material","color:#ffffff; opacity:0.95; shader:flat");
    laneIconBg.setAttribute("position","0 0.45 0");
    lane.appendChild(laneIconBg);

    const laneIcon = document.createElement("a-entity");
    laneIcon.setAttribute("text", `value:${l.icon}; width:3.2; align:center; color:#0b1220`);
    laneIcon.setAttribute("position","0 0.45 0.02");
    lane.appendChild(laneIcon);

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

/* สร้างโน้ต + เก็บ parts ไว้ใน el.__parts เพื่อ animate อย่างปลอดภัย */
function makeNoteEntity(lane){
  const node = document.createElement("a-entity");
  const parts = { shape: null, outline: null, badge: null, emoji: null };
  let geom = "", color = "";

  if (lane==="wash") { geom="primitive: circle; radius: 0.18; segments: 48"; color="#22c55e"; }
  else if (lane==="brush"){ geom="primitive: box; width: 0.34; height: 0.34; depth: 0.02"; color="#f59e0b"; }
  else { geom="primitive: triangle; vertexA: 0 0.22 0; vertexB: -0.22 -0.22 0; vertexC: 0.22 -0.22 0"; color="#ef4444"; }

  const shape = document.createElement("a-entity");
  shape.setAttribute("geometry", geom);
  shape.setAttribute("material", `color:${color}; opacity:0.98; shader:flat`);
  node.appendChild(shape);
  parts.shape = shape;

  const outline = document.createElement("a-entity");
  if (lane==="wash")      outline.setAttribute("geometry","primitive: ring; radiusInner: 0.18; radiusOuter: 0.205; segmentsTheta: 48");
  else if (lane==="brush")outline.setAttribute("geometry","primitive: box; width: 0.36; height: 0.36; depth: 0.005");
  else                    outline.setAttribute("geometry","primitive: triangle; vertexA: 0 0.235 0; vertexB: -0.235 -0.235 0; vertexC: 0.235 -0.235 0");
  outline.setAttribute("material","color:#0b1220; opacity:0.55; shader:flat");
  node.appendChild(outline);
  parts.outline = outline;

  const badge = document.createElement("a-entity");
  badge.setAttribute("geometry","primitive: circle; radius: 0.16; segments: 32");
  badge.setAttribute("material","color:#ffffff; opacity:0.35; shader:flat");
  badge.setAttribute("position","0 0 0.01");
  node.appendChild(badge);
  parts.badge = badge;

  const emoji = document.createElement("a-entity");
  const symbol = lane==="wash" ? "🧼" : lane==="brush" ? "🪥" : "🤧";
  emoji.setAttribute("text", `value:${symbol}; width:3.2; align:center; color:#0b1220; negate:false; opacity:1`);
  emoji.setAttribute("position","0 0 0.02");
  node.appendChild(emoji);
  parts.emoji = emoji;

  node.__parts = parts;
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
    if (t>0) {
      safeSetText(state.countdownEl, String(t));
      t--;
      setTimeout(step, 700);
    } else {
      safeSetText(state.countdownEl, "Go!");
      setTimeout(()=> safeSetText(state.countdownEl, " "), 400);
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

  // Metronome
  const beatPhase = (state.elapsed % state.beatSec)/state.beatSec;
  if (state.hitLine) {
    const op = 0.7 + 0.25*Math.cos(beatPhase*2*Math.PI);
    state.hitLine.setAttribute("material", `color:#0ea5e9; opacity:${op}; shader:flat`);
  }

  // Move notes
  for (const n of state.notes) {
    if (!n.el || n.judged) continue;
    const dt = n.time - state.elapsed;
    const z = dt * 2.2;
    n.z = z;
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
  const el = note.el;
  if (el && el.parentNode) {
    safePop(el);
    safeFadeAndRemove(el, 200);  // ลบกลุ่มทั้งก้อนแบบปลอดภัย
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

  const emFB = type==="perfect"?"✨":type==="great"?"✅":type==="good"?"🙂":"❌";
  fb.innerHTML = `<span style="color:${color};font-weight:800;">${emFB} ${text}</span>`;
  clearTimeout(state.feedbackTimer);
  state.feedbackTimer = setTimeout(()=> fb.textContent="", 600);

  // Emoji burst เบาๆ แบบปลอดภัย
  if (el) emojiBurst(el, type, note.lane);
}

/* ---------- Safe helpers ---------- */
function safePop(group){
  try {
    group.setAttribute("animation__pop","property: scale; to: 1.5 1.5 1; dur: 90; dir: alternate; easing: easeOutQuad");
  } catch(e){}
}

function safeFadeAndRemove(group, delay=180){
  try {
    const parts = group.__parts || {};
    // เฟดเฉพาะ material
    ["shape","outline","badge"].forEach(k=>{
      const p = parts[k];
      if (p && p.hasAttribute("material")) {
        p.setAttribute("animation__fade_"+k, "property: material.opacity; to: 0; dur: "+delay+"; easing: easeOutQuad");
      }
    });
    // เฟดข้อความด้วย text.opacity
    if (parts.emoji) {
      parts.emoji.setAttribute("animation__fade_text","property: text.opacity; to: 0; dur: "+delay+"; easing: easeOutQuad");
    }
    setTimeout(()=>{ if(group.parentNode){ group.parentNode.removeChild(group); } }, delay+40);
  } catch(e){
    // ถ้า animation ใช้ไม่ได้ ให้ลบทิ้งเลย
    if (group && group.parentNode) group.parentNode.removeChild(group);
  }
}

function emojiBurst(group, type, lane){
  try{
    const burst = document.createElement("a-entity");
    const e = type==="perfect" ? (lane==="wash"?"🧼":lane==="brush"?"🪥":"🤧")
              : type==="great" ? "✨" : type==="good" ? "👍" : "💨";
    burst.setAttribute("text", `value:${e}; width: 3.0; align: center; color: #0b1220; opacity:1`);
    const pos = group.getAttribute("position") || {x:0,y:0,z:0};
    burst.setAttribute("position", `${pos.x} ${pos.y} ${pos.z}`);
    root.appendChild(burst);
    // ใช้ text.opacity เท่านั้น (ไม่มี material)
    burst.setAttribute("animation__up","property: position; to: "+pos.x+" 0.25 "+pos.z+"; dur: 320; easing: easeOutQuad");
    burst.setAttribute("animation__fade","property: text.opacity; to: 0; dur: 320; easing: easeOutQuad");
    setTimeout(()=>{ if(burst.parentNode) burst.parentNode.removeChild(burst); }, 340);
  }catch(e){}
}

function safeSetText(el, value){
  try { el.setAttribute("text", `value:${value}; width:4.8; align:center; color:#0b1220`); } catch(e){}
}

// ---------- Controls ----------
btnStart.onclick = ()=> { if(!state.running) startGame(); else finishGame(); };
btnReset.onclick = resetGame;

// Init
resetGame();
