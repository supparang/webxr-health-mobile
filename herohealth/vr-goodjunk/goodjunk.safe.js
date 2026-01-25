// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v2.2 PATCH B3)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ Anti-clump spawn (retry + min distance)
// ✅ Cap max targets on screen (prevents overload)
// ✅ TTL fair by diff (easy slower, hard faster) + powerups longer
// ✅ MISS = good expired + junk hit (shield blocks junk => NOT miss)
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// ✅ GOAL + MINI missions (HUD fields in A are used)
// ✅ Low-time overlay (A has #lowTimeOverlay)
// ✅ Emits: hha:start, hha:score, hha:time, hha:judge, hha:metrics, hha:end

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };
const nowMs = ()=> (performance?.now?.() ?? Date.now());

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

  // HUD refs
  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');
  const layer   = DOC.getElementById('gj-layer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  // Mission HUD (A has these)
  const elGoalTitle = DOC.getElementById('hud-goal');
  const elGoalDesc  = DOC.getElementById('goalDesc');
  const elGoalCur   = DOC.getElementById('hud-goal-cur');
  const elGoalTar   = DOC.getElementById('hud-goal-target');
  const elMiniText  = DOC.getElementById('hud-mini');
  const elMiniTimer = DOC.getElementById('miniTimer');

  // Low time overlay
  const elLow = DOC.getElementById('lowTimeOverlay');
  const elLowNum = DOC.getElementById('gj-lowtime-num');

  // ---- difficulty knobs (FAIR) ----
  const CFG = (() => {
    // base spawn interval + ttl + max targets
    // เด็ก ป.5: easy เล่นสบาย / normal สนุก / hard ท้าทาย
    if(diff === 'easy'){
      return { spawnMs: 980, ttlGood: 2200, ttlJunk: 2200, ttlPow: 2600, maxTargets: 7, minDist: 88 };
    }
    if(diff === 'hard'){
      return { spawnMs: 820, ttlGood: 1600, ttlJunk: 1650, ttlPow: 2300, maxTargets: 8, minDist: 78 };
    }
    return { spawnMs: 900, ttlGood: 1900, ttlJunk: 1900, ttlPow: 2450, maxTargets: 7, minDist: 84 };
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

    // AI metrics
    rtSamples: [],
    rtAvg: 0,

    // missions
    goalIndex: 0,
    goalCur: 0,
    goalTarget: 0,

    miniActive: false,
    miniDone: false,
    miniCur: 0,
    miniTarget: 0,
    miniEndsAt: 0,

    // anti-spam overlay
    lowShown: false,
    lastLowSec: -1,
  };

  // ---- Mission definitions (simple but fun) ----
  // GOAL: เก็บของดีจำนวนหนึ่ง (เพิ่มขึ้นตามด่าน)
  // MINI: ทำคอมโบให้ถึง X ภายใน Y วินาที (ผ่านแล้วให้โบนัส STAR/SHIELD)
  const GOALS = [
    { name:'เก็บของดี', desc:'แตะ/ยิง “ของดี” ให้ได้ครบ', target: (diff==='easy'? 10 : diff==='hard'? 14 : 12) },
    { name:'เก็บของดีต่อเนื่อง', desc:'เก็บของดีให้ได้เพิ่มอีก', target: (diff==='easy'? 12 : diff==='hard'? 16 : 14) },
    { name:'ทำคะแนนพุ่ง', desc:'เก็บของดีให้ได้เยอะ ๆ แล้วเลี่ยงของเสีย', target: (diff==='easy'? 14 : diff==='hard'? 18 : 16) },
  ];

  function miniStart(){
    S.miniActive = true;
    S.miniDone = false;
    S.miniCur = 0;
    S.miniTarget = (diff==='easy' ? 5 : diff==='hard' ? 7 : 6);  // combo target
    const winSec = (diff==='easy' ? 12 : diff==='hard' ? 10 : 11);
    S.miniEndsAt = nowMs() + winSec*1000;

    if(elMiniText) elMiniText.textContent = `ทำคอมโบให้ถึง ${S.miniTarget}`;
    if(elMiniTimer) elMiniTimer.textContent = `${winSec}s`;
  }

  function miniTick(){
    if(!S.miniActive || S.miniDone) return;
    const leftMs = S.miniEndsAt - nowMs();
    const left = Math.max(0, Math.ceil(leftMs/1000));
    if(elMiniTimer) elMiniTimer.textContent = `${left}s`;
    if(leftMs <= 0){
      // fail -> restart window
      miniStart();
    }
  }

  function goalInit(){
    S.goalIndex = 0;
    S.goalCur = 0;
    S.goalTarget = GOALS[0].target;
    if(elGoalTitle) elGoalTitle.textContent = `${GOALS[0].name}`;
    if(elGoalDesc) elGoalDesc.textContent = `${GOALS[0].desc}`;
    if(elGoalCur) elGoalCur.textContent = '0';
    if(elGoalTar) elGoalTar.textContent = String(S.goalTarget);
  }

  function goalAdvance(){
    S.goalIndex = Math.min(GOALS.length-1, S.goalIndex+1);
    S.goalCur = 0;
    S.goalTarget = GOALS[S.goalIndex].target;

    if(elGoalTitle) elGoalTitle.textContent = `${GOALS[S.goalIndex].name}`;
    if(elGoalDesc) elGoalDesc.textContent = `${GOALS[S.goalIndex].desc}`;
    if(elGoalCur) elGoalCur.textContent = '0';
    if(elGoalTar) elGoalTar.textContent = String(S.goalTarget);

    // start a new mini each time goal changes
    miniStart();

    // announce
    emit('hha:coach', { msg:`GOAL ใหม่! ${GOALS[S.goalIndex].name} ${S.goalTarget} ครั้ง`, tag:'Goal' });
  }

  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if(elFeverText) elFeverText.textContent = `${S.fever}%`;
  }

  function setShieldUI(){
    if(!elShield) return;
    elShield.textContent = (S.shield>0) ? `x${S.shield}` : '—';
  }

  function calcGrade(){
    // ปรับให้แฟร์ขึ้น (เด็กเล่นแล้วมี A ได้จริง)
    // เน้น miss มากกว่า score
    let g='C';
    if(S.score>=175 && S.miss<=3) g='A';
    else if(S.score>=115 && S.miss<=6) g='B';
    else if(S.score>=70) g='C';
    else g='D';
    return g;
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);
    if(elGrade) elGrade.textContent = calcGrade();

    if(elGoalCur) elGoalCur.textContent = String(S.goalCur);
    if(elGoalTar) elGoalTar.textContent = String(S.goalTarget);

    setShieldUI();
    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function emitMetrics(){
    emit('hha:metrics', {
      metrics: {
        miss: S.miss,
        combo: S.combo,
        rtAvg: S.rtAvg,
        fever: S.fever,
        score: S.score
      }
    });
  }

  function onHit(kind, rtMs=null){
    if(S.ended) return;

    // RT avg for AI tips
    if(rtMs != null && isFinite(rtMs)){
      S.rtSamples.push(rtMs);
      if(S.rtSamples.length > 20) S.rtSamples.shift();
      const sum = S.rtSamples.reduce((a,b)=>a+b,0);
      S.rtAvg = Math.round(sum / S.rtSamples.length);
    }

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });

      // GOAL progress
      S.goalCur++;
      if(S.goalCur >= S.goalTarget){
        goalAdvance();
      }

      // MINI progress (combo-based)
      if(!S.miniActive) miniStart();
      if(!S.miniDone){
        S.miniCur = S.combo; // combo is progress
        if(elMiniText) elMiniText.textContent = `ทำคอมโบให้ถึง ${S.miniTarget} (ตอนนี้ ${S.miniCur})`;
        if(S.miniCur >= S.miniTarget){
          S.miniDone = true;
          // โบนัส: ให้ shield 1 + ลด miss 1 (แฟร์)
          S.shield = Math.min(3, S.shield + 1);
          const before = S.miss;
          S.miss = Math.max(0, S.miss - 1);
          addScore(22);
          setFever(Math.max(0, S.fever - 6));
          emit('hha:judge', { type:'perfect', label:(before!==S.miss)?'BONUS! MISS -1 + SHIELD':'BONUS! SHIELD' });
          emit('hha:coach', { msg:`MINI สำเร็จ! ได้ 🛡️ + ลด MISS`, tag:'Bonus' });

          // restart mini window soon
          setTimeout(()=>miniStart(), 450);
        }
      }
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
    emitMetrics();
  }

  function countTargets(){
    return DOC.querySelectorAll('.gj-target').length;
  }

  function isFarEnough(x,y, minDist){
    // ตรวจจากตำแหน่ง dataset ของ target ที่ยังอยู่
    const els = Array.from(DOC.querySelectorAll('.gj-target'));
    const md2 = minDist*minDist;
    for(const el of els){
      const ex = Number(el.dataset.cx || 0);
      const ey = Number(el.dataset.cy || 0);
      if(!ex && !ey) continue;
      const dx = ex - x;
      const dy = ey - y;
      if(dx*dx + dy*dy < md2) return false;
    }
    return true;
  }

  function findSpawnXY(){
    const safe = getSafeRect();
    // margin กันชิดขอบ
    const margin = 18;
    const minDist = CFG.minDist;

    for(let i=0;i<16;i++){
      const x = safe.x + margin + S.rng()*(safe.w - margin*2);
      const y = safe.y + margin + S.rng()*(safe.h - margin*2);
      if(isFarEnough(x,y,minDist)){
        return { x,y };
      }
    }
    // ถ้าหาที่ห่างไม่ได้ ให้ยอมปล่อย (กันเกมค้าง)
    const x = safe.x + margin + S.rng()*(safe.w - margin*2);
    const y = safe.y + margin + S.rng()*(safe.h - margin*2);
    return { x,y };
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    // cap prevents overload
    if(countTargets() >= CFG.maxTargets){
      return;
    }

    const { x,y } = findSpawnXY();

    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
    t.dataset.kind = kind;

    // emoji (ถ้าจะต่อ food5 mapping ค่อยเสียบทีหลัง)
    t.textContent =
      (kind==='good') ? '🥦' :
      (kind==='junk') ? '🍟' :
      (kind==='star') ? '⭐' : '🛡️';

    // sizes (ใหญ่ขึ้นนิดเพื่อเด็ก ป.5)
    const size =
      (kind==='good') ? 60 :
      (kind==='junk') ? 62 :
      54;

    t.style.left = x+'px';
    t.style.top  = y+'px';
    t.style.fontSize = size+'px';

    // store center for anti-clump
    t.dataset.cx = String(x);
    t.dataset.cy = String(y);

    // store born time for RT
    const born = nowMs();
    t.dataset.spawnAt = String(born);

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive=false;
      try{ t.remove(); }catch(_){}
    };

    // remove spawn class quickly (animation only once)
    setTimeout(()=>{ try{ t.classList.remove('spawn'); }catch(_){ } }, 140);

    t.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      const bornAt = Number(t.dataset.spawnAt || 0);
      const rt = bornAt ? (nowMs() - bornAt) : null;
      kill();
      onHit(kind, rt);
    });

    layer.appendChild(t);

    // TTL by kind+diff (แฟร์)
    const ttl =
      (kind==='star' || kind==='shield') ? CFG.ttlPow :
      (kind==='good') ? CFG.ttlGood :
      CFG.ttlJunk;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();

      // only good expiry counts as miss
      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo=0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });
        setHUD();
        emitMetrics();
      }
    }, ttl);
  }

  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const bornAt = Number(picked.dataset.spawnAt || 0);
    const rt = bornAt ? (nowMs() - bornAt) : null;

    const kind = picked.dataset.kind || 'good';
    try{ picked.remove(); }catch(_){}
    onHit(kind, rt);
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    // hide low overlay
    try{
      elLow?.setAttribute('aria-hidden','true');
    }catch(_){}

    const grade = calcGrade();
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
      rtAvgMs: S.rtAvg,
      grade,
      reason
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    emit('hha:end', summary);
  }

  function lowTimeUpdate(){
    const left = Math.ceil(S.timeLeft);
    if(left <= 5){
      if(!S.lowShown){
        S.lowShown = true;
        try{ elLow?.setAttribute('aria-hidden','false'); }catch(_){}
      }
      if(elLowNum) elLowNum.textContent = String(left);
      // ลด spam judge
      if(left !== S.lastLowSec){
        S.lastLowSec = left;
        emit('hha:judge', { type:'warn', label:`${left}` });
      }
    }else{
      if(S.lowShown){
        S.lowShown = false;
        try{ elLow?.setAttribute('aria-hidden','true'); }catch(_){}
      }
    }
  }

  function tick(ts){
    if(S.ended) return;
    if(!S.lastTick) S.lastTick = ts;

    const dt = Math.min(0.25, (ts - S.lastTick)/1000);
    S.lastTick = ts;

    S.timeLeft = Math.max(0, S.timeLeft - dt);
    if(elTime) elTime.textContent = String(Math.ceil(S.timeLeft));
    emit('hha:time', { left:S.timeLeft });

    // mini timer
    miniTick();

    // spawn cadence (fair + cap)
    if(ts - S.lastSpawn >= CFG.spawnMs){
      S.lastSpawn = ts;

      // fair distribution:
      // 70% good, 26% junk, 2% star, 2% shield
      const r = S.rng();
      if(r < 0.70) spawn('good');
      else if(r < 0.96) spawn('junk');
      else if(r < 0.98) spawn('star');
      else spawn('shield');
    }

    // low time overlay
    lowTimeUpdate();

    if(S.timeLeft<=0){
      endGame('timeup');
      return;
    }
    requestAnimationFrame(tick);
  }

  // start
  S.started = true;

  goalInit();
  miniStart();

  setFever(S.fever);
  setShieldUI();
  setHUD();

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}