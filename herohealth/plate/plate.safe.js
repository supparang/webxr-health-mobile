// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — ULTIMATE+ “แตก” PRODUCTION
// ✅ Play: adaptive ON
// ✅ Study/Research: deterministic seed + adaptive OFF
// ✅ Adds: Rage meter (pressure) + Rage Break “Storm” when rage hits 100
// ✅ Adds: Gold (bonus) + GoldFake/Trap (stun+slow)
// ✅ Adds: Boss Phase REAL: pattern-based required group sequence + HP (progress) in MINI bar
// ✅ Uses existing HTML ids only (no markup changes)
// ✅ Emits: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end, hha:celebrate, hha:adaptive
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

// ✅ Pressure: Rage + statuses + RageBreak storm
let rage = 0;              // 0..100
let slowUntilMs = 0;
let stunUntilMs = 0;

let rageBreakUntilMs = 0;
let rageBreakCount = 0;

function isSlow(){ return nowMs() < slowUntilMs; }
function isStun(){ return nowMs() < stunUntilMs; }
function isRageBreak(){ return nowMs() < rageBreakUntilMs; }

// metrics
let nTargetGoodSpawned = 0;
let nTargetJunkSpawned = 0;
let nTargetShieldSpawned = 0;
let nTargetGoldSpawned = 0;
let nTargetGoldFakeSpawned = 0;

let nHitGood = 0;
let nHitJunk = 0;
let nHitJunkGuard = 0;
let nHitShield = 0;
let nHitGold = 0;
let nHitGoldFake = 0;

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

// ------------------------- CSS Vars / classes -------------------------
function setCssVars(){
  DOC.body.style.setProperty('--rage', String(clamp(rage,0,100)));
  DOC.body.style.setProperty('--fever', String(clamp(fever,0,100)));
  DOC.body.classList.toggle('is-slow', isSlow());
  DOC.body.classList.toggle('is-stun', isStun());
  DOC.body.classList.toggle('is-ragebreak', isRageBreak());
}

function addRage(amount){
  rage = clamp(rage + (Number(amount)||0), 0, 100);
  if(!isStudy && rage >= 100){
    triggerRageBreak();
  }else if(rage >= 80){
    coach('RAGE ใกล้แตกแล้ว! ระวังพลาด! 😈', 'fever');
  }
  setCssVars();
}
function coolRage(amount){
  rage = clamp(rage - (Number(amount)||0), 0, 100);
  setCssVars();
}
function applySlow(ms){
  slowUntilMs = Math.max(slowUntilMs, nowMs() + (Number(ms)||0));
  judge('🧊 SLOW!', 'warn');
  setCssVars();
}
function applyStun(ms){
  stunUntilMs = Math.max(stunUntilMs, nowMs() + (Number(ms)||0));
  judge('💫 STUN!', 'bad');
  fxShake();
  setCssVars();
}

// ✅ Rage Break Storm
function triggerRageBreak(){
  if(isRageBreak()) return;
  rageBreakCount++;
  const dur = (diff === 'hard') ? 4.8 : (diff === 'easy' ? 3.8 : 4.2);
  rageBreakUntilMs = nowMs() + dur*1000;

  // back off rage a bit so it isn't infinite loop, but still scary
  rage = 68;

  // give tiny mercy on shield sometimes
  if(shield <= 0 && rng() < 0.55) shield = 1;

  coach('💥 RAGE BREAK! STORM มาแล้ว!!', 'fever');
  judge('💥 RAGE BREAK STORM!', 'bad');
  fxBlink(); fxShake();
  setCssVars();
}

// ------------------------- HUD update -------------------------
function updateHUD(){
  setCssVars();

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
    rage,
    rageBreak: isRageBreak(),
    status: { slow: isSlow(), stun: isStun() },
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
    };
    img.src = map[m] || map.neutral;
  }
}

function judge(text, kind){
  emit('hha:judge', { game:'plate', text, kind: kind||'info' });
}

// ------------------------- Mini quests (chain: Rush -> Boss Phase REAL) -------------------------
function makeMiniPlateRush(){
  return {
    key:'plate-rush',
    title:'Plate Rush: ครบ 5 หมู่ใน 8 วิ + ห้ามโดนขยะ',
    forbidJunk:true,
    forbidMiss:false,
    durationSec: 8,
    targetHits: 0,
    curHits: 0,
    startedMs: 0,
    done:false,
    fail:false,
    reason:'',
  };
}

function makeBossPhase(){
  // pattern-based sequence
  const hits = (diff === 'hard') ? 16 : (diff === 'easy' ? 12 : 14);
  const dur  = (diff === 'hard') ? 11 : (diff === 'easy' ? 13 : 12);

  // deterministic-ish pattern from seed
  const basePattern = [0,1,2,3,4];
  // rotate by seed
  const rot = (seed >>> 0) % 5;
  const pattern = basePattern.slice(rot).concat(basePattern.slice(0,rot));

  return {
    key:'boss-phase',
    title:`BOSS PHASE: ทำตามลำดับหมู่ให้ครบ ${hits} ครั้ง`,
    forbidJunk:true,
    forbidMiss:true,
    durationSec: dur,
    targetHits: hits,
    curHits: 0,
    pattern,             // e.g. [2,3,4,0,1]
    patternIndex: 0,     // next required index in pattern
    startedMs: 0,
    done:false,
    fail:false,
    reason:'',
  };
}

function requiredGroupIdx(){
  if(!activeMini || activeMini.key !== 'boss-phase') return null;
  const pat = activeMini.pattern || [0,1,2,3,4];
  return pat[activeMini.patternIndex % pat.length];
}
function requiredEmoji(){
  const gi = requiredGroupIdx();
  return (gi==null) ? '' : groupEmojis[gi];
}

function startMini(mini){
  activeMini = mini;
  activeMini.startedMs = nowMs();

  const tl = activeMini.durationSec;
  const label =
    activeMini.key === 'boss-phase'
      ? `${activeMini.title} (ต่อไป: ${requiredEmoji()})`
      : activeMini.title;

  setText('uiMiniTitle', label);
  setText('uiHint',
    activeMini.key === 'boss-phase'
      ? `ต่อไปต้องเก็บ: ${requiredEmoji()} (ถ้าผิดลำดับ = โดนลงโทษ) ห้ามโดนขยะ/ห้ามพลาด!`
      : 'ทริค: เร่งเก็บหมู่ที่ยังขาด! ระวังขยะห้ามโดน!'
  );

  judge(activeMini.key === 'boss-phase' ? '😈 BOSS PHASE START!' : '⚡ Plate Rush เริ่มแล้ว!', 'warn');

  // pressure bump
  if(activeMini.key === 'boss-phase'){
    addRage(12);
    fxBlink();
  }else{
    addRage(6);
  }

  emitQuestUpdate();
  updateHUD();
}

function miniTimeLeft(){
  if(!activeMini) return null;
  const elapsed = (nowMs() - activeMini.startedMs) / 1000;
  return Math.max(0, activeMini.durationSec - elapsed);
}

function finishMini(ok, reason){
  if(!activeMini || activeMini.done) return;
  activeMini.done = true;
  activeMini.fail = !ok;
  activeMini.reason = reason || (ok ? 'ok' : 'fail');

  if(ok){
    miniCleared++;
    emit('hha:celebrate', { game:'plate', kind:'mini' });

    if(activeMini.key === 'boss-phase'){
      score += 520;
      shield = clamp(shield + 2, 0, 9);
      coolRage(22);
      coach('บอสพัง!! โคตรสุด!! 🏆🔥', 'happy');
      judge('🏆 BOSS CLEARED!', 'good');
    }else{
      // Rush success -> boss starts
      score += 120;
      shield = clamp(shield + 1, 0, 9);
      coolRage(10);
      coach('Rush ผ่าน! ต่อด้วยบอส! 😈', 'happy');
      judge('✅ RUSH CLEAR → BOSS!', 'good');

      startMini(makeBossPhase());
      return;
    }
  }else{
    addRage(12);
    coach('พลาดนิดเดียว! เอาใหม่ให้แตก 💪', (fever>70 || rage>70 ? 'fever' : 'sad'));
    judge('❌ MINI FAILED', 'bad');
  }

  activeMini = null;
  emitQuestUpdate();
  updateHUD();
}

function emitQuestUpdate(){
  const goalObj = activeGoal
    ? { title: activeGoal.title, cur: activeGoal.cur, target: activeGoal.target, done: activeGoal.done }
    : null;

  let miniObj = { title:'—', cur:0, target:0, timeLeft:null, done:false };

  if(activeMini){
    const tl = miniTimeLeft();
    if(activeMini.key === 'boss-phase'){
      miniObj = {
        title: `${activeMini.title} (ต่อไป: ${requiredEmoji()})`,
        cur: activeMini.curHits || 0,
        target: activeMini.targetHits || 0,
        timeLeft: tl,
        done:false
      };
      // UI: show hit progress as "cur/target"
      setText('uiMiniCount', `${activeMini.curHits||0}/${activeMini.targetHits||0}`);
    }else{
      miniObj = {
        title: activeMini.title,
        cur: 0,
        target: activeMini.durationSec,
        timeLeft: tl,
        done:false
      };
      setText('uiMiniCount', `${miniCleared}/${Math.max(minisTotal, miniCleared+1)}`);
    }
    setText('uiMiniTime', tl==null?'--':`${Math.ceil(tl)}s`);

    const mf = qs('uiMiniFill');
    if(mf){
      let pct = 0;
      if(activeMini.key === 'boss-phase'){
        pct = activeMini.targetHits ? (activeMini.curHits/activeMini.targetHits*100) : 0;
      }else{
        pct = activeMini.durationSec ? ((activeMini.durationSec - (tl||0)) / activeMini.durationSec) * 100 : 0;
      }
      mf.style.width = `${clamp(pct,0,100)}%`;
    }

    setText('uiMiniTitle', miniObj.title);
  }else{
    setText('uiMiniTitle','—');
    setText('uiMiniTime','--');
    const mf = qs('uiMiniFill'); if(mf) mf.style.width = `0%`;
    setText('uiMiniCount', `${miniCleared}/${Math.max(minisTotal, miniCleared+1)}`);
  }

  emit('quest:update', { game:'plate', goal: goalObj, mini: miniObj });

  if(activeGoal){
    setText('uiGoalTitle', activeGoal.title);
    setText('uiGoalCount', `${activeGoal.cur}/${activeGoal.target}`);
    const gf = qs('uiGoalFill');
    if(gf) gf.style.width = `${(activeGoal.target? (activeGoal.cur/activeGoal.target*100):0)}%`;
  }else{
    setText('uiGoalTitle', '—');
    setText('uiGoalCount', '0/0');
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
      coach('ครบ 5 หมู่แล้ว! เริ่ม Rush → Boss 😈', 'happy');
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
  setCssVars();
  updateHUD();
}
function coolFever(amount){
  fever = clamp(fever - (Number(amount)||0), 0, 100);
  setCssVars();
  updateHUD();
}
function ensureShieldActive(){
  shieldActive = (shield > 0);
}

// ------------------------- Target spawning (gold/goldfake + boss bias + ragebreak) -------------------------
const goodPool = groupEmojis.map((e,i)=>({ emoji:e, groupIdx:i, kind:'good' }));
const junkPool = ['🍟','🍕','🥤','🍩','🍭','🧁','🍔','🌭','🍫','🧋'].map(e=>({ emoji:e, kind:'junk' }));
const shieldEmoji = { emoji:'🛡️', kind:'shield' };
const goldEmoji = { emoji:'🌟', kind:'gold' };
const goldFakeEmoji = { emoji:'💫', kind:'goldfake' };

function currentTunings(){
  let size = base.size * adapt.sizeMul;
  let lifeMs = base.lifeMs;
  let spawnPerSec = base.spawnPerSec * adapt.spawnMul;
  let junkRate = clamp(base.junkRate * adapt.junkMul, 0.08, 0.55);

  // fever pressure
  if(!isStudy){
    const f = fever/100;
    spawnPerSec *= (1 + f*0.15);
    junkRate = clamp(junkRate + f*0.05, 0.08, 0.60);
  }

  // rage pressure
  if(!isStudy){
    const r = rage/100;
    spawnPerSec *= (1 + r*0.25);
    junkRate = clamp(junkRate + r*0.08, 0.08, 0.68);
  }

  // rage break storm (heavy!)
  if(isRageBreak()){
    spawnPerSec *= 1.85;
    junkRate = clamp(junkRate + 0.16, 0.10, 0.82);
    lifeMs *= 0.92;
    size *= 0.96;
  }

  // slow/stun
  if(isSlow()){
    spawnPerSec *= 0.62;
    size *= 1.08;
    lifeMs *= 1.20;
  }
  if(isStun()){
    spawnPerSec *= 0.78;
    junkRate = clamp(junkRate + 0.04, 0.08, 0.85);
  }

  size = clamp(size, 38, 92);
  spawnPerSec = clamp(spawnPerSec, 0.75, 4.3);
  lifeMs = clamp(lifeMs, 820, 2700);

  return { size, lifeMs, spawnPerSec, junkRate };
}

function maybeSpawnShield(){
  if(isStudy) return;
  if(shield >= 3) return;

  // during ragebreak: more shield chance (fairness)
  const chance = isRageBreak() ? 0.12 : ((fever >= 70 || rage >= 70) ? 0.08 : 0.03);
  if(rng() < chance){
    spawnTarget('shield');
  }
}

function maybeSpawnGoldKind(){
  if(isStudy) return null;

  const c = clamp(combo, 0, 80);
  const r = rage/100;
  const f = fever/100;

  // ragebreak: gold appears slightly more (comeback hook)
  const rb = isRageBreak() ? 0.010 : 0;

  const goldChance = clamp(0.008 + (c/80)*0.010 + rb, 0.008, 0.030);
  const fakeChance = clamp(0.006 + r*0.016 + f*0.008 + (isRageBreak()?0.010:0), 0.006, 0.045);

  const roll = rng();
  if(roll < goldChance) return 'gold';
  if(roll < goldChance + fakeChance) return 'goldfake';
  return null;
}

function bossPickGood(){
  // During boss-phase: bias to required group
  const req = requiredGroupIdx();
  if(req == null) return pick(rng, goodPool);

  const bias = isRageBreak() ? 0.60 : 0.72;
  if(rng() < bias){
    return { emoji: groupEmojis[req], groupIdx: req, kind:'good' };
  }
  return pick(rng, goodPool);
}

function spawnTarget(forcedKind){
  if(!layer) return;
  const tune = currentTunings();

  const playRect = getPlayRect();
  const noRects = buildNoSpawnRects();

  let kind = forcedKind;

  if(!kind){
    ensureShieldActive();

    // Special first
    const special = maybeSpawnGoldKind();
    if(special) kind = special;
    else if(!isStudy && shield < 2 && (fever >= 65 || rage >= 70) && rng() < 0.06) kind = 'shield';
    else kind = (rng() < tune.junkRate) ? 'junk' : 'good';
  }

  let spec;
  if(kind === 'good'){
    spec = (activeMini && activeMini.key === 'boss-phase') ? bossPickGood() : pick(rng, goodPool);
  } else if(kind === 'junk'){
    spec = pick(rng, junkPool);
  } else if(kind === 'shield'){
    spec = shieldEmoji;
  } else if(kind === 'gold'){
    spec = goldEmoji;
  } else {
    spec = goldFakeEmoji;
  }

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
  if(spec.kind === 'gold') el.classList.add('gold');
  if(spec.kind === 'goldfake') el.classList.add('goldfake');

  el.textContent = spec.emoji;

  el.style.position = 'fixed';
  el.style.left = `${Math.round(box.x)}px`;
  el.style.top  = `${Math.round(box.y)}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;

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
  else if(spec.kind === 'shield') nTargetShieldSpawned++;
  else if(spec.kind === 'gold') nTargetGoldSpawned++;
  else nTargetGoldFakeSpawned++;

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

  // GOOD
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
    add += Math.min(60, combo * 2);

    score += add;
    rtGood.push(rt);
    fxPulse('good');

    // cool fever + rage
    coolFever(base.feverDownGood);
    coolRage(3.8);

    // Rush pass
    if(activeMini && activeMini.key === 'plate-rush'){
      const haveN = plateHave.filter(Boolean).length;
      const tl = miniTimeLeft();
      if(haveN >= 5 && (tl != null && tl > 0)){
        finishMini(true, 'rush-complete');
        updateGoals();
        updateHUD();
        return;
      }
    }

    // Boss Phase progress (pattern-based)
    if(activeMini && activeMini.key === 'boss-phase'){
      const req = requiredGroupIdx();

      if(req != null && gi === req){
        activeMini.curHits = (activeMini.curHits||0) + 1;
        activeMini.patternIndex = (activeMini.patternIndex||0) + 1;

        judge(`✅ ถูกลำดับ! ต่อไป: ${requiredEmoji()}`, 'good');

        // reward: small rage cool
        coolRage(2.8);

        if(activeMini.curHits >= activeMini.targetHits && (miniTimeLeft()||0) > 0){
          finishMini(true, 'boss-clear');
          updateGoals();
          updateHUD();
          return;
        }
      }else{
        // wrong order penalty
        combo = 0;
        score = Math.max(0, score - 55);
        addFever(7);
        addRage(12);
        fxPulse('bad'); fxShake();
        judge(`❌ ผิดลำดับ! ต้องเก็บ ${requiredEmoji()} ก่อน`, 'bad');

        // heavy penalty during last seconds
        if((miniTimeLeft()||0) <= 3.0) applyStun(600);
      }
    }

  // JUNK
  } else if(kind === 'junk'){
    ensureShieldActive();

    const forbid = activeMini && activeMini.forbidJunk;

    if(forbid){
      if(shieldActive){
        shield = Math.max(0, shield - 1);
        nHitJunkGuard++;
        coach('โล่ช่วยไว้! 🛡️ (mini ยังอยู่)', 'neutral');
        judge('🛡️ BLOCKED!', 'warn');
        fxPulse('good');
      }else{
        nHitJunk++;
        miss++;
        combo = 0;
        score = Math.max(0, score - 75);
        addFever(base.feverUpJunk);
        addRage(16);
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
        score = Math.max(0, score - 75);
        addFever(base.feverUpJunk);
        addRage(14);
        fxPulse('bad'); fxShake();
        coach('โอ๊ย! โดนขยะ 😵', (fever>70 || rage>70?'fever':'sad'));
        judge('💥 JUNK!', 'bad');
      }
    }

    ensureShieldActive();

  // SHIELD
  } else if(kind === 'shield'){
    nHitShield++;
    shield = clamp(shield + 1, 0, 9);
    ensureShieldActive();
    score += 45;
    fxPulse('good');
    coolRage(5);
    coach('ได้โล่แล้ว! 🛡️', 'happy');
    judge('🛡️ +1 SHIELD', 'good');

  // GOLD
  } else if(kind === 'gold'){
    nHitGold++;
    score += 240 + Math.min(140, combo*3);
    shield = clamp(shield + 1, 0, 9);
    ensureShieldActive();
    coolFever(12);
    coolRage(16);
    fxPulse('good');
    emit('hha:celebrate', { game:'plate', kind:'gold' });
    coach('🌟 GOLD! โบนัสมาแล้ว! โคตรคุ้ม!', 'happy');
    judge('🌟 GOLD BONUS!', 'good');

    // during ragebreak, gold can shorten storm a bit (comeback)
    if(isRageBreak() && rng() < 0.60){
      rageBreakUntilMs = Math.max(nowMs(), rageBreakUntilMs - 800);
      judge('🌟 STORM เบาลง!', 'good');
    }

  // GOLD FAKE / TRAP
  } else if(kind === 'goldfake'){
    nHitGoldFake++;
    combo = 0;
    score = Math.max(0, score - 95);

    addFever(12);
    addRage(18);

    applyStun(950);
    applySlow(1650);

    fxPulse('bad'); fxShake(); fxBlink();
    coach('💫 ทองปลอม! โดนกับดัก! 😈', 'fever');
    judge('💫 GOLD TRAP!', 'bad');

    // in mini that forbids junk, trap fails
    if(activeMini && activeMini.forbidJunk){
      finishMini(false, 'goldfake-trap');
    }
  }

  if(adaptiveOn) updateAdaptive();

  updateGoals();
  emitQuestUpdate();
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
    addRage(12);
    fxPulse('bad');

    if(activeMini && activeMini.forbidMiss){
      finishMini(false, 'expire-good');
    }
  }

  updateGoals();
  emitQuestUpdate();
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

  // Mini near end effects
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
      }
      if(tl <= 0){
        finishMini(false, 'timeout');
      }

      // boss pressure ramps last seconds
      if(activeMini.key === 'boss-phase' && tl <= 4.5){
        addRage(0.9);
      }
    }
  }

  // RageBreak: constant shakes/pulse slight
  if(isRageBreak()){
    if((t|0) % 520 < 16) fxShake();
    if((t|0) % 360 < 16) fxBlink();
  }else if(!isStudy){
    // natural rage decay when doing well
    const decay = (combo >= 6 ? 1.5 : 0.6) * dt;
    coolRage(decay);
  }

  const tune = currentTunings();
  spawnAccum += dt * tune.spawnPerSec;

  while(spawnAccum >= 1){
    spawnAccum -= 1;
    spawnTarget();
    maybeSpawnShield();

    // during ragebreak, sprinkle extra junk + extra gold chance (drama)
    if(isRageBreak() && rng() < 0.18) spawnTarget('junk');
    if(isRageBreak() && rng() < 0.10) spawnTarget('gold');
  }

  for(const [id, tObj] of targets){
    if((t - tObj.bornMs) >= tObj.lifeMs){
      onExpireTarget(id);
    }
  }

  updateGoals();
  emitQuestUpdate();
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
    location.href = hubUrl ? hubUrl : './hub.html';
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

  rage = 0;
  slowUntilMs = 0;
  stunUntilMs = 0;
  rageBreakUntilMs = 0;
  rageBreakCount = 0;

  nTargetGoodSpawned = 0;
  nTargetJunkSpawned = 0;
  nTargetShieldSpawned = 0;
  nTargetGoldSpawned = 0;
  nTargetGoldFakeSpawned = 0;

  nHitGood = 0;
  nHitJunk = 0;
  nHitJunkGuard = 0;
  nHitShield = 0;
  nHitGold = 0;
  nHitGoldFake = 0;

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

  setCssVars();
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

    // spawns
    nTargetGoodSpawned,
    nTargetJunkSpawned,
    nTargetShieldSpawned,
    nTargetGoldSpawned,
    nTargetGoldFakeSpawned,

    // hits
    nHitGood,
    nHitJunk,
    nHitJunkGuard,
    nHitShield,
    nHitGold,
    nHitGoldFake,

    nExpireGood,
    accuracyGoodPct: Math.round(acc*10)/10,
    junkErrorPct: Math.round(junkErrorPct*10)/10,
    avgRtGoodMs: Math.round(avgRt),
    medianRtGoodMs: Math.round(medRt),
    fastHitRatePct: Math.round(fastHitRatePct*10)/10,
    grade,

    rageEnd: Math.round(rage),
    feverEnd: Math.round(fever),
    rageBreakCount,

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