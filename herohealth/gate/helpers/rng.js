// === /herohealth/gate/helpers/rng.js ===
// Shared RNG helpers for gate modules

export function mulberry32(seed){
  let t = seed >>> 0;
  return ()=>{
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(rng, min, max){
  return rng() * (max - min) + min;
}

export function randInt(rng, min, max){
  return Math.floor(rand(rng, min, max + 1));
}

export function shuffle(arr, rng){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
