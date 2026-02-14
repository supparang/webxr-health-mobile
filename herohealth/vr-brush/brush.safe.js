/* === /herohealth/vr-brush/brush.safe.js ===
BrushVR SAFE — Plaque Breaker (HHA Standard-ish)
✅ Tap/Click (pc/mobile) + Crosshair Shoot (cVR via vr-ui.js -> hha:shoot)
✅ Perfect window near expiry for dopamine
✅ Fever bar + Fever mode
✅ Boss plaque (multi-hit) appears by progress
✅ Summary + Back Hub + Save last summary
✅ Emits: hha:start, hha:time, hha:score, hha:judge, hha:end, hha:coach
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
    // always ensure hub param exists so vr games can go back
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

  // emit event helper
  function emit(type, detail){
    try{
      WIN.dispatchEvent(new CustomEvent(type, { detail }));
    }catch(_){}
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
    time: safeNum(qs.get('time'), 60),
    seed: safeNum(qs.get('seed'), Date.now()),
    pid: (qs.get('pid') || qs.get('participantId') || '').trim(),
    studyId: (qs.get('studyId') || '').trim(),
    phase: (qs.get('phase') || '').trim(),
    conditionGroup: (qs.get('conditionGroup') || '').trim(),
    log: (qs.get('log') || '').trim()
  };

  // clamp time choices
  ctx.time = clamp(ctx.time, 30, 120);

  // update view & back hub
  wrap.dataset.view = ctx.view;
  ctxView.textContent = ctx.view;
  ctxSeed.textContent = String((ctx.seed >>> 0));
  ctxTime.textContent = `${ctx.time}s`;
  diffTag.textContent = ctx.diff;

  mDiff.textContent = ctx.diff;
  mTime.textContent = `${ctx.time}s`;

  // back links keep some ctx
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

    // progress: "clean" percent
    clean:0, // 0..100
    cleanGainPerHit: 1.2, // tuned by diff
    cleanLosePerMiss: 0.6,

    // spawn config
    baseSpawnMs: 760,
    ttlMs: 1650,
    perfectWindowMs: 220,

    // boss
    bossEveryPct: 28,   // spawn boss each progress step
    nextBossAt: 28,
    bossActive:false,

    uid:0,
    targets: new Map(), // id -> {el, kind, born, die, hpMax, hp}
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

    st.targets.set(id, { el, kind, bornMs: born, dieMs: die, hpMax, hp: hpMax, fillEl: fill });

    // pointer tap for pc/mobile (not cvr strict)
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onHitAt(x, y, { source:'tap', targetId:id });
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

    // boss rule
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
    // extra reward feel
    st.score += 2;
    toast('✨ Perfect!');
  }

  function onHitTarget(it, remainMs){
    st.hits += 1;

    // perfect if near expiry (dopamine)
    if(remainMs <= st.perfectWindowMs) onPerfect();
    else fun?.onAction?.({ type:'hit' });

    st.combo += 1;
    st.comboMax = Math.max(st.comboMax, st.combo);

    // score: base + combo scaling
    const comboMul = 1 + Math.min(0.6, st.combo * 0.02);
    const base = (it.kind==='boss') ? 3 : 1;
    st.score += Math.round(base * comboMul * (director.feverOn ? 1.3 : 1.0));

    // clean progress
    const gain = st.cleanGainPerHit * (it.kind==='boss' ? 1.4 : 1.0) * (director.feverOn ? 1.25 : 1.0);
    st.clean = clamp(st.clean + gain, 0, 100);

    // fever fantasy: pop extra nearby small plaques sometimes
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
      // simulate hit at its position
      const it = st.targets.get(id);
      if(it){
        onHitTarget(it, 0);
        removeTarget(id, true);
      }
    }
  }

  // -------- shooting / hit test ----------
  function hitTest(x,y){
    // find topmost target within radius
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

  function onHitAt(x,y, meta){
    if(!st.running || st.paused || st.over) return;
    st.shots += 1;

    const t = now();
    const hit = hitTest(x,y);
    if(!hit){
      // whiff
      st.combo = 0;
      st.miss += 1;
      st.score = Math.max(0, st.score - 1);
      fun?.onNearMiss?.({ reason:'whiff' });
      hud(true);
      return;
    }

    const { id, it } = hit;

    const remain = it.dieMs - t;
    it.hp = Math.max(0, it.hp - 1);
    updateHpVis(it);

    // award
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

    // win condition: clean 100
    if(st.clean >= 100){
      endGame('clean');
    }
  }

  // cVR shoot hook from vr-ui.js (hha:shoot detail: {x,y,view} in page coords)
  WIN.addEventListener('hha:shoot', (ev)=>{
    const d = ev?.detail || {};
    // some implementations might send normalized coords; we handle page coords primarily
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

    const base = st.baseSpawnMs;
    const every = fun ? fun.scaleIntervalMs(base, director) : base;

    spawnTimer = setTimeout(()=>{
      spawnOne();
      scheduleSpawn();
    }, every);
  }

  function tick(){
    if(!st.running || st.paused || st.over) return;

    director = fun ? fun.tick() : director;

    const t = now();

    // timeout targets
    for(const [id,it] of st.targets){
      if(t >= it.dieMs){
        // timeout: boss/plaque both count
        removeTarget(id, false);
        if(it.kind==='boss'){
          st.bossActive = false;
          toast('💎 Boss หลุด!');
        }
        onMiss(it.kind);
      }
    }

    // time limit
    const elapsed = (t - st.t0)/1000;
    const left = ctx.time - elapsed;
    emit('hha:time', { t: Math.max(0,left), elapsed, ts: Date.now() });

    hud();

    if(left <= 0){
      endGame('time');
    }
  }

  // ---------- start/end ----------
  function startGame(){
    // reset
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

    // clear layer
    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    // UI
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

  function endGame(reason){
    if(st.over) return;
    st.over = true;
    st.running = false;

    clearTimeout(spawnTimer);
    clearInterval(tickTimer);

    // clear remaining
    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    // metrics
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

    // save last summary
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      // optional history
      const k='HHA_SUMMARY_HISTORY';
      const arr = JSON.parse(localStorage.getItem(k)||'[]');
      arr.push(summary);
      localStorage.setItem(k, JSON.stringify(arr.slice(-30)));
    }catch(_){}

    // daily gate flag (zone)
    try{
      // mark hygiene done today
      localStorage.setItem(`HHA_ZONE_DONE::hygiene::${ymdLocal()}`, '1');
    }catch(_){}

    emit('hha:judge', { ...summary });
    emit('hha:end', { ...summary });

    // UI summary
    sScore.textContent = String(summary.score);
    sAcc.textContent   = `${summary.accuracyPct}%`;
    sMiss.textContent  = String(summary.miss);
    sCombo.textContent = String(summary.comboMax);
    sClean.textContent = `${summary.cleanPct}%`;
    sTime.textContent  = `${summary.timePlayedSec}s`;
    endGrade.textContent = summary.grade;

    endNote.textContent =
      `reason=${reason} | seed=${summary.seed} | diff=${summary.diff} | view=${summary.view} | pid=${summary.pid||'-'}`;

    end.hidden = false;
    menu.style.display = 'none';

    toast(reason==='clean' ? '🦷 สะอาดแล้ว! เยี่ยม!' : 'หมดเวลา!');
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
    // vr-ui listens to recenter button itself, but we also emit a hint event if needed
    WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts:Date.now() } }));
    toast('Recenter');
  }, { passive:true });

  // tap-to-shoot fallback: click anywhere -> shoot at that point (pc/mobile)
  // (cVR strict mode targets ignore pointer, but layer click can still be useful)
  layer?.addEventListener('pointerdown', (ev)=>{
    if(ctx.view==='cvr') return; // cvr uses crosshair; avoid double fire
    if(!st.running || st.paused || st.over) return;
    const x = ev.clientX;
    const y = ev.clientY;
    onHitAt(x,y,{ source:'layer' });
  }, { passive:true });

  // init
  hud(true);
  toast('พร้อมแล้ว! กดเริ่มเกมได้เลย');
})();