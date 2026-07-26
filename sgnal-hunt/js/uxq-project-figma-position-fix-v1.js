/* CSAI2601 UX Quest • Figma panel position fix v1
 * Prevent the Master Figma panel from appearing above the mission header.
 * The panel is shown only when the Studio/Artifact area exists, then anchored
 * immediately before that area so the learning sequence remains correct.
 */
(() => {
  'use strict';

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const PANEL_ID = 'uxqProjectFigmaEvidenceV4';
  const STYLE_ID = 'uxq-project-figma-position-fix-v1-style';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}[data-position-ready="0"] {
        display: none !important;
      }
      #${PANEL_ID}[data-position-ready="1"] {
        display: grid !important;
        margin-top: 20px !important;
        margin-bottom: 20px !important;
        z-index: 2 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function visible(element) {
    if (!element || !element.isConnected) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function findStudioAnchor() {
    const selectors = [
      '[data-studio-practice]',
      '#uxqStudioPractice',
      '.studio-practice',
      '.artifact[data-studio-card]',
      '.artifact'
    ];

    const candidates = [];
    selectors.forEach(selector => {
      ROOT.querySelectorAll(selector).forEach(element => {
        if (!visible(element)) return;
        const text = String(element.textContent || '');
        const hasFields = element.querySelector('textarea,input,[data-studio-key]');
        const hasSubmit = element.querySelector('[data-studio-submit],[data-save-artifact],button[type="submit"]');
        const isStudio = /Studio Practice|Artifact|ชิ้นงาน|ผลงาน|Reflection|สะท้อน/i.test(text);
        if (hasFields || hasSubmit || isStudio) candidates.push(element);
      });
    });

    if (!candidates.length) return null;
    return candidates.sort((a, b) => {
      const aScore = a.querySelectorAll('[data-studio-key],textarea,input').length + (a.querySelector('[data-studio-submit],[data-save-artifact],button[type="submit"]') ? 20 : 0);
      const bScore = b.querySelectorAll('[data-studio-key],textarea,input').length + (b.querySelector('[data-studio-submit],[data-save-artifact],button[type="submit"]') ? 20 : 0);
      return bScore - aScore;
    })[0];
  }

  function position() {
    installStyle();
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    panel.dataset.positionReady = '0';
    const studio = findStudioAnchor();
    if (!studio || !studio.parentNode) return;

    if (panel.parentNode !== studio.parentNode || panel.nextElementSibling !== studio) {
      studio.insertAdjacentElement('beforebegin', panel);
    }
    panel.dataset.positionReady = '1';
  }

  let timer = 0;
  function schedule(delay = 50) {
    clearTimeout(timer);
    timer = setTimeout(position, delay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => schedule(60), { once: true });
  } else {
    schedule(60);
  }

  new MutationObserver(() => schedule(80)).observe(ROOT, { childList: true, subtree: true });
  [250, 700, 1500, 3000, 5000].forEach(ms => setTimeout(position, ms));

  window.UXQProjectFigmaPositionFixV1 = Object.freeze({ position });
})();