// /adventure/game.js — Stronger UI (lane colors + lane arrows + pre-start guide)
(function(){
  // ===== State =====
  let running=false, raf=0, t0=0, elapsed=0;
  let score=0, lives=3, lane=1, combo=0, bestCombo=0;
  let fever=false, feverEnd=0, shield=0;
  let items=[], duration=58, tutorial=true;
  const root = document.getElementById('root');
  const hud  = document.getElementById('hud');
  const scene= document.getElementById('scene');
  const statusEl=document.getElementById('status');
  let laneUIBuilt=false, guideBoard=null, laneArrows=[];

  // ===== Audio =====
  let actx=null, sfx=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); sfx=actx.createGain(); sfx.gain.value=0.16; sfx.connect(actx.destination); }
  function beep(f=660,d=0.06,type='square',g=0.22){
    if(!actx) return; const o=actx.createOscillator(), v=actx.createGain();
    o.type=type; o.frequency.value=f; o.connect(v); v.connect(sfx);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.01);
    v.gain.linearRampToValueAtTime(0,t+d); o.start(t); o.stop(t+d+0.02);
  }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // ===== HUD / FX =====
  function setHUD(msg){
    const f = fever ? ' • FEVER!' : '';
    const legend = 'เก็บ: ✅ เขียว / ⭐ ทอง / 🛡️ กันชน / ⏱️ เวลา  |  หลบ: ⚠️ แดง';
    hud.setAttribute('text',
      `value:${legend}\nScore ${score} • Lives ${lives} • Combo ${combo} (Best ${bestCombo})${f}\n${msg||''}; width:5.4; align:center; color:#e2e8f0`);
  }
  function toast(txt,color="#7dfcc6",y=0.95,ms=560){
    const t=document.createElement('a-entity');
    t.setAttribute('text',`value:${txt}; width:5; align:center; color:${color}`);
    t.setAttribute('position',`0 ${y} 0.05`);
    root.appendChild(t);
    t.setAttribute('animation__up','property: position; to: 0 1.15 0.05; dur: 400; easing: easeOutQuad');
    setTimeout(()=>t.remove(),ms);
  }
  function flash(color="#ef4444"){
    const f=document.createElement('a-entity');
    f.setAttribute('geometry','primitive: plane; width: 6; height: 3.2');
    f.setAttribute('material',`color:${color}; opacity:0.18; shader:flat`);
    f.setAttribute('position','0 0 0.03');
    root.appendChild(f);
    setTimeout(()=>f.remove(),120);
  }
  function shake(intensity=0.035, ms=160){
    const end=performance.now()+ms;
    const tick=()=>{ const p=(end-performance.now())/ms;
      if(p<=0){ root.object3D.position.set(0,0,0); return; }
      root.object3D.position.x=(Math.random()*2-1)*intensity*p;
      root.object3D.position.y=(Math.random()*2-1)*intensity*p;
      requestAnimationFrame(tick);
    }; tick();
  }
  const lanePos=[-1.2,0,1.2];
  function laneX(i){ return lanePos[i]; }

  // ===== LANE UI: สีพื้นแต่ละเลน + ลูกศรติดเลน =====
  function buildLaneUI(){
    if(laneUIBuilt) return; laneUIBuilt=true;

    // พื้นสีเลน (ซ้าย=น้ำเงิน, กลาง=เทา, ขวา=เขียวอ่อน)
    const laneColors = ['#0ea5e9','#334155','#22c55e'];
    lanePos.forEach((x,i)=>{
      const bg=document.createElement('a-entity');
      bg.setAttribute('geometry','primitive: plane; width:1.05; height:1.35');
      bg.setAttribute('material',`color:${laneColors[i]}; opacity:0.12; shader:flat`);
      bg.setAttribute('position',`${x} 0 0.02`);
      root.appendChild(bg);

      // ป้ายชื่อเลน
      const tag=document.createElement('a-entity');
      tag.setAttribute('text',`value:${['เลนซ้าย','เลนกลาง','เลนขวา'][i]}; width:2.4; align:center; color:#9fb1d1`);
      tag.setAttribute('position',`${x} -0.75 0.05`);
      root.appendChild(tag);

      // ลูกศรชี้เลน (ลอย/กะพริบ)
      const arr=document.createElement('a-entity');
      arr.setAttribute('geometry','primitive: cone; radiusBottom:0.09; radiusTop:0; height:0.22');
      arr.setAttribute('material','color:#93c5fd; opacity:0.9; shader:flat');
      arr.setAttribute('position',`${x} -0.1 0.055`);
      arr.setAttribute('rotation','-90 0 0');
      arr.setAttribute('animation__bob','property: position; to: '+x+' -0.05 0.055; dir: alternate; dur: 600; loop: true; easing: easeInOutSine');
      arr.setAttribute('animation__blink','property: material.opacity; to: 0.35; dir: alternate; dur: 420; loop: true; easing: easeInOutSine');
      root.appendChild(arr);
      laneArrows.push(arr);
    });

    // เส้น Hit Line เด่นขึ้น
    const hit=document.createElement('a-entity');
    hit.setAttribute('geometry','primitive: ring; radiusInner:0.06; radiusOuter:0.075; segmentsTheta:64');
    hit.setAttribute('material','color:#93c5fd; opacity:0.95; shader:flat');
    hit.setAttribute('position','0 0 0.06');
    hit.setAttribute('animation__pulse','property: scale; to: 1.06 1.06 1; dir: alternate; dur: 480; loop: true; easing: easeInOutSine');
    root.appendChild(hit);
  }
  function showGuideBoard(){
    if(guideBoard) return;
    guideBoard=document.createElement('a-entity');
    guideBoard.setAttribute('position','0 0.85 0.07');
    guideBoard.setAttribute('geometry','primitive: plane; width: 2.6; height: 1.1');
    guideBoard.setAttribute('material','color:#0b1220; opacity:0.92; shader:flat');

    const title=document.createElement('a-entity');
    title.setAttribute('text','value:วิธีเล่น (ตัวอย่างก่อนเริ่ม); width:4.5; align:center; color:#e2e8f0');
    title.setAttribute('position','0 0.42 0.01');
    guideBoard.appendChild(title);

    const lines=[
      '✅ เก็บพลังงาน / ⭐ ทอง / 🛡️ กันชน / ⏱️ เพิ่มเวลา',
      '⚠️ สิ่งกีดขวาง — หลีก!',
      'ควบคุม: A=ซ้าย  S=กลาง  D=ขวา  (หรือ ← ↑ →)'
    ];
    lines.forEach((t,i)=>{
      const row=document.createElement('a-entity');
      row.setAttribute('text',`value:${t}; width:4.8; align:center; color:#cbd5e1`);
      row.setAttribute('position',`0 ${0.18 - i*0.22} 0.01`);
      guideBoard.appendChild(row);
    });

    // ไอคอนตัวอย่าง
    const demo=(x,kind,label,col)=>{
      const n=document.createElement('a-entity');
      let geo='sphere; radius:0.16', color=col;
      if(kind==='ob')  { geo='box; width:0.6; height:0.42; depth:0.3'; }
      if(kind==='gold'){ geo='sphere; radius:0.20'; }
      if(kind==='shield'){ geo='torus; radius:0.22; radiusTubular:0.03'; }
      if(kind==='time'){ geo='cylinder; radius:0.16; height:0.12'; }
      n.setAttribute('geometry','primitive: '+geo);
      n.setAttribute('material',`color:${color}; shader:flat; opacity:0.98`);
      n.setAttribute('position',`${x} -0.15 0.02`);
      const lab=document.createElement('a-entity');
      lab.setAttribute('text',`value:${label}; width:2; align:center; color:#9fb1d1`);
      lab.setAttribute('position','0 -0.28 0.01'); n.appendChild(lab);
      guideBoard.appendChild(n);
    };
    demo(-0.9,'orb','พลังงาน','#22c55e');
    demo(-0.3,'gold','ทอง','#f59e0b');
    demo( 0.3,'shield','กันชน','#7dfcc6');
    demo( 0.9,'time','เพิ่มเวลา','#fcd34d');

    root.appendChild(guideBoard);
  }
  function hideGuideBoard(){ if(guideBoard){ guideBoard.remove(); guideBoard=null; } }

  // ===== Spawner =====
  const WAVES = ["mix","zigzag","rush","gauntlet"];
  function spawn(kind,lane,time){
    const n=document.createElement('a-entity');
    n.classList.add('itm'); n.dataset.kind=kind; n.dataset.t=time; n.dataset.lane=lane; n.dataset.hit="0";
    let geo, col;
    if(kind==='orb'){ geo='sphere; radius:0.16'; col='#22c55e'; }
    else if(kind==='gold'){ geo='sphere; radius:0.2'; col='#f59e0b'; }
    else if(kind==='ob'){ geo='box; width:0.7; height:0.5; depth:0.3'; col='#ef4444'; }
    else if(kind==='shield'){ geo='torus; radius:0.22; radiusTubular:0.03'; col='#7dfcc6'; }
    else if(kind==='time'){ geo='cylinder; radius:0.16; height:0.12'; col='#fcd34d'; }
    n.setAttribute('geometry','primitive: '+geo);
    n.setAttribute('material',`color:${col}; shader:flat; opacity:0.98`);
    n.object3D.position.set(laneX(lane), 0, 3.2);
    root.appendChild(n);
    items.push({el:n, t:time, lane, kind, judged:false});
  }
  function genTutorial(){
    items.forEach(n=>n.el?.remove()); items.length=0;
    let tt=0.8;
    spawn('orb', 1, tt); tt+=1.2;
    spawn('ob',  1, tt); tt+=1.2;
    spawn('gold',0, tt); tt+=1.0;
    spawn('shield',2,tt); tt+=1.0;
    spawn('time', 1, tt);
  }
  function genWaves(){
    items.forEach(n=>n.el?.remove()); items.length=0;
    const sec = 8; let t=0.9;
    while(t<duration){
      const wave = WAVES[(Math.random()*WAVES.length)|0];
      const end = Math.min(duration, t+sec);
      if(wave==="mix"){
        for(let tt=t; tt<end; tt+=0.85+(Math.random()*0.2-0.08)){
          const ln=(Math.random()*3|0); spawn(Math.random()<0.64?'orb':'ob',ln,tt);
          if(Math.random()<0.14) spawn('shield',(Math.random()*3|0),tt+0.18);
          if(Math.random()<0.10) spawn('time',(Math.random()*3|0),tt+0.26);
          if(Math.random()<0.08) spawn('gold',(Math.random()*3|0),tt+0.34);
        }
      }else if(wave==="zigzag"){
        let ln=0, dir=1;
        for(let tt=t; tt<end; tt+=0.55){
          spawn('ob', ln, tt);
          ln+=dir; if(ln===2||ln===0) dir*=-1;
          if(Math.random()<0.6) spawn('orb', (ln+1)%3, tt+0.18);
        }
      }else if(wave==="rush"){
        for(let tt=t; tt<end; tt+=0.42){
          const ln=(Math.random()*3|0);
          spawn(Math.random()<0.5?'ob':'orb', ln, tt);
        }
      }else if(wave==="gauntlet"){
        const ln=(Math.random()*3|0);
        for(let tt=t; tt<end; tt+=0.5){
          spawn((tt*10|0)%2===0?'ob':'orb', ln, tt);
        }
      }
      t=end;
    }
    for(let tt=duration-8; tt<duration; tt+=0.38){
      const ln=(Math.random()*3|0); spawn(Math.random()<0.6?'ob':'orb', ln, tt);
      if(Math.random()<0.12) spawn('gold',(Math.random()*3|0),tt+0.2);
    }
  }

  // ===== Gameplay =====
  function addScore(n,label,color){ score += fever ? Math.round(n*1.5) : n; if(label) toast(label,color); }
  function setLane(i){ lane=Math.max(0,Math.min(2,i)); }
  function collect(kind){
    if(kind==='orb'){ addScore(20,'✅ +20','#22c55e'); combo++; beep(760,0.04,'triangle',0.2); }
    if(kind==='gold'){ addScore(100,'⭐ +100','#f59e0b'); combo+=2; beep(980,0.06,'square',0.22); }
    if(kind==='shield'){ shield = Math.min(2, shield+1); toast('🛡️ +1','#7dfcc6'); beep(520,0.05,'sine',0.2); }
    if(kind==='time'){ duration=Math.min(70,duration+2); toast('⏱️ +เวลา','#fde68a'); beep(680,0.05,'sine',0.2); }
    bestCombo=Math.max(bestCombo,combo);
    if(!fever && combo>0 && combo%10===0){ fever=true; feverEnd=elapsed+7; toast('FEVER! ✨','#7dfcc6',1.0,720); }
  }
  function hitObstacle(){
    if(shield>0){ shield--; toast('🛡️ Block','#7dfcc6'); beep(420,0.06,'sawtooth',0.22); return; }
    lives--; combo=0; toast('⚠️ ชน -1 ชีวิต','#ef4444'); flash('#ef4444'); shake(); beep(180,0.1,'sawtooth',0.26);
    if(lives<=0){ return end('Game Over'); }
  }
  function updateFever(){ if(fever && elapsed>=feverEnd){ fever=false; toast('Fever End','#cbd5e1'); } }
  function curSpeed(){
    const base= tutorial?1.6 : 2.2;
    const timeBoost=Math.min(1.0,elapsed*0.016);
    const comboBoost=Math.min(0.8,Math.floor(combo/8)*0.12);
    const feverBoost = fever?0.18:0;
    return base + timeBoost + comboBoost + feverBoost;
  }

  // ===== Flow =====
  function start(){
    running=true; t0=performance.now()/1000; elapsed=0;
    score=0; lives=3; lane=1; combo=0; bestCombo=0; fever=false; feverEnd=0; shield=0; duration=58; tutorial=true;
    buildLaneUI(); showGuideBoard();
    genTutorial();
    setHUD('เริ่ม! ให้วัตถุถึง “วงฟ้า” แล้วอยู่เลนที่ถูกต้อง (A/S/D หรือ ←↑→)');
    setTimeout(()=>{ tutorial=false; hideGuideBoard(); genWaves(); toast('เริ่มจริงแล้ว!','#cbd5e1'); }, 6000);
    loop();
  }
  function end(title='จบเกม'){ running=false; cancelAnimationFrame(raf); setHUD(`${title} • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); items.forEach(n=>n.el?.remove()); items.length=0;
    score=0; lives=3; lane=1; combo=0; bestCombo=0; fever=false; shield=0; duration=58; tutorial=true;
    setHUD('พร้อมเริ่ม • กด Start'); showGuideBoard();
  }

  function loop(){
    if(!running) return;
    const now=performance.now()/1000; elapsed=now-t0;
    const speedZ = curSpeed();

    for(const it of items){
      if(it.judged) continue;
      const dt = it.t - elapsed;
      it.el.object3D.position.z = Math.max(0, dt*speedZ);
      if(Math.abs(dt)<=0.34){
        if(parseInt(it.lane,10)===lane){
          if(it.kind==='ob'){ it.judged=true; it.el.setAttribute('visible','false'); hitObstacle(); }
          else{ it.judged=true; it.el.setAttribute('visible','false'); collect(it.kind); }
        }
      }else if(dt<-0.36 && !it.judged){
        it.judged=true; it.el.setAttribute('visible','false');
        if(it.kind!=='ob'){ combo = Math.max(0, combo-1); }
      }
    }
    updateFever();
    setHUD('เลน: ซ้าย(A/←) • กลาง(S/↑) • ขวา(D/→)');
    if(elapsed>=duration) return end('Stage Clear');
    raf=requestAnimationFrame(loop);
  }

  // ===== Bind =====
  function bind(){
    document.getElementById('btnStart').onclick=()=>{ ensureAudio(); if(!running) start(); };
    document.getElementById('btnReset').onclick=()=>reset();
    window.addEventListener('keydown',(e)=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') lane=0;
      if(k==='s'||k==='arrowup')   lane=1;
      if(k==='d'||k==='arrowright')lane=2;
    });
    statusEl.textContent='พร้อมเริ่ม • กด Start';
  }
  if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();
