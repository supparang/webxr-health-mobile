// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ MISS = good expired + junk hit
// ✅ No boss/storm/rage, no AI, no adaptive (fair for kids)
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:end

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const now = ()=>performance.now();
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
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

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng: makeRNG(seed),

    score:0, miss:0,
    hitGood:0, hitJunk:0, expireGood:0,
    combo:0, comboMax:0,

    lastTick:0,
    lastSpawn:0,
  };

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);

    let g='C';
    if(S.score>=160 && S.miss<=3) g='A';
    else if(S.score>=100) g='B';
    else if(S.score>=60) g='C';
    else g='D';
    if(elGrade) elGrade.textContent = g;

    emit('hha:score',{ score:S.score });
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();
    const x = safe.x + S.rng()*safe.w;
    const y = safe.y + S.rng()*safe.h;

    const t = DOC.createElement('div');
    t.className = 'gj-target';
    t.textContent = (kind==='good' ? '🥦' : '🍟');
    t.style.left = x+'px';
    t.style.top  = y+'px';
    t.style.fontSize = (kind==='good' ? '56px' : '58px');

    let alive = true;

    t.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      alive=false;
      t.remove();

      if(kind==='good'){
        S.hitGood++;
        S.combo++;
        S.comboMax = Math.max(S.comboMax, S.combo);
        S.score += 10 + Math.min(10, S.combo);
        emit('hha:judge', { type:'good', label:'GOOD' });
      }else{
        S.hitJunk++;
        S.miss++;
        S.combo=0;
        emit('hha:judge', { type:'bad', label:'OOPS' });
      }
      setHUD();
    });

    layer.appendChild(t);

    // TTL: 1600ms (ชัด ๆ ไม่แว้บ)
    setTimeout(()=>{
      if(!alive || S.ended) return;
      alive=false;
      t.remove();
      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo=0;
        emit('hha:judge', { type:'miss', label:'MISS' });
        setHUD();
      }
    }, 1600);
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
      grade,
      reason
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
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

    // spawn every ~900ms
    if(ts - S.lastSpawn >= 900){
      S.lastSpawn = ts;
      spawn(S.rng()<0.72 ? 'good' : 'junk');
    }

    if(S.timeLeft<=0){
      endGame('timeup');
      return;
    }
    requestAnimationFrame(tick);
  }

  // start
  S.started = true;
  setHUD();
  emit('hha:start', { game:'GoodJunkVR', pack:'fair', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}