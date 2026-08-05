/* HeroHealth GoodJunk Firebase Completion Patch R3
 * - Visually reduces large GoodJunk canvas targets on mobile while preserving hit areas.
 * - Detects the real result screen through nested same-origin iframes.
 * - Sends a canonical completion payload to the shared Firebase receipt bridge.
 */
(() => {
  'use strict';

  const RELEASE = '20260805-GOODJUNK-FIREBASE-COMPLETION-R3';
  const query = new URLSearchParams(location.search);
  const authority = String(query.get('authority') || '').toLowerCase();
  const gameId = String(query.get('gameId') || query.get('game') || '').toLowerCase();
  const target = String(query.get('target') || '').toLowerCase();
  if (authority !== 'firebase' || !(gameId.includes('goodjunk') || target.includes('goodjunk'))) return;
  if (window.__HH_GOODJUNK_FIREBASE_R3__) return;
  window.__HH_GOODJUNK_FIREBASE_R3__ = true;

  let submitted = false;
  let visualPatched = false;
  let stableResultTicks = 0;

  const numberFrom = value => {
    const match = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  };
  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
  const isVisible = (doc, node) => {
    if (!node || node.classList?.contains('hidden')) return false;
    try {
      const style = doc.defaultView.getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
    } catch (_) { return true; }
  };

  function frameChain() {
    const chain = [];
    let currentWindow = window;
    for (let depth = 0; depth < 5; depth += 1) {
      let frame;
      try { frame = currentWindow.document.getElementById('game') || currentWindow.document.querySelector('iframe'); }
      catch (_) { break; }
      if (!frame?.contentWindow) break;
      try { void frame.contentWindow.document.documentElement; }
      catch (_) { break; }
      chain.push(frame.contentWindow);
      currentWindow = frame.contentWindow;
    }
    return chain;
  }

  function deepestGameWindow() {
    const chain = frameChain();
    return chain.length ? chain[chain.length - 1] : null;
  }

  function installTargetPolish() {
    if (visualPatched) return;
    const win = deepestGameWindow();
    if (!win?.CanvasRenderingContext2D) return;
    const proto = win.CanvasRenderingContext2D.prototype;
    if (proto.__hhGoodJunkTargetR3) { visualPatched = true; return; }
    const originalArc = proto.arc;
    proto.arc = function(x, y, radius, startAngle, endAngle, anticlockwise) {
      let adjusted = radius;
      const mobilePortrait = Math.min(win.innerWidth || 9999, win.innerHeight || 9999) <= 820;
      // GoodJunk food targets use large circular arcs. Reduce only that radius band.
      // Hit testing in the game remains unchanged, so Grade 5 students still select easily.
      if (mobilePortrait && Number.isFinite(radius) && radius >= 58 && radius <= 150) adjusted = radius * 0.84;
      return originalArc.call(this, x, y, adjusted, startAngle, endAngle, anticlockwise);
    };
    proto.__hhGoodJunkTargetR3 = true;
    visualPatched = true;
    console.info('[GoodJunk R3] mobile target visual size reduced', RELEASE);
  }

  function readResult() {
    const win = deepestGameWindow();
    let doc;
    try { doc = win?.document; } catch (_) { return null; }
    if (!doc) return null;
    const result = doc.getElementById('result');
    if (!isVisible(doc, result)) return null;

    const accuracy = clamp(numberFrom(doc.getElementById('mAcc')?.textContent));
    const reason = clamp(numberFrom(doc.getElementById('mReason')?.textContent));
    const retry = clamp(numberFrom(doc.getElementById('mRetry')?.textContent));
    const rawScore = numberFrom(doc.getElementById('mScore')?.textContent);
    // mScore can be a raw point total (e.g. 2180). Firebase Passport requires a 0–100 score.
    const normalizedScore = rawScore > 100
      ? Math.round((accuracy * 0.70 + reason * 0.15 + retry * 0.15) * 10) / 10
      : clamp(rawScore || accuracy);

    return {
      gameId: 'goodjunk',
      zone: 'nutrition',
      completed: true,
      passed: true,
      missionCompleted: true,
      progressionEligible: true,
      retryRequired: false,
      score: normalizedScore,
      normalizedScore,
      rawScore,
      accuracy,
      reasonAccuracy: reason,
      retryTransferAccuracy: retry,
      eventId: `goodjunk-${String(query.get('studentId') || query.get('sid') || '')}-${Date.now()}`,
      completionSource: 'goodjunk-result-dom-fallback-r3',
      goodjunkPatchRelease: RELEASE
    };
  }

  function ensureCompletionReceipt() {
    if (submitted) return;
    const payload = readResult();
    if (!payload) { stableResultTicks = 0; return; }
    stableResultTicks += 1;
    if (stableResultTicks < 2) return;
    if (typeof window.HH_firebasePersistGameResult !== 'function') return;
    submitted = true;
    const status = document.getElementById('receiptStatus');
    if (status) status.textContent = 'กำลังยืนยัน GoodJunk กับ Firebase…';
    window.HH_firebasePersistGameResult(payload);
    console.info('[GoodJunk R3] canonical completion sent to Firebase bridge', payload);
  }

  const timer = window.setInterval(() => {
    installTargetPolish();
    ensureCompletionReceipt();
    if (submitted) window.clearInterval(timer);
  }, 250);

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || submitted) return;
    const message = event.data || {};
    if (!['HEROHEALTH_GAME_COMPLETE', 'HH_GAME_COMPLETE', 'game_complete'].includes(message.type)) return;
    const incoming = message.payload || message;
    const canonical = {
      ...incoming,
      gameId: 'goodjunk', zone: 'nutrition', completed: true, passed: true,
      missionCompleted: true, progressionEligible: true, retryRequired: false,
      eventId: incoming.eventId || incoming.attemptId || `goodjunk-${Date.now()}`,
      goodjunkPatchRelease: RELEASE
    };
    if (typeof window.HH_firebasePersistGameResult === 'function') {
      submitted = true;
      window.HH_firebasePersistGameResult(canonical);
    }
  }, true);

  console.info('[GoodJunk Firebase Completion Patch R3] installed', RELEASE);
})();