/* games/rhythm-boxer/game.js
   Rhythm Boxer · Cursor(mouse) คลิกติดแน่ · เริ่มช้าแล้วเร่ง · HUD/ปุ่มทำงานครบ · Back to Hub ถูกที่
*/
(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

  // ---------- SFX ----------
  const SFX = {
    good: new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss: new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo: new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui: new Audio(`${ASSET_BASE}/assets/sfx/success.wav`)
  };
  Object.values(SFX).forEach(a=>{ a.preload='auto'; a.crossOrigin='anonymous'; });

  // ---------- Music ----------
  let music = new Audio(); music.crossOrigin='anonymous'; music.preload='auto';

  // ---------- State ----------
  const RB = window.RB = (window.RB||{});
  RB.running=false; RB.paused=false;

  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let timer=null, spawnTimer=null, accelRAF=null;

  // ความเร็ว: เริ่มช้า แล้วค่อยเร่งขึ้น
  let speedPreset='standard';
  let fallSpeed=0.7;     // m/s (เริ่มช้า)
  let spawnInt=1200;     // ms (เริ่มห่าง)
  let accelEvery=4000;   // ทุก ๆ N ms จะเร่ง
  let lastAccel=0;

  // Note spec
  const COLORS=["#00d0ff","#ffd166","#ff6b6b","#00ffa3","#a899ff","#ff9c6b"];
  const NOTE_SIZE=0.2; // ใหญ่ขึ้น
  const HIT_Y=1.1;
  const HIT_WIN_GOOD=0.19;
  const HIT_WIN_PERF=0.10;

  function updateHUD(){
    $('hudScore').textContent = score;
    $('hudCombo').textContent = combo;
    $('hudTime').textContent = timeLeft;
    $('hudSpeed').textContent = speedPreset[0].toUpperCase()+speedPreset.slice(1);
  }
  function floatText(text,color,pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.22;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    $('arena').appendChild(e); setTimeout(()=>{ try{e.remove();}catch(_e){} },820);
  }

  // ---------- Notes ----------
  function spawnNote(){
    spawns++;
    const x = (Math.random()*2.2 - 1.1).toFixed(2);
    const z = -2.3;
    const yStart = 2.7;
    const shape = Math.random()<0.5 ? 'a-sphere' : 'a-box';
    const c = COLORS[Math.floor(Math.random()*COLORS.length)];

    const el=document.createElement(shape);
    el.classList.add('clickable','rb-note');
    if(shape==='a-sphere'){
      el.setAttribute('radius', NOTE_SIZE);
    }else{
      el.setAttribute('width', NOTE_SIZE*1.8);
      el.setAttribute('height', NOTE_SIZE*1.8);
      el.setAttribute('depth', NOTE_SIZE*1.8);
    }
    el.setAttribute('material', `color:${c}; opacity:0.95; transparent:true; metalness:0.1; roughness:0.4`);
    el.setAttribute('position', `${x} ${yStart} ${z}`);
    $('arena').appendChild(el);

    // รองรับทั้ง cursor 'click' และ 'mousedown'
    const hitHandler=()=>{ onHit(el); };
    el.addEventListener('click', hitHandler);
    el.addEventListener('mousedown', hitHandler);

    const start=performance.now();
    const me = {el, alive:true};
    function step(){
      if(!me.alive || !RB.running) return;
      const dt = (performance.now()-start)/1000;
      const y = yStart - dt*fallSpeed;
      el.setAttribute('position', `${x} ${y.toFixed(3)} ${z}`);
      if(y <= HIT_Y - HIT_WIN_GOOD*1.35){
        me.alive=false;
        try{ el.remove(); }catch(_){}
        onMiss(new THREE.Vector3(parseFloat(x),HIT_Y,z));
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function onHit(el){
    if(!RB.running) return;
    const p = el.object3D.getWorldPosition(new THREE.Vector3());
    const dy = Math.abs(p.y - HIT_Y);

    let quality='good';
    if(dy <= HIT_WIN_PERF) quality='perfect';
    else if(dy <= HIT_WIN_GOOD) quality='good';
    else quality='miss';

    try{ el.remove(); }catch(_){}
    if(quality==='miss'){ onMiss(p); return; }

    hits++;
    combo++; maxCombo=Math.max(maxCombo, combo);
    score += (quality==='perfect'? 20 : 10);
    (quality==='perfect'? SFX.perfect : SFX.good).play();
    floatText(quality.toUpperCase(), quality==='perfect' ? '#00ffa3' : '#00d0ff', p);
    if(combo>0 && combo%10===0){ SFX.combo.play(); }
    updateHUD();
  }

  function onMiss(p){
    combo=0;
    score = Math.max(0, score-3);
    SFX.miss.play();
    floatText('MISS','#ff5577', p);
    updateHUD();
  }

  // ---------- Flow ----------
  function setBaseByPreset(){
    if(speedPreset==='beginner'){
      fallSpeed=0.55; spawnInt=1600; accelEvery=5000;
    }else if(speedPreset==='challenge'){
      fallSpeed=0.9;  spawnInt=900;  accelEvery=3500;
    }else{ // standard
      fallSpeed=0.7;  spawnInt=1200; accelEvery=4000;
    }
  }
  function presetName(v){ return v==='beginner'?'Beginner':v==='challenge'?'Challenge':'Standard'; }

  function clearNotes(){
    Array.from(document.querySelectorAll('.rb-note')).forEach(n=>{ try{ n.remove(); }catch(_){} });
  }

  function start(){
    if(RB.running) return;
    RB.running=true; RB.paused=false;
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60;
    clearNotes();

    setBaseByPreset();
    $('hudSpeed').textContent = presetName(speedPreset);
    updateHUD();

    // เวลาเดิน
    timer = setInterval(()=>{ timeLeft--; $('hudTime').textContent=timeLeft; if(timeLeft<=0) endGame(); }, 1000);

    // สปอว์นทันที + ตั้ง interval
    spawnNote();
    spawnTimer = setInterval(spawnNote, spawnInt);

    // เร่งทีละนิดเป็นช่วง ๆ
    lastAccel = performance.now();
    const accelTick = ()=>{
      if(!RB.running) return;
      const now=performance.now();
      if(now - lastAccel >= accelEvery){
        lastAccel = now;
        fallSpeed = clamp(fallSpeed + 0.06, 0.45, 2.2);
        spawnInt = clamp(spawnInt - 60, 420, 2400);
        clearInterval(spawnTimer);
        spawnTimer = setInterval(spawnNote, spawnInt);
      }
      accelRAF = requestAnimationFrame(accelTick);
    };
    accelTick();

    playSelectedSong();
  }

  function pause(){
    if(!RB.running || RB.paused) return;
    RB.paused=true;
    clearInterval(timer); clearInterval(spawnTimer);
    if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    try{ music.pause(); }catch(_){}
  }
  function resume(){
    if(!RB.running || !RB.paused) return;
    RB.paused=false;
    timer = setInterval(()=>{ timeLeft--; $('hudTime').textContent=timeLeft; if(timeLeft<=0) endGame(); }, 1000);
    spawnTimer = setInterval(spawnNote, spawnInt);
    lastAccel = performance.now();
    const accelTick = ()=>{
      if(!RB.running || RB.paused) return;
      const now=performance.now();
      if(now - lastAccel >= accelEvery){
        lastAccel = now;
        fallSpeed = clamp(fallSpeed + 0.06, 0.45, 2.2);
        spawnInt = clamp(spawnInt - 60, 420, 2400);
        clearInterval(spawnTimer);
        spawnTimer = setInterval(spawnNote, spawnInt);
      }
      accelRAF = requestAnimationFrame(accelTick);
    };
    accelTick();
    music.play().catch(()=>{});
  }

  function endGame(){
    if(!RB.running) return;
    RB.running=false; RB.paused=false;
    clearInterval(timer); clearInterval(spawnTimer);
    if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    try{ music.pause(); }catch(_){}
    clearNotes();

    const acc = spawns? Math.round((hits/spawns)*100) : 0;
    $('rSong').textContent = $('hudSong').textContent || '—';
    $('rScore').textContent = score;
    $('rMaxCombo').textContent = maxCombo;
    $('rAcc').textContent = acc+'%';
    $('results').style.display='grid';
    SFX.ui.play();
  }

  function playSelectedSong(){
    const opt = $('songSel')?.selectedOptions?.[0];
    const url = opt?.value;
    const title = opt?.dataset?.title || opt?.textContent || '—';
    $('hudSong').textContent = title || '—';
    if(!url || url==='none'){ try{ music.pause(); }catch(_){ } return; }
    try{
      music.src = url;
      music.currentTime = 0;
      music.play().catch(()=>{ /* บางเบราว์เซอร์ต้องคลิกก่อน */ });
    }catch(_e){}
  }

  function setSpeed(v){
    speedPreset = (v||'standard');
    $('hudSpeed').textContent = presetName(speedPreset);
  }

  // ---------- Wire UI ----------
  function wireUI(){
    const s=$('btnStart'), p=$('btnPause'), e=$('btnEnd'),
          replay=$('replayBtn'), back=$('backBtn'),
          songSel=$('songSel'), speedSel=$('speedSel');

    s?.addEventListener('click', ()=> start());
    p?.addEventListener('click', ()=>{
      if(!RB.running) return;
      if(!RB.paused){ pause();  p.textContent='Resume'; }
      else          { resume(); p.textContent='Pause'; }
    });
    e?.addEventListener('click', ()=> endGame());
    replay?.addEventListener('click', ()=>{ $('results').style.display='none'; start(); });
    back?.addEventListener('click', ()=>{ location.href=HUB_URL; });

    songSel?.addEventListener('change', ()=> playSelectedSong());
    speedSel?.addEventListener('change', ()=> setSpeed(speedSel.value));

    // ปุ่ม Enter VR (กลางล่าง)
    $('enterVRBtn')?.addEventListener('click', ()=>{
      try{ document.querySelector('a-scene')?.enterVR?.(); }catch(_){}
    });

    // ช็อตคัตคีย์: Space = Start/Resume, Esc = End
    addEventListener('keydown', (ev)=>{
      if(ev.code==='Space'){ ev.preventDefault(); if(!RB.running) start(); else if(RB.paused) resume(); else pause(); }
      if(ev.code==='Escape'){ endGame(); }
    });
  }

  function boot(){
    wireUI();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }

  // iOS audio unlock
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext);
    let ctx = Ctx? new Ctx() : null;
    function resume(){
      if(unlocked || !ctx) return;
      ctx.resume?.(); unlocked = (ctx.state==='running');
    }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev, resume, {once:true, passive:true}));
  })();

})();
