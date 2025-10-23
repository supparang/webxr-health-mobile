/* Rhythm Boxer · Full Dynamic Tempo Version
   เริ่มช้าแล้วค่อยเร่งตามเวลาเล่น + รองรับทุกอุปกรณ์ + Null Safe
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const getQ = (k)=> new URLSearchParams(location.search).get(k);
  const clamp=(n,a=0,b=1)=> Math.max(a, Math.min(b,n));
  const lerp=(a,b,t)=> a+(b-a)*t;
  const easeInQuad=(t)=> t*t;

  // ---------- Difficulty ----------
  const DIFFS = {
    easy:   { speed:0.85, len:55, spawn:680, scoreMul:0.9,  title:'EASY'   },
    normal: { speed:1.00, len:60, spawn:600, scoreMul:1.0,  title:'NORMAL' },
    hard:   { speed:1.15, len:70, spawn:520, scoreMul:1.1,  title:'HARD'   },
    final:  { speed:1.28, len:80, spawn:470, scoreMul:1.2,  title:'FINAL'  }
  };
  function getDiffKey(){ return getQ('diff') || localStorage.getItem('rb_diff') || 'normal'; }
  let D = DIFFS.normal;

  // ---------- Dynamic Tempo Profile ----------
  const RAMP_BY_DIFF = {
    easy:   { spawnStart:1.25, spawnEnd:0.90, speedStart:0.80, speedEnd:1.05 },
    normal: { spawnStart:1.20, spawnEnd:0.85, speedStart:0.85, speedEnd:1.12 },
    hard:   { spawnStart:1.15, spawnEnd:0.80, speedStart:0.90, speedEnd:1.18 },
    final:  { spawnStart:1.10, spawnEnd:0.75, speedStart:0.95, speedEnd:1.25 }
  };
  let rampProfile = RAMP_BY_DIFF.normal;
  function progress01(){ return 1 - clamp(timeLeft / (D.len||60), 0, 1); }
  function currentSpawnMs(){
    const p = easeInQuad(progress01());
    const k = lerp(rampProfile.spawnStart, rampProfile.spawnEnd, p);
    return Math.max(220, D.spawn * k);
  }
  function currentSpeedMul(){
    const p = easeInQuad(progress01());
    return lerp(rampProfile.speedStart, rampProfile.speedEnd, p);
  }

  // ---------- RNG ----------
  let seed = 1234567;
  function rnd(){ seed=(seed*1664525+1013904223)>>>0; return (seed & 0x7fffffff)/0x80000000; }

  // ---------- Audio ----------
  const SFX = {
    hit:   new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    good:  new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    miss:  new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo: new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    start: new Audio(`${ASSET_BASE}/assets/sfx/enrage.wav`)
  };
  const lastPlay=new Map();
  function play(a,guard=90){ try{
    const now = performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guard) return;
    a.currentTime=0; lastPlay.set(a,now); a.play();
  }catch(_e){} }

  // ---------- State ----------
  let running=false, paused=false, timer=null, spawnerTO=null;
  let score=0, combo=0, maxCombo=0, hits=0, total=0, timeLeft=60;
  let songKey='neo-run';

  // ---------- HUD ----------
  function updateHUD(){
    $('score')?.textContent = Math.round(score*D.scoreMul);
    $('combo')?.textContent = combo;
    $('time')?.textContent = timeLeft;
  }
  function addScore(v){
    score+=v; if(combo>maxCombo) maxCombo=combo; updateHUD();
  }

  // ---------- Beat Objects ----------
  function safeRemove(el){
    try{ if(el?.parentNode) el.parentNode.removeChild(el); }catch(_){}
  }

  function makeBeat(lane, speedMul=1){
    const lanes=$('lanes'); if(!lanes) return;
    const e=document.createElement('a-sphere');
    e.classList.add('beat','clickable');
    e.setAttribute('radius','0.12');
    e.setAttribute('color', lane===0?'#7a5cff':(lane<0?'#00d0ff':'#ffd166'));
    e.setAttribute('position', `${lane*0.9} 0.75 0`);
    lanes.appendChild(e);

    const spd=0.0032*D.speed*speedMul;
    const born=performance.now();
    function step(){
      if(!e.parentNode) return;
      const t=performance.now()-born;
      const y=0.75-t*spd;
      e.setAttribute('position', `${lane*0.9} ${y.toFixed(3)} 0`);
      if(y<=-0.78){ safeRemove(e); onMiss(); return; }
      requestAnimationFrame(step);
    }
    e.addEventListener('click', ()=>judgeAndRemove(e));
    requestAnimationFrame(step);
  }

  function judgeAndRemove(e){
    if(!e||!e.parentNode) return;
    const lanes=$('lanes'); if(!lanes) return;
    const p=e.object3D.getWorldPosition(new THREE.Vector3());
    const baseY=lanes.object3D.getWorldPosition(new THREE.Vector3()).y-0.78;
    const dy=Math.abs(p.y-baseY);
    safeRemove(e);
    if(dy<0.05){ combo++; play(SFX.hit); addScore(30); spawnFloat('PERFECT','#00ffa3',p); }
    else if(dy<0.12){ combo++; play(SFX.good); addScore(18); spawnFloat('GOOD','#9bd1ff',p); }
    else{ onMiss(); }
    hits++; updateHUD();
    if(combo>0 && combo%10===0) play(SFX.combo);
  }

  function onMiss(){
    combo=0; play(SFX.miss);
    spawnFloat('MISS','#ff5577',new THREE.Vector3(0,0.42,-2.2));
    updateHUD();
  }

  function spawnFloat(text,color,pos){
    const arena=$('arena'); if(!arena) return;
    const e=document.createElement('a-entity'), p=pos.clone();
    e.setAttribute('text',{value:text,color,align:'center',width:2.2});
    e.setAttribute('position',`${p.x} ${Math.max(0.1,p.y)} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.5} ${p.z}`,dur:520});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:430,delay:120});
    arena.appendChild(e); setTimeout(()=>safeRemove(e),760);
  }

  // ---------- Songs ----------
  const SONGS={
    'tutorial':(i)=>(i%3)-1,
    'neo-run':(i)=>(i%2===0?0:(rnd()<0.5?-1:1)),
    'skyline':(i)=>(rnd()<0.33?-1:(rnd()<0.66?0:1)),
    'rush':(i)=>(i%4===0?-1:(i%4===1?0:(i%4===2?1:(rnd()<0.5?-1:1))))
  };
  function loadSong(key){ songKey=SONGS[key]?key:'neo-run'; $('rSong')?.textContent=songKey; }

  // ---------- Game Flow ----------
  function scheduleNextBeat(){
    if(!running) return;
    if(paused){ spawnerTO=setTimeout(scheduleNextBeat,120); return; }
    const idx=total, lane=SONGS[songKey](idx);
    makeBeat(lane, currentSpeedMul());
    total++;
    spawnerTO=setTimeout(scheduleNextBeat, currentSpawnMs());
  }

  function startGame(){
    if(running) return;
    const dk=$('diffSel')?.value||getDiffKey();
    D=DIFFS[dk]||DIFFS.normal;
    try{ localStorage.setItem('rb_diff',dk); }catch(_){}
    rampProfile=RAMP_BY_DIFF[dk]||RAMP_BY_DIFF.normal;
    const sk=$('songSel')?.value||getQ('song')||'neo-run';
    loadSong(sk);

    reset();
    running=true; paused=false; play(SFX.start);
    scheduleNextBeat();
    timer=setInterval(()=>{
      if(!running||paused)return;
      timeLeft--; $('time')?.textContent=timeLeft;
      if(timeLeft<=0){ end(); }
    },1000);
  }

  function reset(){
    score=0; combo=0; maxCombo=0; hits=0; total=0; timeLeft=D.len;
    $('results')?.style&&( $('results').style.display='none');
    const lanes=$('lanes');
    if(lanes) Array.from(lanes.querySelectorAll('.beat')).forEach(safeRemove);
    updateHUD();
  }

  function end(){
    running=false; paused=false;
    try{ clearInterval(timer); }catch(_){}
    try{ clearTimeout(spawnerTO); }catch(_){}
    spawnerTO=null;
    const acc=total?Math.round((hits/total)*100):0;
    $('rScore')?.textContent=Math.round(score*D.scoreMul);
    $('rMaxCombo')?.textContent=maxCombo;
    $('rAcc')?.textContent=acc+'%';
    $('results')?.style&&( $('results').style.display='flex');
  }

  function togglePause(){ if(running) paused=!paused; }

  // ---------- Pointer Raycast ----------
  (function(){
    const sceneEl=document.querySelector('a-scene'); if(!sceneEl) return;
    const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
    function pick(x,y){
      const cam=sceneEl.camera; if(!cam)return;
      mouse.x=(x/window.innerWidth)*2-1; mouse.y=-(y/window.innerHeight)*2+1;
      raycaster.setFromCamera(mouse,cam);
      const objs=Array.from(document.querySelectorAll('.clickable')).map(e=>e.object3D).filter(Boolean);
      const all=[]; objs.forEach(o=>o.traverse(c=>all.push(c)));
      const hits=raycaster.intersectObjects(all,true);
      if(hits.length){ let o=hits[0].object; while(o&&!o.el)o=o.parent; o?.el?.emit('click'); }
    }
    window.addEventListener('mousedown',e=>pick(e.clientX,e.clientY),{passive:true});
    window.addEventListener('touchstart',e=>{const t=e.touches?.[0];if(t)pick(t.clientX,t.clientY);},{passive:true});
  })();

  // ---------- Controls ----------
  document.addEventListener('DOMContentLoaded',()=>{
    $('startBtn')?.addEventListener('click',startGame);
    $('pauseBtn')?.addEventListener('click',togglePause);
    $('replayBtn')?.addEventListener('click',startGame);
    $('backBtn')?.addEventListener('click',()=>{ location.href=`${ASSET_BASE||'/webxr-health-mobile/vr-fitness'}/`; });
    $('songSel')?.addEventListener('change',e=>loadSong(e.target.value));
    $('diffSel')?.addEventListener('change',e=>{
      const v=e.target.value; localStorage.setItem('rb_diff',v);
      const url=new URL(location.href); url.searchParams.set('diff',v);
      history.replaceState(null,'',url.pathname+'?'+url.searchParams.toString());
    });
    $('enterVRBtn')?.addEventListener('click',()=>{ try{document.querySelector('a-scene')?.enterVR?.();}catch(_){ }});
  });

  // ---------- Mouse Hand Follow ----------
  document.addEventListener('mousemove',e=>{
    const x=(e.clientX/window.innerWidth-.5)*3.2;
    const y=(1-e.clientY/window.innerHeight)*2+.6;
    $('rightHand')?.setAttribute('position',`${x.toFixed(2)} ${y.toFixed(2)} -1`);
  },{passive:true});

  // ---------- Boot Guard ----------
  (function(){
    let tries=0;(function waitAF(){
      if(window.AFRAME&&document.querySelector('a-scene'))return;
      tries++; if(tries>180){
        const m='A-Frame scene not found or failed to load (timeout).';
        let o=$('fatal'); if(!o){o=document.createElement('div');o.id='fatal';
          Object.assign(o.style,{position:'fixed',inset:'0',background:'#0b1118',color:'#ffb4b4',
          display:'grid',placeItems:'center',font:'14px/1.5 system-ui',zIndex:99999});document.body.appendChild(o);}
        o.innerHTML=`<div style="max-width:720px;padding:20px;text-align:center"><h2>⚠️ Can't start VR scene</h2><p>${m}</p></div>`;
        return;
      }
      requestAnimationFrame(waitAF);
    })();
    window.addEventListener('beforeunload',()=>{ try{clearInterval(timer);clearTimeout(spawnerTO);}catch(_){ }});
  })();

})();
