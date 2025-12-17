// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine
// STEP 1 PATCH: FEVER REAL + MISS RULE FIX
// 2025-12

(function (ns) {
  'use strict';

  const ROOT = window;
  const A = ROOT.AFRAME;
  const THREE = (A && A.THREE) || ROOT.THREE;

  // ===== FX / UI =====
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles || { scorePop(){}, burstAt(){} };

  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI || { ensureFeverBar(){}, setFever(){}, setFeverActive(){}, setShield(){} };

  const { ensureFeverBar, setFever, setFeverActive, setShield } = FeverUI;

  // ===== Emoji pools =====
  const GOOD = ['🍎','🥦','🥕','🍌','🍉','🥛'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🥤'];
  const STAR='⭐', FIRE='🔥', SHIELD='🛡️';
  const POWER=[STAR,FIRE,SHIELD];

  // ===== State =====
  let running=false, layerEl=null;
  let active=[], spawnTimer=null, rafId=null;

  let score=0;
  let combo=0, comboMax=0;
  let misses=0;
  let goodHits=0;

  // FEVER
  let feverValue=0;        // 0–100
  let feverActive=false;

  // Shield
  let shield=0;

  let diff='normal', runMode='play';

  // ===== Camera helpers =====
  function getCam(){
    const camEl=document.querySelector('a-camera');
    if(camEl && camEl.getObject3D){
      const c = camEl.getObject3D('camera');
      if (c) return c;
    }
    const scene=document.querySelector('a-scene');
    return scene && scene.camera ? scene.camera : null;
  }

  const tmpV = THREE && new THREE.Vector3();

  function project(pos){
    const cam=getCam();
    if(!cam || !tmpV || !pos) return null;
    tmpV.copy(pos).project(cam);
    if(tmpV.z<-1 || tmpV.z>1) return null;
    return {
      x:(tmpV.x*0.5+0.5)*innerWidth,
      y:(-tmpV.y*0.5+0.5)*innerHeight
    };
  }

  function spawnWorld(){
    if(!THREE) return null;
    const camEl=document.querySelector('a-camera');
    if(!camEl || !camEl.object3D) return null;

    const pos=new THREE.Vector3();
    const dir=new THREE.Vector3();

    camEl.object3D.getWorldPosition(pos);
    camEl.object3D.getWorldDirection(dir);

    pos.add(dir.multiplyScalar(2));
    pos.x += (Math.random()-0.5)*1.6;
    pos.y += (Math.random()-0.5)*1.2;
    return pos;
  }

  // ===== FEVER helpers =====
  function addFever(v){
    if (feverActive) return;
    feverValue = Math.min(100, Math.max(0, feverValue + v));
    setFever(feverValue);

    if (feverValue >= 100){
      feverActive = true;
      setFeverActive(true);
      ROOT.dispatchEvent(new CustomEvent('hha:fever',{ detail:{ state:'start' }}));
    }
  }

  function reduceFever(v){
    if (feverActive) return;
    feverValue = Math.max(0, feverValue - v);
    setFever(feverValue);
  }

  function endFever(){
    feverActive = false;
    feverValue = 0;
    setFever(0);
    setFeverActive(false);
    ROOT.dispatchEvent(new CustomEvent('hha:fever',{ detail:{ state:'end' }}));
  }

  // ===== Target =====
  function createTarget(kind){
    if (!layerEl) return;

    const el=document.createElement('div');
    el.className='gj-target '+(kind==='good'?'gj-good':'gj-junk');

    let emoji=kind==='good'
      ? (Math.random()<0.1 ? POWER[Math.floor(Math.random()*3)] : GOOD[Math.floor(Math.random()*GOOD.length)])
      : JUNK[Math.floor(Math.random()*JUNK.length)];

    el.textContent=emoji;
    el.setAttribute('data-hha-tgt','1');

    el.dataset.kind =
      (emoji===STAR)   ? 'star' :
      (emoji===FIRE)   ? 'diamond' :
      (emoji===SHIELD) ? 'shield' :
      kind;

    const t={ el, kind, emoji, pos:spawnWorld(), born:performance.now() };
    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown',e=>{
      e.preventDefault();
      hit(t,e.clientX,e.clientY);
    },{passive:false});

    setTimeout(()=>expire(t), 2000+Math.random()*400);
  }

  // ===== Expire =====
  function expire(t){
    if(!running) return;
    destroy(t,false);

    // ❌ ปล่อยขยะ = ไม่ miss
    if (t.kind === 'junk') return;

    // ✅ ปล่อยของดี = MISS
    misses++;
    combo=0;
    reduceFever(20);
    emitScore();
    emitMiss();
  }

  function destroy(t,wasHit){
    const i=active.indexOf(t);
    if(i>=0) active.splice(i,1);
    if(t.el){
      if(wasHit){
        t.el.classList.add('hit');
        setTimeout(()=>{ try{t.el.remove();}catch(_){ } },120);
      }else{
        try{t.el.remove();}catch(_){}
      }
    }
  }

  // ===== Hit =====
  function hit(t,x,y){
    destroy(t,true);

    // ----- POWER -----
    if(t.emoji===STAR){ score+=40; combo++; }
    if(t.emoji===FIRE){ addFever(40); }
    if(t.emoji===SHIELD){
      shield=Math.min(3,shield+1);
      setShield(shield);
      return;
    }

    // ----- JUNK -----
    if(t.kind==='junk'){
      if(shield>0){
        shield--;
        setShield(shield);
        return; // ❌ shield กัน → ไม่ miss
      }
      misses++;
      combo=0;
      reduceFever(30);
      emitMiss();
      emitScore();
      return;
    }

    // ----- GOOD -----
    goodHits++;
    combo++;
    comboMax=Math.max(comboMax,combo);

    addFever(12);

    const base = feverActive ? 20 : 10;
    score += base;

    Particles.scorePop(x,y,'+'+base,{good:true});
    emitScore();
  }

  function emitScore(){
    ROOT.dispatchEvent(new CustomEvent('hha:score',{
      detail:{
        score,
        combo,
        comboMax,
        misses,
        goodHits
      }
    }));
  }

  function emitMiss(){
    ROOT.dispatchEvent(new CustomEvent('hha:miss',{ detail:{ misses }}));
  }

  // ===== Loop =====
  function loop(){
    if(!running) return;
    for(const t of active){
      const p=project(t.pos);
      if(p){
        t.el.style.left=p.x+'px';
        t.el.style.top=p.y+'px';
      }
    }
    rafId=requestAnimationFrame(loop);
  }

  function spawn(){
    if(!running) return;
    if(active.length<4) createTarget(Math.random()<0.7?'good':'junk');
    spawnTimer=setTimeout(spawn,900);
  }

  // ===== API =====
  function start(d,opts={}){
    if(running) return;

    diff=d||'normal';
    runMode=opts.runMode||'play';
    layerEl=opts.layerEl||document.getElementById('gj-layer');

    score=combo=comboMax=misses=goodHits=0;
    feverValue=0; feverActive=false;
    shield=0;

    ensureFeverBar();
    setFever(0); setFeverActive(false); setShield(0);

    running=true;
    emitScore();

    loop();
    spawn();
  }

  function stop(){
    running=false;
    if(spawnTimer) clearTimeout(spawnTimer);
    if(rafId) cancelAnimationFrame(rafId);
    active.forEach(t=>destroy(t,false));
    active=[];
    if (feverActive) endFever();

    ROOT.dispatchEvent(new CustomEvent('hha:end',{
      detail:{ scoreFinal:score, comboMax, misses }
    }));
  }

  ns.GameEngine={ start, stop };

})(window.GoodJunkVR=window.GoodJunkVR||{});

// ES export
export const GameEngine = window.GoodJunkVR.GameEngine;
