// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY/RESEARCH) — PRODUCTION
// ✅ mode-factory: FULL-SPREAD + GRID9 + autoRelaxSafezone (แก้เป้าเกิดที่เดียว)
// ✅ water gauge + fever/shield + miss definition
// ✅ goals + mini quests + coach messages
// ✅ events: hha:score / quest:update / hha:coach / hha:time / hha:end
// ✅ seed support (?seed=...) for research reproducibility

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// --------------------- Root & modules ---------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, judgeText(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  null;

// --------------------- tiny utils ---------------------
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
function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}
function pickHost(selList){
  if (!DOC) return null;
  for (const s of selList){
    try{
      const el = DOC.querySelector(s);
      if (el) return el;
    }catch{}
  }
  return null;
}

// --------------------- context (hub/query/storage) ---------------------
function readContext(){
  const p = qs();
  const diff = String(p.get('diff') || 'normal').toLowerCase();
  const run  = String(p.get('run')  || 'play').toLowerCase(); // play | research
  const time = clamp(Number(p.get('time') || 60), 20, 180);

  // research seed (stable replay)
  const seed = String(p.get('seed') || p.get('sessionId') || p.get('sid') || p.get('ts') || '').trim();

  // optional study fields
  const studyId = p.get('studyId') || p.get('study') || '';
  const phase   = p.get('phase') || '';
  const conditionGroup = p.get('cond') || p.get('g') || '';

  return { diff, run, time, seed, studyId, phase, conditionGroup };
}

// --------------------- game constants ---------------------
const POOLS_GOOD = ['💧','🫗','🚰','🧊','🥛'];          // น้ำ/น้ำแข็ง/นม (good)
const POOLS_BAD  = ['🥤','🧋','🍹','🧃','🍾'];          // หวาน/น้ำอัดลม (bad)
const POOLS_TRICK= ['🥛','🧊'];                        // fakeGood (หลอก: ดูดีแต่ทำให้ gauge แกว่ง)
const POWERUPS   = ['🛡️','⭐'];                        // shield / bonus

// water gauge model: 0..100 (green 40..60)
const Z_GREEN_MIN = 40;
const Z_GREEN_MAX = 60;

// --------------------- state ---------------------
const S = {
  started: false,
  stopped: false,
  t0: 0,

  // score
  score: 0,
  combo: 0,
  comboMax: 0,

  // miss definition
  miss: 0,              // = goodExpired + junkHit (shield-blocked junk NOT counted)
  goodExpired: 0,
  junkHit: 0,
  junkHitGuard: 0,

  // hits
  hitGood: 0,
  hitBad: 0,
  hitPerfect: 0,

  // gauge
  water: 50,
  waterZone: 'GREEN',
  greenSec: 0,

  // shield
  shieldOn: false,
  shieldUntil: 0,
  shieldBlocks: 0,

  // timing
  secLeft: 60,
  duration: 60,

  // quest
  goalIndex: 0,
  miniIndex: 0,
  activeMini: null,

  // engine
  factory: null,
};

// --------------------- fever/shield helpers ---------------------
function setShield(on, ms=0){
  S.shieldOn = !!on;
  if (on) S.shieldUntil = now() + Math.max(250, ms||0);
  else S.shieldUntil = 0;

  // ถ้ามี FeverUI จริง ให้ sync
  try{
    if (FeverUI && typeof FeverUI.setShield === 'function') FeverUI.setShield(S.shieldOn, ms);
    if (FeverUI && typeof FeverUI.shield === 'function' && S.shieldOn) FeverUI.shield(ms);
  }catch{}
}
function updateShield(){
  if (!S.shieldOn) return;
  if (S.shieldUntil && now() > S.shieldUntil){
    setShield(false, 0);
  }
}
function addFever(delta){
  try{
    if (FeverUI && typeof FeverUI.add === 'function') FeverUI.add(delta);
  }catch{}
}

// --------------------- HUD emitters ---------------------
function emitScore(extra = {}){
  const accGood = (S.hitGood + S.goodExpired) > 0
    ? Math.round((S.hitGood / (S.hitGood + S.goodExpired)) * 100)
    : 0;

  dispatch('hha:score', {
    modeKey: 'hydration',
    score: S.score,
    combo: S.combo,
    comboMax: S.comboMax,
    misses: S.miss,
    goodExpired: S.goodExpired,
    junkHit: S.junkHit,
    junkHitGuard: S.junkHitGuard,
    hitGood: S.hitGood,
    hitBad: S.hitBad,
    hitPerfect: S.hitPerfect,
    accuracyGoodPct: accGood,
    water: S.water,
    waterZone: S.waterZone,
    shieldOn: S.shieldOn,
    ...extra
  });
}

function coach(text, mood='neutral', ms=1600){
  dispatch('hha:coach', { text, mood, ms });
}

// --------------------- quest system (simple + fun) ---------------------
const GOALS = [
  { key:'g1', title:'Goal 1: ดื่มน้ำให้ได้ 15 ครั้ง 💧', total:15 },
  { key:'g2', title:'Goal 2: ทำคอมโบให้ได้ 8 🔥', total:8 },
  { key:'g3', title:'Goal 3: อยู่โซน GREEN รวม 20 วิ 🟢', total:20 },
];

const MINIS = [
  { key:'m1', title:'Mini: Hydro Rush — 5 ภายใน 8 วิ (ห้ามโดนขยะ) ⚡', total:5, timeLimit:8, noJunk:true },
  { key:'m2', title:'Mini: Perfect 3 — โดน “Perfect” 3 ครั้ง 🎯', total:3 },
  { key:'m3', title:'Mini: Shield Save — บล็อกขยะด้วยโล่ 2 ครั้ง 🛡️', total:2 },
];

function questUpdate(kind, payload){
  dispatch('quest:update', { modeKey:'hydration', kind, ...payload });
}

function startGoal(){
  const g = GOALS[S.goalIndex] || null;
  if (!g) return;
  questUpdate('goal', { title: g.title, current: 0, total: g.total, done:false });
  coach(g.title, 'happy', 1300);
}
function completeGoal(){
  const g = GOALS[S.goalIndex];
  if (!g) return;
  questUpdate('goal', { title: g.title, current: g.total, total: g.total, done:true });
  try{ Particles.celebrate && Particles.celebrate('goal'); }catch{}
  coach('ผ่านแล้ว! 🎉', 'happy', 1200);
  S.goalIndex++;
  if (S.goalIndex < GOALS.length){
    setTimeout(startGoal, 650);
  } else {
    coach('Goal ครบแล้ว! ไปต่อ Mini quest กันเลย 😎', 'happy', 1500);
  }
}

function startMini(){
  const m = MINIS[S.miniIndex] || null;
  S.activeMini = null;
  if (!m) return;

  const st = {
    key: m.key,
    title: m.title,
    total: m.total,
    cur: 0,
    tStart: now(),
    timeLimit: m.timeLimit || 0,
    noJunk: !!m.noJunk,
    failed: false,
  };
  S.activeMini = st;

  questUpdate('mini', { title: st.title, current: 0, total: st.total, done:false });
  coach(st.title, 'neutral', 1400);
}
function failMini(reason='พลาด!'){
  if (!S.activeMini || S.activeMini.failed) return;
  S.activeMini.failed = true;
  questUpdate('mini', { title: S.activeMini.title, current: S.activeMini.cur, total: S.activeMini.total, done:false, failed:true, reason });
  coach('ไม่เป็นไร ลองใหม่รอบหน้า ✨', 'neutral', 1200);
  S.activeMini = null;
  S.miniIndex++;
  setTimeout(startMini, 900);
}
function completeMini(){
  if (!S.activeMini) return;
  questUpdate('mini', { title: S.activeMini.title, current: S.activeMini.total, total: S.activeMini.total, done:true });
  try{ Particles.celebrate && Particles.celebrate('mini'); }catch{}
  coach('Mini ผ่าน! ✨', 'happy', 1100);
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

// --------------------- gauge logic ---------------------
function applyWater(delta){
  S.water = clamp(S.water + delta, 0, 100);
  S.waterZone = zoneFrom ? zoneFrom(S.water) : (S.water>=Z_GREEN_MIN && S.water<=Z_GREEN_MAX ? 'GREEN' : (S.water<Z_GREEN_MIN ? 'LOW' : 'HIGH'));
  try{ setWaterGauge(S.water); }catch{}
}

function onSecondTick(){
  // green sec accumulation
  if (S.waterZone === 'GREEN') S.greenSec++;
  tickMini();

  // goal3 progress
  const g = GOALS[S.goalIndex];
  if (g && g.key === 'g3'){
    questUpdate('goal', { title: g.title, current: Math.min(S.greenSec, g.total), total: g.total, done:false });
    if (S.greenSec >= g.total) completeGoal();
  }
}

// --------------------- judge + expire (core scoring) ---------------------
function scoreHitGood(ctx){
  const perfect = !!ctx.hitPerfect;
  const base = perfect ? 140 : 110;
  const comboBonus = Math.min(120, S.combo * 6);
  const delta = base + comboBonus;

  S.hitGood++;
  if (perfect) S.hitPerfect++;

  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);

  // gauge: good brings toward center
  // if low -> increase more, if high -> increase less
  const centerPull = (S.water < 50) ? 6 : 3;
  applyWater(centerPull);

  addFever(+6 + (perfect ? 3 : 0));

  S.score += delta;

  // FX
  try{
    const r = ctx.targetRect;
    if (r) Particles.scorePop(delta, r.left + r.width/2, r.top + r.height/2);
    if (r) Particles.burstAt(r.left + r.width/2, r.top + r.height/2, 'good');
  }catch{}

  return { scoreDelta: delta, good: true };
}

function scoreHitBad(ctx){
  // Shield block?
  updateShield();
  if (S.shieldOn){
    S.junkHitGuard++;
    S.shieldBlocks++;
    // do NOT count miss when blocked
    try{
      const r = ctx.targetRect;
      if (r) Particles.judgeText && Particles.judgeText('BLOCK!', r.left + r.width/2, r.top + r.height/2);
      if (r) Particles.burstAt(r.left + r.width/2, r.top + r.height/2, 'shield');
    }catch{}
    // mini: shield save
    if (S.activeMini && S.activeMini.key === 'm3'){
      S.activeMini.cur = Math.min(S.activeMini.total, S.shieldBlocks);
      questUpdate('mini', { title:S.activeMini.title, current:S.activeMini.cur, total:S.activeMini.total, done:false });
      if (S.activeMini.cur >= S.activeMini.total) completeMini();
    }
    return { scoreDelta: +20, good: true, blocked: true };
  }

  const base = -120;
  const extra = -Math.min(120, S.combo * 4);
  const delta = base + extra;

  S.hitBad++;
  S.junkHit++;
  S.miss++; // ✅ miss includes junkHit (not blocked)
  S.combo = 0;

  // gauge: bad pushes away from center (messy)
  applyWater((S.water < 50) ? -8 : +8);

  addFever(-10);

  S.score = Math.max(0, S.score + delta);

  try{
    const r = ctx.targetRect;
    if (r) Particles.scorePop(delta, r.left + r.width/2, r.top + r.height/2);
    if (r) Particles.burstAt(r.left + r.width/2, r.top + r.height/2, 'bad');
  }catch{}

  // mini rules
  if (S.activeMini && S.activeMini.noJunk) failMini('โดนขยะ ❌');

  return { scoreDelta: delta, good: false };
}

function scoreHitPower(ctx){
  // power: shield 3.2s or bonus
  const icon = String(ctx && ctx.itemType) === 'power' ? 'power' : 'power';
  const r = ctx.targetRect;

  // give shield always (simple)
  setShield(true, 3200);
  addFever(+8);

  const delta = 80;
  S.score += delta;
  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);

  try{
    if (r) Particles.scorePop(delta, r.left + r.width/2, r.top + r.height/2);
    if (r) Particles.burstAt(r.left + r.width/2, r.top + r.height/2, icon);
  }catch{}

  coach('ได้โล่แล้ว! บล็อกขยะได้ 🛡️', 'happy', 1000);
  return { scoreDelta: delta, good: true };
}

function scoreHitFakeGood(ctx){
  // fakeGood: ให้คะแนนนิด แต่ทำ gauge แกว่ง + ลดคอมโบเล็กน้อย
  const perfect = !!ctx.hitPerfect;
  const delta = perfect ? 90 : 70;

  S.hitGood++;
  if (perfect) S.hitPerfect++;

  // ลดคอมโบถ้าโดนของหลอก (เกมจะต่าง/สนุกขึ้น)
  S.combo = Math.max(0, S.combo - 2);

  // gauge swing
  applyWater((S.water < 50) ? +10 : -10);

  addFever(+3);

  S.score += delta;

  try{
    const r = ctx.targetRect;
    if (r) Particles.scorePop(delta, r.left + r.width/2, r.top + r.height/2);
    if (r) Particles.burstAt(r.left + r.width/2, r.top + r.height/2, 'trick');
  }catch{}

  coach('ระวัง! ของหลอก 😵‍💫', 'sad', 800);

  return { scoreDelta: delta, good: true, trick:true };
}

function judge(ch, ctx){
  // ctx: {isGood,isPower,itemType,hitPerfect,hitDistNorm,targetRect}
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
      // 5 in 8 sec no junk
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
    } else if (m.key === 'm3'){
      // handled by shield blocks in scoreHitBad when blocked
    }
  }

  emitScore();
  return res;
}

function onExpire(info){
  // info: {ch,isGood,isPower,itemType}
  const itemType = String(info && info.itemType || '');
  if (itemType === 'good' || itemType === 'fakeGood'){
    // ✅ goodExpired counts as miss
    S.goodExpired++;
    S.miss++;
    S.combo = 0;
    addFever(-6);
    // gauge drift slightly
    applyWater((S.water < 50) ? -2 : +2);

    // mini rule: rush/no junk doesn't fail on expire, but slows progress
    emitScore({ reason:'expireGood' });
  }
  // bad expire: no penalty
}

// --------------------- end summary ---------------------
function endGame(reason='timeup'){
  if (S.stopped) return;
  S.stopped = true;

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
}

// --------------------- boot ---------------------
async function main(){
  if (!DOC) return;

  const ctx = readContext();
  S.duration = ctx.time;
  S.secLeft = ctx.time;

  // mode (play vs research)
  const isResearch = (ctx.run === 'research' || ctx.run === 'study');

  // ensure gauges
  try{ ensureWaterGauge(); }catch{}
  applyWater(0);

  // initial coach
  coach(isResearch ? 'โหมดวิจัย: ความยากตามที่ตั้งไว้ (ไม่มี adaptive) 🧪' : 'โหมดเล่น: มี adaptive ปรับตามฝีมือ 😎', 'neutral', 1600);

  // quest init
  startGoal();
  setTimeout(startMini, 1200);

  // hosts (robust selectors)
  const spawnHost =
    pickHost(['#hy-layer', '#hydr-layer', '#hvr-layer', '.hvr-layer', '[data-hvr-layer="1"]']) || undefined;
  const boundsHost =
    pickHost(['#hy-bounds', '#hydr-bounds', '#playfield', '#hvr-playfield', '.hvr-playfield', '[data-hvr-bounds="1"]']) || undefined;

  // boot factory
  S.t0 = now();
  S.started = true;

  const factory = await factoryBoot({
    modeKey: 'hydration',
    difficulty: ctx.diff,
    duration: ctx.time,

    pools: {
      good: POOLS_GOOD,
      bad:  POOLS_BAD,
      trick: POOLS_TRICK
    },

    // spawn ratios
    goodRate: isResearch ? 0.70 : 0.66,
    trickRate: isResearch ? 0.06 : 0.08,

    // powerups
    powerups: POWERUPS,
    powerRate: isResearch ? 0.10 : 0.12,
    powerEvery: 6,

    // adaptive
    allowAdaptive: !isResearch,

    // ✅ FULL-SPREAD + GRID9
    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',
    minSeparation: 0.92,
    maxSpawnTries: 18,

    // ✅ safezone padding (กันทับ HUD)
    playPadXFrac: 0.10,
    playPadTopFrac: 0.14,
    playPadBotFrac: 0.16,

    // ✅ auto relax safezone (กันเป้ากองจุดเดียวบนมือถือ)
    autoRelaxSafezone: true,
    relaxThresholdMul: 1.30,
    relaxStep: 0.35,
    relaxStep2: 0.70,

    // seed (research)
    seed: ctx.seed || null,

    // hosts
    spawnHost: spawnHost || undefined,
    boundsHost: boundsHost || undefined,

    judge,
    onExpire
  });

  S.factory = factory;

  // listen time ticks
  const onTime = (ev) => {
    const sec = Number(ev && ev.detail && ev.detail.sec);
    if (!Number.isFinite(sec)) return;
    S.secLeft = sec;
    if (sec > 0) onSecondTick();
    else endGame('timeup');
  };
  ROOT.addEventListener('hha:time', onTime);

  // safety: stop event
  const onStop = () => { try{ factory && factory.stop && factory.stop(); }catch{} endGame('stop'); };
  ROOT.addEventListener('hha:stop', onStop);

  // expose (debug)
  ROOT.HHA_HYDRATION = {
    stop(){
      try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
      try{ ROOT.removeEventListener('hha:stop', onStop); }catch{}
      try{ factory && factory.stop && factory.stop(); }catch{}
      endGame('manual');
    },
    shoot(){
      try{ return factory && factory.shootCrosshair && factory.shootCrosshair(); }catch{ return false; }
    },
    state: S
  };

  // initial score
  emitScore({ started:true, research:isResearch, seed: ctx.seed || '' });
}

main().catch(err => {
  console.error('[hydration.safe] boot error', err);
  try{ dispatch('hha:coach', { text:'บูตไม่สำเร็จ (ดู console) ❌', mood:'sad', ms:2200 }); }catch{}
});