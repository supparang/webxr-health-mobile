// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (Production Ready)
// 2025-12 FULL (patched: camera-ready start + no-center-stuck + miss rules + combo stable + adaptive scale)
//
// MISS RULE (ตามที่ตกลง):
//   MISS = good expired (missed good target) + junk hit (touched junk)
//   ถ้า junk ถูกแตะตอนมี Shield กันไว้ -> NOT MISS
//   junk expired -> NOT MISS
//
// Adaptive target size:
//   - Play mode: เริ่มตาม diff แล้วปรับตาม combo/fever/timeLeft/accuracy
//   - Research mode: ใช้ขนาดตาม diff เท่านั้น (ไม่ adaptive)

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

  // ===== State =====
  let running = false;
  let layerEl = null;

  let active = [];
  let spawnTimer = null;
  let rafId = null;

  // scoring
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;      // ✅ MISS ตามนิยามรวม
  let goodHits = 0;    // ✅ นับเฉพาะแตะของดี (รวม power)
  let junkHits = 0;

  // fever/shield
  let fever = 0;
  let feverActive = false;
  let feverEndAt = 0;
  let shield = 0;

  // mode
  let diff = 'normal';
  let runMode = 'play';

  // time (รับจาก hha:time)
  let timeLeft = 60;

  // camera ready flag
  let camReady = false;

  // temp vec
  const tmpV = THREE && new THREE.Vector3();

  // ===== Difficulty base =====
  function baseScaleForDiff(d){
    d = String(d || 'normal').toLowerCase();
    if (d === 'easy') return 1.15;
    if (d === 'hard') return 0.85;
    return 1.0;
  }

  function clamp(v, a, b){
    v = Number(v) || 0;
    return Math.max(a, Math.min(b, v));
  }

  // ===== Camera helpers =====
  function getCam(){
    // 1) prefer a-camera object3D camera
    const camEl = document.querySelector('a-camera');
    if (camEl && camEl.getObject3D){
      const c = camEl.getObject3D('camera');
      if (c) return c;
    }
    // 2) fallback: scene.camera
    const scene = document.querySelector('a-scene');
    if (scene && scene.camera) return scene.camera;
    return null;
  }

  function project(worldPos){
    const cam = getCam();
    if (!cam || !tmpV || !worldPos) return null;
    tmpV.copy(worldPos).project(cam);
    // outside clip
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

    // 2.2m in front + random offset
    pos.add(dir.multiplyScalar(2.2));
    pos.x += (Math.random() - 0.5) * 1.8;
    pos.y += (Math.random() - 0.5) * 1.3;

    return pos;
  }

  // ===== Adaptive scale (Play mode only) =====
  function currentScale(){
    const base = baseScaleForDiff(diff);

    // research: ไม่ adaptive
    if (runMode === 'research') return base;

    // play: adaptive
    const totalHits = goodHits + junkHits;
    const acc = totalHits > 0 ? (goodHits / totalHits) : 0.75;

    // skill: สูง -> ยากขึ้น (scale เล็กลง)
    const sScore = clamp(score / 1400, 0, 1);
    const sCombo = clamp(comboMax / 15, 0, 1);
    const sAcc   = clamp(acc, 0, 1);
    const sMiss  = clamp(misses / 10, 0, 1);

    // รวมแบบเน้น combo + accuracy
    let skill =
      (sCombo * 0.45) +
      (sAcc  * 0.35) +
      (sScore * 0.25) -
      (sMiss * 0.25);

    if (feverActive) skill += 0.10;

    // timeLeft ต่ำ -> ช่วยให้ใหญ่ขึ้นนิด
    let help = 1.0;
    if ((timeLeft|0) <= 10) help = 1.10;
    else if ((timeLeft|0) <= 20) help = 1.06;

    // map skill -> scale factor
    // skill ต่ำ => factor สูง (ง่ายขึ้น)
    // skill สูง => factor ต่ำ (ยากขึ้น)
    const factor = clamp(1.22 - skill, 0.78, 1.35);

    return clamp(base * factor * help, 0.70, 1.45);
  }

  // ===== DOM Target =====
  function createTarget(baseKind){
    if (!layerEl) return;

    const el = document.createElement('div');
    el.className = 'gj-target ' + (baseKind === 'good' ? 'gj-good' : 'gj-junk');

    // decide emoji
    let emoji;
    if (baseKind === 'good'){
      // 10% power
      emoji = (Math.random() < 0.10)
        ? POWER[(Math.random()*POWER.length)|0]
        : GOOD[(Math.random()*GOOD.length)|0];
    } else {
      emoji = JUNK[(Math.random()*JUNK.length)|0];
    }

    el.textContent = emoji;

    // ✅ ให้ cursor/raycaster (ใน HTML) จับได้
    el.setAttribute('data-hha-tgt','1');
    el.dataset.kind = (emoji === STAR) ? 'star'
                : (emoji === FIRE) ? 'diamond'
                : (emoji === SHIELD) ? 'shield'
                : baseKind;

    // ✅ ตั้ง scale variable (adaptive)
    el.style.setProperty('--tScale', String(currentScale().toFixed(3)));

    // ✅ กัน “ค้างกลางจอ” ก่อน project ได้: ตั้งตำแหน่ง fallback สุ่มบนจอ
    el.style.left = ((Math.random()*0.7 + 0.15) * innerWidth) + 'px';
    el.style.top  = ((Math.random()*0.6 + 0.20) * innerHeight) + 'px';

    const t = {
      el,
      baseKind,     // 'good' | 'junk' (ใช้ตัดสิน miss/expire)
      emoji,
      pos: spawnWorld(),
      born: performance.now(),
      ttl: 1700 + Math.random()*650
    };

    active.push(t);
    layerEl.appendChild(el);

    // click/touch
    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hit(t, e.clientX, e.clientY);
    }, { passive:false });

    // expire
    setTimeout(()=> expire(t), t.ttl);
  }

  function expire(t){
    if (!running) return;

    destroy(t, false);

    // ✅ MISS เฉพาะ "ปล่อยของดีหลุด" (รวม power ที่ถือเป็น good)
    if (t.baseKind === 'good'){
      misses++;
      combo = 0;
      emitScore();
      emit('hha:miss', { misses });
      emit('hha:judge', { label:'MISS' });
    }

    // ✅ junk expired: NOT MISS (ไม่ทำอะไร)
  }

  function destroy(t, wasHit){
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i,1);

    if (!t.el) return;

    if (wasHit){
      t.el.classList.add('hit');
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){} }, 120);
    } else {
      try{ t.el.remove(); }catch(_){}
    }
  }

  // ===== Fever timer =====
  function startFever(){
    feverActive = true;
    fever = 100;
    feverEndAt = performance.now() + 6500; // 6.5s
    setFeverActive(true);
    setFever(fever);
    emit('hha:fever', { state:'start' });
  }

  function tickFever(){
    if (!feverActive) return;
    const now = performance.now();
    const left = feverEndAt - now;
    if (left <= 0){
      feverActive = false;
      fever = 0;
      setFeverActive(false);
      setFever(0);
      emit('hha:fever', { state:'end' });
      return;
    }
    // linear decay
    fever = clamp((left / 6500) * 100, 0, 100);
    setFever(fever);
  }

  function hit(t, x, y){
    if (!running) return;

    destroy(t, true);

    // ===== junk hit =====
    if (t.baseKind === 'junk'){
      // shield block => NOT MISS
      if (shield > 0){
        shield--;
        setShield(shield);
        // feedback เบา ๆ
        emit('hha:judge', { label:'BLOCK' });
        emitScore();
        return;
      }

      junkHits++;
      misses++;     // ✅ MISS = junk hit
      combo = 0;

      emit('hha:miss', { misses });
      emit('hha:judge', { label:'MISS' });
      emitScore();
      return;
    }

    // ===== good hit (including power) =====
    goodHits++;

    // combo stable: hit 1 ครั้ง = combo +1 เสมอ
    combo++;
    comboMax = Math.max(comboMax, combo);

    // power effects
    let add = 10 * (feverActive ? 2 : 1);

    if (t.emoji === STAR){
      add += 40;
    } else if (t.emoji === FIRE){
      startFever();
    } else if (t.emoji === SHIELD){
      shield = Math.min(3, shield + 1);
      setShield(shield);
    }

    score += add;

    // FX
    if (Particles && Particles.scorePop){
      Particles.scorePop(x, y, '+' + add, { good:true });
    }

    emit('hha:judge', { label: combo >= 6 ? 'PERFECT' : 'GOOD' });
    emitScore();
  }

  function emit(type, detail){
    try{
      ROOT.dispatchEvent(new CustomEvent(type, { detail }));
    }catch(_){}
  }

  function emitScore(){
    emit('hha:score', {
      score,
      combo,
      comboMax,
      misses,
      goodHits,
      junkHits,
      fever: fever|0,
      feverActive: !!feverActive,
      shield
    });
  }

  // ===== Loops =====
  function loop(){
    if (!running) return;

    tickFever();

    // update positions
    for (const t of active){
      if (!t || !t.el) continue;

      // refresh adaptive scale (play mode only)
      t.el.style.setProperty('--tScale', String(currentScale().toFixed(3)));

      const p = t.pos ? project(t.pos) : null;
      if (p){
        t.el.style.left = p.x + 'px';
        t.el.style.top  = p.y + 'px';
      }
      // ถ้า project ไม่ได้ ก็ปล่อย fallback ที่สุ่มไว้ (ไม่ค้างกลางจอ)
    }

    rafId = requestAnimationFrame(loop);
  }

  function spawn(){
    if (!running) return;

    // max active ตาม diff (เล็กน้อย)
    const maxActive = (diff === 'easy') ? 3 : (diff === 'hard') ? 5 : 4;

    if (active.length < maxActive){
      const baseKind = (Math.random() < 0.70) ? 'good' : 'junk';
      createTarget(baseKind);
    }

    // spawn interval (diff)
    let interval = 900;
    if (diff === 'easy') interval = 980;
    if (diff === 'hard') interval = 780;

    spawnTimer = setTimeout(spawn, interval);
  }

  // ===== Start/Stop =====
  function waitForCameraReady(done){
    const scene = document.querySelector('a-scene');
    const camEl = document.querySelector('a-camera');

    // ถ้า A-Frame ยังไม่ ready
    if (!scene || !camEl){
      setTimeout(()=> waitForCameraReady(done), 60);
      return;
    }

    const check = ()=>{
      const cam = getCam();
      if (cam){
        camReady = true;
        done && done();
      } else {
        setTimeout(check, 60);
      }
    };

    // รอ scene loaded ก่อน
    if (scene.hasLoaded){
      check();
    } else {
      scene.addEventListener('loaded', check, { once:true });
      // fallback
      setTimeout(check, 300);
    }
  }

  function onTime(e){
    const d = (e && e.detail) || {};
    if (typeof d.sec === 'number') timeLeft = d.sec|0;
  }

  function start(d, opts = {}){
    if (running) return;

    diff = String(d || 'normal').toLowerCase();
    runMode = (opts.runMode === 'research') ? 'research' : 'play';

    // layer
    layerEl = opts.layerEl || document.getElementById('gj-layer');
    if (!layerEl){
      layerEl = document.createElement('div');
      layerEl.id = 'gj-layer';
      Object.assign(layerEl.style, {
        position:'fixed', inset:'0', zIndex:'649'
      });
      document.body.appendChild(layerEl);
    }

    // reset
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    goodHits = 0;
    junkHits = 0;

    fever = 0;
    feverActive = false;
    feverEndAt = 0;

    shield = 0;

    camReady = false;

    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    setShield(0);

    // listen time
    window.addEventListener('hha:time', onTime);

    running = true;
    emitScore();

    // ✅ สำคัญ: รอ camera ready ก่อนเริ่ม loop/spawn (กันเป้าค้างกลางจอ)
    waitForCameraReady(()=>{
      if (!running) return;
      loop();
      spawn();
    });
  }

  function stop(reason){
    if (!running) return;

    running = false;

    window.removeEventListener('hha:time', onTime);

    if (spawnTimer) clearTimeout(spawnTimer);
    if (rafId) cancelAnimationFrame(rafId);

    active.forEach(t => destroy(t, false));
    active = [];

    emit('hha:end', {
      reason: reason || 'stop',
      scoreFinal: score|0,
      comboMax: comboMax|0,
      misses: misses|0,
      goodHits: goodHits|0,
      junkHits: junkHits|0
    });
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

// ✅ ES module export (แก้ error import)
export const GameEngine = window.GoodJunkVR.GameEngine;
