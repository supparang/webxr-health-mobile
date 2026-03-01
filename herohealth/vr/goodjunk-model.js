// === /webxr-health-mobile/herohealth/vr/goodjunk-model.js ===
// GoodJunk Model Loader — PRODUCTION (optional)
// If you later export a model (json), load it here. For now: stub predictor.
'use strict';

let _cached = null;

export async function loadGoodJunkModel(){
  if(_cached) return _cached;

  // OPTION A) Use a static JSON file you export later:
  //   /webxr-health-mobile/herohealth/vr/models/goodjunk_model.json
  // const url = new URL('./models/goodjunk_model.json', import.meta.url).toString();
  // const j = await (await fetch(url)).json();
  // _cached = makePredictorFromJson(j);

  // OPTION B) No model yet -> provide a safe stub predictor
  _cached = {
    predict: (x)=> {
      // x: {accPct, miss, medianRtGoodMs, shots, score, progressPct}
      const acc = Number(x?.accPct||0);
      const miss = Number(x?.miss||0);
      const med = Number(x?.medianRtGoodMs||0);

      let risk = 0;
      if(acc < 70) risk += 2;
      if(miss >= 6) risk += 2;
      if(med >= 650) risk += 1;
      risk = Math.max(0, Math.min(5, risk));

      let hint = 'รักษาจังหวะ';
      if(miss >= 6) hint = 'ช้าลงนิด ลดพลาด';
      else if(acc < 70) hint = 'โฟกัส GOOD ก่อน';
      else if(med >= 650) hint = 'เล็งให้แม่นขึ้น';

      return { hazardRisk: String(risk), nextWatchout: hint };
    }
  };

  return _cached;
}
