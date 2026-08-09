/* HeroHealth Toothbrush Firebase Receipt Bridge R2
 * Direct-game Firebase completion authority for Toothbrush V27.
 */
(() => {
  'use strict';

  const RELEASE = '20260809-TOOTHBRUSH-FIREBASE-RECEIPT-R2-E2E29';
  const query = new URLSearchParams(location.search);
  const authority = String(query.get('authority') || '').toLowerCase();
  if (authority !== 'firebase') return;
  if (!/toothbrush-classroom-challenge-v27\.html$/i.test(location.pathname)) return;

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBdlWEf91s2gzUQf7H1pPB8c_hF807CpAc',
    authDomain: 'herohealth-learning.firebaseapp.com',
    projectId: 'herohealth-learning',
    storageBucket: 'herohealth-learning.firebasestorage.app',
    messagingSenderId: '161380004818',
    appId: '1:161380004818:web:7d8ef81c55eebd6b1a8e0b'
  };

  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
  const round1 = value => Math.round((Number(value) || 0) * 10) / 10;
  const textNumber = (id, fallback = 0) => {
    const text = String(document.getElementById(id)?.textContent || '');
    const match = text.match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : fallback;
  };
  const fraction = id => {
    const text = String(document.getElementById(id)?.textContent || '');
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    return match ? { value: Number(match[1]), total: Number(match[2]) } : { value: 0, total: 0 };
  };

  const studentId = String(query.get('studentId') || query.get('sid') || query.get('pid') || '').trim();
  const isSandbox = /^9900(0[1-9]|1[0-9]|2[0-9])$/.test(studentId);
  const progressCollection = isSandbox ? 'studentProgressSandbox' : 'studentProgress';
  let saving = false;
  let completed = false;

  function resultVisible() {
    const result = document.getElementById('result');
    return !!result && !result.classList.contains('hidden') && getComputedStyle(result).display !== 'none';
  }

  function buildResult() {
    const zones = fraction('resultCoverage');
    const plaque = fraction('resultStrokes');
    const direction = clamp(textNumber('resultDirection'));
    const tracking = clamp(textNumber('resultTracking'));
    const coverage = plaque.total > 0 ? clamp(plaque.value * 100 / plaque.total)
      : zones.total > 0 ? clamp(zones.value * 100 / zones.total) : 0;
    const score = round1(coverage * 0.40 + direction * 0.35 + tracking * 0.25);
    return {
      gameId: 'toothbrush',
      zone: 'hygiene',
      completed: zones.total > 0 && zones.value >= zones.total && plaque.total > 0 && plaque.value >= plaque.total,
      passed: zones.total > 0 && zones.value >= zones.total && plaque.total > 0 && plaque.value >= plaque.total,
      score,
      scoreScale: 100,
      scoreType: 'normalized_skill_score',
      scoreFormulaVersion: 'TOOTHBRUSH-MASTERY-V1',
      scoreComponents: {
        plaqueCoveragePct: round1(coverage),
        directionAccuracyPct: round1(direction),
        trackingAccuracyPct: round1(tracking),
        weights: { plaqueCoveragePct: 0.40, directionAccuracyPct: 0.35, trackingAccuracyPct: 0.25 }
      },
      zonesCompleted: zones.value,
      zonesTotal: zones.total,
      plaqueTargetsCleared: plaque.value,
      plaqueTargetsTotal: plaque.total,
      directionAccuracy: round1(direction),
      trackingAccuracy: round1(tracking),
      release: RELEASE,
      completedAtClient: new Date().toISOString()
    };
  }

  function ensureStatus() {
    const card = document.querySelector('#result .card');
    if (!card) return null;
    let status = document.getElementById('firebaseReceiptStatus');
    if (!status) {
      status = document.createElement('p');
      status.id = 'firebaseReceiptStatus';
      status.setAttribute('role', 'status');
      status.style.cssText = 'margin:12px 0 0;padding:11px 14px;border-radius:14px;background:#ecfeff;color:#155e75;font-weight:800;text-align:center';
      const back = document.getElementById('back');
      card.insertBefore(status, back || null);
    }
    return status;
  }

  function returnToPassport(receiptToken) {
    const target = query.get('return') || './index.html';
    const url = new URL(target, location.href);
    const copyKeys = ['studentId','sid','pid','fullName','studentName','name','section','group','firebaseUid'];
    for (const key of copyKeys) {
      const value = query.get(key);
      if (value) url.searchParams.set(key, value);
    }
    url.searchParams.set('authority', 'firebase');
    url.searchParams.set('firebaseReady', '1');
    url.searchParams.set('firebaseReceipt', '1');
    url.searchParams.set('returnedGame', 'toothbrush');
    url.searchParams.set('gameCompleted', '1');
    url.searchParams.set('receiptToken', receiptToken);
    url.searchParams.set('v', RELEASE);
    location.replace(url.href);
  }

  async function saveAndReturn() {
    if (saving || completed || !studentId) return;
    const result = buildResult();
    if (!result.completed) return;
    saving = true;
    const status = ensureStatus();
    const back = document.getElementById('back');
    if (back) {
      back.disabled = true;
      back.textContent = 'กำลังบันทึกผลลง Firebase…';
    }
    if (status) status.textContent = `กำลังบันทึกคะแนน ${result.score}/100 ลง Firebase…`;

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
      const receiptToken = `TB-${studentId}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const ref = doc(db, progressCollection, studentId);
      await setDoc(ref, {
        studentId,
        gameCompleted: { hygiene: { toothbrush: true } },
        gameResults: { toothbrush: { ...result, firebaseReceiptToken: receiptToken, firebaseSavedByUid: uid } },
        currentZone: 'hygiene',
        lastGame: 'toothbrush',
        lastGameScore: result.score,
        firebaseReceiptToken: receiptToken,
        firebaseSavedByUid: uid,
        updatedAt: serverTimestamp()
      }, { merge: true });
      const verified = await getDoc(ref);
      const data = verified.data() || {};
      const saved = data.gameResults?.toothbrush || {};
      if (!verified.exists() || saved.firebaseReceiptToken !== receiptToken || data.gameCompleted?.hygiene?.toothbrush !== true) {
        throw new Error('Firebase receipt verification failed');
      }
      completed = true;
      try {
        localStorage.setItem('HH_TOOTHBRUSH_FIREBASE_RECEIPT', JSON.stringify({ studentId, receiptToken, result, savedAt: Date.now() }));
      } catch (_) {}
      if (status) status.textContent = `✓ Firebase ยืนยันแล้ว • คะแนน ${result.score}/100 • กำลังกลับ Passport`;
      if (back) back.textContent = `✓ คะแนน ${result.score}/100 • กำลังกลับ Passport`;
      setTimeout(() => returnToPassport(receiptToken), 900);
    } catch (error) {
      saving = false;
      if (status) {
        status.style.background = '#fff7ed';
        status.style.color = '#9a3412';
        status.textContent = `ยังบันทึก Firebase ไม่สำเร็จ: ${error?.message || error}`;
      }
      if (back) {
        back.disabled = false;
        back.textContent = 'ลองบันทึก Firebase อีกครั้ง';
        back.onclick = event => { event.preventDefault(); saveAndReturn(); };
      }
      console.error('[Toothbrush Firebase Receipt R2]', error);
    }
  }

  function inspect() {
    if (resultVisible()) {
      const result = buildResult();
      const badge = document.getElementById('badge');
      if (badge && !badge.dataset.firebaseScore) {
        badge.dataset.firebaseScore = '1';
        badge.textContent += ` • คะแนน ${result.score}/100`;
      }
      saveAndReturn();
    }
  }

  new MutationObserver(inspect).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class','style'] });
  window.setInterval(inspect, 500);
  window.addEventListener('load', inspect, { once: true });
  console.info('[Toothbrush Firebase Receipt R2] installed', { release: RELEASE, studentId, progressCollection });
})();
