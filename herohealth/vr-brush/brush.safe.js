// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE — Plaque Breaker (PATCH v20260223c)
// ✅ Fix: summary auto-open / stale timers / duplicate instance
// ✅ Tap/Click + cVR hha:shoot
// ✅ Perfect near expiry + Fever
// ✅ Boss plaque + Weakspot
// ✅ AI phase events -> window 'brush:ai' (for brush.boot.js HUD)
// ✅ Summary + back hub + save last summary
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // ---------- INSTANCE GUARD ----------
  if (WIN.__BRUSH_SAFE_ACTIVE__ && WIN.__BRUSH_SAFE_ACTIVE__.dispose) {
    try { WIN.__BRUSH_SAFE_ACTIVE__.dispose('replaced-by-new-instance'); } catch(_) {}
  }

  const __ENGINE_INSTANCE_ID__ = 'brushsafe-' + Date.now() + '-' + Math.floor(Math.random()*1e6);
  let __disposed__ = false;
  let __sessionToken__ = 0;

  function currentToken(){ return __sessionToken__; }
  function newSessionToken(){ __sessionToken__ += 1; return __sessionToken__; }
  function isLiveToken(tok){ return !__disposed__ && tok === __sessionToken__; }
  function guardToken(tok, fn){
    return function(...args){
      if (!isLiveToken(tok)) return;
      return fn.apply(this, args);
    };
  }

  // ---------- helpers ----------
  const $ = (s)=>DOC.querySelector(s);
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function safeNum(x,d=0){ const n=Number(x); return Number.isFinite(n)?n:d; }
  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  function toast(msg){
    const el = $('#toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove('show'), 1200);
  }

  function fatal(msg){
    const el = $('#fatal');
    if(!el){ alert(msg); return; }
    el.textContent = msg;
    el.classList.remove('br-hidden');
  }

  WIN.addEventListener('error', (e)=>{
    fatal('JS ERROR:\n' + (e?.message||e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
  });
  WIN.addEventListener('unhandledrejection', (e)=>{
    fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
  });

  function getQS(){
    try{ return new URL(location.href).searchParams; }
    catch(_){ return new URLSearchParams(); }
  }
  function ymdLocal(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function getViewAuto(){
    const qs = getQS();
    const v = (qs.get('view')||'').toLowerCase();
    if(v) return v;
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'cvr' : 'pc';
  }
  function passHubUrl(ctx){
    const qs = getQS();
    return qs.get('hub') || ctx.hub || '../hub.html';
  }
  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail })); }catch(_){}
  }
  function emitBrushAI(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent('brush:ai', { detail: { type, ...(detail||{}) } })); }catch(_){}
  }

  // ---------- DOM refs ----------
  const wrap = $('#br-wrap');
  const layer = $('#br-layer');

  const menu = $('#br-menu');
  const end = $('#br-end');

  const btnStart = $('#btnStart');
  const btnBack = $('#btnBack');
  const btnBackHub2 = $('#btnBackHub2');
  const btnRetry = $('#btnRetry');
  const btnHow = $('#btnHow');
  const btnPause = $('#btnPause');
  const btnRecenter = $('#btnRecenter');

  const tScore = $('#tScore');
  const tCombo = $('#tCombo');
  const tMiss  = $('#tMiss');
  const tTime  = $('#tTime');

  const tClean = $('#tClean');
  const bClean = $('#bClean');
  const tFever = $('#tFever');
  const bFever = $('#bFever');

  const ctxView = $('#br-ctx-view');
  const ctxSeed = $('#br-ctx-seed');
  const ctxTime = $('#br-ctx-time');
  const diffTag = $('#br-diffTag');

  const mDiff = $('#mDiff');
  const mTime = $('#mTime');

  const sScore = $('#sScore');
  const sAcc   = $('#sAcc');
  const sMiss  = $('#sMiss');
  const sCombo = $('#sCombo');
  const sClean = $('#sClean');
  const sTime  = $('#sTime');
  const endGrade = $('#endGrade');
  const endNote = $('#endNote');

  // Optional FX layer (if HTML/CSS has #br-fx)
  const fxRoot = $('#br-fx');

  // ---------- context ----------
  const qs = getQS();
  const ctx = {
    hub: qs.get('hub') || '../hub.html',
    run: qs.get('run') || qs.get('mode') || 'play',
    view: getViewAuto(),
    diff: (qs.get('diff') || 'normal').toLowerCase(),
    time: safeNum(qs.get('time'), 60),
    seed: safeNum(qs.get('seed'), Date.now()),
    pid: (qs.get('pid') || qs.get('participantId') || '').trim(),
    studyId: (qs.get('studyId') || '').trim(),
    phase: (qs.get('phase') || '').trim(),
    conditionGroup: (qs.get('conditionGroup') || '').trim(),
    log: (qs.get('log') || '').trim(),
    ai: safeNum(qs.get('ai'), 0),
    debug: safeNum(qs.get('debug'), 0)
  };
  ctx.time = clamp(ctx.time, 30, 120);

  // ---------- UI ctx ----------
  if (wrap) wrap.dataset.view = ctx.view;
  if (ctxView) ctxView.textContent = ctx.view;
  if (ctxSeed) ctxSeed.textContent = String((ctx.seed >>> 0));
  if (ctxTime) ctxTime.textContent = `${ctx.time}s`;
  if (diffTag) diffTag.textContent = ctx.diff;
  if (mDiff) mDiff.textContent = ctx.diff;
  if (mTime) mTime.textContent = `${ctx.time}s`;

  function setBackLinks(){
    const hubUrl = passHubUrl(ctx);
    for (const a of [btnBack, btnBackHub2]){
      if (!a) continue;
      try{
        const u = new URL(hubUrl, location.href);
        if(ctx.pid) u.searchParams.set('pid', ctx.pid);
        if(ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
        if(ctx.phase) u.searchParams.set('phase', ctx.phase);
        if(ctx.conditionGroup) u.searchParams.set('conditionGroup', ctx.conditionGroup);
        a.href = u.toString();
      }catch(_){
        a.href = hubUrl;
      }
    }
  }
  setBackLinks();

  // ---------- RNG ----------
  const rng = seededRng(ctx.seed);

  // ---------- fun boost (optional) ----------
  const fun = WIN.HHA?.createFunBoost?.({
    seed: (qs.get('seed') || ctx.pid || 'brush'),
    baseSpawnMul: 1.0,
    waveCycleMs: 20000,
    feverThreshold: 18,
    feverDurationMs: 6800,
    feverSpawnBoost: 1.18,
    feverTimeScale: 0.92
  });
  let director = fun ? fun.tick() : { spawnMul:1, timeScale:1, wave:'calm', intensity:0, feverOn:false };

  // ---------- state ----------
  const st = {
    running:false,
    paused:false,
    over:false,
    t0:0,
    lastHud:0,
    score:0,
    combo:0,
    comboMax:0,
    miss:0,
    shots:0,
    hits:0,

    clean:0,
    cleanGainPerHit: 1.2,
    cleanLosePerMiss: 0.6,

    baseSpawnMs: 760,
    ttlMs: 1650,
    perfectWindowMs: 220,

    bossEveryPct: 28,
    nextBossAt: 28,
    bossActive:false,

    uid:0,
    targets: new Map(), // id -> target object

    // AI phases
    aiPhase: 'normal',
    lastAiEmitAt: 0,
    time10sFired: false
  };

  (function tune(){
    if(ctx.diff==='easy'){
      st.baseSpawnMs = 900;
      st.ttlMs = 1950;
      st.perfectWindowMs = 260;
      st.cleanGainPerHit = 1.35;
      st.cleanLosePerMiss = 0.45;
    }else if(ctx.diff==='hard'){
      st.baseSpawnMs = 650;
      st.ttlMs = 1450;
      st.perfectWindowMs = 200;
      st.cleanGainPerHit = 1.05;
      st.cleanLosePerMiss = 0.75;
    }
  })();

  // ---------- FX helpers ----------
  function fxFlash(){
    if(!fxRoot) return;
    const el = DOC.createElement('div');
    el.className = 'fx-flash';
    fxRoot.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('on'));
    setTimeout(()=> { try{ el.remove(); }catch(_){} }, 180);
  }
  function fxLaser(){
    if(!fxRoot) return;
    const el = DOC.createElement('div');
    el.className = 'fx-laser';
    fxRoot.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('on'));
    setTimeout(()=> { try{ el.remove(); }catch(_){} }, 1400);
  }
  function fxShock(){
    if(!fxRoot) return;
    const el = DOC.createElement('div');
    el.className = 'fx-shock';
    fxRoot.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('on'));
    setTimeout(()=> { try{ el.remove(); }catch(_){} }, 480);
  }
  function fxFin(){
    if(!fxRoot) return;
    const el = DOC.createElement('div');
    el.className = 'fx-fin';
    fxRoot.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('on'));
    setTimeout(()=> { try{ el.remove(); }catch(_){} }, 350);
  }

  // ---------- AI phase system (lightweight / deterministic hooks) ----------
  function aiEmitRateLimited(type, detail, gapMs=250){
    const t = Date.now();
    if (t - st.lastAiEmitAt < gapMs) return;
    st.lastAiEmitAt = t;
    emitBrushAI(type, detail);
  }

  function updateAiPhase(leftSec){
    // time-based phase cue (works even without advanced mechanics)
    let phase = 'normal';
    if (st.clean >= 85) phase = 'finisher';
    else if (st.bossActive) phase = 'boss';
    else if (director.intensity >= 0.75) phase = 'shock';
    else if (director.intensity >= 0.45) phase = 'laser';

    if (phase !== st.aiPhase){
      st.aiPhase = phase;
      if (phase === 'laser'){
        aiEmitRateLimited('laser_warn', { phase, intensity: director.intensity });
      } else if (phase === 'shock'){
        aiEmitRateLimited('shock_on', { phase, intensity: director.intensity });
        fxShock();
      } else if (phase === 'finisher'){
        aiEmitRateLimited('finisher_on', { phase, clean: Math.round(st.clean) }, 600);
        fxFin();
      }
    }

    if (!st.time10sFired && leftSec <= 10){
      st.time10sFired = true;
      emitBrushAI('time_10s', { left: leftSec });
    }
  }

  // ---------- HUD ----------
  function hud(force){
    const t = now();
    if(!force && t - st.lastHud < 60) return;
    st.lastHud = t;

    if (tScore) tScore.textContent = String(st.score);
    if (tCombo) tCombo.textContent = String(st.combo);
    if (tMiss)  tMiss.textContent  = String(st.miss);

    const elapsed = st.running ? ((t - st.t0)/1000) : 0;
    const left = st.running ? Math.max(0, ctx.time - elapsed) : ctx.time;
    if (tTime) tTime.textContent = left.toFixed(0);

    const clean = clamp(st.clean, 0, 100);
    if (tClean) tClean.textContent = `${Math.round(clean)}%`;
    if (bClean) bClean.style.width = `${clean}%`;

    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    if (tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';
    if (bFever) bFever.style.width = `${pct}%`;
  }

  function layerRect(){ return layer.getBoundingClientRect(); }

  // ---------- target creation ----------
  function makeWeakspot(targetEl){
    let ws = targetEl.querySelector('.br-ws');
    if (ws) return ws;
    ws = DOC.createElement('div');
    ws.className = 'br-ws';
    targetEl.appendChild(ws);
    return ws;
  }

  function randomWeakspotOffsetPx(radiusPx){
    // deterministic-ish via rng
    const a = rng() * Math.PI * 2;
    const r = rng() * radiusPx;
    return { x: Math.cos(a)*r, y: Math.sin(a)*r };
  }

  function placeWeakspot(it){
    if (!it || it.kind !== 'boss' || !it.wsEl) return;
    const off = randomWeakspotOffsetPx(16);
    it.wsOffsetX = off.x;
    it.wsOffsetY = off.y;
    it.wsEl.style.left = `calc(50% + ${off.x.toFixed(1)}px)`;
    it.wsEl.style.top  = `calc(50% + ${off.y.toFixed(1)}px)`;
  }

  function mkTarget({x,y,kind,hpMax}){
    const id = String(++st.uid);

    const el = DOC.createElement('div');
    el.className = 'br-t' + (kind==='boss' ? ' thick' : '');
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    const emo = DOC.createElement('div');
    emo.className = 'emo';
    emo.textContent = (kind==='boss') ? '💎' : '🦠';
    el.appendChild(emo);

    const hp = DOC.createElement('div');
    hp.className = 'hp';
    const fill = DOC.createElement('i');
    hp.appendChild(fill);
    el.appendChild(hp);

    let wsEl = null, wsOffsetX = 0, wsOffsetY = 0;
    if (kind === 'boss') {
      wsEl = makeWeakspot(el);
    }

    const born = now();
    const ttl = st.ttlMs * (director.timeScale || 1);
    const die = born + ttl;

    const it = {
      id, el, kind,
      bornMs: born,
      dieMs: die,
      hpMax, hp: hpMax,
      fillEl: fill,
      x, y,
      wsEl, wsOffsetX, wsOffsetY,
      lastHitAt: 0
    };

    st.targets.set(id, it);
    if (kind === 'boss') placeWeakspot(it);

    // pointer tap for pc/mobile (cvr strict mode will ignore target pointer via CSS)
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onHitAt(ev.clientX, ev.clientY, { source:'tap', targetId:id });
    }, { passive:false });

    layer.appendChild(el);
    updateHpVis(it);
  }

  function spawnOne(){
    if(!st.running || st.paused || st.over) return;
    director = fun ? fun.tick() : director;

    const r = layerRect();
    const pad = 56;
    const x = pad + rng() * Math.max(10, (r.width - pad*2));
    const y = pad + rng() * Math.max(10, (r.height - pad*2));

    if(!st.bossActive && st.clean >= st.nextBossAt && st.clean < 100){
      st.bossActive = true;
      const hp = (ctx.diff==='hard'? 5 : ctx.diff==='easy'? 3 : 4);
      mkTarget({ x, y, kind:'boss', hpMax: hp });
      toast('💎 BOSS PLAQUE!');
      emit('hha:coach', { msg:'เจอบอสคราบหนา! ยิง/แตะหลายครั้งให้แตก!', ts: Date.now() });
      emitBrushAI('boss_start', { hp, clean: Math.round(st.clean) });
      fxFlash();
      return;
    }

    mkTarget({ x, y, kind:'plaque', hpMax: 1 });
  }

  function updateHpVis(it){
    if(!it || !it.fillEl) return;
    const pct = clamp((it.hp / it.hpMax) * 100, 0, 100);
    it.fillEl.style.width = pct + '%';
  }

  function removeTarget(id, popped){
    const it = st.targets.get(id);
    if(!it) return;
    st.targets.delete(id);

    const el = it.el;
    if(!el) return;
    if(popped) el.classList.add('pop');
    el.classList.add('fade');
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
  }

  function clearAllTargetsHard(){
    try{
      for(const [id] of st.targets) removeTarget(id, false);
      st.targets.clear();
    }catch(_){}
  }

  function gradeFromAcc(acc){
    if(acc >= 92) return 'S';
    if(acc >= 82) return 'A';
    if(acc >= 70) return 'B';
    if(acc >= 55) return 'C';
    return 'D';
  }

  function onPerfect(){
    fun?.onAction?.({ type:'perfect' });
    st.score += 2;
    toast('✨ Perfect!');
  }

  function onHitTarget(it, remainMs, isWeakspot=false){
    st.hits += 1;

    if(remainMs <= st.perfectWindowMs) onPerfect();
    else fun?.onAction?.({ type:'hit' });

    st.combo += 1;
    st.comboMax = Math.max(st.comboMax, st.combo);

    const comboMul = 1 + Math.min(0.6, st.combo * 0.02);
    let base = (it.kind==='boss') ? 3 : 1;
    if (isWeakspot) base += 2;

    st.score += Math.round(base * comboMul * (director.feverOn ? 1.3 : 1.0));

    let gain = st.cleanGainPerHit * (it.kind==='boss' ? 1.4 : 1.0) * (director.feverOn ? 1.25 : 1.0);
    if (isWeakspot) gain *= 1.35;
    st.clean = clamp(st.clean + gain, 0, 100);

    if(director.feverOn && rng() < 0.18){
      burstPop(1);
    }
  }

  function onMiss(kind){
    st.miss += 1;
    st.combo = 0;
    st.score = Math.max(0, st.score - (kind==='boss'? 2 : 1));
    st.clean = clamp(st.clean - st.cleanLosePerMiss, 0, 100);
    fun?.onAction?.({ type:'timeout' });
  }

  function burstPop(n){
    const arr = Array.from(st.targets.entries()).filter(([,v])=> v.kind==='plaque');
    for(let i=0;i<Math.min(n, arr.length);i++){
      const pick = arr[Math.floor(rng()*arr.length)];
      if(!pick) break;
      const [id, it] = pick;
      if(it){
        onHitTarget(it, 0, false);
        removeTarget(id, true);
      }
    }
  }

  // ---------- hit test ----------
  function hitTest(x,y){
    const rad = 44;
    let best = null;
    let bestD = 1e9;

    for(const [id,it] of st.targets){
      const ex = parseFloat(it.el.style.left || '0');
      const ey = parseFloat(it.el.style.top  || '0');
      const dx = ex - x;
      const dy = ey - y;
      const d2 = dx*dx + dy*dy;

      // boss larger hit radius
      const rr = (it.kind === 'boss') ? 54 : rad;
      if(d2 <= rr*rr && d2 < bestD){
        bestD = d2;
        best = { id, it };
      }
    }
    return best;
  }

  function isBossWeakspotHit(it, x, y){
    if (!it || it.kind !== 'boss') return false;
    const ex = parseFloat(it.el.style.left || '0');
    const ey = parseFloat(it.el.style.top  || '0');
    const wx = ex + (it.wsOffsetX || 0);
    const wy = ey + (it.wsOffsetY || 0);
    const dx = wx - x;
    const dy = wy - y;
    return (dx*dx + dy*dy) <= (18*18);
  }

  function markWeakspotHit(it){
    if (!it || !it.el) return;
    it.el.classList.remove('ws-hit');
    void it.el.offsetWidth;
    it.el.classList.add('ws-hit');
    setTimeout(()=> { try{ it.el.classList.remove('ws-hit'); }catch(_){} }, 180);
  }

  function onHitAt(x,y, meta){
    if(!st.running || st.paused || st.over) return;
    st.shots += 1;

    const t = now();
    const hit = hitTest(x,y);
    if(!hit){
      st.combo = 0;
      st.miss += 1;
      st.score = Math.max(0, st.score - 1);
      fun?.onNearMiss?.({ reason:'whiff' });
      hud(true);
      return;
    }

    const { id, it } = hit;
    const remain = it.dieMs - t;

    let damage = 1;
    let weakspot = false;
    if (it.kind === 'boss'){
      weakspot = isBossWeakspotHit(it, x, y);
      if (weakspot) {
        damage = 2; // reward precision
        markWeakspotHit(it);
        emitBrushAI('gate_break', { hp: it.hp, weakspot: true });
      }
    }

    it.hp = Math.max(0, it.hp - damage);
    updateHpVis(it);

    onHitTarget(it, remain, weakspot);

    if (it.kind === 'boss'){
      emitBrushAI('boss_phase', { phase: Math.max(1, it.hp), hp: it.hp });
      if (it.hp > 0 && weakspot) {
        placeWeakspot(it); // move weakspot after correct hit
      }
    }

    if(it.hp <= 0){
      removeTarget(id, true);

      if(it.kind==='boss'){
        st.bossActive = false;
        st.nextBossAt = Math.min(100, st.nextBossAt + st.bossEveryPct);
        toast('💥 Boss แตก!');
        emit('hha:coach', { msg:'เยี่ยม! คราบหนาแตกแล้ว ไปต่อ!', ts: Date.now() });
        emitBrushAI('gate_break', { bossDefeated:true, nextBossAt: st.nextBossAt });
        fxFlash();
      }
    }

    hud(true);
    emit('hha:score', { score: st.score, combo: st.combo, miss: st.miss, clean: st.clean, ts: Date.now() });

    if(st.clean >= 100){
      endGame('clean', currentToken());
    }
  }

  // ---------- cVR shoot hook ----------
  WIN.addEventListener('hha:shoot', (ev)=>{
    if (__disposed__) return;
    const d = ev?.detail || {};
    const x = safeNum(d.x, NaN);
    const y = safeNum(d.y, NaN);
    if(Number.isFinite(x) && Number.isFinite(y)){
      onHitAt(x, y, { source:'shoot', view:d.view||'' });
    }
  });

  // ---------- timing ----------
  let spawnTimer = null;
  let tickTimer = null;

  function clearAllLoops(){
    try { clearTimeout(spawnTimer); } catch(_) {}
    try { clearInterval(tickTimer); } catch(_) {}
    spawnTimer = null;
    tickTimer = null;
  }

  function scheduleSpawn(token){
    clearTimeout(spawnTimer);
    if(!st.running || st.paused || st.over) return;
    if(!isLiveToken(token)) return;

    const base = st.baseSpawnMs;
    const every = fun ? fun.scaleIntervalMs(base, director) : base;

    spawnTimer = setTimeout(guardToken(token, ()=>{
      if(!st.running || st.paused || st.over) return;
      spawnOne();
      scheduleSpawn(token);
    }), every);
  }

  function tick(token){
    if(!isLiveToken(token)) return;
    if(!st.running || st.paused || st.over) return;

    director = fun ? fun.tick() : director;

    const t = now();

    // timeout targets
    for(const [id,it] of st.targets){
      if(t >= it.dieMs){
        removeTarget(id, false);
        if(it.kind==='boss'){
          st.bossActive = false;
          toast('💎 Boss หลุด!');
          emitBrushAI('gate_reset', { reason:'boss_timeout' });
        }
        onMiss(it.kind);
      }
    }

    const elapsed = (t - st.t0)/1000;
    const left = ctx.time - elapsed;

    // AI phase cues
    updateAiPhase(left);

    // lightweight phase FX cues (visual flavor)
    if (st.aiPhase === 'laser' && rng() < 0.025) fxLaser();
    if (st.aiPhase === 'shock' && rng() < 0.03)  fxShock();

    emit('hha:time', { t: Math.max(0,left), elapsed, ts: Date.now() });
    hud();

    if(left <= 0){
      endGame('time', token);
    }
  }

  // ---------- start/end ----------
  function forceUiToMenuSafe(){
    try{
      if (menu) menu.style.display = 'grid';
      if (end)  { end.hidden = true; end.style.display = 'none'; }
      if (wrap) wrap.dataset.state = 'menu';
    }catch(_){}
  }

  function resetSummaryUi(){
    if (sScore) sScore.textContent = '0';
    if (sAcc) sAcc.textContent = '0%';
    if (sMiss) sMiss.textContent = '0';
    if (sCombo) sCombo.textContent = '0';
    if (sClean) sClean.textContent = '0%';
    if (sTime) sTime.textContent = '0s';
    if (endGrade) endGrade.textContent = '—';
    if (endNote) endNote.textContent = '-';
  }

  function startGame(){
    if (__disposed__) return;

    const token = newSessionToken();
    clearAllLoops();

    st.running = true;
    st.paused = false;
    st.over = false;

    st.t0 = now();
    st.score = 0;
    st.combo = 0;
    st.comboMax = 0;
    st.miss = 0;
    st.shots = 0;
    st.hits = 0;
    st.clean = 0;

    st.nextBossAt = st.bossEveryPct;
    st.bossActive = false;

    st.aiPhase = 'normal';
    st.lastAiEmitAt = 0;
    st.time10sFired = false;

    clearAllTargetsHard();

    if (menu) menu.style.display = 'none';
    if (end)  { end.hidden = true; end.style.display = 'none'; }
    if (wrap) wrap.dataset.state = 'play';
    if (btnPause) btnPause.textContent = 'Pause';

    resetSummaryUi();

    toast('เริ่ม! แปรงคราบให้ทัน!');
    hud(true);

    emit('hha:start', {
      game:'brush',
      category:'hygiene',
      pid: ctx.pid,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,
      seed: ctx.seed,
      diff: ctx.diff,
      view: ctx.view,
      timePlannedSec: ctx.time,
      ts: Date.now(),
      token
    });

    emitBrushAI('boss_phase', { phase:'start', hp:0 });

    scheduleSpawn(token);
    tickTimer = setInterval(()=> tick(token), 80);
  }

  function endGame(reason, token){
    if (__disposed__) return;
    if (typeof token === 'number' && !isLiveToken(token)) return;
    if(st.over) return;

    st.over = true;
    st.running = false;

    clearAllLoops();
    clearAllTargetsHard();

    const acc = (st.shots > 0) ? (st.hits / st.shots) * 100 : 0;
    const grade = gradeFromAcc(acc);
    const elapsed = Math.min(ctx.time, (now() - st.t0)/1000);

    const summary = {
      game:'brush',
      category:'hygiene',
      reason,
      pid: ctx.pid,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,
      seed: ctx.seed,
      diff: ctx.diff,
      view: ctx.view,

      score: st.score,
      comboMax: st.comboMax,
      miss: st.miss,
      shots: st.shots,
      hits: st.hits,
      accuracyPct: Math.round(acc*10)/10,
      grade,

      cleanPct: Math.round(clamp(st.clean,0,100)),
      timePlannedSec: ctx.time,
      timePlayedSec: Math.round(elapsed*10)/10,

      date: ymdLocal(),
      ts: Date.now()
    };

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const k='HHA_SUMMARY_HISTORY';
      const arr = JSON.parse(localStorage.getItem(k)||'[]');
      arr.push(summary);
      localStorage.setItem(k, JSON.stringify(arr.slice(-30)));
    }catch(_){}

    try{
      localStorage.setItem(`HHA_ZONE_DONE::hygiene::${ymdLocal()}`, '1');
    }catch(_){}

    emit('hha:judge', { ...summary });
    emit('hha:end', { ...summary });

    if (sScore) sScore.textContent = String(summary.score);
    if (sAcc)   sAcc.textContent   = `${summary.accuracyPct}%`;
    if (sMiss)  sMiss.textContent  = String(summary.miss);
    if (sCombo) sCombo.textContent = String(summary.comboMax);
    if (sClean) sClean.textContent = `${summary.cleanPct}%`;
    if (sTime)  sTime.textContent  = `${summary.timePlayedSec}s`;
    if (endGrade) endGrade.textContent = summary.grade;
    if (endNote) {
      endNote.textContent =
        `reason=${reason} | seed=${summary.seed} | diff=${summary.diff} | view=${summary.view} | pid=${summary.pid||'-'}`;
    }

    if (menu) menu.style.display = 'none';
    if (end)  { end.hidden = false; end.style.display = 'grid'; }
    if (wrap) wrap.dataset.state = 'end';

    toast(reason==='clean' ? '🦷 สะอาดแล้ว! เยี่ยม!' : 'หมดเวลา!');
  }

  function togglePause(){
    if(!st.running || st.over) return;
    st.paused = !st.paused;
    if (btnPause) btnPause.textContent = st.paused ? 'Resume' : 'Pause';
    toast(st.paused ? '⏸ Pause' : '▶ Resume');
  }

  // ---------- controls ----------
  let __lastStartTap__ = 0;
  function startGameDebounced(){
    const t = Date.now();
    if (t - __lastStartTap__ < 300) return;
    __lastStartTap__ = t;
    startGame();
  }

  btnStart?.addEventListener('click', startGameDebounced, { passive:true });
  btnRetry?.addEventListener('click', startGameDebounced, { passive:true });
  btnPause?.addEventListener('click', togglePause, { passive:true });

  btnHow?.addEventListener('click', ()=>{
    toast('แตะ/ยิง “🦠” ให้ทัน • คราบหนา “💎” ยิงจุดเหลืองแรงกว่า • ใกล้หมดเวลา = Perfect!');
  }, { passive:true });

  btnRecenter?.addEventListener('click', ()=>{
    WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts:Date.now() } }));
    toast('Recenter');
  }, { passive:true });

  // click on layer = shoot at point (avoid duplicate in cvr strict)
  layer?.addEventListener('pointerdown', (ev)=>{
    if(ctx.view==='cvr') return;
    if(!st.running || st.paused || st.over) return;
    onHitAt(ev.clientX, ev.clientY, { source:'layer' });
  }, { passive:true });

  // ---------- dispose ----------
  function disposeEngine(reason){
    if (__disposed__) return;
    __disposed__ = true;

    newSessionToken(); // invalidate all old async work
    clearAllLoops();
    clearAllTargetsHard();

    try{
      const el = $('#toast');
      if (el) el.classList.remove('show');
    }catch(_){}

    console.warn('[BrushVR SAFE] disposed:', reason || 'unknown');
  }

  WIN.__BRUSH_SAFE_ACTIVE__ = {
    id: __ENGINE_INSTANCE_ID__,
    dispose: disposeEngine
  };

  WIN.addEventListener('pagehide', ()=> {
    try { disposeEngine('pagehide'); } catch(_) {}
  }, { passive:true });

  WIN.addEventListener('beforeunload', ()=> {
    try { disposeEngine('beforeunload'); } catch(_) {}
  }, { passive:true });

  // ---------- init ----------
  forceUiToMenuSafe();
  resetSummaryUi();
  hud(true);
  toast('พร้อมแล้ว! กดเริ่มเกมได้เลย');

})();