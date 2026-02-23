// === /fitness/js/engine.js ===
// Shadow Breaker engine (PATCH: robust AI import + expire removal + fair miss rules + adaptive size)
// ✅ FIX: supports ai-predictor.js as ES module OR classic script (window.RB_AI)
// ✅ FIX: targets expire & disappear smoothly
// ✅ FIX: miss counting rule (expire counts only for normal/bossface)
// ✅ FIX: no MISS FX for decoy/bomb/heal/shield expire
// ✅ FIX: adaptive baseSize by screen/layer

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { DLFeatures } from './dl-features.js';

// ✅ ai-predictor may be ES module OR classic script (window.RB_AI)
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

const MODE = (q('mode', q('run','normal')) || 'normal').toLowerCase(); // normal | research | play
const PID  = q('pid','');
const DIFF = (q('diff','normal') || 'normal').toLowerCase();
const TIME = Math.max(20, Math.min(240, qNum('time', 70)));
const HUB  = q('hub','./hub.html');

const $ = (s)=>document.querySelector(s);
const wrapEl = $('#sb-wrap');

const viewMenu   = $('#sb-view-menu');
const viewPlay   = $('#sb-view-play');
const viewResult = $('#sb-view-result');

const btnPlay     = $('#sb-btn-play');
const btnResearch = $('#sb-btn-research');
const btnHowto    = $('#sb-btn-howto');
const howtoBox    = $('#sb-howto');

const btnStart    = $('#sb-btn-start');      // หน้า HTML ใหม่มีปุ่มนี้
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
const btnFever   = $('#sb-btn-fever');
const feverHint  = $('#sb-fever-hint');

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

const inputPid  = $('#sb-input-pid');
const inputDiff = $('#sb-input-diff');
const inputTime = $('#sb-input-time');

const btnMeta   = $('#sb-btn-meta');
const metaBody  = $('#sb-meta-body');

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

// ✅ adaptive base size by layer width (prevents too-big on small screens)
function adaptiveBaseSize(raw){
  const r = layerEl?.getBoundingClientRect?.();
  const w = r?.width || window.innerWidth || 360;
  const h = r?.height || window.innerHeight || 640;
  const m = Math.max(280, Math.min(860, Math.min(w,h)));
  const scale = m / 520;
  const s = raw * scale;
  return clamp(s, 84, 130);
}

// ----- Difficulty config -----
// NOTE: baseSize below is "raw" then adaptiveBaseSize() applies at spawn time
const DIFF_CONFIG = {
  easy:   { label:'Easy — ผ่อนคลาย',  spawnIntervalMin:950, spawnIntervalMax:1350, targetLifetime:1500, baseSize:112, bossDamageNormal:0.040, bossDamageBossFace:0.45 },
  normal: { label:'Normal — สมดุล',   spawnIntervalMin:800, spawnIntervalMax:1200, targetLifetime:1300, baseSize:106, bossDamageNormal:0.035, bossDamageBossFace:0.40 },
  hard:   { label:'Hard — ท้าทาย',    spawnIntervalMin:650, spawnIntervalMax:1000, targetLifetime:1150, baseSize:100, bossDamageNormal:0.030, bossDamageBossFace:0.35 }
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

let currentMode = (MODE === 'research') ? 'research' : 'normal';
let currentDiff = DIFF_CONFIG[DIFF] ? DIFF : 'normal';
let currentTimeSec = TIME;

let CFG = DIFF_CONFIG[currentDiff];

// events/session
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

// ✅ fallback to global classic script API if no ES export
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

// ✅ active target expiry source of truth
const active = new Map(); // id -> { type, expireAtMs, sizePx }

const renderer = new DomRendererShadow(layerEl, {
  wrapEl,
  feedbackEl: msgMainEl,
  onTargetHit
});
renderer.setDifficulty(currentDiff);

// -------------------------
// UI sync / helpers
// -------------------------
function applyParamsToHeaderLink(){
  const a = $('#sb-link-hub');
  if (!a) return;
  a.href = HUB || './../herohealth/hub.html';
}

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
  if(btnFever){
    btnFever.disabled = !feverReady && !feverOn;
    btnFever.classList.toggle('is-ready', feverReady);
    btnFever.classList.toggle('is-on', feverOn);
  }
  if(feverHint){
    if (feverOn) feverHint.textContent = 'FEVER ACTIVE! คะแนนแรงขึ้น + จังหวะเล่นลื่นขึ้น';
    else if (feverReady) feverHint.textContent = 'READY! กด FEVER ได้เลย ⚡';
    else feverHint.textContent = 'เก็บเกจจากการตีเป้าให้แม่น เพื่อเปิด FEVER';
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

// ✅ miss rule (expire counts only normal/bossface)
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

  // adaptive baseSize
  let sizePx = adaptiveBaseSize(CFG.baseSize);
  if(type === 'bossface') sizePx *= 1.14;
  if(type === 'bomb') sizePx *= 1.06;
  sizePx = clamp(sizePx, 78, 150);

  // FEVER active: tiny lifetime bonus = makes it feel powerful
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

  // ✅ remove from active immediately to prevent expire race
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

  // fever gain (ไม่สะสมระหว่างเปิด FEVER มากเกินไป)
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

function endGame(reason='timeup'){
  if(ended) return;
  ended = true;
  running = false;

  // cleanup targets
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

  events.push({ t:(currentTimeSec*1000 - timeLeft), type:'end', reason, score, miss, maxCombo, accPct:Number(accPct.toFixed(2)) });

  showView('result');
}

// ✅ handle expiry each tick
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

    // ✅ MISS FX only when this expire truly counts as miss
    if (counted) {
      renderer.playHitFx(id, { grade:'expire' });
      miss++;
      combo = 0;
      say('พลาด! (Miss)', 'miss');
    }

    // always remove softly
    renderer.expireTarget(id);

    events.push({
      t: (currentTimeSec*1000 - timeLeft),
      type:'expire',
      id,
      targetType: info.type,
      missCounted: counted ? 1 : 0
    });

    active.delete(id);

    // tiny HP penalty only for normal expire
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
  // ไม่บังคับ gameplay — แค่ใช้ future hook/coach
  const totalShots = dl.getTotalShots?.() || 0;
  const hits = dl.getHits?.() || 0;
  const accPct = totalShots > 0 ? (hits/totalShots)*100 : 0;

  const pred = aiPredictSafe({
    accPct,
    hp: youHp,
    combo
  });

  // โชว์เป็นข้อความเบา ๆ เฉพาะโหมดเล่นและเปิด ai
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

  // spawn interval (FEVER active => slightly faster pace feel but still fair)
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

  // FEVER passive decay only when not active
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

// -------------------------
// Fever
// -------------------------
function useFever(){
  if (!running || ended || paused) return;
  if (fever < FEVER_MAX) return;

  fever = 0;
  feverActiveUntil = now() + 6000; // 6s
  say('⚡ FEVER MODE!', 'perfect');

  events.push({ t:(currentTimeSec*1000 - timeLeft), type:'fever_on', durMs:6000 });

  setHUD();
}

// -------------------------
// Boot / Start
// -------------------------
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

// -------------------------
// Events
// -------------------------
btnPlay?.addEventListener('click', ()=>{
  currentMode = 'normal';
  btnPlay.classList.add('is-active');
  btnResearch?.classList.remove('is-active');
});

btnResearch?.addEventListener('click', ()=>{
  currentMode = 'research';
  btnResearch.classList.add('is-active');
  btnPlay?.classList.remove('is-active');
});

btnStart?.addEventListener('click', ()=>{
  start(currentMode === 'research' ? 'research' : 'normal');
});

// backward compatibility (old UI)
btnPlay?.addEventListener('dblclick', ()=> start('normal'));
btnResearch?.addEventListener('dblclick', ()=> start('research'));

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
  if (!metaBody || !btnMeta) return;
  const hidden = metaBody.classList.toggle('is-collapsed');
  btnMeta.setAttribute('aria-expanded', hidden ? 'false' : 'true');
  btnMeta.textContent = hidden ? '▸' : '▾';
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

// -------------------------
// Init
// -------------------------
applyParamsToHeaderLink();
syncMenuInputsFromQuery();
showView('menu');
setBossUI();
setHUD();