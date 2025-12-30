/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine
✅ PACK X: No-Junk Zone (shrink + move) auto on forbid-junk mini
✅ PACK Y: Combo Rewards (15/25/35) => ⭐Shield / ❄Freeze / 💎Overdrive
✅ PACK Z: Rival Ghost (Decoy Boss) — หลอกเหมือนของดี + teleport
✅ PACK W: Group Remix — Perfect switch 2 รอบติด => สลับหมู่แบบโกงเวลา + power x2 ชั่วคราว

Events:
- hha:score, hha:time, hha:rank, hha:coach, hha:fever, hha:judge, hha:celebrate, hha:end
- groups:power, groups:storm, groups:zone, groups:remix
- groups:progress (ให้ quests/audio รับไปใช้ได้)
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
  function pick(arr, r){ return arr[(r()*arr.length)|0]; }

  // ---------- Lyrics (user provided) ----------
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
    if (diff === 'easy') return { spawnMs:900, ttl:1750, size:1.05, powerThr:thr, junk:0.10, decoy:0.08, stormDur:6, bossHp:3, ghost:0.010 };
    if (diff === 'hard') return { spawnMs:680, ttl:1450, size:0.92, powerThr:thr, junk:0.16, decoy:0.12, stormDur:7, bossHp:4, ghost:0.018 };
    return                 { spawnMs:780, ttl:1600, size:1.00, powerThr:thr, junk:0.12, decoy:0.10, stormDur:6, bossHp:3, ghost:0.013 };
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
    _bossEl:null,

    // buffs
    freezeUntil:0,
    overUntil:0,

    // PACK Y: combo reward tier
    rewardTier:0,
    rewardCdUntil:0,

    // PACK X: zone shrink + move
    zone:{
      on:false,
      cx:0, cy:0,
      r:0, r0:0,
      rMin:86,
      vx:0, vy:0,
      untilMs:0,
      nextMoveAt:0,
      shrinkPerSec:0,
      urgent:false,
      lastKey:''
    },

    // PACK Z: Rival Ghost
    ghostAlive:false,
    ghostUntilMs:0,
    ghostNextAtMs:0,

    // PACK W: Remix
    perfectStreak:0,
    remixUntilMs:0,

    // timers
    spawnTimer:0,
    tickTimer:0,

    // quest instance
    quest:null,
    _questBound:false
  };

  function scoreMult(){ return (now() < engine.overUntil) ? 2 : 1; }
  function remixOn(){ return now() < engine.remixUntilMs; }
  function powerGain(){
    // ✅ W: remix => power +2 เวลา hit ดี (โกงเวลา)
    return remixOn() ? 2 : 1;
  }

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
  function updateTime(){ emit('hha:time', { left: Math.max(0, Math.round(engine.left))|0 }); }
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

  // ---------- Spawn rect ----------
  function safeSpawnRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    const top = 160, bot = 190, side = 16;
    return { x0:side, x1:W-side, y0:top, y1:H-bot, W, H };
  }

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

  function removeTarget(el){
    if (!el) return;
    try{ root.clearTimeout(el._ttlTimer); }catch{}
    try{ root.clearInterval(el._ghostMoveInt); }catch{}
    el.classList.add('hit');
    root.setTimeout(()=> el.remove(), 220);
  }

  function makeTarget(type, emoji, x, y, s, ttlOverride){
    const layer = engine.layerEl;
    if (!layer) return null;

    const el = DOC.createElement('div');
    el.className = 'fg-target spawn';
    el.dataset.emoji = emoji || '✨';
    el.dataset.type = type;

    if (type === 'good' || type === 'ghost') el.dataset.groupId = String(engine.groupId);

    if (type === 'good')   el.classList.add('fg-good');
    if (type === 'junk')   el.classList.add('fg-junk');
    if (type === 'decoy')  el.classList.add('fg-decoy');
    if (type === 'wrong')  el.classList.add('fg-wrong');
    if (type === 'boss')   el.classList.add('fg-boss');
    if (type === 'ghost')  el.classList.add('fg-ghost');

    setXY(el, x, y);
    el.style.setProperty('--s', s.toFixed(3));

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el);
    }, { passive:false });

    const ttl = Math.max(650, Number(ttlOverride || engine.ttlMs) || engine.ttlMs);
    el._ttlTimer = root.setTimeout(()=>{
      if (!el.isConnected) return;

      // expire good => miss
      if (type === 'good'){
        engine.misses++; engine.combo = 0; engine.groupClean = false;
        engine.perfectStreak = 0; // W: streak break
        engine.fever = clamp(engine.fever + 10, 0, 100);
        emit('hha:judge', { kind:'MISS' });
        updateScore();
        emitFever();
      }

      // expire ghost => just vanish (no penalty)
      if (type === 'ghost'){ engine.ghostAlive = false; }

      el.classList.add('out');
      root.setTimeout(()=> el.remove(), 220);
    }, ttl);

    return el;
  }

  // ---------- PACK X: Zone shrink + move ----------
  function zoneDefaults(){
    const r0 = (engine.diff==='easy') ? 170 : (engine.diff==='hard' ? 135 : 150);
    const rMin = (engine.diff==='easy') ? 96 : (engine.diff==='hard' ? 78 : 86);
    const shrink = (engine.diff==='easy') ? 8.0 : (engine.diff==='hard' ? 14.0 : 11.0);
    return { r0, rMin, shrinkPerSec: shrink };
  }

  function setZoneVars(){
    const layer = engine.layerEl;
    if (!layer) return;

    const Z = engine.zone;
    if (!Z.on){
      layer.style.setProperty('--nojunk-on', '0');
      DOC.body.classList.remove('groups-zone-on','groups-zone-urgent');
      return;
    }
    layer.style.setProperty('--nojunk-on', '1');
    layer.style.setProperty('--nojunk-cx', Z.cx.toFixed(1)+'px');
    layer.style.setProperty('--nojunk-cy', Z.cy.toFixed(1)+'px');
    layer.style.setProperty('--nojunk-r',  Z.r.toFixed(1)+'px');

    DOC.body.classList.toggle('groups-zone-on', true);
    DOC.body.classList.toggle('groups-zone-urgent', !!Z.urgent);
  }

  function pickZoneCenter(){
    const r = safeSpawnRect();
    const x = clamp(r.x0 + (r.x1-r.x0)*(0.20 + engine.rng()*0.60), r.x0+80, r.x1-80);
    const y = clamp(r.y0 + (r.y1-r.y0)*(0.20 + engine.rng()*0.60), r.y0+80, r.y1-80);
    return { x, y };
  }

  function activateZone(durSec, key){
    const Z = engine.zone;
    const df = zoneDefaults();
    const dur = clamp(durSec || 8, 4, 20);

    Z.on = true;
    Z.untilMs = now() + dur*1000;
    Z.lastKey = String(key||'zone');

    const c = pickZoneCenter();
    Z.cx = c.x; Z.cy = c.y;
    Z.r0 = df.r0;
    Z.r = df.r0;
    Z.rMin = df.rMin;
    Z.shrinkPerSec = df.shrinkPerSec;

    Z.vx = (engine.rng()<0.5?-1:1) * (10 + engine.rng()*20);
    Z.vy = (engine.rng()<0.5?-1:1) * (8 + engine.rng()*16);

    Z.nextMoveAt = now() + 1200;
    Z.urgent = false;

    setZoneVars();
    emit('groups:zone', { on:true, durSec: dur|0, r0:Z.r0|0, rMin:Z.rMin|0 });
    emit('hha:judge', { kind:'good', text:'NO-JUNK ZONE!' });
  }

  function deactivateZone(){
    const Z = engine.zone;
    if (!Z.on) return;
    Z.on = false;
    Z.urgent = false;
    setZoneVars();
    emit('groups:zone', { on:false });
  }

  function inCircle(x,y,cx,cy,r){
    const dx = x-cx, dy=y-cy;
    return (dx*dx + dy*dy) <= (r*r);
  }

  function randInCircle(cx, cy, r){
    const a = engine.rng()*Math.PI*2;
    const t = Math.sqrt(engine.rng());
    const rr = r * t;
    return { x: cx + Math.cos(a)*rr, y: cy + Math.sin(a)*rr };
  }

  function zonePosPrefer(tp){
    const Z = engine.zone;
    if (!Z.on) return null;
    if (engine.storm) return null;

    const rect = safeSpawnRect();
    const cx = clamp(Z.cx, rect.x0+30, rect.x1-30);
    const cy = clamp(Z.cy, rect.y0+30, rect.y1-30);
    const r  = clamp(Z.r,  Z.rMin, Z.r0);

    if ((tp === 'good') && engine.rng() < 0.70){
      const p = randInCircle(cx, cy, Math.max(26, r-18));
      return { x: clamp(p.x, rect.x0, rect.x1), y: clamp(p.y, rect.y0, rect.y1) };
    }

    if ((tp === 'junk' || tp === 'decoy' || tp === 'wrong' || tp === 'ghost') && engine.rng() < 0.78){
      for (let i=0;i<10;i++){
        const p = randPos();
        if (!inCircle(p.x,p.y,cx,cy,r)) return p;
      }
    }

    return null;
  }

  function zoneTick(){
    const Z = engine.zone;
    if (!Z.on) return;

    const t = now();
    const rect = safeSpawnRect();

    Z.r = Math.max(Z.rMin, Z.r - Z.shrinkPerSec * 0.14);

    if (t >= Z.nextMoveAt){
      if (engine.rng() < 0.25){
        Z.vx = (engine.rng()<0.5?-1:1) * (10 + engine.rng()*26);
        Z.vy = (engine.rng()<0.5?-1:1) * (8 + engine.rng()*22);
      }
      Z.nextMoveAt = t + (700 + engine.rng()*650);
    }

    Z.cx += Z.vx * 0.14;
    Z.cy += Z.vy * 0.14;

    const pad = Math.max(70, Z.r*0.55);
    if (Z.cx < rect.x0+pad){ Z.cx = rect.x0+pad; Z.vx = Math.abs(Z.vx); }
    if (Z.cx > rect.x1-pad){ Z.cx = rect.x1-pad; Z.vx = -Math.abs(Z.vx); }
    if (Z.cy < rect.y0+pad){ Z.cy = rect.y0+pad; Z.vy = Math.abs(Z.vy); }
    if (Z.cy > rect.y1-pad){ Z.cy = rect.y1-pad; Z.vy = -Math.abs(Z.vy); }

    const lifeLeft = Z.untilMs - t;
    Z.urgent = (lifeLeft <= 2400) || (Z.r <= (Z.rMin + 10));
    setZoneVars();

    if (t >= Z.untilMs){ deactivateZone(); }
  }

  function bindZoneFromQuest(){
    let bound = false;
    const it = setInterval(()=>{
      if (bound) return;
      if (!engine.running) return;
      bound = true;
      clearInterval(it);

      root.addEventListener('quest:update', (ev)=>{
        const d = ev?.detail || {};
        const miniTitle = String(d.miniTitle || '').trim();
        const forbid = !!d.miniForbidJunk || /no-?junk/i.test(miniTitle) || /ห้าม/i.test(miniTitle) || /ขยะ/i.test(miniTitle);
        const tLeft = Number(d.miniTimeLeftSec ?? 0);

        const key = `${forbid?'F':'N'}|${miniTitle}|${tLeft|0}`;
        if (engine.zone.lastKey === key) return;
        engine.zone.lastKey = key;

        if (forbid){
          const dur = (tLeft>0) ? clamp(tLeft, 4, 20) : 8;
          const need = (!engine.zone.on) || ((engine.zone.untilMs - now()) < 1200);
          if (need) activateZone(dur, key);
        } else {
          if (engine.zone.on) deactivateZone();
        }
      }, { passive:true });
    }, 200);
  }

  // ---------- Core game mechanics ----------
  function setGroup(id){
    engine.groupId = id;
    engine.groupClean = true;
    emitCoach(SONG[id] || `ต่อไป หมู่ ${id}!`, 'happy');
  }

  // ✅ W: perfect switch streak tracking
  function notePerfectSwitch(){
    if (engine.groupClean){
      engine.perfectStreak = clamp(engine.perfectStreak + 1, 0, 99);
      emitProgress({ kind:'perfect_switch' });
      emit('hha:celebrate', { kind:'mini', title:'Perfect Switch!' });
    } else {
      engine.perfectStreak = 0;
    }
  }

  // ✅ W: remix trigger (2 perfect consecutive)
  function maybeTriggerRemix(){
    if (engine.runMode === 'research') return false; // โหมดวิจัย: ปิดโกงเวลาให้ deterministic
    if (engine.perfectStreak >= 2){
      engine.perfectStreak = 0;
      engine.remixUntilMs = now() + 8500; // 8.5s power x2
      DOC.body.classList.add('groups-remix');
      emit('groups:remix', { on:true, durMs: 8500 });
      emit('hha:judge', { kind:'good', text:'REMIX! ⚡ (Power x2)' });
      return true;
    }
    return false;
  }

  function chooseNextGroupRandom(){
    const pool = [1,2,3,4,5].filter(g=>g!==engine.groupId);
    return pool[(engine.rng()*pool.length)|0] || ((engine.groupId%5)+1);
  }

  function switchGroup(){
    // before switching: check perfect
    notePerfectSwitch();
    const remixNow = maybeTriggerRemix();

    const next = remixNow ? chooseNextGroupRandom() : ((engine.groupId % 5) + 1);
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

  function bossTeleport(el){
    if (!el || !el.isConnected) return;
    const p = (engine.diff==='hard') ? 0.55 : (engine.diff==='easy' ? 0.28 : 0.40);
    if (engine.rng() > p) return;

    const pos = (engine.storm ? stormPos() : randPos());
    setXY(el, pos.x, pos.y);
    el.classList.add('fg-boss-teleport');
    setTimeout(()=> el.classList.remove('fg-boss-teleport'), 240);
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
      if (engine.bossHp === 1) el.classList.add('fg-boss-weak');
      el.classList.add('fg-boss-hurt');
      setTimeout(()=> el.classList.remove('fg-boss-hurt'), 220);
      bossTeleport(el);
    }
  }

  // ---------- PACK Z: Rival Ghost (Decoy Boss) ----------
  function ghostAllowed(){
    if (engine.runMode === 'research') return false; // วิจัย: ปิด
    if (engine.ghostAlive) return false;
    if (now() < engine.ghostNextAtMs) return false;
    if (engine.bossAlive) return false; // ไม่ชน boss
    return true;
  }

  function spawnGhost(){
    if (!ghostAllowed()) return;
    engine.ghostAlive = true;

    const ttl = (engine.diff==='hard') ? 5200 : (engine.diff==='easy' ? 6500 : 5800);
    engine.ghostUntilMs = now() + ttl;
    engine.ghostNextAtMs = now() + (engine.diff==='hard' ? 14000 : 17000) + engine.rng()*7000;

    // หลอกเหมือน "ของดีหมู่นี้" แต่ติด aura
    const em = pick(GROUPS[engine.groupId].emoji, engine.rng);
    const p = (engine.storm ? stormPos() : (zonePosPrefer('ghost') || randPos()));
    const s = 1.08 * engine.sizeBase;

    const el = makeTarget('ghost', em, p.x, p.y, s, ttl);
    if (!el) { engine.ghostAlive=false; return; }

    el.dataset.ghost = '1';
    el.classList.add('fg-ghost');

    // teleport drift
    el._ghostMoveInt = root.setInterval(()=>{
      if (!el.isConnected) { try{ root.clearInterval(el._ghostMoveInt); }catch{}; return; }
      const pos = engine.storm ? stormPos() : randPos();
      setXY(el, pos.x, pos.y);
      el.classList.add('fg-ghost-blink');
      setTimeout(()=> el.classList.remove('fg-ghost-blink'), 160);
    }, (engine.diff==='hard') ? 780 : 980);

    engine.layerEl.appendChild(el);
    emitProgress({ kind:'ghost_spawn' });
    emit('hha:judge', { kind:'bad', text:'👻 RIVAL GHOST!' });
  }

  function hitGhost(el){
    // shield can save once (เป็นธรรมกับเด็ก)
    if (engine.shield > 0){
      engine.shield = 0;
      engine.fever = clamp(engine.fever - 6, 0, 100);
      emitFever();
      emit('hha:judge', { kind:'good', text:'🛡️ SAVE!' });
      engine.score += 40;
      updateScore();
      engine.ghostAlive = false;
      removeTarget(el);
      return;
    }

    emitProgress({ type:'hit', correct:false });
    emitProgress({ kind:'hit_bad' });
    emitProgress({ kind:'ghost_hit' });

    engine.misses++;
    engine.combo = 0;
    engine.groupClean = false;
    engine.perfectStreak = 0; // W streak break

    // penalty
    engine.score = Math.max(0, engine.score - 120);
    engine.fever = clamp(engine.fever + 22, 0, 100);
    emitFever();

    // extra chaos: random swap group (ทันที) เพื่อเร้าใจ
    const g2 = chooseNextGroupRandom();
    setGroup(g2);
    engine.power = 0;
    updatePower();

    emit('hha:celebrate', { kind:'mini', title:'GHOST TRICK!' });
    updateScore();

    engine.ghostAlive = false;
    removeTarget(el);
  }

  // ---------- PACK Y: rewards ----------
  function spawnReward(type){
    if (!engine.running || engine.ended) return;
    if (!engine.layerEl) return;

    const rect = safeSpawnRect();
    const cx = rect.W*0.5, cy = (rect.y0+rect.y1)*0.5;
    const jitterX = (engine.rng()-0.5)*120;
    const jitterY = (engine.rng()-0.5)*90;

    const x = clamp(cx + jitterX, rect.x0+40, rect.x1-40);
    const y = clamp(cy + jitterY, rect.y0+40, rect.y1-40);

    const s = 0.95 * engine.sizeBase;
    const ttl = 2300;

    const em = (type==='star') ? '⭐'
            : (type==='ice') ? '❄️'
            : (type==='diamond') ? '💎'
            : '✨';

    const el = makeTarget(type, em, x, y, s, ttl);
    if (!el) return;

    el.classList.add('fg-reward');
    if (type==='star') el.classList.add('fg-star');
    if (type==='ice') el.classList.add('fg-ice');
    if (type==='diamond') el.classList.add('fg-diamond');

    engine.layerEl.appendChild(el);
    emit('hha:judge', { kind:'good', text:'BONUS!' });
  }

  function checkComboRewards(){
    if (engine.runMode === 'research') return;
    const t = now();
    if (t < engine.rewardCdUntil) return;

    const c = engine.combo|0;
    if (engine.rewardTier < 1 && c >= 15){
      engine.rewardTier = 1;
      engine.rewardCdUntil = t + 1200;
      spawnReward('star');
    } else if (engine.rewardTier < 2 && c >= 25){
      engine.rewardTier = 2;
      engine.rewardCdUntil = t + 1200;
      spawnReward('ice');
    } else if (engine.rewardTier < 3 && c >= 35){
      engine.rewardTier = 3;
      engine.rewardCdUntil = t + 1200;
      spawnReward('diamond');
    }
  }

  function grantReward(type){
    const t = now();
    if (type === 'star'){
      engine.shield = 1;
      engine.score += 80;
      engine.fever = clamp(engine.fever - 6, 0, 100);
      emitFever();
      emit('hha:judge', { kind:'good', text:'⭐ SHIELD!' });
      return;
    }
    if (type === 'ice'){
      engine.freezeUntil = t + 4500;
      engine.score += 70;
      emit('hha:judge', { kind:'good', text:'❄ FREEZE!' });
      return;
    }
    if (type === 'diamond'){
      engine.overUntil = t + 6500;
      engine.score += 90;
      emit('hha:judge', { kind:'good', text:'💎 OVERDRIVE x2!' });
      return;
    }
  }

  // ---------- Spawn decision ----------
  function chooseType(){
    const base = diffParams(engine.diff);

    const baseJ = (engine.runMode==='research') ? base.junk : engine.adapt.junkBias;
    const baseD = (engine.runMode==='research') ? base.decoy : engine.adapt.decoyBias;

    // bonus small
    const pu = engine.storm ? 0.016 : 0.010;
    if (engine.rng() < pu){
      const r = engine.rng();
      if (r < 0.45) return 'star';
      if (r < 0.80) return 'ice';
      return 'diamond';
    }

    // Z: ghost roll
    const gP = base.ghost;
    if (engine.rng() < gP) return 'ghost';

    const r = engine.rng();
    if (r < baseJ) return 'junk';
    if (r < baseJ + baseD) return 'decoy';

    if (engine.rng() < (engine.storm ? 0.18 : 0.14)) return 'wrong';
    return 'good';
  }

  function chooseEmoji(tp){
    if (tp === 'junk') return pick(JUNK_EMOJI, engine.rng);
    if (tp === 'decoy') return pick(DECOY_EMOJI, engine.rng);
    if (tp === 'star') return '⭐';
    if (tp === 'ice')  return '❄️';
    if (tp === 'diamond') return '💎';
    if (tp === 'good' || tp === 'ghost') return pick(GROUPS[engine.groupId].emoji, engine.rng);

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

    // Z: ghost explicit (สปอว์นเป็นหน่วยพิเศษให้ teleport)
    if (!engine.ghostAlive && ghostAllowed() && engine.rng() < 0.03){
      // โอกาส extra เมื่อเข้า storm / remix
      const boost = (engine.storm ? 0.06 : (remixOn()?0.05:0));
      if (engine.rng() < boost) spawnGhost();
    }

    const tp = chooseType();
    if (tp === 'ghost'){ spawnGhost(); return; }

    const em = chooseEmoji(tp);

    let p = null;
    if (engine.storm) p = stormPos();
    else p = zonePosPrefer(tp) || randPos();

    const s = engine.sizeBase;
    const el = makeTarget(tp, em, p.x, p.y, s);
    if (el) layer.appendChild(el);
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;
    spawnOne();

    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;

    const freezeMul = (now() < engine.freezeUntil) ? 1.45 : 1.0;
    const remixMul  = remixOn() ? 0.92 : 1.0; // remix เร็วขึ้นนิด ๆ

    const sMs = Math.max(420, base.spawnMs * (engine.storm ? 0.82 : 1.0) * freezeMul * remixMul);
    engine.spawnTimer = root.setTimeout(loopSpawn, sMs);
  }

  // ---------- Hit logic ----------
  function hitTarget(el){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    let type = String(el.dataset.type||'').toLowerCase();

    // rewards
    if (type === 'star' || type === 'ice' || type === 'diamond'){
      grantReward(type);
      updateScore();
      removeTarget(el);
      return;
    }

    if (type === 'boss'){ hitBoss(el); return; }
    if (type === 'ghost'){ hitGhost(el); return; }

    // good but wrong group => wrong
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

      // ✅ W remix power x2
      addPower(powerGain());

      checkComboRewards();
      removeTarget(el);
      return;
    }

    // BAD
    const badLike = (type === 'junk' || type === 'wrong' || type === 'decoy');
    if (badLike){
      // shield blocks only junk
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
      engine.perfectStreak = 0; // streak break

      engine.fever = clamp(engine.fever + (type==='junk'?18:12), 0, 100);
      emitFever();

      emit('hha:judge', { kind:'bad', text:(type==='junk'?'JUNK!':'WRONG!') });

      updateScore();
      removeTarget(el);
      return;
    }
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

    const t = now();

    // W remix class on/off
    if (t >= engine.remixUntilMs){
      DOC.body.classList.remove('groups-remix');
      emit('groups:remix', { on:false });
    }

    DOC.body.classList.toggle('groups-freeze', (t < engine.freezeUntil));
    DOC.body.classList.toggle('groups-overdrive', (t < engine.overUntil));

    if (!engine.storm && t >= engine.nextStormAtMs) enterStorm();
    if (engine.storm && t >= engine.stormUntilMs){
      exitStorm();
      engine.nextStormAtMs = t + (16000 + engine.rng()*12000);
    } else if (engine.storm){
      const leftMs = engine.stormUntilMs - t;
      if (leftMs <= 3200){
        DOC.body.classList.add('groups-storm-urgent');
      }
    }

    // zone
    zoneTick();

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
      try{ root.clearInterval(el._ghostMoveInt); }catch{}
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
    deactivateZone();

    DOC.body.classList.remove('groups-storm','groups-storm-urgent','groups-freeze','groups-overdrive','groups-remix');

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
    setZoneVars();
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

    engine.storm = false;
    engine.stormDurSec = dp.stormDur;
    engine.nextStormAtMs = now() + (12000 + engine.rng()*11000);
    engine.stormPattern = (engine.style==='hard'?'spiral':engine.style==='feel'?'wave':'burst');
    engine.stormSpawnIdx = 0;

    engine.bossAlive = false;
    engine.bossHpMax = dp.bossHp;
    engine.nextBossAtMs = now() + 14000;
    engine._bossEl = null;

    engine.groupId = 1;
    engine.groupClean = true;

    engine.fever = 0;
    engine.shield = 0;
    engine.feverTickLast = 0;

    engine.freezeUntil = 0;
    engine.overUntil = 0;

    engine.rewardTier = 0;
    engine.rewardCdUntil = 0;

    // zone reset
    engine.zone.on = false;
    engine.zone.untilMs = 0;
    engine.zone.urgent = false;
    engine.zone.lastKey = '';
    setZoneVars();

    // Z ghost reset
    engine.ghostAlive = false;
    engine.ghostUntilMs = 0;
    engine.ghostNextAtMs = now() + (engine.diff==='hard'?9000:11000) + engine.rng()*6000;

    // W remix reset
    engine.perfectStreak = 0;
    engine.remixUntilMs = 0;
    DOC.body.classList.remove('groups-remix');

    engine.vx = 0; engine.vy = 0;
    applyView();

    updateTime();
    updatePower();
    updateScore();
    emitFever();
    emitCoach(SONG[1], 'neutral');

    questStart();
    bindZoneFromQuest();

    emit('hha:celebrate', { kind:'goal', title:'เริ่มเกม! 🎵' });

    loopSpawn();
    loopTick();
  }

  function stop(reason){ endGame(reason || 'stop'); }

  NS.GameEngine = { start, stop, setLayerEl };

})(typeof window !== 'undefined' ? window : globalThis);