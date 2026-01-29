// === /fitness/js/rng.js ===
// Tiny seeded RNG (xmur3 + sfc32)
// ✅ createRng(seedString) -> { rand(), range(min,max), int(a,b) }
'use strict';

function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h<<13) | (h>>>19);
  }
  return function(){
    h = Math.imul(h ^ (h>>>16), 2246822507);
    h = Math.imul(h ^ (h>>>13), 3266489909);
    h ^= (h>>>16);
    return h>>>0;
  };
}

function sfc32(a,b,c,d){
  return function(){
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b>>>9);
    b = (c + (c<<3)) | 0;
    c = (c<<21) | (c>>>11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t>>>0) / 4294967296;
  };
}

export function createRng(seedString){
  const s = String(seedString ?? 'shadowbreaker');
  const seed = xmur3(s);
  const a = seed(), b = seed(), c = seed(), d = seed();
  const r = sfc32(a,b,c,d);

  return {
    rand: ()=> r(),
    range: (min,max)=> min + r()*(max-min),
    int: (a,b)=> Math.floor(a + r()*(b-a+1))
  };
}
