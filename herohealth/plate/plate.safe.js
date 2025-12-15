// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — DOM Emoji Targets + Quests + Cloud Logger hooks
// ใช้คู่กับ plate-vr.html (A-Frame scene + HUD + hha-cloud-logger.js)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document || null;

// ---------- Helpers ----------
function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
function pickOne(arr, fallback = null) {
  if (!Array.isArray(arr) || !arr.length) return fallback;
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Difficulty (ขนาดเป้า / จำนวนเป้า / อายุเป้า) ----------
const BASE_DIFF = {
  easy: {
    spawnInterval: 1100,
    life: 1900,
    scale: 1.15,
    maxActive: 3
  },
  normal: {
    spawnInterval: 900,
    life: 1700,
    scale: 1.00,
    maxActive: 4
  },
  hard: {
    spawnInterval: 750,
    life: 1500,
    scale: 0.88,
    maxActive: 5
  }
};

function pickDifficulty(diffKey) {
  diffKey = String(diffKey || 'normal').toLowerCase();
  return BASE_DIFF[diffKey] || BASE_DIFF.normal;
}

// ---------- Emoji item pool (5 หมู่ + junk) ----------
const ITEM_POOL = {
  1: { // ข้าว-แป้ง
    good: ['🍚','🍞','🥖','🥯','🥐'],
    junk: ['🍩','🧁']
  },
  2: { // โปรตีน
    good: ['🍗','🥚','🍖','🍤','🥩'],
    junk: ['🍔','🌭']
  },
  3: { // ผัก
    good: ['🥦','🥕','🥬','🫛','🍅'],
    junk: ['🍟']
  },
  4: { // ผลไม้
    good: ['🍎','🍌','🍇','🍉','🍓'],
    junk: ['🍰','🍧']
  },
  5: { // นม / ผลิตภัณฑ์นม
    good: ['🥛','🧀','🍶','🍼'],
    junk: ['🍦','🍨']
  }
};

// ---------- FEVER + Particle (ใช้ global ถ้ามี, ถ้าไม่มีก็ no-op) ----------
const FeverUI = (() => {
  const gm = (ROOT.GAME_MODULES || {});
  const f  = gm.FeverUI || ROOT.FeverUI || {};
  return {
    ensureFeverBar: f.ensureFeverBar ? f.ensureFeverBar.bind(f) : () => {},
    setFever:       f.setFever       ? f.setFever.bind(f)       : () => {},
    setFeverActive: f.setFeverActive ? f.setFeverActive.bind(f) : () => {},
    setShield:      f.setShield      ? f.setShield.bind(f)      : () => {}
  };
})();

const Particles = (() => {
  const gm = (ROOT.GAME_MODULES || {});
  const p  = gm.Particles || ROOT.Particles || {};
  return {
    burstAt:  p.burstAt  ? p.burstAt.bind(p)  : () => {},
    scorePop: p.scorePop ? p.scorePop.bind(p) : () => {}
  };
})();

// ---------- Quest templates ----------
function createQuestTemplates(stateRef) {
  // stateRef = object ที่มี field: platesDone, totalCounts[], misses เป็นต้น
  const templates = {
    goals: [
      {
        key: 'plates3',
        text: 'จัดจานสมดุลให้ครบ 3 จาน',
        getProg: () => stateRef.platesDone,
        target: 3,
        hint: 'สะสมให้ครบ 5 หมู่แล้วเสิร์ฟ 1 จาน'
      },
      {
        key: 'veg10',
        text: 'เก็บผัก (หมู่ 3) ให้ได้ 10 ชิ้น',
        getProg: () => stateRef.totalCounts[2],
        target: 10,
        hint: 'โฟกัสผักสีเขียวก่อนเลย 🥦'
      },
      {
        key: 'fruit8',
        text: 'เก็บผลไม้ (หมู่ 4) ให้ได้ 8 ชิ้น',
        getProg: () => stateRef.totalCounts[3],
        target: 8,
        hint: 'ผลไม้ช่วยเพิ่มสีสันให้จาน 🍎'
      },
      {
        key: 'protein8',
        text: 'เก็บโปรตีน (หมู่ 2) ให้ได้ 8 ชิ้น',
        getProg: () => stateRef.totalCounts[1],
        target: 8,
        hint: 'อย่างน้อยหนึ่งอย่างในทุกจาน'
      }
    ],
    minis: [
      {
        key: 'milk5',
        text: 'เก็บนม/ผลิตภัณฑ์นม 5 ชิ้น',
        getProg: () => stateRef.totalCounts[4],
        target: 5,
        hint: 'อย่าลืมกลุ่มนมด้วย 🥛'
      },
      {
        key: 'vegNoMiss',
        text: 'เก็บผัก 6 ชิ้น โดย MISS ไม่เกิน 3',
        getProg: () => stateRef.totalCounts[2],
        target: 6,
        extraCheck: () => stateRef.misses <= 3,
        hint: 'พยายามอย่าให้ของดีหลุดจาน'
      },
      {
        key: 'fruitCombo',
        text: 'ทำคอมโบให้ถึง 8 ครั้ง',
        getProg: () => stateRef.comboMax,
        target: 8,
        hint: 'ตีให้ต่อเนื่องจะได้คอมโบสูง ๆ'
      },
      {
        key: 'missLimit',
        text: 'อย่าให้ MISS เกิน 5 ครั้ง',
        getProg: () => Math.max(0, 5 - stateRef.misses),
        target: 5,
        isReverse: true,
        hint: 'โฟกัสเล็งดี ๆ ลดของเสียเข้าจาน'
      }
    ]
  };
  return templates;
}

// ---------- สร้างชุด Quest ตามโหมด ----------
function buildQuests(runMode, stateRef) {
  const templates = createQuestTemplates(stateRef);
  let goalsAll, minisAll;

  if (runMode === 'research') {
    // โหมดวิจัย:ชุด fix เสมอ (Goal 2 + Mini 3)
    goalsAll = [
      templates.goals.find(g => g.key === 'plates3'),
      templates.goals.find(g => g.key === 'veg10')
    ].filter(Boolean);

    minisAll = [
      templates.minis.find(m => m.key === 'milk5'),
      templates.minis.find(m => m.key === 'fruitCombo'),
      templates.minis.find(m => m.key === 'missLimit')
    ].filter(Boolean);
  } else {
    // โหมดเล่นธรรมดา:สุ่ม Goal 2 / Mini 3
    const gShuffled = shuffle(templates.goals);
    const mShuffled = shuffle(templates.minis);
    goalsAll = gShuffled.slice(0, 2);
    minisAll = mShuffled.slice(0, 3);
  }

  // แปลงเป็น object ที่มี prog / done
  const wrap = (q) => ({
    key: q.key,
    text: q.text,
    target: q.target,
    prog: 0,
    done: false,
    hint: q.hint || '',
    _getProg: q.getProg,
    _extraCheck: q.extraCheck || null,
    _isReverse: !!q.isReverse
  });

  return {
    goalsAll: goalsAll.map(wrap),
    minisAll: minisAll.map(wrap)
  };
}

// ---------- Engine main ----------
export function boot(opts = {}) {
  if (!DOC) {
    console.error('[PlateVR] document not available');
    return;
  }

  const diffKey = (opts.difficulty || opts.diff || 'normal').toLowerCase();
  const diffConf = pickDifficulty(diffKey);

  const runModeRaw = (ROOT.HHA_RUNMODE || opts.runMode || opts.mode || 'play');
  const runMode = String(runModeRaw || 'play').toLowerCase() === 'research'
    ? 'research'
    : 'play';

  const adaptive = (runMode === 'play'); // ปรับขนาดเป้าเฉพาะโหมดเล่นธรรมดา

  const durationSec = clamp(opts.duration || opts.durationSec || 60, 20, 180);

  const sessionId   = 'plate-' + Date.now().toString(36);
  const gameVersion = 'HeroHealth-PlateVR-2025-12-15';

  // FEVER bar
  try {
    FeverUI.ensureFeverBar({
      key: 'plate',
      label: 'Balanced Plate FEVER'
    });
  } catch (_) {}

  let feverValue   = 0;
  let feverActive  = false;
  let shieldCount  = (runMode === 'research') ? 0 : 3; // โหมดวิจัยไม่เน้น shield ก็ได้
  FeverUI.setShield(shieldCount);
  FeverUI.setFever(0);
  FeverUI.setFeverActive(false);

  // --------- Game state ---------
  const state = {
    timeLeft: durationSec,
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,
    platesDone: 0,
    // totalCounts[0..4] = หมู่ 1..5
    totalCounts: [0, 0, 0, 0, 0],
    currentPlateCounts: [0, 0, 0, 0, 0],

    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nHitGood: 0,
    nHitJunk: 0,
    nExpireGood: 0,

    startTimeIso: new Date().toISOString(),
    endTimeIso: '',
    ended: false
  };

  // Quests
  const { goalsAll, minisAll } = buildQuests(runMode, state);
  let goalsCleared = 0;
  let minisCleared = 0;

  // difficulty ปัจจุบัน (ปรับได้ถ้า adaptive)
  let spawnInterval = diffConf.spawnInterval;
  let targetLife    = diffConf.life;
  let targetScale   = diffConf.scale;
  const maxActive   = diffConf.maxActive;

  // เป้าในจอ
  let nextTargetId = 1;
  const activeTargets = new Map(); // id -> { ... }

  // สำหรับ timeFromStartMs
  const startMs = (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();

  // --------- Utility: FEVER & Shield ----------
  function applyFever(delta) {
    feverValue = clamp(feverValue + delta, 0, 100);
    FeverUI.setFever(feverValue);

    const shouldActive = feverValue >= 60;
    if (shouldActive !== feverActive) {
      feverActive = shouldActive;
      FeverUI.setFeverActive(feverActive);
    }
  }

  function useShield() {
    if (shieldCount <= 0) return false;
    shieldCount -= 1;
    FeverUI.setShield(shieldCount);
    return true;
  }

  // --------- Quests & HUD events ----------
  function recomputeQuests() {
    function updateList(list) {
      list.forEach(q => {
        const rawProg = typeof q._getProg === 'function'
          ? Number(q._getProg() || 0)
          : 0;
        let prog = rawProg;
        if (q._isReverse) {
          // เช่น MISS limit → prog = 5 - misses
          prog = clamp(rawProg, 0, q.target);
        }
        const extraOK = q._extraCheck ? !!q._extraCheck() : true;
        q.prog = clamp(prog, 0, q.target);
        q.done = extraOK && (q.prog >= q.target);
      });
    }

    updateList(goalsAll);
    updateList(minisAll);

    goalsCleared = goalsAll.filter(q => q.done).length;
    minisCleared = minisAll.filter(q => q.done).length;
  }

  function emitQuestUpdate() {
    recomputeQuests();

    const payload = {
      goalsAll: goalsAll.map(q => ({
        key: q.key,
        text: q.text,
        target: q.target,
        prog: q.prog,
        done: q.done,
        hint: q.hint || ''
      })),
      minisAll: minisAll.map(q => ({
        key: q.key,
        text: q.text,
        target: q.target,
        prog: q.prog,
        done: q.done,
        hint: q.hint || ''
      }))
    };

    const evt = new CustomEvent('quest:update', { detail: payload });
    ROOT.dispatchEvent(evt);
  }

  // --------- Stats event ----------
  function emitStat() {
    const detail = {
      score: state.score,
      combo: state.combo,
      misses: state.misses,
      platesDone: state.platesDone,
      totalCounts: state.totalCounts.slice(),

      goalsTotal: goalsAll.length,
      goalsCleared: goalsCleared,
      questsTotal: minisAll.length,
      questsCleared: minisCleared
    };

    ROOT.dispatchEvent(new CustomEvent('hha:stat', { detail }));
  }

  // --------- Session summary for hha:session / hha:end ----------
  function buildSummary(reason) {
    recomputeQuests();
    const summary = {
      sessionId,
      mode: 'BalancedPlateVR',
      difficulty: diffKey,
      durationSecPlanned: durationSec,
      durationSecPlayed: durationSec - Math.max(0, state.timeLeft),

      scoreFinal: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      platesDone: state.platesDone,

      goalsCleared,
      goalsTotal: goalsAll.length,
      miniCleared: minisCleared,
      miniTotal: minisAll.length,

      groupCounts: state.totalCounts.slice(),

      nTargetGoodSpawned: state.nTargetGoodSpawned,
      nTargetJunkSpawned: state.nTargetJunkSpawned,
      nHitGood: state.nHitGood,
      nHitJunk: state.nHitJunk,
      nExpireGood: state.nExpireGood,

      gameVersion,
      reason: reason || 'timeout',
      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso || new Date().toISOString()
    };
    return summary;
  }

  function emitSession(reason) {
    const detail = buildSummary(reason);
    ROOT.dispatchEvent(new CustomEvent('hha:session', { detail }));
  }

  function emitEnd(reason) {
    const detail = buildSummary(reason);
    ROOT.dispatchEvent(new CustomEvent('hha:end', { detail }));
  }

  // --------- Adaptive difficulty (โหมดธรรมดาเท่านั้น) ----------
  function maybeAdaptiveTuning() {
    if (!adaptive) return;

    const totalHit = state.nHitGood + state.nHitJunk;
    const totalSpawn = state.nTargetGoodSpawned + state.nTargetJunkSpawned;
    if (totalSpawn < 10) return; // ยังน้อยไป

    const acc = totalSpawn > 0 ? (state.nHitGood / totalSpawn) : 0;
    // ถ้าแม่น + combo สูง → ลดขนาดเป้าเล็กน้อย + จำนวนเป้าเพิ่ม
    if (acc > 0.75 && state.comboMax >= 8) {
      targetScale = clamp(targetScale * 0.94, 0.70, diffConf.scale);
      spawnInterval = clamp(spawnInterval - 60, 600, diffConf.spawnInterval);
    } else if (acc < 0.5 || state.misses > 10) {
      // ถ้าพลาดเยอะ → ผ่อนลง
      targetScale = clamp(targetScale * 1.06, diffConf.scale, 1.30);
      spawnInterval = clamp(spawnInterval + 80, diffConf.spawnInterval, 1300);
    }
  }

  // --------- เป้าหมาย (Targets) ----------
  function makeTargetElement(emoji, isGood) {
    const el = DOC.createElement('div');
    el.className = 'hha-target' + (isGood ? ' hha-target-good' : ' hha-target-bad');
    el.textContent = emoji;
    el.setAttribute('data-hha-tgt', '1');
    el.style.position = 'absolute';
    el.style.transform = 'translate(-50%, -50%)';

    const vw = ROOT.innerWidth || 800;
    const vh = ROOT.innerHeight || 600;
    const x = vw * (0.25 + Math.random() * 0.5);  // ตรงกลางจอ
    const y = vh * (0.25 + Math.random() * 0.5);
    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    const size = 68 * targetScale;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.fontSize = (42 * targetScale) + 'px';

    return el;
  }

  function spawnTarget() {
    if (state.ended) return;
    if (activeTargets.size >= maxActive) return;

    // 80% healthy, 20% junk
    const isGood = (Math.random() < 0.8);
    const groupIdx = Math.floor(Math.random() * 5); // 0..4 → หมู่ 1..5
    const poolObj = ITEM_POOL[groupIdx + 1] || ITEM_POOL[1];
    const pool = isGood ? poolObj.good : poolObj.junk;
    const emoji = pickOne(pool, isGood ? '🍽️' : '🔥');

    const el = makeTargetElement(emoji, isGood);
    const id = 't' + (nextTargetId++);

    const bornAt = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();

    const targetData = {
      id,
      el,
      emoji,
      isGood,
      groupIdx,
      bornAt
    };

    const onClick = () => handleHit(targetData);
    targetData.onClick = onClick;

    el.addEventListener('click', onClick);
    DOC.body.appendChild(el);
    activeTargets.set(id, targetData);

    if (isGood) state.nTargetGoodSpawned++;
    else state.nTargetJunkSpawned++;

    // อายุเป้า
    setTimeout(() => {
      if (!activeTargets.has(id) || state.ended) return;
      handleExpire(targetData);
    }, targetLife);
  }

  function clearTarget(targetData) {
    const id = targetData.id;
    if (!activeTargets.has(id)) return;
    activeTargets.delete(id);
    try {
      targetData.el.removeEventListener('click', targetData.onClick);
    } catch (_) {}
    if (targetData.el && targetData.el.parentNode) {
      targetData.el.parentNode.removeChild(targetData.el);
    }
  }

  function handleHit(targetData) {
    if (state.ended) return;
    clearTarget(targetData);

    const nowMs = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
    const rtMs = Math.max(0, nowMs - targetData.bornAt);
    const timeFromStartMs = Math.max(0, nowMs - startMs);

    let scoreDelta = 0;
    const isGood = targetData.isGood;

    if (isGood) {
      state.nHitGood++;
      state.combo += 1;
      state.comboMax = Math.max(state.comboMax, state.combo);

      scoreDelta = 70 + (state.combo * 5);
      if (feverActive) scoreDelta = Math.floor(scoreDelta * 1.4);

      // สะสมหมู่สำหรับจานปัจจุบัน + รวมทั้งเกม
      state.currentPlateCounts[targetData.groupIdx] += 1;
      state.totalCounts[targetData.groupIdx]       += 1;

      // เช็คว่าครบทุกหมู่ → ได้ 1 จานสมดุล
      const donePlate = state.currentPlateCounts.every(n => n > 0);
      if (donePlate) {
        state.platesDone += 1;
        // reset จานใหม่
        state.currentPlateCounts = [0, 0, 0, 0, 0];

        // FX ฉลองจาน
        const cx = (ROOT.innerWidth || 800) / 2;
        const cy = (ROOT.innerHeight || 600) * 0.55;
        Particles.burstAt(cx, cy, { color: '#22c55e', count: 20 });
        Particles.scorePop(cx, cy, '+ PLATE!', { good: true, judgment: 'Balanced Plate' });
      }

      applyFever(+8);

      // โค้ช good combo
      if (state.combo === 5) {
        ROOT.dispatchEvent(new CustomEvent('hha:coach', {
          detail: { text: 'สุดยอด! คอมโบ 5 แล้ว ลองไล่จานสมดุลให้ครบเลย 🎯' }
        }));
      } else if (state.combo === 10) {
        ROOT.dispatchEvent(new CustomEvent('hha:coach', {
          detail: { text: 'คอมโบ 10! โหมด FEVER กำลังเดือดเลย 🔥' }
        }));
      }
    } else {
      // junk
      state.nHitJunk++;
      const usedShield = useShield();

      if (!usedShield) {
        state.misses += 1;
      }
      state.combo = 0;
      scoreDelta = -60;
      applyFever(-18);

      // FX ติดลบ
      const cx = (ROOT.innerWidth || 800) / 2;
      const cy = (ROOT.innerHeight || 600) * 0.80;
      Particles.burstAt(cx, cy, { color: '#f97316', count: 16 });
      Particles.scorePop(cx, cy, '- MISS', { good: false, judgment: 'JUNK' });

      ROOT.dispatchEvent(new CustomEvent('hha:coach', {
        detail: { text: 'ของทอด/หวานเยอะไปแล้ว ลองโฟกัสหมู่ผัก ผลไม้ และนมแทนนะ 😌' }
      }));

      // แจ้ง HUD ว่า MISS เพิ่ม
      ROOT.dispatchEvent(new CustomEvent('hha:miss', { detail: { type: 'junkHit' } }));
    }

    state.score = Math.max(0, state.score + scoreDelta);

    // adaptive tuning เล็กน้อย
    maybeAdaptiveTuning();

    // ยิง event log สำหรับงานวิจัย
    ROOT.dispatchEvent(new CustomEvent('hha:event', {
      detail: {
        sessionId,
        type: isGood ? 'hit-good' : 'hit-junk',
        mode: 'BalancedPlateVR',
        difficulty: diffKey,
        timeFromStartMs: Math.round(timeFromStartMs),
        rtMs: Math.round(rtMs),
        emoji: targetData.emoji,
        itemType: isGood ? 'good' : 'junk',
        lane: targetData.groupIdx + 1,
        totalScore: state.score,
        combo: state.combo,
        isGood,
        feverState: feverActive ? 'active' : 'normal',
        feverValue,
        goalProgress: goalsCleared,
        miniProgress: minisCleared
      }
    }));

    emitQuestUpdate();
    emitStat();
  }

  function handleExpire(targetData) {
    if (state.ended) return;
    clearTarget(targetData);

    if (targetData.isGood) {
      // good หมดอายุ → นับ expire + MISS
      state.nExpireGood++;
      state.misses += 1;
      state.combo = 0;
      applyFever(-10);

      ROOT.dispatchEvent(new CustomEvent('hha:miss', { detail: { type: 'expire' } }));
    }

    emitQuestUpdate();
    emitStat();
  }

  // --------- เวลา (รับจาก hha:time ของ HTML) ----------
  ROOT.addEventListener('hha:time', (e) => {
    if (!e || !e.detail) return;
    const sec = e.detail.sec | 0;
    state.timeLeft = sec;
    if (!state.ended && sec <= 0) {
      endGame('timeout');
    }
  });

  // --------- Game loop ----------
  let spawnTimerId = null;

  function startSpawnLoop() {
    if (spawnTimerId) clearInterval(spawnTimerId);
    spawnTimerId = setInterval(() => {
      if (state.ended) return;
      spawnTarget();
    }, spawnInterval);
  }

  function stopSpawnLoop() {
    if (!spawnTimerId) return;
    clearInterval(spawnTimerId);
    spawnTimerId = null;
  }

  function endGame(reason) {
    if (state.ended) return;
    state.ended = true;
    state.endTimeIso = new Date().toISOString();
    stopSpawnLoop();

    // ลบเป้าที่เหลือทั้งหมด
    activeTargets.forEach(t => clearTarget(t));
    activeTargets.clear();

    FeverUI.setFeverActive(false);

    emitSession(reason || 'timeout');
    emitEnd(reason || 'timeout');
  }

  // ถ้าหน้าแท็บถูกซ่อน → ปิดเกม (กันลืม)
  if (DOC && DOC.addEventListener) {
    DOC.addEventListener('visibilitychange', () => {
      if (DOC.hidden) {
        endGame('hidden');
      }
    });
  }

  // ---------- Start! ----------
  emitQuestUpdate();
  emitStat();
  startSpawnLoop();

  // ส่งโค้ชเปิดเกม
  ROOT.dispatchEvent(new CustomEvent('hha:coach', {
    detail: {
      text: 'เริ่มจัดจานเลย! พยายามให้ครบทั้ง 5 หมู่ และหลบของทอดหวาน ๆ ให้ดีนะ 🍚🥦🍎🥛'
    }
  }));

  // เผื่อเอาไว้ debug จาก console
  ROOT.PlateVR = ROOT.PlateVR || {};
  ROOT.PlateVR.state = state;
  ROOT.PlateVR.endGame = endGame;
  ROOT.PlateVR.spawnTarget = spawnTarget;
}