let score=0, combo=1, timeLeft=60, running=false;
const scoreEl=document.getElementById('score');
const comboEl=document.getElementById('combo');
const timerEl=document.getElementById('timer');
document.getElementById('startBtn').onclick=()=>start();

function start(){
  if(running) return;
  running=true; score=0; combo=1; timeLeft=60;
  tick(); spawnLoop(); updateHUD();
}
function updateHUD(){
  scoreEl.textContent='Score: '+score;
  comboEl.textContent='Combo: x'+combo;
  timerEl.textContent='Time: '+timeLeft+'s';
}
function spawnLoop(){
  if(!running) return;
  const box=document.createElement('div');
  box.className='box';
  box.style.left=Math.random()*80+'vw';
  box.style.top=Math.random()*60+'vh';
  box.onclick=()=>hit(box);
  document.body.appendChild(box);
  setTimeout(()=>box.remove(),700);
  setTimeout(spawnLoop,Math.max(200,700-(60-timeLeft)*5));
}
function hit(box){
  box.remove();
  combo++; score+=5*combo; updateHUD();
}
function tick(){
  if(!running) return;
  timeLeft--;
  updateHUD();
  if(timeLeft<=0){ end(); return; }
  setTimeout(tick,1000);
}
function end(){
  running=false;
  alert('Game Over! Score '+score);
}
