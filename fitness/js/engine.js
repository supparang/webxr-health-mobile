// === /fitness/js/engine.js ===
// Shadow Breaker engine — PRODUCTION PATCH (v20260216-final)
// ✅ FIX: start button wiring (#sb-btn-start) works
// ✅ FIX: AI import ok (AIPredictor exported) + also safe if missing
// ✅ FIX: targets expire & disappear smoothly
// ✅ FIX: expire miss counts only normal/bossface (decoy/bomb/heal/shield expire NOT miss)
// ✅ FIX: adaptive target size by layer/screen
// ✅ FIX: reads run=play/research too (not only mode)

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { DLFeatures } from './dl-features.js';

// -------------------------
// URL params
// -------------------------
function getQS(){
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}
const QS = getQS();
const q = (k, def='') => (QS.get(k) ?? def);
const qNum = (k, def=0) => {
  const v = Number(q(k, def));
  return Number.isFinite(v) ? v : def;
};

const RUN  = (q('run','') || '').toLowerCase(); // play | research (hub style)
const MODE = ((q('mode','') || '').toLowerCase() || (RUN === 'research' ? 'research' : 'normal'));
const PID0 = q('pid','');
const DIFF0= (q('diff','normal') || 'normal').toLowerCase();
const TIME0= Math.max(20, Math.min(240, qNum('time', 70)));
const HUB  = q('hub','./../herohealth/hub.html');

// -------------------------
// DOM
// -------------------------
const $ = (s)=>document.querySelector(s);

const wrapEl = $('#sb-wrap');

const viewMenu   = $('#sb-view-menu');
const viewPlay   = $('#sb-view-play');
const viewResult = $('#sb-view-result');

// tabs (mode)
const tabPlay     = $('#sb-btn-play');
const tabResearch = $('#sb-btn-research');

// inputs
const inputPid  = $('#sb-input-pid');
const inputDiff = $('#sb-input-diff');
const inputTime = $('#sb-input-time');

// action buttons
const btnStart   = $('#sb-btn-start');
const btnHowto   = $('#sb-btn-howto');
const howtoBox   = $('#sb-howto');

const btnBackMenu= $('#sb-btn-back-menu');
const btnPause   = $('#sb-btn-pause');

const layerEl    = $('#sb-target-layer');
const msgMainEl  = $('#sb-msg-main');

const textTime   = $('#sb-text-time');
const textScore  = $('#sb-text-score');
const textCombo  = $('#sb-text-combo');
const textPhase  = $('#sb-text-phase');
const textMiss   = $('#sb-text-miss');
const textShield = $('#sb-text-shield');

const hpYouTop    = $('#sb-hp-you-top');
const hpBossTop   = $('#sb-hp-boss-top');
const hpYouBottom = $('#sb-hp-you-bottom');
const hpBossBottom= $('#sb-hp-boss-bottom');

const bossNameEl  = $('#sb-current-boss-name');
const metaEmoji   = $('#sb-meta-emoji');
const metaName    = $('#sb-meta-name');
const metaDesc    = $('#sb-meta-desc');
const bossPhaseLabel = $('#sb-boss-phase-label');
const bossShieldLabel= $('#sb-boss-shield-label');

const feverBar    = $('#sb-fever-bar');
const feverLabel  = $('#sb-label-fever');
const btnFever    = $('#sb-btn-fever');
const feverHint   = $('#sb-fever-hint');

const resTime     = $('#sb-res-time');
const resScore    = $('#sb-res-score');
const resMaxCombo = $('#sb-res-max-combo');
const resMiss     = $('#sb-res-miss');
const resPhase    = $('#sb-res-phase');
const resBossCleared = $('#sb-res-boss-cleared');
const resAcc      = $('#sb-res-acc');
const resGrade    = $('#sb-res-grade');

const btnRetry    = $('#sb-btn-result-retry');
const btnMenu     = $('#sb-btn-result-menu');
const btnEvtCsv   = $('#sb-btn-download-events');
const btnSesCsv   = $('#sb-btn-download-session');

const linkHub     = $('#sb-link-hub');

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
const now = ()=>performance.now();

// -------------------------
// Data
// -------------------------
const BOSSES = [
  { name:'Bubble Glove', emoji:'🐣', desc:'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน', phases: 3 },
  { name:'Meteor Punch', emoji:'☄️', desc:'เร็วขึ้น — อย่าหลงเป้าล่อ', phases: 3 },
  { name:'Neon Hydra', emoji:'🐉', desc:'คอมโบสำคัญมาก — รักษาจังหวะ', phases: 3 },
];

const FEVER_MAX = 100;
const YOU_HP_MAX = 100;
const BOSS_HP_MAX = 100;

function setScaleX(el, pct){
  if(!el) return;
  el.style.transform = `scaleX(${clamp(pct,0,1)})`;
}

function showView(which){
  viewMenu?.classList.toggle('is-active', which === 'menu');
  viewPlay?.classList.toggle('is-active', which === 'play');
  viewResult?.classList.toggle('is-active', which === 'result');
}

// -------------------------
// ✅ AI (robust import)
// -------------------------
let AI = null;
async function loadAI(){
  try{
    const mod = await import('./ai-predictor.js');
    AI = mod?.AIPredictor ? new mod.AIPredictor() : null;
  }catch{
    AI = null;
  }
}

// -------------------------
// Difficulty (raw => adaptive scaling)
// -------------------------
const DIFF_CONFIG = {
  easy:   { label:'Easy',   spawnIntervalMin:950, spawnIntervalMax:1350, targetLifetime:1500, baseSize:108, bossDamageNormal:0.04,  bossDamageBossFace:0.45 },
  normal: { label:'Normal', spawnIntervalMin:800, spawnIntervalMax:1200, targetLifetime:1300, baseSize:102, bossDamageNormal:0.035, bossDamageBossFace:0.40 },
  hard:   { label:'Hard',   spawnIntervalMin:650, spawnIntervalMax:1000, targetLifetime:1150, baseSize:96,  bossDamageNormal:0.03,  bossDamageBossFace:0.35 }
};

function adaptiveBaseSize(raw){
  const r = layerEl?.getBoundingClientRect?.();
  const w = r?.width || window.innerWidth || 360;
  const h = r?.height || window.innerHeight || 640;
  const m = Math.max(280, Math.min(860, Math.min(w,h)));
  const scale = m / 540; // baseline
  return clamp(raw * scale, 76, 124);
}

// -------------------------
// State
// -------------------------
let running=false, ended=false, paused=false;

let TIME = TIME0;
let PID  = PID0;
let diffKey = DIFF_CONFIG[DIFF0] ? DIFF0 : 'normal';
let CFG = DIFF_CONFIG[diffKey];

let tStart=0, tLastSpawn=0, timeLeft=TIME*1000;
let score=0, combo=0, maxCombo=0, miss=0;
let fever=0, feverOn=false, shield=0;
let youHp=YOU_HP_MAX, bossHp=BOSS_HP_MAX;
let bossIndex=0, phase=1, bossesCleared=0;

const dl = new DLFeatures();

// active target truth
const active = new Map(); // id -> { type, expireAtMs, ttlMs }

// logs
const events = [];
const session = {
  pid:'', mode:'', diff:'', timeSec:0,
  startedAt:'', endedAt:'',
  score:0, maxCombo:0, miss:0, phase:1, bossesCleared:0, accPct:0
};

// renderer
const renderer = new DomRendererShadow(layerEl, { wrapEl, feedbackEl: msgMainEl, onTargetHit });
renderer.setDifficulty(diffKey);

function boss(){ return BOSSES[clamp(bossIndex,0,BOSSES.length-1)]; }

function setBossUI(){
  const b = boss();
  bossNameEl && (bossNameEl.textContent = `${b.name} ${b.emoji}`);
  metaEmoji && (metaEmoji.textContent = b.emoji);
  metaName  && (metaName.textContent  = b.name);
  metaDesc  && (metaDesc.textContent  = b.desc);
  bossPhaseLabel && (bossPhaseLabel.textContent = String(phase));
  bossShieldLabel&& (bossShieldLabel.textContent= String(shield));
  textPhase && (textPhase.textContent = String(phase));
  textShield&& (textShield.textContent= String(shield));
}

function setHUD(){
  textTime  && (textTime.textContent  = `${(timeLeft/1000).toFixed(1)} s`);
  textScore && (textScore.textContent = String(score|0));
  textCombo && (textCombo.textContent = String(combo|0));
  textMiss  && (textMiss.textContent  = String(miss|0));

  setScaleX(hpYouTop, youHp / YOU_HP_MAX);
  setScaleX(hpYouBottom, youHp / YOU_HP_MAX);
  setScaleX(hpBossTop, bossHp / BOSS_HP_MAX);
  setScaleX(hpBossBottom, bossHp / BOSS_HP_MAX);

  setScaleX(feverBar, fever / FEVER_MAX);
  if(feverLabel){
    const ready = fever >= FEVER_MAX;
    feverLabel.textContent = feverOn ? 'ON' : (ready ? 'READY' : `${Math.round(fever)}%`);
    feverLabel.classList.toggle('on', ready || feverOn);
  }
  if(feverHint){
    feverHint.textContent = feverOn
      ? 'FEVER ทำงาน: คะแนนคูณ + spawn ช้าลงนิดนึง'
      : 'FEVER READY แล้วกด ⚡ FEVER เพื่อเปิดโหมดคูณคะแนน';
  }
}

function say(text, cls){
  if(!msgMainEl) return;
  msgMainEl.textContent = text;
  msgMainEl.className = 'sb-msg-main' + (cls ? ' ' + cls : '');
}

function nextBossOrPhase(){
  if(phase < boss().phases){
    phase++;
    bossHp = BOSS_HP_MAX;
    say(`Phase ${phase} — เร็วขึ้น!`, 'good');
  }else{
    bossesCleared++;
    bossIndex = Math.min(BOSSES.length-1, bossIndex+1);
    phase = 1;
    bossHp = BOSS_HP_MAX;
    say(`Boss Clear! ไปต่อ 🎉`, 'perfect');
  }
  setBossUI();
}

function expireCountsMiss(type){
  // ✅ ตามที่คุณว่า: decoy/bomb/heal/shield expire ไม่ควรนับ miss
  return (type === 'normal' || type === 'bossface');
}

function spawnOne(){
  const id = Math.floor(Math.random()*1e9);
  const roll = Math.random();

  let type = 'normal';
  if(roll < 0.08) type = 'bomb';
  else if(roll < 0.15) type = 'decoy';
  else if(roll < 0.20) type = 'heal';
  else if(roll < 0.26) type = 'shield';
  if(bossHp <= 26 && Math.random() < 0.22) type = 'bossface';

  let sizePx = adaptiveBaseSize(CFG.baseSize);
  if(type === 'bossface') sizePx *= 1.12;
  if(type === 'bomb') sizePx *= 1.05;
  sizePx = clamp(sizePx, 70, 138);

  const ttlMs = CFG.targetLifetime;

  renderer.spawnTarget({ id, type, sizePx, bossEmoji: boss().emoji, ttlMs });

  const tNow = now();
  active.set(id, { type, expireAtMs: tNow + ttlMs, ttlMs });

  events.push({ t:(TIME*1000-timeLeft), type:'spawn', id, targetType:type, sizePx:Math.round(sizePx), ttlMs });
}

function onTargetHit(id, pt){
  if(!running || ended || paused) return;

  const obj = renderer.targets.get(id);
  const el = obj?.el;
  if(!el) return;

  const type = obj?.type || 'normal';
  active.delete(id); // prevent expire race

  dl.onHit();

  let grade='good', scoreDelta=0;

  if(type === 'decoy'){
    grade='bad'; scoreDelta=-6; combo=0;
    say('หลงเป้าล่อ!', 'bad');
  }else if(type === 'bomb'){
    grade='bomb'; scoreDelta=-14; combo=0;
    if(shield>0){
      shield--; grade='shield'; scoreDelta=0;
      say('กันระเบิดด้วย Shield!', 'good');
    }else{
      youHp = Math.max(0, youHp - 18);
      say('โดนระเบิด!', 'bad');
    }
  }else if(type === 'heal'){
    grade='heal'; scoreDelta=6;
    youHp = Math.min(YOU_HP_MAX, youHp + 16);
    say('+HP!', 'good');
  }else if(type === 'shield'){
    grade='shield'; scoreDelta=6;
    shield = Math.min(5, shield + 1);
    say('+SHIELD!', 'good');
  }else if(type === 'bossface'){
    grade='perfect'; scoreDelta=18; combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * CFG.bossDamageBossFace));
    say('CRIT! ใส่หน้า Boss!', 'perfect');
  }else{
    grade = (feverOn || fever >= FEVER_MAX) ? 'perfect' : 'good';
    scoreDelta = (grade==='perfect') ? 14 : 10;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * CFG.bossDamageNormal));
    say(grade==='perfect' ? 'PERFECT!' : 'ดีมาก!', grade==='perfect' ? 'perfect' : 'good');
  }

  score = Math.max(0, score + scoreDelta);
  maxCombo = Math.max(maxCombo, combo);

  // fever gain
  fever = clamp(fever + (grade==='perfect' ? 10 : 6), 0, FEVER_MAX);

  renderer.playHitFx(id, { clientX:pt.clientX, clientY:pt.clientY, grade, scoreDelta });
  renderer.removeTarget(id);

  events.push({ t:(TIME*1000-timeLeft), type:'hit', id, targetType:type, grade, scoreDelta });

  if(bossHp <= 0) nextBossOrPhase();
  if(youHp <= 0) endGame('dead');

  setHUD();
}

function handleExpiry(){
  const tNow = now();
  for(const [id, info] of active.entries()){
    if(tNow < info.expireAtMs) continue;

    const obj = renderer.targets.get(id);
    if(!obj?.el){
      active.delete(id);
      continue;
    }

    renderer.playHitFx(id, { grade:'expire' });
    renderer.expireTarget(id);

    if(expireCountsMiss(info.type)){
      miss++;
      combo = 0;
      say('พลาด! (Miss)', 'miss');
    }

    events.push({
      t:(TIME*1000-timeLeft),
      type:'expire',
      id,
      targetType: info.type,
      missCounted: expireCountsMiss(info.type) ? 1 : 0
    });

    // small pressure only for normal expire
    if(info.type === 'normal'){
      youHp = Math.max(0, youHp - 2);
      if(youHp <= 0){ endGame('dead'); return; }
    }

    active.delete(id);
  }
}

function endGame(reason='timeup'){
  if(ended) return;
  ended = true;
  running = false;

  active.clear();
  renderer.destroy();

  session.endedAt = new Date().toISOString();
  session.score = score|0;
  session.maxCombo = maxCombo|0;
  session.miss = miss|0;
  session.phase = phase|0;
  session.bossesCleared = bossesCleared|0;

  const totalShots = dl.getTotalShots();
  const hits = dl.getHits();
  const accPct = totalShots>0 ? (hits/totalShots)*100 : 0;
  session.accPct = Number(accPct.toFixed(2));

  resTime && (resTime.textContent = `${(TIME - timeLeft/1000).toFixed(1)} s`);
  resScore&& (resScore.textContent= String(score|0));
  resMaxCombo && (resMaxCombo.textContent = String(maxCombo|0));
  resMiss && (resMiss.textContent = String(miss|0));
  resPhase && (resPhase.textContent = String(phase|0));
  resBossCleared && (resBossCleared.textContent = String(bossesCleared|0));
  resAcc && (resAcc.textContent = `${accPct.toFixed(1)} %`);

  let g='C';
  if(accPct >= 85 && bossesCleared >= 1) g='A';
  else if(accPct >= 70) g='B';
  else if(accPct >= 55) g='C';
  else g='D';
  resGrade && (resGrade.textContent = g);

  showView('result');
}

function tick(){
  if(!running || ended) return;
  requestAnimationFrame(tick);
  if(paused) return;

  const t = now();
  const dt = t - tStart;
  timeLeft = Math.max(0, (TIME*1000) - dt);

  // FEVER behavior
  if(feverOn){
    fever = clamp(fever - 0.30, 0, FEVER_MAX);
    if(fever <= 2){ feverOn=false; say('Fever หมดแล้ว!', ''); }
  }else if(fever >= FEVER_MAX){
    // stay ready
  }

  // spawn interval (slightly slower when feverOn => reduces cramped)
  const slow = feverOn ? 1.12 : 1.0;
  const since = t - tLastSpawn;
  const targetInterval = clamp(
    (CFG.spawnIntervalMin + Math.random()*(CFG.spawnIntervalMax - CFG.spawnIntervalMin)) * slow,
    520, 1900
  );

  if(since >= targetInterval){
    tLastSpawn = t;
    spawnOne();
    dl.onShot();
  }

  handleExpiry();

  if(timeLeft <= 0) endGame('timeup');
  setHUD();
}

// -------------------------
// Boot / Menu wiring
// -------------------------
function applyMenuDefaultsFromQS(){
  if(inputPid)  inputPid.value  = PID0 || '';
  if(inputDiff) inputDiff.value = DIFF_CONFIG[DIFF0] ? DIFF0 : 'normal';
  if(inputTime) inputTime.value = String(TIME0);

  if(linkHub){
    linkHub.href = HUB || './../herohealth/hub.html';
  }

  // mode default from QS
  const isResearch = (MODE === 'research');
  tabPlay?.classList.toggle('is-active', !isResearch);
  tabResearch?.classList.toggle('is-active', isResearch);
}

let selectedMode = (MODE === 'research') ? 'research' : 'normal';

function setMode(m){
  selectedMode = (m === 'research') ? 'research' : 'normal';
  tabPlay?.classList.toggle('is-active', selectedMode === 'normal');
  tabResearch?.classList.toggle('is-active', selectedMode === 'research');
}

function startGame(){
  // read menu inputs
  PID = (inputPid?.value || PID0 || '').trim();
  diffKey = (inputDiff?.value || DIFF0 || 'normal').toLowerCase();
  if(!DIFF_CONFIG[diffKey]) diffKey = 'normal';
  CFG = DIFF_CONFIG[diffKey];

  TIME = clamp(Number(inputTime?.value || TIME0), 20, 240);

  // reset state
  ended=false; running=true; paused=false;
  score=0; combo=0; maxCombo=0; miss=0;
  fever=0; feverOn=false; shield=0;
  youHp=YOU_HP_MAX; bossHp=BOSS_HP_MAX;
  bossIndex=0; phase=1; bossesCleared=0;

  events.length = 0;
  active.clear();

  dl.reset();
  renderer.destroy();
  renderer.setDifficulty(diffKey);

  session.pid = PID || '';
  session.mode = selectedMode;
  session.diff = diffKey;
  session.timeSec = TIME;
  session.startedAt = new Date().toISOString();
  session.endedAt = '';

  setBossUI();
  timeLeft = TIME*1000;
  setHUD();
  say('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');

  showView('play');

  tStart = now();
  tLastSpawn = tStart;
  requestAnimationFrame(tick);
}

// menu actions
tabPlay?.addEventListener('click', ()=> setMode('normal'));
tabResearch?.addEventListener('click', ()=> setMode('research'));

btnHowto?.addEventListener('click', ()=> howtoBox?.classList.toggle('is-on'));
btnStart?.addEventListener('click', startGame);

btnBackMenu?.addEventListener('click', ()=>{
  running=false; ended=false; paused=false;
  active.clear();
  renderer.destroy();
  showView('menu');
});

btnPause?.addEventListener('change', ()=>{ paused = !!btnPause.checked; });

btnRetry?.addEventListener('click', ()=> startGame());
btnMenu?.addEventListener('click', ()=>{
  active.clear();
  renderer.destroy();
  showView('menu');
});

btnFever?.addEventListener('click', ()=>{
  if(ended || !running) return;
  if(fever >= FEVER_MAX){
    feverOn = true;
    fever = FEVER_MAX;
    say('FEVER ON! ⚡', 'perfect');
  }else{
    say('Fever ยังไม่ READY', 'miss');
  }
  setHUD();
});

function downloadCSV(filename, rows){
  if(!rows || !rows.length) return;
  const esc = (v)=> String(v ?? '').replace(/"/g,'""');
  const keys = Object.keys(rows[0] || {});
  const lines = [
    keys.map(k=>`"${esc(k)}"`).join(','),
    ...rows.map(r=>keys.map(k=>`"${esc(r[k])}"`).join(','))
  ];
  const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 800);
}

btnEvtCsv?.addEventListener('click', ()=> downloadCSV('shadowbreaker_events.csv', events));
btnSesCsv?.addEventListener('click', ()=>{
  session.score = score|0;
  session.maxCombo = maxCombo|0;
  session.miss = miss|0;
  session.phase = phase|0;
  session.bossesCleared = bossesCleared|0;

  const totalShots = dl.getTotalShots();
  const hits = dl.getHits();
  const accPct = totalShots>0 ? (hits/totalShots)*100 : 0;
  session.accPct = Number(accPct.toFixed(2));

  downloadCSV('shadowbreaker_session.csv', [session]);
});

// init
applyMenuDefaultsFromQS();
showView('menu');
setBossUI();
setHUD();
loadAI(); // optional (safe)