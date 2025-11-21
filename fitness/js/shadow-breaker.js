// === js/shadow-breaker.js — bootstrap Shadow Breaker ===
'use strict';

import { initShadowBreaker } from './engine.js';

window.addEventListener('DOMContentLoaded', () => {
  try {
    initShadowBreaker();
    console.log('[ShadowBreaker] init OK');
  } catch (err) {
    console.error('[ShadowBreaker] init error', err);
  }
});