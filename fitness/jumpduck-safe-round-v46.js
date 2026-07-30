(()=>{'use strict';
if(window.__JUMPDUCK_SAFE_ROUND_V46__)return;
window.__JUMPDUCK_SAFE_ROUND_V46__=true;
const SAFE_DURATION_MS=50000;
const DISPLAY_DURATION_SEC=50;
const game=document.getElementById('game');
const time=document.getElementById('time');
let startedAt=0,finishTimer=0,displayTimer=0,done=false;
function finish(){
  if(done)return;
  done=true;
  clearTimeout(finishTimer);
  clearInterval(displayTimer);
  try{window.JumpDuckAPI?.finish?.('mobile-safe-50s-round')}catch(e){console.warn('[JumpDuck v4.6 finish]',e)}
}
function start(){
  if(startedAt||done)return;
  startedAt=Date.now();
  if(time)time.textContent=String(DISPLAY_DURATION_SEC);
  displayTimer=setInterval(()=>{
    if(done)return;
    const elapsed=Math.max(0,Date.now()-startedAt);
    const remaining=Math.max(0,DISPLAY_DURATION_SEC-Math.floor(elapsed/1000));
    if(time)time.textContent=String(remaining);
    if(remaining<=0)finish();
  },200);
  finishTimer=setTimeout(finish,SAFE_DURATION_MS);
}
if(game){
  new MutationObserver(()=>{
    if(!game.classList.contains('hidden'))start();
  }).observe(game,{attributes:true,attributeFilter:['class']});
}
const result=document.getElementById('result');
if(result){
  new MutationObserver(()=>{
    if(!result.classList.contains('hidden')){
      done=true;
      clearTimeout(finishTimer);
      clearInterval(displayTimer);
    }
  }).observe(result,{attributes:true,attributeFilter:['class']});
}
})();
