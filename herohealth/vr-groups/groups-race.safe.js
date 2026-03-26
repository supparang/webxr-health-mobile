// === /herohealth/vr-groups/groups-race.safe.js ===
/* global window, document */
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  function clamp(v,a,b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function nowMs(){
    return (performance && performance.now) ? performance.now() : Date.now();
  }

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

  const GROUPS = [
    { id:1, short:'หมู่ 1', name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, short:'หมู่ 2', name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, short:'หมู่ 3', name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, short:'หมู่ 4 ผลไม้', name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, short:'หมู่ 5 ไขมัน', name:'หมู่ 5 ไขมัน', items:['🥑','🧈','🥥','🧀','🫒'] }
  ];

  const STATE = {
    layerEl: null,
    running: false,
    paused: false,
    raf: 0,
    diff: 'normal',
    rng: null,
    seed: '',
    plannedSec: 60,
    timeLeft: 0,
    lastTick: 0,
    elapsed: 0,
    score: 0,
    rivalScore: 0,
    combo: 0,
    comboMax: 0,
    hits: 0,
    shots: 0,
    miss: 0,
    targetGroup: null,
    goalNow: 0,
    goalTotal: 10,
    map: new Map(),
    idSeq: 1,
    spawnAcc: 0,
    spawnPerSec: 1.0,
    ttlMs: 2600
  };

  function emit(name, detail){
    try{
      WIN.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }catch(_){}
  }

  function pick(arr){
    return arr[(STATE.rng() * arr.length) | 0];
  }

  function accPct(){
    return STATE.shots > 0 ? Math.round((STATE.hits / STATE.shots) * 100) : 0;
  }

  function getSafeRect(layerEl){
    const s = WIN.__HHA_RACE_SPAWN_SAFE__;
    if(s && Number.isFinite(s.xMin)) return s;
    const r = layerEl.getBoundingClientRect();
    return { xMin:24, xMax:r.width-24, yMin:140, yMax:r.height-120 };
  }

  function posInSafe(){
    const r = getSafeRect(STATE.layerEl);
    return {
      x: r.xMin + STATE.rng() * Math.max(1, (r.xMax - r.xMin)),
      y: r.yMin + STATE.rng() * Math.max(1, (r.yMax - r.yMin))
    };
  }

  function clearTargets(){
    for(const o of STATE.map.values()){
      try{ o.el.remove(); }catch(_){}
    }
    STATE.map.clear();
  }

  function chooseGroup(){
    STATE.targetGroup = pick(GROUPS);
    STATE.goalNow = 0;
    emit('race:progress', {
      goalTitle: `ยิง ${STATE.targetGroup.short}`,
      goalNow: STATE.goalNow,
      goalTotal: STATE.goalTotal,
      tip: `หา ${STATE.targetGroup.short}`,
      hot: false
    });
    emit('race:coach', {
      text: `เริ่มเลย! ยิง ${STATE.targetGroup.short}`,
      mood: 'neutral'
    });
  }

  function makeTarget(){
    const id = String(STATE.idSeq++);
    const correctP = STATE.diff === 'hard' ? 0.60 : STATE.diff === 'easy' ? 0.78 : 0.68;

    let group = STATE.targetGroup;
    let good = true;

    if(STATE.rng() > correctP){
      const others = GROUPS.filter(g => g.id !== STATE.targetGroup.id);
      group = pick(others);
      good = false;
    }

    const emoji = pick(group.items);
    const el = DOC.createElement('div');
    el.className = 'tgt';
    el.dataset.id = id;
    el.textContent = emoji;

    const p = posInSafe();
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.transform = 'translate(-50%,-50%) scale(.84)';
    el.style.opacity = '0';

    STATE.layerEl.appendChild(el);

    requestAnimationFrame(()=>{
      el.style.transition = 'transform .12s ease, opacity .12s ease';
      el.style.transform = 'translate(-50%,-50%) scale(1)';
      el.style.opacity = '1';
    });

    STATE.map.set(id, {
      id,
      el,
      good,
      groupId: group.id,
      born: nowMs(),
      x: p.x,
      y: p.y
    });
  }

  function removeTarget(id, cls){
    const o = STATE.map.get(String(id));
    if(!o) return;
    STATE.map.delete(String(id));

    try{
      if(cls) o.el.classList.add(cls);
      o.el.style.transition = 'transform .12s ease, opacity .12s ease';
      o.el.style.opacity = '0';
      o.el.style.transform = 'translate(-50%,-50%) scale(.72)';
      setTimeout(()=>{ try{ o.el.remove(); }catch(_){ } }, 140);
    }catch(_){}
  }

  function updateScore(){
    emit('race:score', {
      myScore: STATE.score|0,
      combo: STATE.combo|0,
      acc: accPct()
    });
  }

  function updateTime(){
    emit('race:time', { left: Math.ceil(STATE.timeLeft) });
  }

  function updateQuest(hot){
    emit('race:progress', {
      goalTitle: `ยิง ${STATE.targetGroup.short}`,
      goalNow: STATE.goalNow,
      goalTotal: STATE.goalTotal,
      tip: hot ? 'คอมโบมาแล้ว!' : `หา ${STATE.targetGroup.short}`,
      hot: !!hot
    });
  }

  function onHit(obj){
    if(!STATE.running || STATE.paused) return;
    STATE.shots++;

    const correct = obj.groupId === STATE.targetGroup.id && obj.good;

    if(correct){
      STATE.hits++;
      STATE.combo++;
      STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
      STATE.goalNow++;
      const add = 10 + Math.min(10, Math.floor(STATE.combo / 2) * 2);
      STATE.score += add;

      emit('race:hit', {
        good: true,
        x: obj.x,
        y: obj.y,
        delta: add
      });

      if(STATE.goalNow >= STATE.goalTotal){
        chooseGroup();
      }else{
        updateQuest(STATE.combo >= 5);
      }

      if(STATE.combo === 5){
        emit('race:coach', { text:'คอมโบมาแล้ว! ไปต่อ!', mood:'happy' });
      }
    }else{
      STATE.combo = 0;
      STATE.score = Math.max(0, STATE.score - 2);
      emit('race:hit', {
        good: false,
        x: obj.x,
        y: obj.y,
        delta: -2
      });
      updateQuest(false);
    }

    removeTarget(obj.id, correct ? 'hit' : 'bad');
    updateScore();
  }

  function pointerHandler(ev){
    if(!STATE.running || STATE.paused) return;
    const el = ev.target && ev.target.closest ? ev.target.closest('.tgt') : null;
    if(!el) return;
    const obj = STATE.map.get(String(el.dataset.id));
    if(!obj) return;
    onHit(obj);
  }

  function shootHandler(ev){
    if(!STATE.running || STATE.paused) return;
    const lockPx = clamp(ev?.detail?.lockPx ?? 36, 16, 140);
    const r = STATE.layerEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    let best = null;
    let bestD = 1e9;
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
    if(best && bestD <= lockPx) onHit(best);
  }

  function expireTick(){
    const t = nowMs();
    for(const obj of Array.from(STATE.map.values())){
      if(t - obj.born < STATE.ttlMs) continue;
      if(obj.groupId === STATE.targetGroup.id && obj.good){
        STATE.combo = 0;
        STATE.miss++;
        STATE.score = Math.max(0, STATE.score - 1);
        emit('race:hit', {
          good: false,
          x: obj.x,
          y: obj.y,
          delta: -1
        });
      }
      removeTarget(obj.id, 'expire');
      updateScore();
    }
  }

  function spawnTick(dt){
    STATE.spawnAcc += STATE.spawnPerSec * dt;
    while(STATE.spawnAcc >= 1){
      STATE.spawnAcc -= 1;
      makeTarget();
    }
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
    STATE.timeLeft = Math.max(0, STATE.timeLeft - dt);

    spawnTick(dt);
    expireTick();
    updateTime();

    if(STATE.timeLeft <= 0){
      STATE.running = false;
      clearTargets();
      emit('race:end', {
        durationPlayedSec: Math.round(STATE.plannedSec),
        acc: accPct(),
        comboMax: STATE.comboMax|0
      });
      return;
    }

    STATE.raf = requestAnimationFrame(tick);
  }

  function setLayerEl(el){
    STATE.layerEl = el || null;
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

  function start(diff, ctx){
    if(!STATE.layerEl) throw new Error('[GroupsRace] layerEl not set');

    stop();

    ctx = ctx || {};
    STATE.diff = String(diff || 'normal').toLowerCase();
    STATE.seed = String(ctx.seed || Date.now());
    STATE.rng = makeRng(STATE.seed);
    STATE.plannedSec = clamp(ctx.time ?? 60, 20, 300);
    STATE.timeLeft = STATE.plannedSec;
    STATE.lastTick = nowMs();
    STATE.elapsed = 0;
    STATE.score = 0;
    STATE.combo = 0;
    STATE.comboMax = 0;
    STATE.hits = 0;
    STATE.shots = 0;
    STATE.miss = 0;
    STATE.goalTotal = STATE.diff === 'hard' ? 12 : STATE.diff === 'easy' ? 8 : 10;
    STATE.spawnPerSec = STATE.diff === 'hard' ? 1.35 : STATE.diff === 'easy' ? 0.88 : 1.08;
    STATE.ttlMs = STATE.diff === 'hard' ? 2200 : STATE.diff === 'easy' ? 3100 : 2600;
    STATE.spawnAcc = 0;
    STATE.idSeq = 1;
    STATE.running = true;
    STATE.paused = false;

    chooseGroup();
    updateScore();
    updateTime();

    try{
      STATE.layerEl.addEventListener('pointerdown', pointerHandler, { passive:true });
    }catch(_){}
    try{
      WIN.addEventListener('hha:shoot', shootHandler);
    }catch(_){}

    STATE.raf = requestAnimationFrame(tick);
  }

  function setPaused(on){
    STATE.paused = !!on;
    STATE.lastTick = nowMs();
  }

  function isRunning(){
    return !!STATE.running;
  }

  WIN.GroupsRace = WIN.GroupsRace || {};
  WIN.GroupsRace.GameEngine = {
    setLayerEl,
    start,
    stop,
    setPaused,
    isRunning
  };

  WIN.addEventListener('hha:pause', ()=> setPaused(true), { passive:true });
  WIN.addEventListener('hha:resume', ()=> setPaused(false), { passive:true });
})();