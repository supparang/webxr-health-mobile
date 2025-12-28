/* === /herohealth/vr-goodjunk/goodjunk.safe.js ===
GoodJunkVR (PRODUCTION SAFE) — HHA Standard
✅ DOM emoji targets on #gj-layer (HTML provided)
✅ HUD + Quest + Coach + Fever/Shield
✅ Fix: dispatch events to WINDOW (matches /vr/hha-hud.js)
✅ Fix: quest payload keys (goalMax/miniMax/miniTLeft)
✅ Fix: spawn pacing (no more spawn-every-frame -> miss explosion)
✅ Shoot button (#btnShoot) + Spacebar
✅ Start overlay ids: #startOverlay, #btnStart, #startMeta
Grade: SSS, SS, S, A, B, C
*/

'use strict';

// ------------------------------ Root / Doc ------------------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;
if (!DOC) { /* no-op */ }

// ------------------------------ Utilities ------------------------------
function clamp(v, a, b){ v = Number(v)||0; return v < a ? a : (v > b ? b : v); }
function nowMs(){ return (ROOT.performance && ROOT.performance.now) ? ROOT.performance.now() : Date.now(); }
function byId(id){ return DOC ? DOC.getElementById(id) : null; }
function qs(sel){ return DOC ? DOC.querySelector(sel) : null; }
function setTxt(el, t){ if (el) el.textContent = String(t ?? ''); }
function setHtml(el, html){ if (el) el.innerHTML = String(html ?? ''); }

function parseQuery(){
  const out = {};
  try{
    const u = new URL(ROOT.location.href);
    u.searchParams.forEach((v,k)=>{ out[k]=v; });
  }catch(_){}
  return out;
}

function mulberry32(seed){
  let a = (seed >>> 0) || 0x12345678;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash32(str){
  str = String(str ??	redirect(''));
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dispatchRoot(name, detail){
  try{
    ROOT.dispatchEvent(new CustomEvent(name, { detail }));
  }catch(_){}
}

function dispatchDoc(name, detail){
  try{
    DOC.dispatchEvent(new CustomEvent(name, { detail }));
  }catch(_){}
}

function tryVibrate(ms){
  try{
    if (ROOT.navigator && ROOT.navigator.vibrate) ROOT.navigator.vibrate(ms);
  }catch(_){}
}

// ------------------------------ Optional globals ------------------------------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  { setFever(){}, setShield(){}, stun(){}, flash(){}, sync(){}, isShieldActive(){ return false; } };

const CloudLogger =
  ROOT.HHACloudLogger || ROOT.HhaCloudLogger ||
  (ROOT.GAME_MODULES && (ROOT.GAME_MODULES.CloudLogger || ROOT.GAME_MODULES.HHACloudLogger)) ||
  null;

// ------------------------------ Defaults: Goals & Minis ------------------------------
const DEFAULT_GOALS = [
  { id:'g_collect', title:'เก็บของดีให้ครบ', targetByDiff:{ easy:22, normal:26, hard:30 } },
  { id:'g_survive', title:'อยู่รอด (มิสไม่เกินลิมิต)', targetByDiff:{ easy:6, normal:4, hard:3 } }
];

const DEFAULT_MINIS = [
  { id:'m_fast',   title:'สปีดรัน! เก็บของดี 6 ชิ้น',       targetByDiff:{ easy:6, normal:7, hard:8 },  forbidJunk:false },
  { id:'m_clean',  title:'โซนคลีน! ห้ามโดนขยะ 10 วิ',      targetByDiff:{ easy:1, normal:1, hard:1 },  forbidJunk:true,  timerSecByDiff:{ easy:10, normal:10, hard:12 } },
  { id:'m_combo',  title:'คอมโบเดือด! ทำคอมโบ 8',          targetByDiff:{ easy:8, normal:9, hard:10 }, forbidJunk:false, special:'combo' },
  { id:'m_guard',  title:'โล่พร้อม! บล็อกขยะ 2 ครั้ง',      targetByDiff:{ easy:2, normal:2, hard:3 },  forbidJunk:false, special:'guard' },
  { id:'m_boss',   title:'บอสมาแล้ว! ตีบอสให้แตก',         targetByDiff:{ easy:8, normal:10, hard:12 },forbidJunk:false, special:'boss' },
  { id:'m_focus',  title:'โฟกัส! เก็บของดี 10 ชิ้น',        targetByDiff:{ easy:9, normal:10, hard:11 }, forbidJunk:false },
  { id:'m_clean2', title:'คลีนอีกรอบ! ห้ามโดนขยะ 12 วิ',    targetByDiff:{ easy:1, normal:1, hard:1 },  forbidJunk:true,  timerSecByDiff:{ easy:12, normal:12, hard:14 } }
];

// ------------------------------ Quest Director ------------------------------
function makeQuestDirector(opts = {}){
  const diff = String(opts.diff || 'normal').toLowerCase();
  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];

  const maxGoals = Math.max(1, opts.maxGoals || goalDefs.length || 2);
  const maxMini  = Math.max(1, opts.maxMini  || miniDefs.length || 7);

  const Q = {
    goalsAll: [],
    minisAll: [],
    goalIndex: 0,
    miniCount: 0,
    activeGoal: null,
    activeMini: null,
    started: false,
    allDone: false,
    goalsCleared: 0,
    minisCleared: 0,
    miniEndsAtMs: 0
  };

  function buildGoals(){
    const out = [];
    for (let i=0;i<goalDefs.length;i++){
      const d = goalDefs[i] || {};
      const t = (d.targetByDiff && d.targetByDiff[diff] != null) ? d.targetByDiff[diff] : d.target;
      out.push({
        id: d.id || ('g'+i),
        title: d.title || 'Goal',
        cur: 0,
        target: Math.max(1, Number(t)||1),
        done: false
      });
    }
    while(out.length < maxGoals){
      out.push({ id:'g_auto_'+out.length, title:'Goal', cur:0, target:10, done:false });
    }
    return out.slice(0, maxGoals);
  }

  function buildMinis(){
    const out = [];
    for (let i=0;i<miniDefs.length;i++){
      const d = miniDefs[i] || {};
      const t = (d.targetByDiff && d.targetByDiff[diff] != null) ? d.targetByDiff[diff] : d.target;
      const timer = (d.timerSecByDiff && d.timerSecByDiff[diff] != null) ? d.timerSecByDiff[diff] : d.timerSec;
      out.push({
        id: d.id || ('m'+i),
        title: d.title || 'Mini',
        cur: 0,
        target: Math.max(1, Number(t)||1),
        done: false,
        forbidJunk: !!d.forbidJunk,
        timerSec: Math.max(0, Number(timer)||0),
        special: d.special || ''
      });
    }
    while(out.length < maxMini){
      out.push({ id:'m_auto_'+out.length, title:'Mini', cur:0, target:5, done:false, forbidJunk:false, timerSec:0, special:'' });
    }
    return out.slice(0, maxMini);
  }

  function ui(reason='state'){
    const miniTLeft =
      (Q.activeMini && Q.activeMini.timerSec > 0 && Q.miniEndsAtMs > 0)
        ? Math.max(0, Math.ceil((Q.miniEndsAtMs - nowMs()) / 1000))
        : null;

    return {
      reason,

      goalIndex: Q.goalIndex,
      goalTitle: Q.activeGoal ? Q.activeGoal.title : '',
      goalCur: Q.activeGoal ? Q.activeGoal.cur : 0,
      goalMax: Q.activeGoal ? Q.activeGoal.target : 1,   // ✅ HUD expects goalMax
      goalTarget: Q.activeGoal ? Q.activeGoal.target : 1, // (compat)
      goalDone: Q.activeGoal ? !!Q.activeGoal.done : false,
      goalsCleared: Q.goalsCleared,
      goalsTotal: Q.goalsAll.length,

      miniCount: Q.miniCount,
      miniTitle: Q.activeMini ? Q.activeMini.title : '',
      miniCur: Q.activeMini ? Q.activeMini.cur : 0,
      miniMax: Q.activeMini ? Q.activeMini.target : 1,    // ✅ HUD expects miniMax
      miniTarget: Q.activeMini ? Q.activeMini.target : 1, // (compat)
      miniDone: Q.activeMini ? !!Q.activeMini.done : false,
      minisCleared: Q.minisCleared,
      minisTotal: Q.minisAll.length,

      miniForbidJunk: Q.activeMini ? !!Q.activeMini.forbidJunk : false,
      miniTimerSec: Q.activeMini ? (Q.activeMini.timerSec|0) : 0,
      miniEndsAtMs: Q.miniEndsAtMs|0,
      miniTLeft, // ✅ HUD expects miniTLeft

      allDone: !!Q.allDone
    };
  }

  function push(reason){
    dispatchDoc('quest:update', ui(reason));
  }

  function checkAllDone(){
    if (Q.allDone) return;
    const gAll = Q.goalsCleared >= Q.goalsAll.length;
    const mAll = Q.minisCleared >= Q.minisAll.length;
    if (gAll && mAll){
      Q.allDone = true;
      push('all-done');
    }
  }

  function start(){
    Q.goalsAll = buildGoals();
    Q.minisAll = buildMinis();
    Q.goalIndex = 0;
    Q.miniCount = 0;
    Q.goalsCleared = 0;
    Q.minisCleared = 0;
    Q.allDone = false;
    Q.started = true;

    Q.activeGoal = Q.goalsAll[0] || null;
    Q.activeMini = Q.minisAll[0] || null;

    const sec = Q.activeMini ? (Q.activeMini.timerSec|0) : 0;
    Q.miniEndsAtMs = sec > 0 ? (nowMs() + sec*1000) : 0;

    push('start');
  }

  function nextGoal(){
    if (Q.allDone) return;
    Q.goalIndex = clamp(Q.goalIndex + 1, 0, Q.goalsAll.length);
    Q.activeGoal = Q.goalsAll[Q.goalIndex] || null;
    push('next-goal');
  }

  function nextMini(){
    if (Q.allDone) return;
    Q.miniCount = clamp(Q.miniCount + 1, 0, Q.minisAll.length);
    Q.activeMini = Q.minisAll[Q.miniCount] || null;

    const sec = Q.activeMini ? (Q.activeMini.timerSec|0) : 0;
    Q.miniEndsAtMs = sec > 0 ? (nowMs() + sec*1000) : 0;

    push('next-mini');
  }

  function tick(){
    if (!Q.started || Q.allDone) return ui('tick-skip');
    if (Q.activeMini && Q.activeMini.timerSec > 0 && Q.miniEndsAtMs > 0){
      const leftMs = Q.miniEndsAtMs - nowMs();
      if (leftMs <= 0 && !Q.activeMini.done){
        // timer mini: pass by surviving time (forbidJunk minis will fail via onJunkHit -> failMini)
        Q.activeMini.done = true;
        Q.minisCleared++;
        push('mini-time-done');
        checkAllDone();
      } else {
        push('tick');
      }
    }
    return ui('tick');
  }

  function failMini(reason='fail'){
    const m = Q.activeMini;
    if (!m || m.done || Q.allDone) return ui('fail-skip');
    m.cur = 0;
    if (m.timerSec > 0){
      Q.miniEndsAtMs = nowMs() + m.timerSec*1000;
    }
    push('mini-fail:' + reason);
    return ui('mini-fail');
  }

  function addGoalProgress(n=1){
    const g = Q.activeGoal;
    if(!g || g.done || Q.allDone) return ui('goal-skip');
    g.cur = clamp(g.cur + (n|0), 0, g.target);
    if (g.cur >= g.target && !g.done){
      g.done = true;
      Q.goalsCleared++;
      push('goal-done');
      checkAllDone();
    } else {
      push('goal-progress');
    }
    return ui('goal-progress');
  }

  function addMiniProgress(n=1){
    const m = Q.activeMini;
    if(!m || m.done || Q.allDone) return ui('mini-skip');
    m.cur = clamp(m.cur + (n|0), 0, m.target);
    if (m.cur >= m.target && !m.done){
      m.done = true;
      Q.minisCleared++;
      push('mini-done');
      checkAllDone();
    } else {
      push('mini-progress');
    }
    return ui('mini-progress');
  }

  function onJunkHit(){
    const m = Q.activeMini;
    if(m && !m.done && m.forbidJunk && !Q.allDone){
      failMini('hit-junk');
    }
  }

  // allow engine to drive goal progress externally (e.g., survive/miss limit)
  function setGoalExternal(cur, target, done=false){
    const g = Q.activeGoal;
    if(!g || Q.allDone) return;
    g.target = Math.max(1, Number(target)||1);
    g.cur = clamp(Number(cur)||0, 0, g.target);
    if (done && !g.done){
      g.done = true;
      Q.goalsCleared++;
      push('goal-complete-external');
      checkAllDone();
    } else {
      push('goal-external');
    }
  }

  function getUIState(reason='state'){ return ui(reason); }

  return {
    start, tick,
    addGoalProgress, addMiniProgress,
    nextGoal, nextMini,
    failMini, onJunkHit,
    getUIState,
    setGoalExternal
  };
}

// ------------------------------ Main Boot ------------------------------
export function boot(opts = {}){
  if (!DOC) return;

  const q = { ...parseQuery(), ...(opts.query||{}) };

  const diff = String(q.diff || opts.diff || 'normal').toLowerCase();
  const run  = String(q.run  || opts.run  || 'play').toLowerCase(); // play|study
  const durationPlannedSec = clamp(Number(q.time || opts.time || 80), 20, 600) | 0;

  // deterministic seed (study mode important)
  const seedStr = String(q.seed || q.studentKey || q.studyId || q.sid || q.nick || ('gj-'+Date.now()));
  const seed = (Number(q.seed)|0) || hash32(seedStr);
  const rng = mulberry32(seed);

  const stage = byId('gj-stage') || qs('#gj-stage') || DOC.body;
  const layer = byId('gj-layer') || qs('#gj-layer') || stage;

  // HUD ids from your HTML
  const elHudMeta   = byId('hudMeta');
  const elStartMeta = byId('startMeta');

  const elEndWrap   = byId('gj-end') || byId('end-summary') || qs('.gj-end') || null;

  // Start overlay ids from your HTML
  const startOverlay = byId('startOverlay') || qs('#startOverlay');
  const startBtn     = byId('btnStart') || qs('#btnStart');

  // Shoot button
  const btnShoot = byId('btnShoot') || qs('#btnShoot');

  // state
  const S = {
    started: false,
    ended: false,

    timeLeftSec: durationPlannedSec,
    durationPlannedSec,
    durationPlayedSec: 0,

    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,

    // counters (for logging)
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    // RT tracking for good hits
    rtGood: [],

    // fever/shield
    fever: 0,
    shield: 0,
    stunUntilMs: 0,

    // boss
    bossAlive: false,
    bossHp: 0,
    bossHpMax: 0,
    bossId: null,

    diff,
    runMode: run,

    // miss limit per diff (drives Survive goal)
    missLimit: (diff === 'easy') ? 6 : (diff === 'hard' ? 3 : 4),

    // timing
    tLastMs: 0,
    tStartIso: '',
    tEndIso: '',

    // spawn pacing (IMPORTANT)
    __spawnAccMs: 0,

    // coach cooldown
    __coachCdMs: 0,

    // version
    gameVersion: String(opts.gameVersion || q.ver || 'goodjunk.safe.js@prod')
  };

  // show meta
  const metaText = `diff=${diff} • run=${run} • time=${durationPlannedSec}s • seed=${seed>>>0}`;
  if (elHudMeta) setTxt(elHudMeta, metaText);
  if (elStartMeta) setTxt(elStartMeta, metaText);

  // ------------------------------ Playfield bounds ------------------------------
  function getPlayRect(){
    const vw = ROOT.innerWidth || 360;
    const vh = ROOT.innerHeight || 640;

    // reserve HUD safe zones (match your layout)
    const padTop  = 120;
    const padBot  = 130;
    const padSide = 18;

    const x0 = padSide;
    const y0 = padTop;
    const x1 = vw - padSide;
    const y1 = vh - padBot;

    const w = Math.max(140, x1 - x0);
    const h = Math.max(180, y1 - y0);

    // relax if tiny (avoid “spawn at one spot”)
    const relax = (w < 240 || h < 240) ? 0.72 : 1.0;

    return {
      x0: x0 * relax,
      y0: y0 * relax,
      w: Math.max(140, (vw - (padSide*2*relax))),
      h: Math.max(180, (vh - (padTop*relax) - (padBot*relax)))
    };
  }

  // ------------------------------ Targets ------------------------------
  const targets = new Map();
  let nextId = 1;

  function pick(arr){ return arr[(rng()*arr.length)|0]; }

  function makeElTarget(t){
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'gj-target gj-' + t.type;
    el.dataset.tid = String(t.id);
    el.setAttribute('aria-label', t.type);

    el.textContent = t.emoji;

    el.style.position = 'absolute';
    el.style.left = t.xView + 'px';
    el.style.top  = t.yView + 'px';
    el.style.width = t.size + 'px';
    el.style.height = t.size + 'px';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.borderRadius = '999px';
    el.style.userSelect = 'none';
    el.style.touchAction = 'manipulation';
    el.style.pointerEvents = 'auto';

    // fallback visual (CSS can override)
    el.style.border = '1px solid rgba(148,163,184,.25)';
    el.style.background = 'rgba(2,6,23,.40)';
    el.style.backdropFilter = 'blur(6px)';
    el.style.fontSize = Math.max(18, (t.size * 0.55)) + 'px';
    el.style.lineHeight = t.size + 'px';
    el.style.textAlign = 'center';
    el.style.boxShadow = '0 10px 30px rgba(0,0,0,.35)';

    if (t.type === 'junk' || t.type === 'trap'){
      el.style.borderColor = 'rgba(239,68,68,.45)';
      el.style.boxShadow = '0 10px 35px rgba(239,68,68,.18)';
    }
    if (t.type === 'shield'){
      el.style.borderColor = 'rgba(34,211,238,.45)';
      el.style.boxShadow = '0 10px 35px rgba(34,211,238,.18)';
    }
    if (t.type === 'boss'){
      el.style.borderColor = 'rgba(168,85,247,.55)';
      el.style.boxShadow = '0 18px 60px rgba(168,85,247,.25)';
      el.style.fontSize = Math.max(22, (t.size * 0.46)) + 'px';
    }

    return el;
  }

  function removeTarget(id){
    const t = targets.get(id);
    if (!t) return;
    try{ t.el && t.el.remove(); }catch(_){}
    targets.delete(id);
  }

  function spawnTarget(type){
    if (S.ended) return null;

    const rect = getPlayRect();
    const baseSize = (diff === 'easy') ? 66 : (diff === 'hard' ? 54 : 60);
    let size = baseSize + (rng()*10 - 5);

    if (type === 'boss') size = (diff === 'easy') ? 120 : (diff === 'hard' ? 108 : 114);

    size = clamp(size, 44, 140);

    const x = rect.x0 + rng()*rect.w;
    const y = rect.y0 + rng()*rect.h;

    const id = nextId++;
    const tNow = nowMs();

    const lifeMs =
      (type === 'good') ? ((diff === 'easy') ? 3000 : (diff === 'hard' ? 2400 : 2700)) :
      (type === 'junk' || type === 'trap') ? ((diff === 'easy') ? 3200 : (diff === 'hard' ? 2600 : 2900)) :
      (type === 'shield') ? 3200 :
      (type === 'boss') ? 999999 :
      3000;

    const emoji =
      (type === 'good') ? pick(['🍎','🥦','🥕','🍌','🍇','🍊','🍉','🥗']) :
      (type === 'junk') ? pick(['🍟','🍔','🍩','🍭','🥤','🍰']) :
      (type === 'trap') ? pick(['🧨','💣','🪤']) :
      (type === 'shield') ? '🛡️' :
      (type === 'boss') ? '😈' :
      '❓';

    const t = { id, type, emoji, xView:x, yView:y, size, bornMs:tNow, expireMs:tNow+lifeMs, el:null };

    t.el = makeElTarget(t);
    targets.set(id, t);
    try{ layer.appendChild(t.el); }catch(_){}

    if (type === 'good') S.nTargetGoodSpawned++;
    if (type === 'junk' || type === 'trap') S.nTargetJunkSpawned++;
    if (type === 'shield') S.nTargetShieldSpawned++;

    return t;
  }

  // ------------------------------ Logging ------------------------------
  function makeSessionId(){
    const base = `${Date.now()}-${(Math.random()*1e9)|0}-${seed>>>0}`;
    return base.replace(/\./g,'');
  }
  const sessionId = String(opts.sessionId || q.sessionId || makeSessionId());

  function logEvent(type, a={}, b={}){
    const payload = {
      timestampIso: new Date().toISOString(),
      projectTag: String(q.projectTag || 'HHA'),
      runMode: run,
      studyId: String(q.studyId || ''),
      phase: String(q.phase || ''),
      conditionGroup: String(q.conditionGroup || ''),
      sessionOrder: String(q.sessionOrder || ''),
      blockLabel: String(q.blockLabel || ''),
      siteCode: String(q.siteCode || ''),
      schoolYear: String(q.schoolYear || ''),
      semester: String(q.semester || ''),
      sessionId,
      gameMode: 'GoodJunk',
      diff,
      gameVersion: S.gameVersion,
      seed: seed >>> 0,
      eventType: String(type || 'event'),
      ...a,
      ...b
    };

    try{
      if (CloudLogger && typeof CloudLogger.logEvent === 'function'){
        CloudLogger.logEvent(payload);
      } else if (CloudLogger && typeof CloudLogger.send === 'function'){
        CloudLogger.send(payload);
      } else {
        dispatchRoot('hha:log', payload);
      }
    }catch(_){}
  }

  // ------------------------------ Coach / Fever ------------------------------
  function coach(line, mood='neutral', sub=''){
    if (S.__coachCdMs > 0) return;
    S.__coachCdMs = 900;
    // ✅ HUD expects {line, sub, mood}
    dispatchRoot('hha:coach', { line:String(line||''), sub:String(sub||''), mood:String(mood||'neutral') });
  }

  function setFever(v){
    S.fever = clamp(v, 0, 100);
    try{ FeverUI.setFever?.(S.fever); }catch(_){}
    dispatchRoot('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }

  function addShield(n=1){
    S.shield = clamp((S.shield|0) + (n|0), 0, 6);
    try{ FeverUI.setShield?.(S.shield); }catch(_){}
    dispatchRoot('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }

  function stun(reason='hit'){
    const dur = 220 + ((S.fever/100) * 260);
    S.stunUntilMs = nowMs() + dur;
    tryVibrate(35);
    try{ FeverUI.stun?.(S.fever, reason); }catch(_){}
  }

  // ------------------------------ HUD events ------------------------------
  function emitScore(reason='score'){
    // ✅ HUD binder reads d.score, d.combo, d.misses, d.grade
    const payload = {
      reason,
      score: S.score|0,
      scoreFinal: S.score|0,
      combo: S.combo|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,
      fever: S.fever|0,
      shield: S.shield|0,
      grade: null
    };
    dispatchRoot('hha:score', payload);
  }

  function emitTime(){
    const payload = { timeLeftSec: Math.ceil(S.timeLeftSec|0), durationPlannedSec: S.durationPlannedSec|0 };
    dispatchRoot('hha:time', payload);
  }

  function addScore(points, why='hit'){
    S.score = (S.score|0) + (points|0);
    if (points > 0 && Particles.scorePop) Particles.scorePop(points, why);
  }

  // ------------------------------ Quest setup ------------------------------
  const goalDefs = (opts.goalDefs || DEFAULT_GOALS).map(g=>({ ...g }));
  const miniDefs = (opts.miniDefs || DEFAULT_MINIS).map(m=>({ ...m }));

  const Q = makeQuestDirector({
    diff,
    goalDefs,
    miniDefs,
    maxGoals: goalDefs.length,
    maxMini: miniDefs.length
  });

  Q.start();

  function refreshSurviveGoal(finalize=false){
    try{
      const ui = Q.getUIState('peek');
      if (!ui || !ui.goalTitle) return;
      if (String(ui.goalTitle).indexOf('อยู่รอด') < 0) return;

      const cur = S.misses|0;
      const max = S.missLimit|0;
      const ok = (cur <= max);

      Q.setGoalExternal(cur, max, finalize && ok);
    }catch(_){}
  }

  function isBossMiniActive(){
    try{
      const ui = Q.getUIState('peek');
      return !!(ui && ui.miniTitle && String(ui.miniTitle).indexOf('บอส') >= 0);
    }catch(_){}
    return false;
  }

  // ------------------------------ Boss ------------------------------
  function spawnBoss(){
    if (S.bossAlive || S.ended) return;
    S.bossAlive = true;
    S.bossHpMax = (diff === 'easy') ? 10 : (diff === 'hard' ? 14 : 12);
    S.bossHp = S.bossHpMax;

    const t = spawnTarget('boss');
    if (!t) return;
    S.bossId = t.id;
    coach('บอสโผล่! ตีให้แตกเลย 😈', 'neutral', 'ตีบอสเพื่อผ่านมินิ!');
    logEvent('spawn', { itemType:'boss', emoji:'😈' }, { kind:'boss', hp:S.bossHp, hpMax:S.bossHpMax });
  }

  function despawnBoss(){
    if (!S.bossAlive) return;
    if (S.bossId) removeTarget(S.bossId);
    S.bossAlive = false;
    S.bossId = null;
  }

  function bossTakeHit(n=1){
    if (!S.bossAlive) return;
    S.bossHp = Math.max(0, (S.bossHp|0) - (n|0));
    addScore(14, 'BOSS');
    setFever(S.fever + 4);
    stun('boss');
    emitScore('boss-hit');

    logEvent('hit',
      { targetId: null, emoji:'😈', itemType:'boss', judgment:'HIT', isGood: 1 },
      { kind:'boss', hp: S.bossHp, hpMax: S.bossHpMax }
    );

    // boss mini progress only when boss mini active
    try{
      const ui = Q.getUIState('peek');
      const miniIsBoss = !!(ui && ui.miniTitle && String(ui.miniTitle).indexOf('บอส') >= 0);
      if (miniIsBoss){
        const u = Q.addMiniProgress(1);
        const mDone = !!u.miniDone;
        if (mDone){
          Particles.celebrate?.('MINI');
          coach('Mini ผ่าน! สุดจัด ⚡', 'happy', 'ต่ออีกอันเลย!');
          Q.nextMini();
        }
      }
    }catch(_){}

    if (S.bossHp <= 0){
      coach('บอสแตกแล้ว! เก่งมาก 🔥', 'happy', 'กลับไปเก็บของดีต่อเลย!');
      logEvent('event', { itemType:'boss', judgment:'DOWN' }, { kind:'boss_down' });
      despawnBoss();
    } else {
      const t = (S.bossId && targets.get(S.bossId)) ? targets.get(S.bossId) : null;
      if (t && t.el){
        try{ t.el.textContent = (S.bossHp <= 3) ? '😡' : '😈'; }catch(_){}
      }
    }
  }

  // ------------------------------ Hit logic ------------------------------
  function tryHitTarget(id, meta = {}){
    if (S.ended || !S.started) return;
    const t = targets.get(id);
    if (!t) return;

    const tNow = nowMs();

    if (t.type === 'boss'){
      bossTakeHit(1);
      return;
    }

    // remove immediately
    removeTarget(id);

    if (t.type === 'good'){
      S.nHitGood += 1;

      // RT
      const rt = clamp(tNow - t.bornMs, 0, 9999);
      S.rtGood.push(rt);

      const base = (diff === 'easy') ? 18 : (diff === 'hard' ? 24 : 20);
      const comboBonus = Math.min(18, (S.combo|0)) * 2;
      addScore(base + comboBonus, 'GOOD');

      S.combo = (S.combo|0) + 1;
      S.comboMax = Math.max(S.comboMax|0, S.combo|0);

      setFever(S.fever + 6);

      Particles.burstAt?.(t.xView, t.yView, 'GOOD');
      logEvent('hit', { targetId: id, emoji:t.emoji, itemType:'good', judgment:'HIT', isGood:1 }, { rtMs: rt|0, via: meta.via || '' });

      const gu = Q.addGoalProgress(1);
      const gDone = !!gu.goalDone;

      // do NOT advance mini if boss mini active
      let mDone = false;
      try{
        const ui = Q.getUIState('peek');
        const miniIsBoss = !!(ui && ui.miniTitle && String(ui.miniTitle).indexOf('บอส') >= 0);
        if (!miniIsBoss){
          const mu = Q.addMiniProgress(1);
          mDone = !!mu.miniDone;
        }
      }catch(_){
        const mu = Q.addMiniProgress(1);
        mDone = !!mu.miniDone;
      }

      if (gDone){
        Particles.celebrate?.('GOAL');
        coach('Goal ผ่านแล้ว! ไปต่อ 🔥', 'happy', 'เป้าถัดไปมาแล้ว!');
        Q.nextGoal();
      }
      if (mDone){
        Particles.celebrate?.('MINI');
        coach('Mini ผ่าน! สุดจัด ⚡', 'happy', 'ต่ออีกอันเลย!');
        Q.nextMini();
      } else {
        if ((S.combo|0) % 7 === 0) coach('คอมโบมาแล้ว! ดีมาก 🔥', 'happy', 'รักษาจังหวะ!');
      }

      emitScore('good');
      refreshSurviveGoal(false);
      return;
    }

    if (t.type === 'shield'){
      addShield(1);
      addScore(10, 'SHIELD');
      Particles.burstAt?.(t.xView, t.yView, 'SHIELD');
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'shield', judgment:'HIT', isGood:1 }, { via: meta.via || '' });
      emitScore('shield');
      return;
    }

    if (t.type === 'junk' || t.type === 'trap'){
      // shield blocks junk hit -> NOT a miss
      if ((S.shield|0) > 0){
        S.nHitJunkGuard += 1;
        S.shield = Math.max(0, (S.shield|0) - 1);
        try{ FeverUI.setShield?.(S.shield); }catch(_){}
        addScore(6, 'GUARD');
        Particles.burstAt?.(t.xView, t.yView, 'GUARD');
        logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'junk', judgment:'GUARD', isGood:1 }, { via: meta.via || '' });
        emitScore('guard');
        return;
      }

      // miss: junk hit
      S.nHitJunk += 1;
      S.misses += 1;
      S.combo = 0;
      setFever(S.fever - 18);
      stun('junk');
      Particles.burstAt?.(t.xView, t.yView, 'JUNK');
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'junk', judgment:'HIT', isGood:0 }, { via: meta.via || '' });

      Q.onJunkHit();
      emitScore('junk');
      refreshSurviveGoal(false);
      return;
    }
  }

  // ------------------------------ Spawn policy (PACED) ------------------------------
  function spawnIntervalMs(ui){
    // base rate by diff
    const base =
      (diff === 'easy') ? 420 :
      (diff === 'hard') ? 320 :
      360;

    // forbidJunk minis: slightly fewer spawns (more readable)
    if (ui && ui.miniForbidJunk) return Math.round(base * 1.12);

    // boss mini: fewer spawns (focus on boss)
    if (isBossMiniActive()) return Math.round(base * 1.35);

    return base;
  }

  function spawnMix(){
    if (S.ended || !S.started) return;

    const ui = Q.getUIState('peek');
    const isBossMini = isBossMiniActive();

    if (isBossMini){
      if (!S.bossAlive) spawnBoss();
      // sprinkle a few goods so it’s not empty
      if (targets.size < 5){
        spawnTarget('good');
        if (rng() < 0.18) spawnTarget('junk');
      }
      return;
    } else {
      if (S.bossAlive) despawnBoss();
    }

    const maxOnScreen = (diff === 'easy') ? 9 : (diff === 'hard' ? 10 : 9);
    if (targets.size >= maxOnScreen) return;

    const forbidJunk = ui ? !!ui.miniForbidJunk : false;
    const junkRate   = forbidJunk ? 0.07 : (diff === 'easy' ? 0.20 : (diff === 'hard' ? 0.26 : 0.23));
    const shieldRate = 0.07;
    const goodRate   = 1.0 - junkRate - shieldRate;

    const r = rng();
    if (r < goodRate){
      spawnTarget('good');
    } else if (r < goodRate + shieldRate){
      spawnTarget('shield');
    } else {
      spawnTarget((rng() < 0.12) ? 'trap' : 'junk');
    }
  }

  // ------------------------------ Crosshair shooting ------------------------------
  function getCrosshairPoint(){
    const el = byId('gj-crosshair');
    if (el){
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    }
    return { x: (ROOT.innerWidth||0)/2, y: (ROOT.innerHeight||0)/2 };
  }

  function shoot(){
    if (!S.started || S.ended) return;

    const p = getCrosshairPoint();
    let best = null;
    let bestD = 1e9;

    for (const [id, t] of targets){
      // allow shooting boss too
      const dx = (t.xView - p.x);
      const dy = (t.yView - p.y);
      const d2 = dx*dx + dy*dy;

      // hit radius: proportional to size
      const r = (t.size * 0.55);
      if (d2 <= r*r){
        if (d2 < bestD){
          bestD = d2;
          best = id;
        }
      }
    }

    if (best != null){
      tryHitTarget(best, { via:'shoot' });
    } else {
      // no penalty (fair) — optional tiny feedback
      Particles.burstAt?.(p.x, p.y, 'MISS');
      logEvent('event', { judgment:'SHOOT_EMPTY' }, { x: Math.round(p.x), y: Math.round(p.y) });
    }
  }

  function bindShoot(){
    if (btnShoot){
      btnShoot.addEventListener('pointerup', (e)=>{ e.preventDefault(); shoot(); }, { passive:false });
      btnShoot.addEventListener('click', (e)=>{ e.preventDefault(); shoot(); }, { passive:false });
    }

    // desktop: spacebar
    DOC.addEventListener('keydown', (e)=>{
      if (e && (e.code === 'Space' || e.key === ' ')){
        e.preventDefault();
        shoot();
      }
    }, { passive:false });
  }

  // ------------------------------ End / Summary ------------------------------
  function computeStatsFinal(){
    const nGood = S.nHitGood|0;
    const nExpire = S.nExpireGood|0;
    const nJunkHit = S.nHitJunk|0;

    const denomGood = Math.max(1, nGood + nExpire);
    const accuracyGoodPct = Math.round((nGood / denomGood) * 100);

    const denomJunk = Math.max(1, (S.nHitJunk|0) + (S.nHitJunkGuard|0));
    const junkErrorPct = Math.round((nJunkHit / denomJunk) * 100);

    const rts = S.rtGood.slice().filter(v=>Number.isFinite(v));
    rts.sort((a,b)=>a-b);
    const avgRt = rts.length ? Math.round(rts.reduce((s,x)=>s+x,0)/rts.length) : 0;
    const medRt = rts.length ? Math.round(rts[(rts.length/2)|0]) : 0;
    const fastHitRatePct = rts.length ? Math.round((rts.filter(x=>x<=420).length / rts.length)*100) : 0;

    const ui = Q.getUIState('peek');

    return {
      scoreFinal: S.score|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,

      goalsCleared: (ui.goalsCleared|0),
      goalsTotal: (ui.goalsTotal|0),
      miniCleared: (ui.minisCleared|0),
      miniTotal: (ui.minisTotal|0),

      nTargetGoodSpawned: S.nTargetGoodSpawned|0,
      nTargetJunkSpawned: S.nTargetJunkSpawned|0,
      nTargetStarSpawned: S.nTargetStarSpawned|0,
      nTargetDiamondSpawned: S.nTargetDiamondSpawned|0,
      nTargetShieldSpawned: S.nTargetShieldSpawned|0,

      nHitGood: S.nHitGood|0,
      nHitJunk: S.nHitJunk|0,
      nHitJunkGuard: S.nHitJunkGuard|0,
      nExpireGood: S.nExpireGood|0,

      accuracyGoodPct,
      junkErrorPct,
      avgRtGoodMs: avgRt,
      medianRtGoodMs: medRt,
      fastHitRatePct,

      durationPlannedSec: S.durationPlannedSec|0,
      durationPlayedSec: S.durationPlayedSec|0
    };
  }

  function computeGrade(stats){
    const acc = stats.accuracyGoodPct|0;
    const miss = stats.misses|0;
    const score = stats.scoreFinal|0;
    const combo = stats.comboMax|0;

    const missPenalty = miss * 4;
    const scoreNorm = clamp(Math.round(score / 25), 0, 120);
    const value = (acc * 1.2) + (combo * 1.4) + scoreNorm - missPenalty;

    if (value >= 175 && miss <= 2) return 'SSS';
    if (value >= 155 && miss <= 3) return 'SS';
    if (value >= 135) return 'S';
    if (value >= 115) return 'A';
    if (value >= 95)  return 'B';
    return 'C';
  }

  function buildHubUrl(){
    const hub = String(q.hub || q.return || opts.hub || '../index.html');
    try{
      const u = new URL(hub, ROOT.location.href);
      const keep = ['studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode','schoolYear','semester','studentKey','schoolCode','nick','diff','run'];
      for (const k of keep){
        if (q[k] != null && !u.searchParams.has(k)) u.searchParams.set(k, String(q[k]));
      }
      u.searchParams.set('from', 'goodjunk');
      return u.toString();
    }catch(_){
      return hub;
    }
  }

  function escapeHtml(s){
    s = String(s ?? '');
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

  function statBox(label, value){
    return `<div style="border:1px solid rgba(148,163,184,.16);border-radius:16px;padding:10px;background:rgba(15,23,42,.45);">
      <div style="opacity:.78;font-size:12px;">${escapeHtml(label)}</div>
      <div style="font-weight:900;font-size:18px;margin-top:4px;">${escapeHtml(value)}</div>
    </div>`;
  }

  function saveLastSummary(payload){
    try{
      ROOT.localStorage && ROOT.localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
    }catch(_){}
  }

  function showEndSummary(payload){
    // ✅ window event for HUD freeze
    dispatchRoot('hha:end', payload);

    // optional end overlay wrapper (if your HTML has one later)
    if (!elEndWrap) return;

    const hubUrl = buildHubUrl();

    const html =
      `<div class="hha-end-card" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;">
        <div style="max-width:720px;width:min(720px,100%);background:rgba(2,6,23,.86);border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;backdrop-filter:blur(10px);box-shadow:0 20px 80px rgba(0,0,0,.45);">
          <div style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
            <div>
              <div style="font-weight:800;font-size:22px;">สรุปผล — GoodJunk VR</div>
              <div style="opacity:.78;margin-top:4px;">โหมด: ${escapeHtml(run)} • ระดับ: ${escapeHtml(diff)} • Session: ${escapeHtml(sessionId)}</div>
            </div>
            <div style="font-weight:900;font-size:32px;letter-spacing:.5px;">${escapeHtml(payload.grade || '')}</div>
          </div>

          <div style="margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
            ${statBox('คะแนน', payload.scoreFinal)}
            ${statBox('คอมโบสูงสุด', payload.comboMax)}
            ${statBox('มิส', payload.misses)}
            ${statBox('แม่นของดี', payload.accuracyGoodPct + '%')}
            ${statBox('พลาดขยะ', payload.junkErrorPct + '%')}
            ${statBox('RT เฉลี่ย', payload.avgRtGoodMs + ' ms')}
          </div>

          <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
            <a href="${escapeAttr(hubUrl)}" style="text-decoration:none;">
              <button type="button" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.16);color:#e5e7eb;font-weight:800;cursor:pointer;">
                ⬅️ กลับหน้า HUB
              </button>
            </a>
            <button type="button" data-restart style="padding:12px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.55);color:#e5e7eb;font-weight:800;cursor:pointer;">
              🔁 เล่นอีกครั้ง
            </button>
          </div>

          <div style="margin-top:10px;opacity:.78;font-size:12px;">
            Goals: ${payload.goalsCleared}/${payload.goalsTotal} • Minis: ${payload.miniCleared}/${payload.miniTotal} • Played: ${payload.durationPlayedSec}s
          </div>
        </div>
      </div>`;

    setHtml(elEndWrap, html);

    const btn = elEndWrap.querySelector('[data-restart]');
    if (btn){
      btn.addEventListener('click', () => {
        try{ ROOT.location.reload(); }catch(_){}
      }, { passive:true });
    }
  }

  function endGame(reason='time'){
    if (S.ended) return;
    S.ended = true;
    S.tEndIso = new Date().toISOString();

    refreshSurviveGoal(true);

    // compute stats
    const stats = computeStatsFinal();
    const grade = computeGrade(stats);

    const payload = {
      timestampIso: S.tEndIso,
      projectTag: String(q.projectTag || 'HHA'),
      runMode: run,
      studyId: String(q.studyId || ''),
      phase: String(q.phase || ''),
      conditionGroup: String(q.conditionGroup || ''),
      sessionOrder: String(q.sessionOrder || ''),
      blockLabel: String(q.blockLabel || ''),
      siteCode: String(q.siteCode || ''),
      schoolYear: String(q.schoolYear || ''),
      semester: String(q.semester || ''),
      sessionId,
      gameMode: 'GoodJunk',
      diff,
      durationPlannedSec: S.durationPlannedSec|0,
      durationPlayedSec: S.durationPlayedSec|0,

      ...stats,
      grade,

      device: 'web',
      gameVersion: S.gameVersion,
      reason,
      startTimeIso: S.tStartIso,
      endTimeIso: S.tEndIso,

      // pass-through profile fields
      studentKey: String(q.studentKey || ''),
      schoolCode: String(q.schoolCode || ''),
      schoolName: String(q.schoolName || ''),
      classRoom: String(q.classRoom || ''),
      studentNo: String(q.studentNo || ''),
      nickName: String(q.nickName || q.nick || ''),
      gender: String(q.gender || ''),
      age: String(q.age || ''),
      gradeLevel: String(q.gradeLevel || ''),
      heightCm: String(q.heightCm || ''),
      weightKg: String(q.weightKg || ''),
      bmi: String(q.bmi || ''),
      bmiGroup: String(q.bmiGroup || ''),
      vrExperience: String(q.vrExperience || ''),
      gameFrequency: String(q.gameFrequency || ''),
      handedness: String(q.handedness || ''),
      visionIssue: String(q.visionIssue || ''),
      healthDetail: String(q.healthDetail || ''),
      consentParent: String(q.consentParent || '')
    };

    // freeze HUD grade immediately
    dispatchRoot('hha:score', { score:S.score|0, combo:S.combo|0, misses:S.misses|0, grade });

    saveLastSummary(payload);
    showEndSummary(payload);

    logEvent('end', { reason }, { ...stats, grade });
  }

  // ------------------------------ Update loop ------------------------------
  function update(dtMs){
    if (!S.started || S.ended) return;

    // coach cooldown
    S.__coachCdMs = Math.max(0, (S.__coachCdMs|0) - (dtMs|0));

    // quest tick
    Q.tick();

    // time
    S.timeLeftSec = Math.max(0, S.timeLeftSec - (dtMs/1000));
    S.durationPlayedSec = Math.min(S.durationPlannedSec, Math.round(S.durationPlannedSec - S.timeLeftSec));

    // pressure near end time / miss limit (visual class only, CSS handles)
    const leftMiss = (S.missLimit|0) - (S.misses|0);
    if ((S.timeLeftSec <= 8 && S.timeLeftSec > 0) || (leftMiss <= 1 && leftMiss >= 0)){
      try{ DOC.body && DOC.body.classList.add('gj-panic'); }catch(_){}
    } else {
      try{ DOC.body && DOC.body.classList.remove('gj-panic'); }catch(_){}
    }

    // paced spawn
    const ui = Q.getUIState('peek');
    const interval = spawnIntervalMs(ui);
    S.__spawnAccMs = (S.__spawnAccMs|0) + (dtMs|0);
    while (S.__spawnAccMs >= interval){
      S.__spawnAccMs -= interval;
      spawnMix();
    }

    // expire targets
    const tNow = nowMs();
    for (const [id, t] of targets){
      if (t.type === 'boss') continue;
      if (tNow >= t.expireMs){
        if (t.type === 'good'){
          // miss: good expired (no stun spam)
          S.nExpireGood += 1;
          S.misses += 1;
          S.combo = 0;
          setFever(S.fever - 10);
          Particles.burstAt?.(t.xView, t.yView, 'EXPIRE');
          logEvent('miss', { targetId:id, emoji:t.emoji, itemType:'good', judgment:'EXPIRE', isGood:1 }, {});
          emitScore('expire');
          refreshSurviveGoal(false);
        }
        removeTarget(id);
      }
    }

    emitTime();

    if (S.timeLeftSec <= 0){
      endGame('time');
    }
  }

  function loop(tMs){
    if (!S.started || S.ended) return;
    const t = (typeof tMs === 'number') ? tMs : nowMs();
    if (!S.tLastMs) S.tLastMs = t;
    const dt = clamp(t - S.tLastMs, 0, 80);
    S.tLastMs = t;

    update(dt);
    ROOT.requestAnimationFrame(loop);
  }

  // ------------------------------ Click on targets (single-hit) ------------------------------
  function bindLayerClicks(){
    if (!layer) return;

    const handler = (ev) => {
      if (!S.started || S.ended) return;
      if (ev && ev.__gjHandled) return;
      if (ev) ev.__gjHandled = true;

      const el = ev.target && ev.target.closest ? ev.target.closest('.gj-target') : null;
      if (!el) return;

      const id = Number(el.dataset.tid) || 0;
      if (!id) return;

      ev.preventDefault();
      ev.stopPropagation();
      tryHitTarget(id, { via:'pointer' });
    };

    layer.addEventListener('pointerup', handler, { passive:false });
    layer.addEventListener('click', handler, { passive:false });
  }

  // ------------------------------ Start gate ------------------------------
  function startGame(){
    if (S.started) return;
    S.started = true;
    S.tStartIso = new Date().toISOString();
    S.tLastMs = 0;
    S.timeLeftSec = S.durationPlannedSec;
    S.__spawnAccMs = 0;

    setFever(10);
    addShield(0);

    coach('พร้อมลุย! เก็บของดี หลีกขยะ 🥦🚫', 'happy',
      (run === 'study') ? 'โหมดวิจัย: เงื่อนไขล็อกตามระดับ' : 'โหมดเล่น: กดยิง/กดปุ่มยิง/Spacebar');

    emitScore('start');
    emitTime();
    logEvent('start', { reason:'start' }, { durationPlannedSec: S.durationPlannedSec|0 });

    // initial spawn (few only)
    for (let i=0;i<3;i++) spawnTarget('good');
    if (rng() < 0.30) spawnTarget('shield');
    if (rng() < 0.18) spawnTarget('junk');

    refreshSurviveGoal(false);

    ROOT.requestAnimationFrame(loop);
  }

  function bindStart(){
    const go = () => {
      try{ if (startOverlay) startOverlay.style.display = 'none'; }catch(_){}
      startGame();
    };

    if (startOverlay){
      try{ startOverlay.style.display = ''; }catch(_){}
    }

    if (startBtn){
      startBtn.addEventListener('pointerup', (e)=>{ e.preventDefault(); go(); }, { passive:false });
      startBtn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, { passive:false });
    } else if (startOverlay){
      startOverlay.addEventListener('pointerup', (e)=>{ e.preventDefault(); go(); }, { passive:false });
      startOverlay.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, { passive:false });
    } else {
      go();
    }
  }

  // ------------------------------ Init ------------------------------
  bindLayerClicks();
  bindShoot();
  bindStart();

  // expose
  ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
  ROOT.GoodJunkVR.state = S;
  ROOT.GoodJunkVR.quest = Q;
  ROOT.GoodJunkVR.endGame = endGame;
  ROOT.GoodJunkVR.shoot = shoot;

  return { state:S, quest:Q, endGame, shoot };
}

// Optional auto-boot (avoid double boot with goodjunk-vr.boot.js)
try{
  if (DOC && !ROOT.__HHA_GOODJUNK_SAFE_LOADED){
    ROOT.__HHA_GOODJUNK_SAFE_LOADED = true;
  }
}catch(_){}
