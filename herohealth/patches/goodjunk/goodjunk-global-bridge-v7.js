(() => {
  'use strict';
  try {
    if (!Object.getOwnPropertyDescriptor(window, 'state')) {
      Object.defineProperty(window, 'state', {
        configurable: true,
        get: () => state
      });
    }
  } catch (error) {
    console.warn('[GoodJunk Bridge v7] state bridge unavailable', error);
  }

  try {
    if (typeof window.hit !== 'function' && typeof hit === 'function') {
      window.hit = (x, y) => hit(x, y);
    }
    if (typeof window.ev !== 'function' && typeof ev === 'function') {
      window.ev = (type, payload) => ev(type, payload);
    }
    if (typeof window.show !== 'function' && typeof show === 'function') {
      window.show = (text) => show(text);
    }
  } catch (error) {
    console.warn('[GoodJunk Bridge v7] function bridge unavailable', error);
  }

  window.__GJ_GLOBAL_BRIDGE_V7__ = true;
  console.info('[GoodJunk Bridge v7] ready');
})();
