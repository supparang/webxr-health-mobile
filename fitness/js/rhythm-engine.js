// === Rhythm Dance Engine (Prototype V2) ===

const $ = (s)=>document.querySelector(s);

let state = {
  running:false,
  start:0,
  score:0,
  combo:0,
  maxcombo:0,
  hits:0,
  total:0,
  timer:60000,  // 60s
  lastPhase:null,
  beatInterval:null
};

const PHASES = [
  {id:'warmup',   start:0,    end:15000, bpm:90,  emoji:'🟢'},
  {id:'dance',    start:15000,end:45000, bpm:120, emoji:'💗'},
  {id:'cool',     start:45000,end:60000, bpm:96,  emoji:'🔵'}
];

function getPhase(t){
  return PHASES.find(p => t>=p.start && t<p.end) || PHASES[2];
}

function startGame(){
  $('#view-menu').classList.add('hidden');
  $('#view-play').classList.remove('hidden');

  Object.assign(state,{
    running:true,start:performance.now(),
    score:0,combo:0,maxcombo:0,hits:0,total:0,lastPhase:null
  });

  loop();
  setupBeat();
}

function setupBeat(){
  if(state.beatInterval) clearInterval(state.beatInterval);
  state.beatInterval = setInterval(()=>{
    if(!state.running) return;
    spawnNote();
  }, 500); // prototype เดี๋ยวลดลงตาม bpm จริงรอบหลัง
}

function spawnNote(){
  const now = performance.now();
  const elapsed = now - state.start;
  const phase = getPhase(elapsed);

  // เลือก lane 0-3
  const lane = Math.floor(Math.random()*4);
  const laneEl = document.querySelector(`.lane[data-lane="${lane}"]`);

  const note = document.createElement('div');
  note.className = `rb-note ${phase.id}`;
  note.textContent = phase.emoji;
  note.dataset.spawn = now;

  laneEl.appendChild(note);

  animateNote(note, laneEl);
}

function animateNote(el, lane){
  const dur = 1500; // ตก 1.5s
  const start = performance.now();

  function step(){
    if(!state.running) return;
    const t = performance.now() - start;
    const y = t/dur;
    el.style.top = (y*100)+"%";

    if(y>=1){
      lane.removeChild(el);
      state.combo = 0;
      state.total++;
      updateHUD();
      return;
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  el.addEventListener('pointerdown', ()=>{
    hitNote(el,lane);
  });
}

function hitNote(el,lane){
  const spawn = Number(el.dataset.spawn);
  const now = performance.now();
  const dt = now - spawn;

  let grade;
  if(dt < 300) grade='Perfect';
  else if(dt < 600) grade='Good';
  else grade='Miss';

  if(grade !== 'Miss'){
    state.hits++;
    state.combo++;
    state.maxcombo = Math.max(state.maxcombo,state.combo);
    state.score += (grade==='Perfect'?100:70);
  }else{
    state.combo = 0;
  }

  el.remove();
  state.total++;
  updateHUD();
}

function updateHUD(){
  const now = performance.now();
  const elapsed = now - state.start;

  $('#hud-score').textContent = state.score;
  $('#hud-combo').textContent = state.combo;
  $('#hud-time').textContent  = ((60000-elapsed)/1000).toFixed(1);

  const phase = getPhase(elapsed);
  $('#hud-phase').textContent =
    phase.id==='warmup'?'Warm-up':
    phase.id==='dance'?'Dance':
    'Cool-down';

  if(state.lastPhase !== phase.id){
    state.lastPhase = phase.id;
    if(phase.id==='warmup') setCoach("เริ่มวอร์มอัพ เต้นช้า ๆ ก่อนนะ 🎵");
    if(phase.id==='dance')  setCoach("ถึงช่วงเต้นจริงแล้ว! ตามจังหวะเลย 💃");
    if(phase.id==='cool')   setCoach("คูลดาวน์เบา ๆ ผ่อนคลายก่อนจบ 😌");
  }

  if(elapsed >= 60000){
    endGame();
  }
}

function setCoach(msg){
  $('#coach-text').textContent = msg;
}

function endGame(){
  state.running=false;
  clearInterval(state.beatInterval);

  $('#view-play').classList.add('hidden');
  $('#view-result').classList.remove('hidden');

  const acc = state.total>0 ? (state.hits/state.total*100).toFixed(1) : "0";

  $('#res-score').textContent = state.score;
  $('#res-maxcombo').textContent = state.maxcombo;
  $('#res-accuracy').textContent = acc+"%";
}

$('#btn-start').addEventListener('click',startGame);
$('#btn-stop').addEventListener('click',endGame);