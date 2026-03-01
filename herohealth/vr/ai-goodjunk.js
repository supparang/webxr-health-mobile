// === /webxr-health-mobile/herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — feature extraction + on-device prediction + explainable hint
// FULL v20260301-AI-GOODJUNK
'use strict';

import { GOODJUNK_MODEL, predictRiskProba, riskLabel } from './goodjunk-model.js';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

export function featurizeGoodJunk(feat){
  // must match GOODJUNK_MODEL.features
  const tLeft = clamp(feat.tLeft, 0, 999);
  const stage = clamp(feat.stage, 1, 3);
  const score = clamp(feat.score, 0, 999999);
  const combo = clamp(feat.combo, 0, 999);
  const miss  = clamp(feat.miss, 0, 999);
  const acc   = clamp(feat.accPct, 0, 100);
  const rt    = clamp(feat.medianRtGoodMs, 0, 5000);
  const fever = clamp(feat.fever, 0, 100);
  const shield= clamp(feat.shield, 0, 3);
  const onScr = clamp(feat.onScreen, 0, 99);
  const spawn = clamp(feat.spawnMs, 100, 2000);
  const life  = clamp(feat.lifeMs, 200, 3000);

  // basic scaling (keep values in reasonable ranges)
  return [
    tLeft/100,
    stage,
    score/1000,
    combo/20,
    miss/10,
    (100-acc)/50,       // higher is worse
    (rt-700)/600,       // >700ms increases risk
    (100-fever)/60,     // low fever => less “buffer”
    (3-shield)/3,       // no shield => more risk
    onScr/8,
    (900-spawn)/400,    // faster spawn => risk
    (1500-life)/600     // shorter life => risk
  ];
}

function explainHint(feat, p){
  // Explainable micro tip for Grade 5
  const acc = Number(feat.accPct||0) || 0;
  const miss= Number(feat.miss||0) || 0;
  const rt  = Number(feat.medianRtGoodMs||0) || 0;
  const shield = Number(feat.shield||0)||0;
  const fever = Number(feat.fever||0)||0;
  const onScr = Number(feat.onScreen||0)||0;

  if(p >= 0.78){
    if(shield<=0) return 'เก็บ 🛡️ ก่อน แล้วค่อยลุยของดี!';
    if(acc < 75)  return 'ใจเย็น ๆ เล็งให้ชัวร์ก่อนกด ✅';
    if(rt > 1100) return 'โฟกัสของ “ดี” ใกล้ ๆ ก่อน 🎯';
    if(miss >= 10) return 'หยุดกดรัว ๆ เลือกเฉพาะของดี 🥦';
    return 'ระวังของ “junk” โผล่ถี่! 🚫';
  }
  if(p >= 0.60){
    if(onScr >= 7) return 'ของเต็มจอ! เลือกของดีที่ง่ายสุดก่อน';
    if(fever < 50) return 'ทำคอมโบให้ติดเพื่อเข้า FEVER ✨';
    return 'ระวัง junk แทรก ลองชะลอ 1 จังหวะ';
  }
  if(p >= 0.35){
    if(shield<=0) return 'หา 🛡️ ไว้กันพลาด';
    return 'ดีมาก! รักษาคอมโบไว้';
  }
  return 'เยี่ยม! ลุยต่อได้เลย 🚀';
}

export function createGoodJunkAI(opts = {}){
  const model = GOODJUNK_MODEL;

  return {
    version: 'goodjunk-ai-v1',
    modelVersion: model.version,
    predict: (feat)=>{
      const x = featurizeGoodJunk(feat);
      const p = predictRiskProba(x, model);
      const label = riskLabel(p, model);
      return {
        proba: Math.round(p*1000)/1000,
        riskLabel: label,
        hint: explainHint(feat, p),
      };
    }
  };
}