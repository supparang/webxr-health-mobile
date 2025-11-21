// === js/main-shadow.js ===
import { initShadowBreaker } from './engine.js';

window.addEventListener('DOMContentLoaded', () => {
  console.log('[ShadowBreaker] boot'); // debug ดูใน console
  initShadowBreaker();
});