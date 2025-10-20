(function(){
  // --- State ---
  let score=0, timeLeft=60, timer=null, running=false;
  let combo=0, maxCombo=0, hits=0, spawns=0;
  const TARGET_LIFETIME = 2200;      // ms target stays
  const SPAWN_INTERVAL  = 900;       // ms between spawns
  const SLASH_SPEED_GOOD = 1.4;      // m/s minimal speed for Good
  const SLASH_SPEED_PERFECT = 2.2;   // m/s minimal speed for Perfect
  const HIT_DISTANCE_GOOD = 0.45;    // m max distance for Good
  const HIT_DISTANCE_PERFECT = 0.35; // m max distance for Perfect

  const sfx = {
    slash:   new Audio('../../assets/sfx/slash.wav'),
    laser:   new Audio('../../assets/sfx/laser.wav'),
    perfect: new Audio('../../assets/sfx/perfect.wav'),
    miss:    new Audio('../../assets/sfx/miss.wav')
  };

  function $(q){return document.querySelector(q);}
  function $el(id){return document.getElementById(id);}

  // --- A-Frame components ---
  AFRAME.registerComponent('hand-speed',{
    schema:{speed:{type:'number',default:0}},
    init(){ this.prev=null; this.prevT=performance.now(); },
    tick(t,dt){
      const p = this.el.object3D.getWorldPosition(new THREE.Vector3());
      const now = performance.now();
      if(this.prev){
        const dist = p.distanceTo(this.prev);
        const dtSec = (now - this.prevT)/1000;
        this.data.speed = dtSec>0 ? dist/dtSec : 0;
      }
      this.prev = p.clone(); this.prevT = now;
    }
  });

  AFRAME.registerComponent('sb-target',{
    init(){
      const el = this.el;
      el.classList.add('sb-target');
      el.setAttribute('color', '#00d0ff');
      el.setAttribute('scale', '0.001 0.001 0.001');
      el.setAttribute('animation__in', {property:'scale', to:'1 1 1', dur:180, easing:'easeOutBack'});
      this.dieTimer = setTimeout(()=>{ miss(el); }, TARGET_LIFETIME);
      // Fallback click via laser
      el.addEventListener('click', ()=>{ registerHit(el, {type:'laser'}); });
    },
    remove(){ clearTimeout(this.dieTimer); }
  });

  // --- Floating text helper ---
  function floatText(text, color, worldPos){
    const label = document.createElement('a-entity');
    label.setAttribute('text', {value: text, color: color, align:'center', width: 2.4});
    const p = worldPos.clone(); p.y += 0.2;
    label.setAttribute('position', `${p.x} ${p.y} ${p.z}`);
    label.setAttribute('scale', '0.001 0.001 0.001');
    label.setAttribute('animation__in', {property:'scale', to:'1 1 1', dur:90, easing:'easeOutQuad'});
    label.setAttribute('animation__rise', {property:'position', to:`${p.x} ${p.y+0.6} ${p.z}`, dur:600, easing:'easeOutQuad'});
    label.setAttribute('animation__fade', {property:'opacity', to:0, dur:480, delay:160, easing:'linear'});
    $el('arena').appendChild(label);
    setTimeout(()=>{ label.parentNode && label.parentNode.removeChild(label); }, 800);
  }

  // --- Core mechanics ---
  function start(){
    if(running) return;
    reset();
    running = true;
    spawnTimer = setInterval(spawnTarget, SPAWN_INTERVAL);
    timer = setInterval(()=>{
      timeLeft--; $('#time').textContent = timeLeft;
      if(timeLeft<=0) end();
    },1000);
  }

  let spawnTimer=null;
  function reset(){
    score=0; timeLeft=60; combo=0; maxCombo=0; hits=0; spawns=0;
    $('#score').textContent = score;
    $('#time').textContent = timeLeft;
    $('#combo').textContent = combo;
    $el('results').style.display='none';
    const arena = $el('arena'); Array.from(arena.children).forEach(c=>c.remove());
  }

  function end(){
    running=false;
    clearInterval(timer); clearInterval(spawnTimer);
    const acc = spawns? Math.round((hits/spawns)*100) : 0;
    $el('rScore').textContent = score;
    $el('rMaxCombo').textContent = maxCombo;
    $el('rAcc').textContent = acc + '%';
    $el('results').style.display = 'flex';
    APP.badge(APP.t('results')+': '+score);
  }

  function spawnTarget(){
    spawns++;
    const arena = $el('arena');
    const geoType = Math.random()<0.5 ? 'a-box':'a-sphere';
    const el = document.createElement(geoType);
    const x = (Math.random()*3.2 - 1.6).toFixed(2);
    const y = (Math.random()*1.6 + 1.0).toFixed(2);
    const z = (Math.random()*-2.0 - 1.8).toFixed(2);
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.setAttribute('sb-target', '');
    arena.appendChild(el);
  }

  function applyScore(kind, method, pos){
    // kind: 'perfect' | 'good' | 'laser' | 'miss'
    if(kind==='miss'){
      combo = 0;
      $('#combo').textContent = combo;
      sfx.miss.currentTime = 0; sfx.miss.play().catch(()=>{});
      floatText('MISS', '#ff5577', pos);
      return;
    }
    combo++;
    if(combo>maxCombo) maxCombo = combo;
    const multiplier = 1 + Math.floor(combo/10); // every 10 combo +1x
    let base = 0;
    if(kind==='perfect') base = 30;
    else if(kind==='good') base = 20;
    else if(kind==='laser') base = 10;
    score += base * multiplier;
    hits++;
    $('#score').textContent = score;
    $('#combo').textContent = combo;

    // FX
    if(kind==='perfect'){ sfx.perfect.currentTime=0; sfx.perfect.play().catch(()=>{}); floatText('PERFECT', '#00ffa3', pos); }
    else if(kind==='good'){ sfx.slash.currentTime=0; sfx.slash.play().catch(()=>{}); floatText('GOOD', '#00d0ff', pos); }
    else if(kind==='laser'){ sfx.laser.currentTime=0; sfx.laser.play().catch(()=>{}); floatText('GOOD', '#9bd1ff', pos); }
  }

  function registerHit(target, info){
    if(!target.getAttribute('visible')) return;
    const tpos = target.object3D.getWorldPosition(new THREE.Vector3());
    clearTimeout(target.components['sb-target'].dieTimer);
    target.setAttribute('animation__out', {property:'scale', to:'0.001 0.001 0.001', dur:120, easing:'easeInBack'});
    setTimeout(()=>{ target.parentNode && target.parentNode.removeChild(target); }, 130);
    // Scoring by info
    applyScore(info.kind||info.type, info.method||info.type, tpos);
    AudioBus.tap();
  }

  function miss(target){
    if(target && target.parentNode){ 
      const tpos = target.object3D.getWorldPosition(new THREE.Vector3());
      target.parentNode.removeChild(target);
      applyScore('miss', 'timeout', tpos);
    } else {
      combo=0; $('#combo').textContent=combo;
    }
  }

  // slash detector
  function checkSlashHits(){
    if(!running) return;
    const arena = $el('arena');
    const targets = Array.from(arena.querySelectorAll('.sb-target'));
    if(targets.length===0) return;
    const lh = $el('leftHand'); const rh = $el('rightHand');
    const ls = lh.components['hand-speed']?.data?.speed || 0;
    const rs = rh.components['hand-speed']?.data?.speed || 0;
    const lpos = lh.object3D.getWorldPosition(new THREE.Vector3());
    const rpos = rh.object3D.getWorldPosition(new THREE.Vector3());
    targets.forEach(t=>{
      if(!t.getAttribute('visible')) return;
      const tpos = t.object3D.getWorldPosition(new THREE.Vector3());
      // left
      if(ls>=SLASH_SPEED_GOOD){
        const dl = lpos.distanceTo(tpos);
        if(ls>=SLASH_SPEED_PERFECT && dl<=HIT_DISTANCE_PERFECT){
          registerHit(t, {type:'slash', kind:'perfect'});
          return;
        } else if(dl<=HIT_DISTANCE_GOOD){
          registerHit(t, {type:'slash', kind:'good'});
          return;
        }
      }
      // right
      if(rs>=SLASH_SPEED_GOOD){
        const dr = rpos.distanceTo(tpos);
        if(rs>=SLASH_SPEED_PERFECT && dr<=HIT_DISTANCE_PERFECT){
          registerHit(t, {type:'slash', kind:'perfect'});
          return;
        } else if(dr<=HIT_DISTANCE_GOOD){
          registerHit(t, {type:'slash', kind:'good'});
          return;
        }
      }
    });
  }

  // hook a-scene loop
  AFRAME.registerSystem('sb-loop', { tick(){ checkSlashHits(); } });

  // UI
  document.addEventListener('DOMContentLoaded', ()=>{
    $('#startBtn').addEventListener('click', start);
    $('#replayBtn').addEventListener('click', ()=>{ start(); });
    $('#backBtn').addEventListener('click', ()=>{ window.location.href='../../index.html'; });
  });
})();