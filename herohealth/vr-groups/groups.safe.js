// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE — PRODUCTION (Classroom-ready + Practice + cVR shoot + RAMP + STREAK + FAIR MISS + AI warn + FX + SFX + WIGGLE)
// FULL v20260303f-GROUPS-CLASSROOM-RAMP-STREAK-AIWARN-FAIRMISS-FX-SFX-WIGGLE
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

  // ---------------------------
  // FX Pack (popup score, burst, flash, shake)
  // ---------------------------
  const FX = (function(){
    let layerEl=null, fxEl=null, styleInstalled=false, shakeT=0;

    function installStyleOnce(){
      if(styleInstalled) return;
      styleInstalled = true;
      const st = DOC.createElement('style');
      st.textContent = `
      .hha-fx{ position:absolute; inset:0; pointer-events:none; overflow:hidden; contain:layout style paint; }
      .hha-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font-family: system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", sans-serif;
        font-weight: 1000;
        font-size: 14px;
        letter-spacing:.2px;
        opacity:0;
        filter: drop-shadow(0 6px 14px rgba(0,0,0,.35));
        transition: transform 520ms ease, opacity 520ms ease;
        will-change: transform, opacity;
        white-space: nowrap;
      }
      .hha-pop.good{ color: rgba(34,197,94,.95); }
      .hha-pop.bad{  color: rgba(239,68,68,.95); }
      .hha-pop.neu{  color: rgba(229,231,235,.90); }

      .hha-burst{
        position:absolute;
        width: 12px; height: 12px;
        border-radius: 999px;
        transform: translate(-50%,-50%) scale(.6);
        opacity:0;
        transition: transform 320ms ease, opacity 320ms ease;
        will-change: transform, opacity;
      }
      .hha-burst.good{
        background: rgba(34,197,94,.22);
        border: 1px solid rgba(34,197,94,.34);
      }
      .hha-burst.bad{
        background: rgba(239,68,68,.18);
        border: 1px solid rgba(239,68,68,.30);
      }

      .hha-flash{
        position:absolute; inset:0;
        opacity:0;
        pointer-events:none;
        transition: opacity 140ms ease;
      }
      .hha-flash.good{ background: radial-gradient(circle at 50% 50%, rgba(34,197,94,.14), rgba(34,197,94,0)); }
      .hha-flash.bad{  background: radial-gradient(circle at 50% 50%, rgba(239,68,68,.14), rgba(239,68,68,0)); }
      `;
      DOC.head.appendChild(st);
    }

    function ensureFxLayer(){
      if(!layerEl) return;
      if(fxEl && layerEl.contains(fxEl)) return;
      installStyleOnce();
      fxEl = DOC.createElement('div');
      fxEl.className = 'hha-fx';
      layerEl.appendChild(fxEl);

      const flash = DOC.createElement('div');
      flash.className = 'hha-flash';
      flash.id = 'hhaFlash';
      fxEl.appendChild(flash);
    }

    function init(el){
      layerEl = el || null;
      ensureFxLayer();
    }

    function layerRect(){
      if(!layerEl) return { left:0, top:0, width: WIN.innerWidth||360, height: WIN.innerHeight||640 };
      return layerEl.getBoundingClientRect();
    }
    function toLocalXY(clientX, clientY){
      const r = layerRect();
      return { x: clientX - r.left, y: clientY - r.top };
    }

    function popupAtClient(text, clientX, clientY, kind){
      if(!fxEl) return;
      const p = toLocalXY(clientX, clientY);
      popupAtLocal(text, p.x, p.y, kind);
    }
    function popupAtLocal(text, x, y, kind){
      if(!fxEl) return;
      const el = DOC.createElement('div');
      el.className = 'hha-pop ' + (kind||'neu');
      el.textContent = String(text||'');
      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;
      fxEl.appendChild(el);

      requestAnimationFrame(()=>{
        el.style.opacity = '1';
        el.style.transform = `translate(-50%,-70%)`;
      });

      setTimeout(()=>{ try{ el.style.opacity='0'; }catch(_){ } }, 420);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 720);
    }

    function burstAtClient(clientX, clientY, good){
      if(!fxEl) return;
      const p = toLocalXY(clientX, clientY);
      burstAtLocal(p.x, p.y, good);
    }
    function burstAtLocal(x, y, good){
      if(!fxEl) return;
      const el = DOC.createElement('div');
      el.className = 'hha-burst ' + (good ? 'good' : 'bad');
      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;
      fxEl.appendChild(el);

      requestAnimationFrame(()=>{
        el.style.opacity = '1';
        el.style.transform = `translate(-50%,-50%) scale(2.4)`;
      });

      setTimeout(()=>{ try{ el.style.opacity='0'; }catch(_){ } }, 220);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 520);
    }

    function flash(good){
      if(!fxEl) return;
      const f = fxEl.querySelector('#hhaFlash');
      if(!f) return;
      f.className = 'hha-flash ' + (good ? 'good' : 'bad');
      f.style.opacity = '1';
      setTimeout(()=>{ try{ f.style.opacity='0'; }catch(_){ } }, 120);
    }

    function shake(ms){
      ms = clamp(ms||220, 80, 520);
      shakeT = nowMs() + ms;
    }
    function tickShake(){
      if(!layerEl) return;
      const t = nowMs();
      if(t > shakeT){
        try{ layerEl.style.transform = ''; }catch(_){}
        return;
      }
      const dx = (Math.random()*2-1) * 1.6;
      const dy = (Math.random()*2-1) * 1.6;
      try{ layerEl.style.transform = `translate(${dx}px,${dy}px)`; }catch(_){}
      requestAnimationFrame(tickShake);
    }
    function startShake(ms){
      shake(ms);
      requestAnimationFrame(tickShake);
    }

    return { init, popupAtClient, popupAtLocal, burstAtClient, burstAtLocal, flash, startShake };
  })();

  // ---------------------------
  // SFX (WebAudio, no assets)
  // ---------------------------
  const SFX = (function(){
    let ctx=null, master=null;
    let enabled=true;

    function init(){
      try{
        if(ctx) return true;
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if(!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.16;
        master.connect(ctx.destination);
        return true;
      }catch(_){ return false; }
    }

    function unlock(){
      try{
        if(!init()) return;
        if(ctx.state === 'suspended') ctx.resume();
      }catch(_){}
    }

    function tone(freq, durMs, type, vol){
      try{
        if(!enabled) return;
        if(!init()) return;
        if(ctx.state === 'suspended') return;

        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type || 'sine';
        o.frequency.value = Math.max(40, Number(freq)||440);

        const t0 = ctx.currentTime;
        const d = Math.max(0.02, (Number(durMs)||120)/1000);

        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, Number(vol)||0.35), t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);

        o.connect(g);
        g.connect(master);

        o.start(t0);
        o.stop(t0 + d + 0.02);
      }catch(_){}
    }

    function good(){ tone(880, 90, 'triangle', 0.40); tone(1320, 70, 'sine', 0.22); }
    function bad(){  tone(180, 140, 'sawtooth', 0.28); }
    function pop(){  tone(520, 70, 'square', 0.18); }
    function boss(){ tone(110, 220, 'sine', 0.35); tone(70, 260, 'triangle', 0.22); }

    function setEnabled(on){ enabled = !!on; }

    return { unlock, setEnabled, good, bad, pop, boss };
  })();

  // ---------------------------
  // Safe spawn rect (หลบ HUD) — LOCAL coords
  // ---------------------------
  function getSafeRect(layerEl){
    const s = WIN.__HHA_SPAWN_SAFE__;
    if(s && Number.isFinite(s.xMin) && Number.isFinite(s.xMax) && Number.isFinite(s.yMin) && Number.isFinite(s.yMax)){
      return s;
    }
    const r = layerEl.getBoundingClientRect();
    const PAD = 14;
    const topSafe = 120;
    const botSafe = 140;
    return {
      xMin: PAD,
      xMax: Math.max(PAD+1, r.width - PAD),
      yMin: topSafe,
      yMax: Math.max(topSafe+1, r.height - botSafe)
    };
  }

  // ---------------------------
  // Content: Thai 5 food groups (fixed mapping)
  // ---------------------------
  const GROUPS = [
    { id:1, short:'หมู่ 1', name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🫘'] },
    { id:2, short:'หมู่ 2', name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🍠'] },
    { id:3, short:'หมู่ 3', name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, short:'หมู่ 4', name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, short:'หมู่ 5', name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🥜'] },
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

    diff: 'normal',
    ctx: null,
    runMode: 'play',
    plannedSec: 90,
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

    stage: 'main', // main | boss
    bossLeft: 0,
    bossSec: 12,
    bossHits: 0,

    spawnAcc: 0,
    baseSpawnPerSec: 1.20,
    baseTtl: 2.9,

    map: new Map(),
    idSeq: 1,

    // --- WIGGLE (fair) ---
    wiggleOn: true,
    wiggleHardOnly: true,
    wiggleAmpPx: 10,
    wiggleHz: 1.15,
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
    if(STATE.layerEl) FX.init(STATE.layerEl);
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

  function bossWarningFx(){
    try{
      const layer = STATE.layerEl;
      if(!layer) return;

      const ring = DOC.createElement('div');
      ring.style.cssText =
        'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) scale(.82);' +
        'width:220px; height:220px; border-radius:999px;' +
        'border:2px dashed rgba(34,211,238,.55);' +
        'box-shadow: 0 0 0 10px rgba(34,197,94,.05) inset, 0 0 30px rgba(34,211,238,.18);' +
        'opacity:0; transition: all 420ms ease; pointer-events:none; z-index:60;';
      layer.appendChild(ring);

      const bolt = DOC.createElement('div');
      bolt.style.cssText =
        'position:absolute; inset:0; pointer-events:none; z-index:59;' +
        'background: radial-gradient(circle at 50% 40%, rgba(255,255,255,.18), rgba(255,255,255,0) 55%);' +
        'opacity:0; transition: opacity 160ms ease;';
      layer.appendChild(bolt);

      requestAnimationFrame(()=>{
        ring.style.opacity='1';
        ring.style.transform='translate(-50%,-50%) scale(1)';
        bolt.style.opacity='1';
      });

      setTimeout(()=>{ try{ bolt.style.opacity='0'; }catch(_){ } }, 140);
      setTimeout(()=>{ try{ ring.style.transform='translate(-50%,-50%) scale(1.12)'; }catch(_){ } }, 220);
      setTimeout(()=>{ try{ ring.style.opacity='0'; bolt.style.opacity='0'; }catch(_){ } }, 520);
      setTimeout(()=>{ try{ ring.remove(); }catch(_){ } try{ bolt.remove(); }catch(_){ } }, 900);
    }catch(_){}
  }

  function createTarget(isMission){
    const id = String(STATE.idSeq++);
    const el = DOC.createElement('div');
    el.className = 'tgt';
    el.dataset.id = id;

    const gMission = STATE.curGroup;
    let emoji = '';
    let groupId = gMission.id;
    let mission = !!isMission;

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
    el.style.transform = 'translate(-50%,-50%) scale(.86)';
    el.style.opacity = '0';

    STATE.layerEl.appendChild(el);

    requestAnimationFrame(()=>{
      el.style.transition = 'transform 160ms ease, opacity 140ms ease';
      el.style.transform = 'translate(-50%,-50%) scale(1)';
      el.style.opacity = '1';
    });

    // spawn pop (เบา ๆ)
    if(STATE.runMode !== 'research'){
      if(STATE.rng() < 0.55) SFX.pop();
    }

    const born = nowMs();
    const ttlMul = ttlShrinkMul(STATE.elapsed, STATE.plannedSec, STATE.runMode, STATE.diff);
    const ttl = Math.max(1.15, STATE.baseTtl * ttlMul);
    const ttlMs = ttl * 1000;

    const obj = {
      id, el, emoji, born, ttlMs, mission, groupId,
      baseX: p.x,
      baseY: p.y,
      wigglePhase: STATE.rng() * Math.PI * 2
    };
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
      t.el.style.transition = 'transform 140ms ease, opacity 120ms ease';
      t.el.style.transform = 'translate(-50%,-50%) scale(.72)';
      t.el.style.opacity = '0';
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){ } }, 140);
    }catch(_){}
  }

  function powerAdd(n){
    STATE.charge = Math.max(0, (STATE.charge|0) + (n|0));
    emit('groups:power', { charge: STATE.charge, threshold: STATE.chargeNeed });

    if(STATE.charge >= STATE.chargeNeed){
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
      FX.flash(true);
      FX.popupAtLocal(`SWITCH → ${STATE.curGroup.short}`, 140, 56, 'neu');
    }
  }

  function onHit(obj, source){
    STATE.shots++;

    const isCorrect = (obj.mission === true) && (obj.groupId === STATE.curGroup.id);

    let cx=0, cy=0;
    try{
      const b = obj.el.getBoundingClientRect();
      cx = b.left + b.width/2;
      cy = b.top + b.height/2;
    }catch(_){
      const r = STATE.layerEl.getBoundingClientRect();
      cx = r.left + r.width/2;
      cy = r.top  + r.height/2;
    }

    if(isCorrect){
      STATE.hits++;
      STATE.goalNow++;
      STATE.combo++;
      STATE.bestCombo = Math.max(STATE.bestCombo, STATE.combo);

      const add = 10 + Math.min(10, STATE.combo) + streakBonus(STATE.combo);
      STATE.score += add;

      powerAdd(1);

      FX.flash(true);
      FX.burstAtClient(cx, cy, true);
      FX.popupAtClient(`+${add}`, cx, cy, 'good');
      SFX.good();

      if(STATE.stage==='boss'){
        STATE.bossHits++;
        FX.startShake(120);
        if(STATE.bossHits === 1) coach('บอสเริ่มแล้ว! คุมคอมโบไว้ ⚡', 'fever');
      }else if(STATE.combo === 4){
        coach('คอมโบมาแล้ว! รักษาจังหวะ 🔥', 'happy');
      }else if(STATE.goalNow % 5 === 0){
        coach(`ดีมาก! ต่อไปเน้น “${STATE.curGroup.short}” 🎯`, 'neutral');
      }

      try{ WIN.HHA_AI?.onHit?.('groups_ok', { id: obj.id, emoji: obj.emoji, add, source:String(source||'') }); }catch(_){}
      removeTarget(obj.id, 'hit');
      return;
    }

    // wrong
    STATE.combo = 0;
    STATE.score = Math.max(0, STATE.score - 3);

    FX.flash(false);
    FX.burstAtClient(cx, cy, false);
    FX.popupAtClient('MISS', cx, cy, 'bad');
    SFX.bad();

    coach('ผิดหมู่! ดูชื่อหมู่ก่อนยิงนะ', 'neutral');

    try{ WIN.HHA_AI?.onHit?.('groups_wrong', { id: obj.id, emoji: obj.emoji, source:String(source||'') }); }catch(_){}
    removeTarget(obj.id, 'hit');
  }

  function pointerHandler(ev){
    if(!STATE.running || STATE.paused) return;
    SFX.unlock(); // ensure audio on gesture
    const el = ev.target && ev.target.closest ? ev.target.closest('.tgt') : null;
    if(!el) return;
    const obj = STATE.map.get(String(el.dataset.id));
    if(obj) onHit(obj, 'tap');
  }

  function pickClosestToPoint(clientX, clientY, lockPx){
    lockPx = clamp(lockPx ?? 22, 12, 140);
    let best=null, bestD=1e9;

    for(const obj of STATE.map.values()){
      const b = obj.el.getBoundingClientRect();
      const x = b.left + b.width/2;
      const y = b.top  + b.height/2;
      const d = Math.hypot(x-clientX, y-clientY);
      if(d < bestD){ bestD=d; best=obj; }
    }
    if(best && bestD <= lockPx) return best;
    return null;
  }

  function shootHandler(ev){
    if(!STATE.running || STATE.paused) return;
    const d = ev?.detail || {};

    let lockPx = (d.lockPx != null) ? Number(d.lockPx) : 22;
    if(STATE.view === 'mobile') lockPx = Math.max(lockPx, 34);
    if(STATE.view === 'cvr')    lockPx = Math.max(lockPx, 26);

    let x = Number(d.x);
    let y = Number(d.y);

    if(!Number.isFinite(x) || !Number.isFinite(y)){
      const r = STATE.layerEl.getBoundingClientRect();
      x = r.left + r.width/2;
      y = r.top  + r.height/2;
    }

    const obj = pickClosestToPoint(x, y, lockPx);
    if(obj) onHit(obj, d.source || 'shoot');
  }

  // ---------------------------
  // Wiggle (fair)
  // ---------------------------
  function shouldWiggle(){
    if(!STATE.wiggleOn) return false;
    if(STATE.runMode === 'practice') return false;
    if(STATE.stage === 'boss') return false;
    if(STATE.wiggleHardOnly && STATE.diff !== 'hard') return false;
    return true;
  }

  function wiggleTargets(){
    if(!shouldWiggle()) return;

    const ramp = Math.min(1, STATE.elapsed / Math.max(1, STATE.plannedSec));
    const amp = clamp(STATE.wiggleAmpPx * (0.55 + 0.45*ramp), 4, 16);
    const w = (Math.PI * 2) * clamp(STATE.wiggleHz, 0.6, 1.8);
    const sr = getSafeRect(STATE.layerEl);

    const tNow = nowMs();

    for(const obj of STATE.map.values()){
      const age = (tNow - obj.born) / 1000;
      const dx = Math.sin(obj.wigglePhase + age*w) * amp;
      const dy = Math.cos(obj.wigglePhase + age*w*0.92) * (amp*0.65);

      const x = clamp(obj.baseX + dx, sr.xMin+10, sr.xMax-10);
      const y = clamp(obj.baseY + dy, sr.yMin+10, sr.yMax-10);

      obj.el.style.left = `${x}px`;
      obj.el.style.top  = `${y}px`;
    }
  }

  // ---------------------------
  // HUD / spawn / expire
  // ---------------------------
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
        if(STATE.runMode !== 'practice'){
          if(obj.mission && obj.groupId === STATE.curGroup.id){
            STATE.miss++;
            STATE.combo = 0;
            STATE.score = Math.max(0, STATE.score - 2);

            try{
              const b = obj.el.getBoundingClientRect();
              FX.popupAtClient('TIMEOUT', b.left+b.width/2, b.top+b.height/2, 'bad');
              FX.burstAtClient(b.left+b.width/2, b.top+b.height/2, false);
            }catch(_){}

            try{ WIN.HHA_AI?.onExpire?.('groups_target', { id: obj.id, emoji: obj.emoji }); }catch(_){}
          }else{
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

    bossWarningFx();
    SFX.boss();
    FX.startShake(220);
    FX.flash(true);
    FX.popupAtLocal('BOSS TIME!', 140, 54, 'neu');
  }

  function buildSummary(reason){
    return {
      projectTag: 'GroupsVR',
      gameVersion: 'GroupsVR_SAFE_2026-03-03f',
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

    if(STATE.stage === 'boss'){
      STATE.bossLeft = Math.max(0, STATE.bossLeft - dt);
      if(STATE.bossLeft <= 0){
        endGame('boss-done');
        return;
      }
    }

    spawnTick(dt);
    expireTick();
    wiggleTargets(); // ✅ fair wiggle (hard only)

    try{ WIN.HHA_AI?.onTick?.(dt, { miss: STATE.miss, combo: STATE.combo, acc: accPct(), stage: STATE.stage }); }catch(_){}

    setHUD();
    aiWarnMaybe(STATE.elapsed, STATE.plannedSec, accPct(), STATE.miss, STATE.combo, STATE.stage);

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
    if(!STATE.layerEl){ throw new Error('[GroupsVR] layerEl not set. Call setLayerEl() first'); }

    stop();

    STATE.diff = String(diff||'normal').toLowerCase();
    STATE.ctx = ctx;
    STATE.runMode = String(ctx.runMode || 'play').toLowerCase();
    STATE.view = String(ctx.view || DOC.body.getAttribute('data-view') || 'mobile').toLowerCase();

    // SFX toggle by ?sfx=0
    try{
      const sp = new URL(location.href).searchParams;
      const sfx = String(sp.get('sfx')||'1');
      SFX.setEnabled(sfx !== '0');
    }catch(_){}

    SFX.unlock(); // try unlock early

    const timeSec = clamp(ctx.time ?? 90, 15, 300);
    STATE.plannedSec = timeSec;
    STATE.seedStr = String(ctx.seed ?? Date.now());
    STATE.rng = makeRng(STATE.seedStr);

    // base tuning
    STATE.baseSpawnPerSec = 1.20;
    STATE.baseTtl = 2.90;

    if(STATE.diff === 'easy'){ STATE.baseSpawnPerSec = 1.05; STATE.baseTtl = 3.20; }
    // hard: ยังเดือด แต่แฟร์กับ wiggle
    if(STATE.diff === 'hard'){ STATE.baseSpawnPerSec = 1.32; STATE.baseTtl = 2.70; }
    if(STATE.runMode === 'practice'){ STATE.baseSpawnPerSec *= 0.92; STATE.baseTtl += 0.25; }

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

    try{
      STATE.layerEl.addEventListener('pointerdown', pointerHandler, { passive:true });
    }catch(_){}
    try{
      WIN.addEventListener('hha:shoot', shootHandler, { passive:true });
    }catch(_){}

    if(STATE.runMode === 'practice'){
      coach('PRACTICE — ซ้อมก่อน (ลงโทษเบา) 🧪', 'neutral');
    }else{
      coach(`เริ่มแล้ว! หา “${STATE.curGroup.short}” แล้วเก็บคอมโบ 🔥`, 'neutral');
    }

    FX.flash(true);
    setHUD();
    STATE.raf = requestAnimationFrame(tick);
  }

  function stop(){
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
    coach(STATE.paused ? 'พักก่อน…' : 'ลุยต่อ!', STATE.paused ? 'neutral' : 'happy');
  }

  // ---------------------------
  // Telemetry (safe stub)
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
  WIN.GroupsVR.GameEngine = { setLayerEl, start, stop, setPaused };

  WIN.addEventListener('hha:pause', ()=> setPaused(true), { passive:true });
  WIN.addEventListener('hha:resume', ()=> setPaused(false), { passive:true });

})();