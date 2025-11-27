// === js/main-shadow.js — Shadow Breaker bootstrap (2025-12-02) ===
'use strict';

import { initShadowBreaker } from './engine.js';

function boot() {
  try {
    initShadowBreaker();
    console.log('[ShadowBreaker] initShadowBreaker called from main-shadow.js');
  } catch (err) {
    console.error('[ShadowBreaker] init failed', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
