/* === /herohealth/vr-brush/brush.safe.js ===
BrushVR SAFE — Plaque Breaker (HHA Standard-ish) v20260217a
✅ Tap/Click + Crosshair Shoot (cVR via vr-ui.js -> hha:shoot)
✅ Boss plaque (multi-hit)
✅ Laser + Shockwave + Finisher (PACK B)
✅ FX overlay (PACK C)
✅ AI prediction hooks (PACK D) via ai-brush.js (?ai=1 play only)
✅ Summary + Back Hub + Save last summary
*/

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

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
    const hub = qs.get('hub') || ctx.hub || '../hub.html';
    return hub;
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

  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail })); }catch(_){}
  }

  // ---------- FX (PACK C) ----------
  const fxFlash = DOC.getElementById('fx-flash');
  const fxLaser = DOC.getElementById('fx-laser');
  const fxShock = DOC.getElementById('fx-shock');
  const fxFin   = DOC.getElementById('fx-fin');

  function fxOn(el, ms){
    if(!el) return;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(()=>{ try{ el.classList.remove('on'); }catch{} }, ms||220);
  }
  function fxSet(el, on){
    if(!el) return;
    if(on) el.classList.add('on');
    else el.classList.remove('on');
  }

  // ---------- AI helper: send to HUD via brush.boot.js ----------
  function emitBrushAI(type, payload){
    try{
      WIN.dispatchEvent(new CustomEvent('brush:ai', { detail: Object.assign({type}, payload||{}) }));
    }catch{}
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

  // ---------- context ----------
  const qs = getQS();
  const ctx = {
    hub: qs.get('hub') || '../hub.html',
    run: qs.get('run') || qs.get('mode') || 'play',
    view: getViewAuto(),
    diff: (qs.get('diff') || 'normal').toLowerCase(),
    time: safeNum(qs.get('time'), 80),
    seed: safeNum(qs.get('seed'), Date.now()),
    pid: (qs.get('pid') || qs.get('participantId') || '').trim(),
    studyId: (qs.get('studyId') || '').trim(),
    phase: (qs.get('phase') || '').trim(),
    conditionGroup: (qs.get('conditionGroup') || '').trim(),
    log: (qs.get('log') || '').trim(),
    ai: (qs.get('ai') || '0').trim(),
    debug: (qs.get('debug') || '0').trim()
  };

  ctx.time = clamp(ctx.time, 30, 120);

  // update view & back hub
  wrap.dataset.view = ctx.view;
  DOC.body.setAttribute('data-view', ctx.view);

  ctxView.textContent = ctx.view;
  ctxSeed.textContent = String((ctx.seed >>> 0));
  ctxTime.textContent = `${ctx.time}s`;
  diffTag.textContent = ctx.diff;

  mDiff.textContent = ctx.diff;
  mTime.textContent = `${ctx.time}s`;

  function setBackLinks(){
    const hubUrl = passHubUrl(ctx);
    for (const a of [btnBack, btnBackHub2]){
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

  // rng
  const rng = seededRng(ctx.seed);
  const r01 = ()=>rng();
  const rInt = (a,b)=>Math.floor(a + r01()*(b-a+1));

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

  // ---------- AI hooks (PACK D) ----------
  const AI_ENABLED = (ctx.run === 'play' && String(ctx.ai)==='1' && WIN.HHA && typeof WIN.HHA.createAIHooks === 'function');
  const ai = AI_ENABLED ? WIN.HHA.createAIHooks({ seed: ctx.seed, diff: ctx.diff, mode: ctx.run }) : null;

  // ---------- game state ----------
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

    clean:0, // 0..100
    cleanGainPerHit: 1.2,
    cleanLosePerMiss: 0.6,

    // spawn config
    baseSpawnMs: 760,
    ttlMs: 1650,
    perfectWindowMs: 220,

    // boss
    bossEveryPct: 28,
    nextBossAt: 28,
    bossActive:false,

    uid:0,
    targets: new Map(),

    // hazards
    laserOn:false,
    laserUntil:0,
    laserCooldownUntil:0,

    shockOn:false,
    shockPulses:0,
    shockPulseIdx:0,
    shockNextAt:0,
    shockOpenUntil:0,

    // finisher
    finisherOn:false,
    finisherNeed:0,
    finisherHit:0,
  };

  // diff tuning
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

  function hud(force){
    const t = now();
    if(!force && t - st.lastHud < 60) return;
    st.lastHud = t;

    tScore.textContent = String(st.score);
    tCombo.textContent = String(st.combo);
    tMiss.textContent  = String(st.miss);

    const elapsed = st.running ? ((t - st.t0)/1000) : 0;
    const left = st.running ? Math.max(0, ctx.time - elapsed) : ctx.time;
    tTime.textContent = left.toFixed(0);

    const clean = clamp(st.clean, 0, 100);
    tClean.textContent = `${Math.round(clean)}%`;
    bClean.style.width = `${clean}%`;

    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    tFever.textContent = director.feverOn ? 'ON' : 'OFF';
    bFever.style.width = `${pct}%`;
  }

  function layerRect(){ return layer.getBoundingClientRect(); }

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

    const born = now();
    const ttl = st.ttlMs * (director.timeScale || 1);
    const die  = born + ttl;

    st.targets.set(id, { el, kind, bornMs: born, dieMs: die, hpMax, hp: hpMax, fillEl: fill, x, y });

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onHitAt(x, y, { source:'tap', targetId:id });
    }, { passive:false });

    layer.appendChild(el);
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

  function gradeFromAcc(acc){
    if(acc >= 92) return 'S';
    if(acc >= 82) return 'A';
    if(acc >= 70) return 'B';
    if(acc >= 55) return 'C';
    return 'D';
  }

  // ===== PACK B: hazards/finisher =====
  function startLaser(){
    const t = now();
    if(st.laserCooldownUntil && t < st.laserCooldownUntil) return;

    st.laserOn = true;
    st.laserUntil = t + (ctx.diff==='hard' ? 1500 : 1300);
    st.laserCooldownUntil = t + (ctx.diff==='hard' ? 5200 : 6200);

    emitBrushAI('laser_warn', { sub:'เลเซอร์จะกวาด!', mini:'ห้ามตีช่วงนี้' });
    setTimeout(()=> emitBrushAI('laser_on', { sub:'LASER SWEEP!', mini:'หยุดตี รอผ่าน' }), 260);

    fxOn(fxLaser, 1250);
  }
  function endLaser(){ st.laserOn = false; }

  function startShock(){
    const t = now();
    st.shockOn = true;
    st.shockPulses = (ctx.diff==='hard'? 4 : 3);
    st.shockPulseIdx = 0;
    st.shockNextAt = t + 420;
    st.shockOpenUntil = 0;

    emitBrushAI('shock_on', { sub:'SHOCKWAVE!', mini:'ตีเฉพาะตอน “วงเขียว”' });
  }
  function stopShock(){
    st.shockOn = false;
    st.shockPulses = 0;
    st.shockPulseIdx = 0;
    st.shockNextAt = 0;
    st.shockOpenUntil = 0;
  }

  function startFinisher(){
    st.finisherOn = true;
    st.finisherNeed = (ctx.diff==='hard'? 8 : ctx.diff==='easy'? 6 : 7);
    st.finisherHit = 0;
    emitBrushAI('finisher_on', { sub:'FINISHER!', mini:`ทำ PERFECT ให้ครบ ${st.finisherNeed} ครั้ง` });
    fxSet(fxFin, true);
  }

  function spawnOne(){
    if(!st.running || st.paused || st.over) return;

    director = fun ? fun.tick() : director;

    // AI difficulty blend
    let aiD = null;
    if(ai){
      aiD = ai.getDifficulty?.();
    }

    const intensity = clamp((director?.intensity ?? 0) + (aiD?.intensity ?? 0), 0, 0.75);

    // hazard chance (no overlap)
    const laserChance = (ctx.diff==='hard'? 0.09 : 0.06) + intensity*0.05;
    const shockChance = (ctx.diff==='hard'? 0.08 : 0.05) + intensity*0.04;

    if(!st.laserOn && !st.shockOn){
      const roll = rng();
      if(roll < laserChance) startLaser();
      else if(roll < laserChance + shockChance) startShock();
    }

    const r = layerRect();
    const pad = 56;

    const x = pad + rng() * Math.max(10, (r.width - pad*2));
    const y = pad + rng() * Math.max(10, (r.height - pad*2));

    // boss rule
    if(!st.bossActive && st.clean >= st.nextBossAt && st.clean < 100){
      st.bossActive = true;

      const baseHp = (ctx.diff==='hard'? 5 : ctx.diff==='easy'? 3 : 4);
      const hpMax = Math.max(2, Math.round(baseHp * (aiD?.bossMul ?? 1)));

      mkTarget({ x, y, kind:'boss', hpMax });
      toast('💎 BOSS PLAQUE!');
      emitBrushAI('boss_start', {});
      return;
    }

    mkTarget({ x, y, kind:'plaque', hpMax: 1 });
  }

  function onPerfect(){
    fun?.onAction?.({ type:'perfect' });
    st.score += 2;
    toast('✨ Perfect!');
    fxOn(fxFlash, 140);

    if(st.finisherOn){
      st.finisherHit += 1;
      if(st.finisherHit >= st.finisherNeed){
        st.clean = clamp(st.clean + 18, 0, 100);
        st.finisherOn = false;
        fxSet(fxFin, false);
        toast('🏁 FINISH สำเร็จ!');
      }
    }
  }

  function onHitTarget(it, remainMs){
    st.hits += 1;

    if(remainMs <= st.perfectWindowMs) onPerfect();
    else fun?.onAction?.({ type:'hit' });

    st.combo += 1;
    st.comboMax = Math.max(st.comboMax, st.combo);

    const comboMul = 1 + Math.min(0.6, st.combo * 0.02);
    const base = (it.kind==='boss') ? 3 : 1;
    st.score += Math.round(base * comboMul * (director.feverOn ? 1.3 : 1.0));

    const gain = st.cleanGainPerHit * (it.kind==='boss' ? 1.4 : 1.0) * (director.feverOn ? 1.25 : 1.0);
    st.clean = clamp(st.clean + gain, 0, 100);

    if(!st.finisherOn && st.clean >= 85 && st.clean < 100){
      startFinisher();
    }

    if(director.feverOn && rng() < 0.18){
      burstPop(1);
    }
  }

  function onMiss(kind, reason){
    st.miss += 1;
    st.combo = 0;
    st.score = Math.max(0, st.score - (kind==='boss'? 2 : 1));
    st.clean = clamp(st.clean - st.cleanLosePerMiss, 0, 100);
    fun?.onAction?.({ type:'timeout' });

    if(ai) ai.onEvent?.({ type: reason || 'miss' });
  }

  function burstPop(n){
    const arr = Array.from(st.targets.entries()).filter(([,v])=> v.kind==='plaque');
    for(let i=0;i<Math.min(n, arr.length);i++){
      const pick = arr[Math.floor(rng()*arr.length)];
      if(!pick) break;
      const [id] = pick;
      const it = st.targets.get(id);
      if(it){
        onHitTarget(it, 0);
        removeTarget(id, true);
      }
    }
  }

  function hitTest(x,y){
    const rad = 44;
    let best = null;
    let bestD = 1e9;
    for(const [id,it] of st.targets){
      const ex = it.x;
      const ey = it.y;
      const dx = ex - x;
      const dy = ey - y;
      const d2 = dx*dx + dy*dy;
      if(d2 <= rad*rad && d2 < bestD){
        bestD = d2;
        best = { id, it };
      }
    }
    return best;
  }

  function endGame(reason){
    if(st.over) return;
    st.over = true;
    st.running = false;

    clearTimeout(spawnTimer);
    clearInterval(tickTimer);

    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    fxSet(fxFin, false);

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

    try{ localStorage.setItem(`HHA_ZONE_DONE::hygiene::${ymdLocal()}`, '1'); }catch(_){}

    emit('hha:judge', { ...summary });
    emit('hha:end', { ...summary });

    sScore.textContent = String(summary.score);
    sAcc.textContent   = `${summary.accuracyPct}%`;
    sMiss.textContent  = String(summary.miss);
    sCombo.textContent = String(summary.comboMax);
    sClean.textContent = `${summary.cleanPct}%`;
    sTime.textContent  = `${summary.timePlayedSec}s`;
    endGrade.textContent = summary.grade;

    endNote.textContent = `reason=${reason} | seed=${summary.seed} | diff=${summary.diff} | view=${summary.view} | pid=${summary.pid||'-'}`;

    end.hidden = false;
    menu.style.display = 'none';

    toast(reason==='clean' ? '🦷 สะอาดแล้ว! เยี่ยม!' : 'หมดเวลา!');
  }

  function onHitAt(x,y, meta){
    if(!st.running || st.paused || st.over) return;
    st.shots += 1;

    // 🚫 LASER: ห้ามตี
    if(st.laserOn){
      st.combo = 0;
      st.miss += 1;
      st.score = Math.max(0, st.score - 1);
      hud(true);
      if(ai) ai.onEvent?.({ type:'laser_block' });
      return;
    }

    // 🎵 SHOCK: ต้องตีตอน window เปิด
    if(st.shockOn){
      const tNow = now();
      const ok = (tNow <= st.shockOpenUntil);
      if(!ok){
        st.combo = 0;
        st.miss += 1;
        st.score = Math.max(0, st.score - 1);
        hud(true);
        if(ai) ai.onEvent?.({ type:'shock_wrong_time' });
        return;
      }
    }

    const t = now();
    const hit = hitTest(x,y);
    if(!hit){
      st.combo = 0;
      st.miss += 1;
      st.score = Math.max(0, st.score - 1);
      fun?.onNearMiss?.({ reason:'whiff' });
      hud(true);
      if(ai) ai.onEvent?.({ type:'whiff' });
      return;
    }

    const { id, it } = hit;
    const remain = it.dieMs - t;

    it.hp = Math.max(0, it.hp - 1);
    updateHpVis(it);

    // boss phase -> AI HUD
    if(it.kind === 'boss'){
      const phase = (it.hp <= 1) ? 3 : (it.hp <= Math.ceil(it.hpMax/2) ? 2 : 1);
      emitBrushAI('boss_phase', { phase, hp: it.hp, hpMax: it.hpMax });
    }

    onHitTarget(it, remain);

    if(it.hp <= 0){
      removeTarget(id, true);

      if(it.kind==='boss'){
        st.bossActive = false;
        st.nextBossAt = Math.min(100, st.nextBossAt + st.bossEveryPct);
        toast('💥 Boss แตก!');
      }
    }

    hud(true);
    emit('hha:score', { score: st.score, combo: st.combo, miss: st.miss, clean: st.clean, ts: Date.now() });

    // win condition
    if(st.clean >= 100){
      endGame('clean');
    }
  }

  // cVR shoot hook
  WIN.addEventListener('hha:shoot', (ev)=>{
    const d = ev?.detail || {};
    const x = safeNum(d.x, NaN);
    const y = safeNum(d.y, NaN);
    if(Number.isFinite(x) && Number.isFinite(y)){
      onHitAt(x, y, { source:'shoot' });
    }
  });

  // ---------- timing ----------
  let spawnTimer = null;
  let tickTimer = null;

  function scheduleSpawn(){
    clearTimeout(spawnTimer);
    if(!st.running || st.paused || st.over) return;

    director = fun ? fun.tick() : director;

    // AI difficulty affects spawn interval
    let spawnMul = 1.0;
    let ttlMul = 1.0;
    if(ai){
      const d = ai.getDifficulty?.();
      spawnMul = d?.spawnMul ?? 1.0;
      ttlMul = d?.ttlMul ?? 1.0;
    }

    const base = st.baseSpawnMs;
    const every0 = fun ? fun.scaleIntervalMs(base, director) : base;
    const every = clamp(every0 / spawnMul, 420, 1400);

    // ttl scale
    st.ttlMs = clamp(st.ttlMs * 0 + (ctx.diff==='hard'?1450:ctx.diff==='easy'?1950:1650) * ttlMul, 900, 2400);

    spawnTimer = setTimeout(()=>{
      spawnOne();
      scheduleSpawn();
    }, every);
  }

  function tick(){
    if(!st.running || st.paused || st.over) return;

    director = fun ? fun.tick() : director;

    const t = now();

    // --- LASER lifecycle ---
    if(st.laserOn && t >= st.laserUntil) endLaser();

    // --- SHOCK pulses ---
    if(st.shockOn){
      if(t >= st.shockNextAt && st.shockPulseIdx < st.shockPulses){
        st.shockPulseIdx += 1;

        const openMs = (ctx.diff==='hard'? 260 : 340);
        st.shockOpenUntil = t + openMs;

        emitBrushAI('shock_pulse', { idx: st.shockPulseIdx, sub:'วงเขียวเปิด!', mini:'ตี 1 ทีพอ อย่ารัว' });
        fxOn(fxShock, 360);

        st.shockNextAt = t + (ctx.diff==='hard'? 880 : 1050);
      }

      if(st.shockPulseIdx >= st.shockPulses && t > st.shockOpenUntil){
        stopShock();
      }
    }

    // timeout targets
    for(const [id,it] of st.targets){
      if(t >= it.dieMs){
        removeTarget(id, false);
        if(it.kind==='boss'){
          st.bossActive = false;
          toast('💎 Boss หลุด!');
        }
        onMiss(it.kind, 'timeout');
      }
    }

    // time limit
    const elapsed = (t - st.t0)/1000;
    const left = ctx.time - elapsed;

    // AI tick snapshot
    if(ai){
      const acc = (st.shots>0)? (st.hits/st.shots) : 0;
      ai.tick?.({
        accuracy: acc,
        miss: st.miss,
        score: st.score,
        combo: st.combo,
        clean: st.clean,
        tLeft: left,
        shots: st.shots,
        hits: st.hits
      });
    }

    emit('hha:time', { t: Math.max(0,left), elapsed, ts: Date.now() });
    hud();

    if(left <= 0){
      endGame('time');
    }
  }

  // ---------- start/end ----------
  function startGame(){
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

    st.laserOn=false; st.laserUntil=0; st.laserCooldownUntil=0;
    stopShock();
    st.finisherOn=false; st.finisherNeed=0; st.finisherHit=0;
    fxSet(fxFin, false);

    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    menu.style.display = 'none';
    end.hidden = true;
    wrap.dataset.state = 'play';
    btnPause.textContent = 'Pause';

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
      ts: Date.now()
    });

    scheduleSpawn();
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 80);
  }

  function togglePause(){
    if(!st.running || st.over) return;
    st.paused = !st.paused;
    btnPause.textContent = st.paused ? 'Resume' : 'Pause';
    toast(st.paused ? '⏸ Pause' : '▶ Resume');
  }

  // ---------- controls ----------
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRetry?.addEventListener('click', startGame, { passive:true });
  btnPause?.addEventListener('click', togglePause, { passive:true });

  btnHow?.addEventListener('click', ()=>{
    toast('แตะ/ยิง “🦠” ให้ทัน • คราบหนา “💎” ต้องหลายครั้ง • ใกล้หมดเวลา = Perfect!');
  }, { passive:true });

  btnRecenter?.addEventListener('click', ()=>{
    WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts:Date.now() } }));
    toast('Recenter');
  }, { passive:true });

  layer?.addEventListener('pointerdown', (ev)=>{
    if(ctx.view==='cvr') return;
    if(!st.running || st.paused || st.over) return;
    onHitAt(ev.clientX, ev.clientY, { source:'layer' });
  }, { passive:true });

  // init
  hud(true);
  toast('พร้อมแล้ว! กดเริ่มเกมได้เลย');
})();