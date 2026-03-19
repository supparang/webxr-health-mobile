// === /herohealth/vr-groups/groups-race.safe.js ===
// Groups Race SAFE
// FULL PATCH v20260319-GROUPS-RACE-SAFE-V1
/* global window, document */
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const clamp = (v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };

  const nowMs = () => (performance && performance.now) ? performance.now() : Date.now();

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
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  const GROUPS = [
    { id:1, short:'หมู่ 1', name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, short:'หมู่ 2', name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, short:'หมู่ 3', name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, short:'หมู่ 4', name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, short:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] }
  ];

  const STATE = {
    layerEl: null,
    running: false,
    paused: false,
    raf: 0,
    listenersBound: false,
    endedOnce: false,

    diff: 'normal',
    timeSec: 60,
    seedStr: '',
    view: 'mobile',
    rng: null,

    startMs: 0,
    lastTick: 0,
    tLeft: 0,
    elapsed: 0,

    myScore: 0,
    rivalScore: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,
    shots: 0,
    hits: 0,

    goalNow: 0,
    goalTotal: 30,
    spawnAcc: 0,
    baseSpawnPerSec: 1.0,
    baseTtl: 2.8,
    curGroup: null,

    map: new Map(),
    idSeq: 1,
    coachTs: 0
  };

  function accPct(){
    return STATE.shots > 0 ? Math.round((STATE.hits / STATE.shots) * 100) : 0;
  }

  function getSafeRect(layerEl){
    const s = WIN.__HHA_RACE_SPAWN_SAFE__;
    if(s && Number.isFinite(s.xMin)) return s;

    const r = layerEl.getBoundingClientRect();
    const PAD = 18;
    return {
      xMin: PAD,
      xMax: Math.max(PAD + 1, r.width - PAD),
      yMin: 180,
      yMax: Math.max(240, r.height - 170)
    };
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
      const toast = DOC.querySelector('.coachToast.show');

      [hud, toast].forEach(node=>{
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
      tries < 32 &&
      (
        intersectsForbidden(x, y) ||
        y < (r.yMin + 16) ||
        y > (r.yMax - 16) ||
        x < (r.xMin + 10) ||
        x > (r.xMax - 10)
      )
    );

    return { x, y };
  }

  function createTarget(){
    const id = String(STATE.idSeq++);
    const el = DOC.createElement('div');
    el.dataset.id = id;

    if(!STATE.curGroup){
      STATE.curGroup = pick(STATE.rng, GROUPS);
    }

    const correctP = STATE.diff === 'easy' ? 0.76 : STATE.diff === 'hard' ? 0.62 : 0.68;

    let emoji = '';
    let groupId = STATE.curGroup.id;
    let mission = true;

    if(STATE.rng() < correctP){
      emoji = pick(STATE.rng, STATE.curGroup.items);
      mission = true;
      groupId = STATE.curGroup.id;
    }else{
      const others = GROUPS.filter(g => g.id !== STATE.curGroup.id);
      const og = pick(STATE.rng, others);
      emoji = pick(STATE.rng, og.items);
      mission = false;
      groupId = og.id;
    }

    el.className = 'tgt';
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

    const ttl = Math.max(1.0, STATE.baseTtl);
    const obj = {
      id,
      el,
      emoji,
      born: nowMs(),
      ttlMs: ttl * 1000,
      mission,
      groupId,
      lastX: 0,
      lastY: 0
    };
    STATE.map.set(id, obj);
  }

  function removeTarget(id){
    const t = STATE.map.get(String(id));
    if(!t) return;
    STATE.map.delete(String(id));
    try{
      t.el.style.transition = 'transform .12s ease, opacity .12s ease';
      t.el.style.opacity = '0';
      t.el.style.transform = 'translate(-50%,-50%) scale(.68)';
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){ } }, 140);
    }catch(_){}
  }

  function emitScorePack(){
    const rankText = STATE.myScore > STATE.rivalScore ? '#1'
      : STATE.myScore < STATE.rivalScore ? '#2'
      : '#1 ร่วม';

    emit('race:score', {
      myScore: STATE.myScore|0,
      rivalScore: STATE.rivalScore|0,
      rankText,
      combo: STATE.combo|0,
      acc: accPct()
    });
  }

  function emitProgressPack(){
    emit('race:progress', {
      goalTitle: `ยิง “${STATE.curGroup?.short || 'หมู่ที่ถูก'}” ให้เร็ว`,
      goalNow: STATE.goalNow,
      goalTotal: STATE.goalTotal,
      tip: STATE.myScore >= STATE.rivalScore ? 'รักษานำไว้!' : 'เร่งแซงเลย!',
      hot: STATE.tLeft <= 10
    });
  }

  function emitTimePack(){
    emit('race:time', { left: Math.ceil(STATE.tLeft) });
  }

  function maybeCoach(){
    const t = nowMs();
    if(t - STATE.coachTs < 3200) return;

    let text = '';
    let mood = 'neutral';

    if(STATE.tLeft <= 10){
      text = 'โค้งสุดท้าย! เร่งเลย 🔥';
      mood = 'fever';
    }else if(STATE.myScore < STATE.rivalScore){
      text = 'ตามอยู่! ยิงให้แม่นแล้วแซงให้ได้';
      mood = 'sad';
    }else if(STATE.combo >= 5){
      text = 'คอมโบดีมาก! รักษาจังหวะไว้';
      mood = 'happy';
    }else if(accPct() < 50 && STATE.shots >= 5){
      text = 'ค่อย ๆ เล็งก่อนยิง จะได้ไม่เสียแต้ม';
      mood = 'neutral';
    }else{
      return;
    }

    STATE.coachTs = t;
    emit('race:coach', { text, mood });
  }

  function onHit(obj){
    if(!STATE.running || STATE.paused) return;
    STATE.shots++;

    const good = obj.mission === true && obj.groupId === STATE.curGroup.id;

    if(good){
      STATE.hits++;
      STATE.goalNow++;
      STATE.combo++;
      STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
      const add = STATE.combo >= 5 ? 12 : 10;
      STATE.myScore += add;

      if(STATE.goalNow > 0 && STATE.goalNow % 6 === 0){
        STATE.curGroup = pick(STATE.rng, GROUPS);
      }

      emit('race:hit', {
        good: true,
        delta: add,
        x: obj.lastX,
        y: obj.lastY,
        hot: STATE.tLeft <= 10
      });
    }else{
      STATE.combo = 0;
      STATE.myScore = Math.max(0, STATE.myScore - 2);
      emit('race:hit', {
        good: false,
        delta: -2,
        x: obj.lastX,
        y: obj.lastY
      });
    }

    removeTarget(obj.id);
    emitScorePack();
    emitProgressPack();
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

  function simulateRival(dt){
    const pace = STATE.diff === 'easy' ? 7.5 : STATE.diff === 'hard' ? 10.5 : 9.0;
    const chance = Math.min(0.95, dt * pace);
    if(STATE.rng() < chance){
      const delta = STATE.rng() < 0.78 ? 10 : -2;
      STATE.rivalScore = Math.max(0, STATE.rivalScore + delta);
    }
  }

  function spawnTick(dt){
    const sp = STATE.baseSpawnPerSec;
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
        obj.mission === true &&
        obj.groupId === STATE.curGroup.id;

      if(shouldCountMiss){
        STATE.miss++;
        STATE.combo = 0;
        STATE.myScore = Math.max(0, STATE.myScore - 1);
        setObjCenterFromEl(obj);
        emit('race:hit', {
          good: false,
          delta: -1,
          x: obj.lastX,
          y: obj.lastY
        });
      }

      removeTarget(obj.id);
    }
  }

  function setObjCenterFromEl(obj){
    try{
      const b = obj.el.getBoundingClientRect();
      obj.lastX = b.left + b.width / 2;
      obj.lastY = b.top + b.height / 2;
    }catch(_){}
  }

  function buildSummary(){
    const result = STATE.myScore > STATE.rivalScore ? 'WIN'
      : STATE.myScore < STATE.rivalScore ? 'LOSE'
      : 'DRAW';

    return {
      result,
      myScore: STATE.myScore|0,
      rivalScore: STATE.rivalScore|0,
      acc: accPct(),
      comboMax: STATE.comboMax|0,
      durationPlayedSec: Math.round(STATE.timeSec - STATE.tLeft)
    };
  }

  function endGame(){
    if(!STATE.running || STATE.endedOnce) return;
    STATE.endedOnce = true;
    STATE.running = false;
    STATE.paused = false;
    cancelAnimationFrame(STATE.raf);
    clearTargets();
    emit('race:end', buildSummary());
  }

  function clearTargets(){
    for(const t of STATE.map.values()){
      try{ t.el.remove(); }catch(_){}
    }
    STATE.map.clear();
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

    simulateRival(dt);
    spawnTick(dt);
    expireTick();
    emitTimePack();
    emitScorePack();
    emitProgressPack();
    maybeCoach();

    if(STATE.tLeft <= 0){
      endGame();
      return;
    }

    STATE.raf = requestAnimationFrame(tick);
  }

  function bindRuntimeListeners(){
    if(STATE.listenersBound) return;

    try{
      if(STATE.layerEl){
        STATE.layerEl.addEventListener('pointerdown', pointerHandler, { passive:true });
      }
    }catch(_){}

    try{
      WIN.addEventListener('hha:shoot', shootHandler);
    }catch(_){}

    STATE.listenersBound = true;
  }

  function unbindRuntimeListeners(){
    try{
      if(STATE.layerEl){
        STATE.layerEl.removeEventListener('pointerdown', pointerHandler);
      }
    }catch(_){}

    try{
      WIN.removeEventListener('hha:shoot', shootHandler);
    }catch(_){}

    STATE.listenersBound = false;
  }

  function start(diff, ctx){
    ctx = ctx || {};
    if(!STATE.layerEl){
      throw new Error('[GroupsRace] layerEl not set. Call setLayerEl() first');
    }

    stop();

    STATE.diff = String(diff || 'normal').toLowerCase();
    STATE.timeSec = clamp(ctx.time ?? 60, 20, 180);
    STATE.seedStr = String(ctx.seed ?? Date.now());
    STATE.view = String(ctx.view || 'mobile').toLowerCase();
    STATE.rng = makeRng(STATE.seedStr);

    if(STATE.diff === 'easy'){
      STATE.baseSpawnPerSec = 0.86;
      STATE.baseTtl = 3.2;
      STATE.goalTotal = 24;
    }else if(STATE.diff === 'hard'){
      STATE.baseSpawnPerSec = 1.22;
      STATE.baseTtl = 2.4;
      STATE.goalTotal = 36;
    }else{
      STATE.baseSpawnPerSec = 1.0;
      STATE.baseTtl = 2.8;
      STATE.goalTotal = 30;
    }

    STATE.running = true;
    STATE.paused = false;
    STATE.endedOnce = false;
    STATE.startMs = nowMs();
    STATE.lastTick = nowMs();
    STATE.tLeft = STATE.timeSec;
    STATE.elapsed = 0;

    STATE.myScore = 0;
    STATE.rivalScore = 0;
    STATE.combo = 0;
    STATE.comboMax = 0;
    STATE.miss = 0;
    STATE.shots = 0;
    STATE.hits = 0;
    STATE.goalNow = 0;
    STATE.spawnAcc = 0;
    STATE.idSeq = 1;
    STATE.coachTs = 0;
    STATE.curGroup = pick(STATE.rng, GROUPS);

    clearTargets();
    bindRuntimeListeners();
    emitScorePack();
    emitProgressPack();
    emitTimePack();
    STATE.raf = requestAnimationFrame(tick);
  }

  function stop(){
    unbindRuntimeListeners();
    STATE.running = false;
    STATE.paused = false;
    cancelAnimationFrame(STATE.raf);
    clearTargets();
  }

  function setPaused(on){
    STATE.paused = !!on;
    STATE.lastTick = nowMs();
  }

  WIN.GroupsRace = WIN.GroupsRace || {};
  WIN.GroupsRace.GameEngine = {
    setLayerEl,
    start,
    stop,
    setPaused
  };

  function setLayerEl(el){
    STATE.layerEl = el || null;
  }

  WIN.addEventListener('hha:pause', ()=> setPaused(true), { passive:true });
  WIN.addEventListener('hha:resume', ()=> setPaused(false), { passive:true });
})();