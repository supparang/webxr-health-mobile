// === /fitness/js/engine.js ===
// Shadow Breaker engine
// PATCH v20260313-SB-FLOW-WARMUP-GAME-COOLDOWN-SUMMARY-HUB
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

const MODE = (q('mode', q('run','normal')) || 'normal').toLowerCase();
const PID  = q('pid','');
const DIFF = (q('diff','normal') || 'normal').toLowerCase();
const TIME = Math.max(20, Math.min(240, qNum('time', 70)));
const HUB  = q('hub','./../herohealth/hub.html');
const GAME = (q('game','shadowbreaker') || 'shadowbreaker').toLowerCase();
const ZONE = (q('zone','fitness') || 'fitness').toLowerCase();
const CAT  = (q('cat', ZONE) || ZONE).toLowerCase();

const COOLDOWN_GATE_PATH = '/webxr-health-mobile/herohealth/warmup-gate.html';
const SUMMARY_PATH       = q('cdnext','/webxr-health-mobile/herohealth/shadow-breaker-summary.html');

const $ = (s)=>document.querySelector(s);
const wrapEl = $('#sb-wrap');

const viewMenu   = $('#sb-view-menu');
const viewPlay   = $('#sb-view-play');
const viewResult = $('#sb-view-result');

const btnPlay     = $('#sb-btn-play');
const btnResearch = $('#sb-btn-research');
const btnHowto    = $('#sb-btn-howto');
const howtoBox    = $('#sb-howto');

const btnStartNormal = $('#sb-btn-play');
const btnStartResearch = $('#sb-btn-research');
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

const inputPid  = $('#sb-inp-pid');
const inputDiff = $('#sb-sel-diff');
const inputTime = $('#sb-sel-time');

// -------------------------
// Data (bosses)
// -------------------------
const BOSSES = [
  { id:'bubble-glove',  name:'Bubble Glove',  emoji:'🐣', desc:'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน', phases: 3 },
  { id:'meteor-punch',  name:'Meteor Punch',  emoji:'☄️', desc:'เร็วขึ้น — อย่าหลงเป้าล่อ', phases: 3 },
  { id:'neon-hydra',    name:'Neon Hydra',    emoji:'🐉', desc:'คอมโบสำคัญมาก — รักษาจังหวะ', phases: 3 },
  { id:'final-boss',    name:'Final Boss',    emoji:'👑', desc:'ด่านสุดท้าย! เก็บจังหวะและอย่าพลาด', phases: 4 }
];

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const now = ()=>performance.now();

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

function boss(){
  const i = clamp(bossIndex,0,BOSSES.length-1);
  return BOSSES[i];
}

function adaptiveBaseSize(raw){
  const r = layerEl?.getBoundingClientRect?.();
  const w = r?.width || window.innerWidth || 360;
  const h = r?.height || window.innerHeight || 640;
  const m = Math.max(280, Math.min(860, Math.min(w,h)));
  const scale = m / 520;
  const s = raw * scale;
  return clamp(s, 84, 130);
}

const DIFF_CONFIG = {
  easy:   { label:'Easy — ผ่อนคลาย',  spawnIntervalMin:960, spawnIntervalMax:1360, targetLifetime:1580, baseSize:116, bossDamageNormal:0.040, bossDamageBossFace:0.48 },
  normal: { label:'Normal — สมดุล',   spawnIntervalMin:820, spawnIntervalMax:1220, targetLifetime:1360, baseSize:110, bossDamageNormal:0.036, bossDamageBossFace:0.42 },
  hard:   { label:'Hard — ท้าทาย',    spawnIntervalMin:700, spawnIntervalMax:1020, targetLifetime:1180, baseSize:102, bossDamageNormal:0.031, bossDamageBossFace:0.36 }
};

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
let feverActiveUntil = 0;

let youHp = YOU_HP_MAX;
let bossHp = BOSS_HP_MAX;

let bossIndex = 0;
let phase = 1;
let bossesCleared = 0;
let bestReachedBossIndexInRun = 0;

let currentMode = (MODE === 'research') ? 'research' : 'normal';
let currentDiff = DIFF_CONFIG[DIFF] ? DIFF : 'normal';
let currentTimeSec = TIME;

let CFG = DIFF_CONFIG[currentDiff];

const events = [];
const session = {
  pid: PID || '',
  mode: currentMode,
  diff: currentDiff,
  timeSec: currentTimeSec,
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

const ai = (AIPredictor && typeof AIPredictor === 'function')
  ? new AIPredictor()
  : (window.RB_AI || null);

function aiPredictSafe(snapshot){
  try {
    if (!ai) return null;
    if (typeof ai.predict === 'function') return ai.predict(snapshot || {});
    return null;
  } catch {
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

// -------------------------
// helpers
// -------------------------
function safeJsonParse(v, fb=null){
  try { return JSON.parse(v); } catch { return fb; }
}
function setJson(k, v){
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}
function setText(k, v){
  try { localStorage.setItem(k, String(v)); } catch {}
}
function getBestBossTextByIndex(idx){
  const b = BOSSES[clamp(idx,0,BOSSES.length-1)];
  return b?.name || 'Bubble Glove';
}
function badgeFromSummary(s){
  const acc = Number(s.accPct || 0);
  const cleared = Number(s.bossesCleared || 0);
  const ms = Number(s.miss || 0);

  if (cleared >= 4 && acc >= 88 && ms <= 8) {
    return { key:'legend', icon:'👑', title:'Legend Boss Breaker' };
  }
  if (cleared >= 3 && acc >= 78) {
    return { key:'elite', icon:'⚡', title:'Elite Boss Breaker' };
  }
  if (cleared >= 2 && acc >= 65) {
    return { key:'hero', icon:'🛡️', title:'Hero Boss Breaker' };
  }
  return { key:'rookie', icon:'🥊', title:'Rookie Boss Breaker' };
}
function bossRuleText(){
  if (bossIndex >= 3) return 'Final Boss active';
  return `Boss ladder ${bossIndex + 1}/${BOSSES.length}`;
}
function buildCooldownUrl(summaryObj){
  const u = new URL(COOLDOWN_GATE_PATH, location.origin);
  u.searchParams.set('Phase', 'cooldown');
  u.searchParams.set('pid', summaryObj.pid || PID || 'anon');
  u.searchParams.set('diff', summaryObj.diff || currentDiff);
  u.searchParams.set('time', String(summaryObj.timeSec || currentTimeSec));
  u.searchParams.set('mode', summaryObj.mode || currentMode);
  u.searchParams.set('run', summaryObj.mode || currentMode);
  u.searchParams.set('zone', ZONE);
  u.searchParams.set('cat', CAT);
  u.searchParams.set('game', GAME);
  u.searchParams.set('hub', HUB);
  u.searchParams.set('next', SUMMARY_PATH);
  u.searchParams.set('score', String(summaryObj.scoreFinal ?? 0));
  u.searchParams.set('bossesCleared', String(summaryObj.bossesCleared ?? 0));
  u.searchParams.set('phaseFinal', String(summaryObj.phaseFinal ?? 1));
  return u.toString();
}
function persistSummary(summaryObj){
  try {
    const extra = {
      url: buildCooldownUrl(summaryObj),
      summaryPath: SUMMARY_PATH,
      cooldownPath: COOLDOWN_GATE_PATH,
      hub: HUB,
      bossName: summaryObj.bestReachedBoss,
      badge: summaryObj.badge
    };
    summaryObj.__extraJson = JSON.stringify(extra);

    setJson('HHA_LAST_SUMMARY', summaryObj);
    if (summaryObj.pid) {
      setJson(`SB_LAST_SUMMARY:${summaryObj.pid}`, summaryObj);
      setJson(`HHA_LAST_SUMMARY:shadowbreaker:${summaryObj.pid}`, summaryObj);
      setText(`SB_BEST_REACHED_BOSS:${summaryObj.pid}`, summaryObj.bestReachedBoss || '');
      setJson(`SB_BEST_BADGE:${summaryObj.pid}`, summaryObj.badge || null);

      const prevBest = localStorage.getItem(`SB_BEST_REACHED_BOSS:${summaryObj.pid}`) || '';
      const prevIdx = Math.max(0, BOSSES.findIndex(b => b.name === prevBest));
      if (bestReachedBossIndexInRun >= prevIdx) {
        setText(`SB_BEST_REACHED_BOSS:${summaryObj.pid}`, summaryObj.bestReachedBoss || '');
      }

      const prevBadge = safeJsonParse(localStorage.getItem(`SB_BEST_BADGE:${summaryObj.pid}`), null);
      const rankMap = { rookie:1, hero:2, elite:3, legend:4 };
      const oldRank = prevBadge ? (rankMap[prevBadge.key] || 0) : 0;
      const newRank = summaryObj.badge ? (rankMap[summaryObj.badge.key] || 0) : 0;
      if (newRank >= oldRank) {
        setJson(`SB_BEST_BADGE:${summaryObj.pid}`, summaryObj.badge || null);
      }
    }
  } catch {}
}
function goCooldown(summaryObj){
  const url = buildCooldownUrl(summaryObj);
  try { location.href = url; }
  catch { location.assign(url); }
}

// -------------------------
// UI sync
// -------------------------
function syncMenuInputsFromQuery(){
  if (inputPid && PID) inputPid.value = PID;
  if (inputDiff && DIFF_CONFIG[DIFF]) inputDiff.value = DIFF;
  if (inputTime && Number.isFinite(TIME)) inputTime.value = String(TIME);
}
function readMenuConfig(){
  const pid = (inputPid?.value || PID || '').trim();
  const diff = (inputDiff?.value || currentDiff || 'normal').toLowerCase();
  const timeSec = clamp(Number(inputTime?.value || currentTimeSec || 70) || 70, 20, 240);
  return {
    pid,
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
  setScaleX(hpBossTop, bossHp / BOSS_HP_MAX);
  setScaleX(hpBossBottom, bossHp / BOSS_HP_MAX);
  setScaleX(feverBar, fever / FEVER_MAX);

  const feverReady = fever >= FEVER_MAX;
  const feverOn = now() < feverActiveUntil;

  if(feverLabel){
    feverLabel.textContent = feverOn ? 'ON' : (feverReady ? 'READY' : `${Math.round(fever)}%`);
    feverLabel.classList.toggle('on', feverReady || feverOn);
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
    bestReachedBossIndexInRun = Math.max(bestReachedBossIndexInRun, bossIndex);
    phase = 1;
    bossHp = BOSS_HP_MAX;
    say(`Boss Clear! ไปต่อ 🎉`, 'perfect');
  }
  setBossUI();
}

function expireCountsMiss(type){
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

  if(bossHp <= 26 && Math.random() < 0.22){
    type = 'bossface';
  }

  let sizePx = adaptiveBaseSize(CFG.baseSize);
  if(type === 'bossface') sizePx *= 1.14;
  if(type === 'bomb') sizePx *= 1.06;
  sizePx = clamp(sizePx, 78, 150);

  let ttlMs = CFG.targetLifetime;
  if (now() < feverActiveUntil) ttlMs = Math.round(ttlMs * 1.10);

  renderer.spawnTarget({
    id, type,
    sizePx,
    bossEmoji: boss().emoji,
    ttlMs
  });

  const tNow = now();
  active.set(id, { type, expireAtMs: tNow + ttlMs, sizePx: Math.round(sizePx) });

  events.push({ t: (currentTimeSec*1000 - timeLeft), type:'spawn', id, targetType:type, sizePx: Math.round(sizePx), ttlMs });
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
    scoreDelta = feverOn ? 24 : 18;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * (feverOn ? (CFG.bossDamageBossFace * 1.12) : CFG.bossDamageBossFace)));
    say(feverOn ? 'FEVER CRIT!!' : 'CRIT! ใส่หน้า Boss!', 'perfect');
  }else{
    grade = (fever >= FEVER_MAX || feverOn) ? 'perfect' : 'good';
    scoreDelta = (grade === 'perfect') ? (feverOn ? 18 : 14) : 10;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * (feverOn ? (CFG.bossDamageNormal * 1.12) : CFG.bossDamageNormal)));
    say(grade === 'perfect' ? 'PERFECT!' : 'ดีมาก!', grade === 'perfect' ? 'perfect' : 'good');
  }

  score = Math.max(0, score + scoreDelta);
  maxCombo = Math.max(maxCombo, combo);

  if (!feverOn) {
    fever = clamp(fever + (grade === 'perfect' ? 10 : 6), 0, FEVER_MAX);
  }

  renderer.playHitFx(id, { clientX: pt.clientX, clientY: pt.clientY, grade, scoreDelta });
  renderer.removeTarget(id, 'hit');

  events.push({ t: (currentTimeSec*1000 - timeLeft), type:'hit', id, targetType:type, grade, scoreDelta });

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

    const counted = expireCountsMiss(info.type);

    if (counted) {
      renderer.playHitFx(id, { grade:'expire' });
      miss++;
      combo = 0;
      say('พลาด! (Miss)', 'miss');
    }

    renderer.expireTarget(id);

    events.push({
      t: (currentTimeSec*1000 - timeLeft),
      type:'expire',
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
  const accPct = totalShots > 0 ? (hits/totalShots)*100 : 0;

  const pred = aiPredictSafe({ accPct, hp: youHp, combo });
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
  timeLeft = Math.max(0, (currentTimeSec*1000) - dt);

  const since = t - tLastSpawn;
  let spawnMin = CFG.spawnIntervalMin;
  let spawnMax = CFG.spawnIntervalMax;

  if (t < feverActiveUntil) {
    spawnMin = Math.max(420, Math.round(spawnMin * 0.92));
    spawnMax = Math.max(700, Math.round(spawnMax * 0.94));
  }

  const targetInterval = clamp(
    spawnMin + Math.random()*(spawnMax - spawnMin),
    420, 1800
  );

  if(since >= targetInterval){
    tLastSpawn = t;
    spawnOne();
    dl.onShot();
  }

  if(fever >= FEVER_MAX && t >= feverActiveUntil){
    fever = clamp(fever - 0.22, 0, FEVER_MAX);
  }

  handleExpiry();

  if ((Math.floor(timeLeft/1000) % 3) === 0) {
    maybeUseAIHint();
  }

  if(timeLeft <= 0){
    endGame('timeup');
    return;
  }

  setHUD();
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
  const accPct = totalShots > 0 ? (hits/totalShots)*100 : 0;
  session.accPct = Number(accPct.toFixed(2));

  if(resTime) resTime.textContent = `${(currentTimeSec - timeLeft/1000).toFixed(1)} s`;
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

  const summaryObj = {
    game: GAME,
    zone: ZONE,
    cat: CAT,
    pid: session.pid || PID || 'anon',
    diff: currentDiff,
    mode: currentMode,
    runMode: currentMode,
    timeSec: currentTimeSec,
    scoreFinal: score|0,
    comboMax: maxCombo|0,
    missTotal: miss|0,
    bossesCleared: bossesCleared|0,
    phaseFinal: phase|0,
    bestReachedBoss: getBestBossTextByIndex(Math.max(bestReachedBossIndexInRun, bossIndex)),
    bestReachedBossIndex: Math.max(bestReachedBossIndexInRun, bossIndex),
    accPct: Number(accPct.toFixed(2)),
    end_reason: reason,
    reason,
    timestampIso: new Date().toISOString(),
    sessionId: `sb-${Date.now()}`,
    bossVariant: boss()?.name || 'Boss',
    bossRule: bossRuleText(),
    reachedPhaseText: `${boss()?.name || 'Boss'} / Phase ${phase}`,
    badge: badgeFromSummary({
      accPct: Number(accPct.toFixed(2)),
      bossesCleared,
      miss
    }),
    stabilityMinPct: Math.max(0, Math.round((1 - (miss / Math.max(1, hits + miss))) * 100))
  };

  events.push({
    t:(currentTimeSec*1000 - timeLeft),
    type:'end',
    reason,
    score,
    miss,
    maxCombo,
    accPct:Number(accPct.toFixed(2))
  });

  persistSummary(summaryObj);

  showView('result');
  setTimeout(()=>goCooldown(summaryObj), 180);
}

function useFever(){
  if (!running || ended || paused) return;
  if (fever < FEVER_MAX) return;

  fever = 0;
  feverActiveUntil = now() + 6000;
  say('⚡ FEVER MODE!', 'perfect');

  events.push({ t:(currentTimeSec*1000 - timeLeft), type:'fever_on', durMs:6000 });

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

  score=0; combo=0; maxCombo=0; miss=0;
  fever=0; shield=0;
  feverActiveUntil=0;
  youHp=YOU_HP_MAX;
  bossHp=BOSS_HP_MAX;
  bossIndex=0; phase=1; bossesCleared=0;
  bestReachedBossIndexInRun=0;

  timeLeft = currentTimeSec * 1000;

  events.length = 0;
  active.clear();

  dl.reset?.();
  renderer.destroy();

  session.pid = cfg.pid || PID || '';
  session.mode = currentMode;
  session.diff = currentDiff;
  session.timeSec = currentTimeSec;
  session.startedAt = new Date().toISOString();
  session.endedAt = '';
  session.score = 0;
  session.maxCombo = 0;
  session.miss = 0;
  session.phase = 1;
  session.bossesCleared = 0;
  session.accPct = 0;

  setBossUI();
  setHUD();
  say('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');

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
  session.phase = phase|0;
  session.bossesCleared = bossesCleared|0;

  const totalShots = dl.getTotalShots?.() || 0;
  const hits = dl.getHits?.() || 0;
  const accPct = totalShots > 0 ? (hits/totalShots)*100 : 0;
  session.accPct = Number(accPct.toFixed(2));

  downloadCSV('shadowbreaker_session.csv', [session]);
});

syncMenuInputsFromQuery();
showView('menu');
setBossUI();
setHUD();