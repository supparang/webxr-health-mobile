// Personal Hygiene VR — Full Version (All-in-One game.js)
// Features: Hand-tracking + Pinch (events + fallback), QTE, Export JSON,
// Demo Brush (5 zones, 2 min, metronome), Demo Handwash (7 steps + bubbles)

///////////////////////////////
//  SFX (WebAudio, no assets)
///////////////////////////////
const SFX = (() => {
  let ctx;
  const ensure = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; };
  const tone = (f=880,d=0.12,t='sine',v=0.22)=>{
    const ac=ensure(), o=ac.createOscillator(), g=ac.createGain();
    o.type=t; o.frequency.value=f;
    const now=ac.currentTime;
    g.gain.setValueAtTime(0,now);
    g.gain.linearRampToValueAtTime(v,now+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now+d);
    o.connect(g).connect(ac.destination);
    o.start(now); o.stop(now+d+0.02);
  };
  return {
    ui:  ()=>tone(1000,0.08,'square',0.2),
    ok:  ()=>tone(1200,0.10,'square',0.2),
    bad: ()=>tone( 240,0.20,'sawtooth',0.25),
    tick:()=>tone( 900,0.05,'square',0.2)
  };
})();

///////////////////////////////
//  HUD & DOM Refs
///////////////////////////////
const HUD = {
  mode: document.getElementById('modeText'),
  diff: document.getElementById('diffText'),
  station: document.getElementById('stationText'),
  goal: document.getElementById('goalText'),
  time: document.getElementById('timeText'),
  score: document.getElementById('scoreText'),
  prog: document.getElementById('progressText'),
  status: document.getElementById('status'),
  // controls
  btnPractice: document.getElementById('btnPractice'),
  btnChallenge: document.getElementById('btnChallenge'),
  btnStart: document.getElementById('btnStart'),
  btnNext: document.getElementById('btnNext'),
  btnReset: document.getElementById('btnReset'),
  btnExport: document.getElementById('btnExport'),
  selDiff: document.getElementById('selDiff'),
  btnDemo: document.getElementById('btnDemo'),
  btnDemoWash: document.getElementById('btnDemoWash'),
  // quiz
  quizBox: document.getElementById('quiz'),
  quizQ: document.getElementById('quizQ'),
  quizA: document.getElementById('quizA'),
  quizClose: document.getElementById('quizClose'),
};

///////////////////////////////
//  Game State & Config
///////////////////////////////
let MODE='Practice', DIFF='Normal';
let running=false, startedAt=0, elapsed=0, score=0;
let stationIndex=0, stepIndex=0, timerLimit=90;

const DIFF_CFG = {
  Easy:   { time:110, penalty: 5, bonus:15, qteTime:1.6 },
  Normal: { time: 90, penalty: 8, bonus:20, qteTime:1.3 },
  Hard:   { time: 75, penalty:12, bonus:25, qteTime:1.0 },
};

const stations = [
  { id:'handwash',  name:'ล้างมือ 7 ขั้น',   color:'#2563eb',
    steps:['ฝ่ามือถูฝ่ามือ','ฝ่ามือถูหลังมือ','ถูซอกนิ้ว','ถูหลังนิ้วมือ','ถูนิ้วหัวแม่มือ','ถูปลายนิ้ว/เล็บ','ล้าง/เช็ดให้แห้ง'] },
  { id:'toothbrush',name:'แปรงฟัน 5 โซน',  color:'#10b981',
    steps:['แปรงด้านนอกฟันบน','แปรงด้านในฟันบน','แปรงด้านนอกฟันล่าง','แปรงด้านในฟันล่าง','แปรงผิวบดเคี้ยว'] },
  { id:'cough',     name:'ไอ-จามถูกวิธี',  color:'#f59e0b',
    steps:['ยกข้อพับข้อศอก','ปิดปาก/จมูกด้วยข้อพับ','เว้นระยะห่าง','ทิ้งทิชชู (ถ้ามี)','ล้างมือหลังไอ/จาม'] },
  { id:'waste',     name:'ทิ้งขยะ/แยกหน้ากาก', color:'#ef4444',
    steps:['หยิบหน้ากากใช้แล้ว','พับด้านปนเปื้อนเข้าด้านใน','ทิ้งลงถังมีฝาปิด','ล้างมือด้วยเจล','ตรวจความสะอาดพื้นที่'] },
];

const QUIZ = [
  { q:'ควรถูสบู่ล้างมือนานอย่างน้อยกี่วินาที?', a:['10','20','45'], correct:1 },
  { q:'เวลาไอ-จามควรปิดปากด้วยอะไร?', a:['ฝ่ามือ','ข้อพับแขน','ชายเสื้อ'], correct:1 },
  { q:'หน้ากากใช้แล้วควรทิ้งที่ใด?', a:['ขยะทั่วไป','ขยะติดเชื้อ/มีฝาปิด','โต๊ะ'], correct:1 },
  { q:'ควรแปรงฟันอย่างน้อยกี่นาที?', a:['0.5','1','2'], correct:2 },
];

///////////////////////////////
//  Scene Roots
///////////////////////////////
const stageRoot    = document.getElementById('stage');
const demoRoot     = document.getElementById('demo');
const qteRoot      = document.getElementById('qteTarget');
const fingerCursor = document.getElementById('fingerCursor');
const handR        = document.getElementById('handR');
const handL        = document.getElementById('handL');

///////////////////////////////
//  Session log
///////////////////////////////
let sessionLog = { startedAt:null, mode:MODE, difficulty:DIFF, stations:[] };

///////////////////////////////
//  Hand-tracking: pinch
///////////////////////////////
let pinchUsingEvents=false, isPinching=false, wasPinching=false;
function setPinching(v){ isPinching=v; fingerCursor.setAttribute('color', v?'#66ff88':'#ffffaa'); }

['pinchstarted','pinchended'].forEach(ev=>{
  handR.addEventListener(ev, ()=>{pinchUsingEvents=true; setPinching(ev==='pinchstarted');});
  handL.addEventListener(ev, ()=>{pinchUsingEvents=true; setPinching(ev==='pinchstarted');});
});

// fallback: thumb-tip ↔ index-tip distance (meters)
const PINCH_ON=0.025, PINCH_OFF=0.035;

function getJointWorldPos(handEnt, nameLike){
  if (!handEnt) return null;
  let node=null;
  handEnt.object3D.traverse(n=>{ if(n.name && n.name.toLowerCase().includes(nameLike)) node=n; });
  if (!node) return null;
  const v=new THREE.Vector3(); node.getWorldPosition(v); return v;
}

function getIndexTipWorldPos(){
  const ent = (handR && handR.object3D.children.length) ? handR :
              (handL && handL.object3D.children.length) ? handL : null;
  if (!ent) return null;
  return getJointWorldPos(ent,'index-finger-tip');
}

function pollPinchFallback(){
  if (pinchUsingEvents) return;
  const ent = (handR && handR.object3D.children.length) ? handR :
              (handL && handL.object3D.children.length) ? handL : null;
  if (!ent){ setPinching(false); return; }
  const tip = getJointWorldPos(ent,'index-finger-tip');
  const thb = getJointWorldPos(ent,'thumb-tip');
  if (!tip || !thb){ setPinching(false); return; }
  const dist = tip.distanceTo(thb);
  if (!isPinching && dist < PINCH_ON) setPinching(true);
  else if (isPinching && dist > PINCH_OFF) setPinching(false);
}

///////////////////////////////
//  Finger-cursor hit test
///////////////////////////////
function intersectStepAt(worldPos){
  const steps = Array.from(stageRoot.querySelectorAll('.step'));
  for (const el of steps){
    const obj = el.object3D; obj.updateWorldMatrix(true,true);
    const box = new THREE.Box3().setFromObject(obj);
    if (box.containsPoint(worldPos)) return el;
    box.expandByScalar(0.01);
    if (box.containsPoint(worldPos)) return el;
  }
  return null;
}
function triggerStepByEntity(el){
  const k=+el.getAttribute('data-index');
  if (el.getAttribute('data-lock')==='1') return;
  el.setAttribute('data-lock','1');
  setTimeout(()=>el.setAttribute('data-lock','0'), 250);
  onClickStep(k);
}

///////////////////////////////
//  A-Frame game loop
///////////////////////////////
AFRAME.registerComponent('phygiene-game', {
  init(){
    this.last = performance.now()/1000;

    // UI bindings
    HUD.btnPractice.onclick = ()=>{ MODE='Practice';  HUD.mode.textContent='Practice';  SFX.ui(); };
    HUD.btnChallenge.onclick= ()=>{ MODE='Challenge'; HUD.mode.textContent='Challenge'; SFX.ui(); };
    HUD.selDiff.onchange    = ()=>{ DIFF=HUD.selDiff.value; HUD.diff.textContent=DIFF; SFX.ui(); };
    HUD.btnStart.onclick    = startGame;
    HUD.btnNext.onclick     = nextStation;
    HUD.btnReset.onclick    = resetGame;
    HUD.btnExport.onclick   = exportJSON;
    HUD.btnDemo.onclick     = playBrushDemo;
    HUD.btnDemoWash.onclick = playHandwashDemo;
    HUD.quizClose.onclick   = ()=>{ HUD.quizBox.style.display='none'; };

    resetGame();
  },
  tick(){
    const t=performance.now()/1000, dt=t-this.last; this.last=t;

    // timer
    if (running){
      elapsed = t - startedAt;
      if (MODE==='Challenge'){
        const remain = Math.max(0, timerLimit - elapsed);
        HUD.time.textContent = remain.toFixed(1)+'s';
        if (remain<=0){ addStationLog(); HUD.status.textContent='หมดเวลา! กด Next Station'; SFX.bad(); running=false; }
      } else {
        HUD.time.textContent = elapsed.toFixed(1) + 's';
      }
    }

    // pinch poll + finger marker
    pollPinchFallback();
    const tip = getIndexTipWorldPos();
    if (tip){ fingerCursor.object3D.position.copy(tip); fingerCursor.setAttribute('visible', true); }
    else    { fingerCursor.setAttribute('visible', false); }

    // pinch rising-edge → click
    if (!wasPinching && isPinching){
      // step
      const hit = tip && intersectStepAt(tip);
      if (hit) triggerStepByEntity(hit);
      // QTE
      if (qte.active && qte.target){
        const box = new THREE.Box3().setFromObject(qte.target.object3D);
        if (tip && box.containsPoint(tip)) onQTEHit();
      }
    }
    wasPinching = isPinching;

    // QTE pulse / timeout
    updateQTE(dt);
  }
});
document.getElementById('game').setAttribute('phygiene-game','');

///////////////////////////////
//  Build Station & Interactions
///////////////////////////////
function buildStation(i){
  clearStage();
  const st=stations[i];
  HUD.station.textContent = st.name;
  HUD.goal.textContent = 'ทำตามลำดับที่ไฮไลต์';
  stepIndex=0;

  // board
  const board=document.createElement('a-box');
  board.setAttribute('color','#1f2937');
  board.setAttribute('width','4.8'); board.setAttribute('height','2.2'); board.setAttribute('depth','0.2');
  board.setAttribute('position','0 1.3 -2.2');
  stageRoot.appendChild(board);

  // title
  const title=document.createElement('a-entity');
  title.setAttribute('text', `value:${st.name}; align:center; color:#CFE8FF; width:6`);
  title.setAttribute('position','0 2.2 -2.21');
  stageRoot.appendChild(title);

  // steps grid (3 cols)
  for (let k=0;k<st.steps.length;k++){
    const r=(k/3|0), c=(k%3);
    const x=-1.6 + c*1.6, y=1.8 - r*0.7;

    const box=document.createElement('a-box');
    box.setAttribute('color', st.color);
    box.setAttribute('width','1.2'); box.setAttribute('height','0.36'); box.setAttribute('depth','0.25');
    box.setAttribute('position', `${x} ${y} -2.1`);
    box.setAttribute('opacity','0.55');
    box.setAttribute('class','step');
    box.setAttribute('data-index', k);

    const label=document.createElement('a-entity');
    label.setAttribute('text', `value:${k+1}. ${st.steps[k]}; align:center; color:#fff; width:3`);
    label.setAttribute('position','0 0 0.16');
    box.appendChild(label);

    box.addEventListener('click', ()=>onClickStep(k));
    stageRoot.appendChild(box);
  }

  highlightStep(0);
  updateProgress();
  HUD.status.textContent = 'ทำตามลำดับ (กล่องสว่างคือขั้นถัดไป)';
}

function highlightStep(k){
  Array.from(stageRoot.querySelectorAll('.step')).forEach(el=>{
    const idx = +el.getAttribute('data-index');
    el.setAttribute('opacity', idx===k ? '0.98' : (idx<k ? '0.25' : '0.55'));
    el.setAttribute('emissive', idx===k ? '#ffffff' : '#000000');
  });
}

function updateProgress(){
  const st=stations[stationIndex];
  HUD.prog.textContent = `${Math.min(stepIndex, st.steps.length)} / ${st.steps.length}`;
}

function onClickStep(k){
  if (!running) return;
  const st=stations[stationIndex];
  if (k!==stepIndex){
    if (MODE==='Challenge'){ score=Math.max(0, score-DIFF_CFG[DIFF].penalty); HUD.score.textContent=score; }
    HUD.status.textContent = 'ยังไม่ใช่ขั้นนี้!'; SFX.bad(); return;
  }
  stepIndex++; score+=DIFF_CFG[DIFF].bonus; HUD.score.textContent=score; SFX.ok();
  highlightStep(stepIndex); updateProgress();

  if (stepIndex<st.steps.length && Math.random()<0.4) spawnQTE();

  if (stepIndex>=st.steps.length){
    addStationLog();
    HUD.status.textContent = `สำเร็จ: ${st.name} ✔ กด Next Station`;
    running=false;
    showQuiz();
  }
}

///////////////////////////////
//  QTE (Quick-Time Event)
///////////////////////////////
let qte={ active:false, time:0, limit:1.2, target:null };

function spawnQTE(){
  if (qte.active) return;
  qte.active=true; qte.time=0; qte.limit=DIFF_CFG[DIFF].qteTime;

  while(qteRoot.firstChild) qteRoot.removeChild(qteRoot.firstChild);
  const ring=document.createElement('a-ring');
  ring.setAttribute('radius-inner','0.07'); ring.setAttribute('radius-outer','0.12');
  ring.setAttribute('color','#ffe066');
  ring.setAttribute('position', `${-0.8+Math.random()*1.6} ${1.1+Math.random()*0.6} -2.0`);
  ring.setAttribute('shader','flat');
  ring.addEventListener('click', onQTEHit);
  qteRoot.appendChild(ring);
  qteRoot.setAttribute('visible', true);
  qte.target=ring;

  HUD.status.textContent='QTE! แตะวงเรืองแสงให้ทันเวลา';
}

function onQTEHit(){
  if (!qte.active) return;
  qte.active=false; qteRoot.setAttribute('visible', false);
  score += 10; HUD.score.textContent=score; HUD.status.textContent='เยี่ยม! โบนัส QTE +10'; SFX.ok();
}

function updateQTE(dt){
  if (!qte.active) return;
  qte.time += dt;
  const s = 1 + Math.sin(performance.now()/200)*0.12;
  qte.target.setAttribute('scale', `${s} ${s} ${s}`);
  if (qte.time >= qte.limit){
    qte.active=false; qteRoot.setAttribute('visible', false);
    HUD.status.textContent='พลาด QTE'; SFX.bad();
  }
}

///////////////////////////////
//  Demo: Brush (5 zones, 2min, metronome)
///////////////////////////////
function formatClock(sec){
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s/60), r=s%60;
  return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}

let demoBrushState = { running:false, rafId:0, metInt:0 };

function stopBrushDemo(){
  if (!demoBrushState.running) return;
  demoBrushState.running=false;
  if (demoBrushState.rafId) cancelAnimationFrame(demoBrushState.rafId);
  if (demoBrushState.metInt) clearInterval(demoBrushState.metInt);
  while(demoRoot.firstChild) demoRoot.removeChild(demoRoot.firstChild);
  HUD.status.textContent = 'หยุดเดโมแปรงฟัน';
}

function playBrushDemo(){
  // reset demo
  stopBrushDemo();

  const baseZ = -1.2;
  demoBrushState = {
    running: true,
    bpm: 60,
    totalSec: 120,
    zoneDur: 24,
    zones: [
      { key:'U-outer',  label:'บน – ด้านนอก',  y:0.80 },
      { key:'U-inner',  label:'บน – ด้านใน',  y:0.62 },
      { key:'L-outer',  label:'ล่าง – ด้านนอก', y:0.26 },
      { key:'L-inner',  label:'ล่าง – ด้านใน',  y:0.08 },
      { key:'occlusal', label:'ผิวบดเคี้ยว',  y:0.44 },
    ],
    bars: [],
    brush: null,
    hand:  null,
    rafId: 0,
    startTs: performance.now()/1000,
    metInt: 0
  };

  // bars + labels
  demoBrushState.zones.forEach((z,i)=>{
    const bar=document.createElement('a-box');
    bar.setAttribute('color','#e5e7eb');
    bar.setAttribute('width','1.6'); bar.setAttribute('height','0.15'); bar.setAttribute('depth','0.12');
    bar.setAttribute('position',`0 ${z.y} ${baseZ}`); bar.setAttribute('opacity','0.7');
    demoRoot.appendChild(bar);
    demoBrushState.bars.push(bar);

    const lbl=document.createElement('a-entity');
    lbl.setAttribute('text', `value:${i+1}. ${z.label}; align:right; color:#CFE8FF; width:4`);
    lbl.setAttribute('position', `-1.2 ${z.y} ${baseZ+0.001}`);
    demoRoot.appendChild(lbl);
  });

  // brush + hand
  const brush=document.createElement('a-box');
  brush.setAttribute('color','#60a5fa');
  brush.setAttribute('width','0.7'); brush.setAttribute('height','0.06'); brush.setAttribute('depth','0.06');
  brush.setAttribute('position', `-0.7 ${demoBrushState.zones[0].y} ${baseZ+0.06}`);
  demoRoot.appendChild(brush);

  const hand=document.createElement('a-sphere');
  hand.setAttribute('radius','0.08'); hand.setAttribute('color','#fcd7b6');
  hand.setAttribute('position', `-0.45 ${demoBrushState.zones[0].y} ${baseZ+0.14}`);
  demoRoot.appendChild(hand);

  demoBrushState.brush=brush; demoBrushState.hand=hand;

  // metronome @ 60BPM
  demoBrushState.metInt = setInterval(()=>{
    const elapsed = performance.now()/1000 - demoBrushState.startTs;
    const remain  = Math.max(0, demoBrushState.totalSec - elapsed);
    const k = Math.ceil(remain) % demoBrushState.zoneDur;
    if (k===0) SFX.ok(); else SFX.tick();
  }, 1000);

  // loop
  const loop = ()=>{
    if (!demoBrushState.running) return;
    const now = performance.now()/1000;
    const elapsed = now - demoBrushState.startTs;
    const remain  = Math.max(0, demoBrushState.totalSec - elapsed);

    // HUD time + zone
    HUD.time.textContent = formatClock(remain);
    const zoneIdx = Math.min(4, Math.floor(elapsed / demoBrushState.zoneDur));
    const zone    = demoBrushState.zones[zoneIdx];
    HUD.status.textContent = `เดโมแปรงฟัน • โซน ${zoneIdx+1}/5: ${zone.label} • เหลือ ${formatClock(remain)}`;

    // highlight active bar
    demoBrushState.bars.forEach((b,i)=> b.setAttribute('color', i===zoneIdx?'#93c5fd':'#e5e7eb'));

    // sweep left-right per zone
    const t = (elapsed % demoBrushState.zoneDur);
    const phase = (t % 2.0)/2.0;               // back & forth every 2s
    const dir = (Math.floor(t/2.0)%2) ? -1 : 1;
    const x = -0.7 + dir * phase * 1.4;
    brush.setAttribute('position', `${x} ${zone.y} ${baseZ+0.06}`);
    hand .setAttribute('position', `${x+0.25} ${zone.y} ${baseZ+0.14}`);

    if (zone.key==='occlusal'){ // small wobble for chewing surfaces
      const wobble = Math.sin(performance.now()/200) * 0.02;
      brush.object3D.position.y = zone.y + wobble;
      hand .object3D.position.y = zone.y + wobble + 0.04;
    }

    if (elapsed >= demoBrushState.totalSec){
      stopBrushDemo(); SFX.ok();
      HUD.time.textContent='00:00';
      HUD.status.textContent='เดโมแปรงฟัน (5 โซน) เสร็จสิ้น ✔';
      return;
    }
    demoBrushState.rafId = requestAnimationFrame(loop);
  };
  SFX.ui();
  loop();
}

///////////////////////////////
//  Demo: Handwash (7 steps + bubbles)
///////////////////////////////
function playHandwashDemo(){
  while(demoRoot.firstChild) demoRoot.removeChild(demoRoot.firstChild);
  const steps = stations.find(s=>s.id==='handwash').steps;

  // abstract hands
  const left = document.createElement('a-box');
  left.setAttribute('color','#fcd7b6'); left.setAttribute('width','0.35'); left.setAttribute('height','0.2'); left.setAttribute('depth','0.12');
  left.setAttribute('position','-0.3 1.0 -1.3'); demoRoot.appendChild(left);

  const right= document.createElement('a-box');
  right.setAttribute('color','#fcd7b6'); right.setAttribute('width','0.35'); right.setAttribute('height','0.2'); right.setAttribute('depth','0.12');
  right.setAttribute('position','0.3 1.0 -1.3');  demoRoot.appendChild(right);

  // caption
  const caption = document.createElement('a-entity');
  caption.setAttribute('text','value:ขั้นที่ 1; align:center; color:#CFE8FF; width:6');
  caption.setAttribute('position','0 1.6 -1.31'); demoRoot.appendChild(caption);

  // bubbles
  const bubbleTimer = setInterval(()=>{
    const b=document.createElement('a-sphere');
    b.setAttribute('radius','0.02'); b.setAttribute('color','#b3e5fc');
    b.setAttribute('position', `${-0.05+Math.random()*0.1} ${0.95+Math.random()*0.1} -1.3`);
    demoRoot.appendChild(b);
    let t=0; (function anim(){ t+=0.016; b.object3D.position.y += 0.12*0.016; b.object3D.scale.setScalar(1+0.5*t);
      if (t>1.2) { b.remove(); return; } requestAnimationFrame(anim); })();
  }, 220);

  // step animation
  let i=0, phaseT=0, rafId=0;
  function setCap(k){ caption.setAttribute('text',`value:${k+1}. ${steps[k]}; align:center; color:#CFE8FF; width:6`); }

  function stepMotion(k){
    const l=left.object3D, r=right.object3D;
    switch(k){
      case 0: l.position.x = -0.15 + Math.sin(phaseT*4)*0.05; r.position.x =  0.15 - Math.sin(phaseT*4)*0.05; break;
      case 1: r.rotation.z = Math.sin(phaseT*3)*0.3; l.position.x=-0.2; r.position.x=0.2; break;
      case 2: l.position.y = 1.0 + Math.sin(phaseT*6)*0.04; r.position.y = 1.0 - Math.sin(phaseT*6)*0.04; break;
      case 3: l.rotation.z = Math.sin(phaseT*3)*0.25; r.rotation.z = -Math.sin(phaseT*3)*0.25; break;
      case 4: r.rotation.y = Math.sin(phaseT*6)*0.5; break;
      case 5: l.position.x = -0.3 + Math.sin(phaseT*10)*0.03; r.position.x = 0.3 - Math.sin(phaseT*10)*0.03; break;
      case 6: l.position.y = 0.95 + Math.abs(Math.sin(phaseT*2))*0.08; r.position.y = 0.95 + Math.abs(Math.sin(phaseT*2))*0.08; break;
    }
  }

  setCap(0); SFX.ui();
  (function loop(){
    phaseT += 0.016;
    stepMotion(i);
    if (phaseT>2.0){
      i++; phaseT=0;
      if (i<steps.length){ setCap(i); SFX.tick(); }
      else {
        clearInterval(bubbleTimer); SFX.ok();
        HUD.status.textContent='เดโมล้างมือเสร็จสิ้น ✔';
        cancelAnimationFrame(rafId); return;
      }
    }
    rafId = requestAnimationFrame(loop);
  })();

  HUD.status.textContent='เดโมล้างมือ 7 ขั้น: ชมการเคลื่อนไหวต่อเนื่อง';
}

///////////////////////////////
//  Flow, Quiz, Export
///////////////////////////////
function startGame(){
  sessionLog = { startedAt:new Date().toISOString(), mode:MODE, difficulty:DIFF, stations:[] };
  startedAt=performance.now()/1000; elapsed=0; score=0; timerLimit=DIFF_CFG[DIFF].time;
  stationIndex=0; stepIndex=0; running=true;
  buildStation(stationIndex);
  HUD.time.textContent = MODE==='Challenge'?`${timerLimit.toFixed(0)}s`:'0.0s';
  HUD.score.textContent = '0';
  HUD.status.textContent = 'เริ่มแล้ว!';
}

function nextStation(){
  if (running && MODE==='Challenge'){ SFX.bad(); }
  running=true; timerLimit=DIFF_CFG[DIFF].time; startedAt=performance.now()/1000; elapsed=0;
  stationIndex=(stationIndex+1)%stations.length; stepIndex=0;
  buildStation(stationIndex);
  HUD.time.textContent = MODE==='Challenge'?`${timerLimit.toFixed(0)}s`:'0.0s';
}

function resetGame(){
  running=false; score=0; stationIndex=0; stepIndex=0; elapsed=0;
  HUD.time.textContent='—'; HUD.score.textContent='0'; HUD.prog.textContent='0 / 0';
  HUD.status.textContent='กด Start เพื่อเริ่ม';
  clearStage();
  while(demoRoot.firstChild) demoRoot.removeChild(demoRoot.firstChild);
  qte.active=false; qteRoot.setAttribute('visible', false);
  stopBrushDemo(); // สำคัญ: หยุดเดโมแปรงฟัน หากกำลังทำงาน
}

function clearStage(){ while(stageRoot.firstChild) stageRoot.removeChild(stageRoot.firstChild); }

function showQuiz(){
  const q=QUIZ[(Math.random()*QUIZ.length)|0];
  HUD.quizQ.textContent = q.q;
  HUD.quizA.innerHTML = '';
  q.a.forEach((text,i)=>{
    const b=document.createElement('button');
    b.textContent = text;
    b.onclick=()=>{ if (i===q.correct){ score+=10; HUD.score.textContent=score; HUD.status.textContent='ตอบถูก +10'; SFX.ok(); }
                    else { HUD.status.textContent='ยังไม่ถูก'; SFX.bad(); }
                    HUD.quizBox.style.display='none'; };
    HUD.quizA.appendChild(b);
  });
  HUD.quizBox.style.display='block';
}

function addStationLog(){
  const st=stations[stationIndex];
  sessionLog.stations.push({
    id:st.id, name:st.name,
    stepsDone:stepIndex, totalSteps:st.steps.length,
    timeUsed:+elapsed.toFixed(2), scoreAfter:score
  });
}

function exportJSON(){
  const payload = {
    version:'1.2',
    mode:MODE, difficulty:DIFF,
    startedAt: sessionLog.startedAt || new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    totalScore: score,
    stations: sessionLog.stations
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const now = new Date(); const pad=n=>String(n).padStart(2,'0');
  const name = `hygiene_session_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
  HUD.status.textContent = `Export แล้ว: ${name}`; SFX.ok();
}
