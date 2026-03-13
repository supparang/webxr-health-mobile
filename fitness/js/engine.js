// === /fitness/js/engine.js ===
// Shadow Breaker engine — FINAL PATCH A-E
'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { DLFeatures } from './dl-features.js';

let AIPredictor = null;
try {
  const mod = await import('./ai-predictor.js');
  AIPredictor = mod?.AIPredictor || mod?.default || null;
} catch (e) {
  AIPredictor = null;
}

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

const MODE = (q('mode', q('run', 'normal')) || 'normal').toLowerCase();
const PID  = q('pid', '');
const DIFF = (q('diff', 'normal') || 'normal').toLowerCase();
const TIME = Math.max(20, Math.min(240, qNum('time', 75)));
const HUB  = q('hub', '../herohealth/hub.html');

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

const bossNameEl      = $('#sb-current-boss-name');
const metaEmoji       = $('#sb-meta-emoji');
const metaName        = $('#sb-meta-name');
const metaDesc        = $('#sb-meta-desc');
const bossPhaseLabel  = $('#sb-boss-phase-label');
const bossShieldLabel = $('#sb-boss-shield-label');

const feverBar   = $('#sb-fever-bar');
const feverLabel = $('#sb-label-fever');
const btnFever   = $('#sb-btn-fever');
const feverHint  = $('#sb-fever-hint');

const resTime        = $('#sb-res-time');
const resScore       = $('#sb-res-score');
const resMaxCombo    = $('#sb-res-max-combo');
const resMiss        = $('#sb-res-miss');
const resPhase       = $('#sb-res-phase');
const resBossCleared = $('#sb-res-boss-cleared');
const resAcc         = $('#sb-res-acc');
const resGrade       = $('#sb-res-grade');
const resMessage     = $('#sb-res-message');

const resBadge = $('#sb-res-badge');
const resBadgeIcon = $('#sb-res-badge-icon');
const resBadgeTitle = $('#sb-res-badge-title');
const resBadgeDesc = $('#sb-res-badge-desc');

const bossBanner = $('#sb-boss-banner');
const bossBannerTitle = $('#sb-boss-banner-title');
const bossBannerSub = $('#sb-boss-banner-sub');

const btnRetry  = $('#sb-btn-result-retry');
const btnMenu   = $('#sb-btn-result-menu');
const btnEvtCsv = $('#sb-btn-download-events');
const btnSesCsv = $('#sb-btn-download-session');

const inputPid   = $('#sb-input-pid');
const inputDiff  = $('#sb-input-diff');
const inputTime  = $('#sb-input-time');
const inputGroup = $('#sb-input-group');
const inputNote  = $('#sb-input-note');

const btnMeta  = $('#sb-btn-meta');
const metaEl   = $('#sb-meta');
const metaBody = $('#sb-meta-body');

const BOSSES = [
  {
    id:'bubble',
    name:'Bubble Glove',
    emoji:'🐣',
    desc:'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน',
    hp: { easy:60, normal:70, hard:85 },
    spawnWeights: { bossface:55, normal:20, heal:10, shield:10, decoy:3, bomb:2 },
    targetLifetimeMul: 1.08,
    baseSizeMul: 1.08
  },
  {
    id:'meteor',
    name:'Meteor Punch',
    emoji:'☄️',
    desc:'เร็วขึ้นแล้วนะ อย่าหลงเป้าล่อ',
    hp: { easy:70, normal:85, hard:100 },
    spawnWeights: { bossface:45, normal:18, heal:8, shield:8, decoy:12, bomb:9 },
    targetLifetimeMul: 1.00,
    baseSizeMul: 1.00
  },
  {
    id:'hydra',
    name:'Neon Hydra',
    emoji:'🐉',
    desc:'หลายจังหวะ ต้องเลือกเป้าให้ดี',
    hp: { easy:85, normal:100, hard:120 },
    spawnWeights: { bossface:40, normal:15, heal:8, shield:8, decoy:15, bomb:14 },
    targetLifetimeMul: 0.93,
    baseSizeMul: 0.96
  },
  {
    id:'final',
    name:'Shadow King',
    emoji:'👑',
    desc:'บอสสุดท้าย! เปิด FEVER ให้ถูกจังหวะ',
    hp: { easy:110, normal:130, hard:150 },
    spawnWeights: { bossface:52, normal:8, heal:5, shield:5, decoy:15, bomb:15 },
    targetLifetimeMul: 0.88,
    baseSizeMul: 1.04
  }
];

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const now = ()=>performance.now();

const FEVER_MAX   = 100;
const YOU_HP_MAX  = 100;

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

function boss(){
  const i = clamp(bossIndex, 0, BOSSES.length - 1);
  return BOSSES[i];
}

function adaptiveBaseSize(raw){
  const r = layerEl?.getBoundingClientRect?.();
  const w = r?.width || window.innerWidth || 360;
  const h = r?.height || window.innerHeight || 640;
  const m = Math.max(280, Math.min(860, Math.min(w, h)));
  const scale = m / 520;
  const s = raw * scale;
  return clamp(s, 86, 132);
}

const DIFF_CONFIG = {
  easy: {
    label:'Easy',
    spawnIntervalMin:980,
    spawnIntervalMax:1380,
    targetLifetime:1500,
    baseSize:114,
    bossDamageNormal:0.045,
    bossDamageBossFace:0.17,
    feverDurMs:6500
  },
  normal: {
    label:'Normal',
    spawnIntervalMin:820,
    spawnIntervalMax:1220,
    targetLifetime:1320,
    baseSize:108,
    bossDamageNormal:0.038,
    bossDamageBossFace:0.14,
    feverDurMs:6000
  },
  hard: {
    label:'Hard',
    spawnIntervalMin:680,
    spawnIntervalMax:1020,
    targetLifetime:1160,
    baseSize:102,
    bossDamageNormal:0.032,
    bossDamageBossFace:0.115,
    feverDurMs:5600
  }
};

let running = false;
let ended   = false;
let paused  = false;

let tStart = 0;
let tLastSpawn = 0;
let timeLeft = TIME * 1000;

let score = 0;
let combo = 0;
let maxCombo = 0;
let miss = 0;
let feverUsed = 0;

let fever = 0;
let shield = 0;
let feverActiveUntil = 0;

let youHp  = YOU_HP_MAX;
let bossHp = 100;
let bossHpMax = 100;

let bossIndex = 0;
let phase = 1;
let bossesCleared = 0;
let reachedBossIndex = 0;

let bossPatternState = {
  lastLane: 0,
  burstLeft: 0,
  finalWindowUntil: 0,
  finalCooldownUntil: 0
};

let currentMode = (MODE === 'research') ? 'research' : 'normal';
let currentDiff = DIFF_CONFIG[DIFF] ? DIFF : 'normal';
let currentTimeSec = TIME;

let CFG = DIFF_CONFIG[currentDiff];

const events = [];
const session = {
  pid: PID || '',
  group: '',
  note: '',
  mode: currentMode,
  diff: currentDiff,
  timeSec: currentTimeSec,
  startedAt: new Date().toISOString(),
  endedAt: '',
  score: 0,
  maxCombo: 0,
  miss: 0,
  bossesCleared: 0,
  reachedBoss: '',
  feverUsed: 0,
  accPct: 0
};

const dl = new DLFeatures();

const ai = (AIPredictor && typeof AIPredictor === 'function')
  ? new AIPredictor()
  : (window.RB_AI || null);

function aiPredictSafe(snapshot){
  try {
    if (!ai) return null;
    if (typeof ai.predict === 'function') return ai.predict(snapshot || {});
    return null;
  } catch (e) {
    console.warn('[ShadowBreaker] ai.predict failed:', e);
    return null;
  }
}

function aiAssistEnabledSafe(){
  try {
    if (!ai) return false;
    if (typeof ai.isAssistEnabled === 'function') return !!ai.isAssistEnabled();
    return false;
  } catch {
    return false;
  }
}

const active = new Map();

const renderer = new DomRendererShadow(layerEl, {
  wrapEl,
  feedbackEl: msgMainEl,
  onTargetHit
});
renderer.setDifficulty(currentDiff);

function bossHpForCurrent(){
  const b = boss();
  return Number(b.hp?.[currentDiff]) || 100;
}

function reachedBossLabel(){
  return BOSSES[clamp(reachedBossIndex, 0, BOSSES.length - 1)]?.name || 'Boss';
}

function weightedPick(weights){
  const entries = Object.entries(weights || {});
  let total = 0;
  for(const [, v] of entries) total += Math.max(0, Number(v) || 0);
  if(total <= 0) return 'bossface';

  let r = Math.random() * total;
  for(const [k, v] of entries){
    r -= Math.max(0, Number(v) || 0);
    if(r <= 0) return k;
  }
  return entries[0]?.[0] || 'bossface';
}

function resetBossPatternState(){
  bossPatternState = {
    lastLane: Math.random() < 0.5 ? 0 : 1,
    burstLeft: 0,
    finalWindowUntil: 0,
    finalCooldownUntil: 0
  };
}

function currentLaneFlip(){
  bossPatternState.lastLane = bossPatternState.lastLane === 0 ? 1 : 0;
  return bossPatternState.lastLane;
}

function pickTypeForBossPattern(b){
  const tNow = now();

  if (b.id === 'bubble') {
    return weightedPick(b.spawnWeights);
  }

  if (b.id === 'meteor') {
    if (bossPatternState.burstLeft > 0) {
      bossPatternState.burstLeft--;
      return Math.random() < 0.72 ? 'bossface' : weightedPick(b.spawnWeights);
    }
    if (Math.random() < 0.24) {
      bossPatternState.burstLeft = 1;
      return 'bossface';
    }
    return weightedPick(b.spawnWeights);
  }

  if (b.id === 'hydra') {
    if (Math.random() < 0.18) return 'decoy';
    if (Math.random() < 0.14) return 'bomb';
    return weightedPick(b.spawnWeights);
  }

  if (b.id === 'final') {
    if (tNow < bossPatternState.finalWindowUntil) {
      return Math.random() < 0.78 ? 'bossface' : weightedPick(b.spawnWeights);
    }

    if (tNow >= bossPatternState.finalCooldownUntil && Math.random() < 0.18) {
      bossPatternState.finalWindowUntil = tNow + 1500;
      bossPatternState.finalCooldownUntil = tNow + 3800;
      return 'bossface';
    }

    if (Math.random() < 0.22) return 'decoy';
    if (Math.random() < 0.18) return 'bomb';
    return weightedPick(b.spawnWeights);
  }

  return weightedPick(b.spawnWeights);
}

function bossSpawnCount(b){
  if (b.id === 'bubble') return 1;
  if (b.id === 'meteor') return (Math.random() < 0.36 ? 2 : 1);
  if (b.id === 'hydra') return (Math.random() < 0.42 ? 2 : 1);
  if (b.id === 'final') return (Math.random() < 0.48 ? 2 : 1);
  return 1;
}

function pickLaneHint(b, type, indexInWave, totalInWave){
  if (b.id === 'bubble') {
    return null;
  }

  if (b.id === 'meteor') {
    if (totalInWave >= 2) return indexInWave % 2;
    return Math.random() < 0.5 ? 0 : 1;
  }

  if (b.id === 'hydra') {
    return currentLaneFlip();
  }

  if (b.id === 'final') {
    if (type === 'bossface') return Math.random() < 0.5 ? 0 : 1;
    return indexInWave % 2;
  }

  return null;
}

function bossIntroText(b){
  if (!b) return 'เริ่มเกม!';
  if (b.id === 'bubble') return 'Bubble Glove มาแล้ว! ตีฟองใหญ่ให้ทัน';
  if (b.id === 'meteor') return 'Meteor Punch เร็วขึ้นแล้ว ระวังเป้าหลอก';
  if (b.id === 'hydra') return 'Neon Hydra มาแล้ว เลือกเป้าให้ดี';
  if (b.id === 'final') return 'FINAL BOSS! Shadow King ปรากฏตัวแล้ว';
  return `เริ่มสู้ ${b.name}!`;
}

function bossClearText(b){
  if (!b) return 'ผ่านบอสแล้ว!';
  if (b.id === 'bubble') return 'ชนะ Bubble Glove แล้ว!';
  if (b.id === 'meteor') return 'ชนะ Meteor Punch แล้ว!';
  if (b.id === 'hydra') return 'ชนะ Neon Hydra แล้ว!';
  if (b.id === 'final') return 'ชนะ Shadow King แล้ว!';
  return `ชนะ ${b.name} แล้ว!`;
}

function resultPraise(reason, bossesCleared, reachedBossName){
  if (reason === 'all_bosses_cleared') {
    return 'สุดยอดมาก! ชนะครบทุกบอสแล้ว คุณคือ Shadow Breaker Hero!';
  }
  if (bossesCleared >= 3) {
    return `ยอดเยี่ยม! คุณไปถึง ${reachedBossName} แล้ว`;
  }
  if (bossesCleared >= 2) {
    return 'เก่งมาก! ผ่านได้หลายบอสแล้ว';
  }
  if (bossesCleared >= 1) {
    return 'เยี่ยมเลย! ชนะบอสแรกได้แล้ว';
  }
  return `ดีมาก! คุณไปถึง ${reachedBossName} แล้ว ลองอีกครั้งเพื่อไปต่อให้ลึกกว่าเดิม`;
}

function bestBossStorageKey(){
  return `SB_BEST_REACHED_BOSS:${session.pid || PID || 'anon'}`;
}

function bestBadgeStorageKey(){
  return `SB_BEST_BADGE:${session.pid || PID || 'anon'}`;
}

function getResultBadge(reason, bossesCleared, reachedBossName){
  if (reason === 'all_bosses_cleared') {
    return {
      icon:'👑',
      title:'Shadow King Champion',
      desc:'ชนะครบทุกบอสแล้ว สุดยอดมาก!'
    };
  }
  if (bossesCleared >= 3) {
    return {
      icon:'🔥',
      title:'Final Challenger',
      desc:`ไปถึง ${reachedBossName} แล้ว เก่งมาก!`
    };
  }
  if (bossesCleared >= 2) {
    return {
      icon:'🐉',
      title:'Hydra Hunter',
      desc:'ผ่านได้หลายบอสแล้ว ฟอร์มดีมาก'
    };
  }
  if (bossesCleared >= 1) {
    return {
      icon:'☄️',
      title:'Meteor Dodger',
      desc:'ชนะบอสแรกได้แล้ว เยี่ยมเลย!'
    };
  }
  return {
    icon:'🫧',
    title:'Bubble Starter',
    desc:`เริ่มต้นได้ดีแล้ว ไปถึง ${reachedBossName} แล้ว`
  };
}

function saveBestProgress(reachedBossName, badge){
  try{
    const prevBoss = localStorage.getItem(bestBossStorageKey()) || '';
    const order = BOSSES.map(b=>b.name);
    const prevIdx = Math.max(0, order.indexOf(prevBoss));
    const nowIdx = Math.max(0, order.indexOf(reachedBossName));
    if (!prevBoss || nowIdx >= prevIdx) {
      localStorage.setItem(bestBossStorageKey(), reachedBossName);
    }
    if (badge) {
      localStorage.setItem(bestBadgeStorageKey(), JSON.stringify(badge));
    }
  }catch(_){}
}

function showBossBanner(title, sub=''){
  if (!bossBanner || !bossBannerTitle || !bossBannerSub) return;
  bossBannerTitle.textContent = title;
  bossBannerSub.textContent = sub || '';
  bossBanner.classList.add('is-on');
  clearTimeout(showBossBanner._t);
  showBossBanner._t = setTimeout(()=>{
    bossBanner.classList.remove('is-on');
  }, 1400);
}

function applyParamsToHeaderLink(){
  const a = $('#sb-link-hub');
  if (!a) return;
  a.href = HUB || '../herohealth/hub.html';
}

function syncMenuInputsFromQuery(){
  if (inputPid && PID) inputPid.value = PID;
  if (inputDiff && DIFF_CONFIG[DIFF]) inputDiff.value = DIFF;
  if (inputTime && Number.isFinite(TIME)) inputTime.value = String(TIME);
}

function readMenuConfig(){
  const pid = (inputPid?.value || PID || '').trim();
  const group = (inputGroup?.value || '').trim();
  const note = (inputNote?.value || '').trim();
  const diff = (inputDiff?.value || currentDiff || 'normal').toLowerCase();
  const timeSec = clamp(Number(inputTime?.value || currentTimeSec || 75) || 75, 20, 240);

  return {
    pid,
    group,
    note,
    diff: DIFF_CONFIG[diff] ? diff : 'normal',
    timeSec
  };
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
  setScaleX(hpBossTop, bossHp / bossHpMax);
  setScaleX(hpBossBottom, bossHp / bossHpMax);

  setScaleX(feverBar, fever / FEVER_MAX);

  const feverReady = fever >= FEVER_MAX;
  const feverOn = now() < feverActiveUntil;

  if(feverLabel){
    feverLabel.textContent = feverOn ? 'ON' : (feverReady ? 'READY' : `${Math.round(fever)}%`);
    feverLabel.classList.toggle('on', feverReady || feverOn);
  }
  if(btnFever){
    btnFever.disabled = !feverReady && !feverOn;
    btnFever.classList.toggle('is-ready', feverReady);
    btnFever.classList.toggle('is-on', feverOn);
  }
  if(feverHint){
    if (feverOn) feverHint.textContent = 'FEVER ACTIVE! ตีแรงขึ้น';
    else if (feverReady) feverHint.textContent = 'READY! กด FEVER ได้เลย ⚡';
    else feverHint.textContent = 'ตีแม่น ๆ เพื่อเปิด FEVER';
  }
}

function say(text, cls){
  if(!msgMainEl) return;
  msgMainEl.textContent = text;
  msgMainEl.className = 'sb-msg-main' + (cls ? ' ' + cls : '');
}

function expireCountsMiss(type){
  return (type === 'normal' || type === 'bossface');
}

function spawnOne(){
  const b = boss();
  const total = bossSpawnCount(b);

  for(let i = 0; i < total; i++){
    const id = Math.floor(Math.random() * 1e9);
    let type = pickTypeForBossPattern(b);

    let sizePx = adaptiveBaseSize(CFG.baseSize * (b.baseSizeMul || 1));

    if(type === 'bossface') sizePx *= 1.16;
    if(type === 'bomb') sizePx *= 1.02;
    if(type === 'heal' || type === 'shield') sizePx *= 0.96;

    if (b.id === 'bubble' && type === 'bossface') sizePx *= 1.08;
    if (b.id === 'meteor' && type === 'bossface') sizePx *= 0.98;
    if (b.id === 'hydra' && type === 'bossface') sizePx *= 1.04;
    if (b.id === 'final' && type === 'bossface') sizePx *= 1.10;

    sizePx = clamp(sizePx, 78, 168);

    let ttlMs = Math.round(CFG.targetLifetime * (b.targetLifetimeMul || 1));

    if (b.id === 'bubble') ttlMs = Math.round(ttlMs * 1.10);
    if (b.id === 'meteor') ttlMs = Math.round(ttlMs * 0.95);
    if (b.id === 'hydra') ttlMs = Math.round(ttlMs * 0.92);
    if (b.id === 'final') ttlMs = Math.round(ttlMs * 0.88);

    if (now() < feverActiveUntil) ttlMs = Math.round(ttlMs * 1.08);

    const laneHint = pickLaneHint(b, type, i, total);

    renderer.spawnTarget({
      id,
      type,
      sizePx,
      bossEmoji: b.emoji,
      bossId: b.id,
      laneHint,
      ttlMs
    });

    const tNow = now();
    active.set(id, {
      type,
      expireAtMs: tNow + ttlMs,
      sizePx: Math.round(sizePx)
    });

    events.push({
      t: (currentTimeSec * 1000 - timeLeft),
      type:'spawn',
      bossId:b.id,
      id,
      targetType:type,
      laneHint,
      sizePx: Math.round(sizePx),
      ttlMs
    });
  }
}

function onTargetHit(id, pt){
  if(!running || ended || paused) return;

  const obj = renderer.targets.get(id);
  const el = obj?.el;
  if(!el) return;

  const type = obj?.type || (el.className.match(/sb-target--(\w+)/)?.[1]) || 'normal';

  active.delete(id);
  dl.onHit();

  let grade = 'good';
  let scoreDelta = 0;
  const feverOn = now() < feverActiveUntil;
  const b = boss();

  if(type === 'decoy'){
    grade = 'bad';
    scoreDelta = -6;
    combo = 0;
    say('หลงเป้าล่อ!', 'bad');

  }else if(type === 'bomb'){
    grade = 'bomb';
    scoreDelta = -14;
    combo = 0;
    if(shield > 0){
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
    scoreDelta = feverOn ? 28 : 20;
    combo++;

    const dmg = bossHpMax * (feverOn ? (CFG.bossDamageBossFace * 1.20) : CFG.bossDamageBossFace);
    bossHp = Math.max(0, bossHp - dmg);

    if (b.id === 'bubble') {
      say(feverOn ? 'FEVER HIT! ฟองแตกกระจาย!' : 'โดน Bubble Glove!', 'perfect');
    } else if (b.id === 'meteor') {
      say(feverOn ? 'FEVER CRASH! ดาวตกแตก!' : 'โดน Meteor Punch!', 'perfect');
    } else if (b.id === 'hydra') {
      say(feverOn ? 'FEVER SLASH! มังกรสะเทือน!' : 'โดน Neon Hydra!', 'perfect');
    } else if (b.id === 'final') {
      say(feverOn ? 'FEVER CRIT!! ใส่ Shadow King!' : 'CRIT! ใส่ Shadow King!', 'perfect');
    } else {
      say('CRIT!', 'perfect');
    }

  }else{
    grade = (fever >= FEVER_MAX || feverOn) ? 'perfect' : 'good';
    scoreDelta = (grade === 'perfect') ? (feverOn ? 16 : 12) : 9;
    combo++;
    const dmg = bossHpMax * (feverOn ? (CFG.bossDamageNormal * 1.12) : CFG.bossDamageNormal);
    bossHp = Math.max(0, bossHp - dmg);
    say(grade === 'perfect' ? 'PERFECT!' : 'ดีมาก!', grade === 'perfect' ? 'perfect' : 'good');
  }

  score = Math.max(0, score + scoreDelta);
  maxCombo = Math.max(maxCombo, combo);

  if (!feverOn) {
    fever = clamp(fever + (grade === 'perfect' ? 10 : 6), 0, FEVER_MAX);
  }

  renderer.playHitFx(id, { clientX: pt.clientX, clientY: pt.clientY, grade, scoreDelta });
  renderer.removeTarget(id);

  events.push({
    t: (currentTimeSec * 1000 - timeLeft),
    type:'hit',
    bossId:b.id,
    id,
    targetType:type,
    grade,
    scoreDelta,
    bossHp: Math.round(bossHp)
  });

  if(bossHp <= 0){
    advanceBoss();
  }

  if(youHp <= 0){
    endGame('dead');
  }

  setHUD();
}

function advanceBoss(){
  const clearedBoss = boss();
  bossesCleared++;

  if(bossIndex < BOSSES.length - 1){
    showBossBanner(
      `${bossClearText(clearedBoss)}`,
      `เตรียมเจอ ${BOSSES[bossIndex + 1].name}`
    );

    say(bossClearText(clearedBoss), 'perfect');

    bossIndex++;
    reachedBossIndex = Math.max(reachedBossIndex, bossIndex);
    phase = bossIndex + 1;
    bossHpMax = bossHpForCurrent();
    bossHp = bossHpMax;
    shield = Math.max(0, shield - 1);
    resetBossPatternState();

    setBossUI();
    setHUD();

    setTimeout(()=>{
      if(!ended){
        say(bossIntroText(boss()), boss().id === 'final' ? 'perfect' : 'good');
      }
    }, 700);
  }else{
    showBossBanner('ชนะครบทุกบอส!', 'คุณคือ Shadow Breaker Hero!');
    endGame('all_bosses_cleared');
  }
}

function endGame(reason = 'timeup'){
  if(ended) return;
  ended = true;
  running = false;

  active.clear();
  renderer.destroy();

  session.endedAt = new Date().toISOString();
  session.score = score|0;
  session.maxCombo = maxCombo|0;
  session.miss = miss|0;
  session.bossesCleared = bossesCleared|0;
  session.reachedBoss = reachedBossLabel();
  session.feverUsed = feverUsed|0;

  const totalShots = dl.getTotalShots?.() || 0;
  const hits = dl.getHits?.() || 0;
  const accPct = totalShots > 0 ? (hits / totalShots) * 100 : 0;
  session.accPct = Number(accPct.toFixed(2));

  if(resTime) resTime.textContent = `${(currentTimeSec - timeLeft/1000).toFixed(1)} s`;
  if(resScore) resScore.textContent = String(score|0);
  if(resMaxCombo) resMaxCombo.textContent = String(maxCombo|0);
  if(resMiss) resMiss.textContent = String(miss|0);
  if(resPhase) resPhase.textContent = reachedBossLabel();
  if(resBossCleared) resBossCleared.textContent = String(bossesCleared|0);
  if(resAcc) resAcc.textContent = `${accPct.toFixed(1)} %`;

  let g = 'C';
  if(reason === 'all_bosses_cleared') g = 'S';
  else if(accPct >= 85 && bossesCleared >= 2) g = 'A';
  else if(accPct >= 70 && bossesCleared >= 1) g = 'B';
  else if(accPct >= 55) g = 'C';
  else g = 'D';
  if(resGrade) resGrade.textContent = g;

  const praise = resultPraise(reason, bossesCleared, reachedBossLabel());
  const badge = getResultBadge(reason, bossesCleared, reachedBossLabel());

  if (resMessage) resMessage.textContent = praise;
  if (resBadge) resBadge.style.display = '';
  if (resBadgeIcon) resBadgeIcon.textContent = badge.icon;
  if (resBadgeTitle) resBadgeTitle.textContent = badge.title;
  if (resBadgeDesc) resBadgeDesc.textContent = badge.desc;

  saveBestProgress(reachedBossLabel(), badge);
  say(praise, 'good');

  events.push({
    t:(currentTimeSec * 1000 - timeLeft),
    type:'end',
    reason,
    score,
    miss,
    maxCombo,
    bossesCleared,
    reachedBoss: reachedBossLabel(),
    feverUsed,
    accPct:Number(accPct.toFixed(2))
  });

  showView('result');
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

    const counted = expireCountsMiss(info.type);

    if (counted) {
      renderer.playHitFx(id, { grade:'expire' });
      miss++;
      combo = 0;
      say('พลาด! (Miss)', 'miss');
    }

    renderer.expireTarget(id);

    events.push({
      t: (currentTimeSec * 1000 - timeLeft),
      type:'expire',
      bossId: boss().id,
      id,
      targetType: info.type,
      missCounted: counted ? 1 : 0
    });

    active.delete(id);

    if(info.type === 'normal' && youHp > 0){
      youHp = Math.max(0, youHp - 2);
      if(youHp <= 0){
        endGame('dead');
        return;
      }
    }
  }
}

function maybeUseAIHint(){
  const totalShots = dl.getTotalShots?.() || 0;
  const hits = dl.getHits?.() || 0;
  const accPct = totalShots > 0 ? (hits / totalShots) * 100 : 0;

  const pred = aiPredictSafe({
    accPct,
    hp: youHp,
    combo,
    boss: boss().id,
    bossesCleared
  });

  if (pred && currentMode !== 'research' && aiAssistEnabledSafe() && pred.tip && Math.random() < 0.08) {
    say(pred.tip, 'good');
  }
}

function tick(){
  if(!running || ended) return;
  requestAnimationFrame(tick);
  if(paused) return;

  const t = now();
  const dt = t - tStart;
  timeLeft = Math.max(0, (currentTimeSec * 1000) - dt);

  let spawnMin = CFG.spawnIntervalMin;
  let spawnMax = CFG.spawnIntervalMax;

  if (boss().id === 'bubble') {
    spawnMin *= 1.04;
    spawnMax *= 1.04;
  } else if (boss().id === 'meteor') {
    spawnMin *= 0.98;
    spawnMax *= 0.98;
  } else if (boss().id === 'hydra') {
    spawnMin *= 0.94;
    spawnMax *= 0.94;
  } else if (boss().id === 'final') {
    spawnMin *= 0.88;
    spawnMax *= 0.90;
  }

  if (t < feverActiveUntil) {
    spawnMin = Math.max(420, Math.round(spawnMin * 0.92));
    spawnMax = Math.max(700, Math.round(spawnMax * 0.94));
  }

  const since = t - tLastSpawn;
  const targetInterval = clamp(
    spawnMin + Math.random() * (spawnMax - spawnMin),
    420, 1800
  );

  if(since >= targetInterval){
    tLastSpawn = t;
    spawnOne();
    dl.onShot();
  }

  if(fever >= FEVER_MAX && t >= feverActiveUntil){
    fever = clamp(fever - 0.20, 0, FEVER_MAX);
  }

  handleExpiry();

  if ((Math.floor(timeLeft / 1000) % 3) === 0) {
    maybeUseAIHint();
  }

  if(timeLeft <= 0){
    endGame('timeup');
    return;
  }

  setHUD();
}

function useFever(){
  if (!running || ended || paused) return;
  if (fever < FEVER_MAX) return;

  fever = 0;
  feverActiveUntil = now() + CFG.feverDurMs;
  feverUsed++;
  say(boss().id === 'final' ? '⚡ FEVER MODE! ลุย Final Boss!' : '⚡ FEVER MODE!', 'perfect');

  events.push({
    t:(currentTimeSec * 1000 - timeLeft),
    type:'fever_on',
    bossId: boss().id,
    durMs:CFG.feverDurMs
  });

  setHUD();
}

function start(mode = 'normal'){
  const cfg = readMenuConfig();

  currentMode = (mode === 'research') ? 'research' : 'normal';
  currentDiff = cfg.diff;
  currentTimeSec = cfg.timeSec;
  CFG = DIFF_CONFIG[currentDiff];

  renderer.setDifficulty(currentDiff);

  ended = false;
  running = true;
  paused = false;
  if(btnPause) btnPause.checked = false;

  score = 0;
  combo = 0;
  maxCombo = 0;
  miss = 0;
  feverUsed = 0;

  fever = 0;
  shield = 0;
  feverActiveUntil = 0;

  youHp = YOU_HP_MAX;

  bossIndex = 0;
  reachedBossIndex = 0;
  bossesCleared = 0;
  phase = 1;

  bossHpMax = bossHpForCurrent();
  bossHp = bossHpMax;

  timeLeft = currentTimeSec * 1000;

  events.length = 0;
  active.clear();
  resetBossPatternState();

  dl.reset?.();
  renderer.destroy();

  session.pid = cfg.pid || PID || '';
  session.group = cfg.group || '';
  session.note = cfg.note || '';
  session.mode = currentMode;
  session.diff = currentDiff;
  session.timeSec = currentTimeSec;
  session.startedAt = new Date().toISOString();
  session.endedAt = '';
  session.score = 0;
  session.maxCombo = 0;
  session.miss = 0;
  session.bossesCleared = 0;
  session.reachedBoss = boss().name;
  session.feverUsed = 0;
  session.accPct = 0;

  setBossUI();
  setHUD();

  if (resMessage) resMessage.textContent = 'เก่งมาก! ลองอีกครั้งเพื่อไปให้ไกลกว่าเดิม';
  if (resBadgeIcon) resBadgeIcon.textContent = '🏅';
  if (resBadgeTitle) resBadgeTitle.textContent = 'Shadow Starter';
  if (resBadgeDesc) resBadgeDesc.textContent = 'เริ่มต้นได้ดีแล้ว ลองอีกครั้งเพื่อไปให้ไกลกว่าเดิม';

  say(bossIntroText(boss()), 'good');
  showView('play');

  tStart = now();
  tLastSpawn = tStart;
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
  active.clear();
  renderer.destroy();
  showView('menu');
});

btnPause?.addEventListener('change', ()=>{
  paused = !!btnPause.checked;
});

btnRetry?.addEventListener('click', ()=> start(currentMode));
btnMenu?.addEventListener('click', ()=>{
  active.clear();
  renderer.destroy();
  showView('menu');
});

btnFever?.addEventListener('click', useFever);

btnMeta?.addEventListener('click', ()=>{
  if (!metaBody || !btnMeta || !metaEl) return;
  const collapsed = metaEl.classList.toggle('is-collapsed');
  btnMeta.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  btnMeta.textContent = collapsed ? '▸' : '▾';
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

btnEvtCsv?.addEventListener('click', ()=>{
  if(!events.length) return;
  downloadCSV('shadowbreaker_events.csv', events);
});

btnSesCsv?.addEventListener('click', ()=>{
  session.score = score|0;
  session.maxCombo = maxCombo|0;
  session.miss = miss|0;
  session.bossesCleared = bossesCleared|0;
  session.reachedBoss = reachedBossLabel();
  session.feverUsed = feverUsed|0;

  const totalShots = dl.getTotalShots?.() || 0;
  const hits = dl.getHits?.() || 0;
  const accPct = totalShots > 0 ? (hits / totalShots) * 100 : 0;
  session.accPct = Number(accPct.toFixed(2));

  downloadCSV('shadowbreaker_session.csv', [session]);
});

applyParamsToHeaderLink();
syncMenuInputsFromQuery();
showView('menu');
setBossUI();
setHUD();