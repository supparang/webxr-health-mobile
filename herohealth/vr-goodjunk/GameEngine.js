// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (FINAL v2.1)
// MISS = good expired + junk hit (shield block = NO miss)
//
// FIX v2.1:
// - FEVER edge start/end dispatch works (previous logic never fired)
// - seen=true when actually rendered on screen (project OR fallback2D)
// - VR gaze support for DOM targets: aim-at-center + fuse → auto hit
//
// Notes:
// - A-Frame raycaster cannot hit DOM targets, so gaze must be implemented in DOM layer.

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

  // fever edge
  let feverActive=false; // last-known
  let feverPrev=false;

  // gaze (for VR headset)
  let gazeEnabled=false;
  let gazeFuseMs=650;
  let gazeRadiusPx=70;
  let gazeStartMs=0;
  let gazeTarget=null;

  // ===== Dynamic THREE getter (สำคัญมาก) =====
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
    try{
      ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ label }}));
    }catch(_){}
  }
  function emitMiss(){
    try{
      ROOT.dispatchEvent(new CustomEvent('hha:miss',{ detail:{ misses }}));
    }catch(_){}
  }

  // FIX: fever edge dispatch must compare "now" vs "previous stored"
  function syncFeverEdge(){
    if (!FeverUI || typeof FeverUI.isActive !== 'function'){
      feverPrev = false;
      feverActive = false;
      return;
    }

    const now = !!FeverUI.isActive();
    const prev = !!feverActive; // stored previous

    if (now && !prev){
      try{ ROOT.dispatchEvent(new CustomEvent('hha:fever',{ detail:{ state:'start' }})); }catch(_){}
    } else if (!now && prev){
      try{ ROOT.dispatchEvent(new CustomEvent('hha:fever',{ detail:{ state:'end' }})); }catch(_){}
    }

    feverPrev = prev;
    feverActive = now;
  }

  function emitScore(){
    syncFeverEdge();

    try{
      ROOT.dispatchEvent(new CustomEvent('hha:score',{
        detail:{ score, combo, comboMax, goodHits, misses, feverActive, shield }
      }));
    }catch(_){}
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

    // fallback 2D (กันจอดำ/กันไปรวมมุมซ้ายบน)
    const fallback2D = {
      x: Math.round(window.innerWidth  * (0.2 + Math.random()*0.6)),
      y: Math.round(window.innerHeight * (0.25 + Math.random()*0.55))
    };

    const t = {
      el,
      kind,
      emoji,
      pos: spawnWorld(),     // อาจ null
      born: performance.now(),
      seen: false,
      fallback2D
    };

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      hitTarget(t, e.clientX || (window.innerWidth/2), e.clientY || (window.innerHeight/2));
    }, { passive:false });

    setTimeout(()=>expireTarget(t), 2200);
  }

  function removeTarget(t){
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i,1);
    if (t && t.el) t.el.remove();
    if (gazeTarget === t){
      gazeTarget = null;
      gazeStartMs = 0;
    }
  }

  function expireTarget(t){
    if (!running) return;
    removeTarget(t);

    // ✅ MISS เฉพาะ "ปล่อยของดี" และต้องเคยถูก render บนจอจริง
    if (t.kind === 'good' && t.seen){
      misses++;
      combo = 0;
      emitJudge('MISS');
      emitScore();
      emitMiss();
    }
  }

  function hitTarget(t, x, y){
    if (!t || !t.el) return;
    removeTarget(t);

    // POWER: SHIELD
    if (t.emoji === SHIELD){
      shield = Math.min(3, shield + 1);
      emitJudge('SHIELD');
      emitScore();
      return;
    }

    // POWER: FIRE -> add fever
    if (t.emoji === FIRE && FeverUI && typeof FeverUI.add === 'function'){
      FeverUI.add(20);
      emitJudge('FEVER+');
      emitScore();
      return;
    }

    // JUNK
    if (t.kind === 'junk'){
      if (shield > 0){
        shield--;
        emitJudge('BLOCK');
        emitScore();
        return;
      }
      misses++;
      combo = 0;
      emitJudge('MISS');
      emitScore();
      emitMiss();
      return;
    }

    // GOOD
    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    const feverNow = (FeverUI && typeof FeverUI.isActive === 'function') ? !!FeverUI.isActive() : false;
    score += feverNow ? 20 : 10;

    if (Particles && typeof Particles.scorePop === 'function'){
      Particles.scorePop(x, y, feverNow ? '+20' : '+10', { good:true });
    }

    emitJudge(combo >= 6 ? 'PERFECT' : 'GOOD');
    emitScore();
  }

  // ===== Gaze hit-test (DOM) =====
  function centerAimTick(){
    if (!gazeEnabled || !running || active.length === 0) {
      gazeTarget = null;
      gazeStartMs = 0;
      return;
    }

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    let best = null;
    let bestDist = Infinity;

    for (const t of active){
      if (!t || !t.el) continue;
      const r = t.el.getBoundingClientRect();
      if (!r || !isFinite(r.left)) continue;

      const tx = r.left + r.width/2;
      const ty = r.top  + r.height/2;

      const dx = tx - cx;
      const dy = ty - cy;
      const d2 = dx*dx + dy*dy;

      if (d2 < bestDist){
        bestDist = d2;
        best = t;
      }
    }

    const dist = Math.sqrt(bestDist);
    const within = best && dist <= gazeRadiusPx;

    if (!within){
      gazeTarget = null;
      gazeStartMs = 0;
      return;
    }

    if (gazeTarget !== best){
      gazeTarget = best;
      gazeStartMs = performance.now();
      return;
    }

    const held = performance.now() - gazeStartMs;
    if (held >= gazeFuseMs && gazeTarget){
      // ยิงตรงกลางจอ
      const hit = gazeTarget;
      gazeTarget = null;
      gazeStartMs = 0;
      hitTarget(hit, cx, cy);
    }
  }

  // ===== Loops =====
  function renderLoop(){
    if (!running) return;

    const ready = cameraReady();

    for (const t of active){
      if (!t || !t.el) continue;

      if (!t.pos && ready){
        t.pos = spawnWorld();
      }

      let p = null;

      // try 3D project
      if (ready && t.pos){
        p = project(t.pos);
      }

      // fallback 2D
      if (!p){
        p = t.fallback2D;
      }

      // ✅ seen=true เมื่อ render จริง (project หรือ fallback ก็ถือว่าเห็นแล้ว)
      t.seen = true;

      t.el.style.display = 'block';
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
    }

    // gaze logic after positions settled
    centerAimTick();

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

    // gaze options (for VR headset)
    gazeEnabled = !!opts.gaze;
    gazeFuseMs = Math.max(250, Number(opts.gazeFuseMs ?? 650) || 650);
    gazeRadiusPx = Math.max(30, Number(opts.gazeRadiusPx ?? 70) || 70);
    gazeStartMs = 0;
    gazeTarget = null;

    score=0; combo=0; comboMax=0; goodHits=0; misses=0;
    shield=0;

    feverActive=false;
    feverPrev=false;

    if (FeverUI && typeof FeverUI.reset === 'function'){
      FeverUI.reset();
    }

    console.log('[GoodJunkVR] GameEngine.start OK', {
      diff,
      gazeEnabled,
      gazeFuseMs,
      gazeRadiusPx,
      hasAFRAME:!!ROOT.AFRAME,
      hasTHREE:!!getTHREE()
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

    gazeEnabled = false;
    gazeStartMs = 0;
    gazeTarget = null;

    const copy = active.slice();
    for (const t of copy) removeTarget(t);
    active.length = 0;

    try{
      ROOT.dispatchEvent(new CustomEvent('hha:end',{
        detail:{ scoreFinal:score, comboMax, misses, reason }
      }));
    }catch(_){}
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

export const GameEngine = window.GoodJunkVR.GameEngine;