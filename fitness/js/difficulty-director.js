// === /fitness/js/difficulty-director.js ===
// AI Difficulty Director (fair adaptive)
// - Uses SkillNet prediction + confidence
// - Outputs adjustments for spawn interval / ttl / size / hazard weights
// - Deterministic OFF by default; enable only in play mode

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
const lerp = (a,b,t)=>a+(b-a)*t;

export class DifficultyDirector{
  constructor(opts={}){
    this.enabled = true;
    this.smooth = 0.18;

    // dynamic outputs (multipliers)
    this.spawnMul = 1.00;   // <1 faster spawn
    this.ttlMul   = 1.00;   // <1 shorter lifetime
    this.sizeMul  = 1.00;   // <1 smaller targets
    this.bombMul  = 1.00;   // >1 more bombs
    this.decoyMul = 1.00;

    this.lastExplain = '';
  }

  setEnabled(v){ this.enabled = !!v; }

  update(skillNet, baseDiffKey){
    if (!this.enabled) {
      this.spawnMul = 1; this.ttlMul = 1; this.sizeMul = 1;
      this.bombMul = 1; this.decoyMul = 1;
      this.lastExplain = 'Adaptive OFF';
      return this.get();
    }

    const { skill, conf, signals } = skillNet.get();

    // If confidence low -> keep near base
    const t = clamp(conf, 0, 1);

    // Map skill -> intensity (0 easy .. 1 hard)
    // Higher skill => tighter timing + more hazards (but not unfair)
    const intensity = clamp(skill, 0, 1);

    // Per base diff, set a "target intensity band"
    const baseBias =
      baseDiffKey === 'easy' ? 0.20 :
      baseDiffKey === 'hard' ? 0.70 : 0.45;

    const target = clamp(lerp(baseBias, intensity, 0.65), 0.05, 0.95);

    // Convert target -> multipliers
    const desiredSpawn = lerp(1.18, 0.82, target); // low skill slower, high skill faster
    const desiredTtl   = lerp(1.10, 0.86, target);
    const desiredSize  = lerp(1.08, 0.88, target);

    // Hazards: only increase if bomb/decoy rate is low (avoid punishing struggling)
    const safeToIncreaseHazard = (signals.bombRate < 0.10 && signals.decoyRate < 0.10 && signals.missRate < 0.30);

    const desiredBomb  = safeToIncreaseHazard ? lerp(0.85, 1.25, target) : lerp(0.85, 1.05, target);
    const desiredDecoy = safeToIncreaseHazard ? lerp(0.85, 1.20, target) : lerp(0.85, 1.05, target);

    // Smooth
    const s = this.smooth * t;
    this.spawnMul = lerp(this.spawnMul, desiredSpawn, s);
    this.ttlMul   = lerp(this.ttlMul, desiredTtl, s);
    this.sizeMul  = lerp(this.sizeMul, desiredSize, s);
    this.bombMul  = lerp(this.bombMul, desiredBomb, s);
    this.decoyMul = lerp(this.decoyMul, desiredDecoy, s);

    this.lastExplain =
      `AI Director: skill=${skill.toFixed(2)} conf=${conf.toFixed(2)} ` +
      `miss=${Math.round(signals.missRate*100)}% rt≈${Math.round(signals.avgRt)}ms ` +
      `→ spawn×${this.spawnMul.toFixed(2)} ttl×${this.ttlMul.toFixed(2)} size×${this.sizeMul.toFixed(2)}`;

    return this.get();
  }

  get(){
    return {
      spawnMul: this.spawnMul,
      ttlMul: this.ttlMul,
      sizeMul: this.sizeMul,
      bombMul: this.bombMul,
      decoyMul: this.decoyMul,
      explain: this.lastExplain
    };
  }
}