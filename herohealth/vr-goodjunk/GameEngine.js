// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (Production Ready)
// 2025-12 FULL (patched: camera-ready + no-center-stuck + no-fake-miss + init quest)

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
let running=false;
let layerEl=null;
let sceneEl=null;
let cameraEl=null;

let active=[], spawnTimer=null, rafId=null;
let score=0, combo=0, comboMax=0, misses=0;
let feverActive=false, shield=0;

let reticleOK = false; // ใช้บอกว่ามี THREE/cam พร้อมจริง
let diff='normal', runMode='play';

let tmpV = null;

// ===== Helpers =====
function emit(type,detail){
  ROOT.dispatchEvent(new CustomEvent(type,{detail}));
}

function getScene(){
  return sceneEl || document.querySelector('a-scene');
}

function getCamera3D(){
  // prefer explicit cameraEl
  if (cameraEl && cameraEl.getObject3D){
    const c = cameraEl.getObject3D('camera');
    if (c) return c;
  }
  // fallback: any a-camera
  const camAny = document.querySelector('#gj-camera') || document.querySelector('a-camera');
  if (camAny && camAny.getObject3D){
    const c = camAny.getObject3D('camera');
    if (c){
      cameraEl = camAny;
      return c;
    }
  }
  // fallback scene.camera
  const sc = getScene();
  if (sc && sc.camera) return sc.camera;
  return null;
}

function ensureThree(){
  if (tmpV) return true;
  if (!THREE || !THREE.Vector3) return false;
  tmpV = new THREE.Vector3();
  return true;
}

function projectWorldToScreen(pos){
  const cam = getCamera3D();
  if (!cam) return null;
  if (!ensureThree()) return null;
  if (!pos) return null;

  tmpV.copy(pos).project(cam);
  if (tmpV.z < -1 || tmpV.z > 1) return null;

  return {
    x:(tmpV.x*0.5+0.5)*innerWidth,
    y:(-tmpV.y*0.5+0.5)*innerHeight
  };
}

function spawnWorld(){
  if (!THREE || !THREE.Vector3) return null;

  const camHost = cameraEl || document.querySelector('#gj-camera') || document.querySelector('a-camera');
  if (!camHost || !camHost.object3D) return null;

  const pos = new THREE.Vector3();
  camHost.object3D.getWorldPosition(pos);

  const dir = new THREE.Vector3();
  camHost.object3D.getWorldDirection(dir);

  // 2m in front + random offset
  pos.add(dir.multiplyScalar(2.2));
  pos.x += (Math.random()-0.5)*1.8;
  pos.y += (Math.random()-0.5)*1.2;

  return pos;
}

function random2D(){
  // spawn safe area (ไม่ชน HUD มาก)
  const padX = 80;
  const padTop = 90;
  const padBottom = 180;
  const x = padX + Math.random() * (innerWidth - padX*2);
  const y = padTop + Math.random() * (innerHeight - padTop - padBottom);
  return { x, y };
}

function markSeen(t){
  if (!t.seenOnce){
    t.seenOnce = true;
  }
}

// ===== Target =====
function createTarget(kind){
  if (!layerEl) return;

  const el = document.createElement('div');
  el.className = 'gj-target ' + (kind==='good' ? 'gj-good' : 'gj-junk');

  let emoji = kind==='good'
    ? (Math.random()<0.1 ? POWER[(Math.random()*3)|0] : GOOD[(Math.random()*GOOD.length)|0])
    : JUNK[(Math.random()*JUNK.length)|0];

  el.textContent = emoji;

  // ✅ ให้ระบบ gaze/reticle hook ได้
  el.setAttribute('data-hha-tgt','1');
  el.dataset.kind = (emoji===STAR) ? 'star'
              : (emoji===FIRE) ? 'diamond'
              : (emoji===SHIELD) ? 'shield'
              : kind;

  // ✅ กัน “ค้างกลางจอ” — เซ็ตตำแหน่งเริ่มเป็น 2D ก่อนเสมอ
  const p2 = random2D();
  el.style.left = p2.x + 'px';
  el.style.top  = p2.y + 'px';

  const t = {
    el, kind, emoji,
    pos: spawnWorld(),         // อาจ null ถ้ากล้องยังไม่พร้อม
    p2d: p2,                   // fallback 2D
    born: performance.now(),
    ttl: 2400 + Math.random()*600,
    seenOnce: false,
    retryAt: performance.now() + 200
  };

  active.push(t);
  layerEl.appendChild(el);

  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    hit(t, e.clientX, e.clientY);
  }, {passive:false});

  // expire ตาม ttl
  setTimeout(()=>expire(t), t.ttl);
}

function destroy(t, wasHit){
  const i = active.indexOf(t);
  if (i >= 0) active.splice(i,1);

  if (t.el){
    if (wasHit){
      t.el.classList.add('hit');
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){ } }, 140);
    }else{
      try{ t.el.remove(); }catch(_){ }
    }
  }
}

function expire(t){
  if (!running) return;
  // ถ้าเป้า “ยังไม่เคยเห็นจริง ๆ” อย่านับ miss (กัน miss หลอกตอนกล้องไม่พร้อม)
  const shouldCount = !!t.seenOnce;

  destroy(t,false);

  if (shouldCount && t.kind==='good'){
    misses++; combo=0;
    emit('hha:miss',{misses});
    emit('hha:score',{score,combo,misses});
  }
}

function hit(t,x,y){
  destroy(t,true);

  // power
  if (t.emoji===STAR){ score+=40; combo++; }
  if (t.emoji===FIRE){
    feverActive=true;
    setFeverActive(true);
    emit('hha:fever',{state:'start'});
  }
  if (t.emoji===SHIELD){
    shield=Math.min(3,shield+1);
    setShield(shield);
  }

  if (t.kind==='junk'){
    if (shield>0){ shield--; setShield(shield); return; }
    misses++; combo=0;
    emit('hha:miss',{misses});
    emit('hha:judge',{label:'MISS'});
    emit('hha:score',{score,combo,misses});
    return;
  }

  combo++; comboMax=Math.max(comboMax,combo);
  score += 10*(feverActive?2:1);

  Particles.scorePop(x,y,'+'+10,{good:true});
  emit('hha:judge',{label: combo>=6 ? 'PERFECT' : 'GOOD'});
  emit('hha:score',{score,combo,misses});
}

// ===== Loops =====
function loop(){
  if(!running) return;

  // เช็คว่ากล้อง/THREE พร้อมยัง
  const cam = getCamera3D();
  reticleOK = !!(cam && ensureThree());

  const now = performance.now();

  for(const t of active){
    let p = null;

    // ถ้ามี world pos และกล้องพร้อม → project จริง
    if (reticleOK && t.pos){
      p = projectWorldToScreen(t.pos);

      // ถ้า project ไม่ได้ (เช่นอยู่หลังกล้อง) ให้ลองสุ่มตำแหน่งใหม่เป็นระยะ
      if (!p && now >= t.retryAt){
        t.pos = spawnWorld();
        t.retryAt = now + 220;
        p = (t.pos ? projectWorldToScreen(t.pos) : null);
      }
    }

    if (p){
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
      markSeen(t);
    } else {
      // fallback 2D (กันค้างกลางจอ + ยังเล่นได้)
      t.el.style.left = t.p2d.x + 'px';
      t.el.style.top  = t.p2d.y + 'px';
      markSeen(t);
    }
  }

  rafId = requestAnimationFrame(loop);
}

function spawn(){
  if(!running) return;

  const maxActive = (diff==='easy') ? 3 : (diff==='hard') ? 5 : 4;
  const interval  = (diff==='easy') ? 1100 : (diff==='hard') ? 750 : 900;
  const goodRatio = (diff==='hard') ? 0.62 : 0.70;

  if (active.length < maxActive){
    createTarget(Math.random() < goodRatio ? 'good' : 'junk');
  }
  spawnTimer = setTimeout(spawn, interval);
}

// ===== API =====
function start(d, opts={}){
  if (running) return;

  diff = d || 'normal';
  runMode = opts.runMode || 'play';

  sceneEl  = opts.sceneEl  || document.querySelector('a-scene');
  cameraEl = opts.cameraEl || document.querySelector('#gj-camera') || document.querySelector('a-camera');

  layerEl = opts.layerEl || document.getElementById('gj-layer');
  if (!layerEl){
    layerEl = document.createElement('div');
    layerEl.id = 'gj-layer';
    Object.assign(layerEl.style, { position:'fixed', inset:'0', zIndex:'649', pointerEvents:'none' });
    document.body.appendChild(layerEl);
  }

  score=0; combo=0; comboMax=0; misses=0;
  feverActive=false; shield=0;

  ensureFeverBar();
  setFever(0); setFeverActive(false); setShield(0);

  running = true;

  emit('hha:score',{score,combo,misses});
  // ✅ ส่ง init ให้ HUD รู้ว่า “ยังไม่เริ่ม quest จริง”
  emit('quest:update',{ init:true });

  loop();
  spawn();
}

function stop(reason='stop'){
  running = false;

  if (spawnTimer) clearTimeout(spawnTimer);
  if (rafId) cancelAnimationFrame(rafId);

  active.forEach(t=>destroy(t,false));
  active = [];

  emit('hha:end',{ reason, score, comboMax, misses });
}

ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
ROOT.GoodJunkVR.GameEngine = { start, stop };

// ✅ ES export สำหรับ import ใน goodjunk-vr.html
export const GameEngine = ROOT.GoodJunkVR.GameEngine;
