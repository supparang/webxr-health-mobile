/* games/rhythm-boxer/game.js
   Rhythm Boxer · Fix: no double-judgement (hit→miss), single click handler, kill RAF on hit, start slow then ramp, HUD/buttons OK
*/
(function(){
  "use strict";

  // ------------ Utils ------------
  const $ = (id)=>document.getElementById(id);
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

  // safe remove
  function safeRemove(el){
    try{
      if(!el) return;
      if(el.parentNode) el.parentNode.removeChild(el);
      else el.remove?.();
    }catch(_){}
  }

  // float text
  function floatText(text,color,pos){
    try{
      const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.22;
      e.setAttribute('text',{value:text,color,align:'center',width:2.6});
      e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
      e.setAttribute('scale','0.001 0.001 0.001');
      e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
      e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.55} ${p.z}`,dur:560,easing:'easeOutQuad'});
      e.setAttribute('animation__fade',{property:'opacity',to:0,dur:420,delay:120,easing:'linear'});
      $('arena').appendChild(e);
      setTimeout(()=>safeRemove(e),780);
    }catch(_){}
  }

  // ------------ SFX ------------
  const mk = (p)=>{ const a=new Audio(p); a.preload='auto'; a.crossOrigin='anonymous'; return a; };
  const SFX = {
    good:    mk(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect: mk(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:    mk(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo:   mk(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui:      mk(`${ASSET_BASE}/assets/sfx/success.wav`)
  };

  // ------------ Music ------------
  let music = new Audio(); music.crossOrigin='anonymous'; music.preload='auto';

  // ------------ State ------------
  const RB = window.RB = (window.RB||{});
  RB.running=false; RB.paused=false;

  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let timer=null, spawnTimer=null, accelRAF=null;

  // pacing
  let speedPreset='standard';
  let fallSpeed=0.7;     // start slow
  let spawnInt =1200;    // start sparse
  let accelEvery=4000;
  let lastAccel=0;

  // visuals / judge
  const COLORS=["#00d0ff","#ffd166","#ff6b6b","#00ffa3","#a899ff","#8cf5ff"];
  const NOTE_SIZE=0.20;
  const HIT_Y=1.10;
  const HIT_WIN_GOOD=0.19;
  const HIT_WIN_PERF=0.10;

  // ------------ HUD ------------
  function updateHUD(){
    $('hudScore') && ( $('hudScore').textContent = score );
    $('hudCombo') && ( $('hudCombo').textContent = combo );
    $('hudTime')  && ( $('hudTime').textContent  = timeLeft );
    $('hudSpeed') && ( $('hudSpeed').textContent = presetName(speedPreset) );
  }
  function presetName(v){ return v==='beginner'?'Beginner':v==='challenge'?'Challenge':'Standard'; }

  // ------------ Notes (fixed double judgement) ------------
  function spawnNote(){
    spawns++;
    const x = (Math.random()*2.2 - 1.1).toFixed(2);
    const z = -2.3, yStart = 2.7;
    const shape = Math.random()<0.5 ? 'a-sphere' : 'a-box';
    const color = COLORS[(Math.random()*COLORS.length)|0];

    const el=document.createElement(shape);
    el.classList.add('clickable','rb-note');
    el.__alive   = true;   // still updating
    el.__handled = false;  // already judged (prevents double hit)
    let rafId = 0;

    if(shape==='a-sphere'){
      el.setAttribute('radius', NOTE_SIZE*1.1);
    }else{
      el.setAttribute('width',  NOTE_SIZE*1.8);
      el.setAttribute('height', NOTE_SIZE*1.8);
      el.setAttribute('depth',  NOTE_SIZE*1.8);
    }
    el.setAttribute('material', `color:${color}; opacity:0.96; transparent:true; metalness:0.08; roughness:0.4`);
    el.setAttribute('position', `${x} ${yStart} ${z}`);
    $('arena').appendChild(el);

    // Single click handler only (no mousedown) + guard with __handled
    el.addEventListener('click', ()=>{
      if(!RB.running || !el.__alive || el.__handled) return;
      el.__handled = true;       // lock this note
      el.__alive   = false;      // stop the RAF loop
      try{ cancelAnimationFrame(rafId); }catch(_){}
      // calc pos BEFORE removal to avoid nulls
      const p = el.object3D.getWorldPosition(new THREE.Vector3());
      safeRemove(el);
      judgeHit(p);
    });

    const start = performance.now();
    const step = ()=>{
      if(!RB.running || !el.__alive) return;
      const dt = (performance.now()-start)/1000;
      const y  = yStart - dt*fallSpeed;
      el.setAttribute('position', `${x} ${y.toFixed(3)} ${z}`);

      // only miss if not handled
      if(y <= HIT_Y - HIT_WIN_GOOD*1.35){
        el.__alive = false;
        if(!el.__handled){ // prevent Miss after a valid hit
          const p = new THREE.Vector3(parseFloat(x),HIT_Y,z);
          safeRemove(el);
          onMiss(p);
        }else{
          safeRemove(el);
        }
        return;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function judgeHit(p){
    const dy = Math.abs(p.y - HIT_Y);
    let quality = 'good';
    if(dy <= HIT_WIN_PERF) quality='perfect';
    else if(dy <= HIT_WIN_GOOD) quality='good';
    else quality='miss';

    if(quality==='miss'){ onMiss(p); return; }

    hits++;
    combo++; maxCombo=Math.max(maxCombo, combo);
    score += (quality==='perfect'? 20 : 10);
    (quality==='perfect'? SFX.perfect : SFX.good).play();
    floatText(quality.toUpperCase(), quality==='perfect' ? '#00ffa3' : '#00d0ff', p);
    if(combo>0 && combo%10===0) SFX.combo.play();
    updateHUD();
  }

  function onMiss(p){
    combo=0;
    score = Math.max(0, score-3);
    SFX.miss.play();
    floatText('MISS','#ff5577', p || new THREE.Vector3(0,HIT_Y,-2.3));
    updateHUD();
  }

  // ------------ Pacing ------------
  function setBaseByPreset(){
    if(speedPreset==='beginner'){
      fallSpeed=0.55; spawnInt=1600; accelEvery=5000;
    }else if(speedPreset==='challenge'){
      fallSpeed=0.90; spawnInt=900;  accelEvery=3500;
    }else{ // standard
      fallSpeed=0.70; spawnInt=1200; accelEvery=4000;
    }
  }

  function restartSpawnLoop(){
    try{ clearInterval(spawnTimer); }catch(_){}
    spawnTimer = setInterval(spawnNote, spawnInt);
  }

  function startAccel(){
    lastAccel = performance.now();
    const tick = ()=>{
      if(!RB.running || RB.paused) return;
      const now=performance.now();
      if(now-lastAccel>=accelEvery){
        lastAccel=now;
        fallSpeed = clamp(fallSpeed + 0.06, 0.45, 2.2);
        spawnInt  = clamp(spawnInt  - 60,  420, 2400);
        restartSpawnLoop();
      }
      accelRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  // ------------ Flow ------------
  function clearNotes(){ Array.from(document.querySelectorAll('.rb-note')).forEach(n=>safeRemove(n)); }

  function start(){
    if(RB.running) return;
    RB.running=true; RB.paused=false;
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60;

    const sel=$('speedSel'); speedPreset = sel? (sel.value||'standard') : 'standard';
    setBaseByPreset(); updateHUD(); clearNotes();

    // timers
    timer = setInterval(()=>{ timeLeft--; $('hudTime')&&($('hudTime').textContent=timeLeft); if(timeLeft<=0) endGame(); },1000);
    spawnNote(); restartSpawnLoop(); startAccel();
    playSelectedSong();
  }

  function pause(){
    if(!RB.running || RB.paused) return;
    RB.paused=true;
    try{ clearInterval(timer); clearInterval(spawnTimer); }catch(_){}
    if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    try{ music.pause(); }catch(_){}
  }
  function resume(){
    if(!RB.running || !RB.paused) return;
    RB.paused=false;
    timer = setInterval(()=>{ timeLeft--; $('hudTime')&&($('hudTime').textContent=timeLeft); if(timeLeft<=0) endGame(); },1000);
    restartSpawnLoop(); startAccel();
    music.play().catch(()=>{});
  }

  function endGame(){
    if(!RB.running) return;
    RB.running=false; RB.paused=false;
    try{ clearInterval(timer); clearInterval(spawnTimer); }catch(_){}
    if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    try{ music.pause(); }catch(_){}
    clearNotes();

    const acc = spawns? Math.round((hits/spawns)*100) : 0;
    $('rSong')  && ($('rSong').textContent  = $('hudSong')?.textContent || '—');
    $('rScore') && ($('rScore').textContent = score);
    $('rMaxCombo')&&($('rMaxCombo').textContent = maxCombo);
    $('rAcc')   && ($('rAcc').textContent  = acc+'%');
    $('results')&&($('results').style.display='grid');
    SFX.ui.play();
  }

  // ------------ Music select ------------
  function playSelectedSong(){
    const opt = $('songSel')?.selectedOptions?.[0];
    const url = opt?.value;
    const title = opt?.dataset?.title || opt?.textContent || '—';
    $('hudSong') && ($('hudSong').textContent = title || '—');
    if(!url || url==='none'){ try{ music.pause(); }catch(_){ } return; }
    try{
      music.src = url;
      music.currentTime = 0;
      music.play().catch(()=>{});
    }catch(_){}
  }
  function setSpeed(v){
    speedPreset = v||'standard';
    $('hudSpeed') && ($('hudSpeed').textContent = presetName(speedPreset));
  }

  // ------------ UI wiring ------------
  function wireUI(){
    const s=$('btnStart'), p=$('btnPause'), e=$('btnEnd'),
          replay=$('replayBtn'), back=$('backBtn'),
          songSel=$('songSel'), speedSel=$('speedSel');

    s?.addEventListener('click', start);
    p?.addEventListener('click', ()=>{
      if(!RB.running) return;
      if(!RB.paused){ pause();  p.textContent='Resume'; }
      else          { resume(); p.textContent='Pause'; }
    });
    e?.addEventListener('click', endGame);
    replay?.addEventListener('click', ()=>{ $('results').style.display='none'; start(); });
    back?.addEventListener('click', ()=>{ location.href = HUB_URL; });

    songSel?.addEventListener('change', playSelectedSong);
    speedSel?.addEventListener('change', ()=> setSpeed(speedSel.value));

    // Enter VR center-bottom (if exists)
    $('enterVRBtn')?.addEventListener('click', ()=>{ try{ document.querySelector('a-scene')?.enterVR?.(); }catch(_){} });

    // shortcuts
    addEventListener('keydown', (ev)=>{
      if(ev.code==='Space'){ ev.preventDefault(); if(!RB.running) start(); else if(RB.paused) resume(); else pause(); }
      if(ev.code==='Escape'){ endGame(); }
    });
  }

  // ------------ Mouse cursor (rayOrigin: mouse) ------------
  (function ensureMouseCursor(){
    const scene=document.querySelector('a-scene');
    if(!scene) return;
    if(!document.querySelector('#mouseCursor')){
      const e=document.createElement('a-entity');
      e.id='mouseCursor';
      e.setAttribute('cursor','rayOrigin: mouse; fuse: false');
      e.setAttribute('raycaster','objects: .clickable; interval: 0');
      scene.appendChild(e);
    }
  })();

  // ------------ Hit line (visual only) ------------
  (function ensureHitLine(){
    const arena=$('arena'); if(!arena) return;
    if(!document.querySelector('#hitLine')){
      const line=document.createElement('a-entity');
      line.id='hitLine';
      line.setAttribute('geometry','primitive: box; height: 0.02; width: 3.2; depth: 0.01');
      line.setAttribute('material','color:#00ff88; opacity:0.9; emissive:#00ff88; emissiveIntensity:0.7; transparent:true');
      line.setAttribute('position',`0 ${HIT_Y} -2.3`);
      line.setAttribute('animation__pulse','property: components.material.material.emissiveIntensity; dir: alternate; from: 0.5; to: 1.1; dur: 700; loop: true; easing: easeInOutSine');
      arena.appendChild(line);
    }
  })();

  // ------------ Boot ------------
  function boot(){ wireUI(); updateHUD(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // iOS audio unlock
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext), ctx = Ctx? new Ctx():null;
    function resume(){ if(unlocked||!ctx) return; ctx.resume?.(); unlocked = (ctx.state==='running'); }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev, resume, {once:true, passive:true}));
  })();

})();
