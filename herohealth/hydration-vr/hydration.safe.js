// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION (FULL)
// ✅ กระจายเป้าทั่วจอ (grid9 + spawnAroundCrosshair:false + minSeparation สูง)
// ✅ VR-feel: gyro + drag → playfield translate/rotate
// ✅ Water Gauge + Fever + Shield
// ✅ Goal + Chain Mini quests
// ✅ Laser Boss: Aim+Sweep + Fake-Out + Moving GAP (ช่องปลอดภัยขยับ)
// ✅ End Summary: Stamp grade + Count-up numbers + logger (hha:end)

// Imports
'use strict';

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

function nowMs(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

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

modeText.textContent = runMode;
diffText.textContent = diff;

// seed (optional)
const seed = qs('seed','');

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

  // miss definition: good expired + junk hit (shield block not count)
  misses: 0,

  nSpawnGood: 0,
  nSpawnJunk: 0,
  nHitGood: 0,
  nHitJunk: 0,
  nHitJunkGuard: 0,
  nExpireGood: 0,

  fever: 0,     // 0..100
  shield: 0,    // charges
  stunnedUntil: 0,

  // accuracy (good hits / (good hits + misses (expire + junk hit)))
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

function hud(){
  scoreText.textContent = String(Math.max(0, Math.round(S.score)));
  comboText.textContent = String(S.combo);
  comboMaxText.textContent = String(S.comboMax);
  missText.textContent = String(S.misses);
  feverText.textContent = `${Math.round(S.fever)}%`;
  shieldText.textContent = String(S.shield);
  accText.textContent = fmtPct(S.accPct);

  const g = computeGradeLive();
  liveGrade.textContent = g;

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

function shake(px, ms=140){
  try{
    DOC.documentElement.style.setProperty('--shake', `${px}px`);
    ROOT.setTimeout(()=> DOC.documentElement.style.setProperty('--shake', `0px`), ms);
  }catch{}
}

function edgeGlow(v){
  try{
    DOC.documentElement.style.setProperty('--edgeGlow', String(clamp(v,0,1)));
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

function incCombo(){
  S.combo++;
  if (S.combo > S.comboMax) S.comboMax = S.combo;
}

function breakCombo(){
  S.combo = 0;
}

function addMiss(reason){
  // miss = good expire + junk hit (shield block not count)
  S.misses++;
  breakCombo();
  S.fever = clamp(S.fever + (reason==='junk' ? 14 : 10), 0, 100);
  setFever(S.fever);
  if (S.fever >= 90) setCoach('fever', 'ระวัง! ไข้ขึ้นแล้ว!', 'หลบเลเซอร์/อย่าโดนขยะ และเก็บน้ำดีให้ต่อเนื่อง');
}

function addFever(delta){
  S.fever = clamp(S.fever + delta, 0, 100);
  setFever(S.fever);
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

  ROOT.addEventListener('pointerup', ()=>{
    dragging = false;
  }, { passive:true });

  // gyro
  let gyroOn = false;
  function onOri(e){
    if (!e) return;
    const beta = Number(e.beta)||0;   // front-back
    const gamma = Number(e.gamma)||0; // left-right
    // subtle
    pfRX = clamp((beta-10) * 0.06, -6, 6);
    pfRY = clamp((gamma) * 0.08, -7, 7);
    apply();
  }

  async function requestMotion(){
    try{
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
        const r = await DeviceOrientationEvent.requestPermission();
        if (r === 'granted'){
          gyroOn = true;
          ROOT.addEventListener('deviceorientation', onOri, { passive:true });
          setCoach('happy', 'Motion เปิดแล้ว!', 'เอียงเครื่องเพื่อ VR-feel ได้เลย ✨');
        }
      } else {
        gyroOn = true;
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

// --------------------- Water Gauge ---------------------
ensureWaterGauge({
  textEl: waterZoneText,
  fillEl: waterFill
});
setWaterGauge(50); // start balanced

// --------------------- Fever UI ---------------------
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

// --------------------- Laser System (FULL) ---------------------
function attachHydrationFxCss(){
  if (DOC.getElementById('hydr-fx-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hydr-fx-style';
  s.textContent = `
    /* === Hydration Laser FX (tele + fire + sweep + gap + fake-out) === */
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
      filter: saturate(1.05);
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
    .hvr-beam.tele{ opacity: .0; }
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

    /* ---------- Moving GAP (real safe slit) ---------- */
    .hvr-beam.gap{ --gapPos: 0; --gapH: 18px; }
    .hvr-beam.gap .core{
      position:absolute; inset:0;
      border-radius:999px;
      overflow:hidden;
      background: none !important;
    }
    .hvr-beam.gap .coreA,
    .hvr-beam.gap .coreB{
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
      background: rgba(0,0,0,0);
      box-shadow:
        inset 0 1px 0 rgba(56,189,248,.55),
        inset 0 -1px 0 rgba(244,63,94,.55),
        0 0 14px rgba(56,189,248,.18),
        0 0 18px rgba(244,63,94,.14);
      pointer-events:none;
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
  laser: null,
  lastDamageAt: 0
};

function makeBeamEl(extraCls=''){
  const el = DOC.createElement('div');
  el.className = `hvr-beam ${extraCls}`.trim();
  el.innerHTML = `<div class="core"></div>`;
  ATK.host.appendChild(el);
  return el;
}

function ensureGapStructure(el){
  if (!el) return;
  if (el.__gapReady) return;
  const core = el.querySelector('.core');
  if (!core) return;
  core.innerHTML = `
    <div class="coreA"></div>
    <div class="gap"></div>
    <div class="coreB"></div>
  `;
  el.__gapReady = true;
}

function getCrosshairClient(){
  // crosshair is fixed at center; use viewport
  const x = (ROOT.innerWidth || 1) * 0.5;
  const y = (ROOT.innerHeight || 1) * 0.52;
  return { x, y };
}

function getCrosshairLayerLocal(){
  // convert to playfield local for geometry tests
  const r = playfield.getBoundingClientRect();
  const c = getCrosshairClient();
  return { x: c.x - r.left, y: c.y - r.top, rect: r };
}

function computeAimAssist(laser){
  // higher fever = stronger tracking
  const on = true;
  const base = 0.028;
  const feverMul = 1 + (S.fever/100) * 1.35;
  let k = base * feverMul;
  k = clamp(k, 0.02, 0.082);

  // if sweep, reduce a bit (still nasty)
  const isSweep = (laser && laser.variant === 'sweep');
  const kk = isSweep ? (k * 0.72) : k;
  return { on, k: kk };
}

function spawnLaser(){
  if (!S.started || S.ended) return;
  if (nowMs() < S.stunnedUntil) return;

  // avoid too frequent
  const cd = feverStormOn() ? 5200 : 7600;
  if (ATK.laser && !ATK.laser.dead) return;

  const stormOn = feverStormOn();
  edgeGlow(stormOn ? 1 : 0.35);

  const variant = (Math.random() < 0.55) ? 'gap' : 'sweep';
  const teleMs  = stormOn ? 720 : 980;
  const fireMs  = stormOn ? 1380 : 1280;

  const baseW = stormOn ? 122 : 110;

  const laser = {
    variant,
    phase: 'tele',
    dead:false,
    born: nowMs(),
    teleMs, fireMs,
    width: baseW,
    angle: (Math.random()*70 - 35),   // deg
    sweepDir: (Math.random()<0.5 ? -1 : 1),
    sweepSpeed: stormOn ? 64 : 48,    // deg/sec
    center: { x: (playfield.clientWidth||1)*0.5, y: (playfield.clientHeight||1)*0.52 },

    // moving gap
    gapPos: 0,
    gapVel: 0,
    gapH: 18,

    el: null,
    decoys: [],
    lastTs: 0,
    lastAimTs: 0
  };

  // main beam
  const el = makeBeamEl(`tele show ${variant}`);
  laser.el = el;

  if (variant === 'gap'){
    ensureGapStructure(el);
    laser.gapH = stormOn ? 16 : 18;
    el.style.setProperty('--gapH', laser.gapH + 'px');
    el.style.setProperty('--gapPos', '0');
  }

  // Fake-out (tele decoys)
  const wantDecoy = Math.random() < (stormOn ? 0.62 : 0.48);
  const decoyN = wantDecoy ? (stormOn ? 2 : 1) : 0;
  for (let i=0;i<decoyN;i++){
    const dEl = makeBeamEl(`tele show decoy ${variant}`);
    if (variant === 'gap'){
      ensureGapStructure(dEl);
      dEl.style.setProperty('--gapH', (stormOn ? 16 : 18) + 'px');
      dEl.style.setProperty('--gapPos', '0');
    }
    const jitterAng = (Math.random()*58 - 29);
    dEl.style.transform = `translate(-50%,-50%) rotate(${jitterAng.toFixed(2)}deg)`;
    laser.decoys.push(dEl);
  }

  ATK.laser = laser;

  // after tele -> fire
  ROOT.setTimeout(()=> laserToFire(laser), teleMs);
}

function clearDecoys(laser){
  if (!laser || !laser.decoys) return;
  laser.decoys.forEach(d => { try{ d.remove(); }catch{} });
  laser.decoys.length = 0;
}

function laserToFire(laser){
  if (!laser || laser.dead) return;
  laser.phase = 'fire';

  clearDecoys(laser);

  // start moving gap
  const stormOn = feverStormOn();
  if (laser.variant === 'gap'){
    laser.gapPos = 0;
    laser.gapVel = (stormOn ? 210 : 160) * (Math.random() < 0.5 ? -1 : 1);
    try{ laser.el && laser.el.style.setProperty('--gapH', (laser.gapH || 18) + 'px'); }catch{}
  }

  try{
    laser.el.classList.remove('tele');
    laser.el.classList.add('fire');
  }catch{}

  const tEnd = nowMs() + laser.fireMs;
  function tick(){
    if (!laser || laser.dead) return;
    const t = nowMs();
    const dt = laser.lastTs ? clamp((t - laser.lastTs)/1000, 0, 0.05) : 0.016;
    laser.lastTs = t;

    laserUpdateTransform(laser, dt);
    laserDamageCheck(laser);

    if (t >= tEnd){
      laserKill(laser);
      return;
    }
    ROOT.requestAnimationFrame(tick);
  }
  ROOT.requestAnimationFrame(tick);
}

function laserUpdateTransform(laser, dt){
  if (!laser || !laser.el) return;

  const stormOn = feverStormOn();
  const bounds = playfield;

  // 1) sweep angle
  if (laser.variant === 'sweep'){
    laser.angle += laser.sweepDir * laser.sweepSpeed * dt;
    const lim = stormOn ? 60 : 52;
    if (laser.angle > lim){ laser.angle = lim; laser.sweepDir *= -1; }
    if (laser.angle < -lim){ laser.angle = -lim; laser.sweepDir *= -1; }
  }

  // 2) aim drift (follow crosshair slightly)
  const aim = computeAimAssist(laser);
  if (aim.on){
    const p = getCrosshairLayerLocal();
    const sweeping = (laser.variant === 'sweep');
    const maxStep = ((stormOn ? 86 : 62) * dt) * (sweeping ? 1.12 : 1.0);

    const dx = (p.x - laser.center.x);
    const dy = (p.y - laser.center.y);

    laser.center.x += clamp(dx * aim.k, -maxStep, maxStep);
    laser.center.y += clamp(dy * aim.k, -maxStep, maxStep);
  }

  // 3) apply transform
  const cx = laser.center.x;
  const cy = laser.center.y;

  laser.el.style.left = cx + 'px';
  laser.el.style.top  = cy + 'px';
  laser.el.style.height = (laser.width) + 'px';

  // micro jitter in storm
  const j = stormOn ? (Math.random()*2 - 1) * 0.65 : 0;
  laser.el.style.transform = `translate(-50%,-50%) rotate(${(laser.angle + j).toFixed(2)}deg)`;

  // Moving GAP during FIRE (variant gap)
  if (laser.variant === 'gap' && laser.phase === 'fire' && laser.el){
    const amp = stormOn ? 26 : 20;
    const p = getCrosshairLayerLocal();
    const toCrossY = (p.y - laser.center.y);
    const bias = clamp(toCrossY * 0.08, -12, 12);

    // integrate
    laser.gapPos += laser.gapVel * dt;

    // bounce
    if (laser.gapPos > amp){ laser.gapPos = amp; laser.gapVel *= -1; }
    if (laser.gapPos < -amp){ laser.gapPos = -amp; laser.gapVel *= -1; }

    const jitter = stormOn ? ((Math.random()*2-1) * 1.8) : ((Math.random()*2-1) * 0.9);
    const pos = clamp(laser.gapPos + bias + jitter, -amp, amp);
    laser.el.style.setProperty('--gapPos', pos.toFixed(2) + 'px');
  }
}

function pointToBeamSpace(px, py, laser){
  // beam local coordinates: rotate point by -angle around center
  const ang = (laser.angle * Math.PI) / 180;
  const cx = laser.center.x, cy = laser.center.y;
  const dx = px - cx;
  const dy = py - cy;

  const cos = Math.cos(-ang);
  const sin = Math.sin(-ang);
  const x = dx*cos - dy*sin;
  const y = dx*sin + dy*cos;
  return { x, y };
}

function laserDamageCheck(laser){
  if (!laser || laser.dead || laser.phase !== 'fire') return;
  if (S.ended) return;

  const t = nowMs();
  if (t - ATK.lastDamageAt < 420) return;

  const p = getCrosshairLayerLocal(); // playfield local
  const bp = pointToBeamSpace(p.x, p.y, laser);

  const halfH = (laser.width || 110) / 2;
  const inside = Math.abs(bp.y) <= halfH;

  if (!inside) return;

  // if gap variant: safe slit around y = gapPos (in beam space)
  if (laser.variant === 'gap'){
    const gapPosPx = parseFloat(laser.el.style.getPropertyValue('--gapPos')) || 0;
    const gapH = laser.gapH || 18;
    const safe = Math.abs(bp.y - gapPosPx) <= (gapH/2);
    if (safe) return;
  }

  // hit!
  ATK.lastDamageAt = t;

  // shield blocks laser (count as shield_block, not miss)
  if (consumeShield()){
    S.nHitJunkGuard++;
    dispatch('hha:log_event', {
      sessionId: S.sessionId,
      game: 'hydration',
      type: 'shield_block',
      data: { kind:'laser' }
    });
    try{ Particles.burstAt(p.rect.left + p.x, p.rect.top + p.y, 'shield'); }catch{}
    shake(3, 120);
    addFever(4);
    hud();
    return;
  }

  // damage: fever + stun + small score penalty (ไม่ใช่ miss)
  addFever(feverStormOn() ? 12 : 9);
  addScore(-6, p.rect.left + p.x, p.rect.top + p.y);
  stun(520);

  dispatch('hha:log_event', {
    sessionId: S.sessionId,
    game: 'hydration',
    type: 'laser_hit',
    data: { variant: laser.variant }
  });

  if (S.fever >= 100){
    // meltdown: force miss + bigger penalty
    addMiss('laser');
    addScore(-14, p.rect.left + p.x, p.rect.top + p.y);
    setCoach('sad', 'โอ๊ย! ไข้พุ่งสุด!', 'ช้า ๆ แต่ชัวร์ เข้า Gap แล้วค่อยยิง');
    shake(8, 200);
  }

  hud();
}

function laserKill(laser){
  if (!laser || laser.dead) return;
  laser.dead = true;
  try{ laser.el.remove(); }catch{}
  clearDecoys(laser);
  ATK.laser = null;

  edgeGlow(0);
}

// --------------------- End + grade + count-up ---------------------
function computeGrade(score, acc, misses){
  // tuned for kid-friendly + "ยุติธรรม" แต่มี SSS
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

function showEnd(){
  endOverlay.classList.add('show');
}
function hideEnd(){
  endOverlay.classList.remove('show');
}

btnCloseEnd.addEventListener('click', hideEnd);
btnRestart.addEventListener('click', ()=> ROOT.location.reload());

// --------------------- Game finalize ---------------------
function finalize(reason='timeup'){
  if (S.ended) return;
  S.ended = true;

  dispatch('hha:stop', {});

  // summary
  const acc = S.accPct;
  const grade = computeGrade(S.score, acc, S.misses);

  // end overlay count-up + stamp
  endScore.textContent = '0';
  endAcc.textContent = '—';
  endComboMax.textContent = String(S.comboMax);
  endMiss.textContent = String(S.misses);
  endGM.textContent = `${QUEST.goalsCleared}/${QUEST.goalsTotal} • ${QUEST.minisCleared}/${QUEST.miniTotal}`;
  endMeta.textContent = `Diff: ${diff} • Time: ${duration}s • Mode: ${runMode}`;
  endGrade.textContent = grade;

  endStamp.classList.remove('ink');
  // trigger stamp
  ROOT.setTimeout(()=> endStamp.classList.add('ink'), 40);

  // count-up
  countUp(endScore, 0, S.score, 950, '');
  ROOT.setTimeout(()=> { endAcc.textContent = fmtPct(acc); }, 520);

  // tips
  const tips = [];
  if (S.misses <= 2) tips.push('✅ Miss น้อยมาก — โฟกัสดีสุด ๆ');
  if (acc >= 90) tips.push('🎯 Accuracy ยืนพื้นระดับท็อป');
  if (S.comboMax >= 18) tips.push('🔥 คอมโบยาวมาก — จังหวะนิ่ง!');
  if (S.fever >= 85) tips.push('⚠️ เลเซอร์โหด — ครั้งหน้ารีบ “เข้า Gap” ก่อนยิง');
  if (!tips.length) tips.push('ลองเล่นอีกรอบ แล้วกดคอมโบให้ยาวขึ้น!');
  endTips.textContent = tips.join('\n');

  showEnd();

  // logger end payload
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

// --------------------- Start overlay ---------------------
async function startGame(){
  if (S.started) return;
  S.started = true;
  S.t0 = nowMs();
  S.secLeft = duration;

  startOverlay.style.display = 'none';
  setCoach('neutral', 'ไป!', 'โฟกัสน้ำดี และหลบเลเซอร์แบบมีชั้นเชิง');

  dispatch('hha:log_session', {
    sessionId: S.sessionId,
    game: 'hydration',
    mode: runMode,
    diff,
    seed
  });

  // Time listener
  ROOT.addEventListener('hha:time', (e)=>{
    const sec = (e && e.detail && typeof e.detail.sec === 'number') ? e.detail.sec : null;
    if (sec == null) return;
    S.secLeft = sec;
    clockText.textContent = String(sec);
    if (sec <= 0) finalize('timeup');
  });

  // spawnMul based on fever (storm)
  function spawnMul(){
    if (S.ended) return 999;
    const f = S.fever;
    if (f >= 85) return 0.62;
    if (f >= 72) return 0.72;
    if (f >= 55) return 0.86;
    return 1.0;
  }

  // Factory (IMPORTANT: spread full screen — fix “เป้าที่เดิม”)
  const spawner = await factoryBoot({
    difficulty: diff,
    duration,
    modeKey: 'hydration',

    // pools
    pools: {
      good: ['💧','🚰','🫧','🥛'],
      bad:  ['🥤','🧋','🧃','🍭'],
      trick:['💧'] // fake good skin (will be judged as bad)
    },
    goodRate: 0.62,

    // powerups
    powerups: ['🛡️','⭐','💎'],
    powerRate: 0.14,
    powerEvery: 6,

    // ✅ spread controls
    spawnAroundCrosshair: false,        // << กระจายเต็มจอ
    spawnStrategy: 'grid9',             // << กระจายทั่วจอแบบสมดุล
    minSeparation: 1.18,                // << ห้ามซ้อน
    maxSpawnTries: 18,

    // link hosts
    spawnHost: '#hydr-layer',
    boundsHost: '#playfield',

    // fever affects speed
    spawnIntervalMul: spawnMul,

    // exclusion zones (HUD)
    excludeSelectors: [
      '#hha-water-header',
      '#hha-card-left',
      '#hha-card-right',
      '.bottomRow',
      '#hvr-crosshair',
      '#hvr-end'
    ],

    // expire = miss (only good)
    onExpire: ({ ch, isGood, itemType }) => {
      if (S.ended) return;

      if (itemType === 'good' || itemType === 'fakeGood'){
        // good expired counts as miss
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

    decorateTarget: (el, parts, data, meta) => {
      // random float phase
      const delay = (Math.random()*1.2).toFixed(2);
      try{
        parts.wiggle.style.animationDelay = `${delay}s`;
      }catch{}

      // tiny emphasis for power
      if (data.itemType === 'power'){
        el.style.boxShadow += ', 0 0 26px rgba(250,204,21,.22)';
      }
    },

    // judge
    judge: (ch, ctx) => {
      if (S.ended) return { scoreDelta: 0, good:false };
      if (nowMs() < S.stunnedUntil) return { scoreDelta: 0, good:false };

      const x = ctx.clientX || 0;
      const y = ctx.clientY || 0;

      const kind = ctx.itemType || (ctx.isGood ? 'good' : 'junk');

      // normalize fakeGood = junk (หลอก)
      const isFake = (kind === 'fakeGood');
      const isPower = !!ctx.isPower;
      const isGood = (!!ctx.isGood) && !isFake && !(!ctx.isGood);

      // perfect bonus
      const perfect = !!ctx.hitPerfect;
      const perfectBonus = perfect ? 5 : 0;

      // handle powerups
      if (isPower){
        // map by emoji
        if (ch === '🛡️'){
          addShield(1);
          addScore(10, x, y);
          incCombo();
          addFever(-6);
          setCoach('happy', 'ได้โล่!', 'โล่ช่วยกันเลเซอร์/ขยะ (ไม่เป็น miss เมื่อ block)');
          dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'hit', data:{ kind:'shield', ch }});
          try{ Particles.burstAt(x,y,'shield'); }catch{}
          hud();
          QUEST.onHit({ kind:'power', good:true, perfect });
          return { scoreDelta: 10, good:true };
        }
        if (ch === '⭐'){
          addScore(18, x, y);
          incCombo(); incCombo(); // star boosts
          addFever(-8);
          setCoach('happy', 'ซูเปอร์!', 'ดาวช่วยดันคอมโบ + ลดไข้');
          dispatch('hha:log_event', { sessionId:S.sessionId, game:'hydration', type:'hit', data:{ kind:'star', ch }});
          try{ Particles.burstAt(x,y,'gold'); }catch{}
          hud();
          QUEST.onHit({ kind:'power', good:true, perfect });
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
        QUEST.onHit({ kind:'power', good:true, perfect });
        return { scoreDelta: 22, good:true };
      }

      // good hit
      if (isGood && (kind === 'good')){
        S.nHitGood++;
        S.nSpawnGood = Math.max(S.nSpawnGood, S.nHitGood); // (soft)
        const delta = 10 + perfectBonus + Math.min(8, Math.floor(S.combo/6));
        addScore(delta, x, y);
        incCombo();
        addFever(perfect ? -3 : -1);

        // water gauge (simple: drift to 50 on good)
        const current = qn('water', 50); // optional external seed; fallback
        // We'll keep internal gauge in ui-water module (global var)
        setWaterGauge(null, +2); // nudge +2

        dispatch('hha:log_event', {
          sessionId:S.sessionId, game:'hydration',
          type:'hit',
          data:{ kind:'good', ch, perfect }
        });

        if (perfect) setCoach('happy', 'Perfect!', 'จังหวะดีมาก! คอมโบต่อไป');
        hud();
        QUEST.onHit({ kind:'good', good:true, perfect });
        return { scoreDelta: delta, good:true };
      }

      // junk hit (shield block already handled elsewhere)
      S.nHitJunk++;
      addMiss('junk');
      addScore(-12, x, y);
      shake(5, 160);

      // water gauge goes worse on junk
      setWaterGauge(null, -4);

      dispatch('hha:log_event', {
        sessionId:S.sessionId, game:'hydration',
        type:'hit',
        data:{ kind:'junk', ch, fake:isFake }
      });

      setCoach('sad', isFake ? 'โดนหลอก!' : 'โดนขยะ!', 'ระวังแก้วหวาน/ขยะ และอย่าลืมเข้า Gap ตอนเลเซอร์');
      hud();
      QUEST.onHit({ kind:'junk', good:false, perfect:false });
      return { scoreDelta: -12, good:false };
    }
  });

  // store for stop
  S._spawner = spawner;

  // time driver (fallback)
  dispatch('hha:time', { sec: duration });

  // main loop: laser spawns + quest ticks
  let lastLaserTry = 0;
  let raf = 0;
  function loop(){
    if (S.ended) return;

    const t = nowMs();

    // laser schedule
    const interval = feverStormOn() ? 6100 : 8200;
    if (t - lastLaserTry > interval){
      lastLaserTry = t;
      spawnLaser();
    }

    // update water zone text from module
    const z = zoneFrom();
    waterZoneText.textContent = `ZONE: ${z.toUpperCase()}`;

    // glow if storm
    edgeGlow(feverStormOn() ? 1 : 0);

    // hard safety: end when time 0
    if (S.secLeft <= 0){
      finalize('timeup');
      return;
    }

    raf = ROOT.requestAnimationFrame(loop);
  }
  raf = ROOT.requestAnimationFrame(loop);

  // crosshair shooting: tap anywhere on playfield = shoot crosshair (optional)
  playfield.addEventListener('pointerdown', (e)=>{
    if (S.ended) return;
    if (nowMs() < S.stunnedUntil) return;
    // if tap hits a target normally, mode-factory handler consumes it already.
    // If tap misses, allow "shootCrosshair" as assist for VR-like feel
    try{ spawner.shootCrosshair(); }catch{}
  }, { passive:true });

  // end button events
  btnRestart.addEventListener('click', ()=> ROOT.location.reload());

  // initial HUD
  hud();
}

btnStart.addEventListener('click', startGame);
btnSkip.addEventListener('click', startGame);

// allow start by tapping overlay background
startOverlay.addEventListener('click', (e)=>{
  if (e.target === startOverlay) startGame();
});

// close end
btnCloseEnd.addEventListener('click', hideEnd);

// VR-feel
attachVRFeel();

// stop on visibility
DOC.addEventListener('visibilitychange', ()=>{
  if (DOC.visibilityState === 'hidden' && S.started && !S.ended){
    // flush logger + stop gracefully
    dispatch('hha:stop', {});
  }
});

// initial coach
setCoach('neutral', 'พร้อมแล้วไปกัน!', 'แตะเป้า 💧 ให้ตรงจังหวะ และหลบเลเซอร์ให้ได้!');
hud();