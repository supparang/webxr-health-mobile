// === /fitness/js/pattern-director.js ===
// Seeded Pattern Generator for Shadow Breaker (A-16)
// - Deterministic if seed fixed (research), still fun for play.
// - Produces "spawn plan": { kind, zoneId, sizeMul, forceBossFace? }

'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s){
  s = String(s || '');
  let h = 2166136261;
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickWeighted(rng, list){
  let total = 0;
  for (const it of list) total += it.w;
  let r = rng() * total;
  for (const it of list){
    if (r < it.w) return it.v;
    r -= it.w;
  }
  return list[list.length-1].v;
}

function zoneSeqSweep(){
  // 2x3 : top row Z1 Z2 Z3 then bottom Z4 Z5 Z6 (0..5)
  return [0,1,2,5,4,3]; // nicer "snake"
}
function zoneSeqMirror(){
  return [0,2,1,4,3,5];
}
function zoneSeqCorners(){
  return [0,2,3,5,1,4];
}

export class PatternDirector{
  constructor(seed){
    this.setSeed(seed);
    this.queue = [];
    this.lastZone = -1;
    this.lastKind = 'normal';
    this.patternName = 'free';
    this.patternUntilMs = 0;
  }

  setSeed(seed){
    const s = (seed == null) ? Date.now() : Number(seed);
    const fixed = Number.isFinite(s) ? (s >>> 0) : hashStr(seed);
    this.seed = fixed;
    this.rng = mulberry32(fixed);
  }

  reset(){
    this.queue.length = 0;
    this.lastZone = -1;
    this.lastKind = 'normal';
    this.patternName = 'free';
    this.patternUntilMs = 0;
  }

  // snapshot expected:
  // { nowMs, bossPhase, bossIndex, diffKey, missStreak, avgRtEwma, playerHp, feverOn,
  //   zoneWeakId, zoneWeakScore, chaosLevel }
  nextPlan(ss){
    const now = ss.nowMs || 0;

    // If we have queued scripted spawns, use them
    if (this.queue.length){
      const p = this.queue.shift();
      this.lastZone = p.zoneId;
      this.lastKind = p.kind;
      return p;
    }

    // choose a "mode" sometimes (short bursts)
    const wantPattern = (now > this.patternUntilMs);
    if (wantPattern && this.rng() < (0.18 + 0.06*(ss.bossPhase-1) + 0.10*(ss.chaosLevel||0))){
      const pat = this._choosePattern(ss);
      this._buildPatternQueue(pat, ss);
    }

    // fallback single
    return this._single(ss);
  }

  _choosePattern(ss){
    // adapt: if user struggles -> patterns easier but still exciting (telegraphed)
    const lowHp = ss.playerHp != null && ss.playerHp < 0.34;
    const highMiss = (ss.missStreak||0) >= 2;
    const slow = (ss.avgRtEwma||0) > 520;

    const phase = ss.bossPhase || 1;
    const chaos = clamp((ss.chaosLevel||0), 0, 1);

    const weights = [
      { v:'sweep',  w: lowHp ? 1.8 : 1.2 + 0.4*phase },
      { v:'burst',  w: (highMiss||slow) ? 0.8 : 1.2 + 0.5*chaos },
      { v:'bait',   w: (highMiss||lowHp) ? 0.7 : 1.1 + 0.5*phase },
      { v:'mirror', w: 1.0 + 0.35*phase },
      { v:'corners',w: (phase>=2) ? 1.15 : 0.75 }
    ];
    const pat = pickWeighted(this.rng, weights);
    this.patternName = pat;
    // pattern lasts ~ 2.5–4.0 sec
    this.patternUntilMs = (ss.nowMs||0) + 2500 + this.rng()*1500;
    return pat;
  }

  _kindWeights(ss){
    const phase = ss.bossPhase || 1;
    const chaos = clamp((ss.chaosLevel||0), 0, 1);
    const lowHp = ss.playerHp != null && ss.playerHp < 0.34;

    // base weights
    let wNormal = 64;
    let wDecoy  = 10 + 2*(phase-1);
    let wBomb   = 8  + 4*(phase-1) + 4*chaos;
    let wHeal   = 9  + (lowHp ? 10 : 0);
    let wShield = 9  + (phase>=2 ? 3 : 0);

    // keep fair
    wBomb = Math.min(wBomb, 18);
    wDecoy = Math.min(wDecoy, 16);

    return [
      { v:'normal', w:wNormal },
      { v:'decoy',  w:wDecoy  },
      { v:'bomb',   w:wBomb   },
      { v:'heal',   w:wHeal   },
      { v:'shield', w:wShield }
    ];
  }

  _single(ss){
    const kind = pickWeighted(this.rng, this._kindWeights(ss));

    // zone bias: sometimes target weak zone, but not nonstop
    let zoneId = (this.rng()*6)|0;
    if (ss.zoneWeakId != null && this.rng() < (0.28 + 0.10*(ss.bossPhase-1))){
      zoneId = clamp(ss.zoneWeakId, 0, 5);
      if (zoneId === this.lastZone && this.rng() < 0.60) zoneId = (zoneId + 1 + ((this.rng()*4)|0)) % 6;
    } else {
      if (zoneId === this.lastZone) zoneId = (zoneId + 1 + ((this.rng()*4)|0)) % 6;
    }

    const sizeMul =
      kind === 'normal' ? 1.0 :
      kind === 'bomb'   ? 0.92 :
      kind === 'decoy'  ? 0.94 :
      kind === 'heal'   ? 0.98 :
      0.98;

    const p = { kind, zoneId, sizeMul };
    this.lastZone = zoneId;
    this.lastKind = kind;
    return p;
  }

  _buildPatternQueue(pat, ss){
    const phase = ss.bossPhase || 1;
    const seq =
      pat === 'sweep'  ? zoneSeqSweep() :
      pat === 'mirror' ? zoneSeqMirror() :
      pat === 'corners'? zoneSeqCorners() :
      null;

    // length
    const n = pat === 'burst' ? (3 + ((this.rng()*2)|0)) : (4 + ((this.rng()*3)|0));

    // pick an anchor zone near weak zone sometimes
    const anchor = (ss.zoneWeakId != null && this.rng()<0.55) ? clamp(ss.zoneWeakId,0,5) : ((this.rng()*6)|0);

    const q = [];
    for (let i=0;i<n;i++){
      let zoneId;
      if (seq){
        zoneId = seq[(i + anchor) % seq.length];
      } else {
        // bait/burst: cluster around anchor +/- 1
        const r = this.rng();
        if (r < 0.55) zoneId = anchor;
        else if (r < 0.78) zoneId = (anchor + 1) % 6;
        else zoneId = (anchor + 5) % 6;
      }
      if (zoneId === this.lastZone && this.rng()<0.65) zoneId = (zoneId + 1) % 6;

      // pattern-specific kind bias
      let kind;
      if (pat === 'burst'){
        kind = (this.rng()<0.78) ? 'normal' : pickWeighted(this.rng, this._kindWeights(ss));
      } else if (pat === 'bait'){
        // lure: decoy/bomb appears but fair: 1 only per pattern
        const k = (i===n-1 && phase>=2) ? 'bomb' : (this.rng()<0.18 ? 'decoy' : 'normal');
        kind = k;
      } else {
        kind = pickWeighted(this.rng, this._kindWeights(ss));
      }

      const sizeMul =
        pat === 'burst' ? 0.92 :
        pat === 'sweep' ? 1.00 :
        pat === 'mirror'? 0.98 :
        pat === 'corners'?0.95 :
        1.0;

      q.push({ kind, zoneId, sizeMul });
      this.lastZone = zoneId;
      this.lastKind = kind;
    }

    this.queue = q;
  }
}