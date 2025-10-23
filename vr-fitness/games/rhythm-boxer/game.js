/* games/rhythm-boxer/game.js
   Rhythm Boxer · Fix: Start แล้วมีโน้ตวิ่งทันที · รอ 'loaded' ก่อนเริ่มตก · เริ่มช้าแล้วค่อยเร็ว
   UI คลิกได้, Hitline/Good/Perfect/Miss/SFX, Back-to-Hub ถูกต้อง
*/
(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');

  // -------- State --------
  const RB = window.RB = { running:false, paused:false };
  let score=0, combo=0, maxCombo=0, hits=0, notes=0, timeLeft=60;
  let spawnTimer=null, timeTimer=null, speedPreset='standard';
  let spawnInterval=1600;          // เริ่มช้ามาก
  const minIntervalByPreset   = { beginner:900,  standard:650,  challenge:520  };
  const startIntervalByPreset = { beginner:1800, standard:1600, challenge:1300 };
  const accelEveryN = 6;           // ทุก 6 ตัว ลด interval ที
  const accelStep   = 70;          // ลดทีละ 70ms
  let sinceAccel = 0;

  // พิกัด/รูปร่างโน้ต
  const ySpawn  = 2.6;
  const yTarget = 1.0;
  const zLane   = -3.0;
  const noteColors = ['#2cd1ff','#ff7a7a','#ffd166','#00ffa3','#a899ff'];
  const noteShapes = ['a-sphere','a-box','a-icosahedron','a-dodecahedron'];

  // -------- SFX --------
  const SFX = {
    good:    new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:    new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`)
  };
  Object.values(SFX).forEach(a=>{ a.preload='auto'; a.volume=0.95; });

  // -------- HUD --------
  const cap = s => (s?.charAt(0).toUpperCase()+s.slice(1));
  function updHUD(){
    $('hudScore').textContent = score;
    $('hudCombo').textContent = combo;
    $('hudTime').textContent  = timeLeft;
    $('hudSpeed').textContent = cap(speedPreset);
  }
  function floatWord(text, color){
    const el = document.createElement('div');
    el.className='float';
    el.style.color=color || '#2cff88';
    el.textContent=text;
    document.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_e){} }, 900);
  }

  // -------- Notes --------
  function spawnNote(){
    if (!RB.running || RB.paused) return;
    notes++;
    sinceAccel++;

    const x = (Math.random()*3.0 - 1.5).toFixed(2);
    const color = noteColors[(notes)%noteColors.length];
    const shape = noteShapes[(Math.random()*noteShapes.length)|0];

    const el = document.createElement(shape);
    el.classList.add('note','clickable');
    // ขนาดใหญ่ขึ้น มองง่าย
    el.setAttribute('color', color);
    el.setAttribute('radius', '0.17');
    el.setAttribute('depth',  '0.34');
    el.setAttribute('width',  '0.34');
    el.setAttribute('height', '0.34');
    el.setAttribute('position', `${x} ${ySpawn} ${zLane}`);
    el.dataset.spawn = performance.now();
    el.dataset.hit = '0';
    $('arena').appendChild(el);

    // คลิกเมาส์/ทัช: ตรวจ timing window (กว้างขึ้น)
    el.addEventListener('click', ()=>{ tryHit(el); });

    // เริ่ม "ตก" หลัง A-Frame โหลด entity แล้ว (กัน object3D ยังไม่พร้อม)
    const startFall = ()=>fallLoop(el);
    if (el.hasLoaded) startFall();
    else el.addEventListener('loaded', startFall, {once:true});

    // ค่อยๆ ถี่ขึ้น
    if (sinceAccel >= accelEveryN){
      sinceAccel = 0;
      spawnInterval = Math.max(minIntervalByPreset[speedPreset], spawnInterval - accelStep);
      restartSpawner(); // ใช้ค่าใหม่ทันที
    }
  }

  // ตกด้วย rAF (คำนวณ dt จริง)
  function fallLoop(el){
    let lastT = performance.now();
    const speed = 0.65; // m/s ช้าก่อน แล้วเพิ่มความถี่ spawn เอา

    function step(now){
      if (!el.parentNode) return;
      if (!RB.running) { safeRemove(el); return; }
      if (RB.paused) { requestAnimationFrame(step); return; }

      const dt = Math.min(80, now - lastT) / 1000; // cap 80ms กันกระตุก
      lastT = now;

      const p = el.object3D.position;
      p.y -= speed * dt;
      el.setAttribute('position', `${p.x.toFixed(3)} ${p.y.toFixed(3)} ${zLane}`);

      if (p.y <= yTarget){
        if (el.dataset.hit !== '1'){ doMiss(); }
        safeRemove(el);
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // timing window (ms) กว้างขึ้น: perfect ±130, good ±240 (+assists ตามระยะ)
  function tryHit(el){
    if (!el || el.dataset.hit === '1') return;
    const t = performance.now() - (+el.dataset.spawn);
    // เวลาถึงเป้าโดยประมาณ ~3800ms หลัง spawn (คำนวณจาก y ระยะ/ความเร็ว)
    const ideal = 3800;
    const diff = Math.abs(t - ideal);

    if (diff <= 130){
      el.dataset.hit='1'; doPerfect(); safeRemove(el);
    } else if (diff <= 240){
      el.dataset.hit='1'; doGood();    safeRemove(el);
    } else {
      // Hit Assist: ถ้าโน้ตอยู่ใกล้ yTarget มากๆ ขณะคลิก ให้ GOOD
      const py = el.object3D?.position?.y ?? 9;
      if (Math.abs(py - yTarget) <= 0.10){
        el.dataset.hit='1'; doGood(); safeRemove(el);
      }
    }
  }

  function doGood(){
    combo++; hits++; score+=10; if (combo>maxCombo) maxCombo=combo;
    SFX.good.currentTime=0; SFX.good.play().catch(()=>{});
    updHUD(); floatWord('GOOD', '#2cd1ff');
  }
  function doPerfect(){
    combo++; hits++; score+=22; if (combo>maxCombo) maxCombo=combo;
    SFX.perfect.currentTime=0; SFX.perfect.play().catch(()=>{});
    updHUD(); floatWord('PERFECT', '#00ffa3');
  }
  function doMiss(){
    combo=0; SFX.miss.currentTime=0; SFX.miss.play().catch(()=>{});
    updHUD(); floatWord('MISS', '#ff6b6b');
  }

  function safeRemove(el){
    try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_e){}
  }

  // -------- Game Flow --------
  function start(){
    if (RB.running) return;
    RB.running = true; RB.paused=false;
    score=0; combo=0; maxCombo=0; hits=0; notes=0; timeLeft=60; sinceAccel=0;

    // ตั้งค่า interval ตามพรีเซ็ต
    spawnInterval = startIntervalByPreset[speedPreset];

    updHUD();
    // สร้างโน้ตทันที 2 ตัวแรก เพื่อให้เห็นว่าเกมเริ่มแล้ว (ไม่ต้องรอรอบ setInterval)
    spawnNote();
    setTimeout(spawnNote, Math.min(500, spawnInterval/2));

    restartSpawner();

    timeTimer = setInterval(()=>{
      if (!RB.running || RB.paused) return;
      timeLeft--; $('hudTime').textContent=timeLeft;
      if (timeLeft<=0) endGame();
    }, 1000);

    playSelectedSong();
  }

  function restartSpawner(){
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(()=>{ if(RB.running && !RB.paused) spawnNote(); }, spawnInterval);
  }

  function pause(){ if (!RB.running || RB.paused) return; RB.paused = true; }
  function resume(){ if (!RB.running || !RB.paused) return; RB.paused = false; }
  function endGame(){
    RB.running=false; RB.paused=false;
    if (spawnTimer) clearInterval(spawnTimer);
    if (timeTimer)  clearInterval(timeTimer);
    $('rScore').textContent = score;
    $('rMaxCombo').textContent = maxCombo;
    const acc = notes ? Math.round((hits/notes)*100) : 0;
    $('rAcc').textContent = acc+'%';
    $('results').style.display='flex';
    stopSong();
  }
  RB.start=start; RB.pause=pause; RB.resume=resume;

  // -------- Music --------
  let currentAudio = null;
  function playSelectedSong(){
    const sel = $('songSel');
    const v = sel?.value || 'none';
    const title = sel?.selectedOptions?.[0]?.dataset?.title || '—';
    $('hudSong').textContent = title;
    $('rSong').textContent = title;

    stopSong();
    if (v && v!=='none'){
      currentAudio = new Audio(v);
      currentAudio.volume = 0.9;
      currentAudio.play().catch(()=>{});
    }
  }
  function stopSong(){ try{ if(currentAudio){ currentAudio.pause(); currentAudio.currentTime=0; currentAudio=null; } }catch(_e){} }

  // -------- Buttons & UI (กันคลิกทะลุฉาก) --------
  function blockBubble(el){
    if(!el) return;
    ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup','click'].forEach(ev=>{
      el.addEventListener(ev, e=>{
        e.stopPropagation();
        e.stopImmediatePropagation && e.stopImmediatePropagation();
      }, {capture:true});
    });
  }
  function initUI(){
    const dock  = $('uiDock');
    const startBtn=$('btnStart'), pauseBtn=$('btnPause'), endBtn=$('btnEnd');
    const songSel = $('songSel'); const speedSel = $('speedSel');

    [dock,startBtn,pauseBtn,endBtn,songSel,speedSel].forEach(blockBubble);

    startBtn?.addEventListener('click', ()=>{ start(); pauseBtn.textContent='Pause'; });
    pauseBtn?.addEventListener('click', ()=>{
      if (!RB.running) return;
      if (!RB.paused){ pause();  pauseBtn.textContent='Resume'; }
      else           { resume(); pauseBtn.textContent='Pause'; }
    });
    endBtn?.addEventListener('click', ()=> endGame());

    songSel?.addEventListener('change', ()=>{
      if (RB.running){ playSelectedSong(); }
      else{
        const title = songSel?.selectedOptions?.[0]?.dataset?.title || '—';
        $('hudSong').textContent = title; $('rSong').textContent = title;
      }
    });

    speedSel?.addEventListener('change', ()=>{
      speedPreset = speedSel.value || 'standard';
      $('hudSpeed').textContent = cap(speedPreset);
      if (RB.running){
        spawnInterval = Math.max(minIntervalByPreset[speedPreset], spawnInterval);
        restartSpawner();
      }
    });

    $('replayBtn')?.addEventListener('click', ()=>{
      $('results').style.display='none';
      start();
    });
    $('backBtn')?.addEventListener('click', ()=>{
      window.location.href = 'https://supparang.github.io/webxr-health-mobile/vr-fitness/';
    });

    $('enterVRBtn')?.addEventListener('click', ()=>{
      try{ document.querySelector('a-scene')?.enterVR?.(); }catch(_e){}
    });
  }

  // -------- Mouse/Touch Raycast (ข้าม UI เสมอ) --------
  ;(function installPointerRaycast(){
    function overUIDockAt(x,y){
      const el = document.elementFromPoint(x,y);
      return !!(el && el.closest && el.closest('#uiDock'));
    }
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl || !window.THREE) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function pick(clientX, clientY){
      if (overUIDockAt(clientX, clientY)) return;
      const cam = sceneEl.camera; if (!cam) return;
      mouse.x =  (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, cam);
      const clickable = Array.from(document.querySelectorAll('.clickable'))
        .map(el => el.object3D).filter(Boolean);
      const objects = [];
      clickable.forEach(o => o.traverse(child => objects.push(child)));
      const hits = raycaster.intersectObjects(objects, true);
      if (hits && hits.length){
        let obj = hits[0].object;
        while (obj && !obj.el) obj = obj.parent;
        if (obj && obj.el){ obj.el.emit('click'); }
      }
    }
    window.addEventListener('mousedown', e=>pick(e.clientX, e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{
      const t = e.touches && e.touches[0]; if (!t) return;
      pick(t.clientX, t.clientY);
    }, {passive:true});
  })();

  // -------- Boot --------
  function boot(){
    speedPreset = ($('speedSel')?.value)||'standard';
    $('hudSpeed').textContent = cap(speedPreset);
    updHUD();
    initUI();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else boot();

})();
