// Adventure — Fresh Start Minimal, clear UI
(function(){
  const root=document.getElementById('root');
  const hud =document.getElementById('hud');
  const statusEl=document.getElementById('status');

  let running=false, raf=0, t0=0, elapsed=0;
  let lane=1, score=0, lives=3, combo=0, best=0, duration=50;
  const items=[]; // {el,t,kind,lane,judged}

  // Unlock audio after user gesture (optional, silent if no AudioContext)
  let actx=null, gain=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); gain=actx.createGain(); gain.gain.value=0.16; gain.connect(actx.destination); }
  function beep(f=700,d=0.05,vol=0.18){ if(!actx) return; const o=actx.createOscillator(), g=actx.createGain();
    o.type='square'; o.frequency.value=f; o.connect(g); g.connect(gain);
    const t=actx.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.start(t); o.stop(t+d+0.02); }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  const laneX = i => [-1.2,0,1.2][i];

  // Build clear lane backgrounds + hit ring
  function buildLaneUI(){
    const colors=['#0ea5e9','#334155','#22c55e'];
    [-1.2,0,1.2].forEach((x,i)=>{
      const bg=document.createElement('a-entity');
      bg.setAttribute('geometry','primitive: plane; width:1.05; height:1.35');
      bg.setAttribute('material',`color:${colors[i]}; opacity:0.12; shader:flat`);
      bg.setAttribute('position',`${x} 0 0.02`);
      root.appendChild(bg);

      const tag=document.createElement('a-entity');
      tag.setAttribute('text',`value:${['ซ้าย','กลาง','ขวา'][i]} (${['A/←','S/↑','D/→'][i]}); width:2.4; align:center; color:#9fb1d1`);
      tag.setAttribute('position',`${x} -0.75 0.05`);
      root.appendChild(tag);
    });
    const hit=document.createElement('a-entity');
    hit.setAttribute('geometry','primitive: ring; radiusInner:0.06; radiusOuter:0.075; segmentsTheta:64');
    hit.setAttribute('material','color:#93c5fd; opacity:0.95; shader:flat');
    hit.setAttribute('position','0 0 0.06');
    hit.setAttribute('animation__pulse','property: scale; to: 1.06 1.06 1; dir: alternate; dur: 480; loop: true');
    root.appendChild(hit);
  }

  function setHUD(msg){
    hud.setAttribute('text',`value:Score ${score} • Lives ${lives} • Combo ${combo} (Best ${best})\nเก็บ: เขียว/ทอง • หลบ: แดง\n${msg||''}; width:5.4; align:center; color:#e2e8f0`);
  }

  function spawn(kind,l, t){
    const e=document.createElement('a-entity');
    let geo, col;
    if(kind==='orb'){ geo='sphere; radius:0.16'; col='#22c55e'; }
    else if(kind==='gold'){ geo='sphere; radius:0.2'; col='#f59e0b'; }
    else { kind='ob'; geo='box; width:0.7; height:0.5; depth:0.3'; col='#ef4444'; }
    e.setAttribute('geometry','primitive: '+geo);
    e.setAttribute('material',`color:${col}; shader:flat; opacity:0.98`);
    e.object3D.position.set(laneX(l),0,3.2);
    root.appendChild(e);
    items.push({el:e, t, kind, lane:l, judged:false});
  }

  function buildPattern(){
    items.splice(0).forEach(n=>n.el.remove());
    let t=0.9;
    while(t<duration){
      const l=(Math.random()*3|0);
      const kind = Math.random()<0.65?'orb': (Math.random()<0.15?'gold':'ob');
      spawn(kind,l,t);
      if(Math.random()<0.25) spawn('ob',(Math.random()*3|0), t+0.22);
      t += 0.86 + (Math.random()*0.22 - 0.08);
    }
  }

  function collect(kind){ score += (kind==='gold'?100:20); combo++; best=Math.max(best,combo); beep(800,0.05,0.2); }
  function hit(){ lives--; combo=0; beep(180,0.09,0.22); if(lives<=0){ end('Game Over'); } }

  function loop(){
    if(!running) return;
    const now=performance.now()/1000; elapsed = now - t0;

    const speed = 2.2 + Math.min(0.8, elapsed*0.015) + Math.min(0.6, Math.floor(combo/8)*0.12);

    for(const it of items){
      if(it.judged) continue;
      const dt = it.t - elapsed;
      it.el.object3D.position.z = Math.max(0, dt*speed);
      if(Math.abs(dt)<=0.34){
        if(it.lane===lane){
          it.judged=true; it.el.setAttribute('visible','false');
          if(it.kind==='ob') hit(); else collect(it.kind);
        }
      }else if(dt<-0.36 && !it.judged){
        it.judged=true; it.el.setAttribute('visible','false');
      }
    }

    if(elapsed>=duration) return end('Stage Clear');
    setHUD('กด A/S/D หรือ ←↑→ เพื่อเปลี่ยนเลน');
    raf=requestAnimationFrame(loop);
  }

  function start(){
    running=true; t0=performance.now()/1000; elapsed=0;
    lane=1; score=0; lives=3; combo=0; best=0; duration=50;
    if(!root.__laneUI){ buildLaneUI(); root.__laneUI=true; }
    buildPattern(); setHUD('เริ่ม!');
    loop();
  }
  function end(msg){ running=false; cancelAnimationFrame(raf); setHUD(msg+` • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); items.splice(0).forEach(n=>n.el.remove()); lane=1; score=0; lives=3; combo=0; best=0; setHUD('พร้อมเริ่ม'); }

  // UI
  function bind(){
    document.getElementById('btnStart').onclick=()=>{ ensureAudio(); if(!running) start(); };
    document.getElementById('btnReset').onclick=()=>reset();
    window.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') lane=0;
      if(k==='s'||k==='arrowup')   lane=1;
      if(k==='d'||k==='arrowright')lane=2;
    });
    statusEl.textContent='พร้อมเริ่ม • กด Start';
  }
  if(!document.querySelector('a-scene').hasLoaded){
    document.querySelector('a-scene').addEventListener('loaded', bind, {once:true});
  }else bind();
})();
