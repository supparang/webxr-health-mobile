/* games/rhythm-boxer/game.js
   Rhythm Boxer · game.js (Hit-Assist + Wider Timing Window + Multi-Color Notes + Lane/Hit Lines)
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const getQ=(k)=>new URLSearchParams(location.search).get(k);
  const ASSET_BASE=(document.querySelector('meta[name="asset-base"]')?.content||'').replace(/\/+$/,'');
  const HUB_URL = `${location.origin}/webxr-health-mobile/vr-fitness/`;

  // Safe remove to avoid "removeChild of null"
  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_){} }

  // ---------- Audio ----------
  const SFX = {
    hitP:  new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    hitG:  new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    assist:new Audio(`${ASSET_BASE}/assets/sfx/laser.wav`),
    miss:  new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo: new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui:    new Audio(`${ASSET_BASE}/assets/sfx/success.wav`)
  };
  Object.values(SFX).forEach(a=>a.onerror=()=>{ /* ignore missing */ });

  // ---------- Difficulty / Speed profiles ----------
  const SPEEDS = {
    beginner: { baseSpeed: 0.42, accel: 0.00012,  window: 0.26, perfect: 0.12, assistLaneTol: 1, assistWindow: 0.32 },
    standard: { baseSpeed: 0.56, accel: 0.00018,  window: 0.22, perfect: 0.10, assistLaneTol: 1, assistWindow: 0.28 },
    challenge:{ baseSpeed: 0.72, accel: 0.00024,  window: 0.18, perfect: 0.08, assistLaneTol: 1, assistWindow: 0.24 }
  };
  function getSpeedKey(){
    const q=getQ('speed')||getQ('diff'); // allow ?diff=
    const ls=localStorage.getItem('rb_speed');
    const story=window.APP?.story?.difficulty;
    const key=(q||ls||story||'standard').toLowerCase();
    return (key==='beginner'||key==='challenge')?key:'standard';
  }
  let CFG=SPEEDS.standard;

  // ---------- Scene constants ----------
  const LANES = [ -0.8, 0, 0.8 ];  // x-positions
  const SPAWN_Y = 2.2;
  const HIT_Y   = 0.95;            // where to hit
  const MISS_Y  = 0.72;            // lower than this without hit => miss
  const Z_POS   = -2.2;

  // Note visuals
  const NOTE_COLORS = ['#11e1ff','#00ffa3','#ffd166','#ff6b6b','#a899ff','#8cf5ff'];
  const SHAPES = ['a-sphere','a-box','a-tetrahedron']; // rotate for variety

  // ---------- Game state ----------
  let running=false, paused=false, rafId=0, startT=0;
  let notes=[];         // { lane, y, speed, el, bornAt, color }
  let score=0, combo=0, maxCombo=0, hitCount=0, missCount=0, spawned=0;
  let speedMul=1;

  // ---------- HUD ----------
  function updateHUD(){
    byId('rbScore')?.setAttribute('value', `Score: ${score}`);
    byId('rbCombo')?.setAttribute('value', `Combo: ${combo}`);
  }
  function flashHitLine(kind){
    const hl=byId('rbHitLine');
    if(!hl) return;
    const c = kind==='perfect' ? '#00ffa3' : (kind==='assist' ? '#9bd1ff' : '#ffd166');
    hl.setAttribute('material',`color:${c};opacity:0.95;emissive:${c};emissiveIntensity:0.6;shader:standard;transparent:true`);
    clearTimeout(hl._t);
    hl._t=setTimeout(()=>{
      hl.setAttribute('material','color:#21d07a;opacity:0.85;emissive:#21d07a;emissiveIntensity:0.45;shader:standard;transparent:true');
    },120);
  }

  // ---------- Build static lane / hit lines ----------
  function buildRails(){
    const arena=byId('arena'); if(!arena) return;

    // Clear previous rails
    ['rbLane0','rbLane1','rbLane2','rbHitLine','rbHUDScore','rbHUDCombo'].forEach(id=>{
      const el=byId(id); if(el) safeRemove(el);
    });

    // Lane guideline lines (faint)
    LANES.forEach((x,i)=>{
      const line=document.createElement('a-entity'); line.id=`rbLane${i}`;
      line.setAttribute('geometry','primitive: box; width: 0.04; height: 2.0; depth: 0.01');
      line.setAttribute('material','color:#0e2233;opacity:0.35;transparent:true');
      line.setAttribute('position',`${x} ${(SPAWN_Y+MISS_Y)/2} ${Z_POS}`);
      arena.appendChild(line);
    });

    // Glowing HIT LINE (green)
    const hit=document.createElement('a-entity'); hit.id='rbHitLine';
    hit.setAttribute('geometry','primitive: box; width: 2.6; height: 0.03; depth: 0.01');
    hit.setAttribute('material','color:#21d07a;opacity:0.85;emissive:#21d07a;emissiveIntensity:0.45;shader:standard;transparent:true');
    hit.setAttribute('position',`0 ${HIT_Y} ${Z_POS}`);
    byId('arena').appendChild(hit);

    // HUD (A-Frame text soไม่โดน DOM บัง)
    const hudScore=document.createElement('a-entity');
    hudScore.id='rbHUDScore';
    hudScore.setAttribute('text',{value:'Score: 0', color:'#e6f7ff', align:'right', width:3.6});
    hudScore.setAttribute('position',`1.35 2.25 ${Z_POS}`);
    arena.appendChild(hudScore);

    const hudCombo=document.createElement('a-entity');
    hudCombo.id='rbHUDCombo';
    hudCombo.setAttribute('text',{value:'Combo: 0', color:'#e6f7ff', align:'right', width:3.6});
    hudCombo.setAttribute('position',`1.35 2.05 ${Z_POS}`);
    arena.appendChild(hudCombo);

    // Map HUD ids for easy update
    hudScore.setAttribute('id','rbScore');
    hudCombo.setAttribute('id','rbCombo');
  }

  // ---------- Spawning ----------
  function spawnNote(){
    const lane = Math.floor(Math.random()*LANES.length);
    const shape = SHAPES[Math.floor(Math.random()*SHAPES.length)];
    const color = NOTE_COLORS[Math.floor(Math.random()*NOTE_COLORS.length)];

    const el=document.createElement(shape);
    el.setAttribute('position',`${LANES[lane]} ${SPAWN_Y} ${Z_POS}`);
    el.setAttribute('scale','0.22 0.22 0.22');
    el.setAttribute('material',`color:${color};emissive:${color};emissiveIntensity:0.25;metalness:0.1;roughness:0.8`);
    el.classList.add('rb-note','clickable');
    if(shape!=='a-sphere'){
      // rotate non-sphere for visual flair
      el.setAttribute('animation__rot','property: rotation; to: 0 360 0; loop: true; dur: 2600; easing: linear');
    }
    byId('arena').appendChild(el);

    const speed = CFG.baseSpeed * speedMul; // world units per second (y-axis downward)
    notes.push({lane, y:SPAWN_Y, speed, el, bornAt:performance.now(), color});
    spawned++;
  }

  // ---------- Judge ----------
  function judgeHit(inputLane){
    if(!running || paused) return;

    // find closest note by |y - HIT_Y| within main window in preferred lane
    let best=null, bestDy=Infinity, bestIdx=-1, bestLaneDiff=Infinity, bestKind='';

    const now=performance.now();
    for(let i=0;i<notes.length;i++){
      const n=notes[i];
      // skip already below miss line or too high
      if(n.y < MISS_Y-0.05 || n.y > SPAWN_Y+0.05) continue;

      const dy = Math.abs(n.y - HIT_Y);
      const laneDiff = Math.abs(n.lane - inputLane);

      // perfect/good in same lane
      if(laneDiff===0 && dy <= CFG.window){
        if(dy<bestDy){ best=n; bestDy=dy; bestIdx=i; bestLaneDiff=0; bestKind = (dy<=CFG.perfect?'perfect':'good'); }
      }

      // assist: adjacent lane within a slightly larger window
      if(laneDiff>0 && laneDiff<=CFG.assistLaneTol && dy <= CFG.assistWindow){
        // prefer same-lane matches; else allow assist if no better found
        if(bestLaneDiff>0){ // only if not already found same-lane candidate
          if(dy<bestDy){ best=n; bestDy=dy; bestIdx=i; bestLaneDiff=laneDiff; bestKind='assist'; }
        }
      }
    }

    if(best){
      // score
      let add=0;
      if(bestKind==='perfect'){ add=120; SFX.hitP.play().catch(()=>{}); combo+=1; }
      else if(bestKind==='good'){ add=80; SFX.hitG.play().catch(()=>{}); combo+=1; }
      else { add=60; SFX.assist.play().catch(()=>{}); combo=Math.max(0, combo+1); }

      if(combo>0 && combo%10===0){ try{ SFX.combo.play(); }catch(_){ } }

      score += add + Math.floor(combo*1.5);
      hitCount++;
      updateHUD();
      flashHitLine(bestKind);

      // pop animation + remove
      best.el.setAttribute('animation__out','property: scale; to: 0.001 0.001 0.001; dur: 100; easing: easeInBack');
      const rm=best.el; setTimeout(()=>safeRemove(rm), 110);
      notes.splice(bestIdx,1);
    }else{
      // whiff
      combo=0;
      updateHUD();
      try{ SFX.miss.play(); }catch(_){}
      flashHitLine('miss');
    }
  }

  // ---------- Loop ----------
  function tick(){
    const now=performance.now();
    const dt = Math.min(0.05, (now - startT)/1000); // clamp large dt
    startT = now;
    if(!running || paused){ rafId=requestAnimationFrame(tick); return; }

    // mild acceleration over time
    speedMul += CFG.accel;

    // move notes
    for(let i=notes.length-1;i>=0;i--){
      const n=notes[i];
      n.y -= n.speed * dt;
      if(n.el?.object3D) n.el.object3D.position.y = n.y;

      // miss check
      if(n.y <= MISS_Y){
        // missed
        try{ SFX.miss.play(); }catch(_){}
        missCount++;
        combo=0;
        updateHUD();
        safeRemove(n.el);
        notes.splice(i,1);
      }
    }

    // basic spawn pacing: every ~380–520ms depending on speed
    spawnBudget+=dt;
    const spawnInt = clamp(0.42 - (speedMul-1)*0.08, 0.24, 0.50); // seconds
    while(spawnBudget >= spawnInt){
      spawnBudget -= spawnInt;
      spawnNote();
    }

    rafId=requestAnimationFrame(tick);
  }
  let spawnBudget=0;

  // ---------- Controls ----------
  const laneFromX = x=>{
    const w = window.innerWidth;
    const seg = w/3;
    if(x<seg) return 0;
    if(x<2*seg) return 1;
    return 2;
  };
  function bindInput(){
    window.addEventListener('mousedown', e=>judgeHit(laneFromX(e.clientX)), {passive:true});
    window.addEventListener('touchstart', e=>{
      const t=e.touches?.[0]; if(!t) return;
      judgeHit(laneFromX(t.clientX));
    }, {passive:true});

    // Keyboard (A / S / D)
    window.addEventListener('keydown', e=>{
      if(e.repeat) return;
      if(e.key==='a'||e.key==='A') judgeHit(0);
      if(e.key==='s'||e.key==='S') judgeHit(1);
      if(e.key==='d'||e.key==='D') judgeHit(2);
      if(e.key===' ') judgeHit(1);
    });
  }

  // ---------- Game flow ----------
  function start(){
    if(running) return;
    // read speed profile
    const k=getSpeedKey();
    CFG = SPEEDS[k] || SPEEDS.standard;
    localStorage.setItem('rb_speed', k);

    // Reset
    notes.forEach(n=>safeRemove(n.el)); notes.length=0;
    score=0; combo=0; maxCombo=0; hitCount=0; missCount=0; spawned=0;
    speedMul=1; spawnBudget=0;
    updateHUD();

    // UI states
    const res=byId('rbResults'); if(res) res.style.display='none';

    running=true; paused=false;
    SFX.ui.play?.();
  }
  function pauseToggle(){
    if(!running) return;
    paused=!paused;
    // small UI ping via hitline color
    flashHitLine(paused ? 'miss' : 'good');
  }
  function end(){
    running=false; paused=false;
    // show results overlay (DOM)
    const el=byId('rbResults');
    if(el){
      byId('rbFinalScore').textContent = score;
      byId('rbFinalAcc').textContent   = spawned? Math.round(hitCount/spawned*100)+'%' : '0%';
      el.style.display='flex';
    }
  }

  // ---------- Buttons (DOM) ----------
  function wireButtons(){
    byId('rbStartBtn')?.addEventListener('click', ()=>{ start(); }, {passive:true});
    byId('rbPauseBtn')?.addEventListener('click', ()=>{ pauseToggle(); }, {passive:true});
    byId('rbBackBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; }, {passive:true});

    // speed dropdown (if exists)
    const sel=byId('rbSpeedSel');
    if(sel){
      sel.value = getSpeedKey();
      sel.addEventListener('change', e=>{
        try{ localStorage.setItem('rb_speed', e.target.value); }catch(_){}
        // quick restart to apply speed
        start();
      }, {passive:true});
    }
  }

  // ---------- Boot ----------
  function ensureScene(){
    let tries=0;
    (function wait(){
      const sc=document.querySelector('a-scene');
      if(window.AFRAME && sc){
        buildRails();
        bindInput();
        wireButtons();
        startT=performance.now();
        rafId=requestAnimationFrame(tick);
        return;
      }
      tries++;
      if(tries>240){
        const msg='A-Frame scene not found. Check scripts/CORS/paths and reload.';
        console.error(msg);
        const o=document.createElement('div');
        Object.assign(o.style,{position:'fixed',inset:'0',display:'grid',placeItems:'center',
          background:'#0b1118',color:'#ffb4b4',zIndex:99999,font:'14px/1.5 system-ui'});
        o.innerHTML=`<div style="max-width:720px;padding:20px;text-align:center"><h2>⚠️ JS Error</h2><pre>${msg}</pre></div>`;
        document.body.appendChild(o);
        return;
      }
      requestAnimationFrame(wait);
    })();
  }

  // Expose minimal API (optional)
  window.RB = { start, pause:pauseToggle, end,
    setSpeed:(k)=>{ if(SPEEDS[k]){ localStorage.setItem('rb_speed',k); } }
  };

  // Auto end after a song-length (e.g., 95s) if index.html doesn't manage it
  setTimeout(()=>{ if(running) end(); }, 95000);

  document.addEventListener('DOMContentLoaded', ensureScene, {once:true});

})();
