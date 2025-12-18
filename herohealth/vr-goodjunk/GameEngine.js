// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (FINAL v3)
// MISS = good expired + junk hit (shield block = NO miss)
//
// FIX v3 (สำคัญสำหรับ “ลากหมุนมุมมองแล้วเป้าต้องขยับตาม”):
// - ไม่ใช้ fallback2D เป็นตำแหน่งถาวรเมื่อ camera พร้อมแล้ว
// - ถ้า project fail ในขณะ camera ready -> re-seed world pos ใหม่ทันที แล้วลอง project อีกครั้ง
// - ใช้ fallback2D เฉพาะช่วง camera ยังไม่ ready เท่านั้น
// - เป้าจะ “ตามการหมุนกล้อง” เพราะทุกเฟรมจะ project ใหม่จาก world pos -> screen

'use strict';

(function (ns) {
  const ROOT = (typeof window !== 'undefined') ? window : globalThis;

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

  // ===== Dynamic THREE getter =====
  function getTHREE(){
    return ROOT.THREE || (ROOT.AFRAME && ROOT.AFRAME.THREE) || null;
  }
  function sceneRef(){
    return document.querySelector('a-scene') || null;
  }
  function cameraReady(){
    const scene = sceneRef();
    const THREE = getTHREE();
    return !!(scene && scene.camera && THREE);
  }
  function getCameraObj3D(){
    const camEl =
      document.querySelector('#gj-camera') ||
      document.querySelector('a-camera');
    if (camEl && camEl.object3D) return camEl.object3D;
    return null;
  }

  // ===== Spawn in front of camera (world) =====
  function spawnWorld(){
    const THREE = getTHREE();
    const cam = getCameraObj3D();
    if (!cam || !THREE) return null;

    const pos = new THREE.Vector3();
    cam.getWorldPosition(pos);

    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);

    // ระยะหน้า camera (จูนให้เด็ก ป.5 เล่นง่ายขึ้น)
    pos.add(dir.multiplyScalar(2.1));

    // กระจายซ้ายขวา/ขึ้นลง (ให้ไม่ไปกองมุม)
    pos.x += (Math.random()-0.5)*1.7;
    pos.y += (Math.random()-0.5)*1.25;

    return pos;
  }

  // ===== Project 3D → 2D =====
  function project(pos){
    const THREE = getTHREE();
    const scene = sceneRef();
    if (!scene || !scene.camera || !THREE || !pos) return null;

    const v = pos.clone().project(scene.camera);

    // อยู่นอก frustum
    if (v.z < -1 || v.z > 1) return null;

    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;

    // กัน NaN/Infinity
    if (!isFinite(x) || !isFinite(y)) return null;

    return { x, y };
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
    if (FeverUI && typeof FeverUI.isActive === 'function'){
      feverActive = !!FeverUI.isActive();
      emitFeverEdgeIfNeeded();
    }else{
      feverActive = false;
      feverPrev = false;
    }

    ROOT.dispatchEvent(new CustomEvent('hha:score',{
      detail:{ score, combo, comboMax, goodHits, misses, feverActive, shield }
    }));
  }

  // ===== Target create/remove =====
  function createTarget(kind){
    if (!layerEl) return;

    const el = document.createElement('div');
    el.className = 'gj-target ' + (kind === 'good' ? 'gj-good' : 'gj-junk');

    let emoji = kind === 'good'
      ? (Math.random() < 0.12 ? POWER[Math.floor(Math.random()*POWER.length)]
                              : GOOD[Math.floor(Math.random()*GOOD.length)])
      : JUNK[Math.floor(Math.random()*JUNK.length)];

    el.textContent = emoji;
    el.setAttribute('data-hha-tgt','1');

    el.dataset.kind =
      emoji === STAR   ? 'star'   :
      emoji === FIRE   ? 'diamond':
      emoji === SHIELD ? 'shield' : kind;

    const t = {
      el,
      kind,
      emoji,
      pos: cameraReady() ? spawnWorld() : null,
      born: performance.now(),
      seen: false,
      // fallback2D ใช้เฉพาะตอน camera ยังไม่ ready
      fallback2D: {
        x: Math.round(window.innerWidth  * (0.20 + Math.random()*0.60)),
        y: Math.round(window.innerHeight * (0.25 + Math.random()*0.55))
      }
    };

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    setTimeout(()=>expireTarget(t), 2200);
  }

  function removeTarget(t){
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i,1);
    if (t.el) t.el.remove();
  }

  function expireTarget(t){
    if (!running) return;
    removeTarget(t);

    // ✅ MISS เฉพาะ good ที่ “เคยเห็นจริงบนจอ”
    if (t.kind === 'good' && t.seen){
      misses++;
      combo = 0;
      emitScore();
      emitMiss();
      emitJudge('MISS');
    }
  }

  function hitTarget(t, x, y){
    if (!t || !t.el) return;
    removeTarget(t);

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

    if (t.kind === 'junk'){
      if (shield > 0){
        shield--;
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

    // GOOD
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

    const ready = cameraReady();

    for (const t of active){
      if (!t || !t.el) continue;

      // ถ้า camera เพิ่งพร้อม ให้สร้าง pos ใหม่ทันที
      if (ready && !t.pos){
        t.pos = spawnWorld();
      }

      let p = null;

      if (ready && t.pos){
        p = project(t.pos);

        // ✅ FIX v3: ถ้า project fail ทั้งที่ camera พร้อม -> re-seed pos แล้วลองอีกครั้ง
        if (!p){
          t.pos = spawnWorld();
          p = t.pos ? project(t.pos) : null;
        }

        // ถ้ายังไม่ได้ ให้รอเฟรมหน้า (อย่าใช้ fallback ค้าง)
        if (!p){
          t.el.style.opacity = '0';
          continue;
        }

        t.seen = true;
        t.el.style.opacity = '';
      } else {
        // camera ยังไม่พร้อม → ใช้ fallback2D ชั่วคราว
        p = t.fallback2D;
        t.el.style.opacity = '';
      }

      t.el.style.display = 'block';
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  function spawnLoop(){
    if (!running) return;

    // จูนให้สนุก/เร้าใจสำหรับ ป.5: โผล่ถี่ขึ้นนิด
    if (active.length < 5){
      createTarget(Math.random() < 0.72 ? 'good' : 'junk');
    }

    // เดิม 900 → เร็วขึ้นเล็กน้อย
    spawnTimer = setTimeout(spawnLoop, 780);
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

    console.log('[GoodJunkVR] GameEngine.start v3', {
      diff,
      hasAFRAME: !!ROOT.AFRAME,
      hasTHREE:  !!getTHREE(),
      camReady:  cameraReady()
    });

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

    const copy = active.slice();
    for (const t of copy) removeTarget(t);
    active.length = 0;

    ROOT.dispatchEvent(new CustomEvent('hha:end',{
      detail:{ scoreFinal:score, comboMax, misses, reason }
    }));
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

export const GameEngine = window.GoodJunkVR.GameEngine;