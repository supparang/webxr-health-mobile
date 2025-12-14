// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — DOM Emoji Pop Targets + 2 Goals + 3 Mini Quests
// ใช้กับ: groups-vr.html (DOM HUD), ui-fever.js, particles.js, hha-cloud-logger.js
// - ยิง event: hha:score, hha:miss, hha:judge, hha:coach, quest:update, hha:end, hha:session
// - Goal 2 อัน + Mini quest 3 อัน (คอมโบเป็นหลัก)
// - เดินตามเพลง 5 หมู่ อัปสคริปต์โค้ชให้ทีละหมู่แบบเร้าใจ

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

  // ของขยะ / น้ำตาล / ทอดมันส์ ๆ
  const JUNK = [
    '🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🍿'
  ];

  // ---------- Goal / Mini config (2 + 3 ตามที่ตกลง) ----------
  // ปรับตามระดับความยาก
  function setupQuestsForDiff (d) {
    let g1, g2, c1, c2, c3;

    if (d === 'easy') {
      g1 = randInt(10, 14); // เก็บอาหารดีรวมหมู่ 1–3
      g2 = randInt(16, 20); // เก็บอาหารดีครบทั้ง 5 หมู่
      c1 = randInt(3, 4);
      c2 = randInt(4, 5);
      c3 = randInt(5, 6);
    } else if (d === 'hard') {
      g1 = randInt(18, 22);
      g2 = randInt(26, 32);
      c1 = randInt(5, 7);
      c2 = randInt(6, 8);
      c3 = randInt(7, 9);
    } else { // normal
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

    return { goals, minis, goalTargets: { g1, g2 }, miniTargets: [c1, c2, c3] };
  }

  // ---------- Utils ----------
  function randInt (min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

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

  // =============== CORE ENGINE STATE ===============
  let layerEl = null;
  let running = false;
  let spawnTimer = null;
  let spawnInterval = 950; // ปรับตาม diff
  let maxActive = 4;
  let activeTargets = [];

  // stats
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let goodHit = 0;
  let junkHit = 0;

  // fever
  const FEVER_MAX = 100;
  const FEVER_HIT_GAIN = 16;
  const FEVER_MISS_LOSS = 32;
  let fever = 0;
  let feverActive = false;

  // quest state
  let goals = [];
  let minis = [];
  let currentGoalIndex = 0;
  let currentMiniIndex = 0;
  let goalsTotal = 0;
  let minisTotal = 0;
  let questsFinished = false;

  // stage / wave ตามหมู่
  let currentStageIndex = 0; // 0..4 (5 หมู่)
  let durationSec = null;
  let elapsedSec = 0;
  let lastTimeSec = null;

  // session / event logging
  let sessionId = '';
  let sessionStart = null;
  let currentDiff = 'normal';
  let currentRunMode = 'play'; // play | research
  let hasEnded = false;

  // metrics แบบย่อสำหรับ logger
  let nTargetGood = 0;
  let nTargetJunk = 0;
  let nHitGood = 0;
  let nHitJunk = 0;

  let timeListenerBound = null;

  // เรท spawn good/junk จะปรับระหว่างเกม
  let typeWeights = { good: 75, junk: 25 };

  // ---------- Stage / wave (เดินตามเพลงทีละหมู่) ----------
  function currentGroup () {
    return GROUPS[currentStageIndex] || GROUPS[0];
  }

  function advanceStageIfNeeded () {
    if (!durationSec) return;
    if (!running) return;

    // แบ่งเกมเป็น 5 ช่วงเท่า ๆ กันให้เดินหมู่ 1 → 5
    const slice = durationSec / 5;
    const stageByTime = clamp(Math.floor(elapsedSec / slice), 0, 4);

    if (stageByTime !== currentStageIndex && stageByTime < GROUPS.length) {
      currentStageIndex = stageByTime;
      const g = currentGroup();
      coach(g.rhyme || g.title, 3000);

      // ปรับความโหดเล็กน้อยแต่ละช่วง
      if (stageByTime === 1) {
        spawnInterval = Math.max(700, spawnInterval - 80);
        typeWeights = { good: 72, junk: 28 };
      } else if (stageByTime === 2) {
        spawnInterval = Math.max(650, spawnInterval - 60);
        typeWeights = { good: 70, junk: 30 };
      } else if (stageByTime === 3) {
        spawnInterval = Math.max(600, spawnInterval - 50);
        typeWeights = { good: 68, junk: 32 };
      } else if (stageByTime === 4) {
        spawnInterval = Math.max(550, spawnInterval - 40);
        typeWeights = { good: 65, junk: 35 };
      }

      rescheduleSpawn();
    }
  }

  function onTimeTick (e) {
    const d = e.detail || {};
    const secLeft = typeof d.sec === 'number' ? d.sec : 0;

    if (durationSec == null) {
      durationSec = secLeft;
    }
    if (lastTimeSec == null) {
      lastTimeSec = secLeft;
      return;
    }

    if (secLeft < lastTimeSec) {
      // 1 วินาทีผ่านไป
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
      coach('เข้าโหมดไฟแล้ว! เลือกอาหารดีรัว ๆ เลย 🔥', 3000);
      emit('hha:fever', { state: 'start', value: fever, max: FEVER_MAX });
    } else {
      emit('hha:fever', { state: 'charge', value: fever, max: FEVER_MAX });
    }
    if (before !== feverActive && !feverActive) {
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

      coach(`Goal ${idx}/${total} สำเร็จแล้ว! 🎯`, 3200);

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

      coach(`Mini quest ${idx}/${total} สำเร็จแล้ว! ⭐`, 3200);

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

    // ให้เวลา FX หน่อยแล้วค่อย stop (จะไปสรุปผลใน HUD)
    setTimeout(function () {
      stop('quest-complete');
    }, 900);
  }

  // ---------- Target DOM ----------
  function removeTarget (el) {
    activeTargets = activeTargets.filter(function (t) { return t !== el; });
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function createDOMTarget (kind, emoji, groupKey) {
    if (!layerEl) return null;

    const el = document.createElement('div');
    el.className = 'fg-target ' + (kind === 'good' ? 'fg-good' : 'fg-junk');
    el.dataset.kind = kind;
    el.dataset.emoji = emoji;
    el.dataset.group = groupKey || '';
    el.dataset.spawnAt = String(performance.now ? performance.now() : Date.now());

    // random pos (เลี่ยงขอบจอ)
    const marginX = 12;
    const marginYTop = 18;
    const marginYBottom = 26;
    const left = marginX + Math.random() * (100 - marginX * 2);
    const top = marginYTop + Math.random() * (100 - marginYTop - marginYBottom);

    el.style.left = left + '%';
    el.style.top = top + '%';

    function onClick (ev) {
      ev.stopPropagation();
      handleHit(el);
    }

    el.addEventListener('click', onClick);
    el.addEventListener('pointerdown', onClick);

    layerEl.appendChild(el);

    // หมดเวลาแล้วหายไปนับเป็น expire
    const life = clamp(spawnInterval * 1.3, 600, 1800);
    setTimeout(function () {
      if (!running) return;
      if (!el.parentNode) return;
      handleExpire(el);
    }, life);

    return el;
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
    // junk
    return JUNK[Math.floor(Math.random() * JUNK.length)];
  }

  function tickSpawn () {
    if (!running) return;
    if (activeTargets.length >= maxActive) return;

    const kind = pickType();
    const emoji = pickEmojiForCurrentStage(kind);
    const g = currentGroup();

    const el = createDOMTarget(kind, emoji, g.key);
    if (el) {
      activeTargets.push(el);
      if (kind === 'good') nTargetGood++;
      else nTargetJunk++;
    }
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
    const rtMs = spawnAt ? (performance.now ? performance.now() : Date.now()) - spawnAt : null;

    removeTarget(el);

    const pos = particlePos(el);
    let label = '';
    let delta = 0;

    if (kind === 'good') {
      goodHit++;
      nHitGood++;
      combo++;
      comboMax = Math.max(comboMax, combo);

      const base = 10 + combo * 2;
      delta = base * mult();
      score += delta;

      addFever(FEVER_HIT_GAIN);

      if (combo === 1) {
        coach('เปิดคอมโบแล้ว! เลือกอาหารดีจากหมู่ ' + (currentStageIndex + 1) + ' ต่อเลย 🥦🍎', 2600);
      } else if (combo === 5) {
        coach('คอมโบ x5 แล้ว! ลองดันไปให้ถึง Mini quest ดูนะ 🔥', 2800);
      } else if (combo === 10) {
        coach('สุดยอด! โปรโหมดแล้ว คอมโบ x10 เลย! 💪', 3200);
      }

      updateGoalFromGoodHit();
      updateMiniFromCombo();

      label = (rtMs != null && rtMs < 450) ? 'PERFECT' : 'GOOD';
      pushJudgeHUD(label);
      pushScoreHUD();
    } else {
      // junk = พลาด
      junkHit++;
      misses++;
      combo = 0;

      const lost = 8;
      delta = -lost;
      score = Math.max(0, score - lost);

      loseFever(FEVER_MISS_LOSS);

      coach('โดนของขยะแล้ว ระวังพวก 🍔🍟🍩 ให้มากขึ้นนะ', 3200);
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
        count: kind === 'good' ? 24 : 16,
        radius: kind === 'good' ? 70 : 50
      });
      if (text) {
        Particles.scorePop(pos.x, pos.y, text, {
          kind: 'score',
          judgment: label,
          good: kind === 'good'
        });
      } else if (label) {
        Particles.scorePop(pos.x, pos.y, label, {
          kind: 'judge',
          judgment: label,
          good: kind === 'good'
        });
      }
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
      misses
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

      coach('พลาด ' + emoji + ' ไปนิด ลองเล็งให้ตรงขึ้นอีกหน่อยนะ 😊', 2600);
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
      misses
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

  // =============== PUBLIC API: start / stop / setLayerEl ===============
  function applyDiffConfig (diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    currentDiff = d;

    if (d === 'easy') {
      spawnInterval = 1100;
      maxActive = 3;
      typeWeights = { good: 80, junk: 20 };
    } else if (d === 'hard') {
      spawnInterval = 800;
      maxActive = 5;
      typeWeights = { good: 68, junk: 32 };
    } else {
      spawnInterval = 950;
      maxActive = 4;
      typeWeights = { good: 72, junk: 28 };
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
  }

  function start (diffKey, opts) {
    if (running) return;

    if (opts && opts.layerEl) {
      setLayerEl(opts.layerEl);
    } else if (!layerEl) {
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
    goodHit = 0;
    junkHit = 0;

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

    // เคลียร์เป้าเก่า
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
    coach('เริ่มจากหมู่ 1 โปรตีนก่อน เลือกเนื้อ นม ไข่ให้ถูกหมู่เลย! 🥛🍗', 3200);
    pushScoreHUD();
    pushJudgeHUD('');
    pushQuestHUD('เริ่มภารกิจ Food Groups');

    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(tickSpawn, spawnInterval);
    tickSpawn();

    // listen hha:time เพื่อเดิน stage
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
    start: start,
    stop: stop,
    setLayerEl: setLayerEl
  };
})(typeof window !== 'undefined' ? window : this);