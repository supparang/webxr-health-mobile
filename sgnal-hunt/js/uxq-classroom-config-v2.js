/* UX Quest • Classroom Configuration v3.1 • Result receipt + deliberate-learning guard
   Public configuration: contains the write-only receiver endpoint only.
   Teacher dashboard URLs and read-data endpoints must never be placed here.
*/
(() => {
  'use strict';

  const antiRushDefaults = {
    minDecisionSeconds: 4,
    minFeedbackSeconds: 2,
    minimumSecondsPerQuestion: 7,
    minimumThreeStarFloorSec: 30
  };

  const defaults = {
    receiverUrl: 'https://script.google.com/macros/s/AKfycbzw1_j4b98wxVWuUlEwFKl_jlZkprDjESt5cHIEdgT4lrT2xbt8bj0vWTu6VpTziBlepQ/exec',
    courseId: 'UXQ-ACT1-2026',
    courseLabel: 'UX Quest • Act I',
    defaultSection: '',
    allowGuestPractice: true,
    maxQueuedAttempts: 12,
    antiRush: antiRushDefaults,
    version: '20260628-classroom-receipt-v3.1-deliberate'
  };

  const existing = (window.UXQ_CLASSROOM_CONFIG && typeof window.UXQ_CLASSROOM_CONFIG === 'object')
    ? window.UXQ_CLASSROOM_CONFIG
    : {};
  const antiRush = Object.freeze(Object.assign({}, antiRushDefaults, existing.antiRush || {}));
  window.UXQ_CLASSROOM_CONFIG = Object.freeze(Object.assign({}, defaults, existing, { antiRush }));

  const asNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const formatTime = (seconds) => {
    const safe = Math.max(0, Math.round(asNumber(seconds, 0)));
    const min = Math.floor(safe / 60);
    return `${min}:${String(safe % 60).padStart(2, '0')}`;
  };

  /* A fast-perfect click-through remains a pass (2★), but cannot be
     represented as 3★ evidence mastery. The cap is applied before the
     game persists progress or sends the classroom payload. */
  function installProgressPaceGuard(){
    const marker = '__UXQ_PROGRESS_PACE_GUARD_INSTALLED__';
    if (window[marker]) return;
    window[marker] = true;

    let current = window.UXQProgress;
    function wrap(api){
      if (!api || typeof api.recordMission !== 'function' || api.__uxqPaceGuard) return api;
      const originalRecordMission = api.recordMission.bind(api);

      return Object.freeze(Object.assign({}, api, {
        recordMission(missionId, result){
          const target = result && typeof result === 'object' ? result : {};
          const total = Math.max(1, Math.round(asNumber(target.total, 1)));
          const minimumSec = Math.max(
            Math.max(1, Math.round(asNumber(antiRush.minimumThreeStarFloorSec, 30))),
            total * Math.max(1, Math.round(asNumber(antiRush.minimumSecondsPerQuestion, 7)))
          );
          const durationSec = Math.max(0, Math.round(asNumber(target.durationSec, 0)));
          const originalStars = Math.max(0, Math.round(asNumber(target.stars, 0)));
          const paceQualified = durationSec >= minimumSec;
          const capped = originalStars >= 3 && !paceQualified;

          target.minimumThreeStarSec = minimumSec;
          target.paceQualified = paceQualified;
          if (capped) {
            target.stars = 2;
            target.passed = true;
            target.badge = 'Deliberate Learner';
          }

          window.__UXQ_LAST_PACE_RESULT__ = {
            missionId: String(missionId || ''), durationSec, minimumSec,
            originalStars, stars: Math.max(0, Math.round(asNumber(target.stars, 0))),
            capped, paceQualified
          };
          try { window.dispatchEvent(new CustomEvent('uxq-pace-checked', { detail: window.__UXQ_LAST_PACE_RESULT__ })); } catch (error) {}
          return originalRecordMission(missionId, target);
        },
        __uxqPaceGuard: true
      }));
    }

    const descriptor = Object.getOwnPropertyDescriptor(window, 'UXQProgress');
    if (!descriptor || descriptor.configurable) {
      current = wrap(current);
      Object.defineProperty(window, 'UXQProgress', {
        configurable: true,
        enumerable: true,
        get: () => current,
        set: (api) => { current = wrap(api); }
      });
    }
  }

  function installDecisionPacing(){
    const marker = '__UXQ_DECISION_PACING_INSTALLED__';
    if (window[marker]) return;
    window[marker] = true;

    const decisionWaitMs = Math.max(1000, Math.round(asNumber(antiRush.minDecisionSeconds, 4) * 1000));
    const feedbackWaitMs = Math.max(500, Math.round(asNumber(antiRush.minFeedbackSeconds, 2) * 1000));
    let runToken = Date.now();
    const decisionReady = new Map();
    const feedbackReady = new Map();

    function ensureStyle(){
      if (document.getElementById('uxq-deliberate-pace-style')) return;
      const style = document.createElement('style');
      style.id = 'uxq-deliberate-pace-style';
      style.textContent = '.uxq-deliberate-gate{margin:14px 0 2px;padding:10px 12px;border:1px solid rgba(110,231,255,.33);border-radius:12px;background:rgba(110,231,255,.08);color:#c7f7ff;font:800 .86rem/1.45 Inter,ui-sans-serif,system-ui,sans-serif}.uxq-deliberate-gate b{color:#fff}.uxq-deliberate-result{width:min(700px,100%);margin:0 auto;padding:12px 15px;border:1px solid rgba(255,209,102,.46);border-radius:15px;background:rgba(255,209,102,.09);color:#ffe8aa;text-align:left;font:500 .9rem/1.55 Inter,ui-sans-serif,system-ui,sans-serif}.uxq-deliberate-result--good{border-color:rgba(119,233,164,.45);background:rgba(119,233,164,.08);color:#d1fae0}';
      document.head.appendChild(style);
    }

    function questionKey(){
      const title = document.querySelector('.uxq-casebar h1')?.textContent?.trim() || '';
      const stage = document.querySelector('.uxq-stage')?.textContent?.trim() || '';
      const prompt = document.querySelector('.uxq-question__prompt')?.textContent?.trim() || '';
      return `${runToken}|${title}|${stage}|${prompt}`;
    }

    function updateDecisionGate(box, key){
      const gate = box.parentElement?.querySelector('[data-uxq-decision-gate]');
      const remaining = Math.max(0, Math.ceil(((decisionReady.get(key) || 0) - Date.now()) / 1000));
      if (gate) {
        const message = remaining > 0
          ? `<b>Evidence scan</b> • เปรียบเทียบหลักฐานก่อนเลือก — เลือกได้ใน ${remaining} วินาที`
          : '<b>พร้อมตัดสินใจ</b> • เลือกหลักฐานหรือแนวทางที่อธิบายพฤติกรรมผู้ใช้ได้ดีที่สุด';
        if (gate.innerHTML !== message) gate.innerHTML = message;
      }
      box.querySelectorAll('[data-option]').forEach(button => { button.disabled = remaining > 0; });
      if (remaining > 0) window.setTimeout(() => { if (box.isConnected) updateDecisionGate(box, key); }, 250);
    }

    function applyDecisionGate(){
      const box = document.querySelector('.uxq-options');
      const next = document.getElementById('uxqNext');
      const buttons = box ? [...box.querySelectorAll('[data-option]')] : [];
      if (!box || next || !buttons.length) return;
      const key = questionKey();
      if (!decisionReady.has(key)) decisionReady.set(key, Date.now() + decisionWaitMs);
      let gate = box.parentElement?.querySelector('[data-uxq-decision-gate]');
      if (!gate) {
        gate = document.createElement('div');
        gate.className = 'uxq-deliberate-gate';
        gate.dataset.uxqDecisionGate = '1';
        box.before(gate);
      }
      updateDecisionGate(box, key);
    }

    function applyFeedbackGate(){
      const next = document.getElementById('uxqNext');
      if (!next) return;
      const key = `${questionKey()}|feedback`;
      if (!feedbackReady.has(key)) feedbackReady.set(key, Date.now() + feedbackWaitMs);
      const remaining = Math.max(0, Math.ceil(((feedbackReady.get(key) || 0) - Date.now()) / 1000));
      if (!next.dataset.uxqOriginalHtml) next.dataset.uxqOriginalHtml = next.innerHTML;
      next.disabled = remaining > 0;
      const nextLabel = remaining > 0 ? `อ่าน feedback อีก ${remaining} วินาที` : next.dataset.uxqOriginalHtml;
      if (next.innerHTML !== nextLabel) next.innerHTML = nextLabel;
      if (remaining > 0) window.setTimeout(() => { if (next.isConnected) applyFeedbackGate(); }, 250);
    }

    function applyResultNote(){
      const results = document.querySelector('.uxq-results');
      const pace = window.__UXQ_LAST_PACE_RESULT__;
      if (!results || !pace || results.querySelector('[data-uxq-pace-result]')) return;
      const note = document.createElement('div');
      note.dataset.uxqPaceResult = '1';
      note.className = `uxq-deliberate-result${pace.paceQualified ? ' uxq-deliberate-result--good' : ''}`;
      note.innerHTML = pace.capped
        ? `<b>Readiness ผ่านแล้วที่ 2★</b><br>รอบนี้ใช้เวลา ${formatTime(pace.durationSec)} แต่ 3★ ต้องมีเวลาอ่านคดีและ feedback อย่างน้อย ${formatTime(pace.minimumSec)}`
        : (pace.stars >= 3
          ? `<b>✓ Deliberate pace verified</b><br>3★ มาจากความแม่นยำและการใช้เวลาคิด ${formatTime(pace.durationSec)} ตามเกณฑ์อย่างน้อย ${formatTime(pace.minimumSec)}`
          : `<b>Readiness record</b><br>ใช้เวลา ${formatTime(pace.durationSec)} • เกณฑ์ 3★ อย่างน้อย ${formatTime(pace.minimumSec)}`);
      const grid = results.querySelector('.uxq-result-grid');
      if (grid) grid.after(note); else results.prepend(note);
    }

    function applyAll(){ ensureStyle(); applyDecisionGate(); applyFeedbackGate(); applyResultNote(); }

    document.addEventListener('click', (event) => {
      const button = event.target?.closest?.('#uxqStart, #uxqReplay');
      if (!button) return;
      runToken = Date.now();
      decisionReady.clear();
      feedbackReady.clear();
      window.__UXQ_LAST_PACE_RESULT__ = null;
    }, true);

    const observer = new MutationObserver(() => window.queueMicrotask(applyAll));
    const start = () => {
      if (!document.body) return window.setTimeout(start, 0);
      observer.observe(document.body, { childList: true, subtree: true });
      applyAll();
    };
    start();
  }

  function loadResultReceiptUi(){
    if (document.querySelector('script[data-uxq-result-receipt]')) return;
    const script = document.createElement('script');
    script.src = './js/uxq-result-receipt-v1.js?v=20260628-receipt-v1';
    script.async = true;
    script.dataset.uxqResultReceipt = '1';
    document.head.appendChild(script);
  }

  installProgressPaceGuard();
  installDecisionPacing();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadResultReceiptUi, { once: true });
  else loadResultReceiptUi();
})();
