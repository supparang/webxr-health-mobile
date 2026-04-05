function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function nextHash() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function sfc32(a, b, c, d) {
  return function nextRand() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createSeededRng(seed = '') {
  const src = String(seed || Date.now());
  const seedFn = xmur3(src);
  const rand = sfc32(seedFn(), seedFn(), seedFn(), seedFn());

  return {
    seed: src,
    next() {
      return rand();
    },
    int(min, max) {
      min = Math.ceil(Number(min) || 0);
      max = Math.floor(Number(max) || 0);
      if (max < min) [min, max] = [max, min];
      return Math.floor(rand() * (max - min + 1)) + min;
    },
    pick(arr, fallback = null) {
      if (!Array.isArray(arr) || arr.length === 0) return fallback;
      return arr[Math.floor(rand() * arr.length)] ?? fallback;
    },
    shuffle(arr) {
      const out = Array.isArray(arr) ? [...arr] : [];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance(p = 0.5) {
      p = Number(p);
      if (!Number.isFinite(p)) p = 0.5;
      return rand() < Math.max(0, Math.min(1, p));
    }
  };
}