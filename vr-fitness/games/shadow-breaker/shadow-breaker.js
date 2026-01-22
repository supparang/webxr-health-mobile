// === VR Fitness — Shadow Breaker (Production v1.1) ===
// ✅ HeroHealth-like: hha:shoot support (crosshair/tap-to-shoot via vr-ui.js)
// ✅ HHA events: hha:start / hha:time / hha:score / hha:end / hha:flush / hha:coach
// ✅ Boss HUD bar + safe spawn + anti-overlap spawn (PACK-4)
// ✅ Seeded RNG (PACK-4) — deterministic when seed provided (research-friendly)
// ✅ Telemetry for ML (PACK-2): events (hit/miss/predict/coach) + RT
// ✅ AI A+B+C (PACK-3): Difficulty Director + Coach + Predict triggers (assist + storm)
// ✅ Pass-through: hub/view/seed/research/studyId/log etc.

'use strict';

const SB_GAME_ID = 'shadow-breaker';
const SB_GAME_VERSION = '1.1.0-prod';

const SB_STORAGE_KEY = 'ShadowBreakerSessions_v1';
const SB_META_KEY    = 'ShadowBreakerMeta_v1';
const SB_EVENT_KEY   = 'ShadowBreakerEvents_v1';
const SB_LAST_SUMMARY_KEY = 'SB_LAST_SUMMARY_v1';

const SB_EVENT_MAX = 3000; // กัน localStorage บวม

function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }
function clamp(n,a,b){ n=+n; if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b,n)); }
function sbEmit(name, detail = {}){ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){} }

// ---------- Query params ----------
const sbPhase = (qs('phase','train')||'train').toLowerCase();
const sbMode  = (qs('mode','timed')||'timed').toLowerCase(); // timed | endless
const sbDiff  = (qs('diff','normal')||'normal').toLowerCase();
const sbTimeSec = (()=>{ const t=parseInt(qs('time','60'),10); return (Number.isFinite(t)&&t>=20&&t<=300)?t:60; })();

const SB_SEED_RAW = (qs('seed','')||'').trim();
const SB_IS_RESEARCH = (()=> {
  const r = (qs('research','')||'').toLowerCase();
  return r==='1' || r==='true' || r==='on' || !!qs('studyId','') || !!qs('log','');
})();

// ---------- Seeded RNG (PACK-4) ----------
function sbHash32(str){
  // simple stable hash for strings -> uint32
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function sbMakeRNG(seedU32){
  // mulberry32
  let a = (seedU32 >>> 0) || 0x9e3779b9;
  return function(){
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// choose deterministic seed when provided, otherwise allow non-deterministic (but still stable-ish)
const SB_SEED_U32 = (() => {
  if(SB_SEED_RAW){
    // numeric or string
    const n = Number(SB_SEED_RAW);
    if(Number.isFinite(n)) return (n >>> 0);
    return sbHash32(SB_SEED_RAW);
  }
  // if research and no seed -> derive from studyId+studentId later (after meta). Use time fallback now.
  return (Date.now() >>> 0);
})();
let sbRand = sbMakeRNG(SB_SEED_U32);

// ---------- AI Config (PACK-3) ----------
const SB_AI_ENABLED  = true;
const SB_AI_ADAPTIVE = SB_AI_ENABLED && !SB_IS_RESEARCH; // ✅ research-safe
const SB_AI_COACH    = SB_AI_ENABLED;
const SB_AI_PREDICT  = SB_AI_ENABLED;
const SB_AI_TICK_MS  = 1000;

// ---------- DOM ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const sbGameArea   = $('#gameArea') || $('#playArea') || $('#sbPlayArea');
const sbFeedbackEl = $('#feedback') || $('#sbFeedback');

const sbStartBtn = $('#startBtn') || $('#playBtn') || $('#playButton') || $('#sbStartBtn');
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

const sbPlayAgainBtn   = $('#playAgainBtn') || $('#resPlayAgainBtn') || $('#resReplayBtn');
const sbBackHubBtn     = $('#backHubBtn')   || $('#resBackHubBtn')   || $('#resMenuBtn');
const sbDownloadCsvBtn = $('#downloadCsvBtn') || $('#resDownloadCsvBtn');

// ---------- Device detect ----------
function sbDetectDevice() {
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Vive|VR|Pico/i.test(ua)) return 'vrHeadset';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'pc';
}

// ---------- Difficulty Config ----------
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

// ---------- i18n ----------
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
    tipCenter:'ทริค: เล็ง “กลางจอ” แล้วค่อยแตะ/ยิง ลดพลาดได้เยอะ! 🎯',
    tipFocus:'โห โฟกัสดีมาก! ต่อคอมโบยาว ๆ แล้ว FEVER มาแน่ 🔥',
    storm:'STORM WAVE! รับมือให้ทัน! ⚡',
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
    tipCenter:'Tip: Aim center first, then tap/shoot for fewer misses! 🎯',
    tipFocus:'Great focus! Keep the combo—FEVER is coming 🔥',
    storm:'STORM WAVE! ⚡',
  }
};

let sbLang = 'th';

// ---------- Telemetry (PACK-2) ----------
function sbLogEvent(type, data={}){
  const rec = { t: Date.now(), type, ...data };
  try{
    const raw = localStorage.getItem(SB_EVENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(rec);
    if(arr.length > SB_EVENT_MAX) arr.splice(0, arr.length - SB_EVENT_MAX);
    localStorage.setItem(SB_EVENT_KEY, JSON.stringify(arr));
  }catch(_){}
}

// ---------- State ----------
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

  bossQueue:[],
  bossActive:false,
  bossWarned:false,
  activeBoss:null,     // tObj
  activeBossInfo:null, // boss info
};

// ---------- AI State (PACK-3) ----------
const sbAI = {
  lastTickAt: 0,
  actions: [], // {t, ok, rt, boss}
  maxActions: 20,

  fatigue: 0,
  frustration: 0,
  focus: 0.5,
  failRisk: 0.2,

  spawnMs: sbCfg.spawnMs,
  lifeNormalMs: 2300,
  lifeBossMs: 6500,

  lastCoachAt: 0,
  coachCooldownMs: 3500,
};

function sbAI_pushAction(ok, rtMs, isBoss){
  const a = { t: performance.now(), ok: ok?1:0, rt: rtMs||0, boss: isBoss?1:0 };
  sbAI.actions.push(a);
  if(sbAI.actions.length > sbAI.maxActions) sbAI.actions.shift();
}

function sbAI_calcSignals(){
  const w = sbAI.actions;
  if(!w.length){
    sbAI.fatigue = 0;
    sbAI.frustration = 0;
    sbAI.focus = 0.5;
    sbAI.failRisk = 0.2;
    return;
  }
  const n = w.length;
  const miss = w.reduce((s,a)=>s+(a.ok?0:1),0);
  const missRate = miss / n;

  const rtAvg = w.reduce((s,a)=>s+(a.rt||0),0) / n;
  const rtNorm = clamp((rtAvg - 350) / 900, 0, 1);

  const recent = w.slice(Math.max(0,n-6));
  const recentMissRate = recent.reduce((s,a)=>s+(a.ok?0:1),0) / recent.length;

  sbAI.fatigue = clamp(0.55*rtNorm + 0.45*recentMissRate, 0, 1);
  sbAI.frustration = clamp(0.65*missRate + 0.35*recentMissRate, 0, 1);

  const streak = (()=> {
    let s=0;
    for(let i=w.length-1;i>=0;i--){
      if(w[i].ok) s++; else break;
    }
    return s;
  })();
  const streakBoost = clamp(streak/10, 0, 1);
  sbAI.focus = clamp(0.55*(1-sbAI.fatigue) + 0.25*(1-sbAI.frustration) + 0.20*streakBoost, 0, 1);

  sbAI.failRisk = clamp(0.50*sbAI.frustration + 0.35*sbAI.fatigue + 0.15*(1-sbAI.focus), 0, 1);
}

function sbAI_applyDifficulty(){
  const f = sbAI.failRisk;
  const err = f - 0.35;

  const base = (sbDiffCfg[sbDiff]||sbDiffCfg.normal).spawnMs;

  let nextSpawn = base + Math.round(err * 260);
  nextSpawn = clamp(nextSpawn, base-140, base+260);

  let lifeN = 2300 + Math.round(err*260);
  let lifeB = 6500 + Math.round(err*420);
  lifeN = clamp(lifeN, 2000, 2900);
  lifeB = clamp(lifeB, 6000, 7600);

  sbAI.spawnMs      = Math.round(0.75*sbAI.spawnMs + 0.25*nextSpawn);
  sbAI.lifeNormalMs = Math.round(0.75*sbAI.lifeNormalMs + 0.25*lifeN);
  sbAI.lifeBossMs   = Math.round(0.75*sbAI.lifeBossMs + 0.25*lifeB);
}

function sbAI_coach(text){
  if(!SB_AI_COACH) return;
  const now = performance.now();
  if(now - sbAI.lastCoachAt < sbAI.coachCooldownMs) return;
  sbAI.lastCoachAt = now;

  if(sbHUD.coachLine) sbHUD.coachLine.textContent = text;
  sbEmit('hha:coach', { text });
  sbLogEvent('coach', { text });
}

function sbGetLockPx(base=28){
  if(!SB_AI_PREDICT) return base;
  const bump = sbAI.failRisk > 0.70 ? 16 : (sbAI.failRisk > 0.55 ? 8 : 0);
  return base + bump;
}

// storm trigger (Predict -> fun)
let sbStormUntil = 0;
function sbMaybeStorm(now){
  if(!SB_AI_PREDICT) return;
  if(sbState.bossActive) return;
  if(now < sbStormUntil) return;

  if(sbAI.focus > 0.82 && sbState.combo >= 6 && sbRand() < 0.25){
    sbStormUntil = now + 1800;
    const t = sbI18n[sbLang];
    sbAI_coach(t.storm);
    sbLogEvent('storm_start', { focus: sbAI.focus, combo: sbState.combo });

    for(let i=0;i<4;i++){
      setTimeout(()=>{ if(sbState.running && !sbState.paused) sbSpawnTarget(false,null); }, i*120);
    }
  }
}

function sbAI_tick(){
  if(!SB_AI_ENABLED || !sbState.running || sbState.paused) return;

  sbAI_calcSignals();

  if(SB_AI_PREDICT){
    sbLogEvent('predict', {
      failRisk: Math.round(sbAI.failRisk*100)/100,
      fatigue: Math.round(sbAI.fatigue*100)/100,
      focus: Math.round(sbAI.focus*100)/100
    });
  }

  if(SB_AI_ADAPTIVE){
    const prev = sbAI.spawnMs;
    sbAI_applyDifficulty();
    if(Math.abs(sbAI.spawnMs - prev) >= 70){
      sbStartSpawnLoop(); // restart with new interval
    }
  }

  if(SB_AI_COACH){
    const t = sbI18n[sbLang];
    if(sbAI.failRisk > 0.65){
      sbAI_coach(t.tipCenter);
    }else if(sbAI.focus > 0.75 && sbState.combo >= 4){
      sbAI_coach(t.tipFocus);
    }
  }
}

// ---------- Meta persistence ----------
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
}
sbLangButtons.forEach(btn=>{
  btn.addEventListener('click',()=>{
    sbLangButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    sbLang = btn.dataset.lang || 'th';
    sbApplyLang();
  });
});

// ---------- Feedback ----------
function sbShowFeedback(type){
  if(!sbFeedbackEl) return;
  const t = sbI18n[sbLang];

  let txt='';
  if(type==='fever') txt = t.feverLabel;
  else if(type==='perfect') txt = (sbLang==='th'?'Perfect! 💥':'PERFECT!');
  else if(type==='good') txt = (sbLang==='th'?'ดีมาก! ✨':'GOOD!');
  else txt = (sbLang==='th'?'พลาด!':'MISS');

  sbFeedbackEl.textContent = txt;

  // match your css classes (feedback-perfect/good/miss/fever)
  sbFeedbackEl.className = 'feedback ' + (
    type==='fever' ? 'feedback-fever' :
    type==='perfect' ? 'feedback-perfect' :
    type==='good' ? 'feedback-good' :
    'feedback-miss'
  );

  sbFeedbackEl.style.opacity = '1';
  sbFeedbackEl.style.display = 'block';

  setTimeout(()=>{
    if(!sbFeedbackEl) return;
    sbFeedbackEl.style.opacity = '0';
    setTimeout(()=>{ if(sbFeedbackEl) sbFeedbackEl.style.display='none'; }, 140);
  }, type==='fever'?800:420);
}

// ---------- HUD ----------
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
  box.style.display = 'none';
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

// ---------- Boss queue ----------
function sbPrepareBossQueue(){
  const ms = (sbMode==='endless') ? 120000 : sbTimeSec*1000;
  const checkpoints = [0.15,0.35,0.60,0.85].map(r=>Math.round(ms*r));
  sbState.bossQueue = SB_BOSSES.map((b,idx)=>({
    bossIndex: idx,
    spawnAtMs: checkpoints[idx] || Math.round(ms*(0.2+idx*0.15))
  }));
}

// ---------- Spawn (PACK-4 anti-overlap + safe zones) ----------
let sbTargetIdCounter = 1;

// returns list of active target rects in local coords of gameArea
function sbGetActiveRectsLocal(){
  if(!sbGameArea) return [];
  const gr = sbGameArea.getBoundingClientRect();
  const out = [];
  for(const t of sbState.targets){
    if(!t.alive || !t.el) continue;
    const r = t.el.getBoundingClientRect();
    out.push({
      x: r.left - gr.left,
      y: r.top - gr.top,
      w: r.width,
      h: r.height
    });
  }
  return out;
}
function sbRectIntersects(a,b, pad=10){
  return !(
    (a.x + a.w + pad) < b.x ||
    (b.x + b.w + pad) < a.x ||
    (a.y + a.h + pad) < b.y ||
    (b.y + b.h + pad) < a.y
  );
}

function sbPickSpawnXY(sizePx){
  if(!sbGameArea) return { x:20, y:20 };

  const rect = sbGameArea.getBoundingClientRect();
  const pad = 18;

  // safeTop: กันชน Boss HUD + กันชนขอบบน
  const safeTop = 62;

  const maxX = Math.max(0, rect.width - sizePx - pad*2);
  const maxY = Math.max(0, rect.height - sizePx - pad*2 - safeTop);

  // fallback ถ้าพื้นที่เล็กมาก
  if(maxX <= 6 || maxY <= 6){
    return { x: pad, y: safeTop + pad };
  }

  const existing = sbGetActiveRectsLocal();

  // try multiple times to avoid overlaps
  for(let i=0;i<14;i++){
    const x = pad + sbRand()*maxX;
    const y = pad + safeTop + sbRand()*maxY;

    const cand = { x, y, w: sizePx, h: sizePx };

    let ok = true;
    for(const ex of existing){
      if(sbRectIntersects(cand, ex, 12)){ ok=false; break; }
    }
    if(ok) return { x, y };
  }

  // give up: still spawn somewhere safe
  return { x: pad + sbRand()*maxX, y: pad + safeTop + sbRand()*maxY };
}

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
    createdAt: performance.now(),
    spawnAtMs: performance.now(), // ✅ RT
    kind: isBoss ? 'boss' : 'normal',
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
    sbLogEvent('boss_spawn', { bossId: bossInfo.id, name });
  }

  // life timer -> miss
  const lifeMs = isBoss
    ? (SB_AI_ADAPTIVE ? sbAI.lifeBossMs : 6500)
    : (SB_AI_ADAPTIVE ? sbAI.lifeNormalMs : 2300);

  tObj.missTimer = setTimeout(()=>{
    if(!tObj.alive) return;
    tObj.alive=false;

    try{ tObj.el && tObj.el.remove(); }catch(_){}

    sbState.miss++;
    sbAI_pushAction(false, 0, tObj.boss); // ✅ AI input
    sbLogEvent('miss_timeout', { boss: tObj.boss?1:0, comboBeforeReset: sbState.combo });

    sbState.combo=0;
    sbUpdateHUD();
    sbShowFeedback('miss');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachMiss;

    if(tObj.boss){
      sbState.bossActive=false;
      sbState.activeBoss=null;
      sbState.activeBossInfo=null;
      sbSetBossHudVisible(false);
      sbLogEvent('boss_timeout', {});
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

// ---------- FEVER ----------
function sbEnterFever(){
  sbState.fever=true;
  sbState.feverUntil = performance.now() + 3500;
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachFever;
  if(sbGameArea) sbGameArea.classList.add('fever');
  sbShowFeedback('fever');
  sbEmit('hha:coach', { text: sbI18n[sbLang].coachFever, fever:true });
  sbLogEvent('fever_start', { combo: sbState.combo });
}
function sbCheckFeverTick(now){
  if(sbState.fever && now >= sbState.feverUntil){
    sbState.fever=false;
    if(sbGameArea) sbGameArea.classList.remove('fever');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachReady;
    sbLogEvent('fever_end', {});
  }
}

// ---------- Hit logic ----------
function sbHitTarget(tObj){
  if(!sbState.running || sbState.paused || !tObj.alive) return;

  const now = performance.now();
  const rtMs = Math.max(0, Math.round(now - (tObj.spawnAtMs || now)));

  // reduce hp
  tObj.hp -= 1;

  sbState.hit++;
  const isBoss = tObj.boss;
  const bossInfo = tObj.bossInfo;

  // Good hit (hp remaining)
  if(tObj.hp > 0){
    sbState.good++;
    sbState.combo++;
    sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

    const base = isBoss ? 70 : 50;
    const comboBonus = Math.min(sbState.combo*5, 60);
    const feverBonus = sbState.fever ? 30 : 0;
    const gained = base + comboBonus + feverBonus;
    sbState.score += gained;

    sbAI_pushAction(true, rtMs, isBoss); // ✅ AI input
    sbLogEvent('hit', { boss:isBoss?1:0, hpAfter:tObj.hp, rtMs, combo:sbState.combo, score:sbState.score });

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
        sbLogEvent('boss_near', { bossId: bossInfo.id, hp: tObj.hp });
      }
    }

    sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss });
    return;
  }

  // Perfect kill (hp <= 0)
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

  sbAI_pushAction(true, rtMs, isBoss); // ✅ AI input
  sbLogEvent('kill', { boss:isBoss?1:0, rtMs, combo:sbState.combo, score:sbState.score });

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

    sbState.bossActive=false;
    sbState.activeBoss=null;
    sbState.activeBossInfo=null;
    sbSetBossHudVisible(false);

    sbLogEvent('boss_down', { bossId: bossInfo.id, name });

    // next boss right away (feel)
    sbSpawnNextBossImmediate();
  }

  sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss });
}

// ---------- crosshair shoot (HeroHealth vr-ui.js) ----------
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
  const lock = sbGetLockPx(d.lockPx || 28);
  sbHitNearestTargetAtScreenXY(d.x, d.y, lock);
});

// keyboard space (pc) — quick assist testing
window.addEventListener('keydown',(ev)=>{
  if(!sbState.running || sbState.paused) return;
  if(ev.code==='Space'){
    ev.preventDefault();
    if(!sbGameArea) return;
    const rect = sbGameArea.getBoundingClientRect();
    sbHitNearestTargetAtScreenXY(rect.left+rect.width/2, rect.top+rect.height/2, 90);
  }
});

// ---------- spawning loop ----------
function sbStartSpawnLoop(){
  if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);

  const ms = SB_AI_ADAPTIVE ? sbAI.spawnMs : sbCfg.spawnMs;

  sbState.spawnTimer = setInterval(()=>{
    if(!sbState.running || sbState.paused) return;
    if(sbRand() < 0.1) return;
    if(sbState.bossActive && sbRand()<0.5) return;
    sbSpawnTarget(false, null);
  }, ms);
}
function sbStopSpawnLoop(){
  if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer=null;
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

  sbCheckFeverTick(now);
  sbMaybeSpawnBoss();

  // AI tick + predict fun
  if(now - sbAI.lastTickAt >= SB_AI_TICK_MS){
    sbAI.lastTickAt = now;
    sbAI_tick();
  }
  sbMaybeStorm(now);

  requestAnimationFrame(sbMainLoop);
}

// ---------- local session logging (CSV) ----------
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
      'accuracy','maxCombo','fever','timeUsedSec','seed','research','reason','createdAt'
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

// optional: events export (เผื่อ ML)
function sbDownloadEventsJson(){
  try{
    const raw = localStorage.getItem(SB_EVENT_KEY);
    if(!raw){ alert('ยังไม่มี event log'); return; }
    const blob = new Blob([raw],{type:'application/json;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download='ShadowBreakerEvents.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }catch(_){
    alert('export events ไม่สำเร็จ');
  }
}

// ---------- end/start ----------
function sbSaveLastSummary(summary){
  try{
    localStorage.setItem(SB_LAST_SUMMARY_KEY, JSON.stringify(summary));
  }catch(_){}
}

function sbEndGame(reason='end'){
  if(!sbState.running) return;

  sbState.running=false;
  sbState.paused=false;
  sbStopSpawnLoop();

  // clean targets
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
    sessionId:  String(Date.now()),

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
    seed:       SB_SEED_RAW || String(SB_SEED_U32),
    research:   SB_IS_RESEARCH ? 1 : 0,
    reason,
    createdAt:  new Date().toISOString(),
  };

  sbLogLocal(rec);

  // save last summary for hub usage
  sbSaveLastSummary({
    gameId: SB_GAME_ID,
    gameVersion: SB_GAME_VERSION,
    at: rec.createdAt,
    hub: (qs('hub','')||'').trim(),
    score: rec.score,
    acc: rec.accuracy,
    hits: rec.hits,
    miss: rec.miss,
    maxCombo: rec.maxCombo,
    timeUsedSec: rec.timeUsedSec,
    reason: rec.reason,
    seed: rec.seed,
    research: rec.research
  });

  // update overlay UI
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

  sbLogEvent('session_end', { score: rec.score, acc: rec.accuracy, reason });
}

function sbStartGame(){
  if(sbState.running) return;

  const t = sbI18n[sbLang];

  // meta requirement only in research
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

  // If research and no seed provided, derive deterministic seed now from studyId + sid + diff
  if(SB_IS_RESEARCH && !SB_SEED_RAW){
    const studyId = (qs('studyId','')||'').trim();
    const mix = `${studyId}|${meta.studentId}|${sbDiff}|${sbPhase}|${sbMode}|${sbTimeSec}`;
    const u32 = sbHash32(mix);
    sbRand = sbMakeRNG(u32);
    sbLogEvent('seed_derived', { u32, mixPreview: mix.slice(0,60) });
  }

  document.body.classList.add('play-only');

  sbResetStats();
  sbPrepareBossQueue();

  sbState.running=true;
  sbState.paused=false;
  sbState.startTime=0;
  sbLastTimeTick = -1;
  sbAI.lastTickAt = 0;
  sbStormUntil = 0;

  if(sbStartBtn){
    sbStartBtn.disabled=true;
    sbStartBtn.style.opacity=0.75;
  }
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;

  sbLogEvent('session_start', {
    phase: sbPhase, mode: sbMode, diff: sbDiff,
    timeSec: (sbMode==='endless') ? 0 : sbTimeSec,
    research: SB_IS_RESEARCH ? 1 : 0
  });

  // HHA start event
  sbEmit('hha:start', {
    gameId: SB_GAME_ID,
    gameVersion: SB_GAME_VERSION,
    phase: sbPhase,
    mode: sbMode,
    diff: sbDiff,
    timeSec: (sbMode==='endless') ? 0 : sbTimeSec,
    seed: SB_SEED_RAW || String(SB_SEED_U32),
    research: SB_IS_RESEARCH ? 1 : 0
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
      sbState.pauseAt = performance.now();
      sbStopSpawnLoop();
      sbEmit('hha:coach', { text: 'Paused' });
      sbLogEvent('pause', {});
    }else if(!v && sbState.paused){
      sbState.paused=false;
      if(sbState.startTime && sbState.pauseAt){
        const pausedDur = performance.now() - sbState.pauseAt;
        sbState.startTime += pausedDur;
      }
      sbStartSpawnLoop();
      sbEmit('hha:coach', { text: 'Resumed' });
      sbLogEvent('resume', {});
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
    location.href = hub || '../hub.html';
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