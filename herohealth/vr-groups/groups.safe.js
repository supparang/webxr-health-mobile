// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE — CHILD-FRIENDLY + HUD-SAFE + END-SAFE
// FULL PATCH v20260314-GROUPS-SAFE-HUDSAFE-ENDSAFE-r1
/* global window, document */
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const clamp = (v,a,b)=>{
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b,v));
  };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();

  function xmur3(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
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

  function makeRng(seedStr){
    const s = xmur3(seedStr);
    return sfc32(s(), s(), s(), s());
  }

  const pick = (rng, arr)=> arr[(rng() * arr.length) | 0];

  function emit(name, detail){
    try{
      WIN.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }catch(_){}
  }

  function coach(text, mood){
    emit('hha:coach', {
      text: String(text || ''),
      mood: String(mood || 'neutral')
    });
  }

  function getSafeRect(layerEl){
    const s = WIN.__HHA_SPAWN_SAFE__;
    if(s && Number.isFinite(s.xMin)) return s;

    const r = layerEl.getBoundingClientRect();
    const PAD = 18;
    return {
      xMin: PAD,
      xMax: Math.max(PAD + 1, r.width - PAD),
      yMin: 220,
      yMax: Math.max(260, r.height - 230)
    };
  }

  function setObjCenterFromEl(obj){
    try{
      const b = obj.el.getBoundingClientRect();
      obj.lastX = b.left + b.width / 2;
      obj.lastY = b.top + b.height / 2;
    }catch(_){}
  }

  const GROUPS = [
    { id:1, short:'หมู่ 1', name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, short:'หมู่ 2', name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, short:'หมู่ 3 ผัก', name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, short:'หมู่ 4 ผลไม้', name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, short:'หมู่ 5 ไขมัน', name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] }
  ];

  const STATE = {
    layerEl: null,
    running: false,
    paused: false,
    raf: 0,

    diff: 'normal',
    ctx: null,
    runMode: 'play',
    plannedSec: 80,
    seedStr: '',
    view: 'mobile',

    rng: null,

    startMs: 0,
    lastTick: 0,
    tLeft: 0,
    elapsed: 0,

    score: 0,
    combo: 0,
    bestCombo: 0,
    miss: 0,
    shots: 0,
    hits: 0,

    curGroup: null,
    goalTotal: 12,
    goalNow: 0,

    charge: 0,
    chargeNeed: 8,

    stage: 'main',
    bossLeft: 0,
    bossSec: 8,
    bossHits: 0,

    spawnAcc: 0,
    baseSpawnPerSec: 1.18,
    baseTtl: 2.95,

    map: new Map(),
    idSeq: 1,

    warnLastMs: 0,
    endedReason: ''
  };

  function accPct(){
    return STATE.shots > 0 ? Math.round((STATE.hits / STATE.shots) * 100) : 0;
  }

  function gradeLetter(){
    const a = accPct();
    const score = Number(STATE.score || 0);
    const combo = Number(STATE.bestCombo || 0);
    const miss = Number(STATE.miss || 0);

    const weighted = (a * 0.62) + Math.min(18, combo * 1.8) + Math.min(20, score / 30) - Math.min(18, miss * 0.8);

    if(weighted >= 92) return 'S';
    if(weighted >= 80) return 'A';
    if(weighted >= 66) return 'B';
    if(weighted >= 50) return 'C';
    return 'D';
  }

  function smooth01(x){
    x = Math.max(0, Math.min(1, x));
    return x*x*(3 - 2*x);
  }

  function rampMul(elapsedSec, plannedSec, runMode, diff){
    if(runMode === 'practice') return 1;
    const rampMax = (diff === 'easy') ? 0.12 : (diff === 'hard') ? 0.24 : 0.18;
    return 1 + rampMax * smooth01(elapsedSec / Math.max(1, plannedSec));
  }

  function ttlShrinkMul(elapsedSec, plannedSec, runMode, diff){
    if(runMode === 'practice') return 1;
    const shrink = (diff === 'easy') ? 0.10 : (diff === 'hard') ? 0.22 : 0.16;
    return 1 - shrink * smooth01(elapsedSec / Math.max(1, plannedSec));
  }

  function streakBonus(combo){
    combo = Number(combo) || 0;
    if(combo >= 15) return 12;
    if(combo >= 10) return 9;
    if(combo >= 7) return 6;
    if(combo >= 5) return 4;
    if(combo >= 3) return 2;
    return 0;
  }

  function setLayerEl(el){
    STATE.layerEl = el || null;
  }

  function clearTargets(){
    for(const t of STATE.map.values()){
      try{ t.el.remove(); }catch(_){}
    }
    STATE.map.clear();
  }

  function intersectsForbidden(x, y){
    const stage = STATE.layerEl;
    if(!stage) return false;

    try{
      const stageRect = stage.getBoundingClientRect();
      const localX = x;
      const localY = y;

      const forbidden = [];

      const hud = DOC.querySelector('.hud');
      const power = DOC.querySelector('.powerWrap');
      const toast = DOC.querySelector('.coachToast.show');

      [hud, power, toast].forEach(node=>{
        if(!node) return;
        const r = node.getBoundingClientRect();
        forbidden.push({
          left: r.left - stageRect.left - 26,
          top: r.top - stageRect.top - 20,
          right: r.right - stageRect.left + 26,
          bottom: r.bottom - stageRect.top + 20
        });
      });

      return forbidden.some(box=>{
        return localX >= box.left && localX <= box.right && localY >= box.top && localY <= box.bottom;
      });
    }catch(_){
      return false;
    }
  }

  function posInSafe(){
    const r = getSafeRect(STATE.layerEl);

    let x = 0;
    let y = 0;
    let tries = 0;

    do{
      x = r.xMin + STATE.rng() * Math.max(1, (r.xMax - r.xMin));
      y = r.yMin + STATE.rng() * Math.max(1, (r.yMax - r.yMin));
      tries++;
    }while(
      tries < 28 &&
      (
        intersectsForbidden(x, y) ||
        y < (r.yMin + 10) ||
        y > (r.yMax - 8)
      )
    );

    return { x, y };
  }

  function makeTargetClass(mission){
    return mission ? 'tgt tgt-mission' : 'tgt tgt-other';
  }

  function currentCorrectProbability(){
    if(STATE.stage === 'boss') return 0.88;
    if(STATE.tLeft <= 12) return 0.75;
    if(STATE.diff === 'easy') return 0.72;
    if(STATE.diff === 'hard') return 0.64;
    return 0.68;
  }

  function createTarget(){
    const id = String(STATE.idSeq++);
    const el = DOC.createElement('div');
    el.dataset.id = id;

    const missionGroup = STATE.curGroup;
    const correctP = currentCorrectProbability();

    let emoji = '';
    let groupId = missionGroup.id;
    let mission = true;

    if(STATE.rng() < correctP){
      emoji = pick(STATE.rng, missionGroup.items);
      mission = true;
      groupId = missionGroup.id;
    }else{
      const others = GROUPS.filter(g => g.id !== missionGroup.id);
      const og = pick(STATE.rng, others);
      emoji = pick(STATE.rng, og.items);
      mission = false;
      groupId = og.id;
    }

    el.className = makeTargetClass(mission);
    el.textContent = emoji;

    const p = posInSafe();
    el.style.position = 'absolute';
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.transform = 'translate(-50%,-50%) scale(.84)';
    el.style.opacity = '0';

    STATE.layerEl.appendChild(el);

    requestAnimationFrame(()=>{
      try{
        el.style.transition = 'transform .14s ease, opacity .12s ease';
        el.style.transform = 'translate(-50%,-50%) scale(1)';
        el.style.opacity = '1';
      }catch(_){}
    });

    const ttlMul = ttlShrinkMul(STATE.elapsed, STATE.plannedSec, STATE.runMode, STATE.diff);
    const finalRush = (STATE.runMode !== 'practice' && STATE.tLeft <= 10) ? 0.92 : 1;
    const bossRush = (STATE.stage === 'boss') ? 0.92 : 1;
    const ttl = Math.max(1.05, STATE.baseTtl * ttlMul * finalRush * bossRush);
    const ttlMs = ttl * 1000;

    const obj = {
      id,
      el,
      emoji,
      born: nowMs(),
      ttlMs,
      mission,
      groupId,
      lastX: 0,
      lastY: 0
    };

    STATE.map.set(id, obj);
    return obj;
  }

  function removeTarget(id, cls){
    const t = STATE.map.get(String(id));
    if(!t) return;
    STATE.map.delete(String(id));

    try{
      if(cls) t.el.classList.add(cls);
      t.el.style.transition = 'transform .12s ease, opacity .12s ease, filter .12s ease';
      t.el.style.opacity = '0';
      t.el.style.transform = 'translate(-50%,-50%) scale(.68)';
      t.el.style.filter = cls === 'hit' ? 'brightness(1.35)' : 'brightness(.8)';
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){ } }, 140);
    }catch(_){}
  }

  function emitHit(kind, good, obj, delta){
    emit('groups:hit', {
      kind: String(kind || ''),
      good: !!good,
      x: Number(obj?.lastX || 0),
      y: Number(obj?.lastY || 0),
      score: STATE.score|0,
      combo: STATE.combo|0,
      delta: Number(delta || 0)
    });
  }

  function powerAdd(n){
    STATE.charge = Math.max(0, (STATE.charge|0) + (n|0));
    emit('groups:power', {
      charge: STATE.charge,
      threshold: STATE.chargeNeed
    });

    if(STATE.charge >= STATE.chargeNeed){
      STATE.charge = 0;
      STATE.chargeNeed = clamp(STATE.chargeNeed + 1, 8, 12);
      STATE.curGroup = pick(STATE.rng, GROUPS);

      emit('groups:group', {
        id: STATE.curGroup.id,
        name: STATE.curGroup.name,
        short: STATE.curGroup.short
      });

      emitQuestUpdate();
      coach(`สลับภารกิจ! หา “${STATE.curGroup.short}” 🎯`, 'neutral');
    }
  }

  function onHit(obj){
    if(!STATE.running || STATE.paused) return;
    STATE.shots++;

    const isCorrect = (obj.mission === true) && (obj.groupId === STATE.curGroup.id);

    if(isCorrect){
      STATE.hits++;
      STATE.goalNow++;
      STATE.combo++;
      STATE.bestCombo = Math.max(STATE.bestCombo, STATE.combo);

      const baseAdd = (STATE.stage === 'boss') ? 14 : 10;
      const add = baseAdd + streakBonus(STATE.combo);
      STATE.score += add;

      powerAdd(1);

      if(STATE.stage === 'boss'){
        STATE.bossHits++;
        if(STATE.bossHits === 1){
          coach('บอสมาแล้ว! เน้นหมู่เดียวให้แม่น ⚡', 'fever');
        }
      }else if(STATE.combo === 4){
        coach('คอมโบมาแล้ว! รักษาจังหวะ 🔥', 'happy');
      }else if(STATE.goalNow > 0 && STATE.goalNow % 5 === 0){
        coach(`ดีมาก! ต่อไปเน้น “${STATE.curGroup.short}” 🎯`, 'neutral');
      }

      emitHit(STATE.stage === 'boss' ? 'boss_hit' : 'hit_good', true, obj, add);
      removeTarget(obj.id, 'hit');
      emitScorePack();
      emitQuestUpdate();
      return;
    }

    STATE.combo = 0;
    STATE.score = Math.max(0, STATE.score - 3);

    emitHit('hit_bad', false, obj, -3);
    removeTarget(obj.id, 'hit');
    emitScorePack();
    emitQuestUpdate();
  }

  function pointerHandler(ev){
    if(!STATE.running || STATE.paused) return;
    const el = ev.target && ev.target.closest ? ev.target.closest('.tgt') : null;
    if(!el) return;

    const obj = STATE.map.get(String(el.dataset.id));
    if(!obj) return;

    obj.lastX = Number(ev.clientX || 0);
    obj.lastY = Number(ev.clientY || 0);
    onHit(obj);
  }

  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 22, 16, 140);
    let best = null;
    let bestD = 1e9;

    const r = STATE.layerEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    for(const obj of STATE.map.values()){
      const b = obj.el.getBoundingClientRect();
      const x = b.left + b.width / 2;
      const y = b.top + b.height / 2;
      const d = Math.hypot(x - cx, y - cy);
      if(d < bestD){
        bestD = d;
        best = obj;
      }
    }

    if(best && bestD <= lockPx) return best;
    return null;
  }

  function shootHandler(ev){
    if(!STATE.running || STATE.paused) return;

    const lockPx = ev && ev.detail && ev.detail.lockPx != null ? ev.detail.lockPx : 22;
    const obj = pickClosestToCenter(lockPx);
    if(!obj) return;

    const r = STATE.layerEl.getBoundingClientRect();
    obj.lastX = r.left + r.width / 2;
    obj.lastY = r.top + r.height / 2;
    onHit(obj);
  }

  function emitScorePack(){
    emit('hha:score', {
      score: STATE.score|0,
      combo: STATE.combo|0,
      misses: STATE.miss|0,
      miss: STATE.miss|0,
      accPct: accPct(),
      accuracyPct: accPct(),
      comboMax: STATE.bestCombo|0,
      timeLeft: Math.ceil(STATE.tLeft)
    });

    emit('hha:rank', {
      grade: gradeLetter()
    });
  }

  function emitQuestUpdate(){
    emit('quest:update', {
      goalTitle: (STATE.stage === 'boss')
        ? 'ภารกิจพิเศษ: ยิงให้ถูกหมู่'
        : 'เป้าพิเศษ: ยิงให้ถูกหมู่',
      goalNow: STATE.goalNow,
      goalTotal: STATE.goalTotal,
      groupName: STATE.curGroup ? STATE.curGroup.name : '—',
      groupNo: STATE.curGroup ? STATE.curGroup.id : null,
      miniTitle: (STATE.stage === 'boss') ? 'พิเศษ' : 'พลังพิเศษ',
      miniNow: (STATE.stage === 'boss') ? STATE.bossHits : STATE.charge,
      miniTotal: (STATE.stage === 'boss') ? 999 : STATE.chargeNeed,
      miniTimeLeftSec: (STATE.stage === 'boss') ? Math.ceil(STATE.bossLeft) : 0
    });

    emit('groups:power', {
      charge: STATE.charge,
      threshold: STATE.chargeNeed
    });
  }

  function emitTimePack(){
    emit('hha:time', {
      left: Math.ceil(STATE.tLeft)
    });
  }

  function aiWarnMaybe(){
    const t = nowMs();
    if(t - STATE.warnLastMs < 2200) return;

    const acc = accPct();
    let msg = '';
    let mood = 'neutral';

    if(STATE.stage === 'boss'){
      msg = `บอสมาแล้ว! เน้น “${STATE.curGroup.short}” ⚡`;
      mood = 'fever';
    }else if(acc < 45 && STATE.shots >= 4){
      msg = 'ค่อย ๆ เล็งให้ตรงหมู่ก่อน อย่ายิงมั่ว 👀';
      mood = 'sad';
    }else if(STATE.combo >= 5){
      msg = 'เยี่ยม! คอมโบกำลังมา 🔥';
      mood = 'happy';
    }else if(STATE.tLeft <= 12){
      msg = 'ช่วงท้ายแล้ว ใจเย็นและยิงให้แม่น 🎯';
      mood = 'neutral';
    }else{
      return;
    }

    STATE.warnLastMs = t;
    coach(msg, mood);
  }

  function spawnTick(dt){
    const mul = rampMul(STATE.elapsed, STATE.plannedSec, STATE.runMode, STATE.diff);
    const finalRush = (STATE.runMode !== 'practice' && STATE.tLeft <= 10) ? 1.08 : 1.0;
    const bossRush = (STATE.stage === 'boss') ? 1.05 : 1.0;

    const sp = STATE.baseSpawnPerSec * mul * finalRush * bossRush;
    STATE.spawnAcc += sp * dt;

    while(STATE.spawnAcc >= 1){
      STATE.spawnAcc -= 1;
      createTarget();
    }
  }

  function expireTick(){
    const t = nowMs();

    for(const obj of Array.from(STATE.map.values())){
      if(t - obj.born < obj.ttlMs) continue;

      const shouldCountMiss =
        (STATE.runMode !== 'practice') &&
        obj.mission === true &&
        obj.groupId === STATE.curGroup.id;

      if(shouldCountMiss){
        STATE.miss++;
        STATE.combo = 0;
        STATE.score = Math.max(0, STATE.score - 2);
        setObjCenterFromEl(obj);
        emitHit('timeout_miss', false, obj, -2);
      }

      removeTarget(obj.id, 'expire');
    }
  }

  function startBoss(){
    STATE.stage = 'boss';
    STATE.bossSec = clamp(STATE.ctx?.bossSec ?? 8, 6, 14);
    STATE.bossLeft = STATE.bossSec;
    STATE.bossHits = 0;
    STATE.curGroup = pick(STATE.rng, GROUPS);

    emit('groups:group', {
      id: STATE.curGroup.id,
      name: STATE.curGroup.name,
      short: STATE.curGroup.short
    });

    emitQuestUpdate();
    coach(`ช่วงพิเศษ! ยิง “${STATE.curGroup.short}” ให้มากที่สุดใน ${STATE.bossSec}s`, 'fever');
  }

  function buildSummary(reason){
    return {
      projectTag: 'GroupsVR',
      gameVersion: 'v20260314-GROUPS-SAFE-HUDSAFE-ENDSAFE-r1',
      device: STATE.view,
      runMode: STATE.runMode,
      diff: STATE.diff,
      seed: STATE.seedStr,
      reason: String(reason || ''),

      durationPlannedSec: STATE.plannedSec,
      durationPlayedSec: Math.round(STATE.plannedSec - STATE.tLeft),

      scoreFinal: STATE.score|0,
      miss: STATE.miss|0,
      shots: STATE.shots|0,
      hits: STATE.hits|0,
      accuracyPct: accPct(),
      comboMax: STATE.bestCombo|0,
      grade: gradeLetter(),

      stageEnded: STATE.stage,
      bossSec: (STATE.stage === 'boss') ? STATE.bossSec : 0,
      bossHits: (STATE.stage === 'boss') ? STATE.bossHits : 0,

      groupLast: STATE.curGroup ? STATE.curGroup.name : '—'
    };
  }

  function endGame(reason){
    if(!STATE.running) return;

    STATE.endedReason = String(reason || '');
    STATE.running = false;
    STATE.paused = false;
    cancelAnimationFrame(STATE.raf);
    clearTargets();

    const summary = buildSummary(reason);
    emit('hha:end', summary);
  }

  function tick(){
    if(!STATE.running) return;

    if(STATE.paused){
      STATE.lastTick = nowMs();
      STATE.raf = requestAnimationFrame(tick);
      return;
    }

    const t = nowMs();
    const dt = Math.min(0.05, Math.max(0.001, (t - STATE.lastTick) / 1000));
    STATE.lastTick = t;

    STATE.elapsed += dt;
    STATE.tLeft = Math.max(0, STATE.tLeft - dt);

    if(STATE.stage === 'boss'){
      STATE.bossLeft = Math.max(0, STATE.bossLeft - dt);
      if(STATE.bossLeft <= 0){
        endGame('boss-done');
        return;
      }
    }

    spawnTick(dt);
    expireTick();
    emitTimePack();
    emitScorePack();
    emitQuestUpdate();
    aiWarnMaybe();

    if(STATE.tLeft <= 0){
      const classroom = !!STATE.ctx?.classroom;
      const bossOn = !!STATE.ctx?.miniBoss;

      if(classroom && bossOn && STATE.stage === 'main' && STATE.runMode !== 'practice'){
        startBoss();
        STATE.tLeft = 6;
        STATE.raf = requestAnimationFrame(tick);
        return;
      }

      endGame('time');
      return;
    }

    STATE.raf = requestAnimationFrame(tick);
  }

  function start(diff, ctx){
    ctx = ctx || {};
    if(!STATE.layerEl){
      throw new Error('[GroupsVR] layerEl not set. Call setLayerEl() first');
    }

    stop();

    STATE.diff = String(diff || 'normal').toLowerCase();
    STATE.ctx = ctx;
    STATE.runMode = String(ctx.runMode || 'play').toLowerCase();
    STATE.view = String(ctx.view || DOC.body.getAttribute('data-view') || 'mobile').toLowerCase();

    const timeSec = clamp(ctx.time ?? 80, 15, 300);
    STATE.plannedSec = timeSec;
    STATE.seedStr = String(ctx.seed ?? Date.now());
    STATE.rng = makeRng(STATE.seedStr);

    if(STATE.diff === 'easy'){
      STATE.baseSpawnPerSec = 0.96;
      STATE.baseTtl = 3.20;
    }else if(STATE.diff === 'hard'){
      STATE.baseSpawnPerSec = 1.26;
      STATE.baseTtl = 2.55;
    }else{
      STATE.baseSpawnPerSec = 1.10;
      STATE.baseTtl = 2.85;
    }

    if(STATE.runMode === 'practice'){
      STATE.baseSpawnPerSec *= 0.88;
      STATE.baseTtl += 0.30;
    }

    STATE.running = true;
    STATE.paused = false;
    STATE.startMs = nowMs();
    STATE.lastTick = nowMs();
    STATE.tLeft = timeSec;
    STATE.elapsed = 0;

    STATE.score = 0;
    STATE.combo = 0;
    STATE.bestCombo = 0;
    STATE.miss = 0;
    STATE.shots = 0;
    STATE.hits = 0;

    STATE.goalTotal = clamp(ctx.goalTotal ?? 12, 8, 18);
    STATE.goalNow = 0;

    STATE.charge = 0;
    STATE.chargeNeed = clamp(ctx.chargeNeed ?? 8, 6, 12);

    STATE.stage = 'main';
    STATE.bossLeft = 0;
    STATE.bossSec = clamp(ctx.bossSec ?? 8, 6, 14);
    STATE.bossHits = 0;

    STATE.spawnAcc = 0;
    STATE.idSeq = 1;
    STATE.warnLastMs = 0;
    STATE.endedReason = '';

    clearTargets();

    STATE.curGroup = pick(STATE.rng, GROUPS);

    emit('groups:group', {
      id: STATE.curGroup.id,
      name: STATE.curGroup.name,
      short: STATE.curGroup.short
    });

    try{
      STATE.layerEl.addEventListener('pointerdown', pointerHandler, { passive:true });
    }catch(_){}

    try{
      WIN.addEventListener('hha:shoot', shootHandler);
    }catch(_){}

    coach(`เริ่มเลย! หา “${STATE.curGroup.short}” แล้วเก็บคอมโบ 🎯`, 'neutral');
    emitTimePack();
    emitScorePack();
    emitQuestUpdate();

    STATE.raf = requestAnimationFrame(tick);
  }

  function stop(){
    try{
      if(STATE.layerEl) STATE.layerEl.removeEventListener('pointerdown', pointerHandler);
    }catch(_){}

    try{
      WIN.removeEventListener('hha:shoot', shootHandler);
    }catch(_){}

    STATE.running = false;
    STATE.paused = false;
    cancelAnimationFrame(STATE.raf);
    clearTargets();
  }

  function setPaused(on){
    STATE.paused = !!on;
    STATE.lastTick = nowMs();
  }

  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.GameEngine = {
    setLayerEl,
    start,
    stop,
    setPaused
  };

  WIN.addEventListener('hha:pause', ()=> setPaused(true), { passive:true });
  WIN.addEventListener('hha:resume', ()=> setPaused(false), { passive:true });

})();