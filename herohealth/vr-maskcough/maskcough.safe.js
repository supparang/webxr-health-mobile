// === /herohealth/vr-maskcough/maskcough.safe.js ===
// MaskCough SAFE Engine — FUN + AI Prediction (ML/DL hooks) — v20260214a
// Mechanics:
// - 💦 droplet: tap/shoot to clear (good)
// - 🤧 cough: must block near expiry for "Perfect" (risk/reward)
// - 😷 mask: tap to gain shield
// - Fever: power fantasy (burst clear + bonus)
// - Boss wave: Mega Cough chain, pass by perfect block
//
// Controls:
// - Mobile/PC: tap/click targets
// - cVR strict: crosshair shoot via ../vr/vr-ui.js (event: hha:shoot {x,y})
//
// URL params:
// ?hub=...&pid=...&seed=...&diff=easy|normal|hard&time=60&mode=play|study&view=pc|cvr|mobile
//
// Stores:
// - HHA_LAST_SUMMARY (latest result)
// - HHA_SUMMARY_HISTORY (append)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const $ = (s)=>DOC.querySelector(s);

  // ---------- helpers ----------
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function clamp01(x){ return clamp(x,0,1); }

  function toast(msg){
    const el = $('#toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove('show'), 1100);
  }

  function showPrompt(msg){
    const el = $('#mc-prompt');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showPrompt._t);
    showPrompt._t = setTimeout(()=> el.classList.remove('show'), 900);
  }

  function flash(){
    const el = $('#mc-flash');
    if(!el) return;
    el.style.opacity = '1';
    clearTimeout(flash._t);
    flash._t = setTimeout(()=> el.style.opacity = '0', 110);
  }

  function safeNum(x, d=0){
    const n = Number(x);
    return Number.isFinite(n) ? n : d;
  }

  function getQS(){
    try { return new URL(location.href).searchParams; }
    catch(_){ return new URLSearchParams(); }
  }

  function pageUrl(){ return location.href.split('#')[0]; }

  function getViewAuto(){
    const qs = getQS();
    const v = (qs.get('view')||'').toLowerCase();
    if(v) return v;

    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) ||
      (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'cvr' : 'pc';
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

  // ---------- AI / ML-DL (lightweight) ----------
  function sigmoid(x){
    if(x >= 0){ const z = Math.exp(-x); return 1/(1+z); }
    const z = Math.exp(x); return z/(1+z);
  }
  function nz(v, lo, hi){
    const x = (v - lo) / (hi - lo);
    return clamp01(x);
  }
  function createRiskModel(){
    const w = [ 2.2, 1.6, 2.0, 1.3, 1.4, 1.0, 0.8 ];
    const b = -1.4;
    return {
      predict(feat){
        let s = b;
        for(let i=0;i<w.length;i++) s += w[i] * (feat[i] || 0);
        return sigmoid(s);
      }
    };
  }
  function createTinyMLP(){
    const W1 = Array.from({length:8}, ()=>Array(7).fill(0));
    const B1 = Array(8).fill(0);
    const W2 = Array(8).fill(0);
    const B2 = 0;

    for(let i=0;i<8;i++){
      B1[i] = (i%2? -0.15: 0.12);
      for(let j=0;j<7;j++){
        W1[i][j] = ((i+1)*(j+2) % 7) * 0.03 - 0.09;
      }
      W2[i] = (i%2? 0.22 : -0.18);
    }
    function relu(x){ return x>0?x:0; }
    return {
      predict(feat){
        const h = new Array(8).fill(0);
        for(let i=0;i<8;i++){
          let s = B1[i];
          for(let j=0;j<7;j++) s += W1[i][j]*(feat[j]||0);
          h[i] = relu(s);
        }
        let o = B2;
        for(let i=0;i<8;i++) o += W2[i]*h[i];
        return sigmoid(o);
      }
    };
  }

  function createAIDirector(opts){
    const model = createRiskModel();
    const mlp = createTinyMLP();

    const cfg = {
      windowMs: 5000,
      enableDL: !!opts?.enableDL,
      alpha: 0.65,
      maxAssist: 0.45,
      coachCooldownMs: 8500,
    };

    const st = {
      lastT: 0,
      risk: 0.12,
      taps: 0, hits: 0, timeouts: 0,
      coughTimeouts: 0,
      perfects: 0,
      latencySum: 0, latencyN: 0,
      shieldNow: 40,
      shieldPrev: 40,
      shieldSlope: 0,
      coachT: 0,
      riskSum: 0,
      riskN: 0,
    };

    function reset(){
      st.lastT = performance.now();
      st.risk = 0.12;
      st.taps = st.hits = st.timeouts = 0;
      st.coughTimeouts = 0;
      st.perfects = 0;
      st.latencySum = 0; st.latencyN = 0;
      st.shieldPrev = st.shieldNow = 40;
      st.shieldSlope = 0;
      st.coachT = 0;
      st.riskSum = 0;
      st.riskN = 0;
    }

    function onTick(nowMs, shield){
      st.shieldNow = shield;

      // record risk average
      st.riskSum += st.risk;
      st.riskN += 1;

      if(nowMs - st.lastT >= cfg.windowMs){
        const total = Math.max(1, st.taps + st.timeouts);
        const hitRate = st.hits / total;
        const missRate = st.timeouts / total;

        const avgLat = st.latencyN ? (st.latencySum / st.latencyN) : 0;
        const coughFail = st.coughTimeouts / Math.max(1, st.timeouts);
        const perfectRate = st.perfects / Math.max(1, st.hits);

        st.shieldSlope = (st.shieldNow - st.shieldPrev) / 100;
        st.shieldPrev = st.shieldNow;

        const feat = [
          nz(missRate, 0.05, 0.55),
          nz(1-hitRate, 0.10, 0.70),
          nz(1-(st.shieldNow/100), 0.30, 0.95),
          nz(Math.max(0, -st.shieldSlope), 0.00, 0.30),
          nz(coughFail, 0.05, 0.60),
          nz(avgLat, 180, 650),
          nz(1-perfectRate, 0.20, 0.95),
        ];

        const r1 = model.predict(feat);
        const r2 = cfg.enableDL ? mlp.predict(feat) : r1;
        const r = cfg.enableDL ? (0.55*r1 + 0.45*r2) : r1;

        st.risk = cfg.alpha*st.risk + (1-cfg.alpha)*r;

        st.taps = st.hits = st.timeouts = 0;
        st.coughTimeouts = 0;
        st.perfects = 0;
        st.latencySum = 0; st.latencyN = 0;
        st.lastT = nowMs;
      }

      return st.risk;
    }

    function assistParams(){
      const a = Math.min(cfg.maxAssist, Math.max(0, (st.risk - 0.25) * 0.85));
      return {
        assist: a,
        maskBonus: 0.10 * a,
        coughPenalty: 0.14 * a,
        spawnSlow: 0.18 * a,
        ttlBoost: 0.14 * a,
        perfectBoost: 0.20 * a,
      };
    }

    function onEvent(ev){
      st.taps += 1;
      if(ev.type === 'hit'){
        st.hits += 1;
      } else if(ev.type === 'perfect'){
        st.hits += 1;
        st.perfects += 1;
      } else if(ev.type === 'timeout'){
        st.timeouts += 1;
        if(ev.kind === 'cough') st.coughTimeouts += 1;
      }
      if(Number.isFinite(ev.latencyMs)){
        st.latencySum += ev.latencyMs;
        st.latencyN += 1;
      }
    }

    function coachHint(nowMs, state){
      if(nowMs - st.coachT < cfg.coachCooldownMs) return null;

      // show hint only when risk notable or shield low
      if(st.risk < 0.42 && state.shield > 34) return null;

      st.coachT = nowMs;

      if(state.shield < 22) return '⚠️ โล่ใกล้หมด! รีบเก็บ 😷 เพิ่ม Shield ก่อน';
      if(st.risk > 0.70) return '🎯 โฟกัส 🤧 ตอนท้าย ๆ เพื่อ Perfect Block (คะแนนพุ่ง!)';
      if(state.miss >= 6) return '💦 อย่าให้ละอองหลุดเยอะ—ตี 💦 ให้ทันก่อน!';
      return '✨ สะสม streak แล้วจะเข้า FEVER ได้เร็วขึ้น!';
    }

    function riskAvg(){
      return st.riskN ? (st.riskSum / st.riskN) : st.risk;
    }

    return { reset, onTick, onEvent, assistParams, coachHint, riskAvg, get risk(){ return st.risk; } };
  }

  // ---------- Fun Boost integration (optional) ----------
  const qs = getQS();
  const hub = (qs.get('hub')||'../hub.html').trim();
  const pid = (qs.get('pid') || qs.get('participantId') || '').trim();
  const diff = (qs.get('diff')||'normal').trim();
  const seed = (qs.get('seed') || pid || 'maskcough').trim();
  const mode = (qs.get('mode')||qs.get('run')||'play').trim(); // play/study
  const timeLimit = Math.max(20, parseInt(qs.get('time')||'60',10)); // sec
  const view = getViewAuto();

  // DOM
  const wrap = $('#mc-wrap');
  const layer = $('#layer');

  const tScore = $('#tScore');
  const tStreak = $('#tStreak');
  const tMiss = $('#tMiss');
  const tMask = $('#tMask');
  const bMask = $('#bMask');

  const tWave = $('#tWave');
  const tInt = $('#tInt');
  const tFever = $('#tFever');
  const tRisk = $('#tRisk');

  const tFeverPct = $('#tFeverPct');
  const bFever = $('#bFever');

  const btnStart = $('#btnStart');
  const btnRetry = $('#btnRetry');
  const btnPause = $('#btnPause');
  const btnBack = $('#btnBack');

  const endEl = $('#end');
  const btnEndRetry = $('#btnEndRetry');
  const btnEndBack = $('#btnEndBack');

  if(wrap){
    wrap.dataset.view = view;
    wrap.dataset.run = mode;
  }

  // Back links with ctx passthrough
  function applyHubLink(a){
    if(!a) return;
    try{
      const u = new URL(hub, location.href);
      if(pid) u.searchParams.set('pid', pid);
      if(seed) u.searchParams.set('seed', seed);
      if(diff) u.searchParams.set('diff', diff);
      u.searchParams.set('view', view);
      a.href = u.toString();
    }catch(_){
      a.href = hub || '../hub.html';
    }
  }
  applyHubLink(btnEndBack);

  // Fun boost (global feel)
  const fun = WIN.HHA?.createFunBoost?.({
    seed: seed,
    baseSpawnMul: 1.0,
    waveCycleMs: 18000,
    feverThreshold: 16,
    feverDurationMs: 6500,
    feverSpawnBoost: 1.18,
    feverTimeScale: 0.92
  });

  let director = fun ? fun.tick() : {spawnMul:1,timeScale:1,wave:'calm',intensity:0,feverOn:false};

  // AI Director (DL only in play)
  const ai = createAIDirector({ enableDL: (mode === 'play') });

  // ---------- Game state ----------
  const st = {
    running:false,
    paused:false,
    over:false,

    t0:0,
    elapsedSec:0,

    score:0,
    streak:0,
    maxStreak:0,
    miss:0,
    perfect:0,

    shield:40, // 0..100

    // base spawn/ttl (we compute effective using director+ai)
    baseSpawnMs: (diff==='hard' ? 650 : diff==='easy' ? 880 : 760),
    ttlBaseMs:   (diff==='hard' ? 1450 : diff==='easy' ? 1850 : 1650),
    perfectBaseMs: 220,

    // boss pacing
    bossEveryMs: (diff==='hard' ? 20000 : diff==='easy' ? 26000 : 23000),
    nextBossAt: 0,
    bossActive:false,
    bossNeedPerfect:false,

    // targets
    targets: new Map(), // id -> {el, kind, bornMs, dieMs, x, y}
    uid:0,

    // rng
    rng: seededRng(seed),

    // risk
    risk: 0.12
  };

  function setHud(){
    if(tScore) tScore.textContent = String(st.score);
    if(tStreak) tStreak.textContent = String(st.streak);
    if(tMiss) tMiss.textContent = String(st.miss);

    const sh = clamp(st.shield,0,100);
    if(tMask) tMask.textContent = `${Math.round(sh)}%`;
    if(bMask) bMask.style.width = `${sh}%`;

    if(tWave) tWave.textContent = director.wave || '—';
    if(tInt) tInt.textContent = (director.intensity||0).toFixed(2);
    if(tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';

    if(tRisk) tRisk.textContent = (st.risk||0).toFixed(2);

    // fever bar via fun state if available
    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    if(bFever) bFever.style.width = `${pct}%`;
    if(tFeverPct) tFeverPct.textContent = `${Math.round(pct)}%`;
  }

  function emoji(kind){
    if(kind==='droplet') return '💦';
    if(kind==='cough') return '🤧';
    if(kind==='mask') return '😷';
    if(kind==='infected') return '🦠';
    if(kind==='boss') return '🤧';
    return '🎯';
  }
  function cssClass(kind){
    if(kind==='droplet') return 't good';
    if(kind==='infected') return 't bad';
    if(kind==='cough') return 't cough bad';
    if(kind==='mask') return 't mask';
    if(kind==='boss') return 't cough bad';
    return 't';
  }

  function layerRect(){ return layer.getBoundingClientRect(); }

  // pick kind (with AI assist)
  function pickKind(){
    const feverOn = !!director.feverOn;
    const inten = director.intensity || 0;
    const ap = ai?.assistParams?.() || {maskBonus:0,coughPenalty:0};

    let wDroplet = 0.60;
    let wCough   = 0.24;
    let wMask    = 0.16;

    // intensity
    wCough += inten * 0.16;
    wDroplet -= inten * 0.10;

    // AI assist
    wMask += ap.maskBonus;
    wCough -= ap.coughPenalty;

    // shield low => more mask
    wMask += (st.shield < 35 ? 0.10 : 0.00);

    // fever fantasy
    if(feverOn){
      wDroplet += 0.10;
      wMask -= 0.06;
    }

    // clamp sane
    wDroplet = Math.max(0.34, wDroplet);
    wCough   = Math.max(0.10, wCough);
    wMask    = Math.max(0.08, wMask);

    const sum = wDroplet + wCough + wMask;
    wDroplet/=sum; wCough/=sum; wMask/=sum;

    const r = st.rng();
    if(r < wDroplet) return 'droplet';
    if(r < wDroplet + wCough) return 'cough';
    return 'mask';
  }

  function spawnAt(kind, x, y, ttlMs){
    if(!st.running || st.over || st.paused) return;

    const id = String(++st.uid);
    const el = DOC.createElement('div');
    el.className = cssClass(kind);
    el.textContent = emoji(kind);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.dataset.id = id;
    el.dataset.kind = kind;

    const born = performance.now();
    const die = born + ttlMs;

    st.targets.set(id, { el, kind, bornMs: born, dieMs: die, x, y });

    // tap/click (pc/mobile)
    el.addEventListener('pointerdown', (ev)=>{
      if(view === 'cvr') return; // strict: shoot only
      ev.preventDefault();
      handleHit(id, 'tap');
    }, { passive:false });

    layer.appendChild(el);
  }

  function spawn(){
    if(!st.running || st.over || st.paused) return;

    const r = layerRect();
    const pad = 52;

    const x = pad + st.rng() * Math.max(10, (r.width - pad*2));
    const y = pad + st.rng() * Math.max(10, (r.height - pad*2));

    // effective params from director + AI
    const ap = ai.assistParams();
    const baseSpawn = st.baseSpawnMs;
    const effSpawnMul = (director.spawnMul || 1) * (1 - ap.spawnSlow);
    const effTimeScale = (director.timeScale || 1);

    const ttlMs = Math.round(st.ttlBaseMs * effTimeScale * (1 + ap.ttlBoost));

    // boss check
    if(st.bossActive){
      // spawn boss cough chain (fixed)
      spawnAt('boss', x, y, Math.max(720, Math.round(ttlMs*0.78)));
      return;
    }

    // maybe infected droplet when intensity high (adds danger)
    let kind = pickKind();
    if(kind==='droplet' && !director.feverOn && (director.intensity||0) > 0.62 && st.rng() < 0.18){
      kind = 'infected';
    }

    spawnAt(kind, x, y, ttlMs);
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
    // clear n random droplets/ infected for fever fun (prefer droplet)
    const arr = Array.from(st.targets.entries()).filter(([,v])=> v.kind==='droplet' || v.kind==='infected');
    for(let i=0;i<Math.min(n, arr.length);i++){
      const [id] = arr[Math.floor(st.rng()*arr.length)];
      handleHit(id, 'burst');
    }
  }

  function coughShockwave(x, y){
    // transform nearby droplets into infected (panic moment)
    const radius = 130;
    for(const [id, it] of st.targets){
      if(it.kind !== 'droplet') continue;
      const dx = it.x - x;
      const dy = it.y - y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if(d <= radius){
        // mutate: remove old + spawn infected at same spot
        removeTarget(id, false);
        spawnAt('infected', it.x, it.y, Math.max(560, Math.round(st.ttlBaseMs*0.72)));
      }
    }
    flash();
    toast('🤧 Shockwave!');
  }

  function handleHit(id, why){
    const it = st.targets.get(id);
    if(!it || st.over || st.paused) return;

    const t = performance.now();
    const remain = it.dieMs - t;

    // remove now
    removeTarget(id, true);

    // effective perfect window (with AI)
    const ap = ai.assistParams();
    const perfectWindow = Math.round(st.perfectBaseMs * (1 + ap.perfectBoost));

    if(it.kind === 'droplet'){
      st.score += director.feverOn ? 2 : 1;
      st.streak += 1;

      // early hit bonus
      const ttlApprox = st.ttlBaseMs;
      if(remain > ttlApprox * 0.55){
        st.score += 1;
        ai.onEvent({ type:'perfect', kind:'droplet', remainMs: remain, latencyMs: t - it.bornMs, atMs: t });
        fun?.onAction?.({ type:'perfect' });
      } else {
        ai.onEvent({ type:'hit', kind:'droplet', remainMs: remain, latencyMs: t - it.bornMs, atMs: t });
        fun?.onAction?.({ type:'hit' });
      }

      // fever fantasy: small auto-clear chance
      if(director.feverOn && st.rng() < 0.24){
        burstClear(1);
      }

    } else if(it.kind === 'infected'){
      // bad hit: penalty (teach discrimination)
      st.miss += 1;
      st.streak = 0;
      st.score = Math.max(0, st.score - 2);
      st.shield = clamp(st.shield - 10, 0, 100);
      flash();
      toast('🦠 โดนเชื้อ!');

      ai.onEvent({ type:'hit', kind:'infected', remainMs: remain, latencyMs: t - it.bornMs, atMs: t });
      fun?.onAction?.({ type:'timeout' });

    } else if(it.kind === 'mask'){
      st.shield = clamp(st.shield + (director.feverOn ? 16 : 14), 0, 100);
      st.score += 1;
      st.streak += 1;
      toast('🛡️ Shield +');

      ai.onEvent({ type:'hit', kind:'mask', remainMs: remain, latencyMs: t - it.bornMs, atMs: t });
      fun?.onAction?.({ type:'hit' });

    } else if(it.kind === 'cough' || it.kind === 'boss'){
      // perfect block very late
      if(remain <= perfectWindow){
        st.score += (it.kind === 'boss' ? 6 : 4);
        st.streak += 1;
        st.perfect += 1;
        toast('✨ Perfect Block!');
        ai.onEvent({ type:'perfect', kind:'cough', remainMs: remain, latencyMs: t - it.bornMs, atMs: t });
        fun?.onAction?.({ type:'perfect' });

        // boss pass condition
        if(st.bossActive) st.bossNeedPerfect = false;

        // small fever charge help
        if(fun?.onAction) fun.onAction({ type:'perfect' });

      } else {
        st.score += 2;
        st.streak += 1;
        ai.onEvent({ type:'hit', kind:'cough', remainMs: remain, latencyMs: t - it.bornMs, atMs: t });
        fun?.onAction?.({ type:'hit' });
      }
    }

    st.maxStreak = Math.max(st.maxStreak, st.streak);

    // fever periodic burst
    if(director.feverOn && st.rng() < 0.10){
      burstClear(1);
    }

    setHud();

    if(st.shield <= 0){
      endGame('shield');
    }
  }

  function timeoutTarget(id){
    const it = st.targets.get(id);
    if(!it || st.over || st.paused) return;

    removeTarget(id, false);

    if(it.kind === 'droplet'){
      st.miss += 1;
      st.streak = 0;
      st.score = Math.max(0, st.score - 1);
      st.shield = clamp(st.shield - 6, 0, 100);
      fun?.onAction?.({ type:'timeout' });

      ai.onEvent({ type:'timeout', kind:'droplet', latencyMs: performance.now() - it.bornMs, atMs: performance.now() });

    } else if(it.kind === 'infected'){
      // infected expiring is GOOD (you avoided it)
      st.score += 1;
      fun?.onAction?.({ type:'hit' });
      ai.onEvent({ type:'timeout', kind:'infected', latencyMs: performance.now() - it.bornMs, atMs: performance.now() });

    } else if(it.kind === 'mask'){
      st.miss += 1;
      st.streak = 0;
      fun?.onAction?.({ type:'timeout' });
      ai.onEvent({ type:'timeout', kind:'mask', latencyMs: performance.now() - it.bornMs, atMs: performance.now() });

    } else if(it.kind === 'cough' || it.kind === 'boss'){
      st.miss += 1;
      st.streak = 0;
      st.shield = clamp(st.shield - (it.kind === 'boss' ? 22 : 16), 0, 100);
      st.score = Math.max(0, st.score - 2);
      toast('😷 โดนละอองไอ!');
      flash();

      // shockwave makes it intense
      coughShockwave(it.x, it.y);

      fun?.onAction?.({ type:'timeout' });
      ai.onEvent({ type:'timeout', kind:'cough', latencyMs: performance.now() - it.bornMs, atMs: performance.now() });
    }

    setHud();

    if(st.shield <= 0){
      endGame('shield');
    }
  }

  // ---------- timers ----------
  let spawnTimer = null;
  let tickTimer = null;

  function scheduleSpawn(){
    if(spawnTimer) clearTimeout(spawnTimer);
    if(!st.running || st.over || st.paused) return;

    const ap = ai.assistParams();
    const base = st.baseSpawnMs;
    const every = fun ? fun.scaleIntervalMs(base, director) : base;
    const eff = Math.max(220, Math.round(every * (1 + ap.spawnSlow))); // slow down when assisting
    spawnTimer = setTimeout(()=>{
      spawn();
      scheduleSpawn();
    }, eff);
  }

  function maybeBoss(nowMs){
    if(!st.running || st.over || st.paused) return;
    if(st.bossActive) return;

    if(nowMs >= st.nextBossAt){
      st.bossActive = true;
      st.bossNeedPerfect = true;
      showPrompt('👿 BOSS WAVE! ทำ Perfect Block อย่างน้อย 1 ครั้ง!');
      toast('BOSS INCOMING');

      // boss lasts short, spawns chain
      const bossDur = (diff==='hard' ? 3200 : 3800);
      const endAt = nowMs + bossDur;

      const bossTick = ()=>{
        const t = performance.now();
        if(t >= endAt || st.over || st.paused){
          st.bossActive = false;

          if(st.bossNeedPerfect){
            // fail boss => big penalty
            st.shield = clamp(st.shield - 18, 0, 100);
            st.score = Math.max(0, st.score - 4);
            flash();
            toast('❌ บอสไม่ผ่าน!');
          } else {
            // pass => reward
            st.shield = clamp(st.shield + 12, 0, 100);
            st.score += 6;
            toast('✅ ผ่านบอส! +Shield');
            // small fever burst
            burstClear(2);
          }
          setHud();
          st.nextBossAt = performance.now() + st.bossEveryMs;
          return;
        }
        // keep spawning via normal schedule
        setTimeout(bossTick, 160);
      };
      bossTick();
    }
  }

  function tick(){
    if(!st.running || st.over || st.paused) return;

    director = fun ? fun.tick() : director;

    const nowMs = performance.now();

    // AI risk
    st.risk = ai.onTick(nowMs, st.shield);

    // coach
    const hint = ai.coachHint(nowMs, { shield: st.shield, miss: st.miss });
    if(hint) showPrompt(hint);

    // timeouts
    for(const [id, it] of st.targets){
      if(nowMs >= it.dieMs){
        timeoutTarget(id);
      }
    }

    // fever fantasy: periodic burst
    if(director.feverOn && st.rng() < 0.10){
      burstClear(1);
    }

    // boss scheduling
    maybeBoss(nowMs);

    // time limit
    st.elapsedSec = (nowMs - st.t0) / 1000;
    if(st.elapsedSec >= timeLimit){
      endGame('time');
      return;
    }

    // emergency save (rare, fair)
    if(st.risk > 0.78 && st.shield < 18){
      st.shield = Math.min(100, st.shield + 10);
    }

    setHud();
  }

  // ---------- cVR shoot integration ----------
  function pickTargetAt(x, y){
    // choose nearest target center within radius
    let bestId = null;
    let bestD = 1e9;
    const rad = 54; // px
    for(const [id, it] of st.targets){
      const dx = it.x - x;
      const dy = it.y - y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if(d <= rad && d < bestD){
        bestD = d; bestId = id;
      }
    }
    return bestId;
  }

  function onShoot(ev){
    if(!st.running || st.over || st.paused) return;
    if(view !== 'cvr') return;

    const r = layerRect();
    const x = clamp((ev?.detail?.x ?? (r.left + r.width/2)) - r.left, 0, r.width);
    const y = clamp((ev?.detail?.y ?? (r.top + r.height/2)) - r.top, 0, r.height);

    const id = pickTargetAt(x, y);
    if(id) handleHit(id, 'shoot');
  }

  WIN.addEventListener('hha:shoot', onShoot);

  // ---------- summary store ----------
  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  function saveSummary(sum){
    try{
      localStorage.setItem(LS_LAST, JSON.stringify(sum));
      const arr = JSON.parse(localStorage.getItem(LS_HIST)||'[]');
      arr.push(sum);
      while(arr.length > 60) arr.shift();
      localStorage.setItem(LS_HIST, JSON.stringify(arr));
    }catch(_){}
  }

  function makeBadges(){
    const b = [];
    if(st.perfect >= 3) b.push({ id:'PERFECT_3', label:'✨ Perfect x3' });
    if(st.maxStreak >= 12) b.push({ id:'STREAK_12', label:'🔥 Streak 12' });
    if(st.miss <= 3 && st.elapsedSec >= timeLimit-0.2) b.push({ id:'CLEAN_RUN', label:'🧼 Clean Run' });
    if(st.shield >= 60) b.push({ id:'SHIELD_MASTER', label:'🛡️ Shield Master' });
    return b;
  }

  function renderEnd(reason){
    const set = (id, v)=>{ const el = DOC.getElementById(id); if(el) el.textContent = String(v); };

    set('tEndReason', reason);
    set('sScore', st.score);
    set('sMaxStreak', st.maxStreak);
    set('sMiss', st.miss);
    set('sPerfect', st.perfect);
    set('sShield', Math.round(st.shield) + '%');
    set('sRisk', ai.riskAvg().toFixed(2));

    const badgeRow = DOC.getElementById('badgeRow');
    const badges = makeBadges();
    if(badgeRow){
      badgeRow.innerHTML = badges.length
        ? badges.map(x=> `<span class="mc-badge-chip">${x.label}</span>`).join('')
        : `<span class="mc-badge-chip">🙂 Keep going</span>`;
    }

    const note = DOC.getElementById('endNote');
    if(note){
      note.textContent = `pid=${pid||'—'} | diff=${diff} | mode=${mode} | view=${view} | time=${timeLimit}s | seed=${seed}`;
    }

    if(endEl) endEl.hidden = false;
  }

  // ---------- start/pause/end ----------
  function clearAllTargets(){
    for(const [id] of st.targets){
      removeTarget(id, false);
    }
    st.targets.clear();
  }

  function startGame(){
    if(endEl) endEl.hidden = true;

    st.running = true;
    st.paused = false;
    st.over = false;

    st.t0 = performance.now();
    st.elapsedSec = 0;

    st.score = 0;
    st.streak = 0;
    st.maxStreak = 0;
    st.miss = 0;
    st.perfect = 0;

    st.shield = 40;

    clearAllTargets();

    director = fun ? fun.tick() : director;
    ai.reset();

    st.nextBossAt = performance.now() + st.bossEveryMs;
    st.bossActive = false;
    st.bossNeedPerfect = false;

    toast('เริ่ม! กันละอองให้ได้มากที่สุด');
    setHud();

    scheduleSpawn();
    if(tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, 80);
  }

  function togglePause(){
    if(!st.running || st.over) return;
    st.paused = !st.paused;
    if(st.paused){
      toast('⏸ Pause');
    }else{
      toast('▶ Resume');
      // reset boss timer a bit so it doesn't surprise instantly
      st.nextBossAt = performance.now() + 9000;
      scheduleSpawn();
    }
  }

  function endGame(reason){
    if(st.over) return;
    st.over = true;
    st.running = false;
    st.paused = false;

    if(spawnTimer) clearTimeout(spawnTimer);
    if(tickTimer) clearInterval(tickTimer);

    clearAllTargets();

    const summary = {
      game: 'maskcough',
      ts: Date.now(),
      pid: pid || '',
      hub: hub || '',
      diff,
      mode,
      view,
      seed,
      timePlannedSec: timeLimit,
      timePlayedSec: Math.round(st.elapsedSec*10)/10,
      score: st.score,
      streakMax: st.maxStreak,
      miss: st.miss,
      perfect: st.perfect,
      shieldEnd: Math.round(st.shield),
      riskAvg: Math.round(ai.riskAvg()*100)/100,
      reason
    };
    saveSummary(summary);

    toast(reason==='time' ? 'ครบเวลา!' : 'Shield หมด!');
    renderEnd(reason);
  }

  // ---------- bind UI ----------
  if(btnStart) btnStart.addEventListener('click', startGame, { passive:true });
  if(btnRetry) btnRetry.addEventListener('click', startGame, { passive:true });
  if(btnPause) btnPause.addEventListener('click', togglePause, { passive:true });

  if(btnBack) btnBack.addEventListener('click', ()=>{
    try{
      const u = new URL(hub || '../hub.html', location.href);
      if(pid) u.searchParams.set('pid', pid);
      if(seed) u.searchParams.set('seed', seed);
      u.searchParams.set('view', view);
      location.href = u.toString();
    }catch(_){
      location.href = hub || '../hub.html';
    }
  }, { passive:true });

  if(btnEndRetry) btnEndRetry.addEventListener('click', startGame, { passive:true });

  // ---------- init ----------
  setHud();
  showPrompt(view==='cvr'
    ? '🎯 cVR: ยิงด้วยกากบาท (แตะจอเพื่อยิง) เป้าในชั้นเล่นจะไม่รับ tap ตรง ๆ'
    : 'แตะ 💦 เพื่อปัด • แตะ 😷 เพิ่มโล่ • 🤧 ช่วงท้าย = Perfect!');
})();