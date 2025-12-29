/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (PRODUCTION + BOSS PHASE + REAL NO-JUNK MINI)
✅ Boss phases:
   - Phase 1: normal
   - Phase 2: weak (<=50% HP) -> glow + harder vibe
   - Phase 3: rage (HP==1) -> teleport + decoy burst + faster spawn
✅ No-Junk Ring Mini Quest (real):
   - "เก็บ GOOD ในวงให้ครบ N ภายใน T วินาที"
   - FAIL ทันทีถ้าโดน junk/decoy/wrong ระหว่างทำ (ยกเว้น shield block junk)
   - tick ๆ + กระพริบ + สั่นเบา ๆ ตอนใกล้หมดเวลา
✅ FIX: ใส่ class ตาม type (fg-good/fg-junk/fg-decoy/fg-wrong/fg-boss/fg-star/fg-ice)
✅ ⭐ Star: Overdrive x2 + Magnet + No-Junk Aura + Shield
✅ ❄️ Ice: Freeze (spawn ช้าลง + TTL ยาวขึ้น)
✅ Rush 6s หลังสลับหมู่
✅ Metrics + RT ส่งใน hha:end
✅ Safe spawn rect กันทับ HUD: อ่าน DOM ของ .hud-top จริง
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
  function pulseBody(cls, ms){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=> DOC.body.classList.remove(cls), Math.max(80, ms|0));
    }catch{}
  }
  function median(arr){
    if (!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = (a.length/2)|0;
    return (a.length%2) ? a[m] : Math.round((a[m-1]+a[m])/2);
  }
  function playSfx(name){
    try{ root.GroupsVRAudio && root.GroupsVRAudio[name] && root.GroupsVRAudio[name](); }catch{}
  }

  // ---------- เพลงอาหารหลัก 5 หมู่ (ตามที่ให้มา) ----------
  const SONG = {
    intro: 'อาหารหลัก 5 หมู่ของไทย ทุกคนจำไว้อย่าได้แปลผัน 🎶',
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

    // spawn/hit metrics
    nTargetGoodSpawned:0,
    nTargetJunkSpawned:0,
    nTargetDecoySpawned:0,
    nTargetWrongSpawned:0,
    nTargetStarSpawned:0,
    nTargetIceSpawned:0,
    nTargetBossSpawned:0,

    nHitGood:0,
    nHitJunk:0,
    nHitDecoy:0,
    nHitWrong:0,
    nHitStar:0,
    nHitIce:0,
    nHitBoss:0,
    nHitJunkGuard:0,
    nExpireGood:0,

    rtGoodList:[],

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
    _bossEl:null,

    // buffs
    magnetUntil:0,
    freezeUntil:0,
    overUntil:0,
    noJunkUntil:0,
    _rushUntil:0,

    // No-Junk ring
    ring:{ on:false, cx:0, cy:0, r:0 },

    // REAL Mini Quest: No-Junk Zone
    mini:{
      active:false,
      kind:'',
      need:0,
      got:0,
      startedAt:0,
      endAt:0,
      failed:false,
      failReason:'',
      lastTickSec:-1
    },

    // timers
    spawnTimer:0,
    tickTimer:0
  };

  function scoreMult(){ return (now() < engine.overUntil) ? 2 : 1; }
  function isRush(){ return now() < engine._rushUntil; }
  function isFreeze(){ return now() < engine.freezeUntil; }
  function isMagnet(){ return now() < engine.magnetUntil; }
  function isNoJunkAura(){ return now() < engine.noJunkUntil; }

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

  // ---------- Safe spawn rect (อ่าน .hud-top จริง) ----------
  function safeSpawnRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;

    let side = 16;
    let top  = 160;
    let bot  = 190;

    const hudTop = DOC.querySelector('.hud-top');
    if (hudTop && hudTop.getBoundingClientRect){
      const r = hudTop.getBoundingClientRect();
      if (r && isFinite(r.bottom)) top = Math.max(top, r.bottom + 14);
    }

    top = clamp(top, 80, H-220);
    bot = clamp(bot, 120, H-120);

    const y0 = top;
    const y1 = Math.max(y0 + 160, H - bot);
    const x0 = side;
    const x1 = Math.max(x0 + 160, W - side);

    return { x0, x1, y0, y1, W, H };
  }

  // ---------- Ring ----------
  function ringApply(on){
    const layer = engine.layerEl;
    if (!layer) return;
    if (!on){
      layer.style.setProperty('--nojunk-on', '0');
      engine.ring.on = false;
      return;
    }
    engine.ring.on = true;
    layer.style.setProperty('--nojunk-on', '1');
    layer.style.setProperty('--nojunk-cx', engine.ring.cx.toFixed(1)+'px');
    layer.style.setProperty('--nojunk-cy', engine.ring.cy.toFixed(1)+'px');
    layer.style.setProperty('--nojunk-r',  engine.ring.r.toFixed(1)+'px');
  }

  function ringPick(){
    const r = safeSpawnRect();
    const cx = r.W * (0.50 + (engine.rng()-0.5)*0.12);
    const cy = (r.y0 + r.y1) * (0.50 + (engine.rng()-0.5)*0.12);
    const rad = Math.min(r.W, (r.y1-r.y0)) * 0.22;

    engine.ring.cx = cx;
    engine.ring.cy = cy;
    engine.ring.r  = rad;
    ringApply(true);
  }

  function inRing(x, y){
    if (!engine.ring.on) return false;
    const dx = x - engine.ring.cx;
    const dy = y - engine.ring.cy;
    return (dx*dx + dy*dy) <= (engine.ring.r*engine.ring.r);
  }

  function randPos(){
    const r = safeSpawnRect();
    const x = r.x0 + engine.rng()*(r.x1 - r.x0);
    const y = r.y0 + engine.rng()*(r.y1 - r.y0);
    return { x, y };
  }

  function randPosInRing(){
    const r = safeSpawnRect();
    let tries = 0;
    while (tries++ < 22){
      const a = engine.rng() * Math.PI * 2;
      const rr = Math.sqrt(engine.rng()) * engine.ring.r * 0.92;
      const x = engine.ring.cx + Math.cos(a)*rr;
      const y = engine.ring.cy + Math.sin(a)*rr;
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return { x, y };
    }
    return randPos();
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

  function typeClass(type){
    switch(String(type||'').toLowerCase()){
      case 'good': return 'fg-good';
      case 'junk': return 'fg-junk';
      case 'decoy':return 'fg-decoy';
      case 'wrong':return 'fg-wrong';
      case 'boss': return 'fg-boss';
      case 'star': return 'fg-star';
      case 'ice':  return 'fg-ice';
      default: return '';
    }
  }

  function countSpawn(type){
    switch(type){
      case 'good': engine.nTargetGoodSpawned++; break;
      case 'junk': engine.nTargetJunkSpawned++; break;
      case 'decoy':engine.nTargetDecoySpawned++; break;
      case 'wrong':engine.nTargetWrongSpawned++; break;
      case 'star': engine.nTargetStarSpawned++; break;
      case 'ice':  engine.nTargetIceSpawned++; break;
      case 'boss': engine.nTargetBossSpawned++; break;
    }
  }

  function makeTarget(type, emoji, x, y, s){
    const layer = engine.layerEl;
    if (!layer) return null;

    const el = DOC.createElement('div');
    el.className = 'fg-target spawn ' + typeClass(type);
    el.dataset.emoji = emoji || '✨';
    el.dataset.type = type;
    el._spawnAt = now();

    if (type === 'good') el.dataset.groupId = String(engine.groupId);

    setXY(el, x, y);
    el.style.setProperty('--s', s.toFixed(3));
    el.dataset.inRing = inRing(x, y) ? '1' : '0';

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el);
    }, { passive:false });

    const ttl = (type === 'boss') ? 9000 : engine.ttlMs;
    el._ttlTimer = root.setTimeout(()=>{
      if (!el.isConnected) return;

      if (type === 'boss'){
        engine.bossAlive = false;
        engine._bossEl = null;
        el.classList.add('out');
        root.setTimeout(()=> el.remove(), 220);
        engine.nextBossAtMs = now() + 9000 + engine.rng()*7000;
        return;
      }

      if (type === 'good'){
        engine.nExpireGood++;
        engine.misses++;
        engine.combo = 0;
        engine.groupClean = false;
        engine.fever = clamp(engine.fever + 10, 0, 100);
        emit('hha:judge', { kind:'MISS' });
        pulseBody('groups-hitshake', 180);
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

  function perfectSwitchBonus(){
    if (!engine.groupClean) return;
    emitProgress({ kind:'perfect_switch' });
    emit('hha:celebrate', { kind:'mini', title:'Perfect Switch!' });
  }

  function addPower(n){
    engine.power = clamp(engine.power + (n|0), 0, engine.powerThr);
    updatePower();
    if (engine.power >= engine.powerThr) switchGroup();
  }

  function maybeStartNoJunkMini(trigger){
    if (engine.mini.active) return;
    if (engine.runMode === 'research') return;

    const p = (trigger === 'swap') ? 0.35 : 0.10;
    if (engine.rng() > p) return;

    const diff = String(engine.diff||'normal');
    const need = (diff==='easy') ? 4 : (diff==='hard') ? 6 : 5;
    const dur  = (diff==='hard') ? 6 : 6;
    startNoJunkMini(need, dur);
  }

  function startNoJunkMini(needGood, durSec){
    engine.mini.active = true;
    engine.mini.kind = 'nojunk_zone';
    engine.mini.need = Math.max(3, needGood|0);
    engine.mini.got = 0;
    engine.mini.startedAt = now();
    engine.mini.endAt = now() + Math.max(4, durSec|0) * 1000;
    engine.mini.failed = false;
    engine.mini.failReason = '';
    engine.mini.lastTickSec = -1;

    ringPick();
    engine.noJunkUntil = engine.mini.endAt;

    emit('hha:judge', { kind:'mini', text:'NO-JUNK ZONE!' });
    emit('hha:celebrate', { kind:'mini', title:'🛡️ No-Junk Zone!' });
    emitCoach(`Mini: เก็บ GOOD ในวงให้ครบ ${engine.mini.need} ภายใน ${Math.round((engine.mini.endAt-now())/1000)} วิ\n❌ ห้ามโดนขยะ/ผิดหมู่`, 'neutral');

    updateMiniUI(true);
  }

  function endNoJunkMini(success, reason){
    if (!engine.mini.active) return;
    engine.mini.active = false;
    engine.mini.failed = !success;
    engine.mini.failReason = String(reason||'');

    updateMiniUI(false);
    ringApply(false);

    DOC.body.classList.remove('groups-mini-urgent');
    DOC.body.classList.remove('groups-mini-active');

    if (success){
      emit('hha:celebrate', { kind:'goal', title:'Mini Complete!' });
      emit('hha:judge', { kind:'good', text:'MINI CLEAR!' });
      emitCoach('เยี่ยมมาก! ผ่าน No-Junk Zone! 😎', 'happy');

      engine.shield = Math.max(engine.shield, 1);
      engine.fever = clamp(engine.fever - 10, 0, 100);
      engine.score += Math.round(220 * scoreMult());
      updateScore();
      emitFever();
      playSfx('ding');
    } else {
      emit('hha:judge', { kind:'bad', text:'MINI FAIL!' });
      emitCoach('โอ๊ะ! โดนขยะ/ผิดหมู่ ระหว่างทำ Mini 😵 ลองใหม่รอบหน้า!', 'sad');
      pulseBody('groups-mini-fail', 420);
      playSfx('fail');
    }
  }

  function updateMiniUI(active){
    const total = engine.mini.need || 1;
    const got = engine.mini.got || 0;
    const pct = clamp((got/total)*100, 0, 100);
    const leftSec = Math.max(0, Math.ceil((engine.mini.endAt - now())/1000));

    if (active){
      DOC.body.classList.add('groups-mini-active');
      emit('quest:update', {
        miniTitle: `No-Junk Zone: เก็บ ${total} ในวง (ห้ามโดนขยะ)`,
        miniNow: got,
        miniTotal: total,
        miniPct: pct,
        miniTimeLeftSec: leftSec
      });
    } else {
      emit('quest:update', {
        miniTitle: '—',
        miniNow: 0,
        miniTotal: 1,
        miniPct: 0,
        miniTimeLeftSec: 0
      });
    }
  }

  function switchGroup(){
    perfectSwitchBonus();
    const next = (engine.groupId % 5) + 1;
    setGroup(next);

    emitProgress({ kind:'group_swap' });
    engine._rushUntil = now() + 6000;

    engine.power = 0;
    updatePower();

    emit('hha:judge', { kind:'good', text:'RUSH!' });
    pulseBody('groups-rush', 900);

    maybeStartNoJunkMini('swap');
  }

  // ---------- Buffs ----------
  function activateOverdrive(sec){
    engine.overUntil = now() + sec*1000;
    DOC.body.classList.add('groups-overdrive');
    setTimeout(()=> DOC.body.classList.remove('groups-overdrive'), sec*1000 + 20);
  }
  function activateFreeze(sec){
    engine.freezeUntil = now() + sec*1000;
    DOC.body.classList.add('groups-freeze');
    setTimeout(()=> DOC.body.classList.remove('groups-freeze'), sec*1000 + 20);
  }
  function activateMagnet(sec){
    engine.magnetUntil = now() + sec*1000;
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
    playSfx('roar');
  }

  function exitStorm(){
    engine.storm = false;
    engine.stormUntilMs = 0;
    DOC.body.classList.remove('groups-storm','groups-storm-urgent');
    emit('groups:storm', { on:false, durSec: 0 });
    emitProgress({ kind:'storm_off' });
  }

  // ---------- Boss phases ----------
  function bossPhase(){
    if (!engine.bossHpMax) return 1;
    const hp = engine.bossHp;
    const max = engine.bossHpMax;
    if (hp <= 1) return 3;
    if (hp <= Math.ceil(max/2)) return 2;
    return 1;
  }

  function bossApplyPhase(el){
    if (!el) return;
    el.classList.remove('fg-boss-weak','fg-boss-rage');
    const ph = bossPhase();
    if (ph >= 2) el.classList.add('fg-boss-weak');
    if (ph >= 3) el.classList.add('fg-boss-rage');
  }

  function bossTeleport(el){
    if (!el || !el.isConnected) return;
    const p = (engine.storm ? stormPos() : randPos());
    setXY(el, p.x, p.y);
    el.dataset.inRing = inRing(p.x,p.y) ? '1' : '0';
    el.classList.add('fg-tele');
    setTimeout(()=> el.classList.remove('fg-tele'), 220);
  }

  function spawnDecoyBurst(n){
    const layer = engine.layerEl;
    if (!layer) return;
    for (let i=0;i<n;i++){
      const p = randPos();
      const em = DECOY_EMOJI[(engine.rng()*DECOY_EMOJI.length)|0];
      const el = makeTarget('decoy', em, p.x, p.y, engine.sizeBase*0.95);
      if (el){ countSpawn('decoy'); layer.appendChild(el); }
    }
  }

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
    engine.layerEl.appendChild(el);

    engine._bossEl = el;
    bossApplyPhase(el);

    emitProgress({ kind:'boss_spawn' });
    emit('hha:judge', { kind:'boss', text:'BOSS!' });
    emitCoach('บอสมาแล้ว! โจมตีให้หมด HP! 👑', 'neutral');
    playSfx('roar');

    const baseEvery = (engine.runMode==='research') ? 20000 : clamp(engine.adapt.bossEvery, 14000, 26000);
    engine.nextBossAtMs = now() + (isRush() ? baseEvery*0.80 : baseEvery);
  }

  function hitBoss(el){
    emitProgress({ type:'hit', correct:true });

    engine.nHitBoss++;
    engine.hitAll++;

    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);
    emitProgress({ kind:'combo', combo: engine.combo });

    const ph = bossPhase();
    const baseScore = (ph===1) ? 140 : (ph===2) ? 170 : 220;
    engine.score += Math.round(baseScore * scoreMult());

    engine.bossHp = Math.max(0, engine.bossHp - 1);
    el.dataset.hp = String(engine.bossHp);

    bossApplyPhase(el);
    updateScore();

    if (engine.bossHp <= 0){
      engine.bossAlive = false;
      engine._bossEl = null;
      emitProgress({ kind:'boss_down' });
      emit('hha:celebrate', { kind:'goal', title:'BOSS DOWN!' });
      emitCoach('โค่นบอสแล้ว! สุดยอด! 🏆', 'happy');
      playSfx('ding');
      removeTarget(el);
      return;
    }

    el.classList.add('fg-boss-hurt');
    setTimeout(()=> el.classList.remove('fg-boss-hurt'), 220);

    if (bossPhase() === 2){
      pulseBody('groups-boss-weak', 240);
    } else if (bossPhase() === 3){
      pulseBody('groups-boss-rage', 260);
      playSfx('tick');
      spawnDecoyBurst(2);
      bossTeleport(el);
    }
  }

  // ---------- Magnet ----------
  function magnetPopNear(hitX, hitY){
    if (!isMagnet()) return;
    const layer = engine.layerEl;
    if (!layer) return;

    const list = layer.querySelectorAll('.fg-target.fg-good');
    let popped = 0;
    list.forEach(el=>{
      if (popped >= 2) return;
      if (!el.isConnected) return;
      const ex = Number(el.dataset._x)||0;
      const ey = Number(el.dataset._y)||0;
      const dx = ex - hitX;
      const dy = ey - hitY;
      const d2 = dx*dx + dy*dy;
      if (d2 < (120*120)){
        engine.hitAll++;
        engine.hitGood++;
        engine.nHitGood++;
        const rt = Math.max(0, Math.round(now() - (el._spawnAt||now())));
        engine.rtGoodList.push(rt);

        engine.combo = clamp(engine.combo + 1, 0, 9999);
        engine.comboMax = Math.max(engine.comboMax, engine.combo);
        emitProgress({ kind:'combo', combo: engine.combo });

        engine.score += Math.round(45 * scoreMult());
        engine.fever = clamp(engine.fever - 1, 0, 100);
        updateScore();
        emitFever();
        addPower(1);

        removeTarget(el);
        popped++;
      }
    });
  }

  function miniBadHitFail(tp){
    if (!engine.mini.active) return false;
    if (engine.mini.kind !== 'nojunk_zone') return false;
    if (tp === 'junk' || tp === 'decoy' || tp === 'wrong'){
      endNoJunkMini(false, 'hit_bad');
      return true;
    }
    return false;
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

    if (type === 'star'){
      emitProgress({ type:'hit', correct:true });
      emitProgress({ kind:'hit_good' });

      engine.nHitStar++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      emitProgress({ kind:'combo', combo: engine.combo });

      engine.score += Math.round(120 * scoreMult());
      engine.fever = clamp(engine.fever - 8, 0, 100);

      activateOverdrive(6);
      activateMagnet(6);
      engine.noJunkUntil = Math.max(engine.noJunkUntil, now() + 6000);

      engine.shield = Math.max(engine.shield, 1);
      emitFever();

      emit('hha:judge', { kind:'good', text:'STAR POWER!' });
      emit('hha:celebrate', { kind:'mini', title:'⭐ STAR POWER!' });
      pulseBody('groups-spark', 500);
      playSfx('ding');

      updateScore();
      removeTarget(el);
      return;
    }

    if (type === 'ice'){
      emitProgress({ type:'hit', correct:true });
      emitProgress({ kind:'hit_good' });

      engine.nHitIce++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      emitProgress({ kind:'combo', combo: engine.combo });

      engine.score += Math.round(90 * scoreMult());
      engine.fever = clamp(engine.fever - 6, 0, 100);

      activateFreeze(6);
      emitFever();

      emit('hha:judge', { kind:'good', text:'FREEZE!' });
      pulseBody('groups-iceflash', 420);
      playSfx('ding');

      updateScore();
      removeTarget(el);
      return;
    }

    const badLike = (type === 'junk' || type === 'wrong' || type === 'decoy');
    if (badLike){
      if (type === 'junk' && engine.shield > 0){
        engine.shield = 0;
        engine.nHitJunkGuard++;
        emitFever();
        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        pulseBody('groups-shield', 360);
        playSfx('ding');
        removeTarget(el);
        return;
      }

      if (miniBadHitFail(type)){
        removeTarget(el);
        return;
      }

      emitProgress({ type:'hit', correct:false });
      emitProgress({ kind:'hit_bad' });

      if (type === 'junk') engine.nHitJunk++;
      if (type === 'decoy') engine.nHitDecoy++;
      if (type === 'wrong') engine.nHitWrong++;

      engine.misses++;
      engine.combo = 0;
      engine.groupClean = false;

      engine.fever = clamp(engine.fever + (type==='junk'?18:12), 0, 100);
      emitFever();

      emit('hha:judge', { kind:'bad', text:(type==='junk'?'JUNK!':(type==='decoy'?'DECOY!':'WRONG!')) });
      pulseBody('groups-hitshake', 220);
      playSfx('fail');

      updateScore();
      removeTarget(el);
      return;
    }

    if (type === 'good'){
      emitProgress({ type:'hit', correct:true });
      emitProgress({ kind:'hit_good' });

      engine.hitGood++;
      engine.nHitGood++;

      const rt = Math.max(0, Math.round(now() - (el._spawnAt||now())));
      engine.rtGoodList.push(rt);

      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      emitProgress({ kind:'combo', combo: engine.combo });

      engine.score += Math.round((100 + engine.combo*3) * scoreMult());
      engine.fever = clamp(engine.fever - 3, 0, 100);

      updateScore();
      emitFever();

      addPower(1);

      if (engine.mini.active && engine.mini.kind === 'nojunk_zone'){
        const inZ = (el.dataset.inRing === '1');
        if (inZ){
          engine.mini.got++;
          updateMiniUI(true);
          playSfx('tick');

          if (engine.mini.got >= engine.mini.need){
            endNoJunkMini(true, 'done');
          }
        }
      }

      magnetPopNear(Number(el.dataset._x)||0, Number(el.dataset._y)||0);

      removeTarget(el);
      return;
    }
  }

  // ---------- Spawn decision ----------
  function chooseType(){
    const baseJ = (engine.runMode==='research') ? diffParams(engine.diff).junk : engine.adapt.junkBias;
    const baseD = (engine.runMode==='research') ? diffParams(engine.diff).decoy : engine.adapt.decoyBias;

    const pu = engine.storm ? 0.020 : 0.012;
    if (engine.rng() < pu) return (engine.rng() < 0.55) ? 'star' : 'ice';

    const jBias = isNoJunkAura() ? baseJ*0.45 : baseJ;
    const dBias = baseD;

    const r = engine.rng();
    if (r < jBias) return 'junk';
    if (r < jBias + dBias) return 'decoy';

    const wrongP = isNoJunkAura() ? (engine.storm ? 0.12 : 0.09) : (engine.storm ? 0.18 : 0.14);
    if (engine.rng() < wrongP) return 'wrong';
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

    if (engine.mini.active && engine.mini.kind === 'nojunk_zone'){
      DOC.body.classList.add('groups-mini-active');
      const goodBias = 0.78;
      const pickGood = engine.rng() < goodBias;

      const realTp = pickGood ? 'good' : chooseType();
      const finalTp = (realTp==='junk' || realTp==='decoy' || realTp==='wrong') ? realTp : 'good';
      const finalEm = chooseEmoji(finalTp);

      const p = pickGood ? randPosInRing() : (engine.storm ? stormPos() : randPos());
      const s = engine.sizeBase * ((finalTp==='star'||finalTp==='ice') ? 1.08 : 1.0);

      const el = makeTarget(finalTp, finalEm, p.x, p.y, s);
      if (el){ countSpawn(finalTp); layer.appendChild(el); }
      return;
    }

    const tp = chooseType();
    const em = chooseEmoji(tp);
    const p = engine.storm ? stormPos() : randPos();
    const s = engine.sizeBase * ((tp==='star'||tp==='ice') ? 1.08 : 1.0);

    const el = makeTarget(tp, em, p.x, p.y, s);
    if (el){ countSpawn(tp); layer.appendChild(el); }
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;
    spawnOne();

    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;

    let sMs = Math.max(420, base.spawnMs * (engine.storm ? 0.82 : 1.0));
    if (isRush())   sMs *= 0.80;
    if (isFreeze()) sMs *= 1.18;
    if (engine.mini.active && engine.mini.kind === 'nojunk_zone') sMs *= 0.88;
    if (engine.bossAlive && bossPhase() === 3) sMs *= 0.86;

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

  function tickMini(){
    if (!engine.mini.active) return;

    const leftSec = Math.max(0, Math.ceil((engine.mini.endAt - now())/1000));
    updateMiniUI(true);

    if (leftSec <= 3 && leftSec >= 1){
      DOC.body.classList.add('groups-mini-urgent');
      pulseBody('groups-mini-tremble', 220);
      if (engine.mini.lastTickSec !== leftSec){
        engine.mini.lastTickSec = leftSec;
        playSfx('tick');
      }
    } else {
      DOC.body.classList.remove('groups-mini-urgent');
    }

    if (now() >= engine.mini.endAt){
      if (engine.mini.got >= engine.mini.need) endNoJunkMini(true, 'done');
      else endNoJunkMini(false, 'timeout');
    }
  }

  function loopTick(){
    if (!engine.running || engine.ended) return;

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

    if (isFreeze()){
      engine.ttlMs = Math.max(engine.ttlMs, 1900);
    }

    feverTick();
    tickMini();

    if (!engine.mini.active && engine.runMode === 'play'){
      if (engine.rng() < 0.006) maybeStartNoJunkMini('random');
    }

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

    ringApply(false);
    DOC.body.classList.remove(
      'groups-storm','groups-storm-urgent','groups-overdrive','groups-freeze',
      'groups-mini-urgent','groups-mini-active'
    );

    const acc = engine.hitAll > 0 ? Math.round((engine.hitGood/engine.hitAll)*100) : 0;
    const grade = rankFromAcc(acc);

    const avgRt = engine.rtGoodList.length
      ? Math.round(engine.rtGoodList.reduce((a,b)=>a+b,0) / engine.rtGoodList.length)
      : 0;
    const medRt = median(engine.rtGoodList);

    const junkErr = engine.hitAll ? Math.round((engine.nHitJunk / engine.hitAll)*100) : 0;

    emit('hha:end', {
      reason: reason || 'end',
      scoreFinal: engine.score|0,
      comboMax: engine.comboMax|0,
      misses: engine.misses|0,
      accuracyGoodPct: acc|0,
      grade,

      nTargetGoodSpawned: engine.nTargetGoodSpawned|0,
      nTargetJunkSpawned: engine.nTargetJunkSpawned|0,
      nTargetDecoySpawned:engine.nTargetDecoySpawned|0,
      nTargetWrongSpawned:engine.nTargetWrongSpawned|0,
      nTargetStarSpawned: engine.nTargetStarSpawned|0,
      nTargetIceSpawned:  engine.nTargetIceSpawned|0,
      nTargetBossSpawned: engine.nTargetBossSpawned|0,

      nHitGood: engine.nHitGood|0,
      nHitJunk: engine.nHitJunk|0,
      nHitDecoy:engine.nHitDecoy|0,
      nHitWrong:engine.nHitWrong|0,
      nHitStar: engine.nHitStar|0,
      nHitIce:  engine.nHitIce|0,
      nHitBoss: engine.nHitBoss|0,
      nHitJunkGuard: engine.nHitJunkGuard|0,
      nExpireGood: engine.nExpireGood|0,

      junkErrorPct: junkErr|0,
      avgRtGoodMs: avgRt|0,
      medianRtGoodMs: medRt|0,

      miniKind: engine.mini.kind || '',
      miniNeed: engine.mini.need|0,
      miniGot: engine.mini.got|0,
      miniFailed: !!engine.mini.failed,
      miniFailReason: engine.mini.failReason || '',

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
    engine.misses = 0;
    engine.hitGood = 0; engine.hitAll = 0;

    engine.nTargetGoodSpawned=0; engine.nTargetJunkSpawned=0; engine.nTargetDecoySpawned=0;
    engine.nTargetWrongSpawned=0; engine.nTargetStarSpawned=0; engine.nTargetIceSpawned=0; engine.nTargetBossSpawned=0;
    engine.nHitGood=0; engine.nHitJunk=0; engine.nHitDecoy=0; engine.nHitWrong=0; engine.nHitStar=0; engine.nHitIce=0; engine.nHitBoss=0;
    engine.nHitJunkGuard=0; engine.nExpireGood=0;
    engine.rtGoodList = [];

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
    engine.bossHp = 0;
    engine._bossEl = null;
    engine.nextBossAtMs = now() + 14000;

    engine.groupId = 1;
    engine.groupClean = true;

    engine.fever = 0;
    engine.shield = 0;
    engine.feverTickLast = 0;

    engine.magnetUntil = 0;
    engine.freezeUntil = 0;
    engine.overUntil = 0;
    engine.noJunkUntil = 0;
    engine._rushUntil = 0;

    engine.ring = { on:false, cx:0, cy:0, r:0 };
    ringApply(false);

    engine.mini = { active:false, kind:'', need:0, got:0, startedAt:0, endAt:0, failed:false, failReason:'', lastTickSec:-1 };
    updateMiniUI(false);

    engine.vx = 0; engine.vy = 0;
    applyView();

    DOC.body.classList.remove('groups-mini-active','groups-mini-urgent');

    updateTime();
    updatePower();
    updateScore();
    emitFever();

    emitCoach(SONG.intro, 'neutral');
    setTimeout(()=>{ if (engine.running && !engine.ended) emitCoach(SONG[1], 'neutral'); }, 900);

    emit('hha:celebrate', { kind:'goal', title:'เริ่มเกม! 🎵' });
    playSfx('ding');

    loopSpawn();
    loopTick();
  }

  function stop(reason){ endGame(reason || 'stop'); }

  NS.GameEngine = { start, stop, setLayerEl };

})(typeof window !== 'undefined' ? window : globalThis);