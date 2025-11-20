// === Rhythm Boxer — 4 Lane Dance Engine (Warm-up / Dance / Cool-down) ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---------- STATE ---------- */
const STATE = {
  running:false,
  mode:'normal',
  diff:'normal',
  startTime:0,
  duration:60000, // 60s
  score:0,
  combo:0,
  maxCombo:0,
  perfect:0,
  miss:0,
  totalHits:0,
  lastPhase:null,
  beatTimer:null,
  lastConfig:null, // เก็บ config ล่าสุดไว้เล่นซ้ำ
};

/* Phase timing แบบง่าย */
const PHASES = [
  { id:'warmup',  start:0,    end:15000, bpmEasy:80,  bpmNormal:90,  bpmHard:100, emoji:'🟢' },
  { id:'dance',   start:15000,end:45000, bpmEasy:95,  bpmNormal:110, bpmHard:125, emoji:'💗' },
  { id:'cool',    start:45000,end:60000, bpmEasy:80,  bpmNormal:88,  bpmHard:96,  emoji:'🔵' },
];

function getPhase(elapsed){
  return PHASES.find(p => elapsed>=p.start && elapsed<p.end) || PHASES[PHASES.length-1];
}

/* ---------- VIEW HELPERS ---------- */
function showView(id){
  for(const v of $$('.card')) v.classList.add('hidden');
  $(id).classList.remove('hidden');
}

/* ---------- ENGINE ---------- */
function startGame(config){
  STATE.running = true;
  STATE.mode    = config.mode;
  STATE.diff    = config.diff;
  STATE.startTime = performance.now();
  STATE.score = STATE.combo = STATE.maxCombo = 0;
  STATE.perfect = STATE.miss = STATE.totalHits = 0;
  STATE.lastPhase = null;
  STATE.lastConfig = config;

  // reset HUD
  $('#stat-mode').textContent = STATE.mode === 'research' ? 'วิจัย' : 'ปกติ';
  $('#stat-diff').textContent =
    STATE.diff === 'easy'   ? 'ง่าย' :
    STATE.diff === 'hard'   ? 'ยาก'  : 'ปกติ';
  $('#stat-score').textContent   = '0';
  $('#stat-combo').textContent   = '0';
  $('#stat-perfect').textContent = '0';
  $('#stat-miss').textContent    = '0';
  $('#groove-fill').style.width  = '0%';
  $('#groove-status').textContent = 'Warm-up';

  // ล้างโน้ตเดิม
  $$('#dance-stage .rb-note').forEach(n => n.remove());

  showView('#view-play');
  loopFrame();
  setupBeatLoop();
}

function setupBeatLoop(){
  if(STATE.beatTimer) clearInterval(STATE.beatTimer);

  let lastBeatTime = performance.now();
  let beatAccum    = 0;

  STATE.beatTimer = setInterval(()=>{
    if(!STATE.running) return;
    const now     = performance.now();
    const elapsed = now - STATE.startTime;
    const phase   = getPhase(elapsed);

    const bpm =
      STATE.diff === 'easy'   ? phase.bpmEasy :
      STATE.diff === 'hard'   ? phase.bpmHard :
                                phase.bpmNormal;

    const beatMs = 60000 / bpm;
    const dt     = now - lastBeatTime;
    lastBeatTime = now;
    beatAccum += dt;

    while(beatAccum >= beatMs){
      beatAccum -= beatMs;
      spawnNoteForPhase(phase);
    }
  }, 30);
}

function spawnNoteForPhase(phase){
  const lanes = [0,1,2,3];

  let useLanes;
  if(phase.id === 'warmup') useLanes = [1,2];
  else if(phase.id === 'dance') useLanes = lanes;
  else useLanes = [0,3];

  const laneIndex = useLanes[Math.floor(Math.random()*useLanes.length)];
  const laneEl = $(`.lane[data-lane="${laneIndex}"]`);
  if(!laneEl) return;

  const note = document.createElement('div');
  note.className = `rb-note ${phase.id}`;
  note.textContent = phase.emoji;
  note.dataset.spawn = performance.now();
  note.dataset.phase = phase.id;

  laneEl.appendChild(note);
  animateNote(note);
}

function animateNote(note){
  const stage = $('#dance-stage');
  const stageRect = stage.getBoundingClientRect();
  const ring = $('.hit-ring');
  const ringRect = ring.getBoundingClientRect();

  const startY = stageRect.top + 40;
  const endY   = ringRect.top + ringRect.height/2;
  const duration = 900;

  const start = performance.now();
  function step(){
    if(!STATE.running){
      if(note.parentNode) note.remove();
      return;
    }
    const t  = performance.now() - start;
    const k  = t / duration;
    if(k >= 1){
      if(note.parentNode){
        registerHit(note, 'Miss', true);
        note.remove();
      }
      return;
    }
    const y = startY + (endY - startY)*k;
    note.style.top = (y - stageRect.top) + 'px';
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  note.addEventListener('pointerdown', (ev)=>{
    ev.stopPropagation();
    ev.preventDefault();
    if(!STATE.running || !note.parentNode) return;
    judgeTiming(note);
  }, {passive:false});
}

function judgeTiming(note){
  const spawn = Number(note.dataset.spawn);
  const now   = performance.now();
  const elapsedFromSpawn = now - spawn;

  const ideal = 900;
  const diff  = Math.abs(elapsedFromSpawn - ideal);

  let grade;
  if(diff <= 80) grade = 'Perfect';
  else if(diff <= 160) grade = 'Good';
  else grade = 'Miss';

  registerHit(note, grade, grade==='Miss');
  note.remove();
}

function registerHit(note, grade, isMiss){
  const phaseId = note.dataset.phase || 'dance';
  const phase   = PHASES.find(p => p.id === phaseId) || PHASES[1];

  STATE.totalHits++;

  if(isMiss || grade === 'Miss'){
    STATE.combo = 0;
    STATE.miss++;
    updateGroove(-8);
  }else{
    STATE.combo++;
    if(STATE.combo > STATE.maxCombo) STATE.maxCombo = STATE.combo;

    let base = grade === 'Perfect' ? 100 : 70;
    if(phase.id === 'dance') base *= 1.3;
    if(STATE.diff === 'hard') base *= 1.2;
    if(STATE.diff === 'easy') base *= 0.85;

    STATE.score += Math.round(base);

    if(grade === 'Perfect'){
      STATE.perfect++;
      updateGroove(+6);
    }else{
      updateGroove(+3);
    }
  }

  updateHUD();
}

let groove = 0;

function updateGroove(delta){
  groove = Math.max(0, Math.min(100, groove + delta));
  $('#groove-fill').style.width = groove + '%';

  if(groove >= 75){
    $('#groove-status').textContent = 'Fever Dance';
    $('#coach-avatar').textContent = '💃';
  }else if(groove >= 40){
    $('#groove-status').textContent = 'Groove On';
    $('#coach-avatar').textContent = '🕺';
  }else{
    $('#groove-status').textContent = 'Warm-up';
    $('#coach-avatar').textContent = '🕺';
  }
}

function updateHUD(){
  const now     = performance.now();
  const elapsed = now - STATE.startTime;

  $('#stat-score').textContent   = STATE.score;
  $('#stat-combo').textContent   = STATE.combo;
  $('#stat-perfect').textContent = STATE.perfect;
  $('#stat-miss').textContent    = STATE.miss;

  const remain = Math.max(0, (STATE.duration - elapsed)/1000);
  $('#stat-time').textContent = remain.toFixed(1);

  const phase = getPhase(elapsed);
  if(STATE.lastPhase !== phase.id){
    STATE.lastPhase = phase.id;
    $('#stat-phase').textContent =
      phase.id==='warmup' ? 'Warm-up' :
      phase.id==='dance'  ? 'Dance'   : 'Cool-down';

    if(phase.id === 'warmup'){
      setCoach('เริ่มวอร์มอัพ เต้นช้า ๆ ให้เข้าจังหวะก่อน 🎵');
    }else if(phase.id === 'dance'){
      setCoach('ถึงช่วงเต้นจริงแล้ว! ตามโน้ตให้ทันเลย 💃');
    }else{
      setCoach('คูลดาวน์ หายใจลึก ๆ เต้นเบา ๆ ก่อนจบ 😌');
    }
  }

  if(elapsed >= STATE.duration){
    endGame('timeup');
  }
}

function loopFrame(){
  if(!STATE.running) return;
  updateHUD();
  requestAnimationFrame(loopFrame);
}

function setCoach(text){
  $('#coach-text').textContent = text;
}

/* ---------- END GAME ---------- */
function endGame(reason){
  if(!STATE.running && reason!=='stop') return;
  STATE.running = false;
  if(STATE.beatTimer) clearInterval(STATE.beatTimer);

  const acc = STATE.totalHits>0
    ? ((STATE.perfect)/(STATE.totalHits)*100).toFixed(1)
    : '0.0';

  $('#res-mode').textContent = STATE.mode === 'research' ? 'วิจัย' : 'ปกติ';
  $('#res-diff').textContent =
    STATE.diff === 'easy'   ? 'ง่าย' :
    STATE.diff === 'hard'   ? 'ยาก'  : 'ปกติ';
  $('#res-score').textContent    = STATE.score;
  $('#res-maxcombo').textContent = STATE.maxCombo;
  $('#res-perfect').textContent  = STATE.perfect;
  $('#res-miss').textContent     = STATE.miss;
  $('#res-accuracy').textContent = acc + '%';

  // เก็บสรุปไว้ใน localStorage ให้ Hub เอาไปแสดง
  try{
    localStorage.setItem('vf-rhythm-latest', JSON.stringify({
      score:STATE.score,
      maxCombo:STATE.maxCombo,
      miss:STATE.miss,
      perfect:STATE.perfect,
      time:new Date().toLocaleString('th-TH')
    }));
    window.dispatchEvent(new CustomEvent('vf-rhythm-updated'));
  }catch(e){}

  showView('#view-result');
}

/* ---------- MENU HANDLERS ---------- */
function bindMenu(){
  document.addEventListener('click',(ev)=>{
    const btn = ev.target.closest('[data-action]');
    if(!btn) return;
    const act = btn.dataset.action;

    if(act === 'start-normal'){
      const diff = $('#difficulty').value || 'normal';
      startGame({mode:'normal', diff});
    }else if(act === 'start-research'){
      showView('#view-research-form');
    }else if(act === 'back-to-menu'){
      showView('#view-menu');
    }else if(act === 'research-begin-play'){
      const diff = $('#difficulty').value || 'normal';
      startGame({mode:'research', diff});
    }else if(act === 'stop-early'){
      endGame('stop');
    }else if(act === 'play-again'){
      if(STATE.lastConfig) startGame(STATE.lastConfig);
      else showView('#view-menu');
    }
  });
}

/* ---------- INIT ---------- */
window.addEventListener('DOMContentLoaded',()=>{
  bindMenu();
});