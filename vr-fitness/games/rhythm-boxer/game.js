/* games/rhythm-boxer/game.js
   Rhythm Boxer · game.js (Lane Lines + Hit Line Glow + Raycast Click/Touch + Hit-Assist + 3 Speeds + Stable Buttons)
*/
(function(){
  "use strict";

  // ===== Helpers ============================================================
  const $ = (id)=>document.getElementById(id);
  const q = (sel)=>document.querySelector(sel);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  function safeRemove(el){
    try{
      if(!el) return;
      if(!el.isConnected && !el.parentNode) return;
      if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.();
    }catch(_){}
  }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function rng(){ return Math.random(); }
  function pick(arr){ return arr[Math.floor(rng()*arr.length)]; }
  const getQ=(k)=>new URLSearchParams(location.search).get(k);

  // ===== Scene / Layout =====================================================
  const ARENA_ID = 'rbArena';
  const Z_POS   = -3.0;                 // z ที่เลน/โน้ต/ฮิตไลน์อยู่
  const LANES   = [-0.9, 0, 0.9];       // x ของเลน 0..2
  const HIT_Y   = 1.00;                 // y ตำแหน่งฮิต
  const TOP_Y   = 2.3;                  // y spawn โน้ต
  const NOTE_Z  = Z_POS;

  // ===== Speed Profiles =====================================================
  const SPEEDS = {
    beginner: { baseSpeed: 0.42, accel: 0.00012, window: 0.30, perfect: 0.14, assistLaneTol: 1.00, assistWindow: 0.36 },
    standard: { baseSpeed: 0.56, accel: 0.00018, window: 0.26, perfect: 0.12, assistLaneTol: 0.95, assistWindow: 0.32 },
    challenge:{ baseSpeed: 0.72, accel: 0.00024, window: 0.22, perfect: 0.10, assistLaneTol: 0.90, assistWindow: 0.28 }
  };
  function getSpeedKey(){
    const q = getQ('speed') || localStorage.getItem('rb_speed');
    return (q && SPEEDS[q]) ? q : 'standard';
  }
  let CFG = SPEEDS[getSpeedKey()];

  // ===== State ==============================================================
  let running=false, paused=false;
  let t0=0, lastT=0, timerHUD=null, spawnIv=null;
  let score=0, combo=0, maxCombo=0, hitCount=0, totalNotes=0;
  let levelTime=60; // วินาทีต่อเพลง (เดโม่)
  let elapsed=0;

  // โน้ต: { lane:0..2, y:number, spd:number, color:string, el:a-entity }
  const notes = [];

  // ===== SFX ================================================================
  const SFX = {
    hitP: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    hitG: new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    assist: new Audio(`${ASSET_BASE}/assets/sfx/laser.wav`),
    miss: new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo: new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    start: new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    pause: new Audio(`${ASSET_BASE}/assets/sfx/tel_guard.wav`)
  };
  Object.values(SFX).forEach(a=>{ a.crossOrigin="anonymous"; a.preload="auto"; });

  // ===== UI ================================================================
  function updateHUD(){
    const acc = totalNotes ? Math.round((hitCount/totalNotes)*100) : 0;
    $('rbScore') && ( $('rbScore').textContent = score );
    $('rbCombo') && ( $('rbCombo').textContent = combo );
    $('rbAcc')   && ( $('rbAcc').textContent   = acc + '%' );
    $('rbTime')  && ( $('rbTime').textContent  = Math.max(0, Math.ceil(levelTime - elapsed)) + 's' );
  }
  function showResults(){
    const acc = totalNotes ? Math.round((hitCount/totalNotes)*100) : 0;
    $('rbResScore') && ( $('rbResScore').textContent = score );
    $('rbResCombo') && ( $('rbResCombo').textContent = maxCombo );
    $('rbResAcc')   && ( $('rbResAcc').textContent   = acc + '%' );
    $('rbResults') && ( $('rbResults').style.display = 'flex' );
  }
  function hideResults(){ $('rbResults') && ( $('rbResults').style.display = 'none' ); }

  // ===== Build Lanes / Hit Line ============================================
  function ensureArena(){
    if($(ARENA_ID)) return $(ARENA_ID);
    const a = document.createElement('a-entity');
    a.setAttribute('id', ARENA_ID);
    a.setAttribute('position', `0 0 0`);
    q('a-scene').appendChild(a);
    return a;
  }

  function buildLanes(){
    const arena = ensureArena();

    // clear previous
    Array.from(arena.children).forEach(c=>{
      if(c.dataset?.rb === 'lane' || c.dataset?.rb === 'hitline') safeRemove(c);
    });

    // Lane lines (เส้นแนวตั้ง)
    LANES.forEach((x,i)=>{
      const line = document.createElement('a-entity');
      line.dataset.rb='lane';
      line.setAttribute('geometry','primitive: box; width: 0.04; height: 2.4; depth: 0.02');
      line.setAttribute('material','color: #223a50; opacity: 0.85; transparent: true');
      line.setAttribute('position', `${x} 1.6 ${Z_POS}`);
      arena.appendChild(line);

      // หมุดที่ใต้ฮิตไลน์ (เล็กๆ)
      const peg = document.createElement('a-entity');
      peg.dataset.rb='lane';
      peg.setAttribute('geometry','primitive: box; width: 0.12; height: 0.06; depth: 0.02');
      peg.setAttribute('material','color: #294b66; opacity: 0.95; transparent: true');
      peg.setAttribute('position', `${x} ${HIT_Y-0.06} ${Z_POS}`);
      arena.appendChild(peg);
    });

    // HIT LINE (เรืองแสง)
    const hit = document.createElement('a-entity');
    hit.dataset.rb='hitline';
    hit.setAttribute('geometry','primitive: box; width: 3.0; height: 0.03; depth: 0.02');
    hit.setAttribute('material','color: #00ff8a; opacity: 0.9; emissive: #00ff8a; emissiveIntensity: 0.7; transparent: true');
    hit.setAttribute('position', `0 ${HIT_Y} ${Z_POS}`);
    hit.setAttribute('animation__pulse','property: material.emissiveIntensity; dir: alternate; to: 1.0; loop: true; dur: 600; easing: easeInOutSine');
    ensureArena().appendChild(hit);
  }

  function flashHitLine(kind){
    const hit = Array.from(ensureArena().children).find(c=>c.dataset?.rb==='hitline');
    if(!hit) return;
    const col = (kind==='perfect') ? '#20ffa0' : (kind==='good' ? '#a0ffea' : '#ffe37a');
    hit.setAttribute('material', `color:${col}; emissive:${col}; emissiveIntensity:1; opacity:0.95; transparent:true`);
    setTimeout(()=> hit.setAttribute('material','color:#00ff8a; emissive:#00ff8a; emissiveIntensity:0.7; opacity:0.9; transparent:true'), 120);
  }

  // ===== Note Factory =======================================================
  const NOTE_SHAPES = ['a-sphere','a-box','a-tetrahedron','a-octahedron'];
  const NOTE_COLORS = ['#00d0ff','#ffd166','#ff6b6b','#00ffa3','#a899ff'];

  function spawnNote(lane, speedMul=1){
    const arena = ensureArena();
    const elTag = pick(NOTE_SHAPES);
    const el = document.createElement(elTag);

    const color = pick(NOTE_COLORS);
    el.classList.add('rb-note','clickable');
    el.setAttribute('color', color);
    el.setAttribute('position', `${LANES[lane]} ${TOP_Y} ${NOTE_Z}`);
    // ขนาด/รูปร่าง
    if(elTag==='a-sphere') el.setAttribute('radius','0.12');
    else if(elTag==='a-box') el.setAttribute('depth','0.16'), el.setAttribute('width','0.16'), el.setAttribute('height','0.16');
    else el.setAttribute('radius','0.12');

    arena.appendChild(el);

    // ความเร็วเฉพาะโน้ต
    const spd = (CFG.baseSpeed + elapsed*CFG.accel) * speedMul;

    notes.push({ lane, y: TOP_Y, spd, color, el });
    totalNotes++;
  }

  // สุ่มสไตล์สปอน
  function spawnPattern(){
    // 55% single, 30% double, 15% stream
    const r = rng();
    if(r < 0.55){
      spawnNote(Math.floor(rng()*3));
    }else if(r < 0.85){
      let a=Math.floor(rng()*3), b=Math.floor(rng()*3);
      if(a===b) b=(b+1)%3;
      spawnNote(a); spawnNote(b, 1.04);
    }else{
      const base = Math.floor(rng()*3);
      spawnNote(base);
      setTimeout(()=>spawnNote((base+1)%3, 1.05), 120);
      setTimeout(()=>spawnNote((base+2)%3, 1.10), 240);
    }
  }

  // ===== Game Loop ==========================================================
  function tick(ts){
    if(!running || paused) return;
    if(!t0){ t0=ts; lastT=ts; requestAnimationFrame(tick); return; }
    const dt = (ts - lastT)/1000;
    lastT = ts;
    elapsed = (ts - t0)/1000;

    // move notes
    for(let i=notes.length-1;i>=0;i--){
      const n = notes[i];
      n.y -= n.spd * dt;
      if(n.el) n.el.setAttribute('position', `${LANES[n.lane]} ${n.y.toFixed(3)} ${NOTE_Z}`);

      // miss (ผ่าน hit line ลงไป)
      if(n.y < HIT_Y - 0.40){
        missNote(i);
      }
    }

    // end by time
    if(elapsed >= levelTime){
      end();
      return;
    }

    requestAnimationFrame(tick);
  }

  function missNote(index){
    const n = notes[index];
    if(!n) return;
    try{ SFX.miss.play(); }catch(_){}
    flashHitLine('miss');
    combo = 0;
    if(n.el){
      n.el.setAttribute('material','color:#ff3355; opacity:0.7; transparent:true');
      n.el.setAttribute('animation__out','property: scale; to: 0.001 0.001 0.001; dur: 120; easing: easeInBack');
      const rm=n.el; setTimeout(()=>safeRemove(rm), 130);
    }
    notes.splice(index,1);
    updateHUD();
  }

  // ===== Judging ============================================================
  function judgeHit(lane){
    if(!running || paused) return;

    // หาโน้ตในเลนนี้ที่ใกล้ HIT_Y ที่สุด
    let bestIdx = -1, bestDy = 9e9;
    for(let i=0;i<notes.length;i++){
      const n = notes[i];
      if(n.lane !== lane) continue;
      const dy = Math.abs(n.y - HIT_Y);
      if(dy < bestDy) { bestDy = dy; bestIdx = i; }
    }

    if(bestIdx===-1){
      // ไม่มีโน้ตในเลน — ลอง assist: โน้ตเลนข้างเคียงภายใน assistWindow
      let aid = -1, ady = 9e9;
      for(let i=0;i<notes.length;i++){
        const n = notes[i];
        if(Math.abs(n.lane - lane) > CFG.assistLaneTol) continue;
        const dy = Math.abs(n.y - HIT_Y);
        if(dy < CFG.assistWindow && dy < ady){ ady = dy; aid = i; }
      }
      if(aid>=0){
        hitNote(aid, ady, true);
        return;
      }
      // whiff
      try{ SFX.miss.play(); }catch(_){}
      combo = 0; updateHUD(); flashHitLine('miss');
      return;
    }
    hitNote(bestIdx, bestDy, false);
  }

  function hitNote(index, dy, assisted){
    const n = notes[index];
    const kind = (dy <= CFG.perfect) ? 'perfect' : (dy <= CFG.window ? 'good' : 'late');

    let add=0;
    if(kind==='perfect'){ add = 120; try{SFX.hitP.play();}catch(_){}; combo+=1; }
    else if(kind==='good'){ add = 80;  try{SFX.hitG.play();}catch(_){}; combo+=1; }
    else { add = assisted ? 60 : 40; try{SFX.assist.play();}catch(_){}; combo = Math.max(0, combo+1); }

    if(combo>0 && combo%10===0){ try{ SFX.combo.play(); }catch(_){ } }

    score += add + Math.floor(combo * 1.5);
    hitCount++; if(combo>maxCombo) maxCombo=combo;
    updateHUD();
    flashHitLine(kind);

    if(n.el){
      n.el.setAttribute('animation__out','property: scale; to: 0.001 0.001 0.001; dur: 90; easing: easeInBack');
      const rm=n.el; setTimeout(()=>safeRemove(rm), 100);
    }
    notes.splice(index,1);
  }

  // ===== Input: Ray-based picking (mouse/touch) =============================
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();

  function laneFromPointer(clientX, clientY){
    const sceneEl = q('a-scene'); const cam = sceneEl?.camera;
    if(!cam){
      const seg = window.innerWidth/3;
      return (clientX<seg)?0:(clientX<2*seg?1:2);
    }
    pointerNDC.x =  (clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, cam);

    const origin = raycaster.ray.origin.clone();
    const dir    = raycaster.ray.direction.clone();
    const t = (Z_POS - origin.z) / dir.z;
    const p = origin.add(dir.multiplyScalar(t));
    let bestLane=0, bestDx=Infinity;
    for(let i=0;i<LANES.length;i++){
      const dx = Math.abs(p.x - LANES[i]);
      if(dx < bestDx){ bestDx=dx; bestLane=i; }
    }
    return bestLane;
  }

  function pickNoteAtPointer(clientX, clientY){
    const sceneEl=q('a-scene'); const cam=sceneEl?.camera;
    if(!cam) return null;

    pointerNDC.x =  (clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, cam);

    const objs=[];
    notes.forEach(n=>{ if(n.el?.object3D) n.el.object3D.traverse(child=>objs.push(child)); });
    const hits = raycaster.intersectObjects(objs, true);
    if(!hits.length) return null;

    let obj=hits[0].object;
    while(obj && !obj.el) obj=obj.parent;
    if(!obj?.el) return null;
    const idx = notes.findIndex(n=>n.el===obj.el);
    return idx>=0 ? { index: idx, dy: Math.abs(notes[idx].y - HIT_Y) } : null;
  }

  function bindInput(){
    const onPointer=(cx,cy)=>{
      // 1) ถ้าโดนตัวโน้ตตรงๆ => assist ที่แม่นมาก
      const picked = pickNoteAtPointer(cx,cy);
      if(picked){
        hitNote(picked.index, picked.dy, true);
        return;
      }
      // 2) หาเลนจากตำแหน่งโลก แล้ว judge
      judgeHit(laneFromPointer(cx,cy));
    };

    window.addEventListener('mousedown', e=>onPointer(e.clientX, e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{
      const t=e.touches?.[0]; if(!t) return;
      onPointer(t.clientX, t.clientY);
    }, {passive:true});

    // Keyboard (A / S / D / Space)
    window.addEventListener('keydown', e=>{
      if(e.repeat) return;
      if(e.key==='a'||e.key==='A') judgeHit(0);
      if(e.key==='s'||e.key==='S'||e.key===' ') judgeHit(1);
      if(e.key==='d'||e.key==='D') judgeHit(2);
    });
  }

  // ===== Flow ===============================================================
  function reset(){
    // clear notes
    for(let i=notes.length-1;i>=0;i--){
      const n=notes[i];
      if(n.el) safeRemove(n.el);
      notes.pop();
    }
    score=0; combo=0; maxCombo=0; hitCount=0; totalNotes=0;
    elapsed=0; t0=0; lastT=0;
    updateHUD();
    hideResults();
    buildLanes();
  }

  function start(){
    if(running) return;
    // read speed from dropdown (ถ้ามี)
    const sel = $('speedSelRB'); 
    const key = (sel && SPEEDS[sel.value]) ? sel.value : getSpeedKey();
    CFG = SPEEDS[key]; localStorage.setItem('rb_speed', key);

    reset();
    running=true; paused=false;
    try{ SFX.start.play(); }catch(_){}

    // spawn schedule
    if(spawnIv) clearInterval(spawnIv);
    spawnIv = setInterval(spawnPattern, 560);

    // HUD time tick
    if(timerHUD) clearInterval(timerHUD);
    timerHUD = setInterval(()=>{ elapsed += 1; updateHUD(); if(elapsed>=levelTime) end(); }, 1000);

    requestAnimationFrame(tick);
  }

  function togglePause(){
    if(!running) return;
    paused = !paused;
    try{ SFX.pause.play(); }catch(_){}
    $('rbPause') && ( $('rbPause').textContent = paused ? 'Resume' : 'Pause' );
    if(!paused) requestAnimationFrame(tick);
  }

  function end(){
    if(!running) return;
    running=false; paused=false;
    clearInterval(spawnIv); clearInterval(timerHUD);
    spawnIv=null; timerHUD=null;
    showResults();
  }

  function backToHub(){
    // กลับฮับที่ถูกต้อง
    const url = `${ASSET_BASE}/vr-fitness/`;
    window.location.href = url;
  }

  // ===== Buttons / Init =====================================================
  document.addEventListener('DOMContentLoaded', ()=>{
    $('rbStart')  && $('rbStart').addEventListener('click', start);
    $('rbPause')  && $('rbPause').addEventListener('click', togglePause);
    $('rbReplay') && $('rbReplay').addEventListener('click', start);
    $('rbBack')   && $('rbBack').addEventListener('click', backToHub);

    // ป้องกันปุ่มโดน overlay ทับ
    const btnDock = $('rbDock');
    if(btnDock){ btnDock.style.pointerEvents = 'auto'; }

    buildLanes();
    bindInput();
    updateHUD();
  });

  // ===== Safety / Unload ====================================================
  window.addEventListener('beforeunload', ()=>{
    try{ clearInterval(spawnIv); clearInterval(timerHUD); }catch(_){}
  });

})();
