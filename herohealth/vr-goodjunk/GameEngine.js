// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (FINAL – Adaptive Ready)
//
// MISS = good expired + junk hit
// (junk hit while SHIELD active = NO miss)
//
// Adaptive (Play mode only):
//  - target size  : diff + combo + fever + timeLeft
//  - spawn speed  : diff + combo + fever + timeLeft
// Research mode:
//  - NO adaptive (fixed by diff)

'use strict';

(function (ns) {

  const ROOT = window;
  const THREE = ROOT.THREE;

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

  // ===== Base difficulty =====
  const BASE = {
    easy:   { scale: 1.15, spawn: 1100 },
    normal: { scale: 1.00, spawn:  900 },
    hard:   { scale: 0.90, spawn:  750 }
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

  // timing
  let startTime=0;
  let durationSec=60;

  // mode
  let diff='normal';
  let adaptiveEnabled=true;

  // ===== Camera helpers =====
  function getCamera(){
    const camEl = document.querySelector('a-camera');
    return camEl && camEl.object3D ? camEl.object3D : null;
  }

  function spawnWorld(){
    const cam = getCamera();
    if (!cam) return null;

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
    const scene = document.querySelector('a-scene');
    if (!scene || !scene.camera) return null;

    const v = pos.clone().project(scene.camera);
    if (v.z < -1 || v.z > 1) return null;

    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  // ===== Time helper =====
  function timeLeftSec(){
    const used = (performance.now() - startTime) / 1000;
    return Math.max(0, durationSec - used);
  }

  // ===== Adaptive =====
  function adaptiveScale(){
    const base = BASE[diff]?.scale ?? 1.0;
    if (!adaptiveEnabled) return base;

    let reduce = 0;
    if (combo >= 5)  reduce += 0.08;
    if (combo >= 10) reduce += 0.10;
    if (combo >= 15) reduce += 0.12;

    if (feverActive) reduce += 0.12;
    if (timeLeftSec() <= 15) reduce += 0.08;

    return Math.max(0.65, Math.min(base, base - reduce));
  }

  function adaptiveSpawn(){
    const base = BASE[diff]?.spawn ?? 900;
    if (!adaptiveEnabled) return base;

    let interval = base;
    if (combo >= 5)  interval -= 120;
    if (combo >= 10) interval -= 180;
    if (combo >= 15) interval -= 220;

    if (feverActive) interval -= 120;
    if (timeLeftSec() <= 15) interval -= 100;

    return Math.max(420, interval);
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

    const t = {
      el,
      kind,
      emoji,
      pos: spawnWorld(),
      born: performance.now()
    };

    el.style.setProperty('--tScale', adaptiveScale().toFixed(2));

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX, e.clientY);
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

    // MISS = ปล่อยของดีเท่านั้น
    if (t.kind === 'good'){
      misses++;
      combo = 0;
      emitScore();
      emitMiss();
    }
  }

  function hitTarget(t, x, y){
    removeTarget(t);

    // SHIELD
    if (t.emoji === SHIELD){
      shield = Math.min(3, shield + 1);
      emitScore();
      return;
    }

    // FEVER
    if (t.emoji === FIRE && FeverUI){
      FeverUI.add(20);
    }

    // JUNK
    if (t.kind === 'junk'){
      if (shield > 0){
        shield--; // shield กัน → ไม่ MISS
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

    // GOOD
    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    feverActive = FeverUI ? FeverUI.isActive() : false;
    score += feverActive ? 20 : 10;

    Particles.scorePop(x, y, feverActive ? '+20' : '+10', { good:true });
    emitJudge(combo >= 6 ? 'PERFECT' : 'GOOD');
    emitScore();
  }

  // ===== Emit =====
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
      }
    }
    rafId = requestAnimationFrame(renderLoop);
  }

  function spawnLoop(){
    if (!running) return;
    if (active.length < 4){
      createTarget(Math.random() < 0.7 ? 'good' : 'junk');
    }
    spawnTimer = setTimeout(spawnLoop, adaptiveSpawn());
  }

  // ===== API =====
  function start(d, opts={}){
    if (running) return;

    diff = d || 'normal';
    durationSec = opts.durationSec || 60;
    startTime = performance.now();

    adaptiveEnabled = (opts.runMode !== 'research');

    layerEl = opts.layerEl || document.getElementById('gj-layer');

    score=combo=comboMax=goodHits=misses=0;
    shield=0;

    if (FeverUI) FeverUI.reset();

    running = true;
    emitScore();
    renderLoop();
    spawnLoop();
  }

  function stop(){
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (spawnTimer) clearTimeout(spawnTimer);
    active.forEach(removeTarget);
    active.length = 0;

    ROOT.dispatchEvent(new CustomEvent('hha:end',{
      detail:{ scoreFinal:score, comboMax, misses }
    }));
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

export const GameEngine = window.GoodJunkVR.GameEngine;
