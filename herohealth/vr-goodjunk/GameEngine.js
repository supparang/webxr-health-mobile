// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Pop Targets + Difficulty Quest + Fever + Shield + Coach
// ใช้ร่วม FeverUI (shared) + particles.js (GAME_MODULES.Particles / window.Particles)
// 2025-12-08 Multi-Quest Version
// - ต่อเกม: Goals = 2 ภารกิจ, Mini quests = 3 ภารกิจ (ทำต่อเนื่องทีละอัน)
// - ปรับช่วงเป้าตาม diff (easy / normal / hard)
// - จบเกมทันทีเมื่อทุก Goal + Mini ครบ
// - ยิงสถิติ accuracy + grade (SSS..C)

'use strict';

export const GameEngine = (function () {
  const A = window.AFRAME;
  const THREE = A && A.THREE;

  // ---------- Fever UI (shared across modes) ----------
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar() {},
      setFever() {},
      setFeverActive() {},
      setShield() {}
    };

  // ---------- Particles (global) ----------
  // ดึงสดจาก window ทุกครั้ง (กันเคสโหลดไม่ทันบนมือถือ)
  function getParticles() {
    return (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
           window.Particles ||
           null;
  }

  // ---------- emoji ชุดอาหาร ----------
  const GOOD = [
    '🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
    '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'
  ];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  // special targets
  const STAR_EMOJI    = '⭐';
  const DIAMOND_EMOJI = '💎';
  const SHIELD_EMOJI  = '🛡️';

  // ---------- ค่าพื้นฐาน (จะถูก override ตาม diff) ----------
  let GOOD_RATE       = 0.65;
  let SPAWN_INTERVAL  = 900;
  let TARGET_LIFETIME = 1100;
  let MAX_ACTIVE      = 4;

  let TYPE_WEIGHTS = {
    good:    70,
    junk:    20,
    star:     4,
    diamond:  3,
    shield:   3
  };

  // Fever
  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 18;
  const FEVER_MISS_LOSS = 30;
  const FEVER_DURATION  = 5000;   // ms

  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let goodHit = 0;
  let junkHit = 0;
  let shieldCount = 0;

  // Fever state
  let fever = 0;
  let feverActive = false;
  let feverTimer = null;

  // session สำหรับ logger
  let sessionId = '';
  let sessionStart = null;
  let currentDiff = 'normal';

  // ---------- Quest state (Multi-goal / Multi-mini) ----------
  // ต่อเกม: Goals = 2, Minis = 3
  let GOALS = [];              // [{label, prog, target, done}]
  let MINIS = [];              // [{label, prog, target, done, comboNeed}]
  let currentGoalIndex = 0;    // แสดง goal ปัจจุบัน
  let currentMiniIndex = 0;    // แสดง mini ปัจจุบัน
  let miniComboNeed = 5;       // threshold ของ mini ปัจจุบัน

  // คอนฟิกช่วงเป้าตามระดับความยาก
  // อ้างอิงแนวจาก difficulty.js (DOM) ที่เคยใช้: goal 2 อัน + mini combo 3 ค่า
  const QUEST_CONFIG = {
    easy: {
      goals: [
        { min: 12, max: 16 },
        { min: 22, max: 26 }
      ],
      miniCombos: [3, 5, 7]
    },
    normal: {
      goals: [
        { min: 16, max: 20 },
        { min: 24, max: 30 }
      ],
      miniCombos: [4, 6, 8]
    },
    hard: {
      goals: [
        { min: 20, max: 26 },
        { min: 28, max: 34 }
      ],
      miniCombos: [5, 7, 9]
    }
  };

  // ---------- Emoji → texture cache ----------
  const emojiTexCache = new Map();

  function getEmojiTexture(ch) {
    if (emojiTexCache.has(ch)) return emojiTexCache.get(ch);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 256, 256);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font =
      '200px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
    ctx.fillText(ch, 128, 140);

    const url = canvas.toDataURL('image/png');
    emojiTexCache.set(ch, url);
    return url;
  }

  // ---------- helpers ----------
  function emit(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function coach(text) {
    if (!text) return;
    emit('hha:coach', { text });
  }

  function emitScore() {
    emit('hha:score', { score, combo, misses });
  }

  function emitMiss() {
    emit('hha:miss', { misses });
  }

  function clamp(v, min, max){
    return v < min ? min : (v > max ? max : v);
  }

  function randInt(min, max){
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  function nowMs() {
    return performance && performance.now ? performance.now() : Date.now();
  }

  // แปลง world → screen สำหรับใช้กับ particles
  function worldToScreen(el) {
    try {
      if (!THREE || !sceneEl || !sceneEl.camera || !el || !el.object3D) {
        return null;
      }
      const cam = sceneEl.camera;
      const v = new THREE.Vector3();
      v.setFromMatrixPosition(el.object3D.matrixWorld);
      v.project(cam);

      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      return { x, y };
    } catch (err) {
      return null;
    }
  }

  // helper: หาจุดบนจอสำหรับ FX (มี fallback)
  function fxScreenPos(el) {
    const sp = worldToScreen(el);
    if (sp && Number.isFinite(sp.x) && Number.isFinite(sp.y)) {
      return sp;
    }
    // fallback: กลางจอหน่อย ๆ
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.55
    };
  }

  function judgeFromRT(rtMs) {
    if (rtMs == null || rtMs < 0) return 'Good';
    // แบ่งตาม TARGET_LIFETIME
    const tPerfect = TARGET_LIFETIME * 0.35;
    const tGood    = TARGET_LIFETIME * 0.70;
    if (rtMs <= tPerfect) return 'Perfect';
    if (rtMs <= tGood)    return 'Good';
    if (rtMs <= TARGET_LIFETIME + 120) return 'Late';
    return 'Miss';
  }

  function emitJudge(label) {
    emit('hha:judge', { label });
  }

  // ---------- สถิติ & Grade ----------
  function computeFinalStat() {
    const totalHit = goodHit + junkHit;
    const accuracyPct = totalHit > 0
      ? Math.round((goodHit / totalHit) * 100)
      : 0;

    let grade = 'C';
    if (accuracyPct >= 97 && misses <= 2)      grade = 'SSS';
    else if (accuracyPct >= 93 && misses <= 4) grade = 'SS';
    else if (accuracyPct >= 88)                grade = 'S';
    else if (accuracyPct >= 80)                grade = 'A';
    else if (accuracyPct >= 70)                grade = 'B';

    return { accuracyPct, grade, totalHit };
  }

  // ---------- Fever ----------
  function setFever(value, stateHint) {
    fever = clamp(value, 0, FEVER_MAX);

    if (FeverUI && typeof FeverUI.setFever === 'function') {
      FeverUI.setFever(fever);
    }

    emit('hha:fever', {
      state: stateHint || (feverActive ? 'active' : 'charge'),
      value: fever,
      max: FEVER_MAX
    });
  }

  function startFever() {
    if (feverActive) return;
    feverActive = true;
    fever = FEVER_MAX;

    if (FeverUI && FeverUI.setFeverActive) FeverUI.setFeverActive(true);
    if (FeverUI && FeverUI.setFever)       FeverUI.setFever(fever);

    emit('hha:fever', { state:'start', value: fever, max: FEVER_MAX });

    if (feverTimer) clearTimeout(feverTimer);
    feverTimer = setTimeout(() => {
      endFever();
    }, FEVER_DURATION);
  }

  function endFever() {
    if (!feverActive) return;
    feverActive = false;
    fever = 0;

    if (FeverUI && FeverUI.setFeverActive) FeverUI.setFeverActive(false);
    if (FeverUI && FeverUI.setFever)       FeverUI.setFever(fever);

    emit('hha:fever', { state:'end', value: fever, max: FEVER_MAX });
  }

  // ---------- Quest ----------
  function pushQuest(hint) {
    const curGoal = GOALS[currentGoalIndex] || null;
    const curMini = MINIS[currentMiniIndex] || null;

    const goalsAll = GOALS.map(g => ({
      label: g.label,
      prog: Math.min(g.prog, g.target),
      target: g.target,
      done: g.done
    }));

    const minisAll = MINIS.map(m => ({
      label: m.label,
      prog: Math.min(m.prog, m.target),
      target: m.target,
      done: m.done
    }));

    emit('quest:update', {
      goal: curGoal
        ? {
            label: curGoal.label,
            prog: Math.min(curGoal.prog, curGoal.target),
            target: curGoal.target,
            done: curGoal.done
          }
        : null,
      mini: curMini
        ? {
            label: curMini.label,
            prog: Math.min(curMini.prog, curMini.target),
            target: curMini.target,
            done: curMini.done
          }
        : null,
      goalsAll,
      minisAll,
      hint: hint || ''
    });
  }

  function updateGoalFromGoodHit() {
    if (!GOALS.length) return;
    const g = GOALS[currentGoalIndex] || GOALS[GOALS.length - 1];

    // ใช้ goodHit สะสมทั้งเกมเป็นความก้าวหน้า
    g.prog = goodHit;

    if (!g.done && g.prog >= g.target) {
      g.done = true;
      coach(`ภารกิจหลักที่ ${currentGoalIndex + 1} สำเร็จแล้ว! 🎉`);

      if (currentGoalIndex < GOALS.length - 1) {
        currentGoalIndex += 1;
        const nextGoal = GOALS[currentGoalIndex];
        coach(`ต่อไป: ${nextGoal.label}`);
        pushQuest('เปลี่ยนเป้าหมายเป็น Goal ถัดไป');
      } else {
        pushQuest('Goal ทั้งหมดสำเร็จแล้ว');
      }
    } else {
      pushQuest('');
    }
  }

  function updateMiniFromCombo() {
    if (!MINIS.length) return;
    const m = MINIS[currentMiniIndex] || MINIS[MINIS.length - 1];

    if (!m.done && combo >= m.comboNeed) {
      m.done = true;
      m.prog = 1;
      coach(`สุดยอด! Mini quest ที่ ${currentMiniIndex + 1} ผ่านเรียบร้อย 🎯`);

      if (currentMiniIndex < MINIS.length - 1) {
        currentMiniIndex += 1;
        const nextMini = MINIS[currentMiniIndex];
        miniComboNeed = nextMini.comboNeed;
        coach(`Mini ถัดไป: ${nextMini.label}`);
        pushQuest('เปลี่ยน Mini quest ถัดไป');
      } else {
        pushQuest('Mini quests ทั้งหมดสำเร็จแล้ว ✅');
      }
    } else {
      pushQuest('');
    }
  }

  function allQuestsDone() {
    const goalsDone = GOALS.length ? GOALS.every(g => g.done) : false;
    const minisDone = MINIS.length ? MINIS.every(m => m.done) : false;
    return goalsDone && minisDone;
  }

  function checkEndByQuests() {
    if (!running) return;
    if (allQuestsDone()) {
      coach('สุดยอด! ภารกิจทั้งหมดครบแล้ว 🎉');
      stop('quests-cleared');
    }
  }

  function emitEnd(reason) {
    const { accuracyPct, grade, totalHit } = computeFinalStat();

    const goalsTotal   = GOALS.length || 1;
    const miniTotal    = MINIS.length || 1;
    const goalsCleared = GOALS.filter(g => g.done).length;
    const miniCleared  = MINIS.filter(m => m.done).length;

    emit('hha:end', {
      mode: 'Good vs Junk (VR)',
      score,
      comboMax,
      misses,
      totalHit,
      goodHit,
      junkHit,
      accuracyPct,
      grade,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal,
      reason: reason || 'normal'
    });

    // ยิง session log ให้ logger ไป Google Sheet
    try {
      const endTime = new Date();
      const durationSecPlayed = sessionStart
        ? Math.round((endTime - sessionStart) / 1000)
        : 0;

      emit('hha:session', {
        sessionId,
        mode: 'GoodJunkVR',
        difficulty: currentDiff,
        device: navigator.userAgent || '',
        startTimeIso: sessionStart ? sessionStart.toISOString() : '',
        endTimeIso: endTime.toISOString(),
        durationSecPlayed,
        scoreFinal: score,
        comboMax,
        misses,
        totalHit,
        goodHit,
        junkHit,
        accuracyPct,
        grade,
        goalsCleared,
        goalsTotal,
        miniCleared,
        miniTotal,
        gameVersion: 'GoodJunkVR-2025-12-08-MQ',
        reason: reason || 'normal'
      });

      // ยิง stat แยก (เผื่อ Hub อยากใช้)
      emit('hha:stat', {
        sessionId,
        mode: 'GoodJunkVR',
        difficulty: currentDiff,
        accuracyPct,
        grade,
        scoreFinal: score,
        comboMax,
        misses,
        totalHit,
        goodHit,
        junkHit,
        goalsCleared,
        goalsTotal,
        miniCleared,
        miniTotal
      });
    } catch (err) {
      // เงียบ ๆ ไม่ให้เกมล้ม
    }
  }

  // ---------- ลบเป้า ----------
  function removeTarget(el) {
    activeTargets = activeTargets.filter(t => t !== el);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  // ---------- สร้างเป้า (emoji pop) ----------
  function createTargetEntity(emoji, kind) {
    if (!sceneEl) return null;

    const root = document.createElement('a-entity');

    // กล่องกลางจอ (ยกขึ้นสูงหน่อย)
    const x = -1.3 + Math.random() * 2.6;   // [-1.3, 1.3]
    const y = 2.0  + Math.random() * 1.0;   // [2.0, 3.0]
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.classList.add('gj-target');
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;
    root.dataset.spawnAt = String(nowMs());

    // วงกลมพื้นหลัง
    const circle = document.createElement('a-circle');
    let color = '#22c55e';
    if (kind === 'junk')   color = '#f97316';
    if (kind === 'star')   color = '#fde047';
    if (kind === 'diamond')color = '#38bdf8';
    if (kind === 'shield') color = '#60a5fa';

    circle.setAttribute('radius',
      kind === 'good' ? 0.40 :
      kind === 'junk' ? 0.38 : 0.36
    );
    circle.setAttribute('material', {
      color,
      opacity: 0.30,
      metalness: 0,
      roughness: 1
    });

    // emoji sprite
    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', 0.7);
    sprite.setAttribute('height', 0.7);
    sprite.setAttribute('position', { x: 0, y: 0, z: 0.01 });
    sprite.setAttribute('material', {
      src: getEmojiTexture(emoji),
      transparent: true,
      alphaTest: 0.01
    });

    circle.setAttribute('data-hha-tgt', '1');
    sprite.setAttribute('data-hha-tgt', '1');

    const hitHandler = () => onHit(root);
    circle.addEventListener('click', hitHandler);
    sprite.addEventListener('click', hitHandler);

    root.appendChild(circle);
    root.appendChild(sprite);
    sceneEl.appendChild(root);

    // เป้าอยู่ตาม TARGET_LIFETIME แล้วหาย
    setTimeout(() => {
      if (!running) return;
      if (!root.parentNode) return;
      onExpire(root);
    }, TARGET_LIFETIME);

    return root;
  }

  // ---------- ยิงโดน ----------
  function onHit(el) {
    if (!running || !el) return;
    if (!el.parentNode) return;

    const kind = el.dataset.kind || 'junk';
    const emoji = el.dataset.emoji || '';
    const spawnAt = Number(el.dataset.spawnAt || '0') || 0;
    const rtMs = spawnAt ? nowMs() - spawnAt : null;

    const screenPos = fxScreenPos(el);
    const sx = screenPos.x;
    const sy = screenPos.y;

    removeTarget(el);

    let judgment = 'Good';
    let scoreDelta = 0;

    // ---------- shield / star / diamond ----------
    if (kind === 'shield') {
      shieldCount += 1;
      if (FeverUI && FeverUI.setShield) FeverUI.setShield(shieldCount);
      coach('ได้เกราะป้องกัน 1 ชิ้น! ถ้าเผลอแตะของขยะจะไม่เสียแต้มทันที 🛡️');
      emitScore();
      emitJudge('Shield');

      const P = getParticles();
      if (P) {
        P.burstAt(sx, sy, {
          color: '#60a5fa',
          count: 10,
          radius: 40
        });
        P.scorePop(sx, sy, 'Shield', {
          kind: 'judge',
          judgment: 'BLOCK'
        });
      }

      emit('hha:event', {
        sessionId,
        type: 'bonus',
        emoji,
        lane: 0,
        rtMs,
        totalScore: score,
        combo,
        isGood: true,
        itemType: 'shield'
      });
      return;
    }

    if (kind === 'star') {
      const mult = feverActive ? 2 : 1;
      const before = score;
      score += 80 * mult;
      scoreDelta = score - before;
      coach('ดวงดาวโบนัส! ได้แต้มพิเศษเพิ่มขึ้น ⭐');
      emitJudge('Bonus');
      emitScore();

      const P = getParticles();
      if (P) {
        P.burstAt(sx, sy, {
          color: '#facc15',
          count: 16,
          radius: 70
        });
        P.scorePop(sx, sy, '+' + scoreDelta, {
          kind: 'score'
        });
        P.scorePop(sx, sy, 'BONUS', {
          kind: 'judge',
          judgment: 'GOOD'
        });
      }

      emit('hha:event', {
        sessionId,
        type: 'bonus',
        emoji,
        lane: 0,
        rtMs,
        totalScore: score,
        combo,
        isGood: true,
        itemType: 'star'
      });
      return;
    }

    if (kind === 'diamond') {
      const mult = feverActive ? 2 : 1;
      const before = score;
      score += 60 * mult;
      scoreDelta = score - before;
      setFever(fever + 30, 'charge');
      coach('ได้เพชรพลังงาน! Fever ขึ้นไวขึ้น 💎');
      emitJudge('Bonus');
      emitScore();

      const P = getParticles();
      if (P) {
        P.burstAt(sx, sy, {
          color: '#38bdf8',
          count: 16,
          radius: 70
        });
        P.scorePop(sx, sy, '+' + scoreDelta, {
          kind: 'score'
        });
        P.scorePop(sx, sy, 'BONUS', {
          kind: 'judge',
          judgment: 'GOOD'
        });
      }

      emit('hha:event', {
        sessionId,
        type: 'bonus',
        emoji,
        lane: 0,
        rtMs,
        totalScore: score,
        combo,
        isGood: true,
        itemType: 'diamond'
      });
      return;
    }

    // ---------- good / junk ----------
    if (kind === 'good') {
      goodHit++;

      combo++;
      comboMax = Math.max(comboMax, combo);

      const before = score;
      const base = 10 + combo * 2;
      const mult = feverActive ? 2 : 1;
      score += base * mult;
      scoreDelta = score - before;

      const nextFever = fever + FEVER_HIT_GAIN;
      if (!feverActive && nextFever >= FEVER_MAX) {
        startFever();
      } else {
        setFever(nextFever, 'charge');
      }

      judgment = judgeFromRT(rtMs);

      if (combo === 1)
        coach('เปิดคอมโบแล้ว! เลือกผัก ผลไม้ นมต่อเลย 🥦🍎🥛');
      else if (combo === miniComboNeed)
        coach(`คอมโบถึง x${miniComboNeed} แล้ว เยี่ยมมาก! 🔥`);
      else if (combo === 10)
        coach('สุดยอด! โปรโหมดแล้ว x10 เลย! 💪');

      updateGoalFromGoodHit();
      updateMiniFromCombo();
    } else {
      // junk — treat as Miss
      if (shieldCount > 0) {
        shieldCount -= 1;
        if (FeverUI && FeverUI.setShield) FeverUI.setShield(shieldCount);
        coach('โชคดีมีเกราะกันไว้ ของขยะไม่ทำร้ายคะแนนรอบนี้ 🛡️');
        emitScore();
        emitJudge('Guard');

        const P = getParticles();
        if (P) {
          P.burstAt(sx, sy, {
            color: '#60a5fa',
            count: 10,
            radius: 40
          });
          P.scorePop(sx, sy, 'BLOCK', {
            kind: 'judge',
            judgment: 'BLOCK'
          });
        }

        emit('hha:event', {
          sessionId,
          type: 'hit-junk-guard',
          emoji,
          lane: 0,
          rtMs,
          totalScore: score,
          combo,
          isGood: false,
          itemType: 'junk'
        });
        return;
      }

      junkHit++;
      const before = score;
      score = Math.max(0, score - 8);
      scoreDelta = score - before;
      combo = 0;
      misses++;
      coach('โดนของขยะแล้ว ระวังพวก 🍔🍩 อีกนะ');

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFever(nextFever, 'charge');
      }

      emitMiss();
      updateGoalFromGoodHit();
      pushQuest('');

      judgment = 'Miss';
    }

    emitScore();
    emitJudge(judgment);

    // ---------- FX: เป้าแตก + คะแนน + คำตัดสิน ----------
    const P = getParticles();
    if (P) {
      const jUpper = String(judgment || '').toUpperCase();

      let color = '#22c55e';
      if (jUpper === 'PERFECT') color = '#4ade80';
      else if (jUpper === 'LATE') color = '#facc15';
      else if (jUpper === 'MISS') color = '#f97316';

      const goodFlag = kind === 'good';

      P.burstAt(sx, sy, {
        color,
        count: goodFlag ? 14 : 10,
        radius: goodFlag ? 60 : 50
      });

      if (scoreDelta) {
        const text =
          scoreDelta > 0 ? '+' + scoreDelta : String(scoreDelta);
        P.scorePop(sx, sy, text, {
          kind: 'score'
        });
      }

      P.scorePop(sx, sy, jUpper, {
        kind: 'judge',
        judgment: jUpper
      });
    }

    // event log
    emit('hha:event', {
      sessionId,
      type: kind === 'good' ? 'hit-good' : 'hit-junk',
      emoji,
      lane: 0,
      rtMs,
      totalScore: score,
      combo,
      isGood: kind === 'good',
      itemType: kind
    });

    // เช็คว่าภารกิจครบทุกอันหรือยัง ถ้าครบให้จบเกมก่อนหมดเวลา
    checkEndByQuests();
  }

  // ---------- เป้าหายเพราะหมดเวลา ----------
  function onExpire(el) {
    if (!running || !el) return;
    if (!el.parentNode) return;

    const kind = el.dataset.kind || 'junk';
    const emoji = el.dataset.emoji || '';
    const spawnAt = Number(el.dataset.spawnAt || '0') || 0;
    const rtMs = spawnAt ? nowMs() - spawnAt : null;

    const screenPos = fxScreenPos(el);
    const sx = screenPos.x;
    const sy = screenPos.y;

    removeTarget(el);

    if (kind === 'good') {
      misses++;
      combo = 0;
      coach('พลาดของดีไปนะ ลองเล็งให้ตรงเป้มากขึ้น 😊');

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFever(nextFever, 'charge');
      }

      emitMiss();
      emitScore();
      updateGoalFromGoodHit();
      pushQuest('');
      emitJudge('Miss');

      const P = getParticles();
      if (P) {
        P.burstAt(sx, sy, {
          color: '#f97316',
          count: 10,
          radius: 45
        });
        P.scorePop(sx, sy, 'MISS', {
          kind: 'judge',
          judgment: 'MISS'
        });
      }

      emit('hha:event', {
        sessionId,
        type: 'expire-good',
        emoji,
        lane: 0,
        rtMs,
        totalScore: score,
        combo,
        isGood: false,
        itemType: 'good'
      });
    } else {
      // star / diamond / shield / junk หมดเวลา: ไม่ทำโทษ
      emit('hha:event', {
        sessionId,
        type: 'expire-' + kind,
        emoji,
        lane: 0,
        rtMs,
        totalScore: score,
        combo,
        isGood: false,
        itemType: kind
      });
    }

    checkEndByQuests();
  }

  // ---------- สุ่ม spawn ----------
  function pickType() {
    const w = TYPE_WEIGHTS;
    const sum =
      (w.good   || 0) +
      (w.junk   || 0) +
      (w.star   || 0) +
      (w.diamond|| 0) +
      (w.shield || 0);

    let r = Math.random() * sum;

    if ((r -= w.good) <= 0)    return 'good';
    if ((r -= w.junk) <= 0)    return 'junk';
    if ((r -= w.star) <= 0)    return 'star';
    if ((r -= w.diamond) <= 0) return 'diamond';
    return 'shield';
  }

  function tickSpawn() {
    if (!running) return;
    if (activeTargets.length >= MAX_ACTIVE) return;

    const type = pickType();

    let emoji, kind;
    if (type === 'good') {
      emoji = GOOD[Math.floor(Math.random() * GOOD.length)];
      kind  = 'good';
    } else if (type === 'junk') {
      emoji = JUNK[Math.floor(Math.random() * JUNK.length)];
      kind  = 'junk';
    } else if (type === 'star') {
      emoji = STAR_EMOJI;
      kind  = 'star';
    } else if (type === 'diamond') {
      emoji = DIAMOND_EMOJI;
      kind  = 'diamond';
    } else {
      emoji = SHIELD_EMOJI;
      kind  = 'shield';
    }

    const el = createTargetEntity(emoji, kind);
    if (el) activeTargets.push(el);
  }

  // ---------- ตั้งค่า difficulty ----------
  function applyDifficulty(diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    currentDiff = d;

    let goalMin, goalMax, comboMin, comboMaxVal;

    if (d === 'easy') {
      SPAWN_INTERVAL  = 1200;
      TARGET_LIFETIME = 1500;
      MAX_ACTIVE      = 3;
      GOOD_RATE       = 0.75;

      TYPE_WEIGHTS = {
        good:    78,
        junk:    14,
        star:     3,
        diamond:  3,
        shield:   2
      };

      goalMin = 12; goalMax = 16;
      comboMin = 3; comboMaxVal = 5;
    } else if (d === 'hard') {
      SPAWN_INTERVAL  = 750;
      TARGET_LIFETIME = 950;
      MAX_ACTIVE      = 5;
      GOOD_RATE       = 0.60;

      TYPE_WEIGHTS = {
        good:    65,
        junk:    22,
        star:     5,
        diamond:  4,
        shield:   4
      };

      goalMin = 20; goalMax = 26;
      comboMin = 5; comboMaxVal = 9;
    } else { // normal
      SPAWN_INTERVAL  = 950;
      TARGET_LIFETIME = 1200;
      MAX_ACTIVE      = 4;
      GOOD_RATE       = 0.68;

      TYPE_WEIGHTS = {
        good:    70,
        junk:    18,
        star:     4,
        diamond:  4,
        shield:   4
      };

      goalMin = 16; goalMax = 20;
      comboMin = 4; comboMaxVal = 8;
    }

    // ตั้ง GOALS & MINIS ตาม QUEST_CONFIG (2 + 3 ภารกิจ)
    const qCfg = QUEST_CONFIG[d] || QUEST_CONFIG.normal;

    GOALS = (qCfg.goals || []).map((g, idx) => {
      const tgt = randInt(g.min, g.max);
      return {
        id: 'goal' + (idx + 1),
        label: `Goal ${idx + 1}: เก็บอาหารดีให้ครบ ${tgt} ชิ้น`,
        prog: 0,
        target: tgt,
        done: false
      };
    });

    MINIS = (qCfg.miniCombos || []).map((need, idx) => {
      return {
        id: 'mini' + (idx + 1),
        label: `Mini ${idx + 1}: รักษาคอมโบให้ถึง x${need} อย่างน้อย 1 ครั้ง`,
        prog: 0,
        target: 1,
        done: false,
        comboNeed: need
      };
    });

    currentGoalIndex = 0;
    currentMiniIndex = 0;
    miniComboNeed = MINIS.length ? MINIS[0].comboNeed : 5;
  }

  // ---------- start / stop ----------
  function _startCore(diffKey) {
    running = true;
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    goodHit = 0;
    junkHit = 0;
    shieldCount = 0;

    sessionId = 'gjvr-' + Date.now().toString(36) + '-' +
      Math.random().toString(16).slice(2, 8);
    sessionStart = new Date();

    applyDifficulty(diffKey);

    if (FeverUI && FeverUI.ensureFeverBar) FeverUI.ensureFeverBar();
    if (FeverUI && FeverUI.setFever)      FeverUI.setFever(0);
    if (FeverUI && FeverUI.setShield)     FeverUI.setShield(shieldCount);
    if (FeverUI && FeverUI.setFeverActive)FeverUI.setFeverActive(false);

    fever = 0;
    feverActive = false;
    if (feverTimer) clearTimeout(feverTimer);
    setFever(0, 'charge');

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    emitScore();
    coach('แตะเฉพาะอาหารดี เช่น ผัก ผลไม้ นม เลี่ยงของขยะนะ 🥦🍎🥛');
    emitJudge('');
    pushQuest('เริ่มเกม');

    tickSpawn();
    spawnTimer = setInterval(tickSpawn, SPAWN_INTERVAL);
  }

  function start(diffKey) {
    if (running) return;
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[GoodJunkVR] ไม่พบ <a-scene>');
      return;
    }
    if (sceneEl.hasLoaded) {
      _startCore(diffKey);
    } else {
      sceneEl.addEventListener('loaded', () => _startCore(diffKey), { once: true });
    }
  }

  function stop(reason) {
    if (!running) return;
    running = false;

    clearInterval(spawnTimer);
    if (feverTimer) clearTimeout(feverTimer);
    endFever();

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    coach('จบเกมแล้ว! ดูสรุปคะแนนด้านบนได้เลย 🎉');
    emitEnd(reason);
  }

  return { start, stop };
})();
