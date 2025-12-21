// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (PRODUCTION SAFE, Mobile-first)
// ✅ FIX: target not visible on mobile (safe-zone invert + add halo + stronger rings)
// ✅ NO import from hha-cloud-logger.js (IIFE) -> uses window.HHACloudLogger
// ✅ Emoji targets via CanvasTexture + fallback halo visible even if emoji font fails
// ✅ Clamp safe-zone avoids HUD (top/bottom/left/right) + never spawns under panels
// ✅ Tap-anywhere shoot + Gaze/Fuse in VR + mobile drag + gyro (look-controls enabled)
// ✅ Goals(2) + Mini quest chain + end result modal + grade SSS/SS/S/A/B/C
// ✅ Fever -> Shield blocks junk (no miss when blocked)
// ✅ FX: score pop / burst / goal+mini celebrate (uses /vr/particles.js if present)
// ✅ Cloud log via events: hha:log_session / hha:log_event

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const AFRAME = ROOT.AFRAME;
if (!AFRAME) console.error('[PlateVR] AFRAME not found. Ensure aframe.min.js is loaded.');

const THREE = ROOT.THREE || (AFRAME && AFRAME.THREE);
if (!THREE) console.error('[PlateVR] THREE not found.');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const nowMs = () => performance.now();

function q(sel){ return DOC.querySelector(sel); }
function el(id){ return DOC.getElementById(id); }

function parseParams(){
  const u = new URL(location.href);
  const sp = u.searchParams;
  const diff = (sp.get('diff') || 'normal').toLowerCase();
  const mode = (sp.get('mode') || sp.get('run') || 'play').toLowerCase(); // play | research
  const time = Number(sp.get('time') || '') || 70;
  const debug = sp.get('debug') === '1';
  const log = (sp.get('log') || '').trim();
  return { diff, mode, time, debug, log };
}
function safeJsonParse(s, fb=null){ try { return JSON.parse(s); } catch(_) { return fb; } }

// ---------- global modules (IIFE) ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

// Cloud logger is IIFE (hha-cloud-logger.js)
function cloudInitMaybe(endpoint, debug){
  const L = ROOT.HHACloudLogger;
  if (!L || typeof L.init !== 'function') return false;
  try { L.init({ endpoint, debug: !!debug }); return true; } catch(_) { return false; }
}
function logSession(detail){ ROOT.dispatchEvent(new CustomEvent('hha:log_session', { detail })); }
function logEvent(detail){ ROOT.dispatchEvent(new CustomEvent('hha:log_event', { detail })); }

// ---------- audio ----------
const AudioFX = (() => {
  let ctx = null;
  function ensure(){
    if (ctx) return ctx;
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }
  async function resume(){
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') { try { await c.resume(); } catch(_){} }
  }
  function beep(freq=880, dur=0.06, gain=0.06){
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  return { resume, beep };
})();

// ---------- warning FX CSS ----------
(function injectStyle(){
  const s = DOC.createElement('style');
  s.textContent = `
    body.hha-warn { box-shadow: inset 0 0 0 0 rgba(250,204,21,0); }
    body.hha-warn.hha-warn-on { box-shadow: inset 0 0 0 10px rgba(250,204,21,0.28); }
    @keyframes hhaShake { 0%{transform:translate(0,0)} 25%{transform:translate(1px,0)} 50%{transform:translate(0,1px)} 75%{transform:translate(-1px,0)} 100%{transform:translate(0,0)} }
    body.hha-shake-on { animation: hhaShake 0.18s linear infinite; }
  `;
  DOC.head.appendChild(s);
})();

// ---------- A-Frame components ----------
if (AFRAME && !AFRAME.components['hha-face-camera']) {
  AFRAME.registerComponent('hha-face-camera', {
    tick: function(){
      const cam = this.el.sceneEl && this.el.sceneEl.camera;
      if (!cam) return;
      this.el.object3D.quaternion.copy(cam.quaternion);
    }
  });
}
if (AFRAME && !AFRAME.components['hha-pulse']) {
  AFRAME.registerComponent('hha-pulse', {
    schema: { base:{default:1}, amp:{default:0.08}, spd:{default:2.2} },
    init: function(){ this.t0 = nowMs(); },
    tick: function(){
      const t = (nowMs() - this.t0) / 1000;
      const s = this.data.base * (1 + this.data.amp * Math.sin(t * this.data.spd * Math.PI * 2));
      this.el.object3D.scale.setScalar(s);
    }
  });
}
if (AFRAME && !AFRAME.components['hha-wobble']) {
  AFRAME.registerComponent('hha-wobble', {
    schema: { amp:{default:0.08}, spd:{default:1.4} },
    init: function(){
      this.t0 = nowMs();
      const p = this.el.object3D.position;
      this.base = { x:p.x, y:p.y, z:p.z };
      this.seed = Math.random()*1000;
    },
    tick: function(){
      const t = (nowMs() - this.t0)/1000;
      const a = this.data.amp;
      const s = this.data.spd;
      this.el.object3D.position.x = this.base.x + a * Math.sin((t*s + this.seed)*1.7);
      this.el.object3D.position.y = this.base.y + a * 0.65 * Math.cos((t*s + this.seed)*1.3);
    }
  });
}

// ---------- Emoji texture ----------
const _emojiTexCache = new Map();

function makeEmojiTexture(emoji, px=256){
  const key = `${emoji}|${px}`;
  if (_emojiTexCache.has(key)) return _emojiTexCache.get(key);

  const c = DOC.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,px,px);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.floor(px*0.74)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif`;
  ctx.fillText(emoji, px/2, px*0.56);

  const tex = new THREE.CanvasTexture(c);
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  else tex.encoding = THREE.sRGBEncoding;

  tex.needsUpdate = true;
  _emojiTexCache.set(key, tex);
  return tex;
}

// ---------- Strong sweet-spot + halo (FIX visibility) ----------
function makeHaloAndSweet(parent, targetSizeM=0.44) {
  const halo = DOC.createElement('a-circle');
  halo.setAttribute('radius', (targetSizeM * 0.62).toFixed(4));
  halo.setAttribute('material', 'shader:flat; color:#ffffff; opacity:0.11; transparent:true; side:double');
  halo.setAttribute('position', `0 0 -0.002`);
  parent.appendChild(halo);

  const outer = targetSizeM * 0.30;
  const inner = targetSizeM * 0.22;
  const dotR  = targetSizeM * 0.055;

  const ring = DOC.createElement('a-ring');
  ring.setAttribute('radius-inner', inner.toFixed(4));
  ring.setAttribute('radius-outer', outer.toFixed(4));
  ring.setAttribute('material', 'shader:flat; color:#ffffff; opacity:0.65; transparent:true; side:double');
  ring.setAttribute('position', `0 0 0.003`);
  ring.setAttribute('hha-pulse', 'base:1; amp:0.12; spd:3.0');
  parent.appendChild(ring);

  const dot = DOC.createElement('a-circle');
  dot.setAttribute('radius', dotR.toFixed(4));
  dot.setAttribute('material', 'shader:flat; color:#ffffff; opacity:0.72; transparent:true; side:double');
  dot.setAttribute('position', `0 0 0.004`);
  parent.appendChild(dot);

  const glow = DOC.createElement('a-ring');
  glow.setAttribute('radius-inner', (outer*1.05).toFixed(4));
  glow.setAttribute('radius-outer', (outer*1.22).toFixed(4));
  glow.setAttribute('material', 'shader:flat; color:#facc15; opacity:0.20; transparent:true; side:double');
  glow.setAttribute('position', `0 0 0.002`);
  parent.appendChild(glow);

  return { halo, ring, dot, glow };
}

function makeEmojiTargetEntity(emoji, sizeM=0.44){
  const ent = DOC.createElement('a-entity');
  ent.setAttribute('class', 'plateTarget');
  ent.setAttribute('hha-face-camera', '');
  ent.setAttribute('hha-pulse', 'base:1; amp:0.06; spd:2.2');

  // always-visible halo + sweet spot
  makeHaloAndSweet(ent, sizeM);

  // emoji plane (Three.js mesh)
  ent.addEventListener('loaded', () => {
    try {
      const tex = makeEmojiTexture(emoji, 256);
      const geo = new THREE.PlaneGeometry(sizeM, sizeM);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 999;
      mesh.userData._plateEntity = ent;
      ent.setObject3D('mesh', mesh);
    } catch (e) {
      // even if this fails, halo+ring still visible
      console.warn('[PlateVR] emoji mesh failed', e);
    }
  });

  return ent;
}

// ---------- content ----------
const FOOD_GROUPS = [
  { id:1, name:'โปรตีน', emoji:'🥚', score:180 },
  { id:2, name:'คาร์บ',  emoji:'🍚', score:160 },
  { id:3, name:'ผัก',    emoji:'🥦', score:170 },
  { id:4, name:'ผลไม้',  emoji:'🍎', score:170 },
  { id:5, name:'ไขมัน',  emoji:'🥑', score:160 },
];

const JUNK = [
  { id:'j1', emoji:'🍟', score:-90 },
  { id:'j2', emoji:'🍩', score:-90 },
  { id:'j3', emoji:'🧁', score:-90 },
  { id:'j4', emoji:'🥤', score:-90 },
];

const SPECIAL = {
  gold: { emoji:'🌟', score:260 },
  slow: { emoji:'🐢', score:140 },
  bomb: { emoji:'💣', score:-200 },
};

// ---------- difficulty ----------
const DIFF_TABLE = {
  easy:   { spawnMs: 980, lifeMs: 2300, dist: 3.30, fill: 0.90, targetBase: 0.50, wobbleAmp: 0.03, wobbleSpd: 1.10, junkRatio: 0.16, specialRatio: 0.08, feverGain: 12, feverLoss: 16, shieldSec: 6, timeBonusOnPlate: 2 },
  normal: { spawnMs: 780, lifeMs: 2000, dist: 3.40, fill: 0.90, targetBase: 0.46, wobbleAmp: 0.05, wobbleSpd: 1.25, junkRatio: 0.20, specialRatio: 0.10, feverGain: 11, feverLoss: 18, shieldSec: 6, timeBonusOnPlate: 2 },
  hard:   { spawnMs: 640, lifeMs: 1750, dist: 3.55, fill: 0.92, targetBase: 0.42, wobbleAmp: 0.07, wobbleSpd: 1.45, junkRatio: 0.26, specialRatio: 0.12, feverGain: 10, feverLoss: 20, shieldSec: 5, timeBonusOnPlate: 1 },
};
function pickDiffKey(k){ k = String(k||'normal').toLowerCase(); return DIFF_TABLE[k] ? k : 'normal'; }

// ---------- scene refs ----------
const P = parseParams();
const DIFF_KEY = pickDiffKey(P.diff);
const D0 = DIFF_TABLE[DIFF_KEY];

const scene = q('a-scene');

function ensureWorldTargets(){
  let wt = el('worldTargets');
  if (!wt && scene) {
    wt = DOC.createElement('a-entity');
    wt.id = 'worldTargets';
    scene.appendChild(wt);
  }
  return wt;
}
let worldTargets = ensureWorldTargets();

// ---------- HUD refs ----------
const hud = {
  time: el('hudTime'),
  score: el('hudScore'),
  combo: el('hudCombo'),
  miss: el('hudMiss'),
  feverBar: el('hudFever'),
  feverPct: el('hudFeverPct'),
  grade: el('hudGrade'),
  mode: el('hudMode'),
  diff: el('hudDiff'),
  plates: el('hudGroupsHave'),
  perfect: el('hudPerfectCount'),
  paused: el('hudPaused'),
  goalLine: el('hudGoalLine'),
  miniLine: el('hudMiniLine'),
  miniHint: el('hudMiniHint'),
};

const btn = {
  enterVR: el('btnEnterVR'),
  pause: el('btnPause'),
  restart: el('btnRestart'),
  playAgain: el('btnPlayAgain'),
};

const result = {
  wrap: el('resultBackdrop'),
  rMode: el('rMode'),
  rGrade: el('rGrade'),
  rScore: el('rScore'),
  rMaxCombo: el('rMaxCombo'),
  rMiss: el('rMiss'),
  rPerfect: el('rPerfect'),
  rGoals: el('rGoals'),
  rMinis: el('rMinis'),
  g1: el('rG1'), g2: el('rG2'), g3: el('rG3'), g4: el('rG4'), g5: el('rG5'), gT: el('rGTotal'),
};

if (hud.mode) hud.mode.textContent = (P.mode === 'research') ? 'Research' : 'Play';
if (hud.diff) hud.diff.textContent = DIFF_KEY.charAt(0).toUpperCase() + DIFF_KEY.slice(1);

// ---------- world (simple, dark) ----------
function ensureWorld(){
  if (!scene) return;
  if (!scene.querySelector('#hhaSky')) {
    const sky = DOC.createElement('a-sky');
    sky.id = 'hhaSky';
    sky.setAttribute('color', '#020617');
    scene.appendChild(sky);
  }
  if (!scene.querySelector('#hhaFloor')) {
    const floor = DOC.createElement('a-circle');
    floor.id = 'hhaFloor';
    floor.setAttribute('radius', '12');
    floor.setAttribute('rotation', '-90 0 0');
    floor.setAttribute('position', '0 0 -4');
    floor.setAttribute('material', 'shader:flat; color:#0b1120; opacity:0.80; transparent:true; side:double');
    scene.appendChild(floor);
  }
}

// ---------- safe-zone bounds (FIX invert) ----------
function safeUVBounds() {
  const W = Math.max(1, ROOT.innerWidth);
  const H = Math.max(1, ROOT.innerHeight);
  const pad = 12;

  const rtTop    = el('hudTop')?.getBoundingClientRect();
  const rtBottom = el('hudBottom')?.getBoundingClientRect();
  const rtLeft   = el('hudLeft')?.getBoundingClientRect();
  const rtRight  = el('hudRight')?.getBoundingClientRect();

  let safeLeft = pad;
  let safeRight = W - pad;
  let safeTop = pad;
  let safeBottom = H - pad;

  if (rtTop) safeTop = Math.max(safeTop, rtTop.bottom + pad);
  if (rtBottom) safeBottom = Math.min(safeBottom, rtBottom.top - pad);
  if (rtLeft) safeLeft = Math.max(safeLeft, rtLeft.right + pad);
  if (rtRight) safeRight = Math.min(safeRight, rtRight.left - pad);

  // keep at least a usable center area
  safeLeft = clamp(safeLeft, 0, W*0.60);
  safeRight = clamp(safeRight, W*0.40, W);
  safeTop = clamp(safeTop, 0, H*0.72);
  safeBottom = clamp(safeBottom, H*0.28, H);

  // convert to UV
  let uMin = clamp(safeLeft / W, 0.06, 0.49);
  let uMax = clamp(safeRight / W, 0.51, 0.94);
  let vMin = clamp(safeTop / H, 0.10, 0.70);
  let vMax = clamp(safeBottom / H, 0.30, 0.95);

  // ✅ FIX: if inverted (mobile HUD huge), force a sane center window
  if (uMin >= uMax) { uMin = 0.22; uMax = 0.78; }
  if (vMin >= vMax) { vMin = 0.26; vMax = 0.82; }

  // widen a bit if too narrow
  if ((uMax - uMin) < 0.18) { uMin = 0.18; uMax = 0.82; }
  if ((vMax - vMin) < 0.18) { vMin = 0.22; vMax = 0.88; }

  return { uMin, uMax, vMin, vMax };
}

function uvToFrustumXY(u, v, dist, fill) {
  const camObj = scene && scene.camera;
  const fov = (camObj && camObj.fov) ? camObj.fov : 60;
  const aspect = (camObj && camObj.aspect) ? camObj.aspect : (ROOT.innerWidth/Math.max(1,ROOT.innerHeight));
  const fovRad = fov * Math.PI/180;

  const planeH = 2 * dist * Math.tan(fovRad/2) * fill;
  const planeW = planeH * aspect;

  const x = (u - 0.5) * planeW;
  const y = (0.5 - v) * planeH;
  return { x, y };
}

function worldToScreen(vec3){
  const cam = scene && scene.camera;
  if (!cam) return { x: ROOT.innerWidth/2, y: ROOT.innerHeight/2 };
  const v = vec3.clone().project(cam);
  return {
    x: (v.x * 0.5 + 0.5) * ROOT.innerWidth,
    y: (-v.y * 0.5 + 0.5) * ROOT.innerHeight
  };
}

// ---------- Game state ----------
const S = {
  mode: (P.mode === 'research') ? 'research' : 'play',
  diff: DIFF_KEY,
  debug: !!P.debug,

  timeTotal: clamp(P.time, 20, 180),
  timeLeft: clamp(P.time, 0, 999),
  started: false,
  paused: false,

  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,
  perfect: 0,
  hits: 0,

  plateSet: new Set(),
  platesCleared: 0,

  fever: 0,
  shieldUntil: 0,
  blocked: 0,

  activeTarget: null,
  activeBornMs: 0,
  activeDieMs: 0,
  activeKind: '',
  activeData: null,
  lastSpawnMs: 0,

  slowUntil: 0,

  // adaptive (play only)
  skill: 0,
  recent: [],
  targetSize: D0.targetBase,

  // quests
  goalIndex: 0,
  goalsCleared: 0,
  goalDefs: [],
  activeGoal: null,

  miniIndex: 0,
  minisCleared: 0,
  miniDefs: [],
  activeMini: null,
  miniStartedMs: 0,
  miniOk: true,
};

// ---------- plate HUD ----------
function updatePlateHUD(){
  if (hud.plates) hud.plates.textContent = `${S.plateSet.size}/5`;
  if (result.g1) result.g1.textContent = String(S._rG1||0);
  if (result.g2) result.g2.textContent = String(S._rG2||0);
  if (result.g3) result.g3.textContent = String(S._rG3||0);
  if (result.g4) result.g4.textContent = String(S._rG4||0);
  if (result.g5) result.g5.textContent = String(S._rG5||0);
  if (result.gT) result.gT.textContent = String((S._rG1||0)+(S._rG2||0)+(S._rG3||0)+(S._rG4||0)+(S._rG5||0));
}

// ---------- grade ----------
function calcGrade(){
  const t = Math.max(1, S.timeTotal);
  const hitRate = S.hits / Math.max(1, (S.hits + S.miss));
  const perfectRate = S.perfect / Math.max(1, S.hits);
  const pace = S.score / t;

  let p = 0;
  p += clamp(pace / 35, 0, 1) * 0.45;
  p += clamp(hitRate, 0, 1) * 0.25;
  p += clamp(perfectRate, 0, 1) * 0.20;
  p += clamp(S.goalsCleared/2, 0, 1) * 0.10;

  if (S.miss === 0) p += 0.06;
  if (S.miss >= 5) p -= 0.10;

  p = clamp(p, 0, 1);

  if (p >= 0.92) return 'SSS';
  if (p >= 0.84) return 'SS';
  if (p >= 0.76) return 'S';
  if (p >= 0.62) return 'A';
  if (p >= 0.48) return 'B';
  return 'C';
}

function updateHUD(){
  if (hud.time) hud.time.textContent = String(Math.max(0, Math.ceil(S.timeLeft)));
  if (hud.score) hud.score.textContent = String(S.score|0);
  if (hud.combo) hud.combo.textContent = String(S.combo|0);
  if (hud.miss) hud.miss.textContent = String(S.miss|0);
  if (hud.perfect) hud.perfect.textContent = String(S.perfect|0);

  const pct = clamp(S.fever/100, 0, 1);
  if (hud.feverBar) hud.feverBar.style.width = `${Math.round(pct*100)}%`;
  if (hud.feverPct) hud.feverPct.textContent = `${Math.round(pct*100)}%`;

  if (hud.grade) hud.grade.textContent = calcGrade();
  if (hud.paused) hud.paused.style.display = S.paused ? '' : 'none';

  const goal = S.activeGoal;
  if (hud.goalLine && goal) {
    const v = goal.eval();
    const tgt = goal.target;
    const done = goal.invert ? (v <= tgt) : (v >= tgt);
    hud.goalLine.textContent = `Goal ${S.goalIndex+1}/2: ${goal.label} (${v}/${tgt}) ${done ? '✅' : ''}`;
  }

  const mini = S.activeMini;
  if (hud.miniLine && mini) {
    const msLeft = Math.max(0, mini.durMs - (nowMs() - S.miniStartedMs));
    const secLeft = (msLeft/1000).toFixed(1);
    const prog = (typeof mini.progress === 'function') ? ` • ${mini.progress()}` : '';
    hud.miniLine.textContent = `${mini.label}${prog} • ${secLeft}s`;
  }
  if (hud.miniHint && mini) hud.miniHint.textContent = mini.hint || '';
}

// ---------- quests ----------
function buildGoals(){
  const tgtPlates  = (S.diff === 'easy') ? 2 : (S.diff === 'hard') ? 4 : 3;
  const tgtPerfect = (S.diff === 'easy') ? 8 : (S.diff === 'hard') ? 16 : 12;

  const defs = [
    { id:'g_plate',   label:`🍽️ เคลียร์ “จานสมดุล” ให้ได้ ${tgtPlates} ใบ`, hint:'สะสมครบ 5 หมู่ = เคลียร์ 1 ใบ', eval: () => S.platesCleared, target: tgtPlates },
    { id:'g_perfect', label:`🌟 เก็บ Perfect ให้ได้ ${tgtPerfect} ครั้ง`, hint:'ยิงให้โดน “จุดหวาน” (วงเล็ก) จะได้ Perfect!', eval: () => S.perfect, target: tgtPerfect },
    { id:'g_nomiss',  label:`🛡️ MISS ไม่เกิน ${(S.diff==='easy')?2:(S.diff==='hard')?0:1}`, hint:'หลบขยะ + อย่าปล่อยของดีหมดเวลา', eval: () => S.miss, target: (S.diff==='easy')?2:(S.diff==='hard')?0:1, invert:true },
    { id:'g_combo',   label:`🔥 ทำ Max Combo ให้ถึง ${(S.diff==='easy')?6:(S.diff==='hard')?12:9}`, hint:'ยิงต่อเนื่องอย่าพลาด จะคอมโบพุ่ง!', eval: () => S.comboMax, target: (S.diff==='easy')?6:(S.diff==='hard')?12:9 },
  ];

  const pick = [defs[0]];
  const rest = defs.slice(1);
  pick.push(rest[Math.floor(Math.random()*rest.length)]);

  S.goalDefs = pick;
  S.goalIndex = 0;
  S.goalsCleared = 0;
  S.activeGoal = S.goalDefs[0];
}

function buildMinis(){
  const defs = [
    {
      id:'m_rush',
      label:'🧩 MINI: Plate Rush (8s)',
      hint:'ทำจานให้ครบ 5 หมู่ภายใน 8 วิ • ห้ามโดนขยะระหว่างทำ ✅',
      durMs: 8000,
      start: () => { S.miniOk = true; S.plateSet.clear(); updatePlateHUD(); },
      onHit: (kind) => { if (kind === 'junk' || kind === 'bomb') S.miniOk = false; },
      pass: () => (S.plateSet.size >= 5 && S.miniOk),
    },
    {
      id:'m_perfect5',
      label:'🧩 MINI: Perfect Streak',
      hint:'ทำ Perfect ติดกัน 5 ครั้ง (พลาดแล้วนับใหม่)!',
      durMs: 12000,
      start: () => { S._miniPerfectStreak = 0; },
      onHit: (kind, isPerfect) => { S._miniPerfectStreak = isPerfect ? (S._miniPerfectStreak||0)+1 : 0; },
      pass: () => ((S._miniPerfectStreak||0) >= 5),
      progress: () => `${(S._miniPerfectStreak||0)}/5`
    },
    {
      id:'m_nojunk',
      label:'🧩 MINI: No-Junk Zone (10s)',
      hint:'อยู่ให้รอด 10 วิ ห้ามโดนขยะ! (ถ้ามี Shield บล็อกได้ไม่ถือว่าโดน)',
      durMs: 10000,
      start: () => { S._miniNoJunkOk = true; },
      onHit: (kind, isPerfect, wasBlocked) => { if ((kind === 'junk' || kind === 'bomb') && !wasBlocked) S._miniNoJunkOk = false; },
      pass: () => !!S._miniNoJunkOk
    },
    {
      id:'m_gold2',
      label:'🧩 MINI: Gold Hunt (12s)',
      hint:'เก็บ 🌟 Gold ให้ได้ 2 อันภายในเวลา!',
      durMs: 12000,
      start: () => { S._miniGold = 0; },
      onHit: (kind) => { if (kind === 'gold') S._miniGold = (S._miniGold||0) + 1; },
      pass: () => ((S._miniGold||0) >= 2),
      progress: () => `${(S._miniGold||0)}/2`
    },
  ];

  S.miniDefs = defs;
  S.miniIndex = 0;
  S.minisCleared = 0;
  S.activeMini = defs[0];
  S.miniStartedMs = nowMs();
  defs[0].start && defs[0].start();
}

function goalPassed(goal){
  const v = goal.eval();
  return goal.invert ? (v <= goal.target) : (v >= goal.target);
}
function checkGoalProgress(){
  const g = S.activeGoal;
  if (!g) return;
  if (goalPassed(g)) {
    S.goalsCleared += 1;
    Particles.celebrate && Particles.celebrate('GOAL');
    addScore(320, 'GOAL +');
    S.goalIndex += 1;
    S.activeGoal = (S.goalIndex >= 2) ? null : S.goalDefs[S.goalIndex];
  }
}

function miniPassed(){
  const m = S.activeMini;
  if (!m) return false;
  try { return !!m.pass(); } catch(_) { return false; }
}
function miniTimeLeftMs(){
  const m = S.activeMini;
  if (!m) return 0;
  return Math.max(0, m.durMs - (nowMs() - S.miniStartedMs));
}
function stepMini(){
  const m = S.activeMini;
  if (!m) return;

  const msLeft = miniTimeLeftMs();

  // warn
  if (msLeft <= 2800 && msLeft > 0) {
    DOC.body.classList.add('hha-warn');
    DOC.body.classList.toggle('hha-warn-on', (Math.floor(msLeft/250) % 2) === 0);
    DOC.body.classList.toggle('hha-shake-on', msLeft <= 1200);
    if ((Math.floor(msLeft/500) !== Math.floor((msLeft+16)/500))) {
      AudioFX.beep(msLeft<=1200 ? 520 : 760, 0.035, 0.05);
    }
  } else {
    DOC.body.classList.remove('hha-warn-on','hha-shake-on');
  }

  const done = miniPassed();
  const timeout = (msLeft <= 0);

  if (done) {
    S.minisCleared += 1;
    addScore(240, 'MINI +');
    Particles.celebrate && Particles.celebrate('MINI');

    S.miniIndex = (S.miniIndex + 1) % S.miniDefs.length;
    S.activeMini = S.miniDefs[S.miniIndex];
    S.miniStartedMs = nowMs();
    S.activeMini.start && S.activeMini.start();
    DOC.body.classList.remove('hha-warn-on','hha-shake-on');
    return;
  }

  if (timeout) {
    addScore(-60, 'FAIL');
    feverLose(10);
    S.combo = 0;

    S.miniIndex = (S.miniIndex + 1) % S.miniDefs.length;
    S.activeMini = S.miniDefs[S.miniIndex];
    S.miniStartedMs = nowMs();
    S.activeMini.start && S.activeMini.start();
    DOC.body.classList.remove('hha-warn-on','hha-shake-on');
  }
}

// ---------- scoring / fever ----------
function addScore(delta, label=''){
  S.score = (S.score + (delta|0))|0;
  if (label) Particles.scorePop(ROOT.innerWidth*0.5, ROOT.innerHeight*0.55, label, delta>=0 ? 'GOOD' : 'BAD');
}
function isShieldOn(){ return nowMs() < S.shieldUntil; }
function feverAdd(v){
  S.fever = clamp(S.fever + v, 0, 100);
  if (S.fever >= 100) {
    S.fever = 100;
    S.shieldUntil = nowMs() + (D0.shieldSec * 1000);
    Particles.celebrate && Particles.celebrate('FEVER');
    AudioFX.beep(1040, 0.10, 0.08);
  }
}
function feverLose(v){ S.fever = clamp(S.fever - v, 0, 100); }

// ---------- target pick ----------
function pickTargetKind(){
  const r = Math.random();

  if (r < D0.specialRatio) {
    const rr = Math.random();
    if (rr < 0.50) return { kind:'gold', data: SPECIAL.gold };
    if (rr < 0.78) return { kind:'slow', data: SPECIAL.slow };
    return { kind:'bomb', data: SPECIAL.bomb };
  }

  if (r < D0.specialRatio + D0.junkRatio) {
    const j = JUNK[Math.floor(Math.random()*JUNK.length)];
    return { kind:'junk', data: j };
  }

  const missing = FOOD_GROUPS.filter(g => !S.plateSet.has(g.id));
  const pick = (missing.length ? missing : FOOD_GROUPS);
  const g = pick[Math.floor(Math.random()*pick.length)];
  return { kind:'good', data: g };
}

// ---------- active target lifecycle ----------
function clearActiveTarget(){
  if (S.activeTarget) { try { S.activeTarget.remove(); } catch(_) {} }
  S.activeTarget = null;
  S.activeKind = '';
  S.activeData = null;
}

function spawnTarget(){
  worldTargets = worldTargets || ensureWorldTargets();
  if (!worldTargets || !scene) return;

  clearActiveTarget();

  const tk = pickTargetKind();
  const dist = D0.dist;

  let size = D0.targetBase;
  if (S.mode !== 'research') {
    size = D0.targetBase * (1 - 0.18 * S.skill);
    size = clamp(size, D0.targetBase*0.78, D0.targetBase*1.08);
  }
  S.targetSize = size;

  const emoji = tk.data.emoji || '🍽️';
  const ent = makeEmojiTargetEntity(emoji, size);
  ent.setAttribute('hha-wobble', `amp:${D0.wobbleAmp}; spd:${D0.wobbleSpd}`);

  const b = safeUVBounds();
  const u = lerp(b.uMin, b.uMax, Math.random());
  const v = lerp(b.vMin, b.vMax, Math.random());
  const { x, y } = uvToFrustumXY(u, v, dist, D0.fill);

  const camY = 1.6;
  ent.setAttribute('position', `${x.toFixed(3)} ${(camY + y).toFixed(3)} -${dist.toFixed(3)}`);

  ent.dataset.kind = tk.kind;
  ent.dataset.groupId = (tk.kind === 'good') ? String(tk.data.id) : '';

  // pop-in
  ent.setAttribute('animation__in', 'property:scale; from:0.2 0.2 0.2; to:1 1 1; dur:130; easing:easeOutBack');

  worldTargets.appendChild(ent);

  S.activeTarget = ent;
  S.activeKind = tk.kind;
  S.activeData = tk.data;
  S.activeBornMs = nowMs();
  S.activeDieMs = S.activeBornMs + D0.lifeMs;

  if (S.debug) console.log('[PlateVR] spawn', tk.kind, tk.data, b);
}

function expireTargetIfNeeded(){
  if (!S.activeTarget) return;
  const t = nowMs();
  if (t < S.activeDieMs) return;

  const kind = S.activeKind;

  if (kind === 'good' || kind === 'gold' || kind === 'slow') {
    if (kind === 'good') { S.miss += 1; S.combo = 0; }
    S.fever = clamp(S.fever - D0.feverLoss, 0, 100);
  }

  try {
    const pos = S.activeTarget.object3D.position.clone();
    const sp = worldToScreen(pos);
    Particles.scorePop(sp.x, sp.y, 'MISS', 'BAD');
  } catch(_) {}

  clearActiveTarget();
}

// ---------- plate logic ----------
function plateCollectGroup(groupId){
  const gid = Number(groupId)||0;
  if (!gid) return;

  if (!S.plateSet.has(gid)) {
    S.plateSet.add(gid);
    if (gid===1) S._rG1 = (S._rG1||0) + 1;
    if (gid===2) S._rG2 = (S._rG2||0) + 1;
    if (gid===3) S._rG3 = (S._rG3||0) + 1;
    if (gid===4) S._rG4 = (S._rG4||0) + 1;
    if (gid===5) S._rG5 = (S._rG5||0) + 1;
    updatePlateHUD();
  }

  if (S.plateSet.size >= 5) {
    S.platesCleared += 1;
    S.plateSet.clear();
    updatePlateHUD();
    S.timeLeft += D0.timeBonusOnPlate;
    addScore(280, 'PLATE +');
    Particles.celebrate && Particles.celebrate('PLATE');
    AudioFX.beep(880, 0.07, 0.06);
    AudioFX.beep(1040, 0.07, 0.06);
    checkGoalProgress();
  }
}

// ---------- raycast + judgement ----------
const raycaster = THREE ? new THREE.Raycaster() : null;

function centerRaycast(){
  if (!raycaster || !scene || !scene.camera) return null;
  const cam = scene.camera;

  raycaster.setFromCamera({ x:0, y:0 }, cam);

  const meshes = [];
  if (S.activeTarget) {
    const m = S.activeTarget.getObject3D('mesh');
    if (m) meshes.push(m);
  }
  if (!meshes.length) return null;

  const hits = raycaster.intersectObjects(meshes, true);
  return (hits && hits.length) ? hits[0] : null;
}

function computePerfectFromUV(hit){
  if (!hit || !hit.uv) return false;
  const du = hit.uv.x - 0.5;
  const dv = hit.uv.y - 0.5;
  const d = Math.sqrt(du*du + dv*dv);
  const r = (S.diff==='hard') ? 0.16 : (S.diff==='easy') ? 0.22 : 0.19;
  return d <= r;
}

function shoot(){
  if (!S.started || S.paused) return;
  if (!S.activeTarget) return;

  const hit = centerRaycast();
  if (!hit) return;

  const ent = hit.object && hit.object.userData && hit.object.userData._plateEntity;
  if (!ent) return;

  const kind = ent.dataset.kind || S.activeKind;
  const groupId = ent.dataset.groupId || '';

  const wasShield = isShieldOn();
  let wasBlocked = false;

  const isPerfect = computePerfectFromUV(hit);
  const posWorld = hit.point ? hit.point.clone() : ent.object3D.position.clone();
  const sp = worldToScreen(posWorld);

  try { Particles.burstAt(sp.x, sp.y, (kind==='junk'||kind==='bomb') ? 'BAD' : 'GOOD'); } catch(_) {}

  if (kind === 'slow') {
    S.slowUntil = nowMs() + 6000;
    addScore(SPECIAL.slow.score + (isPerfect?50:0), isPerfect?'PERFECT':'SLOW');
    feverAdd(D0.feverGain);
    S.combo += 1;
  }

  if (kind === 'gold') {
    addScore(SPECIAL.gold.score + (isPerfect?80:0), isPerfect?'PERFECT':'GOLD');
    feverAdd(D0.feverGain + 2);
    S.combo += 1;
  }

  if (kind === 'bomb') {
    if (wasShield) {
      wasBlocked = true;
      S.blocked += 1;
      Particles.scorePop(sp.x, sp.y, 'BLOCK', 'GOOD');
      AudioFX.beep(520, 0.05, 0.06);
    } else {
      addScore(SPECIAL.bomb.score, 'BOMB');
      S.miss += 1;
      S.combo = 0;
      feverLose(D0.feverLoss);
      AudioFX.beep(180, 0.08, 0.08);
    }
  }

  if (kind === 'junk') {
    if (wasShield) {
      wasBlocked = true;
      S.blocked += 1;
      Particles.scorePop(sp.x, sp.y, 'BLOCK', 'GOOD');
      AudioFX.beep(520, 0.05, 0.06);
    } else {
      addScore((S.activeData && S.activeData.score) ? S.activeData.score : -90, 'JUNK');
      S.miss += 1;
      S.combo = 0;
      feverLose(D0.feverLoss);
      AudioFX.beep(220, 0.07, 0.08);
    }
  }

  if (kind === 'good') {
    const base = (S.activeData && S.activeData.score) ? S.activeData.score : 160;
    const comboBonus = Math.min(120, (S.combo|0) * 12);
    const perfectBonus = isPerfect ? 90 : 0;
    const shieldBonus = wasShield ? 20 : 0;

    addScore(base + comboBonus + perfectBonus + shieldBonus, isPerfect ? 'PERFECT' : 'GOOD');

    S.hits += 1;
    S.combo += 1;
    S.comboMax = Math.max(S.comboMax, S.combo);
    if (isPerfect) S.perfect += 1;

    feverAdd(isPerfect ? (D0.feverGain + 3) : D0.feverGain);

    plateCollectGroup(groupId);

    if (S.activeMini && typeof S.activeMini.onHit === 'function') S.activeMini.onHit(kind, isPerfect, wasBlocked);

    S.recent.push(isPerfect ? 1.15 : 1);
    if (S.recent.length > 16) S.recent.shift();
  } else {
    if (S.activeMini && typeof S.activeMini.onHit === 'function') S.activeMini.onHit(kind, isPerfect, wasBlocked);
    S.recent.push(wasBlocked ? 0.7 : 0);
    if (S.recent.length > 16) S.recent.shift();
  }

  if (isPerfect && kind !== 'junk' && kind !== 'bomb') AudioFX.beep(980, 0.04, 0.05);

  logEvent({
    game: 'PlateVR',
    ts: new Date().toISOString(),
    kind,
    groupId: groupId || null,
    perfect: !!isPerfect,
    blocked: !!wasBlocked,
    score: S.score|0,
    combo: S.combo|0,
    miss: S.miss|0,
    timeLeft: Math.ceil(S.timeLeft),
    mode: S.mode,
    diff: S.diff
  });

  checkGoalProgress();
  clearActiveTarget();
}

// ---------- adaptive ----------
function updateSkill(){
  if (S.mode === 'research') return;
  if (S.recent.length < 8) return;
  const avg = S.recent.reduce((a,b)=>a+b,0)/S.recent.length;
  const sk = clamp((avg - 0.35) / 0.75, 0, 1);
  S.skill = lerp(S.skill, sk, 0.15);
}

// ---------- minis timing ----------
function miniNext(){
  S.miniIndex = (S.miniIndex + 1) % S.miniDefs.length;
  S.activeMini = S.miniDefs[S.miniIndex];
  S.miniStartedMs = nowMs();
  S.activeMini.start && S.activeMini.start();
  DOC.body.classList.remove('hha-warn-on','hha-shake-on');
}

// ---------- start / end / reset ----------
function startGame(){
  if (S.started) return;
  S.started = true;
  S.paused = false;
  S.timeLeft = S.timeTotal;

  buildGoals();
  buildMinis();

  S._rG1=S._rG2=S._rG3=S._rG4=S._rG5=0;
  updatePlateHUD();

  const ok = cloudInitMaybe(P.log || '', S.debug);
  if (S.debug) console.log('[PlateVR] cloud init', ok);

  const profile = safeJsonParse(sessionStorage.getItem('HHA_STUDENT_PROFILE') || '', {}) || {};
  const sessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  S._sessionId = sessionId;

  logSession({
    game: 'PlateVR',
    sessionId,
    ts: new Date().toISOString(),
    mode: S.mode,
    diff: S.diff,
    timeTotal: S.timeTotal,
    profile
  });

  S.lastSpawnMs = nowMs();
  spawnTarget();
  updateHUD();
}

function endGame(){
  S.started = false;
  S.paused = true;
  clearActiveTarget();

  const grade = calcGrade();

  if (result.wrap) result.wrap.style.display = 'flex';
  if (result.rMode) result.rMode.textContent = (S.mode === 'research') ? 'Research' : 'Play';
  if (result.rGrade) result.rGrade.textContent = grade;
  if (result.rScore) result.rScore.textContent = String(S.score|0);
  if (result.rMaxCombo) result.rMaxCombo.textContent = String(S.comboMax|0);
  if (result.rMiss) result.rMiss.textContent = String(S.miss|0);
  if (result.rPerfect) result.rPerfect.textContent = String(S.perfect|0);
  if (result.rGoals) result.rGoals.textContent = `${S.goalsCleared}/2`;
  if (result.rMinis) result.rMinis.textContent = `${S.minisCleared}/${S.miniDefs.length}`;
  updatePlateHUD();

  logEvent({
    game: 'PlateVR',
    type: 'END',
    sessionId: S._sessionId,
    ts: new Date().toISOString(),
    score: S.score|0,
    miss: S.miss|0,
    perfect: S.perfect|0,
    comboMax: S.comboMax|0,
    goalsCleared: S.goalsCleared|0,
    minisCleared: S.minisCleared|0,
    platesCleared: S.platesCleared|0,
    grade
  });
}

function resetGame(){
  clearActiveTarget();

  S.started = false;
  S.paused = false;

  S.score = 0; S.combo = 0; S.comboMax = 0;
  S.miss = 0; S.perfect = 0; S.hits = 0;

  S.plateSet.clear(); S.platesCleared = 0;

  S.fever = 0; S.shieldUntil = 0; S.blocked = 0;

  S.lastSpawnMs = 0; S.slowUntil = 0;
  S.skill = 0; S.recent.length = 0;

  if (result.wrap) result.wrap.style.display = 'none';

  startGame();
}

// ---------- pause ----------
function setPaused(p){
  S.paused = !!p;
  if (hud.paused) hud.paused.style.display = S.paused ? '' : 'none';
}

// ---------- loop ----------
let _lastTick = nowMs();

function tick(){
  const t = nowMs();
  const dt = Math.min(0.05, (t - _lastTick)/1000);
  _lastTick = t;

  if (S.started && !S.paused) {
    const slowMul = (t < S.slowUntil) ? 0.60 : 1.0;
    S.timeLeft -= dt * slowMul;

    if (S.timeLeft <= 0) {
      S.timeLeft = 0;
      updateHUD();
      endGame();
      requestAnimationFrame(tick);
      return;
    }

    expireTargetIfNeeded();

    const spawnMs = (t < S.slowUntil) ? (D0.spawnMs * 1.25) : D0.spawnMs;
    if (!S.activeTarget || (t - S.lastSpawnMs) >= spawnMs) {
      S.lastSpawnMs = t;
      spawnTarget();
    }

    stepMini();
    updateSkill();
  }

  updateHUD();
  requestAnimationFrame(tick);
}

// ---------- input ----------
function isUiClickTarget(target){
  if (!target) return false;
  return !!(target.closest && target.closest('.card, .btn, #resultBackdrop'));
}

function bindInputs(){
  // enable drag + gyro (must override HTML look-controls)
  const camEl = el('cam');
  if (camEl) {
    camEl.setAttribute('look-controls', 'touchEnabled:true; mouseEnabled:true; pointerLockEnabled:false; magicWindowTrackingEnabled:true');
  }

  DOC.addEventListener('pointerdown', async (e) => {
    if (isUiClickTarget(e.target)) return;
    await AudioFX.resume();
    if (!S.started) startGame();
    if (!S.paused) shoot();
  }, { passive:true });

  btn.pause && btn.pause.addEventListener('click', async () => {
    await AudioFX.resume();
    setPaused(!S.paused);
  });

  btn.restart && btn.restart.addEventListener('click', async () => {
    await AudioFX.resume();
    resetGame();
  });

  btn.playAgain && btn.playAgain.addEventListener('click', async () => {
    await AudioFX.resume();
    resetGame();
  });

  btn.enterVR && btn.enterVR.addEventListener('click', async () => {
    await AudioFX.resume();
    if (!scene) return;
    try { scene.enterVR(); } catch (e) { console.warn('[PlateVR] enterVR failed', e); }
  });

  if (result.wrap) {
    result.wrap.addEventListener('click', (e) => {
      if (e.target === result.wrap) result.wrap.style.display = 'none';
    });
  }

  DOC.addEventListener('click', () => { AudioFX.resume(); }, { once:true, passive:true });
}

// ---------- boot ----------
(function boot(){
  ensureWorld();
  worldTargets = ensureWorldTargets();
  bindInputs();
  updateHUD();
  requestAnimationFrame(tick);

  ROOT.addEventListener('resize', () => { /* safeUVBounds recalculates on spawn */ });

  if (S.debug) console.log('[PlateVR] boot', { mode:S.mode, diff:S.diff, time:S.timeTotal });
})();