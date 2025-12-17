// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (Production Ready)
// 2025-12 FULL (fixed: spawn spread by camera basis + first-place + layer + data-hha-tgt + ES export)

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
  let running=false, layerEl=null;
  let active=[], spawnTimer=null, rafId=null;

  let score=0, combo=0, comboMax=0;
  let misses=0;        // ✅ Miss = good expired + junk hit (shield block NOT count)
  let goodHits=0;      // ✅ สำหรับ quest kind: goodHits

  let fever=0, feverActive=false, shield=0;
  let diff='normal', runMode='play';

  // ===== Camera helpers =====
  function getThreeCamera(){
    // Prefer A-Frame scene.camera
    const scene = document.querySelector('a-scene');
    if (scene && scene.camera) return scene.camera;

    // Fallback: a-camera object3D('camera')
    const camEl = document.querySelector('a-camera');
    if (camEl && camEl.getObject3D) {
      const c = camEl.getObject3D('camera');
      if (c) return c;
    }
    return null;
  }

  const vTmp = THREE && new THREE.Vector3();
  const vPos = THREE && new THREE.Vector3();
  const vDir = THREE && new THREE.Vector3();
  const vRight = THREE && new THREE.Vector3();
  const vUp = THREE && new THREE.Vector3();

  function project(worldPos){
    const cam = getThreeCamera();
    if(!cam || !vTmp || !worldPos) return null;

    // ให้ camera matrix up-to-date
    if (cam.updateMatrixWorld) cam.updateMatrixWorld(true);

    vTmp.copy(worldPos).project(cam);

    if (vTmp.z < -1 || vTmp.z > 1) return null;

    const x = (vTmp.x * 0.5 + 0.5) * innerWidth;
    const y = (-vTmp.y * 0.5 + 0.5) * innerHeight;

    if (!isFinite(x) || !isFinite(y)) return null;
    return { x, y };
  }

  // ✅ spawn แบบอิงแกนกล้องจริง (forward/right/up) → กระจายจริง ไม่กองกลาง
  function spawnWorld(){
    if(!THREE) return null;

    const cam = getThreeCamera();
    if(!cam) return null;

    if (cam.updateMatrixWorld) cam.updateMatrixWorld(true);

    // กล้องจริง: เอา world position + direction
    cam.getWorldPosition(vPos);
    cam.getWorldDirection(vDir).normalize();

    // right = dir x up
    vUp.set(0,1,0);
    vRight.copy(vDir).cross(vUp).normalize();
    // ปรับ up ให้ตั้งฉากสมบูรณ์กับ dir/right
    vUp.copy(vRight).cross(vDir).normalize();

    // ระยะหน้า + กระจายตามขอบจอ
    const dist = 1.6 + Math.random()*1.1;     // 1.6–2.7m
    const rx   = (Math.random()-0.5) * 1.8;   // ซ้าย-ขวา
    const ry   = (Math.random()-0.5) * 1.15;  // ขึ้น-ลง

    const p = new THREE.Vector3();
    p.copy(vPos)
      .add(vDir.clone().multiplyScalar(dist))
      .add(vRight.clone().multiplyScalar(rx))
      .add(vUp.clone().multiplyScalar(ry));

    return p;
  }

  function ensureLayer(opts){
    layerEl = (opts && opts.layerEl) || document.getElementById('gj-layer');
    if (!layerEl){
      layerEl = document.createElement('div');
      layerEl.id = 'gj-layer';
      Object.assign(layerEl.style, {
        position:'fixed',
        inset:'0',
        zIndex:'649',
        pointerEvents:'auto'
      });
      document.body.appendChild(layerEl);
    } else {
      // เผื่อ html มีแล้ว แต่เผลอตั้ง pointer-events:none
      if (layerEl.style) layerEl.style.pointerEvents = 'auto';
    }
  }

  // ===== Target =====
  function placeNow(t){
    const p = project(t.pos);
    if (p){
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
    }
  }

  function createTarget(kind){
    if (!layerEl) return;

    const el = document.createElement('div');
    el.className = 'gj-target ' + (kind==='good' ? 'gj-good' : 'gj-junk');

    let emoji = (kind==='good')
      ? (Math.random()<0.1 ? POWER[(Math.random()*3)|0] : GOOD[(Math.random()*GOOD.length)|0])
      : JUNK[(Math.random()*JUNK.length)|0];

    el.textContent = emoji;

    // ✅ ให้ระบบ gaze/reticle ที่ hook ไว้จับได้
    el.setAttribute('data-hha-tgt','1');
    el.dataset.kind = (emoji===STAR) ? 'star'
                : (emoji===FIRE) ? 'diamond'
                : (emoji===SHIELD) ? 'shield'
                : kind;

    const t = { el, kind, emoji, pos: spawnWorld(), born: performance.now() };
    if (!t.pos){
      // ถ้ากล้องยังไม่พร้อมจริง ๆ ให้ลองอีกทีรอบหน้า
      return;
    }

    active.push(t);
    layerEl.appendChild(el);

    // ✅ วางตำแหน่งทันที (แก้อาการกองกลาง/ไม่อัปเดต)
    placeNow(t);

    // แตะ/คลิก
    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hit(t, e.clientX, e.clientY);
    }, { passive:false });

    // อยู่บนจอ ~2 วินาที
    setTimeout(()=>expire(t), 2000 + Math.random()*450);
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

  function expire(t){
    if(!running) return;
    destroy(t,false);

    // ✅ Miss = good expired
    if (t.kind === 'good'){
      misses++;
      combo = 0;
      emit('hha:miss', { misses });
      emit('hha:score', { score, combo, misses, goodHits });
    }
  }

  function hit(t, x, y){
    destroy(t,true);

    // power items (ถือว่าเป็น "good" เหมือนเดิม)
    if (t.emoji === STAR){
      score += 40;
      combo++;
      comboMax = Math.max(comboMax, combo);
      emit('hha:judge', { label:'GOOD' });
      emit('hha:score', { score, combo, misses, goodHits });
      return;
    }

    if (t.emoji === FIRE){
      feverActive = true;
      setFeverActive(true);
      emit('hha:fever', { state:'start' });
      // ยังให้แต้มแบบ hit good ปกติ (ถ้าเป็น good)
      // ถ้า FIRE โผล่ใน good ก็ให้ถือว่า good hit
    }

    if (t.emoji === SHIELD){
      shield = Math.min(3, shield + 1);
      setShield(shield);
      emit('hha:judge', { label:'GOOD' });
      emit('hha:score', { score, combo, misses, goodHits });
      return;
    }

    // junk
    if (t.kind === 'junk'){
      // ✅ ถ้ามี shield กันไว้ → ไม่เป็น Miss
      if (shield > 0){
        shield--;
        setShield(shield);
        emit('hha:judge', { label:'BLOCK' });
        emit('hha:score', { score, combo, misses, goodHits });
        return;
      }

      // ✅ Miss = junk hit
      misses++;
      combo = 0;
      emit('hha:miss', { misses });
      emit('hha:judge', { label:'MISS' });
      emit('hha:score', { score, combo, misses, goodHits });
      return;
    }

    // good
    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    const add = 10 * (feverActive ? 2 : 1);
    score += add;

    if (Particles && Particles.scorePop) Particles.scorePop(x, y, '+' + add, { good:true });

    emit('hha:judge', { label: combo>=6 ? 'PERFECT' : 'GOOD' });
    emit('hha:score', { score, combo, misses, goodHits });
  }

  // ===== Loops =====
  function loop(){
    if(!running) return;

    for(const t of active){
      // เผื่อบางตัว pos หาย ให้ข้าม
      if (!t.pos) continue;

      const p = project(t.pos);
      if (p){
        t.el.style.left = p.x + 'px';
        t.el.style.top  = p.y + 'px';
      }
    }
    rafId = requestAnimationFrame(loop);
  }

  function spawn(){
    if(!running) return;

    // กัน “กล้องยังไม่พร้อม” → ถ้า spawnWorld() คืน null ให้รอรอบหน้า
    if (active.length < 4){
      const kind = (Math.random()<0.7) ? 'good' : 'junk';
      createTarget(kind);
    }
    spawnTimer = setTimeout(spawn, 850);
  }

  function emit(type, detail){
    ROOT.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // ===== API =====
  function start(d, opts={}){
    if(running) return;

    diff = d || 'normal';
    runMode = opts.runMode || 'play';

    ensureLayer(opts);

    score=0; combo=0; comboMax=0;
    misses=0; goodHits=0;
    fever=0; feverActive=false; shield=0;

    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    setShield(0);

    running = true;

    emit('hha:score', { score, combo, misses, goodHits });
    emit('quest:update', {}); // HUD จะโชว์ตอน quest-director ยิงจริงอีกที

    loop();
    spawn();
  }

  function stop(reason){
    if(!running) return;

    running = false;
    if(spawnTimer) clearTimeout(spawnTimer);
    if(rafId) cancelAnimationFrame(rafId);

    active.forEach(t=>destroy(t,false));
    active = [];

    emit('hha:end', { score, comboMax, misses, goodHits, reason: reason || '' });
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

// ✅ ES module export (แก้ error import)
export const GameEngine = window.GoodJunkVR.GameEngine;
