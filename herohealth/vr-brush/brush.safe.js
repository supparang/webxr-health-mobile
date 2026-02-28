// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE — Plaque Breaker (FULL PATCH: scroll lock + overlay harden + cVR aim assist + stable summary)
// ✅ Fix: mobile scroll drift / page jumps while playing
// ✅ Fix: prevent accidental END overlay on start
// ✅ Fix: generic cross-origin "Script error." won't fatal-overlay the whole game
// ✅ Tap/Click (pc/mobile) + Crosshair Shoot (cVR via vr-ui.js -> hha:shoot)
// ✅ Perfect window + Fever + Boss plaque + Weakspot
// ✅ Summary + Back Hub + Save last summary
// ✅ Emits: hha:start, hha:time, hha:score, hha:judge, hha:end, hha:coach
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // ---------- helpers ----------
  const $ = (s)=>DOC.querySelector(s);
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function safeNum(x,d=0){ const n=Number(x); return Number.isFinite(n)?n:d; }
  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }
  function toNum(v,d=0){ const n = Number(v); return Number.isFinite(n) ? n : d; }

  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail })); }catch(_){}
  }

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

  // ✅ Harden error overlay: don't block gameplay on generic cross-origin "Script error."
  WIN.addEventListener('error', (e)=>{
    const msg = String(e?.message || e || '');
    const file = String(e?.filename || '');
    const line = e?.lineno || '';
    const col  = e?.colno || '';

    if(!msg || msg === 'Script error.' || msg === 'Script error'){
      console.warn('[BrushVR] Generic script error (likely cross-origin):', { msg, file, line, col });
      toast('มีสคริปต์ภายนอกผิดพลาด (เกมยังเล่นต่อได้)');
      return;
    }
    fatal('JS ERROR:\n' + msg + '\n\n' + file + ':' + line + ':' + col);
  });

  WIN.addEventListener('unhandledrejection', (e)=>{
    const reason = e?.reason?.message || e?.reason || e;
    const text = String(reason || '');
    if(text === 'Script error.' || text === 'Script error'){
      console.warn('[BrushVR] Generic promise rejection:', reason);
      toast('สคริปต์ภายนอกผิดพลาด (ไม่กระทบเกมหลัก)');
      return;
    }
    fatal('PROMISE REJECTION:\n' + text);
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

  // deterministic rng (mulberry-like)
  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
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

  if(!wrap || !layer){
    throw new Error('BrushVR DOM missing (#br-wrap / #br-layer)');
  }

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
    log: (qs.get('log') || qs.get('api') || '').trim(),
    debug: safeNum(qs.get('debug'), 0) === 1
  };

  ctx.time = clamp(ctx.time, 30, 120);
  if(!['easy','normal','hard'].includes(ctx.diff)) ctx.diff = 'normal';

  wrap.dataset.view = ctx.view;
  wrap.dataset.state = 'menu';

  if(ctxView) ctxView.textContent = ctx.view;
  if(ctxSeed) ctxSeed.textContent = String((ctx.seed >>> 0));
  if(ctxTime) ctxTime.textContent = `${ctx.time}s`;
  if(diffTag) diffTag.textContent = ctx.diff;
  if(mDiff) mDiff.textContent = ctx.diff;
  if(mTime) mTime.textContent = `${ctx.time}s`;

  function setBackLinks(){
    const hubUrl = passHubUrl(ctx);
    for (const a of [btnBack, btnBackHub2]){
      if(!a) continue;
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

  const rng = seededRng(ctx.seed);

  // ---------- scroll lock (mobile/cVR) ----------
  let __brScrollStyle = null;
  function ensureScrollLockStyle(){
    if (__brScrollStyle) return;
    const st = DOC.createElement('style');
    st.id = 'br-scroll-lock-style';
    st.textContent = `
      html.br-no-scroll, body.br-no-scroll{
        overflow: hidden !important;
        height: 100% !important;
        overscroll-behavior: none !important;
        touch-action: none !important;
      }
      /* allow taps on VR UI */
      #hha-vrui, #hha-vrui *{
        touch-action: manipulation;
      }
      #br-layer{
        touch-action: none;
        overscroll-behavior: contain;
        -webkit-user-select: none;
        user-select: none;
      }
    `;
    DOC.head.appendChild(st);
    __brScrollStyle = st;
  }

  function setPlayScrollLock(on){
    ensureScrollLockStyle();
    DOC.documentElement.classList.toggle('br-no-scroll', !!on);
    DOC.body.classList.toggle('br-no-scroll', !!on);
    if (on) {
      try{ WIN.scrollTo(0,0); }catch(_){}
    }
  }

  function installTouchGuards(){
    const guard = (ev)=>{
      if (!S.running || S.paused || S.ended) return;
      const t = ev.target;

      if (t && t.closest && (
        t.closest('#hha-vrui') ||
        t.closest('.br-btn') ||
        t.closest('.hha-btn') ||
        t.closest('button') ||
        t.closest('a')
      )){
        return;
      }
      ev.preventDefault();
    };

    DOC.addEventListener('touchmove', guard, { passive:false });
    DOC.addEventListener('gesturestart', guard, { passive:false });
    DOC.addEventListener('gesturechange', guard, { passive:false });

    let lastTouchEnd = 0;
    DOC.addEventListener('touchend', (ev)=>{
      const t = now();
      if (t - lastTouchEnd < 280 && S.running && !S.paused && !S.ended){
        ev.preventDefault();
      }
      lastTouchEnd = t;
    }, { passive:false });

    WIN.addEventListener('focus', ()=>{
      if (S.running && !S.ended){
        try{ WIN.scrollTo(0,0); }catch(_){}
      }
    }, { passive:true });

    WIN.addEventListener('scroll', ()=>{
      if (S.running && !S.ended && (WIN.scrollY || WIN.pageYOffset || 0) > 2){
        try{ WIN.scrollTo(0,0); }catch(_){}
      }
    }, { passive:true });
  }

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
  let fx = null;

  // ---------- game state ----------
  const S = {
    running:false,
    paused:false,
    ended:false,
    t0:0,
    lastHud:0,

    score:0,
    combo:0,
    comboMax:0,
    miss:0,
    totalShots:0,
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
    targets: new Map(), // id -> target
  };

  (function tune(){
    if(ctx.diff==='easy'){
      S.baseSpawnMs = 900;
      S.ttlMs = 1950;
      S.perfectWindowMs = 260;
      S.cleanGainPerHit = 1.35;
      S.cleanLosePerMiss = 0.45;
    }else if(ctx.diff==='hard'){
      S.baseSpawnMs = 650;
      S.ttlMs = 1450;
      S.perfectWindowMs = 200;
      S.cleanGainPerHit = 1.05;
      S.cleanLosePerMiss = 0.75;
    }
  })();

  // ---------- simple FX layer ----------
  function ensureFx(){
    if(fx) return fx;
    let root = DOC.getElementById('br-fx');
    if(!root){
      root = DOC.createElement('div');
      root.id = 'br-fx';
      root.innerHTML = `
        <div class="fx-flash" id="fxFlash"></div>
        <div class="fx-laser" id="fxLaser"></div>
        <div class="fx-fin" id="fxFin"></div>
      `;
      DOC.body.appendChild(root);
    }
    fx = {
      root,
      flash: root.querySelector('#fxFlash'),
      laser: root.querySelector('#fxLaser'),
      fin: root.querySelector('#fxFin')
    };
    return fx;
  }
  function fxFlash(ms=120){
    const o = ensureFx();
    if(!o.flash) return;
    o.flash.classList.add('on');
    clearTimeout(fxFlash._t);
    fxFlash._t = setTimeout(()=> o.flash.classList.remove('on'), ms);
  }
  function fxLaser(){
    const o = ensureFx();
    if(!o.laser) return;
    o.laser.classList.remove('on');
    void o.laser.offsetWidth;
    o.laser.classList.add('on');
    clearTimeout(fxLaser._t);
    fxLaser._t = setTimeout(()=> o.laser.classList.remove('on'), 1300);
  }
  function fxFin(on){
    const o = ensureFx();
    if(!o.fin) return;
    o.fin.classList.toggle('on', !!on);
  }

  // ---------- HUD ----------
  function renderHud(force){
    const t = now();
    if(!force && t - S.lastHud < 60) return;
    S.lastHud = t;

    if(tScore) tScore.textContent = String(S.score);
    if(tCombo) tCombo.textContent = String(S.combo);
    if(tMiss)  tMiss.textContent  = String(S.miss);

    const elapsed = S.running ? ((t - S.t0)/1000) : 0;
    const left = S.running ? Math.max(0, ctx.time - elapsed) : ctx.time;
    if(tTime) tTime.textContent = left.toFixed(0);

    const clean = clamp(S.clean, 0, 100);
    if(tClean) tClean.textContent = `${Math.round(clean)}%`;
    if(bClean) bClean.style.width = `${clean}%`;

    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    if(tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';
    if(bFever) bFever.style.width = `${pct}%`;
  }

  function layerRect(){ return layer.getBoundingClientRect(); }

  // ---------- Targets ----------
  function randomInLayer(pad=56){
    const r = layerRect();
    return {
      x: pad + rng() * Math.max(10, (r.width - pad*2)),
      y: pad + rng() * Math.max(10, (r.height - pad*2))
    };
  }

  function updateBossWeakspotPos(t){
    if(!t || t.type !== 'boss' || !t.wsEl) return;
    const ang = rng() * Math.PI * 2;
    const rr = 14 + rng()*12;
    t.weakX = Math.cos(ang) * rr;
    t.weakY = Math.sin(ang) * rr;
    t.weakR = 14;
    t.wsEl.style.left = `calc(50% + ${t.weakX}px)`;
    t.wsEl.style.top  = `calc(50% + ${t.weakY}px)`;
  }

  function mkTarget({x,y,type,hpMax}){
    const id = String(++S.uid);
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'br-t' + (type==='boss' ? ' thick' : '');
    el.dataset.id = id;
    el.dataset.kind = type;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.setAttribute('aria-label', type==='boss' ? 'boss plaque' : 'plaque');

    const emo = DOC.createElement('div');
    emo.className = 'emo';
    emo.textContent = (type==='boss') ? '💎' : '🦠';
    el.appendChild(emo);

    const hp = DOC.createElement('div');
    hp.className = 'hp';
    const fill = DOC.createElement('i');
    hp.appendChild(fill);
    el.appendChild(hp);

    let wsEl = null;
    let weakX = 0, weakY = 0, weakR = 14;

    if(type === 'boss'){
      wsEl = DOC.createElement('div');
      wsEl.className = 'br-ws';
      el.appendChild(wsEl);
    }

    const born = now();
    const ttl = S.ttlMs * (director.timeScale || 1);
    const die  = born + ttl;

    const t = {
      id, el, type,
      bornMs: born,
      dieMs: die,
      hpMax, hp: hpMax,
      fillEl: fill,
      wsEl, weakX, weakY, weakR
    };

    if(type === 'boss'){
      updateBossWeakspotPos(t);
    }

    S.targets.set(id, t);

    el.addEventListener('pointerdown', onTargetPointerDown, { passive:false });
    layer.appendChild(el);
    updateHpVis(t);

    return t;
  }

  function spawnOne(){
    if(!S.running || S.paused || S.ended) return;

    director = fun ? fun.tick() : director;

    const {x,y} = randomInLayer(56);

    if(!S.bossActive && S.clean >= S.nextBossAt && S.clean < 100){
      S.bossActive = true;
      mkTarget({ x, y, type:'boss', hpMax: (ctx.diff==='hard'? 5 : ctx.diff==='easy'? 3 : 4) });
      toast('💎 BOSS PLAQUE!');
      emit('hha:coach', { msg:'เจอบอสคราบหนา! ยิง/แตะหลายครั้งให้แตก!', ts: Date.now() });
      fxLaser();
      try{ WIN.dispatchEvent(new CustomEvent('brush:ai', { detail:{ type:'boss_start' } })); }catch(_){}
      return;
    }

    mkTarget({ x, y, type:'plaque', hpMax: 1 });
  }

  function updateHpVis(t){
    if(!t || !t.fillEl) return;
    const pct = clamp((t.hp / t.hpMax) * 100, 0, 100);
    t.fillEl.style.width = pct + '%';
  }

  function removeTarget(id, popped){
    const t = S.targets.get(id);
    if(!t) return;
    S.targets.delete(id);

    const el = t.el;
    if(!el) return;
    if(popped) el.classList.add('pop');
    el.classList.add('fade');
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
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
    S.score += 2;
    toast('✨ Perfect!');
    fxFlash(90);
  }

  function burstPop(n){
    const arr = Array.from(S.targets.values()).filter(v => v.type==='plaque');
    for(let i=0;i<Math.min(n, arr.length);i++){
      const pick = arr[Math.floor(rng()*arr.length)];
      if(!pick) break;
      if(!S.targets.has(pick.id)) continue;
      S.hits += 1;
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.score += 1;
      S.clean = clamp(S.clean + S.cleanGainPerHit, 0, 100);
      removeTarget(pick.id, true);
    }
  }

  function applyHitRewards(t, remainMs, wasWeakspot){
    S.hits += 1;

    if(remainMs <= S.perfectWindowMs) onPerfect();
    else fun?.onAction?.({ type:'hit' });

    S.combo += 1;
    S.comboMax = Math.max(S.comboMax, S.combo);

    const comboMul = 1 + Math.min(0.6, S.combo * 0.02);
    let base = (t.type==='boss') ? 3 : 1;
    if(wasWeakspot) base += 2;
    S.score += Math.round(base * comboMul * (director.feverOn ? 1.3 : 1.0));

    let gain = S.cleanGainPerHit * (t.type==='boss' ? 1.4 : 1.0) * (director.feverOn ? 1.25 : 1.0);
    if(wasWeakspot) gain *= 1.25;
    S.clean = clamp(S.clean + gain, 0, 100);

    if(director.feverOn && rng() < 0.18){
      burstPop(1);
    }
  }

  function onMiss(kind){
    S.miss += 1;
    S.combo = 0;
    S.score = Math.max(0, S.score - (kind==='boss'? 2 : 1));
    S.clean = clamp(S.clean - S.cleanLosePerMiss, 0, 100);
    fun?.onAction?.({ type:'timeout' });
  }

  function pointInBossWeakspot(t, x, y){
    if(!t || t.type !== 'boss' || !t.el) return false;
    const r = t.el.getBoundingClientRect();
    const cx = r.left + r.width * 0.5 + (t.weakX || 0);
    const cy = r.top  + r.height * 0.5 + (t.weakY || 0);
    const rr = Math.max(10, t.weakR || 14);
    const dx = x - cx;
    const dy = y - cy;
    return (dx*dx + dy*dy) <= rr*rr;
  }

  function handleHit(t, x, y, source){
    if(!t || !S.targets.has(t.id) || S.ended) return;

    const tm = now();
    const remain = t.dieMs - tm;
    const weakHit = pointInBossWeakspot(t, x, y);

    const dmg = (t.type === 'boss') ? (weakHit ? 2 : 1) : 1;
    t.hp = Math.max(0, t.hp - dmg);

    if(weakHit && t.el){
      t.el.classList.add('ws-hit');
      setTimeout(()=> t.el && t.el.classList.remove('ws-hit'), 180);
      updateBossWeakspotPos(t);
      toast('🎯 Weakspot!');
    }

    updateHpVis(t);
    applyHitRewards(t, remain, weakHit);

    if(t.hp <= 0){
      removeTarget(t.id, true);
      if(t.type==='boss'){
        S.bossActive = false;
        S.nextBossAt = Math.min(100, S.nextBossAt + S.bossEveryPct);
        toast('💥 Boss แตก!');
        fxLaser();
        emit('hha:coach', { msg:'เยี่ยม! คราบหนาแตกแล้ว ไปต่อ!', ts: Date.now() });
      }
    }

    renderHud(true);
    emit('hha:score', { score: S.score, combo: S.combo, miss: S.miss, clean: S.clean, ts: Date.now(), source });

    if(S.clean >= 100){
      endGame('clean');
    }
  }

  function onTargetPointerDown(ev){
    if(!S.running || S.paused || S.ended) return;
    ev.preventDefault();

    const btn = ev.currentTarget;
    const id = btn?.dataset?.id;
    const t = id ? S.targets.get(id) : null;
    if(!t) return;

    S.totalShots++; // count here (one source)
    handleHit(t, ev.clientX, ev.clientY, 'pointer');
  }

  // ---------- Aim assist for cVR / hha:shoot ----------
  function getTargetScreenCenter(t){
    if(!t || !t.el) return null;
    const r = t.el.getBoundingClientRect();
    return { x: r.left + r.width*0.5, y: r.top + r.height*0.5, w:r.width, h:r.height };
  }

  function getBossWeakspotScreenCenter(t){
    if(!t || t.type !== 'boss' || !t.el) return null;
    const r = t.el.getBoundingClientRect();
    return { x: r.left + r.width*0.5 + (t.weakX||0), y: r.top + r.height*0.5 + (t.weakY||0), r: Math.max(10, t.weakR||14) };
  }

  function getDynamicLockPx(baseLock, t, isCVR){
    const c = getTargetScreenCenter(t);
    if(!c) return baseLock;
    const size = Math.max(24, Math.min(c.w, c.h));
    let bonus = size * (isCVR ? 0.22 : 0.12);
    if(t.type === 'boss') bonus += isCVR ? 10 : 6;
    return clamp(Math.round(baseLock + bonus), baseLock, isCVR ? 92 : 72);
  }

  function nearestAssistPick(x, y, baseLock, isCVR){
    let best = null;
    let bestScore = Infinity;

    for(const t of S.targets.values()){
      if(!t || !t.el) continue;

      const c = getTargetScreenCenter(t);
      if(!c) continue;

      const dynLock = getDynamicLockPx(baseLock, t, isCVR);

      if(t.type === 'boss'){
        const ws = getBossWeakspotScreenCenter(t);
        if(ws){
          const dxw = x - ws.x, dyw = y - ws.y;
          const d2w = dxw*dxw + dyw*dyw;
          const wsLock = Math.max(dynLock, ws.r + (isCVR ? 22 : 12));
          if(d2w <= wsLock*wsLock){
            const score = d2w * 0.55;
            if(score < bestScore){
              bestScore = score;
              best = { t, aimX: ws.x, aimY: ws.y };
            }
          }
        }
      }

      const dx = x - c.x, dy = y - c.y;
      const d2 = dx*dx + dy*dy;
      if(d2 <= dynLock*dynLock){
        let score = d2;
        if(isCVR && t.type === 'boss') score *= 0.92;
        if(score < bestScore){
          bestScore = score;
          best = { t, aimX: x, aimY: y };
        }
      }
    }
    return best;
  }

  function handleShootEvent(ev){
    if(!S.running || S.paused || S.ended) return;

    const d = (ev && ev.detail) || {};
    const x = toNum(d.x, WIN.innerWidth/2);
    const y = toNum(d.y, WIN.innerHeight/2);
    const baseLock = clamp(toNum(d.lockPx, 28), 6, 80);

    const isCVR =
      String(d.view || ctx.view || '').toLowerCase() === 'cvr' ||
      String(ctx.view || '').toLowerCase() === 'cvr' ||
      String(DOC.documentElement?.dataset?.view || '').toLowerCase() === 'cvr';

    const pick = nearestAssistPick(x, y, baseLock, isCVR);

    S.totalShots++; // count shoot source here

    if(pick && pick.t){
      handleHit(pick.t, pick.aimX, pick.aimY, d.source || 'hha:shoot');
      return;
    }

    S.miss++;
    S.combo = 0;
    fun?.onNearMiss?.({ reason:'whiff' });
    renderHud(true);
    toast('พลาด');
  }
  WIN.addEventListener('hha:shoot', handleShootEvent);

  // ---------- timing ----------
  let spawnTimer = null;
  let tickTimer = null;
  let bossAiTimer = null;

  function clearTimers(){
    clearTimeout(spawnTimer);
    clearInterval(tickTimer);
    clearInterval(bossAiTimer);
    spawnTimer = null;
    tickTimer = null;
    bossAiTimer = null;
  }

  function scheduleSpawn(){
    clearTimeout(spawnTimer);
    if(!S.running || S.paused || S.ended) return;

    const base = S.baseSpawnMs;
    const every = fun ? fun.scaleIntervalMs(base, director) : base;

    spawnTimer = setTimeout(()=>{
      spawnOne();
      scheduleSpawn();
    }, every);
  }

  function tick(){
    if(!S.running || S.paused || S.ended) return;

    director = fun ? fun.tick() : director;
    const t = now();

    for(const [id,tt] of S.targets){
      if(t >= tt.dieMs){
        removeTarget(id, false);
        if(tt.type==='boss'){
          S.bossActive = false;
          toast('💎 Boss หลุด!');
        }
        onMiss(tt.type);
      }
    }

    const elapsed = (t - S.t0)/1000;
    const left = ctx.time - elapsed;

    if(left <= 10.3 && left >= 9.7){
      try{ WIN.dispatchEvent(new CustomEvent('brush:ai', { detail:{ type:'time_10s' } })); }catch(_){}
      fxFin(true);
      setTimeout(()=>fxFin(false), 900);
    }

    emit('hha:time', { t: Math.max(0,left), elapsed, ts: Date.now() });
    renderHud();

    if(left <= 0){
      endGame('time');
    }
  }

  function startBossAiPulse(){
    clearInterval(bossAiTimer);
    bossAiTimer = setInterval(()=>{
      if(!S.running || S.paused || S.ended || !S.bossActive) return;
      const boss = [...S.targets.values()].find(t => t.type==='boss');
      if(!boss) return;
      try{
        WIN.dispatchEvent(new CustomEvent('brush:ai', {
          detail:{ type:'boss_phase', phase: 1, hp: `${boss.hp}/${boss.hpMax}` }
        }));
      }catch(_){}
    }, 2200);
  }

  // ---------- start/end ----------
  function startGame(){
    S.running = true;
    S.paused = false;
    S.ended = false;

    S.t0 = now();
    S.score = 0;
    S.combo = 0;
    S.comboMax = 0;
    S.miss = 0;
    S.totalShots = 0;
    S.hits = 0;
    S.clean = 0;
    S.lastHud = 0;

    S.nextBossAt = S.bossEveryPct;
    S.bossActive = false;

    for(const [id] of Array.from(S.targets)) removeTarget(id, false);
    S.targets.clear();

    director = fun ? (fun.tick?.() || { spawnMul:1, timeScale:1, feverOn:false }) : director;
    fxFin(false);

    // ✅ lock scroll while playing
    setPlayScrollLock(true);

    // ✅ overlay harden (กันเข้าแล้วเด้งสรุป/เมนูทับ)
    if(menu){
      menu.hidden = true;
      menu.style.display = 'none';
    }
    if(end){
      end.hidden = true;
      end.style.display = 'none';
      end.setAttribute('aria-hidden', 'true');
    }

    wrap.dataset.state = 'play';
    if(btnPause) btnPause.textContent = 'Pause';

    try{ WIN.scrollTo(0,0); }catch(_){}

    toast('เริ่ม! แปรงคราบให้ทัน!');
    renderHud(true);

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
      ts: Date.now()
    });

    clearTimers();
    scheduleSpawn();
    tickTimer = setInterval(tick, 80);
    startBossAiPulse();

    try{ WIN.dispatchEvent(new CustomEvent('hha:mode', { detail:{ mode:'play' } })); }catch(_){}
  }

  function endGame(reason){
    if(S.ended) return;
    S.ended = true;
    S.running = false;
    S.paused = false;

    clearTimers();

    for(const [id] of Array.from(S.targets)) removeTarget(id, false);
    S.targets.clear();

    const acc = (S.totalShots > 0) ? (S.hits / S.totalShots) * 100 : 0;
    const grade = gradeFromAcc(acc);
    const elapsed = Math.min(ctx.time, Math.max(0, (now() - S.t0)/1000));

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

      score: S.score,
      comboMax: S.comboMax,
      miss: S.miss,
      shots: S.totalShots,
      hits: S.hits,
      accuracyPct: Math.round(acc*10)/10,
      grade,

      cleanPct: Math.round(clamp(S.clean,0,100)),
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

    if(sScore) sScore.textContent = String(summary.score);
    if(sAcc)   sAcc.textContent   = `${summary.accuracyPct}%`;
    if(sMiss)  sMiss.textContent  = String(summary.miss);
    if(sCombo) sCombo.textContent = String(summary.comboMax);
    if(sClean) sClean.textContent = `${summary.cleanPct}%`;
    if(sTime)  sTime.textContent  = `${summary.timePlayedSec}s`;
    if(endGrade) endGrade.textContent = summary.grade;

    if(endNote){
      endNote.textContent =
        `reason=${reason} | seed=${summary.seed} | diff=${summary.diff} | view=${summary.view} | pid=${summary.pid||'-'}`;
    }

    // ✅ unlock scroll when game ends
    setPlayScrollLock(false);

    if(end){
      end.hidden = false;
      end.style.display = 'grid';
      end.removeAttribute('aria-hidden');
    }
    if(menu){
      menu.hidden = true;
      menu.style.display = 'none';
    }
    wrap.dataset.state = 'end';

    toast(reason==='clean' ? '🦷 สะอาดแล้ว! เยี่ยม!' : 'หมดเวลา!');
    try{ WIN.dispatchEvent(new CustomEvent('hha:mode', { detail:{ mode:'end' } })); }catch(_){}
  }

  function togglePause(){
    if(!S.running || S.ended) return;
    S.paused = !S.paused;

    // pause ก็ยัง lock ไว้
    setPlayScrollLock(true);

    if(btnPause) btnPause.textContent = S.paused ? 'Resume' : 'Pause';
    toast(S.paused ? '⏸ Pause' : '▶ Resume');
  }

  // ---------- controls ----------
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRetry?.addEventListener('click', startGame, { passive:true });
  btnPause?.addEventListener('click', togglePause, { passive:true });

  btnHow?.addEventListener('click', ()=>{
    toast('แตะ/ยิง “🦠” ให้ทัน • คราบหนา “💎” ต้องหลายครั้ง • ยิงจุดอ่อนวงเหลืองแรงกว่า!');
  }, { passive:true });

  btnRecenter?.addEventListener('click', ()=>{
    WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts:Date.now() } }));
    toast('Recenter');
  }, { passive:true });

  // layer pointer fallback (pc/mobile)
  layer?.addEventListener('pointerdown', (ev)=>{
    if(ctx.view==='cvr') return; // cVR uses crosshair
    if(!S.running || S.paused || S.ended) return;

    // กันนับซ้ำถ้ากดบน target
    const t = ev.target;
    if(t && t.closest && t.closest('.br-t')) return;

    S.totalShots++;
    const pick = nearestAssistPick(ev.clientX, ev.clientY, 20, false);
    if(pick && pick.t){
      handleHit(pick.t, ev.clientX, ev.clientY, 'layer');
    }else{
      S.miss++;
      S.combo = 0;
      fun?.onNearMiss?.({ reason:'whiff_layer' });
      renderHud(true);
      toast('พลาด');
    }
  }, { passive:true });

  // ---------- INIT ----------
  installTouchGuards();
  setPlayScrollLock(false);

  renderHud(true);
  toast('พร้อมแล้ว! กดเริ่มเกมได้เลย');

  if(end){
    end.hidden = true;
    end.style.display = 'none';
    end.setAttribute('aria-hidden','true');
  }
  if(menu){
    menu.hidden = false;
    menu.style.display = 'grid';
  }

  wrap.dataset.state = 'menu';
  try{ WIN.scrollTo(0,0); }catch(_){}

})();