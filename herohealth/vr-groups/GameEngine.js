// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji targets + diff size + FX + Fever + Quest)
// ใช้กับ groups-vr.html (import { GameEngine } from './vr-groups/GameEngine.js')

const A = window.AFRAME;
if (!A) {
  console.error('[GroupsVR] AFRAME not found');
}

// ---------- Util ----------
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

// ---------- Difficulty ----------
function pickDifficulty(diffKey) {
  diffKey = String(diffKey || 'normal').toLowerCase();

  // ถ้ามี config มาจากภายนอก (เช่น HHA_DIFF_TABLE -> foodGroupsDifficulty)
  const ns = (window.GAME_MODULES = window.GAME_MODULES || {});
  if (ns.foodGroupsDifficulty && typeof ns.foodGroupsDifficulty.get === 'function') {
    return ns.foodGroupsDifficulty.get(diffKey);
  }

  // fallback เอง
  if (diffKey === 'easy') {
    return {
      spawnInterval: 1600,
      lifeTime: 2600,
      scale: 1.35,        // เป้าใหญ่
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
      scale: 0.9,         // เป้าเล็ก
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

// ---------- Foods (default) ----------
let FOOD_LIST = [
  // group: carb, veg, fruit, protein, milk, junk
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
  { emoji: '🍦', group: 'junk',    good: false },
];

// ถ้ามี list จากภายนอกก็ใช้แทน
if (window.GAME_MODULES && Array.isArray(window.GAME_MODULES.foodGroupsList)) {
  FOOD_LIST = window.GAME_MODULES.foodGroupsList;
}

// ---------- Quest State ----------
const QUEST_TEMPLATE = {
  goals: [
    {
      id: 'all-groups-once',
      label: 'เลือกอาหารจากครบทั้ง 5 หมู่ให้ได้อย่างน้อย 1 ครั้ง',
      target: 5 // นับว่าครบ 5 หมู่
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
  seenGroups: {}  // สำหรับ goal 1
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

  const detail = {
    goal: goal && {
      label: goal.label,
      prog: goal.prog,
      target: goal.target
    },
    mini: mini && {
      label: mini.label,
      prog: mini.prog,
      target: mini.target
    },
    goalsAll: QUEST.goals.map(g => ({ id: g.id, done: g.done })),
    minisAll: QUEST.minis.map(m => ({ id: m.id, done: m.done })),
    hint: 'ไฟล์สภารกิจหลักให้ครบ แล้วเก็บ 5 mini quest ไปด้วยนะ'
  };

  window.dispatchEvent(new CustomEvent('quest:update', { detail }));
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

  // ----- Goal 1: ครบ 5 หมู่ -----
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

  // ----- Goal 2: good streak 10 -----
  const g2 = QUEST.goals[1];
  if (g2 && !g2.done) {
    g2.prog = clamp(g2.prog + 1, 0, g2.target);
    if (g2.prog >= g2.target) {
      g2.done = true;
      celebrateQuest('goal', 1, QUEST.goals.length);
    }
  }

  // ----- Mini quests ตาม group -----
  QUEST.minis.forEach((mq, idx) => {
    if (mq.done) return;
    if (mq.group && mq.group === group) {
      mq.prog = clamp(mq.prog + 1, 0, mq.target);
      if (mq.prog >= mq.target) {
        mq.done = true;
        celebrateQuest('mini', idx, QUEST.minis.length);
        if (QUEST.currentMiniIndex === idx) {
          // jump ไป mini ตัวถัดไป
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

// ---------- State ----------
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

  tickHandle: null,
};

// ---------- world -> screen สำหรับ FX 2D ----------
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

// ---------- FX ตีเป้า ----------
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

  // FX 2D กลางจอ
  const P = window.Particles || (window.GAME_MODULES && window.GAME_MODULES.Particles);
  if (P && typeof P.burstAt === 'function' && typeof P.scorePop === 'function') {
    if (isGood) {
      P.burstAt(detail.x, detail.y, { good: true });
      P.scorePop(detail.x, detail.y, detail.scoreDelta, {
        good: true,
        judgment: judgment
      });
    } else {
      P.burstAt(detail.x, detail.y, { good: false });
      P.scorePop(detail.x, detail.y, 'MISS', {
        good: false,
        judgment: judgment
      });
    }
  } else {
    // fallback เดิม
    if (isGood) {
      window.dispatchEvent(new CustomEvent('hha:hit-ui', { detail }));
    } else {
      window.dispatchEvent(new CustomEvent('hha:miss-ui', { detail }));
    }
  }

  // FX 3D ในฉาก
  if (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx) {
    try {
      window.GAME_MODULES.foodGroupsFx.burst(world);
    } catch (err) {
      console.warn('[GroupsVR] foodGroupsFx.burst error:', err);
    }
  }
}

// ---------- Fever ----------
function setFever(delta) {
  const before = STATE.fever;
  STATE.fever = clamp(STATE.fever + delta, 0, FEVER_MAX);

  const wasActive = STATE.feverActive;
  const nowActive = STATE.fever >= FEVER_MAX;

  if (!wasActive && nowActive) {
    STATE.feverActive = true;
    window.dispatchEvent(new CustomEvent('hha:fever', { detail: { state: 'start' } }));
  } else if (wasActive && !nowActive) {
    STATE.feverActive = false;
    window.dispatchEvent(new CustomEvent('hha:fever', { detail: { state: 'end' } }));
  }

  // ให้ ui-fever คิด gauge เองจาก event hha:score หรือ hha:fever ก็ได้
}

// ---------- Score ----------
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

// ---------- Targets ----------
function makeFoodTexture(food) {
  let tex = food.tex || null;
  if (!tex && typeof window.emojiImage === 'function' && food.emoji) {
    tex = window.emojiImage(food.emoji);
  }
  return tex;
}

function spawnTarget() {
  if (!STATE.scene) return;

  const cfg = STATE.diffCfg || {};
  const scale = Number(cfg.scale || 1.0);

  const food = FOOD_LIST[Math.floor(Math.random() * FOOD_LIST.length)];

  const el = document.createElement('a-entity');
  el.setAttribute('data-hha-tgt', '1');
  el.setAttribute('class', 'fg-target');

  const tex = makeFoodTexture(food);
  if (tex) {
    el.setAttribute('geometry', 'primitive: circle; radius: 0.48');
    el.setAttribute(
      'material',
      `shader: flat; src: ${tex}; transparent: true; alphaTest: 0.01`
    );
  } else {
    el.setAttribute('geometry', 'primitive: sphere; radius: 0.35');
    el.setAttribute(
      'material',
      `color: ${food.good ? '#22c55e' : '#f97316'}; metalness: 0.1; roughness: 0.95`
    );
  }

  // ขนาดตามระดับ diff
  el.setAttribute('scale', `${scale} ${scale} ${scale}`);

  // ตำแหน่งสุ่มด้านหน้า
  const x = randRange(-1.4, 1.4);
  const y = randRange(1.1, 1.9);
  const z = -3;
  el.setAttribute('position', `${x} ${y} ${z}`);

  const target = {
    id: STATE.nextTargetId++,
    el,
    food,
    createdAt: performance.now(),
    expiresAt: performance.now() + (cfg.lifeTime || 2200),
    state: 'alive'
  };

  el.addEventListener('click', () => {
    if (!STATE.running || target.state !== 'alive') return;
    onHitTarget(target);
  });

  STATE.scene.appendChild(el);
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
    // คะแนน
    STATE.combo += 1;
    STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
    const base = STATE.feverActive ? 20 : 10;
    const addScore = base + Math.max(0, STATE.combo - 1) * 2;
    STATE.score += addScore;

    setJudge(STATE.combo >= 8 ? 'PERFECT' : (STATE.combo >= 3 ? 'GOOD' : 'OK'));
    setFever(STATE.diffCfg.feverGain || 8);
    emitScore();

    onGoodFoodForQuest(food, true);
    sendHitFx(target, (STATE.combo >= 8 ? 'PERFECT' : 'GOOD'), true);
  } else {
    // โจมตีของไม่ดี = miss
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

  // FX miss แบบไม่รู้ตำแหน่งเป๊ะ ใช้ world pos เดิม
  sendHitFx(target, 'LATE', false);
}

// ---------- Main loop ----------
function tick() {
  if (!STATE.running) return;

  const now = performance.now();
  const cfg = STATE.diffCfg || {};

  // spawn
  const aliveCount = STATE.targets.filter(t => t.state === 'alive').length;
  if (now >= STATE.nextSpawnAt && aliveCount < (cfg.maxActive || 4)) {
    spawnTarget();
    STATE.nextSpawnAt = now + (cfg.spawnInterval || 1200);
  }

  // check late/expire
  STATE.targets.slice().forEach(t => {
    if (t.state !== 'alive') return;
    if (now > t.expiresAt) {
      onLateTarget(t);
    }
  });
}

// ---------- Public API ----------
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

    resetQuest();
    emitScore();
    setJudge('');

    // init FX 3D ถ้ามี
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

    // ลบเป้าทั้งหมด
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

// ผูกไว้ให้ debug ผ่าน window ด้วย
window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES.GroupsVR = GameEngine;

export { GameEngine };