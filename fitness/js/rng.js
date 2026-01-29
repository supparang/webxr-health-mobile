// === /fitness/js/rng.js — deterministic RNG helpers ===
'use strict';

// mulberry32 deterministic PRNG
export function makeRng(seed){
  let a = (seed >>> 0) || 1;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getUrlSeed(){
  try{
    const sp = new URL(location.href).searchParams;
    const s = sp.get('seed');
    const n = s != null ? Number(s) : NaN;
    return Number.isFinite(n) ? n : null;
  }catch(_){
    return null;
  }
}

export function setUrlSeed(seed){
  try{
    const u = new URL(location.href);
    u.searchParams.set('seed', String(seed));
    history.replaceState(null, '', u.toString());
  }catch(_){}
}