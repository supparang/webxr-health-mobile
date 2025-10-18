
(function(){
  const total = Math.max(10, parseInt(new URLSearchParams(location.search).get('count')||'30',10));
  const S={score:0,done:0,playing:false};
  let $start,$end,$sum,$hud,$sp;
  const choices = ['HIGH','LOW'];
  function setHUD(){ $hud&&$hud.setAttribute('value',`Score: ${S.score} / ${S.done}`); }
  function spawn(){
    if(!S.playing) return;
    const type = choices[Math.floor(Math.random()*choices.length)];
    const y = (type==='HIGH') ? 2.1 : 1.0;
    const e=document.createElement('a-image'); e.setAttribute('src', `#${type}`);
    e.setAttribute('position', `0 ${y} -1.6`); e.setAttribute('scale','0.8 0.8 0.8'); e.classList.add('clickable');
    e.addEventListener('click', ()=>{ if(!S.playing) return; S.score++; S.done++; setHUD(); e.remove(); scheduleNext(); });
    $sp.appendChild(e);
    setTimeout(()=>{ if(!e.parentNode) return; S.done++; setHUD(); e.remove(); scheduleNext(); }, 1200);
  }
  function scheduleNext(){ if(S.done>=total){ end(); return; } setTimeout(spawn, Math.random()*400 + 180); }
  function start(){ S.playing=true; $start.classList.add('hidden'); setHUD(); scheduleNext(); }
  function end(){ S.playing=false; $sum.textContent = `ทำได้ ${S.score}/${total}`; $end.classList.remove('hidden'); }
  window.addEventListener('load',()=>{ $start=id('start'); $end=id('end'); $sum=id('sum'); $hud=id('hud'); $sp=id('spawner'); window.JD={start}; setHUD(); });
  const id=x=>document.getElementById(x);
})();
