/* CSAI2601 UX Quest • Device Mode Controller v1
 * Priority: ?device=mobile|tablet|pc -> automatic viewport/pointer detection.
 * Applies body[data-device-mode] and emits uxq-device-mode-changed.
 */
(() => {
  'use strict';

  const VALID = new Set(['mobile','tablet','pc']);
  const params = new URLSearchParams(location.search || '');
  const forced = String(params.get('device') || '').trim().toLowerCase();
  let mode = '';

  function autoDetect() {
    const width = Math.max(document.documentElement?.clientWidth || 0, window.innerWidth || 0);
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches || false;
    const touch = Number(navigator.maxTouchPoints || 0) > 0;
    if (width < 768) return 'mobile';
    if (width <= 1100 || ((coarse || touch) && width <= 1366)) return 'tablet';
    return 'pc';
  }

  function resolve() {
    return VALID.has(forced) ? forced : autoDetect();
  }

  function apply(next = resolve()) {
    if (!VALID.has(next)) next = autoDetect();
    const previous = mode;
    mode = next;
    document.documentElement.dataset.deviceMode = mode;
    if (document.body) {
      document.body.dataset.deviceMode = mode;
      document.body.dataset.deviceSource = VALID.has(forced) ? 'url' : 'auto';
    }
    if (previous !== mode) {
      window.dispatchEvent(new CustomEvent('uxq-device-mode-changed', {
        detail:{ mode, previous, forced:VALID.has(forced), viewport:window.innerWidth || 0 }
      }));
    }
    return mode;
  }

  let resizeTimer;
  function onResize() {
    if (VALID.has(forced)) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => apply(autoDetect()), 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply(), {once:true});
  } else apply();
  window.addEventListener('resize', onResize, {passive:true});
  window.addEventListener('orientationchange', onResize, {passive:true});

  window.UXQDeviceModeV1 = Object.freeze({
    get:() => mode || resolve(),
    apply,
    isForced:() => VALID.has(forced),
    version:'20260722-DEVICE-MODE-V1'
  });
})();