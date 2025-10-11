// /adventure/game.js  — QuickFix Plus (เล่นได้ทันที + สนุกขึ้น)
(function(){
  // ---- State ----
  let running=false, raf=0, t0=0, elapsed=0;
  let score=0, lives=3, lane=1, combo=0, bestCombo=0, fever=false, feverEnd=0;
  let items=[]; // {el, t, lane, kind, judged}
  let duration=50; // จะขยาย/หดตามเกม
  const speedBase=2.2;

  // ---- DOM ----
  const root = document.getElementById('root');
  const hud  = document.getElementById('hud');
  const scene= document.getElementById('scene');
  const statusEl = document.getElementById('status');

  // ---- Audio (ปลอดภัย: เปิดหลัง user gesture) ----
  let actx=null, sfx=null;
  function ensureAudio(){ if(actx) return;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); sfx=actx.createGain(); sfx.gain.value=0.12; sfx.connect(actx.destination);
  }
  function beep(freq=660, dur=0.07, type='square', gain=0.2){
    if(!actx) return; const o=actx.createOscillator(), g=actx.createGain();
    o.type=type; o.frequency.value=freq; o.connect(g); g.connect(sfx);
    const t=actx.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+0.01);
    g.gain.linearRampToValueAtTime(0,t+dur); o.start(t); o.stop(t+dur+0.02);
  }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // ---- HUD / FX ----
  function setHUD(msg){
    const feverTxt = fever ? ' • FEVER!' : '';
    hud.setAttribute('text',
      `value:Score ${score} • Lives ${lives} • Combo ${combo} (Best ${bestCombo})${feverTxt}\n${msg||''}; width:5; align:center; color:#e2e8f0`);
  }
  function fxToast(txt,color="#7dfcc6",y=0.9,ms=560){
    const t=document.createElement('a-entity');
    t.setAttribute('text',`value:${txt}; width:5; align:center; color:${color}`);
    t.setAttribute('position',`0 ${y} 0.05`);
    root.appendChild(t);
    t.setAttribute('animation__up','property: position; to: 0 1.1 0.05; dur: 420; easing: easeOutQuad');
    setTimeout(()=>t.remove(), ms);
  }
  function laneX(i){ return [-1.2,0,1.2][i]; }

  // ---- Spawn ----
  function spawn(kind,lane,time){
    const n=document.createElement('a-entity');
    n.classList.add('itm');
    n.dataset.kind=kind; n.dataset.t=time; n.dataset.lane=lane; n.dataset.hit="0";
    let geo, col;
    if(kind==='orb'){ geo='sphere; radius:0.16'; col='#22c55e'; }
    else if(kind==='ob'){ geo='box; width:0.7; height:0.5; depth:0.3'; col='#ef4444'; }
    else if(kind==='shield'){ geo='torus; radius:0.22; radiusTubular:0.03'; col='#7dfcc6'; }
    else if(kind==='time'){ geo='cylinder; radius:0.16; height:0.12'; col='#fcd34d'; }
    n.setAttribute('geometry','primitive: '+geo);
    n.setAttribute('material',`color:${col}; shader:flat; opacity:0.98`);
    n.object3D.position.set(laneX(lane), 0, 3.2);
    root.appendChild(n);
    items.push({el:n, t:time, lane, kind, judged:false});
  }
  function genPattern(){
    items.forEach(n=>n.el.remove()); items.length=0;
    // ความยากเริ่มต้น + จะเพิ่มตามเวลา/คอมโบ
    let t=0.9; const dur=duration; const baseGap=0.86;
    while(t<dur){
      const L=(Math.random()*3|0);
      // เลือกชนิด
      let kind = Math.random()<0.64 ? 'orb' : 'ob';
      // สุ่มคลัสเตอร์
      if(Math.random()<0.25) kind = 'orb';
      spawn(kind, L, t);

      // โอกาสเกิดคู่/สาม
      if(Math.random()<0.28) spawn(Math.random()<0.7?'orb':'ob', (Math.random()*3|0), t+0.22);
      if(Math.random()<0.16) spawn('orb', (Math.random()*3|0), t+0.36);

      // power-up นานๆที
      if(Math.random()<0.06) spawn('shield',(Math.random()*3|0), t+0.18);
      if(Math.random()<0.05) spawn('time',  (Math.random()*3|0), t+0.26);

      // ระยะห่างพื้นฐาน + เขย่าเล็กน้อย
      t += baseGap + (Math.random()*0.22 - 0.08);
    }
  }

  // ---- Gameplay ----
  let shield=0;
  function addScore(n, label, color){ score += fever ? Math.round(n*1.5) : n; if(label) fxToast(label,color); }
  function setLane(i){ lane=Math.max(0,Math.min(2,i)); }
  function hitObstacle(){
    if(shield>0){ shield--; fxToast('Shield! - block','#7dfcc6'); beep(420,0.06,'sawtooth',0.22); return; }
    lives--; combo=0; fxToast('Hit -1 life','#ef4444'); beep(180,0.1,'sawtooth',0.26);
    if(lives<=0){ return end('Game Over'); }
  }
  function collect(kind){
    if(kind==='orb'){ addScore(20,'+20 Energy','#22c55e'); beep(660,0.06,'triangle',0.22); combo++; bestCombo=Math.max(bestCombo,combo); }
    if(kind==='shield'){ shield = Math.min(2, shield+1); fxToast('Shield +1','#7dfcc6'); beep(520,0.06,'sine',0.2); }
    if(kind==='time'){ duration = Math.min(duration+2, 70); fxToast('+Time','#facc15'); beep(740,0.06,'square',0.22); }
    // Fever trigger
    if(!fever && combo>0 && combo%10===0){ fever=true; feverEnd = elapsed + 7; fxToast('FEVER! ✨','#7dfcc6',1.0,720); }
  }
  function updateFever(){
    if(fever && elapsed>=feverEnd){ fever=false; fxToast('Fever End','#cbd5e1'); }
  }

  // Adaptive difficulty: เพิ่มความเร็วสไลด์ตามเวลา/คอมโบ
  function curSpeed(){
    const timeBoost = Math.min(0.8, elapsed*0.015);
    const comboBoost= Math.min(0.7, Math.floor(combo/8)*0.12);
    return speedBase + timeBoost + comboBoost;
  }

  function start(){
    running=true; t0=performance.now()/1000; elapsed=0;
    score=0; lives=3; lane=1; combo=0; bestCombo=0; fever=false; feverEnd=0; shield=0; duration=50;
    genPattern();
    setHUD('เริ่ม! A/S/D หรือ ←↑→ • เก็บเขียว หลบแดง • มี Power-up ด้วย');
    loop();
  }
  function end(title='จบเกม'){
    running=false; cancelAnimationFrame(raf);
    setHUD(`${title} • Score ${score}`);
  }
  function reset(){
    running=false; cancelAnimationFrame(raf);
    items.forEach(n=>n.el?.remove()); items.length=0;
    score=0; lives=3; combo=0; bestCombo=0; fever=false; shield=0; duration=50;
    setHUD('พร้อมเริ่ม • กด Start');
  }

  function loop(){
    if(!running) return;
    const now=performance.now()/1000; elapsed=now-t0;

    // สุ่มเพิ่มความหนาแน่นเล็กน้อยเมื่อยืดเวลา
    // (ใช้ความเร็วเคลื่อนเป็นตัวทำให้โหดขึ้น)
    const speedZ = curSpeed();

    // เคลื่อน + ตัดสิน
    for(const it of items){
      if(it.judged) continue;
      const dt = it.t - elapsed;
      const z  = Math.max(0, dt*speedZ);
      it.el.object3D.position.z = z;

      if(Math.abs(dt) <= 0.33){ // หน้าตัดฮิต
        if(parseInt(it.lane,10)===lane){
          // ชนิด
          if(it.kind==='orb' || it.kind==='shield' || it.kind==='time'){
            collect(it.kind);
          }else if(it.kind==='ob'){
            hitObstacle();
          }
          it.judged=true; it.el.setAttribute('visible','false');
        }
      }else if(dt < -0.35 && !it.judged){
        it.judged=true; it.el.setAttribute('visible','false');
        // พลาด orb ไม่หัก แต่รีเซ็ตคอมโบนิดๆเพื่อกันยาวไป?
        if(it.kind==='orb'){ combo = Math.max(0, combo-1); }
      }
    }

    updateFever();
    setHUD('A/S/D หรือ ลูกศร ←↑→');
    if(elapsed>=duration) return end('Stage Clear');
    raf=requestAnimationFrame(loop);
  }

  function bind(){
    document.getElementById('btnStart').onclick=()=>{ ensureAudio(); if(!running) start(); };
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
