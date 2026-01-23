// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v3: GOAL+MINI + STAR+SHIELD + SHOOT + NO-FLICKER)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe from goodjunk-vr.html updateSafe())
// ✅ MISS = good expired + junk hit (shield-blocked junk NOT count as miss)
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score + lower fever
// ✅ 🛡 Shield: blocks next junk hit (cap 3)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot {lockPx}
// ✅ GOAL system: sequential goals (complete -> next immediately)
// ✅ MINI system: timed micro-challenge (pass -> swap immediately)
// ✅ “Not flicker”: TTL >= 1600ms, fade-out, spawn pacing stable
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:end

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min,Math.min(max, Number(v)||0));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();
  const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 160;
  const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 130;

  const x = 18;
  const y = Math.max(72, top);
  const w = Math.max(120, r.width - 36);
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
    const dx = ex - cx;
    const dy = ey - cy;
    const d2 = dx*dx + dy*dy;

    if(!best || d2 < best.d2) best = { el, d2 };
  }
  return best ? best.el : null;
}

function $(id){ return DOC.getElementById(id); }
function setText(node, v){ if(node) node.textContent = String(v); }

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  // HUD refs (top row)
  const elScore = $('hud-score');
  const elTime  = $('hud-time');
  const elMiss  = $('hud-miss');
  const elGrade = $('hud-grade');

  // GOAL/MINI refs
  const elHudGoal    = $('hud-goal');
  const elGoalDesc   = $('goalDesc');
  const elGoalCur    = $('hud-goal-cur');
  const elGoalTarget = $('hud-goal-target');
  const elHudMini    = $('hud-mini');
  const elMiniTimer  = $('miniTimer');

  // meters
  const elFeverFill = $('feverFill');
  const elFeverText = $('feverText');
  const elShield    = $('shieldPills');

  // layers
  const layer = $('gj-layer');

  // ---------- State ----------
  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng: makeRNG(seed),

    score:0,
    miss:0,                 // combined miss
    hitGood:0,
    hitJunk:0,
    expireGood:0,

    combo:0,
    comboMax:0,

    shield:0,
    fever:18,

    // tick/spawn pacing
    lastTick:0,
    lastSpawn:0,

    // goal/mini
    goalsCleared:0,
    minisCleared:0,

    goalIndex:0,
    goalCur:0,
    goalTarget:0,
    goalType:'',            // 'goodHit' | 'junkAvoid' | 'combo'
    goalStartScore:0,
    goalStartMiss:0,

    miniActive:false,
    miniEndsAt:0,
    miniLabel:'',
    miniRule:'',            // 'hitStar' | 'noMiss' | 'hitGoodN'
    miniParam:0,
    miniProgress:0,
    miniSuccess:false,
    miniFail:false,
  };

  // ---------- Difficulty knobs ----------
  // spawn interval + probabilities
  const D = {
    spawnMs: diff==='easy' ? 980 : diff==='hard' ? 820 : 900,

    pGood:   diff==='easy' ? 0.74 : diff==='hard' ? 0.66 : 0.70,
    pJunk:   diff==='easy' ? 0.22 : diff==='hard' ? 0.30 : 0.26,
    pStar:   0.02,
    pShield: 0.02,

    ttlGood:   diff==='easy' ? 1750 : diff==='hard' ? 1500 : 1600,
    ttlJunk:   diff==='easy' ? 1850 : diff==='hard' ? 1550 : 1650,
    ttlPower:  1750,

    // anti-flicker: fade window
    fadeMs: 140,
  };

  // ---------- HUD helpers ----------
  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    setText(elFeverText, `${S.fever}%`);
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
    setText(elScore, S.score);
    setText(elTime,  Math.ceil(S.timeLeft));
    setText(elMiss,  S.miss);
    setText(elGrade, computeGrade());

    setShieldUI();
    emit('hha:score', { score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score < 0) S.score = 0;
  }

  // ---------- Goal/Mini definitions ----------
  const GOALS = [
    { type:'goodHit', targetBase: 10, label:'เก็บของดี', desc:'แตะ “ของดี” ให้ครบ' },
    { type:'combo',   targetBase:  8, label:'คอมโบต่อเนื่อง', desc:'ทำคอมโบให้ถึงเป้าหมาย' },
    { type:'junkAvoid', targetBase:  0, label:'หลบของขยะ', desc:'ช่วงนี้อย่าโดนขยะเลย' },
    { type:'goodHit', targetBase: 12, label:'เก็บของดี (ยากขึ้น)', desc:'แตะ “ของดี” ให้ครบ' },
    { type:'combo',   targetBase: 10, label:'คอมโบใหญ่', desc:'ทำคอมโบให้ถึงเป้าหมาย' },
  ];

  // MINI: เปลี่ยนไว/ผ่านแล้วสลับทันที
  const MINIS = [
    { rule:'noMiss',  sec: 8,  label:'ไม่พลาด!',    desc:'8 วิ ห้าม MISS' },
    { rule:'hitStar', sec: 10, label:'หา ⭐',        desc:'เก็บดาวให้ได้ 1 ครั้ง' },
    { rule:'hitGoodN', sec: 7, label:'เก็บดี x3',    desc:'7 วิ เก็บของดี 3 ครั้ง', n:3 },
    { rule:'hitStar', sec: 10, label:'หา ⭐ อีกครั้ง',desc:'เก็บดาวให้ได้ 1 ครั้ง' },
    { rule:'noMiss',  sec: 9,  label:'ไม่พลาด (ยาวขึ้น)', desc:'9 วิ ห้าม MISS' },
    { rule:'hitGoodN', sec: 8, label:'เก็บดี x4',    desc:'8 วิ เก็บของดี 4 ครั้ง', n:4 },
  ];

  function goalTargetFor(g){
    // scale a bit with diff
    const base = g.targetBase;
    if(g.type==='junkAvoid') return (diff==='hard') ? 0 : 0;
    if(diff==='easy') return Math.max(6, Math.round(base*0.9));
    if(diff==='hard') return Math.max(8, Math.round(base*1.15));
    return base;
  }

  function startGoal(idx){
    const g = GOALS[idx % GOALS.length];
    S.goalIndex = idx;
    S.goalType = g.type;
    S.goalCur = 0;
    S.goalTarget = goalTargetFor(g);
    S.goalStartScore = S.score;
    S.goalStartMiss = S.miss;

    setText(elHudGoal, g.label);
    setText(elGoalDesc, g.desc);
    setText(elGoalCur, S.goalCur);
    setText(elGoalTarget, S.goalTarget);
  }

  function completeGoal(){
    S.goalsCleared++;
    emit('hha:judge', { type:'perfect', label:'GOAL CLEAR!' });

    // instantly next
    startGoal(S.goalIndex + 1);
  }

  function updateGoalProgress(event){
    // event: {kind:'good'|'junk'|'star'|'shield'|'expireGood'|'missJunk'|'blockJunk'}
    if(S.goalType==='goodHit'){
      if(event.kind==='good'){
        S.goalCur++;
      }
    }else if(S.goalType==='combo'){
      // count current combo (not cumulative) -> use max between updates
      S.goalCur = Math.max(S.goalCur, S.combo);
    }else if(S.goalType==='junkAvoid'){
      // succeed if survive some time with no additional miss (use mini style)
      // make it simple: requires "no new miss for 10s"
      // We'll treat this as time-based mini inside goal.
      // If not active, activate countdown.
      if(!S._junkAvoidEndsAt){
        S._junkAvoidEndsAt = WIN.performance.now() + 10000;
      }
      // if miss happens, reset timer
      if(event.kind==='expireGood' || event.kind==='missJunk'){
        S._junkAvoidEndsAt = WIN.performance.now() + 10000;
      }
      const leftMs = Math.max(0, S._junkAvoidEndsAt - WIN.performance.now());
      const secLeft = Math.ceil(leftMs/1000);
      S.goalCur = Math.min(S.goalTarget, 10 - secLeft);
      // treat target=10 as “seconds survived”
      S.goalTarget = 10;
      setText(elGoalTarget, S.goalTarget);
    }

    setText(elGoalCur, S.goalCur);

    if(S.goalType==='junkAvoid'){
      // complete when timer reached
      if(S.goalCur >= S.goalTarget){
        S._junkAvoidEndsAt = 0;
        completeGoal();
      }
      return;
    }

    if(S.goalCur >= S.goalTarget){
      completeGoal();
    }
  }

  function startMini(){
    const m = MINIS[S.minisCleared % MINIS.length];
    S.miniActive = true;
    S.miniSuccess = false;
    S.miniFail = false;
    S.miniProgress = 0;

    S.miniRule = m.rule;
    S.miniParam = m.n || 0;
    S.miniLabel = m.label;

    const ends = WIN.performance.now() + (m.sec*1000);
    S.miniEndsAt = ends;

    setText(elHudMini, `${m.label} — ${m.desc}`);
    setText(elMiniTimer, `${m.sec}s`);
  }

  function endMini(success){
    if(!S.miniActive) return;
    S.miniActive = false;

    if(success){
      S.minisCleared++;
      emit('hha:judge', { type:'perfect', label:'MINI CLEAR!' });
      addScore(12);
      setFever(Math.max(0, S.fever - 6));
    }else{
      emit('hha:judge', { type:'miss', label:'MINI FAIL' });
      addScore(-4);
      setFever(S.fever + 4);
    }

    // swap immediately
    startMini();
    setHUD();
  }

  function updateMiniTimer(){
    if(!S.miniActive) return;
    const leftMs = Math.max(0, S.miniEndsAt - WIN.performance.now());
    const sec = Math.ceil(leftMs/1000);
    setText(elMiniTimer, `${sec}s`);
    if(leftMs<=0){
      // evaluate if passed
      if(S.miniRule==='hitStar'){
        endMini(S.miniProgress >= 1);
      }else if(S.miniRule==='hitGoodN'){
        endMini(S.miniProgress >= S.miniParam);
      }else if(S.miniRule==='noMiss'){
        // if never failed, success
        endMini(true);
      }else{
        endMini(false);
      }
    }
  }

  function onMiniEvent(kind){
    if(!S.miniActive) return;

    if(S.miniRule==='hitStar'){
      if(kind==='star'){
        S.miniProgress = 1;
        endMini(true); // instant pass
      }
    }else if(S.miniRule==='hitGoodN'){
      if(kind==='good'){
        S.miniProgress++;
        // show progress as “x/y”
        setText(elMiniTimer, `${S.miniProgress}/${S.miniParam}`);
        if(S.miniProgress >= S.miniParam){
          endMini(true); // instant pass
        }
      }
    }else if(S.miniRule==='noMiss'){
      if(kind==='expireGood' || kind==='missJunk'){
        endMini(false); // instant fail
      }
    }
  }

  // ---------- Hit logic ----------
  function onHit(kind){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });

      updateGoalProgress({kind:'good'});
      onMiniEvent('good');
    }

    else if(kind==='junk'){
      if(S.shield>0){
        S.shield--;
        setShieldUI();
        emit('hha:judge', { type:'perfect', label:'BLOCK!' });

        updateGoalProgress({kind:'blockJunk'});
        onMiniEvent('blockJunk');
      }else{
        S.hitJunk++;
        S.miss++;
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type:'bad', label:'OOPS' });

        updateGoalProgress({kind:'missJunk'});
        onMiniEvent('missJunk');
      }
    }

    else if(kind==='star'){
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(18);
      setFever(Math.max(0, S.fever - 8));
      emit('hha:judge', { type:'perfect', label: (before!==S.miss) ? 'MISS -1!' : 'STAR!' });

      updateGoalProgress({kind:'star'});
      onMiniEvent('star');
    }

    else if(kind==='shield'){
      S.shield = Math.min(3, S.shield + 1);
      setShieldUI();
      addScore(8);
      emit('hha:judge', { type:'perfect', label:'SHIELD!' });

      updateGoalProgress({kind:'shield'});
      onMiniEvent('shield');
    }

    setHUD();
  }

  // ---------- Spawn ----------
  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();

    // keep away from edges a bit (avoid “ชิดล่างขวา”)
    const pad = 22;
    const x = safe.x + pad + S.rng()*(Math.max(1, safe.w - pad*2));
    const y = safe.y + pad + S.rng()*(Math.max(1, safe.h - pad*2));

    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
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
    const kill = (withFade=false)=>{
      if(!alive) return;
      alive=false;
      if(withFade){
        t.style.transition = `transform ${D.fadeMs}ms ease, opacity ${D.fadeMs}ms ease`;
        t.style.opacity = '0';
        t.style.transform = 'translate(-50%,-50%) scale(.90)';
        setTimeout(()=>{ try{ t.remove(); }catch(_){ } }, D.fadeMs+10);
      }else{
        try{ t.remove(); }catch(_){}
      }
    };

    t.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      kill(true);
      onHit(kind);
    });

    layer.appendChild(t);

    const ttl =
      (kind==='good') ? D.ttlGood :
      (kind==='junk') ? D.ttlJunk :
      D.ttlPower;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill(true);

      // only GOOD expiry counts as MISS (per spec)
      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo = 0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });

        updateGoalProgress({kind:'expireGood'});
        onMiniEvent('expireGood');
        setHUD();
      }
    }, ttl);
  }

  // ---------- Crosshair shoot ----------
  function onShoot(ev){
    if(S.ended || !S.started) return;
    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;

    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    try{ picked.remove(); }catch(_){}
    onHit(kind);
  }

  // ---------- End ----------
  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = computeGrade();
    const summary = {
      game:'GoodJunkVR',
      pack:'fair-v3',
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

      goalsCleared:S.goalsCleared,
      minisCleared:S.minisCleared,
      shieldRemaining:S.shield,
      fever:S.fever,

      grade,
      reason
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    emit('hha:end', summary);
  }

  // ---------- Tick ----------
  function tick(ts){
    if(S.ended) return;
    if(!S.lastTick) S.lastTick = ts;

    const dt = Math.min(0.25, (ts - S.lastTick)/1000);
    S.lastTick = ts;

    S.timeLeft = Math.max(0, S.timeLeft - dt);
    setText(elTime, Math.ceil(S.timeLeft));
    emit('hha:time', { left:S.timeLeft });

    updateMiniTimer();

    // spawn pacing stable
    if(ts - S.lastSpawn >= D.spawnMs){
      S.lastSpawn = ts;

      // fair distribution
      const r = S.rng();
      if(r < D.pGood) spawn('good');
      else if(r < D.pGood + D.pJunk) spawn('junk');
      else if(r < D.pGood + D.pJunk + D.pStar) spawn('star');
      else spawn('shield');
    }

    if(S.timeLeft<=0){
      endGame('timeup');
      return;
    }
    requestAnimationFrame(tick);
  }

  // ---------- Start ----------
  S.started = true;
  setFever(S.fever);
  setShieldUI();
  setHUD();

  // init goal + mini immediately so UI never shows — / 0/0
  startGoal(0);
  startMini();

  // crosshair shoot listener
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', {
    game:'GoodJunkVR',
    pack:'fair-v3',
    view, runMode:run, diff,
    timePlanSec:timePlan,
    seed
  });

  requestAnimationFrame(tick);
}