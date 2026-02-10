// === /fitness/js/engine.js ===
// Shadow Breaker engine — PATCH F
// ✅ Boss Skills + Telegraph + Ultimate (FEVER Moment)
// ✅ Keeps PATCH E (stage metrics + anti-cluster via renderer setStageMetrics)
// ✅ Keeps hard TTL miss removal

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { DLFeatures } from './dl-features.js';
import { BossSkills } from './boss-skills.js';

// -------------------------
// URL params
// -------------------------
function getQS(){ try{ return new URL(location.href).searchParams; }catch{ return new URLSearchParams(); } }
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

const $ = (s)=>document.querySelector(s);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const now = ()=>performance.now();

// -------------------------
// DOM
// -------------------------
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

function showView(which){
  viewMenu?.classList.toggle('is-active', which==='menu');
  viewPlay?.classList.toggle('is-active', which==='play');
  viewResult?.classList.toggle('is-active', which==='result');
}
function setScaleX(el,pct){ if(el) el.style.transform = `scaleX(${clamp(pct,0,1)})`; }
function say(text, cls){
  if(!msgMainEl) return;
  msgMainEl.textContent = text;
  msgMainEl.className = 'sb-msg-main' + (cls ? ' ' + cls : '');
}

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

const DIFF_CONFIG = {
  easy:   { spawnMin:950, spawnMax:1350, ttl:1500, baseSize:118, bossDmg:0.04,  bossFaceDmg:0.45 },
  normal: { spawnMin:800, spawnMax:1200, ttl:1300, baseSize:110, bossDmg:0.035, bossFaceDmg:0.40 },
  hard:   { spawnMin:650, spawnMax:1000, ttl:1150, baseSize:102, bossDmg:0.03,  bossFaceDmg:0.35 }
};
const diff = DIFF_CONFIG[DIFF] ? DIFF : 'normal';
const CFG0 = DIFF_CONFIG[diff];

function boss(){ return BOSSES[clamp(bossIndex,0,BOSSES.length-1)]; }
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
// Renderer
// -------------------------
const renderer = new DomRendererShadow(layerEl, { onTargetHit });
renderer.setDifficulty(diff);

function measureStageMetrics(){
  const topHud = document.querySelector('.sb-hud-top');
  const bottomHud = document.querySelector('.sb-hud-bottom');
  const bossCard = document.querySelector('.sb-boss-card');

  const topHudH = topHud ? topHud.getBoundingClientRect().height : 0;
  const bottomHudH = bottomHud ? bottomHud.getBoundingClientRect().height : 0;

  let rightPanelW = 0;
  if(bossCard){
    const st = getComputedStyle(bossCard);
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
// TTL miss removal (fix "เป้าไม่หาย")
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
  }, Math.max(80, (ttlMs|0) + 50));
  ttlTimers.set(id, t);
}

// -------------------------
// PATCH F: Ultimate UI (injected)
// -------------------------
let ultReady = false;
let ultActiveUntil = 0;
let ultCooldownUntil = 0;

let ultBtn = null;
function ensureUltimateBtn(){
  if(ultBtn) return ultBtn;
  ultBtn = document.createElement('button');
  ultBtn.id = 'sb-btn-ultimate';
  ultBtn.className = 'sb-ult-btn';
  ultBtn.type = 'button';
  ultBtn.textContent = '⚡ ULTIMATE';
  ultBtn.style.display = 'none';
  document.body.appendChild(ultBtn);

  ultBtn.addEventListener('click', ()=>{
    if(!running || ended || paused) return;
    if(!ultReady) return;
    if(now() < ultCooldownUntil) return;
    activateUltimate();
  });

  return ultBtn;
}

function activateUltimate(){
  // consume FEVER
  ultReady = false;
  fever = 0;
  ultActiveUntil = now() + 3600;     // 3.6s power window
  ultCooldownUntil = now() + 6200;   // cooldown
  document.body.classList.add('sb-ult-on');
  say('ULTIMATE! 🔥 ตีรัว ๆ!', 'perfect');
  events.push({ t:(TIME*1000-timeLeft), type:'ultimate', on:1 });

  // "freeze" feel: briefly slow spawns + more normals
  // (handled in tick by scaling spawn interval)

  // end marker
  setTimeout(()=>{
    document.body.classList.remove('sb-ult-on');
    events.push({ t:(TIME*1000-timeLeft), type:'ultimate', on:0 });
  }, 3650);

  // burst reward targets (kids love this)
  burstSpawn([
    { type:'normal', count: 6, sizeMul: 0.96, ttlMul: 0.92 },
    { type:'bossface', count: 1, sizeMul: 1.08, ttlMul: 0.92 }
  ], 'ultimateBurst');
}

// -------------------------
// PATCH F: Boss Skills + Telegraph
// -------------------------
const skills = new BossSkills({
  onTelegraph: ({name, ms, kind})=>{
    if(!running || ended) return;
    // visual telegraph
    layerEl?.classList.add('sb-telegraph');
    document.body.classList.add('sb-tele-on');
    say(`⚠️ ${name}! เตรียมตัว!`, kind==='reward' ? 'good' : 'miss');
    events.push({ t:(TIME*1000-timeLeft), type:'telegraph', name, ms, kind });

    setTimeout(()=>{
      layerEl?.classList.remove('sb-telegraph');
      document.body.classList.remove('sb-tele-on');
    }, Math.max(240, ms|0));
  },
  onFire: (payload)=>{
    if(!running || ended) return;
    burstSpawn(payload.plan || [], payload.tag || 'skill');
    events.push({ t:(TIME*1000-timeLeft), type:'skill', tag: payload.tag || '', plan: (payload.plan||[]).map(p=>({t:p.type,c:p.count})) });
  }
});

function burstSpawn(plan, tag='burst'){
  if(!plan || !plan.length) return;
  for(const p of plan){
    const type = p.type || 'normal';
    const count = Math.max(1, Math.min(16, p.count|0));
    const sizeMul = clamp(Number(p.sizeMul)||1, 0.75, 1.25);
    const ttlMul  = clamp(Number(p.ttlMul)||1, 0.75, 1.30);

    for(let i=0;i<count;i++){
      spawnOne({ forcedType: type, sizeMul, ttlMul, tag });
    }
  }
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

  // FEVER ready => ultimate ready (play mode only)
  if(fever >= FEVER_MAX && MODE !== 'research'){
    ultReady = true;
  }
  const on = ultReady && MODE !== 'research';
  ensureUltimateBtn();
  if(ultBtn){
    ultBtn.style.display = on ? 'flex' : 'none';
    ultBtn.classList.toggle('is-ready', on);
    ultBtn.textContent = on ? '⚡ ULTIMATE (READY)' : '⚡ ULTIMATE';
  }

  if(feverLabel){
    const ready = fever >= FEVER_MAX;
    feverLabel.textContent = ready ? 'READY' : `${Math.round(fever)}%`;
    feverLabel.classList.toggle('on', ready);
  }
}

// -------------------------
// Difficulty / excitement scaling
// -------------------------
function phaseIntensityMul(){
  return clamp(1.04 - (phase-1)*0.09, 0.82, 1.04);
}
function trapBoost(){
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

function spawnOne(opts = {}){
  const id = Math.floor(Math.random()*1e9);

  const b = trapBoost();
  const roll = Math.random();

  let type = opts.forcedType || 'normal';
  if(!opts.forcedType){
    const pBomb  = 0.08 + b;
    const pDecoy = 0.15 + b;
    const pHeal  = 0.20;
    const pShield= 0.26;

    if(roll < pBomb) type='bomb';
    else if(roll < pDecoy) type='decoy';
    else if(roll < pHeal) type='heal';
    else if(roll < pShield) type='shield';

    if(bossHp <= 26 && Math.random() < 0.22){
      type = 'bossface';
    }
  }

  const sizeMul = clamp(Number(opts.sizeMul)||1, 0.75, 1.25);
  const ttlMul  = clamp(Number(opts.ttlMul)||1, 0.75, 1.30);

  let sizePx = CFG0.baseSize * sizeMul;
  if(type === 'bossface') sizePx = CFG0.baseSize * 1.14 * sizeMul;
  if(type === 'bomb') sizePx = CFG0.baseSize * 1.03 * sizeMul;

  const ttl = Math.round(CFG0.ttl * ttlMul);

  renderer.spawnTarget({
    id, type,
    sizePx,
    bossEmoji: boss().emoji,
    ttlMs: ttl
  });

  scheduleTTL(id, ttl);
  events.push({ t:(TIME*1000-timeLeft), type:'spawn', id, targetType:type, sizePx:Math.round(sizePx), tag: opts.tag||'' });
}

function onTargetHit(id, pt){
  if(!running || ended || paused) return;

  const el = renderer.targets.get(id);
  if(!el) return;

  clearTTL(id);

  const type = (el.className.match(/sb-target--(\w+)/)?.[1]) || 'normal';

  dl.onHit();

  let grade='good', scoreDelta=0;

  const ultOn = now() < ultActiveUntil;

  if(type==='decoy'){
    grade='bad'; scoreDelta= ultOn ? -2 : -6; combo=0;
    say('หลงเป้าล่อ!', 'bad');
  }else if(type==='bomb'){
    grade='bomb'; scoreDelta= ultOn ? -6 : -14; combo=0;
    if(shield>0){
      shield--; scoreDelta=0; grade='shield';
      say('กันระเบิดด้วย Shield!', 'good');
    }else{
      youHp = Math.max(0, youHp-(ultOn ? 10 : 18));
      say('โดนระเบิด!', 'bad');
    }
  }else if(type==='heal'){
    grade='heal'; scoreDelta=6;
    youHp = Math.min(YOU_HP_MAX, youHp + (ultOn ? 22 : 16));
    say('+HP!', 'good');
  }else if(type==='shield'){
    grade='shield'; scoreDelta=6;
    shield = Math.min(5, shield+1);
    say('+SHIELD!', 'good');
  }else if(type==='bossface'){
    grade='perfect';
    scoreDelta = ultOn ? 26 : 18;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * (ultOn ? (CFG0.bossFaceDmg*1.18) : CFG0.bossFaceDmg)));
    say('CRIT! ใส่หน้า Boss!', 'perfect');
  }else{
    const perfect = (ultOn || fever >= FEVER_MAX);
    grade = perfect ? 'perfect' : 'good';
    scoreDelta = perfect ? (ultOn ? 18 : 14) : 10;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * (ultOn ? (CFG0.bossDmg*1.16) : CFG0.bossDmg)));
    say(perfect ? 'PERFECT!' : 'ดีมาก!', perfect ? 'perfect' : 'good');
  }

  score = Math.max(0, score + scoreDelta);
  maxCombo = Math.max(maxCombo, combo);

  // fever gain
  const feverGain = (grade==='perfect') ? (ultOn ? 7 : 10) : 6;
  fever = clamp(fever + feverGain, 0, FEVER_MAX);

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
  if(Math.random() < 0.06) measureStageMetrics();

  const t = now();
  const dt = t - tStart;
  timeLeft = Math.max(0, (TIME*1000) - dt);

  // spawn interval
  const mul = phaseIntensityMul();

  // PATCH F: Ultimate slows spawn slightly (gives "slow-mo control" feel)
  const ultOn = t < ultActiveUntil;
  const slowMul = ultOn ? 1.18 : 1.0;

  const spawnMin = CFG0.spawnMin * mul * slowMul;
  const spawnMax = CFG0.spawnMax * mul * slowMul;

  const since = t - tLastSpawn;
  const targetInterval = clamp(spawnMin + Math.random()*(spawnMax-spawnMin), 420, 1800);

  if(since >= targetInterval){
    tLastSpawn = t;

    // During ultimate: bias normals (reward feeling)
    if(ultOn && Math.random() < 0.72){
      spawnOne({ forcedType:'normal', sizeMul:0.96, ttlMul:0.92, tag:'ult' });
    }else{
      spawnOne();
    }

    dl.onShot();
  }

  // FEVER decay while "ready" (keeps tension)
  if(fever >= FEVER_MAX){
    fever = clamp(fever - 0.22, 0, FEVER_MAX);
  }

  // Boss skill system only in play (not research) to keep research clean/deterministic
  if(MODE !== 'research'){
    skills.tick(dt, {
      diffKey: diff,
      phase,
      bossIndex,
      feverOn: ultOn,
      youHpPct: youHp/YOU_HP_MAX,
      bossHpPct: bossHp/BOSS_HP_MAX
    });
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

  ultReady = false;
  ultActiveUntil = 0;
  ultCooldownUntil = 0;

  for(const [,t] of ttlTimers.entries()) clearTimeout(t);
  ttlTimers.clear();

  dl.reset();
  renderer.destroy();
  skills.reset();

  setBossUI();
  setHUD();
  say('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');

  showView('play');

  measureStageMetrics();
  setTimeout(measureStageMetrics, 120);

  tStart = now();
  tLastSpawn = tStart;

  ensureUltimateBtn();
  requestAnimationFrame(tick);
}

// downloads
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

// UI binds
btnPlay?.addEventListener('click', ()=> start('normal'));
btnResearch?.addEventListener('click', ()=> start('research'));

btnHowto?.addEventListener('click', ()=>{
  if(!howtoBox) return;
  howtoBox.classList.toggle('is-on');
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

btnEvtCsv?.addEventListener('click', ()=> downloadCSV('shadowbreaker_events.csv', events));
btnSesCsv?.addEventListener('click', ()=> downloadCSV('shadowbreaker_session.csv', [session]));

// init
showView('menu');
setBossUI();
setHUD();