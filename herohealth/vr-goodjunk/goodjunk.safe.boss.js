// === /herohealth/vr-goodjunk/goodjunk.safe.boss.js ===
// GoodJunkVR SAFE — BOSS PACK (v2)
// ✅ STAR + SHIELD
// ✅ MISS = good expired + junk hit; shield-blocked junk NOT MISS
// ✅ Crosshair shoot via hha:shoot (center aim window)
// ✅ Boss: starts when miss>=4, HP by diff = 10/12/14
// ✅ Boss Phase2 lasts 6s when HP <= half (then back to Phase1)
// ✅ Storm: at timeLeft<=30s (once) — adds pressure but still fair
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:storm, hha:boss, hha:end

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
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
    const ex = (b.left+b.right)/2;
    const ey = (b.top+b.bottom)/2;
    const d2 = (ex-cx)*(ex-cx) + (ey-cy)*(ey-cy);
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
    hitGood:0, hitJunk:0, guardJunk:0, expireGood:0,
    combo:0, comboMax:0,

    shield:0,
    fever:18,

    // storm/boss
    storm:false,
    boss:false,
    bossHP:0,
    bossHPMax: (diff==='easy'?10:(diff==='hard'?14:12)),
    bossPhase:0,               // 0 none, 1 p1, 2 p2
    phase2Sec:6,
    phase2Until:0,

    lastTick:0,
    lastSpawn:0,
  };

  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if(elFeverText) elFeverText.textContent = `${Math.round(S.fever)}%`;
  }
  function setShieldUI(){
    if(!elShield) return;
    elShield.textContent = S.shield>0 ? `x${S.shield}` : '—';
  }

  function grade(){
    const sc=S.score, m=S.miss;
    if(m<=2 && sc>=220) return 'S';
    if(m<=4 && sc>=170) return 'A';
    if(m<=6 && sc>=110) return 'B';
    if(sc>=65) return 'C';
    return 'D';
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);
    if(elGrade) elGrade.textContent = grade();
    setShieldUI();
    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function setStorm(on){
    on = !!on;
    if(on===S.storm) return;
    S.storm = on;
    emit('hha:storm', { on });
    emit('hha:judge', { type: on?'bad':'good', label: on?'STORM!':'STORM CLEAR' });
  }

  function setBoss(on){
    on = !!on;
    if(on===S.boss) return;
    S.boss = on;

    if(on){
      S.bossHPMax = (diff==='easy'?10:(diff==='hard'?14:12));
      S.bossHP = S.bossHPMax;
      S.bossPhase = 1;
      S.phase2Until = 0;

      emit('hha:boss', { on:true, hp:S.bossHP, hpMax:S.bossHPMax, phase:S.bossPhase, phase2Sec:S.phase2Sec });
      emit('hha:judge', { type:'bad', label:`BOSS! HP ${S.bossHPMax}` });

    }else{
      emit('hha:boss', { on:false, hp:0, hpMax:S.bossHPMax, phase:0, phase2Sec:S.phase2Sec });
      emit('hha:judge', { type:'perfect', label:'BOSS DOWN!' });
      // clear storm when boss down (clean pacing)
      if(S.storm) setStorm(false);
    }
  }

  function bossDamage(dmg){
    if(!S.boss) return;
    const before = S.bossHP;
    S.bossHP = clamp(S.bossHP - Math.abs(dmg||0), 0, S.bossHPMax);

    if(S.bossHP !== before){
      emit('hha:boss', { on:true, hp:S.bossHP, hpMax:S.bossHPMax, phase:S.bossPhase, phase2Sec:S.phase2Sec });
    }

    // enter phase2 at half
    const half = Math.ceil(S.bossHPMax * 0.5);
    if(S.bossPhase!==2 && S.bossHP<=half){
      S.bossPhase = 2;
      S.phase2Until = performance.now() + S.phase2Sec*1000;
      emit('hha:boss', { on:true, hp:S.bossHP, hpMax:S.bossHPMax, phase:2, phase2Sec:S.phase2Sec });
      emit('hha:judge', { type:'bad', label:'PHASE 2!' });
    }

    if(S.bossHP<=0){
      setBoss(false);
    }
  }

  function bossHeal(heal){
    if(!S.boss) return;
    S.bossHP = clamp(S.bossHP + Math.abs(heal||0), 0, S.bossHPMax);
    emit('hha:boss', { on:true, hp:S.bossHP, hpMax:S.bossHPMax, phase:S.bossPhase, phase2Sec:S.phase2Sec });
  }

  function onHit(kind){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      // bonus when boss phase2 (hero moment)
      const bossBonus = (S.boss && S.bossPhase===2) ? 3 : (S.boss?1:0);
      addScore(10 + Math.min(10,S.combo) + bossBonus);
      setFever(S.fever + 2);

      emit('hha:judge', { type:'good', label:'GOOD' });

      // boss takes damage from good
      if(S.boss) bossDamage(S.bossPhase===2 ? 2 : 1);
    }

    else if(kind==='junk'){
      if(S.shield>0){
        S.shield--;
        S.guardJunk++;
        setShieldUI();
        emit('hha:judge', { type:'perfect', label:'BLOCK!' });
      }else{
        S.hitJunk++;
        S.miss++;
        S.combo=0;
        addScore(-8);
        setFever(S.fever + 7);
        emit('hha:judge', { type:'bad', label:'OOPS' });

        // boss heals from junk (pressure)
        if(S.boss) bossHeal(S.bossPhase===2 ? 2 : 1);
      }
    }

    else if(kind==='star'){
      const before=S.miss;
      S.miss = Math.max(0, S.miss-1);
      addScore(18);
      setFever(Math.max(0, S.fever-10));
      emit('hha:judge', { type:'perfect', label: (before!==S.miss) ? 'MISS -1!' : 'STAR!' });

      // star damages boss slightly
      if(S.boss) bossDamage(1);
    }

    else if(kind==='shield'){
      S.shield = Math.min(3, S.shield+1);
      addScore(8);
      emit('hha:judge', { type:'perfect', label:'SHIELD!' });
    }

    // boss trigger by miss>=4
    if(!S.boss && S.miss>=4) setBoss(true);

    setHUD();
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();

    // in boss phase2: bias closer to center slightly (pressure but still fair)
    let x = safe.x + S.rng()*safe.w;
    let y = safe.y + S.rng()*safe.h;

    if(S.boss && S.bossPhase===2){
      const cx = safe.x + safe.w/2;
      const cy = safe.y + safe.h/2;
      x = (x*0.55 + cx*0.45);
      y = (y*0.55 + cy*0.45);
    }

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

    let alive=true;
    const kill=()=>{ if(!alive) return; alive=false; try{t.remove();}catch{} };

    t.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      kill();
      onHit(kind);
    });

    layer.appendChild(t);

    // TTL (แฟร์ขึ้น: ไม่แว้บ)
    const ttlBase =
      (kind==='star' || kind==='shield') ? 1800 :
      1700;

    // phase2 shorter a bit
    const ttl = (S.boss && S.bossPhase===2) ? Math.max(1200, ttlBase-260) : ttlBase;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();
      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo=0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });

        if(!S.boss && S.miss>=4) setBoss(true);

        setHUD();
      }
    }, ttl);
  }

  // ✅ crosshair shoot
  function onShoot(ev){
    if(S.ended || !S.started) return;
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

    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}

    const summary = {
      game:'GoodJunkVR',
      pack:'boss',
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
      guardJunk:S.guardJunk,
      expireGood:S.expireGood,
      storm:S.storm,
      bossTriggered:true,
      bossHPMax:S.bossHPMax,
      reason,
      grade: grade(),
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

    // Storm at <=30s (once)
    if(S.timeLeft<=30 && !S.storm) setStorm(true);

    // boss phase2 timeout -> back to phase1
    if(S.boss && S.bossPhase===2 && S.phase2Until>0 && performance.now()>=S.phase2Until){
      S.bossPhase = 1;
      S.phase2Until = 0;
      emit('hha:boss', { on:true, hp:S.bossHP, hpMax:S.bossHPMax, phase:1, phase2Sec:S.phase2Sec });
      emit('hha:judge', { type:'good', label:'BACK P1' });
    }

    // spawn cadence
    const baseEvery = 820; // faster than fair pack

    // pressure multipliers
    let every = baseEvery;
    if(S.storm) every *= 0.92;
    if(S.boss){
      every *= (S.bossPhase===2 ? 0.72 : 0.82);
    }
    // cap
    every = clamp(every, 420, 980);

    if(ts - S.lastSpawn >= every){
      S.lastSpawn = ts;

      // weights
      // normal: good 64, junk 30, star 3, shield 3
      // storm/boss: junk rises but star/shield slightly up too (fair)
      let wGood=0.64, wJunk=0.30, wStar=0.03, wShield=0.03;

      if(S.storm){ wJunk += 0.04; wGood -= 0.03; wStar += 0.01; }
      if(S.boss){ wJunk += (S.bossPhase===2?0.08:0.05); wGood -= (S.bossPhase===2?0.06:0.04); wShield += 0.01; }
      // normalize-ish
      const sum = wGood+wJunk+wStar+wShield;
      wGood/=sum; wJunk/=sum; wStar/=sum; wShield/=sum;

      const r = S.rng();
      if(r < wGood) spawn('good');
      else if(r < wGood+wJunk) spawn('junk');
      else if(r < wGood+wJunk+wStar) spawn('star');
      else spawn('shield');

      // boss phase2: occasional extra spawn (burst)
      if(S.boss && S.bossPhase===2 && S.rng()<0.22) spawn(S.rng()<0.55?'junk':'good');
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

  emit('hha:start', { game:'GoodJunkVR', pack:'boss', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}