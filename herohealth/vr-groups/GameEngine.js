// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji sprite + basic quest + score events)
// ES module version (export GameEngine)

'use strict';

// ----- Difficulty presets -----
const DIFF_PRESET = {
  easy: {
    spawnInterval: 1500,
    lifetime: 2600,
    maxActive: 3,
    scale: 1.3
  },
  normal: {
    spawnInterval: 1100,
    lifetime: 2200,
    maxActive: 4,
    scale: 1.0
  },
  hard: {
    spawnInterval: 800,
    lifetime: 1900,
    maxActive: 5,
    scale: 0.9
  }
};

// ----- State -----
const state = {
  sceneEl: null,
  running: false,
  ended: false,
  diffKey: 'normal',
  config: null,
  targets: [],
  lastTime: 0,
  nextSpawnAt: 0,
  rafId: null,

  // stats
  score: 0,
  combo: 0,
  maxCombo: 0,
  misses: 0,

  // quest
  goalTotalHits: 25,   // ภารกิจหลัก: ตีให้ครบ 25 ชิ้น
  goalHits: 0,
  miniStreakTarget: 6, // Mini quest: ตีติดกันไม่พลาด 6 ชิ้น
  miniBestStreak: 0,
  miniCurrentStreak: 0
};

// helper
function nowMs() {
  return performance.now();
}

// เลือก config จาก diff
function chooseConfig(diffKey) {
  const k = String(diffKey || 'normal').toLowerCase();
  return DIFF_PRESET[k] || DIFF_PRESET.normal;
}

// เลือก emoji sprite สำหรับอาหาร 5 หมู่ (อ้างจาก <a-assets> ใน groups-vr.html)
function pickGroupSprite() {
  const groupId = 1 + Math.floor(Math.random() * 5); // 1..5
  const idx = 1 + Math.floor(Math.random() * 7);     // 1..7
  const assetId = `#fg-g${groupId}-${idx}`;
  return { groupId, assetId };
}

// ส่ง event ไป HUD / logger
function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

// อัปเดต quest HUD
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
    hint: 'สลับตีให้ครบทุกหมู่ทั้ง 5 หมู่ 🍚🥩🥦🍎🥛'
  });
}

// อัปเดตคะแนน HUD
function updateScoreHUD() {
  emit('hha:score', {
    score: state.score,
    combo: state.combo,
    misses: state.misses
  });
}

// เมื่อพลาดเป้า (หมดเวลา)
function registerMiss() {
  state.misses += 1;
  state.combo = 0;
  state.miniCurrentStreak = 0;

  emit('hha:miss', {});
  updateScoreHUD();
  emit('hha:judge', { label: 'MISS' });
}

// เมื่อโดนเป้า
function registerHit(groupId) {
  // คะแนนแบบง่าย ๆ
  state.combo += 1;
  state.score += 100;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;

  state.goalHits += 1;
  state.miniCurrentStreak += 1;
  if (state.miniCurrentStreak > state.miniBestStreak) {
    state.miniBestStreak = state.miniCurrentStreak;
  }

  // FEVER เล็ก ๆ (แค่แจ้ง event ถ้า combo สูง)
  if (state.combo === 5) {
    emit('hha:fever', { state: 'start' });
  } else if (state.combo === 0 && state.misses > 0) {
    emit('hha:fever', { state: 'end' });
  }

  const judgeLabel = state.combo >= 8 ? 'PERFECT!' : (state.combo >= 3 ? 'GOOD' : 'OK');
  emit('hha:judge', { label: judgeLabel });

  updateScoreHUD();
  updateQuestHUD();
}

// ลบเป้าออกจาก scene + list
function removeTarget(t) {
  try {
    if (t && t.el && t.el.parentNode) {
      t.el.parentNode.removeChild(t.el);
    }
  } catch (_) {}
}

// spawn เป้าใหม่
function spawnTarget(now) {
  if (!state.sceneEl) return;
  if (!state.config) return;

  // จำกัดจำนวนเป้าพร้อมกัน
  if (state.targets.length >= state.config.maxActive) return;

  const { groupId, assetId } = pickGroupSprite();

  const el = document.createElement('a-image');
  el.setAttribute('src', assetId);
  el.setAttribute('width', 1.2 * state.config.scale);
  el.setAttribute('height', 1.2 * state.config.scale);
  el.setAttribute('data-hha-tgt', '1');

  // random position ด้านหน้า
  const x = -2.2 + Math.random() * 4.4;   // -2.2..2.2
  const y = 1.0 + Math.random() * 1.4;    // 1.0..2.4
  const z = -3.0 - Math.random() * 1.0;   // -3..-4
  el.setAttribute('position', `${x} ${y} ${z}`);

  // ให้หันหน้าหากล้อง (ถ้ามี component look-at โหลดไว้)
  // el.setAttribute('look-at', '#gj-camera');

  const targetData = {
    el,
    createdAt: now,
    expireAt: now + state.config.lifetime,
    groupId
  };

  el.classList.add('hh-target');

  // คลิกเพื่อเก็บเป้า
  el.addEventListener('click', () => {
    if (!state.running) return;
    // ลบออกจาก list + scene
    state.targets = state.targets.filter(tt => tt !== targetData);
    removeTarget(targetData);
    registerHit(groupId);
  });

  state.sceneEl.appendChild(el);
  state.targets.push(targetData);
}

// main loop
function tickLoop(ts) {
  if (!state.running) return;

  if (!state.lastTime) state.lastTime = ts;
  const now = ts;
  // spawn ตามเวลา
  if (now >= state.nextSpawnAt) {
    spawnTarget(now);
    state.nextSpawnAt = now + state.config.spawnInterval;
  }

  // เช็คหมดอายุ
  const stillAlive = [];
  for (const t of state.targets) {
    if (now >= t.expireAt) {
      // หมดเวลา = MISS
      removeTarget(t);
      registerMiss();
    } else {
      // อนิเมชันเล็ก ๆ (เด้งขึ้นลง)
      const lifeT = (now - t.createdAt) / 1000;
      const posStr = t.el.getAttribute('position');
      if (posStr) {
        const parts = String(posStr).split(' ').map(Number);
        if (parts.length === 3 && !Number.isNaN(parts[0])) {
          const amp = 0.06;
          const ny = parts[1] + Math.sin(lifeT * 6.0) * amp * 0.02; // ripple เบา ๆ
          t.el.setAttribute('position', `${parts[0]} ${ny} ${parts[2]}`);
        }
      }
      stillAlive.push(t);
    }
  }
  state.targets = stillAlive;

  state.rafId = window.requestAnimationFrame(tickLoop);
}

// ----- Public API -----
function start(diffKey) {
  // ถ้ากำลังเล่นอยู่ให้หยุดก่อน
  if (state.running) {
    stop('restart');
  }

  state.sceneEl = document.querySelector('a-scene');
  if (!state.sceneEl) {
    console.error('[GroupsVR] no <a-scene> found');
    return;
  }

  state.diffKey = String(diffKey || 'normal').toLowerCase();
  state.config = chooseConfig(state.diffKey);

  // reset state
  state.running = true;
  state.ended = false;
  state.targets.forEach(removeTarget);
  state.targets = [];
  state.lastTime = 0;
  state.nextSpawnAt = nowMs() + 400; // รอแพล็บหนึ่งก่อน spawn แรก

  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.misses = 0;

  state.goalHits = 0;
  state.miniCurrentStreak = 0;
  state.miniBestStreak = 0;

  updateScoreHUD();
  updateQuestHUD();
  emit('hha:judge', { label: '' });

  if (state.rafId) {
    window.cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  state.rafId = window.requestAnimationFrame(tickLoop);

  console.log('[GroupsVR] GameEngine.start()', state.diffKey, state.config);
}

function stop(reason) {
  if (!state.running && state.ended) return;

  state.running = false;

  if (state.rafId) {
    window.cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }

  // ลบเป้าที่เหลือ
  state.targets.forEach(removeTarget);
  state.targets = [];

  if (!state.ended) {
    state.ended = true;
    // summary event
    emit('hha:end', {
      reason: reason || 'stop',
      scoreFinal: state.score,
      score: state.score,
      comboMax: state.maxCombo,
      misses: state.misses,
      goalsCleared: state.goalHits,
      goalsTotal: state.goalTotalHits,
      miniCleared: (state.miniBestStreak >= state.miniStreakTarget ? 1 : 0),
      miniTotal: 1
    });
  }

  emit('hha:fever', { state: 'end' });
  console.log('[GroupsVR] GameEngine.stop()', reason);
}

// ----- Export -----
export const GameEngine = {
  start,
  stop
};
