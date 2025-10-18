
(function(){
  const Q = new URLSearchParams(location.search);
  const stages = Math.max(1, parseInt(Q.get('stages')||'8',10));
  const KB = (Q.get('kb')||'on') === 'on';
  const S={stage:0,held:0,goal:1.5,playing:false,score:0};
  let $start,$end,$sum,$hud,$sp,$cursor;
  function setHUD(){ $hud&&$hud.setAttribute('value',`Stage ${S.stage}/${stages} — Hold: ${S.held.toFixed(1)}s`); }
  function spawnStage(){
    const x=(Math.random()*1.6-0.8), y=1.2+Math.random()*1.0;
    const e=document.createElement('a-image'); e.setAttribute('src','#BAL'); e.setAttribute('position',`${x} ${y} -1.6`); e.setAttribute('scale','0.7 0.7 0.7'); e.classList.add('clickable');
    e.addEventListener('mouseenter',()=>startHold()); e.addEventListener('mouseleave',()=>stopHold()); $sp.appendChild(e);
  }
  let holdTimer=null;
  function startHold(){ stopHold(); holdTimer=setInterval(()=>{ S.held+=0.1; setHUD(); if(S.held>=S.goal){ S.score += Math.round(S.goal*100); stopHold(); nextStage(); } },100); }
  function stopHold(){ if(holdTimer){ clearInterval(holdTimer); holdTimer=null; } }
  function nextStage(){ S.stage++; if(S.stage>stages){ end(); return; } S.held=0; S.goal = 1.5 + (S.stage-1)*0.4; setHUD(); Array.from($sp.children).forEach(c=>c.remove()); spawnStage(); }
  function start(){ S.playing=true; $start.classList.add('hidden'); nextStage(); }
  function end(){ S.playing=false; stopHold(); $sum.textContent = `คะแนนรวม ${S.score} | ผ่าน ${stages} ด่าน`; $end.classList.remove('hidden'); }
  window.addEventListener('load',()=>{
    $start=id('start'); $end=id('end'); $sum=id('sum'); $hud=id('hud'); $sp=id('spawner'); $cursor=id('cursor'); window.BH={start}; setHUD();
    document.addEventListener('keydown',e=>{
      if(e.key==='Enter'){ if($start&&!$start.classList.contains('hidden')) start(); }
      if(e.key==='Escape'){ location.href='index.html'; }
      if(!S.playing || !KB) return;
      if(e.key===' '){ e.preventDefault(); startHold(); }
    });
    document.addEventListener('keyup',e=>{
      if(!S.playing || !KB) return;
      if(e.key===' '){ stopHold(); }
    });
  });
  const id=x=>document.getElementById(x);
})();
