// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PLAY MODE (PRODUCTION)
// ✅ Targets spawn FULL SPREAD (grid9) + safezone exclusions
// ✅ VR-feel playfield move (gyro + drag)
// ✅ Score/Combo/Miss + Perfect bonus
// ✅ Powerups: ⭐ (boost) + 🛡️ (shield)
// ✅ Stamp Finisher (Grade) + Odometer rolling numbers + Spark trail
// ✅ Emits standard events: hha:score, hha:time, hha:judge, hha:coach, hha:end
// ✅ Cloud logger compatible: hha:log_session, hha:log_event, hha:end

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

// ---------------------------------------------------------
// helpers
// ---------------------------------------------------------
function $(sel){ return DOC ? DOC.querySelector(sel) : null; }
function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function q(name, fallback=''){
  try{
    const u = new URL(ROOT.location.href);
    const v = u.searchParams.get(name);
    return (v==null || v==='') ? fallback : v;
  }catch{ return fallback; }
}
function qn(name, fallback=null){
  const s = q(name, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}
function nowMs(){ return (typeof performance!=='undefined'? performance.now(): Date.now()); }

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

// ---------------------------------------------------------
// DOM refs
// ---------------------------------------------------------
const elBounds   = $('#hvr-bounds');
const elPlay     = $('#hvr-playfield');
const elLayer    = $('#hvr-layer');

const elStart    = $('#hvr-start');
const btnStart   = $('#btn-start');
const btnMotion  = $('#btn-motion');

const hudScore   = $('#hud-score');
const hudCombo   = $('#hud-combo');
const hudMiss    = $('#hud-miss');
const hudTime    = $('#hud-time');

const waterFill  = $('#water-fill');
const waterZone  = $('#water-zone');

const coachText  = $('#coach-text');

const elEnd      = $('#hvr-end');
const endScore   = $('#end-score');
const endCombo   = $('#end-combo');
const endMiss    = $('#end-miss');
const endGrade   = $('#end-grade');
const btnRestart = $('#btn-restart');
const btnCloseEnd= $('#btn-close-end');

const elStamp    = $('#hvr-stamp');
const stampGrade = $('#stamp-grade');
const stampSub   = $('#stamp-sub');
const stampScore = $('#stamp-score');

// ---------------------------------------------------------
// Config (URL)
// ---------------------------------------------------------
const diff = String(q('diff', 'normal')).toLowerCase();
const duration = clamp(qn('time', 60) ?? 60, 20, 180);
const runMode = String(q('run', 'play')).toLowerCase();
const seed = String(q('seed', q('ts','')) || '').trim(); // allow ?seed= or fallback ts

// ---------------------------------------------------------
// Game state
// ---------------------------------------------------------
const S = {
  started: false,
  ended: false,
  tStart: 0,
  secLeft: duration,

  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,

  // hydration balance (0..100)
  water: 50,

  // powerups
  shieldUntil: 0,
  boostUntil: 0,

  // counters (logger-friendly)
  nSpawnGood: 0,
  nSpawnBad: 0,
  nSpawnStar: 0,
  nSpawnShield: 0,
  nHitGood: 0,
  nHitBad: 0,
  nHitShieldBlock: 0,
  nExpireGood: 0,

  // accuracy
  hitGood: 0,
  missGood: 0,
  totalGood: 0
};

function isShieldOn(){ return nowMs() < S.shieldUntil; }
function isBoostOn(){ return nowMs() < S.boostUntil; }

function setCoach(msg){
  if (coachText) coachText.textContent = msg;
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:coach', { detail: { text: msg } }));
  }catch{}
}

function setWater(v){
  S.water = clamp(v, 0, 100);
  if (waterFill) waterFill.style.width = S.water.toFixed(0) + '%';
  const z = (S.water < 35) ? 'LOW'
          : (S.water > 75) ? 'HIGH'
          : 'OK';
  if (waterZone) {
    waterZone.textContent = z;
    waterZone.style.color =
      (z==='OK') ? 'rgba(255,255,255,.86)' :
      (z==='LOW') ? 'rgba(34,197,94,.92)' :
      'rgba(245,158,11,.92)';
  }
}

function uiScore(){
  if (hudScore) hudScore.textContent = String(S.score|0);
  if (hudCombo) hudCombo.textContent = String(S.combo|0);
  if (hudMiss)  hudMiss.textContent  = String(S.miss|0);

  try{
    ROOT.dispatchEvent(new CustomEvent('hha:score', {
      detail: {
        score: S.score, combo: S.combo, comboMax: S.comboMax, misses: S.miss,
        water: S.water,
        shield: isShieldOn(),
        boost: isBoostOn()
      }
    }));
  }catch{}
}

function uiTime(){
  if (hudTime) hudTime.textContent = String(S.secLeft|0);
  try{ ROOT.dispatchEvent(new CustomEvent('hha:time', { detail: { sec: S.secLeft } })); }catch{}
}

// ---------------------------------------------------------
// Logger helpers (sparse)
// ---------------------------------------------------------
function logSession(kind='start'){
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:log_session', {
      detail: {
        kind,
        sessionId: q('sessionId', ''),
        game: 'hydration',
        mode: runMode,
        diff,
        seed
      }
    }));
  }catch{}
}
function logEvent(type, data={}){
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:log_event', {
      detail: {
        sessionId: q('sessionId', ''),
        game: 'hydration',
        type,
        t: Math.round(nowMs()),
        score: S.score,
        combo: S.combo,
        miss: S.miss,
        data
      }
    }));
  }catch{}
}

// ---------------------------------------------------------
// Grade logic (SSS/SS/S/A/B/C)
// ---------------------------------------------------------
function computeGrade(){
  const score = S.score|0;
  const miss  = S.miss|0;
  const combo = S.comboMax|0;

  // simple tuned rubric
  let g = 'C';
  if (score >= 900 && miss <= 2 && combo >= 18) g = 'SSS';
  else if (score >= 760 && miss <= 4 && combo >= 14) g = 'SS';
  else if (score >= 620 && miss <= 6 && combo >= 10) g = 'S';
  else if (score >= 480 && miss <= 8) g = 'A';
  else if (score >= 320) g = 'B';
  else g = 'C';
  return g;
}
function gradeSubtitle(g){
  if (g==='SSS') return 'Hydration GODMODE ⚡💧';
  if (g==='SS')  return 'Hydration Master ✨';
  if (g==='S')   return 'Great Balance 🌿';
  if (g==='A')   return 'Nice! Keep going 💪';
  if (g==='B')   return 'Good start 🙂';
  return 'ลองใหม่อีกทีนะ 🫶';
}

// ---------------------------------------------------------
// VR-feel look (gyro + drag) -> moves playfield
// ---------------------------------------------------------
function attachTouchLook(){
  if (!elPlay) return () => {};
  let dragging = false;
  let sx=0, sy=0;
  let ox=0, oy=0;
  let gx=0, gy=0;

  function apply(){
    // clamp small movement
    const x = clamp(ox + gx, -42, 42);
    const y = clamp(oy + gy, -46, 46);
    elPlay.style.transform = `translate3d(${x}px,${y}px,0)`;
  }

  function onDown(e){
    dragging = true;
    const t = (e.touches && e.touches[0]) ? e.touches[0] : e;
    sx = t.clientX; sy = t.clientY;
    e.preventDefault();
  }
  function onMove(e){
    if (!dragging) return;
    const t = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    ox = clamp(dx * 0.15, -42, 42);
    oy = clamp(dy * 0.15, -46, 46);
    apply();
    e.preventDefault();
  }
  function onUp(){
    dragging = false;
    // ease back a bit
    ox *= 0.55; oy *= 0.55;
    apply();
  }

  function onOrient(ev){
    // mild gyro
    const beta  = Number(ev.beta)||0;   // -180..180
    const gamma = Number(ev.gamma)||0;  // -90..90
    gx = clamp(gamma * 0.32, -22, 22);
    gy = clamp(beta  * 0.10, -22, 22);
    apply();
  }

  DOC.addEventListener('pointerdown', onDown, { passive:false });
  DOC.addEventListener('pointermove', onMove, { passive:false });
  DOC.addEventListener('pointerup',   onUp,   { passive:true });
  DOC.addEventListener('touchstart',  onDown, { passive:false });
  DOC.addEventListener('touchmove',   onMove, { passive:false });
  DOC.addEventListener('touchend',    onUp,   { passive:true });

  ROOT.addEventListener('deviceorientation', onOrient, { passive:true });

  return () => {
    DOC.removeEventListener('pointerdown', onDown);
    DOC.removeEventListener('pointermove', onMove);
    DOC.removeEventListener('pointerup', onUp);
    DOC.removeEventListener('touchstart', onDown);
    DOC.removeEventListener('touchmove', onMove);
    DOC.removeEventListener('touchend', onUp);
    ROOT.removeEventListener('deviceorientation', onOrient);
  };
}

// iOS motion permission
async function requestMotionPermission(){
  try{
    const DME = ROOT.DeviceMotionEvent;
    if (DME && typeof DME.requestPermission === 'function') {
      const res = await DME.requestPermission();
      return res === 'granted';
    }
  }catch{}
  return true;
}

// ---------------------------------------------------------
// STEP 6.75 — Finisher Pack (lightweight)
// ---------------------------------------------------------
function playFinisherPack({ grade='B' } = {}){
  // subtle camera shake + FX burst
  try{
    const x = (ROOT.innerWidth || 360) * 0.5;
    const y = (ROOT.innerHeight|| 640) * 0.42;
    Particles.celebrate && Particles.celebrate({ x, y, kind:'stamp', grade });
    Particles.burstAt && Particles.burstAt(x, y, { kind:'gold', amount: (grade==='SSS'? 28: 18) });
  }catch{}
  // tiny audio ping via oscillator (no asset needed)
  try{
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'triangle';
    o.frequency.value = (grade==='SSS') ? 880 : (grade==='SS'? 740 : 640);
    g.gain.value = 0.0001;
    o.connect(g); g.connect(ac.destination);
    o.start();
    const t = ac.currentTime;
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.stop(t + 0.25);
    setTimeout(()=> { try{ ac.close(); }catch{} }, 420);
  }catch{}
}

// ---------------------------------------------------------
// STEP 6.9 — ODOMETER + SPARK (FULL BLOCK)
// ---------------------------------------------------------
const HHA_ODO = { styleId:'hha-odo-style-v1', sparkHostId:'hha-odo-spark-host', lastSparkAt:0 };

function ensureOdoStyle(){
  if (!DOC) return;
  if (DOC.getElementById(HHA_ODO.styleId)) return;

  const s = DOC.createElement('style');
  s.id = HHA_ODO.styleId;
  s.textContent = `
    .hha-odo{ display:inline-flex; align-items:flex-end; gap:.06em;
      font-variant-numeric: tabular-nums; letter-spacing:.02em;
      transform: translateZ(0); will-change: transform;
      filter: drop-shadow(0 10px 20px rgba(0,0,0,.40));
    }
    .hha-odo .odo-prefix,.hha-odo .odo-suffix{
      font-weight: 900; opacity:.95; transform: translateY(-.06em);
    }
    .hha-odo-digit{
      position:relative; width:.70em; height:1.05em; overflow:hidden;
      border-radius:.22em; background: rgba(255,255,255,.08);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.12), inset 0 -12px 24px rgba(0,0,0,.28);
    }
    .hha-odo-digit::after{
      content:""; position:absolute; inset:0;
      background: linear-gradient(to bottom,
        rgba(0,0,0,.25), rgba(0,0,0,0) 28%,
        rgba(0,0,0,0) 72%, rgba(0,0,0,.30));
      pointer-events:none;
    }
    .hha-odo-wheel{
      position:absolute; left:0; top:0; width:100%;
      transform: translateY(0);
      will-change: transform, filter;
    }
    .hha-odo-num{
      height:1.05em;
      display:flex; align-items:center; justify-content:center;
      font-weight: 1000; line-height:1; user-select:none;
      color: rgba(255,255,255,.97);
      text-shadow: 0 3px 10px rgba(0,0,0,.40);
    }
    .hha-odo.pop{ animation: hhaOdoPop .22s ease-out 1; }
    @keyframes hhaOdoPop{
      0%{ transform: scale(.98); }
      60%{ transform: scale(1.08); }
      100%{ transform: scale(1.00); }
    }
    #${HHA_ODO.sparkHostId}{
      position:fixed; inset:0; pointer-events:none; z-index:99995;
    }
    .hha-spark{
      position:absolute; width:6px; height:6px; border-radius:999px;
      opacity:0; transform: translate3d(0,0,0);
      filter: drop-shadow(0 10px 14px rgba(0,0,0,.35));
    }
    .hha-spark.fly{ animation: hhaSparkFly .42s cubic-bezier(.2,.9,.2,1) 1; }
    @keyframes hhaSparkFly{
      0%{ opacity:0; transform: translate3d(var(--x0),var(--y0),0) scale(.65); }
      15%{ opacity:1; }
      100%{ opacity:0; transform: translate3d(var(--x1),var(--y1),0) scale(1.25); }
    }
  `;
  DOC.head.appendChild(s);
}
function ensureSparkHost(){
  if (!DOC) return null;
  ensureOdoStyle();
  let host = DOC.getElementById(HHA_ODO.sparkHostId);
  if (host && host.isConnected) return host;
  host = DOC.createElement('div');
  host.id = HHA_ODO.sparkHostId;
  DOC.body.appendChild(host);
  return host;
}
function spawnSparkAt(clientX, clientY, intensity=1){
  const host = ensureSparkHost();
  if (!host) return;
  const n = Math.max(1, Math.min(6, Math.round(intensity * 3)));
  for (let i=0;i<n;i++){
    const sp = DOC.createElement('div');
    sp.className = 'hha-spark';
    const r = Math.random();
    const bg = (r<0.45) ? 'rgba(250,204,21,.95)'
            : (r<0.80) ? 'rgba(255,255,255,.92)'
                       : 'rgba(34,197,94,.92)';
    sp.style.background = bg;
    const x0 = clientX + (Math.random()*18 - 9);
    const y0 = clientY + (Math.random()*14 - 7);
    const x1 = x0 + (Math.random()*90 - 45);
    const y1 = y0 + (Math.random()*120 - 30);
    sp.style.setProperty('--x0', x0.toFixed(0)+'px');
    sp.style.setProperty('--y0', y0.toFixed(0)+'px');
    sp.style.setProperty('--x1', x1.toFixed(0)+'px');
    sp.style.setProperty('--y1', y1.toFixed(0)+'px');
    host.appendChild(sp);
    ROOT.requestAnimationFrame(()=> sp.classList.add('fly'));
    ROOT.setTimeout(()=> { try{ sp.remove(); }catch{} }, 520);
  }
}
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
function clamp01(t){ t=Number(t)||0; return t<0?0:(t>1?1:t); }
function makeOdoEl({ prefix='', suffix='' } = {}){
  ensureOdoStyle();
  const root = DOC.createElement('span');
  root.className = 'hha-odo';
  if (prefix){
    const p = DOC.createElement('span');
    p.className = 'odo-prefix';
    p.textContent = prefix;
    root.appendChild(p);
  }
  if (suffix){
    const s = DOC.createElement('span');
    s.className = 'odo-suffix';
    s.textContent = suffix;
    root.appendChild(s);
  }
  return root;
}
function buildDigit(){
  const d = DOC.createElement('span');
  d.className = 'hha-odo-digit';
  const wheel = DOC.createElement('span');
  wheel.className = 'hha-odo-wheel';
  for (let i=0;i<10;i++){
    const n = DOC.createElement('span');
    n.className = 'hha-odo-num';
    n.textContent = String(i);
    wheel.appendChild(n);
  }
  d.appendChild(wheel);
  return { digitEl:d, wheelEl:wheel };
}
function setWheelToDigit(wheelEl, digit, speedHint=0){
  const y = -digit * 1.05;
  wheelEl.style.transform = `translateY(${y}em)`;
  if (speedHint > 0.60) wheelEl.style.filter = 'blur(0.9px)';
  else if (speedHint > 0.35) wheelEl.style.filter = 'blur(0.5px)';
  else wheelEl.style.filter = 'blur(0px)';
}
function formatInt(n){
  n = Math.max(0, Math.floor(Number(n)||0));
  return String(n);
}
function startOdometerOnHost(hostEl, {
  from=0, to=999, ms=900, prefix='', suffix='', spark=true, sparkIntensity=1.0
} = {}){
  if (!DOC || !hostEl) return { stop(){}, el:null };

  ensureOdoStyle();
  hostEl.innerHTML = '';
  const odo = makeOdoEl({ prefix, suffix });

  const strTo = formatInt(to);
  const nd = strTo.length;
  const suffixEl = odo.querySelector('.odo-suffix');
  const insertBeforeNode = suffixEl || null;

  const digits = [];
  for (let i=0;i<nd;i++){
    const { digitEl, wheelEl } = buildDigit();
    digits.push({ digitEl, wheelEl, cur:0 });
    odo.insertBefore(digitEl, insertBeforeNode);
  }
  hostEl.appendChild(odo);

  const rectOf = () => { try{ return odo.getBoundingClientRect(); }catch{ return null; } };

  let stopped = false;
  const t0 = nowMs();
  const span = Math.max(180, Number(ms)||900);
  const a = Math.max(0, Math.floor(Number(from)||0));
  const b = Math.max(0, Math.floor(Number(to)||0));
  const range = Math.max(1, Math.abs(b - a));

  let lastVal = a;
  renderValue(a, 0);

  function renderValue(val, speedHint){
    const s = formatInt(val).padStart(nd, '0');
    for (let i=0;i<nd;i++){
      const dig = s.charCodeAt(i) - 48;
      setWheelToDigit(digits[i].wheelEl, dig, speedHint);
    }
    if (spark){
      const tNow = nowMs();
      if (tNow - HHA_ODO.lastSparkAt > 55){
        HHA_ODO.lastSparkAt = tNow;
        const r = rectOf();
        if (r){
          const x = r.left + r.width * (0.55 + Math.random()*0.35);
          const y = r.top  + r.height * (0.25 + Math.random()*0.55);
          spawnSparkAt(x, y, sparkIntensity);
        }
      }
    }
  }

  function loop(ts){
    if (stopped) return;
    const t = (ts - t0) / span;
    const p = easeOutCubic(clamp01(t));
    const val = Math.round(a + (b - a) * p);

    const dv = Math.abs(val - lastVal);
    const speedHint = Math.min(1, dv / Math.max(1, range * 0.04));

    if (val !== lastVal){
      lastVal = val;
      renderValue(val, speedHint);
    } else {
      if (spark) renderValue(val, 0.15);
    }

    if (t < 1) ROOT.requestAnimationFrame(loop);
    else {
      renderValue(b, 0);
      odo.classList.remove('pop'); void odo.offsetHeight; odo.classList.add('pop');
    }
  }

  ROOT.requestAnimationFrame(loop);
  return { el: odo, stop(){ stopped=true; } };
}
function startStampOdometer(stampEl, opts = {}){
  if (!DOC || !stampEl) return;
  let numHost = stampEl.querySelector('[data-stamp-number]');
  if (!numHost){
    numHost = DOC.createElement('div');
    numHost.setAttribute('data-stamp-number', '1');
    stampEl.appendChild(numHost);
  }
  const to = Math.max(0, Math.floor(Number(opts.to ?? opts.score ?? 0) || 0));
  const from = Math.max(0, Math.floor(Number(opts.from ?? Math.max(0, to - 120)) || 0));
  const ms   = Math.max(260, Math.floor(Number(opts.ms ?? 820) || 820));
  const prefix = (opts.prefix != null) ? String(opts.prefix) : '';
  const suffix = (opts.suffix != null) ? String(opts.suffix) : '';
  const grade = String(opts.grade || '').toUpperCase();
  const intensity = (grade === 'SSS') ? 1.6 : (grade === 'SS' ? 1.2 : 1.0);

  startOdometerOnHost(numHost, { from, to, ms, prefix, suffix, spark:true, sparkIntensity:intensity });
}

// ---------------------------------------------------------
// Stamp finisher
// ---------------------------------------------------------
function showStampFinisher(){
  if (!elStamp) return;
  const grade = computeGrade();
  const score = S.score|0;

  stampGrade && (stampGrade.textContent = grade);
  stampSub   && (stampSub.textContent = gradeSubtitle(grade));
  stampScore && (stampScore.textContent = String(score));

  elStamp.classList.add('show');
  playFinisherPack({ grade });

  // ✅ Odometer rolling score + sparks
  startStampOdometer(elStamp, { to: score, from: Math.max(0, score - 120), ms: 820, grade });
}

// ---------------------------------------------------------
// End / Summary
// ---------------------------------------------------------
function showEnd(){
  if (!elEnd) return;
  const grade = computeGrade();

  endScore && (endScore.textContent = String(S.score|0));
  endCombo && (endCombo.textContent = String(S.comboMax|0));
  endMiss  && (endMiss.textContent  = String(S.miss|0));
  endGrade && (endGrade.textContent = grade);

  elEnd.classList.add('show');
}

// ---------------------------------------------------------
// Judge & Expire
// ---------------------------------------------------------
function addScore(delta){
  delta = delta|0;
  if (isBoostOn() && delta > 0) delta = Math.round(delta * 1.5);
  S.score = Math.max(0, (S.score|0) + delta);
}

function onGoodHit(ctx){
  const perfect = !!ctx.hitPerfect;
  const base = 10;
  const bonus = perfect ? 6 : 0;
  addScore(base + bonus);

  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);

  S.hitGood++; S.totalGood++;

  // water balance -> up
  setWater(S.water + (perfect ? 6 : 4));

  // FX
  try{
    const x = ctx.clientX || ctx.cx || (ROOT.innerWidth*0.5);
    const y = ctx.clientY || ctx.cy || (ROOT.innerHeight*0.52);
    Particles.scorePop && Particles.scorePop(x, y, `+${base+bonus}`, { kind:'good', perfect });
    Particles.burstAt && Particles.burstAt(x, y, { kind:'good', amount: perfect ? 14 : 10 });
  }catch{}

  logEvent('hit', { kind:'good', perfect });

  if (perfect && S.combo % 6 === 0) setCoach('Perfect รัว ๆ! เก่งมาก 💧✨');
}

function onBadHit(ctx){
  if (isShieldOn()){
    // block bad hit (no miss)
    S.nHitShieldBlock++;
    try{
      const x = ctx.clientX || (ROOT.innerWidth*0.5);
      const y = ctx.clientY || (ROOT.innerHeight*0.52);
      Particles.scorePop && Particles.scorePop(x, y, 'BLOCK', { kind:'shield' });
      Particles.burstAt && Particles.burstAt(x, y, { kind:'shield', amount: 10 });
    }catch{}
    logEvent('shield_block', { kind:'junk' });
    setCoach('โล่ช่วยบล็อกได้! 🛡️');
    return;
  }

  addScore(-12);
  S.combo = 0;
  S.miss++;

  S.nHitBad++;

  // water balance -> down
  setWater(S.water - 9);

  try{
    const x = ctx.clientX || (ROOT.innerWidth*0.5);
    const y = ctx.clientY || (ROOT.innerHeight*0.52);
    Particles.scorePop && Particles.scorePop(x, y, '-12', { kind:'bad' });
    Particles.burstAt && Particles.burstAt(x, y, { kind:'bad', amount: 12 });
  }catch{}

  logEvent('hit', { kind:'junk' });
  setCoach('โอ๊ะ! หลีกเลี่ยงน้ำหวานนะ 🥤');
}

function onPowerHit(kind, ctx){
  if (kind === 'shield'){
    S.shieldUntil = nowMs() + 6500;
    setCoach('ได้โล่! โดนขยะช่วงนี้ไม่เสีย Miss 🛡️');
    logEvent('hit', { kind:'shield' });
    try{
      const x = ctx.clientX || (ROOT.innerWidth*0.5);
      const y = ctx.clientY || (ROOT.innerHeight*0.52);
      Particles.scorePop && Particles.scorePop(x, y, 'SHIELD!', { kind:'shield' });
      Particles.burstAt && Particles.burstAt(x, y, { kind:'shield', amount: 16 });
    }catch{}
    return;
  }
  // star boost
  S.boostUntil = nowMs() + 7000;
  addScore(25);
  setCoach('Boost Score! ช่วงนี้คะแนนคูณ 🔥⭐');
  logEvent('hit', { kind:'star' });
  try{
    const x = ctx.clientX || (ROOT.innerWidth*0.5);
    const y = ctx.clientY || (ROOT.innerHeight*0.52);
    Particles.scorePop && Particles.scorePop(x, y, '+25', { kind:'gold' });
    Particles.burstAt && Particles.burstAt(x, y, { kind:'gold', amount: 18 });
  }catch{}
}

// ---------------------------------------------------------
// Main game boot
// ---------------------------------------------------------
let detachLook = null;
let engine = null;
let clockTimer = null;

async function startGame(){
  if (S.started) return;
  S.started = true;
  S.ended = false;
  S.tStart = Date.now();
  S.secLeft = duration;

  // reset
  S.score=0; S.combo=0; S.comboMax=0; S.miss=0;
  S.water=50;
  S.shieldUntil=0; S.boostUntil=0;
  S.nSpawnGood=0; S.nSpawnBad=0; S.nSpawnStar=0; S.nSpawnShield=0;
  S.nHitGood=0; S.nHitBad=0; S.nHitShieldBlock=0; S.nExpireGood=0;
  S.hitGood=0; S.missGood=0; S.totalGood=0;

  setWater(50);
  uiScore();
  uiTime();
  setCoach('เริ่มเลย! เก็บน้ำให้ได้เยอะ ๆ 💧');

  logSession('start');

  // look controls
  detachLook = attachTouchLook();

  // factory boot (FULL SPREAD)
  engine = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diff,
    duration: duration,
    seed,

    // hosts
    spawnHost: '#hvr-layer',
    boundsHost: '#hvr-bounds',

    // pools
    pools: {
      good: ['💧','🧊','🚰'],
      bad:  ['🥤','🍩','🧋'],
      trick: [] // not used here
    },
    goodRate: 0.68,

    // powerups appear
    powerups: ['⭐','🛡️'],
    powerRate: 0.18,
    powerEvery: 6,

    // ✅ spread across playRect
    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',
    spawnRadiusX: 0.95,
    spawnRadiusY: 0.95,
    minSeparation: 1.00,
    maxSpawnTries: 18,

    // exclude HUD
    excludeSelectors: [
      '#hha-hud',
      '#hvr-start',
      '#hvr-end',
      '#hvr-stamp'
    ],

    // optional decorate
    decorateTarget(el, parts, data){
      // tag counters + logger spawn type
      const type = data.itemType;
      if (type === 'power'){
        // decide which
        const ch = data.ch;
        if (ch === '⭐') S.nSpawnStar++;
        else S.nSpawnShield++;
        logEvent('spawn', { kind: (ch==='🛡️'?'shield':'star') });
      } else if (type === 'good'){
        S.nSpawnGood++;
        logEvent('spawn', { kind: 'good' });
      } else {
        S.nSpawnBad++;
        logEvent('spawn', { kind: 'junk' });
      }
    },

    judge(ch, ctx){
      // route by item type from ctx
      const t = String(ctx.itemType || (ctx.isPower ? 'power' : (ctx.isGood ? 'good' : 'bad')));

      if (t === 'power'){
        // map char
        const kind = (ch === '🛡️') ? 'shield' : 'star';
        onPowerHit(kind, ctx);
        uiScore();
        return { scoreDelta: 0, good:true };
      }

      if (ctx.isGood){
        onGoodHit(ctx);
        uiScore();
        return { scoreDelta: 1, good:true };
      } else {
        onBadHit(ctx);
        uiScore();
        return { scoreDelta: -1, good:false };
      }
    },

    onExpire({ itemType, isGood }){
      // good expired = miss
      if (itemType === 'good' && isGood){
        S.nExpireGood++;
        S.combo = 0;
        S.miss++;
        S.missGood++; S.totalGood++;
        setWater(S.water - 4);
        uiScore();
        logEvent('miss_expire', { kind:'good' });

        // subtle coach
        if ((S.miss % 3) === 0) setCoach('รีบเก็บน้ำก่อนหมดเวลา! 💧');
      }
    }
  });

  // Clock (hard stop at 0)
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(()=>{
    if (S.ended) return;
    S.secLeft = Math.max(0, S.secLeft - 1);
    uiTime();

    // hype cues
    if (S.secLeft === 15) setCoach('เหลือ 15 วิ! ปั๊มคะแนน! 🔥');
    if (S.secLeft === 8)  setCoach('ใกล้จบแล้ว! โคตรเดือด 💥');

    if (S.secLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

function endGame(reason='end'){
  if (S.ended) return;
  S.ended = true;

  try{ engine && engine.stop && engine.stop(); }catch{}
  engine = null;

  try{ detachLook && detachLook(); }catch{}
  detachLook = null;

  if (clockTimer) { clearInterval(clockTimer); clockTimer=null; }

  // compute perf
  const accuracyGoodPct = (S.totalGood > 0)
    ? Math.round((S.hitGood / S.totalGood) * 1000) / 10
    : null;
  const junkErrorPct = null; // optional in future

  const grade = computeGrade();

  // emit end summary
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        sessionId: q('sessionId',''),
        game: 'hydration',
        mode: runMode,
        diff,
        seed,
        reason,

        scoreFinal: S.score|0,
        comboMax: S.comboMax|0,
        misses: S.miss|0,

        goalsCleared: null,
        goalsTotal: null,
        miniCleared: null,
        miniTotal: null,

        nTargetGoodSpawned: S.nSpawnGood,
        nTargetJunkSpawned: S.nSpawnBad,
        nTargetStarSpawned: S.nSpawnStar,
        nTargetShieldSpawned: S.nSpawnShield,

        nHitGood: S.nHitGood,
        nHitJunk: S.nHitBad,
        nHitJunkGuard: S.nHitShieldBlock,
        nExpireGood: S.nExpireGood,

        accuracyGoodPct,
        junkErrorPct,
        grade
      }
    }));
  }catch{}

  logSession('end');

  // UI end
  showStampFinisher();
  showEnd();

  // auto-hide stamp after a moment
  if (elStamp){
    setTimeout(()=> { try{ elStamp.classList.remove('show'); }catch{} }, 2800);
  }
}

// ---------------------------------------------------------
// Controls
// ---------------------------------------------------------
function hideStart(){
  if (elStart) elStart.style.display = 'none';
}
function showStart(){
  if (elStart) elStart.style.display = 'flex';
}

btnStart && btnStart.addEventListener('click', async ()=>{
  hideStart();
  await startGame();
}, { passive:true });

btnMotion && btnMotion.addEventListener('click', async ()=>{
  const ok = await requestMotionPermission();
  setCoach(ok ? 'Motion พร้อมแล้ว ✅' : 'Motion ไม่พร้อม แต่ยังเล่นได้ 🙂');
}, { passive:true });

btnRestart && btnRestart.addEventListener('click', ()=>{
  // reset overlays
  try{ elEnd && elEnd.classList.remove('show'); }catch{}
  try{ elStamp && elStamp.classList.remove('show'); }catch{}
  // restart
  startGame();
}, { passive:true });

btnCloseEnd && btnCloseEnd.addEventListener('click', ()=>{
  try{ elEnd && elEnd.classList.remove('show'); }catch{}
  showStart();
}, { passive:true });

// crosshair shoot (tap anywhere quickly)
DOC && DOC.addEventListener('dblclick', ()=>{
  try{ engine && engine.shootCrosshair && engine.shootCrosshair(); }catch{}
}, { passive:true });

// safety stop on visibility
DOC && DOC.addEventListener('visibilitychange', ()=>{
  if (DOC.visibilityState === 'hidden' && !S.ended && S.started) endGame('hidden');
});

// initial
setWater(50);
uiScore();
uiTime();
setCoach('พร้อมดื่มน้ำให้สมดุล! 💧');