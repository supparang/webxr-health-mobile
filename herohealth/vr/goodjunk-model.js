// === /webxr-health-mobile/herohealth/vr/goodjunk-model.js ===
// GoodJunk Model Loader — PRODUCTION (loads ./models/goodjunk_model.json)
// FULL v20260301-MODEL-JSON
'use strict';

let _cached = null;

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return v<a?a:(v>b?b:v); }

function makePredictorFromJson(j){
  const t = (j && j.thresholds) ? j.thresholds : {};
  const ACC_LOW = Number(t.acc_low ?? 70);
  const MISS_HI = Number(t.miss_high ?? 6);
  const RT_HI   = Number(t.rt_high ?? 650);

  return {
    predict: (x)=> {
      const acc  = Number(x?.accPct||0);
      const miss = Number(x?.miss||0);
      const rt   = Number(x?.medianRtGoodMs||0);

      let risk = 0;
      if(acc < ACC_LOW) risk += 2;
      if(miss >= MISS_HI) risk += 2;
      if(rt >= RT_HI) risk += 1;
      risk = clamp(risk, 0, 5);

      let hint = 'รักษาจังหวะ';
      if(miss >= MISS_HI) hint = 'ลดพลาด junk / good expire';
      else if(acc < ACC_LOW) hint = 'โฟกัส GOOD ก่อน';
      else if(rt >= RT_HI) hint = 'เล็งให้แม่นขึ้น';

      return { hazardRisk: String(risk), nextWatchout: hint };
    }
  };
}

export async function loadGoodJunkModel(){
  if(_cached) return _cached;

  // Try to load JSON model from web
  try{
    const url = new URL('./models/goodjunk_model.json', import.meta.url).toString();
    const res = await fetch(url, { cache:'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    _cached = makePredictorFromJson(j);
    return _cached;
  }catch(e){
    // fallback safe predictor (never break game)
    _cached = makePredictorFromJson({ thresholds:{ acc_low:70, miss_high:6, rt_high:650 } });
    return _cached;
  }
}
