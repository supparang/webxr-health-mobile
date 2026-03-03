// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — PREDICTION ONLY (NO adaptive difficulty)
// PATCH v20260303-AI-PRED-EXPLAIN-TOP2-MLDLREADY
//
// Provides:
// - onTick(dt, features) => { hazardRisk, next5, reasonsTop2 }
// - getPrediction()      => last pred
// - onEnd(summary)       => attach aiEnd (top2 factors + final risk)
// - Optional: capture feature/label rows locally (cap=1) for ML/DL later
//
// NOTE: This is a lightweight "model" (tiny linear + sigmoid) that is:
// - deterministic-ish (seeded noise optional but OFF by default)
// - explainable (top 2 weighted factors)
// - safe for research mode (does not change gameplay)

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function sigmoid(x){ return 1/(1+Math.exp(-x)); }

function hhDayKey(){
  const d=new Date();
  const yyyy=d.getFullYear();
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function lsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k, v); }catch(_){ } }

function pushJsonl(key, row, maxLines=4000){
  try{
    const raw = lsGet(key) || '';
    const lines = raw ? raw.split('\n') : [];
    lines.push(JSON.stringify(row));
    while(lines.length > maxLines) lines.shift();
    lsSet(key, lines.join('\n'));
  }catch(_){}
}

function normalizeDiff(diff){
  diff = String(diff||'normal').toLowerCase();
  if(diff==='easy') return 0;
  if(diff==='hard') return 2;
  return 1; // normal
}

export function createGoodJunkAI(opts = {}){
  const seed = String(opts.seed || '');
  const pid  = String(opts.pid  || 'anon');
  const diff = String(opts.diff || 'normal');
  const view = String(opts.view || 'mobile');
  const capture = !!opts.capture;

  // ---- Tiny model weights (tweakable) ----
  // Inputs: missRate, junkRate, expireRate, acc, fever, shield, combo
  // Output: hazardRisk in [0..1]
  const W = {
    bias: -0.55,
    missRate:   2.30,   // overall danger
    junkRate:   1.55,   // junk hit tendency
    expireRate: 1.35,   // slow/late hits
    acc:       -1.20,   // accuracy reduces risk
    fever:     -0.55,   // fever tends to help
    shield:    -0.35,   // shield buffer
    combo:     -0.30    // combo stability
  };

  // difficulty scaling (prediction only)
  const d = normalizeDiff(diff);
  const DIFF_BIAS = (d===0 ? -0.10 : d===2 ? +0.15 : 0);

  // last prediction cache
  let last = null;
  let tAcc = 0;

  // sliding aggregates (for stability)
  let playedSec = 0;
  let lastShots = 0;
  let lastHits  = 0;

  function buildNextHint(risk, f){
    // next "watchout" hint (simple rules)
    if(risk >= 0.78) return ['โหมดอันตราย: เลี่ยง 🍔🍟 ก่อน', 'ช้าไปของดีจะหาย', 'อย่ายิงมั่ว—เล็งทีละเป้า'];
    if(f.junkRate > 0.22) return ['โฟกัสของดี แล้วปล่อยของเสียผ่าน', 'เห็น 🍕🍩 ให้หยุดมือ 0.3 วิ'];
    if(f.expireRate > 0.20) return ['เร่งแตะ “ของดี” ให้ไวขึ้น', 'เลือกเป้าที่อยู่กลางจอ'];
    if(f.acc < 0.70) return ['ลดการยิงพลาด: ยิงเมื่อ “ล็อกเป้า” เท่านั้น', 'หยุดยิงตอนจอโล่ง'];
    return ['ดีมาก! รักษาคอมโบไว้', 'เก็บ ⭐/💎 ตอนปลอดภัย'];
  }

  function explainTop2(features){
    // compute contributions for explainability
    const contrib = [
      { k:'missRate',   w:W.missRate,   v:features.missRate },
      { k:'junkRate',   w:W.junkRate,   v:features.junkRate },
      { k:'expireRate', w:W.expireRate, v:features.expireRate },
      { k:'acc',        w:W.acc,        v:features.acc },
      { k:'fever',      w:W.fever,      v:features.fever },
      { k:'shield',     w:W.shield,     v:features.shield },
      { k:'combo',      w:W.combo,      v:features.combo },
    ].map(o=>({ ...o, score: o.w * o.v }));

    // sort by absolute impact
    contrib.sort((a,b)=>Math.abs(b.score)-Math.abs(a.score));

    function labelOf(k){
      if(k==='missRate') return 'MISS รวมสูง';
      if(k==='junkRate') return 'โดนของเสียบ่อย';
      if(k==='expireRate') return 'ของดีหลุด (หมดเวลา) เยอะ';
      if(k==='acc') return 'ความแม่นต่ำ';
      if(k==='fever') return 'FEVER ต่ำ';
      if(k==='shield') return 'โล่น้อย';
      if(k==='combo') return 'คอมโบไม่ต่อเนื่อง';
      return k;
    }

    // pick top 2 that increase risk (positive contribution) if possible
    const pos = contrib.filter(x=>x.score > 0.02);
    const top = (pos.length>=2 ? pos.slice(0,2) : contrib.slice(0,2));

    return top.map(x=>({
      factor: x.k,
      label: labelOf(x.k),
      impact: Math.round(x.score*100)/100,
      direction: x.score >= 0 ? 'increase' : 'decrease'
    }));
  }

  function toFeatures(state){
    // state from goodjunk.safe.js onTick payload:
    // { missGoodExpired, missJunkHit, shield, fever, combo, shots, hits }
    const shots = Math.max(0, Number(state.shots)||0);
    const hits  = Math.max(0, Number(state.hits)||0);
    const missGoodExpired = Math.max(0, Number(state.missGoodExpired)||0);
    const missJunkHit     = Math.max(0, Number(state.missJunkHit)||0);
    const shield = clamp(state.shield, 0, 9);
    const fever  = clamp(state.fever, 0, 100);
    const combo  = clamp(state.combo, 0, 99);

    const missTotal = missGoodExpired + missJunkHit;
    const missRate  = shots>0 ? (missTotal / Math.max(1, shots)) : 0;
    const junkRate  = shots>0 ? (missJunkHit / Math.max(1, shots)) : 0;
    const expireRate= shots>0 ? (missGoodExpired / Math.max(1, shots)) : 0;
    const acc       = shots>0 ? (hits / Math.max(1, shots)) : 1;

    return {
      shots, hits,
      missTotal, missGoodExpired, missJunkHit,
      missRate: clamp(missRate, 0, 1),
      junkRate: clamp(junkRate, 0, 1),
      expireRate: clamp(expireRate, 0, 1),
      acc: clamp(acc, 0, 1),
      fever: clamp(fever/100, 0, 1),
      shield: clamp(shield/9, 0, 1),
      combo: clamp(combo/20, 0, 1)
    };
  }

  function predict(features){
    // linear model + sigmoid
    let z = 0;
    z += W.bias + DIFF_BIAS;
    z += W.missRate   * features.missRate;
    z += W.junkRate   * features.junkRate;
    z += W.expireRate * features.expireRate;
    z += W.acc        * features.acc;
    z += W.fever      * features.fever;
    z += W.shield     * features.shield;
    z += W.combo      * features.combo;

    const risk = sigmoid(z);
    const reasonsTop2 = explainTop2(features);
    const next5 = buildNextHint(risk, features);

    return { hazardRisk: clamp(risk, 0, 1), next5, reasonsTop2, z: Math.round(z*1000)/1000 };
  }

  function maybeCaptureRow(kind, row){
    if(!capture) return;
    const day = hhDayKey();
    const key = `HHA_AI_GJ_CAPTURE:${pid}:${day}`;
    pushJsonl(key, { kind, ...row }, 5000);
  }

  return {
    onTick(dt, state){
      dt = Number(dt)||0;
      if(dt <= 0) return last;

      // throttle prediction to ~5Hz
      tAcc += dt;
      if(tAcc < 0.20 && last) return last;
      tAcc = 0;

      playedSec += dt;

      const f = toFeatures(state);

      // capture "deltas" too (useful for ML/DL later)
      const dShots = Math.max(0, f.shots - lastShots);
      const dHits  = Math.max(0, f.hits  - lastHits);
      lastShots = f.shots;
      lastHits  = f.hits;

      const p = predict(f);
      last = p;

      maybeCaptureRow('tick', {
        t: Math.round(playedSec*1000)/1000,
        dt: Math.round(dt*1000)/1000,
        seed, diff, view,
        features: f,
        delta: { dShots, dHits }
      });

      return p;
    },

    getPrediction(){
      return last;
    },

    onEnd(summary){
      // attach explainable end card (still prediction-only)
      const end = {
        model: 'tiny-linear-sigmoid-v20260303',
        pid,
        seed,
        diff,
        view,
        lastRisk: last ? Math.round(last.hazardRisk*1000)/1000 : null,
        top2: last ? last.reasonsTop2 : [],
        nextHint: last ? (last.next5?.[0] || null) : null
      };

      maybeCaptureRow('end', {
        tEndIso: summary?.endTimeIso || null,
        summaryLite: {
          scoreFinal: summary?.scoreFinal,
          missTotal: summary?.missTotal,
          accPct: summary?.accPct,
          medianRtGoodMs: summary?.medianRtGoodMs
        },
        aiEnd: end
      });

      return end;
    }
  };
}