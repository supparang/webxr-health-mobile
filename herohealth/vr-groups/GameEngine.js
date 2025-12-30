/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (FULL FUN + FAIR + RESPONSIVE SAFE)
✅ ⭐ Star = Overdrive + Magnet + Shield
✅ ❄️ Ice  = Freeze (slower spawn + longer TTL + delay storm)
✅ No-Junk Zone API: setNoJunk({on,cx,cy,r}) + anti-spawn-junk-in-ring
✅ Blocked rects API: setBlockedRects(rects) => spawn avoids HUD/Quest/Coach/Power
✅ Type classes wired: fg-good / fg-junk / fg-wrong / fg-decoy / fg-boss / fg-star / fg-ice
✅ Fever shake + urgent FX (mini<=3s, storm urgent)
✅ Emits events expected by audio.js + groups-quests.js + run HUD
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

  // ---------- Song (ครบ 1–5) ----------
  const SONG_HEAD = 'อาหารหลัก 5 หมู่ของไทย ทุกคนจำไว้อย่าได้แปลผัน 🎵';
  const SONG = {
    0: SONG_HEAD,
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
    if (diff === 'easy') return { spawnMs:900, ttl:1750, size:1.05, powerThr:thr, junk:0.10, decoy:0.08, stormDur:6, bossHp:3, powDur:5200 };
    if (diff === 'hard') return { spawnMs:680, ttl:1450, size:0.92, powerThr:thr, junk:0.16, decoy:0.12, stormDur:7, bossHp:4, powDur:4600 };
    return                 { spawnMs:780, ttl:1600, size:1.00, powerThr:thr, junk:0.12, decoy:0.10, stormDur:6, bossHp:3, powDur:5000 };
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
    uiMode:'pc',
    timeSec:90,
    seed:'seed',
    rng:Math.random,

    // VR feel
    vx:0, vy:0, dragOn:false, dragX:0, dragY:0,

    // time/score
    left:90,
    score:0,
    combo:0,
    comboMax:0,
    misses:0,
    hitGood:0,
    hitAll:0,

    // group
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
    magnetUntil:0,
    freezeUntil:0,
    overUntil:0,
    _powDur:5000,

    // nojunk zone
    noJunkOn:false,
    noJunk:{ cx:0, cy:0, r:0 },

    // spawn safety
    blockedRects: [],

    // timers
    spawnTimer:0,
    tickTimer:0,

    // quest
    quest:null,
    _questBound:false
  };

  function scoreMult(){ return (now() < engine.overUntil) ? 2 : 1; }
  function hasMagnet(){ return now() < engine.magnetUntil; }
  function hasFreeze(){ return now() < engine.freezeUntil; }
  function hasOver(){ return now() < engine.overUntil; }

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
  function updateTime(){ emit('hha:time', { left: Math.max(0, Math.floor(engine.left))|0 }); }
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

  // ---------- View / Shake ----------
  function setBodyClass(cls, on){
    try{ DOC.body.classList.toggle(cls, !!on); }catch{}
  }

  function applyView(){
    const layer = engine.layerEl;
    if (!layer) return;

    // fever-based micro shake (only on gameplay layer)
    let shake = 0;
    if (engine.fever >= 60){
      shake = clamp((engine.fever - 55) / 100, 0, 0.28) * 1.6; // px-ish
      const j = (engine.rng() - 0.5) * shake * 2;
      layer.style.setProperty('--shake', j.toFixed(2) + 'px');
    } else {
      layer.style.setProperty('--shake', '0px');
    }

    layer.style.setProperty('--vx', engine.vx.toFixed(1)+'px');
    layer.style.setProperty('--vy', engine.vy.toFixed(1)+'px');

    // No-Junk ring css vars
    if (engine.noJunkOn){
      layer.style.setProperty('--nojunk-on', '1');
      layer.style.setProperty('--nojunk-cx', engine.noJunk.cx.toFixed(1)+'px');
      layer.style.setProperty('--nojunk-cy', engine.noJunk.cy.toFixed(1)+'px');
      layer.style.setProperty('--nojunk-r',  engine.noJunk.r.toFixed(1)+'px');
    } else {
      layer.style.setProperty('--nojunk-on', '0');
      layer.style.setProperty('--nojunk-r', '0px');
    }
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

        const k = (engine.uiMode === 'vr') ? 0.18 : 0.22;
        engine.vx = clamp(engine.vx + dx*k, -90, 90);
        engine.vy = clamp(engine.vy + dy*k, -90, 90);
        applyView();
      }, { passive:true });

      root.addEventListener('pointerup', ()=>{ engine.dragOn=false; }, { passive:true });

      root.addEventListener('deviceorientation', (ev)=>{
        const gx = Number(ev.gamma)||0;
        const gy = Number(ev.beta)||0;
        const kx = (engine.uiMode === 'vr') ? 0.05 : 0.06;
        const ky = (engine.uiMode === 'vr') ? 0.015 : 0.02;
        engine.vx = clamp(engine.vx + gx*kx, -90, 90);
        engine.vy = clamp(engine.vy + (gy-20)*ky, -90, 90);
        applyView();
      }, { passive:true });
    }

    const it = setInterval(()=>{
      bind();
      if (bound) clearInterval(it);
    }, 80);
  }

  // ---------- Spawn safety ----------
  function safeSpawnRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;

    // base margins (still keep play area)
    const top = (engine.uiMode === 'vr') ? 170 : 150;
    const bot = (engine.uiMode === 'vr') ? 210 : 185;
    const side = 16;

    return { x0:side, x1:W-side, y0:top, y1:H-bot, W, H };
  }

  function inBlocked(x,y){
    const pad = (engine.uiMode === 'vr') ? 18 : 14;
    const list = engine.blockedRects || [];
    for (let i=0;i<list.length;i++){
      const r = list[i];
      if (!r) continue;
      if (x >= (r.left - pad) && x <= (r.right + pad) && y >= (r.top - pad) && y <= (r.bottom + pad)){
        return true;
      }
    }
    return false;
  }

  function randPosBase(){
    const r = safeSpawnRect();
    const x = r.x0 + engine.rng()*(r.x1 - r.x0);
    const y = r.y0 + engine.rng()*(r.y1 - r.y0);
    return { x, y };
  }

  function randPos(){
    for (let i=0;i<26;i++){
      const p = randPosBase();
      if (!inBlocked(p.x,p.y)) return p;
    }
    return randPosBase();
  }

  function stormPos(){
    const r = safeSpawnRect();
    const cx = r.W * 0.5;
    const cy = (r.y0 + r.y1) * 0.5;
    const idx = (engine.stormSpawnIdx++);

    const jx = (engine.rng()-0.5) * 26;
    const jy = (engine.rng()-0.5) * 22;

    function ok(p){ return !inBlocked(p.x,p.y); }

    if (engine.stormPattern === 'wave'){
      for (let k=0;k<10;k++){
        const t = ((idx + k*3) % 28) / 28;
        const x = r.x0 + t*(r.x1 - r.x0);
        const y = cy + Math.sin((idx*0.55 + k*0.3)) * ((r.y1 - r.y0)*0.22);
        const p = { x: clamp(x + jx, r.x0, r.x1), y: clamp(y + jy, r.y0, r.y1) };
        if (ok(p)) return p;
      }
      return { x: clamp(cx + jx, r.x0, r.x1), y: clamp(cy + jy, r.y0, r.y1) };
    }

    if (engine.stormPattern === 'spiral'){
      for (let k=0;k<12;k++){
        const a = (idx + k) * 0.62;
        const rad = clamp(28 + (idx+k)*5.0, 28, Math.min(r.x1-r.x0, r.y1-r.y0)*0.40);
        const p = { x: cx + Math.cos(a)*rad, y: cy + Math.sin(a)*rad };
        p.x = clamp(p.x + jx, r.x0, r.x1);
        p.y = clamp(p.y + jy, r.y0, r.y1);
        if (ok(p)) return p;
      }
      return { x: clamp(cx + jx, r.x0, r.x1), y: clamp(cy + jy, r.y0, r.y1) };
    }

    // burst
    const corners = [
      {x:r.x0+26, y:r.y0+26},
      {x:r.x1-26, y:r.y0+26},
      {x:r.x0+26, y:r.y1-26},
      {x:r.x1-26, y:r.y1-26},
      {x:cx, y:r.y0+22},
      {x:cx, y:r.y1-22},
    ];
    for (let k=0;k<12;k++){
      const c = corners[(engine.rng()*corners.length)|0];
      const x = c.x + (engine.rng()-0.5)*120;
      const y = c.y + (engine.rng()-0.5)*110;
      const p = { x: clamp(x + jx, r.x0, r.x1), y: clamp(y + jy, r.y0, r.y1) };
      if (ok(p)) return p;
    }
    return { x: clamp(cx + jx, r.x0, r.x1), y: clamp(cy + jy, r.y0, r.y1) };
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

  function setTypeClass(el, type){
    const map = {
      good:'fg-good',
      wrong:'fg-wrong',
      junk:'fg-junk',
      decoy:'fg-decoy',
      boss:'fg-boss',
      star:'fg-star',
      ice:'fg-ice'
    };
    const cls = map[type] || '';
    if (cls) el.classList.add(cls);
  }

  function ttlNow(){
    const base = engine.ttlMs;
    const f = hasFreeze() ? 1.35 : 1.0;
    return Math.round(base * f);
  }

  function makeTarget(type, emoji, x, y, s){
    const layer = engine.layerEl;
    if (!layer) return null;

    const el = DOC.createElement('div');
    el.className = 'fg-target spawn';
    el.dataset.emoji = emoji || '✨';
    el.dataset.type = type;

    setTypeClass(el, type);

    if (type === 'good') el.dataset.groupId = String(engine.groupId);

    setXY(el, x, y);

    // magnet: enlarge slightly for easier hits
    if (hasMagnet()) s *= 1.06;
    el.style.setProperty('--s', s.toFixed(3));

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el);
    }, { passive:false });

    // TTL expire -> MISS only when GOOD expires
    const ttl = ttlNow();
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

  // ---------- Game mechanics ----------
  function setGroup(id){
    engine.groupId = id;
    engine.groupClean = true;
    // coach: show head + line
    emitCoach(`${SONG[0]}\n${SONG[id] || `ต่อไป หมู่ ${id}!`}`, 'happy');
  }

  function perfectSwitchBonus(){
    if (!engine.groupClean) return;
    emitProgress({ kind:'perfect_switch' });
    emit('hha:celebrate', { kind:'mini', title:'Perfect Switch!' });
    engine.score += Math.round(120 * scoreMult());
    updateScore();
  }

  function switchGroup(){
    perfectSwitchBonus();

    const next = (engine.groupId % 5) + 1;
    setGroup(next);

    emitProgress({ kind:'group_swap' });

    // reset power
    engine.power = 0;
    updatePower();

    // tiny cool-down reward
    engine.fever = clamp(engine.fever - 6, 0, 100);
    emitFever();
  }

  function addPower(n){
    engine.power = clamp(engine.power + (n|0), 0, engine.powerThr);
    updatePower();
    if (engine.power >= engine.powerThr) switchGroup();
  }

  // ---------- Buffs ----------
  function setBuffClasses(){
    setBodyClass('groups-overdrive', hasOver());
    setBodyClass('groups-freeze', hasFreeze());
  }

  function grantStar(){
    const dur = engine._powDur || 5000;
    engine.overUntil = now() + dur;
    engine.magnetUntil = now() + dur;
    engine.shield = Math.max(engine.shield, 1);
    emitFever();
    setBuffClasses();
    emitProgress({ kind:'power_star' });
    emit('hha:judge', { kind:'good', text:'⭐ OVERDRIVE!' });
    emitCoach('⭐ ได้ Overdrive + Magnet + Shield!', 'happy');
  }

  function grantIce(){
    const dur = Math.round((engine._powDur || 5000) * 1.05);
    engine.freezeUntil = now() + dur;
    // if storm running -> soften / shorten
    if (engine.storm){
      engine.stormUntilMs = Math.min(engine.stormUntilMs, now() + 800);
    }
    // delay next storm
    engine.nextStormAtMs = Math.max(engine.nextStormAtMs, now() + 9000);

    engine.fever = clamp(engine.fever - 10, 0, 100);
    emitFever();
    setBuffClasses();
    emitProgress({ kind:'power_ice' });
    emit('hha:judge', { kind:'good', text:'❄️ FREEZE!' });
    emitCoach('❄️ Freeze! เป้าช้าลง + อยู่ได้นานขึ้น', 'neutral');
  }

  // ---------- Storm ----------
  function chooseStormPattern(){
    if (engine.style === 'feel') return 'wave';
    if (engine.style === 'hard') return 'spiral';
    return (engine.rng() < 0.5) ? 'burst' : 'wave';
  }

  function enterStorm(){
    // freeze delays storm
    if (hasFreeze()) return;

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

    engine.score += Math.round(160 * scoreMult());
    updateScore();

    if (engine.bossHp <= 1){
      el.classList.add('fg-boss-weak');
    }

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

  // ---------- Hit logic ----------
  function hitTarget(el){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    let type = String(el.dataset.type||'').toLowerCase();

    if (type === 'boss'){ hitBoss(el); return; }

    // powerups
    if (type === 'star'){
      engine.hitAll++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      emitProgress({ kind:'combo', combo: engine.combo });
      engine.score += Math.round(90 * scoreMult());
      updateScore();
      grantStar();
      removeTarget(el);
      return;
    }
    if (type === 'ice'){
      engine.hitAll++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      emitProgress({ kind:'combo', combo: engine.combo });
      engine.score += Math.round(80 * scoreMult());
      updateScore();
      grantIce();
      removeTarget(el);
      return;
    }

    // good but wrong group => wrong
    if (type === 'good'){
      const gid = Number(el.dataset.groupId)||0;
      if (gid && gid !== engine.groupId) type = 'wrong';
    }

    engine.hitAll++;

    // GOOD
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

    // BAD types
    const badLike = (type === 'junk' || type === 'wrong' || type === 'decoy');
    if (badLike){
      // shield blocks junk = no miss and NOT hit_bad
      if (type === 'junk' && engine.shield > 0){
        engine.shield = 0;
        emitFever();
        emitProgress({ kind:'shield_used' });
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

    // power-up chance
    const pu = engine.storm ? 0.018 : 0.012;
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

    // wrong
    const other = [];
    for (let g=1; g<=5; g++){
      if (g === engine.groupId) continue;
      other.push(...GROUPS[g].emoji);
    }
    return other[(engine.rng()*other.length)|0] || '✨';
  }

  function inNoJunkRing(p){
    if (!engine.noJunkOn) return false;
    const dx = p.x - engine.noJunk.cx;
    const dy = p.y - engine.noJunk.cy;
    return (dx*dx + dy*dy) <= (engine.noJunk.r * engine.noJunk.r);
  }

  function spawnOne(){
    if (!engine.running || engine.ended) return;
    const layer = engine.layerEl;
    if (!layer) return;

    tryBossSpawn();

    let tp = chooseType();
    const em = chooseEmoji(tp);

    // position
    let p = engine.storm ? stormPos() : randPos();

    // Fair No-Junk: junk should avoid ring area (so mini is fair)
    if (engine.noJunkOn && (tp === 'junk')){
      for (let k=0;k<18;k++){
        const pp = engine.storm ? stormPos() : randPos();
        if (!inNoJunkRing(pp)){ p = pp; break; }
      }
    }

    const s = engine.sizeBase;

    const el = makeTarget(tp, em, p.x, p.y, s);
    if (el) layer.appendChild(el);
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;
    spawnOne();

    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;
    let sMs = Math.max(420, base.spawnMs * (engine.storm ? 0.82 : 1.0));
    if (hasFreeze()) sMs *= 1.35; // slower spawns
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

    setBuffClasses();

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
      engine.ttlMs = engine.adapt.ttl;
      engine.adapt.junkBias = clamp(0.11 + heat*0.06, 0.08, 0.22);
      engine.adapt.decoyBias= clamp(0.09 + heat*0.05, 0.06, 0.20);
      engine.adapt.bossEvery= clamp(20000 - heat*6000, 14000, 22000);
    }

    feverTick();
    applyView();

    // time (dt-based)
    const t = now();
    if (!engine._tLast) engine._tLast = t;
    const dt = Math.min(0.35, Math.max(0.05, (t - engine._tLast)/1000));
    engine._tLast = t;

    engine.left = Math.max(0, engine.left - dt);
    updateTime();
    if (engine.left <= 0){ endGame('time'); return; }

    engine.tickTimer = root.setTimeout(loopTick, 120);
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

  function setBlockedRects(rects){
    engine.blockedRects = Array.isArray(rects) ? rects.filter(Boolean) : [];
  }

  function setNoJunk(cfg){
    cfg = cfg || {};
    const on = !!cfg.on;
    engine.noJunkOn = on;
    if (on){
      engine.noJunk.cx = Number(cfg.cx)|| (root.innerWidth||360)*0.5;
      engine.noJunk.cy = Number(cfg.cy)|| (root.innerHeight||640)*0.56;
      engine.noJunk.r  = clamp(Number(cfg.r)||140, 80, 420);
      emitProgress({ kind:'nojunk_on' });
    } else {
      engine.noJunkOn = false;
      emitProgress({ kind:'nojunk_off' });
    }
    applyView();
  }

  function setUIMode(mode){
    mode = String(mode||'pc').toLowerCase();
    engine.uiMode = (mode==='vr') ? 'vr' : (mode==='mobile') ? 'mobile' : 'pc';
  }

  function start(diff, cfg){
    cfg = cfg || {};
    engine.runMode = (String(cfg.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    engine.diff = String(diff || cfg.diff || 'normal').toLowerCase();
    engine.style = styleNorm(cfg.style || 'mix');
    engine.timeSec = clamp(cfg.time ?? 90, 30, 180);
    engine.seed = String(cfg.seed || Date.now());
    engine.rng = makeRng(engine.seed);

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

    engine._powDur = dp.powDur || 5000;
    engine.magnetUntil = 0;
    engine.freezeUntil = 0;
    engine.overUntil   = 0;

    engine.noJunkOn = false;
    engine.noJunk = { cx:0, cy:0, r:0 };

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

    engine.vx = 0; engine.vy = 0;
    engine._tLast = 0;

    applyView();

    updateTime();
    updatePower();
    updateScore();
    emitFever();
    emitCoach(`${SONG[0]}\n${SONG[1]}`, 'neutral');

    questStart();
    emit('hha:celebrate', { kind:'goal', title:'เริ่มเกม! 🎵' });

    loopSpawn();
    loopTick();
  }

  function stop(reason){ endGame(reason || 'stop'); }

  NS.GameEngine = {
    start, stop, setLayerEl,
    setBlockedRects,
    setNoJunk,
    setUIMode
  };

})(typeof window !== 'undefined' ? window : globalThis);