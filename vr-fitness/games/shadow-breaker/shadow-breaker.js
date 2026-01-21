// === VR Fitness — Shadow Breaker (Production v1.1.0) ===
// ✅ HeroHealth-like: hha:shoot support (crosshair/tap-to-shoot via vr-ui.js)
// ✅ HHA events: hha:start / hha:time / hha:score / hha:end / hha:flush / hha:coach
// ✅ Boss HUD bar + safe spawn + feedback fixed
// ✅ Deterministic Seeded RNG (research) + AI Pattern (A+B+C) + AI Difficulty Director (fair)
// ✅ Anti-overlap spawn + device target cap
// ✅ AI report summary + local CSV sessions
// ✅ Pass-through: hub/view/seed/research/studyId/log etc.

const SB_GAME_ID = 'shadow-breaker';
const SB_GAME_VERSION = '1.1.0-prod';

const SB_STORAGE_KEY = 'ShadowBreakerSessions_v1';
const SB_META_KEY    = 'ShadowBreakerMeta_v1';

function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }

const sbPhase = (qs('phase','train')||'train').toLowerCase();
const sbMode  = (qs('mode','timed')||'timed').toLowerCase();
const sbDiff  = (qs('diff','normal')||'normal').toLowerCase();
const sbTimeSec = (()=>{ const t=parseInt(qs('time','60'),10); return (Number.isFinite(t)&&t>=20&&t<=300)?t:60; })();

const SB_SEED = (qs('seed','')||'').trim();
const SB_IS_RESEARCH = (()=> {
  const r = (qs('research','')||'').toLowerCase();
  return r==='1' || r==='true' || r==='on' || !!qs('studyId','') || !!qs('log','');
})();

// =======================================================
// PACK 15A — Seeded RNG (deterministic in research)
// =======================================================
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= (h >>> 16);
    return h >>> 0;
  };
}
function mulberry32(a){
  return function(){
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SB_SEED_STR = (SB_SEED && SB_SEED.length) ? SB_SEED : String(Date.now());
const sbSeedHash = xmur3(SB_SEED_STR)();
const sbRand = (SB_IS_RESEARCH ? mulberry32(sbSeedHash) : Math.random);

function sbRng(){ return (typeof sbRand === 'function') ? sbRand() : Math.random(); }
function sbPick(arr){ return arr[Math.floor(sbRng()*arr.length)]; }

// =======================================================
// DOM
// =======================================================
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

// =======================================================
// Helpers
// =======================================================
function sbEmit(name, detail = {}){ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){} }
function clamp(n,a,b){ n=+n; if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b,n)); }
function sbNowIso(){ try{ return new Date().toISOString(); }catch{ return ''; } }

function sbEvPush(rec){
  // optional: plug-in to your global event logger if exists
  // but keep local minimal
  try{
    if(!window.__SB_EVENTS__) window.__SB_EVENTS__ = [];
    window.__SB_EVENTS__.push(rec);
    if(window.__SB_EVENTS__.length > 1200) window.__SB_EVENTS__.shift();
  }catch(_){}
}

// =======================================================
// Device detect + cap
// =======================================================
function sbDetectDevice() {
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vrHeadset';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'pc';
}
function sbDeviceCap(){
  const dev = sbDetectDevice();
  if (dev === 'mobile') return 9;
  if (dev === 'vrHeadset') return 10;
  return 12;
}

// =======================================================
// Config
// =======================================================
const sbDiffCfg = {
  easy:   { spawnMs: 900, bossHp: 6 },
  normal: { spawnMs: 700, bossHp: 9 },
  hard:   { spawnMs: 520, bossHp: 12 },
};
const sbCfg = sbDiffCfg[sbDiff] || sbDiffCfg.normal;

// =======================================================
// Boss & emojis
// =======================================================
const SB_NORMAL_EMOJIS = ['🎯','💥','⭐','⚡','🔥','🥎','🌀'];
const SB_BOSSES = [
  { id: 1, emoji:'💧', nameTh:'Bubble Glove',  nameEn:'Bubble Glove',  hpBonus:0 },
  { id: 2, emoji:'⛈️', nameTh:'Storm Knuckle', nameEn:'Storm Knuckle', hpBonus:2 },
  { id: 3, emoji:'🥊', nameTh:'Iron Fist',     nameEn:'Iron Fist',     hpBonus:4 },
  { id: 4, emoji:'🐲', nameTh:'Golden Dragon', nameEn:'Golden Dragon', hpBonus:6 },
];

// =======================================================
// i18n
// =======================================================
const sbI18n = {
  th: {
    startLabel:'เริ่มเล่น',
    coachReady:'โค้ชพุ่ง: เล็งกลางจอแล้วแตะ/ยิงให้โดน! 👊',
    coachGood:'สวยมาก! ต่อคอมโบยาว ๆ ✨',
    coachMiss:'พลาดนิดเดียว ไม่เป็นไร 💪',
    coachFever:'FEVER!! ทุบให้สุด!! 🔥',
    tagGoal:'เป้าหมาย: ต่อย/ยิงเป้า emoji ให้ทันเวลา รักษาคอมโบ และพิชิตบอสทั้ง 4 ตัว.',
    alertMeta:'กรุณากรอกอย่างน้อย Student ID ก่อนเริ่มเล่นนะครับ',
    feverLabel:'FEVER!!',
    bossNear:(name)=>`ใกล้ล้ม ${name} แล้ว! เร่งอีกนิด! ⚡`,
    bossClear:(name)=>`พิชิต ${name} แล้ว! บอสถัดไปมา! 🔥`,
    bossAppear:(name)=>`${name} ปรากฏตัวแล้ว!`,
    paused:'พักเกม',
    resumed:'กลับมาเล่นต่อ',
  },
  en: {
    startLabel:'Start',
    coachReady:'Aim center and tap/shoot targets! 👊',
    coachGood:'Nice! Keep the combo! ✨',
    coachMiss:'Missed a bit. Try again! 💪',
    coachFever:'FEVER!! Smash!! 🔥',
    tagGoal:'Goal: hit emoji targets quickly, keep combo, defeat all bosses.',
    alertMeta:'Please fill at least the Student ID before starting.',
    feverLabel:'FEVER!!',
    bossNear:(name)=>`Almost defeat ${name}! Finish it! ⚡`,
    bossClear:(name)=>`You beat ${name}! Next boss! 🔥`,
    bossAppear:(name)=>`${name} appeared!`,
    paused:'Paused',
    resumed:'Resumed',
  }
};
let sbLang = 'th';

// =======================================================
// AI Core (A+B+C): prediction + pattern + director
// =======================================================
const SB_AI = {
  enabled: true,
  // hard off in research? -> keep ON but deterministic via seed
  allowAdaptiveInResearch: true
};

// skill stats (online)
const sbSkill = {
  // rolling
  accuracy: 0.5,
  speed: 0.5, // 0..1 (faster = higher)
  rtMs: 800,
  streak: 0,
  lastHitAt: 0,
  lastTouchAt: 0
};

// AI prediction state
const sbAI = {
  riskMiss2s: 0.0,   // 0..1
  frustration: 0.0,  // 0..1
  fatigue: 0.0,      // 0..1
};

// pattern director
const SB_PATTERNS = [
  { id:'centerPulse', durMs: 11000, weight: 1.0 },
  { id:'corners',     durMs:  9000, weight: 0.8 },
  { id:'zigzag',      durMs:  9000, weight: 0.9 },
  { id:'ring',        durMs: 12000, weight: 0.7 },
  { id:'swarm',       durMs:  7000, weight: 0.6 },
  { id:'fakeouts',    durMs: 10000, weight: 0.8 },
  { id:'bossEscort',  durMs:  9000, weight: 0.7 },
];

const sbPatternState = {
  active: null,     // {id, endAt}
  lastId: null,
};

function sbPickNextPattern(){
  // higher risk -> choose gentler patterns
  const r = clamp(sbAI.riskMiss2s || 0, 0, 1);
  const pool = [];
  for(const p of SB_PATTERNS){
    let w = p.weight;
    if (r > 0.65){
      if (p.id==='swarm' || p.id==='fakeouts') w *= 0.35;
      if (p.id==='centerPulse' || p.id==='ring') w *= 1.15;
    } else if (r < 0.25){
      if (p.id==='swarm' || p.id==='fakeouts') w *= 1.25;
      if (p.id==='ring') w *= 0.85;
    }
    if (p.id === sbPatternState.lastId) w *= 0.55; // avoid repeats
    const n = Math.max(1, Math.round(w*10));
    for(let i=0;i<n;i++) pool.push(p);
  }
  return pool.length ? pool[Math.floor(sbRng()*pool.length)] : SB_PATTERNS[0];
}

function sbEnsurePattern(now){
  if(!SB_AI.enabled) return;
  if(sbMode==='endless' || sbTimeSec>=45){
    if(!sbPatternState.active || now >= sbPatternState.active.endAt){
      const p = sbPickNextPattern();
      sbPatternState.active = { id: p.id, endAt: now + p.durMs };
      sbPatternState.lastId = p.id;
      // report
      sbReport.patterns.push({ tSec: Math.floor(sbState.elapsedMs/1000), id: p.id });
      sbEvPush({ t: sbNowIso(), kind:'ai_pattern', sessionId: sbState.sessionId, id:p.id });
      sbEmit('hha:coach', { text: `[Pattern] ${p.id}`, pattern: p.id });
    }
  }
}

// ===== Difficulty Director (PACK 15B) =====
const sbDD = {
  enabled: true,
  spawnMsBase: sbCfg.spawnMs,
  lifeMsBase:  { normal: 2300, boss: 6500 },
  sizeBase:    { normal: 56, boss: 90 },
  spawnMs: sbCfg.spawnMs,
  lifeMsN: 2300,
  lifeMsB: 6500,
  sizeN: 56,
  sizeB: 90,
  lastUpdateAt: 0
};

function sbUpdateAIFromSignals(now){
  // compute risk/frustration/fatigue cheaply from recent play
  const alive = sbState.targets.filter(t=>t.alive).length;
  const missRate = sbState.hit + sbState.miss > 0 ? sbState.miss/(sbState.hit+sbState.miss) : 0.2;
  const idleMs = now - (sbSkill.lastTouchAt || now);
  const idleRisk = clamp((idleMs - 450) / 1400, 0, 1); // no action -> risk rises

  // riskMiss2s : blend of idle + miss trend + clutter
  const clutter = clamp((alive - (sbDeviceCap()*0.6)) / (sbDeviceCap()*0.6), 0, 1);
  sbAI.riskMiss2s = clamp(idleRisk*0.45 + missRate*0.35 + clutter*0.20, 0, 1);

  // frustration: consecutive misses + risk
  sbAI.frustration = clamp((sbState.combo===0 ? 0.35 : 0) + sbAI.riskMiss2s*0.55, 0, 1);

  // fatigue: long play + fever usage
  const tSec = Math.floor(sbState.elapsedMs/1000);
  sbAI.fatigue = clamp((tSec/120)*0.6 + (sbState.fever?0.25:0), 0, 1);
}

function sbDifficultyTick(now){
  if(!SB_AI.enabled || !sbDD.enabled) return;
  if(!SB_AI.allowAdaptiveInResearch && SB_IS_RESEARCH) return;
  if(now - sbDD.lastUpdateAt < 1200) return;

  const risk = clamp(sbAI.riskMiss2s || 0, 0, 1);
  const acc  = clamp(sbSkill.accuracy || 0.5, 0, 1);
  const spd  = clamp(sbSkill.speed || 0.5, 0, 1);
  const skill = clamp((acc*0.55 + spd*0.45), 0, 1);
  const chall = clamp(skill*0.85 + (1-risk)*0.15, 0, 1);

  const base = sbDD.spawnMsBase;
  const spawnWant = Math.round(clamp(base * (1.15 - chall*0.55), 380, 980));
  const lifeNWant = Math.round(clamp(sbDD.lifeMsBase.normal * (1.10 - chall*0.35), 1500, 2600));
  const lifeBWant = Math.round(clamp(sbDD.lifeMsBase.boss   * (1.10 - chall*0.25), 5200, 7600));
  const sizeNWant = Math.round(clamp(sbDD.sizeBase.normal * (1.05 - chall*0.12), 46, 62));
  const sizeBWant = Math.round(clamp(sbDD.sizeBase.boss   * (1.05 - chall*0.10), 78, 98));

  const a = 0.28;
  sbDD.spawnMs = Math.round(sbDD.spawnMs*(1-a) + spawnWant*a);
  sbDD.lifeMsN = Math.round(sbDD.lifeMsN*(1-a) + lifeNWant*a);
  sbDD.lifeMsB = Math.round(sbDD.lifeMsB*(1-a) + lifeBWant*a);
  sbDD.sizeN   = Math.round(sbDD.sizeN*(1-a) + sizeNWant*a);
  sbDD.sizeB   = Math.round(sbDD.sizeB*(1-a) + sizeBWant*a);

  sbDD.lastUpdateAt = now;

  sbEvPush({ t: sbNowIso(), kind:'ai_dd', sessionId: sbState.sessionId,
    risk, skill, chall,
    spawnMs: sbDD.spawnMs, lifeN: sbDD.lifeMsN, lifeB: sbDD.lifeMsB, sizeN: sbDD.sizeN, sizeB: sbDD.sizeB
  });
}

// =======================================================
// Report (PACK 15F)
// =======================================================
const sbReport = {
  riskSeries: [],
  missionClears: 0,
  patterns: [],
};
function sbReportTick(now){
  if(!SB_AI.enabled || !sbState.running) return;
  const tSec = Math.floor(sbState.elapsedMs/1000);
  if(sbReport.riskSeries.length && sbReport.riskSeries[sbReport.riskSeries.length-1].tSec === tSec) return;
  sbReport.riskSeries.push({ tSec, risk: clamp(sbAI.riskMiss2s||0, 0, 1) });
  if(sbReport.riskSeries.length > 240) sbReport.riskSeries.shift();
}
function sbReportReset(){
  sbReport.riskSeries = [];
  sbReport.missionClears = 0;
  sbReport.patterns = [];
}

// =======================================================
// Meta persistence
// =======================================================
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
  });
});

// =======================================================
// State
// =======================================================
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

  // missions
  mission:null, // {id,goal,value,doneAt}
};

// =======================================================
// Feedback
// =======================================================
function sbShowFeedback(type){
  if(!sbFeedbackEl) return;
  const t = sbI18n[sbLang];
  let txt='';
  if(type==='fever') txt = t.feverLabel;
  else if(type==='perfect') txt = (sbLang==='th'?'Perfect! 💥':'PERFECT!');
  else if(type==='good') txt = (sbLang==='th'?'ดีมาก! ✨':'GOOD!');
  else txt = (sbLang==='th'?'พลาด!':'MISS');

  sbFeedbackEl.textContent = txt;

  // Ensure classes match your CSS:
  // .feedback-perfect / .feedback-good / .feedback-miss / .feedback-fever + .show
  sbFeedbackEl.className = 'feedback';
  if(type==='fever') sbFeedbackEl.classList.add('feedback-fever');
  if(type==='perfect') sbFeedbackEl.classList.add('feedback-perfect');
  if(type==='good') sbFeedbackEl.classList.add('feedback-good');
  if(type==='miss') sbFeedbackEl.classList.add('feedback-miss');

  sbFeedbackEl.style.display = 'block';
  sbFeedbackEl.classList.add('show');

  setTimeout(()=>{
    if(!sbFeedbackEl) return;
    sbFeedbackEl.classList.remove('show');
    setTimeout(()=>{ if(sbFeedbackEl) sbFeedbackEl.style.display='none'; }, 130);
  }, type==='fever'?800:420);
}

// =======================================================
// Boss HUD
// =======================================================
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

// =======================================================
// Missions (mini-quests)
// =======================================================
const SB_MISSIONS = [
  { id:'combo7',  type:'combo', goal: 7,  titleTh:'ทำคอมโบให้ถึง x7', titleEn:'Reach combo x7' },
  { id:'perfect5',type:'perfect',goal: 5, titleTh:'Perfect 5 ครั้ง',  titleEn:'Perfect x5' },
  { id:'score800',type:'score',  goal: 800,titleTh:'ทำคะแนนให้ถึง 800',titleEn:'Score 800+' },
  { id:'boss1',   type:'boss',   goal: 1,  titleTh:'ชนะบอส 1 ตัว',     titleEn:'Defeat 1 boss' },
];

function sbMissionPick(){
  const m = SB_MISSIONS[Math.floor(sbRng()*SB_MISSIONS.length)];
  return { id:m.id, type:m.type, goal:m.goal, value:0, doneAt:0 };
}
function sbMissionReset(){
  sbState.mission = sbMissionPick();
  sbEvPush({ t: sbNowIso(), kind:'mission_start', sessionId: sbState.sessionId, missionId: sbState.mission.id });
  sbEmit('quest:update', { mission: sbState.mission });
}
function sbMissionUpdate(){
  const m = sbState.mission;
  if(!m || m.doneAt) return;

  if(m.type==='combo') m.value = sbState.maxCombo;
  if(m.type==='perfect') m.value = sbState.perfect;
  if(m.type==='score') m.value = sbState.score;
  if(m.type==='boss') m.value = sbReport.missionClears; // reuse as boss clears counter in this file

  if(m.value >= m.goal){
    m.doneAt = performance.now();
    sbReport.missionClears++;
    sbEvPush({ t: sbNowIso(), kind:'mission_done', sessionId: sbState.sessionId, missionId:m.id });
    sbEmit('quest:update', { mission: m, done:true });
    sbEmit('hha:celebrate', { type:'mission', missionId:m.id });
  }
}

// =======================================================
// Reset
// =======================================================
function sbResetStats(){
  sbState.score=0; sbState.hit=0; sbState.perfect=0; sbState.good=0; sbState.miss=0;
  sbState.combo=0; sbState.maxCombo=0;
  sbState.elapsedMs=0;
  sbState.fever=false; sbState.feverUntil=0;

  sbState.targets=[];
  sbState.bossQueue=[]; sbState.bossActive=false; sbState.bossWarned=false;
  sbState.activeBoss=null; sbState.activeBossInfo=null;

  sbPatternState.active=null; sbPatternState.lastId=null;
  sbReportReset();
  sbMissionReset();

  if(sbHUD.scoreVal) sbHUD.scoreVal.textContent='0';
  if(sbHUD.hitVal) sbHUD.hitVal.textContent='0';
  if(sbHUD.missVal) sbHUD.missVal.textContent='0';
  if(sbHUD.comboVal) sbHUD.comboVal.textContent='x0';
  if(sbHUD.timeVal) sbHUD.timeVal.textContent = (sbMode==='endless'?'0':String(sbTimeSec));

  if(sbGameArea){
    sbGameArea.querySelectorAll('.sb-target,.boss-barbox').forEach(el=>el.remove());
    sbGameArea.classList.remove('fever');
  }
  sbBossHud = null;
}

function sbUpdateHUD(){
  if(sbHUD.scoreVal) sbHUD.scoreVal.textContent=String(sbState.score);
  if(sbHUD.hitVal) sbHUD.hitVal.textContent=String(sbState.hit);
  if(sbHUD.missVal) sbHUD.missVal.textContent=String(sbState.miss);
  if(sbHUD.comboVal) sbHUD.comboVal.textContent='x'+sbState.combo;
}

// =======================================================
// Boss queue scheduling
// =======================================================
function sbPrepareBossQueue(){
  const ms = (sbMode==='endless') ? 120000 : sbTimeSec*1000;
  const checkpoints = [0.15,0.35,0.6,0.85].map(r=>Math.round(ms*r));
  sbState.bossQueue = SB_BOSSES.map((b,idx)=>({ bossIndex: idx, spawnAtMs: checkpoints[idx] || Math.round(ms*(0.2+idx*0.15)) }));
}

// =======================================================
// Anti-overlap spawn helpers (PACK 15C)
// =======================================================
function sbRectForXY(x,y,size){ return { l:x, t:y, r:x+size, b:y+size }; }
function sbIntersects(a,b, pad=10){
  return !(a.r+pad < b.l || a.l-pad > b.r || a.b+pad < b.t || a.t-pad > b.b);
}
function sbExistingRects(){
  const rects=[];
  if(!sbGameArea) return rects;
  const gr = sbGameArea.getBoundingClientRect();
  for(const tObj of sbState.targets){
    if(!tObj.alive || !tObj.el) continue;
    const r = tObj.el.getBoundingClientRect();
    rects.push({ l:r.left-gr.left, t:r.top-gr.top, r:r.right-gr.left, b:r.bottom-gr.top });
  }
  return rects;
}

let sbTargetIdCounter = 1;

function sbPickSpawnXY(sizePx, patternId){
  if(!sbGameArea) return { x:20, y:20 };
  const rect = sbGameArea.getBoundingClientRect();
  const pad = 18;
  const safeTop = 56;

  const W = rect.width, H = rect.height;
  const maxX = Math.max(0, W - sizePx - pad*2);
  const maxY = Math.max(0, H - sizePx - pad*2 - safeTop);

  const existing = sbExistingRects();
  const tries = 18;

  function propose(){
    const cx = pad + maxX/2;
    const cy = pad + safeTop + maxY/2;
    const pid = patternId || 'none';

    let x = pad + sbRng()*maxX;
    let y = pad + safeTop + sbRng()*maxY;

    if (pid === 'centerPulse') {
      const r = Math.min(maxX, maxY) * 0.22;
      const ang = sbRng()*Math.PI*2;
      x = clamp(cx + Math.cos(ang)*r*(0.35+sbRng()), pad, pad+maxX);
      y = clamp(cy + Math.sin(ang)*r*(0.35+sbRng()), pad+safeTop, pad+safeTop+maxY);
    } else if (pid === 'corners') {
      const corners = [
        {x: pad, y: pad+safeTop},
        {x: pad+maxX, y: pad+safeTop},
        {x: pad, y: pad+safeTop+maxY},
        {x: pad+maxX, y: pad+safeTop+maxY},
      ];
      const c = corners[Math.floor(sbRng()*corners.length)];
      x = clamp(c.x + (sbRng()*50 - 25), pad, pad+maxX);
      y = clamp(c.y + (sbRng()*50 - 25), pad+safeTop, pad+safeTop+maxY);
    } else if (pid === 'zigzag') {
      const lane = (Math.floor(performance.now()/800) % 2);
      x = lane ? (pad + maxX*0.72 + sbRng()*maxX*0.22) : (pad + sbRng()*maxX*0.25);
      y = pad+safeTop + sbRng()*maxY;
    } else if (pid === 'ring') {
      const R = Math.min(maxX, maxY) * 0.36;
      const ang = sbRng()*Math.PI*2;
      x = clamp(cx + Math.cos(ang)*R, pad, pad+maxX);
      y = clamp(cy + Math.sin(ang)*R, pad+safeTop, pad+safeTop+maxY);
    } else if (pid === 'swarm') {
      const clusterX = pad + maxX*(0.25+0.5*sbRng());
      const clusterY = pad+safeTop + maxY*(0.25+0.5*sbRng());
      x = clamp(clusterX + (sbRng()*120-60), pad, pad+maxX);
      y = clamp(clusterY + (sbRng()*120-60), pad+safeTop, pad+safeTop+maxY);
    } else if (pid === 'fakeouts') {
      const edge = sbRng()<0.5;
      x = edge ? (sbRng()<0.5 ? pad : pad+maxX) : (pad + sbRng()*maxX);
      y = pad+safeTop + sbRng()*maxY;
      x = clamp(x + (sbRng()*60-30), pad, pad+maxX);
    } else if (pid === 'bossEscort') {
      x = pad + maxX*(0.55 + 0.35*sbRng());
      y = pad+safeTop + maxY*(0.10 + 0.35*sbRng());
    }

    return { x, y };
  }

  for(let i=0;i<tries;i++){
    const p = propose();
    const cand = sbRectForXY(p.x, p.y, sizePx);
    let ok = true;
    for(const ex of existing){
      if(sbIntersects(cand, ex, 12)){ ok=false; break; }
    }
    if(ok) return p;
  }

  return { x: pad + sbRng()*maxX, y: pad+safeTop + sbRng()*maxY };
}

// =======================================================
// Fever
// =======================================================
function sbEnterFever(){
  sbState.fever=true;
  sbState.feverUntil = performance.now() + 3500;
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachFever;
  if(sbGameArea) sbGameArea.classList.add('fever');
  sbShowFeedback('fever');
  sbEmit('hha:coach', { text: sbI18n[sbLang].coachFever, fever:true });
}
function sbCheckFeverTick(now){
  if(sbState.fever && now >= sbState.feverUntil){
    sbState.fever=false;
    if(sbGameArea) sbGameArea.classList.remove('fever');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachReady;
  }
}

// =======================================================
// Spawn / targets
// =======================================================
function sbSpawnTarget(isBoss=false, bossInfo=null){
  if(!sbGameArea) return;

  // device cap
  const cap = sbDeviceCap();
  const aliveCount = sbState.targets.filter(t=>t.alive).length;
  if(!isBoss && aliveCount >= cap) return;

  const patternId = sbPatternState.active?.id || null;
  const sizeBase = isBoss ? sbDD.sizeB : sbDD.sizeN;
  const baseHp = isBoss ? (sbCfg.bossHp + (bossInfo?.hpBonus||0)) : 1;

  const tObj = {
    id: sbTargetIdCounter++,
    boss: !!isBoss,
    bossInfo: bossInfo || null,
    hp: baseHp,
    maxHp: baseHp,
    createdAt: performance.now(),
    el: null,
    alive: true,
    missTimer: null
  };

  const el = document.createElement('div');
  el.className = 'sb-target';
  el.dataset.id = String(tObj.id);
  el.style.width = sizeBase + 'px';
  el.style.height = sizeBase + 'px';
  el.style.display='flex';
  el.style.alignItems='center';
  el.style.justifyContent='center';
  el.style.fontSize = isBoss ? '2.1rem' : '1.7rem';
  el.style.cursor='pointer';
  el.style.borderRadius='999px';

  if(isBoss && bossInfo){
    el.style.background = 'radial-gradient(circle at 30% 20%, #facc15, #ea580c)';
    el.textContent = bossInfo.emoji;
  }else{
    const emo = sbPick(SB_NORMAL_EMOJIS);
    el.style.background = sbState.fever
      ? 'radial-gradient(circle at 30% 20%, #facc15, #eab308)'
      : 'radial-gradient(circle at 30% 20%, #38bdf8, #0ea5e9)';
    el.textContent = emo;
  }

  const pos = sbPickSpawnXY(sizeBase, patternId);
  el.style.left = pos.x + 'px';
  el.style.top  = pos.y + 'px';

  // pointer hit
  el.addEventListener('click', ()=>sbHitTarget(tObj));
  sbGameArea.appendChild(el);
  tObj.el = el;
  sbState.targets.push(tObj);

  // boss enter
  if(isBoss && bossInfo){
    sbState.bossActive = true;
    sbState.bossWarned = false;
    sbState.activeBoss = tObj;
    sbState.activeBossInfo = bossInfo;

    sbSetBossHudVisible(true);
    sbUpdateBossHud();

    const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
    sbEmit('hha:coach', { text: sbI18n[sbLang].bossAppear(name), boss: bossInfo.id });
  }

  // life timer -> miss
  const lifeMs = isBoss ? sbDD.lifeMsB : sbDD.lifeMsN;
  tObj.missTimer = setTimeout(()=>{
    if(!tObj.alive) return;
    tObj.alive=false;
    try{ tObj.el && tObj.el.remove(); }catch(_){}

    sbState.miss++;
    sbState.combo=0;
    sbUpdateHUD();
    sbShowFeedback('miss');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachMiss;

    sbSkill.streak = 0;

    if(tObj.boss){
      sbState.bossActive=false;
      sbState.activeBoss=null;
      sbState.activeBossInfo=null;
      sbSetBossHudVisible(false);
    }
  }, lifeMs);

  // appear anim
  if(el.animate){
    el.animate(
      [{ transform:'scale(0.7)', opacity:0 }, { transform:'scale(1)', opacity:1 }],
      { duration: isBoss?240:160, easing:'ease-out' }
    );
  }
}

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

// =======================================================
// Hit logic + skill updates + ML-like prediction hooks
// =======================================================
function sbUpdateSkillOnTouch(now){
  sbSkill.lastTouchAt = now;
}
function sbUpdateSkillOnHit(now, isKill){
  const dt = sbSkill.lastHitAt ? (now - sbSkill.lastHitAt) : 900;
  sbSkill.lastHitAt = now;

  // RT proxy (clamp)
  sbSkill.rtMs = clamp(dt, 180, 1400);

  // speed score: faster => higher
  sbSkill.speed = clamp(1 - (sbSkill.rtMs - 220) / 1180, 0, 1);

  // streak
  sbSkill.streak = isKill ? (sbSkill.streak+1) : (sbSkill.streak+0.3);

  // accuracy from totals
  const attempts = sbState.hit + sbState.miss;
  const acc = attempts>0 ? (sbState.hit/attempts) : 0.5;
  sbSkill.accuracy = clamp(acc, 0, 1);
}

function sbHitTarget(tObj){
  if(!sbState.running || sbState.paused || !tObj.alive) return;

  const now = performance.now();
  sbUpdateSkillOnTouch(now);

  tObj.hp -= 1;

  sbState.hit++;
  const isBoss = tObj.boss;
  const bossInfo = tObj.bossInfo;

  // still alive => good hit
  if(tObj.hp > 0){
    sbState.good++;
    sbState.combo++;
    sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

    const base = isBoss ? 70 : 50;
    const comboBonus = Math.min(sbState.combo*5, 60);
    const feverBonus = sbState.fever ? 30 : 0;

    // fairness: reduce swarm inflation a bit
    const p = sbPatternState.active?.id || '';
    const patternMul = (p==='swarm') ? 0.9 : 1.0;

    const gained = Math.round((base + comboBonus + feverBonus) * patternMul);
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

    if(isBoss){
      sbUpdateBossHud();
      if(!sbState.bossWarned && tObj.hp <= 2){
        sbState.bossWarned=true;
        const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
        sbEmit('hha:coach', { text: sbI18n[sbLang].bossNear(name), boss: bossInfo.id });
      }
    }

    sbUpdateSkillOnHit(now, false);
    sbMissionUpdate();

    sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss });
    return;
  }

  // kill => perfect
  tObj.alive=false;
  if(tObj.missTimer) { clearTimeout(tObj.missTimer); tObj.missTimer=null; }

  sbState.perfect++;
  sbState.combo++;
  sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

  const base = isBoss ? 200 : 80;
  const comboBonus = Math.min(sbState.combo*8, 100);
  const feverBonus = sbState.fever ? 80 : 0;

  const p = sbPatternState.active?.id || '';
  const patternMul = (p==='swarm') ? 0.92 : 1.0;

  const gained = Math.round((base + comboBonus + feverBonus) * patternMul);
  sbState.score += gained;

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

  sbUpdateSkillOnHit(now, true);
  sbMissionUpdate();

  if(isBoss){
    const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
    sbEmit('hha:coach', { text: sbI18n[sbLang].bossClear(name), boss: bossInfo.id });

    // count boss clear as mission clear driver
    sbReport.missionClears++;

    sbState.bossActive=false;
    sbState.activeBoss=null;
    sbState.activeBossInfo=null;
    sbSetBossHudVisible(false);

    // next boss right away
    sbSpawnNextBossImmediate();
  }

  sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss });
}

// =======================================================
// Crosshair shoot (HeroHealth vr-ui.js)
// =======================================================
function sbHitNearestTargetAtScreenXY(x, y, lockPx=28){
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
  if(best && bestD2 <= lock*lock){ sbHitTarget(best); return true; }
  return false;
}

window.addEventListener('hha:shoot', (ev)=>{
  const d = (ev && ev.detail) ? ev.detail : {};
  sbUpdateSkillOnTouch(performance.now());
  sbHitNearestTargetAtScreenXY(d.x, d.y, d.lockPx || 28);
});

window.addEventListener('keydown',(ev)=>{
  if(!sbState.running || sbState.paused) return;
  if(ev.code==='Space'){
    ev.preventDefault();
    if(!sbGameArea) return;
    const rect = sbGameArea.getBoundingClientRect();
    sbHitNearestTargetAtScreenXY(rect.left+rect.width/2, rect.top+rect.height/2, 90);
  }
});

// =======================================================
// Spawning loop (use DD spawnMs + pattern)
// =======================================================
function sbStartSpawnLoop(){
  if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);

  const tick = ()=>{
    if(!sbState.running || sbState.paused) return;

    const cap = sbDeviceCap();
    const aliveCount = sbState.targets.filter(t=>t.alive).length;
    if(aliveCount >= cap) return;

    // pattern enforce
    const pid = sbPatternState.active?.id || '';
    // leave gaps sometimes (deterministic in research via sbRng)
    if(sbRng() < 0.08) return;

    // prevent clutter during boss
    if(sbState.bossActive && sbRng()<0.5) return;

    // swarm pattern spawns slightly more
    if(pid==='swarm'){
      sbSpawnTarget(false, null);
      if(sbRng()<0.55 && aliveCount < cap-1) sbSpawnTarget(false, null);
    } else if(pid==='bossEscort' && sbState.bossActive){
      // escort: add small target near boss
      sbSpawnTarget(false, null);
    } else {
      sbSpawnTarget(false, null);
    }
  };

  // dynamic interval by DD (rebuild interval periodically)
  sbState.spawnTimer = setInterval(tick, sbDD.spawnMs);
}

function sbRebuildSpawnLoopIfNeeded(){
  if(!sbState.running || sbState.paused) return;
  // rebuild when spawnMs drifted far
  if(!sbState.spawnTimer) return;
  // quick heuristic: rebuild each ~3s to reflect DD
  // (cheap & stable)
  clearInterval(sbState.spawnTimer);
  sbState.spawnTimer = null;
  sbStartSpawnLoop();
}

function sbStopSpawnLoop(){
  if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer=null;
}

// =======================================================
// Main loop (AI tick + pattern + boss)
// =======================================================
let sbLastTimeTick = -1;

function sbMainLoop(now){
  if(!sbState.running) return;

  if(sbState.paused){
    requestAnimationFrame(sbMainLoop);
    return;
  }

  if(!sbState.startTime) sbState.startTime = now;
  sbState.elapsedMs = now - sbState.startTime;

  // AI updates
  if(SB_AI.enabled){
    sbUpdateAIFromSignals(now);
    sbDifficultyTick(now);
    sbEnsurePattern(now);
    sbReportTick(now);
  }

  // update timer
  if(sbMode!=='endless'){
    const remain = Math.max(0, Math.round((sbState.durationMs - sbState.elapsedMs)/1000));
    if(sbHUD.timeVal) sbHUD.timeVal.textContent = String(remain);

    if(remain !== sbLastTimeTick){
      sbLastTimeTick = remain;
      sbEmit('hha:time', { remainSec: remain, elapsedMs: Math.round(sbState.elapsedMs) });
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
    }
  }

  // fever
  sbCheckFeverTick(now);

  // boss scheduling
  sbMaybeSpawnBoss();

  // reflect DD changes
  if(SB_AI.enabled && (now % 3000) < 16){
    sbRebuildSpawnLoopIfNeeded();
  }

  requestAnimationFrame(sbMainLoop);
}

// =======================================================
// Local logging + CSV
// =======================================================
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
      'accuracy','maxCombo','fever','timeUsedSec','seed','seedUsed','deterministic','research',
      'aiRiskAvg','aiMissionClears','aiPatterns',
      'reason','createdAt'
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

// =======================================================
// End/Start
// =======================================================
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

  const aiRiskAvg = (()=> {
    const a = sbReport.riskSeries;
    if(!a.length) return 0;
    const s = a.reduce((m,o)=>m+o.risk,0);
    return +((s/a.length).toFixed(3));
  })();

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
    sessionId:  sbState.sessionId,

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

    seed:       SB_SEED,
    seedUsed:   SB_SEED_STR,
    deterministic: SB_IS_RESEARCH ? 1 : 0,
    research:   SB_IS_RESEARCH ? 1 : 0,

    aiRiskAvg,
    aiMissionClears: sbReport.missionClears,
    aiPatterns: (sbReport.patterns||[]).map(p=>p.id).join('|'),

    reason,
    createdAt:  new Date().toISOString(),
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
  sbEmit('hha:flush', { reason: 'end' });
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

  document.body.classList.add('play-only');

  sbState.sessionId = String(Date.now());
  sbResetStats();
  sbPrepareBossQueue();

  sbState.running=true;
  sbState.paused=false;
  sbState.startTime=0;
  sbLastTimeTick = -1;

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
    seed: SB_SEED,
    seedUsed: SB_SEED_STR,
    deterministic: SB_IS_RESEARCH ? 1 : 0,
    research: SB_IS_RESEARCH ? 1 : 0
  });

  setTimeout(()=>{
    sbStartSpawnLoop();
    requestAnimationFrame(sbMainLoop);
  }, 420);
}

// =======================================================
// Pause/resume from hub
// =======================================================
window.addEventListener('message',(ev)=>{
  const d = ev.data || {};
  if(d.type === 'hub:pause'){
    if(!sbState.running) return;
    const v = !!d.value;
    const t = sbI18n[sbLang];
    if(v && !sbState.paused){
      sbState.paused=true;
      sbState.pauseAt = performance.now();
      sbStopSpawnLoop();
      sbEmit('hha:coach', { text: t.paused });
    }else if(!v && sbState.paused){
      sbState.paused=false;
      if(sbState.startTime && sbState.pauseAt){
        const pausedDur = performance.now() - sbState.pauseAt;
        sbState.startTime += pausedDur;
      }
      sbStartSpawnLoop();
      sbEmit('hha:coach', { text: t.resumed });
    }
  }
});

// =======================================================
// Buttons
// =======================================================
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
    const hub = (qs('hub','')||'').trim();
    location.href = hub || '../hub.html';
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

// =======================================================
// Init
// =======================================================
sbLoadMeta();
sbApplyLang();

if(!SB_IS_RESEARCH){
  document.body.classList.add('mode-play'); // hide research UI by CSS
}

if(sbHUD.timeVal){
  sbHUD.timeVal.textContent = (sbMode==='endless' ? '0' : String(sbTimeSec));
}