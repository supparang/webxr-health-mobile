// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — prediction only (NO adaptive)
// PATCH v20260304-AI-PREDICT-EXPLAINABLE
'use strict';

function clamp01(x){
  x = Number(x);
  if(!Number.isFinite(x)) x = 0;
  return Math.max(0, Math.min(1, x));
}

// tiny deterministic RNG from seed string
function xmur3(str){
  str = String(str||'');
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= (h >>> 16)) >>> 0;
  };
}
function sfc32(a,b,c,d){
  return function(){
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function makeRng(seedStr){
  const seed = xmur3(seedStr);
  return sfc32(seed(), seed(), seed(), seed());
}

export function createGoodJunkAI(opts={}){
  const seed = String(opts.seed || Date.now());
  const rng = makeRng(seed + '::AI::GJ');
  const r01 = ()=> rng();

  // rolling stats
  const st = {
    t: 0,
    spawn: { good:0, junk:0, bonus:0, shield:0, boss:0 },
    hit:   { good:0, junk:0, bonus:0, shield:0, boss:0, junkBlocked:0 },
    expire:{ good:0, junk:0, bonus:0, shield:0, boss:0 },
    last: null
  };

  function top2Reasons(feat){
    // features -> reason weights (explainable)
    const reasons = [];

    // risk up
    if(feat.acc < 0.65) reasons.push(['ความแม่นยำยังแกว่ง', (0.65 - feat.acc) * 1.1]);
    if(feat.missRate > 0.08) reasons.push(['MISS เริ่มถี่', feat.missRate * 0.9]);
    if(feat.missJunkHit > 0) reasons.push(['โดนของเสีย', Math.min(1, feat.missJunkHit/6) * 0.7]);
    if(feat.missGoodExpired > 0) reasons.push(['ของดีหลุดมือ', Math.min(1, feat.missGoodExpired/8) * 0.6]);

    // risk down
    if(feat.shield > 0) reasons.push(['มีโล่กันพลาด', -Math.min(1, feat.shield/3) * 0.55]);
    if(feat.combo >= 4) reasons.push(['คอมโบกำลังมา', -Math.min(1, (feat.combo-3)/6) * 0.35]);
    if(feat.fever >= 60) reasons.push(['โหมด FEVER ช่วยเร่ง', -Math.min(1, (feat.fever-60)/40) * 0.25]);

    // sort by absolute influence (strongest)
    reasons.sort((a,b)=> Math.abs(b[1]) - Math.abs(a[1]));
    return reasons.slice(0,2);
  }

  function predict(feat){
    // baseline risk
    let risk = 0.22;

    // accuracy + miss pressure
    risk += (0.68 - feat.acc) * 0.9;
    risk += feat.missRate * 1.1;

    // specific misses
    risk += Math.min(1, feat.missJunkHit/8) * 0.18;
    risk += Math.min(1, feat.missGoodExpired/10) * 0.12;

    // protection
    risk -= Math.min(1, feat.shield/3) * 0.18;

    // fever/combo buffer
    risk -= Math.min(1, feat.combo/10) * 0.07;
    risk -= Math.min(1, feat.fever/100) * 0.06;

    // clamp
    risk = clamp01(risk);

    const reasons = top2Reasons(feat);

    // next hints (choose from templates deterministically)
    const hintPool = [];
    if(feat.shield > 0) hintPool.push('ถ้ามี 🛡️ แล้ว กล้าเสี่ยงโบนัสได้');
    if(feat.acc < 0.7) hintPool.push('ช้าลงนิด ยิงของดีให้ชัวร์');
    if(feat.missGoodExpired > 0) hintPool.push('โฟกัสของดีที่ใกล้หายก่อน');
    if(feat.missJunkHit > 0) hintPool.push('เห็น 🍔🍟 ให้พักนิ้ว 0.2 วิ แล้วค่อยยิง');
    if(feat.combo >= 4) hintPool.push('รักษาคอมโบ! ยิงของดีต่อเนื่อง');
    if(feat.fever >= 70) hintPool.push('FEVER มาแล้ว! เก็บ BONUS เพิ่มแต้ม');
    if(hintPool.length === 0) hintPool.push('โฟกัสของดี แล้วเลี่ยงของเสีย');

    const next = hintPool[(r01()*hintPool.length)|0];

    // build explainable note (top2)
    const explain = reasons.map(([txt,w])=>{
      const sign = (w>=0) ? '↑' : '↓';
      return `${sign}${txt}`;
    });

    return {
      hazardRisk: risk,
      next5: [next],
      explainTop2: explain
    };
  }

  function getPrediction(){
    return st.last;
  }

  return {
    onSpawn(kind){ st.spawn[kind] = (st.spawn[kind]||0) + 1; },
    onHit(kind, meta){
      st.hit[kind] = (st.hit[kind]||0) + 1;
      if(kind==='junk' && meta && meta.blocked) st.hit.junkBlocked++;
    },
    onExpire(kind){ st.expire[kind] = (st.expire[kind]||0) + 1; },

    onTick(dt, feat){
      st.t += Number(dt)||0;

      const shots = Math.max(1, Number(feat.shots||0));
      const hits  = Math.max(0, Number(feat.hits||0));
      const acc   = Math.max(0, Math.min(1, hits / shots));

      const missTotal = (Number(feat.missGoodExpired||0) + Number(feat.missJunkHit||0));
      const missRate = missTotal / Math.max(1, (Number(feat.shots||0)));

      const f = {
        acc,
        missRate,
        missGoodExpired: Number(feat.missGoodExpired||0),
        missJunkHit: Number(feat.missJunkHit||0),
        shield: Number(feat.shield||0),
        fever: Number(feat.fever||0),
        combo: Number(feat.combo||0)
      };

      st.last = predict(f);
      return st.last;
    },

    onEnd(summary){
      // attach explainable reasons to summary if possible
      const p = st.last || null;
      return {
        aiVersion: 'GJ_AI_2026-03-04_PRED_EXPLAIN',
        predictionLast: p,
        note: p?.explainTop2 ? `Top2: ${p.explainTop2.join(' , ')}` : ''
      };
    },

    getPrediction
  };
}