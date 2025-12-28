/* === /herohealth/vr-goodjunk/goodjunk.safe.js ===
GoodJunk VR (PRODUCTION SAFE) — FULL “GAME REAL HARD” PACK
✅ DOM emoji targets on #gj-layer
✅ Quest (Goals sequential + Minis chain) + Coach + Fever/Shield
✅ Fix HUD payload names to match /vr/hha-hud.js
✅ Adaptive (run=play only): size/life/spawn/rates adjust to performance
✅ Hardcore levels (hard=0..5) — user choose hard=5
✅ Drift targets (hard>=4), junk bait near crosshair (hard=5)
✅ Pattern Spawn Director (burst / wall / swirl / bait)
✅ Boss Phase Hazards real: Ring/Laser collision uses stage translate (drag-to-dodge)
✅ Survive goal driven by missLimit via setGoalExternal
✅ Miss standard: miss = good expired + junk hit; shield-block does NOT count miss
✅ HHA standard: end summary + localStorage(HHA_LAST_SUMMARY) + hub return + logging
Grade: SSS, SS, S, A, B, C
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

function dispatchWin(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function dispatchDoc(name, detail){
  try{ DOC && DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function tryVibrate(ms){
  try{ if (ROOT.navigator && ROOT.navigator.vibrate) ROOT.navigator.vibrate(ms); }catch(_){}
}

function lerp(a,b,t){ return a + (b-a)*t; }
function hypot2(x,y){ return Math.sqrt((x*x) + (y*y)); }

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
  { id:'m_fast',   title:'สปีดรัน! เก็บของดี 6 ชิ้น',       targetByDiff:{ easy:6, normal:7, hard:8 },  forbidJunk:false },
  { id:'m_clean',  title:'โซนคลีน! ห้ามโดนขยะ 10 วิ',       targetByDiff:{ easy:1, normal:1, hard:1 },  forbidJunk:true,  timerSecByDiff:{ easy:10, normal:10, hard:12 } },
  { id:'m_combo',  title:'คอมโบเดือด! ทำคอมโบ 8',           targetByDiff:{ easy:8, normal:9, hard:10 }, forbidJunk:false, special:'combo' },
  { id:'m_guard',  title:'โล่พร้อม! บล็อกขยะ 2 ครั้ง',       targetByDiff:{ easy:2, normal:2, hard:3 },  forbidJunk:false, special:'guard' },
  { id:'m_boss',   title:'บอสมาแล้ว! ตีบอสให้แตก',           targetByDiff:{ easy:8, normal:10, hard:12 },forbidJunk:false, special:'boss' },
  { id:'m_focus',  title:'โฟกัส! เก็บของดี 10 ชิ้น',          targetByDiff:{ easy:9, normal:10, hard:11 }, forbidJunk:false },
  { id:'m_clean2', title:'คลีนอีกรอบ! ห้ามโดนขยะ 12 วิ',      targetByDiff:{ easy:1, normal:1, hard:1 },  forbidJunk:true,  timerSecByDiff:{ easy:12, normal:12, hard:14 } }
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
      out.push({ id:d.id||('g'+i), title:d.title||'Goal', cur:0, target:Math.max(1,Number(t)||1), done:false });
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
        id:d.id||('m'+i), title:d.title||'Mini',
        cur:0, target:Math.max(1,Number(t)||1), done:false,
        forbidJunk:!!d.forbidJunk, timerSec:Math.max(0,Number(timer)||0),
        special:d.special||''
      });
    }
    while(out.length < maxMini) out.push({ id:'m_auto_'+out.length, title:'Mini', cur:0, target:5, done:false, forbidJunk:false, timerSec:0, special:'' });
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
      goalMax: Q.activeGoal ? Q.activeGoal.target : 1,
      goalTarget: Q.activeGoal ? Q.activeGoal.target : 1,
      goalDone: Q.activeGoal ? !!Q.activeGoal.done : false,
      goalsCleared: Q.goalsCleared,
      goalsTotal: Q.goalsAll.length,

      miniCount: Q.miniCount,
      miniTitle: Q.activeMini ? Q.activeMini.title : '',
      miniCur: Q.activeMini ? Q.activeMini.cur : 0,
      miniMax: Q.activeMini ? Q.activeMini.target : 1,
      miniTarget: Q.activeMini ? Q.activeMini.target : 1,
      miniDone: Q.activeMini ? !!Q.activeMini.done : false,
      minisCleared: Q.minisCleared,
      minisTotal: Q.minisAll.length,

      miniForbidJunk: Q.activeMini ? !!Q.activeMini.forbidJunk : false,
      miniTimerSec: Q.activeMini ? (Q.activeMini.timerSec|0) : 0,
      miniEndsAtMs: Q.miniEndsAtMs|0,
      miniTLeft,

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
    if (gAll && mAll){ Q.allDone = true; push('all-done'); }
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
    if (m.timerSec > 0) Q.miniEndsAtMs = nowMs() + m.timerSec*1000;
    push('mini-fail:' + reason);
    return ui('mini-fail');
  }

  function addGoalProgress(n=1){
    const g = Q.activeGoal;
    if(!g || g.done || Q.allDone) return ui('goal-skip');
    g.cur = clamp(g.cur + (n|0), 0, g.target);
    if (g.cur >= g.target && !g.done){
      g.done = true; Q.goalsCleared++;
      push('goal-done'); checkAllDone();
    } else push('goal-progress');
    return ui('goal-progress');
  }

  function addMiniProgress(n=1){
    const m = Q.activeMini;
    if(!m || m.done || Q.allDone) return ui('mini-skip');
    m.cur = clamp(m.cur + (n|0), 0, m.target);
    if (m.cur >= m.target && !m.done){
      m.done = true; Q.minisCleared++;
      push('mini-done'); checkAllDone();
    } else push('mini-progress');
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
      g.done = true; Q.goalsCleared++;
      push('goal-complete-external'); checkAllDone();
    } else push('goal-external');
  }

  function getUIState(reason='state'){ return ui(reason); }

  return { start, tick, addGoalProgress, addMiniProgress, nextGoal, nextMini, failMini, onJunkHit, getUIState, setGoalExternal };
}

// ------------------------------ Main Boot ------------------------------
export function boot(opts = {}){
  if (!DOC) return;

  const q = { ...parseQuery(), ...(opts.query||{}) };

  const diff = String(q.diff || opts.diff || 'normal').toLowerCase(); // easy|normal|hard
  const run  = String(q.run  || opts.run  || 'play').toLowerCase();  // play|study
  const durationPlannedSec = clamp(Number(q.time || opts.time || 80), 20, 600) | 0;

  // Hardcore (0..5). Study locks 0.
  const hardReq = clamp(Number(q.hard ?? q.level ?? q.hc ?? 0), 0, 5) | 0;
  const hard = (run === 'study') ? 0 : hardReq;

  // deterministic seed
  const seedStr = String(q.seed || q.studentKey || q.studyId || q.sid || q.nick || ('gj-'+Date.now()));
  const seed = (Number(q.seed)|0) || hash32(seedStr);
  const rng = mulberry32(seed);

  const stage = byId('gj-stage') || qs('#gj-stage') || DOC.body;
  const layer = byId('gj-layer') || qs('#gj-layer') || DOC.body;

  const ringEl  = byId('atk-ring') || qs('#atk-ring') || null;
  const laserEl = byId('atk-laser') || qs('#atk-laser') || null;

  const elMeta  = byId('hudMeta') || byId('hud-meta') || null;

  const btnShoot = byId('btnShoot') || byId('btn-shoot') || qs('[data-shoot]') || null;

  const startOverlay = byId('startOverlay') || byId('start-overlay') || qs('.start-overlay') || null;
  const startBtn     = byId('btnStart') || byId('start-btn') || byId('btn-start') || qs('[data-start]') || null;
  const startMeta    = byId('startMeta') || byId('start-meta') || null;

  const elEndWrapExisting = byId('end-summary') || byId('gj-end') || byId('endSummary') || qs('.gj-end') || null;

  // ------------------------------ State ------------------------------
  const S = {
    started:false, ended:false,

    timeLeftSec: durationPlannedSec,
    durationPlannedSec,
    durationPlayedSec: 0,

    score:0, combo:0, comboMax:0, misses:0,

    nTargetGoodSpawned:0,
    nTargetJunkSpawned:0,
    nTargetStarSpawned:0,
    nTargetDiamondSpawned:0,
    nTargetShieldSpawned:0,

    nHitGood:0,
    nHitJunk:0,
    nHitJunkGuard:0,
    nExpireGood:0,

    rtGood: [],

    fever:0,
    shield:0,
    stunUntilMs:0,

    // boss
    bossAlive:false,
    bossHp:0,
    bossHpMax:0,
    bossId:null,

    diff, runMode:run, hard,
    missLimit:0,

    // adaptive (play only)
    adapt: {
      enabled: (run === 'play'),
      k: 0.50,
      good: 0,
      miss: 0,
      junk: 0,
      rtEwma: 520
    },

    // pattern director
    director: {
      mode:'warmup',
      nextPatternAtMs: 0,
      burstLeft: 0,
      burstIntervalMs: 120,
      lastPattern: '',
      // pressure pulses
      pulse: 0
    },

    // hazards
    hazard: {
      enabled: (run === 'play') && (hard >= 3), // study off
      active: false,
      type: '',
      t0: 0,
      dur: 0,
      cdUntil: 0,
      invulnUntil: 0,
      // ring
      r: 0,
      rMax: 0,
      thick: 22,
      // laser
      axis: 'x', // x=vertical beam (checks offsetX), y=horizontal beam (checks offsetY)
      pos: 0,
      speed: 0,
      // telegraph
      telegraphMs: 380
    },

    // internal timing
    tLastMs: 0,
    tStartIso:'',
    tEndIso:'',

    gameVersion: String(opts.gameVersion || q.ver || 'goodjunk.safe.js@prod-hardpack'),
    __coachCdMs: 0
  };

  // missLimit base (diff)
  const baseMiss = (diff === 'easy') ? 6 : (diff === 'hard' ? 3 : 4);
  // hard makes stricter a bit, but keep fair
  S.missLimit = clamp(baseMiss - ((hard >= 5) ? 1 : 0), 2, 9);

  // ------------------------------ Tuning (hard=0..5) ------------------------------
  function tune(){
    const h = hard|0;

    const drift = (h >= 4) ? (h === 4 ? 0.60 : 1.05) : 0;
    const baitJunk = (h >= 5) ? 0.42 : 0.0;

    return {
      hard: h,
      spawnMul: (h===0)?1.00:(h===1?0.97:(h===2?0.93:(h===3?0.86:(h===4?0.80:0.74)))),
      maxAdd:   (h<=1)?0:(h===2?1:(h===3?2:(h===4?2:3))),
      junkAdd:  (h===0)?0.00:(h===1?0.02:(h===2?0.04:(h===3?0.06:(h===4?0.08:0.10)))),
      shieldAdd:(h===0)?0.00:(h===1?-0.01:(h===2?-0.015:(h===3?-0.02:(h===4?-0.03:-0.04)))),
      sizeMul:  (h===0)?1.00:(h===1?0.99:(h===2?0.97:(h===3?0.95:(h===4?0.93:0.91)))),
      lifeMul:  (h===0)?1.00:(h===1?0.98:(h===2?0.95:(h===3?0.91:(h===4?0.87:0.83)))),
      aimPx:    (h===0)?10:(h===1?6:(h===2?2:(h===3?-4:(h===4?-10:-14)))),
      emptyPenalty: (h >= 4),

      feverGain: (h<=2)?1.00:(h===3?1.04:(h===4?1.07:1.10)),
      feverLoss: (h<=2)?1.00:(h===3?1.10:(h===4?1.16:1.22)),

      // director intensity
      patternBias: (h>=5 ? 1.0 : (h>=4 ? 0.85 : (h>=3 ? 0.70 : 0.55))),
      drift,
      baitJunk
    };
  }
  const T = tune();

  // ------------------------------ Playfield bounds + safe zones ------------------------------
  function getPlayRect(){
    const vw = ROOT.innerWidth || 360;
    const vh = ROOT.innerHeight || 640;

    // keep HUD safe
    const padTop = 96;
    const padBot = 86;
    const padSide = 18;

    let x0 = padSide, y0 = padTop;
    let x1 = vw - padSide, y1 = vh - padBot;
    let w = Math.max(120, x1 - x0);
    let h = Math.max(140, y1 - y0);

    // relax if too small (avoid "spawn same spot")
    const relax = (w < 220 || h < 220) ? 0.65 : 1.0;
    x0 *= relax; y0 *= relax;
    x1 = vw - (padSide*relax);
    y1 = vh - (padBot*relax);

    w = Math.max(120, x1 - x0);
    h = Math.max(140, y1 - y0);

    return { x0, y0, x1, y1, w, h, vw, vh };
  }
  function center(){
    const r = getPlayRect();
    return { cx: (r.vw*0.5), cy: (r.vh*0.5), vw:r.vw, vh:r.vh };
  }

  // ------------------------------ Targets map ------------------------------
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

  function adaptSize(px){
    const base = (diff === 'easy') ? 1.06 : (diff === 'hard' ? 0.92 : 1.00);
    const k = S.adapt.enabled ? clamp(S.adapt.k, 0, 1) : 0.50;
    const adaptMul = (S.adapt.enabled ? (1.14 - (k*0.30)) : 1.00);
    return px * base * adaptMul * (T.sizeMul || 1);
  }

  function adaptLife(ms){
    const base = (diff === 'easy') ? 1.10 : (diff === 'hard' ? 0.92 : 1.00);
    const k = S.adapt.enabled ? clamp(S.adapt.k, 0, 1) : 0.50;
    const adaptMul = (S.adapt.enabled ? (1.12 - (k*0.28)) : 1.00);
    return Math.round(ms * base * adaptMul * (T.lifeMul || 1));
  }

  function samplePos(type, forbidJunk){
    const rect = getPlayRect();
    const { cx, cy } = center();

    const doBait = (type === 'junk' || type === 'trap') && !forbidJunk && (T.baitJunk > 0) && (rng() < T.baitJunk);
    if (doBait){
      const rx = rect.w * 0.18;
      const ry = rect.h * 0.18;
      const x = clamp(cx + (rng()*2-1) * rx, rect.x0, rect.x1);
      const y = clamp(cy + (rng()*2-1) * ry, rect.y0, rect.y1);
      return { x, y };
    }

    const x = rect.x0 + rng()*rect.w;
    const y = rect.y0 + rng()*rect.h;
    return { x, y };
  }

  function buildTarget(type, x, y, forbidJunk=false){
    const baseSize = (diff === 'easy') ? 66 : (diff === 'hard' ? 54 : 60);
    let size = baseSize + (rng()*10 - 5);
    if (type === 'boss') size = (diff === 'easy') ? 120 : (diff === 'hard' ? 108 : 114);
    size = clamp(adaptSize(size), 42, 140);

    const tNow = nowMs();
    const lifeBase =
      (type === 'good') ? ((diff === 'easy') ? 2600 : (diff === 'hard' ? 2000 : 2300)) :
      (type === 'junk' || type === 'trap') ? ((diff === 'easy') ? 2400 : (diff === 'hard' ? 1900 : 2200)) :
      (type === 'shield') ? 2600 :
      (type === 'boss') ? 999999 : 2600;

    const lifeMs = (type === 'boss') ? 999999 : adaptLife(lifeBase);

    const emoji =
      (type === 'good') ? pick(['🍎','🥦','🥕','🍌','🍇','🍊','🍉','🥗']) :
      (type === 'junk') ? pick(['🍟','🍔','🍩','🍭','🥤','🍰']) :
      (type === 'trap') ? pick(['🧨','💣','🪤']) :
      (type === 'shield') ? '🛡️' :
      (type === 'boss') ? '😈' :
      '❓';

    const driftOn = (T.drift > 0) && (type !== 'boss');
    const vx = driftOn ? ((rng()*2-1) * (0.06 + 0.06*rng()) * T.drift) : 0;
    const vy = driftOn ? ((rng()*2-1) * (0.06 + 0.06*rng()) * T.drift) : 0;

    const id = nextId++;
    const t = {
      id, type, emoji,
      xView: x, yView: y,
      size,
      bornMs: tNow,
      expireMs: tNow + lifeMs,
      el: null,
      vx, vy
    };
    return t;
  }

  function spawnTarget(type, forbidJunk=false){
    if (S.ended) return null;
    const p = samplePos(type, forbidJunk);
    return spawnTargetAt(type, p.x, p.y, forbidJunk);
  }

  function spawnTargetAt(type, x, y, forbidJunk=false){
    if (S.ended) return null;
    const rect = getPlayRect();
    x = clamp(x, rect.x0, rect.x1);
    y = clamp(y, rect.y0, rect.y1);

    const t = buildTarget(type, x, y, forbidJunk);
    t.el = makeElTarget(t);
    targets.set(t.id, t);

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
      hard,
      gameVersion: S.gameVersion,
      seed: seed >>> 0,
      eventType: String(type || 'event'),
      ...a,
      ...b
    };
    try{
      if (CloudLogger && typeof CloudLogger.logEvent === 'function') CloudLogger.logEvent(payload);
      else if (CloudLogger && typeof CloudLogger.send === 'function') CloudLogger.send(payload);
      else dispatchWin('hha:log', payload);
    }catch(_){}
  }

  // ------------------------------ Coach / FX ------------------------------
  function coach(text, mood='neutral', sub=''){
    if (S.__coachCdMs > 0) return;
    S.__coachCdMs = 900;
    dispatchWin('hha:coach', { line:text, text, mood, sub });
  }

  function setFever(v){
    S.fever = clamp(v, 0, 100);
    try{ FeverUI.setFever?.(S.fever); }catch(_){}
    dispatchWin('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }

  function addShield(n=1){
    S.shield = clamp((S.shield|0) + (n|0), 0, 6);
    try{ FeverUI.setShield?.(S.shield); }catch(_){}
    dispatchWin('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }

  function stun(reason='hit'){
    const dur = 220 + ((S.fever/100) * 260);
    S.stunUntilMs = nowMs() + dur;
    DOC.body && DOC.body.classList.add('gj-stun');
    tryVibrate(35);
    try{ FeverUI.stun?.(S.fever, reason); }catch(_){}
    setTimeout(()=>{ try{ DOC.body && DOC.body.classList.remove('gj-stun'); }catch(_){} }, dur+60);
  }

  // ------------------------------ HUD events (FIXED payload names) ------------------------------
  function emitScore(reason='score'){
    const payload = {
      reason,
      score: S.score|0,
      scoreFinal: S.score|0,
      combo: S.combo|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,
      fever: S.fever|0,
      shield: S.shield|0,
      grade: (S.grade ?? null)
    };
    dispatchWin('hha:score', payload);
  }

  function emitTime(){
    const payload = {
      timeLeftSec: Math.ceil(S.timeLeftSec)|0,
      timeLeft: Math.ceil(S.timeLeftSec)|0,
      durationPlannedSec: S.durationPlannedSec|0
    };
    dispatchWin('hha:time', payload);
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

  // ------------------------------ Adaptive update ------------------------------
  function adaptUpdate(rtMs, kind){
    if (!S.adapt.enabled) return;

    S.adapt.good = Math.max(0, S.adapt.good - 0.008);
    S.adapt.miss = Math.max(0, S.adapt.miss - 0.006);
    S.adapt.junk = Math.max(0, S.adapt.junk - 0.006);

    if (kind === 'good') S.adapt.good += 1;
    if (kind === 'miss') S.adapt.miss += 1;
    if (kind === 'junk') S.adapt.junk += 1;

    if (Number.isFinite(rtMs)){
      const a = 0.10;
      S.adapt.rtEwma = (S.adapt.rtEwma*(1-a)) + (rtMs*a);
    }

    const g = S.adapt.good;
    const m = S.adapt.miss;
    const j = S.adapt.junk;
    const acc = g / Math.max(1, (g + m + j));
    const speed = clamp((780 - S.adapt.rtEwma) / 520, 0, 1);

    const base = (diff === 'easy') ? 0.38 : (diff === 'hard' ? 0.62 : 0.50);
    const hardBias = (hard * 0.035);
    const desired = clamp(base + hardBias + (acc*0.35) + (speed*0.25) - (j*0.04), 0.18, 0.96);

    S.adapt.k = (S.adapt.k*0.92) + (desired*0.08);
    dispatchWin('hha:adaptive', { k:S.adapt.k, acc, speed, rtEwma:Math.round(S.adapt.rtEwma) });
  }

  // ------------------------------ Boss ------------------------------
  function spawnBoss(){
    if (S.bossAlive || S.ended) return;
    S.bossAlive = true;
    S.bossHpMax = (diff === 'easy') ? 10 : (diff === 'hard' ? 14 : 12);
    if (hard >= 5) S.bossHpMax += 2;
    S.bossHp = S.bossHpMax;

    const t = spawnTarget('boss');
    if (!t) return;
    S.bossId = t.id;
    DOC.body && DOC.body.classList.add('gj-boss');

    coach('บอสโผล่! หลบ Ring/Laser แล้วตีให้แตก 😈', 'neutral', 'ลากจอเพื่อ “เอียงโลก” หลบให้ทัน!');
    logEvent('spawn', { itemType:'boss', emoji:'😈' }, { kind:'boss', hp:S.bossHp, hpMax:S.bossHpMax });
  }

  function despawnBoss(){
    if (!S.bossAlive) return;
    if (S.bossId) removeTarget(S.bossId);
    S.bossAlive = false;
    S.bossId = null;
    DOC.body && DOC.body.classList.remove('gj-boss');
  }

  function bossTakeHit(n=1){
    if (!S.bossAlive) return;
    S.bossHp = Math.max(0, (S.bossHp|0) - (n|0));

    addScore(14, 'BOSS');
    setFever(S.fever + (4 * (T.feverGain || 1)));
    stun('boss');
    emitScore();

    logEvent('hit',
      { targetId: null, emoji:'😈', itemType:'boss', judgment:'HIT', isGood: 1 },
      { kind:'boss', hp: S.bossHp, hpMax: S.bossHpMax }
    );

    // boss mini progress ONLY when boss mini active
    try{
      const ui = Q.getUIState('peek');
      const miniIsBoss = !!(ui && ui.miniTitle && ui.miniTitle.indexOf('บอส') >= 0);
      if (miniIsBoss){
        const mState = Q.addMiniProgress(1);
        if (mState.miniDone){
          Particles.celebrate?.('MINI');
          coach('Mini ผ่าน! โคตรโหด ⚡', 'happy', 'ต่ออีกอันเลย!');
          Q.nextMini();
        }
      }
    }catch(_){}

    if (S.bossHp <= 0){
      coach('บอสแตกแล้ว! เก่งมาก 🔥', 'happy', 'กลับไปเก็บของดีต่อ!');
      logEvent('event', { itemType:'boss', judgment:'DOWN' }, { kind:'boss_down' });
      despawnBoss();
    } else {
      const t = (S.bossId && targets.get(S.bossId)) ? targets.get(S.bossId) : null;
      if (t && t.el){
        try{ t.el.textContent = (S.bossHp <= 3) ? '😡' : '😈'; }catch(_){}
      }
    }
  }

  // ------------------------------ Pattern Spawn Director ------------------------------
  function directorMode(){
    // mode switching by time + performance
    const t = S.durationPlannedSec - S.timeLeftSec; // seconds elapsed
    const k = S.adapt.enabled ? clamp(S.adapt.k, 0, 1) : 0.5;

    // pulse ramps under hard 5
    S.director.pulse = clamp(S.director.pulse + (hard>=5 ? 0.0018 : 0.0012), 0, 1);

    // warmup (first 10s), pressure (middle), climax (last 18s)
    if (t < 10) return 'warmup';
    if (S.timeLeftSec <= 18) return 'climax';
    if (k >= 0.68 || hard >= 4) return 'pressure';
    return 'flow';
  }

  function patternWeights(forbidJunk){
    const k = S.adapt.enabled ? clamp(S.adapt.k, 0, 1) : 0.5;
    const mode = S.director.mode;

    // base weights
    let w = {
      burstGood: 1.0,
      burstMix:  0.9,
      wall:      0.8,
      swirl:     0.7,
      bait:      0.6,
      shieldLine:0.35
    };

    // mode bias
    if (mode === 'warmup'){
      w.burstGood += 0.8;
      w.wall -= 0.2;
      w.bait -= 0.2;
    }
    if (mode === 'flow'){
      w.swirl += 0.3;
      w.wall += 0.2;
    }
    if (mode === 'pressure'){
      w.wall += 0.6;
      w.burstMix += 0.5;
      w.bait += 0.4;
      w.swirl += 0.2;
    }
    if (mode === 'climax'){
      w.wall += 0.8;
      w.burstMix += 0.8;
      w.bait += 0.6;
      w.swirl += 0.4;
      w.shieldLine -= 0.10;
    }

    // performance
    w.wall += (k - 0.5) * 0.8;
    w.bait += (k - 0.5) * 0.6;

    // hard bias
    const hb = T.patternBias || 0.7;
    w.wall *= (0.85 + hb*0.35);
    w.burstMix *= (0.85 + hb*0.35);
    w.bait *= (0.80 + hb*0.40);

    // forbid junk mini: remove junk-heavy patterns
    if (forbidJunk){
      w.burstMix = 0.05;
      w.wall = 0.20;     // still can be good-wall
      w.bait = 0.00;
    }

    // ensure non-negative
    for (const k2 of Object.keys(w)) w[k2] = Math.max(0, w[k2]);
    return w;
  }

  function choosePattern(forbidJunk){
    const w = patternWeights(forbidJunk);
    // avoid repeating same pattern too often
    const last = S.director.lastPattern || '';
    if (last && w[last] != null) w[last] *= 0.55;

    const keys = Object.keys(w);
    const sum = keys.reduce((s,k)=>s+w[k],0);
    if (sum <= 0) return 'burstGood';

    let r = rng() * sum;
    for (const k of keys){
      r -= w[k];
      if (r <= 0) return k;
    }
    return keys[keys.length-1] || 'burstGood';
  }

  function patternBurstGood(n=4, forbidJunk=false){
    const rect = getPlayRect();
    const { cx, cy } = center();
    const rad = Math.min(rect.w, rect.h) * (0.18 + rng()*0.08);

    for (let i=0;i<n;i++){
      const a = (Math.PI*2) * ((i/n) + rng()*0.08);
      const x = cx + Math.cos(a)*rad + (rng()*18-9);
      const y = cy + Math.sin(a)*rad + (rng()*18-9);
      spawnTargetAt('good', x, y, forbidJunk);
    }
    if (!forbidJunk && rng() < 0.12) spawnTargetAt('shield', cx + (rng()*2-1)*rad*0.8, cy + (rng()*2-1)*rad*0.8, forbidJunk);
  }

  function patternBurstMix(forbidJunk=false){
    const rect = getPlayRect();
    const { cx, cy } = center();
    const rad = Math.min(rect.w, rect.h) * (0.20 + rng()*0.10);

    // goods
    const gN = (hard>=5) ? 3 : 4;
    for (let i=0;i<gN;i++){
      const a = (Math.PI*2) * ((i/gN) + rng()*0.06);
      spawnTargetAt('good', cx + Math.cos(a)*rad, cy + Math.sin(a)*rad, forbidJunk);
    }
    // junk near center ring
    if (!forbidJunk){
      const jN = (hard>=5) ? 2 : 1;
      for (let j=0;j<jN;j++){
        const a = (Math.PI*2) * rng();
        spawnTargetAt((rng()<0.20)?'trap':'junk', cx + Math.cos(a)*(rad*0.55), cy + Math.sin(a)*(rad*0.55), forbidJunk);
      }
    }
    if (rng() < 0.08) spawnTargetAt('shield', cx + (rng()*2-1)*rad*0.9, cy + (rng()*2-1)*rad*0.9, forbidJunk);
  }

  function patternWall(forbidJunk=false){
    const rect = getPlayRect();
    const { cx, cy } = center();
    const vertical = rng() < 0.5;

    const count = (hard>=5) ? 6 : 5;
    const span = vertical ? rect.h * 0.72 : rect.w * 0.78;

    for (let i=0;i<count;i++){
      const t = (i/(count-1)) - 0.5;
      const x = vertical ? (cx + (rng()*2-1)*24) : (cx + t*span);
      const y = vertical ? (cy + t*span) : (cy + (rng()*2-1)*24);

      // mix: mostly good, but hard adds junk blocks
      let type = 'good';
      if (!forbidJunk && hard>=4 && rng() < (hard>=5 ? 0.28 : 0.20)){
        type = (rng() < 0.22) ? 'trap' : 'junk';
      }
      spawnTargetAt(type, x, y, forbidJunk);
    }

    if (!forbidJunk && rng() < 0.12) spawnTargetAt('shield', cx + (rng()*2-1)*span*0.25, cy + (rng()*2-1)*span*0.25, forbidJunk);
  }

  function patternSwirl(forbidJunk=false){
    const rect = getPlayRect();
    const { cx, cy } = center();
    const baseR = Math.min(rect.w, rect.h) * (0.12 + rng()*0.08);
    const turns = (hard>=5) ? 10 : 8;

    for (let i=0;i<turns;i++){
      const k = i/(turns-1);
      const a = (Math.PI*2) * (k*1.2 + rng()*0.05);
      const r = baseR + k*baseR*2.2;
      const x = cx + Math.cos(a)*r;
      const y = cy + Math.sin(a)*r;
      spawnTargetAt('good', x, y, forbidJunk);
      if (!forbidJunk && hard>=5 && i%3===0 && rng()<0.35){
        spawnTargetAt((rng()<0.18)?'trap':'junk', cx + Math.cos(a)*(r*0.65), cy + Math.sin(a)*(r*0.65), forbidJunk);
      }
    }
  }

  function patternBait(forbidJunk=false){
    const rect = getPlayRect();
    const { cx, cy } = center();
    const r1 = Math.min(rect.w, rect.h) * 0.22;

    // 2 goods tempting near center line
    spawnTargetAt('good', cx + (rng()<0.5?-1:1)*(r1*0.55), cy + (rng()*2-1)*(r1*0.30), forbidJunk);
    spawnTargetAt('good', cx + (rng()*2-1)*(r1*0.30), cy + (rng()<0.5?-1:1)*(r1*0.55), forbidJunk);

    if (!forbidJunk){
      // junk traps near crosshair
      spawnTargetAt((rng()<0.25)?'trap':'junk', cx + (rng()*2-1)*18, cy + (rng()*2-1)*18, forbidJunk);
      if (hard>=5 && rng()<0.55){
        spawnTargetAt((rng()<0.25)?'trap':'junk', cx + (rng()*2-1)*26, cy + (rng()*2-1)*26, forbidJunk);
      }
    }
    if (rng() < 0.08) spawnTargetAt('shield', cx + (rng()*2-1)*r1, cy + (rng()*2-1)*r1, forbidJunk);
  }

  function patternShieldLine(forbidJunk=false){
    const rect = getPlayRect();
    const { cx, cy } = center();
    const count = 4;
    const span = rect.w * 0.55;

    // “ทางหนีทีไล่” ใส่โล่ + good line
    spawnTargetAt('shield', cx, cy + (rng()*2-1)*40, forbidJunk);
    for (let i=0;i<count;i++){
      const t = (i/(count-1)) - 0.5;
      spawnTargetAt('good', cx + t*span, cy + (rng()*2-1)*26, forbidJunk);
    }
  }

  function doPattern(forbidJunk){
    const name = choosePattern(forbidJunk);
    S.director.lastPattern = name;

    // scale by mode/hard
    const mode = S.director.mode;
    const k = S.adapt.enabled ? clamp(S.adapt.k, 0, 1) : 0.5;

    // burst size
    const burstN =
      (mode === 'warmup') ? 4 :
      (mode === 'flow')   ? (4 + (k>0.65?1:0)) :
      (mode === 'pressure') ? (5 + (hard>=5?1:0)) :
      (mode === 'climax') ? (6 + (hard>=5?1:0)) : 4;

    if (name === 'burstGood') patternBurstGood(burstN, forbidJunk);
    else if (name === 'burstMix') patternBurstMix(forbidJunk);
    else if (name === 'wall') patternWall(forbidJunk);
    else if (name === 'swirl') patternSwirl(forbidJunk);
    else if (name === 'bait') patternBait(forbidJunk);
    else if (name === 'shieldLine') patternShieldLine(forbidJunk);
    else patternBurstGood(burstN, forbidJunk);

    logEvent('pattern', { pattern:name, forbidJunk: forbidJunk?1:0 }, { mode, k: +k.toFixed(3) });
  }

  // ------------------------------ Hazards (Ring/Laser) ------------------------------
  function readStageOffset(){
    // parse translate3d(xpx, ypx, 0)
    let x = 0, y = 0;
    try{
      const tr = (stage && stage.style && stage.style.transform) ? stage.style.transform : '';
      const m = /translate3d\(\s*([-\d.]+)px,\s*([-\d.]+)px/i.exec(tr);
      if (m){
        x = Number(m[1]) || 0;
        y = Number(m[2]) || 0;
      } else {
        // fallback translate(xpx, ypx)
        const m2 = /translate\(\s*([-\d.]+)px,\s*([-\d.]+)px/i.exec(tr);
        if (m2){
          x = Number(m2[1]) || 0;
          y = Number(m2[2]) || 0;
        }
      }
    }catch(_){}
    return { x, y };
  }

  function hazardVisualOff(){
    if (ringEl){ ringEl.style.display = 'none'; ringEl.classList.remove('hz-on','hz-ring','hz-tele'); }
    if (laserEl){ laserEl.style.display = 'none'; laserEl.classList.remove('hz-on','hz-laser','hz-tele','hz-x','hz-y'); }
  }

  function hazardDamage(kind='hazard'){
    const h = S.hazard;
    const tNow = nowMs();
    if (tNow < h.invulnUntil) return;
    h.invulnUntil = tNow + 650; // anti multi-hit

    // shield blocks => NOT a miss
    if ((S.shield|0) > 0){
      S.nHitJunkGuard += 1;
      S.shield = Math.max(0, (S.shield|0) - 1);
      try{ FeverUI.setShield?.(S.shield); }catch(_){}
      addScore(6, 'GUARD');
      Particles.burstAt?.(ROOT.innerWidth*0.5, ROOT.innerHeight*0.5, 'GUARD');
      logEvent('hazard', { hazard:kind, judgment:'GUARD', isGood:1 }, {});
      emitScore('hazard-guard');
      return;
    }

    // unguarded => counts like junk hit => miss + reset combo
    S.nHitJunk += 1;
    S.misses += 1;
    S.combo = 0;

    setFever(S.fever - (16 * (T.feverLoss || 1)));
    stun(kind);
    Particles.burstAt?.(ROOT.innerWidth*0.5, ROOT.innerHeight*0.5, 'JUNK');
    logEvent('hazard', { hazard:kind, judgment:'HIT', isGood:0 }, {});
    adaptUpdate(null, 'junk');

    // forbid junk mini fails
    Q.onJunkHit();

    emitScore('hazard-hit');
    refreshSurviveGoal(false);
  }

  function hazardStart(type){
    const h = S.hazard;
    if (!h.enabled || S.ended) return;

    const tNow = nowMs();
    if (tNow < h.cdUntil) return;

    const { vw, vh } = center();
    h.active = true;
    h.type = type;
    h.t0 = tNow;
    h.dur = (type === 'ring') ? (hard>=5 ? 1600 : 1500) : (hard>=5 ? 1400 : 1300);
    h.cdUntil = tNow + h.dur + (hard>=5 ? 420 : 520);
    h.invulnUntil = tNow + 280;

    // telegraph quick
    const tele = h.telegraphMs|0;

    if (type === 'ring'){
      h.r = 0;
      h.rMax = Math.min(vw, vh) * 0.46;
      h.thick = (hard>=5 ? 26 : 24);

      if (ringEl){
        ringEl.style.display = 'block';
        ringEl.classList.add('hz-on','hz-tele','hz-ring');
        // force center
        ringEl.style.position = 'fixed';
        ringEl.style.left = '50%';
        ringEl.style.top  = '50%';
        ringEl.style.transform = 'translate(-50%,-50%)';
      }
      setTimeout(()=>{
        if (!S.hazard.active || S.hazard.type !== 'ring') return;
        ringEl && ringEl.classList.remove('hz-tele');
      }, tele);

      logEvent('hazardStart', { hazard:'ring' }, {});
      return;
    }

    if (type === 'laser'){
      // axis choose
      h.axis = (rng() < 0.5) ? 'x' : 'y';
      h.pos = (rng()*2-1) * (hard>=5 ? 18 : 14); // start near center
      h.speed = (hard>=5 ? 0.12 : 0.10) * (rng()<0.5?-1:1); // px per ms
      h.thick = (hard>=5 ? 22 : 20);

      if (laserEl){
        laserEl.style.display = 'block';
        laserEl.classList.add('hz-on','hz-tele','hz-laser', h.axis==='x'?'hz-x':'hz-y');
        laserEl.style.position = 'fixed';
        laserEl.style.left = '0';
        laserEl.style.top = '0';
        laserEl.style.width = '100vw';
        laserEl.style.height = '100vh';
        laserEl.style.pointerEvents = 'none';
      }
      setTimeout(()=>{
        if (!S.hazard.active || S.hazard.type !== 'laser') return;
        laserEl && laserEl.classList.remove('hz-tele');
      }, tele);

      logEvent('hazardStart', { hazard:'laser', axis:h.axis }, {});
      return;
    }
  }

  function hazardStop(){
    const h = S.hazard;
    if (!h.active) return;
    h.active = false;
    h.type = '';
    hazardVisualOff();
    logEvent('hazardStop', {}, {});
  }

  function hazardTick(dtMs){
    const h = S.hazard;
    if (!h.enabled || !h.active) return;

    const tNow = nowMs();
    const t = clamp((tNow - h.t0) / Math.max(1, h.dur), 0, 1);

    // during boss or hard 5: hazards are “serious”
    const off = readStageOffset();

    if (h.type === 'ring'){
      // expand out then fade
      h.r = h.rMax * (0.10 + 0.92*t);

      // draw
      if (ringEl){
        const d = Math.max(20, h.r * 2);
        ringEl.style.width = d + 'px';
        ringEl.style.height = d + 'px';
        ringEl.style.borderRadius = '999px';
        ringEl.style.border = `${Math.max(2, Math.round(h.thick/6))}px solid rgba(239,68,68,.55)`;
        ringEl.style.boxShadow = '0 0 40px rgba(239,68,68,.18)';
        ringEl.style.background = 'transparent';
        ringEl.style.opacity = String(0.85 - t*0.35);
      }

      // collision: player offset distance hits ring band
      const dist = hypot2(off.x, off.y);
      const band = h.thick * 0.55;
      if (Math.abs(dist - h.r) <= band){
        hazardDamage('ring');
      }

      if (t >= 1) hazardStop();
      return;
    }

    if (h.type === 'laser'){
      // sweep pos within [-maxShift,+maxShift]
      const maxShift = (hard>=5 ? 26 : 24);
      h.pos += h.speed * dtMs;
      if (h.pos > maxShift){ h.pos = maxShift; h.speed *= -1; }
      if (h.pos < -maxShift){ h.pos = -maxShift; h.speed *= -1; }

      // draw
      if (laserEl){
        const thick = h.thick;
        const a = (h.axis === 'x') ? 'X' : 'Y';
        laserEl.style.opacity = String(0.78 - t*0.28);

        if (h.axis === 'x'){
          // vertical beam at center + pos
          const x = (ROOT.innerWidth*0.5) + h.pos;
          laserEl.style.background = `linear-gradient(90deg,
            transparent calc(${x}px - ${thick}px),
            rgba(239,68,68,.55) calc(${x}px - ${Math.max(1, thick/2)}px),
            rgba(239,68,68,.90) ${x}px,
            rgba(239,68,68,.55) calc(${x}px + ${Math.max(1, thick/2)}px),
            transparent calc(${x}px + ${thick}px)
          )`;
        } else {
          const y = (ROOT.innerHeight*0.5) + h.pos;
          laserEl.style.background = `linear-gradient(0deg,
            transparent calc(${y}px - ${thick}px),
            rgba(239,68,68,.55) calc(${y}px - ${Math.max(1, thick/2)}px),
            rgba(239,68,68,.90) ${y}px,
            rgba(239,68,68,.55) calc(${y}px + ${Math.max(1, thick/2)}px),
            transparent calc(${y}px + ${thick}px)
          )`;
        }

        // subtle shake hint when telegraph off
        if (!laserEl.classList.contains('hz-tele') && hard>=5 && (t>0.15 && t<0.90)){
          // no heavy shaking; let CSS handle if exists
        }
      }

      // collision
      const band = h.thick * 0.55;
      if (h.axis === 'x'){
        if (Math.abs(off.x - h.pos) <= band) hazardDamage('laser');
      } else {
        if (Math.abs(off.y - h.pos) <= band) hazardDamage('laser');
      }

      if (t >= 1) hazardStop();
      return;
    }
  }

  function hazardMaybeTrigger(){
    if (!S.hazard.enabled || S.ended || !S.started) return;

    const bossMini = isBossMiniActive();
    const bossOn = bossMini || S.bossAlive;

    // boss phase: hazards frequent
    if (bossOn){
      if (!S.hazard.active){
        // alternate ring/laser
        hazardStart((rng()<0.52) ? 'ring' : 'laser');
      }
      return;
    }

    // non-boss: hard 5 gets occasional hazard bursts (pressure only)
    if (hard >= 5 && S.director.mode === 'pressure' && !S.hazard.active){
      if (rng() < 0.10) hazardStart((rng()<0.5)?'ring':'laser');
    }
    if (hard >= 4 && S.director.mode === 'climax' && !S.hazard.active){
      if (rng() < 0.14) hazardStart((rng()<0.5)?'ring':'laser');
    }
  }

  // ------------------------------ Hit logic ------------------------------
  function tryHitTarget(id){
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

      setFever(S.fever + (6 * (T.feverGain || 1)));
      Particles.burstAt?.(t.xView, t.yView, 'GOOD');
      logEvent('hit', { targetId: id, emoji:t.emoji, itemType:'good', judgment:'HIT', isGood:1 }, { rtMs: rt|0 });

      adaptUpdate(rt, 'good');

      const gState = Q.addGoalProgress(1);
      const gDone = !!gState.goalDone;

      // mini progress: boss mini handled only by boss hits
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

      if (gDone){
        Particles.celebrate?.('GOAL');
        coach('Goal ผ่านแล้ว! ไปต่อ 🔥', 'happy', 'งานหนักยังไม่จบ!');
        Q.nextGoal();
      }
      if (mDone){
        Particles.celebrate?.('MINI');
        coach('Mini ผ่าน! โคตรแรง ⚡', 'happy', 'ต่ออีกอัน!');
        Q.nextMini();
      } else {
        if ((S.combo|0) % 7 === 0) coach('คอมโบมาแล้ว! ดีมาก 🔥', 'happy', 'อย่าพลาด!');
      }

      emitScore('good-hit');
      refreshSurviveGoal(false);
      return;
    }

    if (t.type === 'shield'){
      addShield(1);
      addScore(10, 'SHIELD');
      Particles.burstAt?.(t.xView, t.yView, 'SHIELD');
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'shield', judgment:'HIT', isGood:1 }, {});
      emitScore('shield-hit');
      return;
    }

    if (t.type === 'junk' || t.type === 'trap'){
      // shield blocks => NOT miss
      if ((S.shield|0) > 0){
        S.nHitJunkGuard += 1;
        S.shield = Math.max(0, (S.shield|0) - 1);
        try{ FeverUI.setShield?.(S.shield); }catch(_){}
        addScore(6, 'GUARD');
        Particles.burstAt?.(t.xView, t.yView, 'GUARD');
        logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'junk', judgment:'GUARD', isGood:1 }, {});
        emitScore('junk-guard');
        return;
      }

      S.nHitJunk += 1;
      S.misses += 1;
      S.combo = 0;

      setFever(S.fever - (18 * (T.feverLoss || 1)));
      stun('junk');
      Particles.burstAt?.(t.xView, t.yView, 'JUNK');
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'junk', judgment:'HIT', isGood:0 }, {});
      adaptUpdate(null, 'junk');

      Q.onJunkHit();
      emitScore('junk-hit');
      refreshSurviveGoal(false);
      return;
    }
  }

  // ------------------------------ Spawn policy (base fill + director patterns) ------------------------------
  function getSpawnIntervalMs(){
    const base = (diff === 'easy') ? 360 : (diff === 'hard' ? 300 : 330);
    const k = S.adapt.enabled ? clamp(S.adapt.k, 0, 1) : 0.50;

    // director pulse adds pressure spikes
    const pulse = S.director.pulse || 0;
    const spike = (S.director.mode === 'pressure' || S.director.mode === 'climax') ? (1 - pulse*0.14) : 1;

    const adaptive = S.adapt.enabled ? (base + 70 - (k*120)) : base;
    return Math.round(adaptive * (T.spawnMul || 1) * spike);
  }

  function baseMaxOnScreen(){
    const k = S.adapt.enabled ? clamp(S.adapt.k, 0, 1) : 0.50;
    const baseMax = (diff === 'easy') ? 9 : (diff === 'hard' ? 10 : 9);
    return clamp(Math.round(baseMax + (S.adapt.enabled ? (-1 + k*3) : 0) + (T.maxAdd || 0)), 7, 14);
  }

  function spawnFillOnce(){
    if (S.ended || !S.started) return;

    const ui = Q.getUIState('peek');
    const forbidJunk = ui ? !!ui.miniForbidJunk : false;
    const bossMini = isBossMiniActive();

    // Boss mini keeps boss alive and also fill a bit
    if (bossMini){
      if (!S.bossAlive) spawnBoss();
      if (targets.size < (5 + (hard>=5?1:0))){
        spawnTarget('good', forbidJunk);
        if (!forbidJunk && rng() < 0.22) spawnTarget('junk', forbidJunk);
      }
      return;
    } else {
      // not in boss mini; boss can be off
      if (S.bossAlive) despawnBoss();
    }

    const maxOnScreen = baseMaxOnScreen();
    if (targets.size >= maxOnScreen) return;

    const k = S.adapt.enabled ? clamp(S.adapt.k, 0, 1) : 0.50;
    let junkRate = forbidJunk ? 0.08 : (diff === 'easy' ? 0.22 : (diff === 'hard' ? 0.28 : 0.24));
    let shieldRate = 0.07;

    if (S.adapt.enabled){
      junkRate += (k - 0.5) * 0.08;
      shieldRate += (0.5 - k) * 0.02;
    }

    junkRate = clamp(junkRate + (T.junkAdd || 0), 0.04, 0.48);
    shieldRate = clamp(shieldRate + (T.shieldAdd || 0), 0.02, 0.18);
    let goodRate = clamp(1.0 - junkRate - shieldRate, 0.30, 0.94);

    const r = rng();
    if (r < goodRate) spawnTarget('good', forbidJunk);
    else if (r < goodRate + shieldRate) spawnTarget('shield', forbidJunk);
    else spawnTarget((rng() < 0.14) ? 'trap' : 'junk', forbidJunk);
  }

  function directorTick(){
    if (S.ended || !S.started) return;

    // boss mini overrides pattern: hazards handled separately
    if (isBossMiniActive()) return;

    const ui = Q.getUIState('peek');
    const forbidJunk = ui ? !!ui.miniForbidJunk : false;

    S.director.mode = directorMode();

    const tNow = nowMs();
    if (!S.director.nextPatternAtMs) S.director.nextPatternAtMs = tNow + 1200;

    // schedule patterns: more frequent in pressure/climax
    const mode = S.director.mode;
    const k = S.adapt.enabled ? clamp(S.adapt.k, 0, 1) : 0.5;

    const baseGap =
      (mode === 'warmup') ? 2100 :
      (mode === 'flow') ? 1800 :
      (mode === 'pressure') ? (hard>=5 ? 1350 : 1500) :
      (mode === 'climax') ? (hard>=5 ? 1100 : 1250) : 1800;

    const perfGap = baseGap * (1.08 - (k*0.22)); // strong player => more often
    const gap = clamp(Math.round(perfGap), 900, 2400);

    if (tNow >= S.director.nextPatternAtMs){
      // do pattern only if not already over crowded
      const maxOnScreen = baseMaxOnScreen();
      if (targets.size < maxOnScreen - 1){
        doPattern(forbidJunk);
      }
      S.director.nextPatternAtMs = tNow + gap;
    }
  }

  // ------------------------------ Shooting (center aim + assist) ------------------------------
  function findTargetNearCenter(){
    const { cx, cy } = center();
    let best = null;
    let bestD2 = 1e18;

    for (const t of targets.values()){
      if (!t || !t.el) continue;
      const dx = t.xView - cx;
      const dy = t.yView - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2){ bestD2 = d2; best = t; }
    }
    if (!best) return null;

    const hitR = (best.size * 0.60) + 14 + (T.aimPx || 0);
    const ok = bestD2 <= (hitR*hitR);
    return ok ? best : null;
  }

  function shoot(){
    if (!S.started || S.ended) return;

    const t = findTargetNearCenter();
    if (t){
      tryHitTarget(t.id);
      return;
    }

    // empty shot penalty hard>=4
    if (T.emptyPenalty){
      S.combo = Math.max(0, (S.combo|0) - 1);
      setFever(S.fever - 2);
      emitScore('empty-shot');
    }
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
      const keep = ['studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode','schoolYear','semester','studentKey','schoolCode','nick','diff','run','hard'];
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

  function ensureEndWrap(){
    if (elEndWrapExisting) return elEndWrapExisting;
    const d = DOC.createElement('div');
    d.id = 'end-summary';
    d.style.position = 'fixed';
    d.style.inset = '0';
    d.style.zIndex = '9999';
    d.style.pointerEvents = 'auto';
    d.style.display = 'block';
    DOC.body.appendChild(d);
    return d;
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

    const elEnd = ensureEndWrap();
    const hubUrl = buildHubUrl();

    const html =
      `<div class="hha-end-card" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;">
        <div style="max-width:720px;width:min(720px,100%);background:rgba(2,6,23,.86);border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;backdrop-filter:blur(10px);box-shadow:0 20px 80px rgba(0,0,0,.45);">
          <div style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
            <div>
              <div style="font-weight:800;font-size:22px;">สรุปผล — GoodJunk VR</div>
              <div style="opacity:.78;margin-top:4px;">
                โหมด: ${escapeHtml(run)} • ระดับ: ${escapeHtml(diff)} • โหด: ${escapeHtml(String(hard))} • Session: ${escapeHtml(sessionId)}
              </div>
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

    setHtml(elEnd, html);

    const btn = elEnd.querySelector('[data-restart]');
    if (btn){
      btn.addEventListener('click', () => { try{ ROOT.location.reload(); }catch(_){ } }, { passive:true });
    }
  }

  function endGame(reason='time'){
    if (S.ended) return;
    S.ended = true;
    S.tEndIso = new Date().toISOString();

    refreshSurviveGoal(true);
    hazardStop();

    try{ DOC.body && DOC.body.classList.remove('gj-panic'); }catch(_){}
    try{ DOC.body && DOC.body.classList.remove('gj-stun'); }catch(_){}
    try{ DOC.body && DOC.body.classList.remove('gj-boss'); }catch(_){}

    const stats = computeStatsFinal();
    const grade = computeGrade(stats);
    S.grade = grade;

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
      hard,
      durationPlannedSec: S.durationPlannedSec|0,
      durationPlayedSec: S.durationPlayedSec|0,

      ...stats,
      grade,

      device: 'web',
      gameVersion: S.gameVersion,
      reason,
      startTimeIso: S.tStartIso,
      endTimeIso: S.tEndIso,

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
    emitScore('end');
  }

  // ------------------------------ Update loop ------------------------------
  let spawnAccMs = 0;

  function update(dtMs){
    if (!S.started || S.ended) return;

    S.__coachCdMs = Math.max(0, (S.__coachCdMs|0) - (dtMs|0));

    const ui = Q.tick();

    // time
    S.timeLeftSec = Math.max(0, S.timeLeftSec - (dtMs/1000));
    S.durationPlayedSec = Math.min(S.durationPlannedSec, Math.round(S.durationPlannedSec - S.timeLeftSec));

    // panic: near end or near miss limit
    const leftMiss = (S.missLimit|0) - (S.misses|0);
    if ((S.timeLeftSec <= 8 && S.timeLeftSec > 0) || (leftMiss <= 1 && leftMiss >= 0)){
      DOC.body && DOC.body.classList.add('gj-panic');
    } else {
      DOC.body && DOC.body.classList.remove('gj-panic');
    }

    // boss mini auto boss
    const bossMini = isBossMiniActive();
    if (bossMini && !S.bossAlive) spawnBoss();
    if (!bossMini && S.bossAlive) despawnBoss();

    // director patterns
    directorTick();

    // base spawn fill
    spawnAccMs += dtMs;
    const interval = getSpawnIntervalMs();
    while (spawnAccMs >= interval){
      spawnAccMs -= interval;
      spawnFillOnce();
    }

    // drift movement (hard>=4)
    if (T.drift > 0){
      const rect = getPlayRect();
      for (const t of targets.values()){
        if (!t || !t.el) continue;
        if (t.type === 'boss') continue;

        t.xView += t.vx * dtMs;
        t.yView += t.vy * dtMs;

        if (t.xView < rect.x0){ t.xView = rect.x0; t.vx *= -1; }
        if (t.xView > rect.x1){ t.xView = rect.x1; t.vx *= -1; }
        if (t.yView < rect.y0){ t.yView = rect.y0; t.vy *= -1; }
        if (t.yView > rect.y1){ t.yView = rect.y1; t.vy *= -1; }

        t.el.style.left = t.xView + 'px';
        t.el.style.top  = t.yView + 'px';
      }
    }

    // hazards
    hazardMaybeTrigger();
    hazardTick(dtMs);

    // expire targets
    const tNow = nowMs();
    for (const [id, t] of targets){
      if (t.type === 'boss') continue;
      if (tNow >= t.expireMs){
        if (t.type === 'good'){
          S.nExpireGood += 1;
          S.misses += 1;
          S.combo = 0;

          setFever(S.fever - (12 * (T.feverLoss || 1)));
          stun('expire');
          logEvent('miss', { targetId:id, emoji:t.emoji, itemType:'good', judgment:'EXPIRE', isGood:1 }, {});
          adaptUpdate(null, 'miss');

          emitScore('good-expire');
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
    if (!btnShoot) return;
    const h = (e)=>{ e.preventDefault(); shoot(); };
    btnShoot.addEventListener('pointerup', h, { passive:false });
    btnShoot.addEventListener('click', h, { passive:false });
  }

  // ------------------------------ Start gate ------------------------------
  function startGame(){
    if (S.started) return;
    S.started = true;
    S.tStartIso = new Date().toISOString();
    S.tLastMs = 0;
    S.timeLeftSec = S.durationPlannedSec;
    spawnAccMs = 0;

    // init hazard visuals off
    hazardVisualOff();

    // adapt initial k
    const base = (diff === 'easy') ? 0.40 : (diff === 'hard' ? 0.62 : 0.50);
    S.adapt.k = clamp(base + hard*0.03, 0.20, 0.90);

    // director schedule
    S.director.mode = 'warmup';
    S.director.nextPatternAtMs = nowMs() + 1200;
    S.director.lastPattern = '';

    setFever(10);
    addShield(0);

    coach(
      (hard >= 5)
        ? 'โหมดโหด 5! เป้าดริฟต์ + แพทเทิร์น + Ring/Laser 😈'
        : 'พร้อมลุย! เก็บของดี เลี่ยงขยะ 💥',
      'happy',
      (run === 'study') ? 'โหมดวิจัย: ล็อกเงื่อนไข' : `โหมดเล่น: adaptive=on • hard=${hard}`
    );

    emitScore('start');
    emitTime();
    logEvent('start', { reason:'start' }, { durationPlannedSec: S.durationPlannedSec|0 });

    // initial burst
    for (let i=0;i<3;i++) spawnTarget('good', false);
    if (rng() < 0.30) spawnTarget('shield', false);
    if (rng() < 0.22) spawnTarget('junk', false);

    refreshSurviveGoal(false);
    ROOT.requestAnimationFrame(loop);
  }

  function bindStart(){
    const metaText = `diff=${diff} • run=${run} • hard=${hard} • time=${S.durationPlannedSec}s • adaptive=${S.adapt.enabled ? 'on' : 'off'} • seed=${seed>>>0}`;
    if (elMeta) setTxt(elMeta, metaText);
    if (startMeta) setTxt(startMeta, metaText);

    if (!startOverlay && !startBtn){
      startGame();
      return;
    }

    try{ if (startOverlay) startOverlay.style.display = ''; }catch(_){}

    const go = () => {
      try{ if (startOverlay) startOverlay.style.display = 'none'; }catch(_){}
      startGame();
    };

    if (startBtn){
      startBtn.addEventListener('pointerup', (e)=>{ e.preventDefault(); go(); }, { passive:false });
      startBtn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, { passive:false });
    } else if (startOverlay){
      startOverlay.addEventListener('pointerup', (e)=>{ e.preventDefault(); go(); }, { passive:false });
      startOverlay.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, { passive:false });
    } else go();
  }

  // ------------------------------ Init ------------------------------
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

// Optional auto-boot if used that way
try{
  if (DOC && !ROOT.__HHA_GOODJUNK_BOOTED){
    ROOT.__HHA_GOODJUNK_BOOTED = true;
    const auto = DOC.documentElement && DOC.documentElement.hasAttribute('data-goodjunk-auto');
    if (auto) boot({});
  }
}catch(_){}
