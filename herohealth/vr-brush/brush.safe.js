// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR Engine — SAFE STABLE PATCH v20260223c
// ✅ Fix immediate end overlay
// ✅ Stable start/reset/end flow with boot events
// ✅ Pointer hit + hha:shoot (vr-ui crosshair)
// ✅ Mobile/cVR friendly
// ✅ Boss weakspot + perfect window + fever bar (simple)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // ---------------- utils ----------------
  const $ = (s, root=DOC)=> root.querySelector(s);
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const now = ()=> performance.now ? performance.now() : Date.now();

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }

  function toNum(v, def=0){
    v = Number(v);
    return Number.isFinite(v) ? v : def;
  }

  // small seeded RNG (deterministic)
  function makeRng(seedInput){
    let s = (Number(seedInput) || 1) >>> 0;
    if(!s) s = 1;
    return function(){
      // xorshift32
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17; s >>>= 0;
      s ^= s << 5;  s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
  }

  // --------------- params ----------------
  const P = {
    view: String(qs('view','mobile') || 'mobile').toLowerCase(),
    run:  String(qs('run','play') || 'play').toLowerCase(),
    diff: String(qs('diff','normal') || 'normal').toLowerCase(),
    time: clamp(toNum(qs('time','80'), 80), 20, 300),
    seed: String(qs('seed', String(Date.now())) || String(Date.now())),
    pid:  String(qs('pid','anon') || 'anon'),
    debug: toNum(qs('debug','0'), 0),
    ai: toNum(qs('ai','0'), 0),
    hub: String(qs('hub','../hub.html') || '../hub.html')
  };

  // --------------- DOM refs --------------
  const el = {
    wrap: $('#br-wrap'),
    layer: $('#br-layer'),
    menu: $('#br-menu'),
    end: $('#br-end'),
    toast: $('#toast'),

    tScore: $('#tScore'),
    tCombo: $('#tCombo'),
    tMiss: $('#tMiss'),
    tTime: $('#tTime'),
    tClean: $('#tClean'),
    tFever: $('#tFever'),
    bClean: $('#bClean'),
    bFever: $('#bFever'),

    mDiff: $('#mDiff'),
    mTime: $('#mTime'),

    ctxView: $('#br-ctx-view'),
    ctxSeed: $('#br-ctx-seed'),
    ctxTime: $('#br-ctx-time'),
    diffTag: $('#br-diffTag'),

    endGrade: $('#endGrade'),
    sScore: $('#sScore'),
    sAcc: $('#sAcc'),
    sMiss: $('#sMiss'),
    sCombo: $('#sCombo'),
    sClean: $('#sClean'),
    sTime: $('#sTime'),
    endNote: $('#endNote'),

    btnBack: $('#btnBack'),
    btnBackHub2: $('#btnBackHub2'),
    btnPause: $('#btnPause')
  };

  // fx layer (optional)
  let fxLayer = null;
  function ensureFxLayer(){
    if(fxLayer && fxLayer.isConnected) return fxLayer;
    fxLayer = DOC.getElementById('br-fx');
    if(!fxLayer){
      fxLayer = DOC.createElement('div');
      fxLayer.id = 'br-fx';
      fxLayer.innerHTML = `
        <div class="fx-flash"></div>
        <div class="fx-laser"></div>
        <div class="fx-fin"></div>
      `;
      DOC.body.appendChild(fxLayer);
    }
    return fxLayer;
  }

  function fxFlash(){
    const f = ensureFxLayer().querySelector('.fx-flash');
    if(!f) return;
    f.classList.add('on');
    clearTimeout(f.__tm);
    f.__tm = setTimeout(()=> f.classList.remove('on'), 120);
  }
  function fxLaser(){
    const f = ensureFxLayer().querySelector('.fx-laser');
    if(!f) return;
    f.classList.remove('on'); void f.offsetWidth;
    f.classList.add('on');
    clearTimeout(f.__tm);
    f.__tm = setTimeout(()=> f.classList.remove('on'), 1300);
  }
  function fxFinish(){
    const f = ensureFxLayer().querySelector('.fx-fin');
    if(!f) return;
    f.classList.add('on');
    clearTimeout(f.__tm);
    f.__tm = setTimeout(()=> f.classList.remove('on'), 300);
  }

  function toast(msg){
    if(!el.toast) return;
    el.toast.textContent = String(msg || '');
    el.toast.classList.add('show');
    clearTimeout(el.toast.__tm);
    el.toast.__tm = setTimeout(()=> el.toast.classList.remove('show'), 1000);
  }

  // --------------- difficulty tuning -----
  const DIFF = {
    easy:   { spawnMs: 620, ttlMs: 1700, bossEvery: 8,  bossHp: 3, cleanHit: 8,  cleanBossHit: 16, feverGain: 12 },
    normal: { spawnMs: 500, ttlMs: 1450, bossEvery: 10, bossHp: 4, cleanHit: 7,  cleanBossHit: 14, feverGain: 10 },
    hard:   { spawnMs: 400, ttlMs: 1200, bossEvery: 12, bossHp: 5, cleanHit: 6,  cleanBossHit: 12, feverGain: 8  }
  };
  const CFG = DIFF[P.diff] || DIFF.normal;

  // --------------- game state ------------
  const S = {
    rng: makeRng(P.seed),

    started: false,
    running: false,
    paused: false,
    ended: false,
    _endShown: false,

    startedAt: 0,
    pausedAt: 0,
    pauseAccum: 0,
    lastTick: 0,
    raf: 0,

    spawnClock: 0,
    lastSpawnAt: 0,
    seq: 0,

    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    clean: 0,         // 0..100
    fever: 0,         // 0..100
    feverOn: false,

    totalShots: 0,
    hits: 0,

    targets: new Map(), // id -> target object
  };

  // target model:
  // {
  //   id, x,y, bornAt, expiresAt, hp, maxHp, type:'normal'|'boss',
  //   weakX, weakY, weakR, el
  // }

  // --------------- UI init ---------------
  function initStaticUi(){
    if(el.ctxView) el.ctxView.textContent = P.view || '-';
    if(el.ctxSeed) el.ctxSeed.textContent = P.seed || '-';
    if(el.ctxTime) el.ctxTime.textContent = String(P.time) + 's';
    if(el.diffTag) el.diffTag.textContent = P.diff;
    if(el.mDiff) el.mDiff.textContent = P.diff;
    if(el.mTime) el.mTime.textContent = String(P.time);

    if(el.btnBack) el.btnBack.href = P.hub || '../hub.html';
    if(el.btnBackHub2) el.btnBackHub2.href = P.hub || '../hub.html';

    // IMPORTANT: hide end on load (prevent immediate summary)
    if(el.end){
      el.end.hidden = true;
      el.end.style.display = 'none';
    }

    emitUiMode('menu');
    renderHud();
  }

  function renderHud(){
    if(el.tScore) el.tScore.textContent = String(S.score|0);
    if(el.tCombo) el.tCombo.textContent = String(S.combo|0);
    if(el.tMiss) el.tMiss.textContent = String(S.miss|0);

    const elapsed = getElapsedSec();
    const remain = Math.max(0, P.time - elapsed);
    if(el.tTime) el.tTime.textContent = String(Math.ceil(remain));

    const cleanPct = clamp(Math.round(S.clean), 0, 100);
    if(el.tClean) el.tClean.textContent = cleanPct + '%';
    if(el.bClean) el.bClean.style.width = cleanPct + '%';

    const feverPct = clamp(Math.round(S.fever), 0, 100);
    if(el.bFever) el.bFever.style.width = feverPct + '%';
    if(el.tFever) el.tFever.textContent = S.feverOn ? 'ON' : 'OFF';
  }

  function fillEndSummary(reason){
    const acc = S.totalShots > 0 ? Math.round((S.hits / S.totalShots) * 100) : 0;
    const elapsed = getElapsedSec();
    const grade = calcGrade(acc, elapsed, S.clean, S.miss);

    if(el.endGrade) el.endGrade.textContent = grade;
    if(el.sScore) el.sScore.textContent = String(S.score|0);
    if(el.sAcc) el.sAcc.textContent = String(acc) + '%';
    if(el.sMiss) el.sMiss.textContent = String(S.miss|0);
    if(el.sCombo) el.sCombo.textContent = String(S.maxCombo|0);
    if(el.sClean) el.sClean.textContent = String(Math.round(S.clean)) + '%';
    if(el.sTime) el.sTime.textContent = elapsed.toFixed(1) + 's';

    const label = makeEndLabel(acc, S.clean, S.miss);
    if(el.endNote){
      el.endNote.textContent =
        `${label} reason=${reason} | seed=${P.seed} | diff=${P.diff} | view=${P.view} | pid=${P.pid}`;
    }

    return { grade, accPct: acc, elapsedSec: elapsed, label };
  }

  function calcGrade(acc, elapsedSec, clean, miss){
    if(clean >= 100 && acc >= 85 && miss <= 10) return 'S';
    if(clean >= 100 && acc >= 70 && miss <= 18) return 'A';
    if(clean >= 100 && acc >= 55 && miss <= 30) return 'B';
    return 'C';
  }

  function makeEndLabel(acc, clean, miss){
    if(clean >= 100 && acc >= 85 && miss <= 10) return 'PERFECT CLEAN!';
    if(clean >= 100 && acc >= 70) return 'GREAT!';
    if(clean >= 100) return 'ALMOST!';
    return 'KEEP PRACTICING!';
  }

  function emitUiMode(mode){
    try{
      WIN.dispatchEvent(new CustomEvent('brush:ui', { detail:{ mode } }));
    }catch(_){}
  }

  function emitGameStart(){
    try{
      WIN.dispatchEvent(new CustomEvent('brush:start', { detail:{ ts: Date.now() } }));
    }catch(_){}
  }

  function emitGameEnd(reason, extra){
    const d = Object.assign({
      reason: reason || 'time',
      score: S.score|0,
      miss: S.miss|0,
      maxCombo: S.maxCombo|0,
      cleanPct: Math.round(S.clean) + '%',
      accPct: S.totalShots > 0 ? Math.round((S.hits / S.totalShots) * 100) : 0,
      timeText: getElapsedSec().toFixed(1) + 's',
      grade: (el.endGrade && el.endGrade.textContent) || 'C',
      note: (el.endNote && el.endNote.textContent) || ''
    }, extra || {});
    try{
      WIN.dispatchEvent(new CustomEvent('brush:end', { detail: d }));
    }catch(_){}
  }

  // --------------- time ------------------
  function getElapsedMs(){
    if(!S.startedAt) return 0;
    const baseNow = S.ended ? S.lastTick : now();
    let t = baseNow - S.startedAt - S.pauseAccum;
    if(S.paused && S.pausedAt){
      t -= (baseNow - S.pausedAt);
    }
    return Math.max(0, t);
  }
  function getElapsedSec(){
    return getElapsedMs() / 1000;
  }

  // --------------- targets ---------------
  function clearTargets(){
    for(const t of S.targets.values()){
      try{ t.el?.remove(); }catch(_){}
    }
    S.targets.clear();
  }

  function layerRect(){
    if(!el.layer) return { left:0, top:0, width:300, height:300 };
    const r = el.layer.getBoundingClientRect();
    return {
      left: r.left, top: r.top,
      width: Math.max(80, r.width), height: Math.max(120, r.height)
    };
  }

  function randPos(margin=54){
    const r = layerRect();
    const x = margin + S.rng() * Math.max(1, r.width  - margin*2);
    const y = margin + S.rng() * Math.max(1, r.height - margin*2);
    return { x, y };
  }

  function pickWeakspot(){
    // weakspot in boss local coordinates around center
    const ang = S.rng() * Math.PI * 2;
    const rad = 14 + S.rng() * 16;
    return { dx: Math.cos(ang)*rad, dy: Math.sin(ang)*rad, r: 15 };
  }

  function spawnTarget(){
    if(!S.running || S.paused || S.ended) return;
    if(!el.layer) return;

    const id = 't' + (++S.seq);
    const isBoss = (S.seq % CFG.bossEvery === 0);
    const p = randPos(isBoss ? 64 : 54);
    const tNow = now();
    const ttl = isBoss ? Math.round(CFG.ttlMs * 1.8) : CFG.ttlMs;

    const t = {
      id,
      x: p.x, y: p.y,
      bornAt: tNow,
      expiresAt: tNow + ttl,
      type: isBoss ? 'boss' : 'normal',
      hp: isBoss ? CFG.bossHp : 1,
      maxHp: isBoss ? CFG.bossHp : 1,
      weakX: 0,
      weakY: 0,
      weakR: 0,
      el: null
    };

    if(isBoss){
      const ws = pickWeakspot();
      t.weakX = ws.dx;
      t.weakY = ws.dy;
      t.weakR = ws.r;
    }

    const node = DOC.createElement('button');
    node.type = 'button';
    node.className = 'br-t' + (isBoss ? ' thick pop' : ' pop');
    node.dataset.id = id;
    node.dataset.type = t.type;
    node.setAttribute('aria-label', isBoss ? 'boss plaque' : 'plaque');

    const hpPct = Math.round((t.hp / t.maxHp) * 100);
    node.innerHTML = `
      <span class="emo">${isBoss ? '💎' : '🦠'}</span>
      ${isBoss ? `<span class="br-ws" style="transform:translate(calc(-50% + ${t.weakX}px), calc(-50% + ${t.weakY}px));"></span>` : ``}
      <span class="hp"><i style="width:${hpPct}%"></i></span>
    `;

    node.style.left = `${t.x}px`;
    node.style.top  = `${t.y}px`;

    node.addEventListener('pointerdown', onTargetPointerDown, { passive:true });

    t.el = node;
    S.targets.set(id, t);
    el.layer.appendChild(node);

    // remove pop class later
    setTimeout(()=> { try{ node.classList.remove('pop'); }catch(_){} }, 180);
  }

  function onTargetPointerDown(ev){
    if(!S.running || S.paused || S.ended) return;
    const btn = ev.currentTarget;
    if(!btn || !btn.dataset) return;
    const id = btn.dataset.id;
    const t = S.targets.get(id);
    if(!t) return;
    handleHit(t, ev.clientX, ev.clientY, 'pointer');
  }

  function removeTarget(t, opts={}){
    if(!t || !S.targets.has(t.id)) return;
    S.targets.delete(t.id);
    try{
      if(t.el){
        t.el.classList.add('fade');
        setTimeout(()=> { try{ t.el.remove(); }catch(_){} }, opts.instant ? 0 : 160);
      }
    }catch(_){}
  }

  function updateTargetHpUi(t){
    if(!t || !t.el) return;
    const hpI = t.el.querySelector('.hp i');
    if(hpI){
      const pct = Math.round((t.hp / t.maxHp) * 100);
      hpI.style.width = clamp(pct, 0, 100) + '%';
    }
  }

  function checkPerfect(t){
    // "ใกล้หมดเวลา" = remaining life <= 22%
    const tNow = now();
    const ttl = Math.max(1, t.expiresAt - t.bornAt);
    const remain = Math.max(0, t.expiresAt - tNow);
    return (remain / ttl) <= 0.22;
  }

  function isBossWeakspotHit(t, clientX, clientY){
    if(!t || t.type !== 'boss' || !t.el) return true;
    const r = t.el.getBoundingClientRect();
    const cx = r.left + r.width/2 + t.weakX;
    const cy = r.top  + r.height/2 + t.weakY;
    const dx = clientX - cx;
    const dy = clientY - cy;
    return (dx*dx + dy*dy) <= (t.weakR * t.weakR);
  }

  function scoreForHit(isPerfect, isBoss, weakspot){
    let base = isBoss ? 8 : 4;
    if(isPerfect) base += isBoss ? 8 : 4;
    if(isBoss && weakspot) base += 3;
    if(S.feverOn) base *= 2;
    // combo bonus
    base += Math.floor(S.combo / 5);
    return base;
  }

  function gainFever(n){
    S.fever = clamp(S.fever + n, 0, 100);
    if(S.fever >= 100) S.feverOn = true;
  }

  function decayFever(dtMs){
    if(S.feverOn){
      S.fever = clamp(S.fever - dtMs * 0.022, 0, 100); // ~45s drain full
      if(S.fever <= 0){
        S.feverOn = false;
        S.fever = 0;
      }
    }else{
      S.fever = clamp(S.fever - dtMs * 0.004, 0, 100); // idle decay slow
    }
  }

  function handleHit(t, clientX, clientY, source){
    if(!t || S.ended || !S.running || S.paused) return;

    S.totalShots++;

    let weakspot = true;
    if(t.type === 'boss'){
      weakspot = isBossWeakspotHit(t, clientX, clientY);
      if(!weakspot){
        // non-weakspot = low damage, no combo break (but less reward)
        t.hp = Math.max(0, t.hp - 1);
        updateTargetHpUi(t);
        S.score += 1;
        toast('โดนบอส (ยังไม่โดนจุดอ่อน)');
        if(t.el){
          t.el.classList.add('ws-hit');
          setTimeout(()=> t.el && t.el.classList.remove('ws-hit'), 150);
        }
        if(t.hp <= 0){
          S.hits++;
          S.combo++;
          S.maxCombo = Math.max(S.maxCombo, S.combo);
          S.clean = clamp(S.clean + CFG.cleanBossHit * 0.7, 0, 100);
          gainFever(Math.round(CFG.feverGain * 1.2));
          fxLaser();
          removeTarget(t);
        }
        renderHud();
        return;
      }
    }

    // real hit
    const perfect = checkPerfect(t);
    const pts = scoreForHit(perfect, t.type === 'boss', weakspot);

    t.hp -= 1;
    S.score += pts;
    if(t.hp <= 0){
      S.hits++;
      S.combo++;
      S.maxCombo = Math.max(S.maxCombo, S.combo);

      if(t.type === 'boss'){
        S.clean = clamp(S.clean + CFG.cleanBossHit, 0, 100);
        gainFever(Math.round(CFG.feverGain * 1.4));
        fxLaser();
      }else{
        S.clean = clamp(S.clean + CFG.cleanHit, 0, 100);
        gainFever(CFG.feverGain);
      }

      if(perfect) toast('PERFECT!');
      else toast(t.type === 'boss' ? 'BOSS BREAK!' : 'Nice!');

      removeTarget(t);
      fxFlash();
    }else{
      // boss partial
      updateTargetHpUi(t);
      if(t.el){
        t.el.classList.add('ws-hit');
        setTimeout(()=> t.el && t.el.classList.remove('ws-hit'), 150);
      }
      toast(perfect ? 'Perfect hit' : 'Hit');
      S.score += 1;
    }

    renderHud();

    if(S.clean >= 100){
      endGame('clean');
    }
  }

  function expireTargets(tNow){
    for(const t of Array.from(S.targets.values())){
      if(tNow >= t.expiresAt){
        // expire = miss
        S.miss++;
        S.combo = 0;
        S.fever = clamp(S.fever - 14, 0, 100);
        if(S.fever <= 0) S.feverOn = false;
        removeTarget(t);
      }
    }
  }

  // --------------- hha:shoot integration ---
  function handleShootEvent(ev){
    if(!S.running || S.paused || S.ended) return;
    const d = (ev && ev.detail) || {};
    const x = toNum(d.x, WIN.innerWidth/2);
    const y = toNum(d.y, WIN.innerHeight/2);
    const lockPx = clamp(toNum(d.lockPx, 28), 6, 80);

    S.totalShots++;

    // choose nearest target center within lockPx
    let best = null;
    let bestD2 = Infinity;
    for(const t of S.targets.values()){
      if(!t.el) continue;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = x - cx, dy = y - cy;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD2){
        bestD2 = d2; best = t;
      }
    }

    if(best && bestD2 <= lockPx * lockPx){
      // hit nearest target
      handleHit(best, x, y, d.source || 'hha:shoot');
    }else{
      // miss shot (manual shot miss)
      S.miss++;
      S.combo = 0;
      S.fever = clamp(S.fever - 8, 0, 100);
      if(S.fever <= 0) S.feverOn = false;
      renderHud();
      toast('พลาด');
    }
  }

  // --------------- game loop -------------
  function loop(tNow){
    if(!S.running){ S.raf = 0; return; }

    if(S.paused){
      S.lastTick = tNow;
      S.raf = requestAnimationFrame(loop);
      return;
    }

    if(!S.lastTick) S.lastTick = tNow;
    const dt = Math.max(0, tNow - S.lastTick);
    S.lastTick = tNow;

    // time end
    const elapsed = getElapsedSec();
    if(elapsed >= P.time){
      endGame('time');
      return;
    }

    decayFever(dt);

    // spawn
    S.spawnClock += dt;
    while(S.spawnClock >= CFG.spawnMs){
      S.spawnClock -= CFG.spawnMs;
      spawnTarget();
    }

    // expire
    expireTargets(tNow);

    renderHud();
    S.raf = requestAnimationFrame(loop);
  }

  // --------------- flow API --------------
  function hardResetState(){
    // cancel loop
    if(S.raf){
      try{ cancelAnimationFrame(S.raf); }catch(_){}
      S.raf = 0;
    }

    S.rng = makeRng(P.seed);
    S.started = false;
    S.running = false;
    S.paused = false;
    S.ended = false;
    S._endShown = false;

    S.startedAt = 0;
    S.pausedAt = 0;
    S.pauseAccum = 0;
    S.lastTick = 0;

    S.spawnClock = 0;
    S.lastSpawnAt = 0;
    S.seq = 0;

    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.miss = 0;
    S.clean = 0;
    S.fever = 0;
    S.feverOn = false;

    S.totalShots = 0;
    S.hits = 0;

    clearTargets();

    if(el.end){
      el.end.hidden = true;
      el.end.style.display = 'none';
    }
    emitUiMode('menu');
    renderHud();
  }

  function start(){
    // called by boot.js
    if(!el.layer){
      console.error('[BrushVR] missing #br-layer');
      return false;
    }

    // IMPORTANT: reset end flags to avoid immediate summary
    S._endShown = false;
    S.ended = false;
    S.paused = false;

    clearTargets();

    if(el.end){
      el.end.hidden = true;
      el.end.style.display = 'none';
    }

    S.started = true;
    S.running = true;
    S.startedAt = now();
    S.pauseAccum = 0;
    S.pausedAt = 0;
    S.lastTick = 0;
    S.spawnClock = 0;

    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.miss = 0;
    S.clean = 0;
    S.fever = 0;
    S.feverOn = false;
    S.totalShots = 0;
    S.hits = 0;

    renderHud();
    emitUiMode('play');
    emitGameStart();

    if(S.raf) cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(loop);

    return true;
  }

  function reset(){
    hardResetState();
    return true;
  }

  function endGame(reason){
    if(S._endShown) return;        // ✅ guard duplicate
    S._endShown = true;

    if(!S.running && S.ended) return;

    S.running = false;
    S.ended = true;
    S.paused = false;
    S.lastTick = now();

    if(S.raf){
      try{ cancelAnimationFrame(S.raf); }catch(_){}
      S.raf = 0;
    }

    // clear remaining targets for clean finish look
    clearTargets();

    const info = fillEndSummary(reason || 'time');
    emitUiMode('end');

    // show end locally too (boot will also sync)
    if(el.end){
      el.end.hidden = false;
      el.end.style.display = '';
    }

    emitGameEnd(reason || 'time', {
      grade: info.grade,
      accPct: info.accPct,
      timeText: info.elapsedSec.toFixed(1) + 's',
      note: (el.endNote && el.endNote.textContent) || `${info.label} reason=${reason||'time'}`
    });

    fxFinish();
  }

  function togglePause(){
    if(!S.started || S.ended) return;
    if(!S.running && !S.paused) return;

    if(!S.paused){
      S.paused = true;
      S.pausedAt = now();
      toast('Pause');
      if(el.btnPause) el.btnPause.textContent = 'Resume';
    }else{
      const n = now();
      S.pauseAccum += Math.max(0, n - (S.pausedAt || n));
      S.pausedAt = 0;
      S.paused = false;
      toast('Resume');
      if(el.btnPause) el.btnPause.textContent = 'Pause';
    }
  }

  function showHow(){
    // boot จะเรียก alert เองอยู่แล้ว, อันนี้ไว้ compatibility
    return true;
  }

  // --------------- event wiring ----------
  function onResize(){
    // no-op for now; targets remain where they are
    renderHud();
  }

  function onPrestartReset(){
    // boot dispatches this before start/retry
    S._endShown = false;
    S.ended = false;
    S.paused = false;
    if(el.end){
      el.end.hidden = true;
      el.end.style.display = 'none';
    }
    emitUiMode('play');
  }

  function wire(){
    WIN.addEventListener('resize', onResize, { passive:true });
    WIN.addEventListener('orientationchange', onResize, { passive:true });

    WIN.addEventListener('hha:shoot', handleShootEvent, { passive:true });
    WIN.addEventListener('brush:toggle-pause', togglePause, { passive:true });
    WIN.addEventListener('brush:prestart-reset', onPrestartReset, { passive:true });

    // recenter event accepted (no-op for DOM game)
    WIN.addEventListener('hha:recenter', ()=> toast('Recentered'), { passive:true });
  }

  // --------------- public API ------------
  WIN.BrushVR = {
    start,
    reset,
    endGame,
    togglePause,
    showHow,
    getState(){
      return {
        started:S.started, running:S.running, paused:S.paused, ended:S.ended,
        score:S.score, combo:S.combo, maxCombo:S.maxCombo, miss:S.miss,
        clean:S.clean, fever:S.fever, feverOn:S.feverOn,
        elapsedSec:getElapsedSec(), totalShots:S.totalShots, hits:S.hits,
        seed:P.seed, diff:P.diff, view:P.view
      };
    }
  };

  // --------------- init ------------------
  function init(){
    initStaticUi();
    wire();

    // IMPORTANT: start only when boot asks.
    // ไม่ auto-start ที่นี่ เพื่อกันเด้งเข้า end/menu ชนกัน
    if(P.debug){
      console.log('[BrushVR] ready', { P, CFG });
    }
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }

})();