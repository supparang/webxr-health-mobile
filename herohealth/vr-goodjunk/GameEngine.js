// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (Production Ready)
// 2025-12 FULL

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
  let score=0, combo=0, comboMax=0, misses=0;
  let fever=0, feverActive=false, shield=0;
  let diff='normal', runMode='play';

  // ===== Camera helpers =====
  function getCam(){
    const camEl=document.querySelector('a-camera');
    if(camEl&&camEl.getObject3D) return camEl.getObject3D('camera');
    const scene=document.querySelector('a-scene');
    return scene&&scene.camera;
  }

  const tmpV = THREE && new THREE.Vector3();

  function project(pos){
    const cam=getCam();
    if(!cam||!tmpV) return null;
    tmpV.copy(pos).project(cam);
    if(tmpV.z<-1||tmpV.z>1) return null;
    return {
      x:(tmpV.x*0.5+0.5)*innerWidth,
      y:(-tmpV.y*0.5+0.5)*innerHeight
    };
  }

  function spawnWorld(){
    if(!THREE) return null;
    const camEl=document.querySelector('a-camera');
    if(!camEl||!camEl.object3D) return null;
    const pos=new THREE.Vector3();
    camEl.object3D.getWorldPosition(pos);
    const dir=new THREE.Vector3();
    camEl.object3D.getWorldDirection(dir);
    pos.add(dir.multiplyScalar(2));
    pos.x+=(Math.random()-0.5)*1.6;
    pos.y+=(Math.random()-0.5)*1.2;
    return pos;
  }

  // ===== Target =====
  function createTarget(kind){
    const el=document.createElement('div');
    el.className='gj-target '+(kind==='good'?'gj-good':'gj-junk');
    let emoji=kind==='good'
      ? (Math.random()<0.1?POWER[Math.floor(Math.random()*3)]:GOOD[Math.floor(Math.random()*GOOD.length)])
      : JUNK[Math.floor(Math.random()*JUNK.length)];

    el.textContent=emoji;
    const t={ el, kind, emoji, pos:spawnWorld(), born:performance.now() };
    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown',e=>{
      e.preventDefault();
      hit(t,e.clientX,e.clientY);
    });

    setTimeout(()=>expire(t),2000+Math.random()*400);
  }

  function expire(t){
    if(!running) return;
    destroy(t,false);
    if(t.kind==='good'){
      misses++; combo=0;
      emit('hha:miss',{misses});
    }
  }

  function destroy(t,hit){
    const i=active.indexOf(t);
    if(i>=0) active.splice(i,1);
    if(t.el){
      if(hit){
        t.el.classList.add('hit');
        setTimeout(()=>t.el.remove(),120);
      }else t.el.remove();
    }
  }

  function hit(t,x,y){
    destroy(t,true);

    // power
    if(t.emoji===STAR){ score+=40; combo++; }
    if(t.emoji===FIRE){ feverActive=true; setFeverActive(true); }
    if(t.emoji===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); }

    if(t.kind==='junk'){
      if(shield>0){ shield--; setShield(shield); return; }
      misses++; combo=0;
      emit('hha:miss',{misses});
      emit('hha:judge',{label:'MISS'});
      return;
    }

    combo++; comboMax=Math.max(comboMax,combo);
    score+=10*(feverActive?2:1);

    Particles.scorePop(x,y,'+'+10,{good:true});
    emit('hha:judge',{label:combo>=6?'PERFECT':'GOOD'});
    emit('hha:score',{score,combo,misses});
  }

  // ===== Loops =====
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

  function emit(type,detail){
    ROOT.dispatchEvent(new CustomEvent(type,{detail}));
  }

  // ===== API =====
  function start(d,opts={}){
    if(running) return;
    running=true;
    diff=d||'normal';
    runMode=opts.runMode||'play';
    layerEl=opts.layerEl||document.getElementById('gj-layer')||document.body;

    score=combo=comboMax=misses=0;
    fever=0; feverActive=false; shield=0;

    ensureFeverBar();
    setFever(0); setFeverActive(false); setShield(0);

    emit('hha:score',{score,combo,misses});
    emit('quest:update',{});

    loop();
    spawn();
  }

  function stop(){
    running=false;
    if(spawnTimer) clearTimeout(spawnTimer);
    if(rafId) cancelAnimationFrame(rafId);
    active.forEach(t=>destroy(t,false));
    active=[];
    emit('hha:end',{score,comboMax,misses});
  }

  ns.GameEngine={ start, stop };

})(window.GoodJunkVR=window.GoodJunkVR||{});