// === /herohealth/maskcough/maskcough.safe.js ===
// MaskCough SAFE Engine — DOM layer — FUN BOOST v1 integrated
// Mechanics:
// - 💦 droplet: tap to clear (good)
// - 🤧 cough: tap to block (perfect window) else hurts shield (bad)
// - 😷 mask: tap to gain shield
// - Fever: auto-clears nearby droplets on hit burst (simple power fantasy)

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
  const mode = (QS.get('mode')||'play').trim();
  const timeLimit = Math.max(20, parseInt(QS.get('time')||'60',10)); // seconds

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
  function toast(msg){
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
    lastTick: 0,

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
    targets: new Map(), // id -> {el, kind, bornMs, dieMs}
    uid: 0
  };

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  function hud(){
    tScore.textContent = String(st.score);
    tStreak.textContent = String(st.streak);
    tMiss.textContent = String(st.miss);

    const sh = clamp(st.shield, 0, 100);
    tMask.textContent = `${Math.round(sh)}%`;
    bMask.style.width = `${sh}%`;

    tWave.textContent = director.wave || '—';
    tInt.textContent = (director.intensity||0).toFixed(2);
    tFever.textContent = director.feverOn ? 'ON' : 'OFF';

    // fever bar: use feverCharge proxy if available
    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    bFever.style.width = `${pct}%`;
  }

  // ----- Target kinds -----
  // weights shift with intensity/wave
  function pickKind(){
    const feverOn = !!director.feverOn;
    const inten = director.intensity || 0;

    // base weights
    let wDroplet = 0.62;
    let wCough   = 0.24;
    let wMask    = 0.14;

    // harder when intensity high
    wCough += inten * 0.16;
    wDroplet -= inten * 0.10;
    wMask += (st.shield < 35 ? 0.10 : 0.00);

    // fever: more droplets (pop fantasy) + fewer masks
    if(feverOn){
      wDroplet += 0.10;
      wMask -= 0.08;
    }

    // normalize
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
  function layerRect(){
    return layer.getBoundingClientRect();
  }

  function spawn(){
    if(!st.running || st.over) return;

    const r = layerRect();

    // safe margin
    const pad = 52;
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
    const ttl = st.ttlMs * (director.timeScale || 1); // timeScale slightly changes TTL feel
    const die = born + ttl;

    st.targets.set(id, { el, kind, bornMs: born, dieMs: die });

    // tap/click
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      handleHit(id, 'tap');
    }, { passive:false });

    layer.appendChild(el);
  }

  // ----- Hit / Miss rules -----
  function handleHit(id, why){
    const it = st.targets.get(id);
    if(!it || st.over) return;

    const t = performance.now();
    const remain = it.dieMs - t;

    // remove now
    removeTarget(id, true);

    // Kind logic
    if(it.kind === 'droplet'){
      // good hit
      st.score += director.feverOn ? 2 : 1;
      st.streak += 1;

      // perfect if hit early-ish (reward)
      if(remain > st.ttlMs * 0.55){
        fun?.onAction({ type:'perfect' });
        st.score += 1; // bonus
      } else {
        fun?.onAction({ type:'hit' });
      }

      // fever fantasy: small auto-clear chance
      if(director.feverOn && Math.random() < 0.22){
        burstClear(1);
      }

    } else if(it.kind === 'mask'){
      // gain shield
      st.shield = clamp(st.shield + (director.feverOn ? 16 : 14), 0, 100);
      st.score += 1;
      st.streak += 1;
      fun?.onAction({ type:'hit' });
      toast('🛡️ Shield +');

    } else if(it.kind === 'cough'){
      // dangerous: perfect block if very late (near expiry) — creates “near miss dopamine”
      if(remain <= st.perfectWindowMs){
        st.score += 4;
        st.streak += 1;
        fun?.onAction({ type:'perfect' });
        toast('✨ Perfect Block!');
      } else {
        // early block still ok but less
        st.score += 2;
        st.streak += 1;
        fun?.onAction({ type:'hit' });
      }
    }

    hud();
  }

  function timeoutTarget(id){
    const it = st.targets.get(id);
    if(!it || st.over) return;

    // timeout => depends on kind
    removeTarget(id, false);

    if(it.kind === 'droplet'){
      // missed droplet: small penalty (infection risk)
      st.miss += 1;
      st.streak = 0;
      st.score = Math.max(0, st.score - 1);
      st.shield = clamp(st.shield - 6, 0, 100);
      fun?.onAction({ type:'timeout' });

      // near miss if expired very close to being “almost hit” (simple: low remaining at check time)
      fun?.onNearMiss?.({ reason:'ttl_droplet' });

    } else if(it.kind === 'mask'){
      // missing a mask is minor
      st.miss += 1;
      st.streak = 0;
      fun?.onAction({ type:'timeout' });

    } else if(it.kind === 'cough'){
      // big danger: cough hits you if you didn't block
      st.miss += 1;
      st.streak = 0;
      st.shield = clamp(st.shield - 16, 0, 100);
      st.score = Math.max(0, st.score - 2);
      fun?.onAction({ type:'timeout' });

      toast('😷 โดนละอองไอ!');
    }

    hud();

    // lose condition: shield depleted
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

    if(popped){
      el.classList.add('pop');
      el.classList.add('fade');
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
    } else {
      el.classList.add('fade');
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
    }
  }

  function burstClear(n){
    // clear n random droplets for fever fun
    const arr = Array.from(st.targets.entries()).filter(([,v])=> v.kind==='droplet');
    for(let i=0;i<Math.min(n, arr.length);i++){
      const [id] = arr[Math.floor(Math.random()*arr.length)];
      handleHit(id, 'burst');
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
      if(t >= it.dieMs){
        timeoutTarget(id);
      }
    }

    // update HUD
    hud();

    // time limit
    const elapsed = (t - st.t0) / 1000;
    if(elapsed >= timeLimit){
      endGame('time');
    }
  }

  function startGame(){
    // reset
    st.running = true;
    st.over = false;
    st.t0 = performance.now();
    st.score = 0;
    st.streak = 0;
    st.miss = 0;
    st.shield = 40;

    // clear layer
    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    menu.style.display = 'none';
    toast('เริ่ม! กันละอองให้ได้มากที่สุด');

    // run loop
    director = fun ? fun.tick() : director;
    hud();

    scheduleSpawn();
    tickTimer = setInterval(tick, 80);
  }

  function endGame(reason){
    if(st.over) return;
    st.over = true;
    st.running = false;

    if(spawnTimer) clearTimeout(spawnTimer);
    if(tickTimer) clearInterval(tickTimer);

    // clear remaining targets
    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    const msg = (reason==='time') ? 'ครบเวลา!' : 'Shield หมด!';
    toast(`จบเกม: ${msg}`);

    // show menu again (simple end)
    setTimeout(()=>{ menu.style.display = 'flex'; }, 650);
  }

  // ----- Buttons -----
  btnStart.addEventListener('click', startGame, { passive:true });

  btnBack.addEventListener('click', ()=>{
    if(hub) location.href = hub;
    else history.back();
  }, { passive:true });

  // init HUD once
  hud();

})();