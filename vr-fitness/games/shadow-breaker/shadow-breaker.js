// === vr-fitness/games/shadow-breaker/shadow-breaker.js ===
// Shadow Breaker — PRODUCTION + AI Pack (v1.1.0-prod-ai)
// ✅ HeroHealth-like: hha:shoot support (crosshair/tap-to-shoot via vr-ui.js)
// ✅ HHA events: hha:start / hha:time / hha:score / hha:coach / hha:end / hha:flush
// ✅ Boss HUD bar + safe spawn + feedback fixed
// ✅ Pass-through: hub/view/seed/research/studyId/log etc.
// ✅ Pack 24A: Boss Super-Patterns (Storm burst / Iron feint / Dragon rage-final)
// ✅ Pack 24B: AI Coach explainable + rate-limit
// ✅ Pack 24C: Predict (RT/flow) + fair Difficulty Director (spawnMs live adjust)

'use strict';

// -------------------- Identity --------------------
const SB_GAME_ID = 'shadow-breaker';
const SB_GAME_VERSION = '1.1.0-prod-ai';

// -------------------- Storage keys --------------------
const SB_STORAGE_KEY = 'ShadowBreakerSessions_v1';
const SB_META_KEY    = 'ShadowBreakerMeta_v1';

// -------------------- Query / pass-through --------------------
function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }

const sbPhase = (qs('phase','train')||'train').toLowerCase();
const sbMode  = (qs('mode','timed')||'timed').toLowerCase();
const sbDiff  = (qs('diff','normal')||'normal').toLowerCase();

const sbTimeSec = (()=> {
  const t = parseInt(qs('time','60'),10);
  return (Number.isFinite(t) && t>=20 && t<=300) ? t : 60;
})();

const SB_SEED = (qs('seed','')||'').trim(); // can be numeric or string
const SB_IS_RESEARCH = (()=> {
  const r = (qs('research','')||'').toLowerCase();
  return r==='1' || r==='true' || r==='on' || !!qs('studyId','') || !!qs('log','');
})();

// -------------------- DOM helpers --------------------
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

// รองรับหลาย id ที่หน้าเก่าอาจใช้
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

// -------------------- tiny utilities --------------------
function sbEmit(name, detail = {}){ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){} }
function clamp(n,a,b){ n=+n; if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b,n)); }
function sbNow(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }

// -------------------- Deterministic RNG (seeded) --------------------
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i=0; i<str.length; i++){
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
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRNG(seedStr){
  const s = (seedStr && String(seedStr).trim()) ? String(seedStr).trim() : '';
  if(!s) return Math.random;
  const seedFn = xmur3(s);
  return mulberry32(seedFn());
}
const sbRand = makeRNG(SB_SEED);

// -------------------- Device detect --------------------
function sbDetectDevice() {
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vrHeadset';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'pc';
}

// -------------------- Config --------------------
const sbDiffCfg = {
  easy:   { spawnMs: 900, bossHp: 6 },
  normal: { spawnMs: 700, bossHp: 9 },
  hard:   { spawnMs: 520, bossHp: 12 },
};
const sbCfg = sbDiffCfg[sbDiff] || sbDiffCfg.normal;

// -------------------- Boss & emojis --------------------
const SB_NORMAL_EMOJIS = ['🎯','💥','⭐','⚡','🔥','🥎','🌀'];
const SB_BOSSES = [
  { id: 1, emoji:'💧', nameTh:'Bubble Glove',  nameEn:'Bubble Glove',  hpBonus:0 },
  { id: 2, emoji:'⛈️', nameTh:'Storm Knuckle', nameEn:'Storm Knuckle', hpBonus:2 },
  { id: 3, emoji:'🥊', nameTh:'Iron Fist',     nameEn:'Iron Fist',     hpBonus:4 },
  { id: 4, emoji:'🐲', nameTh:'Golden Dragon', nameEn:'Golden Dragon', hpBonus:6 },
];

// -------------------- i18n --------------------
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
    tipAim:'💡 ทิป: เล็งกลางจอแล้วค่อยกด/แตะ เพราะพลาดจากรีบเกินไป',
    tipFeint:'💡 ทิป: เป้าหลอกจะสีจืด คะแนนน้อย—อย่าเสียคอมโบกับมันมาก',
    flowHigh:(rt)=>`🔥 เข้าฟอร์ม! เร่งความเร็วเล็กน้อย (RT~${rt}ms)`,
    flowLow:(rt)=>`🛟 ผ่อนจังหวะให้แล้ว เพราะพลาดติดกัน (RT~${rt}ms)`,
    storm:'⛈️ พายุมาแล้ว!',
    rage:'🐲 RAGE! เร่งมือ!',
    paused:'Paused',
    resumed:'Resumed',
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
    tipAim:'💡 Tip: aim center then tap/shoot—most misses come from rushing',
    tipFeint:'💡 Tip: feints are dim + low score—don’t waste combo chasing them',
    flowHigh:(rt)=>`🔥 Great flow! Slightly faster (RT~${rt}ms)`,
    flowLow:(rt)=>`🛟 Slowed down because of miss streak (RT~${rt}ms)`,
    storm:'⛈️ Storm burst!',
    rage:'🐲 RAGE! Faster!',
    paused:'Paused',
    resumed:'Resumed',
  }
};

let sbLang = 'th';

// -------------------- AI Coach (Pack 24B) --------------------
const SB_COACH = { enabled:true, minGapMs: 1800, lastAt: 0 };
function sbAiCoachSay(text, opt={}){
  if(!SB_COACH.enabled) return;
  const now = sbNow();
  const force = !!opt.force;
  if(!force && (now - SB_COACH.lastAt) < SB_COACH.minGapMs) return;
  SB_COACH.lastAt = now;

  if(sbHUD.coachLine) sbHUD.coachLine.textContent = text;
  sbEmit('hha:coach', { text, ...opt });
  sbEvtPush('coach', { text, ...opt });
}

// -------------------- Event buffer (optional, safe) --------------------
function sbEvtPush(type, payload={}){
  try{
    window.__SB_EVENTS__ = window.__SB_EVENTS__ || [];
    window.__SB_EVENTS__.push({
      t: new Date().toISOString(),
      ms: Math.round(sbNow()),
      type,
      ...payload
    });
    // keep it small
    if(window.__SB_EVENTS__.length > 500) window.__SB_EVENTS__.splice(0, 120);
  }catch(_){}
}

// -------------------- Predict (Pack 24C) --------------------
const sbPred = {
  lastHitAt: 0,
  rtEma: 560,           // ms
  missStreak: 0,
  hitStreak: 0,
  flow: 0.5,            // 0..1
  lastEvalAt: 0,
};
function ema(prev, x, a){ return prev + a*(x - prev); }

// live spawn ms (Difficulty Director output)
let sbSpawnMsLive = sbCfg.spawnMs;

function sbSetSpawnMs(ms){
  ms = Math.round(ms);
  if(!Number.isFinite(ms)) return;
  if(ms === sbSpawnMsLive) return;
  sbSpawnMsLive = ms;
  // restart interval safely
  if(sbState.running && !sbState.paused){
    sbStartSpawnLoop();
  }
}

function sbPredictEval(){
  const now = sbNow();
  if(now - sbPred.lastEvalAt < 1200) return;
  sbPred.lastEvalAt = now;

  const attempts = sbState.hit + sbState.miss;
  const accNow = attempts > 0 ? (sbState.hit / attempts) : 0.5;

  // RT score: 250ms best -> 0, 1150ms worst -> 1 (clamped)
  const rtScore = 1 - clamp((sbPred.rtEma - 250) / 900, 0, 1);
  const streakScore = clamp(sbState.combo / 10, 0, 1);

  let flow = 0.45*rtScore + 0.35*accNow + 0.20*streakScore;
  if(sbPred.missStreak >= 2) flow *= 0.82;

  sbPred.flow = ema(sbPred.flow, flow, 0.22);

  // fair director: small, bounded adjustment around base
  const base = sbCfg.spawnMs;
  const adj = Math.round((0.55 - sbPred.flow) * 140); // +/- ~80-100ms
  const newSpawn = clamp(base + adj, base - 120, base + 180);

  sbSetSpawnMs(newSpawn);

  const rt = Math.round(sbPred.rtEma);
  if(sbPred.flow > 0.72){
    sbAiCoachSay(sbI18n[sbLang].flowHigh(rt));
  }else if(sbPred.flow < 0.42 && sbPred.missStreak >= 2){
    sbAiCoachSay(sbI18n[sbLang].flowLow(rt));
  }

  sbEvtPush('predict', { flow:+sbPred.flow.toFixed(3), rtEma:rt, spawnMs:newSpawn, acc:+accNow.toFixed(3) });
}

// -------------------- Boss Patterns (Pack 24A) --------------------
const SB_BOSS_PATTERN = {
  stormBurstEveryMs: 2200,
  stormBurstCount: [2,3],
  feintChance: 0.22,
  rageAtHp: 2,          // hp <= 2 triggers rage
  rageLifeMs: 1500,
  rageBonus: 25,        // extra score during rage hits
};

const sbBossPattern = {
  lastStormBurstAt: 0,
  inRage: false,
};

function sbBossPatternReset(){
  sbBossPattern.lastStormBurstAt = 0;
  sbBossPattern.inRage = false;
}

// -------------------- Apply language --------------------
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

// -------------------- Meta persistence --------------------
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

// -------------------- State --------------------
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

// -------------------- Feedback --------------------
function sbShowFeedback(type){
  if(!sbFeedbackEl) return;
  const t = sbI18n[sbLang];
  let txt='';
  if(type==='fever') txt = t.feverLabel;
  else if(type==='perfect') txt = (sbLang==='th'?'Perfect! 💥':'PERFECT!');
  else if(type==='good') txt = (sbLang==='th'?'ดีมาก! ✨':'GOOD!');
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

function sbResetStats(){
  sbState.score=0; sbState.hit=0; sbState.perfect=0; sbState.good=0; sbState.miss=0;
  sbState.combo=0; sbState.maxCombo=0;
  sbState.elapsedMs=0;
  sbState.fever=false; sbState.feverUntil=0;

  sbState.targets=[];
  sbState.bossQueue=[]; sbState.bossActive=false; sbState.bossWarned=false;
  sbState.activeBoss=null; sbState.activeBossInfo=null;

  sbBossPatternReset();

  // reset predict
  sbPred.lastHitAt = 0;
  sbPred.rtEma = 560;
  sbPred.missStreak = 0;
  sbPred.hitStreak = 0;
  sbPred.flow = 0.5;
  sbPred.lastEvalAt = 0;

  // reset spawn ms live
  sbSpawnMsLive = sbCfg.spawnMs;

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

// -------------------- Boss HUD bar --------------------
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

// -------------------- Boss queue --------------------
function sbPrepareBossQueue(){
  const ms = (sbMode==='endless') ? 120000 : sbTimeSec*1000; // endless: schedule within first 2 min
  const checkpoints = [0.15,0.35,0.6,0.85].map(r=>Math.round(ms*r));
  sbState.bossQueue = SB_BOSSES.map((b,idx)=>({
    bossIndex: idx,
    spawnAtMs: checkpoints[idx] || Math.round(ms*(0.2+idx*0.15))
  }));
}

// -------------------- Safe spawn (avoid HUD zone) --------------------
let sbTargetIdCounter = 1;

function sbPickSpawnXY(sizePx){
  if(!sbGameArea){
    return { x:20, y:20 };
  }
  const rect = sbGameArea.getBoundingClientRect();
  const pad = 18;

  // SAFE top zone: กันชน boss hud
  const safeTop = 56;

  const maxX = Math.max(0, rect.width - sizePx - pad*2);
  const maxY = Math.max(0, rect.height - sizePx - pad*2 - safeTop);

  const x = pad + sbRand()*maxX;
  const y = pad + safeTop + sbRand()*maxY;
  return { x, y };
}

// -------------------- Spawn target (+ lifeMs override + feint) --------------------
function sbSpawnTarget(isBoss=false, bossInfo=null, opt={}){
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
    missTimer: null,
    isFeint: !!opt.feint,
    spawnedLifeMs: 0,
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
    const emo = SB_NORMAL_EMOJIS[Math.floor(sbRand()*SB_NORMAL_EMOJIS.length)];
    el.style.background = sbState.fever
      ? 'radial-gradient(circle at 30% 20%, #facc15, #eab308)'
      : 'radial-gradient(circle at 30% 20%, #38bdf8, #0ea5e9)';
    el.textContent = emo;

    if(tObj.isFeint){
      el.style.filter = 'saturate(.6) brightness(.9)';
      el.style.opacity = '0.92';
      el.dataset.feint = '1';
    }
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

    sbBossPatternReset();
    sbSetBossHudVisible(true);
    sbUpdateBossHud();

    const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
    sbAiCoachSay(sbI18n[sbLang].bossAppear(name), { boss: bossInfo.id, force:true });
  }

  // life timer -> miss (only if still alive)
  const lifeMs = (opt.lifeMs ?? (isBoss ? 6500 : 2300));
  tObj.spawnedLifeMs = lifeMs;

  tObj.missTimer = setTimeout(()=>{
    if(!tObj.alive) return;
    tObj.alive=false;
    try{ tObj.el && tObj.el.remove(); }catch(_){}

    // miss from timeout
    sbState.miss++;
    sbState.combo=0;
    sbPred.missStreak++;
    sbPred.hitStreak=0;

    sbUpdateHUD();
    sbShowFeedback('miss');

    if(sbPred.missStreak % 2 === 0){
      sbAiCoachSay(sbI18n[sbLang].tipAim);
    }else{
      if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachMiss;
    }

    // if boss timed out -> mark boss inactive
    if(tObj.boss){
      sbState.bossActive=false;
      sbState.activeBoss=null;
      sbState.activeBossInfo=null;
      sbSetBossHudVisible(false);
      sbBossPatternReset();
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

// -------------------- Boss Pattern Tick (Pack 24A) --------------------
function sbBossPatternTick(){
  if(!sbState.running || sbState.paused) return;
  if(!sbState.bossActive || !sbState.activeBossInfo || !sbState.activeBoss) return;

  const info = sbState.activeBossInfo;
  const now = sbNow();

  // ⛈️ Storm burst: spawn burst of normal targets
  if(info.emoji === '⛈️'){
    if(now - sbBossPattern.lastStormBurstAt >= SB_BOSS_PATTERN.stormBurstEveryMs){
      sbBossPattern.lastStormBurstAt = now;
      const [a,b] = SB_BOSS_PATTERN.stormBurstCount;
      const n = a + Math.floor(sbRand()*(b-a+1));

      for(let i=0;i<n;i++){
        if(sbState.targets.length < 10) sbSpawnTarget(false, null, { lifeMs: 1900 });
      }
      sbAiCoachSay(sbI18n[sbLang].storm, { boss: info.id });
      sbEvtPush('storm_burst', { n, boss: info.id });
    }
  }

  // 🥊 Iron Fist feint: occasionally spawn a feint target
  if(info.emoji === '🥊'){
    if(sbRand() < SB_BOSS_PATTERN.feintChance && sbState.targets.length < 9){
      sbSpawnTarget(false, null, { lifeMs: 1400, feint:true });
      sbAiCoachSay(sbI18n[sbLang].tipFeint);
      sbEvtPush('feint_spawn', { boss: info.id });
    }
  }

  // 🐲 Dragon rage: when hp low -> boss becomes "final" (bigger) + shorter remaining life
  if(info.emoji === '🐲'){
    if(!sbBossPattern.inRage && sbState.activeBoss.hp <= SB_BOSS_PATTERN.rageAtHp){
      sbBossPattern.inRage = true;
      try{
        sbState.activeBoss.el && sbState.activeBoss.el.classList.add('boss-final');
      }catch(_){}

      // shorten remaining boss life to create pressure
      try{
        if(sbState.activeBoss.missTimer) clearTimeout(sbState.activeBoss.missTimer);
      }catch(_){}
      sbState.activeBoss.missTimer = setTimeout(()=>{
        const tObj = sbState.activeBoss;
        if(!tObj || !tObj.alive) return;
        tObj.alive = false;
        try{ tObj.el && tObj.el.remove(); }catch(_){}

        sbState.miss++;
        sbState.combo = 0;

        sbPred.missStreak++;
        sbPred.hitStreak=0;

        sbUpdateHUD();
        sbShowFeedback('miss');
        sbAiCoachSay(sbI18n[sbLang].tipAim);

        // boss out
        sbState.bossActive=false;
        sbState.activeBoss=null;
        sbState.activeBossInfo=null;
        sbSetBossHudVisible(false);
        sbBossPatternReset();
      }, SB_BOSS_PATTERN.rageLifeMs);

      sbAiCoachSay(sbI18n[sbLang].rage, { boss: info.id, force:true });
      sbEvtPush('boss_rage', { boss: info.id });
    }
  }
}

// -------------------- Fever --------------------
function sbEnterFever(){
  sbState.fever=true;
  sbState.feverUntil = sbNow() + 3500;
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachFever;
  if(sbGameArea) sbGameArea.classList.add('fever');
  sbShowFeedback('fever');
  sbEmit('hha:coach', { text: sbI18n[sbLang].coachFever, fever:true });
  sbEvtPush('fever_on', {});
}
function sbCheckFeverTick(now){
  if(sbState.fever && now >= sbState.feverUntil){
    sbState.fever=false;
    if(sbGameArea) sbGameArea.classList.remove('fever');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = sbI18n[sbLang].coachReady;
    sbEvtPush('fever_off', {});
  }
}

// -------------------- Hit logic --------------------
function sbHitTarget(tObj){
  if(!sbState.running || sbState.paused || !tObj.alive) return;

  // reduce hp
  tObj.hp -= 1;

  // hit counts
  sbState.hit++;
  const isBoss = tObj.boss;
  const bossInfo = tObj.bossInfo;
  const isFeint = !!tObj.isFeint;

  // update predict RT
  const now = sbNow();
  if(sbPred.lastHitAt){
    const rt = Math.max(120, Math.min(1800, now - sbPred.lastHitAt));
    sbPred.rtEma = ema(sbPred.rtEma, rt, 0.18);
  }
  sbPred.lastHitAt = now;
  sbPred.hitStreak++;
  sbPred.missStreak = 0;

  // good hit (still alive)
  if(tObj.hp > 0){
    sbState.good++;
    sbState.combo++;
    sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

    let base = isBoss ? 70 : (isFeint ? 15 : 50);
    if(isBoss && sbBossPattern.inRage) base += SB_BOSS_PATTERN.rageBonus;

    const comboBonus = Math.min(sbState.combo*5, 60);
    const feverBonus = (sbState.fever && !isFeint) ? 30 : 0;
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
        sbEvtPush('boss_near', { boss: bossInfo.id, hp:tObj.hp });
      }
    }

    sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss });
    sbEvtPush('hit_good', { gained, boss:!!isBoss, feint:isFeint?1:0, hp:tObj.hp });

    // run predictor
    sbPredictEval();
    return;
  }

  // perfect kill
  tObj.alive=false;
  if(tObj.missTimer) { clearTimeout(tObj.missTimer); tObj.missTimer=null; }

  sbState.perfect++;
  sbState.combo++;
  sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

  let base = isBoss ? 200 : (isFeint ? 25 : 80);
  if(isBoss && sbBossPattern.inRage) base += (SB_BOSS_PATTERN.rageBonus + 25);

  const comboBonus = Math.min(sbState.combo*8, 100);
  const feverBonus = (sbState.fever && !isFeint) ? 80 : 0;
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

  if(!isFeint && sbState.combo >= 5 && !sbState.fever) sbEnterFever();
  else sbShowFeedback('perfect');

  if(isBoss){
    const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
    sbEmit('hha:coach', { text: sbI18n[sbLang].bossClear(name), boss: bossInfo.id });
    sbEvtPush('boss_clear', { boss: bossInfo.id });

    sbState.bossActive=false;
    sbState.activeBoss=null;
    sbState.activeBossInfo=null;
    sbSetBossHudVisible(false);
    sbBossPatternReset();

    // next boss right away (feel)
    sbSpawnNextBossImmediate();
  }

  sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss });
  sbEvtPush('hit_kill', { gained, boss:!!isBoss, feint:isFeint?1:0 });

  // run predictor
  sbPredictEval();
}

// -------------------- crosshair shoot (HeroHealth vr-ui.js) --------------------
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
  sbHitNearestTargetAtScreenXY(d.x, d.y, d.lockPx || 28);
});

// keyboard space (pc)
window.addEventListener('keydown',(ev)=>{
  if(!sbState.running || sbState.paused) return;
  if(ev.code==='Space'){
    ev.preventDefault();
    if(!sbGameArea) return;
    const rect = sbGameArea.getBoundingClientRect();
    sbHitNearestTargetAtScreenXY(rect.left+rect.width/2, rect.top+rect.height/2, 90);
  }
});

// -------------------- spawning --------------------
function sbStartSpawnLoop(){
  if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer = setInterval(()=>{
    if(!sbState.running || sbState.paused) return;

    // leave gaps sometimes
    if(sbRand() < 0.1) return;

    // prevent clutter during boss
    if(sbState.bossActive && sbRand() < 0.5) return;

    // anti-clutter hard cap
    if(sbState.targets.length > 12) return;

    sbSpawnTarget(false, null);
  }, sbSpawnMsLive);
}
function sbStopSpawnLoop(){
  if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer=null;
}

// -------------------- loop --------------------
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

    // time tick event each second
    if(remain !== sbLastTimeTick){
      sbLastTimeTick = remain;
      sbEmit('hha:time', { remainSec: remain, elapsedMs: Math.round(sbState.elapsedMs) });
    }

    if(sbState.elapsedMs >= sbState.durationMs){
      sbEndGame('timeup');
      return;
    }
  }else{
    // endless: show elapsed
    const sec = Math.floor(sbState.elapsedMs/1000);
    if(sbHUD.timeVal) sbHUD.timeVal.textContent = String(sec);
    if(sec !== sbLastTimeTick){
      sbLastTimeTick = sec;
      sbEmit('hha:time', { elapsedSec: sec, elapsedMs: Math.round(sbState.elapsedMs) });
    }
  }

  sbCheckFeverTick(now);
  sbMaybeSpawnBoss();

  // Pack 24A: boss patterns tick
  sbBossPatternTick();

  // Pack 24C: predict tick (also gets called on hits; this is just periodic)
  sbPredictEval();

  requestAnimationFrame(sbMainLoop);
}

// -------------------- logging local csv --------------------
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
      'phase','mode','diff','gameId','gameVersion','sessionId',
      'timeSec','score','hits','perfect','good','miss',
      'accuracy','maxCombo','fever','timeUsedSec',
      'seed','research','flowAvg','rtEmaEnd','spawnMsEnd','reason','createdAt'
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

// -------------------- end/start --------------------
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

    seed:       SB_SEED,
    research:   SB_IS_RESEARCH ? 1 : 0,

    // Pack 24C snapshots (research-friendly)
    flowAvg:    +sbPred.flow.toFixed(3),
    rtEmaEnd:   Math.round(sbPred.rtEma),
    spawnMsEnd: Math.round(sbSpawnMsLive),

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

  sbEvtPush('end', { reason, score: sbState.score, acc, flow: sbPred.flow, rtEma: sbPred.rtEma, spawnMs: sbSpawnMsLive });
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

  document.body.classList.add('play-only');

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

  // HHA start event
  sbEmit('hha:start', {
    gameId: SB_GAME_ID,
    gameVersion: SB_GAME_VERSION,
    phase: sbPhase,
    mode: sbMode,
    diff: sbDiff,
    timeSec: (sbMode==='endless') ? 0 : sbTimeSec,
    seed: SB_SEED,
    research: SB_IS_RESEARCH ? 1 : 0
  });

  sbEvtPush('start', { phase:sbPhase, mode:sbMode, diff:sbDiff, timeSec:sbTimeSec, seed:SB_SEED, research:SB_IS_RESEARCH?1:0 });

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
      sbAiCoachSay(sbI18n[sbLang].paused, { force:true });
    }else if(!v && sbState.paused){
      sbState.paused=false;
      // shift startTime to keep elapsed stable
      if(sbState.startTime && sbState.pauseAt){
        const pausedDur = sbNow() - sbState.pauseAt;
        sbState.startTime += pausedDur;
      }
      sbStartSpawnLoop();
      sbAiCoachSay(sbI18n[sbLang].resumed, { force:true });
    }
  }
});

// -------------------- buttons --------------------
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

// -------------------- init --------------------
sbLoadMeta();
sbApplyLang();

if(sbHUD.timeVal){
  sbHUD.timeVal.textContent = (sbMode==='endless' ? '0' : String(sbTimeSec));
}