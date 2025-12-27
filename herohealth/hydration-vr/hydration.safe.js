// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — ORB Engine (PRODUCTION)
// Fixes:
// ✅ Goal GREEN timer -> complete trigger reliable (order + >= + latch)
// ✅ Water gauge "moves by itself" / jumps to 100 -> fixed (regression-to-mean correct + expire polarity)
// ✅ Orb hit -> cinematic FX (Particles.scorePop/burstAt + local burst ring)
// ✅ Storm warning PRE-ROLL (tick accel + vignette/flash/shake) + thunder
// ✅ Storm mini quest: Shield Timing (FULL) — block BAD in End-window counts
// ✅ Play vs Study tuning (Play forgiving but research-ish; Study deterministic & harsher)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const qs = new URLSearchParams(location.search);
const RUN = String(qs.get('run') || qs.get('runMode') || 'play').toLowerCase(); // play | study
const DIFF = String(qs.get('diff') || 'normal').toLowerCase();                // easy|normal|hard
const DURATION = clampInt(qs.get('time') || qs.get('durationPlannedSec') || 70, 20, 180);

const isStudy = (RUN === 'study');
const isPlay  = !isStudy;

// ---------- DOM ----------
const $ = (id)=> DOC.getElementById(id);

const el = {
  // stats
  score: $('stat-score'),
  combo: $('stat-combo'),
  comboMax: $('stat-combo-max'),
  miss: $('stat-miss'),
  time: $('stat-time'),
  grade: $('stat-grade'),

  // coach
  coachText: $('coach-text'),
  coachSub: $('coach-sub'),

  // playfield
  playfield: $('playfield'),
  layer: $('hvr-layer'),

  // water gauge
  waterZone: $('water-zone'),
  waterPct: $('water-pct'),
  waterBar: $('water-bar'),
  shield: $('shield-count'),
  stormLeft: $('storm-left'),

  // quest lines
  q1: $('quest-line1'),
  q2: $('quest-line2'),
  q3: $('quest-line3'),
  q4: $('quest-line4'),

  // mini card
  miniCard: $('mini-card'),
  miniStormIn: $('mini-storm-in'),
  mcStorm: $('mini-c-storm'),
  mvStorm: $('mini-v-storm'),
  mcZone: $('mini-c-zone'),
  mvZone: $('mini-v-zone'),
  mcPressure: $('mini-c-pressure'),
  mvPressure: $('mini-v-pressure'),
  mcEnd: $('mini-c-end'),
  mvEnd: $('mini-v-end'),
  mcBlock: $('mini-c-block'),
  mvBlock: $('mini-v-block'),
  mPressurePct: $('mini-pressure-pct'),
  mPressureBar: $('mini-pressure-bar'),

  // overlay/buttons
  startOverlay: $('start-overlay'),
  btnStart: $('btn-start'),
  btnVR: $('btn-vr'),
  btnStop: $('btn-stop'),

  // stamp
  stampWrap: $('hha-stamp'),
  stampBig: $('stamp-big'),
  stampSmall: $('stamp-small'),

  // end
  end: $('hvr-end'),
  endScore: $('end-score'),
  endGrade: $('end-grade'),
  endCombo: $('end-combo'),
  endMiss: $('end-miss'),
  endGoals: $('end-goals'),
  endMinis: $('end-minis'),
  btnRetry: $('btn-retry')
};

// ---------- Particles bridge (safe) ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

// ---------- Utils ----------
function clamp(n, a, b){ n = Number(n); if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b, n)); }
function clampInt(n, a, b){ return (clamp(n, a, b) | 0); }
function now(){ return performance.now(); }

function hashSeed(str){
  str = String(str || '');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic seed in study; flexible in play.
const sessionId = qs.get('sessionId') || '';
const studentKey = qs.get('studentKey') || '';
const seedStr = qs.get('seed')
  || (isStudy ? `${sessionId}|${studentKey}|${DIFF}|${DURATION}` : `${Date.now()}|${Math.random()}`);
const RNG = mulberry32(hashSeed(seedStr));

// ---------- Audio (beep + tick + thunder) ----------
let AC = null;
let audioArmed = false;

function ensureAudio(){
  if (audioArmed) return true;
  try{
    AC = AC || new (ROOT.AudioContext || ROOT.webkitAudioContext)();
    audioArmed = true;
    return true;
  }catch(_){
    return false;
  }
}
function playBeep(freq=880, ms=70, gain=0.06){
  if (!audioArmed || !AC) return;
  const t0 = AC.currentTime;
  const o = AC.createOscillator();
  const g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms/1000);
  o.connect(g).connect(AC.destination);
  o.start(t0);
  o.stop(t0 + ms/1000 + 0.02);
}
function playTick(ms=28, gain=0.045){
  // short click-ish tick
  playBeep(1400 + (RNG()*150|0), ms, gain);
}
function playThunder(){
  if (!audioArmed || !AC) return;
  const t0 = AC.currentTime;

  // rumble = brown-ish noise via filtered white
  const bufferSize = 2 * AC.sampleRate;
  const noiseBuffer = AC.createBuffer(1, bufferSize, AC.sampleRate);
  const out = noiseBuffer.getChannelData(0);
  for (let i=0;i<bufferSize;i++){
    // simple low noise
    out[i] = (RNG()*2 - 1) * 0.6;
  }

  const src = AC.createBufferSource();
  src.buffer = noiseBuffer;

  const filter = AC.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(160, t0);
  filter.Q.setValueAtTime(0.9, t0);

  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);

  src.connect(filter).connect(g).connect(AC.destination);
  src.start(t0);
  src.stop(t0 + 0.85);
}

// ---------- Game tuning ----------
const Z_LOW_MAX = 40;
const Z_GREEN_MAX = 60;

function goalNeedSec(){
  // Make it "พอดีโหมด Play แต่โหดแบบวิจัย"
  // Play: doable; Study: tighter & longer
  const base =
    (DIFF==='easy') ? 16 :
    (DIFF==='hard') ? 20 : 18;
  return isStudy ? (base + 4) : base;
}
const GOALS_TOTAL = 2; // 1) hold green, 2) hold green after first storm clears

const MINIS_TOTAL = 2; // storm mini requires 2 successful blocks

// spawn & difficulty
function spawnRatePerSec(){
  const base =
    (DIFF==='easy') ? 1.1 :
    (DIFF==='hard') ? 1.8 : 1.45;
  return isStudy ? base*1.12 : base;
}
function orbTTLms(type){
  // Play a bit longer, Study shorter
  const base =
    (type==='shield') ? 4200 :
    (type==='good') ? 5200 :
    (type==='bad') ? 5200 : 5200;
  const diffMul =
    (DIFF==='easy') ? 1.15 :
    (DIFF==='hard') ? 0.92 : 1.0;
  const runMul = isStudy ? 0.92 : 1.0;
  return Math.round(base * diffMul * runMul);
}
function orbSizePx(){
  const base =
    (DIFF==='easy') ? 98 :
    (DIFF==='hard') ? 82 : 90;
  return base;
}

// gauge effects
const EFFECT = {
  // hit
  goodHit: isStudy ? 7.0 : 6.0,
  badHit:  isStudy ? 9.0 : 8.0,
  // expire (IMPORTANT: polarity correct!)
  goodExpire: isStudy ? 4.5 : 3.5,    // miss good -> drift away from green (penalty)
  badExpire:  isStudy ? 1.5 : 0.0,    // Play: no penalty from BAD expire (ตาม coach)
  // regression-to-mean (toward 50) — must converge, not explode
  regressK: isStudy ? 0.018 : 0.030   // per second
};

// ---------- State ----------
const S = {
  started: false,
  t0: 0,
  last: 0,

  // stats
  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,

  // time
  timeLeft: DURATION,

  // water
  water: 50,         // 0..100
  zone: 'GREEN',     // LOW|GREEN|HIGH
  shield: 0,

  // quest
  goalsDone: 0,
  greenHold: 0,      // seconds accumulated for current goal
  goalNeed: goalNeedSec(),
  stormSeen: false,  // gate for goal #2

  minisDone: 0,      // successful blocks count (need 2)

  // storm system
  phase: 'calm',     // calm|warn|storm
  nextStormIn: 18,   // seconds (dynamic)
  warnLeft: 0,
  stormLeft: 0,
  warnAmp: 0,        // 0..1 (for CSS)

  // storm mini
  pressure: 0,       // 0..100
  pressureNeed: 70,
  endWindowSec: 1.35,
  blockedThisStorm: 0, // blocks counted in current storm end-window (debug)

  // spawn
  spawnBudget: 0,
  targets: []
};

// ---------- Visual: ORB ----------
function makeOrb(type){
  const d = DOC.createElement('div');
  d.className = 'hvr-orb hvr-' + type;
  d.setAttribute('role', 'button');
  d.setAttribute('aria-label', type);

  const inner = DOC.createElement('div');
  inner.className = 'hvr-orb-inner';
  d.appendChild(inner);

  const icon = DOC.createElement('div');
  icon.className = 'hvr-orb-icon';
  icon.textContent = (type==='good') ? '💧' : (type==='bad') ? '☠️' : '🛡️';
  d.appendChild(icon);

  // style (inline to keep "ไฟล์เดียว")
  Object.assign(d.style, {
    position:'absolute',
    left:'50%', top:'50%',
    width:'90px', height:'90px',
    borderRadius:'999px',
    transform:'translate(-50%,-50%)',
    cursor:'pointer',
    userSelect:'none',
    WebkitUserSelect:'none',
    touchAction:'manipulation',
    pointerEvents:'auto',
    filter:'saturate(1.05)',
    willChange:'transform, left, top, filter, opacity'
  });

  // glossy look
  Object.assign(inner.style, {
    position:'absolute', inset:'0',
    borderRadius:'999px',
    background:
      (type==='good')
        ? 'radial-gradient(55px 55px at 30% 25%, rgba(255,255,255,.32) 0%, rgba(255,255,255,0) 55%), radial-gradient(120px 90px at 55% 65%, rgba(34,211,238,.95) 0%, rgba(2,132,199,.90) 48%, rgba(2,6,23,.20) 100%)'
        : (type==='bad')
        ? 'radial-gradient(55px 55px at 30% 25%, rgba(255,255,255,.30) 0%, rgba(255,255,255,0) 55%), radial-gradient(120px 90px at 55% 65%, rgba(239,68,68,.95) 0%, rgba(249,115,22,.90) 48%, rgba(2,6,23,.20) 100%)'
        : 'radial-gradient(55px 55px at 30% 25%, rgba(255,255,255,.30) 0%, rgba(255,255,255,0) 55%), radial-gradient(120px 90px at 55% 65%, rgba(167,139,250,.92) 0%, rgba(34,211,238,.78) 55%, rgba(2,6,23,.20) 100%)',
    boxShadow:
      (type==='good')
        ? '0 18px 50px rgba(34,211,238,.18), inset 0 0 0 1px rgba(255,255,255,.08)'
        : (type==='bad')
        ? '0 18px 50px rgba(239,68,68,.16), inset 0 0 0 1px rgba(255,255,255,.08)'
        : '0 18px 50px rgba(167,139,250,.16), inset 0 0 0 1px rgba(255,255,255,.08)'
  });

  Object.assign(icon.style, {
    position:'absolute',
    left:'50%', top:'54%',
    transform:'translate(-50%,-50%)',
    fontSize:'22px',
    filter:'drop-shadow(0 10px 18px rgba(0,0,0,.45))',
    opacity: (type==='bad') ? '0.88' : '0.92',
    pointerEvents:'none'
  });

  return d;
}

function burstRing(x, y, kind='good'){
  const r = DOC.createElement('div');
  r.className = 'hvr-burst';
  Object.assign(r.style, {
    position:'absolute',
    left: x + 'px',
    top:  y + 'px',
    width:'20px', height:'20px',
    borderRadius:'999px',
    border: (kind==='bad') ? '2px solid rgba(239,68,68,.65)' : '2px solid rgba(34,211,238,.65)',
    transform:'translate(-50%,-50%) scale(0.6)',
    opacity:'1',
    pointerEvents:'none',
    boxShadow: (kind==='bad') ? '0 0 18px rgba(239,68,68,.18)' : '0 0 18px rgba(34,211,238,.18)',
    zIndex:'9'
  });
  el.layer.appendChild(r);
  const t0 = now();
  const dur = 420;
  function anim(){
    const t = now() - t0;
    const p = clamp(t/dur, 0, 1);
    r.style.transform = `translate(-50%,-50%) scale(${0.6 + p*2.2})`;
    r.style.opacity = String(1 - p);
    if (p < 1) requestAnimationFrame(anim);
    else r.remove();
  }
  requestAnimationFrame(anim);
}

// ---------- Water/Zone ----------
function computeZone(w){
  if (w < Z_LOW_MAX) return 'LOW';
  if (w <= Z_GREEN_MAX) return 'GREEN';
  return 'HIGH';
}
function applyWaterDeltaTowardGreen(amount, direction){
  // direction: +1 means push up, -1 push down, 0 toward center
  if (direction === 0){
    // move toward 50
    const sign = (S.water < 50) ? +1 : -1;
    S.water = clamp(S.water + sign * amount, 0, 100);
    return;
  }
  S.water = clamp(S.water + direction * amount, 0, 100);
}

function hitGood(){
  // Good helps correct imbalance (toward GREEN)
  if (S.water < 50) applyWaterDeltaTowardGreen(EFFECT.goodHit, +1);
  else if (S.water > 50) applyWaterDeltaTowardGreen(EFFECT.goodHit, -1);
  else applyWaterDeltaTowardGreen(EFFECT.goodHit*0.55, 0);
}
function hitBad(){
  // Bad pushes away from GREEN (out of balance)
  if (S.zone === 'GREEN'){
    // choose a side deterministically
    const dir = (RNG() < 0.5) ? -1 : +1;
    applyWaterDeltaTowardGreen(EFFECT.badHit, dir);
  }else{
    // push further away in same direction
    const dir = (S.water < 50) ? -1 : +1;
    applyWaterDeltaTowardGreen(EFFECT.badHit, dir);
  }
}
function expireGood(){
  // IMPORTANT: GOOD expire should NOT increase gauge
  // Penalty = drift away from green a bit
  const dir = (S.water < 50) ? -1 : +1; // push further away
  applyWaterDeltaTowardGreen(EFFECT.goodExpire, dir);
}
function expireBad(){
  // Play mode: no penalty from BAD expire (per your Coach note)
  if (EFFECT.badExpire <= 0) return;
  // Study: small penalty (makes avoidance still matter)
  const dir = (S.water < 50) ? -1 : +1;
  applyWaterDeltaTowardGreen(EFFECT.badExpire, dir);
}

// regression-to-mean (toward 50) — stable
function regressToMean(dt){
  const k = EFFECT.regressK; // per second
  // move water slightly toward 50; clamp
  const delta = (50 - S.water) * k * dt;
  S.water = clamp(S.water + delta, 0, 100);
}

// ---------- Storm scheduler ----------
function randomNextStorm(){
  // calm duration
  const base =
    (DIFF==='easy') ? 20 :
    (DIFF==='hard') ? 16 : 18;
  const jitter = (DIFF==='hard') ? 7 : 9;
  return clamp(base + (RNG()*jitter - jitter*0.45), 10, 30);
}
function startWarn(){
  S.phase = 'warn';
  S.warnLeft = isStudy ? 4.2 : 4.0;
  S.warnAmp = 0;
  DOC.body.classList.add('storm-warn');
  // start ticking immediately (accelerates)
  playBeep(950, 70, 0.05);
}
function startStorm(){
  S.phase = 'storm';
  S.stormSeen = true;
  S.stormLeft = isStudy ? 7.2 : 6.6;
  S.warnLeft = 0;
  S.warnAmp = 0;
  DOC.body.classList.remove('storm-warn');
  DOC.body.classList.add('storm');
  DOC.body.classList.add('fx-shake'); // cinematic shake
  playThunder();
  // reset storm-mini tracking per storm
  S.blockedThisStorm = 0;
  // pressure doesn't reset fully; keep some continuity
}
function endStorm(){
  DOC.body.classList.remove('storm');
  DOC.body.classList.remove('fx-shake');
  DOC.body.classList.remove('storm-warn');
  DOC.body.style.setProperty('--warnamp', '0');
  S.phase = 'calm';
  S.nextStormIn = randomNextStorm();
  // coach hint
  coachSay('พายุผ่านแล้ว! กลับไปคุม GREEN ให้เนียน', `Mini เหลือ ${Math.max(0, MINIS_TOTAL - S.minisDone)}/${MINIS_TOTAL}`);
}

// ---------- Spawning ----------
function playRect(){
  const r = el.playfield.getBoundingClientRect();
  // safe margin so it won't stick to borders
  const m = 18;
  return {
    left: r.left + m,
    top:  r.top + m,
    width: Math.max(80, r.width - m*2),
    height: Math.max(80, r.height - m*2)
  };
}
function pickType(){
  // Always mix; avoid "all red" confusion
  // Ratio depends on phase & water zone:
  let pGood = 0.52;
  let pBad  = 0.44;
  let pSh   = 0.04;

  if (S.phase === 'storm'){
    pBad += 0.14;
    pGood -= 0.10;
    pSh   += 0.02;
  }
  if (S.zone === 'LOW'){
    pGood += 0.08; pBad -= 0.06;
  }else if (S.zone === 'HIGH'){
    pGood += 0.08; pBad -= 0.06;
  }else{
    // green: tempt with more BAD
    pBad += 0.04; pGood -= 0.03;
  }

  // clamp & renormalize
  pGood = clamp(pGood, 0.25, 0.70);
  pBad  = clamp(pBad,  0.22, 0.70);
  pSh   = clamp(pSh,   0.02, 0.10);
  const sum = pGood + pBad + pSh;
  pGood/=sum; pBad/=sum; pSh/=sum;

  const u = RNG();
  if (u < pGood) return 'good';
  if (u < pGood + pBad) return 'bad';
  return 'shield';
}

function spawnOne(){
  const r = playRect();
  const type = pickType();
  const size = orbSizePx() * (0.92 + RNG()*0.18);
  const x = r.left + RNG() * r.width;
  const y = r.top  + RNG() * r.height;

  const orb = makeOrb(type);
  orb.style.width = size + 'px';
  orb.style.height = size + 'px';
  orb.style.left = x + 'px';
  orb.style.top  = y + 'px';

  // slight float animation (independent)
  const wob = (RNG()*0.9 + 0.55);
  orb.dataset.wob = String(wob);
  orb.dataset.seed = String((RNG()*9999)|0);

  const ttl = orbTTLms(type);

  const obj = {
    type,
    el: orb,
    born: now(),
    ttl,
    x, y,
    size,
    dead: false
  };

  // click-to-hit
  orb.addEventListener('pointerdown', (ev)=>{
    if (!S.started) return;
    ev.preventDefault();
    ev.stopPropagation();
    hitTarget(obj, ev.clientX, ev.clientY);
  }, { passive:false });

  el.layer.appendChild(orb);
  S.targets.push(obj);
}

function cullExpired(){
  const t = now();
  for (const o of S.targets){
    if (o.dead) continue;
    if (t - o.born < o.ttl) continue;
    o.dead = true;
    o.el.remove();

    // expire effects (polarity fixed)
    if (o.type === 'good') expireGood();
    else if (o.type === 'bad') expireBad();
    // shield expire: no effect
  }
  // compact occasionally
  if (S.targets.length > 60){
    S.targets = S.targets.filter(x=>!x.dead);
  }
}

// ---------- Hit / Shield / Mini logic ----------
function useShieldIfAny(){
  if (S.shield > 0){
    S.shield -= 1;
    return true;
  }
  return false;
}

function inEndWindow(){
  return (S.phase === 'storm' && S.stormLeft <= S.endWindowSec);
}

function updatePressure(dt){
  // Storm mini wants: in storm + NOT green -> build pressure
  // Outside storm -> slow decay
  if (S.phase === 'storm'){
    if (S.zone !== 'GREEN') S.pressure = clamp(S.pressure + (24 * dt), 0, 100);
    else S.pressure = clamp(S.pressure - (18 * dt), 0, 100);
  }else{
    S.pressure = clamp(S.pressure - (10 * dt), 0, 100);
  }
}

function canCountStormMiniNow(){
  return (
    S.phase === 'storm' &&
    S.zone !== 'GREEN' &&
    S.pressure >= S.pressureNeed &&
    inEndWindow()
  );
}

function hitTarget(o, clientX, clientY){
  if (!o || o.dead) return;

  // remove orb first to avoid double hit
  o.dead = true;
  o.el.remove();

  // FX
  burstRing(clientX, clientY, o.type);
  try{ Particles.burstAt(clientX, clientY, o.type==='bad' ? 'BAD' : 'GOOD'); }catch(_){}

  // Score logic
  if (o.type === 'good'){
    S.score += 12;
    S.combo += 1;
    S.comboMax = Math.max(S.comboMax, S.combo);
    hitGood();
    playBeep(880, 60, 0.055);
    Particles.scorePop?.(clientX, clientY, '+12', 'GOOD');
  }
  else if (o.type === 'bad'){
    // if shield available, block & count storm mini if timing is correct
    const blocked = useShieldIfAny();
    if (blocked){
      // blocked BAD: no miss, score small
      S.score += 6;
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.comboMax, S.combo);
      playBeep(720, 70, 0.06);
      Particles.scorePop?.(clientX, clientY, 'BLOCK', 'SHIELD');

      // ✅ storm mini success condition (the 핵)
      if (canCountStormMiniNow()){
        S.minisDone = Math.min(MINIS_TOTAL, S.minisDone + 1);
        S.blockedThisStorm += 1;
        stamp('✅ PERFECT BLOCK!', `Storm mini +1 (${S.minisDone}/${MINIS_TOTAL})`);
        playBeep(980, 90, 0.065);
      }
    }else{
      // no shield => penalty
      S.score -= 7;
      S.combo = 0;
      S.miss += 1;
      hitBad();
      playBeep(260, 90, 0.06);
      Particles.scorePop?.(clientX, clientY, '-7', 'BAD');
      // cinematic edge on miss during storm
      if (S.phase === 'storm') DOC.body.classList.add('fx-high');
      setTimeout(()=> DOC.body.classList.remove('fx-high'), 140);
    }
  }
  else if (o.type === 'shield'){
    S.score += 3;
    S.combo += 1;
    S.comboMax = Math.max(S.comboMax, S.combo);
    S.shield += 1;
    playBeep(1020, 70, 0.055);
    Particles.scorePop?.(clientX, clientY, '+SH', 'SHIELD');
  }

  // remove from list lazily; UI will compact
}

// ---------- Crosshair shoot (tap playfield center) ----------
function shootFromCrosshair(){
  const r = el.playfield.getBoundingClientRect();
  const cx = r.left + r.width*0.5;
  const cy = r.top  + r.height*0.5;

  // pick nearest live orb to crosshair within a radius
  let best = null;
  let bestD = 1e9;
  for (const o of S.targets){
    if (!o || o.dead) continue;
    const dx = o.x - cx;
    const dy = o.y - cy;
    const d2 = dx*dx + dy*dy;
    if (d2 < bestD){
      bestD = d2;
      best = o;
    }
  }
  const maxR = Math.max(120, (orbSizePx()*1.25));
  if (best && bestD <= maxR*maxR){
    hitTarget(best, cx, cy);
  }else{
    // miss shot feedback (tiny tick)
    playTick(22, 0.03);
  }
}

function bindInput(){
  // tap anywhere in playfield = shoot
  el.playfield.addEventListener('pointerdown', (ev)=>{
    if (!S.started) return;
    // ignore if tapped on orb itself (orb handler stops propagation but just in case)
    shootFromCrosshair();
  }, { passive:true });

  // VR button: best-effort enter A-Frame (if present)
  el.btnVR?.addEventListener('click', ()=>{
    try{
      const scene = DOC.querySelector('a-scene');
      if (scene && scene.enterVR) scene.enterVR();
    }catch(_){}
  });

  // stop
  el.btnStop?.addEventListener('click', ()=>{
    endGame('stopped');
  });

  // retry
  el.btnRetry?.addEventListener('click', ()=>{
    location.reload();
  });
}

// ---------- UI helpers ----------
function setText(node, s){
  if (!node) return;
  node.textContent = String(s);
}
function coachSay(line, sub){
  setText(el.coachText, line || '');
  setText(el.coachSub, sub || '');
  // also emit event if other global HUD listens
  try{ window.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text: line || '', sub: sub || '' } })); }catch(_){}
}

let stampTimer = null;
function stamp(big, small){
  if (!el.stampWrap) return;
  setText(el.stampBig, big || '');
  setText(el.stampSmall, small || '');
  el.stampWrap.classList.remove('show');
  // force reflow
  void el.stampWrap.offsetWidth;
  el.stampWrap.classList.add('show');
  clearTimeout(stampTimer);
  stampTimer = setTimeout(()=> el.stampWrap.classList.remove('show'), 760);
}

function gradeFromProgress(pct){
  // SSS, SS, S, A, B, C
  if (pct >= 95) return 'SSS';
  if (pct >= 88) return 'SS';
  if (pct >= 80) return 'S';
  if (pct >= 68) return 'A';
  if (pct >= 50) return 'B';
  return 'C';
}

function calcProgressPct(){
  // goals + minis + stability bonus
  const gPart = (S.goalsDone / GOALS_TOTAL) * 62;
  const mPart = (S.minisDone / MINIS_TOTAL) * 28;

  // stability = time spent in green overall
  const tPlayed = Math.max(1, DURATION - S.timeLeft);
  const stab = clamp((S._greenAll || 0) / Math.max(1, tPlayed), 0, 1) * 10;

  return clamp(Math.round(gPart + mPart + stab), 0, 100);
}

function updateMiniUI(){
  if (!el.miniCard) return;

  // storm in display
  const stormIn = (S.phase==='calm') ? Math.max(0, S.nextStormIn) :
                  (S.phase==='warn') ? 0 :
                  0;
  setText(el.miniStormIn, (S.phase==='storm') ? '0' : String(Math.ceil(stormIn)));

  // conditions
  const cStorm = (S.phase === 'storm');
  const cZone  = (S.zone !== 'GREEN');
  const cPress = (S.pressure >= S.pressureNeed);
  const cEnd   = inEndWindow();
  const cBlock = (S.minisDone >= 1); // shown as counter anyway

  setText(el.mvStorm, cStorm ? 'YES' : 'NO');
  setText(el.mvZone, S.zone);
  setText(el.mvPressure, `${Math.round(S.pressure)}% / ${S.pressureNeed}%`);
  setText(el.mvEnd, cEnd ? `YES (${S.stormLeft.toFixed(1)}s)` : '—');
  setText(el.mvBlock, `${S.minisDone}/${MINIS_TOTAL}`);

  // classes
  setMiniClass(el.mcStorm, cStorm);
  setMiniClass(el.mcZone,  cZone);
  setMiniClass(el.mcPressure, cPress);
  setMiniClass(el.mcEnd, cEnd);
  setMiniClass(el.mcBlock, S.minisDone > 0);

  // pressure bar
  const pp = clamp(S.pressure, 0, 100);
  setText(el.mPressurePct, String(Math.round(pp)));
  if (el.mPressureBar) el.mPressureBar.style.width = `${pp}%`;
}
function setMiniClass(row, ok){
  if (!row) return;
  row.classList.toggle('ok', !!ok);
  row.classList.toggle('bad', !ok && row.id!=='mini-c-end'); // end-window can be neutral
}

function updateUI(){
  // stats
  setText(el.score, S.score);
  setText(el.combo, S.combo);
  setText(el.comboMax, S.comboMax);
  setText(el.miss, S.miss);
  setText(el.time, Math.max(0, Math.ceil(S.timeLeft)));
  const prog = calcProgressPct();
  const grade = gradeFromProgress(prog);
  setText(el.grade, grade);

  // water
  setText(el.waterZone, S.zone);
  setText(el.waterPct, `${Math.round(S.water)}%`);
  if (el.waterBar){
    el.waterBar.style.width = `${clamp(S.water,0,100)}%`;
    // red bar if in low/high
    el.waterBar.classList.toggle('red', S.zone !== 'GREEN');
  }
  setText(el.shield, S.shield);
  setText(el.stormLeft, (S.phase==='storm') ? String(Math.ceil(S.stormLeft)) : '0');

  // quest lines
  const need = S.goalNeed;
  setText(el.q1, `อยู่ GREEN รวม ${Math.floor(S.greenHold)}s / ${need}s`);
  setText(el.q2, `น้ำตอนนี้ ${S.zone} • Score ${S.score} • Combo ${S.combo}`);
  const nextStorm = (S.phase==='calm')
    ? `Next storm in ~${Math.ceil(S.nextStormIn)}s`
    : (S.phase==='warn')
    ? `⚠️ Storm warning… ${S.warnLeft.toFixed(1)}s`
    : `🌪️ Storm! ${S.stormLeft.toFixed(1)}s`;
  setText(el.q3, `Mini (Storm): ใช้ Shield block BAD “ถูกจังหวะ” ${S.minisDone}/${MINIS_TOTAL} • ${nextStorm}`);
  setText(el.q4, `Goals done: ${S.goalsDone}/${GOALS_TOTAL} • Progress to S: ${calcProgressPct()}%`);

  // mini card
  updateMiniUI();

  // body fx classes by zone
  DOC.body.classList.toggle('fx-low', S.zone === 'LOW');
  DOC.body.classList.toggle('fx-high', S.zone === 'HIGH');
}

// ---------- Goal logic ----------
function tickGoal(dt){
  // Goal #1: hold GREEN for need seconds
  // Goal #2: after first storm has been seen+ended, hold GREEN again for need seconds
  const goalIndex = S.goalsDone; // 0 or 1
  const greenNow = (S.zone === 'GREEN');

  // keep total green time for stability
  S._greenAll = (S._greenAll || 0) + (greenNow ? dt : 0);

  // gate for goal#2: require stormSeen and currently not storm
  const goal2GateOK = (S.stormSeen && S.phase !== 'storm' && S.phase !== 'warn');

  const allowed =
    (goalIndex === 0) ? true :
    (goalIndex === 1) ? goal2GateOK : false;

  if (!allowed){
    // don't accumulate, but keep it from inflating weirdly
    S.greenHold = clamp(S.greenHold - (dt*1.6), 0, 999);
    return;
  }

  if (greenNow){
    S.greenHold += dt;
  }else{
    // decay faster in study
    const decay = isStudy ? 2.3 : 1.8;
    S.greenHold = clamp(S.greenHold - (dt*decay), 0, 999);
  }

  // ✅ reliable completion (>=) + latch
  if (S.greenHold + 1e-6 >= S.goalNeed){
    S.goalsDone += 1;
    stamp('🎯 GOAL CLEAR!', `Goals ${S.goalsDone}/${GOALS_TOTAL}`);
    playBeep(1040, 120, 0.07);

    // reset hold for next goal
    S.greenHold = 0;

    // coach
    if (S.goalsDone === 1){
      coachSay('ดีมาก! คุม GREEN ได้แล้ว', 'รอ Storm ผ่าน แล้วคุม GREEN อีกรอบ');
    }else if (S.goalsDone >= GOALS_TOTAL){
      coachSay('สุดยอด! คุมสมดุลน้ำได้ครบแล้ว', 'ไปต่อให้ได้เกรด SSS!');
    }
  }
}

// ---------- Loop ----------
function updateStorm(dt){
  if (S.phase === 'calm'){
    S.nextStormIn = Math.max(0, S.nextStormIn - dt);
    if (S.nextStormIn <= 0.001){
      startWarn();
    }
  }
  else if (S.phase === 'warn'){
    S.warnLeft = Math.max(0, S.warnLeft - dt);

    // warn amplitude + tick accel
    const total = isStudy ? 4.2 : 4.0;
    const p = clamp(1 - (S.warnLeft / total), 0, 1);
    S.warnAmp = p;
    DOC.body.style.setProperty('--warnamp', String(p));

    // tick acceleration: early slow -> late very fast
    const tickEvery = clamp(0.32 - p*0.22, 0.08, 0.32);
    S._tickAcc = (S._tickAcc || 0) + dt;
    if (S._tickAcc >= tickEvery){
      S._tickAcc = 0;
      playTick(22, 0.038 + p*0.02);
    }

    if (S.warnLeft <= 0.001){
      startStorm();
    }
  }
  else if (S.phase === 'storm'){
    S.stormLeft = Math.max(0, S.stormLeft - dt);

    // during storm: stronger shake intensity
    // (CSS class already applied; this just nudges warnamp off)
    DOC.body.style.setProperty('--warnamp', '0');

    if (S.stormLeft <= 0.001){
      endStorm();
    }
  }

  // storm warning class toggle for HTML overlay banner
  DOC.body.classList.toggle('storm-warn', S.phase === 'warn');
}

function updateTargets(dt){
  // float
  const t = now() * 0.001;
  for (const o of S.targets){
    if (!o || o.dead) continue;
    const wob = Number(o.el.dataset.wob || 1);
    const seed = Number(o.el.dataset.seed || 0);
    const fx = Math.sin(t * (1.35*wob) + seed) * 6;
    const fy = Math.cos(t * (1.10*wob) + seed*0.7) * 6;

    // Keep o.x/o.y in sync (for crosshair hit-test)
    const x = o.x + fx*0.35;
    const y = o.y + fy*0.35;

    o.el.style.left = x + 'px';
    o.el.style.top  = y + 'px';

    // glow pulse in storm
    if (S.phase === 'storm'){
      o.el.style.filter = 'saturate(1.1) brightness(1.04)';
    }else{
      o.el.style.filter = 'saturate(1.05)';
    }
  }
}

function spawnLogic(dt){
  const rate = spawnRatePerSec();
  // storm: higher spawn density
  const phaseMul =
    (S.phase === 'storm') ? 1.55 :
    (S.phase === 'warn')  ? 1.08 : 1.0;

  S.spawnBudget += rate * phaseMul * dt;

  // keep at least 1 orb visible early
  if (S.targets.filter(t=>t && !t.dead).length < 2 && S.timeLeft > 2){
    S.spawnBudget = Math.max(S.spawnBudget, 1);
  }

  while (S.spawnBudget >= 1){
    S.spawnBudget -= 1;
    spawnOne();
  }
}

function tick(dt){
  // 1) regression first to avoid “jump to 100”
  regressToMean(dt);

  // 2) zone compute (must happen BEFORE goal tick)
  S.zone = computeZone(S.water);

  // 3) storm + pressure
  updateStorm(dt);
  updatePressure(dt);

  // 4) spawn + move + expire
  spawnLogic(dt);
  updateTargets(dt);
  cullExpired();

  // 5) goal/quest tick (after zone ready)
  tickGoal(dt);

  // 6) UI
  updateUI();

  // time
  S.timeLeft = Math.max(0, S.timeLeft - dt);
  if (S.timeLeft <= 0.001){
    endGame('timeout');
  }
}

function loop(){
  if (!S.started) return;
  const t = now();
  const dt = Math.min(0.045, Math.max(0.001, (t - S.last) / 1000));
  S.last = t;
  tick(dt);
  requestAnimationFrame(loop);
}

// ---------- End / Summary ----------
function endGame(reason='timeout'){
  if (!S.started) return;
  S.started = false;

  // clean storm classes
  DOC.body.classList.remove('storm', 'storm-warn', 'fx-shake', 'fx-high', 'fx-low');
  DOC.body.style.setProperty('--warnamp', '0');

  // show end
  if (el.end){
    el.end.style.display = 'flex';
  }
  setText(el.endScore, S.score);
  const prog = calcProgressPct();
  const grade = gradeFromProgress(prog);
  setText(el.endGrade, grade);
  setText(el.endCombo, S.comboMax);
  setText(el.endMiss, S.miss);
  setText(el.endGoals, `${S.goalsDone}/${GOALS_TOTAL}`);
  setText(el.endMinis, `${S.minisDone}/${MINIS_TOTAL}`);

  stamp('🏁 จบเกม!', `เหตุผล: ${reason}`);

  // emit end event for logger compatibility
  try{
    window.dispatchEvent(new CustomEvent('hha:end', {
      detail:{
        reason,
        scoreFinal: S.score,
        comboMax: S.comboMax,
        misses: S.miss,
        goalsCleared: S.goalsDone,
        goalsTotal: GOALS_TOTAL,
        miniCleared: S.minisDone,
        miniTotal: MINIS_TOTAL,
        durationPlannedSec: DURATION,
        durationPlayedSec: DURATION - Math.max(0, S.timeLeft),
        waterEndPct: Math.round(S.water),
        runMode: RUN,
        diff: DIFF,
        seed: seedStr
      }
    }));
  }catch(_){}
}

// ---------- Start ----------
function start(){
  if (S.started) return;

  ensureAudio(); // arm audio after user gesture
  playBeep(880, 90, 0.06);

  S.started = true;
  S.t0 = now();
  S.last = S.t0;
  S.timeLeft = DURATION;

  // init storm schedule
  S.phase = 'calm';
  S.nextStormIn = randomNextStorm();

  // init UI
  coachSay('พร้อมแล้ว! เก็บน้ำดี 💧 คุม GREEN ให้เนียน', 'แตะกลางจอ = ยิง crosshair • Storm จะโหดขึ้นเรื่อย ๆ');
  updateUI();

  // hide overlay
  if (el.startOverlay) el.startOverlay.style.display = 'none';

  // kick loop
  requestAnimationFrame(loop);
}

// ---------- Boot ----------
(function boot(){
  if (!DOC || !el.playfield || !el.layer){
    console.warn('[HydrationVR] missing DOM nodes');
    return;
  }

  // ensure layer captures clicks on orbs
  el.layer.style.pointerEvents = 'none';

  // start overlay still allows buttons
  coachSay('แตะ START เพื่อเริ่ม', 'Mini quest จะโผล่ตอน Storm');

  bindInput();

  el.btnStart?.addEventListener('click', ()=>{
    start();
  }, { passive:true });

  // set initial water (stable)
  S.water = 50;
  S.zone = computeZone(S.water);

  updateUI();
})();
