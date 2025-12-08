// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Pop Targets + Difficulty Quest (2 goals + 3 minis)
// + Fever + Shield + Coach + Grade + SFX + Auto-end when all quests cleared
// ใช้ร่วม FeverUI (shared) + particles.js (GAME_MODULES.Particles / window.Particles)
// 2025-12-08 — Production FX Version

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

  // ---------- Particles (global, resolve สดทุกครั้ง) ----------
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

  // ---------- ค่าพื้นฐาน (จะถูก override ตาม diff + duration) ----------
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
  let currentDurationSec = 60;

  // ---------- Quest state: 2 Goals + 3 Minis ----------
  // GOALS:
  //   0: เก็บอาหารดีให้ครบ N ชิ้น
  //   1: ทำคะแนนให้ได้อย่างน้อย S คะแนน
  const GOALS = [
    { key:'good-count', label:'', target:0, prog:0, done:false, _announced:false },
    { key:'score',      label:'', target:0, prog:0, done:false, _announced:false }
  ];

  // MINIS:
  //   3 ด่าน combo ตาม threshold (xN) ขึ้นกับ diff + duration
  const MINIS = [
    { key:'combo', label:'', target:0, prog:0, done:false, _announced:false },
    { key:'combo', label:'', target:0, prog:0, done:false, _announced:false },
    { key:'combo', label:'', target:0, prog:0, done:false, _announced:false }
  ];

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

  // SFX (optional)
  function playSfx(id) {
    try {
      const el = document.getElementById(id);
      if (!el) return;
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(()=>{});
    } catch (err) {
      // เงียบ ๆ ไม่ให้พัง
    }
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

  // ---------- Quests helpers ----------
  function resetQuests() {
    GOALS.forEach(g => {
      g.prog = 0;
      g.done = false;
      g._announced = false;
    });
    MINIS.forEach(m => {
      m.prog = 0;
      m.done = false;
      m._announced = false;
    });
  }

  function updateGoalProgressFromStats() {
    GOALS.forEach(g => {
      if (g.key === 'good-count') {
        g.prog = goodHit;
      } else if (g.key === 'score') {
        g.prog = score;
      }
      g.done = g.prog >= g.target && g.target > 0;
    });
  }

  function updateMiniProgressFromStats() {
    MINIS.forEach(m => {
      if (m.key === 'combo') {
        const need = m.target || 1;
        m.prog = Math.min(comboMax, need);
        m.done = comboMax >= need;
      }
    });
  }

  function getCurrentGoal() {
    return GOALS.find(g => !g.done) || null;
  }

  function getCurrentMini() {
    return MINIS.find(m => !m.done) || null;
  }

  function allQuestsCleared() {
    const goalsCleared = GOALS.filter(g => g.done).length;
    const minisCleared = MINIS.filter(m => m.done).length;
    return goalsCleared === GOALS.length && minisCleared === MINIS.length;
  }

  function plainQuest(q) {
    if (!q) return null;
    return {
      key: q.key,
      label: q.label,
      prog: q.prog,
      target: q.target,
      done: q.done
    };
  }

  function updateQuestsFromStats(hint) {
    updateGoalProgressFromStats();
    updateMiniProgressFromStats();

    let questHint = hint || '';

    const newlyClearedGoals = GOALS.filter(g => g.done && !g._announced);
    const newlyClearedMinis = MINIS.filter(m => m.done && !m._announced);

    newlyClearedGoals.forEach(g => {
      g._announced = true;
      coach('ภารกิจหลักสำเร็จแล้ว! ' + (g.label || ''));
      questHint = questHint || 'Goal สำเร็จแล้ว';
    });

    newlyClearedMinis.forEach(m => {
      m._announced = true;
      coach('Mini quest สำเร็จแล้ว! ' + (m.label || ''));
      if (!questHint) questHint = 'Mini quest สำเร็จแล้ว';
    });

    pushQuest(questHint);
  }

  // ---------- Grade ----------
  function calcGrade({ scoreVal, goalsCleared, goalsTotal, miniCleared, miniTotal, missesVal }) {
    const gRatio = goalsTotal > 0 ? goalsCleared / goalsTotal : 0;
    const mRatio = miniTotal > 0 ? miniCleared / miniTotal : 0;
    const missPenalty = Math.min(missesVal || 0, 10) * 0.03; // สูงสุดหัก 0.3
    let base = (gRatio * 0.6) + (mRatio * 0.4) - missPenalty;
    if (base < 0) base = 0;

    if (base >= 0.95) return 'SSS';
    if (base >= 0.85) return 'SS';
    if (base >= 0.75) return 'S';
    if (base >= 0.60) return 'A';
    if (base >= 0.45) return 'B';
    return 'C';
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
    playSfx('sfx-fever');

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

  // ---------- Quest event push ----------
  function pushQuest(hint) {
    const goal = getCurrentGoal();
    const mini = getCurrentMini();

    emit('quest:update', {
      goal: plainQuest(goal),
      mini: plainQuest(mini),
      goalsAll: GOALS.map(plainQuest),
      minisAll: MINIS.map(plainQuest),
      hint: hint || ''
    });
  }

  // ---------- End ----------
  function emitEnd(reason) {
    const goalsCleared = GOALS.filter(g => g.done).length;
    const goalsTotal   = GOALS.length;
    const miniCleared  = MINIS.filter(m => m.done).length;
    const miniTotal    = MINIS.length;

    const grade = calcGrade({
      scoreVal: score,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal,
      missesVal: misses
    });

    emit('hha:end', {
      mode: 'Good vs Junk (VR)',
      score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal,
      grade,
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
        goalsCleared,
        goalsTotal,
        miniCleared,
        miniTotal,
        grade,
        gameDurationSec: currentDurationSec,
        gameVersion: 'GoodJunkVR-2025-12-08-ProdFX',
        reason: reason || 'normal'
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

      playSfx('sfx-bonus');

      const P1 = getParticles();
      if (P1) {
        P1.burstAt(sx, sy, {
          color: '#60a5fa',
          count: 10,
          radius: 40
        });
        P1.scorePop(sx, sy, 'Shield', {
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

      playSfx('sfx-bonus');

      const P2 = getParticles();
      if (P2) {
        P2.burstAt(sx, sy, {
          color: '#facc15',
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

      playSfx('sfx-bonus');

      const P3 = getParticles();
      if (P3) {
        P3.burstAt(sx, sy, {
          color: '#38bdf8',
          count: 16,
          radius: 70
        });
        P3.scorePop(sx, sy, '+' + scoreDelta, {
          kind: 'score'
        });
        P3.scorePop(sx, sy, 'BONUS', {
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

      if (judgment === 'Perfect') {
        playSfx('sfx-perfect');
      } else {
        playSfx('sfx-hit-good');
      }

      if (combo === 1)
        coach('เปิดคอมโบแล้ว! เลือกผัก ผลไม้ นมต่อเลย 🥦🍎🥛');
      else if (combo === 5)
        coach('คอมโบ x5 แล้ว เยี่ยมมาก! 🔥');
      else if (combo === 10)
        coach('สุดยอด! โปรโหมดแล้ว x10 เลย! 💪');
    } else {
      // junk — treat as Miss ถ้าไม่มีเกราะ
      if (shieldCount > 0) {
        shieldCount -= 1;
        if (FeverUI && FeverUI.setShield) FeverUI.setShield(shieldCount);
        coach('โชคดีมีเกราะกันไว้ ของขยะไม่ทำร้ายคะแนนรอบนี้ 🛡️');
        emitScore();
        emitJudge('Guard');

        playSfx('sfx-bonus');

        const Pguard = getParticles();
        if (Pguard) {
          Pguard.burstAt(sx, sy, {
            color: '#60a5fa',
            count: 10,
            radius: 40
          });
          Pguard.scorePop(sx, sy, 'BLOCK', {
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

      playSfx('sfx-miss');

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFever(nextFever, 'charge');
      }

      emitMiss();
      judgment = 'Miss';
    }

    emitScore();
    emitJudge(judgment);
    updateQuestsFromStats('');

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

      P.scorePop(sx, sy, String(judgment || '').toUpperCase(), {
        kind: 'judge',
        judgment: String(judgment || '').toUpperCase()
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

    // เคลียร์ทุกภารกิจแล้ว → จบเกม
    if (allQuestsCleared()) {
      coach('สุดยอด! เคลียร์ทุกภารกิจแล้ว 🎉');
      stop('all-quests-cleared');
    }
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

      playSfx('sfx-miss');

      let nextFever = fever - FEVER_MISS_LOSS;
      if (feverActive && nextFever <= 0) {
        endFever();
        nextFever = 0;
      } else {
        setFever(nextFever, 'charge');
      }

      emitMiss();
      emitScore();
      emitJudge('Miss');
      updateQuestsFromStats('');

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

      if (allQuestsCleared()) {
        coach('สุดยอด! เคลียร์ทุกภารกิจแล้ว 🎉');
        stop('all-quests-cleared');
      }
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

  // ---------- ตั้งค่า difficulty + duration-aware goals ----------
  function applyDifficulty(diffKey, durationSec) {
    const d = String(diffKey || 'normal').toLowerCase();
    currentDiff = d;
    currentDurationSec = durationSec || 60;

    const dur = currentDurationSec;
    const timeFactor = clamp(dur / 60, 0.5, 2.0); // รองรับประมาณ 30–120 วินาที

    let SPAWN_INTERVAL_BASE, TARGET_LIFETIME_BASE, MAX_ACTIVE_BASE;
    let typeWeights;
    let goodBaseMin, goodBaseMax, scoreBaseMin, scoreBaseMax;
    let comboBase;

    if (d === 'easy') {
      SPAWN_INTERVAL_BASE  = 1200;
      TARGET_LIFETIME_BASE = 1500;
      MAX_ACTIVE_BASE      = 3;
      GOOD_RATE            = 0.75;

      typeWeights = {
        good:    78,
        junk:    14,
        star:     3,
        diamond:  3,
        shield:   2
      };

      goodBaseMin = 14; goodBaseMax = 18;
      scoreBaseMin = 220; scoreBaseMax = 280;
      comboBase = [3, 5, 7];
    } else if (d === 'hard') {
      SPAWN_INTERVAL_BASE  = 750;
      TARGET_LIFETIME_BASE = 950;
      MAX_ACTIVE_BASE      = 5;
      GOOD_RATE            = 0.60;

      typeWeights = {
        good:    65,
        junk:    22,
        star:     5,
        diamond:  4,
        shield:   4
      };

      goodBaseMin = 22; goodBaseMax = 30;
      scoreBaseMin = 380; scoreBaseMax = 450;
      comboBase = [5, 9, 12];
    } else { // normal
      SPAWN_INTERVAL_BASE  = 950;
      TARGET_LIFETIME_BASE = 1200;
      MAX_ACTIVE_BASE      = 4;
      GOOD_RATE            = 0.68;

      typeWeights = {
        good:    70,
        junk:    18,
        star:     4,
        diamond:  4,
        shield:   4
      };

      goodBaseMin = 18; goodBaseMax = 22;
      scoreBaseMin = 260; scoreBaseMax = 320;
      comboBase = [4, 7, 10];
    }

    SPAWN_INTERVAL  = SPAWN_INTERVAL_BASE;
    TARGET_LIFETIME = TARGET_LIFETIME_BASE;
    MAX_ACTIVE      = MAX_ACTIVE_BASE;
    TYPE_WEIGHTS    = typeWeights;

    // scale goals ตามเวลา
    const goodTarget = Math.max(5,
      Math.round(randInt(goodBaseMin, goodBaseMax) * timeFactor)
    );
    const scoreTarget = Math.max(50,
      Math.round(randInt(scoreBaseMin, scoreBaseMax) * timeFactor)
    );

    const comboTargets = comboBase.map(base => {
      const scaled = Math.round(base * Math.sqrt(timeFactor));
      return Math.max(base, scaled);
    });

    // ตั้งค่า goals
    GOALS[0].target = goodTarget;
    GOALS[0].label  = `เก็บอาหารดีให้ครบ ${goodTarget} ชิ้น`;
    GOALS[0].prog   = 0;
    GOALS[0].done   = false;
    GOALS[0]._announced = false;

    GOALS[1].target = scoreTarget;
    GOALS[1].label  = `ทำคะแนนให้ได้อย่างน้อย ${scoreTarget} คะแนน`;
    GOALS[1].prog   = 0;
    GOALS[1].done   = false;
    GOALS[1]._announced = false;

    // ตั้งค่า minis (combo)
    MINIS.forEach((m, i) => {
      const comboNeed = comboTargets[i] || comboTargets[comboTargets.length - 1];
      m.target = comboNeed;  // ใช้เป็น max ของ progress bar
      m.label  = `รักษาคอมโบให้ถึง x${comboNeed} อย่างน้อย 1 ครั้ง`;
      m.prog   = 0;
      m.done   = false;
      m._announced = false;
    });
  }

  // ---------- start / stop ----------
  function _startCore(diffKey, durationSec) {
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

    resetQuests();
    applyDifficulty(diffKey, durationSec);

    if (FeverUI && FeverUI.ensureFeverBar) FeverUI.ensureFeverBar();
    if (FeverUI && FeverUI.setFever)       FeverUI.setFever(0);
    if (FeverUI && FeverUI.setShield)      FeverUI.setShield(shieldCount);
    if (FeverUI && FeverUI.setFeverActive) FeverUI.setFeverActive(false);

    fever = 0;
    feverActive = false;
    if (feverTimer) clearTimeout(feverTimer);
    setFever(0, 'charge');

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    emitScore();
    emitJudge('');
    coach('แตะเฉพาะอาหารดี เช่น ผัก ผลไม้ นม เลี่ยงของขยะนะ 🥦🍎🥛');

    updateQuestsFromStats('เริ่มเกม');

    tickSpawn();
    spawnTimer = setInterval(tickSpawn, SPAWN_INTERVAL);
  }

  function start(diffKey, durationSec) {
    if (running) return;
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[GoodJunkVR] ไม่พบ <a-scene>');
      return;
    }
    if (sceneEl.hasLoaded) {
      _startCore(diffKey, durationSec);
    } else {
      sceneEl.addEventListener('loaded', () => _startCore(diffKey, durationSec), { once: true });
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
