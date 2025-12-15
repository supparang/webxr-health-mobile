// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — DOM Emoji Targets + Fever + Quest (2 Goals, 3 Minis) + Celebration
// ใช้กับ groups-vr.html (HUD ซ้าย/ขวา + fever bar + coach + summary)

(function (ns) {
  'use strict';

  const ROOT = (typeof window !== 'undefined' ? window : globalThis);

  // ---------- Dependencies ----------
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles ||
    {
      scorePop () {},
      burstAt () {}
    };

  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI ||
    {
      ensureFeverBar () {},
      setFever () {},
      setFeverActive () {},
      setShield () {}
    };

  const { ensureFeverBar, setFever, setFeverActive, setShield } = FeverUI;

  // ---------- Emoji pools (5 หมู่โภชนาการไทยแบบง่าย ๆ) ----------
  const GROUPS = {
    1: ['🍗', '🥩', '🍖', '🐟', '🍳', '🥚', '🫘', '🥜', '🧀', '🥛'], // เนื้อ นม ไข่ ถั่วเมล็ด
    2: ['🍚', '🍞', '🥖', '🥐', '🥯', '🥨', '🥔', '🍠', '🥣'],      // ข้าว แป้ง เผือก มัน
    3: ['🥦', '🥕', '🍅', '🥬', '🥒', '🌽'],                      // ผัก
    4: ['🍎', '🍌', '🍊', '🍇', '🍉', '🍓', '🍍'],                // ผลไม้
    5: ['🧈', '🥓', '🧇']                                       // ไขมัน/น้ำมัน
  };

  // ★ Pool สำหรับสุ่ม "หมู่ดี" แบบถ่วงน้ำหนัก
  //   หมู่ 1–4 โผล่บ่อย, หมู่ 5 โผล่บ้างแต่ไม่เยอะ เพื่อให้ Mini 3 ทำได้จริง
  const GOOD_GROUP_POOL = [
    { id: 1, weight: 1.2 }, // โปรตีน
    { id: 2, weight: 1.2 }, // พลังงาน
    { id: 3, weight: 1.0 }, // ผัก
    { id: 4, weight: 1.0 }, // ผลไม้
    { id: 5, weight: 0.4 }  // ไขมัน (โอกาสน้อยหน่อย แต่มีแน่นอน)
  ];

  const JUNK = [
    '🍔', '🍟', '🍕', '🌭', '🍩',
    '🍪', '🍰', '🧋', '🥤', '🍫'
  ];

  const POWER_STAR   = '⭐';
  const POWER_FIRE   = '🔥';
  const POWER_SHIELD = '🛡️';
  const POWERUPS = [POWER_STAR, POWER_FIRE, POWER_SHIELD];

  function emojiGroup (ch) {
    for (const k in GROUPS) {
      if (GROUPS[k].includes(ch)) return parseInt(k, 10);
    }
    return 0;
  }

  // ★ เลือก emoji "ดี" โดยสุ่มกลุ่มอาหารตามน้ำหนัก จากนั้นสุ่ม emoji ในหมู่นั้น
  function pickGoodEmoji () {
    let total = 0;
    for (const g of GOOD_GROUP_POOL) total += g.weight;

    let r = Math.random() * total;
    let chosenId = GOOD_GROUP_POOL[0].id;

    for (const g of GOOD_GROUP_POOL) {
      r -= g.weight;
      if (r <= 0) {
        chosenId = g.id;
        break;
      }
    }

    const arr = GROUPS[chosenId] || GROUPS[1];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Quest design ----------
  // 2 Goals, 3 Mini quests
  const GOALS = [
    {
      id: 'G1',
      label: 'เก็บอาหารดีจากหมู่ 1–3 ให้ครบ 11 ชิ้น',
      target: 11
    },
    {
      id: 'G2',
      label: 'เก็บอาหารดีจากหมู่ 4–5 ให้ครบ 9 ชิ้น',
      target: 9
    }
  ];

  const MINIS = [
    {
      id: 'M1',
      label: 'ทำคอมโบให้ถึง x3 อย่างน้อย 1 ครั้ง',
      type: 'combo',
      needCombo: 3
    },
    {
      id: 'M2',
      label: 'เลือกอาหารดีติดกัน 8 ชิ้น โดยไม่โดนของขยะ',
      type: 'streak',
      needStreak: 8
    },
    {
      id: 'M3',
      label: 'เก็บอาหารดีจากครบทั้ง 5 หมู่ อย่างน้อยหมู่ละ 1 ชิ้น',
      type: 'groups',
      needGroups: 5
    }
  ];

  // ---------- Fever ----------
  const FEVER_MAX = 100;
  const FEVER_GAIN_HIT = 9;
  const FEVER_LOSS_MISS = 18;

  // ---------- Helper: events ----------
  function emit (type, detail) {
    try {
      ROOT.dispatchEvent(new CustomEvent(type, { detail }));
    } catch (e) {
      // quiet
    }
  }

  function emitScore (state) {
    emit('hha:score', state);
  }

  function emitMiss (misses) {
    emit('hha:miss', { misses });
  }

  function emitJudge (label) {
    emit('hha:judge', { label });
  }

  function coach (text, minGapMs) {
    if (!text) return;
    const now = Date.now();
    coach._last = coach._last || 0;
    if (minGapMs && now - coach._last < minGapMs) return;
    coach._last = now;
    emit('hha:coach', { text });
  }

  // ---------- Celebration FX ----------
  function celebrate (type, payload) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const count =
      type === 'all' ? 32 :
      type === 'goal' ? 20 :
      16;

    const color =
      type === 'goal' ? '#22c55e' :
      type === 'mini' ? '#facc15' :
      '#38bdf8';

    try {
      for (let i = 0; i < count; i++) {
        const dx = (Math.random() - 0.5) * 220;
        const dy = (Math.random() - 0.5) * 140;
        Particles.burstAt(cx + dx, cy + dy, { color });
      }
    } catch {}

    emit('hha:celebrate', {
      type,
      ...(payload || {})
    });
  }

  // ---------- Particles helper ----------
  function fxScore (x, y, scoreDelta, judgment, isGood) {
    try {
      Particles.scorePop(x, y, String(scoreDelta || (isGood ? '+0' : '0')), {
        good: !!isGood,
        judgment: judgment || ''
      });
    } catch {}

    try {
      Particles.burstAt(x, y, {
        color: isGood ? '#22c55e' : '#f97316'
      });
    } catch {}
  }

  // ---------- Core state ----------
  let layerEl = null;
  let running = false;
  let spawnTimer = null;
  let activeTargets = [];

  let diffKey = 'normal';
  let spawnInterval = 1000;
  let maxActive = 4;

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let goodStreak = 0;

  let fever = 0;
  let feverActive = false;
  let shield = 0;

  // Quest state
  let currentGoalIdx = 0;
  let currentMiniIdx = 0;
  let goalProg = 0;
  let miniFlags = {
    comboDone: false,
    streakDone: false,
    groupsDone: false
  };
  let seenGroups = new Set();

  function clamp (v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function setFeverValue (next, stateHint) {
    fever = clamp(next, 0, FEVER_MAX);
    setFever(fever);
    emit('hha:fever', {
      state: stateHint || (feverActive ? 'active' : 'charge'),
      value: fever,
      max: FEVER_MAX
    });
  }

  function startFever () {
    if (feverActive) return;
    feverActive = true;
    setFeverValue(FEVER_MAX, 'start');
    setFeverActive(true);
    emit('hha:fever', { state: 'start', value: FEVER_MAX, max: FEVER_MAX });
  }

  function endFever () {
    if (!feverActive) return;
    feverActive = false;
    setFeverActive(false);
    setFeverValue(0, 'end');
    emit('hha:fever', { state: 'end', value: 0, max: FEVER_MAX });
  }

  function gainFever (n) {
    const next = fever + n;
    if (!feverActive && next >= FEVER_MAX) {
      startFever();
    } else {
      setFeverValue(next, 'charge');
    }
  }

  function loseFever (n) {
    const next = fever - n;
    if (feverActive && next <= 0) {
      endFever();
    } else {
      setFeverValue(next, 'charge');
    }
  }

  function scoreMultiplier () {
    return feverActive ? 2 : 1;
  }

  // ---------- Quest helpers ----------
  function questMeta () {
    const goalsAll = GOALS.map((g, idx) => ({
      id: g.id,
      label: g.label,
      target: g.target,
      prog: idx === currentGoalIdx ? goalProg : (idx < currentGoalIdx ? g.target : 0),
      done: idx < currentGoalIdx || (idx === currentGoalIdx && goalProg >= g.target)
    }));

    const minisAll = MINIS.map((m, idx) => {
      let done = false;
      if (idx === 0) done = miniFlags.comboDone;
      else if (idx === 1) done = miniFlags.streakDone;
      else if (idx === 2) done = miniFlags.groupsDone;
      return {
        id: m.id,
        label: m.label,
        target: 1,
        prog: done ? 1 : 0,
        done
      };
    });

    const goalsCleared = goalsAll.filter(g => g.done).length;
    const minisCleared = minisAll.filter(m => m.done).length;

    return {
      goalsAll,
      minisAll,
      goalsCleared,
      minisCleared
    };
  }

  function pushQuest (hintText) {
    const meta = questMeta();
    const { goalsAll, minisAll } = meta;

    const goal = goalsAll[currentGoalIdx] || null;
    const mini = minisAll[currentMiniIdx] || null;

    emit('quest:update', {
      goal,
      mini,
      goalsAll,
      minisAll,
      hint: hintText || '',
      meta: {
        goalsCleared: meta.goalsCleared,
        goalsTotal: GOALS.length,
        minisCleared: meta.minisCleared,
        minisTotal: MINIS.length
      }
    });
  }

  function updateGoalOnHit (ch) {
    const g = GOALS[currentGoalIdx];
    if (!g) return;

    const gp = emojiGroup(ch);

    if (currentGoalIdx === 0) {
      // Goal 1: นับหมู่ 1–3
      if (gp >= 1 && gp <= 3) {
        goalProg += 1;
      }
    } else if (currentGoalIdx === 1) {
      // Goal 2: นับหมู่ 4–5
      if (gp === 4 || gp === 5) {
        goalProg += 1;
      }
    }

    if (goalProg >= g.target) {
      goalProg = g.target;
      const idxNow = currentGoalIdx;
      const total = GOALS.length;

      // ★ ฉลอง Goal แต่ละอัน
      celebrate('goal', {
        index: idxNow + 1,
        total,
        title: g.label
      });

      emit('quest:goal-cleared', {
        index: idxNow + 1,
        total,
        title: g.label,
        reward: 'shield' // pattern เดียวกับ hydration/plate
      });

      coach(`Goal ${idxNow + 1}/${total} สำเร็จแล้ว! ${g.label} 🎯`, 3500);

      if (currentGoalIdx < GOALS.length - 1) {
        currentGoalIdx++;
        goalProg = 0;
      }
    }
  }

  function updateMiniOnHit (ch, isGood) {
    const gp = emojiGroup(ch);

    // group tracking สำหรับ Mini 3
    if (isGood && gp >= 1 && gp <= 5) {
      seenGroups.add(gp);
    }

    // streak สำหรับ Mini 2
    if (isGood) {
      goodStreak += 1;
    } else {
      goodStreak = 0;
    }

    // Mini 1: combo >= 3
    if (!miniFlags.comboDone && combo >= MINIS[0].needCombo) {
      miniFlags.comboDone = true;

      celebrate('mini', {
        index: 1,
        total: MINIS.length,
        title: MINIS[0].label
      });

      emit('quest:mini-cleared', {
        index: 1,
        total: MINIS.length,
        title: MINIS[0].label,
        reward: 'star'
      });

      coach(`Mini quest 1 สำเร็จแล้ว! ${MINIS[0].label} ⭐`, 3500);
      if (currentMiniIdx === 0) currentMiniIdx = 1;
    }

    // Mini 2: streak good 8 ชิ้นติด
    if (!miniFlags.streakDone && goodStreak >= MINIS[1].needStreak) {
      miniFlags.streakDone = true;

      celebrate('mini', {
        index: 2,
        total: MINIS.length,
        title: MINIS[1].label
      });

      emit('quest:mini-cleared', {
        index: 2,
        total: MINIS.length,
        title: MINIS[1].label,
        reward: 'star'
      });

      coach('สุดยอด! Mini quest 2 ผ่านแล้ว 🎉', 3500);
      if (currentMiniIdx === 1) currentMiniIdx = 2;
    }

    // Mini 3: ครบ 5 หมู่
    if (!miniFlags.groupsDone && seenGroups.size >= MINIS[2].needGroups) {
      miniFlags.groupsDone = true;

      celebrate('mini', {
        index: 3,
        total: MINIS.length,
        title: MINIS[2].label
      });

      emit('quest:mini-cleared', {
        index: 3,
        total: MINIS.length,
        title: MINIS[2].label,
        reward: 'star'
      });

      coach('เยี่ยมมาก! เก็บอาหารดีครบทั้ง 5 หมู่แล้ว 🥦🍚🍎', 3500);
    }

    const meta = questMeta();
    if (meta.goalsCleared >= GOALS.length &&
        meta.minisCleared >= MINIS.length) {
      // ★ ฉลองใหญ่ เคลียร์ทุกภารกิจ
      celebrate('all', {
        goals: meta.goalsCleared,
        minis: meta.minisCleared,
        goalsTotal: GOALS.length,
        minisTotal: MINIS.length
      });

      emit('quest:all-cleared', {
        goals: meta.goalsCleared,
        minis: meta.minisCleared,
        goalsTotal: GOALS.length,
        minisTotal: MINIS.length
      });

      coach('สุดยอด! เคลียร์ทุกภารกิจแล้ว 🎉 ฉลองใหญ่แล้วมาดูสรุปคะแนนกัน!', 4000);
      stop('quest-complete');
      return;
    }
  }

  // ---------- Target helpers ----------
  function destroyTarget (t, isHit) {
    if (!t) return;
    const el = t.el || t;
    const idx = activeTargets.indexOf(t);
    if (idx >= 0) activeTargets.splice(idx, 1);

    if (el && el.parentNode) {
      if (isHit) {
        el.classList.add('hit');
        setTimeout(() => {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 140);
      } else {
        el.parentNode.removeChild(el);
      }
    }
  }

  function createTarget (type) {
    if (!layerEl) return null;

    const el = document.createElement('div');
    el.className = 'fg-target ' + (type === 'good' ? 'fg-good' : 'fg-junk');

    const x = 16 + Math.random() * 68; // 16–84 vw
    const y = 42 + Math.random() * 38; // 42–80 vh

    el.style.left = x + 'vw';
    el.style.top = y + 'vh';

    let emoji;
    if (type === 'good') {
      if (Math.random() < 0.08) {
        emoji = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
        type = 'power';
      } else {
        // ★ เดิมใช้ GOOD[...] ตอนนี้เปลี่ยนเป็น pickGoodEmoji()
        emoji = pickGoodEmoji();
      }
    } else {
      emoji = JUNK[Math.floor(Math.random() * JUNK.length)];
    }

    el.dataset.kind = type;
    el.dataset.emoji = emoji;
    el.setAttribute('data-emoji', emoji);

    const tObj = { el, type, emoji };
    activeTargets.push(tObj);
    layerEl.appendChild(el);

    const onClick = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = ev.clientX || (rect.left + rect.width / 2);
      const cy = ev.clientY || (rect.top + rect.height / 2);
      handleHit(tObj, cx, cy);
    };

    el.addEventListener('pointerdown', onClick);
    el.addEventListener('click', onClick);

    const life = 1400 + Math.random() * 400;
    tObj.timeout = setTimeout(() => {
      if (!running) return;
      destroyTarget(tObj, false);
      if (type === 'good') {
        misses += 1;
        combo = 0;
        goodStreak = 0;
        loseFever(FEVER_LOSS_MISS);
        emitMiss(misses);
        emitJudge('MISS');
        emitScore({ score, combo, misses });
      }
    }, life);

    return tObj;
  }

  function handleHit (tObj, x, y) {
    if (!running || !tObj || !tObj.el) return;

    const type = tObj.type;
    const ch = tObj.emoji;

    destroyTarget(tObj, true);

    // Power-ups
    if (type === 'power') {
      if (ch === POWER_STAR) {
        const d = 40 * scoreMultiplier();
        score += d;
        combo += 1;
        comboMax = Math.max(comboMax, combo);
        gainFever(20);
        fxScore(x, y, d, 'STAR', true);
        emitJudge('STAR BONUS');
        emitScore({ score, combo, misses });
        updateGoalOnHit(ch);
        updateMiniOnHit(ch, true);
        pushQuest();
        return;
      }

      if (ch === POWER_FIRE) {
        startFever();
        const d = 25;
        score += d;
        combo += 1;
        comboMax = Math.max(comboMax, combo);
        fxScore(x, y, d, 'FEVER', true);
        coach('โหมดไฟ! เลือกอาหารดีรัว ๆ แล้วเลี่ยงของขยะนะ 🔥', 3500);
        emitJudge('FEVER');
        emitScore({ score, combo, misses });
        updateGoalOnHit(ch);
        updateMiniOnHit(ch, true);
        pushQuest();
        return;
      }

      if (ch === POWER_SHIELD) {
        shield = Math.min(3, shield + 1);
        setShield(shield);
        const d = 20;
        score += d;
        combo += 1;
        comboMax = Math.max(comboMax, combo);
        fxScore(x, y, d, 'SHIELD', true);
        coach('ได้เกราะกันของขยะแล้ว ถ้าเผลอแตะจะไม่ถือว่าพลาด 1 ครั้ง 🛡️', 4000);
        emitJudge('SHIELD');
        emitScore({ score, combo, misses });
        updateGoalOnHit(ch);
        updateMiniOnHit(ch, true);
        pushQuest();
        return;
      }
    }

    // ปกติ: ดีหรือขยะ
    if (type === 'good') {
      const base = 10 + combo * 2;
      const gain = base * scoreMultiplier();
      score += gain;
      combo += 1;
      comboMax = Math.max(comboMax, combo);
      goodStreak += 1;
      gainFever(FEVER_GAIN_HIT);

      fxScore(x, y, gain, combo >= 8 ? 'PERFECT' : 'GOOD', true);
      emitJudge(combo >= 8 ? 'PERFECT' : 'GOOD');
      emitScore({ score, combo, misses });

      if (combo === 3) coach('คอมโบ x3 แล้ว เก็บต่อให้ยาว ๆ เลย 💪', 3200);
      if (combo === 6) coach('สุดยอด! คอมโบเริ่มยาวแล้ว ระวังของขยะให้ดีนะ ✨', 3200);

      updateGoalOnHit(ch);
      updateMiniOnHit(ch, true);
      pushQuest();
      return;
    }

    if (type === 'junk') {
      if (shield > 0) {
        shield -= 1;
        setShield(shield);
        fxScore(x, y, 0, 'BLOCK', false);
        emitJudge('BLOCK');
        coach('เกราะช่วยกันของขยะไว้ให้แล้ว แต่ระวังอย่าเผลอบ่อยเกินไปนะ 🛡️', 3800);
        return;
      }

      const loss = -10;
      score = Math.max(0, score + loss);
      combo = 0;
      goodStreak = 0;
      misses += 1;
      loseFever(FEVER_LOSS_MISS);

      fxScore(x, y, loss, 'MISS', false);
      emitMiss(misses);
      emitJudge('MISS');
      emitScore({ score, combo, misses });

      coach('โดนของขยะแล้ว ลองสังเกตสีและรูปร่างให้ดีขึ้นอีกนิดนะ 🍔🍟🍩', 3800);

      updateMiniOnHit(ch, false);
      pushQuest();
    }
  }

  // ---------- Difficulty ----------
  function applyDifficulty (diff) {
    diffKey = diff || 'normal';
    if (diffKey === 'easy') {
      spawnInterval = 1150;
      maxActive = 3;
    } else if (diffKey === 'hard') {
      spawnInterval = 800;
      maxActive = 5;
    } else {
      spawnInterval = 1000;
      maxActive = 4;
    }
  }

  function tickSpawn () {
    if (!running) return;
    if (activeTargets.length >= maxActive) return;

    const type = Math.random() < 0.8 ? 'good' : 'junk';
    createTarget(type);
  }

  // ---------- Start / Stop / Public API ----------
  function start (diff, opts = {}) {
    if (running) return;

    layerEl = opts.layerEl || document.getElementById('fg-layer') || document.body;

    // reset state
    running = true;
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    goodStreak = 0;

    fever = 0;
    feverActive = false;
    shield = 0;
    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    setShield(0);

    currentGoalIdx = 0;
    currentMiniIdx = 0;
    goalProg = 0;
    miniFlags = { comboDone: false, streakDone: false, groupsDone: false };
    seenGroups = new Set();

    activeTargets.forEach(t => destroyTarget(t, false));
    activeTargets = [];

    applyDifficulty(String(diff || 'normal').toLowerCase());

    coach('แตะอาหารดีจากแต่ละหมู่ให้ครบตามภารกิจเลย ✨', 2500);
    emitScore({ score, combo, misses });
    emitJudge('');

    pushQuest('เริ่มเกม Food Groups');

    tickSpawn();
    spawnTimer = setInterval(tickSpawn, spawnInterval);
  }

  function stop (reason) {
    if (!running) return;
    running = false;

    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnTimer = null;
    }

    activeTargets.forEach(t => destroyTarget(t, false));
    activeTargets = [];

    const meta = questMeta();
    const { goalsCleared, minisCleared } = meta;

    emit('hha:end', {
      mode: 'FoodGroupsVR',
      difficulty: diffKey,
      score,
      scoreFinal: score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal: GOALS.length,
      miniCleared: minisCleared,
      miniTotal: MINIS.length,
      reason: reason || 'manual'
    });

    coach('จบเกมแล้ว! ลองดูสรุปคะแนนด้านบนได้เลย 🎉', 3200);
  }

  function setLayer (el) {
    layerEl = el;
  }

  ns.GameEngine = {
    start,
    stop,
    setLayerEl: setLayer
  };
})(window.GroupsVR = window.GroupsVR || {});