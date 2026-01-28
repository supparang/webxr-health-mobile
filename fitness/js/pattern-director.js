// === /fitness/js/pattern-director.js ===
// AI Pattern Director: creates combo bursts & storm waves fairly
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export class PatternDirector {
  constructor(){
    this.active = null; // { left, interval, nextAt, preferZone }
    this.cooldownUntil = 0;
    this.stormUntil = 0;
  }

  inStorm(now=performance.now()){
    return now < this.stormUntil;
  }

  // call when boss phase changes or fever toggles
  maybeTriggerStorm({ bossHp, bossPhase, feverOn }){
    const now = performance.now();
    if (this.inStorm(now)) return false;

    // gentle: storm mostly in late phase or fever
    const chance =
      (bossPhase===3 ? 0.10 : bossPhase===2 ? 0.05 : 0.02) +
      (feverOn ? 0.06 : 0);

    if (Math.random() < chance){
      this.stormUntil = now + (bossPhase===3 ? 4200 : 3200);
      this.cooldownUntil = now + 2500;
      return true;
    }
    return false;
  }

  // Start a short combo burst (3..5 targets) biased to weak zone
  maybeStartCombo({ skill, preferZone }){
    const now = performance.now();
    if (this.active) return false;
    if (now < this.cooldownUntil) return false;

    // higher skill => more combo
    const p = 0.10 + 0.22 * skill; // 0.10..0.32
    if (Math.random() > p) return false;

    const len = Math.round(3 + Math.random()*2 + skill*1.5); // 3..6
    const base = 520 - 170*skill; // faster for skilled
    const interval = clamp(base, 260, 560);

    this.active = {
      left: clamp(len,3,6),
      interval,
      nextAt: now + 120,
      preferZone: (preferZone!=null) ? preferZone : null
    };
    this.cooldownUntil = now + 1400;
    return true;
  }

  // Provide next spawn timing override (if combo or storm)
  nextSpawnOverride(){
    const now = performance.now();
    const storm = this.inStorm(now);

    if (this.active && now >= this.active.nextAt){
      this.active.left--;
      const delay = this.active.interval * (0.92 + Math.random()*0.16);
      this.active.nextAt = now + delay;

      const preferZone = this.active.preferZone;
      if (this.active.left <= 0){
        this.active = null;
        this.cooldownUntil = now + 1100;
      }
      return { delay: 0, preferZone, mode: 'combo' }; // spawn immediately
    }

    if (storm){
      // storm wave: shorter delay range
      const delay = 260 + Math.random()*220;
      return { delay, preferZone: null, mode: 'storm' };
    }

    return null;
  }
}