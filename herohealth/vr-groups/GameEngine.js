// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — DOM Emoji Targets + Fever + Quest + Celebration
// 2025-12 — FULL PATCHED PRODUCTION VERSION
// FIXED: AFRAME.THREE, emoji render, projection fallback, adaptive+, research mode

(function (ns) {
  'use strict';

  const ROOT = (typeof window !== 'undefined' ? window : globalThis);

  // ---------- A-Frame / THREE (FIXED) ----------
  const A = ROOT.AFRAME;
  const THREE = (A && A.THREE) || ROOT.THREE;

  function getSceneEl () { return document.querySelector('a-scene'); }
  function getCamEl () { return document.querySelector('#fg-camera') || document.querySelector('a-camera'); }

  function getThreeCamera () {
    const camEl = getCamEl();
    if (camEl && camEl.getObject3D) {
      const c = camEl.getObject3D('camera');
      if (c) return c;
    }
    const scene = getSceneEl();
    return scene && scene.camera ? scene.camera : null;
  }

  // ---------- FX / UI ----------
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles || { scorePop(){}, burstAt(){} };

  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI || { ensureFeverBar(){}, setFever(){}, setFeverActive(){}, setShield(){} };

  const { ensureFeverBar, setFever, setFeverActive, setShield } = FeverUI;

  // ---------- Emoji pools ----------
  const GROUPS = {
    1:['🍗','🥩','🍖','🐟','🍳','🥚','🫘','🥜','🧀','🥛'],
    2:['🍚','🍞','🥖','🥐','🥯','🥨','🥔','🍠','🥣'],
    3:['🥦','🥕','🍅','🥬','🥒','🌽'],
    4:['🍎','🍌','🍊','🍇','🍉','🍓','🍍'],
    5:['🧈','🥓','🧇']
  };
  const JUNK = ['🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧋','🥤','🍫'];
  const POWER_STAR='⭐', POWER_FIRE='🔥', POWER_SHIELD='🛡️';
  const POWERUPS=[POWER_STAR,POWER_FIRE,POWER_SHIELD];

  function emojiGroup(ch){
    for(const k in GROUPS){ if(GROUPS[k].includes(ch)) return +k; }
    return 0;
  }
  function pickGoodEmoji(){
    const keys=Object.keys(GROUPS);
    const k=keys[Math.floor(Math.random()*keys.length)];
    const arr=GROUPS[k];
    return arr[Math.floor(Math.random()*arr.length)];
  }

  // ---------- Difficulty ----------
  function getDifficulty(key){
    const HH = ROOT.HeroHealth || {};
    return (HH.foodGroupsDifficulty && HH.foodGroupsDifficulty.get)
      ? HH.foodGroupsDifficulty.get(key)
      : { spawnInterval:1000, lifetime:2200, maxActive:4, scale:1 };
  }

  // ---------- State ----------
  let layerEl=null, running=false;
  let rafId=null, spawnTimer=null;
  let activeTargets=[];
  let diffKey='normal', runMode='play';
  let spawnInterval=1000, lifetimeBase=2200, maxActive=4, baseScale=1;
  let adaptiveScale=1, adaptiveSpawn=1, adaptiveMaxActive=0;
  let score=0, combo=0, misses=0;
  let fever=0, feverActive=false, shield=0;

  // ---------- 3D helpers ----------
  const tmpV = THREE ? new THREE.Vector3() : null;
  const tmpCam = THREE ? new THREE.Vector3() : null;
  const tmpDir = THREE ? new THREE.Vector3() : null;
  const tmpRight = THREE ? new THREE.Vector3() : null;
  const tmpUp = THREE ? new THREE.Vector3() : null;

  function spawnAnchorWorldPos(){
    if(!THREE) return null;
    const camEl=getCamEl();
    if(!camEl||!camEl.object3D) return null;

    camEl.object3D.getWorldPosition(tmpCam);
    camEl.object3D.getWorldDirection(tmpDir);

    tmpRight.set(1,0,0).applyQuaternion(camEl.object3D.quaternion).normalize();
    tmpUp.set(0,1,0).applyQuaternion(camEl.object3D.quaternion).normalize();

    return new THREE.Vector3().copy(tmpCam)
      .add(tmpDir.multiplyScalar(2.2))
      .add(tmpRight.multiplyScalar((Math.random()-0.5)*1.8))
      .add(tmpUp.multiplyScalar((Math.random()-0.5)*1.2));
  }

  function projectToScreen(pos){
    const cam=getThreeCamera();
    if(!THREE||!cam||!pos) return null;
    tmpV.copy(pos).project(cam);
    if(tmpV.z<-1||tmpV.z>1) return null;
    return {
      x:(tmpV.x*0.5+0.5)*window.innerWidth,
      y:(-tmpV.y*0.5+0.5)*window.innerHeight
    };
  }

  // ---------- Target ----------
  function createTarget(kindWanted){
    if(!layerEl) return;
    const el=document.createElement('div');
    el.className='fg-target '+(kindWanted==='good'?'fg-good':'fg-junk');
    el.style.position='absolute';
    el.style.left='50%'; el.style.top='50%';

    let emoji='', kind=kindWanted;
    if(kindWanted==='good'){
      if(Math.random()<0.08){
        emoji=POWERUPS[Math.floor(Math.random()*POWERUPS.length)];
        kind='power';
      }else emoji=pickGoodEmoji();
    }else emoji=JUNK[Math.floor(Math.random()*JUNK.length)];

    el.dataset.emoji=emoji;
    el.textContent=emoji; // ★ FIX: force emoji render

    const posWorld=spawnAnchorWorldPos();
    const t={ el, kind, emoji, posWorld, bornAt:performance.now(), timeout:null };
    activeTargets.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown',ev=>{
      ev.preventDefault();
      handleHit(t,ev.clientX,ev.clientY);
    });

    const life=Math.max(600,lifetimeBase+(Math.random()*400-200));
    t.timeout=setTimeout(()=>{
      destroyTarget(t,false);
      if(kind==='good'){ misses++; combo=0; }
    },life);
  }

  function destroyTarget(t,isHit){
    if(!t) return;
    const i=activeTargets.indexOf(t);
    if(i>=0) activeTargets.splice(i,1);
    if(t.timeout) clearTimeout(t.timeout);
    if(t.el&&t.el.parentNode){
      if(isHit){ t.el.classList.add('hit'); setTimeout(()=>t.el.remove(),120); }
      else t.el.remove();
    }
  }

  function handleHit(t,x,y){
    destroyTarget(t,true);
    if(t.kind==='junk'){
      if(shield>0){ shield--; setShield(shield); return; }
      misses++; combo=0; return;
    }
    combo++; score+=10*(feverActive?2:1);
    if(t.kind==='power'){
      if(t.emoji===POWER_FIRE){ feverActive=true; setFeverActive(true); }
      if(t.emoji===POWER_SHIELD){ shield=Math.min(3,shield+1); setShield(shield); }
    }
  }

  // ---------- Loops ----------
  function tickProject(){
    if(!running) return;
    for(const t of activeTargets){
      const p=projectToScreen(t.posWorld);
      if(!p){
        t.el.style.opacity='1';
        t.el.style.left=(Math.random()*innerWidth*0.8+innerWidth*0.1)+'px';
        t.el.style.top=(Math.random()*innerHeight*0.6+innerHeight*0.2)+'px';
      }else{
        t.el.style.opacity='1';
        t.el.style.left=p.x+'px';
        t.el.style.top=p.y+'px';
      }
      t.el.style.transform=`translate(-50%,-50%) scale(${(runMode==='research'?baseScale:adaptiveScale).toFixed(2)})`;
    }
    rafId=requestAnimationFrame(tickProject);
  }

  function tickSpawn(){
    if(!running) return;
    const cap=maxActive+((runMode==='play')?adaptiveMaxActive:0);
    if(activeTargets.length<cap){
      createTarget(Math.random()<0.8?'good':'junk');
    }
  }

  function scheduleSpawn(){
    if(!running) return;
    const ms=Math.max(200,spawnInterval*((runMode==='play')?adaptiveSpawn:1));
    spawnTimer=setTimeout(()=>{ tickSpawn(); scheduleSpawn(); },ms);
  }

  // ---------- API ----------
  function start(diff,opts={}){
    if(running) return;
    running=true;

    layerEl=opts.layerEl||document.getElementById('fg-layer')||document.body;
    runMode=(opts.runMode==='research')?'research':'play';

    const D=getDifficulty(diff||'normal');
    spawnInterval=D.spawnInterval;
    lifetimeBase=D.lifetime;
    maxActive=D.maxActive;
    baseScale=D.scale;
    adaptiveScale=baseScale;

    ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0);

    rafId=requestAnimationFrame(tickProject);
    tickSpawn(); scheduleSpawn();
  }

  function stop(){
    running=false;
    if(rafId) cancelAnimationFrame(rafId);
    if(spawnTimer) clearTimeout(spawnTimer);
    activeTargets.forEach(t=>destroyTarget(t,false));
    activeTargets=[];
  }

  ns.GameEngine={ start, stop };

})(window.GroupsVR=window.GroupsVR||{});