// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji target, Fever, Particles FX, Quest 2+3)
// 2025-12-10

'use strict';

const A = window.AFRAME;
if (!A) {
  console.error('[GroupsVR] AFRAME not found');
}

// ------------- Util -------------
function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// Difficulty (ถ้ามี ns.foodGroupsDifficulty ให้ใช้, ไม่งั้น fallback)
function pickDifficulty(diffKey) {
  diffKey = String(diffKey || 'normal').toLowerCase();

  if (window.foodGroupsDifficulty && typeof window.foodGroupsDifficulty.get === 'function') {
    return window.foodGroupsDifficulty.get(diffKey);
  }

  // fallback แบบง่าย
  if (diffKey === 'easy') {
    return {
      spawnInterval: 1200,
      lifeMs: 2600,
      scale: 1.2,
      maxActive: 3,
      goodRatio: 0.85
    };
  }
  if (diffKey === 'hard') {
    return {
      spawnInterval: 700,
      lifeMs: 1900,
      scale: 0.9,
      maxActive: 5,
      goodRatio: 0.7
    };
  }
  // normal
  return {
    spawnInterval: 900,
    lifeMs: 2200,
    scale: 1.05,
    maxActive: 4,
    goodRatio: 0.8
  };
}

// ------------- Food pools -------------
const FOOD_GROUPS = {
  grains: ['🍚', '🍞', '🥖', '🥯', '🥐', '🥨'],
  veg: ['🥦', '🥕', '🌽', '🥒', '🫑', '🥬'],
  fruit: ['🍎', '🍌', '🍇', '🍉', '🍊', '🍓'],
  protein: ['🍗', '🥚', '🥩', '🍖', '🍤', '🍣'],
  dairy: ['🥛', '🧀', '🍨', '🍦'],
  junk: ['🍩', '🍫', '🥤', '🍟', '🍕', '🧁']
};

const GROUP_LABEL = {
  grains: 'ข้าว-แป้ง',
  veg: 'ผัก',
  fruit: 'ผลไม้',
  protein: 'เนื้อสัตว์/โปรตีน',
  dairy: 'นม/ผลิตภัณฑ์นม'
};

const GROUP_KEYS = ['grains', 'veg', 'fruit', 'protein', 'dairy'];

// ------------- World → Screen helper -------------
function worldToScreen(worldPos, cameraEl) {
  const THREE = window.THREE;
  if (!THREE || !cameraEl) return null;
  const camObj = cameraEl.getObject3D('camera');
  if (!camObj) return null;

  const v = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
  v.project(camObj);

  const x = (v.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  return { x, y };
}

// ส่ง event ให้ /vr/particles.js
function emitHitUi(worldPos, scoreDelta, judgment, good, cameraEl) {
  const s = worldToScreen(worldPos, cameraEl) || {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  };
  window.dispatchEvent(new CustomEvent('hha:hit-ui', {
    detail: {
      x: s.x,
      y: s.y,
      scoreDelta,
      judgment,
      good: !!good
    }
  }));
}

function emitMissUi(worldPos, label, cameraEl) {
  const s = worldToScreen(worldPos, cameraEl) || {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  };
  window.dispatchEvent(new CustomEvent('hha:miss-ui', {
    detail: {
      x: s.x,
      y: s.y,
      judgment: label || 'MISS'
    }
  }));
}

// ------------- Quest 2 Goals + 3 Mini quests -------------
function createQuestModel() {
  // Goals: 2
  const goalsAll = [
    {
      id: 'balanced5',
      label: 'เลือกอาหารจากครบทั้ง 5 หมู่ให้ได้อย่างน้อย 1 ครั้ง',
      target: 5,
      prog: 0,
      done: false,
      hitSet: new Set() // เก็บหมู่ที่เคยโดนแล้ว
    },
    {
      id: 'goodHits',
      label: 'สะสมอาหารดีให้ครบ 25 ชิ้น',
      target: 25,
      prog: 0,
      done: false
    }
  ];

  // Mini quests: 3
  const minisAll = [
    {
      id: 'grains5',
      label: 'หมู่ ข้าว-แป้ง ให้ครบ 5 ชิ้น',
      target: 5,
      prog: 0,
      done: false
    },
    {
      id: 'vegFruit6',
      label: 'หมู่ ผัก + ผลไม้ รวมกัน 6 ชิ้น',
      target: 6,
      prog: 0,
      done: false
    },
    {
      id: 'proteinDairy4',
      label: 'หมู่ โปรตีน + นม รวมกัน 4 ชิ้น',
      target: 4,
      prog: 0,
      done: false
    }
  ];

  return {
    goalsAll,
    minisAll,
    currentGoalIndex: 0,
    currentMiniIndex: 0,
    allCompleteFired: false
  };
}

function getCurrentGoal(model) {
  return model.goalsAll.find(g => !g.done) || null;
}

function getCurrentMini(model) {
  return model.minisAll.find(m => !m.done) || null;
}

function emitQuestUpdate(model) {
  const goal = getCurrentGoal(model);
  const mini = getCurrentMini(model);

  window.dispatchEvent(new CustomEvent('quest:update', {
    detail: {
      goal: goal
        ? { label: goal.label, prog: goal.prog, target: goal.target }
        : null,
      mini: mini
        ? { label: mini.label, prog: mini.prog, target: mini.target }
        : null,
      goalsAll: model.goalsAll.map(g => ({
        label: g.label,
        target: g.target,
        prog: g.prog,
        done: g.done
      })),
      minisAll: model.minisAll.map(m => ({
        label: m.label,
        target: m.target,
        prog: m.prog,
        done: m.done
      })),
      hint: goal
        ? 'โฟกัสภารกิจหลักให้ครบ แล้วเก็บ mini quest ไปด้วยนะ'
        : 'ทุกภารกิจหลักครบแล้ว ลุย mini quest ที่เหลือให้ครบเลย!'
    }
  }));
}

function emitQuestCelebrate(kind, index, total) {
  window.dispatchEvent(new CustomEvent('quest:celebrate', {
    detail: {
      kind,
      index,
      total
    }
  }));
}

function emitQuestAllComplete(model) {
  const gTotal = model.goalsAll.length;
  const mTotal = model.minisAll.length;
  window.dispatchEvent(new CustomEvent('quest:all-complete', {
    detail: {
      goalsTotal: gTotal,
      minisTotal: mTotal
    }
  }));
}

// update quest จาก hit แต่ละอัน
function updateQuestOnHit(model, groupKey) {
  // update goal 1 (balanced5)
  const g1 = model.goalsAll[0];
  if (g1 && !g1.done && g1.hitSet instanceof Set && groupKey && GROUP_KEYS.includes(groupKey)) {
    if (!g1.hitSet.has(groupKey)) {
      g1.hitSet.add(groupKey);
      g1.prog = g1.hitSet.size;
      if (g1.prog >= g1.target) {
        g1.done = true;
        emitQuestCelebrate('goal', 1, model.goalsAll.length);
      }
    }
  }

  // update goal 2 (goodHits total)
  const g2 = model.goalsAll[1];
  if (g2 && !g2.done) {
    g2.prog += 1;
    if (g2.prog >= g2.target) {
      g2.done = true;
      emitQuestCelebrate('goal', 2, model.goalsAll.length);
    }
  }

  // mini: grains5
  const m1 = model.minisAll[0];
  if (m1 && !m1.done && groupKey === 'grains') {
    m1.prog += 1;
    if (m1.prog >= m1.target) {
      m1.done = true;
      emitQuestCelebrate('mini', 1, model.minisAll.length);
    }
  }

  // mini: vegFruit6
  const m2 = model.minisAll[1];
  if (m2 && !m2.done && (groupKey === 'veg' || groupKey === 'fruit')) {
    m2.prog += 1;
    if (m2.prog >= m2.target) {
      m2.done = true;
      emitQuestCelebrate('mini', 2, model.minisAll.length);
    }
  }

  // mini: proteinDairy4
  const m3 = model.minisAll[2];
  if (m3 && !m3.done && (groupKey === 'protein' || groupKey === 'dairy')) {
    m3.prog += 1;
    if (m3.prog >= m3.target) {
      m3.done = true;
      emitQuestCelebrate('mini', 3, model.minisAll.length);
    }
  }

  emitQuestUpdate(model);

  const allGoalsDone = model.goalsAll.every(g => g.done);
  const allMiniDone = model.minisAll.every(m => m.done);

  if (allGoalsDone && allMiniDone && !model.allCompleteFired) {
    model.allCompleteFired = true;
    emitQuestAllComplete(model);
  }
}

// ------------- Fever UI helper -------------
function getFeverUI() {
  return (window.GAME_MODULES && window.GAME_MODULES.FeverUI) || window.FeverUI || null;
}

// ------------- Target spawn helper -------------
let TARGET_ID = 0;

function pickFood(diffCfg) {
  const r = Math.random();
  const goodRatio = typeof diffCfg.goodRatio === 'number' ? diffCfg.goodRatio : 0.8;
  if (r > goodRatio) {
    // junk
    const pool = FOOD_GROUPS.junk;
    const ch = pool[Math.floor(Math.random() * pool.length)];
    return { ch, groupKey: 'junk', isGood: false };
  }

  // pick one of 5 groups
  const groupKey = GROUP_KEYS[Math.floor(Math.random() * GROUP_KEYS.length)];
  const pool = FOOD_GROUPS[groupKey];
  const ch = pool[Math.floor(Math.random() * pool.length)];
  return { ch, groupKey, isGood: true };
}

function createEmojiTexture(ch, sizePx) {
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
  ctx.font = `${sizePx * 0.7}px system-ui, "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(ch, sizePx / 2, sizePx / 2);

  return canvas.toDataURL('image/png');
}

function spawnTarget(sceneEl, cameraEl, diffCfg, onHitCb, onExpireCb) {
  if (!sceneEl || !cameraEl || !A) return null;
  const pick = pickFood(diffCfg);
  const sizeFactor = diffCfg.scale || 1.0;

  const holder = document.createElement('a-entity');
  const targetId = ++TARGET_ID;
  holder.setAttribute('data-hha-tgt', '1');
  holder.setAttribute('data-tgt-id', String(targetId));
  holder.setAttribute('data-group', pick.groupKey);
  holder.classList.add('groups-target');

  const baseSize = 0.9 * sizeFactor;

  // bg plate
  const bg = document.createElement('a-plane');
  bg.setAttribute('width', baseSize);
  bg.setAttribute('height', baseSize);
  bg.setAttribute(
    'material',
    'color: #020617; transparent: true; opacity: 0.28; side: double'
  );
  holder.appendChild(bg);

  // emoji
  const texUrl = createEmojiTexture(pick.ch, 256);
  if (texUrl) {
    const img = document.createElement('a-image');
    img.setAttribute('src', texUrl);
    img.setAttribute('width', baseSize * 0.9);
    img.setAttribute('height', baseSize * 0.9);
    img.setAttribute('position', '0 0 0.01');
    img.setAttribute(
      'material',
      'transparent: true; alphaTest: 0.01; side: double'
    );
    holder.appendChild(img);
  }

  // random position หน้า player
  const x = -0.8 + Math.random() * 1.6;
  const y = -0.25 + Math.random() * 0.9;
  const z = -1.6;
  holder.setAttribute('position', `${x} ${y} ${z}`);

  sceneEl.appendChild(holder);

  let killed = false;
  const bornAt = performance.now();
  const lifeMs = Number(diffCfg.lifeMs) > 0 ? Number(diffCfg.lifeMs) : 2200;

  function cleanup(reason) {
    if (killed) return;
    killed = true;
    if (holder.parentNode) holder.parentNode.removeChild(holder);

    if (reason === 'expire' && typeof onExpireCb === 'function') {
      const wp = new A.THREE.Vector3();
      holder.object3D.getWorldPosition(wp);
      onExpireCb({
        id: targetId,
        groupKey: pick.groupKey,
        isGood: pick.isGood,
        bornAt,
        lifeMs,
        worldPos: { x: wp.x, y: wp.y, z: wp.z }
      });
    }
  }

  const timerId = setTimeout(() => {
    cleanup('expire');
  }, lifeMs);

  // click handler (cursor raycast)
  holder.addEventListener('click', () => {
    if (killed) return;
    clearTimeout(timerId);
    const wp = new A.THREE.Vector3();
    holder.object3D.getWorldPosition(wp);

    if (typeof onHitCb === 'function') {
      onHitCb({
        id: targetId,
        groupKey: pick.groupKey,
        isGood: pick.isGood,
        worldPos: { x: wp.x, y: wp.y, z: wp.z }
      });
    }

    cleanup('hit');
  });

  return {
    id: targetId,
    el: holder,
    groupKey: pick.groupKey,
    isGood: pick.isGood,
    kill() {
      clearTimeout(timerId);
      cleanup('manual');
    }
  };
}

// ------------- GameEngine core -------------
const GameEngine = (function () {
  let state = null;

  function resetState() {
    state = {
      diffKey: 'normal',
      diffCfg: pickDifficulty('normal'),
      sceneEl: null,
      cameraEl: null,
      spawnTimer: null,
      secTimer: null,
      secLeft: 60,
      activeTargets: [],
      running: false,
      score: 0,
      combo: 0,
      misses: 0,
      fever: 0,
      feverActive: false,
      questModel: createQuestModel()
    };
  }

  resetState();

  function updateHUDScore() {
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: {
        score: state.score,
        combo: state.combo,
        misses: state.misses
      }
    }));
  }

  function pushJudge(label) {
    window.dispatchEvent(new CustomEvent('hha:judge', {
      detail: { label }
    }));
  }

  function updateFever(delta) {
    const FeverUI = getFeverUI();
    if (!FeverUI) return;

    state.fever = clamp(state.fever + delta, 0, 100);
    FeverUI.setFever(state.fever);

    const wasActive = state.feverActive;
    const nowActive = state.fever >= 80;

    if (!wasActive && nowActive) {
      state.feverActive = true;
      FeverUI.setFeverActive(true);
      window.dispatchEvent(new CustomEvent('hha:fever', {
        detail: { state: 'start' }
      }));
    } else if (wasActive && !nowActive) {
      state.feverActive = false;
      FeverUI.setFeverActive(false);
      window.dispatchEvent(new CustomEvent('hha:fever', {
        detail: { state: 'end' }
      }));
    }
  }

  function handleGoodHit(groupKey, worldPos) {
    // simple combo-based judge
    state.combo += 1;
    const FeverUI = getFeverUI();
    if (FeverUI) FeverUI.ensureFeverBar();

    let base = 30;
    let label = 'GOOD';
    if (state.combo >= 15) {
      base = 70;
      label = 'PERFECT';
    } else if (state.combo >= 8) {
      base = 50;
      label = 'GREAT';
    }

    if (state.feverActive) {
      base = Math.round(base * 1.4);
      label = label + ' + FEVER';
    }

    state.score += base;
    updateHUDScore();
    pushJudge(label);
    updateFever(+8);

    updateQuestOnHit(state.questModel, groupKey);

    // FX
    if (worldPos) {
      const Fx3D =
        (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx) || null;
      if (Fx3D && Fx3D.burst) {
        Fx3D.burst(worldPos);
      }
      emitHitUi(worldPos, '+' + base, label, true, state.cameraEl);
    }

    // ถ้าทุก quest ครบแล้ว และยังรันเกมอยู่ → จบเกมเลย
    if (state.questModel.allCompleteFired && state.running) {
      stop('quest-complete');
    }
  }

  function handleBadHit(worldPos) {
    state.combo = 0;
    state.misses += 1;
    updateHUDScore();
    pushJudge('MISS');
    updateFever(-20);

    window.dispatchEvent(new CustomEvent('hha:miss', {}));

    if (worldPos) {
      const Fx3D =
        (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx) || null;
      if (Fx3D && Fx3D.burst) {
        Fx3D.burst(worldPos);
      }
      emitMissUi(worldPos, 'MISS', state.cameraEl);
    }
  }

  function handleExpire(groupKey, isGood, worldPos) {
    // ถ้าปล่อยของดีหายไป = miss
    if (isGood) {
      state.combo = 0;
      state.misses += 1;
      updateHUDScore();
      pushJudge('LATE');
      updateFever(-12);
      window.dispatchEvent(new CustomEvent('hha:miss', {}));

      if (worldPos) {
        const Fx3D =
          (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx) || null;
        if (Fx3D && Fx3D.burst) {
          Fx3D.burst(worldPos);
        }
        emitMissUi(worldPos, 'LATE', state.cameraEl);
      }
    }
    // ถ้าปล่อย junk หายไป = ไม่เป็นไร
  }

  function spawnLoop() {
    if (!state.running) return;
    const { diffCfg, activeTargets, sceneEl, cameraEl } = state;

    // limit targets
    if (activeTargets.length >= (diffCfg.maxActive || 4)) return;

    const t = spawnTarget(
      sceneEl,
      cameraEl,
      diffCfg,
      (hitInfo) => {
        // remove from active list
        state.activeTargets = state.activeTargets.filter(
          t => t.id !== hitInfo.id
        );

        if (hitInfo.isGood && hitInfo.groupKey !== 'junk') {
          handleGoodHit(hitInfo.groupKey, hitInfo.worldPos);
        } else {
          handleBadHit(hitInfo.worldPos);
        }
      },
      (expInfo) => {
        state.activeTargets = state.activeTargets.filter(
          t => t.id !== expInfo.id
        );
        handleExpire(expInfo.groupKey, expInfo.isGood, expInfo.worldPos);
      }
    );

    if (t) {
      state.activeTargets.push(t);
    }
  }

  function tickTime() {
    if (!state.running) return;
    state.secLeft -= 1;
    if (state.secLeft < 0) state.secLeft = 0;

    window.dispatchEvent(new CustomEvent('hha:time', {
      detail: { sec: state.secLeft }
    }));

    if (state.secLeft <= 0) {
      stop('time-up');
    }
  }

  function start(diffKey) {
    if (!A) {
      console.error('[GroupsVR] AFRAME missing');
      return;
    }
    resetState();

    state.diffKey = String(diffKey || 'normal').toLowerCase();
    state.diffCfg = pickDifficulty(state.diffKey);

    const sceneEl = document.querySelector('a-scene');
    const cameraEl = document.querySelector('#gj-camera');

    if (!sceneEl || !cameraEl) {
      console.error('[GroupsVR] scene or camera not found');
      return;
    }
    state.sceneEl = sceneEl;
    state.cameraEl = cameraEl;

    // init 3D FX
    if (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx) {
      window.GAME_MODULES.foodGroupsFx.init(sceneEl);
    }

    // Fever bar
    const FeverUI = getFeverUI();
    if (FeverUI) {
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);
    }

    state.running = true;

    // set initial time (จะถูก override จาก HTML main timer ก็ได้)
    // แต่ส่ง hha:time สักค่าหนึ่งให้ HUD ขยับ
    window.dispatchEvent(new CustomEvent('hha:time', {
      detail: { sec: state.secLeft }
    }));

    // เริ่ม spawn loop
    const interval = state.diffCfg.spawnInterval || 900;
    state.spawnTimer = window.setInterval(spawnLoop, interval);

    // timer วินาที (HTML ก็มีของมันเอง แต่ตัวนี้กันไว้ หากไม่เรียกจากข้างนอก)
    state.secTimer = window.setInterval(tickTime, 1000);

    // เริ่ม quest HUD
    emitQuestUpdate(state.questModel);

    // Coach แรกเข้าเกม
    window.dispatchEvent(new CustomEvent('hha:coach', {
      detail: {
        text: 'แตะอาหารให้ครบทั้ง 5 หมู่ เลี่ยงขนม-น้ำหวานนะ 🍚🥦🍎🍗🥛'
      }
    }));

    updateHUDScore();
  }

  function stop(reason) {
    if (!state.running) return;
    state.running = false;

    if (state.spawnTimer) {
      window.clearInterval(state.spawnTimer);
      state.spawnTimer = null;
    }
    if (state.secTimer) {
      window.clearInterval(state.secTimer);
      state.secTimer = null;
    }

    // เคลียร์เป้า
    state.activeTargets.forEach(t => {
      try {
        t.kill();
      } catch (e) {}
    });
    state.activeTargets = [];

    // summary
    const allGoalsDone = state.questModel.goalsAll.every(g => g.done);
    const allMiniDone = state.questModel.minisAll.every(m => m.done);

    const grade = computeGrade(
      state.score,
      0, // ตอนนี้ยังไม่ได้เก็บ combo สูงสุดแยกไว้
      state.misses,
      state.questModel.goalsAll.filter(g => g.done).length,
      state.questModel.goalsAll.length,
      state.questModel.minisAll.filter(m => m.done).length,
      state.questModel.minisAll.length
    );

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        reason,
        scoreFinal: state.score,
        comboMax: 0,
        misses: state.misses,
        goalsCleared: state.questModel.goalsAll.filter(g => g.done).length,
        goalsTotal: state.questModel.goalsAll.length,
        miniCleared: state.questModel.minisAll.filter(m => m.done).length,
        miniTotal: state.questModel.minisAll.length,
        grade
      }
    }));
  }

  // ใช้เกณฑ์เดียวกับ GoodJunk (แบบย่อ)
  function computeGrade(score, comboMax, misses, goalsCleared, goalsTotal, miniCleared, miniTotal) {
    const allGoalDone = goalsTotal > 0 && goalsCleared >= goalsTotal;
    const allMiniDone = miniTotal > 0 && miniCleared >= miniTotal;
    const allQuest = allGoalDone && allMiniDone;

    if (allQuest && score >= 1200 && comboMax >= 15 && misses <= 1) return 'SSS';
    if (allQuest && score >= 900 && comboMax >= 10 && misses <= 3) return 'SS';
    if (score >= 700) return 'S';
    if (score >= 500) return 'A';
    if (score >= 300) return 'B';
    return 'C';
  }

  return {
    start,
    stop
  };
})();

export { GameEngine };
export default GameEngine;