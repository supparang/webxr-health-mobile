// === /fitness/js/pattern-generator.js ===
// Pattern Generator — Shadow Breaker (PRODUCTION)
// ✅ Fair + fun target type scheduling (normal/decoy/bomb/heal/shield/bossface)
// ✅ Anti-frustration rules: prevents bomb spam, gives recovery windows
// ✅ Research deterministic: uses ?mode=research and/or provided seed
// Export: PatternGenerator

'use strict';

function clamp(v, a, b) { return Math.max(a, Math.min(b, Number(v) || 0)); }

function readQuery(key, d = null) {
  try { return new URL(location.href).searchParams.get(key) ?? d; } catch { return d; }
}

function isResearchMode() {
  const m = String(readQuery('mode', '') || '').toLowerCase();
  return m === 'research';
}

function hash32(str) {
  // FNV-1a 32-bit-ish
  let h = 2166136261 >>> 0;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function makeRng(seedU32) {
  // xorshift32
  let x = (seedU32 >>> 0) || 123456789;
  return {
    nextU32() {
      x ^= (x << 13) >>> 0;
      x ^= (x >>> 17) >>> 0;
      x ^= (x << 5) >>> 0;
      return x >>> 0;
    },
    next01() {
      // 0..1
      return (this.nextU32() >>> 0) / 4294967296;
    }
  };
}

function pickWeighted(r01, weights) {
  // weights: {type: w, ...}
  let total = 0;
  for (const k in weights) total += Math.max(0, Number(weights[k]) || 0);
  if (total <= 0) return 'normal';

  let r = r01 * total;
  for (const k in weights) {
    r -= Math.max(0, Number(weights[k]) || 0);
    if (r <= 0) return k;
  }
  // fallback
  return Object.keys(weights)[0] || 'normal';
}

export class PatternGenerator {
  constructor(opts = {}) {
    this._seed = 0;
    this._rng = null;

    // memory to enforce fairness
    this._lastTypes = [];          // recent types
    this._missStreak = 0;
    this._bombStreak = 0;
    this._decoyStreak = 0;
    this._healCooldown = 0;        // blocks too frequent heal
    this._shieldCooldown = 0;      // blocks too frequent shield
    this._recoveryWindow = 0;      // pushes more "normal/heal" after pain
    this._burstWindow = 0;         // high intensity moment

    this.reset(opts.seed);
  }

  reset(seed = null) {
    // Deterministic in research:
    // - if seed provided => use it
    // - else use ?seed=... if present
    // - else use a stable-ish derived seed from time (still deterministic per load if you want)
    let s = seed;

    if (s == null || s === '') {
      const qSeed = readQuery('seed', '');
      if (qSeed) s = qSeed;
    }

    if (s == null || s === '') {
      // if research but no seed, derive a consistent seed from URL (still reproducible for that URL)
      if (isResearchMode()) s = hash32(location.href);
      else s = Date.now();
    }

    const seedU32 = (typeof s === 'number') ? (s >>> 0) : hash32(String(s));
    this._seed = seedU32 >>> 0;
    this._rng = makeRng(this._seed);

    this._lastTypes = [];
    this._missStreak = 0;
    this._bombStreak = 0;
    this._decoyStreak = 0;
    this._healCooldown = 0;
    this._shieldCooldown = 0;
    this._recoveryWindow = 0;
    this._burstWindow = 0;

    return this._seed;
  }

  getSeed() { return this._seed >>> 0; }

  noteOutcome(outcome) {
    // outcome: 'hit' | 'miss' | 'bomb' | 'decoy' | 'heal' | 'shield'
    const o = String(outcome || '').toLowerCase();

    if (o === 'miss' || o === 'bomb') this._missStreak++;
    else this._missStreak = Math.max(0, this._missStreak - 1);

    if (o === 'bomb') this._bombStreak++;
    else this._bombStreak = 0;

    if (o === 'decoy') this._decoyStreak++;
    else this._decoyStreak = 0;

    // if player struggles, open recovery window
    if (this._missStreak >= 2) {
      this._recoveryWindow = clamp(this._recoveryWindow + 2, 0, 8);
    } else {
      this._recoveryWindow = Math.max(0, this._recoveryWindow - 1);
    }

    // burst moments: if playing well, create short intense windows
    if (o === 'hit') {
      this._burstWindow = clamp(this._burstWindow + 1, 0, 6);
    } else {
      this._burstWindow = Math.max(0, this._burstWindow - 1);
    }
  }

  next(params = {}) {
    // params: { diff, phase, hpYou, hpBoss, shield, fever, feverOn, combo }
    const diff = String(params.diff || 'normal').toLowerCase();
    const phase = clamp(params.phase || 1, 1, 9);
    const hpYou = clamp(params.hpYou ?? 100, 0, 100);
    const hpBoss = clamp(params.hpBoss ?? 100, 0, 100);
    const shield = clamp(params.shield ?? 0, 0, 9);
    const fever = clamp(params.fever ?? 0, 0, 100);
    const feverOn = !!params.feverOn;
    const combo = clamp(params.combo ?? 0, 0, 9999);

    // if not research, still okay to use deterministic RNG; gameplay will still feel random.
    const r01 = this._rng ? this._rng.next01() : Math.random();

    // ---- base weights ----
    const W = {
      normal: 62,
      decoy: 16,
      bomb:  12,
      heal:  6,
      shield: 4,
      bossface: 0,
    };

    // ---- escalation by phase ----
    W.decoy += (phase - 1) * 4;
    W.bomb  += (phase - 1) * 3;

    // ---- difficulty tuning ----
    if (diff === 'easy') {
      W.normal += 12;
      W.decoy -= 4;
      W.bomb  -= 5;
      W.heal  += 4;
      W.shield+= 2;
    } else if (diff === 'hard') {
      W.normal -= 6;
      W.decoy += 5;
      W.bomb  += 5;
      W.heal  -= 1;
      W.shield-= 1;
    }

    // ---- bossface trigger ----
    // show bossface as a “hype moment” when boss low but not dead
    if (hpBoss <= 28 && hpBoss > 0) W.bossface = 7;

    // ---- recovery logic (fairness) ----
    // if HP low or miss streak high -> reduce traps and allow recovery
    const struggling = (hpYou <= 35) || (this._missStreak >= 2);
    if (struggling) {
      W.bomb  *= 0.45;
      W.decoy *= 0.65;
      W.heal  *= 1.65;
      W.shield*= 1.25;
      W.normal*= 1.10;
    }

    // shield already high -> reduce shield spawns
    if (shield >= 3) W.shield *= 0.55;
    if (shield >= 6) W.shield *= 0.35;

    // fever on -> slightly reduce heal/shield and increase challenge
    if (feverOn) {
      W.bomb  *= 1.15;
      W.decoy *= 1.10;
      W.heal  *= 0.70;
      W.shield*= 0.75;
    }

    // fever near ready -> allow a bit more normal to help fill
    if (!feverOn && fever >= 78) {
      W.normal *= 1.10;
      W.bomb  *= 0.90;
    }

    // combo high -> add spice (but not spam)
    if (combo >= 10) {
      W.decoy *= 1.10;
      W.bomb  *= 1.08;
    }
    if (combo >= 20) {
      W.decoy *= 1.14;
      W.bomb  *= 1.10;
    }

    // ---- cooldowns for supports ----
    if (this._healCooldown > 0) { W.heal *= 0.25; this._healCooldown--; }
    if (this._shieldCooldown > 0) { W.shield *= 0.30; this._shieldCooldown--; }

    // ---- anti-spam rules ----
    // prevent bomb spam
    if (this._bombStreak >= 1) W.bomb *= 0.55;
    if (this._bombStreak >= 2) W.bomb *= 0.25;

    // prevent decoy spam
    if (this._decoyStreak >= 2) W.decoy *= 0.55;

    // short recovery window (after pain) -> bias normal/heal
    if (this._recoveryWindow > 0) {
      W.normal *= 1.18;
      W.heal   *= 1.25;
      W.bomb   *= 0.55;
      W.decoy  *= 0.72;
      this._recoveryWindow--;
    }

    // burst window (playing well) -> allow spicy moments but still fair
    if (this._burstWindow >= 4 && !struggling) {
      W.bomb  *= 1.12;
      W.decoy *= 1.10;
      W.normal*= 0.94;
    }

    // ---- last-types smoothing ----
    const last1 = this._lastTypes[this._lastTypes.length - 1] || '';
    const last2 = this._lastTypes[this._lastTypes.length - 2] || '';

    // if last two were traps, force a normal/support
    const lastTwoTraps = (t) => (t === 'bomb' || t === 'decoy');
    if (lastTwoTraps(last1) && lastTwoTraps(last2)) {
      W.bomb = 0;
      W.decoy = 0;
      W.normal *= 1.25;
      W.heal *= 1.10;
      W.shield *= 1.05;
    }

    // ---- pick ----
    let type = pickWeighted(r01, W);

    // post-pick enforcement: cooldown supports after use
    if (type === 'heal') this._healCooldown = 4;
    if (type === 'shield') this._shieldCooldown = 3;

    // update recent memory
    this._lastTypes.push(type);
    if (this._lastTypes.length > 6) this._lastTypes.shift();

    return type;
  }
}