// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Emoji Pop Targets + Difficulty Quest + Fever + Shield + Coach
// ใช้ร่วม FeverUI (shared) + particles.js (GAME_MODULES.Particles / window.Particles)
// 2025-12-10 Multi-Quest + Research Metrics + Full Event Fields + Celebrate
// 2025-12-13 เพิ่ม runMode (play/research) + fixed quests สำหรับโหมดวิจัย

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
  let GOOD_RATE       = 0.65; // (ยังเก็บไว้ใช้เป็น reference)
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
  let sessionStartMs = 0;   // ใช้คำนวณ timeFromStartMs
  let currentDiff = 'normal';

  // runMode: 'play' หรือ 'research'
  let currentRunMode = 'play';

  // ---------- Quest state: หลาย goal / หลาย mini ----------
  let goals = [];
  let minis = [];
  let currentGoalIndex = 0;
  let currentMiniIndex = 0;
  let miniComboNeed = 5; // combo ที่ต้องการของ mini ปัจจุบัน

  // ---------- Metrics สำหรับงานวิจัย ----------
  let nTargetGoodSpawned    = 0;
  let nTargetJunkSpawned    = 0;
  let nTargetStarSpawned    = 0;
  let nTargetDiamondSpawned = 0;
  let nTargetShieldSpawned  = 0;

  let nHitGood       = 0;
  let nHitJunk       = 0;
  let nHitJunkGuard  = 0;
  let nExpireGood    = 0;

  let rtGoodList       = [];
  let nHitGoodPerfect  = 0;

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
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
  }

  function elapsedFromStartMs() {
    if (!sessionStartMs) return '';
    return Math.round(nowMs() - sessionStartMs);
  }

  function average(arr) {
    if (!arr || !arr.length) return null;
    const sum = arr.reduce((a, b) => a + b, 0);
    return sum / arr.length;
  }

  function median(arr) {
    if (!arr || !arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const n = sorted.length;
    const mid = Math.floor(n / 2);
    if (n % 2 === 1) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
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
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.55
    };
  }

  function judgeFromRT(rtMs) {
    if (rtMs == null || rtMs < 0) return 'Good';
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

  // ---------- helpers: quest ----------
  function currentGoal() {
    return goals[currentGoalIndex] || null;
  }
  function currentMini() {
    return minis[currentMiniIndex] || null;
  }

  function countDone(list) {
    return list.filter(q => q && q.done).length;
  }

  function allQuestsDone() {
    const goalsTotal = goals.length;
    const minisTotal = minis.length;
    const goalsDone = goalsTotal > 0 && goals.every(g => g.done);
    const minisDone = minisTotal > 0 && minis.every(m => m.done);
    return goalsTotal > 0 && minisTotal > 0 && goalsDone && minisDone;
  }

  function checkAllQuestsDone() {
    if (!running) return;
    if (allQuestsDone()) {
      coach('สุดยอด! ทำภารกิจหลักและ Mini quests ครบหมดแล้ว! 🎉');
      emit('quest:all-complete', {
        goalsTotal: goals.length,
        minisTotal: minis.length
      });

      // หน่วงเวลาให้ฉลองใหญ่ ก่อนค่อยจบเกม + สรุปผล
      setTimeout(() => {
        if (running) {
          stop('quest-complete');
        }
      }, 1800);
    }
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
    const g = currentGoal();
    const m = currentMini();

    let goalObj;
    if (g) {
      goalObj = {
        id: g.id,
        label: g.label,
        prog: Math.min(g.prog, g.target),
        target: g.target,
        done: g.done
      };
    } else {
      goalObj = {
        id: 'ALL',
        label: 'ภารกิจหลักครบแล้ว 🎉',
        prog: 1,
        target: 1,
        done: true
      };
    }

    let miniObj;
    if (m) {
      miniObj = {
        id: m.id,
        label: m.label,
        prog: Math.min(m.prog, m.target),
        target: m.target,
        done: m.done
      };
    } else {
      miniObj = {
        id: 'ALL',
        label: 'Mini quest ครบแล้ว ✅',
        prog: 1,
        target: 1,
        done: true
      };
    }

    emit('quest:update', {
      goal: goalObj,
      mini: miniObj,
      goalsAll: goals.map(x => ({
        id: x.id,
        label: x.label,
        prog: x.prog,
        target: x.target,
        done: x.done
      })),
      minisAll: minis.map(x => ({
        id: x.id,
        label: x.label,
        prog: x.prog,
        target: x.target,
        done: x.done
      })),
      hint: hint || ''
    });
  }

  function updateGoalFromGoodHit() {
    const g = currentGoal();
    if (!g || g.done) return;

    g.prog += 1;

    if (g.prog >= g.target) {
      g.prog = g.target;
      g.done = true;

      const doneCount = countDone(goals);
      const total = goals.length;

      // ปล่อย event ฉลองจบ Goal
      emit('quest:celebrate', {
        kind: 'goal',
        id: g.id,
        label: g.label,
        index: doneCount,
        total
      });

      if (doneCount < total) {
        currentGoalIndex = doneCount;
        coach(`ภารกิจหลักข้อที่ ${doneCount} สำเร็จแล้ว! ไปต่อข้อที่ ${doneCount + 1} 🎯`);
        pushQuest('Goal ถัดไปเริ่มแล้ว');
      } else {
        coach('ภารกิจหลักทุกข้อสำเร็จครบแล้ว 🎉');
        pushQuest('Goals ครบแล้ว');
        checkAllQuestsDone();
      }
    } else {
      pushQuest('');
    }
  }

  function updateMiniFromCombo() {
    const m = currentMini();
    if (!m || m.done) return;

    const need = m.comboNeed || miniComboNeed || 5;
    if (combo >= need) {
      m.prog = 1;
      m.done = true;

      const doneCount = countDone(minis);
      const total = minis.length;

      // ปล่อย event ฉลองจบ Mini quest
      emit('quest:celebrate', {
        kind: 'mini',
        id: m.id,
        label: m.label,
        index: doneCount,
        total
      });

      if (doneCount < total) {
        currentMiniIndex = doneCount;
        const next = currentMini();
        miniComboNeed = (next && next.comboNeed) ? next.comboNeed : miniComboNeed;

        coach(
          `Mini quest ข้อที่ ${doneCount} สำเร็จแล้ว! ต่อไปลองคอมโบให้ถึง x${miniComboNeed} ดูนะ 🎯`
        );
        pushQuest('Mini quest ถัดไปเริ่มแล้ว');
      } else {
        coach('Mini quests ทุกข้อสำเร็จแล้ว ✅');
        pushQuest('Mini quests ครบแล้ว');
        checkAllQuestsDone();
      }
    } else {
      pushQuest('');
    }
  }

  // ---------- สร้าง summary metrics สำหรับ session ----------
  function buildSessionMetrics() {
    const totalGoodSpawn = nTargetGoodSpawned;
    const totalGoodHit   = nHitGood;
    const totalHitsAll   = nHitGood + nHitJunk + nHitJunkGuard;

    let accuracyGoodPct  = '';
    let junkErrorPct     = '';
    let avgRtGoodMs      = '';
    let medianRtGoodMs   = '';
    let fastHitRatePct   = '';

    if (totalGoodSpawn > 0) {
      accuracyGoodPct = Math.round((totalGoodHit / totalGoodSpawn) * 100);
    }

    if (totalHitsAll > 0) {
      const junkErr = (nHitJunk + nHitJunkGuard) / totalHitsAll;
      junkErrorPct = Math.round(junkErr * 100);
    }

    if (rtGoodList.length > 0) {
      const avg = average(rtGoodList);
      const med = median(rtGoodList);
      if (avg != null)    avgRtGoodMs    = Math.round(avg);
      if (med != null)    medianRtGoodMs = Math.round(med);
      if (nHitGood > 0) {
        fastHitRatePct = Math.round((nHitGoodPerfect / nHitGood) * 100);
      }
    }

    return {
      nTargetGoodSpawned,
      nTargetJunkSpawned,
      nTargetStarSpawned,
      nTargetDiamondSpawned,
      nTargetShieldSpawned,
      nHitGood,
      nHitJunk,
      nHitJunkGuard,
      nExpireGood,
      accuracyGoodPct,
      junkErrorPct,
      avgRtGoodMs,
      medianRtGoodMs,
      fastHitRatePct
    };
  }

  function emitEnd(reason) {
    const goalsTotal = goals.length;
    const minisTotal = minis.length;
    const goalsCleared = countDone(goals);
    const miniCleared  = countDone(minis);

    emit('hha:end', {
      mode: 'Good vs Junk (VR)',
      runMode: currentRunMode,
      score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal: minisTotal,
      reason: reason || 'normal'
    });

    try {
      const endTime = new Date();
      const durationSecPlayed = sessionStart
        ? Math.round((endTime - sessionStart) / 1000)
        : 0;

      const metrics = buildSessionMetrics();

      emit('hha:session', {
        sessionId,
        mode: 'GoodJunkVR',
        runMode: currentRunMode,
        difficulty: currentDiff,
        device: typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '',
        startTimeIso: sessionStart ? sessionStart.toISOString() : '',
        endTimeIso: endTime.toISOString(),
        durationSecPlayed,
        scoreFinal: score,
        comboMax,
        misses,
        gameVersion: 'GoodJunkVR-2025-12-10-Stats-MQ-FullEvent',
        reason: reason || 'normal',

        goalsCleared,
        goalsTotal,
        miniCleared,
        miniTotal: minisTotal,

        nTargetGoodSpawned:    metrics.nTargetGoodSpawned,
        nTargetJunkSpawned:    metrics.nTargetJunkSpawned,
        nTargetStarSpawned:    metrics.nTargetStarSpawned,
        nTargetDiamondSpawned: metrics.nTargetDiamondSpawned,
        nTargetShieldSpawned:  metrics.nTargetShieldSpawned,
        nHitGood:              metrics.nHitGood,
        nHitJunk:              metrics.nHitJunk,
        nHitJunkGuard:         metrics.nHitJunkGuard,
        nExpireGood:           metrics.nExpireGood,
        accuracyGoodPct:       metrics.accuracyGoodPct,
        junkErrorPct:          metrics.junkErrorPct,
        avgRtGoodMs:           metrics.avgRtGoodMs,
        medianRtGoodMs:        metrics.medianRtGoodMs,
        fastHitRatePct:        metrics.fastHitRatePct
      });
    } catch (err) {
      console.warn('[GoodJunkVR] emitEnd metrics error', err);
    }
  }

  // ---------- helper: ยิง event พร้อม field วิจัย ----------
  function emitGameEvent(base, el) {
    const timeFromStartMs = elapsedFromStartMs();

    const g = currentGoal();
    const m = currentMini();

    let goalProgress = '';
    if (g) {
      goalProgress = `${g.prog}/${g.target}`;
    } else if (goals.length) {
      goalProgress = `${countDone(goals)}/${goals.length}`;
    }

    let miniProgress = '';
    if (m) {
      miniProgress = `${m.prog}/${m.target}`;
    } else if (minis.length) {
      miniProgress = `${countDone(minis)}/${minis.length}`;
    }

    const feverState = feverActive ? 'active' : 'charge';
    const feverValue = fever;

    const targetId =
      el && el.dataset
        ? (el.dataset.tid || '')
        : (base.targetId || '');

    // spawnX / side สำหรับเปรียบเทียบ RT zone ซ้าย/ขวา
    let spawnX = null;
    let spawnSide = '';
    if (el && el.dataset && el.dataset.spawnX !== undefined) {
      const x = parseFloat(el.dataset.spawnX);
      if (!Number.isNaN(x)) {
        spawnX = x;
        spawnSide = (x < 0 ? 'L' : (x > 0 ? 'R' : 'C'));
      }
    }

    const goalIdActive = g ? g.id : '';
    const miniIdActive = m ? m.id : '';

    emit('hha:event', {
      sessionId,
      mode: 'GoodJunkVR',
      runMode: currentRunMode,
      difficulty: currentDiff,
      timeFromStartMs,
      targetId,
      feverState,
      feverValue,
      goalProgress,
      miniProgress,
      goalIdActive,
      miniIdActive,
      spawnX,
      spawnSide,
      ...base
    });
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

    // id สำหรับ target นี้ (ไว้ log)
    const targetId =
      't-' + Date.now().toString(36) + '-' +
      Math.random().toString(16).slice(2, 6);
    root.dataset.tid = targetId;

    const x = -1.3 + Math.random() * 2.6;   // [-1.3, 1.3]
    const y = 2.0  + Math.random() * 1.0;   // [2.0, 3.0]
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.classList.add('gj-target');
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;
    root.dataset.spawnAt = String(nowMs());
    // เก็บตำแหน่ง X ไว้ใช้วิเคราะห์ (ซ้าย/ขวา/กลาง)
    root.dataset.spawnX = String(x);

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

      emitGameEvent({
        type: 'bonus',
        eventType: 'bonus',
        emoji,
        itemType: 'shield',
        lane: 0,
        rtMs,
        judgment: 'Shield',
        totalScore: score,
        combo,
        isGood: true,
        extra: ''
      }, el);
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

      emitGameEvent({
        type: 'bonus',
        eventType: 'bonus',
        emoji,
        itemType: 'star',
        lane: 0,
        rtMs,
        judgment: 'Bonus',
        totalScore: score,
        combo,
        isGood: true,
        extra: ''
      }, el);
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

      emitGameEvent({
        type: 'bonus',
        eventType: 'bonus',
        emoji,
        itemType: 'diamond',
        lane: 0,
        rtMs,
        judgment: 'Bonus',
        totalScore: score,
        combo,
        isGood: true,
        extra: ''
      }, el);
      return;
    }

    // ---------- good / junk ----------
    if (kind === 'good') {
      goodHit++;
      nHitGood++;

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

      if (rtMs != null && rtMs >= 0) {
        rtGoodList.push(rtMs);
        if (judgment === 'Perfect') {
          nHitGoodPerfect++;
        }
      }

      if (combo === 1)
        coach('เปิดคอมโบแล้ว! เลือกผัก ผลไม้ นมต่อเลย 🥦🍎🥛');
      else if (combo === miniComboNeed)
        coach(`คอมโบ x${miniComboNeed} แล้ว เยี่ยมมาก! 🔥`);
      else if (combo === 10)
        coach('สุดยอด! โปรโหมดแล้ว x10 เลย! 💪');

      updateGoalFromGoodHit();
      updateMiniFromCombo();
    } else {
      // junk — treat as Miss
      if (shieldCount > 0) {
        shieldCount -= 1;
        nHitJunkGuard++;

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

        emitGameEvent({
          type: 'hit-junk-guard',
          eventType: 'hit-junk-guard',
          emoji,
          itemType: 'junk',
          lane: 0,
          rtMs,
          judgment: 'BLOCK',
          totalScore: score,
          combo,
          isGood: false,
          extra: ''
        }, el);
        return;
      }

      junkHit++;
      nHitJunk++;

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
      pushQuest('');
      judgment = 'Miss';
    }

    emitScore();
    emitJudge(judgment);

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
        count: goodFlag ? 24 : 16,
        radius: goodFlag ? 70 : 55,
        good: goodFlag
      });

      if (scoreDelta) {
        const text =
          scoreDelta > 0 ? '+' + scoreDelta : String(scoreDelta);
        P.scorePop(sx, sy, text, {
          kind: 'score',
          judgment: jUpper,
          good: goodFlag
        });
      } else {
        P.scorePop(sx, sy, jUpper, {
          kind: 'judge',
          judgment: jUpper,
          good: goodFlag
        });
      }
    }

    // event log (good / junk ปกติ)
    emitGameEvent({
      type: kind === 'good' ? 'hit-good' : 'hit-junk',
      eventType: kind === 'good' ? 'hit-good' : 'hit-junk',
      emoji,
      itemType: kind,
      lane: 0,
      rtMs,
      judgment,
      totalScore: score,
      combo,
      isGood: kind === 'good',
      extra: ''
    }, el);
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
      nExpireGood++;

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
      pushQuest('');
      emitJudge('Miss');

      const P = getParticles();
      if (P) {
        P.burstAt(sx, sy, {
          color: '#f97316',
          count: 16,
          radius: 55
        });
        P.scorePop(sx, sy, 'MISS', {
          kind: 'judge',
          judgment: 'MISS',
          good: false
        });
      }

      emitGameEvent({
        type: 'expire-good',
        eventType: 'expire-good',
        emoji,
        itemType: kind,
        lane: 0,
        rtMs,
        judgment: 'Miss',
        totalScore: score,
        combo,
        isGood: false,
        extra: ''
      }, el);
    } else {
      emitGameEvent({
        type: 'expire-' + kind,
        eventType: 'expire-' + kind,
        emoji,
        itemType: kind,
        lane: 0,
        rtMs,
        judgment: '',
        totalScore: score,
        combo,
        isGood: false,
        extra: ''
      }, el);
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
      nTargetGoodSpawned++;
    } else if (type === 'junk') {
      emoji = JUNK[Math.floor(Math.random() * JUNK.length)];
      kind  = 'junk';
      nTargetJunkSpawned++;
    } else if (type === 'star') {
      emoji = STAR_EMOJI;
      kind  = 'star';
      nTargetStarSpawned++;
    } else if (type === 'diamond') {
      emoji = DIAMOND_EMOJI;
      kind  = 'diamond';
      nTargetDiamondSpawned++;
    } else {
      emoji = SHIELD_EMOJI;
      kind  = 'shield';
      nTargetShieldSpawned++;
    }

    const el = createTargetEntity(emoji, kind);
    if (el) activeTargets.push(el);
  }

  // ---------- อ่าน runMode จาก URL หรือ global ----------
  function refreshRunMode() {
    let mode = 'play';
    try {
      const url = new URL(window.location.href);
      const v = (url.searchParams.get('run') || '').toLowerCase();
      if (v === 'research') mode = 'research';
    } catch (err) {
      const g = (window.HHA_RUNMODE || '').toLowerCase();
      if (g === 'research') mode = 'research';
    }
    currentRunMode = mode;
  }

  // ---------- สร้าง quests ตามระดับความยาก ----------
  function setupQuestsForDifficulty(d) {
    goals = [];
    minis = [];
    currentGoalIndex = 0;
    currentMiniIndex = 0;

    const isResearch = (currentRunMode === 'research');

    let g1, g2, c1, c2, c3;

    if (isResearch) {
      // โหมดวิจัย: ใช้ค่าคงที่ เพื่อให้ภาระงานเท่ากันทุกคน
      if (d === 'easy') {
        g1 = 12; g2 = 16;
        c1 = 4;  c2 = 5;  c3 = 6;
      } else if (d === 'hard') {
        g1 = 24; g2 = 28;
        c1 = 6;  c2 = 7;  c3 = 8;
      } else { // normal
        g1 = 20; g2 = 24;
        c1 = 5;  c2 = 6;  c3 = 7;
      }
    } else {
      // โหมดเล่นปกติ: ใช้ช่วงสุ่มเดิม ให้เล่นสนุกหลากหลาย
      if (d === 'easy') {
        g1 = randInt(10, 14);
        g2 = randInt(12, 16);
        c1 = randInt(3, 4);
        c2 = randInt(4, 5);
        c3 = randInt(5, 6);
      } else if (d === 'hard') {
        g1 = randInt(22, 26);
        g2 = randInt(24, 30);
        c1 = randInt(5, 7);
        c2 = randInt(6, 8);
        c3 = randInt(7, 9);
      } else { // normal
        g1 = randInt(18, 22);
        g2 = randInt(20, 26);
        c1 = randInt(4, 6);
        c2 = randInt(5, 7);
        c3 = randInt(6, 8);
      }
    }

    goals.push(
      {
        id: 'G1',
        label: `Goal 1: เก็บอาหารดีให้ครบ ${g1} ชิ้น`,
        target: g1,
        prog: 0,
        done: false
      },
      {
        id: 'G2',
        label: `Goal 2: เก็บอาหารดีเพิ่มให้ครบ ${g2} ชิ้น`,
        target: g2,
        prog: 0,
        done: false
      }
    );

    minis.push(
      {
        id: 'M1',
        label: `Mini 1: รักษาคอมโบให้ถึง x${c1} อย่างน้อย 1 ครั้ง`,
        target: 1,
        prog: 0,
        done: false,
        comboNeed: c1
      },
      {
        id: 'M2',
        label: `Mini 2: รักษาคอมโบให้ถึง x${c2} อย่างน้อย 1 ครั้ง`,
        target: 1,
        prog: 0,
        done: false,
        comboNeed: c2
      },
      {
        id: 'M3',
        label: `Mini 3: รักษาคอมโบให้ถึง x${c3} อย่างน้อย 1 ครั้ง`,
        target: 1,
        prog: 0,
        done: false,
        comboNeed: c3
      }
    );

    const firstMini = minis[0] || null;
    miniComboNeed = firstMini ? firstMini.comboNeed : 5;
  }

  // ---------- ตั้งค่า difficulty ----------
  function applyDifficulty(diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    currentDiff = d;

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
    }

    setupQuestsForDifficulty(d);
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

    nTargetGoodSpawned    = 0;
    nTargetJunkSpawned    = 0;
    nTargetStarSpawned    = 0;
    nTargetDiamondSpawned = 0;
    nTargetShieldSpawned  = 0;

    nHitGood      = 0;
    nHitJunk      = 0;
    nHitJunkGuard = 0;
    nExpireGood   = 0;

    rtGoodList      = [];
    nHitGoodPerfect = 0;

    sessionId = 'gjvr-' + Date.now().toString(36) + '-' +
      Math.random().toString(16).slice(2, 8);
    sessionStart = new Date();
    sessionStartMs = nowMs();

    // อ่าน runMode ก่อน ตั้ง quest / difficulty
    refreshRunMode();
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
