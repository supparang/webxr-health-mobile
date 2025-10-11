// Rhythm — Fresh Start Minimal 3-lane with clear UI
(function(){
  const root=document.getElementById('root');
  const hud =document.getElementById('hud');
  const statusEl=document.getElementById('status');

  let running=false, raf=0, t0=0, elapsed=0;
  let score=0, combo=0, best=0, fever=false, feverEnd=0;
  const notes=[]; // {el,lane,t,judged}
  const laneX=i=>[-0.9,0,0.9][i];
  const bpm=108, duration=48;
  let nextBeat=0, hitWin=0.16;

  // Audio (optional)
  let actx=null, master=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); master=actx.createGain(); master.gain.value=0.16; master.connect(actx.destination); }
  function click(f=880,d=0.05,g=0.18){ if(!actx) return; const o=actx.createOscillator(), v=actx.createGain();
    o.type='square'; o.frequency.value=f; o.connect(v); v.connect(master);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.005); v.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.start(t); o.stop(t+d+0.02); }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  function setHUD(msg){
    const f=fever?' • FEVER!':'';
    hud.setAttribute('text',`value:Score ${score} • Combo ${combo} (Best ${best})${f}\nวิธี: ให้โน้ตเลนเดียวกันถึง “วงฟ้า” แล้วกดเลนนั้น (A/S/D หรือ L/C/R)\n${msg||''}; width:5.4; align:center; color:#e2e8f0`);
  }

  function buildLaneUI(){
    const colors=['#0ea5e9','#334155','#22c55e'];
    [-0.9,0,0.9].forEach((x,i)=>{
      const bg=document.createElement('a-entity');
      bg.setAttribute('geometry','primitive: plane; width:0.98; height:1.35');
      bg.setAttribute('material',`color:${colors[i]}; opacity:0.12; shader:flat`);
      bg.setAttribute('position',`${x} 0 0.02`); root.appendChild(bg);

      const tag=document.createElement('a-entity');
      tag.setAttribute('text',`value:${['L(A/←)','C(S/↑)','R(D/→)'][i]}; width:2.2; align:center; color:#9fb1d1`);
      tag.setAttribute('position',`${x} -0.75 0.05`); root.appendChild(tag);

      const pad=document.createElement('a-entity');
      pad.setAttribute('geometry','primitive: plane; width:0.95; height:0.55');
      pad.setAttribute('material','color:#0f172a; opacity:0.95; shader:flat');
      pad.setAttribute('position',`${x} -0.55 0.06`);
      const t=document.createElement('a-entity');
      t.setAttribute('text',`value:${['L','C','R'][i]}; width:3; align:center; color:#93c5fd`);
      t.setAttribute('position','0 0 0.01'); pad.appendChild(t);
      pad.addEventListener('click',()=>judge(i)); root.appendChild(pad);
    });

    const hit=document.createElement('a-entity');
    hit.setAttribute('geometry','primitive: ring; radiusInner:0.07; radiusOuter:0.09; segmentsTheta:64');
    hit.setAttribute('material','color:#93c5fd; opacity:0.95; shader:flat');
    hit.setAttribute('position','0 0 0.06');
    hit.setAttribute('animation__pulse','property: scale; to: 1.07 1.07 1; dir: alternate; dur: 480; loop: true');
    root.appendChild(hit);
  }

  function toast(txt,color="#93c5fd",y=1.05,ms=520){
    const e=document.createElement('a-entity');
    e.setAttribute('text',`value:${txt}; width:5; align:center; color:${color}`);
    e.setAttribute('position',`0 ${y} 0.05`); root.appendChild(e);
    e.setAttribute('animation__up','property: position; to: 0 1.25 0.05; dur:360; easing:easeOutQuad');
    setTimeout(()=>e.remove(),ms);
  }

  function spawn(lane){
    const n=document.createElement('a-entity');
    n.classList.add('note');
    n.setAttribute('geometry','primitive: circle; radius:0.16; segments:32');
    const hues=[200,170,140]; const h=hues[(Math.random()*hues.length)|0];
    n.setAttribute('material',`color:hsl(${h},70%,70%); shader:flat; opacity:0.98`);
    n.object3D.position.set(laneX(lane),0,3.0);
    root.appendChild(n);
    notes.push({el:n, lane, t:elapsed+1.6, judged:false});
  }

  function addScore(n){ score += fever ? Math.round(n*1.5) : n; }
  function enterFever(){ fever=true; feverEnd=elapsed+6; toast('FEVER! ✨','#7dfcc6',1.1,720); }
  function updateFever(){ if(fever && elapsed>=feverEnd){ fever=false; toast('Fever End','#cbd5e1'); } }

  function judge(lane){
    let bestIt=null, bestErr=9;
    for(const it of notes){ if(it.judged || it.lane!==lane) continue;
      const err=Math.abs(it.t - elapsed); if(err<bestErr){ bestErr=err; bestIt=it; } }
    if(!bestIt || bestErr>hitWin){ combo=0; toast('Miss','#fecaca'); return; }
    bestIt.judged=true; bestIt.el.setAttribute('visible','false');
    if(bestErr<=hitWin*0.35){ addScore(300); combo++; toast('Perfect +300','#7dfcc6'); click(1000,0.05,0.2); }
    else { addScore(160); combo++; toast('Good +160','#a7f3d0'); click(820,0.05,0.16); }
    best=Math.max(best,combo);
    if(!fever && combo>0 && combo%8===0) enterFever();
    if(combo%6===0) hitWin = Math.max(0.10, hitWin-0.004);
  }

  function loop(){
    if(!running) return;
    const now=performance.now()/1000; elapsed=now-t0;

    while(nextBeat <= elapsed + 1.0){
      const lane=(Math.random()*3|0);
      spawn(lane);
      if(Math.random()<0.28) spawn((lane+1)%3);
      click(660,0.035,0.08); // เมโทรนอมเบา ๆ
      nextBeat += 60/bpm;
    }

    const speedZ = 1.65 + (fever?0.12:0);
    for(const it of notes){
      if(it.judged) continue;
      const dt = it.t - elapsed;
      it.el.object3D.position.z = Math.max(0, dt*speedZ);
      if(dt<-0.22 && !it.judged){ it.judged=true; it.el.setAttribute('visible','false'); combo=0; toast('Miss','#fecaca'); }
    }
    updateFever();

    if(elapsed>=duration) return end('Stage Clear');
    setHUD(); raf=requestAnimationFrame(loop);
  }

  function start(){
    running=true; t0=performance.now()/1000; elapsed=0; score=0; combo=0; best=0; fever=false; feverEnd=0;
    notes.splice(0).forEach(n=>n.el?.remove()); nextBeat=0; hitWin=0.16;
    if(!root.__laneUI){ buildLaneUI(); root.__laneUI=true; }
    setHUD('เริ่ม!');
    loop();
  }
  function end(msg){ running=false; cancelAnimationFrame(raf); setHUD(`${msg} • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); notes.splice(0).forEach(n=>n.el?.remove()); setHUD('พร้อมเริ่ม'); }

  function bind(){
    document.getElementById('btnStart').onclick=()=>{ ensureAudio(); if(!running) start(); };
    document.getElementById('btnReset').onclick=()=>reset();
    window.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') judge(0);
      if(k==='s'||k==='arrowup')   judge(1);
      if(k==='d'||k==='arrowright')judge(2);
    });
    statusEl.textContent='พร้อมเริ่ม • กด Start';
  }
  if(!document.querySelector('a-scene').hasLoaded){
    document.querySelector('a-scene').addEventListener('loaded', bind, {once:true});
  }else bind();
})();
