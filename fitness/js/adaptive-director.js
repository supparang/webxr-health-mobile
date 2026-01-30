// === /fitness/js/adaptive-director.js ===
'use strict';

(function(){
  function clamp(v,a,b){ return v<a?a:v>b?b:v; }
  function hash32(str){
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class AdaptiveDirector {
    constructor(opts={}){
      this.mode = opts.mode || 'normal';
      this.seedStr = opts.seedStr || 'RB';
      this.enabled = opts.enabled !== false;
      this.intervalSec = opts.intervalSec || 2.0;

      // state
      this.nextAt = 0;
      this.lastLaneSeq = [];
      this.lastChangeAt = 0;

      // controls to output
      this.density = 1.0;     // 0.75..1.35
      this.biasLR = 0.0;      // -0.35..+0.35 (negative -> more left)
      this.remix = 0.0;       // 0..1 (anti-boredom)
    }

    // features from engine snapshot
    update(songTime, snap){
      if(!this.enabled) return null;
      if(songTime < this.nextAt) return null;
      this.nextAt = songTime + this.intervalSec;

      const acc = clamp(snap.accRecent || 0.7, 0, 1);
      const missRate = clamp(snap.missRecent || 0, 0, 1);
      const blankRate = clamp(snap.blankRecent || 0, 0, 1);
      const fatigue = clamp(snap.fatigueRisk || 0, 0, 1);

      const leftPct = clamp(snap.leftHitPct || 50, 0, 100);
      const rightPct = clamp(snap.rightHitPct || 50, 0, 100);
      const lrDiff = (rightPct - leftPct) / 100; // -1..+1

      // boredom: lane sequence repeating
      const rep = clamp(snap.repeatScore || 0, 0, 1);

      // ----- “ML-lite” policy (ไม่ใช่โมเดลเทรน) -----
      // goal: keep challenge in a “flow band”
      // If acc high & fatigue low -> increase density a bit
      // If miss/blank high or fatigue high -> decrease density
      let d = this.density;

      const flowUp = (acc > 0.88 && fatigue < 0.45 && missRate < 0.20);
      const flowDown = (acc < 0.70 || missRate > 0.35 || blankRate > 0.25 || fatigue > 0.75);

      if(flowUp) d += 0.08;
      if(flowDown) d -= 0.10;

      // nudge towards medium challenge
      d += (acc - 0.82) * 0.04;
      d -= fatigue * 0.05;

      d = clamp(d, 0.75, 1.35);

      // bias: push towards weaker side (reduce lrDiff magnitude)
      let b = this.biasLR;
      b += (-lrDiff) * 0.18;
      b = clamp(b, -0.35, 0.35);

      // remix: increase if boredom detected OR density stays same too long
      let r = this.remix;
      r += rep * 0.20;
      if (Math.abs(d - this.density) < 0.03) r += 0.05;
      r = clamp(r, 0, 1);

      // Research mode: deterministic & conservative
      if(this.mode === 'research'){
        d = clamp(1.0 + (acc - 0.8)*0.08 - fatigue*0.06, 0.90, 1.15);
        b = clamp((-lrDiff) * 0.12, -0.25, 0.25);
        r = clamp(rep * 0.35, 0, 0.55);
      }

      this.density = d;
      this.biasLR = b;
      this.remix = r;

      return { density:d, biasLR:b, remix:r };
    }

    rngForWindow(sessionId, songTime){
      // deterministic per-window
      const key = `${this.seedStr}|${sessionId||'S'}|${Math.floor(songTime/this.intervalSec)}`;
      return mulberry32(hash32(key));
    }
  }

  window.RB_AdaptiveDirector = AdaptiveDirector;
})();