// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (FINAL v3 P5-tuned)
// MISS = good expired (seen) + junk hit (shield block = NO miss)
//
// v3:
// - Diff tuning: spawnEveryMs / ttlMs / maxActive / goodRatio / targetScale
// - Endgame ramp: last 10s -> faster spawn + shorter ttl (exciting finish)
// - Fallback 2D positions if 3D project not ready (targets always visible)

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

  // ===== Difficulty tuning for P.5 (fun + challenge) =====
  const DIFF_TUNE = {
    easy:   { spawnEveryMs: 820, ttlMs: 2400, maxActive: 4, goodRatio: 0.72, powerRate: 0.12, tScale: 1.18 },
    normal: { spawnEveryMs: 700, ttlMs: 2100, maxActive: 5, goodRatio: 0.68, powerRate: 0.12, tScale: 1.08 },
    hard:   { spawnEveryMs: 600, ttlMs: 1900, maxActive: 6, goodRatio: 0.64, powerRate: 0.10, tScale: 1.00 }
  };

  // Endgame ramp (last N seconds)
  const ENDGAME_SEC = 10;
  const ENDGAME_SPAWN_MULT = 0.85; // faster
  const ENDGAME_TTL_MULT   = 0.90; // shorter

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

  // runtime config
  let cfg = { ...DIFF_TUNE.normal };
  let startMs = 0;
  let durationSec = 60;

  // ===== Dynamic THREE getter =====
  function getTHREE(){
    return ROOT.THREE || (ROOT.AFRAME && ROOT.AFRAME.THREE) || null;
  }
  function sceneRef(){ return document.querySelector('a-scene') || null; }
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

  // ===== World spawn =====
  function spawnWorld(){
    const THREE = getTHREE();
    const cam = getCameraObj3D();
    if (!cam || !THREE) return null;

    const pos = new THREE.Vector3();
    cam.getWorldPosition(pos);

    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);

    // slightly closer for kids (feel hittable)
    pos.add(dir.multiplyScalar(2.05));
    pos.x += (Math.random()-0.5)*1.9;
    pos.y += (Math.random()-0.5)*1.45;

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

  function nowSecLeft(){
    if (!durationSec || durationSec <= 0) return 9999;
    const elapsed = (performance.now() - startMs) / 1000;
    return Math.max(0, durationSec - elapsed);
  }

  function currentSpawnEveryMs(){
    let s = cfg.spawnEveryMs;
    if (nowSecLeft() <= ENDGAME_SEC) s = Math.round(s * ENDGAME_SPAWN_MULT);
    return Math.max(260, s);
  }

  function currentTtlMs(){
    let t = cfg.ttlMs;
    if (nowSecLeft() <= ENDGAME_SEC) t = Math.round(t * ENDGAME_TTL_MULT);
    return Math.max(900, t);
  }

  // ===== Target =====
  function createTarget(){
    if (!layerEl) return;

    const isGood = Math.random() < cfg.goodRatio;
    const kind = isGood ? 'good' : 'junk';

    const el = document.createElement('div');
    el.className = 'gj-target ' + (kind === 'good' ? 'gj-good' : 'gj-junk');
    el.style.setProperty('--tScale', String(cfg.tScale || 1));

    let emoji = '';
    if (kind === 'good'){
      const rollPower = Math.random() < (cfg.powerRate || 0.1);
      emoji = rollPower
        ? POWER[Math.floor(Math.random()*POWER.length)]
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

    // fallback 2D (กันจอดำ/กันไปกองมุมซ้ายบน)
    const fallback2D = {
      x: Math.round(window.innerWidth  * (0.18 + Math.random()*0.64)),
      y: Math.round(window.innerHeight * (0.22 + Math.random()*0.60))
    };

    const t = {
      el,
      kind,
      emoji,
      pos: spawnWorld(),
      born: performance.now(),
      seen: false,
      fallback2D
    };

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    const ttl = currentTtlMs();
    setTimeout(()=>expireTarget(t), ttl);
  }

  function removeTarget(t){
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i,1);
    if (t.el) t.el.remove();
  }

  function expireTarget(t){
    if (!running) return;
    removeTarget(t);

    // ✅ MISS เฉพาะ "ปล่อยของดี" และต้องเคยเห็นจริง
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

    // POWER: SHIELD
    if (t.emoji === SHIELD){
      shield = Math.min(3, shield + 1);
      emitScore();
      emitJudge('SHIELD');
      return;
    }

    // POWER: FIRE (เติม fever)
    if (t.emoji === FIRE && FeverUI && typeof FeverUI.add === 'function'){
      FeverUI.add(20);
      emitScore();
      emitJudge('FEVER+');
      return;
    }

    // JUNK
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

    const maxA = Math.max(1, cfg.maxActive|0);
    if (active.length < maxA){
      createTarget();
    }

    const every = currentSpawnEveryMs();
    spawnTimer = setTimeout(spawnLoop, every);
  }

  // ===== API =====
  function start(diff, opts={}){
    if (running) return;
    running = true;

    const dk = String(diff || 'normal').toLowerCase();
    cfg = { ...(DIFF_TUNE[dk] || DIFF_TUNE.normal) };

    layerEl = opts.layerEl || document.getElementById('gj-layer');

    durationSec = Number(opts.durationSec || 60) || 60;
    startMs = performance.now();

    score=0; combo=0; comboMax=0; goodHits=0; misses=0; shield=0;
    feverActive=false; feverPrev=false;

    if (FeverUI && typeof FeverUI.reset === 'function') FeverUI.reset();

    console.log('[GoodJunkVR] Engine start', { diff: dk, cfg, durationSec });

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