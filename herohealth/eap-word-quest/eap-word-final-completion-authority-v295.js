/* =========================================================
   EAP Word Quest • Final Completion Authority
   Version: 20260731-EAPWQ-V295-FINAL-COMPLETION-AUTHORITY

   Production close-out rules:
   - BG5 completion appears only after Google Sheet confirms 100%.
   - Only one completion panel is visible.
   - Internal state DONE is never exposed to learners.
   - One visible home action remains on the final summary.
   - No polling loop and no automatic reload.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260731-EAPWQ-V295-FINAL-COMPLETION-AUTHORITY';
  var observer = null;
  var scheduled = false;
  var applying = false;

  if (window.__EAP_WORD_FINAL_COMPLETION_V295__) return;
  window.__EAP_WORD_FINAL_COMPLETION_V295__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function addStyle() {
    if (byId('eapV295FinalStyle')) return;
    var style = document.createElement('style');
    style.id = 'eapV295FinalStyle';
    style.textContent = [
      '#eapV234FinalCard,#eapV238FinalPath{display:none!important}',
      '#eapV295CompletionCard{margin:14px 0;border:1px solid #86efac;border-radius:18px;padding:18px 20px;background:linear-gradient(135deg,#ecfdf5,#eff6ff);color:#14532d;line-height:1.55;font-weight:800}',
      '#eapV295CompletionCard h3{margin:0 0 6px;color:#166534;font-size:23px;line-height:1.25}',
      '#eapV295CompletionCard p{margin:0;color:#166534}',
      '#eapV295CompletionCard .eap-v295-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
      '#eapV295CompletionCard .eap-v295-chip{display:inline-flex;align-items:center;border:1px solid #86efac;border-radius:999px;padding:6px 10px;background:#fff;color:#166534;font-size:13px;font-weight:950}',
      '#nextMissionBtn[data-eap-v295-label]{position:relative!important;color:transparent!important;font-size:0!important;line-height:0!important;text-shadow:none!important;overflow:hidden!important}',
      '#nextMissionBtn[data-eap-v295-label]::after{content:attr(data-eap-v295-label)!important;position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:18px!important;font-weight:950!important;line-height:1.15!important;white-space:nowrap!important;pointer-events:none!important}',
      '#summaryScreen[data-eap-v295-complete="true"] #homeBtn{display:none!important}',
      '@media(max-width:680px){#eapV295CompletionCard{padding:16px}#eapV295CompletionCard h3{font-size:20px}#nextMissionBtn[data-eap-v295-label]::after{font-size:17px!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function summaryIsBg5() {
    var screen = byId('summaryScreen');
    var title = text(byId('summaryTitle') && byId('summaryTitle').textContent).toUpperCase();
    return Boolean(screen && screen.classList.contains('active') && /^BG5\b/.test(title));
  }

  function statusNode() {
    return byId('eapWordExactSummaryStatus');
  }

  function sheetConfirmed100() {
    var node = statusNode();
    var value = text(node && node.textContent);
    return /BG5\s+บันทึกและยืนยันจาก Google Sheet แล้ว/i.test(value) &&
      /(?:ความก้าวหน้า\s*100\s*%|สำเร็จครบทุกภารกิจ)/i.test(value);
  }

  function removeLegacyCompletion() {
    ['eapV234FinalCard', 'eapV238FinalPath'].forEach(function (id) {
      var node = byId(id);
      if (node) node.remove();
    });
  }

  function clearLegacyLabels(button) {
    if (!button || !button.dataset) return;
    [
      'eapV224Label','eapV228Label','eapV230Label','eapV231Label',
      'eapV232Label','eapV233Label','eapV234Label','eapV238Label'
    ].forEach(function (key) {
      try { delete button.dataset[key]; } catch (ignore) {}
    });
  }

  function friendlyReceipt() {
    var node = statusNode();
    var desired = 'BG5 บันทึกและยืนยันจาก Google Sheet แล้ว ✓ สำเร็จครบทุกภารกิจ • ความก้าวหน้า 100%';
    if (!node || text(node.textContent) === desired) return;
    node.textContent = desired;
    node.dataset.eapFinalReceipt = 'true';
  }

  function ensureCompletionCard() {
    var screen = byId('summaryScreen');
    var root = screen && (screen.querySelector('.summary-card') || screen);
    var actions = root && root.querySelector('.summary-actions');
    var card = byId('eapV295CompletionCard');
    if (!root) return null;

    if (!card) {
      card = document.createElement('section');
      card.id = 'eapV295CompletionCard';
      card.setAttribute('role', 'status');
      card.setAttribute('aria-live', 'polite');
      if (actions) actions.insertAdjacentElement('beforebegin', card);
      else root.appendChild(card);
    }

    card.innerHTML = [
      '<h3>🏆 EAP Word Quest สำเร็จครบแล้ว!</h3>',
      '<p>คุณผ่านครบทั้ง 20 ภารกิจของ Vocabulary Arc รวมถึง BG5 · Human Override Summit และผลได้รับการยืนยันจาก Google Sheet เรียบร้อยแล้ว</p>',
      '<p>สามารถกลับหน้าหลักเพื่อดูเส้นทางที่สำเร็จ หรือทบทวน Weak Words ใน Word Deck ได้ตามต้องการ</p>',
      '<div class="eap-v295-chips">',
      '<span class="eap-v295-chip">20/20 Missions</span>',
      '<span class="eap-v295-chip">Boss Gates 5/5</span>',
      '<span class="eap-v295-chip">Progress 100%</span>',
      '<span class="eap-v295-chip">Group 122</span>',
      '</div>'
    ].join('');
    return card;
  }

  function removeCompletionCard() {
    var card = byId('eapV295CompletionCard');
    if (card) card.remove();
  }

  function applyFinalActions() {
    var screen = byId('summaryScreen');
    var nextButton = byId('nextMissionBtn');
    if (!screen || !nextButton) return;

    clearLegacyLabels(nextButton);
    nextButton.dataset.eapV295Label = 'กลับหน้าหลัก';
    nextButton.textContent = 'กลับหน้าหลัก';
    nextButton.setAttribute('aria-label', 'กลับหน้าหลักหลังจบ EAP Word Quest');
    nextButton.title = 'กลับหน้าหลักหลังจบ EAP Word Quest';
    nextButton.disabled = false;
    nextButton.setAttribute('aria-disabled', 'false');
    nextButton.style.removeProperty('opacity');
    nextButton.style.removeProperty('cursor');
    screen.dataset.eapV295Complete = 'true';
  }

  function clearFinalActions() {
    var screen = byId('summaryScreen');
    var nextButton = byId('nextMissionBtn');
    if (screen) delete screen.dataset.eapV295Complete;
    if (nextButton) delete nextButton.dataset.eapV295Label;
  }

  function apply() {
    scheduled = false;
    if (applying) return;
    applying = true;
    try {
      addStyle();
      removeLegacyCompletion();

      if (!summaryIsBg5() || !sheetConfirmed100()) {
        removeCompletionCard();
        clearFinalActions();
        return;
      }

      friendlyReceipt();
      ensureCompletionCard();
      applyFinalActions();
    } finally {
      applying = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function bindObserver() {
    var screen = byId('summaryScreen');
    if (!screen || observer) return;
    observer = new MutationObserver(function () {
      if (!applying) schedule();
    });
    observer.observe(screen, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'disabled', 'style'] });
  }

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('#nextMissionBtn') : null;
    if (!button || !summaryIsBg5() || !sheetConfirmed100()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var home = byId('homeBtn');
    if (home) home.click();
  }, true);

  window.addEventListener('eap-core-run-finished', schedule);
  window.addEventListener('eap-word-authority-ready', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) schedule();
  });

  addStyle();
  bindObserver();
  [0, 80, 300, 900, 1800].forEach(function (delay) {
    setTimeout(function () {
      bindObserver();
      schedule();
    }, delay);
  });

  window.inspectEapWordFinalCompletionV295 = function () {
    return {
      version: VERSION,
      bg5Summary: summaryIsBg5(),
      sheetConfirmed100: sheetConfirmed100(),
      singleCard: Boolean(byId('eapV295CompletionCard')),
      legacyV234: Boolean(byId('eapV234FinalCard')),
      legacyV238: Boolean(byId('eapV238FinalPath')),
      visiblePrimaryLabel: text(byId('nextMissionBtn') && (byId('nextMissionBtn').dataset.eapV295Label || byId('nextMissionBtn').textContent))
    };
  };

  console.info('[EAP Word Quest] V295 final completion authority ready', { version: VERSION });
})();
