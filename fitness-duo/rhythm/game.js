
(function(){
  let running=false, raf=0, t0=0, elapsed=0, score=0, combo=0, best=0;
  let notes=[], nextBeat=0, bpm=108;
  const root=document.getElementById('root'), hud=document.getElementById('hud');
  const statusEl=document.getElementById('status'); const scene=document.getElementById('scene');

  function setHUD(msg){
    hud.setAttribute('text', `value:Score ${score} • Combo ${combo} (Best ${best})\n${msg||''}; width:5; align:center; color:#e2e8f0`);
  }
  function spawn(){
    const n=document.createElement('a-entity'); n.classList.add('note');
    n.setAttribute('geometry','primitive: circle; radius: 0.16; segments: 32');
    n.setAttribute('material','color:#7cafff; shader:flat; opacity:0.98');
    n.object3D.position.set(0,0,3.0);
    root.appendChild(n);
    notes.push({el:n, t:elapsed+1.6, judged:false});
  }
  function judge(){
    // pick closest note in time
    let bestN=null, bestErr=9; const hitWin=0.16;
    for(const it of notes){ if(it.judged) continue; const err=Math.abs(it.t - elapsed); if(err<bestErr){ bestErr=err; bestN=it; } }
    if(!bestN || bestErr>hitWin){ combo=0; setHUD('Miss • Space/Enter คลิกกลางจอ'); return; }
    bestN.judged=true; bestN.el.setAttribute('visible','false');
    if(bestErr<=hitWin*0.35){ score+=300; combo++; } else { score+=150; combo++; }
    best=Math.max(best, combo); setHUD('Good!');
  }
  function start(){
    running=true; score=0; combo=0; best=0; notes.length=0; t0=performance.now()/1000; elapsed=0; nextBeat=0;
    setHUD('เริ่ม! Space/Enter หรือคลิกกลางจอเพื่อฮิตจังหวะ');
    loop();
  }
  function end(){ running=false; cancelAnimationFrame(raf); setHUD('จบเกม • Score '+score); }
  function reset(){ running=false; cancelAnimationFrame(raf); notes.forEach(n=>n.el?.remove()); notes.length=0; setHUD('พร้อมเริ่ม'); }

  function loop(){
    if(!running) return;
    const now=performance.now()/1000; elapsed=now-t0;
    while(nextBeat <= elapsed + 1.0){ spawn(); nextBeat += 60/bpm; }
    const speedZ=1.6;
    for(const it of notes){
      if(it.judged) continue;
      const dt = it.t - elapsed;
      const z  = Math.max(0, dt*speedZ);
      it.el.object3D.position.z = z;
      if(dt < -0.2 && !it.judged){ it.judged=true; it.el.setAttribute('visible','false'); combo=0; setHUD('Miss'); }
    }
    if(elapsed > 45) return end();
    raf=requestAnimationFrame(loop);
  }

  function bind(){
    document.getElementById('btnStart').onclick=()=>{ if(!running) start(); };
    document.getElementById('btnReset').onclick=()=>reset();
    // input
    const hit = ()=>judge();
    window.addEventListener('keydown',(e)=>{ if(e.key===' '||e.key==='Enter') hit(); });
    // tap target
    const pad=document.createElement('a-entity');
    pad.setAttribute('geometry','primitive: plane; width:2; height:0.6');
    pad.setAttribute('material','color:#1e293b; opacity:0.95; shader:flat');
    pad.setAttribute('position','0 -0.5 0.06');
    const label=document.createElement('a-entity');
    label.setAttribute('text','value:TAP / SPACE; width:4; align:center; color:#93c5fd');
    label.setAttribute('position','0 0 0.01'); pad.appendChild(label);
    pad.addEventListener('click', hit);
    root.appendChild(pad);

    statusEl.textContent='พร้อมเริ่ม • กด Start';
  }
  if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();
