// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (FINAL)
// MISS = good expired + junk hit (shield block = NO miss)
// FIX: wait camera readiness issues + prevent "miss drift" when target never visible

'use strict';

(function (ns) {
  const ROOT = (typeof window !== 'undefined' ? window : globalThis);

  // Use AFRAME.THREE first (เพราะ window.THREE อาจไม่มีในบาง build)
  const THREE =
    ROOT.THREE ||
    (ROOT.AFRAME && ROOT.AFRAME.THREE) ||
    null;

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
  let feverPrev=false;

  // ===== Helpers =====
  function sceneRef(){
    const scene = document.querySelector('a-scene');
    return scene || null;
  }

  function getCameraObj3D(){
    const camEl =
      document.querySelector('#gj-camera') ||
      document.querySelector('a-camera');
    if (camEl && camEl.object3D) return camEl.object3D;
    return null;
  }

  function cameraReady(){
    const scene = sceneRef();
    return !!(scene && scene.camera && THREE);
  }

  // ===== World spawn (หน้า camera) =====
  function spawnWorld(){
    const cam = getCameraObj3D();
    if (!cam || !THREE) return null;

    const pos = new THREE.Vector3();
    cam.getWorldPosition(pos);

    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);

    pos.add(dir.multiplyScalar(2.2));
    pos.x += (Math.random()-0.5)*1.8;
    pos.y += (Math.random()-0.5)*1.4;

    return pos;
  }

  // ===== Project 3D → 2D =====
  function project(pos){
    const scene = sceneRef();
    if (!scene || !scene.camera || !THREE) return null;

    const v = pos.clone().project(scene.camera);
    if (v.z < -1 || v.z > 1) return null;

    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  // ===== Emit helpers =====
  function emitJudge(label){
    ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ label }}));
  }

  function emitMiss(){
    ROOT.dispatchEvent(new CustomEvent('hha:miss',{ detail:{ misses }}));
  }

  function emitFeverEdgeIfNeeded(){
    if (!FeverUI || typeof FeverUI.isActive !== 'function') return;

    feverPrev = feverActive;
    feverActive = !!FeverUI.isActive();

    if (feverActive && !feverPrev){
      ROOT.dispatchEvent(new CustomEvent('hha:fever',{ detail:{ state:'start' }}));
    } else if (!feverActive && feverPrev){
      ROOT.dispatchEvent(new CustomEvent('hha:fever',{ detail:{ state:'end' }}));
    }
  }

  function emitScore(){
    // update fever state + edge
    if (FeverUI && typeof FeverUI.isActive === 'function'){
      feverActive = !!FeverUI.isActive();
      emitFeverEdgeIfNeeded();
    } else {
      feverActive = false;
      feverPrev = false;
    }

    ROOT.dispatchEvent(new CustomEvent('hha:score',{
      detail:{
        score,
        combo,
        comboMax,
        goodHits,
        misses,
        feverActive,
        shield
      }
    }));
  }

  // ===== Target =====
  function createTarget(kind){
    if (!layerEl) return;

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

    const t = {
      el,
      kind,
      emoji,
      pos: spawnWorld(),      // อาจ null ถ้า camera ยังไม่พร้อม
      born: performance.now(),
      seen: false             // ✅ เคยถูก project ได้จริงไหม
    };

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    // expire
    setTimeout(()=>expireTarget(t), 2200);
  }

  function removeTarget(t){
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i,1);
    if (t.el) t.el.remove();
  }

  function expireTarget(t){
    if (!running) return;

    // remove first
    removeTarget(t);

    // ✅ MISS เฉพาะ "ปล่อยของดี" และต้อง "เคยเห็นจริง" (กัน miss ไหลตอนกล้องยังไม่พร้อม)
    if (t.kind === 'good' && t.seen){
      misses++;
      combo = 0;
      emitScore();
      emitMiss();
      emitJudge('MISS');
    }
  }

  function hitTarget(t, x, y){
    // ถ้าโดนหลังถูก remove ไปแล้ว ให้เงียบ
    if (!t || !t.el) return;

    removeTarget(t);

    // ===== POWER =====
    if (t.emoji === SHIELD){
      shield = Math.min(3, shield + 1);
      emitScore();
      emitJudge('SHIELD');
      return;
    }

    if (t.emoji === FIRE && FeverUI && typeof FeverUI.add === 'function'){
      FeverUI.add(20);
      emitScore();
      emitJudge('FEVER+');
      return;
    }

    // ===== JUNK =====
    if (t.kind === 'junk'){
      if (shield > 0){
        shield--; // ❌ shield กัน → ไม่นับ miss
        emitScore();
        emitJudge('BLOCK');
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

    const feverNow = (FeverUI && typeof FeverUI.isActive === 'function') ? FeverUI.isActive() : false;
    score += feverNow ? 20 : 10;

    if (Particles && typeof Particles.scorePop === 'function'){
      Particles.scorePop(x, y, feverNow ? '+20' : '+10', { good:true });
    }

    emitJudge(combo >= 6 ? 'PERFECT' : 'GOOD');
    emitScore();
  }

  // ===== Loops =====
  function renderLoop(){
    if (!running) return;

    // ถ้า pos ยังไม่มี (กล้องยังไม่พร้อมตอนสร้าง) ให้เติมทีหลัง
    const ready = cameraReady();

    for (const t of active){
      if (!t || !t.el) continue;

      if (!t.pos && ready){
        t.pos = spawnWorld();
      }

      const p = (t.pos && ready) ? project(t.pos) : null;

      if (p){
        t.seen = true;
        t.el.style.display = 'block';
        t.el.style.left = p.x + 'px';
        t.el.style.top  = p.y + 'px';
      }else{
        // ✅ กันไปกอง (0,0) มุมซ้ายบน
        t.el.style.display = 'none';
      }
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  function spawnLoop(){
    if (!running) return;

    if (active.length < 4){
      createTarget(Math.random() < 0.7 ? 'good' : 'junk');
    }
    spawnTimer = setTimeout(spawnLoop, 900);
  }

  // ===== API =====
  function start(diff, opts={}){
    if (running) return;
    running = true;

    layerEl = opts.layerEl || document.getElementById('gj-layer');

    score=0; combo=0; comboMax=0; goodHits=0; misses=0;
    shield=0;

    feverActive=false;
    feverPrev=false;

    if (FeverUI && typeof FeverUI.reset === 'function'){
      FeverUI.reset();
    }

    emitScore();
    renderLoop();
    spawnLoop();
  }

  function stop(reason='stop'){
    if (!running) return;
    running = false;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (spawnTimer) clearTimeout(spawnTimer);
    spawnTimer = null;

    // cleanup
    const copy = active.slice();
    for (const t of copy) removeTarget(t);
    active.length = 0;

    ROOT.dispatchEvent(new CustomEvent('hha:end',{
      detail:{ scoreFinal:score, comboMax, misses, reason }
    }));
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

// ESM export
export const GameEngine = window.GoodJunkVR.GameEngine;
