// === js/ai-predictor.js — Lightweight AI Prediction (Deterministic, no deps) ===
// Purpose: provide "AI-like" predictions (fatigue / skill) + micro-coach tips
// Notes:
// - Deterministic: output depends only on aggregated gameplay features (no randomness)
// - Not a trained ML/DL model (yet). We expose a tiny interface so you can swap in a real model later.
// - Safe for Research mode: does NOT change judging unless allowAdapt=true.

(function(){
  'use strict';

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const sigmoid = (x)=> 1/(1+Math.exp(-x));

  // Tiny "model" (logistic-ish) with hand-tuned weights.
  // You can replace weights with trained params later.
  const W_FATIGUE = { bias:-1.6, missRate: 3.4, hpLow: 2.2, latePct: 1.2, jitter: 1.6, blankTap: 1.1 };
  const W_SKILL   = { bias:-0.4, acc: 2.2, perfectRate: 1.6, jitter:-1.4, missRate:-2.6, combo: 0.7 };

  function calcFatigueRisk(f){
    // features should be 0..1-ish
    const z =
      W_FATIGUE.bias +
      W_FATIGUE.missRate * f.missRate +
      W_FATIGUE.hpLow    * f.hpLow +
      W_FATIGUE.latePct  * f.latePct +
      W_FATIGUE.jitter   * f.jitter +
      W_FATIGUE.blankTap * f.blankTapRate;
    return clamp(sigmoid(z), 0, 1);
  }

  function calcSkillScore(f){
    const z =
      W_SKILL.bias +
      W_SKILL.acc         * f.acc +
      W_SKILL.perfectRate * f.perfectRate +
      W_SKILL.jitter      * f.jitter +
      W_SKILL.missRate    * f.missRate +
      W_SKILL.combo       * f.comboNorm;
    return clamp(sigmoid(z), 0, 1);
  }

  function toLabel01(v){
    if (v >= 0.80) return 'high';
    if (v >= 0.55) return 'mid';
    return 'low';
  }

  function makeTip({fatigueRisk, skillScore, earlyPct, latePct, jitter, missStreak}){
    // rate-limited upstream; this returns a single short tip
    if (fatigueRisk >= 0.75) return 'พักไหล่/ข้อมือ 10–15 วิ แล้วค่อยกลับมาเล่น';
    if (missStreak >= 3) return 'ช้าลงนิด: โฟกัส “จังหวะเส้นตี” มากกว่ารีบกด';
    if (jitter >= 0.55) return 'จังหวะยังไม่นิ่ง: ลองหายใจลึก แล้วกดให้สม่ำเสมอ';
    if (latePct - earlyPct >= 0.20) return 'กดช้าไปนิด: ลองกด “ก่อน” เส้นตีเล็กน้อย';
    if (earlyPct - latePct >= 0.20) return 'กดเร็วไปนิด: รอให้เข้าใกล้เส้นตีอีกหน่อย';
    if (skillScore >= 0.75) return 'ทำได้ดีมาก! ลองเพิ่มเพลง/ระดับที่ยากขึ้นได้';
    return 'ดี! รักษาจังหวะให้คงที่ แล้วค่อย ๆ เพิ่มคอมโบ';
  }

  function suggestDifficulty({fatigueRisk, skillScore}){
    // suggestion only (does not auto-change unless allowAdapt)
    if (fatigueRisk >= 0.80) return 'easy';
    if (skillScore >= 0.85 && fatigueRisk <= 0.45) return 'hard';
    return 'normal';
  }

  class AIPredictor{
    constructor(opts={}){
      this.allowAdapt = !!opts.allowAdapt;  // play-mode may enable
      this.lastTipAt = 0;
      this.tipCooldownMs = opts.tipCooldownMs || 4500;
      this.state = {
        fatigueRisk: 0,
        skillScore:  0.5,
        fatigueLabel:'low',
        skillLabel:  'mid',
        suggestedDifficulty:'normal',
        tip:''
      };
    }

    update(features, nowMs){
      const t = Number(nowMs)||0;

      const fatigueRisk = calcFatigueRisk(features);
      const skillScore  = calcSkillScore(features);

      const out = {
        fatigueRisk,
        skillScore,
        fatigueLabel: toLabel01(fatigueRisk),
        skillLabel:   toLabel01(skillScore),
        suggestedDifficulty: suggestDifficulty({fatigueRisk, skillScore}),
        tip: this.state.tip || ''
      };

      // generate tip with cooldown
      if (t - this.lastTipAt >= this.tipCooldownMs){
        out.tip = makeTip({
          fatigueRisk,
          skillScore,
          earlyPct: features.earlyPct,
          latePct: features.latePct,
          jitter: features.jitter,
          missStreak: features.missStreak
        });
        this.lastTipAt = t;
      }

      this.state = out;
      return out;
    }
  }

  window.RB_AIPredictor = AIPredictor;
})();
