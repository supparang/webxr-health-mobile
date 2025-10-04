/* Fitness Adventure VR — Game v2 (All-in-One)
   - Runner 3 เลน: เลือกเลน (ซ้าย/กลาง/ขวา) เพื่อเก็บ Orb / หลบ Obstacle
   - เพลง/เอฟเฟกต์เสียง: Web Audio API (ไม่ต้องใช้ไฟล์เสียง)
   - ธีมฉาก Jungle/City/Space (พื้นหลัง/พร็อพ)
   - ระบบเควส, แบดจ์, สถิติสะสม (localStorage)
   - Desktop Friendly: ปุ่มเลน HTML + คีย์ลัด + Mouse Look toggle
   - มือถือลื่น: object pool + object3D.position
*/

const $ = (id)=>document.getElementById(id);
const root = $("root");
const sky = $("sky");
const hudText = $("hudText");
const hudTitle = $("hudTitle");
const hudLives = $("hudLives");
const hudQuest = $("hudQuest");
const btnStart = $("btnStart");
const btnReset = $("btnReset");
const selectDiff = $("difficulty");
const selectTheme = $("theme");
const selectQuest = $("quest");
const laneL = $("laneL");
const laneC = $("laneC");
const laneR = $("laneR");
const mouseLookToggle = $("mouseLookToggle");
const btnL = $("btnL");
const btnC = $("btnC");
const btnR = $("btnR");

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// --------- Audio (WebAudio no files) ----------
let audioCtx = null, musicGain = null, sfxGain = null, musicTimer = 0, musicRunning = false;
function ensureAudio(){
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  musicGain = audioCtx.createGain(); musicGain.gain.value = 0.08; musicGain.connect(audioCtx.destination);
  sfxGain = audioCtx.createGain(); sfxGain.gain.value = 0.15; sfxGain.connect(audioCtx.destination);
}
function tone(freq=440, dur=0.08, type='sine', gain=0.15){
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(sfxGain);
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t+0.01);
  g.gain.linearRampToValueAtTime(0, t+dur);
  o.start(t); o.stop(t+dur+0.02);
}
const SFX = {
  orb: ()=> tone(660, 0.07, 'triangle', 0.18),
  hit: ()=> tone(180, 0.10, 'sawtooth', 0.22),
  ok:  ()=> tone(520, 0.07, 'sine', 0.16),
  next:()=> tone(740, 0.10, 'square', 0.18),
};
// mini music loop: simple arpeggio per theme
function startMusic(theme){
  ensureAudio();
  stopMusic();
  musicRunning = true;
  const scale = theme==='jungle' ? [220,277,330,392] : theme==='city' ? [240,300,360,420] : [200,252,300,400];
  const wave  = theme==='jungle' ? 'triangle' : theme==='city' ? 'sine' : 'square';
  const bpm = 96, beat = 60/bpm;
  function step(){
    if (!musicRunning) return;
    const baseT = audioCtx.currentTime;
    for (let i=0;i<8;i++){
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = wave;
      const f = scale[(i+musicTimer)%scale.length] * (theme==='space' && i%4===0 ? 0.5 : 1);
      o.frequency.value = f;
      g.gain.value = 0.0;
      o.connect(g); g.connect(musicGain);
      const t = baseT + i*(beat/2);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.09, t+0.01);
      g.gain.linearRampToValueAtTime(0.0, t+beat/2 - 0.02);
      o.start(t); o.stop(t+beat/2);
    }
    musicTimer++;
    setTimeout(step, beat*1000*4); // schedule next chunk
  }
  step();
}
function stopMusic(){ musicRunning = false; }

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
  nextButton:null,
  theme:'jungle',
  // quest & stats
  questType:'collect',
  questTarget:12,
  questProgress:0,
  surviveOK:true,
  streak:0, bestStreak:0,
  // run stat
  totalOrbs:0, totalObCleared:0, obHit:0,
};

// ---------- Difficulty, Stages, Themes ----------
const DIFF = {
  easy:   { speed:1.8, hit:0.40, duration:40, spawnStep:1.2 },
  normal: { speed:2.2, hit:0.35, duration:50, spawnStep:1.0 },
  hard:   { speed:2.6, hit:0.30, duration:55, spawnStep:0.8 }
};

const STAGES = [
  { name:"Run Path 1", pattern:"mixed"    },
  { name:"Energy Boost", pattern:"orbs"   },
  { name:"Obstacle Zone", pattern:"obstacles"},
  { name:"Run Path 2", pattern:"dense"    }
];

const THEME_PRESET = {
  jungle: { sky:"#dffbe2", accent:"#22c55e", deco:(parent)=> {
    [-1.4,1.4].forEach(x=> addPillar(parent, x, 0, "#166534"));
    addDecoSphere(parent, 0.9, -1.2, "#22c55e");
  }},
  city:   { sky:"#e5e7eb", accent:"#60a5fa", deco:(parent)=> {
    [-1.2,0,1.2].forEach(x=> addBuilding(parent, x, -1.0, "#94a3b8"));
  }},
  space:  { sky:"#0b1020", accent:"#a78bfa", deco:(parent)=> {
    addStarField(parent);
    addPlanet(parent, -0.9, -1.2, "#a78bfa");
  }},
};

// ---------- Helpers ----------
function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }
function laneX(idx){ return [-1.2, 0, 1.2][idx]; }
function setLivesUI(n){ hudLives.textContent = "❤️".repeat(Math.max(0,n)); }
function setTitle(){ hudTitle.textContent = `Stage ${state.stageIndex+1}/${STAGES.length} — ${STAGES[state.stageIndex].name}`; }
function setHUD(msg){ hudText.textContent = msg; }
function setQuestHUD(){
  const type = state.questType;
  let txt = "";
  if (type==='collect') txt = `เควส: เก็บ Orb ให้ครบ ${state.questTarget} ลูก (ตอนนี้ ${state.questProgress})`;
  else if (type==='survive') txt = `เควส: เอาตัวรอดโดยไม่เสียชีวิต (สถานะ: ${state.surviveOK?'✅':'❌'})`;
  else if (type==='streak') txt = `เควส: หลบสิ่งกีดขวางต่อเนื่อง ${state.questTarget} ครั้ง (สถิติ ${state.bestStreak})`;
  hudQuest.textContent = txt;
}

// ---------- Pool ----------
function buildPool(size=40){
  state.pool = [];
  for (let i=0;i<size;i++){
    const node = document.createElement("a-entity");
    node.setAttribute("visible","false");
    const body = document.createElement("a-entity");
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
      p.kind = kind; p.lane = lane; p.judged = false;
      p.el.setAttribute("visible","true");
      if (kind === 'orb'){
        p.__body.setAttribute("geometry","primitive: sphere; radius:0.16; segmentsWidth:16; segmentsHeight:16");
        p.__body.setAttribute("material",`color:${THEME_PRESET[state.theme].accent}; opacity:0.98; shader:flat`);
      }else{
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

// ---------- Theme deco ----------
function addPillar(parent, x, z, color){
  const e = document.createElement("a-entity");
  e.setAttribute("geometry","primitive: box; width:0.2; height:1.8; depth:0.2");
  e.setAttribute("material",`color:${color}; opacity:0.55; shader:flat`);
  e.setAttribute("position",`${x} 0 ${z}`);
  parent.appendChild(e);
}
function addBuilding(parent, x, z, color){
  const e = document.createElement("a-entity");
  e.setAttribute("geometry","primitive: box; width:0.6; height:1.2; depth:0.4");
  e.setAttribute("material",`color:${color}; opacity:0.6; shader:flat`);
  e.setAttribute("position",`${x} -0.2 ${z}`);
  parent.appendChild(e);
}
function addPlanet(parent, x, z, color){
  const e = document.createElement("a-entity");
  e.setAttribute("geometry","primitive: sphere; radius:0.35");
  e.setAttribute("material",`color:${color}; opacity:0.85; shader:flat`);
  e.setAttribute("position",`${x} 0 ${z}`);
  e.setAttribute("animation__rot","property: rotation; to: 0 360 0; loop:true; dur:6000; easing: linear");
  parent.appendChild(e);
}
function addDecoSphere(parent, x, z, color){
  const e = document.createElement("a-entity");
  e.setAttribute("geometry","primitive: sphere; radius:0.22");
  e.setAttribute("material",`color:${color}; opacity:0.75; shader:flat`);
  e.setAttribute("position",`${x} 0 ${z}`);
  parent.appendChild(e);
}
function addStarField(parent){
  for (let i=0;i<24;i++){
    const s = document.createElement("a-entity");
    s.setAttribute("geometry","primitive: circle; radius:0.02; segments:6");
    s.setAttribute("material","color:#ffffff; opacity:0.85; shader:flat");
    const x = -1.6 + Math.random()*3.2;
    const y = -0.8 + Math.random()*1.6;
    s.setAttribute("position",`${x} ${y} -0.05`);
    parent.appendChild(s);
  }
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

  // ธีมตกแต่ง
  const deco = document.createElement("a-entity");
  root.appendChild(deco);
  THEME_PRESET[state.theme].deco(deco);

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

// ====== ฟังก์ชันย้ายเลนแบบแชร์ ======
function setLane(idx, feedbackText=true){
  state.lane = Math.max(0, Math.min(2, idx));
  updateLaneMarker();
  if (feedbackText) { SFX?.ok?.(); feedback(["เลนซ้าย","เลนกลาง","เลนขวา"][state.lane], "#38bdf8"); }
}

// ป้ายในฉาก
function attachLaneButtons(){
  laneL.addEventListener("click", ()=> setLane(0));
  laneC.addEventListener("click", ()=> setLane(1));
  laneR.addEventListener("click", ()=> setLane(2));
}

// ---------- Spawner ----------
function makeItems(pattern, duration, step){
  const items = [];
  let t = 1.2; // warmup
  const lanes = [0,1,2];
  while (t < duration){
    const lane = lanes[Math.floor(Math.random()*3)];
    let kind = 'orb';
    if (pattern === 'orbs') kind = 'orb';
    else if (pattern === 'obstacles') kind = 'ob';
    else if (pattern === 'dense') kind = Math.random()<0.45?'ob':'orb';
    else /* mixed */ kind = Math.random()<0.65?'orb':'ob';
    items.push({time:t, lane, kind});
    t += step + (Math.random()*0.2-0.1);
  }
  return items;
}

// ---------- Stats (localStorage) ----------
const STAT_KEY = "fitnessAdventureStats_v2";
function loadStats(){ try{ return JSON.parse(localStorage.getItem(STAT_KEY)||"{}"); }catch(e){ return {}; } }
function saveStats(s){ try{ localStorage.setItem(STAT_KEY, JSON.stringify(s)); }catch(e){} }

// ---------- Quests & Badges ----------
function setupQuest(){
  state.questType = selectQuest.value;
  state.questProgress = 0; state.surviveOK = true; state.streak = 0; state.bestStreak = 0;
  const diff = DIFF[selectDiff.value||'easy'];
  if (state.questType==='collect')      state.questTarget = Math.round(diff.duration/4);
  else if (state.questType==='streak')  state.questTarget = Math.max(5, Math.round(8 * (diff.speed-1.6)));
  else                                  state.questTarget = 1;
  setQuestHUD();
}
function checkQuestOnEvent(evt){
  // evt: {type:'orb'|'obClear'|'obHit'}
  if (evt.type==='orb'){
    state.questProgress++;
  } else if (evt.type==='obClear'){
    state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else if (evt.type==='obHit'){
    state.surviveOK = false; state.streak = 0;
  }
  setQuestHUD();
}
function isQuestCleared(){
  if (state.questType==='collect') return state.questProgress >= state.questTarget;
  if (state.questType==='survive') return state.surviveOK;
  if (state.questType==='streak')  return state.bestStreak >= state.questTarget;
  return false;
}
function evalBadgesAndShow(){
  const badges = [];
  if (state.score >= 800) badges.push("🏅 Score Hunter");
  if (state.totalOrbs >= 15) badges.push("💎 Orb Collector");
  if (state.bestStreak >= 7) badges.push("🛡️ Agile Dodger");
  if (isQuestCleared()) badges.push("🎯 Quest Master");

  const stats = loadStats();
  stats.plays = (stats.plays||0)+1;
  stats.bestScore = Math.max(stats.bestScore||0, state.score);
  stats.totalOrbs = (stats.totalOrbs||0) + state.totalOrbs;
  stats.totalClears = (stats.totalClears||0) + (state.lives>0?1:0);
  saveStats(stats);

  let summary = `คะแนนรวม: ${state.score}\nOrb ที่เก็บ: ${state.totalOrbs}\nหลบได้: ${state.totalObCleared}\nชน: ${state.obHit}\n\n`;
  summary += `สถิติสะสม — เล่นทั้งหมด: ${stats.plays||0} ครั้ง | คะแนนสูงสุด: ${stats.bestScore||0} | รวม Orb: ${stats.totalOrbs||0}\n`;
  if (badges.length) summary += `\nปลดล็อกแบดจ์: ${badges.join("  ")}`;

  // แผงผลลัพธ์ + ปุ่ม Next/Restart
  const panel = document.createElement("a-entity");
  panel.setAttribute("geometry","primitive: plane; width: 2.8; height: 1.6");
  panel.setAttribute("material","color:#ffffff; opacity:0.96; shader:flat");
  panel.setAttribute("position","0 0 0.08");
  const t = document.createElement("a-entity");
  t.setAttribute("text",`value:${summary}; width:5.2; align:center; color:#0b1220`);
  t.setAttribute("position","0 0 0.01");
  panel.appendChild(t);
  root.appendChild(panel);

  const hasNext = state.stageIndex < STAGES.length-1;
  const nextBtn = document.createElement("a-entity");
  nextBtn.classList.add("selectable");
  nextBtn.setAttribute("geometry","primitive: plane; width: 1.6; height: 0.44");
  nextBtn.setAttribute("material","color:#ffffff; opacity:0.95; shader:flat");
  nextBtn.setAttribute("position","0 -0.95 0.09");
  const label = hasNext ? "Next Stage ▶" : "Restart ⟳";
  const btnText = document.createElement("a-entity");
  btnText.setAttribute("text", `value:${label}; width:4; align:center; color:#0b1220`);
  btnText.setAttribute("position","0 0 0.01");
  nextBtn.appendChild(btnText);
  root.appendChild(nextBtn);

  nextBtn.addEventListener("click", ()=>{
    SFX.next();
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

// ---------- Game Flow ----------
function startGame(){
  ensureAudio();
  state.theme = selectTheme.value;
  startMusic(state.theme);

  const diff = DIFF[selectDiff.value || 'easy'];
  state.running = true;
  state.stageIndex = 0;
  state.score = 0;
  state.lives = 3;
  state.lane = 1;
  state.totalOrbs = 0; state.totalObCleared = 0; state.obHit = 0;

  sky.setAttribute("color", THEME_PRESET[state.theme].sky);
  setLivesUI(state.lives);
  setHUD("เริ่มรอบใหม่!");
  setTitle();

  buildScene();
  buildPool(isMobile? 34 : 46);
  setupQuest();
  initStage(diff);
  loop();
}

function initStage(diff){
  const st = STAGES[state.stageIndex];
  state.duration = diff.duration;
  state.speed = diff.speed;
  state.hitWindow = diff.hit;
  state.elapsed = 0;
  state.startTime = performance.now()/1000;

  state.items = makeItems(st.pattern, state.duration, diff.spawnStep);
  state.nextSpawnIdx = 0;
  state.active = [];

  sky.setAttribute("color", THEME_PRESET[state.theme].sky);
  setTitle();
  setHUD(`สเตจ: ${st.name}\nคะแนน: ${state.score}\nเลน: ${["ซ้าย","กลาง","ขวา"][state.lane]}`);
  setQuestHUD();

  if (state.nextButton && state.nextButton.parentNode) state.nextButton.parentNode.removeChild(state.nextButton);
  state.nextButton = null;
}

function endStage(){
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  stopMusic();

  SFX.next();
  setHUD(`จบสเตจ: ${STAGES[state.stageIndex].name}\nคะแนนรวม: ${state.score}`);
  evalBadgesAndShow();
}

function gameOver(){
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  stopMusic();

  setHUD(`Game Over\nคะแนนรวม: ${state.score}`);
  setLivesUI(0);

  const stats = loadStats();
  stats.plays = (stats.plays||0)+1;
  stats.bestScore = Math.max(stats.bestScore||0, state.score);
  saveStats(stats);

  // ปุ่ม Restart
  const restart = document.createElement("a-entity");
  restart.classList.add("selectable");
  restart.setAttribute("geometry","primitive: plane; width: 1.6; height: 0.44");
  restart.setAttribute("material","color:#ffffff; opacity:0.95; shader:flat");
  restart.setAttribute("position","0 -1.0 0.09");
  const txt = document.createElement("a-entity");
  txt.setAttribute("text","value:Restart ⟳; width:4; align:center; color:#0b1220");
  txt.setAttribute("position","0 0 0.01");
  restart.appendChild(txt);
  root.appendChild(restart);
  restart.addEventListener("click", ()=>{ SFX.next(); startGame(); });
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

  // Spawn lead
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
      if (p.kind === 'orb'){
        if (state.lane === p.lane) {
          state.totalOrbs++;
          scoreAdd(20, "เก็บพลังงาน +20", THEME_PRESET[state.theme].accent);
          SFX.orb();
          checkQuestOnEvent({type:'orb'});
        } else {
          feedback("พลาด Orb", "#eab308");
        }
      }else{ // obstacle
        if (state.lane === p.lane){
          state.obHit++;
          loseLife();
          SFX.hit();
          checkQuestOnEvent({type:'obHit'});
        } else {
          state.totalObCleared++;
          feedback("หลบสิ่งกีดขวางสำเร็จ", "#38bdf8");
          checkQuestOnEvent({type:'obClear'});
        }
      }
      p.judged = true;
      try { p.el.setAttribute("animation__pop","property: scale; to: 1.25 1.25 1; dur: 80; dir: alternate; easing: easeOutQuad"); } catch(e){}
      setTimeout(()=> release(p), 100);
    } else if (dt < -state.hitWindow && !p.judged){
      p.judged = true;
      setTimeout(()=> release(p), 50);
    }
  }

  // เควสสำเร็จล่วงหน้า → โบนัสครั้งเดียว
  if (isQuestCleared() && !loop._questShown){
    loop._questShown = true;
    scoreAdd(100, "🎯 เควสสำเร็จ! +100", "#22c55e");
    tone(880, 0.12, 'triangle', 0.18);
    tone(1320, 0.12, 'triangle', 0.18);
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
  if (state.lives <= 0) gameOver();
}

// ---------- Feedback ----------
function feedback(text, color="#38bdf8"){
  const el = document.createElement("a-entity");
  el.setAttribute("text", `value:${text}; width:5.2; align:center; color:${color}`);
  el.setAttribute("position", "0 0.8 0.1");
  root.appendChild(el);
  el.setAttribute("animation__up","property: position; to: 0 1.0 0.1; dur: 420; easing: easeOutQuad");
  setTimeout(()=>{ if (el.parentNode) root.removeChild(el); }, 460);
}

// ---------- Buttons & Input ----------
btnStart.onclick = ()=>{ if (!state.running) startGame(); };
btnReset.onclick = ()=>{
  state.running=false; if(state.rafId) cancelAnimationFrame(state.rafId);
  clearChildren(root); setHUD("พร้อมเริ่ม"); setLivesUI(3); hudQuest.textContent=""; stopMusic();
};
$("btnStart").style.pointerEvents='auto';
$("btnReset").style.pointerEvents='auto';

// ปุ่มเลน HTML
btnL && (btnL.onclick = ()=> setLane(0));
btnC && (btnC.onclick = ()=> setLane(1));
btnR && (btnR.onclick = ()=> setLane(2));

// ป้ายในฉาก (fuse/click)
attachLaneButtons();

// คีย์ลัดเดสก์ท็อป: A/S/D หรือ ← ↑ →
window.addEventListener('keydown',(e)=>{
  const k = e.key.toLowerCase();
  if (k==='a' || k==='arrowleft')  setLane(0);
  if (k==='s' || k==='arrowup')    setLane(1);
  if (k==='d' || k==='arrowright') setLane(2);
});

// Mouse Look Toggle (เปิด/ปิด pointer-events ของ a-scene ผ่าน class บน body)
mouseLookToggle && mouseLookToggle.addEventListener('change', ()=>{
  if (mouseLookToggle.checked){
    document.body.classList.add('mouse-look');
  }else{
    document.body.classList.remove('mouse-look');
  }
});

// Init UI
setHUD("พร้อมเริ่ม\nวิธีย้ายเลน: ปุ่ม Left/Center/Right • คีย์ ← ↑ → หรือ A/S/D • หรือเล็งป้ายในฉาก");
setLivesUI(3);
