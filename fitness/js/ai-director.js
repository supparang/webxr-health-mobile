// === /fitness/js/ai-director.js ===
// AI Difficulty Director (fair adaptive pacing; deterministic-friendly)
// ✅ Export: AIDirector
// - In research mode you should disable adaptation (lock)
// - In normal/play, adaptation is allowed when ai enabled

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }

export class AIDirector {
  constructor(opts = {}){
    this.cfg = Object.assign({
      // smoothing
      emaA: 0.12,

      // baseline spawn pacing (sec)
      paceEasy: 1.10,
      paceNormal: 0.92,
      paceHard: 0.78,

      // adaptation range
      minPaceMul: 0.80,
      maxPaceMul: 1.25,

      // drivers
      fatigueWeight: 0.55,
      skillWeight: 0.45
    }, opts||{});

    this.reset();
  }

  reset(){
    this.skillEma = 0.55;
    this.fatigueEma = 0.20;
    this.paceMul = 1.0;
    this.lastSuggested = 'normal';
  }

  update(pred){
    if (!pred) return;
    const a = this.cfg.emaA;

    const skill = clamp(pred.skillScore, 0, 1);
    const fat = clamp(pred.fatigueRisk, 0, 1);

    this.skillEma = (1-a)*this.skillEma + a*skill;
    this.fatigueEma = (1-a)*this.fatigueEma + a*fat;

    // paceMul: higher fatigue -> slower (bigger pace), higher skill -> faster
    const drive = (this.cfg.skillWeight*(this.skillEma - 0.55)) - (this.cfg.fatigueWeight*(this.fatigueEma - 0.25));
    const mul = 1.0 - drive * 0.35;

    this.paceMul = clamp(mul, this.cfg.minPaceMul, this.cfg.maxPaceMul);
    this.lastSuggested = pred.suggestedDifficulty || this.lastSuggested;
  }

  basePaceForDiff(diff){
    const d = (diff||'normal').toLowerCase();
    if (d === 'easy') return this.cfg.paceEasy;
    if (d === 'hard') return this.cfg.paceHard;
    return this.cfg.paceNormal;
  }

  // final pace seconds for next spawn
  getNextPaceSec(diff){
    const base = this.basePaceForDiff(diff);
    return clamp(base * this.paceMul, 0.35, 2.2);
  }

  getSuggestedDifficulty(){
    return this.lastSuggested || 'normal';
  }
}