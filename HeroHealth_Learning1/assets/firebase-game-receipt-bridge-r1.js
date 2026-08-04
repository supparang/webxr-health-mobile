/* HeroHealth Shared Firebase Game Receipt Bridge R2
 * Completion authority for all Passport games, including Toothbrush DOM summary.
 */
(() => {
  'use strict';

  const RELEASE = '20260804-FIREBASE-GAME-RECEIPT-BRIDGE-R2-TOOTHBRUSH';
  const query = new URLSearchParams(location.search);
  if (String(query.get('authority') || '').toLowerCase() !== 'firebase') return;
  if (window.__HH_FIREBASE_GAME_RECEIPT_R2__) return;
  window.__HH_FIREBASE_GAME_RECEIPT_R2__ = true;

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBdlWEf91s2gzUQf7H1pPB8c_hF807CpAc',
    authDomain: 'herohealth-learning.firebaseapp.com',
    projectId: 'herohealth-learning',
    storageBucket: 'herohealth-learning.firebasestorage.app',
    messagingSenderId: '161380004818',
    appId: '1:161380004818:web:7d8ef81c55eebd6b1a8e0b'
  };

  const GAME_MAP = {
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
  const collectionName = studentId === '990014' ? 'studentProgressSandbox' : 'studentProgress';
  let saving = false;
  let savedEventId = '';
  let toothbrushObserved = false;

  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
  const round1 = value => Math.round((Number(value) || 0) * 10) / 10;
  const cleanKey = value => String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  const numberFrom = value => {
    const match = String(value || '').match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  };
  const fractionFrom = value => {
    const match = String(value || '').match(/(\d+)\s*\/\s*(\d+)/);
    return match ? { value: Number(match[1]), total: Number(match[2]) } : { value: 0, total: 0 };
  };

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
    if (target.includes('toothbrush')) return GAME_MAP.toothbrush;
    if (target.includes('goodjunk')) return GAME_MAP.goodjunk;
    if (target.includes('groups')) return GAME_MAP.groups;
    if (target.includes('jumpduck')) return GAME_MAP.jumpduck;
    if (target.includes('balance')) return GAME_MAP.balance;
    return null;
  }

  function normalizePayload(raw, game) {
    const source = raw?.payload && typeof raw.payload === 'object' ? raw.payload : raw;
    const data = source?.game && typeof source.game === 'object' ? { ...source, ...source.game } : { ...(source || {}) };
    const scoreCandidates = [data.score, data.normalizedScore, data.masteryPct, data.accuracy, data.percentage, data.percent];
    let score = scoreCandidates.map(Number).find(Number.isFinite);
    if (!Number.isFinite(score)) {
      const correct = Number(data.correct ?? data.correctCount ?? data.hits ?? data.successCount);
      const total = Number(data.total ?? data.totalItems ?? data.targetsTotal ?? data.attempted);
      score = total > 0 ? correct * 100 / total : 100;
    }
    score = round1(clamp(score));
    const passed = data.passed === true || data.completed === true || data.missionCompleted === true || data.skillPassed === true;
    const eventId = String(data.eventId || data.attemptId || data.runId || `${game.key}-${Date.now()}`);
    return { ...data, gameId: game.key, zone: game.zone, completed: passed, passed, score, scoreScale: 100, eventId, firebaseBridgeRelease: RELEASE, completedAtClient: new Date().toISOString() };
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
    setShellStatus(`กำลังบันทึก ${game.key} ลง Firebase…`);

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
      const receiptToken = `${game.key.toUpperCase()}-${studentId}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const ref = doc(db, collectionName, studentId);

      await setDoc(ref, {
        studentId,
        gameCompleted: { [game.zone]: { [game.key]: true } },
        gameResults: { [game.key]: { ...result, firebaseReceiptToken: receiptToken, firebaseSavedByUid: uid } },
        currentZone: game.zone,
        lastGame: game.key,
        lastGameScore: result.score,
        firebaseReceiptToken: receiptToken,
        firebaseSavedByUid: uid,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const verified = await getDoc(ref);
      const saved = verified.data() || {};
      if (!verified.exists() || saved.gameCompleted?.[game.zone]?.[game.key] !== true || saved.gameResults?.[game.key]?.firebaseReceiptToken !== receiptToken) {
        throw new Error('Firebase receipt verification failed');
      }

      savedEventId = result.eventId;
      try { localStorage.setItem(`HH_${game.key.toUpperCase()}_FIREBASE_RECEIPT`, JSON.stringify({ studentId, receiptToken, result, savedAt: Date.now() })); } catch (_) {}
      setShellStatus(`✓ Firebase ยืนยันแล้ว • คะแนน ${result.score}/100`);
      setTimeout(() => returnToPassport(game, receiptToken), 900);
    } catch (error) {
      saving = false;
      setShellStatus(`บันทึก Firebase ไม่สำเร็จ: ${error?.message || error}`, true);
      console.error('[Firebase Game Receipt Bridge R2]', error);
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
      directionAccuracy: round1(direction), trackingAccuracy: round1(tracking),
      eventId: `toothbrush-${studentId}-${Date.now()}`
    });
  }

  window.addEventListener('message', event => {
    if (event.origin !== location.origin) return;
    const message = event.data || {};
    if (['HEROHEALTH_GAME_COMPLETE','HH_GAME_COMPLETE','game_complete'].includes(message.type)) persist(message.payload || message);
  }, true);
  for (const eventName of ['HEROHEALTH_GAME_COMPLETE','HH_GAME_COMPLETE','herohealth:game-complete']) {
    window.addEventListener(eventName, event => persist(event.detail || event), true);
  }

  window.setInterval(toothbrushResultFromFrame, 500);
  window.HH_firebasePersistGameResult = persist;
  console.info('[Firebase Game Receipt Bridge R2] installed', { release: RELEASE, studentId, collectionName, game: identifyGame() });
})();