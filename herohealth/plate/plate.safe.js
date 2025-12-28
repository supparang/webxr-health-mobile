/* === /herohealth/plate-vr/plate.safe.js ===
HeroHealth — Balanced Plate VR — SAFE (PRODUCTION)
Concept-Locked v1 (Concept 1–5)
1) Score/Pass tied to Balance (Goal completion requires balance threshold + junk limit)
2) Minis are balance skills: Plate Rush / Fix Imbalance / Rainbow / Clean Window
3) Powerups support learning: Hint/Guide + Shield (no "shoot-anything magnet")
4) Feedback tells what's missing: Coach + balance signal
5) Flush-hardened before end / back HUB / pagehide (best-effort)
------------------------------------------------
Events emitted (HHA Standard friendly):
- hha:score {score, combo, comboMax, misses, ...}
- hha:time  {left}
- hha:judge {kind,text,meta?}
- hha:coach {mood,text}
- quest:update {goal:{title,cur,max,pct}, mini:{...}}
- hha:celebrate {kind,title}
- hha:end { ...summary... }
- plate:balance {balancePct, missingKey, dist, counts, targetDist}
- hha:log_event (if logger listens) + optional flush hooks
------------------------------------------------ */

'use strict';

// ------------------------- Module Exports -------------------------
export function boot(userOpts = {}) {
  const ROOT = (typeof window !== 'undefined') ? window : globalThis;
  const DOC  = ROOT.document;
  if (!DOC) return { start(){} };

  // --------- Helpers ---------
  const now = () => (ROOT.performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v, a, b) => { v = Number(v); if (!Number.isFinite(v)) v = 0; return Math.max(a, Math.min(b, v)); };
  const qs = (k, def) => { try{ return (new URL(ROOT.location.href)).searchParams.get(k) ?? def; }catch{ return def; } };
  const intQ = (k, def) => { const v = parseInt(qs(k, def), 10); return Number.isFinite(v) ? v : def; };
  const strQ = (k, def) => String(qs(k, def) ?? def);

  // --------- Seeded RNG ---------
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

  const emit = (name, detail) => {
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  };

  // --------- Try to locate layer + HUD ---------
  const layer =
    DOC.getElementById('pl-layer') ||
    DOC.getElementById('plate-layer') ||
    DOC.querySelector('.pl-layer') ||
    DOC.querySelector('.plate-layer') ||
    DOC.querySelector('.game-layer');

  if (!layer) {
    console.warn('[PlateVR] layer not found (#pl-layer / .pl-layer / .plate-layer)');
    return { start(){} };
  }

  const hudTop =
    DOC.querySelector('.hud-top') ||
    DOC.getElementById('hudTop') ||
    DOC.querySelector('.hud');

  // --------- Best-effort Particles / FeverUI (optional, IIFE globals) ---------
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles ||
    { scorePop(){}, burstAt(){}, celebrate(){} };

  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI ||
    { set(){}, get(){ return { value:0, state:'low', shield:0 }; }, setShield(){} };

  // --------- Logger best-effort ---------
  function loggerEmit(type, data){
    // Some setups listen to this event name
    emit('hha:log_event', { type, data: data || {} });

    // Some setups expose a function
    try{
      if (typeof ROOT.hhaLogEvent === 'function') ROOT.hhaLogEvent(type, data||{});
    }catch(_){}
  }
  async function loggerFlush(reason){
    // Call any known flush functions (best effort)
    const fns = [];
    try{
      if (ROOT.HHA_CLOUD_LOGGER && typeof ROOT.HHA_CLOUD_LOGGER.flush === 'function') fns.push(ROOT.HHA_CLOUD_LOGGER.flush.bind(ROOT.HHA_CLOUD_LOGGER));
    }catch(_){}
    try{
      if (ROOT.HHACloudLogger && typeof ROOT.HHACloudLogger.flush === 'function') fns.push(ROOT.HHACloudLogger.flush.bind(ROOT.HHACloudLogger));
    }catch(_){}
    try{
      if (ROOT.GAME_MODULES && ROOT.GAME_MODULES.CloudLogger && typeof ROOT.GAME_MODULES.CloudLogger.flush === 'function') fns.push(ROOT.GAME_MODULES.CloudLogger.flush.bind(ROOT.GAME_MODULES.CloudLogger));
    }catch(_){}
    try{
      if (typeof ROOT.hhaFlush === 'function') fns.push(ROOT.hhaFlush.bind(ROOT));
    }catch(_){}

    emit('hha:flush', { reason: String(reason||'flush') });

    // race: do not block forever
    const tasks = fns.map(fn => {
      try{
        const r = fn({ reason:String(reason||'flush') });
        return (r && typeof r.then === 'function') ? r : Promise.resolve();
      }catch(_){ return Promise.resolve(); }
    });

    await Promise.race([
      Promise.all(tasks),
      new Promise(res => setTimeout(res, 250))
    ]);
  }

  // --------- Difficulty params ---------
  function diffParams(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy')   return { spawnMs:900, ttl:1900, size:1.05, junk:0.10, hint:0.020, shield:0.016, adapt:true };
    if (diff === 'hard')   return { spawnMs:650, ttl:1450, size:0.92, junk:0.16, hint:0.012, shield:0.010, adapt:true };
    return                  { spawnMs:760, ttl:1650, size:1.00, junk:0.12, hint:0.015, shield:0.012, adapt:true };
  }

  // --------- Plate groups (concept core) ---------
  // 4-way simplified plate for fast learning loop (can expand later)
  const GROUPS = {
    veg:     { key:'veg',     label:'ผัก',    emoji:['🥦','🥬','🥕','🌽','🥒','🍆'] },
    fruit:   { key:'fruit',   label:'ผลไม้',  emoji:['🍎','🍌','🍊','🍉','🍓','🍍'] },
    protein: { key:'protein', label:'โปรตีน', emoji:['🥚','🍗','🐟','🥛','🫘','🥜'] },
    carb:    { key:'carb',    label:'แป้ง',   emoji:['🍚','🍞','🥔','🍠','🍜','🥖'] }
  };
  const GROUP_KEYS = Object.keys(GROUPS);

  const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭'];
  const DECOY= ['🎭','🌀','✨','🌈','🎈'];

  // Target distribution (concept): emphasize veg, then balance rest
  const TARGET_DIST = { veg:0.40, fruit:0.20, protein:0.20, carb:0.20 };

  function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }

  // --------- Engine state ---------
  const engine = {
    running:false,
    ended:false,

    runMode:'play',  // play | research
    diff:'normal',
    timeSec:90,
    seed:'seed',
    rng:Math.random,

    // VR-feel view translate
    vx:0, vy:0, dragOn:false, dragX:0, dragY:0,

    // time
    left:90,
    tStart:0,

    // performance
    score:0,
    combo:0,
    comboMax:0,
    misses:0,          // miss = food expire + junk hit (if not blocked)
    hitAll:0,
    hitFood:0,
    hitJunk:0,
    hitJunkGuard:0,
    expireFood:0,

    // balance counts
    counts:{ veg:0, fruit:0, protein:0, carb:0 },
    totalFood:0,
    balancePct:0,

    // defenses
    shield:0,          // blocks one junk hit

    // spawning
    spawnTimer:0,
    tickTimer:0,
    ttlMs:1650,
    sizeBase:1.0,
    spawnMs:760,
    junkBias:0.12,

    // adaptive (play only)
    adapt:{ spawnMs:760, ttl:1650, size:1.0, junk:0.12 },

    // quest state
    goalIndex:0,
    goalsCleared:0,
    goalsTotal:3,

    miniActive:null,
    miniCleared:0,
    miniTotal:0, // we’ll treat as “attempted minis”; for summary we’ll provide cleared/attempted

    // internal
    lastCoachAt:0,
    lastBalanceBucket:-1,

    // flush guards
    flushedEnd:false
  };

  // --------- Goals (Concept 1) ---------
  // Each goal requires: totalFood >= need AND balancePct >= minBalance AND junk hits <= maxJunkInGoal
  const GOALS = [
    { title:'จัดจานให้ “พอสมดุล”', needFood:8,  minBalance:70, maxJunk:1 },
    { title:'จัดจานให้ “สมดุลขึ้น”', needFood:12, minBalance:78, maxJunk:1 },
    { title:'จัดจานให้ “สมดุลสุด ๆ”', needFood:16, minBalance:84, maxJunk:0 }
  ];

  // --------- Minis (Concept 2) ---------
  // Mini = timed skill. Any junk during mini => fail (unless shield blocks)
  const MINI_DEFS = [
    { key:'rush',     title:'Plate Rush',      desc:'เก็บอาหาร 5 ชิ้นใน 8 วิ (ห้ามโดนขยะ)', need:5,  sec:8,  mode:'anyfood' },
    { key:'fix',      title:'Fix Imbalance',   desc:'เติม “หมวดที่ขาด” 3 ชิ้นใน 10 วิ (ห้ามโดนขยะ)', need:3, sec:10, mode:'missing' },
    { key:'rainbow',  title:'Rainbow Plate',   desc:'เก็บครบ 4 หมวดใน 12 วิ (ห้ามโดนขยะ)', need:4, sec:12, mode:'eachgroup' },
    { key:'clean3',   title:'Clean Window',    desc:'ใน 6 วิ เก็บอาหาร 3 ชิ้นแบบไม่พลาด', need:3,  sec:6,  mode:'anyfood' }
  ];

  // --------- Rank (for HUD / summary) ---------
  function rankFromAcc(acc){
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  // --------- Balance computation (Concept 1+4) ---------
  function computeDist(){
    const t = Math.max(1, engine.totalFood);
    return {
      veg: engine.counts.veg / t,
      fruit: engine.counts.fruit / t,
      protein: engine.counts.protein / t,
      carb: engine.counts.carb / t
    };
  }

  function computeBalancePct(){
    // L1 distance to target -> map to 0..100 (smaller distance = better)
    const d = computeDist();
    let l1 = 0;
    for (const k of GROUP_KEYS){
      l1 += Math.abs((d[k]||0) - (TARGET_DIST[k]||0));
    }
    // max L1 for 4-way can approach 2.0; map conservatively
    const pct = clamp(100 * (1 - (l1 / 1.2)), 0, 100);
    return pct;
  }

  function missingGroupKey(){
    const d = computeDist();
    let worstK = 'veg';
    let worstGap = -1;
    for (const k of GROUP_KEYS){
      const gap = (TARGET_DIST[k]||0) - (d[k]||0);
      if (gap > worstGap){
        worstGap = gap;
        worstK = k;
      }
    }
    return worstK;
  }

  function emitBalance(){
    engine.balancePct = computeBalancePct();
    const d = computeDist();
    const missK = missingGroupKey();
    emit('plate:balance', {
      balancePct: Math.round(engine.balancePct),
      missingKey: missK,
      dist: d,
      counts: { ...engine.counts, totalFood: engine.totalFood },
      targetDist: { ...TARGET_DIST }
    });

    // Coach hint bucketed (don’t spam)
    const bucket = Math.floor(engine.balancePct / 10);
    const t = now();
    if (bucket !== engine.lastBalanceBucket || (t - engine.lastCoachAt) > 3200){
      engine.lastBalanceBucket = bucket;
      engine.lastCoachAt = t;

      const need = GROUPS[missK]?.label || 'หมวดที่ขาด';
      const mood = (engine.balancePct >= 85) ? 'happy' : (engine.balancePct >= 70 ? 'neutral' : 'sad');
      const msg =
        (engine.balancePct >= 85) ? `สมดุลมาก! ลองคุมให้ “ห้ามโดนขยะ” นะ 💪` :
        (engine.balancePct >= 70) ? `ดีแล้ว! ตอนนี้ “ขาด${need}” นิดหน่อย` :
        `จานยังเอียงอยู่ 😅 เติม “${need}” ก่อนเลย`;

      emit('hha:coach', { mood, text: msg });
    }
  }

  // --------- HUD + Quest update helpers ---------
  function updateScore(){
    emit('hha:score', {
      score: engine.score|0,
      combo: engine.combo|0,
      comboMax: engine.comboMax|0,
      misses: engine.misses|0,
      balancePct: Math.round(engine.balancePct)|0,
      shield: engine.shield|0
    });

    const acc = engine.hitAll > 0 ? Math.round((engine.hitFood/engine.hitAll)*100) : 0;
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
  }

  function updateTime(){
    emit('hha:time', { left: engine.left|0 });
  }

  function updateQuestUI(){
    const g = GOALS[engine.goalIndex] || GOALS[GOALS.length-1];
    const curFood = engine.totalFood|0;
    const maxFood = g ? g.needFood|0 : 0;

    // goal progress uses BOTH food count and balance readiness
    const foodPct = maxFood > 0 ? clamp(curFood/maxFood, 0, 1) : 0;
    const balPct  = g ? clamp(engine.balancePct/(g.minBalance||100), 0, 1) : 0;
    const pct = clamp(Math.min(foodPct, balPct), 0, 1);

    const goalText = g
      ? `${g.title} · food ${curFood}/${g.needFood} · bal ≥${g.minBalance}% · junk ≤${g.maxJunk}`
      : '—';

    const mini = engine.miniActive;
    const miniObj = mini ? {
      title: mini.title,
      cur: mini.cur|0,
      max: mini.max|0,
      pct: mini.max>0 ? clamp(mini.cur/mini.max,0,1) : 0,
      leftSec: Math.max(0, Math.ceil((mini.until - now())/1000)),
      state: mini.state
    } : null;

    emit('quest:update', {
      goal: { title: goalText, cur: Math.floor(pct*100), max:100, pct },
      mini: miniObj ? { title: miniObj.title, cur: miniObj.cur, max: miniObj.max, pct: miniObj.pct, leftSec: miniObj.leftSec, state: miniObj.state } : null,
      goalsCleared: engine.goalsCleared|0,
      goalsTotal: engine.goalsTotal|0,
      miniCleared: engine.miniCleared|0,
      miniTotal: engine.miniTotal|0
    });
  }

  // --------- VR feel view translate ---------
  function applyView(){
    layer.style.setProperty('--vx', engine.vx.toFixed(1)+'px');
    layer.style.setProperty('--vy', engine.vy.toFixed(1)+'px');
    // optional direct transform if CSS not using vars
    if (!layer.classList.contains('pl-use-vars')){
      layer.style.transform = `translate(${engine.vx.toFixed(1)}px, ${engine.vy.toFixed(1)}px)`;
    }
  }

  function setupViewControls(){
    layer.addEventListener('pointerdown', (e)=>{
      engine.dragOn = true; engine.dragX = e.clientX; engine.dragY = e.clientY;
    }, { passive:true });

    ROOT.addEventListener('pointermove', (e)=>{
      if (!engine.dragOn) return;
      const dx = e.clientX - engine.dragX;
      const dy = e.clientY - engine.dragY;
      engine.dragX = e.clientX; engine.dragY = e.clientY;
      engine.vx = clamp(engine.vx + dx*0.22, -90, 90);
      engine.vy = clamp(engine.vy + dy*0.22, -90, 90);
      applyView();
    }, { passive:true });

    ROOT.addEventListener('pointerup', ()=>{ engine.dragOn = false; }, { passive:true });

    ROOT.addEventListener('deviceorientation', (ev)=>{
      const gx = Number(ev.gamma)||0;
      const gy = Number(ev.beta)||0;
      engine.vx = clamp(engine.vx + gx*0.06, -90, 90);
      engine.vy = clamp(engine.vy + (gy-20)*0.02, -90, 90);
      applyView();
    }, { passive:true });
  }

  // --------- Spawn safe rect (clamp safe zone + avoid HUD overlap) ---------
  function safeSpawnRect(){
    const W = ROOT.innerWidth || 360;
    const H = ROOT.innerHeight || 640;

    // base paddings
    let top = 140;
    let bottom = 170;
    let left = 18;
    let right = 18;

    // avoid HUD if present
    try{
      if (hudTop){
        const r = hudTop.getBoundingClientRect();
        // push spawn area below HUD bottom + margin
        if (r && r.bottom > 0) top = Math.max(top, Math.round(r.bottom + 12));
      }
    }catch(_){}

    // also avoid potential bottom overlays (end buttons area)
    bottom = Math.max(bottom, 180);

    // safe-area insets (mobile)
    const sat = 0, sab = 0, sal = 0, sar = 0; // env() not readable in JS reliably

    const x0 = left + sal;
    const x1 = (W - right) - sar;
    const y0 = top + sat;
    const y1 = (H - bottom) - sab;

    // auto-relax if too small
    if ((x1-x0) < 140){ left = 10; right = 10; }
    if ((y1-y0) < 220){ top = Math.max(110, top-24); bottom = Math.max(150, bottom-24); }

    return { W,H, x0:left, x1:W-right, y0:top, y1:H-bottom };
  }

  function randPos(){
    const r = safeSpawnRect();
    const x = r.x0 + engine.rng()*(r.x1 - r.x0);
    const y = r.y0 + engine.rng()*(r.y1 - r.y0);
    return { x, y };
  }

  // --------- DOM target helpers ---------
  function setXY(el, x, y){
    el.style.setProperty('--x', x.toFixed(1)+'px');
    el.style.setProperty('--y', y.toFixed(1)+'px');
    el.dataset._x = String(x);
    el.dataset._y = String(y);
  }

  function makeTarget(type, emoji, x, y, s, meta = {}){
    const el = DOC.createElement('div');
    el.className = 'pl-target spawn';
    el.dataset.type = String(type||'food');
    el.dataset.emoji = String(emoji||'✨');
    if (meta.group) el.dataset.group = String(meta.group);
    if (meta.kind) el.dataset.kind = String(meta.kind);

    // optional “guide highlight” class
    if (meta.guide) el.classList.add('pl-guide');

    // style
    setXY(el, x, y);
    el.style.setProperty('--s', Number(s||1).toFixed(3));

    // class mapping (expect CSS exists; if not, still works)
    if (type === 'food') el.classList.add('pl-food');
    if (type === 'junk') el.classList.add('pl-junk');
    if (type === 'decoy') el.classList.add('pl-decoy');
    if (type === 'hint') el.classList.add('pl-powerup','pl-hint');
    if (type === 'shield') el.classList.add('pl-powerup','pl-shield');

    const ttl = engine.ttlMs;

    el._ttlTimer = ROOT.setTimeout(()=>{
      if (!el.isConnected) return;
      if (type === 'food'){
        engine.misses++; engine.combo = 0;
        engine.expireFood++;
        emit('hha:judge', { kind:'warn', text:'MISS (หมดเวลา)!' });
        updateScore();
        updateQuestUI();
        loggerEmit('miss_expire', { kind:'food', emoji, group: meta.group||'' });
      }
      el.classList.add('out');
      ROOT.setTimeout(()=> el.remove(), 220);
    }, ttl);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el);
    }, { passive:false });

    // log spawn
    loggerEmit('spawn', { kind:type, emoji, group: meta.group||'', targetId: (meta.id||'') });

    return el;
  }

  function removeTarget(el){
    try{ ROOT.clearTimeout(el._ttlTimer); }catch(_){}
    el.classList.add('hit');
    ROOT.setTimeout(()=> el.remove(), 220);
  }

  function burstAtEl(el){
    try{
      const r = el.getBoundingClientRect();
      Particles.burstAt(r.left + r.width/2, r.top + r.height/2, String(el.dataset.type||''));
      Particles.scorePop(r.left + r.width/2, r.top + r.height/2, '+', String(el.dataset.type||''));
    }catch(_){}
  }

  // --------- Mini quest engine (Concept 2) ---------
  function startNextMini(){
    // random mini that makes sense
    const def = MINI_DEFS[(engine.rng()*MINI_DEFS.length)|0];
    const t = now();
    engine.miniTotal++;

    engine.miniActive = {
      key: def.key,
      title: def.title,
      desc: def.desc,
      mode: def.mode,
      max: def.need|0,
      cur: 0,
      until: t + (def.sec*1000),
      state:'running',
      // for rainbow
      seen: { veg:false, fruit:false, protein:false, carb:false },
      // for fix
      targetKey: (def.mode === 'missing') ? missingGroupKey() : null,
      // fail if junk occurs (unblocked)
      junkFailed:false
    };

    emit('hha:coach', { mood:'neutral', text:`MINI: ${def.title} — ${def.desc}` });
    emit('hha:celebrate', { kind:'mini', title:`MINI START: ${def.title}` });
    updateQuestUI();
  }

  function failMini(reason){
    const m = engine.miniActive;
    if (!m) return;
    m.state = 'fail';
    emit('hha:judge', { kind:'bad', text:`MINI FAIL! ${reason||''}` });
    emit('hha:coach', { mood:'sad', text:'ไม่เป็นไร! ลองใหม่ในมินิถัดไป 💪' });
    engine.miniActive = null;
    updateQuestUI();
    // start another mini soon (gives breathing room)
    ROOT.setTimeout(()=>{ if (engine.running && !engine.ended) startNextMini(); }, 900);
  }

  function passMini(){
    const m = engine.miniActive;
    if (!m) return;
    m.state = 'pass';
    engine.miniCleared++;

    emit('hha:judge', { kind:'good', text:'MINI CLEAR!' });
    emit('hha:celebrate', { kind:'mini', title:`MINI CLEAR: ${m.title}` });

    // bonus that supports concept: increases score but scales with balance
    const bonus = Math.round(250 + engine.balancePct*4);
    engine.score += bonus;

    engine.miniActive = null;
    updateScore();
    updateQuestUI();

    ROOT.setTimeout(()=>{ if (engine.running && !engine.ended) startNextMini(); }, 800);
  }

  function miniTick(){
    const m = engine.miniActive;
    if (!m) return;
    const t = now();
    if (t >= m.until){
      failMini('หมดเวลา');
      return;
    }
    // live update
    updateQuestUI();
  }

  function miniOnFoodHit(groupKey){
    const m = engine.miniActive;
    if (!m || m.state !== 'running') return;

    if (m.mode === 'anyfood'){
      m.cur++;
    } else if (m.mode === 'missing'){
      const need = m.targetKey || missingGroupKey();
      if (groupKey === need) m.cur++;
    } else if (m.mode === 'eachgroup'){
      if (GROUPS[groupKey]){
        m.seen[groupKey] = true;
        m.cur = Object.values(m.seen).filter(Boolean).length;
      }
    }

    if (m.cur >= m.max){
      passMini();
    } else {
      updateQuestUI();
    }
  }

  function miniOnJunkHit(unblocked){
    const m = engine.miniActive;
    if (!m || m.state !== 'running') return;
    if (unblocked){
      failMini('โดนขยะระหว่างทำมินิ');
    }
  }

  // --------- Goal progression (Concept 1) ---------
  function currentGoal(){
    return GOALS[engine.goalIndex] || GOALS[GOALS.length-1];
  }

  function goalJunkCountForCurrent(){
    // simple: count total junk hit (unblocked) so far; stricter by stage can be added later
    return engine.hitJunk|0;
  }

  function checkGoalComplete(){
    const g = currentGoal();
    if (!g) return;

    const okFood = engine.totalFood >= g.needFood;
    const okBal  = engine.balancePct >= g.minBalance;
    const okJunk = goalJunkCountForCurrent() <= g.maxJunk;

    if (okFood && okBal && okJunk){
      // pass goal
      engine.goalsCleared++;
      emit('hha:celebrate', { kind:'goal', title:`GOAL CLEAR: ${g.title}` });
      emit('hha:judge', { kind:'good', text:'GOAL CLEAR!' });

      // bonus: reward balance mastery
      const bonus = Math.round(400 + engine.balancePct*6);
      engine.score += bonus;

      // advance goal
      engine.goalIndex = Math.min(GOALS.length-1, engine.goalIndex + 1);

      // start mini chain on first goal start
      if (!engine.miniActive) startNextMini();

      updateScore();
      updateQuestUI();
    }
  }

  // --------- Powerups (Concept 3) ---------
  // Hint powerup: makes missing group more likely and highlights that group for 6s
  const power = {
    guideUntil:0,
    shieldUntil:0
  };

  function guideOn(){
    power.guideUntil = now() + 6000;
    emit('hha:coach', { mood:'neutral', text:`💡 Hint: ตอนนี้ควรเติม “${GROUPS[missingGroupKey()].label}”` });
    emit('hha:celebrate', { kind:'mini', title:'HINT 💡' });
  }

  function giveShield(){
    engine.shield = clamp(engine.shield + 1, 0, 2);
    try{ if (FeverUI && typeof FeverUI.setShield === 'function') FeverUI.setShield(engine.shield); }catch(_){}
    emit('hha:judge', { kind:'good', text:'SHIELD +1' });
    emit('hha:celebrate', { kind:'mini', title:'SHIELD 🛡️' });
  }

  function guideActive(){ return now() < power.guideUntil; }

  // --------- Spawn choice tuned to concept (Concept 1+3) ---------
  function chooseType(){
    const dp = diffParams(engine.diff);
    // more junk if player is over-performing (play only)
    let junk = (engine.runMode === 'research') ? dp.junk : engine.junkBias;

    // powerup chance
    const hintP = dp.hint;
    const shP   = dp.shield;

    const r = engine.rng();
    if (r < hintP) return 'hint';
    if (r < hintP + shP) return 'shield';

    // decoy chance (small, adds “distraction” but not overtake learning)
    const decoyP = (engine.runMode==='play') ? 0.06 : 0.05;
    const junkP  = clamp(junk, 0.06, 0.26);

    const r2 = engine.rng();
    if (r2 < junkP) return 'junk';
    if (r2 < junkP + decoyP) return 'decoy';

    return 'food';
  }

  function chooseFoodGroup(){
    // bias toward missing group when guide active (Concept 3 + 4)
    const miss = missingGroupKey();

    if (guideActive()){
      // 60% chance spawn missing group
      if (engine.rng() < 0.60) return miss;
    }

    // mild correction even without guide: 30% missing
    if (engine.rng() < 0.30) return miss;

    // otherwise random
    return GROUP_KEYS[(engine.rng()*GROUP_KEYS.length)|0];
  }

  function spawnOne(){
    if (!engine.running || engine.ended) return;

    const tp = chooseType();
    const p = randPos();

    const size = engine.sizeBase * engine.adapt.size * (tp==='junk'?0.95:1.0);

    if (tp === 'food'){
      const gk = chooseFoodGroup();
      const em = pick(engine.rng, GROUPS[gk].emoji);
      const isGuide = guideActive() && (gk === missingGroupKey());
      const el = makeTarget('food', em, p.x, p.y, size, { group:gk, guide:isGuide });
      layer.appendChild(el);
      return;
    }

    if (tp === 'junk'){
      const el = makeTarget('junk', pick(engine.rng, JUNK), p.x, p.y, size);
      layer.appendChild(el);
      return;
    }

    if (tp === 'decoy'){
      const el = makeTarget('decoy', pick(engine.rng, DECOY), p.x, p.y, size*0.98);
      layer.appendChild(el);
      return;
    }

    if (tp === 'hint'){
      const el = makeTarget('hint', '💡', p.x, p.y, size*1.02);
      layer.appendChild(el);
      return;
    }

    if (tp === 'shield'){
      const el = makeTarget('shield', '🛡️', p.x, p.y, size*1.02);
      layer.appendChild(el);
      return;
    }
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;
    spawnOne();

    let sMs = engine.adapt.spawnMs;
    if (engine.runMode === 'research'){
      sMs = diffParams(engine.diff).spawnMs;
    }
    engine.spawnTimer = ROOT.setTimeout(loopSpawn, Math.max(420, sMs));
  }

  // --------- Hit logic (Concept 1–4) ---------
  function balanceMult(){
    // reward mastery: 1.0 .. 1.6
    return 1 + (clamp(engine.balancePct, 0, 100) / 100) * 0.6;
  }

  function onFoodAdded(groupKey){
    engine.counts[groupKey] = (engine.counts[groupKey]||0) + 1;
    engine.totalFood++;
    emitBalance();
  }

  function hitFood(el){
    engine.hitAll++;
    engine.hitFood++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    const gk = String(el.dataset.group||'').toLowerCase();
    onFoodAdded(GROUPS[gk] ? gk : chooseFoodGroup()); // fallback

    // scoring favors “missing group”
    const miss = missingGroupKey();
    const skillBonus = (gk === miss) ? 18 : 0;
    const pts = Math.round((90 + engine.combo*2 + skillBonus) * balanceMult());

    engine.score += pts;

    emit('hha:judge', { kind:'good', text:`+${pts} (${GROUPS[gk]?.label || 'อาหาร'})` });
    burstAtEl(el);

    loggerEmit('hit', { kind:'food', emoji: String(el.dataset.emoji||''), group: gk, totalScore: engine.score|0, combo: engine.combo|0, balance: Math.round(engine.balancePct) });

    updateScore();
    updateQuestUI();
    miniOnFoodHit(gk);

    checkGoalComplete();
    removeTarget(el);
  }

  function hitHint(el){
    engine.hitAll++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    guideOn();

    const pts = Math.round(80 * balanceMult());
    engine.score += pts;

    emit('hha:judge', { kind:'good', text:`HINT! +${pts}` });
    burstAtEl(el);

    loggerEmit('hit', { kind:'hint', emoji:'💡', totalScore: engine.score|0 });

    updateScore();
    updateQuestUI();
    removeTarget(el);
  }

  function hitShield(el){
    engine.hitAll++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    giveShield();

    const pts = Math.round(70 * balanceMult());
    engine.score += pts;

    emit('hha:judge', { kind:'good', text:`SHIELD! +${pts}` });
    burstAtEl(el);

    loggerEmit('hit', { kind:'shield', emoji:'🛡️', totalScore: engine.score|0, shield: engine.shield|0 });

    updateScore();
    updateQuestUI();
    removeTarget(el);
  }

  function hitJunk(el){
    engine.hitAll++;

    // shield blocks junk => NOT a miss (HHA rule alignment)
    if (engine.shield > 0){
      engine.shield = Math.max(0, engine.shield - 1);
      engine.hitJunkGuard++;

      emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
      loggerEmit('shield_block', { kind:'junk', emoji:String(el.dataset.emoji||'') });

      updateScore();
      updateQuestUI();
      miniOnJunkHit(false);

      removeTarget(el);
      return;
    }

    // unblocked junk => miss + penalty
    engine.hitJunk++;
    engine.misses++;
    engine.combo = 0;

    // concept penalty: hurts score AND balance “momentum”
    const penalty = 180;
    engine.score = Math.max(0, engine.score - penalty);

    emit('hha:judge', { kind:'bad', text:`JUNK! -${penalty}` });
    emit('hha:coach', { mood:'sad', text:'โดนขยะแล้ว 😵 คุมให้ดีขึ้นนะ!' });

    loggerEmit('hit', { kind:'junk', emoji:String(el.dataset.emoji||''), judgment:'bad', totalScore: engine.score|0, combo: engine.combo|0 });

    updateScore();
    updateQuestUI();
    miniOnJunkHit(true);

    removeTarget(el);
  }

  function hitDecoy(el){
    engine.hitAll++;
    // decoy = distraction; small penalty but not as harsh as junk
    engine.misses++;
    engine.combo = Math.max(0, engine.combo - 1);

    const penalty = 70;
    engine.score = Math.max(0, engine.score - penalty);

    emit('hha:judge', { kind:'warn', text:`DECOY! -${penalty}` });
    loggerEmit('hit', { kind:'decoy', emoji:String(el.dataset.emoji||''), judgment:'warn', totalScore: engine.score|0 });

    updateScore();
    updateQuestUI();
    // decoy counts as “mistake” for minis (treated like junk hit)
    miniOnJunkHit(true);

    removeTarget(el);
  }

  function hitTarget(el){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    const tp = String(el.dataset.type||'').toLowerCase();
    if (tp === 'food') return hitFood(el);
    if (tp === 'junk') return hitJunk(el);
    if (tp === 'decoy') return hitDecoy(el);
    if (tp === 'hint') return hitHint(el);
    if (tp === 'shield') return hitShield(el);
  }

  // --------- Tick loop (time + adaptive + mini tick) ---------
  function loopTick(){
    if (!engine.running || engine.ended) return;

    // adaptive difficulty (play only) — BUT keep it subtle to preserve learning
    if (engine.runMode === 'play'){
      const acc = engine.hitAll > 0 ? (engine.hitFood/engine.hitAll) : 0;
      const heat = clamp((engine.combo/20) + (acc-0.70), 0, 1);

      engine.adapt.spawnMs = clamp(820 - heat*260, 480, 900);
      engine.adapt.ttl     = clamp(1720 - heat*260, 1280, 1850);
      engine.adapt.size    = clamp(1.02 - heat*0.10, 0.86, 1.06);
      engine.junkBias      = clamp(0.11 + heat*0.06, 0.08, 0.22);

      engine.ttlMs   = engine.adapt.ttl;
    }

    // time
    engine.left = Math.max(0, engine.left - 0.14);
    updateTime();

    // mini tick
    miniTick();

    // goal check tick (balance can improve by itself only via hits, but safe)
    checkGoalComplete();

    if (engine.left <= 0){
      endGame('time');
      return;
    }

    engine.tickTimer = ROOT.setTimeout(loopTick, 140);
  }

  function clearAllTargets(){
    const list = layer.querySelectorAll('.pl-target');
    list.forEach(el=>{
      try{ ROOT.clearTimeout(el._ttlTimer); }catch(_){}
      try{ el.remove(); }catch(_){}
    });
  }

  // --------- Flush-hardened (Concept 5) ---------
  function makeSummary(reason){
    const acc = engine.hitAll > 0 ? Math.round((engine.hitFood/engine.hitAll)*100) : 0;
    const grade = rankFromAcc(acc);

    return {
      reason: String(reason||'end'),
      scoreFinal: engine.score|0,
      comboMax: engine.comboMax|0,
      misses: engine.misses|0,

      goalsCleared: engine.goalsCleared|0,
      goalsTotal: engine.goalsTotal|0,
      miniCleared: engine.miniCleared|0,
      miniTotal: engine.miniTotal|0,

      nHitFood: engine.hitFood|0,
      nHitAll: engine.hitAll|0,
      nHitJunk: engine.hitJunk|0,
      nHitJunkGuard: engine.hitJunkGuard|0,
      nExpireFood: engine.expireFood|0,

      balancePct: Math.round(engine.balancePct)|0,
      counts: { ...engine.counts, totalFood: engine.totalFood|0 },
      targetDist: { ...TARGET_DIST },

      accuracyGoodPct: acc|0,
      grade,

      diff: engine.diff,
      runMode: engine.runMode,
      seed: engine.seed,
      durationPlayedSec: Math.round((now() - engine.tStart)/1000)
    };
  }

  async function flushAll(reason, summary){
    // Persist last summary early
    try{
      if (summary){
        localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
        localStorage.setItem('hha_last_summary', JSON.stringify(summary));
      }
    }catch(_){}

    // Ask logger to flush
    await loggerFlush(reason);
  }

  async function endGame(reason){
    if (engine.ended) return;
    engine.ended = true;
    engine.running = false;

    try{ ROOT.clearTimeout(engine.spawnTimer); }catch(_){}
    try{ ROOT.clearTimeout(engine.tickTimer); }catch(_){}
    clearAllTargets();

    const summary = makeSummary(reason);

    // hard flush (before emitting end overlay)
    if (!engine.flushedEnd){
      engine.flushedEnd = true;
      await flushAll('end', summary);
    }

    emit('hha:end', summary);
  }

  // Intercept back hub buttons to flush before navigation
  function bindBackHubFlush(){
    const ids = ['btnBackHub', 'btnBack', 'backHub', 'btnHub'];
    const btns = [];
    for (const id of ids){
      const el = DOC.getElementById(id);
      if (el) btns.push(el);
    }
    // also any element with data-hha-backhub
    DOC.querySelectorAll('[data-hha-backhub="1"]').forEach(el=> btns.push(el));

    btns.forEach(btn=>{
      if (btn._plateFlushBound) return;
      btn._plateFlushBound = true;

      btn.addEventListener('click', async (e)=>{
        try{ e.preventDefault(); e.stopPropagation(); }catch(_){}

        const href = btn.getAttribute('data-hub') || btn.getAttribute('href') || strQ('hub', '../hub.html');
        const summary = makeSummary('back_hub');

        await flushAll('back_hub', summary);

        // go hub
        try{
          const u = new URL(href, ROOT.location.href);
          u.searchParams.set('ts', String(Date.now()));
          ROOT.location.href = u.toString();
        }catch(_){
          ROOT.location.href = href;
        }
      }, true);
    });
  }

  function bindPageHideFlush(){
    // pagehide is best for mobile
    ROOT.addEventListener('pagehide', ()=>{
      try{
        const summary = makeSummary('pagehide');
        flushAll('pagehide', summary);
      }catch(_){}
    }, { passive:true });

    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden'){
        try{
          const summary = makeSummary('hidden');
          flushAll('hidden', summary);
        }catch(_){}
      }
    }, { passive:true });
  }

  // --------- Public start ---------
  function start(runMode, cfg = {}){
    const mode = (String(runMode||cfg.runMode||qs('run','play')).toLowerCase() === 'research') ? 'research' : 'play';
    const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
    const time = clamp(cfg.time ?? intQ('time', 90), 30, 600);

    const sid  = String(qs('sessionId', qs('studentKey','')) || '');
    const ts   = String(qs('ts', Date.now()));
    const seed = String(cfg.seed || qs('seed', sid ? (sid + '|' + ts) : ts));

    engine.runMode = mode;
    engine.diff = diff;
    engine.timeSec = time;
    engine.seed = seed;
    engine.rng = makeRng(seed);

    const dp = diffParams(diff);

    engine.running = true;
    engine.ended = false;
    engine.flushedEnd = false;

    engine.left = time;
    engine.tStart = now();

    engine.score = 0;
    engine.combo = 0;
    engine.comboMax = 0;
    engine.misses = 0;

    engine.hitAll = 0;
    engine.hitFood = 0;
    engine.hitJunk = 0;
    engine.hitJunkGuard = 0;
    engine.expireFood = 0;

    engine.counts = { veg:0, fruit:0, protein:0, carb:0 };
    engine.totalFood = 0;
    engine.balancePct = 0;

    engine.shield = 0;

    engine.sizeBase = dp.size;
    engine.ttlMs = dp.ttl;

    engine.adapt.spawnMs = dp.spawnMs;
    engine.adapt.ttl = dp.ttl;
    engine.adapt.size = dp.size;
    engine.adapt.junk = dp.junk;

    engine.spawnMs = dp.spawnMs;
    engine.junkBias = dp.junk;

    engine.goalIndex = 0;
    engine.goalsCleared = 0;
    engine.goalsTotal = GOALS.length;

    engine.miniActive = null;
    engine.miniCleared = 0;
    engine.miniTotal = 0;

    power.guideUntil = 0;

    engine.vx = 0; engine.vy = 0;
    applyView();

    emitBalance();
    updateTime();
    updateScore();
    updateQuestUI();

    emit('hha:coach', { mood:'neutral', text:'เริ่มเลย! เน้น “สมดุล” ก่อนคะแนน 💚' });

    // Start mini chain shortly (keeps first seconds clean)
    ROOT.setTimeout(()=>{ if (engine.running && !engine.ended) startNextMini(); }, 1200);

    loopSpawn();
    loopTick();
  }

  // --------- Init bindings once ---------
  setupViewControls();
  bindBackHubFlush();
  bindPageHideFlush();

  // expose global helpers (optional)
  ROOT.PlateBoot = ROOT.PlateBoot || {};
  ROOT.PlateBoot.start = start;
  ROOT.PlateBoot.endGame = endGame;

  return { start, endGame };
}

// Optional global default boot usage if someone loads without boot wrapper
try{
  if (typeof window !== 'undefined'){
    window.PlateVR = window.PlateVR || {};
    window.PlateVR.boot = boot;
  }
}catch(_){}
