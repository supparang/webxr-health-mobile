// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION (DOM Engine + WaterGauge + Shield + Storm Mini + Boss Mini + Research Logging)
// ✅ PATCH 7–9 (NEW):
// (7) Cardboard HUD mirror: update both eyes always
// (8) Shoot event: center-ray shoot + touch fallback
// (9) Cardboard quest compact + never disappear

'use strict';

import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return performance.now(); }
function qs(name, def){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch{ return def; }
}
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}
function setText(el, t){ try{ if(el) el.textContent = String(t); }catch{} }

function hashStr(s){
  s = String(s||'');
  let h = 2166136261;
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
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

// audio (best-effort)
let _AC=null;
function ensureAC(){
  try{
    if (_AC) return _AC;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _AC = new Ctx();
    return _AC;
  }catch{ return null; }
}
function beep(freq=880, dur=0.04, gain=0.03){
  const ac = ensureAC();
  if (!ac) return;
  try{
    if (ac.state === 'suspended') ac.resume().catch(()=>{});
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  }catch{}
}

// ------------------ config ------------------
const diff = String(qs('diff','normal')).toLowerCase();
const run  = String(qs('run', qs('runMode','play'))).toLowerCase();
const timeLimit = clamp(parseInt(qs('time', qs('durationPlannedSec', 70)),10) || 70, 20, 600);

const hub = String(qs('hub','./hub.html'));
const sessionId = String(qs('sessionId', qs('studentKey','')) || '');
const ts = String(qs('ts', Date.now()));
const seed = String(qs('seed', sessionId ? (sessionId + '|' + ts) : ts));
const rng = makeRng(seed);
const logEndpoint = String(qs('log','') || '');

// ------------------ DOM bind (normal) ------------------
const playfield = DOC.getElementById('playfield');
const layerMain = DOC.getElementById('hvr-layer');

const elScore = DOC.getElementById('stat-score');
const elCombo = DOC.getElementById('stat-combo');
const elComboMax = DOC.getElementById('stat-combo-max');
const elMiss = DOC.getElementById('stat-miss');
const elTime = DOC.getElementById('stat-time');
const elGrade = DOC.getElementById('stat-grade');
const elStormLeft = DOC.getElementById('storm-left');
const elShieldCount = DOC.getElementById('shield-count');

const elQuest1 = DOC.getElementById('quest-line1');
const elQuest2 = DOC.getElementById('quest-line2');
const elQuest3 = DOC.getElementById('quest-line3');
const elQuest4 = DOC.getElementById('quest-line4');

// ------------------ DOM bind (cardboard mirror) ------------------
const cb = {
  on: DOC.body.classList.contains('is-cardboard'),
  L: {
    play: DOC.getElementById('cbL-play'),
    layer: DOC.getElementById('cbL-layer'),
    time: DOC.getElementById('cbL-time'),
    score: DOC.getElementById('cbL-score'),
    miss: DOC.getElementById('cbL-miss'),
    grade: DOC.getElementById('cbL-grade'),
    shield: DOC.getElementById('cbL-shield'),
    goal: DOC.getElementById('cbL-goal'),
    prog: DOC.getElementById('cbL-prog'),
    mini: DOC.getElementById('cbL-mini')
  },
  R: {
    play: DOC.getElementById('cbR-play'),
    layer: DOC.getElementById('cbR-layer'),
    time: DOC.getElementById('cbR-time'),
    score: DOC.getElementById('cbR-score'),
    miss: DOC.getElementById('cbR-miss'),
    grade: DOC.getElementById('cbR-grade'),
    shield: DOC.getElementById('cbR-shield'),
    goal: DOC.getElementById('cbR-goal'),
    prog: DOC.getElementById('cbR-prog'),
    mini: DOC.getElementById('cbR-mini')
  }
};

window.addEventListener('hvr:cardboard', (ev)=>{
  cb.on = !!(ev?.detail && ev.detail.on);
});

// ------------------ inject target styles (for all layers) ------------------
(function injectStyle(){
  const id = 'hvr-target-style';
  if (DOC.getElementById(id)) return;
  const st = DOC.createElement('style');
  st.id = id;
  st.textContent = `
  .hvr-target{
    position:absolute;
    left: var(--x, 50%);
    top: var(--y, 50%);
    transform: translate(-50%,-50%);
    width: var(--s, 64px);
    height: var(--s, 64px);
    display:flex;
    align-items:center;
    justify-content:center;
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
    filter: saturate(1.1) contrast(1.05);
  }`;
  DOC.head.appendChild(st);
})();

// ------------------ gameplay state ------------------
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

  waterPct: 50,
  waterZone: 'GREEN',

  shield: 0,
  shieldMax: 3,

  greenHold: 0,
  greenTarget: 0,

  stormActive:false,
  stormLeftSec:0,
  stormDur: 0,
  stormCycle: 0,

  endWindowSec: 1.2,
  inEndWindow:false,

  miniCleared:0,
  miniTotal: 0,

  miniState: {
    zoneOK:false,
    pressure:0,
    pressureOK:false,
    endWindow:false,
    blockedInEnd:false,
    blockedAny:false,
    doneThisStorm:false,
  },

  bossActive:false,
  bossNeed: 2,
  bossBlocked: 0,
  bossDoneThisStorm:false,
  bossWindowSec: 2.2,

  endBadNeed: 1,
  endBadSpawned: 0,

  stormSuccess: 0,

  _tickMark: -1,
  _vibeOn:false,

  adaptiveOn: (run !== 'research'),
  adaptK: 0.0
};

// tuning
const TUNE = (() => {
  const sizeBase = diff==='easy' ? 78 : diff==='hard' ? 56 : 66;
  const spawnBase = diff==='easy' ? 680 : diff==='hard' ? 480 : 580;
  const stormEvery = diff==='easy' ? 18 : diff==='hard' ? 14 : 16;
  const stormDur = diff==='easy' ? 5.2 : diff==='hard' ? 6.2 : 5.8;

  const g = clamp(
    Math.round(timeLimit * (diff==='easy' ? 0.42 : diff==='hard' ? 0.55 : 0.48)),
    18,
    Math.max(18, timeLimit-8)
  );

  return {
    sizeBase,
    spawnBaseMs: spawnBase,
    spawnJitter: 170,

    goodLifeMs: diff==='hard' ? 930 : 1080,
    badLifeMs:  diff==='hard' ? 980 : 1120,
    shieldLifeMs: 1350,

    stormEverySec: stormEvery,
    stormDurSec: stormDur,
    endWindowSec: 1.2,

    stormSpawnMul: diff==='hard' ? 0.56 : 0.64,

    nudgeToMid: 5.0,
    badPush:    8.0,
    missPenalty: 1,

    greenTargetSec: g,
    bossWindowSec: diff==='hard' ? 2.4 : 2.2
  };
})();

S.greenTarget = TUNE.greenTargetSec;
S.endWindowSec = TUNE.endWindowSec;
S.stormDur = TUNE.stormDurSec;
S.bossWindowSec = TUNE.bossWindowSec;

S.endBadNeed = (diff === 'hard' ? 2 : 1);

(function computeMiniTotal(){
  const playable = Math.max(0, timeLimit - (S.stormDur + 2));
  const approx = Math.max(1, Math.floor(playable / TUNE.stormEverySec));
  S.miniTotal = approx;
})();

// expose
ROOT.__HVR__ = ROOT.__HVR__ || {};
ROOT.__HVR__.S = S;
ROOT.__HVR__.TUNE = TUNE;

// ------------------ computed ------------------
function computeAccuracy(){
  const denom = Math.max(1, S.nGoodSpawn);
  return clamp((S.nHitGood / denom) * 100, 0, 100);
}
function computeGrade(){
  const acc = computeAccuracy();
  const miss = S.misses|0;
  const mini = S.miniCleared|0;
  if (acc >= 95 && miss <= 2 && mini >= 1) return 'SSS';
  if (acc >= 90 && miss <= 4) return 'SS';
  if (acc >= 82) return 'S';
  if (acc >= 70) return 'A';
  if (acc >= 55) return 'B';
  return 'C';
}

// ------------------ water dynamics ------------------
function updateZone(){ S.waterZone = zoneFrom(S.waterPct); }
function nudgeWaterGood(){
  const mid = 55;
  const d = mid - S.waterPct;
  const step = Math.sign(d) * Math.min(Math.abs(d), TUNE.nudgeToMid);
  S.waterPct = clamp(S.waterPct + step, 0, 100);
  updateZone();
}
function pushWaterBad(){
  const mid = 55;
  const d = S.waterPct - mid;
  const step = (d >= 0 ? +1 : -1) * TUNE.badPush;
  S.waterPct = clamp(S.waterPct + step, 0, 100);
  updateZone();
}

// ------------------ spawn math ------------------
function pickXY(rect){
  const pad = 22;
  const w = Math.max(1, rect.width - pad*2);
  const h = Math.max(1, rect.height - pad*2);

  const rx = (rng()+rng())/2;
  const ry = (rng()+rng())/2;

  const x = pad + rx * w;
  const y = pad + ry * h;

  return { xPct: (x / rect.width) * 100, yPct: (y / rect.height) * 100 };
}

function targetSize(){
  let s = TUNE.sizeBase;
  if (S.adaptiveOn){
    const acc = computeAccuracy()/100;
    const c = clamp(S.combo/20, 0, 1);
    const k = clamp((acc*0.7 + c*0.3), 0, 1);
    S.adaptK = k;
    s = s * (1.02 - 0.22*k);
  }
  if (S.stormActive) s *= (diff==='hard' ? 0.78 : 0.82);
  return clamp(s, 44, 86);
}

// ------------------ PATCH 8: shoot (center ray) ------------------
function getActiveLayers(){
  if (cb.on && cb.L.layer && cb.R.layer && cb.L.play && cb.R.play){
    return [
      { play: cb.L.play, layer: cb.L.layer },
      { play: cb.R.play, layer: cb.R.layer }
    ];
  }
  return [{ play: playfield, layer: layerMain }];
}

function shootAtCenter(){
  const packs = getActiveLayers();
  for (const p of packs){
    if (!p.play || !p.layer) continue;
    const r = p.play.getBoundingClientRect();
    const x = r.left + r.width*0.5;
    const y = r.top + r.height*0.5;
    const hit = document.elementFromPoint(x, y);
    if (hit && hit.classList && hit.classList.contains('hvr-target')){
      // simulate click
      try{ hit.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, pointerType:'mouse', isPrimary:true })); }catch{}
      return;
    }
  }
}
window.addEventListener('hvr:shoot', ()=>shootAtCenter());

// ------------------ FX pop (per active layers) ------------------
function makePop(text, kind){
  const packs = getActiveLayers();
  for (const p of packs){
    try{
      const wrap = p.layer;
      if (!wrap) continue;
      const el = DOC.createElement('div');
      el.textContent = text;
      el.style.cssText = `
        position:absolute; left:50%; top:46%;
        transform:translate(-50%,-50%);
        font-weight:1100;
        text-shadow: 0 10px 26px rgba(0,0,0,.55);
        pointer-events:none;
        z-index: 50;
        animation: hvrPop .55s ease forwards;
        color:${kind==='good'?'rgba(34,197,94,.95)':kind==='shield'?'rgba(34,211,238,.95)':'rgba(239,68,68,.95)'};
      `;
      wrap.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 600);
    }catch{}
  }
}

// ensure keyframes exist
(function ensurePopKeyframes(){
  const id='hvr-pop-keyframes';
  if (DOC.getElementById(id)) return;
  const st=DOC.createElement('style');
  st.id=id;
  st.textContent=`
    @keyframes hvrPop{
      0%{ opacity:0; transform: translate(-50%,-50%) scale(.88); }
      15%{ opacity:1; }
      100%{ opacity:0; transform: translate(-50%,-70%) scale(1.05); }
    }`;
  DOC.head.appendChild(st);
})();

// ------------------ input throttle ------------------
let lastHitAt = 0;
const HIT_COOLDOWN_MS = 55;

// ------------------ spawn (mirrored when cardboard) ------------------
function spawn(kind){
  if (S.ended) return;

  const packs = getActiveLayers();
  const s = targetSize();

  // compute once (same position for both eyes, looks consistent)
  let rect = null;
  for (const p of packs){
    if (p.play){ rect = p.play.getBoundingClientRect(); break; }
  }
  if (!rect) return;

  const { xPct, yPct } = pickXY(rect);

  for (const p of packs){
    const layer = p.layer;
    if (!layer) continue;

    const el = DOC.createElement('div');
    const isBossBad = (kind === 'bad' && S.bossActive);
    el.className = 'hvr-target ' + kind + (isBossBad ? ' bossbad' : '');
    el.dataset.kind = kind;
    if (isBossBad) el.dataset.boss = '1';

    el.style.setProperty('--x', xPct.toFixed(2) + '%');
    el.style.setProperty('--y', yPct.toFixed(2) + '%');
    el.style.setProperty('--s', s.toFixed(0) + 'px');

    el.textContent =
      kind === 'good' ? '💧' :
      kind === 'shield' ? '🛡️' :
      (isBossBad ? '🌩️' : '🥤');

    const life =
      kind === 'good' ? TUNE.goodLifeMs :
      kind === 'shield' ? TUNE.shieldLifeMs :
      TUNE.badLifeMs;

    let killed = false;
    function kill(reason){
      if (killed) return;
      killed = true;
      try{ el.remove(); }catch{}
      if (reason === 'expire'){
        if (kind === 'good') {
          S.misses += TUNE.missPenalty;
          S.nExpireGood++;
          S.combo = 0;
        }
      }
    }

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      if (killed || S.ended) return;

      if (ev.pointerType === 'touch' && ev.isPrimary === false) return;

      const t = performance.now();
      if (t - lastHitAt < HIT_COOLDOWN_MS) return;
      lastHitAt = t;

      ensureAC();
      kill('hit');

      if (kind === 'good'){
        S.nHitGood++;
        S.score += 10 + Math.min(15, (S.combo|0));
        S.combo++;
        S.comboMax = Math.max(S.comboMax, S.combo);
        nudgeWaterGood();
        makePop('+GOOD', 'good');
        emit('hha:judge', { kind:'good' });
      }
      else if (kind === 'shield'){
        S.score += 6;
        S.combo++;
        S.comboMax = Math.max(S.comboMax, S.combo);
        S.shield = clamp(S.shield + 1, 0, S.shieldMax);
        makePop('+SHIELD', 'shield');
        emit('hha:judge', { kind:'shield' });
      }
      else { // bad
        const isBossBadNow = (el.dataset.boss === '1');
        if (S.shield > 0){
          S.shield--;
          S.nHitBadGuard++;
          S.score += 4;
          makePop('BLOCK!', 'shield');
          emit('hha:judge', { kind:'block' });

          if (S.stormActive && !S.miniState.doneThisStorm){
            S.miniState.blockedAny = true;
          }
          if (S.stormActive && S.inEndWindow && !S.miniState.doneThisStorm){
            S.miniState.blockedInEnd = true;
          }
          if (isBossBadNow){
            S.bossBlocked++;
          }
        } else {
          S.nHitBad++;
          S.misses++;
          S.combo = 0;
          S.score = Math.max(0, S.score - 6);
          pushWaterBad();
          makePop('BAD!', 'bad');
          emit('hha:judge', { kind:'bad' });
        }
      }

      syncHUD();
    }, { passive:false });

    layer.appendChild(el);
    setTimeout(()=>kill('expire'), life);
  }

  // count spawn once (not per-eye)
  if (kind === 'good') S.nGoodSpawn++;
  if (kind === 'bad') S.nBadSpawn++;
  if (kind === 'shield') S.nShieldSpawn++;
}

// ------------------ spawner loop ------------------
let spawnTimer = 0;
let nextStormAt = 0;
let stormIndex = 0;

function nextSpawnDelay(){
  let base = TUNE.spawnBaseMs + (rng()*2-1)*TUNE.spawnJitter;
  if (S.adaptiveOn) base *= (1.00 - 0.25 * S.adaptK);
  if (S.stormActive) base *= TUNE.stormSpawnMul;
  return clamp(base, 210, 1200);
}

function shieldBoostP(){
  const low = (S.shield<=0)?0.08:(S.shield===1?0.04:0.00);
  const storm = S.stormActive?0.04:0.00;
  const endW = (S.stormActive && S.inEndWindow && S.shield<=1)?0.06:0.00;
  return clamp(low+storm+endW,0,0.18);
}
function pickKind(){
  let pGood=0.66, pBad=0.28, pSh=0.06;
  if (S.stormActive){
    pGood=0.52; pBad=0.38; pSh=0.10;
    if (S.bossActive){ pBad+=0.10; pGood-=0.10; }
  }
  if (diff==='hard'){ pBad+=0.04; pGood-=0.04; }

  pSh = clamp(pSh + shieldBoostP(), 0.06, 0.22);
  const over = (pSh+pBad+pGood) - 1;
  if (over>0) pGood = Math.max(0.22, pGood-over);

  const r=rng();
  if (r<pSh) return 'shield';
  if (r<pSh+pBad) return 'bad';
  return 'good';
}

// ------------------ storm logic ------------------
function enterStorm(){
  S.stormActive=true;
  S.stormLeftSec=S.stormDur;
  S.stormCycle++;

  S.miniState = { zoneOK:false, pressure:0, pressureOK:false, endWindow:false, blockedInEnd:false, blockedAny:false, doneThisStorm:false };
  S.bossActive=false; S.bossBlocked=0; S.bossDoneThisStorm=false;
  S.endBadSpawned=0;

  if (S.waterZone==='GREEN'){
    S.waterPct = clamp(S.waterPct + (rng()<0.5?-7:+7), 0, 100);
    updateZone();
  }
  if (S.shield===0 && rng()<0.65) spawn('shield');

  syncHUD();
}

function evalStormMini(){
  const m=S.miniState;
  if (m.doneThisStorm) return false;
  if (diff==='easy') return !!(m.zoneOK && m.pressureOK && m.blockedAny);
  return !!(m.zoneOK && m.pressureOK && m.endWindow && m.blockedInEnd);
}

function celebrate(kind='mini'){
  emit('hha:celebrate', { kind });
  emit('hha:coach', { mood:'happy', text: kind==='boss' ? 'BOSS ผ่านแล้ว! 👏' : 'Mini สำเร็จ! ✅' });
}

function exitStorm(){
  S.stormActive=false;
  S.stormLeftSec=0;
  S.inEndWindow=false;

  if (!S.miniState.doneThisStorm){
    const ok=evalStormMini();
    if (ok){
      S.miniCleared++;
      S.stormSuccess++;
      S.miniState.doneThisStorm=true;
      S.score += 35;
      makePop('MINI ✓', 'shield');
      celebrate('mini');
    }
  }
  if (!S.bossDoneThisStorm){
    if (S.bossBlocked >= S.bossNeed){
      S.bossDoneThisStorm=true;
      S.miniCleared++;
      S.score += 45;
      makePop('BOSS ✓', 'shield');
      celebrate('boss');
    }
  }
  S.bossActive=false;

  syncHUD();
}

function guaranteeEndBad(){
  if (!S.stormActive || !S.inEndWindow) return;
  if (S.endBadSpawned >= S.endBadNeed) return;
  S.endBadSpawned++;
  spawn('bad');
}

function tickStorm(dt){
  if (!S.stormActive) return;

  S.stormLeftSec = Math.max(0, S.stormLeftSec - dt);

  const inEnd = (S.stormLeftSec <= (TUNE.endWindowSec + 0.02));
  S.inEndWindow = inEnd;
  S.miniState.endWindow = inEnd;

  if (inEnd){
    const mark = Math.floor(S.stormLeftSec * 10);
    if (mark !== S._tickMark){
      S._tickMark = mark;
      const f = (S.stormLeftSec <= 0.35) ? 1050 : (S.stormLeftSec <= 0.8 ? 940 : 860);
      beep(f, 0.03, 0.022);
    }
    guaranteeEndBad();
    if (diff==='hard' && rng()<0.55) guaranteeEndBad();
  } else {
    S._tickMark = -1;
  }

  const inBoss = (S.stormLeftSec <= (S.bossWindowSec + 0.02));
  S.bossActive = (inBoss && !S.bossDoneThisStorm);

  const zoneOK = (S.waterZone !== 'GREEN');
  if (zoneOK) S.miniState.zoneOK = true;

  const pGain = zoneOK ? 0.50 : 0.24;
  S.miniState.pressure = clamp(S.miniState.pressure + dt * pGain, 0, 1);
  if (S.miniState.pressure >= 1) S.miniState.pressureOK = true;

  if (S.stormLeftSec <= 0.001) exitStorm();
}

// ------------------ HUD sync (normal + cardboard mirror) ------------------
function syncHUD(){
  const grade = computeGrade();
  const acc = computeAccuracy();

  // normal
  setText(elScore, S.score|0);
  setText(elCombo, S.combo|0);
  if (elComboMax) setText(elComboMax, S.comboMax|0);
  setText(elMiss, S.misses|0);
  setText(elTime, S.leftSec|0);
  setText(elGrade, grade);
  setText(elShieldCount, S.shield|0);
  setText(elStormLeft, S.stormActive ? (S.stormLeftSec|0) : 0);

  setText(elQuest1, `คุม GREEN ให้ครบ ${S.greenTarget|0}s (สะสม)`);
  setText(elQuest2, `GREEN: ${(S.greenHold).toFixed(1)} / ${(S.greenTarget).toFixed(0)}s`);

  const m = S.miniState;
  const z = m.zoneOK ? '✅' : '❌';
  const p = m.pressureOK ? '✅' : '❌';
  const e = m.endWindow ? '✅' : '❌';
  const bEnd = m.blockedInEnd ? '✅' : '❌';
  const bAny = m.blockedAny ? '✅' : '❌';

  let ruleTxt = (diff==='easy') ? 'Block(anytime) 1 ครั้ง'
              : (diff==='normal') ? 'Block(end) 1 ครั้ง'
              : 'Block(end)+BOSS';
  setText(elQuest3, S.stormActive ? `Storm Mini: ${ruleTxt}` : `รอ Storm แล้วค่อยทำ Mini`);
  setText(elQuest4, S.stormActive
    ? (diff==='easy'
        ? `Mini ✓ Zone ${z} Pressure ${p} Block(any) ${bAny}`
        : `Mini ✓ Zone ${z} Pressure ${p} End ${e} Block(end) ${bEnd}`)
    : `State: เก็บคะแนน + สะสม Shield`
  );

  setWaterGauge(S.waterPct);

  // cardboard mirror (always update so “ไม่หาย”)
  const goalTxt = `GREEN ${S.greenTarget|0}s`;
  const progTxt = `${S.greenHold.toFixed(1)} / ${S.greenTarget.toFixed(0)}s`;
  const miniTxt = `${S.miniCleared|0}/${S.miniTotal|0}`;

  if (cb.L.time){
    setText(cb.L.time, S.leftSec|0);
    setText(cb.L.score, S.score|0);
    setText(cb.L.miss, S.misses|0);
    setText(cb.L.grade, grade);
    setText(cb.L.shield, S.shield|0);
    setText(cb.L.goal, goalTxt);
    setText(cb.L.prog, progTxt);
    setText(cb.L.mini, `Mini ✓ ${miniTxt}`);
  }
  if (cb.R.time){
    setText(cb.R.time, S.leftSec|0);
    setText(cb.R.score, S.score|0);
    setText(cb.R.miss, S.misses|0);
    setText(cb.R.grade, grade);
    setText(cb.R.shield, S.shield|0);
    setText(cb.R.goal, goalTxt);
    setText(cb.R.prog, progTxt);
    setText(cb.R.mini, `Mini ✓ ${miniTxt}`);
  }

  emit('hha:score', {
    score: S.score|0,
    combo: S.combo|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,
    accuracyGoodPct: acc,
    grade,
    waterPct: S.waterPct,
    waterZone: S.waterZone,
    shield: S.shield|0,
    stormActive: !!S.stormActive,
    stormLeftSec: S.stormLeftSec,
    stormCycle: S.stormCycle|0,
    stormSuccess: S.stormSuccess|0
  });

  emit('hha:time', { left: S.leftSec|0 });
  emit('quest:update', {
    goalTitle:'GREEN Control',
    goalNow: Math.min(S.greenHold, S.greenTarget),
    goalNeed: S.greenTarget,
    goalsCleared: (S.greenHold >= S.greenTarget) ? 1 : 0,
    goalsTotal: 1,
    miniTitle: ruleTxt,
    miniCleared: S.miniCleared|0,
    miniTotal: S.miniTotal|0
  });
}

// ------------------ end logging ------------------
async function sendLog(payload){
  if (!logEndpoint) return;
  try{
    await fetch(logEndpoint, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
  }catch{}
}

// ------------------ main loop ------------------
function update(dt){
  if (!S.started || S.ended) return;

  S.leftSec = Math.max(0, S.leftSec - dt);

  if (S.waterZone === 'GREEN') S.greenHold += dt;

  const elapsed = (now() - S.t0) / 1000;

  if (!S.stormActive){
    if (elapsed >= nextStormAt && S.leftSec > (S.stormDur + 2)){
      enterStorm();
      stormIndex++;
      nextStormAt = (stormIndex + 1) * TUNE.stormEverySec;
    }
  } else {
    tickStorm(dt);
  }

  spawnTimer -= dt * 1000;
  while (spawnTimer <= 0){
    spawn(pickKind());
    spawnTimer += nextSpawnDelay();
  }

  syncHUD();

  if (S.leftSec <= 0.0001) endGame('timeup');
}

async function endGame(reason){
  if (S.ended) return;
  S.ended = true;

  const grade = computeGrade();
  const acc = computeAccuracy();
  const stormRate = (S.stormCycle > 0) ? (S.stormSuccess / S.stormCycle) : 0;

  const summary = {
    timestampIso: qs('timestampIso', new Date().toISOString()),
    projectTag: qs('projectTag', 'HeroHealth'),
    runMode: run,
    sessionId: sessionId || '',
    gameMode: 'hydration',
    diff,
    durationPlannedSec: timeLimit,
    durationPlayedSec: timeLimit,

    scoreFinal: S.score|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,

    goalsCleared: (S.greenHold >= S.greenTarget) ? 1 : 0,
    goalsTotal: 1,

    miniCleared: S.miniCleared|0,
    miniTotal: S.miniTotal|0,

    stormCycles: S.stormCycle|0,
    stormSuccess: S.stormSuccess|0,
    stormRatePct: Math.round(stormRate * 1000) / 10,

    nTargetGoodSpawned: S.nGoodSpawn|0,
    nTargetJunkSpawned: S.nBadSpawn|0,
    nTargetShieldSpawned: S.nShieldSpawn|0,

    nHitGood: S.nHitGood|0,
    nHitJunk: S.nHitBad|0,
    nHitJunkGuard: S.nHitBadGuard|0,
    nExpireGood: S.nExpireGood|0,

    accuracyGoodPct: acc,
    grade,
    reason: reason || 'end'
  };

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    localStorage.setItem('hha_last_summary', JSON.stringify(summary));
  }catch{}

  emit('hha:end', summary);
  await sendLog(summary);
}

// ------------------ start gate ------------------
async function waitStartGate(){
  const ov = DOC.getElementById('start-overlay') || DOC.getElementById('startOverlay');
  if (!ov) return;

  const isHidden = () => {
    const cs = getComputedStyle(ov);
    return (cs.display === 'none' || cs.visibility === 'hidden' || ov.hidden);
  };
  if (isHidden()) return;

  await new Promise((resolve)=>{
    // also resolve if user triggers explicit start event
    const onStart = ()=>{ cleanup(); resolve(); };
    const mo = new MutationObserver(()=>{
      if (!ov.isConnected || isHidden()){
        cleanup(); resolve();
      }
    });
    function cleanup(){
      try{ mo.disconnect(); }catch{}
      window.removeEventListener('hvr:user_start', onStart);
    }

    window.addEventListener('hvr:user_start', onStart);
    mo.observe(ov, { attributes:true, attributeFilter:['style','class','hidden'] });

    setTimeout(()=>{ cleanup(); resolve(); }, 25000);
  });
}

// ------------------ init ------------------
async function boot(){
  if (!playfield || !layerMain){
    console.warn('[Hydration] missing #playfield or #hvr-layer');
    return;
  }

  ensureWaterGauge();
  setWaterGauge(S.waterPct);
  updateZone();

  spawnTimer = 320;

  await waitStartGate();

  S.started = true;
  S.t0 = now();
  S.lastTick = S.t0;

  nextStormAt = TUNE.stormEverySec;
  stormIndex = 0;

  syncHUD();

  function raf(t){
    if (S.ended) return;
    const dt = Math.min(0.05, Math.max(0.001, (t - S.lastTick)/1000));
    S.lastTick = t;
    update(dt);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  window.addEventListener('visibilitychange', ()=>{
    if (document.hidden && !S.ended) endGame('hidden');
  });
  window.addEventListener('beforeunload', ()=>{
    if (!S.ended) { try{ endGame('unload'); }catch{} }
  });
  window.addEventListener('hha:force_end', (ev)=>{
    const d = ev.detail || {};
    if (!S.ended) endGame(d.reason || 'force');
  });

  // Touch anywhere in cardboard = shoot (optional)
  document.addEventListener('pointerdown', (ev)=>{
    if (!cb.on) return;
    // allow only single primary touch
    if (ev.pointerType === 'touch' && ev.isPrimary === false) return;
    // don’t steal button taps (they already call shoot)
    const t = ev.target;
    if (t && t.closest && t.closest('button')) return;
    window.dispatchEvent(new CustomEvent('hvr:shoot'));
  }, { passive:true });
}

boot().catch(err=>console.error('[Hydration] boot error', err));