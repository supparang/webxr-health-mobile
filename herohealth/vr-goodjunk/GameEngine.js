// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (Production Ready)
// 2025-12 FULL (patched: miss logic + anti-stuck + adaptive scale + richer hha:score)

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

  function isJunkEmoji(e){ return JUNK.indexOf(e) >= 0; }
  function isPowerEmoji(e){ return POWER.indexOf(e) >= 0; }
  function isGoodEmoji(e){ return (GOOD.indexOf(e) >= 0) || isPowerEmoji(e); }

  // ===== State =====
  let running=false, layerEl=null;
  let active=[], spawnTimer=null, rafId=null;

  let score=0, combo=0, comboMax=0;
  let misses=0, goodHits=0;

  let fever=0, feverActive=false;
  let shield=0;

  let diff='normal', runMode='play';

  // timeLeft (รับจาก event hha:time เพื่อใช้ adaptive)
  let timeLeftSec = 60;
  let durationSec = 60;

  // ===== Difficulty baseline (scale only; spawn is fixed here) =====
  const BASE_SCALE = { easy: 1.15, normal: 1.00, hard: 0.90 };

  function clamp(v,min,max){
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  // ===== Camera helpers =====
  function getCam(){
    // prefer a-camera object3D camera
    const camEl = document.querySelector('a-camera');
    if (camEl && camEl.getObject3D){
      const c = camEl.getObject3D('camera');
      if (c) return c;
    }
    // fallback: scene.camera
    const scene = document.querySelector('a-scene');
    return scene && scene.camera ? scene.camera : null;
  }

  const tmpV = THREE ? new THREE.Vector3() : null;

  function project(pos){
    const cam = getCam();
    if (!cam || !tmpV || !pos) return null;

    // ensure matrices are updated (ช่วยแก้กรณีค้าง/ยังไม่พร้อม)
    try{
      cam.updateMatrixWorld(true);
      if (cam.projectionMatrix && cam.updateProjectionMatrix) cam.updateProjectionMatrix();
    }catch(_){}

    tmpV.copy(pos).project(cam);

    // behind camera / outside clip
    if (tmpV.z < -1 || tmpV.z > 1) return null;

    return {
      x: (tmpV.x * 0.5 + 0.5) * innerWidth,
      y: (-tmpV.y * 0.5 + 0.5) * innerHeight
    };
  }

  function spawnWorld(){
    if (!THREE) return null;
    const camEl = document.querySelector('a-camera');
    if (!camEl || !camEl.object3D) return null;

    const pos = new THREE.Vector3();
    camEl.object3D.getWorldPosition(pos);

    const dir = new THREE.Vector3();
    camEl.object3D.getWorldDirection(dir);

    // 2m in front + random offset
    pos.add(dir.multiplyScalar(2.0));
    pos.x += (Math.random() - 0.5) * 1.6;
    pos.y += (Math.random() - 0.5) * 1.2;

    return pos;
  }

  function spawnScreenFallback(){
    // กันเป้าค้างกลางจอ: สุ่มตำแหน่งบนจอ (มี margin)
    const mx = Math.max(28, innerWidth  * 0.10);
    const my = Math.max(28, innerHeight * 0.18);
    return {
      x: mx + Math.random() * Math.max(10, innerWidth  - mx*2),
      y: my + Math.random() * Math.max(10, innerHeight - my*2)
    };
  }

  // ===== Adaptive scale =====
  function computeTargetScale(){
    const base = BASE_SCALE[diff] || 1.0;

    // research = fixed by diff only
    if (runMode === 'research') return base;

    // play = adaptive by combo + fever + timeLeft
    const c = clamp(combo / 10, 0, 1);                 // combo สูง → ยากขึ้น (เล็กลง)
    const f = feverActive ? 1 : 0;                     // fever → ยากขึ้นเล็กน้อย
    const t01 = durationSec > 0 ? clamp(timeLeftSec / durationSec, 0, 1) : 0.5;

    // timeLeft ใกล้หมด → ช่วยให้ใหญ่ขึ้นนิด
    const helpLate = clamp((0.35 - t01) / 0.35, 0, 1); // 0..1 when <=35% time
    // ช่วงต้นเกม + เล่นดี → เล็กลงนิด (ท้าทาย)
    const challenge = (c * 0.65) + (f * 0.20);         // 0..~0.85

    // รวม: base * (1 - challenge*0.20 + helpLate*0.18)
    const factor = 1 - challenge * 0.20 + helpLate * 0.18;

    return clamp(base * factor, 0.75, 1.35);
  }

  function applyScaleToEl(el){
    if (!el) return;
    const s = computeTargetScale();
    el.style.setProperty('--tScale', String(s));
  }

  // ===== Events =====
  function emit(type, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(type, { detail })); }
    catch(_){}
  }

  function emitScore(extra = {}){
    emit('hha:score', Object.assign({
      score,
      combo,
      comboMax,
      misses,
      goodHits,
      feverActive,
      shield
    }, extra));
  }

  // ===== Target =====
  function createTarget(kind){
    if (!layerEl) return;

    const el = document.createElement('div');
    el.className = 'gj-target ' + (kind === 'good' ? 'gj-good' : 'gj-junk');

    const emoji =
      (kind === 'good')
        ? (Math.random() < 0.10 ? POWER[(Math.random()*3)|0] : GOOD[(Math.random()*GOOD.length)|0])
        : JUNK[(Math.random()*JUNK.length)|0];

    el.textContent = emoji;

    // ✅ ให้ระบบ gaze/reticle hook จับได้ (ของคุณใช้ [data-hha-tgt])
    el.setAttribute('data-hha-tgt', '1');

    // dataset.kind สำหรับ reticle color
    el.dataset.kind =
      (emoji === STAR)   ? 'star'
    : (emoji === FIRE)   ? 'diamond'
    : (emoji === SHIELD) ? 'shield'
    : kind;

    // ===== resolve true kind by emoji (กันนับมั่ว) =====
    const trueKind = isJunkEmoji(emoji) ? 'junk' : 'good';

    const t = {
      el,
      emoji,
      kind: trueKind,
      trueKind,
      pos: spawnWorld(),
      screen: null,
      born: performance.now()
    };

    // fallback ถ้า world pos ใช้ไม่ได้ (กันค้างกลางจอ)
    if (!t.pos) t.screen = spawnScreenFallback();

    // apply adaptive scale
    applyScaleToEl(el);

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hit(t, e.clientX, e.clientY);
    }, { passive:false });

    // อายุเป้า (ms)
    setTimeout(()=> expire(t), 2000 + Math.random()*400);
  }

  function destroy(t, wasHit){
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i, 1);

    if (t.el){
      if (wasHit){
        t.el.classList.add('hit');
        setTimeout(()=>{ try{ t.el.remove(); }catch(_){} }, 120);
      } else {
        try{ t.el.remove(); }catch(_){}
      }
    }
  }

  // ✅ Miss rule:
  // - good expired => miss + combo reset
  // - junk hit (NOT blocked by shield) => miss + combo reset
  function expire(t){
    if (!running) return;
    destroy(t, false);

    // นับ miss เฉพาะ "ปล่อยของดีหลุด"
    if ((t.trueKind || t.kind) === 'good'){
      misses++;
      combo = 0;
      emit('hha:miss', { misses, reason:'good-expire', emoji: t.emoji });
      emitScore({ reason:'good-expire' });
    } else {
      // ปล่อยขยะหลุด: ไม่ใช่ miss
      emit('hha:debug', { reason:'junk-expire', emoji: t.emoji });
    }
  }

  function hit(t, x, y){
    destroy(t, true);

    // power effects (⭐ / 🔥 / 🛡️) = ถือเป็น "good hit" (ให้เล่นสนุก)
    if (t.emoji === STAR){
      score += 40;
      combo++;
      comboMax = Math.max(comboMax, combo);
      goodHits++;
      Particles.scorePop(x, y, '+40', { good:true });
      emit('hha:judge', { label: 'BONUS!' });
      emitScore({ reason:'star' });
      return;
    }

    if (t.emoji === FIRE){
      feverActive = true;
      setFeverActive(true);
      emit('hha:fever', { state:'start' });
      // FIRE ไม่ให้คะแนนทันที (กันพุ่งมั่ว) แต่ถือว่า “เก็บของดี”
      combo++;
      comboMax = Math.max(comboMax, combo);
      goodHits++;
      Particles.scorePop(x, y, 'FEVER!', { good:true });
      emit('hha:judge', { label: 'FEVER' });
      emitScore({ reason:'fever-start' });
      return;
    }

    if (t.emoji === SHIELD){
      shield = Math.min(3, shield + 1);
      setShield(shield);
      combo++;
      comboMax = Math.max(comboMax, combo);
      goodHits++;
      Particles.scorePop(x, y, 'SHIELD+', { good:true });
      emit('hha:judge', { label: 'SHIELD' });
      emitScore({ reason:'shield+' });
      return;
    }

    // junk hit
    if ((t.trueKind || t.kind) === 'junk'){
      // ถ้ามีโล่กันไว้ => ไม่เป็น miss ตามที่ตกลง
      if (shield > 0){
        shield--;
        setShield(shield);
        Particles.scorePop(x, y, 'BLOCK!', { good:true });
        emit('hha:judge', { label:'BLOCK' });
        emitScore({ reason:'junk-block' });
        return;
      }

      misses++;
      combo = 0;
      emit('hha:miss', { misses, reason:'junk-hit', emoji: t.emoji });
      emit('hha:judge', { label:'MISS' });
      emitScore({ reason:'junk-hit' });
      return;
    }

    // good hit (normal good emoji)
    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    const mult = feverActive ? 2 : 1;
    const add = 10 * mult;
    score += add;

    Particles.scorePop(x, y, '+'+add, { good:true });
    emit('hha:judge', { label: (combo >= 6 ? 'PERFECT' : 'GOOD') });

    emitScore({ reason:'good-hit' });
  }

  // ===== Loops =====
  function loop(){
    if (!running) return;

    // update target positions + adaptive scale
    for (const t of active){
      // scale refresh (adaptive can change mid-game)
      applyScaleToEl(t.el);

      let p = null;
      if (t.pos) p = project(t.pos);

      if (p){
        t.el.style.left = p.x + 'px';
        t.el.style.top  = p.y + 'px';
      } else if (t.screen){
        // fallback position
        t.el.style.left = t.screen.x + 'px';
        t.el.style.top  = t.screen.y + 'px';
      } else {
        // last resort
        t.screen = spawnScreenFallback();
        t.el.style.left = t.screen.x + 'px';
        t.el.style.top  = t.screen.y + 'px';
      }
    }

    rafId = requestAnimationFrame(loop);
  }

  function spawn(){
    if (!running) return;

    // limit active targets
    if (active.length < 4){
      createTarget(Math.random() < 0.7 ? 'good' : 'junk');
    }

    spawnTimer = setTimeout(spawn, 900);
  }

  // ===== API =====
  function start(d, opts = {}){
    if (running) return;

    diff = String(d || 'normal').toLowerCase();
    if (diff !== 'easy' && diff !== 'hard') diff = 'normal';

    runMode = String(opts.runMode || 'play').toLowerCase() === 'research' ? 'research' : 'play';

    // duration (เพื่อ adaptive timeLeft)
    durationSec = (typeof opts.durationSec === 'number' && opts.durationSec > 0) ? (opts.durationSec|0) : 60;
    timeLeftSec = durationSec;

    // layer
    layerEl = opts.layerEl || document.getElementById('gj-layer');
    if (!layerEl){
      layerEl = document.createElement('div');
      layerEl.id = 'gj-layer';
      Object.assign(layerEl.style, { position:'fixed', inset:'0', zIndex:'649', pointerEvents:'auto' });
      document.body.appendChild(layerEl);
    }

    // reset stats
    score = 0; combo = 0; comboMax = 0;
    misses = 0; goodHits = 0;
    fever = 0; feverActive = false;
    shield = 0;

    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    setShield(0);

    running = true;

    emitScore({ reason:'start' });
    emit('quest:update', {});

    // sync time from outer timer (listen event)
    ROOT.addEventListener('hha:time', onTimeEvent);

    loop();
    spawn();
  }

  function onTimeEvent(e){
    const d = (e && e.detail) || {};
    if (typeof d.sec === 'number'){
      timeLeftSec = d.sec|0;
      if (timeLeftSec < 0) timeLeftSec = 0;
    }
  }

  function stop(reason){
    if (!running) return;

    running = false;

    if (spawnTimer) clearTimeout(spawnTimer);
    if (rafId) cancelAnimationFrame(rafId);

    ROOT.removeEventListener('hha:time', onTimeEvent);

    // clear targets
    active.forEach(t=> destroy(t, false));
    active = [];

    // end
    emit('hha:end', {
      reason: reason || 'stop',
      scoreFinal: score,
      comboMax,
      misses,
      goodHits
    });
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

// ✅ ES module export (กัน error import)
export const GameEngine = window.GoodJunkVR.GameEngine;
