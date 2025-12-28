// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
/* HeroHealth — GoodJunk VR (PRODUCTION SAFE)
   FIX PACK:
   ✅ HUD events fixed (dispatch to window; correct field names)
   ✅ quest:update payload matches hha-hud.js
   ✅ Coach payload matches hha-hud.js (line/sub/mood)
   ✅ Mouse click works (pointerdown + pointerup + click) + force pointer-events
   ✅ Shoot button + Spacebar shoots at crosshair (DOM hit-test)
   ✅ Warmup 3s (play only) + ramp faster + cap on-screen
   ✅ Adaptive ONLY in play; research locked by diff + deterministic seed
   ✅ Spawn is timer-based (no per-frame spam) — prevents "targets flood"
   ✅ Safe spawn margins avoid HUD; auto-relax if rect too small
   Grade: SSS, SS, S, A, B, C
*/
'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v = Number(v)||0; return v < a ? a : (v > b ? b : v); }
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

function emitWin(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function emitDoc(name, detail){
  try{ DOC && DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
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
  { id:'m_fast',   title:'สปีดรัน! เก็บของดี 6 ชิ้น', targetByDiff:{ easy:6, normal:7, hard:8 }, forbidJunk:false },
  { id:'m_clean',  title:'โซนคลีน! ห้ามโดนขยะ 10 วิ', targetByDiff:{ easy:1, normal:1, hard:1 }, forbidJunk:true,  timerSecByDiff:{ easy:10, normal:10, hard:12 } },
  { id:'m_combo',  title:'คอมโบเดือด! ทำคอมโบ 8',    targetByDiff:{ easy:8, normal:9, hard:10 }, forbidJunk:false, special:'combo' },
  { id:'m_guard',  title:'โล่พร้อม! บล็อกขยะ 2 ครั้ง', targetByDiff:{ easy:2, normal:2, hard:3 }, forbidJunk:false, special:'guard' },
  { id:'m_boss',   title:'บอสมาแล้ว! ตีบอสให้แตก',    targetByDiff:{ easy:8, normal:10, hard:12 }, forbidJunk:false, special:'boss' },
  { id:'m_focus',  title:'โฟกัส! เก็บของดี 10 ชิ้น',   targetByDiff:{ easy:9, normal:10, hard:11 }, forbidJunk:false },
  { id:'m_clean2', title:'คลีนอีกรอบ! ห้ามโดนขยะ 12 วิ', targetByDiff:{ easy:1, normal:1, hard:1 }, forbidJunk:true, timerSecByDiff:{ easy:12, normal:12, hard:14 } }
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
      const d = goalDefs[i];
      const t = (d && d.targetByDiff) ? d.targetByDiff[diff] : d.target;
      out.push({
        id: d.id || ('g'+i),
        title: d.title || 'Goal',
        cur: 0,
        target: Math.max(1, Number(t)||1),
        done: false
      });
    }
    while(out.length < maxGoals) out.push({ id:'g_auto_'+out.length, title:'Goal', cur:0, target:10, done:false });
    return out.slice(0, maxGoals);
  }

  function buildMinis(){
    const out = [];
    for (let i=0;i<miniDefs.length;i++){
      const d = miniDefs[i];
      const t = (d && d.targetByDiff) ? d.targetByDiff[diff] : d.target;
      const timer = (d && d.timerSecByDiff) ? d.timerSecByDiff[diff] : d.timerSec;
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
    while(out.length < maxMini) out.push({ id:'m_auto_'+out.length, title:'Mini', cur:0, target:5, done:false, forbidJunk:false, timerSec:0, special:'' });
    return out.slice(0, maxMini);
  }

  function ui(reason='state'){
    const mLeft = (Q.activeMini && Q.activeMini.timerSec > 0 && Q.miniEndsAtMs > 0)
      ? Math.max(0, Math.ceil((Q.miniEndsAtMs - nowMs()) / 1000))
      : 0;

    return {
      reason,

      // match hha-hud.js
      goalTitle: Q.activeGoal ? Q.activeGoal.title : '',
      goalCur:   Q.activeGoal ? Q.activeGoal.cur : 0,
      goalMax:   Q.activeGoal ? Q.activeGoal.target : 0,

      miniTitle: Q.activeMini ? Q.activeMini.title : '',
      miniCur:   Q.activeMini ? Q.activeMini.cur : 0,
      miniMax:   Q.activeMini ? Q.activeMini.target : 0,
      miniTLeft: mLeft,

      miniForbidJunk: Q.activeMini ? !!Q.activeMini.forbidJunk : false,

      goalsCleared: Q.goalsCleared,
      goalsTotal:   Q.goalsAll.length,
      minisCleared: Q.minisCleared,
      minisTotal:   Q.minisAll.length,

      allDone: !!Q.allDone
    };
  }

  function push(reason){
    emitDoc('quest:update', ui(reason));
  }

  function setMiniTimer(){
    const sec = Q.activeMini ? (Q.activeMini.timerSec|0) : 0;
    Q.miniEndsAtMs = sec > 0 ? (nowMs() + sec*1000) : 0;
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
    setMiniTimer();
    push('start');
  }

  function checkAllDone(){
    if (Q.allDone) return;
    if (Q.goalsCleared >= Q.goalsAll.length && Q.minisCleared >= Q.minisAll.length){
      Q.allDone = true;
      push('all-done');
    }
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
    setMiniTimer();
    push('next-mini');
  }

  function tick(){
    if (!Q.started || Q.allDone) return ui('tick-skip');
    if (Q.activeMini && Q.activeMini.timerSec > 0 && Q.miniEndsAtMs > 0){
      const leftMs = Q.miniEndsAtMs - nowMs();
      if (leftMs <= 0 && !Q.activeMini.done){
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
    setMiniTimer();
    push('mini-fail:' + reason);
    return ui('mini-fail');
  }

  function addGoalProgress(n=1){
    const g = Q.activeGoal;
    if(!g || g.done || Q.allDone) return { ...ui('goal-skip'), goalDone:false };
    g.cur = clamp(g.cur + (n|0), 0, g.target);
    let goalDone = false;
    if (g.cur >= g.target && !g.done){
      g.done = true;
      Q.goalsCleared++;
      goalDone = true;
      push('goal-done');
      checkAllDone();
    } else {
      push('goal-progress');
    }
    return { ...ui('goal-progress'), goalDone };
  }

  function addMiniProgress(n=1){
    const m = Q.activeMini;
    if(!m || m.done || Q.allDone) return { ...ui('mini-skip'), miniDone:false };
    m.cur = clamp(m.cur + (n|0), 0, m.target);
    let miniDone = false;
    if (m.cur >= m.target && !m.done){
      m.done = true;
      Q.minisCleared++;
      miniDone = true;
      push('mini-done');
      checkAllDone();
    } else {
      push('mini-progress');
    }
    return { ...ui('mini-progress'), miniDone };
  }

  function onJunkHit(){
    const m = Q.activeMini;
    if(m && !m.done && m.forbidJunk && !Q.allDone){
      failMini('hit-junk');
    }
  }

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

  return { start, tick, addGoalProgress, addMiniProgress, nextGoal, nextMini, failMini, onJunkHit, setGoalExternal, getUIState };
}

// ------------------------------ Main Boot ------------------------------
export function boot(opts = {}){
  if (!DOC) return;

  // merge URL query + context passed from boot.js
  const qUrl = parseQuery();
  const ctx  = (opts.context && typeof opts.context === 'object') ? opts.context : {};
  const q = { ...qUrl, ...ctx, ...(opts.query||{}) };

  const diff = String(opts.diff || q.diff || 'normal').toLowerCase();
  const runRaw  = String(opts.run || q.run || 'play').toLowerCase(); // play|research (study alias)
  const run = (runRaw === 'research' || runRaw === 'study') ? 'research' : 'play';

  const durationPlannedSec = clamp(Number(opts.time ?? q.time ?? 80), 20, 600) | 0;

  // deterministic seed
  const seedStr = String(opts.seed || q.seed || q.studentKey || q.studyId || q.sid || q.nickName || q.nick || ('gj-'+Date.now()));
  const seed = (Number(opts.seed)|0) || (Number(q.seed)|0) || hash32(seedStr);
  const rng = mulberry32(seed);

  // DOM refs
  const layer = opts.layerEl || byId('gj-layer') || qs('#gj-layer') || DOC.body;
  const shootEl = opts.shootEl || byId('btnShoot') || qs('[data-shoot]') || null;
  const crosshairEl = byId('gj-crosshair') || qs('#gj-crosshair') || null;

  const elEndWrap = byId('end-summary') || byId('gj-end') || qs('.gj-end') || null;

  // ensure clickable layer/targets (CSS failsafe)
  (function ensureClickableCSS(){
    if (byId('gj-safe-style')) return;
    const st = DOC.createElement('style');
    st.id = 'gj-safe-style';
    st.textContent = `
      #gj-layer{ position:absolute; inset:0; pointer-events:auto; touch-action:manipulation; }
      .gj-target{ pointer-events:auto; cursor:pointer; user-select:none; -webkit-user-select:none; }
    `;
    try{ DOC.head.appendChild(st); }catch(_){}
  })();

  // ---------- Difficulty baselines ----------
  function baseByDiff(d){
    d = String(d||'normal');
    if (d === 'easy')   return { baseSpawn: 380, baseCap: 7, baseTTL: 2500, baseSize: 66, junk: 0.20, shield: 0.08 };
    if (d === 'hard')   return { baseSpawn: 310, baseCap: 9, baseTTL: 2100, baseSize: 54, junk: 0.26, shield: 0.07 };
    return               { baseSpawn: 340, baseCap: 8, baseTTL: 2300, baseSize: 60, junk: 0.23, shield: 0.075 };
  }
  const B = baseByDiff(diff);

  // ---------- State ----------
  const S = {
    started:false,
    ended:false,

    tStartMs: 0,
    tLastMs: 0,

    timeLeftSec: durationPlannedSec,
    durationPlannedSec,
    durationPlayedSec: 0,

    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0, // miss = expire good + junk hit (unblocked)

    // counters
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    rtGood: [],

    fever: 0,
    shield: 0,
    stunUntilMs: 0,

    bossAlive:false,
    bossHp:0,
    bossHpMax:0,
    bossId:null,

    diff,
    runMode: run,

    missLimit: (diff === 'easy') ? 6 : (diff === 'hard' ? 3 : 4),

    // spawn scheduling
    spawnAccMs: 0,
    spawnMsCur: B.baseSpawn,
    capCur: B.baseCap,
    ttlCur: B.baseTTL,
    sizeCur: B.baseSize,
    junkCur: B.junk,
    shieldCur: B.shield,

    // play adaptive
    skillEma: 0.0,

    // coach cooldown
    __coachCdMs: 0,

    // version/meta
    gameVersion: String(opts.gameVersion || q.gameVersion || q.ver || 'goodjunk.safe.js@prod'),
  };

  // targets
  const targets = new Map();
  let nextId = 1;

  // ---------- Safe play rect (avoid HUD) ----------
  function getPlayRect(){
    const vw = ROOT.innerWidth || 360;
    const vh = ROOT.innerHeight || 640;

    const m = opts.safeMargins || { top: 128, bottom: 170, left: 26, right: 26 };

    let x0 = Number(m.left)||26;
    let y0 = Number(m.top)||128;
    let x1 = vw - (Number(m.right)||26);
    let y1 = vh - (Number(m.bottom)||170);

    let w = Math.max(120, x1 - x0);
    let h = Math.max(140, y1 - y0);

    // auto-relax if too small (prevents "spawn same spot")
    const relax = (w < 220 || h < 220) ? 0.62 : 1.0;

    x0 *= relax; y0 *= relax;
    x1 = vw - ((Number(m.right)||26) * relax);
    y1 = vh - ((Number(m.bottom)||170) * relax);

    w = Math.max(120, x1 - x0);
    h = Math.max(140, y1 - y0);

    return { x0, y0, x1, y1, w, h, vw, vh };
  }

  // ---------- Target DOM ----------
  function makeElTarget(t){
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'gj-target gj-' + t.type;
    el.dataset.tid = String(t.id);
    el.setAttribute('aria-label', t.type);
    el.textContent = t.emoji;

    el.style.position = 'absolute';
    el.style.left = t.x + 'px';
    el.style.top  = t.y + 'px';
    el.style.width = t.size + 'px';
    el.style.height = t.size + 'px';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.borderRadius = '999px';
    el.style.userSelect = 'none';
    el.style.touchAction = 'manipulation';
    el.style.pointerEvents = 'auto';

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

  // ---------- Logging ----------
  function makeSessionId(){
    const base = `${Date.now()}-${(Math.random()*1e9)|0}-${seed>>>0}`;
    return base.replace(/\./g,'');
  }
  const sessionId = String(opts.sessionId || q.sessionId || q.sid || makeSessionId());

  function logEvent(type, a={}, b={}){
    const payload = {
      timestampIso: new Date().toISOString(),
      projectTag: String(q.projectTag || 'HHA'),
      runMode: S.runMode,
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
      if (CloudLogger && typeof CloudLogger.logEvent === 'function') CloudLogger.logEvent(payload);
      else if (CloudLogger && typeof CloudLogger.send === 'function') CloudLogger.send(payload);
      else emitWin('hha:log', payload);
    }catch(_){}
  }

  // ---------- Coach / Fever ----------
  function coach(line, mood='neutral', sub=''){
    if (S.__coachCdMs > 0) return;
    S.__coachCdMs = 900;
    emitWin('hha:coach', { line:String(line||''), mood, sub:String(sub||'') });
  }

  function setFever(v){
    S.fever = clamp(v, 0, 100);
    try{ FeverUI.setFever?.(S.fever); }catch(_){}
    emitWin('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }

  function setShield(v){
    S.shield = clamp(v, 0, 6);
    try{ FeverUI.setShield?.(S.shield); }catch(_){}
    emitWin('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }

  function stun(reason='hit'){
    const dur = 200 + ((S.fever/100) * 240);
    S.stunUntilMs = nowMs() + dur;
    try{ DOC.body && DOC.body.classList.add('gj-stun'); }catch(_){}
    try{ FeverUI.stun?.(S.fever, reason); }catch(_){}
    setTimeout(()=>{ try{ DOC.body && DOC.body.classList.remove('gj-stun'); }catch(_){} }, dur+60);
  }

  // ---------- HUD emits (FIXED NAMES) ----------
  function computeLiveGrade(){
    const nGood = S.nHitGood|0;
    const nExpire = S.nExpireGood|0;
    const denomGood = Math.max(1, nGood + nExpire);
    const acc = Math.round((nGood / denomGood) * 100);
    const miss = S.misses|0;
    const score = S.score|0;
    const combo = S.comboMax|0;

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

  function emitScore(reason='score'){
    const payload = {
      reason,
      score: S.score|0,
      combo: S.combo|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,
      fever: S.fever|0,
      shield: S.shield|0,
      grade: computeLiveGrade()
    };
    emitWin('hha:score', payload);
  }

  function emitTime(){
    const payload = { timeLeftSec: Math.ceil(S.timeLeftSec)|0, timeLeft: Math.ceil(S.timeLeftSec)|0, durationPlannedSec: S.durationPlannedSec|0 };
    emitWin('hha:time', payload);
  }

  // ---------- Quest setup ----------
  const goalDefs = (opts.goalDefs || DEFAULT_GOALS).map(g=>({ ...g }));
  const miniDefs = (opts.miniDefs || DEFAULT_MINIS).map(m=>({ ...m }));

  const Q = makeQuestDirector({ diff, goalDefs, miniDefs, maxGoals: goalDefs.length, maxMini: miniDefs.length });
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

  // ---------- Spawn / ramp / adaptive ----------
  function lerp(a,b,t){ return a + (b-a)*clamp(t,0,1); }

  function updateDifficultyModel(){
    // research: locked (no adaptive, no warmup ramp)
    if (S.runMode === 'research'){
      S.spawnMsCur = B.baseSpawn;
      S.capCur = B.baseCap;
      S.ttlCur = B.baseTTL;
      S.sizeCur = B.baseSize;
      S.junkCur = B.junk;
      S.shieldCur = B.shield;
      return;
    }

    // play mode: warmup + fast ramp + adaptive smoothing (B1+B2)
    const t = (nowMs() - S.tStartMs) / 1000;
    const warmupSec = 3.0;
    const warm = t < warmupSec;

    // ramp: speed up quickly after warmup (you asked auto faster)
    // 0..1 over ~7 seconds after warmup
    const ramp = clamp((t - warmupSec) / 7.0, 0, 1);

    // skill raw
    const denomGood = Math.max(1, (S.nHitGood|0) + (S.nExpireGood|0));
    const acc = clamp((S.nHitGood|0) / denomGood, 0, 1);
    const comboN = clamp((S.comboMax|0) / 18, 0, 1);
    const missOk = clamp(1 - ((S.misses|0) / Math.max(1,(S.missLimit|0)+2)), 0, 1);
    const skillRaw = clamp((acc*0.55) + (comboN*0.25) + (missOk*0.20), 0, 1);

    // smoothing
    const alpha = 0.06;
    S.skillEma = (S.skillEma*(1-alpha)) + (skillRaw*alpha);

    // warmup targets: few, big, forgiving
    const warmSpawn = 520;
    const warmCap   = 3;
    const warmTTL   = B.baseTTL * 1.15;
    const warmSize  = B.baseSize * 1.08;

    // base blended by ramp
    const spawnBase = lerp(warmSpawn, B.baseSpawn, ramp);
    const capBase   = Math.round(lerp(warmCap,   B.baseCap,  ramp));
    const ttlBase   = lerp(warmTTL,   B.baseTTL,  ramp);
    const sizeBase  = lerp(warmSize,  B.baseSize, ramp);

    // adaptive tweak (faster + a bit tougher when skilled)
    const k = S.skillEma;

    S.spawnMsCur = clamp(spawnBase * lerp(1.05, 0.82, k), 240, 780);
    S.capCur = clamp(capBase + Math.round(k*2), 3, B.baseCap + 3);

    S.ttlCur = clamp(ttlBase * lerp(1.10, 0.88, k), 1250, 3600);
    S.sizeCur = clamp(sizeBase * lerp(1.04, 0.92, k), 44, 140);

    // rates
    const forbidJunk = !!Q.getUIState('peek').miniForbidJunk;
    const junkBase = B.junk * (warm ? 0.70 : 1.0);
    const junkSkill = junkBase * lerp(0.92, 1.12, k);
    S.junkCur = clamp(forbidJunk ? (junkSkill*0.35) : junkSkill, 0.06, 0.30);

    S.shieldCur = clamp(B.shield * (warm ? 1.15 : 1.0), 0.05, 0.12);
  }

  function spawnTarget(type){
    if (S.ended) return null;

    const rect = getPlayRect();

    // position
    const x = rect.x0 + rng()*rect.w;
    const y = rect.y0 + rng()*rect.h;

    // size
    let size = S.sizeCur + (rng()*10 - 5);
    if (type === 'boss') size = (diff === 'easy') ? 120 : (diff === 'hard' ? 108 : 114);
    size = clamp(size, 44, 140);

    const id = nextId++;
    const tNow = nowMs();

    const lifeMs =
      (type === 'good') ? S.ttlCur :
      (type === 'junk' || type === 'trap') ? Math.max(1200, S.ttlCur * 0.95) :
      (type === 'shield') ? Math.max(1400, S.ttlCur * 1.00) :
      (type === 'boss') ? 999999 :
      S.ttlCur;

    const emoji =
      (type === 'good') ? (['🍎','🥦','🥕','🍌','🍇','🍊','🍉','🥗'][(rng()*8)|0]) :
      (type === 'junk') ? (['🍟','🍔','🍩','🍭','🥤','🍰'][(rng()*6)|0]) :
      (type === 'trap') ? (['🧨','💣','🪤'][(rng()*3)|0]) :
      (type === 'shield') ? '🛡️' :
      (type === 'star') ? '⭐' :
      (type === 'diamond') ? '💎' :
      (type === 'boss') ? '😈' :
      '❓';

    const t = {
      id, type, emoji,
      x, y,
      size,
      bornMs: tNow,
      expireMs: tNow + lifeMs,
      el: null
    };

    t.el = makeElTarget(t);
    targets.set(id, t);

    try{ layer.appendChild(t.el); }catch(_){}

    if (type === 'good') S.nTargetGoodSpawned++;
    if (type === 'junk' || type === 'trap') S.nTargetJunkSpawned++;
    if (type === 'star') S.nTargetStarSpawned++;
    if (type === 'diamond') S.nTargetDiamondSpawned++;
    if (type === 'shield') S.nTargetShieldSpawned++;

    return t;
  }

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

  function spawnStep(){
    if (S.ended || !S.started) return;

    const isBossMini = isBossMiniActive();
    if (isBossMini){
      if (!S.bossAlive) spawnBoss();
      // keep focus, few helpers
      if (targets.size < Math.max(3, Math.floor(S.capCur*0.6))){
        spawnTarget('good');
        if (rng() < 0.22) spawnTarget('junk');
      }
      return;
    } else {
      if (S.bossAlive) despawnBoss();
    }

    // cap
    if (targets.size >= (S.capCur|0)) return;

    // choose type
    const forbidJunk = !!Q.getUIState('peek').miniForbidJunk;
    const junkRate = forbidJunk ? Math.min(0.10, S.junkCur) : S.junkCur;
    const shieldRate = S.shieldCur;
    const goodRate = Math.max(0.50, 1.0 - junkRate - shieldRate);

    const r = rng();
    if (r < goodRate) spawnTarget('good');
    else if (r < goodRate + shieldRate) spawnTarget('shield');
    else spawnTarget((rng() < 0.12) ? 'trap' : 'junk');
  }

  // ---------- Hit logic ----------
  function addScore(points, why='hit'){
    S.score = (S.score|0) + (points|0);
    if (points > 0 && Particles.scorePop) Particles.scorePop(points, why);
  }

  function bossTakeHit(n=1){
    if (!S.bossAlive) return;
    S.bossHp = Math.max(0, (S.bossHp|0) - (n|0));
    addScore(14, 'BOSS');
    setFever(S.fever + 4);
    stun('boss');
    emitScore('boss');

    logEvent('hit',
      { targetId: null, emoji:'😈', itemType:'boss', judgment:'HIT', isGood: 1 },
      { kind:'boss', hp: S.bossHp, hpMax: S.bossHpMax }
    );

    // boss mini progress only when boss mini active
    try{
      const ui = Q.getUIState('peek');
      const miniIsBoss = !!(ui && ui.miniTitle && String(ui.miniTitle).indexOf('บอส') >= 0);
      if (miniIsBoss){
        const r = Q.addMiniProgress(1);
        if (r.miniDone){
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

  function tryHitTarget(id, meta = {}){
    if (S.ended || !S.started) return;
    const t = targets.get(id);
    if (!t) return;

    const tNow = nowMs();

    if (t.type === 'boss'){
      bossTakeHit(1);
      return;
    }

    removeTarget(id);

    if (t.type === 'good'){
      S.nHitGood += 1;
      const rt = clamp(tNow - t.bornMs, 0, 9999);
      S.rtGood.push(rt);

      const base = (diff === 'easy') ? 18 : (diff === 'hard' ? 24 : 20);
      const comboBonus = Math.min(18, (S.combo|0)) * 2;
      addScore(base + comboBonus, 'GOOD');

      S.combo = (S.combo|0) + 1;
      S.comboMax = Math.max(S.comboMax|0, S.combo|0);

      setFever(S.fever + 6);

      Particles.burstAt?.(t.x, t.y, 'GOOD');
      logEvent('hit', { targetId: id, emoji:t.emoji, itemType:'good', judgment:'HIT', isGood:1 }, { rtMs: rt|0 });

      const gRes = Q.addGoalProgress(1);
      // do not advance mini when boss mini active
      let mRes = { miniDone:false };
      try{
        const ui = Q.getUIState('peek');
        const miniIsBoss = !!(ui && ui.miniTitle && String(ui.miniTitle).indexOf('บอส') >= 0);
        if (!miniIsBoss) mRes = Q.addMiniProgress(1);
      }catch(_){
        mRes = Q.addMiniProgress(1);
      }

      if (gRes.goalDone){
        Particles.celebrate?.('GOAL');
        coach('Goal ผ่านแล้ว! ไปต่อ 🔥', 'happy', 'เป้าถัดไปมาแล้ว!');
        Q.nextGoal();
      }
      if (mRes.miniDone){
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
      setShield((S.shield|0) + 1);
      addScore(10, 'SHIELD');
      Particles.burstAt?.(t.x, t.y, 'SHIELD');
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'shield', judgment:'HIT', isGood:1 }, {});
      emitScore('shield');
      return;
    }

    if (t.type === 'junk' || t.type === 'trap'){
      // shield blocks -> NOT a miss
      if ((S.shield|0) > 0){
        S.nHitJunkGuard += 1;
        setShield((S.shield|0) - 1);
        addScore(6, 'GUARD');
        Particles.burstAt?.(t.x, t.y, 'GUARD');
        logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'junk', judgment:'GUARD', isGood:1 }, {});
        emitScore('guard');
        return;
      }

      // unblocked junk => miss
      S.nHitJunk += 1;
      S.misses += 1;
      S.combo = 0;
      setFever(S.fever - 18);
      stun('junk');
      Particles.burstAt?.(t.x, t.y, 'JUNK');
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'junk', judgment:'HIT', isGood:0 }, {});

      Q.onJunkHit();
      emitScore('junk');

      refreshSurviveGoal(false);
      return;
    }
  }

  // ---------- Shoot at crosshair ----------
  function getCrosshairPoint(){
    if (crosshairEl){
      const r = crosshairEl.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    }
    const vw = ROOT.innerWidth || 360;
    const vh = ROOT.innerHeight || 640;
    return { x: vw*0.5, y: vh*0.62 };
  }

  function shoot(){
    if (!S.started || S.ended) return;
    const p = getCrosshairPoint();

    let best = null;
    let bestD = 1e9;

    for (const t of targets.values()){
      if (!t.el) continue;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      const dx = cx - p.x;
      const dy = cy - p.y;
      const d = Math.hypot(dx, dy);
      const hitR = Math.max(26, r.width * 0.48) + 8;
      if (d <= hitR && d < bestD){
        bestD = d;
        best = t;
      }
    }

    if (best){
      tryHitTarget(best.id, { via:'shoot' });
    } else {
      // soft feedback
      addScore(0, 'MISS');
      Particles.scorePop?.(0, 'MISS');
      logEvent('shoot', { judgment:'MISS' }, {});
    }
  }

  // ---------- End / Summary ----------
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
      const keep = ['studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode','schoolYear','semester','studentKey','schoolCode','nickName','nick','diff','run'];
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
    try{
      ROOT.localStorage && ROOT.localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
      ROOT.localStorage && ROOT.localStorage.setItem('hha_last_summary', JSON.stringify(payload));
    }catch(_){}
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
    emitWin('hha:end', payload);

    if (!elEndWrap) return;
    const hubUrl = buildHubUrl();

    const html =
      `<div class="hha-end-card" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;">
        <div style="max-width:720px;width:min(720px,100%);background:rgba(2,6,23,.86);border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;backdrop-filter:blur(10px);box-shadow:0 20px 80px rgba(0,0,0,.45);">
          <div style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
            <div>
              <div style="font-weight:800;font-size:22px;">สรุปผล — GoodJunk VR</div>
              <div style="opacity:.78;margin-top:4px;">โหมด: ${escapeHtml(S.runMode)} • ระดับ: ${escapeHtml(diff)} • Session: ${escapeHtml(sessionId)}</div>
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
      btn.addEventListener('click', () => { try{ ROOT.location.reload(); }catch(_){} }, { passive:true });
    }
  }

  function endGame(reason='time'){
    if (S.ended) return;
    S.ended = true;

    refreshSurviveGoal(true);

    try{ DOC.body && DOC.body.classList.remove('gj-panic'); }catch(_){}
    try{ DOC.body && DOC.body.classList.remove('gj-stun'); }catch(_){}

    const stats = computeStatsFinal();
    const grade = computeGrade(stats);

    const payload = {
      timestampIso: new Date().toISOString(),
      projectTag: String(q.projectTag || 'HHA'),
      runMode: S.runMode,
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
      startTimeIso: S.tStartIso || '',
      endTimeIso: new Date().toISOString(),

      // pass-through profile fields
      studentKey: String(q.studentKey || ''),
      schoolCode: String(q.schoolCode || ''),
      schoolName: String(q.schoolName || ''),
      classRoom: String(q.classRoom || ''),
      studentNo: String(q.studentNo || ''),
      nickName: String(q.nickName || q.nickName || q.nick || ''),
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

    logEvent('end', { reason }, { ...stats, grade });
  }

  // ---------- Loop ----------
  function update(dtMs){
    if (!S.started || S.ended) return;

    // coach cooldown
    S.__coachCdMs = Math.max(0, (S.__coachCdMs|0) - (dtMs|0));

    // quest tick (timed minis)
    Q.tick();

    // time
    S.timeLeftSec = Math.max(0, S.timeLeftSec - (dtMs/1000));
    S.durationPlayedSec = Math.min(S.durationPlannedSec, Math.round(S.durationPlannedSec - S.timeLeftSec));

    // panic near end OR near miss limit
    const leftMiss = (S.missLimit|0) - (S.misses|0);
    if ((S.timeLeftSec <= 8 && S.timeLeftSec > 0) || (leftMiss <= 1 && leftMiss >= 0)){
      try{ DOC.body && DOC.body.classList.add('gj-panic'); }catch(_){}
    } else {
      try{ DOC.body && DOC.body.classList.remove('gj-panic'); }catch(_){}
    }

    // difficulty model update (warmup+ramp+adaptive)
    updateDifficultyModel();

    // spawn by timer (prevents flood)
    S.spawnAccMs += dtMs;
    let loops = 0;
    while (S.spawnAccMs >= S.spawnMsCur && loops < 2){ // cap 2 spawns/frame
      S.spawnAccMs -= S.spawnMsCur;
      spawnStep();
      loops++;
    }

    // expire
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

  // ---------- Input binding ----------
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
      tryHitTarget(id, { via:'pointer' });
    };

    layer.addEventListener('pointerdown', handler, { passive:false });
    layer.addEventListener('pointerup', handler, { passive:false });
    layer.addEventListener('click', handler, { passive:false });
  }

  function bindShoot(){
    if (shootEl){
      shootEl.addEventListener('pointerup', (e)=>{ e.preventDefault(); shoot(); }, { passive:false });
      shootEl.addEventListener('click', (e)=>{ e.preventDefault(); shoot(); }, { passive:false });
    }
    // keyboard
    ROOT.addEventListener('keydown', (e)=>{
      if (e.code === 'Space'){
        e.preventDefault();
        shoot();
      }
    }, { passive:false });
  }

  // ---------- Start ----------
  function startGame(){
    if (S.started) return;
    S.started = true;
    S.tStartIso = new Date().toISOString();
    S.tStartMs = nowMs();
    S.tLastMs = 0;
    S.spawnAccMs = 0;

    S.timeLeftSec = S.durationPlannedSec;

    setFever(10);
    setShield(0);

    coach('พร้อมลุย! เก็บของดี เลี่ยงขยะ 💥', 'happy',
      (S.runMode === 'research') ? 'โหมดวิจัย: ล็อกเงื่อนไขตามระดับ' : 'โหมดเล่น: วอร์ม 3 วิ แล้วเพิ่มความโหด!');

    emitScore('start');
    emitTime();

    logEvent('start', { reason:'start' }, { durationPlannedSec: S.durationPlannedSec|0 });

    // warm start: few targets only (prevents flood)
    spawnTarget('good');
    spawnTarget('good');
    if (rng() < 0.35) spawnTarget('shield');

    refreshSurviveGoal(false);

    ROOT.requestAnimationFrame(loop);
  }

  // If page has overlay, boot.js handles it; safe.js can start immediately when called.
  bindLayerClicks();
  bindShoot();
  startGame();

  // expose debug
  ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
  ROOT.GoodJunkVR.state = S;
  ROOT.GoodJunkVR.quest = Q;
  ROOT.GoodJunkVR.endGame = endGame;

  return { state:S, quest:Q, endGame };
}

// Optional auto-boot (off by default)
try{
  if (DOC && !ROOT.__HHA_GOODJUNK_BOOTED){
    ROOT.__HHA_GOODJUNK_BOOTED = true;
    const auto = DOC.documentElement && DOC.documentElement.hasAttribute('data-goodjunk-auto');
    if (auto) boot({});
  }
}catch(_){}