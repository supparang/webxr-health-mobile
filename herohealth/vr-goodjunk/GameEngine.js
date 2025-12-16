// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (Production Ready)
// 2025-12 FULL (mode 3: miss vs lapse, fixed double-count, stable spawn, ES export)

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
  let misses=0;   // ✅ junk-hit only
  let lapses=0;   // ✅ good-timeout only
  let fever=0, feverActive=false, shield=0;
  let diff='normal', runMode='play';

  // ===== Camera helpers =====
  function getCam(){
    const camEl=document.querySelector('a-camera');
    if(camEl && camEl.getObject3D){
      const c = camEl.getObject3D('camera');
      if (c) return c;
    }
    const scene=document.querySelector('a-scene');
    return scene && scene.camera ? scene.camera : null;
  }

  const tmpV = THREE && new THREE.Vector3();

  function project(pos){
    const cam=getCam();
    if(!cam || !tmpV || !pos) return null;

    // ✅ สำคัญ: อัปเดต matrix เพื่อให้ project() ไม่ null บ่อย
    if (cam.updateMatrixWorld) cam.updateMatrixWorld(true);

    tmpV.copy(pos).project(cam);
    if(tmpV.z < -1 || tmpV.z > 1) return null;

    return {
      x:(tmpV.x*0.5+0.5)*innerWidth,
      y:(-tmpV.y*0.5+0.5)*innerHeight
    };
  }

  function spawnWorld(){
    if(!THREE) return null;

    const camEl=document.querySelector('a-camera');
    if(!camEl || !camEl.object3D) return null;

    const pos=new THREE.Vector3();
    camEl.object3D.getWorldPosition(pos);

    const dir=new THREE.Vector3();
    camEl.object3D.getWorldDirection(dir);

    // 2.0m in front + random offset
    pos.add(dir.multiplyScalar(2.0));
    pos.x += (Math.random()-0.5)*1.8;
    pos.y += (Math.random()-0.5)*1.3;

    return pos;
  }

  function fallbackScreenXY(){
    // กันกรณี project() ไม่ได้ค่า => ไม่ไปกองที่ (0,0)
    const pad = 60;
    return {
      x: pad + Math.random() * (innerWidth - pad*2),
      y: pad + Math.random() * (innerHeight - pad*2),
    };
  }

  // ===== Target =====
  function createTarget(kind){
    if (!layerEl) return;

    const el=document.createElement('div');
    el.className='gj-target '+(kind==='good'?'gj-good':'gj-junk');

    let emoji=kind==='good'
      ? (Math.random()<0.1 ? POWER[(Math.random()*3)|0] : GOOD[(Math.random()*GOOD.length)|0])
      : JUNK[(Math.random()*JUNK.length)|0];

    el.textContent=emoji;

    // ✅ ให้ระบบ gaze/reticle ที่คุณ hook ไว้จับได้
    el.setAttribute('data-hha-tgt','1');
    el.dataset.kind = (emoji===STAR) ? 'star'
                  : (emoji===FIRE) ? 'diamond'
                  : (emoji===SHIELD) ? 'shield'
                  : kind;

    const t = {
      el, kind, emoji,
      pos: spawnWorld(),
      born: performance.now(),
      dead: false,          // ✅ กัน expire ซ้อน hit
      expireTimer: null,
      // ✅ ค่า fallback เผื่อ project() null
      fb: fallbackScreenXY()
    };

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hit(t, e.clientX, e.clientY);
    }, {passive:false});

    t.expireTimer = setTimeout(()=>expire(t), 1800 + Math.random()*550);
  }

  function expire(t){
    if(!running || !t || t.dead) return;
    t.dead = true;
    destroy(t,false);

    if(t.kind==='good'){
      // ✅ แบบที่ 3: good timeout = lapse (ไม่ใช่ miss)
      lapses++;
      combo = 0;

      emit('hha:lapse', { lapses, reason:'timeout-good' });
      emit('hha:judge', { label:'LOST' });
      emit('hha:score', { score, combo, misses, lapses });
    }
  }

  function destroy(t,wasHit){
    const i=active.indexOf(t);
    if(i>=0) active.splice(i,1);

    if (t && t.expireTimer){
      clearTimeout(t.expireTimer);
      t.expireTimer = null;
    }

    if(t && t.el){
      if(wasHit){
        t.el.classList.add('hit');
        setTimeout(()=>{ try{ t.el.remove(); }catch(_){} },120);
      }else{
        try{ t.el.remove(); }catch(_){}
      }
    }
  }

  function hit(t,x,y){
    if(!running || !t || t.dead) return; // ✅ กันซ้ำ
    t.dead = true;

    destroy(t,true);

    // power
    if(t.emoji===STAR){ score+=40; combo++; }
    if(t.emoji===FIRE){
      feverActive=true;
      setFeverActive(true);
      emit('hha:fever',{state:'start'});
    }
    if(t.emoji===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); }

    if(t.kind==='junk'){
      if(shield>0){ shield--; setShield(shield); return; }

      // ✅ แบบที่ 3: miss = junk-hit เท่านั้น
      misses++;
      combo=0;
      emit('hha:miss', { misses, reason:'hit-junk' });
      emit('hha:judge',{label:'MISS'});
      emit('hha:score',{ score, combo, misses, lapses });
      return;
    }

    combo++;
    comboMax=Math.max(comboMax,combo);
    score += 10*(feverActive?2:1);

    Particles.scorePop(x,y,'+'+10,{good:true});
    emit('hha:judge',{label:combo>=6?'PERFECT':'GOOD'});
    emit('hha:score',{ score, combo, misses, lapses });
  }

  // ===== Loops =====
  function loop(){
    if(!running) return;

    for(const t of active){
      if (!t || !t.el) continue;

      const p = t.pos ? project(t.pos) : null;
      const x = p ? p.x : t.fb.x;
      const y = p ? p.y : t.fb.y;

      t.el.style.left = x + 'px';
      t.el.style.top  = y + 'px';
    }

    rafId=requestAnimationFrame(loop);
  }

  function spawn(){
    if(!running) return;
    if(active.length < 4) createTarget(Math.random()<0.7?'good':'junk');
    spawnTimer=setTimeout(spawn, (diff==='easy'? 980 : diff==='hard'? 740 : 860));
  }

  function emit(type,detail){
    ROOT.dispatchEvent(new CustomEvent(type,{detail}));
  }

  // ===== API =====
  function start(d,opts={}){
    if(running) return;

    diff=d||'normal';
    runMode=opts.runMode||'play';

    layerEl = opts.layerEl || document.getElementById('gj-layer');
    if (!layerEl){
      layerEl = document.createElement('div');
      layerEl.id = 'gj-layer';
      Object.assign(layerEl.style, {
        position:'fixed', inset:'0',
        zIndex:'649',
        pointerEvents:'none'
      });
      document.body.appendChild(layerEl);
    }

    score=0; combo=0; comboMax=0;
    misses=0; lapses=0;
    fever=0; feverActive=false; shield=0;

    ensureFeverBar();
    setFever(0); setFeverActive(false); setShield(0);

    running=true;

    emit('hha:score',{ score, combo, misses, lapses });
    emit('quest:update',{}); // HUD จะรอ director อัปเดตจริง
    loop();
    spawn();
  }

  function stop(reason){
    if(!running) return;
    running=false;

    if(spawnTimer) clearTimeout(spawnTimer);
    if(rafId) cancelAnimationFrame(rafId);

    active.forEach(t=>{ if(t) { t.dead=true; destroy(t,false); } });
    active=[];

    emit('hha:end',{
      reason: reason || '',
      score,
      comboMax,
      misses,
      lapses
    });
  }

  ns.GameEngine={ start, stop };

})(window.GoodJunkVR=window.GoodJunkVR||{});

// ✅ ES module export (แก้ error import)
export const GameEngine = window.GoodJunkVR.GameEngine;
