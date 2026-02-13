// === /fitness/js/engine.js ===
// Shadow Breaker engine (PATCH: boot ไม่พังจาก AI import + เป้าหมดอายุหาย + target size/spacing)
// ✅ ใช้ DLFeatures snapshot ไปให้ RB_AI ได้ (แต่ไม่ทำให้เกมพังถ้า AI ไม่พร้อม)

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { DLFeatures } from './dl-features.js';
import { RB_AI } from './ai-predictor.js';

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

// รองรับทั้ง mode=research และ run=research
const MODE = ((q('mode','') || q('run','normal')) || 'normal').toLowerCase(); // normal | research
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

// ----- Difficulty config -----
// ✅ PATCH: ลดขนาดเป้า + ให้โล่งขึ้นบนมือถือ
const DIFF_CONFIG = {
  easy:   { label:'Easy — ผ่อนคลาย',  spawnIntervalMin:980, spawnIntervalMax:1380, targetLifetime:1350, baseSize:104, bossDamageNormal:0.04,  bossDamageBossFace:0.45 },
  normal: { label:'Normal — สมดุล',   spawnIntervalMin:820, spawnIntervalMax:1260, targetLifetime:1250, baseSize:98,  bossDamageNormal:0.035, bossDamageBossFace:0.40 },
  hard:   { label:'Hard — ท้าทาย',    spawnIntervalMin:680, spawnIntervalMax:1040, targetLifetime:1150, baseSize:92,  bossDamageNormal:0.03,  bossDamageBossFace:0.35 }
};

// ----- FEVER / HP -----
const FEVER_MAX = 100;
const YOU_HP_MAX = 100;
const BOSS_HP_MAX = 100;

function setScaleX(el, pct){
  if(!el) return;
  el.style.transform = `scaleX(${clamp(pct, 0, 1)})`;
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

const diff = DIFF_CONFIG[DIFF] ? DIFF : 'normal';
const CFG = DIFF_CONFIG[diff];

// Events log (simple)
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

// -------------------------
// Renderer
// -------------------------
const renderer = new DomRendererShadow(layerEl, {
  wrapEl,
  feedbackEl: msgMainEl,
  onTargetHit,
  onTargetExpire: (id, info)=>{
    if(!running || ended || paused) return;
    miss++;
    combo = 0;
    dl.onMiss();
    events.push({ t: (TIME*1000 - timeLeft), type:'expire', id, reason: info?.reason || 'expired' });
    setHUD();
  }
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
  setBossUI();
}

function spawnOne(){
  const id = Math.floor(Math.random()*1e9);
  const roll = Math.random();

  let type = 'normal';
  if(roll < 0.08) type = 'bomb';
  else if(roll < 0.15) type = 'decoy';
  else if(roll < 0.20) type = 'heal';
  else if(roll < 0.26) type = 'shield';

  if(bossHp <= 26 && Math.random() < 0.22){
    type = 'bossface';
  }

  let sizePx = CFG.baseSize;
  if(type === 'bossface') sizePx = CFG.baseSize * 1.14;
  if(type === 'bomb') sizePx = CFG.baseSize * 1.04;

  renderer.spawnTarget({
    id, type,
    sizePx,
    bossEmoji: boss().emoji,
    ttlMs: CFG.targetLifetime
  });

  events.push({ t: (TIME*1000 - timeLeft), type:'spawn', id, targetType:type, sizePx: Math.round(sizePx) });
  dl.onShot();
}

function onTargetHit(id, pt){
  if(!running || ended || paused) return;

  const el = renderer.targets.get(id);
  if(!el) return;

  const m = el.className.match(/sb-target--(\w+)/);
  const type = (m && m[1]) ? m[1] : 'normal';

  let grade = 'good';
  let scoreDelta = 0;

  if(type === 'decoy'){
    grade = 'bad';
    scoreDelta = -6;
    combo = 0;
    say('หลงเป้าล่อ!', 'bad');
  }else if(type === 'bomb'){
    grade = 'bomb';
    scoreDelta = -14;
    combo = 0;
    if(shield>0){
      shield--;
      say('กันระเบิดด้วย Shield!', 'good');
      scoreDelta = 0;
      grade = 'shield';
    }else{
      youHp = Math.max(0, youHp - 18);
      say('โดนระเบิด!', 'bad');
    }
  }else if(type === 'heal'){
    grade = 'heal';
    scoreDelta = 6;
    youHp = Math.min(YOU_HP_MAX, youHp + 16);
    say('+HP!', 'good');
  }else if(type === 'shield'){
    grade = 'shield';
    scoreDelta = 6;
    shield = Math.min(5, shield + 1);
    say('+SHIELD!', 'good');
  }else if(type === 'bossface'){
    grade = 'perfect';
    scoreDelta = 18;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * CFG.bossDamageBossFace));
    say('CRIT! ใส่หน้า Boss!', 'perfect');
  }else{
    grade = (fever >= FEVER_MAX) ? 'perfect' : 'good';
    scoreDelta = (grade === 'perfect') ? 14 : 10;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * CFG.bossDamageNormal));
    say(grade === 'perfect' ? 'PERFECT!' : 'ดีมาก!', grade === 'perfect' ? 'perfect' : 'good');
  }

  score = Math.max(0, score + scoreDelta);
  maxCombo = Math.max(maxCombo, combo);

  fever = clamp(fever + (grade === 'perfect' ? 10 : 6), 0, FEVER_MAX);

  // ✅ DL features
  dl.onHit({ grade });

  renderer.playHitFx(id, { clientX: pt.clientX, clientY: pt.clientY, grade, scoreDelta });
  renderer.removeTarget(id, 'hit');

  events.push({ t: (TIME*1000 - timeLeft), type:'hit', id, targetType:type, grade, scoreDelta });

  if(bossHp <= 0) nextBossOrPhase();
  if(youHp <= 0) endGame('dead');

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
  session.accPct = Number(dl.getAccPct().toFixed(2));

  const accPct = dl.getAccPct();

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

  // (optional) AI tip at end (play only)
  try{
    if (RB_AI && RB_AI.isAssistEnabled && RB_AI.isAssistEnabled()){
      const snap = dl.snapshot({ hp: youHp });
      const pred = RB_AI.predict(snap);
      if (pred?.tip) say(pred.tip, 'good');
    }
  }catch{}
}

function tick(){
  if(!running || ended) return;
  requestAnimationFrame(tick);
  if(paused) return;

  const t = now();
  const dt = t - tStart;
  timeLeft = Math.max(0, (TIME*1000) - dt);

  const since = t - tLastSpawn;
  const targetInterval = clamp(
    CFG.spawnIntervalMin + Math.random()*(CFG.spawnIntervalMax - CFG.spawnIntervalMin),
    450, 1800
  );

  if(since >= targetInterval){
    tLastSpawn = t;
    spawnOne();
  }

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
function start(){
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
  say('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');

  showView('play');

  tStart = now();
  tLastSpawn = tStart;
  requestAnimationFrame(tick);
}

btnPlay?.addEventListener('click', start);
btnResearch?.addEventListener('click', start);

btnHowto?.addEventListener('click', ()=> howtoBox?.classList.toggle('is-on'));

btnBackMenu?.addEventListener('click', ()=>{
  running = false; ended = false; paused = false;
  renderer.destroy();
  showView('menu');
});

btnPause?.addEventListener('change', ()=>{ paused = !!btnPause.checked; });

btnRetry?.addEventListener('click', start);
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

btnEvtCsv?.addEventListener('click', ()=>{ if(events.length) downloadCSV('shadowbreaker_events.csv', events); });
btnSesCsv?.addEventListener('click', ()=> downloadCSV('shadowbreaker_session.csv', [session]));

// init
showView('menu');
setBossUI();
setHUD();