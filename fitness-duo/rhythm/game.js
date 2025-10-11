// /rhythm/game.js — QuickFix Plus (Perfect/Good/Fever/Metronome)
(function(){
  let running=false, raf=0, t0=0, elapsed=0;
  let score=0, combo=0, best=0, fever=false, feverEnd=0, feverCount=0;
  let notes=[], nextBeat=0;
  const bpm=108, hitWinBase=0.16, duration=48;

  const root=document.getElementById('root');
  const hud =document.getElementById('hud');
  const scene=document.getElementById('scene');
  const statusEl=document.getElementById('status');

  // Audio
  let actx=null, master=null;
  function ensureAudio(){ if(actx) return;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); master=actx.createGain(); master.gain.value=0.16; master.connect(actx.destination);
  }
  function click(f=880, dur=0.05, g=0.18){
    if(!actx) return; const o=actx.createOscillator(), v=actx.createGain();
    o.type='square'; o.frequency.value=f; o.connect(v); v.connect(master);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.005);
    v.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.start(t); o.stop(t+dur+0.02);
  }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  function setHUD(msg){
    const f=fever?' • FEVER!':'';
    hud.setAttribute('text',
      `value:Score ${score} • Combo ${combo} (Best ${best})${f}\n${msg||''}; width:5; align:center; color:#e2e8f0`);
  }
  function toast(txt,color="#93c5fd",y=1.0,ms=520){
    const t=document.createElement('a-entity');
    t.setAttribute('text',`value:${txt}; width:5; align:center; color:${color}`);
    t.setAttribute('position',`0 ${y} 0.05`);
    root.appendChild(t);
    t.setAttribute('animation__up','property: position; to: 0 1.2 0.05; dur: 360; easing: easeOutQuad');
    setTimeout(()=>t.remove(),ms);
  }

  function spawn(){
    const n=document.createElement('a-entity'); n.classList.add('note');
    n.setAttribute('geometry','primitive: circle; radius: 0.16; segments: 32');
    const hues=[210,190,160,140]; const h=hues[(Math.random()*hues.length)|0];
    n.setAttribute('material',`color:hsl(${h},70%,70%); shader:flat; opacity:0.98`);
    n.object3D.position.set(0,0,3.0);
    root.appendChild(n);
    notes.push({el:n, t:elapsed+1.6, judged:false});
  }

  function addScore(n){ score += fever ? Math.round(n*1.5) : n; }
  function enterFever(){ fever=true; feverEnd=elapsed+6; feverCount++; toast('FEVER! ✨','#7dfcc6',1.05,720); }
  function updateFever(){ if(fever && elapsed>=feverEnd){ fever=false; toast('Fever End','#cbd5e1'); } }

  function judge(){
    const hitWin = hitWinBase; // (ปรับละเอียดต่อได้)
    // หาโน้ตที่ใกล้ที่สุด
    let bestIt=null, bestErr=9;
    for(const it of notes){
      if(it.judged) continue;
      const err = Math.abs(it.t - elapsed);
      if(err<bestErr){ bestErr=err; bestIt=it; }
    }
    if(!bestIt || bestErr>hitWin){
      combo=0; toast('Miss','#fecaca'); return;
    }
    bestIt.judged=true; bestIt.el.setAttribute('visible','false');
    if(bestErr<=hitWin*0.35){ addScore(300); combo++; toast('Perfect +300','#7dfcc6'); click(990,0.05,0.2); }
    else { addScore(150); combo++; toast('Good +150','#a7f3d0'); click(820,0.05,0.16); }
    best=Math.max(best,combo);
    if(!fever && combo>0 && combo%8===0) enterFever();
  }

  function start(){
    running=true; t0=performance.now()/1000; elapsed=0;
    score=0; combo=0; best=0; fever=false; feverEnd=0; feverCount=0;
    notes.length=0; nextBeat=0;
    setHUD('เริ่ม! Space/Enter หรือคลิกปุ่ม TAP ให้อยู่ในจังหวะ');
    loop();
  }
  function end(title='จบเกม'){ running=false; cancelAnimationFrame(raf); setHUD(`${title} • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); notes.forEach(n=>n.el?.remove()); notes.length=0; setHUD('พร้อมเริ่ม • กด Start'); }

  function loop(){
    if(!running) return;
    const now=performance.now()/1000; elapsed=now-t0;

    // ปล่อยโน้ต + เมโทรนอมเบาๆ
    while(nextBeat <= elapsed + 1.0){ spawn(); click(660,0.035,0.08); nextBeat += 60/bpm; }

    // เคลื่อนโน้ต
    const speedZ = 1.6; // คงเดิม (จูนเพิ่มได้)
    for(const it of notes){
      if(it.judged) continue;
      const dt = it.t - elapsed;
      const z  = Math.max(0, dt*speedZ);
      it.el.object3D.position.z = z;
      if(dt<-0.22 && !it.judged){ it.judged=true; it.el.setAttribute('visible','false'); combo=0; toast('Miss','#fecaca'); }
    }

    updateFever();
    if(elapsed>=duration) return end('Stage Clear');
    setHUD();
    raf=requestAnimationFrame(loop);
  }

  function bind(){
    document.getElementById('btnStart').onclick=()=>{ ensureAudio(); if(!running) start(); };
    document.getElementById('btnReset').onclick=()=>reset();

    // ปุ่ม/คีย์/แทป
    const hit = ()=>{ ensureAudio(); judge(); };
    window.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter') hit(); });

    // แผ่น TAP กลางจอ
    const pad=document.createElement('a-entity');
    pad.setAttribute('geometry','primitive: plane; width:2.2; height:0.6');
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
