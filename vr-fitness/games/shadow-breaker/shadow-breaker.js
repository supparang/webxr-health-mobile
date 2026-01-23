// === vr-fitness/games/shadow-breaker/shadow-breaker.js ===
// Shadow Breaker — Production v1.1.0
// ✅ HeroHealth-like: hha:shoot support (crosshair/tap-to-shoot via vr-ui.js)
// ✅ HHA events: hha:start / hha:time / hha:score / hha:coach / hha:end / hha:flush
// ✅ Boss HUD bar + safe spawn + feedback class mapping fixed
// ✅ Pass-through: hub/view/seed/research/studyId/log etc.
// ✅ Local session store + CSV download

'use strict';

const SB_GAME_ID = 'shadow-breaker';
const SB_GAME_VERSION = '1.1.0-prod';

const SB_STORAGE_KEY = 'ShadowBreakerSessions_v1';
const SB_META_KEY    = 'ShadowBreakerMeta_v1';

function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }
function clamp(n,a,b){ n=+n; if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b,n)); }
function sbEmit(name, detail = {}){ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){} }

const sbPhase   = (qs('phase','train')||'train').toLowerCase();
const sbMode    = (qs('mode','timed')||'timed').toLowerCase();   // timed|endless
const sbDiff    = (qs('diff','normal')||'normal').toLowerCase(); // easy|normal|hard
const sbTimeSec = (()=>{ const t=parseInt(qs('time','60'),10); return (Number.isFinite(t)&&t>=20&&t<=300)?t:60; })();
const SB_SEED_RAW = (qs('seed','')||'').trim();

const SB_IS_RESEARCH = (()=> {
  const r = (qs('research','')||'').toLowerCase();
  return r==='1' || r==='true' || r==='on' || !!qs('studyId','') || !!qs('log','');
})();

// ---------- DOM ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

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

// ---------- Device detect ----------
function sbDetectDevice() {
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Vive|VR|WebXR/i.test(ua)) return 'vrHeadset';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'pc';
}

// ---------- Seeded RNG (deterministic when seed exists + research) ----------
function hash32(str){
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRNG(seedStr){
  // LCG
  let x = (seedStr ? hash32(seedStr) : (Date.now()>>>0)) >>> 0;
  return () => {
    x = (Math.imul(1664525, x) + 1013904223) >>> 0;
    return (x >>> 0) / 4294967296;
  };
}
const sbRand = (SB_IS_RESEARCH && SB_SEED_RAW) ? makeRNG(SB_SEED_RAW) : Math.random;

// ---------- Config ----------
const sbDiffCfg = {
  easy:   { spawnMs: 900, bossHp: 6,  lifeMs: 2400, bossLifeMs: 7000 },
  normal: { spawnMs: 700, bossHp: 9,  lifeMs: 2300, bossLifeMs: 6500 },
  hard:   { spawnMs: 520, bossHp: 12, lifeMs: 2150, bossLifeMs: 6200 },
};
const sbCfg = sbDiffCfg[sbDiff] || sbDiffCfg.normal;

// ---------- Boss & emojis ----------
const SB_NORMAL_EMOJIS = ['🎯','💥','⭐','⚡','🔥','🥎','🌀','🥊','🧊','🌪️'];
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
    bossClear:(name)=>`พิชิต ${name} แล้ว!`,
    bossAppear:(name)=>`${name} ปรากฏตัวแล้ว!`,
    noData:'ยังไม่มีข้อมูล session',
    csvName:'ShadowBreakerSessions.csv',
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
    bossClear:(name)=>`You beat ${name}!`,
    bossAppear:(name)=>`${name} appeared!`,
    noData:'No session data yet',
    csvName:'ShadowBreakerSessions.csv',
  }
};

let sbLang = 'th';

// ---------- State ----------
const sbState = {
  running:false,
  paused:false,
  startTime:0,
  pauseAt:0,
  elapsedMs:0,
  durationMs: sbMode==='endless' ? Infinity : sbTimeSec*1000,

  spawnTimer:null,
  targets:[], // {id,boss,hp,maxHp,createdAt,el,alive,missTimer,bossInfo}

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

function sbLoadMeta(){
  try{
    const raw = localStorage.getItem(SB_META_KEY);
    if(!raw) return;
    const meta = JSON.parse(raw);
    Object.entries(sbMetaInputs).forEach(([k,el])=>{
      if(el && meta && meta[k]!=null) el.value = String(meta[k]);
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
  const t = sbI18n[sbLang] || sbI18n.th;
  const sl = $('#startLabel'); if(sl) sl.textContent = t.startLabel;
  const tg = $('#tagGoal'); if(tg) tg.textContent = t.tagGoal;
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;
}
sbLangButtons.forEach(btn=>{
  btn.addEventListener('click',()=>{
    sbLangButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    sbLang = (btn.dataset.lang || 'th').toLowerCase();
    sbApplyLang();
  });
});

// ---------- Feedback (CSS mapping fix) ----------
function sbShowFeedback(kind){
  if(!sbFeedbackEl) return;
  const t = sbI18n[sbLang] || sbI18n.th;

  let txt='';
  let cls='';

  if(kind==='fever'){ txt = t.feverLabel; cls = 'feedback feedback-fever show'; }
  else if(kind==='perfect'){ txt = (sbLang==='th'?'Perfect! 💥':'PERFECT!'); cls='feedback feedback-perfect show'; }
  else if(kind==='good'){ txt = (sbLang==='th'?'ดีมาก! ✨':'GOOD!'); cls='feedback feedback-good show'; }
  else { txt = (sbLang==='th'?'พลาด!':'MISS'); cls='feedback feedback-miss show'; }

  sbFeedbackEl.textContent = txt;
  sbFeedbackEl.className = cls;
  sbFeedbackEl.style.display = 'block';

  const dur = (kind==='fever') ? 820 : 460;
  setTimeout(()=>{
    if(!sbFeedbackEl) return;
    sbFeedbackEl.classList.remove('show');
    setTimeout(()=>{ if(sbFeedbackEl) sbFeedbackEl.style.display='none'; }, 140);
  }, dur);
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
    <div style="min-width:160px;">
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
  // timed: bosses appear at 15%, 35%, 60%, 85% (if time allows)
  // endless: schedule within first 2 minutes
  const totalMs = (sbMode==='endless') ? 120000 : (sbTimeSec*1000);
  const checkpoints = [0.15,0.35,0.60,0.85].map(r=>Math.round(totalMs*r));

  sbState.bossQueue = SB_BOSSES.map((b,idx)=>({
    bossIndex: idx,
    spawnAtMs: checkpoints[idx] || Math.round(totalMs*(0.2+idx*0.15))
  }));
}

// ---------- Safe spawn (avoid HUD/boss bar) ----------
function sbGetSafeTopPx(){
  // use CSS var if present, else fallback ~118px
  let safeTop = 118;
  try{
    const cs = getComputedStyle(document.documentElement);
    const v = cs.getPropertyValue('--safe-top').trim();
    if(v){
      // v might be '118px' or 'calc(...)' -> compute via temp element
      const tmp = document.createElement('div');
      tmp.style.position='absolute';
      tmp.style.visibility='hidden';
      tmp.style.height = v;
      document.body.appendChild(tmp);
      safeTop = Math.max(80, Math.round(tmp.getBoundingClientRect().height));
      tmp.remove();
    }
  }catch(_){}
  return safeTop;
}

let sbTargetIdCounter = 1;

function sbPickSpawnXY(sizePx){
  if(!sbGameArea) return { x:20, y:140 };

  const rect = sbGameArea.getBoundingClientRect();
  const pad = 18;

  const safeTop = sbGetSafeTopPx();

  const maxX = Math.max(0, rect.width  - sizePx - pad*2);
  const maxY = Math.max(0, rect.height - sizePx - pad*2 - safeTop);

  const x = pad + sbRand()*maxX;
  const y = pad + safeTop + sbRand()*maxY;
  return { x, y };
}

function sbRemoveTarget(tObj){
  if(!tObj) return;
  tObj.alive=false;
  try{ if(tObj.missTimer) clearTimeout(tObj.missTimer); }catch(_){}
  tObj.missTimer=null;
  try{ if(tObj.el && tObj.el.remove) tObj.el.remove(); }catch(_){}
  tObj.el=null;

  // remove from array (prevent state leak)
  sbState.targets = sbState.targets.filter(t=>t && t.alive && t.el);

  // boss cleanup
  if(tObj.boss){
    sbState.bossActive=false;
    sbState.activeBoss=null;
    sbState.activeBossInfo=null;
    sbState.bossWarned=false;
    sbSetBossHudVisible(false);
  }
}

function sbSpawnTarget(isBoss=false, bossInfo=null){
  if(!sbGameArea) return;

  const sizeBase = isBoss ? 92 : 58;
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
  el.style.fontSize = isBoss ? '2.1rem' : '1.8rem';

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
    sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).bossAppear(name), boss: bossInfo.id });
  }

  // life timer -> miss (only if still alive)
  const lifeMs = isBoss ? sbCfg.bossLifeMs : sbCfg.lifeMs;
  tObj.missTimer = setTimeout(()=>{
    if(!tObj.alive) return;
    sbRemoveTarget(tObj);

    // miss from timeout
    sbState.miss++;
    sbState.combo=0;
    sbUpdateHUD();
    sbShowFeedback('miss');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = (sbI18n[sbLang]||sbI18n.th).coachMiss;
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

// spawn next boss “feel” (only if still in queue)
function sbSpawnNextBossImmediate(){
  if(!sbState.bossQueue.length) return;
  // prevent spam in very short time left (timed)
  if(sbMode!=='endless'){
    const remainMs = Math.max(0, sbState.durationMs - sbState.elapsedMs);
    if(remainMs < 2000) return;
  }
  const next = sbState.bossQueue.shift();
  const bossInfo = SB_BOSSES[next.bossIndex];
  sbSpawnTarget(true, bossInfo);
}

// ---------- FEVER ----------
function sbEnterFever(){
  sbState.fever=true;
  sbState.feverUntil = performance.now() + 3500;
  if(sbHUD.coachLine) sbHUD.coachLine.textContent = (sbI18n[sbLang]||sbI18n.th).coachFever;
  if(sbGameArea) sbGameArea.classList.add('fever');
  sbShowFeedback('fever');
  sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).coachFever, fever:true });
}
function sbCheckFeverTick(now){
  if(sbState.fever && now >= sbState.feverUntil){
    sbState.fever=false;
    if(sbGameArea) sbGameArea.classList.remove('fever');
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = (sbI18n[sbLang]||sbI18n.th).coachReady;
  }
}

// ---------- Hit logic ----------
function sbHitTarget(tObj){
  if(!sbState.running || sbState.paused || !tObj || !tObj.alive) return;

  // reduce hp
  tObj.hp -= 1;

  sbState.hit++;
  const isBoss = !!tObj.boss;
  const bossInfo = tObj.bossInfo;

  // if still alive => GOOD
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
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = (sbI18n[sbLang]||sbI18n.th).coachGood;

    if(isBoss){
      sbUpdateBossHud();
      if(!sbState.bossWarned && tObj.hp <= 2 && bossInfo){
        sbState.bossWarned=true;
        const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
        sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).bossNear(name), boss: bossInfo.id });
      }
    }

    sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:isBoss ? 1 : 0 });
    return;
  }

  // PERFECT kill
  sbState.perfect++;
  sbState.combo++;
  sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

  const base = isBoss ? 200 : 80;
  const comboBonus = Math.min(sbState.combo*8, 100);
  const feverBonus = sbState.fever ? 80 : 0;
  const gained = base + comboBonus + feverBonus;
  sbState.score += gained;

  // remove target with pop anim
  if(tObj.el && tObj.el.animate){
    const anim = tObj.el.animate(
      [{ transform:'scale(1)', opacity:1 }, { transform:'scale(0.1)', opacity:0 }],
      { duration:140, easing:'ease-in' }
    );
    anim.onfinish = ()=> sbRemoveTarget(tObj);
  }else{
    sbRemoveTarget(tObj);
  }

  sbUpdateHUD();

  if(sbState.combo >= 5 && !sbState.fever) sbEnterFever();
  else sbShowFeedback('perfect');

  if(isBoss && bossInfo){
    const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
    sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).bossClear(name), boss: bossInfo.id });

    // spawn next boss (only if queue remains)
    sbSpawnNextBossImmediate();
  }

  sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:isBoss ? 1 : 0 });
}

// ---------- crosshair shoot (HeroHealth vr-ui.js) ----------
function sbHitNearestTargetAtScreenXY(x, y, lockPx=28){
  if(!sbState.running || sbState.paused || !sbGameArea) return false;
  x=Number(x); y=Number(y);
  if(!Number.isFinite(x)||!Number.isFinite(y)) return false;

  let best=null, bestD2=Infinity;
  const targets = sbState.targets;

  for(let i=0;i<targets.length;i++){
    const tObj = targets[i];
    if(!tObj || !tObj.alive || !tObj.el) continue;
    const r = tObj.el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const dx=cx-x, dy=cy-y;
    const d2=dx*dx+dy*dy;
    if(d2<bestD2){ bestD2=d2; best=tObj; }
  }

  const lock = Math.max(10, Number(lockPx)||28);
  if(best && bestD2 <= lock*lock){
    sbHitTarget(best);
    return true;
  }
  return false;
}

window.addEventListener('hha:shoot', (ev)=>{
  const d = (ev && ev.detail) ? ev.detail : {};
  sbHitNearestTargetAtScreenXY(d.x, d.y, d.lockPx || 28);
});

// keyboard Space (PC training assist)
window.addEventListener('keydown',(ev)=>{
  if(!sbState.running || sbState.paused) return;
  if(ev.code==='Space'){
    ev.preventDefault();
    if(!sbGameArea) return;
    const rect = sbGameArea.getBoundingClientRect();
    sbHitNearestTargetAtScreenXY(rect.left+rect.width/2, rect.top+rect.height/2, 90);
  }
});

// ---------- spawning ----------
function sbStartSpawnLoop(){
  if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer = setInterval(()=>{
    if(!sbState.running || sbState.paused) return;

    // leave gaps sometimes
    if(sbRand() < 0.10) return;

    // prevent clutter during boss
    if(sbState.bossActive && sbRand() < 0.50) return;

    sbSpawnTarget(false, null);
  }, sbCfg.spawnMs);
}
function sbStopSpawnLoop(){
  if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
  sbState.spawnTimer=null;
}

// ---------- loop ----------
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
    const sec = Math.floor(sbState.elapsedMs/1000);
    if(sbHUD.timeVal) sbHUD.timeVal.textContent = String(sec);
    if(sec !== sbLastTimeTick){
      sbLastTimeTick = sec;
      sbEmit('hha:time', { elapsedSec: sec, elapsedMs: Math.round(sbState.elapsedMs) });
    }
  }

  sbCheckFeverTick(now);
  sbMaybeSpawnBoss();

  requestAnimationFrame(sbMainLoop);
}

// ---------- local sessions store + CSV ----------
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
  const t = sbI18n[sbLang] || sbI18n.th;
  let rows=[];
  try{
    const raw = localStorage.getItem(SB_STORAGE_KEY);
    if(!raw){ alert(t.noData); return; }
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr) || !arr.length){ alert(t.noData); return; }

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
    alert('CSV error');
    return;
  }

  const csv = rows.join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=t.csvName;
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

  // clean targets
  const old = sbState.targets.slice();
  for(const tObj of old){
    try{ if(tObj && tObj.missTimer) clearTimeout(tObj.missTimer); }catch(_){}
    try{ if(tObj && tObj.el && tObj.el.remove) tObj.el.remove(); }catch(_){}
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
    seed:       SB_SEED_RAW,
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

  sbEmit('hha:end', rec);
  sbEmit('hha:flush', { reason: 'end' });
}

function sbStartGame(){
  if(sbState.running) return;

  const t = sbI18n[sbLang] || sbI18n.th;

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

  // focus play area
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

  sbEmit('hha:start', {
    gameId: SB_GAME_ID,
    gameVersion: SB_GAME_VERSION,
    phase: sbPhase,
    mode: sbMode,
    diff: sbDiff,
    timeSec: (sbMode==='endless') ? 0 : sbTimeSec,
    seed: SB_SEED_RAW,
    research: SB_IS_RESEARCH ? 1 : 0
  });

  setTimeout(()=>{
    sbStartSpawnLoop();
    requestAnimationFrame(sbMainLoop);
  }, 420);
}

// ---------- pause/resume from hub ----------
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
    }else if(!v && sbState.paused){
      sbState.paused=false;
      if(sbState.startTime && sbState.pauseAt){
        const pausedDur = performance.now() - sbState.pauseAt;
        sbState.startTime += pausedDur;
      }
      sbStartSpawnLoop();
      sbEmit('hha:coach', { text: 'Resumed' });
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
(function init(){
  // mode-play => hide research UI (CSS already supports)
  const mode = (qs('run','') || qs('modeUI','') || '').toLowerCase();
  if(mode === 'play') document.body.classList.add('mode-play');

  sbLoadMeta();
  sbApplyLang();

  if(sbHUD.timeVal){
    sbHUD.timeVal.textContent = (sbMode==='endless' ? '0' : String(sbTimeSec));
  }
})();