// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v2: STAR+SHIELD + SHOOT + HHA END SUMMARY/HISTORY)
// ✅ End summary payload richer + stores HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY
// ✅ Flush-hardened end on pagehide/visibilitychange/beforeunload (best effort)
// ✅ BackHub is handled by run html (btn + end overlay)
'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

function isoNow(){
  try{ return new Date().toISOString(); }catch{ return ''; }
}

function pushHistory(summary){
  try{
    const raw = localStorage.getItem(LS_HIST);
    const arr = raw ? (JSON.parse(raw)||[]) : [];
    arr.unshift(summary);
    // keep last 50
    if(arr.length > 50) arr.length = 50;
    localStorage.setItem(LS_HIST, JSON.stringify(arr));
  }catch(_){}
}

function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();
  const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 140;
  const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 130;

  const x = 22;
  const y = Math.max(80, top);
  const w = Math.max(120, r.width - 44);
  const h = Math.max(140, r.height - y - bot);

  return { x,y,w,h };
}

function pickByShoot(lockPx=28){
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
    const dx = (ex - cx);
    const dy = (ey - cy);
    const d2 = dx*dx + dy*dy;

    if(!best || d2 < best.d2) best = { el, d2 };
  }

  return best ? best.el : null;
}

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  // research ctx passthrough fields
  const hub = qs('hub', '');
  const studyId = qs('studyId', qs('study', ''));
  const phase = qs('phase', '');
  const conditionGroup = qs('conditionGroup', qs('cond',''));
  const log = qs('log', '');
  const style = qs('style', '');

  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');
  const layer   = DOC.getElementById('gj-layer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

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

    t0Iso: isoNow(),
    endIso: '',
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

  function computeGrade(){
    let g='C';
    if(S.score>=170 && S.miss<=3) g='A';
    else if(S.score>=110) g='B';
    else if(S.score>=65) g='C';
    else g='D';
    return g;
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);

    const g = computeGrade();
    if(elGrade) elGrade.textContent = g;

    setShieldUI();
    emit('hha:score',{ score:S.score, miss:S.miss, combo:S.combo, grade:g });
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

  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();
    const x = safe.x + S.rng()*safe.w;
    const y = safe.y + S.rng()*safe.h;

    const t = DOC.createElement('div');
    t.className = 'gj-target';
    t.dataset.kind = kind;

    t.textContent =
      (kind==='good') ? '🥦' :
      (kind==='junk') ? '🍟' :
      (kind==='star') ? '⭐' : '🛡️';

    const size =
      (kind==='good') ? 56 :
      (kind==='junk') ? 58 :
      52;

    t.style.left = x+'px';
    t.style.top  = y+'px';
    t.style.fontSize = size+'px';

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive=false;
      try{ t.remove(); }catch(_){}
    };

    t.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      kill();
      onHit(kind);
    });

    layer.appendChild(t);

    const ttl = (kind==='star' || kind==='shield') ? 1700 : 1600;

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

  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    try{ picked.remove(); }catch(_){}
    onHit(kind);
  }

  function makeSummary(reason){
    const grade = computeGrade();
    return {
      timestampIso: isoNow(),
      startedAtIso: S.t0Iso,
      endedAtIso: S.endIso || isoNow(),

      projectTag: 'HeroHealth-GoodJunkVR',
      game:'GoodJunkVR',
      pack:'fair',

      // ctx
      view:S.view,
      runMode:S.run,
      diff:S.diff,
      seed:S.seed,
      hub,
      studyId,
      phase,
      conditionGroup,
      log,
      style,

      // duration
      durationPlannedSec:S.timePlan,
      durationPlayedSec: Math.round(S.timePlan - S.timeLeft),

      // outcomes
      scoreFinal:S.score,
      grade,
      miss:S.miss,
      miss_goodExpired:S.expireGood,
      miss_junkHit:S.hitJunk,
      comboMax:S.comboMax,
      hitGood:S.hitGood,
      hitJunk:S.hitJunk,
      expireGood:S.expireGood,
      shieldRemaining:S.shield,

      reason: reason || 'timeup'
    };
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;
    S.endIso = isoNow();

    const summary = makeSummary(reason);

    // store last + history
    try{ localStorage.setItem(LS_LAST, JSON.stringify(summary)); }catch(_){}
    pushHistory(summary);

    // cleanup
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}

    // emit end (logger listens this)
    emit('hha:end', summary);
  }

  // ✅ Flush-hardened best-effort end
  function flushEnd(reason){
    if(S.ended) return;
    endGame(reason);
  }
  function onVis(){
    // if tab hidden, end as abort (best-effort)
    if(DOC.visibilityState === 'hidden') flushEnd('hidden');
  }
  function onPageHide(){ flushEnd('pagehide'); }
  function onBeforeUnload(){ flushEnd('unload'); }

  function tick(ts){
    if(S.ended) return;
    if(!S.lastTick) S.lastTick = ts;

    const dt = Math.min(0.25, (ts - S.lastTick)/1000);
    S.lastTick = ts;

    S.timeLeft = Math.max(0, S.timeLeft - dt);
    if(elTime) elTime.textContent = String(Math.ceil(S.timeLeft));
    emit('hha:time', { left:S.timeLeft });

    if(ts - S.lastSpawn >= 900){
      S.lastSpawn = ts;

      const r = S.rng();
      if(r < 0.70) spawn('good');
      else if(r < 0.96) spawn('junk');
      else if(r < 0.98) spawn('star');
      else spawn('shield');
    }

    if(S.timeLeft<=0){
      endGame('timeup');
      return;
    }
    requestAnimationFrame(tick);
  }

  // start
  S.started = true;
  setFever(S.fever);
  setShieldUI();
  setHUD();

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  // flush-hardened hooks
  DOC.addEventListener('visibilitychange', onVis, { passive:true });
  WIN.addEventListener('pagehide', onPageHide, { passive:true });
  WIN.addEventListener('beforeunload', onBeforeUnload);

  emit('hha:start', {
    game:'GoodJunkVR', pack:'fair',
    view, runMode:run, diff, timePlanSec:timePlan, seed,
    hub, studyId, phase, conditionGroup, log, style
  });

  requestAnimationFrame(tick);
}