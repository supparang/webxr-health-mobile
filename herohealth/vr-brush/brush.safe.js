// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR Engine — SAFE PATCH FULL (v20260223p1)
// ✅ no auto-end before start
// ✅ no duplicate boot/bind
// ✅ mobile/pc/cVR support (hha:shoot)
// ✅ boss weakspot bonus
// ✅ summary/menu visibility hardened
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__BRUSH_SAFE_LOADED__) return;
  WIN.__BRUSH_SAFE_LOADED__ = true;

  /* ---------------- util ---------------- */
  const $ = (s)=>DOC.querySelector(s);
  const clamp = (v,a,b)=>Math.max(a,Math.min(b, Number(v)||a));
  const nowMs = ()=> (typeof performance!=='undefined' && performance.now ? performance.now() : Date.now());
  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }
  function safeNum(v, d=0){ v=Number(v); return Number.isFinite(v)?v:d; }
  function rand01(){ return Math.random(); }
  function makeRng(seed){
    let s = (Number(seed)||Date.now()) >>> 0;
    return function(){
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function pct(n){ return Math.round(Number(n)||0) + '%'; }

  /* ---------------- state ---------------- */
  let cfg = null, rng = rand01;
  let root, layer, fxLayer, menu, end, tapStart;
  let btnStart, btnRetry, btnPause, btnHow, btnRecenter, tapBtn, btnBack, btnBackHub2;
  let toastEl, fatalEl;

  let tScore, tCombo, tMiss, tTime, tClean, tFever, bClean, bFever;
  let mDiff, mTime, ctxView, ctxSeed, ctxTime, diffTag;
  let sScore, sAcc, sMiss, sCombo, sClean, sTime, endGrade, endNote;

  let state = null;

  let rafId = 0;
  let tickTimer = 0;
  let spawnTimer = 0;
  let feverTimer = 0;
  let lastFrameAt = 0;

  let bootOnce = false;
  let boundOnce = false;
  let endLock = false;
  let lastShootAt = 0;

  const TARGETS = new Map();
  let targetSeq = 1;

  /* ---------------- config ---------------- */
  function readConfig(){
    const view = String(qs('view','mobile')).toLowerCase();
    const run  = String(qs('run','play')).toLowerCase();
    const diff = String(qs('diff','normal')).toLowerCase();
    const time = clamp(qs('time','80'), 20, 300);
    const pid  = String(qs('pid','anon') || 'anon');
    const seed = safeNum(qs('seed', String(Date.now())), Date.now());
    const hub  = String(qs('hub','../hub.html') || '../hub.html');

    const D = {
      easy:   { spawnMs: 1050, ttlMs: 2200, bossEvery: 9,  bossHp: 4, cleanGain: 8,  missClean: 1, maxTargets: 3 },
      normal: { spawnMs: 850,  ttlMs: 1800, bossEvery: 7,  bossHp: 5, cleanGain: 7,  missClean: 1, maxTargets: 4 },
      hard:   { spawnMs: 700,  ttlMs: 1500, bossEvery: 6,  bossHp: 6, cleanGain: 6,  missClean: 2, maxTargets: 5 },
    }[diff] || {
      spawnMs: 850, ttlMs: 1800, bossEvery: 7, bossHp: 5, cleanGain: 7, missClean: 1, maxTargets: 4
    };

    return { view, run, diff, time, pid, seed, hub, ...D };
  }

  /* ---------------- dom ---------------- */
  function cacheDom(){
    root      = $('#br-wrap');
    layer     = $('#br-layer');
    fxLayer   = $('#br-fx');
    menu      = $('#br-menu');
    end       = $('#br-end');
    tapStart  = $('#tapStart');
    toastEl   = $('#toast');
    fatalEl   = $('#fatal');

    btnStart    = $('#btnStart');
    btnRetry    = $('#btnRetry');
    btnPause    = $('#btnPause');
    btnHow      = $('#btnHow');
    btnRecenter = $('#btnRecenter');
    tapBtn      = $('#tapBtn');
    btnBack     = $('#btnBack');
    btnBackHub2 = $('#btnBackHub2');

    tScore = $('#tScore'); tCombo = $('#tCombo'); tMiss = $('#tMiss'); tTime = $('#tTime');
    tClean = $('#tClean'); tFever = $('#tFever'); bClean = $('#bClean'); bFever = $('#bFever');

    mDiff = $('#mDiff'); mTime = $('#mTime');
    ctxView = $('#br-ctx-view'); ctxSeed = $('#br-ctx-seed'); ctxTime = $('#br-ctx-time'); diffTag = $('#br-diffTag');

    sScore = $('#sScore'); sAcc = $('#sAcc'); sMiss = $('#sMiss'); sCombo = $('#sCombo');
    sClean = $('#sClean'); sTime = $('#sTime'); endGrade = $('#endGrade'); endNote = $('#endNote');
  }

  function setFatal(msg){
    try{
      if(!fatalEl) return;
      fatalEl.classList.remove('br-hidden');
      fatalEl.textContent = String(msg || 'Unknown error');
    }catch(_){}
  }

  function setUiMode(mode){
    // mode = menu | play | end
    try{ DOC.documentElement.dataset.brUi = mode; }catch(_){}
    try{ root && (root.dataset.state = mode); }catch(_){}

    if(menu){
      if(mode === 'menu'){
        menu.setAttribute('aria-hidden','false');
        menu.style.display = '';
      }else{
        menu.setAttribute('aria-hidden','true');
        menu.style.display = 'none';
      }
    }
    if(end){
      end.hidden = (mode !== 'end');
    }
  }

  function showToast(msg){
    if(!toastEl) return;
    toastEl.textContent = String(msg || '');
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toastEl && toastEl.classList.remove('show'), 1200);
  }

  /* ---------------- game state ---------------- */
  function freshState(){
    return {
      started: false,
      ended: false,
      paused: false,

      timeTotal: Number(cfg.time),
      timeLeft: Number(cfg.time),

      score: 0,
      combo: 0,
      maxCombo: 0,
      miss: 0,
      hits: 0,
      shots: 0,
      cleanPct: 0,

      feverOn: false,
      feverGauge: 0, // 0..100
      spawned: 0,
      bossSpawned: 0,

      startAtMs: 0,
      endAtMs: 0,
      lastTickAt: 0,
    };
  }

  function resetAllRuntime(){
    stopLoops();
    TARGETS.forEach(t => { try{ t.el.remove(); }catch(_){} });
    TARGETS.clear();
    targetSeq = 1;
    if(layer){
      layer.innerHTML = '';
      layer.style.pointerEvents = '';
    }
    if(fxLayer){
      fxLayer.innerHTML = '';
    }
  }

  function stopLoops(){
    try{ if(rafId){ cancelAnimationFrame(rafId); rafId = 0; } }catch(_){}
    try{ if(tickTimer){ clearInterval(tickTimer); tickTimer = 0; } }catch(_){}
    try{ if(spawnTimer){ clearInterval(spawnTimer); spawnTimer = 0; } }catch(_){}
    try{ if(feverTimer){ clearTimeout(feverTimer); feverTimer = 0; } }catch(_){}
  }

  /* ---------------- hud ---------------- */
  function renderHud(){
    if(!state) return;
    if(tScore) tScore.textContent = String(Math.round(state.score));
    if(tCombo) tCombo.textContent = String(Math.round(state.combo));
    if(tMiss)  tMiss.textContent = String(Math.round(state.miss));
    if(tTime)  tTime.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    if(tClean) tClean.textContent = pct(state.cleanPct);
    if(tFever) tFever.textContent = state.feverOn ? 'ON' : 'OFF';

    if(bClean) bClean.style.width = clamp(state.cleanPct,0,100) + '%';
    if(bFever) bFever.style.width = clamp(state.feverGauge,0,100) + '%';
  }

  function renderCtx(){
    if(!cfg) return;
    if(ctxView) ctxView.textContent = cfg.view;
    if(ctxSeed) ctxSeed.textContent = String(cfg.seed);
    if(ctxTime) ctxTime.textContent = String(cfg.time);
    if(diffTag) diffTag.textContent = cfg.diff;
    if(mDiff)   mDiff.textContent = cfg.diff;
    if(mTime)   mTime.textContent = String(cfg.time);

    try{ DOC.body.dataset.view = cfg.view; }catch(_){}
    try{ root && (root.dataset.view = cfg.view); }catch(_){}

    if(btnBack) btnBack.href = cfg.hub || '../hub.html';
    if(btnBackHub2) btnBackHub2.href = cfg.hub || '../hub.html';
  }

  /* ---------------- target logic ---------------- */
  function layerRect(){
    return layer ? layer.getBoundingClientRect() : {left:0,top:0,width:320,height:240};
  }

  function pickSpawnPos(size){
    const r = layerRect();
    const pad = Math.max(44, size * 0.7);
    const x = pad + (r.width - pad*2) * rng();
    const y = 70 + (r.height - (70 + pad) - pad) * rng(); // กันชนปุ่ม action ด้านบน
    return { x, y };
  }

  function makeTarget(kind='normal'){
    if(!layer || !state || !state.started || state.ended) return null;

    const id = 't' + (targetSeq++);
    const isBoss = (kind === 'boss');

    const hpMax = isBoss ? cfg.bossHp : 1;
    const size = isBoss ? 92 : 78;
    const ttl = isBoss ? Math.round(cfg.ttlMs * 1.65) : cfg.ttlMs;
    const p = pickSpawnPos(size);

    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'br-t' + (isBoss ? ' thick' : '') + ' pop';
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.dataset.hp = String(hpMax);
    el.dataset.hpMax = String(hpMax);
    el.dataset.spawnAt = String(nowMs());
    el.dataset.expireAt = String(nowMs() + ttl);

    const emo = DOC.createElement('div');
    emo.className = 'emo';
    emo.textContent = isBoss ? '💎' : '🦠';
    el.appendChild(emo);

    if(isBoss){
      const ws = DOC.createElement('div');
      ws.className = 'br-ws';
      // ขยับจุดอ่อนแบบสุ่มเล็กน้อย
      const dx = (rng()*16 - 8);
      const dy = (rng()*16 - 8);
      ws.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      el.appendChild(ws);
    }

    if(hpMax > 1){
      const hp = DOC.createElement('div');
      hp.className = 'hp';
      hp.innerHTML = '<i></i>';
      el.appendChild(hp);
    }

    const t = {
      id, el, kind, isBoss,
      hp: hpMax, hpMax,
      x: p.x, y: p.y,
      bornAt: nowMs(),
      expireAt: nowMs() + ttl,
      removed: false,
      ttl
    };

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      hitTargetByPointer(t, ev.clientX, ev.clientY);
    }, {passive:false});

    TARGETS.set(id, t);
    layer.appendChild(el);

    state.spawned++;
    if(isBoss) state.bossSpawned++;
    return t;
  }

  function updateTargetHpUI(t){
    if(!t || !t.el) return;
    t.el.dataset.hp = String(t.hp);
    const hpFill = t.el.querySelector('.hp i');
    if(hpFill){
      const w = clamp((t.hp / t.hpMax) * 100, 0, 100);
      hpFill.style.width = w + '%';
    }
  }

  function removeTarget(t, why='hit'){
    if(!t || t.removed) return;
    t.removed = true;
    TARGETS.delete(t.id);

    try{
      t.el.classList.add('fade');
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){ } }, 180);
    }catch(_){}
  }

  function bossWeakspotHit(t, clientX, clientY){
    if(!t || !t.isBoss || !t.el) return false;
    const ws = t.el.querySelector('.br-ws');
    if(!ws) return false;
    const a = ws.getBoundingClientRect();
    return (clientX >= a.left && clientX <= a.right && clientY >= a.top && clientY <= a.bottom);
  }

  function gainFever(n){
    state.feverGauge = clamp(state.feverGauge + n, 0, 100);
    if(!state.feverOn && state.feverGauge >= 100){
      state.feverOn = true;
      state.feverGauge = 100;
      showToast('FEVER ON 🔥');
      clearTimeout(feverTimer);
      feverTimer = setTimeout(()=>{
        if(!state) return;
        state.feverOn = false;
        state.feverGauge = 0;
        renderHud();
      }, 7000);
    }
  }

  function addScore(base, perfect=false, crit=false){
    let s = base;
    if(perfect) s += 3;
    if(crit) s += 6;
    if(state.combo >= 5) s += 2;
    if(state.feverOn) s = Math.round(s * 1.5);
    state.score += s;
  }

  function addClean(n){
    state.cleanPct = clamp(state.cleanPct + n, 0, 100);
  }

  function decayCleanOnMiss(){
    state.cleanPct = clamp(state.cleanPct - cfg.missClean, 0, 100);
  }

  function hitTargetCore(t, hitX, hitY){
    if(!state || !state.started || state.ended || state.paused) return;
    if(!t || t.removed) return;

    state.shots++;

    const rem = Math.max(0, t.expireAt - nowMs());
    const perfect = rem <= Math.min(420, t.ttl * 0.22);

    if(t.isBoss){
      const crit = bossWeakspotHit(t, hitX, hitY);
      const dmg = crit ? 2 : 1;
      t.hp = Math.max(0, t.hp - dmg);

      if(crit){
        try{
          t.el.classList.add('ws-hit');
          setTimeout(()=>{ try{ t.el.classList.remove('ws-hit'); }catch(_){ } }, 160);
        }catch(_){}
      }

      updateTargetHpUI(t);

      if(t.hp <= 0){
        state.hits++;
        state.combo++;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
        addScore(12, perfect, crit);
        addClean(cfg.cleanGain + 8);
        gainFever(18);
        removeTarget(t, 'boss-kill');
        flashFx('shock');
        showToast(crit ? 'CRIT! 💎' : 'Boss แตก! 💎');
      }else{
        // hit but not dead yet
        state.combo = Math.max(0, state.combo);
        addScore(2, false, crit);
        gainFever(6 + (crit?4:0));
        flashFx(crit ? 'flash' : 'laser');
      }
    }else{
      state.hits++;
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      addScore(5, perfect, false);
      addClean(cfg.cleanGain);
      gainFever(8);
      removeTarget(t, 'normal-hit');
      flashFx(perfect ? 'flash' : 'laser');
    }

    renderHud();
    checkEndConditions();
  }

  function hitTargetByPointer(t, clientX, clientY){
    hitTargetCore(t, clientX, clientY);
  }

  function hitByScreenPoint(clientX, clientY){
    if(!state || !state.started || state.ended || state.paused) return;

    state.shots++;

    // เลือก target ที่ใกล้ที่สุดใน lock radius
    const lockPx = 28;
    let best = null, bestD = 1e9;

    TARGETS.forEach((t)=>{
      if(!t || t.removed) return;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = cx - clientX, dy = cy - clientY;
      const d = Math.hypot(dx, dy);
      if(d < bestD){
        bestD = d; best = t;
      }
    });

    if(best && bestD <= lockPx + (best.isBoss ? 18 : 8)){
      // ใช้พิกัดจริงเพื่อเช็ค weakspot
      hitTargetCore(best, clientX, clientY);
      return;
    }

    // miss
    state.miss++;
    state.combo = 0;
    decayCleanOnMiss();
    renderHud();
  }

  function expireTargets(){
    const tNow = nowMs();
    TARGETS.forEach((t)=>{
      if(t.removed) return;
      if(tNow >= t.expireAt){
        // expire = miss
        state.miss++;
        state.combo = 0;
        decayCleanOnMiss();
        removeTarget(t, 'expire');
      }
    });
  }

  function maybeSpawn(){
    if(!state || !state.started || state.ended || state.paused) return;
    if(TARGETS.size >= cfg.maxTargets) return;

    const shouldBoss = (state.spawned > 0 && state.spawned % cfg.bossEvery === 0);
    makeTarget(shouldBoss ? 'boss' : 'normal');
  }

  /* ---------------- fx ---------------- */
  function ensureFx(kind){
    if(!fxLayer) return null;
    let el = fxLayer.querySelector('.fx-' + kind);
    if(el) return el;
    el = DOC.createElement('div');
    el.className = 'fx-' + kind;
    fxLayer.appendChild(el);
    return el;
  }
  function flashFx(kind){
    const k = (kind === 'shock' || kind === 'flash' || kind === 'laser' || kind === 'fin') ? kind : 'flash';
    const el = ensureFx(k);
    if(!el) return;
    el.classList.remove('on');
    // force reflow
    void el.offsetWidth;
    el.classList.add('on');
    const dur = (k === 'laser') ? 1300 : (k === 'shock' ? 400 : 180);
    setTimeout(()=>{ try{ el.classList.remove('on'); }catch(_){ } }, dur);
  }

  /* ---------------- loop ---------------- */
  function tick(){
    if(!state || !state.started || state.ended || state.paused) return;

    const t = Date.now();
    if(!state.lastTickAt) state.lastTickAt = t;
    const dt = Math.max(0, (t - state.lastTickAt) / 1000);
    state.lastTickAt = t;

    state.timeLeft = Math.max(0, state.timeLeft - dt);

    expireTargets();

    // auto fever decay when not ON
    if(!state.feverOn && state.feverGauge > 0){
      state.feverGauge = Math.max(0, state.feverGauge - dt * 3.5);
    }

    renderHud();
    checkEndConditions();
  }

  function frame(){
    if(!state || !state.started || state.ended) return;
    rafId = requestAnimationFrame(frame);
    // reserved for future motion/ai hooks
  }

  function startLoops(){
    stopLoops();
    state.lastTickAt = Date.now();
    tickTimer = setInterval(tick, 100);
    spawnTimer = setInterval(maybeSpawn, cfg.spawnMs);
    rafId = requestAnimationFrame(frame);
  }

  /* ---------------- end/summary ---------------- */
  function gradeFromScore(acc, clean, timeSpent){
    if(clean >= 100 && acc >= 75 && timeSpent <= cfg.time * 0.8) return 'A';
    if(clean >= 100 && acc >= 55) return 'B';
    if(clean >= 80) return 'C';
    return 'D';
  }

  function fillSummary(reason){
    const timeSpent = Math.max(0, cfg.time - state.timeLeft);
    const acc = state.shots > 0 ? Math.round((state.hits / state.shots) * 100) : 0;
    const grade = gradeFromScore(acc, state.cleanPct, timeSpent);

    sScore && (sScore.textContent = String(Math.round(state.score)));
    sAcc && (sAcc.textContent = acc + '%');
    sMiss && (sMiss.textContent = String(Math.round(state.miss)));
    sCombo && (sCombo.textContent = String(Math.round(state.maxCombo)));
    sClean && (sClean.textContent = pct(state.cleanPct));
    sTime && (sTime.textContent = timeSpent.toFixed(1) + 's');
    endGrade && (endGrade.textContent = grade);

    let msg = '-';
    if(reason === 'clean') msg = 'ALMOST!'; // ตามภาพ/สไตล์ที่คุณชอบ
    if(reason === 'timeout' && state.cleanPct >= 70) msg = 'เกือบผ่านแล้ว!';
    if(reason === 'timeout' && state.cleanPct < 70) msg = 'ลองจัดลำดับเป้าหมายให้แม่นขึ้น 💪';

    const meta = `reason=${reason} | seed=${cfg.seed} | diff=${cfg.diff} | view=${cfg.view} | pid=${cfg.pid}`;
    endNote && (endNote.textContent = `${msg}\n${meta}`);
  }

  function endGame(reason){
    if(!state || !state.started) return;
    if(state.ended || endLock) return;

    endLock = true;
    state.ended = true;
    state.endAtMs = Date.now();

    stopLoops();
    TARGETS.forEach(t => { try{ t.el.style.pointerEvents='none'; }catch(_){ } });

    fillSummary(reason || 'timeout');
    renderHud();
    setUiMode('end');

    setTimeout(()=>{ endLock = false; }, 80);
  }

  function checkEndConditions(){
    if(!state || !state.started || state.ended) return;
    if(state.cleanPct >= 100){
      endGame('clean');
      return;
    }
    if(state.timeLeft <= 0){
      endGame('timeout');
      return;
    }
  }

  /* ---------------- controls ---------------- */
  function startGame(){
    if(!state) state = freshState();

    // fresh state each round
    resetAllRuntime();
    state = freshState();
    state.started = true;
    state.startAtMs = Date.now();

    renderHud();
    setUiMode('play');

    if(tapStart) tapStart.style.display = 'none';
    if(btnPause) btnPause.textContent = 'Pause';

    startLoops();
    maybeSpawn(); // spawn first target quickly
    showToast('เริ่มแปรง! 🪥');
  }

  function retryGame(){
    if(end) end.hidden = true;
    startGame();
  }

  function togglePause(){
    if(!state || !state.started || state.ended) return;
    state.paused = !state.paused;
    if(btnPause) btnPause.textContent = state.paused ? 'Resume' : 'Pause';
    showToast(state.paused ? 'พักเกม ⏸' : 'เล่นต่อ ▶');
    if(!state.paused) state.lastTickAt = Date.now();
  }

  function showHow(){
    showToast('ยิง/แตะ 🦠 | บอส 💎 มีจุดอ่อน 🎯');
  }

  function doRecenter(){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'brush' } }));
    }catch(_){}
    showToast('Recenter 🎯');
  }

  function maybeRequireTapStart(){
    const isMobileLike = /android|iphone|ipad|mobile/i.test(navigator.userAgent) || cfg.view === 'mobile' || cfg.view === 'cvr';
    if(tapStart && isMobileLike){
      tapStart.style.display = '';
      return true;
    }
    return false;
  }

  function onTapUnlock(){
    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(AC){
        if(!WIN.__brAudioCtx) WIN.__brAudioCtx = new AC();
        if(WIN.__brAudioCtx && WIN.__brAudioCtx.state === 'suspended'){
          WIN.__brAudioCtx.resume().catch(()=>{});
        }
      }
    }catch(_){}
    if(tapStart) tapStart.style.display = 'none';
    startGame();
  }

  /* ---------------- bind ---------------- */
  function bindOnce(el, evt, fn, opts){
    if(!el) return;
    const key = '__b_' + evt;
    if(el[key]) return;
    el[key] = true;
    el.addEventListener(evt, fn, opts || false);
  }

  function bindAll(){
    if(boundOnce) return;
    boundOnce = true;

    bindOnce(btnStart, 'click', ()=>{
      // ถ้ามี tap overlay อยู่ ให้ tap overlay เริ่มจริง
      if(tapStart && tapStart.style.display !== 'none') return;
      startGame();
    });

    bindOnce(btnRetry, 'click', ()=> retryGame());
    bindOnce(btnPause, 'click', ()=> togglePause());
    bindOnce(btnHow, 'click', ()=> showHow());
    bindOnce(btnRecenter, 'click', ()=> doRecenter());
    bindOnce(tapBtn, 'click', ()=> onTapUnlock());

    // รับยิงจาก vr-ui (cVR / screen center shoot)
    bindOnce(WIN, 'hha:shoot', (ev)=>{
      if(!state || !state.started || state.ended || state.paused) return;

      const d = (ev && ev.detail) || {};
      const tNow = nowMs();
      const cooldownMs = clamp(d.cooldownMs ?? 90, 20, 500);
      if(tNow - lastShootAt < cooldownMs) return;
      lastShootAt = tNow;

      const x = safeNum(d.x, WIN.innerWidth/2);
      const y = safeNum(d.y, WIN.innerHeight/2);
      hitByScreenPoint(x, y);
    });

    // ถ้ากด ESC ระหว่างเล่น = pause
    bindOnce(DOC, 'keydown', (ev)=>{
      if(ev.code === 'Escape'){
        togglePause();
      }
    });
  }

  /* ---------------- public init ---------------- */
  function initBrushGame(){
    if(bootOnce) return;
    bootOnce = true;

    try{
      cfg = readConfig();
      rng = makeRng(cfg.seed);
      cacheDom();
      if(!root || !layer || !menu || !end){
        throw new Error('BrushVR DOM missing (#br-wrap/#br-layer/#br-menu/#br-end)');
      }

      renderCtx();
      state = freshState();
      renderHud();
      resetAllRuntime();
      setUiMode('menu');
      bindAll();

      // mobile/cVR show tap overlay before start
      maybeRequireTapStart();

      // ถ้าไม่มี tap overlay และเป็น play/research ให้ผู้เล่นกด Start เอง (ไม่ auto-start)
      // IMPORTANT: no auto-start here.

      // expose (optional debug)
      WIN.__BRUSH_STATE__ = ()=> state;
      WIN.__BRUSH_CFG__ = cfg;
      WIN.__brushStart = startGame;
      WIN.__brushEnd = endGame;

    }catch(err){
      console.error('[BrushVR] init error', err);
      setFatal('JS ERROR:\n' + (err.stack || err.message || String(err)));
    }
  }

  /* export for boot */
  WIN.initBrushGame = initBrushGame;
  WIN.__brushInit = initBrushGame;
})();