// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (Groups Concept)
// Emoji target + Fever + GroupsQuestManager + Cloud Logger

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// ---------- Helpers ----------

const GROUPS = {
  1: ['🍚', '🍙', '🍞', '🥯', '🥐'],
  2: ['🥩', '🍗', '🍖', '🥚', '🧀', '🐟', '🫘'],
  3: ['🥦', '🥕', '🥬', '🌽', '🥗', '🍅'],
  4: ['🍎', '🍌', '🍇', '🍉', '🍊', '🍓', '🍍'],
  5: ['🥛', '🧈', '🧀', '🍨', '🍦']
};

const GOOD_EMOJIS = Object.values(GROUPS).flat();
const JUNK_EMOJIS = ['🍔','🍟','🍕','🍩','🍪','🧋','🥤','🍫','🍬','🥓'];

function foodGroup(emo) {
  for (const [g, arr] of Object.entries(GROUPS)) {
    if (arr.includes(emo)) return Number(g);
  }
  return 0;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// แปลง world → screen (ใช้ AFRAME แบบ safe)
function worldToScreen(el) {
  try {
    const A = ROOT.AFRAME;
    const sceneEl = document.querySelector('a-scene');
    if (!A || !sceneEl || !sceneEl.object3D) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    const camera = sceneEl.camera;
    const renderer = sceneEl.renderer;
    if (!camera || !renderer) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    const THREE = A.THREE;
    const vec = new THREE.Vector3();
    el.object3D.getWorldPosition(vec);
    vec.project(camera);

    const x = (vec.x * 0.5 + 0.5) * renderer.domElement.width;
    const y = (-vec.y * 0.5 + 0.5) * renderer.domElement.height;
    return { x, y };
  } catch {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
}

// ---------- Global modules ----------

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { burstAt() {}, scorePop() {} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  {
    ensureFeverBar() {},
    setFever() {},
    setFeverActive() {}
  };

const { ensureFeverBar, setFever, setFeverActive } = FeverUI;

// difficulty.foodgroups.js
function pickDifficulty(diffKey) {
  const HH = ROOT.HeroHealth || {};
  if (HH.foodGroupsDifficulty && typeof HH.foodGroupsDifficulty.get === 'function') {
    return HH.foodGroupsDifficulty.get(diffKey);
  }
  const table = {
    easy:   { spawnInterval: 1300, lifetime: 2800, maxActive: 3, scale: 1.25, feverGainHit: 8, feverLossMiss: 12 },
    normal: { spawnInterval: 1000, lifetime: 2200, maxActive: 4, scale: 1.0,  feverGainHit: 7, feverLossMiss: 16 },
    hard:   { spawnInterval:  800, lifetime: 1900, maxActive: 5, scale: 0.9,  feverGainHit: 6, feverLossMiss: 22 }
  };
  const key = String(diffKey || 'normal').toLowerCase();
  return table[key] || table.normal;
}

// Quest manager จาก quest-manager.js
const QuestManagerCtor =
  ROOT.GAME_MODULES && ROOT.GAME_MODULES.GroupsQuestManager
    ? ROOT.GAME_MODULES.GroupsQuestManager
    : null;

// ---------- Engine State ----------

const FEVER_MAX = 100;
const GOOD_RATE = 0.75;

const state = {
  running: false,
  diffKey: 'normal',
  cfg: null,

  sceneEl: null,
  spawnTimer: null,
  timeListener: null,

  targets: new Set(),

  score: 0,
  combo: 0,
  comboMax: 0,
  misses: 0,
  fever: 0,
  feverActive: false,

  questMgr: null,
  allQuestsFinished: false,

  ended: false
};

// ---------- Fever / HUD ----------

function emitScoreAndJudge(judgmentLabel) {
  try {
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: { score: state.score, combo: state.combo, misses: state.misses }
    }));
    if (judgmentLabel) {
      window.dispatchEvent(new CustomEvent('hha:judge', { detail: { label: judgmentLabel } }));
    }
  } catch {}
}

function emitMiss() {
  try {
    window.dispatchEvent(new CustomEvent('hha:miss', { detail: {} }));
  } catch {}
}

function emitFeverEvent(kind) {
  try {
    window.dispatchEvent(new CustomEvent('hha:fever', { detail: { state: kind } }));
  } catch {}
}

function updateFever(delta) {
  const prev = state.fever;
  state.fever = clamp(prev + delta, 0, FEVER_MAX);
  setFever(state.fever);

  if (!state.feverActive && state.fever >= FEVER_MAX) {
    state.feverActive = true;
    setFeverActive(true);
    emitFeverEvent('start');
  } else if (state.feverActive && state.fever <= 0) {
    state.feverActive = false;
    setFeverActive(false);
    emitFeverEvent('end');
  }
}

function multiplier() {
  return state.feverActive ? 2 : 1;
}

// ---------- Quest + Stat ----------

function ensureQuestManager() {
  if (!QuestManagerCtor) {
    state.questMgr = null;
    return;
  }
  const qm = new QuestManagerCtor();
  qm.start(state.diffKey, { quest: { goalsPick: 2, minisPick: 3 } });
  state.questMgr = qm;
  state.allQuestsFinished = false;
}

function getQuestSummary() {
  if (!state.questMgr || typeof state.questMgr.getSummary !== 'function') {
    return {
      cleared: 0, total: 0,
      clearedGoals: 0, clearedMinis: 0,
      totalGoals: 0, totalMinis: 0
    };
  }
  return state.questMgr.getSummary() || {
    cleared: 0, total: 0,
    clearedGoals: 0, clearedMinis: 0,
    totalGoals: 0, totalMinis: 0
  };
}

function emitStat(extra = {}) {
  const sum = getQuestSummary();
  try {
    window.dispatchEvent(new CustomEvent('hha:stat', {
      detail: {
        mode: 'Food Groups',
        difficulty: state.diffKey,
        score: state.score,
        combo: state.combo,
        misses: state.misses,
        fever: state.fever,
        feverActive: state.feverActive,
        goalsCleared: sum.clearedGoals,
        goalsTotal: sum.totalGoals,
        miniCleared: sum.clearedMinis,
        miniTotal: sum.totalMinis,
        ...extra
      }
    }));
  } catch {}
}

function maybeCheckAllQuestsDone() {
  if (!state.questMgr || state.allQuestsFinished) return;
  const sum = getQuestSummary();
  if (sum.total > 0 && sum.cleared >= sum.total) {
    state.allQuestsFinished = true;
    try {
      window.dispatchEvent(new CustomEvent('quest:all-complete', {
        detail: { goalsTotal: sum.totalGoals, minisTotal: sum.totalMinis }
      }));
    } catch {}
  }
}

// ---------- Target Management ----------

function createTarget() {
  if (!state.sceneEl || !state.cfg) return;
  if (state.targets.size >= state.cfg.maxActive) return;

  const isGood = Math.random() < GOOD_RATE;
  const emoji = isGood ? pick(GOOD_EMOJIS) : pick(JUNK_EMOJIS);
  const gId = isGood ? foodGroup(emoji) : 0;

  const el = document.createElement('a-entity');

  const scale = state.cfg.scale || 1.0;
  const radius = 0.32 * scale;

  el.setAttribute('geometry', `primitive: circle; radius: ${radius}`);
  el.setAttribute(
    'material',
    'shader: flat; color: #020617; opacity: 0.82; transparent: true; side: double'
  );
  el.setAttribute('text', `value: ${emoji}; align: center; color: #ffffff; width: 2.2; zOffset: 0.01`);
  el.setAttribute('data-hha-tgt', '1');

  const x = (Math.random() * 4.0) - 2.0;
  const y = 1.1 + Math.random() * 1.4;
  const z = -4.0 - Math.random() * 1.5;
  el.setAttribute('position', `${x} ${y} ${z}`);

  el.setAttribute('animation__pop',
    'property: scale; from: 0.01 0.01 0.01; to: 1 1 1; dur: 160; easing: easeOutBack');

  const targetObj = {
    el,
    emoji,
    isGood,
    groupId: gId,
    hit: false,
    timeoutId: null,
    _onClick: null
  };

  const onClick = (evt) => handleHit(targetObj, evt);
  targetObj._onClick = onClick;
  el.addEventListener('click', onClick);

  const timeoutId = setTimeout(() => removeTarget(targetObj), state.cfg.lifetime);
  targetObj.timeoutId = timeoutId;

  state.targets.add(targetObj);
  state.sceneEl.appendChild(el);
}

function removeTarget(targetObj) {
  if (!targetObj || !state.targets.has(targetObj)) return;
  const { el, timeoutId, _onClick } = targetObj;

  if (timeoutId) clearTimeout(timeoutId);

  if (el && el.parentNode) {
    try { el.removeEventListener('click', _onClick); } catch {}
    el.parentNode.removeChild(el);
  }

  state.targets.delete(targetObj);
}

// ---------- Judge Logic ----------

function handleHit(targetObj) {
  if (!state.running || !targetObj || targetObj.hit) return;

  targetObj.hit = true;
  removeTarget(targetObj);

  const isGood = !!targetObj.isGood;
  const emoji = targetObj.emoji;
  const groupId = targetObj.groupId || 0;

  const pos2d = worldToScreen(targetObj.el);

  if (state.questMgr && typeof state.questMgr.onHit === 'function') {
    state.questMgr.onHit({ emoji, isGood, groupId });
  }

  let judgment = '';
  let deltaScore = 0;

  if (isGood) {
    state.combo += 1;
    state.comboMax = Math.max(state.comboMax, state.combo);
    const base = 18;
    deltaScore = Math.round((base + state.combo * 2) * multiplier());
    state.score += deltaScore;

    updateFever(state.cfg.feverGainHit || 7);

    if (state.combo >= 12)      judgment = 'PERFECT';
    else if (state.combo >= 6)  judgment = 'GREAT';
    else                        judgment = 'GOOD';

    try {
      Particles.scorePop(pos2d.x, pos2d.y, `+${deltaScore}`, { good: true, judgment });
      Particles.burstAt(pos2d.x, pos2d.y, { good: true, color: '#22c55e' });
    } catch {}

    emitScoreAndJudge(judgment);
    emitStat({ lastHitGood: true, lastGroup: groupId });
  } else {
    state.misses += 1;
    state.combo = 0;

    const baseMinus = 14;
    deltaScore = -baseMinus;
    state.score = Math.max(0, state.score + deltaScore);

    updateFever(-(state.cfg.feverLossMiss || 16));
    judgment = 'MISS';

    try {
      Particles.scorePop(pos2d.x, pos2d.y, String(deltaScore), { good: false, judgment });
      Particles.burstAt(pos2d.x, pos2d.y, { good: false, color: '#f97316' });
    } catch {}

    emitMiss();
    emitScoreAndJudge(judgment);
    emitStat({ lastHitGood: false });
  }

  maybeCheckAllQuestsDone();
}

// ---------- Time tick ----------

function onTimeTick(e) {
  if (!state.running) return;
  const sec = e && e.detail && typeof e.detail.sec === 'number'
    ? (e.detail.sec | 0)
    : 0;

  if (sec <= 0) return;

  if (state.combo <= 0 && state.fever > 0) {
    updateFever(-2);
    emitStat();
  }
}

// ---------- Start / Stop ----------

async function startEngine(diffKey = 'normal') {
  const sceneEl = document.querySelector('a-scene');
  if (!sceneEl) {
    console.error('[GroupsVR] <a-scene> not found');
    return;
  }

  // ให้แน่ใจว่า scene โหลดแล้ว
  if (!sceneEl.hasLoaded) {
    await new Promise(resolve => {
      sceneEl.addEventListener('loaded', resolve, { once: true });
    });
  }

  if (state.running) {
    GameEngine.stop('restart');
  }

  state.running = true;
  state.ended = false;
  state.diffKey = String(diffKey || 'normal').toLowerCase();
  state.cfg = pickDifficulty(state.diffKey);
  state.sceneEl = sceneEl;

  state.targets.forEach(t => removeTarget(t));
  state.targets.clear();

  state.score = 0;
  state.combo = 0;
  state.comboMax = 0;
  state.misses = 0;
  state.fever = 0;
  state.feverActive = false;
  state.allQuestsFinished = false;

  ensureFeverBar();
  setFever(0);
  setFeverActive(false);

  ensureQuestManager();
  emitStat();

  state.timeListener = onTimeTick;
  window.addEventListener('hha:time', state.timeListener);

  state.spawnTimer = setInterval(() => {
    if (!state.running) return;
    createTarget();
  }, state.cfg.spawnInterval || 1000);

  createTarget();
}

function stopEngine(reason = 'manual') {
  if (!state.running && state.ended) return;

  state.running = false;

  if (state.spawnTimer) {
    clearInterval(state.spawnTimer);
    state.spawnTimer = null;
  }

  if (state.timeListener) {
    window.removeEventListener('hha:time', state.timeListener);
    state.timeListener = null;
  }

  state.targets.forEach(t => removeTarget(t));
  state.targets.clear();

  if (!state.ended) {
    state.ended = true;
    const sum = getQuestSummary();
    try {
      window.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          mode: 'Food Groups',
          difficulty: state.diffKey,
          reason,
          scoreFinal: state.score,
          comboMax: state.comboMax,
          misses: state.misses,
          goalsCleared: sum.clearedGoals,
          goalsTotal: sum.totalGoals,
          miniCleared: sum.clearedMinis,
          miniTotal: sum.totalMinis
        }
      }));
    } catch {}
  }
}

// ---------- Export ----------

export const GameEngine = {
  start: startEngine,
  stop: stopEngine
};

export default GameEngine;
