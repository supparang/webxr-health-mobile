/* CSAI2601 UX Quest • Choice Fairness Guard v4
   2026-07-12
   Preserve each item's original prompt, choices, and Reason Check text.
   This guard now handles presentation fairness only; it never replaces
   learning content with a repeated stage template.
*/
(() => {
  'use strict';

  const VERSION = 'v20260712-preserve-item-content-v4';
  const qs = new URLSearchParams(location.search);
  const NODE = String(qs.get('node') || qs.get('id') || 'W1').toUpperCase();
  if (!/^(W(?:[1-9]|1[0-5])|B[1-4])$/.test(NODE)) return;

  const visible = (el) => Boolean(el && el.offsetParent !== null);

  function optionIndex(button) {
    return Math.max(0, Array.from(button.closest('.options')?.children || []).indexOf(button));
  }

  function preserveOriginal(button) {
    if (!button || button.dataset.uxqFairPreserved === VERSION) return;

    /* Remove artifacts inserted by the obsolete template-replacement guard. */
    button.querySelectorAll('.uxqFairLetter').forEach((el) => el.remove());

    const originalText = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    if (!originalText) return;

    button.dataset.uxqFairPreserved = VERSION;
    button.dataset.uxqOriginalText = originalText.slice(0, 700);

    const letter = document.createElement('span');
    letter.className = 'uxqFairLetter';
    letter.setAttribute('aria-hidden', 'true');
    letter.textContent = String.fromCharCode(65 + optionIndex(button));
    button.prepend(letter);
  }

  function cleanDebugBadges(scope) {
    scope.querySelectorAll('.uxqFairnessBadge').forEach((el) => el.remove());
  }

  function apply() {
    const root = document.querySelector('#uxqCanonicalNode') || document.body;
    cleanDebugBadges(root);

    root.querySelectorAll('.question [data-choice], .verify [data-reason]').forEach((button) => {
      if (visible(button)) preserveOriginal(button);
    });
  }

  function css() {
    if (document.getElementById('uxqChoiceFairnessPreserveCSS')) return;
    const style = document.createElement('style');
    style.id = 'uxqChoiceFairnessPreserveCSS';
    style.textContent = `
      .uxqFairnessBadge{display:none!important}
      .option .uxqFairLetter{
        display:inline-grid;place-items:center;vertical-align:middle;
        min-width:1.85rem;height:1.5rem;margin-right:.55rem;
        border:1px solid rgba(103,232,249,.65);
        background:rgba(8,145,178,.22);color:#a5f3fc;
        border-radius:999px;font-weight:1000;font-size:.76rem;line-height:1
      }
      .question>.options .option,.verify .options .option{
        white-space:normal!important;overflow:visible!important;
        text-overflow:clip!important;min-height:5.2rem!important
      }
      .verify .options .option{min-height:5.8rem!important}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    css();
    apply();
    let timer = 0;
    const schedule = () => {
      clearTimeout(timer);
      timer = window.setTimeout(apply, 30);
    };
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true
    });
    window.addEventListener('click', () => window.setTimeout(apply, 50), true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();