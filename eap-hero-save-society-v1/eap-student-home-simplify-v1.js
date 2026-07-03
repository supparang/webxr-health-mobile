/* =========================================================
   EAP Hero Student Home Simplifier v3 + Learning Loaders
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

  const textOf = (el) => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  const isExact = (rx, value) => rx.test(value);

  function hide(el) {
    if (!el || el.dataset.studentHomeHidden === '1') return;
    el.dataset.studentHomeHidden = '1';
    el.style.setProperty('display', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
  }

  function isHomeVisible() {
    const bodyText = document.body ? document.body.innerText : '';
    return /EAP Hero:\s*Save the Society/i.test(bodyText) && /Player Status/i.test(bodyText);
  }

  function simplifyButtons() {
    const controls = [...document.querySelectorAll('button, a.btn, [role="button"]')];
    controls.forEach((button) => {
      if (HIDE_BUTTON_TEXT.some((rx) => isExact(rx, textOf(button)))) hide(button);
    });
    const reports = controls.filter((button) =>
      /^my\s*learning\s*report$/i.test(textOf(button)) && button.dataset.studentHomeHidden !== '1'
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

  function appendScript(id, src, onload) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    if (typeof onload === 'function') script.onload = onload;
    document.head.appendChild(script);
  }

  function loadA2B1TaskScaffold() {
    appendScript(
      'eap-a2b1-task-scaffold-v2-loader',
      './eap-a2b1-task-scaffold-v2.js?v=20260704-a2b1-scaffold-v2',
      () => appendScript(
        'eap-speaking-bank-v2-loader',
        './eap-speaking-bank-v2.js?v=20260704-speaking-bank-v2'
      )
    );
  }

  function loadBossGateV2() {
    /* Preserve the core Boss Clash callback when an old cache has loaded the
       earlier gate file before the current four-skill version arrives. */
    const coreStart = window.EAPHero &&
      (window.EAPHero.__bossFourSkillOriginalStart || window.EAPHero.startGateBoss);
    if (coreStart) window.__EAP_CORE_BOSS_START_V2 = coreStart;

    appendScript(
      'eap-boss-four-skill-v2-loader',
      './eap-boss-four-skill-gate-v1.js?v=20260704-boss4skill-v2',
      () => {
        if (window.EAPHero && window.__EAP_CORE_BOSS_START_V2) {
          window.EAPHero.__bossFourSkillOriginalStart = window.__EAP_CORE_BOSS_START_V2;
        }
      }
    );
    appendScript(
      'eap-boss-audio-v2-loader',
      './eap-boss-audio-compat-v2.js?v=20260704-boss-audio-v2'
    );
  }

  function start() {
    loadA2B1TaskScaffold();
    simplifyHome();
    const observer = new MutationObserver(() => simplifyHome());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('load', () => setTimeout(loadBossGateV2, 0), { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
