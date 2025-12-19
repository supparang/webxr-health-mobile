// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (HYPER v4: A+B+C)
// - Rush/Overheat + Danger Window + Power costs + Panic + Boss warn/phase2
// - Emits logger events: hha:spawn/hha:hit/hha:block/hha:expire/hha:end
// - Keeps: survival lives, fever hooks, adaptive(play only)

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

  const GOLD = '🟡';
  const FAKE_SPARK = '✨';

  // ===== Tuning: more intense but fair =====
  const DIFF = {
    easy:   { spawnMs: 980, maxActive: 3, scale: 1.18, goodRatio: 0.76, powerRatio: 0.13, goldRatio: 0.06, fakeRatio: 0.06, bossHP: 7 },
    normal: { spawnMs: 760, maxActive: 4, scale: 1.02, goodRatio: 0.70, powerRatio: 0.12, goldRatio: 0.06, fakeRatio: 0.08, bossHP: 9 },
    hard:   { spawnMs: 610, maxActive: 5, scale: 0.92, goodRatio: 0.64, powerRatio: 0.10, goldRatio: 0.07, fakeRatio: 0.10, bossHP: 12 }
  };

  const CHALLENGES = ['rush','survival','boss'];

  let running=false;
  let layerEl=null;
  let active=[];
  let rafId=null, spawnTimer=null, tickTimer=null;

  let score=0;
  let combo=0;
  let comboMax=0;
  let goodHits=0;
  let misses=0;

  let shieldUntil = 0;
  let magnetUntil = 0;

  let feverActive=false;
  let feverPrev=false;

  let durationSec = 60;
  let timeLeft = 60;
  let challenge = 'rush';
  let runMode = 'play';
  let diffKey = 'normal';

  // survival lives
  const MAX_LIVES = 3;
  const MISS_PER_LIFE = 3;
  let livesLeft = MAX_LIVES;

  // boss
  let bossSpawned = false;
  let bossTarget = null;
  let bossWarned = false;

  // adaptive
  let adaptive = { spawnMs: null, maxActive: null, scale: null };
  let lastAdaptAt = 0;

  // RUSH / OVERHEAT (A)
  let rushMeter = 0;     // 0..100
  let rushUntil = 0;     // rush active duration
  let overheatUntil = 0; // punishment window
  function isRush(){ return now() < rushUntil; }
  function isOverheat(){ return now() < overheatUntil; }

  // helpers
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

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
  function now(){ return performance.now(); }
  function isoNow(){ return new Date().toISOString(); }

  function uid(){
    return 't-' + Math.random().toString(16).slice(2,8) + '-' + (Date.now()%100000);
  }

  function emitJudge(label, extra){
    ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ label, ...extra } }));
  }
  function emitMiss(){
    ROOT.dispatchEvent(new CustomEvent('hha:miss',{ detail:{ misses }}));
  }

  function emitRush(){
    ROOT.dispatchEvent(new CustomEvent('hha:rush', {
      detail:{
        meter: rushMeter,
        rush: isRush(),
        overheat: isOverheat(),
        rushLeftMs: Math.max(0, rushUntil - now()),
        overheatLeftMs: Math.max(0, overheatUntil - now())
      }
    }));
  }

  function addRush(v){
    rushMeter = clamp(rushMeter + (v||0), 0, 100);
    if (rushMeter >= 100 && !isRush()){
      rushMeter = 0;
      rushUntil = now() + 6000;
      emitJudge('RUSH!!!');
      if (Particles?.scorePop) Particles.scorePop(window.innerWidth/2, window.innerHeight*0.22, 'RUSH MODE!', { good:true, judgment:'🔥' });
    }
    emitRush();
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

  function shieldOn(){ return now() < shieldUntil; }
  function magnetOn(){ return now() < magnetUntil; }

  function comboMultiplier(){
    const step = Math.floor((combo||0)/6);
    let m = clamp(1 + step*0.5, 1, 3);

    // shield nerf: reward stays but not too free
    if (shieldOn()) m = Math.max(1, m - 0.5);

    // rush boost
    if (isRush()) m = clamp(m + 0.5, 1, 3);

    // overheat penalty
    if (isOverheat()) m = Math.max(1, m - 0.5);

    return m;
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
      detail:{
        score, combo, comboMax, goodHits, misses,
        feverActive,
        shieldOn: shieldOn(),
        magnetOn: magnetOn(),
        rush: isRush(),
        overheat: isOverheat(),
        rushMeter,
        livesLeft,
        timeLeft, durationSec, runMode, diff: diffKey, challenge
      }
    }));
  }

  function emitTime(){
    ROOT.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft }}));
  }

  function emitSpawn(t){
    ROOT.dispatchEvent(new CustomEvent('hha:spawn', { detail:{
      timestampIso: isoNow(),
      targetId: t.id,
      emoji: t.emoji,
      itemType: t.type === 'gold' ? 'gold' :
                t.type === 'fake' ? 'fake' :
                t.type === 'boss' ? 'boss' :
                t.type === 'power' ? (t.power || 'power') :
                t.type,
      rtMs: null
    }}));
  }

  function emitHit(t, rtMs, extra){
    ROOT.dispatchEvent(new CustomEvent('hha:hit', { detail:{
      timestampIso: isoNow(),
      targetId: t.id,
      emoji: t.emoji,
      itemType: t.type === 'gold' ? 'gold' :
                t.type === 'fake' ? 'fake' :
                t.type === 'boss' ? 'boss' :
                t.type === 'power' ? (t.power || 'power') :
                t.type,
      rtMs: (typeof rtMs === 'number') ? Math.round(rtMs) : null,
      ...extra
    }}));
  }

  function emitBlock(t, extra){
    ROOT.dispatchEvent(new CustomEvent('hha:block', { detail:{
      timestampIso: isoNow(),
      targetId: t?.id || '',
      emoji: t?.emoji || '',
      itemType: t?.type || '',
      ...extra
    }}));
  }

  function emitExpire(t){
    ROOT.dispatchEvent(new CustomEvent('hha:expire', { detail:{
      timestampIso: isoNow(),
      targetId: t.id,
      emoji: t.emoji,
      itemType: t.type
    }}));
  }

  // ===== World spawn/project =====
  function spawnWorld(){
    const THREE = getTHREE();
    const cam = getCameraObj3D();
    if (!cam || !THREE) return null;

    const pos = new THREE.Vector3();
    cam.getWorldPosition(pos);

    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);

    pos.add(dir.multiplyScalar(2.1));
    pos.x += (Math.random()-0.5)*1.9;
    pos.y += (Math.random()-0.5)*1.5;

    return pos;
  }

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

  // ===== Stage pacing =====
  function stageOf(){
    if (challenge === 'survival') return 'mid';
    const elapsed = Math.max(0, durationSec - timeLeft);
    const p = durationSec > 0 ? elapsed / durationSec : 0;
    if (p < 0.33) return 'early';
    if (p < 0.78) return 'mid';
    return 'final';
  }
  function stageSpawnMult(st){
    if (st === 'early') return 1.00;
    if (st === 'mid')   return 0.86;
    return 0.74;
  }

  // ===== DOM target =====
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

    // power — rarer in hard + costs handled on pickup
    if (r < base.powerRatio){
      const pr = Math.random();
      if (pr < 0.34) return { type:'power', power:'shield', emoji: POWER_SHIELD, ttl: 1550 };
      if (pr < 0.67) return { type:'power', power:'magnet', emoji: POWER_MAGNET, ttl: 1550 };
      return { type:'power', power:'time', emoji: POWER_TIME, ttl: 1550 };
    }

    // fake — tricky
    if (r < base.powerRatio + base.fakeRatio){
      const e = GOOD[(Math.random()*GOOD.length)|0];
      return { type:'fake', emoji: e + FAKE_SPARK, ttl: 1800 };
    }

    // gold — big reward, short TTL
    if (r < base.powerRatio + base.fakeRatio + base.goldRatio){
      const e = GOOD[(Math.random()*GOOD.length)|0];
      return { type:'gold', emoji: GOLD + e, ttl: 1100 };
    }

    // normal good/junk
    const good = (Math.random() < base.goodRatio);
    if (good){
      const e = GOOD[(Math.random()*GOOD.length)|0];
      // fever power hidden chance
      if (Math.random() < 0.075) return { type:'power', power:'fever', emoji: POWER_FEVER, ttl: 1400 };
      return { type:'good', emoji: e, ttl: 2100 };
    }
    const j = JUNK[(Math.random()*JUNK.length)|0];
    return { type:'junk', emoji: j, ttl: 2100 };
  }

  function createTarget(spec){
    if (!layerEl) return;
    const el = createDomEl();

    const base = pickBase();
    el.style.setProperty('--tScale', String(base.scale));

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
      id: uid(),
      el,
      type: spec.type,
      power: spec.power || null,
      emoji: spec.emoji,
      pos: spawnWorld(),
      born: now(),
      ttl: spec.ttl || 2100,
      seen: false,
      fallback2D,
      wobbleSeed: Math.random()*10,
      isDanger: false
    };

    active.push(t);
    layerEl.appendChild(el);

    emitSpawn(t);

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

  function missPenalty(kind='miss', extra=0){
    misses += (1 + (extra|0));
    combo = 0;
    emitScore();
    emitMiss();
    emitJudge(kind);
    checkSurvivalLives();
  }

  function expireTarget(t){
    if (!running) return;
    removeTarget(t);
    emitExpire(t);

    // good/gold expired => miss
    if ((t.type === 'good' || t.type === 'gold') && t.seen){
      // rush meter drops when you "let good go"
      addRush(-14);
      missPenalty('MISS');
    }
  }

  function feverAdd(v){
    if (!FeverUI || typeof FeverUI.add !== 'function') return;
    FeverUI.add(v);
  }
  function feverReduce(v){
    if (!FeverUI || typeof FeverUI.add !== 'function') return;
    FeverUI.add(-Math.abs(v||0));
  }

  // ===== Danger window (B) =====
  function isDangerPos(p){
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    const dx = p.x - cx, dy = p.y - cy;
    const d = Math.sqrt(dx*dx + dy*dy);
    return d < Math.min(cx,cy)*0.22;
  }

  function hitTarget(t, x, y){
    if (!t || !t.el) return;
    const rt = now() - (t.born||now());

    // ===== Boss fight (C) =====
    if (t.type === 'boss'){
      t.hp = (t.hp|0) - 1;
      emitHit(t, rt, { judgment:'boss-hit' });

      if (Particles?.scorePop) Particles.scorePop(x,y,'HIT!',{ judgment:'BOSS', good:true });
      emitJudge('BOSS HIT!');

      const base = pickBase();
      const half = Math.ceil(((base.bossHP|0)||8)/2);

      if (t.hp === half){
        emitJudge('BOSS PHASE 2!');
        if (Particles?.scorePop) Particles.scorePop(window.innerWidth/2, window.innerHeight*0.22, 'PHASE 2!', { good:true, judgment:'⚠️' });

        // Phase 2: spawn junk around (pressure)
        createTarget({ type:'junk', emoji: JUNK[(Math.random()*JUNK.length)|0], ttl: 1350 });
        createTarget({ type:'junk', emoji: JUNK[(Math.random()*JUNK.length)|0], ttl: 1350 });
      }

      if (t.hp <= 0){
        removeTarget(t);
        bossTarget = null;

        const mult = comboMultiplier();
        const feverNow = (FeverUI && FeverUI.isActive) ? !!FeverUI.isActive() : false;
        const add = Math.round((260 * mult) * (feverNow ? 1.2 : 1));
        score += add;

        combo += 3;
        comboMax = Math.max(comboMax, combo);

        if (Particles?.burstAt){
          Particles.burstAt(window.innerWidth/2, window.innerHeight*0.22, { count: 34, good: true });
        }
        emitJudge('BOSS CLEAR!');
        ROOT.dispatchEvent(new CustomEvent('quest:bossClear',{ detail:{ ok:true } }));

        // big rush reward
        addRush(+40);
        emitScore();
      }else{
        t.el.style.setProperty('--tScale', String((pickBase().scale||1) * 1.14));
        t.el.textContent = '🥦👑 ×' + t.hp;
        emitScore();
      }
      return;
    }

    // remove now
    removeTarget(t);

    // ===== Power-ups with cost (A+B) =====
    if (t.type === 'power'){
      emitHit(t, rt, { judgment:'power' });

      if (t.power === 'shield'){
        shieldUntil = now() + 5200;
        emitJudge('SHIELD ON!');
        if (Particles?.scorePop) Particles.scorePop(x,y,'🛡️ SHIELD',{ good:true });
        addRush(+10);
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'shield' } }));
        return;
      }

      if (t.power === 'magnet'){
        magnetUntil = now() + 4200;

        // risk: magnet also "tightens" junk (handled in render)
        emitJudge('MAGNET RISK!');
        if (Particles?.scorePop) Particles.scorePop(x,y,'🧲 MAGNET',{ good:true, judgment:'RISK' });
        addRush(+10);
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'magnet' } }));
        return;
      }

      if (t.power === 'time'){
        // cost: -40 score, gain time
        score = Math.max(0, score - 40);
        if (challenge !== 'survival'){
          timeLeft = clamp(timeLeft + 3, 0, 180);
          emitTime();
        }
        emitJudge('TIME +3 (COST -40)');
        if (Particles?.scorePop) Particles.scorePop(x,y,'⏳ +3s (-40)',{ good:true });
        addRush(+6);
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'time' } }));
        return;
      }

      if (t.power === 'fever'){
        // cost: slightly shorter TTL pressure (by overheat-lite)
        feverAdd(22);
        overheatUntil = Math.max(overheatUntil, now() + 1500);
        emitJudge('FEVER+');
        if (Particles?.scorePop) Particles.scorePop(x,y,'🔥 FEVER+',{ good:true });
        addRush(+12);
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:power',{ detail:{ power:'fever' } }));
        return;
      }
    }

    // ===== Fake / Junk (B) =====
    if (t.type === 'fake'){
      emitHit(t, rt, { judgment:'fake' });

      if (shieldOn()){
        emitJudge('BLOCK!');
        if (Particles?.scorePop) Particles.scorePop(x,y,'BLOCK',{ judgment:'FAKE', good:true });
        emitBlock(t, { why:'fake' });
        addRush(+4);
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:block',{ detail:{ ok:true, why:'fake' } }));
        return;
      }

      // fake hurts more in danger
      const extra = t.isDanger ? 1 : 0;
      feverReduce(18 + extra*8);
      addRush(-28);

      if (Particles?.scorePop) Particles.scorePop(x,y,'OOPS!',{ judgment: extra ? 'FAKE DANGER!' : 'FAKE!', good:false });

      missPenalty(extra ? 'DANGER FAKE!' : 'MISS', extra);
      ROOT.dispatchEvent(new CustomEvent('quest:fakeHit',{ detail:{ hit:true, danger: !!extra } }));
      return;
    }

    if (t.type === 'junk'){
      emitHit(t, rt, { judgment:'junk' });

      if (shieldOn()){
        emitJudge('BLOCK!');
        if (Particles?.scorePop) Particles.scorePop(x,y,'BLOCK',{ good:true });
        emitBlock(t, { why:'junk' });
        addRush(+4);
        emitScore();
        ROOT.dispatchEvent(new CustomEvent('quest:block',{ detail:{ ok:true, why:'junk' } }));
        return;
      }

      const extra = t.isDanger ? 1 : 0;
      feverReduce(12 + extra*10);
      addRush(-30);

      if (Particles?.scorePop) Particles.scorePop(x,y,'MISS',{ judgment: extra ? 'DANGER!' : 'JUNK!', good:false });

      missPenalty(extra ? 'DANGER HIT!' : 'MISS', extra);
      return;
    }

    // ===== GOOD / GOLD (A) =====
    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    // rush meter grows when you play clean
    addRush(t.type === 'gold' ? 18 : 10);

    if (t.type === 'gold') feverAdd(12);
    else feverAdd(5);

    const feverNow = (FeverUI && typeof FeverUI.isActive === 'function') ? !!FeverUI.isActive() : false;
    const mult = comboMultiplier();

    let baseScore = 10;
    if (t.type === 'gold') baseScore = 86;

    if (feverNow) baseScore = Math.round(baseScore * 1.65);
    if (isRush()) baseScore = Math.round(baseScore * 1.18);
    if (isOverheat()) baseScore = Math.round(baseScore * 0.92);

    const st = stageOf();
    if (challenge === 'rush'){
      if (st === 'mid') baseScore = Math.round(baseScore * 1.10);
      if (st === 'final') baseScore = Math.round(baseScore * 1.22);
    }

    const add = Math.round(baseScore * mult);
    score += add;

    emitHit(t, rt, { judgment: (t.type === 'gold') ? 'gold' : 'good', add, mult, feverNow });

    if (Particles?.scorePop){
      Particles.scorePop(x, y, '+' + add, {
        good:true,
        judgment: (t.type === 'gold') ? 'GOLD!' : (combo >= 10 ? 'PERFECT!' : 'GOOD')
      });
    }
    if (Particles?.burstAt){
      if (t.type === 'gold') Particles.burstAt(x,y,{ count: 16, good:true });
      if (st === 'final' && Math.random() < 0.18) Particles.burstAt(x,y,{ count: 11, good:true });
    }

    emitJudge(combo >= 10 ? 'PERFECT' : 'GOOD', { mult });
    emitScore();

    ROOT.dispatchEvent(new CustomEvent('quest:goodHit',{ detail:{ type:t.type, add, mult, feverNow } }));
  }

  function checkSurvivalLives(){
    if (challenge !== 'survival') return;
    const lost = Math.floor((misses|0) / MISS_PER_LIFE);
    livesLeft = Math.max(0, MAX_LIVES - lost);
    ROOT.dispatchEvent(new CustomEvent('hha:lives',{ detail:{ livesLeft, max: MAX_LIVES } }));
    if (livesLeft <= 0){
      stop('lives-zero');
    }
  }

  // adaptive: only play + non-survival (keeps your rule)
  function adaptIfNeeded(){
    if (runMode !== 'play') return;
    if (challenge === 'survival') return;
    const t = now();
    if (t - lastAdaptAt < 5200) return;
    lastAdaptAt = t;

    const base = DIFF[diffKey] || DIFF.normal;
    const missRate = (misses <= 0) ? 0 : (misses / Math.max(1, goodHits + misses));
    const cm = comboMax|0;

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

  function maybeSpawnBoss(){
    if (challenge !== 'boss') return;
    if (bossSpawned) return;
    if (durationSec <= 0) return;

    // warning at 14s
    if (!bossWarned && timeLeft <= 14){
      bossWarned = true;
      emitJudge('⚠️ BOSS INCOMING!');
      if (Particles?.scorePop){
        Particles.scorePop(window.innerWidth/2, window.innerHeight*0.22, 'BOSS INCOMING!', { good:true, judgment:'⚠️' });
      }
    }

    if (timeLeft > 12) return;

    bossSpawned = true;

    // clear other targets
    for (const t of active.slice()){
      if (t && t.type !== 'boss') removeTarget(t);
    }

    const el = createDomEl();
    el.classList.add('gj-boss');
    const base = pickBase();
    el.style.setProperty('--tScale', String(base.scale * 1.30));

    const hp = (base.bossHP|0) || 9;
    const t = {
      id: uid(),
      el,
      type:'boss',
      emoji:'🥦👑 ×' + hp,
      hp,
      pos: spawnWorld(),
      born: now(),
      ttl: 999999,
      seen: false,
      fallback2D: { x: window.innerWidth/2, y: window.innerHeight*0.38 },
      wobbleSeed: Math.random()*10,
      isDanger: true
    };
    el.textContent = t.emoji;

    active.push(t);
    layerEl.appendChild(el);

    emitSpawn(t);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(t, e.clientX || 0, e.clientY || 0);
    });

    bossTarget = t;
    emitJudge('BOSS!');
    ROOT.dispatchEvent(new CustomEvent('quest:boss', { detail:{ hp } }));
  }

  // ===== render loop =====
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

      // magnet: pulls everything; risk -> junk pulls stronger + more danger
      if (magnetOn()){
        const cx = window.innerWidth/2;
        const cy = window.innerHeight/2;
        const kBase = 0.18;

        let k = kBase;
        if (t.type === 'junk' || t.type === 'fake') k = 0.26; // risk: junk moves faster to center
        p = { x: p.x + (cx - p.x)*k, y: p.y + (cy - p.y)*k };
      }

      // danger flag
      t.isDanger = isDangerPos(p);

      // wobble later stages
      if (st !== 'early'){
        const tt = (now() - t.born) / 1000;
        const amp = (st === 'final') ? 10 : 6;
        p.x += Math.sin(tt*2.2 + t.wobbleSeed)*amp;
        p.y += Math.cos(tt*2.0 + t.wobbleSeed)*amp*0.8;
      }

      // danger visual (subtle)
      const baseScale = (pickBase().scale||1);
      const dangerBoost = t.isDanger ? 1.08 : 1.0;
      const rushBoost = isRush() ? 1.02 : 1.0;
      const overheatShrink = isOverheat() ? 0.97 : 1.0;

      t.el.style.setProperty('--tScale', String(baseScale * dangerBoost * rushBoost * overheatShrink));

      t.el.style.display = 'block';
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  // ===== spawn loop =====
  function spawnLoop(){
    if (!running) return;

    const base = pickBase();
    const st = stageOf();

    maybeSpawnBoss();

    if (!bossTarget && active.length < base.maxActive){
      const spec = makeTargetSpec();
      createTarget(spec);
    }

    let ms = base.spawnMs;
    ms = Math.round(ms * stageSpawnMult(st));

    // rush pacing
    if (challenge === 'rush' && st === 'final') ms = Math.round(ms * 0.86);
    if (isRush()) ms = Math.round(ms * 0.82);

    // overheat punishment (harder)
    if (isOverheat()) ms = Math.round(ms * 0.75);

    adaptIfNeeded();

    spawnTimer = setTimeout(spawnLoop, ms);
  }

  // ===== tick loop =====
  function tickLoop(){
    if (!running) return;

    emitFeverEdgeIfNeeded();

    if (challenge !== 'survival'){
      timeLeft = Math.max(0, (timeLeft|0) - 1);
      emitTime();

      // panic last 8 sec
      if (timeLeft <= 8){
        ROOT.dispatchEvent(new CustomEvent('hha:panic',{ detail:{ sec: timeLeft } }));
      }

      // spawn pressure in final seconds (Boss aside)
      if (timeLeft <= 6 && challenge === 'rush'){
        // micro-overheat pulses
        overheatUntil = Math.max(overheatUntil, now() + 250);
        emitRush();
      }

      if (timeLeft <= 0){
        stop('time-up');
        return;
      }
    }

    tickTimer = setTimeout(tickLoop, 1000);
  }

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

    score=0; combo=0; comboMax=0; goodHits=0; misses=0;
    shieldUntil = 0;
    magnetUntil = 0;

    bossSpawned = false;
    bossTarget = null;
    bossWarned = false;

    adaptive = { spawnMs: null, maxActive: null, scale: null };
    lastAdaptAt = 0;

    livesLeft = MAX_LIVES;
    ROOT.dispatchEvent(new CustomEvent('hha:lives',{ detail:{ livesLeft, max: MAX_LIVES } }));

    // rush reset
    rushMeter = 0; rushUntil = 0; overheatUntil = 0;
    emitRush();

    if (FeverUI && typeof FeverUI.reset === 'function'){
      FeverUI.reset();
    }

    ROOT.dispatchEvent(new CustomEvent('hha:mode', { detail:{ diff:diffKey, runMode, challenge, durationSec } }));

    emitTime();
    emitScore();

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
        challenge,
        // ให้ logger เติม stats เพิ่มได้จากฝั่งหน้าเกมถ้าต้องการ
      }
    }));
  }

  ns.GameEngine = { start, stop };

})(window.GoodJunkVR = window.GoodJunkVR || {});

export const GameEngine = window.GoodJunkVR.GameEngine;
