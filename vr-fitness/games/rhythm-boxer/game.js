/* games/rhythm-boxer/game.js
   Rhythm Boxer · game.js
   - เริ่มโน้ต “ห่างมาก ๆ” แล้วค่อย ๆ ถี่ขึ้นแบบไหลลื่น (dynamic spawn ramp)
   - ปุ่ม Back กลับ Hub ที่ URL ตรงเป๊ะ
   - คง Hit Line เรืองแสง / โน้ตใหญ่ สีสัน / เมาส์-ทัชเลือกเลน + Raycast
*/
(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);
  const q = (sel)=>document.querySelector(sel);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const HUB_URL = 'https://supparang.github.io/webxr-health-mobile/vr-fitness/';
  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_){ } }

  // --------- พื้นที่เล่น ----------
  const ARENA_ID='rbArena', Z_POS=-3, LANES=[-0.9,0,0.9], HIT_Y=1.0, TOP_Y=2.4, NOTE_Z=Z_POS;

  // --------- ความเร็ว & ความถี่ (เริ่มห่างมาก ๆ -> ถี่ขึ้น) ----------
  const SPEEDS={
    beginner:{ baseSpeed:0.28, accel:0.00008, window:0.38, perfect:0.18, assistLaneTol:1.15, assistWindow:0.48, spawnStart:2000, spawnMin:900 },
    standard:{ baseSpeed:0.38, accel:0.00012, window:0.34, perfect:0.16, assistLaneTol:1.05, assistWindow:0.42, spawnStart:1800, spawnMin:780 },
    challenge:{baseSpeed:0.50, accel:0.00018, window:0.30, perfect:0.14, assistLaneTol:1.00, assistWindow:0.36, spawnStart:1600, spawnMin:650 }
  };
  const LEVEL_TIME = 60; // วินาที
  const getQ=(k)=>new URLSearchParams(location.search).get(k);
  function getSpeedKey(){ const q=getQ('speed')||localStorage.getItem('rb_speed'); return (q&&SPEEDS[q])?q:'standard'; }
  let CFG=SPEEDS[getSpeedKey()];

  // --------- สถานะเกม ----------
  let running=false, paused=false, t0=0, lastT=0, timerHUD=null, spawnTO=null;
  let score=0, combo=0, maxCombo=0, hitCount=0, totalNotes=0, elapsed=0;
  const notes=[];

  // --------- เสียง ----------
  const SFX={
    hitP:new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    hitG:new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    assist:new Audio(`${ASSET_BASE}/assets/sfx/laser.wav`),
    miss:new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo:new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    start:new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    pause:new Audio(`${ASSET_BASE}/assets/sfx/tel_guard.wav`)
  };

  // --------- ฉาก / HUD ----------
  function ensureArena(){
    let a=$(ARENA_ID);
    if(!a){ a=document.createElement('a-entity'); a.id=ARENA_ID; a.setAttribute('position','0 0 0'); q('a-scene')?.appendChild(a); }
    return a;
  }
  function updateHUD(){
    const acc = totalNotes ? Math.round((hitCount/totalNotes)*100) : 0;
    $('rbScore')&&( $('rbScore').textContent=score );
    $('rbCombo')&&( $('rbCombo').textContent=combo );
    $('rbAcc')&&( $('rbAcc').textContent=acc+'%' );
    $('rbTime')&&( $('rbTime').textContent=Math.max(0,Math.ceil(LEVEL_TIME-elapsed))+'s' );
  }
  function showResults(){
    const acc = totalNotes ? Math.round((hitCount/totalNotes)*100) : 0;
    $('rbResScore')&&( $('rbResScore').textContent=score );
    $('rbResCombo')&&( $('rbResCombo').textContent=maxCombo );
    $('rbResAcc')&&( $('rbResAcc').textContent=acc+'%' );
    $('rbResults')&&( $('rbResults').style.display='flex' );
  }
  function hideResults(){ $('rbResults')&&( $('rbResults').style.display='none' ); }

  // --------- วาด Hit Line ----------
  function buildHitLine(){
    const arena=ensureArena();
    // ล้างของเดิม
    Array.from(arena.children).forEach(c=>{
      if(c.dataset?.rb==='hitline' || c.classList?.contains('rb-note')) safeRemove(c);
    });
    const hit=document.createElement('a-entity');
    hit.dataset.rb='hitline';
    hit.setAttribute('geometry','primitive: box; width: 3.0; height: .03; depth: .02');
    hit.setAttribute('material','color:#00ff8a; opacity:.9; emissive:#00ff8a; emissiveIntensity:.8; transparent:true');
    hit.setAttribute('position',`0 ${HIT_Y} ${Z_POS}`);
    hit.setAttribute('animation__pulse','property: material.emissiveIntensity; dir: alternate; to: 1.15; loop: true; dur: 700; easing: easeInOutSine');
    arena.appendChild(hit);
  }
  function flashHitLine(kind){
    const arena=ensureArena();
    const hit=Array.from(arena.children).find(c=>c.dataset?.rb==='hitline');
    if(!hit) return;
    const col = kind==='perfect' ? '#20ffa0' : (kind==='good' ? '#a0ffea' : '#ffe37a');
    hit.setAttribute('material',`color:${col}; emissive:${col}; emissiveIntensity:1.2; opacity:.95; transparent:true`);
    setTimeout(()=>hit.setAttribute('material','color:#00ff8a; emissive:#00ff8a; emissiveIntensity:.8; opacity:.9; transparent:true'),120);
  }

  // --------- โน้ต (ใหญ่ + สีสัน) ----------
  const NOTE_SHAPES=['a-sphere','a-box','a-tetrahedron','a-octahedron'];
  const NOTE_COLORS=['#00d0ff','#ffd166','#ff6b6b','#00ffa3','#a899ff','#8cf5ff','#ff9cf2'];
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }

  function spawnNote(lane, mul=1){
    const arena=ensureArena();
    const tag=pick(NOTE_SHAPES);
    const color=pick(NOTE_COLORS);
    const el=document.createElement(tag);
    el.classList.add('rb-note','clickable');
    el.setAttribute('color',color);
    // ขนาดใหญ่ขึ้น
    if(tag==='a-sphere'){ el.setAttribute('radius','0.20'); }
    else if(tag==='a-box'){ el.setAttribute('width','0.26'); el.setAttribute('height','0.26'); el.setAttribute('depth','0.26'); }
    else{ el.setAttribute('radius','0.20'); }
    // glow
    el.setAttribute('material',`color:${color}; emissive:${color}; emissiveIntensity:.35; metalness:.2; roughness:.4; transparent:true; opacity:.95`);
    el.setAttribute('position',`${LANES[lane]} ${TOP_Y} ${NOTE_Z}`);
    el.setAttribute('animation__in','property: scale; from:.001 .001 .001; to:1 1 1; dur:120; easing:easeOutBack');
    arena.appendChild(el);

    const spd=(CFG.baseSpeed + elapsed*CFG.accel) * mul;
    notes.push({lane, y:TOP_Y, spd, el}); totalNotes++;
  }

  // รูปแบบเกิด: ต้นเกมปล่อยเดี่ยวเท่านั้น -> กลางเกมเริ่มคู่ -> ท้ายเกมค่อยมี 3 ตัว
  function spawnPattern(){
    const t = elapsed;
    if (t < 12){
      spawnNote(Math.floor(Math.random()*3));
      return;
    }
    if (t < 25){
      const r=Math.random();
      if(r<0.80){ spawnNote(Math.floor(Math.random()*3)); }
      else {
        let a=Math.floor(Math.random()*3), b=(a+1+Math.floor(Math.random()*2))%3;
        spawnNote(a); setTimeout(()=>spawnNote(b,1.02), 100);
      }
      return;
    }
    // ท้ายเกม: มีทั้งเดี่ยว/คู่/สเต็ป 3 แต่ยังไม่ถี่มาก เพราะเราคุมด้วย interval ที่ลดลงอยู่แล้ว
    const r=Math.random();
    if(r<.55){
      spawnNote(Math.floor(Math.random()*3));
    }else if(r<.90){
      let a=Math.floor(Math.random()*3), b=(a+1+Math.floor(Math.random()*2))%3;
      spawnNote(a); setTimeout(()=>spawnNote(b,1.02), 90);
    }else{
      const base=Math.floor(Math.random()*3);
      spawnNote(base);
      setTimeout(()=>spawnNote((base+1)%3,1.03),140);
      setTimeout(()=>spawnNote((base+2)%3,1.05),280);
    }
  }

  // --------- สเกจูลแบบเว้นช่วงไดนามิก (เริ่มห่าง -> ถี่ขึ้น) ----------
  function currentSpawnInterval(){
    // ลดลงเชิงเส้นตามเวลา จนถึงค่าต่ำสุด
    const rampPerSec = (CFG.spawnStart - CFG.spawnMin) / LEVEL_TIME;
    const ms = Math.max(CFG.spawnMin, Math.floor(CFG.spawnStart - rampPerSec * elapsed));
    return ms;
  }
  function scheduleNextSpawn(){
    if(!running || paused) return;
    clearTimeout(spawnTO);
    spawnTO = setTimeout(()=>{
      if(!running || paused) return;
      spawnPattern();
      scheduleNextSpawn();
    }, currentSpawnInterval());
  }

  // --------- เกมลูป ----------
  function missNote(i){
    const n=notes[i]; if(!n) return;
    try{SFX.miss.play();}catch(_){}
    flashHitLine('miss'); combo=0;
    if(n.el){
      n.el.setAttribute('material','color:#ff3355; emissive:#ff3355; emissiveIntensity:.6; opacity:.8; transparent:true');
      n.el.setAttribute('animation__out','property: scale; to:.001 .001 .001; dur:120; easing:easeInBack');
      const rm=n.el; setTimeout(()=>safeRemove(rm),130);
    }
    notes.splice(i,1); updateHUD();
  }

  function tick(ts){
    if(!running || paused) return;
    if(!t0){ t0=ts; lastT=ts; requestAnimationFrame(tick); return; }
    const dt=(ts-lastT)/1000; lastT=ts; elapsed=(ts-t0)/1000;

    for(let i=notes.length-1;i>=0;i--){
      const n=notes[i];
      n.y-=n.spd*dt;
      n.el?.setAttribute('position',`${LANES[n.lane]} ${n.y.toFixed(3)} ${NOTE_Z}`);
      if(n.y < HIT_Y - .45) missNote(i);
    }

    if(elapsed>=LEVEL_TIME){ end(); return; }
    requestAnimationFrame(tick);
  }

  // --------- ตรวจจับคลิก / คีย์ ---------
  const raycaster=new THREE.Raycaster();
  const ndc=new THREE.Vector2();
  function laneFromPointer(cx,cy){
    const sc=q('a-scene'); const cam=sc?.camera;
    if(!cam){ const seg=window.innerWidth/3; return (cx<seg)?0:(cx<2*seg?1:2); }
    ndc.x=(cx/window.innerWidth)*2-1; ndc.y=-(cy/window.innerHeight)*2+1;
    raycaster.setFromCamera(ndc, cam);
    const o=raycaster.ray.origin.clone(), d=raycaster.ray.direction.clone();
    const t=(Z_POS-o.z)/d.z, p=o.add(d.multiplyScalar(t));
    let bl=0,bd=1e9; for(let i=0;i<LANES.length;i++){ const dx=Math.abs(p.x-LANES[i]); if(dx<bd){bd=dx; bl=i;} }
    return bl;
  }
  function pickNoteAtPointer(cx,cy){
    const sc=q('a-scene'); const cam=sc?.camera; if(!cam) return null;
    ndc.x=(cx/window.innerWidth)*2-1; ndc.y=-(cy/window.innerHeight)*2+1; raycaster.setFromCamera(ndc, cam);
    const objs=[]; notes.forEach(n=> n.el?.object3D?.traverse(ch=>objs.push(ch)) );
    const hits=raycaster.intersectObjects(objs,true); if(!hits.length) return null;
    let o=hits[0].object; while(o && !o.el) o=o.parent;
    if(!o?.el) return null;
    const idx=notes.findIndex(n=>n.el===o.el);
    return idx>=0 ? {index:idx, dy:Math.abs(notes[idx].y-HIT_Y)} : null;
  }

  function judgeHitLane(lane){
    if(!running||paused) return;
    // หาโน้ตที่ใกล้ HIT_Y ที่สุดในเลนนั้น
    let best=-1, dy=1e9;
    for(let i=0;i<notes.length;i++){
      const n=notes[i]; if(n.lane!==lane) continue;
      const d=Math.abs(n.y-HIT_Y); if(d<dy){ dy=d; best=i; }
    }
    if(best<0){
      // Assist ข้ามเลนเล็กน้อย + หน้าต่างกว้างขึ้น
      let aid=-1, ady=1e9;
      for(let i=0;i<notes.length;i++){
        const n=notes[i];
        if(Math.abs(n.lane-lane) > CFG.assistLaneTol) continue;
        const d=Math.abs(n.y-HIT_Y);
        if(d<CFG.assistWindow && d<ady){ ady=d; aid=i; }
      }
      if(aid>=0){ return hitNote(aid, ady, true); }
      try{SFX.miss.play();}catch(_){}
      combo=0; updateHUD(); flashHitLine('miss'); return;
    }
    hitNote(best, dy, false);
  }

  function hitNote(index, dy, assisted){
    const n=notes[index];
    const kind = (dy<=CFG.perfect)?'perfect':(dy<=CFG.window?'good':'late');
    let add=0;
    if(kind==='perfect'){ add=130; try{SFX.hitP.play();}catch(_){ } combo+=1; }
    else if(kind==='good'){ add=90; try{SFX.hitG.play();}catch(_){ } combo+=1; }
    else { add= assisted?70:50; try{SFX.assist.play();}catch(_){ } combo=Math.max(0,combo+1); }

    if(combo>0 && combo%10===0){ try{SFX.combo.play();}catch(_){ } }
    score+=add+Math.floor(combo*1.6); hitCount++; if(combo>maxCombo) maxCombo=combo;
    updateHUD(); flashHitLine(kind);

    if(n.el){
      n.el.setAttribute('animation__out','property: scale; to:.001 .001 .001; dur:100; easing:easeInBack');
      const rm=n.el; setTimeout(()=>safeRemove(rm),110);
    }
    notes.splice(index,1);
  }

  function bindInput(){
    const onPointer=(cx,cy)=>{
      const p=pickNoteAtPointer(cx,cy);
      if(p){ hitNote(p.index, p.dy, true); return; }
      judgeHitLane(laneFromPointer(cx,cy));
    };
    window.addEventListener('mousedown', e=>onPointer(e.clientX,e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{ const t=e.touches?.[0]; if(!t) return; onPointer(t.clientX,t.clientY); }, {passive:true});
    window.addEventListener('keydown', e=>{
      if(e.repeat) return;
      if(e.key==='a'||e.key==='A') judgeHitLane(0);
      if(e.key==='s'||e.key==='S'||e.key===' ') judgeHitLane(1);
      if(e.key==='d'||e.key==='D') judgeHitLane(2);
      if(e.key==='p'||e.key==='P') togglePause();
    });
  }

  // --------- Flow ----------
  function reset(){
    for(let i=notes.length-1;i>=0;i--){ const n=notes[i]; if(n.el) safeRemove(n.el); notes.pop(); }
    score=0; combo=0; maxCombo=0; hitCount=0; totalNotes=0; elapsed=0; t0=0; lastT=0;
    updateHUD(); hideResults(); buildHitLine();
    clearTimeout(spawnTO); spawnTO=null;
  }
  function start(){
    if(running) return;
    const sel=$('speedSelRB'); const key=(sel && SPEEDS[sel.value])?sel.value:getSpeedKey();
    CFG=SPEEDS[key]; localStorage.setItem('rb_speed', key);

    reset(); running=true; paused=false; try{SFX.start.play();}catch(_){}
    if(timerHUD) clearInterval(timerHUD);
    timerHUD=setInterval(()=>{ elapsed=Math.min(LEVEL_TIME, elapsed+1); updateHUD(); if(elapsed>=LEVEL_TIME) end(); },1000);
    scheduleNextSpawn();
    requestAnimationFrame(tick);
  }
  function togglePause(){
    if(!running) return;
    paused=!paused; try{SFX.pause.play();}catch(_){}
    $('rbPause')&&( $('rbPause').textContent=paused?'Resume':'Pause' );
    if(paused){ clearTimeout(spawnTO); spawnTO=null; }
    else { scheduleNextSpawn(); requestAnimationFrame(tick); }
  }
  function end(){
    if(!running) return; running=false; paused=false;
    clearTimeout(spawnTO); clearInterval(timerHUD); spawnTO=null; timerHUD=null;
    showResults();
  }
  function backToHub(){ window.location.href = HUB_URL; }

  document.addEventListener('DOMContentLoaded', ()=>{
    // ให้ UI คลิกได้แน่นอน
    ['rbDock','rbResults','rbHUD'].forEach(id=>{ const el=$(id); if(el){ el.style.pointerEvents='auto'; el.style.zIndex='9999'; } });
    $('rbStart')?.addEventListener('click', start);
    $('rbPause')?.addEventListener('click', togglePause);
    $('rbReplay')?.addEventListener('click', start);
    $('rbBack')?.addEventListener('click', backToHub);

    buildHitLine();
    bindInput();
    updateHUD();
  });

  window.addEventListener('beforeunload', ()=>{ try{ clearTimeout(spawnTO); clearInterval(timerHUD); }catch(_){} });
})();
