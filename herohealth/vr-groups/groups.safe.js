// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE — PRODUCTION (AI wired + FX + FAIR MISS + SAFE SPAWN)
// FULL v20260306b-GROUPS-SAFE-AI-FX-FAIRMISS-OPENLAYOUT
/* global window, document */
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // ---------------------------
  // Helpers
  // ---------------------------
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  function xmur3(str){
    str = String(str||'');
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h<<13) | (h>>>19);
    }
    return function(){
      h = Math.imul(h ^ (h>>>16), 2246822507);
      h = Math.imul(h ^ (h>>>13), 3266489909);
      return (h ^ (h>>>16)) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a>>>=0; b>>>=0; c>>>=0; d>>>=0;
      let t = (a+b)|0;
      a = b ^ (b>>>9);
      b = (c + (c<<3))|0;
      c = (c<<21) | (c>>>11);
      d = (d+1)|0;
      t = (t+d)|0;
      c = (c+t)|0;
      return (t>>>0) / 4294967296;
    };
  }
  function makeRng(seedStr){
    const s = xmur3(seedStr);
    return sfc32(s(),s(),s(),s());
  }
  const pick = (rng, arr)=> arr[(rng()*arr.length)|0];

  // ---------------------------
  // Thai Food Groups (fixed mapping)
  // ---------------------------
  const GROUPS = [
    { id:1, short:'หมู่ 1', name:'หมู่ 1 โปรตีน', items:['🍗','🥚','🥛','🐟','🫘','🍖','🧀'] },
    { id:2, short:'หมู่ 2', name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥟','🍠','🍙'] },
    { id:3, short:'หมู่ 3', name:'หมู่ 3 ผัก', items:['🥦','🥬','🥒','🥕','🌽','🍅','🫛'] },
    { id:4, short:'หมู่ 4', name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍉','🍇','🍍','🍊','🥭'] },
    { id:5, short:'หมู่ 5', name:'หมู่ 5 ไขมัน', items:['🥑','🧈','🥜','🫒','🍳','🥥','🧴'] },
  ];

  // ---------------------------
  // FX Pack (popup score + burst)
  // ---------------------------
  const FX = {
    layer: null,
    ensureLayer(){
      if(this.layer && DOC.body.contains(this.layer)) return;
      const el = DOC.createElement('div');
      el.id = 'groupsFxLayer';
      el.style.cssText = 'position:absolute; inset:0; pointer-events:none; overflow:hidden;';
      this.layer = el;
    },
    mount(host){
      try{
        this.ensureLayer();
        if(host && host.appendChild){
          if(this.layer.parentElement !== host){
            try{ this.layer.remove(); }catch(_){}
            host.appendChild(this.layer);
          }
        }
      }catch(_){}
    },
    pop(x, y, text, good){
      try{
        if(!this.layer) return;
        const d = DOC.createElement('div');
        d.textContent = String(text||'');
        d.style.cssText =
          'position:absolute; left:'+x+'px; top:'+y+'px; transform:translate(-50%,-50%);'+
          'padding:6px 10px; border-radius:999px; font-weight:1100; font-size:12px;'+
          'border:1px solid rgba(148,163,184,.18); backdrop-filter: blur(8px);'+
          'background:'+(good ? 'rgba(34,197,94,.16)' : 'rgba(239,68,68,.14)')+';'+
          'color:rgba(229,231,235,.95); box-shadow:0 12px 34px rgba(0,0,0,.25);'+
          'opacity:0; transition: transform 520ms ease, opacity 520ms ease;';
        this.layer.appendChild(d);
        requestAnimationFrame(()=>{
          d.style.opacity = '1';
          d.style.transform = 'translate(-50%,-80%)';
        });
        setTimeout(()=>{
          try{
            d.style.opacity = '0';
            d.style.transform = 'translate(-50%,-110%)';
          }catch(_){}
        }, 520);
        setTimeout(()=>{ try{ d.remove(); }catch(_){ } }, 980);
      }catch(_){}
    },
    burst(x, y, good){
      try{
        if(!this.layer) return;
        const r = DOC.createElement('div');
        r.style.cssText =
          'position:absolute; left:'+x+'px; top:'+y+'px; width:18px; height:18px;'+
          'transform:translate(-50%,-50%); border-radius:999px;'+
          'border:2px solid '+(good?'rgba(34,197,94,.75)':'rgba(239,68,68,.70)')+';'+
          'box-shadow:0 0 0 6px '+(good?'rgba(34,197,94,.10)':'rgba(239,68,68,.10)')+' inset;'+
          'opacity:.9; transition: transform 420ms ease, opacity 420ms ease;';
        this.layer.appendChild(r);
        requestAnimationFrame(()=>{
          r.style.transform = 'translate(-50%,-50%) scale(4.2)';
          r.style.opacity = '0';
        });
        setTimeout(()=>{ try{ r.remove(); }catch(_){ } }, 520);
      }catch(_){}
    }
  };

  // ---------------------------
  // Safe Spawn Rect
  // ---------------------------
  function getSafeRect(layerEl){
    const s = WIN.__HHA_SPAWN_SAFE__;
    if(s && Number.isFinite(s.xMin) && Number.isFinite(s.yMin) && Number.isFinite(s.xMax) && Number.isFinite(s.yMax)){
      return {
        xMin: Number(s.xMin),
        xMax: Number(s.xMax),
        yMin: Number(s.yMin),
        yMax: Number(s.yMax),
      };
    }

    const r = layerEl.getBoundingClientRect
      ? layerEl.getBoundingClientRect()
      : { width: WIN.innerWidth||360, height: WIN.innerHeight||640 };

    const view = String(qs('view','mobile') || 'mobile').toLowerCase();
    const padX = 18;

    const topSafe =
      (view === 'pc')  ? 120 :
      (view === 'cvr') ? 138 :
                         158;

    const bottomSafe =
      (view === 'pc')  ? 124 :
      (view === 'cvr') ? 220 :
                         186;

    return {
      xMin: padX,
      xMax: Math.max(padX + 1, (r.width || 360) - padX),
      yMin: topSafe,
      yMax: Math.max(topSafe + 1, (r.height || 640) - bottomSafe),
    };
  }

  function isOccludedAtCenter(el){
    try{
      const b = el.getBoundingClientRect();
      const cx = b.left + b.width/2;
      const cy = b.top  + b.height/2;
      const topEl = DOC.elementFromPoint(cx, cy);
      if(!topEl) return true;
      if(topEl === el) return false;
      if(topEl.closest && topEl.closest('.tgt') === el) return false;

      const hud = topEl.closest && (
        topEl.closest('.hud') ||
        topEl.closest('.questTop') ||
        topEl.closest('.powerWrap') ||
        topEl.closest('.coachWrap') ||
        topEl.closest('.coachToast') ||
        topEl.closest('.overlay') ||
        topEl.closest('.topbar')
      );
      return !!hud;
    }catch(_){
      return true;
    }
  }

  // ---------------------------
  // Engine State
  // ---------------------------
  const STATE = {
    layerEl: null,
    fxHost: null,

    running: false,
    paused: false,
    raf: 0,

    diff: 'normal',
    runMode: 'play',
    view: 'mobile',
    seedStr: '',
    rng: null,

    plannedSec: 90,
    tLeft: 90,
    startMs: 0,
    lastTick: 0,
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
    bossSec: 12,
    bossLeft: 0,
    bossHits: 0,

    spawnAcc: 0,
    baseSpawnPerSec: 0.98,
    baseTtl: 3.35,
    correctP: 0.74,

    map: new Map(),
    idSeq: 1,

    lastShotAt: 0,
    shotCooldownMs: 70,

    bound: false,
    ctx: null,
  };

  function accPct(){
    return (STATE.shots > 0) ? Math.round((STATE.hits / STATE.shots) * 100) : 0;
  }

  function gradeLetter(){
    const a = accPct();
    const x = (a * 0.70) + (STATE.bestCombo * 1.1) - Math.min(20, STATE.miss) * 0.9;
    if(x>=92) return 'S';
    if(x>=80) return 'A';
    if(x>=66) return 'B';
    if(x>=50) return 'C';
    return 'D';
  }

  function AI(){ return WIN.HHA_AI; }

  // ---------------------------
  // DOM target
  // ---------------------------
  function clearTargets(){
    for(const t of STATE.map.values()){
      try{ t.el.remove(); }catch(_){}
    }
    STATE.map.clear();
  }

  function pickSpawnPoint(size){
    const rect = getSafeRect(STATE.layerEl);
    let best = null;
    let bestScore = -1;

    for(let i=0;i<12;i++){
      const x = rect.xMin + STATE.rng() * Math.max(1, (rect.xMax - rect.xMin));
      const y = rect.yMin + STATE.rng() * Math.max(1, (rect.yMax - rect.yMin));

      let minD = 999999;
      for(const t of STATE.map.values()){
        if(!t || !t.el) continue;
        const tx = Number(t.x || 0);
        const ty = Number(t.y || 0);
        const d = Math.hypot(tx - x, ty - y);
        if(d < minD) minD = d;
      }

      const edgePenalty =
        Math.min(x - rect.xMin, rect.xMax - x) +
        Math.min(y - rect.yMin, rect.yMax - y);

      const score = minD + edgePenalty * 0.12;
      if(score > bestScore){
        bestScore = score;
        best = { x, y };
      }
    }

    return best || {
      x: rect.xMin + 20,
      y: rect.yMin + 20
    };
  }

  function createTarget(){
    const id = String(STATE.idSeq++);
    const el = DOC.createElement('div');
    el.className = 'tgt';
    el.dataset.id = id;
    el.setAttribute('role','button');

    const gMission = STATE.curGroup || pick(STATE.rng, GROUPS);
    let emoji = '';
    let groupId = gMission.id;
    let mission = false;

    const correctP = (STATE.stage === 'boss') ? Math.max(0.80, STATE.correctP) : STATE.correctP;
    if(STATE.rng() < correctP){
      emoji = pick(STATE.rng, gMission.items);
      mission = true;
      groupId = gMission.id;
    }else{
      const others = GROUPS.filter(g=>g.id !== gMission.id);
      const og = pick(STATE.rng, others);
      emoji = pick(STATE.rng, og.items);
      mission = false;
      groupId = og.id;
    }
    el.textContent = emoji;

    const size = 74;
    const p = pickSpawnPoint(size);

    el.style.position = 'absolute';
    el.style.left = `${p.x}px`;
    el.style.top  = `${p.y}px`;
    el.style.transform = 'translate(-50%,-50%) scale(.88)';
    el.style.opacity = '0';
    el.style.transition = 'transform 160ms ease, opacity 140ms ease';
    STATE.layerEl.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    const frac = clamp(STATE.elapsed / Math.max(1, STATE.plannedSec), 0, 1);
    const shrink =
      (STATE.runMode === 'practice') ? 1 :
      (STATE.diff === 'easy') ? (1 - 0.14*frac) :
      (STATE.diff === 'hard') ? (1 - 0.24*frac) : (1 - 0.18*frac);
    const ttl = Math.max(1.35, STATE.baseTtl * shrink);
    const ttlMs = ttl * 1000;

    const obj = { id, el, emoji, born: nowMs(), ttlMs, mission, groupId, x:p.x, y:p.y };
    STATE.map.set(id, obj);

    try{ AI()?.onSpawn?.(mission ? 'groups_target' : 'groups_other', { id, emoji, ttlSec: ttl, groupId }); }catch(_){}

    return obj;
  }

  function removeTarget(id, mode){
    const t = STATE.map.get(String(id));
    if(!t) return;
    STATE.map.delete(String(id));
    try{
      if(mode === 'hit'){
        t.el.style.transform = 'translate(-50%,-50%) scale(.78)';
        t.el.style.opacity = '0';
      }else{
        t.el.style.transform = 'translate(-50%,-50%) scale(.92)';
        t.el.style.opacity = '0';
      }
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){ } }, 140);
    }catch(_){
      try{ t.el.remove(); }catch(__){}
    }
  }

  // ---------------------------
  // HUD + quest/power/group
  // ---------------------------
  function emitHUD(){
    emit('hha:time', { left: Math.ceil(STATE.tLeft) });
    emit('hha:score', {
      score: STATE.score|0,
      combo: STATE.combo|0,
      misses: STATE.miss|0,
      accPct: accPct()
    });
    emit('hha:rank', { grade: gradeLetter() });

    emit('quest:update', {
      goalTitle: (STATE.stage==='boss') ? 'BOSS: ยิงให้ถูกหมู่ให้ได้มากสุด' : 'ภารกิจ: ยิงให้ถูก “หมู่”',
      goalNow: STATE.goalNow,
      goalTotal: STATE.goalTotal,
      groupName: STATE.curGroup ? STATE.curGroup.name : '—',
      miniTitle: (STATE.stage==='boss') ? 'BOSS' : 'POWER',
      miniNow: (STATE.stage==='boss') ? STATE.bossHits : STATE.charge,
      miniTotal: (STATE.stage==='boss') ? 999 : STATE.chargeNeed,
      miniTimeLeftSec: (STATE.stage==='boss') ? Math.ceil(STATE.bossLeft) : 0
    });

    emit('groups:power', { charge: STATE.charge, threshold: STATE.chargeNeed });
  }

  function coach(text, mood){
    emit('hha:coach', { text: String(text||''), mood: String(mood||'neutral') });
  }

  function switchGroup(){
    STATE.curGroup = pick(STATE.rng, GROUPS);
    STATE.charge = 0;
    STATE.chargeNeed = clamp(STATE.chargeNeed + 1, 8, 12);
    STATE.goalNow = 0;

    emit('groups:group', { id: STATE.curGroup.id, name: STATE.curGroup.name, short: STATE.curGroup.short });
    coach(`สลับหมู่! หา “${STATE.curGroup.short}” 🎯`, 'neutral');
    emitHUD();

    try{ AI()?.onTick?.(0, { stage: STATE.stage, miss: STATE.miss, combo: STATE.combo, acc: accPct() }); }catch(_){}
  }

  function powerAdd(n){
    STATE.charge = Math.max(0, (STATE.charge|0) + (n|0));
    emit('groups:power', { charge: STATE.charge, threshold: STATE.chargeNeed });
    if(STATE.charge >= STATE.chargeNeed){
      switchGroup();
    }
  }

  // ---------------------------
  // Hit logic + FX
  // ---------------------------
  function fxAtEl(el, text, good){
    try{
      const hostRect = STATE.layerEl.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const x = (b.left + b.width/2) - hostRect.left;
      const y = (b.top + b.height/2) - hostRect.top;
      FX.burst(x, y, good);
      if(text) FX.pop(x, y, text, good);
      emit('groups:hit', { x, y, good: !!good, kind: good?'hit_good':'hit_bad' });
    }catch(_){}
  }

  function onHit(obj){
    STATE.shots++;

    const isCorrect = (obj.mission === true) && (STATE.curGroup && obj.groupId === STATE.curGroup.id);

    if(isCorrect){
      STATE.hits++;
      STATE.goalNow++;
      STATE.combo++;
      STATE.bestCombo = Math.max(STATE.bestCombo, STATE.combo);

      const comboBonus = Math.min(12, STATE.combo);
      const add = 10 + comboBonus;
      STATE.score += add;

      powerAdd(1);

      if(STATE.stage === 'boss'){
        STATE.bossHits++;
        if(STATE.bossHits === 1) coach('บอสเริ่มแล้ว! คุมคอมโบไว้ ⚡', 'fever');
      }else if(STATE.combo === 4){
        coach('คอมโบมาแล้ว! รักษาจังหวะ 🔥', 'happy');
      }else if(STATE.goalNow % 5 === 0){
        coach(`ดีมาก! ต่อไปเน้น “${STATE.curGroup.short}” 🎯`, 'neutral');
      }

      fxAtEl(obj.el, `+${add}`, true);

      try{ AI()?.onHit?.('groups_ok', { id: obj.id, emoji: obj.emoji, add, combo: STATE.combo, score: STATE.score }); }catch(_){}
      removeTarget(obj.id, 'hit');
      emitHUD();
      return;
    }

    STATE.combo = 0;
    STATE.score = Math.max(0, STATE.score - 3);
    fxAtEl(obj.el, '-3', false);

    coach('ดูชื่อหมู่ก่อนนะ แล้วค่อยยิง ✅', 'neutral');

    try{ AI()?.onHit?.('groups_wrong', { id: obj.id, emoji: obj.emoji, wanted: STATE.curGroup?.id }); }catch(_){}
    removeTarget(obj.id, 'hit');
    emitHUD();
  }

  function pointerHandler(ev){
    if(!STATE.running || STATE.paused) return;
    const el = ev.target && ev.target.closest ? ev.target.closest('.tgt') : null;
    if(!el) return;
    const obj = STATE.map.get(String(el.dataset.id));
    if(obj) onHit(obj);
  }

  function pickNearestByXY(x, y, lockPx){
    lockPx = clamp(lockPx, 0, 160);
    if(lockPx <= 0) return null;

    const hostRect = STATE.layerEl.getBoundingClientRect();
    const lx = x - hostRect.left;
    const ly = y - hostRect.top;

    let best=null, bestD2 = (lockPx*lockPx) + 1;
    for(const obj of STATE.map.values()){
      const dx = obj.x - lx;
      const dy = obj.y - ly;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD2){
        bestD2 = d2;
        best = obj;
      }
    }
    return best;
  }

  function shootHandler(ev){
    if(!STATE.running || STATE.paused) return;

    const t = nowMs();
    if(t - (STATE.lastShotAt||0) < STATE.shotCooldownMs) return;
    STATE.lastShotAt = t;

    const d = ev && ev.detail ? ev.detail : {};
    const lockPx = clamp(d.lockPx ?? 22, 0, 160);

    let obj = null;
    if(d.x != null && d.y != null){
      obj = pickNearestByXY(Number(d.x)||0, Number(d.y)||0, lockPx);
    }else{
      try{
        const r = STATE.layerEl.getBoundingClientRect();
        obj = pickNearestByXY(r.left + r.width/2, r.top + r.height/2, lockPx);
      }catch(_){}
    }

    if(obj) onHit(obj);
  }

  // ---------------------------
  // Spawn / expire
  // ---------------------------
  function liveCap(){
    if(STATE.view === 'pc') return 7;
    if(STATE.view === 'cvr') return 6;
    return 5;
  }

  function spawnTick(dt){
    const frac = clamp(STATE.elapsed / Math.max(1, STATE.plannedSec), 0, 1);
    const ramp =
      (STATE.runMode === 'practice') ? 1 :
      (STATE.diff === 'easy') ? (1 + 0.10*frac) :
      (STATE.diff === 'hard') ? (1 + 0.18*frac) : (1 + 0.14*frac);

    const sp = STATE.baseSpawnPerSec * ramp;

    STATE.spawnAcc += sp * dt;
    while(STATE.spawnAcc >= 1){
      STATE.spawnAcc -= 1;
      if(STATE.map.size < liveCap()){
        createTarget();
      }
    }
  }

  function expireTick(){
    const t = nowMs();
    for(const obj of Array.from(STATE.map.values())){
      if(t - obj.born >= obj.ttlMs){
        if(STATE.runMode !== 'practice'){
          const isFair = (obj.mission && STATE.curGroup && obj.groupId === STATE.curGroup.id);
          const occ = isOccludedAtCenter(obj.el);
          if(isFair && !occ){
            STATE.miss++;
            STATE.combo = 0;
            STATE.score = Math.max(0, STATE.score - 2);
            try{ AI()?.onExpire?.('groups_target', { id: obj.id, emoji: obj.emoji, occluded: 0 }); }catch(_){}
          }else{
            STATE.score = Math.max(0, STATE.score - 1);
            try{ AI()?.onExpire?.('groups_other', { id: obj.id, emoji: obj.emoji, occluded: occ?1:0 }); }catch(_){}
          }
        }
        removeTarget(obj.id, 'expire');
        emitHUD();
      }
    }
  }

  function startBoss(){
    STATE.stage = 'boss';
    STATE.bossSec = clamp(STATE.ctx?.bossSec ?? 12, 10, 16);
    STATE.bossLeft = STATE.bossSec;
    STATE.bossHits = 0;
    STATE.curGroup = pick(STATE.rng, GROUPS);

    emit('groups:group', { id: STATE.curGroup.id, name: STATE.curGroup.name, short: STATE.curGroup.short });
    coach(`MINI BOSS! ⚡ เน้น “${STATE.curGroup.short}” ให้ได้เยอะสุดใน ${STATE.bossSec}s`, 'fever');
    emitHUD();
  }

  function buildSummary(reason){
    return {
      projectTag: 'GroupsVR',
      gameVersion: 'GroupsVR_SAFE_2026-03-06b',
      device: STATE.view,
      runMode: STATE.runMode,
      diff: STATE.diff,
      seed: STATE.seedStr,
      reason: String(reason||''),
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
      bossSec: (STATE.stage==='boss') ? STATE.bossSec : 0,
      bossHits: (STATE.stage==='boss') ? STATE.bossHits : 0,
      groupLast: STATE.curGroup ? STATE.curGroup.name : '—',
      aiPredictionLast: (function(){ try{ return AI()?.getPrediction?.() || null; }catch(_){ return null; } })()
    };
  }

  function endGame(reason){
    if(!STATE.running) return;
    STATE.running = false;
    STATE.paused = false;

    try{ cancelAnimationFrame(STATE.raf); }catch(_){}
    STATE.raf = 0;

    const summary = buildSummary(reason);

    try{ AI()?.onEnd?.(summary); }catch(_){}
    emit('hha:end', summary);

    clearTargets();
  }

  // ---------------------------
  // Main loop
  // ---------------------------
  function tick(){
    if(!STATE.running) return;

    if(STATE.paused){
      STATE.lastTick = nowMs();
      STATE.raf = requestAnimationFrame(tick);
      return;
    }

    const t = nowMs();
    const dt = Math.min(0.05, Math.max(0.001, (t - STATE.lastTick)/1000));
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

    try{ AI()?.onTick?.(dt, { miss: STATE.miss, combo: STATE.combo, acc: accPct(), stage: STATE.stage }); }catch(_){}

    emitHUD();

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

  // ---------------------------
  // API
  // ---------------------------
  function setLayerEl(el){
    STATE.layerEl = el || null;
    if(STATE.layerEl){
      FX.mount(STATE.layerEl);
    }
  }

  function bindListeners(){
    if(STATE.bound) return;
    STATE.bound = true;

    try{ STATE.layerEl && STATE.layerEl.addEventListener('pointerdown', pointerHandler, { passive:true }); }catch(_){}
    try{ WIN.addEventListener('hha:shoot', shootHandler, { passive:true }); }catch(_){}
  }

  function unbindListeners(){
    if(!STATE.bound) return;
    STATE.bound = false;

    try{ STATE.layerEl && STATE.layerEl.removeEventListener('pointerdown', pointerHandler); }catch(_){}
    try{ WIN.removeEventListener('hha:shoot', shootHandler); }catch(_){}
  }

  function start(diff, ctx){
    ctx = ctx || {};
    if(!STATE.layerEl) throw new Error('[GroupsVR] layerEl not set. Call setLayerEl() first');

    stop();

    STATE.ctx = ctx;
    STATE.diff = String(diff||'normal').toLowerCase();
    STATE.runMode = String(ctx.runMode || qs('run','play') || 'play').toLowerCase();
    if(STATE.runMode !== 'research' && STATE.runMode !== 'practice') STATE.runMode = 'play';

    STATE.view = String(ctx.view || DOC.body.getAttribute('data-view') || qs('view','mobile') || 'mobile').toLowerCase();

    const timeSec = clamp(ctx.time ?? qs('time', 90) ?? 90, 15, 300);
    STATE.plannedSec = timeSec;
    STATE.tLeft = timeSec;

    STATE.seedStr = String(ctx.seed ?? qs('seed','') ?? Date.now());
    STATE.rng = makeRng(STATE.seedStr);

    STATE.baseSpawnPerSec = 0.98;
    STATE.baseTtl = 3.35;
    STATE.correctP = 0.74;

    if(STATE.diff === 'easy'){
      STATE.baseSpawnPerSec = 0.88;
      STATE.baseTtl = 3.60;
      STATE.correctP = 0.76;
    }
    if(STATE.diff === 'hard'){
      STATE.baseSpawnPerSec = 1.10;
      STATE.baseTtl = 3.00;
      STATE.correctP = 0.72;
    }
    if(STATE.runMode === 'practice'){
      STATE.baseSpawnPerSec *= 0.90;
      STATE.baseTtl += 0.30;
    }

    STATE.startMs = nowMs();
    STATE.lastTick = STATE.startMs;
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
    STATE.bossSec = clamp(ctx.bossSec ?? 12, 10, 16);
    STATE.bossLeft = 0;
    STATE.bossHits = 0;

    STATE.spawnAcc = 0;
    STATE.idSeq = 1;
    STATE.lastShotAt = 0;

    clearTargets();

    STATE.curGroup = pick(STATE.rng, GROUPS);
    emit('groups:group', { id: STATE.curGroup.id, name: STATE.curGroup.name, short: STATE.curGroup.short });
    emit('groups:director', {
      text: (WIN.HHA_AI && (String(qs('ai','0')).toLowerCase()==='1') && STATE.runMode!=='research')
        ? 'AI ON'
        : (STATE.runMode==='practice' ? 'PRACTICE' : STATE.runMode==='research' ? 'RESEARCH' : 'PLAY')
    });

    bindListeners();

    if(STATE.runMode === 'practice'){
      coach('PRACTICE 15s — ซ้อมก่อน (ไม่ลงโทษหนัก) 🧪', 'neutral');
    }else{
      coach(`เริ่มแล้ว! หา “${STATE.curGroup.short}” แล้วเก็บคอมโบ 🔥`, 'neutral');
    }

    try{ AI()?.reset?.(); }catch(_){}

    STATE.running = true;
    STATE.paused = false;

    emitHUD();
    STATE.raf = requestAnimationFrame(tick);
    return true;
  }

  function stop(){
    unbindListeners();

    STATE.running = false;
    STATE.paused = false;

    try{ cancelAnimationFrame(STATE.raf); }catch(_){}
    STATE.raf = 0;

    clearTargets();
  }

  function setPaused(on){
    STATE.paused = !!on;
    STATE.lastTick = nowMs();
  }

  // ---------------------------
  // Telemetry stub
  // ---------------------------
  const Telemetry = {
    flush: function(summary){
      try{
        // WIN.HHA_CloudLogger?.flush?.(summary)
      }catch(_){}
    }
  };

  function bindFlushOnLeave(getSummary){
    const safeGet = ()=>{ try{ return (typeof getSummary === 'function') ? getSummary() : null; }catch(_){ return null; } };
    const doFlush = ()=>{ try{ Telemetry.flush(safeGet()); }catch(_){ } };

    WIN.addEventListener('pagehide', doFlush, { passive:true });
    WIN.addEventListener('beforeunload', doFlush, { passive:true });
    DOC.addEventListener('visibilitychange', ()=>{
      if(DOC.visibilityState === 'hidden') doFlush();
    }, { passive:true });
  }

  // ---------------------------
  // Expose
  // ---------------------------
  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.Telemetry = Telemetry;
  WIN.GroupsVR.bindFlushOnLeave = bindFlushOnLeave;
  WIN.GroupsVR.GameEngine = {
    setLayerEl,
    start,
    stop,
    setPaused
  };

  WIN.addEventListener('hha:pause', ()=> setPaused(true), { passive:true });
  WIN.addEventListener('hha:resume', ()=> setPaused(false), { passive:true });

})();