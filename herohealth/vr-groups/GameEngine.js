// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (Hydration-style targets + Score FX + Diff size)

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// --------------------------------------------------
//  Helper: อ่าน config จาก HHA_DIFF_TABLE (modeKey = 'groups')
// --------------------------------------------------
function pickEngineConfig(modeKey, diffKey) {
  const safe = {
    SPAWN_INTERVAL: 900,
    ITEM_LIFETIME: 2200,
    MAX_ACTIVE: 4,
    SIZE_FACTOR: 1.0
  };

  try {
    const table = ROOT.HHA_DIFF_TABLE;
    if (!table) return safe;

    const mode = table[modeKey];
    if (!mode) return safe;

    const diff = mode[diffKey];
    if (!diff || !diff.engine) return safe;

    const eng = diff.engine;
    return {
      SPAWN_INTERVAL: Number(eng.SPAWN_INTERVAL) || safe.SPAWN_INTERVAL,
      ITEM_LIFETIME: Number(eng.ITEM_LIFETIME) || safe.ITEM_LIFETIME,
      MAX_ACTIVE: Number(eng.MAX_ACTIVE) || safe.MAX_ACTIVE,
      SIZE_FACTOR: Number(eng.SIZE_FACTOR) || safe.SIZE_FACTOR
    };
  } catch (err) {
    console.warn('[GroupsVR] pickEngineConfig error:', err);
    return safe;
  }
}

// --------------------------------------------------
//  หา root สำหรับวางเป้า — ผูกกับ scene (ไม่ติดกล้อง)
// --------------------------------------------------
function ensureVrRoot() {
  const scene = document.querySelector('a-scene');
  if (!scene) {
    console.warn('[GroupsVR] No <a-scene> found');
    return null;
  }

  let root = scene.querySelector('.hha-vr-root');
  if (!root) {
    root = document.createElement('a-entity');
    root.classList.add('hha-vr-root');
    root.setAttribute('position', '0 1.6 -1.6'); // ด้านหน้า player
    scene.appendChild(root);
  }
  return root;
}

// --------------------------------------------------
//  FX: world position + คะแนนเด้ง / MISS / LATE / GOOD / PERFECT
// --------------------------------------------------
function getWorldPosition(el) {
  try {
    if (!el || !el.object3D) return null;
    const THREE =
      (ROOT.AFRAME && ROOT.AFRAME.THREE) ||
      ROOT.THREE ||
      (typeof window !== 'undefined' ? window.THREE : null);
    if (!THREE || !THREE.Vector3) return null;
    const v = new THREE.Vector3();
    el.object3D.getWorldPosition(v);
    return v;
  } catch (err) {
    console.warn('[GroupsVR] getWorldPosition error:', err);
    return null;
  }
}

function spawnScoreFx(el, text, color) {
  const scene = document.querySelector('a-scene');
  if (!scene || !text) return;

  const pos = getWorldPosition(el);
  const x = pos ? pos.x : 0;
  const y = pos ? pos.y + 0.4 : 1.8;
  const z = pos ? pos.z : -1.6;

  const fx = document.createElement('a-entity');
  fx.setAttribute('position', `${x} ${y} ${z}`);

  const txt = document.createElement('a-text');
  txt.setAttribute('value', text);
  txt.setAttribute('align', 'center');
  txt.setAttribute('color', color || '#fbbf24');
  txt.setAttribute('side', 'double');
  txt.setAttribute('width', 2.5);
  fx.appendChild(txt);

  scene.appendChild(fx);

  // ลอยขึ้น + จางหาย
  let t = 0;
  const dur = 600;
  const step = 16;
  const startY = y;

  const timer = setInterval(() => {
    t += step;
    const p = t / dur;
    if (p >= 1) {
      clearInterval(timer);
      try {
        scene.removeChild(fx);
      } catch (_) {}
      return;
    }
    const ny = startY + 0.3 * p;
    fx.setAttribute('position', `${x} ${ny} ${z}`);
    try {
      txt.setAttribute('opacity', String(1 - p));
    } catch (_) {}
  }, step);
}

// --------------------------------------------------
//  วาด emoji ลง canvas → dataURL
// --------------------------------------------------
function makeEmojiTexture(ch, sizePx = 256) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, sizePx, sizePx);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${sizePx * 0.72}px system-ui, "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ch, sizePx / 2, sizePx / 2);

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[GroupsVR] makeEmojiTexture error:', err);
    return null;
  }
}

// --------------------------------------------------
//  สร้างเป้า VR — ให้ทุกชั้นเป็น target + ส่ง el ออกไปให้ทำ FX
// --------------------------------------------------
function createVrTarget(root, targetCfg, handlers = {}) {
  const {
    ch,
    lifeMs,
    sizeFactor = 1.0
  } = targetCfg;

  const { onHit, onExpire } = handlers;
  if (!root || !ch) return null;

  // entity หลัก
  const holder = document.createElement('a-entity');
  holder.classList.add('hha-target-vr');
  holder.setAttribute('data-hha-tgt', '1');

  // ===== พื้นหลัง + hit area =====
  // ★ เป้าใหญ่ขึ้นทุกระดับ: base ~0.5
  const baseSize = 0.5 * sizeFactor;

  const bg = document.createElement('a-plane');
  bg.setAttribute('width', baseSize);
  bg.setAttribute('height', baseSize);
  bg.setAttribute(
    'material',
    [
      'color: #020617',
      'transparent: true',
      'opacity: 0.28',
      'side: double'
    ].join('; ')
  );
  bg.setAttribute('data-hha-tgt', '1');
  holder.appendChild(bg);

  // ===== emoji texture =====
  const texUrl = makeEmojiTexture(ch, 256);
  let img = null;
  if (texUrl) {
    img = document.createElement('a-image');
    img.setAttribute('src', texUrl);
    img.setAttribute('width', baseSize * 0.92);
    img.setAttribute('height', baseSize * 0.92);
    img.setAttribute('position', '0 0 0.01');
    img.setAttribute(
      'material',
      [
        'transparent: true',
        'alphaTest: 0.01',
        'side: double'
      ].join('; ')
    );
    img.setAttribute('data-hha-tgt', '1');
    holder.appendChild(img);
  }

  // ===== ตำแหน่งใน world =====
  const x = -0.8 + Math.random() * 1.6;
  const y = 1.2 + Math.random() * 0.8;
  const z = -1.6 + (Math.random() * 0.6 - 0.3);

  holder.setAttribute('position', `${x} ${y} ${z}`);

  root.appendChild(holder);

  let killed = false;

  const cleanup = (reason) => {
    if (killed) return;
    killed = true;
    try {
      if (holder.parentNode) holder.parentNode.removeChild(holder);
    } catch (_) {}

    if (reason === 'expire' && typeof onExpire === 'function') {
      try {
        onExpire({ ch, el: holder });
      } catch (err) {
        console.warn('[GroupsVR] onExpire error:', err);
      }
    }
  };

  const ttl = Number(lifeMs) > 0 ? Number(lifeMs) : 2200;
  const timeoutId = setTimeout(() => {
    cleanup('expire');
  }, ttl);

  const handleHit = (evt) => {
    if (evt && evt.stopPropagation) evt.stopPropagation();
    if (killed) return;

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const ctx = { clientX: cx, clientY: cy, cx, cy };

    if (typeof onHit === 'function') {
      try {
        onHit({ ch, ctx, kill: () => cleanup('hit'), el: holder });
      } catch (err) {
        console.warn('[GroupsVR] onHit error:', err);
      }
    } else {
      cleanup('hit');
    }
  };

  holder.addEventListener('click', handleHit);
  bg.addEventListener('click', handleHit);
  if (img) img.addEventListener('click', handleHit);

  return {
    el: holder,
    ch,
    kill: () => {
      clearTimeout(timeoutId);
      cleanup('manual');
    }
  };
}

// --------------------------------------------------
//  Emoji 5 หมู่
// --------------------------------------------------
const GROUP_EMOJI = [
  // หมู่ 1
  '🍚', '🍙', '🍞', '🥐', '🥖', '🥨', '🥯',
  // หมู่ 2
  '🍗', '🍖', '🍤', '🍣', '🥩', '🥚', '🧀',
  // หมู่ 3
  '🥦', '🥕', '🥬', '🍅', '🌽', '🧅', '🫑',
  // หมู่ 4
  '🍎', '🍌', '🍇', '🍓', '🍍', '🍊', '🍉',
  // หมู่ 5
  '🥛', '🧈', '🍨', '🍦', '🧋', '🍮', '🧊'
];

// --------------------------------------------------
//  State
// --------------------------------------------------
const state = {
  root: null,
  running: false,
  ended: false,
  diffKey: 'normal',
  config: {
    SPAWN_INTERVAL: 900,
    ITEM_LIFETIME: 2200,
    MAX_ACTIVE: 4,
    SIZE_FACTOR: 1.0
  },
  spawnTimer: null,
  targets: [],
  spawnCount: 0,

  score: 0,
  combo: 0,
  maxCombo: 0,
  misses: 0,

  goalTotalHits: 25,
  goalHits: 0,

  miniStreakTarget: 6,
  miniCurrentStreak: 0,
  miniBestStreak: 0
};

function emit(name, detail) {
  try {
    ROOT.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (err) {
    console.warn('[GroupsVR] emit error:', name, err);
  }
}

function updateScoreHUD() {
  emit('hha:score', {
    score: state.score,
    combo: state.combo,
    misses: state.misses
  });
}

function updateQuestHUD() {
  const goalsAll = [
    {
      key: 'main-total-hits',
      done: state.goalHits >= state.goalTotalHits
    }
  ];
  const minisAll = [
    {
      key: 'mini-streak',
      done: state.miniBestStreak >= state.miniStreakTarget
    }
  ];

  emit('quest:update', {
    goal: {
      label: `เก็บอาหารให้ครบ ${state.goalTotalHits} ชิ้น`,
      prog: state.goalHits,
      target: state.goalTotalHits
    },
    mini: {
      label: `ตีติดกันไม่พลาด ${state.miniStreakTarget} ชิ้น`,
      prog: state.miniBestStreak,
      target: state.miniStreakTarget
    },
    goalsAll,
    minisAll,
    hint: 'ลองเก็บให้ครบทั้ง 5 หมู่ — ข้าว แป้ง, โปรตีน, ผัก, ผลไม้, นม 🥗🍛'
  });
}

function registerHit(el) {
  state.combo += 1;
  state.score += 100;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;

  state.goalHits += 1;
  state.miniCurrentStreak += 1;
  if (state.miniCurrentStreak > state.miniBestStreak) {
    state.miniBestStreak = state.miniCurrentStreak;
  }

  const judgeLabel =
    state.combo >= 8 ? 'PERFECT' :
    state.combo >= 3 ? 'GOOD' :
    'OK';

  emit('hha:judge', { label: judgeLabel });
  updateScoreHUD();
  updateQuestHUD();

  spawnScoreFx(el, `+100 ${judgeLabel}`, '#22c55e');
}

function registerMiss(el, reason) {
  state.misses += 1;
  state.combo = 0;
  state.miniCurrentStreak = 0;

  const label = reason === 'late' ? 'LATE' : 'MISS';
  emit('hha:miss', {});
  emit('hha:judge', { label });
  updateScoreHUD();

  if (el) {
    spawnScoreFx(el, label, '#f97316');
  }
}

function clearAllTargets() {
  state.targets.forEach(t => {
    try {
      t.kill && t.kill();
    } catch (_) {}
  });
  state.targets = [];
}

function pickEmoji() {
  if (!GROUP_EMOJI.length) return '❓';
  const idx = Math.floor(Math.random() * GROUP_EMOJI.length);
  return GROUP_EMOJI[idx];
}

function spawnOne() {
  if (!state.running) return;
  if (!state.root) return;
  if (state.targets.length >= state.config.MAX_ACTIVE) return;

  const ch = pickEmoji();
  state.spawnCount += 1;

  const target = createVrTarget(state.root, {
    ch,
    lifeMs: state.config.ITEM_LIFETIME,
    sizeFactor: state.config.SIZE_FACTOR
  }, {
    onHit: ({ kill, el }) => {
      state.targets = state.targets.filter(t => t !== target);
      registerHit(el);
      if (typeof kill === 'function') kill();
    },
    onExpire: ({ el }) => {
      state.targets = state.targets.filter(t => t !== target);
      registerMiss(el, 'late');
    }
  });

  if (target) {
    state.targets.push(target);
  }
}

// --------------------------------------------------
//  GameEngine.start / stop
// --------------------------------------------------
function start(diffKey) {
  if (state.running) {
    stop('restart');
  }

  const root = ensureVrRoot();
  if (!root) {
    console.error('[GroupsVR] Cannot start — no VR root');
    return;
  }

  state.root = root;
  state.diffKey = String(diffKey || 'normal').toLowerCase();
  state.config = pickEngineConfig('groups', state.diffKey);

  // ★ ปรับขนาดตามระดับ easy / normal / hard — ใหญ่ขึ้นทุกระดับ
  let diffSize = 1.0;                // normal
  if (state.diffKey === 'easy') diffSize = 1.15;   // easy ใหญ่สุด
  else if (state.diffKey === 'hard') diffSize = 0.9; // hard ยังเล็กกว่าแต่ใหญ่กว่ารอบก่อน
  state.config.SIZE_FACTOR =
    (state.config.SIZE_FACTOR || 1.0) * diffSize;

  state.running = true;
  state.ended = false;
  state.spawnCount = 0;

  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.misses = 0;
  state.goalHits = 0;
  state.miniCurrentStreak = 0;
  state.miniBestStreak = 0;

  clearAllTargets();
  updateScoreHUD();
  updateQuestHUD();
  emit('hha:judge', { label: '' });
  emit('hha:coach', {
    text: 'ลากนิ้ว/เมาส์หมุนมุมมอง แล้วคลิกอาหารให้ตรงหมู่ ดูให้ครบ 5 หมู่เลยนะ 🍚🥩🥦🍎🥛'
  });

  const interval = Math.max(300, state.config.SPAWN_INTERVAL || 900);
  state.spawnTimer = setInterval(spawnOne, interval);
  setTimeout(spawnOne, 400);

  console.log('[GroupsVR] GameEngine.start()', state.diffKey, state.config);
}

function stop(reason = 'manual') {
  if (!state.running && state.ended) return;

  state.running = false;

  if (state.spawnTimer) {
    clearInterval(state.spawnTimer);
    state.spawnTimer = null;
  }

  clearAllTargets();

  if (!state.ended) {
    state.ended = true;

    const miniCleared = state.miniBestStreak >= state.miniStreakTarget ? 1 : 0;

    emit('hha:end', {
      reason,
      scoreFinal: state.score,
      score: state.score,
      comboMax: state.maxCombo,
      misses: state.misses,
      goalsCleared: state.goalHits,
      goalsTotal: state.goalTotalHits,
      miniCleared,
      miniTotal: 1
    });
  }

  emit('hha:fever', { state: 'end' });
  console.log('[GroupsVR] GameEngine.stop()', reason);
}

export const GameEngine = {
  start,
  stop
};