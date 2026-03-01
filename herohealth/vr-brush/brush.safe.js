// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE — FINAL PRO (LOGGER + FLUSH + HITS FIX + NO SCROLL DRIFT)
// Requires DOM ids from brush-vr.html (menu/end/hud/layer)
// Query:
//  - view=pc|mobile|cvr
//  - diff=easy|normal|hard
//  - time=30..120
//  - seed=...
//  - pid=...
//  - run=play|research
//  - hub=...
//  - log=1 (enable logging)
//  - api=<endpoint> (logging endpoint)  OR log=<endpoint>
//  - debug=1
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const $ = (s)=>DOC.querySelector(s);
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function safeNum(x,d=0){ const n=Number(x); return Number.isFinite(n)?n:d; }
  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }
  function toNum(v,d=0){ const n = Number(v); return Number.isFinite(n) ? n : d; }
  function tryJson(x, d){ try{ return JSON.parse(x); }catch(_){ return d; } }

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
    return isMobile ? 'mobile' : 'pc';
  }
  function passHubUrl(ctx){
    const qs = getQS();
    return qs.get('hub') || ctx.hub || '../hub.html';
  }

  // deterministic rng
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

  // ---------- DOM ----------
  const wrap = $('#br-wrap');
  const layer = $('#br-layer');
  const menu = $('#br-menu');
  const end  = $('#br-end');

  const btnStart = $('#btnStart');
  const btnRetry = $('#btnRetry');
  const btnPause = $('#btnPause');
  const btnHow = $('#btnHow');
  const btnRecenter = $('#btnRecenter');

  // back hub buttons are <a>
  const btnBack = $('#btnBack');
  const btnBackHub2 = $('#btnBackHub2');

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
  const endNote  = $('#endNote');

  if(!wrap || !layer) throw new Error('BrushVR DOM missing (#br-wrap / #br-layer)');

  // ---------- context ----------
  const qs = getQS();
  const ctx = {
    hub: qs.get('hub') || '../hub.html',
    run: (qs.get('run') || qs.get('mode') || 'play').toLowerCase(),
    view: getViewAuto(),
    diff: (qs.get('diff') || 'normal').toLowerCase(),
    time: safeNum(qs.get('time'), 80),
    seed: safeNum(qs.get('seed'), Date.now()),
    pid: (qs.get('pid') || qs.get('participantId') || '').trim(),
    studyId: (qs.get('studyId') || '').trim(),
    phase: (qs.get('phase') || '').trim(),
    conditionGroup: (qs.get('conditionGroup') || '').trim(),
    debug: safeNum(qs.get('debug'), 0) === 1,

    // logging flags
    logFlag: String(qs.get('log') ?? '').trim(), // "1" or endpoint
    api: String(qs.get('api') ?? '').trim()
  };
  ctx.time = clamp(ctx.time, 30, 120);
  if(!['easy','normal','hard'].includes(ctx.diff)) ctx.diff = 'normal';
  if(!['play','research'].includes(ctx.run)) ctx.run = 'play';

  // resolve endpoint: log=<endpoint> has priority over api=...
  let LOG_ENDPOINT = '';
  if(ctx.logFlag && ctx.logFlag !== '0' && ctx.logFlag !== '1') LOG_ENDPOINT = ctx.logFlag;
  else if(ctx.api) LOG_ENDPOINT = ctx.api;

  const LOG_ENABLED = (ctx.logFlag === '1' || (!!LOG_ENDPOINT));
  const GAME_VERSION = 'v20260301b';

  // ---------- view/data attrs ----------
  wrap.dataset.view = ctx.view;
  DOC.body.setAttribute('data-view', ctx.view);
  wrap.dataset.state = 'menu';

  if(ctxView) ctxView.textContent = ctx.view;
  if(ctxSeed) ctxSeed.textContent = String((ctx.seed >>> 0));
  if(ctxTime) ctxTime.textContent = `${ctx.time}s`;
  if(diffTag) diffTag.textContent = ctx.diff;
  if(mDiff) mDiff.textContent = ctx.diff;
  if(mTime) mTime.textContent = `${ctx.time}s`;

  // back links: preserve pid/studyId/phase/conditionGroup
  function buildHubUrl(){
    const hubUrl = passHubUrl(ctx);
    try{
      const u = new URL(hubUrl, location.href);
      if(ctx.pid) u.searchParams.set('pid', ctx.pid);
      if(ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
      if(ctx.phase) u.searchParams.set('phase', ctx.phase);
      if(ctx.conditionGroup) u.searchParams.set('conditionGroup', ctx.conditionGroup);
      return u.toString();
    }catch(_){
      return hubUrl;
    }
  }
  function setBackLinks(){
    const u = buildHubUrl();
    if(btnBack) btnBack.href = u;
    if(btnBackHub2) btnBackHub2.href = u;
  }
  setBackLinks();

  // ---------- anti-scroll (เล่นแล้วจอไม่เลื่อนหลุด) ----------
  function setPlayScrollLock(on){
    DOC.documentElement.style.overflow = on ? 'hidden' : '';
    DOC.body.style.overflow = on ? 'hidden' : '';
    DOC.body.style.overscrollBehavior = on ? 'none' : '';
  }
  function onTouchMove(e){
    if(S.running && !S.paused && !S.ended){
      e.preventDefault();
    }
  }
  DOC.addEventListener('touchmove', onTouchMove, { passive:false });

  // ---------- RNG ----------
  const rng = seededRng(ctx.seed);

  // ---------- Fun boost (optional) ----------
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

  // ---------- FX layer ----------
  let fx = null;
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

  // ---------- LOGGER (queue + flush-hardened) ----------
  // Supports:
  //  - POST JSON to LOG_ENDPOINT
  // Payload: { kind:'event'|'session', ... }
  const Logger = (function(){
    const q = [];
    const MAX_Q = 250;

    function canSend(){ return LOG_ENABLED && !!LOG_ENDPOINT; }

    function push(obj){
      if(!canSend()) return;
      q.push(obj);
      if(q.length > MAX_Q) q.splice(0, q.length - MAX_Q);
    }

    function postJson(payload){
      // keep alive if possible
      try{
        return fetch(LOG_ENDPOINT, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify(payload),
          keepalive:true
        });
      }catch(_){
        return Promise.resolve(null);
      }
    }

    function flush(reason){
      if(!canSend()) return Promise.resolve();
      if(!q.length) return Promise.resolve();

      const batch = q.splice(0, q.length);
      const payload = {
        kind: 'batch',
        projectTag: 'HeroHealth',
        game: 'brush',
        gameVersion: GAME_VERSION,
        runMode: ctx.run,
        pid: ctx.pid || '',
        studyId: ctx.studyId || '',
        phase: ctx.phase || '',
        conditionGroup: ctx.conditionGroup || '',
        sessionId: S.sessionId || '',
        reason: reason || 'flush',
        ts: Date.now(),
        items: batch
      };
      return postJson(payload).then(()=>{}).catch(()=>{});
    }

    // beacon-style fallback for unload (best effort)
    function flushBeacon(reason){
      if(!canSend()) return;
      if(!q.length) return;
      const batch = q.splice(0, q.length);
      const payload = {
        kind: 'batch',
        projectTag: 'HeroHealth',
        game: 'brush',
        gameVersion: GAME_VERSION,
        runMode: ctx.run,
        pid: ctx.pid || '',
        studyId: ctx.studyId || '',
        phase: ctx.phase || '',
        conditionGroup: ctx.conditionGroup || '',
        sessionId: S.sessionId || '',
        reason: reason || 'beacon',
        ts: Date.now(),
        items: batch
      };
      try{
        const blob = new Blob([JSON.stringify(payload)], { type:'application/json' });
        if(navigator.sendBeacon){
          navigator.sendBeacon(LOG_ENDPOINT, blob);
          return;
        }
      }catch(_){}
      // fallback try fetch keepalive
      postJson(payload);
    }

    return { push, flush, flushBeacon, canSend };
  })();

  function mkSessionId(){
    // deterministic-ish but unique: pid + seed + time + ts
    const a = String(ctx.pid||'anon').slice(0,18);
    const b = String(ctx.seed>>>0);
    return `BR-${a}-${b}-${Date.now()}`;
  }

  // ---------- State ----------
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
    hits:0,            // ✅ FIX: hits must increase on every successful hit
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
    targets: new Map(),

    sessionId: ''      // ✅ for logging
  };

  // diff tuning
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
  function randomInLayer(pad=56){
    const r = layerRect();
    return {
      x: pad + rng() * Math.max(10, (r.width - pad*2)),
      y: pad + rng() * Math.max(10, (r.height - pad*2))
    };
  }

  // ---------- Targets ----------
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

    const t = { id, el, type, bornMs: born, dieMs: die, hpMax, hp: hpMax, fillEl: fill, wsEl, weakX, weakY, weakR };
    if(type === 'boss') updateBossWeakspotPos(t);

    S.targets.set(id, t);
    el.addEventListener('pointerdown', onTargetPointerDown, { passive:false });

    layer.appendChild(el);
    updateHpVis(t);
    return t;
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
    Logger.push({ t:'judge', judge:'perfect', ts:Date.now(), score:S.score, combo:S.combo });
  }

  function burstPop(n){
    const arr = Array.from(S.targets.values()).filter(v => v.type==='plaque');
    for(let i=0;i<Math.min(n, arr.length);i++){
      const pick = arr[Math.floor(rng()*arr.length)];
      if(!pick) break;
      if(!S.targets.has(pick.id)) continue;

      // simulate hit
      S.hits += 1;
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.score += 1;
      S.clean = clamp(S.clean + S.cleanGainPerHit, 0, 100);
      removeTarget(pick.id, true);
    }
  }

  function applyHitRewards(t, remainMs, wasWeakspot){
    // ✅ FIX: hits increase here for ALL successful hits
    S.hits += 1;

    if(remainMs <= S.perfectWindowMs) onPerfect();
    else {
      fun?.onAction?.({ type:'hit' });
      Logger.push({ t:'judge', judge:'hit', ts:Date.now(), score:S.score, combo:S.combo });
    }

    S.combo += 1;
    S.comboMax = Math.max(S.comboMax, S.combo);

    const comboMul = 1 + Math.min(0.6, S.combo * 0.02);
    let base = (t.type==='boss') ? 3 : 1;
    if(wasWeakspot) base += 2;

    S.score += Math.round(base * comboMul * (director.feverOn ? 1.3 : 1.0));

    let gain = S.cleanGainPerHit * (t.type==='boss' ? 1.4 : 1.0) * (director.feverOn ? 1.25 : 1.0);
    if(wasWeakspot) gain *= 1.25;
    S.clean = clamp(S.clean + gain, 0, 100);

    if(director.feverOn && rng() < 0.18) burstPop(1);
  }

  function onMiss(kind){
    S.miss += 1;
    S.combo = 0;
    S.score = Math.max(0, S.score - (kind==='boss'? 2 : 1));
    S.clean = clamp(S.clean - S.cleanLosePerMiss, 0, 100);
    fun?.onAction?.({ type:'timeout' });
    Logger.push({ t:'miss', kind, ts:Date.now(), score:S.score, clean:S.clean });
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
      Logger.push({ t:'weakspot', ts:Date.now(), bossHp:`${t.hp}/${t.hpMax}` });
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
        Logger.push({ t:'boss_break', ts:Date.now(), nextBossAt:S.nextBossAt });
      }
    }

    renderHud(true);

    emit('hha:score', { score:S.score, combo:S.combo, miss:S.miss, clean:S.clean, ts:Date.now(), source });

    Logger.push({
      t:'hit',
      ts: Date.now(),
      source,
      kind: t.type,
      weak: !!weakHit,
      hp: (t.type==='boss' ? `${t.hp}/${t.hpMax}` : '1/1'),
      score: S.score,
      combo: S.combo,
      clean: Math.round(S.clean)
    });

    if(S.clean >= 100) endGame('clean');
  }

  function onTargetPointerDown(ev){
    if(!S.running || S.paused || S.ended) return;
    ev.preventDefault();
    const btn = ev.currentTarget;
    const id = btn?.dataset?.id;
    const t = id ? S.targets.get(id) : null;
    if(!t) return;

    S.totalShots++;
    handleHit(t, ev.clientX, ev.clientY, 'pointer');
  }

  // Aim assist from vr-ui hha:shoot
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
    let best=null, bestScore=Infinity;
    for(const t of S.targets.values()){
      const c = getTargetScreenCenter(t);
      if(!c) continue;
      const dynLock = getDynamicLockPx(baseLock, t, isCVR);

      if(t.type === 'boss'){
        const ws = getBossWeakspotScreenCenter(t);
        if(ws){
          const dxw=x-ws.x, dyw=y-ws.y;
          const d2w=dxw*dxw+dyw*dyw;
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

      const dx=x-c.x, dy=y-c.y;
      const d2=dx*dx+dy*dy;
      if(d2 <= dynLock*dynLock){
        let score = d2;
        if(isCVR && t.type==='boss') score *= 0.92;
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

    const d = ev?.detail || {};
    const x = toNum(d.x, WIN.innerWidth/2);
    const y = toNum(d.y, WIN.innerHeight/2);
    const baseLock = clamp(toNum(d.lockPx, 28), 6, 80);

    const isCVR = String(d.view || ctx.view || '').toLowerCase() === 'cvr'
      || String(ctx.view || '').toLowerCase() === 'cvr'
      || String(DOC.documentElement?.dataset?.view || '').toLowerCase() === 'cvr';

    const pick = nearestAssistPick(x, y, baseLock, isCVR);
    S.totalShots++;

    if(pick && pick.t){
      handleHit(pick.t, pick.aimX, pick.aimY, d.source || 'hha:shoot');
      return;
    }

    // miss shot
    S.miss++;
    S.combo = 0;
    fun?.onNearMiss?.({ reason:'whiff' });
    renderHud(true);
    toast('พลาด');
    Logger.push({ t:'whiff', ts:Date.now(), source:d.source||'shoot', x:Math.round(x), y:Math.round(y) });
  }
  WIN.addEventListener('hha:shoot', handleShootEvent);

  // ---------- spawn/tick ----------
  let spawnTimer=null, tickTimer=null;

  function clearTimers(){
    clearTimeout(spawnTimer);
    clearInterval(tickTimer);
    spawnTimer=null; tickTimer=null;
  }

  function spawnOne(){
    if(!S.running || S.paused || S.ended) return;

    director = fun ? fun.tick() : director;

    const {x,y} = randomInLayer(56);

    if(!S.bossActive && S.clean >= S.nextBossAt && S.clean < 100){
      S.bossActive = true;
      mkTarget({ x, y, type:'boss', hpMax: (ctx.diff==='hard'? 5 : ctx.diff==='easy'? 3 : 4) });
      toast('💎 BOSS PLAQUE!');
      fxLaser();

      Logger.push({ t:'boss_start', ts:Date.now(), hpMax:(ctx.diff==='hard'?5:ctx.diff==='easy'?3:4) });

      return;
    }

    mkTarget({ x, y, type:'plaque', hpMax: 1 });
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

    // timeouts
    for(const [id,tt] of S.targets){
      if(t >= tt.dieMs){
        removeTarget(id, false);
        if(tt.type==='boss'){
          S.bossActive = false;
          toast('💎 Boss หลุด!');
          Logger.push({ t:'boss_escape', ts:Date.now() });
        }
        onMiss(tt.type);
      }
    }

    // time left
    const elapsed = (t - S.t0)/1000;
    const left = ctx.time - elapsed;

    emit('hha:time', { t: Math.max(0,left), elapsed, ts: Date.now() });

    // time event logging (rate limited)
    if(LOG_ENABLED && Math.floor(elapsed*10) % 10 === 0){ // ~ทุก 1s
      Logger.push({
        t:'time',
        ts: Date.now(),
        left: Math.round(Math.max(0,left)*10)/10,
        score: S.score,
        combo: S.combo,
        miss: S.miss,
        clean: Math.round(S.clean)
      });
    }

    if(left <= 10.3 && left >= 9.7){
      fxFin(true);
      setTimeout(()=>fxFin(false), 900);
    }

    renderHud();

    if(left <= 0) endGame('time');
  }

  // ---------- start/end ----------
  function startGame(){
    S.running=true; S.paused=false; S.ended=false;
    S.t0 = now();

    S.score=0; S.combo=0; S.comboMax=0; S.miss=0;
    S.totalShots=0; S.hits=0; S.clean=0;

    S.nextBossAt = S.bossEveryPct;
    S.bossActive=false;

    S.sessionId = mkSessionId();

    for(const [id] of S.targets) removeTarget(id,false);
    S.targets.clear();

    if(end){ end.hidden = true; end.style.display='none'; }
    if(menu){ menu.style.display='none'; }

    wrap.dataset.state='play';
    setPlayScrollLock(true);

    toast('เริ่ม! แปรงคราบให้ทัน!');
    renderHud(true);

    emit('hha:start', {
      game:'brush', category:'hygiene',
      pid: ctx.pid, studyId: ctx.studyId, phase: ctx.phase, conditionGroup: ctx.conditionGroup,
      seed: ctx.seed, diff: ctx.diff, view: ctx.view,
      timePlannedSec: ctx.time,
      sessionId: S.sessionId,
      gameVersion: GAME_VERSION,
      ts: Date.now()
    });

    // logger start
    Logger.push({
      t:'start',
      ts: Date.now(),
      sessionId: S.sessionId,
      runMode: ctx.run,
      diff: ctx.diff,
      view: ctx.view,
      timePlannedSec: ctx.time,
      seed: ctx.seed,
      pid: ctx.pid||''
    });

    clearTimers();
    scheduleSpawn();
    tickTimer = setInterval(tick, 80);
  }

  function endGame(reason){
    if(S.ended) return;
    S.ended=true; S.running=false;

    clearTimers();
    setPlayScrollLock(false);

    for(const [id] of S.targets) removeTarget(id,false);
    S.targets.clear();

    const acc = (S.totalShots > 0) ? (S.hits / S.totalShots) * 100 : 0;
    const grade = gradeFromAcc(acc);
    const elapsed = Math.min(ctx.time, (now() - S.t0)/1000);

    const summary = {
      projectTag:'HeroHealth',
      game:'brush',
      category:'hygiene',
      gameVersion: GAME_VERSION,

      reason,
      runMode: ctx.run,

      pid: ctx.pid,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,

      seed: ctx.seed,
      diff: ctx.diff,
      view: ctx.view,

      sessionId: S.sessionId,

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

    // save last summary + history
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const k='HHA_SUMMARY_HISTORY';
      const arr = tryJson(localStorage.getItem(k) || '[]', []);
      arr.push(summary);
      localStorage.setItem(k, JSON.stringify(arr.slice(-40)));
    }catch(_){}

    // daily gate
    try{ localStorage.setItem(`HHA_ZONE_DONE::hygiene::${ymdLocal()}`, '1'); }catch(_){}

    emit('hha:end', { summary });

    // logger end
    Logger.push({ t:'end', ts:Date.now(), reason, summary });
    Logger.flush('end');

    // UI summary
    if(sScore) sScore.textContent = String(summary.score);
    if(sAcc)   sAcc.textContent   = `${summary.accuracyPct}%`;
    if(sMiss)  sMiss.textContent  = String(summary.miss);
    if(sCombo) sCombo.textContent = String(summary.comboMax);
    if(sClean) sClean.textContent = `${summary.cleanPct}%`;
    if(sTime)  sTime.textContent  = `${summary.timePlayedSec}s`;
    if(endGrade) endGrade.textContent = summary.grade;
    if(endNote) endNote.textContent = `reason=${reason} | seed=${summary.seed} | diff=${summary.diff} | view=${summary.view} | pid=${summary.pid||'-'} | session=${summary.sessionId||'-'}`;

    if(end){ end.hidden = false; end.style.display='grid'; }
    if(menu){ menu.style.display='none'; }
    wrap.dataset.state='end';

    toast(reason==='clean' ? '🦷 สะอาดแล้ว! เยี่ยม!' : 'หมดเวลา!');
  }

  function togglePause(){
    if(!S.running || S.ended) return;
    S.paused = !S.paused;
    if(btnPause) btnPause.textContent = S.paused ? 'Resume' : 'Pause';
    toast(S.paused ? '⏸ Pause' : '▶ Resume');
    Logger.push({ t:'pause', ts:Date.now(), paused:S.paused });
  }

  // ---------- safe exit (Back Hub) ----------
  function safeExitToHub(){
    const hubUrl = buildHubUrl();
    // log exit
    Logger.push({ t:'exit', ts:Date.now(), to:'hub' });

    // best-effort flush before leaving
    Logger.flushBeacon('exit_to_hub');

    // go
    location.href = hubUrl;
  }

  // override default <a> back buttons to flush first
  function bindBackFlush(a){
    if(!a) return;
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      safeExitToHub();
    }, {passive:false});
  }
  bindBackFlush(btnBack);
  bindBackFlush(btnBackHub2);

  // ---------- controls ----------
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRetry?.addEventListener('click', startGame, { passive:true });

  btnPause?.addEventListener('click', togglePause, { passive:true });

  btnHow?.addEventListener('click', ()=>{
    toast('แตะ/ยิง 🦠 ให้ทัน • บอส 💎 ต้องหลายครั้ง • ยิงจุดอ่อน 🎯 แรงกว่า!');
  }, { passive:true });

  btnRecenter?.addEventListener('click', ()=>{
    WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts:Date.now() } }));
    toast('Recenter');
    Logger.push({ t:'recenter', ts:Date.now() });
  }, { passive:true });

  // layer click fallback (avoid double count with .br-t)
  layer?.addEventListener('pointerdown', (ev)=>{
    if(!S.running || S.paused || S.ended) return;
    const t = ev.target;
    if(t && t.closest && t.closest('.br-t')) return;
    if(String(ctx.view).toLowerCase() === 'cvr') return;

    S.totalShots++;
    // simple assist: pick nearest target within 20px lock
    const x = ev.clientX, y = ev.clientY;
    let best=null, bestD=1e9;
    for(const tt of S.targets.values()){
      const c = getTargetScreenCenter(tt);
      if(!c) continue;
      const dx=x-c.x, dy=y-c.y;
      const d2=dx*dx+dy*dy;
      if(d2 < bestD){ bestD=d2; best=tt; }
    }
    if(best && bestD <= 20*20) handleHit(best, x, y, 'layer');
    else { S.miss++; S.combo=0; fun?.onNearMiss?.({ reason:'whiff_layer' }); renderHud(true); toast('พลาด'); }
  }, { passive:true });

  // ---------- spawn/tick wiring ----------
  // flush-hardened for tab close / background
  function hardenFlush(reason){
    if(S.ended) return;
    // don't force end on background, but flush queue
    Logger.flushBeacon(reason || 'pagehide');
  }
  WIN.addEventListener('pagehide', ()=> hardenFlush('pagehide'), {passive:true});
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') hardenFlush('hidden');
  }, {passive:true});
  WIN.addEventListener('beforeunload', ()=> hardenFlush('beforeunload'));

  // ---------- init (no autostart) ----------
  renderHud(true);
  if(end){ end.hidden = true; end.style.display='none'; }
  if(menu){ menu.style.display='grid'; }
  wrap.dataset.state='menu';

  toast(LOG_ENABLED ? 'พร้อมแล้ว! (Logging ON)' : 'พร้อมแล้ว! กดเริ่มเกมได้เลย');
})();