// Personal Hygiene VR — Practice/Challenge, stations, progress, quiz, export (no external assets)

// --- WebAudio SFX (beep / ok / bad) ---
const SFX = (() => {
  let ctx;
  const ensure = () => { if(!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)(); return ctx; };
  const tone = (f=880,d=0.12,t='sine',v=0.22)=>{ const ac=ensure(); const o=ac.createOscillator(), g=ac.createGain();
    o.type=t; o.frequency.value=f; const now=ac.currentTime;
    g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(v,now+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+d);
    o.connect(g).connect(ac.destination); o.start(now); o.stop(now+d+0.02); };
  return { ui:()=>tone(1000,0.08,'square',0.2), ok:()=>tone(1200,0.1,'square',0.2), bad:()=>tone(240,0.2,'sawtooth',0.25) };
})();

// --- UI refs ---
const HUD = {
  mode: document.getElementById('modeText'),
  diff: document.getElementById('diffText'),
  station: document.getElementById('stationText'),
  goal: document.getElementById('goalText'),
  time: document.getElementById('timeText'),
  score: document.getElementById('scoreText'),
  prog: document.getElementById('progressText'),
  status: document.getElementById('status'),
  btnPractice: document.getElementById('btnPractice'),
  btnChallenge: document.getElementById('btnChallenge'),
  btnStart: document.getElementById('btnStart'),
  btnNext: document.getElementById('btnNext'),
  btnReset: document.getElementById('btnReset'),
  btnExport: document.getElementById('btnExport'),
  selDiff: document.getElementById('selDiff'),
  quizBox: document.getElementById('quiz'),
  quizQ: document.getElementById('quizQ'),
  quizA: document.getElementById('quizA'),
  quizClose: document.getElementById('quizClose')
};

// --- Game state ---
let MODE = 'Practice';
let DIFF = 'Normal';
let running = false, startedAt = 0, elapsed = 0;
let score = 0;
let stationIndex = 0; // 0..stations.length-1
let stepIndex = 0;    // progress within station
let timerLimit = 90;  // Challenge time per station base
const DIFF_CFG = {
  Easy:   { time: 110, penalty: 5, bonus: 15 },
  Normal: { time: 90,  penalty: 8, bonus: 20 },
  Hard:   { time: 75,  penalty: 12, bonus: 25 },
};

// --- Stations definition ---
const stations = [
  {
    id:'handwash',
    name:'ล้างมือ 7 ขั้น',
    color:'#2563eb',
    steps:[
      'ฝ่ามือถูฝ่ามือ',
      'ฝ่ามือถูหลังมือ',
      'ถูซอกนิ้ว',
      'ถูหลังนิ้วมือ',
      'ถูนิ้วหัวแม่มือ',
      'ถูปลายนิ้ว/เล็บ',
      'ล้าง/เช็ดให้แห้ง'
    ]
  },
  {
    id:'toothbrush',
    name:'แปรงฟัน 5 โซน',
    color:'#10b981',
    steps:[
      'แปรงด่านนอกฟันบน',
      'แปรงด้านในฟันบน',
      'แปรงด่านนอกฟันล่าง',
      'แปรงด้านในฟันล่าง',
      'แปรงผิวบดเคี้ยว'
    ]
  },
  {
    id:'cough',
    name:'ไอ-จามถูกวิธี',
    color:'#f59e0b',
    steps:[
      'ยกข้อพับข้อศอก',
      'ปิดปาก/จมูกด้วยข้อพับ',
      'หลบคนอื่น/เว้นระยะ',
      'ทิ้งทิชชู (ถ้ามี)',
      'ล้างมือหลังไอ/จาม'
    ]
  },
  {
    id:'waste',
    name:'ทิ้งขยะ/แยกหน้ากาก',
    color:'#ef4444',
    steps:[
      'หยิบหน้ากากใช้แล้ว',
      'พับด้านปนเปื้อนเข้าข้างใน',
      'ทิ้งลงถังขยะติดเชื้อ/ปิดฝา',
      'ทำความสะอาดมือด้วยเจล',
      'เช็คพื้นที่สะอาด'
    ]
  }
];

// --- Quiz bank ---
const QUIZ = [
  { q:'ควรถูสบู่ล้างมือนานอย่างน้อยกี่วินาที?', a:['10 วินาที','20 วินาที','45 วินาที'], correct:1 },
  { q:'เวลาไอ-จามควรปิดปากด้วยอะไร?', a:['ฝ่ามือ','ข้อพับแขนเสื้อ','มือเสื้อผ้า'], correct:1 },
  { q:'หน้ากากใช้แล้วควรทิ้งที่ใด?', a:['ถังขยะแห้งทั่วไป','ถังขยะติดเชื้อ/มีฝาปิด','วางไว้บนโต๊ะ'], correct:1 },
  { q:'ควรแปรงฟันอย่างน้อยกี่นาที?', a:['ครึ่งนาที','1 นาที','2 นาที'], correct:2 }
];

// --- Scene root ---
const stageRoot = document.getElementById('stage');

// --- Results for export ---
let sessionLog = {
  startedAt: null,
  mode: MODE,
  difficulty: DIFF,
  stations: [] // {id,name,stepsDone,totalSteps,timeUsed,scoreDelta}
};

// --- A-Frame game loop for timer only ---
AFRAME.registerComponent('phygiene-game', {
  init(){
    this.last = performance.now()/1000;
    // UI
    HUD.btnPractice.onclick = ()=>{ MODE='Practice'; HUD.mode.textContent='Practice'; SFX.ui(); };
    HUD.btnChallenge.onclick = ()=>{ MODE='Challenge'; HUD.mode.textContent='Challenge'; SFX.ui(); };
    HUD.selDiff.onchange = ()=>{ DIFF = HUD.selDiff.value; HUD.diff.textContent = DIFF; SFX.ui(); };

    HUD.btnStart.onclick = startGame;
    HUD.btnNext.onclick = nextStation;
    HUD.btnReset.onclick = resetGame;
    HUD.btnExport.onclick = exportJSON;

    HUD.quizClose.onclick = ()=>{ HUD.quizBox.style.display='none'; };

    resetGame();
  },
  tick(){
    const t = performance.now()/1000, dt = t - this.last; this.last = t;
    if (!running) return;
    elapsed = t - startedAt;

    if (MODE==='Challenge'){
      const remain = Math.max(0, timerLimit - elapsed);
      HUD.time.textContent = remain.toFixed(1)+'s';
      if (remain<=0){ // time up: fail station
        addStationLog(0);
        HUD.status.textContent = 'หมดเวลา! ย้ายสถานีถัดไป';
        SFX.bad();
        running = false;
      }
    } else {
      HUD.time.textContent = elapsed.toFixed(1)+'s';
    }
  }
});

// --- Build a station board with clickable steps (glow cubes) ---
function buildStation(i){
  clearStage();
  const st = stations[i];
  HUD.station.textContent = st.name;
  HUD.goal.textContent = 'ทำตามลำดับที่ระบบไฮไลต์';
  stepIndex = 0;

  // Board
  const board = document.createElement('a-box');
  board.setAttribute('color', '#1f2937');
  board.setAttribute('width', '4.6');
  board.setAttribute('height','2.2');
  board.setAttribute('depth','0.2');
  board.setAttribute('position','0 1.3 -2.2');
  stageRoot.appendChild(board);

  // Title
  const title = document.createElement('a-entity');
  title.setAttribute('text', `value:${st.name}; align:center; color:#CFE8FF; width:6`);
  title.setAttribute('position', '0 2.2 -2.21');
  stageRoot.appendChild(title);

  // Steps nodes
  const cols = 3;
  const rows = Math.ceil(st.steps.length / cols);
  for (let k=0;k<st.steps.length;k++){
    const r = Math.floor(k/cols);
    const c = k%cols;
    const x = -1.6 + c*1.6;
    const y = 1.8 - r*0.7;

    const box = document.createElement('a-box');
    box.setAttribute('color', st.color);
    box.setAttribute('width','1.2'); box.setAttribute('height','0.36'); box.setAttribute('depth','0.25');
    box.setAttribute('position', `${x} ${y} -2.1`);
    box.setAttribute('opacity','0.55');
    box.setAttribute('class','step');
    box.setAttribute('data-index', k);

    const label = document.createElement('a-entity');
    label.setAttribute('text', `value:${k+1}. ${st.steps[k]}; align:center; color:#fff; width:3`);
    label.setAttribute('position','0 0 0.16');
    box.appendChild(label);

    box.addEventListener('click', ()=> onClickStep(k));
    stageRoot.appendChild(box);
  }

  highlightStep(0);
  updateProgress();
  HUD.status.textContent = 'ทำขั้นตอนตามลำดับ (กล่องสว่างคือขั้นถัดไป)';
}

// --- Highlight next step ---
function highlightStep(k){
  Array.from(stageRoot.querySelectorAll('.step')).forEach(el=>{
    const idx = +el.getAttribute('data-index');
    el.setAttribute('opacity', idx===k ? '0.95' : (idx<k ? '0.25' : '0.55'));
    el.setAttribute('emissive', idx===k ? '#ffffff' : '#000000');
  });
}

// --- Step click logic ---
function onClickStep(k){
  if (!running) return;
  const st = stations[stationIndex];
  if (k !== stepIndex){
    // wrong order: penalty in Challenge
    if (MODE==='Challenge'){ score = Math.max(0, score - DIFF_CFG[DIFF].penalty); HUD.score.textContent = score; }
    HUD.status.textContent = 'ยังไม่ใช่ขั้นนี้! ทำตามลำดับนะ';
    SFX.bad();
    return;
  }
  // correct
  stepIndex++;
  score += DIFF_CFG[DIFF].bonus;
  HUD.score.textContent = score;
  SFX.ok();
  highlightStep(stepIndex);
  updateProgress();

  if (stepIndex >= st.steps.length){
    // station complete
    const timeUsed = elapsed;
    addStationLog(scoreDelta=DIFF_CFG[DIFF].bonus); // minimal delta marker
    HUD.status.textContent = `สำเร็จ: ${st.name} ✔ ต่อไปกด Next Station หรือทำซ้ำ`;
    running = false;

    // random quiz prompt
    showQuiz();
  }
}

function updateProgress(){
  const st = stations[stationIndex];
  HUD.prog.textContent = `${Math.min(stepIndex, st.steps.length)} / ${st.steps.length}`;
}

// --- Flow control ---
function startGame(){
  // initialize session
  sessionLog = { startedAt: new Date().toISOString(), mode: MODE, difficulty: DIFF, stations: [] };
  startedAt = performance.now()/1000; elapsed = 0; score = 0;
  timerLimit = DIFF_CFG[DIFF].time;
  stationIndex = 0; stepIndex = 0;
  running = true;
  buildStation(stationIndex);
  HUD.time.textContent = MODE==='Challenge' ? `${timerLimit.toFixed(0)}s` : '0.0s';
  HUD.score.textContent = '0';
  HUD.status.textContent = 'เริ่มแล้ว! ทำขั้นตอนตามลำดับ';
}

function nextStation(){
  // if still running, consider as skip/fail
  if (running && MODE==='Challenge'){ SFX.bad(); }
  running = true;
  timerLimit = DIFF_CFG[DIFF].time;
  startedAt = performance.now()/1000; elapsed = 0;
  stationIndex = (stationIndex + 1) % stations.length;
  stepIndex = 0;
  buildStation(stationIndex);
  HUD.time.textContent = MODE==='Challenge' ? `${timerLimit.toFixed(0)}s` : '0.0s';
}

function resetGame(){
  running = false; score = 0; stationIndex = 0; stepIndex = 0; elapsed = 0;
  HUD.time.textContent = '—'; HUD.score.textContent = '0'; HUD.prog.textContent='0 / 0';
  HUD.status.textContent = 'กด Start เพื่อเริ่ม';
  clearStage();
}

// --- Stage helpers ---
function clearStage(){ while(stageRoot.firstChild) stageRoot.removeChild(stageRoot.firstChild); }

// --- Quiz ---
function showQuiz(){
  const q = QUIZ[(Math.random()*QUIZ.length)|0];
  HUD.quizQ.textContent = q.q;
  HUD.quizA.innerHTML = '';
  q.a.forEach((text, i)=>{
    const b = document.createElement('button');
    b.textContent = text;
    b.onclick = ()=>{
      if (i===q.correct){ HUD.status.textContent = 'ตอบถูก! +10 คะแนน'; score += 10; HUD.score.textContent = score; SFX.ok(); }
      else { HUD.status.textContent = 'ยังไม่ถูก ลองอ่านแผ่นป้ายคำแนะนำอีกครั้ง'; SFX.bad(); }
      HUD.quizBox.style.display='none';
    };
    HUD.quizA.appendChild(b);
  });
  HUD.quizBox.style.display='block';
}

// --- Session logging per station ---
function addStationLog(scoreDelta){
  const st = stations[stationIndex];
  sessionLog.stations.push({
    id: st.id,
    name: st.name,
    stepsDone: stepIndex,
    totalSteps: st.steps.length,
    timeUsed: +elapsed.toFixed(2),
    scoreAfter: score
  });
}

// --- Export JSON ---
function exportJSON(){
  const payload = {
    version: '1.0',
    mode: MODE,
    difficulty: DIFF,
    startedAt: sessionLog.startedAt || new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    totalScore: score,
    stations: sessionLog.stations
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const now = new Date();
  const pad = n=>String(n).padStart(2,'0');
  const filename = `hygiene_session_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
  HUD.status.textContent = `Export แล้ว: ${filename}`;
  SFX.ok();
}

// attach component
document.getElementById('game').setAttribute('phygiene-game','');
