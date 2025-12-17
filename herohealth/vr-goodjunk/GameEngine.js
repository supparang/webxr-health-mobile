// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (Production Ready)
// 2025-12 FULL (patched: combo, goodHits, score sync, layer, data-hha-tgt, ES export)
// + ADAPTIVE targets (play mode only)

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

  let score=0, combo=0, comboMax=0, misses=0, goodHits=0;
  let fever=0, feverActive=false, shield=0;
  let diff='normal', runMode='play';

  // ===== Adaptive (play only) =====
  // skill in [0..1] : 0 ง่ายสุด, 1 ยากสุด
  let adaptiveOn = true;
  let skill = 0.45;

  // rolling window (10s)
  const WIN_MS = 10000;
  const perf = { hits: [], miss: [] }; // store timestamps

  function now(){ return performance.now(); }
  function clamp(v,min,max){ return v<min?min:v>max?max:v; }

  function pushEvt(arr){
    const t = now();
    arr.push(t);
    // prune
    const cut = t - WIN_MS;
    while (arr.length && arr[0] < cut) arr.shift();
  }

  function recalcSkill(){
    if (!adaptiveOn) return;

    const t = now();
    const cut = t - WIN_MS;

    while (perf.hits.length && perf.hits[0] < cut) perf.hits.shift();
    while (perf.miss.length && perf.miss[0] < cut) perf.miss.shift();

    const h = perf.hits.length;
    const m = perf.miss.length;

    // accuracy & tempo
    const total = h + m;
    const acc = total > 0 ? (h / total) : 0.6;
    const tempo = clamp(h / 12, 0, 1); // 12 hits/10s = เร็วมาก

    // combo influence (คอมโบสูง = ยากขึ้น)
    const comboF = clamp(combo / 12, 0, 1);

    // เป้าหมาย: ทำให้ skill ขยับช้า ๆ ไม่แกว่ง
    // ถ้าแม่น + ตีเร็ว + คอมโบสูง => skill เพิ่ม
    // ถ้าพลาดเยอะ => skill ลด
    const target = clamp(0.15 + 0.65*acc + 0.20*tempo + 0.15*comboF - 0.35*(m/8), 0, 1);

    // smooth (EMA)
    skill = clamp(skill*0.88 + target*0.12, 0, 1);
  }

  function baseByDiff(){
    // baseline per diff (ก่อน adaptive)
    if (diff === 'easy'){
      return { interval: 980, maxActive: 3, lifeMs: 2550, scale: 1.08, goodRatio: 0.78 };
    }
    if (diff === 'hard'){
      return { interval: 760, maxActive: 5, lifeMs: 1950, scale: 0.95, goodRatio: 0.68 };
    }
    return { interval: 880, maxActive: 4, lifeMs: 2200, scale: 1.00, goodRatio: 0.72 };
  }

  function adaptiveConfig(){
    const b = baseByDiff();

    // skill สูง => interval สั้นลง, maxActive มากขึ้น, life สั้นลง, scale เล็กลง, junk มากขึ้น
    const s = skill;

    const interval = Math.round(clamp(b.interval * (1.18 - 0.45*s), 520, 1200));
    const maxActive = Math.round(clamp(b.maxActive + (s*2.2 - 0.6), 2, 7));
    const lifeMs = Math.round(clamp(b.lifeMs * (1.22 - 0.55*s), 1200, 3200));

    const scale = clamp(b.scale * (1.18 - 0.32*s), 0.78, 1.22);

    // goodRatio ลดลงเล็กน้อยเมื่อเก่งขึ้น (เพิ่มความท้าทาย)
    const goodRatio = clamp(b.goodRatio - 0.10*s, 0.55, 0.85);

    return { interval, maxActive, lifeMs, scale, goodRatio };
  }

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
    tmpV.copy(pos).project(cam);
    if(tmpV.z<-1 || tmpV.z>1) return null;

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

    pos.add(dir.multiplyScalar(2));
    pos.x += (Math.random()-0.5)*1.6;
    pos.y += (Math.random()-0.5)*1.2;

    return pos;
  }

  // ===== Emit helpers =====
  function emit(type,detail){
    ROOT.dispatchEvent(new CustomEvent(type,{detail}));
  }
  function emitScore(){
    emit('hha:score',{ score, combo, comboMax, misses, goodHits });
  }

  // ===== Target =====
  function createTarget(kind){
    if (!layerEl) return;

    const el=document.createElement('div');
    el.className='gj-target '+(kind==='good'?'gj-good':'gj-junk');

    const emoji = (kind==='good')
      ? (Math.random()<0.1 ? POWER[(Math.random()*3)|0] : GOOD[(Math.random()*GOOD.length)|0])
      : JUNK[(Math.random()*JUNK.length)|0];

    el.textContent=emoji;

    // ให้ระบบ gaze/reticle จับได้
    el.setAttribute('data-hha-tgt','1');
    el.dataset.kind = (emoji===STAR) ? 'star'
                  : (emoji===FIRE) ? 'diamond'
                  : (emoji===SHIELD) ? 'shield'
                  : kind;

    // ✅ apply adaptive scale per target
    const cfg = adaptiveConfig();
    el.style.setProperty('--tScale', String(cfg.scale));

    const t={ el, kind, emoji, pos:spawnWorld(), born:performance.now(), lifeMs: cfg.lifeMs };
    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hit(t, e.clientX, e.clientY);
    }, {passive:false});

    setTimeout(()=>expire(t), t.lifeMs);
  }

  function destroy(t,wasHit){
    const i=active.indexOf(t);
    if(i>=0) active.splice(i,1);
    if(t.el){
      if(wasHit){
        t.el.classList.add('hit');
        setTimeout(()=>{ try{ t.el.remove(); }catch(_){} },120);
      }else{
        try{ t.el.remove(); }catch(_){}
      }
    }
  }

  function expire(t){
    if(!running) return;
    destroy(t,false);

    // MISS = ปล่อยของดีหลุด + sync
    if(t.kind==='good'){
      misses++;
      combo=0;
      pushEvt(perf.miss);
      recalcSkill();
      emit('hha:miss',{misses});
      emitScore();
    }
  }

  function hit(t,x,y){
    destroy(t,true);

    // ===== Junk hit =====
    if(t.kind==='junk'){
      if(shield>0){
        shield--; setShield(shield);
        // กันได้: ไม่ใช่ hit ที่เพิ่ม skill แต่ถือว่า "ไม่พลาด"
        emitScore();
        return;
      }
      misses++;
      combo=0;
      pushEvt(perf.miss);
      recalcSkill();
      emit('hha:miss',{misses});
      emit('hha:judge',{label:'MISS'});
      emitScore();
      return;
    }

    // ===== Good hit (รวม power ถือเป็น goodHit) =====
    goodHits++;
    pushEvt(perf.hits);

    // power effects (อย่าเพิ่ม combo ซ้ำใน STAR!)
    if(t.emoji===STAR){ score += 40; }
    if(t.emoji===FIRE){
      feverActive=true;
      setFeverActive(true);
      emit('hha:fever',{state:'start'});
    }
    if(t.emoji===SHIELD){
      shield=Math.min(3,shield+1);
      setShield(shield);
    }

    combo++;
    comboMax = Math.max(comboMax, combo);

    const base = 10;
    const mul  = feverActive ? 2 : 1;
    const gain = base * mul;
    score += gain;

    recalcSkill(); // ✅ หลังตีสำเร็จ ปรับ skill

    try{ Particles.scorePop(x,y,'+'+gain,{good:true}); }catch(_){}

    emit('hha:judge',{label: combo>=6 ? 'PERFECT' : 'GOOD'});
    emitScore();
  }

  // ===== Loops =====
  function loop(){
    if(!running) return;
    for(const t of active){
      const p=project(t.pos);
      if(p){
        t.el.style.left = p.x + 'px';
        t.el.style.top  = p.y + 'px';
      }
    }
    rafId=requestAnimationFrame(loop);
  }

  function spawn(){
    if(!running) return;

    const cfg = adaptiveConfig();

    // ✅ adaptive maxActive
    if(active.length < cfg.maxActive){
      const kind = (Math.random() < cfg.goodRatio) ? 'good' : 'junk';
      createTarget(kind);
    }

    // ✅ adaptive spawn interval
    spawnTimer=setTimeout(spawn, cfg.interval);
  }

  // ===== API =====
  function start(d,opts={}){
    if(running) return;

    diff=d||'normal';
    runMode=opts.runMode||'play';

    // ✅ ปิด adaptive ใน research mode (กันข้อมูลเพี้ยน)
    adaptiveOn = (runMode !== 'research');
    skill = (diff === 'easy') ? 0.35 : (diff === 'hard') ? 0.55 : 0.45;
    perf.hits.length = 0;
    perf.miss.length = 0;

    layerEl = opts.layerEl || document.getElementById('gj-layer');
    if (!layerEl){
      layerEl = document.createElement('div');
      layerEl.id = 'gj-layer';
      Object.assign(layerEl.style, { position:'fixed', inset:'0', zIndex:'649', pointerEvents:'none' });
      document.body.appendChild(layerEl);
    }

    score=0; combo=0; comboMax=0; misses=0; goodHits=0;
    fever=0; feverActive=false; shield=0;

    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    setShield(0);

    running=true;
    emitScore();
    loop();
    spawn();
  }

  function stop(reason='stop'){
    if(!running) return;
    running=false;

    if(spawnTimer) clearTimeout(spawnTimer);
    if(rafId) cancelAnimationFrame(rafId);

    active.forEach(t=>destroy(t,false));
    active=[];

    emit('hha:end',{
      reason,
      scoreFinal: score,
      score,
      comboMax,
      misses,
      goodHits
    });
  }

  ns.GameEngine={ start, stop };

})(window.GoodJunkVR=window.GoodJunkVR||{});

// ✅ ES module export
export const GameEngine = window.GoodJunkVR.GameEngine;