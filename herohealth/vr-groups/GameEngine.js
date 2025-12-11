// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Emoji Canvas Targets + Quest + Fever + HUD Events
// ใช้กับ groups-vr.html → import { GameEngine } from './vr-groups/GameEngine.js'

'use strict';

const A = window.AFRAME || null;
const THREE = A && A.THREE ? A.THREE : null;

const FEVER_MAX = 100;

// ---------- Helper ----------
function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// world → screen (สำหรับ FX 2D กลางจอ)
function worldToScreen(worldVec, sceneEl) {
  if (!A || !THREE || !sceneEl || !sceneEl.renderer || !sceneEl.camera) return null;

  const renderer = sceneEl.renderer;
  const camera = sceneEl.camera;

  const v = worldVec.clone();
  v.project(camera);

  const width = renderer.domElement.clientWidth || window.innerWidth;
  const height = renderer.domElement.clientHeight || window.innerHeight;

  const x = (v.x * 0.5 + 0.5) * width;
  const y = (-v.y * 0.5 + 0.5) * height;
  return { x, y };
}

// ---------- Difficulty ----------
const DIFF_TABLE = {
  easy:   { spawnInterval: 1400, lifeTime: 1700, maxActive: 4, scale: 1.05 },
  normal: { spawnInterval: 1100, lifeTime: 1500, maxActive: 5, scale: 1.0  },
  hard:   { spawnInterval: 900,  lifeTime: 1400, maxActive: 6, scale: 0.95 }
};

function pickDifficulty(diffKey) {
  const key = String(diffKey || 'normal').toLowerCase();
  return DIFF_TABLE[key] || DIFF_TABLE.normal;
}

// ---------- Food data ----------
// group: rice / veg / fruit / protein / dairy / junk
const FOODS = [
  { emoji: '🍚', group: 'rice',    good: true },
  { emoji: '🍞', group: 'rice',    good: true },
  { emoji: '🥐', group: 'rice',    good: true },

  { emoji: '🥦', group: 'veg',     good: true },
  { emoji: '🥕', group: 'veg',     good: true },
  { emoji: '🥒', group: 'veg',     good: true },

  { emoji: '🍎', group: 'fruit',   good: true },
  { emoji: '🍌', group: 'fruit',   good: true },
  { emoji: '🍇', group: 'fruit',   good: true },

  { emoji: '🍗', group: 'protein', good: true },
  { emoji: '🥚', group: 'protein', good: true },
  { emoji: '🥩', group: 'protein', good: true },

  { emoji: '🥛', group: 'dairy',   good: true },
  { emoji: '🧀', group: 'dairy',   good: true },
  { emoji: '🍦', group: 'dairy',   good: true },

  // junk = กดแล้วถือว่า miss
  { emoji: '🍟', group: 'junk',    good: false },
  { emoji: '🍕', group: 'junk',    good: false },
  { emoji: '🧋', group: 'junk',    good: false },
  { emoji: '🍩', group: 'junk',    good: false }
];

function pickFood() {
  const i = Math.floor(Math.random() * FOODS.length);
  return FOODS[i];
}

// ---------- Emoji Canvas Atlas ----------
const EmojiCanvas = {
  map: new Map(), // key = emoji|group  →  id (เช่น fgEmoji_0)
  assetsEl: null,

  ensureAssets(sceneEl) {
    if (this.assetsEl && this.assetsEl.isConnected) return this.assetsEl;

    let assets = sceneEl.querySelector('a-assets');
    if (!assets) {
      assets = document.createElement('a-assets');
      sceneEl.appendChild(assets);
    }
    this.assetsEl = assets;
    return assets;
  },

  groupColor(group) {
    switch (group) {
      case 'rice':    return '#22c55e';
      case 'veg':     return '#16a34a';
      case 'fruit':   return '#f97316';
      case 'protein': return '#0ea5e9';
      case 'dairy':   return '#a855f7';
      default:        return '#6b7280';
    }
  },

  getId(sceneEl, food) {
    const key = `${food.emoji}|${food.group}`;
    if (this.map.has(key)) return this.map.get(key);

    const assets = this.ensureAssets(sceneEl);
    const id = 'fgEmoji_' + this.map.size;

    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.width = 256;
    canvas.height = 256;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    // พื้นหลังวงกลมสีตามหมู่
    const bg = this.groupColor(food.group);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.fill();

    // emoji ตรงกลาง
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font =
      '200px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(food.emoji, 128, 138); // ขยับลงนิดนึงให้พอดี

    assets.appendChild(canvas);
    this.map.set(key, id);
    return id;
  }
};

// ---------- Quest config ----------
const QUEST_CONFIG = {
  goals: [
    {
      id: 'all-groups',
      label: 'เลือกอาหารจากครบทั้ง 5 หมู่ให้ได้อย่างน้อย 1 ครั้ง',
      target: 5
    },
    {
      id: 'good-20',
      label: 'เก็บอาหารดีให้ได้อย่างน้อย 20 ชิ้น',
      target: 20
    }
  ],
  minis: [
    {
      id: 'rice-5',
      label: 'หมู่ ข้าว-แป้ง ให้ครบ 5 ชิ้น',
      target: 5
    },
    {
      id: 'vegfruit-5',
      label: 'หมู่ ผัก-ผลไม้ ให้ครบ 5 ชิ้น',
      target: 5
    },
    {
      id: 'proteinmilk-5',
      label: 'หมู่ เนื้อ/นม ให้ครบ 5 ชิ้น',
      target: 5
    }
  ]
};

// ---------- Game state ----------
const STATE = {
  scene: null,
  diffKey: 'normal',
  diff: DIFF_TABLE.normal,

  running: false,
  spawnTimer: null,
  targets: [],

  score: 0,
  combo: 0,
  comboMax: 0,
  misses: 0,

  fever: 0,
  feverActive: false,

  totalGoodHits: 0,
  groupHits: {
    rice: 0,
    veg: 0,
    fruit: 0,
    protein: 0,
    dairy: 0
  },

  quests: {
    goals: [],
    minis: [],
    activeMiniIndex: 0
  }
};

function resetState(diffKey) {
  STATE.diffKey = diffKey || 'normal';
  STATE.diff = pickDifficulty(STATE.diffKey);

  STATE.running = false;
  if (STATE.spawnTimer) clearTimeout(STATE.spawnTimer);
  STATE.spawnTimer = null;
  STATE.targets.forEach(t => {
    if (t.lifeTimer) clearTimeout(t.lifeTimer);
    if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
  });
  STATE.targets = [];

  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.misses = 0;

  STATE.fever = 0;
  STATE.feverActive = false;

  STATE.totalGoodHits = 0;
  STATE.groupHits = { rice: 0, veg: 0, fruit: 0, protein: 0, dairy: 0 };

  STATE.quests.goals = QUEST_CONFIG.goals.map(g => ({
    id: g.id,
    label: g.label,
    target: g.target,
    prog: 0,
    done: false
  }));
  STATE.quests.minis = QUEST_CONFIG.minis.map(m => ({
    id: m.id,
    label: m.label,
    target: m.target,
    prog: 0,
    done: false
  }));
  STATE.quests.activeMiniIndex = 0;
}

// ---------- Fever ----------
function updateFever(delta) {
  const prev = STATE.fever;
  STATE.fever = clamp(STATE.fever + delta, 0, FEVER_MAX);

  const wasActive = STATE.feverActive;
  const nowActive = STATE.fever >= 80;
  STATE.feverActive = nowActive;

  window.dispatchEvent(new CustomEvent('hha:fever', {
    detail: {
      value: STATE.fever,
      max: FEVER_MAX,
      state: nowActive ? 'active' : 'idle'
    }
  }));

  if (!wasActive && nowActive) {
    window.dispatchEvent(new CustomEvent('hha:fever', {
      detail: { state: 'start', value: STATE.fever }
    }));
  } else if (wasActive && !nowActive) {
    window.dispatchEvent(new CustomEvent('hha:fever', {
      detail: { state: 'end', value: STATE.fever }
    }));
  }
}

// ---------- Quest handling ----------
function recalcGoals() {
  const g = STATE.quests.goals;

  const setGoal = (id, prog, done) => {
    const goal = g.find(x => x.id === id);
    if (!goal) return;
    goal.prog = prog;
    goal.done = !!done;
  };

  const groupsDone = ['rice','veg','fruit','protein','dairy']
    .reduce((acc, key) => acc + (STATE.groupHits[key] > 0 ? 1 : 0), 0);
  setGoal('all-groups', groupsDone, groupsDone >= 5);

  setGoal('good-20', STATE.totalGoodHits, STATE.totalGoodHits >= 20);
}

function recalcMini() {
  const minis = STATE.quests.minis;
  const activeIdx = STATE.quests.activeMiniIndex;
  const mini = minis[activeIdx];
  if (!mini || mini.done) return;

  if (mini.id === 'rice-5') {
    mini.prog = STATE.groupHits.rice;
  } else if (mini.id === 'vegfruit-5') {
    mini.prog = STATE.groupHits.veg + STATE.groupHits.fruit;
  } else if (mini.id === 'proteinmilk-5') {
    mini.prog = STATE.groupHits.protein + STATE.groupHits.dairy;
  }

  if (!mini.done && mini.prog >= mini.target) {
    mini.done = true;

    window.dispatchEvent(new CustomEvent('quest:celebrate', {
      detail: {
        kind: 'mini',
        index: activeIdx + 1,
        total: minis.length
      }
    }));

    STATE.quests.activeMiniIndex = Math.min(activeIdx + 1, minis.length);
  }
}

function checkGoalCelebrate(prevDoneFlags) {
  STATE.quests.goals.forEach((g, idx) => {
    if (!prevDoneFlags[idx] && g.done) {
      window.dispatchEvent(new CustomEvent('quest:celebrate', {
        detail: {
          kind: 'goal',
          index: idx + 1,
          total: STATE.quests.goals.length
        }
      }));
    }
  });

  const allGoalDone = STATE.quests.goals.every(g => g.done);
  const allMiniDone = STATE.quests.minis.every(m => m.done);
  if (allGoalDone && allMiniDone) {
    window.dispatchEvent(new CustomEvent('quest:all-complete', {
      detail: {
        goalsTotal: STATE.quests.goals.length,
        minisTotal: STATE.quests.minis.length
      }
    }));
  }
}

function broadcastQuest() {
  const goalsAll = STATE.quests.goals.map(g => ({
    id: g.id,
    label: g.label,
    prog: g.prog,
    target: g.target,
    done: g.done
  }));
  const minisAll = STATE.quests.minis.map(m => ({
    id: m.id,
    label: m.label,
    prog: m.prog,
    target: m.target,
    done: m.done
  }));

  const currentGoal = STATE.quests.goals.find(g => !g.done) || null;
  const activeMini = STATE.quests.minis[STATE.quests.activeMiniIndex] || null;

  window.dispatchEvent(new CustomEvent('quest:update', {
    detail: {
      goal: currentGoal && {
        label: currentGoal.label,
        prog: currentGoal.prog,
        target: currentGoal.target
      },
      mini: activeMini && {
        label: activeMini.label,
        prog: activeMini.prog,
        target: activeMini.target
      },
      goalsAll,
      minisAll,
      hint: currentGoal && !currentGoal.done
        ? 'ไฟล์ภารกิจหลักให้ครบ แล้วเก็บ mini quest ไปด้วยนะ'
        : ''
    }
  }));
}

function onGoodHitForQuests(food) {
  if (!food || !food.good) return;

  STATE.totalGoodHits += 1;
  if (STATE.groupHits[food.group] !== undefined) {
    STATE.groupHits[food.group] += 1;
  }

  const prevGoalDone = STATE.quests.goals.map(g => g.done);

  recalcGoals();
  recalcMini();
  checkGoalCelebrate(prevGoalDone);
  broadcastQuest();
}

// ---------- HUD score helpers ----------
function pushScoreHUD() {
  window.dispatchEvent(new CustomEvent('hha:score', {
    detail: {
      score: STATE.score,
      combo: STATE.combo,
      misses: STATE.misses
    }
  }));
}

function pushJudgeHUD(label) {
  window.dispatchEvent(new CustomEvent('hha:judge', {
    detail: { label }
  }));
}

// ---------- Target spawn / hit ----------
function randomSpawnPos() {
  const x = (Math.random() - 0.5) * 3.0;    // -1.5 .. 1.5
  const y = 1.1 + Math.random() * 1.4;      // 1.1 .. 2.5
  const z = -2.4 - Math.random();           // -2.4 .. -3.4
  return { x, y, z };
}

function spawnTarget() {
  if (!STATE.scene || !STATE.running || !A) return;
  if (STATE.targets.length >= STATE.diff.maxActive) return;

  const food = pickFood();
  const pos = randomSpawnPos();
  const texId = EmojiCanvas.getId(STATE.scene, food);

  const radius = 0.5 * STATE.diff.scale;

  const el = document.createElement('a-circle');
  el.className = 'fg-target';
  el.setAttribute('data-hha-tgt', '1');
  el.setAttribute('radius', radius.toString());
  el.setAttribute(
    'material',
    `shader: flat; src: #${texId}; transparent: true; side: double`
  );
  el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);

  el.setAttribute(
    'animation__hover',
    `property: position; dir: alternate; dur: 900; easing: easeInOutSine; loop: true; to: ${pos.x} ${pos.y + 0.18} ${pos.z}`
  );

  const target = {
    el,
    food,
    hit: false,
    lifeTimer: null
  };

  target.lifeTimer = setTimeout(() => {
    if (!STATE.running || target.hit) return;
    onTargetLate(target);
  }, STATE.diff.lifeTime);

  el.addEventListener('click', () => {
    if (!STATE.running) return;
    onTargetHit(target);
  });

  STATE.scene.appendChild(el);
  STATE.targets.push(target);
}

function removeTarget(target) {
  target.hit = true;
  if (target.lifeTimer) clearTimeout(target.lifeTimer);
  target.lifeTimer = null;

  const idx = STATE.targets.indexOf(target);
  if (idx >= 0) STATE.targets.splice(idx, 1);

  if (target.el && target.el.parentNode) {
    target.el.parentNode.removeChild(target.el);
  }
}

function sendHitFx(target, judgment, isGood) {
  if (!STATE.scene || !THREE) return;

  const world = new THREE.Vector3();
  target.el.object3D.getWorldPosition(world);
  const screen = worldToScreen(world, STATE.scene);
  if (!screen) return;

  const detail = {
    x: screen.x,
    y: screen.y,
    judgment: judgment || ''
  };

  if (isGood) {
    detail.scoreDelta = '+ ' + (STATE.combo > 1 ? (10 + (STATE.combo - 1) * 2) : 10);
    detail.good = true;
    window.dispatchEvent(new CustomEvent('hha:hit-ui', { detail }));
  } else {
    window.dispatchEvent(new CustomEvent('hha:miss-ui', { detail }));
  }

  if (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx) {
    window.GAME_MODULES.foodGroupsFx.burst(world);
  }
}

function onTargetHit(target) {
  if (target.hit) return;

  const food = target.food;
  const isGood = !!food.good;

  removeTarget(target);

  if (isGood) {
    STATE.combo += 1;
    STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
    const addScore = 10 + Math.max(0, STATE.combo - 1) * 2;
    STATE.score += addScore;

    updateFever(8);
    onGoodHitForQuests(food);
    pushScoreHUD();
    pushJudgeHUD(STATE.combo >= 10 ? 'PERFECT' : 'GOOD');
    sendHitFx(target, STATE.combo >= 10 ? 'PERFECT' : 'GOOD', true);
  } else {
    STATE.combo = 0;
    STATE.misses += 1;
    updateFever(-18);
    pushScoreHUD();
    pushJudgeHUD('MISS');
    window.dispatchEvent(new CustomEvent('hha:miss', {}));
    sendHitFx(target, 'MISS', false);
  }
}

function onTargetLate(target) {
  if (target.hit) return;
  const food = target.food;

  removeTarget(target);

  if (food.good) {
    STATE.combo = 0;
    STATE.misses += 1;
    updateFever(-12);
    pushScoreHUD();
    pushJudgeHUD('LATE');
    window.dispatchEvent(new CustomEvent('hha:miss', {}));
    sendHitFx(target, 'LATE', false);
  }
}

// ---------- Main loop ----------
function scheduleSpawnLoop() {
  if (!STATE.running) return;
  STATE.spawnTimer = setTimeout(() => {
    spawnTarget();
    scheduleSpawnLoop();
  }, STATE.diff.spawnInterval);
}

// ---------- Public API ----------
function start(diffKey) {
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }
  const scene = document.querySelector('a-scene');
  if (!scene) {
    console.error('[GroupsVR] <a-scene> not found');
    return;
  }

  STATE.scene = scene;
  resetState(diffKey);

  // fx 3D รอบเป้า
  if (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx && scene) {
    window.GAME_MODULES.foodGroupsFx.init(scene);
  }

  STATE.running = true;

  pushScoreHUD();
  pushJudgeHUD('');
  broadcastQuest();

  scheduleSpawnLoop();
}

function stop(reason) {
  if (!STATE.running) return;
  STATE.running = false;
  if (STATE.spawnTimer) clearTimeout(STATE.spawnTimer);
  STATE.spawnTimer = null;

  STATE.targets.forEach(t => {
    if (t.lifeTimer) clearTimeout(t.lifeTimer);
    if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
  });
  STATE.targets = [];

  window.dispatchEvent(new CustomEvent('hha:end', {
    detail: {
      reason: reason || 'stopped',
      scoreFinal: STATE.score,
      comboMax: STATE.comboMax,
      misses: STATE.misses,
      goalsCleared: STATE.quests.goals.filter(g => g.done).length,
      goalsTotal: STATE.quests.goals.length,
      miniCleared: STATE.quests.minis.filter(m => m.done).length,
      miniTotal: STATE.quests.minis.length
    }
  }));
}

export const GameEngine = {
  start,
  stop
};