// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v2.2: 5 Food Groups + Goals/Mini + Shoot)
// ✅ Spawn safe-zone uses CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ MISS = good expired + junk hit (Shield block junk => NOT miss)
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// ✅ Goals + Mini shown via quest:update + HUD ids in run.html
// Emits: hha:start, hha:score, hha:time, hha:judge, quest:update, hha:end

'use strict';

const WIN = window;
const DOC = document;

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

  // ✅ prevent edges (mobile touch)
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
   Goals + Mini (Fair, fast)
------------------------------ */
const GOALS = [
  { name:'เก็บของดี',  sub:'แตะ/ยิงของดีให้ครบ 10 ชิ้น', target:10, key:'good' },
  { name:'เลี่ยงขยะ',  sub:'อย่าชนขยะให้ครบ 8 วินาที',   target:8,  key:'noJunkSec' },
  { name:'คอมโบ',      sub:'ทำคอมโบให้ถึง 6',            target:6,  key:'combo' },
  { name:'ห้ามพลาด',   sub:'อย่าปล่อยของดีหลุด 4 วินาที', target:4,  key:'noExpireSec' },
];

function makeMini(){
  // mini: collect 3 different groups in 12s
  return { name:'ครบ 3 หมู่ใน 12 วิ', sub:'เก็บของดีต่างหมู่ 3 หมู่', target:3, windowSec:12 };
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
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng,

    score:0,
    miss:0,

    hitGood:0, hitJunk:0, expireGood:0,
    combo:0, comboMax:0,

    shield:0,
    fever:18,

    lastTick:0,
    lastSpawn:0,

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
    emit('hha:score', { score:S.score, miss:S.miss, combo:S.combo, fever:S.fever });
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

    // mini
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
    // keep comboMax (cumulative fun)
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

  function onHit(kind, meta={}){
    if(S.ended) return;

    if(kind === 'good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);

      // goal progress
      const g = GOALS[S.goalIndex];
      if(g?.key === 'good'){
        S.goalCur++;
        if(S.goalCur >= g.target) nextGoal();
      }

      // mini: collect groups
      const gid = meta.groupId || 1;
      if(performance.now() - S.miniStartTs > S.mini.windowSec*1000) resetMini();
      S.miniGroups.add(gid);
      if(!S.miniDone && S.miniGroups.size >= S.mini.target){
        S.miniDone = true;
        // reward: give either star score or shield (fair random)
        if(S.rng() < 0.55){
          S.shield = Math.min(3, S.shield + 1);
          emit('hha:judge', { type:'perfect', label:'BONUS 🛡️' });
        }else{
          // “virtual star”
          const before = S.miss;
          S.miss = Math.max(0, S.miss - 1);
          addScore(18);
          emit('hha:judge', { type:'perfect', label:(before!==S.miss) ? 'BONUS ⭐ (MISS-1)' : 'BONUS ⭐' });
        }
      }

      emit('hha:judge', { type:'good', label:'GOOD', groupId:gid });
    }

    else if(kind === 'junk'){
      if(S.shield > 0){
        S.shield--;
        emit('hha:judge', { type:'perfect', label:'BLOCK!' });
      }else{
        S.hitJunk++;
        S.miss++;
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type:'bad', label:'OOPS' });
      }
      // reset noJunk goal streak
      S.noJunkAcc = 0;
    }

    else if(kind === 'star'){
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(18);
      setFever(Math.max(0, S.fever - 8));
      emit('hha:judge', { type:'perfect', label:(before!==S.miss) ? 'MISS -1!' : 'STAR!' });
    }

    else if(kind === 'shield'){
      S.shield = Math.min(3, S.shield + 1);
      addScore(8);
      emit('hha:judge', { type:'perfect', label:'SHIELD!' });
    }

    setHUD();
    setQuestUI();
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    // cap targets
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

    // sizes
    const size =
      (kind === 'good') ? 56 :
      (kind === 'junk') ? 58 :
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
      onHit(kind, meta);
    });

    layer.appendChild(t);

    // TTL — fair (no blink)
    const ttl = (kind==='star' || kind==='shield') ? 1800 : 1650;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();

      if(kind === 'good'){
        S.expireGood++;
        S.miss++;
        S.combo = 0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS', reason:'good_expire' });

        // reset noExpire streak
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
    const gid = Number(picked.dataset.group || 1) || 1;

    try{ picked.remove(); }catch(_){}
    onHit(kind, { groupId: gid });
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : gradeNow();
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

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
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

    // goal streak meters (time-based)
    const g = GOALS[S.goalIndex];
    if(g?.key === 'noJunkSec'){
      S.noJunkAcc += dt;
      if(Math.floor(S.noJunkAcc) >= g.target) nextGoal();
    }
    if(g?.key === 'noExpireSec'){
      S.noExpireAcc += dt;
      if(Math.floor(S.noExpireAcc) >= g.target) nextGoal();
    }

    // spawn every ~900ms
    if(ts - S.lastSpawn >= 900){
      S.lastSpawn = ts;

      // fair distribution:
      // 70% good, 26% junk, 2% star, 2% shield
      const r = S.rng();
      if(r < 0.70) spawn('good');
      else if(r < 0.96) spawn('junk');
      else if(r < 0.98) spawn('star');
      else spawn('shield');
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

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}