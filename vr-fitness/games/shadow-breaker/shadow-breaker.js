// === VR Fitness — Shadow Breaker (Production v1.3.0) ===
// ✅ HeroHealth-like: hha:shoot support (crosshair/tap-to-shoot fallback if vr-ui.js not present)
// ✅ HHA events: hha:start / hha:time / hha:score / hha:coach / hha:end / hha:flush
// ✅ Boss HUD bar + safe spawn + feedback fixed
// ✅ Pass-through: hub/view/seed/research/studyId/log etc.
// ✅ AI PACK (A+B+C):
//    A) Difficulty Director (fair + smooth)
//    B) AI Coach microtips (explainable + rate-limited)
//    C) Predict signals (frustration / fatigue / boredom) + event log for ML

'use strict';

const SB_GAME_ID = 'shadow-breaker';
const SB_GAME_VERSION = '1.3.0-prod';

const SB_STORAGE_KEY = 'ShadowBreakerSessions_v1';
const SB_META_KEY    = 'ShadowBreakerMeta_v1';
const SB_EVENT_KEY   = 'ShadowBreakerEvents_v1';

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

// ---------- emit ----------
function sbEmit(name, detail = {}){ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){} }
function clamp(n,a,b){ n=+n; if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b,n)); }
function sbNow(){ return performance.now(); }
function ema(prev, x, a){ return prev==null ? x : (prev + a*(x-prev)); }
function clamp01(x){ return Math.max(0, Math.min(1, x)); }

// ---------- RNG (deterministic for research if seed exists) ----------
function sbMakeRNG(seed){
  // simple LCG
  let x = 0;
  const s = String(seed||'');
  for(let i=0;i<s.length;i++) x = (x*31 + s.charCodeAt(i)) >>> 0;
  if(!x) x = (Date.now()>>>0);
  return function(){
    x = (1664525 * x + 1013904223) >>> 0;
    return (x >>> 0) / 4294967296;
  };
}
const sbRand = (SB_IS_RESEARCH && SB_SEED) ? sbMakeRNG(SB_SEED) : Math.random;

// ---------- Device detect ----------
function sbDetectDevice() {
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vrHeadset';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'pc';
}

// ---------- DOM ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const sbGameArea   = $('#gameArea') || $('#playArea') || $('#sbPlayArea');
const sbFeedbackEl = $('#feedback') || $('#sbFeedback');

const sbStartBtn = $('#startBtn') || $('#playBtn') || $('#playButton') || $('#sbStartBtn');
const sbLangButtons = $$('.lang-toggle button, .lang-btn');

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

const sbOverlay = $('#resultOverlay') || $('#resultCard') || $('#resultPanel') || null;

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

const sbPlayAgainBtn = $('#playAgainBtn') || $('#resPlayAgainBtn') || $('#resReplayBtn');
const sbBackHubBtn   = $('#backHubBtn')   || $('#resBackHubBtn')   || $('#resMenuBtn');
const sbDownloadCsvBtn = $('#downloadCsvBtn') || $('#resDownloadCsvBtn');

// ---------- i18n ----------
const sbI18n = {
  th: {
    startLabel:'เริ่มเล่น',
    coachReady:'โค้ชพุ่ง: เล็งกลางจอแล้วแตะ/ยิงให้โดน! 👊',
    coachGood:'สวยมาก! ต่อคอมโบยาว ๆ ✨',
    coachMiss:'พลาดนิดเดียว ไม่เป็นไร 💪',
    coachFever:'FEVER!! ทุบให้สุด!! 🔥',
    coachPaused:'พักก่อนนิดนึง แล้วกลับมาลุยต่อ 💙',
    coachResumed:'กลับมาแล้ว! ลุย! 👊',
    tagGoal:'เป้าหมาย: ต่อย/ยิงเป้า emoji ให้ทันเวลา รักษาคอมโบ และพิชิตบอสทั้ง 4 ตัว.',
    alertMeta:'กรุณากรอกอย่างน้อย Student ID ก่อนเริ่มเล่นนะครับ',
    feverLabel:'FEVER!!',
    bossNear:(name)=>`ใกล้ล้ม ${name} แล้ว! เร่งอีกนิด! ⚡`,
    bossClear:(name)=>`พิชิต ${name} แล้ว! บอสถัดไปมา! 🔥`,
    bossAppear:(name)=>`${name} ปรากฏตัวแล้ว!`,
    tipFatigue:'เริ่มล้าแล้วนะ 💡 “ช้าลงนิดแต่แม่นขึ้น”',
    tipFrustr:'พลาดติด ๆ กัน ให้ “เล็งกลางแล้วแตะ” จะง่ายขึ้น 👊',
    tipBored:'เก่งมาก! 🔥 ต่อไปมี “คลื่นเป้า” เร็วขึ้น ลุย!'
  },
  en: {
    startLabel:'Start',
    coachReady:'Aim center and tap/shoot targets! 👊',
    coachGood:'Nice! Keep the combo! ✨',
    coachMiss:'Missed a bit. Try again! 💪',
    coachFever:'FEVER!! Smash!! 🔥',
    coachPaused:'Paused. Take a breath 💙',
    coachResumed:'Back! Let’s go! 👊',
    tagGoal:'Goal: hit emoji targets quickly, keep combo, defeat all bosses.',
    alertMeta:'Please fill at least the Student ID before starting.',
    feverLabel:'FEVER!!',
    bossNear:(name)=>`Almost defeat ${name}! Finish it! ⚡`,
    bossClear:(name)=>`You beat ${name}! Next boss! 🔥`,
    bossAppear:(name)=>`${name} appeared!`,
    tipFatigue:'You might be tired 💡 Slow a bit—aim clean.',
    tipFrustr:'If you miss repeatedly, aim center then tap 👊',
    tipBored:'Nice! 🔥 Faster target waves incoming—go!'
  }
};
let sbLang = (qs('lang','')||'th').toLowerCase();
if(sbLang!=='en') sbLang='th';

// ---------- Config ----------
const sbDiffCfg = {
  easy:   { spawnMs: 900, bossHp: 6 },
  normal: { spawnMs: 700, bossHp: 9 },
  hard:   { spawnMs: 520, bossHp: 12 },
};
const sbCfg = sbDiffCfg[sbDiff] || sbDiffCfg.normal;

// ---------- Boss & emojis ----------
const SB_NORMAL_EMOJIS = ['🎯','💥','⭐','⚡','🔥','🥎','🌀'];
const SB_BOSSES = [
  { id: 1, emoji:'💧', nameTh:'Bubble Glove',  nameEn:'Bubble Glove',  hpBonus:0 },
  { id: 2, emoji:'⛈️', nameTh:'Storm Knuckle', nameEn:'Storm Knuckle', hpBonus:2 },
  { id: 3, emoji:'🥊', nameTh:'Iron Fist',     nameEn:'Iron Fist',     hpBonus:4 },
  { id: 4, emoji:'🐲', nameTh:'Golden Dragon', nameEn:'Golden Dragon', hpBonus:6 },
];

// ---------- AI ON/OFF ----------
const SB_AI_ON = (() => {
  // default: ON in play, OFF in research (unless ai=1)
  const q = (qs('ai','')||'').toLowerCase();
  if (SB_IS_RESEARCH) return (q==='1'||q==='true'||q==='on');
  if (q==='0'||q==='false'||q==='off') return false;
  return true;
})();

// ---------- local event log (ML-ready) ----------
function sbLogEvent(type, data){
  try{
    const raw = localStorage.getItem(SB_EVENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const rec = {
      type,
      t: new Date().toISOString(),
      gameId: SB_GAME_ID,
      gameVersion: SB_GAME_VERSION,
      sessionId: sbState.sessionId || '',
      phase: sbPhase,
      mode: sbMode,
      diff: sbDiff,
      seed: SB_SEED,
      research: SB_IS_RESEARCH ? 1 : 0,
      lang: sbLang,
      elapsedMs: Math.round(sbState.elapsedMs||0),
      ...data
    };
    arr.push(rec);
    // keep last ~2500 events
    if(arr.length > 2500) arr.splice(0, arr.length - 2500);
    localStorage.setItem(SB_EVENT_KEY, JSON.stringify(arr));
  }catch(_){}
}

// ---------- AI PACK (A+B+C) ----------
const sbAI = {
  rtEmaMs: null,
  rtTrend: 0,
  accEma: null,
  missEma: null,
  comboEma: null,
  streakMiss: 0,
  streakHit: 0,

  spawnMsDyn: null,
  lifeMsDyn: null,
  lockPxDyn: null,
  waveChance: 0,

  frustr: 0,
  fatigue: 0,
  boredom: 0,

  lastCoachAt: 0,
  coachCooldownMs: 1800,

  lastTickSec: -1,

  reset(){
    this.rtEmaMs=null; this.rtTrend=0;
    this.accEma=null; this.missEma=null; this.comboEma=null;
    this.streakMiss=0; this.streakHit=0;
    this.spawnMsDyn=null; this.lifeMsDyn=null; this.lockPxDyn=null;
    this.waveChance=0;
    this.frustr=0; this.fatigue=0; this.boredom=0;
    this.lastCoachAt=0;
    this.lastTickSec=-1;
  },

  onShot(rtMs, wasHit, isBoss){
    const hit = wasHit ? 1 : 0;

    if(wasHit){ this.streakHit++; this.streakMiss=0; }
    else { this.streakMiss++; this.streakHit=0; }

    this.rtEmaMs = ema(this.rtEmaMs, rtMs, 0.18);

    const acc = (sbState.hit + sbState.miss) > 0
      ? (sbState.hit / (sbState.hit + sbState.miss))
      : 1;

    this.accEma  = ema(this.accEma, acc, 0.12);
    const missRate = 1 - acc;
    this.missEma = ema(this.missEma, missRate, 0.12);
    this.comboEma = ema(this.comboEma, sbState.combo, 0.10);

    const rtNorm = clamp01(((this.rtEmaMs||600) - 350) / 650); // 0 fast -> 1 slow
    this.rtTrend = ema(this.rtTrend, rtNorm, 0.08);

    const missPart = clamp01((this.missEma||0) * 1.2);
    const streakPart = clamp01(this.streakMiss / 5);
    const comboPart = 1 - clamp01((sbState.combo) / 10);
    this.frustr = ema(this.frustr, clamp01(0.55*missPart + 0.30*streakPart + 0.15*comboPart), 0.18);

    const playMin = (sbState.elapsedMs||0) / 60000;
    const timePart = clamp01(playMin / 3);
    this.fatigue = ema(this.fatigue, clamp01(0.70*(this.rtTrend||0) + 0.30*timePart), 0.10);

    const accHigh = clamp01(((this.accEma||1) - 0.82) / 0.18);
    const rtFast = 1 - rtNorm;
    const streakHitPart = clamp01(this.streakHit / 10);
    this.boredom = ema(this.boredom, clamp01(0.45*accHigh + 0.35*rtFast + 0.20*streakHitPart), 0.10);

    sbLogEvent('sb:predict', {
      rtMs: Math.round(rtMs),
      wasHit: hit,
      boss: !!isBoss,
      accEma: +(this.accEma||0).toFixed(3),
      missEma: +(this.missEma||0).toFixed(3),
      rtEmaMs: Math.round(this.rtEmaMs||0),
      frustr: +(this.frustr||0).toFixed(3),
      fatigue: +(this.fatigue||0).toFixed(3),
      boredom: +(this.boredom||0).toFixed(3),
      combo: sbState.combo
    });
  },

  directorTick(){
    if(!SB_AI_ON) return;

    const sec = Math.floor((sbState.elapsedMs||0)/1000);
    if(sec === this.lastTickSec) return;
    this.lastTickSec = sec;

    const baseSpawn = sbCfg.spawnMs;
    const baseLife  = (sbDiff==='hard') ? 2100 : (sbDiff==='easy'?2500:2300);

    const f = this.frustr || 0;
    const t = this.fatigue || 0;
    const b = this.boredom || 0;

    const lockBase = 28;
    const lock = lockBase + Math.round(18*f) - Math.round(10*b);

    const spawn = Math.round(baseSpawn * (1 + 0.35*f + 0.25*t - 0.25*b));
    const spawnClamped = clamp(spawn, 420, 1100);

    const life = Math.round(baseLife * (1 + 0.25*f + 0.20*t - 0.20*b));
    const lifeClamped = clamp(life, 1600, 3200);

    const waveChance = clamp01(0.06 + 0.18*b - 0.08*f);

    this.lockPxDyn = clamp(lock, 18, 52);
    this.spawnMsDyn = spawnClamped;
    this.lifeMsDyn = lifeClamped;
    this.waveChance = waveChance;

    this.maybeCoach();

    sbLogEvent('sb:director', {
      spawnMs: this.spawnMsDyn,
      lifeMs: this.lifeMsDyn,
      lockPx: this.lockPxDyn,
      waveChance: +this.waveChance.toFixed(3),
      frustr:+(f).toFixed(3), fatigue:+(t).toFixed(3), boredom:+(b).toFixed(3)
    });
  },

  maybeCoach(){
    const now = sbNow();
    if(now - this.lastCoachAt < this.coachCooldownMs) return;

    const f = this.frustr||0, t=this.fatigue||0, b=this.boredom||0;
    let msg = '';
    let why = '';

    if(t > 0.72){
      msg = (sbLang==='th') ? sbI18n.th.tipFatigue : sbI18n.en.tipFatigue;
      why = 'fatigue_high';
    }else if(f > 0.70){
      msg = (sbLang==='th') ? sbI18n.th.tipFrustr : sbI18n.en.tipFrustr;
      why = 'frustr_high';
    }else if(b > 0.75){
      msg = (sbLang==='th') ? sbI18n.th.tipBored : sbI18n.en.tipBored;
      why = 'boredom_high';
    }else{
      return;
    }

    this.lastCoachAt = now;
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = msg;
    sbEmit('hha:coach', { text: msg, why });
    sbLogEvent('sb:coach_tip', { why, text: msg });
  },

  getLockPx(){
    return (SB_AI_ON && Number.isFinite(this.lockPxDyn)) ? this.lockPxDyn : 28;
  },
  getSpawnMs(){
    return (SB_AI_ON && Number.isFinite(this.spawnMsDyn)) ? this.spawnMsDyn : sbCfg.spawnMs;
  },
  getLifeMs(isBoss){
    if(isBoss) return 6500;
    return (SB_AI_ON && Number.isFinite(this.lifeMsDyn)) ? this.lifeMsDyn : 2300;
  },
  shouldWave(){
    if(!SB_AI_ON) return false;
    if(sbState.bossActive) return false;
    return sbRand() < (this.waveChance||0);
  }
};

// ---------- state ----------
const sbState = {
  running:false,
  paused:false,
  startTime:0,
  pauseAt:0,
  elapsedMs:0,
  durationMs: sbMode==='endless' ? Infinity : sbTimeSec*1000,

  sessionId:'',
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

  bossQueue:[],
  bossActive:false,
  bossWarned:false,
  activeBoss:null,
  activeBossInfo:null,
};

// ---------- meta load/save ----------
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

// ---------- i18n apply ----------
function sbApplyLang(){
  const t = sbI18n[sbLang];
  const sl = $('#startLabel'); if(sl) sl.textContent = t.startLabel;
  const tg = $('#tagGoal'); if(tg) tg.textContent = t.tagGoal;
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;

  // toggle active
  sbLangButtons.forEach(b=>b.classList.remove('active'));
  sbLangButtons.forEach(b=>{
    const dl = (b.dataset && b.dataset.lang) ? b.dataset.lang : '';
    if(dl && dl.toLowerCase() === sbLang) b.classList.add('active');
  });
}
sbLangButtons.forEach(btn=>{
  btn.addEventListener('click',()=>{
    const dl = (btn.dataset && btn.dataset.lang) ? btn.dataset.lang : '';
    if(!dl) return;
    sbLang = dl.toLowerCase()==='en' ? 'en' : 'th';
    sbApplyLang();
  });
});

// ---------- feedback ----------
function sbShowFeedback(type){
  if(!sbFeedbackEl) return;
  const t = sbI18n[sbLang];
  let txt='';
  if(type==='fever') txt = t.feverLabel;
  else if(type==='perfect') txt = (sbLang==='th'?'Perfect! 💥':'PERFECT!');
  else if(type==='good') txt = (sbLang==='th'?'ดีมาก! ✨':'GOOD!');
  else txt = (sbLang==='th'?'พลาด!':'MISS');

  sbFeedbackEl.textContent = txt;

  // ensure classes match css: feedback feedback-good etc.
  sbFeedbackEl.className = 'feedback feedback-' + type;
  sbFeedbackEl.style.display = 'block';
  sbFeedbackEl.classList.add('show');

  setTimeout(()=>{
    if(!sbFeedbackEl) return;
    sbFeedbackEl.classList.remove('show');
    setTimeout(()=>{ if(sbFeedbackEl) sbFeedbackEl.style.display='none'; }, 120);
  }, type==='fever'?800:420);
}

// ---------- HUD ----------
function sbUpdateHUD(){
  if(sbHUD.scoreVal) sbHUD.scoreVal.textContent=String(sbState.score);
  if(sbHUD.hitVal) sbHUD.hitVal.textContent=String(sbState.hit);
  if(sbHUD.missVal) sbHUD.missVal.textContent=String(sbState.miss);
  if(sbHUD.comboVal) sbHUD.comboVal.textContent='x'+sbState.combo;
}

// ---------- Boss HUD bar ----------
let sbBossHud = null;
function sbEnsureBossHud(){
  if(!sbGameArea) return null;
  if(sbBossHud) return sbBossHud;
  const box = document.createElement('div');
  box.className = 'boss-barbox';
  box.innerHTML = `
    <div class="boss-face" id="sbBossFace">🐲</div>
    <div style="flex:1; min-width:0;">
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

// ---------- boss schedule ----------
function sbPrepareBossQueue(){
  const ms = (sbMode==='endless') ? 120000 : sbTimeSec*1000;
  const checkpoints = [0.15,0.35,0.6,0.85].map(r=>Math.round(ms*r));
  sbState.bossQueue = SB_BOSSES.map((b,idx)=>({
    bossIndex: idx,
    spawnAtMs: checkpoints[idx] || Math.round(ms*(0.2+idx*0.15))
  }));
}

// ---------- safe spawn area ----------
let sbTargetIdCounter = 1;

function sbGetSafeTopPx(){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim();
    const n = parseFloat(v);
    if(Number.isFinite(n) && n>20) return n;
  }catch(_){}
  // fallback
  return 72;
}

function sbPickSpawnXY(sizePx){
  if(!sbGameArea) return { x:20, y:20 };

  const rect = sbGameArea.getBoundingClientRect();
  const pad = 18;

  const safeTop = Math.max(56, Math.round(sbGetSafeTopPx()));
  const maxX = Math.max(0, rect.width - sizePx - pad*2);
  const maxY = Math.max(0, rect.height - sizePx - pad*2 - safeTop);

  const x = pad + sbRand()*maxX;
  const y = pad + safeTop + sbRand()*maxY;
  return { x, y };
}

// ---------- fever ----------
function sbEnterFever(){
  sbState.fever=true;
  sbState.feverUntil = sbNow() + 3500;
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachFever;
  if(sbGameArea) sbGameArea.classList.add('fever');
  sbShowFeedback('fever');
  sbEmit('hha:coach', { text: sbI18n[sbLang].coachFever, fever:true });
  sbLogEvent('sb:fever', { on:1 });
}
function sbCheckFeverTick(now){
  if(sbState.fever && now >= sbState.feverUntil){
    sbState.fever=false;
    if(sbGameArea) sbGameArea.classList.remove('fever');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachReady;
    sbLogEvent('sb:fever', { on:0 });
  }
}

// ---------- spawn target ----------
function sbSpawnTarget(isBoss=false, bossInfo=null){
  if(!sbGameArea) return;

  const sizeBase = isBoss ? 90 : 56;
  const baseHp = isBoss ? (sbCfg.bossHp + (bossInfo?.hpBonus||0)) : 1;

  const tObj = {
    id: sbTargetIdCounter++,
    boss: !!isBoss,
    bossInfo: bossInfo || null,
    hp: baseHp,
    maxHp: baseHp,
    createdAt: sbNow(),
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

  if(isBoss && bossInfo){
    el.style.background = 'radial-gradient(circle at 30% 20%, #facc15, #ea580c)';
    el.textContent = bossInfo.emoji;
  }else{
    const emo = SB_NORMAL_EMOJIS[Math.floor(sbRand()*SB_NORMAL_EMOJIS.length)];
    el.style.background = sbState.fever
      ? 'radial-gradient(circle at 30% 20%, #facc15, #eab308)'
      : 'radial-gradient(circle at 30% 20%, #38bdf8, #0ea5e9)';
    el.textContent = emo;
  }

  const pos = sbPickSpawnXY(sizeBase);
  el.style.left = pos.x + 'px';
  el.style.top  = pos.y + 'px';

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
    sbLogEvent('sb:boss', { event:'appear', bossId: bossInfo.id, bossName: name, hp: tObj.hp });
  }

  // life timer -> miss
  const lifeMs = sbAI.getLifeMs(isBoss);

  tObj.missTimer = setTimeout(()=>{
    if(!tObj.alive) return;
    tObj.alive=false;
    try{ tObj.el && tObj.el.remove(); }catch(_){}

    sbState.miss++;
    sbState.combo=0;
    sbUpdateHUD();
    sbShowFeedback('miss');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachMiss;

    // predictor update (miss)
    sbAI.onShot(lifeMs, false, !!tObj.boss);

    sbEmit('hha:score', { score: sbState.score, gained:0, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!tObj.boss });

    if(tObj.boss){
      sbLogEvent('sb:boss', { event:'timeout', bossId: bossInfo?.id || 0 });
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

// ---------- boss spawn logic ----------
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

// ---------- hit logic ----------
function sbHitTarget(tObj){
  if(!sbState.running || sbState.paused || !tObj.alive) return;

  const rtMs = Math.max(0, Math.round(sbNow() - (tObj.createdAt || sbNow())));

  tObj.hp -= 1;

  sbState.hit++;
  const isBoss = tObj.boss;
  const bossInfo = tObj.bossInfo;

  // not dead yet => GOOD hit
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

    if(isBoss){
      sbUpdateBossHud();
      if(!sbState.bossWarned && tObj.hp <= 2){
        sbState.bossWarned=true;
        const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
        sbEmit('hha:coach', { text: sbI18n[sbLang].bossNear(name), boss: bossInfo.id });
        sbLogEvent('sb:boss', { event:'near', bossId: bossInfo.id, hp: tObj.hp });
      }
    }

    // AI predictor update
    sbAI.onShot(rtMs, true, isBoss);

    sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss, rtMs });
    return;
  }

  // DEAD => PERFECT kill
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

  // AI predictor update
  sbAI.onShot(rtMs, true, isBoss);

  if(isBoss){
    const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
    sbEmit('hha:coach', { text: sbI18n[sbLang].bossClear(name), boss: bossInfo.id });
    sbLogEvent('sb:boss', { event:'clear', bossId: bossInfo.id });

    sbState.bossActive=false;
    sbState.activeBoss=null;
    sbState.activeBossInfo=null;
    sbSetBossHudVisible(false);

    // next boss immediately for excitement
    sbSpawnNextBossImmediate();
  }

  sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss, rtMs });
}

// ---------- crosshair shoot hit-test ----------
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

// listen from vr-ui.js (or fallback emitter)
window.addEventListener('hha:shoot', (ev)=>{
  const d = (ev && ev.detail) ? ev.detail : {};
  sbHitNearestTargetAtScreenXY(d.x, d.y, sbAI.getLockPx());
});

// keyboard fallback (pc)
window.addEventListener('keydown',(ev)=>{
  if(!sbState.running || sbState.paused) return;
  if(ev.code==='Space'){
    ev.preventDefault();
    if(!sbGameArea) return;
    const rect = sbGameArea.getBoundingClientRect();
    sbHitNearestTargetAtScreenXY(rect.left+rect.width/2, rect.top+rect.height/2, 90);
  }
});

// ---------- fallback crosshair UI (if vr-ui.js not installed) ----------
(function sbEnsureCrosshairFallback(){
  const want = (qs('view','')||'').toLowerCase();
  const strictCVR = want === 'cvr';

  // if universal vr-ui already loaded, do nothing
  if(window.__HHA_VRUI_LOADED__) return;

  // minimal crosshair overlay
  const cross = document.createElement('div');
  cross.className = 'sb-crosshair';
  cross.style.cssText = `
    position:fixed; left:50%; top:50%;
    width:14px; height:14px;
    transform:translate(-50%,-50%);
    border-radius:999px;
    border:2px solid rgba(250,250,250,.85);
    box-shadow:0 0 14px rgba(34,211,238,.25);
    z-index:70;
    pointer-events:none;
    opacity:${(strictCVR || sbDetectDevice()==='mobile') ? 0.95 : 0.0};
  `;
  document.body.appendChild(cross);

  // tap anywhere => shoot from center (cVR style)
  document.addEventListener('pointerdown', (ev)=>{
    if(!sbState.running || sbState.paused) return;

    // if not strictCVR and click on target, let target handler do it
    if(!strictCVR){
      const el = ev.target;
      if(el && el.classList && el.classList.contains('sb-target')) return;
    }

    // emit hha:shoot at center
    if(!sbGameArea) return;
    const rect = sbGameArea.getBoundingClientRect();
    const x = rect.left + rect.width/2;
    const y = rect.top  + rect.height/2;
    sbEmit('hha:shoot', { x, y, lockPx: sbAI.getLockPx(), source:'fallback' });
  }, { passive:true });
})();

// ---------- spawning (dynamic spawnMs) ----------
let sbSpawnTimeout = null;

function sbSpawnOnce(){
  if(!sbState.running || sbState.paused) return;

  // director tick
  sbAI.directorTick();

  // gaps sometimes
  if(sbRand() >= 0.10){
    if(sbAI.shouldWave()){
      sbSpawnTarget(false, null);
      setTimeout(()=>sbState.running && !sbState.paused && sbSpawnTarget(false,null), 110);
      setTimeout(()=>sbState.running && !sbState.paused && sbSpawnTarget(false,null), 220);
      sbLogEvent('sb:wave', {});
    }else{
      if(!(sbState.bossActive && sbRand()<0.5)){
        sbSpawnTarget(false, null);
      }
    }
  }

  const nextMs = sbAI.getSpawnMs();
  sbSpawnTimeout = setTimeout(sbSpawnOnce, nextMs);
}

function sbStartSpawnLoop(){
  sbStopSpawnLoop();
  const nextMs = sbAI.getSpawnMs();
  sbSpawnTimeout = setTimeout(sbSpawnOnce, nextMs);
}
function sbStopSpawnLoop(){
  if(sbSpawnTimeout) clearTimeout(sbSpawnTimeout);
  sbSpawnTimeout = null;
}

// ---------- main loop ----------
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
      sbLogEvent('sb:time', { remainSec: remain });
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
      sbLogEvent('sb:time', { elapsedSec: sec });
    }
  }

  sbCheckFeverTick(now);
  sbMaybeSpawnBoss();

  requestAnimationFrame(sbMainLoop);
}

// ---------- reset stats ----------
function sbResetStats(){
  sbState.score=0; sbState.hit=0; sbState.perfect=0; sbState.good=0; sbState.miss=0;
  sbState.combo=0; sbState.maxCombo=0;
  sbState.elapsedMs=0;

  sbState.fever=false; sbState.feverUntil=0;

  sbState.targets=[];
  sbState.bossQueue=[]; sbState.bossActive=false; sbState.bossWarned=false;
  sbState.activeBoss=null; sbState.activeBossInfo=null;

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

// ---------- local session log ----------
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
      'accuracy','maxCombo','feverOnEnd','timeUsedSec','seed','research','reason','createdAt'
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

// ---------- end/start ----------
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

  const playedSec = Math.round((sbState.elapsedMs||0)/1000);
  const totalHit = sbState.hit;
  const totalMiss = sbState.miss;
  const attempts = totalHit + totalMiss;
  const acc = attempts>0 ? Math.round((totalHit/attempts)*100) : 0;

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
    feverOnEnd: sbState.fever ? 1 : 0,
    timeUsedSec:playedSec,
    seed:       SB_SEED,
    research:   SB_IS_RESEARCH ? 1 : 0,
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

  // HHA events
  sbEmit('hha:end', rec);
  sbEmit('hha:flush', { reason: 'end' });

  sbLogEvent('sb:session_end', { reason, score: sbState.score, acc, hits: totalHit, miss: totalMiss });
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

  sbResetStats();
  sbAI.reset();
  sbPrepareBossQueue();

  sbState.running=true;
  sbState.paused=false;
  sbState.startTime=0;
  sbLastTimeTick = -1;

  sbState.sessionId = String(Date.now()) + '-' + Math.floor(sbRand()*1e6);

  if(sbStartBtn){
    sbStartBtn.disabled=true;
    sbStartBtn.style.opacity=0.75;
  }
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;

  // HHA start event
  sbEmit('hha:start', {
    gameId: SB_GAME_ID,
    gameVersion: SB_GAME_VERSION,
    phase: sbPhase,
    mode: sbMode,
    diff: sbDiff,
    timeSec: (sbMode==='endless') ? 0 : sbTimeSec,
    seed: SB_SEED,
    research: SB_IS_RESEARCH ? 1 : 0,
    ai: SB_AI_ON ? 1 : 0
  });

  sbLogEvent('sb:session_start', {
    device: meta.deviceType,
    studentId: meta.studentId ? '1' : '0',
    ai: SB_AI_ON ? 1 : 0
  });

  setTimeout(()=>{
    sbStartSpawnLoop();
    requestAnimationFrame(sbMainLoop);
  }, 450);
}

// pause/resume from hub
window.addEventListener('message',(ev)=>{
  const d = ev.data || {};
  if(d.type === 'hub:pause'){
    if(!sbState.running) return;
    const v = !!d.value;
    if(v && !sbState.paused){
      sbState.paused=true;
      sbState.pauseAt = sbNow();
      sbStopSpawnLoop();
      if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachPaused;
      sbEmit('hha:coach', { text: sbI18n[sbLang].coachPaused, why:'pause' });
      sbLogEvent('sb:pause', { on:1 });
    }else if(!v && sbState.paused){
      sbState.paused=false;
      if(sbState.startTime && sbState.pauseAt){
        const pausedDur = sbNow() - sbState.pauseAt;
        sbState.startTime += pausedDur;
      }
      sbStartSpawnLoop();
      if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachResumed;
      sbEmit('hha:coach', { text: sbI18n[sbLang].coachResumed, why:'resume' });
      sbLogEvent('sb:pause', { on:0 });
    }
  }
});

// ---------- buttons ----------
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
    location.href = hub || '../index.html';
  });
}

if(sbDownloadCsvBtn){
  sbDownloadCsvBtn.addEventListener('click', sbDownloadCsv);
}

// meta persistence
Object.values(sbMetaInputs).forEach(el=>{
  if(!el) return;
  el.addEventListener('change', sbSaveMetaDraft);
  el.addEventListener('blur', sbSaveMetaDraft);
});

// ---------- init ----------
sbLoadMeta();
sbApplyLang();

if(sbHUD.timeVal){
  sbHUD.timeVal.textContent = (sbMode==='endless' ? '0' : String(sbTimeSec));
}