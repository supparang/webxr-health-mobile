// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — Prediction + Explainable Coach (NO adaptive)
// FULL v20260304-AI-PRED-EXPLAIN
'use strict';

export function createGoodJunkAI(opts = {}){
  const seed = String(opts.seed ?? '');
  const pid  = String(opts.pid ?? 'anon');
  const diff = String(opts.diff ?? 'normal').toLowerCase();
  const view = String(opts.view ?? 'mobile').toLowerCase();

  // simple stable weights (acts like tiny logistic regression)
  const W = {
    missExpired: 1.25,
    missJunk:    1.05,
    lowShield:   0.75,
    lowAcc:      1.00,
    slowRt:      0.70,
    hard:        0.25,
    cvr:         0.15
  };

  let lastPred = null;

  function clamp01(x){ x=Number(x)||0; return x<0?0:(x>1?1:x); }
  function sigmoid(x){ return 1/(1+Math.exp(-x)); }

  function explainTop2(features){
    const parts = [];

    // contributions (rough)
    const missE = clamp01((features.missGoodExpired||0) / 10);
    const missJ = clamp01((features.missJunkHit||0) / 10);
    const acc   = clamp01((features.accPct||0) / 100);
    const lowAcc = clamp01(1 - acc);
    const shield = Number(features.shield||0);
    const lowShield = clamp01((2 - Math.min(2, shield)) / 2);
    const medRT = Number(features.medianRtGoodMs||0);
    const slowRt = clamp01((medRT - 520) / 420);

    parts.push({ key:'missExpired', score: W.missExpired * missE, text:'ของดีหายบ่อย (ช้าไป)' });
    parts.push({ key:'missJunk',    score: W.missJunk    * missJ, text:'โดนของเสียหลายครั้ง' });
    parts.push({ key:'lowAcc',      score: W.lowAcc      * lowAcc, text:'ความแม่นยังตก' });
    parts.push({ key:'lowShield',   score: W.lowShield   * lowShield, text:'โล่น้อย เสี่ยงโดนของเสีย' });
    parts.push({ key:'slowRt',      score: W.slowRt      * slowRt, text:'รีแอคช้า (แตะช้า)' });

    parts.sort((a,b)=>b.score-a.score);
    const top = parts.slice(0,2);

    return {
      top2: top.map(x=>x.text),
      detail: parts.slice(0,5).map(x=>({ factor:x.key, weight:x.score }))
    };
  }

  function suggestNext(features){
    // very simple, kid-friendly
    const shield = Number(features.shield||0);
    const missE  = Number(features.missGoodExpired||0);
    const missJ  = Number(features.missJunkHit||0);
    const combo  = Number(features.combo||0);
    const fever  = Number(features.fever||0);

    if(shield>0 && missJ>=2) return 'ถ้ามี 🛡️ แล้ว กล้าเสี่ยงโบนัสได้';
    if(missE>=2) return 'โฟกัส “ของดี” ก่อน อย่าปล่อยให้หาย';
    if(missJ>=2) return 'เห็น 🍔🍟 แล้ว “หยุดมือ” 1 วิ';
    if(combo>=4) return 'คอมโบมาแล้ว! เก็บต่อเนื่อง';
    if(fever>=80) return 'FEVER ใกล้เต็ม! ยิงของดีรัว ๆ';
    return 'เลือกของดีใกล้มือก่อน แล้วค่อยเสี่ยง';
  }

  return {
    onSpawn(kind, meta){
      // hook point (no-op for now)
      void(kind); void(meta);
    },
    onHit(kind, meta){
      void(kind); void(meta);
    },
    onExpire(kind, meta){
      void(kind); void(meta);
    },
    onTick(dt, f){
      void(dt);

      // derive simple acc proxy from shots/hits
      const shots = Number(f.shots||0);
      const hits  = Number(f.hits||0);
      const accPct = shots>0 ? (hits/shots)*100 : 0;

      // NOTE: core provides medianRtGoodMs in score events, but not every tick
      // so we approximate slowRt from missExpired & combo pressure
      const approxMed = 520 + Math.min(420, (Number(f.missGoodExpired||0)*35) + Math.max(0, 3-Number(f.combo||0))*22);

      const x =
        W.missExpired * clamp01((Number(f.missGoodExpired||0))/10) +
        W.missJunk    * clamp01((Number(f.missJunkHit||0))/10) +
        W.lowShield   * clamp01((2 - Math.min(2, Number(f.shield||0))) / 2) +
        W.lowAcc      * clamp01(1 - clamp01(accPct/100)) +
        W.slowRt      * clamp01((approxMed - 520)/420) +
        (diff==='hard' ? W.hard : 0) +
        ((view==='cvr'||view==='vr') ? W.cvr : 0);

      const hazardRisk = clamp01(sigmoid(x) - 0.50); // shift to feel nicer
      const next = suggestNext({
        shield: Number(f.shield||0),
        missGoodExpired: Number(f.missGoodExpired||0),
        missJunkHit: Number(f.missJunkHit||0),
        combo: Number(f.combo||0),
        fever: Number(f.fever||0)
      });

      lastPred = {
        hazardRisk,
        next5: [next],
        meta: { seed, pid, diff, view }
      };
      return lastPred;
    },
    getPrediction(){
      return lastPred;
    },
    onEnd(summary){
      // build explain using end summary fields
      const features = {
        missGoodExpired: Number(summary.missGoodExpired||0),
        missJunkHit: Number(summary.missJunkHit||0),
        shield: Number(summary.shieldEnd||0),
        accPct: Number(summary.accPct||0),
        medianRtGoodMs: Number(summary.medianRtGoodMs||0)
      };
      const ex = explainTop2(features);
      return {
        explainTop2: ex.top2,
        explainDetail: ex.detail,
        note: 'prediction-only (no adaptive difficulty)'
      };
    }
  };
}