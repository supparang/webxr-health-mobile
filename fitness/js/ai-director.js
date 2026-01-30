// === /fitness/js/ai-director.js — AI Difficulty Director (deterministic, fair) ===
'use strict';

(function(){
  // Director ทำ 3 อย่าง:
  // 1) ประเมิน skill/fatigue จากสถิติช่วงล่าสุด (prediction)
  // 2) แนะนำ difficulty + intensity ของ mods (double/ghost/hold/swap)
  // 3) ส่ง “Coach tip” แบบ rate-limit เพื่อไม่รก

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:v>b?b:v; }
  function sigmoid(x){ return 1/(1+Math.exp(-x)); }

  // EWMA memory (เก็บล่าสุดแบบเบา ๆ)
  function ewma(prev, x, alpha){
    if (prev == null || !Number.isFinite(prev)) return x;
    return prev*(1-alpha) + x*alpha;
  }

  class RbAIDirector{
    constructor(opts={}){
      this.enabled = !!opts.enabled;
      this.cooldownMs = opts.cooldownMs || 2500; // tip cooldown
      this._lastTipAt = 0;

      // memory states
      this.skill = 0.5;       // 0..1
      this.fatigue = 0.0;     // 0..1
      this.stability = 0.6;   // 0..1 (ความนิ่งของ timing)

      // แนะนำ difficulty ล่าสุด
      this.suggestedDifficulty = 'normal';
      this.modIntensity = { double:0, ghost:0, hold:0, swap:0 }; // 0..1
    }

    reset(){
      this.skill = 0.5;
      this.fatigue = 0.0;
      this.stability = 0.6;
      this.suggestedDifficulty = 'normal';
      this.modIntensity = { double:0, ghost:0, hold:0, swap:0 };
      this._lastTipAt = 0;
    }

    // metrics ที่ส่งเข้ามา: {acc, missRate, offsetAbsMean, offsetStd, blankTapRate, hp, combo, feverPct, segIndex, elapsedPct}
    update(metrics){
      if (!this.enabled) return this._snapshot('', metrics);

      const acc = clamp(metrics.acc, 0, 100) / 100;             // 0..1
      const miss = clamp(metrics.missRate, 0, 1);               // 0..1
      const blank = clamp(metrics.blankTapRate, 0, 1);          // 0..1

      // timing error: abs mean ~ 0.00..0.25 (sec)
      const absMean = clamp(metrics.offsetAbsMean || 0, 0, 0.35);
      const std = clamp(metrics.offsetStd || 0, 0, 0.35);

      // แปลงเป็น 0..1
      const timingBad = clamp(absMean / 0.25, 0, 1);            // สูง=แย่
      const jitterBad = clamp(std / 0.20, 0, 1);

      // fatigueRisk: miss+blank+hp drop+jitter
      const hp = clamp(metrics.hp, 0, 100) / 100;
      const fatigueNow = clamp(
        0.38*miss + 0.18*blank + 0.24*(1-hp) + 0.20*jitterBad,
        0, 1
      );

      // skillScore: acc สูง + timing ดี + combo/fever ช่วยเล็กน้อย
      const comboBoost = clamp((metrics.combo||0)/20, 0, 1) * 0.10;
      const feverBoost = clamp((metrics.feverPct||0)/40, 0, 1) * 0.10;
      const skillNow = clamp(
        0.62*acc + 0.28*(1-timingBad) + comboBoost + feverBoost,
        0, 1
      );

      // stability: inverse jitter + inverse blank
      const stabilityNow = clamp( 0.65*(1-jitterBad) + 0.35*(1-blank), 0, 1);

      // smooth
      this.fatigue = ewma(this.fatigue, fatigueNow, 0.20);
      this.skill   = ewma(this.skill,   skillNow,   0.18);
      this.stability = ewma(this.stability, stabilityNow, 0.22);

      // suggestedDifficulty (fair): พิจารณา skill - fatigue
      const dScore = this.skill - 0.85*this.fatigue;

      this.suggestedDifficulty =
        dScore > 0.78 ? 'hard' :
        dScore > 0.58 ? 'normal' : 'easy';

      // intensity ของ mods (เพื่อทำให้ “เร้าใจ” แบบไม่ทำร้ายคนล้า)
      // - double: เพิ่มเมื่อ skill สูง
      // - ghost: เพิ่มเมื่อ stability สูง (ไม่ jitter)
      // - hold: เพิ่มเมื่อ timing ดี
      // - swap: เพิ่มเมื่อ skill สูง แต่ลดถ้า fatigue สูง
      const doubleI = clamp(sigmoid((this.skill-0.62)*7), 0, 1);
      const ghostI  = clamp(sigmoid((this.stability-0.62)*7), 0, 1);
      const holdI   = clamp(sigmoid(((1-timingBad)-0.60)*7), 0, 1);
      const swapI   = clamp(sigmoid((dScore-0.58)*8), 0, 1);

      // fatigue gate (คุมไม่ให้โหดตอนล้า)
      const gate = clamp(1 - this.fatigue*1.15, 0, 1);

      this.modIntensity = {
        double: doubleI*gate,
        ghost:  ghostI*gate,
        hold:   holdI*gate,
        swap:   swapI*gate
      };

      // Coach tip (rate-limited)
      const tip = this._makeTip({acc, miss, blank, timingBad, jitterBad, hp, segIndex:metrics.segIndex});

      return this._snapshot(tip, metrics);
    }

    _makeTip(x){
      const now = Date.now();
      if (now - this._lastTipAt < this.cooldownMs) return '';

      // เลือก tip ที่ “อธิบายได้” + actionable
      let tip = '';
      if (x.hp < 0.45 && x.miss > 0.25) tip = 'พักจังหวะครึ่งวินาที ลดการกดรัว แล้วค่อยเร่งใหม่';
      else if (x.blank > 0.18) tip = 'พยายาม “รอเส้นตี” ก่อนแตะ ลด blank tap';
      else if (x.timingBad > 0.55) tip = 'โฟกัสที่เส้นตี: แตะให้ “ตรงจุด” มากกว่าตามสายตาโน้ต';
      else if (x.jitterBad > 0.55) tip = 'คุมจังหวะมือให้สม่ำเสมอ อย่าขยับมือไปมาระหว่างเลน';
      else if (x.acc > 0.92 && x.miss < 0.08) tip = 'ดีมาก! ลองเพิ่มความเร็ว/เพลงที่ยากขึ้นได้เลย';

      if (tip) this._lastTipAt = now;
      return tip;
    }

    _snapshot(tip, metrics){
      return {
        fatigueRisk: clamp(this.fatigue,0,1),
        skillScore: clamp(this.skill,0,1),
        stabilityScore: clamp(this.stability,0,1),
        suggestedDifficulty: this.suggestedDifficulty,
        modIntensity: this.modIntensity,
        tip: tip || '',
        segIndex: metrics && metrics.segIndex || 1
      };
    }
  }

  window.RbAIDirector = RbAIDirector;
})();