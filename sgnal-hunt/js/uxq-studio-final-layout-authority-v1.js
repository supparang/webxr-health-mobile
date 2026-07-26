/* CSAI2601 UX Quest • Studio Final Layout Authority v1
 * Keeps each self-check checkbox beside its label and anchors the Master Figma
 * panel inside Studio Practice immediately before Self-check.
 */
(() => {
  'use strict';

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const STYLE_ID = 'uxq-studio-final-layout-authority-v1-style';
  const PANEL_ID = 'uxqProjectFigmaEvidenceV4';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .artifact[data-studio-practice-v1] .studio-checks {
        display: grid !important;
        grid-template-columns: minmax(0,1fr) !important;
        gap: 10px !important;
        width: 100% !important;
      }
      .artifact[data-studio-practice-v1] .studio-checks > h3 {
        grid-column: 1 / -1 !important;
        width: 100% !important;
      }
      .artifact[data-studio-practice-v1] label.studio-check {
        display: grid !important;
        grid-template-columns: 22px minmax(0,1fr) !important;
        align-items: start !important;
        justify-content: start !important;
        gap: 10px !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 4px 0 !important;
        text-align: left !important;
      }
      .artifact[data-studio-practice-v1] label.studio-check input[type='checkbox'] {
        grid-column: 1 !important;
        width: 18px !important;
        height: 18px !important;
        min-width: 18px !important;
        margin: 2px 0 0 !important;
        justify-self: start !important;
      }
      .artifact[data-studio-practice-v1] label.studio-check > span {
        grid-column: 2 !important;
        display: block !important;
        width: auto !important;
        min-width: 0 !important;
        margin: 0 !important;
        text-align: left !important;
        line-height: 1.5 !important;
        overflow-wrap: anywhere !important;
      }
      .artifact[data-studio-practice-v1] > #${PANEL_ID} {
        display: grid !important;
        width: 100% !important;
        max-width: none !important;
        margin: 4px 0 6px !important;
        z-index: 1 !important;
      }
      .artifact[data-studio-practice-v1] .actions {
        display: grid !important;
        grid-template-columns: minmax(220px,auto) minmax(0,1fr) !important;
        align-items: center !important;
        gap: 12px !important;
      }
      .artifact[data-studio-practice-v1] .actions small {
        display: block !important;
        min-width: 0 !important;
        line-height: 1.45 !important;
        overflow-wrap: anywhere !important;
      }
      @media (max-width: 700px) {
        .artifact[data-studio-practice-v1] .actions {
          grid-template-columns: 1fr !important;
        }
        .artifact[data-studio-practice-v1] .actions .btn {
          width: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function arrange() {
    installStyle();
    const panel = document.getElementById(PANEL_ID);
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    const checks = artifact?.querySelector('.studio-checks');
    if (!panel || !artifact || !checks) return false;

    if (panel.parentNode !== artifact || panel.nextElementSibling !== checks) {
      checks.insertAdjacentElement('beforebegin', panel);
    }
    panel.dataset.positionReady = '1';
    panel.hidden = false;
    return true;
  }

  let timer = 0;
  function schedule(delay = 40) {
    clearTimeout(timer);
    timer = setTimeout(arrange, delay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => schedule(60), { once: true });
  } else {
    schedule(60);
  }

  new MutationObserver(() => schedule(50)).observe(ROOT, { childList: true, subtree: true });
  [150, 400, 900, 1600, 3000, 5000].forEach(ms => setTimeout(arrange, ms));
  setInterval(arrange, 900);

  window.UXQStudioFinalLayoutAuthorityV1 = Object.freeze({ arrange });
})();