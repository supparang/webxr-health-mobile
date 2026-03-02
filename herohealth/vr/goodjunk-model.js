// === /herohealth/vr/goodjunk-model.js ===
// GoodJunk Risk Model (Baseline) — PRODUCTION
// v20260302-MODEL
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function sig(x){ return 1/(1+Math.exp(-x)); }

// weights placeholder (สามารถ replace หลัง train)
const W = {
  b: -1.4,
  miss: 0.10,
  hitJunk: 0.18,
  accLow: 0.03,        // (100-acc)
  rt: 0.0012,
  comboNeg: -0.04,
  fever: -0.01,
  timeLow: 0.06,       // 1 if timeLeft < 10
  boss: 0.08
};

export function predictGoodJunkRisk(snap){
  // snap: {miss, hitJunk, accPct, medianRtGoodMs, combo, feverPct, timeLeftSec, bossOn}
  const miss = Number(snap.miss||0);
  const hitJunk = Number(snap.hitJunk||0);
  const acc = clamp(Number(snap.accPct||0), 0, 100);
  const rt = clamp(Number(snap.medianRtGoodMs||0), 0, 5000);
  const combo = clamp(Number(snap.combo||0), 0, 999);
  const fever = clamp(Number(snap.feverPct||0), 0, 100);
  const timeLeft = clamp(Number(snap.timeLeftSec||0), 0, 999);
  const bossOn = snap.bossOn ? 1 : 0;

  const x =
    W.b +
    W.miss * miss +
    W.hitJunk * hitJunk +
    W.accLow * (100 - acc) +
    W.rt * rt +
    W.comboNeg * combo +
    W.fever * fever +
    W.timeLow * (timeLeft < 10 ? 1 : 0) +
    W.boss * bossOn;

  const risk = clamp(sig(x), 0, 1);

  // explainable hint
  let hint = 'เล็งกลางจอแล้วค่อยยิง';
  if(risk > 0.75){
    hint = (acc < 70) ? 'ช้าลงนิดนึง แล้วค่อยยิง GOOD' :
           (hitJunk > 0) ? 'อย่าแตะ JUNK — มองสีก่อนยิง' :
           (timeLeft < 10) ? 'ท้ายเวลา! โฟกัส GOOD เท่านั้น' :
           'คุมจังหวะ อย่ายิงรัว';
  } else if(risk > 0.45){
    hint = (rt > 900) ? 'เร็วขึ้นอีกนิด (แต่ต้องชัวร์)' :
           (acc < 80) ? 'ดูให้ชัวร์ก่อนยิง' :
           'รักษาคอมโบไว้';
  }

  return { risk, hint, x };
}