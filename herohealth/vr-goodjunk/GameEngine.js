// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (FINAL v3.1)
// FIX v3.1 (สำคัญ):
// - Ensure layer exists (auto-create #gj-layer if missing)
// - Place target immediately (fallback2D) so it never "invisible"
// - More robust pointer/click handlers (mobile)
// - Extra debug logs

'use strict';

(function (ns) {
  const ROOT = (typeof window !== 'undefined' ? window : globalThis);

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

  // ===== Ensure DOM layer =====
  function ensureLayer(optsLayerEl){
    let el = optsLayerEl || document.getElementById('gj-layer');

    if (!el){
      el = document.createElement('div');
      el.id = 'gj-layer';
      Object.assign(el.style, {
        position:'fixed',
        inset:'0',
        zIndex:'9999',
        pointerEvents:'auto',
        touchAction:'none'
      });
      document.body.appendChild(el);
      console.warn('[GoodJunkVR] #gj-layer not found → auto-created');
    } else {
      // กันกรณี CSS/DOM ไปตั้งผิด
      try{
        const st = getComputedStyle(el);
        if (st.position === 'static') el.style.position = 'fixed';
        el.style.inset = '0';
        el.style.pointerEvents = 'auto';
        el.style.zIndex = el.style.zIndex || '9999';
      }catch(_){}
    }
    return el;
  }

  // ===== World spawn (หน้า camera) =====
  function spawnWorld(){
    const THREE = getTHREE();
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
    const THREE = getTHREE();
    const scene = sceneRef();
    if (!scene || !scene.camera || !THREE || !pos) return null;

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

    el.dataset.kind =
      emoji === STAR   ? 'star'   :
      emoji === FIRE   ? 'diamond':
      emoji === SHIELD ? 'shield' : kind;

    // fallback 2D (กันจอดำ/กันไม่เห็น)
    const fallback2D = {
      x: Math.round(window.innerWidth  * (0.2 + Math.random()*0.6)),
      y: Math.round(window.innerHeight * (0.25 + Math.random()*0.55))
    };

    // ✅ วางตำแหน่งทันที (ไม่ต้องรอ renderLoop)
    el.style.display = 'block';
    el.style.left = fallback2D.x + 'px';
    el.style.top  = fallback2D.y + 'px';

    const t = {
      el,
      kind,
      emoji,
      pos: null,
      born: performance.now(),
      seen: false,
      fallback2D
    };

    active.push(t);
    layerEl.appendChild(el);

    const handler = (ev)=>{
      ev.preventDefault();
      const x = (ev.clientX != null) ? ev.clientX : fallback2D.x;
      const y = (ev.clientY != null) ? ev.clientY : fallback2D.y;
      hitTarget(t, x, y);
    };

    // ✅ mobile friendly: pointer + click + touch
    el.addEventListener('pointerdown', handler, { passive:false });
    el.addEventListener('click', handler, { passive:false });
    el.addEventListener('touchstart', (ev)=>{
      const touch = (ev.touches && ev.touches[0]) ? ev.touches[0] : null;
      handler({ preventDefault(){ ev.preventDefault(); }, clientX: touch?.clientX, clientY: touch?.clientY });
    }, { passive:false });

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

    // MISS เฉพาะ "ปล่อยของดี" และต้องเคยเห็นจริง
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

      // ถ้าเริ่มพร้อมแล้ว ค่อยสร้าง pos 3D
      if (!t.pos && ready){
        t.pos = spawnWorld();
      }

      let p = null;

      if (ready && t.pos){
        p = project(t.pos);
      }

      if (!p){
        p = t.fallback2D;
      }else{
        t.seen = true;
      }

      t.el.style.display = 'block';
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
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

    layerEl = ensureLayer(opts.layerEl);

    score=0; combo=0; comboMax=0; goodHits=0; misses=0;
    shield=0;

    feverActive=false;
    feverPrev=false;

    if (FeverUI && typeof FeverUI.reset === 'function'){
      FeverUI.reset();
    }

    console.log('[GoodJunkVR] start OK', {
      diff,
      layerFound: !!layerEl,
      layerId: layerEl?.id,
      hasAFRAME: !!ROOT.AFRAME,
      hasTHREE: !!getTHREE()
    });

    emitScore();

    // ✅ สร้างเป้าชุดแรกทันที (กันเห็นว่าง)
    for (let i=0;i<3;i++){
      createTarget(Math.random() < 0.7 ? 'good' : 'junk');
    }

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