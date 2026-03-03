// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI (Prediction + Explainable Coach + Optional Adaptive Director)
// FULL v20260303-AI-GOODJUNK-EXPLAIN-TOP2-PRO
'use strict';

import { loadGoodJunkWeights, makeGoodJunkModel } from './goodjunk-model.js';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function round(n, d=2){ const p=Math.pow(10,d); return Math.round((Number(n)||0)*p)/p; }

function pickHint(ctx){
  const { hazardRisk, shield, combo, missGoodExpired, missJunkHit } = ctx;
  if(hazardRisk >= 0.80) return 'เสี่ยงสูง! โฟกัส “ของดี” + เก็บโล่ 🛡️';
  if(missJunkHit >= 2 && shield <= 0) return 'เห็นของเสียให้เลี่ยง! หา 🛡️ จะปลอดภัยขึ้น';
  if(missGoodExpired >= 2) return 'ของดีจะหายไว—ตีให้เร็วขึ้นอีกนิด';
  if(combo >= 6) return 'คอมโบมาแล้ว! รักษาจังหวะต่อเนื่อง';
  return 'เริ่มจากของดี 🍎🥦 ก่อนเสมอ';
}

function prettyFeatureName(k){
  // ชื่อสั้น ๆ แบบเด็ก ป.5 อ่านเข้าใจ
  switch(String(k||'')){
    case 'miss_good_expired_rate': return 'ของดีหลุดมือ';
    case 'miss_junk_hit_rate': return 'โดนของเสีย';
    case 'acc_pct': return 'ความแม่น';
    case 'median_rt_good_ms': return 'ช้าในการตี';
    case 'combo': return 'คอมโบ';
    case 'fever_pct': return 'FEVER';
    case 'shield': return 'โล่';
    case 'storm_on': return 'ช่วงพายุ';
    case 'boss_active': return 'ช่วงบอส';
    case 't_left_norm': return 'เวลาน้อย';
    default: return k;
  }
}

function explainTop2(weights, x){
  // อธิบายจาก logistic regression: contribution = w * value (bias แยก)
  if(!weights || !Array.isArray(weights.features)) return [];
  const items = [];
  for(const f of weights.features){
    const k = String(f.name||'').trim();
    if(!k) continue;
    const w = Number(f.w||0);
    const v = Number(x[k] ?? 0) || 0;
    const c = w * v;
    items.push({ k, w, v, c });
  }
  // เอาตัวที่ “ดัน risk ขึ้น” มากสุด (contrib บวกสูง)
  items.sort((a,b)=> (b.c - a.c));
  const top = items.filter(it => it.c > 0).slice(0,2);
  return top.map(it => ({
    feature: it.k,
    label: prettyFeatureName(it.k),
    contrib: round(it.c, 4),
    w: round(it.w, 4),
    v: round(it.v, 4)
  }));
}

export function createGoodJunkAI(cfg){
  cfg = cfg || {};
  const adapt = !!cfg.adapt;

  let last = {
    hazardRisk: 0,
    next5: ['—'],
    features: {},
    director: { spawnMult:1, ttlMult:1 },
    explainTop2: []
  };

  let st = {
    missGoodExpired:0, missJunkHit:0, shots:0, hits:0,
    combo:0, fever:0, shield:0, stormOn:0, bossActive:0,
    tLeftNorm:0.5, medianRtGoodMs:650, accPct:80
  };

  let model = null;
  let weights = null;
  let ready = false;

  // ✅ path จาก run page: /vr-goodjunk/goodjunk-vr.html  -> ../vr/ai-goodjunk.js
  // weights อยู่ที่ /herohealth/vr/goodjunk_weights.json
  const weightsUrl = './goodjunk_weights.json';

  async function init(){
    if(ready) return true;
    try{
      weights = await loadGoodJunkWeights(weightsUrl);
      model = makeGoodJunkModel(weights);
      ready = true;
      return true;
    }catch(e){
      model = null;
      weights = null;
      ready = false;
      return false;
    }
  }

  function buildFeatures(){
    const shots = Math.max(0, Number(st.shots||0));
    const hits  = Math.max(0, Number(st.hits||0));
    const accPct = shots>0 ? (hits/shots)*100 : Number(st.accPct||0);

    const x = {
      miss_good_expired_rate: shots>0 ? (Number(st.missGoodExpired||0)/shots) : 0,
      miss_junk_hit_rate: shots>0 ? (Number(st.missJunkHit||0)/shots) : 0,
      acc_pct: clamp(accPct, 0, 100),
      median_rt_good_ms: clamp(Number(st.medianRtGoodMs||650), 150, 2500),
      combo: clamp(Number(st.combo||0), 0, 99),
      fever_pct: clamp(Number(st.fever||0), 0, 100),
      shield: clamp(Number(st.shield||0), 0, 9),
      storm_on: st.stormOn ? 1 : 0,
      boss_active: st.bossActive ? 1 : 0,
      t_left_norm: clamp(Number(st.tLeftNorm||0.5), 0, 1)
    };
    return { x, accPct: round(accPct,1) };
  }

  function computeDirector(risk){
    // เป้าหมาย “เดือดแต่ไม่ท้อ” = risk ~ 0.45
    const r = clamp(risk, 0, 1);
    const delta = (0.45 - r);
    return {
      spawnMult: clamp(1 + (delta * 0.18), 0.92, 1.10),
      ttlMult:   clamp(1 + (delta * 0.14), 0.95, 1.08)
    };
  }

  return {
    init,
    onSpawn(){}, onHit(){}, onExpire(){},
    onTick(dt, state){
      Object.assign(st, state||{});
      const built = buildFeatures();

      let risk = last.hazardRisk || 0;
      if(ready && model){
        risk = model.predict(built.x);
      }else{
        // fallback heuristic
        const missP = clamp(built.x.miss_good_expired_rate*1.2 + built.x.miss_junk_hit_rate, 0, 1);
        const accP = clamp((100-built.accPct)/100, 0, 1);
        risk = clamp(0.15 + 0.55*missP + 0.25*accP, 0, 1);
      }

      const hint = pickHint({
        hazardRisk: risk,
        shield: st.shield,
        combo: st.combo,
        missGoodExpired: st.missGoodExpired,
        missJunkHit: st.missJunkHit
      });

      const director = adapt ? computeDirector(risk) : { spawnMult:1, ttlMult:1 };
      const top2 = explainTop2(weights, built.x);

      last = { hazardRisk: risk, next5:[hint], features: built.x, director, explainTop2: top2 };
      return last;
    },
    getPrediction(){ return last; },
    getDirector(){ return last.director || {spawnMult:1, ttlMult:1}; },
    onEnd(){
      return {
        hazardRiskLast: round(last.hazardRisk,3),
        hintLast: (last.next5 && last.next5[0]) || '',
        explainTop2: last.explainTop2 || [],
        director: last.director || null,
        features: last.features || null
      };
    }
  };
}