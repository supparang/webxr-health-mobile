// === /herohealth/vr-maskcough/maskcough.safe.js ===
// MaskCough SAFE Engine — PRODUCTION v1.1 (cVR shoot + seeded RNG + end overlay)
// Mechanics:
// - 💦 droplet: hit to clear (good)
// - 🤧 cough: hit to block (perfect window near expiry gives bonus)
// - 😷 mask: hit to gain shield
// - Fever (from fun-boost): fantasy burst clears extra droplets
//
// Inputs:
// - PC/Mobile: pointerdown on targets
// - cVR: hha:shoot event (from /herohealth/vr/vr-ui.js), aims at x/y viewport coords
//
// URL params: ?time=60&diff=easy|normal|hard&seed=...&view=pc|mobile|cvr&hub=...
// Exposes: window.MASKCOUGH.start(), window.MASKCOUGH.stop()

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const $ = (s)=>DOC.querySelector(s);

  // ---------- utils ----------
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  function getQS(){
    try { return new URL(location.href).searchParams; }
    catch(_){ return new URLSearchParams(); }
  }

  function safeInt(x, d){
    const n = parseInt(x, 10);
    return Number.isFinite(n) ? n : d;
  }

  // mulberry32-ish
  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getViewAuto(qs){
    const v = String(qs.get('view')||'').toLowerCase().trim();
    if(v) return v;
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'cvr' : 'pc';
  }

  // toast (in maskcough.html)
  const toastEl = $('#toast');
  let toastTimer=null;
  function toast(msg){
    if(!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = setTimeout(()=> toastEl.classList.remove('show'), 1200);
  }

  // prompt (optional)
  const promptEl = $('#mc-prompt');
  let promptTimer=null;
  function prompt(msg, ms=1200){
    if(!promptEl) return;
    clearTimeout(promptTimer);
    promptEl.textContent = msg;
    promptEl.classList.add('show');
    promptTimer = setTimeout(()=> promptEl.classList.remove('show'), ms);
  }

  // flash
  const flashEl = $('#mc-flash');
  function flash(on){
    if(!flashEl) return;
    flashEl.style.opacity = on ? '1' : '0';
  }

  // ---------- URL params / ctx ----------
  const QS = getQS();
  const pid  = (QS.get('pid')||'').trim();
  const hub  = (QS.get('hub')||'../hub.html').trim();
  const diff = (QS.get('diff')||'normal').trim();
  const seed = (QS.get('seed')||pid||'maskcough').trim();
  const mode = (QS.get('mode')||QS.get('run')||'play').trim();
  const timeLimitSec = Math.max(20, safeInt(QS.get('time')||'60', 60));

  const view = getViewAuto(QS); // pc | cvr | mobile (treated like pc tap)
  const wrap = $('#mc-wrap');
  if(wrap) wrap.dataset.view = view;

  const rng = seededRng(seed);

  // ---------- DOM ----------
  const layer = DOC.getElementById('layer');
  const menu  = DOC.getElementById('menu');
  const endOv = DOC.getElementById('end');

  const btnStart  = DOC.getElementById('btnStart');
  const btnStart2 = DOC.getElementById('btnStart2');
  const btnBack   = DOC.getElementById('btnBack');
  const btnBack2  = DOC.getElementById('btnBack2');
  const btnRetry  = DOC.getElementById('btnRetry');

  const tScore  = DOC.getElementById('tScore');
  const tStreak = DOC.getElementById('tStreak');
  const tMiss   = DOC.getElementById('tMiss');
  const tMask   = DOC.getElementById('tMask');
  const bMask   = DOC.getElementById('bMask');

  const tWave  = DOC.getElementById('tWave');
  const tInt   = DOC.getElementById('tInt');
  const tFever = DOC.getElementById('tFever');
  const tFever2= DOC.getElementById('tFever2');
  const bFever = DOC.getElementById('bFever');

  // end summary ids (maskcough.html)
  const endReason = DOC.getElementById('endReason');
  const endScore  = DOC.getElementById('endScore');
  const endStreak = DOC.getElementById('endStreak');
  const endMiss   = DOC.getElementById('endMiss');
  const endShield = DOC.getElementById('endShield');
  const endTime   = DOC.getElementById('endTime');
  const endView   = DOC.getElementById('endView');
  const endNote   = DOC.getElementById('endNote');

  const aBackHub  = DOC.getElementById('aBackHub');
  if(aBackHub){
    try{
      const u = new URL(hub, location.href);
      if(pid) u.searchParams.set('pid', pid);
      aBackHub.href = u.toString();
    }catch(_){
      aBackHub.href = hub || '../hub.html';
    }
  }

  // ---------- FUN BOOST ----------
  const fun = WIN.HHA?.createFunBoost?.({
    seed: seed || 'maskcough',
    baseSpawnMul: 1.0,
    waveCycleMs: 18000,
    feverThreshold: 16,
    feverDurationMs: 6500,
    feverSpawnBoost: 1.18,
    feverTimeScale: 0.92
  });

  let director = fun ? fun.tick() : {spawnMul:1,timeScale:1,wave:'calm',intensity:0,feverOn:false};

  // ---------- game state ----------
  const st = {
    running:false,
    over:false,
    t0:0,
    maxStreak:0,

    score:0,
    streak:0,
    miss:0,

    shield:40, // 0..100

    baseSpawnMs: (diff==='hard' ? 650 : diff==='easy' ? 880 : 760),
    ttlMs: (diff==='hard' ? 1450 : diff==='easy' ? 1850 : 1650),

    perfectWindowMs: 220,

    targets: new Map(), // id -> {el, kind, bornMs, dieMs}
    uid: 0,

    spawnTimer: null,
    tickTimer: null
  };

  function hud(){
    if(tScore)  tScore.textContent  = String(st.score);
    if(tStreak) tStreak.textContent = String(st.streak);
    if(tMiss)   tMiss.textContent   = String(st.miss);

    const sh = clamp(st.shield, 0, 100);
    if(tMask) tMask.textContent = `${Math.round(sh)}%`;
    if(bMask) bMask.style.width = `${sh}%`;

    if(tWave)  tWave.textContent  = director.wave || '—';
    if(tInt)   tInt.textContent   = (director.intensity||0).toFixed(2);
    if(tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';

    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    if(bFever)  bFever.style.width = `${pct}%`;
    if(tFever2) tFever2.textContent = director.feverOn ? 'ON' : `${Math.round(pct)}%`;
  }

  function pickKind(){
    const feverOn = !!director.feverOn;
    const inten = director.intensity || 0;

    let wDroplet = 0.62;
    let wCough   = 0.24;
    let wMask    = 0.14;

    wCough += inten * 0.16;
    wDroplet -= inten * 0.10;
    wMask += (st.shield < 35 ? 0.10 : 0.00);

    if(feverOn){
      wDroplet += 0.10;
      wMask -= 0.08;
    }

    const sum = wDroplet + wCough + wMask;
    wDroplet/=sum; wCough/=sum; wMask/=sum;

    const r = rng();
    if(r < wDroplet) return 'droplet';
    if(r < wDroplet + wCough) return 'cough';
    return 'mask';
  }

  function emoji(kind){
    if(kind==='droplet') return '💦';
    if(kind==='cough') return '🤧';
    if(kind==='mask') return '😷';
    return '🎯';
  }

  function cssClass(kind){
    if(kind==='droplet') return 't good';
    if(kind==='cough')   return 't cough bad';
    if(kind==='mask')    return 't mask';
    return 't';
  }

  function layerRect(){ return layer.getBoundingClientRect(); }

  function spawn(){
    if(!st.running || st.over) return;

    const r = layerRect();
    const pad = 52;

    const x = pad + rng() * Math.max(10, (r.width - pad*2));
    const y = pad + rng() * Math.max(10, (r.height - pad*2));

    const kind = pickKind();
    const id = String(++st.uid);

    const el = DOC.createElement('div');
    el.className = cssClass(kind);
    el.textContent = emoji(kind);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.dataset.id = id;
    el.dataset.kind = kind;

    const born = performance.now();
    const ttl = st.ttlMs * (director.timeScale || 1);
    const die = born + ttl;

    st.targets.set(id, { el, kind, bornMs: born, dieMs: die });

    // PC/mobile tap (cVR CSS disables pointer events on layer anyway)
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      handleHit(id, 'tap');
    }, { passive:false });

    layer.appendChild(el);
  }

  function removeTarget(id, popped){
    const it = st.targets.get(id);
    if(!it) return;
    st.targets.delete(id);

    const el = it.el;
    if(!el) return;

    if(popped){
      el.classList.add('pop');
      el.classList.add('fade');
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
    }else{
      el.classList.add('fade');
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
    }
  }

  function burstClear(n){
    const arr = Array.from(st.targets.entries()).filter(([,v])=> v.kind==='droplet');
    for(let i=0;i<Math.min(n, arr.length);i++){
      const pick = arr[Math.floor(rng()*arr.length)];
      if(pick) handleHit(pick[0], 'burst');
    }
  }

  function handleHit(id, why){
    const it = st.targets.get(id);
    if(!it || st.over) return;

    const t = performance.now();
    const remain = it.dieMs - t;

    removeTarget(id, true);

    if(it.kind === 'droplet'){
      st.score += director.feverOn ? 2 : 1;
      st.streak += 1;

      if(remain > st.ttlMs * 0.55){
        fun?.onAction?.({ type:'perfect' });
        st.score += 1;
      } else {
        fun?.onAction?.({ type:'hit' });
      }

      if(director.feverOn && rng() < 0.22){
        burstClear(1);
      }

    } else if(it.kind === 'mask'){
      st.shield = clamp(st.shield + (director.feverOn ? 16 : 14), 0, 100);
      st.score += 1;
      st.streak += 1;
      fun?.onAction?.({ type:'hit' });
      toast('🛡️ Shield +');

    } else if(it.kind === 'cough'){
      if(remain <= st.perfectWindowMs){
        st.score += 4;
        st.streak += 1;
        fun?.onAction?.({ type:'perfect' });
        toast('✨ Perfect Block!');
      } else {
        st.score += 2;
        st.streak += 1;
        fun?.onAction?.({ type:'hit' });
      }
    }

    st.maxStreak = Math.max(st.maxStreak, st.streak);
    hud();
  }

  function timeoutTarget(id){
    const it = st.targets.get(id);
    if(!it || st.over) return;

    removeTarget(id, false);

    if(it.kind === 'droplet'){
      st.miss += 1;
      st.streak = 0;
      st.score = Math.max(0, st.score - 1);
      st.shield = clamp(st.shield - 6, 0, 100);
      fun?.onAction?.({ type:'timeout' });
      fun?.onNearMiss?.({ reason:'ttl_droplet' });

    } else if(it.kind === 'mask'){
      st.miss += 1;
      st.streak = 0;
      fun?.onAction?.({ type:'timeout' });

    } else if(it.kind === 'cough'){
      st.miss += 1;
      st.streak = 0;
      st.shield = clamp(st.shield - 16, 0, 100);
      st.score = Math.max(0, st.score - 2);
      fun?.onAction?.({ type:'timeout' });
      toast('😷 โดนละอองไอ!');
      flash(true); setTimeout(()=>flash(false), 120);
    }

    hud();

    if(st.shield <= 0){
      endGame('shield');
    }
  }

  function scheduleSpawn(){
    if(st.spawnTimer) clearTimeout(st.spawnTimer);
    if(!st.running || st.over) return;

    const base = st.baseSpawnMs;
    const every = fun ? fun.scaleIntervalMs(base, director) : base;

    st.spawnTimer = setTimeout(()=>{
      spawn();
      scheduleSpawn();
    }, every);
  }

  function tick(){
    if(!st.running || st.over) return;

    director = fun ? fun.tick() : director;

    const t = performance.now();

    for(const [id, it] of st.targets){
      if(t >= it.dieMs){
        timeoutTarget(id);
      }
    }

    hud();

    const elapsed = (t - st.t0) / 1000;
    if(elapsed >= timeLimitSec){
      endGame('time');
    }
  }

  function showMenu(show){
    if(!menu) return;
    menu.style.display = show ? 'flex' : 'none';
  }

  function showEnd(show){
    if(!endOv) return;
    endOv.hidden = !show;
  }

  function endGame(reason){
    if(st.over) return;
    st.over = true;
    st.running = false;

    if(st.spawnTimer) clearTimeout(st.spawnTimer);
    if(st.tickTimer) clearInterval(st.tickTimer);

    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    const elapsed = (performance.now() - st.t0)/1000;

    // fill end overlay
    if(endReason) endReason.textContent = (reason==='time') ? 'ครบเวลา' : 'Shield หมด';
    if(endScore)  endScore.textContent = String(st.score);
    if(endStreak) endStreak.textContent = String(st.maxStreak);
    if(endMiss)   endMiss.textContent = String(st.miss);
    if(endShield) endShield.textContent = `${Math.round(clamp(st.shield,0,100))}%`;
    if(endTime)   endTime.textContent = `${elapsed.toFixed(1)}s`;
    if(endView)   endView.textContent = view;

    if(endNote){
      const s = new URL(location.href);
      endNote.textContent =
        'ctx: ' +
        ['pid','diff','time','seed','view','mode']
          .map(k=> `${k}=${(s.searchParams.get(k)||'')}`)
          .filter(x=> !x.endsWith('='))
          .join(' • ');
    }

    showEnd(true);
    toast(reason==='time' ? 'ครบเวลา!' : 'Shield หมด!');
  }

  function resetState(){
    st.over = false;
    st.running = false;

    st.score = 0;
    st.streak = 0;
    st.miss = 0;
    st.maxStreak = 0;
    st.shield = 40;

    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();
    hud();
  }

  function startGame(){
    resetState();

    st.running = true;
    st.over = false;
    st.t0 = performance.now();

    showEnd(false);
    showMenu(false);

    director = fun ? fun.tick() : director;
    hud();

    prompt(view==='cvr'
      ? 'โหมด cVR: เล็งกากบาทแล้วยิง!'
      : 'แตะ 💦 ปัดละออง • แตะ 😷 เพิ่มโล่ • แตะ 🤧 บล็อกไอ/จาม');

    scheduleSpawn();
    st.tickTimer = setInterval(tick, 80);
    toast('เริ่ม! กันละอองให้ได้มากที่สุด');
  }

  function stopGame(){
    if(st.spawnTimer) clearTimeout(st.spawnTimer);
    if(st.tickTimer) clearInterval(st.tickTimer);
    st.running = false;
  }

  // ---------- cVR shooting ----------
  // vr-ui.js emits: document.dispatchEvent(new CustomEvent('hha:shoot', {detail:{x,y}}))
  // We pick the nearest target center to the shoot point.
  function nearestTargetAt(x, y){
    let bestId = null;
    let bestD2 = 1e18;

    for(const [id, it] of st.targets){
      const el = it.el;
      if(!el) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;

      const dx = cx - x;
      const dy = cy - y;
      const d2 = dx*dx + dy*dy;

      if(d2 < bestD2){
        bestD2 = d2;
        bestId = id;
      }
    }

    // lock radius (px) : allow assist
    const lockPx = 70;
    if(bestId != null && bestD2 <= lockPx*lockPx) return bestId;
    return null;
  }

  DOC.addEventListener('hha:shoot', (ev)=>{
    if(!st.running || st.over) return;
    const x = ev?.detail?.x;
    const y = ev?.detail?.y;
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    const id = nearestTargetAt(x, y);
    if(id) handleHit(id, 'shoot');
  }, { passive:true });

  // ---------- buttons ----------
  function back(){
    if(hub) location.href = hub;
    else history.back();
  }

  if(btnStart)  btnStart.addEventListener('click', startGame, { passive:true });
  if(btnStart2) btnStart2.addEventListener('click', startGame, { passive:true });
  if(btnRetry)  btnRetry.addEventListener('click', startGame, { passive:true });

  if(btnBack)   btnBack.addEventListener('click', back, { passive:true });
  if(btnBack2)  btnBack2.addEventListener('click', back, { passive:true });

  // ---------- expose ----------
  WIN.MASKCOUGH = {
    start: startGame,
    stop: stopGame
  };

  // init UI
  hud();
  showEnd(false);
  showMenu(true);

})();