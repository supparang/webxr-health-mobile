// === /fitness/js/jump-duck.js — Jump-Duck (BOSS PROFILES + MIXED + FEVER + AI + LOG) v20260210a ===
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
function getQS(){
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}
const QS = getQS();
function qsGet(k, d=''){
  const v = QS.get(k);
  return (v==null || String(v).trim()==='') ? d : String(v);
}

const HHA_CTX = {
  hub: qsGet('hub',''),
  view: (qsGet('view','') || '').toLowerCase(),      // pc/mobile/cvr/vr (NO override)
  mode: (qsGet('mode','') || qsGet('runMode','') || '').toLowerCase(), // training/test/research
  diff: (qsGet('diff','') || '').toLowerCase(),
  duration: qsGet('duration', qsGet('time','')),
  seed: qsGet('seed',''),
  studyId: qsGet('studyId',''),
  phase: qsGet('phase',''),
  conditionGroup: qsGet('conditionGroup',''),
  pid: qsGet('pid',''),
  group: qsGet('group',''),
  note: qsGet('note',''),
  log: qsGet('log',''),          // ✅ Apps Script Web App URL
  boss: (qsGet('boss','mixed') || 'mixed').toLowerCase(), // ✅ boss profile: tempo|trickster|shield|mixed
  projectTag: qsGet('projectTag','HeroHealth')           // optional
};

function detectView(){
  if (HHA_CTX.view) return HHA_CTX.view; // NO override
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
    const src = '../herohealth/vr/vr-ui.js'; // from /fitness/* -> /herohealth/vr/vr-ui.js
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
   Fever
------------------------- */
const FEVER = {
  threshold: 100,
  decayPerSec: 12,
  durationSec: 5.5,
  gainOnHit: { easy: 18, normal: 16, hard: 14 }
};

/* -------------------------
   AI Predictor (explainable + fair)
------------------------- */
function createAIPredictor(){
  const mem = {
    streakMiss: 0,
    missJump: 0,
    missDuck: 0,
    lastRT: 220,
    bias: 0,
    switchCostMs: 0,
    lastNeed: null
  };

  function onOutcome(needType, ok, rt){
    if (ok){
      mem.streakMiss = 0;
      if (Number.isFinite(rt)) mem.lastRT = 0.85*mem.lastRT + 0.15*rt;
      mem.bias *= 0.92;
    }else{
      mem.streakMiss++;
      if (needType === 'jump') mem.missJump++;
      else mem.missDuck++;
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

  function adjustSpawnInterval(ms, phase){
    let out = ms;
    if (phase === 3 && mem.streakMiss >= 2) out *= 1.10;
    out = Math.max(520, Math.min(1800, out));
    return out;
  }

  function getHint(){
    if (mem.streakMiss >= 2) return 'ทิป: อ่านป้าย JUMP/DUCK แล้วกด “ก่อนถึงเส้น” นิดเดียว ✨';
    if (mem.lastRT > 260)    return 'ทิป: ลองกดให้เร็วขึ้นอีกนิด จะได้ PERFECT ง่ายขึ้น 🔥';
    if (mem.switchCostMs > 90) return 'ทิป: ช่วงสลับ JUMP↔DUCK ให้เตรียมท่าล่วงหน้า 🧠';
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
   Views
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
  judgeTimer = setTimeout(()=> elJudge.classList.remove('show'), 520);
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
   Logging: post rows to Apps Script (your schema friendly)
   - send each row with _table: 'events'|'sessions'
------------------------- */
function nowIso(){ try{ return new Date().toISOString(); }catch{ return ''; } }

function deviceLabel(){
  const v = detectView();
  if (v === 'vr') return 'vr';
  if (v === 'cvr') return 'cvr';
  if (v === 'mobile') return 'mobile';
  return 'pc';
}

async function postRow(table, row){
  const url = HHA_CTX.log || '';
  if (!url) return false;
  try{
    const payload = Object.assign({ _table: table }, row);
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

async function postRows(table, rows){
  if (!rows || !rows.length) return true;
  // ส่งทีละแถว (ปลอดภัย/อ่านง่ายในชีต)
  for (const r of rows){
    await postRow(table, r);
  }
  return true;
}

/* -------------------------
   Boss Profiles + Mixed
------------------------- */
const BOSS_BASE = {
  hpMax: 100,
  dmgOnHit: 6,
  dmgOnPerfect: 9,
  burstEveryMs: 5200,
  shieldPhaseAtHp: 55,
  tempoShiftEveryMs: 4200
};

function bossProfileFor(hpPct){
  // hpPct 0..100
  const q = (HHA_CTX.boss || 'mixed').toLowerCase();
  if (q && q !== 'mixed') return q;

  // mixed: 100..66 tempo, 65..36 trickster, <=35 shield
  if (hpPct > 66) return 'tempo';
  if (hpPct > 35) return 'trickster';
  return 'shield';
}

function bossTuning(profile){
  // multipliers + behaviors
  if (profile === 'tempo'){
    return {
      burstEveryMs: 4600,
      tempoShiftEveryMs: 3200,
      wobble: 0.085,
      feintRate: 0.00,
      shieldNeedStreak: 0
    };
  }
  if (profile === 'trickster'){
    return {
      burstEveryMs: 5000,
      tempoShiftEveryMs: 4200,
      wobble: 0.065,
      feintRate: 0.10, // มี “หลอก” บางลูก
      shieldNeedStreak: 0
    };
  }
  if (profile === 'shield'){
    return {
      burstEveryMs: 5600,
      tempoShiftEveryMs: 4400,
      wobble: 0.055,
      feintRate: 0.00,
      shieldNeedStreak: 6 // ต้องถูกติดกัน 6
    };
  }
  return {
    burstEveryMs: BOSS_BASE.burstEveryMs,
    tempoShiftEveryMs: BOSS_BASE.tempoShiftEveryMs,
    wobble: 0.06,
    feintRate: 0.06,
    shieldNeedStreak: 0
  };
}

/* -------------------------
   State
------------------------- */
let running = false;
let state = null;
let rafId = null;
let lastFrame = null;

let lastAction = null; // {type:'jump'|'duck', time:number}
let nextObstacleId = 1;

function getPhase(progress){
  if (progress < PHASE_THRESH[0]) return 1;
  if (progress < PHASE_THRESH[1]) return 2;
  return 3;
}

/* -------------------------
   Session helpers
------------------------- */
function makeSessionId(){
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

/* -------------------------
   Events rows (sheet columns friendly)
------------------------- */
function baseRow(){
  return {
    timestampIso: nowIso(),
    projectTag: HHA_CTX.projectTag || 'HeroHealth',
    runMode: state?.mode || (HHA_CTX.mode || ''),
    studyId: HHA_CTX.studyId || '',
    phase: HHA_CTX.phase || '',
    conditionGroup: HHA_CTX.conditionGroup || '',
    sessionId: state?.sessionId || '',
    gameMode: 'jumpduck',
    diff: state?.diffKey || (HHA_CTX.diff || ''),
    device: deviceLabel(),
    gameVersion: 'v20260210a',
    studentKey: HHA_CTX.pid || '',
    schoolCode: '',
    classRoom: '',
    studentNo: '',
    nickName: ''
  };
}

function pushEventRow(eventType, extra){
  if (!state) return;
  const row = Object.assign(baseRow(), {
    eventType,
    timeFromStartMs: Math.round(state.elapsedMs || 0),
    totalScore: Math.round(state.score || 0),
    combo: state.combo || 0,
    extra: extra ? JSON.stringify(extra) : ''
  });
  state._eventRows.push(row);
}

function buildSessionRow(end_reason, acc, rtMean){
  const durS = (state.elapsedMs||0)/1000;
  const row = Object.assign(baseRow(), {
    // sessions schema-ish
    runMode: state.mode,
    durationPlannedSec: (state.durationMs||0)/1000,
    durationPlayedSec: +durS.toFixed(2),
    scoreFinal: Math.round(state.score||0),
    comboMax: state.maxCombo||0,
    misses: state.miss||0,
    accPct: +(acc*100).toFixed(2),
    rtMeanMs: rtMean ? +rtMean.toFixed(1) : 0,
    stabilityMinPct: +(state.minStability||0).toFixed(1),
    bossHpEnd: +(state.bossHp||0).toFixed(1),
    bossProfile: state.bossProfile || '',
    reason: end_reason,
    __extraJson: JSON.stringify({
      hits: state.hits,
      jumpHit: state.jumpHit, duckHit: state.duckHit,
      jumpMiss: state.jumpMiss, duckMiss: state.duckMiss,
      feverActive: state.feverActive,
      seedUsed: state.seedUsed,
      view: detectView()
    })
  });
  return row;
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
      pushEventRow('fever_end', {});
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
      elFeverStat.textContent = 'Ready';
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
    pushEventRow('fever_start', {});
  }
}

/* -------------------------
   Telegraph overlay
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
   Boss logic
------------------------- */
function bossEnter(ts){
  state.bossAlive = true;
  state.bossHp = BOSS_BASE.hpMax;
  state.bossProfile = bossProfileFor(100);
  state.bossTuning = bossTuning(state.bossProfile);

  state.bossNextBurstAt = ts + 1200;
  state.bossNextTempoAt = ts + 1400;

  state.bossShieldNeedStreak = 0;
  state.bossShieldStreak = 0;

  bossBarWrap && bossBarWrap.classList.remove('jd-hidden');
  bossStatus && (bossStatus.textContent = `BOSS · ${state.bossProfile.toUpperCase()}`);
  bossStatus && bossStatus.classList.add('on');

  playSfx('jd-sfx-boss');
  pushEventRow('boss_enter', { profile: state.bossProfile, hp: state.bossHp });
  showJudge('⚡ BOSS PHASE! เตรียมสลับ JUMP/DUCK!', 'combo');
  telegraphOn('⚡ BOSS START');
  setTimeout(telegraphOff, 650);
}

function updateBoss(ts, phase){
  if (phase !== 3){
    elHudBoss && (elHudBoss.textContent = '—');
    return;
  }

  if (!state.bossAlive){
    bossEnter(ts);
  }

  // profile switch (mixed)
  const hpPct = Math.max(0, Math.round(state.bossHp));
  const pNow = bossProfileFor(hpPct);
  if (pNow !== state.bossProfile){
    state.bossProfile = pNow;
    state.bossTuning = bossTuning(pNow);
    pushEventRow('boss_profile_switch', { profile: pNow, hp: hpPct });
    showJudge(`🧠 BOSS เปลี่ยนโหมด: ${pNow.toUpperCase()}!`, 'combo');
    telegraphOn(`⚡ ${pNow.toUpperCase()} MODE`);
    setTimeout(telegraphOff, 650);
  }

  // HUD
  if (elHudBoss) elHudBoss.textContent = `${hpPct}%`;
  if (bossFill) bossFill.style.transform = `scaleX(${Math.max(0, state.bossHp/BOSS_BASE.hpMax).toFixed(3)})`;
  if (bossStatus){
    const shieldTxt = (state.bossShieldNeedStreak > 0) ? `SHIELD ${state.bossShieldStreak}/${state.bossShieldNeedStreak}` : '';
    bossStatus.textContent = state.feverActive ? `FEVER! · ${state.bossProfile.toUpperCase()}` : (`BOSS · ${state.bossProfile.toUpperCase()} ${shieldTxt}`.trim());
    bossStatus.classList.add('on');
  }

  // tempo shift
  const tempoEvery = state.bossTuning.tempoShiftEveryMs;
  if (ts >= state.bossNextTempoAt){
    state.bossNextTempoAt = ts + tempoEvery + (RNG()*450 - 200);
    telegraphOn('⚡ TEMPO SHIFT');
    setTimeout(telegraphOff, 600);
    pushEventRow('boss_tempo_shift', { profile: state.bossProfile, hp: hpPct });
  }

  // burst
  const burstEvery = state.bossTuning.burstEveryMs;
  if (ts >= state.bossNextBurstAt){
    state.bossNextBurstAt = ts + burstEvery + (RNG()*600 - 240);
    bossBurst(ts);
  }

  // shield challenge (เฉพาะ profile shield หรือ mixed เข้าโหมด shield)
  const needStreak = state.bossTuning.shieldNeedStreak || 0;
  if (needStreak > 0 && state.bossShieldNeedStreak === 0){
    state.bossShieldNeedStreak = needStreak;
    state.bossShieldStreak = 0;
    pushEventRow('boss_shield_start', { need: needStreak, profile: state.bossProfile });
    showJudge(`🛡️ SHIELD! ต้องถูกติดกัน ${needStreak} ครั้ง!`, 'combo');
    telegraphOn('🛡️ SHIELD UP');
    setTimeout(telegraphOff, 700);
  }

  // win
  if (state.bossHp <= 0){
    state.bossHp = 0;
    state.bossAlive = false;
    pushEventRow('boss_down', { profile: state.bossProfile });
    showJudge('🏆 BOSS DOWN! เก่งมาก!', 'combo');
    endGame('boss-down');
  }
}

function bossBurst(ts){
  telegraphOn('⚡ BURST');
  setTimeout(telegraphOff, 650);

  pushEventRow('boss_burst', { profile: state.bossProfile });

  const patterns = ['mirror', 'abab', 'aab', 'random'];
  const p = patterns[Math.floor(RNG()*patterns.length)];
  const n = 5 + Math.floor(RNG()*3); // 5-7
  const baseDelay = 120;

  let seq = [];
  if (p === 'mirror'){
    const start = (RNG()<0.5) ? 'low' : 'high';
    for (let i=0;i<n;i++) seq.push((i%2===0) ? start : (start==='low'?'high':'low'));
  }else if (p === 'abab'){
    const a = (RNG()<0.5) ? 'low' : 'high';
    const b = (a==='low') ? 'high' : 'low';
    for (let i=0;i<n;i++) seq.push(i%2===0 ? a : b);
  }else if (p === 'aab'){
    const a = (RNG()<0.5) ? 'low' : 'high';
    const b = (a==='low') ? 'high' : 'low';
    for (let i=0;i<n;i++) seq.push((i%3===2) ? b : a);
  }else{
    for (let i=0;i<n;i++) seq.push(RNG()<0.5?'low':'high');
  }

  // schedule spawn chain
  for (let i=0;i<seq.length;i++){
    const type = seq[i] === 'high' ? 'high' : 'low';
    setTimeout(()=> {
      if (running && state) makeOne(type, performance.now(), true, false);
    }, baseDelay*i);
  }

  showJudge('⚡ BURST!', 'combo');
}

/* -------------------------
   Obstacles: trickster feint
------------------------- */
function maybeFeint(){
  // “หลอก” เฉพาะ profile trickster
  const rate = state?.bossTuning?.feintRate || 0;
  return (rate > 0) && (RNG() < rate);
}

/* -------------------------
   Game start / end
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
    seedUsed: getSeed(),
    mode,
    diffKey,
    cfg0,
    durationMs,
    isTutorial,

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

    bossHp: BOSS_BASE.hpMax,
    bossAlive: false,
    bossNextBurstAt: now + 5200,
    bossNextTempoAt: now + 4200,
    bossShieldNeedStreak: 0,
    bossShieldStreak: 0,
    bossProfile: '',
    bossTuning: bossTuning(bossProfileFor(100)),

    participant: collectParticipant(mode),

    // rows for logger
    _eventRows: [],
    _sessionRows: []
  };

  running = true;
  lastFrame = now;

  // UI reset
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

  // start log
  pushEventRow('start', { bossParam: HHA_CTX.boss, logEnabled: !!HHA_CTX.log });

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

async function endGame(reason='end'){
  running = false;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }
  if (!state) return;

  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const acc   = total ? hits/total : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  const ses = buildSessionRow(reason, acc, rtMean);
  state._sessionRows.push(ses);

  // post logs (events + sessions) as rows
  if (HHA_CTX.log){
    await postRows('events', state._eventRows);
    await postRows('sessions', state._sessionRows);
  }

  if (state.isTutorial){
    showJudge('จบ Tutorial แล้ว! 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  // fill result
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

  showView('result');
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
  updateBoss(ts, phase);

  // spawn schedule (Training เร่งปลายเกม / Test&Research คงที่ แต่ “ยังมี boss”)
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts, phase);

    let interval = state.cfg0.spawnMs;
    if (state.mode === 'training'){
      const factor = 1 - 0.30*progress;
      interval = interval * Math.max(0.58, factor);
      interval = AI.adjustSpawnInterval(interval, phase);
    }else{
      // test/research: คงที่ (แต่ phase 3 ยังมี burst จาก bossBurst)
      interval = AI.adjustSpawnInterval(interval, phase);
    }

    state.nextSpawnAt += interval;
  }

  updateObstacles(dt, ts, phase, progress);
  pollGamepad(ts);

  elHudStab && (elHudStab.textContent = state.stability.toFixed(1)+'%');
  elHudObs && (elHudObs.textContent = `${state.hits} / ${state.obstaclesSpawned}`);
  elHudScore && (elHudScore.textContent = String(Math.round(state.score)));
  elHudCombo && (elHudCombo.textContent = String(state.combo));

  const tip = AI.getHint();
  if (tip && phase === 2 && (state.elapsedMs % 7000 < 25)){
    showJudge(tip, 'combo');
  }

  rafId = requestAnimationFrame(loop);
}

/* -------------------------
   Obstacles
------------------------- */
function spawnObstacle(ts, phase){
  if (!elObsHost || !state) return;

  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 70) return;

  const r = RNG();
  const type = AI.pickType(r); // 'high' or 'low'

  // pair (ทุกโหมดได้ แต่ลด rate ใน test/research)
  const pairRate = (phase === 3) ? (state.mode === 'training' ? 0.12 : 0.06) : 0.00;
  const spawnPair = (phase === 3 && RNG() < pairRate);

  makeOne(type, ts, false, maybeFeint());
  if (spawnPair){
    setTimeout(()=> {
      if (running && state) makeOne(RNG()<0.5?'high':'low', performance.now(), false, maybeFeint());
    }, 140);
  }
}

function makeOne(type, ts, isBoss, feint){
  const isHigh = (type === 'high');
  const need = isHigh ? 'duck' : 'jump';

  const el = document.createElement('div');
  el.className = 'jd-obstacle ' + (isHigh ? 'jd-obstacle--high' : 'jd-obstacle--low');
  if (feint) el.classList.add('jd-feint');
  el.dataset.id = String(nextObstacleId);

  const inner = document.createElement('div');
  inner.className = 'jd-obstacle-inner';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'jd-obs-icon';
  iconSpan.textContent = isHigh ? '⬇' : '⬆';

  const tagSpan = document.createElement('span');
  tagSpan.className = 'jd-obs-tag';
  tagSpan.textContent = feint ? (isHigh ? '???' : '???') : (isHigh ? 'DUCK' : 'JUMP');

  inner.appendChild(iconSpan);
  inner.appendChild(tagSpan);
  el.appendChild(inner);
  elObsHost.appendChild(el);

  state.obstacles.push({
    id: nextObstacleId++,
    type,
    need,
    x: SPAWN_X,
    createdAt: ts,
    resolved:false,
    element: el,
    isBoss: !!isBoss,
    feint: !!feint
  });

  state.obstaclesSpawned++;
  playSfx('jd-sfx-beep');
}

function updateObstacles(dt, now, phase, progress){
  const cfg = state.cfg0;
  let speed = cfg.speed;

  if (state.mode === 'training'){
    if (phase === 2) speed *= 1.12;
    if (phase === 3) speed *= 1.26;
    speed *= (1 + 0.18*progress);
  }else{
    // test/research: คุมให้คงที่กว่า
    if (phase === 3) speed *= 1.08;
  }

  // boss wobble
  if (phase === 3 && state.bossAlive){
    const wobAmp = state.bossTuning?.wobble ?? 0.06;
    const wob = 1 + wobAmp*Math.sin((now - state.startTime)/420);
    speed *= wob;
  }

  const move = speed * (dt/1000);
  const keep = [];

  for (const obs of state.obstacles){
    obs.x -= move;
    if (obs.element) obs.element.style.left = obs.x + '%';

    // ใกล้เส้น: ถ้าเป็น feint ให้เผยคำสั่งจริงตอนเข้า window
    if (obs.feint && !obs._revealed && obs.x <= CENTER_X + 10){
      obs._revealed = true;
      const tag = obs.element?.querySelector('.jd-obs-tag');
      if (tag) tag.textContent = (obs.type === 'high') ? 'DUCK' : 'JUMP';
      obs.element?.classList.add('jd-reveal');
      showJudge('👀 ระวัง Trickster!', 'combo');
      pushEventRow('boss_feint_reveal', { id: obs.id, need: obs.need });
    }

    // HIT window
    if (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6){
      const a = lastAction;
      if (a && a.time){
        const rt = Math.abs(a.time - now);
        const perfect = rt <= (cfg.hitWinMs * 0.55);

        if (a.type === obs.need && rt <= cfg.hitWinMs){
          obs.resolved = true;

          state.hits++;
          state.combo++;
          state.maxCombo = Math.max(state.maxCombo, state.combo);

          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const phaseM = (phase === 3) ? 1.18 : (phase === 2 ? 1.08 : 1.0);
          const feverM = state.feverActive ? 1.35 : 1.0;
          const perfM  = perfect ? 1.15 : 1.0;
          const gain = Math.round(cfg.score * comboM * phaseM * feverM * perfM);
          state.score += gain;

          // boss damage
          if (phase === 3 && state.bossAlive){
            let dmg = perfect ? BOSS_BASE.dmgOnPerfect : BOSS_BASE.dmgOnHit;
            dmg *= (state.feverActive ? 1.2 : 1.0);
            state.bossHp = Math.max(0, state.bossHp - dmg);

            // shield streak
            if (state.bossShieldNeedStreak > 0){
              state.bossShieldStreak++;
              if (state.bossShieldStreak >= state.bossShieldNeedStreak){
                state.bossShieldNeedStreak = 0;
                state.bossShieldStreak = 0;
                state.bossHp = Math.max(0, state.bossHp - 14);
                showJudge('💥 SHIELD BREAK!', 'combo');
                pushEventRow('boss_shield_break', {});
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

          const msg = perfect
            ? (obs.need === 'jump' ? 'PERFECT JUMP! ⚡' : 'PERFECT DUCK! ⚡')
            : (obs.need === 'jump' ? 'JUMP ดีมาก 🦘' : 'DUCK ทันเวลา 🛡️');

          showJudge(msg, (state.combo>=8 || perfect) ? 'combo' : 'ok');

          pushEventRow('hit', {
            obstacleId: obs.id,
            required: obs.need,
            action: a.type,
            rtMs: Math.round(rt),
            perfect: perfect ? 1 : 0,
            feverActive: state.feverActive ? 1 : 0,
            feverValue: +state.fever.toFixed(1),
            bossHp: +state.bossHp.toFixed(1),
            bossProfile: state.bossProfile
          });

          continue;
        } else if (rt <= cfg.hitWinMs && a.type !== obs.need){
          // WRONG ACTION
          obs.resolved = true;

          state.miss++;
          state.combo = 0;
          if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;

          state.stability = Math.max(0, state.stability - cfg.stabDmg);
          state.minStability = Math.min(state.minStability, state.stability);

          AI.onOutcome(obs.need, false, rt);
          if (phase === 3 && state.bossShieldNeedStreak > 0) state.bossShieldStreak = 0;

          obs.element && obs.element.remove();
          obs.element = null;

          playSfx('jd-sfx-miss');
          showJudge('ผิดท่า! 🌀', 'miss');

          elPlayArea?.classList.add('shake');
          setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);

          pushEventRow('miss', {
            obstacleId: obs.id,
            required: obs.need,
            action: a.type,
            rtMs: Math.round(rt),
            missReason: 'wrong-action',
            bossHp: +state.bossHp.toFixed(1),
            bossProfile: state.bossProfile
          });

          continue;
        }
      }
    }

    // LATE MISS
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;

      state.miss++;
      state.combo = 0;
      if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;

      state.stability = Math.max(0, state.stability - cfg.stabDmg);
      state.minStability = Math.min(state.minStability, state.stability);

      AI.onOutcome(obs.need, false, NaN);
      if (phase === 3 && state.bossShieldNeedStreak > 0) state.bossShieldStreak = 0;

      obs.element && obs.element.remove();
      obs.element = null;

      playSfx('jd-sfx-miss');
      showJudge('MISS ลองใหม่อีกที ✨', 'miss');

      elPlayArea?.classList.add('shake');
      setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);

      pushEventRow('miss', {
        obstacleId: obs.id,
        required: obs.need,
        action: lastAction ? lastAction.type : '',
        rtMs: '',
        missReason: 'late-no-action',
        bossHp: +state.bossHp.toFixed(1),
        bossProfile: state.bossProfile
      });

      if (state.stability <= 0){
        showJudge('หมดแรงทรงตัว! ⛔', 'miss');
        endGame('stability-zero');
        return;
      }

      continue;
    }

    if (obs.x > -20) keep.push(obs);
    else {
      obs.element && obs.element.remove();
      obs.element = null;
    }
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
  if (ev.code === 'ArrowUp'){ ev.preventDefault(); triggerAction('jump'); }
  else if (ev.code === 'ArrowDown'){ ev.preventDefault(); triggerAction('duck'); }
  else if (ev.code === 'KeyW'){ ev.preventDefault(); triggerAction('jump'); }
  else if (ev.code === 'KeyS'){ ev.preventDefault(); triggerAction('duck'); }
}
function handlePointerDown(ev){
  if (!running || !elPlayArea) return;
  const rect = elPlayArea.getBoundingClientRect();
  const mid = rect.top + rect.height/2;
  const y = ev.clientY;
  if (y < mid) triggerAction('jump');
  else triggerAction('duck');
}
function onHhaShoot(ev){
  if (!running || !elPlayArea) return;
  const d = ev?.detail || {};
  const rect = elPlayArea.getBoundingClientRect();
  const y = Number.isFinite(d.y) ? d.y : (rect.top + rect.height/2);
  const mid = rect.top + rect.height/2;
  if (y < mid) triggerAction('jump');
  else triggerAction('duck');
}

/* -------------------------
   Gamepad
------------------------- */
let gpPrev = { up:false, down:false, a:false, b:false };
function pollGamepad(){
  if (!running) return;
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gps && gps[0];
  if (!gp || !gp.buttons) return;

  const up   = !!gp.buttons[12]?.pressed;
  const down = !!gp.buttons[13]?.pressed;
  const a    = !!gp.buttons[0]?.pressed;
  const b    = !!gp.buttons[1]?.pressed;

  if (up && !gpPrev.up) triggerAction('jump');
  if (down && !gpPrev.down) triggerAction('duck');
  if (a && !gpPrev.a) triggerAction('jump');
  if (b && !gpPrev.b) triggerAction('duck');

  gpPrev = { up, down, a, b };
}

/* -------------------------
   Init
------------------------- */
async function initJD(){
  setHubLinks();

  // prefill from URL
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

window.JD_EXPORT = {
  getState(){ return state ? JSON.parse(JSON.stringify(state)) : null; }
};

window.addEventListener('DOMContentLoaded', initJD);