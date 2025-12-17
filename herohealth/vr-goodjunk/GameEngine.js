// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (FINAL)
// MISS = good expired + junk hit (shield block = NO miss)

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

  // ===== Camera helpers =====
  function getCamera(){
    const camEl = document.querySelector('a-camera');
    if (camEl && camEl.object3D) return camEl.object3D;
    return null;
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
      pos: spawnWorld(),
      born: performance.now()
    };

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX, e.clientY);
    });

    // ===== EXPPIRE =====
    setTimeout(()=>expireTarget(t), 2200);
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
    active.forEach(removeTarget);
    active.length = 0;

    ROOT.dispatchEvent(new CustomEvent('hha:end',{
      detail:{ scoreFinal:score, comboMax, misses }
    }));
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

export const GameEngine = window.GoodJunkVR.GameEngine;
