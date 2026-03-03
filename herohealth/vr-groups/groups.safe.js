// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE — PRODUCTION (Classroom-ready + Practice + cVR shoot + RAMP + STREAK + FAIR MISS + AI warn)
// FULL v20260303d-GROUPS-CLASSROOM-RAMP-STREAK-AIWARN-FAIRMISS
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

  function xmur3(str){
    str=String(str||'');
    let h=1779033703^str.length;
    for(let i=0;i<str.length;i++){
      h=Math.imul(h^str.charCodeAt(i),3432918353);
      h=(h<<13)|(h>>>19);
    }
    return function(){
      h=Math.imul(h^(h>>>16),2246822507);
      h=Math.imul(h^(h>>>13),3266489909);
      return (h^=(h>>>16))>>>0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a>>>=0;b>>>=0;c>>>=0;d>>>=0;
      let t=(a+b)|0;
      a=b^(b>>>9);
      b=(c+(c<<3))|0;
      c=(c<<21)|(c>>>11);
      d=(d+1)|0;
      t=(t+d)|0;
      c=(c+t)|0;
      return (t>>>0)/4294967296;
    };
  }
  function makeRng(seedStr){
    const s=xmur3(seedStr);
    return sfc32(s(),s(),s(),s());
  }
  const pick = (rng, arr)=> arr[(rng()*arr.length)|0];

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }
  function coach(text, mood){
    emit('hha:coach', { text: String(text||''), mood: String(mood||'neutral') });
  }

  // Safe spawn rect (หลบ HUD)
  function getSafeRect(layerEl){
    const s = WIN.__HHA_SPAWN_SAFE__;
    if(s && Number.isFinite(s.xMin)) return s;
    const r = layerEl.getBoundingClientRect();
    const PAD = 14;
    return {
      xMin: r.left + PAD,
      xMax: r.right - PAD,
      yMin: r.top + 120,
      yMax: r.bottom - 140
    };
  }

  // ---------------------------
  // Content: Thai 5 food groups (fixed)
  // ---------------------------
  const GROUPS = [
    { id:1, short:'หมู่ 1', name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, short:'หมู่ 2', name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, short:'หมู่ 3', name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, short:'หมู่ 4', name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, short:'หมู่ 5', name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] },
  ];

  // ---------------------------
  // AI warn (rate-limit) + ramp + streak
  // ---------------------------
  const WARN_GAP_MS = 2200;
  let __lastWarnMs = 0;

  function smooth01(x){
    x = Math.max(0, Math.min(1, x));
    return x*x*(3-2*x);
  }
  function rampMul(elapsedSec, plannedSec, runMode, diff){
    if(runMode === 'practice') return 1;
    const RAMP_MAX = (diff==='easy') ? 0.16 : (diff==='hard') ? 0.30 : 0.22;
    return 1 + RAMP_MAX * smooth01(elapsedSec / Math.max(1, plannedSec));
  }
  function ttlShrinkMul(elapsedSec, plannedSec, runMode, diff){
    if(runMode === 'practice') return 1;
    const SHR = (diff==='easy') ? 0.16 : (diff==='hard') ? 0.28 : 0.22;
    return 1 - SHR * smooth01(elapsedSec / Math.max(1, plannedSec));
  }
  function streakBonus(combo){
    if(combo >= 10) return 10;
    if(combo >= 7)  return 7;
    if(combo >= 5)  return 5;
    if(combo >= 3)  return 3;
    return 0;
  }
  function aiWarnMaybe(elapsedSec, plannedSec, accPct, miss, combo, stage){
    const t = nowMs();
    if(t - __lastWarnMs < WARN_GAP_MS) return;

    let hazard = null;
    try{
      const pred = WIN.HHA_AI?.getPrediction?.() || null;
      if(pred && pred.hazardRisk != null) hazard = Number(pred.hazardRisk);
    }catch(_){}

    const late = elapsedSec > plannedSec*0.55;

    let msg = '';
    let mood = 'neutral';

    if(stage === 'boss'){
      msg = 'บอสมา! เน้น “หมู่เดียว” ให้แม่น แล้วคุมคอมโบ ⚡';
      mood = 'fever';
    }else if(hazard != null && hazard >= 0.78 && late){
      msg = 'เริ่มพลาดถี่—ช้าลงนิด แล้วเล็งให้ตรงหมู่ 🎯';
      mood = 'sad';
    }else if(accPct < 55){
      msg = 'โฟกัส “หมู่ที่ถูก” ก่อน อย่ายิงมั่ว 👀';
      mood = 'neutral';
    }else if(combo >= 5){
      msg = 'คอมโบมา! รักษาจังหวะ 🔥';
      mood = 'happy';
    }else if(late){
      msg = 'ช่วงท้ายเริ่มเดือดขึ้น—ใจเย็น แล้วคุมคอมโบ 🎯';
      mood = 'neutral';
    }else{
      return;
    }

    __lastWarnMs = t;
    coach(msg, mood);
  }

  // ---------------------------
  // Core engine
  // ---------------------------
  const STATE = {
    layerEl: null,
    running: false,
    paused: false,
    raf: 0,

    // config
    diff: 'normal',
    ctx: null,
    runMode: 'play',
    plannedSec: 90,
    seedStr: '',
    view: 'mobile',

    // rng
    rng: null,

    // game
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

    // quest/mission
    curGroup: null,
    goalTotal: 10,
    goalNow: 0,

    // power
    charge: 0,
    chargeNeed: 8,

    // stage flow
    stage: 'main', // main | boss
    bossLeft: 0,
    bossSec: 12,
    bossHits: 0,

    // spawn
    spawnAcc: 0,
    baseSpawnPerSec: 1.20,
    baseTtl: 2.9,

    // targets
    map: new Map(),
    idSeq: 1,

    // fairness
    // ✅ miss นับเฉพาะ “เป้าถูกหมู่” ที่ปล่อยหลุด (ไม่ใช่ทุกอย่าง)
  };

  function accPct(){
    return STATE.shots > 0 ? Math.round((STATE.hits/STATE.shots)*100) : 0;
  }
  function gradeLetter(){
    const a = accPct();
    const x = (a * 0.65) + (STATE.bestCombo * 1.2) - Math.min(20, STATE.miss) * 0.8;
    if(x>=92) return 'S';
    if(x>=80) return 'A';
    if(x>=66) return 'B';
    if(x>=50) return 'C';
    return 'D';
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

  function posInSafe(){
    const r = getSafeRect(STATE.layerEl);
    const x = r.xMin + STATE.rng() * Math.max(1, (r.xMax - r.xMin));
    const y = r.yMin + STATE.rng() * Math.max(1, (r.yMax - r.yMin));
    return { x, y };
  }

  function createTarget(isMission){
    const id = String(STATE.idSeq++);
    const el = DOC.createElement('div');
    el.className = 'tgt';
    el.dataset.id = id;

    const gMission = (STATE.stage==='boss') ? STATE.curGroup : STATE.curGroup;
    let emoji = '';
    let groupId = gMission.id;
    let mission = !!isMission;

    // boss เน้นถูกมากขึ้นให้ “รู้สึกเก่ง”
    const correctP = (STATE.stage==='boss') ? 0.82 : 0.72;
    if(STATE.rng() < correctP){
      emoji = pick(STATE.rng, gMission.items);
      mission = true;
      groupId = gMission.id;
    }else{
      const others = GROUPS.filter(g=>g.id!==gMission.id);
      const og = pick(STATE.rng, others);
      emoji = pick(STATE.rng, og.items);
      mission = false;
      groupId = og.id;
    }

    el.textContent = emoji;

    const p = posInSafe();
    el.style.position = 'absolute';
    el.style.left = `${p.x}px`;
    el.style.top  = `${p.y}px`;
    el.style.transform = 'translate(-50%,-50%)';

    STATE.layerEl.appendChild(el);

    const born = nowMs();
    const ttlMul = ttlShrinkMul(STATE.elapsed, STATE.plannedSec, STATE.runMode, STATE.diff);
    const ttl = Math.max(1.15, STATE.baseTtl * ttlMul);
    const ttlMs = ttl * 1000;

    const obj = { id, el, emoji, born, ttlMs, mission, groupId };
    STATE.map.set(id, obj);

    try{
      WIN.HHA_AI?.onSpawn?.(mission ? 'groups_target' : 'groups_other', { id, emoji, ttlSec: ttl });
    }catch(_){}
    return obj;
  }

  function removeTarget(id, cls){
    const t = STATE.map.get(String(id));
    if(!t) return;
    STATE.map.delete(String(id));
    try{
      if(cls) t.el.classList.add(cls);
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){ } }, 120);
    }catch(_){}
  }

  function powerAdd(n){
    STATE.charge = Math.max(0, (STATE.charge|0) + (n|0));
    emit('groups:power', { charge: STATE.charge, threshold: STATE.chargeNeed });
    if(STATE.charge >= STATE.chargeNeed){
      // ได้ “สลับหมู่” (คล้าย power-up)
      STATE.charge = 0;
      STATE.chargeNeed = clamp(STATE.chargeNeed + 1, 8, 12);
      STATE.curGroup = pick(STATE.rng, GROUPS);
      emit('groups:group', { id: STATE.curGroup.id, name: STATE.curGroup.name, short: STATE.curGroup.short });
      emit('quest:update', {
        goalTitle: 'ยิงให้ถูก “หมู่”',
        goalNow: STATE.goalNow,
        goalTotal: STATE.goalTotal,
        groupName: STATE.curGroup.name,
        miniTitle: (STATE.stage==='boss') ? 'BOSS' : 'POWER',
        miniNow: (STATE.stage==='boss') ? STATE.bossHits : STATE.charge,
        miniTotal: (STATE.stage==='boss') ? 999 : STATE.chargeNeed
      });
      coach(`สลับภารกิจ! หา “${STATE.curGroup.short}” 🎯`, 'neutral');
    }
  }

  function onHit(obj){
    STATE.shots++;

    const isCorrect = (obj.mission === true) && (obj.groupId === STATE.curGroup.id);

    if(isCorrect){
      STATE.hits++;
      STATE.goalNow++;
      STATE.combo++;
      STATE.bestCombo = Math.max(STATE.bestCombo, STATE.combo);

      const add = 10 + Math.min(10, STATE.combo) + streakBonus(STATE.combo);
      STATE.score += add;

      powerAdd(1);

      if(STATE.stage==='boss'){
        STATE.bossHits++;
        if(STATE.bossHits === 1) coach('บอสเริ่มแล้ว! คุมคอมโบไว้ ⚡', 'fever');
      }else if(STATE.combo === 4){
        coach('คอมโบมาแล้ว! รักษาจังหวะ 🔥', 'happy');
      }else if(STATE.goalNow % 5 === 0){
        coach(`ดีมาก! ต่อไปเน้น “${STATE.curGroup.short}” 🎯`, 'neutral');
      }

      try{ WIN.HHA_AI?.onHit?.('groups_ok', { id: obj.id, emoji: obj.emoji, add }); }catch(_){}
      removeTarget(obj.id, 'hit');
      return;
    }

    // wrong
    STATE.combo = 0;
    STATE.score = Math.max(0, STATE.score - 3);

    try{ WIN.HHA_AI?.onHit?.('groups_wrong', { id: obj.id, emoji: obj.emoji }); }catch(_){}
    removeTarget(obj.id, 'hit');
  }

  function pointerHandler(ev){
    if(!STATE.running || STATE.paused) return;
    const el = ev.target && ev.target.closest ? ev.target.closest('.tgt') : null;
    if(!el) return;
    const obj = STATE.map.get(String(el.dataset.id));
    if(obj) onHit(obj);
  }

  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 22, 16, 140);
    let best=null, bestD=1e9;
    const r = STATE.layerEl.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;

    for(const obj of STATE.map.values()){
      const b = obj.el.getBoundingClientRect();
      const x = b.left + b.width/2;
      const y = b.top + b.height/2;
      const d = Math.hypot(x-cx, y-cy);
      if(d < bestD){ bestD=d; best=obj; }
    }
    if(best && bestD <= lockPx) return best;
    return null;
  }

  function shootHandler(ev){
    if(!STATE.running || STATE.paused) return;
    const lockPx = ev && ev.detail && ev.detail.lockPx != null ? ev.detail.lockPx : 22;
    const obj = pickClosestToCenter(lockPx);
    if(obj) onHit(obj);
  }

  function setHUD(){
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

  function spawnTick(dt){
    const mul = rampMul(STATE.elapsed, STATE.plannedSec, STATE.runMode, STATE.diff);
    const sp = STATE.baseSpawnPerSec * mul;

    STATE.spawnAcc += sp * dt;
    while(STATE.spawnAcc >= 1){
      STATE.spawnAcc -= 1;
      createTarget(true);
    }
  }

  function expireTick(){
    const t = nowMs();
    for(const obj of Array.from(STATE.map.values())){
      if(t - obj.born >= obj.ttlMs){
        // ✅ FAIR MISS: นับ miss เฉพาะ “mission target” ที่ปล่อยหลุด (ไม่ใช่ทุกอัน)
        if(STATE.runMode !== 'practice'){
          if(obj.mission && obj.groupId === STATE.curGroup.id){
            STATE.miss++;
            STATE.combo = 0;
            STATE.score = Math.max(0, STATE.score - 2);
            try{ WIN.HHA_AI?.onExpire?.('groups_target', { id: obj.id, emoji: obj.emoji }); }catch(_){}
          }else{
            // อันไม่ใช่ภารกิจ: ไม่ควรทำให้เด็ก “รู้สึกผิด” หนัก
            STATE.score = Math.max(0, STATE.score - 1);
            try{ WIN.HHA_AI?.onExpire?.('groups_other', { id: obj.id, emoji: obj.emoji }); }catch(_){}
          }
        }
        removeTarget(obj.id, 'expire');
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
  }

  function buildSummary(reason){
    return {
      projectTag: 'GroupsVR',
      gameVersion: 'GroupsVR_SAFE_2026-03-03d',
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
      aiPredictionLast: (function(){ try{ return WIN.HHA_AI?.getPrediction?.() || null; }catch(_){ return null; } })()
    };
  }

  function endGame(reason){
    if(!STATE.running) return;
    STATE.running = false;
    STATE.paused = false;

    cancelAnimationFrame(STATE.raf);
    clearTargets();

    const summary = buildSummary(reason);
    try{ WIN.HHA_AI?.onEnd?.(summary); }catch(_){}

    // ส่ง event ที่หน้า run ฟังอยู่
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
    const dt = Math.min(0.05, Math.max(0.001, (t - STATE.lastTick)/1000));
    STATE.lastTick = t;

    STATE.elapsed += dt;
    STATE.tLeft = Math.max(0, STATE.tLeft - dt);

    // stage timers
    if(STATE.stage === 'boss'){
      STATE.bossLeft = Math.max(0, STATE.bossLeft - dt);
      if(STATE.bossLeft <= 0){
        endGame('boss-done');
        return;
      }
    }

    spawnTick(dt);
    expireTick();

    // AI tick (prediction only)
    try{ WIN.HHA_AI?.onTick?.(dt, { miss: STATE.miss, combo: STATE.combo, acc: accPct(), stage: STATE.stage }); }catch(_){}

    // HUD + coach warn
    setHUD();
    aiWarnMaybe(STATE.elapsed, STATE.plannedSec, accPct(), STATE.miss, STATE.combo, STATE.stage);

    // end conditions
    if(STATE.tLeft <= 0){
      // classroom: ถ้าไม่ใช่ practice ให้เข้า boss ต่อ (ถ้าเปิด)
      const classroom = !!STATE.ctx?.classroom;
      const bossOn = !!STATE.ctx?.miniBoss;
      if(classroom && bossOn && STATE.stage === 'main' && STATE.runMode !== 'practice'){
        startBoss();
        // ให้มีเวลาคั่นนิดเดียว
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
    if(!STATE.layerEl){ throw new Error('[GroupsVR] layerEl not set. Call setLayerEl() first'); }

    // stop any previous
    stop();

    STATE.diff = String(diff||'normal').toLowerCase();
    STATE.ctx = ctx;
    STATE.runMode = String(ctx.runMode || 'play').toLowerCase();
    STATE.view = String(ctx.view || DOC.body.getAttribute('data-view') || 'mobile').toLowerCase();

    const timeSec = clamp(ctx.time ?? 90, 15, 300);
    STATE.plannedSec = timeSec;
    STATE.seedStr = String(ctx.seed ?? Date.now());
    STATE.rng = makeRng(STATE.seedStr);

    // base tuning
    STATE.baseSpawnPerSec = 1.20;
    STATE.baseTtl = 2.90;

    if(STATE.diff === 'easy'){ STATE.baseSpawnPerSec = 1.05; STATE.baseTtl = 3.20; }
    if(STATE.diff === 'hard'){ STATE.baseSpawnPerSec = 1.38; STATE.baseTtl = 2.60; }
    if(STATE.runMode === 'practice'){ STATE.baseSpawnPerSec *= 0.92; STATE.baseTtl += 0.25; }

    // init state
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
    STATE.spawnAcc = 0;
    STATE.idSeq = 1;
    clearTargets();

    STATE.curGroup = pick(STATE.rng, GROUPS);
    emit('groups:group', { id: STATE.curGroup.id, name: STATE.curGroup.name, short: STATE.curGroup.short });

    // hooks
    try{
      // pointer for pc/mobile
      STATE.layerEl.addEventListener('pointerdown', pointerHandler, { passive:true });
    }catch(_){}
    try{
      WIN.addEventListener('hha:shoot', shootHandler);
    }catch(_){}

    // tell UI
    if(STATE.runMode === 'practice'){
      coach('PRACTICE 15s — ซ้อมก่อน (ไม่คิด miss หนัก) 🧪', 'neutral');
    }else{
      coach(`เริ่มแล้ว! หา “${STATE.curGroup.short}” แล้วเก็บคอมโบ 🔥`, 'neutral');
    }

    setHUD();
    STATE.raf = requestAnimationFrame(tick);
  }

  function stop(){
    // remove listeners
    try{ if(STATE.layerEl) STATE.layerEl.removeEventListener('pointerdown', pointerHandler); }catch(_){}
    try{ WIN.removeEventListener('hha:shoot', shootHandler); }catch(_){}

    STATE.running = false;
    STATE.paused = false;
    cancelAnimationFrame(STATE.raf);
    clearTargets();
  }

  function setPaused(on){
    STATE.paused = !!on;
    STATE.lastTick = nowMs();
  }

  // ---------------------------
  // Telemetry (safe stub)
  // ---------------------------
  const Telemetry = {
    flush: function(summary){
      try{
        // ถ้ามี cloud logger จริง ให้เรียกตรงนี้
        // WIN.HHA_CloudLogger?.flush?.(summary)
      }catch(_){}
    }
  };

  function bindFlushOnLeave(getSummary){
    const safeGet = ()=>{ try{ return (typeof getSummary === 'function') ? getSummary() : null; }catch(_){ return null; } };
    const doFlush = ()=>{
      try{ Telemetry.flush(safeGet()); }catch(_){}
    };
    WIN.addEventListener('pagehide', doFlush, { passive:true });
    WIN.addEventListener('beforeunload', doFlush, { passive:true });
    DOC.addEventListener('visibilitychange', ()=>{
      if(DOC.visibilityState === 'hidden') doFlush();
    }, { passive:true });
  }

  // ---------------------------
  // Expose API expected by groups-vr.html
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

  // optional: external pause events
  WIN.addEventListener('hha:pause', ()=> setPaused(true), { passive:true });
  WIN.addEventListener('hha:resume', ()=> setPaused(false), { passive:true });

})();