// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR (PRODUCTION) — H+ (EXTREME PACK)
// ✅ Quest Director wired (compat) + quest:update shape
// ✅ Miss = missed good (expire) + junk hit (shield block not miss)
// ✅ Grade SSS/SS/S/A/B/C + end summary via hha:end
// ✅ supports safeMargins + VR-parallax layer offset

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
  easy:   { spawnMs: 880, maxActive: 6,  ttlMs: 2100, scale: 1.08, junkRatio: 0.34, goldRatio: 0.08, powerRatio: 0.09, bossHp: 6 },
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

  const S = {
    running: true,
    startedAt: now(),
    endAt: now() + durationSec*1000,

    timeLeft: durationSec,

    score: 0,
    goodHits: 0,
    misses: 0,

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
  };

  // ===== QUEST DIRECTOR (compat) =====
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

  // expose (for director.getActive if needed)
  ROOT.__GJ_QSTATE__ = qState;

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

  window.addEventListener('quest:miniStart', ()=>{
    qState.goldHitsThisMini = 0;
    qState.blocks = 0;
    qState.stunBreaks = 0;
    qState.timePlus = 0;
    qState.safeNoJunkSeconds = 0;
    qState.final8Good = 0;
  }, { passive:true });

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
      bossHpMax: S.bossHpMax|0
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

  function startStun(){
    S.stunActive = true;
    S.slow = 0.62;
    S.stunEndsAt = now() + 6200;
    S.fever = 65;
    setJudge('STUN!');
    setPanic(0.85, 900);
    emitFever();
    try{ Particles.celebrate && Particles.celebrate({ kind:'STUN', intensity:1.2 }); }catch(_){}
  }
  function stopStun(){
    S.stunActive = false;
    S.slow = 1.0;
    S.fever = Math.min(S.fever, 45);
    emitFever();
  }

  function activateMagnet(){
    S.magnetActive = true;
    S.magnetEndsAt = now() + 5200;
    safeDispatch('quest:power', { power:'magnet' });
    setJudge('MAGNET!');
    const ap = getAimPoint();
    burstFX(ap.x, ap.y, 'power');
  }
  function addTime(){
    S.endAt += 3000;
    qState.timePlus = (qState.timePlus|0) + 1;
    safeDispatch('quest:power', { power:'time' });
    setJudge('+TIME!');
    const ap = getAimPoint();
    burstFX(ap.x, ap.y, 'power');
  }
  function addShield(){
    S.shield = clamp((S.shield|0) + 1, 0, 5);
    safeDispatch('quest:power', { power:'shield' });
    setJudge('+SHIELD!');
    emitFever();
  }

  function startHeroBurst(){
    S.heroBurstActive = true;
    S.heroBurstEndsAt = now() + 1500;
    fxHero(240);
    setJudge('HERO BURST!');
    setPanic(0.55, 520);
    try{ Particles.celebrate && Particles.celebrate({ kind:'HERO', intensity:1.2 }); }catch(_){}
  }

  function triggerFinalPulse(secLeft){
    if (S.finalLock) return;
    S.finalLock = true;
    S.finalLockEndsAt = now() + 1000;
    safeDispatch('hha:finalPulse', { secLeft: secLeft|0 });
  }

  function calcGrade(){
    const g = S.goodHits|0;
    const c = S.comboMax|0;
    const m = S.misses|0;
    if (g >= 26 && c >= 16 && m <= 1) return 'SSS';
    if (g >= 24 && c >= 13 && m <= 2) return 'SS';
    if (g >= 22 && c >= 10 && m <= 3) return 'S';
    if (g >= 19 && m <= 5) return 'A';
    if (g >= 15) return 'B';
    return 'C';
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

    const grade = calcGrade();

    safeDispatch('hha:end', {
      score: S.score|0,
      goodHits: S.goodHits|0,
      misses: S.misses|0,
      comboMax: S.comboMax|0,
      durationSec: durationSec|0,
      diff: diffKey,
      challenge,
      runMode,
      grade
    });
  }

  function spawnTarget(kind, posScreen=null){
    if (!S.running) return null;
    if (S.targets.size >= D.maxActive && kind !== 'boss') return null;

    const R = getSafeScreenRect();

    let xs = posScreen ? (posScreen.x|0) : randi(R.left, R.right);
    let ys = posScreen ? (posScreen.y|0) : randi(R.top,  R.bottom);

    xs = clamp(xs, R.left, R.right);
    ys = clamp(ys, R.top,  R.bottom);

    const pL = toLayerPt(xs, ys);
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
      onHit(t);
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

  // ---- boss helpers (kept from your pack; shortened here only where not essential to the asked fixes)
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
    setJudge('BOSS!');
    setPanic(0.65, 650);
    emitScore();
  }
  function bossToPhase2(){
    if (!S.bossAlive || S.bossPhase >= 2) return;
    S.bossPhase = 2;
    setJudge('PHASE 2!');
    setPanic(0.85, 900);
    S.pulseNextAt = now() + 900;
    S.bossAtkNextAt = now() + 900;
    S.bossAtkLast = '';
    emitScore();
  }
  function bossClear(){
    if (!S.bossAlive) return;
    S.bossAlive = false;
    qState.bossCleared = true;

    for (const t of Array.from(S.targets.values())){
      if (t.kind === 'boss'){ killEl(t.el); S.targets.delete(t.id); }
    }
    safeDispatch('quest:bossClear', {});
    setJudge('BOSS CLEARED!');
    setPanic(0.2, 220);
    emitScore();
  }

  function onHit(t){
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

    } else if (t.kind === 'gold'){
      S.goodHits++;
      setCombo(S.combo + 1);
      addFever(12);

      const pts = scoreGain(90, S.combo);
      S.score += pts;

      qState.goldHitsThisMini = 1;
      markGood();

      scorePop(cx, cy, `+${pts}`, 'GOLD!');
      burstFX(cx, cy, 'gold');
      safeDispatch('quest:power', { power:'gold' });
      safeDispatch('quest:goodHit', { kind:'gold' });

      killEl(t.el); S.targets.delete(t.id);

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
      if ((S.bossHp|0) <= 0) bossClear();
      emitScore();

    } else if (isBad){
      markBad();

      if ((S.shield|0) > 0){
        // ✅ Shield block NOT MISS
        S.shield = Math.max(0, (S.shield|0) - 1);
        qState.blocks = (qState.blocks|0) + 1;
        safeDispatch('quest:block', {});
        scorePop(cx, cy, '🛡️', 'BLOCK!');
        burstFX(cx, cy, 'power');
        fxKick(0.65);
        setPanic(0.35, 420);
      } else {
        // ✅ Junk hit = MISS
        S.misses++;
        setCombo(0);
        addFever(-12);
        scorePop(cx, cy, '', 'MISS!');
        burstFX(cx, cy, 'trap');
        safeDispatch('quest:badHit', { kind:t.kind });
        fxKick(1.15); fxChroma(170);
        setPanic(0.85, 850);
      }

      killEl(t.el); S.targets.delete(t.id);
    }

    if (!S.stunActive && (S.fever|0) >= 100){
      startStun();
    }

    emitScore();
    emitFever();
  }

  // ✅ expire = missed good => MISS (สำคัญ!)
  function expireTick(){
    const tnow = now();
    for (const t of Array.from(S.targets.values())){
      if (t.kind === 'boss') continue;
      if (tnow >= t.expiresAt){
        if (t.kind === 'good' || t.kind === 'gold'){
          S.misses++;
          setCombo(Math.max(0, (S.combo|0) - 2));
          safeDispatch('quest:badHit', { kind:'missed-good' });
        }
        killEl(t.el);
        S.targets.delete(t.id);
      }
    }
  }

  function magnetTick(){
    if (!S.magnetActive) return;
    const tnow = now();
    if (tnow >= S.magnetEndsAt){
      S.magnetActive = false;
      return;
    }
    const ap = getAimPoint();
    const apL = toLayerPt(ap.x, ap.y);
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

  function heroBurstTick(){
    if (!S.heroBurstActive) return;
    const tnow = now();
    if (tnow >= S.heroBurstEndsAt){
      S.heroBurstActive = false;
      return;
    }
    const ap = getAimPoint();
    const apL = toLayerPt(ap.x, ap.y);
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

  function finalSprintTick(){
    if ((S.timeLeft|0) > 8) return;

    const sec = S.timeLeft|0;
    const lv = clamp((8 - sec) / 8, 0, 1);
    setPanic(0.35 + lv*0.65, 650);
    if (sec <= 5) tick('final', 1.7);

    if (S.lastFinalPulseSec !== sec){
      S.lastFinalPulseSec = sec;
      triggerFinalPulse(sec);
      spawnTarget('junk');
      if (sec <= 5) spawnTarget('fake');
    }
  }

  function syncQuestState(){
    qState.score = S.score|0;
    qState.goodHits = S.goodHits|0;
    qState.miss = S.misses|0;
    qState.comboMax = S.comboMax|0;
    qState.timeLeft = S.timeLeft|0;
    qState.safeNoJunkSeconds = Math.max(0, Math.floor((now() - lastBadAt) / 1000));
  }

  // init
  emitScore();
  emitTime();
  emitFever();
  syncQuestState();
  qDir.start(qState);

  function loop(){
    if (!S.running) return;

    const tnow = now();
    const remainMs = Math.max(0, S.endAt - tnow);
    const remainSec = Math.ceil(remainMs / 1000);

    if (remainSec !== (S.timeLeft|0)){
      S.timeLeft = remainSec|0;
      emitTime();
      finalSprintTick();
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

    const spawnGap = Math.round(D.spawnMs * (S.stunActive ? 1.15 : 1.0) * (S.stormActive ? (S.stormMul||0.62) : 1.0) * (S.panicLevel > 0 ? (1.0 - 0.18*S.panicLevel) : 1.0));

    if (tnow - S.lastSpawnAt >= spawnGap){
      S.lastSpawnAt = tnow;
      if (S.bossAlive){
        const roll = Math.random();
        if (roll < 0.52) spawnTarget('junk');
        else if (roll < 0.66) spawnTarget('fake');
        else if (roll < 0.80) spawnTarget('good');
        else if (roll < 0.90) spawnTarget('gold');
        else spawnTarget('power');
        if (Math.random() < (diffKey==='hard' ? 0.22 : 0.16)) spawnTarget('goodfake');
      } else {
        spawnWave();
      }
    }

    heroBurstTick();
    magnetTick();
    expireTick();

    if (S.stormActive && now() >= S.stormEndsAt) clearStorm();
    if ((S.panicEndsAt||0) > 0 && now() >= S.panicEndsAt){
      S.panicLevel = 0;
      safeDispatch('hha:panic', { level: 0, ms: 0 });
      S.panicEndsAt = 0;
    }

    syncQuestState();
    qDir.tick(qState);

    if ((Math.random() < 0.06)) emitFever();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  return {
    stop(){ endGame(); },
    getState(){
      return {
        score:S.score|0, goodHits:S.goodHits|0, misses:S.misses|0,
        comboMax:S.comboMax|0, timeLeft:S.timeLeft|0,
        fever:Math.round(S.fever), stunActive:!!S.stunActive, shield:S.shield|0,
        bossAlive:!!S.bossAlive, bossPhase:S.bossPhase|0, bossHp:S.bossHp|0, bossHpMax:S.bossHpMax|0,
        heroBurstActive:!!S.heroBurstActive
      };
    }
  };
}