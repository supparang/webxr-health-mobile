// === VR Fitness — Shadow Breaker (Production v1 + Pack2 AI Director + Predict + Pack3 Patterns) ===
// ✅ HeroHealth-like: hha:shoot support (crosshair/tap-to-shoot via vr-ui.js)
// ✅ HHA events: hha:start / hha:time / hha:score / hha:end / hha:flush
// ✅ Pack1: Seeded RNG (deterministic in research) + telemetry events + flush-hardened
// ✅ Pack2: AI Difficulty Director (play only) + AI Predict micro-tips (rate-limited)
// ✅ Pack3: Seeded Pattern Generator (wave/storm/drift/decoy) + Boss Phases
// ✅ Boss HUD bar + safe spawn + feedback fixed

(function(){
'use strict';

// ---------------- identity ----------------
const SB_GAME_ID = 'shadow-breaker';
const SB_GAME_VERSION = '1.0.0-prod-pack3';

const SB_STORAGE_KEY = 'ShadowBreakerSessions_v1';
const SB_META_KEY    = 'ShadowBreakerMeta_v1';
const SB_EVENTS_PREFIX = 'ShadowBreakerEvents_'; // per-session events payload

// ---------------- query params ----------------
function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }
const sbPhase = (qs('phase','train')||'train').toLowerCase();
const sbMode  = (qs('mode','timed')||'timed').toLowerCase();
const sbDiff  = (qs('diff','normal')||'normal').toLowerCase();
const sbTimeSec = (()=>{ const t=parseInt(qs('time','60'),10); return (Number.isFinite(t)&&t>=20&&t<=300)?t:60; })();

const SB_SEED_RAW = (qs('seed','')||'').trim();
const SB_STUDY_ID = (qs('studyId','')||'').trim();
const SB_LOG      = (qs('log','')||'').trim();
const SB_HUB      = (qs('hub','')||'').trim();

const SB_IS_RESEARCH = (()=> {
  const r = (qs('research','')||'').toLowerCase();
  return r==='1' || r==='true' || r==='on' || !!SB_STUDY_ID || !!SB_LOG;
})();

// Pack2 toggle (play only)
const SB_AI_ENABLED = (!SB_IS_RESEARCH) && ((qs('ai','1')||'1') !== '0');

// Pack3 toggle
const SB_PATTERNS_ENABLED = ((qs('patterns','1')||'1') !== '0');

// ---------------- DOM ----------------
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const sbGameArea   = $('#gameArea') || $('#playArea') || $('#sbPlayArea');
const sbFeedbackEl = $('#feedback') || $('#sbFeedback');

const sbStartBtn =
  $('#startBtn') || $('#playBtn') || $('#playButton') || $('#sbStartBtn');

const sbLangButtons = $$('.lang-toggle button');

const sbMetaInputs = {
  studentId:  $('#studentId'),
  schoolName: $('#schoolName'),
  classRoom:  $('#classRoom'),
  groupCode:  $('#groupCode'),
  deviceType: $('#deviceType'),
  note:       $('#note'),
};

const sbHUD = {
  timeVal:   $('#timeVal')   || $('#hudTime'),
  scoreVal:  $('#scoreVal')  || $('#hudScore'),
  hitVal:    $('#hitVal')    || $('#hudHit'),
  missVal:   $('#missVal')   || $('#hudMiss'),
  comboVal:  $('#comboVal')  || $('#hudCombo'),
  coachLine: $('#coachLine') || $('#hudCoach'),
};

const sbOverlay =
  $('#resultOverlay') || $('#resultCard') || $('#resultPanel') || null;

const sbR = {
  score:    $('#rScore')    || $('#resScore'),
  hit:      $('#rHit')      || $('#resHit'),
  perfect:  $('#rPerfect')  || $('#resPerfect'),
  good:     $('#rGood')     || $('#resGood'),
  miss:     $('#rMiss')     || $('#resMiss'),
  acc:      $('#rAcc')      || $('#resAcc'),
  combo:    $('#rCombo')    || $('#resCombo'),
  timeUsed: $('#rTimeUsed') || $('#resTimeUsed'),
};

const sbPlayAgainBtn =
  $('#playAgainBtn') || $('#resPlayAgainBtn') || $('#resReplayBtn');
const sbBackHubBtn =
  $('#backHubBtn') || $('#resBackHubBtn') || $('#resMenuBtn');
const sbDownloadCsvBtn =
  $('#downloadCsvBtn') || $('#resDownloadCsvBtn');

// ---------------- helpers ----------------
function sbEmit(name, detail = {}){ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){} }
function clamp(n,a,b){ n=+n; if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b,n)); }
function lerp(a,b,t){ return a + (b-a)*clamp(t,0,1); }
function sigmoid(z){ return 1/(1+Math.exp(-z)); }

// ---------------- device detect ----------------
function sbDetectDevice() {
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vrHeadset';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'pc';
}

// ---------------- base config ----------------
const sbDiffCfg = {
  easy:   { spawnMs: 900, bossHp: 6 },
  normal: { spawnMs: 700, bossHp: 9 },
  hard:   { spawnMs: 520, bossHp: 12 },
};
const sbCfgBase = sbDiffCfg[sbDiff] || sbDiffCfg.normal;

// runtime cfg (AI may modify in play)
const sbCfg = {
  spawnMs: sbCfgBase.spawnMs,
  bossHp:  sbCfgBase.bossHp,
  lifeMs: 2300,
  bossLifeMs: 6500,
  gapProb: 0.10,
  bossClutterProb: 0.50,

  // Pack3 pattern knobs (soft caps)
  maxOnScreen: 10,
  stormBurst: 6,
  waveBurst: 3,
};

// ---------------- bosses & emojis ----------------
const SB_NORMAL_EMOJIS = ['🎯','💥','⭐','⚡','🔥','🥎','🌀'];
const SB_DECOY_EMOJIS  = ['🧊','🪨','💀','🚫']; // safe decoy (no scary gore; still cartoon-ish)
const SB_BOSSES = [
  { id: 1, emoji:'💧', nameTh:'Bubble Glove',  nameEn:'Bubble Glove',  hpBonus:0 },
  { id: 2, emoji:'⛈️', nameTh:'Storm Knuckle', nameEn:'Storm Knuckle', hpBonus:2 },
  { id: 3, emoji:'🥊', nameTh:'Iron Fist',     nameEn:'Iron Fist',     hpBonus:4 },
  { id: 4, emoji:'🐲', nameTh:'Golden Dragon', nameEn:'Golden Dragon', hpBonus:6 },
];

// ---------------- i18n ----------------
const sbI18n = {
  th: {
    startLabel:'เริ่มเล่น',
    coachReady:'โค้ชพุ่ง: เล็งกลางจอแล้วแตะ/ยิงให้โดน! 👊',
    coachGood:'สวยมาก! ต่อคอมโบยาว ๆ ✨',
    coachMiss:'พลาดนิดเดียว ไม่เป็นไร 💪',
    coachFever:'FEVER!! ทุบให้สุด!! 🔥',
    coachFocus:'โฟกัสกลางจอ ลดรีบ แล้วกดให้เป๊ะ 🎯',
    coachBreathe:'พักหายใจ 1 วิ แล้วกลับมาเก็บคอมโบ 💨',
    coachChallenge:'โหดขึ้นนิดนะ! เก็บคอมโบให้ได้ 🔥',
    coachDecoy:'หลบเป้าหลอก! 🚫',
    coachStorm:'พายุเป้าเข้าแล้ว! ⛈️',
    coachWave:'เข้าชุดคลื่น! เก็บให้ครบ! 🌊',
    tagGoal:'เป้าหมาย: ต่อย/ยิงเป้า emoji ให้ทันเวลา รักษาคอมโบ และพิชิตบอสทั้ง 4 ตัว.',
    alertMeta:'กรุณากรอกอย่างน้อย Student ID ก่อนเริ่มเล่นนะครับ',
    feverLabel:'FEVER!!',
    bossNear:(name)=>`ใกล้ล้ม ${name} แล้ว! เร่งอีกนิด! ⚡`,
    bossClear:(name)=>`พิชิต ${name} แล้ว! บอสถัดไปมา! 🔥`,
    bossAppear:(name)=>`${name} ปรากฏตัวแล้ว!`,
    bossPhase2:(name)=>`${name} เข้าสู่เฟส 2! ⚡`,
  },
  en: {
    startLabel:'Start',
    coachReady:'Aim center and tap/shoot targets! 👊',
    coachGood:'Nice! Keep the combo! ✨',
    coachMiss:'Missed a bit. Try again! 💪',
    coachFever:'FEVER!! Smash!! 🔥',
    coachFocus:'Focus center, slow down, be precise 🎯',
    coachBreathe:'Breathe 1 sec, then rebuild combo 💨',
    coachChallenge:'A bit harder now—keep that combo 🔥',
    coachDecoy:'Avoid decoys! 🚫',
    coachStorm:'Target storm incoming! ⛈️',
    coachWave:'Wave set! Clear them! 🌊',
    tagGoal:'Goal: hit emoji targets quickly, keep combo, defeat all bosses.',
    alertMeta:'Please fill at least the Student ID before starting.',
    feverLabel:'FEVER!!',
    bossNear:(name)=>`Almost defeat ${name}! Finish it! ⚡`,
    bossClear:(name)=>`You beat ${name}! Next boss! 🔥`,
    bossAppear:(name)=>`${name} appeared!`,
    bossPhase2:(name)=>`${name} entered Phase 2! ⚡`,
  }
};
let sbLang = 'th';

// ---------------- Pack1: Seeded RNG ----------------
function fnv1a32(str){
  let h = 0x811c9dc5;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function parseSeedToU32(seedStr){
  const s = (seedStr||'').trim();
  if(!s) return 0;
  if(/^\d+$/.test(s)){
    const n = Number(s);
    if(Number.isFinite(n)) return (n >>> 0);
  }
  return fnv1a32(s);
}
function makeXorShift32(seedU32){
  let x = (seedU32 >>> 0) || 0x9e3779b9;
  return {
    u32(){
      x ^= (x << 13); x >>>= 0;
      x ^= (x >>> 17); x >>>= 0;
      x ^= (x << 5);  x >>>= 0;
      return x >>> 0;
    },
    float(){ return (this.u32() / 4294967296); }
  };
}
let SB_SEED_U32 = parseSeedToU32(SB_SEED_RAW);
let sbRng = null;
let sbRand = Math.random;

function sbResolveResearchSeed(metaStudentId=''){
  if (SB_SEED_U32) return SB_SEED_U32;
  const sid = (metaStudentId||'').trim();
  const key = ['SB', SB_STUDY_ID||'nostudy', sid||'nosid', sbPhase, sbMode, sbDiff, String(sbTimeSec)].join('|');
  return fnv1a32(key);
}
function sbInitRng(seedU32){
  sbRng = makeXorShift32(seedU32 >>> 0);
  sbRand = ()=> sbRng.float();
}
function sbRandInt(maxExclusive){
  const m = Math.max(1, (Number(maxExclusive)||1));
  return Math.floor(sbRand() * m);
}

// ---------------- Pack1: Telemetry events ----------------
const SB_EVENTS_MAX = 2500;
let sbEvents = [];

function sbNowElapsedMs(){ return Math.max(0, Math.round(sbState.elapsedMs || 0)); }
function sbLogEvent(type, data = {}){
  try{
    if(sbEvents.length >= SB_EVENTS_MAX) return;
    const e = Object.assign({ t: sbNowElapsedMs(), type: String(type||'evt') }, data || {});
    sbEvents.push(e);
  }catch(_){}
}
function sbPersistEvents(sessionId){
  try{
    if(!sessionId) return;
    const key = SB_EVENTS_PREFIX + sessionId;
    localStorage.setItem(key, JSON.stringify(sbEvents));
  }catch(_){}
}
function sbFlushSnapshot(reason){
  try{
    const snap = {
      reason: String(reason||'flush'),
      gameId: SB_GAME_ID,
      gameVersion: SB_GAME_VERSION,
      sessionId: sbState.sessionId || '',
      running: sbState.running ? 1 : 0,
      paused: sbState.paused ? 1 : 0,
      elapsedMs: Math.round(sbState.elapsedMs||0),
      score: sbState.score,
      hit: sbState.hit,
      miss: sbState.miss,
      combo: sbState.combo,
      maxCombo: sbState.maxCombo,
      fever: sbState.fever ? 1 : 0,
      bossActive: sbState.bossActive ? 1 : 0,
      seedU32: SB_SEED_U32 >>> 0,
      research: SB_IS_RESEARCH ? 1 : 0,
      ai: SB_AI_ENABLED ? 1 : 0,
      aiLevel: Number(sbAI.level||0).toFixed(3),
      patterns: SB_PATTERNS_ENABLED ? 1 : 0,
      phase: sbPhase, mode: sbMode, diff: sbDiff,
      timeSec: (sbMode==='endless') ? 0 : sbTimeSec,
      ts: new Date().toISOString(),
    };
    sbLogEvent('flush', { reason: snap.reason });
    sbEmit('hha:flush', snap);
    sbPersistEvents(sbState.sessionId);
  }catch(_){}
}

// ---------------- state ----------------
const sbState = {
  running:false,
  paused:false,
  startTime:0,
  pauseAt:0,
  elapsedMs:0,
  durationMs: sbMode==='endless' ? Infinity : sbTimeSec*1000,
  spawnTimer:null,
  targets:[],
  score:0,
  hit:0,
  perfect:0,
  good:0,
  miss:0,
  combo:0,
  maxCombo:0,
  fever:false,
  feverUntil:0,

  sessionMeta:null,
  sessionId:'',

  bossQueue:[],
  bossActive:false,
  bossWarned:false,
  activeBoss:null,
  activeBossInfo:null,
};

// ---------------- Pack2: AI Difficulty Director + Predict ----------------
const sbAI = {
  enabled: SB_AI_ENABLED ? 1 : 0,
  level: (sbDiff==='easy') ? 0.25 : (sbDiff==='hard') ? 0.75 : 0.50,
  emaAcc: 0.60,
  emaRT:  900,
  missStreak: 0,
  hitStreak: 0,
  lastTipAt: 0,
  lastAdjustAt: 0,
  adjustEveryMs: 2600,
};

function sbAIUpdateOnOutcome(outcome, rtMs){
  if(!SB_AI_ENABLED) return;

  const alpha = 0.18;
  const ok = (outcome === 'hit');
  const acc01 = ok ? 1 : 0;

  sbAI.emaAcc = (1-alpha)*sbAI.emaAcc + alpha*acc01;

  if(Number.isFinite(rtMs) && rtMs>0 && rtMs<6000){
    const a2 = 0.14;
    sbAI.emaRT = (1-a2)*sbAI.emaRT + a2*rtMs;
  }

  if(ok){
    sbAI.hitStreak++;
    sbAI.missStreak = 0;
  }else{
    sbAI.missStreak++;
    sbAI.hitStreak = 0;
  }

  sbLogEvent('ai_metrics', {
    emaAcc: +sbAI.emaAcc.toFixed(3),
    emaRT: Math.round(sbAI.emaRT),
    missStreak: sbAI.missStreak,
    hitStreak: sbAI.hitStreak,
    level: +sbAI.level.toFixed(3)
  });
}

function sbAIPredictAndTip(){
  if(!SB_AI_ENABLED) return;
  const now = performance.now();
  if(now - sbAI.lastTipAt < 8000) return;

  const acc = sbAI.emaAcc;
  const rtN = (sbAI.emaRT - 900) / 400;
  const ms  = clamp(sbAI.missStreak, 0, 5);
  const lvl = sbAI.level;

  const z =
    (+1.10*(ms>=2 ? 1:0)) +
    (+0.85*rtN) +
    (+0.60*(lvl-0.5)) +
    (-2.10*(acc-0.6));

  const pOverload = sigmoid(z);

  if(pOverload > 0.72){
    sbAI.lastTipAt = now;
    const t = sbI18n[sbLang];
    const tip = (sbAI.missStreak >= 3) ? t.coachBreathe : t.coachFocus;
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = tip;
    sbEmit('hha:coach', { text: tip, ai:true, pOverload:+pOverload.toFixed(3) });
    sbLogEvent('ai_tip', { kind:'support', p:+pOverload.toFixed(3) });
  }else if(pOverload < 0.28 && sbState.combo >= 3){
    sbAI.lastTipAt = now;
    const t = sbI18n[sbLang];
    const tip = t.coachChallenge;
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = tip;
    sbEmit('hha:coach', { text: tip, ai:true, pOverload:+pOverload.toFixed(3) });
    sbLogEvent('ai_tip', { kind:'challenge', p:+pOverload.toFixed(3) });
  }
}

function sbAIAdjustDifficulty(){
  if(!SB_AI_ENABLED || !sbState.running || sbState.paused) return;

  const now = performance.now();
  if(now - sbAI.lastAdjustAt < sbAI.adjustEveryMs) return;
  sbAI.lastAdjustAt = now;

  const acc = sbAI.emaAcc;
  const rt  = sbAI.emaRT;
  const ms  = sbAI.missStreak;

  let delta = 0;

  if(ms >= 3) delta -= 0.12;
  else if(ms === 2) delta -= 0.07;

  if(acc > 0.78 && rt < 780) delta += 0.08;
  else if(acc > 0.70 && rt < 900) delta += 0.05;

  if(acc < 0.45) delta -= 0.06;
  if(rt > 1200)  delta -= 0.05;

  delta = clamp(delta, -0.12, 0.10);
  sbAI.level = clamp(sbAI.level + delta, 0.12, 0.92);

  const baseSpawn = sbCfgBase.spawnMs;
  sbCfg.spawnMs = Math.round(clamp(lerp(baseSpawn*1.25, baseSpawn*0.75, sbAI.level), 360, 1100));
  sbCfg.lifeMs  = Math.round(clamp(lerp(2600, 1700, sbAI.level), 1400, 2900));
  sbCfg.bossLifeMs = Math.round(clamp(lerp(7200, 5200, sbAI.level), 4200, 9000));

  const baseBoss = sbCfgBase.bossHp;
  const bossAdj = Math.round(lerp(-1, +3, sbAI.level));
  sbCfg.bossHp = clamp(baseBoss + bossAdj, 4, 18);

  sbCfg.gapProb = clamp(lerp(0.18, 0.06, sbAI.level), 0.04, 0.22);
  sbCfg.bossClutterProb = clamp(lerp(0.35, 0.62, sbAI.level), 0.25, 0.75);

  sbRestartSpawnLoop();

  sbLogEvent('ai_adjust', {
    level:+sbAI.level.toFixed(3),
    spawnMs: sbCfg.spawnMs,
    lifeMs: sbCfg.lifeMs,
    bossHp: sbCfg.bossHp,
    bossLifeMs: sbCfg.bossLifeMs,
    gapProb:+sbCfg.gapProb.toFixed(3),
    bossClutterProb:+sbCfg.bossClutterProb.toFixed(3),
    delta:+delta.toFixed(3),
    emaAcc:+acc.toFixed(3),
    emaRT:Math.round(rt),
    missStreak:ms
  });
}

// ---------------- Pack3: Pattern Generator ----------------
const sbPattern = {
  enabled: SB_PATTERNS_ENABLED ? 1 : 0,
  nextAtMs: 0,
  active: null,       // {kind, untilMs, ...}
  lastKind: '',
  coolMs: 6000,       // min spacing between patterns
  baseEveryMs: 9000,  // typical cadence
  stormActive: 0,
};

function sbCountAliveTargets(){
  let n = 0;
  for(const t of sbState.targets){
    if(t && t.alive && t.el) n++;
  }
  return n;
}

function sbStartPattern(kind, durMs){
  const nowMs = sbNowElapsedMs();
  sbPattern.active = {
    kind,
    startedAtMs: nowMs,
    untilMs: nowMs + Math.max(1500, durMs || 3500),
    pulses: 0,
  };
  sbPattern.lastKind = kind;

  const t = sbI18n[sbLang];
  if(kind === 'storm'){
    sbEmit('hha:coach', { text: t.coachStorm, pattern: 'storm' });
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachStorm;
  } else if(kind === 'wave'){
    sbEmit('hha:coach', { text: t.coachWave, pattern: 'wave' });
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachWave;
  } else if(kind === 'decoy'){
    sbEmit('hha:coach', { text: t.coachDecoy, pattern: 'decoy' });
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachDecoy;
  }

  sbLogEvent('pattern_start', { kind, untilMs: sbPattern.active.untilMs });
}

function sbPickPatternKind(){
  // deterministic via sbRand; avoid repeating same kind
  const pool = ['wave','storm','drift','decoy','burst'];
  let kind = pool[sbRandInt(pool.length)];
  if(kind === sbPattern.lastKind){
    kind = pool[(sbRandInt(pool.length-1) + 1) % pool.length];
  }

  // bias by state:
  if(sbState.bossActive) {
    // during boss: prefer drift (adds pressure) or burst (less clutter)
    kind = (sbRand() < 0.55) ? 'drift' : 'burst';
  } else if(sbAI.enabled && !SB_IS_RESEARCH) {
    // if player is strong, more storm; if struggling, wave/burst
    if(sbAI.emaAcc > 0.72 && sbAI.emaRT < 900 && sbRand() < 0.55) kind = 'storm';
    if(sbAI.missStreak >= 2 && sbRand() < 0.60) kind = 'wave';
  }
  return kind;
}

function sbScheduleNextPattern(){
  const nowMs = sbNowElapsedMs();
  const jitter = Math.round(lerp(-1200, 1400, sbRand()));
  const every = sbPattern.baseEveryMs + jitter;
  sbPattern.nextAtMs = nowMs + Math.max(sbPattern.coolMs, every);
  sbLogEvent('pattern_next', { atMs: sbPattern.nextAtMs });
}

function sbTickPattern(){
  if(!sbPattern.enabled || !sbState.running || sbState.paused) return;

  const nowMs = sbNowElapsedMs();

  // end active?
  if(sbPattern.active && nowMs >= sbPattern.active.untilMs){
    sbLogEvent('pattern_end', { kind: sbPattern.active.kind });
    sbPattern.active = null;
    sbScheduleNextPattern();
    return;
  }

  // start new?
  if(!sbPattern.active && nowMs >= sbPattern.nextAtMs){
    const kind = sbPickPatternKind();
    const dur = (kind === 'storm') ? 3800 :
                (kind === 'wave')  ? 3200 :
                (kind === 'drift') ? 5200 :
                (kind === 'decoy') ? 3600 : 2400;
    sbStartPattern(kind, dur);
    return;
  }

  // execute active pattern pulses
  if(!sbPattern.active) return;

  const kind = sbPattern.active.kind;

  // throttle if too many targets
  if(sbCountAliveTargets() >= sbCfg.maxOnScreen) return;

  // pulse every ~450ms (storm) or ~800ms (wave) or ~600ms (burst/decoy/drift)
  const elapsed = nowMs - sbPattern.active.startedAtMs;
  const pulseEvery =
    (kind === 'storm') ? 420 :
    (kind === 'wave')  ? 760 :
    (kind === 'drift') ? 620 :
    (kind === 'decoy') ? 700 : 560;

  const shouldPulse = (elapsed >= (sbPattern.active.pulses * pulseEvery));
  if(!shouldPulse) return;

  sbPattern.active.pulses++;

  if(kind === 'storm'){
    // spawn many quick small targets (life shorter via temporary)
    const count = Math.max(3, Math.min(sbCfg.stormBurst, 7));
    for(let i=0;i<count;i++){
      sbSpawnTarget(false, null, { lifeMsOverride: Math.round(sbCfg.lifeMs*0.78), sizeOverride: 48 });
    }
    sbLogEvent('pattern_pulse', { kind, n: count });
    return;
  }

  if(kind === 'wave'){
    // wave: 3 targets spaced (clear set feel)
    const count = Math.max(2, Math.min(sbCfg.waveBurst, 4));
    for(let i=0;i<count;i++){
      sbSpawnTarget(false, null, { lifeMsOverride: Math.round(sbCfg.lifeMs*1.05) });
    }
    sbLogEvent('pattern_pulse', { kind, n: count });
    return;
  }

  if(kind === 'burst'){
    // burst: 1-2 fast targets
    const count = (sbRand() < 0.35) ? 2 : 1;
    for(let i=0;i<count;i++){
      sbSpawnTarget(false, null, { lifeMsOverride: Math.round(sbCfg.lifeMs*0.85) });
    }
    sbLogEvent('pattern_pulse', { kind, n: count });
    return;
  }

  if(kind === 'decoy'){
    // decoy: spawn 1 decoy occasionally mixed with normal
    const n = (sbRand() < 0.45) ? 2 : 1;
    for(let i=0;i<n;i++){
      const isDecoy = (i===0) && (sbRand() < 0.72);
      if(isDecoy) sbSpawnTarget(false, null, { decoy:true, lifeMsOverride: Math.round(sbCfg.lifeMs*1.15) });
      else sbSpawnTarget(false, null, { lifeMsOverride: Math.round(sbCfg.lifeMs*0.95) });
    }
    sbLogEvent('pattern_pulse', { kind, n });
    return;
  }

  if(kind === 'drift'){
    // drift: spawn moving targets
    const n = (sbRand() < 0.45) ? 2 : 1;
    for(let i=0;i<n;i++){
      sbSpawnTarget(false, null, { drift:true, lifeMsOverride: Math.round(sbCfg.lifeMs*0.95) });
    }
    sbLogEvent('pattern_pulse', { kind, n });
    return;
  }
}

// ---------------- meta persistence ----------------
function sbLoadMeta(){
  try{
    const raw = localStorage.getItem(SB_META_KEY);
    if(!raw) return;
    const meta = JSON.parse(raw);
    Object.entries(sbMetaInputs).forEach(([k,el])=>{
      if(el && meta[k]) el.value = meta[k];
    });
  }catch(_){}
}
function sbSaveMetaDraft(){
  const meta = {};
  Object.entries(sbMetaInputs).forEach(([k,el])=>{
    meta[k] = el ? el.value.trim() : '';
  });
  try{ localStorage.setItem(SB_META_KEY, JSON.stringify(meta)); }catch(_){}
}

// ---------------- i18n apply ----------------
function sbApplyLang(){
  const t = sbI18n[sbLang];
  const sl = $('#startLabel'); if(sl) sl.textContent = t.startLabel;
  const tg = $('#tagGoal'); if(tg) tg.textContent = t.tagGoal;
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;
}
sbLangButtons.forEach(btn=>{
  btn.addEventListener('click',()=>{
    sbLangButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    sbLang = btn.dataset.lang || 'th';
    sbApplyLang();
    sbLogEvent('lang', { lang: sbLang });
  });
});

// ---------------- feedback ----------------
function sbShowFeedback(type){
  if(!sbFeedbackEl) return;
  const t = sbI18n[sbLang];
  let txt='';
  if(type==='fever') txt = t.feverLabel;
  else if(type==='perfect') txt = (sbLang==='th'?'Perfect! 💥':'PERFECT!');
  else if(type==='good') txt = (sbLang==='th'?'ดีมาก! ✨':'GOOD!');
  else if(type==='decoy') txt = (sbLang==='th'?'เป้าหลอก! 🚫':'DECOY!');
  else txt = (sbLang==='th'?'พลาด!':'MISS');

  sbFeedbackEl.textContent = txt;
  sbFeedbackEl.className = 'feedback ' + type;
  sbFeedbackEl.style.display = 'block';
  sbFeedbackEl.classList.add('show');

  setTimeout(()=>{
    if(!sbFeedbackEl) return;
    sbFeedbackEl.classList.remove('show');
    setTimeout(()=>{ if(sbFeedbackEl) sbFeedbackEl.style.display='none'; }, 120);
  }, type==='fever'?800:420);
}

// ---------------- reset/hud ----------------
function sbResetStats(){
  sbState.score=0; sbState.hit=0; sbState.perfect=0; sbState.good=0; sbState.miss=0;
  sbState.combo=0; sbState.maxCombo=0;
  sbState.elapsedMs=0;
  sbState.fever=false; sbState.feverUntil=0;

  sbState.targets=[];
  sbState.bossQueue=[]; sbState.bossActive=false; sbState.bossWarned=false;
  sbState.activeBoss=null; sbState.activeBossInfo=null;

  sbEvents = [];
  sbLogEvent('reset', {});

  // reset AI (play only)
  sbAI.missStreak = 0;
  sbAI.hitStreak = 0;
  sbAI.emaAcc = 0.60;
  sbAI.emaRT  = 900;
  sbAI.lastTipAt = 0;
  sbAI.lastAdjustAt = 0;

  // reset patterns
  sbPattern.active = null;
  sbPattern.lastKind = '';
  sbPattern.nextAtMs = 2400;
  sbLogEvent('pattern_init', { enabled: sbPattern.enabled ? 1 : 0 });

  // restore cfg base at reset
  sbCfg.spawnMs = sbCfgBase.spawnMs;
  sbCfg.bossHp  = sbCfgBase.bossHp;
  sbCfg.lifeMs  = 2300;
  sbCfg.bossLifeMs = 6500;
  sbCfg.gapProb = 0.10;
  sbCfg.bossClutterProb = 0.50;

  if(sbHUD.scoreVal) sbHUD.scoreVal.textContent='0';
  if(sbHUD.hitVal) sbHUD.hitVal.textContent='0';
  if(sbHUD.missVal) sbHUD.missVal.textContent='0';
  if(sbHUD.comboVal) sbHUD.comboVal.textContent='x0';
  if(sbHUD.timeVal) sbHUD.timeVal.textContent = (sbMode==='endless'?'∞':String(sbTimeSec));

  if(sbGameArea){
    sbGameArea.querySelectorAll('.sb-target,.boss-barbox').forEach(el=>el.remove());
    sbGameArea.classList.remove('fever');
  }
}

function sbUpdateHUD(){
  if(sbHUD.scoreVal) sbHUD.scoreVal.textContent=String(sbState.score);
  if(sbHUD.hitVal) sbHUD.hitVal.textContent=String(sbState.hit);
  if(sbHUD.missVal) sbHUD.missVal.textContent=String(sbState.miss);
  if(sbHUD.comboVal) sbHUD.comboVal.textContent='x'+sbState.combo;
}

// ---------------- Boss HUD ----------------
let sbBossHud = null;
function sbEnsureBossHud(){
  if(!sbGameArea) return null;
  if(sbBossHud) return sbBossHud;
  const box = document.createElement('div');
  box.className = 'boss-barbox';
  box.innerHTML = `
    <div class="boss-face" id="sbBossFace">🐲</div>
    <div>
      <div class="boss-name" id="sbBossName">Boss</div>
      <div class="boss-bar"><div class="boss-bar-fill" id="sbBossFill"></div></div>
    </div>
  `;
  sbGameArea.appendChild(box);
  sbBossHud = {
    box,
    face: box.querySelector('#sbBossFace'),
    name: box.querySelector('#sbBossName'),
    fill: box.querySelector('#sbBossFill')
  };
  return sbBossHud;
}
function sbSetBossHudVisible(v){
  const hud = sbEnsureBossHud();
  if(!hud) return;
  hud.box.style.display = v ? 'flex' : 'none';
}
function sbUpdateBossHud(){
  const hud = sbEnsureBossHud();
  if(!hud || !sbState.activeBoss || !sbState.activeBossInfo) return;
  const info = sbState.activeBossInfo;
  hud.face.textContent = info.emoji;
  hud.name.textContent = (sbLang==='th'?info.nameTh:info.nameEn);
  const curHp = clamp(sbState.activeBoss.hp, 0, sbState.activeBoss.maxHp);
  const ratio = sbState.activeBoss.maxHp > 0 ? (curHp / sbState.activeBoss.maxHp) : 0;
  hud.fill.style.transform = `scaleX(${ratio})`;
}

// ---------------- Boss queue ----------------
function sbPrepareBossQueue(){
  const ms = (sbMode==='endless') ? 120000 : sbTimeSec*1000;
  const checkpoints = [0.15,0.35,0.6,0.85].map(r=>Math.round(ms*r));
  sbState.bossQueue = SB_BOSSES.map((b,idx)=>({ bossIndex: idx, spawnAtMs: checkpoints[idx] || Math.round(ms*(0.2+idx*0.15)) }));
  sbLogEvent('bossQueue', { n: sbState.bossQueue.length, ms });
}

// ---------------- spawn safe-area ----------------
let sbTargetIdCounter = 1;

function sbPickSpawnXY(sizePx){
  if(!sbGameArea) return { x:20, y:20 };

  const rect = sbGameArea.getBoundingClientRect();
  const pad = 18;
  const safeTop = 56;

  const maxX = Math.max(0, rect.width - sizePx - pad*2);
  const maxY = Math.max(0, rect.height - sizePx - pad*2 - safeTop);

  const x = pad + sbRand()*maxX;
  const y = pad + safeTop + sbRand()*maxY;
  return { x, y };
}

// ---------------- fever ----------------
function sbEnterFever(){
  sbState.fever=true;
  sbState.feverUntil = performance.now() + 3500;
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachFever;
  if(sbGameArea) sbGameArea.classList.add('fever');
  sbShowFeedback('fever');
  sbEmit('hha:coach', { text: sbI18n[sbLang].coachFever, fever:true });
  sbLogEvent('fever_on', {});
}
function sbCheckFeverTick(now){
  if(sbState.fever && now >= sbState.feverUntil){
    sbState.fever=false;
    if(sbGameArea) sbGameArea.classList.remove('fever');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachReady;
    sbLogEvent('fever_off', {});
  }
}

// ---------------- spawn target ----------------
// opts: {lifeMsOverride,sizeOverride,drift,decoy}
function sbSpawnTarget(isBoss=false, bossInfo=null, opts=null){
  if(!sbGameArea) return;
  opts = opts || {};

  const sizeBase = isBoss ? 90 : (opts.sizeOverride || 56);
  const baseHp = isBoss ? (sbCfg.bossHp + (bossInfo?.hpBonus||0)) : 1;

  const isDecoy = (!isBoss) && !!opts.decoy;

  const tObj = {
    id: sbTargetIdCounter++,
    boss: !!isBoss,
    decoy: isDecoy,
    drift: (!isBoss) && !!opts.drift,
    bossInfo: bossInfo || null,
    hp: baseHp,
    maxHp: baseHp,
    createdAt: performance.now(),
    el: null,
    alive: true,
    missTimer: null,

    // drift motion
    vx: 0, vy: 0,
    x: 0, y: 0,
    size: sizeBase
  };

  const el = document.createElement('div');
  el.className = 'sb-target';
  el.dataset.id = String(tObj.id);
  el.style.width = sizeBase + 'px';
  el.style.height = sizeBase + 'px';
  el.style.display='flex';
  el.style.alignItems='center';
  el.style.justifyContent='center';
  el.style.fontSize = isBoss ? '2.1rem' : (sizeBase >= 56 ? '1.7rem' : '1.5rem');
  el.style.cursor='pointer';
  el.style.borderRadius='999px';
  el.style.willChange = 'transform,left,top';

  if(isBoss && bossInfo){
    el.style.background = 'radial-gradient(circle at 30% 20%, #facc15, #ea580c)';
    el.textContent = bossInfo.emoji;
  }else if(isDecoy){
    const emo = SB_DECOY_EMOJIS[sbRandInt(SB_DECOY_EMOJIS.length)];
    el.style.background = 'radial-gradient(circle at 30% 20%, #94a3b8, #334155)';
    el.textContent = emo;
  }else{
    const emo = SB_NORMAL_EMOJIS[sbRandInt(SB_NORMAL_EMOJIS.length)];
    el.style.background = sbState.fever
      ? 'radial-gradient(circle at 30% 20%, #facc15, #eab308)'
      : 'radial-gradient(circle at 30% 20%, #38bdf8, #0ea5e9)';
    el.textContent = emo;
  }

  const pos = sbPickSpawnXY(sizeBase);
  tObj.x = pos.x; tObj.y = pos.y;

  el.style.left = pos.x + 'px';
  el.style.top  = pos.y + 'px';

  if(tObj.drift){
    // drift speed deterministic
    const speed = lerp(28, 60, SB_AI_ENABLED ? sbAI.level : 0.5); // px/sec
    const ang = sbRand() * Math.PI * 2;
    tObj.vx = Math.cos(ang) * speed;
    tObj.vy = Math.sin(ang) * speed;
    el.style.outline = '2px solid rgba(34,211,238,.25)';
  }

  el.addEventListener('click', ()=>sbHitTarget(tObj, 'click'));

  sbGameArea.appendChild(el);
  tObj.el = el;
  sbState.targets.push(tObj);

  sbLogEvent('spawn', {
    id: tObj.id,
    boss: tObj.boss ? 1 : 0,
    decoy: tObj.decoy ? 1 : 0,
    drift: tObj.drift ? 1 : 0,
    hp: tObj.hp,
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    emoji: (bossInfo && bossInfo.emoji) ? bossInfo.emoji : (el.textContent || '')
  });

  if(isBoss && bossInfo){
    sbState.bossActive = true;
    sbState.bossWarned = false;
    sbState.activeBoss = tObj;
    sbState.activeBossInfo = bossInfo;

    sbSetBossHudVisible(true);
    sbUpdateBossHud();

    const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
    sbEmit('hha:coach', { text: sbI18n[sbLang].bossAppear(name), boss: bossInfo.id });
    sbLogEvent('boss_start', { bossId: bossInfo.id, name });
  }

  const lifeMs = isBoss ? (opts.lifeMsOverride || sbCfg.bossLifeMs) : (opts.lifeMsOverride || sbCfg.lifeMs);

  tObj.missTimer = setTimeout(()=>{
    if(!tObj.alive) return;
    tObj.alive=false;
    if(tObj.el && tObj.el.parentNode) tObj.el.parentNode.removeChild(tObj.el);

    sbState.miss++;
    sbState.combo=0;
    sbUpdateHUD();
    sbShowFeedback('miss');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachMiss;

    sbAIUpdateOnOutcome('miss', null);
    sbAIPredictAndTip();

    sbLogEvent('miss_timeout', { id: tObj.id, boss: tObj.boss ? 1 : 0, decoy: tObj.decoy?1:0 });

    if(tObj.boss){
      sbState.bossActive=false;
      sbState.activeBoss=null;
      sbState.activeBossInfo=null;
      sbSetBossHudVisible(false);
      sbLogEvent('boss_timeout', { bossId: bossInfo?.id || 0 });
    }

    sbEmit('hha:score', { score: sbState.score, gained: 0, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!tObj.boss });
  }, lifeMs);

  if(el.animate){
    el.animate(
      [{ transform:'scale(0.7)', opacity:0 }, { transform:'scale(1)', opacity:1 }],
      { duration: isBoss?240:160, easing:'ease-out' }
    );
  }
}

// ---------------- boss spawn helpers ----------------
function sbMaybeSpawnBoss(){
  if(!sbState.running || sbState.paused) return;
  if(sbState.bossActive) return;
  if(!sbState.bossQueue.length) return;

  const next = sbState.bossQueue[0];
  if(sbState.elapsedMs >= next.spawnAtMs){
    sbState.bossQueue.shift();
    const bossInfo = SB_BOSSES[next.bossIndex];
    sbSpawnTarget(true, bossInfo);
  }
}
function sbSpawnNextBossImmediate(){
  if(!sbState.bossQueue.length) return;
  const next = sbState.bossQueue.shift();
  const bossInfo = SB_BOSSES[next.bossIndex];
  sbSpawnTarget(true, bossInfo);
}

// ---------------- boss phases ----------------
function sbBossMaybePhase2(){
  if(!sbState.bossActive || !sbState.activeBoss || !sbState.activeBossInfo) return;
  const b = sbState.activeBoss;

  // phase2 at <= 50% HP: spawn a drift or decoy pulse (seeded)
  const ratio = b.maxHp > 0 ? (b.hp / b.maxHp) : 0;
  if(!b.__phase2 && ratio <= 0.5){
    b.__phase2 = true;

    const info = sbState.activeBossInfo;
    const name = (sbLang==='th'?info.nameTh:info.nameEn);
    sbEmit('hha:coach', { text: sbI18n[sbLang].bossPhase2(name), boss: info.id, phase2:true });
    sbLogEvent('boss_phase2', { bossId: info.id });

    // phase2 effect: brief burst
    const burst = (sbRand() < 0.5) ? 'drift' : 'decoy';
    if(burst === 'drift'){
      sbSpawnTarget(false, null, { drift:true, lifeMsOverride: Math.round(sbCfg.lifeMs*0.95) });
      sbSpawnTarget(false, null, { drift:true, lifeMsOverride: Math.round(sbCfg.lifeMs*0.90), sizeOverride: 52 });
    }else{
      sbSpawnTarget(false, null, { decoy:true, lifeMsOverride: Math.round(sbCfg.lifeMs*1.05) });
      sbSpawnTarget(false, null, { lifeMsOverride: Math.round(sbCfg.lifeMs*0.90) });
    }
  }

  // near-death cosmetic
  if(b.el && b.hp <= 2){
    try{ b.el.classList.add('boss-final'); }catch(_){}
  }
}

// ---------------- hit logic ----------------
function sbHitTarget(tObj, source='unknown'){
  if(!sbState.running || sbState.paused || !tObj.alive) return;

  // DECOY: punish safely (combo break + miss)
  if(tObj.decoy){
    tObj.alive = false;
    if(tObj.missTimer){ clearTimeout(tObj.missTimer); tObj.missTimer=null; }

    try{ tObj.el && tObj.el.remove(); }catch(_){}

    sbState.miss++;
    sbState.combo = 0;
    sbUpdateHUD();
    sbShowFeedback('decoy');

    const tip = sbI18n[sbLang].coachDecoy;
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = tip;
    sbEmit('hha:coach', { text: tip, decoy:true });

    sbAIUpdateOnOutcome('miss', null);
    sbAIPredictAndTip();

    sbLogEvent('decoy_hit', { id: tObj.id, source });
    sbEmit('hha:score', { score: sbState.score, gained: 0, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:false, decoy:true });
    return;
  }

  const now = performance.now();
  const rtMs = Math.round(now - (tObj.createdAt || now));

  tObj.hp -= 1;

  sbState.hit++;
  const isBoss = tObj.boss;
  const bossInfo = tObj.bossInfo;

  if(tObj.hp > 0){
    sbState.good++;
    sbState.combo++;
    sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

    const base = isBoss ? 70 : 50;
    const comboBonus = Math.min(sbState.combo*5, 60);
    const feverBonus = sbState.fever ? 30 : 0;
    const gained = base + comboBonus + feverBonus;
    sbState.score += gained;

    if(tObj.el && tObj.el.animate){
      tObj.el.animate(
        [{ transform:'scale(1)' }, { transform:'scale(1.08)' }, { transform:'scale(1)' }],
        { duration:140, easing:'ease-out' }
      );
    }

    sbUpdateHUD();
    sbShowFeedback('good');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachGood;

    sbLogEvent('hit', { id: tObj.id, boss: isBoss?1:0, hp: tObj.hp, gained, combo: sbState.combo, rtMs, source });

    sbAIUpdateOnOutcome('hit', rtMs);
    sbAIPredictAndTip();

    if(isBoss){
      sbUpdateBossHud();
      sbBossMaybePhase2();

      if(!sbState.bossWarned && tObj.hp <= 2){
        sbState.bossWarned=true;
        const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
        sbEmit('hha:coach', { text: sbI18n[sbLang].bossNear(name), boss: bossInfo.id });
        sbLogEvent('boss_near', { bossId: bossInfo.id, hp: tObj.hp });
      }
    }

    sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss });
    return;
  }

  // perfect kill
  tObj.alive=false;
  if(tObj.missTimer) { clearTimeout(tObj.missTimer); tObj.missTimer=null; }

  sbState.perfect++;
  sbState.combo++;
  sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

  const base = isBoss ? 200 : 80;
  const comboBonus = Math.min(sbState.combo*8, 100);
  const feverBonus = sbState.fever ? 80 : 0;
  const gained = base + comboBonus + feverBonus;
  sbState.score += gained;

  sbLogEvent('kill', { id: tObj.id, boss: isBoss?1:0, gained, combo: sbState.combo, rtMs, source });

  sbAIUpdateOnOutcome('hit', rtMs);
  sbAIPredictAndTip();

  if(tObj.el && tObj.el.animate){
    tObj.el.animate(
      [{ transform:'scale(1)', opacity:1 }, { transform:'scale(0.1)', opacity:0 }],
      { duration:140, easing:'ease-in' }
    ).onfinish = ()=>{ try{ tObj.el && tObj.el.remove(); }catch(_){} };
  }else{
    try{ tObj.el && tObj.el.remove(); }catch(_){}
  }

  sbUpdateHUD();

  if(sbState.combo >= 5 && !sbState.fever) sbEnterFever();
  else sbShowFeedback('perfect');

  if(isBoss){
    const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
    sbEmit('hha:coach', { text: sbI18n[sbLang].bossClear(name), boss: bossInfo.id });
    sbLogEvent('boss_down', { bossId: bossInfo.id });

    sbState.bossActive=false;
    sbState.activeBoss=null;
    sbState.activeBossInfo=null;
    sbSetBossHudVisible(false);

    sbSpawnNextBossImmediate();
  }

  sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss });
}

// ---------------- crosshair shoot ----------------
function sbHitNearestTargetAtScreenXY(x, y, lockPx=28, source='hha:shoot'){
  if(!sbState.running || sbState.paused || !sbGameArea) return false;
  x=Number(x); y=Number(y);
  if(!Number.isFinite(x)||!Number.isFinite(y)) return false;

  let best=null, bestD2=Infinity;
  for(const tObj of sbState.targets){
    if(!tObj.alive || !tObj.el) continue;
    const r = tObj.el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const dx=cx-x, dy=cy-y;
    const d2=dx*dx+dy*dy;
    if(d2<bestD2){ bestD2=d2; best=tObj; }
  }
  const lock = Math.max(10, Number(lockPx)||28);
  if(best && bestD2 <= lock*lock){
    sbLogEvent('shoot', { source, lockPx: lock });
    sbHitTarget(best, source);
    return true;
  }
  return false;
}
window.addEventListener('hha:shoot', (ev)=>{
  const d = (ev && ev.detail) ? ev.detail : {};
  sbHitNearestTargetAtScreenXY(d.x, d.y, d.lockPx || 28, 'hha:shoot');
});
window.addEventListener('keydown',(ev)=>{
  if(!sbState.running || sbState.paused) return;
  if(ev.code==='Space'){
    ev.preventDefault();
    if(!sbGameArea) return;
    const rect = sbGameArea.getBoundingClientRect();
    sbHitNearestTargetAtScreenXY(rect.left+rect.width/2, rect.top+rect.height/2, 90, 'space');
  }
});

// ---------------- moving targets update (Pack3 drift) ----------------
let sbLastMoveTick = 0;
function sbTickMovingTargets(now){
  if(!sbState.running || sbState.paused) return;
  if(!sbGameArea) return;

  if(!sbLastMoveTick) sbLastMoveTick = now;
  const dt = Math.min(0.05, Math.max(0.0, (now - sbLastMoveTick)/1000));
  sbLastMoveTick = now;

  const rect = sbGameArea.getBoundingClientRect();
  const pad = 14;
  const safeTop = 56;

  for(const t of sbState.targets){
    if(!t || !t.alive || !t.el || !t.drift) continue;

    t.x += t.vx * dt;
    t.y += t.vy * dt;

    // bounce
    const maxX = Math.max(pad, rect.width - t.size - pad);
    const maxY = Math.max(pad + safeTop, rect.height - t.size - pad);

    if(t.x < pad){ t.x = pad; t.vx = Math.abs(t.vx); }
    if(t.x > maxX){ t.x = maxX; t.vx = -Math.abs(t.vx); }
    if(t.y < pad + safeTop){ t.y = pad + safeTop; t.vy = Math.abs(t.vy); }
    if(t.y > maxY){ t.y = maxY; t.vy = -Math.abs(t.vy); }

    t.el.style.left = t.x + 'px';
    t.el.style.top  = t.y + 'px';
  }
}

// ---------------- spawning loops ----------------
function sbStartSpawnLoop(){
  if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer = setInterval(()=>{
    if(!sbState.running || sbState.paused) return;

    if(sbCountAliveTargets() >= sbCfg.maxOnScreen) return;

    if(sbRand() < sbCfg.gapProb) return;

    if(sbState.bossActive && sbRand() < (1 - sbCfg.bossClutterProb)) return;

    sbSpawnTarget(false, null);
  }, sbCfg.spawnMs);
}
function sbStopSpawnLoop(){
  if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer=null;
}
function sbRestartSpawnLoop(){
  if(!sbState.running || sbState.paused) return;
  sbStartSpawnLoop();
}

// ---------------- loop ----------------
let sbLastTimeTick = -1;

function sbMainLoop(now){
  if(!sbState.running) return;

  if(sbState.paused){
    requestAnimationFrame(sbMainLoop);
    return;
  }

  if(!sbState.startTime) sbState.startTime = now;
  sbState.elapsedMs = now - sbState.startTime;

  if(sbMode!=='endless'){
    const remain = Math.max(0, Math.round((sbState.durationMs - sbState.elapsedMs)/1000));
    if(sbHUD.timeVal) sbHUD.timeVal.textContent = String(remain);

    if(remain !== sbLastTimeTick){
      sbLastTimeTick = remain;
      sbEmit('hha:time', { remainSec: remain, elapsedMs: Math.round(sbState.elapsedMs) });
      sbLogEvent('time', { remainSec: remain });
    }

    if(sbState.elapsedMs >= sbState.durationMs){
      sbEndGame('timeup');
      return;
    }
  }else{
    const sec = Math.floor(sbState.elapsedMs/1000);
    if(sbHUD.timeVal) sbHUD.timeVal.textContent = String(sec);
    if(sec !== sbLastTimeTick){
      sbLastTimeTick = sec;
      sbEmit('hha:time', { elapsedSec: sec, elapsedMs: Math.round(sbState.elapsedMs) });
      sbLogEvent('time', { elapsedSec: sec });
    }
  }

  sbCheckFeverTick(now);
  sbMaybeSpawnBoss();
  sbBossMaybePhase2();

  // Pack3 drift updates
  sbTickMovingTargets(now);

  // Pack3 patterns
  sbTickPattern();

  // Pack2 AI
  sbAIAdjustDifficulty();
  sbAIPredictAndTip();

  requestAnimationFrame(sbMainLoop);
}

// ---------------- local CSV summary ----------------
function sbLogLocal(rec){
  try{
    const raw = localStorage.getItem(SB_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(rec);
    localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(arr));
  }catch(err){
    console.warn('[SB] local log failed:', err);
  }
}
function sbDownloadCsv(){
  let rows=[];
  try{
    const raw = localStorage.getItem(SB_STORAGE_KEY);
    if(!raw){ alert('ยังไม่มีข้อมูล session'); return; }
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr) || !arr.length){ alert('ยังไม่มีข้อมูล session'); return; }

    const header=[
      'studentId','schoolName','classRoom','groupCode','deviceType','language','note',
      'phase','mode','diff','gameId','gameVersion','sessionId','timeSec','score','hits','perfect','good','miss',
      'accuracy','maxCombo','fever','timeUsedSec','seedRaw','seedU32','research','studyId','log',
      'aiEnabled','aiLevelEnd','emaAccEnd','emaRTEnd',
      'patternsEnabled','reason','createdAt','eventsKey','eventsCount'
    ];
    rows.push(header.join(','));
    for(const rec of arr){
      const line = header.map(k=>{
        const v = rec[k] !== undefined ? String(rec[k]) : '';
        return `"${v.replace(/"/g,'""')}"`;
      }).join(',');
      rows.push(line);
    }
  }catch(err){
    console.error(err);
    alert('ไม่สามารถสร้าง CSV ได้');
    return;
  }

  const csv = rows.join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='ShadowBreakerSessions.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------- end/start ----------------
function sbEndGame(reason='end'){
  if(!sbState.running) return;

  sbState.running=false;
  sbState.paused=false;

  sbStopSpawnLoop();

  for(const tObj of sbState.targets){
    try{
      if(tObj.missTimer) clearTimeout(tObj.missTimer);
      if(tObj.el && tObj.el.remove) tObj.el.remove();
    }catch(_){}
  }
  sbState.targets=[];
  sbSetBossHudVisible(false);

  const playedSec = Math.round(sbState.elapsedMs/1000);
  const totalHit = sbState.hit;
  const totalMiss = sbState.miss;
  const attempts = totalHit + totalMiss;
  const acc = attempts>0 ? Math.round((totalHit/attempts)*100) : 0;

  sbPersistEvents(sbState.sessionId);
  const eventsKey = sbState.sessionId ? (SB_EVENTS_PREFIX + sbState.sessionId) : '';

  sbLogEvent('end', { reason });

  const rec = {
    studentId:  sbState.sessionMeta?.studentId || '',
    schoolName: sbState.sessionMeta?.schoolName || '',
    classRoom:  sbState.sessionMeta?.classRoom || '',
    groupCode:  sbState.sessionMeta?.groupCode || '',
    deviceType: sbState.sessionMeta?.deviceType || sbDetectDevice(),
    language:   sbLang,
    note:       sbState.sessionMeta?.note || '',
    phase:      sbPhase,
    mode:       sbMode,
    diff:       sbDiff,
    gameId:     SB_GAME_ID,
    gameVersion:SB_GAME_VERSION,
    sessionId:  sbState.sessionId || String(Date.now()),
    timeSec:    (sbMode==='endless') ? playedSec : sbTimeSec,
    score:      sbState.score,
    hits:       totalHit,
    perfect:    sbState.perfect,
    good:       sbState.good,
    miss:       sbState.miss,
    accuracy:   acc,
    maxCombo:   sbState.maxCombo,
    fever:      sbState.fever ? 1 : 0,
    timeUsedSec:playedSec,
    seedRaw:    SB_SEED_RAW,
    seedU32:    (SB_SEED_U32 >>> 0),
    research:   SB_IS_RESEARCH ? 1 : 0,
    studyId:    SB_STUDY_ID,
    log:        SB_LOG,
    aiEnabled:  SB_AI_ENABLED ? 1 : 0,
    aiLevelEnd: +sbAI.level.toFixed(3),
    emaAccEnd:  +sbAI.emaAcc.toFixed(3),
    emaRTEnd:   Math.round(sbAI.emaRT),
    patternsEnabled: SB_PATTERNS_ENABLED ? 1 : 0,
    reason,
    createdAt:  new Date().toISOString(),
    eventsKey,
    eventsCount: sbEvents.length
  };

  sbLogLocal(rec);

  if(sbR.score) sbR.score.textContent = String(sbState.score);
  if(sbR.hit) sbR.hit.textContent = String(totalHit);
  if(sbR.perfect) sbR.perfect.textContent = String(sbState.perfect);
  if(sbR.good) sbR.good.textContent = String(sbState.good);
  if(sbR.miss) sbR.miss.textContent = String(sbState.miss);
  if(sbR.acc) sbR.acc.textContent = acc + '%';
  if(sbR.combo) sbR.combo.textContent = 'x' + sbState.maxCombo;
  if(sbR.timeUsed) sbR.timeUsed.textContent = playedSec + 's';

  if(sbOverlay) sbOverlay.classList.remove('hidden');

  sbEmit('hha:end', rec);
  sbEmit('hha:flush', { reason: 'end', sessionId: rec.sessionId, eventsKey, eventsCount: rec.eventsCount });
}

function sbStartGame(){
  if(sbState.running) return;

  const t = sbI18n[sbLang];

  const sid = sbMetaInputs.studentId ? sbMetaInputs.studentId.value.trim() : '';
  if(SB_IS_RESEARCH && !sid){
    alert(t.alertMeta);
    return;
  }

  const meta = {
    studentId: sid || '',
    schoolName: sbMetaInputs.schoolName ? sbMetaInputs.schoolName.value.trim() : '',
    classRoom: sbMetaInputs.classRoom ? sbMetaInputs.classRoom.value.trim() : '',
    groupCode: sbMetaInputs.groupCode ? sbMetaInputs.groupCode.value.trim() : '',
    deviceType:
      (sbMetaInputs.deviceType && sbMetaInputs.deviceType.value === 'auto')
        ? sbDetectDevice()
        : (sbMetaInputs.deviceType ? sbMetaInputs.deviceType.value : sbDetectDevice()),
    note: sbMetaInputs.note ? sbMetaInputs.note.value.trim() : ''
  };
  sbState.sessionMeta = meta;
  sbSaveMetaDraft();

  // deterministic in research
  if (SB_IS_RESEARCH){
    SB_SEED_U32 = sbResolveResearchSeed(meta.studentId);
    sbInitRng(SB_SEED_U32);
  } else {
    if (SB_SEED_U32) sbInitRng(SB_SEED_U32);
    else { sbRng=null; sbRand=Math.random; }
  }

  sbState.sessionId = String(Date.now());
  sbEvents = [];
  sbLogEvent('start_intent', {
    research: SB_IS_RESEARCH ? 1 : 0,
    seedU32: SB_SEED_U32 >>> 0,
    seedRaw: SB_SEED_RAW || '',
    ai: SB_AI_ENABLED ? 1 : 0,
    patterns: SB_PATTERNS_ENABLED ? 1 : 0
  });

  document.body.classList.add('play-only');

  sbResetStats();
  sbPrepareBossQueue();

  sbState.running=true;
  sbState.paused=false;
  sbState.startTime=0;
  sbLastTimeTick = -1;
  sbLastMoveTick = 0;

  // schedule first pattern (deterministic)
  sbPattern.nextAtMs = 2400 + sbRandInt(900);

  if(sbStartBtn){
    sbStartBtn.disabled=true;
    sbStartBtn.style.opacity=0.75;
  }
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;

  sbEmit('hha:start', {
    gameId: SB_GAME_ID,
    gameVersion: SB_GAME_VERSION,
    phase: sbPhase,
    mode: sbMode,
    diff: sbDiff,
    timeSec: (sbMode==='endless') ? 0 : sbTimeSec,
    seedRaw: SB_SEED_RAW,
    seedU32: (SB_SEED_U32 >>> 0),
    research: SB_IS_RESEARCH ? 1 : 0,
    studyId: SB_STUDY_ID,
    ai: SB_AI_ENABLED ? 1 : 0,
    patterns: SB_PATTERNS_ENABLED ? 1 : 0
  });

  sbLogEvent('start', { phase: sbPhase, mode: sbMode, diff: sbDiff });

  setTimeout(()=>{
    sbStartSpawnLoop();
    requestAnimationFrame(sbMainLoop);
  }, 450);
}

// ---------------- pause/resume from hub ----------------
window.addEventListener('message',(ev)=>{
  const d = ev.data || {};
  if(d.type === 'hub:pause'){
    if(!sbState.running) return;
    const v = !!d.value;
    if(v && !sbState.paused){
      sbState.paused=true;
      sbState.pauseAt = performance.now();
      sbStopSpawnLoop();
      sbEmit('hha:coach', { text: 'Paused' });
      sbLogEvent('pause', {});
      sbFlushSnapshot('pause');
    }else if(!v && sbState.paused){
      sbState.paused=false;
      if(sbState.startTime && sbState.pauseAt){
        const pausedDur = performance.now() - sbState.pauseAt;
        sbState.startTime += pausedDur;
      }
      sbStartSpawnLoop();
      sbEmit('hha:coach', { text: 'Resumed' });
      sbLogEvent('resume', {});
      sbFlushSnapshot('resume');
    }
  }
});

// ---------------- buttons ----------------
if(sbStartBtn) sbStartBtn.addEventListener('click', sbStartGame);

if(sbPlayAgainBtn){
  sbPlayAgainBtn.addEventListener('click',()=>{
    if(sbOverlay) sbOverlay.classList.add('hidden');
    if(sbStartBtn){ sbStartBtn.disabled=false; sbStartBtn.style.opacity=1; }
    sbStartGame();
  });
}

if(sbBackHubBtn){
  sbBackHubBtn.addEventListener('click',()=>{
    sbFlushSnapshot('backhub');
    const hub = SB_HUB || '../hub.html';
    location.href = hub;
  });
}

if(sbDownloadCsvBtn){
  sbDownloadCsvBtn.addEventListener('click', sbDownloadCsv);
}

Object.values(sbMetaInputs).forEach(el=>{
  if(!el) return;
  el.addEventListener('change', sbSaveMetaDraft);
  el.addEventListener('blur', sbSaveMetaDraft);
});

// ---------------- flush-hardened ----------------
window.addEventListener('pagehide', ()=> { if(sbState.running) sbFlushSnapshot('pagehide'); });
document.addEventListener('visibilitychange', ()=> {
  if(document.visibilityState === 'hidden' && sbState.running) sbFlushSnapshot('visibility:hidden');
});
window.addEventListener('beforeunload', ()=> { if(sbState.running) sbFlushSnapshot('beforeunload'); });

// ---------------- init ----------------
sbLoadMeta();
sbApplyLang();

if(sbHUD.timeVal){
  sbHUD.timeVal.textContent = (sbMode==='endless' ? '0' : String(sbTimeSec));
}

})(); // IIFE