// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (HYPER v3)
// ครบ 1–10:
// 1) Rush / Survival / Boss
// 2) Risk–Reward + Golden
// 3) 3 Stages (Early/Mid/Final)
// 4) Fake Good (ดูเหมือนดี แต่เป็น junk)
// 5) Powerups: Shield(5s) / Magnet(4s) / Time(+3s)
// 6) Fever: เติมจาก good + เร่งตอน ON
// 7) Mini quest ต่อเนื่องเป็นชุด
// 8) Celebration hooks (ยิง event ให้ HUD/Particles)
// 9) Adaptive difficulty เฉพาะ Play (Research ล็อก)
// 10) เน้น GoodJunk identity: คอมโบ/หลบ junk/สปีด

'use strict';

(function (ns) {
  const ROOT = (typeof window !== 'undefined' ? window : globalThis);

  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles || { scorePop(){}, burstAt(){} };

  const FeverUI = ROOT.FeverUI || null;

  // ===== Emoji pools =====
  const GOOD = ['🍎','🥦','🥕','🍌','🍉','🥛'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🥤'];

  const POWER_SHIELD = '🛡️';
  const POWER_MAGNET = '🧲';
  const POWER_TIME   = '⏳';
  const POWER_FEVER  = '🔥';

  const GOLD = '🟡';       // ใช้เป็นสัญลักษณ์ “ทอง” (จะ append หน้า emoji)
  const FAKE_SPARK = '✨'; // fake good

  // ===== Difficulty base =====
  const DIFF = {
    easy:   { spawnMs: 1050, maxActive: 3, scale: 1.18, goodRatio: 0.78, powerRatio: 0.16, goldRatio: 0.06, fakeRatio: 0.06, bossHP: 6 },
    normal: { spawnMs: 820,  maxActive: 4, scale: 1.02, goodRatio: 0.72, powerRatio: 0.14, goldRatio: 0.07, fakeRatio: 0.08, bossHP: 8 },
    hard:   { spawnMs: 650,  maxActive: 5, scale: 0.92, goodRatio: 0.66, powerRatio: 0.12, goldRatio: 0.08, fakeRatio: 0.10, bossHP: 10 }
  };

  // ===== Modes (1) =====
  // rush: เร่งขึ้นเรื่อย ๆ + ตัวคูณสนุก
  // survival: ไม่จับเวลา แต่มีหัวใจ (miss ทำให้หัวใจลด) — ใช้ hha:end reason 'lives-zero'
  // boss: มีบอสท้ายเกม
  const CHALLENGES = ['rush','survival','boss'];

  // ===== State =====
  let running=false;
  let layerEl=null;
  let active=[];
  let rafId=null, spawnTimer=null, tickTimer=null;

  let score=0;
  let combo=0;
  let comboMax=0;
  let goodHits=0;
  let misses=0;

  // shield แบบเวลา (5s) (5)
  let shieldUntil = 0;

  // magnet แบบเวลา (4s) (5)
  let magnetUntil = 0;

  // fever flag (6)
  let feverActive=false;
  let feverPrev=false;

  // time control (engine-managed)
  let durationSec = 60;
  let timeLeft = 60;
  let challenge = 'rush';
  let runMode = 'play';
  let diffKey = 'normal';

  // survival hearts
  const MAX_LIVES = 3;
  const MISS_PER_LIFE = 3; // 1 หัวใจหายทุก 3 miss
  let livesLeft = MAX_LIVES;

  // boss
  let bossSpawned = false;
  let bossTarget = null;

  // adaptive (9) play only
  let adaptive = { spawnMs: null, maxActive: null, scale: null };
  let lastAdaptAt = 0;

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
    return (camEl && camEl.object3D) ? camEl.object3D : null;
  }

  // ===== Utils =====
  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
  function now(){ return performance.now(); }
  function rnd(a,b){ return a + Math.random()*(b-a); }

  // ===== Events to HUD =====
  function emitJudge(label, extra){
    ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ label, ...extra } }));
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
    }else if (!feverActive && feverPrev){
      ROOT.dispatchEvent(new CustomEvent('hha:fever',{ detail:{ state:'end' }}));
    }
  }
  function comboMultiplier(){
    // (2) ตัวคูณคอมโบแบบเด็ก ป.5: ทุก 6 คอมโบ เพิ่ม 0.5x สูงสุด 3x
    const step = Math.floor((combo||0)/6);
    return clamp(1 + step*0.5, 1, 3);
  }
  function emitScore(){
    if (FeverUI && typeof FeverUI.isActive === 'function'){
      feverActive = !!FeverUI.isActive();
      emitFeverEdgeIfNeeded();
    }else{
      feverActive = false;
      feverPrev = false;
    }
    const shieldOn = (now() < shieldUntil);
    const magnetOn = (now() < magnetUntil);

    ROOT.dispatchEvent(new CustomEvent('hha:score',{
      detail:{
        score, combo, comboMax, goodHits, misses,
        feverActive, shieldOn, magnetOn,
        timeLeft, durationSec, runMode, diff: diffKey, challenge
      }
    }));
  }
  function emitTime(){
    ROOT.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft }}));
  }

  // ===== World spawn (หน้า camera) =====
  function spawnWorld(){
    const THREE = getTHREE();
    const cam = getCameraObj3D();
    if (!cam || !THREE) return null;

    const pos = new THREE.Vector3();
    cam.getWorldPosition(pos);

    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);

    // ใกล้ขึ้นนิดให้ “เลื่อนตามมุมมอง” ชัด
    pos.add(dir.multiplyScalar(2.1));

    // สุ่มกระจาย
    pos.x += (Math.random()-0.5)*1.9;
    pos.y += (Math.random()-0.5)*1.5;

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

  // ===== Stages (3) =====
  function stageOf(){
    if (challenge === 'survival') return 'mid';
    const elapsed = Math.max(0, durationSec - timeLeft);
    const p = durationSec > 0 ? elapsed / durationSec : 0;
    if (p < 0.33) return 'early';
    if (p < 0.78) return 'mid';
    return 'final';
  }
  function stageSpawnMult(st){
    // ยิ่งท้ายยิ่งโหด
    if (st === 'early') return 1.00;
    if (st === 'mid')   return 0.86;
    return 0.74;
  }

  // ===== Target object =====
  function createDomEl(){
    const el = document.createElement('div');
    el.className = 'gj-target';
    el.setAttribute('data-hha-tgt','1');
    el.style.display = 'none';
    return el;
  }

  function pickBase(){
    const base = DIFF[diffKey] || DIFF.normal;
    const a = adaptive.spawnMs ? adaptive : base;
    return {
      spawnMs: a.spawnMs || base.spawnMs,
      maxActive: a.maxActive || base.maxActive,
      scale: a.scale || base.scale,
      goodRatio: base.goodRatio,
      powerRatio: base.powerRatio,
      goldRatio: base.goldRatio,
      fakeRatio: base.fakeRatio,
      bossHP: base.bossHP
    };
  }

  function makeTargetSpec(){
    const base = pickBase();
    const r = Math.random();

    // (5) powerups
    if (r < base.powerRatio){
      const pr = Math.random();
      if (pr < 0.34) return { type:'power', power:'shield', emoji: POWER_SHIELD, ttl: 1600 };
      if (pr < 0.67) return { type:'power', power:'magnet', emoji: POWER_MAGNET, ttl: 1600 };
      return { type:'power', power:'time', emoji: POWER_TIME, ttl: 1600 };
    }

    // (4) fake good
    if (r < base.powerRatio + base.fakeRatio){
      const e = GOOD[(Math.random()*GOOD.length)|0];
      return { type:'fake', emoji: e + FAKE_SPARK, ttl: 1900 };
    }

    // (2) golden good
    if (r < base.powerRatio + base.fakeRatio + base.goldRatio){
      const e = GOOD[(Math.random()*GOOD.length)|0];
      return { type:'gold', emoji: GOLD + e, ttl: 1200 };
    }

    // normal good/junk
    const good = (Math.random() < base.goodRatio);
    if (good){
      const e = GOOD[(Math.random()*GOOD.length)|0];
      // (6) fever drop เล็กน้อย
      if (Math.random() < 0.08) return { type:'power', power:'fever', emoji: POWER_FEVER, ttl: 1500 };
      return { type:'good', emoji: e, ttl: 2200 };
    }
    const j = JUNK[(Math.random()*JUNK.length)|0];
    return { type:'junk', emoji: j, ttl: 2200 };
  }

  function createTarget(spec){
    if (!layerEl) return;
    const el = createDomEl();

    const base = pickBase();
    el.style.setProperty('--tScale', String(base.scale));

    // classes for FX
    el.classList.add(
      spec.type === 'junk' ? 'gj-junk' :
      spec.type === 'fake' ? 'gj-fake' :
      spec.type === 'gold' ? 'gj-gold' :
      spec.type === 'power' ? 'gj-power' : 'gj-good'
    );

    el.textContent = spec.emoji;

    const fallback2D = {
      x: Math.round(window.innerWidth  * (0.18 + Math.random()*0.64)),
      y: Math.round(window.innerHeight * (0.22 + Math.random()*0.58))
    };

    const t = {
      el,
      type: spec.type,
      power: spec.power || null,
      emoji: spec.emoji,
      pos: spawnWorld(), // may be null until camera ready
      born: now(),
      ttl: spec.ttl || 2200,
      seen: false,
      fallback2D,
      // เพิ่มความเร้าใจ: wobble ในช่วง mid/final
      wobbleSeed: Math.random()*10,
    };

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    setTimeout(()=>expireTarget(t), t.ttl);
  }

  function removeTarget(t){
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i,1);
    if (t.el) t.el.remove();
  }

  function expireTarget(t){
    if (!running) return;
    removeTarget(t);

    // MISS เฉพาะ good/gold ที่ “เคยเห็นจริง” (กัน miss drift)
    if ((t.type === 'good' || t.type === 'gold') && t.seen){
      misses++;
      combo = 0;
      emitScore();
      emitMiss();
      emitJudge('MISS');
      checkSurvivalLives();
    }
  }

  function shieldOn(){ return now() < shieldUntil; }
  function magnetOn(){ return now() < magnetUntil; }

  function feverAdd(v){
    if (!FeverUI || typeof FeverUI.add !== 'function') return;
    FeverUI.add(v);
  }
  function feverReduce(v){
    if (!FeverUI || typeof FeverUI.add !== 'function') return;
    FeverUI.add(-Math.abs(v||0));
  }

  function hitTarget(t, x, y){
    if (!t || !t.el) return;

    // boss needs multi-hit
    if (t.type === 'boss'){
      t.hp = (t.hp|0) - 1;
      const P = Particles;
      if (P && P.scorePop) P.scorePop(x,y,'HIT!',{ judgment:'BOSS', good:true });
      emitJudge('BOSS HIT!');
      if (t.hp <= 0){
        // clear boss
        removeTarget(t);
        bossTarget = null;

        const mult = comboMultiplier();
        const feverNow = (FeverUI && FeverUI.isActive) ? !!FeverUI.isActive() : false;
        const add = Math.round((240 * mult) * (feverNow ? 1.2 : 1));
        score += add;
        combo += 2; // ให้รู้สึก “คุ้ม”
        comboMax = Math.max(comboMax, combo);

        if (Particles && Particles.burstAt){
          Particles.burstAt(window.innerWidth/2, window.innerHeight*0.22, { count: 30, good: true });
        }
        emitJudge('BOSS CLEAR!');
        ROOT.dispatchEvent(new CustomEvent('quest:bossClear',{ detail:{ ok:true } }));
        emitScore();
      }else{
        // keep on screen: scale bump
        t.el.style.setProperty('--tScale', String((pickBase().scale||1) * 1.12));
        t.el.textContent = '🥦👑' + ' ' + '×' + t.hp;
        emitScore();
      }
      return;
    }

    removeTarget(t);

    // ===== POWER ===== (5)
    if (t.type === 'power'){
      if (t.power === 'shield'){
        shieldUntil = now() + 5000;
        emitJudge('SHIELD ON!');
        const P = Particles; if (P && P.scorePop) P.scorePop(x,y,'🛡️ +5s',{ good:true });
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'shield' }}));
        return;
      }
      if (t.power === 'magnet'){
        magnetUntil = now() + 4000;
        emitJudge('MAGNET!');
        const P = Particles; if (P && P.scorePop) P.scorePop(x,y,'🧲 +4s',{ good:true });
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'magnet' }}));
        return;
      }
      if (t.power === 'time'){
        if (challenge !== 'survival'){
          timeLeft = clamp(timeLeft + 3, 0, 180);
          emitTime();
        }
        emitJudge('TIME +3!');
        const P = Particles; if (P && P.scorePop) P.scorePop(x,y,'⏳ +3s',{ good:true });
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'time' }}));
        return;
      }
      if (t.power === 'fever'){
        feverAdd(22);
        emitJudge('FEVER+');
        const P = Particles; if (P && P.scorePop) P.scorePop(x,y,'🔥 FEVER+',{ good:true });
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'fever' }}));
        return;
      }
    }

    // ===== FAKE GOOD ===== (4)
    if (t.type === 'fake'){
      // fake good = junk แบบแรงขึ้น
      if (shieldOn()){
        // shield block = NO miss
        emitJudge('BLOCK!');
        const P = Particles; if (P && P.scorePop) P.scorePop(x,y,'BLOCK',{ judgment:'FAKE', good:true });
        emitScore();
        return;
      }
      misses++;
      combo = 0;
      // ทำให้รู้สึก “เจ็บ”: ลด fever
      feverReduce(18);

      const P = Particles;
      if (P && P.scorePop) P.scorePop(x,y,'OOPS!',{ judgment:'FAKE!', good:false });

      emitScore();
      emitMiss();
      emitJudge('MISS', { why:'fake' });
      checkSurvivalLives();
      ROOT.dispatchEvent(new CustomEvent('quest:fakeHit',{ detail:{ hit:true }}));
      return;
    }

    // ===== JUNK =====
    if (t.type === 'junk'){
      if (shieldOn()){
        emitJudge('BLOCK!');
        const P = Particles; if (P && P.scorePop) P.scorePop(x,y,'BLOCK',{ good:true });
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:block',{ detail:{ ok:true }}));
        return;
      }
      misses++;
      combo = 0;
      feverReduce(12);

      const P = Particles;
      if (P && P.scorePop) P.scorePop(x,y,'-','{ }');

      emitScore();
      emitMiss();
      emitJudge('MISS');
      checkSurvivalLives();
      return;
    }

    // ===== GOOD / GOLD ===== (2)(6)
    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    // เติม fever เล็กน้อยจาก good เพื่อให้ “ติด fever ได้จริง”
    if (t.type === 'gold') feverAdd(10);
    else feverAdd(4);

    const feverNow = (FeverUI && typeof FeverUI.isActive === 'function') ? !!FeverUI.isActive() : false;
    const mult = comboMultiplier();

    // base reward
    let base = 10;
    if (t.type === 'gold') base = 80; // golden
    // fever bonus
    if (feverNow) base = Math.round(base * 1.7);

    // rush bonus: ช่วงท้าย + รู้สึกเร้าใจ
    const st = stageOf();
    if (challenge === 'rush'){
      if (st === 'mid') base = Math.round(base * 1.12);
      if (st === 'final') base = Math.round(base * 1.25);
    }

    const add = Math.round(base * mult);
    score += add;

    // FX
    if (Particles && typeof Particles.scorePop === 'function'){
      Particles.scorePop(x, y, '+' + add, {
        good:true,
        judgment: (t.type === 'gold') ? 'GOLD!' : (combo >= 8 ? 'PERFECT!' : 'GOOD')
      });
    }
    if (Particles && typeof Particles.burstAt === 'function'){
      if (t.type === 'gold') Particles.burstAt(x,y,{ count: 14, good:true });
      if (st === 'final' && Math.random() < 0.15) Particles.burstAt(x,y,{ count: 10, good:true });
    }

    // judge labels
    emitJudge(combo >= 10 ? 'PERFECT' : 'GOOD', { mult });
    emitScore();

    // quest hooks
    ROOT.dispatchEvent(new CustomEvent('quest:goodHit',{ detail:{ type:t.type, add, mult, feverNow }}));
  }

  // ===== Survival lives =====
  function checkSurvivalLives(){
    if (challenge !== 'survival') return;
    const lost = Math.floor((misses|0) / MISS_PER_LIFE);
    livesLeft = Math.max(0, MAX_LIVES - lost);
    ROOT.dispatchEvent(new CustomEvent('hha:lives',{ detail:{ livesLeft, max: MAX_LIVES }}));
    if (livesLeft <= 0){
      stop('lives-zero');
    }
  }

  // ===== Adaptive (9) =====
  function adaptIfNeeded(){
    if (runMode !== 'play') return; // research lock
    if (challenge === 'survival') return; // survival คุมโหดคงที่
    const t = now();
    if (t - lastAdaptAt < 5200) return;
    lastAdaptAt = t;

    const base = DIFF[diffKey] || DIFF.normal;
    // performance
    const missRate = (misses <= 0) ? 0 : (misses / Math.max(1, goodHits + misses));
    const cm = comboMax|0;

    // เก่ง -> เร่ง / พลาดเยอะ -> ผ่อน
    let spawnMs = base.spawnMs;
    let maxActive = base.maxActive;
    let scale = base.scale;

    if (cm >= 12 && missRate < 0.22){
      spawnMs = Math.round(base.spawnMs * 0.86);
      maxActive = Math.min(base.maxActive + 1, 6);
      scale = base.scale * 0.95;
      emitJudge('LEVEL UP!');
    } else if (missRate > 0.38){
      spawnMs = Math.round(base.spawnMs * 1.08);
      maxActive = Math.max(base.maxActive - 1, 2);
      scale = base.scale * 1.06;
      emitJudge('EASY DOWN!');
    }

    adaptive = { spawnMs, maxActive, scale };
    ROOT.dispatchEvent(new CustomEvent('hha:adaptive', { detail:{ ...adaptive } }));
  }

  // ===== Boss (1)(3) =====
  function maybeSpawnBoss(){
    if (challenge !== 'boss') return;
    if (bossSpawned) return;
    if (durationSec <= 0) return;
    if (timeLeft > 12) return; // โผล่ท้ายเกม 12 วิ
    bossSpawned = true;

    // clear screen a bit
    for (const t of active.slice()){
      if (t && t.type !== 'boss') removeTarget(t);
    }

    const el = createDomEl();
    el.classList.add('gj-boss');
    const base = pickBase();
    el.style.setProperty('--tScale', String(base.scale * 1.28));

    const hp = (base.bossHP|0) || 8;
    const t = {
      el,
      type:'boss',
      emoji:'🥦👑 ×' + hp,
      hp,
      pos: spawnWorld(),
      born: now(),
      ttl: 999999,
      seen: false,
      fallback2D: { x: window.innerWidth/2, y: window.innerHeight*0.38 },
      wobbleSeed: Math.random()*10
    };
    el.textContent = t.emoji;

    active.push(t);
    layerEl.appendChild(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    bossTarget = t;
    emitJudge('BOSS!');
    ROOT.dispatchEvent(new CustomEvent('quest:boss', { detail:{ hp }}));
  }

  // ===== Loops =====
  function renderLoop(){
    if (!running) return;

    const ready = cameraReady();
    const st = stageOf();

    for (const t of active){
      if (!t || !t.el) continue;

      if (!t.pos && ready) t.pos = spawnWorld();

      let p = null;
      if (ready && t.pos) p = project(t.pos);
      if (!p) p = t.fallback2D;
      else t.seen = true;

      // (5) magnet: ดึงเป้าเข้าหาศูนย์กลาง
      if (magnetOn()){
        const cx = window.innerWidth/2;
        const cy = window.innerHeight/2;
        const k = 0.18;
        p = {
          x: p.x + (cx - p.x)*k,
          y: p.y + (cy - p.y)*k
        };
      }

      // (3) เพิ่ม wobble เฉพาะ mid/final ให้ “เคลื่อนนิด ๆ” เร้าใจ
      if (st !== 'early'){
        const tt = (now() - t.born) / 1000;
        const amp = (st === 'final') ? 10 : 6;
        p.x += Math.sin(tt*2.2 + t.wobbleSeed)*amp;
        p.y += Math.cos(tt*2.0 + t.wobbleSeed)*amp*0.8;
      }

      t.el.style.display = 'block';
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  function spawnLoop(){
    if (!running) return;

    const base = pickBase();
    const st = stageOf();

    // boss check
    maybeSpawnBoss();

    // spawn condition
    if (!bossTarget && active.length < base.maxActive){
      const spec = makeTargetSpec();
      createTarget(spec);
    }

    // stage-based spawn speed + rush extra
    let ms = base.spawnMs;
    ms = Math.round(ms * stageSpawnMult(st));
    if (challenge === 'rush' && st === 'final') ms = Math.round(ms * 0.86);

    // adaptive (play only)
    adaptIfNeeded();

    spawnTimer = setTimeout(spawnLoop, ms);
  }

  function tickLoop(){
    if (!running) return;

    // fever edges
    emitFeverEdgeIfNeeded();

    // (1) time
    if (challenge !== 'survival'){
      timeLeft = Math.max(0, (timeLeft|0) - 1);
      emitTime();
      if (timeLeft <= 0){
        stop('time-up');
        return;
      }
    } else {
      // survival ส่ง time = -1 เพื่อ HUD รู้ว่าไม่จับเวลา (ถ้าจะใช้)
      // แต่ไม่จำเป็นก็ไม่ส่ง
    }

    tickTimer = setTimeout(tickLoop, 1000);
  }

  // ===== API =====
  function start(diff, opts={}){
    if (running) return;

    running = true;
    layerEl = opts.layerEl || document.getElementById('gj-layer');

    diffKey = String(diff || 'normal').toLowerCase();
    if (!DIFF[diffKey]) diffKey = 'normal';

    runMode = (opts.runMode === 'research') ? 'research' : 'play';

    challenge = String(opts.challenge || 'rush').toLowerCase();
    if (!CHALLENGES.includes(challenge)) challenge = 'rush';

    durationSec = clamp(opts.durationSec ?? 60, 20, 180);
    timeLeft = durationSec;

    // reset stats
    score=0; combo=0; comboMax=0; goodHits=0; misses=0;
    shieldUntil = 0;
    magnetUntil = 0;
    bossSpawned = false;
    bossTarget = null;

    adaptive = { spawnMs: null, maxActive: null, scale: null };
    lastAdaptAt = 0;

    livesLeft = MAX_LIVES;
    ROOT.dispatchEvent(new CustomEvent('hha:lives',{ detail:{ livesLeft, max: MAX_LIVES }}));

    if (FeverUI && typeof FeverUI.reset === 'function'){
      FeverUI.reset();
    }

    // announce
    ROOT.dispatchEvent(new CustomEvent('hha:mode', { detail:{ diff:diffKey, runMode, challenge, durationSec } }));

    emitTime();
    emitScore();

    // go
    renderLoop();
    spawnLoop();
    tickLoop();

    console.log('[GoodJunkVR] start', { diffKey, runMode, challenge, durationSec });
  }

  function stop(reason='stop'){
    if (!running) return;
    running = false;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (spawnTimer) clearTimeout(spawnTimer);
    spawnTimer = null;
    if (tickTimer) clearTimeout(tickTimer);
    tickTimer = null;

    const copy = active.slice();
    for (const t of copy) removeTarget(t);
    active.length = 0;

    ROOT.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        scoreFinal:score,
        comboMax,
        misses,
        goodHits,
        reason,
        timeLeft,
        durationSec,
        runMode,
        diff: diffKey,
        challenge
      }
    }));
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

export const GameEngine = window.GoodJunkVR.GameEngine;
