// === /fitness/js/pattern-gen.js ===
// Pattern Generator (seeded, fair, fun)
// ✅ returns pattern steps (spawn bursts / sweeps / baits / storms)

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export class PatternGen {
  constructor(rng){
    this.rng = rng || Math.random;
  }

  pick(arr){
    return arr[(this.rng()*arr.length)|0];
  }

  // phase: 1..3  => intensity increases
  patternFor(phase, diffKey){
    phase = clamp(phase,1,3)|0;
    const diff = (diffKey||'normal');

    const base = (phase===1) ? 1 : (phase===2) ? 2 : 3;
    const diffBoost = (diff==='hard') ? 1 : (diff==='easy') ? -1 : 0;
    const intensity = clamp(base + diffBoost, 1, 4);

    const patterns = [
      'sweep',   // กวาดซ้าย->ขวา
      'burst',   // ชุด 3-5 ลูกติด
      'bait',    // หลอกด้วย decoy/bomb ก่อนให้เลือก
      'storm'    // ช่วงพายุ spawn ถี่ขึ้น (สั้น ๆ)
    ];

    // phase สูงขึ้น = storm/burst โอกาสมากขึ้น
    const bag = [];
    for (const p of patterns) {
      if (p==='sweep') bag.push(p,p);
      if (p==='burst') bag.push(p, ...(intensity>=3 ? [p] : []));
      if (p==='bait')  bag.push(p);
      if (p==='storm') bag.push(p, ...(intensity>=3 ? [p] : []), ...(intensity>=4 ? [p] : []));
    }

    return this.pick(bag);
  }

  // build steps: each step = { kind, count, intervalMs, biasZone, stormMs }
  build(pattern, phase, diffKey){
    phase = clamp(phase,1,3)|0;
    const diff = (diffKey||'normal');

    const fast = diff==='hard' ? 0.85 : diff==='easy' ? 1.08 : 1.0;
    const baseInterval = (phase===1) ? 520 : (phase===2) ? 440 : 360;

    if (pattern === 'sweep') {
      // 6 zones sweep
      const dir = (this.rng() < 0.5) ? 1 : -1;
      const start = dir===1 ? 0 : 5;
      const steps = [];
      for (let i=0;i<6;i++){
        steps.push({
          kind: 'normal',
          count: 1,
          intervalMs: Math.round(baseInterval*fast),
          biasZone: start + dir*i
        });
      }
      return steps;
    }

    if (pattern === 'burst') {
      const n = (phase===3) ? 5 : (phase===2) ? 4 : 3;
      const z = (this.rng()*6)|0;
      return [{
        kind: 'normal',
        count: n,
        intervalMs: Math.round((baseInterval*0.72)*fast),
        biasZone: z
      }];
    }

    if (pattern === 'bait') {
      const z = (this.rng()*6)|0;
      // หลอก 1-2 ลูก แล้วให้ normal ตาม
      const dec = (this.rng()<0.5) ? 'decoy' : 'bomb';
      const nDec = (phase===3) ? 2 : 1;
      return [
        { kind: dec, count: nDec, intervalMs: Math.round((baseInterval*0.82)*fast), biasZone: z },
        { kind: 'normal', count: 2, intervalMs: Math.round((baseInterval*0.70)*fast), biasZone: z }
      ];
    }

    if (pattern === 'storm') {
      // เปิด storm สั้น ๆ ให้รู้สึก “โหดขึ้น”
      const stormMs = (phase===3) ? 5200 : (phase===2) ? 4200 : 3200;
      return [{ kind: 'storm', count: 1, intervalMs: 0, stormMs }];
    }

    return [{ kind: 'normal', count: 2, intervalMs: Math.round(baseInterval*fast), biasZone: -1 }];
  }
}