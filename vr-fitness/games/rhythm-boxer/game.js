/* games/rhythm-boxer/game.js
   Rhythm Boxer · game.js (Lane Lines + Falling Notes + Click/Touch/Mouse Raycast + Difficulty + Proper Back URL)
   Requirements: A-Frame 1.5+ and <meta name="asset-base" content="/webxr-health-mobile/vr-fitness">
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '/webxr-health-mobile/vr-fitness').replace(/\/+$/,'');
  const HUB_URL = 'https://supparang.github.io/webxr-health-mobile/vr-fitness';

  // safe remove (prevents removeChild on null)
  function safeRemove(el){
    try{
      if(!el) return;
      if(el.parentNode) el.parentNode.removeChild(el);
      else if(el.remove) el.remove();
    }catch(_){}
  }

  // UI ping
  function toast(msg,color='#00ffa3'){
    let t = $('rb_toast');
    if(!t){
      t = document.createElement('div'); t.id='rb_toast';
      Object.assign(t.style,{
        position:'fixed', left:'50%', top:'16px', transform:'translateX(-50%)',
        background:'rgba(8,12,18,.9)', color:'#e6f7ff', padding:'8px 12px',
        borderRadius:'10px', font:'600 13px system-ui', zIndex:9999, letterSpacing:'.2px',
        border:'1px solid rgba(255,255,255,.08)', opacity:'0', transition:'opacity .15s, transform .15s'
      });
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.color=color;
    t.style.opacity='1'; t.style.transform='translateX(-50%) scale(1.02)';
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(-50%)'; }, 900);
  }

  // ---------- Audio ----------
  const SFX = {
    hit: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    good: new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    miss: new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo: new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    start: new Audio(`${ASSET_BASE}/assets/sfx/success.wav`)
  };
  Object.values(SFX).forEach(a=>{ a.preload='auto'; a.onerror=()=>{}; });

  // ---------- Game Space ----------
  const LANE_X = [-0.9, 0, 0.9];
  const LANE_Z = -2.21;
  const HIT_Y = 1.05;
  const NOTE_SIZE = 0.16;

  // Difficulty Packs (speed ramp & density)
  const DIFFS = {
    beginner: { name:'BEGINNER', baseSpeed:0.55, accel:0.00035, window:0.19, spawnMin:620, spawnMax:760 },
    standard: { name:'STANDARD', baseSpeed:0.82, accel:0.00055, window:0.16, spawnMin:520, spawnMax:680 },
    challenge:{ name:'CHALLENGE', baseSpeed:1.05, accel:0.00085, window:0.12, spawnMin:440, spawnMax:580 }
  };
  let DIFF = DIFFS.standard;

  // ---------- State ----------
  let running=false, paused=false, over=false;
  let t0=0, lastTick=0;
  let spawnTimer=null;
  let speed=0.8;      // current falling speed (units/sec)
  let score=0, combo=0, maxCombo=0, total=0, hitCount=0;
  let timeLeft=60;

  // notes: {el, lane, y, speed}
  const notes=[];

  // ---------- HUD ----------
  function hudUpdate(){
    $('rb_score') && ($('rb_score').textContent = score);
    $('rb_combo') && ($('rb_combo').textContent = combo);
    $('rb_time') && ($('rb_time').textContent = timeLeft);
    $('rb_diff') && ($('rb_diff').textContent = DIFF.name);
  }

  // ---------- Lanes ----------
  function createLanes(){
    const arena = $('arena');
    if(!arena) return;

    // clear old
    Array.from(arena.querySelectorAll('.rb-lane,.rb-hitline,.rb-lbl')).forEach(safeRemove);

    // vertical lanes
    LANE_X.forEach(x=>{
      const lane = document.createElement('a-box');
      lane.classList.add('rb-lane');
      lane.setAttribute('width', 0.02);
      lane.setAttribute('height', 2.6);
      lane.setAttribute('depth', 0.01);
      lane.setAttribute('color', '#224055');
      lane.setAttribute('opacity', 0.42);
      lane.setAttribute('position', `${x} 1.5 ${LANE_Z}`);
      arena.appendChild(lane);
    });

    // hit line
    const hit = document.createElement('a-box');
    hit.classList.add('rb-hitline');
    hit.setAttribute('width', 3.0);
    hit.setAttribute('height', 0.03);
    hit.setAttribute('depth', 0.01);
    hit.setAttribute('color', '#00ffa3');
    hit.setAttribute('opacity', 0.85);
    hit.setAttribute('position', `0 ${HIT_Y} ${LANE_Z}`);
    arena.appendChild(hit);

    // label
    const txt = document.createElement('a-entity');
    txt.classList.add('rb-lbl');
    txt.setAttribute('text',{value:'HIT LINE',color:'#00ffa3',align:'center',width:3});
    txt.setAttribute('position',`0 ${HIT_Y+0.1} ${LANE_Z}`);
    arena.appendChild(txt);
  }

  // ---------- Notes ----------
  function spawnNote(){
    if(!running || paused) return;
    const arena = $('arena'); if(!arena) return;

    const lane = Math.floor(Math.random()*LANE_X.length);
    const el = document.createElement('a-sphere');
    el.classList.add('rb-note','clickable');
    el.setAttribute('radius', NOTE_SIZE);
    el.setAttribute('color', '#5de1ff');
    el.setAttribute('position', `${LANE_X[lane]} ${HIT_Y+1.8} ${LANE_Z}`);
    el.setAttribute('opacity', 0.95);
    arena.appendChild(el);

    const n = { el, lane, y: HIT_Y+1.8, speed: speed };
    notes.push(n);
    total++;

    // auto-despawn safety
    setTimeout(()=>{ if(n.el && n.y>HIT_Y+0.5){ // still far above hitline → considered missed (stuck)
      registerHit('miss', n, true);
    } }, 6000);
  }

  function clearNotes(){
    while(notes.length){
      const n = notes.pop();
      safeRemove(n.el);
    }
  }

  // ---------- Scoring ----------
  function registerHit(kind, noteObj, fromTimeout=false){
    // remove entity
    if(noteObj?.el){ safeRemove(noteObj.el); noteObj.el = null; }

    if(kind==='miss'){
      combo=0; SFX.miss.currentTime=0; SFX.miss.play().catch(()=>{});
      if(!fromTimeout) feedback('MISS','#ff5577');
    }else{
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      if(combo>0 && combo%10===0){ try{SFX.combo.currentTime=0; SFX.combo.play();}catch(_){} }
      const add = (kind==='perfect'? 100 : 50);
      score += add;
      if(kind==='perfect'){ SFX.hit.currentTime=0; SFX.hit.play().catch(()=>{}); feedback('PERFECT','#00ffa3'); }
      else { SFX.good.currentTime=0; SFX.good.play().catch(()=>{}); feedback('GOOD','#9bd1ff'); }
      hitCount++;
    }
    // remove from list
    const idx = notes.indexOf(noteObj);
    if(idx>-1) notes.splice(idx,1);

    hudUpdate();
  }

  function feedback(text,color){
    const arena = $('arena'); if(!arena) return;
    const e = document.createElement('a-entity');
    e.setAttribute('text',{value:text, color, align:'center', width:2.5});
    e.setAttribute('position', `0 ${HIT_Y+0.35} ${LANE_Z}`);
    e.setAttribute('scale', '0.001 0.001 0.001');
    e.setAttribute('animation__in','property: scale; to: 1 1 1; dur: 100; easing: easeOutBack');
    e.setAttribute('animation__rise',`property: position; to: 0 ${HIT_Y+0.6} ${LANE_Z}; dur: 520; easing: easeOutQuad`);
    e.setAttribute('animation__fade','property: opacity; to: 0; dur: 400; delay: 160; easing: linear');
    arena.appendChild(e);
    setTimeout(()=>safeRemove(e), 700);
  }

  // hit detection on click / key: choose nearest note in that lane around HIT_Y
  function judgeHit(lane){
    if(!running || paused) return;
    // find nearest note in lane
    let best=null, bestDy=1e9;
    for(const n of notes){
      if(!n.el) continue;
      if(n.lane!==lane) continue;
      const dy = Math.abs(n.y - HIT_Y);
      if(dy < bestDy){ best=n; bestDy=dy; }
    }
    if(!best){ registerGhost(lane); return; }
    // within window?
    const w = DIFF.window;
    if(bestDy <= w*0.5) registerHit('perfect', best);
    else if(bestDy <= w) registerHit('good', best);
    else registerHit('miss', best);
  }

  function registerGhost(lane){
    // small visual on hitline to show input even if no note
    const arena = $('arena'); if(!arena) return;
    const e = document.createElement('a-entity');
    e.setAttribute('geometry','primitive: circle; radius: 0.08');
    e.setAttribute('material','color: #ffffff; opacity: 0.3; side: double');
    e.setAttribute('position', `${LANE_X[lane]} ${HIT_Y} ${LANE_Z+0.005}`);
    arena.appendChild(e);
    setTimeout(()=>safeRemove(e), 120);
  }

  // ---------- Loop ----------
  function tick(now){
    if(!running || paused) return;
    if(!lastTick) lastTick=now;
    const dt = Math.min(0.04, (now-lastTick)/1000); // clamp
    lastTick = now;

    // fall
    for(let i=notes.length-1;i>=0;i--){
      const n = notes[i];
      if(!n.el) continue;
      n.y -= n.speed*dt;
      n.el.setAttribute('position', `${LANE_X[n.lane]} ${n.y.toFixed(3)} ${LANE_Z}`);
      if(n.y <= HIT_Y - 0.18){ // missed below line
        registerHit('miss', n, true);
      }
    }

    // speed ramp
    speed += DIFF.accel;

    requestAnimationFrame(tick);
  }

  // ---------- Game Flow ----------
  let timer=null;
  function startGame(){
    if(running) return;
    running=true; paused=false; over=false;
    score=0; combo=0; maxCombo=0; total=0; hitCount=0; speed=DIFF.baseSpeed; timeLeft=60;
    hudUpdate();
    clearNotes();
    createLanes();
    toast(`Start · ${DIFF.name}`);

    try{ SFX.start.currentTime=0; SFX.start.play(); }catch(_){}
    t0=performance.now(); lastTick=0; requestAnimationFrame(tick);

    // spawner
    const jitter = ()=> Math.floor(DIFF.spawnMin + Math.random()*(DIFF.spawnMax-DIFF.spawnMin));
    spawnTimer = setInterval(spawnNote, jitter());
    // keep spawner fresh
    setInterval(()=>{
      if(!running || paused) return;
      clearInterval(spawnTimer);
      spawnTimer = setInterval(spawnNote, jitter());
    }, 4000);

    timer = setInterval(()=>{
      if(paused) return;
      timeLeft--; hudUpdate();
      if(timeLeft<=0) endGame();
    }, 1000);
  }

  function pauseGame(){
    if(!running || over) return;
    paused = !paused;
    toast(paused?'PAUSED':'RESUME', paused?'#ffd166':'#00ffa3');
  }

  function endGame(){
    if(!running) return;
    running=false; over=true; paused=false;
    clearInterval(timer); timer=null;
    clearInterval(spawnTimer); spawnTimer=null;

    const acc = total? Math.round((hitCount/total)*100) : 0;
    const star = (combo>=30?1:0) + (acc>=80?1:0) + (score>=2000?1:0);

    // Results overlay
    let panel = $('rb_results');
    if(!panel){
      panel = document.createElement('section'); panel.id='rb_results';
      Object.assign(panel.style,{
        position:'fixed', inset:'0', display:'grid', placeItems:'center',
        background:'rgba(0,0,0,.6)', color:'#e6f7ff', zIndex:9998
      });
      panel.innerHTML = `
        <div class="card" style="min-width:300px;background:#0b1118;border:1px solid #203446;border-radius:12px;padding:14px 16px">
          <h3 style="margin:0 0 8px">RESULTS</h3>
          <div>Mode: <b id="rb_rdiff"></b></div>
          <div>Score: <b id="rb_rscore"></b></div>
          <div>Max Combo: <b id="rb_rcombo"></b></div>
          <div>Accuracy: <b id="rb_racc"></b></div>
          <div>Stars: <b id="rb_rstars"></b></div>
          <div style="margin-top:10px; display:flex; gap:8px">
            <button class="btn" id="rb_replay">Replay</button>
            <button class="btn" id="rb_back">Back to Hub</button>
          </div>
        </div>`;
      document.body.appendChild(panel);
      // buttons
      panel.querySelector('#rb_replay').addEventListener('click', ()=>{
        panel.style.display='none';
        startGame();
      });
      panel.querySelector('#rb_back').addEventListener('click', ()=>{
        window.location.href = HUB_URL; // ✅ correct hub URL
      });
    }
    panel.querySelector('#rb_rdiff').textContent = DIFF.name;
    panel.querySelector('#rb_rscore').textContent = score;
    panel.querySelector('#rb_rcombo').textContent = maxCombo;
    panel.querySelector('#rb_racc').textContent = acc+'%';
    panel.querySelector('#rb_rstars').textContent = '★'.repeat(star)+'☆'.repeat(3-star);
    panel.style.display='grid';
    toast('Finished');
  }

  // ---------- Input ----------
  // onscreen buttons (if present in HTML)
  document.addEventListener('DOMContentLoaded', ()=>{
    $('startBtn')?.addEventListener('click', startGame);
    $('pauseBtn')?.addEventListener('click', pauseGame);
    $('backBtn')?.addEventListener('click', ()=> window.location.href = HUB_URL); // ✅ fix to hub

    // difficulty dropdown (if present)
    $('rb_diff_sel')?.addEventListener('change', (e)=>{
      const v = (e.target.value||'standard').toLowerCase();
      DIFF = DIFFS[v] || DIFFS.standard;
      localStorage.setItem('rb_diff', v);
      toast(`Mode: ${DIFF.name}`);
      hudUpdate();
    });

    // restore diff
    const saved = localStorage.getItem('rb_diff');
    if(saved && DIFFS[saved]){ DIFF = DIFFS[saved]; $('rb_diff_sel') && ($('rb_diff_sel').value=saved); }
    hudUpdate();
  });

  // keyboard: A (left) S (mid) D (right), arrows, space=start, P=pause
  document.addEventListener('keydown', (e)=>{
    if(e.repeat) return;
    if(e.key===' '){ startGame(); return; }
    if(e.key==='p' || e.key==='P'){ pauseGame(); return; }
    if(e.key==='a' || e.key==='A' || e.key==='ArrowLeft'){ judgeHit(0); return; }
    if(e.key==='s' || e.key==='S' || e.key==='ArrowDown'){ judgeHit(1); return; }
    if(e.key==='d' || e.key==='D' || e.key==='ArrowRight'){ judgeHit(2); return; }
  });

  // Mouse/Touch raycast → choose lane by x
  (function installPointer(){
    const scene = document.querySelector('a-scene');
    if(!scene) return;
    function laneFromClient(x){
      const w = window.innerWidth;
      const seg = w/3;
      if(x<seg) return 0;
      if(x<2*seg) return 1;
      return 2;
    }
    window.addEventListener('mousedown', e=> judgeHit(laneFromClient(e.clientX)), {passive:true});
    window.addEventListener('touchstart', e=>{
      const t = e.touches[0]; if(!t) return;
      judgeHit(laneFromClient(t.clientX));
    }, {passive:true});
  })();

  // Timer cleanup on unload
  window.addEventListener('beforeunload', ()=>{
    try{ clearInterval(timer); }catch(_){}
    try{ clearInterval(spawnTimer); }catch(_){}
  });

  // expose for hub starter
  window.RB = { start:startGame, pause:pauseGame };

})();
