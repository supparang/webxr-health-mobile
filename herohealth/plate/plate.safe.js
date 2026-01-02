// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION (HHA Standard + VR-feel + Plate Rush + Safe Spawn + AI + Boss + Pattern)
// ✅ Play: adaptive ON (AI Director)
// ✅ Study/Research: deterministic seed + adaptive OFF (AI Coach = text only)
// ✅ Crosshair shoot: listens hha:shoot (vr-ui.js)
// ✅ Pattern generator seeded: ?pattern=mix|grid|ring|edges|center
// ✅ Boss window (play): 10s peak + fair success snapshot + bonus
// ✅ Emits: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end, hha:celebrate, hha:boss, hha:ai-director, hha:adaptive
// ✅ End summary: localStorage HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY
// ✅ Flush-hardened: before end/back hub/reload
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

// ✅ NEW: pattern generator (seeded)
const pattern = (URLX.searchParams.get('pattern') || 'mix').toLowerCase();

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

// PATCH B: keep last applied shift (for spawn compensation)
let lookShift = { x:0, y:0 };

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

// PATCH B: cache layout (debounced) — ลดเป้าแว๊บและกัน spawn เพี้ยนหลัง EnterVR/rotate
let layoutCache = {
  W: 360, H: 640,
  playRect: { x:10, y:80, w:340, h:480 },
  noRects: [],
  stamp: 0
};

function viewportSize(){
  // visualViewport ช่วยมากตอน EnterVR / mobile address bar
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

  // relax if too small
  if(playRect.w < 140 || playRect.h < 180){
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

let goalsTotal = 2;
let goalsCleared = 0;

let minisTotal = 999;
let miniCleared = 0;

let activeGoal = null;
let activeMini = null;

// ✅ NEW: crosshair shooting stats (for summary)
let shotsFired = 0;
let shotsMiss = 0;

// ✅ NEW: Boss Window (play)
let boss = {
  active:false,
  endsAtMs:0,
  nextAtSec: 28,
  everySec: 26,
  bonus: 180,
  snap: { miss:0, hitJunk:0 }
};

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
    bossActive: boss.active,
    pattern,
    shotsFired,
    shotsMiss
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

// ------------------------- AI Coach (Micro tips + rate limit) -------------------------
const AIC = {
  lastAt: 0,
  lastKey: '',
  streakMiss: 0,
  streakGood: 0,
  lastAccHintAt: 0,
  lastFeverHintAt: 0,
  lastMiniHintAt: 0,
  lastComboHintAt: 0,
};

function aiEnabled(){
  const qp = (()=>{ try{ return new URL(location.href).searchParams; }catch(e){ return null; }})();
  const ai = qp ? (qp.get('ai')||'on').toLowerCase() : 'on';
  const policy = qp ? (qp.get('policy')||'').toLowerCase() : '';
  if(policy === 'research') return true;
  return (ai !== 'off');
}
function aiCooldownMs(){
  return isStudy ? 14000 : 9500;
}
function aiSay(key, msg, mood){
  if(!aiEnabled()) return;
  const now = Date.now();
  const cd = aiCooldownMs();
  if(now - AIC.lastAt < cd) return;
  if(key && key === AIC.lastKey && (now - AIC.lastAt) < cd*2.0) return;
  AIC.lastAt = now;
  AIC.lastKey = key || '';
  coach(msg, mood || 'neutral');
}
function aiOnGoodHit(rt){
  AIC.streakGood++;
  AIC.streakMiss = 0;

  if(AIC.streakGood === 5 && miss >= 2){
    aiSay('recover', 'ดีมาก! กลับมาแม่นแล้ว 👍 โฟกัสเก็บ good ต่อเนื่อง', 'happy');
  }
  if(!isStudy && rt != null && rt <= 420 && AIC.streakGood === 6){
    aiSay('perfect-chain', 'โหด! จังหวะดีมาก 🔥 ลองรักษา combo ให้ยาวขึ้น!', 'happy');
  }
}
function aiOnJunkHit(blocked){
  AIC.streakGood = 0;
  AIC.streakMiss++;

  if(blocked){
    aiSay('shield-use', 'โล่ช่วยไว้! 🛡️ ถ้า FEVER สูงให้มองหาโล่เพิ่ม', 'neutral');
    return;
  }
  if(AIC.streakMiss >= 2){
    aiSay('junk-streak', 'โดนขยะติดกันเลย 😵 ลอง “ช้าลงนิด” แล้วเล็งเฉพาะ good', (fever>70?'fever':'sad'));
  }else{
    aiSay('junk-once', 'ระวังขยะนะ! เล็ง good ก่อน แล้วค่อยเสี่ยง 🔍', (fever>70?'fever':'neutral'));
  }
}
function aiOnMissExpire(){
  AIC.streakGood = 0;
  AIC.streakMiss++;

  if(AIC.streakMiss === 2){
    aiSay('miss2', 'พลาด 2 ครั้งแล้ว—ลอง “คุมจังหวะ” อย่ากดรัว 🙂', 'neutral');
  }else if(AIC.streakMiss >= 4){
    aiSay('miss4', 'พลาดรัว ๆ เลย 😮‍💨 แนะนำ: โฟกัสเป้าที่ใกล้ ๆ ก่อน ลดการส่าย', (fever>70?'fever':'sad'));
  }
}
function aiTickHints(){
  if(!aiEnabled()) return;

  const now = Date.now();
  const acc = accuracyPct();
  const tLeft = tLeftSec;

  if(fever >= 80 && now - AIC.lastFeverHintAt > (isStudy?18000:12000)){
    AIC.lastFeverHintAt = now;
    aiSay('fever-hi', 'FEVER สูงมาก 🔥 ถ้ามีโล่ให้เก็บไว้กันพลาด แล้วเลี่ยงขยะ!', 'fever');
  }
  if(tLeft <= 18 && acc < 78 && now - AIC.lastAccHintAt > (isStudy?20000:13000)){
    AIC.lastAccHintAt = now;
    aiSay('acc-end', 'ช่วงท้ายแล้ว! เน้นเก็บ good ชัวร์ ๆ เพื่อดันความแม่นยำ ⬆️', 'neutral');
  }
  if(!isStudy && combo >= 12 && now - AIC.lastComboHintAt > 14000){
    AIC.lastComboHintAt = now;
    aiSay('combo-keep', 'คอมโบกำลังสวย! 😎 เล่น safe ต่ออีกนิด ได้เกรด S/SS ง่ายขึ้น', 'happy');
  }
  if(activeMini){
    const tl = miniTimeLeft();
    if(tl != null && tl <= 3.2 && now - AIC.lastMiniHintAt > 9000){
      AIC.lastMiniHintAt = now;
      aiSay('mini-end', 'ใกล้หมดเวลาแล้ว! ⚡ รีบเก็บหมู่ที่ยังขาด และอย่าแตะขยะ!', 'warn');
    }
  }
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

// ------------------------- Boss Window -------------------------
function startBossWindow(){
  if(isStudy) return;
  boss.active = true;
  boss.endsAtMs = nowMs() + 10000;
  boss.snap = { miss, hitJunk: nHitJunk };

  judge('👾 BOSS WINDOW! 10s — ห้ามพลาด ห้ามโดนขยะ!', 'warn');
  coach('บอสมาแล้ว! 🔥 เล็งดี ๆ และเลี่ยงขยะ!', (fever>70?'fever':'neutral'));
  emit('hha:boss', { game:'plate', active:true, endsAt: boss.endsAtMs });

  for(let i=0;i<3;i++) spawnTarget('junk');
  spawnTarget('good');
}
function endBossWindow(success){
  boss.active = false;
  emit('hha:boss', { game:'plate', active:false });

  if(success){
    score += boss.bonus;
    shield = clamp(shield + 1, 0, 9);
    coach('ผ่านบอส! 🏆 โบนัส + โล่ + คะแนน!', 'happy');
    judge('🏆 BOSS CLEARED!', 'good');
    emit('hha:celebrate', { game:'plate', kind:'boss' });
  }else{
    coach('บอสยังโหดอยู่ 😵 รอบหน้าเอาใหม่!', (fever>70?'fever':'sad'));
    judge('💥 BOSS FAILED', 'bad');
  }
  updateHUD();
}

// ------------------------- Spawn Pattern Generator (seeded) -------------------------
function choosePointInPlayRect(size){
  const pr = layoutCache.playRect;
  const w = Math.max(1, pr.w - size);
  const h = Math.max(1, pr.h - size);
  return { sx: pr.x + rng()*w, sy: pr.y + rng()*h };
}
function choosePointGrid(size){
  const pr = layoutCache.playRect;
  const cols = 3, rows = 3;
  const ci = Math.floor(rng()*cols);
  const ri = Math.floor(rng()*rows);
  const cellW = pr.w / cols;
  const cellH = pr.h / rows;
  const jx = (rng()*0.70 + 0.15);
  const jy = (rng()*0.70 + 0.15);
  const sx = pr.x + ci*cellW + jx*(Math.max(1, cellW - size));
  const sy = pr.y + ri*cellH + jy*(Math.max(1, cellH - size));
  return { sx, sy };
}
function choosePointRing(size){
  const pr = layoutCache.playRect;
  const cx = pr.x + pr.w/2;
  const cy = pr.y + pr.h/2;
  const minR = Math.min(pr.w, pr.h) * 0.18;
  const maxR = Math.min(pr.w, pr.h) * 0.42;
  const r = minR + rng()*(maxR - minR);
  const ang = rng() * Math.PI * 2;
  const sx = cx + Math.cos(ang)*r - size/2;
  const sy = cy + Math.sin(ang)*r - size/2;
  return { sx, sy };
}
function choosePointEdges(size){
  const pr = layoutCache.playRect;
  const edge = Math.floor(rng()*4);
  const pad = 10;
  if(edge === 0){
    return { sx: pr.x + rng()*(Math.max(1, pr.w - size)), sy: pr.y + pad };
  }else if(edge === 1){
    return { sx: pr.x + pr.w - size - pad, sy: pr.y + rng()*(Math.max(1, pr.h - size)) };
  }else if(edge === 2){
    return { sx: pr.x + rng()*(Math.max(1, pr.w - size)), sy: pr.y + pr.h - size - pad };
  }else{
    return { sx: pr.x + pad, sy: pr.y + rng()*(Math.max(1, pr.h - size)) };
  }
}
function choosePointCenter(size){
  const pr = layoutCache.playRect;
  const cx = pr.x + pr.w/2;
  const cy = pr.y + pr.h/2;
  const spread = Math.min(pr.w, pr.h) * 0.18;
  const sx = cx + (rng()*2 - 1)*spread - size/2;
  const sy = cy + (rng()*2 - 1)*spread - size/2;
  return { sx, sy };
}
function choosePatternPoint(size){
  const p = pattern || 'mix';
  if(p === 'grid') return choosePointGrid(size);
  if(p === 'ring') return choosePointRing(size);
  if(p === 'edges') return choosePointEdges(size);
  if(p === 'center') return choosePointCenter(size);

  const r = rng();
  if(r < 0.28) return choosePointInPlayRect(size);
  if(r < 0.50) return choosePointGrid(size);
  if(r < 0.72) return choosePointRing(size);
  if(r < 0.86) return choosePointEdges(size);
  return choosePointCenter(size);
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

  // ✅ Boss window tuning (play only)
  if(!isStudy && boss.active){
    spawnPerSec *= 1.22;
    junkRate = clamp(junkRate + 0.10, 0.10, 0.75);
    size *= 0.96;
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
  const noRects = layoutCache.noRects;

  let kind = forcedKind;
  if(!kind){
    ensureShieldActive();
    if(!isStudy && shield < 2 && fever >= 65 && rng() < 0.05) kind = 'shield';
    else kind = (rng() < tune.junkRate) ? 'junk' : 'good';
  }

  // Boss flavor: junk bias during boss
  if(!isStudy && boss.active && !forcedKind && rng() < 0.18){
    kind = 'junk';
  }

  let spec;
  if(kind === 'good') spec = pick(rng, goodPool);
  else if(kind === 'junk') spec = pick(rng, junkPool);
  else spec = shieldEmoji;

  const size = tune.size;

  const shX = lookShift.x || 0;
  const shY = lookShift.y || 0;

  const screenBox = { x:0, y:0, w:size, h:size };
  let ok = false;

  const tries = 44;
  for(let i=0;i<tries;i++){
    const pt = choosePatternPoint(size);
    const sx = pt.sx;
    const sy = pt.sy;
    screenBox.x = sx; screenBox.y = sy;

    let hit = false;
    for(const rr of noRects){
      if(intersects(screenBox, rr)){ hit = true; break; }
    }
    if(!hit){ ok = true; break; }
  }

  if(!ok){
    const pt = choosePatternPoint(size);
    screenBox.x = pt.sx; screenBox.y = pt.sy;
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

// ------------------------- Crosshair Shoot (VR UI -> hha:shoot) -------------------------
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx + dy*dy; }

function findNearestTargetAt(x, y, lockPx){
  const lock = Math.max(8, Number(lockPx)||26);
  let bestId = null;
  let bestD2 = Infinity;

  for(const [id, t] of targets){
    if(!t || !t.el) continue;
    const r = t.el.getBoundingClientRect();
    if(!r || !isFinite(r.width)) continue;

    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;

    const thresh = lock + Math.max(6, r.width * 0.20);
    const d2 = dist2(x,y,cx,cy);
    if(d2 <= thresh*thresh && d2 < bestD2){
      bestD2 = d2;
      bestId = id;
    }
  }
  return bestId;
}

function onShootEvent(detail){
  if(!running || paused) return;

  shotsFired++;

  const x = detail && typeof detail.x === 'number' ? detail.x : (ROOT.innerWidth||360)/2;
  const y = detail && typeof detail.y === 'number' ? detail.y : (ROOT.innerHeight||640)/2;
  const lockPx = detail && detail.lockPx != null ? detail.lockPx : 26;
  const source = detail && detail.source ? String(detail.source) : 'shoot';

  const id = findNearestTargetAt(x, y, lockPx);

  if(id){
    onHit(id);

    // tiny bonus for shooting (kept minimal)
    if(source && source !== 'tapTouch'){
      score += 3;
      updateHUD();
    }
  }else{
    shotsMiss++;
    if(!isStudy){
      miss++;
      combo = 0;
      addFever(base.feverUpMiss * 0.6);
      judge('🎯 ยิงพลาด!', 'warn');
      fxTick();
      updateHUD();
    }
  }
}

(function bindShoot(){
  if(ROOT.__PLATE_SHOOT_BOUND__) return;
  ROOT.__PLATE_SHOOT_BOUND__ = true;
  ROOT.addEventListener('hha:shoot', (e)=>{
    try{ onShootEvent(e && e.detail ? e.detail : null); }catch(_){}
  }, { passive:true });
})();

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
    if(rt <= 420){ add += 35; perfectHits++; }
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

    aiOnGoodHit(rt);

  } else if(kind === 'junk'){
    ensureShieldActive();

    if(activeMini && activeMini.forbidJunk){
      if(shieldActive){
        shield = Math.max(0, shield - 1);
        nHitJunkGuard++;
        coach('โล่ช่วยไว้! 🛡️ (mini ยังอยู่)', 'neutral');
        judge('🛡️ BLOCKED!', 'warn');
        aiOnJunkHit(true);
      }else{
        nHitJunk++;
        miss++;
        combo = 0;
        score = Math.max(0, score - 60);
        addFever(base.feverUpJunk);
        fxPulse('bad'); fxShake();
        finishMini(false, 'hit-junk');
        aiOnJunkHit(false);
      }
    }else{
      if(shieldActive){
        shield = Math.max(0, shield - 1);
        nHitJunkGuard++;
        coach('โล่กันขยะ! 🛡️', 'neutral');
        judge('🛡️ BLOCK!', 'warn');
        fxPulse('good');
        aiOnJunkHit(true);
      }else{
        nHitJunk++;
        miss++;
        combo = 0;
        score = Math.max(0, score - 60);
        addFever(base.feverUpJunk);
        fxPulse('bad'); fxShake();
        coach('โอ๊ย! โดนขยะ 😵', (fever>70?'fever':'sad'));
        judge('💥 JUNK!', 'bad');
        aiOnJunkHit(false);
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
    aiOnMissExpire();
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

// ------------------------- AI Difficulty Director (Play only) -------------------------
const AID = {
  lastAt: 0,
  windowMs: 9000,
  lastScore: 0,
  lastMiss: 0,
};

function aiDirectorTick(){
  if(isStudy) return;
  const now = Date.now();
  if(now - AID.lastAt < AID.windowMs) return;
  AID.lastAt = now;

  const acc = accuracyPct();
  const rtN = rtGood.length;
  const rtAvg = rtN ? (rtGood.reduce((a,b)=>a+b,0)/rtN) : 900;
  const missDelta = miss - AID.lastMiss;
  const scoreDelta = score - AID.lastScore;

  AID.lastMiss = miss;
  AID.lastScore = score;

  let relax = 0;
  if(missDelta >= 3) relax += 1;
  if(acc < 70) relax += 1;
  if(rtAvg > 800) relax += 1;

  let tighten = 0;
  if(acc > 90 && rtAvg < 560 && missDelta === 0) tighten += 1;
  if(scoreDelta > 700) tighten += 1;

  if(fever >= 75) tighten = Math.max(0, tighten - 1);

  if(relax > tighten){
    adapt.sizeMul = clamp(adapt.sizeMul * 1.04, 0.90, 1.28);
    adapt.spawnMul = clamp(adapt.spawnMul * 0.96, 0.75, 1.22);
    adapt.junkMul = clamp(adapt.junkMul * 0.96, 0.75, 1.22);
    emit('hha:ai-director', { game:'plate', action:'relax', acc, rtAvg, missDelta, fever, adapt:{...adapt} });
  }else if(tighten > relax){
    adapt.sizeMul = clamp(adapt.sizeMul * 0.98, 0.84, 1.20);
    adapt.spawnMul = clamp(adapt.spawnMul * 1.04, 0.80, 1.30);
    adapt.junkMul  = clamp(adapt.junkMul  * 1.03, 0.80, 1.30);
    emit('hha:ai-director', { game:'plate', action:'tighten', acc, rtAvg, missDelta, fever, adapt:{...adapt} });
  }else{
    emit('hha:ai-director', { game:'plate', action:'hold', acc, rtAvg, missDelta, fever, adapt:{...adapt} });
  }
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

  // boss trigger by timeLeft (play)
  if(!isStudy){
    if(!boss.active && tLeftSec <= boss.nextAtSec){
      startBossWindow();
      boss.nextAtSec = Math.max(6, boss.nextAtSec - boss.everySec);
    }
  }

  if(dt > 0 && isFinite(dt)){
    const newLeft = Math.max(0, tLeftSec - dt);
    if(Math.floor(newLeft) !== Math.floor(tLeftSec)){
      emit('hha:time', { game:'plate', timeLeftSec: Math.ceil(newLeft) });
    }
    tLeftSec = newLeft;
  }

  // boss end
  if(!isStudy && boss.active){
    if(nowMs() >= boss.endsAtMs){
      const missDelta = miss - (boss.snap ? boss.snap.miss : 0);
      const junkDelta = nHitJunk - (boss.snap ? boss.snap.hitJunk : 0);
      const ok = (missDelta <= 1 && junkDelta === 0);
      endBossWindow(ok);
    }
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
      }
      if(tl <= 0){
        finishMini(false, 'timeout');
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
    if((t - tObj.bornMs) >= tObj.lifeMs){
      onExpireTarget(id);
    }
  }

  updateGoals();
  updateHUD();

  // AI: tips + director tick
  aiTickHints();
  aiDirectorTick();

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
    refreshLayoutSoon(120);
    refreshLayoutSoon(360);
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

  shotsFired = 0;
  shotsMiss = 0;

  boss.active = false;
  boss.endsAtMs = 0;
  boss.nextAtSec = 28;
  boss.snap = { miss:0, hitJunk:0 };

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
  coach('พร้อมลุย! เติมจานให้ครบ 5 หมู่ 💪', 'neutral');
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
    pattern,

    shotsFired,
    shotsMiss,

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

  try{ refreshLayout(); }catch(e){}
  resetState();
  updateHUD();
  emitQuestUpdate();

  bootButtons();

  if(startOverlay) startOverlay.style.display = 'grid';
  applyLook();
})();