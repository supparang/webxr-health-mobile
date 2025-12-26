'use strict';

// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION (BOSS COMPLETE)
// ✅ กระจายเป้าทั่วจอ: grid9 + spawnAroundCrosshair:false + minSeparation สูง
// ✅ VR-feel: gyro + drag
// ✅ Water Gauge + Fever + Shield
// ✅ Shield บล็อก junk/laser: บล็อกแล้ว "ไม่เป็น miss"
// ✅ Goal + Chain Mini quests
// ✅ Boss Lasers (3 patterns):
//    1) DOUBLE-SWEEP (2 เส้นสวนกัน + aim assist)
//    2) TRIPLE-WAVE (tele 3 เส้น/หลอก/จริง + gap ขยับ)
//    3) CROSS-STRIKE (สลับแนวตั้ง/แนวนอน + fake-out)
// ✅ 10s last: Tick-warning + edge pulse + shake scaling + beep (WebAudio)
// ✅ End Summary: Stamp grade + Count-up + logger

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { ensureFeverUI, setFever, setShield } from '../vr/ui-fever.js';
import { createHydrationQuest } from './hydration.quest.js';

// --------------------- Globals ---------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, edgePulse(){} };

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v)||0));
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function qs(k, d=''){
  try{
    const u = new URL(ROOT.location.href);
    const v = u.searchParams.get(k);
    return (v==null || v==='') ? d : v;
  }catch{ return d; }
}
function qn(k, d=0){
  const v = Number(qs(k,''));
  return Number.isFinite(v) ? v : d;
}
function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch{}
}
function fmtPct(n){
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

// --------------------- DOM refs ---------------------
const elApp = DOC.getElementById('appRoot');
const playfield = DOC.getElementById('playfield');
const layer = DOC.getElementById('hydr-layer');
const atkLayer = DOC.getElementById('atk-layer');
const warnOverlay = DOC.getElementById('warn-overlay');

const startOverlay = DOC.getElementById('startOverlay');
const btnStart  = DOC.getElementById('btnStart');
const btnSkip   = DOC.getElementById('btnSkip');
const btnMotion = DOC.getElementById('btnMotion');

const coachImg   = DOC.getElementById('coachImg');
const coachLine1 = DOC.getElementById('coachLine1');
const coachLine2 = DOC.getElementById('coachLine2');

const scoreText = DOC.getElementById('scoreText');
const comboText = DOC.getElementById('comboText');
const comboMaxText = DOC.getElementById('comboMaxText');
const missText = DOC.getElementById('missText');
const feverText = DOC.getElementById('feverText');
const shieldText = DOC.getElementById('shieldText');
const accText = DOC.getElementById('accText');

const goalTitle = DOC.getElementById('goalTitle');
const miniTitle = DOC.getElementById('miniTitle');
const goalProg = DOC.getElementById('goalProg');
const miniProg = DOC.getElementById('miniProg');
const liveGrade = DOC.getElementById('liveGrade');
const modeText = DOC.getElementById('modeText');
const diffText = DOC.getElementById('diffText');

const waterZoneText = DOC.getElementById('waterZoneText');
const waterFill = DOC.getElementById('waterBarFill');
const clockText = DOC.getElementById('clockText');

const endOverlay = DOC.getElementById('hvr-end');
const endScore = DOC.getElementById('endScore');
const endAcc = DOC.getElementById('endAcc');
const endComboMax = DOC.getElementById('endComboMax');
const endMiss = DOC.getElementById('endMiss');
const endGM = DOC.getElementById('endGM');
const endMeta = DOC.getElementById('endMeta');
const endTips = DOC.getElementById('endTips');
const endGrade = DOC.getElementById('endGrade');
const endStamp = DOC.getElementById('endStamp');

const btnRestart = DOC.getElementById('btnRestart');
const btnCloseEnd = DOC.getElementById('btnCloseEnd');

// --------------------- Config (URL) ---------------------
const runMode = String(qs('run', qs('runMode', 'play'))).toLowerCase();
const diff = String(qs('diff', 'normal')).toLowerCase();
const duration = clamp(qn('time', qn('duration', 60)), 20, 180);
const seed = qs('seed','');

modeText.textContent = runMode;
diffText.textContent = diff;

// --------------------- Game state ---------------------
const S = {
  started:false,
  ended:false,
  sessionId: qs('sessionId', `hydr-${Date.now()}`),

  t0: 0,
  secLeft: duration,

  score: 0,
  combo: 0,
  comboMax: 0,

  // miss definition: good expire + junk hit (shield block does NOT count)
  misses: 0,

  nSpawnGood: 0,
  nSpawnJunk: 0,
  nHitGood: 0,
  nHitJunk: 0,
  nHitJunkGuard: 0,
  nExpireGood: 0,

  fever: 0,     // 0..100
  shield: 0,    // charges 0..9
  stunnedUntil: 0,

  warn: {
    lastSec: null,
    ticking: false,
    pulse: 0
  },

  get accPct(){
    const denom = Math.max(1, (this.nHitGood + this.nExpireGood + this.nHitJunk));
    return (this.nHitGood / denom) * 100;
  }
};

// --------------------- UI helpers ---------------------
function setCoach(mood, line1, line2){
  if (mood === 'happy') coachImg.src = '../img/coach-happy.png';
  else if (mood === 'sad') coachImg.src = '../img/coach-sad.png';
  else if (mood === 'fever') coachImg.src = '../img/coach-fever.png';
  else coachImg.src = '../img/coach-neutral.png';

  if (line1) coachLine1.textContent = line1;
  if (line2) coachLine2.textContent = line2;
  dispatch('hha:coach', { mood, line1, line2 });
}

function shake(px, ms=140){
  try{
    DOC.documentElement.style.setProperty('--shake', `${px}px`);
    ROOT.setTimeout(()=> DOC.documentElement.style.setProperty('--shake', `0px`), ms);
  }catch{}
}
function edgeGlow(v){
  try{ DOC.documentElement.style.setProperty('--edgeGlow', String(clamp(v,0,1))); }catch{}
}
function warnPulse(v){
  const vv = clamp(v,0,1);
  try{
    DOC.documentElement.style.setProperty('--warnPulse', String(vv));
    if (warnOverlay){
      if (vv > 0.02) warnOverlay.classList.add('on');
      else warnOverlay.classList.remove('on');
    }
  }catch{}
}

function feverStormOn(){
  return S.fever >= 72;
}

function addScore(delta, x, y){
  S.score = Math.max(0, S.score + delta);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    try{ Particles.scorePop(x, y, (delta>=0?`+${delta}`:`${delta}`)); }catch{}
  }
}

function applyCombo(){
  if (S.combo > S.comboMax) S.comboMax = S.combo;
  try{ QUEST.setCombo(S.combo); }catch{}
}
function incCombo(){
  S.combo++;
  applyCombo();
}
function breakCombo(){
  S.combo = 0;
  applyCombo();
}

function addFever(delta){
  S.fever = clamp(S.fever + delta, 0, 100);
  setFever(S.fever);
}

function addMiss(reason){
  // miss = good expire + junk hit (shield block not count)
  S.misses++;
  breakCombo();
  addFever(reason==='junk' ? 14 : 10);
  if (S.fever >= 90) setCoach('fever', 'ระวัง! ไข้ขึ้นแล้ว!', 'หลบเลเซอร์/อย่าโดนขยะ และเก็บน้ำดีให้ต่อเนื่อง');
}

function addShield(n=1){
  S.shield = clamp(S.shield + n, 0, 9);
  setShield(S.shield);
}
function consumeShield(){
  if (S.shield <= 0) return false;
  S.shield--;
  setShield(S.shield);
  return true;
}

function stun(ms=650){
  S.stunnedUntil = Math.max(S.stunnedUntil, nowMs() + ms);
  setCoach('fever', 'โดนเลเซอร์!', 'ตั้งสติ แล้วหาช่องปลอดภัย (Gap) ให้ทัน');
  shake(6, 210);
}

// --------------------- HUD ---------------------
function computeGrade(score, acc, misses){
  const a = Number.isFinite(acc) ? acc : 0;
  const s = Number.isFinite(score) ? score : 0;
  const m = Number.isFinite(misses) ? misses : 999;

  const scoreGate =
    (s >= 900) ? 4 :
    (s >= 700) ? 3 :
    (s >= 520) ? 2 :
    (s >= 360) ? 1 : 0;

  const accGate =
    (a >= 92) ? 4 :
    (a >= 86) ? 3 :
    (a >= 78) ? 2 :
    (a >= 66) ? 1 : 0;

  const missGate =
    (m <= 1) ? 4 :
    (m <= 3) ? 3 :
    (m <= 6) ? 2 :
    (m <= 10) ? 1 : 0;

  const total = scoreGate + accGate + missGate;

  if (total >= 11) return 'SSS';
  if (total >= 9)  return 'SS';
  if (total >= 7)  return 'S';
  if (total >= 5)  return 'A';
  if (total >= 3)  return 'B';
  return 'C';
}
function computeGradeLive(){
  return computeGrade(S.score, S.accPct, S.misses);
}

function hud(){
  scoreText.textContent = String(Math.max(0, Math.round(S.score)));
  comboText.textContent = String(S.combo);
  comboMaxText.textContent = String(S.comboMax);
  missText.textContent = String(S.misses);
  feverText.textContent = `${Math.round(S.fever)}%`;
  shieldText.textContent = String(S.shield);
  accText.textContent = fmtPct(S.accPct);

  liveGrade.textContent = computeGradeLive();

  dispatch('hha:score', {
    sessionId: S.sessionId,
    game: 'hydration',
    score: S.score,
    combo: S.combo,
    comboMax: S.comboMax,
    misses: S.misses,
    fever: S.fever,
    shield: S.shield,
    accuracyGoodPct: S.accPct
  });
}

// --------------------- VR-feel: gyro + drag ---------------------
function attachVRFeel(){
  let dragging = false;
  let sx=0, sy=0, bx=0, by=0;

  let pfX = 0, pfY = 0, pfRX = 0, pfRY = 0;

  function apply(){
    DOC.documentElement.style.setProperty('--pfX', `${pfX.toFixed(1)}px`);
    DOC.documentElement.style.setProperty('--pfY', `${pfY.toFixed(1)}px`);
    DOC.documentElement.style.setProperty('--pfRX', `${pfRX.toFixed(2)}deg`);
    DOC.documentElement.style.setProperty('--pfRY', `${pfRY.toFixed(2)}deg`);
  }

  playfield.addEventListener('pointerdown', (e)=>{
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    bx = pfX; by = pfY;
  }, { passive:true });

  ROOT.addEventListener('pointermove', (e)=>{
    if (!dragging) return;
    const dx = (e.clientX - sx);
    const dy = (e.clientY - sy);
    pfX = clamp(bx + dx*0.18, -70, 70);
    pfY = clamp(by + dy*0.18, -70, 70);
    apply();
  }, { passive:true });

  ROOT.addEventListener('pointerup', ()=>{ dragging = false; }, { passive:true });

  function onOri(e){
    if (!e) return;
    const beta = Number(e.beta)||0;
    const gamma = Number(e.gamma)||0;
    pfRX = clamp((beta-10) * 0.06, -6, 6);
    pfRY = clamp((gamma) * 0.08, -7, 7);
    apply();
  }

  async function requestMotion(){
    try{
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
        const r = await DeviceOrientationEvent.requestPermission();
        if (r === 'granted'){
          ROOT.addEventListener('deviceorientation', onOri, { passive:true });
          setCoach('happy', 'Motion เปิดแล้ว!', 'เอียงเครื่องเพื่อ VR-feel ได้เลย ✨');
        }
      } else {
        ROOT.addEventListener('deviceorientation', onOri, { passive:true });
        setCoach('happy', 'Motion พร้อม!', 'เอียงเครื่องเพื่อ VR-feel ได้เลย ✨');
      }
    }catch{
      setCoach('sad', 'ขอสิทธิ์ Motion ไม่สำเร็จ', 'เล่นแบบลากจอได้เหมือนเดิมนะ');
    }
  }
  btnMotion.addEventListener('click', requestMotion);
  return { requestMotion };
}

// --------------------- Water + Fever UI init ---------------------
ensureWaterGauge({ textEl: waterZoneText, fillEl: waterFill });
setWaterGauge(50);

ensureFeverUI();
setFever(0);
setShield(0);

// --------------------- Quest system ---------------------
const QUEST = createHydrationQuest({
  onUpdate: (q) => {
    goalTitle.textContent = q.goalTitle || '—';
    miniTitle.textContent = q.miniTitle || '—';
    goalProg.textContent = `${q.goalsCleared||0}/${q.goalsTotal||0}`;
    miniProg.textContent = `${q.minisCleared||0}/${q.miniTotal||0}`;
    dispatch('quest:update', q);
  },
  onCelebrate: (kind, payload) => {
    try{ Particles.celebrate(kind, payload || {}); }catch{}
    setCoach('happy', 'เยี่ยม!', kind === 'goal' ? 'ผ่าน Goal แล้ว ไปต่อ!' : 'Mini สำเร็จ! คอมโบต่อเนื่องไว้!');
  }
});

// --------------------- WebAudio beep (tick warning) ---------------------
let audioCtx = null;
function beep(freq=880, durMs=60, vol=0.06){
  try{
    if (!audioCtx) audioCtx = new (ROOT.AudioContext || ROOT.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = vol;

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t0);
    osc.stop(t0 + durMs/1000);

    // tiny decay
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs/1000);
  }catch{}
}

// --------------------- FX CSS for lasers (IIFE style in-file) ---------------------
function attachHydrationFxCss(){
  if (DOC.getElementById('hydr-fx-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hydr-fx-style';
  s.textContent = `
    .atk-host{ position:absolute; inset:0; pointer-events:none; z-index:40; }
    .hvr-beam{
      position:absolute;
      left:50%; top:52%;
      width:min(1200px, 160vw);
      height: 110px;
      transform: translate(-50%,-50%) rotate(0deg);
      transform-origin: 50% 50%;
      border-radius:999px;
      opacity:0;
      will-change: transform, opacity;
    }
    .hvr-beam .core{
      position:absolute; inset:0;
      border-radius:999px;
      background:
        linear-gradient(90deg,
          rgba(244,63,94,.05) 0%,
          rgba(244,63,94,.18) 26%,
          rgba(56,189,248,.14) 50%,
          rgba(244,63,94,.18) 74%,
          rgba(244,63,94,.05) 100%);
      box-shadow:
        0 0 0 1px rgba(148,163,184,.05),
        0 0 30px rgba(56,189,248,.18),
        0 0 34px rgba(244,63,94,.12);
    }
    .hvr-beam.tele.show{
      opacity: .62;
      animation: telePulse .42s ease-in-out infinite;
    }
    @keyframes telePulse{
      0%{ filter: blur(.0px) saturate(1.05); }
      50%{ filter: blur(.9px) saturate(1.10); }
      100%{ filter: blur(.0px) saturate(1.05); }
    }
    .hvr-beam.fire{
      opacity:.92;
      animation: fireFlicker .14s linear infinite;
    }
    @keyframes fireFlicker{
      0%{ filter: blur(.0px) saturate(1.10); }
      50%{ filter: blur(.6px) saturate(1.18); }
      100%{ filter: blur(.0px) saturate(1.10); }
    }
    .hvr-beam.decoy{
      opacity:.34;
      filter: blur(1.1px) saturate(.95);
    }

    /* GAP */
    .hvr-beam.gap{ --gapPos: 0; --gapH: 18px; }
    .hvr-beam.gap .core{
      position:absolute; inset:0;
      border-radius:999px;
      overflow:hidden;
      background:none !important;
    }
    .hvr-beam.gap .coreA, .hvr-beam.gap .coreB{
      position:absolute; left:0; right:0;
      background:
        linear-gradient(90deg,
          rgba(244,63,94,.06) 0%,
          rgba(244,63,94,.22) 25%,
          rgba(56,189,248,.18) 50%,
          rgba(244,63,94,.22) 75%,
          rgba(244,63,94,.06) 100%);
      filter: blur(.1px) saturate(1.05);
    }
    .hvr-beam.gap .gap{
      position:absolute; left:0; right:0;
      height: var(--gapH);
      top: calc(50% + var(--gapPos) - (var(--gapH) / 2));
      box-shadow:
        inset 0 1px 0 rgba(56,189,248,.55),
        inset 0 -1px 0 rgba(244,63,94,.55),
        0 0 14px rgba(56,189,248,.18),
        0 0 18px rgba(244,63,94,.14);
    }
    .hvr-beam.gap .coreA{ top:0; bottom: calc(50% + var(--gapPos) + (var(--gapH) / 2)); }
    .hvr-beam.gap .coreB{ top:   calc(50% + var(--gapPos) + (var(--gapH) / 2)); bottom:0; }
  `;
  DOC.head.appendChild(s);
}
attachHydrationFxCss();

function ensureAtkHost(){
  let host = atkLayer.querySelector('.atk-host');
  if (host) return host;
  host = DOC.createElement('div');
  host.className = 'atk-host';
  atkLayer.appendChild(host);
  return host;
}

const ATK = {
  host: ensureAtkHost(),
  beams: [],   // active beams (real + decoy)
  lastDamageAt: 0,
  nextSpawnAt: 0
};

function makeBeamEl(cls=''){
  const el = DOC.createElement('div');
  el.className = `hvr-beam ${cls}`.trim();
  el.innerHTML = `<div class="core"></div>`;
  ATK.host.appendChild(el);
  return el;
}
function ensureGapStructure(el){
  if (!el || el.__gapReady) return;
  const core = el.querySelector('.core');
  if (!core) return;
  core.innerHTML = `<div class="coreA"></div><div class="gap"></div><div class="coreB"></div>`;
  el.__gapReady = true;
}

function getCrosshairClient(){
  const x = (ROOT.innerWidth || 1) * 0.5;
  const y = (ROOT.innerHeight || 1) * 0.52;
  return { x, y };
}
function getCrosshairLayerLocal(){
  const r = playfield.getBoundingClientRect();
  const c = getCrosshairClient();
  return { x: c.x - r.left, y: c.y - r.top, rect: r };
}
function pointToBeamSpace(px, py, beam){
  const ang = (beam.angle * Math.PI) / 180;
  const cx = beam.center.x, cy = beam.center.y;
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(-ang);
  const sin = Math.sin(-ang);
  const x = dx*cos - dy*sin;
  const y = dx*sin + dy*cos;
  return { x, y };
}
function aimAssistK(beam){
  const base = 0.028;
  const feverMul = 1 + (S.fever/100) * 1.35;
  let k = base * feverMul;
  k = clamp(k, 0.02, 0.090);
  if (beam.variant === 'sweep') k *= 0.70;
  if (beam.variant === 'cross') k *= 0.78;
  return k;
}

function killAllBeams(){
  ATK.beams.forEach(b=>{
    b.dead = true;
    try{ b.el && b.el.remove(); }catch{}
  });
  ATK.beams.length = 0;
  edgeGlow(0);
}

function makeBeam(opts){
  const b = {
    id: `b_${Math.random().toString(16).slice(2)}`,
    dead:false,

    variant: opts.variant || 'gap', // gap | sweep | cross
    isDecoy: !!opts.isDecoy,
    phase: 'tele',
    teleMs: opts.teleMs || 900,
    fireMs: opts.fireMs || 1200,

    width: opts.width || 110,
    angle: opts.angle || 0,
    sweepDir: opts.sweepDir || 1,
    sweepSpeed: opts.sweepSpeed || 50,

    // gap
    gapH: opts.gapH || 18,
    gapPos: 0,
    gapVel: opts.gapVel || 160,

    // anchor
    center: opts.center || { x:(playfield.clientWidth||1)*0.5, y:(playfield.clientHeight||1)*0.52 },

    // damage
    damageCdMs: opts.damageCdMs || 420,

    // DOM
    el: null,

    // timing
    born: nowMs(),
    lastTs: 0,
    tEnd: 0
  };

  const cls = `${b.variant} tele show${b.isDecoy ? ' decoy':''}`;
  b.el = makeBeamEl(cls);

  if (b.variant === 'gap'){
    b.el.classList.add('gap');
    ensureGapStructure(b.el);
    b.el.style.setProperty('--gapH', b.gapH + 'px');
    b.el.style.setProperty('--gapPos', '0px');
  }

  // initial transform
  b.el.style.height = b.width + 'px';
  b.el.style.left = b.center.x + 'px';
  b.el.style.top  = b.center.y + 'px';
  b.el.style.transform = `translate(-50%,-50%) rotate(${b.angle.toFixed(2)}deg)`;

  ATK.beams.push(b);

  // tele -> fire
  ROOT.setTimeout(()=> beamToFire(b), b.teleMs);

  return b;
}

function beamToFire(b){
  if (!b || b.dead) return;
  b.phase = 'fire';
  b.tEnd = nowMs() + b.fireMs;

  try{
    b.el.classList.remove('tele');
    b.el.classList.add('fire');
  }catch{}

  // gap motion
  if (b.variant === 'gap'){
    const storm = feverStormOn();
    b.gapH = storm ? 16 : b.gapH;
    b.gapVel = (storm ? 220 : b.gapVel) * (Math.random()<0.5?-1:1);
    b.el.style.setProperty('--gapH', b.gapH + 'px');
  }

  tickBeams();
}

let beamsTicking = false;
function tickBeams(){
  if (beamsTicking) return;
  beamsTicking = true;

  function raf(){
    if (S.ended){ beamsTicking=false; return; }

    const t = nowMs();
    const active = ATK.beams.filter(b=>!b.dead);

    if (!active.length){
      beamsTicking=false;
      edgeGlow(0);
      return;
    }

    // glow while beams present
    edgeGlow(feverStormOn() ? 1 : 0.55);

    for (const b of active){
      const dt = b.lastTs ? clamp((t - b.lastTs)/1000, 0, 0.05) : 0.016;
      b.lastTs = t;

      // update motion
      beamUpdate(b, dt);

      // damage check only for real beams (not decoy)
      if (!b.isDecoy) beamDamageCheck(b);

      // end
      if (b.phase === 'fire' && t >= b.tEnd){
        b.dead = true;
        try{ b.el.remove(); }catch{}
      }
    }

    // cleanup
    ATK.beams = ATK.beams.filter(b=>!b.dead);

    ROOT.requestAnimationFrame(raf);
  }
  ROOT.requestAnimationFrame(raf);
}

function beamUpdate(b, dt){
  if (!b || b.dead || !b.el) return;
  const storm = feverStormOn();

  // sweep angle for sweep variant
  if (b.variant === 'sweep'){
    b.angle += b.sweepDir * b.sweepSpeed * dt;
    const lim = storm ? 66 : 56;
    if (b.angle > lim){ b.angle = lim; b.sweepDir *= -1; }
    if (b.angle < -lim){ b.angle = -lim; b.sweepDir *= -1; }
  }

  // cross strike: "snap" angle drift slightly between 0 and 90
  if (b.variant === 'cross'){
    // keep angle near target
    const snap = (Math.abs(b.angle) < 1) ? 0 : 90;
    const target = (Math.random() < 0.012) ? (snap === 0 ? 90 : 0) : snap;
    b.angle += (target - b.angle) * clamp(dt*2.4, 0, 1);
  }

  // aim follow crosshair
  const p = getCrosshairLayerLocal();
  const k = aimAssistK(b);
  const maxStep = ((storm ? 92 : 66) * dt) * (b.variant === 'sweep' ? 1.12 : 1.0);
  const dx = (p.x - b.center.x);
  const dy = (p.y - b.center.y);
  b.center.x += clamp(dx * k, -maxStep, maxStep);
  b.center.y += clamp(dy * k, -maxStep, maxStep);

  // apply
  b.el.style.left = b.center.x + 'px';
  b.el.style.top  = b.center.y + 'px';
  const j = storm ? ((Math.random()*2-1)*0.7) : 0;
  b.el.style.transform = `translate(-50%,-50%) rotate(${(b.angle + j).toFixed(2)}deg)`;

  // moving gap
  if (b.variant === 'gap' && b.phase === 'fire'){
    const amp = storm ? 28 : 20;
    const bias = clamp((p.y - b.center.y) * 0.08, -12, 12);
    b.gapPos += b.gapVel * dt;

    if (b.gapPos > amp){ b.gapPos = amp; b.gapVel *= -1; }
    if (b.gapPos < -amp){ b.gapPos = -amp; b.gapVel *= -1; }

    const jitter = storm ? ((Math.random()*2-1) * 2.0) : ((Math.random()*2-1) * 1.0);
    const pos = clamp(b.gapPos + bias + jitter, -amp, amp);
    b.el.style.setProperty('--gapPos', pos.toFixed(2) + 'px');
  }
}

function beamDamageCheck(b){
  if (!b || b.dead || b.phase !== 'fire') return;
  if (S.ended) return;

  const t = nowMs();
  if (t - ATK.lastDamageAt < b.damageCdMs) return;

  const p = getCrosshairLayerLocal();
  const bp = pointToBeamSpace(p.x, p.y, b);
  const halfH = (b.width || 110) / 2;
  const inside = Math.abs(bp.y) <= halfH;
  if (!inside) return;

  // gap safe slit
  if (b.variant === 'gap'){
    const gapPosPx = parseFloat(b.el.style.getPropertyValue('--gapPos')) || 0;
    const gapH = b.gapH || 18;
    const safe = Math.abs(bp.y - gapPosPx) <= (gapH/2);
    if (safe) return;
  }

  // HIT
  ATK.lastDamageAt = t;

  // Shield blocks laser — not miss
  if (consumeShield()){
    S.nHitJunkGuard++;
    try{ QUEST.onSpecial('shieldBlock'); }catch{}
    dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'shield_block', data:{ kind:'laser', variant:b.variant }});
    try{ Particles.burstAt(p.rect.left + p.x, p.rect.top + p.y, 'shield'); }catch{}
    shake(3, 120);
    addFever(4);
    hud();
    return;
  }

  // damage (not miss)
  addFever(storm ? 12 : 9);
  addScore(-6, p.rect.left + p.x, p.rect.top + p.y);
  stun(520);

  dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'laser_hit', data:{ variant:b.variant }});

  if (S.fever >= 100){
    addMiss('laser');
    addScore(-14, p.rect.left + p.x, p.rect.top + p.y);
    setCoach('sad', 'โอ๊ย! ไข้พุ่งสุด!', 'ช้า ๆ แต่ชัวร์ เข้า Gap แล้วค่อยยิง');
    shake(8, 200);
  }

  hud();
}

// --------------------- Boss patterns ---------------------
function bossCooldownMs(){
  // tougher when storm; also slightly tougher in hard
  const storm = feverStormOn();
  const base = (diff === 'hard') ? 5600 : (diff === 'easy' ? 7600 : 6600);
  return storm ? Math.max(4200, base - 1400) : base;
}
function canSpawnBoss(){
  const t = nowMs();
  return t >= ATK.nextSpawnAt && ATK.beams.length === 0 && t >= (S.stunnedUntil || 0);
}

function scheduleNextBoss(){
  ATK.nextSpawnAt = nowMs() + bossCooldownMs();
}

function spawnBoss(){
  if (!S.started || S.ended) return;
  if (!canSpawnBoss()) return;

  const storm = feverStormOn();
  const center = { x:(playfield.clientWidth||1)*0.5, y:(playfield.clientHeight||1)*0.52 };

  // choose pattern
  const r = Math.random();
  let pattern = 'doubleSweep';
  if (r < 0.34) pattern = 'doubleSweep';
  else if (r < 0.72) pattern = 'tripleWave';
  else pattern = 'crossStrike';

  dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'boss_spawn', data:{ pattern, storm }});

  if (pattern === 'doubleSweep'){
    setCoach('fever', 'บอส: DOUBLE-SWEEP!', '2 เส้นสวนกัน — อ่านจังหวะแล้ว “เข้า Gap”');
    // tele decoys
    makeBeam({ variant:'sweep', isDecoy:true, teleMs: 720, fireMs: 650, width: storm?118:110, angle: (Math.random()*60-30), sweepDir: 1, sweepSpeed: storm?74:56, center:{...center} });
    makeBeam({ variant:'sweep', isDecoy:true, teleMs: 720, fireMs: 650, width: storm?118:110, angle: (Math.random()*60-30), sweepDir:-1, sweepSpeed: storm?74:56, center:{...center} });
    // real beams
    makeBeam({ variant:'gap', teleMs: storm?720:920, fireMs: storm?1500:1350, width: storm?122:112, angle: (Math.random()*50-25), gapH: storm?16:18, center:{...center} });
    makeBeam({ variant:'sweep', teleMs: storm?720:920, fireMs: storm?1500:1350, width: storm?120:110, angle: (Math.random()*50-25), sweepDir: (Math.random()<0.5?-1:1), sweepSpeed: storm?72:54, center:{...center} });
  }

  if (pattern === 'tripleWave'){
    setCoach('fever', 'บอส: TRIPLE-WAVE!', 'มี 3 คลื่น — บางเส้นหลอก (Decoy) ช่องปลอดภัยขยับ!');
    // 3 waves spaced
    const tele = storm ? 620 : 860;
    const fire = storm ? 1180 : 1100;
    const baseAng = (Math.random()*60 - 30);

    // wave 1: decoy
    makeBeam({ variant:'gap', isDecoy:true, teleMs: tele, fireMs: fire, width: storm?118:108, angle: baseAng - 18, gapH: storm?16:18, center:{...center} });

    // wave 2: REAL
    ROOT.setTimeout(()=>{
      if (S.ended) return;
      makeBeam({ variant:'gap', teleMs: tele, fireMs: storm?1500:1320, width: storm?124:112, angle: baseAng + 4, gapH: storm?16:18, center:{...center} });
      // little fake sweep alongside
      makeBeam({ variant:'sweep', isDecoy:true, teleMs: tele, fireMs: 820, width: storm?112:104, angle: baseAng + 22, sweepDir: 1, sweepSpeed: storm?78:58, center:{...center} });
    }, 420);

    // wave 3: decoy cross
    ROOT.setTimeout(()=>{
      if (S.ended) return;
      makeBeam({ variant:'cross', isDecoy:true, teleMs: tele, fireMs: fire, width: storm?116:108, angle: 90, center:{...center} });
    }, 780);
  }

  if (pattern === 'crossStrike'){
    setCoach('fever', 'บอส: CROSS-STRIKE!', 'สลับแนวตั้ง/แนวนอน — อย่ายืนกลางเส้นนาน!');
    const tele = storm ? 680 : 920;
    const fire = storm ? 1450 : 1300;

    // tele fake-out: two decoys
    makeBeam({ variant:'cross', isDecoy:true, teleMs: tele, fireMs: 760, width: storm?112:104, angle: 0,  center:{...center} });
    makeBeam({ variant:'cross', isDecoy:true, teleMs: tele, fireMs: 760, width: storm?112:104, angle: 90, center:{...center} });

    // real: one cross + one gap
    makeBeam({ variant:'cross', teleMs: tele, fireMs: fire, width: storm?124:112, angle: (Math.random()<0.5?0:90), center:{...center} });
    makeBeam({ variant:'gap',  teleMs: tele, fireMs: fire, width: storm?122:112, angle: (Math.random()*50-25), gapH: storm?16:18, center:{...center} });
  }

  scheduleNextBoss();
}

// --------------------- End overlay helpers ---------------------
function countUp(el, from, to, ms=900, suffix=''){
  from = Number(from)||0;
  to = Number(to)||0;
  const t0 = nowMs();
  function easeOutCubic(x){ return 1 - Math.pow(1-x, 3); }
  function tick(){
    const t = nowMs();
    const p = clamp((t - t0)/ms, 0, 1);
    const v = from + (to - from) * easeOutCubic(p);
    el.textContent = `${Math.round(v)}${suffix}`;
    if (p < 1) ROOT.requestAnimationFrame(tick);
  }
  ROOT.requestAnimationFrame(tick);
}
function showEnd(){ endOverlay.classList.add('show'); }
function hideEnd(){ endOverlay.classList.remove('show'); }

btnCloseEnd.addEventListener('click', hideEnd);
btnRestart.addEventListener('click', ()=> ROOT.location.reload());

// --------------------- Finalize ---------------------
function finalize(reason='timeup'){
  if (S.ended) return;
  S.ended = true;

  // stop beams
  killAllBeams();
  warnPulse(0);
  edgeGlow(0);

  const acc = S.accPct;
  const grade = computeGrade(S.score, acc, S.misses);

  endScore.textContent = '0';
  endAcc.textContent = '—';
  endComboMax.textContent = String(S.comboMax);
  endMiss.textContent = String(S.misses);
  endGM.textContent = `${QUEST.goalsCleared}/${QUEST.goalsTotal} • ${QUEST.minisCleared}/${QUEST.miniTotal}`;
  endMeta.textContent = `Diff: ${diff} • Time: ${duration}s • Mode: ${runMode}`;
  endGrade.textContent = grade;

  endStamp.classList.remove('ink');
  ROOT.setTimeout(()=> endStamp.classList.add('ink'), 40);

  countUp(endScore, 0, S.score, 950, '');
  ROOT.setTimeout(()=> { endAcc.textContent = fmtPct(acc); }, 520);

  const tips = [];
  if (S.misses <= 2) tips.push('✅ Miss น้อยมาก — โฟกัสดีสุด ๆ');
  if (acc >= 90) tips.push('🎯 Accuracy ยืนพื้นระดับท็อป');
  if (S.comboMax >= 18) tips.push('🔥 คอมโบยาวมาก — จังหวะนิ่ง!');
  if (S.fever >= 85) tips.push('⚠️ บอสโหด — ครั้งหน้า “เข้า Gap” ก่อน แล้วค่อยยิง');
  if (!tips.length) tips.push('เล่นอีกรอบแล้วอ่านแพทเทิร์นเลเซอร์ให้ทัน!');
  endTips.textContent = tips.join('\n');

  showEnd();

  dispatch('hha:end', {
    sessionId: S.sessionId,
    game: 'hydration',
    mode: runMode,
    diff,
    reason,

    scoreFinal: Math.round(S.score),
    comboMax: S.comboMax,
    misses: S.misses,

    goalsCleared: QUEST.goalsCleared,
    goalsTotal: QUEST.goalsTotal,
    miniCleared: QUEST.minisCleared,
    miniTotal: QUEST.miniTotal,

    nTargetGoodSpawned: S.nSpawnGood,
    nTargetJunkSpawned: S.nSpawnJunk,
    nHitGood: S.nHitGood,
    nHitJunk: S.nHitJunk,
    nHitJunkGuard: S.nHitJunkGuard,
    nExpireGood: S.nExpireGood,

    accuracyGoodPct: acc
  });
}

// --------------------- Tick-warning last 10 seconds ---------------------
function updateEndgameWarning(){
  if (!S.started || S.ended) return;

  const sec = Math.max(0, S.secLeft|0);
  const last = S.warn.lastSec;

  // only act when second changed
  if (last === sec) return;
  S.warn.lastSec = sec;

  if (sec <= 10 && sec > 0){
    // pulse intensity grows as time runs out
    const intensity = clamp((11 - sec) / 10, 0, 1); // 0..1
    S.warn.pulse = intensity;

    // visual
    warnPulse(0.25 + intensity*0.75);

    // sound tick
    const f = 720 + (10-sec)*38;
    beep(f, 55, 0.05 + intensity*0.05);

    // micro shake scaling
    shake(1 + Math.round(intensity*4), 80 + Math.round(intensity*50));

    // coach prompt at key moments
    if (sec === 10) setCoach('fever', '10 วิสุดท้าย!', 'อย่าพลาดโดนขยะ/เลเซอร์ — รักษาคอมโบ!');
    if (sec === 5)  setCoach('fever', '5 วิสุดท้าย!', 'เร็ว แต่แม่น! เข้า Gap แล้วค่อยยิง!');
  }

  if (sec === 0){
    warnPulse(0);
  }
}

// --------------------- Start game ---------------------
async function startGame(){
  if (S.started) return;
  S.started = true;
  S.t0 = nowMs();
  S.secLeft = duration;
  S.warn.lastSec = null;

  startOverlay.style.display = 'none';
  setCoach('neutral', 'ไป!', 'โฟกัสน้ำดี และอ่านแพทเทิร์นบอสให้ทัน');
  hud();

  dispatch('hha:log_session', {
    sessionId: S.sessionId,
    game: 'hydration',
    mode: runMode,
    diff,
    seed
  });

  // time from engine
  ROOT.addEventListener('hha:time', (e)=>{
    const sec = (e && e.detail && typeof e.detail.sec === 'number') ? e.detail.sec : null;
    if (sec == null) return;
    S.secLeft = sec;
    clockText.textContent = String(sec);
    updateEndgameWarning();
    if (sec <= 0) finalize('timeup');
  });

  // dynamic spawn interval multiplier by fever
  function spawnMul(){
    if (S.ended) return 999;
    const f = S.fever;
    if (f >= 85) return 0.62;
    if (f >= 72) return 0.72;
    if (f >= 55) return 0.86;
    return 1.0;
  }

  // Boot factory (spread full screen)
  const spawner = await factoryBoot({
    difficulty: diff,
    duration,
    modeKey: 'hydration',

    pools: {
      good: ['💧','🚰','🫧','🥛'],
      bad:  ['🥤','🧋','🧃','🍭'],
      trick:['💧']
    },
    goodRate: 0.62,

    powerups: ['🛡️','⭐','💎'],
    powerRate: 0.14,
    powerEvery: 6,

    // spread
    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',
    minSeparation: 1.18,
    maxSpawnTries: 18,

    spawnHost: '#hydr-layer',
    boundsHost: '#playfield',

    spawnIntervalMul: spawnMul,

    excludeSelectors: [
      '#hha-water-header',
      '#hha-card-left',
      '#hha-card-right',
      '.bottomRow',
      '#hvr-crosshair',
      '#hvr-end'
    ],

    decorateTarget: (el, parts, data) => {
      const delay = (Math.random()*1.2).toFixed(2);
      try{ parts.wiggle.style.animationDelay = `${delay}s`; }catch{}

      // log spawn sparsely
      const kind = String(data.itemType || (data.isGood ? 'good' : 'junk'));
      if (kind === 'good' || kind === 'fakeGood') S.nSpawnGood++;
      if (kind === 'junk') S.nSpawnJunk++;
      dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'spawn', data:{ kind }});
    },

    onExpire: ({ ch, itemType }) => {
      if (S.ended) return;

      if (itemType === 'good' || itemType === 'fakeGood'){
        S.nExpireGood++;
        addMiss('expire');

        dispatch('hha:log_event', {
          sessionId: S.sessionId,
          game:'hydration',
          type:'miss_expire',
          data:{ ch, kind:'good' }
        });

        setCoach('sad', 'พลาดแล้ว!', 'รีบเก็บน้ำดีให้ทันก่อนหมดเวลา');
        hud();
      }
    },

    judge: (ch, ctx) => {
      if (S.ended) return { scoreDelta: 0, good:false };
      if (nowMs() < S.stunnedUntil) return { scoreDelta: 0, good:false };

      const x = ctx.clientX || 0;
      const y = ctx.clientY || 0;

      const kind = ctx.itemType || (ctx.isGood ? 'good' : 'junk');
      const isFake = (kind === 'fakeGood');
      const isPower = !!ctx.isPower;
      const isGood = (!!ctx.isGood) && !isFake && (kind === 'good');

      const perfect = !!ctx.hitPerfect;
      const perfectBonus = perfect ? 5 : 0;

      // powerups
      if (isPower){
        if (ch === '🛡️'){
          addShield(1);
          addScore(10, x, y);
          incCombo();
          addFever(-6);
          setCoach('happy', 'ได้โล่!', 'โล่บล็อกขยะ/เลเซอร์ (บล็อกแล้วไม่เป็น miss)');
          dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'hit', data:{ kind:'shield', ch }});
          try{ Particles.burstAt(x,y,'shield'); }catch{}
          hud();
          try{ QUEST.onHit({ kind:'power', good:true, perfect }); }catch{}
          return { scoreDelta: 10, good:true };
        }
        if (ch === '⭐'){
          addScore(18, x, y);
          incCombo(); incCombo();
          addFever(-8);
          setCoach('happy', 'ซูเปอร์!', 'ดาวช่วยดันคอมโบ + ลดไข้');
          dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'hit', data:{ kind:'star', ch }});
          try{ Particles.burstAt(x,y,'gold'); }catch{}
          hud();
          try{ QUEST.onHit({ kind:'power', good:true, perfect }); }catch{}
          return { scoreDelta: 18, good:true };
        }
        // 💎
        addScore(22, x, y);
        incCombo(); incCombo(); incCombo();
        addFever(-10);
        setCoach('happy', 'เพชร!', 'คอมโบพุ่ง! รีบเก็บน้ำดีต่อเนื่อง');
        dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'hit', data:{ kind:'diamond', ch }});
        try{ Particles.burstAt(x,y,'diamond'); }catch{}
        hud();
        try{ QUEST.onHit({ kind:'power', good:true, perfect }); }catch{}
        return { scoreDelta: 22, good:true };
      }

      // good hit
      if (isGood){
        S.nHitGood++;
        const delta = 10 + perfectBonus + Math.min(8, Math.floor(S.combo/6));
        addScore(delta, x, y);
        incCombo();
        addFever(perfect ? -3 : -1);

        setWaterGauge(null, +2);

        dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'hit', data:{ kind:'good', ch, perfect }});
        if (perfect) setCoach('happy', 'Perfect!', 'จังหวะดีมาก! คอมโบต่อไป');
        hud();
        try{ QUEST.onHit({ kind:'good', good:true, perfect }); }catch{}
        return { scoreDelta: delta, good:true };
      }

      // junk hit => Shield can block (NO miss)
      if (consumeShield()){
        S.nHitJunkGuard++;
        try{ QUEST.onSpecial('shieldBlock'); }catch{}
        addScore(-2, x, y); // small penalty for block
        addFever(2);
        setWaterGauge(null, -1);

        dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'shield_block', data:{ kind:'junk', ch, fake:isFake }});
        try{ Particles.burstAt(x,y,'shield'); }catch{}
        setCoach('happy', 'โล่ช่วยไว้!', 'บล็อกขยะแล้ว (ไม่เป็น miss) แต่ระวังต่อไป');
        hud();
        try{ QUEST.onHit({ kind:'junk', good:false, perfect:false }); }catch{} // still informs mini logic
        return { scoreDelta: -2, good:false };
      }

      // junk actually hits => miss
      S.nHitJunk++;
      addMiss('junk');
      addScore(-12, x, y);
      shake(5, 160);
      setWaterGauge(null, -4);

      dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'hit', data:{ kind:'junk', ch, fake:isFake }});
      setCoach('sad', isFake ? 'โดนหลอก!' : 'โดนขยะ!', 'ระวังแก้วหวาน/ขยะ และอย่าลืมเข้า Gap ตอนบอสมา');
      hud();
      try{ QUEST.onHit({ kind:'junk', good:false, perfect:false }); }catch{}
      return { scoreDelta: -12, good:false };
    }
  });

  S._spawner = spawner;

  // fallback initial time update
  dispatch('hha:time', { sec: duration });

  // schedule first boss
  scheduleNextBoss();

  // main loop: boss + zone text + warning pulse decay
  function loop(){
    if (S.ended) return;

    // boss spawns
    spawnBoss();

    // zone UI
    const z = zoneFrom();
    waterZoneText.textContent = `ZONE: ${z.toUpperCase()}`;

    // warn pulse decay a bit
    if (S.secLeft > 10){
      warnPulse(0);
    }

    // safety end
    if (S.secLeft <= 0){
      finalize('timeup');
      return;
    }

    ROOT.requestAnimationFrame(loop);
  }
  ROOT.requestAnimationFrame(loop);

  // optional assist: tap playfield = shoot crosshair (if mode-factory supports)
  playfield.addEventListener('pointerdown', ()=>{
    if (S.ended) return;
    if (nowMs() < S.stunnedUntil) return;
    try{ spawner.shootCrosshair(); }catch{}
  }, { passive:true });

  hud();
}

btnStart.addEventListener('click', startGame);
btnSkip.addEventListener('click', startGame);
startOverlay.addEventListener('click', (e)=>{ if (e.target === startOverlay) startGame(); });

// VR-feel
attachVRFeel();

// visibility safety
DOC.addEventListener('visibilitychange', ()=>{
  if (DOC.visibilityState === 'hidden' && S.started && !S.ended){
    dispatch('hha:stop', {});
  }
});

// initial
setCoach('neutral', 'พร้อมแล้วไปกัน!', 'แตะเป้า 💧 ให้ตรงจังหวะ และหลบบอสให้ได้!');
hud();