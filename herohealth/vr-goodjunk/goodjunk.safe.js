// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR (PRODUCTION) — H++ FINAL PACK (PATCH A + QUEST BRIDGE)
// ✅ FIX: Gold Hunt 🟡 นับแน่ (increment + tickQuestNow)
// ✅ FIX: No Junk Zone 🚫 รีเซ็ตจริง (miniStart => reset lastBadAt)
// ✅ FIX: Quest นับทันทีทุก event สำคัญ (hit gold/power/block/stunBreak/goodExpired)
// ✅ FIX: Goal+Mini แสดงแน่บน HUD (force dispatch quest:update รองรับหลายเวอร์ชัน HUD)
// ✅ Miss rule: miss = goodExpired + junkHit ; Shield block junk => NOT miss
// ✅ Crosshair tap shoot (1 tap) + magnet/heroBurst uses layer offset
// ✅ Anti-clump spawn + safeMargins
// ✅ Emits hha:end (for end summary) + hha:log_session/events/profile (Google Sheet logger)

'use strict';

import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { burstAt(){}, scorePop(){}, celebrate(){}, toast(){} };

function clamp(v, a, b){ v = Number(v)||0; return v < a ? a : (v > b ? b : v); }
function randi(a,b){ return (a + Math.floor(Math.random()*(b-a+1))); }
function now(){ return performance.now ? performance.now() : Date.now(); }
function safeDispatch(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
function lerp(a,b,t){ return a + (b-a)*t; }
function uid8(){ return Math.random().toString(16).slice(2,10); }

function getAimPoint(){
  const ap = ROOT.__GJ_AIM_POINT__;
  if (ap && Number.isFinite(ap.x) && Number.isFinite(ap.y)) return { x: ap.x|0, y: ap.y|0 };
  return { x: (innerWidth*0.5)|0, y: (innerHeight*0.62)|0 };
}
function getLayerOffset(){
  const o = ROOT.__GJ_LAYER_OFFSET__;
  if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) return { x: o.x, y: o.y };
  return { x: 0, y: 0 };
}
function toLayerPt(xScreen, yScreen){
  const o = getLayerOffset();
  return { x: (xScreen - o.x), y: (yScreen - o.y) };
}

const DIFF = {
  easy:   { spawnMs: 900, maxActive: 6,  ttlMs: 2200, scale: 1.08, junkRatio: 0.34, goldRatio: 0.08, powerRatio: 0.09, bossHp: 6 },
  normal: { spawnMs: 760, maxActive: 7,  ttlMs: 1900, scale: 1.00, junkRatio: 0.40, goldRatio: 0.07, powerRatio: 0.08, bossHp: 8 },
  hard:   { spawnMs: 640, maxActive: 8,  ttlMs: 1700, scale: 0.92, junkRatio: 0.46, goldRatio: 0.06, powerRatio: 0.07, bossHp: 10 }
};
function pickDiff(key){
  key = String(key||'normal').toLowerCase();
  return DIFF[key] ? { ...DIFF[key] } : { ...DIFF.normal };
}

const POOL_GOOD = ['🥦','🥕','🍎','🍌','🥬','🍇','🍊','🍉','🥜','🐟','🥛'];
const POOL_JUNK = ['🍟','🍕','🍔','🍩','🍭','🥤','🍰','🍫','🧁'];
const POOL_FAKE = ['😈','🧨','🪤','☠️'];
const EMO_GOLD  = '🟡';
const EMO_MAG   = '🧲';
const EMO_TIME  = '⏳';
const EMO_SHLD  = '🛡️';
const EMO_BOSS1 = '👑';
const EMO_BOSS2 = '👹';

function createEl(layer, xLayer, yLayer, emoji, cls){
  const el = document.createElement('div');
  el.className = `gj-target ${cls||''}`;
  el.textContent = emoji;
  el.style.left = (xLayer|0) + 'px';
  el.style.top  = (yLayer|0) + 'px';
  layer.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('spawn'));
  return el;
}
function killEl(el){
  try{
    el.classList.add('gone');
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 160);
  }catch(_){}
}
function burstFX(xScreen,yScreen,mode){
  try{ Particles.burstAt && Particles.burstAt(xScreen, yScreen, mode||'good'); }catch(_){}
}
function scorePop(xScreen,yScreen,txt,label){
  try{ Particles.scorePop && Particles.scorePop(xScreen, yScreen, txt, label||''); }catch(_){}
}

function comboMultiplier(combo){
  const c = Math.max(0, combo|0);
  const m = 1 + Math.min(1.35, c * 0.07);
  return Math.round(m*100)/100;
}
function scoreGain(base, combo){
  const mul = comboMultiplier(combo);
  return Math.round(base * mul);
}

export function boot(opts = {}){
  const diffKey = String(opts.diff || 'normal').toLowerCase();
  const runMode = String(opts.run || 'play').toLowerCase();
  const challenge = String(opts.challenge || 'rush').toLowerCase();
  const durationSec = clamp(opts.time || 60, 20, 180) | 0;

  const D = pickDiff(diffKey);
  const layer = opts.layerEl || document.getElementById('gj-layer');
  if (!layer) throw new Error('[GoodJunk] layerEl missing');

  const SM = (() => {
    const m = opts.safeMargins || {};
    return {
      top:    Math.max(0, (m.top|0) || 130),
      bottom: Math.max(0, (m.bottom|0) || 170),
      left:   Math.max(0, (m.left|0) || 26),
      right:  Math.max(0, (m.right|0) || 26),
    };
  })();

  const elRing  = document.getElementById('atk-ring');
  const elLaser = document.getElementById('atk-laser');

  // ---- session ids ----
  const sessionId = (opts.sessionId || `${Date.now()}-${uid8()}`).toString();
  const startedIso = new Date().toISOString();

  const S = {
    running: true,
    startedAt: now(),
    endAt: now() + durationSec*1000,
    timeLeft: durationSec,

    score: 0,
    goodHits: 0,

    // ✅ MISS RULE
    misses: 0,            // = goodExpired + junkHit (shield block junk doesn't add)
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

    finalLock: false,
    finalLockEndsAt: 0,
    lastFinalPulseSec: null,

    bossSpawned: false,
    bossAlive: false,
    bossPhase: 1,
    bossHp: 0,
    bossHpMax: 0,
    bossDecoyCooldownAt: 0,

    pulseActive: false,
    pulseX: 0,
    pulseY: 0,
    pulseDeadlineAt: 0,
    pulseNextAt: 0,
    pulseRadiusPx: 74,

    bossAtkNextAt: 0,
    bossAtkLast: '',

    ringActive: false,
    ringX: 0, ringY: 0,
    ringR: 210,
    ringTh: 34,
    ringGapA: 0,
    ringGapW: 0,
    ringEndsAt: 0,

    laserActive: false,
    laserY: 0,
    laserWarnEndsAt: 0,
    laserFireAt: 0,
    laserEndsAt: 0,

    hazardLockUntil: 0,

    lastSpawnAt: 0,
    targets: new Map(),
    nextId: 1,

    stormActive: false,
    stormEndsAt: 0,
    stormMul: 1.0,

    panicLevel: 0,
    panicEndsAt: 0,

    ringTickNextAt: 0,
    ringTickRateMs: 0,
    laserTickNextAt: 0,
    laserTickRateMs: 0,

    // anti-clump memory (screen coords)
    recentPts: []
  };

  // ===== QUEST DIRECTOR =====
  const qDir = makeQuestDirector({
    diff: diffKey,
    challenge,
    goalDefs: GOODJUNK_GOALS,
    miniDefs: GOODJUNK_MINIS,
    maxGoals: 2,
    maxMini: 999
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

  // expose for director getActive() fallback
  ROOT.__GJ_QSTATE__ = qState;

  // ===== QUEST BRIDGE (force quest:update for HUD) =====
  let _prevGoalKey = '';
  let _prevMiniKey = '';

  function _pickActiveFromDirector(){
    let g = null, m = null;

    try{
      if (qDir && typeof qDir.getActive === 'function'){
        const a = qDir.getActive() || {};
        g = a.activeGoal || a.goal || g;
        m = a.activeMini || a.mini || m;
      }
    }catch(_){}

    try{ if (!g && qDir && typeof qDir.getActiveGoal === 'function') g = qDir.getActiveGoal(); }catch(_){}
    try{ if (!m && qDir && typeof qDir.getActiveMini === 'function') m = qDir.getActiveMini(); }catch(_){}

    if (!g) g = qDir.activeGoal || (qDir.stateQ && qDir.stateQ.activeGoal) || null;
    if (!m) m = qDir.activeMini || (qDir.stateQ && qDir.stateQ.activeMini) || null;

    return { goalDef:g, miniDef:m };
  }

  function _targetOf(def){
    if (!def) return 0;
    const tb = def.targetByDiff || def.targetsByDiff || null;
    let t = 0;
    if (tb && typeof tb === 'object'){
      t = Number(tb[diffKey] ?? tb.normal ?? tb.easy ?? 0) || 0;
    }
    if (!t) t = Number(def.target ?? def.count ?? def.goal ?? 0) || 0;
    return t|0;
  }

  function _valueOf(def){
    if (!def) return 0;
    try{
      const fn = def.eval || def.value || def.get || null;
      if (typeof fn === 'function') return (Number(fn(qState)) || 0) | 0;
    }catch(_){}
    return 0;
  }

  function _titleOf(def, fallback='—'){
    if (!def) return fallback;
    return String(def.label || def.title || def.name || fallback);
  }

  function _doneOf(def, cur, tgt){
    if (!def) return false;
    try{
      if (typeof def.pass === 'function') return !!def.pass(cur, tgt);
    }catch(_){}
    return (tgt > 0) ? (cur >= tgt) : false;
  }

  function publishQuestUpdate(reason='tick'){
    const { goalDef, miniDef } = _pickActiveFromDirector();

    const gTitle = _titleOf(goalDef, 'Goal: เริ่มภารกิจ…');
    const mTitle = _titleOf(miniDef, 'Mini: —');

    const gT = _targetOf(goalDef);
    const mT = _targetOf(miniDef);

    const gC = _valueOf(goalDef);
    const mC = _valueOf(miniDef);

    const gDone = _doneOf(goalDef, gC, gT);
    const mDone = _doneOf(miniDef, mC, mT);

    const gPct = (gT>0) ? clamp(gC/gT, 0, 1) : 0;
    const mPct = (mT>0) ? clamp(mC/mT, 0, 1) : 0;

    const gKey = String(goalDef?.id || gTitle || '');
    const mKey = String(miniDef?.id || mTitle || '');

    if (gKey && gKey !== _prevGoalKey){
      _prevGoalKey = gKey;
      safeDispatch('quest:goalStart', { title:gTitle, reason });
    }
    if (mKey && mKey !== _prevMiniKey){
      _prevMiniKey = mKey;
      safeDispatch('quest:miniStart', { title:mTitle, reason });
    }

    safeDispatch('quest:update', {
      reason,

      goal: { title:gTitle, cur:gC|0, target:gT|0, pct:gPct, done:!!gDone },
      mini: { title:mTitle, cur:mC|0, target:mT|0, pct:mPct, done:!!mDone },

      goalTitle: gTitle,
      goalCur: gC|0,
      goalTarget: gT|0,
      goalPct: Math.round(gPct*100),
      goalDone: !!gDone,

      miniTitle: mTitle,
      miniCur: mC|0,
      miniTarget: mT|0,
      miniPct: Math.round(mPct*100),
      miniDone: !!mDone
    });
  }

  let lastBadAt = now();
  const markBad = ()=>{
    lastBadAt = now();
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
  };
  const markGood = ()=>{
    qState.streakGood = (qState.streakGood|0) + 1;
    if ((S.timeLeft|0) <= 8) qState.final8Good = (qState.final8Good|0) + 1;
  };

  // ✅ PATCH: miniStart ต้องรีเซ็ต “ฐานเวลา” ของ No Junk Zone ด้วย
  window.addEventListener('quest:miniStart', ()=>{
    qState.goldHitsThisMini = 0;
    qState.blocks = 0;
    qState.stunBreaks = 0;
    qState.timePlus = 0;
    qState.safeNoJunkSeconds = 0;
    qState.final8Good = 0;
    lastBadAt = now(); // ✅ ทำให้ No Junk Zone เริ่มนับใหม่จริง
  }, { passive:true });

  // ===== Logging helpers (Google Sheet logger listens hha:log_*) =====
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
      ...(extra||{})
    });
  }

  safeDispatch('hha:log_profile', {
    ts: Date.now(),
    hint: 'optional (send student profile from hub.html later)'
  });

  function emitScore(){
    safeDispatch('hha:score', {
      score: S.score|0,
      goodHits: S.goodHits|0,
      misses: S.misses|0,
      comboMax: S.comboMax|0,
      multiplier: comboMultiplier(S.combo|0),
      bossAlive: !!S.bossAlive,
      bossPhase: S.bossPhase|0,
      bossHp: S.bossHp|0,
      bossHpMax: S.bossHpMax|0,
      goodExpired: S.goodExpired|0,
      junkHits: S.junkHits|0
    });
  }
  function emitTime(){ safeDispatch('hha:time', { sec: S.timeLeft|0 }); }
  function emitFever(){
    safeDispatch('hha:fever', {
      fever: clamp(S.fever,0,100),
      shield: S.shield|0,
      stunActive: !!S.stunActive,
      slow: Number(S.slow)||1
    });
  }
  function setJudge(label){ safeDispatch('hha:judge', { label: String(label||'') }); }

  function fxKick(intensity=1){ safeDispatch('hha:fx', { type:'kick', intensity: Number(intensity||1) }); }
  function fxChroma(ms=180){ safeDispatch('hha:fx', { type:'chroma', ms: ms|0 }); }
  function fxHero(ms=220){ safeDispatch('hha:fx', { type:'hero', ms: ms|0 }); }

  function setStorm(ms = 1600, mul = 0.62){
    S.stormActive = true;
    S.stormEndsAt = now() + Math.max(400, ms|0);
    S.stormMul = clamp(Number(mul)||0.62, 0.40, 1.0);
    safeDispatch('hha:storm', { active:true, ms: ms|0, mul: S.stormMul });
  }
  function clearStorm(){
    if (!S.stormActive) return;
    S.stormActive = false;
    S.stormMul = 1.0;
    safeDispatch('hha:storm', { active:false });
  }
  function setPanic(level = 0.6, ms = 900){
    const t = now();
    const L = clamp(level, 0, 1);
    S.panicLevel = Math.max(S.panicLevel||0, L);
    S.panicEndsAt = Math.max(S.panicEndsAt||0, t + Math.max(200, ms|0));
    safeDispatch('hha:panic', { level: S.panicLevel, ms: ms|0 });
  }
  function tick(kind='tick', intensity=1){
    safeDispatch('hha:tick', { kind, intensity: clamp(intensity, 0.2, 3) });
  }

  function setCombo(v){
    S.combo = Math.max(0, v|0);
    if (S.combo > S.comboMax) S.comboMax = S.combo;
  }
  function addFever(delta){ S.fever = clamp((S.fever||0) + (delta||0), 0, 100); }

  function getSafeScreenRect(){
    const left   = SM.left;
    const right  = innerWidth - SM.right;
    const top    = SM.top;
    const bottom = innerHeight - SM.bottom;
    return {
      left, right: Math.max(left+10, right),
      top, bottom: Math.max(top+10, bottom)
    };
  }

  // ---- Anti-clump placement ----
  function rememberPt(x,y){
    S.recentPts.push({x,y,t:now()});
    if (S.recentPts.length > 14) S.recentPts.shift();
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
  function pickSpawnPoint(posScreen){
    const R = getSafeScreenRect();
    if (posScreen){
      const xs = clamp(posScreen.x|0, R.left, R.right);
      const ys = clamp(posScreen.y|0, R.top,  R.bottom);
      return { x: xs, y: ys };
    }

    const cur = getAimPoint();
    const tries = 34;
    for (let i=0;i<tries;i++){
      const x = randi(R.left, R.right);
      const y = randi(R.top,  R.bottom);
      const awayAim = dist2(x,y, cur.x,cur.y) >= (190*190);
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

  function syncQuestState(){
    qState.score = S.score|0;
    qState.goodHits = S.goodHits|0;
    qState.miss = S.misses|0;
    qState.comboMax = S.comboMax|0;
    qState.timeLeft = S.timeLeft|0;
    qState.safeNoJunkSeconds = Math.max(0, Math.floor((now() - lastBadAt) / 1000));
  }

  let _qtLock = 0;
  function tickQuestNow(reason='event'){
    const t = now();
    if (t < _qtLock) return;
    _qtLock = t + 18;

    syncQuestState();
    try{ qDir.tick(qState); }catch(_){}

    // ✅ สำคัญ: HUD ต้องเห็นเสมอ
    publishQuestUpdate(reason);
  }

  function applyPenalty(kind='hazard'){
    const tnow = now();
    if (tnow < (S.hazardLockUntil||0)) return;
    S.hazardLockUntil = tnow + 420;

    fxChroma(170);
    fxKick(1.25);
    setPanic(0.75, 650);

    markBad();

    const ap = getAimPoint();
    if ((S.shield|0) > 0){
      S.shield = 0;
      safeDispatch('quest:badHit', { kind: kind + ':shieldbreak' });
      setJudge('SHIELD BREAK!');
      burstFX(ap.x, ap.y, 'trap');
      addFever(-14);
      logEvent('shield_break', { by: kind });
    } else {
      S.junkHits++;
      S.misses++;
      setCombo(0);
      safeDispatch('quest:badHit', { kind });
      setJudge('HIT!');
      burstFX(ap.x, ap.y, 'trap');
      addFever(-18);
      logEvent('hazard_hit', { by: kind });
    }
    emitScore();
    emitFever();
    tickQuestNow('penalty');
  }

  function startStun(){
    S.stunActive = true;
    S.slow = 0.62;
    S.stunEndsAt = now() + 6200;
    S.fever = 65;
    setJudge('STUN!');
    setPanic(0.85, 900);
    emitFever();
    logEvent('stun_start', {});
    try{ Particles.celebrate && Particles.celebrate({ kind:'STUN', intensity:1.2 }); }catch(_){}
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
    safeDispatch('quest:power', { power:'magnet' });
    setJudge('MAGNET!');
    const ap = getAimPoint();
    burstFX(ap.x, ap.y, 'power');
    logEvent('power_magnet', {});
  }
  function addTime(){
    S.endAt += 3000;
    qState.timePlus = (qState.timePlus|0) + 1;
    safeDispatch('quest:power', { power:'time' });
    setJudge('+TIME!');
    const ap = getAimPoint();
    burstFX(ap.x, ap.y, 'power');
    logEvent('power_time', {});
    tickQuestNow('timePlus');
  }
  function addShield(){
    S.shield = clamp((S.shield|0) + 1, 0, 5);
    safeDispatch('quest:power', { power:'shield' });
    setJudge('+SHIELD!');
    emitFever();
    logEvent('power_shield', { shield:S.shield|0 });
  }

  function startHeroBurst(){
    S.heroBurstActive = true;
    S.heroBurstEndsAt = now() + 1500;
    fxHero(240);
    setJudge('HERO BURST!');
    setPanic(0.55, 520);
    logEvent('hero_burst', {});
    try{ Particles.celebrate && Particles.celebrate({ kind:'HERO', intensity:1.2 }); }catch(_){}
  }

  function triggerFinalPulse(secLeft){
    if (S.finalLock) return;
    S.finalLock = true;
    S.finalLockEndsAt = now() + 1000;
    safeDispatch('hha:finalPulse', { secLeft: secLeft|0 });
  }

  function endGame(){
    if (!S.running) return;
    S.running = false;

    for (const t of S.targets.values()){
      try{ killEl(t.el); }catch(_){}
    }
    S.targets.clear();

    try{ if (elRing) elRing.classList.remove('show'); }catch(_){}
    try{ if (elLaser) elLaser.classList.remove('warn','fire'); }catch(_){}

    const endedIso = new Date().toISOString();
    logSession('end', { endedIso });

    safeDispatch('hha:end', {
      sessionId,
      score: S.score|0,
      goodHits: S.goodHits|0,
      misses: S.misses|0,
      goodExpired: S.goodExpired|0,
      junkHits: S.junkHits|0,
      comboMax: S.comboMax|0,
      durationSec: durationSec|0,
      diff: diffKey,
      challenge,
      runMode
    });
  }

  function spawnTarget(kind, posScreen=null){
    if (!S.running) return null;
    if (S.targets.size >= D.maxActive && kind !== 'boss') return null;

    const pos = pickSpawnPoint(posScreen);
    const pL = toLayerPt(pos.x, pos.y);
    const xL = pL.x, yL = pL.y;

    let emoji = '❓', cls = '', ttl = D.ttlMs;

    if (kind === 'good'){
      emoji = POOL_GOOD[randi(0, POOL_GOOD.length-1)];
    } else if (kind === 'junk'){
      emoji = POOL_JUNK[randi(0, POOL_JUNK.length-1)];
      cls = 'gj-junk';
    } else if (kind === 'fake'){
      emoji = POOL_FAKE[randi(0, POOL_FAKE.length-1)];
      cls = 'gj-fake';
      ttl = Math.round(ttl * 0.92);
    } else if (kind === 'gold'){
      emoji = EMO_GOLD;
      cls = 'gj-gold';
      ttl = Math.round(ttl * 0.95);
    } else if (kind === 'power'){
      const p = randi(1,3);
      emoji = (p===1) ? EMO_MAG : (p===2) ? EMO_TIME : EMO_SHLD;
      cls = 'gj-power';
      ttl = Math.round(ttl * 0.92);
    } else if (kind === 'boss'){
      emoji = (S.bossPhase === 2) ? EMO_BOSS2 : EMO_BOSS1;
      cls = 'gj-boss';
      ttl = 999999;
    } else if (kind === 'decoy'){
      emoji = POOL_JUNK[randi(0, POOL_JUNK.length-1)];
      cls = 'gj-junk';
      ttl = Math.round(ttl * 0.72);
    } else if (kind === 'goodfake'){
      emoji = POOL_GOOD[randi(0, POOL_GOOD.length-1)];
      cls = 'gj-fake';
      ttl = Math.round(ttl * 0.86);
    }

    const el = createEl(layer, xL, yL, emoji, cls);

    const sc = (kind === 'boss')
      ? (1.28 * D.scale)
      : (0.98 + Math.random()*0.22) * D.scale;
    el.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(3)})`;

    const id = S.nextId++;
    const t = {
      id, kind, el,
      x: xL, y: yL,
      bornAt: now(),
      expiresAt: now() + ttl
    };
    S.targets.set(id, t);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.(); ev.stopPropagation?.();
      onHit(t, 'tap');
    }, { passive:false });

    return t;
  }

  function spawnWave(){
    const p = Math.random();
    const pGold = D.goldRatio;
    const pPower= D.powerRatio;
    const pFake = 0.12;
    const pJunk = D.junkRatio + (challenge==='survival' ? 0.06 : 0);

    if (challenge === 'boss'){
      if (p < pGold) return spawnTarget('gold');
      if (p < pGold + pPower) return spawnTarget('power');
      if (p < pGold + pPower + pFake) return spawnTarget('fake');
      if (p < pGold + pPower + pFake + (pJunk+0.08)) return spawnTarget('junk');
      return spawnTarget('good');
    }

    if (p < pGold) return spawnTarget('gold');
    if (p < pGold + pPower) return spawnTarget('power');
    if (p < pGold + pPower + pFake) return spawnTarget('fake');
    if (p < pGold + pPower + pFake + pJunk) return spawnTarget('junk');
    return spawnTarget('good');
  }

  function maybeSpawnBoss(){
    if (challenge !== 'boss') return;
    if (S.bossSpawned) return;
    if ((S.timeLeft|0) > 22) return;

    S.bossSpawned = true;
    S.bossAlive = true;
    S.bossPhase = 1;
    S.bossHpMax = D.bossHp|0;
    S.bossHp = S.bossHpMax;

    spawnTarget('boss');

    try{ Particles.celebrate && Particles.celebrate({ kind:'BOSS_SPAWN', intensity:1.4 }); }catch(_){}
    setJudge('BOSS!');
    setPanic(0.65, 650);
    logEvent('boss_spawn', { hp:S.bossHpMax|0 });
    emitScore();
    tickQuestNow('bossSpawn');
  }

  function bossToPhase2(){
    if (!S.bossAlive || S.bossPhase >= 2) return;
    S.bossPhase = 2;
    setJudge('PHASE 2!');
    setPanic(0.85, 900);
    logEvent('boss_phase2', {});
    try{ Particles.celebrate && Particles.celebrate({ kind:'BOSS_PHASE2', intensity:1.6 }); }catch(_){}
    S.pulseNextAt = now() + 900;

    S.bossAtkNextAt = now() + 900;
    S.bossAtkLast = '';
    emitScore();
    tickQuestNow('bossPhase2');
  }

  function bossClear(){
    if (!S.bossAlive) return;
    S.bossAlive = false;
    qState.bossCleared = true;

    for (const t of Array.from(S.targets.values())){
      if (t.kind === 'boss'){ killEl(t.el); S.targets.delete(t.id); }
    }

    try{ Particles.celebrate && Particles.celebrate({ kind:'BOSS_CLEAR', intensity:2.0 }); }catch(_){}
    safeDispatch('quest:bossClear', {});
    setJudge('BOSS CLEARED!');
    setPanic(0.2, 220);
    logEvent('boss_clear', {});
    emitScore();
    tickQuestNow('bossClear');
  }

  function pickPulsePoint(){
    const R = getSafeScreenRect();
    const pad = 70;
    const cur = getAimPoint();

    const left = Math.max(R.left, pad);
    const right= Math.min(R.right, innerWidth - pad);
    const top  = Math.max(R.top, 150);
    const bot  = Math.min(R.bottom, innerHeight - 190);

    for (let i=0;i<30;i++){
      const x = randi(left, Math.max(left+10, right));
      const y = randi(top,  Math.max(top+10, bot));
      if (dist2(x,y, cur.x,cur.y) >= (260*260) && farEnough(x,y,160)){
        rememberPt(x,y);
        return { x, y };
      }
    }
    return { x: (innerWidth*0.5)|0, y: (innerHeight*0.62)|0 };
  }

  function startBossPulse(){
    const p = pickPulsePoint();
    S.pulseActive = true;
    S.pulseX = p.x|0;
    S.pulseY = p.y|0;
    S.pulseDeadlineAt = now() + 1200;
    safeDispatch('hha:bossPulse', { x:S.pulseX, y:S.pulseY, ttlMs:1200 });
    logEvent('boss_pulse_start', { x:S.pulseX, y:S.pulseY });
  }

  function resolveBossPulse(){
    if (!S.pulseActive) return;

    const ap = getAimPoint();
    const ok = dist2(ap.x, ap.y, S.pulseX, S.pulseY) <= (S.pulseRadiusPx * S.pulseRadiusPx);

    if (ok){
      setJudge('PULSE OK!');
      const pts = 35;
      S.score += pts;
      S.goodHits++;
      setCombo(S.combo + 1);
      addFever(8);
      scorePop(S.pulseX, S.pulseY, `+${pts}`, 'PULSE!');
      burstFX(S.pulseX, S.pulseY, 'gold');
      safeDispatch('quest:goodHit', { kind:'pulse' });
      markGood();
      startHeroBurst();
      logEvent('boss_pulse_ok', {});
    } else {
      setJudge('PULSE HIT!');
      burstFX(S.pulseX, S.pulseY, 'trap');
      applyPenalty('pulse');
      logEvent('boss_pulse_fail', {});
    }

    S.pulseActive = false;
    emitScore();
    emitFever();
    tickQuestNow('pulse');
  }

  function showRingAt(x,y,gapStartDeg,gapSizeDeg,ms=1200){
    if (!elRing) return;
    elRing.style.left = (x|0)+'px';
    elRing.style.top  = (y|0)+'px';
    elRing.style.transform = 'translate(-50%,-50%)';
    document.documentElement.style.setProperty('--ringGapStart', gapStartDeg.toFixed(0)+'deg');
    document.documentElement.style.setProperty('--ringGapSize',  gapSizeDeg.toFixed(0)+'deg');
    elRing.classList.add('show');
    setTimeout(()=>{ try{ elRing.classList.remove('show'); }catch(_){ } }, Math.max(300, ms|0));
  }
  function laserWarnAt(y, warnMs=420, fireMs=260){
    if (!elLaser) return;
    elLaser.style.top = (y|0)+'px';
    elLaser.classList.remove('fire');
    elLaser.classList.add('warn');
    setTimeout(()=>{
      try{
        elLaser.classList.remove('warn');
        elLaser.classList.add('fire');
        setTimeout(()=>{ try{ elLaser.classList.remove('fire'); }catch(_){ } }, Math.max(120, fireMs|0));
      }catch(_){}
    }, Math.max(120, warnMs|0));
  }

  function bossAttackPattern(){
    const patterns = ['ring','laser','storm'];
    let pick = patterns[randi(0, patterns.length-1)];
    if (pick === S.bossAtkLast) pick = patterns[(patterns.indexOf(pick)+1) % patterns.length];
    S.bossAtkLast = pick;

    const ap = getAimPoint();
    const center = { x: ap.x|0, y: ap.y|0 };

    const detail = { name: pick };
    if (pick === 'ring')  detail.ttlMs = (diffKey==='hard' ? 1200 : 1350);
    if (pick === 'laser'){ detail.warnMs = 420; detail.fireMs = 260; }
    if (pick === 'storm') detail.ttlMs = (diffKey==='hard' ? 1900 : 1600);
    safeDispatch('hha:bossAtk', detail);

    if (pick === 'ring'){
      setJudge('BOSS: RING!');
      fxChroma(140);
      setPanic(diffKey==='hard' ? 0.75 : 0.55, 900);
      logEvent('boss_atk_ring', {});

      S.ringActive = true;
      S.ringX = center.x|0;
      S.ringY = center.y|0;
      S.ringR = Math.round(210 + (diffKey==='hard'? 28 : diffKey==='easy'? -10 : 0));
      S.ringTh= Math.round(34 + (diffKey==='hard'? 8 : 0));
      S.ringGapW = (Math.PI / (diffKey==='hard'? 4.2 : 3.2));
      S.ringGapA = (Math.random()*Math.PI*2);

      S.ringEndsAt = now() + (diffKey==='hard' ? 1200 : 1350);

      S.ringTickRateMs = (diffKey==='hard' ? 90 : 115);
      S.ringTickNextAt = now() + 60;

      const gapSizeDeg = (S.ringGapW * 180/Math.PI);
      const gapStartDeg = (S.ringGapA * 180/Math.PI);
      showRingAt(S.ringX, S.ringY, gapStartDeg, gapSizeDeg, (S.ringEndsAt-now())|0);

      const n = 8;
      const gapIndex = randi(0, n-1);
      for (let i=0;i<n;i++){
        if (i === gapIndex) continue;
        const ang = (Math.PI*2) * (i/n);
        const xs = clamp(center.x + Math.cos(ang)*S.ringR, 40, innerWidth-40);
        const ys = clamp(center.y + Math.sin(ang)*S.ringR, 40, innerHeight-40);
        spawnTarget('junk', { x: xs, y: ys });
      }

    } else if (pick === 'laser'){
      setJudge('BOSS: LASER!');
      fxChroma(160);
      setPanic(diffKey==='hard' ? 0.95 : 0.75, 950);
      logEvent('boss_atk_laser', {});

      const y = clamp(center.y + randi(-90,90), SM.top + 40, innerHeight - SM.bottom - 40);
      S.laserActive = true;
      S.laserY = y|0;
      S.laserWarnEndsAt = now() + 420;
      S.laserFireAt = now() + 420;
      S.laserEndsAt = S.laserFireAt + 260;

      S.laserTickRateMs = (diffKey==='hard' ? 70 : 90);
      S.laserTickNextAt = now() + 40;

      laserWarnAt(S.laserY, 420, 260);

      for (let i=0;i<3;i++) spawnTarget('decoy');

    } else {
      setJudge('BOSS: STORM!');
      fxChroma(150);
      logEvent('boss_atk_storm', {});

      setStorm(diffKey==='hard' ? 1900 : 1600, diffKey==='hard' ? 0.52 : 0.62);
      setPanic(diffKey==='hard' ? 0.85 : 0.65, 1000);

      for (let i=0;i<5;i++) spawnTarget('decoy');

      spawnTarget('gold', { x: clamp(center.x + randi(-120,120), 50, innerWidth-50), y: clamp(center.y + randi(-90,90), SM.top+40, innerHeight-SM.bottom-40) });
      spawnTarget('good', { x: clamp(center.x + randi(-140,140), 50, innerWidth-50), y: clamp(center.y + randi(-90,90), SM.top+40, innerHeight-SM.bottom-40) });
      spawnTarget('goodfake', { x: clamp(center.x + randi(-140,140), 50, innerWidth-50), y: clamp(center.y + randi(-90,90), SM.top+40, innerHeight-SM.bottom-40) });
    }
  }

  function onHit(t, via='tap'){
    if (!S.running) return;
    if (S.finalLock){ setJudge('LOCK!'); return; }

    const rect = t.el.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    const isBad =
      (t.kind === 'junk' || t.kind === 'fake' || t.kind === 'decoy' || t.kind === 'goodfake');

    if (t.kind === 'good'){
      S.goodHits++;
      setCombo(S.combo + 1);
      addFever(8);

      const pts = scoreGain(20, S.combo);
      S.score += pts;

      scorePop(cx, cy, `+${pts}`, (S.combo>=10 ? 'PERFECT!' : 'GOOD!'));
      burstFX(cx, cy, 'good');
      safeDispatch('quest:goodHit', { kind:'good' });

      markGood();

      killEl(t.el); S.targets.delete(t.id);
      logEvent('hit_good', { via });

      tickQuestNow('hit_good');

    } else if (t.kind === 'gold'){
      S.goodHits++;
      setCombo(S.combo + 1);
      addFever(12);

      const pts = scoreGain(90, S.combo);
      S.score += pts;

      qState.goldHitsThisMini = (qState.goldHitsThisMini|0) + 1;

      markGood();

      scorePop(cx, cy, `+${pts}`, 'GOLD!');
      burstFX(cx, cy, 'gold');
      safeDispatch('quest:power', { power:'gold' });
      safeDispatch('quest:goodHit', { kind:'gold' });

      killEl(t.el); S.targets.delete(t.id);
      logEvent('hit_gold', { via, goldHitsThisMini: qState.goldHitsThisMini|0 });

      tickQuestNow('hit_gold');

    } else if (t.kind === 'power'){
      addFever(6);
      const emo = t.el.textContent;
      if (emo === EMO_MAG) activateMagnet();
      else if (emo === EMO_TIME) addTime();
      else addShield();

      markGood();

      scorePop(cx, cy, '', 'POWER!');
      burstFX(cx, cy, 'power');
      safeDispatch('quest:goodHit', { kind:'power' });

      killEl(t.el); S.targets.delete(t.id);
      logEvent('hit_power', { via, emo });

      tickQuestNow('hit_power');

    } else if (t.kind === 'boss'){
      setCombo(S.combo + 1);
      addFever(10);

      S.bossHp = Math.max(0, (S.bossHp|0) - 1);

      const pts = scoreGain(35, S.combo);
      S.score += pts;

      markGood();

      scorePop(cx, cy, `+${pts}`, (S.bossPhase===2 ? 'PHASE 2!' : 'BOSS HIT!'));
      burstFX(cx, cy, 'gold');
      safeDispatch('quest:goodHit', { kind:'boss' });

      const half = Math.ceil((S.bossHpMax|0) * 0.5);
      if (S.bossPhase === 1 && (S.bossHp|0) <= (S.bossHpMax - half)){
        bossToPhase2();
      }
      if (S.bossPhase === 2 && now() >= S.bossDecoyCooldownAt){
        S.bossDecoyCooldownAt = now() + 650;
        for (let i=0;i<2;i++) spawnTarget('decoy');
      }

      if ((S.bossHp|0) <= 0) bossClear();
      emitScore();
      logEvent('hit_boss', { via, hp:S.bossHp|0 });

      tickQuestNow('hit_boss');

    } else if (isBad){
      markBad();

      if ((S.shield|0) > 0){
        // ✅ shield block junk => NOT miss
        if (challenge === 'boss' && S.bossPhase === 2){
          // phase2 penalty: shield breaks + counts miss (หนักจริง)
          S.shield = 0;
          S.junkHits++;
          S.misses++;
          setCombo(0);
          scorePop(cx, cy, '💥', 'SHIELD BREAK!');
          burstFX(cx, cy, 'trap');
          safeDispatch('quest:badHit', { kind:'shieldbreak' });
          fxKick(1.1); fxChroma(170);
          setPanic(0.95, 800);
          logEvent('hit_bad_phase2_break', { via, kind:t.kind });
        } else {
          S.shield = Math.max(0, (S.shield|0) - 1);
          qState.blocks = (qState.blocks|0) + 1;
          safeDispatch('quest:block', {});
          scorePop(cx, cy, '🛡️', 'BLOCK!');
          burstFX(cx, cy, 'power');
          fxKick(0.65);
          setPanic(0.35, 420);
          logEvent('block_bad', { via, kind:t.kind, shield:S.shield|0, blocks:qState.blocks|0 });

          tickQuestNow('block');
        }
      } else {
        // junk hit => miss++
        S.junkHits++;
        S.misses++;
        setCombo(0);
        addFever(-12);
        scorePop(cx, cy, '', 'MISS!');
        burstFX(cx, cy, 'trap');
        safeDispatch('quest:badHit', { kind:t.kind });
        fxKick(1.15); fxChroma(170);
        setPanic(0.85, 850);
        logEvent('hit_bad', { via, kind:t.kind });
      }

      killEl(t.el); S.targets.delete(t.id);
      tickQuestNow('bad');
    }

    if (!S.stunActive && (S.fever|0) >= 100){
      startStun();
    }

    emitScore();
    emitFever();
  }

  // ✅ Crosshair shoot: find nearest target around aim point
  function shootCrosshair(){
    if (!S.running) return;
    const ap = getAimPoint();
    const thr = 62; // px
    let best=null, bestD=1e18;
    for (const t of S.targets.values()){
      if (!t?.el) continue;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const d = dist2(cx,cy, ap.x,ap.y);
      if (d < bestD){ bestD=d; best=t; }
    }
    if (best && bestD <= thr*thr){
      onHit(best, 'crosshair');
      return true;
    }
    setJudge('MISS AIM!');
    safeDispatch('hha:fx', { type:'kick', intensity: 0.55 });
    logEvent('shoot_miss', { x:ap.x|0, y:ap.y|0 });
    return false;
  }

  // hook: allow boot to pass shootEl
  if (opts.shootEl){
    try{
      opts.shootEl.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault?.();
        shootCrosshair();
      }, { passive:false });
    }catch(_){}
  } else {
    try{
      layer.addEventListener('pointerdown', (ev)=>{
        if (ev.target && ev.target.classList && ev.target.classList.contains('gj-target')) return;
        shootCrosshair();
      }, { passive:false });
    }catch(_){}
  }

  function expireTick(){
    const tnow = now();
    for (const t of Array.from(S.targets.values())){
      if (t.kind === 'boss') continue;
      if (tnow >= t.expiresAt){
        if (t.kind === 'good' || t.kind === 'gold'){
          // ✅ good expired => MISS++
          S.goodExpired++;
          S.misses++;
          setCombo(Math.max(0, (S.combo|0) - 2));
          markBad();
          safeDispatch('quest:badHit', { kind:'goodExpired' });
          logEvent('good_expired', { kind:t.kind });

          tickQuestNow('goodExpired');
        }
        killEl(t.el);
        S.targets.delete(t.id);
      }
    }
  }

  function stunFieldTick(){
    if (!S.stunActive) return;
    const ap = getAimPoint();
    const R = 140, R2 = R*R;

    for (const t of Array.from(S.targets.values())){
      if (t.kind !== 'junk' && t.kind !== 'fake' && t.kind !== 'decoy' && t.kind !== 'goodfake') continue;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      if (dist2(cx,cy, ap.x,ap.y) <= R2){
        setJudge('STUN BREAK!');
        qState.stunBreaks = (qState.stunBreaks|0) + 1;
        safeDispatch('quest:stunBreak', {});
        burstFX(cx,cy,'ice');
        killEl(t.el);
        S.targets.delete(t.id);
        logEvent('stun_break', { kind:t.kind, stunBreaks:qState.stunBreaks|0 });

        tickQuestNow('stunBreak');
      }
    }
  }

  function getAimPointLayer(){
    const ap = getAimPoint();
    const p = toLayerPt(ap.x, ap.y);
    return { x: p.x, y: p.y };
  }

  function heroBurstTick(){
    if (!S.heroBurstActive) return;
    const tnow = now();
    if (tnow >= S.heroBurstEndsAt){
      S.heroBurstActive = false;
      return;
    }
    const apL = getAimPointLayer();
    const strength = 0.18;
    const swirl = 0.08;

    for (const t of S.targets.values()){
      if (t.kind !== 'good' && t.kind !== 'gold' && t.kind !== 'power') continue;

      const dx = apL.x - t.x;
      const dy = apL.y - t.y;

      t.x = lerp(t.x, apL.x, strength);
      t.y = lerp(t.y, apL.y, strength);

      t.x += (-dy) * swirl * 0.002;
      t.y += ( dx) * swirl * 0.002;

      t.el.style.left = (t.x|0) + 'px';
      t.el.style.top  = (t.y|0) + 'px';
    }
  }

  function magnetTick(){
    if (!S.magnetActive) return;
    const tnow = now();
    if (tnow >= S.magnetEndsAt){
      S.magnetActive = false;
      return;
    }

    const apL = getAimPointLayer();
    const strength = (diffKey==='hard' ? 0.11 : diffKey==='easy' ? 0.08 : 0.095);
    const swirl = 0.035;

    for (const t of S.targets.values()){
      if (t.kind !== 'good' && t.kind !== 'gold' && t.kind !== 'power') continue;

      const dx = apL.x - t.x;
      const dy = apL.y - t.y;

      t.x = lerp(t.x, apL.x, strength);
      t.y = lerp(t.y, apL.y, strength);

      t.x += (-dy) * swirl * 0.002;
      t.y += ( dx) * swirl * 0.002;

      t.el.style.left = (t.x|0) + 'px';
      t.el.style.top  = (t.y|0) + 'px';
    }
  }

  function hazardsTick(){
    const tnow = now();
    const ap = getAimPoint();

    if (S.ringActive){
      if (tnow >= S.ringEndsAt){
        S.ringActive = false;
      } else {
        const dx = ap.x - S.ringX;
        const dy = ap.y - S.ringY;
        const d = Math.sqrt(dx*dx + dy*dy);

        const inBand = (d >= (S.ringR - S.ringTh)) && (d <= (S.ringR + S.ringTh));
        if (inBand){
          let a = Math.atan2(dy, dx);
          if (a < 0) a += Math.PI*2;

          const ga = S.ringGapA;
          const gw = S.ringGapW;
          const diff = Math.atan2(Math.sin(a-ga), Math.cos(a-ga));
          const inGap = Math.abs(diff) <= (gw*0.5);

          if (!inGap){
            applyPenalty('ring');
          }
        }
      }
    }

    if (S.laserActive){
      if (tnow >= S.laserEndsAt){
        S.laserActive = false;
        try{ if (elLaser) elLaser.classList.remove('warn','fire'); }catch(_){}
      } else if (tnow >= S.laserFireAt && tnow <= S.laserEndsAt){
        const tol = (diffKey==='hard') ? 26 : 30;
        if (Math.abs((ap.y|0) - (S.laserY|0)) <= tol){
          applyPenalty('laser');
        }
      }
    }

    if (S.ringActive){
      if (tnow >= (S.ringTickNextAt||0)){
        const left = (S.ringEndsAt||0) - tnow;
        const fast = (left < 420);
        tick('ring', fast ? 1.6 : 1.0);
        if (fast) setPanic(0.9, 250);
        S.ringTickNextAt = tnow + Math.max(45, (S.ringTickRateMs||110) - (fast ? 20 : 0));
      }
      if (((S.ringEndsAt||0) - tnow) < 260) safeDispatch('hha:fx', { type:'kick', intensity: 0.85 });
    }

    if (S.laserActive && tnow < (S.laserFireAt||0)){
      if (tnow >= (S.laserTickNextAt||0)){
        const left = (S.laserFireAt||0) - tnow;
        const fast = (left < 220);
        tick('laser-warn', fast ? 2.0 : 1.2);
        if (fast) setPanic(1.0, 220);
        S.laserTickNextAt = tnow + Math.max(40, (S.laserTickRateMs||90) - (fast ? 20 : 0));
      }
    }

    if (S.laserActive && tnow >= (S.laserFireAt||0) && tnow <= (S.laserFireAt||0) + 80){
      safeDispatch('hha:fx', { type:'kick', intensity: 1.55 });
      safeDispatch('hha:fx', { type:'chroma', ms: 150 });
    }
  }

  function finalSprintTick(){
    if ((S.timeLeft|0) > 8) return;

    const lv = clamp((8 - (S.timeLeft|0)) / 8, 0, 1);
    setPanic(0.35 + lv*0.65, 650);
    if ((S.timeLeft|0) <= 5) tick('final', 1.7);

    const sec = S.timeLeft|0;
    if (S.lastFinalPulseSec !== sec){
      S.lastFinalPulseSec = sec;
      triggerFinalPulse(sec);
      spawnTarget('junk');
      if (sec <= 5) spawnTarget('fake');
    }
  }

  // ---- Init ----
  emitScore();
  emitTime();
  emitFever();
  syncQuestState();
  qDir.start(qState);

  // ✅ push HUD ทันที
  try{ qDir.tick(qState); }catch(_){}
  publishQuestUpdate('start');

  logSession('start', { startedIso });

  function loop(){
    if (!S.running) return;

    const tnow = now();
    const remainMs = Math.max(0, S.endAt - tnow);
    const remainSec = Math.ceil(remainMs / 1000);

    if (remainSec !== (S.timeLeft|0)){
      S.timeLeft = remainSec|0;
      emitTime();
      finalSprintTick();
      tickQuestNow('time');
    }
    if (remainMs <= 0){
      endGame();
      return;
    }

    if (!S.stunActive){
      const decay = S.feverDecayPerSec / 60;
      S.fever = Math.max(0, (S.fever||0) - decay);
    }

    if (S.stunActive && tnow >= S.stunEndsAt){
      stopStun();
    }

    if (S.finalLock && tnow >= S.finalLockEndsAt){
      S.finalLock = false;
    }

    maybeSpawnBoss();

    if (S.bossAlive && S.bossPhase === 2){
      if (!S.pulseActive && tnow >= (S.pulseNextAt||0)){
        startBossPulse();
        S.pulseNextAt = tnow + 2150;
      }
      if (S.pulseActive && tnow >= S.pulseDeadlineAt){
        resolveBossPulse();
      }

      if (tnow >= (S.bossAtkNextAt||0)){
        bossAttackPattern();
        S.bossAtkNextAt = tnow + (diffKey==='hard' ? 3000 : 3300);
      }
    }

    const stormMul = (S.stormActive ? (S.stormMul||0.62) : 1.0);
    const panicMul = (S.panicLevel > 0 ? (1.0 - 0.18*S.panicLevel) : 1.0);
    const slowMul  = (S.stunActive ? 1.15 : 1.0);
    const spawnGap = Math.round(D.spawnMs * slowMul * stormMul * panicMul);

    if (tnow - S.lastSpawnAt >= spawnGap){
      S.lastSpawnAt = tnow;

      if (S.bossAlive){
        if (S.bossPhase === 2){
          const roll = Math.random();
          if (roll < 0.55) spawnTarget('junk');
          else if (roll < 0.68) spawnTarget('fake');
          else if (roll < 0.80) spawnTarget('good');
          else if (roll < 0.90) spawnTarget('gold');
          else spawnTarget('power');

          if (Math.random() < (diffKey==='hard' ? 0.22 : 0.16)){
            spawnTarget('goodfake');
          }
        } else {
          const roll = Math.random();
          if (roll < 0.48) spawnTarget('junk');
          else if (roll < 0.63) spawnTarget('good');
          else if (roll < 0.76) spawnTarget('fake');
          else if (roll < 0.86) spawnTarget('gold');
          else spawnTarget('power');
        }
      } else {
        spawnWave();
      }
    }

    hazardsTick();
    heroBurstTick();
    magnetTick();
    expireTick();
    stunFieldTick();

    if (S.stormActive && now() >= S.stormEndsAt) clearStorm();
    if ((S.panicEndsAt||0) > 0 && now() >= S.panicEndsAt){
      S.panicLevel = 0;
      safeDispatch('hha:panic', { level: 0, ms: 0 });
      S.panicEndsAt = 0;
    }

    // tick quest + publish to HUD every frame (ชัวร์สุด)
    syncQuestState();
    try{ qDir.tick(qState); }catch(_){}
    publishQuestUpdate('frame');

    if ((Math.random() < 0.06)) emitFever();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  return {
    stop(){ endGame(); },
    shootCrosshair,
    getState(){
      return {
        sessionId,
        score:S.score|0, goodHits:S.goodHits|0, misses:S.misses|0,
        goodExpired:S.goodExpired|0, junkHits:S.junkHits|0,
        comboMax:S.comboMax|0, timeLeft:S.timeLeft|0,
        fever:Math.round(S.fever), stunActive:!!S.stunActive, shield:S.shield|0,
        bossAlive:!!S.bossAlive, bossPhase:S.bossPhase|0, bossHp:S.bossHp|0, bossHpMax:S.bossHpMax|0,
        pulseActive:!!S.pulseActive, heroBurstActive:!!S.heroBurstActive,
        goldHitsThisMini: qState.goldHitsThisMini|0,
        safeNoJunkSeconds: qState.safeNoJunkSeconds|0
      };
    }
  };
}
