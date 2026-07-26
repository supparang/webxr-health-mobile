/* =========================================================
 * CSAI2601 UX Quest • Three-Part AI Quest Flow v1.1
 * CSS-only enhancement for the existing authoritative tracker.
 * Does NOT replace, move, clone, or rewrite tracker DOM.
 * Google Sheet remains the sole source of truth.
 * ========================================================= */
(() => {
  'use strict';

  const STYLE_ID = 'uxqThreePartAIQuestFlowStyleV11';
  const BOX_ID = 'uxqThreePartCompletion';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BOX_ID}.uxq-aiq-flow-safe {
        width: min(100%, 1120px) !important;
        margin: 24px auto !important;
        padding: 20px !important;
        overflow: visible !important;
        border-radius: 20px !important;
        border: 1px solid rgba(68,224,181,.48) !important;
        background: linear-gradient(180deg,rgba(7,41,58,.98),rgba(5,27,44,.98)) !important;
        box-sizing: border-box !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__head {
        display: flex !important;
        align-items: flex-start !important;
        justify-content: space-between !important;
        gap: 18px !important;
        margin: 0 0 18px !important;
        padding: 0 !important;
        min-width: 0 !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__head > div {
        min-width: 0 !important;
        flex: 1 1 auto !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__head h3 {
        margin: 0 !important;
        font-size: clamp(18px,2vw,23px) !important;
        line-height: 1.3 !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__head p {
        margin: 5px 0 0 !important;
        line-height: 1.5 !important;
        overflow-wrap: anywhere !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__count {
        flex: 0 0 auto !important;
        white-space: nowrap !important;
        align-self: flex-start !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__grid {
        display: grid !important;
        grid-template-columns: repeat(3,minmax(0,1fr)) !important;
        gap: 46px !important;
        align-items: stretch !important;
        width: 100% !important;
        min-width: 0 !important;
        overflow: visible !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item {
        position: relative !important;
        display: block !important;
        width: auto !important;
        min-width: 0 !important;
        min-height: 178px !important;
        padding: 58px 18px 18px !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        border-radius: 18px !important;
        overflow: visible !important;
        word-break: normal !important;
        overflow-wrap: anywhere !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item::before {
        position: absolute !important;
        top: 14px !important;
        left: 16px !important;
        display: grid !important;
        place-items: center !important;
        width: 34px !important;
        height: 34px !important;
        border-radius: 50% !important;
        background: #183f62 !important;
        color: #fff !important;
        font-weight: 900 !important;
        font-size: 17px !important;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.15) !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item:nth-child(1)::before { content: '1'; }
      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item:nth-child(2)::before { content: '2'; }
      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item:nth-child(3)::before { content: '3'; }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item[data-state='done']::before {
        content: '✓' !important;
        background: #2bc894 !important;
        color: #03281d !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item:not(:last-child)::after {
        content: '→' !important;
        position: absolute !important;
        top: 50% !important;
        right: -35px !important;
        transform: translateY(-50%) !important;
        width: 24px !important;
        text-align: center !important;
        color: #5ce2bb !important;
        font-size: 28px !important;
        font-weight: 900 !important;
        line-height: 1 !important;
        pointer-events: none !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item b {
        display: block !important;
        margin: 0 0 9px !important;
        padding: 0 !important;
        font-size: 17px !important;
        line-height: 1.35 !important;
        white-space: normal !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item span,
      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item small {
        display: block !important;
        width: auto !important;
        max-width: 100% !important;
        white-space: normal !important;
        line-height: 1.55 !important;
        overflow-wrap: anywhere !important;
      }

      #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__foot {
        margin-top: 16px !important;
        padding: 12px 14px !important;
        text-align: center !important;
        border-radius: 13px !important;
      }

      @media (max-width: 820px) {
        #${BOX_ID}.uxq-aiq-flow-safe {
          padding: 16px !important;
          margin: 18px auto !important;
        }
        #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__head {
          display: block !important;
        }
        #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__count {
          display: inline-block !important;
          margin-top: 10px !important;
        }
        #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__grid {
          grid-template-columns: 1fr !important;
          gap: 42px !important;
        }
        #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item {
          min-height: 0 !important;
          padding: 56px 16px 17px !important;
        }
        #${BOX_ID}.uxq-aiq-flow-safe .uxq-3part__item:not(:last-child)::after {
          content: '↓' !important;
          top: auto !important;
          bottom: -34px !important;
          left: 50% !important;
          right: auto !important;
          transform: translateX(-50%) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function cleanLegacyDamage(box) {
    if (!box) return;
    box.classList.remove('uxq-aiq-three-flow');
    box.removeAttribute('data-aiq-flow-rendered');
    box.style.removeProperty('display');
    box.style.removeProperty('grid-template-columns');
    box.style.removeProperty('width');
    box.style.removeProperty('min-width');
    box.style.removeProperty('overflow');

    box.querySelectorAll('.uxq-aiq-flow-head,.uxq-aiq-flow-grid,.uxq-aiq-complete').forEach(el => {
      // Old v1 replaced the authoritative tracker. A normal reload recreates the original tracker;
      // this guard only prevents further compounding on already damaged DOM.
      el.style.removeProperty('width');
      el.style.removeProperty('min-width');
      el.style.removeProperty('grid-template-columns');
    });
  }

  function apply() {
    installStyle();
    const box = document.getElementById(BOX_ID);
    if (!box) return;
    cleanLegacyDamage(box);
    box.classList.add('uxq-aiq-flow-safe');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(apply, 300);
  setTimeout(apply, 1000);
  setTimeout(apply, 2500);
})();
