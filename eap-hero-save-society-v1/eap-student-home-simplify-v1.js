/* =========================================================
   EAP Hero Student Home Simplifier v2 + Learning Ladder Loader
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

  const textOf = (el) => String(el?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();

  const isExact = (rx, value) => rx.test(value);

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
    const controls = [...document.querySelectorAll('button, a.btn, [role="button"]')];

    controls.forEach((button) => {
      const text = textOf(button);
      if (HIDE_BUTTON_TEXT.some((rx) => isExact(rx, text))) hide(button);
    });

    // Keep exactly one content button labelled “My Learning Report”.
    // Header “Report” is a different control and remains available.
    const reports = controls.filter((button) =>
      /^my\s*learning\s*report$/i.test(textOf(button)) &&
      button.dataset.studentHomeHidden !== '1'
    );
    reports.slice(1).forEach(hide);
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

  function loadLearningLadder() {
    if (document.getElementById('eap-learning-ladder-loader')) return;
    const script = document.createElement('script');
    script.id = 'eap-learning-ladder-loader';
    script.src = './eap-learning-ladder-v1.js?v=20260704-learning-ladder-v1';
    script.async = true;
    document.head.appendChild(script);
  }

  function start() {
    loadLearningLadder();
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
