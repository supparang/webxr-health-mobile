// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION (Locked to hydration-vr.html selectors)
// ✅ spawnHost:#hvr-layer boundsHost:#playfield crosshair:#hvr-crosshair
// ✅ FULL-SPREAD + GRID9
// ✅ Tap center -> shoot crosshair
// ✅ Start overlay + Stop + End summary
// ✅ Miss = goodExpired + junkHit (shield-block junk NOT miss)
// ✅ Events: hha:score / quest:update / hha:coach / hha:time / hha:end
// ✅ PATCH P0: HUD sync ตรง ๆ (stats/quest/water) ไม่พึ่งไฟล์อื่น
// ✅ PATCH P1: Hydration signature ORB + Splash FX
// ✅ FIX: ไม่ dispatch hha:time ซ้ำ (กัน loop)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

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
};

// ---------- game pools ----------
const POOLS_GOOD  = ['💧','🫗','🚰','🧊','🥛'];
const POOLS_BAD   = ['🥤','🧋','🍹','🧃','🍾'];
const POOLS_TRICK = ['🧊','🥛'];          // fakeGood
const POWERUPS    = ['🛡️','⭐'];

// water zone thresholds (fallback)
const Z_GREEN_MIN = 40;
const Z_GREEN_MAX = 60;

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
  miss:0,           // = goodExpired + junkHit (NOT include blocked junk)
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

  // shield
  shieldOn:false,
  shieldUntil:0,
  shieldBlocks:0,

  // time
  duration:60,
  secLeft:60,

  // quest
  goalIndex:0,
  miniIndex:0,
  activeMini:null,

  // engine
  factory:null,
};

// ---------- HUD sync (P0) ----------
function syncWaterHud(){
  const zoneEl = DOC.getElementById('water-zone');
  const pctEl  = DOC.getElementById('water-pct');
  const barEl  = DOC.getElementById('water-bar');
  if (zoneEl) zoneEl.textContent = String(S.waterZone || '');
  if (pctEl)  pctEl.textContent  = Math.round(S.water) + '%';
  if (barEl)  barEl.style.width  = clamp(S.water,0,100) + '%';
}

function syncStatsHud(){
  setText('stat-score', S.score);
  setText('stat-combo', S.combo);
  setText('stat-combo-max', S.comboMax);
  setText('stat-miss', S.miss);
  setText('stat-time', S.secLeft);
  try{ setText('stat-grade', computeGrade()); }catch{}
}

function syncQuestHud(){
  setText('quest-title', `Quest ${Math.min(GOALS.length, S.goalIndex + 1)}`);
  setText('quest-line3', `Goals done: ${S.goalIndex} · Minis done: ${S.miniIndex}`);
  const prog = Math.round(clamp((S.score / 1800) * 100, 0, 100));
  setText('quest-line4', `Progress to S (30%): ${Math.min(100, prog)}%`);
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
  // P0: เขียนลง UI ตรง ๆ (กันไม่ขึ้น)
  setText('coach-text', text);
}

// ---------- emit score ----------
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
    miss:S.miss,
    time:S.secLeft,
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
    grade:(()=>{ try{return computeGrade();}catch{return 'C';} })(),
    ...extra
  });

  // ✅ P0: sync HUD แบบไม่พึ่งไฟล์อื่น
  syncWaterHud();
  syncStatsHud();
  syncQuestHud();
}

function computeGrade(){
  const accGood = (S.hitGood + S.goodExpired) > 0 ? (S.hitGood / (S.hitGood + S.goodExpired)) : 0;
  const missRate = S.miss / Math.max(1, S.hitGood + S.hitBad + S.goodExpired);

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

// ---------- gauge ----------
function waterZoneFallback(pct){
  if (pct >= Z_GREEN_MIN && pct <= Z_GREEN_MAX) return 'GREEN';
  return (pct < Z_GREEN_MIN) ? 'LOW' : 'HIGH';
}
function applyWater(delta){
  S.water = clamp(S.water + delta, 0, 100);
  S.waterZone = (typeof zoneFrom === 'function') ? zoneFrom(S.water) : waterZoneFallback(S.water);

  // ✅ P0: อัปเดต HUD ตรง ๆ ให้ชัวร์
  syncWaterHud();

  try{ setWaterGauge(S.water); }catch{}
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
  try{ if (FeverUI && typeof FeverUI.add === 'function') FeverUI.add(delta); }catch{}
}

// ---------- quest defs ----------
const GOALS = [
  { key:'g1', title:'Goal 1: เก็บน้ำดี 15 ครั้ง 💧', total:15 },
  { key:'g2', title:'Goal 2: คอมโบสูงสุด 8 🔥', total:8 },
  { key:'g3', title:'Goal 3: อยู่โซน GREEN รวม 20 วิ 🟢', total:20 },
];

const MINIS = [
  { key:'m1', title:'Mini: Hydro Rush — 5 ภายใน 8 วิ (ห้ามโดนขยะ) ⚡', total:5, timeLimit:8, noJunk:true },
  { key:'m2', title:'Mini: Perfect 3 — Perfect 3 ครั้ง 🎯', total:3 },
  { key:'m3', title:'Mini: Shield Save — บล็อกขยะ 2 ครั้ง 🛡️', total:2 },
];

function questUpdate(kind, payload){
  dispatch('quest:update', { modeKey:'hydration', kind, ...payload });

  // ✅ P0: เขียนลง UI ตรง ๆ
  const title = payload && payload.title ? String(payload.title) : '';
  const cur   = Number(payload && payload.current);
  const tot   = Number(payload && payload.total);

  if (kind === 'goal'){
    if (title) setText('quest-line1', title);
    if (Number.isFinite(cur) && Number.isFinite(tot)) setText('quest-line2', `${cur}/${tot}`);
  } else if (kind === 'mini'){
    if (title) setText('quest-line2', `${title}  (${(Number.isFinite(cur)?cur:0)}/${(Number.isFinite(tot)?tot:0)})`);
  }
  setText('quest-line3', `Goals done: ${S.goalIndex} · Minis done: ${S.miniIndex}`);
}

function startGoal(){
  const g = GOALS[S.goalIndex]; if (!g) return;
  questUpdate('goal', { title:g.title, current:0, total:g.total, done:false });
  coach(g.title, 'happy', 1200);
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
  const m = MINIS[S.miniIndex] || null;
  S.activeMini = null;
  if (!m) return;

  S.activeMini = {
    key:m.key, title:m.title, total:m.total, cur:0,
    tStart: now(), timeLimit: m.timeLimit||0, noJunk: !!m.noJunk, failed:false
  };
  questUpdate('mini', { title:m.title, current:0, total:m.total, done:false });
  coach(m.title, 'neutral', 1300);
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
  coach('ไม่เป็นไร ลองใหม่รอบหน้า ✨', 'neutral', 1200);
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

// ---------- Hydration Splash FX (P1) ----------
function ensureHydrFx(){
  let fx = DOC.getElementById('hydr-fx');
  if (fx) return fx;
  fx = DOC.createElement('div');
  fx.id = 'hydr-fx';
  Object.assign(fx.style, { position:'fixed', inset:'0', pointerEvents:'none', zIndex:'75', overflow:'hidden' });
  DOC.body.appendChild(fx);
  return fx;
}
function splashAt(x, y, kind='good'){
  const fx = ensureHydrFx();
  if (!fx) return;
  const el = DOC.createElement('div');
  el.className = `hydr-splash ${kind}`;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  fx.appendChild(el);
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 520);
}
function splashFromRect(r, kind){
  if (!r) return;
  splashAt(r.left + r.width/2, r.top + r.height/2, kind);
}

// ---------- scoring helpers ----------
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

  const pull = (S.water < 50) ? 6 : 3;
  applyWater(pull);

  addFever(+6 + (perfect ? 3 : 0));
  S.score += delta;

  if (ctx.targetRect){
    try{ Particles.scorePop && Particles.scorePop(delta, ctx.targetRect.left+ctx.targetRect.width/2, ctx.targetRect.top+ctx.targetRect.height/2); }catch{}
    fxAtRect(ctx.targetRect, 'good');
    splashFromRect(ctx.targetRect, 'good'); // ✅ P1
  }
  return { scoreDelta: delta, good:true };
}

function scoreHitBad(ctx){
  updateShield();
  if (S.shieldOn){
    S.junkHitGuard++;
    S.shieldBlocks++;
    if (ctx.targetRect){
      fxAtRect(ctx.targetRect, 'shield', 'BLOCK!');
      splashFromRect(ctx.targetRect, 'power'); // ✅ P1 (บล็อกให้เป็น splash แบบ power)
    }

    if (S.activeMini && S.activeMini.key === 'm3'){
      S.activeMini.cur = Math.min(S.activeMini.total, S.shieldBlocks);
      questUpdate('mini', { title:S.activeMini.title, current:S.activeMini.cur, total:S.activeMini.total, done:false });
      if (S.activeMini.cur >= S.activeMini.total) completeMini();
    }

    S.score += 20;
    S.combo = Math.max(0, S.combo);
    return { scoreDelta: 20, good:true, blocked:true };
  }

  const base = -120;
  const extra = -Math.min(120, S.combo * 4);
  const delta = base + extra;

  S.hitBad++;
  S.junkHit++;
  S.miss++;
  S.combo = 0;

  applyWater((S.water < 50) ? -8 : +8);
  addFever(-10);

  S.score = Math.max(0, S.score + delta);
  if (ctx.targetRect){
    try{ Particles.scorePop && Particles.scorePop(delta, ctx.targetRect.left+ctx.targetRect.width/2, ctx.targetRect.top+ctx.targetRect.height/2); }catch{}
    fxAtRect(ctx.targetRect, 'bad');
    splashFromRect(ctx.targetRect, 'bad'); // ✅ P1
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
    splashFromRect(ctx.targetRect, 'power'); // ✅ P1
  }
  coach('ได้โล่แล้ว! 🛡️', 'happy', 900);
  return { scoreDelta: delta, good:true };
}

function scoreHitFakeGood(ctx){
  const perfect = !!ctx.hitPerfect;
  const delta = perfect ? 90 : 70;

  S.hitGood++;
  if (perfect) S.hitPerfect++;

  S.combo = Math.max(0, S.combo - 2);

  applyWater((S.water < 50) ? +10 : -10);
  addFever(+3);

  S.score += delta;
  if (ctx.targetRect){
    try{ Particles.scorePop && Particles.scorePop(delta, ctx.targetRect.left+ctx.targetRect.width/2, ctx.targetRect.top+ctx.targetRect.height/2); }catch{}
    fxAtRect(ctx.targetRect, 'trick');
    splashFromRect(ctx.targetRect, 'good'); // ✅ P1
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
      questUpdate('goal', { title:g.title, current:cur, total:g.total, done:false });
      if (cur >= g.total) completeGoal();
    } else if (g.key === 'g2'){
      const cur = Math.min(S.comboMax, g.total);
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
  }

  emitScore();
  return res;
}

function onExpire(info){
  const itemType = String(info && info.itemType || '');
  if (itemType === 'good' || itemType === 'fakeGood'){
    S.goodExpired++;
    S.miss++;
    S.combo = 0;
    addFever(-6);
    applyWater((S.water < 50) ? -2 : +2);
    emitScore({ reason:'expireGood' });
  }
}

// ---------- time tick ----------
function onSecondTick(){
  if (S.waterZone === 'GREEN') S.greenSec++;
  tickMini();

  // goal g3
  const g = GOALS[S.goalIndex];
  if (g && g.key === 'g3'){
    const cur = Math.min(S.greenSec, g.total);
    questUpdate('goal', { title:g.title, current:cur, total:g.total, done:false });
    if (cur >= g.total) completeGoal();
  }

  // sync stats each second
  syncStatsHud();
  syncQuestHud();
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
  setText('end-goals', `${S.goalIndex}/${GOALS.length}`);
  setText('end-minis', `${S.miniIndex}/${MINIS.length}`);

  end.style.display = 'flex';
}

function endGame(reason='timeup'){
  if (S.ended) return;
  S.ended = true;

  const played = Math.max(0, Math.round((now() - S.t0) / 1000));
  const summary = {
    modeKey: 'hydration',
    reason,
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
    greenSec: S.greenSec
  };

  dispatch('hha:end', summary);
  showEndOverlay(summary);
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
    coach(ok ? 'Motion พร้อมแล้ว ✅' : 'Motion ไม่อนุญาต (เล่นแบบลากจอได้) 🙂', ok ? 'happy' : 'neutral', 1300);
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

// ---------- stop button ----------
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

// ---------- core boot ----------
async function startGame(){
  if (S.started) return;
  S.started = true;

  const layer = EL.layer();
  if (layer) layer.style.pointerEvents = 'auto';

  try{ ensureWaterGauge(); }catch{}
  applyWater(0);
  syncWaterHud();

  const diff = String(qget('diff','normal')).toLowerCase();
  const run  = String(qget('run','play')).toLowerCase(); // play | research
  const isResearch = (run === 'research' || run === 'study');
  const time = clamp(qnum('time', 60), 20, 180);
  const seed = String(qget('seed', qget('sessionId', qget('ts',''))) || '').trim();

  S.duration = time;
  S.secLeft  = time;

  S.t0 = now();
  coach(isResearch ? 'โหมดวิจัย: ไม่มี adaptive 🧪' : 'โหมดเล่น: มี adaptive 😎', 'neutral', 1400);

  S.goalIndex = 0; S.miniIndex = 0; S.activeMini = null;
  startGoal();
  setTimeout(startMini, 1200);

  // boot factory
  const factory = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diff,
    duration: time,

    pools: { good: POOLS_GOOD, bad: POOLS_BAD, trick: POOLS_TRICK },

    goodRate: isResearch ? 0.70 : 0.66,
    trickRate: isResearch ? 0.06 : 0.08,

    powerups: POWERUPS,
    powerRate: isResearch ? 0.10 : 0.12,
    powerEvery: 6,

    allowAdaptive: !isResearch,

    // spread
    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',
    minSeparation: 0.92,
    maxSpawnTries: 18,

    seed: seed || null,

    spawnHost: layer || '#hvr-layer',
    boundsHost: EL.playfield() || '#playfield',

    // ✅ P1: Hydration ORB signature
    decorateTarget: (el, parts, data, meta) => {
      el.classList.add('hydr-orb');

      if (parts && parts.icon){
        parts.icon.style.fontSize = (meta.size * 0.66) + 'px';
        parts.icon.style.lineHeight = '1';
      }

      const core = DOC.createElement('div');
      core.className = 'hydr-core';

      const bubbles = DOC.createElement('div');
      bubbles.className = 'hydr-bubbles';
      const n = 5 + Math.floor(Math.random()*3);
      for(let i=0;i<n;i++){
        const b = DOC.createElement('i');
        b.style.left = (18 + Math.random()*64) + '%';
        b.style.top  = (52 + Math.random()*38) + '%';
        b.style.animationDelay = (-Math.random()*1.2).toFixed(2) + 's';
        const sz = (8 + Math.random()*8);
        b.style.width = b.style.height = sz.toFixed(0) + 'px';
        bubbles.appendChild(b);
      }

      const ripple = DOC.createElement('div');
      ripple.className = 'hydr-ripple';

      el.appendChild(core);
      el.appendChild(bubbles);
      el.appendChild(ripple);

      if (data.itemType === 'bad'){
        el.style.filter = 'saturate(1.15) hue-rotate(-10deg)';
      } else if (data.itemType === 'power'){
        el.style.filter = 'saturate(1.25) brightness(1.06)';
      }
    },

    judge,
    onExpire
  });

  S.factory = factory;

  // ✅ FIX: ฟัง hha:time แล้ว "อย่า dispatch ซ้ำชื่อเดิม"
  const onTime = (ev) => {
    const sec = Number(ev && ev.detail && ev.detail.sec);
    if (!Number.isFinite(sec)) return;

    S.secLeft = sec;
    syncStatsHud();

    if (sec > 0) onSecondTick();
    else endGame('timeup');
  };

  ROOT.addEventListener('hha:time', onTime);

  const onStop = () => stop('stop');
  ROOT.addEventListener('hha:stop', onStop);

  bindCenterTapShoot();

  emitScore({ started:true, research:isResearch, seed: seed || '' });

  ROOT.HHA_HYDRATION = {
    stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} },
    shoot(){ try{ return factory && factory.shootCrosshair && factory.shootCrosshair(); }catch{ return false; } },
    state:S
  };
}

// ---------- wire UI on DOM ready ----------
function init(){
  if (!DOC) return;

  setupMotionButton();
  setupVRButton();
  setupStopButton();
  setupEndButtons();
  setupStartOverlay();

  coach('พร้อมแล้ว เก็บน้ำดี ๆ นะ! 💧', 'happy', 1400);

  if (qbool('autostart', false)){
    const ov = EL.startOverlay();
    if (ov) ov.style.display = 'none';
    startGame();
  }
}

if (DOC && DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init);
else init();
