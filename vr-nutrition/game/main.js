// === Hero Health VR — Main Controller (Good vs Junk Mode) ===
import * as goodjunk from './modes/goodjunk.js';
const $ = (s)=>document.querySelector(s);

const hud = {
  time: $('#hudTime'),
  score: $('#hudScore'),
  streak: $('#hudStreak'),
  fever: $('#hudFever'),
  status: $('#hudStatus')
};
const ui = {
  start: $('#startScreen'),
  result: $('#resultScreen'),
  btnStart: $('#btnStart'),
  btnRestart: $('#btnRestart'),
  rScore: $('#rScore'),
  rBest: $('#rBest'),
  rMiss: $('#rMiss')
};

let controller=null, running=false;

function show(el){el&&el.style.display='grid';}
function hide(el){el&& (el.style.display='none');}

function readyUI(){
  hud.time.textContent='60';
  hud.score.textContent='0';
  hud.streak.textContent='0';
  hud.fever.textContent='Fever: off';
  hud.status.textContent='Ready';
  hide(ui.result);
  show(ui.start);
}

async function startGame(){
  if(running) return;
  running=true; hide(ui.start);
  hud.status.textContent='Starting...';
  const host=document.querySelector('#spawnHost');
  controller=await goodjunk.boot({host,duration:60,difficulty:'normal'});
  hud.status.textContent='Playing';
}

function endGameView({score,combo,misses}){
  running=false;
  ui.rScore.textContent=score;
  ui.rBest.textContent=combo;
  ui.rMiss.textContent=misses;
  hud.status.textContent='Finished';
  show(ui.result);
}

// Events จากโหมดเกม
window.addEventListener('hha:time',e=>{hud.time.textContent=e.detail.sec;});
window.addEventListener('hha:score',e=>{
  hud.score.textContent=e.detail.score;
  hud.streak.textContent=e.detail.combo;
});
window.addEventListener('hha:fever',e=>{
  if(e.detail.state==='start'){
    hud.fever.textContent='Fever: ON';
    hud.fever.style.background='#1e4030';
  }else{
    hud.fever.textContent='Fever: off';
    hud.fever.style.background='';
  }
});
window.addEventListener('hha:end',e=>endGameView(e.detail));

// Pause on blur
document.addEventListener('visibilitychange',()=>{
  if(!controller) return;
  if(document.hidden){controller.pause?.();hud.status.textContent='Paused';}
  else {controller.resume?.();hud.status.textContent='Playing';}
});

ui.btnStart?.addEventListener('click',startGame);
ui.btnRestart?.addEventListener('click',()=>{hide(ui.result);readyUI();});

readyUI();
