'use strict';

/**
 * ai-director.js
 * - “Fair adaptive pacing” แบบ deterministic-friendly
 * - ใช้เฉพาะ Play mode (research ควรปิด adaptive)
 *
 * NOTE: ไฟล์นี้ไม่ได้ export AIPredictor
 * export:
 *   - AIDirector
 *   - computeAssist
 */

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

export function computeAssist(features){
  // features: {acc, missRate, avgRt, combo, feverOn, hp, timeLeft}
  const acc = clamp((features.acc ?? 85) / 100, 0, 1);
  const miss = clamp(features.missRate ?? 0.12, 0, 1);
  const rt = clamp((features.avgRt ?? 520) / 1200, 0, 1); // normalized
  const combo = clamp((features.combo ?? 0) / 25, 0, 1);
  const hp = clamp(features.hp ?? 1, 0, 1);

  // higher when struggling
  const struggle = clamp((1-acc)*0.55 + miss*0.35 + rt*0.25 + (1-hp)*0.20 - combo*0.25, 0, 1);
  // pace factor: 0.75..1.25
  const pace = 1.0 - (struggle*0.25) + (combo*0.08);
  // size boost: 0..0.18
  const sizeBoost = struggle*0.18;
  // spawn relax: 0..0.22
  const relax = struggle*0.22;

  return {
    struggle,
    pace: clamp(pace, 0.75, 1.25),
    sizeBoost: clamp(sizeBoost, 0, 0.18),
    relax: clamp(relax, 0, 0.22)
  };
}

export class AIDirector {
  constructor(){
    this.reset();
  }

  reset(){
    this._accWindow = [];
    this._rtWindow = [];
    this._miss = 0;
    this._hits = 0;
    this._combo = 0;
    this._hp = 1;
    this._t = 0;
    this._feverOn = false;
  }

  updateFromEvent(e){
    // e: {type, grade, rtMs, comboAfter, playerHp, feverOn, tsMs}
    if(!e) return;
    if(e.tsMs != null) this._t = e.tsMs;
    if(e.playerHp != null) this._hp = e.playerHp;
    if(e.comboAfter != null) this._combo = e.comboAfter;
    if(e.feverOn != null) this._feverOn = e.feverOn;

    if(e.type === 'hit'){
      this._hits++;
      if(e.rtMs != null) this._rtWindow.push(e.rtMs);
      if(e.grade === 'bad') this._accWindow.push(0.6);
      else if(e.grade === 'good') this._accWindow.push(0.82);
      else if(e.grade === 'perfect') this._accWindow.push(0.97);
      else this._accWindow.push(0.8);
    } else if(e.type === 'timeout'){
      this._miss++;
      this._accWindow.push(0);
    }

    // cap windows
    while(this._accWindow.length > 40) this._accWindow.shift();
    while(this._rtWindow.length > 25) this._rtWindow.shift();
  }

  getFeatures(timeLeftMs){
    const acc = this._accWindow.length
      ? (this._accWindow.reduce((a,b)=>a+b,0)/this._accWindow.length)*100
      : 85;

    const avgRt = this._rtWindow.length
      ? (this._rtWindow.reduce((a,b)=>a+b,0)/this._rtWindow.length)
      : 520;

    const total = this._hits + this._miss;
    const missRate = total ? (this._miss/total) : 0.12;

    return {
      acc,
      missRate,
      avgRt,
      combo: this._combo,
      feverOn: !!this._feverOn,
      hp: this._hp,
      timeLeft: timeLeftMs ?? 0
    };
  }

  getAssist(timeLeftMs){
    const f = this.getFeatures(timeLeftMs);
    return computeAssist(f);
  }
}