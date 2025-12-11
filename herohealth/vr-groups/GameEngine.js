// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji targets + diff size + FX + Fever + Quest)

const A = window.AFRAME;
if (!A) {
  console.error('[GroupsVR] AFRAME not found');
}

// ---------------- Util ----------------
const FEVER_MAX = 100;

function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Fever UI global (จาก ui-fever.js)
const FeverUI =
  (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
  window.FeverUI ||
  null;

// ---------------- Difficulty ----------------
function pickDifficulty(diffKey) {
  diffKey = String(diffKey || 'normal').toLowerCase();

  const ns = (window.GAME_MODULES = window.GAME_MODULES || {});
  if (ns.foodGroupsDifficulty && typeof ns.foodGroupsDifficulty.get === 'function') {
    return ns.foodGroupsDifficulty.get(diffKey);
  }

  // fallback tuning
  if (diffKey === 'easy') {
    return {
      spawnInterval: 1600,
      lifeTime: 2600,
      scale: 1.35,        // เป้าใหญ่สุด
      maxActive: 3,
      goodRatio: 0.8,
      feverGain: 9,
      feverLoss: 18
    };
  }
  if (diffKey === 'hard') {
    return {
      spawnInterval: 900,
      lifeTime: 1800,
      scale: 0.9,         // เป้าเล็กสุด
      maxActive: 5,
      goodRatio: 0.7,
      feverGain: 7,
      feverLoss: 24
    };
  }
  // normal
  return {
    spawnInterval: 1200,
    lifeTime: 2200,
    scale: 1.1,
    maxActive: 4,
    goodRatio: 0.75,
    feverGain: 8,
    feverLoss: 20
  };
}

// ---------------- Food list (เริ่มต้น) ----------------
let FOOD_LIST = [
  { emoji: '🍚', group: 'carb',    good: true },
  { emoji: '🍞', group: 'carb',    good: true },
  { emoji: '🍝', group: 'carb',    good: true },

  { emoji: '🥦', group: 'veg',     good: true },
  { emoji: '🥕', group: 'veg',     good: true },
  { emoji: '🥒', group: 'veg',     good: true },

  { emoji: '🍎', group: 'fruit',   good: true },
  { emoji: '🍌', group: 'fruit',   good: true },
  { emoji: '🍇', group: 'fruit',   good: true },

  { emoji: '🍗', group: 'protein', good: true },
  { emoji: '🥚', group: 'protein', good: true },
  { emoji: '🐟', group: 'protein', good: true },

  { emoji: '🥛', group: 'milk',    good: true },
  { emoji: '🧀', group: 'milk',    good: true },

  // junk
  { emoji: '🍟', group: 'junk',    good: false },
  { emoji: '🍔', group: 'junk',    good: false },
  { emoji: '🍕', group: 'junk',    good: false },
  { emoji: '🍩', group: 'junk',    good: false },
  { emoji: '🍰', group: 'junk',    good: false },
  { emoji: '🍦', group: 'junk',    good: false }
];

// ถ้า dev ส่ง list เข้ามาผ่าน GAME_MODULES
if (window.GAME_MODULES && Array.isArray(window.GAME_MODULES.foodGroupsList)) {
  FOOD_LIST = window.GAME_MODULES.foodGroupsList;
}

// ถ้ามี emojiImage แบบ global (จากโหมดอื่น) ก็เก็บไว้
const emojiImage =
  (window.emojiImage) ||
  (window.GAME_MODULES && window.GAME_MODULES.emojiImage) ||
  null;

// ---------------- Quest Template ----------------
const QUEST_TEMPLATE = {
  goals: [
    {
      id: 'all-groups-once',
      label: 'เลือกอาหารจากครบทั้ง 5 หมู่ให้ได้อย่างน้อย 1 ครั้ง',
      target: 5
    },
    {
      id: 'good-streak',
      label: 'เลือกอาหารดีติดกันให้ได้ 10 ชิ้น',
      target: 10
    }
  ],
  minis: [
    {
      id: 'carb-5',
      label: 'หมู่ ข้าว-แป้ง ให้ครบ 5 ชิ้น',
      group: 'carb',
      target: 5
    },
    {
      id: 'veg-5',
      label: 'หมู่ ผัก ให้ครบ 5 ชิ้น',
      group: 'veg',
      target: 5
    },
    {
      id: 'fruit-5',
      label: 'หมู่ ผลไม้ ให้ครบ 5 ชิ้น',
      group: 'fruit',
      target: 5
    }
  ]
};

const QUEST = {
  goals: [],
  minis: [],
  currentGoalIndex: 0,
  currentMiniIndex: 0,
  seenGroups: {}
};

function resetQuest() {
  QUEST.goals = QUEST_TEMPLATE.goals.map(g => ({
    ...g,
    prog: 0,
    done: false
  }));
  QUEST.minis = QUEST_TEMPLATE.minis.map(m => ({
    ...m,
    prog: 0,
    done: false
  }));
  QUEST.currentGoalIndex = 0;
  QUEST.currentMiniIndex = 0;
  QUEST.seenGroups = {};
  emitQuestUpdate();
}

function emitQuestUpdate() {
  const goal = QUEST.goals[QUEST.currentGoalIndex] && !QUEST.goals[QUEST.currentGoalIndex].done
    ? QUEST.goals[QUEST.currentGoalIndex]
    : null;
  const mini = QUEST.minis[QUEST.currentMiniIndex] && !QUEST.minis[QUEST.currentMiniIndex].done
    ? QUEST.minis[QUEST.currentMiniIndex]
    : null;

  window.dispatchEvent(new CustomEvent('quest:update', {
    detail: {
      goal: goal && { label: goal.label, prog: goal.prog, target: goal.target },
      mini: mini && { label: mini.label, prog: mini.prog, target: mini.target },
      goalsAll: QUEST.goals.map(g => ({ id: g.id, done: g.done })),
      minisAll: QUEST.minis.map(m => ({ id: m.id, done: m.done })),
      hint: 'พยายามให้ครบทุกหมู่อาหาร และเคลียร์ mini quest ให้มากที่สุดเลยนะ'
    }
  }));
}

function celebrateQuest(kind, index, total) {
  window.dispatchEvent(new CustomEvent('quest:celebrate', {
    detail: { kind, index: index + 1, total }
  }));
}

function maybeCelebrateAllComplete() {
  const allGoalsDone = QUEST.goals.every(g => g.done);
  const allMinisDone = QUEST.minis.every(m => m.done);
  if (allGoalsDone && allMinisDone) {
    window.dispatchEvent(new CustomEvent('quest:all-complete', {
      detail: {
        goalsTotal: QUEST.goals.length,
        minisTotal: QUEST.minis.length
      }
    }));
  }
}

function onGoodFoodForQuest(food, isGoodHit) {
  if (!isGoodHit) return;
  const group = food.group || 'other';

  // goal 1: ครบ 5 หมู่
  const g1 = QUEST.goals[0];
  if (g1 && !g1.done && group !== 'junk') {
    if (!QUEST.seenGroups[group]) {
      QUEST.seenGroups[group] = true;
      g1.prog = Object.keys(QUEST.seenGroups).length;
      if (g1.prog >= g1.target) {
        g1.done = true;
        celebrateQuest('goal', 0, QUEST.goals.length);
        if (QUEST.currentGoalIndex === 0) {
          QUEST.currentGoalIndex = 1;
        }
      }
    }
  }

  // goal 2: good streak
  const g2 = QUEST.goals[1];
  if (g2 && !g2.done) {
    g2.prog = clamp(g2.prog + 1, 0, g2.target);
    if (g2.prog >= g2.target) {
      g2.done = true;
      celebrateQuest('goal', 1, QUEST.goals.length);
    }
  }

  // mini quests ตาม group
  QUEST.minis.forEach((mq, idx) => {
    if (mq.done) return;
    if (mq.group && mq.group === group) {
      mq.prog = clamp(mq.prog + 1, 0, mq.target);
      if (mq.prog >= mq.target) {
        mq.done = true;
        celebrateQuest('mini', idx, QUEST.minis.length);
        if (QUEST.currentMiniIndex === idx) {
          for (let i = 0; i < QUEST.minis.length; i++) {
            if (!QUEST.minis[i].done) {
              QUEST.currentMiniIndex = i;
              break;
            }
          }
        }
      }
    }
  });

  emitQuestUpdate();
  maybeCelebrateAllComplete();
}

// ---------------- State ----------------
const STATE = {
  scene: null,
  diffKey: 'normal',
  diffCfg: pickDifficulty('normal'),
  running: false,

  targets: [],
  nextTargetId: 1,
  nextSpawnAt: 0,

  score: 0,
  combo: 0,
  comboMax: 0,
  misses: 0,
  late: 0,

  fever: 0,
  feverActive: false,

  tickHandle: null
};

// ---------------- world -> screen (FX 2D) ----------------
function worldToScreen(worldVec3, sceneEl) {
  try {
    const scene = sceneEl || STATE.scene;
    if (!scene || !scene.camera || !window.THREE) return null;

    const camera = scene.camera;
    const v = new THREE.Vector3(worldVec3.x, worldVec3.y, worldVec3.z);
    v.project(camera);

    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    const x = (v.x + 1) / 2 * w;
    const y = (1 - v.y) / 2 * h;

    return { x, y };
  } catch (err) {
    console.warn('[GroupsVR] worldToScreen error:', err);
    return null;
  }
}

// ---------------- FX ตีเป้า ----------------
function sendHitFx(target, judgment, isGood) {
  if (!STATE.scene || !window.THREE) return;

  const world = new THREE.Vector3();
  if (target && target.el && target.el.object3D) {
    target.el.object3D.getWorldPosition(world);
  } else {
    world.set(0, 1.6, -2);
  }

  let screen = worldToScreen(world, STATE.scene);
  if (!screen) {
    screen = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };
  }

  const detail = {
    x: screen.x,
    y: screen.y,
    judgment: judgment || ''
  };

  if (isGood) {
    const addScore = 10 + Math.max(0, STATE.combo - 1) * 2;
    detail.scoreDelta = '+ ' + addScore;
    detail.good = true;
  } else {
    detail.scoreDelta = 'MISS';
    detail.good = false;
  }

  const P = window.Particles || (window.GAME_MODULES && window.GAME_MODULES.Particles);
  if (P && typeof P.burstAt === 'function' && typeof P.scorePop === 'function') {
    if (isGood) {
      P.burstAt(detail.x, detail.y, { good: true });
      P.scorePop(detail.x, detail.y, detail.scoreDelta, {
        good: true,
        judgment
      });
    } else {
      P.burstAt(detail.x, detail.y, { good: false });
      P.scorePop(detail.x, detail.y, 'MISS', {
        good: false,
        judgment
      });
    }
  } else {
    // fallback ยิง event เดิม
    if (isGood) {
      window.dispatchEvent(new CustomEvent('hha:hit-ui', { detail }));
    } else {
      window.dispatchEvent(new CustomEvent('hha:miss-ui', { detail }));
    }
  }

  // FX 3D เศษเป้าในฉาก
  if (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx) {
    try {
      window.GAME_MODULES.foodGroupsFx.burst(world);
    } catch (err) {
      console.warn('[GroupsVR] foodGroupsFx.burst error:', err);
    }
  }
}

// ---------------- Fever ----------------
function setFever(delta) {
  const before = STATE.fever;
  STATE.fever = clamp(STATE.fever + delta, 0, FEVER_MAX);

  const wasActive = STATE.feverActive;
  const nowActive = STATE.fever >= FEVER_MAX;

  if (FeverUI && typeof FeverUI.setFever === 'function') {
    FeverUI.setFever(STATE.fever);
  }

  if (!wasActive && nowActive) {
    STATE.feverActive = true;
    window.dispatchEvent(new CustomEvent('hha:fever', { detail: { state: 'start' } }));
    if (FeverUI && typeof FeverUI.setFeverActive === 'function') {
      FeverUI.setFeverActive(true);
    }
  } else if (wasActive && !nowActive) {
    STATE.feverActive = false;
    window.dispatchEvent(new CustomEvent('hha:fever', { detail: { state: 'end' } }));
    if (FeverUI && typeof FeverUI.setFeverActive === 'function') {
      FeverUI.setFeverActive(false);
    }
  }
}

// ---------------- Score / Judge ----------------
function emitScore() {
  window.dispatchEvent(new CustomEvent('hha:score', {
    detail: {
      score: STATE.score,
      combo: STATE.combo,
      misses: STATE.misses
    }
  }));
}

function setJudge(label) {
  window.dispatchEvent(new CustomEvent('hha:judge', {
    detail: { label }
  }));
}

// ---------------- Targets ----------------
function spawnTarget() {
  if (!STATE.scene) return;

  const cfg = STATE.diffCfg || {};
  const scale = Number(cfg.scale || 1.0);

  const food = FOOD_LIST[Math.floor(Math.random() * FOOD_LIST.length)];

  const wrapper = document.createElement('a-entity');
  wrapper.setAttribute('data-hha-tgt', '1');
  wrapper.setAttribute('class', 'fg-target');

  // circle พื้นหลัง
  wrapper.setAttribute('geometry', 'primitive: circle; radius: 0.55');
  wrapper.setAttribute(
    'material',
    `shader: flat; color: ${food.good ? '#16a34a' : '#f97316'}; opacity: 0.22; transparent: true`
  );

  // emoji กลางเป้า (ไม่ต้องใช้ texture — ใช้ text component)
  wrapper.setAttribute('text', {
    value: food.emoji || '🍎',
    align: 'center',
    color: '#ffffff',
    width: 3,
    side: 'double'
  });

  // ขนาดตาม diff
  wrapper.setAttribute('scale', `${scale} ${scale} ${scale}`);

  // ตำแหน่งสุ่มด้านหน้า
  const x = randRange(-1.4, 1.4);
  const y = randRange(1.1, 1.9);
  const z = -3;
  wrapper.setAttribute('position', `${x} ${y} ${z}`);

  const target = {
    id: STATE.nextTargetId++,
    el: wrapper,
    food,
    createdAt: performance.now(),
    expiresAt: performance.now() + (cfg.lifeTime || 2200),
    state: 'alive'
  };

  wrapper.addEventListener('click', () => {
    if (!STATE.running || target.state !== 'alive') return;
    onHitTarget(target);
  });

  STATE.scene.appendChild(wrapper);
  STATE.targets.push(target);
}

function removeTarget(target) {
  target.state = 'dead';
  if (target.el && target.el.parentNode) {
    target.el.parentNode.removeChild(target.el);
  }
}

function onHitTarget(target) {
  const food = target.food;
  const isGoodFood = !!food.good;

  removeTarget(target);

  if (isGoodFood) {
    STATE.combo += 1;
    STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
    const base = STATE.feverActive ? 20 : 10;
    const addScore = base + Math.max(0, STATE.combo - 1) * 2;
    STATE.score += addScore;

    const judgeLabel =
      STATE.combo >= 8 ? 'PERFECT' :
      STATE.combo >= 3 ? 'GOOD' :
      'OK';

    setJudge(judgeLabel);
    setFever(STATE.diffCfg.feverGain || 8);
    emitScore();

    onGoodFoodForQuest(food, true);
    sendHitFx(target, judgeLabel, true);
  } else {
    STATE.combo = 0;
    STATE.misses += 1;
    setJudge('MISS');
    setFever(-(STATE.diffCfg.feverLoss || 20));
    emitScore();
    window.dispatchEvent(new CustomEvent('hha:miss', {}));

    sendHitFx(target, 'MISS', false);
  }
}

function onLateTarget(target) {
  removeTarget(target);
  STATE.combo = 0;
  STATE.misses += 1;
  STATE.late += 1;
  setJudge('LATE');
  setFever(-(STATE.diffCfg.feverLoss || 20));
  emitScore();
  window.dispatchEvent(new CustomEvent('hha:miss', {}));
  sendHitFx(target, 'LATE', false);
}

// ---------------- Main Loop ----------------
function tick() {
  if (!STATE.running) return;

  const now = performance.now();
  const cfg = STATE.diffCfg || {};

  // spawn ใหม่
  const aliveCount = STATE.targets.filter(t => t.state === 'alive').length;
  if (now >= STATE.nextSpawnAt && aliveCount < (cfg.maxActive || 4)) {
    spawnTarget();
    STATE.nextSpawnAt = now + (cfg.spawnInterval || 1200);
  }

  // เช็คเป้าหมดเวลา
  STATE.targets.slice().forEach(t => {
    if (t.state !== 'alive') return;
    if (now > t.expiresAt) {
      onLateTarget(t);
    }
  });
}

// ---------------- Public API ----------------
const GameEngine = {
  start(diffKey) {
    const scene = document.querySelector('a-scene');
    if (!scene) {
      console.error('[GroupsVR] a-scene not found');
      return;
    }

    if (STATE.running) {
      this.stop('restart');
    }

    STATE.scene = scene;
    STATE.diffKey = diffKey || 'normal';
    STATE.diffCfg = pickDifficulty(STATE.diffKey);
    STATE.running = true;

    STATE.targets = [];
    STATE.nextTargetId = 1;
    STATE.nextSpawnAt = performance.now();

    STATE.score = 0;
    STATE.combo = 0;
    STATE.comboMax = 0;
    STATE.misses = 0;
    STATE.late = 0;
    STATE.fever = 0;
    STATE.feverActive = false;

    // Fever UI card
    if (FeverUI && typeof FeverUI.ensureFeverBar === 'function') {
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setShield && FeverUI.setShield(0);
      FeverUI.setFeverActive && FeverUI.setFeverActive(false);
    }

    resetQuest();
    emitScore();
    setJudge('');

    // init FX 3D
    if (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx && typeof window.GAME_MODULES.foodGroupsFx.init === 'function') {
      window.GAME_MODULES.foodGroupsFx.init(scene);
    }

    if (STATE.tickHandle) clearInterval(STATE.tickHandle);
    STATE.tickHandle = setInterval(tick, 50);

    console.log('[GroupsVR] GameEngine.start', STATE.diffKey, STATE.diffCfg);
  },

  stop(reason) {
    if (!STATE.running) return;
    STATE.running = false;
    if (STATE.tickHandle) {
      clearInterval(STATE.tickHandle);
      STATE.tickHandle = null;
    }

    STATE.targets.forEach(t => {
      if (t.el && t.el.parentNode) {
        t.el.parentNode.removeChild(t.el);
      }
    });
    STATE.targets = [];

    const goalsCleared = QUEST.goals.filter(g => g.done).length;
    const goalsTotal = QUEST.goals.length;
    const miniCleared = QUEST.minis.filter(m => m.done).length;
    const miniTotal = QUEST.minis.length;

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        reason: reason || 'stopped',
        scoreFinal: STATE.score,
        comboMax: STATE.comboMax,
        misses: STATE.misses,
        goalsCleared,
        goalsTotal,
        miniCleared,
        miniTotal
      }
    }));

    console.log('[GroupsVR] GameEngine.stop', reason);
  }
};

window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES.GroupsVR = GameEngine;

export { GameEngine };