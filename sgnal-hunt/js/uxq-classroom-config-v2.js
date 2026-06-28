/* UX Quest • Classroom Configuration v4
   Public game configuration + deliberate-learning safeguards.
   This file never contains a teacher dashboard or data-reading endpoint.
*/
(() => {
  'use strict';

  const antiRushDefaults = Object.freeze({
    minDecisionSeconds: 4,
    minFeedbackSeconds: 2,
    minimumSecondsPerQuestion: 7,
    minimumThreeStarFloorSec: 30
  });

  const defaults = {
    receiverUrl: 'https://script.google.com/macros/s/AKfycbzw1_j4b98wxVWuUlEwFKl_jlZkprDjESt5cHIEdgT4lrT2xbt8bj0vWTu6VpTziBlepQ/exec',
    courseId: 'UXQ-ACT1-2026',
    courseLabel: 'UX Quest • Act I',
    defaultSection: '',
    allowGuestPractice: true,
    maxQueuedAttempts: 12,
    antiRush: antiRushDefaults,
    version: '20260628-classroom-v4-deliberate-score'
  };

  const existing = (window.UXQ_CLASSROOM_CONFIG && typeof window.UXQ_CLASSROOM_CONFIG === 'object')
    ? window.UXQ_CLASSROOM_CONFIG
    : {};
  const antiRush = Object.freeze(Object.assign({}, antiRushDefaults, existing.antiRush || {}));
  window.UXQ_CLASSROOM_CONFIG = Object.freeze(Object.assign({}, defaults, existing, { antiRush }));

  const asNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const formatTime = (seconds) => {
    const safe = Math.max(0, Math.round(asNumber(seconds)));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
  };

  /* This trace is intentionally local and short-lived. It lets score calculation
     reward correct evidence reasoning and a sustained combo, not rapid clicking. */
  let trace = freshTrace();
  function freshTrace(){
    return {
      token: Date.now(),
      answers: [],
      answerKeys: new Set(),
      hintKeys: new Set(),
      decisionReady: new Map(),
      feedbackReady: new Map()
    };
  }
  function resetTrace(){
    trace = freshTrace();
    window.__UXQ_LAST_PACE_RESULT__ = null;
  }

  function coreScore(answers, hints){
    let combo = 0;
    let score = 0;
    (Array.isArray(answers) ? answers : []).forEach(correct => {
      if (correct) {
        combo += 1;
        score += 80 + Math.min(45, (combo - 1) * 9);
      } else {
        combo = 0;
      }
    });
    return Math.max(0, score - Math.max(0, Math.round(asNumber(hints))) * 15);
  }

  /* This wrapper executes before the shared mission engine initializes.
     A fast-perfect run can still pass at 2★, but 3★ represents accurate,
     deliberate evidence work. Score no longer includes a hidden speed bonus. */
  function installProgressGuard(){
    const marker = '__UXQ_PROGRESS_GUARD_V4__';
    if (window[marker]) return;
    window[marker] = true;

    function wrap(api){
      if (!api || typeof api.recordMission !== 'function' || api.__uxqDeliberateGuard) return api;
      const originalRecordMission = api.recordMission.bind(api);

      return Object.freeze(Object.assign({}, api, {
        recordMission(missionId, result){
          const target = result && typeof result === 'object' ? result : {};
          const total = Math.max(1, Math.round(asNumber(target.total, 1)));
          const durationSec = Math.max(0, Math.round(asNumber(target.durationSec)));
          const originalStars = Math.max(0, Math.round(asNumber(target.stars)));
          const minimumSec = Math.max(
            Math.max(1, Math.round(asNumber(antiRush.minimumThreeStarFloorSec, 30))),
            total * Math.max(1, Math.round(asNumber(antiRush.minimumSecondsPerQuestion, 7)))
          );
          const paceQualified = durationSec >= minimumSec;
          const capped = originalStars >= 3 && !paceQualified;

          /* Score calculation is deterministic from the actual answer path.
             Only normalize when every resolved decision was observed. */
          if (trace.answers.length >= total) {
            target.score = coreScore(trace.answers.slice(0, total), target.hints);
          }

          target.minimumThreeStarSec = minimumSec;
          target.paceQualified = paceQualified;
          if (capped) {
            target.stars = 2;
            target.passed = true;
            target.badge = 'Deliberate Learner';
          }

          window.__UXQ_LAST_PACE_RESULT__ = {
            missionId: String(missionId || ''),
            durationSec,
            minimumSec,
            originalStars,
            stars: Math.max(0, Math.round(asNumber(target.stars))),
            capped,
            paceQualified,
            scoreModel: 'evidence-combo-v2'
          };
          try {
            window.dispatchEvent(new CustomEvent('uxq-pace-checked', { detail: window.__UXQ_LAST_PACE_RESULT__ }));
          } catch (error) {}

          return originalRecordMission(missionId, target);
        },
        __uxqDeliberateGuard: true
      }));
    }

    let current = wrap(window.UXQProgress);
    Object.defineProperty(window, 'UXQProgress', {
      configurable: true,
      enumerable: true,
      get: () => current,
      set: (api) => { current = wrap(api); }
    });
  }

  function ensureStyle(){
    if (document.getElementById('uxq-deliberate-style-v4')) return;
    const style = document.createElement('style');
    style.id = 'uxq-deliberate-style-v4';
    style.textContent = `
      .uxq-deliberate-gate{margin:14px 0 2px;padding:10px 12px;border:1px solid rgba(110,231,255,.33);border-radius:12px;background:rgba(110,231,255,.08);color:#c7f7ff;font:800 .86rem/1.45 Inter,ui-sans-serif,system-ui,sans-serif}
      .uxq-deliberate-gate b{color:#fff}
      .uxq-deliberate-result{width:min(700px,100%);margin:0 auto;padding:12px 15px;border:1px solid rgba(255,209,102,.46);border-radius:15px;background:rgba(255,209,102,.09);color:#ffe8aa;text-align:left;font:500 .9rem/1.55 Inter,ui-sans-serif,system-ui,sans-serif}
      .uxq-deliberate-result--good{border-color:rgba(119,233,164,.45);background:rgba(119,233,164,.08);color:#d1fae0}
    `;
    document.head.appendChild(style);
  }

  function questionKey(){
    const title = document.querySelector('.uxq-casebar h1')?.textContent?.trim() || '';
    const stage = document.querySelector('.uxq-stage')?.textContent?.trim() || '';
    const prompt = document.querySelector('.uxq-question__prompt')?.textContent?.trim() || '';
    return `${trace.token}|${title}|${stage}|${prompt}`;
  }

  function captureResolvedAnswer(){
    const feedback = document.querySelector('.uxq-feedback');
    const selected = document.querySelector('.uxq-option.is-selected');
    if (!feedback || !selected) return;
    const key = questionKey();
    if (!key || trace.answerKeys.has(key)) return;
    trace.answerKeys.add(key);
    trace.answers.push(selected.classList.contains('is-correct'));
  }

  function armDecisionGate(){
    const options = document.querySelector('.uxq-options');
    const next = document.getElementById('uxqNext');
    if (!options || next || !options.querySelector('[data-option]')) return;

    const key = questionKey();
    if (!trace.decisionReady.has(key)) {
      trace.decisionReady.set(key, Date.now() + Math.max(1000, Math.round(asNumber(antiRush.minDecisionSeconds, 4) * 1000)));
    }
    let gate = options.parentElement?.querySelector('[data-uxq-decision-gate]');
    if (!gate) {
      gate = document.createElement('div');
      gate.className = 'uxq-deliberate-gate';
      gate.dataset.uxqDecisionGate = '1';
      options.before(gate);
    }

    const update = () => {
      if (!options.isConnected) return;
      const remaining = Math.max(0, Math.ceil(((trace.decisionReady.get(key) || 0) - Date.now()) / 1000));
      gate.innerHTML = remaining > 0
        ? `<b>Evidence scan</b> • เปรียบเทียบหลักฐานก่อนเลือก — เลือกได้ใน ${remaining} วินาที`
        : '<b>พร้อมตัดสินใจ</b> • เลือกหลักฐานหรือแนวทางที่อธิบายพฤติกรรมผู้ใช้ได้ดีที่สุด';
      options.querySelectorAll('[data-option]').forEach(button => { button.disabled = remaining > 0; });
      if (remaining > 0) window.setTimeout(update, 250);
    };
    update();
  }

  function armFeedbackGate(){
    const next = document.getElementById('uxqNext');
    if (!next) return;
    const key = `${questionKey()}|feedback`;
    if (!trace.feedbackReady.has(key)) {
      trace.feedbackReady.set(key, Date.now() + Math.max(500, Math.round(asNumber(antiRush.minFeedbackSeconds, 2) * 1000)));
    }
    if (!next.dataset.uxqOriginalHtml) next.dataset.uxqOriginalHtml = next.innerHTML;

    const update = () => {
      if (!next.isConnected) return;
      const remaining = Math.max(0, Math.ceil(((trace.feedbackReady.get(key) || 0) - Date.now()) / 1000));
      next.disabled = remaining > 0;
      next.innerHTML = remaining > 0 ? `อ่าน feedback อีก ${remaining} วินาที` : next.dataset.uxqOriginalHtml;
      if (remaining > 0) window.setTimeout(update, 250);
    };
    update();
  }

  function renderPaceResult(){
    const results = document.querySelector('.uxq-results');
    const pace = window.__UXQ_LAST_PACE_RESULT__;
    if (!results || !pace || results.querySelector('[data-uxq-pace-result]')) return;

    const note = document.createElement('div');
    note.dataset.uxqPaceResult = '1';
    note.className = `uxq-deliberate-result${pace.paceQualified ? ' uxq-deliberate-result--good' : ''}`;
    note.innerHTML = pace.capped
      ? `<b>Readiness ผ่านแล้วที่ 2★</b><br>รอบนี้ใช้เวลา ${formatTime(pace.durationSec)} แต่ 3★ ต้องมีเวลาอ่านคดีและ feedback อย่างน้อย ${formatTime(pace.minimumSec)}`
      : (pace.stars >= 3
        ? `<b>✓ Deliberate pace verified</b><br>3★ มาจากความแม่นยำและการใช้เวลาคิด ${formatTime(pace.durationSec)} ตามเกณฑ์อย่างน้อย ${formatTime(pace.minimumSec)} • คะแนนคำนวณจาก evidence combo ไม่ใช่ความเร็ว`
        : `<b>Readiness record</b><br>ใช้เวลา ${formatTime(pace.durationSec)} • เกณฑ์ 3★ อย่างน้อย ${formatTime(pace.minimumSec)}`);
    const grid = results.querySelector('.uxq-result-grid');
    if (grid) grid.after(note); else results.prepend(note);
  }

  function applyGuards(){
    ensureStyle();
    captureResolvedAnswer();
    armDecisionGate();
    armFeedbackGate();
    renderPaceResult();
  }

  function installDomGuards(){
    document.addEventListener('click', (event) => {
      const start = event.target?.closest?.('#uxqStart, #uxqReplay');
      if (start) {
        resetTrace();
        return;
      }
      const hint = event.target?.closest?.('#uxqHint');
      if (hint && !hint.disabled) trace.hintKeys.add(questionKey());
    }, true);

    const begin = () => {
      if (!document.body) return window.setTimeout(begin, 0);
      const observer = new MutationObserver(() => window.queueMicrotask(applyGuards));
      observer.observe(document.body, { childList: true, subtree: true });
      applyGuards();
    };
    begin();
  }

  function loadResultReceiptUi(){
    if (document.querySelector('script[data-uxq-result-receipt]')) return;
    const script = document.createElement('script');
    script.src = './js/uxq-result-receipt-v1.js?v=20260628-receipt-v1';
    script.async = true;
    script.dataset.uxqResultReceipt = '1';
    document.head.appendChild(script);
  }

  installProgressGuard();
  installDomGuards();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadResultReceiptUi, { once: true });
  else loadResultReceiptUi();
})();
