/* games/rhythm-boxer/game.js
   Rhythm Boxer · Full version with glowing HIT LINE + lanes + correct hub return
*/
(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '/webxr-health-mobile/vr-fitness').replace(/\/+$/,'');
  const HUB_URL = 'https://supparang.github.io/webxr-health-mobile/vr-fitness';

  function safeRemove(el){ try{ if(el && el.parentNode) el.parentNode.removeChild(el); }catch(_e){} }

  // Simple toast
  function toast(msg,color='#00ffa3'){
    let t = $('rb_toast');
    if(!t){
      t = document.createElement('div'); t.id='rb_toast';
      Object.assign(t.style,{position:'fixed',left:'50%',top:'16px',transform:'translateX(-50%)',
        background:'rgba(8,12,18,.9)',color:'#e6f7ff',padding:'8px 12px',borderRadius:'10px',
        font:'600 13px system-ui',zIndex:9999,border:'1px solid rgba(255,255,255,.08)',
        opacity:'0',transition:'opacity .15s, transform .15s'});
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.color=color;
    t.style.opacity='1'; t.style.transform='translateX(-50%) scale(1.02)';
    setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%)';},900);
  }

  // SFX
  const SFX = {
    hit:new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    good:new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    miss:new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo:new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    start:new Audio(`${ASSET_BASE}/assets/sfx/success.wav`)
  };
  Object.values(SFX).forEach(a=>a.preload='auto');

  // Game constants
  const LANE_X = [-0.9,0,0.9];
  const LANE_Z = -2.21;
  const HIT_Y = 1.05;
  const NOTE_SIZE = 0.16;

  const DIFFS = {
    beginner:{name:'BEGINNER',baseSpeed:0.55,accel:0.00035,window:0.19,spawnMin:620,spawnMax:760},
    standard:{name:'STANDARD',baseSpeed:0.82,accel:0.00055,window:0.16,spawnMin:520,spawnMax:680},
    challenge:{name:'CHALLENGE',baseSpeed:1.05,accel:0.00085,window:0.12,spawnMin:440,spawnMax:580}
  };
  let DIFF = DIFFS.standard;

  let running=false,paused=false,over=false;
  let t0=0,lastTick=0,spawnTimer=null,speed=0.8,score=0,combo=0,maxCombo=0,total=0,hitCount=0,timeLeft=60;
  const notes=[];

  function hudUpdate(){
    $('rb_score')&&($('rb_score').textContent=score);
    $('rb_combo')&&($('rb_combo').textContent=combo);
    $('rb_time')&&($('rb_time').textContent=timeLeft);
    $('rb_diff')&&($('rb_diff').textContent=DIFF.name);
  }

  // === Lane creation with glowing HIT LINE ===
  function createLanes(){
    const arena = $('arena'); if(!arena) return;
    Array.from(arena.querySelectorAll('.rb-lane,.rb-hitline,.rb-hitglow,.rb-lbl')).forEach(safeRemove);

    // vertical lanes
    LANE_X.forEach(x=>{
      const lane=document.createElement('a-box');
      lane.classList.add('rb-lane');
      lane.setAttribute('width',0.02);
      lane.setAttribute('height',2.6);
      lane.setAttribute('depth',0.01);
      lane.setAttribute('color','#224055');
      lane.setAttribute('opacity',0.42);
      lane.setAttribute('position',`${x} 1.5 ${LANE_Z}`);
      arena.appendChild(lane);
    });

    // HIT LINE main
    const hit=document.createElement('a-box');
    hit.classList.add('rb-hitline');
    hit.setAttribute('width',3.0);
    hit.setAttribute('height',0.035);
    hit.setAttribute('depth',0.01);
    hit.setAttribute('position',`0 ${HIT_Y} ${LANE_Z}`);
    hit.setAttribute('material',[
      'shader: standard',
      'color: #00ffa3',
      'emissive: #00ffa3',
      'emissiveIntensity: 1.4',
      'metalness: 0.0',
      'roughness: 1.0',
      'transparent: true',
      'opacity: 0.95'
    ].join('; '));
    arena.appendChild(hit);

    // glowing halo plane
    const halo=document.createElement('a-plane');
    halo.classList.add('rb-hitglow');
    halo.setAttribute('width',3.2);
    halo.setAttribute('height',0.18);
    halo.setAttribute('position',`0 ${HIT_Y} ${LANE_Z+0.001}`);
    halo.setAttribute('material',[
      'shader: standard',
      'color: #00ffa3',
      'emissive: #00ffa3',
      'emissiveIntensity: 1.0',
      'transparent: true',
      'opacity: 0.22',
      'side: double'
    ].join('; '));
    halo.setAttribute('animation__op','property: material.opacity; from: 0.18; to: 0.36; dir: alternate; loop: true; dur: 900; easing: easeInOutSine');
    halo.setAttribute('animation__sc','property: scale; to: 1.04 1.18 1; dir: alternate; loop: true; dur: 900; easing: easeInOutSine');
    arena.appendChild(halo);

    // label
    const txt=document.createElement('a-entity');
    txt.classList.add('rb-lbl');
    txt.setAttribute('text',{value:'HIT LINE',color:'#00ffa3',align:'center',width:3});
    txt.setAttribute('position',`0 ${HIT_Y+0.12} ${LANE_Z}`);
    arena.appendChild(txt);
  }

  // === Spawn notes & scoring ===
  function spawnNote(){
    if(!running||paused) return;
    const arena=$('arena'); if(!arena) return;
    const lane=Math.floor(Math.random()*LANE_X.length);
    const el=document.createElement('a-sphere');
    el.classList.add('rb-note','clickable');
    el.setAttribute('radius',NOTE_SIZE);
    el.setAttribute('color','#5de1ff');
    el.setAttribute('position',`${LANE_X[lane]} ${HIT_Y+1.8} ${LANE_Z}`);
    arena.appendChild(el);
    const n={el,lane,y:HIT_Y+1.8,speed:speed};
    notes.push(n); total++;
  }

  function registerHit(kind,n){
    if(n?.el) safeRemove(n.el);
    if(kind==='miss'){ combo=0; SFX.miss.play(); feedback('MISS','#ff5577'); }
    else{
      combo++; maxCombo=Math.max(maxCombo,combo);
      const add=(kind==='perfect'?100:50); score+=add; hitCount++;
      (kind==='perfect'?SFX.hit:SFX.good).play();
      feedback(kind==='perfect'?'PERFECT':'GOOD',kind==='perfect'?'#00ffa3':'#9bd1ff');
    }
    const idx=notes.indexOf(n); if(idx>-1) notes.splice(idx,1);
    hudUpdate();
  }

  function feedback(text,color){
    const a=$('arena'); if(!a) return;
    const e=document.createElement('a-entity');
    e.setAttribute('text',{value:text,color,align:'center',width:2.5});
    e.setAttribute('position',`0 ${HIT_Y+0.35} ${LANE_Z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in','property: scale; to: 1 1 1; dur: 100; easing: easeOutBack');
    e.setAttribute('animation__rise',`property: position; to: 0 ${HIT_Y+0.6} ${LANE_Z}; dur: 520; easing: easeOutQuad`);
    e.setAttribute('animation__fade','property: opacity; to: 0; dur: 400; delay: 160; easing: linear');
    a.appendChild(e); setTimeout(()=>safeRemove(e),700);
  }

  function judgeHit(lane){
    if(!running||paused) return;
    let best=null,bestDy=1e9;
    for(const n of notes){
      if(!n.el) continue;
      if(n.lane!==lane) continue;
      const dy=Math.abs(n.y-HIT_Y);
      if(dy<bestDy){best=n;bestDy=dy;}
    }
    if(!best){ feedback('MISS','#ff5577'); return; }
    const w=DIFF.window;
    if(bestDy<=w*0.5) registerHit('perfect',best);
    else if(bestDy<=w) registerHit('good',best);
    else registerHit('miss',best);
  }

  // === Game loop ===
  function tick(now){
    if(!running||paused) return;
    if(!lastTick) lastTick=now;
    const dt=Math.min(0.04,(now-lastTick)/1000);
    lastTick=now;
    for(let i=notes.length-1;i>=0;i--){
      const n=notes[i];
      if(!n.el) continue;
      n.y-=n.speed*dt;
      n.el.setAttribute('position',`${LANE_X[n.lane]} ${n.y.toFixed(3)} ${LANE_Z}`);
      if(n.y<=HIT_Y-0.18){ registerHit('miss',n); }
    }
    speed+=DIFF.accel;
    requestAnimationFrame(tick);
  }

  // === Flow ===
  let timer=null;
  function startGame(){
    if(running) return;
    running=true;paused=false;over=false;score=0;combo=0;maxCombo=0;total=0;hitCount=0;speed=DIFF.baseSpeed;timeLeft=60;
    hudUpdate();
    notes.splice(0);
    createLanes();
    toast(`Start · ${DIFF.name}`);
    SFX.start.play();
    t0=performance.now();lastTick=0;requestAnimationFrame(tick);
    const jitter=()=>Math.floor(DIFF.spawnMin+Math.random()*(DIFF.spawnMax-DIFF.spawnMin));
    spawnTimer=setInterval(spawnNote,jitter());
    timer=setInterval(()=>{if(paused)return;timeLeft--;hudUpdate();if(timeLeft<=0)endGame();},1000);
  }

  function pauseGame(){ if(!running||over)return; paused=!paused; toast(paused?'PAUSED':'RESUME',paused?'#ffd166':'#00ffa3'); }

  function endGame(){
    if(!running)return;running=false;over=true;paused=false;
    clearInterval(timer);clearInterval(spawnTimer);
    const acc=total?Math.round((hitCount/total)*100):0;
    const star=(combo>=30?1:0)+(acc>=80?1:0)+(score>=2000?1:0);
    let p=$('rb_results');
    if(!p){
      p=document.createElement('section');p.id='rb_results';
      Object.assign(p.style,{position:'fixed',inset:'0',display:'grid',placeItems:'center',background:'rgba(0,0,0,.6)',color:'#e6f7ff',zIndex:9998});
      p.innerHTML=`<div class="card" style="min-width:300px;background:#0b1118;border:1px solid #203446;border-radius:12px;padding:14px 16px">
        <h3 style="margin:0 0 8px">RESULTS</h3>
        <div>Mode: <b id="rb_rdiff"></b></div>
        <div>Score: <b id="rb_rscore"></b></div>
        <div>Max Combo: <b id="rb_rcombo"></b></div>
        <div>Accuracy: <b id="rb_racc"></b></div>
        <div>Stars: <b id="rb_rstars"></b></div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn" id="rb_replay">Replay</button>
          <button class="btn" id="rb_back">Back to Hub</button>
        </div></div>`;
      document.body.appendChild(p);
      p.querySelector('#rb_replay').addEventListener('click',()=>{p.style.display='none';startGame();});
      p.querySelector('#rb_back').addEventListener('click',()=>{window.location.href=HUB_URL;});
    }
    p.querySelector('#rb_rdiff').textContent=DIFF.name;
    p.querySelector('#rb_rscore').textContent=score;
    p.querySelector('#rb_rcombo').textContent=maxCombo;
    p.querySelector('#rb_racc').textContent=acc+'%';
    p.querySelector('#rb_rstars').textContent='★'.repeat(star)+'☆'.repeat(3-star);
    p.style.display='grid';toast('Finished');
  }

  // === Input ===
  document.addEventListener('DOMContentLoaded',()=>{
    $('startBtn')?.addEventListener('click',startGame);
    $('pauseBtn')?.addEventListener('click',pauseGame);
    $('backBtn')?.addEventListener('click',()=>window.location.href=HUB_URL);
    $('rb_diff_sel')?.addEventListener('change',e=>{
      const v=(e.target.value||'standard').toLowerCase();
      DIFF=DIFFS[v]||DIFFS.standard;localStorage.setItem('rb_diff',v);toast(`Mode: ${DIFF.name}`);hudUpdate();
    });
    const saved=localStorage.getItem('rb_diff');if(saved&&DIFFS[saved]){DIFF=DIFFS[saved];$('rb_diff_sel')&&($('rb_diff_sel').value=saved);}
    hudUpdate();
  });
  document.addEventListener('keydown',e=>{
    if(e.repeat)return;
    if(e.key===' '){startGame();return;}
    if(e.key==='p'||e.key==='P'){pauseGame();return;}
    if(e.key==='a'||e.key==='A'||e.key==='ArrowLeft'){judgeHit(0);return;}
    if(e.key==='s'||e.key==='S'||e.key==='ArrowDown'){judgeHit(1);return;}
    if(e.key==='d'||e.key==='D'||e.key==='ArrowRight'){judgeHit(2);return;}
  });
  (function pointer(){
    const laneFromX=x=>{const w=window.innerWidth;const seg=w/3;if(x<seg)return 0;if(x<2*seg)return 1;return 2;};
    window.addEventListener('mousedown',e=>judgeHit(laneFromX(e.clientX)),{passive:true});
    window.addEventListener('touchstart',e=>{const t=e.touches[0];if(!t)return;judgeHit(laneFromX(t.clientX));},{passive:true});
  })();
  window.addEventListener('beforeunload',()=>{clearInterval(timer);clearInterval(spawnTimer);});
})();
