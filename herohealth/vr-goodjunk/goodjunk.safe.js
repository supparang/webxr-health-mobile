/* HeroHealth — GoodJunk VR (PRODUCTION SAFE) — FULL MERGED
   - DOM emoji targets on #gj-layer (moved to BODY overlay to avoid world-shift transform)
   - Quest (Goals sequential + Minis chain) + Coach + Fever/Shield
   - ✅ Survive goal driven by missLimit (engine-driven via setGoalExternal)
   - ✅ Boss-mini correctness (advance mini only when boss mini active)
   - ✅ Miss danger pressure (panic near miss limit)
   - ✅ Warmup gentle start: few targets, NO junk, expire grace no-miss
   - ✅ Adaptive ONLY in run=play (run=study locks to diff)
   - ✅ Mouse playable: click targets OR press ยิง to hit closest to crosshair
   - ✅ HUD fields aligned with /vr/hha-hud.js (score/goalMax/miniMax/line etc.)
   - Grade: SSS, SS, S, A, B, C
*/
'use strict';

// ------------------------------ Utilities ------------------------------
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

// IMPORTANT: hha-hud.js listens on window for hha:* and on document for quest:update
function dispatchDoc(name, detail){
  try{ DOC && DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function dispatchWin(name, detail){
  try{ ROOT && ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function tryVibrate(ms){
  try{
    if (ROOT.navigator && ROOT.navigator.vibrate) ROOT.navigator.vibrate(ms);
  }catch(_){}
}

// ------------------------------ Optional modules ------------------------------
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
  { id:'m_fast',   title:'สปีดรัน! เก็บของดี 6 ชิ้น',   targetByDiff:{ easy:6, normal:7, hard:8 },  forbidJunk:false },
  { id:'m_clean',  title:'โซนคลีน! ห้ามโดนขยะ 10 วิ',   targetByDiff:{ easy:1, normal:1, hard:1 },  forbidJunk:true,  timerSecByDiff:{ easy:10, normal:10, hard:12 } },
  { id:'m_combo',  title:'คอมโบเดือด! ทำคอมโบ 8',      targetByDiff:{ easy:8, normal:9, hard:10 }, forbidJunk:false, special:'combo' },
  { id:'m_guard',  title:'โล่พร้อม! บล็อกขยะ 2 ครั้ง',  targetByDiff:{ easy:2, normal:2, hard:3 },  forbidJunk:false, special:'guard' },
  { id:'m_boss',   title:'บอสมาแล้ว! ตีบอสให้แตก',      targetByDiff:{ easy:8, normal:10, hard:12 },forbidJunk:false, special:'boss' },
  { id:'m_focus',  title:'โฟกัส! เก็บของดี 10 ชิ้น',     targetByDiff:{ easy:9, normal:10, hard:11 },forbidJunk:false },
  { id:'m_clean2', title:'คลีนอีกรอบ! ห้ามโดนขยะ 12 วิ', targetByDiff:{ easy:1, normal:1, hard:1 },  forbidJunk:true,  timerSecByDiff:{ easy:12, normal:12, hard:14 } }
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
    while(out.length < maxGoals){
      out.push({ id:'g_auto_'+out.length, title:'Goal', cur:0, target:10, done:false });
    }
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
    while(out.length < maxMini){
      out.push({ id:'m_auto_'+out.length, title:'Mini', cur:0, target:5, done:false, forbidJunk:false, timerSec:0, special:'' });
    }
    return out.slice(0, maxMini);
  }

  function ui(reason='state'){
    const m = Q.activeMini;
    const leftSec = (m && m.timerSec > 0 && Q.miniEndsAtMs > 0)
      ? Math.max(0, Math.ceil((Q.miniEndsAtMs - nowMs()) / 1000))
      : null;

    // IMPORTANT: align with hha-hud.js fields
    return {
      reason,

      goalIndex: Q.goalIndex,
      goalTitle: Q.activeGoal ? Q.activeGoal.title : '',
      goalCur: Q.activeGoal ? Q.activeGoal.cur : 0,
      goalMax: Q.activeGoal ? Q.activeGoal.target : 1,     // ✅ hha-hud expects goalMax
      goalTarget: Q.activeGoal ? Q.activeGoal.target : 1,  // keep alias
      goalDone: Q.activeGoal ? !!Q.activeGoal.done : false,
      goalsCleared: Q.goalsCleared,
      goalsTotal: Q.goalsAll.length,

      miniCount: Q.miniCount,
      miniTitle: m ? m.title : '',
      miniCur: m ? m.cur : 0,
      miniMax: m ? m.target : 1,           // ✅ hha-hud expects miniMax
      miniTarget: m ? m.target : 1,        // keep alias
      miniDone: m ? !!m.done : false,
      minisCleared: Q.minisCleared,
      minisTotal: Q.minisAll.length,

      miniForbidJunk: m ? !!m.forbidJunk : false,
      miniTimerSec: m ? (m.timerSec|0) : 0,
      miniTLeft: leftSec,                  // ✅ hha-hud expects miniTLeft
      miniEndsAtMs: Q.miniEndsAtMs|0,

      allDone: !!Q.allDone
    };
  }

  function push(reason){ dispatchDoc('quest:update', ui(reason)); }

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

  return { start, tick, addGoalProgress, addMiniProgress, nextGoal, nextMini, failMini, onJunkHit, getUIState, setGoalExternal };
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

  // ---------- Layer / Stage ----------
  const stage = byId('gj-stage') || qs('#gj-stage') || DOC.body;

  // IMPORTANT FIX: move layer to BODY overlay so world-shift transform won't move targets
  let layer = byId('gj-layer') || qs('#gj-layer');
  if (!layer){
    layer = DOC.createElement('div');
    layer.id = 'gj-layer';
    try{ stage.appendChild(layer); }catch(_){}
  }
  try{
    // re-parent to body (last) to avoid parent transforms
    if (layer.parentElement !== DOC.body){
      DOC.body.appendChild(layer);
    }
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.zIndex = '6';        // below HUD (usually 10), above stage
    layer.style.pointerEvents = 'auto';
  }catch(_){}

  // crosshair center point
  const crosshair = byId('gj-crosshair') || qs('#gj-crosshair');

  // Controls
  const btnShoot = byId('btnShoot') || byId('btn-shoot') || qs('[data-shoot]');
  const startOverlay = byId('startOverlay') || byId('start-overlay') || qs('.start-overlay');
  const btnStart = byId('btnStart') || byId('start-btn') || qs('[data-start]');

  // End wrap (optional)
  const endWrap = byId('end-summary') || byId('gj-end') || qs('.gj-end') || null;

  // ---------- STATE ----------
  const S = {
    started: false,
    ended: false,

    startMs: 0,
    tLastMs: 0,

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

    // Survive limit per diff
    missLimit: (diff === 'easy') ? 6 : (diff === 'hard' ? 3 : 4),

    // Warmup + grace (gentle start)
    warmupSec: (diff === 'easy') ? 10 : (diff === 'hard' ? 6 : 8),
    graceExpireSec: (diff === 'easy') ? 8 : (diff === 'hard' ? 5 : 6),
    warmupCap: (diff === 'easy') ? 2 : (diff === 'hard' ? 2 : 3),

    // spawn scheduler
    __spawnAcc: 0,
    __spawnLastMs: 0,

    // adaptive windows (play only)
    __adpt: 0,            // -2..+2
    __adptFactor: 1.0,    // 0.75..1.35
    __winStartMs: 0,
    __winHitGood: 0,
    __winMiss: 0,
    __winJunkHit: 0,

    // coach cooldown
    __coachCdMs: 0,

    // version
    gameVersion: String(opts.gameVersion || q.ver || 'goodjunk.safe.js@prod'),

    // ISO
    tStartIso: '',
    tEndIso: ''
  };

  // ---------- Logging ----------
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
      if (CloudLogger && typeof CloudLogger.logEvent === 'function') CloudLogger.logEvent(payload);
      else if (CloudLogger && typeof CloudLogger.send === 'function') CloudLogger.send(payload);
      else dispatchDoc('hha:log', payload);
    }catch(_){}
  }

  // ---------- HUD/Coach/FX ----------
  function coach(text, mood='neutral', sub=''){
    if (S.__coachCdMs > 0) return;
    S.__coachCdMs = 900;

    // IMPORTANT: hha-hud.js expects {line, sub, mood}
    dispatchWin('hha:coach', { line: text, sub, mood, text });

    // optional direct DOM (if you have custom elements)
    const elLine = byId('hudCoachLine');
    const elSub  = byId('hudCoachSub');
    const elImg  = byId('hudCoachImg');
    if (elLine) setTxt(elLine, text);
    if (elSub)  setTxt(elSub, sub);

    if (elImg){
      const map = {
        happy: './img/coach-happy.png',
        neutral: './img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png'
      };
      try{ elImg.src = map[String(mood||'neutral').toLowerCase()] || map.neutral; }catch(_){}
    }
  }

  function setFever(v){
    S.fever = clamp(v, 0, 100);
    try{ FeverUI.setFever?.(S.fever); }catch(_){}
    dispatchWin('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }

  function setShield(v){
    S.shield = clamp(v|0, 0, 6);
    try{ FeverUI.setShield?.(S.shield); }catch(_){}
    dispatchWin('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }

  function addShield(n=1){ setShield((S.shield|0) + (n|0)); }

  function stun(reason='hit'){
    const dur = 220 + ((S.fever/100) * 260);
    S.stunUntilMs = nowMs() + dur;
    DOC.body && DOC.body.classList.add('gj-stun');
    tryVibrate(35);
    try{ FeverUI.stun?.(S.fever, reason); }catch(_){}
    setTimeout(()=>{ try{ DOC.body && DOC.body.classList.remove('gj-stun'); }catch(_){} }, dur+60);
  }

  function emitScore(reason='score'){
    // IMPORTANT: hha-hud.js expects d.score / d.combo / d.misses / d.grade(optional)
    const payload = {
      reason,
      score: S.score|0,
      scoreFinal: S.score|0,
      combo: S.combo|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,
      fever: S.fever|0,
      shield: S.shield|0
    };
    dispatchWin('hha:score', payload);
  }

  function emitTime(){
    dispatchWin('hha:time', { timeLeftSec: Math.ceil(S.timeLeftSec), durationPlannedSec: S.durationPlannedSec|0 });
  }

  function addScore(points, why='hit'){
    S.score = (S.score|0) + (points|0);
    if (points > 0 && Particles.scorePop) Particles.scorePop(points, why);
  }

  // ---------- Playfield bounds (avoid HUD) ----------
  function getPlayRect(){
    const vw = ROOT.innerWidth || 360;
    const vh = ROOT.innerHeight || 640;

    const padTop = 132;  // top HUD (quest + stats)
    const padBot = 148;  // bottom fever + shoot
    const padSide = 18;

    const x0 = padSide;
    const y0 = padTop;
    const x1 = vw - padSide;
    const y1 = vh - padBot;

    const w = Math.max(140, x1 - x0);
    const h = Math.max(160, y1 - y0);

    const relax = (w < 240 || h < 240) ? 0.65 : 1.0;
    return {
      x0: x0 * relax,
      y0: y0 * relax,
      w: Math.max(140, (vw - (padSide*2*relax))),
      h: Math.max(160, (vh - (padTop*relax) - (padBot*relax)))
    };
  }

  // ---------- Targets ----------
  const targets = new Map();
  let nextId = 1;

  function makeElTarget(t){
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'gj-target gj-' + t.type;
    el.dataset.tid = String(t.id);
    el.setAttribute('aria-label', t.type);

    // emoji visual
    el.textContent = t.emoji;

    // layout
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

    // minimal visual fallback (CSS can override)
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

  function spawnTarget(type, cfg={}){
    if (S.ended) return null;

    const rect = getPlayRect();

    // base size by diff
    const baseSize =
      (diff === 'easy') ? 66 :
      (diff === 'hard') ? 54 : 60;

    // adaptive factor (play only)
    const f = (run === 'play') ? (S.__adptFactor || 1) : 1;

    let size = baseSize * (1 / Math.sqrt(f)); // เล่นเก่ง -> เป้าเล็กลงนิด
    size += (rng()*10 - 5);
    if (type === 'boss') size = ((diff === 'easy') ? 120 : (diff === 'hard' ? 108 : 114));

    size = clamp(size, 44, 140);

    const x = rect.x0 + rng()*rect.w;
    const y = rect.y0 + rng()*rect.h;

    const id = nextId++;
    const tNow = nowMs();

    // lifetime (adaptive: เก่งขึ้น -> อายุสั้นลงเล็กน้อย)
    const lifeBaseGood =
      (diff === 'easy') ? 2800 :
      (diff === 'hard') ? 2100 : 2450;

    const lifeBaseBad =
      (diff === 'easy') ? 2600 :
      (diff === 'hard') ? 2000 : 2350;

    const lifeMs =
      (type === 'good') ? Math.max(1400, Math.round(lifeBaseGood / f)) :
      (type === 'junk' || type === 'trap') ? Math.max(1400, Math.round(lifeBaseBad / f)) :
      (type === 'shield') ? 2600 :
      (type === 'boss') ? 999999 :
      2400;

    const emoji =
      (type === 'good') ? (cfg.emoji || ['🍎','🥦','🥕','🍌','🍇','🍊','🍉','🥗'][((rng()*8)|0)]) :
      (type === 'junk') ? (cfg.emoji || ['🍟','🍔','🍩','🍭','🥤','🍰'][((rng()*6)|0)]) :
      (type === 'trap') ? (cfg.emoji || ['🧨','💣','🪤'][((rng()*3)|0)]) :
      (type === 'shield') ? '🛡️' :
      (type === 'boss') ? '😈' :
      '❓';

    const t = { id, type, emoji, xView:x, yView:y, size, bornMs:tNow, expireMs:tNow + lifeMs, el:null };
    t.el = makeElTarget(t);
    targets.set(id, t);

    try{ layer.appendChild(t.el); }catch(_){}

    // counters
    if (type === 'good') S.nTargetGoodSpawned++;
    if (type === 'junk' || type === 'trap') S.nTargetJunkSpawned++;
    if (type === 'shield') S.nTargetShieldSpawned++;

    logEvent('spawn', { targetId:id, emoji, itemType:type }, {});

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

  // ---------- Quest ----------
  const goalDefs = (opts.goalDefs || DEFAULT_GOALS).map(g=>({ ...g }));
  const miniDefs = (opts.miniDefs || DEFAULT_MINIS).map(m=>({ ...m }));

  const Q = makeQuestDirector({ diff, goalDefs, miniDefs, maxGoals: goalDefs.length, maxMini: miniDefs.length });
  Q.start();

  function refreshSurviveGoal(finalize=false){
    try{
      const ui = Q.getUIState('peek');
      if (!ui || !ui.goalTitle) return;
      if (ui.goalTitle.indexOf('อยู่รอด') < 0) return;

      const cur = S.misses|0;
      const max = S.missLimit|0;
      const ok = (cur <= max);
      Q.setGoalExternal(cur, max, finalize && ok);
    }catch(_){}
  }

  function isBossMiniActive(){
    try{
      const ui = Q.getUIState('peek');
      return !!(ui && ui.miniTitle && ui.miniTitle.indexOf('บอส') >= 0);
    }catch(_){}
    return false;
  }

  // ---------- Adaptive (play only) ----------
  function resetWindow(){
    S.__winStartMs = nowMs();
    S.__winHitGood = 0;
    S.__winMiss = 0;
    S.__winJunkHit = 0;
  }

  function updateAdaptive(){
    if (run !== 'play') return;
    const t = nowMs();
    if (!S.__winStartMs) resetWindow();
    const span = t - S.__winStartMs;
    if (span < 10000) return; // evaluate every 10s

    const hit = S.__winHitGood|0;
    const miss = S.__winMiss|0;
    const junk = S.__winJunkHit|0;

    // simple skill signal: hit beats miss+junk
    const score = hit - (miss*1.2) - (junk*1.4);

    if (score >= 10) S.__adpt = clamp(S.__adpt + 1, -2, 2);
    else if (score <= -4) S.__adpt = clamp(S.__adpt - 1, -2, 2);

    // map to factor
    S.__adptFactor =
      (S.__adpt <= -2) ? 0.78 :
      (S.__adpt === -1) ? 0.90 :
      (S.__adpt ===  0) ? 1.00 :
      (S.__adpt ===  1) ? 1.18 :
      1.32;

    // tiny coach hint
    if (S.__adpt >= 1) coach('เริ่มเข้ามือแล้ว! เกมจะโหดขึ้นนิดนะ 😈', 'happy', 'โหมดธรรมดา: ปรับตามฝีมือ');
    if (S.__adpt <= -1) coach('ไม่เป็นไร ค่อย ๆ มา 👌', 'neutral', 'เดี๋ยวช่วยผ่อนให้');

    resetWindow();
  }

  // ---------- Hit Logic ----------
  function addLiveWindowHitGood(){ S.__winHitGood += 1; }
  function addLiveWindowMiss(){ S.__winMiss += 1; }
  function addLiveWindowJunkHit(){ S.__winJunkHit += 1; }

  function tryHitTarget(id, meta = {}){
    if (S.ended || !S.started) return;
    const t = targets.get(id);
    if (!t) return;

    const tNow = nowMs();

    if (t.type === 'boss'){
      bossTakeHit(1);
      return;
    }

    // remove immediately (snappy)
    removeTarget(id);

    if (t.type === 'good'){
      S.nHitGood += 1;
      addLiveWindowHitGood();

      const rt = clamp(tNow - t.bornMs, 0, 9999);
      S.rtGood.push(rt);

      const base = (diff === 'easy') ? 18 : (diff === 'hard' ? 24 : 20);
      const comboBonus = Math.min(18, (S.combo|0)) * 2;
      addScore(base + comboBonus, 'GOOD');

      S.combo = (S.combo|0) + 1;
      S.comboMax = Math.max(S.comboMax|0, S.combo|0);

      setFever(S.fever + 6);

      Particles.burstAt?.(t.xView, t.yView, 'GOOD');
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'good', judgment:'HIT', isGood:1 }, { rtMs: rt|0 });

      const gState = Q.addGoalProgress(1);
      const gDone = !!gState.goalDone;

      // do NOT advance mini if current mini is boss-related
      let mDone = false;
      try{
        const ui = Q.getUIState('peek');
        const miniIsBoss = !!(ui && ui.miniTitle && ui.miniTitle.indexOf('บอส') >= 0);
        if (!miniIsBoss){
          const mState = Q.addMiniProgress(1);
          mDone = !!mState.miniDone;
        }
      }catch(_){
        const mState = Q.addMiniProgress(1);
        mDone = !!mState.miniDone;
      }

      if (gDone){ Particles.celebrate?.('GOAL'); coach('Goal ผ่านแล้ว! ไปต่อ 🔥', 'happy', 'เป้าถัดไปมาแล้ว!'); Q.nextGoal(); }
      if (mDone){ Particles.celebrate?.('MINI'); coach('Mini ผ่าน! สุดจัด ⚡', 'happy', 'ต่ออีกอันเลย!'); Q.nextMini(); }
      else { if ((S.combo|0) % 7 === 0) coach('คอมโบมาแล้ว! ดีมาก 🔥', 'happy', 'รักษาจังหวะ!'); }

      emitScore();
      refreshSurviveGoal(false);
      return;
    }

    if (t.type === 'shield'){
      addShield(1);
      addScore(10, 'SHIELD');
      Particles.burstAt?.(t.xView, t.yView, 'SHIELD');
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'shield', judgment:'HIT', isGood:1 }, {});
      emitScore();
      return;
    }

    if (t.type === 'junk' || t.type === 'trap'){
      // shield blocks junk hit -> NOT a miss
      if ((S.shield|0) > 0){
        S.nHitJunkGuard += 1;
        setShield((S.shield|0) - 1);
        addScore(6, 'GUARD');
        Particles.burstAt?.(t.xView, t.yView, 'GUARD');
        logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'junk', judgment:'GUARD', isGood:1 }, {});
        emitScore();
        return;
      }

      // miss: junk hit
      S.nHitJunk += 1;
      S.misses += 1;
      addLiveWindowMiss();
      addLiveWindowJunkHit();

      S.combo = 0;
      setFever(S.fever - 18);
      stun('junk');
      Particles.burstAt?.(t.xView, t.yView, 'JUNK');
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'junk', judgment:'HIT', isGood:0 }, {});

      Q.onJunkHit();
      emitScore();
      refreshSurviveGoal(false);
      return;
    }
  }

  function bossTakeHit(n=1){
    if (!S.bossAlive) return;
    S.bossHp = Math.max(0, (S.bossHp|0) - (n|0));
    addScore(14, 'BOSS');
    setFever(S.fever + 4);
    stun('boss');
    emitScore();

    logEvent('hit', { targetId:null, emoji:'😈', itemType:'boss', judgment:'HIT', isGood:1 }, { kind:'boss', hp:S.bossHp, hpMax:S.bossHpMax });

    // boss mini progress (only if current mini is boss-related)
    try{
      const ui = Q.getUIState('peek');
      const miniIsBoss = !!(ui && ui.miniTitle && ui.miniTitle.indexOf('บอส') >= 0);
      if (miniIsBoss){
        const mState = Q.addMiniProgress(1);
        const mDone = !!mState.miniDone;
        if (mDone){ Particles.celebrate?.('MINI'); coach('Mini ผ่าน! สุดจัด ⚡', 'happy', 'ต่ออีกอันเลย!'); Q.nextMini(); }
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

  // ---------- Spawn Policy (gentle start + adaptive) ----------
  function getSpawnPlan(){
    const isBossMini = isBossMiniActive();
    if (isBossMini){
      return { boss:true, cap:5, rate:0.8, junkRate:0.20, shieldRate:0.10 }; // focus
    }

    const f = (run === 'play') ? (S.__adptFactor || 1) : 1;

    // base caps by diff
    let cap =
      (diff === 'easy') ? 6 :
      (diff === 'hard') ? 8 : 7;

    // base rate (spawns per second)
    let rate =
      (diff === 'easy') ? 0.75 :
      (diff === 'hard') ? 1.05 : 0.90;

    // adaptive: skilled -> higher cap + slightly faster
    if (run === 'play'){
      cap = Math.round(cap * (0.95 + 0.18*(f-1)));
      rate = rate * (0.92 + 0.22*(f-1));
      cap = clamp(cap, 4, 11);
      rate = clamp(rate, 0.55, 1.35);
    }

    let junkRate =
      (diff === 'easy') ? 0.20 :
      (diff === 'hard') ? 0.28 : 0.24;

    let shieldRate = 0.08;

    // forbidJunk mini => reduce junk a lot
    const ui = Q.getUIState('peek');
    const forbidJunk = ui ? !!ui.miniForbidJunk : false;
    if (forbidJunk) junkRate = Math.min(junkRate, 0.08);

    // WARMUP: super gentle (few targets, NO junk 100%, spawn slow)
    const tPlaySec = S.started ? ((nowMs() - (S.startMs||nowMs())) / 1000) : 0;
    if (tPlaySec < (S.warmupSec||8)){
      cap = S.warmupCap || 2;
      rate = 0.38;
      junkRate = 0.0;
      shieldRate = 0.10;
    }

    // keep sane
    junkRate = clamp(junkRate, 0, 0.45);
    shieldRate = clamp(shieldRate, 0.04, 0.16);

    return { boss:false, cap, rate, junkRate, shieldRate };
  }

  function spawnStep(dtMs){
    if (S.ended || !S.started) return;

    const plan = getSpawnPlan();

    if (plan.boss){
      if (!S.bossAlive) spawnBoss();
      // sprinkle a bit
      if (targets.size < plan.cap){
        if (rng() < 0.65) spawnTarget('good');
        else spawnTarget('junk');
      }
      return;
    } else {
      if (S.bossAlive) despawnBoss();
    }

    // scheduler: spawn by rate, not per-frame
    const dtSec = (dtMs|0) / 1000;
    S.__spawnAcc += dtSec;

    const step = 1 / Math.max(0.2, plan.rate);
    while (S.__spawnAcc >= step){
      S.__spawnAcc -= step;
      if (targets.size >= plan.cap) break;

      const r = rng();
      const goodRate = 1.0 - plan.junkRate - plan.shieldRate;
      if (r < goodRate){
        spawnTarget('good');
      } else if (r < goodRate + plan.shieldRate){
        spawnTarget('shield');
      } else {
        spawnTarget((rng() < 0.12) ? 'trap' : 'junk');
      }
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
      durationPlayedSec: Math.round(S.durationPlayedSec||0)
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
    dispatchWin('hha:end', payload);
    if (!endWrap) return;

    const hubUrl = buildHubUrl();

    const html =
      `<div class="hha-end-card" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;z-index:20;">
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

    refreshSurviveGoal(true);

    try{ DOC.body && DOC.body.classList.remove('gj-panic'); }catch(_){}
    try{ DOC.body && DOC.body.classList.remove('gj-stun'); }catch(_){}

    const stats = computeStatsFinal();
    const grade = computeGrade(stats);

    // add grade to HUD immediately
    dispatchWin('hha:score', { score:S.score|0, combo:S.combo|0, misses:S.misses|0, grade });

    const ua = (ROOT.navigator && ROOT.navigator.userAgent) ? String(ROOT.navigator.userAgent) : '';
    const device = (q.device != null && String(q.device)) ? String(q.device) : (ua.includes('Mobile') ? 'mobile' : 'web');

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
      durationPlayedSec: Math.round(S.durationPlayedSec||0),

      ...stats,
      grade,

      device,
      gameVersion: S.gameVersion,
      reason,
      startTimeIso: S.tStartIso,
      endTimeIso: S.tEndIso,

      // study profile fields (pass-through)
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
    logEvent('end', { reason }, { ...stats, grade });
  }

  // ---------- Aim & Shoot ----------
  function getCenter(){
    // crosshair center preferred
    if (crosshair){
      const r = crosshair.getBoundingClientRect();
      return { cx: r.left + r.width/2, cy: r.top + r.height/2 };
    }
    return { cx: (ROOT.innerWidth||360)/2, cy: (ROOT.innerHeight||640)/2 };
  }

  function shootClosest(){
    if (!S.started || S.ended) return;
    const { cx, cy } = getCenter();

    let best = null;
    let bestD = 1e9;

    for (const [id, t] of targets){
      if (!t || !t.el) continue;
      if (t.type === 'boss') {
        // allow boss shooting only when boss mini active
        if (!isBossMiniActive()) continue;
      }
      const dx = (t.xView - cx);
      const dy = (t.yView - cy);
      const d = Math.hypot(dx, dy);
      if (d < bestD){
        bestD = d;
        best = t;
      }
    }

    // require within reasonable radius so it feels fair
    const threshold = 150;
    if (best && bestD <= threshold){
      tryHitTarget(best.id, { via:'shoot', d: bestD });
    } else {
      // small penalty? (นุ่ม ๆ) — ไม่ลงโทษ
      Particles.scorePop?.(0, 'MISS');
    }
  }

  // ---------- Update loop ----------
  function update(dtMs){
    if (!S.started || S.ended) return;

    S.__coachCdMs = Math.max(0, (S.__coachCdMs|0) - (dtMs|0));

    // quest tick (timer minis)
    Q.tick();

    // time
    S.timeLeftSec = Math.max(0, S.timeLeftSec - (dtMs/1000));
    S.durationPlayedSec = (S.durationPlannedSec - S.timeLeftSec);

    // panic near end time
    if (S.timeLeftSec <= 8 && S.timeLeftSec > 0) DOC.body && DOC.body.classList.add('gj-panic');
    else DOC.body && DOC.body.classList.remove('gj-panic');

    // extra pressure when close to miss limit
    const leftMiss = (S.missLimit|0) - (S.misses|0);
    if (leftMiss <= 1 && leftMiss >= 0) DOC.body && DOC.body.classList.add('gj-panic');

    // spawn
    spawnStep(dtMs);

    // expire targets
    const tNow = nowMs();
    const tPlaySec = (tNow - (S.startMs||tNow)) / 1000;
    const inGrace = tPlaySec < (S.graceExpireSec || 6);

    for (const [id, t] of targets){
      if (t.type === 'boss') continue;
      if (tNow >= t.expireMs){
        if (t.type === 'good'){
          S.nExpireGood += 1;

          // GRACE: good expire does NOT count as miss early game
          if (!inGrace){
            S.misses += 1;
            addLiveWindowMiss();

            S.combo = 0;
            setFever(S.fever - 12);
            stun('expire');
            logEvent('miss', { targetId:id, emoji:t.emoji, itemType:'good', judgment:'EXPIRE', isGood:1 }, {});
            emitScore();
            refreshSurviveGoal(false);
          }
        }
        removeTarget(id);
      }
    }

    // adaptive update (every 10s, play only)
    updateAdaptive();

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

    layer.addEventListener('pointerup', handler, { passive:false });
    layer.addEventListener('click', handler, { passive:false });
  }

  function bindShoot(){
    const go = (e) => {
      if (e){ e.preventDefault(); e.stopPropagation(); }
      shootClosest();
    };

    if (btnShoot){
      btnShoot.addEventListener('pointerup', go, { passive:false });
      btnShoot.addEventListener('click', go, { passive:false });
    }

    // keyboard support: Space / Enter
    DOC.addEventListener('keydown', (e)=>{
      if (!S.started || S.ended) return;
      if (e.code === 'Space' || e.code === 'Enter'){
        e.preventDefault();
        shootClosest();
      }
    }, { passive:false });
  }

  // ---------- Start gate ----------
  function startGame(){
    if (S.started) return;
    S.started = true;

    // reset
    targets.clear();
    if (layer) layer.innerHTML = '';

    S.startMs = nowMs();
    resetWindow();

    S.tStartIso = new Date().toISOString();
    S.tLastMs = 0;
    S.timeLeftSec = S.durationPlannedSec;

    S.score = 0; S.combo = 0; S.comboMax = 0; S.misses = 0;
    S.nTargetGoodSpawned = 0; S.nTargetJunkSpawned = 0; S.nTargetShieldSpawned = 0;
    S.nHitGood = 0; S.nHitJunk = 0; S.nHitJunkGuard = 0; S.nExpireGood = 0;
    S.rtGood = [];

    S.__spawnAcc = 0;

    setFever(10);
    setShield(0);

    coach('พร้อมลุย! ช่วงแรกนุ่ม ๆ แล้วค่อยโหดขึ้นเอง 😈', 'happy',
      (run === 'study') ? 'โหมดวิจัย: ล็อกตามระดับ (ไม่ adaptive)' : 'โหมดธรรมดา: ปรับตามฝีมือ');

    emitScore('start');
    emitTime();

    logEvent('start', { reason:'start' }, { durationPlannedSec: S.durationPlannedSec|0 });

    // start with ONLY 1 good (warmup will add slowly)
    spawnTarget('good');

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
    } else {
      go();
    }
  }

  // ---------- Init ----------
  bindLayerClicks();
  bindShoot();
  bindStart();

  // expose debug
  ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
  ROOT.GoodJunkVR.state = S;
  ROOT.GoodJunkVR.quest = Q;
  ROOT.GoodJunkVR.endGame = endGame;

  return { state:S, quest:Q, endGame };
}

// Optional auto-boot if loaded directly (safe no-op if already booted)
try{
  if (DOC && !ROOT.__HHA_GOODJUNK_BOOTED){
    ROOT.__HHA_GOODJUNK_BOOTED = true;
    const auto = DOC.documentElement && DOC.documentElement.hasAttribute('data-goodjunk-auto');
    if (auto) boot({});
  }
}catch(_){}
