/* Fitness Adventure VR — Real Game (Runner 3 เลน)
   - เลือกเลน ซ้าย/กลาง/ขวา (fuse/click)
   - เก็บ Orb ให้ตรงเลน / หลบ Obstacle
   - 3 ระดับความยาก, 4 สเตจต่อรอบ, คะแนน/ชีวิต, ปุ่ม Next หลังจบสเตจ
   - เน้นเสถียรภาพมือถือ: object pool + object3D.position
*/

const $ = (id)=>document.getElementById(id);
const root = $("root");
const sky = $("sky");
const hudText = $("hudText");
const hudTitle = $("hudTitle");
const hudLives = $("hudLives");
const btnStart = $("btnStart");
const btnReset = $("btnReset");
const selectDiff = $("difficulty");
const laneL = $("laneL");
const laneC = $("laneC");
const laneR = $("laneR");

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ---------- Game State ----------
let state = {
  running:false,
  stageIndex:0,
  score:0,
  lives:3,
  lane:1,                   // 0=L, 1=C, 2=R
  elapsed:0,
  startTime:0,
  duration:45,              // per stage
  speed:2.0,                // z speed factor
  hitWindow:0.35,           // sec
  rafId:null,
  items:[],                 // scheduled items {time, lane, kind:'orb'|'ob'}
  nextSpawnIdx:0,
  pool:[],                  // pooled entities
  active:[],                // active pooled refs
  lastHudTs:0,
  hudInterval: isMobile? 250 : 120,
  nextButton:null
};

// ---------- Difficulty & Stages ----------
const DIFF = {
  easy:   { speed:1.8, hit:0.40, duration:40, spawnStep:1.2 },
  normal: { speed:2.2, hit:0.35, duration:50, spawnStep:1.0 },
  hard:   { speed:2.6, hit:0.30, duration:55, spawnStep:0.8 }
};

const STAGES = [
  { name:"Run Path 1", sky:"#f0fdf4",  pattern:"mixed"   },
  { name:"Energy Boost", sky:"#fae8ff", pattern:"orbs"    },
  { name:"Obstacle Zone", sky:"#fef9c3",pattern:"obstacles"},
  { name:"Run Path 2", sky:"#eef2ff",  pattern:"dense"   }
];

// ---------- Helpers ----------
function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }
function laneX(idx){ return [-1.2, 0, 1.2][idx]; }
function setLivesUI(n){ hudLives.textContent = "❤️".repeat(n); }
function setTitle(){ hudTitle.textContent = `Stage ${state.stageIndex+1}/${STAGES.length} — ${STAGES[state.stageIndex].name}`; }
function setHUD(msg){ hudText.textContent = msg; }

// ---------- Pool ----------
function buildPool(size=36){
  state.pool = [];
  for (let i=0;i<size;i++){
    const node = document.createElement("a-entity");
    node.setAttribute("visible","false");
    const body = document.createElement("a-entity"); // shape per kind (set later)
    node.appendChild(body);
    node.__body = body;
    root.appendChild(node);
    state.pool.push({el:node, inUse:false, kind:null, lane:1, time:0, judged:false});
  }
}
function acquire(kind, lane){
  for (const p of state.pool){
    if (!p.inUse){
      p.inUse = true;
      p.kind = kind;
      p.lane = lane;
      p.judged = false;
      p.el.setAttribute("visible","true");
      // shape/material
      if (kind === 'orb'){
        p.__shape = 'sphere';
        p.__color = "#22c55e";
        p.__size  = 0.16;
        p.__body = p.el.__body;
        p.__body.setAttribute("geometry","primitive: sphere; radius:0.16; segmentsWidth:16; segmentsHeight:16");
        p.__body.setAttribute("material","color:#22c55e; opacity:0.98; shader:flat");
      }else{
        p.__shape = 'box';
        p.__color = "#ef4444";
        p.__body = p.el.__body;
        p.__body.setAttribute("geometry","primitive: box; width:0.7; height:0.5; depth:0.3");
        p.__body.setAttribute("material","color:#ef4444; opacity:0.95; shader:flat");
      }
      return p;
    }
  }
  return null;
}
function release(p){
  if (!p) return;
  p.inUse = false;
  p.el.setAttribute("visible","false");
  p.el.object3D.position.set(laneX(p.lane), 0, -10);
}

// ---------- Scene & UI ----------
function buildScene(){
  clearChildren(root);
  // พื้นเลนโปร่ง
  const lanePlane = document.createElement("a-entity");
  lanePlane.setAttribute("geometry","primitive: plane; width: 3.6; height: 2.0");
  lanePlane.setAttribute("material","color:#94a3b8; opacity:0.12; shader:flat");
  root.appendChild(lanePlane);

  [-1.2,0,1.2].forEach(x=>{
    const post = document.createElement("a-entity");
    post.setAttribute("geometry","primitive: box; width:0.06; height:1.6; depth:0.02");
    post.setAttribute("material","color:#94a3b8; opacity:0.35; shader:flat");
    post.setAttribute("position",`${x} 0 0.02`);
    root.appendChild(post);
  });

  // แท็กชี้เลนปัจจุบัน
  const marker = document.createElement("a-entity");
  marker.setAttribute("geometry","primitive: ring; radiusInner:0.14; radiusOuter:0.20; segmentsTheta:48");
  marker.setAttribute("material","color:#0ea5e9; opacity:0.95; shader:flat");
  marker.setAttribute("position",`${laneX(state.lane)} 0 0.05`);
  marker.setAttribute("id","laneMarker");
  root.appendChild(marker);
}

function updateLaneMarker(){
  const mk = document.getElementById("laneMarker");
  if (mk) mk.object3D.position.set(laneX(state.lane), 0, 0.05);
}

function attachLaneButtons(){
  laneL.addEventListener("click", ()=>{ state.lane = 0; updateLaneMarker(); feedback("เลนซ้าย", "#38bdf8"); });
  laneC.addEventListener("click", ()=>{ state.lane = 1; updateLaneMarker(); feedback("เลนกลาง", "#38bdf8"); });
  laneR.addEventListener("click", ()=>{ state.lane = 2; updateLaneMarker(); feedback("เลนขวา", "#38bdf8"); });
}

// ---------- Spawner ----------
function makeItems(pattern, duration, step){
  const items = [];
  let t = 1.2; // warmup
  const lanes = [0,1,2];
  // สร้างตามแพทเทิร์น
  while (t < duration){
    let lane = lanes[Math.floor(Math.random()*3)];
    let kind = 'orb';
    if (pattern === 'orbs') kind = 'orb';
    else if (pattern === 'obstacles') kind = 'ob';
    else if (pattern === 'dense') kind = Math.random()<0.45?'ob':'orb';
    else /* mixed */ kind = Math.random()<0.65?'orb':'ob';

    items.push({time:t, lane, kind});
    t += step + (Math.random()*0.2-0.1); // เล็กน้อยกันจำเจ
  }
  return items;
}

// ---------- Game Flow ----------
function startGame(){
  const diff = DIFF[selectDiff.value || 'easy'];
  state.running = true;
  state.stageIndex = 0;
  state.score = 0;
  state.lives = 3;
  state.lane = 1;
  sky.setAttribute("color", STAGES[0].sky);
  setLivesUI(state.lives);
  setHUD("เริ่มรอบใหม่!");
  setTitle();

  buildScene();
  buildPool(isMobile? 30 : 42);
  initStage(diff);
  loop();
}

function initStage(diff){
  // เตรียมสเตจ
  const st = STAGES[state.stageIndex];
  state.duration = diff.duration;
  state.speed = diff.speed;
  state.hitWindow = diff.hit;
  state.elapsed = 0;
  state.startTime = performance.now()/1000;

  state.items = makeItems(st.pattern, state.duration, diff.spawnStep);
  state.nextSpawnIdx = 0;
  state.active = [];

  sky.setAttribute("color", st.sky);
  setTitle();
  setHUD(`สเตจ: ${st.name}\nคะแนน: ${state.score}\nเลน: ${["ซ้าย","กลาง","ขวา"][state.lane]}`);

  // ลบปุ่ม Next เดิม
  if (state.nextButton && state.nextButton.parentNode) state.nextButton.parentNode.removeChild(state.nextButton);
  state.nextButton = null;
}

function endStage(){
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);

  // หากมีสเตจถัดไป
  const hasNext = state.stageIndex < STAGES.length-1;
  setHUD(`จบสเตจ: ${STAGES[state.stageIndex].name}\nคะแนนรวม: ${state.score}`);

  // แสดงปุ่ม NEXT ในฉาก
  const nextBtn = document.createElement("a-entity");
  nextBtn.classList.add("selectable");
  nextBtn.setAttribute("geometry","primitive: plane; width: 1.6; height: 0.44");
  nextBtn.setAttribute("material","color:#ffffff; opacity:0.0; shader:flat");
  nextBtn.setAttribute("position","0 -1.2 0.08");
  nextBtn.setAttribute("visible","false");
  const txt = document.createElement("a-entity");
  txt.setAttribute("text", `value:${hasNext?'Next Stage ▶':'Restart ⟳'}; width:4; align:center; color:#0b1220`);
  txt.setAttribute("position","0 0 0.01");
  nextBtn.appendChild(txt);
  root.appendChild(nextBtn);
  state.nextButton = nextBtn;

  setTimeout(()=>{
    nextBtn.setAttribute("visible","true");
    nextBtn.setAttribute("animation__fade","property: material.opacity; from:0; to:0.95; dur:450; easing:easeOutQuad");
    nextBtn.setAttribute("animation__pulse","property: scale; dir:alternate; dur:700; easing:easeInOutSine; from:1 1 1; to:1.05 1.05 1; loop:true");
  }, 600);

  nextBtn.addEventListener("click", ()=>{
    if (hasNext){
      state.stageIndex++;
      state.running = true;
      buildScene();
      initStage(DIFF[selectDiff.value || 'easy']);
      loop();
    }else{
      startGame();
    }
  });
}

function gameOver(){
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  setHUD(`Game Over\nคะแนนรวม: ${state.score}`);
  setLivesUI(0);

  // ปุ่ม Restart
  const restart = document.createElement("a-entity");
  restart.classList.add("selectable");
  restart.setAttribute("geometry","primitive: plane; width: 1.6; height: 0.44");
  restart.setAttribute("material","color:#ffffff; opacity:0.95; shader:flat");
  restart.setAttribute("position","0 -1.2 0.08");
  const txt = document.createElement("a-entity");
  txt.setAttribute("text","value:Restart ⟳; width:4; align:center; color:#0b1220");
  txt.setAttribute("position","0 0 0.01");
  restart.appendChild(txt);
  root.appendChild(restart);
  restart.addEventListener("click", startGame);
}

// ---------- Loop ----------
function loop(){
  if (!state.running) return;
  const now = performance.now()/1000;
  state.elapsed = now - state.startTime;

  // HUD throttle
  const ms = performance.now();
  if (ms - state.lastHudTs > state.hudInterval){
    state.lastHudTs = ms;
    setHUD(`สเตจ: ${STAGES[state.stageIndex].name}\nเวลา: ${Math.max(0, Math.ceil(state.duration - state.elapsed))} วิ\nคะแนน: ${state.score}\nเลน: ${["ซ้าย","กลาง","ขวา"][state.lane]}`);
  }

  // Spawn lead time: ของวิ่งจาก zStart -> 0 ใช้เวลาประมาณ lead = 2s
  const lead = 2.0;
  while (state.nextSpawnIdx < state.items.length){
    const it = state.items[state.nextSpawnIdx];
    if (it.time - state.elapsed <= lead){
      const p = acquire(it.kind, it.lane);
      if (p){
        p.time = it.time;
        p.el.object3D.position.set(laneX(it.lane), 0, -lead * state.speed);
        state.active.push(p);
      }
      state.nextSpawnIdx++;
    } else break;
  }

  // Move & judge
  for (const p of state.active){
    if (!p || p.judged || !p.inUse) continue;
    const dt = p.time - state.elapsed;   // 0 ณ เส้น hit
    p.el.object3D.position.z = dt * state.speed;

    if (Math.abs(dt) <= state.hitWindow){
      // ไลน์ชน
      if (p.kind === 'orb'){
        if (state.lane === p.lane) {
          scoreAdd(20, "เก็บพลังงาน +20", "#22c55e");
        } else {
          feedback("พลาด Orb", "#eab308");
        }
      }else{ // obstacle
        if (state.lane === p.lane){
          loseLife();
        } else {
          feedback("หลบสิ่งกีดขวางสำเร็จ", "#38bdf8");
        }
      }
      p.judged = true;
      // pop effect เล็กน้อย
      try { p.el.setAttribute("animation__pop","property: scale; to: 1.25 1.25 1; dur: 80; dir: alternate; easing: easeOutQuad"); } catch(e){}
      setTimeout(()=> release(p), 100);
    } else if (dt < -state.hitWindow && !p.judged){
      // ผ่านไปแล้วโดยไม่ชน/เก็บ
      p.judged = true;
      setTimeout(()=> release(p), 50);
    }
  }

  // End stage
  if (state.elapsed >= state.duration){
    endStage();
    return;
  }

  state.rafId = requestAnimationFrame(loop);
}

// ---------- Score & Life ----------
function scoreAdd(n, msg="", color="#38bdf8"){
  state.score += n;
  if (msg) feedback(msg, color);
}

function loseLife(){
  state.lives -= 1;
  setLivesUI(state.lives);
  feedback("ชนสิ่งกีดขวาง -1 ชีวิต", "#ef4444");
  if (state.lives <= 0) {
    gameOver();
  }
}

// ---------- Feedback ----------
let fbTimer = null;
function feedback(text, color="#38bdf8"){
  const el = document.createElement("a-entity");
  el.setAttribute("text", `value:${text}; width:4.8; align:center; color:${color}`);
  el.setAttribute("position", "0 0.8 0.1");
  root.appendChild(el);
  el.setAttribute("animation__up","property: position; to: 0 1.0 0.1; dur: 400; easing: easeOutQuad");
  setTimeout(()=>{ if (el.parentNode) root.removeChild(el); }, 450);
}

// ---------- Buttons ----------
btnStart.onclick = ()=>{ if (!state.running) startGame(); };
btnReset.onclick = ()=>{ state.running=false; if(state.rafId) cancelAnimationFrame(state.rafId); clearChildren(root); setHUD("พร้อมเริ่ม"); setLivesUI(3); };
$("btnStart").style.pointerEvents='auto';
$("btnReset").style.pointerEvents='auto';

// เลือกเลน
attachLaneButtons();

// คีย์ลัดบนเดสก์ท็อป: A/S/D = ซ้าย/กลาง/ขวา
window.addEventListener('keydown',(e)=>{
  const k = e.key.toLowerCase();
  if (k==='a') { state.lane=0; updateLaneMarker(); feedback("เลนซ้าย","#38bdf8"); }
  if (k==='s') { state.lane=1; updateLaneMarker(); feedback("เลนกลาง","#38bdf8"); }
  if (k==='d') { state.lane=2; updateLaneMarker(); feedback("เลนขวา","#38bdf8"); }
});

// Init
setHUD("พร้อมเริ่ม\nเลือกโหมดแล้วกด Start");
setLivesUI(3);
