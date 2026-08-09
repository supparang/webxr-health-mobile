/* HeroHealth Shared Firebase Game Receipt Bridge R5
 * Passport completion authority + append-only learning analytics.
 * Stores the latest result for resume/unlock and every completed attempt for research.
 */
(() => {
  'use strict';

  const RELEASE = '20260809-FIREBASE-GAME-RECEIPT-BRIDGE-R5-SANDBOX-ROUTING';
  const SCHEMA = 'HH-LEARNING-ANALYTICS-V1';
  const query = new URLSearchParams(location.search);
  if (String(query.get('authority') || '').toLowerCase() !== 'firebase') return;
  if (window.__HH_FIREBASE_GAME_RECEIPT_R5__) return;
  window.__HH_FIREBASE_GAME_RECEIPT_R5__ = true;

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBdlWEf91s2gzUQf7H1pPB8c_hF807CpAc',
    authDomain: 'herohealth-learning.firebaseapp.com',
    projectId: 'herohealth-learning',
    storageBucket: 'herohealth-learning.firebasestorage.app',
    messagingSenderId: '161380004818',
    appId: '1:161380004818:web:7d8ef81c55eebd6b1a8e0b'
  };

  const GAME_MAP = {
    handwash: { zone: 'hygiene', key: 'handwash' },
    'hand-wash': { zone: 'hygiene', key: 'handwash' },
    toothbrush: { zone: 'hygiene', key: 'toothbrush' },
    brush: { zone: 'hygiene', key: 'toothbrush' },
    groups: { zone: 'nutrition', key: 'groups' },
    foodgroups: { zone: 'nutrition', key: 'groups' },
    'food-groups': { zone: 'nutrition', key: 'groups' },
    goodjunk: { zone: 'nutrition', key: 'goodjunk' },
    'good-junk': { zone: 'nutrition', key: 'goodjunk' },
    jumpduck: { zone: 'fitness', key: 'jumpduck' },
    'jump-duck': { zone: 'fitness', key: 'jumpduck' },
    balance: { zone: 'fitness', key: 'balance' },
    'balance-hold': { zone: 'fitness', key: 'balance' },
    balancehold: { zone: 'fitness', key: 'balance' }
  };

  const studentId = String(query.get('studentId') || query.get('sid') || query.get('pid') || '').trim();
  const isSandboxStudent = /^9900(0[1-9]|1[0-9]|2[0-9])$/.test(studentId);
  const collectionName = isSandboxStudent ? 'studentProgressSandbox' : 'studentProgress';
  let saving = false;
  let savedEventId = '';
  let toothbrushObserved = false;

  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
  const round1 = value => Math.round((Number(value) || 0) * 10) / 10;
  const cleanKey = value => String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const bool = value => value === true || value === 1 || String(value).toLowerCase() === 'true';
  const numberFrom = value => {
    const match = String(value || '').match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  };
  const fractionFrom = value => {
    const match = String(value || '').match(/(\d+)\s*\/\s*(\d+)/);
    return match ? { value: Number(match[1]), total: Number(match[2]) } : { value: 0, total: 0 };
  };
  const firstFinite = (...values) => values.map(finite).find(value => value !== null);
  const nowIso = () => new Date().toISOString();
  const dayKeyBangkok = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date());
      const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
      return `${map.year}-${map.month}-${map.day}`;
    } catch (_) {
      return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    }
  };

  function firestoreSafe(value, depth = 0) {
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return null;
    if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
      if (depth >= 1 && value.some(Array.isArray)) return JSON.stringify(value);
      return value.slice(0, 200).map(item => firestoreSafe(item, depth + 1));
    }
    if (typeof value === 'object') {
      const out = {};
      for (const [rawKey, rawValue] of Object.entries(value)) {
        const key = String(rawKey).replace(/[.$#[\]/]/g, '_').slice(0, 120);
        if (!key) continue;
        const safe = firestoreSafe(rawValue, depth + 1);
        if (safe !== null) out[key] = safe;
      }
      return out;
    }
    return String(value);
  }

  function identifyGame(payload = {}) {
    const candidates = [
      payload.gameId, payload.game_id, payload.gameKey, payload.game_key,
      payload.game?.gameId, payload.game?.game_id, payload.game?.gameKey,
      query.get('gameId'), query.get('game'), query.get('mission')
    ];
    for (const candidate of candidates) {
      const raw = cleanKey(candidate);
      if (GAME_MAP[raw]) return GAME_MAP[raw];
      const compact = raw.replace(/-/g, '');
      if (GAME_MAP[compact]) return GAME_MAP[compact];
    }
    const target = cleanKey(query.get('target') || location.pathname);
    for (const [key, game] of Object.entries(GAME_MAP)) if (target.includes(key)) return game;
    return null;
  }

  function commonAnalytics(data, game, score) {
    const durationSec = firstFinite(data.durationSec, data.duration, data.elapsedSec, data.playTimeSec, data.timeSec, data.roundTime);
    const accuracy = firstFinite(data.accuracy, data.accuracyPct, data.masteryPct, data.correctPct, data.percentage);
    const correct = firstFinite(data.correct, data.correctCount, data.hits, data.successCount);
    const wrong = firstFinite(data.wrong, data.wrongCount, data.misses, data.errorCount);
    const total = firstFinite(data.total, data.totalItems, data.targetsTotal, data.attempted,
      correct !== null && wrong !== null ? correct + wrong : null);
    const responseMs = firstFinite(data.averageResponseMs, data.avgResponseMs, data.responseTimeMs, data.meanReactionMs);
    const inputMode = String(data.inputMode || data.controlMode || data.detectionMode || query.get('inputMode') || '').trim();
    const detectionConfidence = firstFinite(data.detectionConfidence, data.trackingConfidence, data.poseConfidence, data.handConfidence);
    return firestoreSafe({
      schemaVersion: SCHEMA,
      identity: {
        studentId,
        section: query.get('section') || '',
        group: query.get('group') || '',
        studyId: query.get('studyId') || '',
        conditionGroup: query.get('conditionGroup') || ''
      },
      context: {
        zone: game.zone,
        gameId: game.key,
        difficulty: data.difficulty || data.difficultyLevel || query.get('difficulty') || '',
        phase: data.phase || query.get('phase') || '',
        inputMode,
        authority: 'firebase'
      },
      performance: {
        score: round1(score), scoreScale: 100,
        accuracy: accuracy === null ? null : round1(clamp(accuracy)),
        correct, wrong, total,
        passed: bool(data.passed ?? data.completed ?? data.missionCompleted ?? data.skillPassed)
      },
      process: {
        durationSec: durationSec === null ? null : round1(durationSec),
        averageResponseMs: responseMs === null ? null : round1(responseMs),
        hintsUsed: firstFinite(data.hintsUsed, data.hintCount),
        retries: firstFinite(data.retries, data.retryCount),
        attemptsWithinRound: firstFinite(data.attempts, data.attemptCount)
      },
      engagement: {
        bestCombo: firstFinite(data.bestCombo, data.maxCombo, data.combo),
        level: firstFinite(data.level, data.difficultyLevel),
        bossCompleted: bool(data.bossCompleted ?? data.bossPassed)
      },
      device: {
        userAgent: navigator.userAgent.slice(0, 300),
        platform: navigator.platform || '',
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        touchPoints: navigator.maxTouchPoints || 0,
        detectionConfidence: detectionConfidence === null ? null : round1(detectionConfidence)
      },
      researchMetadata: {
        bridgeRelease: RELEASE,
        schemaVersion: SCHEMA,
        completedAtClient: nowIso(),
        dayKeyBangkok: dayKeyBangkok()
      }
    });
  }

  function gameSpecificAnalytics(data, game) {
    if (game.key === 'jumpduck') {
      const jumpCount = firstFinite(data.jumpCount, data.jumps, data.jumpSuccess);
      const duckCount = firstFinite(data.duckCount, data.ducks, data.duckSuccess);
      const leftCount = firstFinite(data.leftCount, data.leftMoves, data.leftSuccess);
      const rightCount = firstFinite(data.rightCount, data.rightMoves, data.rightSuccess);
      const collisions = firstFinite(data.collisions, data.collisionCount, data.hitsTaken);
      const avoided = firstFinite(data.obstaclesAvoided, data.avoidedCount, data.dodged);
      const collected = firstFinite(data.collectedCount, data.itemsCollected, data.pickups);
      const movementAttempts = [jumpCount, duckCount, leftCount, rightCount]
        .filter(value => value !== null).reduce((sum, value) => sum + value, 0);
      return firestoreSafe({
        motorSkill: {
          jumpCount, duckCount, leftCount, rightCount,
          movementAttempts,
          movementAccuracy: firstFinite(data.movementAccuracy, data.poseAccuracy, data.actionAccuracy),
          averageResponseMs: firstFinite(data.averageResponseMs, data.avgResponseMs, data.reactionMs)
        },
        gameplay: {
          obstaclesAvoided: avoided,
          collisions,
          collectedCount: collected,
          survivalSec: firstFinite(data.survivalSec, data.durationSec, data.elapsedSec),
          bestCombo: firstFinite(data.bestCombo, data.maxCombo),
          livesRemaining: firstFinite(data.livesRemaining, data.lives),
          calibrationQuality: firstFinite(data.calibrationQuality, data.calibrationScore)
        }
      });
    }
    if (game.key === 'balance') {
      return firestoreSafe({
        balanceSkill: {
          posesAttempted: firstFinite(data.posesAttempted, data.poseCount),
          posesPassed: firstFinite(data.posesPassed, data.passedPoses),
          totalHoldSec: firstFinite(data.totalHoldSec, data.holdDurationSec),
          averageHoldSec: firstFinite(data.averageHoldSec, data.avgHoldSec),
          stabilityScore: firstFinite(data.stabilityScore, data.stability),
          alignmentAccuracy: firstFinite(data.alignmentAccuracy, data.alignmentScore),
          swayScore: firstFinite(data.swayScore, data.sway),
          breakCount: firstFinite(data.breakCount, data.poseBreaks),
          bossPosePassed: bool(data.bossPosePassed ?? data.bossPassed)
        }
      });
    }
    if (game.key === 'handwash') {
      return firestoreSafe({
        hygieneSkill: {
          whoStepsCompleted: firstFinite(data.whoStepsCompleted, data.stepsCompleted),
          whoStepsTotal: firstFinite(data.whoStepsTotal, data.stepsTotal),
          rubDone: firstFinite(data.rubDone), rubTotal: firstFinite(data.rubTotal),
          processDone: firstFinite(data.processDone), processTotal: firstFinite(data.processTotal),
          wristsPassed: bool(data.wristsPassed),
          whoAccuracy: firstFinite(data.whoAccuracy, data.accuracy),
          metricCompletenessPct: firstFinite(data.metricCompletenessPct),
          analyticsReady: bool(data.analyticsReady)
        }
      });
    }
    if (game.key === 'toothbrush') {
      return firestoreSafe({
        oralHealthSkill: {
          zonesCompleted: firstFinite(data.zonesCompleted), zonesTotal: firstFinite(data.zonesTotal),
          plaqueTargetsCleared: firstFinite(data.plaqueTargetsCleared),
          plaqueTargetsTotal: firstFinite(data.plaqueTargetsTotal),
          directionAccuracy: firstFinite(data.directionAccuracy),
          trackingAccuracy: firstFinite(data.trackingAccuracy),
          coveragePct: firstFinite(data.coveragePct, data.coverage)
        }
      });
    }
    if (game.key === 'groups') {
      return firestoreSafe({
        nutritionSkill: {
          firstAttemptAccuracy: firstFinite(data.firstAttemptAccuracy),
          reasonAccuracy: firstFinite(data.reasonAccuracy),
          correctionRate: firstFinite(data.correctionRate),
          masteryByFoodGroup: data.masteryByFoodGroup || data.mastery || {},
          bossCompleted: bool(data.bossCompleted)
        }
      });
    }
    if (game.key === 'goodjunk') {
      return firestoreSafe({
        nutritionSkill: {
          reasonAccuracy: firstFinite(data.reasonAccuracy, data.reasonPct),
          transferAccuracy: firstFinite(data.retryTransferAccuracy, data.transferAccuracy),
          mastery: data.mastery || data.masteryByTopic || {},
          reflectionChoice: data.reflectionChoice || data.reflection || '',
          confidencePct: firstFinite(data.confidencePct, data.confidence),
          rank: data.rank || '',
          progressionEligible: bool(data.progressionEligible ?? data.completed)
        }
      });
    }
    return {};
  }

  function normalizePayload(raw, game) {
    const source = raw?.payload && typeof raw.payload === 'object' ? raw.payload : raw;
    const data = source?.game && typeof source.game === 'object' ? { ...source, ...source.game } : { ...(source || {}) };
    const scoreCandidates = [data.normalizedScore, data.score, data.masteryPct, data.accuracy, data.percentage, data.percent];
    let score = scoreCandidates.map(Number).find(Number.isFinite);
    if (!Number.isFinite(score)) {
      const correct = Number(data.correct ?? data.correctCount ?? data.hits ?? data.successCount);
      const total = Number(data.total ?? data.totalItems ?? data.targetsTotal ?? data.attempted);
      score = total > 0 ? correct * 100 / total : 100;
    }
    score = round1(clamp(score));
    const passed = bool(data.passed ?? data.completed ?? data.missionCompleted ?? data.skillPassed);
    const eventId = String(data.eventId || data.attemptId || data.runId || `${game.key}-${Date.now()}`);
    const attemptId = `${studentId}_${game.key}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return firestoreSafe({
      ...data,
      gameId: game.key,
      zone: game.zone,
      completed: passed,
      passed,
      score,
      scoreScale: 100,
      eventId,
      attemptId,
      firebaseBridgeRelease: RELEASE,
      analyticsSchemaVersion: SCHEMA,
      completedAtClient: nowIso(),
      learningAnalytics: {
        ...commonAnalytics(data, game, score),
        ...gameSpecificAnalytics(data, game)
      }
    });
  }

  function setShellStatus(text, error = false) {
    for (const id of ['status', 'receiptStatus', 'syncStatus', 'returnStatus']) {
      const node = document.getElementById(id);
      if (node) { node.textContent = text; node.style.color = error ? '#fecaca' : ''; }
    }
    const back = document.getElementById('back');
    if (back) {
      back.disabled = !error;
      back.textContent = error ? 'ลองบันทึก Firebase อีกครั้ง' : text;
    }
  }

  function returnToPassport(game, receiptToken) {
    const target = query.get('return') || './index.html';
    const url = new URL(target, location.href);
    for (const key of ['studentId','sid','pid','fullName','studentName','name','section','group','firebaseUid']) {
      const value = query.get(key);
      if (value) url.searchParams.set(key, value);
    }
    url.searchParams.set('studentId', studentId);
    url.searchParams.set('sid', studentId);
    url.searchParams.set('authority', 'firebase');
    url.searchParams.set('firebaseReady', '1');
    url.searchParams.set('firebaseReceipt', '1');
    url.searchParams.set('returnedGame', game.key);
    url.searchParams.set('gameCompleted', '1');
    url.searchParams.set('receiptToken', receiptToken);
    url.searchParams.set('analyticsSchema', SCHEMA);
    url.searchParams.set('v', RELEASE);
    location.replace(url.href);
  }

  async function persist(raw) {
    if (saving || !studentId) return;
    const game = identifyGame(raw);
    if (!game) return;
    const result = normalizePayload(raw, game);
    if (!result.completed || savedEventId === result.eventId) return;
    saving = true;
    setShellStatus(`กำลังบันทึก ${game.key} และ Learning Analytics ลง Firebase…`);

    try {
      const [{ initializeApp, getApps }, { getAuth, signInAnonymously }, { getFirestore, doc, setDoc, getDoc, serverTimestamp }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js')
      ]);
      const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
      const auth = getAuth(app);
      if (!auth.currentUser) await signInAnonymously(auth);
      const uid = auth.currentUser.uid;
      const db = getFirestore(app);
      const receiptToken = `${game.key.toUpperCase()}-${studentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ref = doc(db, collectionName, studentId);
      const beforeSnap = await getDoc(ref);
      const before = beforeSnap.data() || {};
      const priorGameAttempts = Number(before.analyticsSummary?.[game.key]?.attemptCount || 0);
      const dayKey = dayKeyBangkok();
      const attemptRecord = firestoreSafe({
        ...result,
        firebaseReceiptToken: receiptToken,
        firebaseSavedByUid: uid,
        serverWriteRequestedAtClient: nowIso()
      });

      await setDoc(ref, {
        studentId,
        gameCompleted: { [game.zone]: { [game.key]: true } },
        gameResults: { [game.key]: attemptRecord },
        attemptHistory: { [result.attemptId]: attemptRecord },
        analyticsSummary: {
          [game.key]: {
            attemptCount: priorGameAttempts + 1,
            lastAttemptId: result.attemptId,
            lastScore: result.score,
            bestScore: Math.max(Number(before.analyticsSummary?.[game.key]?.bestScore || 0), Number(result.score || 0)),
            lastCompletedAtClient: result.completedAtClient,
            schemaVersion: SCHEMA
          }
        },
        dailyAnalytics: {
          [dayKey]: {
            [game.key]: {
              lastAttemptId: result.attemptId,
              lastScore: result.score,
              completed: true,
              updatedAtClient: result.completedAtClient
            }
          }
        },
        currentZone: game.zone,
        lastGame: game.key,
        lastGameScore: result.score,
        lastAttemptId: result.attemptId,
        firebaseReceiptToken: receiptToken,
        firebaseSavedByUid: uid,
        analyticsSchemaVersion: SCHEMA,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const verified = await getDoc(ref);
      const saved = verified.data() || {};
      const verifiedAttempt = saved.attemptHistory?.[result.attemptId];
      if (!verified.exists()
          || saved.gameCompleted?.[game.zone]?.[game.key] !== true
          || saved.gameResults?.[game.key]?.firebaseReceiptToken !== receiptToken
          || verifiedAttempt?.firebaseReceiptToken !== receiptToken) {
        throw new Error('Firebase learning analytics receipt verification failed');
      }

      savedEventId = result.eventId;
      try {
        localStorage.setItem(`HH_${game.key.toUpperCase()}_FIREBASE_RECEIPT`, JSON.stringify({
          studentId, receiptToken, attemptId: result.attemptId, result, savedAt: Date.now()
        }));
      } catch (_) {}
      setShellStatus(`✓ Firebase ยืนยันแล้ว • Attempt ${priorGameAttempts + 1} • คะแนน ${result.score}/100`);
      setTimeout(() => returnToPassport(game, receiptToken), 900);
    } catch (error) {
      saving = false;
      setShellStatus(`บันทึก Firebase ไม่สำเร็จ: ${error?.message || error}`, true);
      console.error('[Firebase Game Receipt Bridge R5]', error);
    }
  }

  function toothbrushResultFromFrame() {
    if (toothbrushObserved || saving || identifyGame()?.key !== 'toothbrush') return;
    const frame = document.getElementById('game');
    let doc;
    try { doc = frame?.contentDocument; } catch (_) { return; }
    if (!doc) return;
    const resultNode = doc.getElementById('result');
    if (!resultNode || resultNode.classList.contains('hidden') || getComputedStyle(resultNode).display === 'none') return;
    const zones = fractionFrom(doc.getElementById('resultCoverage')?.textContent);
    const plaque = fractionFrom(doc.getElementById('resultStrokes')?.textContent);
    const direction = clamp(numberFrom(doc.getElementById('resultDirection')?.textContent));
    const tracking = clamp(numberFrom(doc.getElementById('resultTracking')?.textContent));
    const coverage = plaque.total > 0 ? clamp(plaque.value * 100 / plaque.total) : zones.total > 0 ? clamp(zones.value * 100 / zones.total) : 0;
    const completed = zones.total > 0 && zones.value >= zones.total && plaque.total > 0 && plaque.value >= plaque.total;
    if (!completed) return;
    toothbrushObserved = true;
    persist({
      gameId: 'toothbrush', zone: 'hygiene', completed: true, passed: true,
      score: round1(coverage * 0.40 + direction * 0.35 + tracking * 0.25),
      scoreType: 'normalized_skill_score', scoreFormulaVersion: 'TOOTHBRUSH-MASTERY-V1',
      zonesCompleted: zones.value, zonesTotal: zones.total,
      plaqueTargetsCleared: plaque.value, plaqueTargetsTotal: plaque.total,
      directionAccuracy: round1(direction), trackingAccuracy: round1(tracking), coveragePct: round1(coverage),
      eventId: `toothbrush-${studentId}-${Date.now()}`
    });
  }

  window.addEventListener('message', event => {
    if (event.origin !== location.origin) return;
    const message = event.data || {};
    if (['HEROHEALTH_GAME_COMPLETE', 'HH_GAME_COMPLETE', 'game_complete'].includes(message.type)) persist(message.payload || message);
  }, true);
  for (const eventName of ['HEROHEALTH_GAME_COMPLETE', 'HH_GAME_COMPLETE', 'herohealth:game-complete']) {
    window.addEventListener(eventName, event => persist(event.detail || event), true);
  }

  window.setInterval(toothbrushResultFromFrame, 500);
  window.HH_firebasePersistGameResult = persist;
  window.HH_FIREBASE_ANALYTICS_SCHEMA = SCHEMA;
  console.info('[Firebase Game Receipt Bridge R5] installed', {
    release: RELEASE, schema: SCHEMA, studentId, isSandboxStudent, collectionName, game: identifyGame()
  });
})();