/* === /herohealth/plate-vr/plate.safe.js ===
Balanced Plate VR — SAFE (PRODUCTION) — HHA Standard (FULL + FLUSH PATCH)
✅ DOM emoji targets on #plate-layer
✅ Seeded RNG (research default) + optional ?seed=
✅ Play mode: adaptive difficulty (spawn/ttl/size/junkBias live)
✅ Research mode: fixed by diff (easy/normal/hard)
✅ Miss definition: miss = good expired + junk hit (NOT blocked by shield)
✅ FEVER -> Shield (blocks junk; guarded junk does NOT count as miss)
✅ Quest: Goals stages (1/3,2/3,3/3) + Mini “Plate Rush” (5 in 8s + no junk during mini)
✅ End Summary overlay + Back HUB + localStorage(HHA_LAST_SUMMARY)
✅ Cloud Logger compatible: hha:log_event({type:'spawn'|'hit'|'miss_expire'|'shield_block'|'end'... , data:{...}})
✅ NEW: flushNowBestEffort() + flush before goHub / before end overlay / pagehide
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  // ------------------------- Globals -------------------------
  const NS = (root.PlateVR = root.PlateVR || {});
  const Boot = (root.PlateBoot = root.PlateBoot || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(_){} };

  // ------------------------- Helpers -------------------------
  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function qs(name, def){
    try{ return (new URL(root.location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
  }
  function intQ(name, def){
    const v = parseInt(qs(name, def), 10);
    return Number.isFinite(v) ? v : def;
  }
  function strQ(name, def){ return String(qs(name, def) ?? def); }
  function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }

  // ------------------------- Seeded RNG -------------------------
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

  // ------------------------- External modules (safe fallbacks) -------------------------
  const Particles =
    (root.GAME_MODULES && root.GAME_MODULES.Particles) ||
    root.Particles ||
    { scorePop(){}, burstAt(){}, celebrate(){}, judgeText(){} };

  const FeverUI =
    (root.GAME_MODULES && root.GAME_MODULES.FeverUI) ||
    root.FeverUI ||
    {
      ensure(){},
      set(){},
      add(){},
      setShield(){},
      get(){ return { value:0, state:'ok', shield:0 }; }
    };

  // ------------------------- Logger (cloud compatible) -------------------------
  function hhaLogEvent(payload){
    // expected: {type:'spawn'|'hit'|'miss_expire'|'shield_block'|'end'... , data:{...}}
    try{
      if (root.hha && typeof root.hha.log_event === 'function'){
        root.hha.log_event(payload);
        return;
      }
    }catch(_){}
    try{
      if (root.HHA && typeof root.HHA.log_event === 'function'){
        root.HHA.log_event(payload);
        return;
      }
    }catch(_){}
    // no logger attached => silent
  }

  async function withTimeout(promise, ms){
    ms = Math.max(80, ms|0);
    return await Promise.race([
      Promise.resolve().then(()=>promise),
      new Promise((resolve)=> setTimeout(()=>resolve('timeout'), ms))
    ]);
  }

  async function flushNowBestEffort(reason){
    // Try multiple common flush hooks; never block too long.
    const t0 = now();
    try{ hhaLogEvent({ type:'flush_try', data:{ reason:String(reason||'') } }); }catch(_){}
    let ok = false;

    try{
      if (root.hha && typeof root.hha.flush === 'function'){
        const r = await withTimeout(root.hha.flush(), 750);
        ok = (r !== 'timeout') || ok;
      }
    }catch(_){}

    try{
      if (!ok && root.HHA && typeof root.HHA.flush === 'function'){
        const r = await withTimeout(root.HHA.flush(), 750);
        ok = (r !== 'timeout') || ok;
      }
    }catch(_){}

    try{
      if (!ok && root.HHA_CloudLogger && typeof root.HHA_CloudLogger.flush === 'function'){
        const r = await withTimeout(root.HHA_CloudLogger.flush(), 750);
        ok = (r !== 'timeout') || ok;
      }
    }catch(_){}

    try{
      // If logger uses navigator.sendBeacon internally, pagehide may already flush.
      // We still signal an event so sheet has a final marker.
      hhaLogEvent({ type:'flush_done', data:{ ok:!!ok, reason:String(reason||''), durMs: Math.round(now()-t0) } });
    }catch(_){}
    return ok;
  }

  // ------------------------- DOM / Styles -------------------------
  const layer = DOC.getElementById('plate-layer') || DOC.querySelector('.plate-layer');
  if (!layer) return;

  function ensureStyles(){
    if (DOC.getElementById('plate-safe-style')) return;
    const st = DOC.createElement('style');
    st.id = 'plate-safe-style';
    st.textContent = `
      :root{ --plateVx:0px; --plateVy:0px; }

      #plate-layer{
        transform: translate(var(--plateVx), var(--plateVy));
        will-change: transform;
      }

      .plate-target{
        position:absolute;
        left:0; top:0;
        transform: translate(calc(var(--x) * 1px), calc(var(--y) * 1px)) scale(var(--s));
        width: 74px; height: 74px;
        display:grid; place-items:center;
        border-radius: 999px;
        user-select:none;
        -webkit-tap-highlight-color: transparent;
        cursor: pointer;
        font-size: 40px;
        line-height:1;
        filter: drop-shadow(0 10px 26px rgba(0,0,0,.55));
        transition: transform .10s ease, opacity .16s ease, filter .16s ease;
      }
      .plate-target::before{
        content:'';
        position:absolute; inset:-10px;
        border-radius: 999px;
        border: 2px solid rgba(148,163,184,.18);
        box-shadow: inset 0 0 0 1px rgba(148,163,184,.08);
        background: radial-gradient(circle at 35% 28%, rgba(255,255,255,.14), transparent 46%),
                    radial-gradient(circle at 60% 80%, rgba(34,197,94,.10), transparent 55%);
        opacity:.95;
      }
      .plate-target.good::before{ border-color: rgba(34,197,94,.32); }
      .plate-target.junk::before{ border-color: rgba(239,68,68,.30); background:
        radial-gradient(circle at 35% 28%, rgba(255,255,255,.12), transparent 46%),
        radial-gradient(circle at 60% 80%, rgba(239,68,68,.14), transparent 55%);
      }
      .plate-target.star::before{ border-color: rgba(251,191,36,.40); }
      .plate-target.diamond::before{ border-color: rgba(34,211,238,.40); }

      .plate-target .em{
        position:relative;
        z-index:1;
        transform: translateZ(0);
        text-shadow: 0 8px 24px rgba(0,0,0,.45);
      }

      .plate-target.spawn{ animation: platePop .18s ease-out both; }
      @keyframes platePop{
        from{ transform: translate(calc(var(--x) * 1px), calc(var(--y) * 1px)) scale(calc(var(--s) * 0.72)); opacity:.0; }
        to  { transform: translate(calc(var(--x) * 1px), calc(var(--y) * 1px)) scale(var(--s)); opacity:1; }
      }
      .plate-target.hit{
        opacity:0;
        transform: translate(calc(var(--x) * 1px), calc(var(--y) * 1px)) scale(calc(var(--s) * 1.22));
        filter: drop-shadow(0 0 0 rgba(0,0,0,0));
      }
      .plate-target.out{
        opacity:0;
        transform: translate(calc(var(--x) * 1px), calc(var(--y) * 1px)) scale(calc(var(--s) * 0.85));
      }

      body.plate-urgent{
        animation: plateUrgent .28s linear infinite;
      }
      @keyframes plateUrgent{
        0%,100%{ box-shadow: inset 0 0 0 0 rgba(239,68,68,0); }
        50%{ box-shadow: inset 0 0 0 6px rgba(239,68,68,.08); }
      }
    `;
    DOC.head.appendChild(st);
  }
  ensureStyles();

  function setXY(el, x, y){
    el.style.setProperty('--x', String(x.toFixed(1)));
    el.style.setProperty('--y', String(y.toFixed(1)));
    el.dataset._x = String(x);
    el.dataset._y = String(y);
  }
  function getXY(el){
    const x = Number(el.dataset._x);
    const y = Number(el.dataset._y);
    return { x: (Number.isFinite(x)?x:0), y:(Number.isFinite(y)?y:0) };
  }

  // ------------------------- Safe Spawn Rect (avoid HUD) -------------------------
  function safeRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;

    // Prefer reading actual HUD size if exists
    let topPad = 150, botPad = 170, sidePad = 16;
    const hud = DOC.querySelector('.hud-top');
    if (hud){
      try{
        const r = hud.getBoundingClientRect();
        if (r && r.bottom) topPad = Math.max(topPad, Math.round(r.bottom + 12));
      }catch(_){}
    }

    // safe-area insets (best-effort)
    const cs = getComputedStyle(DOC.documentElement);
    const sat = parseInt(cs.getPropertyValue('--sat')||'0',10) || 0;
    const sab = parseInt(cs.getPropertyValue('--sab')||'0',10) || 0;
    const sal = parseInt(cs.getPropertyValue('--sal')||'0',10) || 0;
    const sar = parseInt(cs.getPropertyValue('--sar')||'0',10) || 0;

    topPad += sat;
    botPad += sab;
    sidePad += Math.max(sal, sar);

    // never allow tiny rect -> relax
    const x0 = sidePad;
    const x1 = Math.max(x0 + 140, W - sidePad);
    const y0 = topPad;
    const y1 = Math.max(y0 + 220, H - botPad);

    return { W, H, x0, x1, y0, y1 };
  }
  function randPos(rng){
    const r = safeRect();
    const x = r.x0 + rng()*(r.x1 - r.x0);
    const y = r.y0 + rng()*(r.y1 - r.y0);
    return { x, y };
  }

  // ------------------------- Content: Plate groups -------------------------
  const PLATE = {
    veg:     { label:'ผัก',   emoji:['🥦','🥬','🥕','🌽','🥒','🍆','🍅','🥗'] },
    fruit:   { label:'ผลไม้', emoji:['🍎','🍌','🍊','🍉','🍇','🍓','🍍','🥝'] },
    grain:   { label:'ข้าว-แป้ง', emoji:['🍚','🍞','🍜','🥖','🥔','🍠','🥨','🥞'] },
    protein: { label:'โปรตีน', emoji:['🥚','🍗','🐟','🥛','🫘','🥜','🍖','🧀'] },
    junk:    { label:'ขยะ',   emoji:['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🥤'] }
  };

  // Balanced target ratio for full plate (12)
  const PLATE_TOTAL = 12;
  const NEED_FULL = { veg:4, fruit:2, grain:3, protein:3 }; // 4+2+3+3 = 12
  function needForStage(stage){
    // stage: 1..3 => 1/3, 2/3, 3/3
    const m = clamp(stage,1,3);
    const frac = (m===1? (1/3) : (m===2? (2/3) : 1));
    const n = {
      veg: Math.round(NEED_FULL.veg*frac),
      fruit: Math.round(NEED_FULL.fruit*frac),
      grain: Math.round(NEED_FULL.grain*frac),
      protein: Math.round(NEED_FULL.protein*frac),
    };
    // ensure totals align nicely
    const sum = n.veg+n.fruit+n.grain+n.protein;
    const want = (m===1?4:(m===2?8:12));
    // adjust by adding to veg/grain first
    let diff = want - sum;
    while(diff > 0){ n.veg++; diff--; if(diff<=0) break; n.grain++; diff--; }
    while(diff < 0){ if(n.veg>0){ n.veg--; diff++; } else if(n.grain>0){ n.grain--; diff++; } else break; }
    return n;
  }

  // ------------------------- Difficulty -------------------------
  function diffParams(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy') return { spawnMs:920, ttl:1750, size:1.06, junk:0.12, star:0.015, diamond:0.008 };
    if (diff === 'hard') return { spawnMs:660, ttl:1400, size:0.92, junk:0.20, star:0.013, diamond:0.007 };
    return                 { spawnMs:780, ttl:1580, size:1.00, junk:0.16, star:0.014, diamond:0.008 };
  }
  function rankFromAcc(acc){
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  // ------------------------- Engine State -------------------------
  const engine = {
    running:false,
    ended:false,

    runMode:'play',
    diff:'normal',
    timeSec:90,
    left:90,

    seed:'seed',
    rng:Math.random,
    startMs:0,

    // view shift
    vx:0, vy:0, dragOn:false, dragX:0, dragY:0,

    // score
    score:0,
    combo:0,
    comboMax:0,
    misses:0,
    hitGood:0,
    hitAll:0,

    // fever/shield
    fever:0,
    feverMax:100,
    shield:0,

    // plate progress
    stage:1,
    need: needForStage(1),
    got: { veg:0, fruit:0, grain:0, protein:0 },

    // mini: Plate Rush
    miniActive:false,
    miniNow:0,
    miniNeed:5,
    miniStartMs:0,
    miniWindowMs:8000,
    miniNoJunkOk:true,

    // adaptive
    adapt: { spawnMs:780, ttl:1580, size:1.00, junk:0.16, star:0.014, diamond:0.008 },

    // timers
    tSpawn:0,
    tTick:0,
    tMini:0,
  };

  // ------------------------- HUD updates -------------------------
  function updateScore(){
    emit('hha:score', { score:engine.score|0, combo:engine.combo|0, comboMax:engine.comboMax|0, misses:engine.misses|0 });
    updateRank();
  }
  function updateRank(){
    const acc = engine.hitAll>0 ? Math.round((engine.hitGood/engine.hitAll)*100) : 0;
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
  }
  function updateTime(){ emit('hha:time', { left: engine.left|0 }); }

  function goalTotalForStage(stage){
    const need = needForStage(stage);
    return need.veg + need.fruit + need.grain + need.protein;
  }
  function goalNowForStage(stage){
    const need = needForStage(stage);
    const got = engine.got;
    // cap contributions to each need (so overshoot doesn't inflate)
    return (
      Math.min(got.veg, need.veg) +
      Math.min(got.fruit, need.fruit) +
      Math.min(got.grain, need.grain) +
      Math.min(got.protein, need.protein)
    );
  }
  function emitQuest(){
    const goalTitle = (engine.stage===1?'เติมจานครบ 1/3':'') ||
                      (engine.stage===2?'เติมจานครบ 2/3':'') ||
                      'เติมจานครบ 3/3';

    const goalTotal = goalTotalForStage(engine.stage);
    const goalNow = goalNowForStage(engine.stage);

    const miniTitle = engine.miniActive ? 'Plate Rush ⚡ (ห้ามโดนขยะ)' : '—';
    const miniTotal = engine.miniActive ? engine.miniNeed : 0;
    const miniNow   = engine.miniActive ? engine.miniNow : 0;
    const miniLeftMs = engine.miniActive ? Math.max(0, (engine.miniStartMs + engine.miniWindowMs) - now()) : 0;

    emit('quest:update', {
      goalTitle,
      goalNow, goalTotal,
      miniTitle,
      miniNow, miniTotal,
      miniLeftMs
    });
  }

  // ------------------------- FEVER/SHIELD -------------------------
  function feverState(v){
    if (v >= 85) return 'hot';
    if (v >= 60) return 'warm';
    if (v >= 35) return 'ok';
    return 'low';
  }
  function setFever(v){
    engine.fever = clamp(v, 0, engine.feverMax);
    try{ FeverUI.ensure?.(); }catch(_){}
    try{ FeverUI.set?.(engine.fever, feverState(engine.fever)); }catch(_){}
    emit('hha:fever', { value: engine.fever|0, state: feverState(engine.fever), shield: engine.shield|0 });
  }
  function addFever(delta){
    setFever(engine.fever + (delta|0));
    if (engine.fever >= engine.feverMax && engine.shield < 1){
      engine.shield = 1;
      try{ FeverUI.setShield?.(1); }catch(_){}
      emit('hha:judge', { kind:'good', text:'SHIELD READY!' });
      emit('hha:celebrate', { kind:'mini', title:'🛡️ SHIELD READY!' });
    }
  }
  function consumeShield(){
    if (engine.shield > 0){
      engine.shield = 0;
      try{ FeverUI.setShield?.(0); }catch(_){}
    }
  }

  // ------------------------- View shift (VR feel) -------------------------
  function applyView(){
    DOC.documentElement.style.setProperty('--plateVx', engine.vx.toFixed(1)+'px');
    DOC.documentElement.style.setProperty('--plateVy', engine.vy.toFixed(1)+'px');
  }
  function setupView(){
    layer.addEventListener('pointerdown', (e)=>{
      engine.dragOn = true;
      engine.dragX = e.clientX; engine.dragY = e.clientY;
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
  setupView();

  Boot.recenter = function(){ engine.vx = 0; engine.vy = 0; applyView(); };

  // ------------------------- Targets -------------------------
  let targetSeq = 0;

  function makeTarget(kind, groupKey, emoji, x, y, s){
    const el = DOC.createElement('div');
    el.className = 'plate-target spawn';
    el.dataset.id = String(++targetSeq);
    el.dataset.kind = String(kind); // 'good'|'junk'|'star'|'diamond'
    el.dataset.group = String(groupKey||'');
    el.dataset.emoji = String(emoji||'✨');

    if (kind === 'good') el.classList.add('good');
    if (kind === 'junk') el.classList.add('junk');
    if (kind === 'star') el.classList.add('star');
    if (kind === 'diamond') el.classList.add('diamond');

    el.style.setProperty('--s', String((s||1).toFixed(3)));
    setXY(el, x, y);

    const span = DOC.createElement('div');
    span.className = 'em';
    span.textContent = String(emoji||'✨');
    el.appendChild(span);

    // TTL
    const ttl = engine.adapt.ttl;
    el._ttlTimer = root.setTimeout(()=>{
      if (!el.isConnected) return;

      // miss by expire: only GOOD
      if (String(el.dataset.kind) === 'good'){
        engine.misses++;
        engine.combo = 0;
        engine.hitAll++;
        // note: hitGood not incremented
        addFever(-8);
        emit('hha:judge', { kind:'warn', text:'MISS!' });
        updateScore();

        // log miss_expire
        hhaLogEvent({
          type:'miss_expire',
          data:{
            eventType:'miss_expire',
            timeFromStartMs: Math.round(now()-engine.startMs),
            rtMs: null,
            itemType: 'good',
            emoji: el.dataset.emoji,
            targetId: el.dataset.id,
            judgment: 'miss_expire',
            totalScore: engine.score|0,
            combo: engine.combo|0,
            isGood: true,
            feverValue: engine.fever|0,
            feverState: feverState(engine.fever),
            goalProgress: { stage: engine.stage, now: goalNowForStage(engine.stage), total: goalTotalForStage(engine.stage), need: engine.need, got: engine.got },
            miniProgress: { active: !!engine.miniActive, now: engine.miniNow|0, total: engine.miniNeed|0, leftMs: engine.miniActive?Math.max(0,(engine.miniStartMs+engine.miniWindowMs)-now()):0 }
          }
        });
      }

      el.classList.add('out');
      root.setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
    }, ttl);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      onHit(el);
    }, { passive:false });

    return el;
  }

  function removeTarget(el){
    try{ root.clearTimeout(el._ttlTimer); }catch(_){}
    el.classList.add('hit');
    root.setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
  }

  // ------------------------- Spawning logic -------------------------
  function chooseKind(){
    // powerups
    if (engine.rng() < engine.adapt.diamond) return 'diamond';
    if (engine.rng() < engine.adapt.star) return 'star';

    // junk bias
    if (engine.rng() < engine.adapt.junk) return 'junk';
    return 'good';
  }

  function chooseEmoji(kind){
    if (kind === 'junk') return pick(engine.rng, PLATE.junk.emoji);
    if (kind === 'star') return '⭐';
    if (kind === 'diamond') return '💎';

    // good -> weighted by what we still need in current stage
    const need = needForStage(engine.stage);
    const got = engine.got;
    const remain = {
      veg: Math.max(0, need.veg - got.veg),
      fruit: Math.max(0, need.fruit - got.fruit),
      grain: Math.max(0, need.grain - got.grain),
      protein: Math.max(0, need.protein - got.protein),
    };
    const pool = [];
    function addMany(key, w){
      const n = Math.max(1, w|0);
      for (let i=0;i<n;i++) pool.push(key);
    }
    addMany('veg',     1 + remain.veg);
    addMany('fruit',   1 + remain.fruit);
    addMany('grain',   1 + remain.grain);
    addMany('protein', 1 + remain.protein);

    const groupKey = pool.length ? pick(engine.rng, pool) : 'veg';
    return { groupKey, emoji: pick(engine.rng, PLATE[groupKey].emoji) };
  }

  function spawnOne(){
    if (!engine.running || engine.ended) return;

    const kind = chooseKind();
    const p = randPos(engine.rng);
    const s = engine.adapt.size * (kind==='junk' ? 0.96 : 1.0);

    let groupKey = '';
    let emoji = '✨';
    if (kind === 'good'){
      const g = chooseEmoji('good');
      groupKey = g.groupKey;
      emoji = g.emoji;
    }else{
      emoji = chooseEmoji(kind);
    }

    const el = makeTarget(kind, groupKey, emoji, p.x, p.y, s);
    layer.appendChild(el);

    // log spawn
    hhaLogEvent({
      type:'spawn',
      data:{
        eventType:'spawn',
        timeFromStartMs: Math.round(now()-engine.startMs),
        itemType: kind,
        emoji,
        targetId: el.dataset.id,
        group: groupKey,
        totalScore: engine.score|0,
        combo: engine.combo|0,
        isGood: kind==='good',
        feverValue: engine.fever|0,
        feverState: feverState(engine.fever),
        goalProgress: { stage: engine.stage, now: goalNowForStage(engine.stage), total: goalTotalForStage(engine.stage) },
        miniProgress: { active: !!engine.miniActive, now: engine.miniNow|0, total: engine.miniNeed|0 }
      }
    });
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;
    spawnOne();
    engine.tSpawn = root.setTimeout(loopSpawn, Math.max(420, engine.adapt.spawnMs|0));
  }

  // ------------------------- Mini: Plate Rush -------------------------
  function startMiniRush(){
    engine.miniActive = true;
    engine.miniNow = 0;
    engine.miniStartMs = now();
    engine.miniNoJunkOk = true;
    emitQuest();

    emit('hha:judge', { kind:'good', text:'PLATE RUSH!' });
    emit('hha:celebrate', { kind:'mini', title:'Plate Rush ⚡' });

    tickMini();
  }

  function failMiniRush(reason){
    engine.miniActive = false;
    engine.miniNow = 0;
    emitQuest();

    emit('hha:judge', { kind:'warn', text:'MINI FAIL!' });
    try{ DOC.body.classList.remove('plate-urgent'); }catch(_){}
    // small penalty
    addFever(-10);
  }

  function completeMiniRush(){
    engine.miniActive = false;
    engine.miniNow = 0;
    emitQuest();

    emit('hha:judge', { kind:'good', text:'MINI CLEAR!' });
    emit('hha:celebrate', { kind:'goal', title:'MINI CLEAR!' });

    // reward: score + fever
    engine.score += 650;
    addFever(+18);
    updateScore();
    try{ DOC.body.classList.remove('plate-urgent'); }catch(_){}
  }

  function tickMini(){
    if (!engine.miniActive || engine.ended) return;
    const left = (engine.miniStartMs + engine.miniWindowMs) - now();

    // urgent FX in last 2.2s
    if (left <= 2200){
      try{ DOC.body.classList.add('plate-urgent'); }catch(_){}
    }else{
      try{ DOC.body.classList.remove('plate-urgent'); }catch(_){}
    }

    if (left <= 0){
      failMiniRush('timeout');
      return;
    }
    emitQuest();
    engine.tMini = root.setTimeout(tickMini, 120);
  }

  // ------------------------- Goal progression -------------------------
  function resetPlateProgress(){
    engine.stage = 1;
    engine.need = needForStage(1);
    engine.got = { veg:0, fruit:0, grain:0, protein:0 };
    emitQuest();
  }

  function stageCompleted(stage){
    const need = needForStage(stage);
    return (engine.got.veg >= need.veg &&
            engine.got.fruit >= need.fruit &&
            engine.got.grain >= need.grain &&
            engine.got.protein >= need.protein);
  }

  function advanceStage(){
    if (engine.stage === 1){
      engine.stage = 2; engine.need = needForStage(2);
      emit('hha:celebrate', { kind:'goal', title:'GOAL 1/3 CLEAR!' });
    }else if (engine.stage === 2){
      engine.stage = 3; engine.need = needForStage(3);
      emit('hha:celebrate', { kind:'goal', title:'GOAL 2/3 CLEAR!' });
    }else{
      // all goals complete
      emit('hha:celebrate', { kind:'all', title:'ALL GOALS CLEARED!' });
      endGame('all_goals');
      return;
    }

    emitQuest();

    // trigger mini between stages (fun)
    if (!engine.miniActive){
      startMiniRush();
    }
  }

  // ------------------------- Hit logic -------------------------
  function onHit(el){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    const kind = String(el.dataset.kind||'');
    const id = String(el.dataset.id||'');
    const emoji = String(el.dataset.emoji||'');

    // measure RT if available
    const spawnAt = Number(el.dataset.spawnAt)||0;
    const rtMs = (spawnAt>0) ? Math.round(now()-spawnAt) : null;

    engine.hitAll++;

    // POWERUPS
    if (kind === 'star'){
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      engine.score += 180 + Math.min(220, engine.combo*4);
      addFever(+10);
      emit('hha:judge', { kind:'good', text:'STAR!' });
      Particles.burstAt?.(el, { kind:'star' });

      // bonus: quick mini progress (but only if mini active)
      if (engine.miniActive){
        engine.miniNow = Math.min(engine.miniNeed, engine.miniNow + 1);
      }
      emitQuest();
      updateScore();

      hhaLogEvent({
        type:'hit',
        data:{
          eventType:'hit',
          timeFromStartMs: Math.round(now()-engine.startMs),
          rtMs,
          itemType:'star',
          emoji,
          targetId:id,
          judgment:'hit_star',
          totalScore: engine.score|0,
          combo: engine.combo|0,
          isGood:true,
          feverValue: engine.fever|0,
          feverState: feverState(engine.fever),
          goalProgress: { stage: engine.stage, now: goalNowForStage(engine.stage), total: goalTotalForStage(engine.stage) },
          miniProgress: { active: !!engine.miniActive, now: engine.miniNow|0, total: engine.miniNeed|0, leftMs: engine.miniActive?Math.max(0,(engine.miniStartMs+engine.miniWindowMs)-now()):0 }
        }
      });

      removeTarget(el);
      return;
    }

    if (kind === 'diamond'){
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      engine.score += 260 + Math.min(240, engine.combo*5);
      // diamond: instant shield
      engine.fever = engine.feverMax;
      engine.shield = 1;
      try{ FeverUI.set?.(engine.fever, feverState(engine.fever)); FeverUI.setShield?.(1); }catch(_){}
      emit('hha:judge', { kind:'good', text:'DIAMOND! 🛡️' });
      emit('hha:celebrate', { kind:'mini', title:'DIAMOND SHIELD!' });
      emitQuest();
      updateScore();

      hhaLogEvent({
        type:'hit',
        data:{
          eventType:'hit',
          timeFromStartMs: Math.round(now()-engine.startMs),
          rtMs,
          itemType:'diamond',
          emoji,
          targetId:id,
          judgment:'hit_diamond',
          totalScore: engine.score|0,
          combo: engine.combo|0,
          isGood:true,
          feverValue: engine.fever|0,
          feverState: feverState(engine.fever),
          goalProgress: { stage: engine.stage, now: goalNowForStage(engine.stage), total: goalTotalForStage(engine.stage) },
          miniProgress: { active: !!engine.miniActive, now: engine.miniNow|0, total: engine.miniNeed|0 }
        }
      });

      removeTarget(el);
      return;
    }

    // GOOD
    if (kind === 'good'){
      engine.hitGood++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      const group = String(el.dataset.group||'veg');
      if (engine.got[group] == null) engine.got[group] = 0;
      engine.got[group]++;

      const mult = (engine.shield>0 && engine.fever>=85) ? 1.1 : 1.0;
      engine.score += Math.round((110 + engine.combo*3) * mult);

      addFever(+6);

      if (engine.miniActive){
        engine.miniNow = Math.min(engine.miniNeed, engine.miniNow + 1);
        emitQuest();
        if (engine.miniNow >= engine.miniNeed && engine.miniNoJunkOk){
          completeMiniRush();
        }
      }

      emit('hha:judge', { kind:'good', text:'GOOD!' });
      Particles.scorePop?.(el, { text:'+'+String(40 + (engine.combo|0)), kind:'good' });
      Particles.burstAt?.(el, { kind:'good' });

      updateScore();

      // check stage completion
      if (stageCompleted(engine.stage)){
        advanceStage();
      }else{
        emitQuest();
      }

      hhaLogEvent({
        type:'hit',
        data:{
          eventType:'hit',
          timeFromStartMs: Math.round(now()-engine.startMs),
          rtMs,
          itemType:'good',
          emoji,
          targetId:id,
          judgment:'hit_good',
          totalScore: engine.score|0,
          combo: engine.combo|0,
          isGood:true,
          feverValue: engine.fever|0,
          feverState: feverState(engine.fever),
          goalProgress: { stage: engine.stage, now: goalNowForStage(engine.stage), total: goalTotalForStage(engine.stage), got: engine.got, need: needForStage(engine.stage) },
          miniProgress: { active: !!engine.miniActive, now: engine.miniNow|0, total: engine.miniNeed|0, leftMs: engine.miniActive?Math.max(0,(engine.miniStartMs+engine.miniWindowMs)-now()):0 }
        }
      });

      removeTarget(el);
      return;
    }

    // JUNK
    if (kind === 'junk'){
      // mini rule: any junk during mini => fail mini (if not shield blocked)
      if (engine.shield > 0){
        consumeShield();
        engine.combo = Math.max(0, engine.combo - 1);

        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        Particles.burstAt?.(el, { kind:'shield' });

        updateScore();

        hhaLogEvent({
          type:'shield_block',
          data:{
            eventType:'shield_block',
            timeFromStartMs: Math.round(now()-engine.startMs),
            rtMs,
            itemType:'junk',
            emoji,
            targetId:id,
            judgment:'shield_block',
            totalScore: engine.score|0,
            combo: engine.combo|0,
            isGood:false,
            feverValue: engine.fever|0,
            feverState: feverState(engine.fever),
            goalProgress: { stage: engine.stage, now: goalNowForStage(engine.stage), total: goalTotalForStage(engine.stage) },
            miniProgress: { active: !!engine.miniActive, now: engine.miniNow|0, total: engine.miniNeed|0 }
          }
        });

        removeTarget(el);
        return;
      }

      engine.misses++;
      engine.combo = 0;
      addFever(-10);
      emit('hha:judge', { kind:'bad', text:'JUNK!' });

      if (engine.miniActive){
        engine.miniNoJunkOk = false;
        failMiniRush('junk_hit');
      }

      updateScore();

      hhaLogEvent({
        type:'hit',
        data:{
          eventType:'hit',
          timeFromStartMs: Math.round(now()-engine.startMs),
          rtMs,
          itemType:'junk',
          emoji,
          targetId:id,
          judgment:'hit_junk',
          totalScore: engine.score|0,
          combo: engine.combo|0,
          isGood:false,
          feverValue: engine.fever|0,
          feverState: feverState(engine.fever),
          goalProgress: { stage: engine.stage, now: goalNowForStage(engine.stage), total: goalTotalForStage(engine.stage) },
          miniProgress: { active: !!engine.miniActive, now: engine.miniNow|0, total: engine.miniNeed|0 }
        }
      });

      removeTarget(el);
      return;
    }
  }

  // ------------------------- Adaptive difficulty (play only) -------------------------
  function adaptTick(){
    if (engine.runMode !== 'play') return;

    const acc = engine.hitAll>0 ? (engine.hitGood/engine.hitAll) : 0;
    const heat = clamp((engine.combo/22) + (acc - 0.62), 0, 1);

    // hotter => harder
    engine.adapt.spawnMs = clamp(860 - heat*280, 460, 940);
    engine.adapt.ttl     = clamp(1680 - heat*280, 1200, 1780);
    engine.adapt.size    = clamp(1.03 - heat*0.12, 0.86, 1.06);

    engine.adapt.junk    = clamp(0.14 + heat*0.08, 0.10, 0.26);
    engine.adapt.star    = clamp(0.014 - heat*0.003, 0.010, 0.016);
    engine.adapt.diamond = clamp(0.008 - heat*0.002, 0.005, 0.010);

    emit('hha:adaptive', {
      heat: Number(heat.toFixed(2)),
      spawnMs: engine.adapt.spawnMs|0,
      ttl: engine.adapt.ttl|0,
      size: Number(engine.adapt.size.toFixed(2)),
      junkBias: Number(engine.adapt.junk.toFixed(3))
    });
  }

  // ------------------------- Main tick -------------------------
  function loopTick(){
    if (!engine.running || engine.ended) return;

    // time
    engine.left = Math.max(0, engine.left - 0.14);
    updateTime();

    // adapt
    adaptTick();

    // mini quest tick display
    if (engine.miniActive) emitQuest();

    // end
    if (engine.left <= 0){
      endGame('time');
      return;
    }

    engine.tTick = root.setTimeout(loopTick, 140);
  }

  function clearAllTargets(){
    const list = layer.querySelectorAll('.plate-target');
    list.forEach(el=>{
      try{ root.clearTimeout(el._ttlTimer); }catch(_){}
      try{ el.remove(); }catch(_){}
    });
  }

  // ------------------------- End overlay + summary -------------------------
  function ensureEndOverlay(){
    let overlay = DOC.getElementById('endOverlay');
    if (!overlay){
      overlay = DOC.createElement('div');
      overlay.id = 'endOverlay';
      overlay.className = 'result-overlay';
      overlay.innerHTML = `
        <div class="result-card">
          <h2>สรุปผล — Balanced Plate VR</h2>
          <p>Score: <b id="endScore">0</b> · Rank: <b id="endRank">C</b> · Acc: <b id="endAcc">0%</b></p>
          <p>ComboMax: <b id="endComboMax">0</b> · Miss: <b id="endMiss">0</b></p>
          <p>Goals: <b id="endGoals">0/0</b> · Minis: <b id="endMinis">0/0</b></p>
          <div class="result-actions">
            <button class="btn primary" id="btnRetry" type="button">RETRY</button>
            <button class="btn ghost" id="btnBackHub" type="button">กลับ HUB</button>
          </div>
        </div>
      `;
      DOC.body.appendChild(overlay);
    }

    const btnRetry = DOC.getElementById('btnRetry');
    const btnBack  = DOC.getElementById('btnBackHub');
    if (btnRetry && !btnRetry._bound){
      btnRetry._bound = 1;
      btnRetry.addEventListener('click', async ()=>{
        try{ await flushNowBestEffort('retry'); }catch(_){}
        root.location.reload();
      }, { passive:true });
    }
    if (btnBack && !btnBack._bound){
      btnBack._bound = 1;
      btnBack.addEventListener('click', async ()=>{
        await Boot.goHub();
      }, { passive:true });
    }
    return overlay;
  }

  function buildEndDetail(reason){
    const acc = engine.hitAll>0 ? Math.round((engine.hitGood/engine.hitAll)*100) : 0;
    const grade = rankFromAcc(acc);

    const goalsCleared = (engine.stage>=3 && stageCompleted(3)) ? 3 : (engine.stage===3?2:(engine.stage===2?1:0));
    const goalsTotal = 3;
    // mini: count as cleared if last mini complete at least once; track via flag
    const miniCleared = engine._miniClearedOnce ? 1 : 0;
    const miniTotal = 1;

    return {
      reason: String(reason||'end'),
      scoreFinal: engine.score|0,
      comboMax: engine.comboMax|0,
      misses: engine.misses|0,
      accuracyGoodPct: acc|0,
      grade,
      goalsCleared, goalsTotal,
      miniCleared, miniTotal,
      nHitGood: engine.hitGood|0,
      nHitAll:  engine.hitAll|0,
      diff: engine.diff,
      runMode: engine.runMode,
      seed: engine.seed,
      timeSec: engine.timeSec|0
    };
  }

  async function endGame(reason){
    if (engine.ended) return;
    engine.ended = true;
    engine.running = false;

    try{ root.clearTimeout(engine.tSpawn); }catch(_){}
    try{ root.clearTimeout(engine.tTick); }catch(_){}
    try{ root.clearTimeout(engine.tMini); }catch(_){}
    clearAllTargets();
    try{ DOC.body.classList.remove('plate-urgent'); }catch(_){}

    const detail = buildEndDetail(reason);

    // log end
    try{
      hhaLogEvent({
        type:'end',
        data:{
          eventType:'end',
          timeFromStartMs: Math.round(now()-engine.startMs),
          reason: detail.reason,
          totalScore: detail.scoreFinal,
          comboMax: detail.comboMax,
          misses: detail.misses,
          accuracyGoodPct: detail.accuracyGoodPct,
          grade: detail.grade,
          goalsCleared: detail.goalsCleared,
          goalsTotal: detail.goalsTotal,
          miniCleared: detail.miniCleared,
          miniTotal: detail.miniTotal,
          diff: detail.diff,
          runMode: detail.runMode,
          seed: detail.seed
        }
      });
    }catch(_){}

    // ✅ FLUSH before showing end overlay (best-effort, fast)
    try{ await flushNowBestEffort('end_game'); }catch(_){}

    // store last summary
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(detail||{}));
      localStorage.setItem('hha_last_summary', JSON.stringify(detail||{}));
    }catch(_){}

    // emit end
    emit('hha:end', detail);

    // show overlay + fill values
    const overlay = ensureEndOverlay();
    const s = DOC.getElementById('endScore'); if (s) s.textContent = String(detail.scoreFinal||0);
    const r = DOC.getElementById('endRank');  if (r) r.textContent = String(detail.grade||'C');
    const a = DOC.getElementById('endAcc');   if (a) a.textContent = String(detail.accuracyGoodPct||0) + '%';
    const cm= DOC.getElementById('endComboMax'); if (cm) cm.textContent = String(detail.comboMax||0);
    const ms= DOC.getElementById('endMiss');     if (ms) ms.textContent = String(detail.misses||0);
    const gl= DOC.getElementById('endGoals'); if (gl) gl.textContent = String(detail.goalsCleared||0)+'/'+String(detail.goalsTotal||0);
    const mn= DOC.getElementById('endMinis'); if (mn) mn.textContent = String(detail.miniCleared||0)+'/'+String(detail.miniTotal||0);

    if (overlay){
      overlay.style.display = 'flex';
      overlay.classList.add('show');
    }
  }

  // ------------------------- Public: goHub (flush before leave) -------------------------
  Boot.goHub = async function(){
    // allow hub passed in URL ?hub=
    const hub = String(qs('hub','../hub.html') || '../hub.html');

    // signal + flush quickly
    try{ hhaLogEvent({ type:'nav', data:{ where:'hub', timeFromStartMs: Math.round(now()-engine.startMs) } }); }catch(_){}
    try{ await flushNowBestEffort('go_hub'); }catch(_){}

    try{
      const u = new URL(hub, root.location.href);
      u.searchParams.set('ts', String(Date.now()));
      root.location.href = u.toString();
    }catch(_){
      root.location.href = hub;
    }
  };

  // ------------------------- Start / Reset -------------------------
  function resetAll(){
    engine.score=0; engine.combo=0; engine.comboMax=0; engine.misses=0;
    engine.hitGood=0; engine.hitAll=0;

    engine.fever=0; engine.shield=0;
    try{ FeverUI.ensure?.(); FeverUI.set?.(0,'low'); FeverUI.setShield?.(0); }catch(_){}

    engine._miniClearedOnce = false;

    resetPlateProgress();
    emitQuest();
    updateScore();
    updateTime();
  }

  function spawnStamp(el){
    try{ el.dataset.spawnAt = String(now()); }catch(_){}
  }

  function loopSpawnStamped(){
    if (!engine.running || engine.ended) return;

    // spawnOne already logs; stamp spawnAt for RT
    const beforeCount = layer.childElementCount;
    spawnOne();
    // stamp last inserted
    const afterCount = layer.childElementCount;
    if (afterCount > beforeCount){
      const last = layer.lastElementChild;
      if (last) spawnStamp(last);
    }

    engine.tSpawn = root.setTimeout(loopSpawnStamped, Math.max(420, engine.adapt.spawnMs|0));
  }

  async function start(runMode, cfg){
    cfg = cfg || {};
    engine.runMode = (String(runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    engine.diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
    engine.timeSec = clamp(cfg.time ?? intQ('time', 90), 30, 180);
    engine.left = engine.timeSec;

    const sid = String(qs('sessionId', qs('studentKey','')) || '');
    const ts  = String(qs('ts', Date.now()));
    engine.seed = String(cfg.seed || qs('seed', sid ? (sid + '|' + ts) : ts));
    engine.rng = makeRng(engine.seed);

    const dp = diffParams(engine.diff);
    engine.adapt.spawnMs = dp.spawnMs;
    engine.adapt.ttl     = dp.ttl;
    engine.adapt.size    = dp.size;
    engine.adapt.junk    = dp.junk;
    engine.adapt.star    = dp.star;
    engine.adapt.diamond = dp.diamond;

    // research = fixed by diff (no adaptive changes)
    if (engine.runMode === 'research'){
      // still keep stable values
    }

    engine.running = true;
    engine.ended = false;
    engine.startMs = now();

    // reset view
    engine.vx = 0; engine.vy = 0; applyView();

    resetAll();

    // start mini occasionally (fun) in play mode after 10s
    if (engine.runMode === 'play'){
      setTimeout(()=>{ if(engine.running && !engine.ended && !engine.miniActive) startMiniRush(); }, 10000);
    }

    // log session start marker
    hhaLogEvent({
      type:'start',
      data:{
        eventType:'start',
        timeFromStartMs: 0,
        diff: engine.diff,
        runMode: engine.runMode,
        seed: engine.seed,
        timeSec: engine.timeSec|0
      }
    });

    emitQuest();
    loopSpawnStamped();
    loopTick();
  }

  Boot.start = start;

  // ------------------------- Mini clear flag -------------------------
  const _completeMiniRush = completeMiniRush;
  completeMiniRush = function(){
    engine._miniClearedOnce = true;
    _completeMiniRush();
  };

  // ------------------------- Safety: pagehide flush -------------------------
  function onPageHide(){
    // do not await (pagehide)
    try{ flushNowBestEffort('pagehide'); }catch(_){}
  }
  try{
    root.addEventListener('pagehide', onPageHide, { passive:true });
    root.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') onPageHide();
    }, { passive:true });
  }catch(_){}

  // ------------------------- Autostart helper (optional) -------------------------
  // If HTML calls PlateBoot.start itself, fine.
  // If someone loads safe.js alone with ?autostart=1, we can start.
  try{
    if (qs('autostart','0') === '1' && !Boot._autoStarted){
      Boot._autoStarted = true;
      start(qs('run','play')==='research'?'research':'play', {
        diff: qs('diff','normal'),
        time: intQ('time', 90),
        seed: qs('seed', '')
      });
    }
  }catch(_){}

})(typeof window !== 'undefined' ? window : globalThis);
