/* =========================================================
   EAP Hero Student Home Simplifier v1
   Student-facing home: one primary path, no duplicate actions
========================================================= */
(() => {
  'use strict';

  const HIDE_BUTTON_TEXT = [
    /^map$/i,
    /^เริ่ม\s*\/\s*ตั้งค่า\s*player$/i,
    /^student\s*safe\s*start$/i,
    /^เข้า\s*campus\s*map$/i,
    /^reset\s*local\s*progress$/i
  ];

  const KEEP_BUTTON_TEXT = [
    /^start\s*\/\s*continue$/i,
    /^my\s*learning\s*report$/i,
    /^profile$/i,
    /^continue$/i,
    /^report$/i
  ];

  const textOf = (el) => String(el?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();

  const matches = (list, text) => list.some((rx) => rx.test(text));

  function hide(el) {
    if (!el || el.dataset.studentHomeHidden === '1') return;
    el.dataset.studentHomeHidden = '1';
    el.style.setProperty('display', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
  }

  function isHomeVisible() {
    const bodyText = document.body ? document.body.innerText : '';
    return /EAP Hero:\s*Save the Society/i.test(bodyText) &&
      /Player Status/i.test(bodyText);
  }

  function simplifyButtons() {
    document.querySelectorAll('button, a.btn, [role="button"]').forEach((button) => {
      const text = textOf(button);
      if (!text) return;

      if (matches(HIDE_BUTTON_TEXT, text)) {
        hide(button);
        return;
      }

      // Hide repeated content-area controls; header Continue/Profile/Report remain.
      if (
        matches(KEEP_BUTTON_TEXT, text) &&
        button.closest('.hero-actions, .home-actions, .start-actions, .landing-actions')
      ) {
        const key = text.toLowerCase();
        const prior = [...document.querySelectorAll('button, a.btn, [role="button"]')]
          .filter((item) => textOf(item).toLowerCase() === key)
          .filter((item) => item.dataset.studentHomeHidden !== '1');
        if (prior.length > 1 && button !== prior[0]) hide(button);
      }
    });
  }

  function simplifyStatus() {
    const title = [...document.querySelectorAll('h1,h2,h3,strong,div')]
      .find((el) => textOf(el) === 'Player Status');
    if (!title) return;

    const panel = title.closest('section, aside, .panel, .card, div');
    if (!panel) return;

    [...panel.querySelectorAll('button')].forEach(hide);

    [...panel.querySelectorAll('*')].forEach((el) => {
      const text = textOf(el);
      if (!text || el.children.length) return;
      if (/^(Society Saver|Rank|Coins|Daily Streak|ยังไม่มี Badge)/i.test(text)) {
        const block = el.closest('.stat, .metric, .card, div');
        if (block && block !== panel) hide(block);
      }
    });
  }

  function simplifyHome() {
    if (!isHomeVisible()) return;
    simplifyButtons();
    simplifyStatus();
  }

  function start() {
    simplifyHome();
    const observer = new MutationObserver(() => simplifyHome());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();