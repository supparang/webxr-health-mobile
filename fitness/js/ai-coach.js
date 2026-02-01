'use strict';

/**
 * ai-coach.js
 * - “Explainable micro-tips” แบบ rate-limit
 * - ใช้กับ Play mode เพื่อความสนุก/แนะแนว
 */

export class AICoach {
  constructor(){
    this.lastAt = 0;
    this.cooldownMs = 1400;
  }

  canSpeak(now){
    return (now - this.lastAt) >= this.cooldownMs;
  }

  pickTip(pred, extraTips){
    // pred: {risk, focus, hint}
    const tips = [];
    if(pred && pred.hint) tips.push(pred.hint);
    if(Array.isArray(extraTips)) tips.push(...extraTips);

    if(!tips.length) return '';
    // simple rotate
    const i = Math.floor(Math.random() * tips.length);
    return tips[i];
  }

  speak(now, pred, extraTips){
    if(!this.canSpeak(now)) return '';
    this.lastAt = now;
    return this.pickTip(pred, extraTips);
  }
}