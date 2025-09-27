// Fitness Adventure VR — Hand-Tracking Pinch + Beat/QTE + Extra Stages
// No external assets, WebAudio SFX, A-Frame 1.5.x
// Analytics via Plausible (GAME_ID="Fitness")

//////////////////////
// Analytics Helper //
//////////////////////
const GAME_ID = "Fitness";
function track(eventName, props={}) {
  try { if (window.plausible) window.plausible(eventName, { props: { game: GAME_ID, ...props } }); } catch(e){}
}

//////////////////////
// Simple WebAudio  //
//////////////////////
const SFX = (() => {
  let ctx;
  const ensure = () => { if (!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)(); return ctx; };
  const tone = (f=880,d=0.12,t='sine',v=0.22)=>{
    const ac=ensure(), o=ac.createOscillator(), g=ac.createGain();
    o.type=t; o.frequency.value=f;
    const now=ac.currentTime;
    g.gain.setValueAtTime(0,now);
    g.gain.linearRampToValueAtTime(v,now+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,now+d);
    o.connect(g).connect(ac.destination); o.start(now); o.stop(now+d+0.02);
  };
  return { ui:()=>tone(1000,0.08,'square',0.2), ok:()=>tone(1200,0.1,'square',0.2),
           bad:()=>tone(240,0.2,'sawtooth',0.25), tick:()=>tone(900,0.05,'square',0.2) };
})();

//////////////////////
// DOM / HUD Refs   //
//////////////////////
const HUD = {
  mode: modeText, diff: diffText, stage: stageText, goal: goalText,
  time: timeText, score: scoreText, prog: progressText, meter: meterBar,
  status: status, btnPractice, btnChallenge, btnStart, btnNext, btnReset,
  btnExport, selDiff, chkBeat, selBpm
};

//////////////////////
// Game State       //
//////////////////////
let MODE='Practice', DIFF='Normal';
let running=false, startedAt=0, elapsed=0, score=0;
let stageIndex=0, taskIndex=0, timerLimit=60;

// Beat/QTE
let BEAT_ON=false, BPM=100, beatIntSec=0.6, nextBeat=0;

const DIFF_CFG = {
  Easy:   { time:70,  bonus:10, penalty:5,  window:1.3 },
  Normal: { time:60,  bonus:15, penalty:8,  window:1.0 },
  Hard:   { time:45,  bonus:20, penalty:12, window:0.8 },
};

// ด่านพื้นฐาน + ด่านเพิ่ม
const stages = [
  { id:'reach',   name:'Warmup — Reach',     color:'#22d3ee', kind:'reach',  tasks: buildTasks('REACH', 8)  },
  { id:'step',    name:'Side Steps',         color:'#a78bfa', kind:'step',   tasks: buildTasks('STEP', 10)  },
  { id:'squat',   name:'Squats',             color:'#34d399', kind:'squat',  tasks: buildTasks('SQUAT', 8)  },
  { id:'punch',   name:'Punch Targets',      color:'#f97316', kind:'punch',  tasks: buildTasks('PUNCH', 12) },
  // โหมดด่านเพิ่ม
  { id:'endurance', name:'Endurance Run',    color:'#38bdf8', kind:'mixed',  tasks: buildTasks('MIX', 18)   },
  { id:'combo',     name:'Combo Rush',       color:'#ef4444', kind:'combo',  tasks: buildTasks('COMBO', 16) },
];

function buildTasks(type, n){
  const arr=[];
  for (let i=0;i<n;i++){
    const x = -1.0 + Math.random()*2.0;
    const y =  0.9 + Math.random()*1.0;
    // random subtype for mixed/combo
    const sub = (type==='MIX'||type==='COMBO') ? ['REACH','STEP','SQUAT','PUNCH'][Math.floor(Math.random()*4)] : type;
    arr.push({ type: sub, x, y, hit:false });
  }
  return arr;
}

//////////////////////
// Scene Roots      //
//////////////////////
const arena = document.getElementById('arena');
const fingerCursor = document.getElementById('fingerCursor');
const handR = document.getElementById('handR');
const handL = document.getElementById('handL');

//////////////////////
// Session Log      //
//////////////////////
let sessionLog = { startedAt:null, mode:MODE, difficulty:DIFF, stages:[] };

//////////////////////
// Hand Tracking    //
//////////////////////
let pinchUsingEvents=false, isPinching=false, wasPinching=false;
function setPinching(v){ isPinching=v; fingerCursor.setAttribute('color', v?'#66ff88':'#ffffaa'); }
['pinchstarted','pinchended'].forEach(ev=>{
  handR.addEventListener(ev, ()=>{pinchUsingEvents=true; setPinching(ev==='pinchstarted');});
  handL.addEventListener(ev, ()=>{pinchUsingEvents=true; setPinching(ev==='pinchstarted');});
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

//////////////////////
// A-Frame Loop     //
//////////////////////
AFRAME.registerComponent('fitness-game', {
  init(){
    this.last = performance.now()/1000;

    HUD.btnPractice.onclick = ()=>{ MODE='Practice'; HUD.mode.textContent='Practice'; SFX.ui(); };
    HUD.btnChallenge.onclick= ()=>{ MODE='Challenge'; HUD.mode.textContent='Challenge'; SFX.ui(); };
    HUD.selDiff.onchange    = ()=>{ DIFF=HUD.selDiff.value; HUD.diff.textContent=DIFF; SFX.ui(); };

    HUD.chkBeat.onchange    = ()=>{ BEAT_ON=HUD.chkBeat.checked; SFX.ui(); };
    HUD.selBpm.onchange     = ()=>{ BPM=parseInt(HUD.selBpm.value,10)||100; beatIntSec=60/BPM; SFX.ui(); };

    HUD.btnStart.onclick    = startGame;
    HUD.btnNext.onclick     = nextStage;
    HUD.btnReset.onclick    = resetGame;
    HUD.btnExport.onclick   = exportJSON;

    // init defaults
    BPM = parseInt(HUD.selBpm.value,10)||100;
    beatIntSec = 60/BPM;

    resetGame();
  },
  tick(){
    const t = performance.now()/1000, dt=t-this.last; this.last=t;
    // Finger cursor follow
    pollPinchFallback();
    const tip = indexTipWorld();
    if (tip){ fingerCursor.object3D.position.copy(tip); fingerCursor.setAttribute('visible', true); }
    else    { fingerCursor.setAttribute('visible', false); }

    // Pinch rising-edge → hit target if overlapping
    if (!wasPinching && isPinching){
      const hit = tip && currentTarget && intersectsObj(tip, currentTarget.object3D);
      if (hit) hitTarget();
    }
    wasPinching = isPinching;

    if (!running) return;

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

    // Beat/QTE: spawn target on beat if enabled and no active target
    if (BEAT_ON){
      if (t >= nextBeat){
        SFX.tick(); // metronome tick
        nextBeat = t + beatIntSec;
        if (!currentTarget){ spawnTarget(true/*fromBeat*/); }
      }
    }
  }
});
document.getElementById('game').setAttribute('fitness-game','');

//////////////////////
// Build Stage UI   //
//////////////////////
function buildStage(i){
  clearArena();
  const st = stages[i];
  HUD.stage.textContent = st.name;
  HUD.goal.textContent = BEAT_ON ? `ทำเป้าตามจังหวะ ${BPM} BPM` : 'ตี/แตะเป้าตามลำดับ';
  taskIndex = 0;

  // พื้น
  const floor = document.createElement('a-circle');
  floor.setAttribute('radius','3.2'); floor.setAttribute('color','#0b1220'); floor.setAttribute('position','0 0 -2.2');
  floor.setAttribute('rotation','-90 0 0'); arena.appendChild(floor);

  // ป้ายชื่อด่าน
  const title = document.createElement('a-entity');
  title.setAttribute('text', `value:${st.name}; align:center; color:#CFE8FF; width:6`);
  title.setAttribute('position', '0 2.2 -2.21'); arena.appendChild(title);

  // แถบ/วงพื้นตามชนิดด่าน
  addStageMarkers(st);

  // เป้าแรก: ถ้า Beat Sync → รอจังหวะ, ถ้าไม่ → สปาวน์ทันที
  if (!BEAT_ON) spawnTarget(false);
  updateProgress();
  HUD.status.textContent = BEAT_ON ? `รอจังหวะแรก… (${BPM} BPM)` : 'เล็ง/คลิกเป้าที่ไฮไลต์';
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
// Targets / Tasks  //
//////////////////////
let currentTarget = null, targetTimer=null;

function spawnTarget(fromBeat=false){
  const st = stages[stageIndex];
  if (taskIndex >= st.tasks.length){ // stage complete
    SFX.ok(); HUD.status.textContent = `สำเร็จ: ${st.name} ✔ กด Next Stage`;
    running=false; pushStageLog(); return;
  }

  const task = st.tasks[taskIndex];

  // ลูกกลมเรืองแสงเป็นเป้า
  currentTarget = document.createElement('a-sphere');
  currentTarget.setAttribute('radius','0.15');
  currentTarget.setAttribute('color', st.color);
  currentTarget.setAttribute('position', `${task.x.toFixed(3)} ${task.y.toFixed(3)} -2.0`);
  currentTarget.setAttribute('shader','flat');
  currentTarget.classList.add('target');
  currentTarget.addEventListener('click', hitTarget);
  arena.appendChild(currentTarget);

  // หน้าต่างเวลา (QTE) ตาม DIFF และ BPM
  clearTimeout(targetTimer);
  let winSec = DIFF_CFG[DIFF].window;
  if (fromBeat){ // ถ้าสปาวน์ตามจังหวะ ให้หน้าต่าง ~80% ของความยาว 1 beat
    winSec = Math.min(winSec, beatIntSec * 0.8);
  }
  if (MODE==='Challenge'){
    targetTimer = setTimeout(()=>missTarget(), Math.max(500, winSec*1000));
  }
}

function hitTarget(){
  const st = stages[stageIndex];
  const task = st.tasks[taskIndex];
  task.hit = true; task.time = +elapsed.toFixed(2);

  score += DIFF_CFG[DIFF].bonus;
  HUD.score.textContent = score;
  SFX.ok();

  // เอฟเฟ็กต์เล็กน้อย + ลบเป้า
  if (currentTarget){
    currentTarget.setAttribute('color','#ffffff');
    setTimeout(()=>{ if (currentTarget && currentTarget.parentNode) currentTarget.parentNode.removeChild(currentTarget); }, 40);
  }

  taskIndex++; updateProgress();
  if (BEAT_ON){
    // ถ้าตามจังหวะ ให้รอ beat ถัดไป
    HUD.status.textContent = `ดีมาก! รอจังหวะต่อไป (${BPM} BPM)`;
    currentTarget = null;
  } else {
    spawnTarget(false);
  }
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
  if (!BEAT_ON) spawnTarget(false); // ถ้าไม่ตาม beat ให้สปาวน์ทันที
}

function updateProgress(){
  const st = stages[stageIndex];
  HUD.prog.textContent = `${Math.min(taskIndex, st.tasks.length)} / ${st.tasks.length}`;
  const p = Math.round((taskIndex/st.tasks.length)*100);
  HUD.meter.style.width = `${p}%`;
}

// ตรวจชนกันระหว่างนิ้วกับเป้า (AABB)
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

  // Beat init
  BEAT_ON = HUD.chkBeat.checked;
  BPM     = parseInt(HUD.selBpm.value,10)||100;
  beatIntSec = 60/BPM;
  nextBeat   = performance.now()/1000 + beatIntSec; // cue แรก

  buildStage(stageIndex);
  HUD.time.textContent = MODE==='Challenge' ? `${timerLimit.toFixed(0)}s` : '0.0s';
  HUD.score.textContent = '0';
  HUD.status.textContent = BEAT_ON ? `เริ่มแล้ว (Beat ${BPM} BPM)` : 'เริ่มแล้ว!';

  track('GameStart', { mode: MODE, difficulty: DIFF, beat: BEAT_ON?BPM:null });
}

function nextStage(){
  if (running && MODE==='Challenge'){ SFX.bad(); } // ข้ามระหว่างจับเวลา
  running=true;
  timerLimit = DIFF_CFG[DIFF].time;
  startedAt = performance.now()/1000; elapsed=0;

  stageIndex = (stageIndex + 1) % stages.length;
  taskIndex  = 0;

  // Beat sync ต่อเนื่อง
  nextBeat = performance.now()/1000 + beatIntSec;

  buildStage(stageIndex);
  HUD.time.textContent = MODE==='Challenge' ? `${timerLimit.toFixed(0)}s` : '0.0s';
}

function resetGame(){
  running=false; score=0; stageIndex=0; taskIndex=0; elapsed=0;
  HUD.time.textContent='—'; HUD.score.textContent='0'; HUD.prog.textContent='0 / 0';
  HUD.status.textContent='กด Start เพื่อเริ่ม';
  HUD.meter.style.width='0%';
  clearArena();
  clearTimeout(targetTimer);
  currentTarget=null;
}

//////////////////////
// Logging & Export //
//////////////////////
function pushStageLog(){
  const st = stages[stageIndex];
  const summary = {
    id: st.id, name: st.name, count: st.tasks.length,
    hits: st.tasks.filter(t=>t.hit).length,
    timeUsed: +elapsed.toFixed(2),
    scoreAfter: score,
    beat: BEAT_ON ? BPM : null
  };
  sessionLog.stages.push(summary);
}

function exportJSON(){
  const payload = {
    version: '1.1',
    game: GAME_ID,
    mode: MODE, difficulty: DIFF,
    startedAt: sessionLog.startedAt || new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    totalScore: score,
    stages: sessionLog.stages
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const now = new Date(); const pad=n=>String(n).padStart(2,'0');
  const filename = `fitness_session_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);

  track('GameFinish', { score, stages: sessionLog.stages.length, mode: MODE, difficulty: DIFF, beat: BEAT_ON?BPM:null });
}
