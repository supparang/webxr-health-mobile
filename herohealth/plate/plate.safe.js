// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — Safe Game Engine (Goal 2 + Mini 3 per game)
// พร้อมระบบหมุนเป้าตามมุมกล้อง (เหมือน GoodJunk-style)
// 2025-12-14

'use strict';

// ---------- Config พื้นฐาน ----------
const QUOTA_MAP = {
  // quota ต่อ "จาน" [หมู่1,2,3,4,5]
  easy:   [1, 1, 1, 1, 1],
  normal: [1, 1, 2, 2, 1],
  hard:   [2, 2, 2, 2, 1]
};

const DIFF_CONFIG = {
  easy: {
    spawnIntervalMs: 1200,
    maxActive: 4,
    junkRatio: 0.30
  },
  normal: {
    spawnIntervalMs: 950,
    maxActive: 5,
    junkRatio: 0.40
  },
  hard: {
    spawnIntervalMs: 800,
    maxActive: 6,
    junkRatio: 0.45
  }
};

// emoji ต่อหมู่ (good) + junk
const GROUP_GOODS = [
  ['🍚','🍙','🍞','🥖'],                  // หมู่ 1
  ['🍗','🥩','🍖','🥚'],                  // หมู่ 2
  ['🥦','🥕','🥗','🫑','🥬'],            // หมู่ 3
  ['🍎','🍌','🍇','🍉','🍓'],            // หมู่ 4
  ['🥛','🧀','🍦','🍨']                  // หมู่ 5
];

const JUNK_ITEMS = [
  '🍟','🍔','🍕','🌭','🥤','🍩','🍪','🍰'
];

// ---------- Helper ----------
function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function shallowQuestView(q) {
  if (!q) return null;
  return {
    id: q.id,
    type: q.type,
    label: q.label,
    target: q.target,
    prog: q.prog || 0,
    done: !!q.done
  };
}

function dispatch(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
}

// ---------- Grade ----------
function computeGrade(score, plates, misses, goalsCleared, goalsTotal, minisCleared, minisTotal) {
  const allGoals = goalsTotal > 0 && goalsCleared >= goalsTotal;
  const allMini  = minisTotal > 0 && minisCleared >= minisTotal;
  const allQuest = allGoals && allMini;

  if (allQuest && score >= 1200 && plates >= 2 && misses <= 1) return 'SSS';
  if (allQuest && score >= 900  && plates >= 2 && misses <= 3) return 'SS';
  if (score >= 700) return 'S';
  if (score >= 500) return 'A';
  if (score >= 300) return 'B';
  return 'C';
}

// ---------- Logger (ให้ hha-cloud-logger จับไปเขียน Google Sheet) ----------
function logEvent(kind, payload) {
  dispatch('hha:event', Object.assign({
    game: 'BalancedPlateVR',
    kind,
    ts: Date.now()
  }, payload || {}));
}

// ---------- Quest builder: Goal 2 + Mini 3 ----------
function buildQuests(diffKey) {
  // จำนวนจานเป้าตามระดับ
  let g1Target = 1;
  let g2Target = 2;
  if (diffKey === 'normal') {
    g1Target = 2;
    g2Target = 3;
  } else if (diffKey === 'hard') {
    g1Target = 2;
    g2Target = 4;
  }

  const goals = [
    {
      id: 'plate-g1',
      type: 'goal',
      label: `จัดจานสมดุลให้ครบ ${g1Target} จาน`,
      metric: 'plates',
      target: g1Target,
      prog: 0,
      done: false
    },
    {
      id: 'plate-g2',
      type: 'goal',
      label: `จัดจานสมดุลให้ครบ ${g2Target} จาน`,
      metric: 'plates',
      target: g2Target,
      prog: 0,
      done: false
    }
  ];

  // Mini: ผัก / ผลไม้ / นม ตาม diff
  const vegTarget   = diffKey === 'easy'   ? 3 : (diffKey === 'hard' ? 6 : 4);
  const fruitTarget = diffKey === 'easy'   ? 2 : (diffKey === 'hard' ? 5 : 3);
  const dairyTarget = diffKey === 'easy'   ? 1 : (diffKey === 'hard' ? 3 : 2);

  const minis = [
    {
      id: 'mini-veg',
      type: 'mini',
      label: `เก็บผัก (หมู่ 3) ให้ได้ ${vegTarget} ชิ้น`,
      metric: 'vegTotal',
      target: vegTarget,
      prog: 0,
      done: false
    },
    {
      id: 'mini-fruit',
      type: 'mini',
      label: `เก็บผลไม้ (หมู่ 4) ให้ได้ ${fruitTarget} ชิ้น`,
      metric: 'fruitTotal',
      target: fruitTarget,
      prog: 0,
      done: false
    },
    {
      id: 'mini-dairy',
      type: 'mini',
      label: `เก็บอาหารหมู่ 5 (นม/ผลิตภัณฑ์นม) ให้ได้ ${dairyTarget} ชิ้น`,
      metric: 'dairyTotal',
      target: dairyTarget,
      prog: 0,
      done: false
    }
  ];

  return { goals, minis };
}

// ---------- Engine ----------
function createEngine(opts) {
  const diffKeyRaw = (opts && opts.difficulty) || 'normal';
  const diffKey = String(diffKeyRaw).toLowerCase();
  const duration = clamp(opts && opts.duration, 20, 180) || 60;

  const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
  const quota = QUOTA_MAP[diffKey] || QUOTA_MAP.normal;

  const questPack = buildQuests(diffKey);
  const goals = questPack.goals;
  const minis = questPack.minis;

  const state = {
    running: false,
    ended: false,
    reason: '',
    diffKey,
    duration,
    timeLeft: duration,

    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,

    platesDone: 0,
    totalCounts: [0, 0, 0, 0, 0],   // รวมทั้งเกม
    plateCounts: [0, 0, 0, 0, 0],   // จานปัจจุบัน

    goals,
    minis,
    allCleared: false,
    grade: 'C'
  };

  const activeTargets = new Set();
  let spawnTimerId = null;
  let timeListener = null;

  // สำหรับซิงค์กับมุมกล้อง
  let camEl = null;
  let lastYaw = 0;
  let yawRafId = null;

  // particles.js (optional)
  function getParticlesAPI() {
    const gm = window.GAME_MODULES || {};
    return gm.Particles || window.Particles || null;
  }

  function coach(text) {
    if (!text) return;
    dispatch('hha:coach', { text });
  }

  // ---------- Camera / Yaw sync เพื่อหมุนเป้าตาม ----------
  function rotateTargetsByYaw(dyaw) {
    if (!dyaw) return;
    const targets = document.querySelectorAll('.hha-target');
    if (!targets.length) return;

    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    const cx = w / 2;
    const cy = h / 2;

    targets.forEach(el => {
      const r = parseFloat(el.dataset.radius || '0');
      if (!r) return;
      let ang = parseFloat(el.dataset.angle || '0');
      ang += dyaw;                 // ใช้ rad ต่อ rad ไปเลย
      el.dataset.angle = String(ang);

      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
    });
  }

  function startYawLoop() {
    if (yawRafId) return;

    // หา camera entity ของ A-Frame
    camEl = document.querySelector('a-entity[camera]') ||
            document.querySelector('a-camera');

    if (!camEl || !camEl.object3D) {
      // ถ้ายังไม่เจอ ลองใหม่อีกนิดหน่อย
      yawRafId = window.requestAnimationFrame(() => {
        yawRafId = null;
        startYawLoop();
      });
      return;
    }

    lastYaw = camEl.object3D.rotation.y || 0;

    function tickYaw() {
      if (!state.running || state.ended) {
        yawRafId = null;
        return;
      }
      if (camEl && camEl.object3D) {
        const rot = camEl.object3D.rotation;
        const y = rot.y || 0;
        const dy = y - lastYaw;
        if (Math.abs(dy) > 0.0001) {
          rotateTargetsByYaw(dy);
          lastYaw = y;
        }
      }
      yawRafId = window.requestAnimationFrame(tickYaw);
    }

    yawRafId = window.requestAnimationFrame(tickYaw);
  }

  function stopYawLoop() {
    if (yawRafId) {
      window.cancelAnimationFrame(yawRafId);
      yawRafId = null;
    }
  }

  // ---------- Target DOM ----------
  function removeTarget(el) {
    if (!el) return;
    activeTargets.delete(el);
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function clearAllTargets() {
    activeTargets.forEach(el => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    activeTargets.clear();
  }

  function spawnTarget() {
    if (!state.running || state.ended) return;
    if (activeTargets.size >= diffCfg.maxActive) return;

    const app = document.querySelector('.app') || document.body;
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;

    const el = document.createElement('div');
    el.className = 'hha-target';

    const isJunk = Math.random() < diffCfg.junkRatio;
    let meta;

    if (!isJunk) {
      // good (เลือกหมู่ 1–5)
      const groupIndex = Math.floor(Math.random() * 5); // 0-4
      const emoji = randItem(GROUP_GOODS[groupIndex]);
      el.textContent = emoji;
      el.classList.add('hha-target-good');
      meta = { good: true, groupIndex };
    } else {
      const emoji = randItem(JUNK_ITEMS);
      el.textContent = emoji;
      el.classList.add('hha-target-bad');
      meta = { good: false, groupIndex: -1 };
    }

    // === ตำแหน่งแบบวงรอบจุดกลางจอ (ให้หมุนตาม yaw ได้) ===
    const cx = w / 2;
    const cy = h / 2;
    const baseR = Math.min(w, h) * 0.34;
    const r = baseR * (0.7 + Math.random() * 0.45);  // กระจายเล็กน้อย

    // angle เริ่มต้นสุ่มทั่ววง + ออฟเซ็ตด้วย yaw ปัจจุบัน (ถ้ามี)
    let yawNow = 0;
    if (camEl && camEl.object3D) {
      yawNow = camEl.object3D.rotation.y || 0;
    }
    let ang = Math.random() * Math.PI * 2 + yawNow;

    el.dataset.radius = String(r);
    el.dataset.angle  = String(ang);

    const x = cx + r * Math.cos(ang);
    const y = cy + r * Math.sin(ang);

    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    el.dataset.good = meta.good ? '1' : '0';
    el.dataset.groupIndex = String(meta.groupIndex);

    // effect เมื่อโดน
    function doHit(userTriggered) {
      if (!state.running || state.ended) return;
      if (el.dataset.hit === '1') return;
      el.dataset.hit = '1';

      const rect = el.getBoundingClientRect();
      const cx2 = rect.left + rect.width / 2;
      const cy2 = rect.top + rect.height / 2;

      removeTarget(el);
      handleHit(meta, cx2, cy2, userTriggered);
    }

    el.addEventListener('click', () => {
      doHit(true);
    });

    // timeout auto-miss เฉพาะ good
    const lifeMs = 1600;
    const timeoutId = setTimeout(() => {
      if (!state.running || state.ended) return;
      if (el.dataset.hit === '1') return;
      clearTimeout(timeoutId);
      if (meta.good) {
        // พลาดของดี
        const rect = el.getBoundingClientRect();
        const cx2 = rect.left + rect.width / 2;
        const cy2 = rect.top + rect.height / 2;
        removeTarget(el);
        handleMissAuto(meta, cx2, cy2);
      } else {
        removeTarget(el);
      }
    }, lifeMs);

    activeTargets.add(el);
    app.appendChild(el);
  }

  function handleHit(meta, x, y, userTriggered) {
    const P = getParticlesAPI();
    if (P && P.burstAt) {
      P.burstAt(x, y, {
        color: meta.good ? '#22c55e' : '#fb7185',
        count: meta.good ? 18 : 10
      });
    }
    if (P && P.scorePop) {
      P.scorePop(x, y, meta.good ? '+100' : '-50', {
        good: !!meta.good,
        judgment: meta.good ? 'GOOD' : 'MISS'
      });
    }

    if (meta.good && meta.groupIndex >= 0 && meta.groupIndex < 5) {
      const g = meta.groupIndex;
      state.score += 100;
      state.combo += 1;
      if (state.combo > state.comboMax) state.comboMax = state.combo;

      state.totalCounts[g] = (state.totalCounts[g] || 0) + 1;
      state.plateCounts[g] = (state.plateCounts[g] || 0) + 1;

      logEvent('hit-good', {
        group: g + 1,
        score: state.score,
        combo: state.combo
      });

      checkPlateComplete();
    } else {
      // junk
      state.score = Math.max(0, state.score - 50);
      state.combo = 0;
      state.misses += 1;

      logEvent('hit-junk', {
        score: state.score,
        misses: state.misses
      });
    }

    updateStatsAndQuests();

    // ถ้าพลาดบ่อย ๆ ให้โค้ชเตือนหน่อย
    if (!meta.good) {
      if (state.misses === 1) {
        coach('ระวังของขยะนะ เลือกเก็บของดี ผัก ผลไม้ และนม แทนของทอดหวาน ๆ 💪');
      } else if (state.misses === 3) {
        coach('พลาดของไม่ดีหลายครั้งแล้ว ลองมองหาสัญลักษณ์หมู่ 1–5 ตามแผนที่ด้านซ้ายดูนะ 👀');
      }
    }
  }

  function handleMissAuto(meta, x, y) {
    const P = getParticlesAPI();
    if (meta.good) {
      if (P && P.scorePop) {
        P.scorePop(x, y, 'MISS', {
          good: false,
          judgment: 'พลาดของดี'
        });
      }
      state.combo = 0;
      state.misses += 1;
      logEvent('auto-miss', {
        good: true,
        misses: state.misses
      });
      updateStatsAndQuests();
    }
  }

  // ---------- Plate / Quest ----------
  function checkPlateComplete() {
    const q = quota;
    let done = true;
    for (let i = 0; i < 5; i++) {
      const need = q[i] || 0;
      if (!need) continue;
      const have = state.plateCounts[i] || 0;
      if (have < need) {
        done = false;
        break;
      }
    }
    if (!done) return;

    state.platesDone += 1;
    logEvent('plate-done', {
      platesDone: state.platesDone
    });

    const P = getParticlesAPI();
    if (P && P.burstAt) {
      const cx = (window.innerWidth || 800) / 2;
      const cy = (window.innerHeight || 600) * 0.75;
      P.burstAt(cx, cy, {
        color: '#22c55e',
        count: 24
      });
    }

    coach(`เยี่ยม! จานสมดุลครบ ${state.platesDone} จานแล้ว 🎉`);

    // reset จานใหม่
    state.plateCounts = [0, 0, 0, 0, 0];

    updateStatsAndQuests();
  }

  function evalMetric(q) {
    switch (q.metric) {
      case 'plates':
        return state.platesDone;
      case 'vegTotal':
        return state.totalCounts[2] || 0; // หมู่ 3
      case 'fruitTotal':
        return state.totalCounts[3] || 0; // หมู่ 4
      case 'dairyTotal':
        return state.totalCounts[4] || 0; // หมู่ 5
      case 'score':
        return state.score || 0;
      default:
        return 0;
    }
  }

  function updateQuests() {
    const newlyCleared = [];

    // update prog + done
    state.goals.forEach(q => {
      const prog = evalMetric(q);
      q.prog = prog;
      if (!q.done && q.target > 0 && prog >= q.target) {
        q.done = true;
        newlyCleared.push(q);
      }
    });

    state.minis.forEach(q => {
      const prog = evalMetric(q);
      q.prog = prog;
      if (!q.done && q.target > 0 && prog >= q.target) {
        q.done = true;
        newlyCleared.push(q);
      }
    });

    const goalsAll = state.goals.map(shallowQuestView);
    const minisAll = state.minis.map(shallowQuestView);

    const goalsCleared = goalsAll.filter(g => g.done);
    const minisCleared = minisAll.filter(m => m.done);

    const currentGoal = goalsAll.find(g => !g.done) || null;
    const currentMini = minisAll.find(m => !m.done) || null;

    // quest:update → HUD panel + quota hint (ฝั่ง plate-vr.html จะจัดการต่อ)
    dispatch('quest:update', {
      goal: currentGoal,
      mini: currentMini,
      goalsAll,
      minisAll
    });

    // quest:cleared → toast ฉลองจบแต่ละภารกิจ
    if (newlyCleared.length > 0) {
      dispatch('quest:cleared', {
        cleared: newlyCleared.map(shallowQuestView),
        goals: goalsAll,
        minis: minisAll
      });

      newlyCleared.forEach(q => {
        logEvent('quest-cleared', {
          questId: q.id,
          questType: q.type
        });
      });
    }

    // ตรวจ all-cleared (Goal 2 + Mini 3 ครบแล้ว)
    const allGoals = goalsAll.length > 0 && goalsCleared.length === goalsAll.length;
    const allMini  = minisAll.length > 0 && minisCleared.length === minisAll.length;
    const allQuest = allGoals && allMini;

    if (allQuest && !state.allCleared) {
      state.allCleared = true;
      // ให้ overlay Mega celebration ทำงาน
      dispatch('hha:all-cleared', {});
      // เกมนี้: ทำครบทุกภารกิจแล้ว "จบเกมเลย"
      endGame('all-quests-cleared');
    }
  }

  // ---------- Stat + End ----------
  function emitStat() {
    const goalsAll = state.goals.map(shallowQuestView);
    const minisAll = state.minis.map(shallowQuestView);
    const goalsCleared = goalsAll.filter(g => g.done).length;
    const minisCleared = minisAll.filter(m => m.done).length;

    const grade = computeGrade(
      state.score,
      state.platesDone,
      state.misses,
      goalsCleared,
      goalsAll.length,
      minisCleared,
      minisAll.length
    );
    state.grade = grade;

    dispatch('hha:stat', {
      score: state.score,
      combo: state.combo,
      misses: state.misses,
      platesDone: state.platesDone,
      grade,
      totalCounts: state.totalCounts.slice(),
      plateCounts: state.plateCounts.slice(),
      allCleared: !!state.allCleared
    });
  }

  function updateStatsAndQuests() {
    emitStat();
    updateQuests();
  }

  function endGame(reason) {
    if (state.ended) return;
    state.ended = true;
    state.running = false;
    state.reason = reason || 'end';

    if (spawnTimerId) {
      clearInterval(spawnTimerId);
      spawnTimerId = null;
    }
    if (timeListener) {
      window.removeEventListener('hha:time', timeListener);
      timeListener = null;
    }
    stopYawLoop();
    clearAllTargets();

    const goalsAll = state.goals.map(shallowQuestView);
    const minisAll = state.minis.map(shallowQuestView);
    const goalsCleared = goalsAll.filter(g => g.done).length;
    const minisCleared = minisAll.filter(m => m.done).length;

    const finalGrade = computeGrade(
      state.score,
      state.platesDone,
      state.misses,
      goalsCleared,
      goalsAll.length,
      minisCleared,
      minisAll.length
    );
    state.grade = finalGrade;

    const payload = {
      mode: 'Balanced Plate',
      difficulty: state.diffKey,
      duration: state.duration,
      reason: state.reason,

      score: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      platesDone: state.platesDone,

      goalsCleared,
      goalsTotal: goalsAll.length,
      questsCleared: minisCleared,
      questsTotal: minisAll.length,

      grade: finalGrade,
      groupCounts: state.totalCounts.slice()
    };

    logEvent('end', payload);
    dispatch('hha:end', payload);
  }

  // ---------- Time listener (จาก plate-vr.html) ----------
  function attachTimeListener() {
    timeListener = function(e) {
      const d = e.detail || {};
      const sec = Number(d.sec);
      if (!Number.isFinite(sec)) return;
      state.timeLeft = sec;
      if (sec <= 0 && !state.ended) {
        endGame('time-up');
      }
    };
    window.addEventListener('hha:time', timeListener);
  }

  // ---------- Public control ----------
  function start() {
    if (state.running || state.ended) return;

    state.running = true;
    logEvent('start', {
      diff: state.diffKey,
      duration: state.duration
    });

    coach('จัดจานให้ครบ 2 Goal และทำ Mini Quest ให้ครบ 3 ภารกิจ แล้วมาดูสรุปผลงานกันนะ! 🎯');

    // initial stat + quest
    emitStat();
    updateQuests();

    attachTimeListener();
    startYawLoop();  // เริ่ม loop หมุนเป้าตาม yaw กล้อง

    spawnTimerId = setInterval(spawnTarget, diffCfg.spawnIntervalMs);
  }

  function stop(reason) {
    endGame(reason || 'manual-stop');
  }

  function destroy() {
    stop('destroy');
  }

  return {
    start,
    stop,
    destroy,
    getState: () => state
  };
}

// ---------- Boot API ----------
export function boot(opts = {}) {
  // ถ้ามี engine เดิมอยู่ให้ destroy ก่อน
  if (window.HHA_PLATE_ENGINE && window.HHA_PLATE_ENGINE.destroy) {
    try {
      window.HHA_PLATE_ENGINE.destroy();
    } catch (err) {
      console.warn('[PlateVR] destroy old engine error:', err);
    }
  }

  const engine = createEngine(opts);
  window.HHA_PLATE_ENGINE = engine;
  engine.start();
}
