// --- sfx.js ---
'use strict';
const BUCKET = 'fitness/sfx/';

// preload
const cache = {};
['tap','perfect','good','late','miss','fever'].forEach(n => {
  const a = new Audio(`${BUCKET}${n}.mp3`);
  a.preload = 'auto';
  cache[n] = a;
});

export const SFX = {
  play(name) {
    const a = cache[name];
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(()=>{});
  }
};