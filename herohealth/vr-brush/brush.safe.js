// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE — Plaque Breaker (PATCH v20260222b)
// ✅ Exposes window.BrushVR.boot(ctx)
// ✅ No auto-start on script load
// ✅ Mobile/PC/cVR safe
// ✅ Double-fire guard (pointer + hha:shoot)
// ✅ DOM-safe references
// ✅ Summary + Back HUB + HHA events + last summary

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__BRUSH_SAFE_PATCHED__) return;
  WIN.__BRUSH_SAFE_PATCHED__ = true;

  // ---------------------------
  // Helpers
  // ---------------------------
  const $ = (s)=> DOC.querySelector(s);
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const safeNum = (x,d=0)=> {
    const n = Number(x);
    return Number.isFinite(n) ? n : d;
  };
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  function ymdLocal(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function getQS(){
    try { return new URL(location.href).searchParams; }
    catch(_) { return new URLSearchParams(); }
  }

  function toast(msg){
    const el = $('#toast');
    if(!el) return;
    el.textContent = String(msg || '');
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> {
      try{ el.classList.remove('show'); }catch(_){}
    }, 1200);
  }

  function fatal(msg){
    const el = $('#fatal');
    if(!el){
      try { alert(msg); } catch(_){}
      return;
    }
    el.textContent = String(msg || 'Unknown error');
    el.classList.remove('br-hidden');
  }

  WIN.addEventListener('error', (e)=>{
    fatal(
      'JS ERROR:\n' +
      (e?.message || e) + '\n\n' +
      (e?.filename || '') + ':' + (e?.lineno || '') + ':' + (e?.colno || '')
    );
  });

  WIN.addEventListener('unhandledrejection', (e)=>{
    fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
  });

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
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail })); }
    catch(_){}
  }

  function gradeFromAcc(acc){
    if(acc >= 92) return 'S';
    if(acc >= 82) return 'A';
    if(acc >= 70) return 'B';
    if(acc >= 55) return 'C';
    return 'D';
  }

  function getViewAuto(){
    const qs = getQS();
    const v = String(qs.get('view') || '').toLowerCase();
    if (v) return v;
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) ||
      (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'cvr' : 'pc';
  }

  function passHubUrl(ctx){
    const qs = getQS();
    return qs.get('hub') || ctx.hub || '../hub.html';
  }

  // ---------------------------
  // Module state / singleton engine
  // ---------------------------
  const Engine = {
    booted: false,
    boundShoot: false,
    boundLayerPointer: false,
    mountedFX: false,
    dom: {},
    ctx: null,
    qs: null,
    rng: null,
    fun: null,
    director: { spawnMul:1, timeScale:1, wave:'calm', intensity:0, feverOn:false },

    spawnTimer: null,
    tickTimer: null,

    lastInputAt: 0,       // cross-source double fire guard
    lastPointerShotAt: 0, // extra guard

    st: {
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
      targets: new Map()
    }
  };

  // ---------------------------
  // DOM refs
  // ---------------------------
  function cacheDom(){
    Engine.dom = {
      wrap: $('#br-wrap'),
      layer: $('#br-layer'),

      menu: $('#br-menu'),
      end: $('#br-end'),

      btnStart: $('#btnStart'),
      btnBack: $('#btnBack'),
      btnBackHub2: $('#btnBackHub2'),
      btnRetry: $('#btnRetry'),
      btnHow: $('#btnHow'),
      btnPause: $('#btnPause'),
      btnRecenter: $('#btnRecenter'),

      tScore: $('#tScore'),
      tCombo: $('#tCombo'),
      tMiss: $('#tMiss'),
      tTime: $('#tTime'),

      tClean: $('#tClean'),
      bClean: $('#bClean'),
      tFever: $('#tFever'),
      bFever: $('#bFever'),

      ctxView: $('#br-ctx-view'),
      ctxSeed: $('#br-ctx-seed'),
      ctxTime: $('#br-ctx-time'),
      diffTag: $('#br-diffTag'),

      mDiff: $('#mDiff'),
      mTime: $('#mTime'),

      sScore: $('#sScore'),
      sAcc: $('#sAcc'),
      sMiss: $('#sMiss'),
      sCombo: $('#sCombo'),
      sClean: $('#sClean'),
      sTime: $('#sTime'),
      endGrade: $('#endGrade'),
      endNote: $('#endNote')
    };
  }

  function mustHaveCoreDom(){
    return !!(Engine.dom.wrap && Engine.dom.layer && Engine.dom.menu && Engine.dom.end);
  }

  function setText(el, v){ if(el) el.textContent = String(v); }
  function setWidth(el, pct){ if(el) el.style.width = `${clamp(Number(pct)||0,0,100)}%`; }

  function layerRect(){
    const r = Engine.dom.layer?.getBoundingClientRect?.();
    if (r && Number.isFinite(r.width) && r.width > 0 && Number.isFinite(r.height) && r.height > 0) return r;
    // fallback rectangle to avoid NaN spawn positions
    return { left:0, top:0, width: Math.max(320, WIN.innerWidth||360), height: Math.max(260, WIN.innerHeight||640) };
  }

  // ---------------------------
  // Fun boost (optional)
  // ---------------------------
  function initFun(ctx, qs){
    try{
      if (WIN.HHA?.createFunBoost){
        Engine.fun = WIN.HHA.createFunBoost({
          seed: (qs.get('seed') || ctx.pid || 'brush'),
          baseSpawnMul: 1.0,
          waveCycleMs: 20000,
          feverThreshold: 18,
          feverDurationMs: 6800,
          feverSpawnBoost: 1.18,
          feverTimeScale: 0.92
        });
        Engine.director = Engine.fun.tick?.() || Engine.director;
      } else {
        Engine.fun = null;
      }
    }catch(_){
      Engine.fun = null;
    }
  }

  // ---------------------------
  // FX Layer (optional visual spice)
  // ---------------------------
  function ensureFxLayer(){
    if (Engine.mountedFX) return;
    Engine.mountedFX = true;

    let fx = DOC.getElementById('br-fx');
    if (!fx){
      fx = DOC.createElement('div');
      fx.id = 'br-fx';
      fx.innerHTML = `
        <div class="fx-flash" id="fxFlash"></div>
        <div class="fx-laser" id="fxLaser"></div>
        <div class="fx-fin" id="fxFin"></div>
      `;
      DOC.body.appendChild(fx);
    }
  }

  function fxPulse(id, ms){
    const el = DOC.getElementById(id);
    if(!el) return;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(()=> {
      try{ el.classList.remove('on'); }catch(_){}
    }, ms || 180);
  }

  function fxShockAt(x, y){
    const root = DOC.getElementById('br-fx');
    if(!root) return;
    const ring = DOC.createElement('div');
    ring.className = 'fx-shock on';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    root.appendChild(ring);
    setTimeout(()=>{ try{ ring.remove(); }catch(_){} }, 420);
  }

  // ---------------------------
  // Game logic
  // ---------------------------
  function tuneByDiff(){
    const st = Engine.st;
    const ctx = Engine.ctx;

    // defaults
    st.baseSpawnMs = 760;
    st.ttlMs = 1650;
    st.perfectWindowMs = 220;
    st.cleanGainPerHit = 1.2;
    st.cleanLosePerMiss = 0.6;
    st.bossEveryPct = 28;

    if(ctx.diff === 'easy'){
      st.baseSpawnMs = 900;
      st.ttlMs = 1950;
      st.perfectWindowMs = 260;
      st.cleanGainPerHit = 1.35;
      st.cleanLosePerMiss = 0.45;
      st.bossEveryPct = 30;
    }else if(ctx.diff === 'hard'){
      st.baseSpawnMs = 650;
      st.ttlMs = 1450;
      st.perfectWindowMs = 200;
      st.cleanGainPerHit = 1.05;
      st.cleanLosePerMiss = 0.75;
      st.bossEveryPct = 24;
    }
  }

  function hud(force){
    const { st, ctx, dom, fun } = Engine;
    const t = now();
    if(!force && (t - st.lastHud < 60)) return;
    st.lastHud = t;

    setText(dom.tScore, st.score);
    setText(dom.tCombo, st.combo);
    setText(dom.tMiss, st.miss);

    const elapsed = st.running ? ((t - st.t0)/1000) : 0;
    const left = st.running ? Math.max(0, ctx.time - elapsed) : ctx.time;
    setText(dom.tTime, left.toFixed(0));

    const clean = clamp(st.clean, 0, 100);
    setText(dom.tClean, `${Math.round(clean)}%`);
    setWidth(dom.bClean, clean);

    const fb = fun?.getState?.()?.feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = Engine.director.feverOn ? 100 : clamp((fb / th) * 100, 0, 100);

    setText(dom.tFever, Engine.director.feverOn ? 'ON' : 'OFF');
    setWidth(dom.bFever, pct);
  }

  function updateHudMeta(){
    const { dom, ctx } = Engine;
    if (!dom.wrap) return;

    dom.wrap.dataset.view = ctx.view;
    setText(dom.ctxView, ctx.view);
    setText(dom.ctxSeed, String((ctx.seed >>> 0)));
    setText(dom.ctxTime, `${ctx.time}s`);
    setText(dom.diffTag, ctx.diff);
    setText(dom.mDiff, ctx.diff);
    setText(dom.mTime, `${ctx.time}s`);

    try { DOC.body.setAttribute('data-view', ctx.view); } catch(_){}
    try { DOC.documentElement.dataset.view = ctx.view; } catch(_){}
  }

  function setBackLinks(){
    const { dom, ctx } = Engine;
    const hubUrl = passHubUrl(ctx);
    const refs = [dom.btnBack, dom.btnBackHub2].filter(Boolean);

    for (const a of refs){
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

  function updateHpVis(it){
    if(!it?.fillEl) return;
    const pct = clamp((it.hp / it.hpMax) * 100, 0, 100);
    it.fillEl.style.width = pct + '%';
  }

  function addWeakSpot(it){
    if(!it || it.kind !== 'boss' || !it.el) return;
    if (it.wsEl) return;
    const ws = DOC.createElement('div');
    ws.className = 'br-ws';
    it.el.appendChild(ws);
    it.wsEl = ws;
    moveWeakSpot(it);
  }

  function moveWeakSpot(it){
    if(!it?.wsEl || !it?.el) return;
    const rng = Engine.rng;
    // weakspot position in boss disc
    const ang = rng() * Math.PI * 2;
    const rad = 16 + rng() * 14;
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad;
    it.wsX = x; // local offset from center
    it.wsY = y;
    it.wsEl.style.left = `calc(50% + ${x}px)`;
    it.wsEl.style.top  = `calc(50% + ${y}px)`;
  }

  function removeTarget(id, popped){
    const { st } = Engine;
    const it = st.targets.get(id);
    if(!it) return;
    st.targets.delete(id);

    const el = it.el;
    if(!el) return;

    if(popped) el.classList.add('pop');
    el.classList.add('fade');

    setTimeout(()=> {
      try{ el.remove(); }catch(_){}
    }, 220);
  }

  function mkTarget({x,y,kind,hpMax}){
    const { st, dom } = Engine;
    if (!dom.layer) return;

    const id = String(++st.uid);
    const el = DOC.createElement('div');
    el.className = 'br-t' + (kind === 'boss' ? ' thick' : '');
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    const emo = DOC.createElement('div');
    emo.className = 'emo';
    emo.textContent = (kind === 'boss') ? '💎' : '🦠';
    el.appendChild(emo);

    const hp = DOC.createElement('div');
    hp.className = 'hp';
    const fill = DOC.createElement('i');
    hp.appendChild(fill);
    el.appendChild(hp);

    const born = now();
    const ttl = st.ttlMs * (Engine.director.timeScale || 1);
    const die = born + ttl;

    const it = {
      id, el, kind,
      bornMs: born,
      dieMs: die,
      hpMax,
      hp: hpMax,
      fillEl: fill,
      wsEl: null,
      wsX: 0,
      wsY: 0
    };

    if (kind === 'boss'){
      addWeakSpot(it);
      emit('brush:ai', { type:'boss_start', ts: Date.now() });
    }

    st.targets.set(id, it);

    // direct target pointer hit (PC/Mobile only; cVR strict handled via vr-ui -> hha:shoot)
    el.addEventListener('pointerdown', (ev)=>{
      if (Engine.ctx.view === 'cvr') return;
      ev.preventDefault();
      ev.stopPropagation();
      onHitAt(ev.clientX, ev.clientY, { source:'target', targetId:id });
    }, { passive:false });

    dom.layer.appendChild(el);
  }

  function spawnOne(){
    const { st, dom, rng } = Engine;
    if(!st.running || st.paused || st.over || !dom.layer) return;

    Engine.director = Engine.fun ? (Engine.fun.tick?.() || Engine.director) : Engine.director;

    const r = layerRect();

    // avoid tiny/invalid playfield causing instant timeout weirdness
    const w = Math.max(260, r.width || 0);
    const h = Math.max(220, r.height || 0);

    const pad = 56;
    const x = pad + rng() * Math.max(10, (w - pad*2));
    const y = pad + 22 + rng() * Math.max(10, (h - pad*2 - 22));

    // Boss rule
    if(!st.bossActive && st.clean >= st.nextBossAt && st.clean < 100){
      st.bossActive = true;
      mkTarget({
        x, y, kind:'boss',
        hpMax: (Engine.ctx.diff === 'hard' ? 5 : Engine.ctx.diff === 'easy' ? 3 : 4)
      });
      toast('💎 BOSS PLAQUE!');
      emit('hha:coach', { msg:'เจอบอสคราบหนา! ยิง/แตะหลายครั้งให้แตก!', ts: Date.now() });
      return;
    }

    mkTarget({ x, y, kind:'plaque', hpMax:1 });
  }

  function onPerfect(){
    Engine.fun?.onAction?.({ type:'perfect' });
    Engine.st.score += 2;
    toast('✨ Perfect!');
    fxPulse('fxFlash', 120);
  }

  function onHitTarget(it, remainMs){
    const { st } = Engine;

    st.hits += 1;

    if(remainMs <= st.perfectWindowMs) onPerfect();
    else Engine.fun?.onAction?.({ type:'hit' });

    st.combo += 1;
    st.comboMax = Math.max(st.comboMax, st.combo);

    const comboMul = 1 + Math.min(0.6, st.combo * 0.02);
    const base = (it.kind === 'boss') ? 3 : 1;
    st.score += Math.round(base * comboMul * (Engine.director.feverOn ? 1.3 : 1.0));

    const gain = st.cleanGainPerHit * (it.kind === 'boss' ? 1.4 : 1.0) * (Engine.director.feverOn ? 1.25 : 1.0);
    st.clean = clamp(st.clean + gain, 0, 100);

    // fever bonus pop
    if(Engine.director.feverOn && Engine.rng() < 0.18){
      burstPop(1);
    }
  }

  function onMiss(kind){
    const { st } = Engine;
    st.miss += 1;
    st.combo = 0;
    st.score = Math.max(0, st.score - (kind === 'boss' ? 2 : 1));
    st.clean = clamp(st.clean - st.cleanLosePerMiss, 0, 100);
    Engine.fun?.onAction?.({ type:'timeout' });
  }

  function burstPop(n){
    const { st } = Engine;
    const plaques = Array.from(st.targets.entries()).filter(([,v]) => v.kind === 'plaque');
    for(let i=0; i<Math.min(n, plaques.length); i++){
      const pick = plaques[Math.floor(Engine.rng() * plaques.length)];
      if(!pick) break;
      const [id, it] = pick;
      if(!st.targets.has(id)) continue;
      onHitTarget(it, 0);
      removeTarget(id, true);
    }
  }

  function hitTest(x, y){
    const { st } = Engine;

    let best = null;
    let bestD = 1e9;
    let bestWeak = false;

    for(const [id, it] of st.targets){
      const ex = parseFloat(it.el?.style.left || '0');
      const ey = parseFloat(it.el?.style.top  || '0');

      // core hit radius
      const rad = (it.kind === 'boss') ? 54 : 44;
      const dx = ex - x;
      const dy = ey - y;
      const d2 = dx*dx + dy*dy;

      if (d2 > rad*rad) continue;

      let weakHit = false;
      if (it.kind === 'boss'){
        // weak spot check (bonus accuracy / damage feel)
        const wdx = (ex + (it.wsX||0)) - x;
        const wdy = (ey + (it.wsY||0)) - y;
        weakHit = (wdx*wdx + wdy*wdy) <= (18*18);
      }

      // prefer weakspot boss hit if same area
      const score = d2 - (weakHit ? 400 : 0);
      if (score < bestD){
        bestD = score;
        best = { id, it };
        bestWeak = weakHit;
      }
    }

    return best ? { ...best, weakHit: bestWeak } : null;
  }

  function endGame(reason){
    const { st, ctx, dom } = Engine;
    if(st.over) return;

    st.over = true;
    st.running = false;

    clearTimeout(Engine.spawnTimer);
    clearInterval(Engine.tickTimer);
    Engine.spawnTimer = null;
    Engine.tickTimer = null;

    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();
    st.bossActive = false;

    const acc = (st.shots > 0) ? (st.hits / st.shots) * 100 : 0;
    const grade = gradeFromAcc(acc);
    const elapsed = Math.min(ctx.time, (now() - st.t0) / 1000);

    const summary = {
      game:'brush',
      category:'hygiene',
      reason,
      pid: ctx.pid || '',
      studyId: ctx.studyId || '',
      phase: ctx.phase || '',
      conditionGroup: ctx.conditionGroup || '',
      seed: ctx.seed,
      diff: ctx.diff,
      view: ctx.view,

      score: st.score,
      comboMax: st.comboMax,
      miss: st.miss,
      shots: st.shots,
      hits: st.hits,
      accuracyPct: Math.round(acc * 10) / 10,
      grade,

      cleanPct: Math.round(clamp(st.clean, 0, 100)),
      timePlannedSec: ctx.time,
      timePlayedSec: Math.round(elapsed * 10) / 10,

      date: ymdLocal(),
      ts: Date.now()
    };

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const k = 'HHA_SUMMARY_HISTORY';
      const arr = JSON.parse(localStorage.getItem(k) || '[]');
      arr.push(summary);
      localStorage.setItem(k, JSON.stringify(arr.slice(-30)));
    }catch(_){}

    try{
      localStorage.setItem(`HHA_ZONE_DONE::hygiene::${ymdLocal()}`, '1');
    }catch(_){}

    emit('hha:judge', { ...summary });
    emit('hha:end', { ...summary });

    setText(dom.sScore, summary.score);
    setText(dom.sAcc, `${summary.accuracyPct}%`);
    setText(dom.sMiss, summary.miss);
    setText(dom.sCombo, summary.comboMax);
    setText(dom.sClean, `${summary.cleanPct}%`);
    setText(dom.sTime, `${summary.timePlayedSec}s`);
    setText(dom.endGrade, summary.grade);
    setText(dom.endNote,
      `reason=${reason} | seed=${summary.seed} | diff=${summary.diff} | view=${summary.view} | pid=${summary.pid || '-'}`
    );

    if (dom.end) dom.end.hidden = false;
    if (dom.menu) dom.menu.style.display = 'none';
    if (dom.wrap) dom.wrap.dataset.state = 'end';

    toast(reason === 'clean' ? '🦷 สะอาดแล้ว! เยี่ยม!' : 'หมดเวลา!');
  }

  function onHitAt(x, y, meta){
    const { st } = Engine;
    if(!st.running || st.paused || st.over) return;

    // global anti-double-fire (e.g., pointer + hha:shoot same tap)
    const t = now();
    if (t - Engine.lastInputAt < 45) return;
    Engine.lastInputAt = t;

    st.shots += 1;

    const hit = hitTest(x, y);
    if(!hit){
      st.combo = 0;
      st.miss += 1;
      st.score = Math.max(0, st.score - 1);
      Engine.fun?.onNearMiss?.({ reason:'whiff', source: meta?.source || 'unknown' });
      hud(true);
      return;
    }

    const { id, it, weakHit } = hit;
    const remain = it.dieMs - t;

    // damage
    let dmg = 1;
    if (it.kind === 'boss' && weakHit){
      dmg = 2; // weakspot bonus
      it.el?.classList?.add('ws-hit');
      setTimeout(()=>{ try{ it.el?.classList?.remove('ws-hit'); }catch(_){} }, 180);
      emit('brush:ai', { type:'gate_break', ts: Date.now() }); // ใช้เป็น “big moment” ได้
    }

    it.hp = Math.max(0, it.hp - dmg);
    updateHpVis(it);

    onHitTarget(it, remain);

    // FX
    fxShockAt(x, y);

    if(it.hp <= 0){
      removeTarget(id, true);

      if(it.kind === 'boss'){
        st.bossActive = false;
        st.nextBossAt = Math.min(100, st.nextBossAt + st.bossEveryPct);
        toast('💥 Boss แตก!');
        emit('hha:coach', { msg:'เยี่ยม! คราบหนาแตกแล้ว ไปต่อ!', ts: Date.now() });
        emit('brush:ai', { type:'finisher_on', ts: Date.now() });
        fxPulse('fxFin', 200);
      }
    } else {
      if (it.kind === 'boss'){
        moveWeakSpot(it);
      }
    }

    hud(true);
    emit('hha:score', {
      score: st.score,
      combo: st.combo,
      miss: st.miss,
      clean: st.clean,
      ts: Date.now()
    });

    if(st.clean >= 100){
      endGame('clean');
    }
  }

  function tick(){
    const { st, ctx } = Engine;
    if(!st.running || st.paused || st.over) return;

    Engine.director = Engine.fun ? (Engine.fun.tick?.() || Engine.director) : Engine.director;

    const t = now();

    // target timeout
    for(const [id, it] of Array.from(st.targets.entries())){
      if(t >= it.dieMs){
        removeTarget(id, false);
        if(it.kind === 'boss'){
          st.bossActive = false;
          toast('💎 Boss หลุด!');
        }
        onMiss(it.kind);
      }
    }

    const elapsed = (t - st.t0) / 1000;
    const left = ctx.time - elapsed;

    emit('hha:time', { t: Math.max(0,left), elapsed, ts: Date.now() });

    if (Math.ceil(left) === 10 && !tick._time10sFired){
      tick._time10sFired = true;
      emit('brush:ai', { type:'time_10s', ts: Date.now() });
    }

    hud();

    if(left <= 0){
      endGame('time');
    }
  }

  function scheduleSpawn(){
    const { st } = Engine;
    clearTimeout(Engine.spawnTimer);
    if(!st.running || st.paused || st.over) return;

    const base = st.baseSpawnMs;
    const every = Engine.fun?.scaleIntervalMs?.(base, Engine.director) || base;

    Engine.spawnTimer = setTimeout(()=>{
      spawnOne();
      scheduleSpawn();
    }, Math.max(120, every));
  }

  function clearTargetsNow(){
    const { st } = Engine;
    for(const [id] of Array.from(st.targets.entries())){
      removeTarget(id, false);
    }
    st.targets.clear();
  }

  function startGame(){
    const { st, dom, ctx } = Engine;
    if (!mustHaveCoreDom()) return;

    // If overlay end is showing, hide first
    if (dom.end) dom.end.hidden = true;
    if (dom.menu) dom.menu.style.display = 'none';

    // Reset tick special flags
    tick._time10sFired = false;

    // Reset runtime
    st.running = true;
    st.paused  = false;
    st.over    = false;

    st.t0 = now();
    st.lastHud = 0;

    st.score = 0;
    st.combo = 0;
    st.comboMax = 0;
    st.miss = 0;
    st.shots = 0;
    st.hits = 0;

    st.clean = 0;
    st.uid = 0;
    st.nextBossAt = st.bossEveryPct;
    st.bossActive = false;

    clearTargetsNow();

    if (dom.wrap) dom.wrap.dataset.state = 'play';
    if (dom.btnPause) dom.btnPause.textContent = 'Pause';

    // reset anti-double-fire time
    Engine.lastInputAt = 0;
    Engine.lastPointerShotAt = 0;

    // warm-up spawn a little later so no weird instant timeout on slow mobile paint
    clearTimeout(Engine.spawnTimer);
    clearInterval(Engine.tickTimer);

    hud(true);
    toast('เริ่ม! แปรงคราบให้ทัน!');
    emit('brush:ai', { type:'boss_phase', phase: 1, hp: 100, ts: Date.now() }); // optional opener vibe (small HUD only)

    emit('hha:start', {
      game:'brush',
      category:'hygiene',
      pid: ctx.pid || '',
      studyId: ctx.studyId || '',
      phase: ctx.phase || '',
      conditionGroup: ctx.conditionGroup || '',
      seed: ctx.seed,
      diff: ctx.diff,
      view: ctx.view,
      timePlannedSec: ctx.time,
      ts: Date.now()
    });

    // Delay first spawn slightly after layout settled (prevents instant miss on some mobile browsers)
    Engine.spawnTimer = setTimeout(()=>{
      if (!st.running || st.paused || st.over) return;
      spawnOne();
      scheduleSpawn();
    }, 260);

    Engine.tickTimer = setInterval(tick, 80);
  }

  function togglePause(){
    const { st, dom } = Engine;
    if(!st.running || st.over) return;
    st.paused = !st.paused;
    if (dom.btnPause) dom.btnPause.textContent = st.paused ? 'Resume' : 'Pause';
    toast(st.paused ? '⏸ Pause' : '▶ Resume');

    if(!st.paused){
      scheduleSpawn();
    } else {
      clearTimeout(Engine.spawnTimer);
    }
  }

  // ---------------------------
  // Input wiring
  // ---------------------------
  function wireControlsOnce(){
    const { dom } = Engine;

    if (dom.btnStart && !dom.btnStart.__wired){
      dom.btnStart.__wired = true;
      dom.btnStart.addEventListener('click', startGame, { passive:true });
    }

    if (dom.btnRetry && !dom.btnRetry.__wired){
      dom.btnRetry.__wired = true;
      dom.btnRetry.addEventListener('click', startGame, { passive:true });
    }

    if (dom.btnPause && !dom.btnPause.__wired){
      dom.btnPause.__wired = true;
      dom.btnPause.addEventListener('click', togglePause, { passive:true });
    }

    if (dom.btnHow && !dom.btnHow.__wired){
      dom.btnHow.__wired = true;
      dom.btnHow.addEventListener('click', ()=>{
        toast('แตะ/ยิง “🦠” ให้ทัน • คราบหนา “💎” ต้องหลายครั้ง • ใกล้หมดเวลา = Perfect!');
      }, { passive:true });
    }

    if (dom.btnRecenter && !dom.btnRecenter.__wired){
      dom.btnRecenter.__wired = true;
      dom.btnRecenter.addEventListener('click', ()=>{
        try{
          WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts: Date.now() } }));
        }catch(_){}
        toast('Recenter');
      }, { passive:true });
    }

    // layer pointer fallback (PC/mobile only)
    if (dom.layer && !Engine.boundLayerPointer){
      Engine.boundLayerPointer = true;
      dom.layer.addEventListener('pointerdown', (ev)=>{
        if (Engine.ctx?.view === 'cvr') return;  // cVR strict uses hha:shoot
        if (!Engine.st.running || Engine.st.paused || Engine.st.over) return;

        // guard duplicate with target pointer
        const t = now();
        if (t - Engine.lastPointerShotAt < 45) return;
        Engine.lastPointerShotAt = t;

        onHitAt(ev.clientX, ev.clientY, { source:'layer' });
      }, { passive:true });
    }

    // hha:shoot from vr-ui.js
    if (!Engine.boundShoot){
      Engine.boundShoot = true;
      WIN.addEventListener('hha:shoot', (ev)=>{
        const d = ev?.detail || {};
        const x = safeNum(d.x, NaN);
        const y = safeNum(d.y, NaN);
        if(!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (!Engine.st.running || Engine.st.paused || Engine.st.over) return;
        onHitAt(x, y, { source:'shoot' });
      });
    }
  }

  // ---------------------------
  // Public API
  // ---------------------------
  function normalizeCtx(inCtx){
    const qs = getQS();

    const ctx = {
      hub: (inCtx?.hub || qs.get('hub') || '../hub.html'),
      run: String(inCtx?.run || qs.get('run') || qs.get('mode') || 'play').toLowerCase(),
      view: String(inCtx?.view || qs.get('view') || getViewAuto()).toLowerCase(),
      diff: String(inCtx?.diff || qs.get('diff') || 'normal').toLowerCase(),
      time: safeNum(inCtx?.time ?? qs.get('time'), 80),
      seed: safeNum(inCtx?.seed ?? qs.get('seed'), Date.now()),
      pid: String(inCtx?.pid || qs.get('pid') || qs.get('participantId') || '').trim(),
      studyId: String(inCtx?.studyId || qs.get('studyId') || '').trim(),
      phase: String(inCtx?.phase || qs.get('phase') || '').trim(),
      conditionGroup: String(inCtx?.conditionGroup || qs.get('conditionGroup') || '').trim(),
      log: String(inCtx?.log || qs.get('log') || '').trim()
    };

    ctx.time = clamp(ctx.time, 30, 120);
    if (!['easy','normal','hard'].includes(ctx.diff)) ctx.diff = 'normal';
    if (!['pc','mobile','cvr','cardboard'].includes(ctx.view)) {
      ctx.view = getViewAuto();
    }
    if (ctx.view === 'cardboard') ctx.view = 'cvr';

    return ctx;
  }

  function boot(inCtx){
    cacheDom();
    if (!mustHaveCoreDom()){
      console.warn('[BrushVR] core DOM missing');
      return;
    }

    Engine.qs = getQS();
    Engine.ctx = normalizeCtx(inCtx);
    Engine.rng = seededRng(Engine.ctx.seed);

    tuneByDiff();
    initFun(Engine.ctx, Engine.qs);
    ensureFxLayer();

    updateHudMeta();
    setBackLinks();
    wireControlsOnce();

    // Reset to menu state on boot (DO NOT AUTO START)
    Engine.st.running = false;
    Engine.st.paused = false;
    Engine.st.over = false;

    clearTimeout(Engine.spawnTimer);
    clearInterval(Engine.tickTimer);
    Engine.spawnTimer = null;
    Engine.tickTimer = null;

    clearTargetsNow();

    if (Engine.dom.menu) Engine.dom.menu.style.display = 'grid';
    if (Engine.dom.end) Engine.dom.end.hidden = true;
    if (Engine.dom.wrap) Engine.dom.wrap.dataset.state = 'menu';
    if (Engine.dom.btnPause) Engine.dom.btnPause.textContent = 'Pause';

    hud(true);

    // Show ready toast only once per page load
    if (!Engine.booted){
      toast('พร้อมแล้ว! กดเริ่มเกมได้เลย');
    }

    Engine.booted = true;
  }

  // Expose public API
  WIN.BrushVR = WIN.BrushVR || {};
  WIN.BrushVR.boot = boot;
  WIN.BrushVR.start = startGame;
  WIN.BrushVR.end = endGame;
})();