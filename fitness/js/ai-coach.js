// === /fitness/js/ai-coach.js ===
// AI Coach (explainable micro-tips; rate-limited)
// ✅ Export: AICoach
// - call maybeTip(pred, ctx) to get tip text (or '')

'use strict';

function nowMs(){ return performance.now ? performance.now() : Date.now(); }

export class AICoach {
  constructor(opts = {}){
    this.cfg = Object.assign({
      cooldownMs: 2600,
      minChangeToSpeak: 0.12
    }, opts||{});

    this.lastTipAt = 0;
    this.lastSkill = 0;
    this.lastFatigue = 0;
  }

  reset(){
    this.lastTipAt = 0;
    this.lastSkill = 0;
    this.lastFatigue = 0;
  }

  maybeTip(pred, ctx = {}){
    if (!pred || !pred.tip) return '';
    const t = nowMs();
    if (t - this.lastTipAt < this.cfg.cooldownMs) return '';

    const skill = Number(pred.skillScore)||0;
    const fat = Number(pred.fatigueRisk)||0;

    const dSkill = Math.abs(skill - this.lastSkill);
    const dFat = Math.abs(fat - this.lastFatigue);

    if (Math.max(dSkill, dFat) < this.cfg.minChangeToSpeak) return '';

    this.lastTipAt = t;
    this.lastSkill = skill;
    this.lastFatigue = fat;

    // Optional context: if user paused/stopped, don't speak
    if (ctx && ctx.isStopped) return '';

    return String(pred.tip || '');
  }
}