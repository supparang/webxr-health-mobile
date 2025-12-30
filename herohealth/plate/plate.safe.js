// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION (HHA Standard + VR-feel + Plate Rush + Safe Spawn + BRUTAL+++ FX)
// ✅ Play: adaptive ON
// ✅ Study/Research: deterministic seed + adaptive OFF
// ✅ Emits: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end, hha:celebrate
// ✅ End summary: localStorage HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY
// ✅ Flush-hardened: before end/back hub/reload

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

// BRUTAL+++ CSS var helpers
function setCssVar(name, val){
  try{ DOC.documentElement.style.setProperty(name, String(val)); }catch(e){}
}
function fxCrit(){
  if(!hitFx) return;
  hitFx.classList.remove('pfx-critFlash');
  void hitFx.offsetWidth;
  hitFx.classList.add('pfx-critFlash');
  clearTimeout(fxCrit._t);
  fxCrit._t = setTimeout(()=>hitFx.classList.remove('pfx-critFlash'), 220);
}
function setPressureVignette(level){
  const v = clamp(level, 0, 1);
  setCssVar('--hha-vig', v.toFixed(3));
}

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

// ------------------------- Difficulty tuning -------------------------
const DIFF = {
  easy:   { size: 64, lifeMs: 1800, spawnPerSec: 1.5,  junkRate: 0.18, feverUpJunk: 12, feverUpMiss: 8,  feverDownGood: 2.8 },
  normal: { size: 56, lifeMs: 1600, spawnPerSec: 1.85, junkRate: 0.24, feverUpJunk: 14, feverUpMiss: 9,  feverDownGood: 2.4 },
  hard:   { size: 48, lifeMs: 1400, spawnPerSec: 2.2,  junkRate: 0.30, feverUpJunk: 16, feverUpMiss: 10, feverDownGood: 2.0 },
};
const base = DIFF[diff] || DIFF.normal;

// Adaptive (Play only)
let adaptiveOn = !isStudy;
let adapt = { sizeMul: 1.0, spawnMul: 1.0, junkMul: 1.0 };

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

function applyLook(){
  if(!layer) return;
  const maxX = 24, maxY = 22;
  const x = clamp(look.x + gyro.gx, -maxX, maxX);
  const y = clamp(look.y + gyro.gy, -maxY, maxY);
  layer.style.transform = `translate(${x}px, ${y}px)`;
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
function intersects(a, b){
  return !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y);
}
function buildNoSpawnRects(){
  const rects = [];
  [hudTop, miniPanel, coachPanel, hudBtns].forEach(el=>{
    const rr = rectOf(el);
    if(rr) rects.push(rr);
  });
  return rects;
}
function getPlayRect(){
  const W = ROOT.innerWidth || 360;
  const H = ROOT.innerHeight || 640;
  const pad = 10;

  const topR = rectOf(hudTop);
  const miniR = rectOf(miniPanel);
  const btnR = rectOf(hudBtns);
  const coachR = rectOf(coachPanel);

  let top = pad;
  let bottom = H - pad;
  let left = pad;
  let right = W - pad;

  if(topR) top = Math.max(top, topR.y + topR.h + 10);
  if(miniR) top = Math.max(top, miniR.y + miniR.h + 10);
  if(btnR) bottom = Math.min(bottom, btnR.y - 10);
  if(coachR) left = Math.max(left, coachR.x + coachR.w + 10);

  top = clamp(top, 0, H-40);
  bottom = clamp(bottom, top+40, H);
  left = clamp(left, 0, W-40);
  right = clamp(right, left+40, W);

  return { x:left, y:top, w:(right-left), h:(bottom-top) };
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

let goalsTotal = 2;
let goalsCleared = 0;

let minisTotal = 999;
let miniCleared = 0;

let activeGoal = null;
let activeMini = null;

const GOALS = [
  { key:'fill-plate', title:'เติมจานให้ครบ 5 หมู่', target:5, cur:0, done:false },
  { key:'accuracy', title:'จบเกมด้วยความแม่นยำ ≥ 80%', target:80, cur:0, done:false },
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

  // --- BRUTAL+++ FX drivers ---
  const comboGlow = clamp(combo / 32, 0, 1);
  const feverV = clamp((fever - 35) / 65, 0, 1);
  setCssVar('--hha-comboGlow', comboGlow.toFixed(3));

  // base vignette from fever (mini may override in tick)
  setPressureVignette(feverV);

  try{
    if(fever >= 75) DOC.body.classList.add('hha-dangerPulse');
    else DOC.body.classList.remove('hha-dangerPulse');
  }catch(e){}
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
    };
    img.src = map[m] || map.neutral;
  }
}

function judge(text, kind){
  emit('hha:judge', { game:'plate', text, kind: kind||'info' });
}

// ------------------------- Mini quests -------------------------
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

function startMini(mini){
  activeMini = mini;
  activeMini.startedMs = nowMs();
  activeMini.snapPlateHave = [...plateHave];
  emit('quest:update', {
    game:'plate',
    goal: activeGoal ? { title: activeGoal.title, cur: activeGoal.cur, target: activeGoal.target, done: activeGoal.done } : null,
    mini: { title: activeMini.title, cur:0, target:activeMini.durationSec, timeLeft: activeMini.durationSec, done:false }
  });
  setText('uiMiniTitle', activeMini.title);
  setText('uiMiniTime', `${activeMini.durationSec}s`);
  setText('uiHint', 'ทริค: เร่งเก็บหมู่ที่ยังขาด! ระวังขยะห้ามโดน!');
  judge('⚡ Plate Rush เริ่มแล้ว!', 'warn');
}

function finishMini(ok, reason){
  if(!activeMini || activeMini.done) return;
  activeMini.done = true;
  activeMini.fail = !ok;
  activeMini.reason = reason || (ok ? 'ok' : 'fail');

  if(ok){
    miniCleared++;
    emit('hha:celebrate', { game:'plate', kind:'mini' });
    coach('สุดยอด! Plate Rush ผ่าน! 🔥', 'happy');
    judge('✅ MINI COMPLETE!', 'good');
    shield = clamp(shield + 1, 0, 9);
  }else{
    coach('พลาดนิดเดียว! ลองใหม่เดี๋ยวก็ผ่าน 💪', (fever>70?'fever':'sad'));
    judge('❌ MINI FAILED', 'bad');
  }
  activeMini = null;
  emitQuestUpdate();
}

function miniTimeLeft(){
  if(!activeMini) return null;
  const elapsed = (nowMs() - activeMini.startedMs) / 1000;
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

  if(activeMini){
    setText('uiMiniTitle', activeMini.title);
    setText('uiMiniCount', `${miniCleared}/${Math.max(minisTotal, miniCleared+1)}`);
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

// ------------------------- Goals -------------------------
function startGoals(){
  goalsCleared = 0;
  activeGoal = { ...GOALS[0] };
  emitQuestUpdate();
}
function updateGoals(){
  if(!activeGoal || activeGoal.done) return;

  if(activeGoal.key === 'fill-plate'){
    activeGoal.cur = plateHave.filter(Boolean).length;
    if(activeGoal.cur >= activeGoal.target){
      activeGoal.done = true;
      goalsCleared++;
      emit('hha:celebrate', { game:'plate', kind:'goal' });
      coach('ครบ 5 หมู่แล้ว! ต่อไปคุมความแม่นยำ 😎', 'happy');
      judge('🎯 GOAL COMPLETE!', 'good');

      if(!activeMini){
        startMini(makeMiniPlateRush());
      }
      activeGoal = { ...GOALS[1] };
    }
  } else if(activeGoal.key === 'accuracy'){
    activeGoal.cur = Math.round(accuracyPct());
  }

  emitQuestUpdate();
}

// ------------------------- Fever/Shield logic -------------------------
function addFever(amount){
  fever = clamp(fever + (Number(amount)||0), 0, 100);
  if(fever >= 85) coach('ระวัง! FEVER สูงมากแล้ว 🔥', 'fever');
  updateHUD();
}
function coolFever(amount){
  fever = clamp(fever - (Number(amount)||0), 0, 100);
  updateHUD();
}
function ensureShieldActive(){
  shieldActive = (shield > 0);
}

// ------------------------- Target spawning -------------------------
const goodPool = groupEmojis.map((e,i)=>({ emoji:e, groupIdx:i, kind:'good' }));
const junkPool = ['🍟','🍕','🥤','🍩','🍭','🧁','🍔','🌭','🍫','🧋'].map(e=>({ emoji:e, kind:'junk' }));
const shieldEmoji = { emoji:'🛡️', kind:'shield' };

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
  const tune = currentTunings();

  const playRect = getPlayRect();
  const noRects = buildNoSpawnRects();

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
  const box = { x:0, y:0, w:size, h:size };
  let ok = false;

  const tries = 38;
  for(let i=0;i<tries;i++){
    const rx = playRect.x + rng()*(Math.max(1, playRect.w - size));
    const ry = playRect.y + rng()*(Math.max(1, playRect.h - size));
    box.x = rx; box.y = ry;

    let hit = false;
    for(const rr of noRects){
      if(intersects(box, rr)){ hit = true; break; }
    }
    if(!hit){ ok = true; break; }
  }

  if(!ok){
    const rx = playRect.x + rng()*(Math.max(1, playRect.w - size));
    const ry = playRect.y + rng()*(Math.max(1, playRect.h - size));
    box.x = rx; box.y = ry;
  }

  const el = DOC.createElement('button');
  const id = `t_${uid()}`;
  el.className = 'plateTarget';
  el.type = 'button';
  el.setAttribute('data-id', id);
  el.setAttribute('data-kind', spec.kind);
  if(spec.kind === 'good') el.setAttribute('data-group', String(spec.groupIdx));
  el.textContent = spec.emoji;

  el.style.position = 'fixed';
  el.style.left = `${Math.round(box.x)}px`;
  el.style.top  = `${Math.round(box.y)}px`;
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
  el.style.transform = 'translateZ(0)';

  // spawn pop-in + ripple
  el.classList.add('spawnIn');
  setTimeout(()=>{ try{ el.classList.remove('spawnIn'); }catch(e){} }, 260);

  on(el, 'pointerdown', (e)=>{
    e.preventDefault();
    if(!running || paused) return;
    onHit(id);
  }, { passive:false });

  layer.appendChild(el);

  const born = nowMs();
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

// ------------------------- Hit / Miss handling -------------------------
function onHit(id){
  const t = targets.get(id);
  if(!t) return;

  const rt = Math.max(0, nowMs() - t.bornMs);
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
    if(rt <= 420){
      add += 35;
      perfectHits++;
      fxCrit(); // ✅ CRITICAL FLASH
    }
    else if(rt <= 650){ add += 20; }
    add += Math.min(40, combo * 2);

    score += add;
    rtGood.push(rt);
    fxPulse('good');
    coolFever(base.feverDownGood);

    if(activeMini && activeMini.key === 'plate-rush'){
      const haveN = plateHave.filter(Boolean).length;
      const tl = miniTimeLeft();
      if(haveN >= 5 && (tl != null && tl > 0)){
        finishMini(true, 'rush-complete');
      }
    }

  } else if(kind === 'junk'){
    ensureShieldActive();

    if(activeMini && activeMini.forbidJunk){
      if(shieldActive){
        shield = Math.max(0, shield - 1);
        nHitJunkGuard++;
        coach('โล่ช่วยไว้! 🛡️ (mini ยังอยู่)', 'neutral');
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
        coach('โล่กันขยะ! 🛡️', 'neutral');
        judge('🛡️ BLOCK!', 'warn');
        fxPulse('good');
      }else{
        nHitJunk++;
        miss++;
        combo = 0;
        score = Math.max(0, score - 60);
        addFever(base.feverUpJunk);
        fxPulse('bad'); fxShake();
        coach('โอ๊ย! โดนขยะ 😵', (fever>70?'fever':'sad'));
        judge('💥 JUNK!', 'bad');
      }
    }
    ensureShieldActive();
  } else if(kind === 'shield'){
    shield = clamp(shield + 1, 0, 9);
    ensureShieldActive();
    score += 40;
    fxPulse('good');
    coach('ได้โล่แล้ว! 🛡️', 'happy');
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
  }
  updateGoals();
  updateHUD();
}

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

  emit('hha:adaptive', { game:'plate', adapt:{...adapt}, acc, rtAvg });
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

  if(dt > 0 && isFinite(dt)){
    const newLeft = Math.max(0, tLeftSec - dt);
    if(Math.floor(newLeft) !== Math.floor(tLeftSec)){
      emit('hha:time', { game:'plate', timeLeftSec: Math.ceil(newLeft) });
    }
    tLeftSec = newLeft;
  }

  if(activeMini){
    const tl = miniTimeLeft();
    if(tl != null){
      if(tl <= 3.2 && tl > 0){
        fxTick();
        if(Math.ceil(tl) !== playTickSound._lastSec){
          playTickSound._lastSec = Math.ceil(tl);
          playTickSound();
        }
        if(tl <= 1.2) fxShake();
        if(tl <= 2.0) fxBlink();

        // --- MINI pressure / vignette override ---
        try{
          const panic = clamp((3.2 - tl) / 3.2, 0, 1);
          const feverV = clamp((fever - 35) / 65, 0, 1);
          setPressureVignette(Math.max(feverV, panic));

          if(tl <= 2.6) DOC.body.classList.add('hha-miniPanic');
          else DOC.body.classList.remove('hha-miniPanic');
        }catch(e){}
      }
      if(tl <= 0){
        finishMini(false, 'timeout');
      }
    }
  } else {
    // reset mini panic class + vignette back to fever
    try{ DOC.body.classList.remove('hha-miniPanic'); }catch(e){}
    const feverV = clamp((fever - 35) / 65, 0, 1);
    setPressureVignette(feverV);
  }

  const tune = currentTunings();
  spawnAccum += dt * tune.spawnPerSec;
  while(spawnAccum >= 1){
    spawnAccum -= 1;
    spawnTarget();
    maybeSpawnShield();
  }

  for(const [id, tObj] of targets){
    if((t - tObj.bornMs) >= tObj.lifeMs){
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

function bootButtons(){
  on(btnPause, 'click', ()=>{
    if(!running) return;
    setPaused(!paused);
  }, { passive:true });

  on(btnRestart, 'click', ()=>{
    restartGame('restart');
  }, { passive:true });

  on(btnEnterVR, 'click', ()=>{
    try{
      const scene = DOC.querySelector('a-scene');
      if(scene && scene.enterVR) scene.enterVR();
    }catch(e){}
  }, { passive:true });

  on(btnBackHub, 'click', async ()=>{
    await flushHardened('back-hub');
    if(hubUrl){
      location.href = hubUrl;
    }else{
      location.href = './hub.html';
    }
  }, { passive:true });

  on(btnPlayAgain, 'click', async ()=>{
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

  on(ROOT, 'beforeunload', ()=>{
    try{ flushHardened('beforeunload'); }catch(err){}
  });
}

function resetState(){
  running = false;
  paused = false;

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
  adaptiveOn = !isStudy;

  goalsTotal = 2;
  goalsCleared = 0;
  miniCleared = 0;

  activeGoal = null;
  activeMini = null;

  clearAllTargets();
  if(resultBackdrop) resultBackdrop.style.display = 'none';
  if(hudPaused) hudPaused.style.display = 'none';

  // reset fx vars/classes
  setCssVar('--hha-comboGlow', '0');
  setPressureVignette(0);
  try{
    DOC.body.classList.remove('hha-miniPanic','hha-dangerPulse');
  }catch(e){}
}

function startGame(){
  if(running) return;
  resetState();

  if(startOverlay) startOverlay.style.display = 'none';

  enableGyroIfAllowed();
  bindDragLook();
  applyLook();

  startGoals();
  coach('พร้อมลุย! เติมจานให้ครบ 5 หมู่ 💪', 'neutral');
  judge('▶️ START!', 'good');

  running = true;
  paused = false;

  tStartMs = nowMs();
  tLastTickMs = tStartMs;

  updateHUD();
  emit('hha:time', { game:'plate', timeLeftSec: Math.ceil(tLeftSec) });

  for(let i=0;i<4;i++) spawnTarget();
  requestAnimationFrame(tick);
}

async function restartGame(reason){
  await flushHardened(reason || 'restart');
  const u = new URL(location.href);
  if(!isStudy){
    u.searchParams.set('seed', String(Date.now() ^ (Math.random()*1e9)));
  }
  location.href = u.toString();
}

// ------------------------- End summary + flush-hardened -------------------------
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

  if(activeGoal && activeGoal.key === 'accuracy'){
    activeGoal.cur = Math.round(acc);
    if(acc >= activeGoal.target){
      activeGoal.done = true;
      goalsCleared++;
    }
  }

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
    miniTotal: miniCleared,
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
    device: (navigator && navigator.userAgent) ? navigator.userAgent : '',
    gameVersion: URLX.searchParams.get('v') || URLX.searchParams.get('ver') || '',
    hub: hubUrl || '',
  };
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

  const summary = buildSummary(reason);
  storeSummary(summary);

  emit('hha:end', { game:'plate', summary });
  emit('hha:celebrate', { game:'plate', kind:'end' });

  coach('จบเกมแล้ว! ดูสรุปผลได้เลย 🏁', (summary.grade==='C'?'sad':'happy'));
  judge('🏁 END', 'good');

  showResult(summary);
  updateHUD();

  await flushHardened(reason || 'end');
}

// ------------------------- Init -------------------------
(function init(){
  setText('uiDiffPreview', diff);
  setText('uiTimePreview', timePlannedSec);
  setText('uiRunPreview', runMode);

  resetState();
  updateHUD();
  emitQuestUpdate();

  bootButtons();

  if(startOverlay) startOverlay.style.display = 'grid';
  applyLook();
})();