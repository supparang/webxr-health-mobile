// === /fitness/js/jump-duck.js — Jump-Duck (Boss Skills ALL) v20260207b ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

function fatal(msg){
  const box = document.getElementById('jd-fatal');
  if (!box) { alert(msg); return; }
  box.textContent = msg;
  box.classList.remove('jd-hidden');
}

window.addEventListener('error', (e)=>{
  fatal('JS ERROR:\n' + (e?.message || e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
});
window.addEventListener('unhandledrejection', (e)=>{
  fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
});

/* -------------------------
   QS / HHA ctx
------------------------- */
function getQS(){
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}
const QS = getQS();
function qsGet(k, d=''){
  const v = QS.get(k);
  return (v==null || String(v).trim()==='') ? d : String(v);
}

const HHA_CTX = {
  hub: qsGet('hub',''),
  view: (qsGet('view','') || '').toLowerCase(),
  mode: (qsGet('mode','') || qsGet('runMode','') || '').toLowerCase(),
  diff: (qsGet('diff','') || '').toLowerCase(),
  duration: qsGet('duration', qsGet('time','')),
  seed: qsGet('seed',''),
  studyId: qsGet('studyId',''),
  phase: qsGet('phase',''),
  conditionGroup: qsGet('conditionGroup',''),
  pid: qsGet('pid',''),
  group: qsGet('group',''),
  note: qsGet('note',''),
  log: qsGet('log','')
};

function detectView(){
  if (HHA_CTX.view) return HHA_CTX.view;
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const w = Math.min(window.innerWidth||0, document.documentElement.clientWidth||0, screen.width||9999);
  const h = Math.min(window.innerHeight||0, document.documentElement.clientHeight||0, screen.height||9999);
  const small = Math.min(w,h) <= 520;
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);
  if ((touch || isMobileUA) && small) return 'cvr';
  if (touch || isMobileUA) return 'mobile';
  return 'pc';
}
function applyViewClass(view){
  const b = document.body;
  b.classList.remove('view-pc','view-mobile','view-cvr','view-vr');
  if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else if (view === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');
}
applyViewClass(detectView());

/* -------------------------
   Optional: VR UI loader
------------------------- */
async function ensureVrUi(){
  try{
    if (window.__HHA_VRUI_LOADED__) return true;
    if (!('xr' in navigator)) return false;
    const src = '../herohealth/vr/vr-ui.js';
    await new Promise((resolve,reject)=>{
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = ()=>reject(new Error('Failed to load '+src));
      document.head.appendChild(s);
    });
    return true;
  }catch(e){
    console.warn(e);
    return false;
  }
}

/* -------------------------
   RNG
------------------------- */
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function strToSeed(s){
  const str = String(s||'');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function getSeed(){
  if (HHA_CTX.seed) return strToSeed(HHA_CTX.seed);
  return (Date.now() >>> 0);
}
let RNG = mulberry32(getSeed());

/* -------------------------
   DOM refs
------------------------- */
const viewMenu   = $('#view-menu');
const viewPlay   = $('#view-play');
const viewResult = $('#view-result');

const elMode     = $('#jd-mode');
const elDiff     = $('#jd-diff');
const elDuration = $('#jd-duration');

const elResearchBlock = $('#jd-research-block');
const elPid     = $('#jd-participant-id');
const elGroup   = $('#jd-group');
const elNote    = $('#jd-note');

const elHudMode   = $('#hud-mode');
const elHudDiff   = $('#hud-diff');
const elHudDur    = $('#hud-duration');
const elHudStab   = $('#hud-stability');
const elHudObs    = $('#hud-obstacles');
const elHudScore  = $('#hud-score');
const elHudCombo  = $('#hud-combo');
const elHudTime   = $('#hud-time');
const elHudPhase  = $('#hud-phase');

const elPlayArea  = $('#jd-play-area');
const elAvatar    = $('#jd-avatar');
const elObsHost   = $('#jd-obstacles');
const elJudge     = $('#jd-judge');

const resMode         = $('#res-mode');
const resDiff         = $('#res-diff');
const resDuration     = $('#res-duration');
const resTotalObs     = $('#res-total-obs');
const resHits         = $('#res-hits');
const resMiss         = $('#res-miss');
const resJumpHit      = $('#res-jump-hit');
const resDuckHit      = $('#res-duck-hit');
const resJumpMiss     = $('#res-jump-miss');
const resDuckMiss     = $('#res-duck-miss');
const resAcc          = $('#res-acc');
const resRTMean       = $('#res-rt-mean');
const resStabilityMin = $('#res-stability-min');
const resScore        = $('#res-score');
const resRank         = $('#res-rank');

const backHubMenu   = $('#jd-back-hub-menu');
const backHubPlay   = $('#jd-back-hub-play');
const backHubResult = $('#jd-back-hub-result');

/* Boss HUD */
const bossPhaseEl = $('#boss-phase');
const bossHpEl    = $('#boss-hp');
const bossFillEl  = $('#boss-fill');
const bossRageEl  = $('#boss-rage');

/* -------------------------
   SFX
------------------------- */
function playSfx(id){
  const el = document.getElementById(id);
  if (!el) return;
  try{ el.currentTime = 0; el.play().catch(()=>{}); }catch{}
}

/* -------------------------
   Config
------------------------- */
const JD_DIFFS = {
  easy:   { speed: 38, spawnMs: 1300, hitWinMs: 260, stabDmg: 10, stabGain: 3, score: 12 },
  normal: { speed: 48, spawnMs: 1000, hitWinMs: 220, stabDmg: 13, stabGain: 3, score: 14 },
  hard:   { speed: 62, spawnMs:  800, hitWinMs: 200, stabDmg: 16, stabGain: 4, score: 16 }
};

const PHASE_THRESH = [0.33, 0.70];
const SPAWN_X  = 100;
const CENTER_X = 24;
const MISS_X   = 4;

/* Boss skill tuning (แฟร์ + เร้าใจ) */
const SKILL = {
  feintChanceP2: 0.10,
  feintChanceP3: 0.14,
  feintMs: 180,          // โชว์หลอกก่อนกลับเป็นของจริง

  swapChanceP3: 0.14,    // โอกาสสลับใกล้เส้น
  swapWindowX1: 40,      // เริ่มเข้าโซน “เตือน”
  swapWindowX2: 30,      // จุดที่สลับจริง
  swapMinAliveMs: 320,   // ต้องวิ่งมาพอสมควรถึงจะสลับ (ไม่โกง)

  burstChanceBase: 0.10, // Phase3 + Rageสูง จะเพิ่มเอง
  burstCount: 3,
  burstGapMs: 95
};

/* -------------------------
   State
------------------------- */
let running = false;
let state = null;
let rafId = null;
let lastFrame = null;
let judgeTimer = null;
let lastAction = null;
let nextObstacleId = 1;

/* -------------------------
   ML/DL hook (optional, non-blocking)
   window.JD_ML = { predictNext(ctx)-> Promise<{type:'high'|'low', confidence:0..1}> }
------------------------- */
let NEXT_TYPE_HINT = null;
let ML_PENDING = false;

function requestMlHint(context){
  const ML = window.JD_ML;
  if (!ML || typeof ML.predictNext !== 'function') return;
  if (ML_PENDING) return;
  ML_PENDING = true;

  Promise.resolve()
    .then(()=> ML.predictNext(context))
    .then(out=>{
      if (!out || (out.type!=='high' && out.type!=='low')) return;
      const c = (out.confidence==null) ? 0.0 : Number(out.confidence);
      if (Number.isFinite(c) && c >= 0.62) NEXT_TYPE_HINT = out.type;
    })
    .catch(e=> console.warn('JD_ML predict failed', e))
    .finally(()=> { ML_PENDING = false; });
}

/* -------------------------
   AI Predictor (fair)
------------------------- */
function createAIPredictor(){
  const mem = { streakMiss:0, missJump:0, missDuck:0, lastRT:220, bias:0, lastNeed:null };
  function onHit(need, rt){
    mem.streakMiss = 0;
    mem.lastNeed = need;
    if (Number.isFinite(rt)) mem.lastRT = 0.85*mem.lastRT + 0.15*rt;
    mem.bias *= 0.92;
  }
  function onMiss(need){
    mem.streakMiss++;
    mem.lastNeed = need;
    if (need==='jump') mem.missJump++; else mem.missDuck++;
    const total = mem.missJump + mem.missDuck + 1;
    mem.bias = ((mem.missDuck/total) - (mem.missJump/total)) * 0.35;
    mem.bias = Math.max(-0.35, Math.min(0.35, mem.bias));
  }
  function pickType(baseRand){
    const t = baseRand + mem.bias;
    return (t >= 0.5) ? 'high' : 'low';
  }
  function adjustSpawnInterval(ms, phase, mode){
    let out = ms;
    if (mode==='training'){
      if (phase===3) out *= 0.90;
      if (mem.streakMiss >= 2) out *= 1.12;
    }
    return Math.max(520, Math.min(1800, out));
  }
  function getHint(){
    if (mem.streakMiss >= 2) return 'ทิป: กด “ก่อนถึงเส้น” นิดเดียว จะเข้าหน้าต่าง HIT ง่ายขึ้น ✨';
    if (mem.lastRT > 260) return 'ทิป: ลองกดเร็วขึ้นอีกนิด จะได้ PERFECT/COMBO ง่ายขึ้น 🔥';
    return '';
  }
  function snapshot(){ return {...mem}; }
  return { onHit, onMiss, pickType, adjustSpawnInterval, getHint, snapshot };
}
const AI = createAIPredictor();

/* -------------------------
   Views / UI
------------------------- */
function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name==='menu') viewMenu?.classList.remove('jd-hidden');
  if (name==='play') viewPlay?.classList.remove('jd-hidden');
  if (name==='result') viewResult?.classList.remove('jd-hidden');
}
function showJudge(text, kind){
  if (!elJudge) return;
  elJudge.textContent = text;
  elJudge.className = 'jd-judge show';
  if (kind) elJudge.classList.add(kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=> elJudge.classList.remove('show'), 520);
}
function modeLabel(mode){
  if (mode==='training') return 'Training';
  if (mode==='test') return 'Test';
  if (mode==='research') return 'Research';
  if (mode==='tutorial') return 'Tutorial';
  return 'Play';
}
function setHubLinks(){
  const hub = HHA_CTX.hub || '';
  if (!hub) return;
  [backHubMenu, backHubPlay, backHubResult].forEach(a=> a && (a.href = hub));
}
function updateResearchVisibility(){
  const mode = (elMode?.value) || 'training';
  if (!elResearchBlock) return;
  if (mode==='research') elResearchBlock.classList.remove('jd-hidden');
  else elResearchBlock.classList.add('jd-hidden');
}
function collectParticipant(metaMode){
  if (metaMode!=='research') return {id:'', group:'', note:''};
  return {
    id: (elPid?.value || HHA_CTX.pid || '').trim(),
    group: (elGroup?.value || HHA_CTX.group || '').trim(),
    note: (elNote?.value || HHA_CTX.note || '').trim()
  };
}

/* -------------------------
   Boss system
------------------------- */
function bossInit(){
  return { hp:100, rage:0, phase:1 };
}
function bossUpdateHud(){
  if (!state || !state.boss) return;
  bossPhaseEl && (bossPhaseEl.textContent = String(state.boss.phase));
  bossHpEl && (bossHpEl.textContent = String(Math.max(0, Math.round(state.boss.hp))));
  bossRageEl && (bossRageEl.textContent = String(Math.max(0, Math.round(state.boss.rage))));
  if (bossFillEl){
    const r = Math.max(0, Math.min(1, state.boss.hp/100));
    bossFillEl.style.transform = `scaleX(${r.toFixed(3)})`;
  }
}
function bossOnHit(){
  if (!state) return;
  const dmg = 0.8 + Math.min(state.combo, 12)*0.09;
  state.boss.hp = Math.max(0, state.boss.hp - dmg);
  state.boss.rage = Math.max(0, state.boss.rage - 1.2);
}
function bossOnMiss(){
  if (!state) return;
  state.boss.rage = Math.min(100, state.boss.rage + 6);
}

/* -------------------------
   Session / Game start/end
------------------------- */
function makeSessionId(){
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

function startGameBase(opts){
  const mode = opts.mode || 'training';
  const diffKey = opts.diffKey || 'normal';
  const cfg0 = JD_DIFFS[diffKey] || JD_DIFFS.normal;
  const durationMs = opts.durationMs ?? 60000;
  const isTutorial = !!opts.isTutorial;

  RNG = mulberry32(getSeed());
  NEXT_TYPE_HINT = null;
  ML_PENDING = false;

  const now = performance.now();
  state = {
    sessionId: makeSessionId(),
    mode, diffKey, cfg0, durationMs, isTutorial,
    startTime: now, elapsedMs:0, remainingMs: durationMs,
    stability:100, minStability:100,
    nextSpawnAt: now + 650,
    obstacles: [],
    obstaclesSpawned:0,
    hits:0, miss:0,
    jumpHit:0, duckHit:0,
    jumpMiss:0, duckMiss:0,
    combo:0, maxCombo:0,
    score:0,
    hitRTs: [],
    participant: collectParticipant(mode),
    boss: bossInit(),
    ctx: { ...HHA_CTX }
  };

  running = true;
  lastFrame = now;
  lastAction = null;

  elObsHost && (elObsHost.innerHTML = '');
  elAvatar && elAvatar.classList.remove('jump','duck');

  elHudMode && (elHudMode.textContent = modeLabel(mode));
  elHudDiff && (elHudDiff.textContent = diffKey);
  elHudDur && (elHudDur.textContent = (durationMs/1000|0)+'s');
  elHudStab && (elHudStab.textContent = '100%');
  elHudObs && (elHudObs.textContent = '0 / 0');
  elHudScore && (elHudScore.textContent = '0');
  elHudCombo && (elHudCombo.textContent = '0');
  elHudTime && (elHudTime.textContent = (durationMs/1000).toFixed(1));
  elHudPhase && (elHudPhase.textContent = '1');
  bossUpdateHud();

  showView('play');
  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  showJudge(isTutorial ? 'Tutorial: Low=JUMP 🦘 · High=DUCK 🛡️' : 'READY ✨', 'ok');
}

function startGameFromMenu(){
  const mode = (elMode?.value || HHA_CTX.mode || 'training').toLowerCase();
  const diff = (elDiff?.value || HHA_CTX.diff || 'normal').toLowerCase();
  const durS = parseInt((elDuration?.value || HHA_CTX.duration || '60'),10) || 60;
  startGameBase({ mode, diffKey: diff, durationMs: durS*1000, isTutorial:false });
}
function startTutorial(){
  startGameBase({ mode:'training', diffKey:'easy', durationMs:15000, isTutorial:true });
}

function endGame(){
  running = false;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }
  if (!state) return;

  if (state.isTutorial){
    showJudge('จบ Tutorial แล้ว! 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  const total = state.obstaclesSpawned || 0;
  const hits = state.hits || 0;
  const acc = total ? hits/total : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  resMode && (resMode.textContent = modeLabel(state.mode));
  resDiff && (resDiff.textContent = state.diffKey);
  resDuration && (resDuration.textContent = (state.durationMs/1000|0)+'s');
  resTotalObs && (resTotalObs.textContent = String(total));
  resHits && (resHits.textContent = String(state.hits));
  resMiss && (resMiss.textContent = String(state.miss));
  resJumpHit && (resJumpHit.textContent = String(state.jumpHit));
  resDuckHit && (resDuckHit.textContent = String(state.duckHit));
  resJumpMiss && (resJumpMiss.textContent = String(state.jumpMiss));
  resDuckMiss && (resDuckMiss.textContent = String(state.duckMiss));
  resAcc && (resAcc.textContent = (acc*100).toFixed(1)+' %');
  resRTMean && (resRTMean.textContent = rtMean ? rtMean.toFixed(0)+' ms' : '-');
  resStabilityMin && (resStabilityMin.textContent = state.minStability.toFixed(1)+' %');
  resScore && (resScore.textContent = String(Math.round(state.score)));

  if (resRank){
    let rank='C';
    const stab = state.minStability;
    if (acc>=0.90 && stab>=85) rank='S';
    else if (acc>=0.80 && stab>=75) rank='A';
    else if (acc>=0.65 && stab>=60) rank='B';
    else if (acc<0.40 || stab<40) rank='D';
    resRank.textContent = rank;
  }

  showView('result');
}

/* -------------------------
   Loop
------------------------- */
function getPhase(progress){
  if (progress < PHASE_THRESH[0]) return 1;
  if (progress < PHASE_THRESH[1]) return 2;
  return 3;
}

function loop(ts){
  if (!running || !state) return;
  const dt = ts - (lastFrame || ts);
  lastFrame = ts;

  state.elapsedMs = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

  const progress = Math.min(1, state.elapsedMs / state.durationMs);
  const phase = getPhase(progress);

  state.boss.phase = phase;
  elHudPhase && (elHudPhase.textContent = String(phase));
  elHudTime && (elHudTime.textContent = (state.remainingMs/1000).toFixed(1));

  // end by time / boss defeated
  if (state.elapsedMs >= state.durationMs){ endGame(); return; }
  if (state.boss.hp <= 0){
    showJudge('🏆 ชนะบอส! PERFECT RUN!', 'combo');
    endGame(); return;
  }

  // spawn loop
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts, phase);
    let interval = state.cfg0.spawnMs;

    if (state.mode === 'training'){
      const factor = 1 - 0.30*progress;
      interval *= Math.max(0.56, factor);

      // rage makes it tighter
      const rageK = 1 - (state.boss.rage/100)*0.18;
      interval *= Math.max(0.74, rageK);

      interval = AI.adjustSpawnInterval(interval, phase, state.mode);
    }

    if (phase === 3) interval = Math.max(520, interval);
    state.nextSpawnAt += interval;
  }

  updateObstacles(dt, ts, phase, progress);
  pollGamepad();

  elHudStab && (elHudStab.textContent = state.stability.toFixed(1)+'%');
  elHudObs && (elHudObs.textContent = `${state.hits} / ${state.obstaclesSpawned}`);
  elHudScore && (elHudScore.textContent = String(Math.round(state.score)));
  elHudCombo && (elHudCombo.textContent = String(state.combo));

  bossUpdateHud();

  const tip = AI.getHint();
  if (tip && phase === 2 && (state.elapsedMs % 7000 < 30)) showJudge(tip, 'combo');

  rafId = requestAnimationFrame(loop);
}

/* -------------------------
   Boss Skills: FEINT / SWAP / BURST
------------------------- */
function shouldFeint(phase){
  if (state.mode !== 'training') return false;
  if (phase === 2) return RNG() < SKILL.feintChanceP2;
  if (phase === 3) return RNG() < SKILL.feintChanceP3;
  return false;
}

function shouldSwap(phase){
  if (state.mode !== 'training') return false;
  if (phase !== 3) return false;
  // rage สูง โอกาสสลับสูงขึ้น
  const extra = (state.boss.rage/100) * 0.12;
  return RNG() < (SKILL.swapChanceP3 + extra);
}

function shouldBurst(phase){
  if (state.mode !== 'training') return false;
  if (phase !== 3) return false;
  const extra = (state.boss.rage >= 70) ? 0.18 : 0.0;
  return RNG() < (SKILL.burstChanceBase + extra);
}

/* -------------------------
   Obstacles
------------------------- */
function spawnObstacle(ts, phase){
  if (!elObsHost || !state) return;

  // prevent over-stack
  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 70) return;

  // request ML hint (non-blocking)
  requestMlHint({
    phase,
    difficulty: state.diffKey,
    mode: state.mode,
    recent: {
      combo: state.combo,
      streak: AI.snapshot().streakMiss,
      lastRT: AI.snapshot().lastRT,
      missJump: AI.snapshot().missJump,
      missDuck: AI.snapshot().missDuck,
      rage: state.boss.rage,
      stability: state.stability
    }
  });

  // BURST skill
  if (shouldBurst(phase)){
    const base = (NEXT_TYPE_HINT || AI.pickType(RNG()));
    NEXT_TYPE_HINT = null;

    // burst pattern: alternate around base (fair but intense)
    const seq = [base, base === 'high' ? 'low' : 'high', base];
    for (let i=0;i<SKILL.burstCount;i++){
      const t = seq[i % seq.length];
      setTimeout(()=>{
        if (!running || !state) return;
        makeOne(t, performance.now(), { skill:'burst', feint:false, canSwap: false });
      }, i*SKILL.burstGapMs);
    }

    showJudge('🔥 BOSS BURST!', 'combo');
    return;
  }

  // normal single spawn
  let type = NEXT_TYPE_HINT || AI.pickType(RNG());
  NEXT_TYPE_HINT = null;

  const feint = shouldFeint(phase);
  const canSwap = shouldSwap(phase);

  makeOne(type, ts, { skill: feint ? 'feint' : (canSwap ? 'swap' : ''), feint, canSwap });
}

function setObstacleVisual(el, type){
  const isHigh = (type === 'high');
  el.classList.toggle('jd-obstacle--high', isHigh);
  el.classList.toggle('jd-obstacle--low', !isHigh);

  const icon = el.querySelector('.jd-obs-icon');
  const tag  = el.querySelector('.jd-obs-tag');
  if (icon) icon.textContent = isHigh ? '⬇' : '⬆';
  if (tag)  tag.textContent  = isHigh ? 'DUCK' : 'JUMP';
}

function makeOne(type, ts, opt = {}){
  if (!state) return;
  const isHigh = (type === 'high');
  const need = isHigh ? 'duck' : 'jump';

  const el = document.createElement('div');
  el.className = 'jd-obstacle ' + (isHigh ? 'jd-obstacle--high' : 'jd-obstacle--low');
  if (opt.skill === 'feint') el.classList.add('skill-feint');
  if (opt.skill === 'swap')  el.classList.add('skill-swap');
  if (opt.skill === 'burst') el.classList.add('skill-burst');

  el.dataset.id = String(nextObstacleId);

  const inner = document.createElement('div');
  inner.className = 'jd-obstacle-inner';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'jd-obs-icon';
  iconSpan.textContent = isHigh ? '⬇' : '⬆';

  const tagSpan = document.createElement('span');
  tagSpan.className = 'jd-obs-tag';
  tagSpan.textContent = isHigh ? 'DUCK' : 'JUMP';

  inner.appendChild(iconSpan);
  inner.appendChild(tagSpan);
  el.appendChild(inner);
  elObsHost.appendChild(el);

  const obs = {
    id: nextObstacleId++,
    type,
    need,
    x: SPAWN_X,
    createdAt: ts,
    resolved:false,
    element: el,

    // skills flags
    feint: !!opt.feint,
    feinted: false,
    canSwap: !!opt.canSwap,
    swapped: false
  };

  state.obstacles.push(obs);
  state.obstaclesSpawned++;
  playSfx('jd-sfx-beep');

  // FEINT: โชว์ “หลอก” แป๊บเดียว แล้วกลับเป็นของจริงก่อนเข้า hit window
  if (obs.feint){
    // swap to wrong display for a moment
    const fakeType = (type === 'high') ? 'low' : 'high';
    setObstacleVisual(el, fakeType);
    setTimeout(()=>{
      if (!running || !state || obs.resolved || !obs.element) return;
      setObstacleVisual(obs.element, obs.type);
      obs.feinted = true;
    }, SKILL.feintMs);
  }
}

function updateObstacles(dt, now, phase, progress){
  const cfg = state.cfg0;
  let speed = cfg.speed;

  if (state.mode === 'training'){
    if (phase === 2) speed *= 1.14;
    if (phase === 3) speed *= 1.30;
    speed *= (1 + 0.18*progress);
    speed *= (1 + (state.boss.rage/100)*0.12);
  }

  const move = speed * (dt/1000);
  const keep = [];

  for (const obs of state.obstacles){
    obs.x -= move;
    if (obs.element) obs.element.style.left = obs.x + '%';

    // SWAP: มี “เตือน” + สลับจริงใกล้เส้น (แฟร์)
    if (!obs.resolved && obs.canSwap && !obs.swapped){
      const aliveMs = now - obs.createdAt;

      // warn zone
      if (obs.x <= SKILL.swapWindowX1 && obs.x > SKILL.swapWindowX2 && aliveMs >= SKILL.swapMinAliveMs){
        // แค่สัญญาณ (ไม่สลับ yet)
        obs.element && obs.element.classList.add('skill-swap');
      }

      // swap point
      if (obs.x <= SKILL.swapWindowX2 && aliveMs >= SKILL.swapMinAliveMs){
        obs.swapped = true;
        obs.type = (obs.type === 'high') ? 'low' : 'high';
        obs.need = (obs.type === 'high') ? 'duck' : 'jump';
        obs.element && setObstacleVisual(obs.element, obs.type);
        playSfx('jd-sfx-beep');
        showJudge('⚠ SWAP!', 'combo');
      }
    }

    // HIT
    if (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6){
      const a = lastAction;
      if (a && a.time){
        const rt = Math.abs(a.time - now);
        if (a.type === obs.need && rt <= cfg.hitWinMs){
          obs.resolved = true;

          state.hits++;
          state.combo++;
          state.maxCombo = Math.max(state.maxCombo, state.combo);

          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const phaseM = (phase === 3) ? 1.22 : (phase === 2 ? 1.10 : 1.0);
          const rageM  = 1 + (state.boss.rage/100)*0.10;
          state.score += Math.round(cfg.score * comboM * phaseM * rageM);

          if (obs.need === 'jump') state.jumpHit++; else state.duckHit++;

          state.stability = Math.min(100, state.stability + cfg.stabGain);
          state.minStability = Math.min(state.minStability, state.stability);

          state.hitRTs.push(rt);
          AI.onHit(obs.need, rt);
          bossOnHit();

          obs.element && obs.element.remove();
          obs.element = null;

          playSfx('jd-sfx-hit');
          if (state.combo >= 8) playSfx('jd-sfx-combo');

          showJudge(
            phase === 3
              ? (obs.need === 'jump' ? '⚡ JUMP SLASH!' : '⚡ DUCK SLASH!')
              : (obs.need === 'jump' ? 'JUMP ดีมาก 🦘' : 'DUCK ทันเวลา 🛡️'),
            state.combo>=8?'combo':'ok'
          );
          continue;
        }
      }
    }

    // MISS
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;

      state.miss++;
      state.combo = 0;

      if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;

      state.stability = Math.max(0, state.stability - cfg.stabDmg);
      state.minStability = Math.min(state.minStability, state.stability);

      AI.onMiss(obs.need);
      bossOnMiss();

      obs.element && obs.element.remove();
      obs.element = null;

      playSfx('jd-sfx-miss');

      if (phase === 3 && state.boss.rage >= 70) showJudge('💢 BOSS RAGE!', 'miss');
      else showJudge('MISS ลองใหม่อีกที ✨', 'miss');

      elPlayArea?.classList.add('shake');
      setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);
      continue;
    }

    if (obs.x > -20) keep.push(obs);
    else {
      obs.element && obs.element.remove();
      obs.element = null;
    }
  }

  state.obstacles = keep;

  // action decay
  if (lastAction && now - lastAction.time > 260) lastAction = null;

  if (state.stability <= 0){
    showJudge('หมดแรงทรงตัว! ⛔', 'miss');
    endGame();
  }
}

/* -------------------------
   Input
------------------------- */
function triggerAction(type){
  if (!state || !running) return;
  const now = performance.now();
  lastAction = { type, time: now };

  if (elAvatar){
    elAvatar.classList.remove('jump','duck');
    elAvatar.classList.add(type);
    setTimeout(()=> elAvatar?.classList.remove(type), 180);
  }
}
function handleKeyDown(ev){
  if (!running) return;
  if (ev.code === 'ArrowUp' || ev.code === 'KeyW'){ ev.preventDefault(); triggerAction('jump'); }
  else if (ev.code === 'ArrowDown' || ev.code === 'KeyS'){ ev.preventDefault(); triggerAction('duck'); }
}
function handlePointerDown(ev){
  if (!running || !elPlayArea) return;
  const rect = elPlayArea.getBoundingClientRect();
  const mid = rect.top + rect.height/2;
  const y = ev.clientY;
  if (y < mid) triggerAction('jump');
  else triggerAction('duck');
}
function onHhaShoot(ev){
  if (!running || !elPlayArea) return;
  const d = ev?.detail || {};
  const rect = elPlayArea.getBoundingClientRect();
  const y = Number.isFinite(d.y) ? d.y : (rect.top + rect.height/2);
  const mid = rect.top + rect.height/2;
  if (y < mid) triggerAction('jump');
  else triggerAction('duck');
}

/* Gamepad */
let gpPrev = { up:false, down:false, a:false, b:false };
function pollGamepad(){
  if (!running) return;
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gps && gps[0];
  if (!gp || !gp.buttons) return;

  const up   = !!gp.buttons[12]?.pressed;
  const down = !!gp.buttons[13]?.pressed;
  const a    = !!gp.buttons[0]?.pressed;
  const b    = !!gp.buttons[1]?.pressed;

  if (up && !gpPrev.up) triggerAction('jump');
  if (down && !gpPrev.down) triggerAction('duck');
  if (a && !gpPrev.a) triggerAction('jump');
  if (b && !gpPrev.b) triggerAction('duck');

  gpPrev = { up, down, a, b };
}

/* -------------------------
   Init
------------------------- */
async function initJD(){
  setHubLinks();

  if (HHA_CTX.mode && elMode) elMode.value = HHA_CTX.mode;
  if (HHA_CTX.diff && elDiff) elDiff.value = HHA_CTX.diff;
  if (HHA_CTX.duration && elDuration) elDuration.value = String(HHA_CTX.duration);

  if (elPid && HHA_CTX.pid) elPid.value = HHA_CTX.pid;
  if (elGroup && HHA_CTX.group) elGroup.value = HHA_CTX.group;
  if (elNote && HHA_CTX.note) elNote.value = HHA_CTX.note;

  elMode?.addEventListener('change', updateResearchVisibility);
  updateResearchVisibility();

  $('[data-action="start"]')?.addEventListener('click', startGameFromMenu);
  $('[data-action="tutorial"]')?.addEventListener('click', startTutorial);
  $('[data-action="stop-early"]')?.addEventListener('click', ()=> running && endGame());
  $('[data-action="play-again"]')?.addEventListener('click', startGameFromMenu);
  $$('[data-action="back-menu"]').forEach(btn=> btn.addEventListener('click', ()=> showView('menu')));

  // ActionBar (แก้กดไม่ได้)
  $('[data-action="jump"]')?.addEventListener('click', ()=> triggerAction('jump'));
  $('[data-action="duck"]')?.addEventListener('click', ()=> triggerAction('duck'));

  window.addEventListener('keydown', handleKeyDown, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false});

  await ensureVrUi();
  window.addEventListener('hha:shoot', onHhaShoot);

  // reminder (research)
  if ((HHA_CTX.mode === 'research' || elMode?.value === 'research') && !HHA_CTX.log){
    console.warn('Jump-Duck: research mode but no ?log= endpoint. Remember to deploy Apps Script WebApp.');
  }

  showView('menu');
}

window.JD_EXPORT = { getState(){ return state ? JSON.parse(JSON.stringify(state)) : null; } };
window.addEventListener('DOMContentLoaded', initJD);