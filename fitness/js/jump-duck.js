// === /fitness/js/jump-duck.js — Jump-Duck (G5: TRAP + POWERUPS + SILENT BADGES) v20260213c ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* -------------------------
   Fatal overlay
------------------------- */
function fatal(msg){
  const box = document.getElementById('jd-fatal');
  if (!box) { alert(msg); return; }
  box.textContent = msg;
  box.classList.remove('jd-hidden');
}
window.addEventListener('error', (e)=>{
  fatal('JS ERROR:\n' + (e?.message || e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
});
window.addEventListener('unhandledrejection', (e)=>{
  fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
});

/* -------------------------
   QS / ctx
------------------------- */
function getQS(){ try { return new URL(location.href).searchParams; } catch { return new URLSearchParams(); } }
const QS = getQS();
function qsGet(k, d=''){ const v = QS.get(k); return (v==null || String(v).trim()==='') ? d : String(v); }

const HHA_CTX = {
  hub: qsGet('hub',''),
  view: (qsGet('view','') || '').toLowerCase(),
  mode: (qsGet('mode','') || qsGet('runMode','') || '').toLowerCase(),
  diff: (qsGet('diff','') || '').toLowerCase(),
  duration: qsGet('duration', qsGet('time','')),
  seed: qsGet('seed',''),
  studyId: qsGet('studyId',''),
  phase: qsGet('phase',''),
  conditionGroup: qsGet('conditionGroup',''),
  pid: qsGet('pid',''),
  group: qsGet('group',''),
  note: qsGet('note',''),
  log: qsGet('log','')
};

function detectView(){
  if (HHA_CTX.view) return HHA_CTX.view;
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const w = Math.min(window.innerWidth||0, document.documentElement.clientWidth||0, screen.width||9999);
  const h = Math.min(window.innerHeight||0, document.documentElement.clientHeight||0, screen.height||9999);
  const small = Math.min(w,h) <= 520;
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);
  if ((touch || isMobileUA) && small) return 'cvr';
  if (touch || isMobileUA) return 'mobile';
  return 'pc';
}
function applyViewClass(view){
  const b = document.body;
  b.classList.remove('view-pc','view-mobile','view-cvr','view-vr');
  if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else if (view === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');
}
applyViewClass(detectView());

/* -------------------------
   Optional: auto-load VR UI if WebXR exists
------------------------- */
async function ensureVrUi(){
  try{
    if (window.__HHA_VRUI_LOADED__) return true;
    if (!('xr' in navigator)) return false;
    const src = '../herohealth/vr/vr-ui.js';
    await new Promise((resolve,reject)=>{
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = ()=>reject(new Error('Failed to load '+src));
      document.head.appendChild(s);
    });
    return true;
  }catch(e){
    console.warn(e);
    return false;
  }
}

/* -------------------------
   Seeded RNG
------------------------- */
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function strToSeed(s){
  const str = String(s||'');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function getSeed(){
  if (HHA_CTX.seed) return strToSeed(HHA_CTX.seed);
  const base = `${HHA_CTX.pid||''}|${HHA_CTX.studyId||''}|${HHA_CTX.phase||''}|${HHA_CTX.conditionGroup||''}`;
  if (base.replace(/\|/g,'').trim()) return strToSeed(base);
  return (Date.now() >>> 0);
}
let RNG = mulberry32(getSeed());

/* -------------------------
   DOM refs
------------------------- */
const viewMenu   = $('#view-menu');
const viewPlay   = $('#view-play');
const viewResult = $('#view-result');

const elMode     = $('#jd-mode');
const elDiff     = $('#jd-diff');
const elDuration = $('#jd-duration');

const elResearchBlock = $('#jd-research-block');
const elPid     = $('#jd-participant-id');
const elGroup   = $('#jd-group');
const elNote    = $('#jd-note');

const elHudMode   = $('#hud-mode');
const elHudDiff   = $('#hud-diff');
const elHudDur    = $('#hud-duration');
const elHudStab   = $('#hud-stability');
const elHudObs    = $('#hud-obstacles');
const elHudScore  = $('#hud-score');
const elHudCombo  = $('#hud-combo');
const elHudTime   = $('#hud-time');

const elHudPhase  = $('#hud-phase');
const elHudBoss   = $('#hud-boss');

const elProgFill  = $('#hud-prog-fill');
const elProgText  = $('#hud-prog-text');
const elFeverFill = $('#hud-fever-fill');
const elFeverStat = $('#hud-fever-status');

const bossBarWrap = $('#boss-bar-wrap');
const bossFill    = $('#hud-boss-fill');
const bossStatus  = $('#hud-boss-status');

const elPlayArea  = $('#jd-play-area');
const elAvatar    = $('#jd-avatar');
const elObsHost   = $('#jd-obstacles');
const elJudge     = $('#jd-judge');
const elTele      = $('#jd-tele');

const resMode         = $('#res-mode');
const resDiff         = $('#res-diff');
const resDuration     = $('#res-duration');
const resTotalObs     = $('#res-total-obs');
const resHits         = $('#res-hits');
const resMiss         = $('#res-miss');
const resJumpHit      = $('#res-jump-hit');
const resDuckHit      = $('#res-duck-hit');
const resJumpMiss     = $('#res-jump-miss');
const resDuckMiss     = $('#res-duck-miss');
const resAcc          = $('#res-acc');
const resRTMean       = $('#res-rt-mean');
const resStabilityMin = $('#res-stability-min');
const resScore        = $('#res-score');
const resRank         = $('#res-rank');

const backHubMenu   = $('#jd-back-hub-menu');
const backHubPlay   = $('#jd-back-hub-play');
const backHubResult = $('#jd-back-hub-result');

/* -------------------------
   SFX
------------------------- */
function playSfx(id){
  const el = document.getElementById(id);
  if (!el) return;
  try{ el.currentTime = 0; el.play().catch(()=>{}); }catch{}
}

/* -------------------------
   Config
------------------------- */
const JD_DIFFS = {
  easy:   { speed: 38, spawnMs: 1300, hitWinMs: 260, stabDmg: 10, stabGain: 3, score: 12 },
  normal: { speed: 48, spawnMs: 1000, hitWinMs: 220, stabDmg: 13, stabGain: 3, score: 14 },
  hard:   { speed: 62, spawnMs:  800, hitWinMs: 200, stabDmg: 16, stabGain: 4, score: 16 }
};

const PHASE_THRESH = [0.33, 0.70];

const SPAWN_X  = 100;
const CENTER_X = 24;
const MISS_X   = 4;

/* -------------------------
   Fever system
------------------------- */
const FEVER = {
  threshold: 100,
  decayPerSec: 12,
  durationSec: 5.5,
  gainOnHit: { easy: 18, normal: 16, hard: 14 }
};

/* -------------------------
   G5 POWER-UPS (fair, simple, exciting)
------------------------- */
const POWERUPS = {
  enable: true,

  // base chances (training slightly higher, research/test stable & lower)
  chancePerSpawn_training: 0.045,
  chancePerSpawn_fixed:    0.030,

  // types: shield (block 1 miss), focus (wider window for short time), double (score x2 for short time)
  focusSec: 4.5,
  focusWinMul: 1.35,
  doubleSec: 5.0,

  // cooldown to avoid spam
  minGapMs: 5200
};

/* -------------------------
   G5 TRAP (not unfair): short "?" + tiny visual feint
------------------------- */
const TRAP = {
  enable: true,
  chance_training: 0.10,    // only in training
  chance_fixed:    0.06,    // test/research also allowed but lower
  maskMs: 170,             // show ??? briefly then reveal correct label
  penaltyScore: 0,         // keep 0 to avoid confound; use stability only
};

/* -------------------------
   Silent badges (localStorage)
------------------------- */
const BADGE_KEY = 'HHA_JD_BADGES';
function loadBadges(){
  try{
    const raw = localStorage.getItem(BADGE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  }catch{ return {}; }
}
function saveBadges(obj){
  try{ localStorage.setItem(BADGE_KEY, JSON.stringify(obj||{})); }catch{}
}
function awardBadge(code){
  const b = loadBadges();
  if (b[code]) return false;
  b[code] = { at: new Date().toISOString() };
  saveBadges(b);
  return true;
}
function listBadgeCodes(){
  return Object.keys(loadBadges()||{});
}

/* -------------------------
   AI Predictor (explainable + fair)
------------------------- */
function createAIPredictor(){
  const mem = { streakMiss:0, missJump:0, missDuck:0, lastRT:220, bias:0, switchCostMs:0, lastNeed:null };

  function onOutcome(needType, ok, rt){
    if (ok){
      mem.streakMiss = 0;
      if (Number.isFinite(rt)) mem.lastRT = 0.85*mem.lastRT + 0.15*rt;
      mem.bias *= 0.92;
    }else{
      mem.streakMiss++;
      if (needType === 'jump') mem.missJump++; else mem.missDuck++;
      const total = mem.missJump + mem.missDuck + 1;
      const dj = mem.missDuck / total;
      const jj = mem.missJump / total;
      mem.bias = (dj - jj) * 0.35;
      mem.bias = Math.max(-0.35, Math.min(0.35, mem.bias));
    }
    if (mem.lastNeed && mem.lastNeed !== needType){
      const sc = Number.isFinite(rt) ? Math.max(0, rt - mem.lastRT) : 0;
      mem.switchCostMs = 0.9*mem.switchCostMs + 0.1*sc;
    }
    mem.lastNeed = needType;
  }

  function pickType(baseRand){
    const t = baseRand + mem.bias;
    return (t >= 0.5) ? 'high' : 'low';
  }

  function adjustSpawnInterval(ms, phase, mode){
    let out = ms;
    if (mode === 'training'){
      if (phase === 3) out *= 0.90;
      if (mem.streakMiss >= 2) out *= 1.12;
    }
    out = Math.max(520, Math.min(1800, out));
    return out;
  }

  function getHint(){
    if (mem.streakMiss >= 2) return 'ทิป: อ่าน JUMP/DUCK แล้วกด “ก่อนถึงเส้น” นิดเดียว ✨';
    if (mem.lastRT > 260) return 'ทิป: กดให้ไวขึ้นอีกนิด จะได้ PERFECT ง่ายขึ้น 🔥';
    if (mem.switchCostMs > 90) return 'ทิป: ตอนสลับ JUMP↔DUCK เตรียมท่าล่วงหน้า 🧠';
    return '';
  }

  function snapshot(){
    return {
      ai_streak_miss: mem.streakMiss,
      ai_bias: +mem.bias.toFixed(3),
      ai_last_rt_ms: +mem.lastRT.toFixed(1),
      ai_switch_cost_ms: +mem.switchCostMs.toFixed(1),
      ai_miss_jump: mem.missJump,
      ai_miss_duck: mem.missDuck
    };
  }

  return { onOutcome, pickType, adjustSpawnInterval, getHint, snapshot };
}
const AI = createAIPredictor();

/* -------------------------
   Views / HUD
------------------------- */
function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name === 'menu')   viewMenu?.classList.remove('jd-hidden');
  if (name === 'play')   viewPlay?.classList.remove('jd-hidden');
  if (name === 'result') viewResult?.classList.remove('jd-hidden');
}

let judgeTimer = null;
function showJudge(text, kind){
  if (!elJudge) return;
  elJudge.textContent = text;
  elJudge.className = 'jd-judge show';
  if (kind) elJudge.classList.add(kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=> elJudge.classList.remove('show'), 560);
}

function modeLabel(mode){
  if (mode === 'training') return 'Training';
  if (mode === 'test') return 'Test';
  if (mode === 'research') return 'Research';
  if (mode === 'tutorial') return 'Tutorial';
  return 'Play';
}

/* -------------------------
   Hub backlinks
------------------------- */
function setHubLinks(){
  const hub = HHA_CTX.hub || '';
  if (!hub) return;
  [backHubMenu, backHubPlay, backHubResult].forEach(a=>{ if (a) a.href = hub; });
}

/* -------------------------
   Research meta
------------------------- */
function updateResearchVisibility(){
  const mode = (elMode?.value) || 'training';
  if (!elResearchBlock) return;
  if (mode === 'research') elResearchBlock.classList.remove('jd-hidden');
  else elResearchBlock.classList.add('jd-hidden');
}
function collectParticipant(metaMode){
  if (metaMode !== 'research') return { id:'', group:'', note:'' };
  return {
    id: (elPid?.value || HHA_CTX.pid || '').trim(),
    group: (elGroup?.value || HHA_CTX.group || '').trim(),
    note: (elNote?.value || HHA_CTX.note || '').trim()
  };
}

/* -------------------------
   Logging (bulk)
------------------------- */
function nowIso(){ try{ return new Date().toISOString(); }catch{ return ''; } }
async function postLog(kind, rows){
  const url = HHA_CTX.log || '';
  if (!url) return false;
  try{
    const payload = { kind, rows };
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
      keepalive: true
    });
    return !!res.ok;
  }catch(e){
    console.warn('log post failed', e);
    return false;
  }
}
function makeSessionId(){
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

/* -------------------------
   Boss + Mini + Ultimates (from G4)
------------------------- */
const MINI = { enable:true, startAtProgress:0.48, endAtProgress:0.66, gateEveryMs:2100, gateBurstN:[4,6], feintRate:0.18, revealAfterMs:260 };

const BOSS = {
  hpMax: 100,
  dmgOnHit: 6,
  dmgOnPerfect: 9,
  burstEveryMs: 5200,
  tempoShiftEveryMs: 4200,
  shieldPhaseAtHp: 55,
  shieldNeedStreak: 6,
  patterns: [
    { name:'mirror', w: 3 },
    { name:'abab',   w: 3 },
    { name:'aab',    w: 2 },
    { name:'random', w: 2 },
    { name:'ladder', w: 2 },
    { name:'panic',  w: 1 },
  ],
  ult: {
    shockwaveEveryMs: 9800, shockNeedHits: 2, shockWindowMs: 900,
    slowmoEveryMs: 12800, slowmoSec: 1.6, slowmoFactor: 0.55
  }
};

/* -------------------------
   State
------------------------- */
let running = false;
let state = null;
let rafId = null;
let lastFrame = null;

let lastAction = null;
let nextObstacleId = 1;

function getPhase(progress){
  if (progress < PHASE_THRESH[0]) return 1;
  if (progress < PHASE_THRESH[1]) return 2;
  return 3;
}

/* -------------------------
   Events helpers
------------------------- */
function pushEvent(event_type, extra){
  if (!state) return;
  const base = {
    session_id: state.sessionId,
    created_at_iso: nowIso(),
    mode: state.mode,
    diff: state.diffKey,
    studyId: state.ctx.studyId || '',
    phase: state.ctx.phase || '',
    conditionGroup: state.ctx.conditionGroup || '',
    participant_id: state.participant?.id || '',
    group: state.participant?.group || '',
    note: state.participant?.note || ''
  };
  state.events.push(Object.assign(base, { event_type }, extra || {}));
}
function pushWinSample(sample){
  const w = state.win;
  w.rts.push(sample.rt_ms);
  w.ok.push(sample.ok);
  w.need.push(sample.need);
  w.action.push(sample.action);
  w.timeMs.push(sample.time_ms);
  while (w.rts.length > w.size){
    w.rts.shift(); w.ok.shift(); w.need.shift(); w.action.shift(); w.timeMs.shift();
  }
}
function winFeatures(){
  const w = state.win;
  const n = w.rts.length || 0;
  if (!n) return { win_n:0, win_ok_rate:0, win_rt_mean:0, win_rt_sd:0, win_switch_rate:0 };

  const okRate = w.ok.reduce((a,b)=>a+b,0)/n;
  const rts = w.rts.filter(v=>Number.isFinite(v) && v>0);
  const m = rts.length ? rts.reduce((a,b)=>a+b,0)/rts.length : 0;

  let sd = 0;
  if (rts.length >= 2){
    const v = rts.reduce((a,x)=>a + Math.pow(x-m,2), 0) / (rts.length-1);
    sd = Math.sqrt(v);
  }

  let sw = 0;
  for (let i=1;i<w.need.length;i++){
    if (w.need[i] && w.need[i-1] && w.need[i] !== w.need[i-1]) sw++;
  }
  const switchRate = (w.need.length>=2) ? (sw/(w.need.length-1)) : 0;

  return {
    win_n: n,
    win_ok_rate: +okRate.toFixed(3),
    win_rt_mean: +m.toFixed(1),
    win_rt_sd: +sd.toFixed(1),
    win_switch_rate: +switchRate.toFixed(3)
  };
}

function buildSessionRow(end_reason, acc, rtMean){
  const durS = (state.elapsedMs||0)/1000;
  return {
    session_id: state.sessionId,
    created_at_iso: nowIso(),
    mode: state.mode,
    diff: state.diffKey,
    studyId: state.ctx.studyId || '',
    phase: state.ctx.phase || '',
    conditionGroup: state.ctx.conditionGroup || '',
    participant_id: state.participant?.id || '',
    group: state.participant?.group || '',
    note: state.participant?.note || '',
    duration_planned_s: (state.durationMs||0)/1000,
    duration_actual_s: +durS.toFixed(2),
    obstacles_total: state.obstaclesSpawned||0,
    hits_total: state.hits||0,
    miss_total: state.miss||0,
    acc_pct: +(acc*100).toFixed(2),
    rt_mean_ms: rtMean ? +rtMean.toFixed(1) : 0,
    stability_min_pct: +(state.minStability||0).toFixed(1),
    max_combo: state.maxCombo||0,
    score_final: Math.round(state.score||0),
    boss_hp_end: +(state.bossHp||0).toFixed(1),
    mini_active: state.miniActive ? 1 : 0,
    slowmo_used: state._slowmoUsed ? 1 : 0,
    shockwave_used: state._shockUsed ? 1 : 0,
    power_shield_used: state._pShieldUsed ? 1 : 0,
    power_focus_used: state._pFocusUsed ? 1 : 0,
    power_double_used: state._pDoubleUsed ? 1 : 0,
    badges_json: JSON.stringify(state.badgesEarned||[]),
    end_reason
  };
}

/* -------------------------
   Telegraph helpers
------------------------- */
function telegraphOn(text='⚡ TEMPO SHIFT'){
  if (!elTele) return;
  const inner = elTele.querySelector('.jd-tele-inner');
  if (inner) inner.textContent = text;
  elTele.classList.remove('jd-hidden');
  elTele.classList.add('on');
}
function telegraphOff(){
  if (!elTele) return;
  elTele.classList.remove('on');
  setTimeout(()=> elTele && elTele.classList.add('jd-hidden'), 120);
}

/* -------------------------
   Fever
------------------------- */
function updateFever(dtSec){
  if (!state) return;

  if (state.feverActive){
    state.feverRemain -= dtSec;
    if (state.feverRemain <= 0){
      state.feverActive = false;
      state.feverRemain = 0;
      showJudge('FEVER จบแล้ว ลองสะสมใหม่!', 'ok');
      pushEvent('fever_end', {});
    }
  }else{
    state.fever = Math.max(0, state.fever - FEVER.decayPerSec * dtSec);
  }

  const ratio = Math.min(1, (state.fever||0)/100);
  if (elFeverFill) elFeverFill.style.transform = `scaleX(${ratio.toFixed(3)})`;
  if (elFeverStat){
    if (state.feverActive){
      elFeverStat.textContent = 'FEVER!';
      elFeverStat.classList.add('on');
    }else{
      elFeverStat.textContent = state.power.focusRemain>0 ? 'FOCUS' : 'Ready';
      elFeverStat.classList.remove('on');
    }
  }
}
function feverGainOnHit(){
  const g = FEVER.gainOnHit[state.diffKey] ?? 16;
  state.fever = Math.min(100, state.fever + g);
  if (!state.feverActive && state.fever >= FEVER.threshold){
    state.feverActive = true;
    state.feverRemain = FEVER.durationSec;
    state.fever = 100;
    playSfx('jd-sfx-fever');
    showJudge('🔥 FEVER! คะแนนคูณ!', 'combo');
    pushEvent('fever_start', {});
  }
}

/* -------------------------
   G5 Power state
------------------------- */
function powerReset(){
  state.power = {
    shieldCharges: 0,
    focusRemain: 0,
    doubleRemain: 0,
    lastSpawnMs: -999999
  };
}
function powerTick(dtSec){
  const p = state.power;
  p.focusRemain = Math.max(0, p.focusRemain - dtSec);
  p.doubleRemain = Math.max(0, p.doubleRemain - dtSec);
}
function powerIsDouble(){ return state.power.doubleRemain > 0; }
function powerIsFocus(){ return state.power.focusRemain > 0; }

function powerGrant(type){
  const p = state.power;
  if (type === 'shield'){
    p.shieldCharges = Math.min(2, p.shieldCharges + 1);
    state._pShieldUsed = true;
    showJudge('🛡️ ได้ SHIELD! (บล็อก 1 miss)', 'combo');
  } else if (type === 'focus'){
    p.focusRemain = Math.max(p.focusRemain, POWERUPS.focusSec);
    state._pFocusUsed = true;
    showJudge('🎯 FOCUS! หน้าต่างกว้างขึ้น', 'ok');
  } else if (type === 'double'){
    p.doubleRemain = Math.max(p.doubleRemain, POWERUPS.doubleSec);
    state._pDoubleUsed = true;
    showJudge('💎 DOUBLE SCORE!', 'combo');
  }
  pushEvent('power_pick', { power:type, shield:p.shieldCharges, focus:+p.focusRemain.toFixed(2), dbl:+p.doubleRemain.toFixed(2) });
  elPlayArea?.classList.add('jd-power');
  setTimeout(()=> elPlayArea?.classList.remove('jd-power'), 180);
}

/* -------------------------
   Start / End
------------------------- */
function startGameBase(opts){
  const mode = (opts.mode || 'training').toLowerCase();
  const diffKey = (opts.diffKey || 'normal').toLowerCase();
  const cfg0 = JD_DIFFS[diffKey] || JD_DIFFS.normal;
  const durationMs = opts.durationMs ?? 60000;
  const isTutorial = !!opts.isTutorial;

  RNG = mulberry32(getSeed());

  const now = performance.now();
  state = {
    sessionId: makeSessionId(),
    mode, diffKey, cfg0, durationMs, isTutorial,

    startTime: now,
    elapsedMs: 0,
    remainingMs: durationMs,

    stability: 100,
    minStability: 100,

    nextSpawnAt: now + 650,
    obstacles: [],
    obstaclesSpawned: 0,

    hits: 0,
    miss: 0,

    jumpHit:0, duckHit:0,
    jumpMiss:0, duckMiss:0,

    combo: 0,
    maxCombo: 0,
    score: 0,
    hitRTs: [],

    fever: 0,
    feverActive: false,
    feverRemain: 0,

    miniActive: false,
    miniNextGateAt: now + 99999,

    bossAlive: false,
    bossHp: BOSS.hpMax,
    bossNextBurstAt: now + 99999,
    bossNextTempoAt: now + 99999,
    bossShieldNeedStreak: 0,
    bossShieldStreak: 0,

    slowmoRemain: 0,
    shockRemainHits: 0,
    shockDeadlineAt: 0,
    bossNextShockAt: now + 99999,
    bossNextSlowAt: now + 99999,

    participant: collectParticipant(mode),
    ctx: { ...HHA_CTX },

    events: [],
    sessions: [],

    win: { size: 10, rts: [], ok: [], need: [], action: [], timeMs: [] },

    // G5
    power: null,
    badgesEarned: [],
    trapSeen: 0
  };

  powerReset();

  running = true;
  lastFrame = now;
  lastAction = null;
  nextObstacleId = 1;

  elObsHost && (elObsHost.innerHTML = '');
  elAvatar && elAvatar.classList.remove('jump','duck');
  elTele && elTele.classList.add('jd-hidden');
  bossBarWrap && bossBarWrap.classList.add('jd-hidden');

  elHudMode && (elHudMode.textContent = modeLabel(mode));
  elHudDiff && (elHudDiff.textContent = diffKey);
  elHudDur  && (elHudDur.textContent  = (durationMs/1000|0)+'s');
  elHudStab && (elHudStab.textContent = '100%');
  elHudObs  && (elHudObs.textContent  = '0 / 0');
  elHudScore&& (elHudScore.textContent= '0');
  elHudCombo&& (elHudCombo.textContent= '0');
  elHudTime && (elHudTime.textContent = (durationMs/1000).toFixed(1));
  elHudPhase && (elHudPhase.textContent = '1');
  elHudBoss && (elHudBoss.textContent = '—');

  if (elProgFill) elProgFill.style.transform = 'scaleX(0)';
  if (elProgText) elProgText.textContent = '0%';
  if (elFeverFill) elFeverFill.style.transform = 'scaleX(0)';
  if (elFeverStat){
    elFeverStat.textContent = 'Ready';
    elFeverStat.classList.remove('on');
  }
  if (bossFill) bossFill.style.transform = 'scaleX(1)';
  if (bossStatus){
    bossStatus.textContent = '—';
    bossStatus.classList.remove('on');
  }

  pushEvent('start', {});
  showView('play');
  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  showJudge(isTutorial ? 'Tutorial: Low=JUMP 🦘 · High=DUCK 🛡️' : 'READY ✨', 'ok');
}

function startGameFromMenu(){
  const mode = (elMode?.value || HHA_CTX.mode || 'training').toLowerCase();
  const diff = (elDiff?.value || HHA_CTX.diff || 'normal').toLowerCase();
  const durS = parseInt((elDuration?.value || HHA_CTX.duration || '60'),10) || 60;
  startGameBase({ mode, diffKey: diff, durationMs: durS*1000, isTutorial:false });
}
function startTutorial(){
  startGameBase({ mode:'training', diffKey:'easy', durationMs:15000, isTutorial:true });
}

function evaluateBadges(acc){
  const earned = [];

  // 1) first_play
  if (awardBadge('jd_first_play')) earned.push('jd_first_play');

  // 2) no_miss (perfect run)
  if ((state.miss||0) === 0 && state.obstaclesSpawned >= 18){
    if (awardBadge('jd_no_miss')) earned.push('jd_no_miss');
  }

  // 3) combo_12
  if ((state.maxCombo||0) >= 12){
    if (awardBadge('jd_combo_12')) earned.push('jd_combo_12');
  }

  // 4) boss_down
  if (state.bossHp <= 0){
    if (awardBadge('jd_boss_down')) earned.push('jd_boss_down');
  }

  // 5) accuracy_85
  if (acc >= 0.85 && state.obstaclesSpawned >= 20){
    if (awardBadge('jd_acc_85')) earned.push('jd_acc_85');
  }

  state.badgesEarned = earned;
  if (earned.length){
    pushEvent('badges_awarded', { badges: JSON.stringify(earned) });
  }
}

async function endGame(reason='end'){
  running = false;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }
  if (!state) return;

  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const acc   = total ? hits/total : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  evaluateBadges(acc);

  const ses = buildSessionRow(reason, acc, rtMean);
  state.sessions.push(ses);

  if (HHA_CTX.log){
    await postLog('events', state.events);
    await postLog('sessions', state.sessions);
  }

  if (state.isTutorial){
    showJudge('จบ Tutorial แล้ว! 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  resMode && (resMode.textContent = modeLabel(state.mode));
  resDiff && (resDiff.textContent = state.diffKey);
  resDuration && (resDuration.textContent = (state.durationMs/1000|0)+'s');
  resTotalObs && (resTotalObs.textContent = String(total));
  resHits && (resHits.textContent = String(state.hits));
  resMiss && (resMiss.textContent = String(state.miss));
  resJumpHit && (resJumpHit.textContent = String(state.jumpHit));
  resDuckHit && (resDuckHit.textContent = String(state.duckHit));
  resJumpMiss&& (resJumpMiss.textContent= String(state.jumpMiss));
  resDuckMiss&& (resDuckMiss.textContent= String(state.duckMiss));
  resAcc && (resAcc.textContent = (acc*100).toFixed(1)+' %');
  resRTMean && (resRTMean.textContent = rtMean ? rtMean.toFixed(0)+' ms' : '-');
  resStabilityMin && (resStabilityMin.textContent = state.minStability.toFixed(1)+' %');
  resScore && (resScore.textContent = String(Math.round(state.score)));

  if (resRank){
    let rank = 'C';
    const stab = state.minStability;
    if (acc >= 0.90 && stab >= 85) rank='S';
    else if (acc >= 0.80 && stab >= 75) rank='A';
    else if (acc >= 0.65 && stab >= 60) rank='B';
    else if (acc < 0.40 || stab < 40)   rank='D';
    resRank.textContent = rank;
  }

  // Silent badges: append a small line into note area (no new DOM required)
  // (If you want a dedicated UI block later, we can add it in HTML/CSS G6)
  if (state.badgesEarned.length){
    showJudge('🏅 ได้เหรียญใหม่ในสรุปผล (เงียบ ๆ)', 'ok');
  }

  showView('result');
}

/* -------------------------
   Mini-boss
------------------------- */
function updateMiniBoss(ts, phase, progress){
  if (!MINI.enable || phase !== 2) { state.miniActive = false; return; }
  const within = (progress >= MINI.startAtProgress && progress <= MINI.endAtProgress);
  if (!within){ state.miniActive = false; return; }

  if (!state.miniActive){
    state.miniActive = true;
    state.miniNextGateAt = ts + 900;
    showJudge('👾 MINI-BOSS: Gate + Feint!', 'combo');
    pushEvent('mini_enter', { progress: +progress.toFixed(3) });
    telegraphOn('👾 MINI-BOSS GATE');
    setTimeout(telegraphOff, 520);
  }

  if (ts >= state.miniNextGateAt){
    state.miniNextGateAt = ts + MINI.gateEveryMs + (RNG()*220 - 80);
    miniGate(ts);
  }
}
function miniGate(ts){
  telegraphOn('⚡ GATE!');
  setTimeout(telegraphOff, 460);
  pushEvent('mini_gate', {});
  const n0 = MINI.gateBurstN[0], n1 = MINI.gateBurstN[1];
  const n = n0 + Math.floor(RNG()*(n1-n0+1));
  const baseDelay = 120;
  const start = (RNG()<0.5) ? 'low' : 'high';
  for (let i=0;i<n;i++){
    const type = (i%2===0) ? start : (start==='low'?'high':'low');
    setTimeout(()=> { if (running && state) makeOne(type, performance.now(), { isBoss:false, isMini:true }); }, baseDelay*i);
  }
}

/* -------------------------
   Boss logic
------------------------- */
function pickWeightedPattern(){
  const arr = BOSS.patterns;
  let sum = 0; for (const p of arr) sum += (p.w||1);
  let r = RNG() * sum;
  for (const p of arr){ r -= (p.w||1); if (r <= 0) return p.name; }
  return arr[0]?.name || 'random';
}
function bossEnter(ts){
  state.bossAlive = true;
  state.bossHp = BOSS.hpMax;
  state.bossNextBurstAt = ts + 1200;
  state.bossNextTempoAt = ts + 1400;
  state.bossShieldNeedStreak = 0;
  state.bossShieldStreak = 0;
  state.bossNextShockAt = ts + 2600;
  state.bossNextSlowAt  = ts + 4800;

  bossBarWrap && bossBarWrap.classList.remove('jd-hidden');
  bossStatus && (bossStatus.textContent = 'BOSS!');
  bossStatus && bossStatus.classList.add('on');

  playSfx('jd-sfx-boss');
  pushEvent('boss_enter', { boss_hp: state.bossHp });
  showJudge('⚡ BOSS PHASE! Mixed Patterns!', 'combo');

  telegraphOn('⚡ BOSS IN');
  setTimeout(telegraphOff, 560);
}
function bossBurst(ts){
  const p = pickWeightedPattern();
  pushEvent('boss_burst', { pattern:p });

  const n = 5 + Math.floor(RNG()*3);
  const baseDelay = (p === 'panic') ? 95 : 120;

  let seq = [];
  if (p === 'mirror' || p === 'abab'){
    const a = (RNG()<0.5) ? 'low' : 'high';
    const b = (a==='low') ? 'high' : 'low';
    for (let i=0;i<n;i++) seq.push(i%2===0 ? a : b);
  }else if (p === 'aab'){
    const a = (RNG()<0.5) ? 'low' : 'high';
    const b = (a==='low') ? 'high' : 'low';
    for (let i=0;i<n;i++) seq.push((i%3===2) ? b : a);
  }else if (p === 'ladder'){
    const startLow = (RNG()<0.5);
    for (let i=0;i<n;i++){
      const block = Math.floor(i/2)%2;
      const low = startLow ? (block===0) : (block===1);
      seq.push(low ? 'low' : 'high');
    }
  }else if (p === 'panic'){
    const a = (RNG()<0.5) ? 'low' : 'high';
    const b = (a==='low') ? 'high' : 'low';
    for (let i=0;i<n;i++) seq.push((i===2) ? a : (i%2===0 ? a : b));
  }else{
    for (let i=0;i<n;i++) seq.push(RNG()<0.5?'low':'high');
  }

  telegraphOn(p === 'panic' ? '⚡ PANIC!' : '⚡ BURST!');
  setTimeout(telegraphOff, 520);

  for (let i=0;i<seq.length;i++){
    const type = seq[i] === 'high' ? 'high' : 'low';
    setTimeout(()=> { if (running && state) makeOne(type, performance.now(), { isBoss:true, isMini:false }); }, baseDelay*i);
  }
  showJudge(p === 'panic' ? '⚡ PANIC BURST!' : '⚡ BURST!', 'combo');
}
function startShockwave(ts){
  state.shockRemainHits = BOSS.ult.shockNeedHits;
  state.shockDeadlineAt = ts + BOSS.ult.shockWindowMs;
  state._shockUsed = true;

  telegraphOn('🌊 SHOCKWAVE!');
  setTimeout(telegraphOff, 650);

  pushEvent('boss_ultimate_shock_start', { needHits: state.shockRemainHits });
  showJudge('🌊 Shockwave: ถูก 2 ครั้งติดกันเร็ว ๆ!', 'combo');
  elPlayArea?.classList.add('jd-ult-shock');
  setTimeout(()=> elPlayArea?.classList.remove('jd-ult-shock'), 900);
}
function startSlowmo(ts){
  state.slowmoRemain = BOSS.ult.slowmoSec;
  state._slowmoUsed = true;

  telegraphOn('🌀 SLOW-MO!');
  setTimeout(telegraphOff, 650);

  pushEvent('boss_ultimate_slowmo_start', { sec: state.slowmoRemain });
  showJudge('🌀 Slow-Mo! ทำ PERFECT ง่ายขึ้น', 'ok');
  elPlayArea?.classList.add('jd-ult-slow');
  setTimeout(()=> elPlayArea?.classList.remove('jd-ult-slow'), 900);
}
function updateBoss(ts, phase){
  if (phase !== 3){
    elHudBoss && (elHudBoss.textContent = '—');
    return;
  }
  if (!state.bossAlive) bossEnter(ts);

  if (elHudBoss) elHudBoss.textContent = `${Math.max(0, Math.round(state.bossHp))}%`;
  if (bossFill) bossFill.style.transform = `scaleX(${Math.max(0, state.bossHp/BOSS.hpMax).toFixed(3)})`;
  if (bossStatus){
    bossStatus.textContent = (state.bossShieldNeedStreak > 0)
      ? `SHIELD x${state.bossShieldNeedStreak} (${state.bossShieldStreak})`
      : (state.feverActive ? 'FEVER!' : 'BOSS!');
    bossStatus.classList.add('on');
  }

  if (ts >= state.bossNextTempoAt){
    state.bossNextTempoAt = ts + BOSS.tempoShiftEveryMs + (RNG()*450 - 200);
    telegraphOn('⚡ TEMPO SHIFT');
    setTimeout(telegraphOff, 600);
    pushEvent('boss_tempo_shift', { boss_hp: state.bossHp });
  }
  if (ts >= state.bossNextBurstAt){
    state.bossNextBurstAt = ts + BOSS.burstEveryMs + (RNG()*600 - 240);
    bossBurst(ts);
  }
  if (ts >= state.bossNextShockAt){
    state.bossNextShockAt = ts + BOSS.ult.shockwaveEveryMs + (RNG()*900 - 250);
    startShockwave(ts);
  }
  if (ts >= state.bossNextSlowAt){
    state.bossNextSlowAt = ts + BOSS.ult.slowmoEveryMs + (RNG()*1000 - 350);
    startSlowmo(ts);
  }

  if (state.bossHp <= BOSS.shieldPhaseAtHp && state.bossShieldNeedStreak === 0){
    state.bossShieldNeedStreak = BOSS.shieldNeedStreak;
    state.bossShieldStreak = 0;
    pushEvent('boss_shield_start', { need: state.bossShieldNeedStreak });
    showJudge(`🛡️ SHIELD! ต้องถูกติดกัน ${BOSS.shieldNeedStreak} ครั้ง!`, 'combo');
    telegraphOn('🛡️ SHIELD!');
    setTimeout(telegraphOff, 700);
  }

  if (state.bossHp <= 0){
    state.bossHp = 0;
    state.bossAlive = false;
    pushEvent('boss_down', {});
    showJudge('🏆 BOSS DOWN! เก่งมาก!', 'combo');
    endGame('boss-down');
  }
}

/* -------------------------
   Spawn helpers (G5: TRAP + POWERUP)
------------------------- */
function shouldTrap(){
  if (!TRAP.enable) return false;
  const p = (state.mode === 'training') ? TRAP.chance_training : TRAP.chance_fixed;
  return RNG() < p;
}
function shouldPowerup(){
  if (!POWERUPS.enable) return false;
  const p = (state.mode === 'training') ? POWERUPS.chancePerSpawn_training : POWERUPS.chancePerSpawn_fixed;
  const now = performance.now();
  if (now - state.power.lastSpawnMs < POWERUPS.minGapMs) return false;
  return RNG() < p;
}
function pickPowerType(){
  const r = RNG();
  if (r < 0.34) return 'shield';
  if (r < 0.67) return 'focus';
  return 'double';
}

function spawnObstacle(ts, phase, progress){
  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 70) return;

  // in Phase 3 boss already injects bursts; still allow normal spawns
  const r = RNG();
  const type = AI.pickType(r); // 'high'|'low'

  // fairness: spawnPair ONLY training
  const spawnPair = (phase === 3 && state.mode === 'training' && RNG() < 0.12);

  makeOne(type, ts, { isBoss:false, isMini:false, allowTrap: (phase>=2), allowPower: (phase>=2) });

  if (spawnPair){
    setTimeout(()=> {
      if (running && state) makeOne(RNG()<0.5?'high':'low', performance.now(), { isBoss:false, isMini:false, allowTrap:false, allowPower:false });
    }, 140);
  }
}

function makeOne(type, ts, opt){
  const isHigh = (type === 'high');
  const need = isHigh ? 'duck' : 'jump';

  const el = document.createElement('div');
  el.className = 'jd-obstacle ' + (isHigh ? 'jd-obstacle--high' : 'jd-obstacle--low');
  el.dataset.id = String(nextObstacleId);

  // Mini feint (from MINI)
  const doFeintMini = !!(opt?.isMini) && (RNG() < MINI.feintRate);

  // G5 trap mask (not unfair): show "???" briefly then reveal
  const doTrap = !!(opt?.allowTrap) && shouldTrap();
  if (doTrap) el.classList.add('jd-trap');

  // Powerup token: spawn as special obstacle that grants power when hit correctly
  const doPower = !!(opt?.allowPower) && shouldPowerup();
  const powerType = doPower ? pickPowerType() : '';

  const inner = document.createElement('div');
  inner.className = 'jd-obstacle-inner';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'jd-obs-icon';
  iconSpan.textContent = doPower ? (powerType==='shield'?'🛡️':(powerType==='focus'?'🎯':'💎')) : (isHigh ? '⬇' : '⬆');

  const tagSpan = document.createElement('span');
  tagSpan.className = 'jd-obs-tag';

  if (doPower){
    el.classList.add('jd-powerup');
    tagSpan.textContent = (powerType==='shield') ? 'SHIELD' : (powerType==='focus' ? 'FOCUS' : 'DOUBLE');
  } else if (doTrap){
    tagSpan.textContent = '???';
  } else if (doFeintMini){
    el.classList.add('jd-feint');
    tagSpan.textContent = '???';
  } else {
    tagSpan.textContent = isHigh ? 'DUCK' : 'JUMP';
  }

  inner.appendChild(iconSpan);
  inner.appendChild(tagSpan);
  el.appendChild(inner);
  elObsHost.appendChild(el);

  // reveal trap quickly (fair)
  if (doTrap){
    state.trapSeen++;
    setTimeout(()=>{
      if (!el.isConnected) return;
      el.classList.add('jd-reveal');
      tagSpan.textContent = isHigh ? 'DUCK' : 'JUMP';
    }, TRAP.maskMs);
  }

  // reveal mini feint
  if (doFeintMini){
    setTimeout(()=>{
      if (!el.isConnected) return;
      el.classList.add('jd-reveal');
      tagSpan.textContent = isHigh ? 'DUCK' : 'JUMP';
    }, MINI.revealAfterMs);
  }

  state.obstacles.push({
    id: nextObstacleId++,
    type,
    need,
    x: SPAWN_X,
    createdAt: ts,
    resolved:false,
    element: el,
    isBoss: !!opt?.isBoss,
    isMini: !!opt?.isMini,
    isPower: !!doPower,
    powerType
  });

  state.obstaclesSpawned++;
  playSfx('jd-sfx-beep');
}

/* -------------------------
   Update obstacles + hit/miss rules
------------------------- */
function updateObstacles(dt, now, phase, progress){
  const cfg = state.cfg0;

  let speed = cfg.speed;
  if (state.mode === 'training'){
    if (phase === 2) speed *= 1.12;
    if (phase === 3) speed *= 1.26;
    speed *= (1 + 0.18*progress);
  } else {
    if (phase === 3) speed *= 1.10;
  }
  if (state.slowmoRemain > 0) speed *= BOSS.ult.slowmoFactor;
  if (phase === 3 && state.bossAlive){
    const wob = 1 + 0.06*Math.sin((now - state.startTime)/420);
    speed *= wob;
  }

  const move = speed * (dt/1000);
  const keep = [];

  for (const obs of state.obstacles){
    obs.x -= move;
    if (obs.element) obs.element.style.left = obs.x + '%';

    // HIT window
    if (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6){
      const a = lastAction;
      if (a && a.time){
        let hitWin = cfg.hitWinMs;
        if (powerIsFocus()) hitWin = Math.round(hitWin * POWERUPS.focusWinMul);

        const rt = Math.abs(a.time - now);
        const perfect = rt <= (hitWin * 0.55);

        if (a.type === obs.need && rt <= hitWin){
          obs.resolved = true;

          state.hits++;
          state.combo++;
          state.maxCombo = Math.max(state.maxCombo, state.combo);

          // score (double power + fever)
          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const phaseM = (phase === 3) ? 1.18 : (phase === 2 ? 1.08 : 1.0);
          const feverM = state.feverActive ? 1.35 : 1.0;
          const perfM  = perfect ? 1.15 : 1.0;
          const doubleM = powerIsDouble() ? 2.0 : 1.0;

          const gain = Math.round(cfg.score * comboM * phaseM * feverM * perfM * doubleM);
          state.score += gain;

          // power pickup
          if (obs.isPower){
            powerGrant(obs.powerType);
          }

          // shockwave requirement
          if (phase === 3 && state.shockRemainHits > 0){
            if (now <= state.shockDeadlineAt){
              state.shockRemainHits--;
              if (state.shockRemainHits <= 0){
                state.bossHp = Math.max(0, state.bossHp - 18);
                pushEvent('boss_ultimate_shock_clear', { bonus_dmg: 18 });
                showJudge('🌊 SHOCKWAVE CLEAR! +DMG', 'combo');
              }
            } else {
              state.shockRemainHits = 0;
              pushEvent('boss_ultimate_shock_fail', {});
              showJudge('🌊 ช้าไป! Shockwave หาย', 'miss');
            }
          }

          // boss damage
          if (phase === 3 && state.bossAlive){
            let dmg = perfect ? BOSS.dmgOnPerfect : BOSS.dmgOnHit;
            dmg *= (state.feverActive ? 1.2 : 1.0);
            dmg *= (powerIsDouble() ? 1.08 : 1.0); // slight
            state.bossHp = Math.max(0, state.bossHp - dmg);

            if (state.bossShieldNeedStreak > 0){
              state.bossShieldStreak++;
              if (state.bossShieldStreak >= state.bossShieldNeedStreak){
                state.bossShieldNeedStreak = 0;
                state.bossShieldStreak = 0;
                state.bossHp = Math.max(0, state.bossHp - 14);
                showJudge('💥 SHIELD BREAK!', 'combo');
                pushEvent('boss_shield_break', { bonus_dmg:14 });
              }
            }
          }

          if (obs.need === 'jump') state.jumpHit++; else state.duckHit++;
          state.stability = Math.min(100, state.stability + cfg.stabGain);
          state.minStability = Math.min(state.minStability, state.stability);

          state.hitRTs.push(rt);
          feverGainOnHit();
          AI.onOutcome(obs.need, true, rt);

          obs.element && obs.element.remove();
          obs.element = null;

          playSfx('jd-sfx-hit');
          if (state.combo >= 8) playSfx('jd-sfx-combo');

          const msg = perfect ? 'PERFECT! ⚡' : (obs.need === 'jump' ? 'JUMP ดีมาก 🦘' : 'DUCK ทันเวลา 🛡️');
          showJudge(msg, (state.combo>=8 || perfect) ? 'combo' : 'ok');

          const sample = { time_ms: Math.round(state.elapsedMs), need: obs.need, action: a.type, ok: 1, rt_ms: Math.round(rt) };
          pushWinSample(sample);

          pushEvent('hit', Object.assign({
            obstacle_type: obs.type,
            required_action: obs.need,
            action: a.type,
            rt_ms: Math.round(rt),
            perfect: perfect ? 1 : 0,
            combo_after: state.combo,
            score_after: Math.round(state.score),
            stability_after_pct: +state.stability.toFixed(1),
            fever_after: +state.fever.toFixed(1),
            fever_active: state.feverActive ? 1 : 0,
            boss_hp_after: +state.bossHp.toFixed(1),
            mini_active: state.miniActive ? 1 : 0,
            power_shield: state.power.shieldCharges,
            power_focus: +state.power.focusRemain.toFixed(2),
            power_double:+state.power.doubleRemain.toFixed(2),
            is_power: obs.isPower ? 1 : 0,
            power_type: obs.powerType || '',
            trap_seen: state.trapSeen
          }, winFeatures(), AI.snapshot()));

          continue;

        } else if (rt <= hitWin && a.type !== obs.need){
          // WRONG ACTION (may be blocked by shield)
          obs.resolved = true;

          const shielded = (state.power.shieldCharges > 0);
          if (shielded){
            state.power.shieldCharges--;
            showJudge('🛡️ SHIELD บล็อก MISS!', 'ok');
            pushEvent('shield_block', { remain: state.power.shieldCharges });
          } else {
            state.miss++;
            state.combo = 0;
            if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;
            state.stability = Math.max(0, state.stability - cfg.stabDmg);
            state.minStability = Math.min(state.minStability, state.stability);
            AI.onOutcome(obs.need, false, rt);

            if (phase === 3 && state.bossShieldNeedStreak > 0) state.bossShieldStreak = 0;
            if (phase === 3 && state.shockRemainHits > 0){
              state.shockRemainHits = 0;
              pushEvent('boss_ultimate_shock_fail', { reason:'wrong-action' });
            }

            playSfx('jd-sfx-miss');
            showJudge('ผิดท่า! 🌀', 'miss');
            elPlayArea?.classList.add('shake');
            setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);

            const sample = { time_ms: Math.round(state.elapsedMs), need: obs.need, action: a.type, ok: 0, rt_ms: Math.round(rt) };
            pushWinSample(sample);

            pushEvent('miss', Object.assign({
              obstacle_type: obs.type,
              required_action: obs.need,
              action: a.type,
              rt_ms: Math.round(rt),
              miss_reason: 'wrong-action',
              stability_after_pct: +state.stability.toFixed(1),
              boss_hp_after: +state.bossHp.toFixed(1),
              power_shield: state.power.shieldCharges
            }, winFeatures(), AI.snapshot()));

            if (state.stability <= 0){
              showJudge('หมดแรงทรงตัว! ⛔', 'miss');
              endGame('stability-zero');
              return;
            }
          }

          obs.element && obs.element.remove();
          obs.element = null;
          continue;
        }
      }
    }

    // MISS: passed zone (may be shielded)
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;

      const shielded = (state.power.shieldCharges > 0);
      if (shielded){
        state.power.shieldCharges--;
        showJudge('🛡️ SHIELD บล็อก MISS!', 'ok');
        pushEvent('shield_block', { remain: state.power.shieldCharges, reason:'late' });
      } else {
        state.miss++;
        state.combo = 0;
        if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;
        state.stability = Math.max(0, state.stability - cfg.stabDmg);
        state.minStability = Math.min(state.minStability, state.stability);
        AI.onOutcome(obs.need, false, NaN);

        if (phase === 3 && state.bossShieldNeedStreak > 0) state.bossShieldStreak = 0;
        if (phase === 3 && state.shockRemainHits > 0){
          state.shockRemainHits = 0;
          pushEvent('boss_ultimate_shock_fail', { reason:'late' });
        }

        playSfx('jd-sfx-miss');
        showJudge('MISS ลองใหม่อีกที ✨', 'miss');
        elPlayArea?.classList.add('shake');
        setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);

        const sample = { time_ms: Math.round(state.elapsedMs), need: obs.need, action: lastAction ? lastAction.type : '', ok: 0, rt_ms: '' };
        pushWinSample(sample);

        pushEvent('miss', Object.assign({
          obstacle_type: obs.type,
          required_action: obs.need,
          action: lastAction ? lastAction.type : '',
          miss_reason: 'late-no-action',
          stability_after_pct: +state.stability.toFixed(1),
          boss_hp_after: +state.bossHp.toFixed(1),
          power_shield: state.power.shieldCharges
        }, winFeatures(), AI.snapshot()));

        if (state.stability <= 0){
          showJudge('หมดแรงทรงตัว! ⛔', 'miss');
          endGame('stability-zero');
          return;
        }
      }

      obs.element && obs.element.remove();
      obs.element = null;
      continue;
    }

    if (obs.x > -20) keep.push(obs);
    else { obs.element && obs.element.remove(); obs.element = null; }
  }

  state.obstacles = keep;
  if (lastAction && now - lastAction.time > 260) lastAction = null;
}

/* -------------------------
   Input
------------------------- */
function triggerAction(type){
  if (!state || !running) return;
  const now = performance.now();
  lastAction = { type, time: now };
  if (elAvatar){
    elAvatar.classList.remove('jump','duck');
    elAvatar.classList.add(type);
    setTimeout(()=> elAvatar?.classList.remove(type), 180);
  }
}
function handleKeyDown(ev){
  if (!running) return;
  if (ev.code === 'ArrowUp' || ev.code === 'KeyW'){ ev.preventDefault(); triggerAction('jump'); }
  else if (ev.code === 'ArrowDown' || ev.code === 'KeyS'){ ev.preventDefault(); triggerAction('duck'); }
}
function handlePointerDown(ev){
  if (!running || !elPlayArea) return;
  const rect = elPlayArea.getBoundingClientRect();
  const mid = rect.top + rect.height/2;
  const y = ev.clientY;
  if (y < mid) triggerAction('jump'); else triggerAction('duck');
}
function onHhaShoot(ev){
  if (!running || !elPlayArea) return;
  const d = ev?.detail || {};
  const rect = elPlayArea.getBoundingClientRect();
  const y = Number.isFinite(d.y) ? d.y : (rect.top + rect.height/2);
  const mid = rect.top + rect.height/2;
  if (y < mid) triggerAction('jump'); else triggerAction('duck');
}

/* -------------------------
   Loop
------------------------- */
function loop(ts){
  if (!running || !state) return;

  const dt = ts - (lastFrame||ts);
  lastFrame = ts;

  state.elapsedMs = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

  const progress = Math.min(1, state.elapsedMs / state.durationMs);
  const phase = getPhase(progress);

  elHudTime && (elHudTime.textContent = (state.remainingMs/1000).toFixed(1));
  elHudPhase && (elHudPhase.textContent = String(phase));

  if (state.elapsedMs >= state.durationMs){
    endGame('timeup');
    return;
  }

  if (elProgFill) elProgFill.style.transform = `scaleX(${progress.toFixed(3)})`;
  if (elProgText) elProgText.textContent = Math.round(progress*100) + '%';

  updateFever(dt/1000);
  powerTick(dt/1000);

  if (state.slowmoRemain > 0) state.slowmoRemain = Math.max(0, state.slowmoRemain - dt/1000);

  updateMiniBoss(ts, phase, progress);
  updateBoss(ts, phase);

  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts, phase, progress);

    let interval = state.cfg0.spawnMs;

    if (state.mode === 'training'){
      const factor = 1 - 0.30*progress;
      interval = interval * Math.max(0.58, factor);
      interval = AI.adjustSpawnInterval(interval, phase, state.mode);
    } else {
      if (phase === 2 && state.miniActive) interval *= 0.86;
      if (phase === 3) interval *= 0.84;
    }

    state.nextSpawnAt += interval;
  }

  updateObstacles(dt, ts, phase, progress);

  elHudStab && (elHudStab.textContent = state.stability.toFixed(1)+'%');
  elHudObs  && (elHudObs.textContent  = `${state.hits} / ${state.obstaclesSpawned}`);
  elHudScore&& (elHudScore.textContent= String(Math.round(state.score)));
  elHudCombo&& (elHudCombo.textContent= String(state.combo));

  const tip = AI.getHint();
  if (tip && phase === 2 && (state.elapsedMs % 7000 < 30)){
    showJudge(tip, 'combo');
  }

  rafId = requestAnimationFrame(loop);
}

/* -------------------------
   Init
------------------------- */
async function initJD(){
  setHubLinks();

  if (HHA_CTX.mode && elMode) elMode.value = HHA_CTX.mode;
  if (HHA_CTX.diff && elDiff) elDiff.value = HHA_CTX.diff;
  if (HHA_CTX.duration && elDuration) elDuration.value = String(HHA_CTX.duration);

  if (elPid && HHA_CTX.pid) elPid.value = HHA_CTX.pid;
  if (elGroup && HHA_CTX.group) elGroup.value = HHA_CTX.group;
  if (elNote && HHA_CTX.note) elNote.value = HHA_CTX.note;

  elMode?.addEventListener('change', updateResearchVisibility);
  updateResearchVisibility();

  $('[data-action="start"]')?.addEventListener('click', startGameFromMenu);
  $('[data-action="tutorial"]')?.addEventListener('click', startTutorial);
  $('[data-action="stop-early"]')?.addEventListener('click', ()=> running && endGame('stop-early'));
  $('[data-action="play-again"]')?.addEventListener('click', startGameFromMenu);
  $$('[data-action="back-menu"]').forEach(btn=> btn.addEventListener('click', ()=> showView('menu')));

  $('[data-action="jump"]')?.addEventListener('click', ()=> triggerAction('jump'));
  $('[data-action="duck"]')?.addEventListener('click', ()=> triggerAction('duck'));

  window.addEventListener('keydown', handleKeyDown, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false});

  await ensureVrUi();
  window.addEventListener('hha:shoot', onHhaShoot);

  showView('menu');
}
window.addEventListener('DOMContentLoaded', initJD);