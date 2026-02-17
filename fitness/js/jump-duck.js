// === /fitness/js/jump-duck.js — Jump-Duck (PROFILE + LOG PASS + BOSS SKILLS + MINI GOALS) v20260217c ===
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

const GAME_VERSION = 'JD-v20260217c';

const HHA_CTX = {
  hub: qsGet('hub',''),
  view: (qsGet('view','') || '').toLowerCase(),
  mode: (qsGet('mode','') || qsGet('runMode','') || '').toLowerCase(),
  diff: (qsGet('diff','') || '').toLowerCase(),
  duration: qsGet('duration', qsGet('time','')),
  seed: qsGet('seed',''),

  projectTag: qsGet('projectTag','HeroHealth-JumpDuck'),
  studyId: qsGet('studyId',''),
  phase: qsGet('phase',''),
  conditionGroup: qsGet('conditionGroup',''),
  sessionOrder: qsGet('sessionOrder',''),
  blockLabel: qsGet('blockLabel',''),
  siteCode: qsGet('siteCode',''),
  schoolYear: qsGet('schoolYear',''),
  semester: qsGet('semester',''),

  // profile meta passthrough (optional)
  schoolCode: qsGet('schoolCode',''),
  schoolName: qsGet('schoolName',''),
  classRoom: qsGet('classRoom',''),
  studentNo: qsGet('studentNo',''),
  nickName: qsGet('nickName',''),
  gender: qsGet('gender',''),
  age: qsGet('age',''),
  gradeLevel: qsGet('gradeLevel',''),
  heightCm: qsGet('heightCm',''),
  weightKg: qsGet('weightKg',''),
  bmi: qsGet('bmi',''),
  bmiGroup: qsGet('bmiGroup',''),
  vrExperience: qsGet('vrExperience',''),
  gameFrequency: qsGet('gameFrequency',''),
  handedness: qsGet('handedness',''),
  visionIssue: qsGet('visionIssue',''),
  healthDetail: qsGet('healthDetail',''),
  consentParent: qsGet('consentParent',''),
  consentTeacher: qsGet('consentTeacher',''),
  profileSource: qsGet('profileSource',''),
  surveyKey: qsGet('surveyKey',''),
  excludeFlag: qsGet('excludeFlag',''),

  pid: qsGet('pid',''),
  group: qsGet('group',''),
  note: qsGet('note',''),

  // ✅ Apps Script Web App URL
  log: qsGet('log','')
};

function detectDevice(){
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isiOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile = isAndroid || isiOS || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) <= 820);
  const xr = ('xr' in navigator) ? 'xr' : 'no-xr';
  const w = window.innerWidth||0, h = window.innerHeight||0;
  return `${isMobile?'mobile':'pc'}|${xr}|${w}x${h}`;
}

function detectView(){
  if (HHA_CTX.view) return HHA_CTX.view;
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const w = Math.min(window.innerWidth||0, document.documentElement.clientWidth||0, screen.width||9999);
  const h = Math.min(window.innerHeight||0, document.documentElement.clientHeight||0, screen.height||9999);
  const small = Math.min(w,h) <= 520;
  const ua = navigator.userAgent || '';
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
   Optional: load VR UI if WebXR exists
------------------------- */
async function ensureVrUi(){
  try{
    if (window.__HHA_VRUI_LOADED__) return true;
    if (!('xr' in navigator)) return false;
    const src = '../herohealth/vr/vr-ui.js';
    await new Promise((resolve,reject)=>{
      const s = document.createElement('script');
      s.src = src;
      s.onload = ()=>{ window.__HHA_VRUI_LOADED__ = true; resolve(); };
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

const elNick    = $('#jd-nick');
const elGender  = $('#jd-gender');
const elAge     = $('#jd-age');
const elGrade   = $('#jd-grade');
const elHeight  = $('#jd-height');
const elWeight  = $('#jd-weight');
const elProfileStatus = $('#jd-profile-status');

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
const elHudSkill  = $('#hud-skill');
const elHudMini   = $('#hud-mini');

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
   AI Predictor (fair/explainable)
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
    if (mem.streakMiss >= 2) return 'ทิป: อ่านป้าย JUMP/DUCK แล้วกด “ก่อนถึงเส้น” นิดเดียว ✨';
    if (mem.lastRT > 260) return 'ทิป: ลองกดให้เร็วขึ้นอีกนิด จะได้ PERFECT ง่ายขึ้น 🔥';
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
   Research meta + profile
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

function calcBMI(heightCm, weightKg){
  const h = Number(heightCm), w = Number(weightKg);
  if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return '';
  const m = h / 100;
  const bmi = w / (m*m);
  return bmi.toFixed(2);
}

function setStatus(el, txt, cls){
  if (!el) return;
  el.textContent = txt || '';
  el.classList.remove('ok','bad');
  if (cls) el.classList.add(cls);
}

function buildProfileRow(){
  const studentKey = (elPid?.value || HHA_CTX.pid || '').trim();
  return {
    timestampIso: nowIso(),
    projectTag: HHA_CTX.projectTag || 'HeroHealth-JumpDuck',
    runMode: 'research',
    studentKey,

    schoolCode: HHA_CTX.schoolCode || '',
    schoolName: HHA_CTX.schoolName || '',
    classRoom: HHA_CTX.classRoom || '',
    studentNo: HHA_CTX.studentNo || '',

    nickName: (elNick?.value || HHA_CTX.nickName || '').trim(),
    gender: (elGender?.value || HHA_CTX.gender || '').trim(),
    age: (elAge?.value || HHA_CTX.age || '').toString().trim(),
    gradeLevel: (elGrade?.value || HHA_CTX.gradeLevel || '').trim(),

    heightCm: (elHeight?.value || HHA_CTX.heightCm || '').toString().trim(),
    weightKg: (elWeight?.value || HHA_CTX.weightKg || '').toString().trim(),

    bmi: calcBMI(elHeight?.value, elWeight?.value) || (HHA_CTX.bmi || ''),
    bmiGroup: HHA_CTX.bmiGroup || '',

    vrExperience: HHA_CTX.vrExperience || '',
    gameFrequency: HHA_CTX.gameFrequency || '',
    handedness: HHA_CTX.handedness || '',
    visionIssue: HHA_CTX.visionIssue || '',
    healthDetail: HHA_CTX.healthDetail || '',
    consentParent: HHA_CTX.consentParent || '',
    consentTeacher: HHA_CTX.consentTeacher || '',

    createdAtIso: nowIso(),
    updatedAtIso: nowIso(),
    source: 'jump-duck-menu'
  };
}

/* -------------------------
   Logging (bulk rows)
------------------------- */
function nowIso(){ try{ return new Date().toISOString(); }catch{ return ''; } }

async function postLogTable(table, rows){
  const url = HHA_CTX.log || '';
  if (!url || !rows || !rows.length) return false;
  try{
    const payload = { _table: table, rows };
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

/* -------------------------
   Boss presets + Skills (deterministic)
------------------------- */
const BOSS_PRESETS = ['classic','memory','twin','trickster'];
const BOSS_SKILLS  = ['reverse','combo_lock','stamina_drain','fake_callout']; // ✅ สนุกขึ้น

function bossPresetFromCtx(){
  const cg = String(HHA_CTX.conditionGroup||'').toLowerCase();
  if (BOSS_PRESETS.includes(cg)) return cg;

  if (cg === 'mix' || cg === 'mixed'){
    const base = `${HHA_CTX.pid||''}|${HHA_CTX.studyId||''}|${HHA_CTX.phase||''}|${HHA_CTX.seed||''}|jumpduck`;
    const h = strToSeed(base);
    return BOSS_PRESETS[h % BOSS_PRESETS.length];
  }
  const h2 = strToSeed(String(HHA_CTX.seed||getSeed()));
  return BOSS_PRESETS[h2 % BOSS_PRESETS.length];
}

function bossSkillFromSeed(){
  const base = `${HHA_CTX.pid||''}|${HHA_CTX.studyId||''}|${HHA_CTX.phase||''}|${HHA_CTX.seed||''}|skill`;
  const h = strToSeed(base);
  return BOSS_SKILLS[h % BOSS_SKILLS.length];
}

/* -------------------------
   Boss system / Rhythm Burst
------------------------- */
const BOSS = {
  hpMax: 100,
  dmgOnHit: 6,
  dmgOnPerfect: 9,
  burstEveryMs: 5200,
  shieldPhaseAtHp: 55,
  tempoShiftEveryMs: 4200
};

const RHY = {
  beatMsBase: 520,
  beatJitter: 70,
  leadBeats: 3,
  chainLenMin: 5,
  chainLenMax: 8
};

function beatMsNow(){
  const j = (RNG()*2 - 1) * RHY.beatJitter;
  const mode = state?.mode || '';
  const cap = (mode==='test'||mode==='research') ? 35 : RHY.beatJitter;
  const jj = Math.max(-cap, Math.min(cap, j));
  return Math.max(380, Math.min(700, RHY.beatMsBase + jj));
}
function showCallout(text){ showJudge(text, 'combo'); }
function needEmoji(need){ return need==='jump' ? '⬆' : '⬇'; }

function buildRhythmSeq(len){
  const patterns = ['abab','aab','mirror','stair','random'];
  const preset = String(state?.bossPresetKey||'').toLowerCase();
  const w = (preset==='trickster')
    ? ['random','random','abab','aab','mirror','stair']
    : patterns;

  const p = w[Math.floor(RNG()*w.length)];
  const a = (RNG()<0.5) ? 'jump' : 'duck';
  const b = (a==='jump') ? 'duck' : 'jump';

  const seq = [];
  if (p === 'abab'){
    for (let i=0;i<len;i++) seq.push(i%2===0 ? a : b);
  } else if (p === 'aab'){
    for (let i=0;i<len;i++) seq.push((i%3===2) ? b : a);
  } else if (p === 'stair'){
    for (let i=0;i<len;i++){
      const block = Math.floor(i/2);
      seq.push(block%2===0 ? a : b);
    }
  } else {
    let last = null, streak = 0;
    for (let i=0;i<len;i++){
      let n = (RNG()<0.5) ? 'jump' : 'duck';
      if (n === last){
        streak++;
        if (streak >= 2) n = (n==='jump')?'duck':'jump';
      } else streak = 0;
      seq.push(n);
      last = n;
    }
  }
  return { pattern:p, seq };
}

function scheduleCalloutAndChain(seqNeed, tag){
  const beat = beatMsNow();
  const lead = RHY.leadBeats;

  for (let i=0;i<lead;i++){
    const n = lead - i;
    setTimeout(()=>{
      if (!running || !state) return;
      playSfx('jd-sfx-beep');
      showCallout(`🎵 ${n}`);
      pushEvent('boss_call_tick', { extra: JSON.stringify({ n, tag }) });
    }, i*beat);
  }

  setTimeout(()=>{
    if (!running || !state) return;
    playSfx('jd-sfx-combo');
    const preview = seqNeed.slice(0,4).map(needEmoji).join(' ');
    showCallout(`GO! ${preview} …`);
    pushEvent('boss_call_go', { extra: JSON.stringify({ len: seqNeed.length, tag }) });
  }, lead*beat);

  const startAt = lead*beat + 80;
  for (let i=0;i<seqNeed.length;i++){
    const need = seqNeed[i];
    setTimeout(()=>{
      if (running && state) makeOne(need==='duck' ? 'high' : 'low', performance.now(), true);
    }, startAt + i*beat);
  }
}

/* -------------------------
   Mini-goals (Phase 3 fun)
------------------------- */
const MINI_GOALS = [
  { key:'perfect3', label:'Perfect x3', desc:'ทำ PERFECT ติดกัน 3 ครั้ง' },
  { key:'switch5',  label:'Switch x5',  desc:'สลับท่า Jump↔Duck 5 ครั้ง' },
  { key:'combo10',  label:'Combo 10',   desc:'ทำคอมโบให้ถึง 10' },
  { key:'noMiss8',  label:'No miss 8',  desc:'ถูก 8 ครั้งติด (ไม่พลาด)' }
];
function pickMiniGoal(seedStr){
  const h = strToSeed(seedStr);
  return MINI_GOALS[h % MINI_GOALS.length];
}

/* -------------------------
   Boss Skills runtime
------------------------- */
function skillLabel(k){
  if (k==='reverse') return 'Reverse';
  if (k==='combo_lock') return 'ComboLock';
  if (k==='stamina_drain') return 'Drain';
  if (k==='fake_callout') return 'Fake';
  return '—';
}
function miniLabel(g){ return g ? g.label : '—'; }

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
  if (progress < 0.33) return 1;
  if (progress < 0.70) return 2;
  return 3;
}

/* -------------------------
   Helpers
------------------------- */
function makeSessionId(){
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}
function median(arr){
  const a = (arr||[]).filter(v=>Number.isFinite(v)).slice().sort((x,y)=>x-y);
  if (!a.length) return 0;
  const m = Math.floor(a.length/2);
  return (a.length%2) ? a[m] : (a[m-1]+a[m])/2;
}
function winFeatures(){
  const w = state.win;
  const n = w.rts.length || 0;
  if (!n){
    return { win_n:0, win_ok_rate:0, win_rt_mean:0, win_rt_sd:0, win_switch_rate:0 };
  }
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

/* -------------------------
   Events + sessions rows (schema)
------------------------- */
function pushEvent(event_type, extra){
  if (!state) return;
  const base = {
    timestampIso: nowIso(),
    projectTag: HHA_CTX.projectTag || 'HeroHealth-JumpDuck',
    runMode: state.mode,
    studyId: state.ctx.studyId || '',
    phase: state.ctx.phase || '',
    conditionGroup: state.ctx.conditionGroup || '',
    sessionId: state.sessionId,

    eventType: event_type,
    gameMode: state.mode,
    diff: state.diffKey,
    timeFromStartMs: Math.round(state.elapsedMs||0),

    studentKey: state.participant?.id || '',
    schoolCode: state.ctx.schoolCode || '',
    classRoom: state.ctx.classRoom || '',
    studentNo: state.ctx.studentNo || '',
    nickName: state.ctx.nickName || ''
  };
  state.events.push(Object.assign(base, extra || {}));
}

function buildRtBreakdown(){
  const rts = state.hitRTs.slice();
  const bins = { '<160':0, '160-220':0, '220-300':0, '300-420':0, '>=420':0 };
  rts.forEach(rt=>{
    if (rt < 160) bins['<160']++;
    else if (rt < 220) bins['160-220']++;
    else if (rt < 300) bins['220-300']++;
    else if (rt < 420) bins['300-420']++;
    else bins['>=420']++;
  });
  return { n:rts.length, bins, median: median(rts), mean: rts.length ? (rts.reduce((a,b)=>a+b,0)/rts.length) : 0 };
}

function buildSessionRow(end_reason){
  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const acc   = total ? hits/total : 0;

  const meanRt = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;
  const medRt  = median(state.hitRTs);

  const fastRate = state.hitRTs.length
    ? (state.hitRTs.filter(rt=>rt<=180).length / state.hitRTs.length)
    : 0;

  const playedSec = (state.elapsedMs||0)/1000;
  const rtBreak = buildRtBreakdown();

  return {
    timestampIso: nowIso(),
    projectTag: HHA_CTX.projectTag || 'HeroHealth-JumpDuck',
    runMode: state.mode,
    studyId: state.ctx.studyId || '',
    phase: state.ctx.phase || '',
    conditionGroup: state.ctx.conditionGroup || '',

    sessionOrder: state.ctx.sessionOrder || '',
    blockLabel: state.ctx.blockLabel || '',
    siteCode: state.ctx.siteCode || '',
    schoolYear: state.ctx.schoolYear || '',
    semester: state.ctx.semester || '',

    sessionId: state.sessionId,

    gameMode: state.mode,
    diff: state.diffKey,
    durationPlannedSec: (state.durationMs||0)/1000,
    durationPlayedSec: +playedSec.toFixed(2),

    scoreFinal: Math.round(state.score||0),
    comboMax: state.maxCombo||0,
    misses: state.miss||0,

    goalsCleared: 0, goalsTotal: 0,
    miniCleared: state.miniDone ? 1 : 0,
    miniTotal: 1,

    nTargetGoodSpawned: total,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,

    nHitGood: hits,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: state.miss,

    accuracyGoodPct: +(acc*100).toFixed(2),
    junkErrorPct: 0,

    avgRtGoodMs: meanRt ? +meanRt.toFixed(1) : 0,
    medianRtGoodMs: medRt ? +medRt.toFixed(1) : 0,
    fastHitRatePct: +(fastRate*100).toFixed(2),

    device: detectDevice(),
    gameVersion: GAME_VERSION,

    reason: end_reason,
    startTimeIso: state.startIso || nowIso(),
    endTimeIso: nowIso(),

    studentKey: state.participant?.id || '',
    schoolCode: state.ctx.schoolCode || '',
    schoolName: state.ctx.schoolName || '',
    classRoom: state.ctx.classRoom || '',
    studentNo: state.ctx.studentNo || '',
    nickName: state.ctx.nickName || '',
    gender: state.ctx.gender || '',
    age: state.ctx.age || '',
    gradeLevel: state.ctx.gradeLevel || '',
    heightCm: state.ctx.heightCm || '',
    weightKg: state.ctx.weightKg || '',
    bmi: state.ctx.bmi || '',
    bmiGroup: state.ctx.bmiGroup || '',
    vrExperience: state.ctx.vrExperience || '',
    gameFrequency: state.ctx.gameFrequency || '',
    handedness: state.ctx.handedness || '',
    visionIssue: state.ctx.visionIssue || '',
    healthDetail: state.ctx.healthDetail || '',
    consentParent: state.ctx.consentParent || '',
    consentTeacher: state.ctx.consentTeacher || '',
    profileSource: state.ctx.profileSource || '',
    surveyKey: state.ctx.surveyKey || '',
    excludeFlag: state.ctx.excludeFlag || '',

    noteResearcher: state.participant?.note || '',
    rtBreakdownJson: JSON.stringify(rtBreak),

    __extraJson: JSON.stringify({
      bossPreset: state.bossPresetKey,
      bossSkill: state.bossSkillKey,
      miniGoal: state.miniGoal?.key || '',
      miniDone: !!state.miniDone,
      bossHpEnd: +state.bossHp.toFixed(1),
      stabilityMin: +state.minStability.toFixed(1),
      win: winFeatures(),
      ai: AI.snapshot()
    })
  };
}

/* -------------------------
   Boss UI helpers
------------------------- */
function telegraphOn(){
  if (!elTele) return;
  elTele.classList.remove('jd-hidden');
  elTele.classList.add('on');
}
function telegraphOff(){
  if (!elTele) return;
  elTele.classList.remove('on');
  setTimeout(()=> elTele && elTele.classList.add('jd-hidden'), 120);
}

/* -------------------------
   Boss enter / update / burst
------------------------- */
function bossEnter(ts){
  state.bossAlive = true;
  state.bossHp = BOSS.hpMax;
  state.bossNextBurstAt = ts + 1200;
  state.bossNextTempoAt = ts + 1400;
  state.bossShieldNeedStreak = 0;
  state.bossShieldStreak = 0;

  // Skill windows
  state.skillNextAt = ts + 1800;
  state.skillUntil = 0;
  state.reverseOn = false;

  bossBarWrap && bossBarWrap.classList.remove('jd-hidden');
  bossStatus && (bossStatus.textContent = 'BOSS!');
  bossStatus && bossStatus.classList.add('on');

  playSfx('jd-sfx-boss');
  pushEvent('boss_enter', { extra: JSON.stringify({ bossHp: state.bossHp, preset: state.bossPresetKey, skill: state.bossSkillKey }) });

  showJudge(`⚡ BOSS! preset=${state.bossPresetKey} skill=${state.bossSkillKey}`, 'combo');
  telegraphOn();
}

function applyBossSkill(ts){
  // only phase3 & boss alive
  if (!state.bossAlive) return;

  // activate new skill window periodically
  if (ts >= state.skillNextAt){
    state.skillNextAt = ts + 5200 + (RNG()*900 - 300);
    state.skillUntil  = ts + 1800 + (RNG()*600);

    if (state.bossSkillKey === 'reverse'){
      state.reverseOn = true;
      showJudge('🌀 REVERSE! (สั่งกลับด้าน)', 'combo');
      pushEvent('skill_on', { extra: JSON.stringify({ skill:'reverse' }) });
    } else if (state.bossSkillKey === 'combo_lock'){
      showJudge('🔒 COMBO LOCK! (ต้อง PERFECT ถึงจะต่อคอมโบ)', 'combo');
      pushEvent('skill_on', { extra: JSON.stringify({ skill:'combo_lock' }) });
    } else if (state.bossSkillKey === 'stamina_drain'){
      showJudge('🧪 DRAIN! (พลาดแล้ว STABILITY ลดแรงขึ้น)', 'combo');
      pushEvent('skill_on', { extra: JSON.stringify({ skill:'stamina_drain' }) });
    } else if (state.bossSkillKey === 'fake_callout'){
      showJudge('🎭 FAKE! (มีหลอก 1 ครั้ง)', 'combo');
      state.fakeArmed = true; // one-time fake
      pushEvent('skill_on', { extra: JSON.stringify({ skill:'fake_callout' }) });
    }
    telegraphOn(); setTimeout(telegraphOff, 550);
  }

  // end window
  if (state.skillUntil && ts >= state.skillUntil){
    if (state.reverseOn){
      state.reverseOn = false;
      pushEvent('skill_off', { extra: JSON.stringify({ skill:'reverse' }) });
    }
    state.skillUntil = 0;
  }
}

function updateBoss(ts, phase){
  if (phase !== 3){
    elHudBoss && (elHudBoss.textContent = '—');
    return;
  }
  if (!state.bossAlive) bossEnter(ts);

  applyBossSkill(ts);

  if (elHudBoss) elHudBoss.textContent = `${Math.max(0, Math.round(state.bossHp))}%`;
  if (bossFill) bossFill.style.transform = `scaleX(${Math.max(0, state.bossHp/BOSS.hpMax).toFixed(3)})`;

  if (ts >= state.bossNextTempoAt){
    state.bossNextTempoAt = ts + BOSS.tempoShiftEveryMs + (RNG()*450 - 200);
    telegraphOn();
    setTimeout(telegraphOff, 600);
    pushEvent('boss_tempo_shift', { extra: JSON.stringify({ preset: state.bossPresetKey }) });
  }

  if (ts >= state.bossNextBurstAt){
    state.bossNextBurstAt = ts + BOSS.burstEveryMs + (RNG()*600 - 240);
    bossBurst();
  }

  if (state.bossHp <= BOSS.shieldPhaseAtHp && state.bossShieldNeedStreak === 0){
    state.bossShieldNeedStreak = 6;
    state.bossShieldStreak = 0;
    pushEvent('boss_shield_start', { extra: JSON.stringify({ need: 6, preset: state.bossPresetKey }) });
    showJudge('🛡️ SHIELD! ต้องถูกติดกัน 6 ครั้ง!', 'combo');
    telegraphOn(); setTimeout(telegraphOff, 700);
  }

  if (state.bossHp <= 0){
    state.bossHp = 0;
    state.bossAlive = false;
    pushEvent('boss_down', { extra: JSON.stringify({ preset: state.bossPresetKey }) });
    showJudge('🏆 BOSS DOWN!', 'combo');
    endGame('boss-down');
  }
}

function bossBurst(){
  telegraphOn();
  setTimeout(telegraphOff, 650);
  pushEvent('boss_burst', { extra: JSON.stringify({ preset: state.bossPresetKey, skill: state.bossSkillKey }) });

  const preset = String(state?.bossPresetKey||'classic').toLowerCase();
  const diff = String(state?.diffKey||'normal').toLowerCase();

  let len = RHY.chainLenMin + Math.floor(RNG()*(RHY.chainLenMax - RHY.chainLenMin + 1));
  if (preset === 'memory') len += 1;
  else if (preset === 'twin') len += 2;
  else if (preset === 'trickster') len += 2;

  if (diff === 'hard') len += 1;
  if (diff === 'easy') len -= 1;

  len = Math.max(5, Math.min(9, len));
  if (state.mode === 'test' || state.mode === 'research') len = Math.min(len, 7);

  const built = buildRhythmSeq(len);
  const seqNeed = built.seq.slice();
  let tag = `p:${built.pattern}`;

  if (preset === 'trickster'){
    tag += '|feint';
    const i = 3 + Math.floor(RNG()*Math.max(1, seqNeed.length-4));
    seqNeed[i] = (seqNeed[i]==='jump') ? 'duck' : 'jump';
  }
  if (preset === 'twin'){
    tag += '|twin';
    const i = 2 + Math.floor(RNG()*Math.max(1, seqNeed.length-3));
    seqNeed.splice(i, 0, seqNeed[i]);
    while ((state.mode==='test'||state.mode==='research') ? (seqNeed.length>7) : (seqNeed.length>9)) seqNeed.pop();
  }

  scheduleCalloutAndChain(seqNeed, tag);
  showJudge('🎵 RHYTHM BURST!', 'combo');
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
      showJudge('FEVER จบแล้ว!', 'ok');
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
    pushEvent('fever_start', {});
  }
}

/* -------------------------
   Mini-goals runtime
------------------------- */
function initMiniGoal(){
  const seedStr = `${HHA_CTX.pid||''}|${HHA_CTX.studyId||''}|${HHA_CTX.phase||''}|${HHA_CTX.seed||''}|mini`;
  state.miniGoal = pickMiniGoal(seedStr);
  state.miniDone = false;
  state.perfectStreak = 0;
  state.noMissStreak = 0;
  state.switchCount = 0;
  state.lastNeedForSwitch = null;
  if (elHudMini) elHudMini.textContent = miniLabel(state.miniGoal);
  pushEvent('mini_start', { extra: JSON.stringify({ mini: state.miniGoal.key }) });
  showJudge(`🎯 MINI: ${state.miniGoal.desc}`, 'ok');
}

function updateMiniOnHit(need, perfect){
  if (!state.miniGoal || state.miniDone) return;

  // track switch
  if (state.lastNeedForSwitch && state.lastNeedForSwitch !== need) state.switchCount++;
  state.lastNeedForSwitch = need;

  // track streaks
  state.noMissStreak++;
  state.perfectStreak = perfect ? (state.perfectStreak + 1) : 0;

  if (state.miniGoal.key === 'perfect3' && state.perfectStreak >= 3) state.miniDone = true;
  if (state.miniGoal.key === 'switch5' && state.switchCount >= 5) state.miniDone = true;
  if (state.miniGoal.key === 'combo10' && state.maxCombo >= 10) state.miniDone = true;
  if (state.miniGoal.key === 'noMiss8' && state.noMissStreak >= 8) state.miniDone = true;

  if (state.miniDone){
    showJudge('✅ MINI GOAL CLEARED! +BONUS', 'combo');
    state.score += 120;
    pushEvent('mini_clear', { extra: JSON.stringify({ mini: state.miniGoal.key }) });
    if (elHudMini) elHudMini.textContent = state.miniGoal.label + ' ✅';
  }
}

function updateMiniOnMiss(){
  if (!state.miniGoal || state.miniDone) return;
  state.noMissStreak = 0;
  state.perfectStreak = 0;
}

/* -------------------------
   Game start / end
------------------------- */
function startGameBase(opts){
  const mode = opts.mode || 'training';
  const diffKey = opts.diffKey || 'normal';
  const cfg0 = JD_DIFFS[diffKey] || JD_DIFFS.normal;
  const durationMs = opts.durationMs ?? 60000;
  const isTutorial = !!opts.isTutorial;

  RNG = mulberry32(getSeed());

  const now = performance.now();
  state = {
    sessionId: makeSessionId(),
    mode,
    diffKey,
    cfg0,
    durationMs,
    isTutorial,

    startTime: now,
    startIso: nowIso(),
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

    bossHp: BOSS.hpMax,
    bossAlive: false,
    bossNextBurstAt: now + 5200,
    bossNextTempoAt: now + 4200,
    bossShieldNeedStreak: 0,
    bossShieldStreak: 0,

    bossPresetKey: bossPresetFromCtx(),
    bossSkillKey: bossSkillFromSeed(),
    skillNextAt: 0,
    skillUntil: 0,
    reverseOn: false,
    fakeArmed: false,

    participant: collectParticipant(mode),
    ctx: { ...HHA_CTX },

    events: [],
    sessions: [],

    win: { size: 10, rts: [], ok: [], need: [], action: [], timeMs: [] },

    miniGoal: null,
    miniDone: false,
    perfectStreak: 0,
    noMissStreak: 0,
    switchCount: 0,
    lastNeedForSwitch: null,
  };

  initMiniGoal();

  running = true;
  lastFrame = now;

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
  elHudSkill && (elHudSkill.textContent = skillLabel(state.bossSkillKey));
  elHudMini && (elHudMini.textContent = miniLabel(state.miniGoal));

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

  pushEvent('start', { extra: JSON.stringify({ bossPreset: state.bossPresetKey, bossSkill: state.bossSkillKey, mini: state.miniGoal.key, device: detectDevice(), gameVersion: GAME_VERSION }) });

  showView('play');
  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  showJudge(isTutorial ? 'Tutorial: Low=JUMP 🦘 · High=DUCK 🛡️' : `READY ✨`, 'ok');
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

  const ses = buildSessionRow(reason);
  state.sessions.push(ses);

  if (HHA_CTX.log){
    await postLogTable('events', state.events);
    await postLogTable('sessions', state.sessions);
  }

  if (state.isTutorial){
    showJudge('จบ Tutorial แล้ว! 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  const total = state.obstaclesSpawned || 0;
  const hits  = state.hits || 0;
  const acc   = total ? hits/total : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

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
    if (acc >= 0.90 && state.minStability >= 85) rank='S';
    else if (acc >= 0.80 && state.minStability >= 75) rank='A';
    else if (acc >= 0.65 && state.minStability >= 60) rank='B';
    else if (acc < 0.40 || state.minStability < 40)   rank='D';
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

  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts, phase);

    let interval = state.cfg0.spawnMs;
    if (state.mode === 'training'){
      const factor = 1 - 0.30*progress;
      interval = interval * Math.max(0.58, factor);
      interval = AI.adjustSpawnInterval(interval, phase, state.mode);
    } else {
      interval = Math.max(650, Math.min(1400, interval));
    }
    state.nextSpawnAt += interval;
  }

  updateObstacles(dt, ts, phase, progress);

  elHudStab && (elHudStab.textContent = state.stability.toFixed(1)+'%');
  elHudObs  && (elHudObs.textContent  = `${state.hits} / ${state.obstaclesSpawned}`);
  elHudScore&& (elHudScore.textContent= String(Math.round(state.score)));
  elHudCombo&& (elHudCombo.textContent= String(state.combo));

  // show skill/mini in topbar
  elHudSkill && (elHudSkill.textContent = skillLabel(state.bossSkillKey) + (state.reverseOn ? '🌀' : ''));
  elHudMini && (elHudMini.textContent = state.miniGoal ? (state.miniDone ? (state.miniGoal.label+' ✅') : state.miniGoal.label) : '—');

  const tip = AI.getHint();
  if (tip && phase === 2 && (state.elapsedMs % 7000 < 25)) showJudge(tip, 'combo');

  rafId = requestAnimationFrame(loop);
}

/* -------------------------
   Obstacles + scoring
------------------------- */
function spawnObstacle(ts, phase){
  if (!elObsHost || !state) return;
  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 70) return;

  const r = RNG();
  const type = AI.pickType(r);

  const spawnPair = (phase === 3 && state.mode === 'training' && RNG() < 0.12);
  makeOne(type, ts, false);
  if (spawnPair){
    setTimeout(()=> { if (running && state) makeOne(RNG()<0.5?'high':'low', performance.now(), false); }, 140);
  }
}

function makeOne(type, ts, isBoss){
  const isHigh = (type === 'high');
  const need = isHigh ? 'duck' : 'jump';

  const el = document.createElement('div');
  el.className = 'jd-obstacle ' + (isHigh ? 'jd-obstacle--high' : 'jd-obstacle--low');
  el.dataset.id = String(nextObstacleId);

  const inner = document.createElement('div');
  inner.className = 'jd-obstacle-inner';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'jd-obs-icon';
  iconSpan.textContent = isHigh ? '⬇' : '⬆';

  const tagSpan = document.createElement('span');
  tagSpan.className = 'jd-obs-tag';
  tagSpan.textContent = isHigh ? 'DUCK' : 'JUMP';

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
    isBoss: !!isBoss
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
  } else {
    speed *= (phase === 3 ? 1.10 : 1.0);
  }

  const move = speed * (dt/1000);
  const keep = [];

  for (const obs of state.obstacles){
    obs.x -= move;
    if (obs.element) obs.element.style.left = obs.x + '%';

    // check hit window near CENTER
    if (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6){
      const a = lastAction;
      if (a && a.time){
        const rt = Math.abs(a.time - now);
        const perfect = rt <= (cfg.hitWinMs * 0.55);

        // apply Reverse skill (flip needed)
        let need = obs.need;
        if (phase === 3 && state.reverseOn) need = (need==='jump')?'duck':'jump';

        // fake callout: one time misleading feedback (does not change rule)
        if (phase === 3 && state.bossSkillKey==='fake_callout' && state.fakeArmed && rt <= cfg.hitWinMs){
          state.fakeArmed = false;
          showJudge('🎭 หลอก! อย่าเชื่อป้ายครั้งเดียว!', 'combo');
          pushEvent('skill_fake_used', { extra: JSON.stringify({ at: Math.round(state.elapsedMs) }) });
        }

        // correct
        if (a.type === need && rt <= cfg.hitWinMs){
          obs.resolved = true;

          state.hits++;

          // combo lock: only perfect can increase combo
          if (phase === 3 && state.bossSkillKey==='combo_lock' && !perfect){
            // keep combo (no increase)
          }else{
            state.combo++;
          }
          state.maxCombo = Math.max(state.maxCombo, state.combo);

          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const phaseM = (phase === 3) ? 1.18 : (phase === 2 ? 1.08 : 1.0);
          const feverM = state.feverActive ? 1.35 : 1.0;
          const perfM  = perfect ? 1.15 : 1.0;
          const gain = Math.round(cfg.score * comboM * phaseM * feverM * perfM);
          state.score += gain;

          if (phase === 3 && state.bossAlive){
            let dmg = perfect ? BOSS.dmgOnPerfect : BOSS.dmgOnHit;
            dmg *= (state.feverActive ? 1.2 : 1.0);
            state.bossHp = Math.max(0, state.bossHp - dmg);

            if (state.bossShieldNeedStreak > 0){
              state.bossShieldStreak++;
              if (state.bossShieldStreak >= state.bossShieldNeedStreak){
                state.bossShieldNeedStreak = 0;
                state.bossShieldStreak = 0;
                state.bossHp = Math.max(0, state.bossHp - 14);
                showJudge('💥 SHIELD BREAK!', 'combo');
                pushEvent('boss_shield_break', {});
              }
            }
          }

          if (obs.need === 'jump') state.jumpHit++; else state.duckHit++;
          state.stability = Math.min(100, state.stability + cfg.stabGain);
          state.minStability = Math.min(state.minStability, state.stability);

          state.hitRTs.push(rt);
          feverGainOnHit();

          AI.onOutcome(need, true, rt);

          obs.element && obs.element.remove();
          obs.element = null;

          playSfx('jd-sfx-hit');
          if (state.combo >= 8) playSfx('jd-sfx-combo');

          const msg = perfect ? 'PERFECT! ⚡' : 'OK! ✨';
          showJudge(msg, (state.combo>=8 || perfect) ? 'combo' : 'ok');

          pushWinSample({ time_ms: Math.round(state.elapsedMs), need, action: a.type, ok: 1, rt_ms: Math.round(rt) });
          updateMiniOnHit(need, perfect);

          pushEvent('hit', Object.assign({
            targetId: String(obs.id),
            emoji: (need === 'jump') ? '⬆' : '⬇',
            itemType: obs.type,
            lane: (need === 'jump') ? 'top' : 'bottom',
            rtMs: Math.round(rt),
            judgment: perfect ? 'perfect' : 'ok',
            totalScore: Math.round(state.score),
            combo: state.combo,
            isGood: 1,
            feverState: state.feverActive ? 'on' : 'off',
            feverValue: +state.fever.toFixed(1),
            goalProgress: '',
            miniProgress: state.miniGoal ? `${state.miniGoal.key}:${state.miniDone?1:0}` : '',
            extra: JSON.stringify({ bossHp: +state.bossHp.toFixed(1), bossPreset: state.bossPresetKey, bossSkill: state.bossSkillKey, reverseOn: !!state.reverseOn }),
          }, winFeatures(), AI.snapshot()));

          continue;
        }

        // wrong action
        if (rt <= cfg.hitWinMs && a.type !== need){
          obs.resolved = true;

          state.miss++;
          state.combo = 0;
          if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;

          const dmg = (phase === 3 && state.bossSkillKey==='stamina_drain') ? (cfg.stabDmg * 1.4) : cfg.stabDmg;
          state.stability = Math.max(0, state.stability - dmg);
          state.minStability = Math.min(state.minStability, state.stability);

          AI.onOutcome(need, false, rt);
          if (phase === 3 && state.bossShieldNeedStreak > 0) state.bossShieldStreak = 0;

          obs.element && obs.element.remove();
          obs.element = null;

          playSfx('jd-sfx-miss');
          showJudge('ผิดท่า! 🌀', 'miss');
          elPlayArea?.classList.add('shake');
          setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);

          pushWinSample({ time_ms: Math.round(state.elapsedMs), need, action: a.type, ok: 0, rt_ms: Math.round(rt) });
          updateMiniOnMiss();

          pushEvent('miss', Object.assign({
            targetId: String(obs.id),
            emoji: (need === 'jump') ? '⬆' : '⬇',
            itemType: obs.type,
            lane: (need === 'jump') ? 'top' : 'bottom',
            rtMs: Math.round(rt),
            judgment: 'wrong',
            totalScore: Math.round(state.score),
            combo: 0,
            isGood: 0,
            feverState: state.feverActive ? 'on' : 'off',
            feverValue: +state.fever.toFixed(1),
            extra: JSON.stringify({ reason:'wrong-action', bossSkill: state.bossSkillKey, reverseOn: !!state.reverseOn })
          }, winFeatures(), AI.snapshot()));

          continue;
        }
      }
    }

    // late miss
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;

      state.miss++;
      state.combo = 0;
      if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;

      const dmg = (phase === 3 && state.bossSkillKey==='stamina_drain') ? (cfg.stabDmg * 1.4) : cfg.stabDmg;
      state.stability = Math.max(0, state.stability - dmg);
      state.minStability = Math.min(state.minStability, state.stability);

      AI.onOutcome(obs.need, false, NaN);
      if (phase === 3 && state.bossShieldNeedStreak > 0) state.bossShieldStreak = 0;

      obs.element && obs.element.remove();
      obs.element = null;

      playSfx('jd-sfx-miss');
      showJudge('MISS ลองใหม่ ✨', 'miss');
      elPlayArea?.classList.add('shake');
      setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);

      pushWinSample({ time_ms: Math.round(state.elapsedMs), need: obs.need, action: lastAction ? lastAction.type : '', ok: 0, rt_ms: '' });
      updateMiniOnMiss();

      pushEvent('miss', Object.assign({
        targetId: String(obs.id),
        emoji: (obs.need === 'jump') ? '⬆' : '⬇',
        itemType: obs.type,
        lane: (obs.need === 'jump') ? 'top' : 'bottom',
        rtMs: '',
        judgment: 'late',
        totalScore: Math.round(state.score),
        combo: 0,
        isGood: 0,
        feverState: state.feverActive ? 'on' : 'off',
        feverValue: +state.fever.toFixed(1),
        extra: JSON.stringify({ reason:'late-no-action', bossSkill: state.bossSkillKey })
      }, winFeatures(), AI.snapshot()));

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
  if (ev.code === 'ArrowUp' || ev.code === 'KeyW'){ ev.preventDefault(); triggerAction('jump'); }
  else if (ev.code === 'ArrowDown' || ev.code === 'KeyS'){ ev.preventDefault(); triggerAction('duck'); }
}
function handlePointerDown(ev){
  if (!running || !elPlayArea) return;
  const rect = elPlayArea.getBoundingClientRect();
  const mid = rect.top + rect.height/2;
  if (ev.clientY < mid) triggerAction('jump');
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
   Save profile
------------------------- */
async function saveProfile(){
  if (!HHA_CTX.log){
    setStatus(elProfileStatus, '⚠ ไม่มี ?log= (ยังไม่ใส่ Web App URL)', 'bad');
    return;
  }
  const row = buildProfileRow();
  if (!row.studentKey){
    setStatus(elProfileStatus, '⚠ กรุณาใส่ Participant ID (studentKey)', 'bad');
    return;
  }
  setStatus(elProfileStatus, '⏳ กำลังบันทึก...', '');
  const ok = await postLogTable('students-profile', [row]);
  setStatus(elProfileStatus, ok ? '✅ บันทึกแล้ว' : '❌ บันทึกไม่สำเร็จ', ok ? 'ok' : 'bad');
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

  // populate profile (optional)
  if (elNick && HHA_CTX.nickName) elNick.value = HHA_CTX.nickName;
  if (elGender && HHA_CTX.gender) elGender.value = HHA_CTX.gender;
  if (elAge && HHA_CTX.age) elAge.value = HHA_CTX.age;
  if (elGrade && HHA_CTX.gradeLevel) elGrade.value = HHA_CTX.gradeLevel;
  if (elHeight && HHA_CTX.heightCm) elHeight.value = HHA_CTX.heightCm;
  if (elWeight && HHA_CTX.weightKg) elWeight.value = HHA_CTX.weightKg;

  elMode?.addEventListener('change', updateResearchVisibility);
  updateResearchVisibility();

  $('[data-action="start"]')?.addEventListener('click', startGameFromMenu);
  $('[data-action="tutorial"]')?.addEventListener('click', startTutorial);
  $('[data-action="stop-early"]')?.addEventListener('click', ()=> running && endGame('stop-early'));
  $('[data-action="play-again"]')?.addEventListener('click', startGameFromMenu);
  $$('[data-action="back-menu"]').forEach(btn=> btn.addEventListener('click', ()=> showView('menu')));

  $('[data-action="jump"]')?.addEventListener('click', ()=> triggerAction('jump'));
  $('[data-action="duck"]')?.addEventListener('click', ()=> triggerAction('duck'));

  $('[data-action="save-profile"]')?.addEventListener('click', saveProfile);

  window.addEventListener('keydown', handleKeyDown, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false});

  await ensureVrUi();
  window.addEventListener('hha:shoot', onHhaShoot);

  showView('menu');
}

window.addEventListener('DOMContentLoaded', initJD);