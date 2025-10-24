/* games/rhythm-boxer/game.js
   Rhythm Boxer · game.js (Click-safe notes, wide hit window, gradual pacing, working buttons, back-to-hub fixed)
*/
(function(){
  "use strict";

  // ----------------- Helpers -----------------
  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

  // Null-safe remover
  function safeRemove(el){
    try{
      if(!el) return;
      if(!el.isConnected && !el.parentNode) return;
      if(el.parentNode) el.parentNode.removeChild(el);
      else el.remove?.();
    }catch(_){}
  }

  // Float text (A-Frame)
  function floatText(text, color, pos){
    try{
      const e=document.createElement('a-entity'), p=pos.clone(); p.y += 0.18;
      e.setAttribute('text',{value:text,color,align:'center',width:2.6});
      e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
      e.setAttribute('scale','0.001 0.001 0.001');
      e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
      e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.5} ${p.z}`,dur:520,easing:'easeOutQuad'});
      e.setAttribute('animation__fade',{property:'opacity',to:0,dur:420,delay:120,easing:'linear'});
      $('arena').appendChild(e);
      setTimeout(()=>safeRemove(e), 760);
    }catch(_){}
  }

  // ----------------- SFX -----------------
  const mk = (p)=>{ const a=new Audio(p); a.preload='auto'; a.onerror=()=>console.warn('SFX not found',p); return a; };
  const SFX = {
    good:    mk(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect: mk(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:    mk(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo:   mk(`${ASSET_BASE}/assets/sfx/combo.wav`)
  };

  // ----------------- Visual consts -----------------
  const COLORS = ['#00d0ff','#ff6b6b','#ffd166','#00ffa3','#a899ff','#8cf5ff'];
  const NOTE_SIZE = 0.12;

  // Hit line position / window
  const HIT_Y = 1.10;
  const HIT_WIN_GOOD   = 0.26;  // กว้างขึ้นช่วยเมาส์
  const HIT_WIN_PERF   = 0.14;

  // ----------------- Game State -----------------
  const RB = {
    running:false,
    paused:false,
    score:0,
    combo:0,
    maxCombo:0,
    hits:0,
    spawns:0,
    timeLeft:60,
    spawnTimer:null,
    secTimer:null,
    fallSpeed:0.55,     // เริ่มช้า
    spawnGap:1100,      // เริ่มห่าง
    difficulty:'standard'
  };

  // HUD
  function updateHUD(){
    $('score') && ($('score').textContent = RB.score);
    $('combo') && ($('combo').textContent = RB.combo);
    $('time')  && ($('time').textContent  = RB.timeLeft);
  }

  // ----------------- Spawner pacing -----------------
  function pacingInit(){
    // เริ่มช้า → ค่อยๆ เร็วขึ้นทีละนิด
    RB.fallSpeed = 0.55;
    RB.spawnGap  = 1100;

    // ความเร็วตามโหมด
    if(RB.difficulty==='beginner'){ RB.fallSpeed = 0.48; RB.spawnGap = 1250; }
    else if(RB.difficulty==='challenge'){ RB.fallSpeed = 0.72; RB.spawnGap = 900; }
  }

  function pacingTick(){
    // ทุก 4 วิ เพิ่มความท้าทายเล็กน้อย
    RB.fallSpeed = clamp(RB.fallSpeed + 0.03, 0.48, 1.35);
    RB.spawnGap  = clamp(RB.spawnGap  - 30,  520, 1250);
    // รีสตาร์ทตัว spawn ให้ใช้ gap ใหม่
    restartSpawnLoop();
  }

  // ----------------- Notes (Click-safe) -----------------
  function spawnNote(){
    RB.spawns++;
    const x = (Math.random()*2.4 - 1.2).toFixed(2);
    const z = -2.3;
    const yStart = 2.7;

    const shape = (Math.random()<0.5 ? 'a-sphere' : 'a-box');
    const color = COLORS[Math|Math.random()*COLORS.length];
    const el = document.createElement(shape);
    el.classList.add('clickable','rb-note');
    el.__alive   = true;    // ยังอยู่ในฉาก
    el.__handled = false;   // ป้องกันยิงซ้ำ

    if(shape==='a-sphere'){
      el.setAttribute('radius', NOTE_SIZE*1.1);
    }else{
      el.setAttribute('width', NOTE_SIZE*2.0);
      el.setAttribute('height', NOTE_SIZE*2.0);
      el.setAttribute('depth', NOTE_SIZE*2.0);
    }
    el.setAttribute('material', `color:${color}; opacity:0.98; transparent:true; metalness:0.1; roughness:0.35`);
    el.setAttribute('position', `${x} ${yStart} ${z}`);
    $('arena').appendChild(el);

    // ใช้ "click" เหตุการณ์เดียว (จาก cursor: mouse) ป้องกันซ้อนกับ mousedown/touch
    const onHitHandler = ()=>{
      if(!el.__alive || el.__handled) return;  // กันคลิกซ้ำ/bubbling
      el.__handled = true;
      onHit(el);
    };
    el.addEventListener('click', onHitHandler);

    const start = performance.now();
    let rafId = 0;

    function step(){
      if(!RB.running || !el.__alive) return;
      if(el.__handled || !el.isConnected){ el.__alive=false; return; }

      const dt = (performance.now()-start)/1000;
      const y = yStart - dt*RB.fallSpeed;
      el.setAttribute('position', `${x} ${y.toFixed(3)} ${z}`);

      // หลุดหน้าต่าง miss
      if(y <= HIT_Y - HIT_WIN_GOOD*1.5){
        el.__alive=false;
        safeRemove(el);
        onMiss(new THREE.Vector3(parseFloat(x),HIT_Y,z));
        return;
      }
      rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);

    // ฟังก์ชันหยุด loop และลบ
    el.__kill = ()=>{
      if(!el.__alive) return;
      el.__alive=false;
      try{ cancelAnimationFrame(rafId); }catch(_){}
      safeRemove(el);
    };
  }

  function onHit(el){
    if(!RB.running || !el) return;

    // ตำแหน่งใช้วัดคุณภาพ
    const p = el.object3D.getWorldPosition(new THREE.Vector3());
    const dy = Math.abs(p.y - HIT_Y);

    // หยุด loop + ลบออก
    el.__kill?.();

    // วินโดว์ช่วยเล็ง: กว้างขึ้น → นับให้เป็นอย่างน้อย Good
    let quality = 'good';
    if(dy <= HIT_WIN_PERF) quality='perfect';
    else if(dy <= HIT_WIN_GOOD) quality='good';
    else quality='miss';

    if(quality==='miss'){ onMiss(p); return; }

    RB.hits++;
    RB.combo++; RB.maxCombo=Math.max(RB.maxCombo, RB.combo);
    RB.score += (quality==='perfect'? 24 : 12);
    (quality==='perfect'? SFX.perfect : SFX.good).play();
    floatText(quality.toUpperCase(), quality==='perfect' ? '#00ffa3' : '#00d0ff', p);
    if(RB.combo>0 && RB.combo%10===0) SFX.combo.play();
    updateHUD();
  }

  function onMiss(p){
    RB.combo=0;
    RB.score = Math.max(0, RB.score-4);
    SFX.miss.play();
    floatText('MISS','#ff5577', p || new THREE.Vector3(0, HIT_Y, -2.3));
    updateHUD();
  }

  // ----------------- Loops -----------------
  function restartSpawnLoop(){
    try{ clearInterval(RB.spawnTimer); }catch(_){}
    RB.spawnTimer = setInterval(spawnNote, RB.spawnGap);
  }

  function startTimers(){
    try{ clearInterval(RB.secTimer); }catch(_){}
    RB.secTimer = setInterval(()=>{
      if(!RB.running) return;
      RB.timeLeft--;
      if(RB.timeLeft<=0){ endGame(); return; }
      if(RB.timeLeft%4===0) pacingTick();
      updateHUD();
    }, 1000);
    restartSpawnLoop();
  }

  // ----------------- Game flow -----------------
  function reset(){
    RB.score=0; RB.combo=0; RB.maxCombo=0; RB.hits=0; RB.spawns=0;
    RB.timeLeft=60;
    // ล้างโน้ตในฉาก
    const arena=$('arena'); if(arena){
      Array.from(arena.querySelectorAll('.rb-note')).forEach(n=>safeRemove(n));
    }
    updateHUD();
  }

  function startGame(){
    if(RB.running) return;
    // ยึดค่า difficulty จาก <select id="speedSel"> ถ้ามี
    const sel = $('speedSel'); 
    RB.difficulty = sel ? (sel.value || 'standard') : 'standard';

    reset();
    pacingInit();
    RB.running = true; RB.paused=false;
    startTimers();
  }

  function pauseGame(){
    if(!RB.running) return;
    RB.paused = !RB.paused;
    if(RB.paused){
      try{ clearInterval(RB.spawnTimer); }catch(_){}
      try{ clearInterval(RB.secTimer); }catch(_){}
    }else{
      startTimers();
    }
  }

  function endGame(){
    RB.running=false; RB.paused=false;
    try{ clearInterval(RB.spawnTimer); }catch(_){}
    try{ clearInterval(RB.secTimer); }catch(_){}
    // แสดงผลลัพธ์ (ถ้ามีหน้าต่าง)
    const res = $('results');
    if(res){
      $('rScore') && ( $('rScore').textContent = RB.score );
      $('rMaxCombo') && ( $('rMaxCombo').textContent = RB.maxCombo );
      $('rAcc') && ( $('rAcc').textContent = RB.spawns? Math.round((RB.hits/RB.spawns)*100)+'%' : '0%' );
      res.style.display='flex';
    }
  }

  // ----------------- Buttons / UI -----------------
  document.addEventListener('DOMContentLoaded', ()=>{
    $('startBtn') && $('startBtn').addEventListener('click', startGame);
    $('pauseBtn') && $('pauseBtn').addEventListener('click', pauseGame);
    $('endBtn')   && $('endBtn').addEventListener('click', endGame);
    $('replayBtn')&& $('replayBtn').addEventListener('click', startGame);
    $('backBtn')  && $('backBtn').addEventListener('click', ()=>{
      // กลับไป hub ที่ถูกต้อง
      window.location.href = `${ASSET_BASE}/vr-fitness/`;
    });
  });

  // ----------------- Mouse cursor fallback (ถ้าไม่มี cursor:mouse) -----------------
  (function ensureMouseCursor(){
    const scene = document.querySelector('a-scene');
    if(!scene) return;
    // ถ้ายังไม่มี entity สำหรับ cursor mouse ให้เติม
    if(!document.querySelector('#mouseCursor')){
      const e=document.createElement('a-entity');
      e.setAttribute('id','mouseCursor');
      e.setAttribute('cursor','rayOrigin: mouse; fuse: false');
      e.setAttribute('raycaster','objects: .clickable; interval: 0');
      scene.appendChild(e);
    }
  })();

  // ----------------- Hit line (แค่ช่วยเล็ง ไม่ clickable) -----------------
  (function ensureHitLine(){
    const arena = $('arena');
    if(!arena) return;
    if(!document.querySelector('#hitLine')){
      const line=document.createElement('a-entity');
      line.id='hitLine';
      line.setAttribute('geometry','primitive: box; height: 0.02; width: 3.2; depth: 0.01');
      line.setAttribute('material','color:#00ff88; opacity:0.85; emissive:#00ff88; emissiveIntensity:0.6; transparent:true');
      line.setAttribute('position',`0 ${HIT_Y} -2.3`);
      // glow pulse
      line.setAttribute('animation__pulse','property: components.material.material.emissiveIntensity; dir: alternate; from: 0.4; to: 1.0; dur: 700; loop: true; easing: easeInOutSine');
      arena.appendChild(line);
    }
  })();

  // Export for debugging (optional)
  window.__RB = RB;

})();
