// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration SAFE — PRODUCTION FINAL (Merged AI)
// ✅ Minis count = Storm Cycles (นับจริง)
// ✅ Storm Success = จำนวนพายุที่ "ผ่าน mini" จริง (+ boss bonus)
// ✅ End-window FX: blink + tick + gentle shake
// ✅ Boss-mini optional: block bossbad xN in boss window
// ✅ AI Coach hooks + rate-limit
// ✅ AI Difficulty Director: fair, smooth, deterministic (seeded)
// ✅ AI Pattern Generator: spawn patterns (uniform/grid9/ring/stormSwirl/bossBurst) seeded
// ✅ Aim-assist: listens hha:shoot -> shoot nearest target within lockPx
// ✅ Summary fields match HUD + HHA_LAST_SUMMARY

'use strict';

import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createAICoach } from '../vr/ai-coach.js';
import { createAIDifficultyDirector } from '../vr/ai-director.js';
import { createAIPatternGenerator } from '../vr/ai-pattern.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function setText(id, v){
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(v);
}

// ---------- CSV / copy ----------
function toCSVRow(obj){
  const keys = Object.keys(obj);
  const esc = (v)=>{
    const s = String(v ?? '');
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  return keys.join(',') + '\n' + keys.map(k=>esc(obj[k])).join(',') + '\n';
}
function downloadText(filename, text, type='text/plain'){
  try{
    const blob = new Blob([text], {type});
    const a = DOC.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      try{ URL.revokeObjectURL(a.href); }catch(_){}
      try{ a.remove(); }catch(_){}
    }, 50);
  }catch(_){}
}
async function copyToClipboard(text){
  try{ await navigator.clipboard.writeText(text); return true; }
  catch(_){
    try{
      const ta = DOC.createElement('textarea');
      ta.value = text;
      DOC.body.appendChild(ta);
      ta.select();
      DOC.execCommand('copy');
      ta.remove();
      return true;
    }catch(_){}
  }
  return false;
}

// -------------------- View helpers --------------------
function isCardboard(){
  try{ return DOC.body.classList.contains('cardboard'); }catch(_){ return false; }
}
function getLayers(){
  const cfg = ROOT.HHA_VIEW;
  if (cfg && Array.isArray(cfg.layers) && cfg.layers.length){
    const arr = cfg.layers.map(id=>DOC.getElementById(id)).filter(Boolean);
    if (arr.length) return arr;
  }
  const main = DOC.getElementById('hydration-layer');
  const L = DOC.getElementById('hydration-layerL');
  const R = DOC.getElementById('hydration-layerR');
  if (isCardboard() && L && R) return [L,R];
  return [main].filter(Boolean);
}
function getPlayfield(){
  return isCardboard() ? DOC.getElementById('cbPlayfield') : DOC.getElementById('playfield');
}
function getPlayfieldRect(){
  const pf = getPlayfield();
  const r = pf?.getBoundingClientRect();
  return r || { left:0, top:0, width:1, height:1, right:1, bottom:1 };
}

// -------------------- Config --------------------
const diff = String(qs('diff','normal')).toLowerCase();
const run  = String(qs('run', qs('runMode','play'))).toLowerCase();
const timeLimit = clamp(parseInt(qs('time', qs('durationPlannedSec', 70)),10) || 70, 20, 600);
const hub = String(qs('hub','./hub.html'));

const sessionId = String(qs('sessionId', qs('studentKey','')) || '');
const ts = String(qs('ts', Date.now()));
const seed = String(qs('seed', sessionId ? (sessionId + '|' + ts) : ts));
const logEndpoint = String(qs('log','') || '');

// Aim / assist tuning
function getAimConfig(){
  const lockPx = clamp(parseInt(qs('lock', '120'),10) || 120, 20, 260);
  const offsetX = clamp(parseInt(qs('aimx', '0'),10) || 0, -80, 80);
  const offsetY = clamp(parseInt(qs('aimy', '0'),10) || 0, -120, 120);
  return { lockPx, offsetX, offsetY };
}

// RNG deterministic-ish
function hashStr(s){
  s=String(s||''); let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0);
}
function makeRng(seedStr){
  let x = hashStr(seedStr) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0) / 4294967296;
  };
}
const rng = makeRng(seed);

// -------------------- Audio tick/beep (no file needed) --------------------
let AC=null;
function ensureAC(){
  try{
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  }catch(_){}
}
function tickBeep(freq=900, dur=0.045, vol=0.06){
  try{
    ensureAC(); if(!AC) return;
    const t0 = AC.currentTime;
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type='square';
    o.frequency.value=freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0+0.005);
    g.gain.linearRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t0); o.stop(t0+dur+0.01);
  }catch(_){}
}

// -------------------- AI modules --------------------
const AIDIR = createAIDifficultyDirector({ seed, rng, mode: run, diff });
const AIPAT = createAIPatternGenerator({ seed, rng });
AIPAT.setMode(String(qs('pat','')).toLowerCase() || (diff==='hard' ? 'grid9' : 'uniform'));

// -------------------- State --------------------
const S = {
  started:false,
  ended:false,
  t0:0,
  lastTick:0,
  leftSec: timeLimit,

  score:0,
  combo:0,
  comboMax:0,
  misses:0,

  nGoodSpawn:0,
  nBadSpawn:0,
  nShieldSpawn:0,
  nHitGood:0,
  nHitBad:0,
  nHitBadGuard:0,
  nExpireGood:0,

  streakGood:0,
  streakMax:0,

  waterPct:50,
  waterZone:'GREEN',

  shield:0,
  shieldMax:3,

  greenHold:0,

  // Storm/Mini
  stormActive:false,
  stormLeftSec:0,
  stormCycle:0,
  stormSuccess:0,

  endWindowSec:1.2,
  inEndWindow:false,

  miniState:{
    zoneOK:false,
    pressure:0,
    pressureOK:false,
    endWindow:false,
    blockedInEnd:false,
    doneThisStorm:false,
    gotHitByBad:false
  },

  // Boss-mini (optional)
  bossEnabled:true,
  bossActive:false,
  bossNeed:2,
  bossBlocked:0,
  bossDoneThisStorm:false,
  bossWindowSec:2.2,

  // End window fx
  endFxOn:false,
  endFxTickAt:0,

  adaptiveOn: (run !== 'research'),

  // AI snapshot (updated each frame)
  _ai: null
};

const TUNE = (() => {
  const sizeBase = diff==='easy' ? 78 : diff==='hard' ? 56 : 66;
  const spawnBaseMs = diff==='easy' ? 680 : diff==='hard' ? 480 : 580;
  const stormEverySec = diff==='easy' ? 18 : diff==='hard' ? 14 : 16;
  const stormDurSec = diff==='easy' ? 5.2 : diff==='hard' ? 6.2 : 5.8;

  const greenTarget = clamp(
    Math.round(timeLimit * (diff==='easy' ? 0.42 : diff==='hard' ? 0.55 : 0.48)),
    18,
    Math.max(18, timeLimit-8)
  );

  return {
    sizeBase,
    spawnBaseMs,
    spawnJitter:170,
    goodLifeMs: diff==='hard'? 930 : 1080,
    badLifeMs:  diff==='hard'? 980 : 1120,
    shieldLifeMs:1350,
    stormEverySec,
    stormDurSec,
    stormSpawnMul: diff==='hard'? 0.56 : 0.64,
    endWindowSec:1.2,
    bossWindowSec: diff==='hard'? 2.4 : 2.2,
    nudgeToMid:5.0,
    badPush:8.0,
    missPenalty:1,
    greenTargetSec: greenTarget,

    // mini pressure requirement (base)
    pressureNeed: diff==='easy' ? 0.75 : diff==='hard' ? 1.0 : 0.9
  };
})();
S.endWindowSec = TUNE.endWindowSec;
S.bossWindowSec = TUNE.bossWindowSec;

// -------------------- Water helpers --------------------
function updateZone(){ S.waterZone = zoneFrom(S.waterPct); }
function nudgeWaterGood(){
  const mid=55, d=mid - S.waterPct;
  const step=Math.sign(d)*Math.min(Math.abs(d), TUNE.nudgeToMid);
  S.waterPct = clamp(S.waterPct + step, 0, 100);
  updateZone();
}
function pushWaterBad(){
  const mid=55, d=S.waterPct - mid;
  const step=(d>=0?+1:-1)*TUNE.badPush;
  S.waterPct = clamp(S.waterPct + step, 0, 100);
  updateZone();
}

// -------------------- UI sync --------------------
function computeAccuracy(){
  return clamp((S.nHitGood / Math.max(1,S.nGoodSpawn))*100, 0, 100);
}
function computeGrade(){
  const acc = computeAccuracy();
  const miss = S.misses|0;
  const mini = S.stormSuccess|0;
  if (acc >= 95 && miss <= 2 && mini >= 1) return 'SSS';
  if (acc >= 90 && miss <= 4) return 'SS';
  if (acc >= 82) return 'S';
  if (acc >= 70) return 'A';
  if (acc >= 55) return 'B';
  return 'C';
}
function syncWaterPanelDOM(){
  const bar = DOC.getElementById('water-bar');
  const pct = DOC.getElementById('water-pct');
  const zone = DOC.getElementById('water-zone');
  if (bar) bar.style.width = clamp(S.waterPct,0,100).toFixed(0)+'%';
  if (pct) pct.textContent = String(S.waterPct|0);
  if (zone) zone.textContent = String(S.waterZone||'');
}
function syncHUD(){
  const grade = computeGrade();
  setText('stat-score', S.score|0);
  setText('stat-combo', S.combo|0);
  setText('stat-miss', S.misses|0);
  setText('stat-time', S.leftSec|0);
  setText('stat-grade', grade);
  setText('storm-left', S.stormActive ? (S.stormLeftSec|0) : 0);
  setText('shield-count', S.shield|0);

  setText('quest-line1', `คุม GREEN ให้ครบ ${TUNE.greenTargetSec|0}s (สะสม)`);
  setText('quest-line2', `GREEN: ${S.greenHold.toFixed(1)} / ${TUNE.greenTargetSec.toFixed(0)}s`);

  if (S.stormActive){
    const m = S.miniState;
    const bossTxt = (S.bossEnabled && S.bossActive) ? ` • BOSS 🌩️ ${S.bossBlocked}/${S.bossNeed}` : '';
    setText('quest-line3', `Storm Mini: LOW/HIGH + BLOCK${bossTxt}`);
    setText('quest-line4',
      `Mini: zone=${m.zoneOK?'OK':'NO'} pressure=${m.pressureOK?'OK':'..'} end=${m.endWindow?'YES':'..'} block=${m.blockedInEnd?'YES':'..'}`
      + (m.gotHitByBad ? ' • FAIL: HIT BAD' : '')
    );
  } else {
    setText('quest-line3', `รอ Storm แล้วค่อยทำ Mini`);
    setText('quest-line4', `State: เก็บ Shield ก่อนพายุ`);
  }

  setWaterGauge(S.waterPct);
  syncWaterPanelDOM();

  emit('hha:score', {
    score:S.score|0,
    combo:S.combo|0,
    comboMax:S.comboMax|0,
    misses:S.misses|0,
    accuracyGoodPct: computeAccuracy(),
    grade,
    waterPct:S.waterPct,
    waterZone:S.waterZone,
    shield:S.shield|0,
    stormActive:!!S.stormActive,
    stormLeftSec:S.stormLeftSec,
    stormCycles:S.stormCycle|0,
    stormSuccess:S.stormSuccess|0
  });

  emit('quest:update', {
    goalsCleared: (S.greenHold >= TUNE.greenTargetSec) ? 1 : 0,
    goalsTotal: 1,
    miniCleared: S.stormSuccess|0,
    miniTotal: S.stormCycle|0,
    miniUrgent: S.stormActive && S.inEndWindow
  });
}

// -------------------- Target style (ensure) --------------------
(function injectTargetStyle(){
  if (DOC.getElementById('hvr-target-style')) return;
  const st = DOC.createElement('style');
  st.id='hvr-target-style';
  st.textContent = `
  .hvr-target{
    position:absolute;
    left: var(--x, 50%);
    top: var(--y, 50%);
    transform: translate(-50%,-50%);
    width: var(--s, 64px);
    height: var(--s, 64px);
    display:flex; align-items:center; justify-content:center;
    font-size: calc(var(--s,64px) * 0.55);
    border-radius: 999px;
    border:1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.50);
    box-shadow: 0 18px 60px rgba(0,0,0,.45);
    backdrop-filter: blur(10px);
    user-select:none;
    pointer-events:auto;
    cursor:pointer;
    will-change: transform, filter, opacity;
  }
  .hvr-target.good{ outline: 2px solid rgba(34,197,94,.18); }
  .hvr-target.bad { outline: 2px solid rgba(239,68,68,.18); }
  .hvr-target.shield{ outline: 2px solid rgba(34,211,238,.18); }
  .hvr-target.bossbad{
    outline: 2px dashed rgba(239,68,68,.35);
    box-shadow: 0 18px 70px rgba(0,0,0,.55), 0 0 22px rgba(239,68,68,.10);
  }
  body.hha-endfx #hudTop{
    animation: hhaBlink .22s infinite alternate;
  }
  body.hha-endfx #playfield, body.hha-endfx #cbPlayfield{
    animation: hhaShake .18s infinite;
  }
  @keyframes hhaBlink{ from{ filter:brightness(1);} to{ filter:brightness(1.12);} }
  @keyframes hhaShake{
    0%{ transform: translate(0,0); }
    25%{ transform: translate(1px,0); }
    50%{ transform: translate(0,1px); }
    75%{ transform: translate(-1px,0); }
    100%{ transform: translate(0,-1px); }
  }`;
  DOC.head.appendChild(st);
})();

// -------------------- Spawn position via AI Pattern (with safe clamp) --------------------
function pickXY(){
  const meta = {
    inStorm: !!S.stormActive,
    inBoss:  !!(S.bossEnabled && S.bossActive),
    strategy: String(qs('pat','')||'').toLowerCase() || ''
  };
  const p = AIPAT.next(meta); // 0..100
  // clamp safe-zone กันทับ HUD โดยรวม ๆ (เปอร์เซ็นต์)
  const xPct = clamp(p.xPct, 6, 94);
  const yPct = clamp(p.yPct, 10, 90);
  return { xPct, yPct };
}

// -------------------- AI-driven size/spawn/kind helpers --------------------
function targetSize(){
  let s = TUNE.sizeBase;

  if (S.stormActive) s *= (diff==='hard'?0.78:0.82);

  const ai = S._ai;
  if (ai) s *= ai.sizeMul;

  return clamp(s,44,86);
}
function nextSpawnDelay(){
  let base = TUNE.spawnBaseMs + (rng()*2-1)*TUNE.spawnJitter;

  const ai = S._ai;
  if (ai) base *= ai.spawnMul;

  if (S.stormActive) base *= TUNE.stormSpawnMul;

  return clamp(base, 210, 1200);
}
function pickKind(){
  let pGood=0.66, pBad=0.28, pSh=0.06;

  if (S.stormActive){
    pGood=0.52; pBad=0.38; pSh=0.10;
    if (S.bossEnabled && S.bossActive){
      pBad += 0.10;
      pGood -= 0.10;
    }
  }
  if (diff==='hard'){ pBad+=0.04; pGood-=0.04; }

  const ai = S._ai;
  const badMul = ai ? ai.badMul : 1.0;
  const shieldMul = ai ? ai.shieldMul : 1.0;

  pBad = clamp(pBad * badMul, 0.05, 0.80);
  pSh  = clamp(pSh  * shieldMul, 0.02, 0.22);
  pGood = clamp(1 - (pBad + pSh), 0.10, 0.90);

  const r=rng();
  if (r<pSh) return 'shield';
  if (r<pSh+pBad) return 'bad';
  return 'good';
}

// -------------------- Aim-assist shooting registry --------------------
const ACTIVE = new Map(); // el -> { kind, hit(), bornAt }
let lastShootAt = 0;

function playfieldCenter(){
  const r = getPlayfieldRect();
  const { offsetX, offsetY } = getAimConfig();
  return { cx: r.left + r.width/2 + offsetX, cy: r.top + r.height/2 + offsetY };
}
function getAimLockPx(){
  const base = getAimConfig().lockPx;
  const ai = S._ai;
  if (!ai) return base;
  // assistMul >1 => easier (bigger lock)
  return clamp(base * ai.assistMul, 20, 240);
}

function aimShoot(src='event'){
  if (!S.started || S.ended) return;
  const now = performance.now();
  if (now - lastShootAt < 55) return; // anti-spam
  lastShootAt = now;

  const { cx, cy } = playfieldCenter();
  const lockPx = getAimLockPx();

  let bestEl = null;
  let bestD = Infinity;

  for (const [el, meta] of ACTIVE.entries()){
    if (!el || !el.isConnected) { ACTIVE.delete(el); continue; }
    const r = el.getBoundingClientRect();
    const ex = r.left + r.width/2;
    const ey = r.top + r.height/2;
    const dx = ex - cx;
    const dy = ey - cy;
    const d = Math.hypot(dx,dy);
    if (d < bestD){
      bestD = d;
      bestEl = el;
    }
  }

  if (bestEl && bestD <= lockPx){
    const meta = ACTIVE.get(bestEl);
    meta?.hit?.();
  }
}

// -------------------- Spawn targets --------------------
let lastHitAt=0;
const HIT_COOLDOWN_MS=55;

function spawn(kind){
  if (S.ended) return;

  const layers = getLayers();
  if (!layers.length) return;

  const { xPct, yPct } = pickXY();
  const s = targetSize();

  const isBossBad = (kind==='bad' && S.bossEnabled && S.bossActive);

  if (kind==='good') S.nGoodSpawn++;
  if (kind==='bad') S.nBadSpawn++;
  if (kind==='shield') S.nShieldSpawn++;

  const life =
    kind==='good' ? TUNE.goodLifeMs :
    kind==='shield' ? TUNE.shieldLifeMs :
    TUNE.badLifeMs;

  let killed=false;
  const nodes=[];

  function buildNode(){
    const el = DOC.createElement('div');
    el.className = `hvr-target ${kind}` + (isBossBad ? ' bossbad' : '');
    el.dataset.kind = kind;
    if (isBossBad) el.dataset.boss='1';

    el.style.setProperty('--x', xPct.toFixed(2)+'%');
    el.style.setProperty('--y', yPct.toFixed(2)+'%');
    el.style.setProperty('--s', s.toFixed(0)+'px');

    el.textContent =
      kind==='good' ? '💧' :
      kind==='shield' ? '🛡️' :
      (isBossBad ? '🌩️' : '🥤');

    el.addEventListener('pointerdown',(ev)=>{
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      onHit();
    }, {passive:false});

    return el;
  }

  function kill(reason){
    if (killed) return;
    killed=true;

    for (const n of nodes){
      try{
        ACTIVE.delete(n);
        n.remove();
      }catch(_){}
    }

    // expire good => miss
    if (reason==='expire' && kind==='good'){
      S.misses += TUNE.missPenalty;
      S.nExpireGood++;
      S.combo=0;
      S.streakGood=0;
      syncHUD();
    }
  }

  function onHit(){
    if (killed || S.ended) return;
    const t=performance.now();
    if (t - lastHitAt < HIT_COOLDOWN_MS) return;
    lastHitAt=t;

    kill('hit');

    if (kind==='good'){
      S.nHitGood++;
      S.score += 10 + Math.min(15, (S.combo|0));
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      nudgeWaterGood();

      S.streakGood++;
      S.streakMax = Math.max(S.streakMax, S.streakGood);

      emit('hha:judge', { kind:'good' });

    } else if (kind==='shield'){
      S.score += 6;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.shield = clamp(S.shield+1, 0, S.shieldMax);
      emit('hha:judge', { kind:'shield' });

    } else {
      // bad hit
      S.streakGood=0;

      if (S.shield>0){
        // guarded => not count as miss
        S.shield--;
        S.nHitBadGuard++;
        S.score += 4;

        // End window block counts for mini
        if (S.stormActive && S.inEndWindow){
          S.miniState.blockedInEnd = true;
          if (S.waterZone !== 'GREEN') emit('hha:judge', { kind:'perfect' });
        }

        // Boss block counts
        if (isBossBad) S.bossBlocked++;

        emit('hha:judge', { kind:'block' });

      } else {
        // unguarded => MISS + fail mini this storm
        S.nHitBad++;
        S.misses++;
        S.combo=0;
        S.score = Math.max(0, S.score-6);
        pushWaterBad();

        if (S.stormActive) S.miniState.gotHitByBad = true;

        emit('hha:judge', { kind:'bad' });
      }
    }

    syncHUD();
  }

  for (const L of layers){
    const el = buildNode();
    nodes.push(el);
    L.appendChild(el);
    ACTIVE.set(el, { kind, hit: onHit, bornAt: performance.now() });
  }

  setTimeout(()=>kill('expire'), life);
}

// -------------------- Storm logic --------------------
function setEndFx(on){
  if (S.endFxOn === on) return;
  S.endFxOn = on;
  DOC.body.classList.toggle('hha-endfx', on);
}

function enterStorm(){
  S.stormActive=true;
  S.stormLeftSec=TUNE.stormDurSec;
  S.stormCycle++;

  S.miniState = {
    zoneOK:false,
    pressure:0,
    pressureOK:false,
    endWindow:false,
    blockedInEnd:false,
    doneThisStorm:false,
    gotHitByBad:false
  };

  S.bossActive=false;
  S.bossBlocked=0;
  S.bossDoneThisStorm=false;

  // push out of GREEN if already GREEN (so mini can be possible)
  if (S.waterZone==='GREEN'){
    S.waterPct = clamp(S.waterPct + (rng()<0.5 ? -7 : +7), 0, 100);
    updateZone();
  }

  setEndFx(false);
  S.endFxTickAt = 0;

  emit('hha:judge', { kind:'storm' });
  syncHUD();
}

function passMiniThisStorm(){
  const m = S.miniState;
  if (m.gotHitByBad) return false; // fairness
  // Must: not GREEN, pressure ok, entered end window, did block in end window
  return !!(m.zoneOK && m.pressureOK && m.endWindow && m.blockedInEnd);
}

function exitStorm(){
  S.stormActive=false;
  S.stormLeftSec=0;
  S.inEndWindow=false;
  setEndFx(false);

  // mini pass count
  const ok = passMiniThisStorm();
  if (ok && !S.miniState.doneThisStorm){
    S.miniState.doneThisStorm=true;
    S.stormSuccess++;
    S.score += 40; // bonus
    emit('hha:judge', { kind:'streak' });
  }

  // boss pass (bonus success)
  if (S.bossEnabled && !S.bossDoneThisStorm && S.bossBlocked>=S.bossNeed){
    S.bossDoneThisStorm=true;
    S.stormSuccess++;
    S.score += 50;
    emit('hha:judge', { kind:'perfect' });
  }

  S.bossActive=false;
  syncHUD();
}

function tickStorm(dt){
  if (!S.stormActive) return;

  S.stormLeftSec = Math.max(0, S.stormLeftSec - dt);

  const inEnd = (S.stormLeftSec <= (TUNE.endWindowSec + 0.02));
  S.inEndWindow = inEnd;
  S.miniState.endWindow = inEnd;

  // End window FX
  if (inEnd){
    setEndFx(true);
    const now = performance.now();
    const rate = clamp(S.stormLeftSec / TUNE.endWindowSec, 0, 1);
    const interval = 320 - 190*(1-rate); // 320ms -> 130ms
    if (now - S.endFxTickAt > interval){
      S.endFxTickAt = now;
      tickBeep(900 + (1-rate)*500, 0.04, 0.05);
    }
  } else {
    setEndFx(false);
  }

  // Boss window
  const inBoss = (S.stormLeftSec <= (S.bossWindowSec + 0.02));
  S.bossActive = (S.bossEnabled && inBoss && !S.bossDoneThisStorm);

  // mini zone
  const zoneOK = (S.waterZone !== 'GREEN');
  if (zoneOK) S.miniState.zoneOK = true;

  // pressure increases only when zoneOK (LOW/HIGH)
  const gain = zoneOK ? 1.05 : 0.25;
  S.miniState.pressure = clamp(S.miniState.pressure + dt*gain, 0, 1);

  const ai = S._ai;
  const need = clamp(TUNE.pressureNeed + (ai ? ai.pressureNeedAdj : 0), 0.65, 1.15);
  if (S.miniState.pressure >= need) S.miniState.pressureOK = true;

  if (S.stormLeftSec <= 0.001) exitStorm();
}

// -------------------- Summary / logging --------------------
async function sendLog(payload){
  if (!logEndpoint) return;
  try{
    await fetch(logEndpoint, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload),
      keepalive:true
    });
  }catch(_){}
}

function computeTier(sum){
  const g=String(sum.grade||'C');
  const acc=Number(sum.accuracyGoodPct||0);
  const miss=Number(sum.misses||0);
  const sOk=Number(sum.stormSuccess||0);

  if ((g==='SSS'||g==='SS') && acc>=90 && miss<=6 && sOk>=2) return 'Legend';
  if (g==='S' && acc>=82 && miss<=12) return 'Master';
  if (g==='A' && acc>=70) return 'Expert';
  if (g==='B' || (acc>=55 && miss<=30)) return 'Skilled';
  return 'Beginner';
}

function buildTips(sum){
  const tips=[];
  const acc=Number(sum.accuracyGoodPct||0);
  const miss=Number(sum.misses||0);
  const goalsOk = (sum.goalsCleared|0) >= 1;
  const cycles = (sum.stormCycles|0);
  const ok = (sum.stormSuccess|0);

  tips.push(goalsOk ? '✅ Goal ผ่านแล้ว (คุม GREEN ได้ดี)' : '🎯 โฟกัส: คุม GREEN ให้ผ่านก่อน');
  if (cycles<=0){
    tips.push('🌀 ยังไม่เจอพายุ: เล่นต่ออีกนิด จะมี STORM ให้ทำ Mini');
  } else if (ok<=0){
    tips.push('🌀 Mini ยังไม่ผ่าน: STORM ต้องทำ “LOW/HIGH” + BLOCK ช่วงท้าย (End Window)');
  } else {
    tips.push(`🔥 ผ่าน Mini แล้ว ${ok}/${cycles} พายุ — ลองให้ผ่านทุกพายุ!`);
  }

  if (acc<60) tips.push('🎯 Accuracy ต่ำ: เล็งค้าง 0.3–0.5 วิ แล้วค่อยยิง');
  else if (acc>=80) tips.push('⚡ Accuracy ดีมาก! ลากคอมโบยาว ๆ เกรดพุ่ง');
  if (miss>=25) tips.push('💥 MISS เยอะ: ลดการรัว + เลือกยิงเป้าที่ชัวร์');

  let next='เพิ่ม Accuracy + ลด MISS';
  if (!goalsOk) next='ทำ Goal ให้ผ่านก่อน';
  else if (cycles>0 && ok<=0) next='ผ่าน Mini ให้ได้อย่างน้อย 1 พายุ';
  else if (acc<70) next='ดัน Accuracy > 70%';
  else if (miss>15) next='ลด MISS < 10';
  else next='คอมโบยาว + ผ่าน Mini ทุกพายุ';

  return { tips, next };
}

function fillSummary(sum){
  const set=(id,v)=>{ const el=DOC.getElementById(id); if(el) el.textContent=String(v); };

  set('rScore', sum.scoreFinal|0);
  set('rGrade', sum.grade||'C');
  set('rAcc', `${Number(sum.accuracyGoodPct||0).toFixed(1)}%`);
  set('rComboMax', sum.comboMax|0);
  set('rMiss', sum.misses|0);
  set('rGoals', `${sum.goalsCleared|0}/${sum.goalsTotal|0}`);

  // minis show = success/cycles
  set('rMinis', `${sum.stormSuccess|0}/${sum.stormCycles|0}`);

  set('rGreen', `${Number(sum.greenHoldSec||0).toFixed(1)}s`);
  set('rStreak', sum.streakMax|0);
  set('rStormCycles', sum.stormCycles|0);
  set('rStormOk', sum.stormSuccess|0);
  set('rStormRate', `${Number(sum.stormRatePct||0).toFixed(0)}%`);

  const tier=computeTier(sum);
  const {tips,next}=buildTips(sum);
  const rTips=DOC.getElementById('rTips');
  const rNext=DOC.getElementById('rNext');
  const rTier=DOC.getElementById('rTier');
  if (rTips) rTips.textContent = tips.map(t=>`• ${t}`).join('\n');
  if (rNext) rNext.textContent = next;
  if (rTier) rTier.textContent = `Tier: ${tier}`;

  const backdrop=DOC.getElementById('resultBackdrop');
  if (backdrop) backdrop.hidden=false;
}

function bindSummaryButtons(){
  const backdrop = DOC.getElementById('resultBackdrop');
  const btnRetry = DOC.getElementById('btnRetry');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const btnClose = DOC.getElementById('btnCloseSummary');
  const btnCopy = DOC.getElementById('btnCopyJSON');
  const btnCSV = DOC.getElementById('btnDownloadCSV');

  btnRetry?.addEventListener('click', ()=>{
    const u = new URL(location.href);
    u.searchParams.set('ts', String(Date.now()));
    location.href = u.toString();
  });

  btnBackHub?.addEventListener('click', ()=>{ location.href = hub; });

  btnClose?.addEventListener('click', ()=>{ if(backdrop) backdrop.hidden=true; });

  btnCopy?.addEventListener('click', async ()=>{
    const raw = localStorage.getItem('HHA_LAST_SUMMARY') || '';
    if (raw) await copyToClipboard(raw);
  });

  btnCSV?.addEventListener('click', ()=>{
    const raw = localStorage.getItem('HHA_LAST_SUMMARY') || '';
    if (!raw) return;
    let obj=null;
    try{ obj=JSON.parse(raw); }catch(_){ return; }
    downloadText(`hha_hydration_${(obj.sessionId||'session')}_${Date.now()}.csv`, toCSVRow(obj), 'text/csv');
  });
}

// -------------------- AI Coach --------------------
const AICOACH = createAICoach({
  emit,
  game:'hydration',
  cooldownMs: 2800
});

// -------------------- Storm schedule --------------------
function nextStormSchedule(){
  const base = TUNE.stormEverySec;
  return base + (rng()*2-1)*1.2;
}

let spawnTimer=0;
let nextStormIn=0;

// -------------------- Update loop --------------------
function update(dt){
  if (!S.started || S.ended) return;

  S.leftSec = Math.max(0, S.leftSec - dt);
  if (S.waterZone==='GREEN') S.greenHold += dt;

  // Storm schedule
  if (!S.stormActive){
    nextStormIn -= dt;
    if (nextStormIn <= 0 && S.leftSec > (TUNE.stormDurSec + 2)){
      enterStorm();
      nextStormIn = nextStormSchedule();
    }
  } else {
    tickStorm(dt);
  }

  // AI director update (fair + smooth)
  const acc01 = computeAccuracy()/100;
  const missRate = clamp(S.misses / Math.max(1, (timeLimit - S.leftSec) + 4), 0, 1);
  const comboNorm = clamp(S.combo/20, 0, 1);
  const fatigue = clamp((timeLimit - S.leftSec)/Math.max(1,timeLimit), 0, 1);
  const frustration = clamp((S.misses/Math.max(1,(timeLimit - S.leftSec)+5))*0.7 + (1-acc01)*0.3, 0, 1);

  S._ai = AIDIR.update({
    accuracy: acc01,
    missRate,
    comboNorm,
    fatigue,
    frustration
  });

  // Spawn
  spawnTimer -= dt*1000;
  while (spawnTimer <= 0){
    spawn(pickKind());
    spawnTimer += nextSpawnDelay();
  }

  // HUD + AI coach
  syncHUD();

  AICOACH.onUpdate({
    skill: clamp(acc01*0.7 + comboNorm*0.3, 0, 1),
    fatigue,
    frustration,
    inStorm: !!S.stormActive,
    inEndWindow: !!S.inEndWindow,
    waterZone: S.waterZone,
    shield: S.shield|0,
    misses: S.misses|0,
    combo: S.combo|0
  });

  if (S.leftSec <= 0.0001) endGame('timeup');
}

async function endGame(reason){
  if (S.ended) return;
  S.ended = true;
  setEndFx(false);

  // clear active targets
  for (const [el] of ACTIVE.entries()){
    try{ el.remove(); }catch(_){}
  }
  ACTIVE.clear();

  const grade = computeGrade();
  const acc = computeAccuracy();

  const cycles = S.stormCycle|0;
  const success = S.stormSuccess|0;

  const summary = {
    timestampIso: qs('timestampIso', new Date().toISOString()),
    projectTag: qs('projectTag','HeroHealth'),
    runMode: run,
    sessionId: sessionId || '',
    gameMode:'hydration',
    diff,
    seed,
    durationPlannedSec: timeLimit,
    durationPlayedSec: timeLimit,
    scoreFinal: S.score|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,
    goalsCleared: (S.greenHold >= TUNE.greenTargetSec) ? 1 : 0,
    goalsTotal: 1,

    miniCleared: success,
    miniTotal: cycles,
    stormCycles: cycles,
    stormSuccess: success,
    stormRatePct: clamp((success/Math.max(1,cycles))*100, 0, 100),

    accuracyGoodPct: acc,
    grade,
    streakMax: S.streakMax|0,
    greenHoldSec: Number(S.greenHold||0),
    reason: reason || 'end'
  };

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    localStorage.setItem('hha_last_summary', JSON.stringify(summary));
  }catch(_){}

  emit('hha:end', summary);
  AICOACH.onEnd(summary);

  await sendLog(summary);
  fillSummary(summary);
}

function boot(){
  ensureWaterGauge();
  setWaterGauge(S.waterPct);
  updateZone();
  syncWaterPanelDOM();
  bindSummaryButtons();

  // event: shoot (from loader / VR UI)
  window.addEventListener('hha:shoot', (ev)=>{
    const d = ev.detail || {};
    if (!S.started || S.ended) return;
    aimShoot(d.src || 'event');
  }, { passive:true });

  // start loop
  spawnTimer = 320;
  nextStormIn = nextStormSchedule();

  window.addEventListener('hha:start', ()=>{
    if (S.started) return;
    S.started=true;
    S.t0=performance.now();
    S.lastTick=S.t0;
    syncHUD();
    AICOACH.onStart();

    function raf(t){
      if (S.ended) return;
      const dt = Math.min(0.05, Math.max(0.001, (t - S.lastTick)/1000));
      S.lastTick=t;
      update(dt);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }, {once:true});

  window.addEventListener('hha:force_end', (ev)=>{
    const d = ev.detail || {};
    endGame(d.reason || 'force');
  });

  // auto-start if overlay already hidden
  const ov = DOC.getElementById('startOverlay');
  setTimeout(()=>{
    const hidden = !ov || getComputedStyle(ov).display==='none' || ov.classList.contains('hide');
    if (hidden && !S.started) window.dispatchEvent(new CustomEvent('hha:start'));
  }, 600);
}

boot();