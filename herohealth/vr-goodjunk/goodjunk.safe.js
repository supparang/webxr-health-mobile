// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — DOM Engine (PRODUCTION / HHA Standard)
// ✅ HUD-safe spawn using CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ Miss definition: miss = goodExpired + junkHit (shield block does NOT count miss)
// ✅ 30s left => STORM, miss>=4 => BOSS, miss>=5 => RAGE
// ✅ Supports: tap/click target + hha:shoot (crosshair center hit test)
// ✅ Emits: hha:score, hha:time, hha:judge, hha:coach, quest:update, hha:end, hha:flush
// ✅ Research: deterministic seed + adaptive OFF
// ✅ Play: adaptive-lite ON (spawn pacing reacts to accuracy/fever)

'use strict';

const DOC = document;
const WIN = window;

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return performance.now(); }

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function hashSeed(str){
  const s = String(str ?? '');
  let h = 2166136261 >>> 0;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a){
  let t = a >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  try{ DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  try{ DOC.body?.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function addBodyFlash(cls, ms=180){
  try{
    DOC.body.classList.add(cls);
    setTimeout(()=>DOC.body.classList.remove(cls), ms);
  }catch(_){}
}

function parsePxVar(varName, fallback){
  try{
    const v = getComputedStyle(DOC.documentElement).getPropertyValue(varName).trim();
    if(!v) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }catch(_){
    return fallback;
  }
}

function gradeFrom(acc){
  // โทนเด็ก ป.5: A/B/C/D (เข้าใจง่าย)
  if(acc >= 92) return 'A';
  if(acc >= 82) return 'B';
  if(acc >= 70) return 'C';
  return 'D';
}

function ensureEl(id){
  return DOC.getElementById(id);
}

function setText(id, txt){
  const el = ensureEl(id);
  if(el) el.textContent = String(txt ?? '—');
}

function setPctBar(id, pct){
  const el = ensureEl(id);
  if(el) el.style.width = clamp(pct,0,100).toFixed(0) + '%';
}

// -------------------- Quest Director (Goal + Mini) --------------------
function makeQuestDirector(cfg){
  const Q = {
    goals: [],
    minis: [],
    gIndex: 0,
    activeMini: null,
    miniEndAt: 0,
    miniCleared: 0,
    miniTotal: 0,
    goalsCleared: 0,
    goalsTotal: 0,
    allDone: false,
  };

  function pushUpdate(extra={}){
    const g = Q.goals[Q.gIndex] || null;
    const m = Q.activeMini || null;
    emit('quest:update', {
      goal: g ? { id:g.id, title:g.title, cur:g.cur, target:g.target, desc: g.desc() , done:g.done } : null,
      mini: m ? { id:m.id, title:m.title, desc:m.desc(), leftSec: Math.max(0, Math.ceil((Q.miniEndAt - now())/1000)), done:m.done } : null,
      goalsCleared: Q.goalsCleared,
      goalsTotal: Q.goalsTotal,
      miniCleared: Q.miniCleared,
      miniTotal: Q.miniTotal,
      ...extra
    });
  }

  function setGoalUI(g){
    setText('hud-goal', g?.title || '—');
    setText('goalDesc', g?.desc() || '—');
    setText('hud-goal-cur', g?.cur ?? 0);
    setText('hud-goal-target', g?.target ?? 0);
  }
  function setMiniUI(m){
    setText('hud-mini', m?.desc() || '—');
  }

  function tickMini(){
    const el = ensureEl('miniTimer');
    if(!el) return;
    if(!Q.activeMini){
      el.textContent = '—';
      return;
    }
    const left = Math.max(0, Math.ceil((Q.miniEndAt - now())/1000));
    el.textContent = left + 's';
  }

  function nextGoal(){
    Q.gIndex = clamp(Q.gIndex+1, 0, Q.goals.length-1);
    const g = Q.goals[Q.gIndex];
    if(g){
      setGoalUI(g);
      pushUpdate({ reason:'goal-next' });
    }
  }

  function markGoalDone(){
    const g = Q.goals[Q.gIndex];
    if(!g || g.done) return;
    g.done = true;
    Q.goalsCleared++;
    emit('hha:judge', { kind:'goal', msg:'GOAL สำเร็จ!' });
    addBodyFlash('gj-great', 180);
    if(Q.gIndex < Q.goals.length-1) nextGoal();
    else {
      Q.allDone = true;
      pushUpdate({ reason:'all-goals-done' });
    }
  }

  function checkGoal(){
    const g = Q.goals[Q.gIndex];
    if(!g || g.done) return;
    g.cur = clamp(g.cur, 0, g.target);
    setGoalUI(g);
    if(g.cur >= g.target) markGoalDone();
  }

  function rotateMini(force=false){
    if(!Q.minis.length) return;
    let idx = Q.activeMini ? Q.minis.findIndex(x=>x.id===Q.activeMini.id) : -1;
    idx = (idx+1) % Q.minis.length;
    const m = Q.minis[idx];
    Q.activeMini = {
      ...m,
      done:false,
      _state:{},
    };
    Q.miniEndAt = now() + (m.durSec*1000);
    setMiniUI(Q.activeMini);
    pushUpdate({ reason: force?'mini-force':'mini-rotate' });
  }

  function miniSuccess(){
    const m = Q.activeMini;
    if(!m || m.done) return;
    m.done = true;
    Q.miniCleared++;
    emit('hha:judge', { kind:'mini', msg:'MINI ผ่าน!' });
    addBodyFlash('gj-mini-clear', 220);
    rotateMini(true);
  }

  function miniFail(why){
    const m = Q.activeMini;
    if(!m || m.done) return;
    m.done = true;
    emit('hha:judge', { kind:'mini-fail', msg:`MINI พลาด (${why||'fail'})` });
    rotateMini(true);
  }

  function updateGoalCur(delta){
    const g = Q.goals[Q.gIndex];
    if(!g || g.done) return;
    g.cur = clamp((g.cur||0) + (delta||0), 0, g.target);
    checkGoal();
  }

  function setGoalExternal(cur, target, done=false){
    const g = Q.goals[Q.gIndex];
    if(!g || Q.allDone) return;
    g.target = Math.max(1, Number(target)||1);
    g.cur = clamp(Number(cur)||0, 0, g.target);
    setGoalUI(g);
    if(done && !g.done) markGoalDone();
    else pushUpdate({ reason:'goal-external' });
  }

  function miniOnGoodHit(meta){
    const m = Q.activeMini;
    if(!m || m.done) return;
    if(m.id === 'fast3'){
      const ok = !!meta?.fast;
      if(ok){
        m._state.n = (m._state.n||0) + 1;
        if(m._state.n >= 3) miniSuccess();
      }
    } else if(m.id === 'combo5'){
      m._state.n = (m._state.n||0) + 1;
      if(m._state.n >= 5) miniSuccess();
    }
  }
  function miniOnStarHit(){
    const m = Q.activeMini;
    if(!m || m.done) return;
    if(m.id === 'star2'){
      m._state.n = (m._state.n||0) + 1;
      if(m._state.n >= 2) miniSuccess();
    }
  }
  function miniOnJunkHit(){
    const m = Q.activeMini;
    if(!m || m.done) return;
    if(m.id === 'nojunk10'){
      miniFail('โดนขยะ');
    } else if(m.id === 'combo5'){
      m._state.n = 0;
    }
  }
  function miniTick(){
    const m = Q.activeMini;
    if(!m || m.done) return;
    if(now() >= Q.miniEndAt){
      if(m.id === 'nojunk10'){
        // ถ้าอยู่รอดครบเวลา = ผ่าน
        miniSuccess();
      }else{
        miniFail('หมดเวลา');
      }
    }
    tickMini();
  }

  function init(goals, minis){
    Q.goals = goals.map(g=>({ ...g, cur:0, done:false }));
    Q.minis = minis.slice();
    Q.gIndex = 0;
    Q.goalsTotal = Q.goals.length;
    Q.miniTotal = Math.max(1, Q.minis.length);
    setGoalUI(Q.goals[0] || null);
    rotateMini(true);
    setInterval(miniTick, 180);
  }

  return {
    Q,
    init,
    updateGoalCur,
    setGoalExternal,
    checkGoal,
    pushUpdate,
    rotateMini,
    miniOnGoodHit,
    miniOnStarHit,
    miniOnJunkHit,
    miniFail,
  };
}

// -------------------- Engine --------------------
export function boot(opts={}){
  const view = String(opts.view ?? qs('view','mobile') ?? 'mobile').toLowerCase();
  const diff = String(opts.diff ?? qs('diff','normal') ?? 'normal').toLowerCase();
  const run  = String(opts.run  ?? qs('run','play') ?? 'play').toLowerCase();
  const timePlanned = clamp(Number(opts.time ?? qs('time','80') ?? 80), 20, 300);
  const hub = String(opts.hub ?? qs('hub', '') ?? '').trim() || null;

  // deterministic seed for research
  const seedIn = opts.seed ?? qs('seed', null);
  const seed = (run === 'research')
    ? (seedIn ?? ('R-' + new Date().toISOString().slice(0,10)))
    : ('P-' + String(Date.now()));

  const rng = mulberry32(hashSeed(seed));

  // DOM refs
  const layerL = ensureEl('gj-layer');
  const layerR = ensureEl('gj-layer-r');

  if(!layerL){
    console.warn('[GoodJunk] missing #gj-layer');
    return;
  }

  // state
  const S = {
    view, diff, run, seed, hub,
    startedAt: now(),
    durationPlannedSec: timePlanned,
    timeLeftSec: timePlanned,
    ended:false,

    score:0,
    combo:0,

    // counts for miss definition
    misses:0,
    nExpireGood:0,
    nHitJunk:0,
    nHitJunkGuard:0,

    nHitGood:0,
    nHitStar:0,
    nHitDiamond:0,
    nHitShield:0,

    nTargetGoodSpawned:0,
    nTargetJunkSpawned:0,
    nTargetStarSpawned:0,
    nTargetDiamondSpawned:0,
    nTargetShieldSpawned:0,

    // fever + shield
    fever:0, // 0..100
    shield:0, // pills

    // modes
    storm:false,
    boss:false,
    rage:false,

    // derived
    grade:'—',

    // bookkeep
    alive:new Map(), // id -> {el,type,spawnAt,ttlAt,layerKey}
    nextId:1,
    lastSpawnAt:0,
  };

  // per-diff tuning
  const TUNE = (function(){
    const base = {
      easy:   { spawnMs: 720, ttlMs: 1700, missLimit: 7, goodNeed:18, scoreNeed:800,  miniNeed:2 },
      normal: { spawnMs: 640, ttlMs: 1550, missLimit: 6, goodNeed:22, scoreNeed:1100, miniNeed:3 },
      hard:   { spawnMs: 560, ttlMs: 1400, missLimit: 5, goodNeed:26, scoreNeed:1500, miniNeed:3 },
    };
    return base[diff] || base.normal;
  })();

  // quest
  const QD = makeQuestDirector({ diff, run });
  QD.init(
    [
      { id:'g_good', title:'ยิงของดีให้ครบ', target:TUNE.goodNeed, desc:()=>`ยิงของดี (🍎🥕🥦) ให้ครบ` },
      { id:'g_score', title:'ทำคะแนนให้ถึง', target:TUNE.scoreNeed, desc:()=>`สะสมคะแนนให้ได้ ≥ ${TUNE.scoreNeed}` },
      { id:'g_mini', title:'ผ่าน MINI', target:TUNE.miniNeed, desc:()=>`ผ่าน MINI ให้ครบ ${TUNE.miniNeed} ครั้ง` },
    ],
    [
      { id:'fast3',  title:'ไว!',    durSec:18, desc:()=>`ยิงดีให้ไว 3 ครั้ง (เร็ว ๆ)` },
      { id:'nojunk10',title:'นิ่ง!',  durSec:10, desc:()=>`เลี่ยงขยะให้ได้ 10 วินาที` },
      { id:'star2',  title:'ดาว!',   durSec:18, desc:()=>`ยิง ⭐ 2 ครั้ง` },
      { id:'combo5', title:'คอมโบ!', durSec:18, desc:()=>`ยิงของดีติดกัน 5 ครั้ง` },
    ],
  );

  // init body view classes
  try{
    DOC.body.classList.add('gj');
    DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    DOC.body.classList.add(
      view==='pc' ? 'view-pc' :
      view==='vr' ? 'view-vr' :
      view==='cvr'? 'view-cvr' : 'view-mobile'
    );
  }catch(_){}

  // helpers
  function calcPlayRect(){
    const vw = WIN.innerWidth || 360;
    const vh = WIN.innerHeight || 640;

    const topSafe = parsePxVar('--gj-top-safe', 140);
    const botSafe = parsePxVar('--gj-bottom-safe', 120);

    const padX = 14;
    const padY = 10;

    const top = clamp(topSafe + padY, 0, vh-40);
    const bottom = clamp(vh - botSafe - padY, 60, vh);
    const left = padX;
    const right = vw - padX;

    return { left, top, right, bottom, w: Math.max(1, right-left), h: Math.max(1, bottom-top) };
  }

  function setHud(){
    setText('hud-score', S.score);
    setText('hud-time', Math.max(0, Math.ceil(S.timeLeftSec)));
    setText('hud-miss', S.misses);

    // accuracy good% = good hits / (good hits + good expires)
    const denom = (S.nHitGood + S.nExpireGood) || 0;
    const acc = denom ? (S.nHitGood / denom) * 100 : 0;
    S.grade = gradeFrom(acc);
    setText('hud-grade', S.grade);

    setPctBar('feverFill', S.fever);
    setText('feverText', Math.round(S.fever) + '%');

    const pills = '🛡️'.repeat(clamp(S.shield,0,5)) || '—';
    setText('shieldPills', pills);

    // goal2 is mini count
    if(QD?.Q?.goals?.[2]){
      QD.Q.goals[2].cur = clamp(QD.Q.miniCleared, 0, QD.Q.goals[2].target);
      QD.checkGoal();
    }

    // low time classes
    try{
      DOC.body.classList.toggle('gj-lowtime', S.timeLeftSec <= 30);
      DOC.body.classList.toggle('gj-lowtime5', S.timeLeftSec <= 5);
    }catch(_){}
  }

  function setModes(){
    const t = S.timeLeftSec;
    S.storm = t <= 30;
    S.boss  = S.misses >= 4;
    S.rage  = S.misses >= 5;

    try{
      DOC.body.classList.toggle('gj-storm', !!S.storm);
      DOC.body.classList.toggle('gj-boss',  !!S.boss);
      DOC.body.classList.toggle('gj-rage',  !!S.rage);
    }catch(_){}
  }

  function pickType(){
    // weights change by modes
    let wGood=60, wJunk=26, wStar=6, wDiamond=4, wShield=4;

    if(S.storm){ wJunk += 6; wGood -= 4; }
    if(S.boss){  wJunk += 10; wGood -= 8; wStar += 2; }
    if(S.rage){  wJunk += 14; wGood -= 10; wShield += 2; }

    // diff shifts
    if(diff==='easy'){ wGood += 6; wJunk -= 4; }
    if(diff==='hard'){ wJunk += 6; wGood -= 4; }

    const sum = wGood+wJunk+wStar+wDiamond+wShield;
    let r = rng() * sum;
    if((r-=wGood) < 0) return 'good';
    if((r-=wJunk) < 0) return 'junk';
    if((r-=wStar) < 0) return 'star';
    if((r-=wDiamond) < 0) return 'diamond';
    return 'shield';
  }

  const EMO = {
    good: ['🍎','🥕','🥦','🍇','🍌'],
    junk: ['🍩','🍟','🍔','🍭','🧋'],
    star: ['⭐'],
    diamond: ['💎'],
    shield: ['🛡️'],
  };

  function spawnOnce(){
    if(S.ended) return;

    setModes();

    const rect = calcPlayRect();

    // adaptive-lite (play only): spawn faster if doing well
    let spawnMs = TUNE.spawnMs;
    let ttlMs = TUNE.ttlMs;

    const denom = (S.nHitGood + S.nExpireGood) || 0;
    const acc = denom ? (S.nHitGood / denom) : 0;

    if(run !== 'research'){
      // if accuracy high or fever high => speed up a bit (fun)
      const speed = clamp((acc*0.55 + (S.fever/100)*0.45), 0, 1);
      spawnMs = Math.round(spawnMs * (1.08 - 0.28*speed));
      ttlMs   = Math.round(ttlMs   * (1.06 - 0.22*speed));
    }

    // boss/rage tighten TTL
    if(S.boss) ttlMs = Math.round(ttlMs * 0.88);
    if(S.rage) ttlMs = Math.round(ttlMs * 0.82);

    const type = pickType();
    const emoji = EMO[type][Math.floor(rng()*EMO[type].length)] || '🎯';

    // choose x/y; for cVR we duplicate into L/R layers but same y and relative x
    const y = rect.top + rng()*rect.h;

    function spawnInLayer(layerEl){
      if(!layerEl) return null;
      const lw = layerEl.getBoundingClientRect().width || (WIN.innerWidth/2);
      const x = clamp(10 + rng()*(lw-20), 10, lw-10);

      const id = String(S.nextId++);
      const el = DOC.createElement('div');
      el.className = 'gj-target spawn';
      el.textContent = emoji;
      el.dataset.id = id;
      el.dataset.type = type;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.style.fontSize = (type==='junk' ? '58px' : type==='good' ? '60px' : '56px');

      el.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault();
        hitTarget(el, { source:'tap' });
      }, { passive:false });

      layerEl.appendChild(el);

      const born = now();
      S.alive.set(id, { el, type, spawnAt: born, ttlAt: born + ttlMs, bornY:y });

      // counters
      if(type==='good') S.nTargetGoodSpawned++;
      else if(type==='junk') S.nTargetJunkSpawned++;
      else if(type==='star') S.nTargetStarSpawned++;
      else if(type==='diamond') S.nTargetDiamondSpawned++;
      else if(type==='shield') S.nTargetShieldSpawned++;

      // expire
      setTimeout(()=>{
        if(S.ended) return;
        const rec = S.alive.get(id);
        if(!rec) return;
        // still alive => expired
        S.alive.delete(id);
        try{ rec.el.classList.add('gone'); setTimeout(()=>rec.el.remove(), 140); }catch(_){}

        if(rec.type === 'good'){
          S.nExpireGood++;
          S.misses++; // ✅ miss definition includes good expired
          addBodyFlash('gj-good-expire', 160);
          QD.miniFail?.('หมดเวลา'); // mini ที่ต้องยิงไวจะ fail เองด้วย tick แต่ช่วยเร่ง feedback
        }
        setModes();
        setHud();
        checkEndConditions();
      }, ttlMs + 10);

      return el;
    }

    spawnInLayer(layerL);
    if(view === 'cvr') spawnInLayer(layerR);

    S.lastSpawnAt = now();

    // schedule next
    setTimeout(spawnOnce, spawnMs);
  }

  function findTargetAtPoint(x,y){
    let el = DOC.elementFromPoint(x,y);
    while(el && el !== DOC.body){
      if(el.classList && el.classList.contains('gj-target')) return el;
      el = el.parentElement;
    }
    return null;
  }

  function onShoot(ev){
    if(S.ended) return;

    // miss-shot effect only (NOT counted as miss)
    let hit = null;

    if(view === 'cvr'){
      const w = WIN.innerWidth || 360;
      const h = WIN.innerHeight || 640;
      const hitL = findTargetAtPoint(Math.floor(w*0.25), Math.floor(h*0.5));
      const hitR = findTargetAtPoint(Math.floor(w*0.75), Math.floor(h*0.5));
      hit = hitL || hitR;
    }else{
      const w = WIN.innerWidth || 360;
      const h = WIN.innerHeight || 640;
      hit = findTargetAtPoint(Math.floor(w*0.5), Math.floor(h*0.5));
    }

    if(hit){
      hitTarget(hit, { source:'shoot', detail: ev?.detail || null });
    }else{
      addBodyFlash('gj-miss-shot', 120);
      S.fever = clamp(S.fever - 6, 0, 100);
      setHud();
    }
  }

  function hitTarget(el, meta={}){
    if(S.ended) return;
    const id = el?.dataset?.id;
    if(!id) return;
    const rec = S.alive.get(id);
    if(!rec) return;

    S.alive.delete(id);

    const type = rec.type;
    const rt = now() - rec.spawnAt;
    const fast = rt <= 620;

    try{ el.classList.add('gone'); setTimeout(()=>el.remove(), 140); }catch(_){}

    if(type === 'good'){
      S.nHitGood++;
      S.combo++;
      S.score += fast ? 70 : 55;
      S.fever = clamp(S.fever + (fast?10:7) + Math.min(6, S.combo*0.3), 0, 100);

      QD.updateGoalCur(1);
      QD.miniOnGoodHit({ fast });

      addBodyFlash('gj-hit', 120);
      emit('hha:judge', { kind: fast?'perfect':'good', msg: fast?'PERFECT!':'GOOD!' });

    } else if(type === 'junk'){
      // ✅ shield block => not miss
      if(S.shield > 0){
        S.shield = clamp(S.shield-1, 0, 5);
        S.nHitJunkGuard++;
        emit('hha:judge', { kind:'block', msg:'BLOCK!' });
      }else{
        S.nHitJunk++;
        S.misses++;               // ✅ junk hit counts as miss
        S.combo = 0;
        S.score = Math.max(0, S.score - 40);
        S.fever = clamp(S.fever - 14, 0, 100);
        addBodyFlash('gj-junk-hit', 220);
        emit('hha:judge', { kind:'bad', msg:'โดนขยะ!' });
      }
      QD.miniOnJunkHit();

    } else if(type === 'star'){
      S.nHitStar++;
      S.score += 120;
      S.fever = clamp(S.fever + 12, 0, 100);
      QD.miniOnStarHit();
      emit('hha:judge', { kind:'bonus', msg:'STAR!' });

    } else if(type === 'diamond'){
      S.nHitDiamond++;
      S.score += 140;
      S.shield = clamp(S.shield + 1, 0, 5);
      emit('hha:judge', { kind:'bonus', msg:'+SHIELD' });

    } else if(type === 'shield'){
      S.nHitShield++;
      S.shield = clamp(S.shield + 1, 0, 5);
      emit('hha:judge', { kind:'bonus', msg:'+SHIELD' });
    }

    setModes();
    setHud();

    emit('hha:score', {
      score: S.score,
      combo: S.combo,
      fever: S.fever,
      shield: S.shield,
      misses: S.misses,
      rtMs: rt,
      fast,
      type,
      source: meta.source || 'tap',
    });

    checkEndConditions();
  }

  function checkEndConditions(){
    if(S.ended) return;

    if(S.misses >= TUNE.missLimit){
      endGame('missLimit');
      return;
    }
    if(S.timeLeftSec <= 0){
      endGame(QD.Q.allDone ? 'goalsDone' : 'timeUp');
      return;
    }
    if(QD.Q.allDone && S.timeLeftSec > 1){
      // optional: end early when all done
      endGame('goalsDone');
      return;
    }
  }

  function buildSummary(reason){
    const durPlayed = (now() - S.startedAt) / 1000;

    const denom = (S.nHitGood + S.nExpireGood) || 0;
    const accuracyGoodPct = denom ? (S.nHitGood / denom) * 100 : 0;
    const junkErrorPct = (S.nHitJunk + S.nHitJunkGuard) ? (S.nHitJunk / (S.nHitJunk + S.nHitJunkGuard)) * 100 : 0;

    return {
      timestampIso: new Date().toISOString(),
      projectTag: 'HeroHealth-GoodJunkVR',
      runMode: S.run,
      seed: S.seed,
      device: S.view,
      diff: S.diff,
      durationPlannedSec: S.durationPlannedSec,
      durationPlayedSec: durPlayed,
      scoreFinal: S.score,
      comboMax: null,
      misses: S.misses,
      goalsCleared: QD.Q.goalsCleared,
      goalsTotal: QD.Q.goalsTotal,
      miniCleared: QD.Q.miniCleared,
      miniTotal: QD.Q.miniTotal,

      nTargetGoodSpawned: S.nTargetGoodSpawned,
      nTargetJunkSpawned: S.nTargetJunkSpawned,
      nTargetStarSpawned: S.nTargetStarSpawned,
      nTargetDiamondSpawned: S.nTargetDiamondSpawned,
      nTargetShieldSpawned: S.nTargetShieldSpawned,

      nHitGood: S.nHitGood,
      nHitJunk: S.nHitJunk,
      nHitJunkGuard: S.nHitJunkGuard,
      nExpireGood: S.nExpireGood,

      accuracyGoodPct,
      junkErrorPct,

      grade: S.grade,
      reason,
      hub: S.hub,
    };
  }

  function endGame(reason){
    if(S.ended) return;
    S.ended = true;

    // remove remaining
    try{
      for(const rec of S.alive.values()){
        try{ rec.el.remove(); }catch(_){}
      }
      S.alive.clear();
    }catch(_){}

    const summary = buildSummary(reason);

    // save last summary (HHA Standard)
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        game:'GoodJunkVR',
        at: summary.timestampIso,
        hub: S.hub,
        url: location.href,
        summary,
      }));
    }catch(_){}

    emit('hha:end', summary);

    // best-effort flush
    try{ emit('hha:flush', { reason:'end' }); }catch(_){}
    try{
      if(WIN.HHA_LOGGER && typeof WIN.HHA_LOGGER.flush === 'function'){
        WIN.HHA_LOGGER.flush();
      }
    }catch(_){}
  }

  // tick time
  let lastTickSec = Math.ceil(S.timeLeftSec);
  setInterval(()=>{
    if(S.ended) return;
    const elapsed = (now() - S.startedAt) / 1000;
    S.timeLeftSec = clamp(S.durationPlannedSec - elapsed, 0, S.durationPlannedSec);

    const curTick = Math.ceil(S.timeLeftSec);
    if(curTick !== lastTickSec){
      lastTickSec = curTick;
      if(S.timeLeftSec <= 5){
        try{
          DOC.body.classList.add('gj-tick');
          setTimeout(()=>DOC.body.classList.remove('gj-tick'), 120);
          setText('gj-lowtime-num', curTick);
        }catch(_){}
      }
      setModes();
      setHud();
      emit('hha:time', { timeLeftSec: S.timeLeftSec, durationPlannedSec: S.durationPlannedSec });
      checkEndConditions();
    }
  }, 140);

  // shoot hook
  WIN.addEventListener('hha:shoot', onShoot);

  // flush hook
  WIN.addEventListener('hha:flush', ()=>{
    try{
      if(WIN.HHA_LOGGER && typeof WIN.HHA_LOGGER.flush === 'function'){
        WIN.HHA_LOGGER.flush();
      }
    }catch(_){}
  });

  // start
  emit('hha:coach', { kind:'start', msg:`GoodJunkVR เริ่มแล้ว! (${run}/${diff}/${view}) seed=${seed}` });
  setHud();
  setTimeout(spawnOnce, 260);
}
