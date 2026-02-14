// === /herohealth/maskcough/maskcough.safe.js ===
// MaskCough SAFE Engine — DOM layer — FUN BOOST v1 integrated + cVR shoot + HUD-safe toast
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // ----- URL params -----
  const U = new URL(location.href);
  const QS = U.searchParams;

  const pid = (QS.get('pid')||'').trim();
  const hub = (QS.get('hub')||'').trim();
  const diff = (QS.get('diff')||'normal').trim();
  const seed = (QS.get('seed')||'').trim();
  const mode = (QS.get('mode')||QS.get('run')||'play').trim();
  const timeLimit = Math.max(20, parseInt(QS.get('time')||'60',10)); // seconds

  // ----- view auto-detect (respect ?view=) -----
  function getViewAuto(){
    const v = (QS.get('view')||'').toLowerCase().trim();
    if(v) return v; // respect explicit
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'cvr' : 'pc';
  }
  const view = getViewAuto();

  // ----- DOM -----
  const layer = DOC.getElementById('layer');
  const menu = DOC.getElementById('menu');
  const btnStart = DOC.getElementById('btnStart');
  const btnBack = DOC.getElementById('btnBack');

  const tScore = DOC.getElementById('tScore');
  const tStreak = DOC.getElementById('tStreak');
  const tMiss = DOC.getElementById('tMiss');
  const tMask = DOC.getElementById('tMask');
  const bMask = DOC.getElementById('bMask');

  const tWave = DOC.getElementById('tWave');
  const tInt = DOC.getElementById('tInt');
  const tFever = DOC.getElementById('tFever');
  const bFever = DOC.getElementById('bFever');

  const toastEl = DOC.getElementById('toast');
  let toastTimer = null;

  // attach view to body/wrap for CSS hooks if needed
  try{ DOC.body.dataset.view = view; }catch(_){}

  // ---- HUD height sync to CSS var --hudH (so toast never overlaps HUD) ----
  function syncHudH(){
    try{
      const hud = DOC.getElementById('hud');
      if(!hud) return;
      const r = hud.getBoundingClientRect();
      DOC.documentElement.style.setProperty('--hudH', Math.ceil(r.height) + 'px');
    }catch(_){}
  }
  syncHudH();
  WIN.addEventListener('resize', syncHudH, {passive:true});
  WIN.addEventListener('orientationchange', syncHudH, {passive:true});

  function toast(msg){
    if(!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = setTimeout(()=> toastEl.classList.remove('show'), 1200);
  }

  // ----- FUN BOOST -----
  const fun = WIN.HHA?.createFunBoost?.({
    seed: seed || pid || 'maskcough',
    baseSpawnMul: 1.0,
    waveCycleMs: 18000,
    feverThreshold: 16,
    feverDurationMs: 6500,
    feverSpawnBoost: 1.18,
    feverTimeScale: 0.92
  });

  let director = fun ? fun.tick() : {spawnMul:1,timeScale:1,wave:'calm',intensity:0,feverOn:false};

  // ----- Game state -----
  const st = {
    running: false,
    over: false,
    t0: 0,

    score: 0,
    streak: 0,
    miss: 0,

    // mask shield 0..100
    shield: 40,

    // spawn base (ms)
    baseSpawnMs: (diff==='hard' ? 650 : diff==='easy' ? 880 : 760),
    ttlMs: (diff==='hard' ? 1450 : diff==='easy' ? 1850 : 1650),

    // perfect window for cough taps (ms before expiry)
    perfectWindowMs: 220,

    // active targets
    targets: new Map(), // id -> {el, kind, bornMs, dieMs, x, y}
    uid: 0
  };

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  function hud(){
    if(tScore) tScore.textContent = String(st.score);
    if(tStreak) tStreak.textContent = String(st.streak);
    if(tMiss) tMiss.textContent = String(st.miss);

    const sh = clamp(st.shield, 0, 100);
    if(tMask) tMask.textContent = `${Math.round(sh)}%`;
    if(bMask) bMask.style.width = `${sh}%`;

    if(tWave) tWave.textContent = director.wave || '—';
    if(tInt)  tInt.textContent = (director.intensity||0).toFixed(2);
    if(tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';

    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    if(bFever) bFever.style.width = `${pct}%`;
  }

  // ----- Target kinds -----
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

    const r = Math.random();
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
    if(kind==='cough') return 't cough bad';
    if(kind==='mask') return 't mask';
    return 't';
  }

  // ----- Spawn -----
  function layerRect(){ return layer.getBoundingClientRect(); }

  function spawn(){
    if(!st.running || st.over) return;

    const r = layerRect();
    const pad = 52;

    // IMPORTANT: positions are relative to layer; we store x/y for cVR shoot hit-test
    const x = pad + Math.random() * Math.max(10, (r.width - pad*2));
    const y = pad + Math.random() * Math.max(10, (r.height - pad*2));

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

    st.targets.set(id, { el, kind, bornMs: born, dieMs: die, x, y });

    // pointer tap (only for non-cVR; cVR uses hha:shoot)
    el.addEventListener('pointerdown', (ev)=>{
      if(view === 'cvr') return;
      ev.preventDefault();
      handleHit(id, 'tap');
    }, { passive:false });

    layer.appendChild(el);
  }

  // ----- cVR shoot: hit-test nearest target around crosshair coord -----
  function findNearestTargetAt(x, y, radiusPx){
    let bestId = null;
    let bestD2 = Infinity;
    for(const [id, it] of st.targets){
      const dx = (it.x - x);
      const dy = (it.y - y);
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD2){
        bestD2 = d2;
        bestId = id;
      }
    }
    if(bestId == null) return null;
    return (bestD2 <= radiusPx*radiusPx) ? bestId : null;
  }

  function onShoot(ev){
    if(!st.running || st.over) return;

    // vr-ui.js emits: hha:shoot {x,y, lockPx?}
    const d = ev?.detail || {};
    const r = layerRect();

    // if no coords provided, assume center of layer
    const x = Number.isFinite(d.x) ? d.x : (r.width/2);
    const y = Number.isFinite(d.y) ? d.y : (r.height/2);

    const lock = Number.isFinite(d.lockPx) ? d.lockPx : 44;
    const id = findNearestTargetAt(x, y, lock);
    if(id) handleHit(id, 'shoot');
  }

  // listen always (safe); only active effect when cvr or if you want crosshair mode
  DOC.addEventListener('hha:shoot', onShoot);

  // ----- Hit / Miss rules -----
  function handleHit(id){
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

      if(director.feverOn && Math.random() < 0.22){
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
    }

    hud();

    if(st.shield <= 0){
      endGame('shield');
    }
  }

  function removeTarget(id, popped){
    const it = st.targets.get(id);
    if(!it) return;
    st.targets.delete(id);

    const el = it.el;
    if(!el) return;

    el.classList.add('fade');
    if(popped) el.classList.add('pop');

    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
  }

  function burstClear(n){
    const arr = Array.from(st.targets.entries()).filter(([,v])=> v.kind==='droplet');
    for(let i=0;i<Math.min(n, arr.length);i++){
      const [id] = arr[Math.floor(Math.random()*arr.length)];
      handleHit(id);
    }
  }

  // ----- Main loop -----
  let spawnTimer = null;
  let tickTimer = null;

  function scheduleSpawn(){
    if(spawnTimer) clearTimeout(spawnTimer);
    if(!st.running || st.over) return;

    const base = st.baseSpawnMs;
    const every = fun ? fun.scaleIntervalMs(base, director) : base;

    spawnTimer = setTimeout(()=>{
      spawn();
      scheduleSpawn();
    }, every);
  }

  function tick(){
    if(!st.running || st.over) return;

    director = fun ? fun.tick() : director;

    const t = performance.now();

    // timeouts
    for(const [id, it] of st.targets){
      if(t >= it.dieMs) timeoutTarget(id);
    }

    hud();

    const elapsed = (t - st.t0) / 1000;
    if(elapsed >= timeLimit){
      endGame('time');
    }
  }

  function startGame(){
    st.running = true;
    st.over = false;
    st.t0 = performance.now();
    st.score = 0;
    st.streak = 0;
    st.miss = 0;
    st.shield = 40;

    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    if(menu) menu.style.display = 'none';
    toast(view==='cvr' ? 'ยิงจากกากบาทกลางจอได้เลย!' : 'เริ่ม! กันละอองให้ได้มากที่สุด');

    director = fun ? fun.tick() : director;
    hud();

    scheduleSpawn();
    if(tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, 80);
  }

  function endGame(reason){
    if(st.over) return;
    st.over = true;
    st.running = false;

    if(spawnTimer) clearTimeout(spawnTimer);
    if(tickTimer) clearInterval(tickTimer);

    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    const msg = (reason==='time') ? 'ครบเวลา!' : 'Shield หมด!';
    toast(`จบเกม: ${msg}`);

    setTimeout(()=>{ if(menu) menu.style.display = 'flex'; }, 650);
  }

  // ----- Buttons -----
  if(btnStart) btnStart.addEventListener('click', startGame, { passive:true });

  if(btnBack) btnBack.addEventListener('click', ()=>{
    if(hub) location.href = hub;
    else history.back();
  }, { passive:true });

  // init
  hud();
})();