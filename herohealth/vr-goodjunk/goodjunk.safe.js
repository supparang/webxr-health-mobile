// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunk VR — PRODUCTION SAFE (ESM)
// ✅ FIX: events align with /vr/hha-hud.js (score/time/coach/quest/end)
// ✅ FIX: quest:update fields goalMax/miniMax + miniTLeft + special
// ✅ FIX: stop counting misses after time end (end early return)
// ✅ ADD: Shoot button hits target near crosshair (no need click target)
// ✅ ADD: Adaptive in run=play (size/life/spawn mix), locked in run=study
// ✅ Boss mini correctness (progress only when boss mini active)
// ✅ Survive goal driven by missLimit (engine-driven)
// ✅ HHA_LAST_SUMMARY + hub return + optional logger event

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v = Number(v)||0; return v < a ? a : (v > b ? b : v); }
function clamp01(x){ x = Number(x)||0; return x < 0 ? 0 : (x > 1 ? 1 : x); }
function lerp(a,b,t){ return a + (b-a)*t; }
function nowMs(){ return (ROOT.performance && ROOT.performance.now) ? ROOT.performance.now() : Date.now(); }
function qs(sel){ return DOC ? DOC.querySelector(sel) : null; }
function byId(id){ return DOC ? DOC.getElementById(id) : null; }
function setTxt(el, t){ if(el) el.textContent = String(t ?? ''); }
function setHtml(el, html){ if(el) el.innerHTML = String(html ?? ''); }

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
  str = String(str ?? '');
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dispatchDoc(name, detail){
  try{ DOC && DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function dispatchRoot(name, detail){
  try{ ROOT && ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function tryVibrate(ms){
  try{ if (ROOT.navigator && ROOT.navigator.vibrate) ROOT.navigator.vibrate(ms); }catch(_){}
}

// optional modules
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
  { id:'m_fast',   title:'สปีดรัน! เก็บของดี 6 ชิ้น',    targetByDiff:{ easy:6, normal:7, hard:8 }, forbidJunk:false, timerSecByDiff:{ easy:0, normal:0, hard:0 }, special:'' },
  { id:'m_clean',  title:'โซนคลีน! ห้ามโดนขยะ 10 วิ',     targetByDiff:{ easy:1, normal:1, hard:1 }, forbidJunk:true,  timerSecByDiff:{ easy:10, normal:10, hard:12 }, special:'timer' },
  { id:'m_combo',  title:'คอมโบเดือด! ทำคอมโบ 8',         targetByDiff:{ easy:8, normal:9, hard:10 }, forbidJunk:false, timerSecByDiff:{ easy:0, normal:0, hard:0 }, special:'combo' },
  { id:'m_guard',  title:'โล่พร้อม! บล็อกขยะ 2 ครั้ง',     targetByDiff:{ easy:2, normal:2, hard:3 }, forbidJunk:false, timerSecByDiff:{ easy:0, normal:0, hard:0 }, special:'guard' },
  { id:'m_boss',   title:'บอสมาแล้ว! ตีบอสให้แตก',         targetByDiff:{ easy:8, normal:10, hard:12 }, forbidJunk:false, timerSecByDiff:{ easy:0, normal:0, hard:0 }, special:'boss' },
  { id:'m_focus',  title:'โฟกัส! เก็บของดี 10 ชิ้น',       targetByDiff:{ easy:9, normal:10, hard:11 }, forbidJunk:false, timerSecByDiff:{ easy:0, normal:0, hard:0 }, special:'' },
  { id:'m_clean2', title:'คลีนอีกรอบ! ห้ามโดนขยะ 12 วิ',    targetByDiff:{ easy:1, normal:1, hard:1 }, forbidJunk:true,  timerSecByDiff:{ easy:12, normal:12, hard:14 }, special:'timer' }
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
    miniIndex: 0,
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
        special: String(d.special || '')
      });
    }
    while(out.length < maxMini){
      out.push({ id:'m_auto_'+out.length, title:'Mini', cur:0, target:5, done:false, forbidJunk:false, timerSec:0, special:'' });
    }
    return out.slice(0, maxMini);
  }

  function ui(reason='state'){
    const g = Q.activeGoal;
    const m = Q.activeMini;

    const miniTLeft =
      (m && m.timerSec > 0 && Q.miniEndsAtMs > 0)
        ? Math.max(0, Math.ceil((Q.miniEndsAtMs - nowMs())/1000))
        : null;

    return {
      reason,

      goalIndex: Q.goalIndex,
      goalTitle: g ? g.title : '',
      goalCur: g ? g.cur : 0,
      goalTarget: g ? g.target : 1,
      goalMax: g ? g.target : 1, // ✅ alias for HUD
      goalDone: g ? !!g.done : false,
      goalsCleared: Q.goalsCleared,
      goalsTotal: Q.goalsAll.length,

      miniIndex: Q.miniIndex,
      miniTitle: m ? m.title : '',
      miniCur: m ? m.cur : 0,
      miniTarget: m ? m.target : 1,
      miniMax: m ? m.target : 1, // ✅ alias for HUD
      miniDone: m ? !!m.done : false,
      minisCleared: Q.minisCleared,
      minisTotal: Q.minisAll.length,

      miniForbidJunk: m ? !!m.forbidJunk : false,
      miniTimerSec: m ? (m.timerSec|0) : 0,
      miniTLeft,
      miniEndsAtMs: Q.miniEndsAtMs|0,
      miniSpecial: m ? String(m.special||'') : '',

      allDone: !!Q.allDone
    };
  }

  function push(reason){ dispatchDoc('quest:update', ui(reason)); }

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
    Q.miniIndex = 0;
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
    Q.miniIndex = clamp(Q.miniIndex + 1, 0, Q.minisAll.length);
    Q.activeMini = Q.minisAll[Q.miniIndex] || null;

    const sec = Q.activeMini ? (Q.activeMini.timerSec|0) : 0;
    Q.miniEndsAtMs = sec > 0 ? (nowMs() + sec*1000) : 0;

    push('next-mini');
  }

  function tick(){
    if (!Q.started || Q.allDone) return ui('tick-skip');

    const m = Q.activeMini;
    if (m && m.timerSec > 0 && Q.miniEndsAtMs > 0 && !m.done){
      if ((Q.miniEndsAtMs - nowMs()) <= 0){
        // timer mini passes by surviving time
        m.done = true;
        Q.minisCleared++;
        push('mini-time-done');
        checkAllDone();
        return ui('mini-time-done');
      }
    }

    // lightweight tick update (for miniTLeft)
    push('tick');
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
      return ui('goal-done');
    }
    push('goal-progress');
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
      return ui('mini-done');
    }
    push('mini-progress');
    return ui('mini-progress');
  }

  function setMiniExternal(cur, target, done=false, reason='mini-external'){
    const m = Q.activeMini;
    if(!m || Q.allDone) return ui('mini-ext-skip');
    if (target != null) m.target = Math.max(1, Number(target)||1);
    m.cur = clamp(Number(cur)||0, 0, m.target);
    if (done && !m.done){
      m.done = true;
      Q.minisCleared++;
      push(reason + ':done');
      checkAllDone();
      return ui(reason + ':done');
    }
    push(reason);
    return ui(reason);
  }

  function setGoalExternal(cur, target, done=false, reason='goal-external'){
    const g = Q.activeGoal;
    if(!g || Q.allDone) return ui('goal-ext-skip');
    if (target != null) g.target = Math.max(1, Number(target)||1);
    g.cur = clamp(Number(cur)||0, 0, g.target);
    if (done && !g.done){
      g.done = true;
      Q.goalsCleared++;
      push(reason + ':done');
      checkAllDone();
      return ui(reason + ':done');
    }
    push(reason);
    return ui(reason);
  }

  function onJunkHit(){
    const m = Q.activeMini;
    if(m && !m.done && m.forbidJunk && !Q.allDone){
      failMini('hit-junk');
    }
  }

  function getUIState(reason='peek'){ return ui(reason); }

  return {
    start, tick,
    addGoalProgress, addMiniProgress,
    setGoalExternal, setMiniExternal,
    nextGoal, nextMini,
    failMini, onJunkHit,
    getUIState
  };
}

// ------------------------------ Main Boot ------------------------------
export function boot(opts = {}){
  if (!DOC) return null;

  // guard double boot (สำคัญมาก กัน miss พุ่ง/เวลาเพี้ยน)
  if (ROOT.__HHA_GOODJUNK_SAFE_BOOTED){
    return ROOT.GoodJunkVR && ROOT.GoodJunkVR.api ? ROOT.GoodJunkVR.api : null;
  }
  ROOT.__HHA_GOODJUNK_SAFE_BOOTED = true;

  const q = { ...parseQuery(), ...(opts.query||{}) };

  const diff = String(q.diff || opts.diff || 'normal').toLowerCase();
  const run  = String(q.run  || opts.run  || 'play').toLowerCase(); // play|study
  const durationPlannedSec = clamp(Number(q.time || opts.time || 80), 20, 600);

  const seedStr = String(q.seed || q.studentKey || q.studyId || q.sid || q.nick || ('gj-'+Date.now()));
  const seed = (Number(q.seed)|0) || hash32(seedStr);
  const rng = mulberry32(seed);

  // DOM
  const stage = byId('gj-stage') || qs('#gj-stage') || DOC.body;
  const layer = byId('gj-layer') || qs('#gj-layer') || stage;

  const crosshair = byId('gj-crosshair') || qs('#gj-crosshair');
  const btnShoot = byId('btnShoot') || byId('shoot') || qs('[data-shoot]');

  const startOverlay = byId('startOverlay') || byId('start-overlay') || qs('.start-overlay');
  const btnStart = byId('btnStart') || byId('start-btn') || qs('[data-start]');

  const hudMeta = byId('hudMeta');
  const startMeta = byId('startMeta');

  const endWrap = byId('end-summary') || byId('gj-end') || qs('.gj-end') || null;

  // adaptive enable: play only; allow ?adaptive=0
  const adaptiveEnabled =
    (run === 'play') && (String(q.adaptive ?? '1') !== '0');

  // state
  const S = {
    started: false,
    ended: false,

    diff,
    runMode: run,

    durationPlannedSec: durationPlannedSec|0,
    timeLeftSec: durationPlannedSec|0,
    durationPlayedSec: 0,

    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,

    fever: 0,
    shield: 0,
    stunUntilMs: 0,

    // boss
    bossAlive: false,
    bossHp: 0,
    bossHpMax: 0,
    bossId: null,
    bossHits: 0,

    // miss limit drives survive goal
    missLimit: (diff === 'easy') ? 6 : (diff === 'hard' ? 3 : 4),

    // counters for logging
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    // rt
    rtGood: [],

    // guard mini counter
    guardBlocks: 0,

    // timing
    tLastMs: 0,
    tStartIso: '',
    tEndIso: '',

    // version
    gameVersion: String(opts.gameVersion || q.ver || 'goodjunk.safe.js@prod'),

    // adaptive metrics
    adapt: {
      enabled: adaptiveEnabled,
      skill: 0.45,
      accEma: 0.70,
      rtEma: 520,
      comboEma: 0.0,
      missEma: 0.0
    },

    // spawn timing
    spawnAccMs: 0,

    // fire timing
    shotCdMs: 0,

    // coach cooldown
    __coachCdMs: 0,

    // grade
    grade: '—'
  };

  // playfield bounds: avoid top HUD & bottom fever/control
  function getPlayRect(){
    const vw = ROOT.innerWidth || 360;
    const vh = ROOT.innerHeight || 640;

    const padTop = 118;  // HUD top+mid
    const padBot = 150;  // fever + shoot button
    const padSide = 18;

    const x0 = padSide;
    const y0 = padTop;
    const x1 = vw - padSide;
    const y1 = vh - padBot;

    const w = Math.max(160, x1 - x0);
    const h = Math.max(180, y1 - y0);

    const relax = (w < 240 || h < 240) ? 0.70 : 1.0;

    return {
      x0: x0 * relax,
      y0: y0 * relax,
      w: Math.max(160, w * relax),
      h: Math.max(180, h * relax)
    };
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

  // ------------------------------ Coach / Fever / FX ------------------------------
  function coach(line, mood='neutral', sub=''){
    if (S.__coachCdMs > 0) return;
    S.__coachCdMs = 900;
    dispatchRoot('hha:coach', { line, mood, sub });
  }

  function setFever(v){
    S.fever = clamp(v, 0, 100);
    try{ FeverUI.setFever?.(S.fever); }catch(_){}
    dispatchRoot('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }
  function setShield(v){
    S.shield = clamp(v, 0, 6);
    try{ FeverUI.setShield?.(S.shield); }catch(_){}
    dispatchRoot('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }

  function stun(reason='hit'){
    const dur = 220 + ((S.fever/100) * 260);
    S.stunUntilMs = nowMs() + dur;
    try{ DOC.body && DOC.body.classList.add('gj-stun'); }catch(_){}
    tryVibrate(35);
    try{ FeverUI.stun?.(S.fever, reason); }catch(_){}
    setTimeout(()=>{ try{ DOC.body && DOC.body.classList.remove('gj-stun'); }catch(_){} }, dur+60);
  }

  // ------------------------------ Adaptive ------------------------------
  function updateAdaptiveFromEvent(kind, rtMs=0){
    if (!S.adapt || !S.adapt.enabled) return;

    const aAcc  = 0.08;
    const aRt   = 0.10;
    const aMisc = 0.08;
    const aComb = 0.10;

    if (kind === 'good'){
      S.adapt.accEma = lerp(S.adapt.accEma, 1.0, aAcc);
      if (rtMs > 0) S.adapt.rtEma = lerp(S.adapt.rtEma, clamp(rtMs, 180, 1200), aRt);
      S.adapt.comboEma = lerp(S.adapt.comboEma, clamp01((S.comboMax|0)/18), aComb);
      S.adapt.missEma  = lerp(S.adapt.missEma, 0.0, 0.04);
    } else if (kind === 'miss'){
      S.adapt.accEma = lerp(S.adapt.accEma, 0.0, aAcc);
      S.adapt.missEma = lerp(S.adapt.missEma, 1.0, aMisc);
    } else {
      // decay miss pressure
      S.adapt.missEma = lerp(S.adapt.missEma, 0.0, 0.02);
    }

    const rtScore = clamp01((720 - (S.adapt.rtEma||520)) / 420);
    const accScore = clamp01(S.adapt.accEma);
    const comboScore = clamp01(S.adapt.comboEma);
    const missScore = clamp01(1.0 - S.adapt.missEma);

    const raw =
      (0.45*accScore) +
      (0.25*rtScore) +
      (0.20*comboScore) +
      (0.10*missScore);

    S.adapt.skill = lerp(S.adapt.skill, clamp01(raw), 0.10);

    dispatchRoot('hha:adaptive', {
      enabled: true,
      skill: Math.round(S.adapt.skill*100),
      acc: Math.round(accScore*100),
      rt: Math.round(S.adapt.rtEma||0),
      combo: Math.round(comboScore*100),
      missP: Math.round((1-missScore)*100)
    });
  }

  function adaptSize(px){
    if (!S.adapt || !S.adapt.enabled) return px;
    const k = clamp01(S.adapt.skill);
    const minScale = (diff==='easy') ? 0.92 : (diff==='hard' ? 0.82 : 0.86);
    const maxScale = (diff==='easy') ? 1.18 : (diff==='hard' ? 1.08 : 1.12);
    const scale = clamp(lerp(maxScale, minScale, k), 0.78, 1.22);
    return px * scale;
  }

  function adaptLife(ms){
    if (!S.adapt || !S.adapt.enabled) return ms;
    const k = clamp01(S.adapt.skill);
    const scale = lerp(1.10, 0.88, k);
    return Math.round(ms * scale);
  }

  // ------------------------------ Targets ------------------------------
  const targets = new Map();
  let nextId = 1;

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
    el.style.border = '1px solid rgba(148,163,184,.25)';
    el.style.background = 'rgba(2,6,23,.40)';
    el.style.backdropFilter = 'blur(6px)';
    el.style.fontSize = Math.max(18, (t.size * 0.55)) + 'px';
    el.style.lineHeight = t.size + 'px';
    el.style.textAlign = 'center';
    el.style.boxShadow = '0 10px 30px rgba(0,0,0,.35)';

    // subtle float (visual only, does not change hit box)
    el.style.animation = 'gjFloat 1.8s ease-in-out infinite';
    el.style.animationDelay = ((Math.random()*800)|0) + 'ms';

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
      el.style.animation = 'gjBossPulse .9s ease-in-out infinite';
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

    const baseSize0 = (diff === 'easy') ? 66 : (diff === 'hard' ? 54 : 60);
    let size = baseSize0 + (rng()*10 - 5);

    if (type === 'boss') size = (diff === 'easy') ? 120 : (diff === 'hard' ? 108 : 114);

    size = adaptSize(size);
    size = clamp(size, 44, 140);

    const x = rect.x0 + rng()*rect.w;
    const y = rect.y0 + rng()*rect.h;

    const id = nextId++;
    const tNow = nowMs();

    let lifeMs =
      (type === 'good') ? ((diff === 'easy') ? 3000 : (diff === 'hard' ? 2400 : 2700)) :
      (type === 'junk' || type === 'trap') ? ((diff === 'easy') ? 3200 : (diff === 'hard' ? 2600 : 2900)) :
      (type === 'shield') ? 3200 :
      (type === 'boss') ? 999999 :
      3000;

    lifeMs = (type === 'boss') ? lifeMs : adaptLife(lifeMs);

    const emoji =
      (type === 'good') ? ['🍎','🥦','🥕','🍌','🍇','🍊','🍉','🥗'][(rng()*8)|0] :
      (type === 'junk') ? ['🍟','🍔','🍩','🍭','🥤','🍰'][(rng()*6)|0] :
      (type === 'trap') ? ['🧨','💣','🪤'][(rng()*3)|0] :
      (type === 'shield') ? '🛡️' :
      (type === 'boss') ? '😈' :
      '❓';

    const t = { id, type, emoji, xView:x, yView:y, size, bornMs:tNow, expireMs:tNow + lifeMs, el:null };
    t.el = makeElTarget(t);
    targets.set(id, t);
    try{ layer.appendChild(t.el); }catch(_){}

    if (type === 'good') S.nTargetGoodSpawned++;
    if (type === 'junk' || type === 'trap') S.nTargetJunkSpawned++;
    if (type === 'shield') S.nTargetShieldSpawned++;

    return t;
  }

  // boss
  function spawnBoss(){
    if (S.bossAlive || S.ended) return;
    S.bossAlive = true;
    S.bossHpMax = (diff === 'easy') ? 10 : (diff === 'hard' ? 14 : 12);
    S.bossHp = S.bossHpMax;
    S.bossHits = 0;

    const t = spawnTarget('boss');
    if (!t) return;
    S.bossId = t.id;

    coach('บอสโผล่! ตีให้แตกเลย 😈', 'neutral', 'มินิบอส: ยิงใส่บอสให้ครบ');
    logEvent('spawn', { itemType:'boss', emoji:'😈' }, { kind:'boss', hp:S.bossHp, hpMax:S.bossHpMax });
  }

  function despawnBoss(){
    if (!S.bossAlive) return;
    if (S.bossId) removeTarget(S.bossId);
    S.bossAlive = false;
    S.bossId = null;
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

  function isBossMiniActive(){
    const ui = Q.getUIState('peek');
    return ui && ui.miniSpecial === 'boss';
  }

  function refreshSurviveGoal(finalize=false){
    const ui = Q.getUIState('peek');
    if (!ui || ui.goalTitle.indexOf('อยู่รอด') < 0) return;
    const cur = S.misses|0;
    const max = S.missLimit|0;
    const ok = (cur <= max);
    Q.setGoalExternal(cur, max, finalize && ok, 'survive');
  }

  function maybeAdvanceMiniIfDone(){
    const ui = Q.getUIState('peek');
    if (ui && ui.miniDone){
      Particles.celebrate?.('MINI');
      coach('Mini ผ่าน! สุดจัด ⚡', 'happy', 'ต่ออีกอันเลย!');
      Q.nextMini();
    }
  }

  function maybeAdvanceGoalIfDone(){
    const ui = Q.getUIState('peek');
    if (ui && ui.goalDone){
      Particles.celebrate?.('GOAL');
      coach('Goal ผ่านแล้ว! ไปต่อ 🔥', 'happy', 'เป้าถัดไปมาแล้ว!');
      Q.nextGoal();
    }
  }

  // ------------------------------ HUD events ------------------------------
  function emitScore(reason='score'){
    dispatchRoot('hha:score', {
      reason,
      score: S.score|0,     // ✅ HUD expects score
      combo: S.combo|0,
      misses: S.misses|0,
      grade: S.grade
    });
  }

  function emitTime(){
    dispatchRoot('hha:time', { timeLeftSec: Math.ceil(S.timeLeftSec) });
  }

  // ------------------------------ Hit logic ------------------------------
  function addScore(points, why='hit'){
    S.score = (S.score|0) + (points|0);
    if (points > 0 && Particles.scorePop) Particles.scorePop(points, why);
  }

  function onGoodHit(t){
    S.nHitGood += 1;

    const rt = clamp(nowMs() - t.bornMs, 0, 9999);
    S.rtGood.push(rt);
    updateAdaptiveFromEvent('good', rt);

    const base = (diff === 'easy') ? 18 : (diff === 'hard' ? 24 : 20);
    const comboBonus = Math.min(18, (S.combo|0)) * 2;
    addScore(base + comboBonus, 'GOOD');

    S.combo = (S.combo|0) + 1;
    S.comboMax = Math.max(S.comboMax|0, S.combo|0);

    setFever(S.fever + 6);
    Particles.burstAt?.(t.xView, t.yView, 'GOOD');
    logEvent('hit', { targetId:t.id, emoji:t.emoji, itemType:'good', judgment:'HIT', isGood:1 }, { rtMs: rt|0 });

    // Goal 1: collect goods
    Q.addGoalProgress(1);
    maybeAdvanceGoalIfDone();

    // Mini progress by special
    const ui = Q.getUIState('peek');
    if (!ui || ui.allDone) { emitScore(); refreshSurviveGoal(false); return; }

    if (ui.miniSpecial === 'boss'){
      // do nothing here
    } else if (ui.miniSpecial === 'timer'){
      // do nothing (timer tick handles)
    } else if (ui.miniSpecial === 'combo'){
      Q.setMiniExternal(S.combo|0, ui.miniMax|0, (S.combo|0) >= (ui.miniMax|0), 'mini-combo');
      maybeAdvanceMiniIfDone();
    } else {
      // normal mini counts goods
      Q.addMiniProgress(1);
      maybeAdvanceMiniIfDone();
    }

    // coach pop
    if ((S.combo|0) % 7 === 0) coach('คอมโบมาแล้ว! ดีมาก 🔥', 'happy', 'รักษาจังหวะ!');

    emitScore();
    refreshSurviveGoal(false);
  }

  function onShieldHit(t){
    setShield((S.shield|0) + 1);
    addScore(10, 'SHIELD');
    Particles.burstAt?.(t.xView, t.yView, 'SHIELD');
    logEvent('hit', { targetId:t.id, emoji:t.emoji, itemType:'shield', judgment:'HIT', isGood:1 }, {});
    emitScore();
  }

  function onJunkHit(t){
    // shield blocks -> NOT a miss
    if ((S.shield|0) > 0){
      S.nHitJunkGuard += 1;
      S.guardBlocks = (S.guardBlocks|0) + 1;
      setShield((S.shield|0) - 1);

      addScore(6, 'GUARD');
      Particles.burstAt?.(t.xView, t.yView, 'GUARD');
      logEvent('hit', { targetId:t.id, emoji:t.emoji, itemType:'junk', judgment:'GUARD', isGood:1 }, { guardBlocks:S.guardBlocks|0 });

      // guard mini
      const ui = Q.getUIState('peek');
      if (ui && ui.miniSpecial === 'guard'){
        Q.setMiniExternal(S.guardBlocks|0, ui.miniMax|0, (S.guardBlocks|0) >= (ui.miniMax|0), 'mini-guard');
        maybeAdvanceMiniIfDone();
      }

      emitScore();
      return;
    }

    // miss
    S.nHitJunk += 1;
    S.misses += 1;
    S.combo = 0;
    setFever(S.fever - 18);
    stun('junk');
    Particles.burstAt?.(t.xView, t.yView, 'JUNK');
    logEvent('hit', { targetId:t.id, emoji:t.emoji, itemType:'junk', judgment:'HIT', isGood:0 }, {});
    updateAdaptiveFromEvent('miss', 0);

    Q.onJunkHit(); // fail timer forbid-junk minis
    emitScore();
    refreshSurviveGoal(false);
  }

  function bossTakeHit(n=1){
    if (!S.bossAlive || S.ended) return;
    S.bossHp = Math.max(0, (S.bossHp|0) - (n|0));
    S.bossHits = (S.bossHits|0) + 1;

    addScore(14, 'BOSS');
    setFever(S.fever + 4);
    stun('boss');
    emitScore();

    logEvent('hit', { targetId:null, emoji:'😈', itemType:'boss', judgment:'HIT', isGood:1 }, { kind:'boss', hp:S.bossHp, hpMax:S.bossHpMax, hits:S.bossHits|0 });

    // boss mini progress ONLY when boss mini active
    const ui = Q.getUIState('peek');
    if (ui && ui.miniSpecial === 'boss'){
      Q.setMiniExternal(S.bossHits|0, ui.miniMax|0, (S.bossHits|0) >= (ui.miniMax|0), 'mini-boss');
      maybeAdvanceMiniIfDone();
    }

    if (S.bossHp <= 0){
      coach('บอสแตกแล้ว! เก่งมาก 🔥', 'happy', 'กลับไปเก็บของดีต่อเลย!');
      logEvent('event', { itemType:'boss', judgment:'DOWN' }, { kind:'boss_down' });
      despawnBoss();
    } else {
      // emoji feedback
      const t = (S.bossId && targets.get(S.bossId)) ? targets.get(S.bossId) : null;
      if (t && t.el){
        try{ t.el.textContent = (S.bossHp <= 3) ? '😡' : '😈'; }catch(_){}
      }
    }
  }

  function tryHitTarget(id){
    if (S.ended || !S.started) return;
    const t = targets.get(id);
    if (!t) return;

    if (t.type === 'boss'){
      bossTakeHit(1);
      return;
    }

    removeTarget(id);

    if (t.type === 'good') return onGoodHit(t);
    if (t.type === 'shield') return onShieldHit(t);
    if (t.type === 'junk' || t.type === 'trap') return onJunkHit(t);
  }

  // ------------------------------ Shoot by Crosshair ------------------------------
  function getAimPoint(){
    if (crosshair){
      const r = crosshair.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    }
    return { x: (ROOT.innerWidth||360)/2, y: (ROOT.innerHeight||640)/2 };
  }

  function shoot(){
    if (!S.started || S.ended) return;
    if (S.shotCdMs > 0) return;

    S.shotCdMs = 110; // fire rate
    const p = getAimPoint();

    let bestId = 0;
    let bestD = 1e9;

    for (const [id, t] of targets){
      if (!t.el) continue;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;

      const dx = cx - p.x;
      const dy = cy - p.y;
      const d = Math.sqrt(dx*dx + dy*dy);

      const hitR = (Math.min(r.width, r.height) * 0.50) + 14; // generous for mobile/drag world
      if (d <= hitR && d < bestD){
        bestD = d;
        bestId = id;
      }
    }

    if (bestId){
      tryHitTarget(bestId);
    } else {
      // small penalty? (optional) keep fair: no miss on empty shot
      Particles.burstAt?.(p.x, p.y, 'MISS');
    }
  }

  // ------------------------------ Spawn policy ------------------------------
  function spawnMixOnce(){
    if (S.ended || !S.started) return;

    // boss mini: ensure boss exists + reduce clutter
    if (isBossMiniActive()){
      if (!S.bossAlive) spawnBoss();
      if (targets.size < 5){
        spawnTarget('good');
        if (rng() < 0.25) spawnTarget('junk');
      }
      return;
    } else {
      if (S.bossAlive) despawnBoss();
    }

    const ui = Q.getUIState('peek');
    const forbidJunk = ui ? !!ui.miniForbidJunk : false;

    // base limits by diff
    const baseMax = (diff === 'easy') ? 9 : (diff === 'hard' ? 10 : 9);

    // adaptive: skilled -> slightly more clutter
    const k = (S.adapt && S.adapt.enabled) ? clamp01(S.adapt.skill) : 0.5;
    const maxOnScreen = clamp(Math.round(baseMax + (S.adapt.enabled ? lerp(-1, +2, k) : 0)), 7, 12);

    if (targets.size >= maxOnScreen) return;

    // rates
    let junkRate = forbidJunk ? 0.06 : (diff === 'easy' ? 0.22 : (diff === 'hard' ? 0.28 : 0.24));
    let shieldRate = 0.07;
    let goodRate = 1.0 - junkRate - shieldRate;

    // adaptive: low skill -> safer (more shield / less junk)
    if (S.adapt.enabled){
      const safer = lerp(0.18, -0.10, k); // low k => +0.18 safer; high k => -0.10 harder
      junkRate = clamp(junkRate - safer, 0.05, 0.40);
      shieldRate = clamp(shieldRate + safer*0.6, 0.04, 0.16);
      goodRate = clamp(1.0 - junkRate - shieldRate, 0.40, 0.92);
    }

    const r = rng();
    if (r < goodRate){
      spawnTarget('good');
    } else if (r < goodRate + shieldRate){
      spawnTarget('shield');
    } else {
      spawnTarget((rng() < 0.12) ? 'trap' : 'junk');
    }
  }

  function getSpawnIntervalMs(){
    const base = (diff === 'easy') ? 260 : (diff === 'hard' ? 200 : 220);
    if (!S.adapt.enabled) return base;
    const k = clamp01(S.adapt.skill);
    // skilled -> faster spawn a bit
    return Math.round(lerp(base + 60, base - 30, k));
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

  function saveLastSummary(payload){
    try{ ROOT.localStorage && ROOT.localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload)); }catch(_){}
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

  function showEndSummary(payload){
    dispatchRoot('hha:end', payload);

    if (!endWrap) return;

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

    setHtml(endWrap, html);

    const btn = endWrap.querySelector('[data-restart]');
    if (btn){
      btn.addEventListener('click', () => { try{ ROOT.location.reload(); }catch(_){} }, { passive:true });
    }
  }

  function endGame(reason='time'){
    if (S.ended) return;
    S.ended = true;
    S.tEndIso = new Date().toISOString();

    // freeze survive goal if active
    refreshSurviveGoal(true);

    try{ DOC.body && DOC.body.classList.remove('gj-panic'); }catch(_){}
    try{ DOC.body && DOC.body.classList.remove('gj-stun'); }catch(_){}

    const stats = computeStatsFinal();
    S.grade = computeGrade(stats);

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

      ...stats,
      grade: S.grade,

      device: 'web',
      gameVersion: S.gameVersion,
      reason,
      startTimeIso: S.tStartIso,
      endTimeIso: S.tEndIso,

      // pass-through study profile fields
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

    saveLastSummary(payload);
    showEndSummary(payload);

    // final hud grade
    emitScore('end');

    logEvent('end', { reason }, { ...stats, grade:S.grade });
  }

  // ------------------------------ Update loop ------------------------------
  function update(dtMs){
    if (!S.started || S.ended) return;

    S.__coachCdMs = Math.max(0, (S.__coachCdMs|0) - (dtMs|0));
    S.shotCdMs = Math.max(0, (S.shotCdMs|0) - (dtMs|0));

    // tick quest (timer minis)
    Q.tick();

    // time first (IMPORTANT: stop immediately when ends)
    S.timeLeftSec = Math.max(0, S.timeLeftSec - (dtMs/1000));
    S.durationPlayedSec = Math.min(S.durationPlannedSec, Math.round(S.durationPlannedSec - S.timeLeftSec));

    if (S.timeLeftSec <= 0){
      emitTime();
      endGame('time');
      return;
    }

    // panic near end + near miss limit
    const leftMiss = (S.missLimit|0) - (S.misses|0);
    if ((S.timeLeftSec <= 8 && S.timeLeftSec > 0) || (leftMiss <= 1 && leftMiss >= 0)){
      try{ DOC.body && DOC.body.classList.add('gj-panic'); }catch(_){}
    } else {
      try{ DOC.body && DOC.body.classList.remove('gj-panic'); }catch(_){}
    }

    updateAdaptiveFromEvent('tick', 0);

    // spawn with interval
    S.spawnAccMs += dtMs;
    const itv = getSpawnIntervalMs();
    while (S.spawnAccMs >= itv){
      S.spawnAccMs -= itv;
      spawnMixOnce();
      if (targets.size > 14) break;
    }

    // expire targets (not boss)
    const tNow = nowMs();
    for (const [id, t] of targets){
      if (t.type === 'boss') continue;
      if (tNow >= t.expireMs){
        if (t.type === 'good'){
          S.nExpireGood += 1;
          S.misses += 1;
          S.combo = 0;
          setFever(S.fever - 12);
          stun('expire');
          logEvent('miss', { targetId:id, emoji:t.emoji, itemType:'good', judgment:'EXPIRE', isGood:1 }, {});
          updateAdaptiveFromEvent('miss', 0);
          refreshSurviveGoal(false);
          emitScore('expire');
        }
        removeTarget(id);
      }
    }

    emitTime();
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

  // ------------------------------ Input binding ------------------------------
  function bindLayerClicks(){
    if (!layer) return;

    const handler = (ev) => {
      if (!S.started || S.ended) return;
      const el = ev.target && ev.target.closest ? ev.target.closest('.gj-target') : null;
      if (!el) return;
      const id = Number(el.dataset.tid) || 0;
      if (!id) return;
      ev.preventDefault();
      ev.stopPropagation();
      tryHitTarget(id);
    };

    layer.addEventListener('pointerup', handler, { passive:false });
    layer.addEventListener('click', handler, { passive:false });
  }

  function bindShoot(){
    if (btnShoot){
      btnShoot.addEventListener('pointerdown', (e)=>{ e.preventDefault(); shoot(); }, { passive:false });
      btnShoot.addEventListener('click', (e)=>{ e.preventDefault(); shoot(); }, { passive:false });
    }

    // keyboard
    DOC.addEventListener('keydown', (e)=>{
      if (e.code === 'Space'){
        e.preventDefault();
        shoot();
      }
    }, { passive:false });
  }

  // ------------------------------ Start gate ------------------------------
  function startGame(){
    if (S.started) return;
    S.started = true;
    S.tStartIso = new Date().toISOString();
    S.tLastMs = 0;
    S.timeLeftSec = S.durationPlannedSec;

    // meta
    const metaText = `diff=${diff} • run=${run} • time=${S.durationPlannedSec}s • adaptive=${S.adapt.enabled ? 'on' : 'off'}`;
    if (hudMeta) setTxt(hudMeta, metaText);
    if (startMeta) setTxt(startMeta, metaText);

    // initial
    setFever(10);
    setShield(0);

    coach('พร้อมลุย! เก็บของดี หลีกขยะ 🥦🚫', 'happy',
      (run === 'study') ? 'โหมดวิจัย: ล็อกตาม diff (ไม่ adaptive)' : 'โหมดเล่น: adaptive ปรับตามฝีมือ');

    emitScore('start');
    emitTime();

    logEvent('start', { reason:'start' }, { durationPlannedSec: S.durationPlannedSec|0 });

    // prime spawns
    for (let i=0;i<3;i++) spawnTarget('good');
    if (rng() < 0.30) spawnTarget('shield');
    if (rng() < 0.18) spawnTarget('junk');

    refreshSurviveGoal(false);

    ROOT.requestAnimationFrame(loop);
  }

  function bindStart(){
    if (!startOverlay && !btnStart){
      startGame();
      return;
    }

    try{ if (startOverlay) startOverlay.style.display = ''; }catch(_){}

    const go = () => {
      try{ if (startOverlay) startOverlay.style.display = 'none'; }catch(_){}
      startGame();
    };

    if (btnStart){
      btnStart.addEventListener('pointerup', (e)=>{ e.preventDefault(); go(); }, { passive:false });
      btnStart.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, { passive:false });
    } else if (startOverlay){
      startOverlay.addEventListener('pointerup', (e)=>{ e.preventDefault(); go(); }, { passive:false });
      startOverlay.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, { passive:false });
    }
  }

  // ------------------------------ Init ------------------------------
  // CSS keyframes inject (safe)
  try{
    const style = DOC.createElement('style');
    style.textContent = `
      @keyframes gjFloat { 0%,100%{ transform:translate(-50%,-50%) translateY(0px) } 50%{ transform:translate(-50%,-50%) translateY(-6px) } }
      @keyframes gjBossPulse { 0%,100%{ transform:translate(-50%,-50%) scale(1) } 50%{ transform:translate(-50%,-50%) scale(1.05) } }
    `;
    DOC.head && DOC.head.appendChild(style);
  }catch(_){}

  bindLayerClicks();
  bindShoot();
  bindStart();

  // expose
  ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
  const api = { state:S, quest:Q, endGame, shoot };
  ROOT.GoodJunkVR.api = api;

  return api;
}
