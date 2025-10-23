/* games/rhythm-boxer/game.js
   Rhythm Boxer · UI Always Clickable (force-top CSS + capture handlers + canvas shield) + steady spawns
*/
(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";

  // Inject hard CSS to ensure UI clicks win over A-Frame canvas
  (function injectCSS(){
    const css = `
      #uiDock, #uiDock * { pointer-events:auto !important; z-index:2147483647 !important; }
      #results, #results * { pointer-events:auto !important; z-index:2147483647 !important; }
      /* put UI on top visually too */
      #uiDock, #results { position:fixed !important; }
      /* stop canvas from eating pointer events on desktop & mobile */
      canvas.a-canvas { pointer-events:none !important; }
    `;
    const tag=document.createElement('style'); tag.id='rbForceUIClicks'; tag.textContent=css;
    document.head.appendChild(tag);
  })();

  function toast(msg, color='#ffd166'){
    let el = $('rbToast');
    if(!el){
      el = document.createElement('div'); el.id='rbToast';
      Object.assign(el.style,{
        position:'fixed', left:'50%', top:'10px', transform:'translateX(-50%)',
        background:'rgba(10,16,24,.88)', color:'#e6f7ff', border:'1px solid rgba(255,255,255,.1)',
        padding:'8px 12px', borderRadius:'10px', font:'600 13px system-ui', zIndex:2147483647,
        transition:'opacity .2s, transform .2s', opacity:'0', pointerEvents:'none'
      });
      document.body.appendChild(el);
    }
    el.style.color=color; el.textContent = String(msg);
    el.style.opacity='1'; el.style.transform='translateX(-50%) scale(1.02)';
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(-50%)'; }, 1200);
  }

  const RB = window.RB = { running:false, paused:false, sceneReady:false };
  let score=0, combo=0, maxCombo=0, hits=0, notes=0, timeLeft=60;

  // pacing
  let spawnTimer=null, timeTimer=null, speedPreset='standard';
  let spawnInterval=1600;
  const minIntervalByPreset   = { beginner:900,  standard:650,  challenge:520  };
  const startIntervalByPreset = { beginner:1800, standard:1600, challenge:1300 };
  const accelEveryN = 6;
  const accelStep   = 70;
  let sinceAccel = 0;

  // lane / notes
  const ySpawn  = 2.6;
  const yTarget = 1.0;
  const zLane   = -3.0;
  const noteColors = ['#2cd1ff','#ff7a7a','#ffd166','#00ffa3','#a899ff'];
  const noteShapes = ['a-sphere','a-box','a-icosahedron','a-dodecahedron'];

  // SFX
  const SFX = {
    good:    new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:    new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`)
  };
  Object.values(SFX).forEach(a=>{ a.preload='auto'; a.volume=0.95; });

  function cap(s){ return s? s.charAt(0).toUpperCase()+s.slice(1) : s; }
  function updHUD(){
    $('hudScore') && ($('hudScore').textContent = score);
    $('hudCombo') && ($('hudCombo').textContent = combo);
    $('hudTime')  && ($('hudTime').textContent  = timeLeft);
    $('hudSpeed') && ($('hudSpeed').textContent = cap(speedPreset));
  }
  function floatWord(text, color){
    const el = document.createElement('div');
    Object.assign(el.style,{
      position:'fixed', left:'50%', bottom:'28%', transform:'translateX(-50%)',
      font:'700 22px system-ui', color:color||'#2cff88', textShadow:'0 2px 8px rgba(0,0,0,.5)',
      zIndex:2147483646, pointerEvents:'none'
    });
    el.textContent=text; document.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_e){} }, 900);
  }

  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_e){} }

  async function ensureSceneAndArena(){
    const maxWait = 4000, t0 = performance.now();
    while (!(window.AFRAME && document.querySelector('a-scene'))){
      if (performance.now()-t0 > maxWait){ break; }
      await new Promise(r=>requestAnimationFrame(r));
    }
    if (!document.querySelector('a-scene')){
      const sc = document.createElement('a-scene'); document.body.prepend(sc);
    }
    const scn = document.querySelector('a-scene');
    await new Promise(res=>{
      if (scn && scn.hasLoaded) return res();
      scn?.addEventListener('loaded', res, {once:true});
      setTimeout(res, 1200);
    });
    if (!$('arena')){
      const e = document.createElement('a-entity');
      e.setAttribute('id','arena');
      e.setAttribute('position','0 0 0');
      document.querySelector('a-scene').appendChild(e);
    }
    RB.sceneReady = true;
  }

  // ---------- Notes ----------
  function spawnNote(){
    if (!RB.running || RB.paused) return;
    if (!$('arena')) return;
    notes++; sinceAccel++;

    const x = (Math.random()*3.0 - 1.5).toFixed(2);
    const color = noteColors[(notes)%noteColors.length];
    const shape = noteShapes[(Math.random()*noteShapes.length)|0];

    const el = document.createElement(shape);
    el.classList.add('note','clickable');
    el.setAttribute('color', color);
    el.setAttribute('radius', '0.24');
    el.setAttribute('depth',  '0.5');
    el.setAttribute('width',  '0.5');
    el.setAttribute('height', '0.5');
    el.setAttribute('position', `${x} ${ySpawn} ${zLane}`);
    el.dataset.spawn = performance.now();
    el.dataset.hit = '0';
    $('arena').appendChild(el);

    el.addEventListener('click', ()=>{ tryHit(el); });

    const startFall = ()=>fallLoop(el);
    if (el.hasLoaded) startFall();
    else el.addEventListener('loaded', startFall, {once:true});

    if (sinceAccel >= accelEveryN){
      sinceAccel = 0;
      spawnInterval = Math.max(minIntervalByPreset[speedPreset], spawnInterval - accelStep);
      restartSpawner();
    }
  }

  function fallLoop(el){
    let lastT = performance.now();
    const speed = 0.60; // เริ่มช้า

    function step(now){
      if (!el.parentNode) return;
      if (!RB.running){ safeRemove(el); return; }
      if (RB.paused){ requestAnimationFrame(step); return; }

      const dt = Math.min(80, now - lastT) / 1000;
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

  // timing window — wide + hit assist
  function tryHit(el){
    if (!el || el.dataset.hit === '1') return;
    const t = performance.now() - (+el.dataset.spawn);
    const travelMs = ((ySpawn - yTarget) / 0.60) * 1000; // ต้องตรงกับ speed
    const diff = Math.abs(t - travelMs);

    if (diff <= 150){
      el.dataset.hit='1'; doPerfect(); safeRemove(el);
    } else if (diff <= 320){
      el.dataset.hit='1'; doGood();    safeRemove(el);
    } else {
      const py = el.object3D?.position?.y ?? 9;
      if (Math.abs(py - yTarget) <= 0.18){
        el.dataset.hit='1'; doGood(); safeRemove(el);
      }
    }
  }

  function doGood(){ combo++; hits++; score+=10; if (combo>maxCombo) maxCombo=combo; SFX.good.currentTime=0; SFX.good.play().catch(()=>{}); updHUD(); floatWord('GOOD', '#2cd1ff'); }
  function doPerfect(){ combo++; hits++; score+=22; if (combo>maxCombo) maxCombo=combo; SFX.perfect.currentTime=0; SFX.perfect.play().catch(()=>{}); updHUD(); floatWord('PERFECT', '#00ffa3'); }
  function doMiss(){ combo=0; SFX.miss.currentTime=0; SFX.miss.play().catch(()=>{}); updHUD(); floatWord('MISS', '#ff6b6b'); }

  // ---------- Music ----------
  let currentAudio = null;
  function playSelectedSong(){
    const sel = $('songSel');
    const v = sel?.value || 'none';
    const title = sel?.selectedOptions?.[0]?.dataset?.title || '—';
    $('hudSong') && ($('hudSong').textContent = title);
    $('rSong')   && ($('rSong').textContent   = title);

    stopSong();
    if (v && v!=='none'){
      currentAudio = new Audio(v);
      currentAudio.crossOrigin = "anonymous";
      currentAudio.volume = 0.9;
      currentAudio.play().catch(()=>{ toast('Autoplay blocked — แตะ Start อีกครั้ง', '#ff7a7a'); });
    }
  }
  function stopSong(){ try{ if(currentAudio){ currentAudio.pause(); currentAudio.currentTime=0; currentAudio=null; } }catch(_e){} }

  // ---------- Game Flow ----------
  async function start(){
    if (RB.running) return;
    if (!RB.sceneReady){ await ensureSceneAndArena(); }
    RB.running = true; RB.paused=false;

    $('results') && ( $('results').style.display='none' );

    score=0; combo=0; maxCombo=0; hits=0; notes=0; timeLeft=60; sinceAccel=0;
    spawnInterval = startIntervalByPreset[speedPreset] || 1600;

    updHUD();

    spawnNote();
    setTimeout(spawnNote, Math.min(500, spawnInterval/2));

    restartSpawner();

    timeTimer = setInterval(()=>{
      if (!RB.running || RB.paused) return;
      timeLeft--; $('hudTime') && ($('hudTime').textContent=timeLeft);
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
    $('rScore')    && ($('rScore').textContent = score);
    $('rMaxCombo') && ($('rMaxCombo').textContent = maxCombo);
    const acc = notes ? Math.round((hits/notes)*100) : 0;
    $('rAcc')      && ($('rAcc').textContent = acc+'%');
    $('results')   && ( $('results').style.display='flex' );
    stopSong();
  }
  RB.start=start; RB.pause=pause; RB.resume=resume;

  // ---------- Strong UI click shield ----------
  let overUI = false;
  function markOver(el){
    if(!el) return;
    const on = ()=>{ overUI = true; };
    const off= ()=>{ overUI = false; };
    ['pointerenter','mouseenter','touchstart'].forEach(ev=> el.addEventListener(ev, on));
    ['pointerleave','mouseleave','touchend','touchcancel'].forEach(ev=> el.addEventListener(ev, off));
  }
  function blockBubble(el){
    if(!el) return;
    el.style.pointerEvents = 'auto';
    ['pointerdown','mousedown','touchstart','click','pointerup','mouseup','touchend'].forEach(ev=>{
      el.addEventListener(ev, (e)=>{
        e.stopPropagation();
        e.stopImmediatePropagation?.();
      }, {capture:true});
    });
    markOver(el);
  }
  // Global capture guard — if event begins on UI, stop it before A-Frame sees it
  ['pointerdown','mousedown','touchstart','click'].forEach(ev=>{
    document.addEventListener(ev, (e)=>{
      const t = e.target;
      if (t && (t.closest?.('#uiDock') || t.closest?.('#results'))){
        e.stopPropagation();
        e.stopImmediatePropagation?.();
      }
    }, {capture:true});
  });

  function attachButtons(){
    const startBtn=$('btnStart'), pauseBtn=$('btnPause'), endBtn=$('btnEnd');
    const songSel = $('songSel'); const speedSel = $('speedSel');
    [startBtn,pauseBtn,endBtn,songSel,speedSel,$('uiDock'),$('results')].forEach(blockBubble);

    startBtn && startBtn.addEventListener('click', ()=>{ start(); if(pauseBtn) pauseBtn.textContent='Pause'; });
    pauseBtn && pauseBtn.addEventListener('click', ()=>{
      if (!RB.running) return;
      if (!RB.paused){ pause();  pauseBtn.textContent='Resume'; }
      else           { resume(); pauseBtn.textContent='Pause'; }
    });
    endBtn && endBtn.addEventListener('click', ()=> endGame());

    songSel && songSel.addEventListener('change', ()=>{
      if (RB.running){ playSelectedSong(); }
      else{
        const title = songSel?.selectedOptions?.[0]?.dataset?.title || '—';
        $('hudSong') && ($('hudSong').textContent = title);
        $('rSong')   && ($('rSong').textContent   = title);
      }
    });

    speedSel && speedSel.addEventListener('change', ()=>{
      speedPreset = speedSel.value || 'standard';
      $('hudSpeed') && ($('hudSpeed').textContent = cap(speedPreset));
      if (RB.running){
        spawnInterval = Math.max(minIntervalByPreset[speedPreset], spawnInterval);
        restartSpawner();
      }
    });

    $('replayBtn') && $('replayBtn').addEventListener('click', ()=>{
      $('results') && ( $('results').style.display='none' );
      start();
    });
    $('backBtn') && $('backBtn').addEventListener('click', ()=>{
      window.location.href = HUB_URL;
    });
  }

  // Self-heal: move UI containers to the end of <body> so they are above canvas in DOM
  function elevateUI(){
    ['uiDock','results'].forEach(id=>{
      const el=$(id);
      if (el && el.parentNode !== document.body){
        document.body.appendChild(el);
      }
      if (el){
        el.style.position='fixed';
        el.style.zIndex='2147483647';
        el.style.pointerEvents='auto';
      }
    });
  }

  // Pointer Raycast (skip when over UI)
  ;(function installPointerRaycast(){
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl){ return; }
    const ready = ()=>{
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      function pick(clientX, clientY){
        if (overUI) return;
        const topEl = document.elementFromPoint(clientX, clientY);
        if (topEl && (topEl.closest('#uiDock') || topEl.closest('#results'))) return;

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
    };
    if (sceneEl.hasLoaded) ready();
    else sceneEl.addEventListener('loaded', ready, {once:true});
  })();

  function boot(){
    elevateUI();
    attachButtons();
    ensureSceneAndArena();

    speedPreset = ($('speedSel')?.value)||'standard';
    $('hudSpeed') && ($('hudSpeed').textContent = cap(speedPreset));
    updHUD();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else boot();

})();
