// === /fitness/js/jump-duck.js — Jump-Duck (Boss 3-Phase + AI Prediction + ML/DL hooks) v20260207a ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* -------------------------
   FATAL helpers
------------------------- */
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
   HHA ctx / params
------------------------- */
function getQS(){ try { return new URL(location.href).searchParams; } catch { return new URLSearchParams(); } }
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
  // optional: dl model url
  dl: qsGet('dl','') // e.g. dl=models/jd/model.json
};

function detectView(){
  if (HHA_CTX.view) return HHA_CTX.view; // NO override
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
   Optional: auto-load VR UI if WebXR exists
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
   Seeded RNG
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

const elHudPhaseFill = $('#hud-phase-fill');
const elHudPhaseText = $('#hud-phase-text');
const elHudBossFill  = $('#hud-boss-fill');
const elHudBossText  = $('#hud-boss-text');

const elPlayArea  = $('#jd-play-area');
const elAvatar    = $('#jd-avatar');
const elObsHost   = $('#jd-obstacles');
const elJudge     = $('#jd-judge');

const elTeleWrap  = $('#jd-telegraph');
const elTeleAct   = $('#jd-telegraph-action');
const elTeleTip   = $('#jd-telegraph-tip');

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

// Phase by time progress (1/2) then Boss system
const PHASE_THRESH = [0.33, 0.70];

const SPAWN_X  = 100;
const CENTER_X = 24;
const MISS_X   = 4;

/* -------------------------
   State
------------------------- */
let running = false;
let state = null;
let rafId = null;
let lastFrame = null;
let judgeTimer = null;

let lastAction = null; // {type:'jump'|'duck', time:number}
let nextObstacleId = 1;

/* -------------------------
   AI / ML / DL
   - Online ML: logistic regression (tiny) predicts which action will "challenge" fairly
   - DL hook: optional TFJS model (if provided)
------------------------- */
function sigmoid(x){ return 1/(1+Math.exp(-x)); }

function createOnlineLogit(){
  // weights for features => p(duck)
  let w = [0, 0, 0, 0, 0, 0, 0]; // bias + 6 feats
  let lr = 0.06;

  function feats(ctx){
    // ctx: {phase, streakMiss, missJump, missDuck, lastNeed, lastRT, combo}
    const total = ctx.missJump + ctx.missDuck + 1;
    const missImb = (ctx.missDuck - ctx.missJump) / total; // -1..1
    const lastNeedDuck = (ctx.lastNeed === 'duck') ? 1 : 0;
    const rtN = Math.max(-1, Math.min(1, (ctx.lastRT - 220) / 180)); // roughly -1..1
    const streakN = Math.max(0, Math.min(1, ctx.streakMiss / 4));
    const phaseN = (ctx.phase - 1) / 2; // 0..1
    const comboN = Math.max(0, Math.min(1, (ctx.combo || 0) / 10));
    return [1, missImb, lastNeedDuck, rtN, streakN, phaseN, comboN];
  }

  function predictPduck(ctx){
    const x = feats(ctx);
    let z = 0;
    for (let i=0;i<w.length;i++) z += w[i]*x[i];
    return sigmoid(z);
  }

  function train(ctx, yDuck){
    // yDuck: 1 if duck should be more likely (e.g., player strong at jump) — we use "desired challenge"
    const x = feats(ctx);
    const p = predictPduck(ctx);
    const err = (yDuck ? 1 : 0) - p;
    for (let i=0;i<w.length;i++){
      w[i] += lr * err * x[i];
    }
  }

  function getWeights(){ return w.slice(); }

  return { predictPduck, train, getWeights };
}

function createAIPredictor(){
  const mem = {
    lastNeed: null,
    streakMiss: 0,
    missJump: 0,
    missDuck: 0,
    lastRT: 220,
    wrongAction: 0,
    combo: 0,
  };

  const logit = createOnlineLogit();

  // optional DL model (tfjs) — lazy
  let dl = { ok:false, model:null, lastTry:0 };

  async function ensureDL(){
    if (!HHA_CTX.dl) return false;
    const now = performance.now();
    if (dl.ok) return true;
    if (now - dl.lastTry < 5000) return false;
    dl.lastTry = now;

    try{
      // load tfjs only if needed
      if (!window.tf){
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
        await new Promise((res,rej)=>{ s.onload=res; s.onerror=()=>rej(new Error('tfjs load fail')); document.head.appendChild(s); });
      }
      if (!window.tf?.loadLayersModel) return false;
      dl.model = await window.tf.loadLayersModel(HHA_CTX.dl);
      dl.ok = !!dl.model;
      return dl.ok;
    }catch(e){
      console.warn('DL model disabled:', e);
      dl.ok = false;
      dl.model = null;
      return false;
    }
  }

  function onHit(needType, rt, phase){
    mem.streakMiss = 0;
    mem.lastNeed = needType;
    if (Number.isFinite(rt)) mem.lastRT = 0.85*mem.lastRT + 0.15*rt;
    mem.combo++;
    mem.combo = Math.min(mem.combo, 30);

    // train: ถ้าผู้เล่น "แม่น" ด้านหนึ่ง เราเพิ่มโอกาสอีกด้านเล็กน้อยเพื่อบาลานซ์
    // heuristically: if needType was hit, we might want to challenge with opposite a bit
    const yDuck = (needType === 'jump'); // ถ้าผู้เล่นเพิ่งทำ jump ถูก -> ค่อยเพิ่ม duck
    logit.train(snapshot(phase), yDuck);
  }

  function onMiss(needType, phase, reason){
    mem.streakMiss++;
    mem.lastNeed = needType;
    mem.combo = 0;

    if (needType === 'jump') mem.missJump++;
    else mem.missDuck++;

    if (reason === 'wrong') mem.wrongAction++;

    // train: ถ้าพลาดด้านใด ให้ลดการออกด้านนั้นลงนิดเพื่อความแฟร์ (แต่ไม่ง่ายจนเดาได้)
    const yDuck = (needType === 'duck') ? 0 : 1;
    logit.train(snapshot(phase), yDuck);
  }

  function snapshot(phase){
    return {
      phase,
      streakMiss: mem.streakMiss,
      missJump: mem.missJump,
      missDuck: mem.missDuck,
      lastNeed: mem.lastNeed,
      lastRT: mem.lastRT,
      combo: mem.combo
    };
  }

  async function pickType(phase){
    // base explore
    const eps = (phase === 1 ? 0.22 : phase === 2 ? 0.14 : 0.10);
    if (RNG() < eps){
      return (RNG() < 0.5) ? 'high' : 'low';
    }

    // DL model if available
    const useDL = await ensureDL();
    if (useDL && dl.model && window.tf){
      try{
        const ctx = snapshot(phase);
        const x = window.tf.tensor2d([[
          (ctx.phase-1)/2,
          Math.min(1, ctx.streakMiss/4),
          (ctx.missDuck-ctx.missJump)/(ctx.missDuck+ctx.missJump+1),
          Math.max(-1, Math.min(1, (ctx.lastRT-220)/180)),
          Math.min(1, (ctx.combo||0)/10),
          (ctx.lastNeed==='duck')?1:0
        ]]);
        const y = dl.model.predict(x);
        const p = (await y.data())[0];
        x.dispose(); y.dispose();
        return (p >= 0.5) ? 'high' : 'low';
      }catch(e){
        // fallback
      }
    }

    // Online ML
    const pDuck = logit.predictPduck(snapshot(phase)); // p(duck) => 'high'
    const r = RNG();
    return (r < pDuck) ? 'high' : 'low';
  }

  function adjustSpawnInterval(ms, phase, mode){
    let out = ms;

    // training: เร้าใจขึ้นตาม phase
    if (mode === 'training'){
      if (phase === 2) out *= 0.95;
      if (phase === 3) out *= 0.88;
      if (mem.streakMiss >= 2) out *= 1.10; // ผ่อนเล็กน้อยถ้าพลาดติด
      if (mem.wrongAction >= 3) out *= 1.06;
    }

    // clamp
    out = Math.max(520, Math.min(1700, out));
    return out;
  }

  function getHint(phase){
    if (phase === 3 && mem.streakMiss >= 2){
      return 'บอสทิป: อ่าน “NEXT” แล้วทำให้ถูกต่อเนื่อง เพื่อตัด HP 🔥';
    }
    if (mem.streakMiss >= 2){
      return 'ทิป: กดก่อนถึงเส้นชนเล็กน้อย จะติด PERFECT ง่ายขึ้น ✨';
    }
    if (mem.lastRT > 260){
      return 'ทิป: ลองกดเร็วขึ้นอีกนิด จะคอมโบลื่นขึ้น 🔥';
    }
    return '';
  }

  return { onHit, onMiss, pickType, adjustSpawnInterval, getHint, snapshot };
}

const AI = createAIPredictor();

/* -------------------------
   Views
------------------------- */
function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name === 'menu')   viewMenu?.classList.remove('jd-hidden');
  if (name === 'play')   viewPlay?.classList.remove('jd-hidden');
  if (name === 'result') viewResult?.classList.remove('jd-hidden');
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
  if (mode === 'training') return 'Training';
  if (mode === 'test') return 'Test';
  if (mode === 'research') return 'Research';
  if (mode === 'tutorial') return 'Tutorial';
  return 'Play';
}

/* -------------------------
   Hub backlinks
------------------------- */
function setHubLinks(){
  const hub = HHA_CTX.hub || '';
  if (!hub) return;
  [backHubMenu, backHubPlay, backHubResult].forEach(a=>{
    if (a) a.href = hub;
  });
}

/* -------------------------
   Participant meta
------------------------- */
function updateResearchVisibility(){
  const mode = (elMode?.value) || 'training';
  if (!elResearchBlock) return;
  if (mode === 'research') elResearchBlock.classList.remove('jd-hidden');
  else elResearchBlock.classList.add('jd-hidden');
}
function collectParticipant(metaMode){
  if (metaMode !== 'research') return {id:'', group:'', note:''};
  return {
    id: (elPid?.value || HHA_CTX.pid || '').trim(),
    group: (elGroup?.value || HHA_CTX.group || '').trim(),
    note: (elNote?.value || HHA_CTX.note || '').trim()
  };
}

/* -------------------------
   Telegraph
------------------------- */
function telegraphShow(nextNeed, tip=''){
  if (!elTeleWrap || !elTeleAct) return;
  elTeleAct.textContent = (nextNeed === 'jump') ? 'JUMP ⬆' : 'DUCK ⬇';
  if (elTeleTip) elTeleTip.textContent = tip || '';
  elTeleWrap.classList.remove('jd-hidden');
  elTeleWrap.classList.add('show');
  setTimeout(()=> elTeleWrap?.classList.remove('show'), 240);
}
function telegraphHide(){
  elTeleWrap?.classList.add('jd-hidden');
}

/* -------------------------
   Boss system (3 phases inside phase 3)
------------------------- */
const BOSS = {
  // total boss HP is split into 3 sub-phases
  hpTotalByDiff: { easy: 18, normal: 24, hard: 30 },
  hpPhaseCut: [0.66, 0.33], // when hp ratio drops below => advance boss sub-phase
  teleLeadMs: 520,
  perfectWindowMs: 95,
  bossSpawnMinGapMs: 780,
  chainLenByDiff: { easy: 4, normal: 5, hard: 6 },
};

function bossInit(diffKey){
  const hpT = BOSS.hpTotalByDiff[diffKey] || BOSS.hpTotalByDiff.normal;
  return {
    active: false,
    hp: hpT,
    hpTotal: hpT,
    sub: 1,              // 1..3
    chain: [],           // required action chain
    chainIdx: 0,
    lastBossSpawnAt: 0,
    lastTeleAt: 0,
    rage: 0              // increases as hp drops
  };
}

function bossUpdateSub(boss){
  const r = boss.hp / boss.hpTotal;
  boss.sub = (r <= BOSS.hpPhaseCut[1]) ? 3 : (r <= BOSS.hpPhaseCut[0] ? 2 : 1);
  boss.rage = 1 - r; // 0..1
}

function bossBuildChain(diffKey, sub){
  const len = (BOSS.chainLenByDiff[diffKey] || 5) + (sub-1); // grows
  const chain = [];
  let last = null;

  for (let i=0;i<len;i++){
    // pattern: alternate more in sub2/sub3
    let need;
    if (sub >= 2 && last){
      need = (last === 'jump') ? 'duck' : 'jump';
      // sometimes break alternation for surprise
      if (sub === 3 && RNG() < 0.22) need = (RNG()<0.5?'jump':'duck');
    }else{
      need = (RNG() < 0.5) ? 'jump' : 'duck';
    }
    chain.push(need);
    last = need;
  }
  return chain;
}

/* -------------------------
   Game
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

  RNG = mulberry32(getSeed()); // deterministic if seed
  nextObstacleId = 1;

  const now = performance.now();
  state = {
    sessionId: makeSessionId(),
    mode,
    diffKey,
    cfg0,
    durationMs,
    isTutorial,

    startTime: now,
    elapsedMs: 0,
    remainingMs: durationMs,

    stability: 100,
    minStability: 100,

    nextSpawnAt: now + 650,
    obstacles: [],
    obstaclesSpawned: 0,

    hits: 0,
    miss: 0,

    jumpHit:0, duckHit:0,
    jumpMiss:0, duckMiss:0,

    combo: 0,
    maxCombo: 0,
    score: 0,
    hitRTs: [],

    participant: collectParticipant(mode),
    ctx: { ...HHA_CTX },

    // boss
    boss: bossInit(diffKey),
  };

  // UI reset
  elObsHost && (elObsHost.innerHTML = '');
  elAvatar && elAvatar.classList.remove('jump','duck');
  telegraphHide();

  elHudMode && (elHudMode.textContent = modeLabel(mode));
  elHudDiff && (elHudDiff.textContent = diffKey);
  elHudDur  && (elHudDur.textContent  = (durationMs/1000|0)+'s');
  elHudStab && (elHudStab.textContent = '100%');
  elHudObs  && (elHudObs.textContent  = '0 / 0');
  elHudScore&& (elHudScore.textContent= '0');
  elHudCombo&& (elHudCombo.textContent= '0');
  elHudTime && (elHudTime.textContent = (durationMs/1000).toFixed(1));

  // boss HUD init
  if (elHudPhaseFill) elHudPhaseFill.style.transform = 'scaleX(0)';
  if (elHudPhaseText) elHudPhaseText.textContent = '1/3';
  if (elHudBossFill)  elHudBossFill.style.transform = 'scaleX(0)';
  if (elHudBossText)  elHudBossText.textContent = '—';

  running = true;
  lastFrame = now;

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
  const hits  = state.hits || 0;
  const acc   = total ? hits/total : 0;
  const rtMean = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  resMode && (resMode.textContent = modeLabel(state.mode));
  resDiff && (resDiff.textContent = state.diffKey);
  resDuration && (resDuration.textContent = (state.durationMs/1000|0)+'s');
  resTotalObs && (resTotalObs.textContent = String(total));
  resHits && (resHits.textContent = String(state.hits));
  resMiss && (resMiss.textContent = String(state.miss));

  resJumpHit && (resJumpHit.textContent = String(state.jumpHit));
  resDuckHit && (resDuckHit.textContent = String(state.duckHit));
  resJumpMiss&& (resJumpMiss.textContent= String(state.jumpMiss));
  resDuckMiss&& (resDuckMiss.textContent= String(state.duckMiss));

  resAcc && (resAcc.textContent = (acc*100).toFixed(1)+' %');
  resRTMean && (resRTMean.textContent = rtMean ? rtMean.toFixed(0)+' ms' : '-');
  resStabilityMin && (resStabilityMin.textContent = state.minStability.toFixed(1)+' %');
  resScore && (resScore.textContent = String(Math.round(state.score)));

  if (resRank){
    let rank = 'C';
    const stab = state.minStability;
    if (acc >= 0.90 && stab >= 85) rank='S';
    else if (acc >= 0.80 && stab >= 75) rank='A';
    else if (acc >= 0.65 && stab >= 60) rank='B';
    else if (acc < 0.40 || stab < 40)   rank='D';
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
  const dt = ts - (lastFrame||ts);
  lastFrame = ts;

  state.elapsedMs = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

  const progress = Math.min(1, state.elapsedMs / state.durationMs);
  const phase = getPhase(progress);

  elHudTime && (elHudTime.textContent = (state.remainingMs/1000).toFixed(1));

  if (state.elapsedMs >= state.durationMs){
    endGame();
    return;
  }

  // phase HUD
  if (elHudPhaseFill) elHudPhaseFill.style.transform = `scaleX(${progress.toFixed(3)})`;
  if (elHudPhaseText) elHudPhaseText.textContent = `${phase}/3`;

  // boss activation
  if (phase === 3 && !state.boss.active){
    state.boss.active = true;
    state.boss.chain = bossBuildChain(state.diffKey, 1);
    state.boss.chainIdx = 0;
    bossUpdateSub(state.boss);
    showJudge('👾 BOSS INCOMING!', 'combo');
    playSfx('jd-sfx-boss');
  }

  // spawn schedule
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts, phase);
    let interval = state.cfg0.spawnMs;

    if (state.mode === 'training'){
      const factor = 1 - 0.30*progress;
      interval = interval * Math.max(0.58, factor);
      interval = AI.adjustSpawnInterval(interval, phase, state.mode);
    }
    // boss mode: slightly faster but controlled by boss rage
    if (phase === 3 && state.boss.active){
      bossUpdateSub(state.boss);
      interval *= (1 - 0.12*state.boss.rage);
      interval = Math.max(520, interval);
    }

    state.nextSpawnAt += interval;
  }

  updateObstacles(dt, ts, phase, progress);
  pollGamepad(ts);

  // HUD
  elHudStab && (elHudStab.textContent = state.stability.toFixed(1)+'%');
  elHudObs && (elHudObs.textContent = `${state.hits} / ${state.obstaclesSpawned}`);
  elHudScore && (elHudScore.textContent = String(Math.round(state.score)));
  elHudCombo && (elHudCombo.textContent = String(state.combo));

  // boss HUD
  if (phase === 3 && state.boss.active){
    const r = state.boss.hpTotal ? (state.boss.hp / state.boss.hpTotal) : 0;
    if (elHudBossFill) elHudBossFill.style.transform = `scaleX(${Math.max(0,Math.min(1,r)).toFixed(3)})`;
    if (elHudBossText) elHudBossText.textContent = `HP ${state.boss.hp}/${state.boss.hpTotal} · Sub ${state.boss.sub}`;
  }else{
    if (elHudBossFill) elHudBossFill.style.transform = 'scaleX(0)';
    if (elHudBossText) elHudBossText.textContent = '—';
  }

  // micro-tip
  const tip = AI.getHint(phase);
  if (tip && (state.elapsedMs % 7000 < 30)){
    showJudge(tip, 'combo');
  }

  rafId = requestAnimationFrame(loop);
}

/* -------------------------
   Obstacles
------------------------- */
async function spawnObstacle(ts, phase){
  if (!elObsHost || !state) return;

  // spacing guard
  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 70) return;

  // boss logic
  if (phase === 3 && state.boss.active){
    const boss = state.boss;
    bossUpdateSub(boss);

    // telegraph chain
    const nextNeed = boss.chain[boss.chainIdx] || ((RNG()<0.5)?'jump':'duck');
    const now = performance.now();
    if (now - boss.lastTeleAt > BOSS.teleLeadMs){
      const tip = (boss.sub === 3) ? 'เร็วขึ้น + อย่าพลาดติด!' : '';
      telegraphShow(nextNeed, tip);
      boss.lastTeleAt = now;
    }

    // boss spawn rate cap
    if (now - boss.lastBossSpawnAt < BOSS.bossSpawnMinGapMs * (1 - 0.25*boss.rage)) {
      // fallback: spawn normal obstacle to keep flow
      const t = await AI.pickType(phase);
      makeOne(t, ts, { variant: (RNG()<0.08?'gold':'') });
      return;
    }
    boss.lastBossSpawnAt = now;

    // spawn boss obstacle representing the required action in chain
    const type = (nextNeed === 'duck') ? 'high' : 'low';
    const variant = (boss.sub === 1) ? 'boss'
                  : (boss.sub === 2) ? (RNG()<0.18 ? 'fake' : 'boss')
                  : (RNG()<0.22 ? 'fake' : 'boss');

    makeOne(type, ts, { variant, bossNeed: nextNeed, isBoss:true });

    // sometimes spawn a “decoy” in sub2/sub3
    if (boss.sub >= 2 && RNG() < 0.22){
      setTimeout(()=>{
        if (!running || !state) return;
        const dec = (RNG()<0.5)?'high':'low';
        makeOne(dec, performance.now(), { variant:'fake', isBoss:false });
      }, 120);
    }
    return;
  }

  // phase 1-2 normal: use AI pick
  const t = await AI.pickType(phase);
  const variant = (phase === 2 && RNG() < 0.08) ? 'gold' : '';
  makeOne(t, ts, { variant });
}

function makeOne(type, ts, opt = {}){
  const isHigh = (type === 'high');
  const need = isHigh ? 'duck' : 'jump';

  const el = document.createElement('div');
  el.className = 'jd-obstacle ' + (isHigh ? 'jd-obstacle--high' : 'jd-obstacle--low');
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

  // variants
  if (opt.variant === 'boss') el.classList.add('boss');
  if (opt.variant === 'fake') el.classList.add('fake');
  if (opt.variant === 'gold') el.classList.add('gold');
  if (opt.isBoss) el.classList.add('boss');

  elObsHost.appendChild(el);

  state.obstacles.push({
    id: nextObstacleId++,
    type,
    need,
    x: SPAWN_X,
    createdAt: ts,
    resolved:false,
    element: el,
    isBoss: !!opt.isBoss,
    bossNeed: opt.bossNeed || '',
    variant: opt.variant || '',
  });

  state.obstaclesSpawned++;
  playSfx('jd-sfx-beep');
}

function updateObstacles(dt, now, phase, progress){
  const cfg = state.cfg0;
  let speed = cfg.speed;

  // speed tuning by phase
  if (state.mode === 'training'){
    if (phase === 2) speed *= 1.12;
    if (phase === 3) speed *= 1.22;
    speed *= (1 + 0.18*progress);
  }
  // boss rage
  if (phase === 3 && state.boss.active){
    speed *= (1 + 0.18*state.boss.rage);
  }

  const move = speed * (dt/1000);
  const keep = [];

  for (const obs of state.obstacles){
    obs.x -= move;
    if (obs.element) obs.element.style.left = obs.x + '%';

    // HIT window
    if (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6){
      const a = lastAction;
      if (a && a.time){
        const rt = Math.abs(a.time - now);
        const match = (a.type === obs.need);

        // PERFECT stricter in boss
        const perfectWin = (phase === 3 && obs.isBoss) ? Math.max(70, Math.min(110, BOSS.perfectWindowMs + (20*(1-state.boss.rage)))) : 999999;

        if (match && rt <= cfg.hitWinMs){
          obs.resolved = true;

          state.hits++;
          state.combo++;
          state.maxCombo = Math.max(state.maxCombo, state.combo);

          // scoring
          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const phaseM = (phase === 3) ? 1.18 : (phase === 2 ? 1.08 : 1.0);
          const goldM  = (obs.variant === 'gold') ? 1.35 : 1.0;
          const perfectM = (rt <= perfectWin) ? 1.22 : 1.0;
          const gain = Math.round(cfg.score * comboM * phaseM * goldM * perfectM);
          state.score += gain;

          if (obs.need === 'jump') state.jumpHit++; else state.duckHit++;
          state.stability = Math.min(100, state.stability + cfg.stabGain);
          state.minStability = Math.min(state.minStability, state.stability);

          state.hitRTs.push(rt);
          AI.onHit(obs.need, rt, phase);

          // boss chain / HP
          if (phase === 3 && state.boss.active && obs.isBoss){
            const boss = state.boss;
            const expected = boss.chain[boss.chainIdx] || obs.need;

            if (a.type === expected){
              boss.chainIdx++;
              // reduce HP: perfect does more
              const dmg = (rt <= perfectWin) ? 2 : 1;
              boss.hp = Math.max(0, boss.hp - dmg);

              // if chain finished, rebuild harder chain
              if (boss.chainIdx >= boss.chain.length){
                bossUpdateSub(boss);
                boss.chain = bossBuildChain(state.diffKey, boss.sub);
                boss.chainIdx = 0;
                showJudge(`BOSS CHAIN CLEAR! 💥 (-${dmg}HP)`, 'combo');
              }else{
                showJudge((rt <= perfectWin) ? 'PERFECT! ⚡' : 'GOOD! 🔥', 'combo');
              }

              // win condition
              if (boss.hp <= 0){
                showJudge('🏆 BOSS DOWN! AMAZING!', 'combo');
                playSfx('jd-sfx-combo');
                // bonus end: give stability + score and end
                state.score += 250;
                state.stability = Math.min(100, state.stability + 12);
                setTimeout(()=> endGame(), 420);
              }
            }else{
              // should not happen (match already checked), but safe
            }
          }else{
            if (state.combo >= 8){
              showJudge('COMBO x'+state.combo+' 🔥', 'combo');
              playSfx('jd-sfx-combo');
            }else{
              showJudge(obs.need === 'jump' ? 'JUMP ดีมาก 🦘' : 'DUCK ทันเวลา 🛡️', 'ok');
            }
          }

          obs.element && obs.element.remove();
          obs.element = null;
          playSfx('jd-sfx-hit');
          continue;
        }

        // Wrong action in boss sub2/sub3: ลงโทษชัดเจน
        if (!match && rt <= cfg.hitWinMs && (phase === 3 && obs.isBoss)){
          // treat as miss with reason wrong
          obs.resolved = true;
          doMiss(obs, 'wrong', phase);
          continue;
        }
      }
    }

    // MISS
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;
      doMiss(obs, 'late', phase);
      obs.element && obs.element.remove();
      obs.element = null;
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

function doMiss(obs, reason, phase){
  const cfg = state.cfg0;

  state.miss++;
  state.combo = 0;

  if (obs.need === 'jump') state.jumpMiss++; else state.duckMiss++;
  state.stability = Math.max(0, state.stability - cfg.stabDmg * (phase === 3 ? 1.12 : 1.0));
  state.minStability = Math.min(state.minStability, state.stability);

  AI.onMiss(obs.need, phase, reason);

  // boss penalty: reset chain index slightly (not full wipe to keep “fair but tense”)
  if (phase === 3 && state.boss.active && obs.isBoss){
    const boss = state.boss;
    boss.chainIdx = Math.max(0, boss.chainIdx - 1);
    showJudge(reason === 'wrong' ? 'WRONG! อ่าน NEXT ให้ไว ⚠️' : 'MISS! อย่าพลาดติด 🔥', 'miss');
  }else{
    showJudge('MISS ลองใหม่อีกที ✨', 'miss');
  }

  playSfx('jd-sfx-miss');
  elPlayArea?.classList.add('shake');
  setTimeout(()=> elPlayArea?.classList.remove('shake'), 180);
}

/* -------------------------
   Input (PC/Mobile/tap + VRUI shoot)
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

/* -------------------------
   Gamepad
------------------------- */
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

  // prefill menu from URL
  if (HHA_CTX.mode && elMode) elMode.value = HHA_CTX.mode;
  if (HHA_CTX.diff && elDiff) elDiff.value = HHA_CTX.diff;
  if (HHA_CTX.duration && elDuration) elDuration.value = String(HHA_CTX.duration);

  // research prefill
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

  // action pad buttons
  $('[data-action="jump"]')?.addEventListener('click', ()=> triggerAction('jump'));
  $('[data-action="duck"]')?.addEventListener('click', ()=> triggerAction('duck'));

  window.addEventListener('keydown', handleKeyDown, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false});

  // VR UI integration
  await ensureVrUi();
  window.addEventListener('hha:shoot', onHhaShoot);

  showView('menu');
}

// export (debug/research)
window.JD_EXPORT = {
  getState(){ return state ? JSON.parse(JSON.stringify(state)) : null; },
  getAI(){ try { return { snap: AI.snapshot ? AI.snapshot(0) : null }; } catch { return null; } }
};

window.addEventListener('DOMContentLoaded', initJD);