// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Pop Targets + Multi Quest + Fever + Shield + Coach + FX
// ใช้ร่วม FeverUI (shared) + /herohealth/vr/particles.js
// 2025-12-08 — 2 Goals + 3 Mini (เล่นทีละอัน) + คะแนนเด้งตรงเป้า

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
  // ดึงสดจาก window ทุกครั้ง กันเคสโหลดไม่ทัน/รีเฟรช
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

  // ---------- Quest state: multi goals / mini ----------
  // goalQueue = goal หลัก 2 อัน, เล่นทีละอัน
  // miniQueue = mini quest 3 อัน, เล่นทีละอัน
  let goalQueue = [];
  let miniQueue = [];
  let activeGoalIdx = 0;
  let activeMiniIdx = 0;

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

  // ---------- Quest helpers (หลายอัน) ----------
  function getActiveGoal() {
    return goalQueue[activeGoalIdx] || null;
  }
  function getActiveMini() {
    return miniQueue[activeMiniIdx] || null;
  }

  function buildQuestPayload(hint) {
    return {
      goal: getActiveGoal(),
      mini: getActiveMini(),
      goalsAll: goalQueue.slice(),
      minisAll: miniQueue.slice(),
      hint: hint || ''
    };
  }

  function pushQuest(hint) {
    emit('quest:update', buildQuestPayload(hint));
  }

  // อัปเดต goal จากจำนวนอาหารดีที่เก็บ (goodHit)
  function updateGoalFromGoodHit() {
    if (!goalQueue.length) return;

    const total = goodHit;

    goalQueue.forEach((g, idx) => {
      g.prog = Math.min(total, g.target);
      if (!g.done && total >= g.target) {
        g.done = true;

        if (idx === activeGoalIdx) {
          // เพิ่งจบเควสที่กำลังเล่น
          if (activeGoalIdx === 0) {
            coach('ภารกิจหลักที่ 1 สำเร็จแล้ว! ไปภารกิจที่ 2 กันต่อ 🎉');
          } else {
            coach('ภารกิจหลักทั้งหมดสำเร็จแล้ว เยี่ยมมาก! 🎉');
          }
          activeGoalIdx = Math.min(activeGoalIdx + 1, goalQueue.length);
        }
      }
    });

    let hint = '';
    if (activeGoalIdx >= goalQueue.length) {
      hint = 'Goal ครบแล้ว';
    }
    pushQuest(hint);
  }

  // อัปเดต mini quest จากคอมโบ (ทำทีละอัน)
  function updateMiniFromCombo() {
    if (!miniQueue.length) return;

    const m = getActiveMini();
    if (!m) {
      pushQuest('Mini quest ครบแล้ว');
      return;
    }

    if (m.type === 'combo' && !m.done && combo >= m.threshold) {
      m.done = true;
      m.prog = 1;
      coach(`สุดยอด! คอมโบถึง x${m.threshold} แล้ว Mini quest ผ่านเรียบร้อย 🎯`);
      activeMiniIdx = Math.min(activeMiniIdx + 1, miniQueue.length);
    }

    let hint = '';
    if (activeMiniIdx >= miniQueue.length) {
      hint = 'Mini quest ครบแล้ว';
    }
    pushQuest(hint);
  }

  function emitEnd(reason) {
    const goalsCleared = goalQueue.filter(g => g.done).length;
    const goalsTotal   = goalQueue.length;
    const minisCleared = miniQueue.filter(m => m.done).length;
    const minisTotal   = miniQueue.length;

    emit('hha:end', {
      mode: 'Good vs Junk (VR)',
      score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal,
      miniCleared: minisCleared,
      miniTotal: minisTotal,
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
        gameVersion: 'GoodJunkVR-2025-12-08-QuestFX',
        reason: reason || 'normal',
        goalsCleared,
        goalsTotal,
        miniCleared: minisCleared,
        miniTotal: minisTotal
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

      const P0 = getParticles();
      if (P0) {
        P0.burstAt(sx, sy, {
          color: '#60a5fa',
          count: 10,
          radius: 40
        });
        P0.scorePop(sx, sy, 'Shield', {
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

      const P1 = getParticles();
      if (P1) {
        P1.burstAt(sx, sy, {
          color: '#facc15',
          count: 16,
          radius: 70
        });
        P1.scorePop(sx, sy, '+' + scoreDelta, {
          kind: 'score'
        });
        P1.scorePop(sx, sy, 'BONUS', {
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

      const P2 = getParticles();
      if (P2) {
        P2.burstAt(sx, sy, {
          color: '#38bdf8',
          count: 16,
          radius: 70
        });
        P2.scorePop(sx, sy, '+' + scoreDelta, {
          kind: 'score'
        });
        P2.scorePop(sx, sy, 'BONUS', {
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
      else if (combo === 5)
        coach('คอมโบ x5 แล้ว เยี่ยมมาก! 🔥');
      else if (combo === 10)
        coach('สุดยอด! โปรโหมดแล้ว x10 เลย! 💪');

      updateGoalFromGoodHit();
      updateMiniFromCombo();
    } else {
      // junk — treat as Miss (ถ้าไม่มี shield)
      if (shieldCount > 0) {
        shieldCount -= 1;
        if (FeverUI && FeverUI.setShield) FeverUI.setShield(shieldCount);
        coach('โชคดีมีเกราะกันไว้ ของขยะไม่ทำร้ายคะแนนรอบนี้ 🛡️');
        emitScore();
        emitJudge('Guard');

        const P3 = getParticles();
        if (P3) {
          P3.burstAt(sx, sy, {
            color: '#60a5fa',
            count: 10,
            radius: 40
          });
          P3.scorePop(sx, sy, 'BLOCK', {
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
      const before2 = score;
      score = Math.max(0, score - 8);
      scoreDelta = score - before2;
      combo = 0;
      misses++;
      coach('โดนของขยะแล้ว ระวังพวก 🍔🍩 อีกนะ');

      let nextFever2 = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever2 <= 0) {
        endFever();
        nextFever2 = 0;
      } else {
        setFever(nextFever2, 'charge');
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

      goalMin = 14; goalMax = 18;
      comboMin = 3; comboMaxVal = 4;
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

      goalMin = 22; goalMax = 28;
      comboMin = 6; comboMaxVal = 8;
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

      goalMin = 18; goalMax = 22;
      comboMin = 4; comboMaxVal = 6;
    }

    // === Goal หลัก 2 อัน (ตามระดับ) ===
    const g1 = randInt(goalMin, goalMin + Math.max(1, Math.floor((goalMax - goalMin) / 2)));
    const g2 = randInt(Math.max(g1 + 2, goalMin + 1), goalMax);

    goalQueue = [
      { id:'g1', label:`เก็บอาหารดีให้ครบ ${g1} ชิ้น`, target:g1, prog:0, done:false, type:'good' },
      { id:'g2', label:`เก็บอาหารดีรวม ${g2} ชิ้น`,    target:g2, prog:0, done:false, type:'good' }
    ];

    // === Mini quest 3 อัน (คอมโบตามระดับ) ===
    const c1 = comboMin;
    const c2 = Math.min(comboMaxVal, c1 + 1);
    const c3 = comboMaxVal;

    miniQueue = [
      { id:'m1', label:`รักษาคอมโบให้ถึง x${c1} อย่างน้อย 1 ครั้ง`, target:1, prog:0, done:false, type:'combo', threshold:c1 },
      { id:'m2', label:`รักษาคอมโบให้ถึง x${c2} อย่างน้อย 1 ครั้ง`, target:1, prog:0, done:false, type:'combo', threshold:c2 },
      { id:'m3', label:`รักษาคอมโบให้ถึง x${c3} อย่างน้อย 1 ครั้ง`, target:1, prog:0, done:false, type:'combo', threshold:c3 }
    ];

    activeGoalIdx = 0;
    activeMiniIdx = 0;
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
