// === /fitness/js/engine.js ===
// Shadow Breaker engine (PATCH I)
// ✅ Telegraph 120ms before spawn
// ✅ Streak multiplier (combo tiers)
// ✅ Boss phase special patterns
// ✅ Fix: targets auto-expire via renderer ttlMs (no more "stuck targets")

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { DLFeatures } from './dl-features.js';
import { AIPredictor } from './ai-predictor.js';

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

const MODE = (q('mode','normal') || 'normal').toLowerCase(); // normal | research
const PID  = q('pid','');
const DIFF = (q('diff','normal') || 'normal').toLowerCase();
const TIME = Math.max(20, Math.min(240, qNum('time', 70)));
const HUB  = q('hub','./hub.html');

// -------------------------
// DOM
// -------------------------
const $ = (s)=>document.querySelector(s);
const wrapEl = $('#sb-wrap');

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

// -------------------------
// Data (bosses)
// -------------------------
const BOSSES = [
  { name:'Bubble Glove', emoji:'🐣', desc:'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน', phases: 3 },
  { name:'Meteor Punch', emoji:'☄️', desc:'เร็วขึ้น — อย่าหลงเป้าล่อ', phases: 3 },
  { name:'Neon Hydra', emoji:'🐉', desc:'คอมโบสำคัญมาก — รักษาจังหวะ', phases: 3 },
];

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const now = ()=>performance.now();
const r01 = ()=>Math.random();

// ----- Difficulty config -----
const DIFF_CONFIG = {
  easy:   { label:'Easy — ผ่อนคลาย',  spawnIntervalMin:950, spawnIntervalMax:1350, targetLifetime:1500, baseSize:112, bossDamageNormal:0.04,  bossDamageBossFace:0.45 },
  normal: { label:'Normal — สมดุล',   spawnIntervalMin:820, spawnIntervalMax:1200, targetLifetime:1300, baseSize:106, bossDamageNormal:0.035, bossDamageBossFace:0.40 },
  hard:   { label:'Hard — ท้าทาย',    spawnIntervalMin:660, spawnIntervalMax:980,  targetLifetime:1150, baseSize:98,  bossDamageNormal:0.03,  bossDamageBossFace:0.35 }
};

// ----- FEVER / HP -----
const FEVER_MAX = 100;
const YOU_HP_MAX = 100;
const BOSS_HP_MAX = 100;

function setScaleX(el, pct){
  if(!el) return;
  const p = clamp(pct, 0, 1);
  el.style.transform = `scaleX(${p})`;
}

function showView(which){
  viewMenu?.classList.toggle('is-active', which === 'menu');
  viewPlay?.classList.toggle('is-active', which === 'play');
  viewResult?.classList.toggle('is-active', which === 'result');
}

// -------------------------
// State
// -------------------------
let running = false;
let ended = false;
let paused = false;

let tStart = 0;
let tLastSpawn = 0;
let timeLeft = TIME * 1000;

let score = 0;
let combo = 0;
let maxCombo = 0;
let miss = 0;

let fever = 0;
let shield = 0;

let youHp = YOU_HP_MAX;
let bossHp = BOSS_HP_MAX;

let bossIndex = 0;
let phase = 1;
let bossesCleared = 0;

// PATCH I: special pattern timer
let tLastSpecial = 0;

// Telegraph constants
const TELEGRAPH_MS = 120;

// Combo multiplier tiers (เร้าใจแบบเห็นผล)
function comboMul(c){
  if (c >= 30) return 2.2;
  if (c >= 18) return 1.8;
  if (c >= 10) return 1.4;
  if (c >= 5)  return 1.15;
  return 1.0;
}

const diff = DIFF_CONFIG[DIFF] ? DIFF : 'normal';
const CFG = DIFF_CONFIG[diff];

// Events log (simple, can expand)
const events = [];
const session = {
  pid: PID || '',
  mode: MODE,
  diff: diff,
  timeSec: TIME,
  startedAt: new Date().toISOString(),
  endedAt: '',
  score: 0,
  maxCombo: 0,
  miss: 0,
  phase: 1,
  bossesCleared: 0,
  accPct: 0
};

const dl = new DLFeatures();
const ai = new AIPredictor();

// -------------------------
// Renderer
// -------------------------
const renderer = new DomRendererShadow(layerEl, {
  wrapEl,
  feedbackEl: msgMainEl,
  onTargetHit: onTargetHit,
  onTargetExpire: onTargetExpire
});
renderer.setDifficulty(diff);

// -------------------------
// Helpers
// -------------------------
function boss(){
  return BOSSES[clamp(bossIndex,0,BOSSES.length-1)];
}

function setBossUI(){
  const b = boss();
  if(bossNameEl) bossNameEl.textContent = `${b.name} ${b.emoji}`;
  if(metaEmoji) metaEmoji.textContent = b.emoji;
  if(metaName) metaName.textContent = b.name;
  if(metaDesc) metaDesc.textContent = b.desc;
  if(bossPhaseLabel) bossPhaseLabel.textContent = String(phase);
  if(bossShieldLabel) bossShieldLabel.textContent = String(shield);
  if(textPhase) textPhase.textContent = String(phase);
  if(textShield) textShield.textContent = String(shield);
}

function setHUD(){
  if(textTime)  textTime.textContent = `${(timeLeft/1000).toFixed(1)} s`;
  if(textScore) textScore.textContent = String(score|0);
  if(textCombo) textCombo.textContent = String(combo|0);
  if(textMiss)  textMiss.textContent  = String(miss|0);

  setScaleX(hpYouTop, youHp / YOU_HP_MAX);
  setScaleX(hpYouBottom, youHp / YOU_HP_MAX);
  setScaleX(hpBossTop, bossHp / BOSS_HP_MAX);
  setScaleX(hpBossBottom, bossHp / BOSS_HP_MAX);

  setScaleX(feverBar, fever / FEVER_MAX);
  if(feverLabel){
    const on = fever >= FEVER_MAX;
    feverLabel.textContent = on ? 'READY' : `${Math.round(fever)}%`;
    feverLabel.classList.toggle('on', on);
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
  tLastSpecial = now();
  setBossUI();
}

function targetRoll(){
  // PATCH I: phase affects probabilities (รู้สึก “บอสกดดันจริง”)
  const p = phase;
  const base = {
    bomb:  0.08,
    decoy: 0.07,
    heal:  0.05,
    shield:0.06
  };

  if (p === 2) {
    base.decoy += 0.05; base.bomb += 0.02;
  } else if (p >= 3) {
    base.decoy += 0.07; base.bomb += 0.05;
    base.heal  -= 0.01;
  }

  // boss-specific flavor
  if (bossIndex === 0) { // Bubble Glove
    base.decoy -= 0.01; base.heal += 0.01;
  } else if (bossIndex === 1) { // Meteor Punch
    base.bomb += 0.04;
  } else { // Neon Hydra
    base.decoy += 0.03;
  }

  // clamp safe
  base.bomb = clamp(base.bomb, 0.02, 0.22);
  base.decoy = clamp(base.decoy, 0.02, 0.22);
  base.heal = clamp(base.heal, 0.02, 0.12);
  base.shield = clamp(base.shield, 0.03, 0.14);

  const roll = r01();
  let type = 'normal';
  if (roll < base.bomb) type = 'bomb';
  else if (roll < base.bomb + base.decoy) type = 'decoy';
  else if (roll < base.bomb + base.decoy + base.heal) type = 'heal';
  else if (roll < base.bomb + base.decoy + base.heal + base.shield) type = 'shield';

  // bossface appears more when boss low, and more often on higher phase
  const bossfaceChance = bossHp <= 28 ? (0.18 + (phase-1)*0.05) : 0.0;
  if (bossfaceChance > 0 && r01() < bossfaceChance) type = 'bossface';

  return type;
}

function sizeFor(type){
  let sizePx = CFG.baseSize;
  if(type === 'bossface') sizePx = CFG.baseSize * 1.15;
  if(type === 'bomb') sizePx = CFG.baseSize * 1.05;
  if(type === 'heal' || type === 'shield') sizePx = CFG.baseSize * 0.98;
  return sizePx;
}

// ✅ PATCH I: spawn with telegraph
function spawnTelegraphed(type){
  const id = Math.floor(Math.random()*1e9);
  const sizePx = sizeFor(type);

  // pick position once
  const pos = renderer.pickSpawnPos(sizePx);

  // telegraph ring
  renderer.telegraph(pos.x, pos.y, sizePx, TELEGRAPH_MS, type === 'bossface' ? 'boss' : '');

  // spawn after 120ms
  setTimeout(()=>{
    if(!running || ended) return;

    renderer.spawnTarget({
      id, type,
      sizePx,
      x: pos.x, y: pos.y,
      bossEmoji: boss().emoji,
      ttlMs: CFG.targetLifetime
    });

    events.push({ t: (TIME*1000 - timeLeft), type:'spawn', id, targetType:type, sizePx: Math.round(sizePx) });
    dl.onShot(); // attempt opportunity
  }, TELEGRAPH_MS);

  return id;
}

function onTargetExpire(id, data){
  // TTL expired => miss (unless game ended)
  if(!running || ended) return;
  miss++;
  combo = 0;

  // small penalty pressure (but not too harsh for kids)
  youHp = Math.max(0, youHp - 4);

  say('ช้าไป! เป้าหายแล้ว', 'miss');
  events.push({ t: (TIME*1000 - timeLeft), type:'expire', id, targetType:data?.type || '', sizePx: data?.sizePx || 0 });

  if(youHp <= 0) endGame('dead');
  setHUD();
}

function onTargetHit(id, pt){
  if(!running || ended || paused) return;

  const el = renderer.targets.get(id);
  if(!el) return;

  const type = (el.className.match(/sb-target--(\w+)/)?.[1]) || 'normal';

  dl.onHit();

  // multiplier: based on current combo before increment (feel snappy)
  const mul = comboMul(combo);

  let grade = 'good';
  let baseScore = 0;
  let scoreDelta = 0;

  if(type === 'decoy'){
    grade = 'bad';
    baseScore = -6;
    combo = 0;
    say('หลงเป้าล่อ!', 'bad');
    scoreDelta = baseScore;
  }else if(type === 'bomb'){
    grade = 'bomb';
    baseScore = -14;
    combo = 0;
    if(shield>0){
      shield--;
      say('กันระเบิดด้วย Shield!', 'good');
      baseScore = 0;
      grade = 'shield';
      scoreDelta = 0;
    }else{
      youHp = Math.max(0, youHp - 18);
      say('โดนระเบิด!', 'bad');
      scoreDelta = baseScore;
    }
  }else if(type === 'heal'){
    grade = 'heal';
    baseScore = 6;
    youHp = Math.min(YOU_HP_MAX, youHp + 16);
    say('+HP!', 'good');
    scoreDelta = Math.round(baseScore * mul);
    combo++; // heal should still reward streak
  }else if(type === 'shield'){
    grade = 'shield';
    baseScore = 6;
    shield = Math.min(5, shield + 1);
    say('+SHIELD!', 'good');
    scoreDelta = Math.round(baseScore * mul);
    combo++;
  }else if(type === 'bossface'){
    grade = 'perfect';
    baseScore = 18;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * CFG.bossDamageBossFace));
    say('CRIT! ใส่หน้า Boss!', 'perfect');
    scoreDelta = Math.round(baseScore * mul);
  }else{
    grade = (fever >= FEVER_MAX) ? 'perfect' : 'good';
    baseScore = (grade === 'perfect') ? 14 : 10;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * CFG.bossDamageNormal));
    say(grade === 'perfect' ? `PERFECT x${mul.toFixed(1)}!` : `ดีมาก x${mul.toFixed(1)}!`, grade === 'perfect' ? 'perfect' : 'good');
    scoreDelta = Math.round(baseScore * mul);
  }

  maxCombo = Math.max(maxCombo, combo);
  score = Math.max(0, score + scoreDelta);

  // fever gain (slightly boosted with multiplier)
  const feverGain = (grade === 'perfect' ? 10 : 6) * (mul >= 1.8 ? 1.15 : 1.0);
  fever = clamp(fever + feverGain, 0, FEVER_MAX);

  renderer.playHitFx(id, { clientX: pt.clientX, clientY: pt.clientY, grade, scoreDelta });
  renderer.removeTarget(id, 'hit');

  events.push({ t: (TIME*1000 - timeLeft), type:'hit', id, targetType:type, grade, scoreDelta, mul:Number(mul.toFixed(2)) });

  if(bossHp <= 0) nextBossOrPhase();
  if(youHp <= 0) endGame('dead');

  setBossUI();
  setHUD();
}

function endGame(reason='timeup'){
  if(ended) return;
  ended = true;
  running = false;

  session.endedAt = new Date().toISOString();
  session.score = score|0;
  session.maxCombo = maxCombo|0;
  session.miss = miss|0;
  session.phase = phase|0;
  session.bossesCleared = bossesCleared|0;

  const totalShots = dl.getTotalShots();
  const hits = dl.getHits();
  const accPct = totalShots > 0 ? (hits/totalShots)*100 : 0;
  session.accPct = Number(accPct.toFixed(2));

  if(resTime) resTime.textContent = `${(TIME - timeLeft/1000).toFixed(1)} s`;
  if(resScore) resScore.textContent = String(score|0);
  if(resMaxCombo) resMaxCombo.textContent = String(maxCombo|0);
  if(resMiss) resMiss.textContent = String(miss|0);
  if(resPhase) resPhase.textContent = String(phase|0);
  if(resBossCleared) resBossCleared.textContent = String(bossesCleared|0);
  if(resAcc) resAcc.textContent = `${accPct.toFixed(1)} %`;

  let g = 'C';
  if(accPct >= 85 && bossesCleared >= 1) g='A';
  else if(accPct >= 70) g='B';
  else if(accPct >= 55) g='C';
  else g='D';
  if(resGrade) resGrade.textContent = g;

  showView('result');
}

// ✅ PATCH I: boss special patterns (every few seconds)
function runSpecialPattern(){
  const b = bossIndex;
  const p = phase;

  // cooldown per diff (hard triggers more often)
  const cd = (diff === 'hard') ? 3400 : (diff === 'easy' ? 5200 : 4200);

  const t = now();
  if ((t - tLastSpecial) < cd) return;
  tLastSpecial = t;

  // Pattern intensity scales with phase
  const k = (p === 1) ? 1 : (p === 2 ? 2 : 3);

  if (b === 0) {
    // Bubble Glove: "Bubble Wave" (safe fun streak builder)
    say('BUBBLE WAVE!', 'good');
    for (let i=0;i<k+1;i++) spawnTelegraphed('normal');
    if (p >= 2 && r01() < 0.35) spawnTelegraphed('heal');
  } else if (b === 1) {
    // Meteor Punch: "Meteor Rain" (pressure)
    say('METEOR RAIN!', 'miss');
    for (let i=0;i<k;i++) spawnTelegraphed('bomb');
    for (let i=0;i<k;i++) spawnTelegraphed('normal');
    if (p >= 3) spawnTelegraphed('decoy');
  } else {
    // Neon Hydra: "Hydra Heads" (combo test)
    say('HYDRA HEADS!', 'perfect');
    for (let i=0;i<k;i++) spawnTelegraphed('decoy');
    for (let i=0;i<k;i++) spawnTelegraphed('normal');
    if (bossHp <= 40) spawnTelegraphed('bossface');
  }
}

function tick(){
  if(!running || ended) return;
  requestAnimationFrame(tick);
  if(paused) return;

  const t = now();
  const dt = t - tStart;
  timeLeft = Math.max(0, (TIME*1000) - dt);

  // spawn interval: phase increases pressure slightly
  const phaseMul = (phase === 1) ? 1.0 : (phase === 2 ? 0.92 : 0.86);
  const targetInterval = clamp(
    (CFG.spawnIntervalMin + r01()*(CFG.spawnIntervalMax - CFG.spawnIntervalMin)) * phaseMul,
    420, 1800
  );

  if ((t - tLastSpawn) >= targetInterval){
    tLastSpawn = t;
    const type = targetRoll();
    spawnTelegraphed(type);
  }

  // special pattern
  runSpecialPattern();

  // FEVER decay if active
  if(fever >= FEVER_MAX){
    fever = clamp(fever - 0.22, 0, FEVER_MAX);
  }

  if(timeLeft <= 0){
    endGame('timeup');
  }

  setHUD();
}

// -------------------------
// Boot
// -------------------------
function start(mode){
  ended = false;
  running = true;
  paused = false;

  score=0; combo=0; maxCombo=0; miss=0;
  fever=0; shield=0;
  youHp=YOU_HP_MAX;
  bossHp=BOSS_HP_MAX;
  bossIndex=0; phase=1; bossesCleared=0;

  dl.reset();
  renderer.destroy();

  setBossUI();
  setHUD();
  say('วงเตือนจะขึ้นก่อน—เตรียมชก/แตะ!', '');

  showView('play');

  tStart = now();
  tLastSpawn = tStart;
  tLastSpecial = tStart;

  requestAnimationFrame(tick);
}

btnPlay?.addEventListener('click', ()=> start('normal'));
btnResearch?.addEventListener('click', ()=> start('research'));

btnHowto?.addEventListener('click', ()=>{
  howtoBox?.classList.toggle('is-on');
});

btnBackMenu?.addEventListener('click', ()=>{
  running = false;
  ended = false;
  paused = false;
  renderer.destroy();
  showView('menu');
});

btnPause?.addEventListener('change', ()=>{
  paused = !!btnPause.checked;
});

btnRetry?.addEventListener('click', ()=> start(MODE));
btnMenu?.addEventListener('click', ()=>{
  renderer.destroy();
  showView('menu');
});

function downloadCSV(filename, rows){
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

btnEvtCsv?.addEventListener('click', ()=>{
  if(!events.length) return;
  downloadCSV('shadowbreaker_events.csv', events);
});

btnSesCsv?.addEventListener('click', ()=>{
  downloadCSV('shadowbreaker_session.csv', [session]);
});

// init
showView('menu');
setBossUI();
setHUD();