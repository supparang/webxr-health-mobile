// === /fitness/js/engine.js ===
// Shadow Breaker engine — FULL PATCH (AI global-safe + expire rules + adaptive size + less cramped UX)
// ✅ FIX: no import crash when ai-predictor.js is classic/global (window.RB_AI)
// ✅ FIX: targets expire & disappear smoothly
// ✅ FIX: miss counting rule (expire counts only normal/bossface)
// ✅ FIX: Decoy/Bomb/Heal/Shield expire = no MISS FX/text
// ✅ FIX: reduce "PERFECT + MISS" overlap illusion
// ✅ FIX: adaptive baseSize by screen/layer
// ✅ FIX: supports HTML menu with sb-btn-start + inputs (pid/diff/time)
// ✅ FIX: safe if some optional DOM nodes are missing

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { DLFeatures } from './dl-features.js';
// NOTE: ai-predictor.js may be classic script/global only (window.RB_AI), so DO NOT import named export.

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

// Mutable config runtime (can be overridden by menu inputs)
let MODE = (q('mode', q('run','play')) || 'play').toLowerCase(); // play|research|normal
let PID  = q('pid','');
let DIFF = (q('diff','normal') || 'normal').toLowerCase();
let TIME = Math.max(20, Math.min(240, qNum('time', 70)));
const HUB = q('hub','./../herohealth/hub.html');

// -------------------------
// DOM
// -------------------------
const $ = (s)=>document.querySelector(s);

const wrapEl = $('#sb-wrap');

const viewMenu   = $('#sb-view-menu');
const viewPlay   = $('#sb-view-play');
const viewResult = $('#sb-view-result');

// Menu controls (ABCD HTML)
const btnStart    = $('#sb-btn-start');
const inputPid    = $('#sb-input-pid');
const inputDiff   = $('#sb-input-diff');
const inputTime   = $('#sb-input-time');
const modeDescEl  = $('#sb-mode-desc');

const btnPlay     = $('#sb-btn-play');
const btnResearch = $('#sb-btn-research');
const btnHowto    = $('#sb-btn-howto');
const howtoBox    = $('#sb-howto');

const btnBackMenu = $('#sb-btn-back-menu');
const btnPause    = $('#sb-btn-pause');
const btnFever    = $('#sb-btn-fever');
const feverHintEl = $('#sb-fever-hint');

const layerEl   = $('#sb-target-layer');
const msgMainEl = $('#sb-msg-main');

const textTime   = $('#sb-text-time');
const textScore  = $('#sb-text-score');
const textCombo  = $('#sb-text-combo');
const textPhase  = $('#sb-text-phase');
const textMiss   = $('#sb-text-miss');
const textShield = $('#sb-text-shield');

const hpYouTop     = $('#sb-hp-you-top');
const hpBossTop    = $('#sb-hp-boss-top');
const hpYouBottom  = $('#sb-hp-you-bottom');
const hpBossBottom = $('#sb-hp-boss-bottom');

const bossNameEl = $('#sb-current-boss-name');
const metaEmoji  = $('#sb-meta-emoji');
const metaName   = $('#sb-meta-name');
const metaDesc   = $('#sb-meta-desc');
const bossPhaseLabel  = $('#sb-boss-phase-label');
const bossShieldLabel = $('#sb-boss-shield-label');

const feverBar   = $('#sb-fever-bar');
const feverLabel = $('#sb-label-fever');

const resTime        = $('#sb-res-time');
const resScore       = $('#sb-res-score');
const resMaxCombo    = $('#sb-res-max-combo');
const resMiss        = $('#sb-res-miss');
const resPhase       = $('#sb-res-phase');
const resBossCleared = $('#sb-res-boss-cleared');
const resAcc         = $('#sb-res-acc');
const resGrade       = $('#sb-res-grade');

const btnRetry  = $('#sb-btn-result-retry');
const btnMenu   = $('#sb-btn-result-menu');
const btnEvtCsv = $('#sb-btn-download-events');
const btnSesCsv = $('#sb-btn-download-session');

const linkHub = $('#sb-link-hub');
const btnMeta = $('#sb-btn-meta');
const metaBox = $('#sb-meta');
const metaBody = $('#sb-meta-body');

// -------------------------
// Data (bosses)
// -------------------------
const BOSSES = [
  { name:'Bubble Glove', emoji:'🐣', desc:'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน', phases: 3 },
  { name:'Meteor Punch', emoji:'☄️', desc:'เร็วขึ้น — อย่าหลงเป้าล่อ', phases: 3 },
  { name:'Neon Hydra', emoji:'🐉', desc:'คอมโบสำคัญมาก — รักษาจังหวะ', phases: 3 },
];

// -------------------------
// Utils
// -------------------------
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const now = ()=>performance.now();

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

function safeText(el, txt){
  if(el) el.textContent = String(txt);
}

// -------------------------
// Game constants
// -------------------------
const FEVER_MAX = 100;
const YOU_HP_MAX = 100;
const BOSS_HP_MAX = 100;

const FEVER_ACTIVE_MS = 5500;
const FEVER_SCORE_MULT = 2.0;

// NOTE: baseSize below is raw; adaptiveBaseSize() applies at spawn time
const DIFF_CONFIG = {
  easy:   { label:'Easy — ผ่อนคลาย', spawnIntervalMin:950, spawnIntervalMax:1350, targetLifetime:1500, baseSize:112, bossDamageNormal:0.040, bossDamageBossFace:0.45 },
  normal: { label:'Normal — สมดุล',  spawnIntervalMin:800, spawnIntervalMax:1200, targetLifetime:1300, baseSize:106, bossDamageNormal:0.035, bossDamageBossFace:0.40 },
  hard:   { label:'Hard — ท้าทาย',   spawnIntervalMin:650, spawnIntervalMax:1000, targetLifetime:1150, baseSize:100, bossDamageNormal:0.030, bossDamageBossFace:0.35 }
};

function adaptiveBaseSize(raw){
  const r = layerEl?.getBoundingClientRect?.();
  const w = r?.width || window.innerWidth || 360;
  const h = r?.height || window.innerHeight || 640;
  const m = Math.max(280, Math.min(860, Math.min(w,h)));
  const scale = m / 520;
  const s = raw * scale;
  return clamp(s, 84, 130);
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
let feverActiveUntil = 0;
let shield = 0;

let youHp = YOU_HP_MAX;
let bossHp = BOSS_HP_MAX;

let bossIndex = 0;
let phase = 1;
let bossesCleared = 0;

let diff = DIFF_CONFIG[DIFF] ? DIFF : 'normal';
let CFG = DIFF_CONFIG[diff];

// feedback anti-overlap
let lastFeedbackAt = 0;
let lastFeedbackKind = ''; // hit | miss | system

// Events/session
const events = [];
const session = {
  pid: PID || '',
  mode: MODE,
  diff: diff,
  timeSec: TIME,
  startedAt: '',
  endedAt: '',
  score: 0,
  maxCombo: 0,
  miss: 0,
  phase: 1,
  bossesCleared: 0,
  accPct: 0,
  feverUses: 0
};
let feverUses = 0;

// AI / DL
const dl = new DLFeatures();
// global bridge (classic script) / optional
const ai = (typeof window !== 'undefined' && window.RB_AI) ? window.RB_AI : null;

// Active targets source-of-truth for expiry
// id -> { type, expireAtMs, sizePx }
const active = new Map();

// -------------------------
// Renderer
// -------------------------
const renderer = new DomRendererShadow(layerEl, {
  wrapEl,
  feedbackEl: msgMainEl,
  onTargetHit
});
renderer.setDifficulty(diff);

// -------------------------
// UI Helpers
// -------------------------
function currentBoss(){
  const i = clamp(bossIndex, 0, BOSSES.length - 1);
  return BOSSES[i];
}

function setBossUI(){
  const b = currentBoss();
  safeText(bossNameEl, `${b.name} ${b.emoji}`);
  safeText(metaEmoji, b.emoji);
  safeText(metaName, b.name);
  safeText(metaDesc, b.desc);
  safeText(bossPhaseLabel, phase);
  safeText(bossShieldLabel, shield);
  safeText(textPhase, phase);
  safeText(textShield, shield);
}

function setHUD(){
  safeText(textTime, `${(timeLeft/1000).toFixed(1)} s`);
  safeText(textScore, score|0);
  safeText(textCombo, combo|0);
  safeText(textMiss, miss|0);
  safeText(textShield, shield|0);
  safeText(textPhase, phase|0);

  setScaleX(hpYouTop, youHp / YOU_HP_MAX);
  setScaleX(hpYouBottom, youHp / YOU_HP_MAX);
  setScaleX(hpBossTop, bossHp / BOSS_HP_MAX);
  setScaleX(hpBossBottom, bossHp / BOSS_HP_MAX);

  setScaleX(feverBar, fever / FEVER_MAX);

  const tNow = now();
  const feverOn = tNow < feverActiveUntil;

  if(feverLabel){
    if (feverOn){
      feverLabel.textContent = `ON ${Math.max(0, ((feverActiveUntil - tNow)/1000)).toFixed(1)}s`;
      feverLabel.classList.add('on');
    } else {
      const ready = fever >= FEVER_MAX;
      feverLabel.textContent = ready ? 'READY' : `${Math.round(fever)}%`;
      feverLabel.classList.toggle('on', ready);
    }
  }

  if(btnFever){
    const canUse = running && !paused && !ended && !feverOn && fever >= FEVER_MAX;
    btnFever.disabled = !canUse;
    btnFever.classList.toggle('is-ready', canUse);
  }

  if(feverHintEl){
    if (feverOn) feverHintEl.textContent = 'Fever Active: คะแนนโบนัส + จังหวะเล่นเดือดขึ้น!';
    else if (fever >= FEVER_MAX) feverHintEl.textContent = 'READY แล้ว! กด FEVER เพื่อเปิดโหมดคูณคะแนน';
    else feverHintEl.textContent = 'ตีเป้าต่อเนื่องเพื่อสะสม FEVER';
  }
}

function say(text, cls, kind = 'system'){
  if(!msgMainEl) return;

  const t = now();
  const dt = t - (lastFeedbackAt || 0);

  // Prevent "PERFECT + MISS" visual overlap illusion
  if (kind === 'miss' && lastFeedbackKind === 'hit' && dt < 160) return;
  // hit can override miss quickly
  msgMainEl.textContent = text;
  msgMainEl.className = 'sb-msg-main' + (cls ? ' ' + cls : '');

  lastFeedbackAt = t;
  lastFeedbackKind = kind;
}

function setModeButtons(){
  const isResearch = String(MODE).toLowerCase() === 'research';
  btnPlay?.classList.toggle('is-active', !isResearch);
  btnResearch?.classList.toggle('is-active', isResearch);
  if(modeDescEl){
    modeDescEl.textContent = isResearch
      ? 'Research: ล็อกพฤติกรรมเพื่อวิจัย (AI ปิดเสมอ)'
      : 'Play: สนุก/ปรับได้ • เปิด AI ช่วยได้ด้วย ?ai=1';
  }
}

function syncMenuInputsFromState(){
  if(inputPid && !inputPid.value) inputPid.value = PID || '';
  if(inputDiff) inputDiff.value = diff;
  if(inputTime) inputTime.value = String(TIME);
}

function updateHubLink(){
  if(!linkHub) return;
  try {
    linkHub.href = HUB || './../herohealth/hub.html';
  } catch {}
}

function setMetaCollapsed(collapsed){
  if(!metaBox || !btnMeta) return;
  metaBox.classList.toggle('is-collapsed', !!collapsed);
  btnMeta.setAttribute('aria-expanded', String(!collapsed));
  btnMeta.textContent = collapsed ? '▸' : '▾';
}

function autoMetaCompact(){
  // collapse on small screens by default
  const w = window.innerWidth || 360;
  if (w <= 540) setMetaCollapsed(true);
}

// -------------------------
// Gameplay Helpers
// -------------------------
function nextBossOrPhase(){
  if(phase < currentBoss().phases){
    phase++;
    bossHp = BOSS_HP_MAX;
    say(`Phase ${phase} — เร็วขึ้น!`, 'good', 'system');
  } else {
    bossesCleared++;
    bossIndex = Math.min(BOSSES.length - 1, bossIndex + 1);
    phase = 1;
    bossHp = BOSS_HP_MAX;
    say(`Boss Clear! ไปต่อ 🎉`, 'perfect', 'system');
  }
  setBossUI();
}

function expireCountsMiss(type){
  // only these count as true miss on expire
  return (type === 'normal' || type === 'bossface');
}

function isFeverOn(){
  return now() < feverActiveUntil;
}

function spawnOne(){
  const id = Math.floor(Math.random() * 1e9);
  const roll = Math.random();

  let type = 'normal';
  if(roll < 0.08) type = 'bomb';
  else if(roll < 0.15) type = 'decoy';
  else if(roll < 0.20) type = 'heal';
  else if(roll < 0.26) type = 'shield';

  if(bossHp <= 26 && Math.random() < 0.22){
    type = 'bossface';
  }

  let sizePx = adaptiveBaseSize(CFG.baseSize);
  if(type === 'bossface') sizePx *= 1.14;
  if(type === 'bomb') sizePx *= 1.06;
  sizePx = clamp(sizePx, 78, 150);

  // Fever slightly slows expiry (feels powerful, less cramped)
  let ttlMs = CFG.targetLifetime;
  if (isFeverOn()) ttlMs = Math.round(ttlMs * 1.18);

  renderer.spawnTarget({
    id,
    type,
    sizePx,
    bossEmoji: currentBoss().emoji,
    ttlMs
  });

  const tNow = now();
  active.set(id, { type, expireAtMs: tNow + ttlMs, sizePx: Math.round(sizePx) });

  events.push({
    t: (TIME*1000 - timeLeft),
    type:'spawn',
    id,
    targetType:type,
    sizePx: Math.round(sizePx),
    ttlMs
  });
}

function onTargetHit(id, pt){
  if(!running || ended || paused) return;

  const obj = renderer.targets.get(id);
  const el = obj?.el;
  if(!el) return;

  const type = obj?.type || (el.className.match(/sb-target--(\w+)/)?.[1]) || 'normal';

  // prevent expire race
  active.delete(id);

  dl.onHit();

  let grade = 'good';
  let scoreDelta = 0;

  if(type === 'decoy'){
    grade = 'bad';
    scoreDelta = -6;
    combo = 0;
    say('หลงเป้าล่อ!', 'bad', 'hit');

  } else if(type === 'bomb'){
    grade = 'bomb';
    scoreDelta = -14;
    combo = 0;
    if(shield > 0){
      shield--;
      say('กันระเบิดด้วย Shield!', 'good', 'hit');
      scoreDelta = 0;
      grade = 'shield';
    } else {
      youHp = Math.max(0, youHp - 18);
      say('โดนระเบิด!', 'bad', 'hit');
    }

  } else if(type === 'heal'){
    grade = 'heal';
    scoreDelta = 6;
    youHp = Math.min(YOU_HP_MAX, youHp + 16);
    say('+HP!', 'good', 'hit');

  } else if(type === 'shield'){
    grade = 'shield';
    scoreDelta = 6;
    shield = Math.min(5, shield + 1);
    say('+SHIELD!', 'good', 'hit');

  } else if(type === 'bossface'){
    grade = 'perfect';
    scoreDelta = 18;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * CFG.bossDamageBossFace));
    say('CRIT! ใส่หน้า Boss!', 'perfect', 'hit');

  } else {
    const feverOn = isFeverOn();
    grade = feverOn ? 'perfect' : 'good';
    scoreDelta = (grade === 'perfect') ? 14 : 10;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * CFG.bossDamageNormal));
    say(grade === 'perfect' ? 'PERFECT!' : 'ดีมาก!', grade === 'perfect' ? 'perfect' : 'good', 'hit');
  }

  // Fever multiplier
  if (isFeverOn() && scoreDelta > 0) {
    scoreDelta = Math.round(scoreDelta * FEVER_SCORE_MULT);
  }

  score = Math.max(0, score + scoreDelta);
  maxCombo = Math.max(maxCombo, combo);

  // FEVER gain (while active, fill stays at max-ish visual)
  if (!isFeverOn()) {
    fever = clamp(fever + (grade === 'perfect' ? 10 : 6), 0, FEVER_MAX);
  } else {
    fever = FEVER_MAX;
  }

  renderer.playHitFx(id, { clientX: pt.clientX, clientY: pt.clientY, grade, scoreDelta });
  renderer.removeTarget(id, 'hit');

  events.push({
    t: (TIME*1000 - timeLeft),
    type:'hit',
    id,
    targetType:type,
    grade,
    scoreDelta
  });

  if(bossHp <= 0) nextBossOrPhase();
  if(youHp <= 0) endGame('dead');

  setHUD();
}

function activateFever(){
  if(!running || ended || paused) return;
  if(isFeverOn()) return;
  if(fever < FEVER_MAX) return;

  feverActiveUntil = now() + FEVER_ACTIVE_MS;
  fever = FEVER_MAX;
  feverUses++;
  say('⚡ FEVER ON! คะแนนคูณ x2', 'perfect', 'system');

  events.push({
    t: (TIME*1000 - timeLeft),
    type:'fever_on',
    durMs: FEVER_ACTIVE_MS
  });

  setHUD();
}

function handleExpiry(){
  const tNow = now();

  for(const [id, info] of active.entries()){
    if(tNow < info.expireAtMs) continue;

    // already removed by hit?
    const obj = renderer.targets.get(id);
    if(!obj?.el){
      active.delete(id);
      continue;
    }

    const countedMiss = expireCountsMiss(info.type);

    // Show MISS FX ONLY for counted misses
    if (countedMiss) {
      renderer.playHitFx(id, { grade:'expire' });
    }

    renderer.expireTarget(id);

    if(countedMiss){
      miss++;
      combo = 0;
      say('พลาด! (Miss)', 'miss', 'miss');
    }

    events.push({
      t: (TIME*1000 - timeLeft),
      type:'expire',
      id,
      targetType: info.type,
      missCounted: countedMiss ? 1 : 0
    });

    active.delete(id);

    // optional small penalty only for normal expire
    if(info.type === 'normal' && youHp > 0){
      youHp = Math.max(0, youHp - 2);
      if(youHp <= 0){
        endGame('dead');
        return;
      }
    }
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
  session.feverUses = feverUses|0;
  session.mode = MODE;
  session.diff = diff;
  session.timeSec = TIME;
  session.pid = PID || '';

  const totalShots = dl.getTotalShots();
  const hits = dl.getHits();
  const accPct = totalShots > 0 ? (hits / totalShots) * 100 : 0;
  session.accPct = Number(accPct.toFixed(2));

  safeText(resTime, `${(TIME - timeLeft/1000).toFixed(1)} s`);
  safeText(resScore, score|0);
  safeText(resMaxCombo, maxCombo|0);
  safeText(resMiss, miss|0);
  safeText(resPhase, phase|0);
  safeText(resBossCleared, bossesCleared|0);
  safeText(resAcc, `${accPct.toFixed(1)} %`);

  let g = 'C';
  if(accPct >= 85 && bossesCleared >= 1) g='A';
  else if(accPct >= 70) g='B';
  else if(accPct >= 55) g='C';
  else g='D';
  safeText(resGrade, g);

  events.push({
    t: (TIME*1000 - timeLeft),
    type:'end',
    reason,
    score: score|0,
    miss: miss|0,
    maxCombo: maxCombo|0,
    bossesCleared: bossesCleared|0
  });

  showView('result');
  setHUD();
}

function tick(){
  if(!running || ended) return;
  requestAnimationFrame(tick);

  if(paused) return;

  const t = now();
  const dt = t - tStart;
  timeLeft = Math.max(0, (TIME*1000) - dt);

  // Spawn cadence (slightly slower during fever to feel powerful/readable)
  const since = t - tLastSpawn;
  let targetInterval = clamp(
    CFG.spawnIntervalMin + Math.random() * (CFG.spawnIntervalMax - CFG.spawnIntervalMin),
    450, 1800
  );
  if (isFeverOn()) targetInterval *= 1.08;

  if(since >= targetInterval){
    tLastSpawn = t;
    spawnOne();
    dl.onShot();
  }

  // FEVER drain / end
  if (isFeverOn()) {
    fever = FEVER_MAX;
    if (t >= feverActiveUntil) {
      feverActiveUntil = 0;
      fever = 0;
      say('Fever จบแล้ว — ลุยต่อ!', 'good', 'system');
      events.push({ t: (TIME*1000 - timeLeft), type:'fever_off' });
    }
  }

  handleExpiry();

  if(timeLeft <= 0){
    endGame('timeup');
    return;
  }

  setHUD();
}

// -------------------------
// Start / Reset
// -------------------------
function applyMenuConfig(){
  // MODE from active button
  MODE = btnResearch?.classList.contains('is-active') ? 'research' : 'play';

  // PID
  if (inputPid) PID = (inputPid.value || '').trim();

  // DIFF
  const d = (inputDiff?.value || DIFF || 'normal').toLowerCase();
  DIFF = DIFF_CONFIG[d] ? d : 'normal';
  diff = DIFF;
  CFG = DIFF_CONFIG[diff];
  renderer.setDifficulty(diff);

  // TIME
  const t = Number(inputTime?.value ?? TIME);
  TIME = clamp(Number.isFinite(t) ? t : 70, 20, 240);

  // session baseline
  session.pid = PID || '';
  session.mode = MODE;
  session.diff = diff;
  session.timeSec = TIME;
}

function start(){
  applyMenuConfig();

  ended = false;
  running = true;
  paused = false;

  score = 0;
  combo = 0;
  maxCombo = 0;
  miss = 0;
  fever = 0;
  feverActiveUntil = 0;
  feverUses = 0;
  shield = 0;

  youHp = YOU_HP_MAX;
  bossHp = BOSS_HP_MAX;
  bossIndex = 0;
  phase = 1;
  bossesCleared = 0;

  timeLeft = TIME * 1000;
  tStart = 0;
  tLastSpawn = 0;

  lastFeedbackAt = 0;
  lastFeedbackKind = '';

  events.length = 0;
  active.clear();

  dl.reset();
  renderer.destroy();

  session.startedAt = new Date().toISOString();
  session.endedAt = '';
  session.score = 0;
  session.maxCombo = 0;
  session.miss = 0;
  session.phase = 1;
  session.bossesCleared = 0;
  session.accPct = 0;
  session.feverUses = 0;

  setBossUI();
  setHUD();
  say('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '', 'system');

  showView('play');

  tStart = now();
  tLastSpawn = tStart;

  events.push({
    t: 0,
    type: 'start',
    mode: MODE,
    pid: PID || '',
    diff,
    timeSec: TIME,
    aiAssistEnabled: !!(ai && typeof ai.isAssistEnabled === 'function' && ai.isAssistEnabled()),
    aiLocked: !!(ai && typeof ai.isLocked === 'function' && ai.isLocked())
  });

  requestAnimationFrame(tick);
}

// -------------------------
// CSV download
// -------------------------
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

// -------------------------
// Event bindings
// -------------------------
btnPlay?.addEventListener('click', ()=>{
  MODE = 'play';
  setModeButtons();
});

btnResearch?.addEventListener('click', ()=>{
  MODE = 'research';
  setModeButtons();
});

btnStart?.addEventListener('click', ()=> start());

// fallback support if old HTML has direct play/research buttons as start buttons
if (!btnStart) {
  btnPlay?.addEventListener('click', ()=> start());
  btnResearch?.addEventListener('click', ()=> {
    MODE = 'research';
    start();
  });
}

btnHowto?.addEventListener('click', ()=>{
  howtoBox?.classList.toggle('is-on');
});

btnBackMenu?.addEventListener('click', ()=>{
  running = false;
  ended = false;
  paused = false;
  active.clear();
  renderer.destroy();
  lastFeedbackAt = 0;
  lastFeedbackKind = '';
  showView('menu');
  setHUD();
});

btnPause?.addEventListener('change', ()=>{
  paused = !!btnPause.checked;
  if (paused) say('Pause', '', 'system');
});

btnFever?.addEventListener('click', ()=> activateFever());

btnRetry?.addEventListener('click', ()=> start());

btnMenu?.addEventListener('click', ()=>{
  running = false;
  ended = false;
  paused = false;
  active.clear();
  renderer.destroy();
  lastFeedbackAt = 0;
  lastFeedbackKind = '';
  showView('menu');
  setHUD();
});

btnEvtCsv?.addEventListener('click', ()=>{
  if(!events.length) return;
  downloadCSV('shadowbreaker_events.csv', events);
});

btnSesCsv?.addEventListener('click', ()=>{
  session.score = score|0;
  session.maxCombo = maxCombo|0;
  session.miss = miss|0;
  session.phase = phase|0;
  session.bossesCleared = bossesCleared|0;
  session.feverUses = feverUses|0;
  session.mode = MODE;
  session.diff = diff;
  session.timeSec = TIME;
  session.pid = PID || '';

  const totalShots = dl.getTotalShots();
  const hits = dl.getHits();
  const accPct = totalShots > 0 ? (hits/totalShots)*100 : 0;
  session.accPct = Number(accPct.toFixed(2));

  downloadCSV('shadowbreaker_session.csv', [session]);
});

btnMeta?.addEventListener('click', ()=>{
  const collapsed = metaBox?.classList.contains('is-collapsed');
  setMetaCollapsed(!collapsed);
});

window.addEventListener('resize', ()=>{
  // keep UI sane on mobile rotation
  if ((window.innerWidth || 360) <= 540) {
    // do not force reopen if user collapsed already; just keep compact by default on first load
  }
});

// -------------------------
// Init
// -------------------------
(function init(){
  // Normalize mode from URL
  if (MODE === 'normal') MODE = 'play';
  if (MODE !== 'research') MODE = 'play';

  DIFF = DIFF_CONFIG[DIFF] ? DIFF : 'normal';
  diff = DIFF;
  CFG = DIFF_CONFIG[diff];
  renderer.setDifficulty(diff);

  if (linkHub) updateHubLink();

  setModeButtons();
  syncMenuInputsFromState();
  autoMetaCompact();

  // preload state visuals
  setBossUI();
  setHUD();
  showView('menu');

  // optional: hydrate inputs from URL
  if (inputPid && PID) inputPid.value = PID;
  if (inputDiff) inputDiff.value = diff;
  if (inputTime) inputTime.value = String(TIME);

  // optional AI info banner message (non-blocking)
  if (ai && typeof ai.isAssistEnabled === 'function') {
    const assist = !!ai.isAssistEnabled();
    const locked = !!(typeof ai.isLocked === 'function' && ai.isLocked());
    if (locked) say('Research mode: AI ถูกล็อกไว้', '', 'system');
    else if (assist) say('AI Assist พร้อมใช้งาน', 'good', 'system');
  }
})();