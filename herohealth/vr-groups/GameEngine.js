/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (CONNECTED to groups-quests.js + audio.js)
✅ B++ SafeRect DOM + view-compensation
✅ Targets have type classes (fg-good/fg-junk/fg-wrong/fg-decoy/fg-star/fg-ice/fg-boss)
✅ Powerups:
   ⭐ Overdrive 7s (x2 score) + Shield 1
   ❄️ Freeze 6s (spawn slower + ttl longer) + body class
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{} };
  const emitProgress = (detail)=> emit('groups:progress', detail||{});

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
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function styleNorm(s){
    s = String(s||'mix').toLowerCase();
    return (s==='hard'||s==='feel'||s==='mix') ? s : 'mix';
  }
  function qs(){
    try{ return new URLSearchParams((root.location && root.location.search) ? root.location.search : ''); }
    catch{ return new URLSearchParams(''); }
  }
  function parsePx(val){
    val = String(val||'').trim();
    if (!val) return 0;
    const m = val.match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  // ---------- Content ----------
  const SONG = {
    1:'หมู่ 1 กินเนื้อ นม ไข่ ถั่วเมล็ดช่วยให้เติบโตแข็งขัน 💪',
    2:'หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล จะให้พลัง ⚡',
    3:'หมู่ 3 กินผักต่างๆ สารอาหารมากมายกินเป็นอาจิณ 🥦',
    4:'หมู่ 4 กินผลไม้ สีเขียวเหลืองบ้างมีวิตามิน 🍎',
    5:'หมู่ 5 อย่าได้ลืมกิน ไขมันทั้งสิ้น อบอุ่นร่างกาย 🥑'
  };

  const GROUPS = {
    1: { label:'หมู่ 1', emoji:['🥛','🥚','🍗','🐟','🥜','🫘'] },
    2: { label:'หมู่ 2', emoji:['🍚','🍞','🥔','🍠','🥖','🍜'] },
    3: { label:'หมู่ 3', emoji:['🥦','🥬','🥕','🌽','🥒','🍆'] },
    4: { label:'หมู่ 4', emoji:['🍎','🍌','🍊','🍉','🍓','🍍'] },
    5: { label:'หมู่ 5', emoji:['🥑','🫒','🧈','🥥','🧀','🌰'] }
  };

  const JUNK_EMOJI  = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭'];
  const DECOY_EMOJI = ['🎭','🌀','✨','🌈','🎈'];

  function goalNeed(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy') return 6;
    if (diff==='hard') return 10;
    return 8;
  }

  function diffParams(diff){
    diff = String(diff||'normal').toLowerCase();
    const thr = goalNeed(diff);
    if (diff === 'easy') return { spawnMs:900, ttl:1750, size:1.05, powerThr:thr, junk:0.10, decoy:0.08, stormDur:6, bossHp:3 };
    if (diff === 'hard') return { spawnMs:680, ttl:1450, size:0.92, powerThr:thr, junk:0.16, decoy:0.12, stormDur:7, bossHp:4 };
    return                 { spawnMs:780, ttl:1600, size:1.00, powerThr:thr, junk:0.12, decoy:0.10, stormDur:6, bossHp:3 };
  }

  function rankFromAcc(acc){
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  // ---------- State ----------
  const engine = {
    layerEl:null,
    running:false,
    ended:false,

    runMode:'play',
    diff:'normal',
    style:'mix',
    timeSec:90,
    seed:'seed',
    rng:Math.random,

    // VR feel
    vx:0, vy:0, dragOn:false, dragX:0, dragY:0,

    left:90,
    score:0,
    combo:0,
    comboMax:0,
    misses:0,
    hitGood:0,
    hitAll:0,

    groupId:1,
    groupClean:true,

    // fever/shield
    fever:0,
    shield:0,
    feverTickLast:0,

    // power
    power:0,
    powerThr:8,

    // spawn/ttl
    ttlMs:1600,
    sizeBase:1.0,
    adapt:{ spawnMs:780, ttl:1600, size:1.0, junkBias:0.12, decoyBias:0.10, bossEvery:18000 },

    // storm
    storm:false,
    stormUntilMs:0,
    nextStormAtMs:0,
    stormDurSec:6,
    stormPattern:'wave',
    stormSpawnIdx:0,

    // boss
    bossAlive:false,
    bossHp:0,
    bossHpMax:3,
    nextBossAtMs:0,

    // buffs
    freezeUntil:0,
    overUntil:0,

    // timers
    spawnTimer:0,
    tickTimer:0,

    // quest instance
    quest:null,
    _questBound:false,

    // B++ cache rect
    _rectCacheAt:0,
    _rectCache:null
  };

  function scoreMult(){ return (now() < engine.overUntil) ? 2 : 1; }

  function emitCoach(text, mood){ emit('hha:coach', { text: String(text||''), mood: mood||'neutral' }); }
  function emitFever(){ emit('hha:fever', { feverPct: Math.round(engine.fever)|0, shield: engine.shield|0 }); }

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

  // ---------- Quest bridge ----------
  function ensureQuest(){
    if (engine.quest) return engine.quest;
    const maker = NS.createGroupsQuest;
    if (typeof maker !== 'function') return null;

    engine.quest = maker({
      runMode: engine.runMode,
      diff: engine.diff,
      style: engine.style,
      seed: engine.seed
    });

    if (!engine._questBound && engine.quest && typeof engine.quest.onProgress === 'function'){
      engine._questBound = true;
      root.addEventListener('groups:progress', (ev)=>{
        try{ engine.quest && engine.quest.onProgress(ev); }catch{}
      }, { passive:true });
    }
    return engine.quest;
  }
  function questStart(){
    const q = ensureQuest();
    try{ q && q.start && q.start(); }catch{}
    try{ q && q.pushUpdate && q.pushUpdate(); }catch{}
  }
  function questStop(){
    try{ engine.quest && engine.quest.stop && engine.quest.stop(); }catch{}
  }

  // ---------- VR feel ----------
  function applyView(){
    const layer = engine.layerEl;
    if (!layer) return;
    layer.style.setProperty('--vx', engine.vx.toFixed(1)+'px');
    layer.style.setProperty('--vy', engine.vy.toFixed(1)+'px');
  }
  function setupView(){
    let bound = false;
    function bind(){
      if (bound) return;
      const layer = engine.layerEl;
      if (!layer) return;
      bound = true;

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

    const it = setInterval(()=>{
      bind();
      if (bound) clearInterval(it);
    }, 80);
  }

  // ---------- SafeRect DOM (B++) ----------
  function getUISafeInsets(){
    let sal=0, sar=0, sat=0, sab=0;
    try{
      const cs = getComputedStyle(DOC.documentElement);
      sal = parsePx(cs.getPropertyValue('--sal'));
      sar = parsePx(cs.getPropertyValue('--sar'));
      sat = parsePx(cs.getPropertyValue('--sat'));
      sab = parsePx(cs.getPropertyValue('--sab'));
    }catch{}
    return { sal, sar, sat, sab };
  }
  function rectOf(sel){
    try{
      const el = DOC.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r || !isFinite(r.left) || r.width <= 0 || r.height <= 0) return null;
      return { l:r.left, t:r.top, r:r.right, b:r.bottom, w:r.width, h:r.height };
    }catch{ return null; }
  }
  function clampRectToViewport(rc, W, H){
    if (!rc) return null;
    return {
      l: clamp(rc.l, 0, W),
      t: clamp(rc.t, 0, H),
      r: clamp(rc.r, 0, W),
      b: clamp(rc.b, 0, H),
      w: clamp(rc.w, 0, W),
      h: clamp(rc.h, 0, H)
    };
  }
  function pointInRect(px, py, rc){
    return rc && px >= rc.l && px <= rc.r && py >= rc.t && py <= rc.b;
  }

  function buildSafeRectAndExcludes(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    const ins = getUISafeInsets();

    let sidePad = 14;
    let topPad  = 10;
    let botPad  = 12;

    const rHud   = clampRectToViewport(rectOf('.hud'), W, H);
    const rCT    = clampRectToViewport(rectOf('.centerTop'), W, H);
    const rQuest = clampRectToViewport(rectOf('.questTop'), W, H);
    const rPower = clampRectToViewport(rectOf('.powerWrap'), W, H);
    const rCoach = clampRectToViewport(rectOf('.coachWrap'), W, H);

    let topClear = 0;
    if (rHud)   topClear = Math.max(topClear, rHud.b);
    if (rCT)    topClear = Math.max(topClear, rCT.b);
    if (rQuest) topClear = Math.max(topClear, rQuest.b);
    if (topClear <= 0) topClear = 160 + ins.sat;
    topClear += (topPad + 6);

    let bottomClear = H;
    if (rPower) bottomClear = Math.min(bottomClear, rPower.t);
    if (bottomClear >= H) bottomClear = H - (190 + ins.sab);
    bottomClear -= (botPad + 6);

    let x0 = sidePad + ins.sal;
    let x1 = W - sidePad - ins.sar;
    let y0 = Math.max(18 + ins.sat, topClear);
    let y1 = Math.min(H - (18 + ins.sab), bottomClear);

    const minW = 220, minH = 220;
    if ((x1-x0) < minW){
      const mid = (x0+x1)*0.5;
      x0 = mid - minW*0.5;
      x1 = mid + minW*0.5;
      x0 = clamp(x0, 8+ins.sal, W-8-ins.sar);
      x1 = clamp(x1, 8+ins.sal, W-8-ins.sar);
    }
    if ((y1-y0) < minH){
      const mid = (y0+y1)*0.5;
      y0 = mid - minH*0.5;
      y1 = mid + minH*0.5;
      y0 = clamp(y0, 18+ins.sat, H-18-ins.sab);
      y1 = clamp(y1, 18+ins.sat, H-18-ins.sab);
    }

    const excludes = [];
    if (rCoach){
      const pad = 10;
      excludes.push({
        l: clamp(rCoach.l - pad, 0, W),
        t: clamp(rCoach.t - pad, 0, H),
        r: clamp(rCoach.r + pad, 0, W),
        b: clamp(rCoach.b + pad, 0, H),
      });
    }

    return { W, H, x0, x1, y0, y1, excludes };
  }

  function safeSpawnRect(){
    const t = now();
    if (engine._rectCache && (t - engine._rectCacheAt) < 180){
      return engine._rectCache;
    }
    const out = buildSafeRectAndExcludes();
    engine._rectCacheAt = t;
    engine._rectCache = out;
    return out;
  }

  function isBlocked(screenX, screenY, excludes){
    if (!excludes || !excludes.length) return false;
    for (const rc of excludes){
      if (pointInRect(screenX, screenY, rc)) return true;
    }
    return false;
  }

  function randPos(){
    const r = safeSpawnRect();

    const x0w = r.x0 - engine.vx;
    const x1w = r.x1 - engine.vx;
    const y0w = r.y0 - engine.vy;
    const y1w = r.y1 - engine.vy;

    let x=0, y=0;
    for (let i=0;i<10;i++){
      x = x0w + engine.rng()*(x1w - x0w);
      y = y0w + engine.rng()*(y1w - y0w);
      const sx = x + engine.vx;
      const sy = y + engine.vy;
      if (!isBlocked(sx, sy, r.excludes)) return { x, y };
    }
    return { x, y };
  }

  function stormPos(){
    const r = safeSpawnRect();

    const x0w = r.x0 - engine.vx;
    const x1w = r.x1 - engine.vx;
    const y0w = r.y0 - engine.vy;
    const y1w = r.y1 - engine.vy;

    const Ww = (x1w - x0w);
    const Hw = (y1w - y0w);

    const cx = x0w + Ww * 0.5;
    const cy = y0w + Hw * 0.5;
    const idx = (engine.stormSpawnIdx++);

    const jx = (engine.rng()-0.5) * 26;
    const jy = (engine.rng()-0.5) * 22;

    let x=0, y=0;
    if (engine.stormPattern === 'wave'){
      const t = (idx % 28) / 28;
      x = x0w + t*Ww;
      y = cy + Math.sin((idx*0.55)) * (Hw*0.22);
      x = clamp(x + jx, x0w, x1w);
      y = clamp(y + jy, y0w, y1w);
    } else if (engine.stormPattern === 'spiral'){
      const a = idx * 0.62;
      const rad = clamp(28 + idx*5.0, 28, Math.min(Ww, Hw)*0.40);
      x = cx + Math.cos(a)*rad;
      y = cy + Math.sin(a)*rad;
      x = clamp(x + jx, x0w, x1w);
      y = clamp(y + jy, y0w, y1w);
    } else {
      const corners = [
        {x:x0w+26, y:y0w+26},
        {x:x1w-26, y:y0w+26},
        {x:x0w+26, y:y1w-26},
        {x:x1w-26, y:y1w-26},
        {x:cx,     y:y0w+22},
        {x:cx,     y:y1w-22},
      ];
      const c = corners[(engine.rng()*corners.length)|0];
      x = c.x + (engine.rng()-0.5)*120;
      y = c.y + (engine.rng()-0.5)*110;
      x = clamp(x + jx, x0w, x1w);
      y = clamp(y + jy, y0w, y1w);
    }

    const sx = x + engine.vx;
    const sy = y + engine.vy;
    if (isBlocked(sx, sy, r.excludes)){
      x = clamp(x - 140, x0w, x1w);
      y = clamp(y - 90,  y0w, y1w);
    }
    return { x, y };
  }

  // ---------- DOM target ----------
  function setXY(el, x, y){
    el.style.setProperty('--x', x.toFixed(1)+'px');
    el.style.setProperty('--y', y.toFixed(1)+'px');
    el.dataset._x = String(x);
    el.dataset._y = String(y);
  }
  function removeTarget(el){
    if (!el) return;
    try{ root.clearTimeout(el._ttlTimer); }catch{}
    el.classList.add('hit');
    root.setTimeout(()=> el.remove(), 220);
  }

  function typeClass(tp){
    tp = String(tp||'').toLowerCase();
    if (tp === 'good') return 'fg-good';
    if (tp === 'wrong') return 'fg-wrong';
    if (tp === 'decoy') return 'fg-decoy';
    if (tp === 'junk') return 'fg-junk';
    if (tp === 'star') return 'fg-star';
    if (tp === 'ice') return 'fg-ice';
    if (tp === 'boss') return 'fg-boss';
    return '';
  }

  function makeTarget(type, emoji, x, y, s){
    const layer = engine.layerEl;
    if (!layer) return null;

    const el = DOC.createElement('div');
    el.className = 'fg-target spawn';
    el.dataset.emoji = emoji || '✨';
    el.dataset.type = type;

    const cls = typeClass(type);
    if (cls) el.classList.add(cls);

    if (type === 'good') el.dataset.groupId = String(engine.groupId);

    setXY(el, x, y);
    el.style.setProperty('--s', s.toFixed(3));

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el);
    }, { passive:false });

    // TTL expire -> miss only when GOOD expires
    const ttl = engine.ttlMs;
    el._ttlTimer = root.setTimeout(()=>{
      if (!el.isConnected) return;
      if (type === 'good'){
        engine.misses++; engine.combo = 0; engine.groupClean = false;
        engine.fever = clamp(engine.fever + 10, 0, 100);
        emit('hha:judge', { kind:'MISS' });
        updateScore();
        emitFever();
      }
      el.classList.add('out');
      root.setTimeout(()=> el.remove(), 220);
    }, ttl);

    return el;
  }

  // ---------- Mechanics ----------
  function setGroup(id){
    engine.groupId = id;
    engine.groupClean = true;
    emitCoach(SONG[id] || `ต่อไป หมู่ ${id}!`, 'happy');
  }
  function perfectSwitchBonus(){
    if (!engine.groupClean) return;
    emitProgress({ kind:'perfect_switch' });
    emit('hha:celebrate', { kind:'mini', title:'Perfect Switch!' });
  }
  function switchGroup(){
    perfectSwitchBonus();
    const next = (engine.groupId % 5) + 1;
    setGroup(next);
    emitProgress({ kind:'group_swap' });
    engine.power = 0;
    updatePower();
  }
  function addPower(n){
    engine.power = clamp(engine.power + (n|0), 0, engine.powerThr);
    updatePower();
    if (engine.power >= engine.powerThr) switchGroup();
  }

  // ---------- Storm ----------
  function chooseStormPattern(){
    if (engine.style === 'feel') return 'wave';
    if (engine.style === 'hard') return 'spiral';
    return (engine.rng() < 0.5) ? 'burst' : 'wave';
  }
  function enterStorm(){
    engine.storm = true;
    engine.stormUntilMs = now() + engine.stormDurSec*1000;
    engine.stormPattern = chooseStormPattern();
    engine.stormSpawnIdx = 0;

    DOC.body.classList.add('groups-storm');
    emit('groups:storm', { on:true, durSec: engine.stormDurSec|0, pattern: engine.stormPattern });
    emitProgress({ kind:'storm_on' });
    emit('hha:judge', { kind:'boss', text:'STORM!' });
  }
  function exitStorm(){
    engine.storm = false;
    engine.stormUntilMs = 0;
    DOC.body.classList.remove('groups-storm','groups-storm-urgent');
    emit('groups:storm', { on:false, durSec: 0 });
    emitProgress({ kind:'storm_off' });
  }

  // ---------- Boss ----------
  function tryBossSpawn(){
    if (engine.bossAlive) return;
    if (now() < engine.nextBossAtMs) return;

    engine.bossAlive = true;
    engine.bossHp = engine.bossHpMax;

    const p = engine.storm ? stormPos() : randPos();
    const s = 1.25 * engine.sizeBase;

    const el = makeTarget('boss','👑',p.x,p.y,s);
    if (!el) return;

    el.dataset.hp = String(engine.bossHp);
    el.classList.add('fg-boss');
    engine.layerEl.appendChild(el);

    engine._bossEl = el;
    emitProgress({ kind:'boss_spawn' });
    emit('hha:judge', { kind:'boss', text:'BOSS!' });

    engine.nextBossAtMs = now() + (engine.runMode==='research' ? 20000 : clamp(engine.adapt.bossEvery, 14000, 26000));
  }

  function hitBoss(el){
    emitProgress({ type:'hit', correct:true });

    engine.hitAll++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);
    emitProgress({ kind:'combo', combo: engine.combo });

    engine.bossHp = Math.max(0, engine.bossHp - 1);
    el.dataset.hp = String(engine.bossHp);

    engine.score += Math.round(140 * scoreMult());
    updateScore();

    if (engine.bossHp <= 0){
      engine.bossAlive = false;
      emitProgress({ kind:'boss_down' });
      emit('hha:celebrate', { kind:'goal', title:'BOSS DOWN!' });
      removeTarget(el);
    } else {
      el.classList.add('fg-boss-hurt');
      setTimeout(()=> el.classList.remove('fg-boss-hurt'), 220);
    }
  }

  // ---------- Powerups ----------
  function applyBuffClasses(){
    const t = now();
    if (t < engine.overUntil) DOC.body.classList.add('groups-overdrive');
    else DOC.body.classList.remove('groups-overdrive');

    if (t < engine.freezeUntil) DOC.body.classList.add('groups-freeze');
    else DOC.body.classList.remove('groups-freeze');
  }

  function pickupStar(el){
    emitProgress({ type:'hit', correct:true }); // audio happy
    emit('hha:judge', { kind:'good', text:'⭐ OVERDRIVE!' });

    engine.overUntil = now() + 7000;
    engine.shield = 1; // 1 junk block
    emitFever();
    applyBuffClasses();

    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    engine.score += 120;
    updateScore();

    removeTarget(el);
  }

  function pickupIce(el){
    emitProgress({ type:'hit', correct:true });
    emit('hha:judge', { kind:'good', text:'❄️ FREEZE!' });

    engine.freezeUntil = now() + 6000;
    applyBuffClasses();

    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    engine.score += 80;
    updateScore();

    removeTarget(el);
  }

  // ---------- Hit logic ----------
  function hitTarget(el){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    let type = String(el.dataset.type||'').toLowerCase();

    if (type === 'boss'){ hitBoss(el); return; }
    if (type === 'star'){ pickupStar(el); return; }
    if (type === 'ice') { pickupIce(el);  return; }

    if (type === 'good'){
      const gid = Number(el.dataset.groupId)||0;
      if (gid && gid !== engine.groupId) type = 'wrong';
    }

    engine.hitAll++;

    if (type === 'good'){
      emitProgress({ type:'hit', correct:true });
      emitProgress({ kind:'hit_good' });
      engine.hitGood++;

      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      emitProgress({ kind:'combo', combo: engine.combo });

      engine.score += Math.round((100 + engine.combo*3) * scoreMult());
      engine.fever = clamp(engine.fever - 3, 0, 100);

      updateScore();
      emitFever();

      addPower(1);

      removeTarget(el);
      return;
    }

    const badLike = (type === 'junk' || type === 'wrong' || type === 'decoy');
    if (badLike){
      if (type === 'junk' && engine.shield > 0){
        engine.shield = 0;
        emitFever();
        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        removeTarget(el);
        return;
      }

      emitProgress({ type:'hit', correct:false });
      emitProgress({ kind:'hit_bad' });

      engine.misses++;
      engine.combo = 0;
      engine.groupClean = false;

      engine.fever = clamp(engine.fever + (type==='junk'?18:12), 0, 100);
      emitFever();

      emit('hha:judge', { kind:'bad', text:(type==='junk'?'JUNK!':'WRONG!') });

      updateScore();
      removeTarget(el);
      return;
    }
  }

  // ---------- Spawn decision ----------
  function chooseType(){
    const baseJ = (engine.runMode==='research') ? diffParams(engine.diff).junk : engine.adapt.junkBias;
    const baseD = (engine.runMode==='research') ? diffParams(engine.diff).decoy : engine.adapt.decoyBias;

    // powerups
    const pu = engine.storm ? 0.016 : 0.010;
    if (engine.rng() < pu) return (engine.rng() < 0.5) ? 'star' : 'ice';

    const r = engine.rng();
    if (r < baseJ) return 'junk';
    if (r < baseJ + baseD) return 'decoy';

    if (engine.rng() < (engine.storm ? 0.18 : 0.14)) return 'wrong';
    return 'good';
  }

  function chooseEmoji(tp){
    if (tp === 'junk') return JUNK_EMOJI[(engine.rng()*JUNK_EMOJI.length)|0];
    if (tp === 'decoy') return DECOY_EMOJI[(engine.rng()*DECOY_EMOJI.length)|0];
    if (tp === 'star') return '⭐';
    if (tp === 'ice')  return '❄️';
    if (tp === 'good') return GROUPS[engine.groupId].emoji[(engine.rng()*GROUPS[engine.groupId].emoji.length)|0];

    const other = [];
    for (let g=1; g<=5; g++){
      if (g === engine.groupId) continue;
      other.push(...GROUPS[g].emoji);
    }
    return other[(engine.rng()*other.length)|0] || '✨';
  }

  function spawnOne(){
    if (!engine.running || engine.ended) return;
    const layer = engine.layerEl;
    if (!layer) return;

    tryBossSpawn();

    const tp = chooseType();
    const em = chooseEmoji(tp);
    const p = engine.storm ? stormPos() : randPos();
    const s = (tp === 'boss') ? 1.25*engine.sizeBase : engine.sizeBase;

    const el = makeTarget(tp, em, p.x, p.y, s);
    if (el) layer.appendChild(el);
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;
    spawnOne();

    const t = now();
    const frozen = (t < engine.freezeUntil);

    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;
    const mult = frozen ? 1.25 : 1.0;                 // ❄️ spawn ช้าลง
    const sMs = Math.max(420, base.spawnMs * (engine.storm ? 0.82 : 1.0) * mult);

    engine.spawnTimer = root.setTimeout(loopSpawn, sMs);
  }

  // ---------- Tick loop ----------
  function feverTick(){
    const t = now();
    if (!engine.feverTickLast) engine.feverTickLast = t;
    const dt = Math.min(0.25, Math.max(0, (t - engine.feverTickLast)/1000));
    engine.feverTickLast = t;

    const acc = engine.hitAll > 0 ? (engine.hitGood/engine.hitAll) : 0;
    const cool = 7.5 * (0.6 + clamp(engine.combo/18,0,1)*0.6 + clamp(acc,0,1)*0.3);
    engine.fever = clamp(engine.fever - cool*dt, 0, 100);
    emitFever();
  }

  function loopTick(){
    if (!engine.running || engine.ended) return;

    // storm timing
    if (!engine.storm && now() >= engine.nextStormAtMs) enterStorm();
    if (engine.storm && now() >= engine.stormUntilMs){
      exitStorm();
      engine.nextStormAtMs = now() + (16000 + engine.rng()*12000);
    } else if (engine.storm){
      const leftMs = engine.stormUntilMs - now();
      if (leftMs <= 3200){
        DOC.body.classList.add('groups-storm-urgent');
      }
    }

    // adaptive only in play
    if (engine.runMode === 'play'){
      const acc = engine.hitAll > 0 ? (engine.hitGood/engine.hitAll) : 0;
      const heat = clamp((engine.combo/18) + (acc-0.65), 0, 1);
      engine.adapt.spawnMs = clamp(820 - heat*260, 480, 880);
      engine.adapt.ttl     = clamp(1680 - heat*260, 1250, 1750);
      engine.adapt.junkBias = clamp(0.11 + heat*0.06, 0.08, 0.22);
      engine.adapt.decoyBias= clamp(0.09 + heat*0.05, 0.06, 0.20);
      engine.adapt.bossEvery= clamp(20000 - heat*6000, 14000, 22000);
    }

    // ❄️ freeze makes ttl longer for new targets
    const t = now();
    const frozen = (t < engine.freezeUntil);
    const baseTTL = (engine.runMode==='research') ? diffParams(engine.diff).ttl : engine.adapt.ttl;
    engine.ttlMs = frozen ? Math.round(baseTTL * 1.20) : baseTTL;

    applyBuffClasses();
    feverTick();

    engine.left = Math.max(0, engine.left - 0.14);
    updateTime();
    if (engine.left <= 0){ endGame('time'); return; }

    engine.tickTimer = root.setTimeout(loopTick, 140);
  }

  function clearAllTargets(){
    const layer = engine.layerEl;
    if (!layer) return;
    const list = layer.querySelectorAll('.fg-target');
    list.forEach(el=>{
      try{ root.clearTimeout(el._ttlTimer); }catch{}
      el.remove();
    });
  }

  function endGame(reason){
    if (engine.ended) return;
    engine.ended = true;
    engine.running = false;

    try{ root.clearTimeout(engine.spawnTimer); }catch{}
    try{ root.clearTimeout(engine.tickTimer); }catch{}
    clearAllTargets();
    questStop();

    DOC.body.classList.remove('groups-storm','groups-storm-urgent','groups-overdrive','groups-freeze');

    const acc = engine.hitAll > 0 ? Math.round((engine.hitGood/engine.hitAll)*100) : 0;
    const grade = rankFromAcc(acc);

    let qs = null;
    try{ qs = engine.quest && engine.quest.getState ? engine.quest.getState() : null; }catch{}

    emit('hha:end', {
      reason: reason || 'end',
      scoreFinal: engine.score|0,
      comboMax: engine.comboMax|0,
      misses: engine.misses|0,
      accuracyGoodPct: acc|0,
      grade,
      goalsCleared: qs ? (qs.goalsCleared|0) : 0,
      goalsTotal:   qs ? (qs.goalsTotal|0)   : 0,
      miniCleared:  qs ? (qs.miniCleared|0)  : 0,
      miniTotal:    qs ? (qs.miniTotal|0)    : 0,
      diff: engine.diff,
      runMode: engine.runMode,
      style: engine.style,
      seed: engine.seed
    });
  }

  // ---------- Public API ----------
  function setLayerEl(el){ engine.layerEl = el || null; applyView(); setupView(); }

  function start(diff, cfg){
    cfg = cfg || {};
    engine.runMode = (String(cfg.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    engine.diff = String(diff || cfg.diff || 'normal').toLowerCase();
    engine.style = styleNorm(cfg.style || 'mix');
    engine.timeSec = clamp(cfg.time ?? 90, 30, 180);
    engine.seed = String(cfg.seed || Date.now());
    engine.rng = makeRng(engine.seed);

    const Q = qs();
    const ui = String(cfg.ui || Q.get('ui') || Q.get('layout') || '').toLowerCase();
    if (ui === 'compact' || ui === 'b' || ui === 'b++') DOC.body.classList.add('ui-compact');
    else DOC.body.classList.remove('ui-compact');

    const dp = diffParams(engine.diff);

    engine.running = true;
    engine.ended = false;

    engine.left = engine.timeSec;
    engine.score = 0; engine.combo = 0; engine.comboMax = 0;
    engine.misses = 0; engine.hitGood = 0; engine.hitAll = 0;

    engine.powerThr = dp.powerThr;
    engine.power = 0;

    engine.sizeBase = dp.size;
    engine.ttlMs = dp.ttl;

    engine.storm = false;
    engine.stormDurSec = dp.stormDur;
    engine.nextStormAtMs = now() + (12000 + engine.rng()*11000);
    engine.stormPattern = (engine.style==='hard'?'spiral':engine.style==='feel'?'wave':'burst');
    engine.stormSpawnIdx = 0;

    engine.bossAlive = false;
    engine.bossHpMax = dp.bossHp;
    engine.nextBossAtMs = now() + 14000;

    engine.groupId = 1;
    engine.groupClean = true;

    engine.fever = 0;
    engine.shield = 0;
    engine.feverTickLast = 0;

    engine.freezeUntil = 0;
    engine.overUntil = 0;

    engine.vx = 0; engine.vy = 0;
    applyView();

    engine._rectCacheAt = 0;
    engine._rectCache = null;

    DOC.body.classList.remove('groups-storm','groups-storm-urgent','groups-overdrive','groups-freeze');

    updateTime();
    updatePower();
    updateScore();
    emitFever();
    emitCoach(SONG[1], 'neutral');

    questStart();
    emit('hha:celebrate', { kind:'goal', title:'เริ่มเกม! 🎵' });

    loopSpawn();
    loopTick();
  }

  function stop(reason){ endGame(reason || 'stop'); }

  NS.GameEngine = { start, stop, setLayerEl };

})(typeof window !== 'undefined' ? window : globalThis);