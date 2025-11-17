// ===========================
// Rhythm Boxer – Research v1.0.0 (Production Ready)
// ===========================

// ---- CONFIG ----
const MUSIC_SRC = './assets/music-basic-120bpm.mp3';
const ENABLE_MUSIC = false;          // เปิดเมื่อพร้อมไฟล์เพลง
const ENABLE_CLOUD_LOG = false;      // เปิดเมื่อมี Google Apps Script URL
const ENABLE_FX = true;

// Metadata
const GAME_ID = 'rhythm-boxer';
const GAME_VERSION = '1.0.0-research';

// Phase
const phase = new URLSearchParams(location.search).get('phase') || 'train';

// DOM
const form = document.getElementById('metaForm');
const msg = document.getElementById('coachMsg');
const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('scoreTxt');
const resultBox = document.getElementById('resultBox');
const laneL = document.getElementById('laneL');
const laneM = document.getElementById('laneM');
const laneR = document.getElementById('laneR');
const rScore = document.getElementById('rScore');
const rCombo = document.getElementById('rCombo');
const rAccuracy = document.getElementById('rAccuracy');
const rHitMiss = document.getElementById('rHitMiss');
const btnStart = document.getElementById('btnStart');
const btnDownload = document.getElementById('btnDownload');

// Gameplay variables
let playing=false, timeLeft=30, score=0, combo=0, maxCombo=0, hit=0, missed=0;
let spawnTimer=null, gameTimer=null, patternInterval=650;

// Phase display
document.getElementById('phaseText').innerText = `Phase: ${phase.toUpperCase()}`;

// Start
btnStart.addEventListener('click', startGame);

function startGame(){
  if(!validateForm()) return;
  form.style.display='none';
  msg.innerText='เริ่มได้!';
  playing=true;
  timeLeft=30; score=0; combo=0; maxCombo=0; hit=0; missed=0;

  gameTimer=setInterval(()=>{
    timeLeft--;
    timerEl.innerText=`⏱ ${timeLeft}s`;
    if(timeLeft<=0) endGame();
  },1000);

  spawnTimer=setInterval(spawnBeat, patternInterval);
}

function validateForm(){
  if(!studentName.value.trim() || !studentId.value.trim()) {
    msg.innerText='กรอกข้อมูลให้ครบก่อนเล่น';
    return false;
  }
  return true;
}

function spawnBeat(){
  const lanes=[laneL,laneM,laneR];
  const target=lanes[Math.floor(Math.random()*3)];
  target.classList.add('active');
  setTimeout(()=>target.classList.remove('active'),550);
}

function registerHit(){
  if(!playing) return;
  score+=10;
  hit++;
  combo++;
  if(combo>maxCombo) maxCombo=combo;
  updateUI();
}

function registerMiss(){
  if(!playing) return;
  missed++;
  combo=0;
  updateUI();
}

function updateUI(){
  scoreEl.innerText=`⭐ คะแนน: ${score} | 🔁 คอมโบ: ${combo}`;
}

// Controls – PC
document.addEventListener('keydown', e=>{
  if(e.key==='a' || e.key==='A') checkLane(laneL);
  if(e.key==='s' || e.key==='S') checkLane(laneM);
  if(e.key==='d' || e.key==='D') checkLane(laneR);
});

// Mobile
laneL.addEventListener('click',()=>checkLane(laneL));
laneM.addEventListener('click',()=>checkLane(laneM));
laneR.addEventListener('click',()=>checkLane(laneR));

function checkLane(lane){
  if(lane.classList.contains('active')) registerHit();
  else registerMiss();
}

// End
function endGame(){
  playing=false;
  clearInterval(gameTimer);
  clearInterval(spawnTimer);
  showResult();
}

function showResult(){
  const totalAttempts = hit + missed;
  const accuracy = totalAttempts > 0 ? Math.round((hit/totalAttempts)*100) : 0;
  msg.innerText='จบเกมแล้ว!';
  rScore.innerText=`คะแนนรวม: ${score}`;
  rCombo.innerText=`คอมโบสูงสุด: ${maxCombo}`;
  rAccuracy.innerText=`ความแม่นยำ: ${accuracy}%`;
  rHitMiss.innerText=`โดน: ${hit} พลาด: ${missed}`;
  resultBox.style.display='block';

  saveLocalRecord({
    gameId:GAME_ID,
    gameVersion:GAME_VERSION,
    phase,
    studentName:studentName.value.trim(),
    studentId:studentId.value.trim(),
    school:school.value.trim(),
    classRoom:classRoom.value.trim(),
    groupCode:groupCode.value.trim(),
    score,
    comboMax:maxCombo,
    hit,
    missed,
    accuracy,
    timeSec:30
  });
}

// Save Local
function saveLocalRecord(rec){
  let records = JSON.parse(localStorage.getItem('rb_records')||'[]');
  records.push(rec);
  localStorage.setItem('rb_records', JSON.stringify(records));
}

// CSV
btnDownload.addEventListener('click', downloadCSV);
function downloadCSV(){
  const records = JSON.parse(localStorage.getItem('rb_records')||'[]');
  if(records.length===0) return;

  let csv = "gameId,gameVersion,phase,studentName,studentId,school,classRoom,groupCode,score,comboMax,hit,missed,accuracy,timeSec\n";
  records.forEach(r=>{
    csv += `${r.gameId},${r.gameVersion},${r.phase},${r.studentName},${r.studentId},${r.school},${r.classRoom},${r.groupCode},${r.score},${r.comboMax},${r.hit},${r.missed},${r.accuracy},${r.timeSec}\n`;
  });

  const blob = new Blob([csv], { type:"text/csv" });
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download="rhythm-boxer-records.csv";
  a.click();
}