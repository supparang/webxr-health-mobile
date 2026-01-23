// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v2.2: STAR+SHIELD + SHOOT + FOOD5 + QUESTS)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe from goodjunk-vr.html)
// ✅ MISS = good expired + junk hit (blocked junk by Shield does NOT count as MISS)
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (cap 3)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// ✅ FOOD5 TH mapping + decorateTarget (good=หมู่ 1..5, junk=JUNK emojis)
// ✅ GOAL + MINI quest update to HUD (ids already in goodjunk-vr.html)
// Emits: hha:start, hha:score, hha:time, hha:judge, quest:update, hha:coach, hha:end

'use strict';

import { JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
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

/* ----------------------------
 * FOOD5 + decorateTarget
 * ---------------------------- */
function chooseGroupId(rng){
  return 1 + Math.floor((rng ? rng() : Math.random()) * 5); // 1..5 equal
}

function decorateTarget(el, t){
  // t.kind: 'good' | 'junk' | 'star' | 'shield'
  if(!el) return;

  if(t.kind === 'good'){
    const gid = t.groupId || 1;
    const emo = emojiForGroup(t.rng, gid);
    el.textContent = emo;
    el.dataset.group = String(gid);
    el.setAttribute('aria-label', `${labelForGroup(gid)} ${emo}`);
  }
  else if(t.kind === 'junk'){
    const emo = pickEmoji(t.rng, JUNK.emojis);
    el.textContent = emo;
    el.dataset.group = 'junk';
    el.setAttribute('aria-label', `${JUNK.labelTH} ${emo}`);
  }
  else if(t.kind === 'star'){
    el.textContent = '⭐';
    el.dataset.group = 'star';
    el.setAttribute('aria-label', 'ดาวโบนัส');
  }
  else if(t.kind === 'shield'){
    el.textContent = '🛡️';
    el.dataset.group = 'shield';
    el.setAttribute('aria-label', 'โล่ป้องกัน');
  }
}

/* ----------------------------
 * Mini quest meta (fair + fast)
 * “ครบ 3 หมู่ใน 12 วิ”
 * ---------------------------- */
const GJ_META = {
  windowSec: 12,
  windowStartAt: 0,
  windowGroups: new Set(),
  miniDone: false,
};

function resetMiniWindow(){
  GJ_META.windowStartAt = nowMs();
  GJ_META.windowGroups.clear();
  GJ_META.miniDone = false;
}

/* ----------------------------
 * Boot
 * ---------------------------- */
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

  const elGoal = DOC.getElementById('hud-goal');
  const elGoalDesc = DOC.getElementById('goalDesc');
  const elGoalCur = DOC.getElementById('hud-goal-cur');
  const elGoalTar = DOC.getElementById('hud-goal-target');

  const elMini = DOC.getElementById('hud-mini');
  const elMiniTimer = DOC.getElementById('miniTimer');

  const elLowOverlay = DOC.getElementById('lowTimeOverlay');
  const elLowNum = DOC.getElementById('gj-lowtime-num');

  const rng = makeRNG(seed);

  // Anti-overlap spawn separation
  const placed = []; // {x,y,ts}
  function tooClose(x,y,minD){
    for(let i=placed.length-1;i>=0;i--){
      const p=placed[i];
      const dx=x-p.x, dy=y-p.y;
      if(dx*dx+dy*dy < minD*minD) return true;
      if(nowMs()-p.ts>3500) break;
    }
    return false;
  }
  function remember(x,y){
    placed.push({x,y,ts:nowMs()});
    if(placed.length>20) placed.shift();
  }

  // Difficulty tuning (fair + less “แว้บ”)
  const ttlBase =
    (view==='cvr') ? 2400 :
    (view==='vr')  ? 2200 :
    (view==='mobile') ? 2100 :
    1900;

  const spawnEvery =
    (diff==='easy') ? 980 :
    (diff==='hard') ? 820 :
    900;

  const minDist =
    (view==='cvr') ? 92 :
    (view==='vr')  ? 86 :
    (view==='mobile') ? 78 :
    70;

  // Goals (5 stages, simple + readable)
  const goalList = (()=>{
    const base =
      (diff==='easy') ? [7, 8, 9, 10, 11] :
      (diff==='hard') ? [9, 11, 13, 15, 17] :
      [8, 10, 12, 14, 16];
    return base.map((n,i)=>({
      id: i+1,
      name: `GOAL ${i+1}: เก็บของดี ${n} ชิ้น`,
      desc: 'แตะ/ยิง “ของดี” ให้ครบ แล้วไป GOAL ถัดไป',
      target: n
    }));
  })();

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng,

    score:0,
    miss:0,
    hitGood:0,
    hitJunk:0,
    expireGood:0,
    combo:0,
    comboMax:0,

    shield:0,
    fever:18,

    // quests
    goalIdx: 0,
    goalCur: 0,
    goalsCleared: 0,
    miniCleared: 0,

    // timing
    lastTick:0,
    lastSpawn:0,
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
    // Keep your current rubric (simple + fair)
    if(S.score>=170 && S.miss<=3) return 'A';
    if(S.score>=110) return 'B';
    if(S.score>=65) return 'C';
    return 'D';
  }

  function updateGoalHud(){
    const g = goalList[Math.max(0, Math.min(goalList.length-1, S.goalIdx))];
    if(elGoal) elGoal.textContent = g ? g.name : '—';
    if(elGoalDesc) elGoalDesc.textContent = g ? g.desc : '—';
    if(elGoalCur) elGoalCur.textContent = String(S.goalCur);
    if(elGoalTar) elGoalTar.textContent = String(g ? g.target : 0);
  }

  function updateMiniHud(){
    const elapsed = (nowMs() - (GJ_META.windowStartAt || nowMs()))/1000;
    const left = Math.max(0, Math.ceil(GJ_META.windowSec - elapsed));
    const cur = GJ_META.windowGroups.size;
    const tar = 3;

    if(elMini) elMini.textContent = `ครบ ${tar} หมู่ใน ${GJ_META.windowSec} วิ`;
    if(elMiniTimer){
      elMiniTimer.textContent = GJ_META.miniDone ? 'ผ่านแล้ว ✅' : `${cur}/${tar} · เหลือ ${left}s`;
    }

    emit('quest:update',{
      goal:{
        name: goalList[S.goalIdx]?.name || '—',
        sub: goalList[S.goalIdx]?.desc || '—',
        cur: S.goalCur,
        target: goalList[S.goalIdx]?.target || 0
      },
      mini:{
        name:`ครบ 3 หมู่ใน ${GJ_META.windowSec} วิ`,
        sub:'โบนัส (SHIELD/STAR)',
        cur, target:tar,
        done:GJ_META.miniDone
      },
      allDone: (S.goalsCleared>=goalList.length)
    });
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);
    if(elGrade) elGrade.textContent = gradeNow();

    setShieldUI();
    updateGoalHud();
    updateMiniHud();

    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function miniOnHitGood(groupId){
    const now = nowMs();
    if(!GJ_META.windowStartAt) resetMiniWindow();

    // window rollover
    if(now - GJ_META.windowStartAt > GJ_META.windowSec*1000){
      resetMiniWindow();
    }

    GJ_META.windowGroups.add(Number(groupId)||1);

    if(!GJ_META.miniDone && GJ_META.windowGroups.size >= 3){
      GJ_META.miniDone = true;
      S.miniCleared++;

      // Reward: prefer Shield (cap 3), else reduce miss, else score
      if(S.shield < 3){
        S.shield++;
        emit('hha:judge', { type:'perfect', label:'BONUS 🛡️' });
      }else if(S.miss > 0){
        S.miss = Math.max(0, S.miss - 1);
        emit('hha:judge', { type:'perfect', label:'BONUS MISS-1' });
      }else{
        addScore(20);
        emit('hha:judge', { type:'perfect', label:'BONUS +20' });
      }

      emit('hha:coach', { msg:`สุดยอด! ครบ 3 หมู่ใน ${GJ_META.windowSec} วิ 🎁`, tag:'Coach' });
      // restart mini window so it can be achieved again later (optional)
      setTimeout(resetMiniWindow, 250);
    }
  }

  function advanceGoalIfNeeded(){
    const g = goalList[S.goalIdx];
    if(!g) return;

    if(S.goalCur >= g.target){
      S.goalsCleared++;
      S.goalIdx = Math.min(goalList.length-1, S.goalIdx + 1);
      S.goalCur = 0;

      emit('hha:coach', { msg:`เยี่ยม! ผ่าน ${g.name} ✅ ไป GOAL ถัดไป`, tag:'Coach' });
      emit('hha:judge', { type:'perfect', label:'GOAL CLEAR!' });

      // tiny reward
      addScore(12);
      setFever(Math.max(0, S.fever - 6));
    }
  }

  function onHit(kind, meta={}){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);

      // goal progress
      S.goalCur++;
      advanceGoalIfNeeded();

      // mini meta (group tracking)
      miniOnHitGood(meta.groupId || 1);

      emit('hha:judge', { type:'good', label:'GOOD' });
    }

    else if(kind==='junk'){
      if(S.shield>0){
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
      addScore(8);
      emit('hha:judge', { type:'perfect', label:'SHIELD!' });
    }

    setHUD();
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();
    let x=0,y=0;

    // try a few times to avoid clumping
    for(let tries=0; tries<10; tries++){
      x = safe.x + S.rng()*safe.w;
      y = safe.y + S.rng()*safe.h;
      if(!tooClose(x,y,minDist)) break;
    }
    remember(x,y);

    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
    t.dataset.kind = kind;

    const meta = { kind, rng:S.rng, groupId:1 };
    if(kind==='good') meta.groupId = chooseGroupId(S.rng);

    // decorate (FOOD5 / junk emojis)
    decorateTarget(t, meta);

    // sizes
    const size =
      (kind==='good') ? 56 :
      (kind==='junk') ? 58 :
      52;

    t.style.left = `${x}px`;
    t.style.top  = `${y}px`;
    t.style.fontSize = `${size}px`;

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

    // TTL (กัน “แว้บ”): ยาวขึ้นตาม view
    const ttl =
      (kind==='star' || kind==='shield')
        ? Math.max(1900, ttlBase + 200)
        : ttlBase;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();

      // expire good => MISS (part of “MISS = good expired + junk hit”)
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

  // ✅ Crosshair shoot support
  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    const groupId = Number(picked.dataset.group)||1;

    try{ picked.remove(); }catch(_){}
    onHit(kind, { groupId });
  }

  function pushHistory(summary){
    try{
      const raw = localStorage.getItem(LS_HIST);
      const arr = raw ? (JSON.parse(raw)||[]) : [];
      arr.unshift(summary);
      while(arr.length>40) arr.pop();
      localStorage.setItem(LS_HIST, JSON.stringify(arr));
    }catch(_){}
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = gradeNow();
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
      feverEnd:S.fever,

      goalsCleared:S.goalsCleared,
      goalsTotal:goalList.length,
      miniCleared:S.miniCleared,

      grade,
      reason
    };

    try{ localStorage.setItem(LS_LAST, JSON.stringify(summary)); }catch(_){}
    pushHistory(summary);

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

    // low time overlay (last 5 sec)
    try{
      const leftInt = Math.ceil(S.timeLeft);
      if(elLowOverlay && elLowNum){
        if(leftInt <= 5 && leftInt >= 1){
          elLowOverlay.setAttribute('aria-hidden','false');
          elLowNum.textContent = String(leftInt);
        }else{
          elLowOverlay.setAttribute('aria-hidden','true');
        }
      }
    }catch(_){}

    // spawn
    if(ts - S.lastSpawn >= spawnEvery){
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
  resetMiniWindow();

  setFever(S.fever);
  setShieldUI();
  setHUD();

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}