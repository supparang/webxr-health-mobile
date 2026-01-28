// === /fitness/js/ai-director.js ===
// Shadow Breaker — AI Difficulty Director (fair, explainable, lightweight)
// ✅ Adjust spawn tempo + target mix by performance (only in PLAY mode)
// ✅ NEVER changes research mode (avoid bias)

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export class AIDirector {
  constructor(opts = {}) {
    this.enabled = !!(opts.enabled ?? true);

    // moving indicators
    this.missStreak = 0;
    this.hitStreak = 0;

    // difficulty factor (0.85..1.20)
    this.tempo = 1.0;      // affects spawn interval
    this.heat  = 1.0;      // affects bomb/decoy weights a bit

    // smoothing
    this.alpha = opts.alpha ?? 0.12;
  }

  onHit(grade){
    this.hitStreak++;
    this.missStreak = 0;

    // reward strong play
    const bump = (grade === 'perfect') ? 0.018 : 0.010;
    this.tempo = clamp((1-this.alpha)*this.tempo + this.alpha*(this.tempo + bump), 0.85, 1.20);
    this.heat  = clamp((1-this.alpha)*this.heat  + this.alpha*(this.heat  + bump*0.7), 0.85, 1.18);
  }

  onMiss(){
    this.missStreak++;
    this.hitStreak = 0;

    // soften when struggling (fair)
    const drop = (this.missStreak >= 2) ? 0.030 : 0.018;
    this.tempo = clamp((1-this.alpha)*this.tempo + this.alpha*(this.tempo - drop), 0.85, 1.20);
    this.heat  = clamp((1-this.alpha)*this.heat  + this.alpha*(this.heat  - drop*0.6), 0.85, 1.18);
  }

  onHpLow(){
    // if HP low, soften more
    this.tempo = clamp((1-this.alpha)*this.tempo + this.alpha*(this.tempo - 0.030), 0.85, 1.20);
    this.heat  = clamp((1-this.alpha)*this.heat  + this.alpha*(this.heat  - 0.022), 0.85, 1.18);
  }

  // returns multipliers applied to config
  multipliers(ctx){
    // ctx: { phase, storm, feverOn, combo }
    const phase = clamp(ctx.phase,1,3)|0;
    const storm = ctx.storm ? 1 : 0;

    // small phase push: later phase slightly faster
    const phaseBoost = (phase === 3) ? 0.06 : (phase === 2 ? 0.03 : 0);

    // storm already fast; director won't overdo
    const stormCap = storm ? 0.04 : 0.10;

    const tempo = clamp(this.tempo + phaseBoost, 0.85, 1.10 + stormCap);
    const heat  = clamp(this.heat, 0.85, 1.18);

    return { tempo, heat };
  }
}