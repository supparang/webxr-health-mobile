// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (FINAL v3)
// MISS = good expired + junk hit (shield block = NO miss)
// v3:
// - รับ cfg จาก opts.cfg เพื่อจูน spawn/maxActive/junkRatio/lifeMs/powerChance/moveChance/scale
// - fallback 2D + clamp กันเป้าไปกองมุมซ้ายบน/กันจอดำ
// - good-expire นับ MISS เฉพาะที่ "เคยเห็นจริง" (seen=true)

'use strict';

(function (ns) {
  const ROOT = (typeof window !== 'undefined' ? window : globalThis);

  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles || { scorePop(){}, burstAt(){} };

  const FeverUI = ROOT.FeverUI || null;

  const GOOD = ['🍎','🥦','🥕','🍌','🍉','🥛'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🥤'];
  const STAR='⭐', FIRE='🔥', SHIELD='🛡️';
  const POWER=[STAR,FIRE,SHIELD];

  // ===== Runtime config (defaults) =====
  const CFG = {
    spawnMs: 900,
    maxActive: 4,
    junkRatio: 0.33,
    lifeMs: 2150,
    powerChance: 0.12,
    moveChance: 0.34,
    scale: 1.0
  };

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
    const camEl = document.querySelector('#gj-camera') || document.querySelector('a-camera');
    if (camEl && camEl.object3D) return camEl.object3D;
    return null;
  }

  // ===== helpers =====
  function clamp(n, a, b){
    n = Number(n) || 0;
    if (n < a) return a;
    if (n > b) return b;
    return n;
  }

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

  // ===== Emit =====
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

    let emoji = '';
    if (kind === 'good'){
      const power = (Math.random() < clamp(CFG.powerChance, 0, 0.35));
      emoji = power ? POWER[Math.floor(Math.random()*POWER.length)]
                    : GOOD[Math.floor(Math.random()*GOOD.length)];
    }else{
      emoji = JUNK[Math.floor(Math.random()*JUNK.length)];
    }

    el.textContent = emoji;
    el.setAttribute('data-hha-tgt','1');

    el.dataset.kind =
      emoji === STAR   ? 'star'   :
      emoji === FIRE   ? 'diamond':
      emoji === SHIELD ? 'shield' : kind;

    // scale from cfg
    el.style.setProperty('--tScale', String(CFG.scale || 1));

    // fallback 2D
    const padX = 24;
    const padY = 84;
    const fallback2D = {
      x: Math.round(padX + Math.random() * Math.max(1, window.innerWidth - padX*2)),
      y: Math.round(padY + Math.random() * Math.max(1, window.innerHeight - padY*2))
    };

    // moving excitement (เด็ก ป.5)
    const moving = Math.random() < clamp(CFG.moveChance, 0, 0.9);
    const drift2D = moving
      ? { vx: (Math.random()<0.5?-1:1) * (0.25 + Math.random()*0.55), vy: (Math.random()<0.5?-1:1) * (0.15 + Math.random()*0.45) }
      : null;

    let drift3D = null;
    const THREE = getTHREE();
    if (moving && THREE){
      drift3D = new THREE.Vector3(
        (Math.random()<0.5?-1:1) * (0.002 + Math.random()*0.0038),
        (Math.random()<0.5?-1:1) * (0.0015 + Math.random()*0.0032),
        0
      );
    }

    const t = {
      el,
      kind,
      emoji,
      pos: spawnWorld(),     // may null
      born: performance.now(),
      seen: false,
      fallback2D,
      drift2D,
      drift3D
    };

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    // expire by cfg.lifeMs
    const life = clamp(CFG.lifeMs, 900, 4200);
    setTimeout(()=>expireTarget(t), life);
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

      // drift in 3D if possible
      if (ready && t.pos && t.drift3D){
        try{ t.pos.add(t.drift3D); }catch(_){}
      }

      // drift in 2D fallback
      if (t.drift2D){
        t.fallback2D.x += t.drift2D.vx;
        t.fallback2D.y += t.drift2D.vy;
      }

      if (!t.pos && ready){
        t.pos = spawnWorld();
      }

      let p = null;
      if (ready && t.pos){
        p = project(t.pos);
      }

      // fallback 2D
      if (!p){
        p = t.fallback2D;
      }else{
        t.seen = true;
      }

      // clamp within viewport (กันไปกองซ้ายบน/หลุดจอ)
      const padX = 24;
      const padY = 84;
      p.x = clamp(p.x, padX, window.innerWidth - padX);
      p.y = clamp(p.y, padY, window.innerHeight - padY);

      t.el.style.display = 'block';
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  function spawnLoop(){
    if (!running) return;

    const maxA = clamp(CFG.maxActive, 2, 7);
    if (active.length < maxA){
      const jr = clamp(CFG.junkRatio, 0.05, 0.70);
      const kind = (Math.random() < (1 - jr)) ? 'good' : 'junk';
      createTarget(kind);
    }

    const ms = clamp(CFG.spawnMs, 520, 1600);
    spawnTimer = setTimeout(spawnLoop, ms);
  }

  // ===== API =====
  function start(diff, opts={}){
    if (running) return;
    running = true;

    layerEl = opts.layerEl || document.getElementById('gj-layer');

    // apply cfg from html
    if (opts.cfg && typeof opts.cfg === 'object'){
      const c = opts.cfg;
      CFG.spawnMs = Number(c.spawnMs ?? c.baseSpawnMs ?? CFG.spawnMs) || CFG.spawnMs;
      CFG.maxActive = Number(c.maxActiveNow ?? c.maxActive ?? CFG.maxActive) || CFG.maxActive;
      CFG.junkRatio = Number(c.junkRatioNow ?? c.junkRatio ?? CFG.junkRatio);
      CFG.lifeMs = Number(c.lifeMs ?? CFG.lifeMs) || CFG.lifeMs;
      CFG.powerChance = Number(c.powerChance ?? CFG.powerChance);
      CFG.moveChance  = Number(c.moveChance ?? CFG.moveChance);
      CFG.scale       = Number(c.scale ?? CFG.scale) || CFG.scale;
    }

    score=0; combo=0; comboMax=0; goodHits=0; misses=0;
    shield=0;

    feverActive=false;
    feverPrev=false;

    if (FeverUI && typeof FeverUI.reset === 'function'){
      FeverUI.reset();
    }

    console.log('[GoodJunkVR] GameEngine.start OK', {
      diff,
      cfg: { ...CFG },
      hasAFRAME: !!ROOT.AFRAME,
      hasTHREE: !!getTHREE()
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
