// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (Production Ready)
// 2025-12 PATCHED:
// - FIX target stuck at center (set left/top immediately + fallback screen pos)
// - MISS definition: miss = good expired + junk hit (NO junk expired)
// - Shield blocks junk hit => NOT a miss (no combo reset)
// - Emit hha:score with {score, goodHits, combo, comboMax, misses} always
// - Adaptive target scale in Play mode (combo + fever + timeLeft). Research mode = fixed
// - ES module export + window namespace

(function (ns) {
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

  // ===== Tunables =====
  const MAX_ACTIVE_DEFAULT = 4;
  const SPAWN_BASE_MS = 900;
  const LIFE_MS_MIN = 1800;
  const LIFE_MS_MAX = 2600;

  // Fever
  const FEVER_MS = 6500;

  // ===== State =====
  let running=false, layerEl=null;
  let active=[], spawnTimer=null, rafId=null;

  let score=0, goodHits=0, combo=0, comboMax=0, misses=0;
  let feverActive=false, feverUntil=0;
  let shield=0;

  let diff='normal', runMode='play';

  // adaptive
  let baseScale = 1.0;     // from diff
  let liveScale = 1.0;     // base + adaptive

  // ===== Helpers =====
  function clamp(v,min,max){
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function now(){ return performance.now ? performance.now() : Date.now(); }

  function emit(type,detail){
    try{ ROOT.dispatchEvent(new CustomEvent(type,{detail})); }catch(_){}
  }

  function pickDiffBaseScale(d){
    d = String(d||'normal').toLowerCase();
    if (d === 'easy') return 1.18;
    if (d === 'hard') return 0.92;
    return 1.05;
  }

  function shouldAdaptive(){
    return String(runMode||'play').toLowerCase() !== 'research';
  }

  // ===== Camera helpers (for world->screen) =====
  function getCam(){
    const camEl=document.querySelector('a-camera');
    if (camEl && camEl.getObject3D){
      const c = camEl.getObject3D('camera');
      if (c) return c;
    }
    const scene=document.querySelector('a-scene');
    return scene && scene.camera ? scene.camera : null;
  }

  const tmpV = (THREE && THREE.Vector3) ? new THREE.Vector3() : null;

  function projectWorldToScreen(worldPos){
    const cam=getCam();
    if(!cam || !tmpV || !worldPos) return null;
    tmpV.copy(worldPos).project(cam);
    if(tmpV.z < -1 || tmpV.z > 1) return null;
    return {
      x:(tmpV.x*0.5+0.5)*innerWidth,
      y:(-tmpV.y*0.5+0.5)*innerHeight
    };
  }

  function spawnWorldPos(){
    if(!THREE) return null;
    const camEl=document.querySelector('a-camera');
    if(!camEl || !camEl.object3D) return null;

    const pos=new THREE.Vector3();
    camEl.object3D.getWorldPosition(pos);

    const dir=new THREE.Vector3();
    camEl.object3D.getWorldDirection(dir);

    // 2.0m in front + random offset in camera space-ish
    pos.add(dir.multiplyScalar(2.0));
    pos.x += (Math.random()-0.5)*1.8;
    pos.y += (Math.random()-0.5)*1.2;

    return pos;
  }

  function spawnScreenPos(){
    // safe random screen position (avoid HUD corners a bit)
    const padX = Math.max(48, innerWidth * 0.10);
    const padYTop = Math.max(80, innerHeight * 0.12);
    const padYBot = Math.max(110, innerHeight * 0.18);
    const x = padX + Math.random() * Math.max(1, innerWidth - padX*2);
    const y = padYTop + Math.random() * Math.max(1, innerHeight - padYTop - padYBot);
    return { x, y };
  }

  // ===== Adaptive scale =====
  function computeAdaptiveScale(){
    // research mode: locked
    if (!shouldAdaptive()) return baseScale;

    // combo higher => smaller
    const comboFactor = clamp(1.12 - (comboMax * 0.018), 0.78, 1.12);

    // fever active => smaller a bit (harder)
    const feverFactor = feverActive ? 0.92 : 1.0;

    // timeLeft unknown in engine; but HUD fires hha:time. We'll mirror via listener.
    // if low time => slightly bigger (help finish)
    const t = clamp(engineTimeLeft, 0, 180);
    const timeFactor = (t <= 12) ? 1.18 : (t <= 25 ? 1.10 : 1.0);

    // misses high => slightly bigger to recover
    const missFactor = (misses >= 6) ? 1.12 : (misses >= 3 ? 1.06 : 1.0);

    const s = baseScale * comboFactor * feverFactor * timeFactor * missFactor;
    return clamp(s, 0.75, 1.35);
  }

  // engine knows timeLeft via event
  let engineTimeLeft = 60;
  function hookTimeListener(){
    function onTime(e){
      const d = (e && e.detail) || {};
      const sec = Number(d.sec);
      if (!isFinite(sec)) return;
      engineTimeLeft = sec;
    }
    ROOT.addEventListener('hha:time', onTime);
    // store for cleanup
    timeListener = onTime;
  }
  let timeListener = null;

  // ===== Targets =====
  function setTargetPosPx(el, x, y){
    if (!el) return;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
  }

  function applyTargetScale(el, s){
    if (!el) return;
    el.style.setProperty('--tScale', String(s));
  }

  function chooseEmoji(kind){
    if (kind === 'good'){
      // 12% chance power-up
      if (Math.random() < 0.12) return POWER[(Math.random()*POWER.length)|0];
      return GOOD[(Math.random()*GOOD.length)|0];
    }
    return JUNK[(Math.random()*JUNK.length)|0];
  }

  function kindFromEmoji(baseKind, emoji){
    if (emoji === STAR) return 'star';
    if (emoji === FIRE) return 'diamond'; // keep your old mapping
    if (emoji === SHIELD) return 'shield';
    return baseKind;
  }

  function createTarget(baseKind){
    if (!layerEl) return;

    const el=document.createElement('div');
    el.className='gj-target ' + (baseKind==='good'?'gj-good':'gj-junk');

    const emoji = chooseEmoji(baseKind);
    el.textContent = emoji;

    // gaze/reticle hook
    el.setAttribute('data-hha-tgt','1');
    el.dataset.kind = kindFromEmoji(baseKind, emoji);

    // create target object
    const worldPos = spawnWorldPos();
    const screenPos = spawnScreenPos();

    const t = {
      el,
      baseKind, // 'good' | 'junk'
      emoji,
      worldPos,
      screenPos,  // fallback / last-known
      born: now(),
      lifeMs: LIFE_MS_MIN + Math.random()*(LIFE_MS_MAX-LIFE_MS_MIN),
      expired:false
    };

    active.push(t);
    layerEl.appendChild(el);

    // IMPORTANT: set pos immediately to avoid "stuck at 50/50"
    let p = projectWorldToScreen(worldPos);
    if (!p) p = screenPos;
    setTargetPosPx(el, p.x, p.y);

    // apply current adaptive scale
    applyTargetScale(el, liveScale);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hit(t, e.clientX, e.clientY);
    }, { passive:false });

    return t;
  }

  function destroy(t, wasHit){
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i,1);

    if (t && t.el){
      if (wasHit){
        t.el.classList.add('hit');
        setTimeout(()=>{ try{ t.el.remove(); }catch(_){} }, 120);
      }else{
        try{ t.el.remove(); }catch(_){}
      }
    }
  }

  function expireIfNeeded(t, ts){
    if (!t || t.expired) return;
    const age = ts - t.born;
    if (age < t.lifeMs) return;

    t.expired = true;
    // ✅ MISS rule: only GOOD expired counts as miss
    if (t.baseKind === 'good'){
      misses++;
      combo = 0; // good missed => break combo
      emit('hha:miss', { misses });
      emitScore();
    }
    // ❌ junk expired => not miss
    destroy(t, false);
  }

  function emitScore(){
    emit('hha:score', {
      score,
      goodHits,
      combo,
      comboMax,
      misses
    });
  }

  function startFever(){
    feverActive = true;
    feverUntil = now() + FEVER_MS;
    setFeverActive(true);
    emit('hha:fever', { state:'start' });
  }

  function stopFever(){
    feverActive = false;
    feverUntil = 0;
    setFeverActive(false);
    emit('hha:fever', { state:'end' });
  }

  function hit(t, x, y){
    if (!running || !t || t.expired) return;

    destroy(t, true);

    // power-ups (they still behave like "good hit" for flow)
    if (t.emoji === STAR){
      score += 40;
      combo++;
      comboMax = Math.max(comboMax, combo);
      goodHits++;
      Particles.scorePop(x,y,'+40',{ good:true });
      emit('hha:judge', { label:'BONUS' });
      emitScore();
      return;
    }

    if (t.emoji === FIRE){
      startFever();
      // treat as good hit too (small points)
      score += 10;
      combo++;
      comboMax = Math.max(comboMax, combo);
      goodHits++;
      Particles.scorePop(x,y,'+10',{ good:true });
      emit('hha:judge', { label:'FEVER!' });
      emitScore();
      return;
    }

    if (t.emoji === SHIELD){
      shield = Math.min(3, shield + 1);
      setShield(shield);
      // treat as good hit (small points)
      score += 10;
      combo++;
      comboMax = Math.max(comboMax, combo);
      goodHits++;
      Particles.scorePop(x,y,'+10',{ good:true });
      emit('hha:judge', { label:'SHIELD+' });
      emitScore();
      return;
    }

    // junk hit
    if (t.baseKind === 'junk'){
      // ✅ Shield blocks => NOT miss
      if (shield > 0){
        shield--;
        setShield(shield);
        Particles.scorePop(x,y,'BLOCK',{ good:true, judgment:'🛡️' });
        emit('hha:judge', { label:'BLOCK' });
        // combo is not broken when blocked
        emitScore();
        return;
      }

      // ✅ MISS: junk hit counts
      misses++;
      combo = 0;
      emit('hha:miss', { misses });
      emit('hha:judge', { label:'MISS' });
      emitScore();
      return;
    }

    // good hit
    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    const mult = feverActive ? 2 : 1;
    const add = 10 * mult;
    score += add;

    Particles.scorePop(x,y,'+'+add,{ good:true });
    emit('hha:judge', { label: (combo >= 6 ? 'PERFECT' : 'GOOD') });
    emitScore();
  }

  // ===== Loops =====
  function updateAdaptive(){
    liveScale = computeAdaptiveScale();
    // apply to existing targets smoothly
    for (const t of active){
      applyTargetScale(t.el, liveScale);
    }
  }

  function loop(){
    if (!running) return;

    const ts = now();

    // fever timeout
    if (feverActive && feverUntil > 0 && ts >= feverUntil){
      stopFever();
    }

    // adaptive refresh
    updateAdaptive();

    // update positions
    for (const t of active){
      // expire?
      expireIfNeeded(t, ts);

      // update screen pos (world projection first)
      if (!t.el || t.expired) continue;

      let p = null;
      if (t.worldPos) p = projectWorldToScreen(t.worldPos);
      if (!p) p = t.screenPos; // fallback

      // keep fallback updated in case rotate/resolution changes
      if (p && typeof p.x === 'number' && typeof p.y === 'number'){
        t.screenPos = p;
        setTargetPosPx(t.el, p.x, p.y);
      }
    }

    rafId = requestAnimationFrame(loop);
  }

  function spawn(){
    if (!running) return;

    const maxActive = MAX_ACTIVE_DEFAULT;
    if (active.length < maxActive){
      const baseKind = (Math.random() < 0.70) ? 'good' : 'junk';
      createTarget(baseKind);
    }

    spawnTimer = setTimeout(spawn, SPAWN_BASE_MS);
  }

  // ===== API =====
  function start(d, opts={}){
    if (running) return;

    diff = String(d || 'normal').toLowerCase();
    runMode = String(opts.runMode || 'play').toLowerCase();

    layerEl = opts.layerEl || document.getElementById('gj-layer');
    if (!layerEl){
      layerEl = document.createElement('div');
      layerEl.id = 'gj-layer';
      Object.assign(layerEl.style, { position:'fixed', inset:'0', zIndex:'649', pointerEvents:'auto' });
      document.body.appendChild(layerEl);
    }

    // base scale from diff
    baseScale = pickDiffBaseScale(diff);
    liveScale = baseScale;

    // reset state
    running = true;
    active.length = 0;

    score = 0;
    goodHits = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;

    feverActive = false;
    feverUntil = 0;
    shield = 0;

    engineTimeLeft = (typeof opts.durationSec === 'number') ? (opts.durationSec|0) : 60;

    // UI init
    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    setShield(0);

    // listen time for adaptive (needs cleanup on stop)
    hookTimeListener();

    emitScore();
    emit('quest:update', {}); // let HUD settle
    loop();
    spawn();
  }

  function stop(reason){
    if (!running) return;

    running = false;

    if (spawnTimer) clearTimeout(spawnTimer);
    spawnTimer = null;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    // cleanup time listener
    if (timeListener){
      try{ ROOT.removeEventListener('hha:time', timeListener); }catch(_){}
      timeListener = null;
    }

    // remove targets
    const copy = active.slice();
    active.length = 0;
    for (const t of copy) destroy(t,false);

    // end payload (html uses this)
    emit('hha:end', {
      reason: String(reason || ''),
      scoreFinal: score,
      comboMax: comboMax,
      misses: misses,
      goodHits: goodHits
    });
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

// ✅ ES module export
export const GameEngine = window.GoodJunkVR.GameEngine;
