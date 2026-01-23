// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v2.1: FIX-FLICKER + SAFE-READY + ROOMY)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ Spawn avoids edges & HUD by reserving target radius
// ✅ Initial safe-zone warmup delay (prevents wrong early rect)
// ✅ TTL tuned by diff/view (less "flash")
// ✅ MISS = good expired + junk hit
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:end
// Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY (keeps last 30)

'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

function pxInt(varName, fallback){
  try{
    const v = getComputedStyle(DOC.documentElement).getPropertyValue(varName);
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  }catch{ return fallback; }
}

function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();

  // values set by goodjunk-vr.html updateSafe()
  const top = pxInt('--gj-top-safe', 140);
  const bot = pxInt('--gj-bottom-safe', 130);

  const x = 22;
  const y = Math.max(80, top);
  const w = Math.max(120, r.width - 44);
  const h = Math.max(140, r.height - y - bot);

  // fallback if layout not ready (too small)
  if(w < 220 || h < 220){
    return {
      x: 22,
      y: 140,
      w: Math.max(220, r.width - 44),
      h: Math.max(240, r.height - 140 - 120),
      _fallback:true
    };
  }

  return { x,y,w,h, _fallback:false };
}

function pickByShoot(lockPx=28){
  // pick .gj-target that overlaps the center-crosshair window
  const r = DOC.documentElement.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top  + r.height/2;

  const els = Array.from(DOC.querySelectorAll('.gj-target'));
  let best = null;

  for(const el of els){
    const b = el.getBoundingClientRect();
    if(!b.width || !b.height) continue;

    const inside =
      (cx >= b.left - lockPx && cx <= b.right + lockPx) &&
      (cy >= b.top  - lockPx && cy <= b.bottom + lockPx);

    if(!inside) continue;

    const ex = (b.left + b.right) / 2;
    const ey = (b.top  + b.bottom) / 2;
    const dx = ex - cx;
    const dy = ey - cy;
    const d2 = dx*dx + dy*dy;

    if(!best || d2 < best.d2) best = { el, d2 };
  }

  return best ? best.el : null;
}

function pushSummary(summary){
  try{
    localStorage.setItem(LS_LAST, JSON.stringify(summary));
  }catch(_){}
  try{
    const raw = localStorage.getItem(LS_HIST);
    const arr = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(arr) ? arr : [];
    next.unshift(summary);
    while(next.length > 30) next.pop();
    localStorage.setItem(LS_HIST, JSON.stringify(next));
  }catch(_){}
}

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');
  const layer   = DOC.getElementById('gj-layer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  if(!layer){
    console.warn('[GoodJunkVR] missing #gj-layer');
    return;
  }

  // --- tuning (less flicker + fair) ---
  const isMobileish = (view === 'mobile' || view === 'vr' || view === 'cvr');
  const tune = (()=>{
    // base by diff
    let spawnEveryMs = 900;
    let ttlGoodMs = 1800;
    let ttlPowMs  = 2000;

    if(diff === 'easy'){
      spawnEveryMs = 980;
      ttlGoodMs = 2200;
      ttlPowMs  = 2400;
    }else if(diff === 'hard'){
      spawnEveryMs = 820;
      ttlGoodMs = 1550;
      ttlPowMs  = 1750;
    }else{ // normal
      spawnEveryMs = 900;
      ttlGoodMs = 1850;
      ttlPowMs  = 2050;
    }

    // view tweak
    if(isMobileish){
      ttlGoodMs += 120;
      ttlPowMs  += 140;
    }

    // target sizes (kid-friendly)
    const sizeGood = isMobileish ? 62 : 58;
    const sizeJunk = isMobileish ? 64 : 60;
    const sizePow  = isMobileish ? 58 : 54;

    return { spawnEveryMs, ttlGoodMs, ttlPowMs, sizeGood, sizeJunk, sizePow };
  })();

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng: makeRNG(seed),

    score:0, miss:0,
    hitGood:0, hitJunk:0, expireGood:0,
    combo:0, comboMax:0,

    shield:0,
    fever:18,

    lastTick:0,
    lastSpawn:0,

    shootCooldownMs: 85,
    lastShootAt: 0,

    // warmup safe-zone before spawning
    spawnWarmupMs: 520,
    startedAt: 0,
  };

  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if(elFeverText) elFeverText.textContent = `${S.fever}%`;
  }

  function setShieldUI(){
    if(!elShield) return;
    elShield.textContent = (S.shield>0) ? `x${S.shield}` : '—';
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);

    let g='C';
    if(S.score>=170 && S.miss<=3) g='A';
    else if(S.score>=110) g='B';
    else if(S.score>=65) g='C';
    else g='D';

    if(elGrade) elGrade.textContent = g;

    setShieldUI();
    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function onHit(kind){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });
    }
    else if(kind==='junk'){
      if(S.shield>0){
        S.shield--;
        setShieldUI();
        emit('hha:judge', { type:'perfect', label:'BLOCK!' });
      }else{
        S.hitJunk++;
        S.miss++;
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type:'bad', label:'OOPS' });
      }
    }
    else if(kind==='star'){
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(18);
      setFever(Math.max(0, S.fever - 8));
      emit('hha:judge', { type:'perfect', label: (before!==S.miss) ? 'MISS -1!' : 'STAR!' });
    }
    else if(kind==='shield'){
      S.shield = Math.min(3, S.shield + 1);
      setShieldUI();
      addScore(8);
      emit('hha:judge', { type:'perfect', label:'SHIELD!' });
    }

    setHUD();
  }

  function killNice(t){
    // avoid hard "blink": fade quickly if CSS supports opacity transition
    try{
      t.style.opacity = '0';
      t.style.transform = 'translate(-50%,-50%) scale(0.92)';
    }catch(_){}
    setTimeout(()=>{ try{ t.remove(); }catch(_){} }, 90);
  }

  function spawn(kind){
    if(S.ended) return;

    const safe = getSafeRect();

    // reserve radius so it doesn't touch edges/HUD
    const size =
      (kind==='good')   ? tune.sizeGood :
      (kind==='junk')   ? tune.sizeJunk :
      tune.sizePow;

    const radius = Math.max(26, Math.floor(size * 0.55));
    const pad = radius + 10;

    const maxX = Math.max(1, safe.w - pad*2);
    const maxY = Math.max(1, safe.h - pad*2);

    const x = safe.x + pad + S.rng()*maxX;
    const y = safe.y + pad + S.rng()*maxY;

    const t = DOC.createElement('div');
    t.className = 'gj-target';
    t.dataset.kind = kind;
    t.style.left = x+'px';
    t.style.top  = y+'px';
    t.style.fontSize = size+'px';
    t.style.zIndex = '5';
    t.style.opacity = '1';

    // emoji
    t.textContent =
      (kind==='good') ? '🥦' :
      (kind==='junk') ? '🍟' :
      (kind==='star') ? '⭐' : '🛡️';

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive=false;
      killNice(t);
    };

    t.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      kill();
      onHit(kind);
    });

    layer.appendChild(t);

    // TTL tuned (less flash)
    const ttl = (kind==='star' || kind==='shield') ? tune.ttlPowMs : tune.ttlGoodMs;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();
      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo=0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });
        setHUD();
      }
    }, ttl);
  }

  // ✅ Crosshair shoot support (with cooldown)
  function onShoot(ev){
    if(S.ended || !S.started) return;

    const now = performance?.now?.() ?? Date.now();
    if(now - S.lastShootAt < S.shootCooldownMs) return;
    S.lastShootAt = now;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    try{ picked.remove(); }catch(_){}
    onHit(kind);
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : '—';
    const summary = {
      game:'GoodJunkVR',
      pack:'fair',
      view:S.view,
      runMode:S.run,
      diff:S.diff,
      seed:S.seed,
      durationPlannedSec:S.timePlan,
      durationPlayedSec: Math.round(S.timePlan - S.timeLeft),
      scoreFinal:S.score,
      miss:S.miss,
      comboMax:S.comboMax,
      hitGood:S.hitGood,
      hitJunk:S.hitJunk,
      expireGood:S.expireGood,
      shieldRemaining:S.shield,
      grade,
      reason
    };

    pushSummary(summary);

    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    emit('hha:end', summary);
  }

  function tick(ts){
    if(S.ended) return;
    if(!S.lastTick) S.lastTick = ts;

    const dt = Math.min(0.25, (ts - S.lastTick)/1000);
    S.lastTick = ts;

    S.timeLeft = Math.max(0, S.timeLeft - dt);
    if(elTime) elTime.textContent = String(Math.ceil(S.timeLeft));
    emit('hha:time', { left:S.timeLeft });

    // warmup: wait safe-zone settle (prevents early wrong HUD overlap)
    if(ts - S.startedAt >= S.spawnWarmupMs){
      if(ts - S.lastSpawn >= tune.spawnEveryMs){
        S.lastSpawn = ts;

        // fair distribution:
        // 70% good, 26% junk, 2% star, 2% shield
        const r = S.rng();
        if(r < 0.70) spawn('good');
        else if(r < 0.96) spawn('junk');
        else if(r < 0.98) spawn('star');
        else spawn('shield');
      }
    }

    if(S.timeLeft<=0){
      endGame('timeup');
      return;
    }
    requestAnimationFrame(tick);
  }

  // start
  S.started = true;
  S.startedAt = performance?.now?.() ?? Date.now();

  setFever(S.fever);
  setShieldUI();
  setHUD();

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}