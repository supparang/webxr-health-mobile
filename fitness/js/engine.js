// === /fitness/js/engine.js ===
// Shadow Breaker engine — PATCH E
// ✅ Renderer stage metrics (avoid HUD/card)
// ✅ Anti-cluster is inside DomRendererShadow (needs setStageMetrics)
// ✅ More exciting per-phase intensity (slightly faster + more traps)
// ✅ Keeps PATCH D: robust AI import + hard TTL miss

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

const MODE = (q('mode','normal') || 'normal').toLowerCase();
const PID  = q('pid','');
const DIFF = (q('diff','normal') || 'normal').toLowerCase();
const TIME = Math.max(20, Math.min(240, qNum('time', 70)));
const HUB  = q('hub','./hub.html');

// -------------------------
// DOM
// -------------------------
const $ = (s)=>document.querySelector(s);

const viewMenu   = $('#sb-view-menu');
const viewPlay   = $('#sb-view-play');
const viewResult = $('#sb-view-result');

const btnPlay     = $('#sb-btn-play');
const btnResearch = $('#sb-btn-research');
const btnHowto    = $('#sb-btn-howto');
const howtoBox    = $('#sb-howto');

const btnBackMenu = $('#sb-btn-back-menu');
const btnPause    = $('#sb-btn-pause');

const layerEl   = $('#sb-target-layer');
const msgMainEl = $('#sb-msg-main');

const textTime  = $('#sb-text-time');
const textScore = $('#sb-text-score');
const textCombo = $('#sb-text-combo');
const textPhase = $('#sb-text-phase');
const textMiss  = $('#sb-text-miss');
const textShield= $('#sb-text-shield');

const hpYouTop    = $('#sb-hp-you-top');
const hpBossTop   = $('#sb-hp-boss-top');
const hpYouBottom = $('#sb-hp-you-bottom');
const hpBossBottom= $('#sb-hp-boss-bottom');

const bossNameEl = $('#sb-current-boss-name');
const metaEmoji  = $('#sb-meta-emoji');
const metaName   = $('#sb-meta-name');
const metaDesc   = $('#sb-meta-desc');
const bossPhaseLabel = $('#sb-boss-phase-label');
const bossShieldLabel= $('#sb-boss-shield-label');

const feverBar   = $('#sb-fever-bar');
const feverLabel = $('#sb-label-fever');

// Result
const resTime   = $('#sb-res-time');
const resScore  = $('#sb-res-score');
const resMaxCombo = $('#sb-res-max-combo');
const resMiss   = $('#sb-res-miss');
const resPhase  = $('#sb-res-phase');
const resBossCleared = $('#sb-res-boss-cleared');
const resAcc    = $('#sb-res-acc');
const resGrade  = $('#sb-res-grade');

const btnRetry  = $('#sb-btn-result-retry');
const btnMenu   = $('#sb-btn-result-menu');
const btnEvtCsv = $('#sb-btn-download-events');
const btnSesCsv = $('#sb-btn-download-session');

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const now = ()=>performance.now();

function showView(which){
  viewMenu?.classList.toggle('is-active', which === 'menu');
  viewPlay?.classList.toggle('is-active', which === 'play');
  viewResult?.classList.toggle('is-active', which === 'result');
}

function setScaleX(el, pct){
  if(!el) return;
  el.style.transform = `scaleX(${clamp(pct,0,1)})`;
}

function say(text, cls){
  if(!msgMainEl) return;
  msgMainEl.textContent = text;
  msgMainEl.className = 'sb-msg-main' + (cls ? ' ' + cls : '');
}

// -------------------------
// Bosses
// -------------------------
const BOSSES = [
  { name:'Bubble Glove', emoji:'🐣', desc:'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน', phases: 3 },
  { name:'Meteor Punch', emoji:'☄️', desc:'เร็วขึ้น — อย่าหลงเป้าล่อ', phases: 3 },
  { name:'Neon Hydra', emoji:'🐉', desc:'คอมโบสำคัญมาก — รักษาจังหวะ', phases: 3 },
];

function boss(){ return BOSSES[Math.max(0, Math.min(BOSSES.length-1, bossIndex))]; }

function setBossUI(){
  const b = boss();
  bossNameEl && (bossNameEl.textContent = `${b.name} ${b.emoji}`);
  metaEmoji && (metaEmoji.textContent = b.emoji);
  metaName && (metaName.textContent = b.name);
  metaDesc && (metaDesc.textContent = b.desc);
  bossPhaseLabel && (bossPhaseLabel.textContent = String(phase));
  bossShieldLabel && (bossShieldLabel.textContent = String(shield));
  textPhase && (textPhase.textContent = String(phase));
  textShield && (textShield.textContent = String(shield));
}

// -------------------------
// Config
// -------------------------
const FEVER_MAX = 100;
const YOU_HP_MAX = 100;
const BOSS_HP_MAX = 100;

const DIFF_CONFIG = {
  easy:   { spawnMin:950, spawnMax:1350, ttl:1500, baseSize:118, bossDmg:0.04,  bossFaceDmg:0.45 },
  normal: { spawnMin:800, spawnMax:1200, ttl:1300, baseSize:110, bossDmg:0.035, bossFaceDmg:0.40 },
  hard:   { spawnMin:650, spawnMax:1000, ttl:1150, baseSize:102, bossDmg:0.03,  bossFaceDmg:0.35 }
};
const diff = DIFF_CONFIG[DIFF] ? DIFF : 'normal';
const CFG0 = DIFF_CONFIG[diff];

// -------------------------
// State
// -------------------------
let running=false, ended=false, paused=false;
let tStart=0, tLastSpawn=0, timeLeft=TIME*1000;

let score=0, combo=0, maxCombo=0, miss=0;
let fever=0, shield=0;
let youHp=YOU_HP_MAX, bossHp=BOSS_HP_MAX;
let bossIndex=0, phase=1, bossesCleared=0;

const dl = new DLFeatures();

// logs
const events = [];
const session = { pid: PID||'', mode: MODE, diff, timeSec: TIME, startedAt: new Date().toISOString(), endedAt:'', score:0, maxCombo:0, miss:0, phase:1, bossesCleared:0, accPct:0 };

// -------------------------
// AI import (robust) — same idea as D (kept)
// -------------------------
let ai = null;
async function loadAI(){
  try{
    const mod = await import('./ai-predictor.js');
    const Ctor = mod?.AIPredictor || mod?.default || null;
    ai = Ctor ? new Ctor() : (window.RB_AI || null);
  }catch(_e){
    ai = window.RB_AI || null;
  }
}
await loadAI();

// -------------------------
// Renderer
// -------------------------
const renderer = new DomRendererShadow(layerEl, {
  onTargetHit
});
renderer.setDifficulty(diff);

// PATCH E: measure HUD/card sizes -> setStageMetrics()
function measureStageMetrics(){
  // In this layout: HUD top exists in play view, bottom exists, boss card is aside
  const topHud = document.querySelector('.sb-hud-top');
  const bottomHud = document.querySelector('.sb-hud-bottom');
  const bossCard = document.querySelector('.sb-boss-card');

  const topHudH = topHud ? topHud.getBoundingClientRect().height : 0;
  const bottomHudH = bottomHud ? bottomHud.getBoundingClientRect().height : 0;

  // boss card only blocks if it sits next to layer (desktop); on mobile it's below (css)
  let rightPanelW = 0;
  if(bossCard){
    const st = getComputedStyle(bossCard);
    // if it's in same row grid, it takes width
    if(st.position !== 'fixed'){
      rightPanelW = bossCard.getBoundingClientRect().width + 12;
    }
  }

  renderer.setStageMetrics({
    topHudH: topHudH + 8,
    bottomHudH: bottomHudH + 8,
    rightPanelW,
    pad: 18
  });
}

// -------------------------
// TTL hard expiry (same as D)
// -------------------------
const ttlTimers = new Map();
function clearTTL(id){
  const t = ttlTimers.get(id);
  if(t){ clearTimeout(t); ttlTimers.delete(id); }
}
function scheduleTTL(id, ttlMs){
  clearTTL(id);
  const t = setTimeout(()=>{
    if(!running || ended) return;
    const el = renderer.targets.get(id);
    if(!el) return;

    renderer.removeTarget(id, 'miss');
    ttlTimers.delete(id);

    miss++;
    combo = 0;
    fever = clamp(fever - 8, 0, FEVER_MAX);
    say('MISS!', 'miss');
    events.push({ t:(TIME*1000-timeLeft), type:'miss', id });

    setHUD();
  }, Math.max(60, (ttlMs|0) + 50));
  ttlTimers.set(id, t);
}

// -------------------------
// HUD
// -------------------------
function setHUD(){
  textTime && (textTime.textContent = `${(timeLeft/1000).toFixed(1)} s`);
  textScore && (textScore.textContent = String(score|0));
  textCombo && (textCombo.textContent = String(combo|0));
  textMiss && (textMiss.textContent = String(miss|0));

  setScaleX(hpYouTop, youHp/YOU_HP_MAX);
  setScaleX(hpYouBottom, youHp/YOU_HP_MAX);
  setScaleX(hpBossTop, bossHp/BOSS_HP_MAX);
  setScaleX(hpBossBottom, bossHp/BOSS_HP_MAX);

  setScaleX(feverBar, fever/FEVER_MAX);
  if(feverLabel){
    const on = fever >= FEVER_MAX;
    feverLabel.textContent = on ? 'READY' : `FEVER ${Math.round(fever)}%`;
    feverLabel.classList.toggle('on', on);
  }
}

// -------------------------
// Intensity (PATCH E)
// -------------------------
// Phase makes it more exciting: slightly faster spawn + more bomb/decoy
function phaseIntensityMul(){
  // phase: 1..3 => mul 1.00, 0.92, 0.86
  return clamp(1.04 - (phase-1)*0.09, 0.82, 1.04);
}
function trapBoost(){
  // phase increases traps a bit
  return clamp((phase-1)*0.035, 0, 0.085);
}

// -------------------------
// Flow
// -------------------------
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
    say('Boss Clear! ไปต่อ 🎉', 'perfect');
  }
  setBossUI();
}

function spawnOne(){
  const id = Math.floor(Math.random()*1e9);

  // roll with phase traps
  const roll = Math.random();
  const b = trapBoost();

  let type = 'normal';
  // base rates: bomb 0.08, decoy 0.07, heal 0.05, shield 0.06
  // phase boost: more bomb/decoy a bit
  const pBomb  = 0.08 + b;
  const pDecoy = 0.15 + b;     // cumulative after bomb
  const pHeal  = 0.20;         // keep stable
  const pShield= 0.26;         // keep stable

  if(roll < pBomb) type='bomb';
  else if(roll < pDecoy) type='decoy';
  else if(roll < pHeal) type='heal';
  else if(roll < pShield) type='shield';

  if(bossHp <= 26 && Math.random() < 0.22){
    type = 'bossface';
  }

  // size
  let sizePx = CFG0.baseSize;
  if(type==='bossface') sizePx = CFG0.baseSize * 1.14; // PATCH E: slightly smaller bossface than before
  if(type==='bomb') sizePx = CFG0.baseSize * 1.03;

  renderer.spawnTarget({ id, type, sizePx, bossEmoji: boss().emoji, ttlMs: CFG0.ttl });

  scheduleTTL(id, CFG0.ttl);
  events.push({ t:(TIME*1000-timeLeft), type:'spawn', id, targetType:type, sizePx:Math.round(sizePx) });
}

function onTargetHit(id, pt){
  if(!running || ended || paused) return;

  const el = renderer.targets.get(id);
  if(!el) return;

  clearTTL(id);

  const type = (el.className.match(/sb-target--(\w+)/)?.[1]) || 'normal';
  dl.onHit();

  let grade='good', scoreDelta=0;

  if(type==='decoy'){
    grade='bad'; scoreDelta=-6; combo=0;
    say('หลงเป้าล่อ!', 'bad');
  }else if(type==='bomb'){
    grade='bomb'; scoreDelta=-14; combo=0;
    if(shield>0){
      shield--; scoreDelta=0; grade='shield';
      say('กันระเบิดด้วย Shield!', 'good');
    }else{
      youHp = Math.max(0, youHp-18);
      say('โดนระเบิด!', 'bad');
    }
  }else if(type==='heal'){
    grade='heal'; scoreDelta=6;
    youHp = Math.min(YOU_HP_MAX, youHp+16);
    say('+HP!', 'good');
  }else if(type==='shield'){
    grade='shield'; scoreDelta=6;
    shield = Math.min(5, shield+1);
    say('+SHIELD!', 'good');
  }else if(type==='bossface'){
    grade='perfect'; scoreDelta=18; combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX*CFG0.bossFaceDmg));
    say('CRIT! ใส่หน้า Boss!', 'perfect');
  }else{
    grade = (fever>=FEVER_MAX) ? 'perfect':'good';
    scoreDelta = (grade==='perfect') ? 14 : 10;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX*CFG0.bossDmg));
    say(grade==='perfect' ? 'PERFECT!' : 'ดีมาก!', grade==='perfect' ? 'perfect':'good');
  }

  score = Math.max(0, score + scoreDelta);
  maxCombo = Math.max(maxCombo, combo);
  fever = clamp(fever + (grade==='perfect' ? 10 : 6), 0, FEVER_MAX);

  renderer.playHitFx(id, { clientX: pt.clientX, clientY: pt.clientY, grade, scoreDelta });
  renderer.removeTarget(id, 'hit');

  events.push({ t:(TIME*1000-timeLeft), type:'hit', id, targetType:type, grade, scoreDelta });

  if(bossHp <= 0) nextBossOrPhase();
  if(youHp <= 0) endGame('dead');

  setHUD();
}

function endGame(reason='timeup'){
  if(ended) return;
  ended = true;
  running = false;

  for(const [,t] of ttlTimers.entries()) clearTimeout(t);
  ttlTimers.clear();

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
  resScore && (resScore.textContent = String(score|0));
  resMaxCombo && (resMaxCombo.textContent = String(maxCombo|0));
  resMiss && (resMiss.textContent = String(miss|0));
  resPhase && (resPhase.textContent = String(phase|0));
  resBossCleared && (resBossCleared.textContent = String(bossesCleared|0));
  resAcc && (resAcc.textContent = `${accPct.toFixed(1)} %`);

  let g='C';
  if(accPct>=85 && bossesCleared>=1) g='A';
  else if(accPct>=70) g='B';
  else if(accPct>=55) g='C';
  else g='D';
  resGrade && (resGrade.textContent = g);

  showView('result');
}

function tick(){
  if(!running || ended) return;
  requestAnimationFrame(tick);
  if(paused) return;

  // update safe-zone occasionally
  if((Math.random()<0.06)) measureStageMetrics();

  const t = now();
  const dt = t - tStart;
  timeLeft = Math.max(0, (TIME*1000) - dt);

  // phase intensity affects spawn
  const mul = phaseIntensityMul();
  const spawnMin = CFG0.spawnMin * mul;
  const spawnMax = CFG0.spawnMax * mul;

  const since = t - tLastSpawn;
  const targetInterval = clamp(spawnMin + Math.random()*(spawnMax-spawnMin), 420, 1800);

  if(since >= targetInterval){
    tLastSpawn = t;
    spawnOne();
    dl.onShot();
  }

  if(fever >= FEVER_MAX){
    fever = clamp(fever - 0.22, 0, FEVER_MAX);
  }

  // optional AI (play only)
  if(MODE !== 'research' && ai && typeof ai.predict === 'function'){
    // can hook later
    // ai.predict({ score, combo, miss, fever, youHp, bossHp, phase, diff, shield });
  }

  if(timeLeft <= 0) endGame('timeup');

  setHUD();
}

function start(mode){
  ended=false; running=true; paused=false;

  score=0; combo=0; maxCombo=0; miss=0;
  fever=0; shield=0;
  youHp=YOU_HP_MAX; bossHp=BOSS_HP_MAX;
  bossIndex=0; phase=1; bossesCleared=0;

  for(const [,t] of ttlTimers.entries()) clearTimeout(t);
  ttlTimers.clear();

  dl.reset();
  renderer.destroy();

  setBossUI();
  setHUD();
  say('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');

  showView('play');

  // measure once at start + after small delay (layout settle)
  measureStageMetrics();
  setTimeout(measureStageMetrics, 120);

  tStart = now();
  tLastSpawn = tStart;
  requestAnimationFrame(tick);
}

// UI binds
btnPlay?.addEventListener('click', ()=> start('normal'));
btnResearch?.addEventListener('click', ()=> start('research'));
btnHowto?.addEventListener('click', ()=>{
  if(!howtoBox) return;
  howtoBox.style.display = (howtoBox.style.display==='none'||!howtoBox.style.display) ? '' : 'none';
});
btnBackMenu?.addEventListener('click', ()=>{
  running=false; ended=false; paused=false;
  for(const [,t] of ttlTimers.entries()) clearTimeout(t);
  ttlTimers.clear();
  renderer.destroy();
  showView('menu');
});
btnPause?.addEventListener('change', ()=>{ paused = !!btnPause.checked; });

btnRetry?.addEventListener('click', ()=> start(MODE));
btnMenu?.addEventListener('click', ()=>{
  for(const [,t] of ttlTimers.entries()) clearTimeout(t);
  ttlTimers.clear();
  renderer.destroy();
  showView('menu');
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
btnSesCsv?.addEventListener('click', ()=> downloadCSV('shadowbreaker_session.csv', [session]));

// init
showView('menu');
setBossUI();
setHUD();
try{
  const hubBtn = document.getElementById('sb-btn-hub');
  if(hubBtn && HUB) hubBtn.href = HUB;
}catch(_){}
