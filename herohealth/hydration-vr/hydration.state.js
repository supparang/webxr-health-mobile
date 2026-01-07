// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration SAFE — PRODUCTION (FULL) — 1-3 DONE (AIM + FX + 3-STAGE + RESEARCH METRICS)
// ✅ Standalone cVR shoot (works even without vr-ui.js)
// ✅ Smart Aim Assist lockPx (cVR) adaptive + fair + deterministic in research
// ✅ FX: hit pulse, shockwave, boss flash, end-window blink+shake, pop score
// ✅ Mission 3-Stage: GREEN -> Storm Mini -> Boss Clear
// ✅ Cardboard layers via window.HHA_VIEW.layers from loader
// ✅ Research metrics: avg/median RT, fastHitRate, junkErrorPct, spawned/hit/expire counts

'use strict';

import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createAICoach } from '../vr/ai-coach.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

// -------------------- utils --------------------
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

// -------------------- View / layers --------------------
function isCardboard(){
  try{ return DOC.body.classList.contains('cardboard'); }catch(_){ return false; }
}
function isCVR(){
  try{ return DOC.body.classList.contains('view-cvr'); }catch(_){ return false; }
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
function getPlayfieldEl(){
  return isCardboard() ? DOC.getElementById('cbPlayfield') : DOC.getElementById('playfield');
}
function getPlayfieldRect(){
  const pf = getPlayfieldEl();
  const r = pf?.getBoundingClientRect();
  return r || { left:0, top:0, width:1, height:1 };
}
function centerPoint(){
  const r = getPlayfieldRect();
  return { cx: r.left + r.width/2, cy: r.top + r.height/2 };
}

// -------------------- FX Helpers (Particles + DOM shock) --------------------
function pulseBody(cls, ms=140){
  try{
    DOC.body.classList.add(cls);
    setTimeout(()=>DOC.body.classList.remove(cls), ms);
  }catch(_){}
}
function shockAt(x, y){
  const pf = getPlayfieldEl();
  if (!pf) return;

  const r = pf.getBoundingClientRect();
  const xPct = ((x - r.left)/Math.max(1,r.width))*100;
  const yPct = ((y - r.top)/Math.max(1,r.height))*100;

  const el = DOC.createElement('div');
  el.className='hha-shock';
  el.style.setProperty('--x', xPct.toFixed(2)+'%');
  el.style.setProperty('--y', yPct.toFixed(2)+'%');
  pf.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 520);
}
function popScore(text='+10'){
  try{
    const P = window.Particles || (window.GAME_MODULES && window.GAME_MODULES.Particles);
    if (P){
      const { cx, cy } = centerPoint();
      if (typeof P.popText === 'function'){ P.popText(cx, cy, text, ''); return; }
      if (typeof P.pop === 'function'){ P.pop(cx, cy, text); return; }
    }
  }catch(_){}
  pulseBody('hha-hitfx', 140);
}

// -------------------- Audio tick (no file needed) --------------------
let AC=null;
function ensureAC(){
  try{ if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); }catch(_){}
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

// -------------------- Config --------------------
const diff = String(qs('diff','normal')).toLowerCase();
const run  = String(qs('run', qs('runMode','play'))).toLowerCase();
const timeLimit = clamp(parseInt(qs('time', qs('durationPlannedSec', 70)),10) || 70, 20, 600);
const hub = String(qs('hub','../hub.html'));

const sessionId = String(qs('sessionId', qs('studentKey','')) || '');
const ts = String(qs('ts', Date.now()));
const seed = String(qs('seed', sessionId ? (sessionId + '|' + ts) : ts));
const logEndpoint = String(qs('log','') || '');

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

  // spawn/hit counts (align with sheet-ish naming)
  nTargetGoodSpawned:0,
  nTargetJunkSpawned:0,      // "bad" = junk drink
  nTargetShieldSpawned:0,
  nTargetStarSpawned:0,
  nTargetDiamondSpawned:0,

  nHitGood:0,
  nHitJunk:0,
  nHitJunkGuard:0,
  nExpireGood:0,

  // RT metrics
  rtGoodMs:[],               // store ms samples
  fastHits:0,                // count hits under threshold
  fastHitThresholdMs: diff==='easy' ? 520 : diff==='hard' ? 430 : 480,

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

  // Boss-mini
  bossEnabled:true,
  bossActive:false,
  bossNeed:2,
  bossBlocked:0,
  bossDoneThisStorm:false,
  bossWindowSec:2.2,
  bossClearCount:0,

  // End window fx
  endFxOn:false,
  endFxTickAt:0,

  adaptiveOn: (run !== 'research'),
  adaptK:0,

  // Mission stage
  stage:1,
  stage1Done:false,
  stage2Done:false,
  stage3Done:false
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
    junkLifeMs: diff==='hard'? 980 : 1120,
    shieldLifeMs:1350,
    stormEverySec,
    stormDurSec,
    stormSpawnMul: diff==='hard'? 0.56 : 0.64,
    endWindowSec:1.2,
    bossWindowSec: diff==='hard'? 2.4 : 2.2,
    nudgeToMid:5.0,
    junkPush:8.0,
    missPenalty:1,
    greenTargetSec: greenTarget,
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
function pushWaterJunk(){
  const mid=55, d=S.waterPct - mid;
  const step=(d>=0?+1:-1)*TUNE.junkPush;
  S.waterPct = clamp(S.waterPct + step, 0, 100);
  updateZone();
}

// -------------------- Accuracy/Grade --------------------
function computeAccuracy(){
  return clamp((S.nHitGood / Math.max(1,S.nTargetGoodSpawned))*100, 0, 100);
}
function computeJunkErrorPct(){
  // junk hit ratio relative to (good hits + junk hits) as a simple behavior proxy
  const denom = Math.max(1, (S.nHitGood + S.nHitJunk));
  return clamp((S.nHitJunk / denom) * 100, 0, 100);
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

// -------------------- RT metrics --------------------
function pushRt(ms){
  ms = clamp(ms, 0, 5000);
  S.rtGoodMs.push(ms);
  if (ms <= S.fastHitThresholdMs) S.fastHits++;
}
function avg(arr){
  if (!arr || !arr.length) return 0;
  let s=0; for (const v of arr) s += Number(v)||0;
  return s / arr.length;
}
function median(arr){
  if (!arr || !arr.length) return 0;
  const a = arr.slice().sort((x,y)=>(x-y));
  const n=a.length;
  const mid=Math.floor(n/2);
  return (n%2===1) ? a[mid] : (a[mid-1]+a[mid])/2;
}

// -------------------- UI sync --------------------
function syncWaterPanelDOM(){
  const bar = DOC.getElementById('water-bar');
  const pct = DOC.getElementById('water-pct');
  const zone = DOC.getElementById('water-zone');
  if (bar) bar.style.width = clamp(S.waterPct,0,100).toFixed(0)+'%';
  if (pct) pct.textContent = String(S.waterPct|0);
  if (zone) zone.textContent = String(S.waterZone||'');
}

function setStage(n){
  const nn = clamp(n,1,3)|0;
  if (S.stage === nn) return;
  S.stage = nn;
  emit('hha:coach', { type:'stage', stage: S.stage });
  tickBeep(1200, 0.06, 0.07);
  pulseBody('hha-hitfx', 180);
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

  // Stage logic
  S.stage1Done = (S.greenHold >= TUNE.greenTargetSec);
  S.stage2Done = (S.stormSuccess >= 1);
  S.stage3Done = (S.bossClearCount >= 1);

  if (!S.stage1Done) setStage(1);
  else if (!S.stage2Done) setStage(2);
  else if (!S.stage3Done) setStage(3);

  // Stage text
  if (S.stage === 1){
    setText('quest-line1', `Stage 1/3: คุม GREEN ให้ครบ ${TUNE.greenTargetSec|0}s (สะสม)`);
    setText('quest-line2', `GREEN: ${S.greenHold.toFixed(1)} / ${TUNE.greenTargetSec.toFixed(0)}s`);
    setText('quest-line3', `ทิป: ยิง 💧 ให้คุมสมดุลน้ำให้อยู่ GREEN นาน ๆ`);
    setText('quest-line4', `เตรียม: เก็บ 🛡️ ไว้ทำ Storm Mini`);
  } else if (S.stage === 2){
    setText('quest-line1', `Stage 2/3: ผ่าน Storm Mini อย่างน้อย 1 พายุ`);
    setText('quest-line2', `Mini ผ่านแล้ว: ${S.stormSuccess|0} / 1`);
    if (S.stormActive){
      const m = S.miniState;
      const bossTxt = (S.bossEnabled && S.bossActive) ? ` • BOSS 🌩️ ${S.bossBlocked}/${S.bossNeed}` : '';
      setText('quest-line3', `Storm Mini: LOW/HIGH + BLOCK${bossTxt}`);
      setText('quest-line4',
        `Mini: zone=${m.zoneOK?'OK':'NO'} pressure=${m.pressureOK?'OK':'..'} end=${m.endWindow?'YES':'..'} block=${m.blockedInEnd?'YES':'..'}`
        + (m.gotHitByBad ? ' • FAIL: HIT JUNK' : '')
      );
    } else {
      setText('quest-line3', `รอ Storm… เก็บ 🛡️ แล้วเตรียม BLOCK ช่วงท้าย (End Window)`);
      setText('quest-line4', `Progress: ${S.stormSuccess|0}/${S.stormCycle|0} (ผ่าน/เจอพายุ)`);
    }
  } else {
    setText('quest-line1', `Stage 3/3: เคลียร์ BOSS (BLOCK 🌩️ ให้ครบ ${S.bossNeed|0})`);
    setText('quest-line2', `Boss Clear: ${S.bossClearCount|0} / 1`);
    if (S.bossEnabled && S.bossActive){
      setText('quest-line3', `BOSS WINDOW! 🌩️ โผล่ถี่ขึ้น — ใช้ 🛡️ BLOCK ให้ครบ`);
      setText('quest-line4', `BOSS: ${S.bossBlocked|0}/${S.bossNeed|0} (รอบนี้)`);
    } else {
      setText('quest-line3', `รอช่วงท้ายพายุ (Boss Window) แล้วค่อย BLOCK 🌩️ ให้ครบ`);
      setText('quest-line4', `ทิป: เก็บ 🛡️ ไว้ 1–2 อันก่อนพายุ`);
    }
  }

  setWaterGauge(S.waterPct);
  syncWaterPanelDOM();

  emit('hha:score', {
    score:S.score|0,
    combo:S.combo|0,
    comboMax:S.comboMax|0,
    misses:S.misses|0,
    accuracyGoodPct: computeAccuracy(),
    junkErrorPct: computeJunkErrorPct(),
    grade,
    waterPct:S.waterPct,
    waterZone:S.waterZone,
    shield:S.shield|0,
    stormActive:!!S.stormActive,
    stormLeftSec:S.stormLeftSec,
    stormCycles:S.stormCycle|0,
    stormSuccess:S.stormSuccess|0,
    bossClearCount:S.bossClearCount|0,
    stage:S.stage|0
  });

  emit('quest:update', {
    goalsCleared: (S.greenHold >= TUNE.greenTargetSec) ? 1 : 0,
    goalsTotal: 1,
    miniCleared: S.stormSuccess|0,
    miniTotal: S.stormCycle|0,
    miniUrgent: S.stormActive && S.inEndWindow
  });
}

// -------------------- Target style (inject once) --------------------
(function injectTargetStyle(){
  if (DOC.getElementById('hvr-target-style')) return;
  const st = DOC.createElement('style');
  st.id='hvr-target-style';
  st.textContent = `
  .hvr-target{
    position:absolute;
    left: var(--x, 50%);
    top: var(--y, 50%);
    transform: translate(-50%,-50%) scale(1);
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
    transition: transform .10s ease-out, filter .10s ease-out;
  }
  .hvr-target:active{ transform: translate(-50%,-50%) scale(.96); filter: brightness(1.08); }

  .hvr-target.good{ outline: 2px solid rgba(34,197,94,.18); }
  .hvr-target.junk{ outline: 2px solid rgba(239,68,68,.18); }
  .hvr-target.shield{ outline: 2px solid rgba(34,211,238,.18); }

  .hvr-target.bossjunk{
    outline: 2px dashed rgba(239,68,68,.35);
    box-shadow: 0 18px 70px rgba(0,0,0,.55), 0 0 22px rgba(239,68,68,.10);
  }`;
  DOC.head.appendChild(st);
})();

// -------------------- Spawn helpers --------------------
function pickXY(){
  const r = getPlayfieldRect();
  const pad=22;
  const w=Math.max(1, r.width - pad*2);
  const h=Math.max(1, r.height - pad*2);

  // triangular-ish: more center distribution but still spread
  const rx=(rng()+rng())/2;
  const ry=(rng()+rng())/2;

  const x = pad + rx*w;
  const y = pad + ry*h;
  const xPct = (x/Math.max(1,r.width))*100;
  const yPct = (y/Math.max(1,r.height))*100;
  return { xPct, yPct };
}
function targetSize(){
  let s = TUNE.sizeBase;
  if (S.adaptiveOn){
    const acc = computeAccuracy()/100;
    const c = clamp(S.combo/20, 0, 1);
    const k = clamp(acc*0.7 + c*0.3, 0, 1);
    S.adaptK = k;
    s = s * (1.02 - 0.22*k);
  }
  if (S.stormActive) s *= (diff==='hard'?0.78:0.82);
  return clamp(s,44,86);
}

let lastHitAt=0;
const HIT_COOLDOWN_MS=55;

function spawn(kind){
  if (S.ended) return;
  const layers = getLayers();
  if (!layers.length) return;

  const { xPct, yPct } = pickXY();
  const s = targetSize();

  const isBossJunk = (kind==='junk' && S.bossEnabled && S.bossActive);

  // counts
  if (kind==='good') S.nTargetGoodSpawned++;
  if (kind==='junk') S.nTargetJunkSpawned++;
  if (kind==='shield') S.nTargetShieldSpawned++;

  const bornAt = performance.now();

  const life =
    kind==='good' ? TUNE.goodLifeMs :
    kind==='shield' ? TUNE.shieldLifeMs :
    TUNE.junkLifeMs;

  let killed=false;
  const nodes=[];

  function buildNode(){
    const el = DOC.createElement('div');
    el.className = `hvr-target ${kind}` + (isBossJunk ? ' bossjunk' : '');
    el.dataset.kind = kind;
    el.dataset.bornAt = String(bornAt);
    if (isBossJunk) el.dataset.boss='1';

    el.style.setProperty('--x', xPct.toFixed(2)+'%');
    el.style.setProperty('--y', yPct.toFixed(2)+'%');
    el.style.setProperty('--s', s.toFixed(0)+'px');

    el.textContent =
      kind==='good' ? '💧' :
      kind==='shield' ? '🛡️' :
      (isBossJunk ? '🌩️' : '🥤');

    el.addEventListener('pointerdown',(ev)=>{
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      onHit(el);
    }, {passive:false});

    return el;
  }

  function kill(reason){
    if (killed) return;
    killed=true;
    for (const n of nodes){ try{ n.remove(); }catch(_){ } }

    if (reason==='expire' && kind==='good'){
      S.misses += TUNE.missPenalty;
      S.nExpireGood++;
      S.combo=0;
      S.streakGood=0;
      syncHUD();
    }
  }

  function onHit(srcEl){
    if (killed || S.ended) return;
    const t=performance.now();
    if (t - lastHitAt < HIT_COOLDOWN_MS) return;
    lastHitAt=t;

    kill('hit');

    // RT for good
    const b = Number(srcEl?.dataset?.bornAt || bornAt);
    const rt = clamp(t - b, 0, 5000);

    const r = srcEl?.getBoundingClientRect?.();
    const hx = r ? (r.left + r.width/2) : centerPoint().cx;
    const hy = r ? (r.top + r.height/2) : centerPoint().cy;

    if (kind==='good'){
      S.nHitGood++;
      pushRt(rt);

      const add = 10 + Math.min(15, (S.combo|0));
      S.score += add;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      nudgeWaterGood();

      S.streakGood++;
      S.streakMax = Math.max(S.streakMax, S.streakGood);

      emit('hha:judge', { kind:'good', rtMs: rt });
      pulseBody('hha-hitfx', 140);
      popScore('+'+add);
    } else if (kind==='shield'){
      S.score += 6;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.shield = clamp(S.shield+1, 0, S.shieldMax);

      emit('hha:judge', { kind:'shield' });
      pulseBody('hha-hitfx', 120);
      popScore('+6');
    } else {
      // junk
      S.streakGood=0;

      if (S.shield>0){
        S.shield--;
        S.nHitJunkGuard++;
        S.score += 4;

        if (S.stormActive && S.inEndWindow){
          S.miniState.blockedInEnd = true;
          if (S.waterZone !== 'GREEN') emit('hha:judge', { kind:'perfect' });
        }
        if (isBossJunk) S.bossBlocked++;

        emit('hha:judge', { kind:'block' });
        pulseBody('hha-hitfx', 120);
        popScore('+4');
      } else {
        S.nHitJunk++;
        S.misses++;
        S.combo=0;
        S.score = Math.max(0, S.score-6);
        pushWaterJunk();

        if (S.stormActive) S.miniState.gotHitByBad = true;

        emit('hha:judge', { kind:'junk' });
        shockAt(hx, hy);
        pulseBody('hha-hitfx', 160);
      }
    }

    syncHUD();
  }

  for (const L of layers){
    const el = buildNode();
    nodes.push(el);
    L.appendChild(el);
  }

  setTimeout(()=>kill('expire'), life);
}

// -------------------- Storm + spawn loop --------------------
function nextSpawnDelay(){
  let base = TUNE.spawnBaseMs + (rng()*2-1)*TUNE.spawnJitter;
  if (S.adaptiveOn) base *= (1.00 - 0.25*S.adaptK);
  if (S.stormActive) base *= TUNE.stormSpawnMul;
  return clamp(base, 210, 1200);
}
function pickKind(){
  // base distribution
  let pGood=0.66, pJunk=0.28, pSh=0.06;

  if (S.stormActive){
    pGood=0.52; pJunk=0.38; pSh=0.10;
    if (S.bossEnabled && S.bossActive){
      pJunk += 0.10;
      pGood -= 0.10;
    }
  }
  if (diff==='hard'){ pJunk+=0.04; pGood-=0.04; }

  const r=rng();
  if (r<pSh) return 'shield';
  if (r<pSh+pJunk) return 'junk';
  return 'good';
}

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

  // force leave GREEN at storm start (so mini is possible)
  if (S.waterZone==='GREEN'){
    S.waterPct = clamp(S.waterPct + (rng()<0.5 ? -7 : +7), 0, 100);
    updateZone();
  }

  setEndFx(false);
  S.endFxTickAt = 0;

  emit('hha:judge', { kind:'storm' });
  tickBeep(820, 0.06, 0.06);
  syncHUD();
}

function passMiniThisStorm(){
  const m = S.miniState;
  if (m.gotHitByBad) return false;
  return !!(m.zoneOK && m.pressureOK && m.endWindow && m.blockedInEnd);
}

function exitStorm(){
  S.stormActive=false;
  S.stormLeftSec=0;
  S.inEndWindow=false;
  setEndFx(false);
  DOC.body.classList.remove('hha-bossfx');

  const ok = passMiniThisStorm();
  if (ok && !S.miniState.doneThisStorm){
    S.miniState.doneThisStorm=true;
    S.stormSuccess++;
    S.score += 40;
    emit('hha:judge', { kind:'streak' });
    pulseBody('hha-hitfx', 180);
    popScore('+40');
  }

  // boss bonus success (counts as a clear + extra reward)
  if (S.bossEnabled && !S.bossDoneThisStorm && S.bossBlocked>=S.bossNeed){
    S.bossDoneThisStorm=true;
    S.bossClearCount++;
    S.stormSuccess++; // bonus “mini clear” feel
    S.score += 50;
    emit('hha:judge', { kind:'perfect' });
    pulseBody('hha-hitfx', 200);
    popScore('+50');
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

  // End window FX + beep ramp
  if (inEnd){
    setEndFx(true);
    const now = performance.now();
    const rate = clamp(S.stormLeftSec / TUNE.endWindowSec, 0, 1);
    const interval = 320 - 190*(1-rate);
    if (now - S.endFxTickAt > interval){
      S.endFxTickAt = now;
      tickBeep(900 + (1-rate)*520, 0.04, 0.05);
    }
  } else {
    setEndFx(false);
  }

  // Boss window (ท้ายพายุ) ชัด ๆ
  const inBoss = (S.stormLeftSec <= (S.bossWindowSec + 0.02));
  S.bossActive = (S.bossEnabled && inBoss && !S.bossDoneThisStorm);
  DOC.body.classList.toggle('hha-bossfx', !!S.bossActive);

  // mini zone: ต้องไม่ใช่ GREEN
  const zoneOK = (S.waterZone !== 'GREEN');
  if (zoneOK) S.miniState.zoneOK = true;

  // pressure: ต้องอยู่ LOW/HIGH ต่อเนื่องช่วงหนึ่ง
  const gain = zoneOK ? 1.05 : 0.25;
  S.miniState.pressure = clamp(S.miniState.pressure + dt*gain, 0, 1.5);
  if (S.miniState.pressure >= (TUNE.pressureNeed)) S.miniState.pressureOK = true;

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
  const boss = (sum.bossClearCount|0);

  tips.push(goalsOk ? '✅ Stage1 ผ่านแล้ว (คุม GREEN ได้ดี)' : '🎯 Stage1: โฟกัสคุม GREEN ให้ผ่านก่อน');
  if (cycles<=0) tips.push('🌀 ยังไม่เจอพายุ: เล่นต่ออีกนิด จะมี STORM ให้ทำ Mini');
  else if (ok<=0) tips.push('🌀 Stage2: STORM ต้องทำ “LOW/HIGH” + BLOCK ช่วงท้าย (End Window) และห้ามโดน 🥤');
  else tips.push(`🔥 Stage2 ผ่านแล้ว: ผ่าน Mini ${ok}/${cycles} พายุ`);

  tips.push(boss>0 ? '🌩️ Stage3 ผ่านแล้ว: เคลียร์ BOSS สำเร็จ!' : '🌩️ Stage3: รอ Boss Window แล้ว BLOCK 🌩️ ให้ครบ');

  if (acc<60) tips.push('🎯 Accuracy ต่ำ: เล็งค้างนิดนึงแล้วค่อยยิง');
  else if (acc>=80) tips.push('⚡ Accuracy ดีมาก! ลากคอมโบยาว ๆ เกรดพุ่ง');
  if (miss>=25) tips.push('💥 MISS เยอะ: ลดการรัว + เลือกยิงเป้าที่ชัวร์');

  let next='เพิ่ม Accuracy + ลด MISS';
  if (!goalsOk) next='ผ่าน Stage1 ก่อน (คุม GREEN)';
  else if (cycles>0 && ok<=0) next='ผ่าน Stage2 ให้ได้ (Mini 1 พายุ)';
  else if (boss<=0) next='เคลียร์ Stage3 (Boss Clear 1 ครั้ง)';
  else if (acc<70) next='ดัน Accuracy > 70%';
  else if (miss>15) next='ลด MISS < 10';
  else next='ลากคอมโบ + ผ่านทุกพายุ';

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
  const btnClose = DOC.getElementById('btnCloseSummary');
  const btnCopy = DOC.getElementById('btnCopyJSON');
  const btnCSV = DOC.getElementById('btnDownloadCSV');

  DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
    btn.addEventListener('click', ()=> location.href = hub);
  });

  btnRetry?.addEventListener('click', ()=>{
    const u = new URL(location.href);
    u.searchParams.set('ts', String(Date.now()));
    location.href = u.toString();
  });

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
  cooldownMs: 3000
});

// -------------------- Storm schedule --------------------
function nextStormSchedule(){
  const base = TUNE.stormEverySec;
  return base + (rng()*2-1)*1.2;
}
let spawnTimer=0;
let nextStormIn=0;

// -------------------- Aim Assist for cVR (crosshair) --------------------
function hitTestAtCenter(lockPx){
  const { cx, cy } = centerPoint();
  const targets = Array.from(DOC.querySelectorAll('.hvr-target'));
  let best=null;
  let bestD=1e9;

  for (const el of targets){
    if (!el || !el.isConnected) continue;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width/2;
    const y = r.top + r.height/2;
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);

    if (d <= lockPx && d < bestD){
      bestD = d;
      best = el;
    }
  }
  return best;
}

// adaptive lockPx state (deterministic: state-only, no time randomness except the game RNG itself)
const AIM = { base:56, min:32, max:86, streakHit:0, streakMiss:0, emaSkill:0.45, lastShotAt:0 };

function aimLockPx(){
  const accK = clamp(computeAccuracy()/100, 0, 1);
  const comboK = clamp(S.combo/22, 0, 1);
  let skill = clamp(accK*0.72 + comboK*0.28, 0, 1);

  if (S.stormActive) skill = clamp(skill - 0.10, 0, 1);
  if (S.bossEnabled && S.bossActive) skill = clamp(skill - 0.08, 0, 1);

  AIM.emaSkill = AIM.emaSkill*0.88 + skill*0.12;

  let px = AIM.base * (1.18 - 0.55*AIM.emaSkill);
  px += Math.min(18, AIM.streakMiss*4);
  px -= Math.min(10, AIM.streakHit*1.6);

  return clamp(px, AIM.min, AIM.max);
}
function registerShot(hit){
  if (hit){ AIM.streakHit++; AIM.streakMiss=0; }
  else { AIM.streakMiss++; AIM.streakHit=0; }
}

// ✅ Standalone cVR shoot: if view-cvr then tap/click anywhere => emit hha:shoot
(function bindStandaloneCVRShoot(){
  const pf = getPlayfieldEl();
  if (!pf) return;

  // Always bind; only fires when isCVR()
  const fire = (ev)=>{
    if (!isCVR() || S.ended) return;
    // prevent accidental text selection/scroll
    try{ ev.preventDefault(); }catch(_){}
    window.dispatchEvent(new CustomEvent('hha:shoot'));
  };

  pf.addEventListener('pointerdown', fire, {passive:false});
  // fallback for some mobile browsers
  pf.addEventListener('touchstart', fire, {passive:false});
})();

window.addEventListener('hha:shoot', ()=>{
  if (!isCVR() || S.ended) return;

  const now = performance.now();
  if (now - AIM.lastShotAt < 70) return;
  AIM.lastShotAt = now;

  const lockPx = aimLockPx();
  const el = hitTestAtCenter(lockPx);

  if (!el){
    registerShot(false);
    emit('hha:judge', { kind:'miss' });
    pulseBody('hha-hitfx', 90);
    return;
  }

  registerShot(true);
  try{ el.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true })); }catch(_){}
}, { passive:true });

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

  // Spawn
  spawnTimer -= dt*1000;
  while (spawnTimer <= 0){
    spawn(pickKind());
    spawnTimer += nextSpawnDelay();
  }

  // HUD + AI
  syncHUD();

  AICOACH.onUpdate({
    skill: clamp((computeAccuracy()/100)*0.7 + clamp(S.combo/20,0,1)*0.3, 0, 1),
    fatigue: clamp((timeLimit - S.leftSec)/Math.max(1,timeLimit), 0, 1),
    frustration: clamp((S.misses/Math.max(1,(timeLimit - S.leftSec)+5))*0.7 + (1-(computeAccuracy()/100))*0.3, 0, 1),
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
  DOC.body.classList.remove('hha-bossfx');

  const grade = computeGrade();
  const acc = computeAccuracy();

  const cycles = S.stormCycle|0;
  const success = S.stormSuccess|0;

  const avgRt = avg(S.rtGoodMs);
  const medRt = median(S.rtGoodMs);
  const fastRate = clamp((S.fastHits / Math.max(1, S.nHitGood))*100, 0, 100);

  const durationPlayed = clamp(timeLimit - S.leftSec, 0, timeLimit);

  const summary = {
    // common fields
    timestampIso: qs('timestampIso', new Date().toISOString()),
    projectTag: qs('projectTag','HeroHealth'),
    runMode: run,
    sessionId: sessionId || '',
    gameMode:'hydration',
    diff,
    seed,

    durationPlannedSec: timeLimit,
    durationPlayedSec: Number(durationPlayed.toFixed(3)),

    scoreFinal: S.score|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,

    // mission
    goalsCleared: (S.greenHold >= TUNE.greenTargetSec) ? 1 : 0,
    goalsTotal: 1,

    miniCleared: success,
    miniTotal: cycles,
    stormCycles: cycles,
    stormSuccess: success,
    stormRatePct: clamp((success/Math.max(1,cycles))*100, 0, 100),

    bossClearCount: S.bossClearCount|0,
    stageCleared: (S.stage3Done ? 3 : S.stage2Done ? 2 : S.stage1Done ? 1 : 0),

    // research metrics
    nTargetGoodSpawned: S.nTargetGoodSpawned|0,
    nTargetJunkSpawned: S.nTargetJunkSpawned|0,
    nTargetShieldSpawned: S.nTargetShieldSpawned|0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,

    nHitGood: S.nHitGood|0,
    nHitJunk: S.nHitJunk|0,
    nHitJunkGuard: S.nHitJunkGuard|0,
    nExpireGood: S.nExpireGood|0,

    accuracyGoodPct: acc,
    junkErrorPct: computeJunkErrorPct(),

    avgRtGoodMs: Number(avgRt.toFixed(2)),
    medianRtGoodMs: Number(medRt.toFixed(2)),
    fastHitRatePct: Number(fastRate.toFixed(2)),

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

  spawnTimer = 320;
  nextStormIn = nextStormSchedule();

  window.addEventListener('hha:start', ()=>{
    if (S.started) return;
    S.started=true;
    S.t0=performance.now();
    S.lastTick=S.t0;

    // little “start beep”
    tickBeep(980, 0.05, 0.06);

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

  // If overlay already hidden, auto-start
  const ov = DOC.getElementById('startOverlay');
  setTimeout(()=>{
    const hidden = !ov || getComputedStyle(ov).display==='none' || ov.classList.contains('hide');
    if (hidden && !S.started) window.dispatchEvent(new CustomEvent('hha:start'));
  }, 600);
}

boot();