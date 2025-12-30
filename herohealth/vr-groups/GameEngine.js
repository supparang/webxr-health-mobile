/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (CONNECTED to groups-quests.js + audio.js)
✅ Cardboard:
   - Crosshair aim (center)
   - Manual trigger: tap anywhere / Space / Enter
   - Auto fire on dwell (hold aim)
✅ Adds .aim class to targeted sticker
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
    overUntil:0,

    // timers
    spawnTimer:0,
    tickTimer:0,

    // quest
    quest:null,
    _questBound:false,

    // ✅ Cardboard aim
    cardboard:false,
    aimPx:140,
    dwellMs:420,
    _aimEl:null,
    _aimSince:0,
    _aimLockUntil:0,
    _aimRaf:0,
    _aimBound:false
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
  function updateTime(){ emit('hha:time', { left: Math.ceil(engine.left)|0 }); }
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

      // ✅ Cardboard: ปิด drag เพื่อไม่ชนกับ “แตะยิง”
      if (!engine.cardboard){
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
      }

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

  // ---------- Spawn rect ----------
  function safeSpawnRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    const top = 160, bot = 190, side = 16;
    return { x0:side, x1:W-side, y0:top, y1:H-bot, W, H };
  }

  // ---------- DOM target ----------
  function setXY(el, x, y){
    el.style.setProperty('--x', x.toFixed(1)+'px');
    el.style.setProperty('--y', y.toFixed(1)+'px');
  }

  function randPos(){
    const r = safeSpawnRect();
    const x = r.x0 + engine.rng()*(r.x1 - r.x0);
    const y = r.y0 + engine.rng()*(r.y1 - r.y0);
    return { x, y };
  }

  function removeTarget(el){
    if (!el) return;
    try{ root.clearTimeout(el._ttlTimer); }catch{}
    el.classList.add('hit');
    root.setTimeout(()=> el.remove(), 220);
  }

  function applyTypeClass(el, type){
    el.classList.remove('fg-good','fg-wrong','fg-decoy','fg-junk','fg-boss');
    if (type==='good')  el.classList.add('fg-good');
    if (type==='wrong') el.classList.add('fg-wrong');
    if (type==='decoy') el.classList.add('fg-decoy');
    if (type==='junk')  el.classList.add('fg-junk');
    if (type==='boss')  el.classList.add('fg-boss');
  }

  function makeTarget(type, emoji, x, y, s){
    const layer = engine.layerEl;
    if (!layer) return null;

    const el = DOC.createElement('div');
    el.className = 'fg-target spawn';
    el.dataset.emoji = emoji || '✨';
    el.dataset.type = type;

    applyTypeClass(el, type);

    if (type === 'good') el.dataset.groupId = String(engine.groupId);
    if (type === 'wrong') el.dataset.groupId = String(((engine.rng()*5)|0)+1);

    setXY(el, x, y);
    el.style.setProperty('--s', s.toFixed(3));

    // แตะเป้าโดยตรง (PC/Mobile ปกติ)
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

  // ---------- Game mechanics ----------
  function setGroup(id){
    engine.groupId = id;
    engine.groupClean = true;
    emitCoach(SONG[id] || `ต่อไป หมู่ ${id}!`, 'happy');
  }

  function switchGroup(){
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

  // ---------- Boss ----------
  function tryBossSpawn(){
    if (engine.bossAlive) return;
    if (now() < engine.nextBossAtMs) return;

    engine.bossAlive = true;
    engine.bossHp = engine.bossHpMax;

    const p = randPos();
    const s = 1.25 * engine.sizeBase;

    const el = makeTarget('boss','👑',p.x,p.y,s);
    if (!el) return;

    el.dataset.hp = String(engine.bossHp);
    engine.layerEl.appendChild(el);

    emitProgress({ kind:'boss_spawn' });
    emit('hha:judge', { kind:'boss', text:'BOSS!' });

    engine.nextBossAtMs = now() + (engine.runMode==='research' ? 20000 : 18000);
  }

  function hitBoss(el){
    emitProgress({ type:'hit', correct:true });

    engine.hitAll++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

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

  // ---------- Hit logic ----------
  function hitTarget(el){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    let type = String(el.dataset.type||'').toLowerCase();

    if (type === 'boss'){ hitBoss(el); return; }

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

      engine.score += Math.round((100 + engine.combo*3) * scoreMult());
      engine.fever = clamp(engine.fever - 3, 0, 100);

      updateScore();
      emitFever();

      addPower(1);
      removeTarget(el);
      return;
    }

    // wrong/decoy/junk
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
  }

  // ---------- Spawn decision ----------
  function chooseType(){
    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;
    const baseJ = (engine.runMode==='research') ? base.junk : base.junkBias;
    const baseD = (engine.runMode==='research') ? base.decoy : base.decoyBias;

    const r = engine.rng();
    if (r < baseJ) return 'junk';
    if (r < baseJ + baseD) return 'decoy';
    if (engine.rng() < 0.14) return 'wrong';
    return 'good';
  }

  function chooseEmoji(tp){
    if (tp === 'junk') return JUNK_EMOJI[(engine.rng()*JUNK_EMOJI.length)|0];
    if (tp === 'decoy') return DECOY_EMOJI[(engine.rng()*DECOY_EMOJI.length)|0];
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
    const p = randPos();
    const s = engine.sizeBase;

    const el = makeTarget(tp, em, p.x, p.y, s);
    if (el) layer.appendChild(el);
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;
    spawnOne();

    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;
    const sMs = Math.max(420, base.spawnMs);
    engine.spawnTimer = root.setTimeout(loopSpawn, sMs);
  }

  // ---------- ✅ Cardboard Aim System ----------
  function setAimEl(el){
    if (engine._aimEl === el) return;

    try{ engine._aimEl && engine._aimEl.classList.remove('aim'); }catch{}
    engine._aimEl = el || null;
    engine._aimSince = now();

    if (engine._aimEl){
      try{ engine._aimEl.classList.add('aim'); }catch{}
    }
  }

  function pickAim(){
    const layer = engine.layerEl;
    if (!layer) return null;
    const list = layer.querySelectorAll('.fg-target');
    if (!list || list.length === 0) return null;

    const cx = (root.innerWidth || 360) * 0.5;
    const cy = (root.innerHeight || 640) * 0.5;
    const R2 = engine.aimPx * engine.aimPx;

    let best = null;
    let bestD2 = 1e18;

    for (let i=0; i<list.length; i++){
      const el = list[i];
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width*0.5;
      const ey = r.top  + r.height*0.5;
      const dx = ex - cx;
      const dy = ey - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2){
        bestD2 = d2;
        best = el;
      }
    }

    if (best && bestD2 <= R2) return best;
    return null;
  }

  function triggerAim(){
    if (!engine.cardboard) return;
    if (!engine.running || engine.ended) return;
    if (now() < engine._aimLockUntil) return;

    const el = engine._aimEl;
    if (!el || !el.isConnected) return;

    engine._aimLockUntil = now() + 160;
    hitTarget(el);
  }

  function aimLoop(){
    if (!engine.running || engine.ended || !engine.cardboard){
      engine._aimRaf = 0;
      return;
    }

    const picked = pickAim();
    setAimEl(picked);

    // ✅ dwell auto-fire
    if (engine._aimEl && engine.dwellMs > 0){
      const held = now() - engine._aimSince;
      if (held >= engine.dwellMs){
        engine._aimSince = now() + 120;
        triggerAim();
      }
    }

    engine._aimRaf = root.requestAnimationFrame(aimLoop);
  }

  function bindAimControls(){
    if (engine._aimBound) return;
    engine._aimBound = true;

    // Space/Enter ยิง
    root.addEventListener('keydown', (e)=>{
      if (!engine.cardboard) return;
      if (!engine.running || engine.ended) return;
      const k = String(e.key||'').toLowerCase();
      if (k === ' ' || k === 'spacebar' || k === 'enter'){
        e.preventDefault?.();
        triggerAim();
      }
    }, { passive:false });

    // แตะจอที่ไหนก็ยิง (Cardboard)
    DOC.addEventListener('pointerup', (e)=>{
      if (!engine.cardboard) return;
      if (!engine.running || engine.ended) return;

      const t = e.target;
      if (t && (t.closest && (t.closest('.overlay') || t.closest('button')))) return;

      triggerAim();
    }, { passive:true });
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
    try{ engine._aimRaf && root.cancelAnimationFrame(engine._aimRaf); }catch{}
    engine._aimRaf = 0;

    setAimEl(null);

    clearAllTargets();
    questStop();

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
  function setLayerEl(el){
    engine.layerEl = el || null;
    applyView();
    setupView();
  }

  function start(diff, cfg){
    cfg = cfg || {};
    engine.runMode = (String(cfg.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    engine.diff = String(diff || cfg.diff || 'normal').toLowerCase();
    engine.style = styleNorm(cfg.style || 'mix');
    engine.timeSec = clamp(cfg.time ?? 90, 30, 180);
    engine.seed = String(cfg.seed || Date.now());
    engine.rng = makeRng(engine.seed);

    // ✅ cardboard config
    engine.cardboard = !!cfg.cardboard;
    engine.aimPx = clamp(cfg.aimPx ?? 140, 70, 260);
    engine.dwellMs = clamp(cfg.dwellMs ?? 420, 0, 1200);
    engine._aimLockUntil = 0;

    if (engine.cardboard) DOC.body.classList.add('cardboard');
    else DOC.body.classList.remove('cardboard');

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

    engine.groupId = 1;
    engine.groupClean = true;

    engine.fever = 0;
    engine.shield = 0;
    engine.feverTickLast = 0;

    engine.vx = 0; engine.vy = 0;
    applyView();

    updateTime();
    updatePower();
    updateScore();
    emitFever();
    emitCoach(SONG[1], 'neutral');

    questStart();

    // ✅ start cardboard aim
    if (engine.cardboard){
      bindAimControls();
      setAimEl(null);
      try{ engine._aimRaf && root.cancelAnimationFrame(engine._aimRaf); }catch{}
      engine._aimRaf = root.requestAnimationFrame(aimLoop);
    }

    loopSpawn();
    loopTick();
  }

  function stop(reason){ endGame(reason || 'stop'); }

  NS.GameEngine = { start, stop, setLayerEl };

})(typeof window !== 'undefined' ? window : globalThis);