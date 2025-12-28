/* === /herohealth/plate/plate.safe.js ===
Balanced Plate VR — SAFE (PRODUCTION) — Concept 1–5 LOCKED
PATCH:
- Goal3 requires balance >= 88%
- Minis evenly distributed (shuffle-bag / round-robin fairness)
- IIFE (non-module) + exposes window.PlateBoot.start/goHub/recenter
- Emits quest:update fields that match plate-vr.html handler:
  { goalTitle, goalNow, goalTotal, miniTitle, miniNow, miniTotal, miniLeftMs }
- Ensures end overlay reuse (#endOverlay) and binds retry/backhub with flush
- Injects minimal target CSS if missing
- Flush-hardened: end/backhub/pagehide/visibilitychange (best-effort)
------------------------------------------------------------ */

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // -------------------- helpers --------------------
  const now = () => (root.performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v, a, b) => { v = Number(v); if (!Number.isFinite(v)) v = 0; return Math.max(a, Math.min(b, v)); };

  function qs(name, def){
    try{ return (new URL(root.location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
  }
  function intQ(name, def){
    const v = parseInt(qs(name, def), 10);
    return Number.isFinite(v) ? v : def;
  }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  // -------------------- RNG (deterministic) --------------------
  function xmur3(str){
    str = String(str || '');
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
    const g = xmur3(String(seed || 'seed'));
    return sfc32(g(), g(), g(), g());
  }
  function shuffle(rng, arr){
    for (let i=arr.length-1;i>0;i--){
      const j = (rng()*(i+1))|0;
      const t = arr[i]; arr[i]=arr[j]; arr[j]=t;
    }
    return arr;
  }
  function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }

  // -------------------- locate layer --------------------
  const layer =
    DOC.getElementById('plate-layer') ||
    DOC.getElementById('pl-layer') ||
    DOC.getElementById('plateLayer') ||
    DOC.querySelector('.plate-layer') ||
    DOC.querySelector('.pl-layer');

  if (!layer){
    console.warn('[PlateVR] layer not found (#plate-layer / .plate-layer)');
    return;
  }

  // -------------------- optional modules --------------------
  const Particles =
    (root.GAME_MODULES && root.GAME_MODULES.Particles) ||
    root.Particles ||
    { scorePop(){}, burstAt(){}, celebrate(){} };

  const FeverUI =
    (root.GAME_MODULES && root.GAME_MODULES.FeverUI) ||
    root.FeverUI ||
    { set(){}, get(){ return { value:0, state:'low', shield:0 }; }, setShield(){} };

  // -------------------- logger (best effort) --------------------
  function logEvent(type, data){
    emit('hha:log_event', { type, data: data || {} });
    try{ if (typeof root.hhaLogEvent === 'function') root.hhaLogEvent(type, data||{}); }catch(_){}
  }
  async function flushLogger(reason){
    emit('hha:flush', { reason: String(reason||'flush') });

    const fns = [];
    try{ if (root.HHA_CLOUD_LOGGER && typeof root.HHA_CLOUD_LOGGER.flush === 'function') fns.push(root.HHA_CLOUD_LOGGER.flush.bind(root.HHA_CLOUD_LOGGER)); }catch(_){}
    try{ if (root.HHACloudLogger && typeof root.HHACloudLogger.flush === 'function') fns.push(root.HHACloudLogger.flush.bind(root.HHACloudLogger)); }catch(_){}
    try{ if (root.GAME_MODULES && root.GAME_MODULES.CloudLogger && typeof root.GAME_MODULES.CloudLogger.flush === 'function') fns.push(root.GAME_MODULES.CloudLogger.flush.bind(root.GAME_MODULES.CloudLogger)); }catch(_){}
    try{ if (typeof root.hhaFlush === 'function') fns.push(root.hhaFlush.bind(root)); }catch(_){}

    const tasks = fns.map(fn=>{
      try{
        const r = fn({ reason:String(reason||'flush') });
        return (r && typeof r.then === 'function') ? r : Promise.resolve();
      }catch(_){ return Promise.resolve(); }
    });

    await Promise.race([
      Promise.all(tasks),
      new Promise(res=>setTimeout(res, 260))
    ]);
  }

  // -------------------- ensure minimal CSS for targets --------------------
  function ensureTargetStyles(){
    if (DOC.getElementById('plate-safe-style')) return;

    const st = DOC.createElement('style');
    st.id = 'plate-safe-style';
    st.textContent = `
      #plate-layer, .plate-layer { position: fixed; inset:0; touch-action:none; }
      .pl-target{
        position:absolute;
        left: var(--x, 50px);
        top:  var(--y, 50px);
        width: calc(78px * var(--s, 1));
        height: calc(78px * var(--s, 1));
        border-radius: 22px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: calc(44px * var(--s, 1));
        line-height:1;
        user-select:none;
        -webkit-user-select:none;
        cursor:pointer;
        transform: translate(-50%, -50%) scale(1);
        transition: transform .12s ease, opacity .12s ease, filter .12s ease;
        background: rgba(2,6,23,.35);
        border: 1px solid rgba(148,163,184,.18);
        box-shadow: inset 0 0 0 1px rgba(148,163,184,.08), 0 18px 60px rgba(0,0,0,.35);
        backdrop-filter: blur(8px);
        will-change: transform, opacity;
      }
      .pl-target.pl-food{ border-color: rgba(34,197,94,.28); }
      .pl-target.pl-junk{ border-color: rgba(239,68,68,.30); filter: saturate(1.25); }
      .pl-target.pl-decoy{ border-color: rgba(245,158,11,.30); opacity:.92; }
      .pl-target.pl-powerup{ border-color: rgba(34,211,238,.32); }
      .pl-target.pl-guide{ box-shadow: 0 0 0 10px rgba(34,197,94,.10), 0 18px 60px rgba(0,0,0,.35); }
      .pl-target.hit{ transform: translate(-50%,-50%) scale(1.18); opacity:0; }
      .pl-target.out{ transform: translate(-50%,-50%) scale(0.88); opacity:0; }
    `;
    DOC.head.appendChild(st);
  }
  ensureTargetStyles();

  // -------------------- Difficulty params --------------------
  function diffParams(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy')   return { spawnMs:900, ttl:1900, size:1.05, junk:0.10, hint:0.020, shield:0.016, adapt:true };
    if (diff === 'hard')   return { spawnMs:650, ttl:1450, size:0.92, junk:0.16, hint:0.012, shield:0.010, adapt:true };
    return                  { spawnMs:760, ttl:1650, size:1.00, junk:0.12, hint:0.015, shield:0.012, adapt:true };
  }

  // -------------------- Concept core: groups + target dist --------------------
  const GROUPS = {
    veg:     { key:'veg',     label:'ผัก',    emoji:['🥦','🥬','🥕','🌽','🥒','🍆'] },
    fruit:   { key:'fruit',   label:'ผลไม้',  emoji:['🍎','🍌','🍊','🍉','🍓','🍍'] },
    protein: { key:'protein', label:'โปรตีน', emoji:['🥚','🍗','🐟','🥛','🫘','🥜'] },
    carb:    { key:'carb',    label:'แป้ง',   emoji:['🍚','🍞','🥔','🍠','🍜','🥖'] }
  };
  const GROUP_KEYS = Object.keys(GROUPS);
  const TARGET_DIST = { veg:0.40, fruit:0.20, protein:0.20, carb:0.20 };

  const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭'];
  const DECOY= ['🎭','🌀','✨','🌈','🎈'];

  // -------------------- Goals (Concept 1) --------------------
  // ✅ Goal3 minBalance = 88
  const GOALS = [
    { title:'จัดจานให้ “พอสมดุล”',  needFood:8,  minBalance:70, maxJunk:1 },
    { title:'จัดจานให้ “สมดุลขึ้น”', needFood:12, minBalance:78, maxJunk:1 },
    { title:'จัดจานให้ “สมดุลสุด ๆ”', needFood:16, minBalance:88, maxJunk:0 }
  ];

  // -------------------- Minis (Concept 2) --------------------
  const MINI_DEFS = [
    { key:'rush',     title:'Plate Rush',      desc:'เก็บอาหาร 5 ชิ้นใน 8 วิ (ห้ามโดนขยะ)', need:5,  sec:8,  mode:'anyfood' },
    { key:'fix',      title:'Fix Imbalance',   desc:'เติม “หมวดที่ขาด” 3 ชิ้นใน 10 วิ (ห้ามโดนขยะ)', need:3, sec:10, mode:'missing' },
    { key:'rainbow',  title:'Rainbow Plate',   desc:'เก็บครบ 4 หมวดใน 12 วิ (ห้ามโดนขยะ)', need:4, sec:12, mode:'eachgroup' },
    { key:'clean3',   title:'Clean Window',    desc:'ใน 6 วิ เก็บอาหาร 3 ชิ้นแบบไม่พลาด', need:3,  sec:6,  mode:'anyfood' }
  ];

  // ✅ mini fairness bag (เฉลี่ยเท่า ๆ กันจริง)
  const miniBag = { bag: [], idx: 0 };
  function nextMiniDef(rng){
    if (miniBag.bag.length !== MINI_DEFS.length || miniBag.idx >= miniBag.bag.length){
      miniBag.bag = shuffle(rng, MINI_DEFS.slice());
      miniBag.idx = 0;
    }
    return miniBag.bag[miniBag.idx++];
  }

  // -------------------- Rank --------------------
  function rankFromAcc(acc){
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  // -------------------- Engine state --------------------
  const S = {
    running:false,
    ended:false,
    flushedEnd:false,

    runMode:'play',
    diff:'normal',
    timeSec:90,
    seed:'seed',
    rng:Math.random,

    // view translate (VR feel)
    vx:0, vy:0,
    dragOn:false, dragX:0, dragY:0,

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

    // balance
    counts:{ veg:0, fruit:0, protein:0, carb:0 },
    totalFood:0,
    balancePct:0,
    lastBalanceBucket:-1,
    lastCoachAt:0,

    // shield
    shield:0,

    // spawn
    spawnTimer:0,
    tickTimer:0,
    ttlMs:1650,
    sizeBase:1.0,
    junkBias:0.12,

    // adaptive (play only)
    adapt:{ spawnMs:760, ttl:1650, size:1.0 },

    // quests
    goalIndex:0,
    goalsCleared:0,
    goalsTotal:GOALS.length,
    // stage junk counter (per goal) to enforce maxJunk accurately
    goalJunkUnblocked:0,

    miniActive:null,
    miniCleared:0,
    miniTotal:0,

    // hub
    hub: '../hub.html'
  };

  // -------------------- Balance funcs (Concept 1+4) --------------------
  function computeDist(){
    const t = Math.max(1, S.totalFood);
    return {
      veg: S.counts.veg / t,
      fruit: S.counts.fruit / t,
      protein: S.counts.protein / t,
      carb: S.counts.carb / t
    };
  }
  function computeBalancePct(){
    const d = computeDist();
    let l1 = 0;
    for (const k of GROUP_KEYS){
      l1 += Math.abs((d[k]||0) - (TARGET_DIST[k]||0));
    }
    // map distance -> 0..100 (tuned)
    return clamp(100 * (1 - (l1 / 1.2)), 0, 100);
  }
  function missingGroupKey(){
    const d = computeDist();
    let worstK = 'veg';
    let worstGap = -1;
    for (const k of GROUP_KEYS){
      const gap = (TARGET_DIST[k]||0) - (d[k]||0);
      if (gap > worstGap){ worstGap = gap; worstK = k; }
    }
    return worstK;
  }
  function emitBalance(){
    S.balancePct = computeBalancePct();
    const d = computeDist();
    const missK = missingGroupKey();

    emit('plate:balance', {
      balancePct: Math.round(S.balancePct),
      missingKey: missK,
      dist: d,
      counts: { ...S.counts, totalFood: S.totalFood },
      targetDist: { ...TARGET_DIST }
    });

    const bucket = Math.floor(S.balancePct / 10);
    const t = now();
    if (bucket !== S.lastBalanceBucket || (t - S.lastCoachAt) > 3200){
      S.lastBalanceBucket = bucket;
      S.lastCoachAt = t;

      const need = GROUPS[missK]?.label || 'หมวดที่ขาด';
      const mood = (S.balancePct >= 88) ? 'happy' : (S.balancePct >= 70 ? 'neutral' : 'sad');
      const msg =
        (S.balancePct >= 88) ? `สุดยอด! สมดุลถึงเกณฑ์สูงแล้ว 🔥 คุม “ห้ามโดนขยะ” ให้ได้!` :
        (S.balancePct >= 70) ? `ดีมาก! ตอนนี้ “ขาด${need}” นิดหน่อย` :
        `จานยังเอียงอยู่ 😅 เติม “${need}” ก่อนเลย`;

      emit('hha:coach', { mood, text: msg });
    }
  }

  // -------------------- HUD events --------------------
  function updateScore(){
    emit('hha:score', { score:S.score|0, combo:S.combo|0, comboMax:S.comboMax|0, misses:S.misses|0, shield:S.shield|0 });

    const acc = S.hitAll > 0 ? Math.round((S.hitFood/S.hitAll)*100) : 0;
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
  }
  function updateTime(){
    emit('hha:time', { left: S.left|0 });
  }

  // ✅ emit quest:update fields EXACTLY for your plate-vr.html handler
  function emitQuestUpdate(){
    const g = GOALS[S.goalIndex] || GOALS[GOALS.length-1];
    const foodNow = S.totalFood|0;
    const foodNeed = g ? (g.needFood|0) : 0;

    // goalNow/goalTotal => let HTML render progress bar
    // We'll use 0..100 scale for goal, because your UI is generic.
    // progress = min(foodPct, balancePctRatio, junkOkRatio)
    const foodPct = foodNeed > 0 ? clamp(foodNow/foodNeed, 0, 1) : 0;
    const balPct  = g ? clamp(S.balancePct/(g.minBalance||100), 0, 1) : 0;
    const junkOk  = g ? clamp(1 - (Math.max(0, S.goalJunkUnblocked - (g.maxJunk||0)) * 0.5), 0, 1) : 1;
    const pct = clamp(Math.min(foodPct, balPct, junkOk), 0, 1);

    const goalTitle = g
      ? `${g.title} · food ${foodNow}/${g.needFood} · bal ≥${g.minBalance}% · junk ≤${g.maxJunk}`
      : '—';

    let miniTitle='—', miniNow=0, miniTot=0, miniLeftMs=0;
    if (S.miniActive){
      const m = S.miniActive;
      miniTitle = `${m.title} — ${m.desc}`;
      miniNow = m.cur|0;
      miniTot = m.max|0;
      miniLeftMs = Math.max(0, (m.until - now())|0);
    }

    emit('quest:update', {
      goalTitle,
      goalNow: Math.round(pct*100),
      goalTotal: 100,

      miniTitle,
      miniNow,
      miniTotal: miniTot,
      miniLeftMs
    });
  }

  // -------------------- VR feel view translate --------------------
  function applyView(){
    // translate layer so all targets "ไหลตาม" เหมือน VR
    layer.style.transform = `translate(${S.vx.toFixed(1)}px, ${S.vy.toFixed(1)}px)`;
  }

  function setupViewControls(){
    layer.addEventListener('pointerdown', (e)=>{
      S.dragOn = true; S.dragX = e.clientX; S.dragY = e.clientY;
    }, { passive:true });

    root.addEventListener('pointermove', (e)=>{
      if (!S.dragOn) return;
      const dx = e.clientX - S.dragX;
      const dy = e.clientY - S.dragY;
      S.dragX = e.clientX; S.dragY = e.clientY;
      S.vx = clamp(S.vx + dx*0.22, -90, 90);
      S.vy = clamp(S.vy + dy*0.22, -90, 90);
      applyView();
    }, { passive:true });

    root.addEventListener('pointerup', ()=>{ S.dragOn = false; }, { passive:true });

    root.addEventListener('deviceorientation', (ev)=>{
      // subtle drift
      const gx = Number(ev.gamma)||0;
      const gy = Number(ev.beta)||0;
      S.vx = clamp(S.vx + gx*0.06, -90, 90);
      S.vy = clamp(S.vy + (gy-20)*0.02, -90, 90);
      applyView();
    }, { passive:true });
  }

  function recenter(){
    S.vx = 0; S.vy = 0;
    applyView();
  }

  // -------------------- spawn safe rect (avoid HUD) --------------------
  const hudTop = DOC.querySelector('.hud-top');
  function safeSpawnRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;

    let top = 140, bottom = 180, left = 18, right = 18;

    try{
      if (hudTop){
        const r = hudTop.getBoundingClientRect();
        if (r && r.bottom > 0) top = Math.max(top, Math.round(r.bottom + 12));
      }
    }catch(_){}

    // relax if too small
    if ((W - left - right) < 160){ left = 10; right = 10; }
    if ((H - top - bottom) < 240){ top = Math.max(110, top-24); bottom = Math.max(150, bottom-24); }

    return { W, H, x0:left, x1:W-right, y0:top, y1:H-bottom };
  }

  function randPos(){
    const r = safeSpawnRect();
    const x = r.x0 + S.rng()*(r.x1 - r.x0);
    const y = r.y0 + S.rng()*(r.y1 - r.y0);
    return { x, y };
  }

  function setXY(el, x, y){
    el.style.setProperty('--x', x.toFixed(1)+'px');
    el.style.setProperty('--y', y.toFixed(1)+'px');
  }

  // -------------------- Powerups --------------------
  const power = { guideUntil:0 };

  function guideActive(){ return now() < power.guideUntil; }
  function guideOn(){
    power.guideUntil = now() + 6000;
    emit('hha:coach', { mood:'neutral', text:`💡 Hint: ตอนนี้ควรเติม “${GROUPS[missingGroupKey()].label}”` });
    emit('hha:celebrate', { kind:'mini', title:'HINT 💡' });
  }
  function giveShield(){
    S.shield = clamp(S.shield + 1, 0, 2);
    try{ if (FeverUI && typeof FeverUI.setShield === 'function') FeverUI.setShield(S.shield); }catch(_){}
    emit('hha:judge', { kind:'good', text:'SHIELD +1' });
    emit('hha:celebrate', { kind:'mini', title:'SHIELD 🛡️' });
  }

  // -------------------- target create/remove --------------------
  function makeTarget(type, emoji, x, y, s, meta){
    const el = DOC.createElement('div');
    el.className = 'pl-target';
    el.dataset.type = type;
    el.dataset.emoji = emoji || '✨';
    if (meta && meta.group) el.dataset.group = meta.group;

    if (type === 'food') el.classList.add('pl-food');
    if (type === 'junk') el.classList.add('pl-junk');
    if (type === 'decoy') el.classList.add('pl-decoy');
    if (type === 'hint' || type === 'shield') el.classList.add('pl-powerup');
    if (meta && meta.guide) el.classList.add('pl-guide');

    setXY(el, x, y);
    el.style.setProperty('--s', Number(s||1).toFixed(3));
    el.textContent = String(emoji||'✨');

    // TTL
    el._ttlTimer = root.setTimeout(()=>{
      if (!el.isConnected) return;
      if (type === 'food'){
        S.misses++; S.combo = 0;
        S.expireFood++;
        emit('hha:judge', { kind:'warn', text:'MISS (หมดเวลา)!' });
        updateScore();
        emitQuestUpdate();
        logEvent('miss_expire', { kind:'food', emoji, group:(meta&&meta.group)||'' });
      }
      el.classList.add('out');
      root.setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 180);
    }, S.ttlMs);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el);
    }, { passive:false });

    logEvent('spawn', { kind:type, emoji, group:(meta&&meta.group)||'' });
    return el;
  }

  function removeTarget(el){
    try{ root.clearTimeout(el._ttlTimer); }catch(_){}
    el.classList.add('hit');
    root.setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 160);
  }

  function burstAtEl(el){
    try{
      const r = el.getBoundingClientRect();
      Particles.burstAt(r.left + r.width/2, r.top + r.height/2, String(el.dataset.type||''));
    }catch(_){}
  }

  // -------------------- spawn choice (Concept 1–4) --------------------
  function chooseType(dp){
    const r = S.rng();
    if (r < dp.hint) return 'hint';
    if (r < dp.hint + dp.shield) return 'shield';

    const decoyP = (S.runMode==='play') ? 0.06 : 0.05;
    const junkP = clamp(S.junkBias, 0.08, 0.24);

    const r2 = S.rng();
    if (r2 < junkP) return 'junk';
    if (r2 < junkP + decoyP) return 'decoy';
    return 'food';
  }

  function chooseFoodGroup(){
    const miss = missingGroupKey();
    if (guideActive() && S.rng() < 0.60) return miss;
    if (S.rng() < 0.30) return miss;
    return GROUP_KEYS[(S.rng()*GROUP_KEYS.length)|0];
  }

  function spawnOne(){
    if (!S.running || S.ended) return;
    const dp = diffParams(S.diff);
    const tp = chooseType(dp);
    const p = randPos();
    const size = S.sizeBase * S.adapt.size * (tp==='junk'?0.95:1.0);

    if (tp === 'food'){
      const gk = chooseFoodGroup();
      const em = pick(S.rng, GROUPS[gk].emoji);
      const isGuide = guideActive() && (gk === missingGroupKey());
      layer.appendChild(makeTarget('food', em, p.x, p.y, size, { group:gk, guide:isGuide }));
      return;
    }
    if (tp === 'junk'){
      layer.appendChild(makeTarget('junk', pick(S.rng, JUNK), p.x, p.y, size));
      return;
    }
    if (tp === 'decoy'){
      layer.appendChild(makeTarget('decoy', pick(S.rng, DECOY), p.x, p.y, size*0.98));
      return;
    }
    if (tp === 'hint'){
      layer.appendChild(makeTarget('hint', '💡', p.x, p.y, size*1.02));
      return;
    }
    if (tp === 'shield'){
      layer.appendChild(makeTarget('shield', '🛡️', p.x, p.y, size*1.02));
      return;
    }
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;
    spawnOne();

    const dp = diffParams(S.diff);
    const sMs = (S.runMode==='research')
      ? dp.spawnMs
      : clamp(S.adapt.spawnMs, 460, 980);

    S.spawnTimer = root.setTimeout(loopSpawn, sMs);
  }

  // -------------------- Mini quest engine (Concept 2) --------------------
  function startNextMini(){
    const def = nextMiniDef(S.rng);
    const t = now();
    S.miniTotal++;

    S.miniActive = {
      key:def.key,
      title:def.title,
      desc:def.desc,
      mode:def.mode,
      max:def.need|0,
      cur:0,
      until: t + (def.sec*1000),
      seen:{ veg:false, fruit:false, protein:false, carb:false },
      targetKey: (def.mode==='missing') ? missingGroupKey() : null,
      state:'running'
    };

    emit('hha:coach', { mood:'neutral', text:`MINI: ${def.title} — ${def.desc}` });
    emit('hha:celebrate', { kind:'mini', title:`MINI START: ${def.title}` });
    emitQuestUpdate();
  }

  function failMini(reason){
    if (!S.miniActive) return;
    emit('hha:judge', { kind:'bad', text:`MINI FAIL! ${reason||''}` });
    emit('hha:coach', { mood:'sad', text:'ไม่เป็นไร! มินิต่อไปมาใหม่ 💪' });
    S.miniActive = null;
    emitQuestUpdate();
    root.setTimeout(()=>{ if (S.running && !S.ended) startNextMini(); }, 900);
  }

  function passMini(){
    if (!S.miniActive) return;
    const title = S.miniActive.title;
    S.miniCleared++;
    emit('hha:judge', { kind:'good', text:'MINI CLEAR!' });
    emit('hha:celebrate', { kind:'mini', title:`MINI CLEAR: ${title}` });

    // bonus supports concept: scales with balance
    const bonus = Math.round(250 + S.balancePct*4);
    S.score += bonus;

    S.miniActive = null;
    updateScore();
    emitQuestUpdate();

    root.setTimeout(()=>{ if (S.running && !S.ended) startNextMini(); }, 800);
  }

  function miniTick(){
    const m = S.miniActive;
    if (!m) return;
    if (now() >= m.until){
      failMini('หมดเวลา');
      return;
    }
    emitQuestUpdate();
  }

  function miniOnFoodHit(groupKey){
    const m = S.miniActive;
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

    if (m.cur >= m.max) passMini();
    else emitQuestUpdate();
  }

  function miniOnBadHit(unblocked){
    const m = S.miniActive;
    if (!m || m.state !== 'running') return;
    if (unblocked) failMini('โดนขยะ/หลอกระหว่างทำมินิ');
  }

  // -------------------- Goal progression (Concept 1) --------------------
  function currentGoal(){ return GOALS[S.goalIndex] || GOALS[GOALS.length-1]; }

  function checkGoalComplete(){
    const g = currentGoal();
    if (!g) return;

    const okFood = S.totalFood >= g.needFood;
    const okBal  = S.balancePct >= g.minBalance;
    const okJunk = S.goalJunkUnblocked <= g.maxJunk;

    if (okFood && okBal && okJunk){
      S.goalsCleared++;
      emit('hha:celebrate', { kind:'goal', title:`GOAL CLEAR: ${g.title}` });
      emit('hha:judge', { kind:'good', text:'GOAL CLEAR!' });

      const bonus = Math.round(400 + S.balancePct*6);
      S.score += bonus;

      // advance goal and reset stage junk counter
      S.goalIndex = Math.min(GOALS.length-1, S.goalIndex + 1);
      S.goalJunkUnblocked = 0;

      if (!S.miniActive) startNextMini();

      updateScore();
      emitQuestUpdate();
    }
  }

  // -------------------- scoring core --------------------
  function balanceMult(){
    return 1 + (clamp(S.balancePct, 0, 100) / 100) * 0.6; // 1.0..1.6
  }

  function onFoodAdded(groupKey){
    S.counts[groupKey] = (S.counts[groupKey]||0) + 1;
    S.totalFood++;
    emitBalance();
  }

  function hitFood(el){
    S.hitAll++; S.hitFood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    const gk = String(el.dataset.group||'').toLowerCase();
    const safeGk = GROUPS[gk] ? gk : chooseFoodGroup();
    onFoodAdded(safeGk);

    const miss = missingGroupKey();
    const skillBonus = (safeGk === miss) ? 18 : 0;
    const pts = Math.round((90 + S.combo*2 + skillBonus) * balanceMult());
    S.score += pts;

    emit('hha:judge', { kind:'good', text:`+${pts} (${GROUPS[safeGk].label})` });
    burstAtEl(el);

    logEvent('hit', { kind:'food', emoji:String(el.dataset.emoji||''), group:safeGk, totalScore:S.score|0, combo:S.combo|0, balance:Math.round(S.balancePct) });

    updateScore();
    emitQuestUpdate();
    miniOnFoodHit(safeGk);
    checkGoalComplete();

    removeTarget(el);
  }

  function hitHint(el){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    guideOn();
    const pts = Math.round(80 * balanceMult());
    S.score += pts;

    emit('hha:judge', { kind:'good', text:`HINT! +${pts}` });
    burstAtEl(el);

    logEvent('hit', { kind:'hint', emoji:'💡', totalScore:S.score|0 });

    updateScore();
    emitQuestUpdate();
    removeTarget(el);
  }

  function hitShield(el){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    giveShield();
    const pts = Math.round(70 * balanceMult());
    S.score += pts;

    emit('hha:judge', { kind:'good', text:`SHIELD! +${pts}` });
    burstAtEl(el);

    logEvent('hit', { kind:'shield', emoji:'🛡️', totalScore:S.score|0, shield:S.shield|0 });

    updateScore();
    emitQuestUpdate();
    removeTarget(el);
  }

  function hitJunk(el){
    S.hitAll++;

    // shield blocks junk => NOT a miss
    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;

      emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
      logEvent('shield_block', { kind:'junk', emoji:String(el.dataset.emoji||'') });

      updateScore();
      emitQuestUpdate();
      miniOnBadHit(false);

      removeTarget(el);
      return;
    }

    // unblocked junk => miss + stage junk count affects goal
    S.hitJunk++;
    S.goalJunkUnblocked++;
    S.misses++;
    S.combo = 0;

    const penalty = 180;
    S.score = Math.max(0, S.score - penalty);

    emit('hha:judge', { kind:'bad', text:`JUNK! -${penalty}` });
    emit('hha:coach', { mood:'sad', text:'โดนขยะแล้ว 😵 คุมให้ดีขึ้นนะ!' });

    logEvent('hit', { kind:'junk', emoji:String(el.dataset.emoji||''), judgment:'bad', totalScore:S.score|0 });

    updateScore();
    emitQuestUpdate();
    miniOnBadHit(true);
    // (goal completion will re-check on tick / next hit)
    removeTarget(el);
  }

  function hitDecoy(el){
    S.hitAll++;
    S.misses++;
    S.combo = Math.max(0, S.combo - 1);

    const penalty = 70;
    S.score = Math.max(0, S.score - penalty);

    emit('hha:judge', { kind:'warn', text:`DECOY! -${penalty}` });
    logEvent('hit', { kind:'decoy', emoji:String(el.dataset.emoji||''), judgment:'warn', totalScore:S.score|0 });

    updateScore();
    emitQuestUpdate();
    miniOnBadHit(true);

    removeTarget(el);
  }

  function hitTarget(el){
    if (!S.running || S.ended || !el || !el.isConnected) return;
    const tp = String(el.dataset.type||'').toLowerCase();
    if (tp === 'food') return hitFood(el);
    if (tp === 'junk') return hitJunk(el);
    if (tp === 'decoy') return hitDecoy(el);
    if (tp === 'hint') return hitHint(el);
    if (tp === 'shield') return hitShield(el);
  }

  // -------------------- tick + adaptive --------------------
  function loopTick(){
    if (!S.running || S.ended) return;

    // adaptive only in play (subtle)
    if (S.runMode === 'play'){
      const acc = S.hitAll > 0 ? (S.hitFood/S.hitAll) : 0;
      const heat = clamp((S.combo/20) + (acc-0.70), 0, 1);

      S.adapt.spawnMs = clamp(820 - heat*260, 480, 900);
      S.adapt.ttl     = clamp(1720 - heat*260, 1280, 1850);
      S.adapt.size    = clamp(1.02 - heat*0.10, 0.86, 1.06);
      S.junkBias      = clamp(0.11 + heat*0.06, 0.08, 0.22);

      S.ttlMs = S.adapt.ttl;
    } else {
      const dp = diffParams(S.diff);
      S.junkBias = dp.junk;
      S.ttlMs = dp.ttl;
      S.adapt.spawnMs = dp.spawnMs;
      S.adapt.size = dp.size;
    }

    // time
    S.left = Math.max(0, S.left - 0.14);
    updateTime();

    // mini tick
    miniTick();

    // goal check tick
    checkGoalComplete();

    if (S.left <= 0){
      endGame('time');
      return;
    }

    S.tickTimer = root.setTimeout(loopTick, 140);
  }

  function clearAllTargets(){
    const list = layer.querySelectorAll('.pl-target');
    list.forEach(el=>{
      try{ root.clearTimeout(el._ttlTimer); }catch(_){}
      try{ el.remove(); }catch(_){}
    });
  }

  // -------------------- end overlay (safe.js controls it) --------------------
  function ensureEndOverlay(){
    const ov = DOC.getElementById('endOverlay');
    if (!ov) return null;

    // bind once
    if (!ov._plateBound){
      ov._plateBound = true;

      const btnRetry = DOC.getElementById('btnRetry');
      if (btnRetry){
        btnRetry.addEventListener('click', async ()=>{
          await flushAll('retry', makeSummary('retry'));
          root.location.reload();
        });
      }

      const btnBack = DOC.getElementById('btnBackHub');
      if (btnBack){
        btnBack.addEventListener('click', async ()=>{
          await goHub();
        });
      }
    }
    return ov;
  }

  function showEndOverlay(summary){
    const ov = ensureEndOverlay();
    if (!ov) return;

    const set = (id, val) => {
      const el = DOC.getElementById(id);
      if (el) el.textContent = String(val);
    };

    set('endScore', summary.scoreFinal ?? 0);
    set('endRank', summary.grade ?? 'C');
    set('endAcc',  (summary.accuracyGoodPct ?? 0) + '%');
    set('endComboMax', summary.comboMax ?? 0);
    set('endMiss', summary.misses ?? 0);
    set('endGoals', `${summary.goalsCleared ?? 0}/${summary.goalsTotal ?? 0}`);
    set('endMinis', `${summary.miniCleared ?? 0}/${summary.miniTotal ?? 0}`);

    ov.style.display = 'flex';
    ov.setAttribute('aria-hidden', 'false');
  }

  // -------------------- flush-hardened (Concept 5) --------------------
  function makeSummary(reason){
    const acc = S.hitAll > 0 ? Math.round((S.hitFood/S.hitAll)*100) : 0;
    const grade = rankFromAcc(acc);

    return {
      reason: String(reason||'end'),
      scoreFinal: S.score|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,

      goalsCleared: S.goalsCleared|0,
      goalsTotal: S.goalsTotal|0,
      miniCleared: S.miniCleared|0,
      miniTotal: S.miniTotal|0,

      nHitFood: S.hitFood|0,
      nHitAll: S.hitAll|0,
      nHitJunk: S.hitJunk|0,
      nHitJunkGuard: S.hitJunkGuard|0,
      nExpireFood: S.expireFood|0,

      balancePct: Math.round(S.balancePct)|0,
      counts: { ...S.counts, totalFood: S.totalFood|0 },
      targetDist: { ...TARGET_DIST },

      accuracyGoodPct: acc|0,
      grade,

      diff: S.diff,
      runMode: S.runMode,
      seed: S.seed,
      durationPlayedSec: Math.round((now() - S.tStart)/1000)
    };
  }

  async function flushAll(reason, summary){
    try{
      if (summary){
        localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
        localStorage.setItem('hha_last_summary', JSON.stringify(summary));
      }
    }catch(_){}

    await flushLogger(reason);
  }

  async function endGame(reason){
    if (S.ended) return;
    S.ended = true;
    S.running = false;

    try{ root.clearTimeout(S.spawnTimer); }catch(_){}
    try{ root.clearTimeout(S.tickTimer); }catch(_){}
    clearAllTargets();

    const summary = makeSummary(reason);

    if (!S.flushedEnd){
      S.flushedEnd = true;
      await flushAll('end', summary);
    }

    emit('hha:end', summary);
    showEndOverlay(summary);
  }

  async function goHub(){
    const summary = makeSummary('back_hub');
    await flushAll('back_hub', summary);

    let hub = S.hub || qs('hub','../hub.html') || '../hub.html';
    try{
      const u = new URL(String(hub), root.location.href);
      u.searchParams.set('ts', String(Date.now()));
      root.location.href = u.toString();
    }catch(_){
      root.location.href = String(hub);
    }
  }

  function bindPageHideFlush(){
    root.addEventListener('pagehide', ()=>{
      try{ flushAll('pagehide', makeSummary('pagehide')); }catch(_){}
    }, { passive:true });

    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden'){
        try{ flushAll('hidden', makeSummary('hidden')); }catch(_){}
      }
    }, { passive:true });
  }

  // -------------------- choose type & start game --------------------
  function start(runMode, cfg){
    cfg = cfg || {};
    const mode = (String(runMode||cfg.runMode||qs('run','play')).toLowerCase() === 'research') ? 'research' : 'play';
    const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
    const time = clamp(cfg.time ?? intQ('time', 90), 30, 600);

    const sid  = String(qs('sessionId', qs('studentKey','')) || '');
    const ts   = String(qs('ts', Date.now()));
    const seed = String(cfg.seed || qs('seed', sid ? (sid + '|' + ts) : ts));
    const hub  = String(qs('hub', cfg.hub || '../hub.html') || '../hub.html');

    S.runMode = mode;
    S.diff = diff;
    S.timeSec = time;
    S.seed = seed;
    S.rng = makeRng(seed);
    S.hub = hub;

    const dp = diffParams(diff);

    // reset
    S.running = true;
    S.ended = false;
    S.flushedEnd = false;

    S.left = time;
    S.tStart = now();

    S.score = 0; S.combo = 0; S.comboMax = 0; S.misses = 0;
    S.hitAll = 0; S.hitFood = 0; S.hitJunk = 0; S.hitJunkGuard = 0; S.expireFood = 0;

    S.counts = { veg:0, fruit:0, protein:0, carb:0 };
    S.totalFood = 0;
    S.balancePct = 0;
    S.goalIndex = 0;
    S.goalsCleared = 0;
    S.goalsTotal = GOALS.length;
    S.goalJunkUnblocked = 0;

    S.miniActive = null;
    S.miniCleared = 0;
    S.miniTotal = 0;

    S.shield = 0;
    power.guideUntil = 0;

    S.sizeBase = dp.size;
    S.ttlMs = dp.ttl;
    S.adapt.spawnMs = dp.spawnMs;
    S.adapt.ttl = dp.ttl;
    S.adapt.size = dp.size;
    S.junkBias = dp.junk;

    // view reset
    recenter();

    // prime UI
    emitBalance();
    updateTime();
    updateScore();
    emitQuestUpdate();

    emit('hha:coach', { mood:'neutral', text:'เริ่มเลย! เป้าหมายคือ “สมดุลตามสัดส่วน” 💚' });

    // minis begin after 1.2s breathing room
    root.setTimeout(()=>{ if (S.running && !S.ended) startNextMini(); }, 1200);

    // loops
    loopSpawn();
    loopTick();
  }

  // -------------------- init once --------------------
  setupViewControls();
  bindPageHideFlush();
  ensureEndOverlay();

  // expose global boot
  root.PlateBoot = root.PlateBoot || {};
  root.PlateBoot.start = start;
  root.PlateBoot.endGame = endGame;
  root.PlateBoot.goHub = goHub;
  root.PlateBoot.recenter = recenter;

})(typeof window !== 'undefined' ? window : globalThis);
