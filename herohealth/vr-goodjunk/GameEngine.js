// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (FINAL)
// FIX: targets stuck at top-left when camera not ready / project() null
// MISS = good expired + junk hit (shield block = NO miss)

'use strict';

(function (ns) {

  const ROOT = window;

  // ✅ A-Frame จะมี THREE อยู่ที่ AFRAME.THREE ชัวร์กว่า window.THREE
  const AFRAME = ROOT.AFRAME;
  const THREE  = (AFRAME && AFRAME.THREE) || ROOT.THREE;

  // ===== External modules =====
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles || { scorePop(){}, burstAt(){} };

  const FeverUI = ROOT.FeverUI || null;

  // ===== Emoji pools =====
  const GOOD = ['🍎','🥦','🥕','🍌','🍉','🥛'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🥤'];
  const STAR='⭐', FIRE='🔥', SHIELD='🛡️';
  const POWER=[STAR,FIRE,SHIELD];

  // ===== State =====
  let running=false;
  let layerEl=null;
  let active=[];
  let rafId=null, spawnTimer=null;

  let score=0;
  let combo=0;
  let comboMax=0;
  let goodHits=0;
  let misses=0;
  let shield=0;

  let feverActive=false;

  // ===== Scene / camera readiness =====
  function getScene(){
    return document.querySelector('a-scene');
  }

  function getCameraObj3D(){
    // ใช้ #gj-camera ก่อน (ตาม HTML ของคุณ) ถ้าไม่เจอค่อย fallback
    const camEl =
      document.querySelector('#gj-camera') ||
      document.querySelector('a-camera') ||
      null;

    if (camEl && camEl.object3D) return camEl.object3D;

    const scene = getScene();
    if (scene && scene.camera) return scene.camera; // THREE.Camera
    return null;
  }

  function isCameraReady(){
    const scene = getScene();
    return !!(scene && scene.camera && THREE);
  }

  // ===== Spawn world position in front of camera =====
  function spawnWorld(){
    const cam = getCameraObj3D();
    const scene = getScene();
    if (!cam || !scene || !scene.camera || !THREE) return null;

    const pos = new THREE.Vector3();
    // cam อาจเป็น Object3D หรือ Camera ก็ได้ — ทั้งคู่มี getWorldPosition
    if (cam.getWorldPosition) cam.getWorldPosition(pos);
    else if (scene.camera.getWorldPosition) scene.camera.getWorldPosition(pos);

    const dir = new THREE.Vector3();
    if (cam.getWorldDirection) cam.getWorldDirection(dir);
    else if (scene.camera.getWorldDirection) scene.camera.getWorldDirection(dir);

    pos.add(dir.multiplyScalar(2.2));
    pos.x += (Math.random()-0.5)*1.8;
    pos.y += (Math.random()-0.5)*1.4;

    return pos;
  }

  // ===== Project 3D -> screen =====
  function project(pos){
    const scene = getScene();
    if (!scene || !scene.camera || !THREE) return null;

    // ถ้า canvas ยังไม่พร้อม ให้รอ
    const cam = scene.camera;
    if (!cam || !cam.isCamera) return null;

    const v = pos.clone().project(cam);
    if (!isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z)) return null;
    if (v.z < -1 || v.z > 1) return null;

    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  // ===== Target =====
  function createTarget(kind){
    if (!layerEl || !running) return;

    const pos = spawnWorld();
    if (!pos){
      // กล้องยังไม่พร้อม อย่าเพิ่งสร้างเป้า
      return;
    }

    const el = document.createElement('div');
    el.className = 'gj-target ' + (kind === 'good' ? 'gj-good' : 'gj-junk');

    let emoji = kind === 'good'
      ? (Math.random() < 0.1 ? POWER[Math.floor(Math.random()*POWER.length)]
                             : GOOD[Math.floor(Math.random()*GOOD.length)])
      : JUNK[Math.floor(Math.random()*JUNK.length)];

    el.textContent = emoji;
    el.setAttribute('data-hha-tgt','1');

    // kind สำหรับ reticle / HUD
    el.dataset.kind =
      emoji === STAR   ? 'star'   :
      emoji === FIRE   ? 'diamond':
      emoji === SHIELD ? 'shield' : kind;

    // ✅ ซ่อนไว้ก่อน กันไปกองมุมซ้าย (0,0)
    el.style.left = '-9999px';
    el.style.top  = '-9999px';
    el.style.opacity = '0';

    const t = {
      el,
      kind,
      emoji,
      pos,
      born: performance.now(),
      visible: false
    };

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX, e.clientY);
    });

    // ===== EXPIRE =====
    setTimeout(()=>expireTarget(t), 2200);

    // ✅ ตั้งตำแหน่งทันทีถ้า project ได้
    const p = project(t.pos);
    if (p){
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
      t.el.style.opacity = '1';
      t.visible = true;
    }
  }

  function expireTarget(t){
    if (!running) return;
    removeTarget(t);

    // ✅ MISS เฉพาะ "ปล่อยของดี"
    if (t.kind === 'good'){
      misses++;
      combo = 0;
      emitScore();
      emitMiss();
    }
  }

  function removeTarget(t){
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i,1);
    if (t.el) t.el.remove();
  }

  function hitTarget(t, x, y){
    removeTarget(t);

    // ===== POWER =====
    if (t.emoji === SHIELD){
      shield = Math.min(3, shield + 1);
      emitScore();
      return;
    }

    if (t.emoji === FIRE && FeverUI){
      FeverUI.add(20);
    }

    // ===== JUNK =====
    if (t.kind === 'junk'){
      if (shield > 0){
        shield--; // ❌ shield กัน → ไม่นับ miss
        emitScore();
        return;
      }
      misses++;
      combo = 0;
      emitScore();
      emitMiss();
      emitJudge('MISS');
      return;
    }

    // ===== GOOD =====
    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    const feverNow = FeverUI && FeverUI.isActive();
    score += feverNow ? 20 : 10;

    Particles.scorePop(x, y, feverNow ? '+20' : '+10', { good:true });
    emitJudge(combo >= 6 ? 'PERFECT' : 'GOOD');
    emitScore();
  }

  // ===== Emit helpers =====
  function emitJudge(label){
    ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ label }}));
  }

  function emitMiss(){
    ROOT.dispatchEvent(new CustomEvent('hha:miss',{ detail:{ misses }}));
  }

  function emitScore(){
    feverActive = FeverUI ? FeverUI.isActive() : false;

    ROOT.dispatchEvent(new CustomEvent('hha:score',{
      detail:{
        score,
        combo,
        comboMax,
        goodHits,
        misses,
        feverActive
      }
    }));
  }

  // ===== Loops =====
  function renderLoop(){
    if (!running) return;

    for (const t of active){
      const p = project(t.pos);
      if (p){
        t.el.style.left = p.x + 'px';
        t.el.style.top  = p.y + 'px';

        if (!t.visible){
          t.el.style.opacity = '1';
          t.visible = true;
        }
      }else{
        // ✅ ถ้ายัง project ไม่ได้ ให้ซ่อนไว้ ไม่กองมุมซ้าย
        t.el.style.opacity = '0';
        t.visible = false;
      }
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  function spawnLoop(){
    if (!running) return;

    // ✅ อย่า spawn จนกว่ากล้องพร้อม
    if (isCameraReady()){
      if (active.length < 4){
        createTarget(Math.random() < 0.7 ? 'good' : 'junk');
      }
    }

    spawnTimer = setTimeout(spawnLoop, 900);
  }

  // ===== API =====
  function start(diff, opts={}){
    if (running) return;
    running = true;

    layerEl = opts.layerEl || document.getElementById('gj-layer');

    score=combo=comboMax=goodHits=misses=0;
    shield=0;

    if (FeverUI) FeverUI.reset();

    emitScore();
    renderLoop();
    spawnLoop();
  }

  function stop(){
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (spawnTimer) clearTimeout(spawnTimer);

    // remove all
    const copy = active.slice();
    for (const t of copy) removeTarget(t);
    active.length = 0;

    ROOT.dispatchEvent(new CustomEvent('hha:end',{
      detail:{ scoreFinal:score, comboMax, misses }
    }));
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

export const GameEngine = window.GoodJunkVR.GameEngine;
