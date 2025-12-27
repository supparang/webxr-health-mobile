// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION (Locked to hydration-vr.html selectors)
// ✅ spawnHost:#hvr-layer boundsHost:#playfield crosshair:#hvr-crosshair
// ✅ FULL-SPREAD + GRID9
// ✅ Tap center -> shoot crosshair
// ✅ Start overlay + Stop + End summary
// ✅ Miss = goodExpired + junkHit (shield-block junk NOT miss)
// ✅ Events: hha:score / quest:update / hha:coach / hha:time / hha:end
// ✅ PATCH 1+2: Canonical water zone (LOW|GREEN|HIGH) -> Goal GREEN sec counts 100%
// ✅ PATCH: Prevent hha:time recursion + dedupe tick
// ✅ PATCH: Fallback UI updates (stats/quest/water/fever/coach) even if hud binder fails
// ✅ Hydration Identity: "ORB" targets (watery orb look)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge } from '../vr/ui-water.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

// ---------- tiny utils ----------
function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
function qs(){ try{ return new URLSearchParams(ROOT.location.search || ''); }catch{ return new URLSearchParams(); } }
function qget(k, fb=null){ const v = qs().get(k); return (v==null||v==='')?fb:v; }
function qnum(k, fb){ const v = Number(qget(k, fb)); return Number.isFinite(v)?v:fb; }
function qbool(k, fb=false){
  const v = String(qget(k, '')).toLowerCase();
  if (!v) return fb;
  return (v==='1'||v==='true'||v==='yes'||v==='y'||v==='on');
}
function dispatch(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{} }
function $(sel){ try{ return DOC.querySelector(sel); }catch{ return null; } }
function setText(idOrEl, txt){
  const el = (typeof idOrEl === 'string') ? DOC.getElementById(idOrEl) : idOrEl;
  if (!el) return;
  el.textContent = String(txt ?? '');
}
function setStyle(elOrId, key, val){
  const el = (typeof elOrId === 'string') ? DOC.getElementById(elOrId) : elOrId;
  if (!el) return;
  el.style[key] = val;
}

// ---------- external/global modules (optional) ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, judgeText(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  null;

// ---------- selectors (locked to your HTML) ----------
const EL = {
  playfield:   () => DOC.getElementById('playfield'),
  layer:       () => DOC.getElementById('hvr-layer'),
  crosshair:   () => DOC.getElementById('hvr-crosshair'),
  startOverlay:() => DOC.getElementById('start-overlay'),
  btnStart:    () => DOC.getElementById('btn-start'),
  btnMotion:   () => DOC.getElementById('btn-motion'),
  btnStop:     () => DOC.getElementById('btn-stop'),
  btnVR:       () => DOC.getElementById('btn-vr'),
  end:         () => DOC.getElementById('hvr-end'),
  btnRetry:    () => DOC.getElementById('btn-retry'),
  btnBackHub:  () => DOC.getElementById('btn-backhub'),
  stamp:       () => DOC.getElementById('hha-stamp'),
  stampBig:    () => DOC.getElementById('stamp-big'),
  stampSmall:  () => DOC.getElementById('stamp-small'),

  // Water HUD ids (this page)
  waterZone:   () => DOC.getElementById('water-zone'),
  waterPct:    () => DOC.getElementById('water-pct'),
  waterBar:    () => DOC.getElementById('water-bar'),

  // Fever HUD ids (this page)
  feverPct:    () => DOC.getElementById('fever-pct'),
  feverBar:    () => DOC.getElementById('fever-bar'),

  // Stats ids (this page)
  statScore:   () => DOC.getElementById('stat-score'),
  statCombo:   () => DOC.getElementById('stat-combo'),
  statComboMax:() => DOC.getElementById('stat-combo-max'),
  statMiss:    () => DOC.getElementById('stat-miss'),
  statTime:    () => DOC.getElementById('stat-time'),
  statGrade:   () => DOC.getElementById('stat-grade'),

  // Quest ids (this page)
  qTitle:      () => DOC.getElementById('quest-title'),
  q1:          () => DOC.getElementById('quest-line1'),
  q2:          () => DOC.getElementById('quest-line2'),
  q3:          () => DOC.getElementById('quest-line3'),
  q4:          () => DOC.getElementById('quest-line4'),

  // Coach ids (this page)
  coachFace:   () => DOC.getElementById('coach-face'),
  coachText:   () => DOC.getElementById('coach-text'),
  coachSub:    () => DOC.getElementById('coach-sub'),
};

// ---------- pools ----------
const POOLS_GOOD  = ['💧','🫗','🚰','🧊','🥛'];
const POOLS_BAD   = ['🥤','🧋','🍹','🧃','🍾'];
const POOLS_TRICK = ['🧊','🥛'];          // fakeGood
const POWERUPS    = ['🛡️','⭐'];

// ---------- water zone thresholds ----------
const Z_GREEN_MIN = 40;
const Z_GREEN_MAX = 60;

// ✅ canonical zone only (PATCH 1+2)
function zoneFromPct(pct){
  pct = clamp(pct, 0, 100);
  if (pct >= Z_GREEN_MIN && pct <= Z_GREEN_MAX) return 'GREEN';
  return (pct < Z_GREEN_MIN) ? 'LOW' : 'HIGH';
}

// ---------- state ----------
const S = {
  started:false,
  ended:false,
  stopped:false,
  t0:0,

  // score
  score:0,
  combo:0,
  comboMax:0,

  // miss definition
  miss:0,          // = goodExpired + junkHit (NOT include blocked junk)
  goodExpired:0,
  junkHit:0,
  junkHitGuard:0,

  // hits
  hitGood:0,
  hitBad:0,
  hitPerfect:0,

  // gauge
  water:50,
  waterZone:'GREEN',
  greenSec:0,

  // fever (fallback mirror)
  feverPct:0,

  // shield
  shieldOn:false,
  shieldUntil:0,
  shieldBlocks:0,

  // time
  duration:60,
  secLeft:60,
  _lastSecSeen:null,

  // quest
  goalIndex:0,
  miniIndex:0,
  activeMini:null,
  _goalCur:0,
  _miniCur:0,

  // engine
  factory:null,

  // mode flags
  diff:'normal',
  isResearch:false,
  hardcorePlay:true, // “โหมด Play แต่โหดแบบวิจัย” -> true by default
};

// ---------- ensure hydration-orb style ----------
function ensureHydrationOrbStyle(){
  if (!DOC || DOC.getElementById('hha-hydration-orb-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-hydration-orb-style';
  st.textContent = `
    .hvr-target.hha-orb{ border-radius:999px !important; overflow:visible; }
    .hvr-target.hha-orb .hha-orb-shell{
      position:absolute; inset:-1px; border-radius:999px;
      background:
        radial-gradient(120% 120% at 30% 25%, rgba(255,255,255,.55), rgba(255,255,255,0) 42%),
        radial-gradient(80% 80% at 65% 70%, rgba(0,255,255,.10), rgba(0,255,255,0) 60%);
      pointer-events:none;
      filter: drop-shadow(0 16px 28px rgba(0,0,0,.35));
      mix-blend-mode: screen;
      opacity:.92;
    }
    .hvr-target.hha-orb .hha-orb-ripple{
      position:absolute; left:50%; top:50%;
      width:112%; height:112%;
      transform: translate(-50%,-50%);
      border-radius:999px;
      border:2px solid rgba(255,255,255,.12);
      box-shadow: 0 0 0 8px rgba(34,197,94,.05);
      pointer-events:none;
      opacity:.85;
      animation: hhaRipple 1.35s ease-in-out infinite;
    }
    @keyframes hhaRipple{
      0%{ transform:translate(-50%,-50%) scale(.92); opacity:.55; }
      50%{ transform:translate(-50%,-50%) scale(1.05); opacity:.95; }
      100%{ transform:translate(-50%,-50%) scale(.92); opacity:.65; }
    }
    .hvr-target.hha-orb.bad .hha-orb-ripple{
      box-shadow: 0 0 0 8px rgba(248,113,113,.06);
      border-color: rgba(248,113,113,.14);
      animation-duration: 1.05s;
    }
    .hvr-target.hha-orb.power .hha-orb-ripple{
      box-shadow: 0 0 0 10px rgba(250,204,21,.08);
      border-color: rgba(250,204,21,.18);
      animation-duration: .95s;
    }
    .hvr-target.hha-orb.fake .hha-orb-ripple{
      box-shadow: 0 0 0 10px rgba(167,139,250,.08);
      border-color: rgba(167,139,250,.18);
      animation-duration: 1.15s;
    }
  `;
  DOC.head.appendChild(st);
}

// ---------- UI helpers ----------
function showStamp(big='GOAL!', small='+1'){
  const s = EL.stamp(); if (!s) return;
  const b = EL.stampBig(); if (b) b.textContent = big;
  const sm = EL.stampSmall(); if (sm) sm.textContent = small;
  s.classList.remove('show');
  void s.offsetWidth;
  s.classList.add('show');
}

function coach(text, mood='neutral', ms=1500){
  dispatch('hha:coach', { text, mood, ms });
  // fallback UI
  const face = EL.coachFace();
  const t = EL.coachText();
  if (t) t.textContent = String(text || '');
  if (face){
    face.textContent = (mood === 'happy') ? '🥦' : (mood === 'sad' ? '🥦' : '🥦');
  }
}

// ---------- fallback UI: water/fever/stats/quest ----------
function updateWaterGaugeFallbackUI(){
  const z = EL.waterZone(); if (z) z.textContent = S.waterZone;
  const p = EL.waterPct();  if (p) p.textContent = `${Math.round(S.water)}%`;
  const bar = EL.waterBar(); if (bar) bar.style.width = `${clamp(S.water,0,100)}%`;
}

function updateFeverFallbackUI(pct){
  const v = clamp(pct, 0, 100);
  S.feverPct = v;
  const p = EL.feverPct(); if (p) p.textContent = `${Math.round(v)}%`;
  const b = EL.feverBar(); if (b) b.style.width = `${v}%`;
}

function computeGrade(){
  // SSS/SS/S/A/B/C
  const accGood = (S.hitGood + S.goodExpired) > 0 ? (S.hitGood / (S.hitGood + S.goodExpired)) : 0;
  const denom = Math.max(1, S.hitGood + S.hitBad + S.goodExpired);
  const missRate = S.miss / denom;

  let score = 0;
  score += clamp(accGood, 0, 1) * 55;
  score += clamp(S.comboMax / 10, 0, 1) * 20;
  score += clamp(S.greenSec / 20, 0, 1) * 15;
  score += clamp(1 - missRate, 0, 1) * 10;

  if (score >= 92) return 'SSS';
  if (score >= 84) return 'SS';
  if (score >= 76) return 'S';
  if (score >= 66) return 'A';
  if (score >= 54) return 'B';
  return 'C';
}

function updateStatsFallbackUI(){
  const grade = computeGrade();
  const sc = EL.statScore(); if (sc) sc.textContent = String(S.score|0);
  const co = EL.statCombo(); if (co) co.textContent = String(S.combo|0);
  const cm = EL.statComboMax(); if (cm) cm.textContent = String(S.comboMax|0);
  const mi = EL.statMiss(); if (mi) mi.textContent = String(S.miss|0);
  const ti = EL.statTime(); if (ti) ti.textContent = String(S.secLeft|0);
  const gr = EL.statGrade(); if (gr) gr.textContent = grade;
}

function updateQuestFallbackUI(goalTitle, goalCur, goalTot, miniTitle, miniCur, miniTot){
  const qt = EL.qTitle();
  const q1 = EL.q1();
  const q2 = EL.q2();
  const q3 = EL.q3();
  const q4 = EL.q4();

  if (qt) qt.textContent = `Quest ${Math.min(S.goalIndex+1, GOALS.length)}`;

  if (q1) q1.textContent = goalTitle ? `Goal: ${goalTitle}` : `Goal: —`;
  if (q2){
    if (goalTot > 0) q2.textContent = `ความคืบหน้า ${goalCur}/${goalTot}`;
    else q2.textContent = `ความคืบหน้า —`;
  }
  if (q3){
    const gd = Math.min(S.goalIndex, GOALS.length);
    const md = Math.min(S.miniIndex, MINIS.length);
    q3.textContent = `Goals done: ${gd} · Minis done: ${md}`;
  }
  if (q4){
    q4.textContent = `Zone: ${S.waterZone} · GREEN sec: ${S.greenSec}/${(GOALS[2]||{}).total || 20}`;
  }
}

// ---------- emit score (for global HUD binder + fallback) ----------
function emitScore(extra={}){
  const accGood = (S.hitGood + S.goodExpired) > 0
    ? Math.round((S.hitGood / (S.hitGood + S.goodExpired)) * 100)
    : 0;

  dispatch('hha:score', {
    modeKey:'hydration',
    score:S.score,
    combo:S.combo,
    comboMax:S.comboMax,
    misses:S.miss,
    goodExpired:S.goodExpired,
    junkHit:S.junkHit,
    junkHitGuard:S.junkHitGuard,
    hitGood:S.hitGood,
    hitBad:S.hitBad,
    hitPerfect:S.hitPerfect,
    accuracyGoodPct: accGood,
    water:S.water,
    waterZone:S.waterZone,
    shieldOn:S.shieldOn,
    ...extra
  });

  // fallback UI
  updateWaterGaugeFallbackUI();
  updateStatsFallbackUI();
}

// ---------- water mechanics (with regression-to-mean) ----------
function applyWater(delta){
  S.water = clamp(S.water + delta, 0, 100);
  S.waterZone = zoneFromPct(S.water);

  // shared gauge module
  try { setWaterGauge(S.water, S.waterZone); } catch { try { setWaterGauge(S.water); } catch {} }

  updateWaterGaugeFallbackUI();
}

function waterDriftEachSecond(){
  // regression-to-mean -> กันน้ำพุ่งไป 100/0 ค้าง
  // โหมดโหด: ดึงกลับช้าลง (ควบคุมยากขึ้น)
  const k = S.hardcorePlay ? 0.055 : 0.075; // 0..1
  const target = 50;
  const next = S.water + (target - S.water) * k;

  // กัน “เด้ง” มากเกินในวินาทีเดียว
  const maxStep = S.hardcorePlay ? 3.0 : 4.0;
  const step = clamp(next - S.water, -maxStep, +maxStep);
  applyWater(step);
}

// ---------- fever/shield ----------
function setShield(on, ms=0){
  S.shieldOn = !!on;
  if (on) S.shieldUntil = now() + Math.max(250, ms||0);
  else S.shieldUntil = 0;

  try{
    if (FeverUI && typeof FeverUI.setShield === 'function') FeverUI.setShield(S.shieldOn, ms);
    if (FeverUI && typeof FeverUI.shield === 'function' && S.shieldOn) FeverUI.shield(ms);
  }catch{}
}
function updateShield(){
  if (!S.shieldOn) return;
  if (S.shieldUntil && now() > S.shieldUntil) setShield(false, 0);
}
function addFever(delta){
  try{
    if (FeverUI && typeof FeverUI.add === 'function') FeverUI.add(delta);
  }catch{}
  // fallback mirror (ถ้า FeverUI ไม่ส่ง event)
  updateFeverFallbackUI(clamp(S.feverPct + delta, 0, 100));
}

// ---------- quest ----------
const GOALS = [
  { key:'g1', title:'เก็บน้ำดี 15 ครั้ง 💧', total:15 },
  { key:'g2', title:'คอมโบสูงสุด 8 🔥', total:8 },
  { key:'g3', title:'อยู่โซน GREEN รวม 20 วิ 🟢', total:20 },
];

const MINIS = [
  { key:'m1', title:'Hydro Rush — 5 ภายใน 8 วิ (ห้ามโดนขยะ) ⚡', total:5, timeLimit:8, noJunk:true },
  { key:'m2', title:'Perfect 3 — Perfect 3 ครั้ง 🎯', total:3 },
  { key:'m3', title:'Shield Save — บล็อกขยะ 2 ครั้ง 🛡️', total:2 },
];

function questUpdate(kind, payload){
  dispatch('quest:update', { modeKey:'hydration', kind, ...payload });

  // fallback: render on this page
  const g = GOALS[S.goalIndex] || null;
  const m = S.activeMini || null;
  const gTitle = g ? g.title : '';
  const gCur = clamp(payload && payload.current != null ? payload.current : S._goalCur, 0, 9999);
  const gTot = g ? g.total : 0;

  const mTitle = m ? m.title : '';
  const mCur = m ? m.cur : 0;
  const mTot = m ? m.total : 0;

  updateQuestFallbackUI(gTitle, gCur, gTot, mTitle, mCur, mTot);
}

function startGoal(){
  const g = GOALS[S.goalIndex]; if (!g) return;
  S._goalCur = 0;
  questUpdate('goal', { title:g.title, current:0, total:g.total, done:false });
  coach(`Goal: ${g.title}`, 'happy', 1100);
}
function completeGoal(){
  const g = GOALS[S.goalIndex]; if (!g) return;
  questUpdate('goal', { title:g.title, current:g.total, total:g.total, done:true });
  showStamp('GOAL!', '+1');
  try{ Particles.celebrate && Particles.celebrate('goal'); }catch{}
  S.goalIndex++;
  if (S.goalIndex < GOALS.length) setTimeout(startGoal, 650);
}

function startMini(){
  const def = MINIS[S.miniIndex] || null;
  S.activeMini = null;
  if (!def) return;

  S.activeMini = {
    key:def.key, title:def.title, total:def.total, cur:0,
    tStart: now(), timeLimit: def.timeLimit||0, noJunk: !!def.noJunk, failed:false
  };
  questUpdate('mini', { title:def.title, current:0, total:def.total, done:false });
  coach(`Mini: ${def.title}`, 'neutral', 1200);
}

function completeMini(){
  const m = S.activeMini; if (!m) return;
  questUpdate('mini', { title:m.title, current:m.total, total:m.total, done:true });
  showStamp('MINI!', '✨');
  try{ Particles.celebrate && Particles.celebrate('mini'); }catch{}
  S.activeMini = null;
  S.miniIndex++;
  setTimeout(startMini, 900);
}

function failMini(reason='พลาด!'){
  const m = S.activeMini; if (!m || m.failed) return;
  m.failed = true;
  questUpdate('mini', { title:m.title, current:m.cur, total:m.total, done:false, failed:true, reason });
  coach('ไม่เป็นไร ลองใหม่รอบหน้า ✨', 'neutral', 1100);
  S.activeMini = null;
  S.miniIndex++;
  setTimeout(startMini, 900);
}

function tickMini(){
  const m = S.activeMini;
  if (!m || m.failed) return;
  if (m.timeLimit > 0){
    const elapsed = (now() - m.tStart) / 1000;
    if (elapsed > m.timeLimit) failMini('หมดเวลา ⏱️');
  }
}

// ---------- scoring / FX ----------
function fxAtRect(r, type, txt=null){
  try{
    const x = r.left + r.width/2;
    const y = r.top  + r.height/2;
    if (typeof txt === 'string' && Particles.judgeText) Particles.judgeText(txt, x, y);
    if (Particles.burstAt) Particles.burstAt(x, y, type);
  }catch{}
}

function scoreHitGood(ctx){
  const perfect = !!ctx.hitPerfect;

  const base = perfect ? 140 : 110;
  const comboBonus = Math.min(120, S.combo * 6);
  const delta = base + comboBonus;

  S.hitGood++;
  if (perfect) S.hitPerfect++;

  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);

  // ✅ “โหดแบบวิจัย”: ดันน้ำเข้ากลางน้อยลงตอนอยู่ฝั่งสูง
  // กันพุ่งไป 100 เร็วเกิน
  const pullLow  = S.hardcorePlay ? 4.0 : 6.0;
  const pullHigh = S.hardcorePlay ? 1.4 : 3.0;
  applyWater((S.water < 50) ? pullLow : pullHigh);

  addFever(+6 + (perfect ? 3 : 0));

  S.score += delta;

  if (ctx.targetRect){
    try{ Particles.scorePop && Particles.scorePop(delta, ctx.targetRect.left+ctx.targetRect.width/2, ctx.targetRect.top+ctx.targetRect.height/2); }catch{}
    fxAtRect(ctx.targetRect, 'good');
  }
  return { scoreDelta: delta, good:true };
}

function scoreHitBad(ctx){
  updateShield();
  if (S.shieldOn){
    // ✅ blocked junk: NOT miss
    S.junkHitGuard++;
    S.shieldBlocks++;
    if (ctx.targetRect) fxAtRect(ctx.targetRect, 'shield', 'BLOCK!');

    // mini m3
    if (S.activeMini && S.activeMini.key === 'm3'){
      S.activeMini.cur = Math.min(S.activeMini.total, S.shieldBlocks);
      questUpdate('mini', { title:S.activeMini.title, current:S.activeMini.cur, total:S.activeMini.total, done:false });
      if (S.activeMini.cur >= S.activeMini.total) completeMini();
    }

    S.score += 20;
    return { scoreDelta: 20, good:true, blocked:true };
  }

  const base = -120;
  const extra = -Math.min(120, S.combo * 4);
  const delta = base + extra;

  S.hitBad++;
  S.junkHit++;
  S.miss++;      // ✅ junkHit counts miss
  S.combo = 0;

  // โหดแบบวิจัย: เขย่าน้ำแรงขึ้น
  const swing = S.hardcorePlay ? 10 : 8;
  applyWater((S.water < 50) ? -swing : +swing);

  addFever(-10);
  S.score = Math.max(0, S.score + delta);

  if (ctx.targetRect){
    try{ Particles.scorePop && Particles.scorePop(delta, ctx.targetRect.left+ctx.targetRect.width/2, ctx.targetRect.top+ctx.targetRect.height/2); }catch{}
    fxAtRect(ctx.targetRect, 'bad');
  }

  if (S.activeMini && S.activeMini.noJunk) failMini('โดนขยะ ❌');

  return { scoreDelta: delta, good:false };
}

function scoreHitPower(ctx){
  setShield(true, 3200);
  addFever(+8);

  const delta = 80;
  S.score += delta;
  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);

  if (ctx.targetRect){
    try{ Particles.scorePop && Particles.scorePop(delta, ctx.targetRect.left+ctx.targetRect.width/2, ctx.targetRect.top+ctx.targetRect.height/2); }catch{}
    fxAtRect(ctx.targetRect, 'power');
  }

  coach('ได้โล่แล้ว! 🛡️', 'happy', 900);
  return { scoreDelta: delta, good:true };
}

function scoreHitFakeGood(ctx){
  const perfect = !!ctx.hitPerfect;
  const delta = perfect ? 90 : 70;

  S.hitGood++;
  if (perfect) S.hitPerfect++;

  // trick: ลด combo
  S.combo = Math.max(0, S.combo - 2);

  // หลอก: เขย่าน้ำไปอีกฝั่ง
  const swing = S.hardcorePlay ? 11 : 10;
  applyWater((S.water < 50) ? +swing : -swing);

  addFever(+3);
  S.score += delta;

  if (ctx.targetRect){
    try{ Particles.scorePop && Particles.scorePop(delta, ctx.targetRect.left+ctx.targetRect.width/2, ctx.targetRect.top+ctx.targetRect.height/2); }catch{}
    fxAtRect(ctx.targetRect, 'trick');
  }

  coach('ระวัง! ของหลอก 😵‍💫', 'sad', 750);
  return { scoreDelta: delta, good:true, trick:true };
}

function judge(ch, ctx){
  const itemType = String(ctx.itemType || (ctx.isPower ? 'power' : (ctx.isGood ? 'good' : 'bad')));
  let res;
  if (itemType === 'power') res = scoreHitPower(ctx);
  else if (itemType === 'fakeGood') res = scoreHitFakeGood(ctx);
  else if (ctx.isGood) res = scoreHitGood(ctx);
  else res = scoreHitBad(ctx);

  // ---- goals progress ----
  const g = GOALS[S.goalIndex];
  if (g){
    if (g.key === 'g1'){
      const cur = Math.min(S.hitGood, g.total);
      S._goalCur = cur;
      questUpdate('goal', { title:g.title, current:cur, total:g.total, done:false });
      if (cur >= g.total) completeGoal();
    } else if (g.key === 'g2'){
      const cur = Math.min(S.comboMax, g.total);
      S._goalCur = cur;
      questUpdate('goal', { title:g.title, current:cur, total:g.total, done:false });
      if (cur >= g.total) completeGoal();
    }
  }

  // ---- minis progress ----
  const m = S.activeMini;
  if (m && !m.failed){
    if (m.key === 'm1'){
      if (ctx.isGood && itemType !== 'fakeGood'){
        m.cur++;
        questUpdate('mini', { title:m.title, current:m.cur, total:m.total, done:false });
        if (m.cur >= m.total) completeMini();
      }
    } else if (m.key === 'm2'){
      if (ctx.hitPerfect){
        m.cur++;
        questUpdate('mini', { title:m.title, current:m.cur, total:m.total, done:false });
        if (m.cur >= m.total) completeMini();
      }
    }
    // m3 updated by shield blocks
  }

  emitScore();
  return res;
}

function onExpire(info){
  const itemType = String(info && info.itemType || '');
  if (itemType === 'good' || itemType === 'fakeGood'){
    S.goodExpired++;
    S.miss++;          // ✅ expire good counts miss
    S.combo = 0;

    addFever(-6);

    // expire: ดึงน้ำออกจากกลางเล็กน้อย
    const nudge = S.hardcorePlay ? 3 : 2;
    applyWater((S.water < 50) ? -nudge : +nudge);

    emitScore({ reason:'expireGood' });
  }
}

// ---------- time tick (called from hha:time sec change) ----------
function onSecondTick(){
  // ✅ regression-to-mean (กันพุ่ง 100/0)
  waterDriftEachSecond();

  // ✅ GREEN sec counts using canonical zone
  if (S.waterZone === 'GREEN') S.greenSec++;

  tickMini();

  // goal g3
  const g = GOALS[S.goalIndex];
  if (g && g.key === 'g3'){
    const cur = Math.min(S.greenSec, g.total);
    S._goalCur = cur;
    questUpdate('goal', { title:g.title, current:cur, total:g.total, done:false });
    if (cur >= g.total) completeGoal();
  }

  // refresh fallback stats/time
  updateStatsFallbackUI();
  updateWaterGaugeFallbackUI();
}

// ---------- end overlay ----------
function showEndOverlay(summary){
  const end = EL.end();
  if (!end) return;

  const grade = computeGrade();
  setText('end-score', summary.scoreFinal ?? S.score);
  setText('end-grade', grade);
  setText('end-combo', summary.comboMax ?? S.comboMax);
  setText('end-miss', summary.misses ?? S.miss);
  setText('end-goals', `${Math.min(S.goalIndex, GOALS.length)}/${GOALS.length}`);
  setText('end-minis', `${Math.min(S.miniIndex, MINIS.length)}/${MINIS.length}`);

  end.style.display = 'flex';
}

function endGame(reason='timeup'){
  if (S.ended) return;
  S.ended = true;

  const played = Math.max(0, Math.round((now() - S.t0) / 1000));
  const summary = {
    modeKey: 'hydration',
    reason,
    difficulty: S.diff,
    runMode: S.isResearch ? 'research' : 'play',
    durationPlannedSec: S.duration,
    durationPlayedSec: played,
    scoreFinal: S.score,
    comboMax: S.comboMax,
    misses: S.miss,
    goodExpired: S.goodExpired,
    junkHit: S.junkHit,
    junkHitGuard: S.junkHitGuard,
    nHitGood: S.hitGood,
    nHitBad: S.hitBad,
    hitPerfect: S.hitPerfect,
    waterEnd: S.water,
    waterZoneEnd: S.waterZone,
    greenSec: S.greenSec
  };

  dispatch('hha:end', summary);
  showEndOverlay(summary);

  // cleanup time listener
  try{
    if (S._onTime) ROOT.removeEventListener('hha:time', S._onTime);
    if (S._onStop) ROOT.removeEventListener('hha:stop', S._onStop);
    if (S._onFever) ROOT.removeEventListener('hha:fever', S._onFever);
  }catch{}
}

// ---------- center tap -> shoot crosshair ----------
function bindCenterTapShoot(){
  const pf = EL.playfield();
  if (!pf) return;

  pf.addEventListener('pointerdown', (ev) => {
    if (!S.started || S.ended || S.stopped) return;

    const t = ev.target;
    if (t && (t.closest && (t.closest('button') || t.closest('#hud') || t.closest('#start-overlay') || t.closest('#hvr-end')))) return;

    try{
      if (S.factory && typeof S.factory.shootCrosshair === 'function'){
        const ok = S.factory.shootCrosshair();
        if (ok) ev.preventDefault();
      }
    }catch{}
  }, { passive:false });
}

// ---------- motion permission ----------
async function requestMotionPermission(){
  try{
    const DME = ROOT.DeviceMotionEvent;
    if (DME && typeof DME.requestPermission === 'function'){
      const res = await DME.requestPermission();
      return (res === 'granted');
    }
  }catch{}
  return true;
}

function setupMotionButton(){
  const btn = EL.btnMotion();
  if (!btn) return;

  const DME = ROOT.DeviceMotionEvent;
  const needs = !!(DME && typeof DME.requestPermission === 'function');
  btn.style.display = needs ? '' : 'none';

  btn.addEventListener('click', async () => {
    const ok = await requestMotionPermission();
    coach(ok ? 'Motion พร้อมแล้ว ✅' : 'Motion ไม่อนุญาต (เล่นแบบลากจอได้) 🙂', ok ? 'happy' : 'neutral', 1200);
    btn.style.display = 'none';
  });
}

// ---------- VR button ----------
function setupVRButton(){
  const btn = EL.btnVR();
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try{
      const V = ROOT.HHA_VRLOOK || ROOT.VRLook || ROOT.HHAVRLook || ROOT.VRLOOK;
      if (V && typeof V.toggle === 'function'){ V.toggle(); return; }
      if (V && typeof V.enter === 'function'){ V.enter(); return; }
      if (V && typeof V.start === 'function'){ V.start(); return; }
    }catch{}
    DOC.body.classList.toggle('hvr-vr-on');
    coach('สลับโหมด VR-feel แล้ว 👀', 'neutral', 900);
  });
}

// ---------- stop ----------
function setupStopButton(){
  const btn = EL.btnStop();
  if (!btn) return;
  btn.addEventListener('click', () => stop('stop'));
}

function stop(reason='stop'){
  if (S.stopped) return;
  S.stopped = true;
  try{ if (S.factory && S.factory.stop) S.factory.stop(); }catch{}
  endGame(reason);
}

// ---------- end buttons ----------
function setupEndButtons(){
  const r = EL.btnRetry();
  if (r) r.addEventListener('click', () => ROOT.location.reload());

  const b = EL.btnBackHub();
  if (b) b.addEventListener('click', () => {
    try{ ROOT.location.href = './hub.html'; }catch{}
  });
}

// ---------- start overlay ----------
function setupStartOverlay(){
  const ov = EL.startOverlay();
  const btn = EL.btnStart();
  if (!ov || !btn) return;

  btn.addEventListener('click', async () => {
    ov.style.display = 'none';
    await startGame();
  });
}

// ---------- decorate target: Hydration ORB identity ----------
function decorateHydrationOrb(el, parts, data, meta){
  try{
    ensureHydrationOrbStyle();

    el.classList.add('hha-orb');

    if (data.itemType === 'bad') el.classList.add('bad');
    if (data.itemType === 'power') el.classList.add('power');
    if (data.itemType === 'fakeGood') el.classList.add('fake');

    // make the orb more watery (override gradients)
    if (data.itemType === 'good'){
      el.style.background = 'radial-gradient(circle at 30% 25%, rgba(56,189,248,.95), rgba(14,116,144,.92))';
      el.style.boxShadow = '0 16px 34px rgba(15,23,42,0.90), 0 0 0 2px rgba(56,189,248,.28), 0 0 22px rgba(56,189,248,.30)';
    } else if (data.itemType === 'bad'){
      el.style.background = 'radial-gradient(circle at 30% 25%, rgba(251,113,133,.95), rgba(190,18,60,.92))';
      el.style.boxShadow = '0 16px 34px rgba(15,23,42,0.90), 0 0 0 2px rgba(251,113,133,.28), 0 0 22px rgba(251,113,133,.30)';
    } else if (data.itemType === 'power'){
      el.style.background = 'radial-gradient(circle at 30% 25%, rgba(250,204,21,.98), rgba(245,158,11,.92))';
      el.style.boxShadow = '0 16px 34px rgba(15,23,42,0.90), 0 0 0 2px rgba(250,204,21,.26), 0 0 24px rgba(250,204,21,.35)';
    } else if (data.itemType === 'fakeGood'){
      el.style.background = 'radial-gradient(circle at 30% 25%, rgba(167,139,250,.95), rgba(91,33,182,.92))';
      el.style.boxShadow = '0 16px 34px rgba(15,23,42,0.90), 0 0 0 2px rgba(167,139,250,.26), 0 0 24px rgba(167,139,250,.32)';
    }

    // add orb overlays
    const shell = DOC.createElement('div');
    shell.className = 'hha-orb-shell';

    const ripple = DOC.createElement('div');
    ripple.className = 'hha-orb-ripple';

    el.appendChild(shell);
    el.appendChild(ripple);

    // icon sizing
    if (parts && parts.icon){
      parts.icon.style.fontSize = (meta.size * 0.64) + 'px';
      parts.icon.style.filter = 'drop-shadow(0 4px 6px rgba(0,0,0,.45))';
    }
  }catch{}
}

// ---------- core boot ----------
async function startGame(){
  if (S.started) return;
  S.started = true;

  const layer = EL.layer();
  if (layer) layer.style.pointerEvents = 'auto';

  // init shared gauge + our canonical state
  try{ ensureWaterGauge(); }catch{}
  S.water = clamp(Number(qnum('waterStart', 50)), 0, 100);
  S.waterZone = zoneFromPct(S.water);
  updateWaterGaugeFallbackUI();
  try{ setWaterGauge(S.water, S.waterZone); }catch{ try{ setWaterGauge(S.water); }catch{} }

  // context
  const diff = String(qget('diff','normal')).toLowerCase();
  const run  = String(qget('run','play')).toLowerCase(); // play | research
  const isResearch = (run === 'research' || run === 'study');

  // “โหมด Play แต่โหดแบบวิจัย”
  const hardcorePlay = qbool('hardcore', true);

  const time = clamp(qnum('time', 60), 20, 180);
  const seed = String(qget('seed', qget('sessionId', qget('ts',''))) || '').trim();

  S.diff = diff;
  S.isResearch = isResearch;
  S.hardcorePlay = (!isResearch) ? hardcorePlay : true;

  S.duration = time;
  S.secLeft  = time;

  S.t0 = now();

  coach(isResearch ? 'โหมดวิจัย: ไม่มี adaptive 🧪' : (S.hardcorePlay ? 'โหมดเล่น: โหดแบบวิจัย 😈' : 'โหมดเล่น: มี adaptive 😎'), 'neutral', 1300);

  // quest start
  S.goalIndex = 0; S.miniIndex = 0; S.activeMini = null;
  S.greenSec = 0;
  startGoal();
  setTimeout(startMini, 1200);

  // boot factory
  const factory = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diff,
    duration: time,

    pools: { good: POOLS_GOOD, bad: POOLS_BAD, trick: POOLS_TRICK },

    // ratios (โหมดโหด: bad/trick มากขึ้นนิด)
    goodRate: isResearch ? 0.70 : (S.hardcorePlay ? 0.62 : 0.66),
    trickRate: isResearch ? 0.06 : (S.hardcorePlay ? 0.10 : 0.08),

    powerups: POWERUPS,
    powerRate: isResearch ? 0.10 : 0.12,
    powerEvery: 6,

    allowAdaptive: (!isResearch) && (!S.hardcorePlay), // โหดแบบวิจัย -> ปิด adaptive
    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',
    minSeparation: 0.92,
    maxSpawnTries: 18,

    seed: seed || null,

    spawnHost: layer || '#hvr-layer',
    boundsHost: EL.playfield() || '#playfield',

    decorateTarget: decorateHydrationOrb,

    judge,
    onExpire
  });

  S.factory = factory;

  // ✅ IMPORTANT: listen to hha:time from factory WITHOUT re-dispatch (no recursion)
  S._lastSecSeen = null;
  const onTime = (ev) => {
    const sec = Number(ev && ev.detail && ev.detail.sec);
    if (!Number.isFinite(sec)) return;

    // dedupe per second
    if (S._lastSecSeen === sec) return;
    S._lastSecSeen = sec;

    S.secLeft = sec;

    // fallback UI update
    updateStatsFallbackUI();

    if (sec > 0) onSecondTick();
    else endGame('timeup');
  };
  S._onTime = onTime;
  ROOT.addEventListener('hha:time', onTime);

  const onStop = () => stop('stop');
  S._onStop = onStop;
  ROOT.addEventListener('hha:stop', onStop);

  // optional fever mirror if FeverUI dispatches event
  const onFever = (ev) => {
    const pct = Number(ev && ev.detail && (ev.detail.pct ?? ev.detail.percent));
    if (Number.isFinite(pct)) updateFeverFallbackUI(pct);
    const sh = !!(ev && ev.detail && ev.detail.shieldOn);
    if (ev && ev.detail && ('shieldOn' in ev.detail)) S.shieldOn = sh;
  };
  S._onFever = onFever;
  ROOT.addEventListener('hha:fever', onFever);

  bindCenterTapShoot();

  emitScore({ started:true, research:isResearch, hardcore:S.hardcorePlay, seed: seed || '' });

  ROOT.HHA_HYDRATION = {
    stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} },
    shoot(){ try{ return factory && factory.shootCrosshair && factory.shootCrosshair(); }catch{ return false; } },
    state:S
  };
}

// ---------- wire UI on DOM ready ----------
function init(){
  if (!DOC) return;

  ensureHydrationOrbStyle();

  setupMotionButton();
  setupVRButton();
  setupStopButton();
  setupEndButtons();
  setupStartOverlay();

  // initial UI sync
  S.waterZone = zoneFromPct(S.water);
  updateWaterGaugeFallbackUI();
  updateStatsFallbackUI();
  updateQuestFallbackUI((GOALS[0]||{}).title || '', 0, (GOALS[0]||{}).total || 0, '', 0, 0);

  coach('พร้อมแล้ว เก็บน้ำดี ๆ นะ! 💧', 'happy', 1400);

  if (qbool('autostart', false)){
    const ov = EL.startOverlay();
    if (ov) ov.style.display = 'none';
    startGame();
  }
}

if (DOC && DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init);
else init();
