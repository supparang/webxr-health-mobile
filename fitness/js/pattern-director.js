// === /fitness/js/pattern-director.js ===
// Boss Pattern Director (fun + readable)
// - Returns zone plans for next spawn (0..5)
// - Each boss has signature pattern; phases tighten
// - Still fair: never forces impossible, avoids repeating same zone too long

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export class PatternDirector{
  constructor(){
    this.reset();
  }

  reset(){
    this.seq = [];
    this.i = 0;
    this.lastZone = null;
  }

  // create sequence for boss+phase
  build(bossIndex, bossPhase){
    this.seq = [];

    // 6 zones: 0..5 (top-left..bottom-right)
    // helper sequences:
    const sweepLR = [0,1,2,3,4,5];
    const sweepRL = [5,4,3,2,1,0];
    const zigzag  = [0,2,4,5,3,1];
    const spiral  = [0,1,2,4,5,3];

    const phaseTight = bossPhase === 3;

    if (bossIndex === 0){ // Bubble Glove: friendly sweeps
      this.seq = phaseTight ? [...zigzag, ...sweepLR] : [...sweepLR, ...sweepRL];
    } else if (bossIndex === 1){ // Spark Guard: bursts + feints
      this.seq = phaseTight ? [2,3,2,4,1,5,0,4,2,3] : [2,3,4,1,5,0,3,2];
    } else if (bossIndex === 2){ // Shadow Mitt: trick zones (repeat then shift)
      this.seq = phaseTight ? [1,1,4,4,2,5,0,3,3,0] : [1,1,4,4,2,5,0,3];
    } else { // Galaxy Punch: fast spiral
      this.seq = phaseTight ? [...spiral, ...spiral, 2,3,2,3] : [...spiral, ...sweepLR];
    }

    this.i = 0;
    return this.seq;
  }

  next(bossIndex, bossPhase){
    if (!this.seq.length) this.build(bossIndex, bossPhase);

    const z = this.seq[this.i % this.seq.length];
    this.i++;

    // avoid exact repeat too much
    if (this.lastZone === z) {
      const alt = clamp((z + 1 + (this.i % 2)) % 6, 0, 5);
      this.lastZone = alt;
      return alt;
    }
    this.lastZone = z;
    return z;
  }
}