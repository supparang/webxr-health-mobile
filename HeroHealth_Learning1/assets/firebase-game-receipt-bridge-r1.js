/* HeroHealth Shared Firebase Game Receipt Bridge R1
 * Completion authority for Food Groups, GoodJunk, JumpDuck and Balance Hold.
 */
(() => {
  'use strict';

  const RELEASE = '20260804-FIREBASE-GAME-RECEIPT-BRIDGE-R1';
  const query = new URLSearchParams(location.search);
  const authority = String(query.get('authority') || '').toLowerCase();
  if (authority !== 'firebase') return;
  if (window.__HH_FIREBASE_GAME_RECEIPT_R1__) return;
  window.__HH_FIREBASE_GAME_RECEIPT_R1__ = true;

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBdlWEf91s2gzUQf7H1pPB8c_hF807CpAc',
    authDomain: 'herohealth-learning.firebaseapp.com',
    projectId: 'herohealth-learning',
    storageBucket: 'herohealth-learning.firebasestorage.app',
    messagingSenderId: '161380004818',
    appId: '1:161380004818:web:7d8ef81c55eebd6b1a8e0b'
  };

  const GAME_MAP = {
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

  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
  const round1 = value => Math.round((Number(value) || 0) * 10) / 10;
  const cleanKey = value => String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');

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
    const path = cleanKey(location.pathname);
    if (path.includes('goodjunk')) return GAME_MAP.goodjunk;
    if (path.includes('groups')) return GAME_MAP.groups;
    if (path.includes('jumpduck')) return GAME_MAP.jumpduck;
    if (path.includes('balance')) return GAME_MAP.balance;
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
    return {
      ...data,
      gameId: game.key,
      zone: game.zone,
      completed: passed,
      passed,
      score,
      scoreScale: 100,
      eventId,
      firebaseBridgeRelease: RELEASE,
      completedAtClient: new Date().toISOString()
    };
  }

  function setShellStatus(text, error = false) {
    const ids = ['status', 'receiptStatus', 'syncStatus', 'returnStatus'];
    for (const id of ids) {
      const node = document.getElementById(id);
      if (node) {
        node.textContent = text;
        if (error) node.style.color = '#b91c1c';
      }
    }
    const buttons = [...document.querySelectorAll('button')].filter(btn => /Passport|กลับ/.test(btn.textContent || ''));
    for (const btn of buttons) {
      btn.disabled = !error;
      btn.textContent = error ? 'ลองบันทึก Firebase อีกครั้ง' : text;
    }
  }

  function returnToPassport(game, receiptToken) {
    const target = query.get('return') || './index.html';
    const url = new URL(target, location.href);
    for (const key of ['studentId','sid','pid','fullName','studentName','name','section','group','firebaseUid']) {
      const value = query.get(key);
      if (value) url.searchParams.set(key, value);
    }
    if (studentId) {
      url.searchParams.set('studentId', studentId);
      url.searchParams.set('sid', studentId);
    }
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
      const completedPatch = { [game.zone]: { [game.key]: true } };
      const resultPatch = { [game.key]: { ...result, firebaseReceiptToken: receiptToken, firebaseSavedByUid: uid } };

      await setDoc(ref, {
        studentId,
        gameCompleted: completedPatch,
        gameResults: resultPatch,
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
      try {
        localStorage.setItem(`HH_${game.key.toUpperCase()}_FIREBASE_RECEIPT`, JSON.stringify({ studentId, receiptToken, result, savedAt: Date.now() }));
      } catch (_) {}
      setShellStatus(`✓ Firebase ยืนยันแล้ว • คะแนน ${result.score}/100`);
      setTimeout(() => returnToPassport(game, receiptToken), 900);
    } catch (error) {
      saving = false;
      setShellStatus(`บันทึก Firebase ไม่สำเร็จ: ${error?.message || error}`, true);
      console.error('[Firebase Game Receipt Bridge R1]', error);
    }
  }

  window.addEventListener('message', event => {
    if (event.origin !== location.origin) return;
    const message = event.data || {};
    if (message.type === 'HEROHEALTH_GAME_COMPLETE' || message.type === 'HH_GAME_COMPLETE' || message.type === 'game_complete') {
      persist(message.payload || message);
    }
  }, true);

  for (const eventName of ['HEROHEALTH_GAME_COMPLETE', 'HH_GAME_COMPLETE', 'herohealth:game-complete']) {
    window.addEventListener(eventName, event => persist(event.detail || event), true);
  }

  window.HH_firebasePersistGameResult = persist;
  console.info('[Firebase Game Receipt Bridge R1] installed', { release: RELEASE, studentId, collectionName });
})();