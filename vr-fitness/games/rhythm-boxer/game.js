/* games/rhythm-boxer/game.js
   Rhythm Boxer · game.js (Warmup spawn → gradually denser, wide hit window early, mouse/touch clickable, HUD, results, back-to-hub fixed)
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const $ = (id)=>document.getElementById(id);
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const after = (ms,fn)=>setTimeout(fn,ms);
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";

  // A-Frame/THREE handles
  const scene = document.querySelector('a-scene');

  // ---------- Difficulty presets (start sparse → ramp gently) ----------
  const DIFF_PRESET = {
    beginner : { start:2400, step:80,  minSpawn:900, speedMul:0.86, judgeMul:1.45 },
    standard : { start:2000, step:70,  minSpawn:720, speedMul:1.00, judgeMul:1.10 },
    challenge: { start:1700, step:60,  minSpawn:560, speedMul:1.18, judgeMul:0.95 }
  };
  let diffKey = (new URLSearchParams(location.search).get('diff')) || 'standard';
  if (!DIFF_PRESET[diffKey]) diffKey = 'standard';

  // ---------- Song config ----------
  const SONGS = [
    { id:'training', title:'Training Beat', src:'./assets/music/training.mp3', bpm:120, offset:200 },
    { id:'flow',     title:'Flow Runner',   src:'./assets/music/flow.mp3',     bpm:132, offset:160 },
    { id:'charge',   title:'Charge Up',     src:'./assets/music/charge.mp3',   bpm:145, offset:120 }
  ];
  let currentSong = SONGS[0];

  // ---------- State ----------
  let running=false, paused=false;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0;
  let accuracy=0;
  let spawnTimer=null, accelInterval=null, gameStartAt=0;
  let spawnInterval = DIFF_PRESET[diffKey].start;
  let judgeMul = DIFF_PRESET[diffKey].judgeMul;
  let speedMul = DIFF_PRESET[diffKey].speedMul;
  let audio=null;

  // ---------- Lane + Hit line ----------
  const ARENA = $('arena') || (()=>{
    const a = document.createElement('a-entity'); a.setAttribute('id','arena'); a.setAttribute('position','0 0 0');
    scene?.appendChild(a); return a;
  })();

  // hit line (glow green)
  const HIT_Y = 0.9; // world y where player should click
  (function ensureHitLine(){
    const line = document.createElement('a-plane');
    line.setAttribute('id','hitLine');
    line.setAttribute('position', `0 ${HIT_Y} -2.4`);
    line.setAttribute('width','3.2');
    line.setAttribute('height','0.02');
    line.setAttribute('material','color:#00ff88; emissive:#00ff88; emissiveIntensity:0.9; opacity:0.95; transparent:true; shader:standard');
    line.classList.add('clickable');
    ARENA.appendChild(line);
    // subtle pulse
    line.setAttribute('animation__pulse','property:scale; dir:alternate; to:1.02 1.2 1; dur:900; loop:true; easing:easeInOutSine');
  })();

  // ---------- Notes (falling) ----------
  const COLORS = ['#00d0ff','#ffd166','#ff6b6b','#9bff9b','#b07aff'];
  const SHAPES = ['a-sphere','a-box','a-octahedron'];
  const LANES_X = [-1.2,-0.4,0.4,1.2]; // 4 lanes
  const NOTE_SIZE = 0.25;
  const BASE_FALL_SPEED = 0.55; // world units per 100ms (will scale with speedMul)

  function makeNote(){
    const lane = Math.floor(Math.random()*LANES_X.length);
    const kind = Math.floor(Math.random()*SHAPES.length);
    const el = document.createElement(SHAPES[kind]);
    const color = COLORS[(Math.random()*COLORS.length)|0];

    el.classList.add('note','clickable');
    el.setAttribute('position', `${LANES_X[lane]} 2.4 -2.4`);
    el.setAttribute('color', color);
    if (SHAPES[kind]==='a-sphere') el.setAttribute('radius', NOTE_SIZE);
    if (SHAPES[kind]==='a-box') { el.setAttribute('width', NOTE_SIZE*1.2); el.setAttribute('height', NOTE_SIZE*1.2); el.setAttribute('depth', NOTE_SIZE*1.2); }
    if (SHAPES[kind]==='a-octahedron') el.setAttribute('radius', NOTE_SIZE);

    // faint glow
    el.setAttribute('material', `color:${color}; emissive:${color}; emissiveIntensity:0.4; metalness:0.2; roughness:0.4`);

    // attach runtime data
    el.dataset.lane = lane;
    el.dataset.speed = BASE_FALL_SPEED*speedMul;
    el.dataset.alive = '1';

    // click handler (mouse/touch)
    el.addEventListener('click', ()=> tryHit(el, 'mouse'));

    ARENA.appendChild(el);
    spawns++;
    return el;
  }

  // smooth movement per-frame
  AFRAME.registerSystem('rb-loop',{
    tick(){
      if (!running || paused) return;
      const now = performance.now();
      const notes = Array.from(ARENA.querySelectorAll('.note'));
      for (const n of notes){
        if (n.dataset.alive!=='1') continue;
        const p = n.object3D.position;
        const v = (+n.dataset.speed)||BASE_FALL_SPEED;
        p.y -= v*0.016; // approx per-frame @60fps

        // miss if passed hit line
        if (p.y < HIT_Y-0.18){
          n.dataset.alive = '0';
          safeRemove(n);
          registerResult('miss', p);
        }
      }
      // update HUD debug (optional)
      if (_DBG && $('debugBox')) $('debugBox').textContent = `spawn ${spawnInterval}ms, speedMul ${speedMul.toFixed(2)} combo ${combo} score ${score}`;
    }
  });

  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_e){} }

  // ---------- Hit detection ----------
  function tryHit(note, method){
    if (!note || note.dataset.alive!=='1') return;
    const py = note.object3D.position.y;
    const lane = +note.dataset.lane;

    // time window (wider on beginner/early)
    const baseWin = 0.16 * judgeMul;  // GOOD ±win, PERFECT tighter
    const perfWin = 0.08 * judgeMul;

    const dy = Math.abs(py - HIT_Y);
    let rank = null;
    if (dy <= perfWin) rank = 'perfect';
    else if (dy <= baseWin) rank = 'good';

    if (!rank) return; // too far from hit line

    // success → remove & score
    note.dataset.alive = '0';
    const pos = note.object3D.getWorldPosition(new THREE.Vector3());
    safeRemove(note);
    registerResult(rank, pos);
  }

  // allow clicking on the hit line area (raycast)
  (function installPointerRaycast(){
    if (!scene || !THREE) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function pick(clientX, clientY){
      const cam = scene.camera; if (!cam) return;
      mouse.x =  (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, cam);

      const objs = [];
      const clickable = Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      clickable.forEach(o=>o.traverse(child=>objs.push(child)));
      const hits = raycaster.intersectObjects(objs,true);
      if (hits && hits.length){
        let obj = hits[0].object;
        while (obj && !obj.el) obj = obj.parent;
        obj?.el?.emit('click');
      }
    }
    window.addEventListener('mousedown', e=>pick(e.clientX,e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{ const t=e.touches?.[0]; if(t) pick(t.clientX,t.clientY); }, {passive:true});
  })();

  // ---------- Scoring / SFX / HUD ----------
  const SFX = {
    good: new Audio('./assets/sfx/good.wav'),
    perfect: new Audio('./assets/sfx/perfect.wav'),
    miss: new Audio('./assets/sfx/miss.wav'),
    combo: new Audio('./assets/sfx/combo.wav'),
    click: new Audio('./assets/sfx/click.wav'),
  };
  function play(a){ try{ a.currentTime=0; a.play(); }catch(_e){} }

  function floatText(text,color,pos){
    const e=document.createElement('a-entity');
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${pos.x} ${pos.y+0.18} ${pos.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in','property:scale;to:1 1 1;dur:120;easing:easeOutBack');
    e.setAttribute('animation__rise',`property:position;to:${pos.x} ${pos.y+0.6} ${pos.z};dur:700;easing:easeOutQuad`);
    e.setAttribute('animation__fade','property:opacity;to:0;dur:500;delay:180;easing:linear');
    ARENA.appendChild(e);
    after(900, ()=>safeRemove(e));
  }

  function registerResult(kind, pos){
    if (kind==='miss'){
      combo=0;
      play(SFX.miss);
      floatText('MISS','#ff5577', pos||new THREE.Vector3(0,HIT_Y,-2.4));
      updateHUD();
      return;
    }
    hits++;
    combo++;
    if (combo>maxCombo) maxCombo=combo;

    let add=0;
    if (kind==='perfect'){ add=30; play(SFX.perfect); floatText('PERFECT','#00ffa3', pos); }
    else { add=18; play(SFX.good); floatText('GOOD','#00d0ff', pos); }

    score += add + Math.floor(combo*0.8);
    accuracy = spawns ? Math.round( (hits/spawns) * 100 ) : 0;

    if (combo>0 && combo%10===0) play(SFX.combo);
    updateHUD();
  }

  function updateHUD(){
    $('score') && ( $('score').textContent = score );
    $('combo') && ( $('combo').textContent = combo );
    $('acc')   && ( $('acc').textContent   = (accuracy||0)+'%' );
  }

  // ---------- Spawning control (warmup → adaptive densify) ----------
  function spawnOne(){ if (!running || paused) return; makeNote(); }

  function startSpawning(){
    clearInterval(spawnTimer);
    spawnTimer = setInterval(spawnOne, spawnInterval);

    clearInterval(accelInterval);
    accelInterval = setInterval(()=>{
      if (!running || paused) return;
      applyAdaptiveInterval();
    }, 7000); // every 7s: small nudge
  }

  function applyAdaptiveInterval(){
    const d = DIFF_PRESET[diffKey] || DIFF_PRESET.standard;
    const elapsed = Math.max(0, performance.now() - gameStartAt);

    const rampTime = Math.min(700, (elapsed/1000) * 40); // softer ramp by time
    const comboNudge = clamp(combo * 6, 0, 180);         // gentle combo effect
    const target = Math.max(d.minSpawn, d.start - rampTime - comboNudge);

    const step = Math.max(20, d.step - 10);
    spawnInterval = Math.max(target, spawnInterval - step);

    clearInterval(spawnTimer);
    spawnTimer = setInterval(spawnOne, spawnInterval);
  }

  // ---------- Game flow ----------
  function makeSongAudio(src){
    try{ audio?.pause?.(); }catch(_){}
    audio = new Audio(src);
    audio.loop = false;
  }

  function clearNotes(){
    Array.from(ARENA.querySelectorAll('.note')).forEach(n=>safeRemove(n));
  }

  function applyDiff(){
    const d = DIFF_PRESET[diffKey] || DIFF_PRESET.standard;
    spawnInterval = d.start;
    judgeMul = d.judgeMul;
    speedMul = d.speedMul;
    $('diffLabel') && ( $('diffLabel').textContent = diffKey.toUpperCase() );
  }

  function start(){
    if (running) return;
    running = true; paused=false;
    applyDiff();
    clearNotes();
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; accuracy=0;
    updateHUD();

    // music
    makeSongAudio(currentSong.src);
    const musicDelay = Math.max(0, currentSong.offset||0);
    after(musicDelay, ()=>{ try{ audio.play(); }catch(_e){} });

    // warmup before spawn
    gameStartAt = performance.now();
    const WARMUP_MS = 1400;
    after(musicDelay + WARMUP_MS, startSpawning);
  }

  function stopToResult(){
    running=false; paused=false;
    clearInterval(spawnTimer); clearInterval(accelInterval);
    try{ audio?.pause?.(); }catch(_){}
    $('results') && ( $('results').style.display='flex' );
    $('rScore') && ( $('rScore').textContent = score );
    $('rMaxCombo') && ( $('rMaxCombo').textContent = maxCombo );
    $('rAcc') && ( $('rAcc').textContent = (accuracy||0)+'%' );
  }

  function end(){ stopToResult(); }

  // ---------- UI wiring ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    $('startBtn')?.addEventListener('click', start);
    $('pauseBtn')?.addEventListener('click', ()=>{
      if (!running) return;
      paused = !paused;
      if (paused){ try{ audio?.pause?.(); }catch(_){}; }
      else { try{ audio?.play?.(); }catch(_){}; }
    });
    $('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });
    $('replayBtn')?.addEventListener('click', ()=>{ $('results')&&( $('results').style.display='none'); start(); });

    // song selector (if exists)
    $('songSel')?.addEventListener('change', e=>{
      const id = e.target.value;
      const s = SONGS.find(x=>x.id===id);
      if (s) currentSong = s;
    });
    // diff selector (if exists)
    $('speedSel')?.addEventListener('change', e=>{
      const v = e.target.value;
      if (DIFF_PRESET[v]) diffKey = v;
    });

    // ensure result overlay hide at load
    $('results') && ( $('results').style.display='none' );

    // (optional) debug widget
    const dbg = document.createElement('div');
    dbg.id='debugBox';
    Object.assign(dbg.style,{position:'fixed',right:'8px',top:'8px',padding:'6px 8px',background:'rgba(0,0,0,.35)',color:'#e6f7ff',font:'600 12px system-ui',borderRadius:'8px',pointerEvents:'none',zIndex:9999,display:'none'});
    document.body.appendChild(dbg);
  });

  // ---------- Keyboard fallback ----------
  document.addEventListener('keydown', (e)=>{
    if (!running || paused) return;
    if (e.key===' ' || e.key==='f' || e.key==='j'){
      // pick nearest note around hit line in any lane
      const notes = Array.from(ARENA.querySelectorAll('.note')).filter(n=>n.dataset.alive==='1');
      if (!notes.length) return;
      notes.sort((a,b)=>{
        const da = Math.abs(a.object3D.position.y - HIT_Y);
        const db = Math.abs(b.object3D.position.y - HIT_Y);
        return da-db;
      });
      tryHit(notes[0], 'key');
      play(SFX.click);
    }
    if (e.key==='Escape'){ end(); }
  });

  // ---------- Safety ----------
  window.addEventListener('beforeunload', ()=>{
    try{ clearInterval(spawnTimer); clearInterval(accelInterval); }catch(_){}
  });

  // ---------- Debug toggle ----------
  let _DBG=false;
  document.addEventListener('keydown', e=>{
    if (e.key==='`'){ _DBG=!_DBG; if ($('debugBox')) $('debugBox').style.display=_DBG?'block':'none'; }
  });

})();
