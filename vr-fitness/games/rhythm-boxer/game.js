/* games/rhythm-boxer/game.js
   Rhythm Boxer · game.js (Click-Through Fix: canvas pointer-events none + UI pointer-events auto)
*/
(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);
  const q = (sel)=>document.querySelector(sel);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_){ } }

  // --------- Config (เท่าเดิมจากเวอร์ชันก่อน) ----------
  const ARENA_ID='rbArena', Z_POS=-3, LANES=[-0.9,0,0.9], HIT_Y=1.0, TOP_Y=2.3, NOTE_Z=Z_POS;

  const SPEEDS={
    beginner:{ baseSpeed:0.42, accel:0.00012, window:0.30, perfect:0.14, assistLaneTol:1.00, assistWindow:0.36 },
    standard:{ baseSpeed:0.56, accel:0.00018, window:0.26, perfect:0.12, assistLaneTol:0.95, assistWindow:0.32 },
    challenge:{baseSpeed:0.72, accel:0.00024, window:0.22, perfect:0.10, assistLaneTol:0.90, assistWindow:0.28 }
  };
  const getQ=(k)=>new URLSearchParams(location.search).get(k);
  function getSpeedKey(){ const q=getQ('speed')||localStorage.getItem('rb_speed'); return (q&&SPEEDS[q])?q:'standard'; }
  let CFG=SPEEDS[getSpeedKey()];

  let running=false, paused=false, t0=0, lastT=0, timerHUD=null, spawnIv=null;
  let score=0, combo=0, maxCombo=0, hitCount=0, totalNotes=0, levelTime=60, elapsed=0;
  const notes=[];

  const SFX={
    hitP:new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    hitG:new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    assist:new Audio(`${ASSET_BASE}/assets/sfx/laser.wav`),
    miss:new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo:new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    start:new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    pause:new Audio(`${ASSET_BASE}/assets/sfx/tel_guard.wav`)
  };

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
    $('rbTime')&&( $('rbTime').textContent=Math.max(0,Math.ceil(levelTime-elapsed))+'s' );
  }
  function showResults(){
    const acc = totalNotes ? Math.round((hitCount/totalNotes)*100) : 0;
    $('rbResScore')&&( $('rbResScore').textContent=score );
    $('rbResCombo')&&( $('rbResCombo').textContent=maxCombo );
    $('rbResAcc')&&( $('rbResAcc').textContent=acc+'%' );
    $('rbResults')&&( $('rbResults').style.display='flex' );
  }
  function hideResults(){ $('rbResults')&&( $('rbResults').style.display='none' ); }

  // ----- Lanes + Hit line -----
  function buildLanes(){
    const arena=ensureArena();
    Array.from(arena.children).forEach(c=>{
      if(c.dataset?.rb==='lane'||c.dataset?.rb==='hitline') safeRemove(c);
    });
    LANES.forEach((x)=>{
      const line=document.createElement('a-entity');
      line.dataset.rb='lane';
      line.setAttribute('geometry','primitive: box; width: .04; height: 2.4; depth: .02');
      line.setAttribute('material','color:#223a50; opacity:.85; transparent:true');
      line.setAttribute('position',`${x} 1.6 ${Z_POS}`);
      arena.appendChild(line);

      const peg=document.createElement('a-entity');
      peg.dataset.rb='lane';
      peg.setAttribute('geometry','primitive: box; width: .12; height: .06; depth: .02');
      peg.setAttribute('material','color:#294b66; opacity:.95; transparent:true');
      peg.setAttribute('position',`${x} ${HIT_Y-.06} ${Z_POS}`);
      arena.appendChild(peg);
    });

    const hit=document.createElement('a-entity');
    hit.dataset.rb='hitline';
    hit.setAttribute('geometry','primitive: box; width: 3.0; height: .03; depth: .02');
    hit.setAttribute('material','color:#00ff8a; opacity:.9; emissive:#00ff8a; emissiveIntensity:.7; transparent:true');
    hit.setAttribute('position',`0 ${HIT_Y} ${Z_POS}`);
    hit.setAttribute('animation__pulse','property: material.emissiveIntensity; dir: alternate; to: 1.0; loop: true; dur: 600; easing: easeInOutSine');
    arena.appendChild(hit);
  }
  function flashHitLine(kind){
    const arena=ensureArena();
    const hit=Array.from(arena.children).find(c=>c.dataset?.rb==='hitline');
    if(!hit) return;
    const col = kind==='perfect' ? '#20ffa0' : (kind==='good' ? '#a0ffea' : '#ffe37a');
    hit.setAttribute('material',`color:${col}; emissive:${col}; emissiveIntensity:1; opacity:.95; transparent:true`);
    setTimeout(()=>hit.setAttribute('material','color:#00ff8a; emissive:#00ff8a; emissiveIntensity:.7; opacity:.9; transparent:true'),120);
  }

  const NOTE_SHAPES=['a-sphere','a-box','a-tetrahedron','a-octahedron'];
  const NOTE_COLORS=['#00d0ff','#ffd166','#ff6b6b','#00ffa3','#a899ff'];
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }

  function spawnNote(lane, mul=1){
    const arena=ensureArena();
    const tag=pick(NOTE_SHAPES);
    const el=document.createElement(tag);
    const color=pick(NOTE_COLORS);
    el.classList.add('rb-note','clickable');
    el.setAttribute('color',color);
    el.setAttribute('position',`${LANES[lane]} ${TOP_Y} ${NOTE_Z}`);
    if(tag==='a-sphere') el.setAttribute('radius','0.12');
    else if(tag==='a-box'){ el.setAttribute('depth','0.16'); el.setAttribute('width','0.16'); el.setAttribute('height','0.16'); }
    else el.setAttribute('radius','0.12');
    arena.appendChild(el);

    const spd=(CFG.baseSpeed + elapsed*CFG.accel) * mul;
    notes.push({lane, y:TOP_Y, spd, color, el}); totalNotes++;
  }
  function spawnPattern(){
    const r=Math.random();
    if(r<.55){
      spawnNote(Math.floor(Math.random()*3));
    }else if(r<.85){
      let a=Math.floor(Math.random()*3), b=(a+1+Math.floor(Math.random()*2))%3;
      spawnNote(a); spawnNote(b,1.04);
    }else{
      const base=Math.floor(Math.random()*3);
      spawnNote(base);
      setTimeout(()=>spawnNote((base+1)%3,1.05),120);
      setTimeout(()=>spawnNote((base+2)%3,1.10),240);
    }
  }

  function missNote(i){
    const n=notes[i]; if(!n) return;
    try{SFX.miss.play();}catch(_){}
    flashHitLine('miss');
    combo=0;
    if(n.el){
      n.el.setAttribute('material','color:#ff3355; opacity:.7; transparent:true');
      n.el.setAttribute('animation__out','property: scale; to:.001 .001 .001; dur:120; easing:easeInBack');
      const rm=n.el; setTimeout(()=>safeRemove(rm),130);
    }
    notes.splice(i,1);
    updateHUD();
  }

  function tick(ts){
    if(!running || paused) return;
    if(!t0){ t0=ts; lastT=ts; requestAnimationFrame(tick); return; }
    const dt=(ts-lastT)/1000; lastT=ts; elapsed=(ts-t0)/1000;

    for(let i=notes.length-1;i>=0;i--){
      const n=notes[i];
      n.y-=n.spd*dt;
      n.el?.setAttribute('position',`${LANES[n.lane]} ${n.y.toFixed(3)} ${NOTE_Z}`);
      if(n.y < HIT_Y - .40) missNote(i);
    }

    if(elapsed>=levelTime){ end(); return; }
    requestAnimationFrame(tick);
  }

  // ---- Judging + Pointer mapping ----
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
    let best=-1, dy=1e9;
    for(let i=0;i<notes.length;i++){
      const n=notes[i]; if(n.lane!==lane) continue;
      const d=Math.abs(n.y-HIT_Y); if(d<dy){ dy=d; best=i; }
    }
    if(best<0){
      // assist ใกล้เคียง
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
    if(kind==='perfect'){ add=120; try{SFX.hitP.play();}catch(_){ } combo+=1; }
    else if(kind==='good'){ add=80; try{SFX.hitG.play();}catch(_){ } combo+=1; }
    else { add= assisted?60:40; try{SFX.assist.play();}catch(_){ } combo=Math.max(0,combo+1); }

    if(combo>0 && combo%10===0){ try{SFX.combo.play();}catch(_){ } }
    score+=add+Math.floor(combo*1.5); hitCount++; if(combo>maxCombo) maxCombo=combo;
    updateHUD(); flashHitLine(kind);

    if(n.el){
      n.el.setAttribute('animation__out','property: scale; to:.001 .001 .001; dur:90; easing:easeInBack');
      const rm=n.el; setTimeout(()=>safeRemove(rm),100);
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

  // ---- Flow ----
  function reset(){
    for(let i=notes.length-1;i>=0;i--){ const n=notes[i]; if(n.el) safeRemove(n.el); notes.pop(); }
    score=0; combo=0; maxCombo=0; hitCount=0; totalNotes=0; elapsed=0; t0=0; lastT=0;
    updateHUD(); hideResults(); buildLanes();
  }
  function start(){
    if(running) return;
    const sel=$('speedSelRB'); const key=(sel && SPEEDS[sel.value])?sel.value:getSpeedKey();
    CFG=SPEEDS[key]; localStorage.setItem('rb_speed', key);

    reset(); running=true; paused=false; try{SFX.start.play();}catch(_){}
    if(spawnIv) clearInterval(spawnIv); spawnIv=setInterval(spawnPattern, 560);
    if(timerHUD) clearInterval(timerHUD);
    timerHUD=setInterval(()=>{ elapsed+=1; updateHUD(); if(elapsed>=levelTime) end(); },1000);
    requestAnimationFrame(tick);
  }
  function togglePause(){
    if(!running) return;
    paused=!paused; try{SFX.pause.play();}catch(_){}
    $('rbPause')&&( $('rbPause').textContent=paused?'Resume':'Pause' );
    if(!paused) requestAnimationFrame(tick);
  }
  function end(){
    if(!running) return; running=false; paused=false;
    clearInterval(spawnIv); clearInterval(timerHUD); spawnIv=null; timerHUD=null;
    showResults();
  }
  function backToHub(){ window.location.href = `${ASSET_BASE}/vr-fitness/`; }

  // ---- Init: บังคับ pointer-events ให้ปุ่มแน่ ๆ ----
  document.addEventListener('DOMContentLoaded', ()=>{
    // กัน overlay ทับปุ่ม: เปิด pointer-events ให้ dock/results เสมอ
    ['rbDock','rbResults','rbHUD'].forEach(id=>{ const el=$(id); if(el){ el.style.pointerEvents='auto'; el.style.zIndex='9999'; } });

    $('rbStart')?.addEventListener('click', start);
    $('rbPause')?.addEventListener('click', togglePause);
    $('rbReplay')?.addEventListener('click', start);
    $('rbBack')?.addEventListener('click', backToHub);

    // เผื่อปุ่มใน results wired ที่ index.html
    // สร้างเลน + bind input
    buildLanes();
    bindInput();
    updateHUD();
  });

  window.addEventListener('beforeunload', ()=>{ try{ clearInterval(spawnIv); clearInterval(timerHUD); }catch(_){} });

})();
