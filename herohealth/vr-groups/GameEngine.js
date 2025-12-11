// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — big sphere + emoji text + quest + fever
// 2025-12-10f

'use strict';

const A = window.AFRAME;
if (!A) {
  console.error('[GroupsVR] AFRAME not found');
}

// ---------- Utils ----------
function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function pickDifficulty(diffKey) {
  diffKey = String(diffKey || 'normal').toLowerCase();

  if (window.foodGroupsDifficulty && typeof window.foodGroupsDifficulty.get === 'function') {
    return window.foodGroupsDifficulty.get(diffKey);
  }

  if (diffKey === 'easy') {
    return { spawnInterval: 1200, lifeMs: 2600, scale: 1.2, maxActive: 3, goodRatio: 0.85 };
  }
  if (diffKey === 'hard') {
    return { spawnInterval: 700, lifeMs: 1900, scale: 0.9, maxActive: 5, goodRatio: 0.7 };
  }
  return { // normal
    spawnInterval: 900, lifeMs: 2200, scale: 1.0, maxActive: 4, goodRatio: 0.8
  };
}

// ---------- food pools ----------
const FOOD_GROUPS = {
  grains:  ['🍚', '🍞', '🥖', '🥯', '🥐', '🥨'],
  veg:     ['🥦', '🥕', '🌽', '🥒', '🫑', '🥬'],
  fruit:   ['🍎', '🍌', '🍇', '🍉', '🍊', '🍓'],
  protein: ['🍗', '🥚', '🥩', '🍖', '🍤', '🍣'],
  dairy:   ['🥛', '🧀', '🍨', '🍦'],
  junk:    ['🍩', '🍫', '🥤', '🍟', '🍕', '🧁']
};
const GROUP_KEYS = ['grains', 'veg', 'fruit', 'protein', 'dairy'];

// ---------- world → screen (ใช้กับ FX 2D) ----------
function worldToScreen(worldPos, cameraEl) {
  if (!worldPos || !cameraEl) return null;
  const THREE = window.THREE || (A && A.THREE);
  if (!THREE) return null;

  const camObj = cameraEl.getObject3D('camera');
  if (!camObj) return null;

  const v = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
  v.project(camObj);

  const x = (v.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  return { x, y };
}

function emitHitUi(worldPos, scoreDelta, judgment, good, cameraEl) {
  const scr = worldToScreen(worldPos, cameraEl) || {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  };
  window.dispatchEvent(new CustomEvent('hha:hit-ui', {
    detail: { x: scr.x, y: scr.y, scoreDelta, judgment, good: !!good }
  }));
}

function emitMissUi(worldPos, label, cameraEl) {
  const scr = worldToScreen(worldPos, cameraEl) || {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  };
  window.dispatchEvent(new CustomEvent('hha:miss-ui', {
    detail: { x: scr.x, y: scr.y, judgment: label || 'MISS' }
  }));
}

// ---------- Quest model ----------
function createQuestModel() {
  const goalsAll = [
    {
      id: 'balanced5',
      label: 'เลือกอาหารครบทั้ง 5 หมู่ให้ได้อย่างน้อย 1 ครั้ง',
      target: 5,
      prog: 0,
      done: false,
      hitSet: new Set()
    },
    {
      id: 'goodHits',
      label: 'สะสมอาหารดีให้ครบ 25 ชิ้น',
      target: 25,
      prog: 0,
      done: false
    }
  ];

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

  return { goalsAll, minisAll, allCompleteFired: false };
}

function emitQuestUpdate(model) {
  const currentGoal = model.goalsAll.find(g => !g.done) || null;
  const currentMini = model.minisAll.find(m => !m.done) || null;

  window.dispatchEvent(new CustomEvent('quest:update', {
    detail: {
      goal: currentGoal ? {
        label: currentGoal.label,
        prog: currentGoal.prog,
        target: currentGoal.target
      } : null,
      mini: currentMini ? {
        label: currentMini.label,
        prog: currentMini.prog,
        target: currentMini.target
      } : null,
      goalsAll: model.goalsAll.map(g => ({
        label: g.label, target: g.target, prog: g.prog, done: g.done
      })),
      minisAll: model.minisAll.map(m => ({
        label: m.label, target: m.target, prog: m.prog, done: m.done
      })),
      hint: currentGoal
        ? 'โฟกัสภารกิจหลักให้ครบ แล้วเก็บ mini quest ไปด้วยนะ'
        : 'ทุกภารกิจหลักครบแล้ว ลุย mini quest ที่เหลือให้ครบเลย!'
    }
  }));
}

function emitQuestCelebrate(kind, index, total) {
  window.dispatchEvent(new CustomEvent('quest:celebrate', {
    detail: { kind, index, total }
  }));
}

function emitQuestAllComplete(model) {
  window.dispatchEvent(new CustomEvent('quest:all-complete', {
    detail: {
      goalsTotal: model.goalsAll.length,
      minisTotal: model.minisAll.length
    }
  }));
}

function updateQuestOnHit(model, groupKey) {
  const g1 = model.goalsAll[0];
  if (g1 && !g1.done && groupKey && GROUP_KEYS.includes(groupKey)) {
    if (!g1.hitSet.has(groupKey)) {
      g1.hitSet.add(groupKey);
      g1.prog = g1.hitSet.size;
      if (g1.prog >= g1.target) {
        g1.done = true;
        emitQuestCelebrate('goal', 1, model.goalsAll.length);
      }
    }
  }

  const g2 = model.goalsAll[1];
  if (g2 && !g2.done) {
    g2.prog += 1;
    if (g2.prog >= g2.target) {
      g2.done = true;
      emitQuestCelebrate('goal', 2, model.goalsAll.length);
    }
  }

  const m1 = model.minisAll[0];
  if (m1 && !m1.done && groupKey === 'grains') {
    m1.prog += 1;
    if (m1.prog >= m1.target) {
      m1.done = true;
      emitQuestCelebrate('mini', 1, model.minisAll.length);
    }
  }

  const m2 = model.minisAll[1];
  if (m2 && !m2.done && (groupKey === 'veg' || groupKey === 'fruit')) {
    m2.prog += 1;
    if (m2.prog >= m2.target) {
      m2.done = true;
      emitQuestCelebrate('mini', 2, model.minisAll.length);
    }
  }

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

// ---------- Fever UI ----------
function getFeverUI() {
  return (window.GAME_MODULES && window.GAME_MODULES.FeverUI) || window.FeverUI || null;
}

// ---------- Target spawning ----------
let TARGET_ID = 0;

function pickFood(diffCfg) {
  const r = Math.random();
  const goodRatio = typeof diffCfg.goodRatio === 'number' ? diffCfg.goodRatio : 0.8;
  if (r > goodRatio) {
    const pool = FOOD_GROUPS.junk;
    const ch = pool[Math.floor(Math.random() * pool.length)];
    return { ch, groupKey: 'junk', isGood: false };
  }

  const groupKey = GROUP_KEYS[Math.floor(Math.random() * GROUP_KEYS.length)];
  const pool = FOOD_GROUPS[groupKey];
  const ch = pool[Math.floor(Math.random() * pool.length)];
  return { ch, groupKey, isGood: true };
}

function spawnTarget(sceneEl, cameraEl, diffCfg, onHitCb, onExpireCb) {
  if (!sceneEl || !cameraEl || !A) return null;

  const pick = pickFood(diffCfg);
  const sizeFactor = diffCfg.scale || 1.0;
  const targetId = ++TARGET_ID;

  const holder = document.createElement('a-entity');
  holder.setAttribute('data-hha-tgt', '1');
  holder.setAttribute('data-tgt-id', String(targetId));
  holder.setAttribute('data-group', pick.groupKey);
  holder.classList.add('groups-target');

  // ลูกบอล
  const sphere = document.createElement('a-sphere');
  const baseColor = pick.isGood ? '#16a34a' : '#f97316';
  const radius = 0.35 * sizeFactor;
  sphere.setAttribute('radius', radius);
  sphere.setAttribute(
    'material',
    `color: ${baseColor}; opacity: 0.9; metalness: 0; roughness: 1`
  );
  sphere.setAttribute('data-hha-tgt', '1');
  holder.appendChild(sphere);

  // --- emoji ด้วย A-Frame text ---
  const label = document.createElement('a-entity');
  label.setAttribute('data-hha-tgt', '1');
  label.setAttribute('position', `0 0 ${radius + 0.02}`);
  label.setAttribute(
    'text',
    `value: ${pick.ch}; align: center; color: #ffffff; width: 2.5`
  );
  holder.appendChild(label);

  // ตำแหน่งด้านหน้า player
  const x = -0.9 + Math.random() * 1.8;
  const y = 1.0 + Math.random() * 0.4;
  const z = -2.2;
  holder.setAttribute('position', `${x} ${y} ${z}`);

  sceneEl.appendChild(holder);

  // ให้ raycaster รู้จัก
  const cursor = document.querySelector('#cursor');
  if (cursor && cursor.components && cursor.components.raycaster) {
    try {
      cursor.components.raycaster.refreshObjects();
    } catch (err) {
      console.warn('[GroupsVR] raycaster.refreshObjects error:', err);
    }
  }

  const THREE = window.THREE || (A && A.THREE);
  function getWorldPosSafe() {
    const obj = holder.object3D;
    if (!obj || !THREE || !obj.getWorldPosition) return null;
    const v = new THREE.Vector3();
    obj.getWorldPosition(v);
    return { x: v.x, y: v.y, z: v.z };
  }

  let killed = false;
  const bornAt = performance.now();
  const lifeMs = Number(diffCfg.lifeMs) > 0 ? Number(diffCfg.lifeMs) : 2200;

  function cleanup(reason) {
    if (killed) return;
    killed = true;

    if (holder.parentNode) holder.parentNode.removeChild(holder);

    if (reason === 'expire' && typeof onExpireCb === 'function') {
      const wp = getWorldPosSafe();
      onExpireCb({
        id: targetId,
        groupKey: pick.groupKey,
        isGood: pick.isGood,
        bornAt,
        lifeMs,
        worldPos: wp
      });
    }
  }

  const timerId = setTimeout(() => cleanup('expire'), lifeMs);

  function handleClick() {
    if (killed) return;
    clearTimeout(timerId);
    const wp = getWorldPosSafe();
    if (typeof onHitCb === 'function') {
      onHitCb({
        id: targetId,
        groupKey: pick.groupKey,
        isGood: pick.isGood,
        worldPos: wp
      });
    }
    cleanup('hit');
  }

  function handleClickWrapper() {
    handleClick();
  }

  holder.addEventListener('click', handleClick);
  sphere.addEventListener('click', handleClickWrapper);
  label.addEventListener('click', handleClickWrapper);

  console.log('[GroupsVR] spawn target', pick.ch, pick.groupKey, 'good=', pick.isGood);

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

// ---------- GameEngine ----------
const GameEngine = (function () {
  let state = null;

  function resetState() {
    state = {
      diffKey: 'normal',
      diffCfg: pickDifficulty('normal'),
      sceneEl: null,
      cameraEl: null,
      spawnTimer: null,
      activeTargets: [],
      running: false,
      score: 0,
      combo: 0,
      comboMax: 0,
      misses: 0,
      fever: 0,
      feverActive: false,
      questModel: createQuestModel()
    };
  }
  resetState();

  function updateHUDScore() {
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: { score: state.score, combo: state.combo, misses: state.misses }
    }));
  }

  function pushJudge(label) {
    window.dispatchEvent(new CustomEvent('hha:judge', { detail: { label } }));
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
      window.dispatchEvent(new CustomEvent('hha:fever', { detail: { state: 'start' } }));
    } else if (wasActive && !nowActive) {
      state.feverActive = false;
      FeverUI.setFeverActive(false);
      window.dispatchEvent(new CustomEvent('hha:fever', { detail: { state: 'end' } }));
    }
  }

  function handleGoodHit(groupKey, worldPos) {
    state.combo += 1;
    if (state.combo > state.comboMax) state.comboMax = state.combo;

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
      label += ' + FEVER';
    }

    state.score += base;
    updateHUDScore();
    pushJudge(label);
    updateFever(+8);

    updateQuestOnHit(state.questModel, groupKey);

    if (worldPos) {
      const Fx3D = (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx) || null;
      if (Fx3D && Fx3D.burst) Fx3D.burst(worldPos);
    }
    emitHitUi(worldPos || null, '+' + base, label, true, state.cameraEl);

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
      const Fx3D = (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx) || null;
      if (Fx3D && Fx3D.burst) Fx3D.burst(worldPos);
    }
    emitMissUi(worldPos || null, 'MISS', state.cameraEl);
  }

  function handleExpire(groupKey, isGood, worldPos) {
    if (isGood) {
      state.combo = 0;
      state.misses += 1;
      updateHUDScore();
      pushJudge('LATE');
      updateFever(-12);
      window.dispatchEvent(new CustomEvent('hha:miss', {}));

      if (worldPos) {
        const Fx3D = (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx) || null;
        if (Fx3D && Fx3D.burst) Fx3D.burst(worldPos);
      }
      emitMissUi(worldPos || null, 'LATE', state.cameraEl);
    }
  }

  function spawnLoop() {
    if (!state.running) return;
    const { diffCfg, sceneEl, cameraEl } = state;
    const maxActive = diffCfg.maxActive || 4;
    if (state.activeTargets.length >= maxActive) return;

    const t = spawnTarget(
      sceneEl,
      cameraEl,
      diffCfg,
      (hitInfo) => {
        state.activeTargets = state.activeTargets.filter(x => x.id !== hitInfo.id);
        if (hitInfo.isGood && hitInfo.groupKey !== 'junk') {
          handleGoodHit(hitInfo.groupKey, hitInfo.worldPos || null);
        } else {
          handleBadHit(hitInfo.worldPos || null);
        }
      },
      (expInfo) => {
        state.activeTargets = state.activeTargets.filter(x => x.id !== expInfo.id);
        handleExpire(expInfo.groupKey, expInfo.isGood, expInfo.worldPos || null);
      }
    );

    if (t) state.activeTargets.push(t);
  }

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

    if (window.GAME_MODULES && window.GAME_MODULES.foodGroupsFx) {
      window.GAME_MODULES.foodGroupsFx.init(sceneEl);
    }

    const FeverUI = getFeverUI();
    if (FeverUI) {
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);
    }

    state.running = true;

    emitQuestUpdate(state.questModel);
    window.dispatchEvent(new CustomEvent('hha:coach', {
      detail: {
        text: 'แตะอาหารให้ครบทั้ง 5 หมู่ เลี่ยงขนม-น้ำหวานนะ 🍚🥦🍎🍗🥛'
      }
    }));

    updateHUDScore();

    const interval = state.diffCfg.spawnInterval || 900;
    state.spawnTimer = window.setInterval(spawnLoop, interval);
  }

  function stop(reason) {
    if (!state.running) return;
    state.running = false;

    if (state.spawnTimer) {
      window.clearInterval(state.spawnTimer);
      state.spawnTimer = null;
    }

    state.activeTargets.forEach(t => {
      try { t.kill(); } catch (e) {}
    });
    state.activeTargets = [];

    const goalsCleared = state.questModel.goalsAll.filter(g => g.done).length;
    const goalsTotal = state.questModel.goalsAll.length;
    const miniCleared = state.questModel.minisAll.filter(m => m.done).length;
    const miniTotal   = state.questModel.minisAll.length;

    const grade = computeGrade(
      state.score,
      state.comboMax,
      state.misses,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal
    );

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        reason,
        scoreFinal: state.score,
        comboMax: state.comboMax,
        misses: state.misses,
        goalsCleared,
        goalsTotal,
        miniCleared,
        miniTotal,
        grade
      }
    }));
  }

  return { start, stop };
})();

export { GameEngine };
export default GameEngine;