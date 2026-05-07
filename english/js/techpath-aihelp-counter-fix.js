/* =========================================================
 * /english/js/techpath-aihelp-counter-fix.js
 * PATCH v20260507-AIHELP-COUNTER-FIX
 *
 * ✅ กด AI Help แล้วนับ 0/3 -> 1/3 -> 2/3 -> 3/3
 * ✅ sync UI card "AI Help Limit"
 * ✅ ไม่ไปรวมนับปุ่มเลือกเสียง / Test Voice / Voice Doctor
 * ✅ กันนับซ้ำจาก click + speech event
 * ✅ ทำงานร่วมกับ techpath-aihelp-voice-final-lock.js
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-aihelp-counter-fix-v20260507';
  const MAX_HELP = 3;

  let lastCountAt = 0;
  let lastCountSource = '';

  function qs(k, d = '') {
    try {
      return new URL(location.href).searchParams.get(k) || d;
    } catch (e) {
      return d;
    }
  }

  function txt(el) {
    return String(el && el.textContent ? el.textContent : '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function currentSessionKey() {
    const s =
      qs('session') ||
      qs('s') ||
      window.LESSON_SESSION ||
      window.currentSession ||
      window.currentS ||
      'S01';

    const diff = qs('diff', 'normal') || 'normal';
    const pid = qs('pid') || qs('studentId') || qs('student_id') || window.studentId || 'anon';

    return `TECHPATH_AIHELP_COUNT_${pid}_${String(s).toUpperCase()}_${diff}`;
  }

  function getCount() {
    try {
      return Number(sessionStorage.getItem(currentSessionKey()) || '0') || 0;
    } catch (e) {
      return 0;
    }
  }

  function setCount(n) {
    n = Math.max(0, Math.min(MAX_HELP, Number(n) || 0));

    try {
      sessionStorage.setItem(currentSessionKey(), String(n));
    } catch (e) {}

    window.TECHPATH_AIHELP_USED = n;
    window.LESSON_AIHELP_USED = n;

    updateUi(n);

    return n;
  }

  function isVoicePanel(el) {
    return !!(
      el &&
      el.closest &&
      el.closest(
        [
          '#techPathVoiceMini',
          '#lessonFinalVoiceClean',
          '#lessonAiHelpVoicePicker',
          '#lessonUsVoiceDoctor',
          '#techPathFinalVoiceLockBadge',
          '#lessonFinalVoiceSelect',
          '#techPathVoiceSelect'
        ].join(',')
      )
    );
  }

  function isAiHelpButton(el) {
    if (!el || isVoicePanel(el)) return false;

    const label = txt(el).toLowerCase();
    const aria = String(el.getAttribute && el.getAttribute('aria-label') || '').toLowerCase();

    if (/test voice|voice doctor|เลือกเสียง|selected voice|us voice/i.test(label + ' ' + aria)) {
      return false;
    }

    return (
      el.hasAttribute?.('data-ai-help') ||
      el.hasAttribute?.('data-aihelp') ||
      el.classList?.contains('ai-help-btn') ||
      label.includes('ai help') ||
      aria.includes('ai help')
    );
  }

  function markUsed(source) {
    const now = Date.now();

    // กันนับซ้ำจาก click + speak event ที่เกิดติดกัน
    if (now - lastCountAt < 900) {
      return getCount();
    }

    lastCountAt = now;
    lastCountSource = source || 'unknown';

    const before = getCount();
    const after = setCount(before + 1);

    window.dispatchEvent(new CustomEvent('techpath:aihelp-count-updated', {
      detail: {
        patch: PATCH_ID,
        source: lastCountSource,
        used: after,
        max: MAX_HELP,
        sessionKey: currentSessionKey()
      }
    }));

    return after;
  }

  function findAiHelpLimitCards() {
    const nodes = Array.from(document.querySelectorAll('section, article, div, li'));

    return nodes.filter(function (el) {
      const t = txt(el);
      if (!/AI Help Limit/i.test(t)) return false;

      const r = el.getBoundingClientRect?.();
      if (!r) return true;

      // เลือก card ที่ไม่ใหญ่เกินทั้งหน้า
      return r.width > 120 && r.height > 40 && r.height < 260;
    });
  }

  function replaceTextNode(root, rx, replacement) {
    if (!root) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach(function (node) {
      const s = node.nodeValue || '';
      if (rx.test(s)) {
        node.nodeValue = s.replace(rx, replacement);
      }
    });
  }

  function updateUi(n) {
    const usedText = `${n}/${MAX_HELP}`;

    // 1) อัปเดต card ที่มี AI Help Limit
    const cards = findAiHelpLimitCards();

    cards.forEach(function (card) {
      replaceTextNode(card, /ใช้แล้ว\s*\d+\s*\/\s*\d+\s*ครั้ง/g, `ใช้แล้ว ${usedText} ครั้ง`);
      replaceTextNode(card, /\b\d+\s*\/\s*\d+\b/g, usedText);

      // เผื่อไม่มีตัวเลขใน card ให้เติมท้าย
      if (!new RegExp(`${n}\\s*/\\s*${MAX_HELP}`).test(txt(card))) {
        const small = document.createElement('div');
        small.className = 'techpath-aihelp-counter-inline';
        small.textContent = `ใช้แล้ว ${usedText} ครั้ง`;
        small.style.cssText = 'margin-top:4px;font-weight:900;color:#eaffff;opacity:.88;';
        card.appendChild(small);
      }
    });

    // 2) อัปเดต element ทั่วไปที่เป็น badge 0/3 ใกล้ AI Help
    Array.from(document.querySelectorAll('*')).forEach(function (el) {
      if (isVoicePanel(el)) return;

      const t = txt(el);

      if (/^\d+\s*\/\s*\d+$/.test(t)) {
        const near = el.closest('section, article, div, li');
        if (near && /AI Help/i.test(txt(near))) {
          el.textContent = usedText;
        }
      }
    });

    // 3) อัปเดต globals เผื่อ engine อ่าน
    window.TECHPATH_AIHELP_LIMIT = {
      used: n,
      max: MAX_HELP,
      remaining: Math.max(0, MAX_HELP - n)
    };
  }

  function bindButtons() {
    Array.from(document.querySelectorAll('button, a, [role="button"]')).forEach(function (btn) {
      if (btn.dataset.aiHelpCounterFixBound === '1') return;
      if (!isAiHelpButton(btn)) return;

      btn.dataset.aiHelpCounterFixBound = '1';

      btn.addEventListener('click', function () {
        markUsed('ai-help-button-click');
      }, true);
    });
  }

  function patchAiHelpFunctions() {
    const names = [
      'speakAIHelpUS',
      'speakAIHelp',
      'playAIHelpVoice',
      'playAiHelpVoice',
      'speakCoach',
      'speakHint'
    ];

    names.forEach(function (name) {
      const fn = window[name];

      if (typeof fn !== 'function') return;
      if (fn.__aiHelpCounterPatched) return;

      const wrapped = function () {
        const active = document.activeElement;

        // ไม่ให้นับตอน Test Voice / Voice picker
        if (!isVoicePanel(active)) {
          const textArg = String(arguments[0] || '');

          if (!/voice selected|selected voice|test voice|hello\. this is the selected voice/i.test(textArg)) {
            markUsed('ai-help-function-' + name);
          }
        }

        return fn.apply(this, arguments);
      };

      wrapped.__aiHelpCounterPatched = true;
      window[name] = wrapped;
    });
  }

  function listenVoiceEvents() {
    if (window.__techPathAiHelpCounterVoiceEventBound) return;
    window.__techPathAiHelpCounterVoiceEventBound = true;

    window.addEventListener('techpath:aihelp-voice-used', function (ev) {
      const text = String(ev.detail && ev.detail.text || '');

      if (/voice selected|selected voice|test voice|hello\. this is the selected voice/i.test(text)) {
        return;
      }

      markUsed('aihelp-voice-used-event');
    });
  }

  function exposeApi() {
    window.TechPathAIHelpCounter = {
      version: PATCH_ID,
      get: getCount,
      set: setCount,
      inc: function () {
        return markUsed('manual-inc');
      },
      reset: function () {
        return setCount(0);
      },
      updateUi: function () {
        updateUi(getCount());
      },
      debug: function () {
        return {
          patch: PATCH_ID,
          sessionKey: currentSessionKey(),
          used: getCount(),
          max: MAX_HELP,
          lastCountAt,
          lastCountSource,
          cardsFound: findAiHelpLimitCards().length
        };
      }
    };
  }

  function init() {
    exposeApi();
    bindButtons();
    patchAiHelpFunctions();
    listenVoiceEvents();
    updateUi(getCount());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  let tries = 0;
  const timer = setInterval(function () {
    tries += 1;
    bindButtons();
    patchAiHelpFunctions();
    updateUi(getCount());

    if (tries >= 40) clearInterval(timer);
  }, 400);

  try {
    const mo = new MutationObserver(function () {
      bindButtons();
      updateUi(getCount());
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(function () {
      try { mo.disconnect(); } catch (e) {}
    }, 20000);
  } catch (e) {}
})();
