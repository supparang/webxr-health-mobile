/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (ALL PACK: Fun B + C + D)
✅ Connected to groups-quests.js + audio.js
✅ Emits:
   - audio.js: groups:progress { type:'hit', correct:boolean } + hha:judge {kind:'MISS'}
   - groups-quests.js: groups:progress { kind:'hit_good'|'hit_bad'|'combo'|'group_swap'|'perfect_switch'|'storm_on'|'storm_off'|'boss_spawn'|'boss_down'|'ring_on'|'ring_off' }
✅ NEW FUN (B):
   - ⭐ star => Overdrive (score x2) + Shield 1 + Magnet
   - ❄️ ice  => Freeze (slow) + cool fever
   - 🧲 magnet => pull GOOD targets toward center
   - 🟣 Ring Guardian (PLAY only): Good hit must be INSIDE ring (ring shrinks)
✅ NEW FUN (C):
   - 👑 Boss Phase 2: HP low => warp + decoys + rage
✅ NEW FUN (D):
   - 🥁 Rhythm Beat: hit within beat-window => Perfect Timing bonus
   - 🎯 Mini Challenges in engine (non-quest): streak/ring/nojunk bursts
✅ Layout-safe spawn rect (dynamic reads HUD/Coach)
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
    return (s==='hard'||s==='feel'||s==='mix'||s==='compact'||s==='cinema') ? s : 'mix';
  }
  function pxVar(name){
    const v = getComputedStyle(DOC.documentElement).getPropertyValue(name) || '0px';
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  function inViewportRect(r, W, H){
    if (!r) return false;
    return (r.width>0 && r.height>0 && r.bottom>0 && r.right>0 && r.top < H && r.left < W);
  }

  // ---------- Song lines (Thai main 5 groups) ----------
  const SONG_ALL = [
    'อาหารหลัก 5 หมู่ของไทย ทุกคนจำไว้อย่าได้แปลผัน 🎵',
    'หมู่ 1 กินเนื้อ นม ไข่ ถั่วเมล็ดช่วยให้เติบโตแข็งขัน 💪',
    'หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล จะให้พลัง ⚡',
    'หมู่ 3 กินผักต่างๆ สารอาหารมากมายกินเป็นอาจิณ 🥦',
    'หมู่ 4 กินผลไม้ สีเขียวเหลืองบ้างมีวิตามิน 🍎',
    'หมู่ 5 อย่าได้ลืมกิน ไขมันทั้งสิ้น อบอุ่นร่างกาย 🥑'
  ];
  const SONG = { 1:SONG_ALL[1], 2:SONG_ALL[2], 3:SONG_ALL[3], 4:SONG_ALL[4], 5:SONG_ALL[5] };

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
    if (diff === 'easy') return { spawnMs:900, ttl:1750, size:1.05, powerThr:thr, junk:0.10, decoy:0.08, stormDur:6, bossHp:3, ringDur:7, ringR:140, bpm:108, beatWin:170 };
    if (diff === 'hard') return { spawnMs:680, ttl:1450, size:0.92, powerThr:thr, junk:0.16, decoy:0.12, stormDur:7, bossHp:4, ringDur:7, ringR:118, bpm:116, beatWin:150 };
    return                 { spawnMs:780, ttl:1600, size:1.00, powerThr:thr, junk:0.12, decoy:0.10, stormDur:6, bossHp:3, ringDur:7, ringR:130, bpm:112, beatWin:160 };
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
    bossRage:false,
    bossWarpUntil:0,
    bossWarpTimer:0,
    _bossEl:null,

    // buffs
    magnetUntil:0,
    freezeUntil:0,
    overUntil:0,

    // ring guardian (play only)
    ring:false,
    ringUntilMs:0,
    nextRingAtMs:0,
    ringCx:0,
    ringCy:0,
    ringRBase:130,
    ringR:130,

    // rhythm
    bpm:112,
    beatWinMs:160,
    nextBeatAt:0,
    lastBeatAt:0,

    // mini challenges (engine-only)
    mini:{
      streakNeed:10,
      streak:0,
      streakUntil:0,
      ringHits:0,
      ringNeed:6,
      nojunkUntil:0,
      nojunkNeed:7,
      nojunkGood:0
    },

    // timers
    spawnTimer:0,
    tickTimer:0,

    // quest instance
    quest:null,
    _questBound:false
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

  // ---------- Dynamic spawn rect (avoid HUD/Coach) ----------
  function safeSpawnRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;

    const side = 16;
    let top = 16 + pxVar('--sat');
    let bot = 16 + pxVar('--sab');

    const hud = DOC.querySelector('.hud-top');
    const coach = DOC.querySelector('.coachWrap');

    if (hud){
      const r = hud.getBoundingClientRect();
      if (inViewportRect(r, W, H) && r.bottom > 0) top = Math.max(top, r.bottom + 10);
    }
    if (coach){
      const r = coach.getBoundingClientRect();
      if (inViewportRect(r, W, H) && r.top < H) bot = Math.max(bot, (H - r.top) + 10);
    }

    let x0 = side + pxVar('--sal');
    let x1 = W - side - pxVar('--sar');
    let y0 = top;
    let y1 = H - bot;

    if ((y1 - y0) < 160){
      y0 = Math.max(120, 16 + pxVar('--sat'));
      y1 = H - Math.max(160, 16 + pxVar('--sab'));
    }
    if ((x1 - x0) < 220){
      x0 = 14 + pxVar('--sal');
      x1 = W - 14 - pxVar('--sar');
    }

    return { x0, x1, y0, y1, W, H };
  }

  // ---------- DOM target ----------
  function setXY(el, x, y){
    el.style.setProperty('--x', x.toFixed(1)+'px');
    el.style.setProperty('--y', y.toFixed(1)+'px');
    el.dataset._x = String(x);
    el.dataset._y = String(y);
  }

  function randPos(){
    const r = safeSpawnRect();
    const x = r.x0 + engine.rng()*(r.x1 - r.x0);
    const y = r.y0 + engine.rng()*(r.y1 - r.y0);
    return { x, y };
  }

  function stormPos(){
    const r = safeSpawnRect();
    const cx = r.W * 0.5;
    const cy = (r.y0 + r.y1) * 0.5;
    const idx = (engine.stormSpawnIdx++);

    const jx = (engine.rng()-0.5) * 26;
    const jy = (engine.rng()-0.5) * 22;

    if (engine.stormPattern === 'wave'){
      const t = (idx % 28) / 28;
      const x = r.x0 + t*(r.x1 - r.x0);
      const y = cy + Math.sin((idx*0.55)) * ((r.y1 - r.y0)*0.22);
      return { x: clamp(x + jx, r.x0, r.x1), y: clamp(y + jy, r.y0, r.y1) };
    }
    if (engine.stormPattern === 'spiral'){
      const a = idx * 0.62;
      const rad = clamp(28 + idx*5.0, 28, Math.min(r.x1-r.x0, r.y1-r.y0)*0.40);
      const x = cx + Math.cos(a)*rad;
      const y = cy + Math.sin(a)*rad;
      return { x: clamp(x + jx, r.x0, r.x1), y: clamp(y + jy, r.y0, r.y1) };
    }
    const corners = [
      {x:r.x0+26, y:r.y0+26},
      {x:r.x1-26, y:r.y0+26},
      {x:r.x0+26, y:r.y1-26},
      {x:r.x1-26, y:r.y1-26},
      {x:cx, y:r.y0+22},
      {x:cx, y:r.y1-22},
    ];
    const c = corners[(engine.rng()*corners.length)|0];
    const x = c.x + (engine.rng()-0.5)*120;
    const y = c.y + (engine.rng()-0.5)*110;
    return { x: clamp(x + jx, r.x0, r.x1), y: clamp(y + jy, r.y0, r.y1) };
  }

  function ringPos(){
    const r = safeSpawnRect();
    const cx = clamp(engine.ringCx, r.x0+40, r.x1-40);
    const cy = clamp(engine.ringCy, r.y0+40, r.y1-40);
    const R  = clamp(engine.ringR, 70, engine.ringRBase);

    const a = engine.rng() * Math.PI * 2;
    const u = Math.sqrt(engine.rng());
    const rad = u * (R * 0.92);
    const x = cx + Math.cos(a)*rad + (engine.rng()-0.5)*10;
    const y = cy + Math.sin(a)*rad + (engine.rng()-0.5)*10;
    return { x: clamp(x, r.x0, r.x1), y: clamp(y, r.y0, r.y1) };
  }

  function removeTarget(el){
    if (!el) return;
    try{ root.clearTimeout(el._ttlTimer); }catch{}
    el.classList.add('hit');
    root.setTimeout(()=> el.remove(), 220);
  }

  function decorateType(el, type){
    el.classList.remove('fg-good','fg-wrong','fg-decoy','fg-junk','fg-boss','fg-star','fg-ice');
    if (type === 'good') el.classList.add('fg-good');
    else if (type === 'wrong') el.classList.add('fg-wrong');
    else if (type === 'decoy') el.classList.add('fg-decoy');
    else if (type === 'junk') el.classList.add('fg-junk');
    else if (type === 'boss') el.classList.add('fg-boss');
    else if (type === 'star') el.classList.add('fg-star');
    else if (type === 'ice')  el.classList.add('fg-ice');
  }

  function makeTarget(type, emoji, x, y, s){
    const layer = engine.layerEl;
    if (!layer) return null;

    const el = DOC.createElement('div');
    el.className = 'fg-target spawn';
    el.dataset.emoji = emoji || '✨';
    el.dataset.type = type;

    if (type === 'good') el.dataset.groupId = String(engine.groupId);

    decorateType(el, type);

    setXY(el, x, y);
    el.style.setProperty('--s', s.toFixed(3));

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el);
    }, { passive:false });

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

  // ---------- Rhythm ----------
  function initRhythm(dp){
    engine.bpm = dp.bpm|0;
    engine.beatWinMs = dp.beatWin|0;
    const iv = 60000 / Math.max(60, engine.bpm);
    engine.lastBeatAt = now();
    engine.nextBeatAt = engine.lastBeatAt + iv;
  }
  function beatIntervalMs(){
    // style can nudge
    const base = 60000 / Math.max(60, engine.bpm);
    if (engine.style === 'hard') return base * 0.96;
    if (engine.style === 'feel') return base * 1.02;
    return base;
  }
  function rhythmTick(){
    const t = now();
    if (t >= engine.nextBeatAt){
      engine.lastBeatAt = engine.nextBeatAt;
      engine.nextBeatAt = engine.lastBeatAt + beatIntervalMs();
      emit('groups:beat', {});
      DOC.body.classList.add('groups-beat');
      setTimeout(()=> DOC.body.classList.remove('groups-beat'), 120);
    }
  }
  function isPerfectTiming(){
    const t = now();
    const d = Math.abs(t - engine.lastBeatAt);
    return d <= engine.beatWinMs;
  }

  // ---------- Mechanics ----------
  function setGroup(id){
    engine.groupId = id;
    engine.groupClean = true;
    emitCoach(SONG[id] || `ต่อไป หมู่ ${id}!`, 'happy');
    emit('groups:lyric', { groupId:id, line: SONG[id] || '' });

    // engine-mini: reset ringHits on group change
    engine.mini.ringHits = 0;
  }

  function perfectSwitchBonus(){
    if (!engine.groupClean) return;

    emitProgress({ kind:'perfect_switch' });
    emit('hha:celebrate', { kind:'mini', title:'Perfect Switch!' });

    // magnet reward
    grantMagnet(5.2);
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

  // ---------- Ring Guardian ----------
  function setRingCSS(on){
    const layer = engine.layerEl;
    if (!layer) return;
    layer.style.setProperty('--nojunk-on', on ? '1' : '0');
    layer.style.setProperty('--nojunk-cx', engine.ringCx.toFixed(1)+'px');
    layer.style.setProperty('--nojunk-cy', engine.ringCy.toFixed(1)+'px');
    layer.style.setProperty('--nojunk-r',  engine.ringR.toFixed(1)+'px');
  }

  function enterRing(){
    if (engine.runMode !== 'play') return;
    if (engine.ring) return;

    const r = safeSpawnRect();
    const dp = diffParams(engine.diff);

    engine.ring = true;
    engine.ringUntilMs = now() + dp.ringDur*1000;

    engine.ringRBase = dp.ringR;
    engine.ringR = engine.ringRBase;

    engine.ringCx = r.x0 + engine.rng()*(r.x1 - r.x0);
    engine.ringCy = r.y0 + engine.rng()*(r.y1 - r.y0);

    DOC.body.classList.add('groups-ring');
    DOC.body.classList.remove('groups-mini-urgent');

    setRingCSS(true);

    emitProgress({ kind:'ring_on' });
    emit('hha:judge', { kind:'boss', text:'RING GUARDIAN!' });

    // engine-mini: ring rush
    engine.mini.ringHits = 0;
  }

  function exitRing(){
    if (!engine.ring) return;
    engine.ring = false;
    engine.ringUntilMs = 0;
    DOC.body.classList.remove('groups-ring','groups-mini-urgent');
    setRingCSS(false);
    emitProgress({ kind:'ring_off' });
  }

  function ringContainsXY(x, y){
    const dx = x - engine.ringCx;
    const dy = y - engine.ringCy;
    return (dx*dx + dy*dy) <= (engine.ringR*engine.ringR);
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

  // ---------- Boss (Phase 2) ----------
  function tryBossSpawn(){
    if (engine.bossAlive) return;
    if (now() < engine.nextBossAtMs) return;

    engine.bossAlive = true;
    engine.bossHp = engine.bossHpMax;
    engine.bossRage = false;
    engine.bossWarpUntil = 0;

    const p = engine.storm ? stormPos() : (engine.ring ? ringPos() : randPos());
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

  function bossWarpOnce(){
    const el = engine._bossEl;
    if (!el || !el.isConnected) return;
    const p = engine.storm ? stormPos() : (engine.ring ? ringPos() : randPos());
    setXY(el, p.x, p.y);
    el.classList.add('fg-boss-warp');
    setTimeout(()=> el.classList.remove('fg-boss-warp'), 160);

    // decoy burst
    for (let i=0;i<2;i++){
      const q = engine.storm ? stormPos() : randPos();
      const d = makeTarget('decoy', DECOY_EMOJI[(engine.rng()*DECOY_EMOJI.length)|0], q.x, q.y, engine.sizeBase*0.98);
      if (d) engine.layerEl.appendChild(d);
    }
  }

  function enterBossPhase2(){
    if (engine.bossRage) return;
    engine.bossRage = true;
    const el = engine._bossEl;
    if (el && el.isConnected){
      el.classList.add('fg-boss-weak');
      emit('hha:judge', { kind:'boss', text:'PHASE 2!' });
      emit('hha:celebrate', { kind:'mini', title:'👑 PHASE 2!' });
    }
    engine.bossWarpUntil = now() + 5200;

    // warp loop
    try{ clearInterval(engine.bossWarpTimer); }catch{}
    engine.bossWarpTimer = setInterval(()=>{
      if (!engine.running || engine.ended) return;
      if (!engine.bossAlive) return;
      if (now() >= engine.bossWarpUntil){
        try{ clearInterval(engine.bossWarpTimer); }catch{}
        return;
      }
      bossWarpOnce();
    }, 700);
  }

  function hitBoss(el){
    emitProgress({ type:'hit', correct:true }); // audio

    engine.hitAll++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);
    emitProgress({ kind:'combo', combo: engine.combo });

    engine.bossHp = Math.max(0, engine.bossHp - 1);
    el.dataset.hp = String(engine.bossHp);

    let addScore = 140;

    // rhythm bonus
    if (engine.runMode==='play' && isPerfectTiming()){
      addScore += 40;
      DOC.body.classList.add('groups-perfect');
      setTimeout(()=> DOC.body.classList.remove('groups-perfect'), 160);
      emit('hha:judge', { kind:'good', text:'PERFECT TIMING!' });
    }

    engine.score += Math.round(addScore * scoreMult());
    updateScore();

    // phase 2 at low hp (<=1)
    if (engine.bossHp === 1) enterBossPhase2();

    if (engine.bossHp <= 0){
      engine.bossAlive = false;
      engine.bossRage = false;
      try{ clearInterval(engine.bossWarpTimer); }catch{}

      emitProgress({ kind:'boss_down' });
      emit('hha:celebrate', { kind:'goal', title:'BOSS DOWN!' });
      removeTarget(el);

      // reward: overdrive + shield
      grantOverdrive(6);
      grantShield();
    } else {
      el.classList.add('fg-boss-hurt');
      setTimeout(()=> el.classList.remove('fg-boss-hurt'), 220);
    }
  }

  // ---------- Powerups ----------
  function grantShield(){
    if (engine.shield > 0) return;
    engine.shield = 1;
    emitFever();
    emit('hha:judge', { kind:'good', text:'SHIELD READY!' });
  }

  function grantOverdrive(sec){
    engine.overUntil = Math.max(engine.overUntil, now() + (sec*1000));
    DOC.body.classList.add('groups-overdrive');
    setTimeout(()=>{
      if (now() >= engine.overUntil) DOC.body.classList.remove('groups-overdrive');
    }, sec*1000 + 80);
  }

  function grantFreeze(sec){
    engine.freezeUntil = Math.max(engine.freezeUntil, now() + (sec*1000));
    DOC.body.classList.add('groups-freeze');
    setTimeout(()=>{
      if (now() >= engine.freezeUntil) DOC.body.classList.remove('groups-freeze');
    }, sec*1000 + 80);
  }

  function grantMagnet(sec){
    engine.magnetUntil = Math.max(engine.magnetUntil, now() + (sec*1000));
    DOC.body.classList.add('groups-magnet');
    setTimeout(()=>{
      if (now() >= engine.magnetUntil) DOC.body.classList.remove('groups-magnet');
    }, sec*1000 + 80);
  }

  // ---------- Engine-mini Challenges ----------
  function miniOnGood(){
    const t = now();

    // streak rush: need 10 good within 9s window
    if (!engine.mini.streakUntil || t > engine.mini.streakUntil){
      engine.mini.streak = 0;
      engine.mini.streakUntil = t + 9000;
    }
    engine.mini.streak++;
    if (engine.mini.streak >= engine.mini.streakNeed){
      engine.mini.streak = 0;
      engine.mini.streakUntil = t + 9000;
      emit('hha:celebrate', { kind:'mini', title:'🔥 STREAK RUSH!' });
      grantOverdrive(5);
    }

    // ring rush: in ring => need 6 good hits
    if (engine.ring){
      engine.mini.ringHits++;
      if (engine.mini.ringHits >= engine.mini.ringNeed){
        engine.mini.ringHits = 0;
        emit('hha:celebrate', { kind:'mini', title:'🟣 RING RUSH!' });
        grantMagnet(5);
      }
    }

    // no-junk burst window
    if (engine.mini.nojunkUntil && t <= engine.mini.nojunkUntil){
      engine.mini.nojunkGood++;
      if (engine.mini.nojunkGood >= engine.mini.nojunkNeed){
        engine.mini.nojunkUntil = 0;
        engine.mini.nojunkGood = 0;
        emit('hha:celebrate', { kind:'mini', title:'✅ NO-JUNK BURST!' });
        grantShield();
      }
    }
  }

  function miniStartNoJunkWindow(){
    engine.mini.nojunkUntil = now() + 6500;
    engine.mini.nojunkGood = 0;
    emit('hha:judge', { kind:'boss', text:'NO-JUNK BURST!' });
  }

  // ---------- Hit logic ----------
  function hitTarget(el){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    let type = String(el.dataset.type||'').toLowerCase();

    if (type === 'boss'){ hitBoss(el); return; }

    // good but wrong group => wrong
    if (type === 'good'){
      const gid = Number(el.dataset.groupId)||0;
      if (gid && gid !== engine.groupId) type = 'wrong';
    }

    // Ring rule: GOOD must be inside ring
    if (type === 'good' && engine.ring){
      const x = Number(el.dataset._x)||0;
      const y = Number(el.dataset._y)||0;
      if (!ringContainsXY(x,y)){
        type = 'wrong';
        emit('hha:judge', { kind:'bad', text:'OUT OF RING!' });
      }
    }

    engine.hitAll++;

    // STAR
    if (type === 'star'){
      emitProgress({ type:'hit', correct:true }); // audio
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      emitProgress({ kind:'combo', combo: engine.combo });

      let addScore = 180;
      if (engine.runMode==='play' && isPerfectTiming()){
        addScore += 40;
        DOC.body.classList.add('groups-perfect');
        setTimeout(()=> DOC.body.classList.remove('groups-perfect'), 160);
        emit('hha:judge', { kind:'good', text:'PERFECT TIMING!' });
      }

      engine.score += Math.round(addScore * scoreMult());
      updateScore();

      grantOverdrive(7);
      grantShield();
      grantMagnet(5);

      emit('hha:celebrate', { kind:'mini', title:'⭐ OVERDRIVE!' });
      removeTarget(el);

      // occasionally start nojunk burst after star
      if (engine.runMode==='play' && engine.rng() < 0.42) miniStartNoJunkWindow();
      return;
    }

    // ICE
    if (type === 'ice'){
      emitProgress({ type:'hit', correct:true }); // audio
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      emitProgress({ kind:'combo', combo: engine.combo });

      let addScore = 120;
      if (engine.runMode==='play' && isPerfectTiming()){
        addScore += 30;
        DOC.body.classList.add('groups-perfect');
        setTimeout(()=> DOC.body.classList.remove('groups-perfect'), 160);
        emit('hha:judge', { kind:'good', text:'PERFECT TIMING!' });
      }

      engine.score += Math.round(addScore * scoreMult());
      engine.fever = clamp(engine.fever - 10, 0, 100);
      emitFever();
      updateScore();

      grantFreeze(6);
      emit('hha:celebrate', { kind:'mini', title:'❄️ FREEZE!' });
      removeTarget(el);
      return;
    }

    // GOOD
    if (type === 'good'){
      emitProgress({ type:'hit', correct:true });  // audio
      emitProgress({ kind:'hit_good' });           // quest
      engine.hitGood++;

      // rhythm bonus
      const perfect = (engine.runMode==='play' && isPerfectTiming());
      if (perfect){
        DOC.body.classList.add('groups-perfect');
        setTimeout(()=> DOC.body.classList.remove('groups-perfect'), 160);
        emit('hha:judge', { kind:'good', text:'PERFECT!' });
      }

      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      emitProgress({ kind:'combo', combo: engine.combo });

      // combo reward -> shield every 12 (first time only)
      if (engine.combo >= 12 && engine.shield === 0) grantShield();

      const base = 100 + engine.combo*3 + (perfect ? 18 : 0);
      engine.score += Math.round(base * scoreMult());

      engine.fever = clamp(engine.fever - (perfect ? 4 : 3), 0, 100);

      updateScore();
      emitFever();

      // sync power
      addPower(1);

      // engine mini
      miniOnGood();

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
        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        removeTarget(el);
        return;
      }

      emitProgress({ type:'hit', correct:false }); // audio
      emitProgress({ kind:'hit_bad' });            // quest

      engine.misses++;
      engine.combo = 0;
      engine.groupClean = false;

      const add = (type==='junk' ? 18 : 12) + (engine.ring ? 4 : 0);
      engine.fever = clamp(engine.fever + add, 0, 100);
      emitFever();

      emit('hha:judge', { kind:'bad', text:(type==='junk'?'JUNK!':'WRONG!') });

      // break engine-mini windows
      engine.mini.streak = 0;
      engine.mini.streakUntil = 0;
      if (engine.mini.nojunkUntil) engine.mini.nojunkUntil = 0;

      updateScore();
      removeTarget(el);
      return;
    }
  }

  // ---------- Spawn decision ----------
  function chooseType(){
    const dp = diffParams(engine.diff);
    const baseJ = (engine.runMode==='research') ? dp.junk : engine.adapt.junkBias;
    const baseD = (engine.runMode==='research') ? dp.decoy : engine.adapt.decoyBias;

    // powerup chance
    const pu = engine.storm ? 0.018 : (engine.runMode==='play' ? 0.014 : 0.010);
    if (engine.rng() < pu) return (engine.rng() < 0.52) ? 'star' : 'ice';

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

  function spawnOne(){
    if (!engine.running || engine.ended) return;
    const layer = engine.layerEl;
    if (!layer) return;

    tryBossSpawn();

    const tp = chooseType();
    const em = chooseEmoji(tp);

    let p;
    if (engine.storm) p = stormPos();
    else if (engine.ring && engine.rng() < 0.70) p = ringPos();
    else p = randPos();

    const s = engine.sizeBase * (tp==='star'||tp==='ice' ? 1.02 : 1.0);

    const el = makeTarget(tp, em, p.x, p.y, s);
    if (el) layer.appendChild(el);
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;
    spawnOne();

    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;
    let sMs = Math.max(420, base.spawnMs * (engine.storm ? 0.82 : 1.0));

    // freeze slows spawn
    if (now() < engine.freezeUntil) sMs = sMs * 1.18;

    engine.spawnTimer = root.setTimeout(loopSpawn, sMs);
  }

  // ---------- Magnet pull ----------
  function magnetTick(){
    if (now() >= engine.magnetUntil) return;
    const layer = engine.layerEl;
    if (!layer) return;

    const r = safeSpawnRect();
    const cx = (r.x0 + r.x1) * 0.5;
    const cy = (r.y0 + r.y1) * 0.5;

    const list = layer.querySelectorAll('.fg-target[data-type="good"]');
    const k = 0.065;
    list.forEach(el=>{
      const x = Number(el.dataset._x)||0;
      const y = Number(el.dataset._y)||0;
      if (!x || !y) return;

      const nx = x + (cx - x) * k;
      const ny = y + (cy - y) * k;
      setXY(el, nx, ny);
    });
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

    // rhythm
    rhythmTick();

    // ring timing (play only)
    if (engine.runMode==='play'){
      if (!engine.ring && now() >= engine.nextRingAtMs) enterRing();
      if (engine.ring){
        const dp = diffParams(engine.diff);
        const leftMs = engine.ringUntilMs - now();
        const frac = clamp(leftMs / (dp.ringDur*1000), 0, 1);
        engine.ringR = clamp(engine.ringRBase * (0.72 + frac*0.28), 70, engine.ringRBase);
        setRingCSS(true);
        if (leftMs <= 2600) DOC.body.classList.add('groups-mini-urgent');
        if (leftMs <= 0) exitRing();
      }
    }

    // storm timing
    if (!engine.storm && now() >= engine.nextStormAtMs) enterStorm();
    if (engine.storm && now() >= engine.stormUntilMs){
      exitStorm();
      engine.nextStormAtMs = now() + (16000 + engine.rng()*12000);
    } else if (engine.storm){
      const leftMs = engine.stormUntilMs - now();
      if (leftMs <= 3200) DOC.body.classList.add('groups-storm-urgent');
    }

    // boss warp end
    if (engine.bossRage && now() >= engine.bossWarpUntil){
      engine.bossRage = false;
      try{ clearInterval(engine.bossWarpTimer); }catch{}
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

    // magnet pull tick
    magnetTick();

    feverTick();

    // time
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
    try{ clearInterval(engine.bossWarpTimer); }catch{}
    clearAllTargets();
    questStop();

    exitRing();
    DOC.body.classList.remove(
      'groups-storm','groups-storm-urgent',
      'groups-overdrive','groups-freeze','groups-magnet',
      'groups-beat','groups-perfect','groups-ring','groups-mini-urgent'
    );

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
    engine.bossRage = false;
    engine.bossWarpUntil = 0;
    try{ clearInterval(engine.bossWarpTimer); }catch{}

    engine.groupId = 1;
    engine.groupClean = true;

    engine.fever = 0;
    engine.shield = 0;
    engine.feverTickLast = 0;

    engine.magnetUntil = 0;
    engine.freezeUntil = 0;
    engine.overUntil = 0;

    // ring schedule
    engine.ring = false;
    engine.ringUntilMs = 0;
    engine.nextRingAtMs = (engine.runMode==='play') ? (now() + (14000 + engine.rng()*9000)) : (now() + 999999);
    engine.ringRBase = dp.ringR;
    engine.ringR = dp.ringR;
    engine.ringCx = 0; engine.ringCy = 0;

    // rhythm
    initRhythm(dp);

    // mini challenge reset
    engine.mini.streakNeed = (engine.diff==='hard') ? 12 : (engine.diff==='easy' ? 9 : 10);
    engine.mini.streak = 0;
    engine.mini.streakUntil = 0;
    engine.mini.ringHits = 0;
    engine.mini.ringNeed = (engine.diff==='hard') ? 7 : 6;
    engine.mini.nojunkUntil = 0;
    engine.mini.nojunkNeed = (engine.diff==='hard') ? 8 : 7;
    engine.mini.nojunkGood = 0;

    engine.vx = 0; engine.vy = 0;
    applyView();

    updateTime();
    updatePower();
    updateScore();
    emitFever();

    emitCoach(SONG_ALL[0], 'neutral');
    emit('groups:lyric', { groupId:1, line: SONG_ALL[0] });

    questStart();

    emit('hha:celebrate', { kind:'goal', title:'เริ่มเกม! 🎵' });

    loopSpawn();
    loopTick();
  }

  function stop(reason){ endGame(reason || 'stop'); }

  NS.GameEngine = { start, stop, setLayerEl };

})(typeof window !== 'undefined' ? window : globalThis);