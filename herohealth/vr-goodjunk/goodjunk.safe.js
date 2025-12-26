// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR (PRODUCTION SAFE) — FULL FILE (NO CUT)
// ✅ DOM Emoji Targets (#gj-layer) + Crosshair Shoot (1 tap)
// ✅ VR-feel world shift handled by HTML (we read aim/offset globals)
// ✅ MISS RULE: miss = goodExpired + junkHit ; Shield blocks junk => NOT miss
// ✅ Fever + Shield UI (hha:fever compat value+fever)
// ✅ Quest (Goals sequential + Minis chain) via quest-director + quest-defs
// ✅ Boss: Shockwave + Ring + Laser + Enrage (attack cadence ramps)
// ✅ End Summary: emits hha:end with grade SSS/SS/S/A/B/C + quest counts
// ✅ Logger hooks: hha:log_profile / hha:log_event / hha:log_session
// ✅ Hub context attach (studyId/phase/studentKey/...)
// NOTE: This module is "safe": if some optional DOM ids missing => skip gracefully.

'use strict';

import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

// ---------- Optional modules ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { burstAt(){}, scorePop(){}, celebrate(){}, toast(){} };

// ---------- Helpers ----------
function clamp(v, a, b){ v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
function randi(a,b){ return a + Math.floor(Math.random() * (b - a + 1)); }
function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function uid8(){ return Math.random().toString(16).slice(2,10); }
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx + dy*dy; }
function safeDispatch(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function setCSSVar(name, value){
  try{ document.documentElement.style.setProperty(name, value); }catch(_){}
}
function safeQ(sel){ try{ return document.querySelector(sel); }catch(_){ return null; } }

// Aim point = crosshair center in screen coords (provided by HTML)
function getAimPoint(){
  const ap = ROOT.__GJ_AIM_POINT__;
  if (ap && Number.isFinite(ap.x) && Number.isFinite(ap.y)) return { x: ap.x|0, y: ap.y|0 };
  return { x: (innerWidth*0.5)|0, y: (innerHeight*0.62)|0 };
}
// Layer offset = layer.getBoundingClientRect().left/top (provided by HTML)
function getLayerOffset(){
  const o = ROOT.__GJ_LAYER_OFFSET__;
  if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) return { x: o.x, y: o.y };
  return { x: 0, y: 0 };
}
function toLayerPt(xScreen, yScreen){
  const o = getLayerOffset();
  return { x: (xScreen - o.x), y: (yScreen - o.y) };
}

// ---------- Difficulty presets ----------
const DIFF = {
  easy:   { spawnMs: 900, maxActive: 6, ttlMs: 2300, scale: 1.08, junkRatio: 0.34, goldRatio: 0.08, powerRatio: 0.10, bossHp: 6 },
  normal: { spawnMs: 760, maxActive: 7, ttlMs: 1950, scale: 1.00, junkRatio: 0.40, goldRatio: 0.07, powerRatio: 0.09, bossHp: 8 },
  hard:   { spawnMs: 640, maxActive: 8, ttlMs: 1750, scale: 0.92, junkRatio: 0.46, goldRatio: 0.06, powerRatio: 0.08, bossHp: 10 }
};
function pickDiff(key){
  key = String(key||'normal').toLowerCase();
  return DIFF[key] ? { ...DIFF[key] } : { ...DIFF.normal };
}

// ---------- Emoji pools ----------
const POOL_GOOD = ['🥦','🥕','🍎','🍌','🥬','🍇','🍊','🍉','🥜','🐟','🥛'];
const POOL_JUNK = ['🍟','🍕','🍔','🍩','🍭','🥤','🍰','🍫','🧁'];
const POOL_FAKE = ['😈','🧨','🪤','☠️']; // traps

const EMO_GOLD  = '🟡';
const EMO_MAG   = '🧲';
const EMO_TIME  = '⏳';
const EMO_SHLD  = '🛡️';

const EMO_BOSS1 = '👑';
const EMO_BOSS2 = '👹';

// ---------- Scoring ----------
function comboMultiplier(combo){
  const c = Math.max(0, combo|0);
  const m = 1 + Math.min(1.35, c * 0.07);
  return Math.round(m*100)/100;
}
function scoreGain(base, combo){
  const mul = comboMultiplier(combo);
  return Math.round(base * mul);
}

// ---------- Grade ----------
function gradeFrom(scorePerSec, accPct, questPct){
  const sps = clamp(scorePerSec, 0, 40);
  const acc = clamp(accPct, 0, 100);
  const qp  = clamp(questPct, 0, 100);

  const spsScore = Math.min(100, (sps/18)*100);
  const total = (0.42*spsScore) + (0.33*acc) + (0.25*qp);

  if (total >= 92) return 'SSS';
  if (total >= 84) return 'SS';
  if (total >= 76) return 'S';
  if (total >= 64) return 'A';
  if (total >= 52) return 'B';
  return 'C';
}

// ---------- DOM targets ----------
function createTargetEl(layer, xLayer, yLayer, emoji, extraClass){
  const el = document.createElement('div');
  el.className = `gj-target ${extraClass||''}`;
  el.textContent = emoji;
  el.style.left = (xLayer|0) + 'px';
  el.style.top  = (yLayer|0) + 'px';
  el.style.transform = 'translate(-50%,-50%) scale(1)';
  el.style.userSelect = 'none';
  el.style.webkitUserSelect = 'none';
  el.style.webkitTapHighlightColor = 'transparent';
  layer.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('spawn'));
  return el;
}
function killTargetEl(el){
  try{
    el.classList.add('gone');
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 180);
  }catch(_){}
}
function fxBurst(xScreen, yScreen, mode){
  try{ Particles.burstAt && Particles.burstAt(xScreen, yScreen, mode||'good'); }catch(_){}
}
function fxScorePop(xScreen, yScreen, txt, label){
  try{ Particles.scorePop && Particles.scorePop(xScreen, yScreen, txt, label||''); }catch(_){}
}
function fxCelebrate(kind='GOAL', intensity=1){
  try{ Particles.celebrate && Particles.celebrate({ kind, intensity }); }catch(_){}
}

// ---------- Main boot ----------
export function boot(opts = {}){
  const diffKey   = String(opts.diff || 'normal').toLowerCase();
  const runMode   = String(opts.run  || 'play').toLowerCase();
  const challenge = String(opts.challenge || 'rush').toLowerCase();
  const durationSec = clamp(opts.time || 80, 20, 180) | 0;

  const D = pickDiff(diffKey);

  const layer = opts.layerEl || document.getElementById('gj-layer');
  if (!layer) throw new Error('[GoodJunk] layerEl missing');

  const shootEl = opts.shootEl || document.getElementById('btnShoot');

  const elRing  = document.getElementById('atk-ring');
  const elLaser = document.getElementById('atk-laser');

  // Safe margins (avoid HUD)
  const SM = (() => {
    const m = opts.safeMargins || {};
    return {
      top:    Math.max(0, (m.top|0) || 128),
      bottom: Math.max(0, (m.bottom|0) || 170),
      left:   Math.max(0, (m.left|0) || 26),
      right:  Math.max(0, (m.right|0) || 26),
    };
  })();

  // Hub context attach
  const CTX = (opts.context && typeof opts.context === 'object') ? opts.context : {};
  function pickStudy(ctx){
    ctx = ctx || {};
    return {
      studyId: ctx.studyId ?? '',
      phase: ctx.phase ?? '',
      conditionGroup: ctx.conditionGroup ?? '',
      sessionOrder: ctx.sessionOrder ?? '',
      blockLabel: ctx.blockLabel ?? '',
      siteCode: ctx.siteCode ?? '',
      schoolYear: ctx.schoolYear ?? '',
      semester: ctx.semester ?? '',
      studentKey: ctx.studentKey ?? '',
      schoolCode: ctx.schoolCode ?? '',
      schoolName: ctx.schoolName ?? '',
      classRoom: ctx.classRoom ?? '',
      studentNo: ctx.studentNo ?? '',
      nickName: ctx.nickName ?? '',
      gender: ctx.gender ?? '',
      age: ctx.age ?? '',
      gradeLevel: ctx.gradeLevel ?? ''
    };
  }
  const STUDY = pickStudy(CTX);

  // Session IDs
  const sessionId = (opts.sessionId || CTX.sessionId || `${Date.now()}-${uid8()}`).toString();
  const startedIso = new Date().toISOString();

  // ----- State -----
  const S = {
    running: true,
    startedAt: now(),
    endAt: now() + durationSec*1000,
    timeLeft: durationSec,

    score: 0,
    goodHits: 0,

    // MISS RULE
    misses: 0,
    goodExpired: 0,
    junkHits: 0,

    combo: 0,
    comboMax: 0,

    fever: 0,
    feverDecayPerSec: 9.5,
    stunActive: false,
    stunEndsAt: 0,
    slow: 1.0,

    shield: 0,

    magnetActive: false,
    magnetEndsAt: 0,

    heroBurstActive: false,
    heroBurstEndsAt: 0,

    lastSpawnAt: 0,
    targets: new Map(),
    nextId: 1,

    // boss
    bossSpawned: false,
    bossAlive: false,
    bossPhase: 1,
    bossHp: 0,
    bossHpMax: 0,
    bossId: 0,
    bossMoveAt: 0,
    bossNextAtkAt: 0,
    bossEnrage: false,

    // hazards
    ringActive: false,
    ringCenterX: 0,
    ringCenterY: 0,
    ringR: 220,
    ringTh: 42,
    ringGapStartDeg: 0,
    ringGapSizeDeg: 90,
    ringEndsAt: 0,
    ringTickNextAt: 0,
    ringTickRateMs: 0,

    laserActive: false,
    laserY: 0,
    laserWarnEndsAt: 0,
    laserFireAt: 0,
    laserEndsAt: 0,
    laserTickNextAt: 0,
    laserTickRateMs: 0,

    shockActive: false,
    shockX: 0,
    shockY: 0,
    shockR: 0,
    shockRMax: 520,
    shockEndsAt: 0,
    shockFireAt: 0, // moment the wave "hits"
    hazardLockUntil: 0,

    finalPulseSent: false,
    lastCoachAt: 0,

    recentPts: []
  };

  // Quest director
  const qDir = makeQuestDirector({
    diff: diffKey,
    challenge,
    goalDefs: GOODJUNK_GOALS,
    miniDefs: GOODJUNK_MINIS,
    maxGoals: 2,
    maxMini: 999,
    emitMs: 120
  });

  const qState = {
    score: 0,
    goodHits: 0,
    miss: 0,
    comboMax: 0,
    timeLeft: 0,

    streakGood: 0,
    goldHitsThisMini: 0,
    blocks: 0,
    stunBreaks: 0,
    timePlus: 0,
    safeNoJunkSeconds: 0,
    bossCleared: false,
    final8Good: 0
  };
  ROOT.__GJ_QSTATE__ = qState;

  let lastBadAt = now(); // for No-Junk zone minis
  const markBad = ()=>{
    lastBadAt = now();
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
  };
  const markGood = ()=>{
    qState.streakGood = (qState.streakGood|0) + 1;
    if ((S.timeLeft|0) <= 8) qState.final8Good = (qState.final8Good|0) + 1;
  };

  // Reset per mini
  window.addEventListener('quest:miniStart', ()=>{
    qState.goldHitsThisMini = 0;
    qState.blocks = 0;
    qState.stunBreaks = 0;
    qState.timePlus = 0;
    qState.safeNoJunkSeconds = 0;
    qState.final8Good = 0;
    lastBadAt = now();
  }, { passive:true });

  // ---------- Logger ----------
  function logEvent(name, extra){
    safeDispatch('hha:log_event', {
      sessionId,
      ts: Date.now(),
      name: String(name||'event'),
      diff: diffKey,
      challenge,
      run: runMode,
      timeLeft: S.timeLeft|0,
      score: S.score|0,
      goodHits: S.goodHits|0,
      misses: S.misses|0,
      comboMax: S.comboMax|0,
      fever: Math.round(S.fever||0),
      ...STUDY,
      ...((extra && typeof extra==='object') ? extra : {})
    });
  }
  function logSession(kind, extra){
    safeDispatch('hha:log_session', {
      sessionId,
      kind: String(kind||'start'),
      startedIso,
      endedIso: (kind==='end' ? new Date().toISOString() : ''),
      diff: diffKey,
      challenge,
      run: runMode,
      durationSec,
      score: S.score|0,
      goodHits: S.goodHits|0,
      misses: S.misses|0,
      goodExpired: S.goodExpired|0,
      junkHits: S.junkHits|0,
      comboMax: S.comboMax|0,
      ...STUDY,
      ...(extra||{})
    });
  }

  safeDispatch('hha:log_profile', { ts: Date.now(), ...STUDY });
  logSession('start', {});

  // ---------- UI emitters ----------
  function emitScore(){
    safeDispatch('hha:score', {
      score: S.score|0,
      combo: S.combo|0,
      goodHits: S.goodHits|0,
      misses: S.misses|0,
      comboMax: S.comboMax|0,
      multiplier: comboMultiplier(S.combo|0),
      bossAlive: !!S.bossAlive,
      bossPhase: S.bossPhase|0,
      bossHp: S.bossHp|0,
      bossHpMax: S.bossHpMax|0,
      goodExpired: S.goodExpired|0,
      junkHits: S.junkHits|0,
      shield: S.shield|0,
      fever: Math.round(S.fever||0)
    });
  }
  function emitTime(){ safeDispatch('hha:time', { sec: S.timeLeft|0 }); }

  function emitFever(){
    const v = clamp(S.fever,0,100);
    safeDispatch('hha:fever', {
      value: v,
      fever: v,
      on: (v >= 70) || !!S.stunActive,
      shield: S.shield|0,
      stunActive: !!S.stunActive,
      slow: Number(S.slow)||1,
      endsAt: S.stunActive ? (S.stunEndsAt|0) : 0
    });
  }
  function setJudge(label){ safeDispatch('hha:judge', { label: String(label||'') }); }

  function setCoach(line, mood='neutral', sub=''){
    const t = now();
    if (t - S.lastCoachAt < 450) return;
    S.lastCoachAt = t;
    safeDispatch('hha:coach', { line: String(line||''), mood: String(mood||'neutral'), sub: String(sub||'') });
  }

  // ---------- Quest update (HUD binder reads quest:update) ----------
  let _questEmitLock = 0;
  function emitQuestUpdate(force=false){
    const t = now();
    if (!force && t < _questEmitLock) return;
    _questEmitLock = t + 80;

    let active = null;
    try{
      if (qDir && typeof qDir.getActive === 'function') active = qDir.getActive();
    }catch(_){}

    const goal = (active && active.goal) ? active.goal : (active && active.activeGoal) ? active.activeGoal : null;
    const mini = (active && active.mini) ? active.mini : (active && active.activeMini) ? active.activeMini : null;

    const goalTarget = goal ? (goal.target ?? goal.max ?? goal.tgt ?? goal.need ?? 0) : 0;
    const miniTarget = mini ? (mini.target ?? mini.max ?? mini.tgt ?? mini.need ?? 0) : 0;

    const goalObj = goal ? {
      title: String(goal.label || goal.title || goal.name || 'Goal'),
      cur: (goal.prog ?? goal.cur ?? goal.value ?? 0)|0,
      target: (goalTarget ?? 0)|0,
      pct: (goal.pct ?? null),
      done: !!(goal.done ?? goal.pass ?? goal.completed ?? false)
    } : null;

    const miniObj = mini ? {
      title: String(mini.label || mini.title || mini.name || 'Mini'),
      cur: (mini.prog ?? mini.cur ?? mini.value ?? 0)|0,
      target: (miniTarget ?? 0)|0,
      pct: (mini.pct ?? null),
      done: !!(mini.done ?? mini.pass ?? mini.completed ?? false),
      tLeft: (mini.tLeft ?? mini.timeLeft ?? null),
      windowSec: (mini.windowSec ?? mini.window ?? null)
    } : null;

    safeDispatch('quest:update', {
      questOk: true,
      goal: goalObj,
      mini: miniObj,

      goalTitle: goalObj ? goalObj.title : '',
      goalCur: goalObj ? goalObj.cur : 0,
      goalTarget: goalObj ? goalObj.target : 0,

      miniTitle: miniObj ? miniObj.title : '',
      miniCur: miniObj ? miniObj.cur : 0,
      miniTarget: miniObj ? miniObj.target : 0,

      miniTLeft: miniObj ? miniObj.tLeft : null,
      miniWindowSec: miniObj ? miniObj.windowSec : null
    });
  }

  let _qtLock = 0;
  function syncQuestState(){
    qState.score = S.score|0;
    qState.goodHits = S.goodHits|0;
    qState.miss = S.misses|0;
    qState.comboMax = S.comboMax|0;
    qState.timeLeft = S.timeLeft|0;
    qState.safeNoJunkSeconds = Math.max(0, Math.floor((now() - lastBadAt) / 1000));
  }
  function tickQuestNow(reason='event'){
    const t = now();
    if (t < _qtLock) return;
    _qtLock = t + 18;
    syncQuestState();
    try{ qDir.tick(qState); }catch(_){}
    emitQuestUpdate(true);
  }

  // ---------- Rank ----------
  let _rankNextAt = 0;
  function emitRank(){
    const t = now();
    if (t < _rankNextAt) return;
    _rankNextAt = t + 450;

    const elapsedSec = Math.max(1, Math.round((t - S.startedAt)/1000));
    const sps = (S.score|0) / elapsedSec;

    const totalActs = (S.goodHits|0) + (S.misses|0);
    const acc = totalActs > 0 ? Math.round((S.goodHits/totalActs)*100) : 0;

    let qp = 0;
    try{
      if (qDir && typeof qDir.getSummary === 'function'){
        const sum = qDir.getSummary();
        const total = Math.max(1, (sum.goalsTotal||0) + (sum.miniTotal||0));
        const done  = (sum.goalsCleared||0) + (sum.miniCleared||0);
        qp = Math.round((done/total)*100);
      }
    }catch(_){}

    const grade = gradeFrom(sps, acc, qp);
    safeDispatch('hha:rank', { grade, scorePerSec: sps, accuracy: acc, questsPct: qp });
  }

  // ---------- Spawning logic ----------
  function getSafeRect(){
    const left   = SM.left;
    const right  = innerWidth - SM.right;
    const top    = SM.top;
    const bottom = innerHeight - SM.bottom;
    return { left, right: Math.max(left+10, right), top, bottom: Math.max(top+10, bottom) };
  }

  function rememberPt(x,y){
    S.recentPts.push({x,y,t:now()});
    if (S.recentPts.length > 16) S.recentPts.shift();
  }
  function farEnough(x,y, minD=140){
    const min2 = minD*minD;
    const tnow = now();
    for (const p of S.recentPts){
      if ((tnow - p.t) > 4500) continue;
      if (dist2(x,y,p.x,p.y) < min2) return false;
    }
    return true;
  }

  function pickSpawnPoint(avoidAim=true){
    const R = getSafeRect();
    const aim = getAimPoint();
    const tries = 38;
    for (let i=0;i<tries;i++){
      const x = randi(R.left, R.right);
      const y = randi(R.top,  R.bottom);
      const awayAim = !avoidAim || (dist2(x,y, aim.x, aim.y) >= (190*190));
      const ok = farEnough(x,y, diffKey==='hard' ? 150 : 135);
      if (awayAim && ok){
        rememberPt(x,y);
        return { x, y };
      }
    }
    const x = randi(R.left, R.right);
    const y = randi(R.top,  R.bottom);
    rememberPt(x,y);
    return { x, y };
  }

  function pickType(){
    // Boss present => slightly higher traps
    const j = clamp(D.junkRatio + (S.bossAlive ? 0.04 : 0), 0.25, 0.70);
    const g = clamp(D.goldRatio, 0.03, 0.18);
    const p = clamp(D.powerRatio, 0.03, 0.22);

    const r = Math.random();
    if (r < g) return 'gold';
    if (r < g + p) return 'power';
    if (r < g + p + (j*0.16)) return 'trap';
    if (r < g + p + j) return 'junk';
    return 'good';
  }

  function pickEmoji(type){
    if (type === 'good') return POOL_GOOD[randi(0, POOL_GOOD.length-1)];
    if (type === 'junk') return POOL_JUNK[randi(0, POOL_JUNK.length-1)];
    if (type === 'trap') return POOL_FAKE[randi(0, POOL_FAKE.length-1)];
    if (type === 'gold') return EMO_GOLD;
    if (type === 'power'){
      // weighted powers
      const rr = Math.random();
      if (rr < 0.40) return EMO_MAG;
      if (rr < 0.70) return EMO_TIME;
      return EMO_SHLD;
    }
    return '❓';
  }

  function classFor(type, emoji){
    if (type === 'junk') return 'gj-junk';
    if (type === 'trap') return 'gj-fake';
    if (type === 'gold') return 'gj-gold';
    if (type === 'power') return 'gj-power';
    if (type === 'boss') return 'gj-boss';
    return '';
  }

  function spawnOne(typeOverride=null, posOverride=null){
    if (!S.running) return null;
    if ((S.targets.size|0) >= (D.maxActive|0)) return null;

    const type = typeOverride || pickType();
    const pos = posOverride || pickSpawnPoint(true);
    const emoji = (type === 'boss')
      ? (S.bossPhase >= 2 ? EMO_BOSS2 : EMO_BOSS1)
      : pickEmoji(type);

    const ptLayer = toLayerPt(pos.x, pos.y);

    const id = (S.nextId++)|0;
    const ttlBase = D.ttlMs;
    const ttl = Math.round(ttlBase * (S.stunActive ? 1.12 : 1.0) * (S.bossAlive ? 0.95 : 1.0));
    const bornAt = now();
    const expiresAt = bornAt + Math.max(700, ttl);

    const baseScore =
      (type === 'good') ? 100 :
      (type === 'gold') ? 160 :
      (type === 'power') ? 120 :
      (type === 'junk') ? 0 :
      (type === 'trap') ? 0 :
      0;

    const el = createTargetEl(layer, ptLayer.x, ptLayer.y, emoji, classFor(type, emoji));
    el.dataset.id = String(id);
    el.dataset.type = type;

    // scale tweak
    try{
      const scale =
        (type === 'boss') ? (1.0 * D.scale * 1.25) :
        (type === 'gold') ? (1.0 * D.scale * 1.12) :
        (type === 'power') ? (1.0 * D.scale * 1.06) :
        (1.0 * D.scale);
      el.style.fontSize = (type === 'boss') ? '64px' : '48px';
      el.style.transform = `translate(-50%,-50%) scale(${scale})`;
    }catch(_){}

    const T = { id, type, emoji, x: pos.x, y: pos.y, bornAt, expiresAt, baseScore, el };

    // Click-to-hit (direct)
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      hitTarget(id, { via:'tap' });
    }, { passive:false });

    S.targets.set(id, T);
    if (type === 'boss'){
      S.bossId = id;
    }
    return T;
  }

  // ---------- Fever / stun / powers ----------
  function setCombo(v){
    S.combo = Math.max(0, v|0);
    if (S.combo > S.comboMax) S.comboMax = S.combo;
  }
  function addFever(delta){
    S.fever = clamp((S.fever||0) + (delta||0), 0, 100);
  }

  function startStun(){
    S.stunActive = true;
    S.slow = 0.62;
    S.stunEndsAt = now() + 6200;
    S.fever = 65;
    setJudge('STUN!');
    setCoach('โอ๊ย! โดนหนักไปหน่อย 😵‍💫 ตั้งสติแล้วกลับมาเก็บของดี!', 'sad', 'หลบกับดัก แล้วคอมโบจะกลับมาเอง');
    emitFever();
    logEvent('stun_start', {});
    fxCelebrate('STUN', 1.2);
  }
  function stopStun(){
    S.stunActive = false;
    S.slow = 1.0;
    S.fever = Math.min(S.fever, 45);
    emitFever();
    logEvent('stun_end', {});
  }

  function activateMagnet(){
    S.magnetActive = true;
    S.magnetEndsAt = now() + 5200;
    setJudge('MAGNET!');
    setCoach('พลังแม่เหล็ก! 🧲 เก็บของดีให้ไว!', 'happy', 'เล็งกลางแล้วกดยิงรัวได้เลย');
    logEvent('power_magnet', {});
    safeDispatch('quest:power', { power:'magnet' });
  }
  function addTime(){
    S.endAt += 3000;
    qState.timePlus = (qState.timePlus|0) + 1;
    setJudge('+TIME!');
    setCoach('ได้เวลาเพิ่ม! ⏳ รีบเก็บให้ครบ!', 'happy', '+3 วินาที');
    logEvent('power_time', {});
    safeDispatch('quest:power', { power:'time' });
    tickQuestNow('timePlus');
  }
  function addShield(){
    S.shield = clamp((S.shield|0) + 1, 0, 5);
    setJudge('+SHIELD!');
    setCoach('โล่พร้อม! 🛡️ ชนขยะได้ 1 ครั้ง (ไม่เป็น miss)', 'neutral', `โล่: ${S.shield}`);
    logEvent('power_shield', { shield:S.shield|0 });
    safeDispatch('quest:power', { power:'shield' });
    emitFever();
  }

  function startHeroBurst(){
    S.heroBurstActive = true;
    S.heroBurstEndsAt = now() + 1500;
    setJudge('HERO!');
    setCoach('โหมดฮีโร่! ⚡ ยิงให้แตกกระจาย!', 'happy', 'คอมโบจะพุ่งแรงมาก');
    logEvent('hero_burst', {});
    fxCelebrate('HERO', 1.25);
  }

  // ---------- Hazards & penalties ----------
  function applyPenalty(kind='hazard', extra=null){
    const tnow = now();
    if (tnow < (S.hazardLockUntil||0)) return;
    S.hazardLockUntil = tnow + 420;

    markBad();
    setCombo(0);

    // shield blocks junk penalties only (and hazard from junk/trap)
    const shieldable = (kind.indexOf('junk')>=0 || kind.indexOf('trap')>=0 || kind.indexOf('laser')>=0 || kind.indexOf('ring')>=0 || kind.indexOf('shock')>=0);

    const ap = getAimPoint();
    if ((S.shield|0) > 0 && shieldable){
      S.shield = 0;
      qState.blocks = (qState.blocks|0) + 1;
      setJudge('BLOCK!');
      setCoach('โล่แตก! แต่ไม่เป็น miss ✅', 'neutral', 'ระวังต่อไป!');
      fxBurst(ap.x, ap.y, 'power');
      addFever(-10);
      logEvent('shield_break', { by: kind, ...(extra||{}) });
      safeDispatch('quest:badHit', { kind: kind + ':shieldbreak' });
      tickQuestNow('block');
    } else {
      S.misses++;
      addFever(-18);

      setJudge('HIT!');
      setCoach('โดนแล้ว! 🚫 เลี่ยงขยะ/กับดักนะ', 'sad', 'คอมโบรีเซ็ต');
      fxBurst(ap.x, ap.y, 'trap');

      // if it was junk or trap => junkHit contributes to miss (rule)
      if (kind.indexOf('junk')>=0 || kind.indexOf('trap')>=0) S.junkHits++;

      logEvent('hazard_hit', { by: kind, ...(extra||{}) });
      safeDispatch('quest:badHit', { kind });
      tickQuestNow('penalty');
    }

    emitScore();
    emitFever();

    // if many penalties -> stun
    if (!S.stunActive && (S.fever|0) <= 10 && Math.random() < 0.16){
      startStun();
    }
  }

  // Ring hazard check for a target (screen position)
  function ringIsSafeForPoint(x,y){
    if (!S.ringActive) return true;

    const cx = S.ringCenterX|0, cy = S.ringCenterY|0;
    const dx = x - cx, dy = y - cy;
    const r = Math.sqrt(dx*dx + dy*dy);

    const bandMin = S.ringR - (S.ringTh*0.5);
    const bandMax = S.ringR + (S.ringTh*0.5);
    const inBand = (r >= bandMin && r <= bandMax);

    if (!inBand) return true; // only band is dangerous

    // angle in degrees 0..360
    let ang = Math.atan2(dy, dx) * 180 / Math.PI;
    if (ang < 0) ang += 360;

    const gapStart = (S.ringGapStartDeg % 360 + 360) % 360;
    const gapSize = clamp(S.ringGapSizeDeg, 30, 160);
    const gapEnd = (gapStart + gapSize) % 360;

    const inGap = (gapEnd >= gapStart)
      ? (ang >= gapStart && ang <= gapEnd)
      : (ang >= gapStart || ang <= gapEnd);

    // safe only if inside gap while in band
    return inGap;
  }

  function laserIsSafeForPoint(x,y){
    if (!S.laserActive) return true;
    const band = 18; // px
    const dy = Math.abs((y|0) - (S.laserY|0));
    // during warn => safe (just warning), during fire => dangerous band
    const t = now();
    const firing = (t >= S.laserFireAt && t <= S.laserEndsAt);
    if (!firing) return true;
    return dy > band;
  }

  function shockIsSafeForPoint(x,y){
    if (!S.shockActive) return true;
    const t = now();
    // only at "fire" moment window do we punish
    if (t < S.shockFireAt || t > S.shockEndsAt) return true;
    const dx = x - (S.shockX|0), dy = y - (S.shockY|0);
    const r = Math.sqrt(dx*dx + dy*dy);
    // wave thickness ~ 34px around current radius
    const rr = S.shockR|0;
    const inWave = (r >= rr - 20 && r <= rr + 20);
    return !inWave;
  }

  // ---------- Boss ----------
  function spawnBoss(){
    if (S.bossSpawned || !S.running) return;
    S.bossSpawned = true;
    S.bossAlive = true;
    S.bossPhase = 1;
    S.bossHpMax = (D.bossHp|0);
    S.bossHp = S.bossHpMax;
    S.bossEnrage = false;

    const pos = pickSpawnPoint(false);
    spawnOne('boss', pos);

    S.bossMoveAt = now() + 1100;
    S.bossNextAtkAt = now() + 1200;

    setCoach('บอสมาแล้ว! 👑 ยิงบอสให้แตก แล้วอย่าโดนกับดัก!', 'neutral', 'ระวัง Ring/Laser/Shockwave');
    logEvent('boss_spawn', { hp:S.bossHpMax|0 });

    tickQuestNow('boss');
    emitScore();
  }

  function bossMove(){
    if (!S.bossAlive) return;
    const T = S.targets.get(S.bossId);
    if (!T) return;

    // move boss to new point
    const p = pickSpawnPoint(false);
    T.x = p.x; T.y = p.y;

    const pt = toLayerPt(p.x, p.y);
    try{
      T.el.style.left = (pt.x|0) + 'px';
      T.el.style.top  = (pt.y|0) + 'px';
    }catch(_){}

    S.bossMoveAt = now() + (S.bossEnrage ? 650 : 950);
  }

  function bossSetEnrage(){
    if (S.bossEnrage) return;
    S.bossEnrage = true;
    setCoach('บอสคลั่ง! 👹 จังหวะเร็วขึ้นแล้ว!', 'sad', 'โฟกัสยิงบอส + เลี่ยงเขตอันตราย');
    logEvent('boss_enrage', {});
  }

  function bossAttackPick(){
    // rotate attacks based on phase
    // phase 1: shockwave + ring
    // phase 2: ring + laser
    // phase 3: laser + shockwave (enrage)
    const t = now();

    if (!S.bossAlive) return;

    if (S.bossHp <= Math.ceil(S.bossHpMax*0.35)) bossSetEnrage();

    const phase = (S.bossHp <= Math.ceil(S.bossHpMax*0.6)) ? 2 : 1;
    S.bossPhase = S.bossEnrage ? 3 : phase;

    if (S.bossPhase === 1){
      if (Math.random() < 0.55) startShockwave();
      else startRing();
    } else if (S.bossPhase === 2){
      if (Math.random() < 0.55) startRing();
      else startLaser();
    } else {
      const r = Math.random();
      if (r < 0.36) startLaser();
      else if (r < 0.72) startShockwave();
      else startRing(true);
    }

    // next attack cadence
    const base = S.bossEnrage ? 1000 : 1400;
    S.bossNextAtkAt = t + base + randi(140, 420);
  }

  function startRing(enrage=false){
    const t = now();
    if (S.ringActive && t < S.ringEndsAt) return;

    const c = { x: (innerWidth*0.5)|0, y: (innerHeight*0.55)|0 };
    S.ringActive = true;
    S.ringCenterX = c.x;
    S.ringCenterY = c.y;
    S.ringR  = enrage ? 240 : 220;
    S.ringTh = enrage ? 46 : 42;
    S.ringGapStartDeg = randi(0, 359);
    S.ringGapSizeDeg  = enrage ? 62 : 86;
    S.ringEndsAt = t + (enrage ? 2300 : 2600);
    S.ringTickRateMs = enrage ? 240 : 320;
    S.ringTickNextAt = t + 180;

    setCSSVar('--ringGapStart', S.ringGapStartDeg + 'deg');
    setCSSVar('--ringGapSize', S.ringGapSizeDeg + 'deg');

    if (elRing){
      try{ elRing.classList.add('show'); }catch(_){}
    }

    setJudge('RING!');
    logEvent('boss_ring', { gapStart:S.ringGapStartDeg|0, gapSize:S.ringGapSizeDeg|0 });

    // small tick sound pulses
    safeDispatch('hha:tick', { kind:'ring', intensity: enrage ? 1.4 : 1.0 });
  }

  function stopRing(){
    if (!S.ringActive) return;
    S.ringActive = false;
    if (elRing){
      try{ elRing.classList.remove('show'); }catch(_){}
    }
  }

  function startLaser(){
    const t = now();
    if (S.laserActive && t < S.laserEndsAt) return;

    S.laserActive = true;
    const R = getSafeRect();
    S.laserY = randi(R.top + 60, R.bottom - 60);
    S.laserWarnEndsAt = t + 900;
    S.laserFireAt = t + 900;
    S.laserEndsAt = t + 1500;
    S.laserTickRateMs = S.bossEnrage ? 160 : 220;
    S.laserTickNextAt = t + 120;

    if (elLaser){
      try{
        elLaser.style.top = (S.laserY|0) + 'px';
        elLaser.classList.remove('fire');
        elLaser.classList.add('warn');
      }catch(_){}
    }

    setJudge('LASER!');
    logEvent('boss_laser', { y:S.laserY|0 });
    safeDispatch('hha:tick', { kind:'laser_warn', intensity: 1.2 });
  }

  function stopLaser(){
    if (!S.laserActive) return;
    S.laserActive = false;
    if (elLaser){
      try{ elLaser.classList.remove('warn','fire'); }catch(_){}
    }
  }

  function startShockwave(){
    const t = now();
    if (S.shockActive && t < S.shockEndsAt) return;

    const T = S.targets.get(S.bossId);
    const cx = T ? T.x : (innerWidth*0.5);
    const cy = T ? T.y : (innerHeight*0.55);

    S.shockActive = true;
    S.shockX = cx|0;
    S.shockY = cy|0;
    S.shockR = 0;
    S.shockRMax = 520;
    S.shockFireAt = t + 780;
    S.shockEndsAt = t + 1400;

    setJudge('SHOCK!');
    logEvent('boss_shock', { x:S.shockX|0, y:S.shockY|0 });
    safeDispatch('hha:tick', { kind:'shock_warn', intensity: 1.1 });
  }

  function stopShockwave(){
    if (!S.shockActive) return;
    S.shockActive = false;
  }

  // ---------- Hits ----------
  function resolveHitSafety(T){
    // If hazards are active, hitting dangerous zones causes penalty instead of reward
    if (S.ringActive && !ringIsSafeForPoint(T.x, T.y)) return { safe:false, reason:'ring' };
    if (S.laserActive && !laserIsSafeForPoint(T.x, T.y)) return { safe:false, reason:'laser' };
    if (S.shockActive && !shockIsSafeForPoint(T.x, T.y)) return { safe:false, reason:'shock' };
    return { safe:true, reason:'' };
  }

  function hitTarget(id, meta=null){
    const T = S.targets.get(id);
    if (!T || !S.running) return;

    // avoid double
    S.targets.delete(id);
    killTargetEl(T.el);

    // boss hit
    if (T.type === 'boss'){
      S.bossHp = Math.max(0, (S.bossHp|0) - 1);
      setJudge('BOSS HIT!');
      fxBurst(T.x, T.y, 'good');
      fxScorePop(T.x, T.y, '-1', 'BOSS');
      logEvent('boss_hit', { hp:S.bossHp|0 });

      // boss phase change / enrage handled in attack picker
      emitScore();
      tickQuestNow('bossHit');

      if (S.bossHp <= 0){
        S.bossAlive = false;
        qState.bossCleared = true;
        setJudge('BOSS DOWN!');
        setCoach('จัดไป! บอสพังแล้ว 🎉', 'happy', 'กลับมาเก็บของดีต่อ!');
        fxCelebrate('BOSS', 1.6);
        logEvent('boss_down', {});

        stopRing(); stopLaser(); stopShockwave();

        safeDispatch('hha:celebrate', { kind:'BOSS', intensity: 1.6 });
        tickQuestNow('bossDown');

        // give reward
        S.shield = clamp((S.shield|0) + 1, 0, 5);
        addFever(+18);
        emitFever();
      } else {
        // respawn boss quickly at new location
        const p = pickSpawnPoint(false);
        spawnOne('boss', p);
      }
      return;
    }

    // hazard safety check
    const hz = resolveHitSafety(T);
    if (!hz.safe){
      applyPenalty('hazard_'+hz.reason, { type:T.type, emoji:T.emoji });
      fxScorePop(T.x, T.y, 'X', hz.reason.toUpperCase());
      return;
    }

    // Normal types
    if (T.type === 'good'){
      markGood();
      S.goodHits++;
      setCombo((S.combo|0) + 1);
      addFever(+8);

      const gain = scoreGain(100, S.combo|0);
      S.score += gain;

      setJudge('GOOD!');
      fxBurst(T.x, T.y, 'good');
      fxScorePop(T.x, T.y, `+${gain}`, 'GOOD');

      logEvent('hit_good', { gain, combo:S.combo|0, via: meta?.via || '' });
      safeDispatch('quest:goodHit', { kind:'good' });
      tickQuestNow('good');
    }

    else if (T.type === 'gold'){
      markGood();
      S.goodHits++;
      setCombo((S.combo|0) + 2);
      addFever(+10);

      qState.goldHitsThisMini = (qState.goldHitsThisMini|0) + 1;

      const gain = scoreGain(160, S.combo|0);
      S.score += gain;

      setJudge('GOLD!');
      fxBurst(T.x, T.y, 'gold');
      fxScorePop(T.x, T.y, `+${gain}`, 'GOLD');
      fxCelebrate('GOLD', 1.1);

      logEvent('hit_gold', { gain, goldHitsThisMini:qState.goldHitsThisMini|0 });
      safeDispatch('quest:goodHit', { kind:'gold' });
      tickQuestNow('gold');
    }

    else if (T.type === 'power'){
      markGood();
      S.goodHits++;
      setCombo((S.combo|0) + 1);
      addFever(+6);

      fxBurst(T.x, T.y, 'power');

      if (T.emoji === EMO_MAG) activateMagnet();
      else if (T.emoji === EMO_TIME) addTime();
      else addShield();

      const gain = scoreGain(120, S.combo|0);
      S.score += gain;
      fxScorePop(T.x, T.y, `+${gain}`, 'POWER');

      logEvent('hit_power', { emoji:T.emoji, gain });
      safeDispatch('quest:goodHit', { kind:'power' });
      tickQuestNow('power');
    }

    else if (T.type === 'junk' || T.type === 'trap'){
      // direct hit = penalty (shield blocks)
      markBad();
      applyPenalty(T.type === 'junk' ? 'junk_hit' : 'trap_hit', { emoji:T.emoji });
      logEvent('hit_bad', { type:T.type, emoji:T.emoji });
    }

    emitScore();
    emitFever();
    emitQuestUpdate(false);
    emitRank();

    // boss trigger by fever
    if (!S.bossSpawned && (S.fever|0) >= 70){
      spawnBoss();
    }

    // hero burst chance on very high combo
    if (!S.heroBurstActive && (S.combo|0) >= 14 && Math.random() < 0.10){
      startHeroBurst();
    }
  }

  // ---------- Shooting (crosshair) ----------
  function findNearestTargetToAim(maxRadius){
    const aim = getAimPoint();
    const r2 = (maxRadius|0) * (maxRadius|0);

    let best = null;
    let bestD2 = Infinity;

    for (const T of S.targets.values()){
      if (!T || !T.el) continue;
      // ignore boss? allow; but keep
      const d2 = dist2(aim.x, aim.y, T.x, T.y);
      if (d2 <= r2 && d2 < bestD2){
        bestD2 = d2;
        best = T;
      }
    }
    return best;
  }

  function shootOnce(){
    if (!S.running) return;

    const aim = getAimPoint();
    const radius = S.magnetActive ? 230 : 160;

    const T = findNearestTargetToAim(radius);
    if (!T){
      // small miss feedback (not counted as miss)
      setJudge('—');
      fxBurst(aim.x, aim.y, 'miss');
      logEvent('shoot_empty', {});
      return;
    }
    hitTarget(T.id, { via:'shoot' });
  }

  // Bind shoot button
  if (shootEl){
    shootEl.addEventListener('click', (ev)=>{
      ev.preventDefault?.();
      shootOnce();
    }, { passive:false });

    shootEl.addEventListener('pointerdown', (ev)=>{
      // avoid 2 tap on some android browsers
      ev.preventDefault?.();
      shootOnce();
    }, { passive:false });
  }

  // Tap empty field also shoots
  layer.addEventListener('pointerdown', (ev)=>{
    // if tap is on a target, that target handler already stops propagation
    ev.preventDefault?.();
    shootOnce();
  }, { passive:false });

  // ---------- Expire targets ----------
  function expireTarget(T){
    if (!T) return;
    S.targets.delete(T.id);
    killTargetEl(T.el);

    // if good expires => miss (rule)
    if (T.type === 'good' || T.type === 'gold' || T.type === 'power'){
      // goodExpired counts as miss ONLY for good-like (not boss)
      // but gold/power expiring should not be "miss" harshly; still count as expired good? (keep fair)
      if (T.type === 'good'){
        S.goodExpired++;
        S.misses++;
        setCombo(0);
        markBad();
        addFever(-10);
        setJudge('MISS');
        fxScorePop(T.x, T.y, 'MISS', 'EXPIRE');
        logEvent('expire_good', {});
        safeDispatch('quest:miss', { kind:'goodExpired' });
        tickQuestNow('goodExpired');
      } else {
        // gold/power expire => no miss, but small fever decay
        addFever(-4);
        logEvent('expire_bonus', { type:T.type, emoji:T.emoji });
      }
    } else if (T.type === 'junk' || T.type === 'trap'){
      // junk expire => nothing
    }
    emitScore();
    emitFever();
  }

  // ---------- Magnet auto-hit ----------
  let _magNextAt = 0;
  function magnetTick(){
    if (!S.magnetActive) return;
    const t = now();
    if (t < _magNextAt) return;
    _magNextAt = t + 180;

    // auto-hit nearest GOOD-like target within big radius
    const aim = getAimPoint();
    let best=null, bestD2=Infinity;
    for (const T of S.targets.values()){
      if (!T) continue;
      if (T.type !== 'good' && T.type !== 'gold' && T.type !== 'power') continue;
      const d2 = dist2(aim.x, aim.y, T.x, T.y);
      if (d2 < bestD2){
        bestD2 = d2;
        best = T;
      }
    }
    if (best && bestD2 < (320*320)){
      hitTarget(best.id, { via:'magnet' });
    }
  }

  // ---------- Main loop ----------
  let lastFrameAt = now();
  let lastSecTickAt = now();
  let lastSpawnTickAt = now();

  function updateTimers(){
    const t = now();

    // timeLeft
    const leftMs = Math.max(0, S.endAt - t);
    S.timeLeft = Math.ceil(leftMs/1000);

    // final 8 sec pulse
    if (!S.finalPulseSent && S.timeLeft <= 8){
      S.finalPulseSent = true;
      safeDispatch('hha:finalPulse', { secLeft: S.timeLeft|0 });
    }

    // end
    if (leftMs <= 0){
      endGame();
    }
  }

  function decayFever(dtSec){
    // passive decay
    const dec = (S.feverDecayPerSec * dtSec) * (S.bossAlive ? 0.55 : 1.0);
    S.fever = clamp((S.fever||0) - dec, 0, 100);
  }

  function tickSecond(){
    // No-Junk Zone tracking
    qState.safeNoJunkSeconds = Math.max(0, Math.floor((now() - lastBadAt) / 1000));
    tickQuestNow('sec');
    emitTime();
    emitRank();
  }

  function spawnTick(){
    const t = now();
    const slowMul = S.stunActive ? 1.25 : 1.0;
    const cadence = (D.spawnMs * slowMul) * (S.bossAlive ? 0.92 : 1.0);

    if (t - lastSpawnTickAt < cadence) return;
    lastSpawnTickAt = t;

    // boss alive => keep some targets for action, but don't flood
    if ((S.targets.size|0) < (D.maxActive|0)){
      spawnOne(null, null);
    }
  }

  function tickHazards(){
    const t = now();

    // Ring tick (sound / shake)
    if (S.ringActive){
      if (t >= S.ringEndsAt) stopRing();
      else if (t >= S.ringTickNextAt){
        S.ringTickNextAt = t + S.ringTickRateMs;
        safeDispatch('hha:tick', { kind:'ring', intensity: S.bossEnrage ? 1.3 : 1.0 });
      }
    }

    // Laser warn->fire->end
    if (S.laserActive){
      if (t >= S.laserEndsAt){
        stopLaser();
      } else {
        // warn stage
        if (elLaser){
          try{
            if (t < S.laserFireAt){
              elLaser.classList.add('warn');
              elLaser.classList.remove('fire');
            } else {
              elLaser.classList.remove('warn');
              elLaser.classList.add('fire');
            }
          }catch(_){}
        }
        if (t >= S.laserTickNextAt){
          S.laserTickNextAt = t + S.laserTickRateMs;
          // ticking only while firing (last 600ms)
          if (t >= S.laserFireAt){
            safeDispatch('hha:tick', { kind:'laser', intensity: S.bossEnrage ? 1.4 : 1.1 });
          }
        }
      }
    }

    // Shockwave expand
    if (S.shockActive){
      if (t >= S.shockEndsAt){
        stopShockwave();
      } else {
        // expand radius
        const p = clamp((t - (S.shockFireAt - 780)) / 1400, 0, 1);
        S.shockR = Math.round(p * S.shockRMax);

        // tick at fire window
        if (t >= S.shockFireAt && t <= S.shockEndsAt){
          safeDispatch('hha:tick', { kind:'shock', intensity: S.bossEnrage ? 1.3 : 1.0 });
        }
      }
    }
  }

  function tickBoss(){
    if (!S.bossAlive) return;
    const t = now();

    if (t >= S.bossMoveAt) bossMove();
    if (t >= S.bossNextAtkAt) bossAttackPick();
  }

  function tickExpiry(){
    const t = now();
    for (const T of Array.from(S.targets.values())){
      if (!T) continue;
      if (t >= T.expiresAt){
        // keep boss alive (boss target doesn't expire fast)
        if (T.type === 'boss'){
          // reposition instead of expire
          S.targets.delete(T.id);
          killTargetEl(T.el);
          const p = pickSpawnPoint(false);
          spawnOne('boss', p);
          continue;
        }
        expireTarget(T);
      }
    }
  }

  function tickPowerStates(){
    const t = now();

    if (S.stunActive && t >= S.stunEndsAt){
      stopStun();
    }
    if (S.magnetActive && t >= S.magnetEndsAt){
      S.magnetActive = false;
      setJudge('—');
      logEvent('magnet_end', {});
    }
    if (S.heroBurstActive && t >= S.heroBurstEndsAt){
      S.heroBurstActive = false;
      logEvent('hero_end', {});
    }
  }

  function loop(){
    if (!S.running) return;

    const t = now();
    const dt = Math.max(0, t - lastFrameAt);
    lastFrameAt = t;

    const dtSec = Math.min(0.06, dt/1000);

    updateTimers();
    tickPowerStates();

    // fever decay
    decayFever(dtSec);

    // magnet auto hits
    magnetTick();

    // spawn
    spawnTick();

    // expiry
    tickExpiry();

    // boss & hazards
    tickBoss();
    tickHazards();

    // second tick
    if (t - lastSecTickAt >= 1000){
      lastSecTickAt = t;
      tickSecond();
    }

    emitScore();
    emitFever();
    emitQuestUpdate(false);

    requestAnimationFrame(loop);
  }

  // ---------- End game ----------
  function endGame(){
    if (!S.running) return;
    S.running = false;

    // cleanup targets
    for (const T of S.targets.values()){
      try{ killTargetEl(T.el); }catch(_){}
    }
    S.targets.clear();

    stopRing(); stopLaser(); stopShockwave();

    const endedIso = new Date().toISOString();
    logSession('end', { endedIso });

    const t = now();
    const elapsedSec = Math.max(1, Math.round((t - S.startedAt)/1000));
    const sps = (S.score|0) / elapsedSec;

    const totalActs = (S.goodHits|0) + (S.misses|0);
    const acc = totalActs > 0 ? Math.round((S.goodHits/totalActs)*100) : 0;

    let goalsCleared=0, goalsTotal=2, miniCleared=0, miniTotal=7, qp=0;
    try{
      if (qDir && typeof qDir.getSummary === 'function'){
        const sum = qDir.getSummary();
        goalsCleared = sum.goalsCleared|0;
        goalsTotal   = sum.goalsTotal|0;
        miniCleared  = sum.miniCleared|0;
        miniTotal    = sum.miniTotal|0;
        const total = Math.max(1, goalsTotal + miniTotal);
        const done  = goalsCleared + miniCleared;
        qp = Math.round((done/total)*100);
      }
    }catch(_){}

    const grade = gradeFrom(sps, acc, qp);

    safeDispatch('hha:end', {
      sessionId,
      diff: diffKey,
      challenge,
      runMode,

      ...STUDY,

      grade,
      scoreFinal: S.score|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,

      goalsCleared, goalsTotal,
      miniCleared,  miniTotal,

      score: S.score|0,
      goodHits: S.goodHits|0,
      goodExpired: S.goodExpired|0,
      junkHits: S.junkHits|0,
      durationSec: durationSec|0,
      accuracy: acc,
      scorePerSec: sps,
      questsPct: qp,
      endedIso
    });

    setCoach('จบเกมแล้ว! 🎉 ดูสรุปผลได้เลย', 'happy', `Grade ${grade} • Acc ${acc}%`);
    emitScore();
    emitFever();
  }

  // ---------- Start ----------
  emitTime();
  emitScore();
  emitFever();
  tickQuestNow('start');

  // initial coach
  setCoach('พร้อมลุย! เก็บของดี เลี่ยงขยะ 🥦🚫', 'neutral', 'ทิป: เล็งกลาง + ยิง 1 ทีติด');

  // kick loop
  requestAnimationFrame(loop);

  // Exposed API for debug
  return {
    getState(){
      return {
        score: S.score|0,
        combo: S.combo|0,
        comboMax: S.comboMax|0,
        misses: S.misses|0,
        fever: Math.round(S.fever||0),
        shield: S.shield|0,
        bossAlive: !!S.bossAlive,
        bossPhase: S.bossPhase|0,
        bossHp: S.bossHp|0,
        bossHpMax: S.bossHpMax|0,
        timeLeft: S.timeLeft|0
      };
    },
    stop(){ endGame(); }
  };
}