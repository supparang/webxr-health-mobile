// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v2.3: STORM + Research deterministic + Metrics + Summary history)
// ✅ Spawn safe-zone uses CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ MISS = good expired + junk hit (Shield block junk => NOT miss)
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// ✅ Goals + Mini shown via quest:update + HUD ids in run.html
// ✅ STORM (ท้ายเกม): spawn ถี่ขึ้น + junk มากขึ้น (แฟร์)
// ✅ Research deterministic: quantized time step + deterministic spawn accumulator
// ✅ Metrics: reaction time (rtMs), phase, groupId, missReason -> ส่งไป logger ผ่าน hha:judge
// ✅ End summary: HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY

'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();
  const css = getComputedStyle(DOC.documentElement);
  const top = parseInt(css.getPropertyValue('--gj-top-safe')) || 160;
  const bot = parseInt(css.getPropertyValue('--gj-bottom-safe')) || 140;

  const margin = (r.width < 520) ? 36 : 26;
  const x = margin;
  const y = Math.max(80, top + 8);
  const w = Math.max(120, r.width  - margin*2);
  const h = Math.max(140, r.height - y - bot - 10);
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

    const ex = (b.left + b.right)/2;
    const ey = (b.top  + b.bottom)/2;
    const dx = ex - cx, dy = ey - cy;
    const d2 = dx*dx + dy*dy;

    if(!best || d2 < best.d2) best = { el, d2 };
  }
  return best ? best.el : null;
}

/* -----------------------------
   5 Food Groups (TH) mapping
------------------------------ */
const FOOD5 = {
  1: { labelTH:'หมู่ 1 โปรตีน', emojis:['🥚','🥛','🐟','🍗','🫘'] },
  2: { labelTH:'หมู่ 2 คาร์โบไฮเดรต', emojis:['🍚','🍞','🥔','🍠','🍜'] },
  3: { labelTH:'หมู่ 3 ผัก', emojis:['🥦','🥬','🥒','🥕','🌽'] },
  4: { labelTH:'หมู่ 4 ผลไม้', emojis:['🍎','🍌','🍊','🍇','🍉'] },
  5: { labelTH:'หมู่ 5 ไขมัน', emojis:['🥑','🧈','🥜','🫒','🧀'] },
};
const JUNK = { labelTH:'ขยะอาหาร', emojis:['🍟','🍔','🍕','🍩','🥤'] };

function pickEmoji(rng, arr){
  const r = (rng ? rng() : Math.random());
  return arr[Math.floor(r * arr.length)] || arr[0] || '🍎';
}
function chooseGroupId(rng){
  return 1 + Math.floor((rng ? rng() : Math.random()) * 5);
}
function decorateTarget(el, t){
  if(!el || !t) return;

  if(t.kind === 'good'){
    const gid = t.groupId || 1;
    const emo = pickEmoji(t.rng, FOOD5[gid]?.emojis || ['🍎']);
    el.textContent = emo;
    el.dataset.group = String(gid);
    el.setAttribute('aria-label', `${FOOD5[gid]?.labelTH || 'หมู่ 1'} ${emo}`);
  }else if(t.kind === 'junk'){
    const emo = pickEmoji(t.rng, JUNK.emojis);
    el.textContent = emo;
    el.dataset.group = 'junk';
    el.setAttribute('aria-label', `${JUNK.labelTH} ${emo}`);
  }else if(t.kind === 'star'){
    el.textContent = '⭐';
    el.dataset.group = 'star';
    el.setAttribute('aria-label', `โบนัส ⭐`);
  }else if(t.kind === 'shield'){
    el.textContent = '🛡️';
    el.dataset.group = 'shield';
    el.setAttribute('aria-label', `โบนัส 🛡️`);
  }
}

/* -----------------------------
   Goals + Mini (Fast & Fair)
------------------------------ */
const GOALS = [
  { name:'เก็บของดี',  sub:'แตะ/ยิงของดีให้ครบ 10 ชิ้น', target:10, key:'good' },
  { name:'เลี่ยงขยะ',  sub:'อย่าชนขยะให้ครบ 8 วินาที',   target:8,  key:'noJunkSec' },
  { name:'คอมโบ',      sub:'ทำคอมโบให้ถึง 6',            target:6,  key:'combo' },
  { name:'ห้ามพลาด',   sub:'อย่าปล่อยของดีหลุด 4 วินาที', target:4,  key:'noExpireSec' },
];
function makeMini(){
  return { name:'ครบ 3 หมู่ใน 12 วิ', sub:'เก็บของดีต่างหมู่ 3 หมู่', target:3, windowSec:12 };
}

/* -----------------------------
   Mode helpers
------------------------------ */
function isResearch(run){
  run = String(run||'play').toLowerCase();
  return (run === 'research' || run === 'study');
}

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));
  const research = isResearch(run);

  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');

  const elGoalName   = DOC.getElementById('hud-goal');
  const elGoalDesc   = DOC.getElementById('goalDesc');
  const elGoalCur    = DOC.getElementById('hud-goal-cur');
  const elGoalTarget = DOC.getElementById('hud-goal-target');

  const elMiniDesc   = DOC.getElementById('hud-mini');
  const elMiniTimer  = DOC.getElementById('miniTimer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  const layer = DOC.getElementById('gj-layer');

  const rng = makeRNG(seed);

  const S = {
    started:false, ended:false,
    view, run, diff, research,
    timePlan, timeLeft: timePlan,
    seed, rng,

    score:0,
    miss:0,

    hitGood:0, hitJunk:0, expireGood:0,
    combo:0, comboMax:0,

    shield:0,
    fever:18,

    lastTick:0,

    // deterministic scheduler
    startTs: 0,
    lastQuant: 0,
    spawnAcc: 0,

    // fairness: cap targets in field
    maxTargets: (view === 'pc') ? 8 : 7,

    // goals
    goalIndex: 0,
    goalCur: 0,
    noJunkAcc: 0,
    noExpireAcc: 0,

    // mini
    mini: makeMini(),
    miniStartTs: 0,
    miniGroups: new Set(),
    miniDone: false,

    // phase
    phase: 'normal', // normal | storm

    // metrics (RT)
    rtGoodSum: 0,
    rtGoodN: 0,
    rtAllSum: 0,
    rtAllN: 0,
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

  function gradeNow(){
    let g='C';
    if(S.score>=170 && S.miss<=3) g='A';
    else if(S.score>=110) g='B';
    else if(S.score>=65) g='C';
    else g='D';
    return g;
  }

  function emitScore(){
    emit('hha:score', { score:S.score, miss:S.miss, combo:S.combo, fever:S.fever, phase:S.phase });
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);
    if(elGrade) elGrade.textContent = gradeNow();
    setShieldUI();
    emitScore();
  }

  function setQuestUI(){
    const g = GOALS[S.goalIndex] || GOALS[GOALS.length-1];

    let cur = S.goalCur;
    let tar = g.target;

    if(g.key === 'noJunkSec'){ cur = Math.floor(S.noJunkAcc); tar = g.target; }
    if(g.key === 'noExpireSec'){ cur = Math.floor(S.noExpireAcc); tar = g.target; }
    if(g.key === 'combo'){ cur = Math.min(S.comboMax, g.target); tar = g.target; }

    if(elGoalName) elGoalName.textContent = g.name;
    if(elGoalDesc) elGoalDesc.textContent = g.sub;
    if(elGoalCur) elGoalCur.textContent = String(cur);
    if(elGoalTarget) elGoalTarget.textContent = String(tar);

    const remain = Math.max(0, S.mini.windowSec - (performance.now() - S.miniStartTs)/1000);
    if(elMiniDesc) elMiniDesc.textContent = `${S.mini.name} (${S.miniGroups.size}/${S.mini.target})`;
    if(elMiniTimer) elMiniTimer.textContent = S.miniDone ? 'PASS!' : `${Math.ceil(remain)}s`;

    emit('quest:update', {
      goal:{ name:g.name, sub:g.sub, cur, target:tar, done:(cur>=tar) },
      mini:{ name:S.mini.name, sub:S.mini.sub, cur:S.miniGroups.size, target:S.mini.target, done:S.miniDone },
      allDone:false
    });
  }

  function nextGoal(){
    S.goalIndex = Math.min(GOALS.length-1, S.goalIndex + 1);
    S.goalCur = 0;
    S.noJunkAcc = 0;
    S.noExpireAcc = 0;
    setQuestUI();
  }

  function resetMini(){
    S.mini = makeMini();
    S.miniStartTs = performance.now();
    S.miniGroups.clear();
    S.miniDone = false;
    setQuestUI();
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score < 0) S.score = 0;
  }

  function addRT(kind, rtMs){
    const ms = clamp(rtMs, 0, 6000);
    S.rtAllSum += ms; S.rtAllN++;
    if(kind === 'good'){ S.rtGoodSum += ms; S.rtGoodN++; }
  }

  function onHit(kind, meta={}, extra={}){
    if(S.ended) return;

    const rtMs = Number(extra.rtMs ?? 0) || 0;
    if(rtMs > 0) addRT(kind, rtMs);

    if(kind === 'good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);

      const g = GOALS[S.goalIndex];
      if(g?.key === 'good'){
        S.goalCur++;
        if(S.goalCur >= g.target) nextGoal();
      }

      const gid = meta.groupId || 1;

      if(performance.now() - S.miniStartTs > S.mini.windowSec*1000) resetMini();
      S.miniGroups.add(gid);

      if(!S.miniDone && S.miniGroups.size >= S.mini.target){
        S.miniDone = true;

        // reward: shield or star-equivalent (fair)
        if(S.rng() < 0.55){
          S.shield = Math.min(3, S.shield + 1);
          emit('hha:judge', { type:'perfect', label:'BONUS 🛡️', phase:S.phase });
        }else{
          const before = S.miss;
          S.miss = Math.max(0, S.miss - 1);
          addScore(18);
          emit('hha:judge', { type:'perfect', label:(before!==S.miss) ? 'BONUS ⭐ (MISS-1)' : 'BONUS ⭐', phase:S.phase });
        }

        try{
          WIN.dispatchEvent(new CustomEvent('hha:coach',{detail:{msg:`ครบ ${S.mini.target} หมู่ใน ${S.mini.windowSec} วิ! 🎁 โบนัสแล้ว!`, tag:'Coach'}}));
        }catch{}
      }

      emit('hha:judge', { type:'good', label:'GOOD', groupId:gid, rtMs, phase:S.phase });
    }

    else if(kind === 'junk'){
      if(S.shield > 0){
        S.shield--;
        emit('hha:judge', { type:'perfect', label:'BLOCK!', rtMs, phase:S.phase });
      }else{
        S.hitJunk++;
        S.miss++;
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type:'bad', label:'OOPS', rtMs, phase:S.phase });
      }
      S.noJunkAcc = 0;
    }

    else if(kind === 'star'){
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(18);
      setFever(Math.max(0, S.fever - 8));
      emit('hha:judge', { type:'perfect', label:(before!==S.miss) ? 'MISS -1!' : 'STAR!', phase:S.phase });
    }

    else if(kind === 'shield'){
      S.shield = Math.min(3, S.shield + 1);
      addScore(8);
      emit('hha:judge', { type:'perfect', label:'SHIELD!', phase:S.phase });
    }

    setHUD();
    setQuestUI();
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const live = layer.querySelectorAll('.gj-target').length;
    if(live >= S.maxTargets) return;

    const safe = getSafeRect();
    const x = safe.x + S.rng()*safe.w;
    const y = safe.y + S.rng()*safe.h;

    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
    t.dataset.kind = kind;

    const meta = { kind, rng: S.rng, groupId: 1 };
    if(kind === 'good') meta.groupId = chooseGroupId(S.rng);

    decorateTarget(t, meta);

    const size = (kind === 'good') ? 56 : (kind === 'junk') ? 58 : 52;
    t.style.left = x+'px';
    t.style.top  = y+'px';
    t.style.fontSize = size+'px';

    // metrics: spawn timestamp
    const born = performance.now();
    t.dataset.born = String(born);

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive=false;
      try{ t.remove(); }catch(_){}
    };

    t.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      kill();
      const rtMs = performance.now() - born;
      onHit(kind, meta, { rtMs });
    });

    layer.appendChild(t);

    // TTL
    const ttl = (kind==='star' || kind==='shield') ? 1800 : 1650;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();

      if(kind === 'good'){
        S.expireGood++;
        S.miss++;
        S.combo = 0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS', reason:'good_expire', rtMs: ttl, phase:S.phase });

        S.noExpireAcc = 0;

        setHUD();
        setQuestUI();
      }
    }, ttl);
  }

  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    const gid  = Number(picked.dataset.group || 1) || 1;

    const born = Number(picked.dataset.born || 0) || performance.now();
    const rtMs = performance.now() - born;

    try{ picked.remove(); }catch(_){}
    onHit(kind, { groupId: gid }, { rtMs });
  }

  function pushHistory(summary){
    try{
      const raw = localStorage.getItem(LS_HIST);
      const arr = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(arr) ? arr : [];
      list.unshift(summary);
      const kept = list.slice(0, 30);
      localStorage.setItem(LS_HIST, JSON.stringify(kept));
    }catch(_){}
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : gradeNow();

    const rtGoodAvg = (S.rtGoodN>0) ? Math.round(S.rtGoodSum / S.rtGoodN) : 0;
    const rtAllAvg  = (S.rtAllN>0)  ? Math.round(S.rtAllSum  / S.rtAllN)  : 0;

    const summary = {
      game:'GoodJunkVR',
      pack:'fair',
      version:'v2.3',
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
      rtGoodAvgMs: rtGoodAvg,
      rtAllAvgMs: rtAllAvg,
      grade,
      reason
    };

    try{ localStorage.setItem(LS_LAST, JSON.stringify(summary)); }catch(_){}
    pushHistory(summary);

    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    emit('hha:end', summary);
  }

  function setPhase(next){
    if(S.phase === next) return;
    S.phase = next;
    try{
      DOC.body.classList.toggle('storm', next === 'storm');
    }catch(_){}
    emit('hha:phase', { phase: S.phase });
    setHUD();
  }

  function distAndInterval(){
    // normal vs storm
    const storm = (S.timeLeft <= 15); // ✅ last 15s
    if(storm) setPhase('storm'); else setPhase('normal');

    if(S.phase === 'storm'){
      // เร้าใจขึ้น แต่ยังแฟร์
      return {
        interval: 650, // ms
        // 62% good, 34% junk, 2% star, 2% shield
        pick: ()=>{
          const r = S.rng();
          if(r < 0.62) return 'good';
          if(r < 0.96) return 'junk';
          if(r < 0.98) return 'star';
          return 'shield';
        }
      };
    }

    return {
      interval: 900,
      // 70% good, 26% junk, 2% star, 2% shield
      pick: ()=>{
        const r = S.rng();
        if(r < 0.70) return 'good';
        if(r < 0.96) return 'junk';
        if(r < 0.98) return 'star';
        return 'shield';
      }
    };
  }

  function tick(ts){
    if(S.ended) return;

    if(!S.startTs){
      S.startTs = ts;
      S.lastQuant = 0;
      S.spawnAcc = 0;
      S.lastTick = ts;
    }

    // ✅ dt handling
    let dt;
    if(S.research){
      // quantized time step (60Hz) => reproducible pattern
      const tSec = (ts - S.startTs)/1000;
      const q = Math.floor(tSec * 60) / 60;
      dt = q - S.lastQuant;
      if(dt < 0) dt = 0;
      if(dt > 0.25) dt = 0.25;
      S.lastQuant = q;
    }else{
      dt = Math.min(0.25, (ts - S.lastTick)/1000);
      S.lastTick = ts;
    }

    S.timeLeft = Math.max(0, S.timeLeft - dt);
    if(elTime) elTime.textContent = String(Math.ceil(S.timeLeft));
    emit('hha:time', { left:S.timeLeft, phase:S.phase });

    // goal streak meters
    const g = GOALS[S.goalIndex];
    if(g?.key === 'noJunkSec'){
      S.noJunkAcc += dt;
      if(Math.floor(S.noJunkAcc) >= g.target) nextGoal();
    }
    if(g?.key === 'noExpireSec'){
      S.noExpireAcc += dt;
      if(Math.floor(S.noExpireAcc) >= g.target) nextGoal();
    }

    // ✅ deterministic spawn accumulator
    const cfg = distAndInterval();
    S.spawnAcc += (dt * 1000);

    while(S.spawnAcc >= cfg.interval){
      S.spawnAcc -= cfg.interval;
      spawn(cfg.pick());
    }

    if(S.timeLeft <= 0){
      endGame('timeup');
      return;
    }
    requestAnimationFrame(tick);
  }

  // start
  S.started = true;
  S.miniStartTs = performance.now();

  setFever(S.fever);
  setShieldUI();
  setHUD();
  setQuestUI();
  setPhase('normal');

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair', version:'v2.3', view, runMode:run, diff, timePlanSec:timePlan, seed, research });
  requestAnimationFrame(tick);
}