/* === /herohealth/plate/plate-solo.js ===
   HeroHealth Plate Solo Engine
   FINAL SOLO PATCH
*/
'use strict';

const WIN = window;
const DOC = document;

const GROUPS = [
  { id:1, key:'protein', label:'โปรตีน', icon:'🐟', good:['🐟','🥚','🍗','🫘'] },
  { id:2, key:'carb',    label:'ข้าว/แป้ง', icon:'🍚', good:['🍚','🍞','🥔','🍠'] },
  { id:3, key:'veg',     label:'ผัก', icon:'🥦', good:['🥦','🥬','🥕','🥒'] },
  { id:4, key:'fruit',   label:'ผลไม้', icon:'🍎', good:['🍎','🍌','🍉','🍇'] },
  { id:5, key:'fat',     label:'ไขมันดี', icon:'🥑', good:['🥑','🥜','🫒','🥥'] }
];

const WRONG_POOL = ['🍩','🥤','🍟','🧁','🍭','🍔','🍫'];

const clamp = (v, a, b) => {
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
};

function xmur3(str) {
  str = String(str || '');
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };
}

function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function makeRng(seedStr) {
  const s = xmur3(String(seedStr || '0'));
  return sfc32(s(), s(), s(), s());
}

function rectOf(el) {
  try {
    if (!el) return null;
    const r = el.getBoundingClientRect?.();
    if (!r) return null;
    if (!Number.isFinite(r.left) || !Number.isFinite(r.top)) return null;
    return r;
  } catch {
    return null;
  }
}

function intersect(a, b) {
  if (!a || !b) return false;
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function overlayOpen() {
  const el = DOC.getElementById('endOverlay');
  return !!(el && el.getAttribute('aria-hidden') === 'false');
}

function drawerOpen() {
  const el = DOC.getElementById('plateDrawer');
  return !!(el && el.getAttribute('aria-hidden') === 'false');
}

function childCoachText(kind, data = {}) {
  const target = String(data.target || '').trim();
  switch (String(kind || '')) {
    case 'warm': return `WARM: เก็บ “${target || 'หมู่เป้าหมาย'}”`;
    case 'trick': return 'TRICK: ดูดี ๆ มีตัวหลอกนะ';
    case 'boss': return 'BOSS: เติมจานให้ครบ 5 หมู่';
    case 'good': return 'เยี่ยมมาก! ถูกต้องแล้ว';
    case 'wrong': return 'ลองดูใหม่อีกนิดนะ';
    case 'miss': return 'ไม่เป็นไร ยังทันอยู่';
    case 'shield': return 'ได้โล่แล้ว! กันพลาดได้ 1 ครั้ง';
    case 'fever': return 'Fever มาแล้ว! รีบเก็บแต้ม';
    case 'perfect': return 'สุดยอด! ผ่านเป้าหมายนี้แบบไม่พลาด';
    case 'boss-clear': return 'ผ่าน BOSS แล้ว! จานสมดุลครบทั้ง 5 หมู่';
    case 'phase-clear': return 'เก่งมาก! ผ่านด่านแล้ว';
    default: return 'เริ่มเลย! ยิงอาหารให้ครบ 5 หมู่ 🥦🍚🐟';
  }
}

function friendlyPhaseLabel(phase) {
  switch (String(phase || '').toLowerCase()) {
    case 'warm': return 'WARM';
    case 'trick': return 'TRICK';
    case 'boss': return 'BOSS';
    default: return String(phase || 'PLAY').toUpperCase();
  }
}

function subPhaseLabel(name) {
  switch (String(name || '').toLowerCase()) {
    case 'opening': return 'START';
    case 'flow': return 'FLOW';
    case 'trick': return 'TRICK';
    case 'fever': return 'FEVER';
    case 'rush': return 'RUSH';
    case 'final': return 'FINAL';
    default: return 'PLAY';
  }
}

function bossProgressText() {
  if (String(S.phase || '') !== 'boss') return '';
  const total = Math.max(1, S.bossQueue?.length || 0);
  const step = Math.min(total, Number(S.bossStep || 0) + 1);
  return `${step}/${total}`;
}

function friendlyTargetText(label) {
  const raw = String(label || '').trim();
  if (!raw) return 'เก็บหมู่เป้าหมาย';

  if (String(S.phase || '').toLowerCase() === 'boss') {
    const prog = bossProgressText();
    const perStep = Math.max(1, Number(S.bossNeedPerStep || 1));
    const done = Math.min(perStep, Number(S.bossStepDone || 0));
    return `BOSS ${prog} • เติม ${raw} ${done}/${perStep}`;
  }

  return `เก็บ ${raw}`;
}

function gradeOf(acc) {
  if (acc >= 90) return 'S';
  if (acc >= 75) return 'A';
  if (acc >= 60) return 'B';
  if (acc >= 40) return 'C';
  return 'D';
}

function resolveThemeSubPhase() {
  const raw = String(S.subPhase || '').toLowerCase().trim();
  if (raw) return raw;

  if (S.feverOn) return 'fever';

  const phase = String(S.phase || '').toLowerCase();
  if (phase === 'warm') return 'opening';
  if (phase === 'trick') return 'trick';

  if (phase === 'boss') {
    const remain = Number(S.phaseTimeLeft || 0);
    const total = Math.max(1, Number(S.phaseDurations?.[S.phaseIndex] || 1));
    const ratio = remain / total;
    if (ratio <= 0.34) return 'final';
    return 'rush';
  }

  return 'flow';
}

function setText(id, text) {
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(text ?? '');
}

function setWidth(id, pct) {
  const el = DOC.getElementById(id);
  if (el) el.style.width = `${clamp(pct, 0, 100)}%`;
}

function setOverlayHidden(id, hidden) {
  const el = DOC.getElementById(id);
  if (el) el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

function nowMs() {
  return (performance && performance.now) ? performance.now() : Date.now();
}

function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }
  } catch {}
  return Promise.reject(new Error('clipboard unavailable'));
}

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function randRange(min, max) {
  return min + (S.rng() * (max - min));
}

function pick(arr) {
  return arr[(S.rng() * arr.length) | 0];
}

function pickWeighted(arr, weights) {
  if (!Array.isArray(weights) || weights.length !== arr.length) {
    return arr[(S.rng() * arr.length) | 0];
  }
  let total = 0;
  for (const w of weights) total += Number(w || 0);
  let r = S.rng() * total;
  for (let i = 0; i < arr.length; i += 1) {
    r -= Number(weights[i] || 0);
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

function getDifficultyPreset(diff = 'normal', pro = false) {
  const d = String(diff || 'normal').toLowerCase();

  let preset = {
    warm:  { targetCorrectP: 0.82, spawnPerSec: 0.82, ttl: 3.6, capBonus: 0, wrongPenalty: 4, bossBonus: 6 },
    trick: { targetCorrectP: 0.58, spawnPerSec: 1.02, ttl: 2.9, capBonus: 1, wrongPenalty: 4, bossBonus: 6 },
    boss:  { targetCorrectP: 0.68, spawnPerSec: 1.15, ttl: 2.45, capBonus: 1, wrongPenalty: 6, bossBonus: 6 }
  };

  if (d === 'easy') {
    preset = {
      warm:  { targetCorrectP: 0.88, spawnPerSec: 0.70, ttl: 4.0, capBonus: 0, wrongPenalty: 2, bossBonus: 4 },
      trick: { targetCorrectP: 0.66, spawnPerSec: 0.88, ttl: 3.3, capBonus: 0, wrongPenalty: 3, bossBonus: 4 },
      boss:  { targetCorrectP: 0.76, spawnPerSec: 0.98, ttl: 2.9, capBonus: 0, wrongPenalty: 4, bossBonus: 4 }
    };
  } else if (d === 'hard') {
    preset = {
      warm:  { targetCorrectP: 0.78, spawnPerSec: 0.94, ttl: 3.25, capBonus: 0, wrongPenalty: 4, bossBonus: 7 },
      trick: { targetCorrectP: 0.52, spawnPerSec: 1.15, ttl: 2.55, capBonus: 1, wrongPenalty: 5, bossBonus: 7 },
      boss:  { targetCorrectP: 0.62, spawnPerSec: 1.28, ttl: 2.15, capBonus: 2, wrongPenalty: 7, bossBonus: 8 }
    };
  }

  if (pro) {
    for (const k of ['warm', 'trick', 'boss']) {
      preset[k].spawnPerSec *= 1.08;
      preset[k].ttl *= 0.94;
      preset[k].wrongPenalty += 1;
      if (k !== 'warm') preset[k].capBonus += 1;
    }
  }

  return preset;
}

const S = {
  mount: null,
  ctx: null,
  rng: null,
  ai: null,

  running: false,
  paused: false,
  ended: false,

  raf: 0,
  lastTick: 0,

  phase: 'warm',
  phaseIndex: 0,
  phaseList: ['warm', 'trick', 'boss'],
  phaseDurations: [0, 0, 0],
  phaseTimeLeft: 0,
  totalTimeLeft: 0,
  subPhase: 'opening',
  phaseBannerStamp: 0,

  targetGroup: null,
  spawnAcc: 0,

  targets: new Map(),
  nextId: 1,

  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,
  hits: 0,
  wrong: 0,
  shots: 0,

  fever: 0,
  feverOn: false,
  feverTimer: 0,
  shield: 0,

  counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  plateHave: 0,

  hub: '../hub.html',
  cooldownEnabled: false,
  cooldownDone: false,

  targetCorrectP: 0.72,
  spawnPerSec: 0.95,
  ttl: 3.2,
  missLimit: 999,
  bossCompleted: false,

  bossQueue: [],
  bossStep: 0,
  bossNeedPerStep: 1,
  bossStepDone: 0,
  bossPerfectSteps: 0,
  bossStepMistake: false,
  bossFlawlessRun: true,
  bossSequenceStreak: 0,

  waveMode: false,
  waveSize: 0,
  waveSpawned: 0,
  waveCooldown: 0,
  wavePatternName: '',
  wavePatternQueue: [],
  wavePatternIndex: 0,
  waveTimers: [],

  diffPreset: null,

  toastTimer: 0,
  toastKey: '',
  toastAt: 0,

  fxEnabled: true,
  hapticEnabled: true,
  audioEnabled: true,
  audioCtx: null,
  audioUnlocked: false
};

function shouldUseAudio() {
  return !!S.audioEnabled && String(S.ctx?.run || 'play') !== 'research';
}

function shouldUseHaptics() {
  return !!S.hapticEnabled && String(S.ctx?.run || 'play') !== 'research';
}

function unlockAudio() {
  if (!shouldUseAudio()) return;
  if (S.audioUnlocked) return;

  try {
    const AC = WIN.AudioContext || WIN.webkitAudioContext;
    if (!AC) return;

    if (!S.audioCtx) S.audioCtx = new AC();
    if (S.audioCtx.state === 'suspended') {
      S.audioCtx.resume?.();
    }
    S.audioUnlocked = true;
  } catch {}
}

function playTone(freq = 440, dur = 0.08, type = 'sine', gainValue = 0.028, when = 0) {
  if (!shouldUseAudio()) return;
  try {
    unlockAudio();
    if (!S.audioCtx) return;

    const ctx = S.audioCtx;
    const t0 = ctx.currentTime + when;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainValue, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {}
}

function vibratePattern(pattern) {
  if (!shouldUseHaptics()) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {}
}

function fxPulseAt(x, y, kind = 'good') {
  const layer = DOC.getElementById('fxLayer');
  if (!layer) return;

  const el = DOC.createElement('div');
  el.className = `fxPulse ${kind}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  layer.appendChild(el);

  setTimeout(() => {
    try { el.remove(); } catch {}
  }, 520);
}

function telegraphAt(x, y, kind = 'boss') {
  const layer = DOC.getElementById('fxLayer');
  if (!layer) return;

  const el = DOC.createElement('div');
  el.className = `fxTelegraph ${kind}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  layer.appendChild(el);

  setTimeout(() => {
    try { el.remove(); } catch {}
  }, 360);
}

function telegraphLaneAt(x, kind = 'good') {
  const layer = DOC.getElementById('fxLayer');
  if (!layer) return;

  const el = DOC.createElement('div');
  el.className = `fxLaneFlash ${kind}`;
  el.style.left = `${x}px`;
  layer.appendChild(el);

  setTimeout(() => {
    try { el.remove(); } catch {}
  }, 300);
}

function pulseApp(kind = 'good') {
  const app = DOC.getElementById('app');
  if (!app) return;

  app.classList.remove('fx-good', 'fx-wrong', 'fx-fever', 'fx-boss');
  app.classList.add(`fx-${kind}`);

  setTimeout(() => {
    app.classList.remove(`fx-${kind}`);
  }, 180);
}

function shakeApp(level = 'tiny') {
  const app = DOC.getElementById('app');
  if (!app) return;

  app.classList.remove('shake-tiny', 'shake-mid');
  void app.offsetWidth;
  app.classList.add(level === 'mid' ? 'shake-mid' : 'shake-tiny');

  setTimeout(() => {
    app.classList.remove('shake-tiny', 'shake-mid');
  }, 300);
}

function emitFx(kind, data = {}) {
  const x = Number.isFinite(data.x) ? data.x : null;
  const y = Number.isFinite(data.y) ? data.y : null;

  switch (String(kind || '')) {
    case 'good':
      pulseApp('good');
      if (x != null && y != null) fxPulseAt(x, y, 'good');
      playTone(740, 0.06, 'triangle', 0.025, 0);
      playTone(980, 0.08, 'triangle', 0.018, 0.04);
      break;

    case 'wrong':
      pulseApp('wrong');
      shakeApp('tiny');
      if (x != null && y != null) fxPulseAt(x, y, 'bad');
      playTone(220, 0.08, 'sawtooth', 0.022, 0);
      vibratePattern([18]);
      break;

    case 'miss':
      pulseApp('wrong');
      shakeApp('tiny');
      playTone(190, 0.10, 'square', 0.018, 0);
      vibratePattern([22]);
      break;

    case 'shield':
      pulseApp('good');
      if (x != null && y != null) fxPulseAt(x, y, 'good');
      playTone(540, 0.05, 'triangle', 0.022, 0);
      playTone(760, 0.07, 'triangle', 0.018, 0.03);
      break;

    case 'fever':
      pulseApp('fever');
      if (x != null && y != null) fxPulseAt(x, y, 'fever');
      playTone(620, 0.05, 'triangle', 0.022, 0);
      playTone(820, 0.06, 'triangle', 0.020, 0.04);
      playTone(1080, 0.08, 'triangle', 0.018, 0.08);
      vibratePattern([14, 24, 20]);
      break;

    case 'phase':
      pulseApp('boss');
      playTone(420, 0.06, 'sine', 0.018, 0);
      playTone(520, 0.07, 'sine', 0.015, 0.05);
      break;

    case 'perfect':
      pulseApp('good');
      if (x != null && y != null) fxPulseAt(x, y, 'good');
      playTone(660, 0.05, 'triangle', 0.022, 0);
      playTone(880, 0.06, 'triangle', 0.020, 0.04);
      playTone(1180, 0.08, 'triangle', 0.018, 0.08);
      vibratePattern([12, 18, 12]);
      break;

    case 'boss-clear':
      pulseApp('boss');
      shakeApp('mid');
      if (x != null && y != null) fxPulseAt(x, y, 'boss');
      playTone(420, 0.08, 'triangle', 0.026, 0);
      playTone(620, 0.09, 'triangle', 0.022, 0.05);
      playTone(880, 0.12, 'triangle', 0.020, 0.11);
      vibratePattern([20, 30, 26, 36, 30]);
      break;
  }

  try {
    WIN.dispatchEvent(new CustomEvent('plate:fx', { detail: { kind, ...data } }));
  } catch {}
}

function ensureWorldPhaseNodes() {
  const world = DOC.getElementById('world');
  if (!world) return;

  if (!world.querySelector('.world-bg')) {
    world.innerHTML = `
      <div class="world-bg"></div>
      <div class="world-grid"></div>
      <div class="world-ring"></div>
      <div class="world-bossAura"></div>
      <div class="world-orb orb-a"></div>
      <div class="world-orb orb-b"></div>
      <div class="world-orb orb-c"></div>
    `;
  }
}

function pulseWorld(kind = '') {
  const world = DOC.getElementById('world');
  if (!world) return;

  const cls = `pulse-${String(kind || 'default').toLowerCase()}`;
  world.classList.remove('pulse-warm', 'pulse-trick', 'pulse-boss', 'pulse-fever', 'pulse-final');
  world.classList.add(cls);

  setTimeout(() => {
    world.classList.remove(cls);
  }, 620);
}

function applyPhaseTheme() {
  const phase = String(S.phase || 'warm').toLowerCase();
  const sub = resolveThemeSubPhase();

  DOC.body.dataset.phase = phase;
  DOC.body.dataset.subphase = sub;

  const app = DOC.getElementById('app');
  if (app) {
    app.dataset.phase = phase;
    app.dataset.subphase = sub;
  }
}

function showPhaseBanner(kind) {
  let text = 'เริ่มเลย';
  if (kind === 'warm') text = 'WARM • เริ่มเก็บก่อน';
  else if (kind === 'trick') text = 'TRICK • ระวังตัวหลอก';
  else if (kind === 'boss') text = 'BOSS • เติมจานให้ครบ';

  const d = DOC.createElement('div');
  d.className = 'phaseBanner';
  d.textContent = text;
  DOC.getElementById('app')?.appendChild(d);
  setTimeout(() => {
    try { d.remove(); } catch {}
  }, 950);
}

function showMinorBanner(text) {
  const d = DOC.createElement('div');
  d.className = 'phaseBanner';
  d.textContent = String(text || '').trim() || 'GO!';
  DOC.getElementById('app')?.appendChild(d);
  setTimeout(() => {
    try { d.remove(); } catch {}
  }, 820);
}

function toastToneOf(phase, subPhase = '') {
  const p = String(phase || '').toLowerCase();
  const s = String(subPhase || '').toLowerCase();

  if (s === 'fever') return 'fever';
  if (s === 'final') return 'final';
  if (p === 'boss') return 'boss';
  if (p === 'trick') return 'trick';
  return 'warm';
}

function setObjectiveToastHidden(hidden) {
  const el = DOC.getElementById('objectiveToast');
  if (el) el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

function showObjectiveToast({ badge = '', title = '', sub = '', tone = 'warm', key = '' } = {}) {
  const wrap = DOC.getElementById('objectiveToast');
  const card = wrap?.querySelector('.objectiveToastCard');
  if (!wrap || !card) return;

  const now = nowMs();
  const dedupeKey = String(key || `${badge}|${title}|${sub}`).trim();
  if (dedupeKey && S.toastKey === dedupeKey && (now - Number(S.toastAt || 0)) < 700) {
    return;
  }

  S.toastKey = dedupeKey;
  S.toastAt = now;

  setText('objectiveToastBadge', badge);
  setText('objectiveToastTitle', title);
  setText('objectiveToastSub', sub);
  card.dataset.tone = tone || 'warm';

  setObjectiveToastHidden(false);

  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';

  try { clearTimeout(S.toastTimer); } catch {}
  S.toastTimer = setTimeout(() => {
    setObjectiveToastHidden(true);
  }, 980);
}

function showPhaseObjectiveToast() {
  const phase = String(S.phase || '').toLowerCase();
  const sub = String(S.subPhase || '').toLowerCase();

  if (phase === 'warm') {
    showObjectiveToast({
      badge: 'WARM',
      title: `เก็บ ${S.targetGroup?.icon || '🎯'} ${S.targetGroup?.label || 'หมู่เป้าหมาย'}`,
      sub: 'เริ่มแบบอ่านง่ายก่อน แล้วค่อยเร็วขึ้น',
      tone: toastToneOf(phase, sub),
      key: `phase:warm:${S.targetGroup?.id || ''}`
    });
    return;
  }

  if (phase === 'trick') {
    showObjectiveToast({
      badge: 'TRICK',
      title: `ระวังตัวหลอก • เก็บ ${S.targetGroup?.icon || '🎯'} ${S.targetGroup?.label || 'หมู่เป้าหมาย'}`,
      sub: 'อย่าเผลอยิงของที่ดูคล้ายกัน',
      tone: toastToneOf(phase, sub),
      key: `phase:trick:${S.targetGroup?.id || ''}`
    });
    return;
  }

  if (phase === 'boss') {
    const total = Math.max(1, S.bossQueue?.length || 5);
    const step = Math.min(total, Number(S.bossStep || 0) + 1);
    const need = Math.max(1, Number(S.bossNeedPerStep || 1));
    const done = Math.min(need, Number(S.bossStepDone || 0));

    showObjectiveToast({
      badge: `BOSS ${step}/${total}`,
      title: `เติม ${S.targetGroup?.icon || '🎯'} ${S.targetGroup?.label || 'หมู่เป้าหมาย'}`,
      sub: `เก็บให้ครบ ${done}/${need} แล้วไปหมู่ถัดไป`,
      tone: toastToneOf(phase, sub),
      key: `phase:boss:${step}:${S.targetGroup?.id || ''}:${done}/${need}`
    });
  }
}

function showSubPhaseToast(name = '') {
  const n = String(name || '').toLowerCase().trim();
  if (!n) return;

  if (n === 'fever') {
    showObjectiveToast({
      badge: 'FEVER',
      title: 'รีบเก็บแต้ม • ตอนนี้คะแนนแรงขึ้น',
      sub: 'จังหวะดีมาก อย่าหลุดคอมโบ',
      tone: 'fever',
      key: 'sub:fever'
    });
    return;
  }

  if (n === 'rush') {
    showObjectiveToast({
      badge: 'RUSH',
      title: 'ด่านเข้มขึ้นแล้ว',
      sub: 'เป้าจะมาเร็วขึ้น เตรียมเล็งให้แม่น',
      tone: 'boss',
      key: 'sub:rush'
    });
    return;
  }

  if (n === 'final') {
    showObjectiveToast({
      badge: 'FINAL',
      title: 'ช่วงท้ายแล้ว • ปิดจานให้ครบ',
      sub: 'โฟกัสเป้าหมายปัจจุบันให้ชัด',
      tone: 'final',
      key: 'sub:final'
    });
  }
}

function setCoach(kind, data = {}) {
  setText('coachMsg', childCoachText(kind, data));
}

function plateCountDistinct() {
  let n = 0;
  for (let i = 1; i <= 5; i++) {
    if ((S.counts[i] || 0) > 0) n++;
  }
  return n;
}

function resetCounts() {
  for (let i = 1; i <= 5; i++) S.counts[i] = 0;
}

function pickMissingGroup() {
  const missing = GROUPS.filter(g => (S.counts[g.id] || 0) <= 0);
  if (missing.length) return pick(missing);
  return pick(GROUPS);
}

function normalizeBossQueueItem(item) {
  if (!item) return null;
  if (typeof item === 'object' && item.id != null) {
    return item;
  }
  const raw = String(item || '').trim().toLowerCase();
  return GROUPS.find(g => g.key === raw || g.label === item) || null;
}

function renderPauseBossQueue() {
  const panel = DOC.getElementById('pauseBossPanel');
  const list = DOC.getElementById('pauseBossQueue');

  if (!panel || !list) return;

  const isBoss = String(S.phase || '').toLowerCase() === 'boss';
  const queue = Array.isArray(S.bossQueue) ? S.bossQueue.map(normalizeBossQueueItem).filter(Boolean) : [];

  if (!isBoss || !queue.length) {
    panel.hidden = true;
    list.innerHTML = '';
    return;
  }

  panel.hidden = false;

  const total = Math.max(1, queue.length);
  const stepIndex = Math.max(0, Number(S.bossStep || 0));
  const current = queue[stepIndex] || null;

  setText('pauseBossNow', current ? `${current.icon} ${current.label}` : '—');
  setText('pauseBossStep', `${Math.min(total, stepIndex + 1)}/${total}`);

  const need = Math.max(1, Number(S.bossNeedPerStep || 1));
  const done = Math.min(need, Number(S.bossStepDone || 0));
  setText('pauseBossNeed', `${done}/${need}`);

  setText('pauseBossPerfect', Number(S.bossPerfectSteps || 0));
  setText('pauseBossFlawless', S.bossFlawlessRun ? 'YES' : 'NO');

  list.innerHTML = queue.map((g, i) => {
    let cls = 'pending';
    let state = 'รอ';

    if (i < stepIndex) {
      cls = 'done';
      state = 'ผ่านแล้ว';
    } else if (i === stepIndex) {
      cls = 'current';
      state = 'ตอนนี้';
    } else if (i === stepIndex + 1) {
      cls = 'next';
      state = 'ถัดไป';
    }

    return `
      <div class="pauseBossItem ${cls}">
        <div class="icon">${g.icon}</div>
        <div class="label">${g.label}</div>
        <div class="state">${state}</div>
      </div>
    `;
  }).join('');
}

function renderLiveBossStrip() {
  const wrap = DOC.getElementById('liveBossStrip');
  const list = DOC.getElementById('liveBossQueue');

  if (!wrap || !list) return;

  const isBoss = String(S.phase || '').toLowerCase() === 'boss';
  const queue = Array.isArray(S.bossQueue) ? S.bossQueue.map(normalizeBossQueueItem).filter(Boolean) : [];

  if (!isBoss || !queue.length || S.ended) {
    wrap.hidden = true;
    list.innerHTML = '';
    return;
  }

  wrap.hidden = false;

  const total = Math.max(1, queue.length);
  const stepIndex = Math.max(0, Number(S.bossStep || 0));
  const need = Math.max(1, Number(S.bossNeedPerStep || 1));
  const done = Math.min(need, Number(S.bossStepDone || 0));

  setText('liveBossStep', `${Math.min(total, stepIndex + 1)}/${total}`);
  setText('liveBossNeed', `${done}/${need}`);

  list.innerHTML = queue.map((g, i) => {
    let cls = 'pending';
    let state = 'รอ';

    if (i < stepIndex) {
      cls = 'done';
      state = 'ผ่าน';
    } else if (i === stepIndex) {
      cls = 'current';
      state = `${done}/${need}`;
    } else if (i === stepIndex + 1) {
      cls = 'next';
      state = 'ถัดไป';
    }

    return `
      <div class="liveBossItem ${cls}">
        <div class="icon">${g.icon}</div>
        <div class="state">${state}</div>
      </div>
    `;
  }).join('');
}

function syncPauseOverlay() {
  const open = !!S.paused && !S.ended;
  setOverlayHidden('pauseOverlay', !open);

  if (!open) return;

  setText('pauseScore', S.score);
  setText('pauseTime', `${Math.ceil(Math.max(0, S.totalTimeLeft))}s`);
  setText('pauseCombo', S.combo);
  setText('pauseMiss', S.miss);

  setText('pauseObjectiveText', friendlyTargetText(S.targetGroup?.label));
  setText('pausePhaseText', `${friendlyPhaseLabel(S.phase)}${S.subPhase ? ` • ${subPhaseLabel(S.subPhase)}` : ''}`);
  setText('pausePhaseProg', DOC.getElementById('uiPhaseProg')?.textContent || '0/0');

  const goalFill = DOC.getElementById('uiGoalFill')?.style.width || '0%';
  const pauseGoalFill = DOC.getElementById('pauseGoalFill');
  if (pauseGoalFill) pauseGoalFill.style.width = goalFill;

  for (let i = 1; i <= 5; i++) {
    setText(`pauseG${i}`, S.counts[i] || 0);
  }

  const sub = `phase=${friendlyPhaseLabel(S.phase)} • diff=${S.ctx?.diff || 'normal'} • view=${S.ctx?.view || 'mobile'} • score=${S.score}`;
  setText('pauseSub', sub);

  renderPauseBossQueue();
}

function topGroupSummary() {
  let best = GROUPS[0];
  let bestCount = -1;

  for (const g of GROUPS) {
    const count = Number(S.counts?.[g.id] || 0);
    if (count > bestCount) {
      best = g;
      bestCount = count;
    }
  }

  return {
    group: best,
    count: Math.max(0, bestCount)
  };
}

function rewardTitleOf(sum) {
  if (sum.grade === 'S' && sum.bossFlawlessRun) return 'Plate Master';
  if (sum.grade === 'S') return 'Perfect Plate Hero';
  if (sum.grade === 'A' && sum.comboMax >= 8) return 'Combo Nutrition Star';
  if (sum.plateHave >= 5) return 'Balanced Plate Builder';
  if (sum.bossPerfectSteps >= 2) return 'Boss Focus Kid';
  return 'Balanced Starter';
}

function coachTipOfSummary(sum) {
  if (sum.grade === 'S') {
    return 'สุดยอดมาก รอบนี้หนูจัดการจานได้ยอดเยี่ยมแล้ว ลองเล่นอีกครั้งเพื่อรักษา perfect run ให้ได้ต่อเนื่อง';
  }
  if (sum.bossFlawlessRun) {
    return 'รอบนี้ผ่าน boss แบบไม่พลาดเลย เก่งมาก! ครั้งหน้าลองดันคะแนนรวมให้สูงขึ้นอีก';
  }
  if (sum.plateHave < 5) {
    return 'ครั้งหน้าลองโฟกัสให้ครบ 5 หมู่เร็วขึ้น โดยดู boss path และยิงเฉพาะเป้าหมายที่ lock ไว้';
  }
  if (sum.comboMax < 5) {
    return 'ทำได้ดีแล้ว รอบหน้าลองรักษาคอมโบให้นานขึ้น จะได้คะแนนเพิ่มเร็วมาก';
  }
  return 'ลองเล่นอีกครั้งเพื่อเก็บคะแนนเพิ่ม ทำ perfect step และปิด boss ให้ลื่นกว่านี้';
}

function badgeToneOf(sum) {
  if (sum.grade === 'S') return 'PLATE LEGEND';
  if (sum.grade === 'A') return 'PLATE HERO';
  if (sum.grade === 'B') return 'SMART EATER';
  return 'GOOD TRY';
}

function buildMiniGameUrl() {
  try {
    const u = new URL('./plate-vr.html', location.href);
    u.searchParams.set('pid', String(S.ctx?.pid || 'anon'));
    u.searchParams.set('hub', String(S.hub || '../hub.html'));
    u.searchParams.set('view', String(S.ctx?.view || 'mobile'));
    u.searchParams.set('run', String(S.ctx?.run || 'play'));
    u.searchParams.set('diff', String(S.ctx?.diff || 'normal'));
    u.searchParams.set('time', '60');
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('mode', 'mini');
    u.searchParams.set('mini', '1');
    return u.toString();
  } catch {
    return './plate-vr.html';
  }
}

function renderHeroEndSummary(sum) {
  const best = topGroupSummary();
  const rewardTitle = rewardTitleOf(sum);
  const coachTip = coachTipOfSummary(sum);
  const badge = badgeToneOf(sum);

  setText('endBadge', badge);
  setText('endGrade', sum.grade);
  setText('endScore', sum.scoreFinal);
  setText('endOk', sum.ok);
  setText('endWrong', sum.wrong);
  setText('endPlateHave', sum.plateHave);
  setText('endAcc', `${sum.accPct}%`);
  setText('endComboMax', sum.comboMax);
  setText('endBossPerfect', sum.bossPerfectSteps || 0);
  setText('endBossFlawless', sum.bossFlawlessRun ? 'YES' : 'NO');

  setText('endBestGroupIcon', best.group?.icon || '🥦');
  setText('endBestGroupTitle', `${best.group?.label || 'หมู่เด่น'} เด่นที่สุด`);
  setText('endBestGroupSub', `เก็บได้ ${best.count} ชิ้นในรอบนี้`);

  setText('endRewardTitle', rewardTitle);
  setText('endCoachTip', coachTip);

  setText('endG1', sum.counts?.[1] || 0);
  setText('endG2', sum.counts?.[2] || 0);
  setText('endG3', sum.counts?.[3] || 0);
  setText('endG4', sum.counts?.[4] || 0);
  setText('endG5', sum.counts?.[5] || 0);

  const miniBtn = DOC.getElementById('btnMiniAfterEnd');
  if (miniBtn) miniBtn.href = buildMiniGameUrl();
}

function buildBossQueue() {
  const order = GROUPS.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = (S.rng() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function currentBossGroup() {
  return S.bossQueue?.[S.bossStep] || null;
}

function resetBossGoalWave() {
  S.bossQueue = buildBossQueue();
  S.bossStep = 0;
  S.bossStepDone = 0;
  S.bossNeedPerStep = (String(S.ctx?.diff || 'normal') === 'hard') ? 2 : 1;
  S.targetGroup = S.bossQueue[0] || GROUPS[0];
}

function resetBossBonusState() {
  S.bossPerfectSteps = 0;
  S.bossStepMistake = false;
  S.bossFlawlessRun = true;
  S.bossSequenceStreak = 0;
}

function markBossMistake() {
  if (String(S.phase || '').toLowerCase() !== 'boss') return;
  S.bossStepMistake = true;
  S.bossFlawlessRun = false;
  S.bossSequenceStreak = 0;
}

function rewardBossStepClear(x, y) {
  const flawlessStep = !S.bossStepMistake;

  if (!flawlessStep) {
    S.bossSequenceStreak = 0;
    return 0;
  }

  S.bossPerfectSteps += 1;
  S.bossSequenceStreak += 1;

  const bonus = 12 + Math.min(18, Math.max(0, S.bossSequenceStreak - 1) * 4);
  S.score += bonus;

  showPop(x, y, `PERFECT +${bonus}`);
  setCoach('perfect');
  emitFx('perfect', { x, y });

  return bonus;
}

function rewardBossClear() {
  const base = 40;
  const perfectBonus = S.bossPerfectSteps * 6;
  const flawlessBonus = S.bossFlawlessRun ? 20 : 0;
  const total = base + perfectBonus + flawlessBonus;
  S.score += total;
  return total;
}

function clearBossWaveTimers() {
  if (!Array.isArray(S.waveTimers)) S.waveTimers = [];
  for (const tid of S.waveTimers) {
    try { clearTimeout(tid); } catch {}
  }
  S.waveTimers.length = 0;
}

function resetBossWaveState() {
  clearBossWaveTimers();
  S.waveMode = false;
  S.waveSize = 0;
  S.waveSpawned = 0;
  S.waveCooldown = 0;
  S.wavePatternName = '';
  S.wavePatternQueue = [];
  S.wavePatternIndex = 0;
}

function startBossWave() {
  S.waveMode = true;
  S.waveSpawned = 0;
  S.wavePatternIndex = 0;

  const hard = String(S.ctx?.diff || 'normal') === 'hard';
  const feverLike = !!S.feverOn || Number(S.combo || 0) >= 5 || String(S.subPhase || '') === 'final';

  let size = hard ? 3 : 2;
  if (feverLike && hard) size = 4;
  else if (feverLike) size = 3;

  S.waveSize = size;
  S.waveCooldown = 0;

  if (S.targetGroup) {
    setCoach('boss', { target: S.targetGroup.label });
  }
}

function currentPhaseProfile() {
  const phase = String(S.phase || 'warm').toLowerCase();
  const combo = Number(S.combo || 0);
  const fever = !!S.feverOn;
  const remain = Math.max(0, Number(S.phaseTimeLeft || 0));
  const total = Math.max(1, Number(S.phaseDurations?.[S.phaseIndex] || 1));
  const ratio = remain / total;
  const mobile = String(S.ctx?.view || '') === 'mobile';
  const vrLike = (S.ctx?.view === 'cvr' || S.ctx?.view === 'vr');

  if (phase === 'warm') {
    if (ratio > 0.52) {
      return {
        name: 'opening',
        lanes: [0.24, 0.50, 0.76],
        weights: [1, 2, 1],
        spawnMul: mobile ? 0.90 : 0.96,
        ttlMul: 1.08,
        capAdd: 0,
        sizeMin: mobile ? 58 : 60,
        sizeMax: mobile ? 70 : 74,
        driftX: vrLike ? 10 : 12,
        driftY: 14,
        xJitter: 5,
        banner: 'START!'
      };
    }
    return {
      name: 'flow',
      lanes: [0.18, 0.34, 0.50, 0.66, 0.82],
      weights: [1, 1, 2, 1, 1],
      spawnMul: 1.00,
      ttlMul: 1.00,
      capAdd: 0,
      sizeMin: mobile ? 56 : 58,
      sizeMax: mobile ? 68 : 72,
      driftX: vrLike ? 12 : 14,
      driftY: 16,
      xJitter: 7,
      banner: 'FLOW'
    };
  }

  if (phase === 'trick') {
    if (fever || combo >= 5) {
      return {
        name: 'fever',
        lanes: [0.28, 0.40, 0.50, 0.60, 0.72],
        weights: [1, 2, 4, 2, 1],
        spawnMul: mobile ? 1.02 : 1.06,
        ttlMul: 0.94,
        capAdd: 1,
        sizeMin: mobile ? 56 : 58,
        sizeMax: mobile ? 68 : 72,
        driftX: vrLike ? 14 : 16,
        driftY: 18,
        xJitter: 7,
        banner: 'FEVER!'
      };
    }
    return {
      name: 'trick',
      lanes: [0.20, 0.36, 0.50, 0.64, 0.80],
      weights: [1, 1, 2, 1, 1],
      spawnMul: 1.00,
      ttlMul: 1.00,
      capAdd: 0,
      sizeMin: mobile ? 56 : 58,
      sizeMax: mobile ? 68 : 72,
      driftX: vrLike ? 13 : 15,
      driftY: 17,
      xJitter: 8,
      banner: 'TRICK!'
    };
  }

  if (phase === 'boss') {
    if (ratio <= 0.34) {
      return {
        name: 'final',
        lanes: [0.34, 0.50, 0.66],
        weights: [1, 3, 1],
        spawnMul: mobile ? 1.14 : 1.20,
        ttlMul: 0.88,
        capAdd: 1,
        sizeMin: mobile ? 58 : 60,
        sizeMax: mobile ? 70 : 74,
        driftX: vrLike ? 12 : 14,
        driftY: 20,
        xJitter: 5,
        banner: 'FINAL!'
      };
    }
    return {
      name: 'rush',
      lanes: [0.26, 0.40, 0.50, 0.60, 0.74],
      weights: [1, 2, 3, 2, 1],
      spawnMul: mobile ? 1.06 : 1.12,
      ttlMul: 0.94,
      capAdd: 1,
      sizeMin: mobile ? 58 : 60,
      sizeMax: mobile ? 70 : 74,
      driftX: vrLike ? 13 : 15,
      driftY: 19,
      xJitter: 6,
      banner: 'RUSH!'
      };
    }
  }

  return {
    name: 'flow',
    lanes: [0.18, 0.34, 0.50, 0.66, 0.82],
    weights: [1, 1, 2, 1, 1],
    spawnMul: 1.00,
    ttlMul: 1.00,
    capAdd: 0,
    sizeMin: 58,
    sizeMax: 72,
    driftX: 14,
    driftY: 16,
    xJitter: 6,
    banner: ''
  };
}

function syncSubPhase(profile) {
  if (!profile) return;
  if (S.subPhase === profile.name) return;

  S.subPhase = profile.name;

  const t = nowMs();
  if (profile.banner && (t - Number(S.phaseBannerStamp || 0)) > 1400) {
    S.phaseBannerStamp = t;
    showMinorBanner(profile.banner);
  }

  applyPhaseTheme();
  showSubPhaseToast(profile.name);
  pulseWorld(S.subPhase || profile.name || S.phase);
}

function safeSpawnRect() {
  const layer = S.mount;
  const abs = layer.getBoundingClientRect();

  const isMobile = (S.ctx?.view === 'mobile');
  const isVRLike = (S.ctx?.view === 'cvr' || S.ctx?.view === 'vr');

  let left = isMobile ? 12 : 16;
  let right = abs.width - (isMobile ? 12 : 16);
  let top = isMobile ? 8 : 10;
  let bottom = abs.height - (isMobile ? 8 : 10);

  const hudTop = rectOf(DOC.getElementById('hudTop'));
  const hudBottom = rectOf(DOC.getElementById('hudBottom'));
  const drawer = rectOf(DOC.getElementById('plateDrawer'));

  if (hudTop && intersect(abs, hudTop)) {
    top = Math.max(top, (hudTop.bottom - abs.top) + (isMobile ? 10 : 8));
  }

  if (hudBottom && intersect(abs, hudBottom)) {
    bottom = Math.min(bottom, (hudBottom.top - abs.top) - (isMobile ? 14 : 10));
  }

  if (drawerOpen() && drawer && intersect(abs, drawer)) {
    bottom = Math.min(bottom, (drawer.top - abs.top) - 10);
  }

  if (overlayOpen()) {
    return {
      left: 9999,
      right: 10000,
      top: 9999,
      bottom: 10000,
      width: 1,
      height: 1
    };
  }

  if (!isVRLike && isMobile) {
    const sideBias = Math.round(Math.max(18, Math.min(40, abs.width * 0.09)));
    left += sideBias;
    right -= sideBias;
  }

  if (isVRLike) {
    top += 6;
    bottom -= 4;
  }

  const minHeight = isMobile ? 180 : 150;
  if ((bottom - top) < minHeight) {
    top = Math.max(6, top - 18);
    bottom = Math.min(abs.height - 8, bottom + 18);
  }

  if (right <= left) {
    left = 20;
    right = Math.max(21, abs.width - 20);
  }

  if (bottom <= top) {
    top = 10;
    bottom = Math.max(11, abs.height - 10);
  }

  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function maybeTelegraphSpawn(x, y, info = {}) {
  if (String(S.phase || '').toLowerCase() !== 'boss') return;
  if (S.paused || S.ended) return;

  const kind = info.good
    ? (info.groupId === Number(S.targetGroup?.id || 0) ? 'good' : 'bad')
    : 'boss';

  telegraphLaneAt(x, kind);
  telegraphAt(x, y, kind);

  const sub = String(S.subPhase || '').toLowerCase();
  if (sub === 'final') {
    telegraphAt(x, y, 'boss');
    telegraphLaneAt(x, 'boss');
  }
}

function chooseTarget() {
  const phase = String(S.phase || '').toLowerCase();
  let correctP = S.targetCorrectP;

  if (phase === 'boss') {
    correctP = clamp(correctP + 0.10, 0, 0.92);
  }

  const isCorrect = S.rng() < correctP;

  if (isCorrect) {
    const g = S.targetGroup;
    return {
      groupId: g.id,
      label: g.label,
      emoji: pick(g.good),
      good: true
    };
  }

  if (phase === 'boss' && S.rng() < 0.45) {
    return {
      groupId: 0,
      label: 'ตัวหลอก',
      emoji: pick(WRONG_POOL),
      good: false
    };
  }

  const other = pick(GROUPS.filter(g => g.id !== S.targetGroup.id));
  return {
    groupId: other.id,
    label: other.label,
    emoji: pick(other.good),
    good: false
  };
}

function chooseTargetForBossWave() {
  const current = currentBossGroup() || S.targetGroup || pickMissingGroup();

  if (S.rng() < 0.64) {
    return {
      groupId: current.id,
      label: current.label,
      emoji: pick(current.good),
      good: true
    };
  }

  if (S.rng() < 0.82) {
    const other = pick(GROUPS.filter(g => g.id !== current.id));
    return {
      groupId: other.id,
      label: other.label,
      emoji: pick(other.good),
      good: false
    };
  }

  return {
    groupId: 0,
    label: 'ตัวหลอก',
    emoji: pick(WRONG_POOL),
    good: false
  };
}

function chooseBossWaveInfoByKind(kind = 'target') {
  const current = currentBossGroup() || S.targetGroup || pickMissingGroup();

  if (kind === 'target') {
    return {
      groupId: current.id,
      label: current.label,
      emoji: pick(current.good),
      good: true
    };
  }

  if (kind === 'bait') {
    if (S.rng() < 0.55) {
      return {
        groupId: 0,
        label: 'ตัวหลอก',
        emoji: pick(WRONG_POOL),
        good: false
      };
    }
    const other = pick(GROUPS.filter(g => g.id !== current.id));
    return {
      groupId: other.id,
      label: other.label,
      emoji: pick(other.good),
      good: false
    };
  }

  return chooseTargetForBossWave();
}

function pickWeightedLane(lanes, weights) {
  if (!Array.isArray(lanes) || !lanes.length) return 0.5;
  if (!Array.isArray(weights) || weights.length !== lanes.length) {
    return lanes[(S.rng() * lanes.length) | 0];
  }

  let total = 0;
  for (const w of weights) total += Number(w || 0);

  let r = S.rng() * total;
  for (let i = 0; i < lanes.length; i++) {
    r -= Number(weights[i] || 0);
    if (r <= 0) return lanes[i];
  }
  return lanes[lanes.length - 1];
}

function applyTargetLockVisual(t) {
  if (!t || !t.el) return;

  const el = t.el;
  const isBoss = String(S.phase || '').toLowerCase() === 'boss';
  const targetId = Number(S.targetGroup?.id || 0);
  const groupId = Number(t.groupId || 0);

  if (!isBoss || !targetId) {
    delete el.dataset.targetmatch;
    delete el.dataset.distractor;
    delete el.dataset.junk;
    return;
  }

  const isMatch = !!t.good && groupId === targetId;
  const isJunk = !t.good && groupId === 0;
  const isDistractor = !isMatch;

  el.dataset.targetmatch = isMatch ? '1' : '0';
  el.dataset.distractor = isDistractor ? '1' : '0';
  el.dataset.junk = isJunk ? '1' : '0';
}

function refreshAllTargetLockVisuals() {
  for (const t of S.targets.values()) {
    applyTargetLockVisual(t);
  }
}

function createTargetFromInfo(info, profile, safe, point = null) {
  const size = Math.round(
    clamp(
      profile.sizeMin + (S.rng() * (profile.sizeMax - profile.sizeMin)),
      50,
      80
    )
  );

  const lanePct = point?.lanePct != null ? point.lanePct : pickWeightedLane(profile.lanes, profile.weights);

  const x = clamp(
    (point?.x != null ? point.x : safe.left + (safe.width * lanePct)) + ((S.rng() * 2 - 1) * Number(profile.xJitter || 0)),
    safe.left + size * 0.55,
    safe.right - size * 0.55
  );

  const y = clamp(
    point?.y != null
      ? point.y
      : safe.top + Math.max(size * 0.65, 34) + (S.rng() * Math.min(18, safe.height * 0.08)),
    safe.top + size * 0.55,
    safe.bottom - size * 0.55
  );

  const id = String(S.nextId++);
  const el = DOC.createElement('button');
  el.type = 'button';
  el.className = 'plateTarget';
  el.dataset.id = id;
  el.dataset.group = String(info.groupId || 0);
  el.dataset.good = info.good ? '1' : '0';
  el.textContent = info.emoji;

  if (info.good && S.rng() < 0.08) {
    el.dataset.kind = 'shield';
    info.kind = 'shield';
  } else {
    info.kind = 'food';
  }

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.fontSize = `${Math.round(size * 0.48)}px`;

  const born = nowMs();
  const ttlMs = ((S.feverOn ? (S.ttl * 0.9) : S.ttl) * Number(profile.ttlMul || 1)) * 1000;
  const vxBase = ((S.rng() * 2) - 1) * Number(profile.driftX || 12);
  const vyBase = (Number(profile.driftY || 16)) * (0.74 + (S.rng() * 0.52));

  S.mount.appendChild(el);

  const targetObj = {
    id,
    el,
    x,
    y,
    born,
    ttlMs,
    good: info.good,
    groupId: info.groupId,
    label: info.label,
    emoji: info.emoji,
    kind: info.kind,
    size,
    vx: vxBase,
    vy: vyBase
  };

  S.targets.set(id, targetObj);
  applyTargetLockVisual(targetObj);

  el.addEventListener('pointerdown', onHit, { passive: true });
  return targetObj;
}

function createTarget() {
  if (overlayOpen()) return;
  if (drawerOpen()) return;

  const profile = currentPhaseProfile();
  syncSubPhase(profile);

  const safe = safeSpawnRect();
  if (safe.width < 40 || safe.height < 40) return;

  const info = chooseTarget();
  createTargetFromInfo(info, profile, safe);
}

function bossLaneCenters(profile, safe) {
  const lanes = Array.isArray(profile?.lanes) && profile.lanes.length
    ? profile.lanes
    : [0.18, 0.34, 0.50, 0.66, 0.82];

  return lanes.map(p => safe.left + (safe.width * p));
}

function pickBossWavePattern(profile, safe) {
  const xs = bossLaneCenters(profile, safe);
  const n = xs.length;
  const last = n - 1;
  const c = Math.floor(last / 2);
  const l1 = Math.max(0, c - 1);
  const r1 = Math.min(last, c + 1);

  const hard = String(S.ctx?.diff || 'normal') === 'hard';
  const feverLike = !!S.feverOn || Number(S.combo || 0) >= 5 || String(S.subPhase || '') === 'final';
  const want = Math.max(2, Number(S.waveSize || 2));

  const patterns = [
    {
      name: 'sweep-lr',
      weight: feverLike ? 2 : 1,
      points: [
        { lane: 0, kind: 'target' },
        { lane: c, kind: 'target' },
        { lane: last, kind: want >= 3 ? 'target' : 'bait' },
        { lane: r1, kind: 'bait' }
      ]
    },
    {
      name: 'sweep-rl',
      weight: feverLike ? 2 : 1,
      points: [
        { lane: last, kind: 'target' },
        { lane: c, kind: 'target' },
        { lane: 0, kind: want >= 3 ? 'target' : 'bait' },
        { lane: l1, kind: 'bait' }
      ]
    },
    {
      name: 'center-burst',
      weight: 3,
      points: [
        { lane: c, kind: 'target' },
        { lane: l1, kind: 'target' },
        { lane: r1, kind: 'target' },
        { lane: c, kind: 'bait' }
      ]
    },
    {
      name: 'sandwich',
      weight: 2,
      points: [
        { lane: 0, kind: 'target' },
        { lane: c, kind: 'bait' },
        { lane: last, kind: 'target' },
        { lane: c, kind: 'target' }
      ]
    },
    {
      name: 'bait-center',
      weight: hard ? 3 : 2,
      points: [
        { lane: l1, kind: 'bait' },
        { lane: c, kind: 'target' },
        { lane: r1, kind: 'bait' },
        { lane: c, kind: 'target' }
      ]
    }
  ];

  if (String(S.subPhase || '') === 'final' || feverLike) {
    patterns.push({
      name: 'final-stack',
      weight: 4,
      points: [
        { lane: c, kind: 'target' },
        { lane: l1, kind: 'target' },
        { lane: c, kind: 'target' },
        { lane: r1, kind: hard ? 'target' : 'bait' }
      ]
    });
  }

  const total = patterns.reduce((s, p) => s + Number(p.weight || 0), 0);
  let r = S.rng() * total;
  let chosen = patterns[0];

  for (const p of patterns) {
    r -= Number(p.weight || 0);
    if (r <= 0) {
      chosen = p;
      break;
    }
  }

  const usable = chosen.points.slice(0, want).map((pt, idx) => {
    const laneX = xs[clamp(pt.lane, 0, xs.length - 1)];
    const yBase = safe.top + Math.max(36, safe.height * 0.12);
    const yStep = Math.min(22, Math.max(10, safe.height * 0.035));

    return {
      x: laneX,
      y: yBase + (idx * yStep),
      kind: pt.kind
    };
  });

  return {
    name: chosen.name,
    points: usable
  };
}

function spawnBossWavePoint(profile, point, info) {
  if (S.paused || S.ended || overlayOpen() || drawerOpen()) return;
  const safe = safeSpawnRect();
  const targetObj = createTargetFromInfo(info, profile, safe, point);
  if (!targetObj) return;
  S.waveSpawned += 1;
}

function scheduleBossWavePattern(profile, safe) {
  const chosen = pickBossWavePattern(profile, safe);

  S.wavePatternName = chosen.name;
  S.wavePatternQueue = chosen.points.slice();
  S.wavePatternIndex = 0;

  const teleBase = 60;
  const teleStep = String(S.subPhase || '') === 'final' ? 56 : 74;
  const spawnGap = 120;

  chosen.points.forEach((point, idx) => {
    const info = chooseBossWaveInfoByKind(point.kind);
    const teleDelay = teleBase + (idx * teleStep);
    const spawnDelay = teleDelay + spawnGap;

    const t1 = setTimeout(() => {
      maybeTelegraphSpawn(point.x, point.y, info);
      S.wavePatternIndex = idx;
    }, teleDelay);

    const t2 = setTimeout(() => {
      spawnBossWavePoint(profile, point, info);
    }, spawnDelay);

    S.waveTimers.push(t1, t2);
  });

  const doneDelay = teleBase + ((chosen.points.length - 1) * teleStep) + spawnGap + 40;
  const t3 = setTimeout(() => {
    finishBossWave();
  }, doneDelay);

  S.waveTimers.push(t3);
}

function ensureBossWave(profile, safe) {
  if (String(S.phase || '').toLowerCase() !== 'boss') return;
  if (S.waveMode) return;
  if (S.waveCooldown > 0) return;
  if (overlayOpen() || drawerOpen() || S.paused || S.ended) return;

  startBossWave();
  scheduleBossWavePattern(profile, safe);
}

function finishBossWave() {
  clearBossWaveTimers();
  S.waveMode = false;
  S.wavePatternQueue = [];
  S.wavePatternIndex = 0;
  S.waveCooldown = 0.55 + (S.rng() * 0.25);
}

function maybeSetTargetGroupAndRefresh(group) {
  S.targetGroup = group || pickMissingGroup();
  refreshAllTargetLockVisuals();
}

function advanceBossGoalWave() {
  S.bossStepDone += 1;

  if (S.bossStepDone < S.bossNeedPerStep) {
    maybeSetTargetGroupAndRefresh(currentBossGroup() || pickMissingGroup());
    resetBossWaveState();
    showPhaseObjectiveToast();
    return { finished:false, stepCleared:false };
  }

  const flawlessBeforeReset = !S.bossStepMistake;
  S.bossStep += 1;
  S.bossStepDone = 0;

  if (S.bossStep >= (S.bossQueue?.length || 0)) {
    S.bossCompleted = true;
    return { finished:true, stepCleared:true, flawlessStep:flawlessBeforeReset };
  }

  S.bossStepMistake = false;
  maybeSetTargetGroupAndRefresh(currentBossGroup() || pickMissingGroup());
  resetBossWaveState();

  showMinorBanner(`NEXT • ${S.targetGroup.icon} ${S.targetGroup.label}`);
  pulseWorld('boss');
  setCoach('boss', { target: S.targetGroup.label });
  showPhaseObjectiveToast();

  return { finished:false, stepCleared:true, flawlessStep:flawlessBeforeReset };
}

function accuracyPct() {
  return S.shots > 0 ? Math.round((S.hits / S.shots) * 100) : 0;
}

function removeTarget(t, mode) {
  if (!t || !t.el) return;
  S.targets.delete(t.id);
  try {
    delete t.el.dataset.targetmatch;
    delete t.el.dataset.distractor;
    delete t.el.dataset.junk;
    t.el.classList.add(mode === 'hit' ? 'hit' : 'expire');
    t.el.removeEventListener('pointerdown', onHit);
    setTimeout(() => {
      try { t.el.remove(); } catch {}
    }, 140);
  } catch {
    try { t.el.remove(); } catch {}
  }
}

function clearTargets() {
  for (const t of S.targets.values()) {
    try {
      delete t.el.dataset.targetmatch;
      delete t.el.dataset.distractor;
      delete t.el.dataset.junk;
      t.el.removeEventListener('pointerdown', onHit);
      t.el.remove();
    } catch {}
  }
  S.targets.clear();
}

function showPop(x, y, text) {
  try {
    const d = DOC.createElement('div');
    d.className = 'popScore';
    d.textContent = text;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    S.mount.appendChild(d);
    setTimeout(() => {
      try { d.remove(); } catch {}
    }, 560);
  } catch {}
}

function awardCorrect(t) {
  S.hits++;
  S.shots++;
  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);

  let add = 10 + Math.min(10, S.combo);
  const P = S.diffPreset || getDifficultyPreset(S.ctx?.diff, S.ctx?.pro);
  if (S.phase === 'boss') add += P.boss.bossBonus;
  if (S.feverOn) add += 4;

  S.score += add;
  S.fever = clamp(S.fever + 14, 0, 100);

  if (t.kind === 'shield') {
    S.shield = Math.min(3, S.shield + 1);
    setCoach('shield');
    emitFx('shield', { x: t.x, y: t.y });
  } else {
    setCoach('good', { target: S.targetGroup?.label });
    emitFx('good', { x: t.x, y: t.y });
  }

  if (t.groupId >= 1 && t.groupId <= 5) {
    const beforePlateHave = S.plateHave;
    S.counts[t.groupId] = (S.counts[t.groupId] || 0) + 1;
    S.plateHave = plateCountDistinct();

    if (beforePlateHave < 5 && S.plateHave === 5) {
      const basePlateBonus = 30;
      const sequenceBonus = (S.phase === 'boss')
        ? Math.min(15, Math.max(0, S.bossSequenceStreak - 1) * 5)
        : (S.combo >= 7 ? 10 : S.combo >= 5 ? 6 : S.combo >= 3 ? 3 : 0);

      const totalPlateBonus = basePlateBonus + sequenceBonus;
      S.score += totalPlateBonus;
      showPop(t.x, t.y, `ครบ 5 หมู่! +${totalPlateBonus}`);
      setCoach('phase-clear');
    }
  }

  showPop(t.x, t.y, `+${add}`);

  if (S.fever >= 100 && !S.feverOn) {
    S.feverOn = true;
    S.feverTimer = 6;
    setCoach('fever');
    applyPhaseTheme();
    pulseWorld('fever');
    emitFx('fever', { x: t.x, y: t.y });
    showSubPhaseToast('fever');
  }

  if (S.phase === 'boss' && !S.bossCompleted) {
    const progress = advanceBossGoalWave();

    if (progress.stepCleared) {
      rewardBossStepClear(t.x, t.y);
    }

    if (progress.finished) {
      S.bossCompleted = true;
      const bossReward = rewardBossClear();
      showMinorBanner(`BOSS CLEAR! +${bossReward}`);
      pulseWorld('final');
      setCoach('boss-clear');
      emitFx('boss-clear', { x: t.x, y: t.y });

      setTimeout(() => {
        if (!S.ended) endGame('boss-complete');
      }, 420);
    }
  }
}

function awardWrong(t = null) {
  S.shots++;
  S.wrong++;
  S.combo = 0;

  if (S.phase === 'boss') {
    markBossMistake();
  }

  if (S.shield > 0) {
    S.shield--;
  } else {
    const P = S.diffPreset || getDifficultyPreset(S.ctx?.diff, S.ctx?.pro);
    const penalty =
      S.phase === 'warm' ? P.warm.wrongPenalty :
      S.phase === 'trick' ? P.trick.wrongPenalty :
      P.boss.wrongPenalty;

    S.score = Math.max(0, S.score - penalty);
    S.miss++;
  }

  setCoach('wrong', { target: S.targetGroup?.label });
  emitFx('wrong', { x: t?.x, y: t?.y });
}

function onHit(ev) {
  if (!S.running || S.paused || S.ended) return;
  const el = ev.currentTarget;
  const t = S.targets.get(String(el.dataset.id));
  if (!t) return;

  if (t.good && t.groupId === S.targetGroup.id) {
    awardCorrect(t);
    removeTarget(t, 'hit');
  } else {
    awardWrong(t);
    removeTarget(t, 'hit');
  }

  updateHud();
}

function setPhase(index) {
  S.phaseIndex = clamp(index, 0, S.phaseList.length - 1);
  S.phase = S.phaseList[S.phaseIndex];
  S.phaseTimeLeft = S.phaseDurations[S.phaseIndex];

  const P = S.diffPreset || getDifficultyPreset(S.ctx?.diff, S.ctx?.pro);
  S.subPhase = (S.phase === 'warm') ? 'opening' : (S.phase === 'trick' ? 'trick' : 'rush');
  S.phaseBannerStamp = 0;

  if (S.phase === 'warm') {
    S.targetCorrectP = P.warm.targetCorrectP;
    S.spawnPerSec = P.warm.spawnPerSec;
    S.ttl = P.warm.ttl;
    S.targetGroup = pick(GROUPS);
    setCoach('warm', { target: S.targetGroup.label });
    showPhaseBanner('warm');
    emitFx('phase');
  } else if (S.phase === 'trick') {
    S.targetCorrectP = P.trick.targetCorrectP;
    S.spawnPerSec = P.trick.spawnPerSec;
    S.ttl = P.trick.ttl;
    S.targetGroup = pick(GROUPS);
    setCoach('trick', { target: S.targetGroup.label });
    showPhaseBanner('trick');
    emitFx('phase');
  } else {
    S.targetCorrectP = P.boss.targetCorrectP;
    S.spawnPerSec = P.boss.spawnPerSec;
    S.ttl = P.boss.ttl;
    resetBossGoalWave();
    resetBossBonusState();
    resetBossWaveState();
    setCoach('boss', { target: S.targetGroup?.label });
    showPhaseBanner('boss');
    emitFx('phase');
  }

  if (S.ctx?.view === 'mobile') {
    S.spawnPerSec *= 0.90;
    S.ttl += 0.24;
    S.missLimit += 2;
  }

  applyPhaseTheme();
  pulseWorld(S.phase);
  showPhaseObjectiveToast();
  refreshAllTargetLockVisuals();
  updateHud();
}

function phaseAdvance() {
  clearBossWaveTimers();
  clearTargets();
  S.spawnAcc = 0;

  if (S.phaseIndex < S.phaseList.length - 1) {
    setCoach('phase-clear');
    setPhase(S.phaseIndex + 1);
  } else {
    endGame('time');
  }
}

function updateFever(dt) {
  if (!S.feverOn) return;
  S.feverTimer -= dt;
  if (S.feverTimer <= 0) {
    S.feverOn = false;
    S.fever = 0;
    applyPhaseTheme();
  }
}

function updateTargets(dt) {
  const now = nowMs();
  const safe = safeSpawnRect();
  const profile = currentPhaseProfile();
  syncSubPhase(profile);

  for (const t of Array.from(S.targets.values())) {
    t.x += Number(t.vx || 0) * dt;
    t.y += Number(t.vy || 0) * dt;

    const half = Math.max(20, Number(t.size || 56) * 0.55);

    if (t.x <= safe.left + half) {
      t.x = safe.left + half;
      t.vx *= -0.92;
    } else if (t.x >= safe.right - half) {
      t.x = safe.right - half;
      t.vx *= -0.92;
    }

    if (t.y <= safe.top + half) {
      t.y = safe.top + half;
      t.vy = Math.abs(t.vy || 12);
    }

    if (t.el) {
      t.el.style.left = `${t.x}px`;
      t.el.style.top = `${t.y}px`;

      const agePct = (now - t.born) / Math.max(1, t.ttlMs);
      if (agePct > 0.72) {
        const alpha = clamp(1 - ((agePct - 0.72) / 0.28), 0.18, 1);
        t.el.style.opacity = String(alpha);
      } else {
        t.el.style.opacity = '1';
      }
    }

    if ((now - t.born) >= t.ttlMs || t.y >= (safe.bottom - half * 0.55)) {
      if (t.good && t.groupId === S.targetGroup.id) {
        if (S.phase === 'boss') {
          markBossMistake();
        }

        if (S.shield > 0) {
          S.shield--;
        } else {
          S.miss++;
          S.combo = 0;
        }

        setCoach('miss', { target: S.targetGroup?.label });
        emitFx('miss', { x: t.x, y: t.y });
      }
      removeTarget(t, 'expire');
    }
  }

  if (overlayOpen()) return;
  if (drawerOpen()) return;

  const P = S.diffPreset || getDifficultyPreset(S.ctx?.diff, S.ctx?.pro);

  let cap = (S.ctx?.view === 'mobile') ? 5 : 7;
  if (S.phase === 'trick') cap += (P.trick.capBonus || 0);
  if (S.phase === 'boss') cap += (P.boss.capBonus || 0);
  cap += Number(profile.capAdd || 0);

  if (String(S.phase || '').toLowerCase() === 'boss') {
    if (S.waveCooldown > 0) {
      S.waveCooldown = Math.max(0, S.waveCooldown - dt);
      return;
    }

    if (S.targets.size < cap) {
      ensureBossWave(profile, safe);
    }
    refreshAllTargetLockVisuals();
    return;
  }

  S.spawnAcc += (S.spawnPerSec * Number(profile.spawnMul || 1)) * dt;

  while (S.spawnAcc >= 1) {
    S.spawnAcc -= 1;
    if (S.targets.size < cap) {
      createTarget();
    }
  }
}

function buildCooldownUrl() {
  try {
    const u = new URL('../warmup-gate.html', location.href);
    u.searchParams.set('phase', 'cooldown');
    u.searchParams.set('gatePhase', 'cooldown');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('theme', 'platev1');
    u.searchParams.set('game', 'platev1');
    u.searchParams.set('pid', String(S.ctx.pid || 'anon'));
    u.searchParams.set('hub', String(S.hub || '../hub.html'));
    u.searchParams.set('next', String(S.hub || '../hub.html'));
    return u.toString();
  } catch {
    return String(S.hub || '../hub.html');
  }
}

function buildSummary() {
  const acc = accuracyPct();
  return {
    game: 'platev1',
    mode: 'solo',
    reason: 'end',
    reasonDetail: S.bossCompleted ? 'boss-complete' : 'time',
    phase: S.phase,
    subPhase: S.subPhase,
    scoreFinal: S.score,
    grade: gradeOf(acc),
    accPct: acc,
    ok: S.hits,
    wrong: S.wrong,
    miss: S.miss,
    comboMax: S.comboMax,
    plateHave: S.plateHave,
    counts: { ...S.counts },
    bossStep: S.bossStep,
    bossNeedPerStep: S.bossNeedPerStep,
    bossQueue: (S.bossQueue || []).map(g => g?.key || g?.label || ''),
    bossPerfectSteps: S.bossPerfectSteps,
    bossFlawlessRun: !!S.bossFlawlessRun,
    bossSequenceStreak: S.bossSequenceStreak,
    diff: S.ctx.diff,
    pro: !!S.ctx.pro,
    difficultyPreset: S.ctx.diff,
    view: S.ctx.view,
    seed: S.ctx.seed,
    pid: S.ctx.pid,
    feverOnEnd: !!S.feverOn,
    audioEnabled: !!S.audioEnabled,
    hapticEnabled: !!S.hapticEnabled
  };
}

function endGame(reason) {
  if (S.ended) return;
  S.ended = true;
  S.running = false;
  try { cancelAnimationFrame(S.raf); } catch {}
  clearBossWaveTimers();
  clearTargets();
  try {
    if (S.audioCtx?.state === 'running') S.audioCtx.suspend?.();
  } catch {}

  const fxLayer = DOC.getElementById('fxLayer');
  if (fxLayer) {
    fxLayer.querySelectorAll('.fxTelegraph,.fxLaneFlash').forEach(el => {
      try { el.remove(); } catch {}
    });
  }

  const sum = buildSummary();
  sum.reason = reason || 'end';

  saveJson(`HHA_LAST_SUMMARY:platev1:${S.ctx.pid || 'anon'}`, sum);
  saveJson('HHA_LAST_SUMMARY', { ...sum, game: 'platev1' });

  setText('endTitle', 'เก่งมาก! จบเกมแล้ว 🎉');
  setText(
    'endSub',
    `mode=solo • diff=${S.ctx.diff} • view=${S.ctx.view} • phase=${friendlyPhaseLabel(S.phase)}${S.subPhase ? ` • ${subPhaseLabel(S.subPhase)}` : ''}`
  );

  renderHeroEndSummary(sum);
  applyPhaseTheme();

  const doneKey = `HHA_GATE_DONE:platev1:cooldown:${dayKey()}:${S.ctx.pid || 'anon'}`;
  S.cooldownDone = !!localStorage.getItem(doneKey);

  const btnNextCooldown = DOC.getElementById('btnNextCooldown');
  if (S.cooldownEnabled && !S.cooldownDone) {
    btnNextCooldown?.classList.remove('is-hidden');
    btnNextCooldown?.style.removeProperty('display');
  } else {
    btnNextCooldown?.style.setProperty('display', 'none');
  }

  setOverlayHidden('pauseOverlay', true);
  setObjectiveToastHidden(true);

  const pauseBossPanel = DOC.getElementById('pauseBossPanel');
  if (pauseBossPanel) pauseBossPanel.hidden = true;

  const liveBossStrip = DOC.getElementById('liveBossStrip');
  if (liveBossStrip) liveBossStrip.hidden = true;

  DOC.getElementById('endOverlay')?.setAttribute('aria-hidden', 'false');
}

function wireEndButtons() {
  DOC.getElementById('btnCopy')?.addEventListener('click', async () => {
    const sum = buildSummary();
    const text =
`Plate Solo Summary
score=${sum.scoreFinal}
grade=${sum.grade}
ok=${sum.ok}
wrong=${sum.wrong}
miss=${sum.miss}
acc=${sum.accPct}%
comboMax=${sum.comboMax}
plateHave=${sum.plateHave}/5
diff=${sum.diff}
pro=${sum.pro ? 1 : 0}
reasonDetail=${sum.reasonDetail}
bossPerfectSteps=${sum.bossPerfectSteps}
bossFlawlessRun=${sum.bossFlawlessRun ? 'yes' : 'no'}`;

    try {
      await copyToClipboard(text);
      setCoach('good');
    } catch {}
  });

  DOC.getElementById('btnReplay')?.addEventListener('click', () => {
    try {
      const u = new URL(location.href);
      if (S.ctx.run !== 'research') {
        u.searchParams.set('seed', String((Date.now() ^ (Math.random() * 1e9)) | 0));
      }
      location.href = u.toString();
    } catch {
      location.reload();
    }
  });

  DOC.getElementById('btnNextCooldown')?.addEventListener('click', () => {
    location.href = buildCooldownUrl();
  });

  DOC.getElementById('btnBackHub2')?.addEventListener('click', () => {
    location.href = String(S.hub || '../hub.html');
  });
}

function wirePauseButtons() {
  DOC.getElementById('btnPauseClose')?.addEventListener('click', () => {
    WIN.__PLATE_SET_PAUSED__?.(false);
  });

  DOC.getElementById('btnResumeFromPause')?.addEventListener('click', () => {
    WIN.__PLATE_SET_PAUSED__?.(false);
  });

  DOC.getElementById('btnRestartFromPause')?.addEventListener('click', () => {
    try {
      const u = new URL(location.href);
      if (S.ctx?.run !== 'research') {
        u.searchParams.set('seed', String((Date.now() ^ (Math.random() * 1e9)) | 0));
      }
      location.href = u.toString();
    } catch {
      location.reload();
    }
  });

  DOC.getElementById('btnHubFromPause')?.addEventListener('click', () => {
    location.href = String(S.hub || '../hub.html');
  });

  DOC.getElementById('btnGuideFromPause')?.addEventListener('click', () => {
    const drawer = DOC.getElementById('plateDrawer');
    if (!drawer) return;

    const open = drawer.getAttribute('aria-hidden') === 'false';
    drawer.setAttribute('aria-hidden', open ? 'true' : 'false');
    drawer.style.display = open ? 'none' : 'block';
  });
}

function updateHud() {
  setText('uiScore', S.score);
  setText('uiCombo', S.combo);
  setText('uiComboMax', S.comboMax);
  setText('uiMiss', S.miss);
  setText('uiPlateHave', S.plateHave);
  setText('uiAcc', `${accuracyPct()}%`);
  setText('uiGrade', gradeOf(accuracyPct()));
  setText('uiTime', Math.ceil(Math.max(0, S.totalTimeLeft)));
  setText('uiShield', S.shield);
  setText('uiFever', `${Math.round(S.fever)}%`);

  setText(
    'uiTargetText',
    String(S.phase || '').toLowerCase() === 'boss'
      ? `LOCK ${S.targetGroup?.icon || '🎯'} ${friendlyTargetText(S.targetGroup?.label)}`
      : friendlyTargetText(S.targetGroup?.label)
  );

  setText('uiPhase', `${friendlyPhaseLabel(S.phase)} • ${subPhaseLabel(S.subPhase)}`);

  const phaseTotal = Math.max(1, S.phaseDurations[S.phaseIndex] || 1);
  const phaseDone = Math.round(((phaseTotal - S.phaseTimeLeft) / phaseTotal) * 100);

  if (String(S.phase || '').toLowerCase() === 'boss') {
    const totalSteps = Math.max(1, S.bossQueue?.length || 0);
    const doneSteps = Math.min(totalSteps, Number(S.bossStep || 0));
    const stepPct = Math.round((doneSteps / totalSteps) * 100);
    setText('uiPhaseProg', `${doneSteps}/${totalSteps}`);
    setWidth('uiGoalFill', stepPct);
  } else {
    setText('uiPhaseProg', `${Math.max(0, phaseTotal - Math.ceil(S.phaseTimeLeft))}/${phaseTotal}`);
    setWidth('uiGoalFill', phaseDone);
  }

  setWidth('uiFeverFill', S.fever);

  for (let i = 1; i <= 5; i++) {
    setText(`uiG${i}`, S.counts[i] || 0);
  }

  syncPauseOverlay();
  renderLiveBossStrip();
}

function loop(ts) {
  if (!S.running) return;

  if (S.paused || overlayOpen()) {
    S.lastTick = ts;
    S.raf = requestAnimationFrame(loop);
    return;
  }

  const dt = Math.min(0.05, Math.max(0.001, (ts - S.lastTick) / 1000));
  S.lastTick = ts;

  S.totalTimeLeft = Math.max(0, S.totalTimeLeft - dt);
  S.phaseTimeLeft = Math.max(0, S.phaseTimeLeft - dt);

  updateFever(dt);
  updateTargets(dt);
  updateHud();

  if (S.phaseTimeLeft <= 0) {
    phaseAdvance();
    if (!S.running) return;
  }

  S.raf = requestAnimationFrame(loop);
}

function boot(ctx) {
  S.ctx = {
    mount: ctx.mount,
    view: String(ctx.view || 'mobile').toLowerCase(),
    run: String(ctx.run || 'play').toLowerCase(),
    diff: String(ctx.diff || 'normal').toLowerCase(),
    mode: 'solo',
    seed: String(ctx.seed || Date.now()),
    pid: String(ctx.pid || 'anon'),
    time: clamp(ctx.time || 90, 30, 300),
    pro: !!ctx.pro
  };

  S.mount = ctx.mount;
  ensureWorldPhaseNodes();

  S.ai = ctx.ai || null;
  S.hub = String(ctx.hub || '../hub.html');
  S.cooldownEnabled = !!ctx.cooldown;
  S.diffPreset = getDifficultyPreset(S.ctx.diff, S.ctx.pro);
  S.rng = makeRng(S.ctx.seed);

  S.running = true;
  S.paused = false;
  S.ended = false;

  S.score = 0;
  S.combo = 0;
  S.comboMax = 0;
  S.miss = 0;
  S.hits = 0;
  S.wrong = 0;
  S.shots = 0;
  S.fever = 0;
  S.feverOn = false;
  S.feverTimer = 0;
  S.shield = 0;
  S.spawnAcc = 0;
  S.nextId = 1;
  S.targets.clear();
  resetCounts();
  S.plateHave = 0;
  S.missLimit = 999;
  S.bossCompleted = false;

  S.bossQueue = [];
  S.bossStep = 0;
  S.bossNeedPerStep = 1;
  S.bossStepDone = 0;
  S.bossPerfectSteps = 0;
  S.bossStepMistake = false;
  S.bossFlawlessRun = true;
  S.bossSequenceStreak = 0;

  S.waveMode = false;
  S.waveSize = 0;
  S.waveSpawned = 0;
  S.waveCooldown = 0;
  S.wavePatternName = '';
  S.wavePatternQueue = [];
  S.wavePatternIndex = 0;
  S.waveTimers = [];

  S.subPhase = 'opening';
  S.phaseBannerStamp = 0;

  const total = S.ctx.time;
  const warm = Math.max(12, Math.round(total * 0.34));
  const trick = Math.max(10, Math.round(total * 0.33));
  const boss = Math.max(8, total - warm - trick);
  S.phaseDurations = [warm, trick, boss];
  S.totalTimeLeft = total;

  wireEndButtons();
  wirePauseButtons();

  const unlockOnce = () => {
    unlockAudio();
    WIN.removeEventListener('pointerdown', unlockOnce);
    WIN.removeEventListener('keydown', unlockOnce);
  };
  WIN.addEventListener('pointerdown', unlockOnce, { passive: true });
  WIN.addEventListener('keydown', unlockOnce, { passive: true });

  WIN.__PLATE_SET_PAUSED__ = function (on) {
    S.paused = !!on;

    if (!S.paused) {
      S.lastTick = performance.now();
      try {
        if (S.audioCtx?.state === 'suspended') S.audioCtx.resume?.();
      } catch {}
    } else {
      try {
        if (S.audioCtx?.state === 'running') S.audioCtx.suspend?.();
      } catch {}
      clearBossWaveTimers();
      const fxLayer = DOC.getElementById('fxLayer');
      if (fxLayer) {
        fxLayer.querySelectorAll('.fxTelegraph,.fxLaneFlash').forEach(el => {
          try { el.remove(); } catch {}
        });
      }
    }

    syncPauseOverlay();

    if (S.paused) {
      setObjectiveToastHidden(true);
    }
  };

  DOC.getElementById('endOverlay')?.setAttribute('aria-hidden', 'true');
  setOverlayHidden('pauseOverlay', true);
  setObjectiveToastHidden(true);
  renderPauseBossQueue();

  setPhase(0);
  applyPhaseTheme();
  updateHud();
  renderLiveBossStrip();

  const miniBtn = DOC.getElementById('btnMiniAfterEnd');
  if (miniBtn) miniBtn.href = buildMiniGameUrl();

  setCoach('warm', { target: S.targetGroup?.label });

  S.lastTick = performance.now();
  S.raf = requestAnimationFrame(loop);
}

WIN.PlateSolo = WIN.PlateSolo || {};
WIN.PlateSolo.boot = boot;

export { boot };