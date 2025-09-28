// Fitness Adventure VR — Full game.js (OK Click + Fuse 1200ms with Gradient Progress Ring + Wobble)
// Features: Hand-tracking pinch, Beat/QTE, Extra Stages, Plausible Analytics
// Place at: webxr-health-mobile/fitness-adventure/game.js

//////////////////////
// Analytics Helper //
//////////////////////
const GAME_ID = "Fitness";
function track(eventName, props = {}) {
  try {
    if (window.plausible) window.plausible(eventName, { props: { game: GAME_ID, ...props } });
  } catch (e) {}
}

//////////////////////
// Simple WebAudio  //
//////////////////////
const SFX = (() => {
  let ctx;
  const ensure = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; };
  const tone = (f = 880, d = 0.12, t = 'sine', v = 0.22) => {
    const ac = ensure(), o = ac.createOscillator(), g = ac.createGain();
    o.type = t; o.frequency.value = f;
    const now = ac.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(v, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
    o.connect(g).connect(ac.destination); o.start(now); o.stop(now + d + 0.02);
  };
  return { ui:()=>tone(1000,0.08,'square',0.2), ok:()=>tone(1200,0.10,'square',0.2), bad:()=>tone(240,0.20,'sawtooth',0.25), tick:()=>tone(900,0.05,'square',0.2) };
})();

//////////////////////
// DOM / HUD Refs   //
//////////////////////
const $ = id => document.getElementById(id);
const HUD = { mode: $('modeText'), diff: $('diffText'), stage: $('stageText'), goal: $('goalText'),
  time: $('timeText'), score: $('scoreText'), prog: $('progressText'), meter: $('meterBar'), status: $('status') };
const BTN = { practice:$('btnPractice'), challenge:$('btnChallenge'), start:$('btnStart'), next:$('btnNext'), reset:$('btnReset'), export:$('btnExport') };
const UI  = { selDiff:$('selDiff'), chkBeat:$('chkBeat'), selBpm:$('selBpm') };

//////////////////////
// Scene References //
//////////////////////
const arena        = $('arena');
const fingerCursor = $('fingerCursor');
const handR        = $('handR');
const handL        = $('handL');
const centerCursor = $('centerCursor');
const fuseProgress = $('fuseProgress');

//////////////////////
// Game State       //
//////////////////////
let MODE='Practice', DIFF='Normal';
let running=false, startedAt=0, elapsed=0, score=0;
let stageIndex=0, taskIndex=0, timerLimit=60;
let BEAT_ON=false, BPM=100, beatIntSec=0.6, nextBeat=0;

// Difficulty config
const DIFF_CFG = {
  Easy:   { time:70,  bonus:10, penalty:5,  window:1.3 },
  Normal: { time:60,  bonus:15, penalty:8,  window:1.0 },
  Hard:   { time:45,  bonus:20, penalty:12, window:0.8 }
};

// Progress Ring style per difficulty (gradient + thickness + speed)
const RING_STYLE = {
  Easy:   { colorStart:'#22c55e', colorEnd:'#06b6d4', inner:0.020, outer:0.036, fuseMs:1200 },
  Normal: { colorStart:'#fde047', colorEnd:'#f59e0b', inner:0.023, outer:0.033, fuseMs:1200 },
  Hard:   { colorStart:'#f472b6', colorEnd:'#ef4444', inner:0.025, outer:0.031, fuseMs:1200 }
};

//////////////////////
// Stages / Tasks   //
//////////////////////
const stages = [
  { id:'reach',    name:'Warmup — Reach',   color:'#22d3ee', kind:'reach',  tasks: buildTasks('REACH', 8)  },
  { id:'step',     name:'Side Steps',       color:'#a78bfa', kind:'step',   tasks: buildTasks('STEP', 10)  },
  { id:'squat',    name:'Squats',           color:'#34d399', kind:'squat',  tasks: buildTasks('SQUAT', 8)  },
  { id:'punch',    name:'Punch Targets',    color:'#f97316', kind:'punch',  tasks: buildTasks('PUNCH', 12) },
  { id:'endurance',name:'Endurance Run',    color:'#38bdf8', kind:'mixed',  tasks: buildTasks('MIX', 18)   },
  { id:'combo',    name:'Combo Rush',       color:'#ef4444', kind:'combo',  tasks: buildTasks('COMBO', 16) }
];
function buildTasks(type, n){
  const arr=[]; for(let i=0;i<n;i++){
    const x = -1.0 + Math.random()*2.0; const y = 0.9 + Math.random()*1.0;
    const sub = (type==='MIX'||type==='COMBO') ? ['REACH','STEP','SQUAT','PUNCH'][Math.floor(Math.random()*4)] : type;
    arr.push({ type: sub, x, y, hit:false });
  } return arr;
}

//////////////////////
// Session Log      //
//////////////////////
let sessionLog = { startedAt:null, mode:MODE, difficulty:DIFF, stages:[] };

//////////////////////
// Hand Tracking    //
//////////////////////
let pinchUsingEvents=false, isPinching=false, wasPinching=false;
function setPinching(v){ isPinching=v; if (fingerCursor) fingerCursor.setAttribute('color', v?'#66ff88':'#ffffaa'); }
['pinchstarted','pinchended'].forEach(ev=>{
  if (handR) handR.addEventListener(ev, ()=>{pinchUsingEvents=true; setPinching(ev==='pinchstarted');});
  if (handL) handL.addEventListener(ev, ()=>{pinchUsingEvents=true; setPinching(ev==='pinchstarted');});
});
const PINCH_ON=0.025, PINCH_OFF=0.035;
function getJointWorldPos(handEnt, nameLike){
  if (!handEnt) return null;
  let node=null; handEnt.object3D.traverse(n=>{ if(n.name && n.name.toLowerCase().includes(nameLike)) node=n; });
  if (!node) return null; const v=new THREE.Vector3(); node.getWorldPosition(v); return v;
}
function indexTipWorld(){
  const ent = (handR && handR.object3D.children.length) ? handR :
              (handL && handL.object3D.children.length) ? handL : null;
  if (!ent) return null; return getJointWorldPos(ent,'index-finger-tip');
}
function pollPinchFallback(){
  if (pinchUsingEvents) return;
  const ent = (handR && handR.object3D.children.length) ? handR :
              (handL && handL.object3D.children.length) ? handL : null;
  if (!ent){ setPinching(false); return; }
  const tip = getJointWorldPos(ent,'index-finger-tip');
  const thb = getJointWorldPos(ent,'thumb-tip');
  if (!tip || !thb){ setPinching(false); return; }
  const d = tip.distanceTo(thb);
  if (!isPinching && d < PINCH_ON) setPinching(true);
  else if (isPinching && d > PINCH_OFF) setPinching(false);
}

/////////////////////////////
// Gradient Progress Ring  //
/////////////////////////////
const fuseCanvas = document.createElement('canvas');
fuseCanvas.id = 'fuseCanvas';
fuseCanvas.width = 256; fuseCanvas.height = 256; fuseCanvas.style.display='none';
document.body.appendChild(fuseCanvas);
const fuseCtx = fuseCanvas.getContext('2d');
// bind canvas to plane material
fuseProgress.setAttribute('material', `shader: flat; src: #${fuseCanvas.id}; transparent: true; alphaTest: 0.01`);

let ringInner = 0.023, ringOuter = 0.033; // normalized (0..1) → จะคูณเป็น px ตอนวาด
let gradStart = '#22c55e', gradEnd = '#06b6d4';

let fuseActive=false, fuseStartMs=0, fuseDurMs=1200;

function lerpColor(a, b, t){
  const ah = parseInt(a.replace('#',''), 16), ar=(ah>>16)&255, ag=(ah>>8)&255, ab=ah&255;
  const bh = parseInt(b.replace('#',''), 16), br=(bh>>16)&255, bg=(bh>>8)&255, bb=bh&255;
  const rr = Math.round(ar + (br-ar)*t), gg = Math.round(ag + (bg-ag)*t), bb2 = Math.round(ab + (bb-ab)*t);
  return '#'+((1<<24) + (rr<<16) + (gg<<8) + bb2).toString(16).slice(1);
}
function drawGradientDonut(ratio){
  const s = fuseCanvas.width, cx = s/2, cy = s/2;
  const R = s * 0.45;
  const thickPx = Math.max(1, Math.floor((ringOuter - ringInner) * s * 0.8));
  const startAng = -Math.PI/2;
  const endAng = startAng + (Math.max(0, Math.min(1, ratio)) * Math.PI*2);

  fuseCtx.clearRect(0,0,s,s);
  for (let t=0; t<thickPx; t++){
    const r = R - t;
    const midRatio = Math.min(1, Math.max(0, ratio*0.85 + (t/thickPx)*0.15));
    const col = lerpColor(gradStart, gradEnd, midRatio);
    fuseCtx.strokeStyle = col;
    fuseCtx.lineWidth = 1.8;
    fuseCtx.beginPath();
    fuseCtx.arc(cx, cy, r, startAng, endAng, false);
    fuseCtx.stroke();
  }
  const mat = fuseProgress.getObject3D('mesh')?.material;
  if (mat && mat.map) mat.map.needsUpdate = true;
}
function resetFuseProgress(){
  fuseActive = false;
  drawGradientDonut(0);
  centerCursor.setAttribute('scale', '1 1 1');
}
function applyCursorStyleForDifficulty(){
  const st = RING_STYLE[DIFF] || RING_STYLE.Normal;
  fuseDurMs = st.fuseMs;
  centerCursor.setAttribute('cursor', `rayOrigin: entity; fuse: true; fuseTimeout: ${fuseDurMs}`);

  ringInner = st.inner; ringOuter = st.outer;
  gradStart = st.colorStart; gradEnd = st.colorEnd;

  const baseColor = (DIFF==='Easy')? '#a7f3d0' : (DIFF==='Hard')? '#fecaca' : '#fde68a';
  centerCursor.setAttribute('material', `color: ${baseColor}; shader: flat; opacity: 0.95`);

  resetFuseProgress();
}

function updateFuseRing(){
  if (fuseActive){
    const now = performance.now();
    const ratio = Math.min(1, (now - fuseStartMs) / fuseDurMs);
    drawGradientDonut(ratio);

    if (ratio >= 0.85){
      const wobble = 1 + 0.05 * Math.sin(now * 0.02 * Math.PI); // สั่นเบา ๆ
      centerCursor.setAttribute('scale', `${wobble} ${wobble} ${wobble}`);
    } else {
      centerCursor.setAttribute('scale', '1 1 1');
    }
  } else {
    centerCursor.setAttribute('scale', '1 1 1');
  }
  requestAnimationFrame(updateFuseRing);
}
requestAnimationFrame(updateFuseRing);

// cursor events
centerCursor.addEventListener('mouseenter', (e)=>{
  if (e && e.detail && e.detail.intersectedEl) { fuseActive = true; fuseStartMs = performance.now(); }
});
centerCursor.addEventListener('mouseleave', resetFuseProgress);
centerCursor.addEventListener('click', resetFuseProgress);
centerCursor.addEventListener('fusing', ()=> centerCursor.setAttribute('material','opacity:1'));

//////////////////////
// A-Frame Component//
//////////////////////
AFRAME.registerComponent('fitness-game', {
  init(){
    this.last = performance.now()/1000;

    // UI events
    BTN.practice.onclick = ()=>{ MODE='Practice'; HUD.mode.textContent='Practice'; SFX.ui(); };
    BTN.challenge.onclick= ()=>{ MODE='Challenge'; HUD.mode.textContent='Challenge'; SFX.ui(); };

    UI.selDiff.onchange  = ()=>{ DIFF = UI.selDiff.value; HUD.diff.textContent = DIFF; applyCursorStyleForDifficulty(); SFX.ui(); };
    UI.chkBeat.onchange  = ()=>{ BEAT_ON = UI.chkBeat.checked; SFX.ui(); };
    UI.selBpm.onchange   = ()=>{ BPM = parseInt(UI.selBpm.value,10)||100; beatIntSec = 60/BPM; SFX.ui(); };

    BTN.start.onclick    = startGame;
    BTN.next.onclick     = nextStage;
    BTN.reset.onclick    = resetGame;
    BTN.export.onclick   = exportJSON;

    // defaults
    BPM = parseInt(UI.selBpm.value,10) || 100;
    beatIntSec = 60 / BPM;

    applyCursorStyleForDifficulty();
    resetGame();
  },

  tick(){
    const t = performance.now()/1000, dt = t - this.last; this.last = t;

    // hand-tracking follow + pinch
    pollPinchFallback();
    const tip = indexTipWorld();
    if (tip){ fingerCursor.object3D.position.copy(tip); fingerCursor.setAttribute('visible', true); }
    else    { fingerCursor.setAttribute('visible', false); }

    // pinch rising edge → hit if intersecting current target
    if (!wasPinching && isPinching){
      const hit = tip && currentTarget && intersectsObj(tip, currentTarget.object3D);
      if (hit) hitTarget();
    }
    wasPinching = isPinching;

    if (!running) return;

    // timer
    elapsed = t - startedAt;
    if (MODE==='Challenge'){
      const remain = Math.max(0, timerLimit - elapsed);
      HUD.time.textContent = remain.toFixed(1)+'s';
      HUD.meter.style.width = `${(remain / timerLimit)*100}%`;
      if (remain<=0){ SFX.bad(); HUD.status.textContent='หมดเวลา! กด Next Stage'; running=false; pushStageLog(); }
    } else {
      HUD.time.textContent = elapsed.toFixed(1)+'s';
      HUD.meter.style.width = '100%';
    }

    // Beat/QTE spawn
    if (BEAT_ON){
      if (t >= nextBeat){
        SFX.tick(); nextBeat = t + beatIntSec;
        if (!currentTarget) spawnTarget(true);
      }
    }
  }
});
$('game').setAttribute('fitness-game','');

//////////////////////
// Stage Build      //
//////////////////////
function buildStage(i){
  clearArena();
  const st = stages[i];
  HUD.stage.textContent = st.name;
  HUD.goal.textContent  = BEAT_ON ? `ทำเป้าตามจังหวะ ${BPM} BPM` : 'ตี/แตะเป้าตามลำดับ';
  taskIndex = 0;

  const floor = document.createElement('a-circle');
  floor.setAttribute('radius','3.2'); floor.setAttribute('color','#0b1220'); floor.setAttribute('position','0 0 -2.2');
  floor.setAttribute('rotation','-90 0 0'); arena.appendChild(floor);

  const title = document.createElement('a-entity');
  title.setAttribute('text', `value:${st.name}; align:center; color:#CFE8FF; width:6`);
  title.setAttribute('position', '0 2.2 -2.21'); arena.appendChild(title);

  addStageMarkers(st);
  if (!BEAT_ON) spawnTarget(false);
  updateProgress();
  HUD.status.textContent = BEAT_ON ? `รอจังหวะแรก… (${BPM} BPM)` : 'เล็ง crosshair แล้วกด OK หรือจ้อง 1.2 วิ';
}
function addStageMarkers(st){
  if (st.kind==='step' || st.kind==='squat' || st.kind==='combo'){
    const ring=document.createElement('a-ring');
    ring.setAttribute('radius-inner','0.35'); ring.setAttribute('radius-outer','0.45');
    ring.setAttribute('position', `0 0 -2.0`); ring.setAttribute('rotation','-90 0 0');
    ring.setAttribute('color', st.kind==='squat' ? '#34d399' : '#94a3b8');
    ring.setAttribute('opacity','0.6');
    arena.appendChild(ring);
  }
}
function clearArena(){ while(arena.firstChild) arena.removeChild(arena.firstChild); }

//////////////////////
// Targets / QTE    //
//////////////////////
let currentTarget = null, targetTimer = null;

function spawnTarget(fromBeat=false){
  const st = stages[stageIndex];
  if (taskIndex >= st.tasks.length){
    SFX.ok(); HUD.status.textContent = `สำเร็จ: ${st.name} ✔ กด Next Stage`;
    running=false; pushStageLog(); return;
  }
  const task = st.tasks[taskIndex];

  currentTarget = document.createElement('a-sphere');
  currentTarget.setAttribute('radius','0.15');
  currentTarget.setAttribute('color', st.color);
  currentTarget.setAttribute('position', `${task.x.toFixed(3)} ${task.y.toFixed(3)} -2.0`);
  currentTarget.setAttribute('shader','flat');
  currentTarget.classList.add('target','clickable');

  currentTarget.addEventListener('click', hitTarget);
  currentTarget.addEventListener('mouseenter', ()=> currentTarget.setAttribute('scale','1.2 1.2 1.2'));
  currentTarget.addEventListener('mouseleave', ()=> currentTarget.setAttribute('scale','1 1 1'));

  arena.appendChild(currentTarget);

  clearTimeout(targetTimer);
  let winSec = DIFF_CFG[DIFF].window;
  if (fromBeat) winSec = Math.min(winSec, beatIntSec * 0.8);
  if (MODE==='Challenge'){
    targetTimer = setTimeout(()=>missTarget(), Math.max(500, winSec*1000));
  }
}
function hitTarget(){
  const st = stages[stageIndex];
  const task = st.tasks[taskIndex];
  if (task.hit) return;
  task.hit = true; task.time = +elapsed.toFixed(2);

  score += DIFF_CFG[DIFF].bonus;
  HUD.score.textContent = score;
  SFX.ok();

  if (currentTarget){
    currentTarget.setAttribute('color','#ffffff');
    setTimeout(()=>{ if (currentTarget && currentTarget.parentNode) currentTarget.parentNode.removeChild(currentTarget); }, 40);
  }

  taskIndex++; updateProgress();
  if (BEAT_ON){ HUD.status.textContent = `ดีมาก! รอจังหวะต่อไป (${BPM} BPM)`; currentTarget = null; }
  else { spawnTarget(false); }
}
function missTarget(){
  const st = stages[stageIndex];
  const task = st.tasks[taskIndex];
  task.hit = false; task.time = +elapsed.toFixed(2);

  if (MODE==='Challenge'){
    score = Math.max(0, score - DIFF_CFG[DIFF].penalty);
    HUD.score.textContent = score;
    SFX.bad();
  }
  if (currentTarget && currentTarget.parentNode) currentTarget.parentNode.removeChild(currentTarget);
  currentTarget = null;

  taskIndex++; updateProgress();
  if (!BEAT_ON) spawnTarget(false);
}
function updateProgress(){
  const st = stages[stageIndex];
  HUD.prog.textContent = `${Math.min(taskIndex, st.tasks.length)} / ${st.tasks.length}`;
  HUD.meter.style.width = `${Math.round((taskIndex/st.tasks.length)*100)}%`;
}
function intersectsObj(worldPos, obj3D){
  obj3D.updateWorldMatrix(true,true);
  const box = new THREE.Box3().setFromObject(obj3D);
  return box.containsPoint(worldPos);
}

//////////////////////
// Flow Control     //
//////////////////////
function startGame(){
  sessionLog = { startedAt:new Date().toISOString(), mode:MODE, difficulty:DIFF, stages:[] };
  startedAt = performance.now()/1000; elapsed=0; score=0;
  timerLimit = DIFF_CFG[DIFF].time;
  stageIndex=0; taskIndex=0; running=true;

  BEAT_ON = !!UI.chkBeat.checked;
  BPM = parseInt(UI.selBpm.value,10)||100;
  beatIntSec = 60/BPM; nextBeat = performance.now()/1000 + beatIntSec;

  applyCursorStyleForDifficulty();
  buildStage(stageIndex);

  HUD.time.textContent = (MODE==='Challenge') ? `${timerLimit.toFixed(0)}s` : '0.0s';
  HUD.score.textContent = '0';
  HUD.status.textContent = BEAT_ON ? `เริ่มแล้ว (Beat ${BPM} BPM)` : 'เริ่มแล้ว! เล็ง crosshair แล้วกด OK หรือจ้อง 1.2 วิ';

  track('GameStart', { mode: MODE, difficulty: DIFF, beat: BEAT_ON?BPM:null });
}
function nextStage(){
  if (running && MODE==='Challenge'){ SFX.bad(); }
  running=true; timerLimit = DIFF_CFG[DIFF].time;
  startedAt = performance.now()/1000; elapsed=0;

  stageIndex = (stageIndex + 1) % stages.length;
  taskIndex  = 0; nextBeat = performance.now()/1000 + beatIntSec;

  buildStage(stageIndex);
  HUD.time.textContent = (MODE==='Challenge') ? `${timerLimit.toFixed(0)}s` : '0.0s';
}
function resetGame(){
  running=false; score=0; stageIndex=0; taskIndex=0; elapsed=0;
  HUD.time.textContent='—'; HUD.score.textContent='0'; HUD.prog.textContent='0 / 0';
  HUD.status.textContent='กด Start เพื่อเริ่ม';
  HUD.meter.style.width='0%';
  clearArena(); clearTimeout(targetTimer); currentTarget=null; resetFuseProgress();
}

//////////////////////
// Logging & Export //
//////////////////////
function pushStageLog(){
  const st = stages[stageIndex];
  sessionLog.stages.push({
    id: st.id, name: st.name, count: st.tasks.length,
    hits: st.tasks.filter(t=>t.hit).length, timeUsed: +elapsed.toFixed(2),
    scoreAfter: score, beat: BEAT_ON ? BPM : null
  });
}
function exportJSON(){
  const payload = {
    version: '1.4',
    game: GAME_ID, mode: MODE, difficulty: DIFF,
    startedAt: sessionLog.startedAt || new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    totalScore: score, stages: sessionLog.stages
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const now=new Date(); const pad=n=>String(n).padStart(2,'0');
  const filename=`fitness_session_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
  track('GameFinish', { score, stages: sessionLog.stages.length, mode: MODE, difficulty: DIFF, beat: BEAT_ON?BPM:null });
}
