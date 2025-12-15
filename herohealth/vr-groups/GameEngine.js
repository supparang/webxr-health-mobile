// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — DOM Emoji Pop Targets
// 5 หมู่ • 2 Goals • 3 Mini Quests + Fever + Burst Waves
// ใช้กับ groups-vr.html (HUD + Countdown เดิม)

(function (ROOT) {
  'use strict';

  ROOT.GroupsVR = ROOT.GroupsVR || {};

  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles ||
    { scorePop () {}, burstAt () {} };

  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI ||
    {
      ensureFeverBar () {},
      setFever () {},
      setFeverActive () {},
      setShield () {}
    };

  // ---------- Emoji ตามหมู่โภชนาการไทย ----------
  const GROUPS = [
    {
      id: 'FG1',
      key: 'protein',
      title: 'หมู่ 1 โปรตีน — เนื้อ นม ไข่ ถั่วเมล็ดแห้ง',
      rhyme: 'หมู่ 1 มีเนื้อนมไข่ถั่วเมล็ด ช่วยให้เติบโตแข็งขัน 💪',
      emojis: ['🍗','🍖','🥩','🥚','🍳','🥛','🧀','🥜','🐟']
    },
    {
      id: 'FG2',
      key: 'carb',
      title: 'หมู่ 2 พลังงาน — ข้าว แป้ง เผือก มัน น้ำตาล',
      rhyme: 'หมู่ 2 ข้าวแป้งเผือกมันและน้ำตาล เพิ่มพลังให้วิ่งมันส์ ๆ ⚡',
      emojis: ['🍚','🍙','🍞','🥐','🥖','🥨','🥯','🥟']
    },
    {
      id: 'FG3',
      key: 'veg',
      title: 'หมู่ 3 ผัก — สีเขียวเหลือง มีวิตามิน',
      rhyme: 'หมู่ 3 มีผักต่าง ๆ สีเขียวเหลือง มีวิตามินเพียบ 🥦🥕',
      emojis: ['🥦','🥬','🥕','🍅','🫑','🧅','🧄']
    },
    {
      id: 'FG4',
      key: 'fruit',
      title: 'หมู่ 4 ผลไม้ — หลากสี หวานธรรมชาติ',
      rhyme: 'หมู่ 4 มีผลไม้มากมาย กินเป็นอาจิณให้สดชื่น 🍎🍌🍉',
      emojis: ['🍎','🍌','🍇','🍉','🍊','🍍','🍑','🍓','🫐','🥝']
    },
    {
      id: 'FG5',
      key: 'fat',
      title: 'หมู่ 5 ไขมัน — ให้ความอบอุ่นและพลังงาน',
      rhyme: 'หมู่ 5 อย่าได้ลืมกินไขมันดี อบอุ่นร่างกาย 🥑🥜',
      emojis: ['🥑','🥜','🫘','🌰','🫒']
    }
  ];

  const JUNK = [
    '🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🍿'
  ];

  // ---------- Quest config 2 Goal + 3 Mini ----------
  function randInt (min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  function setupQuestsForDiff (d) {
    let g1, g2, c1, c2, c3;

    if (d === 'easy') {
      g1 = randInt(10, 14);
      g2 = randInt(16, 20);
      c1 = randInt(3, 4);
      c2 = randInt(4, 5);
      c3 = randInt(5, 6);
    } else if (d === 'hard') {
      g1 = randInt(18, 22);
      g2 = randInt(26, 32);
      c1 = randInt(5, 7);
      c2 = randInt(6, 8);
      c3 = randInt(7, 9);
    } else {
      g1 = randInt(14, 18);
      g2 = randInt(22, 28);
      c1 = randInt(4, 6);
      c2 = randInt(5, 7);
      c3 = randInt(6, 8);
    }

    const goals = [
      {
        id: 'G1',
        label: `Goal 1: เก็บอาหารดีจากหมู่ 1–3 ให้ครบ ${g1} ชิ้น`,
        target: g1,
        prog: 0,
        done: false
      },
      {
        id: 'G2',
        label: `Goal 2: เก็บอาหารดีครบทั้ง 5 หมู่ให้ครบ ${g2} ชิ้น`,
        target: g2,
        prog: 0,
        done: false
      }
    ];

    const minis = [
      {
        id: 'M1',
        label: `Mini 1: ทำคอมโบให้ถึง x${c1} อย่างน้อย 1 ครั้ง`,
        target: 1,
        prog: 0,
        done: false,
        comboNeed: c1
      },
      {
        id: 'M2',
        label: `Mini 2: ทำคอมโบให้ถึง x${c2} อย่างน้อย 1 ครั้ง`,
        target: 1,
        prog: 0,
        done: false,
        comboNeed: c2
      },
      {
        id: 'M3',
        label: `Mini 3: ทำคอมโบให้ถึง x${c3} อย่างน้อย 1 ครั้ง`,
        target: 1,
        prog: 0,
        done: false,
        comboNeed: c3
      }
    ];

    return { goals, minis };
  }

  // ---------- helpers ----------
  function clamp (v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function emit (type, detail) {
    try {
      ROOT.dispatchEvent(new CustomEvent(type, { detail }));
    } catch (_) {}
  }

  let lastCoachAt = 0;
  function coach (text, minGap) {
    const gap = typeof minGap === 'number' ? minGap : 2200;
    if (!text) return;
    const now = Date.now();
    if (now - lastCoachAt < gap) return;
    lastCoachAt = now;
    emit('hha:coach', { text });
  }

  function particlePos (el) {
    try {
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2
      };
    } catch (_) {
      return { x: window.innerWidth / 2, y: window.innerHeight * 0.55 };
    }
  }

  // =============== CORE STATE ===============
  let layerEl = null;
  let running = false;
  let spawnTimer = null;
  let spawnInterval = 950;
  let maxActive = 4;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  const FEVER_MAX = 100;
  const FEVER_HIT_GAIN = 16;
  const FEVER_MISS_LOSS = 32;
  let fever = 0;
  let feverActive = false;

  let goals = [];
  let minis = [];
  let currentGoalIndex = 0;
  let currentMiniIndex = 0;
  let goalsTotal = 0;
  let minisTotal = 0;
  let questsFinished = false;

  let currentStageIndex = 0;   // 0–4 = หมู่ 1–5
  let durationSec = null;
  let elapsedSec = 0;
  let lastTimeSec = null;

  let sessionId = '';
  let sessionStart = null;
  let currentDiff = 'normal';
  let currentRunMode = 'play';
  let hasEnded = false;

  let nTargetGood = 0;
  let nTargetJunk = 0;
  let nHitGood = 0;
  let nHitJunk = 0;

  let timeListenerBound = null;
  let typeWeights = { good: 75, junk: 25 };

  // ใช้ดู reaction time ให้ PERFECT / GOOD / LATE
  let lastHitTimestamp = 0;

  // ---------- Stage / Wave system ----------
  function currentGroup () {
    return GROUPS[currentStageIndex] || GROUPS[0];
  }

  function applyStageTuning () {
    // ปรับความเร็ว / จำนวนเป้า / สัดส่วน junk ตามหมู่
    if (currentStageIndex === 0) {
      spawnInterval = clamp(spawnInterval, 950, 1200);
      maxActive = clamp(maxActive, 3, 4);
      typeWeights = { good: 82, junk: 18 };
    } else if (currentStageIndex === 1) {
      spawnInterval = clamp(spawnInterval - 60, 850, 1100);
      maxActive = clamp(maxActive, 4, 5);
      typeWeights = { good: 78, junk: 22 };
    } else if (currentStageIndex === 2) {
      spawnInterval = clamp(spawnInterval - 80, 750, 1000);
      maxActive = clamp(maxActive, 4, 5);
      typeWeights = { good: 74, junk: 26 };
    } else if (currentStageIndex === 3) {
      spawnInterval = clamp(spawnInterval - 80, 680, 950);
      maxActive = clamp(maxActive, 5, 6);
      typeWeights = { good: 70, junk: 30 };
    } else {
      // Final wave หมู่ 5 = boss wave
      spawnInterval = clamp(spawnInterval - 60, 620, 900);
      maxActive = clamp(maxActive, 5, 7);
      typeWeights = { good: 66, junk: 34 };
    }

    rescheduleSpawn();
  }

  function advanceStageIfNeeded () {
    if (!durationSec) return;
    if (!running) return;

    const slice = durationSec / 5;
    const stageByTime = clamp(Math.floor(elapsedSec / slice), 0, 4);

    if (stageByTime !== currentStageIndex && stageByTime < GROUPS.length) {
      currentStageIndex = stageByTime;
      const g = currentGroup();
      coach(g.rhyme || g.title, 3200);
      applyStageTuning();
    }
  }

  function onTimeTick (e) {
    const d = e.detail || {};
    const secLeft = typeof d.sec === 'number' ? d.sec : 0;

    if (durationSec == null) durationSec = secLeft;
    if (lastTimeSec == null) {
      lastTimeSec = secLeft;
      return;
    }
    if (secLeft < lastTimeSec) {
      elapsedSec++;
      advanceStageIfNeeded();
    }
    lastTimeSec = secLeft;
  }

  // ---------- Fever ----------
  function applyFeverUI () {
    if (FeverUI.setFever) FeverUI.setFever(fever);
    if (FeverUI.setFeverActive) FeverUI.setFeverActive(feverActive);
  }

  function addFever (delta) {
    const before = feverActive;
    fever = clamp(fever + delta, 0, FEVER_MAX);
    if (!feverActive && fever >= FEVER_MAX) {
      feverActive = true;
      coach('เข้าสู่ FEVER WAVE! เลือกอาหารดีให้ไวขึ้น 🔥', 3200);
      emit('hha:fever', { state: 'start', value: fever, max: FEVER_MAX });

      // FEVER wave: spawn ถี่ขึ้น + junk ลดลง
      spawnInterval = clamp(spawnInterval - 120, 520, 900);
      typeWeights = { good: 84, junk: 16 };
      rescheduleSpawn();
    } else {
      emit('hha:fever', { state: 'charge', value: fever, max: FEVER_MAX });
    }
    if (before && !feverActive) {
      emit('hha:fever', { state: 'end', value: fever, max: FEVER_MAX });
    }
    applyFeverUI();
  }

  function loseFever (delta) {
    const before = feverActive;
    fever = clamp(fever - delta, 0, FEVER_MAX);
    if (feverActive && fever <= 0) {
      feverActive = false;
      emit('hha:fever', { state: 'end', value: fever, max: FEVER_MAX });

      // กลับเป็น config ตาม stage
      applyStageTuning();
    } else {
      emit('hha:fever', { state: 'charge', value: fever, max: FEVER_MAX });
    }
    applyFeverUI();
  }

  function mult () {
    return feverActive ? 2 : 1;
  }

  // ---------- HUD ----------
  function pushScoreHUD () {
    emit('hha:score', {
      score,
      combo,
      misses
    });
  }

  function pushMissHUD () {
    emit('hha:miss', { misses });
  }

  function pushJudgeHUD (label) {
    emit('hha:judge', { label: label || '' });
  }

  function questMeta () {
    const goalsCleared = goals.filter(g => g && g.done).length;
    const minisCleared = minis.filter(m => m && m.done).length;
    return {
      goalsCleared,
      goalsTotal,
      miniCleared: minisCleared,
      miniTotal: minisTotal
    };
  }

  function pushQuestHUD (hint) {
    const g = goals[currentGoalIndex] || null;
    const m = minis[currentMiniIndex] || null;

    emit('quest:update', {
      goal: g,
      mini: m,
      goalsAll: goals.slice(),
      minisAll: minis.slice(),
      hint: hint || '',
      ...questMeta()
    });
  }

  // ---------- Quest update ----------
  function updateGoalFromGoodHit () {
    const g = goals[currentGoalIndex];
    if (!g || g.done) return;

    g.prog += 1;
    if (g.prog >= g.target) {
      g.prog = g.target;
      g.done = true;

      const doneCount = goals.filter(x => x && x.done).length;
      const total = goals.length;
      const idx = doneCount;

      emit('quest:celebrate', {
        kind: 'goal',
        id: g.id,
        label: g.label,
        index: idx,
        total
      });

      coach(`Goal ${idx}/${total} สำเร็จแล้ว! 🎯`, 3400);

      if (doneCount < total) {
        currentGoalIndex = doneCount;
        pushQuestHUD('ไป Goal ถัดไปเลย!');
      } else {
        pushQuestHUD('Goal ทั้งหมดสำเร็จครบแล้ว 🎉');
        checkAllQuestsDone();
      }
    } else {
      pushQuestHUD('');
    }
  }

  function updateMiniFromCombo () {
    const m = minis[currentMiniIndex];
    if (!m || m.done) return;

    const need = m.comboNeed || 4;
    if (combo >= need) {
      m.prog = 1;
      m.done = true;

      const doneCount = minis.filter(x => x && x.done).length;
      const total = minis.length;
      const idx = doneCount;

      emit('quest:celebrate', {
        kind: 'mini',
        id: m.id,
        label: m.label,
        index: idx,
        total
      });

      coach(`Mini quest ${idx}/${total} สำเร็จแล้ว! ⭐`, 3400);

      if (doneCount < total) {
        currentMiniIndex = doneCount;
        pushQuestHUD('Mini quest ถัดไปเริ่มแล้ว!');
      } else {
        pushQuestHUD('Mini quests ครบทุกข้อแล้ว ✅');
        checkAllQuestsDone();
      }
    } else {
      pushQuestHUD('');
    }
  }

  function allQuestsDone () {
    if (!goalsTotal || !minisTotal) return false;
    const goalsCleared = goals.filter(g => g && g.done).length;
    const minisCleared = minis.filter(m => m && m.done).length;
    return goalsCleared >= goalsTotal && minisCleared >= minisTotal;
  }

  function checkAllQuestsDone () {
    if (!running) return;
    if (questsFinished) return;
    if (!allQuestsDone()) return;

    questsFinished = true;
    emit('quest:all-complete', questMeta());
    coach('สุดยอด! เคลียร์ทุก Goal และ Mini quest แล้ว 🎉 ฉลองใหญ่!', 4000);

    setTimeout(function () {
      stop('quest-complete');
    }, 900);
  }

  // ---------- Target DOM ----------
  function removeTarget (el) {
    activeTargets = activeTargets.filter(function (t) { return t !== el; });
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function pickType () {
    const sum = (typeWeights.good || 0) + (typeWeights.junk || 0);
    let r = Math.random() * sum;
    if ((r -= typeWeights.good || 0) <= 0) return 'good';
    return 'junk';
  }

  function pickEmojiForCurrentStage (kind) {
    const g = currentGroup();
    if (kind === 'good') {
      const arr = g.emojis;
      return arr[Math.floor(Math.random() * arr.length)];
    }
    return JUNK[Math.floor(Math.random() * JUNK.length)];
  }

  function createDOMTarget (kind, emoji, groupKey) {
    if (!layerEl) return null;

    const el = document.createElement('div');
    el.className = 'fg-target ' + (kind === 'good' ? 'fg-good' : 'fg-junk');
    el.dataset.kind = kind;
    el.dataset.emoji = emoji;
    el.dataset.group = groupKey || '';
    el.dataset.spawnAt = String(performance.now ? performance.now() : Date.now());

    const marginX = 10;
    const marginYTop = 18;
    const marginYBottom = 26;
    const left = marginX + Math.random() * (100 - marginX * 2);
    const top = marginYTop + Math.random() * (100 - marginYTop - marginYBottom);

    el.style.position = 'absolute';
    el.style.left = left + '%';
    el.style.top = top + '%';
    el.style.pointerEvents = 'auto';

    function onClick (ev) {
      ev.stopPropagation();
      handleHit(el);
    }

    el.addEventListener('click', onClick);
    el.addEventListener('pointerdown', onClick);

    layerEl.appendChild(el);

    // life time เร็วขึ้นตาม stage
    const lifeBase = spawnInterval * 1.25;
    const life = clamp(
      lifeBase - currentStageIndex * 80,
      650,
      1900
    );

    setTimeout(function () {
      if (!running) return;
      if (!el.parentNode) return;
      handleExpire(el);
    }, life);

    console.log('[FoodGroupsVR] spawn target', kind, emoji, 'at', left.toFixed(1) + '%', top.toFixed(1) + '%');

    return el;
  }

  function spawnBurstOnce () {
    if (!running) return;

    // burst 1–3 เป้าตาม stage
    let maxBurst = 1;
    if (currentStageIndex >= 1) maxBurst = 2;
    if (currentStageIndex >= 3) maxBurst = 3;

    let count = 1;
    if (Math.random() < 0.25) count = 2;
    if (Math.random() < 0.12 && maxBurst >= 3) count = 3;

    for (let i = 0; i < count; i++) {
      if (activeTargets.length >= maxActive) break;

      const type = pickType();
      const emoji = pickEmojiForCurrentStage(type);
      const g = currentGroup();

      const el = createDOMTarget(type, emoji, g.key);
      if (el) {
        activeTargets.push(el);
        if (type === 'good') nTargetGood++;
        else nTargetJunk++;
      }
    }
  }

  function tickSpawn () {
    if (!running) return;
    if (activeTargets.length >= maxActive) return;

    spawnBurstOnce();
  }

  function rescheduleSpawn () {
    if (!running) return;
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(tickSpawn, spawnInterval);
  }

  // ---------- Hit / Expire ----------
  function handleHit (el) {
    if (!running || !el || !el.parentNode) return;

    const kind = el.dataset.kind || 'junk';
    const emoji = el.dataset.emoji || '';
    const spawnAt = Number(el.dataset.spawnAt || '0') || 0;
    const nowTs = performance.now ? performance.now() : Date.now();
    const rtMs = spawnAt ? nowTs - spawnAt : null;

    removeTarget(el);

    const pos = particlePos(el);
    let label = '';
    let delta = 0;

    if (kind === 'good') {
      nHitGood++;
      combo++;
      comboMax = Math.max(comboMax, combo);

      // ★ Reaction-based judgment
      let judgeLabel = 'GOOD';
      if (rtMs != null && rtMs <= 320) judgeLabel = 'PERFECT';
      else if (rtMs != null && rtMs >= 900) judgeLabel = 'LATE';

      const base = 10 + combo * 2;
      const bonusPerfect = judgeLabel === 'PERFECT' ? 6 : 0;
      const penaltyLate = judgeLabel === 'LATE' ? -3 : 0;
      delta = (base + bonusPerfect + penaltyLate) * mult();
      score += delta;

      // Adaptive ความมันส์: combo สูง spawn ถี่ขึ้น
      if (combo === 4 || combo === 7 || combo === 10) {
        spawnInterval = clamp(spawnInterval - 40, 540, 1000);
        rescheduleSpawn();
        coach(`คอมโบ x${combo}! ความเร็วเพิ่มขึ้นแล้ว ระวัง junk wave ให้ดี 🔥`, 3200);
      }

      addFever(FEVER_HIT_GAIN);

      // Coach ไดนามิก
      if (combo === 1) {
        coach('เปิดคอมโบแล้ว! เลือกอาหารดีจากหมู่ ' + (currentStageIndex + 1) + ' ต่อเลย 🥦🍎', 2600);
      } else if (combo === 5) {
        coach('คอมโบ x5 แล้ว! ลองดันไปให้ถึง Mini quest ดูนะ 🔥', 2800);
      } else if (combo === 10) {
        coach('โหดมาก! คอมโบสิบเลย โปรโหมดแล้ว 🎉', 3200);
      }

      updateGoalFromGoodHit();
      updateMiniFromCombo();

      label = judgeLabel;
      pushJudgeHUD(label);
      pushScoreHUD();

      lastHitTimestamp = nowTs;
    } else {
      // junk
      nHitJunk++;
      misses++;
      combo = 0;

      const lost = 10;
      delta = -lost;
      score = Math.max(0, score - lost);

      loseFever(FEVER_MISS_LOSS);

      if (misses === 1) {
        coach('โดนของขยะแล้ว ลองสังเกตพวก 🍔🍟🍩 ให้ดี ๆ แล้วหลบให้ทันนะ', 3600);
      } else if (misses === 5) {
        coach('Miss เยอะไปนิด ลองโฟกัสเฉพาะอาหารดีจากแต่ละหมู่สักพักนะ 🥦🍎', 3800);
      }

      pushMissHUD();
      pushScoreHUD();
      label = 'MISS';
      pushJudgeHUD(label);
      pushQuestHUD('');
    }

    const text = delta > 0 ? '+' + delta : (delta < 0 ? String(delta) : '');
    try {
      Particles.burstAt(pos.x, pos.y, {
        color: kind === 'good' ? '#22c55e' : '#f97316',
        count: kind === 'good' ? 26 : 18,
        radius: kind === 'good' ? 74 : 56
      });
      Particles.scorePop(pos.x, pos.y, text || label, {
        kind: text ? 'score' : 'judge',
        judgment: label,
        good: kind === 'good'
      });
    } catch (_) {}

    emit('hha:event', {
      sessionId,
      mode: 'FoodGroupsVR',
      difficulty: currentDiff,
      runMode: currentRunMode,
      type: kind === 'good' ? 'hit-good' : 'hit-junk',
      emoji,
      itemType: kind,
      rtMs,
      totalScore: score,
      combo,
      misses,
      stage: currentStageIndex + 1
    });

    checkAllQuestsDone();
  }

  function handleExpire (el) {
    if (!running || !el || !el.parentNode) return;
    const kind = el.dataset.kind || 'good';
    const emoji = el.dataset.emoji || '';
    removeTarget(el);

    if (kind === 'good') {
      misses++;
      combo = 0;
      loseFever(FEVER_MISS_LOSS * 0.7);

      coach(`พลาด ${emoji} ไปนิด ลองเล็งให้ตรงขึ้นอีกหน่อยนะ 😊`, 2600);
      pushMissHUD();
      pushScoreHUD();
      pushJudgeHUD('MISS');
      pushQuestHUD('');
    }

    emit('hha:event', {
      sessionId,
      mode: 'FoodGroupsVR',
      difficulty: currentDiff,
      runMode: currentRunMode,
      type: 'expire-' + kind,
      emoji,
      itemType: kind,
      totalScore: score,
      combo,
      misses,
      stage: currentStageIndex + 1
    });
  }

  // ---------- END / SESSION ----------
  function buildSessionSummary (reason) {
    const goalsCleared = goals.filter(g => g && g.done).length;
    const minisCleared = minis.filter(m => m && m.done).length;

    const endTime = new Date();
    const durationSecPlayed = sessionStart
      ? Math.round((endTime - sessionStart) / 1000)
      : 0;

    return {
      sessionId,
      mode: 'FoodGroupsVR',
      runMode: currentRunMode,
      difficulty: currentDiff,
      startTimeIso: sessionStart ? sessionStart.toISOString() : '',
      endTimeIso: endTime.toISOString(),
      durationSecPlayed,
      scoreFinal: score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal,
      miniCleared: minisCleared,
      miniTotal: minisTotal,
      nTargetGood,
      nTargetJunk,
      nHitGood,
      nHitJunk,
      reason: reason || 'normal'
    };
  }

  function emitEnd (reason) {
    if (hasEnded) return;
    hasEnded = true;

    const summary = buildSessionSummary(reason);

    emit('hha:end', {
      mode: 'FoodGroupsVR',
      runMode: currentRunMode,
      score: summary.scoreFinal,
      comboMax: summary.comboMax,
      misses: summary.misses,
      goalsCleared: summary.goalsCleared,
      goalsTotal: summary.goalsTotal,
      miniCleared: summary.miniCleared,
      miniTotal: summary.miniTotal,
      reason: summary.reason
    });

    emit('hha:session', summary);
  }

  // =============== PUBLIC API ===============
  function applyDiffConfig (diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    currentDiff = d;

    if (d === 'easy') {
      spawnInterval = 1050;
      maxActive = 4;
      typeWeights = { good: 82, junk: 18 };
    } else if (d === 'hard') {
      spawnInterval = 880;
      maxActive = 6;
      typeWeights = { good: 70, junk: 30 };
    } else {
      spawnInterval = 950;
      maxActive = 5;
      typeWeights = { good: 76, junk: 24 };
    }

    const q = setupQuestsForDiff(d);
    goals = q.goals;
    minis = q.minis;
    goalsTotal = goals.length;
    minisTotal = minis.length;
    currentGoalIndex = 0;
    currentMiniIndex = 0;
    questsFinished = false;
  }

  function detectRunMode () {
    try {
      const url = new URL(window.location.href);
      const raw = (url.searchParams.get('run') || 'play').toLowerCase();
      return raw === 'research' ? 'research' : 'play';
    } catch (_) {
      return 'play';
    }
  }

  function setLayerEl (el) {
    layerEl = el || document.getElementById('fg-layer');
    if (layerEl) {
      layerEl.style.position = 'fixed';
      layerEl.style.left = '0';
      layerEl.style.top = '0';
      layerEl.style.right = '0';
      layerEl.style.bottom = '0';
      layerEl.style.zIndex = '80';      // สูงกว่า HUD
      layerEl.style.pointerEvents = 'none'; // ตัวเป้าเอง pointerEvents:auto
    }
  }

  function start (diffKey, opts) {
    if (running) return;

    if (opts && opts.layerEl) {
      setLayerEl(opts.layerEl);
    } else {
      setLayerEl(null);
    }

    if (!layerEl) {
      console.error('[FoodGroupsVR] ไม่พบ fg-layer สำหรับ DOM targets');
      return;
    }

    running = true;
    hasEnded = false;
    questsFinished = false;

    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;

    fever = 0;
    feverActive = false;
    applyFeverUI();

    nTargetGood = 0;
    nTargetJunk = 0;
    nHitGood = 0;
    nHitJunk = 0;

    elapsedSec = 0;
    lastTimeSec = null;
    durationSec = null;

    activeTargets.forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    activeTargets = [];

    sessionId = 'fgvr-' + Date.now().toString(36) + '-' +
      Math.random().toString(16).slice(2, 8);
    sessionStart = new Date();
    currentRunMode = detectRunMode();

    applyDiffConfig(diffKey);

    if (FeverUI.ensureFeverBar) FeverUI.ensureFeverBar();

    currentStageIndex = 0;
    applyStageTuning();

    coach('เริ่มจากหมู่ 1 โปรตีนก่อน เลือกเนื้อ นม ไข่ให้ถูกหมู่เลย! 🥛🍗', 3200);
    pushScoreHUD();
    pushJudgeHUD('');
    pushQuestHUD('เริ่มภารกิจ Food Groups');

    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(tickSpawn, spawnInterval);
    tickSpawn();

    if (!timeListenerBound) {
      timeListenerBound = onTimeTick;
      ROOT.addEventListener('hha:time', timeListenerBound);
    }
  }

  function stop (reason) {
    if (!running && hasEnded) return;
    running = false;

    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnTimer = null;
    }

    activeTargets.forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    activeTargets = [];

    if (timeListenerBound) {
      ROOT.removeEventListener('hha:time', timeListenerBound);
      timeListenerBound = null;
    }

    coach('จบเกมแล้ว! มาดูสรุปคะแนนกัน 🎉', 2500);
    emitEnd(reason || 'time-up');
  }

  ROOT.GroupsVR.GameEngine = {
    start,
    stop,
    setLayerEl
  };
})(typeof window !== 'undefined' ? window : this);