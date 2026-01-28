// === /fitness/js/skillnet.js ===
// SkillNet: lightweight online predictor (no external deps)
// - Tracks rolling performance: miss rate, avg RT, bomb/decoy, combo
// - Produces skill score [0..1] and "confidence"
// - Explainable signals for debugging/research

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
const lerp = (a,b,t)=>a+(b-a)*t;

export class SkillNet{
  constructor(opts={}){
    this.reset();
    this.alpha = opts.alpha ?? 0.12;     // EMA speed
    this.minEvents = opts.minEvents ?? 12;
  }

  reset(){
    this.n = 0;

    // EMAs
    this.emaMiss = 0;       // 0..1
    this.emaRt = 420;       // ms
    this.emaBomb = 0;       // 0..1
    this.emaDecoy = 0;      // 0..1
    this.emaCombo = 0;      // combo

    this.skill = 0.5;
    this.conf = 0;

    this.last = {
      missRate: 0, avgRt: 420, bombRate: 0, decoyRate: 0, combo: 0
    };
  }

  // evt = { type:'hit'|'timeout', targetType, rtMs, comboAfter }
  onEvent(evt){
    if (!evt) return;

    // trial = hit or timeout (timeout = miss)
    const isTrial = evt.type === 'hit' || evt.type === 'timeout';
    if (!isTrial) return;

    this.n++;

    const miss = (evt.type === 'timeout') ? 1 : 0;
    const rt = (evt.type === 'hit' && evt.rtMs != null) ? clamp(evt.rtMs, 80, 2000) : null;

    const isBomb = (evt.type === 'hit' && evt.targetType === 'bomb') ? 1 : 0;
    const isDecoy = (evt.type === 'hit' && evt.targetType === 'decoy') ? 1 : 0;

    const combo = (evt.comboAfter != null) ? clamp(evt.comboAfter, 0, 999) : 0;

    const a = this.alpha;

    this.emaMiss  = lerp(this.emaMiss, miss, a);
    if (rt != null) this.emaRt = lerp(this.emaRt, rt, a);

    this.emaBomb  = lerp(this.emaBomb, isBomb, a);
    this.emaDecoy = lerp(this.emaDecoy, isDecoy, a);

    this.emaCombo = lerp(this.emaCombo, combo, a);

    this.last = {
      missRate: this.emaMiss,
      avgRt: this.emaRt,
      bombRate: this.emaBomb,
      decoyRate: this.emaDecoy,
      combo: this.emaCombo
    };

    // Compute skill (explainable weighted)
    // - good: low miss, low RT, low bomb/decoy, higher combo
    const missScore = 1 - clamp(this.emaMiss / 0.40, 0, 1);               // 0..1
    const rtScore   = 1 - clamp((this.emaRt - 220) / (650 - 220), 0, 1);  // 0..1
    const bombScore = 1 - clamp(this.emaBomb / 0.18, 0, 1);
    const decScore  = 1 - clamp(this.emaDecoy / 0.18, 0, 1);
    const comboScore= clamp(this.emaCombo / 14, 0, 1);

    // weighted blend
    const s =
      0.36 * missScore +
      0.30 * rtScore +
      0.14 * comboScore +
      0.10 * bombScore +
      0.10 * decScore;

    this.skill = clamp(s, 0, 1);

    // confidence grows with events
    this.conf = clamp((this.n - this.minEvents) / 26, 0, 1);
  }

  get(){
    return { skill: this.skill, conf: this.conf, signals: { ...this.last }, n: this.n };
  }
}