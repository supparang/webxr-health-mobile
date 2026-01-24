// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v2.2: QUEST + FOOD5 + STABLE TARGETS)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ MISS = good expired + junk hit
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// ✅ GOAL/MINI quest updates (HUD + missions peek ready)
// ✅ Food 5 groups mapping for GOOD targets (educational)
// Emits: hha:start, hha:score, hha:time, hha:judge, quest:update, hha:end

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

/* ---------------------------
   Food 5 groups mapping (Thai)
   หมู่ 1 โปรตีน | หมู่ 2 คาร์บ | หมู่ 3 ผัก | หมู่ 4 ผลไม้ | หมู่ 5 ไขมัน
--------------------------- */
const FOOD5 = {
  1:{ label:'หมู่ 1 โปรตีน', emojis:['🥚','🐟','🍗','🥛','🫘'] },
  2:{ label:'หมู่ 2 คาร์โบไฮเดรต', emojis:['🍚','🍞','🥔','🌽','🍜'] },
  3:{ label:'หมู่ 3 ผัก', emojis:['🥦','🥬','🥕','🍆','🥒'] },
  4:{ label:'หมู่ 4 ผลไม้', emojis:['🍎','🍌','🍊','🍉','🍇'] },
  5:{ label:'หมู่ 5 ไขมัน', emojis:['🥑','🫒','🥜','🧈','🧀'] },
};
const JUNK = { label:'ขยะอาหาร', emojis:['🍟','🍔','🍕','🧋','🍩','🍭'] };

function pickEmoji(rng, arr){
  const a = arr || ['⭐'];
  const i = Math.floor((rng?rng():Math.random()) * a.length);
  return a[Math.max(0, Math.min(a.length-1, i))];
}
function chooseGroupId(rng){
  return 1 + Math.floor((rng?rng():Math.random()) * 5);
}

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(opts.time ?? qs('time','80'), 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');
  const layer   = DOC.getElementById('gj-layer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  // Quest DOM
  const elGoal   = DOC.getElementById('hud-goal');
  const elGoalD  = DOC.getElementById('goalDesc');
  const elGoalC  = DOC.getElementById('hud-goal-cur');
  const elGoalT  = DOC.getElementById('hud-goal-target');
  const elMini   = DOC.getElementById('hud-mini');
  const elMiniT  = DOC.getElementById('miniTimer');

  // Low time overlay
  const elLowOv  = DOC.getElementById('lowTimeOverlay');
  const elLowNum = DOC.getElementById('gj-lowtime-num');

  const rng = makeRNG(seed);

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng,

    score:0, miss:0,
    hitGood:0, hitJunk:0, expireGood:0,
    combo:0, comboMax:0,

    shield:0,
    fever:18,

    lastTick:0,
    lastSpawn:0,

    // for stable gameplay feel
    maxTargets: (view==='pc') ? 8 : 6,

    // goal/mini
    goalIndex:0,
    goalCur:0,
    goalTarget:0,

    miniName:'',
    miniWindowSec:12,
    miniStartMs:0,
    miniGroups:new Set(),
    miniDone:false,
    miniCooldownMs:2000,
    miniLastRewardMs:0,
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

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);
    if(elGrade) elGrade.textContent = gradeNow();
    setShieldUI();
    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  /* ---------------------------
     Quest system (FAIR)
  --------------------------- */
  const GOALS = [
    { name:'เก็บของดี', sub:'แตะ/ยิง “ของดี” ให้ครบ', target:(d)=> d==='easy'?10:(d==='hard'?16:13) },
    { name:'เลี่ยงของเสีย', sub:'ห้ามโดน JUNK เกิน 2 ครั้ง', target:1 }, // ใช้ target เป็น “ผ่าน” (เช็คด้วย rule)
    { name:'คอมโบสวย ๆ', sub:'ทำคอมโบให้ถึง 8', target:8 },
    { name:'จัดการ MISS', sub:'ทำให้ MISS ไม่เกิน 5', target:1 },
  ];

  function setGoal(idx){
    S.goalIndex = idx;
    const g = GOALS[Math.max(0, Math.min(GOALS.length-1, idx))];
    S.goalCur = 0;
    S.goalTarget = (typeof g.target === 'function') ? g.target(S.diff) : g.target;
    if(elGoal) elGoal.textContent = g.name;
    if(elGoalD) elGoalD.textContent = g.sub;
    if(elGoalC) elGoalC.textContent = String(S.goalCur);
    if(elGoalT) elGoalT.textContent = String(S.goalTarget);
    emitQuestUpdate();
  }

  function emitQuestUpdate(){
    const g = GOALS[Math.max(0, Math.min(GOALS.length-1, S.goalIndex))];
    const goal = { name:g.name, sub:g.sub, cur:S.goalCur, target:S.goalTarget };

    const mini = {
      name: S.miniName || `ครบ 3 หมู่ใน ${S.miniWindowSec} วิ`,
      sub: 'ทำได้แล้วได้โบนัส 🛡/⭐',
      cur: Math.min(3, S.miniGroups.size),
      target: 3,
      done: S.miniDone
    };

    emit('quest:update', { goal, mini, allDone:false });
    if(elGoalC) elGoalC.textContent = String(S.goalCur);
    if(elGoalT) elGoalT.textContent = String(S.goalTarget);
    if(elMini)  elMini.textContent  = mini.name;
  }

  function goalCheckAfterEvent(){
    const idx = S.goalIndex;
    if(idx===0){
      // goalCur = hitGood
      if(S.goalCur >= S.goalTarget){
        setGoal(1);
      }
    }else if(idx===1){
      // pass if junk hits <=2 at end OR early if still safe and time left < 10?
      // We'll keep running; show goalCur as "junkHit"
      S.goalCur = S.hitJunk;
      if(S.goalCur <= 2 && S.timeLeft <= Math.max(10, S.timePlan*0.35)){
        setGoal(2);
      }
    }else if(idx===2){
      S.goalCur = S.comboMax;
      if(S.goalCur >= S.goalTarget){
        setGoal(3);
      }
    }else if(idx===3){
      // pass if miss <= 5 near the end
      S.goalCur = S.miss;
      if(S.timeLeft <= 6){
        // end soon; nothing here
      }
    }
    emitQuestUpdate();
  }

  /* ---------------------------
     Mini quest: “ครบ 3 หมู่ใน 12 วิ”
  --------------------------- */
  function resetMini(){
    S.miniStartMs = performance.now ? performance.now() : Date.now();
    S.miniGroups.clear();
    S.miniDone = false;
    S.miniName = `ครบ 3 หมู่ใน ${S.miniWindowSec} วิ`;
    emitQuestUpdate();
  }

  function miniTick(){
    if(!elMiniT) return;
    const now = performance.now ? performance.now() : Date.now();
    const left = Math.max(0, (S.miniWindowSec*1000 - (now - S.miniStartMs)) / 1000);
    elMiniT.textContent = `${left.toFixed(0)}s`;
    if(left<=0 && !S.miniDone){
      resetMini();
    }
  }

  function rewardMini(){
    const now = performance.now ? performance.now() : Date.now();
    if(now - S.miniLastRewardMs < S.miniCooldownMs) return;
    S.miniLastRewardMs = now;

    // Fair reward: give shield OR star effect
    const r = S.rng();
    if(r < 0.55){
      S.shield = Math.min(3, S.shield + 1);
      setShieldUI();
      addScore(12);
      emit('hha:judge', { type:'perfect', label:'BONUS SHIELD!' });
    }else{
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(16);
      setFever(Math.max(0, S.fever - 6));
      emit('hha:judge', { type:'perfect', label:(before!==S.miss)?'BONUS MISS-1!':'BONUS STAR!' });
    }
    setHUD();
  }

  function onHitGoodMeta(groupId){
    const now = performance.now ? performance.now() : Date.now();
    if(now - S.miniStartMs > S.miniWindowSec*1000){
      resetMini();
    }
    S.miniGroups.add(groupId);

    if(!S.miniDone && S.miniGroups.size >= 3){
      S.miniDone = true;
      rewardMini();
      // Immediately restart window (so it feels “ต่อเนื่อง”)
      resetMini();
    }
    emitQuestUpdate();
  }

  /* ---------------------------
     Hit logic
  --------------------------- */
  function onHit(kind, meta={}){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });

      // Goal#1 progress
      if(S.goalIndex===0){
        S.goalCur++;
      }

      // mini meta
      onHitGoodMeta(meta.groupId || 1);
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
    goalCheckAfterEvent();
  }

  /* ---------------------------
     Spawn
  --------------------------- */
  function enforceMaxTargets(){
    if(!layer) return;
    const kids = layer.querySelectorAll('.gj-target');
    if(kids.length <= S.maxTargets) return;
    // remove oldest first
    const extra = kids.length - S.maxTargets;
    for(let i=0;i<extra;i++){
      try{ kids[i].remove(); }catch(_){}
    }
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    enforceMaxTargets();

    const safe = getSafeRect();
    const x = safe.x + S.rng()*safe.w;
    const y = safe.y + S.rng()*safe.h;

    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
    t.dataset.kind = kind;

    // meta
    let groupId = 0;

    if(kind==='good'){
      groupId = chooseGroupId(S.rng);
      const pack = FOOD5[groupId] || FOOD5[1];
      t.textContent = pickEmoji(S.rng, pack.emojis);
      t.dataset.group = String(groupId);
      t.setAttribute('aria-label', `${pack.label} ${t.textContent}`);
    }else if(kind==='junk'){
      t.textContent = pickEmoji(S.rng, JUNK.emojis);
      t.dataset.group = 'junk';
      t.setAttribute('aria-label', `${JUNK.label} ${t.textContent}`);
    }else if(kind==='star'){
      t.textContent = '⭐';
      t.setAttribute('aria-label', 'โบนัส STAR');
    }else{
      t.textContent = '🛡️';
      t.setAttribute('aria-label', 'โบนัส SHIELD');
    }

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
      onHit(kind, { groupId });
    });

    layer.appendChild(t);

    // ✅ “ไม่แว้บ”: TTL ยาวขึ้น + ไม่รกเพราะจำกัดจำนวนเป้า
    const ttlGood  = (diff==='easy') ? 2400 : (diff==='hard' ? 2000 : 2200);
    const ttlJunk  = (diff==='easy') ? 2600 : (diff==='hard' ? 2200 : 2400);
    const ttlPower = 2100;

    const ttl =
      (kind==='good') ? ttlGood :
      (kind==='junk') ? ttlJunk :
      ttlPower;

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
        goalCheckAfterEvent();
      }
    }, ttl);
  }

  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    const groupId = Number(picked.dataset.group || 0) || 0;

    try{ picked.remove(); }catch(_){}
    onHit(kind, { groupId });
  }

  /* ---------------------------
     End
  --------------------------- */
  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

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
      grade: gradeNow(),
      reason
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    emit('hha:end', summary);
  }

  /* ---------------------------
     Tick
  --------------------------- */
  function lowTimeUI(){
    if(!elLowOv || !elLowNum) return;
    const t = Math.ceil(S.timeLeft);
    if(t<=5 && t>0){
      elLowOv.setAttribute('aria-hidden','false');
      elLowNum.textContent = String(t);
    }else{
      elLowOv.setAttribute('aria-hidden','true');
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

    miniTick();
    lowTimeUI();

    // spawn interval (fair)
    const spawnMs =
      (diff==='easy') ? 980 :
      (diff==='hard') ? 820 :
      900;

    if(ts - S.lastSpawn >= spawnMs){
      S.lastSpawn = ts;

      // fair distribution:
      // 70% good, 26% junk, 2% star, 2% shield
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
  setGoal(0);
  resetMini();

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}