// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (ULTRA)
// ✅ DOM targets spawn (HUD-safe: respects --gj-top-safe/--gj-bottom-safe)
// ✅ Modes: play (adaptive ON) / research (deterministic, adaptive OFF)
// ✅ Devices: mobile/pc/vr/cvr (cvr duplicates targets in L+R)
// ✅ Miss definition (HHA): miss = good expired + junk hit (junk blocked by shield DOES NOT count as miss)
// ✅ Triggers: time<=30 => STORM, miss>=4 => BOSS, miss>=5 => RAGE
// ✅ Emits: hha:start, hha:score, hha:time, hha:judge, quest:update, hha:coach, hha:end, hha:flush
// ✅ End summary: localStorage HHA_LAST_SUMMARY (basic)

'use strict';

const WIN = window;
const DOC = document;

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return performance.now(); }

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}

/* ---------------- RNG (seeded) ---------------- */
function hashStr(s){
  s = String(s||'');
  let h = 2166136261 >>> 0;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- HUD refs ---------------- */
function $(id){ return DOC.getElementById(id); }

function readCssPxVar(name, fallback){
  try{
    const v = getComputedStyle(DOC.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }catch{ return fallback; }
}

function gradeFromScore(score, misses){
  // simple + kid friendly
  if(misses <= 0 && score >= 260) return 'S';
  if(misses <= 1 && score >= 220) return 'A';
  if(misses <= 2 && score >= 180) return 'B';
  if(misses <= 3 && score >= 140) return 'C';
  return 'D';
}

/* ---------------- Quest (Goal + Mini) ---------------- */
function makeQuest(){
  const goalPool = [
    { key:'hitGood',  title:'GOAL: ยิงของดีให้ครบ',   target: 18, tip:'ยิงของดี (🥦🍎🥕) ให้ครบ' },
    { key:'score',    title:'GOAL: เก็บคะแนน',       target: 220, tip:'ยิงดี+สตาร์/เพชรช่วยได้' },
    { key:'combo',    title:'GOAL: คอมโบ',           target: 10,  tip:'ยิงดีติด ๆ กัน อย่าโดนขยะ' },
    { key:'survive',  title:'GOAL: เอาตัวรอด',       target: 1,   tip:'อย่า miss เกินกำหนด' },
  ];

  const miniPool = [
    { key:'noJunk10',  title:'MINI: ห้ามโดนขยะ 10 วิ', sec:10, require:'timer', forbidJunk:true },
    { key:'fast3',     title:'MINI: ยิงดีให้ไว 3 ครั้ง', need:3, require:'fastGood' },
    { key:'star1',     title:'MINI: เก็บ ⭐ 1 อัน', need:1, require:'hitStar' },
    { key:'shield1',   title:'MINI: เก็บ 🛡️ 1 อัน', need:1, require:'hitShield' },
    { key:'good5',     title:'MINI: ยิงดี 5 ครั้ง', need:5, require:'hitGood' },
  ];

  const Q = {
    goal: null,
    mini: null,
    goalsCleared: 0,
    miniCleared: 0,
    goalTotal: 3,
    miniTotal: 6,
    fastWindowMs: 420,
    _miniT0: 0,
    _miniCount: 0,
    _miniDone: false,
    _miniForbidJunk: false,
    _lastGoodHitAt: 0,
  };

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function setGoal(g){
    Q.goal = { ...g, cur:0, done:false };
    render();
  }
  function setMini(m){
    Q.mini = { ...m, cur:0, done:false };
    Q._miniT0 = now();
    Q._miniCount = 0;
    Q._miniDone = false;
    Q._miniForbidJunk = !!m.forbidJunk;
    render();
  }

  function ensureStart(){
    if(!Q.goal) setGoal(goalPool[0]);
    if(!Q.mini) setMini(miniPool[0]);
  }

  function render(){
    try{
      $('hud-goal') && ($('hud-goal').textContent = Q.goal?.title || '—');
      $('hud-goal-cur') && ($('hud-goal-cur').textContent = String(Q.goal?.cur ?? 0));
      $('hud-goal-target') && ($('hud-goal-target').textContent = String(Q.goal?.target ?? 0));
      $('goalDesc') && ($('goalDesc').textContent = Q.goal?.tip || '—');

      $('hud-mini') && ($('hud-mini').textContent = Q.mini?.title || '—');

      // mini timer
      if($('miniTimer')){
        if(Q.mini?.require === 'timer'){
          const left = Math.max(0, (Q.mini.sec||0) - ((now() - Q._miniT0)/1000));
          $('miniTimer').textContent = left.toFixed(0) + 's';
        }else{
          $('miniTimer').textContent = (Q._miniCount||0) + '/' + (Q.mini?.need||0);
        }
      }
    }catch(_){}
    try{
      WIN.dispatchEvent(new CustomEvent('quest:update', { detail:{
        goal: Q.goal, mini: Q.mini,
        goalsCleared: Q.goalsCleared, goalTotal: Q.goalTotal,
        miniCleared: Q.miniCleared, miniTotal: Q.miniTotal
      }}));
    }catch(_){}
  }

  function completeMini(){
    if(!Q.mini || Q._miniDone) return;
    Q._miniDone = true;
    Q.mini.done = true;
    Q.miniCleared++;
    try{ DOC.body.classList.add('gj-mini-clear'); setTimeout(()=>DOC.body.classList.remove('gj-mini-clear'), 220); }catch(_){}
    try{ WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ kind:'mini', msg:'✅ MINI ผ่าน! (สลับทันที)' } })); }catch(_){}
    // next mini immediately
    setTimeout(()=>{
      // deterministic pick: rotate
      const idx = (Q.miniCleared % miniPool.length);
      setMini(miniPool[idx]);
    }, 160);
  }

  function completeGoal(){
    if(!Q.goal || Q.goal.done) return;
    Q.goal.done = true;
    Q.goalsCleared++;
    try{ WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ kind:'goal', msg:'🏁 GOAL ผ่าน! ไป GOAL ต่อ' } })); }catch(_){}
    // next goal
    setTimeout(()=>{
      const idx = (Q.goalsCleared % goalPool.length);
      const g = goalPool[idx];
      setGoal(g);
    }, 220);
  }

  function setGoalExternal(cur, target, done=false){
    if(!Q.goal) return;
    Q.goal.target = Math.max(1, Number(target)||1);
    Q.goal.cur = clamp(Number(cur)||0, 0, Q.goal.target);
    if(done) Q.goal.cur = Q.goal.target;
    if(done && !Q.goal.done) completeGoal();
    else render();
  }

  function onTick(){
    if(!Q.mini) return;
    if(Q.mini.require === 'timer' && !Q._miniDone){
      const elapsed = (now() - Q._miniT0)/1000;
      if(elapsed >= (Q.mini.sec||0)){
        completeMini();
      }
    }
    render();
  }

  function onJunkHit(){
    if(Q._miniForbidJunk && Q.mini && !Q._miniDone){
      // fail -> restart mini
      try{ WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ kind:'warn', msg:'⚠️ MINI ล้มเหลว: โดนขยะ' } })); }catch(_){}
      setMini(Q.mini); // reset timer/counter
    }
  }

  function onHitGood(isFast){
    if(!Q.goal) return;
    if(Q.goal.key === 'hitGood'){
      Q.goal.cur++;
      if(Q.goal.cur >= Q.goal.target) completeGoal();
    }
    if(Q.mini && !Q._miniDone){
      if(Q.mini.require === 'hitGood'){
        Q._miniCount++;
        if(Q._miniCount >= (Q.mini.need||0)) completeMini();
      }else if(Q.mini.require === 'fastGood'){
        if(isFast){
          Q._miniCount++;
          if(Q._miniCount >= (Q.mini.need||0)) completeMini();
        }
      }
    }
    render();
  }

  function onHitStar(){
    if(Q.goal && Q.goal.key === 'score'){
      // score goal uses external setter from engine
    }
    if(Q.mini && Q.mini.require === 'hitStar' && !Q._miniDone){
      Q._miniCount++;
      if(Q._miniCount >= (Q.mini.need||0)) completeMini();
    }
    render();
  }

  function onHitShield(){
    if(Q.mini && Q.mini.require === 'hitShield' && !Q._miniDone){
      Q._miniCount++;
      if(Q._miniCount >= (Q.mini.need||0)) completeMini();
    }
    render();
  }

  function onComboUpdate(combo){
    if(Q.goal && Q.goal.key === 'combo'){
      Q.goal.cur = Math.max(Q.goal.cur, combo);
      if(Q.goal.cur >= Q.goal.target) completeGoal();
    }
    render();
  }

  return {
    Q,
    ensureStart,
    render,
    onTick,
    onJunkHit,
    onHitGood,
    onHitStar,
    onHitShield,
    onComboUpdate,
    setGoalExternal,
  };
}

/* ---------------- Engine ---------------- */
export function boot(opts = {}){
  const view = String(opts.view || qs('view','mobile') || 'mobile').toLowerCase();
  const diff = String(opts.diff || qs('diff','normal') || 'normal').toLowerCase();
  const run  = String(opts.run  || qs('run','play') || 'play').toLowerCase();
  const plannedSec = clamp(Number(opts.time || qs('time','80') || 80), 20, 300);
  const hub = opts.hub || qs('hub', null);
  const studyId = opts.studyId || qs('studyId', qs('study', null));
  const phase = opts.phase || qs('phase', null);
  const conditionGroup = opts.conditionGroup || qs('conditionGroup', qs('cond', null));

  // difficulty params
  const cfg = {
    easy:   { spawnMs: 820, lifeGoodMs: 1700, lifeJunkMs: 1700, junkRatio: 0.22, starRatio:0.06, diaRatio:0.03, shieldRatio:0.05, missLimit: 6, bossHp:5 },
    normal: { spawnMs: 700, lifeGoodMs: 1550, lifeJunkMs: 1550, junkRatio: 0.26, starRatio:0.07, diaRatio:0.035, shieldRatio:0.05, missLimit: 5, bossHp:6 },
    hard:   { spawnMs: 600, lifeGoodMs: 1400, lifeJunkMs: 1400, junkRatio: 0.30, starRatio:0.08, diaRatio:0.04, shieldRatio:0.05, missLimit: 5, bossHp:7 },
  }[diff] || { spawnMs: 700, lifeGoodMs: 1550, lifeJunkMs: 1550, junkRatio: 0.26, starRatio:0.07, diaRatio:0.035, shieldRatio:0.05, missLimit: 5, bossHp:6 };

  const isResearch = (run === 'research');
  const seedIn = opts.seed || qs('seed', null);
  const seed = isResearch ? (seedIn || ('seed-' + (qs('ts', Date.now())||Date.now()))) : String(Date.now());
  const rng = mulberry32(hashStr(seed));
  const rand = ()=> rng();

  const layerL = $('gj-layer');
  const layerR = $('gj-layer-r');
  const hasCVR = (view === 'cvr');
  const isVRLike = (view === 'vr' || view === 'cvr');

  if(!layerL){
    console.warn('[GoodJunkSAFE] missing #gj-layer');
    return;
  }

  // state
  const S = {
    started:false,
    t0:0,
    lastTick:0,
    timeLeft: plannedSec,
    score:0,
    misses:0,            // miss = good-expired + junk-hit (guarded junk NOT counted)
    nExpireGood:0,
    nHitJunk:0,
    nHitJunkGuard:0,
    nHitGood:0,
    nHitStar:0,
    nHitDiamond:0,
    nHitShield:0,
    combo:0,
    comboMax:0,
    fever:0,             // 0..100
    shield:0,            // charges
    bossOn:false,
    bossHp:0,
    bossEndsAt:0,
    stormOn:false,
    rageOn:false,
    ended:false,
    reason:'time',
    // rolling
    lastGoodHitAt:0,
    goodRtSum:0,
    goodRtN:0,
    medRts:[],
  };

  // quest
  const quest = makeQuest();

  // targets
  const T = new Map(); // id -> {id, type, createdAt, expiresAt, x,y, size, elL, elR, bossHp?}
  let seq = 0;

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function setText(id, v){ const el = $(id); if(el) el.textContent = String(v); }
  function setWidth(id, pct){ const el = $(id); if(el) el.style.width = String(pct) + '%'; }

  function hudUpdate(){
    setText('hud-score', S.score);
    setText('hud-miss', S.misses);
    setText('hud-time', Math.max(0, Math.ceil(S.timeLeft)));

    const grade = gradeFromScore(S.score, S.misses);
    setText('hud-grade', grade);

    // fever
    setWidth('feverFill', clamp(S.fever,0,100));
    setText('feverText', Math.round(S.fever) + '%');

    // shield pills
    let pill = '—';
    if(S.shield > 0){
      pill = '🛡️'.repeat(Math.min(3, S.shield));
      if(S.shield > 3) pill += ' +' + (S.shield-3);
    }
    setText('shieldPills', pill);

    // tell logger
    emit('hha:score', { score:S.score, combo:S.combo, comboMax:S.comboMax, misses:S.misses });
    emit('hha:time',  { timeLeft:S.timeLeft, plannedSec, storm:S.stormOn, boss:S.bossOn, rage:S.rageOn });

    // phase chip
    const chipPhase = $('chipPhase');
    if(chipPhase){
      let txt = '';
      if(S.rageOn) txt = 'RAGE';
      else if(S.bossOn) txt = 'BOSS';
      else if(S.stormOn) txt = 'STORM';
      if(txt){
        chipPhase.style.display = 'inline-flex';
        chipPhase.textContent = txt;
      }else{
        chipPhase.style.display = 'none';
      }
    }
  }

  function setBodyFlags(){
    const b = DOC.body;
    b.classList.toggle('gj-storm', !!S.stormOn);
    b.classList.toggle('gj-lowtime', (S.timeLeft <= 30));
    b.classList.toggle('gj-lowtime5', (S.timeLeft <= 5));
    b.classList.toggle('gj-boss', !!S.bossOn);
    b.classList.toggle('gj-rage', !!S.rageOn);
  }

  function playRect(){
    const W = WIN.innerWidth || 360;
    const H = WIN.innerHeight || 640;

    const topSafe = readCssPxVar('--gj-top-safe', 140);
    const botSafe = readCssPxVar('--gj-bottom-safe', 120);

    const pad = 12;
    const left = pad;
    const right = W - pad;
    const top = topSafe;
    const bottom = H - botSafe;

    const w = Math.max(10, right - left);
    const h = Math.max(10, bottom - top);
    return { left, right, top, bottom, w, h, W, H };
  }

  function pickType(){
    // boss overrides
    if(S.bossOn){
      // during boss: mostly good + few junk, some star/shield
      const r = rand();
      if(r < 0.72) return 'good';
      if(r < 0.86) return 'junk';
      if(r < 0.93) return 'star';
      return 'shield';
    }

    const r = rand();
    const jr = cfg.junkRatio;
    const sr = cfg.starRatio;
    const dr = cfg.diaRatio;
    const shr= cfg.shieldRatio;

    // order: diamond, star, shield, junk, good
    if(r < dr) return 'diamond';
    if(r < dr + sr) return 'star';
    if(r < dr + sr + shr) return 'shield';
    if(r < dr + sr + shr + jr) return 'junk';
    return 'good';
  }

  function sizeFor(type){
    if(type === 'diamond') return 64;
    if(type === 'star') return 66;
    if(type === 'shield') return 68;
    if(type === 'junk') return 76;
    if(type === 'boss') return 118;
    return 74; // good
  }

  function emojiFor(type){
    if(type === 'good'){
      const goods = ['🥦','🍎','🥕','🍌','🍉','🍇','🥬'];
      return goods[Math.floor(rand()*goods.length)];
    }
    if(type === 'junk'){
      const junks = ['🍟','🍔','🍩','🍕','🧁','🍫','🥤'];
      return junks[Math.floor(rand()*junks.length)];
    }
    if(type === 'star') return '⭐';
    if(type === 'diamond') return '💎';
    if(type === 'shield') return '🛡️';
    if(type === 'boss') return '👾';
    return '🎯';
  }

  function spawnOne(type, forced = {}){
    const rect = playRect();
    const id = 't' + (++seq);

    let x = rect.left + rand() * rect.w;
    let y = rect.top + rand() * rect.h;

    // slight bias away from very center in VR-like
    if(isVRLike){
      const cx = rect.W/2, cy = rect.H/2;
      const dx = x - cx, dy = y - cy;
      const d = Math.hypot(dx,dy) || 1;
      const push = 0.08; // tiny push outward
      x = cx + dx*(1+push);
      y = cy + dy*(1+push);
      x = clamp(x, rect.left, rect.right);
      y = clamp(y, rect.top, rect.bottom);
    }

    const size = forced.size || sizeFor(type);
    const life = (type === 'good' || type === 'star' || type === 'diamond' || type === 'shield' || type === 'boss')
      ? cfg.lifeGoodMs
      : cfg.lifeJunkMs;

    const createdAt = now();
    const expiresAt = createdAt + (forced.lifeMs || life);

    const elL = DOC.createElement('div');
    elL.className = 'gj-target spawn' + (type==='boss'?' boss':'');
    elL.dataset.id = id;
    elL.dataset.type = type;
    elL.style.left = x + 'px';
    elL.style.top  = y + 'px';
    elL.style.fontSize = size + 'px';
    elL.textContent = emojiFor(type);

    // boss hp badge
    let bossHp = 0;
    if(type === 'boss'){
      bossHp = forced.bossHp || cfg.bossHp;
      elL.setAttribute('data-hp', 'HP ' + bossHp);
    }

    layerL.appendChild(elL);

    let elR = null;
    if(hasCVR && layerR){
      elR = elL.cloneNode(true);
      layerR.appendChild(elR);
    }

    // click/tap hit on PC/Mobile
    elL.addEventListener('click', ()=> onHit(id, 'tap'));
    elR && elR.addEventListener('click', ()=> onHit(id, 'tap'));

    // remove spawn class
    setTimeout(()=>{ try{ elL.classList.remove('spawn'); elR && elR.classList.remove('spawn'); }catch(_){ } }, 140);

    T.set(id, { id, type, createdAt, expiresAt, x, y, size, elL, elR, bossHp });
    return id;
  }

  function removeTarget(t){
    if(!t) return;
    try{
      t.elL && t.elL.classList.add('gone');
      t.elR && t.elR.classList.add('gone');
      setTimeout(()=>{
        try{ t.elL && t.elL.remove(); }catch(_){}
        try{ t.elR && t.elR.remove(); }catch(_){}
      }, 150);
    }catch(_){}
    T.delete(t.id);
  }

  function addScore(n){
    S.score = Math.max(0, Math.round(S.score + (Number(n)||0)));
    // score goal uses external update
    if(quest.Q.goal && quest.Q.goal.key === 'score'){
      quest.setGoalExternal(S.score, quest.Q.goal.target, S.score >= quest.Q.goal.target);
    }
  }

  function setCombo(ok){
    if(ok){
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      quest.onComboUpdate(S.comboMax);
    }else{
      S.combo = 0;
    }
    setText('hud-combo', S.combo);
  }

  function feverAdd(n){
    S.fever = clamp(S.fever + (Number(n)||0), 0, 100);
  }

  function shieldAdd(n){
    S.shield = clamp(S.shield + (Number(n)||0), 0, 8);
  }

  function missAdd(kind){
    // miss = good expire + junk hit only
    S.misses++;
    emit('hha:judge', { kind:'miss', reason: kind, misses:S.misses });

    // triggers
    if(!S.bossOn && S.misses >= 4){
      startBoss();
    }
    if(!S.rageOn && S.misses >= 5){
      S.rageOn = true;
      try{ emit('hha:coach', { kind:'warn', msg:'😡 RAGE! โหมดโหดขึ้นแล้ว' }); }catch(_){}
    }
  }

  function startBoss(){
    if(S.bossOn) return;
    S.bossOn = true;
    S.bossHp = cfg.bossHp;
    S.bossEndsAt = now() + 12000; // 12s window
    // spawn boss immediately
    spawnOne('boss', { lifeMs: 12000, bossHp: S.bossHp, size: 122 });
    emit('hha:coach', { kind:'warn', msg:'👾 BOSS มาแล้ว! ยิงให้หมด HP ก่อนเวลา' });
  }

  function bossHitUpdate(t){
    if(!S.bossOn || !t) return;
    t.bossHp = Math.max(0, (t.bossHp||0) - 1);
    try{
      t.elL && t.elL.setAttribute('data-hp', 'HP ' + t.bossHp);
      t.elR && t.elR.setAttribute('data-hp', 'HP ' + t.bossHp);
    }catch(_){}
    if(t.bossHp <= 0){
      // boss cleared
      S.bossOn = false;
      addScore(80);
      feverAdd(18);
      emit('hha:coach', { kind:'boss', msg:'✅ BOSS ผ่าน! +80' });
      try{ WIN.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ kind:'boss' } })); }catch(_){}
      // clear any remaining boss targets
      for(const tt of T.values()){
        if(tt.type === 'boss') removeTarget(tt);
      }
    }
  }

  function onHit(id, source){
    const t = T.get(id);
    if(!t || S.ended) return;

    const hitAt = now();

    if(t.type === 'junk'){
      // junk hit -> shield may block
      if(S.shield > 0){
        S.shield--;
        S.nHitJunkGuard++;
        emit('hha:judge', { kind:'block', reason:'shield', source });
        feverAdd(-6);
        setCombo(false);
        removeTarget(t);
        return;
      }
      S.nHitJunk++;
      DOC.body.classList.add('gj-junk-hit');
      setTimeout(()=>DOC.body.classList.remove('gj-junk-hit'), 220);
      setCombo(false);
      feverAdd(-10);
      addScore(-12);
      quest.onJunkHit();
      missAdd('hit-junk');
      removeTarget(t);
      return;
    }

    if(t.type === 'shield'){
      S.nHitShield++;
      shieldAdd(1);
      addScore(10);
      feverAdd(6);
      setCombo(true);
      emit('hha:judge', { kind:'shield', source });
      quest.onHitShield();
      removeTarget(t);
      return;
    }

    if(t.type === 'star'){
      S.nHitStar++;
      addScore(25);
      feverAdd(10);
      setCombo(true);
      emit('hha:judge', { kind:'star', source });
      quest.onHitStar();
      removeTarget(t);
      return;
    }

    if(t.type === 'diamond'){
      S.nHitDiamond++;
      addScore(40);
      feverAdd(12);
      setCombo(true);
      emit('hha:judge', { kind:'diamond', source });
      removeTarget(t);
      return;
    }

    if(t.type === 'boss'){
      // boss requires multiple hits
      setCombo(true);
      addScore(8);
      feverAdd(6);
      emit('hha:judge', { kind:'bossHit', source });
      bossHitUpdate(t);
      if(t.bossHp <= 0){
        removeTarget(t);
      }
      return;
    }

    // good hit
    S.nHitGood++;
    const rt = (t.createdAt ? (hitAt - t.createdAt) : 0);
    if(rt > 0){
      S.goodRtSum += rt;
      S.goodRtN++;
      S.medRts.push(rt);
      if(S.medRts.length > 80) S.medRts.shift();
    }
    const isFast = rt > 0 && rt <= quest.Q.fastWindowMs;

    addScore(isFast ? 14 : 10);
    feverAdd(isFast ? 8 : 6);
    setCombo(true);

    quest.onHitGood(isFast);

    emit('hha:judge', { kind: isFast ? 'perfect' : 'good', rtMs: Math.round(rt), source });
    removeTarget(t);
  }

  function aimShoot(detail){
    if(S.ended) return;

    const rect = playRect();

    // center lock points
    const lockPx = 70; // aim assist window
    const pickCenter = (cx,cy)=>{
      let best = null;
      let bestD = 1e9;

      for(const t of T.values()){
        // ignore expired visually removed
        const el = t.elL;
        if(!el) continue;

        // compute distance in current viewport coords (we store x/y)
        const dx = (t.x - cx);
        const dy = (t.y - cy);
        const d = Math.hypot(dx,dy);

        if(d < bestD){
          bestD = d;
          best = t;
        }
      }
      if(best && bestD <= lockPx) return best;
      return null;
    };

    if(hasCVR){
      const leftCenterX = rect.W * 0.25;
      const rightCenterX = rect.W * 0.75;
      const cy = rect.H * 0.5;

      // pick the closest from either eye
      const t1 = pickCenter(leftCenterX, cy);
      const t2 = pickCenter(rightCenterX, cy);

      const choose = (t1 && t2)
        ? ((Math.hypot(t1.x-leftCenterX, t1.y-cy) <= Math.hypot(t2.x-rightCenterX, t2.y-cy)) ? t1 : t2)
        : (t1 || t2);

      if(choose) onHit(choose.id, 'shoot');
      else{
        DOC.body.classList.add('gj-miss-shot');
        setTimeout(()=>DOC.body.classList.remove('gj-miss-shot'), 120);
        emit('hha:judge', { kind:'missShot' });
      }
      return;
    }

    // VR / mobile / pc center
    const cx = rect.W * 0.5;
    const cy = rect.H * 0.5;
    const t = pickCenter(cx, cy);
    if(t) onHit(t.id, 'shoot');
    else{
      DOC.body.classList.add('gj-miss-shot');
      setTimeout(()=>DOC.body.classList.remove('gj-miss-shot'), 120);
      emit('hha:judge', { kind:'missShot' });
    }
  }

  function expireTargets(){
    const tNow = now();
    for(const t of Array.from(T.values())){
      if(tNow >= t.expiresAt){
        // good expire => miss
        if(t.type === 'good'){
          S.nExpireGood++;
          DOC.body.classList.add('gj-good-expire');
          setTimeout(()=>DOC.body.classList.remove('gj-good-expire'), 160);
          setCombo(false);
          feverAdd(-8);
          missAdd('expire-good');
        }
        // boss timeout => boss remains -> punish a bit
        if(t.type === 'boss'){
          // if boss not cleared in time, add one miss (pressure)
          if(S.bossOn){
            S.bossOn = false;
            emit('hha:coach', { kind:'warn', msg:'⏳ BOSS หนี! +1 MISS' });
            missAdd('boss-timeout');
          }
        }
        removeTarget(t);
      }
    }
  }

  function updatePhases(){
    // storm
    S.stormOn = (S.timeLeft <= 30);
    // countdown tick at <=5
    if(S.timeLeft <= 5){
      DOC.body.classList.add('gj-lowtime5');
    }
    setBodyFlags();
  }

  function updateCountdownPulse(){
    if(S.timeLeft <= 5){
      // tick animation
      DOC.body.classList.add('gj-tick');
      setTimeout(()=>DOC.body.classList.remove('gj-tick'), 140);
      const el = $('gj-lowtime-num');
      if(el) el.textContent = String(Math.max(0, Math.ceil(S.timeLeft)));
    }
  }

  function maybeEnd(){
    if(S.ended) return true;

    if(S.misses >= cfg.missLimit){
      end('missLimit');
      return true;
    }
    if(S.timeLeft <= 0){
      end('time');
      return true;
    }
    return false;
  }

  function end(reason){
    if(S.ended) return;
    S.ended = true;
    S.reason = reason || 'time';

    // compute metrics
    const durationPlayedSec = plannedSec - Math.max(0, S.timeLeft);
    const grade = gradeFromScore(S.score, S.misses);

    const med = (arr)=>{
      if(!arr.length) return 0;
      const a = arr.slice().sort((x,y)=>x-y);
      const m = Math.floor(a.length/2);
      return (a.length%2)?a[m]:(a[m-1]+a[m])/2;
    };

    const summary = {
      timestampIso: new Date().toISOString(),
      projectTag: 'HeroHealth-GoodJunkVR',
      runMode: run,
      studyId, phase, conditionGroup,
      sessionId: 'GJ-' + Math.random().toString(16).slice(2,10),
      device: view,
      diff,
      durationPlannedSec: plannedSec,
      durationPlayedSec,
      scoreFinal: S.score,
      comboMax: S.comboMax,
      misses: S.misses,
      goalsCleared: quest.Q.goalsCleared,
      goalsTotal: quest.Q.goalTotal,
      miniCleared: quest.Q.miniCleared,
      miniTotal: quest.Q.miniTotal,
      nHitGood: S.nHitGood,
      nHitJunk: S.nHitJunk,
      nHitJunkGuard: S.nHitJunkGuard,
      nExpireGood: S.nExpireGood,
      nHitStar: S.nHitStar,
      nHitDiamond: S.nHitDiamond,
      nHitShield: S.nHitShield,
      avgRtGoodMs: S.goodRtN ? (S.goodRtSum/S.goodRtN) : 0,
      medianRtGoodMs: med(S.medRts),
      grade,
      reason: S.reason,
      seed,
      hub,
    };

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    }catch(_){}

    // flush hint
    emit('hha:flush', { when:'end' });

    emit('hha:end', summary);
  }

  /* ---------------- adaptive knobs ---------------- */
  function adaptiveSpawnMs(){
    if(isResearch) return cfg.spawnMs;
    // play mode: adapt based on fever + misses + combo
    let ms = cfg.spawnMs;

    // storm => faster
    if(S.stormOn) ms *= 0.85;

    // boss/rage => faster
    if(S.bossOn) ms *= 0.88;
    if(S.rageOn) ms *= 0.78;

    // high fever => slightly faster
    ms *= (1 - (clamp(S.fever,0,100)/100)*0.10);

    // too many targets => slow down
    const n = T.size;
    if(n > 7) ms *= 1.15;
    if(n > 10) ms *= 1.35;

    return clamp(ms, 340, 1200);
  }

  let spawnAcc = 0;
  function spawnTick(dt){
    const ms = adaptiveSpawnMs();
    spawnAcc += dt;
    while(spawnAcc >= ms){
      spawnAcc -= ms;

      if(T.size > 12) break;

      // during boss, ensure at most one boss target exists
      if(S.bossOn){
        const hasBoss = Array.from(T.values()).some(t=>t.type==='boss');
        if(!hasBoss){
          spawnOne('boss', { lifeMs: Math.max(3000, (S.bossEndsAt - now())), bossHp: cfg.bossHp, size: 122 });
        }
      }

      // spawn regular
      const type = pickType();
      spawnOne(type);
    }
  }

  function mainLoop(t){
    if(S.ended) return;

    if(!S.started){
      S.started = true;
      S.t0 = t;
      S.lastTick = t;

      quest.ensureStart();
      quest.render();

      // start event for logger
      emit('hha:start', {
        projectTag:'HeroHealth-GoodJunkVR',
        runMode: run,
        diff,
        durationPlannedSec: plannedSec,
        seed,
        device: view,
        studyId, phase, conditionGroup,
      });
    }

    const dt = Math.max(0, t - S.lastTick);
    S.lastTick = t;

    // time
    S.timeLeft = Math.max(0, S.timeLeft - dt/1000);

    // storm & lowtime effects
    updatePhases();
    if(Math.floor(S.timeLeft) !== Math.floor(S.timeLeft + dt/1000)){
      // per-second tick crossing
      updateCountdownPulse();
    }

    // fever decay
    const decay = (S.rageOn ? 0.020 : 0.014) * dt;
    S.fever = clamp(S.fever - decay, 0, 100);

    // boss timer ends?
    if(S.bossOn && now() >= S.bossEndsAt){
      // boss will be handled by expiryTargets on boss target, but ensure flag falls soon
      S.bossEndsAt = now() + 1;
    }

    // spawn
    spawnTick(dt);

    // expire
    expireTargets();

    // quest tick (mini timer)
    quest.onTick();

    // update HUD
    hudUpdate();
    setBodyFlags();

    // goal survive: external goal uses missLimit
    if(quest.Q.goal && quest.Q.goal.key === 'survive'){
      // show progress as "remaining lives"
      const remain = Math.max(0, cfg.missLimit - S.misses);
      quest.setGoalExternal(cfg.missLimit - remain, cfg.missLimit, (S.misses < cfg.missLimit && S.timeLeft <= 0));
      // better display: cur = misses, target = missLimit
      quest.setGoalExternal(S.misses, cfg.missLimit, false);
    }

    // end?
    if(!maybeEnd()){
      requestAnimationFrame(mainLoop);
    }
  }

  // shoot handler (vr-ui emits hha:shoot)
  WIN.addEventListener('hha:shoot', (ev)=> aimShoot(ev?.detail || null), { passive:true });

  // flush handler for logger
  WIN.addEventListener('hha:flush', ()=>{ /* cloud logger will listen */ }, { passive:true });

  // start loop
  requestAnimationFrame(mainLoop);

  // back hub wiring (optional)
  const btnBack = $('btnBackHub');
  if(btnBack){
    btnBack.addEventListener('click', ()=>{
      if(hub){
        emit('hha:flush', { when:'backHub' });
        setTimeout(()=> location.href = hub, 260);
      }else{
        alert('ไม่พบ hub ในพารามิเตอร์ URL (hub=...)');
      }
    });
  }

  // helpful VR tip
  if(isVRLike){
    emit('hha:coach', { kind:'tip', msg:'VR/cVR: เล็งกลางจอแล้วแตะ/คลิกเพื่อยิง (aim assist)' });
  }

  // safety: stop on visibility hide
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden'){
      emit('hha:flush', { when:'hidden' });
    }
  }, { passive:true });

  return { seed, isResearch, view, diff, run };
}
