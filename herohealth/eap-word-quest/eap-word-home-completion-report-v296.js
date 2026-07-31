/* =========================================================
   EAP Word Quest • Home Completion Report Polish
   Version: 20260731-EAPWQ-V296-HOME-REPORT-POLISH

   Production close-out rules:
   - One completion-report toggle only.
   - Hide compact Home statistics while the full report is open.
   - Remove the legacy internal Close button/report duplication.
   - Use learner-friendly, unambiguous statistic labels.
   - No reload and no polling loop.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260731-EAPWQ-V296-HOME-REPORT-POLISH';
  var TOTAL = 20;
  var GROUP = '122';
  var reportOpen = false;
  var observer = null;
  var scheduled = false;
  var applying = false;

  if (window.__EAP_WORD_HOME_REPORT_V296__) return;
  window.__EAP_WORD_HOME_REPORT_V296__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, function (ch) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
    });
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function onHome() {
    var screen = byId('homeScreen');
    return Boolean(screen && screen.classList.contains('active'));
  }

  function progress() {
    try {
      return typeof window.getEapCoreProgress === 'function' ? window.getEapCoreProgress() : null;
    } catch (error) {
      return null;
    }
  }

  function completed() {
    var model = progress();
    return Boolean(model && String(model.next) === 'DONE' && Number(model.passed) >= TOTAL);
  }

  function addStyle() {
    if (byId('eapV296HomeReportStyle')) return;
    var style = document.createElement('style');
    style.id = 'eapV296HomeReportStyle';
    style.textContent = [
      '#eapV239CompletionReport{display:none!important}',
      '#eapV296CompletionReport[hidden]{display:none!important}',
      '#eapV296CompletionReport{margin-top:14px;border:1px solid #86efac;border-radius:18px;padding:18px 20px;background:linear-gradient(135deg,#ecfdf5,#eff6ff);color:#14532d;box-shadow:0 10px 26px rgba(22,101,52,.08)}',
      '#eapV296CompletionReport h3{margin:0 0 6px;color:#166534;font-size:23px;line-height:1.25}',
      '#eapV296CompletionReport p{margin:0;color:#166534;line-height:1.55;font-weight:760}',
      '#eapV296CompletionReport .eap-v296-top{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}',
      '#eapV296CompletionReport .eap-v296-kicker{display:inline-flex;align-items:center;gap:6px;margin-bottom:6px;border:1px solid #86efac;border-radius:999px;padding:5px 9px;background:#fff;font-size:12px;font-weight:950;color:#166534}',
      '#eapV296CompletionReport .eap-v296-score{flex:0 0 auto;border:1px solid #86efac;border-radius:15px;background:#fff;padding:12px 15px;text-align:center;color:#166534;font-weight:950}',
      '#eapV296CompletionReport .eap-v296-score b{display:block;font-size:26px;line-height:1}',
      '#eapV296CompletionReport .eap-v296-score span{display:block;margin-top:5px;font-size:11px}',
      '#eapV296CompletionReport .eap-v296-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:14px}',
      '#eapV296CompletionReport .eap-v296-stat{border:1px solid #bbf7d0;border-radius:14px;background:#fff;padding:11px 12px}',
      '#eapV296CompletionReport .eap-v296-stat b{display:block;font-size:20px;line-height:1.15;color:#166534}',
      '#eapV296CompletionReport .eap-v296-stat span{display:block;margin-top:4px;font-size:12px;line-height:1.35;color:#166534;font-weight:800}',
      '#eapV296CompletionReport .eap-v296-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:15px}',
      '#eapV296CompletionReport .eap-v296-actions button{min-height:44px}',
      '#homeScreen[data-eap-v296-report-open="true"] #homeStats{display:none!important}',
      '#homeScreen[data-eap-v296-report-open="true"] .student-secondary-controls{display:none!important}',
      '#eapV296CompletionBtn{position:relative!important}',
      '@media(max-width:680px){#eapV296CompletionReport{padding:15px}#eapV296CompletionReport .eap-v296-top{display:block}#eapV296CompletionReport .eap-v296-score{display:inline-block;margin-top:11px}#eapV296CompletionReport h3{font-size:21px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function sourceButton() {
    return byId('eapV296CompletionBtn') || byId('eapV239CompletionBtn') || byId('quickStartBtn');
  }

  function normalLabel(label) {
    var value = text(label);
    if (/คะแนนเฉลี่ย.*Core/i.test(value)) return 'คะแนนเฉลี่ยจากภารกิจ Core';
    if (/คำ.*ทบทวน/i.test(value)) return 'คำที่ควรทบทวนสะสม';
    if (/รอบ.*(?:Core|เล่น)/i.test(value)) return 'รอบการเล่นทั้งหมด';
    if (/ภารกิจที่ผ่าน/i.test(value)) return 'ภารกิจที่ผ่าน';
    if (/ความก้าวหน้า/i.test(value)) return 'ความก้าวหน้าภารกิจ';
    return value;
  }

  function homeStats() {
    var root = byId('homeStats');
    if (!root) return [];
    return Array.from(root.querySelectorAll('.stat')).map(function (card) {
      return {
        value: text(card.querySelector('b') && card.querySelector('b').textContent),
        label: normalLabel(card.querySelector('span') && card.querySelector('span').textContent)
      };
    }).filter(function (item) {
      return item.value || item.label;
    });
  }

  function reportMarkup() {
    var model = progress() || {};
    var stats = homeStats();
    var cards;
    if (stats.length) {
      cards = stats.map(function (item) {
        return '<div class="eap-v296-stat"><b>' + escapeHtml(item.value) + '</b><span>' + escapeHtml(item.label) + '</span></div>';
      }).join('');
    } else {
      cards = '<div class="eap-v296-stat"><b>' + (Number(model.passed) || TOTAL) + '/' + TOTAL + '</b><span>ความก้าวหน้าภารกิจ</span></div>';
    }

    return [
      '<div class="eap-v296-top">',
      '<div>',
      '<div class="eap-v296-kicker">🏆 ผ่านครบแล้ว • Group ' + GROUP + '</div>',
      '<h3>รายงานผลสำเร็จ EAP Word Quest</h3>',
      '<p>คุณผ่าน Vocabulary Arc ครบทั้ง ' + TOTAL + '/' + TOTAL + ' ภารกิจ และผ่าน Vocabulary Boss ครบ 5/5 ด่านแล้ว รายงานนี้สรุปผลเพื่อใช้ทบทวนและติดตามการพัฒนาต่อจากนี้</p>',
      '</div>',
      '<div class="eap-v296-score"><b>' + (Number(model.passed) || TOTAL) + '/' + TOTAL + '</b><span>Mission Complete</span></div>',
      '</div>',
      '<div class="eap-v296-stats">' + cards + '</div>',
      '<div class="eap-v296-actions"><button class="btn primary-play" id="eapV296OpenDeck" type="button">เปิด Word Deck ทบทวน</button></div>'
    ].join('');
  }

  function ensureReport() {
    var button = sourceButton();
    var report = byId('eapV296CompletionReport');
    var controls;
    if (!button) return null;
    if (!report) {
      report = document.createElement('section');
      report.id = 'eapV296CompletionReport';
      report.hidden = true;
      report.setAttribute('aria-live', 'polite');
      report.setAttribute('tabindex', '-1');
      controls = button.closest('.student-controls') || button.parentElement;
      if (controls) controls.insertAdjacentElement('afterend', report);
      else button.insertAdjacentElement('afterend', report);
    }
    return report;
  }

  function syncButton() {
    var button = sourceButton();
    var label;
    if (!button || !completed()) return null;
    if (button.id !== 'eapV296CompletionBtn') button.id = 'eapV296CompletionBtn';
    if (button.dataset) {
      delete button.dataset.eapV239Completion;
      button.dataset.eapV296Completion = 'true';
    }
    label = reportOpen ? 'ซ่อนรายงานผลสำเร็จ' : 'ดูรายงานผลสำเร็จ';
    if (text(button.textContent) !== label) button.textContent = label;
    button.disabled = false;
    button.setAttribute('aria-expanded', reportOpen ? 'true' : 'false');
    button.setAttribute('aria-controls', 'eapV296CompletionReport');
    button.setAttribute('aria-label', label + ' EAP Word Quest');
    button.title = label + ' หลังผ่าน EAP Word Quest ครบ 20/20';
    return button;
  }

  function syncOpenState() {
    var home = byId('homeScreen');
    var report = ensureReport();
    var markup;
    if (!home || !report) return;
    if (reportOpen) {
      markup = reportMarkup();
      if (report.innerHTML !== markup) report.innerHTML = markup;
      report.hidden = false;
      home.dataset.eapV296ReportOpen = 'true';
    } else {
      report.hidden = true;
      delete home.dataset.eapV296ReportOpen;
    }
    syncButton();
  }

  function restoreNormal() {
    var button = byId('eapV296CompletionBtn');
    var report = byId('eapV296CompletionReport');
    var home = byId('homeScreen');
    reportOpen = false;
    if (report) report.hidden = true;
    if (home) delete home.dataset.eapV296ReportOpen;
    if (button) {
      button.id = 'quickStartBtn';
      if (button.dataset) delete button.dataset.eapV296Completion;
      button.removeAttribute('aria-expanded');
      button.removeAttribute('aria-controls');
    }
  }

  function apply() {
    scheduled = false;
    if (applying) return;
    applying = true;
    try {
      addStyle();
      var legacy = byId('eapV239CompletionReport');
      if (legacy) legacy.hidden = true;
      if (!onHome()) return;
      if (!completed()) {
        restoreNormal();
        return;
      }
      syncButton();
      syncOpenState();
    } finally {
      applying = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function toggleReport() {
    if (!onHome() || !completed()) return;
    reportOpen = !reportOpen;
    syncOpenState();
    if (reportOpen) {
      setTimeout(function () {
        var report = byId('eapV296CompletionReport');
        if (report) {
          report.scrollIntoView({behavior:'smooth', block:'start'});
          report.focus({preventScroll:true});
        }
      }, 30);
    } else {
      var button = byId('eapV296CompletionBtn');
      if (button) button.focus({preventScroll:true});
    }
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!target) return;
    if (target.id === 'eapV296CompletionBtn') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleReport();
      return;
    }
    if (target.id === 'eapV296OpenDeck') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      var deck = byId('wordDeckBtn');
      if (deck) deck.click();
    }
  }, true);

  function bindObserver() {
    var home = byId('homeScreen');
    if (!home || observer) return;
    observer = new MutationObserver(function () {
      if (!applying) schedule();
    });
    observer.observe(home, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class','hidden']});
  }

  window.addEventListener('eap-core-run-finished', schedule);
  window.addEventListener('eap-word-authority-ready', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) schedule();
  });

  addStyle();
  bindObserver();
  [0,100,350,900,1800,3200].forEach(function (delay) {
    setTimeout(function () {
      bindObserver();
      schedule();
    }, delay);
  });

  window.inspectEapWordHomeReportV296 = function () {
    return {
      version: VERSION,
      onHome: onHome(),
      completed: completed(),
      reportOpen: reportOpen,
      toggleLabel: text(byId('eapV296CompletionBtn') && byId('eapV296CompletionBtn').textContent),
      legacyReportVisible: Boolean(byId('eapV239CompletionReport') && !byId('eapV239CompletionReport').hidden),
      reportVisible: Boolean(byId('eapV296CompletionReport') && !byId('eapV296CompletionReport').hidden)
    };
  };

  console.info('[EAP Word Quest] V296 home completion report ready', {version: VERSION});
})();
