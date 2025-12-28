/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (Hardcore+FeelGood v2: A+B+C)
1) Magnet pulls ONLY correct-group GOOD targets
2) Freeze turns bad targets into harmless "dolls" for 2s
3) Overdrive: collect ⭐ twice => 5s score x2 + stronger FX

+ ✅ HHA Standard: FLUSH before exit HUB / end game
+ ✅ Auto-flush on pagehide / beforeunload / visibilitychange(hidden)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  const layer = DOC.getElementById('fg-layer') || DOC.querySelector('.fg-layer');
  if (!layer) return;

  // ===================== HHA FLUSH (STANDARD / IIFE) =====================
  function getCloudLogger(){
    return (root.GAME_MODULES && root.GAME_MODULES.HHACloudLogger) || root.HHACloudLogger || null;
  }

  function flushLoggerNow(why){
    const L = getCloudLogger();
    if (!L || typeof L.flushNow !== 'function') return Promise.resolve();
    try{
      return Promise.race([
        L.flushNow(),
        new Promise(res => setTimeout(res, 1400))
      ]);
    }catch(_){
      return Promise.resolve();
    }
  }

  function resolveUrl(url){
    try{ return new URL(String(url||''), root.location.href).toString(); }
    catch{ return String(url||''); }
  }

  function installAutoFlush(opts){
    if (!DOC || installAutoFlush._done) return;
    installAutoFlush._done = true;

    const fire = (why)=>{
      try{
        if (opts && opts.isRunning && opts.isRunning() && opts.isEnded && !opts.isEnded()){
          try{ opts.endGame && opts.endGame(String(why||'pagehide'), { silent:true }); }catch(_){}
        }
      }catch(_){}
      flushLoggerNow(why);
    };

    root.addEventListener('pagehide', ()=>fire('pagehide'));
    root.addEventListener('beforeunload', ()=>fire('beforeunload'));
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') fire('hidden');
    });
  }
  // =================== END HHA FLUSH (STANDARD / IIFE) ====================

  // ---------- Buff chips UI ----------
  let buffWrap = DOC.querySelector('.groups-buff');
  if (!buffWrap){
    buffWrap = DOC.createElement('div');
    buffWrap.className = 'groups-buff';
    buffWrap.innerHTML = `
      <div class="chip" id="chipStorm" style="display:none">STORM 🔥</div>
      <div class="chip" id="chipMag"  style="display:none">MAGNET ⭐</div>
      <div class="chip" id="chipFrz"  style="display:none">FREEZE ❄️</div>
      <div class="chip" id="chipOver" style="display:none">OVERDRIVE x2 ⚡</div>
    `;
    DOC.body.appendChild(buffWrap);
  }
  const chipStorm = DOC.getElementById('chipStorm');
  const chipMag   = DOC.getElementById('chipMag');
  const chipFrz   = DOC.getElementById('chipFrz');
  const chipOver  = DOC.getElementById('chipOver');

  // ---------- Seeded RNG ----------
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

  // ---------- Helpers ----------
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function qs(name, def){
    try{ return (new URL(root.location.href)).searchParams.get(name) ?? def; }
    catch{ return def; }
  }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  // ---------- Simple SFX (WebAudio) ----------
  const SFX = {
    ctx:null, nextTickAt:0,
    ensure(){
      if (this.ctx) return this.ctx;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try{ this.ctx = new AC(); return this.ctx; }catch{ return null; }
    },
    beep(freq, dur, gain){
      const ctx = this.ensure();
      if (!ctx) return;
      try{
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        g.gain.value = 0.0001;
        o.connect(g); g.connect(ctx.destination);
        const t0 = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain||0.05), t0+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur||0.06));
        o.start(t0);
        o.stop(t0 + (dur||0.06) + 0.02);
      }catch{}
    },
    tickStorm(leftMs){
      const t = now();
      if (t < this.nextTickAt) return;
      const left = Math.max(0, leftMs);
      const rate = (left <= 1200) ? 90 : (left <= 2200 ? 140 : 220);
      this.nextTickAt = t + rate;
      this.beep(980, 0.045, 0.045);
    },
    good(){ this.beep(660, 0.045, 0.040); },
    bad(){ this.beep(220, 0.065, 0.055); },
    power(){ this.beep(820, 0.07, 0.050); this.beep(1040, 0.06, 0.045); }
  };

  // ---------- Content ----------
  const GROUPS = {
    1: { label:'หมู่ 1', emoji:['🥛','🥚','🍗','🐟','🥜','🫘'] },
    2: { label:'หมู่ 2', emoji:['🍚','🍞','🥔','🍠','🥖','🍜'] },
    3: { label:'หมู่ 3', emoji:['🥦','🥬','🥕','🌽','🥒','🍆'] },
    4: { label:'หมู่ 4', emoji:['🍎','🍌','🍊','🍉','🍓','🍍'] },
    5: { label:'หมู่ 5', emoji:['🥑','🫒','🧈','🥥','🧀','🌰'] }
  };

  const JUNK_EMOJI = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭'];
  const DECOY_EMOJI = ['🎭','🌀','✨','🌈','🎈'];

  // ---------- State ----------
  const engine = {
    running:false, ended:false,

    // ✅ HHA end emission guard
    _endedEmitted:false,

    runMode:'play',
    diff:'normal',
    timeSec:90,
    seed:'seed',
    rng:Math.random,

    vx:0, vy:0, dragOn:false, dragX:0, dragY:0,

    left:90,
    score:0, combo:0, comboMax:0, misses:0,
    hitGood:0, hitAll:0,

    groupId:1, groupLabel:'หมู่ 1',
    groupClean:true,
    groupStartMs:0,

    power:0, powerThr:10,

    ttlMs:1600,
    sizeBase:1.0,

    adapt:{ spawnMs:780, ttl:1600, size:1.0, junkBias:0.12, decoyBias:0.10, bossEvery:18000 },

    storm:false,
    stormUntilMs:0,
    nextStormAtMs:0,
    stormDurSec:6,

    bossAlive:false,
    bossHp:0, bossHpMax:3,
    nextBossAtMs:0,

    shield:0,
    cleanStreakMs:0,

    // Buffs
    magnetUntil:0,
    freezeUntil:0,

    // (3) Overdrive
    overCharge:0,
    overWindowUntil:0,
    overUntil:0,

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

  function scoreMult(){
    return (now() < engine.overUntil) ? 2 : 1;
  }

  function updateRank(){
    const acc = engine.hitAll > 0 ? Math.round((engine.hitGood/engine.hitAll)*100) : 0;
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
  }
  function updateScore(){
    emit('hha:score', { score: engine.score|0, combo: engine.combo|0, comboMax: engine.comboMax|0, misses: engine.misses|0 });
    updateRank();
  }
  function updateTime(){ emit('hha:time', { left: engine.left|0 }); }
  function updatePower(){ emit('groups:power', { charge: engine.power|0, threshold: engine.powerThr|0 }); }

  function setGroup(id, from){
    engine.groupId = id;
    engine.groupLabel = (GROUPS[id] ? GROUPS[id].label : ('หมู่ '+id));
    engine.groupClean = true;
    engine.groupStartMs = now();
    emit('groups:group_change', { groupId:id, label: engine.groupLabel, from: from|0 });
  }

  // ---------- VR feel view ----------
  function applyView(){
    layer.style.setProperty('--vx', engine.vx.toFixed(1)+'px');
    layer.style.setProperty('--vy', engine.vy.toFixed(1)+'px');
  }
  function setupView(){
    layer.addEventListener('pointerdown', (e)=>{
      engine.dragOn = true; engine.dragX = e.clientX; engine.dragY = e.clientY;
    }, { passive:true });
    root.addEventListener('pointermove', (e)=>{
      if (!engine.dragOn) return;
      const dx = e.clientX - engine.dragX;
      const dy = e.clientY - engine.dragY;
      engine.dragX = e.clientX; engine.dragY = e.clientY;
      engine.vx = clamp(engine.vx + dx*0.22, -90, 90);
      engine.vy = clamp(engine.vy + dy*0.22, -90, 90);
      applyView();
    }, { passive:true });
    root.addEventListener('pointerup', ()=>{ engine.dragOn=false; }, { passive:true });

    root.addEventListener('deviceorientation', (ev)=>{
      const gx = Number(ev.gamma)||0;
      const gy = Number(ev.beta)||0;
      engine.vx = clamp(engine.vx + gx*0.06, -90, 90);
      engine.vy = clamp(engine.vy + (gy-20)*0.02, -90, 90);
      applyView();
    }, { passive:true });
  }

  // ---------- Spawn rect ----------
  function safeSpawnRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    const top = 150, bot = 170, side = 16;
    return { x0:side, x1:W-side, y0:top, y1:H-bot, W, H };
  }
  function randPos(){
    const r = safeSpawnRect();
    const x = r.x0 + engine.rng()*(r.x1 - r.x0);
    const y = r.y0 + engine.rng()*(r.y1 - r.y0);
    return { x, y };
  }
  function pick(arr){ return (!arr||!arr.length) ? '' : arr[(engine.rng()*arr.length)|0]; }

  // ---------- DOM target helpers ----------
  function setXY(el, x, y){
    el.style.setProperty('--x', x.toFixed(1)+'px');
    el.style.setProperty('--y', y.toFixed(1)+'px');
    el.dataset._x = String(x);
    el.dataset._y = String(y);
  }
  function getXY(el){
    const x = Number(el.dataset._x);
    const y = Number(el.dataset._y);
    if (Number.isFinite(x) && Number.isFinite(y)) return {x,y};
    const sx = (el.style.getPropertyValue('--x')||'').trim().replace('px','');
    const sy = (el.style.getPropertyValue('--y')||'').trim().replace('px','');
    return { x:Number(sx)||0, y:Number(sy)||0 };
  }

  function markFreezeDoll(el, ms){
    if (!el) return;
    el.classList.add('fg-freeze-doll');
    el.dataset.dollUntil = String(now() + (ms|0));
  }
  function isFreezeDoll(el){
    const t = Number(el?.dataset?.dollUntil);
    return Number.isFinite(t) && now() < t;
  }
  function cleanupDolls(){
    const list = layer.querySelectorAll('.fg-freeze-doll');
    list.forEach(el=>{
      const t = Number(el.dataset.dollUntil);
      if (!Number.isFinite(t) || now() >= t){
        el.classList.remove('fg-freeze-doll');
        el.dataset.dollUntil = '';
      }
    });
  }

  function makeTarget(type, emoji, x, y, s){
    const el = DOC.createElement('div');
    el.className = 'fg-target spawn';
    el.dataset.emoji = emoji || '✨';
    el.dataset.type = type;

    // ✅ (1) tag groupId on GOOD targets
    if (type === 'good') el.dataset.groupId = String(engine.groupId);

    setXY(el, x, y);
    el.style.setProperty('--s', s.toFixed(3));

    if (type === 'good') el.classList.add('fg-good');
    else if (type === 'wrong') el.classList.add('fg-wrong');
    else if (type === 'junk') el.classList.add('fg-junk');
    else if (type === 'decoy') el.classList.add('fg-decoy');
    else if (type === 'boss') el.classList.add('fg-boss');
    else if (type === 'star'){ el.classList.add('fg-powerup','fg-star'); }
    else if (type === 'ice'){ el.classList.add('fg-powerup','fg-ice'); }

    // ✅ (2) ถ้า freeze กำลังทำงาน: bad ใหม่เกิดมาเป็น doll 2s
    if (now() < engine.freezeUntil && (type==='junk' || type==='decoy' || type==='wrong')){
      markFreezeDoll(el, 2000);
    }

    const ttlBase = engine.ttlMs;
    const ttl = engine.storm ? Math.max(850, ttlBase*0.85) : ttlBase;

    el._ttlTimer = root.setTimeout(()=>{
      if (!el.isConnected) return;

      // expire miss: เฉพาะ GOOD ของ “หมู่ปัจจุบันตอนเกิด” เท่านั้น
      if (type === 'good'){
        engine.misses++; engine.combo = 0; engine.groupClean = false;
        emit('hha:judge', { kind:'warn', text:'MISS!' });
        updateScore();
      }
      el.classList.add('out');
      root.setTimeout(()=> el.remove(), 220);
    }, ttl);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el);
    }, { passive:false });

    return el;
  }

  function removeTarget(el){
    try{ root.clearTimeout(el._ttlTimer); }catch{}
    el.classList.add('hit');
    root.setTimeout(()=> el.remove(), 220);
  }

  // ---------- Storm ----------
  function enterStorm(){
    engine.storm = true;
    engine.stormUntilMs = now() + engine.stormDurSec*1000;
    DOC.body.classList.add('groups-storm');
    chipStorm.style.display = '';
    emit('groups:storm', { on:true, durSec: engine.stormDurSec|0 });

    if (engine.runMode === 'play'){
      engine.adapt.spawnMs = Math.max(420, engine.adapt.spawnMs*0.78);
      engine.adapt.size = Math.max(0.82, engine.adapt.size*0.94);
      engine.adapt.junkBias = clamp(engine.adapt.junkBias + 0.05, 0.08, 0.25);
      engine.adapt.decoyBias= clamp(engine.adapt.decoyBias + 0.03, 0.06, 0.22);
    }
  }
  function exitStorm(){
    engine.storm = false;
    engine.stormUntilMs = 0;
    DOC.body.classList.remove('groups-storm');
    DOC.body.classList.remove('groups-storm-urgent');
    chipStorm.style.display = 'none';
    emit('groups:storm', { on:false, durSec: 0 });
  }
  function maybeStormTick(){
    if (!engine.storm) return;
    const leftMs = engine.stormUntilMs - now();
    if (leftMs <= 0){ exitStorm(); engine.nextStormAtMs = now() + (16000 + engine.rng()*12000); return; }
    if (leftMs <= 3200){
      DOC.body.classList.add('groups-storm-urgent');
      SFX.tickStorm(leftMs);
    }
  }

  // ---------- Boss ----------
  function tryBossSpawn(){
    if (engine.bossAlive) return;
    if (now() < engine.nextBossAtMs) return;

    engine.bossAlive = true;
    engine.bossHp = engine.bossHpMax;

    const p = randPos();
    const s = (engine.storm ? 1.25 : 1.35) * engine.sizeBase * ((engine.runMode==='research')?1:engine.adapt.size);
    const el = makeTarget('boss','👑',p.x,p.y,s);
    el.dataset.hp = String(engine.bossHp);

    layer.appendChild(el);
    emit('groups:progress',{kind:'boss_spawn'});
    emit('hha:judge',{kind:'boss',text:'BOSS!'});
    engine.nextBossAtMs = now() + (engine.runMode==='research' ? 20000 : clamp(engine.adapt.bossEvery, 14000, 26000));
  }

  // ---------- Feel-good bonuses ----------
  function perfectSwitchBonus(){
    if (!engine.groupClean) return;
    const mult = scoreMult();
    engine.score += (300 + Math.min(240, engine.combo*6)) * mult;
    emit('hha:judge', { kind:'good', text:'PERFECT SWITCH!' });
    emit('hha:celebrate', { kind:'mini', title:'PERFECT SWITCH!' });
  }

  function switchGroupByPower(){
    perfectSwitchBonus();
    const next = (engine.groupId % 5) + 1;
    setGroup(next, 1);
    emit('groups:progress', { kind:'group_swap' });

    engine._rushUntil = now() + 6000; // rainbow rush
    engine.power = 0;
    updatePower();
  }

  function addPower(n){
    engine.power = clamp(engine.power + (n|0), 0, engine.powerThr);
    updatePower();
    if (engine.power >= engine.powerThr) switchGroupByPower();
  }

  function addShieldIfClean(){
    const t = now();
    if (!engine.cleanStreakMs) engine.cleanStreakMs = t;
    if ((t - engine.cleanStreakMs) >= 12000 && engine.shield < 1){
      engine.shield = 1;
      emit('hha:judge', { kind:'good', text:'SHIELD READY!' });
      emit('hha:celebrate', { kind:'mini', title:'SHIELD READY!' });
    }
  }

  // ---------- (3) Overdrive ----------
  function activateOverdrive(){
    engine.overUntil = now() + 5000;
    DOC.body.classList.add('groups-overdrive');
    chipOver.style.display = '';
    SFX.power();
    emit('hha:celebrate', { kind:'goal', title:'OVERDRIVE x2!' });

    root.setTimeout(()=>{
      if (now() >= engine.overUntil){
        DOC.body.classList.remove('groups-overdrive');
        chipOver.style.display = 'none';
      }
    }, 5100);
  }

  function onStarCollected(){
    const t = now();
    if (t > engine.overWindowUntil){
      engine.overCharge = 0;
      engine.overWindowUntil = t + 8000;
    }
    engine.overCharge++;
    if (engine.overCharge >= 2){
      engine.overCharge = 0;
      engine.overWindowUntil = 0;
      activateOverdrive();
    }
  }

  // ---------- Powerups ----------
  function activateMagnet(){
    engine.magnetUntil = now() + 6000;
    DOC.body.classList.add('groups-magnet');
    chipMag.style.display = '';
    SFX.power();
    emit('hha:celebrate', { kind:'mini', title:'MAGNET ⭐' });
    root.setTimeout(()=>{
      if (now() >= engine.magnetUntil){
        DOC.body.classList.remove('groups-magnet');
        chipMag.style.display = 'none';
      }
    }, 6100);
  }

  function activateFreeze(){
    engine.freezeUntil = now() + 4500;
    DOC.body.classList.add('groups-freeze');
    chipFrz.style.display = '';
    SFX.power();
    emit('hha:celebrate', { kind:'mini', title:'FREEZE ❄️' });

    // ✅ (2) แปลง bad ที่อยู่บนจอเป็นตุ๊กตานิ่ง 2 วิ
    const list = layer.querySelectorAll('.fg-target');
    list.forEach(el=>{
      const tp = String(el.dataset.type||'').toLowerCase();
      if (tp==='junk' || tp==='decoy' || tp==='wrong'){
        markFreezeDoll(el, 2000);
      }
    });

    root.setTimeout(()=>{
      if (now() >= engine.freezeUntil){
        DOC.body.classList.remove('groups-freeze');
        chipFrz.style.display = 'none';
      }
    }, 4600);
  }

  // ✅ (1) Magnet pull เฉพาะ good ของหมู่ปัจจุบัน
  function magnetPullTick(){
    if (now() >= engine.magnetUntil) return;

    const r = safeSpawnRect();
    const cx = r.W * 0.5;
    const cy = (r.y0 + r.y1) * 0.5;

    const list = layer.querySelectorAll('.fg-target.fg-good');
    list.forEach(el=>{
      const gid = Number(el.dataset.groupId)||0;
      if (gid !== engine.groupId) return;

      const p = getXY(el);
      const nx = p.x + (cx - p.x) * 0.040;
      const ny = p.y + (cy - p.y) * 0.040;
      setXY(el, nx, ny);
    });
  }

  // ---------- Hit logic ----------
  function hitBoss(el){
    engine.hitAll++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    engine.bossHp = Math.max(0, engine.bossHp - 1);
    emit('hha:judge', { kind:'boss', text:'HIT!' });

    const mult = scoreMult();
    const rush = (engine._rushUntil && now() < engine._rushUntil) ? 1.5 : 1.0;
    engine.score += Math.round((140 + engine.combo*2) * rush * mult);

    if (engine.bossHp <= 0){
      engine.bossAlive = false;
      emit('hha:judge', { kind:'boss', text:'BOSS DOWN!' });
      emit('groups:progress', { kind:'boss_down' });
      emit('hha:celebrate', { kind:'goal', title:'BOSS DOWN!' });

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

    let type = String(el.dataset.type||'').toLowerCase();

    // powerups
    if (type === 'star'){
      engine.hitAll++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      const mult = scoreMult();
      engine.score += 120 * mult;

      emit('hha:judge', { kind:'good', text:'MAGNET!', meta:{ noQuest:true } });
      activateMagnet();
      onStarCollected();

      updateScore();
      removeTarget(el);
      return;
    }

    if (type === 'ice'){
      engine.hitAll++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      const mult = scoreMult();
      engine.score += 120 * mult;

      emit('hha:judge', { kind:'good', text:'FREEZE!', meta:{ noQuest:true } });
      activateFreeze();

      updateScore();
      removeTarget(el);
      return;
    }

    if (type === 'boss'){ hitBoss(el); return; }

    // ✅ (1) ถ้าเป็น good แต่ groupId ไม่ตรง => WRONG
    if (type === 'good'){
      const gid = Number(el.dataset.groupId)||0;
      if (gid && gid !== engine.groupId){
        type = 'wrong';
      }
    }

    engine.hitAll++;

    // GOOD
    if (type === 'good'){
      engine.hitGood++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      const mult = scoreMult();
      const rush = (engine._rushUntil && now() < engine._rushUntil) ? 1.5 : 1.0;
      engine.score += Math.round((100 + engine.combo*3) * rush * mult);

      addPower(engine.storm ? 2 : 1);
      addShieldIfClean();

      emit('hha:judge', { kind:'good', text: (mult>1?'OVER x2!':'GOOD!') });
      SFX.good();
      updateScore();
      removeTarget(el);
      return;
    }

    // BAD-like
    const badLike = (type === 'junk' || type === 'wrong' || type === 'decoy');

    if (badLike){
      // ✅ (2) Freeze Doll => ยิงทิ้งได้ ไม่มีโทษ
      if (isFreezeDoll(el) || (now() < engine.freezeUntil && (type==='junk' || type==='decoy' || type==='wrong'))){
        engine.combo = clamp(engine.combo + 1, 0, 9999);
        engine.comboMax = Math.max(engine.comboMax, engine.combo);

        const mult = scoreMult();
        engine.score += 40 * mult;

        emit('hha:judge', { kind:'good', text:'POOF!' });
        updateScore();
        removeTarget(el);
        return;
      }

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

      engine.power = clamp(engine.power - (type==='junk'?3:2), 0, engine.powerThr);
      updatePower();

      emit('hha:judge', { kind:'bad', text: (type==='junk'?'JUNK!':'WRONG!') });
      SFX.bad();

      if (engine.storm){ engine.stormUntilMs += 650; }
      updateScore();
      removeTarget(el);
      return;
    }
  }

  // ---------- Spawn choose ----------
  function chooseType(){
    const freezing = now() < engine.freezeUntil;

    const baseJ = (engine.runMode==='research') ? diffParams(engine.diff).junk : engine.adapt.junkBias;
    const baseD = (engine.runMode==='research') ? diffParams(engine.diff).decoy : engine.adapt.decoyBias;

    let j = clamp(baseJ + (engine.storm?0.05:0), 0.06, 0.30);
    let d = clamp(baseD + (engine.storm?0.03:0), 0.05, 0.25);

    if (freezing){
      j = Math.max(0.03, j*0.35);
      d = Math.max(0.03, d*0.35);
    }

    const pu = engine.storm ? 0.018 : 0.012;
    if (engine.rng() < pu){
      return (engine.rng() < 0.5) ? 'star' : 'ice';
    }

    const r = engine.rng();
    if (r < j) return 'junk';
    if (r < j + d) return 'decoy';

    const w = engine.storm ? 0.18 : 0.14;
    if (engine.rng() < w) return 'wrong';

    return 'good';
  }

  function chooseEmoji(type){
    if (type === 'junk') return pick(JUNK_EMOJI);
    if (type === 'decoy') return pick(DECOY_EMOJI);
    if (type === 'star') return '⭐';
    if (type === 'ice')  return '❄️';
    if (type === 'good') return pick(GROUPS[engine.groupId].emoji);

    const other = [];
    for (let g=1; g<=5; g++){
      if (g === engine.groupId) continue;
      other.push(...GROUPS[g].emoji);
    }
    return pick(other);
  }

  function spawnOne(){
    if (!engine.running || engine.ended) return;
    tryBossSpawn();

    const tp = chooseType();
    const em = chooseEmoji(tp);
    const p = randPos();

    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;
    const stormScale = engine.storm ? 0.92 : 1.0;

    let size = engine.sizeBase * base.size * stormScale;
    if (tp === 'junk') size *= 0.95;
    if (tp === 'star' || tp === 'ice') size *= 0.98;

    const el = makeTarget(tp, em, p.x, p.y, size);
    layer.appendChild(el);
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;

    spawnOne();

    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;
    let sMs = Math.max(420, base.spawnMs * (engine.storm ? 0.82 : 1.0));
    if (now() < engine.freezeUntil) sMs = sMs * 1.22;

    engine.spawnTimer = root.setTimeout(loopSpawn, sMs);
  }

  // ---------- Tick ----------
  function loopTick(){
    if (!engine.running || engine.ended) return;

    if (!engine.storm && now() >= engine.nextStormAtMs) enterStorm();
    if (engine.storm) maybeStormTick();

    magnetPullTick();
    cleanupDolls();

    // adaptive (play only)
    if (engine.runMode === 'play'){
      const acc = engine.hitAll > 0 ? (engine.hitGood/engine.hitAll) : 0;
      const heat = clamp((engine.combo/18) + (acc-0.65), 0, 1);

      engine.adapt.spawnMs = clamp(820 - heat*260, 480, 880);
      engine.adapt.ttl     = clamp(1680 - heat*260, 1250, 1750);
      engine.ttlMs = engine.adapt.ttl;
      engine.adapt.size    = clamp(1.02 - heat*0.10, 0.86, 1.05);

      engine.adapt.junkBias = clamp(0.11 + heat*0.06, 0.08, 0.22);
      engine.adapt.decoyBias= clamp(0.09 + heat*0.05, 0.06, 0.20);
      engine.adapt.bossEvery= clamp(20000 - heat*6000, 14000, 22000);
    } else {
      engine.ttlMs = diffParams(engine.diff).ttl;
    }

    engine.left = Math.max(0, engine.left - 0.14);
    updateTime();

    if (engine.left <= 0){ endGame('time'); return; }

    engine.tickTimer = root.setTimeout(loopTick, 140);
  }

  function clearAllTargets(){
    const list = layer.querySelectorAll('.fg-target');
    list.forEach(el=>{
      try{ root.clearTimeout(el._ttlTimer); }catch{}
      el.remove();
    });
  }

  function endGame(reason, opts){
    if (engine.ended) return;
    engine.ended = true;
    engine.running = false;

    DOC.body.classList.remove('groups-storm','groups-storm-urgent','groups-magnet','groups-freeze','groups-overdrive');
    chipStorm.style.display='none'; chipMag.style.display='none'; chipFrz.style.display='none'; chipOver.style.display='none';

    try{ root.clearTimeout(engine.spawnTimer); }catch{}
    try{ root.clearTimeout(engine.tickTimer); }catch{}
    clearAllTargets();

    const acc = engine.hitAll > 0 ? Math.round((engine.hitGood/engine.hitAll)*100) : 0;
    const grade = rankFromAcc(acc);

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
      nHitGood: engine.hitGood|0,
      nHitAll:  engine.hitAll|0,
      powerThr: engine.powerThr|0,
      diff: engine.diff,
      runMode: engine.runMode,
      seed: engine.seed,
    };

    // ✅ emit end only once
    if (!engine._endedEmitted){
      engine._endedEmitted = true;
      emit('hha:end', detail);
    }

    // ✅ FLUSH when endGame happens (even if silent)
    flushLoggerNow('end:' + String(detail.reason||'end'));
  }

  // ---------- Public: goHub (flush ก่อนออก HUB) ----------
  function goHub(){
    const hub = qs('hub', './hub.html');
    try{
      if (engine.running && !engine.ended) endGame('go_hub', { silent:true });
    }catch(_){}
    flushLoggerNow('go_hub').finally(()=>{
      root.location.assign(resolveUrl(hub));
    });
  }

  // ---------- Public start ----------
  function start(runMode, cfg){
    cfg = cfg || {};
    engine.runMode = (String(runMode||'play').toLowerCase() === 'research') ? 'research' : 'play';
    engine.diff = String(cfg.diff||qs('diff','normal')).toLowerCase();
    engine.timeSec = clamp(cfg.time ?? Number(qs('time',90)), 30, 180);
    engine.seed = String(cfg.seed || qs('seed', String(Date.now())));
    engine.rng = makeRng(engine.seed);

    SFX.ensure();

    const dp = diffParams(engine.diff);

    engine.running = true;
    engine.ended = false;
    engine._endedEmitted = false;

    engine.left = engine.timeSec;
    engine.score = 0; engine.combo = 0; engine.comboMax = 0; engine.misses = 0;
    engine.hitGood = 0; engine.hitAll = 0;

    engine.powerThr = dp.powerThr;
    engine.power = 0;

    engine.sizeBase = dp.size;
    engine.ttlMs = dp.ttl;

    engine.storm = false;
    engine.stormDurSec = dp.stormDur;
    engine.nextStormAtMs = now() + (12000 + engine.rng()*11000);

    engine.bossAlive = false;
    engine.bossHpMax = dp.bossHp;
    engine.nextBossAtMs = now() + 14000;

    engine.groupId = 1;
    engine.groupClean = true;
    engine.cleanStreakMs = now();
    engine.shield = 0;

    engine.magnetUntil = 0;
    engine.freezeUntil = 0;

    engine.overCharge = 0;
    engine.overWindowUntil = 0;
    engine.overUntil = 0;

    engine.adapt.spawnMs = dp.spawnMs;
    engine.adapt.ttl = dp.ttl;
    engine.adapt.size = dp.size;
    engine.adapt.junkBias = dp.junk;
    engine.adapt.decoyBias = dp.decoy;
    engine.adapt.bossEvery = 18000;

    engine.vx = 0; engine.vy = 0;
    applyView();

    setGroup(1, 0);

    updateTime();
    updatePower();
    updateScore();

    loopSpawn();
    loopTick();
  }

  // expose
  root.GroupsBoot = root.GroupsBoot || {};
  root.GroupsBoot.start = start;
  root.GroupsBoot.goHub = goHub;

  setupView();

  // ✅ auto-flush + auto-finalize if user leaves mid-game
  installAutoFlush({
    isRunning: ()=>engine && engine.running,
    isEnded:   ()=>engine && engine.ended,
    endGame:   endGame
  });

})(typeof window !== 'undefined' ? window : globalThis);
