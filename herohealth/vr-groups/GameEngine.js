/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (PRODUCTION A+B+C)
Works with:
- groups-hud-quest.js (quest binder)
- groups-quests.js (QuestDirector)  [listens to events below]
- groups-fx.js (candy fx)
Emits:
- groups:group_change {groupId,label,from}
- groups:power {charge,threshold}
- groups:storm {on,durSec}
- groups:progress {kind:'group_swap'|'boss_spawn'|'boss_down'}
- hha:score {score,combo,comboMax,misses}
- hha:judge {kind:'good'|'bad'|'warn'|'boss', text}
- hha:rank {grade, accuracy}
- hha:time {left}
- hha:end {scoreFinal, comboMax, misses, goalsCleared, goalsTotal, miniCleared, miniTotal, accuracyGoodPct, grade, ...metrics}
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  const layer = DOC.getElementById('fg-layer') || DOC.querySelector('.fg-layer');
  if (!layer) return;

  // ---------------- RNG (seeded) ----------------
  function xmur3(str){
    str = String(str||'seed');
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed){
    const gen = xmur3(seed);
    return sfc32(gen(), gen(), gen(), gen());
  }

  // ---------------- Helpers ----------------
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function qs(name, def){
    try{ return (new URL(root.location.href)).searchParams.get(name) ?? def; }
    catch{ return def; }
  }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  // ---------------- Content ----------------
  const GROUPS = {
    1: { label:'หมู่ 1', emoji:['🥛','🥚','🍗','🐟','🥜','🫘'] },
    2: { label:'หมู่ 2', emoji:['🍚','🍞','🥔','🍠','🥖','🍜'] },
    3: { label:'หมู่ 3', emoji:['🥦','🥬','🥕','🌽','🥒','🍆'] },
    4: { label:'หมู่ 4', emoji:['🍎','🍌','🍊','🍉','🍓','🍍'] },
    5: { label:'หมู่ 5', emoji:['🥑','🫒','🧈','🥥','🧀','🌰'] }
  };

  const JUNK_EMOJI = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭'];
  const DECOY_EMOJI = ['🎭','🌀','✨','🌈','🎈']; // น่ารัก หลอกแบบไม่หลอน

  // ---------------- Engine State ----------------
  const engine = {
    running:false,
    ended:false,
    runMode:'play', // play | research
    diff:'normal',
    timeSec:90,
    seed:'seed',
    rng:Math.random,

    // view move (VR feel)
    vx:0, vy:0,
    dragOn:false,
    dragX:0, dragY:0,

    // gameplay
    left:90,
    score:0,
    combo:0,
    comboMax:0,
    misses:0,

    hitGood:0,
    hitAll:0,

    // group
    groupId:1,
    groupLabel:'หมู่ 1',
    groupClean:true, // for PERFECT SWITCH
    groupStartMs:0,

    // power
    power:0,
    powerThr:10,

    // spawn tuning
    baseSpawnMs: 780,
    ttlMs: 1600,
    sizeBase: 1.0,

    // adaptive (play only)
    adapt: { spawnMs:780, ttl:1600, size:1.0, junkBias:0.12, decoyBias:0.10, bossEvery: 18000 },

    // storm
    storm:false,
    stormUntilMs:0,
    nextStormAtMs:0,
    stormDurSec:6,

    // boss
    bossAlive:false,
    bossHp:0,
    bossHpMax:3,
    nextBossAtMs:0,

    // shield (C: CLEAN SHIELD)
    shield:0,
    cleanStreakMs:0,

    // loops
    spawnTimer:0,
    tickTimer:0,
  };

  function diffParams(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy') return { spawnMs:900, ttl:1750, size:1.05, powerThr:9,  junk:0.10, decoy:0.08, stormDur:6, bossHp:3 };
    if (diff === 'hard') return { spawnMs:680, ttl:1450, size:0.92, powerThr:11, junk:0.16, decoy:0.12, stormDur:7, bossHp:4 };
    return                 { spawnMs:780, ttl:1600, size:1.00, powerThr:10, junk:0.12, decoy:0.10, stormDur:6, bossHp:3 };
  }

  function rankFromAcc(acc){
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  function updateRank(){
    const acc = engine.hitAll > 0 ? Math.round((engine.hitGood/engine.hitAll)*100) : 0;
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
  }

  function updateScore(){
    emit('hha:score', { score: engine.score|0, combo: engine.combo|0, comboMax: engine.comboMax|0, misses: engine.misses|0 });
    updateRank();
  }

  function updateTime(){
    emit('hha:time', { left: engine.left|0 });
  }

  function updatePower(){
    emit('groups:power', { charge: engine.power|0, threshold: engine.powerThr|0 });
  }

  function setGroup(id, from){
    engine.groupId = id;
    engine.groupLabel = (GROUPS[id] ? GROUPS[id].label : ('หมู่ '+id));
    engine.groupClean = true;
    engine.groupStartMs = now();
    emit('groups:group_change', { groupId:id, label: engine.groupLabel, from: from|0 });
  }

  // ---------------- VR-feel move (drag+gyro) ----------------
  function applyView(){
    layer.style.setProperty('--vx', engine.vx.toFixed(1)+'px');
    layer.style.setProperty('--vy', engine.vy.toFixed(1)+'px');
  }
  function setupView(){
    // drag
    layer.addEventListener('pointerdown', (e)=>{
      engine.dragOn = true;
      engine.dragX = e.clientX;
      engine.dragY = e.clientY;
    }, { passive:true });
    root.addEventListener('pointermove', (e)=>{
      if (!engine.dragOn) return;
      const dx = e.clientX - engine.dragX;
      const dy = e.clientY - engine.dragY;
      engine.dragX = e.clientX;
      engine.dragY = e.clientY;
      engine.vx = clamp(engine.vx + dx*0.22, -90, 90);
      engine.vy = clamp(engine.vy + dy*0.22, -90, 90);
      applyView();
    }, { passive:true });
    root.addEventListener('pointerup', ()=>{ engine.dragOn=false; }, { passive:true });

    // gyro (เบา ๆ)
    root.addEventListener('deviceorientation', (ev)=>{
      const gx = Number(ev.gamma)||0; // left-right
      const gy = Number(ev.beta)||0;  // front-back
      // ผสมกับ drag (ไม่แย่งกัน)
      engine.vx = clamp(engine.vx + gx*0.06, -90, 90);
      engine.vy = clamp(engine.vy + (gy-20)*0.02, -90, 90);
      applyView();
    }, { passive:true });
  }

  // ---------------- Spawn utils ----------------
  function pick(arr){
    if (!arr || !arr.length) return '';
    return arr[(engine.rng()*arr.length)|0];
  }

  function makeTarget(type, emoji, x, y, s){
    const el = DOC.createElement('div');
    el.className = 'fg-target spawn';
    el.dataset.emoji = emoji || '✨';
    el.dataset.type = type;
    el.style.setProperty('--x', x.toFixed(1)+'px');
    el.style.setProperty('--y', y.toFixed(1)+'px');
    el.style.setProperty('--s', s.toFixed(3));

    // type classes
    if (type === 'good') el.classList.add('fg-good');
    else if (type === 'wrong') el.classList.add('fg-wrong');
    else if (type === 'junk') el.classList.add('fg-junk');
    else if (type === 'decoy') el.classList.add('fg-decoy');
    else if (type === 'boss') el.classList.add('fg-boss');

    // TTL
    const born = now();
    const ttl = engine.storm ? Math.max(850, engine.ttlMs*0.85) : engine.ttlMs;
    const timer = root.setTimeout(()=>{
      if (!el.isConnected) return;
      // expire: only count miss for GOOD (เหมือนที่คุณใช้ในโปรเจกต์อื่น)
      if (type === 'good'){
        engine.misses++;
        engine.combo = 0;
        engine.groupClean = false;
        emit('hha:judge', { kind:'warn', text:'MISS!' });
        updateScore();
      }
      el.classList.add('out');
      root.setTimeout(()=> el.remove(), 220);
    }, ttl);

    el._ttlTimer = timer;
    el._born = born;

    // click to shoot
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el);
    }, { passive:false });

    return el;
  }

  function safeSpawnRect(){
    // กันทับ HUD: top/bottom/side
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    const top = 150;         // HUD top height
    const bot = 170;         // end safe
    const side = 16;

    const x0 = side, x1 = W - side;
    const y0 = top,  y1 = H - bot;
    return { x0, x1, y0, y1, W, H };
  }

  function randPos(){
    const r = safeSpawnRect();
    const x = r.x0 + engine.rng()*(r.x1 - r.x0);
    const y = r.y0 + engine.rng()*(r.y1 - r.y0);
    return { x, y };
  }

  // ---------------- Core mechanics (A+B+C) ----------------
  function enterStorm(){
    engine.storm = true;
    engine.stormUntilMs = now() + engine.stormDurSec*1000;
    DOC.body.classList.add('groups-storm');
    emit('groups:storm', { on:true, durSec: engine.stormDurSec|0 });

    // เร้าใจ: เพิ่ม spawn/ลด size ใน storm (แต่ยุติธรรม)
    if (engine.runMode === 'play'){
      engine.adapt.spawnMs = Math.max(420, engine.adapt.spawnMs*0.78);
      engine.adapt.size = Math.max(0.82, engine.adapt.size*0.94);
      engine.adapt.junkBias = clamp(engine.adapt.junkBias + 0.05, 0.08, 0.25);
      engine.adapt.decoyBias = clamp(engine.adapt.decoyBias + 0.03, 0.06, 0.22);
    }
  }

  function exitStorm(){
    engine.storm = false;
    engine.stormUntilMs = 0;
    DOC.body.classList.remove('groups-storm');
    DOC.body.classList.remove('groups-storm-urgent');
    emit('groups:storm', { on:false, durSec: 0 });
  }

  function maybeStormTick(){
    if (!engine.storm) return;
    const leftMs = engine.stormUntilMs - now();
    if (leftMs <= 0){
      exitStorm();
      // schedule next storm
      engine.nextStormAtMs = now() + (16000 + engine.rng()*12000);
      return;
    }
    if (leftMs <= 3200){
      DOC.body.classList.add('groups-storm-urgent');
    }
  }

  function tryBossSpawn(){
    if (engine.bossAlive) return;
    if (now() < engine.nextBossAtMs) return;
    // spawn boss
    engine.bossAlive = true;
    engine.bossHpMax = engine.bossHpMax|0;
    engine.bossHp = engine.bossHpMax;

    const p = randPos();
    const s = (engine.storm ? 1.25 : 1.35) * engine.sizeBase * (engine.runMode==='research'?1:engine.adapt.size);
    const el = makeTarget('boss', '👑', p.x, p.y, s);
    el.dataset.hp = String(engine.bossHp);

    layer.appendChild(el);
    emit('groups:progress', { kind:'boss_spawn' });
    emit('hha:judge', { kind:'boss', text:'BOSS!' });

    // next boss schedule
    engine.nextBossAtMs = now() + (engine.runMode==='research' ? 20000 : clamp(engine.adapt.bossEvery, 14000, 26000));
  }

  function perfectSwitchBonus(){
    if (!engine.groupClean) return;
    // PERFECT SWITCH: ได้แต้ม + ฉลอง
    engine.score += 300 + Math.min(240, engine.combo*6);
    emit('hha:judge', { kind:'good', text:'PERFECT SWITCH!' });
    emit('hha:celebrate', { kind:'mini', title:'PERFECT SWITCH!' });
  }

  function switchGroupByPower(){
    // bonus ถ้ากลุ่มนี้ “สะอาด”
    perfectSwitchBonus();

    // สลับหมู่ถัดไป
    const next = (engine.groupId % 5) + 1;
    setGroup(next, 1);
    emit('groups:progress', { kind:'group_swap' });

    // A: “Rainbow Rush” 6s หลังสลับหมู่ (คะแนน x1.5)
    engine._rushUntil = now() + 6000;

    // reset power
    engine.power = 0;
    updatePower();
  }

  function addPower(n){
    engine.power = clamp(engine.power + (n|0), 0, engine.powerThr);
    updatePower();
    if (engine.power >= engine.powerThr){
      switchGroupByPower();
    }
  }

  function addShieldIfClean(){
    // C: ถ้าเล่นสะอาดต่อเนื่อง 12s ได้ shield 1 ครั้ง
    const t = now();
    if (!engine.cleanStreakMs) engine.cleanStreakMs = t;
    if ((t - engine.cleanStreakMs) >= 12000 && engine.shield < 1){
      engine.shield = 1;
      emit('hha:judge', { kind:'good', text:'SHIELD READY!' });
      emit('hha:celebrate', { kind:'mini', title:'SHIELD READY!' });
    }
  }

  // ---------------- Hit logic ----------------
  function removeTarget(el){
    try{ root.clearTimeout(el._ttlTimer); }catch{}
    el.classList.add('hit');
    root.setTimeout(()=> el.remove(), 220);
  }

  function hitBoss(el){
    engine.hitAll++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    engine.bossHp = Math.max(0, engine.bossHp - 1);
    emit('hha:judge', { kind:'boss', text:'HIT!' });

    // แต้ม boss hit (เร้าใจ)
    const mult = (engine._rushUntil && now() < engine._rushUntil) ? 1.5 : 1.0;
    engine.score += Math.round((140 + engine.combo*2) * mult);

    if (engine.bossHp <= 0){
      engine.bossAlive = false;
      emit('hha:judge', { kind:'boss', text:'BOSS DOWN!' });
      emit('groups:progress', { kind:'boss_down' });
      emit('hha:celebrate', { kind:'goal', title:'BOSS DOWN!' });

      // รางวัล power + shield รีเฟรช
      engine.power = clamp(engine.power + 4, 0, engine.powerThr);
      engine.shield = 1;

      updatePower();
    }

    updateScore();
    removeTarget(el);
  }

  function hitTarget(el){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    const type = String(el.dataset.type||'').toLowerCase();

    if (type === 'boss'){
      hitBoss(el);
      return;
    }

    engine.hitAll++;

    // GOOD
    if (type === 'good'){
      engine.hitGood++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      // A: Rush mult
      const mult = (engine._rushUntil && now() < engine._rushUntil) ? 1.5 : 1.0;

      // แต้ม + โยงคอมโบ
      engine.score += Math.round((100 + engine.combo*3) * mult);

      // power charge
      addPower(engine.storm ? 2 : 1);

      // clean shield tracker
      addShieldIfClean();

      emit('hha:judge', { kind:'good', text: (mult>1?'RAINBOW!':'GOOD!') });
      updateScore();
      removeTarget(el);
      return;
    }

    // BAD / WRONG / DECOY / JUNK
    const badLike = (type === 'junk' || type === 'wrong' || type === 'decoy');
    if (badLike){
      // shield blocks ONLY junk (น่ารัก+ยุติธรรม)
      if (type === 'junk' && engine.shield > 0){
        engine.shield = 0;
        engine.combo = Math.max(0, engine.combo - 1);
        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        updateScore();
        removeTarget(el);
        return;
      }

      engine.misses++;
      engine.combo = 0;
      engine.groupClean = false;
      engine.cleanStreakMs = 0;

      // ลงโทษ power
      engine.power = clamp(engine.power - (type==='junk'?3:2), 0, engine.powerThr);
      updatePower();

      // “STUN” ฟีล (ไม่หลอน): สั่นเบา ๆ + storm vibe ยั่ว ๆ
      emit('hha:judge', { kind:'bad', text: (type==='junk'?'JUNK!':'WRONG!') });

      // เพิ่มความเร้าใจ: ถ้าอยู่ STORM แล้วพลาด -> storm ยืดนิดนึง (โหด+++)
      if (engine.storm){
        engine.stormUntilMs += 650;
      }

      updateScore();
      removeTarget(el);
      return;
    }
  }

  // ---------------- Spawning ----------------
  function chooseType(){
    // boss handled separately
    const junkB = (engine.runMode==='research') ? diffParams(engine.diff).junk : engine.adapt.junkBias;
    const decB  = (engine.runMode==='research') ? diffParams(engine.diff).decoy : engine.adapt.decoyBias;

    // ใน storm: bias เพิ่มอีกนิด
    const j = clamp(junkB + (engine.storm?0.05:0), 0.06, 0.30);
    const d = clamp(decB  + (engine.storm?0.03:0), 0.05, 0.25);

    const r = engine.rng();
    if (r < j) return 'junk';
    if (r < j + d) return 'decoy';

    // wrong chance
    const w = engine.storm ? 0.18 : 0.14;
    if (engine.rng() < w) return 'wrong';

    return 'good';
  }

  function chooseEmoji(type){
    if (type === 'junk') return pick(JUNK_EMOJI);
    if (type === 'decoy') return pick(DECOY_EMOJI);

    if (type === 'good'){
      return pick(GROUPS[engine.groupId].emoji);
    }

    // wrong: pick from other groups
    const other = [];
    for (let g=1; g<=5; g++){
      if (g === engine.groupId) continue;
      other.push(...GROUPS[g].emoji);
    }
    return pick(other);
  }

  function spawnOne(){
    if (!engine.running || engine.ended) return;

    // boss schedule
    tryBossSpawn();

    const tp = chooseType();
    const em = chooseEmoji(tp);

    const p = randPos();

    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;
    const size = engine.sizeBase * base.size * (engine.storm ? 0.92 : 1.0) * (tp==='junk'?0.95:1.0);

    const el = makeTarget(tp, em, p.x, p.y, size);
    layer.appendChild(el);
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;

    spawnOne();

    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;
    const sMs  = Math.max(420, base.spawnMs * (engine.storm ? 0.82 : 1.0));

    engine.spawnTimer = root.setTimeout(loopSpawn, sMs);
  }

  // ---------------- Main Tick ----------------
  function loopTick(){
    if (!engine.running || engine.ended) return;

    // storm timing
    if (!engine.storm && now() >= engine.nextStormAtMs){
      enterStorm();
    }
    if (engine.storm){
      maybeStormTick();
    }

    // adaptive (play only) — ท้าทายขึ้นตามความเก่ง
    if (engine.runMode === 'play'){
      const acc = engine.hitAll > 0 ? (engine.hitGood/engine.hitAll) : 0;
      const heat = clamp((engine.combo/18) + (acc-0.65), 0, 1);

      // เก่งขึ้น -> spawn ถี่ขึ้น + ttl สั้นลงนิด + size เล็กลงนิด (แต่ clamp ยุติธรรม)
      engine.adapt.spawnMs = clamp(820 - heat*260, 480, 880);
      engine.adapt.ttl     = clamp(1680 - heat*260, 1250, 1750);
      engine.ttlMs = engine.adapt.ttl;
      engine.adapt.size    = clamp(1.02 - heat*0.10, 0.86, 1.05);

      // bias ปรับนิด ๆ
      engine.adapt.junkBias = clamp(0.11 + heat*0.06, 0.08, 0.22);
      engine.adapt.decoyBias= clamp(0.09 + heat*0.05, 0.06, 0.20);
      engine.adapt.bossEvery= clamp(20000 - heat*6000, 14000, 22000);
    } else {
      // research fixed
      const dp = diffParams(engine.diff);
      engine.ttlMs = dp.ttl;
    }

    // time
    engine.left = Math.max(0, engine.left - 0.14);
    updateTime();

    // end
    if (engine.left <= 0){
      endGame('time');
      return;
    }

    engine.tickTimer = root.setTimeout(loopTick, 140);
  }

  function clearAllTargets(){
    const list = layer.querySelectorAll('.fg-target');
    list.forEach(el=>{
      try{ root.clearTimeout(el._ttlTimer); }catch{}
      el.remove();
    });
  }

  // ---------------- End / Summary ----------------
  function endGame(reason){
    if (engine.ended) return;
    engine.ended = true;
    engine.running = false;

    DOC.body.classList.remove('groups-storm');
    DOC.body.classList.remove('groups-storm-urgent');

    try{ root.clearTimeout(engine.spawnTimer); }catch{}
    try{ root.clearTimeout(engine.tickTimer); }catch{}
    clearAllTargets();

    const acc = engine.hitAll > 0 ? Math.round((engine.hitGood/engine.hitAll)*100) : 0;
    const grade = rankFromAcc(acc);

    // pull quest progress if available
    let q = null;
    try{ q = (NS.QuestDirector && NS.QuestDirector.getState) ? NS.QuestDirector.getState() : null; }catch{}

    const detail = {
      reason: reason || 'end',
      scoreFinal: engine.score|0,
      comboMax: engine.comboMax|0,
      misses: engine.misses|0,

      accuracyGoodPct: acc|0,
      grade,

      goalsCleared: q ? (q.goalsCleared|0) : 0,
      goalsTotal:   q ? (q.goalsTotal|0)   : 0,
      miniCleared:  q ? (q.miniCleared|0)  : 0,
      miniTotal:    q ? (q.miniTotal|0)    : 0,

      // extra metrics (เผื่อ logger)
      nHitGood: engine.hitGood|0,
      nHitAll:  engine.hitAll|0,
      powerThr: engine.powerThr|0,
      diff: engine.diff,
      runMode: engine.runMode,
      seed: engine.seed,
    };

    emit('hha:end', detail);
  }

  // ---------------- Public Boot API ----------------
  function start(runMode, cfg){
    cfg = cfg || {};
    engine.runMode = (String(runMode||'play').toLowerCase() === 'research') ? 'research' : 'play';
    engine.diff = String(cfg.diff||qs('diff','normal')).toLowerCase();
    engine.timeSec = clamp(cfg.time ?? Number(qs('time',90)), 30, 180);
    engine.seed = String(cfg.seed || qs('seed', String(Date.now())));
    engine.rng = makeRng(engine.seed);

    // reset state
    engine.running = true;
    engine.ended = false;

    engine.left = engine.timeSec;
    engine.score = 0;
    engine.combo = 0;
    engine.comboMax = 0;
    engine.misses = 0;

    engine.hitGood = 0;
    engine.hitAll = 0;

    // params
    const dp = diffParams(engine.diff);
    engine.baseSpawnMs = dp.spawnMs;
    engine.ttlMs = dp.ttl;
    engine.sizeBase = dp.size;
    engine.powerThr = dp.powerThr;

    engine.power = 0;
    engine.groupId = 1;
    engine.groupClean = true;
    engine.cleanStreakMs = now();
    engine.shield = 0;

    engine.storm = false;
    engine.nextStormAtMs = now() + (12000 + engine.rng()*11000);
    engine.stormDurSec = dp.stormDur;

    engine.bossAlive = false;
    engine.bossHpMax = dp.bossHp;
    engine.nextBossAtMs = now() + 14000;

    // adapt init
    engine.adapt.spawnMs = dp.spawnMs;
    engine.adapt.ttl = dp.ttl;
    engine.adapt.size = dp.size;
    engine.adapt.junkBias = dp.junk;
    engine.adapt.decoyBias = dp.decoy;
    engine.adapt.bossEvery = 18000;

    // view reset
    engine.vx = 0; engine.vy = 0;
    applyView();

    // notify group start (from=0) -> QuestDirector จะ reset เอง
    setGroup(1, 0);

    // push initial HUD
    updateTime();
    updatePower();
    updateScore();

    // start loops
    loopSpawn();
    loopTick();
  }

  // expose
  root.GroupsBoot = root.GroupsBoot || {};
  root.GroupsBoot.start = start;

  // init view handlers once
  setupView();

})(typeof window !== 'undefined' ? window : globalThis);
