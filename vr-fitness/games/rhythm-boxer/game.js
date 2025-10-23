/* games/rhythm-boxer/game.js
   Rhythm Boxer – คลิกได้จริง / Timer ชัด / เลือกเพลงได้ / Back to Hub ตรง
*/
(function(){
  "use strict";

  // ---------- helpers ----------
  const $ = (id)=>document.getElementById(id);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const ASSET_BASE=(document.querySelector('meta[name="asset-base"]')?.content||'').replace(/\/+$/,'');
  const HUB_URL="https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const scene=document.querySelector('a-scene');

  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_e){} }

  // ---------- difficulty ----------
  const DIFF={
    beginner : { start:2600, step:90,  minSpawn:1100, speedMul:0.82, judgeMul:1.55, time:75 },
    standard : { start:2100, step:70,  minSpawn:820,  speedMul:1.00, judgeMul:1.10, time:80 },
    challenge: { start:1800, step:60,  minSpawn:640,  speedMul:1.18, judgeMul:0.95, time:85 }
  };
  let diffKey=new URLSearchParams(location.search).get('diff')||'standard';
  if(!DIFF[diffKey]) diffKey='standard';

  // ---------- songs ----------
  const SONGS=[
    { id:'training', title:'Training Beat', src:`${ASSET_BASE||'.'}/assets/music/training.mp3`, bpm:120, offset:200 },
    { id:'flow',     title:'Flow Runner',   src:`${ASSET_BASE||'.'}/assets/music/flow.mp3`,     bpm:132, offset:160 },
    { id:'charge',   title:'Charge Up',     src:`${ASSET_BASE||'.'}/assets/music/charge.mp3`,   bpm:145, offset:120 },
  ];
  let currentSong=SONGS[0];

  // ---------- state ----------
  let running=false, paused=false;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, accuracy=0;
  let spawnInterval=DIFF[diffKey].start, judgeMul=DIFF[diffKey].judgeMul, speedMul=DIFF[diffKey].speedMul;
  let timeLeft=DIFF[diffKey].time;
  let gameStartAt=0;
  let spawnTimer=null, accelTimer=null, secondTimer=null;
  let audio=null;

  // ---------- arena & hit line ----------
  const ARENA = $('arena') || (()=>{
    const a=document.createElement('a-entity'); a.id='arena'; a.setAttribute('position','0 0 0'); scene?.appendChild(a); return a;
  })();
  const HIT_Y=0.9;

  (function ensureHitLine(){
    if ($('hitLine')) return;
    const line=document.createElement('a-plane');
    line.id='hitLine';
    line.setAttribute('position',`0 ${HIT_Y} -2.4`);
    line.setAttribute('width','3.2'); line.setAttribute('height','0.02');
    line.setAttribute('material','color:#00ff88; emissive:#00ff88; emissiveIntensity:1; opacity:0.95; transparent:true; shader:standard');
    line.classList.add('clickable');
    line.setAttribute('animation__pulse','property:scale; dir:alternate; to:1.02 1.2 1; dur:900; loop:true; easing:easeInOutSine');
    ARENA.appendChild(line);
  })();

  // ---------- visuals ----------
  const COLORS=['#00d0ff','#ffd166','#ff6b6b','#9bff9b','#b07aff','#ffa7d1'];
  const SHAPES=['a-sphere','a-box','a-octahedron'];
  const LANES_X=[-1.2,-0.4,0.4,1.2];
  const NOTE_SIZE=0.30;
  const BASE_FALL_SPEED=0.50; // เริ่มช้า อ่านง่าย

  function makeNote(){
    const lane=Math.floor(Math.random()*LANES_X.length);
    const kind=Math.floor(Math.random()*SHAPES.length);
    const color=COLORS[(Math.random()*COLORS.length)|0];
    const el=document.createElement(SHAPES[kind]);
    el.classList.add('note','clickable');
    el.setAttribute('position',`${LANES_X[lane]} 2.5 -2.4`);
    if (SHAPES[kind]==='a-sphere') el.setAttribute('radius', NOTE_SIZE);
    if (SHAPES[kind]==='a-box')     el.setAttribute('width', NOTE_SIZE*1.2), el.setAttribute('height', NOTE_SIZE*1.2), el.setAttribute('depth', NOTE_SIZE*1.2);
    if (SHAPES[kind]==='a-octahedron') el.setAttribute('radius', NOTE_SIZE);
    el.setAttribute('material',`color:${color}; emissive:${color}; emissiveIntensity:0.55; metalness:0.2; roughness:0.4`);
    el.dataset.lane=lane; el.dataset.speed=BASE_FALL_SPEED*speedMul; el.dataset.alive='1';
    el.addEventListener('click', ()=>tryHit(el));  // ให้ตัวโน้ตรับคลิกด้วย
    ARENA.appendChild(el);
    spawns++;
    return el;
  }

  // ---------- per-frame ----------
  AFRAME.registerSystem('rb-loop',{
    tick(){
      if(!running || paused) return;
      const notes=Array.from(ARENA.querySelectorAll('.note'));
      for(const n of notes){
        if(n.dataset.alive!=='1') continue;
        const p=n.object3D.position;
        p.y -= (+n.dataset.speed||BASE_FALL_SPEED)*0.016;
        if(p.y < HIT_Y-0.2){
          n.dataset.alive='0';
          safeRemove(n);
          registerResult('miss', p);
        }
      }
    }
  });

  // ---------- pointer raycast (mouse/touch คลิกได้จริง) ----------
  ;(function installPointerRaycast(){
    if(!scene || !THREE) return;
    const raycaster=new THREE.Raycaster();
    const mouse=new THREE.Vector2();
    function pick(x,y){
      const cam=scene.camera; if(!cam) return;
      mouse.x=(x/window.innerWidth)*2-1; mouse.y=-(y/window.innerHeight)*2+1;
      raycaster.setFromCamera(mouse, cam);
      const objs=[]; Array.from(document.querySelectorAll('.clickable')).map(e=>e.object3D).filter(Boolean).forEach(o=>o.traverse(c=>objs.push(c)));
      const hits=raycaster.intersectObjects(objs,true);
      if(hits && hits.length){ let o=hits[0].object; while(o && !o.el) o=o.parent; o?.el?.emit('click'); }
    }
    window.addEventListener('mousedown', e=>pick(e.clientX,e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{ const t=e.touches?.[0]; if(t) pick(t.clientX,t.clientY); }, {passive:true});
  })();

  // ---------- audio ----------
  const SFX={
    good:    new Audio(`${ASSET_BASE||'.'}/assets/sfx/good.wav`),
    perfect: new Audio(`${ASSET_BASE||'.'}/assets/sfx/perfect.wav`),
    miss:    new Audio(`${ASSET_BASE||'.'}/assets/sfx/miss.wav`),
    combo:   new Audio(`${ASSET_BASE||'.'}/assets/sfx/combo.wav`),
    click:   new Audio(`${ASSET_BASE||'.'}/assets/sfx/click.wav`),
    hitflash:new Audio(`${ASSET_BASE||'.'}/assets/sfx/laser.wav`)
  };
  function play(a){ try{ a.currentTime=0; a.play(); }catch(_e){} }
  function setSong(song){ try{ audio?.pause?.(); }catch(_){}
    audio=new Audio(song.src); audio.loop=false; }

  // ---------- FX ----------
  function flashHitLine(){
    const line=$('hitLine'); if(!line) return;
    line.setAttribute('animation__flash','property:material.emissiveIntensity;from:1;to:2.2;dur:90;dir:alternate;loop:2;easing:easeOutQuad');
  }
  function ringBurst(pos){
    const r=document.createElement('a-ring');
    r.setAttribute('position',`${pos.x} ${HIT_Y} ${pos.z}`);
    r.setAttribute('radius-inner','0.01'); r.setAttribute('radius-outer','0.02');
    r.setAttribute('material','color:#00ffcc;opacity:0.95;shader:flat');
    ARENA.appendChild(r);
    const t0=performance.now(), DUR=420;
    (function step(){
      const t=(performance.now()-t0)/DUR;
      if(t>=1){ safeRemove(r); return; }
      const ro=0.02+0.35*t;
      r.setAttribute('radius-inner',Math.max(0.01,ro-0.02));
      r.setAttribute('radius-outer',ro);
      r.setAttribute('material',`color:#00ffcc;opacity:${1-t};shader:flat`);
      requestAnimationFrame(step);
    })();
  }
  function particles(pos,color='#00ffa3'){
    for(let i=0;i<8;i++){
      const p=document.createElement('a-sphere');
      p.setAttribute('radius','0.015'); p.setAttribute('color',color);
      p.setAttribute('position',`${pos.x} ${HIT_Y} ${pos.z}`); ARENA.appendChild(p);
      const dx=(Math.random()-0.5)*0.6, dy=0.2+Math.random()*0.5;
      const t0=performance.now(), DUR=420;
      (function step(){
        const t=(performance.now()-t0)/DUR;
        if(t>=1){ safeRemove(p); return; }
        p.setAttribute('position',`${(pos.x+dx*t).toFixed(3)} ${(HIT_Y+dy*t-0.3*t*t).toFixed(3)} ${pos.z}`);
        p.setAttribute('opacity',`${1-t}`);
        requestAnimationFrame(step);
      })();
    }
  }

  // ---------- judge / score ----------
  function tryHit(note){
    if(!note || note.dataset.alive!=='1') return;
    const py=note.object3D.position.y;
    const dy=Math.abs(py-HIT_Y);
    const perfWin=0.08*judgeMul;
    const goodWin=0.16*judgeMul;
    let rank=null;
    if(dy<=perfWin) rank='perfect';
    else if(dy<=goodWin) rank='good';
    else return;

    note.dataset.alive='0';
    const pos=note.object3D.getWorldPosition(new THREE.Vector3());
    safeRemove(note);
    registerResult(rank,pos);
  }

  function registerResult(kind,pos){
    if(kind==='miss'){
      combo=0; play(SFX.miss);
      floatText('MISS','#ff5577', pos||new THREE.Vector3(0,HIT_Y,-2.4));
      updateHUD(); return;
    }
    hits++; combo++; if(combo>maxCombo) maxCombo=combo;
    let add=0; let col;
    if(kind==='perfect'){ add=32; col='#00ffa3'; play(SFX.perfect); }
    else { add=18; col='#00d0ff'; play(SFX.good); }
    score += add + Math.floor(combo*0.8);
    accuracy = spawns? Math.round((hits/spawns)*100) : 0;
    play(SFX.hitflash); flashHitLine(); ringBurst(pos||new THREE.Vector3(0,HIT_Y,-2.4)); particles(pos||new THREE.Vector3(0,HIT_Y,-2.4), col);
    floatText(kind.toUpperCase(), col, pos||new THREE.Vector3(0,HIT_Y,-2.4));
    if(combo>0 && combo%10===0) play(SFX.combo);
    updateHUD();
  }

  function floatText(text,color,pos){
    const e=document.createElement('a-entity');
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${pos.x} ${pos.y+0.22} ${pos.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in','property:scale;to:1 1 1;dur:120;easing:easeOutBack');
    e.setAttribute('animation__rise',`property:position;to:${pos.x} ${pos.y+0.66} ${pos.z};dur:700;easing:easeOutQuad`);
    e.setAttribute('animation__fade','property:opacity;to:0;dur:500;delay:180;easing:linear');
    ARENA.appendChild(e);
    setTimeout(()=>safeRemove(e), 900);
  }

  function updateHUD(){
    $('score') && ($('score').textContent=score);
    $('combo') && ($('combo').textContent=combo);
    $('acc')   && ($('acc').textContent=(accuracy||0)+'%');
    $('time')  && ($('time').textContent=timeLeft);
  }

  // ---------- spawning (เริ่มห่าง → ค่อยๆถี่) ----------
  function spawnOne(){ if(!running || paused) return; makeNote(); }
  function startSpawning(){
    clearInterval(spawnTimer);
    spawnTimer=setInterval(spawnOne, spawnInterval);

    clearInterval(accelTimer);
    accelTimer=setInterval(()=>{
      if(!running || paused) return;
      const d=DIFF[diffKey];
      const elapsed=Math.max(0,performance.now()-gameStartAt);
      const rampTime=Math.min(900,(elapsed/1000)*50);
      const comboBoost=clamp(combo*5,0,160);
      const target=Math.max(d.minSpawn,d.start-rampTime-comboBoost);
      const step=Math.max(18,d.step-12);
      spawnInterval=Math.max(target, spawnInterval-step);
      clearInterval(spawnTimer);
      spawnTimer=setInterval(spawnOne, spawnInterval);
    }, 7000);
  }
  function clearNotes(){ Array.from(ARENA.querySelectorAll('.note')).forEach(n=>safeRemove(n)); }

  function applyDiff(){
    const d=DIFF[diffKey];
    spawnInterval=d.start; judgeMul=d.judgeMul; speedMul=d.speedMul; timeLeft=d.time;
    $('diffLabel') && ($('diffLabel').textContent=diffKey.toUpperCase());
    updateHUD();
  }

  // ---------- flow ----------
  function start(){
    if(running) return;
    running=true; paused=false;
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; accuracy=0;
    applyDiff(); clearNotes(); updateHUD();

    setSong(currentSong);
    const ms=Math.max(0,currentSong.offset||0);
    setTimeout(()=>{ try{ audio.play(); }catch(_e){} }, ms);

    gameStartAt=performance.now();
    setTimeout(startSpawning, ms+1200);

    clearInterval(secondTimer);
    secondTimer=setInterval(()=>{
      if(!running || paused) return;
      timeLeft--; if(timeLeft<=0){ timeLeft=0; updateHUD(); end(); return; }
      updateHUD();
    },1000);

    $('results') && ( $('results').style.display='none' );
  }

  function end(){
    if(!running) return;
    running=false; paused=false;
    try{ audio?.pause?.(); }catch(_){}
    clearInterval(spawnTimer); clearInterval(accelTimer); clearInterval(secondTimer);

    $('rScore') && ( $('rScore').textContent=score );
    $('rMaxCombo') && ( $('rMaxCombo').textContent=maxCombo );
    $('rAcc') && ( $('rAcc').textContent=(accuracy||0)+'%' );
    $('results') && ( $('results').style.display='flex' );
  }

  // ---------- UI wiring ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    $('startBtn')?.addEventListener('click', start);
    $('pauseBtn')?.addEventListener('click', ()=>{
      if(!running) return;
      paused=!paused;
      if(paused){ try{ audio?.pause?.(); }catch(_){}
      } else { try{ audio?.play?.(); }catch(_e){} }
    });
    $('endBtn')?.addEventListener('click', end);
    $('replayBtn')?.addEventListener('click', ()=>{ $('results')&&( $('results').style.display='none' ); start(); });

    // ✅ Back to Hub ทำงานแน่นอน
    $('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });

    $('songSel')?.addEventListener('change', e=>{
      const s=SONGS.find(x=>x.id===e.target.value);
      if(s) currentSong=s;
    });
    $('speedSel')?.addEventListener('change', e=>{
      const v=e.target.value; if(DIFF[v]){ diffKey=v; applyDiff(); }
    });

    // sync ค่าเริ่มต้นใน dropdown ตาม URL diff (ถ้ามี)
    if($('speedSel')) $('speedSel').value = diffKey;
  });

  // ---------- keyboard quick play ----------
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Enter') start();
    if(e.key==='Escape') end();
    if(!running || paused) return;
    if(e.key===' ' || e.key==='f' || e.key==='j'){
      const notes=Array.from(ARENA.querySelectorAll('.note')).filter(n=>n.dataset.alive==='1');
      if(!notes.length) return;
      notes.sort((a,b)=>Math.abs(a.object3D.position.y-HIT_Y)-Math.abs(b.object3D.position.y-HIT_Y));
      tryHit(notes[0]);
      play(SFX.click);
    }
  });

  // ---------- safety ----------
  window.addEventListener('beforeunload', ()=>{
    try{ clearInterval(spawnTimer); clearInterval(accelTimer); clearInterval(secondTimer); }catch(_){}
  });

})();
