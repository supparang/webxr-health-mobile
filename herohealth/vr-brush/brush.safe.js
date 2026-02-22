// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE — Plaque Breaker (HHA Standard-ish) — PATCH v20260222a
// ✅ FIX: prevent duplicate file load
// ✅ FIX: expose window.BrushVR.boot(ctx) and prevent double boot
// ✅ FIX: menu/end initial state safety
// ✅ FIX: startGame/endGame guards (no immediate summary)
// ✅ FIX: hha:shoot only while running + safer coords
// ✅ FIX: ignore UI pointer interactions

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // --------------------------------------------------
  // HARD GUARD: file loaded twice
  // --------------------------------------------------
  if (WIN.__BRUSH_SAFE_READY__) {
    console.warn('[BrushVR] brush.safe.js loaded twice, ignoring duplicate file execution.');
    return;
  }
  WIN.__BRUSH_SAFE_READY__ = true;

  // --------------------------------------------------
  // helpers
  // --------------------------------------------------
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
    if(!el){ try{ alert(msg); }catch(_){} return; }
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
    return isMobile ? 'mobile' : 'pc';
  }

  function passHubUrl(ctx){
    const qs = getQS();
    const hub = qs.get('hub') || ctx.hub || '../hub.html';
    return hub;
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

  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail })); }catch(_){}
  }

  // --------------------------------------------------
  // engine namespace (HHA style)
  // --------------------------------------------------
  WIN.BrushVR = WIN.BrushVR || {};
  if (typeof WIN.BrushVR.boot === 'function') {
    // ถ้ามีตัวก่อนหน้าอยู่แล้ว ให้ทับด้วยเวอร์ชัน patch นี้ (ตั้งใจ)
    console.warn('[BrushVR] overriding existing BrushVR.boot with patched version');
  }

  WIN.BrushVR.boot = function bootBrushVR(bootCtx){
    // ✅ กัน boot ซ้ำจาก brush.boot.js หรือ include ซ้ำ
    if (WIN.__BRUSH_ENGINE_BOOTED__) {
      console.warn('[BrushVR] boot ignored (already booted)');
      return;
    }
    WIN.__BRUSH_ENGINE_BOOTED__ = true;

    // --------------------------------------------------
    // DOM refs (ต้องอ่านตอน boot เท่านั้น)
    // --------------------------------------------------
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

    if (!wrap || !layer) {
      fatal('[BrushVR] Missing required DOM nodes (#br-wrap / #br-layer)');
      return;
    }

    // --------------------------------------------------
    // context (merge bootCtx + querystring)
    // --------------------------------------------------
    const qs = getQS();
    const ctx = {
      hub: (bootCtx && bootCtx.hub) || qs.get('hub') || '../hub.html',
      run: qs.get('run') || qs.get('mode') || 'play',
      view: (bootCtx && bootCtx.view) || getViewAuto(),
      diff: String(qs.get('diff') || 'normal').toLowerCase(),
      time: safeNum((bootCtx && bootCtx.time) ?? qs.get('time'), 60),
      seed: safeNum((bootCtx && bootCtx.seed) ?? qs.get('seed'), Date.now()),

      pid: (qs.get('pid') || qs.get('participantId') || '').trim(),
      studyId: ((bootCtx && bootCtx.studyId) || qs.get('studyId') || '').trim(),
      phase: ((bootCtx && bootCtx.phase) || qs.get('phase') || '').trim(),
      conditionGroup: ((bootCtx && bootCtx.conditionGroup) || qs.get('conditionGroup') || '').trim(),
      log: (qs.get('log') || '').trim()
    };

    ctx.time = clamp(ctx.time, 30, 120);
    if (!['easy','normal','hard'].includes(ctx.diff)) ctx.diff = 'normal';
    if (!['pc','mobile','cvr','cardboard'].includes(ctx.view)) ctx.view = 'pc';

    wrap.dataset.view = (ctx.view === 'cardboard' ? 'cvr' : ctx.view);

    // --------------------------------------------------
    // UI init
    // --------------------------------------------------
    function initUiState(){
      try{
        if (menu) menu.style.display = 'grid';
        if (end) end.hidden = true;
        if (wrap) wrap.dataset.state = 'menu';
        if (btnPause) btnPause.textContent = 'Pause';
      }catch(_){}
    }

    function bindCtxLabels(){
      if (ctxView) ctxView.textContent = String(ctx.view);
      if (ctxSeed) ctxSeed.textContent = String((ctx.seed >>> 0));
      if (ctxTime) ctxTime.textContent = `${ctx.time}s`;
      if (diffTag) diffTag.textContent = ctx.diff;
      if (mDiff) mDiff.textContent = ctx.diff;
      if (mTime) mTime.textContent = `${ctx.time}s`;
    }

    function setBackLinks(){
      const hubUrl = passHubUrl(ctx);
      for (const a of [btnBack, btnBackHub2]){
        if (!a) continue;
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

    bindCtxLabels();
    setBackLinks();

    // --------------------------------------------------
    // RNG + Fun Boost
    // --------------------------------------------------
    const rng = seededRng(ctx.seed);

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

    // --------------------------------------------------
    // game state
    // --------------------------------------------------
    const st = {
      running:false,
      paused:false,
      over:false,

      startedOnce:false,  // ✅ used to block premature end
      hasEnded:false,     // ✅ re-entrancy guard

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
      targets: new Map() // id -> {el, kind, bornMs, dieMs, hpMax, hp, fillEl}
    };

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

    // --------------------------------------------------
    // HUD
    // --------------------------------------------------
    function hud(force){
      const t = now();
      if(!force && t - st.lastHud < 60) return;
      st.lastHud = t;

      if (tScore) tScore.textContent = String(st.score);
      if (tCombo) tCombo.textContent = String(st.combo);
      if (tMiss)  tMiss.textContent  = String(st.miss);

      const elapsed = st.running ? ((t - st.t0)/1000) : 0;
      const left = st.running ? Math.max(0, ctx.time - elapsed) : ctx.time;
      if (tTime) tTime.textContent = left.toFixed(0);

      const clean = clamp(st.clean, 0, 100);
      if (tClean) tClean.textContent = `${Math.round(clean)}%`;
      if (bClean) bClean.style.width = `${clean}%`;

      const fb = fun?.getState?.().feverCharge || 0;
      const th = fun?.cfg?.feverThreshold || 18;
      const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
      if (tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';
      if (bFever) bFever.style.width = `${pct}%`;
    }

    function layerRect(){ return layer.getBoundingClientRect(); }

    // --------------------------------------------------
    // targets
    // --------------------------------------------------
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

      st.targets.set(id, { el, kind, bornMs: born, dieMs: die, hpMax, hp: hpMax, fillEl: fill });

      // tap target
      el.addEventListener('pointerdown', (ev)=>{
        // ✅ block if game not running
        if(!st.running || st.paused || st.over) return;
        ev.preventDefault();
        ev.stopPropagation();
        const ex = safeNum(el.style.left.replace('px',''), 0);
        const ey = safeNum(el.style.top.replace('px',''), 0);
        onHitAt(ex, ey, { source:'tap-target', targetId:id });
      }, { passive:false });

      layer.appendChild(el);
    }

    function spawnOne(){
      if(!st.running || st.paused || st.over) return;

      director = fun ? fun.tick() : director;

      const r = layerRect();
      const pad = 56;

      const x = pad + rng() * Math.max(10, (r.width - pad*2));
      const y = pad + rng() * Math.max(10, (r.height - pad*2));

      if(!st.bossActive && st.clean >= st.nextBossAt && st.clean < 100){
        st.bossActive = true;
        mkTarget({ x, y, kind:'boss', hpMax: (ctx.diff==='hard'? 5 : ctx.diff==='easy'? 3 : 4) });
        toast('💎 BOSS PLAQUE!');
        emit('hha:coach', { msg:'เจอบอสคราบหนา! ยิง/แตะหลายครั้งให้แตก!', ts: Date.now() });
        return;
      }

      mkTarget({ x, y, kind:'plaque', hpMax: 1 });
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

    function onPerfect(){
      fun?.onAction?.({ type:'perfect' });
      st.score += 2;
      toast('✨ Perfect!');
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

      if(director.feverOn && rng() < 0.18){
        burstPop(1);
      }
    }

    function onMiss(kind){
      st.miss += 1;
      st.combo = 0;
      st.score = Math.max(0, st.score - (kind==='boss'? 2 : 1));
      st.clean = clamp(st.clean - st.cleanLosePerMiss, 0, 100);
      fun?.onAction?.({ type:'timeout' });
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

    // --------------------------------------------------
    // hit test / shoot
    // --------------------------------------------------
    function hitTest(x,y){
      const rad = 44;
      let best = null;
      let bestD = 1e9;
      for(const [id,it] of st.targets){
        const el = it.el;
        if(!el) continue;
        const ex = parseFloat(el.style.left || '0');
        const ey = parseFloat(el.style.top  || '0');
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

    function onHitAt(pageX,pageY, meta){
      if(!st.running || st.paused || st.over) return;

      // page coords -> layer local coords
      const r = layerRect();
      const x = pageX - r.left;
      const y = pageY - r.top;

      // outside layer => ignore (no miss penalty from UI click)
      if (x < 0 || y < 0 || x > r.width || y > r.height) return;

      st.shots += 1;

      const t = now();
      const hit = hitTest(x,y);

      if(!hit){
        st.combo = 0;
        st.miss += 1;
        st.score = Math.max(0, st.score - 1);
        fun?.onNearMiss?.({ reason:'whiff', source: meta?.source || '' });
        hud(true);
        return;
      }

      const { id, it } = hit;
      const remain = it.dieMs - t;

      it.hp = Math.max(0, it.hp - 1);
      updateHpVis(it);

      onHitTarget(it, remain);

      if(it.hp <= 0){
        removeTarget(id, true);

        if(it.kind==='boss'){
          st.bossActive = false;
          st.nextBossAt = Math.min(100, st.nextBossAt + st.bossEveryPct);
          toast('💥 Boss แตก!');
          emit('hha:coach', { msg:'เยี่ยม! คราบหนาแตกแล้ว ไปต่อ!', ts: Date.now() });
        }
      }

      hud(true);
      emit('hha:score', { score: st.score, combo: st.combo, miss: st.miss, clean: st.clean, ts: Date.now() });

      if(st.clean >= 100){
        endGame('clean');
      }
    }

    // ✅ hha:shoot from vr-ui.js (page coords)
    function onHhaShoot(ev){
      if(!st.running || st.paused || st.over) return;

      const d = ev?.detail || {};
      const x = safeNum(d.x, NaN);
      const y = safeNum(d.y, NaN);

      if(Number.isFinite(x) && Number.isFinite(y)){
        onHitAt(x, y, { source:'shoot' });
      }
    }
    WIN.addEventListener('hha:shoot', onHhaShoot);

    // --------------------------------------------------
    // timing
    // --------------------------------------------------
    let spawnTimer = null;
    let tickTimer = null;

    function scheduleSpawn(){
      clearTimeout(spawnTimer);
      if(!st.running || st.paused || st.over) return;

      const base = st.baseSpawnMs;
      const every = fun ? fun.scaleIntervalMs(base, director) : base;

      spawnTimer = setTimeout(()=>{
        if(!st.running || st.paused || st.over) return;
        spawnOne();
        scheduleSpawn();
      }, every);
    }

    function tick(){
      if(!st.running || st.paused || st.over) return;

      director = fun ? fun.tick() : director;
      const t = now();

      for(const [id,it] of st.targets){
        if(t >= it.dieMs){
          removeTarget(id, false);
          if(it.kind==='boss'){
            st.bossActive = false;
            toast('💎 Boss หลุด!');
          }
          onMiss(it.kind);
        }
      }

      const elapsed = (t - st.t0)/1000;
      const left = ctx.time - elapsed;
      emit('hha:time', { t: Math.max(0,left), elapsed, ts: Date.now() });

      hud();

      if(left <= 0){
        endGame('time');
      }
    }

    // --------------------------------------------------
    // start / end
    // --------------------------------------------------
    function resetTransientTimers(){
      clearTimeout(spawnTimer);
      clearInterval(tickTimer);
      spawnTimer = null;
      tickTimer = null;
    }

    function clearAllTargets(){
      for(const [id] of st.targets) removeTarget(id, false);
      st.targets.clear();
    }

    function startGame(){
      // ✅ กัน start ซ้ำระหว่างเล่น
      if (st.running && !st.over) return;

      st.hasEnded = false;
      st.startedOnce = true;

      st.running = true;
      st.paused = false;
      st.over = false;

      st.t0 = now();
      st.lastHud = 0;

      st.score = 0;
      st.combo = 0;
      st.comboMax = 0;
      st.miss = 0;
      st.shots = 0;
      st.hits = 0;
      st.clean = 0;

      st.nextBossAt = st.bossEveryPct;
      st.bossActive = false;
      st.uid = 0;

      resetTransientTimers();
      clearAllTargets();

      if (menu) menu.style.display = 'none';
      if (end) end.hidden = true;
      if (wrap) wrap.dataset.state = 'play';
      if (btnPause) btnPause.textContent = 'Pause';

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

      director = fun ? fun.tick() : director;
      scheduleSpawn();
      tickTimer = setInterval(tick, 80);
    }

    function endGame(reason){
      // ✅ กันเรียกซ้ำ
      if(st.hasEnded || st.over) return;

      // ✅ กันจบก่อนเริ่มจริง (ต้นเหตุ summary เด้ง)
      if(!st.startedOnce || !st.t0 || !Number.isFinite(st.t0)){
        console.warn('[BrushVR] endGame ignored before valid start', { reason, t0: st.t0, startedOnce: st.startedOnce });
        return;
      }

      st.hasEnded = true;
      st.over = true;
      st.running = false;
      st.paused = false;

      resetTransientTimers();
      clearAllTargets();

      const acc = (st.shots > 0) ? (st.hits / st.shots) * 100 : 0;
      const grade = gradeFromAcc(acc);
      const elapsedRaw = (now() - st.t0)/1000;
      const elapsed = Math.max(0, Math.min(ctx.time, Number.isFinite(elapsedRaw) ? elapsedRaw : 0));

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

      try{
        localStorage.setItem(`HHA_ZONE_DONE::hygiene::${ymdLocal()}`, '1');
      }catch(_){}

      emit('hha:judge', { ...summary });
      emit('hha:end', { ...summary });

      if (sScore) sScore.textContent = String(summary.score);
      if (sAcc)   sAcc.textContent   = `${summary.accuracyPct}%`;
      if (sMiss)  sMiss.textContent  = String(summary.miss);
      if (sCombo) sCombo.textContent = String(summary.comboMax);
      if (sClean) sClean.textContent = `${summary.cleanPct}%`;
      if (sTime)  sTime.textContent  = `${summary.timePlayedSec}s`;
      if (endGrade) endGrade.textContent = summary.grade;
      if (endNote) endNote.textContent =
        `reason=${reason} | seed=${summary.seed} | diff=${summary.diff} | view=${summary.view} | pid=${summary.pid||'-'}`;

      if (end) end.hidden = false;
      if (menu) menu.style.display = 'none';
      if (wrap) wrap.dataset.state = 'end';

      toast(reason==='clean' ? '🦷 สะอาดแล้ว! เยี่ยม!' : 'หมดเวลา!');
    }

    function togglePause(){
      if(!st.running || st.over) return;
      st.paused = !st.paused;
      if (btnPause) btnPause.textContent = st.paused ? 'Resume' : 'Pause';
      toast(st.paused ? '⏸ Pause' : '▶ Resume');
    }

    // --------------------------------------------------
    // controls
    // --------------------------------------------------
    btnStart?.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      startGame();
    }, { passive:false });

    btnRetry?.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      startGame();
    }, { passive:false });

    btnPause?.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      togglePause();
    }, { passive:false });

    btnHow?.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      toast('แตะ/ยิง “🦠” ให้ทัน • คราบหนา “💎” ต้องหลายครั้ง • ใกล้หมดเวลา = Perfect!');
    }, { passive:false });

    btnRecenter?.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts:Date.now() } }));
      toast('Recenter');
    }, { passive:false });

    // layer click/tap fallback (pc/mobile)
    layer?.addEventListener('pointerdown', (ev)=>{
      if ((ctx.view === 'cvr') || (ctx.view === 'cardboard')) return; // cvr uses crosshair shoot
      if (!st.running || st.paused || st.over) return;

      // ✅ กัน UI clicks
      const t = ev.target;
      if (t && (t.closest?.('button') || t.closest?.('a') || t.closest?.('.br-actions') || t.closest?.('.br-menu') || t.closest?.('.br-end'))) {
        return;
      }

      onHitAt(ev.clientX, ev.clientY, { source:'layer' });
    }, { passive:true });

    // --------------------------------------------------
    // init
    // --------------------------------------------------
    initUiState();
    hud(true);
    toast('พร้อมแล้ว! กดเริ่มเกมได้เลย');

    // debug handle
    WIN.__BrushVRDebug = {
      ctx, st,
      startGame,
      endGame,
      getState: ()=>({ ...st }),
      resetUi: initUiState
    };
  };
})();