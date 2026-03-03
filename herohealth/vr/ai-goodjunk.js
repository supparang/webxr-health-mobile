// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — PREDICTION ONLY (NO adaptive) + explainable top2 factors
// PATCH v20260304-AI-PREDICT-EXPLAINABLE
'use strict';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }
function sigmoid(x){ return 1/(1+Math.exp(-x)); }

function hashSeed(str){
  str = String(str||'');
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h>>>0;
}

function mulberry32(a){
  a >>>= 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGoodJunkAI(opts={}){
  const seed = String(opts.seed || Date.now());
  const pid  = String(opts.pid || 'anon');
  const diff = String(opts.diff || 'normal');
  const view = String(opts.view || 'mobile');

  const rnd = mulberry32(hashSeed(seed+'|'+pid+'|'+diff+'|'+view));

  // state
  let last = null;
  let risk = 0.25;
  let watch = ['เล็งของดีไว้ก่อน', 'อย่ารีบโดน 🍔🍟', 'คอมโบสำคัญ'];

  // “model” weights (heuristic-logit)
  const W = {
    bias: -0.9,
    missGoodExpired: 0.22,
    missJunkHit: 0.30,
    combo: -0.10,
    fever: -0.006,
    shield: -0.12,
    accLow: 0.018
  };

  function explainTop2(feat){
    const contrib = [
      {k:'missGoodExpired', v: W.missGoodExpired * feat.missGoodExpired, label:'ของดีหลุด (หมดเวลา)'},
      {k:'missJunkHit',     v: W.missJunkHit     * feat.missJunkHit,     label:'เผลอโดนของเสีย'},
      {k:'combo',          v: W.combo          * feat.combo,          label:'คอมโบ'},
      {k:'shield',         v: W.shield         * feat.shield,         label:'โล่'},
      {k:'fever',          v: W.fever          * feat.fever,          label:'FEVER'},
      {k:'accLow',         v: W.accLow         * feat.accLow,         label:'ความแม่นต่ำ'}
    ].sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,2);

    return contrib.map(x=>{
      const dir = x.v >= 0 ? 'เพิ่มความเสี่ยง' : 'ลดความเสี่ยง';
      return `${x.label} (${dir})`;
    });
  }

  function buildNext5(r){
    // deterministic-ish messages
    const poolHi = [
      'ชะลอมือ: เลี่ยง 🍔🍟 ก่อน',
      'กันพลาด: ล็อก “ของดี” ที่ใกล้สุด',
      'อย่ายิงมั่ว: หาเป้าแล้วค่อยยิง',
      'เก็บ 🛡️ ไว้กันโทษ',
      'ลดการหมดเวลา: รีบเก็บของดีที่ใกล้หาย'
    ];
    const poolLo = [
      'รักษาคอมโบ แล้วคะแนนพุ่ง',
      'เห็น ⭐💎 ให้เก็บต่อเนื่อง',
      'FEVER ใกล้เต็ม—เร่งของดี',
      'ถ้มี 🛡️ แล้ว กล้าเสี่ยงโบนัสได้',
      'โฟกัส “ของดี” ก่อนเสมอ'
    ];
    const src = (r >= 0.55) ? poolHi : poolLo;

    // shuffle-lite
    const arr = src.slice();
    for(let i=arr.length-1;i>0;i--){
      const j = (rnd()*(i+1))|0;
      [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    return arr.slice(0,5);
  }

  function computeRisk(feat){
    // accLow: how far below 80%
    const acc = clamp(feat.accPct ?? 0, 0, 100);
    const accLow = Math.max(0, 80 - acc);

    const x =
      W.bias +
      W.missGoodExpired * (feat.missGoodExpired||0) +
      W.missJunkHit * (feat.missJunkHit||0) +
      W.combo * (feat.combo||0) +
      W.fever * (feat.fever||0) +
      W.shield * (feat.shield||0) +
      W.accLow * accLow;

    // convert to 0..1 and smooth
    const raw = sigmoid(x);
    risk = clamp(0.72*risk + 0.28*raw, 0, 1);
    return { risk, raw, accLow };
  }

  return {
    onSpawn(kind, meta){ /* prediction only */ },
    onHit(kind, meta){ /* prediction only */ },
    onExpire(kind, meta){ /* prediction only */ },

    onTick(dt, state){
      const shots = Number(state?.shots||0);
      const hits  = Number(state?.hits||0);
      const accPct = shots>0 ? (hits/shots)*100 : 0;

      const feat = {
        missGoodExpired: Number(state?.missGoodExpired||0),
        missJunkHit: Number(state?.missJunkHit||0),
        combo: Number(state?.combo||0),
        fever: Number(state?.fever||0),
        shield: Number(state?.shield||0),
        accPct
      };

      const { risk: r } = computeRisk(feat);
      watch = buildNext5(r);

      const top2 = explainTop2({
        ...feat,
        accLow: Math.max(0, 80-accPct)
      });

      last = {
        hazardRisk: r,
        next5: watch,
        explainTop2: top2,
        features: feat
      };
      return last;
    },

    getPrediction(){
      return last;
    },

    onEnd(summary){
      // attach explainable bits at end
      try{
        const pred = last || null;
        return pred ? {
          hazardRisk: pred.hazardRisk,
          explainTop2: pred.explainTop2,
          lastNext: (pred.next5 && pred.next5[0]) || null
        } : null;
      }catch(e){
        return null;
      }
    }
  };
}