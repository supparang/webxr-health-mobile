
(function(){
  let running=false, raf=0, t0=0, elapsed=0, score=0, lives=3, lane=1;
  let items=[]; const root = document.getElementById('root');
  const statusEl = document.getElementById('status');
  const scene = document.getElementById('scene');

  function setHUD(msg){
    const hud = document.getElementById('hud');
    hud.setAttribute('text', `value:Score ${score} • Lives ${lives}\n${msg||''}; width:5; align:center; color:#e2e8f0`);
  }
  function laneX(i){ return [-1.2,0,1.2][i]; }
  function spawn(kind,lane,time){
    const n=document.createElement('a-entity');
    n.classList.add('itm'); n.dataset.kind=kind; n.dataset.t=time; n.dataset.lane=lane;
    const mat = kind==='orb'?'#22c55e':'#ef4444';
    const geo = kind==='orb'?'sphere; radius:0.16':'box; width:0.7; height:0.5; depth:0.3';
    n.setAttribute('geometry', 'primitive: '+geo);
    n.setAttribute('material', 'color:'+mat+'; shader:flat; opacity:0.98');
    n.object3D.position.set(laneX(lane),0,3.2);
    root.appendChild(n);
    items.push(n);
  }
  function gen(){
    items.forEach(n=>n.remove()); items.length=0;
    let t=0.8; const dur=45; while(t<dur){
      const lane=(Math.random()*3|0), kind=Math.random()<0.65?'orb':'ob';
      spawn(kind,lane,t); if(Math.random()<0.22){ spawn(Math.random()<0.7?'orb':'ob',(Math.random()*3|0),t+0.2); }
      t += 0.9 + (Math.random()*0.2-0.08);
    }
  }
  function start(){
    running=true; score=0; lives=3; lane=1; t0=performance.now()/1000; elapsed=0;
    gen(); setHUD('เริ่ม! A/S/D เปลี่ยนเลน — เก็บเขียว หลบแดง');
    loop();
  }
  function reset(){ running=false; cancelAnimationFrame(raf); items.forEach(n=>n.remove()); items.length=0; score=0; lives=3; setHUD('พร้อมเริ่ม'); }
  function setLane(i){ lane=Math.max(0,Math.min(2,i)); }
  function end(){ running=false; cancelAnimationFrame(raf); setHUD('จบเกม • Score '+score); }

  function loop(){
    if(!running) return;
    const now = performance.now()/1000; elapsed = now - t0;
    // move items
    for(const n of items){
      if(!n) continue;
      const t = parseFloat(n.dataset.t);
      const dt = t - elapsed;
      const z = Math.max(0, dt*2.2);
      n.object3D.position.z = z;
      if(Math.abs(dt) <= 0.35 && !n.dataset.hit){
        if(n.dataset.kind==='orb'){
          if(parseInt(n.dataset.lane,10)===lane){ score+=20; n.dataset.hit='1'; n.setAttribute('visible','false'); }
        }else{
          if(parseInt(n.dataset.lane,10)===lane){ lives--; n.dataset.hit='1'; n.setAttribute('visible','false'); if(lives<=0){ end(); return; } }
        }
      }
    }
    setHUD('A/S/D หรือ ลูกศร ซ้าย/ขึ้น/ขวา');
    if(elapsed>=45) return end();
    raf=requestAnimationFrame(loop);
  }

  // bind after scene loaded
  function bind(){
    document.getElementById('btnStart').onclick=()=>{ if(!running) start(); };
    document.getElementById('btnReset').onclick=()=>reset();
    window.addEventListener('keydown',(e)=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') setLane(0);
      if(k==='s'||k==='arrowup')   setLane(1);
      if(k==='d'||k==='arrowright')setLane(2);
    });
    statusEl.textContent='พร้อมเริ่ม • กด Start';
  }
  if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();
