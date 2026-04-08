'use strict';

const WIN = window;
const DOC = document;

const GROUPS = [
  { id: 1, key: 'protein', label: 'โปรตีน', icon: '🐟', good: ['🐟', '🥚', '🍗', '🫘'] },
  { id: 2, key: 'carb',    label: 'ข้าว/แป้ง', icon: '🍚', good: ['🍚', '🍞', '🥔', '🍠'] },
  { id: 3, key: 'veg',     label: 'ผัก', icon: '🥦', good: ['🥦', '🥬', '🥕', '🥒'] },
  { id: 4, key: 'fruit',   label: 'ผลไม้', icon: '🍎', good: ['🍎', '🍌', '🍉', '🍇'] },
  { id: 5, key: 'fat',     label: 'ไขมันดี', icon: '🥑', good: ['🥑', '🥜', '🫒', '🥥'] }
];

const WRONG_POOL = ['🍩', '🥤', '🍟', '🧁', '🍭', '🍔', '🍫'];

const S = {
  mount: null,
  ctx: null,
  ai: null,
  rng: Math.random,

  running: false,
  paused: false,
  ended: false,

  raf: 0,
  lastTick: 0,
  spawnAcc: 0,
  nextId: 1,

  phase: 'warm',
  phaseIndex: 0,
  phaseList: ['warm', 'trick', 'boss'],
  phaseDurations: [30, 30, 30],
  phaseTimeLeft: 30,
  totalTimeLeft: 90,
  subPhase: 'opening',
  phaseBannerStamp: 0,

  targetGroup: null,
  targets: new Map(),

  score: 0,
  combo: 0,
  comboMax: 0,
  hits: 0,
  wrong: 0,
  miss: 0,
  shots: 0,

  fever: 0,
  feverOn: false,
  feverTimer: 0,
  shield: 0,

  counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  plateHave: 0,

  bossQueue: [],
  bossStep: 0,
  bossNeedPerStep: 1,
  bossStepDone: 0,
  bossPerfectSteps: 0,
  bossStepMistake: false,
  bossFlawlessRun: true,
  bossCompleted: false,

  hub: '../hub-v2.html',
  cooldownEnabled: false,

  diffPreset: null,

  toastTimer: 0,
  toastKey: '',
  toastAt: 0,

  pauseWired: false,
  endWired: false
};

function clamp(v, a, b) {
  const n = Number(v);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}

function nowMs() {
  return (performance && performance.now) ? performance.now() : Date.now();
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

function setObjectiveToastHidden(hidden) {
  const el = DOC.getElementById('objectiveToast');
  if (el) el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

function xmur3(str) {
  str = String(str || '');
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
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

function rand(min, max) {
  return min + (S.rng() * (max - min));
}

function pick(arr) {
  return arr[(S.rng() * arr.length) | 0];
}

function overlayOpen() {
  const el = DOC.getElementById('endOverlay');
  return !!(el && el.getAttribute('aria-hidden') === 'false');
}

function drawerOpen() {
  const el = DOC.getElementById('plateDrawer');
  return !!(el && el.getAttribute('aria-hidden') === 'false');
}

function showPhaseBanner(text) {
  const d = DOC.createElement('div');
  d.className = 'phaseBanner';
  d.textContent = String(text || '');
  DOC.getElementById('app')?.appendChild(d);
  setTimeout(() => {
    try { d.remove(); } catch {}
  }, 950);
}

function showMinorBanner(text) {
  const d = DOC.createElement('div');
  d.className = 'phaseBanner';
  d.textContent = String(text || '');
  DOC.getElementById('app')?.appendChild(d);
  setTimeout(() => {
    try { d.remove(); } catch {}
  }, 780);
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

function pulseApp(kind = 'good') {
  const app = DOC.getElementById('app');
  if (!app) return;

  app.classList.remove('fx-good', 'fx-wrong', 'fx-fever', 'fx-boss');
  app.classList.add(`fx-${kind}`);

  setTimeout(() => {
    app.classList.remove(`fx-${kind}`);
  }, 180);
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

function emitFx(kind, data = {}) {
  const x = Number.isFinite(data.x) ? data.x : null;
  const y = Number.isFinite(data.y) ? data.y : null;

  if (kind === 'good') {
    pulseApp('good');
    if (x != null && y != null) fxPulseAt(x, y, 'good');
  } else if (kind === 'wrong' || kind === 'miss') {
    pulseApp('wrong');
    if (x != null && y != null) fxPulseAt(x, y, 'bad');
  } else if (kind === 'fever') {
    pulseApp('fever');
    if (x != null && y != null) fxPulseAt(x, y, 'fever');
  } else if (kind === 'boss') {
    pulseApp('boss');
    if (x != null && y != null) fxPulseAt(x, y, 'boss');
  }
}

function childCoachText(kind, data = {}) {
  const target = String(data.target || '').trim();
  switch (String(kind || '')) {
    case 'warm': return `WARM: เก็บ “${target || 'หมู่เป้าหมาย'}”`;
    case 'trick': return 'TRICK: ดูดี ๆ มีตัวหลอกนะ';
    case 'boss': return `BOSS: เติม ${target || 'หมู่เป้าหมาย'} ให้ครบ`;
    case 'good': return 'เยี่ยมมาก! ถูกต้องแล้ว';
    case 'wrong': return 'ลองดูใหม่อีกนิดนะ';
    case 'miss': return 'ไม่เป็นไร ยังทันอยู่';
    case 'shield': return 'ได้โล่แล้ว! กันพลาดได้ 1 ครั้ง';
    case 'fever': return 'Fever มาแล้ว! รีบเก็บแต้ม';
    case 'boss-clear': return 'ผ่าน BOSS แล้ว! จานสมดุลครบทั้ง 5 หมู่';
    default: return 'พร้อมลุย! เติมจานให้ครบ 5 หมู่ 💪';
  }
}

function setCoach(kind, data = {}) {
  setText('coachMsg', childCoachText(kind, data));
}

function gradeOf(acc) {
  if (acc >= 90) return 'S';
  if (acc >= 75) return 'A';
  if (acc >= 60) return 'B';
  if (acc >= 40) return 'C';
  return 'D';
}

function accuracyPct() {
  return S.shots > 0 ? Math.round((S.hits / S.shots) * 100) : 0;
}

function plateCountDistinct() {
  let n = 0;
  for (let i = 1; i <= 5; i += 1) {
    if ((S.counts[i] || 0) > 0) n += 1;
  }
  return n;
}

function resetCounts() {
  for (let i = 1; i <= 5; i += 1) {
    S.counts[i] = 0;
  }
}

function getDifficultyPreset(diff = 'normal', pro = false) {
  const d = String(diff || 'normal').toLowerCase();

  let preset = {
    warm:  { targetCorrectP: 0.82, spawnPerSec: 0.95, ttl: 3.8, cap: 4, wrongPenalty: 4, correctBonus: 10 },
    trick: { targetCorrectP: 0.60, spawnPerSec: 1.12, ttl: 3.1, cap: 5, wrongPenalty: 5, correctBonus: 12 },
    boss:  { targetCorrectP: 0.70, spawnPerSec: 1.20, ttl: 2.9, cap: 4, wrongPenalty: 6, correctBonus: 14 }
  };

  if (d === 'easy') {
    preset = {
      warm:  { targetCorrectP: 0.88, spawnPerSec: 0.80, ttl: 4.2, cap: 4, wrongPenalty: 2, correctBonus: 10 },
      trick: { targetCorrectP: 0.68, spawnPerSec: 0.94, ttl: 3.5, cap: 4, wrongPenalty: 3, correctBonus: 12 },
      boss:  { targetCorrectP: 0.78, spawnPerSec: 1.02, ttl: 3.2, cap: 4, wrongPenalty: 4, correctBonus: 14 }
    };
  } else if (d === 'hard') {
    preset = {
      warm:  { targetCorrectP: 0.78, spawnPerSec: 1.04, ttl: 3.3, cap: 5, wrongPenalty: 5, correctBonus: 11 },
      trick: { targetCorrectP: 0.54, spawnPerSec: 1.24, ttl: 2.7, cap: 6, wrongPenalty: 6, correctBonus: 13 },
      boss:  { targetCorrectP: 0.62, spawnPerSec: 1.34, ttl: 2.5, cap: 5, wrongPenalty: 7, correctBonus: 16 }
    };
  }

  if (pro) {
    ['warm', 'trick', 'boss'].forEach(k => {
      preset[k].spawnPerSec *= 1.08;
      preset[k].ttl *= 0.94;
      preset[k].cap += 1;
      preset[k].wrongPenalty += 1;
    });
  }

  return preset;
}

function friendlyPhaseLabel(phase) {
  switch (String(phase || '').toLowerCase()) {
    case 'warm': return 'WARM';
    case 'trick': return 'TRICK';
    case 'boss': return 'BOSS';
    default: return 'PLAY';
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

function resolveThemeSubPhase() {
  if (S.feverOn) return 'fever';

  if (S.phase === 'warm') {
    return S.phaseTimeLeft > (S.phaseDurations[0] * 0.55) ? 'opening' : 'flow';
  }

  if (S.phase === 'trick') return 'trick';

  if (S.phase === 'boss') {
    const ratio = S.phaseTimeLeft / Math.max(1, S.phaseDurations[2]);
    if (ratio <= 0.30) return 'final';
    return 'rush';
  }

  return 'flow';
}

function applyPhaseTheme() {
  S.subPhase = resolveThemeSubPhase();
  DOC.body.dataset.phase = S.phase;
  DOC.body.dataset.subphase = S.subPhase;
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
  if (S.phase === 'warm') {
    showObjectiveToast({
      badge: 'WARM',
      title: `เก็บ ${S.targetGroup?.icon || '🎯'} ${S.targetGroup?.label || 'หมู่เป้าหมาย'}`,
      sub: 'เริ่มแบบอ่านง่ายก่อน แล้วค่อยเร็วขึ้น',
      tone: toastToneOf(S.phase, S.subPhase),
      key: `warm:${S.targetGroup?.id || ''}`
    });
    return;
  }

  if (S.phase === 'trick') {
    showObjectiveToast({
      badge: 'TRICK',
      title: `ระวังตัวหลอก • เก็บ ${S.targetGroup?.icon || '🎯'} ${S.targetGroup?.label || 'หมู่เป้าหมาย'}`,
      sub: 'ดูให้ชัดแล้วค่อยแตะ',
      tone: toastToneOf(S.phase, S.subPhase),
      key: `trick:${S.targetGroup?.id || ''}`
    });
    return;
  }

  if (S.phase === 'boss') {
    const total = Math.max(1, S.bossQueue.length || 5);
    const step = Math.min(total, S.bossStep + 1);
    const need = Math.max(1, S.bossNeedPerStep);
    const done = Math.min(need, S.bossStepDone);

    showObjectiveToast({
      badge: `BOSS ${step}/${total}`,
      title: `เติม ${S.targetGroup?.icon || '🎯'} ${S.targetGroup?.label || 'หมู่เป้าหมาย'}`,
      sub: `เก็บให้ครบ ${done}/${need} แล้วไปหมู่ถัดไป`,
      tone: toastToneOf(S.phase, S.subPhase),
      key: `boss:${step}:${S.targetGroup?.id || ''}:${done}/${need}`
    });
  }
}

function showSubPhaseToast(name = '') {
  const n = String(name || '').toLowerCase();

  if (n === 'fever') {
    showObjectiveToast({
      badge: 'FEVER',
      title: 'รีบเก็บแต้ม • ตอนนี้คะแนนแรงขึ้น',
      sub: 'รักษาคอมโบไว้ให้ยาวที่สุด',
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

function getSafeRect() {
  const w = Math.max(1, S.mount.clientWidth || 1);
  const h = Math.max(1, S.mount.clientHeight || 1);
  const isMobile = String(S.ctx?.view || '') === 'mobile';

  const padX = isMobile ? 26 : 18;
  const padTop = isMobile ? 18 : 16;
  const padBottom = isMobile ? 24 : 18;

  return {
    left: padX,
    right: Math.max(padX + 1, w - padX),
    top: padTop,
    bottom: Math.max(padTop + 1, h - padBottom),
    width: Math.max(1, w - padX * 2),
    height: Math.max(1, h - padTop - padBottom)
  };
}

function buildBossQueue() {
  const list = GROUPS.slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = (S.rng() * (i + 1)) | 0;
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function currentBossGroup() {
  return S.bossQueue[S.bossStep] || null;
}

function resetBossGoalState() {
  S.bossQueue = buildBossQueue();
  S.bossStep = 0;
  S.bossStepDone = 0;
  S.bossNeedPerStep = (S.ctx?.diff === 'hard') ? 2 : 1;
  S.bossPerfectSteps = 0;
  S.bossStepMistake = false;
  S.bossFlawlessRun = true;
  S.bossCompleted = false;
  S.targetGroup = currentBossGroup() || GROUPS[0];
}

function markBossMistake() {
  if (S.phase !== 'boss') return;
  S.bossStepMistake = true;
  S.bossFlawlessRun = false;
}

function chooseTarget() {
  const preset = S.diffPreset[S.phase];
  const isCorrect = S.rng() < preset.targetCorrectP;

  if (isCorrect) {
    return {
      groupId: S.targetGroup.id,
      label: S.targetGroup.label,
      emoji: pick(S.targetGroup.good),
      good: true
    };
  }

  if (S.phase !== 'warm' && S.rng() < 0.4) {
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

function createTarget(info = null, point = null) {
  if (overlayOpen()) return;
  if (drawerOpen()) return;

  const safe = getSafeRect();
  if (safe.width < 40 || safe.height < 40) return;

  const preset = S.diffPreset[S.phase];
  const chosen = info || chooseTarget();
  const id = String(S.nextId++);
  const size = Math.round(rand(S.ctx.view === 'mobile' ? 54 : 58, S.ctx.view === 'mobile' ? 70 : 76));

  const x = point?.x != null
    ? clamp(point.x, safe.left + size * 0.6, safe.right - size * 0.6)
    : rand(safe.left + size * 0.6, safe.right - size * 0.6);

  const y = point?.y != null
    ? clamp(point.y, safe.top + size * 0.6, safe.bottom - size * 0.6)
    : rand(safe.top + size * 0.6, safe.top + Math.min(safe.height * 0.35, 160));

  const el = DOC.createElement('button');
  el.type = 'button';
  el.className = 'plateTarget';
  el.dataset.id = id;
  el.dataset.group = String(chosen.groupId || 0);
  el.dataset.good = chosen.good ? '1' : '0';
  el.textContent = chosen.emoji;

  let kind = 'food';
  if (chosen.good && S.rng() < 0.08) {
    kind = 'shield';
    el.dataset.kind = 'shield';
  }

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.fontSize = `${Math.round(size * 0.48)}px`;

  const vx = rand(-20, 20);
  const vy = rand(48, 82) * (S.phase === 'boss' ? 1.08 : 1);

  const t = {
    id,
    el,
    x,
    y,
    size,
    born: nowMs(),
    ttlMs: Math.round((preset.ttl * (S.feverOn ? 0.92 : 1)) * 1000),
    good: chosen.good,
    groupId: chosen.groupId,
    label: chosen.label,
    emoji: chosen.emoji,
    kind,
    vx,
    vy
  };

  S.mount.appendChild(el);
  S.targets.set(id, t);

  el.addEventListener('pointerdown', onHit, { passive: true });
  applyTargetLockVisual(t);
}

function primeStartTargets() {
  const safe = getSafeRect();
  const count = S.ctx.view === 'mobile' ? 2 : 3;

  for (let i = 0; i < count; i += 1) {
    createTarget(null, {
      x: safe.left + safe.width * (0.32 + i * 0.18),
      y: safe.top + 90 + (i * 24)
    });
  }
}

function removeTarget(t, mode = 'expire') {
  if (!t || !t.el) return;
  S.targets.delete(t.id);

  try {
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
      t.el.removeEventListener('pointerdown', onHit);
      t.el.remove();
    } catch {}
  }
  S.targets.clear();
}

function onHit(ev) {
  if (!S.running || S.paused || S.ended) return;

  const el = ev.currentTarget;
  const id = String(el.dataset.id || '');
  const t = S.targets.get(id);
  if (!t) return;

  S.shots += 1;

  const matched = !!t.good && Number(t.groupId) === Number(S.targetGroup?.id || 0);

  if (matched) {
    S.hits += 1;
    S.combo += 1;
    S.comboMax = Math.max(S.comboMax, S.combo);

    let add = S.diffPreset[S.phase].correctBonus + Math.min(10, S.combo);
    if (S.feverOn) add += 4;
    S.score += add;
    S.fever = clamp(S.fever + 14, 0, 100);

    if (t.kind === 'shield') {
      S.shield = Math.min(3, S.shield + 1);
      setCoach('shield');
    } else {
      setCoach('good', { target: S.targetGroup?.label });
    }

    if (Number(t.groupId) >= 1 && Number(t.groupId) <= 5) {
      S.counts[t.groupId] = (S.counts[t.groupId] || 0) + 1;
      S.plateHave = plateCountDistinct();
    }

    if (S.phase === 'boss') {
      S.bossStepDone += 1;

      if (S.bossStepDone >= S.bossNeedPerStep) {
        if (!S.bossStepMistake) {
          S.bossPerfectSteps += 1;
          S.score += 12;
          showPop(t.x, t.y, 'PERFECT +12');
        }

        S.bossStep += 1;
        S.bossStepDone = 0;
        S.bossStepMistake = false;

        if (S.bossStep >= S.bossQueue.length) {
          S.bossCompleted = true;
          S.score += 40 + (S.bossFlawlessRun ? 20 : 0);
          setCoach('boss-clear');
          emitFx('boss', { x: t.x, y: t.y });
          removeTarget(t, 'hit');
          updateHud();
          setTimeout(() => {
            if (!S.ended) endGame('boss-complete');
          }, 380);
          return;
        }

        S.targetGroup = currentBossGroup() || pick(GROUPS);
        showMinorBanner(`NEXT • ${S.targetGroup.icon} ${S.targetGroup.label}`);
        showPhaseObjectiveToast();
      }
    }

    if (S.fever >= 100 && !S.feverOn) {
      S.feverOn = true;
      S.feverTimer = 6;
      setCoach('fever');
      applyPhaseTheme();
      showSubPhaseToast('fever');
      emitFx('fever', { x: t.x, y: t.y });
    } else {
      emitFx('good', { x: t.x, y: t.y });
    }

    showPop(t.x, t.y, `+${add}`);
    removeTarget(t, 'hit');
  } else {
    S.wrong += 1;
    S.combo = 0;

    if (S.phase === 'boss') {
      markBossMistake();
    }

    if (S.shield > 0) {
      S.shield -= 1;
    } else {
      S.miss += 1;
      S.score = Math.max(0, S.score - S.diffPreset[S.phase].wrongPenalty);
    }

    setCoach('wrong', { target: S.targetGroup?.label });
    emitFx('wrong', { x: t.x, y: t.y });
    removeTarget(t, 'hit');
  }

  updateHud();
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
  const safe = getSafeRect();

  for (const t of Array.from(S.targets.values())) {
    t.x += t.vx * dt;
    t.y += t.vy * dt;

    const half = Math.max(20, t.size * 0.5);

    if (t.x <= safe.left + half) {
      t.x = safe.left + half;
      t.vx *= -1;
    } else if (t.x >= safe.right - half) {
      t.x = safe.right - half;
      t.vx *= -1;
    }

    if (t.el) {
      t.el.style.left = `${t.x}px`;
      t.el.style.top = `${t.y}px`;
    }

    if ((nowMs() - t.born) >= t.ttlMs || t.y >= safe.bottom - (half * 0.2)) {
      const wasTarget = !!t.good && Number(t.groupId) === Number(S.targetGroup?.id || 0);

      if (wasTarget) {
        if (S.phase === 'boss') {
          markBossMistake();
        }

        if (S.shield > 0) {
          S.shield -= 1;
        } else {
          S.miss += 1;
          S.combo = 0;
        }

        setCoach('miss', { target: S.targetGroup?.label });
        emitFx('miss', { x: t.x, y: t.y });
      }

      removeTarget(t, 'expire');
    }
  }

  const preset = S.diffPreset[S.phase];
  const cap = preset.cap;

  S.spawnAcc += preset.spawnPerSec * dt;

  while (S.spawnAcc >= 1) {
    S.spawnAcc -= 1;
    if (S.targets.size < cap) {
      createTarget();
    }
  }

  refreshAllTargetLockVisuals();
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

function renderPauseBossQueue() {
  const panel = DOC.getElementById('pauseBossPanel');
  const list = DOC.getElementById('pauseBossQueue');
  if (!panel || !list) return;

  if (S.phase !== 'boss' || !S.bossQueue.length) {
    panel.hidden = true;
    list.innerHTML = '';
    return;
  }

  panel.hidden = false;

  const total = Math.max(1, S.bossQueue.length);
  const stepIndex = Math.max(0, S.bossStep);
  const current = S.bossQueue[stepIndex] || null;

  setText('pauseBossNow', current ? `${current.icon} ${current.label}` : '—');
  setText('pauseBossStep', `${Math.min(total, stepIndex + 1)}/${total}`);
  setText('pauseBossNeed', `${Math.min(S.bossNeedPerStep, S.bossStepDone)}/${S.bossNeedPerStep}`);
  setText('pauseBossPerfect', S.bossPerfectSteps);
  setText('pauseBossFlawless', S.bossFlawlessRun ? 'YES' : 'NO');

  list.innerHTML = S.bossQueue.map((g, i) => {
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

  if (S.phase !== 'boss' || !S.bossQueue.length || S.ended) {
    wrap.hidden = true;
    list.innerHTML = '';
    return;
  }

  wrap.hidden = false;

  const total = Math.max(1, S.bossQueue.length);
  const stepIndex = Math.max(0, S.bossStep);
  const need = Math.max(1, S.bossNeedPerStep);
  const done = Math.min(need, S.bossStepDone);

  setText('liveBossStep', `${Math.min(total, stepIndex + 1)}/${total}`);
  setText('liveBossNeed', `${done}/${need}`);

  list.innerHTML = S.bossQueue.map((g, i) => {
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
  setText('pausePhaseText', `${friendlyPhaseLabel(S.phase)} • ${subPhaseLabel(S.subPhase)}`);
  setText('pausePhaseProg', DOC.getElementById('uiPhaseProg')?.textContent || '0/0');

  const fill = DOC.getElementById('uiGoalFill')?.style.width || '0%';
  const pauseFill = DOC.getElementById('pauseGoalFill');
  if (pauseFill) pauseFill.style.width = fill;

  for (let i = 1; i <= 5; i += 1) {
    setText(`pauseG${i}`, S.counts[i] || 0);
  }

  const sub = `phase=${friendlyPhaseLabel(S.phase)} • diff=${S.ctx?.diff || 'normal'} • view=${S.ctx?.view || 'mobile'} • score=${S.score}`;
  setText('pauseSub', sub);

  renderPauseBossQueue();
}

function friendlyTargetText(label) {
  const raw = String(label || '').trim();
  if (!raw) return 'เก็บหมู่เป้าหมาย';

  if (S.phase === 'boss') {
    const total = Math.max(1, S.bossQueue.length || 5);
    const step = Math.min(total, S.bossStep + 1);
    return `BOSS ${step}/${total} • เติม ${raw} ${Math.min(S.bossNeedPerStep, S.bossStepDone)}/${S.bossNeedPerStep}`;
  }

  return `เก็บ ${raw}`;
}

function updateHud() {
  setText('uiScore', S.score);
  setText('uiTime', Math.ceil(Math.max(0, S.totalTimeLeft)));
  setText('uiPlateHave', S.plateHave);
  setText('uiMiss', S.miss);

  setText('uiCombo', S.combo);
  setText('uiComboMax', S.comboMax);
  setText('uiAcc', `${accuracyPct()}%`);
  setText('uiGrade', gradeOf(accuracyPct()));
  setText('uiFever', `${Math.round(S.fever)}%`);
  setText('uiShield', S.shield);
  setText('uiModeTag', 'SOLO');
  setText('uiProTag', S.ctx?.pro ? 'ON' : 'OFF');

  setText(
    'uiTargetText',
    S.phase === 'boss'
      ? `LOCK ${S.targetGroup?.icon || '🎯'} ${friendlyTargetText(S.targetGroup?.label)}`
      : friendlyTargetText(S.targetGroup?.label)
  );

  setText('uiPhase', friendlyPhaseLabel(S.phase));

  const phaseTotal = Math.max(1, Number(S.phaseDurations[S.phaseIndex] || 1));
  const phaseDone = Math.round(((phaseTotal - S.phaseTimeLeft) / phaseTotal) * 100);

  if (S.phase === 'boss') {
    const totalSteps = Math.max(1, S.bossQueue.length || 5);
    setText('uiPhaseProg', `${Math.min(totalSteps, S.bossStep)}/${totalSteps}`);
    setWidth('uiGoalFill', Math.round((Math.min(totalSteps, S.bossStep) / totalSteps) * 100));
  } else {
    setText('uiPhaseProg', `${Math.max(0, phaseTotal - Math.ceil(S.phaseTimeLeft))}/${phaseTotal}`);
    setWidth('uiGoalFill', phaseDone);
  }

  setWidth('uiFeverFill', S.fever);

  for (let i = 1; i <= 5; i += 1) {
    setText(`uiG${i}`, S.counts[i] || 0);
  }

  syncPauseOverlay();
  renderLiveBossStrip();
}

function buildCooldownUrl() {
  try {
    const u = new URL('../warmup-gate.html', location.href);
    u.searchParams.set('phase', 'cooldown');
    u.searchParams.set('gatePhase', 'cooldown');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('theme', 'plate');
    u.searchParams.set('game', 'plate');
    u.searchParams.set('pid', String(S.ctx.pid || 'anon'));
    u.searchParams.set('hub', String(S.hub || '../hub-v2.html'));
    u.searchParams.set('next', String(S.hub || '../hub-v2.html'));
    return u.toString();
  } catch {
    return String(S.hub || '../hub-v2.html');
  }
}

function topGroupSummary() {
  let best = GROUPS[0];
  let bestCount = -1;

  for (const g of GROUPS) {
    const count = Number(S.counts[g.id] || 0);
    if (count > bestCount) {
      best = g;
      bestCount = count;
    }
  }

  return { group: best, count: Math.max(0, bestCount) };
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
    u.searchParams.set('hub', String(S.hub || '../hub-v2.html'));
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
  setText('endBadge', badgeToneOf(sum));
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
  setText('endRewardTitle', rewardTitleOf(sum));
  setText('endCoachTip', coachTipOfSummary(sum));

  setText('endG1', sum.counts?.[1] || 0);
  setText('endG2', sum.counts?.[2] || 0);
  setText('endG3', sum.counts?.[3] || 0);
  setText('endG4', sum.counts?.[4] || 0);
  setText('endG5', sum.counts?.[5] || 0);

  const miniBtn = DOC.getElementById('btnMiniAfterEnd');
  if (miniBtn) miniBtn.href = buildMiniGameUrl();
}

function buildSummary() {
  const acc = accuracyPct();
  return {
    game: 'plate',
    mode: 'solo',
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
    bossPerfectSteps: Number(S.bossPerfectSteps || 0),
    bossFlawlessRun: !!S.bossFlawlessRun,
    diff: S.ctx?.diff,
    pro: !!S.ctx?.pro,
    view: S.ctx?.view,
    seed: S.ctx?.seed,
    pid: S.ctx?.pid
  };
}

function saveSummary(sum) {
  try {
    localStorage.setItem(`HHA_LAST_SUMMARY:plate:${S.ctx?.pid || 'anon'}`, JSON.stringify(sum));
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({ ...sum, game: 'plate' }));
  } catch {}
}

function endGame(reason = 'time') {
  if (S.ended) return;

  S.ended = true;
  S.running = false;

  try { cancelAnimationFrame(S.raf); } catch {}
  clearTargets();

  const sum = buildSummary();
  sum.reason = reason;

  saveSummary(sum);

  setText('endTitle', 'เก่งมาก! จบเกมแล้ว 🎉');
  setText(
    'endSub',
    `mode=solo • diff=${S.ctx.diff} • view=${S.ctx.view} • phase=${friendlyPhaseLabel(S.phase)}${S.subPhase ? ` • ${subPhaseLabel(S.subPhase)}` : ''}`
  );

  renderHeroEndSummary(sum);

  const btnNextCooldown = DOC.getElementById('btnNextCooldown');
  if (S.cooldownEnabled) {
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

  setOverlayHidden('endOverlay', false);
}

function wirePauseButtons() {
  if (S.pauseWired) return;
  S.pauseWired = true;

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
        u.searchParams.set('seed', String(Date.now()));
      }
      location.href = u.toString();
    } catch {
      location.reload();
    }
  });

  DOC.getElementById('btnGuideFromPause')?.addEventListener('click', () => {
    const drawer = DOC.getElementById('plateDrawer');
    if (!drawer) return;

    const open = drawer.getAttribute('aria-hidden') === 'false';
    drawer.setAttribute('aria-hidden', open ? 'true' : 'false');
    drawer.style.display = open ? 'none' : 'block';
  });

  DOC.getElementById('btnHubFromPause')?.addEventListener('click', () => {
    location.href = String(S.hub || '../hub-v2.html');
  });
}

function wireEndButtons() {
  if (S.endWired) return;
  S.endWired = true;

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
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCoach('good');
    } catch {}
  });

  DOC.getElementById('btnReplay')?.addEventListener('click', () => {
    try {
      const u = new URL(location.href);
      if (S.ctx?.run !== 'research') {
        u.searchParams.set('seed', String(Date.now()));
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
    location.href = String(S.hub || '../hub-v2.html');
  });
}

function setPhase(index) {
  S.phaseIndex = clamp(index, 0, S.phaseList.length - 1);
  S.phase = S.phaseList[S.phaseIndex];
  S.phaseTimeLeft = Math.max(8, Number(S.phaseDurations[S.phaseIndex] || 30));
  S.spawnAcc = 0;

  if (S.phase === 'warm') {
    S.targetGroup = pick(GROUPS);
    setCoach('warm', { target: S.targetGroup.label });
    showPhaseBanner('WARM • เริ่มเก็บก่อน');
  } else if (S.phase === 'trick') {
    S.targetGroup = pick(GROUPS);
    setCoach('trick', { target: S.targetGroup.label });
    showPhaseBanner('TRICK • ระวังตัวหลอก');
  } else {
    resetBossGoalState();
    setCoach('boss', { target: S.targetGroup.label });
    showPhaseBanner('BOSS • เติมจานให้ครบ');
  }

  applyPhaseTheme();
  showPhaseObjectiveToast();
  updateHud();
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

  const prevSub = S.subPhase;
  updateFever(dt);
  applyPhaseTheme();

  if (prevSub !== S.subPhase) {
    showSubPhaseToast(S.subPhase);
  }

  updateTargets(dt);
  updateHud();

  if (S.phaseTimeLeft <= 0) {
    clearTargets();

    if (S.phaseIndex < S.phaseList.length - 1) {
      setPhase(S.phaseIndex + 1);
      primeStartTargets();
    } else {
      endGame('time');
      return;
    }
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
    time: clamp(Number(ctx.time || 90), 30, 300),
    pro: !!ctx.pro
  };

  S.mount = ctx.mount;
  S.ai = ctx.ai || null;
  S.hub = String(ctx.hub || '../hub-v2.html');
  S.cooldownEnabled = !!ctx.cooldown;
  S.diffPreset = getDifficultyPreset(S.ctx.diff, S.ctx.pro);
  S.rng = makeRng(S.ctx.seed);

  S.running = true;
  S.paused = false;
  S.ended = false;
  S.phaseIndex = 0;
  S.phase = 'warm';

  S.score = 0;
  S.combo = 0;
  S.comboMax = 0;
  S.hits = 0;
  S.wrong = 0;
  S.miss = 0;
  S.shots = 0;

  S.fever = 0;
  S.feverOn = false;
  S.feverTimer = 0;
  S.shield = 0;

  resetCounts();
  S.plateHave = 0;

  const total = Math.max(30, Number(S.ctx.time || 90));
  const warm = Math.max(12, Math.round(total * 0.34));
  const trick = Math.max(10, Math.round(total * 0.33));
  const boss = Math.max(8, total - warm - trick);
  S.phaseDurations = [warm, trick, boss];
  S.totalTimeLeft = total;
  S.targets.clear();
  S.nextId = 1;
  S.spawnAcc = 0;

  S.toastKey = '';
  S.toastAt = 0;

  wirePauseButtons();
  wireEndButtons();

  setOverlayHidden('pauseOverlay', true);
  setOverlayHidden('endOverlay', true);
  setObjectiveToastHidden(true);

  const drawer = DOC.getElementById('plateDrawer');
  if (drawer) {
    drawer.setAttribute('aria-hidden', 'true');
    drawer.style.display = 'none';
  }

  WIN.__PLATE_SET_PAUSED__ = function (on) {
    S.paused = !!on;
    if (!S.paused) {
      S.lastTick = performance.now();
      setOverlayHidden('pauseOverlay', true);
    } else if (!S.ended) {
      syncPauseOverlay();
      setObjectiveToastHidden(true);
    }
  };

  applyPhaseTheme();
  setPhase(0);
  updateHud();
  primeStartTargets();

  setText('uiModeTag', 'SOLO');
  setText('uiProTag', S.ctx.pro ? 'ON' : 'OFF');

  const miniBtn = DOC.getElementById('btnMiniAfterEnd');
  if (miniBtn) miniBtn.href = buildMiniGameUrl();

  S.lastTick = performance.now();
  S.raf = requestAnimationFrame(loop);
}

WIN.PlateSolo = WIN.PlateSolo || {};
WIN.PlateSolo.boot = boot;

export { boot };