// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION v11.2 (ES Module)
// ✅ Global hha-cloud-logger.js (no inline JS in HTML)
// ✅ Cursor click -> raycast intersection -> onHit(intersection)
// ✅ VR-look: drag-to-look + deviceorientation + light inertia (drag only on CANVAS; no HUD drag)
// ✅ Emoji Sticker (A-Frame material.src via dataURL) + WAIT texture loaded -> fade-in/out (fix white square)
// ✅ Tap-anywhere to start (iOS motion/audio permission friendly)
// ✅ XR Controllers (trigger/select) support if controller entities exist in HTML

'use strict';

// ---------- URL params ----------
const URLX = new URL(location.href);
const DIFF = (URLX.searchParams.get('diff') || 'normal').toLowerCase();
let TIME = parseInt(URLX.searchParams.get('time') || '70', 10);
if (Number.isNaN(TIME) || TIME <= 0) TIME = 70;
TIME = Math.max(20, Math.min(180, TIME));
const MODE = (URLX.searchParams.get('run') || 'play').toLowerCase() === 'research' ? 'research' : 'play';

window.DIFF = DIFF;
window.TIME = TIME;
window.MODE = MODE;

// ---------- Project tag ----------
const PROJECT_TAG = 'HeroHealth-PlateVR';

// ---------- Cloud Logger (global module) ----------
import { initCloudLogger } from '../vr/hha-cloud-logger.js';

// ✅ endpoint: รับจาก query ?log=... หรือ sessionStorage หรือ default
const LOGGER_ENDPOINT =
  (URLX.searchParams.get('log') || '') ||
  (sessionStorage.getItem('HHA_LOGGER_ENDPOINT') || '') ||
  'https://script.google.com/macros/s/AKfycbzOVSfe_gLDBCI7wXhVmIR2h74wGvbSzGQmoi1QbfwZgutreu0ImKQFxK4DZzGEzv7hiA/exec';

const DEBUG_LOG = (URLX.searchParams.get('debug') === '1');

// persist for other games
try { if (LOGGER_ENDPOINT) sessionStorage.setItem('HHA_LOGGER_ENDPOINT', LOGGER_ENDPOINT); } catch(_) {}

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
function setText(id, v) { const el = $(id); if (el) el.textContent = String(v); }
function setBarPct(id, pct) {
  const el = $(id);
  if (!el) return;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  el.style.width = `${p}%`;
}
function showEl(id, on) { const el = $(id); if (el) el.style.display = on ? '' : 'none'; }

function nowIso(){ return new Date().toISOString(); }
function clamp(v, a, b) { v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function clamp01(v){ return Math.max(0, Math.min(1, v)); }
function emit(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail })); }

// ---------- A-Frame / THREE ----------
const A = window.AFRAME;
const THREE = window.THREE;
if (!A) console.error('[PlateVR] AFRAME not found');
if (!THREE) console.error('[PlateVR] THREE not found (A-Frame should provide it)');

// ---------- FX module fallback ----------
const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop() {}, burstAt() {}, toast() {}, celebrate() {}, objPop() {} };

// ---------- Difficulty tuning (Production) ----------
const DIFF_TABLE = {
  easy:   { spawnInterval: 1020, maxActive: 4, scale: 0.92, lifeMs: 2500, junkRate: 0.12, powerRate: 0.12, hazRate: 0.08 },
  normal: { spawnInterval:  840, maxActive: 5, scale: 0.82, lifeMs: 2150, junkRate: 0.18, powerRate: 0.11, hazRate: 0.10 },
  hard:   { spawnInterval:  700, maxActive: 6, scale: 0.74, lifeMs: 1900, junkRate: 0.25, powerRate: 0.12, hazRate: 0.12 }
};
const DCFG0 = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// ---------- Food pools ----------
const POOL = {
  g1: { id: 1, label: 'หมู่ 1', type: 'good', emojis: ['🥚','🥛','🐟','🍗','🫘'] },
  g2: { id: 2, label: 'หมู่ 2', type: 'good', emojis: ['🍚','🍞','🍜','🥔','🌽'] },
  g3: { id: 3, label: 'หมู่ 3', type: 'good', emojis: ['🥦','🥬','🥕','🍅','🥒'] },
  g4: { id: 4, label: 'หมู่ 4', type: 'good', emojis: ['🍎','🍌','🍇','🍊','🍉'] },
  g5: { id: 5, label: 'หมู่ 5', type: 'good', emojis: ['🥑','🫒','🥜','🧈','🍯'] },
  junk:{ id: 0, label: 'junk',  type: 'junk', emojis: ['🍟','🍔','🍩','🧋','🍭','🥤'] }
};
const GROUP_KEYS = ['g1','g2','g3','g4','g5'];

// ---------- Power-ups ----------
const POWER = {
  shield: { key:'shield', emoji:'🥗', label:'SALAD SHIELD', durMs: 5200 },
  cleanse:{ key:'cleanse',emoji:'🍋', label:'CLEANSE', durMs: 0 },
  golden: { key:'golden', emoji:'⭐',  label:'GOLDEN BITE', durMs: 0 }
};

// ---------- Hazards ----------
const HAZ = {
  wind:     { key:'wind',     emoji:'🌪️', label:'WIND GUST',    durMs: 3800 },
  blackhole:{ key:'blackhole',emoji:'🕳️', label:'BLACK HOLE',   durMs: 4200 },
  freeze:   { key:'freeze',   emoji:'🧊', label:'FREEZE RISK',   durMs: 3600 }
};

// ---------- Scene refs ----------
const scene = document.querySelector('a-scene');
const cam = document.getElementById('cam');
const cursorEl = document.getElementById('cursor');

// ✅ World root สำหรับเป้า (อยู่ในโลก)
let worldRoot = document.getElementById('worldTargets');

// =======================
// SAFE ZONE + HUD CLAMP
// =======================
const SAFE = {
  rx: 1.15,
  ry: 0.72,
  padNX: 0.06,
  padNY: 0.08,
  hudPadPx: 16
};

// ✅ ระยะ “ลึก” ของเป้าจากผู้เล่น
const TARGET_DISTANCE = 2.15;

function getNoFlyRatios(){ return { topR: 0.18, bottomR: 0.20 }; }

// ✅ เก็บเฉพาะ “การ์ด/ปุ่มจริง”
function getHudExclusionRects() {
  const W = Math.max(1, window.innerWidth || 1);
  const H = Math.max(1, window.innerHeight || 1);

  const sels = [
    '#hudTop .card',
    '#hudBottom .card',
    '#hudLeft .card',
    '#hudRight .btn',
    '#questPanel', '#miniPanel',
    '#resultCard',
    '#plateTapOverlay'
  ].join(',');

  const els = Array.from(document.querySelectorAll(sels));
  const pad = SAFE.hudPadPx;

  const rects = [];
  for (const el of els) {
    if (!el || !el.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    if (!r || r.width < 30 || r.height < 20) continue;

    const x0 = clamp01((r.left   - pad) / W);
    const x1 = clamp01((r.right  + pad) / W);
    const y0 = clamp01((r.top    - pad) / H);
    const y1 = clamp01((r.bottom + pad) / H);

    rects.push({ x0, x1, y0, y1 });
  }
  return rects;
}
function inAnyRect(nx, ny, rects){
  for (const a of rects){
    if (nx >= a.x0 && nx <= a.x1 && ny >= a.y0 && ny <= a.y1) return true;
  }
  return false;
}

function ensureWorldRoot() {
  if (!scene) return null;
  worldRoot = document.getElementById('worldTargets');
  if (!worldRoot) {
    worldRoot = document.createElement('a-entity');
    worldRoot.setAttribute('id', 'worldTargets');
    scene.appendChild(worldRoot);
  }
  return worldRoot;
}

function getSceneCamera() { return scene && scene.camera ? scene.camera : null; }

// world point -> screen px
function screenPxFromWorldPoint(worldPoint) {
  try{
    const cam3 = getSceneCamera();
    if (!cam3 || !worldPoint || !THREE) return null;
    const v = new THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z);
    v.project(cam3);
    if (v.z > 1) return null;
    const x = (v.x + 1) / 2;
    const y = (1 - (v.y + 1) / 2);
    return { x: x * window.innerWidth, y: y * window.innerHeight };
  }catch(_){ return null; }
}
function screenPxFromEntity(el) {
  try{
    const cam3 = getSceneCamera();
    if (!cam3 || !el || !el.object3D || !THREE) return null;
    const v = new THREE.Vector3();
    el.object3D.getWorldPosition(v);
    v.project(cam3);
    if (v.z > 1) return null;
    const x = (v.x + 1) / 2;
    const y = (1 - (v.y + 1) / 2);
    return { x: x * window.innerWidth, y: y * window.innerHeight };
  }catch(_){ return null; }
}

// ✅ แปลง offset บนระนาบหน้ากล้อง ณ ตอน spawn → world position (ตรึงไว้)
function worldPosFromCameraOffsets(x, y, dist) {
  if (!cam || !cam.object3D || !THREE) return null;

  const camPos = new THREE.Vector3();
  const camQuat = new THREE.Quaternion();

  cam.object3D.getWorldPosition(camPos);
  cam.object3D.getWorldQuaternion(camQuat);

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat).normalize();
  const right   = new THREE.Vector3(1, 0,  0).applyQuaternion(camQuat).normalize();
  const up      = new THREE.Vector3(0, 1,  0).applyQuaternion(camQuat).normalize();

  const p = new THREE.Vector3();
  p.copy(camPos)
    .add(forward.multiplyScalar(dist))
    .add(right.multiplyScalar(x))
    .add(up.multiplyScalar(y));

  return p;
}

// ✅ สุ่มตำแหน่งแบบปลอดภัย + project เช็ค HUD จริงบนจอ
function pickSafeWorldPos() {
  const nf = getNoFlyRatios();
  const hudRects = getHudExclusionRects();

  const W = Math.max(1, window.innerWidth || 1);
  const H = Math.max(1, window.innerHeight || 1);

  const padX = SAFE.rx * (SAFE.padNX * 2);
  const padY = SAFE.ry * (SAFE.padNY * 2);

  const minX = -SAFE.rx + padX;
  const maxX =  SAFE.rx - padX;
  const minY = -SAFE.ry + padY;
  const maxY =  SAFE.ry - padY;

  const MAX_TRY = 70;

  for (let i = 0; i < MAX_TRY; i++) {
    let x = rnd(minX, maxX);
    let y = rnd(minY, maxY);

    // haz effects (อ่านจาก state ภายนอก)
    if (haz.blackhole) { x *= 0.40; y *= 0.40; }
    if (haz.wind)      { x *= 1.08; y *= 1.08; }

    x = clamp(x, -SAFE.rx, SAFE.rx);
    y = clamp(y, -SAFE.ry, SAFE.ry);

    const wp = worldPosFromCameraOffsets(x, y, TARGET_DISTANCE);
    if (!wp) continue;

    const sp = screenPxFromWorldPoint(wp);
    if (!sp) continue;

    const nx = clamp01(sp.x / W);
    const ny = clamp01(sp.y / H);

    if (ny < nf.topR) continue;
    if (ny > (1 - nf.bottomR)) continue;

    if (inAnyRect(nx, ny, hudRects)) continue;

    return { x, y, wp };
  }

  const wp0 = worldPosFromCameraOffsets(0, 0, TARGET_DISTANCE);
  return { x: 0, y: 0, wp: wp0 || { x:0,y:0,z:-TARGET_DISTANCE } };
}

// =======================
// FX layers
// =======================
function ensureFxLayer() {
  let layer = document.querySelector('.plate-fx-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'plate-fx-layer';
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: 99999,
      overflow: 'hidden'
    });
    document.body.appendChild(layer);
  }
  return layer;
}
function ensureEdgeOverlay() {
  let el = document.getElementById('plate-edge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'plate-edge';
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: 99998,
      borderRadius: '0',
      border: '0px solid rgba(255,255,255,0)',
      boxShadow: 'inset 0 0 0 rgba(0,0,0,0)',
      opacity: '0',
      transition: 'opacity .14s ease',
      willChange: 'opacity, box-shadow, border'
    });
    document.body.appendChild(el);
  }
  return el;
}

// =======================
// WebAudio tiny SFX
// =======================
let __ac = null;
function ac() {
  if (__ac) return __ac;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  __ac = new Ctx();
  return __ac;
}
function tryResumeAudio() { try { ac()?.resume?.(); } catch(_) {} }
function beep(freq=880, dur=0.06, type='sine', gain=0.08) {
  const ctx = ac();
  if (!ctx) return;
  try{
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t+dur+0.02);
  }catch(_){}
}
function sfxTick(){ beep(1200, 0.04, 'square', 0.06); }
function sfxDing(){ beep(1320, 0.08, 'sine', 0.10); setTimeout(()=>beep(1760,0.08,'sine',0.09), 60); }
function sfxMiss(){ beep(220, 0.10, 'sawtooth', 0.10); setTimeout(()=>beep(160,0.10,'sawtooth',0.09), 80); }

// =======================
// iOS Motion Permission
// =======================
let __motionAsked = false;
let __motionGranted = false;

async function ensureMotionPermission(force = false) {
  if (__motionGranted) return true;
  if (__motionAsked && !force) return false;

  __motionAsked = true;
  let ok = true;

  try {
    if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      const res = await window.DeviceOrientationEvent.requestPermission();
      ok = ok && (res === 'granted');
    }
  } catch (_) { ok = false; }

  try {
    if (window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission === 'function') {
      const res = await window.DeviceMotionEvent.requestPermission();
      ok = ok && (res === 'granted');
    }
  } catch (_) {}

  __motionGranted = !!ok;
  return __motionGranted;
}

// =======================
// Screen Shake + edge pulse
// =======================
function ensureShakeStyle() {
  if (document.getElementById('__plate_shake_css__')) return;
  const st = document.createElement('style');
  st.id = '__plate_shake_css__';
  st.textContent = `
    .plate-shake{ animation: plateShake .28s linear both; }
    @keyframes plateShake{
      0%{ transform:translate3d(0,0,0) rotate(0deg); }
      10%{ transform:translate3d(-10px, 0, 0) rotate(-0.8deg); }
      20%{ transform:translate3d(10px, 0, 0) rotate(0.8deg); }
      30%{ transform:translate3d(-12px, 2px, 0) rotate(-0.9deg); }
      40%{ transform:translate3d(12px, -2px, 0) rotate(0.9deg); }
      50%{ transform:translate3d(-8px, 1px, 0) rotate(-0.6deg); }
      60%{ transform:translate3d(8px, -1px, 0) rotate(0.6deg); }
      70%{ transform:translate3d(-6px, 0, 0) rotate(-0.4deg); }
      80%{ transform:translate3d(6px, 0, 0) rotate(0.4deg); }
      90%{ transform:translate3d(-3px, 0, 0) rotate(-0.2deg); }
      100%{ transform:translate3d(0,0,0) rotate(0deg); }
    }
    .plate-edge-pulse{ animation: plateEdgePulse .16s linear infinite alternate; }
    @keyframes plateEdgePulse{ from{ opacity: .30; } to{ opacity: .82; } }
  `;
  document.head.appendChild(st);
}
function screenShake() {
  ensureShakeStyle();
  document.body.classList.remove('plate-shake');
  void document.body.offsetWidth;
  document.body.classList.add('plate-shake');
  setTimeout(()=>document.body.classList.remove('plate-shake'), 320);
}

// =======================
// HUD-safe FX nudge
// =======================
function nudgeFxAwayFromHud(px, py) {
  const W = Math.max(1, window.innerWidth || 1);
  const H = Math.max(1, window.innerHeight || 1);
  const pad = 14;

  const sels = [
    '#hudTop .card', '#hudBottom .card', '#hudLeft .card',
    '#hudRight .btn',
    '#questPanel', '#miniPanel',
    '#resultCard',
    '#plateTapOverlay'
  ].join(',');

  const els = Array.from(document.querySelectorAll(sels));

  let x = clamp(px, pad, W - pad);
  let y = clamp(py, pad, H - pad);

  for (const el of els) {
    if (!el || !el.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    if (!r || r.width < 20 || r.height < 20) continue;

    const inside = (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad);
    if (!inside) continue;

    const candidates = [];
    candidates.push({ x, y: r.bottom + pad, cost: Math.abs((r.bottom + pad) - y) });
    candidates.push({ x, y: r.top - pad, cost: Math.abs((r.top - pad) - y) });
    candidates.push({ x: r.right + pad, y, cost: Math.abs((r.right + pad) - x) });
    candidates.push({ x: r.left - pad, y, cost: Math.abs((r.left - pad) - x) });

    let best = null;
    for (const c of candidates) {
      const cx = clamp(c.x, pad, W - pad);
      const cy = clamp(c.y, pad, H - pad);
      if (cx === x && cy === y) continue;
      const ok = (cx >= 0 && cx <= W && cy >= 0 && cy <= H);
      if (!ok) continue;
      const cand = { x: cx, y: cy, cost: c.cost };
      if (!best || cand.cost < best.cost) best = cand;
    }

    if (best) { x = best.x; y = best.y; }
  }

  return { x, y };
}

// ---------- Sticker FX ----------
function stickerAt(px, py, text, opts = {}) {
  const layer = ensureFxLayer();
  const el = document.createElement('div');
  el.textContent = text;

  const tone = String(opts.tone || 'good');
  const big = !!opts.big;
  const dx = (opts.dx ?? 0);
  const dy = (opts.dy ?? 0);

  const baseBg =
    tone === 'bad' ? 'rgba(127,29,29,0.92)'
    : tone === 'gold' ? 'rgba(120,53,15,0.92)'
    : tone === 'boss' ? 'rgba(30,58,138,0.92)'
    : 'rgba(15,23,42,0.92)';

  const baseBorder =
    tone === 'bad' ? 'rgba(251,113,133,0.75)'
    : tone === 'gold' ? 'rgba(250,204,21,0.85)'
    : tone === 'boss' ? 'rgba(56,189,248,0.85)'
    : 'rgba(34,197,94,0.65)';

  Object.assign(el.style, {
    position: 'absolute',
    left: (px + dx) + 'px',
    top:  (py + dy) + 'px',
    transform: 'translate(-50%,-50%) scale(0.72)',
    opacity: '0',
    padding: big ? '10px 16px' : '7px 12px',
    borderRadius: '999px',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif',
    fontWeight: '900',
    letterSpacing: '.03em',
    color: '#ffffff',
    background: baseBg,
    border: '3px solid ' + baseBorder,
    boxShadow: '0 20px 45px rgba(0,0,0,0.55)',
    textShadow: '0 2px 0 rgba(0,0,0,0.55), 0 0 18px rgba(0,0,0,0.75)',
    whiteSpace: 'nowrap',
    willChange: 'transform,opacity,filter',
    filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.35))'
  });

  layer.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1.08)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%,-70%) scale(0.92)';
  }, opts.life ?? 520);
  setTimeout(() => { try{ el.remove(); }catch(_){} }, (opts.life ?? 520) + 220);
}

function starConfetti(px, py, n = 18) {
  const layer = ensureFxLayer();
  for (let i=0;i<n;i++){
    const s = document.createElement('div');
    s.textContent = '⭐';
    const size = 16 + Math.random()*18;
    Object.assign(s.style, {
      position:'absolute',
      left: px+'px',
      top: py+'px',
      transform:'translate(-50%,-50%) scale(0.9)',
      fontSize: size+'px',
      opacity:'1',
      pointerEvents:'none',
      willChange:'transform,opacity',
      filter:'drop-shadow(0 10px 16px rgba(0,0,0,0.35))'
    });
    layer.appendChild(s);

    const ang = Math.random()*Math.PI*2;
    const dist = 90 + Math.random()*85;
    const dx = Math.cos(ang)*dist;
    const dy = Math.sin(ang)*dist - (20 + Math.random()*65);

    requestAnimationFrame(()=>{
      s.style.transition = 'transform .60s ease-out, opacity .60s ease-out';
      s.style.transform = `translate(${dx}px,${dy}px) scale(${0.9+Math.random()*0.5}) rotate(${(Math.random()*260-130)|0}deg)`;
      s.style.opacity = '0';
    });
    setTimeout(()=>{ try{ s.remove(); }catch(_){} }, 660);
  }
}

// ✅ FX: คะแนน+คำตัดสินเด้งตรงเป้า (ใช้ intersection.point ถ้ามี)
function fxOnHit(el, kind, judgeText, pts, hit = null) {
  let p0 = null;

  if (hit && hit.point) p0 = screenPxFromWorldPoint(hit.point);
  if (!p0) p0 = screenPxFromEntity(el);
  if (!p0) return;

  const x = p0.x;
  const y = p0.y;

  const k = String(kind || '').toLowerCase();
  const judge = String(judgeText || '');

  const label =
    (k === 'junk')  ? 'MISS' :
    (k === 'boss')  ? 'BOSS' :
    (k === 'power') ? 'POWER' :
    (k === 'haz')   ? 'RISK' :
    (judge.includes('PERFECT') ? 'GOOD' : 'GOOD');

  try {
    Particles.burstAt(x, y, {
      label,
      good: (k !== 'junk'),
      heavy: true,
      stars: true,
      confetti: true,
      count: judge.includes('PERFECT') ? 44 : 32
    });
  } catch(_){}

  if (typeof pts === 'number') {
    try { Particles.scorePop(x, y - 4, pts, '', { plain:true }); } catch(_){}
  }

  if (judge) {
    const prefix =
      (k === 'junk')  ? '[JUNK] ' :
      (k === 'boss')  ? '[BOSS] ' :
      (k === 'power') ? '[POWER] ' :
      (k === 'haz')   ? '[FAKE] ' :
      '[GOOD] ';
    try { Particles.scorePop(x, y - 30, '', `${prefix}${judge}`, { plain:true }); } catch(_){}
  }
}

// =======================
// Billboard component
// =======================
function ensureBillboardComponent() {
  if (!A || !A.registerComponent) return;
  if (A.components && A.components['hha-billboard']) return;

  A.registerComponent('hha-billboard', {
    tick: function () {
      try{
        const sc = this.el.sceneEl;
        if (!sc || !sc.camera) return;
        this.el.object3D.quaternion.copy(sc.camera.quaternion);
      }catch(_){}
    }
  });
}

// =======================
// VR-look: drag + inertia (deviceorientation handled by look-controls)
// =======================
function ensureLookInertiaComponent() {
  if (!A || !A.registerComponent) return;
  if (A.components && A.components['hha-look-inertia']) return;

  A.registerComponent('hha-look-inertia', {
    schema: {
      enabled: { default: true },
      yawLimit: { default: 999 },        // not used
      pitchMin: { default: -80 },
      pitchMax: { default: 80 },
      sens: { default: 0.15 },           // degrees per px
      inertia: { default: 0.92 },        // decay
      velClamp: { default: 2.4 },        // deg per frame clamp
      smooth: { default: 0.18 }          // slerp factor
    },
    init: function () {
      this.drag = false;
      this.lastX = 0;
      this.lastY = 0;
      this.vx = 0;
      this.vy = 0;
      this.offYaw = 0;     // degrees
      this.offPitch = 0;   // degrees
      this.tmpQ = new THREE.Quaternion();
      this.baseQ = new THREE.Quaternion();
      this.wantQ = new THREE.Quaternion();
      this.euler = new THREE.Euler(0,0,0,'YXZ');

      const isUI = (t) => {
        if (!t || !t.closest) return false;
        return !!(
          t.closest('#hudTop') || t.closest('#hudBottom') ||
          t.closest('#hudLeft') || t.closest('#hudRight') ||
          t.closest('#questPanel') || t.closest('#miniPanel') ||
          t.closest('#resultBackdrop') || t.closest('#resultCard') ||
          t.closest('#plateTapOverlay') ||
          t.closest('button') || t.closest('.btn')
        );
      };

      const onDown = (ev) => {
        if (!this.data.enabled) return;
        if (document.hidden) return;

        // ✅ drag only on CANVAS, ignore UI
        const t = ev.target;
        if (isUI(t)) return;
        if (!t || String(t.tagName).toUpperCase() !== 'CANVAS') return;

        this.drag = true;
        const p = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
        this.lastX = p.clientX;
        this.lastY = p.clientY;
      };
      const onMove = (ev) => {
        if (!this.data.enabled || !this.drag) return;
        const p = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
        const dx = (p.clientX - this.lastX);
        const dy = (p.clientY - this.lastY);
        this.lastX = p.clientX;
        this.lastY = p.clientY;

        // update velocity (deg/frame-ish)
        const s = this.data.sens;
        const vyaw = clamp(dx * s, -this.data.velClamp, this.data.velClamp);
        const vpitch = clamp(dy * s, -this.data.velClamp, this.data.velClamp);
        this.vx = 0.55*this.vx + 0.45*vyaw;
        this.vy = 0.55*this.vy + 0.45*vpitch;

        // apply immediate offset
        this.offYaw += this.vx;
        this.offPitch += this.vy;
        this.offPitch = clamp(this.offPitch, this.data.pitchMin, this.data.pitchMax);
      };
      const onUp = () => { this.drag = false; };

      window.addEventListener('pointerdown', onDown, { passive: true });
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onUp, { passive: true });
      window.addEventListener('touchstart', onDown, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onUp, { passive: true });

      this._cleanup = () => {
        window.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('touchstart', onDown);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
      };
    },
    remove: function(){ try{ this._cleanup && this._cleanup(); }catch(_){} },
    tick: function () {
      if (!this.data.enabled) return;
      if (!this.el || !this.el.object3D) return;

      // inertia when not dragging
      if (!this.drag) {
        this.vx *= this.data.inertia;
        this.vy *= this.data.inertia;
        if (Math.abs(this.vx) < 0.002) this.vx = 0;
        if (Math.abs(this.vy) < 0.002) this.vy = 0;

        this.offYaw += this.vx;
        this.offPitch += this.vy;
        this.offPitch = clamp(this.offPitch, this.data.pitchMin, this.data.pitchMax);
      }

      // base orientation from look-controls/deviceorientation
      this.baseQ.copy(this.el.object3D.quaternion);

      // apply offset quaternion
      const yaw = THREE.MathUtils.degToRad(this.offYaw);
      const pitch = THREE.MathUtils.degToRad(this.offPitch);
      this.euler.set(pitch, yaw, 0);
      this.tmpQ.setFromEuler(this.euler);

      this.wantQ.copy(this.baseQ).multiply(this.tmpQ);

      // smooth
      this.el.object3D.quaternion.slerp(this.wantQ, this.data.smooth);
    }
  });
}

// =======================
// Tap-anywhere overlay
// =======================
function ensureTapOverlay() {
  let ov = document.getElementById('plateTapOverlay');
  if (ov) return ov;

  ov = document.createElement('div');
  ov.id = 'plateTapOverlay';
  Object.assign(ov.style, {
    position: 'fixed',
    inset: '0',
    zIndex: 99997,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    background: 'radial-gradient(ellipse at center, rgba(2,6,23,0.50), rgba(2,6,23,0.92))',
    backdropFilter: 'blur(6px)'
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    width: 'min(720px, 92vw)',
    padding: '18px 18px',
    borderRadius: '18px',
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.78)',
    boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
    color: '#e5e7eb',
    fontFamily: 'system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif'
  });

  const title = document.createElement('div');
  title.textContent = '🍽️ Balanced Plate VR';
  Object.assign(title.style, { fontSize: '22px', fontWeight: '1000', letterSpacing: '.04em' });

  const sub = document.createElement('div');
  sub.textContent = 'แตะตรงไหนก็ได้เพื่อเริ่ม (Tap-anywhere) • หมุนมือถือเหมือน VR • ระวังขยะ!';
  Object.assign(sub.style, { marginTop: '8px', fontWeight: '900', color: 'rgba(229,231,235,0.90)' });

  const hint = document.createElement('div');
  hint.textContent = 'iPhone: ถ้ามีหน้าต่างขอ Motion/Orientation ให้กด Allow';
  Object.assign(hint.style, { marginTop: '10px', fontWeight: '900', color: 'rgba(156,163,175,0.95)' });

  const btn = document.createElement('button');
  btn.textContent = '▶️ START';
  Object.assign(btn.style, {
    marginTop: '14px',
    width: '100%',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid rgba(148,163,184,0.25)',
    background: 'rgba(34,197,94,0.22)',
    color: '#e5e7eb',
    fontWeight: '1000',
    cursor: 'pointer'
  });

  card.appendChild(title);
  card.appendChild(sub);
  card.appendChild(hint);
  card.appendChild(btn);
  ov.appendChild(card);
  document.body.appendChild(ov);

  return ov;
}
function hideTapOverlay() {
  const ov = document.getElementById('plateTapOverlay');
  if (ov) { try{ ov.remove(); }catch(_){} }
}

// =======================================================
// ✅ SCHEMA MAPPING (sessions/events) -> hha:log_*
// =======================================================
function median(arr){
  const a = (arr || []).slice().filter(n => Number.isFinite(n)).sort((x,y)=>x-y);
  if (!a.length) return '';
  const mid = Math.floor(a.length/2);
  return (a.length % 2) ? a[mid] : Math.round((a[mid-1] + a[mid]) / 2);
}

// ---------- Hub/Profile (best-effort) ----------
function readJson(key){
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') || {}; } catch(_) { return {}; }
}
function getHubProfile(){
  return (
    readJson('HHA_PROFILE') ||
    readJson('herohealth_profile') ||
    readJson('playerProfile') ||
    {}
  );
}
function getHubResearch(){
  return (
    readJson('HHA_RESEARCH') ||
    readJson('herohealth_research') ||
    {}
  );
}

function schemaCommonFromHub(){
  const p = getHubProfile();
  const r = getHubResearch();

  return {
    runMode: MODE,
    studyId: r.studyId || r.studyID || '',
    phase: r.phase || '',
    conditionGroup: r.conditionGroup || r.group || '',

    sessionOrder: r.sessionOrder || '',
    blockLabel: r.blockLabel || '',
    siteCode: r.siteCode || '',
    schoolYear: r.schoolYear || '',
    semester: r.semester || '',

    studentKey: p.studentKey || p.sid || '',
    schoolCode: p.schoolCode || '',
    schoolName: p.schoolName || '',
    classRoom: p.classRoom || p.class || '',
    studentNo: p.studentNo || '',
    nickName: p.nickName || p.nickname || '',

    gender: p.gender || '',
    age: p.age || '',
    gradeLevel: p.gradeLevel || p.grade || '',

    heightCm: p.heightCm || '',
    weightKg: p.weightKg || '',
    bmi: p.bmi || '',
    bmiGroup: p.bmiGroup || '',

    vrExperience: p.vrExperience || '',
    gameFrequency: p.gameFrequency || '',
    handedness: p.handedness || '',
    visionIssue: p.visionIssue || '',
    healthDetail: p.healthDetail || '',

    consentParent: (p.consentParent ?? ''),
    consentTeacher:(p.consentTeacher ?? ''),

    profileSource: p.profileSource || p.source || '',
    surveyKey: p.surveyKey || '',
    excludeFlag: (p.excludeFlag ?? ''),
    noteResearcher: r.noteResearcher || ''
  };
}

// ---------- Session ----------
const sessionId = `PLATE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const t0 = performance.now();
const sessionStartIso = nowIso();
function fromStartMs() { return Math.max(0, Math.round(performance.now() - t0)); }

// ---------- Game state ----------
let started = false;
let ended = false;
let paused = false;

let tLeft = TIME;
let timerTick = null;

let score = 0;
let combo = 0;
let maxCombo = 0;
let miss = 0;

let fever = 0;
let feverActive = false;
let feverUntilMs = 0;

let perfectPlates = 0;
let perfectStreak = 0;
let bestStreak = 0;

let plateHave = { 1:false,2:false,3:false,4:false,5:false };
let plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
let totalsByGroup = { 1:0,2:0,3:0,4:0,5:0 };

let goalTotal = 2;

let goodStreak = 0;
let lastGoodGroup = 0;
let perfectChain = 0;
let lastMissAtMs = -99999;

let hero10On = false;
let hero10Clean = true;

let bossPhaseOn = false;
let bossOn = false;
let bossHP = 0;
let goldenZoneUntilMs = 0;

let junkSurgeUntilMs = 0;

let miniCleared = 0;
let miniCurrent = null;
let miniHistory = 0;

let cleanTimer = 0;
let tw = { twNoRepeatOk:true, twVegHits:0, twNoMissFirst3s:true, twStartMs:0 };

// Plate Rush FX
let rushDeadlineMs = 0;
let rushNoJunkOK = true;
let rushTicked = {3:false,2:false,1:false};
let edgePulseOn = false;

// ---------- hazards/powers ----------
let balancePct = 100;
let shieldOn = false;
let shieldUntil = 0;

let haz = { wind:false, blackhole:false, freeze:false };
let hazUntil = { wind:0, blackhole:0, freeze:0 };

// ---------- spawn ----------
let spawnTimer = null;
let activeTargets = new Map();
let targetSeq = 0;
let currentSpawnInterval = DCFG0.spawnInterval;

// ---------- Schema counters (sessions) ----------
let nTargetGoodSpawned = 0;
let nTargetJunkSpawned = 0;
let nTargetStarSpawned = 0;
let nTargetDiamondSpawned = 0;
let nTargetShieldSpawned = 0;

let nHitGood = 0;
let nHitJunk = 0;
let nHitJunkGuard = 0;
let nExpireGood = 0;

let rtGoodSum = 0;
let rtGoodN = 0;
let rtGoodList = [];

// ---------- Click de-dupe ----------
const recentHits = new Map();
const HIT_DEDUPE_MS = 240;
function wasRecentlyHit(targetId) {
  const now = performance.now();
  for (const [k, t] of recentHits.entries()) {
    if (now - t > 1000) recentHits.delete(k);
  }
  const t = recentHits.get(targetId);
  if (t && now - t < HIT_DEDUPE_MS) return true;
  recentHits.set(targetId, now);
  return false;
}

function isAdaptiveOn() { return MODE === 'play'; }

// =======================================================
// ✅ Emoji Sticker texture (A-Frame material.src) — FIX white squares by waiting texture load
// =======================================================
function applyEmojiTextureToEntity(el, emoji, s) {
  try {
    if (!el) return;

    if (el.object3D) el.object3D.scale.set(s, s, s);

    // keep current opacity (important for fade-in waiting texture)
    const curMat = el.getAttribute('material') || {};
    const curOp = Number(curMat.opacity);
    const keepOpacity = Number.isFinite(curOp) ? curOp : 0.0;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0,0,size,size);

    // base sticker (rounded)
    const r = Math.round(size * 0.20);
    const x = Math.round(size * 0.10);
    const y = Math.round(size * 0.10);
    const w = Math.round(size * 0.80);
    const h = Math.round(size * 0.80);

    // helper: round rect
    function rr(px, py, pw, ph, pr){
      const k = Math.max(0, Math.min(pr, Math.min(pw, ph)/2));
      ctx.beginPath();
      ctx.moveTo(px+k, py);
      ctx.arcTo(px+pw, py, px+pw, py+ph, k);
      ctx.arcTo(px+pw, py+ph, px, py+ph, k);
      ctx.arcTo(px, py+ph, px, py, k);
      ctx.arcTo(px, py, px+pw, py, k);
      ctx.closePath();
    }

    // shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.60)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 12;
    rr(x,y,w,h,r);
    ctx.fillStyle = 'rgba(15,23,42,0.78)';
    ctx.fill();
    ctx.restore();

    // fill + border
    rr(x,y,w,h,r);
    ctx.fillStyle = 'rgba(15,23,42,0.78)';
    ctx.fill();
    ctx.lineWidth = Math.max(6, Math.round(size*0.028));
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.stroke();

    // gloss
    ctx.save();
    ctx.globalAlpha = 0.18;
    rr(Math.round(size*0.14), Math.round(size*0.14), Math.round(size*0.72), Math.round(size*0.38), Math.round(size*0.16));
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();

    // emoji
    ctx.font = `${Math.round(size*0.62)}px system-ui, "Segoe UI Emoji", "Noto Color Emoji"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(emoji || '🥦'), size/2, size/2 + size*0.05);

    const url = canvas.toDataURL('image/png');

    // ✅ keep opacity at 0 until texture is loaded
    el.setAttribute('material', {
      shader: 'flat',
      transparent: true,
      opacity: keepOpacity,
      side: 'double',
      src: url
    });
  } catch (e) {
    console.warn('[PlateVR] applyEmojiTextureToEntity failed', e);
  }
}

// =======================================================
// ✅ Targets (World-anchored + Billboard + Fade in/out)
// =======================================================
function makeTargetEntity({ kind, groupId = 0, emoji, scale = 1.0 }) {
  if (!scene) return null;

  ensureWorldRoot();
  ensureBillboardComponent();

  const el = document.createElement('a-entity');
  const id = `pt-${++targetSeq}`;
  el.setAttribute('id', id);
  el.classList.add('plateTarget');
  el.setAttribute('class', 'plateTarget');

  el.setAttribute('geometry', 'primitive: plane; width: 0.52; height: 0.52');
  // start invisible (fade-in after texture loaded)
  el.setAttribute('material', 'shader: flat; emphasize:false; transparent: true; opacity: 0.0; side: double');

  el.dataset.kind = kind;
  el.dataset.groupId = String(groupId || 0);
  el.dataset.emoji = String(emoji || '');
  el.dataset.spawnMs = String(fromStartMs());

  // billboard
  el.setAttribute('hha-billboard', '');

  // SAFE spawn
  const pos = pickSafeWorldPos();
  if (pos && pos.wp) {
    el.setAttribute('position', `${pos.wp.x} ${pos.wp.y} ${pos.wp.z}`);
  } else {
    el.setAttribute('position', `0 1.5 -${TARGET_DISTANCE}`);
  }

  const s = clamp(scale, 0.45, 1.35);

  // ---- texture + fade-in only when texture is ready ----
  const fadeInOnce = () => {
    if (el.dataset.fadedIn === '1') return;
    el.dataset.fadedIn = '1';
    try{
      el.setAttribute('animation__in_op', 'property: material.opacity; from: 0.0; to: 0.98; dur: 160; easing: easeOutQuad');
      el.setAttribute('animation__in_sc',  'property: scale; from: 0.72 0.72 0.72; to: 1 1 1; dur: 180; easing: easeOutBack');
    }catch(_){}
  };

  const applyAll = () => {
    // keep invisible first
    try { el.setAttribute('material', 'shader: flat; transparent: true; opacity: 0.0; side: double'); } catch(_){}

    applyEmojiTextureToEntity(el, emoji, s);

    // ✅ when texture loaded -> fade in (prevents white square)
    el.addEventListener('materialtextureloaded', fadeInOnce, { once: true });
    // fallback (cache or some browsers)
    setTimeout(fadeInOnce, 120);
  };

  el.addEventListener('object3dset', (e) => {
    if (e.detail && e.detail.type === 'mesh') applyAll();
  });
  el.addEventListener('loaded', applyAll);

  // ❌ IMPORTANT: do not use target click without intersection (prevents double hit + respects "send intersection")
  // If you REALLY want to keep A-Frame click, use intersection only:
  // el.addEventListener('click', (ev) => onHit(el, 'aframe-click', ev?.detail?.intersection || null));

  return el;
}

function removeTargetSoft(el, reason = 'remove', fadeMs = 140) {
  if (!el) return;

  const id = el.getAttribute('id');
  if (id && activeTargets.has(id)) {
    const rec = activeTargets.get(id);
    if (rec && rec.expireTO) { try{ clearTimeout(rec.expireTO); }catch(_){} }
    activeTargets.delete(id);
  }

  try { el.dataset.removing = '1'; } catch(_){}

  // fade-out + shrink
  try{
    el.setAttribute('animation__out_op', `property: material.opacity; from: 0.98; to: 0.0; dur: ${fadeMs}; easing: easeInQuad`);
    el.setAttribute('animation__out_sc', `property: scale; from: 1 1 1; to: 0.75 0.75 0.75; dur: ${fadeMs}; easing: easeInQuad`);
  }catch(_){}

  setTimeout(() => {
    try { el.parentNode && el.parentNode.removeChild(el); } catch (_) {}
  }, Math.max(80, fadeMs + 30));

  emitGameEvent({ type:'target_remove', reason, targetId: id || '', kind: el.dataset.kind || '' });
}

function expireTarget(el) {
  if (!el || ended || paused) return;
  const kind = el.dataset.kind || '';
  const groupId = parseInt(el.dataset.groupId || '0', 10) || 0;

  if (kind === 'good') {
    miss += 1;
    combo = 0;
    goodStreak = 0;
    perfectStreak = 0;
    fever = clamp(fever - 10, 0, 100);
    emitJudge('MISS');
    lastMissAtMs = performance.now();
    hero10Clean = false;
    emit('hha:miss', { projectTag: PROJECT_TAG, sessionId, mode:'PlateVR', misses: miss, timeFromStartMs: fromStartMs() });
    emitGameEvent({ type:'miss_expire', groupId });

    nExpireGood += 1;
    logEventSchema({
      eventType: 'expire_good',
      kind: 'good',
      targetId: el.getAttribute('id') || '',
      emoji: el.dataset.emoji || '',
      rtMs: '',
      judgment: 'MISS',
      extra: 'expired'
    });
  }

  removeTargetSoft(el, 'expire', 160);
  knowAdaptive();
  hudUpdateAll();
  emitScore();
}

// ---------- Adaptive ----------
function knowAdaptive() {
  if (!isAdaptiveOn()) return;
  const base = (DIFF_TABLE[DIFF] || DIFF_TABLE.normal).spawnInterval;
  let k = 1.0;

  if (combo >= 8) k *= 0.82;
  if (combo >= 12) k *= 0.75;
  if (miss >= 8) k *= 1.10;

  if (tLeft <= 18) k *= 0.82;
  if (bossPhaseOn) k *= 0.86;
  if (hero10On) k *= 0.80;

  currentSpawnInterval = clamp(Math.round(base * k), 420, 1600);
}

// ---------- Plate logic ----------
function resetPlate() { plateHave = { 1:false,2:false,3:false,4:false,5:false }; }
function plateHaveCount() { return Object.values(plateHave).filter(Boolean).length; }

function registerGroupHit(groupId) {
  if (groupId >= 1 && groupId <= 5) {
    plateHave[groupId] = true;
    plateCounts[groupId] += 1;
    totalsByGroup[groupId] += 1;
  }
}

function streakBonusCheck() {
  const now = goodStreak;
  let bonus = 0;
  let label = '';
  if (now === 5)  { bonus = 120; label = '🔥 STREAK x5'; }
  if (now === 10) { bonus = 220; label = '⚡ STREAK x10'; }
  if (now === 15) { bonus = 360; label = '💥 STREAK x15'; }
  if (bonus > 0) {
    score += bonus;
    emitCoach(`สตรีค ${now}! +${bonus} 🧨`, 'happy');
    stickerAt(window.innerWidth*0.5, window.innerHeight*0.36, `${label} +${bonus}`, { tone:'gold', big:true, life: 760 });
    emitGameEvent({ type:'streak_bonus', streak: now, bonus });
  }
}

function checkPerfectPlate() {
  const have = plateHaveCount();
  if (have >= 5) {
    perfectPlates += 1;
    perfectStreak += 1;
    bestStreak = Math.max(bestStreak, perfectStreak);
    perfectChain += 1;

    let bonus = 220 + Math.min(180, perfectStreak * 40);
    let chainBonus = 0;
    if (perfectChain >= 2) chainBonus = 180 + (perfectChain-1)*60;
    score += bonus + chainBonus;

    emitJudge('PERFECT!');
    emitCoach(`PERFECT PLATE! +${bonus}${chainBonus?` (+${chainBonus} CHAIN!)`:''} 🌟`, 'happy');
    emitGameEvent({ type:'perfect_plate', perfectPlates, perfectStreak, perfectChain, bonus, chainBonus });

    try {
      const p = nudgeFxAwayFromHud(window.innerWidth*0.5, window.innerHeight*0.42);
      Particles.burstAt(p.x, p.y, { label:'PERFECT', good:true, heavy:true, stars:true, confetti:true, count: 52 });
      starConfetti(p.x, p.y, 26);
    } catch(_) {}

    fever = clamp(fever + 28, 0, 100);
    if (fever >= 100) activateFever(5200);

    resetPlate();

    if (miniCurrent && !miniCurrent.done && miniCurrent.key.startsWith('perfect')) {
      miniCurrent.prog += 1;
      if (miniCurrent.prog >= miniCurrent.target) clearMiniQuest();
    }
  }
}

function updateBalance(kind, groupId) {
  if (kind === 'junk') { balancePct = clamp(balancePct - 18, 0, 100); return; }
  if (groupId >= 1 && groupId <= 5) {
    const c = plateCounts[groupId] || 0;
    if (c >= 3) balancePct = clamp(balancePct - 6, 0, 100);
    else balancePct = clamp(balancePct + 2, 0, 100);
  }
}

function scoreForHit(kind, groupId) {
  let base = 0;
  if (kind === 'good') base = 85;
  if (kind === 'junk') base = -50;
  if (kind === 'power') base = 120;
  if (kind === 'haz') base = 90;
  if (kind === 'boss') base = 140;

  let mult = 1.0;
  if (feverActive) mult += 0.35;

  const bal = clamp(balancePct, 0, 100);
  const balMult = 0.70 + (bal / 100) * 0.40;
  mult *= balMult;

  if (goodStreak >= 10) mult *= 1.06;
  else if (goodStreak >= 5) mult *= 1.03;

  if (DIFF === 'hard') mult *= 0.96;
  if (DIFF === 'easy') mult *= 1.04;

  if (performance.now() < goldenZoneUntilMs) mult *= 1.18;

  return Math.round(base * mult);
}

// ---------- Fever ----------
function activateFever(ms = 5200) {
  feverActive = true;
  feverUntilMs = performance.now() + ms;
  emit('hha:fever', { projectTag: PROJECT_TAG, sessionId, mode:'PlateVR', on: 1, value: 100, timeFromStartMs: fromStartMs() });
  emitCoach('FEVER ON! คะแนนคูณแรงขึ้น 🔥', 'fever');
  emitGameEvent({ type:'fever_on', durMs: ms });
}
function updateFeverTick() {
  if (!feverActive) {
    fever = clamp(fever - 0.9, 0, 100);
  } else {
    fever = clamp(fever - 0.25, 0, 100);
    if (performance.now() >= feverUntilMs) {
      feverActive = false;
      emit('hha:fever', { projectTag: PROJECT_TAG, sessionId, mode:'PlateVR', on: 0, value: Math.round(fever), timeFromStartMs: fromStartMs() });
      emitCoach('FEVER หมดแล้ว สู้ต่อได้เลย ✨', 'neutral');
      emitGameEvent({ type:'fever_off' });
    }
  }
}

// ---------- Shield ----------
function enableShield(ms = POWER.shield.durMs) {
  shieldOn = true;
  shieldUntil = performance.now() + ms;
  emitCoach(`ได้โล่! กันขยะ ${Math.round(ms/1000)} วิ 🥗`, 'happy');
  emitGameEvent({ type:'shield_on', durMs: ms });
}
function updateShieldTick() {
  if (!shieldOn) return;
  if (performance.now() >= shieldUntil) {
    shieldOn = false;
    emitCoach('โล่หมดแล้ว ระวังขยะนะ 😌', 'neutral');
    emitGameEvent({ type:'shield_off' });
  }
}

// ---------- Hazards ----------
function enableHaz(key, ms) {
  haz[key] = true;
  hazUntil[key] = performance.now() + ms;
  emitCoach(`${HAZ[key].label}! ระวัง!`, 'sad');
  emitGameEvent({ type:'haz_on', haz: key, durMs: ms });
}
function updateHazTick() {
  for (const k of Object.keys(haz)) {
    if (haz[k] && performance.now() >= hazUntil[k]) {
      haz[k] = false;
      emitGameEvent({ type:'haz_off', haz: k });
      emitCoach('กลับสู่สภาพปกติแล้ว ✅', 'neutral');
    }
  }
}

// ---------- Mini quests ----------
const TWIST_POOL = [
  { key:'noRepeat', label:'ห้ามเก็บหมู่เดิมซ้ำติดกัน!' },
  { key:'needVeg2', label:'ต้องมี “ผัก 🥦” อย่างน้อย 2 ครั้ง!' },
  { key:'noMiss3s', label:'ห้ามพลาดภายใน 3 วิแรก!' }
];

const MINI_POOL = [
  { key:'rush8',    label:'Plate Rush: ครบ 5 หมู่ ภายใน 8 วิ!', target: 1, twistAllowed: true },
  { key:'perfect1', label:'Perfect Chain: ทำ PERFECT เพิ่มอีก',  target: 1, twistAllowed: true },
  { key:'clean10',  label:'Clean Plate: ห้ามโดนขยะ 10 วิ',       target: 10, twistAllowed: false },
  { key:'combo8',   label:'Combo Build: ทำคอมโบให้ถึง 8',        target: 8, twistAllowed: true }
];

function emitQuestUpdate() {
  emit('quest:update', {
    projectTag: PROJECT_TAG,
    sessionId,
    mode: 'PlateVR',
    goal: { label:`Perfect Plate ${perfectPlates}/${goalTotal}`, prog: perfectPlates, target: goalTotal },
    mini: miniCurrent
      ? { label: miniCurrent.label, prog: miniCurrent.prog, target: miniCurrent.target, hint: miniCurrent.hint || '' }
      : { label: 'Mini: …', prog: 0, target: 1, hint: '' }
  });
}

function twistOkNow() {
  if (!miniCurrent || miniCurrent.done) return true;
  const tk = miniCurrent.twistKey;
  if (!tk) return true;
  if (tk === 'noRepeat') return !!tw.twNoRepeatOk;
  if (tk === 'needVeg2') return (tw.twVegHits >= 2);
  if (tk === 'noMiss3s') return !!tw.twNoMissFirst3s;
  return true;
}

function startNextMiniQuest() {
  const def = pick(MINI_POOL);
  miniHistory += 1;

  const useTwist = def.twistAllowed && Math.random() < 0.75;
  const twist = useTwist ? pick(TWIST_POOL) : null;

  tw = { twNoRepeatOk:true, twVegHits:0, twNoMissFirst3s:true, twStartMs: performance.now() };

  miniCurrent = {
    key: def.key,
    label: def.label,
    target: def.target,
    prog: 0,
    startedAt: performance.now(),
    done: false,
    twistKey: twist ? twist.key : '',
    twistLabel: twist ? twist.label : '',
    hint: twist ? `Twist: ${twist.label}` : ''
  };

  if (miniCurrent.key === 'clean10') cleanTimer = def.target;

  if (miniCurrent.key === 'rush8') {
    rushDeadlineMs = performance.now() + 8000;
    rushNoJunkOK = true;
    rushTicked = {3:false,2:false,1:false};
    edgePulseOn = false;
  }

  emitGameEvent({ type:'mini_start', miniKey: miniCurrent.key, miniHistory, twist: miniCurrent.twistKey });
  emitCoach(`Mini Quest เริ่ม! ${miniCurrent.label} 🎯`, 'happy');
  if (miniCurrent.hint) emitCoach(miniCurrent.hint, 'neutral');

  emitQuestUpdate();
  hudUpdateAll();
}

function clearMiniQuest() {
  if (!miniCurrent || miniCurrent.done) return;
  miniCurrent.done = true;
  miniCleared += 1;

  emitGameEvent({ type:'mini_clear', miniKey: miniCurrent.key, miniCleared });
  emitCoach('Mini Quest CLEAR! ✅ ต่อไปมาเลย!', 'happy');
  emitJudge('MISSION CLEAR!');

  const bonus = 180 + (miniCleared*10);
  score += bonus;

  const p = nudgeFxAwayFromHud(window.innerWidth*0.5, window.innerHeight*0.42);
  stickerAt(p.x, p.y, `✅ MINI CLEAR +${bonus}`, { tone:'gold', big:true, life: 840 });

  try { Particles.burstAt(p.x, p.y, { label:'MINI', good:true, heavy:true, stars:true, confetti:true, count: 40 }); } catch(_){}

  setTimeout(() => { if (!ended) startNextMiniQuest(); }, 520);

  emitQuestUpdate();
  hudUpdateAll();
  emitScore();
}

function failMiniQuest(reason='fail') {
  if (!miniCurrent || miniCurrent.done) return;
  miniCurrent.done = true;
  emitGameEvent({ type:'mini_fail', miniKey: miniCurrent.key, reason });
  emitCoach(`Mini Quest พลาด! ลองอันใหม่เลย 💪`, 'sad');

  const p = nudgeFxAwayFromHud(window.innerWidth*0.5, window.innerHeight*0.42);
  stickerAt(p.x, p.y, `😵 FAIL`, { tone:'bad', big:true, life: 640 });

  setTimeout(() => { if (!ended) startNextMiniQuest(); }, 620);
  emitQuestUpdate();
}

function updateMiniTick() {
  if (!miniCurrent || miniCurrent.done || paused) return;

  if (miniCurrent.twistKey === 'noMiss3s') {
    const dt = performance.now() - tw.twStartMs;
    if (dt <= 3000 && performance.now() - lastMissAtMs < 900) tw.twNoMissFirst3s = false;
  }

  if (miniCurrent.key === 'rush8') {
    const have = plateHaveCount();
    const leftMs = Math.max(0, rushDeadlineMs - performance.now());
    const leftS = Math.ceil(leftMs/1000);

    if (leftS <= 3 && leftS >= 1) {
      if (!rushTicked[leftS]) {
        rushTicked[leftS] = true;
        sfxTick();
      }
      const edge = ensureEdgeOverlay();
      ensureShakeStyle();
      edge.style.opacity = '1';
      edge.style.border = '3px solid rgba(250,204,21,0.78)';
      edge.style.boxShadow = 'inset 0 0 0 999px rgba(250,204,21,0.06), inset 0 0 34px rgba(250,204,21,0.22)';
      if (!edgePulseOn) { edgePulseOn = true; edge.classList.add('plate-edge-pulse'); }
      document.body.classList.remove('plate-shake');
      void document.body.offsetWidth;
      document.body.classList.add('plate-shake');
      setTimeout(()=>document.body.classList.remove('plate-shake'), 180);
    } else {
      const edge = ensureEdgeOverlay();
      edge.style.opacity = '0';
      edge.classList.remove('plate-edge-pulse');
      edgePulseOn = false;
    }

    miniCurrent.prog = (have >= 5 && rushNoJunkOK && twistOkNow()) ? 1 : 0;

    if (performance.now() >= rushDeadlineMs) {
      if (miniCurrent.prog >= 1) clearMiniQuest();
      else failMiniQuest('rush_timeout');
      return;
    }

    miniCurrent.hint =
      `เหลือ ${leftS}s • ตอนนี้ ${have}/5` +
      (rushNoJunkOK ? '' : ' • ❌ โดนขยะแล้ว!') +
      (miniCurrent.twistLabel ? ` • ${miniCurrent.twistLabel}` : '');

    if (miniCurrent.prog >= miniCurrent.target) clearMiniQuest();
  }

  if (miniCurrent.key === 'combo8') {
    miniCurrent.prog = Math.max(miniCurrent.prog, combo);
    if (miniCurrent.prog >= miniCurrent.target && twistOkNow()) clearMiniQuest();
  }

  if (miniCurrent.key === 'clean10') {
    miniCurrent.prog = clamp((miniCurrent.target - cleanTimer), 0, miniCurrent.target);
    if (cleanTimer <= 0) clearMiniQuest();
  }

  if (miniCurrent.key === 'perfect1') {
    if (miniCurrent.prog >= miniCurrent.target && twistOkNow()) clearMiniQuest();
  }

  emitQuestUpdate();
  hudUpdateAll();
}

// ---------- Boss Phase ----------
function maybeStartBossPhase() {
  if (bossPhaseOn || paused) return;
  if (tLeft > 20) return;
  bossPhaseOn = true;
  emitCoach('⚔️ BOSS PHASE! ท้ายเกมมาแล้ว! ระวังขยะ + บอส ⭐', 'sad');
  stickerAt(window.innerWidth*0.5, window.innerHeight*0.26, '⚔️ BOSS PHASE!', { tone:'boss', big:true, life: 980 });
  emitGameEvent({ type:'boss_phase_on' });
  setTimeout(()=>{ if (!ended && !paused) spawnOne({ forceBoss:true }); }, 240);
}
function startGoldenZone(ms=3000) {
  goldenZoneUntilMs = performance.now() + ms;
  stickerAt(window.innerWidth*0.5, window.innerHeight*0.30, '✨ GOLD ZONE x1.18', { tone:'gold', big:true, life: 820 });
  emitGameEvent({ type:'gold_zone_on', ms });
}

// ---------- Spawn ----------
function pickSpawnKind() {
  const endBoost = (tLeft <= 18) ? 0.05 : 0.0;
  const r = Math.random();
  const hazRate = (DCFG0.hazRate + endBoost) + (bossPhaseOn ? 0.02 : 0);
  const powRate = DCFG0.powerRate + (bossPhaseOn ? 0.01 : 0);
  const junkExtra = (performance.now() < junkSurgeUntilMs) ? 0.12 : 0.0;
  const junkRate = clamp(DCFG0.junkRate + (bossPhaseOn ? 0.07 : 0) + junkExtra, 0.05, 0.60);
  if (r < hazRate) return 'haz';
  if (r < hazRate + powRate) return 'power';
  if (r < hazRate + powRate + junkRate) return 'junk';
  return 'good';
}

function spawnOne(opts = {}) {
  ensureWorldRoot();
  if (!worldRoot || ended || paused) return;
  if (activeTargets.size >= DCFG0.maxActive) return;

  const kind = opts.forceBoss ? 'boss' : pickSpawnKind();
  const scl = DCFG0.scale * (haz.freeze ? 0.92 : 1.0);
  const lifeMs = DCFG0.lifeMs + (haz.freeze ? 350 : 0);

  let meta = null;

  if (kind === 'good') {
    const key = pick(GROUP_KEYS);
    const g = POOL[key];
    meta = { kind:'good', groupId: g.id, emoji: pick(g.emojis), scale: scl };
  } else if (kind === 'junk') {
    meta = { kind:'junk', groupId: 0, emoji: pick(POOL.junk.emojis), scale: scl * 0.98 };
  } else if (kind === 'power') {
    const pk = pick(Object.keys(POWER));
    const p = POWER[pk];
    meta = { kind:'power', groupId: 0, emoji: p.emoji, scale: scl * 0.95 };
  } else if (kind === 'haz') {
    const hk = pick(Object.keys(HAZ));
    const h = HAZ[hk];
    meta = { kind:'haz', groupId: 0, emoji: h.emoji, scale: scl * 0.95, hazKey: hk };
  } else if (kind === 'boss') {
    meta = { kind:'boss', groupId: 0, emoji: '⭐', scale: scl * 1.05 };
  }

  const el = makeTargetEntity(meta);
  if (!el) return;

  if (kind === 'haz' && meta.hazKey) el.dataset.hazKey = meta.hazKey;

  // spawn counters
  if (meta.kind === 'good') nTargetGoodSpawned += 1;
  if (meta.kind === 'junk') nTargetJunkSpawned += 1;
  if (meta.kind === 'boss' || meta.emoji === '⭐') nTargetStarSpawned += 1;
  if (meta.kind === 'power' && meta.emoji === POWER.shield.emoji) nTargetShieldSpawned += 1;
  if (meta.kind === 'power' && meta.emoji === POWER.cleanse.emoji) nTargetDiamondSpawned += 1;

  worldRoot.appendChild(el);

  const id = el.getAttribute('id');
  const now = performance.now();
  const expireAt = now + lifeMs;

  const expireTO = setTimeout(() => {
    if (ended || paused) return;
    const rec = activeTargets.get(id);
    if (!rec) return;
    expireTarget(rec.el);
  }, lifeMs);

  activeTargets.set(id, {
    id, el,
    kind: el.dataset.kind,
    groupId: parseInt(el.dataset.groupId || '0', 10) || 0,
    spawnAt: now,
    expireAt,
    lifeMs,
    remainMs: lifeMs,
    expireTO
  });

  emitGameEvent({ type:'spawn', kind: el.dataset.kind, groupId: meta.groupId || 0, targetId: id });

  logEventSchema({
    eventType: 'spawn',
    kind: meta.kind,
    targetId: id,
    emoji: meta.emoji,
    rtMs: '',
    judgment: '',
    extra: meta.hazKey ? `haz=${meta.hazKey}` : ''
  });
}

function spawnLoopStart() {
  knowAdaptive();
  if (spawnTimer) clearInterval(spawnTimer);

  const loop = () => {
    if (ended || paused) return;
    maybeStartBossPhase();
    spawnOne();
    knowAdaptive();
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(loop, currentSpawnInterval);
  };

  spawnTimer = setInterval(loop, currentSpawnInterval);
}

// =======================================================
// ✅ Schema rows + events
// =======================================================
function buildSessionRow(reason){
  const c = schemaCommonFromHub();

  const playedSec = Math.max(0, Math.round(fromStartMs()/1000));
  const goodDen = (nHitGood + nExpireGood);
  const accuracyGoodPct = goodDen ? Math.round((nHitGood / goodDen) * 1000)/10 : '';
  const junkDen = (nHitGood + nHitJunk);
  const junkErrorPct = junkDen ? Math.round((nHitJunk / junkDen) * 1000)/10 : '';

  const avgRtGoodMs = rtGoodN ? Math.round(rtGoodSum / rtGoodN) : '';
  const medianRtGoodMs = rtGoodList.length ? median(rtGoodList) : '';

  const fastHitRatePct = (rtGoodList.length)
    ? Math.round((rtGoodList.filter(v=>v <= 650).length / rtGoodList.length) * 1000)/10
    : '';

  const device = (() => {
    const ua = navigator.userAgent || '';
    if (/OculusBrowser|Quest/i.test(ua)) return 'VR';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    return 'PC';
  })();

  return {
    timestampIso: nowIso(),
    projectTag: PROJECT_TAG,
    ...c,

    sessionId,
    gameMode: 'PlateVR',
    diff: DIFF,

    durationPlannedSec: TIME,
    durationPlayedSec: playedSec,

    scoreFinal: score,
    comboMax: maxCombo,
    misses: miss,

    goalsCleared: Math.min(perfectPlates, goalTotal),
    goalsTotal: goalTotal,
    miniCleared: miniCleared,
    miniTotal: Math.max(miniHistory, miniCleared) || 0,

    nTargetGoodSpawned,
    nTargetJunkSpawned,
    nTargetStarSpawned,
    nTargetDiamondSpawned,
    nTargetShieldSpawned,

    nHitGood,
    nHitJunk,
    nHitJunkGuard,
    nExpireGood,

    accuracyGoodPct,
    junkErrorPct,
    avgRtGoodMs,
    medianRtGoodMs,
    fastHitRatePct,

    device,
    gameVersion: '11.2',
    reason: reason || '',

    startTimeIso: sessionStartIso,
    endTimeIso: nowIso()
  };
}

function buildEventRow(ev){
  const c = schemaCommonFromHub();

  const itemType =
    ev.kind === 'good' ? 'good'
    : ev.kind === 'junk' ? 'junk'
    : ev.kind === 'power' ? 'power'
    : ev.kind === 'haz' ? 'haz'
    : ev.kind === 'boss' ? 'boss'
    : '';

  return {
    timestampIso: nowIso(),
    projectTag: PROJECT_TAG,
    ...c,

    sessionId,
    eventType: ev.eventType || ev.type || '',
    gameMode: 'PlateVR',
    diff: DIFF,

    timeFromStartMs: fromStartMs(),
    targetId: ev.targetId || '',
    emoji: ev.emoji || '',
    itemType,
    lane: ev.lane || '',

    rtMs: Number.isFinite(ev.rtMs) ? Math.round(ev.rtMs) : '',
    judgment: ev.judgment || '',

    totalScore: score,
    combo: combo,
    isGood: (ev.kind === 'good') ? 1 : 0,

    feverState: feverActive ? 'ON' : 'OFF',
    feverValue: Math.round(fever),

    goalProgress: `${perfectPlates}/${goalTotal}`,
    miniProgress: miniCurrent ? `${miniCurrent.prog}/${miniCurrent.target}` : '',

    extra: ev.extra || ''
  };
}

function logEventSchema(ev){ emit('hha:log_event', buildEventRow(ev)); }
function logSessionSchema(reason){ emit('hha:log_session', buildSessionRow(reason)); }

// ---------- Emitters ----------
let eventSeq = 0;
function emitGameEvent(payload) {
  eventSeq += 1;
  emit('hha:event', Object.assign({
    projectTag: PROJECT_TAG,
    sessionId,
    eventSeq,
    type: payload.type || '',
    mode: 'PlateVR',
    difficulty: DIFF,
    runMode: MODE,
    timeFromStartMs: fromStartMs(),
    timeLeftSec: tLeft,
    paused: paused ? 1 : 0,
    feverState: feverActive ? 'ON' : 'OFF',
    feverValue: Math.round(fever),
    totalScore: score,
    combo,
    misses: miss,
    bossOn: bossOn ? 1 : 0,
    bossPhaseOn: bossPhaseOn ? 1 : 0,
    shieldOn: shieldOn ? 1 : 0,
    balancePct: Math.round(balancePct),
    perfectPlates,
    perfectStreak,
    goodStreak
  }, payload));
}
function emitCoach(text, mood) {
  emit('hha:coach', { projectTag: PROJECT_TAG, sessionId, mode:'PlateVR', text: String(text||''), mood: mood || 'neutral', timeFromStartMs: fromStartMs() });
}
function emitJudge(label) {
  emit('hha:judge', { projectTag: PROJECT_TAG, sessionId, mode:'PlateVR', label: String(label||''), timeFromStartMs: fromStartMs() });
}
function computeGradeNow() {
  const allGoal = perfectPlates >= goalTotal;
  if (allGoal && score >= 1400 && maxCombo >= 14 && miss <= 2) return 'SSS';
  if (allGoal && score >= 1000 && maxCombo >= 10 && miss <= 4) return 'SS';
  if (score >= 750) return 'S';
  if (score >= 550) return 'A';
  if (score >= 320) return 'B';
  return 'C';
}
function emitScore() {
  emit('hha:score', {
    projectTag: PROJECT_TAG,
    sessionId, mode:'PlateVR',
    score, combo, comboMax: maxCombo, misses: miss,
    fever: Math.round(fever), feverOn: feverActive ? 1 : 0,
    timeLeft: tLeft,
    paused: paused ? 1 : 0,
    perfectPlates, perfectStreak,
    balancePct: Math.round(balancePct),
    shieldOn: shieldOn ? 1 : 0,
    bossOn: bossOn ? 1 : 0,
    bossPhaseOn: bossPhaseOn ? 1 : 0,
    goodStreak,
    gradeNow: computeGradeNow()
  });
}
function emitTime() { emit('hha:time', { projectTag: PROJECT_TAG, sessionId, mode:'PlateVR', sec: tLeft, paused: paused ? 1 : 0, timeFromStartMs: fromStartMs() }); }

// ---------- HUD (fallback) ----------
function hudUpdateAll() {
  setText('hudTime', tLeft);
  setText('hudScore', score);
  setText('hudCombo', combo);
  setText('hudMiss', miss);
  setText('hudGrade', computeGradeNow());
  showEl('hudPaused', paused);

  const pct = Math.round(clamp(fever, 0, 100));
  setBarPct('hudFever', pct);
  setText('hudFeverPct', pct + '%');

  const have = Object.values(plateHave).filter(Boolean).length;
  setText('hudGroupsHave', `${have}/5`);
  setText('hudPerfectCount', perfectPlates);

  setText('hudGoalLine', `ทำ PERFECT PLATE อย่างน้อย ${goalTotal} จาน (ตอนนี้ ${perfectPlates}/${goalTotal})`);

  if (miniCurrent) {
    setText('hudMiniLine', `Mini: ${miniCurrent.label} • ${miniCurrent.prog}/${miniCurrent.target}`);
    setText('hudMiniHint', miniCurrent.hint || '');
  } else {
    setText('hudMiniLine', 'Mini: …');
    setText('hudMiniHint', '…');
  }
}

// ---------- Hit logic ----------
function applyTwistOnGood(groupId) {
  if (miniCurrent?.twistKey === 'noRepeat') {
    if (lastGoodGroup && groupId === lastGoodGroup) tw.twNoRepeatOk = false;
  }
  if (miniCurrent?.twistKey === 'needVeg2') {
    if (groupId === 3) tw.twVegHits += 1;
  }
  lastGoodGroup = groupId;
}

function onHit(el, via = 'cursor', hit = null) {
  if (!el || ended || paused) return;
  if (!started) return; // ✅ important: ignore hits before start (prevents "consume" targets)

  const id = el.getAttribute('id') || '';
  if (id && wasRecentlyHit(id)) return;

  if (el.dataset.hit === '1') return;
  el.dataset.hit = '1';

  const kind = el.dataset.kind || '';
  const groupId = parseInt(el.dataset.groupId || '0', 10) || 0;

  const spawnMs = parseInt(el.dataset.spawnMs || '0', 10) || 0;
  const rtMs = Math.max(0, fromStartMs() - spawnMs);

  const preFx = (judge, pts) => {
    try { fxOnHit(el, kind, judge, pts, hit); } catch(_){}
  };

  emitGameEvent({ type:'hit_raw', kind, groupId, via, targetId: id });

  // remove with fade AFTER we got screen position (preFx uses el/hit)
  const softRemove = (reason) => removeTargetSoft(el, reason, 140);

  if (kind === 'haz') {
    const hk = el.dataset.hazKey || pick(Object.keys(HAZ));
    enableHaz(hk, HAZ[hk].durMs);

    combo = Math.max(0, combo - 1);
    const pts = scoreForHit('haz', 0);
    score += pts;

    emitJudge('RISK!');
    preFx('RISK!', pts);
    softRemove('hit');
    emitGameEvent({ type:'haz_hit', haz: hk, points: pts });

    logEventSchema({
      eventType: 'hit_haz',
      kind: 'haz',
      targetId: id,
      emoji: el.dataset.emoji || '',
      rtMs,
      judgment: 'RISK',
      extra: `haz=${hk};via=${via}`
    });

    hudUpdateAll(); emitScore();
    return;
  }

  if (kind === 'power') {
    const em = el.dataset.emoji || '';
    let pts = scoreForHit('power', 0);

    if (em === POWER.shield.emoji) {
      enableShield(POWER.shield.durMs);
      score += pts;
      fever = clamp(fever + 10, 0, 100);
      emitJudge('SHIELD!');
      preFx('SHIELD!', pts);
      softRemove('hit');
      emitGameEvent({ type:'power_shield', points: pts });
    } else if (em === POWER.cleanse.emoji) {
      for (const [tid, tr] of Array.from(activeTargets.entries())) {
        if (tr && tr.el && tr.el.dataset.kind === 'junk') removeTargetSoft(tr.el, 'cleanse', 120);
      }
      balancePct = clamp(balancePct + 22, 0, 100);
      score += 240;
      combo = 0;
      goodStreak = 0;
      emitJudge('CLEANSE!');
      preFx('CLEANSE!', 240);
      softRemove('hit');
      emitCoach('ล้างจานแล้ว! ขยะหายไป 💨 (คอมโบรีเซ็ต)', 'happy');
      emitGameEvent({ type:'power_cleanse', points: 240 });
    } else if (em === POWER.golden.emoji) {
      score += 320;
      fever = clamp(fever + 22, 0, 100);
      junkSurgeUntilMs = performance.now() + 3000;
      startGoldenZone(2600);

      if (fever >= 100) activateFever(5200);
      emitJudge('GOLD!');
      preFx('GOLD!', 320);
      softRemove('hit');
      emitCoach('Golden Bite! คะแนนพุ่ง ⭐ (ระวัง! ขยะเพิ่ม 3 วิ)', 'happy');
      emitGameEvent({ type:'power_golden', points: 320, junkSurgeMs: 3000 });
    } else {
      score += pts;
      emitJudge('POWER!');
      preFx('POWER!', pts);
      softRemove('hit');
    }

    combo += 1; maxCombo = Math.max(maxCombo, combo);

    logEventSchema({
      eventType: 'hit_power',
      kind: 'power',
      targetId: id,
      emoji: el.dataset.emoji || '',
      rtMs,
      judgment: 'POWER',
      extra: `via=${via}`
    });

    updateMiniTick();
    hudUpdateAll(); emitScore();
    return;
  }

  if (kind === 'boss') {
    if (!bossOn) {
      bossOn = true;
      bossHP = 3 + (DIFF === 'hard' ? 2 : 1);
      emitCoach(`บอสมาถึง! กด ⭐ ให้ครบ ${bossHP} ครั้ง!`, 'sad');
      emitGameEvent({ type:'boss_on', hp: bossHP });
    }

    bossHP -= 1;
    const pts = scoreForHit('boss', 0);
    score += pts;

    combo += 1; maxCombo = Math.max(maxCombo, combo);
    fever = clamp(fever + 12, 0, 100);

    emitJudge('BOSS HIT!');
    preFx('BOSS HIT!', pts);
    softRemove('hit');
    emitGameEvent({ type:'boss_hit', hpLeft: bossHP, points: pts });

    logEventSchema({
      eventType: 'hit_boss',
      kind: 'boss',
      targetId: id,
      emoji: '⭐',
      rtMs,
      judgment: 'BOSS',
      extra: `hpLeft=${bossHP};via=${via}`
    });

    if (bossHP <= 0) {
      bossOn = false;
      const bonus = 420 + (DIFF === 'hard' ? 140 : 60);
      score += bonus;
      startGoldenZone(3000);
      emitCoach(`โค่นบอสแล้ว! +${bonus} 🏆`, 'happy');
      emitJudge('BOSS CLEAR!');

      const p = nudgeFxAwayFromHud(window.innerWidth*0.5, window.innerHeight*0.42);
      stickerAt(p.x, p.y, `🏆 BOSS CLEAR +${bonus}`, { tone:'boss', big:true, life: 980 });
      try { Particles.burstAt(p.x, p.y, { label:'BOSS', good:true, heavy:true, stars:true, confetti:true, count: 48 }); } catch(_){}
      sfxDing();

      emitGameEvent({ type:'boss_clear', bonus });

      logEventSchema({
        eventType: 'boss_clear',
        kind: 'boss',
        targetId: id,
        emoji: '⭐',
        rtMs,
        judgment: 'CLEAR',
        extra: `bonus=${bonus}`
      });
    } else {
      setTimeout(() => { if (!ended && !paused) spawnOne({ forceBoss: true }); }, 240);
    }

    updateMiniTick();
    hudUpdateAll(); emitScore();
    return;
  }

  if (kind === 'junk') {
    if (miniCurrent && !miniCurrent.done && miniCurrent.key === 'rush8') rushNoJunkOK = false;

    if (shieldOn) {
      const pts = 30;
      score += pts;
      fever = clamp(fever + 4, 0, 100);
      emitJudge('BLOCK!');
      preFx('BLOCK!', pts);
      softRemove('hit');
      emitCoach('โล่กันขยะไว้ได้! 🥗', 'happy');
      emitGameEvent({ type:'junk_blocked', points: pts });
      combo += 1; maxCombo = Math.max(maxCombo, combo);

      nHitJunkGuard += 1;
      logEventSchema({
        eventType: 'junk_blocked',
        kind: 'junk',
        targetId: id,
        emoji: el.dataset.emoji || '',
        rtMs,
        judgment: 'BLOCK',
        extra: `via=${via}`
      });
    } else {
      miss += 1;
      combo = 0;
      goodStreak = 0;
      perfectStreak = 0;
      perfectChain = 0;
      balancePct = clamp(balancePct - 18, 0, 100);
      fever = clamp(fever - 12, 0, 100);
      emitJudge('MISS');
      preFx('MISS!', 0);
      softRemove('hit');
      lastMissAtMs = performance.now();
      hero10Clean = false;

      screenShake();
      sfxMiss();

      emit('hha:miss', { projectTag: PROJECT_TAG, sessionId, mode:'PlateVR', misses: miss, timeFromStartMs: fromStartMs() });
      emitCoach('โดนขยะแล้ว! เลี่ยงให้ได้ 😵', 'sad');
      emitGameEvent({ type:'junk_hit_miss' });

      if (miniCurrent && !miniCurrent.done && miniCurrent.key === 'clean10') cleanTimer = miniCurrent.target;

      nHitJunk += 1;
      logEventSchema({
        eventType: 'hit_junk',
        kind: 'junk',
        targetId: id,
        emoji: el.dataset.emoji || '',
        rtMs,
        judgment: 'MISS',
        extra: `via=${via}`
      });
    }
  } else if (kind === 'good') {
    const pts = scoreForHit('good', groupId);
    score += pts;
    combo += 1; maxCombo = Math.max(maxCombo, combo);
    fever = clamp(fever + 7, 0, 100);

    goodStreak += 1;

    applyTwistOnGood(groupId);

    registerGroupHit(groupId);
    updateBalance('good', groupId);

    const judge = (pts >= 110) ? 'PERFECT' : 'GOOD';
    emitJudge(judge);
    preFx(judge, pts);
    softRemove('hit');
    emitGameEvent({ type:'good_hit', groupId, points: pts });

    nHitGood += 1;
    rtGoodSum += rtMs;
    rtGoodN += 1;
    rtGoodList.push(rtMs);

    logEventSchema({
      eventType: 'hit_good',
      kind: 'good',
      targetId: id,
      emoji: el.dataset.emoji || '',
      rtMs,
      judgment: judge,
      extra: `groupId=${groupId};via=${via}`
    });

    streakBonusCheck();
    checkPerfectPlate();

    if (fever >= 100) activateFever(5200);
  }

  updateMiniTick();
  hudUpdateAll();
  emitScore();
  emitGameEvent({ type:'hit', kind, groupId, via, targetId: id });

  knowAdaptive();
}

// ---------- Tick ----------
function handleHero10() {
  if (hero10On) return;
  if (tLeft > 10) return;
  hero10On = true;
  hero10Clean = true;
  emitCoach('🔥 10 วิสุดท้าย! โหมดฮีโร่! ห้ามพลาดนะ!', 'happy');
  stickerAt(window.innerWidth*0.5, window.innerHeight*0.22, '🔥 HERO MODE 10s', { tone:'gold', big:true, life: 980 });
  sfxDing();
  emitGameEvent({ type:'hero10_on' });
}

function tick1s() {
  if (ended || paused) return;

  tLeft -= 1;
  if (tLeft < 0) tLeft = 0;

  if (miniCurrent && miniCurrent.key === 'clean10' && !miniCurrent.done) {
    cleanTimer = Math.max(0, cleanTimer - 1);
    if (cleanTimer <= 0) {
      miniCurrent.prog = miniCurrent.target;
      clearMiniQuest();
    }
  }

  handleHero10();
  if (hero10On && miss > 0 && performance.now() - lastMissAtMs < 1200) hero10Clean = false;

  updateFeverTick();
  updateShieldTick();
  updateHazTick();
  maybeStartBossPhase();

  emitTime();
  hudUpdateAll();
  emitScore();

  if (tLeft <= 0) endGame('time_up');
}

function startTimers() {
  if (timerTick) clearInterval(timerTick);
  timerTick = setInterval(tick1s, 1000);
}
function stopTimers() {
  if (timerTick) clearInterval(timerTick);
  timerTick = null;
}

// ---------- Result modal ----------
function computeGradeFinal() { return computeGradeNow(); }
function showResultModal(reason) {
  setText('rMode', (MODE === 'research') ? 'Research' : 'Play');
  setText('rGrade', computeGradeFinal());
  setText('rScore', score);
  setText('rMaxCombo', maxCombo);
  setText('rMiss', miss);
  setText('rPerfect', perfectPlates);

  setText('rGoals', `${Math.min(perfectPlates, goalTotal)}/${goalTotal}`);
  setText('rMinis', `${miniCleared}/${Math.max(miniHistory, miniCleared) || 0}`);

  setText('rG1', totalsByGroup[1] || 0);
  setText('rG2', totalsByGroup[2] || 0);
  setText('rG3', totalsByGroup[3] || 0);
  setText('rG4', totalsByGroup[4] || 0);
  setText('rG5', totalsByGroup[5] || 0);
  setText('rGTotal', (totalsByGroup[1]+totalsByGroup[2]+totalsByGroup[3]+totalsByGroup[4]+totalsByGroup[5]) || 0);

  const backdrop = $('resultBackdrop');
  if (backdrop) backdrop.style.display = 'flex';
}

// ---------- Pause/Resume ----------
function freezeTargetTimers() {
  const now = performance.now();
  for (const rec of activeTargets.values()) {
    if (!rec) continue;
    rec.remainMs = Math.max(0, (rec.expireAt || now) - now);
    if (rec.expireTO) { try{ clearTimeout(rec.expireTO); }catch(_){} }
    rec.expireTO = null;
  }
}
function resumeTargetTimers() {
  const now = performance.now();
  for (const rec of activeTargets.values()) {
    if (!rec || !rec.el) continue;
    const ms = Math.max(80, rec.remainMs || 0);
    rec.expireAt = now + ms;
    rec.expireTO = setTimeout(() => {
      if (ended || paused) return;
      const r = activeTargets.get(rec.id);
      if (!r) return;
      expireTarget(r.el);
    }, ms);
  }
}

function pauseGame(source='ui') {
  if (ended || paused) return;
  paused = true;
  showEl('hudPaused', true);

  stopTimers();
  if (spawnTimer) clearInterval(spawnTimer);
  spawnTimer = null;

  freezeTargetTimers();

  emit('hha:pause', { projectTag: PROJECT_TAG, sessionId, mode:'PlateVR', on: 1, source, timeFromStartMs: fromStartMs() });
  emitGameEvent({ type:'pause_on', source });
  emitScore();
}
function resumeGame(source='ui') {
  if (ended || !paused) return;
  paused = false;
  showEl('hudPaused', false);

  resumeTargetTimers();
  startTimers();
  spawnLoopStart();

  emit('hha:pause', { projectTag: PROJECT_TAG, sessionId, mode:'PlateVR', on: 0, source, timeFromStartMs: fromStartMs() });
  emitGameEvent({ type:'pause_off', source });
  emitScore();
}
function togglePause() { if (paused) resumeGame('ui'); else pauseGame('ui'); }

// ---------- Targets cleanup ----------
function clearAllTargets() {
  for (const [id, rec] of Array.from(activeTargets.entries())) {
    if (rec && rec.expireTO) { try{ clearTimeout(rec.expireTO); }catch(_){} }
    if (rec && rec.el) {
      try { rec.el.parentNode && rec.el.parentNode.removeChild(rec.el); } catch (_) {}
    }
  }
  activeTargets.clear();
}

// ---------- Cursor click -> intersection -> onHit ----------
function bindCursorIntersectionClick() {
  if (!scene || !cam || !THREE) return;
  if (window.__PLATE_CURSOR_INTERSECT_BOUND__) return;
  window.__PLATE_CURSOR_INTERSECT_BOUND__ = true;

  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const shootCenter = () => {
    if (ended || paused) return;
    if (!scene.camera) return;
    ensureWorldRoot();
    const root3D = worldRoot && worldRoot.object3D;
    if (!root3D) return;

    cam.object3D.getWorldPosition(origin);
    cam.object3D.getWorldDirection(dir).normalize();

    raycaster.set(origin, dir);

    const intersects = raycaster.intersectObjects(root3D.children, true);
    if (!intersects || !intersects.length) return;

    const hitObj = intersects[0].object;
    const hitEl = hitObj && hitObj.el;
    if (!hitEl) return;

    let cur = hitEl;
    while (cur && cur !== scene && (!cur.classList || !cur.classList.contains('plateTarget'))) {
      cur = cur.parentEl;
    }
    if (!cur || !cur.classList || !cur.classList.contains('plateTarget')) return;

    onHit(cur, 'cursor', intersects[0]);
  };

  // cursor element click (fuse or click)
  if (cursorEl) cursorEl.addEventListener('click', shootCenter);

  // fallback: any pointer down on canvas -> center shoot (tap-to-hit like VR)
  window.addEventListener('pointerdown', (ev) => {
    const t = ev.target;
    if (!t || String(t.tagName).toUpperCase() !== 'CANVAS') return;
    tryResumeAudio();
    shootCenter();
  }, { passive: true });

  if (DEBUG_LOG) console.log('[PlateVR] cursor intersection click bound ✅');
}

// ✅ Manual Raycast fallback — คลิกได้แน่ (สำหรับจิ้มตำแหน่ง)
function bindPointerFallback() {
  if (!scene || !THREE) return;
  if (window.__PLATE_POINTER_BOUND__) return;
  window.__PLATE_POINTER_BOUND__ = true;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let __lastPointerShot = 0;
  const __SHOT_DEDUPE_MS = 180;

  function doRaycastFromEvent(ev) {
    if (ended || paused) return;

    const now = performance.now();
    if (now - __lastPointerShot < __SHOT_DEDUPE_MS) return;
    __lastPointerShot = now;

    if (!scene.camera) return;
    const canvas = scene.canvas;
    if (!canvas) return;

    const t = ev.target;
    if (!t || String(t.tagName).toUpperCase() !== 'CANVAS') return;

    tryResumeAudio();

    const rect = canvas.getBoundingClientRect();

    let cx, cy;
    if (ev.touches && ev.touches.length) {
      cx = ev.touches[0].clientX;
      cy = ev.touches[0].clientY;
    } else {
      cx = ev.clientX;
      cy = ev.clientY;
    }

    mouse.x = ((cx - rect.left) / rect.width) * 2 - 1;
    mouse.y = -(((cy - rect.top) / rect.height) * 2 - 1);

    raycaster.setFromCamera(mouse, scene.camera);

    ensureWorldRoot();
    const root3D = worldRoot && worldRoot.object3D;
    if (!root3D) return;

    const intersects = raycaster.intersectObjects(root3D.children, true);
    if (!intersects || !intersects.length) return;

    const hitObj = intersects[0].object;
    const hitEl = hitObj && hitObj.el;
    if (!hitEl) return;

    let cur = hitEl;
    while (cur && cur !== scene && (!cur.classList || !cur.classList.contains('plateTarget'))) {
      cur = cur.parentEl;
    }
    if (!cur || !cur.classList || !cur.classList.contains('plateTarget')) return;

    onHit(cur, 'raycast', intersects[0]);
  }

  window.addEventListener('pointerdown', doRaycastFromEvent, { passive: true });
  window.addEventListener('touchstart', doRaycastFromEvent, { passive: true });

  if (DEBUG_LOG) console.log('[PlateVR] pointer fallback bound ✅');
}

// ✅ XR Controllers support (trigger/select)
function bindXRControllers() {
  if (!scene || !THREE) return;
  if (window.__PLATE_XR_CTRL_BOUND__) return;
  window.__PLATE_XR_CTRL_BOUND__ = true;

  const ctrls = Array.from(document.querySelectorAll('[laser-controls],[hand-controls],[tracked-controls]'));
  if (!ctrls.length) return;

  for (const c of ctrls) {
    try { c.setAttribute('raycaster', 'objects:.plateTarget; far: 20'); } catch(_) {}

    const shoot = () => {
      if (ended || paused || !started) return;

      const rc = c.components && c.components.raycaster;
      const list = (rc && rc.intersections) ? rc.intersections : [];
      if (!list.length) return;

      const hit = list[0];
      const hitEl = hit && hit.object && hit.object.el;
      if (!hitEl) return;

      let cur = hitEl;
      while (cur && cur !== scene && (!cur.classList || !cur.classList.contains('plateTarget'))) {
        cur = cur.parentEl;
      }
      if (!cur) return;

      onHit(cur, 'xr', hit);
    };

    c.addEventListener('triggerdown', shoot);
    c.addEventListener('selectstart', shoot);
    c.addEventListener('click', shoot);
  }

  if (DEBUG_LOG) console.log('[PlateVR] XR controllers bound ✅');
}

// ---------- Start / End ----------
function startGame() {
  if (started || ended) return;
  started = true;

  ensureWorldRoot();
  ensureBillboardComponent();
  ensureLookInertiaComponent();

  // ✅ init global logger once
  try {
    initCloudLogger({ endpoint: LOGGER_ENDPOINT, debug: DEBUG_LOG });
  } catch (e) {
    console.warn('[PlateVR] initCloudLogger failed', e);
  }

  ensureShakeStyle();
  ensureFxLayer();
  ensureEdgeOverlay();

  emitGameEvent({ type:'session_start', sessionStartIso, durationSec: TIME });
  emitCoach(
    MODE === 'research'
      ? 'โหมดวิจัย: เล่นตามธรรมชาติ เก็บอาหารครบหมู่ให้มากที่สุด 📊'
      : (DIFF === 'hard'
        ? 'HARD! ท้ายเกมมี BOSS PHASE ด้วย 😈'
        : 'เป้าหมาย: ทำ PERFECT PLATE ให้ได้! พร้อมลุย 🍽️'),
    'neutral'
  );

  tLeft = TIME;
  score = 0; combo = 0; maxCombo = 0; miss = 0;

  fever = 0; feverActive = false; feverUntilMs = 0;
  perfectPlates = 0; perfectStreak = 0; bestStreak = 0;
  perfectChain = 0;

  goodStreak = 0; lastGoodGroup = 0;
  lastMissAtMs = -99999;

  hero10On = false; hero10Clean = true;

  balancePct = 100;
  resetPlate();
  plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
  totalsByGroup = { 1:0,2:0,3:0,4:0,5:0 };

  shieldOn = false; shieldUntil = 0;
  haz = { wind:false, blackhole:false, freeze:false };

  bossPhaseOn = false;
  bossOn = false; bossHP = 0;
  goldenZoneUntilMs = 0;
  junkSurgeUntilMs = 0;

  miniCleared = 0; miniHistory = 0; miniCurrent = null;
  cleanTimer = 0;

  // schema counters reset
  nTargetGoodSpawned = 0;
  nTargetJunkSpawned = 0;
  nTargetStarSpawned = 0;
  nTargetDiamondSpawned = 0;
  nTargetShieldSpawned = 0;
  nHitGood = 0;
  nHitJunk = 0;
  nHitJunkGuard = 0;
  nExpireGood = 0;
  rtGoodSum = 0;
  rtGoodN = 0;
  rtGoodList = [];

  paused = false;
  hudUpdateAll();
  emitTime();
  emitScore();
  emitQuestUpdate();

  // upsert profile once at start
  try {
    const p = getHubProfile();
    if (p && (p.studentKey || p.sid)) {
      emit('hha:log_profile', {
        projectTag: PROJECT_TAG,
        runMode: MODE,
        timestampIso: nowIso(),
        studentKey: p.studentKey || p.sid || '',
        schoolCode: p.schoolCode || '',
        schoolName: p.schoolName || '',
        classRoom: p.classRoom || p.class || '',
        studentNo: p.studentNo || '',
        nickName: p.nickName || p.nickname || '',
        gender: p.gender || '',
        age: p.age || '',
        gradeLevel: p.gradeLevel || p.grade || '',
        heightCm: p.heightCm || '',
        weightKg: p.weightKg || '',
        bmi: p.bmi || '',
        bmiGroup: p.bmiGroup || '',
        vrExperience: p.vrExperience || '',
        gameFrequency: p.gameFrequency || '',
        handedness: p.handedness || '',
        visionIssue: p.visionIssue || '',
        healthDetail: p.healthDetail || '',
        consentParent: (p.consentParent ?? ''),
        consentTeacher:(p.consentTeacher ?? ''),
        createdAtIso: p.createdAtIso || nowIso(),
        updatedAtIso: nowIso(),
        source: p.profileSource || p.source || 'hub'
      });
    }
  } catch(_) {}

  startNextMiniQuest();
  startTimers();

  knowAdaptive();
  spawnLoopStart();
}

function endGame(reason = 'ended') {
  if (ended) return;
  ended = true;

  paused = false;
  stopTimers();
  if (spawnTimer) clearInterval(spawnTimer);
  spawnTimer = null;
  clearAllTargets();

  if (hero10On && hero10Clean && MODE !== 'research') {
    const bonus = 260;
    score += bonus;
    stickerAt(window.innerWidth*0.5, window.innerHeight*0.30, `✨ FINISH CLEAN +${bonus}`, { tone:'gold', big:true, life: 980 });
    try { Particles.burstAt(window.innerWidth*0.5, window.innerHeight*0.42, { label:'END', good:true, heavy:true, stars:true, confetti:true, count: 44 }); } catch(_){}
    sfxDing();
    emitGameEvent({ type:'finish_clean_bonus', bonus });
  }

  emitGameEvent({ type:'session_end', reason, score, miss, maxCombo, perfectPlates, grade: computeGradeFinal() });
  emit('hha:end', {
    projectTag: PROJECT_TAG,
    sessionId, mode:'PlateVR',
    reason,
    score,
    misses: miss,
    comboMax: maxCombo,
    perfectPlates,
    goalsCleared: Math.min(perfectPlates, goalTotal),
    goalsTotal: goalTotal,
    miniCleared: miniCleared,
    miniTotal: Math.max(miniHistory, miniCleared) || 0,
    grade: computeGradeFinal(),
    timeFromStartMs: fromStartMs()
  });

  try { logSessionSchema(reason); } catch(e){ console.warn('[PlateVR] logSessionSchema failed', e); }

  emitCoach('จบเกมแล้ว! ดูสรุปผลได้เลย 🎉', 'happy');
  showResultModal(reason);
}

// ---------- Boot helpers ----------
function ensureTouchLookControls() {
  if (!cam) return;

  // ✅ ให้ look-controls รับ deviceorientation (magic window) แต่ปิด touch ของมัน
  // แล้วให้ hha-look-inertia ทำ drag + inertia แทน (drag only on CANVAS)
  try { cam.setAttribute('look-controls', 'touchEnabled:false; mouseEnabled:true; pointerLockEnabled:false; magicWindowTrackingEnabled:true'); } catch (_) {}
  try { cam.setAttribute('wasd-controls-enabled', 'false'); } catch (_) {}

  // attach inertia component
  try {
    ensureLookInertiaComponent();
    cam.setAttribute('hha-look-inertia', 'enabled:true; sens:0.15; inertia:0.92; smooth:0.18');
  } catch(_) {}
}

function bindUI() {
  const btnRestart = $('btnRestart');
  if (btnRestart) btnRestart.addEventListener('click', () => location.reload());

  const btnPlayAgain = $('btnPlayAgain');
  if (btnPlayAgain) btnPlayAgain.addEventListener('click', () => location.reload());

  const btnEnterVR = $('btnEnterVR');
  if (btnEnterVR && scene) {
    btnEnterVR.addEventListener('click', async () => {
      tryResumeAudio();
      await ensureMotionPermission(true);

      try {
        await scene.enterVR();
      } catch (e) {
        console.warn('[PlateVR] enterVR failed', e);
        try { emitCoach('เข้า VR ไม่สำเร็จ ลองแตะหน้าจออีกครั้ง แล้วกด ENTER VR ใหม่ 🥽', 'sad'); } catch(_) {}
      }
    });
  }

  const btnPause = $('btnPause');
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      tryResumeAudio();
      togglePause();
      btnPause.textContent = paused ? '▶️ RESUME' : '⏸️ PAUSE';
    });
  }
}

// ✅ Tap-anywhere start: เริ่มเกมหลัง gesture แรก
function bindTapAnywhereStart() {
  if (window.__PLATE_TAP_START_BOUND__) return;
  window.__PLATE_TAP_START_BOUND__ = true;

  ensureTapOverlay();

  const startOnce = async () => {
    if (started || ended) return;

    tryResumeAudio();
    await ensureMotionPermission(false); // best-effort

    // hide overlay + start game
    hideTapOverlay();

    // remove listeners
    window.removeEventListener('pointerdown', startOnce, true);
    window.removeEventListener('touchstart', startOnce, true);
    window.removeEventListener('click', startOnce, true);

    startGame();
  };

  // start on any gesture
  window.addEventListener('pointerdown', startOnce, true);
  window.addEventListener('touchstart', startOnce, true);
  window.addEventListener('click', startOnce, true);

  // also allow button inside overlay
  const ov = document.getElementById('plateTapOverlay');
  if (ov) {
    ov.addEventListener('click', startOnce, { capture: true, passive: true });
  }
}

export function bootPlateDOM() {
  if (window.__PLATE_DOM_BOOTED__) return;
  window.__PLATE_DOM_BOOTED__ = true;

  if (!scene) {
    console.error('[PlateVR] <a-scene> not found. Check plate-vr.html');
    return;
  }

  // init global logger early
  try {
    initCloudLogger({ endpoint: LOGGER_ENDPOINT, debug: DEBUG_LOG });
  } catch(_) {}

  ensureTouchLookControls();
  bindUI();

  setText('hudMode', (MODE === 'research') ? 'Research' : 'Play');
  setText('hudDiff', (DIFF === 'easy') ? 'Easy' : (DIFF === 'hard') ? 'Hard' : 'Normal');
  setText('hudTime', tLeft);
  hudUpdateAll();

  const bindAfterLoaded = () => {
    ensureWorldRoot();
    ensureBillboardComponent();
    bindPointerFallback();
    bindCursorIntersectionClick();
    bindXRControllers();
  };

  if (scene && scene.hasLoaded) bindAfterLoaded();
  else scene.addEventListener('loaded', bindAfterLoaded, { once: true });

  // tap-anywhere to start (แทน auto-start)
  bindTapAnywhereStart();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !ended && !paused && started) pauseGame('tab_hidden');
  });

  window.addEventListener('keydown', (e) => {
    if (ended) return;
    if (e.key === 'Escape') togglePause();
  });
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  bootPlateDOM();
});
