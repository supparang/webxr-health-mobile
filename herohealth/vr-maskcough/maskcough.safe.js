// === /herohealth/vr-maskcough/maskcough.safe.js ===
// MaskCough SAFE Engine — PRODUCTION (Boss + Swipe + VR shoot + Presets + Summary + Gate)
// ✅ A: Boss Super Spreader (storm + shockwave + HP)
// ✅ B: Swipe mechanic (droplet/mask by swipe, cough risky)
// ✅ C: VR/cVR shoot via hha:shoot + lockPx aim assist
// ✅ Presets: grade5 / competitive / research (deterministic seed)
// ✅ End overlay + save HHA_LAST_SUMMARY + back hub
// ✅ Daily Gate: set HHA_ZONE_DONE::hygiene::YYYY-MM-DD when pass
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
  const research = (QS.get('research') === '1') || (mode === 'research');

  // ----- DOM -----
  const layer = DOC.getElementById('layer');
  const menu = DOC.getElementById('menu');
  const btnStart = DOC.getElementById('btnStart');
  const btnBack = DOC.getElementById('btnBack');

  const tScore = DOC.getElementById('tScore');
  const tStreak = DOC.getElementById('tStreak');
  const tBest = DOC.getElementById('tBest');
  const tMiss = DOC.getElementById('tMiss');
  const tMask = DOC.getElementById('tMask');
  const bMask = DOC.getElementById('bMask');

  const tWave = DOC.getElementById('tWave');
  const tInt = DOC.getElementById('tInt');
  const tFever = DOC.getElementById('tFever');
  const bFever = DOC.getElementById('bFever');

  const tBoss = DOC.getElementById('tBoss');
  const bBoss = DOC.getElementById('bBoss');

  const toastEl = DOC.getElementById('toast');
  let toastTimer = null;
  function toast(msg){
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = setTimeout(()=> toastEl.classList.remove('show'), 1200);
  }

  // end overlay
  const endEl = DOC.getElementById('end');
  const endReasonEl = DOC.getElementById('endReason');
  const endBadgeEl = DOC.getElementById('endBadge');
  const endScoreEl = DOC.getElementById('endScore');
  const endShieldEl = DOC.getElementById('endShield');
  const endBestStreakEl = DOC.getElementById('endBestStreak');
  const endMissEl = DOC.getElementById('endMiss');
  const endCtxEl = DOC.getElementById('endCtx');

  const btnEndRetry = DOC.getElementById('btnEndRetry');
  const btnEndMenu = DOC.getElementById('btnEndMenu');
  const btnEndHub = DOC.getElementById('btnEndHub');

  // ----- date key (HUB compatible) -----
  function ymdLocal(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function zoneDoneKey(zone){ return `HHA_ZONE_DONE::${zone}::${ymdLocal()}`; }
  function setZoneDoneToday(zone){
    try{ localStorage.setItem(zoneDoneKey(zone), '1'); }catch(_){}
  }

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  // ----- Presets -----
  function preset(){
    if(research){
      return {
        name: 'research',
        baseSpawnMs: 820,
        ttlMs: 1750,
        perfectWindowMs: 240,
        shieldStart: 55,
        shieldRegenEveryStreak: 8,
        shieldRegenAmt: 5,
        dmgCough: 14,
        dmgDroplet: 5,
        boss: { on:true, nextAt: 22, maxHP: 12, durMs: 9500, stormEvery: 520, shockEvery: 2400, cap: 12 }
      };
    }
    if(diff === 'hard'){
      return {
        name: 'competitive',
        baseSpawnMs: 560,
        ttlMs: 1350,
        perfectWindowMs: 200,
        shieldStart: 40,
        shieldRegenEveryStreak: 10,
        shieldRegenAmt: 6,
        dmgCough: 18,
        dmgDroplet: 7,
        boss: { on:true, nextAt: 16, maxHP: 16, durMs: 12000, stormEvery: 360, shockEvery: 1900, cap: 16 }
      };
    }
    return {
      name: 'grade5',
      baseSpawnMs: (diff === 'easy') ? 860 : 760,
      ttlMs: (diff === 'easy') ? 1950 : 1700,
      perfectWindowMs: 230,
      shieldStart: 58,
      shieldRegenEveryStreak: 7,
      shieldRegenAmt: 7,
      dmgCough: 14,
      dmgDroplet: 5,
      boss: { on:true, nextAt: 20, maxHP: 10, durMs: 9000, stormEvery: 520, shockEvery: 2400, cap: 13 }
    };
  }
  const P = preset();

  // ----- deterministic RNG (research) -----
  const rng = (function(){
    if(!research) return { next: ()=> Math.random() };
    let a = 0;
    const s = (seed || '1234') + '::maskcough';
    for(let i=0;i<s.length;i++){ a = (a + s.charCodeAt(i) * 2654435761) >>> 0; }
    return {
      next: ()=> {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }
    };
  })();

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

  // ----- Input + pointer tracking -----
  const PTR = { x: 0, y: 0, has:false };
  WIN.addEventListener('pointermove', (ev)=>{ PTR.x = ev.clientX; PTR.y = ev.clientY; PTR.has = true; }, { passive:true });
  WIN.addEventListener('pointerdown', (ev)=>{ PTR.x = ev.clientX; PTR.y = ev.clientY; PTR.has = true; }, { passive:true });

  // ----- Game state -----
  const st = {
    running: false,
    over: false,
    t0: 0,

    score: 0,
    streak: 0,
    bestStreak: 0,
    miss: 0,

    shield: P.shieldStart,

    baseSpawnMs: P.baseSpawnMs,
    ttlMs: P.ttlMs,
    perfectWindowMs: P.perfectWindowMs,

    targets: new Map(),
    uid: 0,

    // boss
    bossOn: false,
    bossHP: 0,
    bossMax: P.boss.maxHP,
    bossNextAt: P.boss.nextAt,
    bossActiveUntil: 0,
    bossStormEveryMs: P.boss.stormEvery,
    bossShockEveryMs: P.boss.shockEvery,
    _bossStormT: 0,
    _bossShockT: 0,
    bossClears: 0,

    // input guard
    lastShotMs: 0,
    shotCooldownMs: 85
  };

  function canShoot(){
    const t = performance.now();
    if(t - st.lastShotMs < st.shotCooldownMs) return false;
    st.lastShotMs = t;
    return true;
  }

  function layerRect(){
    return layer.getBoundingClientRect();
  }

  function hud(){
    tScore.textContent = String(st.score);
    tStreak.textContent = String(st.streak);
    tBest.textContent = String(st.bestStreak);
    tMiss.textContent = String(st.miss);

    const sh = clamp(st.shield, 0, 100);
    tMask.textContent = `${Math.round(sh)}%`;
    bMask.style.width = `${sh}%`;

    tWave.textContent = director.wave || '—';
    tInt.textContent = (director.intensity||0).toFixed(2);
    tFever.textContent = director.feverOn ? 'ON' : 'OFF';

    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    bFever.style.width = `${pct}%`;

    if(st.bossOn){
      tBoss.textContent = `HP ${st.bossHP}/${st.bossMax}`;
      bBoss.style.width = `${clamp((st.bossHP/st.bossMax)*100, 0, 100)}%`;
    } else {
      tBoss.textContent = '—';
      bBoss.style.width = '0%';
    }
  }

  // ----- kinds -----
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

    const r = rng.next();
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

  // ----- spawn -----
  function spawnCore(kind){
    const r = layerRect();
    const pad = 52;

    const x = pad + rng.next() * Math.max(10, (r.width - pad*2));
    const y = pad + rng.next() * Math.max(10, (r.height - pad*2));

    const id = String(++st.uid);
    const el = DOC.createElement('div');
    el.className = cssClass(kind);
    el.textContent = emoji(kind);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.dataset.id = id;
    el.dataset.kind = kind;

    const born = performance.now();
    const ttl = (st.ttlMs * (director.timeScale || 1)) * (kind==='cough' ? 0.92 : 1.0);
    const die = born + ttl;

    st.targets.set(id, { el, kind, bornMs: born, dieMs: die });

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      handleHit(id, 'tap');
    }, { passive:false });

    layer.appendChild(el);
  }

  function spawn(){
    if(!st.running || st.over) return;
    spawnCore(pickKind());
  }

  function spawnForced(kind){
    if(!st.running || st.over) return;
    spawnCore(kind);
  }

  // ----- remove -----
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

  // ----- boss -----
  function startBoss(){
    if(!P.boss.on) return;
    st.bossOn = true;
    st.bossMax = P.boss.maxHP;
    st.bossHP = st.bossMax;
    st.bossActiveUntil = performance.now() + P.boss.durMs;
    st._bossStormT = performance.now();
    st._bossShockT = performance.now();
    toast('😈 BOSS: Super Spreader!');
    try{ WIN.dispatchEvent(new CustomEvent('hha:fx', {detail:{kind:'boss', amp:.9, text:'BOSS!', ms:520}})); }catch(_){}
    hud();
  }

  function endBoss(win){
    st.bossOn = false;
    st.bossActiveUntil = 0;
    st._bossStormT = 0;
    st._bossShockT = 0;

    if(win){
      st.bossClears += 1;
      st.score += 8;
      toast('🏆 Boss Down!');
      try{ WIN.dispatchEvent(new CustomEvent('hha:fx', {detail:{kind:'boss_down', amp:.95, text:'CLEAR!', ms:520}})); }catch(_){}
      st.bossNextAt += (diff==='hard' ? 22 : 18);
    }else{
      toast('😵 Boss Escaped!');
      st.bossNextAt += (diff==='hard' ? 16 : 14);
    }
    hud();
  }

  function bossStorm(count){
    const cap = P.boss.cap;
    if(st.targets.size >= cap) return;

    const c = Math.max(2, count|0);
    for(let i=0;i<c;i++){
      if(st.targets.size >= cap) break;
      spawnForced('cough');
    }
  }

  function bossShockwave(){
    const dmg = (st.shield < 20) ? 3 : 6;
    st.shield = clamp(st.shield - dmg, 0, 100);
    try{ WIN.dispatchEvent(new CustomEvent('hha:fx', {detail:{kind:'shock', amp:.7, text:'SHOCK!', ms:220}})); }catch(_){}
    if(st.shield <= 0) endGame('shield');
    hud();
  }

  // ----- hit test for swipe / shoot (aim assist lockPx) -----
  function hitTest(clientX, clientY, lockPx){
    const r = layerRect();
    const lx = clientX - r.left;
    const ly = clientY - r.top;

    const rad = Math.max(40, Number(lockPx)||0);
    const rad2 = rad*rad;

    for(const [id, it] of st.targets){
      const el = it.el;
      if(!el) continue;
      const ex = parseFloat(el.style.left||'0');
      const ey = parseFloat(el.style.top||'0');
      const dx = ex - lx, dy = ey - ly;
      const d2 = dx*dx + dy*dy;
      if(d2 <= rad2){
        return { id, kind: it.kind, d2 };
      }
    }
    return null;
  }

  // ----- fever burst clear -----
  function burstClear(n){
    const arr = Array.from(st.targets.entries()).filter(([,v])=> v.kind==='droplet');
    for(let i=0;i<Math.min(n, arr.length);i++){
      const [id] = arr[Math.floor(rng.next()*arr.length)];
      handleHit(id, 'burst');
    }
  }

  // ----- scoring / rules -----
  function handleHit(id, why){
    const it = st.targets.get(id);
    if(!it || st.over || !st.running) return;
    if(!canShoot()) return;

    const t = performance.now();
    const remain = it.dieMs - t;

    removeTarget(id, true);

    if(it.kind === 'droplet'){
      st.score += director.feverOn ? 2 : 1;
      st.streak += 1;
      st.bestStreak = Math.max(st.bestStreak, st.streak);

      if(remain > st.ttlMs * 0.55){
        fun?.onAction({ type:'perfect' });
        st.score += 1;
      } else {
        fun?.onAction({ type:'hit' });
      }

      if(director.feverOn && rng.next() < 0.22){
        burstClear(1);
      }

    } else if(it.kind === 'mask'){
      st.shield = clamp(st.shield + (director.feverOn ? 16 : 14), 0, 100);
      st.score += 1;
      st.streak += 1;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
      fun?.onAction({ type:'hit' });
      toast('🛡️ Shield +');

    } else if(it.kind === 'cough'){
      if(remain <= st.perfectWindowMs){
        st.score += 4;
        st.streak += 1;
        st.bestStreak = Math.max(st.bestStreak, st.streak);
        fun?.onAction({ type:'perfect' });
        toast('✨ Perfect Block!');
      } else {
        st.score += 2;
        st.streak += 1;
        st.bestStreak = Math.max(st.bestStreak, st.streak);
        fun?.onAction({ type:'hit' });
      }

      if(st.bossOn){
        st.bossHP = Math.max(0, st.bossHP - (remain <= st.perfectWindowMs ? 2 : 1));
        if(st.bossHP <= 0) endBoss(true);
      }
    }

    // regen (flow)
    if(st.streak > 0 && st.streak % P.shieldRegenEveryStreak === 0){
      st.shield = clamp(st.shield + P.shieldRegenAmt, 0, 100);
      toast('🛡️ Regen!');
    }

    hud();
  }

  function timeoutTarget(id){
    const it = st.targets.get(id);
    if(!it || st.over) return;

    // near-miss: pointer close at expiry
    if(PTR.has){
      const r = layerRect();
      const cx = parseFloat(it.el?.style.left||'0');
      const cy = parseFloat(it.el?.style.top||'0');
      const px = PTR.x - r.left;
      const py = PTR.y - r.top;
      const dx = cx - px, dy = cy - py;
      const d2 = dx*dx + dy*dy;
      if(d2 <= 46*46){
        fun?.onNearMiss?.({ reason:'pointer_close_timeout', kind: it.kind });
      }
    }

    removeTarget(id, false);

    if(it.kind === 'droplet'){
      st.miss += 1;
      st.streak = 0;
      st.score = Math.max(0, st.score - 1);
      st.shield = clamp(st.shield - P.dmgDroplet, 0, 100);
      fun?.onAction({ type:'timeout' });

    } else if(it.kind === 'mask'){
      st.miss += 1;
      st.streak = 0;
      fun?.onAction({ type:'timeout' });

    } else if(it.kind === 'cough'){
      st.miss += 1;
      st.streak = 0;
      const dmg = (st.shield < 25) ? Math.round(P.dmgCough * 0.7) : P.dmgCough;
      st.shield = clamp(st.shield - dmg, 0, 100);
      st.score = Math.max(0, st.score - 2);
      fun?.onAction({ type:'timeout' });
      toast('😷 โดนละอองไอ!');
    }

    hud();
    if(st.shield <= 0) endGame('shield');
  }

  // ----- Swipe mechanic -----
  const SW = { on:true, minDistPx: 28, lastX:0, lastY:0, down:false };

  layer.addEventListener('pointerdown', (ev)=>{
    if(!SW.on || !st.running || st.over) return;
    SW.down = true;
    SW.lastX = ev.clientX;
    SW.lastY = ev.clientY;
  }, { passive:true });

  layer.addEventListener('pointermove', (ev)=>{
    if(!SW.on || !SW.down || !st.running || st.over) return;
    const dx = ev.clientX - SW.lastX;
    const dy = ev.clientY - SW.lastY;
    const dist = Math.hypot(dx,dy);
    SW.lastX = ev.clientX;
    SW.lastY = ev.clientY;

    if(dist >= SW.minDistPx){
      if(!canShoot()) return;
      const ht = hitTest(ev.clientX, ev.clientY, 0);
      if(!ht) return;

      if(ht.kind === 'droplet' || ht.kind === 'mask'){
        handleHit(ht.id, 'swipe');
      } else if(ht.kind === 'cough'){
        // swipe can't block cough: risky mistake
        st.miss += 1;
        st.streak = 0;
        fun?.onAction({ type:'shot_miss' });
        hud();
        try{ WIN.dispatchEvent(new CustomEvent('hha:fx', {detail:{kind:'swipe_bad', amp:.55, text:'NO!', ms:160}})); }catch(_){}
      }
    }
  }, { passive:true });

  layer.addEventListener('pointerup', ()=>{ SW.down = false; }, { passive:true });
  layer.addEventListener('pointercancel', ()=>{ SW.down = false; }, { passive:true });

  // ----- VR/cVR shoot: hha:shoot -----
  function shootAtClientXY(cx, cy, lockPx){
    const ht = hitTest(cx, cy, lockPx);
    if(!ht){
      st.miss += 1;
      st.streak = 0;
      fun?.onAction({ type:'shot_miss' });
      hud();
      return;
    }
    handleHit(ht.id, 'shoot');
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!st.running || st.over) return;
    if(!canShoot()) return;

    const d = ev?.detail || {};
    const lockPx = d.lockPx;

    if(Number.isFinite(d.x) && Number.isFinite(d.y)){
      shootAtClientXY(d.x, d.y, lockPx);
      return;
    }
    const r = layerRect();
    shootAtClientXY(r.left + r.width/2, r.top + r.height/2, lockPx);
  });

  // ----- spawn schedule / tick -----
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

    // boss spawn
    if(!st.bossOn && P.boss.on && st.score >= st.bossNextAt){
      startBoss();
    }

    // boss loop
    if(st.bossOn){
      const tt = performance.now();
      if(tt >= st.bossActiveUntil){
        endBoss(false);
      } else {
        if(tt - st._bossStormT >= st.bossStormEveryMs){
          st._bossStormT = tt;
          const inten = director.intensity || 0;
          bossStorm((diff==='hard' ? 3 : 2) + (inten>0.55 ? 1 : 0));
        }
        if(tt - st._bossShockT >= st.bossShockEveryMs){
          st._bossShockT = tt;
          bossShockwave();
        }
      }
    }

    // timeouts
    const t = performance.now();
    for(const [id, it] of st.targets){
      if(t >= it.dieMs){
        timeoutTarget(id);
      }
    }

    // time limit
    const elapsed = (t - st.t0) / 1000;
    if(elapsed >= timeLimit){
      endGame('time');
    }

    hud();
  }

  // ----- Summary + Gate -----
  function nowIso(){
    const d = new Date();
    return d.toISOString();
  }

  function summaryBadge(sum){
    const score = sum.metrics?.score || 0;
    if(score >= 55) return '🏅 HERO';
    if(score >= 35) return '🥈 PRO';
    if(score >= 20) return '🥉 ROOKIE';
    return '🎯 TRY AGAIN';
  }

  function buildSummary(reason){
    const elapsedSec = Math.max(0, Math.round((performance.now() - st.t0)/1000));
    const ctx = {
      pid, diff, mode,
      seed,
      timeLimit,
      preset: P.name,
      view: (QS.get('view')||'').trim(),
      research: research ? 1 : 0
    };

    return {
      schema: 'HHA_LAST_SUMMARY_V1',
      game: 'maskcough',
      atIso: nowIso(),
      reason: reason || '',
      ctx,
      metrics: {
        score: st.score,
        miss: st.miss,
        streakBest: st.bestStreak,
        shieldLeft: Math.round(clamp(st.shield,0,100)),
        bossClears: st.bossClears,
        durationSec: elapsedSec
      }
    };
  }

  function saveLastSummary(sum){
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(sum));
      localStorage.setItem('HHA_LAST_SUMMARY_GAME', 'maskcough');
      localStorage.setItem('HHA_LAST_SUMMARY_AT', sum.atIso || '');
    }catch(_){}
  }

  function isGatePass(sum){
    const m = sum.metrics || {};
    const score = m.score || 0;
    const boss = m.bossClears || 0;
    const shield = m.shieldLeft || 0;
    if(score >= 20) return true;
    if(boss >= 1) return true;
    if(score >= 14 && shield >= 25) return true;
    return false;
  }

  function showEnd(sum){
    if(!endEl) return;
    const m = sum.metrics || {};
    const ctx = sum.ctx || {};

    endReasonEl.textContent = `Reason: ${sum.reason || '-'}`;
    endScoreEl.textContent = String(m.score ?? 0);
    endShieldEl.textContent = `${m.shieldLeft ?? 0}%`;
    endBestStreakEl.textContent = String(m.streakBest ?? 0);
    endMissEl.textContent = String(m.miss ?? 0);

    endBadgeEl.textContent = summaryBadge(sum);
    endCtxEl.textContent =
      `mode=${ctx.preset || ctx.mode || '-'} • diff=${ctx.diff || '-'} • seed=${ctx.seed || '-'} • t=${ctx.timeLimit || '-'}s`;

    endEl.style.display = 'flex';
  }
  function hideEnd(){ if(endEl) endEl.style.display = 'none'; }

  function safeFlushAndGoHub(){
    try{
      if(hub) location.href = hub;
      else location.href = new URL('../hub.html', location.href).toString();
    }catch(_){
      if(hub) location.href = hub;
      else history.back();
    }
  }

  // ----- Start / End -----
  function startGame(){
    st.running = true;
    st.over = false;
    st.t0 = performance.now();

    st.score = 0;
    st.streak = 0;
    st.bestStreak = 0;
    st.miss = 0;
    st.shield = P.shieldStart;

    st.bossOn = false;
    st.bossHP = 0;
    st.bossMax = P.boss.maxHP;
    st.bossNextAt = P.boss.nextAt;
    st.bossActiveUntil = 0;
    st._bossStormT = 0;
    st._bossShockT = 0;
    st.bossClears = 0;

    st.lastShotMs = 0;

    // clear layer
    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    hideEnd();
    menu.style.display = 'none';
    toast('เริ่ม! กันละอองให้ได้มากที่สุด');

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

    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    const msg = (reason==='time') ? 'ครบเวลา' : (reason==='shield' ? 'Shield หมด' : 'จบ');
    toast(`จบเกม: ${msg}`);

    const sum = buildSummary(String(reason||'end'));
    saveLastSummary(sum);

    // daily gate
    if(isGatePass(sum)){
      setZoneDoneToday('hygiene');
      try{ WIN.dispatchEvent(new CustomEvent('hha:fx', {detail:{kind:'gate', amp:.85, text:'Hygiene Gate DONE!', ms:520}})); }catch(_){}
    }

    setTimeout(()=> showEnd(sum), 250);
  }

  // ----- Buttons -----
  btnStart.addEventListener('click', startGame, { passive:true });
  btnBack.addEventListener('click', ()=> safeFlushAndGoHub(), { passive:true });

  btnEndRetry?.addEventListener('click', ()=>{ hideEnd(); startGame(); }, { passive:true });
  btnEndMenu?.addEventListener('click', ()=>{
    hideEnd();
    menu.style.display = 'flex';
  }, { passive:true });
  btnEndHub?.addEventListener('click', ()=> safeFlushAndGoHub(), { passive:true });

  // init HUD
  hud();
})();