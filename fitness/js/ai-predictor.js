// === /fitness/js/ai-predictor.js ===
// On-device AI Predictor (Explainable) — "ML feel" without servers
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export class AIPredictor {
  constructor(){
    // 6 zones: 0..5 (3x2)
    this.zones = Array.from({length:6}, ()=>({
      hit:0, miss:0,
      rtSum:0, rtN:0,
      lastSeen:0
    }));

    this.global = {
      hits:0, miss:0,
      rtSum:0, rtN:0
    };

    // lightweight weights for "risk score"
    this.w = {
      base: 0.15,
      missRate: 0.60,
      rtSlow: 0.35,
      storm: 0.10
    };

    this.lastAdviceAt = 0;
    this.adviceCooldownMs = 1800;
  }

  // update from events
  update(ev){
    if (!ev) return;

    const z = (ev.zoneId!=null) ? Number(ev.zoneId) : null;
    const rt = (ev.rtMs!=null) ? Number(ev.rtMs) : null;

    if (ev.type === 'hit'){
      this.global.hits++;
      if (rt!=null){
        this.global.rtSum += rt;
        this.global.rtN++;
      }
      if (z!=null && this.zones[z]){
        const a = this.zones[z];
        a.hit++;
        a.lastSeen = performance.now();
        if (rt!=null){ a.rtSum += rt; a.rtN++; }
      }
    }

    if (ev.type === 'timeout' && ev.miss){
      this.global.miss++;
      if (z!=null && this.zones[z]){
        const a = this.zones[z];
        a.miss++;
        a.lastSeen = performance.now();
      }
    }
  }

  // risk score per zone (0..1)
  riskOfZone(z, inStorm){
    const a = this.zones[z];
    if (!a) return 0.2;

    const trials = a.hit + a.miss;
    const missRate = trials>0 ? a.miss / trials : 0.25;

    const avgRt = a.rtN>0 ? a.rtSum / a.rtN : 520;
    // normalize: 220..750 => 0..1
    const rtSlow = clamp((avgRt - 220) / (750 - 220), 0, 1);

    let score = this.w.base
      + this.w.missRate * missRate
      + this.w.rtSlow * rtSlow
      + (inStorm ? this.w.storm : 0);

    return clamp(score, 0, 1);
  }

  // choose top risk zone (argmax)
  topRiskZone(inStorm){
    let bestZ = 0, best = -1;
    for (let z=0; z<6; z++){
      const s = this.riskOfZone(z, inStorm);
      if (s > best){ best = s; bestZ = z; }
    }
    return { zoneId: bestZ, risk: best };
  }

  // Fair adaptive: return preferred zone + weight bias (capped)
  spawnPlan(inStorm){
    const top = this.topRiskZone(inStorm);
    // bias 1.0..1.7
    const bias = 1.0 + 0.7 * top.risk;

    // 70% chance to spawn at weak zone, else random for fairness
    const prefer = (Math.random() < 0.70) ? top.zoneId : null;

    return { preferZone: prefer, bias, top };
  }

  // short explainable tip (rate-limited)
  getAdvice(inStorm){
    const now = performance.now();
    if (now - this.lastAdviceAt < this.adviceCooldownMs) return null;

    const { zoneId, risk } = this.topRiskZone(inStorm);
    const a = this.zones[zoneId];
    const trials = a.hit + a.miss;
    const missRate = trials>0 ? (a.miss/trials) : 0.25;
    const avgRt = a.rtN>0 ? (a.rtSum/a.rtN) : 520;

    let msg = `AI: โซน ${zoneId+1} เสี่ยงสุด`;
    if (missRate > 0.35) msg += ` (พลาดบ่อย ${(missRate*100).toFixed(0)}%)`;
    else if (avgRt > 520) msg += ` (RT ช้า ${(avgRt).toFixed(0)}ms)`;
    else msg += ` (ต้องโฟกัสเพิ่ม)`;

    if (inStorm) msg += ` • ตอนนี้ STORM → เล็งก่อนแตะ`;

    this.lastAdviceAt = now;
    return { zoneId, risk, msg };
  }
}