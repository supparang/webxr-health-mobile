// === Good vs Junk VR — DOM Emoji Engine (FINAL) ===
(function (ns) {
  'use strict';

  const ROOT = window;
  const A = ROOT.AFRAME;
  const THREE = (A && A.THREE) || ROOT.THREE;

  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles || { scorePop(){}, burstAt(){} };

  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI || { ensureFeverBar(){}, setFever(){}, setFeverActive(){}, setShield(){} };

  const { ensureFeverBar, setFeverActive, setShield } = FeverUI;

  const GOOD = ['🍎','🥦','🥕','🍌','🍉','🥛'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🥤'];

  let running=false, layerEl=null;
  let active=[], spawnTimer=null, rafId=null;

  // ===== STATE (สำคัญ) =====
  let score=0;
  let combo=0, comboMax=0;
  let misses=0;      // ยิงโดน junk
  let lapses=0;      // ปล่อย good หาย
  let goodHits=0;    // ยิงโดน good

  // ===== CAMERA =====
  function getCam(){
    const camEl=document.querySelector('a-camera');
    if(camEl && camEl.getObject3D){
      const c=camEl.getObject3D('camera');
      if(c) return c;
    }
    const sc=document.querySelector('a-scene');
    return sc && sc.camera;
  }

  const tmpV = THREE && new THREE.Vector3();

  function project(pos){
    const cam=getCam();
    if(!cam||!tmpV||!pos) return null;
    tmpV.copy(pos).project(cam);
    if(tmpV.z<-1||tmpV.z>1) return null;
    return {
      x:(tmpV.x*0.5+0.5)*innerWidth,
      y:(-tmpV.y*0.5+0.5)*innerHeight
    };
  }

  function spawnWorld(){
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

  function emit(type,detail){
    ROOT.dispatchEvent(new CustomEvent(type,{detail}));
  }

  // ===== TARGET =====
  function createTarget(kind){
    const el=document.createElement('div');
    el.className='gj-target';
    el.textContent = kind==='good'
      ? GOOD[Math.floor(Math.random()*GOOD.length)]
      : JUNK[Math.floor(Math.random()*JUNK.length)];

    el.setAttribute('data-hha-tgt','1');
    el.dataset.kind = kind;

    const t={ el, kind, pos:spawnWorld() };
    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown',e=>{
      e.preventDefault();
      hit(t,e.clientX,e.clientY);
    });

    setTimeout(()=>expire(t),2000);
  }

  function expire(t){
    if(!running) return;
    destroy(t,false);

    // ✅ lapse = ปล่อย good หาย
    if(t.kind==='good'){
      lapses++;
      combo=0;
      emit('hha:lapse',{ lapses });
    }
  }

  function destroy(t,hit){
    const i=active.indexOf(t);
    if(i>=0) active.splice(i,1);
    if(t.el) t.el.remove();
  }

  function hit(t,x,y){
    destroy(t,true);

    if(t.kind==='junk'){
      misses++;
      combo=0;
      emit('hha:miss',{ misses });
      emit('hha:judge',{ label:'MISS' });
      emitScore();
      return;
    }

    // ===== GOOD HIT =====
    goodHits++;
    combo++;
    comboMax=Math.max(comboMax,combo);
    score+=10;

    Particles.scorePop(x,y,'+10',{good:true});
    emit('hha:judge',{ label: combo>=6?'PERFECT':'GOOD' });
    emitScore();
  }

  function emitScore(){
    emit('hha:score',{
      score,
      combo,
      comboMax,
      misses,
      lapses,
      goodHits
    });
  }

  function loop(){
    if(!running) return;
    active.forEach(t=>{
      const p=project(t.pos);
      if(p){
        t.el.style.left=p.x+'px';
        t.el.style.top=p.y+'px';
      }
    });
    rafId=requestAnimationFrame(loop);
  }

  function spawn(){
    if(!running) return;
    if(active.length<4){
      createTarget(Math.random()<0.7?'good':'junk');
    }
    spawnTimer=setTimeout(spawn,900);
  }

  function start(){
    running=true;
    score=combo=comboMax=misses=lapses=goodHits=0;

    layerEl=document.getElementById('gj-layer');
    ensureFeverBar();
    emitScore();
    loop();
    spawn();
  }

  function stop(reason='end'){
    running=false;
    clearTimeout(spawnTimer);
    cancelAnimationFrame(rafId);
    active.forEach(t=>destroy(t,false));
    active=[];
    emit('hha:end',{
      reason,
      score,
      comboMax,
      misses,
      lapses,
      goodHits
    });
  }

  ns.GameEngine={ start, stop };

})(window.GoodJunkVR=window.GoodJunkVR||{});

export const GameEngine = window.GoodJunkVR.GameEngine;
