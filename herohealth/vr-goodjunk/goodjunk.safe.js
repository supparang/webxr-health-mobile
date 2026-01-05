// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE Engine — PRODUCTION (HUD-safe spawn + cVR/VR shoot + storm/boss/rage)
// ✅ HUD-safe spawn uses CSS vars: --gj-top-safe / --gj-bottom-safe (set by run html measure)
// ✅ Supports view: pc/mobile/vr/cvr
// ✅ hha:shoot event (from vr-ui.js or btnShoot) -> aim-assist lock
// ✅ Storm when timeLeft <= 30s
// ✅ Boss when misses >= 4, Rage when misses >= 5
// ✅ Miss definition respected: miss = good expired + junk hit; (junk hit blocked by Shield NOT miss)
// ✅ Emits: hha:score, hha:time, hha:judge, hha:coach, quest:update, hha:end, hha:flush
// ✅ Deterministic research: seeded RNG (when run=research and seed provided)

'use strict';

const WIN = window;
const DOC = document;

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function qsa(sel, root=DOC){ try{ return Array.from(root.querySelectorAll(sel)); } catch { return []; } }
function byId(id){ return DOC.getElementById(id); }

function parseSeedToInt(seed){
  if(seed == null) return null;
  const s = String(seed).trim();
  if(!s) return null;
  // hash string -> uint32
  let h = 2166136261 >>> 0;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function makeRng(seedInt){
  // mulberry32
  let a = (seedInt >>> 0) || 0x12345678;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readCssPxVar(name, fallbackPx){
  try{
    const v = getComputedStyle(DOC.documentElement).getPropertyValue(name).trim();
    if(!v) return fallbackPx;
    // handles "123px" or calc already resolved by computed style -> usually px
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallbackPx;
  }catch(_){ return fallbackPx; }
}

function getSafeInsets(){
  // spawn safe rect is inside viewport minus HUD safe top/bottom and safe-area left/right
  const vw = Math.max(1, WIN.innerWidth || DOC.documentElement.clientWidth || 1);
  const vh = Math.max(1, WIN.innerHeight || DOC.documentElement.clientHeight || 1);

  const topSafe = readCssPxVar('--gj-top-safe', 140);
  const botSafe = readCssPxVar('--gj-bottom-safe', 120);

  const sal = readCssPxVar('--sal', 0);
  const sar = readCssPxVar('--sar', 0);

  // add tiny margins so targets don't hug the edge
  const margin = 10;

  const left = Math.max(0, sal + margin);
  const right = Math.max(0, vw - (sar + margin));
  const top = Math.max(0, topSafe + margin);
  const bottom = Math.max(0, vh - (botSafe + margin));

  // if HUD is huge (small screens), relax a bit but keep safe
  const minH = 180;
  if(bottom - top < minH){
    const mid = vh * 0.5;
    return {
      vw, vh,
      left,
      right,
      top: Math.max(0, mid - minH/2),
      bottom: Math.min(vh, mid + minH/2)
    };
  }

  return { vw, vh, left, right, top, bottom };
}

function pickLayer(view){
  const L = byId('gj-layer');
  const R = byId('gj-layer-r');
  if(view === 'cvr'){
    // spawn can go to both layers (we randomize eye)
    return { L, R };
  }
  return { L, R:null };
}

function setBodyFlags(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.add('gj');
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  try{ DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  try{ DOC.body && DOC.body.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function setHudText(id, txt){
  const el = byId(id);
  if(el) el.textContent = String(txt);
}

function gradeFromScore(score, misses){
  const s = Number(score)||0;
  const m = Number(misses)||0;
  // simple, stable grade
  if(m <= 0 && s >= 400) return 'S';
  if(m <= 1 && s >= 320) return 'A';
  if(m <= 2 && s >= 240) return 'B';
  if(m <= 3 && s >= 180) return 'C';
  if(s >= 120) return 'D';
  return 'E';
}

function saveLastSummary(obj){
  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(obj));
  }catch(_){}
}

/* ------------------- QUEST (simple but robust) ------------------- */
function makeQuest(){
  // goal: rotate through 3 patterns; mini: 10s tasks
  const goals = [
    { key:'collect', title:'เก็บของดี', desc:'ยิง “ของดี” ให้ครบ', target:10 },
    { key:'avoid',   title:'หลบขยะ',  desc:'หลบ “ขยะ” ให้รอด', target:1 }, // driven externally by survive
    { key:'combo',   title:'ทำคอมโบ', desc:'ยิงดีติดกันให้ได้', target:6 },
  ];
  const minis = [
    { key:'fast', title:'ยิงให้ไว', desc:'ยิงของดีให้ไว (0/4)', target:4, windowMs:8000 },
    { key:'clean', title:'ห้ามโดนขยะ', desc:'10 วิ ห้ามโดนขยะ', target:1, windowMs:10000, forbidJunk:true },
    { key:'streak', title:'ติดกัน', desc:'ยิงดีติดกัน (0/5)', target:5, windowMs:9000 },
  ];

  const Q = {
    goalIndex:0,
    miniIndex:0,
    goalCur:0,
    goalTarget:goals[0].target,
    miniCur:0,
    miniTarget:minis[0].target,
    miniEndsAt:0,
    goalsCleared:0,
    minisCleared:0,
    allDone:false,
    lastMiniOk:false,
    lastMiniReason:null,
  };

  function curGoal(){ return goals[Q.goalIndex % goals.length]; }
  function curMini(){ return minis[Q.miniIndex % minis.length]; }

  function startMini(tMs){
    const m = curMini();
    Q.miniCur = 0;
    Q.miniTarget = m.target;
    Q.miniEndsAt = tMs + (m.windowMs || 9000);
    Q.lastMiniOk = false;
    Q.lastMiniReason = null;
  }

  function nextGoal(){
    Q.goalIndex++;
    const g = curGoal();
    Q.goalCur = 0;
    Q.goalTarget = g.target;
  }
  function nextMini(tMs){
    Q.miniIndex++;
    startMini(tMs);
  }

  function pushUpdate(){
    const g = curGoal();
    const m = curMini();
    emit('quest:update', {
      goalKey:g.key,
      goalTitle:g.title,
      goalDesc:g.desc,
      goalCur:Q.goalCur,
      goalTarget:Q.goalTarget,
      miniKey:m.key,
      miniDesc:m.desc,
      miniCur:Q.miniCur,
      miniTarget:Q.miniTarget,
      miniEndsAt:Q.miniEndsAt
    });
  }

  function onGoodHit(tMs, combo){
    const g = curGoal();
    if(g.key === 'collect'){
      Q.goalCur = clamp(Q.goalCur + 1, 0, Q.goalTarget);
      if(Q.goalCur >= Q.goalTarget){
        Q.goalsCleared++;
        nextGoal();
      }
    }else if(g.key === 'combo'){
      Q.goalCur = clamp(combo, 0, Q.goalTarget);
      if(Q.goalCur >= Q.goalTarget){
        Q.goalsCleared++;
        nextGoal();
      }
    }else if(g.key === 'avoid'){
      // driven externally by survive time; do nothing here
    }

    const m = curMini();
    if(m.key === 'fast'){
      Q.miniCur = clamp(Q.miniCur + 1, 0, Q.miniTarget);
    }else if(m.key === 'streak'){
      Q.miniCur = clamp(combo, 0, Q.miniTarget);
    }

    if(Q.miniCur >= Q.miniTarget){
      Q.minisCleared++;
      Q.lastMiniOk = true;
      emit('hha:judge', { kind:'mini', ok:true, reason:'mini-clear' });
      emit('hha:coach', { kind:'tip', msg:'เก่งมาก! ผ่าน MINI แล้ว' });
      nextMini(tMs);
    }

    pushUpdate();
  }

  function onJunkHit(tMs){
    const m = curMini();
    if(m.forbidJunk){
      // fail mini immediately
      Q.lastMiniOk = false;
      Q.lastMiniReason = 'hit-junk';
      emit('hha:judge', { kind:'mini', ok:false, reason:'hit-junk' });
      emit('hha:coach', { kind:'warn', msg:'โดนขยะ! MINI นี้ไม่ผ่าน ลองใหม่!' });
      nextMini(tMs);
      pushUpdate();
    }
  }

  function tick(tMs){
    if(!Q.miniEndsAt) startMini(tMs);
    if(tMs >= Q.miniEndsAt){
      // time up mini: if not cleared -> rotate
      if(Q.miniCur < Q.miniTarget){
        Q.lastMiniOk = false;
        Q.lastMiniReason = 'timeout';
        emit('hha:judge', { kind:'mini', ok:false, reason:'timeout' });
      }
      nextMini(tMs);
      pushUpdate();
    }
  }

  // allow engine to set "avoid" goal progress (survive)
  function setGoalExternal(cur, target, done=false){
    const g = curGoal();
    if(g.key !== 'avoid') return;
    Q.goalTarget = Math.max(1, Number(target)||1);
    Q.goalCur = clamp(Number(cur)||0, 0, Q.goalTarget);
    if(done){
      Q.goalsCleared++;
      nextGoal();
      emit('hha:judge', { kind:'goal', ok:true, reason:'goal-clear' });
    }
    pushUpdate();
  }

  // initial
  pushUpdate();

  return { Q, curGoal, curMini, tick, onGoodHit, onJunkHit, setGoalExternal, pushUpdate };
}

/* ------------------- TARGET SPAWN / HIT ------------------- */
function makeTargetEl(kind, emoji, sizePx){
  const el = DOC.createElement('div');
  el.className = 'gj-target spawn';
  el.setAttribute('data-kind', kind);
  el.textContent = emoji;
  el.style.fontSize = Math.max(28, Math.round(sizePx)) + 'px';
  return el;
}

function dist2(ax,ay,bx,by){
  const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy;
}

function engineFactory(opts){
  const view = opts.view || 'mobile';
  const run = String(opts.run || 'play');
  const diff = String(opts.diff || 'normal');
  const hub = opts.hub || null;

  const seedInt = (run === 'research') ? parseSeedToInt(opts.seed) : null;
  const rng = seedInt != null ? makeRng(seedInt) : Math.random;

  const layers = pickLayer(view);
  const layerL = layers.L;
  const layerR = layers.R;

  const STATE = {
    view, run, diff, hub,
    startedAtMs: 0,
    lastTickMs: 0,
    timePlannedSec: clamp(Number(opts.time || 80), 20, 300),
    timeLeftSec: 0,
    ended:false,
    reason:null,

    score:0,
    misses:0,
    combo:0,
    comboMax:0,

    fever:0,          // 0..100
    feverDecayPerSec: 4.2,
    feverGainGood:    6.0,
    feverGainJunk:    10.0,

    shield:0,         // integer pills
    shieldMax:3,

    // spawn pacing
    spawnEveryMs: 640,       // base
    lastSpawnMs: 0,

    // active targets
    targets: new Set(),

    // counters for logging
    nGoodSpawn:0,
    nJunkSpawn:0,
    nHitGood:0,
    nHitJunk:0,
    nHitJunkGuard:0,
    nExpireGood:0,

    storm:false,
    boss:false,
    rage:false,

    // aim assist
    lockPx: 84,   // center lock radius
  };

  // difficulty tuning
  (function tune(){
    if(diff === 'easy'){
      STATE.spawnEveryMs = 720;
      STATE.lockPx = 96;
      STATE.feverDecayPerSec = 4.6;
    } else if(diff === 'hard'){
      STATE.spawnEveryMs = 560;
      STATE.lockPx = 74;
      STATE.feverDecayPerSec = 3.8;
    }
  })();

  const QUEST = makeQuest();

  function uiSync(){
    setHudText('hud-score', STATE.score);
    setHudText('hud-time', Math.max(0, Math.ceil(STATE.timeLeftSec)));
    setHudText('hud-miss', STATE.misses);
    const g = gradeFromScore(STATE.score, STATE.misses);
    setHudText('hud-grade', g);

    // quest -> HUD elements
    const q = QUEST.Q;
    const gObj = QUEST.curGoal();
    setHudText('hud-goal', gObj.title);
    setHudText('goalDesc', gObj.desc);
    setHudText('hud-goal-cur', q.goalCur);
    setHudText('hud-goal-target', q.goalTarget);

    const mObj = QUEST.curMini();
    setHudText('hud-mini', mObj.desc.replace('(0/4)', `(${q.miniCur}/${q.miniTarget})`).replace('(0/5)', `(${q.miniCur}/${q.miniTarget})`));
    const remain = Math.max(0, Math.ceil((q.miniEndsAt - now())/1000));
    setHudText('miniTimer', (isFinite(remain) ? `${remain}s` : '—'));

    // fever
    const f = clamp(STATE.fever, 0, 100);
    const ff = byId('feverFill');
    if(ff) ff.style.width = `${f}%`;
    setHudText('feverText', `${Math.round(f)}%`);

    // shield pills
    const sp = byId('shieldPills');
    if(sp){
      sp.textContent = STATE.shield > 0 ? '🛡️'.repeat(Math.min(STATE.shield, 6)) : '—';
    }

    emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
    emit('hha:time',  { timeLeftSec: STATE.timeLeftSec, timePlannedSec: STATE.timePlannedSec });
  }

  function setStormBossRage(){
    const tl = STATE.timeLeftSec;
    const m = STATE.misses;

    const stormOn = (tl <= 30);
    if(stormOn && !STATE.storm){
      STATE.storm = true;
      DOC.body.classList.add('gj-lowtime');
      emit('hha:coach', { kind:'warn', msg:'พายุมาแล้ว! ช่วงท้ายจะเร็วขึ้น!' });
    }

    const bossOn = (m >= 4);
    if(bossOn && !STATE.boss){
      STATE.boss = true;
      DOC.body.classList.add('gj-boss');
      emit('hha:coach', { kind:'warn', msg:'บอสโผล่! ระวัง MISS!' });
    }

    const rageOn = (m >= 5);
    if(rageOn && !STATE.rage){
      STATE.rage = true;
      DOC.body.classList.add('gj-rage');
      emit('hha:coach', { kind:'warn', msg:'RAGE! เกมโหดขึ้นอีกระดับ!' });
    }
  }

  function stageForSpawn(){
    // in cVR spawn on L or R randomly
    if(view === 'cvr' && layerR){
      return (rng() < 0.5) ? layerL : layerR;
    }
    return layerL;
  }

  function spawnOne(){
    const stage = stageForSpawn();
    if(!stage) return;

    const safe = getSafeInsets();
    const vw = safe.vw, vh = safe.vh;

    // choose kind
    let kind = 'good';
    // increase junk pressure in storm/boss/rage
    const baseJunk = 0.28;
    const add = (STATE.storm?0.10:0) + (STATE.boss?0.08:0) + (STATE.rage?0.10:0);
    const pJunk = clamp(baseJunk + add, 0.18, 0.55);

    // sometimes spawn shield/star
    const pShield = (STATE.shield < STATE.shieldMax) ? (STATE.storm?0.05:0.07) : 0.0;
    const pStar   = (STATE.combo >= 5) ? 0.06 : 0.03;

    const r = rng();
    if(r < pShield){
      kind = 'shield';
    } else if(r < pShield + pStar){
      kind = 'star';
    } else {
      kind = (rng() < pJunk) ? 'junk' : 'good';
    }

    // size
    let size = 64;
    if(kind === 'good') size = (diff==='easy'?72:(diff==='hard'?58:64));
    if(kind === 'junk') size = (diff==='easy'?68:(diff==='hard'?56:62));
    if(kind === 'star') size = 62;
    if(kind === 'shield') size = 62;

    // emojis
    const EMO = {
      good:['🍎','🥦','🥕','🍇','🍉','🍍','🥬','🍅'],
      junk:['🍩','🍟','🍔','🍭','🧁','🥤'],
      star:['⭐','✨'],
      shield:['🛡️']
    };
    const arr = EMO[kind] || ['🎯'];
    const emoji = arr[Math.floor(rng()*arr.length)] || '🎯';

    const el = makeTargetEl(kind, emoji, size);

    // pick position inside safe rect
    const minX = safe.left + size*0.55;
    const maxX = safe.right - size*0.55;
    const minY = safe.top + size*0.55;
    const maxY = safe.bottom - size*0.55;

    const x = clamp(minX + rng()*(maxX-minX), 0, vw);
    const y = clamp(minY + rng()*(maxY-minY), 0, vh);

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    // ttl
    let ttl = 1850;
    if(kind === 'good') ttl = (diff==='easy'?2100:(diff==='hard'?1650:1900));
    if(kind === 'junk') ttl = (diff==='easy'?2200:(diff==='hard'?1750:2000));
    if(kind === 'star') ttl = 2100;
    if(kind === 'shield') ttl = 2300;

    if(STATE.storm) ttl *= 0.86;
    if(STATE.rage)  ttl *= 0.82;

    const born = now();
    const meta = { el, kind, stage, born, ttl, x, y, alive:true };
    el.__gj = meta;

    // counters
    if(kind === 'good') STATE.nGoodSpawn++;
    if(kind === 'junk') STATE.nJunkSpawn++;

    // click/tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      tryHit(meta, { source:'tap' });
    }, { passive:false });

    // attach & track
    stage.appendChild(el);
    STATE.targets.add(meta);

    // expire timer
    meta.expireTimer = setTimeout(()=>expire(meta), ttl);

    // remove spawn class after a tick
    setTimeout(()=>{ try{ el.classList.remove('spawn'); }catch(_){ } }, 160);
  }

  function removeTarget(meta){
    if(!meta || !meta.el || !meta.alive) return;
    meta.alive = false;
    try{ clearTimeout(meta.expireTimer); }catch(_){}
    try{
      meta.el.classList.add('gone');
      setTimeout(()=>{
        try{ meta.el.remove(); }catch(_){}
      }, 170);
    }catch(_){
      try{ meta.el.remove(); }catch(__){}
    }
    STATE.targets.delete(meta);
  }

  function expire(meta){
    if(!meta || !meta.alive) return;
    if(meta.kind === 'good'){
      // good expired = MISS
      STATE.misses++;
      STATE.nExpireGood++;
      STATE.combo = 0;
      DOC.body.classList.add('gj-good-expire');
      setTimeout(()=>DOC.body.classList.remove('gj-good-expire'), 160);
      emit('hha:judge', { kind:'miss', reason:'good-expire', misses:STATE.misses });
    }
    removeTarget(meta);
  }

  function addScore(delta){
    STATE.score = Math.max(0, (STATE.score + (Number(delta)||0))|0);
  }

  function addFever(delta){
    STATE.fever = clamp(STATE.fever + (Number(delta)||0), 0, 100);
  }

  function tryHit(meta, ctx){
    if(!meta || !meta.alive) return false;

    const kind = meta.kind;
    removeTarget(meta);

    if(kind === 'good'){
      STATE.nHitGood++;
      STATE.combo++;
      STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
      addScore(20 + Math.min(40, STATE.combo*2));
      addFever(STATE.feverGainGood);

      // fx class
      DOC.body.classList.add('gj-mini-clear');
      setTimeout(()=>DOC.body.classList.remove('gj-mini-clear'), 160);

      QUEST.onGoodHit(now(), STATE.combo);

      emit('hha:judge', { kind:'hit', what:'good', combo:STATE.combo });

      return true;
    }

    if(kind === 'junk'){
      // if shield active => block, no MISS
      if(STATE.shield > 0){
        STATE.shield--;
        STATE.nHitJunkGuard++;
        STATE.combo = 0;

        emit('hha:judge', { kind:'block', what:'junk', shieldLeft:STATE.shield });
        emit('hha:coach', { kind:'tip', msg:'โล่บล็อกขยะ! ไม่เป็น MISS' });
        return true;
      }

      // junk hit = MISS
      STATE.nHitJunk++;
      STATE.misses++;
      STATE.combo = 0;

      addScore(-10);
      addFever(STATE.feverGainJunk);

      DOC.body.classList.add('gj-junk-hit');
      setTimeout(()=>DOC.body.classList.remove('gj-junk-hit'), 200);

      QUEST.onJunkHit(now());

      emit('hha:judge', { kind:'miss', reason:'junk-hit', misses:STATE.misses });
      return true;
    }

    if(kind === 'star'){
      // reward
      STATE.combo++;
      addScore(60);
      addFever(14);
      emit('hha:judge', { kind:'hit', what:'star', combo:STATE.combo });
      emit('hha:coach', { kind:'tip', msg:'⭐ โบนัส! คะแนนพุ่ง!' });
      QUEST.onGoodHit(now(), STATE.combo);
      return true;
    }

    if(kind === 'shield'){
      STATE.shield = clamp(STATE.shield + 1, 0, STATE.shieldMax);
      addScore(10);
      emit('hha:judge', { kind:'hit', what:'shield', shield:STATE.shield });
      emit('hha:coach', { kind:'tip', msg:'🛡️ ได้โล่! โดนขยะครั้งต่อไปจะไม่เป็น MISS' });
      return true;
    }

    return false;
  }

  function aimAssistShoot(detail){
    // choose closest target to center (per eye)
    const safe = getSafeInsets();
    const cx = safe.vw * 0.5;
    const cy = safe.vh * 0.5;

    const lock = (detail && Number(detail.lockPx)) || STATE.lockPx;
    const r2 = lock * lock;

    let best = null;
    let bestD = Infinity;

    STATE.targets.forEach(meta=>{
      if(!meta.alive) return;
      const x = meta.x;
      const y = meta.y;
      const d = dist2(cx, cy, x, y);
      if(d <= r2 && d < bestD){
        bestD = d;
        best = meta;
      }
    });

    if(best){
      return tryHit(best, { source:'shoot', detail });
    }

    // miss-shot (no target locked) -> light feedback only (NOT miss counter)
    DOC.body.classList.add('gj-miss-shot');
    setTimeout(()=>DOC.body.classList.remove('gj-miss-shot'), 120);
    emit('hha:judge', { kind:'shot', ok:false });
    return false;
  }

  function endGame(reason){
    if(STATE.ended) return;
    STATE.ended = true;
    STATE.reason = reason || 'time';
    // clear targets
    STATE.targets.forEach(m=>{ try{ removeTarget(m); }catch(_){ } });

    const played = clamp(STATE.timePlannedSec - STATE.timeLeftSec, 0, STATE.timePlannedSec);
    const grade = gradeFromScore(STATE.score, STATE.misses);

    const payload = {
      projectTag: 'GoodJunkVR',
      runMode: STATE.run,
      device: STATE.view,
      diff: STATE.diff,
      durationPlannedSec: STATE.timePlannedSec,
      durationPlayedSec: played,
      scoreFinal: STATE.score,
      comboMax: STATE.comboMax,
      misses: STATE.misses,
      goalsCleared: QUEST.Q.goalsCleared,
      goalsTotal: 999, // open-ended rotation
      miniCleared: QUEST.Q.minisCleared,
      miniTotal: 999,
      nTargetGoodSpawned: STATE.nGoodSpawn,
      nTargetJunkSpawned: STATE.nJunkSpawn,
      nHitGood: STATE.nHitGood,
      nHitJunk: STATE.nHitJunk,
      nHitJunkGuard: STATE.nHitJunkGuard,
      nExpireGood: STATE.nExpireGood,
      grade,
      reason: STATE.reason,
      seed: seedInt,
      hub: STATE.hub || null,
      ts: Date.now()
    };

    saveLastSummary(payload);
    emit('hha:end', payload);
    emit('hha:flush', { reason:'end' });
  }

  function tickLoop(tMs){
    if(STATE.ended) return;

    if(!STATE.startedAtMs){
      STATE.startedAtMs = tMs;
      STATE.lastTickMs = tMs;
      STATE.timeLeftSec = STATE.timePlannedSec;

      // initial quest push
      QUEST.pushUpdate();
      uiSync();

      emit('hha:coach', { kind:'tip', msg:'เริ่มเลย! ยิง “ของดี” และหลบ “ขยะ”' });
    }

    const dt = Math.max(0, (tMs - STATE.lastTickMs) / 1000);
    STATE.lastTickMs = tMs;

    // time
    STATE.timeLeftSec = Math.max(0, STATE.timeLeftSec - dt);

    // fever decay
    if(STATE.fever > 0){
      const mult = (STATE.rage ? 0.75 : 1.0); // rage = fever drop slower -> pressure
      STATE.fever = clamp(STATE.fever - (STATE.feverDecayPerSec * dt * mult), 0, 100);
    }

    // quest tick
    QUEST.tick(tMs);

    // survive goal external (for "avoid")
    const surviveTarget = 30; // survive 30 seconds segments
    const survived = Math.floor((STATE.timePlannedSec - STATE.timeLeftSec) / surviveTarget);
    // mark progress inside current segment
    const curInSeg = Math.floor((STATE.timePlannedSec - STATE.timeLeftSec) % surviveTarget);
    QUEST.setGoalExternal(curInSeg, surviveTarget, false);

    // lowtime effects
    setStormBossRage();

    // spawn pacing
    let pace = STATE.spawnEveryMs;
    if(STATE.storm) pace *= 0.82;
    if(STATE.boss)  pace *= 0.90;
    if(STATE.rage)  pace *= 0.84;

    if(tMs - STATE.lastSpawnMs >= pace){
      STATE.lastSpawnMs = tMs;

      // spawn burst in rage/boss
      spawnOne();
      if(STATE.rage && rng() < 0.55) spawnOne();
      else if(STATE.boss && rng() < 0.30) spawnOne();
    }

    // end conditions
    if(STATE.misses >= 6){
      endGame('missLimit');
      uiSync();
      return;
    }
    if(STATE.timeLeftSec <= 0){
      endGame('time');
      uiSync();
      return;
    }

    // UI
    uiSync();

    // lowtime ring pulse + countdown 5s
    if(STATE.timeLeftSec <= 5){
      DOC.body.classList.add('gj-lowtime5');
      DOC.body.classList.add('gj-tick');
      setTimeout(()=>DOC.body.classList.remove('gj-tick'), 120);
      const n = Math.ceil(STATE.timeLeftSec);
      setHudText('gj-lowtime-num', n);
    } else {
      DOC.body.classList.remove('gj-lowtime5');
    }

    requestAnimationFrame(tickLoop);
  }

  function bindInputs(){
    // Shoot event (VR UI crosshair)
    WIN.addEventListener('hha:shoot', (ev)=>{
      if(STATE.ended) return;
      aimAssistShoot(ev && ev.detail ? ev.detail : null);
    });

    // flush request
    WIN.addEventListener('hha:flush', ()=>{
      // for logger modules, they may listen this; we keep it simple
    });

    // quick: click on peek overlay closes handled in html already
  }

  function start(){
    setBodyFlags(view);
    bindInputs();
    requestAnimationFrame(tickLoop);
  }

  return { start, endGame, STATE, QUEST };
}

/* ------------------- PUBLIC BOOT ------------------- */
export function boot(opts={}){
  const view = (opts.view || 'mobile').toLowerCase();
  // IMPORTANT: run html already sets body view class, but we also ensure here
  setBodyFlags(view);

  // small delay: wait CSS vars measured
  setTimeout(()=>{ /* ensure safe vars exist before spawns */ }, 0);

  const engine = engineFactory(opts);

  // tell UI initial meta
  try{
    emit('hha:coach', { kind:'tip', msg:`พร้อมแล้ว: view=${engine.STATE.view} run=${engine.STATE.run} diff=${engine.STATE.diff}` });
  }catch(_){}

  engine.start();
  return engine;
}
