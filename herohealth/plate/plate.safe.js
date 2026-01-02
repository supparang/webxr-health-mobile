// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION (HHA Standard + VR-feel + Plate Rush + Safe Spawn + AI Hooks)
// ✅ Play: adaptive ON (policy-controlled)
// ✅ Study/Research: deterministic seed + adaptive OFF (policy-controlled)
// ✅ AI Coach Director: explainable micro-tips + rate-limit (policy-controlled)
// ✅ AI Difficulty Director hooks (explainable) + logging
// ✅ AI Pattern hooks (seeded patterns) + logging
// ✅ Aim assist hooks + hha:shoot (crosshair) + strict cVR mode
// ✅ End-window FX (3s) (policy-controlled)
// ✅ End summary: localStorage HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY
// ✅ Pending queue: HHA_PENDING_SESSIONS resend on next load
// ✅ Flush-hardened: before end/back hub/reload/pagehide/hidden
// ✅ PATCH B: Layout-stable spawn + resize/enterVR reflow + look-shift compensated spawn
// ✅ PATCH B: target "แว๊บ" ลดลง (spawn after settle) + clamp within viewport

'use strict';

// ------------------------- Utilities -------------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v = Number(v)||0; return v<a?a : (v>b?b:v); }
function nowMs(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }
function qs(id){ return DOC.getElementById(id); }
function on(el, ev, fn, opt){ if(el) el.addEventListener(ev, fn, opt||false); }
function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}
function setText(id, txt){
  const el = qs(id);
  if(el) el.textContent = String(txt);
}
function fmtPct(x){ x = Number(x)||0; return `${Math.round(x)}%`; }

// Seeded RNG (mulberry32)
function mulberry32(seed){
  let t = (seed >>> 0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)] || arr[0]; }
function uid(){
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

// ------------------------- HHA Standard: storage -------------------------
const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';
const LS_PENDING = 'HHA_PENDING_SESSIONS';

function loadJson(key, fallback){
  try{
    const s = localStorage.getItem(key);
    if(!s) return fallback;
    return JSON.parse(s);
  }catch(e){ return fallback; }
}
function saveJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch(e){}
}

// pending queue
function loadPending(){
  const q = loadJson(LS_PENDING, []);
  return Array.isArray(q) ? q : [];
}
function savePending(q){
  const arr = Array.isArray(q) ? q : [];
  while(arr.length > 20) arr.shift();
  saveJson(LS_PENDING, arr);
}
function enqueuePending(summaryFlat, reason){
  try{
    if(!summaryFlat) return;
    const q = loadPending();
    q.push({ ts: Date.now(), reason: reason || 'pending', summaryFlat });
    savePending(q);
  }catch(e){}
}
function dropPendingFirst(){
  const q = loadPending();
  q.shift();
  savePending(q);
}

// ------------------------- Query params / mode -------------------------
const URLX = new URL(location.href);
const hubUrl = URLX.searchParams.get('hub') || '';
const runRaw = (URLX.searchParams.get('run') || URLX.searchParams.get('runMode') || 'play').toLowerCase();
const diff   = (URLX.searchParams.get('diff') || 'normal').toLowerCase();
const timePlannedSec = clamp(URLX.searchParams.get('time') || 90, 20, 9999);
const seedParam = URLX.searchParams.get('seed');

const isStudy = (runRaw === 'study' || runRaw === 'research');
const runMode = isStudy ? 'study' : 'play';

const DEFAULT_STUDY_SEED = 13579;
const seed =
  isStudy ? (Number(seedParam)||DEFAULT_STUDY_SEED) :
  (seedParam != null ? (Number(seedParam)||DEFAULT_STUDY_SEED) : (Date.now() ^ (Math.random()*1e9)));

const rng = mulberry32(seed);

// view / cVR strict
const view = (URLX.searchParams.get('view') || '').toLowerCase();
const isCVR = (view === 'cvr' || view === 'cardboard' || view === 'vr');

// pattern query
const pattern = (URLX.searchParams.get('pattern') || 'mix').toLowerCase(); // mix|grid|rings|center|edges

// AI coach query
const aiCoachOnQ = (URLX.searchParams.get('ai') || 'on').toLowerCase() !== 'off';

// aim assist query
const assistQ = (URLX.searchParams.get('assist') || '').toLowerCase();
// default: play=on, study=off
const aimAssistOnQ = (assistQ === 'on') ? true : (assistQ === 'off' ? false : (!isStudy));
const aimLockPxQ = clamp(URLX.searchParams.get('lockPx') || (diff==='hard'?32:38), 18, 90);

// policy
const policy = (URLX.searchParams.get('policy') || '').toLowerCase();
// '' | play | research | studyStrict | demo

// ------------------------- Difficulty tuning -------------------------
const DIFF = {
  easy:   { size: 64, lifeMs: 1800, spawnPerSec: 1.5,  junkRate: 0.18, feverUpJunk: 12, feverUpMiss: 8,  feverDownGood: 2.8 },
  normal: { size: 56, lifeMs: 1600, spawnPerSec: 1.85, junkRate: 0.24, feverUpJunk: 14, feverUpMiss: 9,  feverDownGood: 2.4 },
  hard:   { size: 48, lifeMs: 1400, spawnPerSec: 2.2,  junkRate: 0.30, feverUpJunk: 16, feverUpMiss: 10, feverDownGood: 2.0 },
};
const base = DIFF[diff] || DIFF.normal;

// Adaptive (policy-controlled)
let adaptiveOn = !isStudy;
let adapt = { sizeMul: 1.0, spawnMul: 1.0, junkMul: 1.0 };

// ------------------------- Policy resolver (STEP 19) -------------------------
function resolvePolicy(){
  let cfg = {
    name: policy || (isStudy ? 'research' : 'play'),
    aiCoach: !!aiCoachOnQ,
    aimAssist: !!aimAssistOnQ,
    aimPenalty: (diff === 'hard' && isCVR),
    pattern: pattern,
    patternMixAllowed: !isStudy,
    adaptive: adaptiveOn,
    fxOn: true,
  };

  if(cfg.name === 'research' || cfg.name === 'studystrict' || cfg.name === 'studyStrict'){
    cfg.aiCoach = false;
    cfg.aimAssist = false;
    cfg.aimPenalty = false;
    cfg.patternMixAllowed = false;
    if(cfg.pattern === 'mix') cfg.pattern = 'grid';
    cfg.adaptive = false;
    cfg.fxOn = false;
  }

  if(cfg.name === 'demo'){
    cfg.aiCoach = true;
    cfg.aimAssist = true;
    cfg.aimPenalty = false;
    cfg.patternMixAllowed = true;
    cfg.adaptive = true;
    cfg.fxOn = true;
  }

  if(cfg.name === 'play'){
    cfg.patternMixAllowed = true;
    cfg.adaptive = !isStudy;
  }

  return cfg;
}
const POLICY = resolvePolicy();
adaptiveOn = !!POLICY.adaptive;

// ------------------------- DD / PG Hooks (STEP 15/16) -------------------------
let ddLast = {
  tsMs: 0,
  acc: null,
  rtAvg: null,
  miss: null,
  decision: { sizeMul:1, spawnMul:1, junkMul:1 },
  reason: '',
  mode: runMode,
  diff
};

let pgLast = {
  pattern: POLICY.pattern || pattern,
  pick: POLICY.pattern || pattern,
  reason: 'query',
};

// ------------------------- DOM handles -------------------------
const layer = qs('plate-layer');
const hitFx = qs('hitFx');

const btnStart = qs('btnStart');
const startOverlay = qs('startOverlay');
const btnPause = qs('btnPause');
const hudPaused = qs('hudPaused');
const btnRestart = qs('btnRestart');
const btnBackHub = qs('btnBackHub');
const btnPlayAgain = qs('btnPlayAgain');
const btnEnterVR = qs('btnEnterVR');

const resultBackdrop = qs('resultBackdrop');

const hudTop = qs('hudTop');
const miniPanel = qs('miniPanel');
const coachPanel = qs('coachPanel');
const hudBtns = qs('hudBtns');

if(!layer){
  console.error('[PlateVR] missing #plate-layer');
}

// ------------------------- Minimal FX (CSS injection fallback) -------------------------
(function ensureFxCss(){
  const id = 'plate-safe-fx-css';
  if(DOC.getElementById(id)) return;
  const st = DOC.createElement('style');
  st.id = id;
  st.textContent = `
    .pfx-shake { animation:pfxShake .18s ease-in-out 0s 2; }
    @keyframes pfxShake { 0%{transform:translate(0,0)} 25%{transform:translate(2px,0)} 50%{transform:translate(-2px,1px)} 75%{transform:translate(1px,-1px)} 100%{transform:translate(0,0)} }
    .pfx-blink { animation:pfxBlink .26s ease-in-out 0s 6; }
    @keyframes pfxBlink { 0%,100%{filter:none} 50%{filter:brightness(1.35)} }
    .pfx-tick { animation:pfxTick .12s linear 0s 1; }
    @keyframes pfxTick { 0%{transform:scale(1)} 50%{transform:scale(1.03)} 100%{transform:scale(1)} }
    #hitFx.pfx-hit-good{opacity:1; background:radial-gradient(circle at center, rgba(34,197,94,.18), transparent 55%);}
    #hitFx.pfx-hit-bad {opacity:1; background:radial-gradient(circle at center, rgba(239,68,68,.18), transparent 55%);}
    body.view-cvr #hudBtns { z-index: 60; }
    body.view-cvr #btnEnterVR { z-index: 70; }
    body.view-cvr #hudTop, body.view-cvr #miniPanel, body.view-cvr #coachPanel { z-index: 55; }
  `;
  DOC.head.appendChild(st);
})();

function fxPulse(kind){
  if(!hitFx) return;
  hitFx.classList.remove('pfx-hit-good','pfx-hit-bad');
  hitFx.classList.add(kind === 'bad' ? 'pfx-hit-bad' : 'pfx-hit-good');
  clearTimeout(fxPulse._t);
  fxPulse._t = setTimeout(()=>{ hitFx.classList.remove('pfx-hit-good','pfx-hit-bad'); }, 140);
}
function fxShake(){
  DOC.body.classList.remove('pfx-shake');
  void DOC.body.offsetWidth;
  DOC.body.classList.add('pfx-shake');
  clearTimeout(fxShake._t);
  fxShake._t = setTimeout(()=>DOC.body.classList.remove('pfx-shake'), 450);
}
function fxBlink(){
  DOC.body.classList.remove('pfx-blink');
  void DOC.body.offsetWidth;
  DOC.body.classList.add('pfx-blink');
  clearTimeout(fxBlink._t);
  fxBlink._t = setTimeout(()=>DOC.body.classList.remove('pfx-blink'), 1800);
}
function fxTick(){
  DOC.body.classList.remove('pfx-tick');
  void DOC.body.offsetWidth;
  DOC.body.classList.add('pfx-tick');
  clearTimeout(fxTick._t);
  fxTick._t = setTimeout(()=>DOC.body.classList.remove('pfx-tick'), 160);
}

function playTickSound(){
  try{
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if(!AC) return;
    const ctx = playTickSound._ctx || (playTickSound._ctx = new AC());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    g.gain.value = 0.03;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.03);
  }catch(e){}
}

// ------------------------- VR-feel look (gyro + drag) -------------------------
let look = { x:0, y:0, dragging:false, lastX:0, lastY:0 };
let gyro = { gx:0, gy:0, ok:false };

// PATCH B: keep last applied shift (for spawn compensation)
let lookShift = { x:0, y:0 };

// deterministic sim time (study)
let simMs = 0;
function gameNowMs(){
  return isStudy ? simMs : nowMs();
}

function computeLookShift(){
  const maxX = 24, maxY = 22;
  const x = clamp(look.x + gyro.gx, -maxX, maxX);
  const y = clamp(look.y + gyro.gy, -maxY, maxY);
  return { x, y };
}
function applyLook(){
  if(!layer) return;
  const sh = computeLookShift();
  lookShift.x = sh.x;
  lookShift.y = sh.y;
  layer.style.transform = `translate3d(${sh.x}px, ${sh.y}px, 0)`;
}

function enableGyroIfAllowed(){
  const DO = ROOT.DeviceOrientationEvent;
  if(!DO) return;
  if(typeof DO.requestPermission === 'function'){ return; }
  gyro.ok = true;
  ROOT.addEventListener('deviceorientation', (e)=>{
    const g = Number(e.gamma)||0;
    const b = Number(e.beta)||0;
    gyro.gx = clamp(g/90, -1, 1) * 14;
    gyro.gy = clamp(b/90, -1, 1) * 10;
    applyLook();
  }, { passive:true });
}
function requestGyroPermission(){
  const DO = ROOT.DeviceOrientationEvent;
  if(!DO || typeof DO.requestPermission !== 'function') { enableGyroIfAllowed(); return Promise.resolve(true); }
  return DO.requestPermission().then((res)=>{
    if(res === 'granted'){
      gyro.ok = true;
      ROOT.addEventListener('deviceorientation', (e)=>{
        const g = Number(e.gamma)||0;
        const b = Number(e.beta)||0;
        gyro.gx = clamp(g/90, -1, 1) * 14;
        gyro.gy = clamp(b/90, -1, 1) * 10;
        applyLook();
      }, { passive:true });
      return true;
    }
    return false;
  }).catch(()=>false);
}
function bindDragLook(){
  if(!layer) return;
  on(layer, 'pointerdown', (e)=>{
    look.dragging = true;
    look.lastX = e.clientX;
    look.lastY = e.clientY;
  }, { passive:true });
  on(ROOT, 'pointermove', (e)=>{
    if(!look.dragging) return;
    const dx = (e.clientX - look.lastX);
    const dy = (e.clientY - look.lastY);
    look.lastX = e.clientX;
    look.lastY = e.clientY;
    look.x = clamp(look.x + dx*0.12, -26, 26);
    look.y = clamp(look.y + dy*0.10, -24, 24);
    applyLook();
  }, { passive:true });
  on(ROOT, 'pointerup', ()=>{ look.dragging = false; }, { passive:true });
}

// ------------------------- Safe spawn geometry (avoid HUD overlap) -------------------------
function rectOf(el){
  if(!el) return null;
  const r = el.getBoundingClientRect();
  if(!r || !isFinite(r.width)) return null;
  return { x:r.left, y:r.top, w:r.width, h:r.height, r };
}
function expandRect(rr, pad){
  if(!rr) return rr;
  const p = Number(pad)||0;
  return { x: rr.x - p, y: rr.y - p, w: rr.w + p*2, h: rr.h + p*2 };
}
function intersects(a, b){
  return !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y);
}

// PATCH B: cache layout (debounced)
let layoutCache = {
  W: 360, H: 640,
  playRect: { x:10, y:80, w:340, h:480 },
  noRects: [],
  stamp: 0
};

function viewportSize(){
  const vv = ROOT.visualViewport;
  const W = vv && vv.width ? vv.width : (ROOT.innerWidth || 360);
  const H = vv && vv.height ? vv.height : (ROOT.innerHeight || 640);
  return { W: Math.max(1, Math.round(W)), H: Math.max(1, Math.round(H)) };
}

function buildNoSpawnRects(){
  const rects = [];
  const PAD = 8;
  [hudTop, miniPanel, coachPanel, hudBtns].forEach(el=>{
    const rr = rectOf(el);
    if(rr) rects.push(expandRect(rr, PAD));
  });
  return rects;
}

function getPlayRect(){
  const { W, H } = viewportSize();
  const pad = 10;

  const topR = rectOf(hudTop);
  const miniR = rectOf(miniPanel);
  const btnR = rectOf(hudBtns);

  let top = pad;
  let bottom = H - pad;
  let left = pad;
  let right = W - pad;

  if(topR) top = Math.max(top, topR.y + topR.h + 10);
  if(miniR) top = Math.max(top, miniR.y + miniR.h + 10);
  if(btnR) bottom = Math.min(bottom, btnR.y - 10);

  top = clamp(top, 0, H-40);
  bottom = clamp(bottom, top+40, H);
  left = clamp(left, 0, W-40);
  right = clamp(right, left+40, W);

  return { x:left, y:top, w:(right-left), h:(bottom-top) };
}

function refreshLayout(){
  const { W, H } = viewportSize();
  let playRect = getPlayRect();
  let noRects = buildNoSpawnRects();

  if(playRect.w < 140 || playRect.h < 180){
    // relax coach rect first
    const coachR = rectOf(coachPanel);
    if(coachR){
      noRects = noRects.filter(rr=>{
        const same = Math.abs(rr.x - coachR.x) < 6 && Math.abs(rr.y - coachR.y) < 6;
        return !same;
      });
    }
  }

  layoutCache.W = W;
  layoutCache.H = H;
  layoutCache.playRect = playRect;
  layoutCache.noRects = noRects;
  layoutCache.stamp = nowMs();
}

function refreshLayoutSoon(ms){
  clearTimeout(refreshLayoutSoon._t);
  refreshLayoutSoon._t = setTimeout(()=>{ try{ refreshLayout(); }catch(e){} }, ms||80);
}

// ------------------------- Game State -------------------------
let running = false;
let paused = false;

let tStartMs = 0;
let tLastTickMs = 0;
let tLeftSec = Number(timePlannedSec) || 90;

let score = 0;
let combo = 0;
let comboMax = 0;
let miss = 0;

const groupEmojis = ['🥦','🍎','🐟','🍚','🥑'];
let gCount = [0,0,0,0,0];
let plateHave = [false,false,false,false,false];

let fever = 0;
let shield = 0;
let shieldActive = false;

let nTargetGoodSpawned = 0;
let nTargetJunkSpawned = 0;
let nTargetShieldSpawned = 0;

let nHitGood = 0;
let nHitJunk = 0;
let nHitJunkGuard = 0;
let nExpireGood = 0;

let rtGood = [];
let perfectHits = 0;

const targets = new Map();
let spawnAccum = 0;

// goals
let goalsTotal = 2;
let goalsCleared = 0;
let goalsLocked = { fillPlate:false, accuracy:false };

// minis (STEP 20)
let minisTotal = (diff === 'hard') ? 3 : 2;
let miniCleared = 0;
let miniStage = 0;

let activeGoal = null;
let activeMini = null;

// aim logging (STEP 17)
let nShootEvents = 0;
let nAssistLocks = 0;
let lastAssistTargetKind = '';

// end window fx (STEP 22)
let endFx = { lastSec: null, armed: true };

const GOALS = [
  { key:'fill-plate', title:'เติมจานให้ครบ 5 หมู่', target:5, cur:0, done:false },
  { key:'accuracy',   title:'จบเกมด้วยความแม่นยำ ≥ 80%', target:80, cur:0, done:false },
];

function accuracyPct(){
  const denom = (nHitGood + nHitJunk + nExpireGood);
  if(denom <= 0) return 0;
  return (nHitGood / denom) * 100;
}

function calcGrade(){
  const acc = accuracyPct();
  const m = miss;
  const baseScore = score;

  if(acc >= 95 && m <= 1 && baseScore >= 2200) return 'SSS';
  if(acc >= 92 && m <= 2 && baseScore >= 1800) return 'SS';
  if(acc >= 88 && m <= 3) return 'S';
  if(acc >= 82 && m <= 5) return 'A';
  if(acc >= 72 && m <= 8) return 'B';
  return 'C';
}

function updateHUD(){
  emit('hha:score', {
    game:'plate',
    runMode,
    diff,
    timeLeftSec: tLeftSec,
    score,
    combo,
    comboMax,
    miss,
    plateHave: plateHave.filter(Boolean).length,
    gCount: [...gCount],
    fever,
    shield,
    accuracyGoodPct: accuracyPct(),
    grade: calcGrade(),
  });

  setText('uiScore', score);
  setText('uiCombo', combo);
  setText('uiComboMax', comboMax);
  setText('uiMiss', miss);
  setText('uiPlateHave', plateHave.filter(Boolean).length);
  setText('uiG1', gCount[0]); setText('uiG2', gCount[1]); setText('uiG3', gCount[2]); setText('uiG4', gCount[3]); setText('uiG5', gCount[4]);
  setText('uiAcc', fmtPct(accuracyPct()));
  setText('uiGrade', calcGrade());
  setText('uiTime', Math.ceil(tLeftSec));
  const ff = qs('uiFeverFill');
  if(ff) ff.style.width = `${clamp(fever,0,100)}%`;
  setText('uiShieldN', shield);
}

function coach(msg, mood){
  emit('hha:coach', { game:'plate', msg, mood: mood || 'neutral' });
  const cm = qs('coachMsg');
  if(cm) cm.textContent = msg;
  const img = qs('coachImg');
  if(img){
    const m = mood || 'neutral';
    const map = {
      happy: './img/coach-happy.png',
      neutral:'./img/coach-neutral.png',
      sad: './img/coach-sad.png',
      fever: './img/coach-fever.png',
      warn: './img/coach-neutral.png',
    };
    img.src = map[m] || map.neutral;
  }
}

function judge(text, kind){
  emit('hha:judge', { game:'plate', text, kind: kind||'info' });
}

// ------------------------- AI Coach Director (STEP 14) -------------------------
let aiState = {
  lastSayMs: -1e9,
  cooldownMs: 2600,
  lastKey: '',
  missStreak: 0,
  junkStreak: 0,
  goodStreak: 0,
  lastAccBucket: null,
  lastFeverBucket: null,
  miniFailCount: 0,
};

function bucket(v, step){
  const s = Number(step)||10;
  return Math.floor((Number(v)||0) / s);
}

function sayCoach(key, msg, mood){
  if(!POLICY.aiCoach) return false;

  const t = gameNowMs();
  const cd = aiState.cooldownMs;

  if(t - aiState.lastSayMs < cd) return false;
  if(key && key === aiState.lastKey && (t - aiState.lastSayMs) < (cd * 1.6)) return false;

  aiState.lastSayMs = t;
  aiState.lastKey = key || '';
  coach(msg, mood || 'neutral');
  return true;
}

function aiPulse(context){
  if(!POLICY.aiCoach) return;

  const acc = accuracyPct();
  const feverB = bucket(fever, 20);
  const accB   = bucket(acc, 10);

  if(feverB !== aiState.lastFeverBucket){
    aiState.lastFeverBucket = feverB;
    if(fever >= 85){
      sayCoach('fever_high', 'FEVER สูงมาก! ช้าอีกนิด เลือกยิงเป้าที่ชัวร์ก่อน 🔥', 'fever');
      return;
    }
    if(fever >= 65){
      sayCoach('fever_mid', 'เริ่มร้อนแล้วนะ! ถ้าโดนขยะบ่อยให้รอจังหวะยิง 💡', 'neutral');
      return;
    }
  }

  if(accB !== aiState.lastAccBucket){
    aiState.lastAccBucket = accB;
    if(acc < 70 && (nHitGood + nHitJunk + nExpireGood) >= 10){
      sayCoach('acc_low', 'ความแม่นยังต่ำ ลอง “เล็งแล้วค่อยยิง” และหลีกเลี่ยงขยะก่อนนะ 🎯', 'sad');
      return;
    }
    if(acc >= 90 && (nHitGood >= 8)){
      sayCoach('acc_high', 'แม่นมาก! ต่อไปคุมคอมโบให้ยาว ๆ แล้วคะแนนจะพุ่ง 🚀', 'happy');
      return;
    }
  }

  if(context && context.ev === 'junk_hit'){
    if(fever >= 75){
      sayCoach('junk_fever', 'โดนขยะตอน FEVER สูงจะยิ่งตึง! ลองยิงช้าลง 10% แล้วเลือกเป้าชัวร์ 🛡️', 'fever');
    }else{
      sayCoach('junk', 'ทริค: ถ้าขยะปนเยอะ ให้เล็งเป้าดีที่ “อยู่โล่ง ๆ” ก่อน 👀', 'sad');
    }
    return;
  }

  if(context && context.ev === 'good_miss'){
    if(activeMini && activeMini.key === 'clean-sweep'){
      sayCoach('sweep_miss', 'Clean Sweep ห้ามพลาด GOOD! เลือกยิงเป้ากลางจอ/ใกล้ crosshair ก่อน ✅', 'warn');
    }else{
      sayCoach('miss', 'พลาด GOOD แล้วนะ! รีเซ็ตคอมโบ ลองจับจังหวะก่อนยิง 💡', 'neutral');
    }
    return;
  }

  if(context && context.ev === 'mini_start'){
    const k = context.key || '';
    if(k === 'plate-rush'){
      sayCoach('mini_rush', 'Plate Rush: เร่งเก็บ “หมู่ที่ยังขาด” และห้ามโดนขยะ! ⚡', 'warn');
      return;
    }
    if(k === 'clean-sweep'){
      sayCoach('mini_sweep', 'Clean Sweep: ห้ามปล่อย GOOD หมดอายุ เล็งเร็วแต่ชัวร์ 🧼', 'warn');
      return;
    }
    if(k === 'junk-storm'){
      sayCoach('mini_storm', 'Junk Storm มาแล้ว! โฟกัสหลบขยะ ถ้ามีโล่ให้เก็บไว้ก่อน 🌀', 'fever');
      return;
    }
  }

  if(context && context.ev === 'mini_fail'){
    aiState.miniFailCount++;
    if(aiState.miniFailCount >= 2){
      sayCoach('mini_fail2', 'ไม่เป็นไร! ลอง “ลดความเร็วมือ” แล้วเลือกยิงทีละเป้า จะผ่านง่ายขึ้น 💪', 'sad');
    }else{
      sayCoach('mini_fail', 'พลาดนิดเดียว! รอบหน้าโฟกัสกฎของ MINI แล้วจะผ่าน ✅', 'neutral');
    }
    return;
  }

  if(context && context.ev === 'combo_big'){
    sayCoach('combo', 'คอมโบกำลังสวย! ถ้ารักษาไว้ คะแนนจะไหลแรงมาก ✨', 'happy');
    return;
  }
}

// ------------------------- Mini quests (STEP 20) -------------------------
function makeMiniPlateRush(){
  return {
    key:'plate-rush',
    title:'Plate Rush: ครบ 5 หมู่ใน 8 วิ + ห้ามโดนขยะ',
    forbidJunk:true,
    durationSec: 8,
    startedMs: 0,
    done:false,
    fail:false,
    reason:'',
    snapPlateHave: null,
  };
}
function makeMiniCleanSweep(){
  return {
    key:'clean-sweep',
    title:'Clean Sweep: 10 วิ ห้ามปล่อย GOOD หมดอายุ',
    forbidJunk:false,
    durationSec: 10,
    startedMs: 0,
    done:false,
    fail:false,
    reason:'',
    snapExpireGood: 0,
  };
}
function makeMiniJunkStorm(){
  return {
    key:'junk-storm',
    title:'Junk Storm: 8 วิ ห้ามโดนขยะ (หลบให้รอด)',
    forbidJunk:true,
    durationSec: 8,
    startedMs: 0,
    done:false,
    fail:false,
    reason:'',
  };
}

function nextMiniByStage(stage){
  if(stage === 1) return makeMiniPlateRush();
  if(stage === 2) return makeMiniCleanSweep();
  if(stage === 3 && diff === 'hard') return makeMiniJunkStorm();
  return null;
}
function startNextMini(){
  if(miniStage >= minisTotal) return false;
  miniStage++;
  const m = nextMiniByStage(miniStage);
  if(!m) return false;
  startMini(m);
  return true;
}

function startMini(mini){
  activeMini = mini;
  activeMini.startedMs = gameNowMs();
  activeMini.snapPlateHave = [...plateHave];

  if(activeMini.key === 'clean-sweep'){
    activeMini.snapExpireGood = nExpireGood;
  }

  emit('quest:update', {
    game:'plate',
    goal: activeGoal ? { title: activeGoal.title, cur: activeGoal.cur, target: activeGoal.target, done: activeGoal.done } : null,
    mini: { title: activeMini.title, cur:0, target:activeMini.durationSec, timeLeft: activeMini.durationSec, done:false }
  });
  setText('uiMiniTitle', activeMini.title);
  setText('uiMiniTime', `${activeMini.durationSec}s`);
  setText('uiHint', 'ทริค: อ่านกติกา MINI แล้วโฟกัสให้ถูก!');

  judge('⚡ MINI เริ่มแล้ว!', 'warn');
  aiPulse({ ev:'mini_start', key: activeMini ? activeMini.key : '' });
}

function finishMini(ok, reason){
  if(!activeMini || activeMini.done) return;
  activeMini.done = true;
  activeMini.fail = !ok;
  activeMini.reason = reason || (ok ? 'ok' : 'fail');

  if(ok){
    miniCleared++;
    emit('hha:celebrate', { game:'plate', kind:'mini' });
    sayCoach('mini_win', 'ผ่าน MINI แล้ว! เก่งมาก 😎', 'happy');
    judge('✅ MINI COMPLETE!', 'good');
    shield = clamp(shield + 1, 0, 9);
  }else{
    aiPulse({ ev:'mini_fail', reason });
    judge('❌ MINI FAILED', 'bad');
  }

  activeMini = null;

  // chain minis (only when ok)
  if(ok){
    startNextMini();
  }

  emitQuestUpdate();
}

function miniTimeLeft(){
  if(!activeMini) return null;
  const elapsed = (gameNowMs() - activeMini.startedMs) / 1000;
  return Math.max(0, activeMini.durationSec - elapsed);
}

function emitQuestUpdate(){
  if(activeGoal){
    emit('quest:update', {
      game:'plate',
      goal: { title: activeGoal.title, cur: activeGoal.cur, target: activeGoal.target, done: activeGoal.done },
      mini: activeMini
        ? { title: activeMini.title, cur: 0, target: activeMini.durationSec, timeLeft: miniTimeLeft(), done:false }
        : { title:'—', cur:0, target:0, timeLeft:null, done:false }
    });
    setText('uiGoalTitle', activeGoal.title);
    setText('uiGoalCount', `${activeGoal.cur}/${activeGoal.target}`);
    const gf = qs('uiGoalFill');
    if(gf) gf.style.width = `${(activeGoal.target? (activeGoal.cur/activeGoal.target*100):0)}%`;
  }else{
    setText('uiGoalTitle', '—'); setText('uiGoalCount', '0/0');
  }

  setText('uiMiniCount', `${miniCleared}/${minisTotal}`);

  if(activeMini){
    setText('uiMiniTitle', activeMini.title);
    const tl = miniTimeLeft();
    setText('uiMiniTime', tl==null?'--':`${Math.ceil(tl)}s`);
    const mf = qs('uiMiniFill');
    if(mf){
      const pct = activeMini.durationSec ? ((activeMini.durationSec - (tl||0)) / activeMini.durationSec) * 100 : 0;
      mf.style.width = `${clamp(pct,0,100)}%`;
    }
  }else{
    setText('uiMiniTitle','—');
    setText('uiMiniTime','--');
    const mf = qs('uiMiniFill'); if(mf) mf.style.width = `0%`;
  }
}

// ------------------------- Goals (STEP 21 consistency) -------------------------
function startGoals(){
  goalsCleared = 0;
  goalsTotal = 2;
  goalsLocked = { fillPlate:false, accuracy:false };
  activeGoal = { ...GOALS[0] };
  emitQuestUpdate();
}

function updateGoals(){
  if(!activeGoal) return;

  if(activeGoal.key === 'fill-plate'){
    activeGoal.cur = plateHave.filter(Boolean).length;

    if(activeGoal.cur >= activeGoal.target){
      if(!goalsLocked.fillPlate){
        goalsLocked.fillPlate = true;
        activeGoal.done = true;
        goalsCleared++;
        emit('hha:celebrate', { game:'plate', kind:'goal' });
        coach('ครบ 5 หมู่แล้ว! ต่อไปคุมความแม่นยำ 😎', 'happy');
        judge('🎯 GOAL COMPLETE!', 'good');

        if(!activeMini && miniStage === 0){
          startNextMini(); // stage 1
        }
      }
      activeGoal = { ...GOALS[1] };
    }
  } else if(activeGoal.key === 'accuracy'){
    const acc = accuracyPct();
    activeGoal.cur = Math.round(acc);

    if(!goalsLocked.accuracy && acc >= activeGoal.target){
      goalsLocked.accuracy = true;
      activeGoal.done = true;
      goalsCleared++;
      emit('hha:celebrate', { game:'plate', kind:'goal' });
      coach('ความแม่นยำถึงเป้าแล้ว! 🏅 รักษาไว้จนจบเกมนะ', 'happy');
      judge('🏅 ACCURACY GOAL COMPLETE!', 'good');
    }
  }

  emitQuestUpdate();
}

// ------------------------- Fever/Shield logic -------------------------
function addFever(amount){
  fever = clamp(fever + (Number(amount)||0), 0, 100);
  if(fever >= 85) aiPulse({ ev:'fever_high' });
  updateHUD();
}
function coolFever(amount){
  fever = clamp(fever - (Number(amount)||0), 0, 100);
  updateHUD();
}
function ensureShieldActive(){
  shieldActive = (shield > 0);
}

// ------------------------- Pattern Generator (STEP 16) -------------------------
function choosePattern(){
  const basePattern = POLICY.pattern || pattern;

  if(!POLICY.patternMixAllowed){
    pgLast = { pattern: basePattern, pick: basePattern, reason:'policy-strict' };
    return basePattern;
  }

  if(basePattern !== 'mix'){
    pgLast = { pattern: basePattern, pick: basePattern, reason:'policy-query' };
    return basePattern;
  }

  let pickMode = 'grid';
  if(activeMini && activeMini.key === 'junk-storm'){
    pickMode = (rng() < 0.55) ? 'edges' : 'rings';
  } else if(fever >= 75){
    pickMode = (rng() < 0.5) ? 'rings' : 'grid';
  } else {
    pickMode = (rng() < 0.55) ? 'grid' : 'center';
  }
  pgLast = { pattern: basePattern, pick: pickMode, reason:'mix-context' };
  return pickMode;
}

function candidatePoint(mode, playRect, size){
  const x0 = playRect.x, y0 = playRect.y;
  const w = Math.max(1, playRect.w - size);
  const h = Math.max(1, playRect.h - size);

  if(mode === 'center'){
    const cx = x0 + w*0.5;
    const cy = y0 + h*0.5;
    const dx = (rng()-0.5) * w * 0.55;
    const dy = (rng()-0.5) * h * 0.55;
    return { sx: cx + dx, sy: cy + dy };
  }

  if(mode === 'edges'){
    const side = Math.floor(rng()*4);
    if(side === 0) return { sx: x0 + rng()*w, sy: y0 + rng()*Math.min(24,h) };
    if(side === 2) return { sx: x0 + rng()*w, sy: y0 + h - Math.min(24,h) + rng()*Math.min(24,h) };
    if(side === 1) return { sx: x0 + w - Math.min(24,w) + rng()*Math.min(24,w), sy: y0 + rng()*h };
    return { sx: x0 + rng()*Math.min(24,w), sy: y0 + rng()*h };
  }

  if(mode === 'rings'){
    const cx = x0 + w*0.5;
    const cy = y0 + h*0.5;
    const ang = rng()*Math.PI*2;
    const rMin = Math.min(w,h) * 0.18;
    const rMax = Math.min(w,h) * 0.48;
    const rr = rMin + rng()*(rMax-rMin);
    return { sx: cx + Math.cos(ang)*rr, sy: cy + Math.sin(ang)*rr };
  }

  if(mode === 'grid'){
    const cols = 3, rows = 3;
    const c = Math.floor(rng()*cols);
    const r = Math.floor(rng()*rows);
    const cellW = w/cols, cellH = h/rows;
    const sx = x0 + c*cellW + rng()*Math.max(1, cellW);
    const sy = y0 + r*cellH + rng()*Math.max(1, cellH);
    return { sx, sy };
  }

  return { sx: x0 + rng()*w, sy: y0 + rng()*h };
}

// ------------------------- Target spawning -------------------------
const goodPool = groupEmojis.map((e,i)=>({ emoji:e, groupIdx:i, kind:'good' }));
const junkPool = ['🍟','🍕','🥤','🍩','🍭','🧁','🍔','🌭','🍫','🧋'].map(e=>({ emoji:e, kind:'junk' }));
const shieldEmoji = { emoji:'🛡️', kind:'shield' };

// DD explain (STEP 15)
function ddExplain(acc, rtAvg, missN){
  const parts = [];

  if(acc < 65) parts.push('acc<65 → enlarge targets');
  else if(acc < 75) parts.push('acc<75 → slightly enlarge');
  else if(acc > 92) parts.push('acc>92 → shrink targets');
  else if(acc > 86) parts.push('acc>86 → slightly shrink');

  if(acc > 90 && rtAvg < 520) parts.push('fast+accurate → spawn↑');
  else if(acc < 68) parts.push('low acc → spawn↓');

  if(acc > 90 && missN <= 2) parts.push('clean run → junk↑');
  else if(acc < 70) parts.push('struggling → junk↓');

  if(!isStudy && fever >= 80) parts.push('fever high → keep steady');
  return parts.length ? parts.join(' | ') : 'stable';
}

function currentTunings(){
  let size = base.size * adapt.sizeMul;
  let lifeMs = base.lifeMs;
  let spawnPerSec = base.spawnPerSec * adapt.spawnMul;
  let junkRate = clamp(base.junkRate * adapt.junkMul, 0.08, 0.55);

  if(!isStudy){
    const f = fever/100;
    spawnPerSec *= (1 + f*0.15);
    junkRate = clamp(junkRate + f*0.05, 0.08, 0.60);
  }

  size = clamp(size, 38, 86);
  spawnPerSec = clamp(spawnPerSec, 0.8, 3.6);
  return { size, lifeMs, spawnPerSec, junkRate };
}

function maybeSpawnShield(){
  if(isStudy) return;
  if(shield >= 3) return;
  const chance = (fever >= 70) ? 0.06 : 0.02;
  if(rng() < chance){
    spawnTarget('shield');
  }
}

function spawnTarget(forcedKind){
  if(!layer) return;

  if(!layoutCache.stamp || (nowMs() - layoutCache.stamp) > 800){
    try{ refreshLayout(); }catch(e){}
  }

  const tune = currentTunings();
  const { W, H } = layoutCache;
  const playRect = layoutCache.playRect;
  const noRects = layoutCache.noRects;

  let kind = forcedKind;
  if(!kind){
    ensureShieldActive();
    if(!isStudy && shield < 2 && fever >= 65 && rng() < 0.05) kind = 'shield';
    else kind = (rng() < tune.junkRate) ? 'junk' : 'good';
  }

  let spec;
  if(kind === 'good') spec = pick(rng, goodPool);
  else if(kind === 'junk') spec = pick(rng, junkPool);
  else spec = shieldEmoji;

  const size = tune.size;

  // compensate look shift
  const shX = lookShift.x || 0;
  const shY = lookShift.y || 0;

  const screenBox = { x:0, y:0, w:size, h:size };
  let ok = false;
  const tries = 44;

  for(let i=0;i<tries;i++){
    const mode = choosePattern();
    const p = candidatePoint(mode, playRect, size);
    const sx = p.sx;
    const sy = p.sy;
    screenBox.x = sx; screenBox.y = sy;

    let hit = false;
    for(const rr of noRects){
      if(intersects(screenBox, rr)){ hit = true; break; }
    }
    if(!hit){ ok = true; break; }
  }

  if(!ok){
    const mode = choosePattern();
    const p = candidatePoint(mode, playRect, size);
    screenBox.x = p.sx;
    screenBox.y = p.sy;
  }

  let lx = screenBox.x - shX;
  let ly = screenBox.y - shY;

  lx = clamp(lx, 6, W - size - 6);
  ly = clamp(ly, 6, H - size - 6);

  const el = DOC.createElement('button');
  const id = `t_${uid()}`;
  el.className = 'plateTarget';
  el.type = 'button';
  el.tabIndex = -1;
  el.setAttribute('data-id', id);
  el.setAttribute('data-kind', spec.kind);
  if(spec.kind === 'good') el.setAttribute('data-group', String(spec.groupIdx));
  el.textContent = spec.emoji;

  el.style.position = 'absolute';
  el.style.left = `${Math.round(lx)}px`;
  el.style.top  = `${Math.round(ly)}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '999px';
  el.style.border = '1px solid rgba(148,163,184,.18)';
  el.style.background = 'rgba(2,6,23,.55)';
  el.style.backdropFilter = 'blur(8px)';
  el.style.boxShadow = '0 18px 44px rgba(0,0,0,.28)';
  el.style.font = '900 28px/1 system-ui';
  el.style.display = 'grid';
  el.style.placeItems = 'center';
  el.style.userSelect = 'none';
  el.style.webkitTapHighlightColor = 'transparent';
  el.style.outline = 'none';
  el.style.transform = 'translateZ(0)';

  // strict cVR = disable pointer hit
  if(isCVR){
    el.style.pointerEvents = 'none';
  }

  on(el, 'pointerdown', (e)=>{
    if(isCVR){
      e.preventDefault();
      return;
    }
    e.preventDefault();
    if(!running || paused) return;
    onHit(id);
  }, { passive:false });

  layer.appendChild(el);

  const born = gameNowMs();
  const lifeMs = tune.lifeMs;

  targets.set(id, {
    id,
    el,
    kind: spec.kind,
    groupIdx: (spec.kind==='good') ? spec.groupIdx : null,
    bornMs: born,
    lifeMs,
    size,
  });

  if(spec.kind === 'good') nTargetGoodSpawned++;
  else if(spec.kind === 'junk') nTargetJunkSpawned++;
  else nTargetShieldSpawned++;

  return id;
}

function despawn(id){
  const t = targets.get(id);
  if(!t) return;
  targets.delete(id);
  try{ t.el.remove(); }catch(e){}
}
function clearAllTargets(){
  for(const [id] of targets) despawn(id);
}

// ------------------------- Aim assist (STEP 17/18) -------------------------
function findTargetNearCrosshair(lockPx){
  if(!layer || targets.size === 0) return null;

  const { W, H } = viewportSize();
  const cx = W * 0.5;
  const cy = H * 0.5;

  let best = null;
  let bestD2 = Infinity;

  for(const [id, t] of targets){
    const el = t.el;
    if(!el) continue;

    const r = el.getBoundingClientRect();
    const tx = r.left + r.width*0.5;
    const ty = r.top  + r.height*0.5;

    const dx = tx - cx;
    const dy = ty - cy;
    const d2 = dx*dx + dy*dy;

    if(d2 < bestD2){
      bestD2 = d2;
      best = { id, t, d2 };
    }
  }

  const lock2 = (Number(lockPx)||0);
  const thr2 = lock2 * lock2;
  if(best && best.d2 <= thr2) return best;
  return null;
}

const aimLockPx = aimLockPxQ;

function shootFromCrosshair(opts){
  if(!running || paused) return false;

  nShootEvents++;

  const lockPx = clamp((opts && opts.lockPx) ? opts.lockPx : aimLockPx, 18, 120);
  const effectiveLock = POLICY.aimAssist ? lockPx : Math.min(14, lockPx);

  const hit = findTargetNearCrosshair(effectiveLock);
  if(hit){
    nAssistLocks++;
    lastAssistTargetKind = hit.t.kind || '';
    onHit(hit.id);
    return true;
  }

  if(POLICY.aimPenalty){
    score = Math.max(0, score - 15);
    addFever(3);
    combo = 0;
    judge('พลาด! (-15) ระวังจังหวะยิง 🎯', 'warn');
    updateHUD();
  }else{
    judge('พลาด! (ยิงกลางจอ)', 'info');
  }
  return false;
}

// ------------------------- Hit / Miss handling -------------------------
function onHit(id){
  const t = targets.get(id);
  if(!t) return;

  const rt = Math.max(0, gameNowMs() - t.bornMs);
  const kind = t.kind;

  despawn(id);

  if(kind === 'good'){
    nHitGood++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    const gi = Number(t.groupIdx);
    if(gi>=0 && gi<5){
      gCount[gi] += 1;
      if(!plateHave[gi]){
        plateHave[gi] = true;
        judge(`+ หมู่ใหม่! ${groupEmojis[gi]}`, 'good');
      }
    }

    let add = 50;
    if(rt <= 420){ add += 35; perfectHits++; }
    else if(rt <= 650){ add += 20; }
    add += Math.min(40, combo * 2);

    score += add;
    rtGood.push(rt);
    fxPulse('good');
    coolFever(base.feverDownGood);

    // mini specific: plate-rush completion
    if(activeMini && activeMini.key === 'plate-rush'){
      const haveN = plateHave.filter(Boolean).length;
      const tl = miniTimeLeft();
      if(haveN >= 5 && (tl != null && tl > 0)){
        finishMini(true, 'rush-complete');
      }
    }

    aiState.goodStreak++;
    aiState.junkStreak = 0;
    aiState.missStreak = 0;

    if(combo === 10 || combo === 15 || combo === 20){
      aiPulse({ ev:'combo_big', combo });
    }

  } else if(kind === 'junk'){
    ensureShieldActive();

    const forbid = (activeMini && activeMini.forbidJunk);

    if(forbid){
      if(shieldActive){
        shield = Math.max(0, shield - 1);
        nHitJunkGuard++;
        judge('🛡️ BLOCKED!', 'warn');
      }else{
        nHitJunk++;
        miss++;
        combo = 0;
        score = Math.max(0, score - 60);
        addFever(base.feverUpJunk);
        fxPulse('bad'); fxShake();
        finishMini(false, 'hit-junk');
      }
    }else{
      if(shieldActive){
        shield = Math.max(0, shield - 1);
        nHitJunkGuard++;
        judge('🛡️ BLOCK!', 'warn');
        fxPulse('good');
      }else{
        nHitJunk++;
        miss++;
        combo = 0;
        score = Math.max(0, score - 60);
        addFever(base.feverUpJunk);
        fxPulse('bad'); fxShake();
        judge('💥 JUNK!', 'bad');
      }
    }

    aiState.junkStreak++;
    aiState.goodStreak = 0;
    aiPulse({ ev:'junk_hit' });

    ensureShieldActive();
  } else if(kind === 'shield'){
    shield = clamp(shield + 1, 0, 9);
    ensureShieldActive();
    score += 40;
    fxPulse('good');
    judge('🛡️ +1 SHIELD', 'good');
  }

  if(adaptiveOn) updateAdaptive();

  updateGoals();
  updateHUD();
}

function onExpireTarget(id){
  const t = targets.get(id);
  if(!t) return;
  const kind = t.kind;
  despawn(id);

  if(kind === 'good'){
    nExpireGood++;
    miss++;
    combo = 0;
    addFever(base.feverUpMiss);
    fxPulse('bad');

    aiState.missStreak++;
    aiState.goodStreak = 0;
    aiPulse({ ev:'good_miss' });

    // clean-sweep fail condition
    if(activeMini && activeMini.key === 'clean-sweep' && !activeMini.done){
      if(nExpireGood > (activeMini.snapExpireGood || 0)){
        finishMini(false, 'expired-good');
      }
    }
  }
  updateGoals();
  updateHUD();
}

// ------------------------- Adaptive + DD hooks (STEP 15) -------------------------
function updateAdaptive(){
  const acc = accuracyPct();
  const rtN = rtGood.length;
  const rtAvg = rtN ? (rtGood.reduce((a,b)=>a+b,0)/rtN) : 800;

  const sizeMul =
    (acc < 65 ? 1.18 :
     acc < 75 ? 1.10 :
     acc > 92 ? 0.92 :
     acc > 86 ? 0.96 : 1.0);

  let spawnMul = 1.0;
  if(acc > 90 && rtAvg < 520) spawnMul = 1.12;
  else if(acc < 68) spawnMul = 0.92;

  let junkMul = 1.0;
  if(acc > 90 && miss <= 2) junkMul = 1.10;
  else if(acc < 70) junkMul = 0.92;

  adapt.sizeMul = clamp(sizeMul, 0.85, 1.25);
  adapt.spawnMul = clamp(spawnMul, 0.80, 1.25);
  adapt.junkMul  = clamp(junkMul, 0.85, 1.25);

  ddLast = {
    tsMs: gameNowMs(),
    acc: Math.round(acc*10)/10,
    rtAvg: Math.round(rtAvg),
    miss,
    decision: { ...adapt },
    reason: ddExplain(acc, rtAvg, miss),
    mode: runMode,
    diff
  };

  emit('hha:adaptive', { game:'plate', adapt:{...adapt}, acc, rtAvg, dd: ddLast });
}

// ------------------------- Timer / loop -------------------------
function tick(){
  if(!running) return;

  const t = nowMs();
  const dt = (t - tLastTickMs) / 1000;
  tLastTickMs = t;

  if(paused){
    requestAnimationFrame(tick);
    return;
  }

  if(isStudy && dt > 0 && isFinite(dt)){
    simMs += dt * 1000;
  }

  if(dt > 0 && isFinite(dt)){
    const newLeft = Math.max(0, tLeftSec - dt);
    if(Math.floor(newLeft) !== Math.floor(tLeftSec)){
      emit('hha:time', { game:'plate', timeLeftSec: Math.ceil(newLeft) });
    }
    tLeftSec = newLeft;
  }

  // mini window FX
  if(activeMini){
    const tl = miniTimeLeft();
    if(tl != null){
      if(POLICY.fxOn && tl <= 3.2 && tl > 0){
        fxTick();
        if(Math.ceil(tl) !== playTickSound._lastSec){
          playTickSound._lastSec = Math.ceil(tl);
          playTickSound();
        }
        if(tl <= 1.2) fxShake();
        if(tl <= 2.0) fxBlink();
      }
      if(tl <= 0){
        finishMini(false, 'timeout');
      }
    }
  }

  // End-window FX (STEP 22)
  if(POLICY.fxOn){
    const sec = Math.ceil(tLeftSec);
    if(tLeftSec <= 3.2 && tLeftSec > 0){
      if(sec !== endFx.lastSec){
        endFx.lastSec = sec;
        fxTick();
        playTickSound._lastSec = sec;
        playTickSound();
      }
      if(tLeftSec <= 2.0) fxBlink();
      if(tLeftSec <= 1.2) fxShake();

      if(tLeftSec <= 2.2 && fever < 85){
        sayCoach('end_push', 'อีกนิดเดียว! รักษาความแม่นยำไว้จนจบ 🏁', 'neutral');
      }
    }
  }

  const tune = currentTunings();
  spawnAccum += dt * tune.spawnPerSec;
  while(spawnAccum >= 1){
    spawnAccum -= 1;
    spawnTarget();
    maybeSpawnShield();
  }

  for(const [id, tObj] of targets){
    if((gameNowMs() - tObj.bornMs) >= tObj.lifeMs){
      onExpireTarget(id);
    }
  }

  updateGoals();
  updateHUD();

  if(tLeftSec <= 0){
    endGame('time');
    return;
  }

  requestAnimationFrame(tick);
}

// ------------------------- Pause / Start / Restart / VR -------------------------
function setPaused(p){
  paused = !!p;
  if(hudPaused) hudPaused.style.display = paused ? 'grid' : 'none';
  judge(paused ? '⏸ Paused' : '▶️ Resume', paused ? 'warn' : 'good');
}

async function flushPendingNow(){
  const q = loadPending();
  if(!q.length) return 0;

  let sent = 0;
  for(let i=0;i<q.length;i++){
    const item = q[0];
    const ok = await sendFlatToLogger(item.summaryFlat, item.reason || 'pending');
    if(ok){
      dropPendingFirst();
      sent++;
    }else{
      break;
    }
  }
  return sent;
}

function bootButtons(){
  on(btnPause, 'click', ()=>{
    if(!running) return;
    setPaused(!paused);
  }, { passive:true });

  on(btnRestart, 'click', async ()=>{
    await flushPendingNow();
    await flushHardened('restart');
    restartGame('restart');
  }, { passive:true });

  on(btnEnterVR, 'click', ()=>{
    try{
      const scene = DOC.querySelector('a-scene');
      if(scene && scene.enterVR) scene.enterVR();
    }catch(e){}
    refreshLayoutSoon(120);
    refreshLayoutSoon(360);
  }, { passive:true });

  on(btnBackHub, 'click', async ()=>{
    await flushPendingNow();
    await flushHardened('back-hub');
    if(hubUrl){
      location.href = hubUrl;
    }else{
      location.href = './hub.html';
    }
  }, { passive:true });

  on(btnPlayAgain, 'click', async ()=>{
    await flushPendingNow();
    await flushHardened('play-again');
    const u = new URL(location.href);
    if(!isStudy){
      u.searchParams.set('seed', String(Date.now() ^ (Math.random()*1e9)));
    }
    location.href = u.toString();
  }, { passive:true });

  on(btnStart, 'click', async ()=>{
    await requestGyroPermission();
    startGame();
  }, { passive:true });

  // hha:shoot event (STEP 17)
  on(ROOT, 'hha:shoot', (e)=>{
    const d = (e && e.detail) ? e.detail : {};
    shootFromCrosshair({ lockPx: d.lockPx });
  }, { passive:true });

  on(ROOT, 'beforeunload', ()=>{
    try{ flushHardened('beforeunload'); }catch(err){}
  });
  on(ROOT, 'pagehide', ()=>{
    try{ flushHardened('pagehide'); }catch(err){}
  }, { passive:true });
  on(DOC, 'visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden'){
      try{ flushHardened('hidden'); }catch(err){}
    }
  }, { passive:true });

  on(ROOT, 'resize', ()=> refreshLayoutSoon(90), { passive:true });
  on(ROOT, 'orientationchange', ()=> refreshLayoutSoon(140), { passive:true });

  const vv = ROOT.visualViewport;
  if(vv){
    on(vv, 'resize', ()=> refreshLayoutSoon(60), { passive:true });
    on(vv, 'scroll', ()=> refreshLayoutSoon(80), { passive:true });
  }
}

function resetState(){
  running = false;
  paused = false;

  simMs = 0;

  tStartMs = 0;
  tLastTickMs = 0;
  tLeftSec = Number(timePlannedSec)||90;

  score = 0;
  combo = 0;
  comboMax = 0;
  miss = 0;

  gCount = [0,0,0,0,0];
  plateHave = [false,false,false,false,false];

  fever = 0;
  shield = 0;
  shieldActive = false;

  nTargetGoodSpawned = 0;
  nTargetJunkSpawned = 0;
  nTargetShieldSpawned = 0;
  nHitGood = 0;
  nHitJunk = 0;
  nHitJunkGuard = 0;
  nExpireGood = 0;
  rtGood = [];
  perfectHits = 0;

  spawnAccum = 0;

  adapt.sizeMul = 1.0;
  adapt.spawnMul = 1.0;
  adapt.junkMul  = 1.0;
  adaptiveOn = !!POLICY.adaptive;

  goalsTotal = 2;
  goalsCleared = 0;
  goalsLocked = { fillPlate:false, accuracy:false };

  minisTotal = (diff === 'hard') ? 3 : 2;
  miniCleared = 0;
  miniStage = 0;

  activeGoal = null;
  activeMini = null;

  nShootEvents = 0;
  nAssistLocks = 0;
  lastAssistTargetKind = '';

  endFx = { lastSec: null, armed: true };

  aiState.lastSayMs = -1e9;
  aiState.lastKey = '';
  aiState.miniFailCount = 0;
  aiState.cooldownMs = isStudy ? 4200 : 2600;

  clearAllTargets();
  if(resultBackdrop) resultBackdrop.style.display = 'none';
  if(hudPaused) hudPaused.style.display = 'none';
}

function startGame(){
  if(running) return;
  resetState();

  if(startOverlay) startOverlay.style.display = 'none';

  enableGyroIfAllowed();
  bindDragLook();

  refreshLayoutSoon(20);
  refreshLayoutSoon(160);

  applyLook();

  startGoals();

  if(isCVR){
    DOC.body.classList.add('view-cvr');
    sayCoach('cvr_hint', 'โหมด VR: ใช้เป้ากากบาทกลางจอยิงนะ 🎯', 'neutral');
    setText('uiHint', 'โหมด VR: ยิงด้วยกากบาทกลางจอ (tap-to-shoot)');
  }else{
    DOC.body.classList.remove('view-cvr');
    coach('พร้อมลุย! เติมจานให้ครบ 5 หมู่ 💪', 'neutral');
  }

  judge('▶️ START!', 'good');

  running = true;
  paused = false;

  tStartMs = nowMs();
  tLastTickMs = tStartMs;

  updateHUD();
  emit('hha:time', { game:'plate', timeLeftSec: Math.ceil(tLeftSec) });

  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      for(let i=0;i<4;i++) spawnTarget();
      requestAnimationFrame(tick);
    });
  });
}

function restartGame(reason){
  const u = new URL(location.href);
  if(!isStudy){
    u.searchParams.set('seed', String(Date.now() ^ (Math.random()*1e9)));
  }
  location.href = u.toString();
}

// ------------------------- End summary + flatten + sending -------------------------
function median(arr){
  if(!arr || !arr.length) return 0;
  const a = [...arr].sort((x,y)=>x-y);
  const mid = Math.floor(a.length/2);
  return (a.length%2) ? a[mid] : (a[mid-1]+a[mid])/2;
}

function buildSummary(reason){
  const playedSec = Math.max(0, (nowMs() - tStartMs) / 1000);
  const acc = accuracyPct();
  const junkErrorPct = (nHitGood + nHitJunk) ? (nHitJunk / (nHitGood+nHitJunk) * 100) : 0;

  const avgRt = rtGood.length ? (rtGood.reduce((a,b)=>a+b,0)/rtGood.length) : 0;
  const medRt = rtGood.length ? median(rtGood) : 0;
  const fastHitRatePct = (nHitGood>0) ? (perfectHits/nHitGood*100) : 0;

  const grade = calcGrade();
  const sessionId = `PLATE_${Date.now()}_${uid().slice(0,6)}`;

  return {
    timestampIso: new Date().toISOString(),
    projectTag: 'HHA',
    sessionId,
    game: 'plate',
    gameMode: 'plate',
    runMode,
    diff,
    durationPlannedSec: Number(timePlannedSec)||0,
    durationPlayedSec: Math.round(playedSec),

    scoreFinal: score,
    comboMax,
    misses: miss,

    goalsCleared,
    goalsTotal,

    miniCleared,
    miniTotal: minisTotal,

    nTargetGoodSpawned,
    nTargetJunkSpawned,
    nTargetShieldSpawned,

    nHitGood,
    nHitJunk,
    nHitJunkGuard,
    nExpireGood,

    accuracyGoodPct: Math.round(acc*10)/10,
    junkErrorPct: Math.round(junkErrorPct*10)/10,
    avgRtGoodMs: Math.round(avgRt),
    medianRtGoodMs: Math.round(medRt),
    fastHitRatePct: Math.round(fastHitRatePct*10)/10,

    grade,
    seed,
    reason: reason || 'end',

    plate: {
      have: plateHave.map(Boolean),
      counts: [...gCount],
      total: gCount.reduce((a,b)=>a+b,0)
    },

    aim: {
      assistOn: !!POLICY.aimAssist,
      lockPx: aimLockPx,
      nShootEvents,
      nAssistLocks,
      lastAssistTargetKind
    },

    view: {
      view,
      isCVR: !!isCVR
    },

    policy: {
      name: POLICY.name,
      aiCoach: !!POLICY.aiCoach,
      aimAssist: !!POLICY.aimAssist,
      aimPenalty: !!POLICY.aimPenalty,
      pattern: POLICY.pattern,
      patternMixAllowed: !!POLICY.patternMixAllowed,
      adaptive: !!POLICY.adaptive,
      fxOn: !!POLICY.fxOn
    },

    ai: {
      coachOn: !!POLICY.aiCoach,
      adaptiveOn: !!adaptiveOn,
      adapt: { ...adapt },
      ddLast: ddLast ? { ...ddLast } : null,
      pgLast: pgLast ? { ...pgLast } : null,
    },

    device: (navigator && navigator.userAgent) ? navigator.userAgent : '',
    gameVersion: URLX.searchParams.get('v') || URLX.searchParams.get('ver') || '',
    hub: hubUrl || '',
  };
}

function flattenSummary(s){
  const o = {};
  const set = (k,v)=>{ o[k]=v; };

  set('timestampIso', s.timestampIso);
  set('projectTag', s.projectTag);
  set('sessionId', s.sessionId);
  set('gameMode', s.gameMode || s.game || 'plate');
  set('runMode', s.runMode);
  set('diff', s.diff);

  set('durationPlannedSec', s.durationPlannedSec);
  set('durationPlayedSec', s.durationPlayedSec);

  set('scoreFinal', s.scoreFinal);
  set('comboMax', s.comboMax);
  set('misses', s.misses);

  set('goalsCleared', s.goalsCleared);
  set('goalsTotal', s.goalsTotal);

  set('miniCleared', s.miniCleared);
  set('miniTotal', s.miniTotal);

  set('nTargetGoodSpawned', s.nTargetGoodSpawned);
  set('nTargetJunkSpawned', s.nTargetJunkSpawned);
  set('nTargetShieldSpawned', s.nTargetShieldSpawned);

  set('nHitGood', s.nHitGood);
  set('nHitJunk', s.nHitJunk);
  set('nHitJunkGuard', s.nHitJunkGuard);
  set('nExpireGood', s.nExpireGood);

  set('accuracyGoodPct', s.accuracyGoodPct);
  set('junkErrorPct', s.junkErrorPct);
  set('avgRtGoodMs', s.avgRtGoodMs);
  set('medianRtGoodMs', s.medianRtGoodMs);
  set('fastHitRatePct', s.fastHitRatePct);

  set('grade', s.grade);
  set('seed', s.seed);
  set('reason', s.reason);

  // plate details (optional columns)
  if(s.plate){
    set('plateHaveCount', Array.isArray(s.plate.have) ? s.plate.have.filter(Boolean).length : null);
    set('g1', s.plate.counts ? (s.plate.counts[0]||0) : null);
    set('g2', s.plate.counts ? (s.plate.counts[1]||0) : null);
    set('g3', s.plate.counts ? (s.plate.counts[2]||0) : null);
    set('g4', s.plate.counts ? (s.plate.counts[3]||0) : null);
    set('g5', s.plate.counts ? (s.plate.counts[4]||0) : null);
    set('gTotal', s.plate.total ?? null);
  }

  if(s.aim){
    set('aimAssistOn', s.aim.assistOn ? 1 : 0);
    set('aimLockPx', s.aim.lockPx ?? null);
    set('nShootEvents', s.aim.nShootEvents ?? 0);
    set('nAssistLocks', s.aim.nAssistLocks ?? 0);
    set('lastAssistTargetKind', s.aim.lastAssistTargetKind ?? null);
  }

  if(s.view){
    set('viewMode', s.view.view ?? null);
    set('isCVR', s.view.isCVR ? 1 : 0);
  }

  if(s.policy){
    set('policyName', s.policy.name ?? null);
    set('policyAiCoach', s.policy.aiCoach ? 1 : 0);
    set('policyAimAssist', s.policy.aimAssist ? 1 : 0);
    set('policyAimPenalty', s.policy.aimPenalty ? 1 : 0);
    set('policyPattern', s.policy.pattern ?? null);
    set('policyPatternMix', s.policy.patternMixAllowed ? 1 : 0);
    set('policyAdaptive', s.policy.adaptive ? 1 : 0);
    set('policyFxOn', s.policy.fxOn ? 1 : 0);
  }

  if(s.ai){
    const ai = s.ai;

    if(ai.ddLast){
      set('ddTsMs', ai.ddLast.tsMs ?? null);
      set('ddAcc', ai.ddLast.acc ?? null);
      set('ddRtAvg', ai.ddLast.rtAvg ?? null);
      set('ddMiss', ai.ddLast.miss ?? null);
      set('ddSizeMul', ai.ddLast.decision ? ai.ddLast.decision.sizeMul : null);
      set('ddSpawnMul', ai.ddLast.decision ? ai.ddLast.decision.spawnMul : null);
      set('ddJunkMul', ai.ddLast.decision ? ai.ddLast.decision.junkMul : null);
      set('ddReason', ai.ddLast.reason ?? null);
    }

    if(ai.pgLast){
      set('patternQuery', ai.pgLast.pattern ?? null);
      set('patternPick', ai.pgLast.pick ?? null);
      set('patternReason', ai.pgLast.reason ?? null);
    }
  }

  set('device', s.device || '');
  set('gameVersion', s.gameVersion || '');
  set('hub', s.hub || '');

  return o;
}

function showResult(summary){
  if(!resultBackdrop) return;
  resultBackdrop.style.display = 'grid';

  setText('rMode', summary.runMode);
  setText('rGrade', summary.grade);
  setText('rScore', summary.scoreFinal);
  setText('rMaxCombo', summary.comboMax);
  setText('rMiss', summary.misses);
  setText('rPerfect', Math.round(summary.fastHitRatePct) + '%');
  setText('rGoals', `${summary.goalsCleared}/${summary.goalsTotal}`);
  setText('rMinis', `${summary.miniCleared}/${summary.miniTotal}`);

  setText('rG1', summary.plate.counts[0]||0);
  setText('rG2', summary.plate.counts[1]||0);
  setText('rG3', summary.plate.counts[2]||0);
  setText('rG4', summary.plate.counts[3]||0);
  setText('rG5', summary.plate.counts[4]||0);
  setText('rGTotal', summary.plate.total||0);
}

function storeSummary(summary){
  saveJson(LS_LAST, summary);

  const hist = loadJson(LS_HIST, []);
  const next = Array.isArray(hist) ? hist : [];
  next.unshift(summary);
  while(next.length > 50) next.pop();
  saveJson(LS_HIST, next);
}

async function sendFlatToLogger(summaryFlat, reason){
  try{
    const L = ROOT.HHACloudLogger || ROOT.HHA_CloudLogger || ROOT.HHA_LOGGER || null;
    if(!L || !summaryFlat) return false;

    if(typeof L.logSession === 'function'){
      await Promise.race([
        Promise.resolve(L.logSession(summaryFlat)),
        new Promise(res=>setTimeout(res, 900))
      ]);
      return true;
    }
    if(typeof L.log === 'function'){
      await Promise.race([
        Promise.resolve(L.log('session', summaryFlat)),
        new Promise(res=>setTimeout(res, 900))
      ]);
      return true;
    }
    if(typeof L.track === 'function'){
      await Promise.race([
        Promise.resolve(L.track('session', summaryFlat)),
        new Promise(res=>setTimeout(res, 900))
      ]);
      return true;
    }

    const payload = { type:'session', reason: reason||'end', summaryFlat };
    if(typeof L.enqueue === 'function'){
      await Promise.race([ Promise.resolve(L.enqueue(payload)), new Promise(res=>setTimeout(res,900)) ]);
      return true;
    }
    if(typeof L.push === 'function'){
      await Promise.race([ Promise.resolve(L.push(payload)), new Promise(res=>setTimeout(res,900)) ]);
      return true;
    }
    if(typeof L.send === 'function'){
      await Promise.race([ Promise.resolve(L.send(payload)), new Promise(res=>setTimeout(res,900)) ]);
      return true;
    }
  }catch(e){}
  return false;
}

async function flushHardened(reason){
  try{
    const L = ROOT.HHACloudLogger || ROOT.HHA_CloudLogger || ROOT.HHA_LOGGER || null;
    if(L){
      if(typeof L.flushNow === 'function'){
        await Promise.race([
          Promise.resolve(L.flushNow({ reason })),
          new Promise(res=>setTimeout(res, 650))
        ]);
      } else if(typeof L.flush === 'function'){
        await Promise.race([
          Promise.resolve(L.flush({ reason })),
          new Promise(res=>setTimeout(res, 650))
        ]);
      }
    }
  }catch(e){}
}

async function endGame(reason){
  if(!running) return;
  running = false;
  paused = false;

  clearAllTargets();

  // STEP 21: finalize goal state before summary
  updateGoals();

  const summary = buildSummary(reason);
  storeSummary(summary);

  const summaryFlat = flattenSummary(summary);

  // try send; else queue
  const ok = await sendFlatToLogger(summaryFlat, reason || 'end');
  if(!ok){
    enqueuePending(summaryFlat, reason || 'end');
  }

  emit('hha:end', { game:'plate', summary, summaryFlat });
  emit('hha:celebrate', { game:'plate', kind:'end' });

  coach('จบเกมแล้ว! ดูสรุปผลได้เลย 🏁', (summary.grade==='C'?'sad':'happy'));
  judge('🏁 END', 'good');

  showResult(summary);
  updateHUD();

  await flushHardened(reason || 'end');
}

// ------------------------- Init -------------------------
(function init(){
  // strict cVR class
  DOC.body.classList.toggle('view-cvr', !!isCVR);

  setText('uiDiffPreview', diff);
  setText('uiTimePreview', timePlannedSec);
  setText('uiRunPreview', runMode);

  try{ refreshLayout(); }catch(e){}
  resetState();
  updateHUD();
  emitQuestUpdate();

  bootButtons();

  if(startOverlay) startOverlay.style.display = 'grid';
  applyLook();

  // STEP 23: attempt resend pending at startup
  flushPendingNow();
})();