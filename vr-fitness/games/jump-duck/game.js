(function(){
  let score=0, timeLeft=60, timer;
  function $(q){return document.querySelector(q);}
  function start(){
    reset(); spawnDemoTargets();
    timer=setInterval(()=>{timeLeft--; $('#time').textContent=timeLeft; if(timeLeft<=0) end();},1000);
  }
  function reset(){
    score=0; timeLeft=60; $('#score').textContent=score; $('#time').textContent=timeLeft;
    const arena=document.getElementById('arena'); Array.from(arena.children).forEach(c=>c.remove());
  }
  function end(){ clearInterval(timer); APP.badge(APP.t('results')+': '+score); }
  function spawnDemoTargets(){
    const arena=document.getElementById('arena');
    for(let i=0;i<12;i++){
      const box=document.createElement('a-box');
      box.setAttribute('color','#00d0ff');
      const x=(Math.random()*4-2).toFixed(2);
      const y=(Math.random()*1.5+1).toFixed(2);
      const z=(Math.random()*-2-2).toFixed(2);
      box.setAttribute('position',`${x} ${y} ${z}`);
      box.setAttribute('class','clickable');
      box.addEventListener('click',()=>{score+=10; $('#score').textContent=score; box.setAttribute('visible','false'); AudioBus.tap();});
      arena.appendChild(box);
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{document.getElementById('startBtn').addEventListener('click',start);});
})();