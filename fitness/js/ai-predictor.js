// === /fitness/js/ai-predictor.js ===
// Rhythm Boxer AI Predictor + Explainable Coach (lightweight, on-device)
// ✅ Real-time prediction (fatigueRisk / skillScore / suggestedDifficulty)
// ✅ Explainable micro-tips (rate-limited)
// ✅ Weak-side training suggestion (side bias window)
// NOTE: default OFF in research; engine decides gating

(function(){
  'use strict';

  function clamp(v,a,b){ return v<a?a : v>b?b : v; }

  class RbAiPredictor{
    constructor(opts={}){
      this.cfg = Object.assign({
        tipCooldownMs: 2600,
        windowSec: 8.0
      }, opts);

      this._lastTipAt = 0;
      this._lastKey = '';
      this._rolling = []; // store recent snapshots
    }

    // stats: snapshot from engine
    update(stats){
      if(!stats) return null;

      // ---- rolling window ----
      const now = stats.songTime || 0;
      this._rolling.push({
        t: now,
        acc: stats.accPct,
        miss: stats.hitMiss,
        blank: stats.blankTapCount || 0,
        offsetMean: stats.offsetMean,
        offsetStd: stats.offsetStd,
        earlyPct: stats.earlyPct,
        latePct: stats.latePct,
        leftPct: stats.leftHitPct,
        rightPct: stats.rightHitPct,
        hp: stats.hp
      });

      // keep last windowSec
      const w = this.cfg.windowSec;
      while(this._rolling.length && (now - this._rolling[0].t) > w){
        this._rolling.shift();
      }

      const agg = this._aggregate();

      // ---- predictions ----
      const fatigueRisk = this._fatigueRisk(agg);
      const skillScore  = this._skillScore(agg);

      const suggestedDifficulty =
        skillScore > 0.82 && fatigueRisk < 0.35 ? 'hard' :
        skillScore > 0.62 && fatigueRisk < 0.55 ? 'normal' :
        'easy';

      // ---- explainable tip (rate-limited) ----
      const tipObj = this._makeTip(agg, suggestedDifficulty);

      // ---- weak-side training suggestion ----
      const training = this._weakSideTraining(agg);

      return {
        fatigueRisk,
        skillScore,
        suggestedDifficulty,
        tip: tipObj.tip,
        tipKey: tipObj.key,
        training
      };
    }

    _aggregate(){
      const a = this._rolling;
      if(!a.length){
        return {
          acc:0, missRate:0, blankRate:0,
          offsetMean:0, offsetStd:0,
          latePct:50, earlyPct:50,
          leftPct:50, rightPct:50,
          hp:100
        };
      }
      const last = a[a.length-1];

      // use last snapshot (engine already computed totals)
      // plus simple derived rates:
      const totalJudged = (last.miss || 0) + 1; // avoid 0
      const missRate = clamp((last.miss || 0) / (totalJudged + 10), 0, 1); // soft
      const blankRate = clamp((last.blank || 0) / 12, 0, 1); // heuristic

      return {
        acc: clamp((last.acc || 0)/100, 0, 1),
        missRate,
        blankRate,
        offsetMean: Number.isFinite(last.offsetMean) ? last.offsetMean : 0,
        offsetStd: Number.isFinite(last.offsetStd) ? last.offsetStd : 0.1,
        latePct: clamp((last.latePct||50)/100, 0, 1),
        earlyPct: clamp((last.earlyPct||50)/100, 0, 1),
        leftPct: clamp((last.leftPct||50)/100, 0, 1),
        rightPct: clamp((last.rightPct||50)/100, 0, 1),
        hp: clamp((last.hp||100)/100, 0, 1)
      };
    }

    _fatigueRisk(agg){
      // fatigue rises when hp low + miss/blank high + timing unstable
      const hpBad = 1 - agg.hp;
      const timingUnstable = clamp(agg.offsetStd / 0.18, 0, 1); // 0.18s std = very unstable
      return clamp(
        0.45*hpBad + 0.25*agg.missRate + 0.20*agg.blankRate + 0.10*timingUnstable,
        0, 1
      );
    }

    _skillScore(agg){
      // skill rises with acc + low std + low miss/blank
      const timingStable = 1 - clamp(agg.offsetStd / 0.16, 0, 1);
      const cleanPlay = 1 - clamp(0.6*agg.missRate + 0.4*agg.blankRate, 0, 1);
      return clamp(0.55*agg.acc + 0.25*timingStable + 0.20*cleanPlay, 0, 1);
    }

    _makeTip(agg, suggested){
      // rate-limit tips
      const nowMs = Date.now();
      if(nowMs - this._lastTipAt < this.cfg.tipCooldownMs){
        return { tip:'', key:'' };
      }

      // pick the most actionable issue
      let tip = '';
      let key = '';

      if(agg.blankRate > 0.35){
        key = 'blank';
        tip = `อย่ากดรัว (blank tap เยอะ) รอให้โน้ตเข้าเส้นแล้วค่อยแตะ`;
      } else if(agg.missRate > 0.35){
        key = 'miss';
        tip = `Miss เยอะ ลองลดความเร็วมือและโฟกัส “เส้นตี” ก่อน (แนะนำ ${suggested})`;
      } else if(agg.latePct > 0.70){
        key = 'late';
        tip = `คุณ “ช้า (late)” บ่อย ลองแตะก่อนประมาณ 0.05–0.08s`;
      } else if(agg.earlyPct > 0.70){
        key = 'early';
        tip = `คุณ “เร็ว (early)” บ่อย ลองรอให้โน้ตใกล้เส้นอีกนิดก่อนแตะ`;
      } else if(Math.abs(agg.leftPct - agg.rightPct) > 0.22){
        key = 'side';
        tip = `ฝั่งหนึ่งอ่อนกว่า เดี๋ยวจะเปิดช่วงฝึกฝั่งอ่อนให้ 8–10s`;
      } else {
        key = 'ok';
        tip = `ดีมาก! รักษาจังหวะและอย่ารีบ ถ้าไหวลอง ${suggested} รอบถัดไป`;
      }

      // avoid repeating same tip too often
      if(key && key === this._lastKey){
        return { tip:'', key:'' };
      }
      this._lastKey = key;
      this._lastTipAt = nowMs;
      return { tip, key };
    }

    _weakSideTraining(agg){
      const diff = agg.leftPct - agg.rightPct;
      // If right is much lower -> train right, if left lower -> train left
      if(diff > 0.22){
        return { side:'R', durationSec: 9 };
      }
      if(diff < -0.22){
        return { side:'L', durationSec: 9 };
      }
      return null;
    }
  }

  window.RbAiPredictor = RbAiPredictor;
})();