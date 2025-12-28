/* === /herohealth/vr-goodjunk/goodjunk.safe.js ===
GoodJunkVR — PRODUCTION SAFE (B1+B2: Pressure ladder)
✅ Fix HUD events: hha:score(time/coach/quest) keys match hha-hud.js
✅ Fix mouse bug: world shift handled by touch-look (drag only)
✅ Warmup 2s + ramp faster (auto fun earlier)
✅ Shoot support: click targets OR press Shoot/Space (hit nearest to crosshair)
✅ Pressure ladder:
   - B1 = fair pressure (clear telegraph, faster cadence)
   - B2 = competitive (faster cadence + higher dodge threshold + HIT => shoot lock 0.6s + stronger penalty)
   - Auto ramp B1→B2 during boss mini (time/HP/dodge streak), auto fall back if too many hits
✅ Miss definition unchanged: good expired + junk hit (shield-guard doesn't count)
✅ Grade: SSS, SS, S, A, B, C
*/
'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ return (ROOT.performance && ROOT.performance.now) ? ROOT.performance.now() : Date.now(); }
function pick(arr, r){ return arr[(r()*arr.length)|0]; }
function byId(id){ return DOC ? DOC.getElementById(id) : null; }

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
function dispatch(name, detail){
  try{ DOC && DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

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

// ------------------------------ Goals & Minis ------------------------------
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

// ------------------------------ Quest Director (HUD keys-compatible) ------------------------------
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
      out.push({ id: d.id||('g'+i), title: d.title||'Goal', cur:0, max:Math.max(1, Number(t)||1), done:false });
    }
    while(out.length < maxGoals) out.push({ id:'g_auto_'+out.length, title:'Goal', cur:0, max:10, done:false });
    return out.slice(0,maxGoals);
  }

  function buildMinis(){
    const out = [];
    for (let i=0;i<miniDefs.length;i++){
      const d = miniDefs[i] || {};
      const t = (d.targetByDiff && d.targetByDiff[diff] != null) ? d.targetByDiff[diff] : d.target;
      const timer = (d.timerSecByDiff && d.timerSecByDiff[diff] != null) ? d.timerSecByDiff[diff] : d.timerSec;
      out.push({
        id: d.id||('m'+i),
        title: d.title||'Mini',
        cur:0,
        max: Math.max(1, Number(t)||1),
        done:false,
        forbidJunk: !!d.forbidJunk,
        timerSec: Math.max(0, Number(timer)||0),
        special: String(d.special||'')
      });
    }
    while(out.length < maxMini) out.push({ id:'m_auto_'+out.length, title:'Mini', cur:0, max:5, done:false, forbidJunk:false, timerSec:0, special:'' });
    return out.slice(0,maxMini);
  }

  function ui(reason='state'){
    const g = Q.activeGoal;
    const m = Q.activeMini;
    const left = (m && m.timerSec>0 && Q.miniEndsAtMs>0) ? Math.max(0, Math.ceil((Q.miniEndsAtMs - nowMs())/1000)) : null;

    return {
      reason,
      goalTitle: g ? g.title : 'Goal: —',
      goalCur: g ? (g.cur|0) : 0,
      goalMax: g ? (g.max|0) : 0,
      miniTitle: m ? m.title : 'Mini: —',
      miniCur: m ? (m.cur|0) : 0,
      miniMax: m ? (m.max|0) : 0,
      miniTLeft: left,
      goalsCleared: Q.goalsCleared|0,
      goalsTotal: Q.goalsAll.length|0,
      minisCleared: Q.minisCleared|0,
      minisTotal: Q.minisAll.length|0,
      miniForbidJunk: m ? !!m.forbidJunk : false,
      miniSpecial: m ? m.special : '',
      allDone: !!Q.allDone
    };
  }

  function push(reason){ dispatch('quest:update', ui(reason)); }

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
    Q.miniEndsAtMs = sec>0 ? (nowMs() + sec*1000) : 0;

    push('start');
  }

  function nextGoal(){
    if (Q.allDone) return;
    Q.goalIndex = clamp(Q.goalIndex+1, 0, Q.goalsAll.length);
    Q.activeGoal = Q.goalsAll[Q.goalIndex] || Q.activeGoal;
    push('next-goal');
  }

  function nextMini(){
    if (Q.allDone) return;
    Q.miniIndex = clamp(Q.miniIndex+1, 0, Q.minisAll.length);
    Q.activeMini = Q.minisAll[Q.miniIndex] || Q.activeMini;

    const sec = Q.activeMini ? (Q.activeMini.timerSec|0) : 0;
    Q.miniEndsAtMs = sec>0 ? (nowMs() + sec*1000) : 0;

    push('next-mini');
  }

  function checkAllDone(){
    if (Q.allDone) return;
    if (Q.goalsCleared >= Q.goalsAll.length && Q.minisCleared >= Q.minisAll.length){
      Q.allDone = true;
      push('all-done');
    }
  }

  function tick(){
    if (!Q.started || Q.allDone) return ui('tick-skip');
    const m = Q.activeMini;
    if (m && m.timerSec>0 && Q.miniEndsAtMs>0){
      const leftMs = Q.miniEndsAtMs - nowMs();
      if (leftMs <= 0 && !m.done){
        m.done = true;
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
    if (m.timerSec>0) Q.miniEndsAtMs = nowMs() + m.timerSec*1000;
    push('mini-fail:'+reason);
    return ui('mini-fail');
  }

  function addGoalProgress(n=1){
    const g = Q.activeGoal;
    if (!g || g.done || Q.allDone) return ui('goal-skip');
    g.cur = clamp(g.cur + (n|0), 0, g.max);
    if (g.cur >= g.max && !g.done){
      g.done = true; Q.goalsCleared++;
      push('goal-done'); checkAllDone();
    } else push('goal-progress');
    return ui('goal-progress');
  }

  function addMiniProgress(n=1){
    const m = Q.activeMini;
    if (!m || m.done || Q.allDone) return ui('mini-skip');
    m.cur = clamp(m.cur + (n|0), 0, m.max);
    if (m.cur >= m.max && !m.done){
      m.done = true; Q.minisCleared++;
      push('mini-done'); checkAllDone();
    } else push('mini-progress');
    return ui('mini-progress');
  }

  function onJunkHit(){
    const m = Q.activeMini;
    if (m && !m.done && m.forbidJunk && !Q.allDone) failMini('hit-junk');
  }

  // Engine-driven goal (Survive)
  function setGoalExternal(cur, max, done=false){
    const g = Q.activeGoal;
    if (!g || Q.allDone) return;
    g.max = Math.max(1, Number(max)||1);
    g.cur = clamp(Number(cur)||0, 0, g.max);
    if (done && !g.done){
      g.done = true; Q.goalsCleared++;
      push('goal-external-done'); checkAllDone();
    } else push('goal-external');
  }

  function getUIState(reason='peek'){ return ui(reason); }

  return { start, tick, nextGoal, nextMini, addGoalProgress, addMiniProgress, failMini, onJunkHit, setGoalExternal, getUIState };
}

// ------------------------------ Main Boot ------------------------------
export function boot(opts = {}){
  if (!DOC) return;

  const q = { ...parseQuery(), ...(opts.query||{}) };

  const diff = String(q.diff || opts.diff || 'normal').toLowerCase();       // easy|normal|hard|auto (optional)
  const run  = String(q.run  || opts.run  || 'play').toLowerCase();        // play|study
  const durationPlannedSec = clamp(Number(q.time || opts.time || 80), 20, 600) | 0;

  // deterministic seed
  const seedStr = String(q.seed || q.studentKey || q.studyId || q.sid || q.nick || ('gj-'+Date.now()));
  const seed = (Number(q.seed)|0) || hash32(seedStr);
  const rng = mulberry32(seed);

  // DOM refs
  const stage = byId('gj-stage') || DOC.body;
  const layer = byId('gj-layer') || stage;
  const ringEl  = byId('atk-ring');
  const laserEl = byId('atk-laser');
  const btnShoot = byId('btnShoot');

  const startOverlay = byId('startOverlay');
  const btnStart = byId('btnStart');

  const hudMeta = byId('hudMeta');
  if (hudMeta) hudMeta.textContent = `run=${run} • diff=${diff} • seed=${seed>>>0}`;

  // state
  const S = {
    started:false, ended:false,
    diff, runMode:run,
    durationPlannedSec,
    timeLeftSec: durationPlannedSec,
    durationPlayedSec: 0,

    score:0, combo:0, comboMax:0, misses:0,
    fever:0, shield:0,

    // logging counters
    nTargetGoodSpawned:0, nTargetJunkSpawned:0, nTargetStarSpawned:0, nTargetDiamondSpawned:0, nTargetShieldSpawned:0,
    nHitGood:0, nHitJunk:0, nHitJunkGuard:0, nExpireGood:0,
    rtGood:[],

    // hazards (B pressure)
    nHazardHit:0,
    hazardDodgeStreak:0,         // ✅ used to ramp B1→B2
    hazardLevel:1,               // 1=B1, 2=B2 (auto)
    bossStartMs:0,               // boss mini timing

    // B2: shoot lock (competitive)
    shootLockMs:0,

    // boss
    bossAlive:false, bossHp:0, bossHpMax:0, bossId:null,

    // survive
    missLimit: (diff==='easy') ? 6 : (diff==='hard' ? 3 : 4),

    // pacing (faster auto)
    warmupSec: 2,
    warmupCap: 2,
    rampSec: 14,

    // adaptive
    __adptT: 0,
    __af: 1.0,          // adaptive factor (B keeps density stable; affects hazard cadence + little spawn rate)
    __profile: 'safe',  // safe|hero in auto

    // timers
    tStartIso:'', tEndIso:'', tLastMs:0,
    spawnAccMs:0,
    __coachCdMs:0,

    gameVersion: String(opts.gameVersion || q.ver || 'goodjunk.safe.js@B1B2')
  };

  // session id
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
      seed: seed>>>0,
      eventType: String(type||'event'),
      ...a, ...b
    };

    try{
      if (CloudLogger && typeof CloudLogger.logEvent === 'function') CloudLogger.logEvent(payload);
      else if (CloudLogger && typeof CloudLogger.send === 'function') CloudLogger.send(payload);
      else dispatch('hha:log', payload);
    }catch(_){}
  }

  function coach(line, mood='neutral', sub=''){
    if (S.__coachCdMs > 0) return;
    S.__coachCdMs = 900;
    dispatch('hha:coach', { line, mood, sub }); // ✅ matches hha-hud.js
  }

  function setFever(v){
    S.fever = clamp(v, 0, 100);
    try{ FeverUI.setFever?.(S.fever); }catch(_){}
    dispatch('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }

  function addShield(n=1){
    S.shield = clamp((S.shield|0) + (n|0), 0, 6);
    try{ FeverUI.setShield?.(S.shield); }catch(_){}
    dispatch('hha:fever', { fever:S.fever|0, shield:S.shield|0 });
  }

  function stun(reason='hit'){
    const dur = 220 + ((S.fever/100) * 260);
    try{ DOC.body && DOC.body.classList.add('gj-stun'); }catch(_){}
    try{ FeverUI.stun?.(S.fever, reason); }catch(_){}
    setTimeout(()=>{ try{ DOC.body && DOC.body.classList.remove('gj-stun'); }catch(_){} }, dur+60);
  }

  function emitScore(reason='score'){
    const payload = {
      reason,
      score: S.score|0,          // ✅ HUD reads d.score
      scoreFinal: S.score|0,     // keep for summary/log
      combo: S.combo|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,
      fever: S.fever|0,
      shield: S.shield|0,
      grade: S.grade ?? null
    };
    dispatch('hha:score', payload);
  }

  function emitTime(){
    const t = Math.max(0, Math.ceil(S.timeLeftSec));
    const payload = { timeLeft: t, timeLeftSec: t, durationPlannedSec: S.durationPlannedSec|0 };
    dispatch('hha:time', payload);
  }

  function addScore(points, why='hit'){
    S.score = (S.score|0) + (points|0);
    if (points > 0) Particles.scorePop?.(points, why);
  }

  // ------------------------------ Play rect (avoid HUD) ------------------------------
  function getPlayRect(){
    const vw = ROOT.innerWidth || 360;
    const vh = ROOT.innerHeight || 640;

    const padTop  = 150; // top HUD
    const padBot  = 110; // bottom controls
    const padSide = 20;

    const x0 = padSide;
    const y0 = padTop;
    const x1 = vw - padSide;
    const y1 = vh - padBot;

    const w = Math.max(160, x1-x0);
    const h = Math.max(180, y1-y0);

    const relax = (w < 240 || h < 240) ? 0.7 : 1.0;

    return {
      x0: x0*relax,
      y0: y0*relax,
      w : Math.max(160, (vw - (padSide*2*relax))),
      h : Math.max(180, (vh - (padTop*relax) - (padBot*relax)))
    };
  }

  // ------------------------------ Targets ------------------------------
  const targets = new Map();
  let nextId = 1;

  function makeElTarget(t){
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'gj-target gj-' + t.type;
    el.dataset.tid = String(t.id);
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

    el.style.border = '1px solid rgba(148,163,184,.25)';
    el.style.background = 'rgba(2,6,23,.40)';
    el.style.backdropFilter = 'blur(6px)';
    el.style.fontSize = Math.max(18, (t.size*0.55)) + 'px';
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
      el.style.fontSize = Math.max(22, (t.size*0.46)) + 'px';
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

    const baseSize = (diff==='easy') ? 66 : (diff==='hard' ? 54 : 60);
    let size = baseSize + (rng()*10 - 5);

    if (type === 'boss') size = (diff==='easy') ? 120 : (diff==='hard' ? 108 : 114);
    size = clamp(size, 44, 140);

    const x = rect.x0 + rng()*rect.w;
    const y = rect.y0 + rng()*rect.h;

    const id = nextId++;
    const tNow = nowMs();

    const lifeMs =
      (type === 'good') ? ((diff==='easy') ? 2600 : (diff==='hard' ? 2000 : 2300)) :
      (type === 'junk' || type === 'trap') ? ((diff==='easy') ? 2400 : (diff==='hard' ? 1900 : 2200)) :
      (type === 'shield') ? 2600 :
      (type === 'boss') ? 999999 :
      2600;

    const emoji =
      (type === 'good') ? pick(['🍎','🥦','🥕','🍌','🍇','🍊','🍉','🥗'], rng) :
      (type === 'junk') ? pick(['🍟','🍔','🍩','🍭','🥤','🍰'], rng) :
      (type === 'trap') ? pick(['🧨','💣','🪤'], rng) :
      (type === 'shield') ? '🛡️' :
      (type === 'boss') ? '😈' :
      '❓';

    const t = { id, type, emoji, xView:x, yView:y, size, bornMs:tNow, expireMs:tNow+lifeMs, el:null };
    t.el = makeElTarget(t);

    targets.set(id, t);
    try{ layer.appendChild(t.el); }catch(_){}

    if (type==='good') S.nTargetGoodSpawned++;
    if (type==='junk' || type==='trap') S.nTargetJunkSpawned++;
    if (type==='shield') S.nTargetShieldSpawned++;

    return t;
  }

  // ------------------------------ Boss ------------------------------
  function spawnBoss(){
    if (S.bossAlive || S.ended) return;
    S.bossAlive = true;
    S.bossHpMax = (diff==='easy') ? 10 : (diff==='hard' ? 14 : 12);
    S.bossHp = S.bossHpMax;

    S.bossStartMs = nowMs();
    S.hazardDodgeStreak = 0;
    S.hazardLevel = 1;

    const t = spawnTarget('boss');
    if (!t) return;
    S.bossId = t.id;

    coach('บอสโผล่! หลบ Ring/Laser แล้วตีให้แตก 😈', 'neutral', 'ลากค้างเพื่อเอียงโลก (Dodge)');
    logEvent('spawn', { itemType:'boss', emoji:'😈' }, { kind:'boss', hp:S.bossHp, hpMax:S.bossHpMax });
  }
  function despawnBoss(){
    if (!S.bossAlive) return;
    if (S.bossId) removeTarget(S.bossId);
    S.bossAlive = false;
    S.bossId = null;
    S.bossStartMs = 0;
    S.hazardDodgeStreak = 0;
    S.hazardLevel = 1;
  }

  // ------------------------------ Quest ------------------------------
  const goalDefs = (opts.goalDefs || DEFAULT_GOALS).map(g=>({ ...g }));
  const miniDefs = (opts.miniDefs || DEFAULT_MINIS).map(m=>({ ...m }));

  const Q = makeQuestDirector({
    diff, goalDefs, miniDefs,
    maxGoals: goalDefs.length,
    maxMini: miniDefs.length
  });
  Q.start();

  function isBossMiniActive(){
    try{
      const ui = Q.getUIState('peek');
      return !!(ui && ui.miniTitle && ui.miniTitle.indexOf('บอส') >= 0);
    }catch(_){}
    return false;
  }

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

  // ------------------------------ Pressure B1+B2: Ring/Laser hazards ------------------------------
  const HZ = {
    active:false,
    ringWarnAt:0, ringFireAt:0, ringNextAt:0,
    laserWarnAt:0, laserFireAt:0, laserNextAt:0,
    laserAxis:'x', laserDir: 1
  };

  function getShift(){
    const s = ROOT.__HHA_VIEW_SHIFT__ || {x:0,y:0,pxX:0,pxY:0};
    return { x: clamp(s.x, -1, 1), y: clamp(s.y, -1, 1) };
  }

  function ringShow(state){
    if (!ringEl) return;
    ringEl.style.display = 'block';
    ringEl.dataset.state = state;
    ringEl.classList.remove('atk-warn','atk-fire');
    if (state === 'warn') ringEl.classList.add('atk-warn');
    if (state === 'fire') ringEl.classList.add('atk-fire');
    if (state === 'off'){
      ringEl.style.display = 'none';
      ringEl.classList.remove('atk-warn','atk-fire');
    }
  }

  function laserShow(state){
    if (!laserEl) return;
    laserEl.style.display = 'block';
    laserEl.dataset.state = state;
    laserEl.classList.remove('atk-warn','atk-fire','atk-x','atk-y','atk-dir-1','atk-dir--1');
    laserEl.classList.add(HZ.laserAxis === 'x' ? 'atk-x' : 'atk-y');
    laserEl.classList.add(HZ.laserDir === 1 ? 'atk-dir-1' : 'atk-dir--1');
    if (state === 'warn') laserEl.classList.add('atk-warn');
    if (state === 'fire') laserEl.classList.add('atk-fire');
    if (state === 'off'){
      laserEl.style.display = 'none';
      laserEl.classList.remove('atk-warn','atk-fire','atk-x','atk-y','atk-dir-1','atk-dir--1');
    }
  }

  // ✅ ladder logic: B1->B2 (auto) and fallback
  function computeHazardLevel(){
    if (!isBossMiniActive()) return 1;

    // time in boss
    const tNow = nowMs();
    const bossT = (S.bossStartMs>0) ? (tNow - S.bossStartMs) : 0;
    const hpFrac = (S.bossHpMax>0) ? (S.bossHp / S.bossHpMax) : 1;

    // promote conditions
    const timePromote = bossT >= 6500;              // ~6.5s in boss
    const hpPromote   = hpFrac <= 0.55;             // boss below 55%
    const streakPromote = (S.hazardDodgeStreak|0) >= 2;

    // fallback if getting hit too often
    const hitTooMuch = (S.nHazardHit|0) >= 3 && (S.hazardDodgeStreak|0) === 0;

    let lvl = S.hazardLevel|0;
    if (hitTooMuch) lvl = 1;
    else if (timePromote || hpPromote || streakPromote) lvl = 2;
    else lvl = 1;

    S.hazardLevel = lvl;
    return lvl;
  }

  function hazardCadenceScale(level){
    // base cadence from adaptive + fever
    const feverBoost = (S.fever >= 70) ? 0.90 : (S.fever >= 40 ? 0.96 : 1.0);
    const af = clamp(S.__af, 0.90, 1.15);

    // lower = faster
    let base = clamp((1.10 - (af-1.0)*0.9) * feverBoost, 0.78, 1.05);

    // B1 faster, B2 faster+ (competitive)
    if (level === 2) base *= 0.86;
    else base *= 0.94;

    return clamp(base, 0.68, 1.05);
  }

  function hazardNeed(level, kind){
    // B2 needs more precise dodge
    const add = (level===2) ? 0.05 : 0.0;

    if (kind === 'ring'){
      const base = (diff==='easy') ? 0.22 : (diff==='hard' ? 0.30 : 0.26);
      return clamp(base + add, 0.18, 0.42);
    }

    // laser axis-specific
    const base = (diff==='easy') ? 0.20 : (diff==='hard' ? 0.28 : 0.24);
    return clamp(base + add, 0.16, 0.40);
  }

  function hazardWarnMs(level){
    // B2 telegraph shorter (harder)
    return (level===2) ? 420 : 520;
  }

  function applyHazardHit(kind, level){
    // IMPORTANT: do NOT count as miss (keep HHA miss definition stable)
    S.nHazardHit += 1;
    S.hazardDodgeStreak = 0;

    // competitive penalties (B2)
    const scorePenalty = (level===2) ? -10 : -6;
    const feverDrop = (level===2) ? 20 : 14;

    S.combo = 0;
    setFever(S.fever - feverDrop);
    stun(kind);

    // B2: lock shooting briefly
    if (level===2){
      S.shootLockMs = Math.max(S.shootLockMs|0, 650);
      try{ DOC.body && DOC.body.classList.add('gj-shootlock'); }catch(_){}
      coach('โดนหนัก! ยิงติดล็อก 0.6 วิ 😵', 'fever', 'ตั้งสติ แล้วหลบให้ทัน!');
    } else {
      coach('โดนแรงกดดัน! หลบด้วยการ “เอียงโลก” 😵‍💫', 'fever', 'ลากค้างแล้วดึงจอไปด้านข้าง/บนล่าง');
    }

    addScore(scorePenalty, 'HAZARD');
    Particles.burstAt?.((ROOT.innerWidth||360)/2, (ROOT.innerHeight||640)/2, 'TRAP');

    logEvent('hazard', { itemType: kind, judgment:'HIT', isGood:0 }, { level, nHazardHit:S.nHazardHit|0 });
    emitScore('hazard');
  }

  function applyHazardDodge(kind, level){
    S.hazardDodgeStreak = clamp((S.hazardDodgeStreak|0) + 1, 0, 9);

    // B2 gives a bit more reward (feel “pro”)
    const pts = (level===2) ? 7 : 5;
    addScore(pts, 'DODGE');

    logEvent('hazard', { itemType: kind, judgment:'DODGE', isGood:1 }, { level, streak:S.hazardDodgeStreak|0 });

    if (level===2){
      coach('หลบโหด! ตอนนี้เป็น “B2” แล้ว 🔥', 'happy', 'เทเลกราฟสั้นลง—ต้องไว!');
    } else if ((S.comboMax|0) < 6) {
      coach('หลบได้! โหดแบบเกมจริง 🔥', 'happy', 'หลบแล้วกลับมายิงต่อ!');
    }

    emitScore('dodge');
  }

  function hazardUpdate(tNow){
    const boss = isBossMiniActive();

    if (!boss){
      if (HZ.active){
        HZ.active = false;
        ringShow('off');
        laserShow('off');
      }
      return;
    }

    const level = computeHazardLevel();
    const s = hazardCadenceScale(level);
    const warnMs = hazardWarnMs(level);

    if (!HZ.active){
      HZ.active = true;
      HZ.ringNextAt  = tNow + 900 * s;
      HZ.laserNextAt = tNow + 1200 * s;
    }

    // ---- RING ----
    if (tNow >= HZ.ringNextAt && HZ.ringWarnAt === 0 && HZ.ringFireAt === 0){
      HZ.ringWarnAt = tNow;
      HZ.ringFireAt = tNow + warnMs;
      ringShow('warn');
    }
    if (HZ.ringFireAt && tNow >= HZ.ringFireAt){
      ringShow('fire');

      const sh = getShift();
      const mag = Math.hypot(sh.x, sh.y);
      const need = hazardNeed(level, 'ring');

      if (mag >= need) applyHazardDodge('ring', level);
      else applyHazardHit('ring', level);

      HZ.ringWarnAt = 0;
      HZ.ringFireAt = 0;

      // cadence (B2 faster)
      const baseNext = (diff==='easy') ? 2400 : diff==='hard' ? 1800 : 2100;
      HZ.ringNextAt = tNow + baseNext * s;

      setTimeout(()=>ringShow('off'), 170);
    }

    // ---- LASER ----
    if (tNow >= HZ.laserNextAt && HZ.laserWarnAt === 0 && HZ.laserFireAt === 0){
      HZ.laserAxis = (Math.random() < 0.5) ? 'x' : 'y';
      HZ.laserDir  = (Math.random() < 0.5) ? 1 : -1;
      HZ.laserWarnAt = tNow;
      HZ.laserFireAt = tNow + warnMs;
      laserShow('warn');
    }
    if (HZ.laserFireAt && tNow >= HZ.laserFireAt){
      laserShow('fire');

      const sh = getShift();
      const axisVal = (HZ.laserAxis === 'x') ? Math.abs(sh.x) : Math.abs(sh.y);
      const need = hazardNeed(level, 'laser');

      if (axisVal >= need) applyHazardDodge('laser', level);
      else applyHazardHit('laser', level);

      HZ.laserWarnAt = 0;
      HZ.laserFireAt = 0;

      const baseNext = (diff==='easy') ? 2900 : diff==='hard' ? 2200 : 2550;
      HZ.laserNextAt = tNow + baseNext * s;

      setTimeout(()=>laserShow('off'), 160);
    }
  }

  // ------------------------------ Adaptive (optional, faster) ------------------------------
  function adaptiveStep(dtMs){
    if (run !== 'play' || diff !== 'auto') return;
    S.__adptT += dtMs;
    if (S.__adptT < 2500) return; // quicker
    S.__adptT = 0;

    const played = (S.durationPlayedSec|0);
    if (played < 12){
      S.__profile = 'safe';
      S.__af = 0.98;
      return;
    }

    const nGood = S.nHitGood|0;
    const nExpire = S.nExpireGood|0;
    const denom = Math.max(1, nGood + nExpire);
    const acc = nGood / denom;
    const missRate = (S.misses|0) / Math.max(1, (nGood + (S.nHitJunk|0) + nExpire));

    if (acc >= 0.76 && missRate <= 0.22 && (S.comboMax|0) >= 6) S.__profile = 'hero';
    else if (acc <= 0.64 || missRate >= 0.30) S.__profile = 'safe';

    let f = S.__af;
    if (acc >= 0.78 && missRate <= 0.22) f += 0.045;
    else if (acc <= 0.64 || missRate >= 0.30) f -= 0.055;
    S.__af = clamp(f, 0.90, 1.15);
  }

  // ------------------------------ Hit Logic ------------------------------
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

      const base = (diff==='easy') ? 18 : (diff==='hard' ? 24 : 20);
      const comboBonus = Math.min(18, (S.combo|0)) * 2;
      addScore(base + comboBonus, 'GOOD');

      S.combo = (S.combo|0) + 1;
      S.comboMax = Math.max(S.comboMax|0, S.combo|0);
      setFever(S.fever + 6);

      Particles.burstAt?.(t.xView, t.yView, 'GOOD');
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'good', judgment:'HIT', isGood:1 }, { rtMs:rt|0 });

      const gUI = Q.addGoalProgress(1);
      const gDone = !!gUI && (gUI.reason === 'goal-done');

      let mDone = false;
      const ui = Q.getUIState('peek');
      const miniIsBoss = !!(ui && ui.miniTitle && ui.miniTitle.indexOf('บอส') >= 0);
      if (!miniIsBoss){
        const mUI = Q.addMiniProgress(1);
        mDone = !!mUI && (mUI.reason === 'mini-done');
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
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'shield', judgment:'HIT', isGood:1 }, {});
      emitScore('shield');
      return;
    }

    if (t.type === 'junk' || t.type === 'trap'){
      if ((S.shield|0) > 0){
        S.nHitJunkGuard += 1;
        S.shield = Math.max(0, (S.shield|0) - 1);
        try{ FeverUI.setShield?.(S.shield); }catch(_){}
        addScore(6, 'GUARD');
        Particles.burstAt?.(t.xView, t.yView, 'GUARD');
        logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'junk', judgment:'GUARD', isGood:1 }, {});
        emitScore('guard');
        return;
      }

      // miss
      S.nHitJunk += 1;
      S.misses += 1;
      S.combo = 0;
      setFever(S.fever - 18);
      stun('junk');
      Particles.burstAt?.(t.xView, t.yView, 'JUNK');
      logEvent('hit', { targetId:id, emoji:t.emoji, itemType:'junk', judgment:'HIT', isGood:0 }, {});

      Q.onJunkHit();
      emitScore('junk');
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
    emitScore('boss');

    logEvent('hit',
      { targetId:null, emoji:'😈', itemType:'boss', judgment:'HIT', isGood:1 },
      { kind:'boss', hp:S.bossHp, hpMax:S.bossHpMax }
    );

    try{
      const ui = Q.getUIState('peek');
      const miniIsBoss = !!(ui && ui.miniTitle && ui.miniTitle.indexOf('บอส') >= 0);
      if (miniIsBoss){
        const mUI = Q.addMiniProgress(1);
        const done = !!mUI && (mUI.reason === 'mini-done');
        if (done){
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

  // ------------------------------ Spawn plan (NOT dense; B uses hazards) ------------------------------
  function getSpawnPlan(){
    const played = S.durationPlayedSec|0;

    let capBase  = (diff==='easy') ? 5 : (diff==='hard' ? 7 : 6);
    let rateBase = (diff==='easy') ? 0.85 : (diff==='hard' ? 1.05 : 0.95); // targets/sec

    let cap = (played < S.warmupSec) ? S.warmupCap : capBase;
    const rampT = clamp((played - S.warmupSec) / Math.max(1, S.rampSec), 0, 1);
    const rate = rateBase * (0.55 + 0.45*rampT);

    const af = clamp(S.__af, 0.90, 1.15);
    const rate2 = clamp(rate * (0.92 + (af-1.0)*0.55), 0.55, 1.20);

    const ui = Q.getUIState('peek');
    const forbidJunk = ui ? !!ui.miniForbidJunk : false;

    const junkRate = forbidJunk ? 0.07 : (diff==='easy' ? 0.20 : diff==='hard' ? 0.26 : 0.23);
    const shieldRate = 0.07;
    const goodRate = 1.0 - junkRate - shieldRate;

    return { cap, rate: rate2, goodRate, junkRate, shieldRate, forbidJunk };
  }

  function spawnOne(){
    if (S.ended || !S.started) return;

    if (isBossMiniActive()){
      if (!S.bossAlive) spawnBoss();
      if (targets.size < 5){
        spawnTarget('good');
        if (rng() < 0.20) spawnTarget('junk');
      }
      return;
    } else {
      if (S.bossAlive) despawnBoss();
    }

    const plan = getSpawnPlan();
    if (targets.size >= plan.cap) return;

    const r = rng();
    if (r < plan.goodRate) spawnTarget('good');
    else if (r < plan.goodRate + plan.shieldRate) spawnTarget('shield');
    else spawnTarget((rng() < 0.12) ? 'trap' : 'junk');
  }

  // ------------------------------ Shoot (button/space hits nearest to crosshair) ------------------------------
  function shoot(){
    if (!S.started || S.ended) return;

    // ✅ B2 shoot lock
    if ((S.shootLockMs|0) > 0){
      logEvent('shoot', { judgment:'LOCK' }, { lockMs:S.shootLockMs|0 });
      return;
    }

    const cx = (ROOT.innerWidth || 360) / 2;
    const cy = (ROOT.innerHeight || 640) / 2;

    const baseR = (diff==='easy') ? 98 : (diff==='hard' ? 78 : 88);
    const r2 = baseR * baseR;

    let best = null;
    let bestD = 1e18;

    for (const [id, t] of targets){
      const dx = t.xView - cx;
      const dy = t.yView - cy;
      const d = dx*dx + dy*dy;
      if (d < bestD){
        bestD = d;
        best = t;
      }
    }

    if (best && bestD <= r2){
      tryHitTarget(best.id, { via:'shoot', dPx: Math.round(Math.sqrt(bestD)) });
    } else {
      logEvent('shoot', { judgment:'MISS' }, {});
    }
  }

  function bindInputs(){
    layer.addEventListener('pointerup', (ev)=>{
      if (!S.started || S.ended) return;
      const el = ev.target && ev.target.closest ? ev.target.closest('.gj-target') : null;
      if (!el) return;
      const id = Number(el.dataset.tid)||0;
      if (!id) return;
      ev.preventDefault(); ev.stopPropagation();

      // ✅ respect shoot lock too (B2)
      if ((S.shootLockMs|0) > 0) return;

      tryHitTarget(id, { via:'pointer' });
    }, { passive:false });

    if (btnShoot){
      btnShoot.addEventListener('pointerup', (e)=>{ e.preventDefault(); shoot(); }, { passive:false });
      btnShoot.addEventListener('click', (e)=>{ e.preventDefault(); shoot(); }, { passive:false });
    }

    DOC.addEventListener('keydown', (e)=>{
      if (!S.started || S.ended) return;
      if (e.code === 'Space' || e.code === 'Enter'){
        e.preventDefault();
        shoot();
      }
    }, { passive:false });
  }

  // ------------------------------ End / Stats / Grade (unchanged) ------------------------------
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

    const qUI = Q.getUIState('peek');

    return {
      scoreFinal: S.score|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,

      goalsCleared: qUI.goalsCleared|0,
      goalsTotal: qUI.goalsTotal|0,
      miniCleared: qUI.minisCleared|0,
      miniTotal: qUI.minisTotal|0,

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

      nHazardHit: S.nHazardHit|0,

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

  function saveLastSummary(payload){
    try{ ROOT.localStorage && ROOT.localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload)); }catch(_){}
  }

  function buildHubUrl(){
    const hub = String(q.hub || q.return || opts.hub || '../index.html');
    try{
      const u = new URL(hub, ROOT.location.href);
      const keep = ['studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode','schoolYear','semester','studentKey','schoolCode','nick','diff','run'];
      for (const k of keep) if (q[k] != null && !u.searchParams.has(k)) u.searchParams.set(k, String(q[k]));
      u.searchParams.set('from','goodjunk');
      return u.toString();
    }catch(_){ return hub; }
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
    dispatch('hha:end', payload);
    const wrap = byId('gj-end') || byId('end-summary') || null;
    if (!wrap) return;

    const hubUrl = buildHubUrl();
    wrap.innerHTML =
      `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;">
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
            ${statBox('โดนแรงกดดัน', payload.nHazardHit)}
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

    const btn = wrap.querySelector('[data-restart]');
    if (btn) btn.addEventListener('click', ()=>{ try{ ROOT.location.reload(); }catch(_){} }, { passive:true });
  }

  function endGame(reason='time'){
    if (S.ended) return;
    S.ended = true;
    S.tEndIso = new Date().toISOString();

    refreshSurviveGoal(true);

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

    dispatch('hha:score', { score:S.score|0, scoreFinal:S.score|0, combo:S.combo|0, misses:S.misses|0, grade });
    dispatch('hha:end', payload);
  }

  // ------------------------------ Update loop ------------------------------
  function update(dtMs){
    if (!S.started || S.ended) return;

    S.__coachCdMs = Math.max(0, (S.__coachCdMs|0) - (dtMs|0));

    // ✅ decay shoot lock (B2)
    if ((S.shootLockMs|0) > 0){
      S.shootLockMs = Math.max(0, (S.shootLockMs|0) - (dtMs|0));
      if (S.shootLockMs === 0){
        try{ DOC.body && DOC.body.classList.remove('gj-shootlock'); }catch(_){}
      }
    }

    Q.tick();

    S.durationPlayedSec = clamp(Math.floor(S.durationPlannedSec - S.timeLeftSec), 0, S.durationPlannedSec);
    S.timeLeftSec = Math.max(0, S.timeLeftSec - (dtMs/1000));

    const leftMiss = (S.missLimit|0) - (S.misses|0);
    if ((S.timeLeftSec <= 8 && S.timeLeftSec > 0) || (leftMiss <= 1 && leftMiss >= 0)){
      try{ DOC.body && DOC.body.classList.add('gj-panic'); }catch(_){}
    } else {
      try{ DOC.body && DOC.body.classList.remove('gj-panic'); }catch(_){}
    }

    adaptiveStep(dtMs);

    const plan = getSpawnPlan();
    const intervalMs = 1000 / Math.max(0.001, plan.rate);
    S.spawnAccMs += dtMs;
    while (S.spawnAccMs >= intervalMs){
      S.spawnAccMs -= intervalMs;
      spawnOne();
    }

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

    // ✅ B1+B2 hazards
    hazardUpdate(tNow);

    emitTime();
    if (S.timeLeftSec <= 0) endGame('time');
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

  // ------------------------------ Start gate ------------------------------
  function startGame(){
    if (S.started) return;
    S.started = true;
    S.tStartIso = new Date().toISOString();
    S.tLastMs = 0;
    S.timeLeftSec = S.durationPlannedSec;

    setFever(10);
    addShield(0);

    coach('พร้อมลุย! เก็บของดี เลี่ยงขยะ 💥', 'happy', 'กด “ยิง” หรือ Space • ลากค้างเพื่อ Dodge Ring/Laser');
    emitScore('start');
    emitTime();
    logEvent('start', { reason:'start' }, { durationPlannedSec:S.durationPlannedSec|0 });

    spawnTarget('good');
    if (rng() < 0.35) spawnTarget('good');
    if (rng() < 0.25) spawnTarget('shield');
    if (rng() < 0.10) spawnTarget('junk');

    refreshSurviveGoal(false);

    ROOT.requestAnimationFrame(loop);
  }

  function bindStart(){
    if (!startOverlay || !btnStart){
      startGame();
      return;
    }
    startOverlay.style.display = '';
    const go = ()=>{
      try{ startOverlay.style.display = 'none'; }catch(_){}
      startGame();
    };
    btnStart.addEventListener('pointerup', (e)=>{ e.preventDefault(); go(); }, { passive:false });
    btnStart.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, { passive:false });
  }

  // init
  bindInputs();
  bindStart();

  ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
  ROOT.GoodJunkVR.state = S;
  ROOT.GoodJunkVR.quest = Q;
  ROOT.GoodJunkVR.endGame = endGame;

  return { state:S, quest:Q, endGame };
}
