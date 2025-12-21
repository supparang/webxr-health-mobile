// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (PRODUCTION SAFE)
// ✅ FIX: ห้าม import initCloudLogger (เพราะ hha-cloud-logger.js เป็น IIFE ไม่ใช่ ES module)
// ✅ ใช้ window.HHACloudLogger.init(...) ผ่าน wrapper initCloudLoggerSafe()
// ✅ รองรับ PC/Mobile/VR: click/tap-anywhere + gaze/fuse click
// ✅ Targets เป็น “Emoji Texture” (SVG data-url) บน a-image -> เห็นเป็น emoji จริงใน A-Frame
// ✅ HUD + Quest/Mini + Grade (SSS/SS/S/A/B/C) + Result modal + Cloud Logger events
//
// ใช้กับ: /herohealth/plate-vr.html (ตามที่คุณแปะ)

'use strict';

// -------------------- URL params --------------------
const URLX = new URL(location.href);
const DIFF = String(URLX.searchParams.get('diff') || 'normal').toLowerCase();
let TIME_TOTAL = parseInt(URLX.searchParams.get('time') || '70', 10);
if (Number.isNaN(TIME_TOTAL) || TIME_TOTAL <= 0) TIME_TOTAL = 70;
TIME_TOTAL = Math.max(20, Math.min(180, TIME_TOTAL));
const MODE = (String(URLX.searchParams.get('run') || 'play').toLowerCase() === 'research') ? 'research' : 'play';
const DEBUG = (URLX.searchParams.get('debug') === '1');

window.DIFF = DIFF;
window.TIME = TIME_TOTAL;
window.MODE = MODE;

// -------------------- Project tag + Logger endpoint --------------------
const PROJECT_TAG = 'HeroHealth-PlateVR';
const LOGGER_ENDPOINT =
  (URLX.searchParams.get('log') || '') ||
  (sessionStorage.getItem('HHA_LOGGER_ENDPOINT') || '') ||
  // default (คุณเคยใช้ในโปรเจกต์) — เปลี่ยนได้จาก ?log=
  'https://script.google.com/macros/s/AKfycbzOVSfe_gLDBCI7wXhVmIR2h74wGvbSzGQmoi1QbfwZgutreu0ImKQFxK4DZzGEzv7hiA/exec';

try { if (LOGGER_ENDPOINT) sessionStorage.setItem('HHA_LOGGER_ENDPOINT', LOGGER_ENDPOINT); } catch (_) {}

// -------------------- DOM helpers --------------------
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();

// -------------------- FX (particles.js IIFE) --------------------
const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop() {}, burstAt() {}, toast() {}, celebrate() {}, objPop() {} };

// -------------------- Cloud Logger (global IIFE) --------------------
function initCloudLoggerSafe(opts = {}) {
  const endpoint = String(opts.endpoint || '');
  const debug = !!opts.debug;

  try { if (endpoint) sessionStorage.setItem('HHA_LOGGER_ENDPOINT', endpoint); } catch (_) {}

  const api = (ROOT && ROOT.HHACloudLogger) ? ROOT.HHACloudLogger : null;
  if (api && typeof api.init === 'function') {
    try {
      api.init({ endpoint, debug });
      if (debug) console.log('[PlateVR] CloudLogger.init OK', endpoint);
      return true;
    } catch (e) {
      if (debug) console.warn('[PlateVR] CloudLogger.init failed', e);
      return false;
    }
  }
  if (debug) console.warn('[PlateVR] HHACloudLogger not found (script not loaded?)');
  return false;
}

function logSession(payload) {
  try {
    window.dispatchEvent(new CustomEvent('hha:log_session', { detail: payload }));
  } catch (_) {}
}

function logEvent(payload) {
  try {
    window.dispatchEvent(new CustomEvent('hha:log_event', { detail: payload }));
  } catch (_) {}
}

function logProfile(payload) {
  try {
    window.dispatchEvent(new CustomEvent('hha:log_profile', { detail: payload }));
  } catch (_) {}
}

// -------------------- Audio tick (no external files) --------------------
function beepTick(freq = 880, dur = 0.06, vol = 0.05) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = beepTick._ctx || (beepTick._ctx = new AC());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch (_) {}
}

// -------------------- Inject warning FX CSS --------------------
(function injectWarnCSS() {
  const css = `
  body.hha-warn-flash{
    animation: hhaWarnFlash .18s linear infinite;
  }
  @keyframes hhaWarnFlash{
    0%{ box-shadow: inset 0 0 0 0 rgba(250,204,21,0); }
    100%{ box-shadow: inset 0 0 0 12px rgba(250,204,21,0.22); }
  }
  body.hha-shake{
    animation: hhaShake .12s linear infinite;
  }
  @keyframes hhaShake{
    0%{ transform: translate3d(0,0,0); }
    25%{ transform: translate3d(1px,0,0); }
    50%{ transform: translate3d(0,1px,0); }
    75%{ transform: translate3d(-1px,0,0); }
    100%{ transform: translate3d(0,0,0); }
  }`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
})();

// -------------------- Difficulty --------------------
const DIFF_TABLE = {
  easy:   { spawnMs: 950,  lifeMs: 1600, maxActive: 5, scale: 1.15, junkRatio: 0.20, feverGain: 10 },
  normal: { spawnMs: 820,  lifeMs: 1450, maxActive: 6, scale: 1.00, junkRatio: 0.26, feverGain: 11 },
  hard:   { spawnMs: 700,  lifeMs: 1300, maxActive: 7, scale: 0.90, junkRatio: 0.32, feverGain: 12 }
};
const D = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// โหมดวิจัย: ล็อกตาม diff (ไม่ adaptive)
const ADAPTIVE_ENABLED = (MODE === 'play');

// -------------------- Game state --------------------
const S = {
  started: false,
  ended: false,
  paused: false,

  t0: 0,
  lastTick: 0,

  timeLeft: TIME_TOTAL,
  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,
  perfect: 0,

  fever: 0,
  feverOn: false,
  feverUntil: 0,

  // Plate groups
  groupsGot: [false, false, false, false, false],
  platesCleared: 0,
  groupsTotalHits: [0, 0, 0, 0, 0], // G1..G5 counters

  // Quest / mini
  goalsCleared: 0,
  goalsTotal: 2,
  minisCleared: 0,
  minisTotal: 3,
  activeGoalIndex: 0,
  activeMiniIndex: -1,
  miniActive: false,
  miniStartAt: 0,
  miniEndAt: 0,
  miniNoJunkOK: true,
  miniWarnLastSec: -1,

  // Spawning
  spawnTimer: 0,
  activeTargets: new Set(),

  // Adaptive (simple)
  adaptScoreWindow: [],
  adaptScaleMul: 1.0,

  // Session
  sessionId: '',
  ctx: {}
};

// -------------------- Content (emoji sets) --------------------
const FOOD_GROUPS = [
  { id: 1, label: 'โปรตีน', emoji: ['🥚','🐟','🥩','🫘','🥛'] },
  { id: 2, label: 'คาร์บ/แป้ง', emoji: ['🍚','🍞','🥔','🍜','🥨'] },
  { id: 3, label: 'ผัก', emoji: ['🥦','🥬','🥕','🌽','🥒'] },
  { id: 4, label: 'ผลไม้', emoji: ['🍎','🍌','🍊','🍉','🍇'] },
  { id: 5, label: 'ไขมันดี', emoji: ['🥑','🫒','🥜','🧀','🍯'] }
];
const JUNK = ['🍭','🍟','🥤','🍩','🍰','🍿','🧋'];

function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

// Emoji -> SVG data-url (render emoji จริงใน a-image)
function emojiDataURL(emoji, bg = 'rgba(0,0,0,0)') {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <rect x="0" y="0" width="256" height="256" rx="56" ry="56" fill="${bg}"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
      font-size="168" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">
      ${emoji}
    </text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

// -------------------- HUD binding --------------------
const HUD = {
  time: $('hudTime'),
  score: $('hudScore'),
  combo: $('hudCombo'),
  miss: $('hudMiss'),
  paused: $('hudPaused'),
  feverBar: $('hudFever'),
  feverPct: $('hudFeverPct'),
  grade: $('hudGrade'),
  mode: $('hudMode'),
  diff: $('hudDiff'),
  groupsHave: $('hudGroupsHave'),
  perfect: $('hudPerfectCount'),
  goalLine: $('hudGoalLine'),
  miniLine: $('hudMiniLine'),
  miniHint: $('hudMiniHint'),

  // Result
  backdrop: $('resultBackdrop'),
  rMode: $('rMode'),
  rGrade: $('rGrade'),
  rScore: $('rScore'),
  rMaxCombo: $('rMaxCombo'),
  rMiss: $('rMiss'),
  rPerfect: $('rPerfect'),
  rGoals: $('rGoals'),
  rMinis: $('rMinis'),
  rG: [ $('rG1'), $('rG2'), $('rG3'), $('rG4'), $('rG5') ],
  rGTotal: $('rGTotal'),

  // Buttons
  btnVR: $('btnEnterVR'),
  btnPause: $('btnPause'),
  btnRestart: $('btnRestart'),
  btnPlayAgain: $('btnPlayAgain')
};

function setText(el, v) { if (el) el.textContent = String(v); }

function gradeFrom() {
  // สูตรง่าย ๆ แต่ได้อารมณ์: เน้น plates + miss ต่ำ + score
  const accPenalty = Math.min(0.45, S.miss * 0.06);
  const plateBoost = Math.min(0.50, S.platesCleared * 0.10);
  const perfBoost = Math.min(0.20, S.perfect * 0.01);
  const scoreNorm = Math.min(1.0, S.score / (TIME_TOTAL * 380)); // scale คร่าว ๆ

  let p = scoreNorm + plateBoost + perfBoost - accPenalty;
  p = clamp(p, 0, 1.25);

  if (p >= 1.12) return 'SSS';
  if (p >= 1.00) return 'SS';
  if (p >= 0.88) return 'S';
  if (p >= 0.72) return 'A';
  if (p >= 0.54) return 'B';
  return 'C';
}

function updateHUD(force = false) {
  if (!HUD.time) return;

  setText(HUD.time, Math.max(0, Math.ceil(S.timeLeft)));
  setText(HUD.score, S.score | 0);
  setText(HUD.combo, S.combo | 0);
  setText(HUD.miss, S.miss | 0);
  setText(HUD.perfect, S.perfect | 0);

  const fPct = clamp(Math.round(S.fever), 0, 100);
  if (HUD.feverBar) HUD.feverBar.style.width = `${fPct}%`;
  setText(HUD.feverPct, `${fPct}%`);

  const g = gradeFrom();
  setText(HUD.grade, g);

  setText(HUD.mode, MODE === 'research' ? 'Research' : 'Play');
  setText(HUD.diff, DIFF.charAt(0).toUpperCase() + DIFF.slice(1));

  const have = S.groupsGot.reduce((a,b)=> a + (b?1:0), 0);
  setText(HUD.groupsHave, `${have}/5`);

  // Goal line
  const goalTxt = currentGoalText();
  if (HUD.goalLine) HUD.goalLine.textContent = goalTxt;

  // Mini line
  const miniTxt = currentMiniText();
  if (HUD.miniLine) HUD.miniLine.textContent = miniTxt.title;
  if (HUD.miniHint) HUD.miniHint.textContent = miniTxt.hint;

  if (HUD.paused) HUD.paused.style.display = S.paused ? 'inline-flex' : 'none';
}

function currentGoalText() {
  // 2 goals ต่อรัน
  // G1: เคลียร์จานสมดุล X ใบ
  // G2: PERFECT X ครั้ง
  const tgtPlates = (DIFF === 'easy') ? 2 : (DIFF === 'hard' ? 4 : 3);
  const tgtPerfect = (DIFF === 'easy') ? 6 : (DIFF === 'hard' ? 12 : 9);

  if (S.activeGoalIndex === 0) {
    const v = S.platesCleared;
    const pass = v >= tgtPlates;
    return `Goal 1/2: 🍽️ เคลียร์ “จานสมดุล” ให้ได้ ${tgtPlates} ใบ  (${v}/${tgtPlates}) ${pass ? '✅' : ''}`;
  } else {
    const v = S.perfect;
    const pass = v >= tgtPerfect;
    return `Goal 2/2: 🌟 PERFECT ให้ได้ ${tgtPerfect} ครั้ง  (${v}/${tgtPerfect}) ${pass ? '✅' : ''}`;
  }
}

function currentMiniText() {
  if (!S.miniActive) return { title: '…', hint: 'รอภารกิจย่อยถัดไป' };

  const left = Math.max(0, (S.miniEndAt - now()) / 1000);
  const sec = Math.ceil(left);

  if (S.activeMiniIndex === 0) {
    return {
      title: `🧩 MINI: Plate Rush (${sec}s)`,
      hint: `ทำจานให้ครบ 5 หมู่ภายใน 8 วิ • ห้ามโดนขยะระหว่างทำ ${S.miniNoJunkOK ? '✅' : '❌'}`
    };
  }
  if (S.activeMiniIndex === 1) {
    return {
      title: `🧩 MINI: Clean Streak (${sec}s)`,
      hint: `เก็บของดีติดกัน 10 ครั้ง • ห้ามโดนขยะ ${S.miniNoJunkOK ? '✅' : '❌'}`
    };
  }
  return {
    title: `🧩 MINI: Rainbow Bite (${sec}s)`,
    hint: `เก็บ “ผัก+ผลไม้” ภายใน 4 วิ (อย่างละ 1) • ห้ามโดนขยะ ${S.miniNoJunkOK ? '✅' : '❌'}`
  };
}

// -------------------- A-Frame refs --------------------
let scene, camEl, worldRoot, cursorEl;

// -------------------- Target spawning --------------------
function makeTarget(def) {
  // def: { kind:'good'|'junk', groupIndex?:0..4, emoji:'🥦', lifeMs, scale }
  const el = document.createElement('a-image');
  el.setAttribute('src', emojiDataURL(def.emoji));
  el.setAttribute('transparent', 'true');
  el.setAttribute('alpha-test', '0.1');
  el.setAttribute('class', 'plateTarget');
  el.setAttribute('crossorigin', 'anonymous');

  // random position in front of camera (pop-in)
  const z = -3.0 - Math.random() * 1.4;
  const x = (Math.random() * 2.6 - 1.3);
  const y = 1.15 + Math.random() * 1.25;

  el.setAttribute('position', `${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);

  const sc = def.scale;
  el.setAttribute('scale', `${sc.toFixed(3)} ${sc.toFixed(3)} ${sc.toFixed(3)}`);

  // Glow-ish background (A-Frame image only — ใช้ FX แทน)
  el.dataset.kind = def.kind;
  el.dataset.group = (def.groupIndex != null) ? String(def.groupIndex) : '';
  el.dataset.emoji = def.emoji;
  el.dataset.spawnAt = String(now());
  el.dataset.lifeMs = String(def.lifeMs);
  el.dataset.dead = '0';

  // click hit (VR fuse/cursor จะยิง click)
  el.addEventListener('click', (ev) => {
    ev && ev.stopPropagation && ev.stopPropagation();
    hitTarget(el, 'entity-click');
  });

  return el;
}

function despawnTarget(el) {
  try {
    if (!el) return;
    S.activeTargets.delete(el);
    if (el.parentNode) el.parentNode.removeChild(el);
  } catch (_) {}
}

function spawnOne() {
  if (!scene || !worldRoot) return;
  if (S.paused || S.ended) return;
  if (S.activeTargets.size >= D.maxActive) return;

  const junkPick = Math.random() < D.junkRatio;
  let def;

  // adaptive scale (play mode only)
  const scaleMul = ADAPTIVE_ENABLED ? S.adaptScaleMul : 1.0;

  if (junkPick) {
    def = {
      kind: 'junk',
      emoji: pick(JUNK),
      lifeMs: D.lifeMs,
      scale: D.scale * 0.95 * scaleMul
    };
  } else {
    const gi = (Math.random() * 5) | 0;
    def = {
      kind: 'good',
      groupIndex: gi,
      emoji: pick(FOOD_GROUPS[gi].emoji),
      lifeMs: D.lifeMs,
      scale: D.scale * 1.00 * scaleMul
    };
  }

  const el = makeTarget(def);
  worldRoot.appendChild(el);
  S.activeTargets.add(el);

  // burst FX in screen space (เบา ๆ)
  try { Particles.burstAt(50 + Math.random()*20, 50 + Math.random()*20, def.kind === 'junk' ? 'TRAP' : 'GOOD'); } catch (_) {}

  // auto-despawn by lifetime (good/junk หมดเวลาหายไปเฉย ๆ; MISS ไม่นับ)
  const lifeMs = def.lifeMs;
  setTimeout(() => {
    if (!el || el.dataset.dead === '1') return;
    // expire silently
    despawnTarget(el);
  }, lifeMs);
}

function orientTargetsToCamera() {
  if (!camEl) return;
  const camObj = camEl.object3D;
  if (!camObj) return;

  for (const el of S.activeTargets) {
    if (!el || !el.object3D) continue;
    // billboard (look at camera)
    try {
      el.object3D.lookAt(camObj.getWorldPosition(new THREE.Vector3()));
    } catch (_) {
      // THREE might be hidden — A-Frame has it usually
      try { el.object3D.lookAt(camObj.position); } catch (_) {}
    }
    // subtle float
    const spawnAt = parseFloat(el.dataset.spawnAt || '0') || 0;
    const t = (now() - spawnAt) / 1000;
    const p = el.getAttribute('position');
    if (p) {
      const yy = (p.y || 1.5) + Math.sin(t * 3.2) * 0.005;
      el.setAttribute('position', `${p.x} ${yy} ${p.z}`);
    }
  }
}

// -------------------- Hit logic --------------------
function addScore(base, label = 'GOOD') {
  let mult = 1.0;
  if (S.feverOn && now() < S.feverUntil) mult = 1.5;
  const add = Math.round(base * mult);
  S.score += add;
  try { Particles.scorePop(add, label); } catch (_) {}
}

function setFever(v) {
  S.fever = clamp(v, 0, 100);
  if (S.fever >= 100 && !S.feverOn) {
    S.feverOn = true;
    S.feverUntil = now() + 8000; // 8s fever mode
    try { Particles.toast && Particles.toast('🔥 FEVER MODE! +50%'); } catch (_) {}
  }
  if (S.feverOn && now() >= S.feverUntil) {
    S.feverOn = false;
  }
}

function hitTarget(el, reason = 'tap') {
  if (!el || S.paused || S.ended) return;
  if (el.dataset.dead === '1') return;
  el.dataset.dead = '1';

  const kind = el.dataset.kind || 'good';
  const emoji = el.dataset.emoji || '';
  const spawnAt = parseFloat(el.dataset.spawnAt || '0') || 0;
  const rt = now() - spawnAt;

  // remove
  despawnTarget(el);

  if (kind === 'junk') {
    S.miss += 1;
    S.combo = 0;
    setFever(S.fever - 18);
    if (S.miniActive) S.miniNoJunkOK = false;

    addScore(-0, 'MISS');
    try { Particles.scorePop(0, 'MISS'); } catch (_) {}
    try { Particles.burstAt(50, 50, 'TRAP'); } catch (_) {}

    logEvent({
      ts: new Date().toISOString(),
      type: 'hit',
      kind: 'junk',
      emoji,
      rtMs: Math.round(rt),
      reason,
      score: S.score,
      miss: S.miss
    });
    return;
  }

  // good
  S.combo += 1;
  S.comboMax = Math.max(S.comboMax, S.combo);

  // perfect if reaction time fast
  const isPerfect = (rt > 0 && rt <= 520);
  if (isPerfect) S.perfect += 1;

  const gi = parseInt(el.dataset.group || '-1', 10);
  if (gi >= 0 && gi < 5) {
    S.groupsGot[gi] = true;
    S.groupsTotalHits[gi] = (S.groupsTotalHits[gi] | 0) + 1;
  }

  // score
  const base = 100 + Math.min(90, S.combo * 6) + (isPerfect ? 55 : 0);
  addScore(base, isPerfect ? 'PERFECT' : 'GOOD');

  // fever gain
  setFever(S.fever + D.feverGain + (isPerfect ? 2 : 0));

  // plate complete?
  if (S.groupsGot.every(Boolean)) {
    S.platesCleared += 1;
    S.groupsGot = [false, false, false, false, false];

    // bonus
    addScore(260, 'PLATE');
    try { Particles.celebrate && Particles.celebrate('🍽️ PLATE COMPLETE!'); } catch (_) {}

    logEvent({
      ts: new Date().toISOString(),
      type: 'plate_complete',
      platesCleared: S.platesCleared,
      score: S.score
    });

    // mini plate-rush check
    if (S.miniActive && S.activeMiniIndex === 0) {
      // pass if within 8s and no junk
      const okTime = (now() <= S.miniEndAt);
      if (okTime && S.miniNoJunkOK) miniPass();
      else miniFail();
    }
  }

  // mini checks
  if (S.miniActive && S.activeMiniIndex === 1) {
    // Clean Streak: good 10 in a row during mini
    if (S.combo >= 10 && S.miniNoJunkOK) miniPass();
  }
  if (S.miniActive && S.activeMiniIndex === 2) {
    // Rainbow Bite: veg+fruit within 4s
    // ใช้วิธีง่าย: ถ้าใน 4 วิเก็บ group3(ผัก idx2) และ group4(ผลไม้ idx3) อย่างละ 1 -> pass
    // เราเช็คจาก hits หลังเริ่ม mini
    if (S._miniVegHit && S._miniFruitHit) {
      miniPass();
    } else {
      if (gi === 2) S._miniVegHit = true;
      if (gi === 3) S._miniFruitHit = true;
    }
  }

  // adaptive window
  if (ADAPTIVE_ENABLED) {
    S.adaptScoreWindow.push({ t: now(), ok: 1 });
    if (S.adaptScoreWindow.length > 40) S.adaptScoreWindow.shift();
  }

  logEvent({
    ts: new Date().toISOString(),
    type: 'hit',
    kind: 'good',
    groupIndex: gi,
    emoji,
    rtMs: Math.round(rt),
    perfect: isPerfect ? 1 : 0,
    combo: S.combo,
    score: S.score,
    reason
  });
}

// Tap-anywhere: ยิงตาม raycaster ของ cursor
function tapAnywhereFire(reason = 'tap-anywhere') {
  if (!cursorEl) return;

  // A-Frame cursor has raycaster component
  const rc = cursorEl.components && cursorEl.components.raycaster;
  const ints = rc && rc.intersections ? rc.intersections : [];
  if (!ints || !ints.length) return;

  const hit = ints[0];
  const obj = hit && hit.object;
  if (!obj) return;

  // map THREE object -> element
  const el = obj.el || (obj.parent && obj.parent.el) || null;
  if (!el) return;
  if (!el.classList || !el.classList.contains('plateTarget')) return;

  hitTarget(el, reason);
}

// -------------------- Quest progression --------------------
function checkGoals() {
  const tgtPlates = (DIFF === 'easy') ? 2 : (DIFF === 'hard' ? 4 : 3);
  const tgtPerfect = (DIFF === 'easy') ? 6 : (DIFF === 'hard' ? 12 : 9);

  if (S.activeGoalIndex === 0) {
    if (S.platesCleared >= tgtPlates) {
      S.goalsCleared = 1;
      S.activeGoalIndex = 1;
      try { Particles.celebrate && Particles.celebrate('✅ Goal 1 Complete!'); } catch (_) {}
      addScore(220, 'GOAL');
      logEvent({ ts: new Date().toISOString(), type: 'goal_complete', goalIndex: 0 });
    }
  } else if (S.activeGoalIndex === 1) {
    if (S.perfect >= tgtPerfect) {
      S.goalsCleared = 2;
      try { Particles.celebrate && Particles.celebrate('🏁 All Goals Complete!'); } catch (_) {}
      addScore(420, 'GOAL');
      logEvent({ ts: new Date().toISOString(), type: 'goal_complete', goalIndex: 1 });
    }
  }
}

// -------------------- Mini quest control --------------------
function startMini(idx) {
  S.activeMiniIndex = idx;
  S.miniActive = true;
  S.miniStartAt = now();
  S.miniNoJunkOK = true;
  S.miniWarnLastSec = -1;

  // reset per-mini flags
  S._miniVegHit = false;
  S._miniFruitHit = false;

  if (idx === 0) {
    // Plate Rush: 8 sec
    S.miniEndAt = now() + 8000;
  } else if (idx === 1) {
    // Clean Streak: 12 sec
    S.miniEndAt = now() + 12000;
  } else {
    // Rainbow Bite: 10 sec; veg+fruit within 4 sec window from start
    S.miniEndAt = now() + 10000;
    S._miniHardDeadline = now() + 4000;
  }

  try { Particles.toast && Particles.toast('🧩 MINI START!'); } catch (_) {}
  logEvent({ ts: new Date().toISOString(), type: 'mini_start', miniIndex: idx });
}

function stopMiniFX() {
  document.body.classList.remove('hha-warn-flash');
  document.body.classList.remove('hha-shake');
}

function miniPass() {
  if (!S.miniActive) return;
  S.miniActive = false;
  stopMiniFX();
  S.minisCleared += 1;
  addScore(260, 'MINI');
  try { Particles.celebrate && Particles.celebrate('🧩 MINI PASS!'); } catch (_) {}
  logEvent({ ts: new Date().toISOString(), type: 'mini_pass', miniIndex: S.activeMiniIndex });

  // chain next mini (สูงสุด 3)
  if (S.minisCleared < S.minisTotal) {
    setTimeout(() => startMini(S.minisCleared), 1500);
  }
}

function miniFail() {
  if (!S.miniActive) return;
  S.miniActive = false;
  stopMiniFX();
  try { Particles.toast && Particles.toast('❌ MINI FAIL'); } catch (_) {}
  logEvent({ ts: new Date().toISOString(), type: 'mini_fail', miniIndex: S.activeMiniIndex });

  // chain next mini
  if (S.minisCleared < S.minisTotal) {
    setTimeout(() => startMini(S.minisCleared), 1500);
  }
}

function tickMiniWarn() {
  if (!S.miniActive) return;

  const left = Math.max(0, (S.miniEndAt - now()) / 1000);
  const sec = Math.ceil(left);

  // Rainbow: ถ้าเกิน 4 วิแล้วยังไม่ครบ veg+fruit -> ยังทำต่อได้แต่ไม่ pass ใน deadline ย่อย? ให้ยากขึ้น: ถ้าพ้น 4 วิแล้ว ยังไม่ครบ -> fail ทันที
  if (S.activeMiniIndex === 2 && S._miniHardDeadline && now() > S._miniHardDeadline) {
    if (!(S._miniVegHit && S._miniFruitHit) || !S.miniNoJunkOK) {
      miniFail();
      return;
    }
  }

  // warn effects near end (<=3s)
  if (sec <= 3 && sec !== S.miniWarnLastSec) {
    S.miniWarnLastSec = sec;
    document.body.classList.add('hha-warn-flash');
    if (sec <= 2) document.body.classList.add('hha-shake');
    beepTick(920 - (sec * 120), 0.06, 0.06);
  }
  if (sec > 3) {
    stopMiniFX();
  }

  if (left <= 0) {
    // if not passed by deadline => fail
    miniFail();
  }
}

// -------------------- Pause/Restart/VR --------------------
function setPaused(p) {
  S.paused = !!p;
  updateHUD(true);
  logEvent({ ts: new Date().toISOString(), type: S.paused ? 'pause' : 'resume' });
}

function restart() {
  // keep params
  location.reload();
}

async function enterVR() {
  try {
    if (!scene) return;
    if (scene.enterVR) scene.enterVR();
  } catch (_) {}
}

// -------------------- Results --------------------
function showResults() {
  if (!HUD.backdrop) return;

  const g = gradeFrom();
  HUD.backdrop.style.display = 'flex';

  setText(HUD.rMode, MODE === 'research' ? 'Research' : 'Play');
  setText(HUD.rGrade, g);
  setText(HUD.rScore, S.score | 0);
  setText(HUD.rMaxCombo, S.comboMax | 0);
  setText(HUD.rMiss, S.miss | 0);
  setText(HUD.rPerfect, S.perfect | 0);

  setText(HUD.rGoals, `${S.goalsCleared}/${S.goalsTotal}`);
  setText(HUD.rMinis, `${S.minisCleared}/${S.minisTotal}`);

  let total = 0;
  for (let i = 0; i < 5; i++) {
    const v = S.groupsTotalHits[i] | 0;
    total += v;
    if (HUD.rG[i]) setText(HUD.rG[i], v);
  }
  setText(HUD.rGTotal, total);

  logSession({
    ts: new Date().toISOString(),
    phase: 'end',
    projectTag: PROJECT_TAG,
    sessionId: S.sessionId,
    mode: MODE,
    diff: DIFF,
    timeTotal: TIME_TOTAL,
    score: S.score,
    comboMax: S.comboMax,
    miss: S.miss,
    perfect: S.perfect,
    platesCleared: S.platesCleared,
    goalsCleared: S.goalsCleared,
    minisCleared: S.minisCleared,
    grade: g,
    g1: S.groupsTotalHits[0] | 0,
    g2: S.groupsTotalHits[1] | 0,
    g3: S.groupsTotalHits[2] | 0,
    g4: S.groupsTotalHits[3] | 0,
    g5: S.groupsTotalHits[4] | 0
  });
}

// -------------------- Adaptive tuning (play mode) --------------------
function adaptiveUpdate() {
  if (!ADAPTIVE_ENABLED) return;

  // window 12s
  const t = now();
  S.adaptScoreWindow = S.adaptScoreWindow.filter(x => (t - x.t) <= 12000);

  // “ความแม่น” เบื้องต้น: ใช้ miss + good hits recent
  const hitsRecent = S.adaptScoreWindow.length;
  const missRecent = Math.min(10, S.miss); // ง่าย ๆ

  let skill = 0.5;
  if (hitsRecent >= 12) skill += 0.15;
  if (hitsRecent >= 22) skill += 0.15;
  if (missRecent >= 3) skill -= 0.15;
  if (missRecent >= 6) skill -= 0.15;

  skill = clamp(skill, 0.15, 0.95);

  // scale: เด็กเล่นเก่ง -> เป้าเล็กลงนิด / เล่นยาก -> เป้าใหญ่ขึ้น
  const targetMul = 1.20 - (skill * 0.40); // ~1.14..0.82
  S.adaptScaleMul = clamp(targetMul, 0.82, 1.18);
}

// -------------------- Main loop --------------------
function loop() {
  if (!S.started) return;
  if (S.ended) return;

  const t = now();
  const dt = (t - (S.lastTick || t)) / 1000;
  S.lastTick = t;

  if (!S.paused) {
    // timer
    S.timeLeft -= dt;
    if (S.timeLeft <= 0) {
      S.timeLeft = 0;
      endGame();
      return;
    }

    // fever decay
    if (!S.feverOn) setFever(S.fever - dt * 7.0);
    else if (t >= S.feverUntil) S.feverOn = false;

    // spawn
    S.spawnTimer += dt * 1000;
    const spawnMs = D.spawnMs;
    if (S.spawnTimer >= spawnMs) {
      S.spawnTimer = 0;
      spawnOne();
      // sometimes spawn extra (hard)
      if (DIFF === 'hard' && Math.random() < 0.20) spawnOne();
    }

    // goals/mini
    checkGoals();

    // kick minis: start first mini at 14s after start (once)
    if (S.activeMiniIndex < 0 && (TIME_TOTAL - S.timeLeft) >= 14) {
      startMini(0);
    }
    if (S.miniActive) tickMiniWarn();

    // adaptive
    adaptiveUpdate();

    // target billboarding
    orientTargetsToCamera();
  }

  // HUD at ~10Hz
  if (!S._hudNextAt || t >= S._hudNextAt) {
    S._hudNextAt = t + 100;
    updateHUD();
  }

  requestAnimationFrame(loop);
}

function endGame() {
  if (S.ended) return;
  S.ended = true;
  stopMiniFX();

  // clear targets
  for (const el of Array.from(S.activeTargets)) despawnTarget(el);

  try { Particles.celebrate && Particles.celebrate('🏁 FINISH!'); } catch (_) {}
  showResults();
}

// -------------------- Boot --------------------
function loadContextFromHub() {
  // เผื่อ hub.html ส่งข้อมูลมา (optional)
  let ctx = {};
  try {
    const raw = sessionStorage.getItem('HHA_SESSION_CTX') || '';
    if (raw) ctx = JSON.parse(raw);
  } catch (_) {}
  S.ctx = ctx || {};
}

function maybeSendProfile() {
  // optional: ส่งโปรไฟล์ครั้งเดียวถ้ามี
  try {
    const raw = sessionStorage.getItem('HHA_STUDENT_PROFILE') || '';
    if (!raw) return;
    const prof = JSON.parse(raw);
    if (!prof || typeof prof !== 'object') return;
    logProfile({
      ts: new Date().toISOString(),
      projectTag: 'HeroHealth',
      ...prof
    });
  } catch (_) {}
}

function bindButtons() {
  if (HUD.btnVR) HUD.btnVR.addEventListener('click', enterVR);
  if (HUD.btnPause) HUD.btnPause.addEventListener('click', () => setPaused(!S.paused));
  if (HUD.btnRestart) HUD.btnRestart.addEventListener('click', restart);
  if (HUD.btnPlayAgain) HUD.btnPlayAgain.addEventListener('click', restart);
}

function bindTapAnywhere() {
  // Tap/click anywhere -> raycast via cursor
  const fire = (e) => {
    // ignore if clicking UI button
    const t = e && e.target;
    if (t && (t.closest && t.closest('.btn'))) return;
    if (S.paused || S.ended) return;
    tapAnywhereFire('tap-anywhere');
  };

  // pointerdown for mobile responsiveness
  window.addEventListener('pointerdown', fire, { passive: true });
  window.addEventListener('click', fire, { passive: true });
}

function boot() {
  // Init logger
  initCloudLoggerSafe({ endpoint: LOGGER_ENDPOINT, debug: DEBUG });

  // context
  loadContextFromHub();

  // ids
  S.sessionId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  // send profile (optional)
  maybeSendProfile();

  // log start session
  logSession({
    ts: new Date().toISOString(),
    phase: 'start',
    projectTag: PROJECT_TAG,
    sessionId: S.sessionId,
    mode: MODE,
    diff: DIFF,
    timeTotal: TIME_TOTAL,
    ctx: S.ctx || {}
  });

  // HUD init
  updateHUD(true);

  // A-Frame refs
  scene = document.querySelector('a-scene');
  camEl = $('cam');
  worldRoot = $('worldTargets');
  cursorEl = $('cursor');

  if (!scene || !camEl || !worldRoot || !cursorEl) {
    console.error('[PlateVR] Missing A-Frame elements (scene/cam/worldTargets/cursor)');
    return;
  }

  // buttons + tap
  bindButtons();
  bindTapAnywhere();

  // start
  S.started = true;
  S.t0 = now();
  S.lastTick = now();

  // small intro toast
  try { Particles.toast && Particles.toast('🍽️ Balanced Plate — เริ่มเลย!'); } catch (_) {}

  requestAnimationFrame(loop);
}

// Wait A-Frame ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
