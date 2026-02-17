// === /fitness/js/engine.js ===
// Shadow Breaker engine — PRODUCTION v20260216abcd (CLEAN)
// ✅ Works with new HTML: sb-btn-start + inputs + mode tabs
// ✅ Fix: expiry removal (no stuck targets)
// ✅ Fix: MISS counts ONLY normal/bossface expiry (decoy/bomb/heal/shield expiry NOT miss)
// ✅ Fix: adaptive size by layer dimension
// ✅ Fix: meta auto-collapse on mobile + toggle
// ✅ Fever skill: press FEVER when READY => 6s bonus mode (no AI in research)

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { DLFeatures } from './dl-features.js';
import { AIPredictor } from './ai-predictor.js';

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

const MODE = (q('mode','normal') || 'normal').toLowerCase(); // normal | research (from URL)
const PID0 = q('pid','');
const DIFF0 = (q('diff','normal') || 'normal').toLowerCase();
const TIME0 = Math.max(20, Math.min(240, qNum('time', 70)));
const HUB  = q('hub','./hub.html');

const $ = (s)=>document.querySelector(s);

const wrapEl = $('#sb-wrap');

const viewMenu   = $('#sb-view-menu');
const viewPlay   = $('#sb-view-play');
const viewResult = $('#sb-view-result');

const btnTabPlay     = $('#sb-btn-play');
const btnTabResearch = $('#sb-btn-research');
const btnStart   = $('#sb-btn-start');
const btnHowto   = $('#sb-btn-howto');
const howtoBox   = $('#sb-howto');

const inputPid   = $('#sb-input-pid');
const inputDiff  = $('#sb-input-diff');
const inputTime  = $('#sb-input-time');

const btnBackMenu = $('#sb-btn-back-menu');
const btnPause    = $('#sb-btn-pause');
const btnFever    = $('#sb-btn-fever');
const feverHint   = $('#sb-fever-hint');

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
const metaCard   = $('#sb-meta');
const btnMeta    = $('#sb-btn-meta');
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

const linkHub = $('#sb-link-hub');
try { if(linkHub) linkHub.href = HUB || linkHub.href; } catch(_) {}

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

function say(text, cls){
  if(!msgMainEl) return;
  msgMainEl.textContent = text;
  msgMainEl.className = 'sb-msg-main' + (cls ? ' ' + cls : '');
}

let selectedMode = 'play'; // menu selection
function applyModeUI(){
  btnTabPlay?.classList.toggle('is-active', selectedMode === 'play');
  btnTabResearch?.classList.toggle('is-active', selectedMode === 'research');
}

function autoCollapseMeta(){
  if(!metaCard) return;
  const small = (window.innerWidth || 0) <= 520;
  if(small) metaCard.classList.add('is-collapsed');
}
window.addEventListener('resize', autoCollapseMeta, { passive:true });

btnMeta?.addEventListener('click', ()=>{
  if(!metaCard) return;
  metaCard.classList.toggle('is-collapsed');
  const collapsed = metaCard.classList.contains('is-collapsed');
  btnMeta?.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  if(btnMeta) btnMeta.textContent = collapsed ? '▸' : '▾';
});

// ✅ adaptive base size by layer width/height
function adaptiveBaseSize(raw){
  const r = layerEl?.getBoundingClientRect?.();
  const w = r?.width || window.innerWidth || 360;
  const h = r?.height || window.innerHeight || 640;
  const m = Math.max(280, Math.min(860, Math.min(w,h)));
  const scale = m / 520;
  const s = raw * scale;
  return clamp(s, 84, 130);
}

// NOTE: baseSize below is raw, then adaptiveBaseSize applied at spawn
const DIFF_CONFIG = {
  easy:   { spawnIntervalMin:950, spawnIntervalMax:1350, targetLifetime:1500, baseSize:112, bossDamageNormal:0.04,  bossDamageBossFace:0.45 },
  normal: { spawnIntervalMin:800, spawnIntervalMax:1200, targetLifetime:1300, baseSize:106, bossDamageNormal:0.035, bossDamageBossFace:0.40 },
  hard:   { spawnIntervalMin:650, spawnIntervalMax:1000, targetLifetime:1150, baseSize:100, bossDamageNormal:0.03,  bossDamageBossFace:0.35 }
};

let running=false, ended=false, paused=false;
let tStart=0, tLastSpawn=0, timeLeft=TIME0*1000;
let runtimeTimeSec = TIME0;

let score=0, combo=0, maxCombo=0, miss=0;
let fever=0, shield=0;
let youHp=YOU_HP_MAX, bossHp=BOSS_HP_MAX;

let bossIndex=0, phase=1, bossesCleared=0;

let diffKey = (DIFF_CONFIG[DIFF0] ? DIFF0 : 'normal');
let CFG = { ...DIFF_CONFIG[diffKey] };

const events = [];
const session = {
  pid: PID0 || '',
  mode: MODE,
  diff: diffKey,
  timeSec: runtimeTimeSec,
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

// Active targets with expiry (source of truth)
const active = new Map(); // id -> { type, expireAtMs, sizePx }

const renderer = new DomRendererShadow(layerEl, {
  wrapEl,
  feedbackEl: msgMainEl,
  onTargetHit
});
renderer.setDifficulty(diffKey);

function boss(){
  const i = clamp(bossIndex,0,BOSSES.length-1);
  return BOSSES[i];
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

let feverModeUntil = 0; // ms timestamp
function feverActive(){
  return now() < feverModeUntil;
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
    const ready = fever >= FEVER_MAX;
    feverLabel.textContent = ready ? 'READY' : `${Math.round(fever)}%`;
    feverLabel.classList.toggle('on', ready);
  }

  if(btnFever){
    const locked = (selectedMode === 'research'); // research lock
    btnFever.disabled = locked || !(fever >= FEVER_MAX) || feverActive();
  }
  if(feverHint){
    if(selectedMode === 'research') feverHint.textContent = 'Research: ล็อกพฤติกรรม • FEVER ใช้ได้ แต่ AI ปิดเสมอ';
    else feverHint.textContent = fever >= FEVER_MAX ? 'READY แล้วกด ⚡ FEVER เพื่อเปิดโบนัส 6 วิ' : 'ตีให้แม่นเพื่อชาร์จ FEVER';
  }
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

// ✅ MISS rule: expire counts only normal/bossface
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

  const ttlMs = CFG.targetLifetime;

  renderer.spawnTarget({ id, type, sizePx, bossEmoji: boss().emoji, ttlMs });

  const tNow = now();
  active.set(id, { type, expireAtMs: tNow + ttlMs, sizePx: Math.round(sizePx) });

  events.push({ t: (runtimeTimeSec*1000 - timeLeft), type:'spawn', id, targetType:type, sizePx: Math.round(sizePx), ttlMs });
}

function onTargetHit(id, pt){
  if(!running || ended || paused) return;

  const obj = renderer.targets.get(id);
  const el = obj?.el;
  if(!el) return;

  const type = obj?.type || 'normal';

  // prevent expire race
  active.delete(id);

  dl.onHit();

  let grade = 'good';
  let scoreDelta = 0;

  const feverOn = feverActive(); // true only if pressed FEVER
  const baseMult = feverOn ? 1.25 : 1.0;

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
    grade = feverOn ? 'perfect' : 'good';
    scoreDelta = (grade === 'perfect') ? 14 : 10;
    combo++;
    bossHp = Math.max(0, bossHp - (BOSS_HP_MAX * CFG.bossDamageNormal));
    say(grade === 'perfect' ? 'PERFECT!' : 'ดีมาก!', grade === 'perfect' ? 'perfect' : 'good');
  }

  // apply fever multiplier (only positive deltas)
  if(scoreDelta > 0) scoreDelta = Math.round(scoreDelta * baseMult);

  score = Math.max(0, score + scoreDelta);
  maxCombo = Math.max(maxCombo, combo);

  // fever charge (during fever mode charge slower)
  const gain = (grade === 'perfect' ? 10 : 6);
  fever = clamp(fever + (feverOn ? gain*0.5 : gain), 0, FEVER_MAX);

  renderer.playHitFx(id, { clientX: pt.clientX, clientY: pt.clientY, grade, scoreDelta });
  renderer.removeTarget(id);

  events.push({ t: (runtimeTimeSec*1000 - timeLeft), type:'hit', id, targetType:type, grade, scoreDelta });

  if(bossHp <= 0) nextBossOrPhase();
  if(youHp <= 0) endGame('dead');

  setHUD();
}

function handleExpiry(){
  const tNow = now();
  for(const [id, info] of active.entries()){
    if(tNow < info.expireAtMs) continue;

    // if renderer already removed, drop it
    const obj = renderer.targets.get(id);
    if(!obj?.el){
      active.delete(id);
      continue;
    }

    // expire FX + remove
    renderer.playHitFx(id, { grade:'expire' });
    renderer.expireTarget(id);

    // ✅ MISS counted only for normal/bossface expiry
    if(expireCountsMiss(info.type)){
      miss++;
      combo = 0;
      say('พลาด! (Miss)', 'miss');

      // optional tiny HP penalty only for normal expire
      if(info.type === 'normal' && youHp > 0){
        youHp = Math.max(0, youHp - 2);
        if(youHp <= 0) endGame('dead');
      }
    }

    events.push({
      t: (runtimeTimeSec*1000 - timeLeft),
      type:'expire',
      id,
      targetType: info.type,
      missCounted: expireCountsMiss(info.type) ? 1 : 0
    });

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
  const accPct = totalShots > 0 ? (hits/totalShots)*100 : 0;
  session.accPct = Number(accPct.toFixed(2));

  if(resTime) resTime.textContent = `${(runtimeTimeSec - timeLeft/1000).toFixed(1)} s`;
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

function tick(){
  if(!running || ended) return;
  requestAnimationFrame(tick);
  if(paused) return;

  const t = now();
  const dt = t - tStart;
  timeLeft = Math.max(0, (runtimeTimeSec*1000) - dt);

  // spawn pacing (slightly slower during fever mode for “feel good”)
  const feverOn = feverActive();
  const minI = CFG.spawnIntervalMin * (feverOn ? 1.10 : 1.0);
  const maxI = CFG.spawnIntervalMax * (feverOn ? 1.15 : 1.0);

  const since = t - tLastSpawn;
  const targetInterval = clamp(minI + Math.random()*(maxI - minI), 450, 2000);

  if(since >= targetInterval){
    tLastSpawn = t;
    spawnOne();
    dl.onShot();
  }

  handleExpiry();

  if(timeLeft <= 0){
    endGame('timeup');
  }

  setHUD();
}

function startGame(){
  // read menu inputs
  const pid = String(inputPid?.value || PID0 || '').trim();
  const diffSel = String(inputDiff?.value || DIFF0 || 'normal').toLowerCase();
  const timeSel = Math.max(20, Math.min(240, Number(inputTime?.value || TIME0 || 70)));

  selectedMode = selectedMode || 'play';
  applyModeUI();

  runtimeTimeSec = timeSel;
  diffKey = DIFF_CONFIG[diffSel] ? diffSel : 'normal';
  CFG = { ...DIFF_CONFIG[diffKey] };
  renderer.setDifficulty(diffKey);

  session.pid = pid;
  session.diff = diffKey;
  session.timeSec = runtimeTimeSec;
  session.mode = (selectedMode === 'research') ? 'research' : 'normal';
  session.startedAt = new Date().toISOString();

  ended = false;
  running = true;
  paused = false;

  score=0; combo=0; maxCombo=0; miss=0;
  fever=0; shield=0;
  feverModeUntil = 0;

  youHp=YOU_HP_MAX;
  bossHp=BOSS_HP_MAX;
  bossIndex=0; phase=1; bossesCleared=0;

  events.length = 0;
  active.clear();

  dl.reset();
  renderer.destroy();

  setBossUI();
  timeLeft = runtimeTimeSec*1000;
  setHUD();
  say('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');

  showView('play');
  autoCollapseMeta();

  tStart = now();
  tLastSpawn = tStart;
  requestAnimationFrame(tick);
}

// ---- UI events ----
btnTabPlay?.addEventListener('click', ()=>{ selectedMode='play'; applyModeUI(); });
btnTabResearch?.addEventListener('click', ()=>{ selectedMode='research'; applyModeUI(); });

btnStart?.addEventListener('click', startGame);

btnHowto?.addEventListener('click', ()=> howtoBox?.classList.toggle('is-on'));

btnBackMenu?.addEventListener('click', ()=>{
  running=false; ended=false; paused=false;
  active.clear();
  renderer.destroy();
  showView('menu');
});

btnPause?.addEventListener('change', ()=>{ paused = !!btnPause.checked; });

btnFever?.addEventListener('click', ()=>{
  if(!running || ended) return;
  if(fever < FEVER_MAX) return;

  // FEVER skill: 6s bonus mode
  fever = 0;
  feverModeUntil = now() + 6000;
  say('⚡ FEVER ON! (6s)', 'perfect');
  events.push({ t: (runtimeTimeSec*1000 - timeLeft), type:'fever_on', ttlMs: 6000 });
  setHUD();
});

btnRetry?.addEventListener('click', startGame);
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

btnEvtCsv?.addEventListener('click', ()=>{ if(events.length) downloadCSV('shadowbreaker_events.csv', events); });

btnSesCsv?.addEventListener('click', ()=>{
  session.score = score|0;
  session.maxCombo = maxCombo|0;
  session.miss = miss|0;
  session.phase = phase|0;
  session.bossesCleared = bossesCleared|0;

  const totalShots = dl.getTotalShots();
  const hits = dl.getHits();
  const accPct = totalShots > 0 ? (hits/totalShots)*100 : 0;
  session.accPct = Number(accPct.toFixed(2));

  downloadCSV('shadowbreaker_session.csv', [session]);
});

// init menu defaults from URL
try {
  if(inputPid) inputPid.value = PID0 || '';
  if(inputDiff) inputDiff.value = DIFF_CONFIG[DIFF0] ? DIFF0 : 'normal';
  if(inputTime) inputTime.value = String(TIME0);
} catch (_) {}

applyModeUI();
autoCollapseMeta();
showView('menu');
setBossUI();
setHUD();