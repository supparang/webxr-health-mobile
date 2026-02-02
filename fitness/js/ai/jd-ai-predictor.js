// === js/ai/jd-ai-predictor.js ===
// JumpDuck AI Predictor (PACK 2–3)
// - Heuristic predictor (default)
// - Optional ML weights (logistic) from jd-ml-weights.json
// - Optional TFJS model (DL) (if you add tfjs + model files)
// Safe: if model missing -> fallback heuristic
'use strict';

(function(){
  const WIN = window;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }
  function mean(arr){
    if(!arr || !arr.length) return 0;
    return arr.reduce((x,y)=>x+y,0)/arr.length;
  }

  async function fetchJsonMaybe(url){
    try{
      const r = await fetch(url, {cache:'no-store'});
      if(!r.ok) return null;
      return await r.json();
    }catch(_){ return null; }
  }

  // ---------- Heuristic predictor ----------
  function makeHeuristic(){
    // rolling stats
    const mem = {
      lastEvents: [], // {t, hit, rt, action, required, obstacle_kind, quality, missReason}
      maxKeep: 30
    };

    function push(e){
      mem.lastEvents.push(e);
      while(mem.lastEvents.length > mem.maxKeep) mem.lastEvents.shift();
    }

    function predict(features){
      // features: {rtRecent, accRecent, missStreak, hitStreak, speed, interval, boss, timeLeft, stability}
      const rt = features.rtRecent || 0;
      const acc = features.accRecent || 0;
      const missStreak = features.missStreak || 0;
      const hitStreak  = features.hitStreak || 0;

      // risk score 0..1
      let risk = 0.35;

      // slower RT increases risk
      if (rt > 260) risk += 0.18;
      if (rt > 320) risk += 0.10;

      // low accuracy increases risk
      if (acc < 0.75) risk += 0.12;
      if (acc < 0.60) risk += 0.12;

      // streaks
      risk += clamp(missStreak * 0.08, 0, 0.22);
      risk -= clamp(hitStreak  * 0.03, 0, 0.12);

      // boss increases risk baseline
      if (features.boss) risk += 0.08;

      // stability low
      if ((features.stability||100) < 65) risk += 0.10;

      risk = clamp(risk, 0.02, 0.98);

      // fatigue proxy
      let fatigue = 0.25;
      if (rt > 300 && missStreak >= 2) fatigue = 0.70;
      if (rt > 340) fatigue = 0.80;
      fatigue = clamp(fatigue, 0, 1);

      // flow proxy
      let flow = 0.45;
      if (acc > 0.85 && hitStreak >= 5) flow = 0.82;
      if (missStreak >= 2) flow = 0.30;

      // recommended tip category
      let tip = '';
      if (missStreak >= 2) tip = 'timing';
      else if (rt > 300) tip = 'anticipate';
      else if (features.boss && risk > 0.6) tip = 'calm';

      return {
        risk_miss_next: risk,     // 0..1
        fatigue: fatigue,         // 0..1
        flow: flow,               // 0..1
        tip: tip
      };
    }

    function getRecent(){
      const ev = mem.lastEvents;
      const last20 = ev.slice(-20);
      const rtArr = last20.filter(x=>x.hit && x.rt_ms>0).map(x=>x.rt_ms);
      const hitArr = last20.map(x=>x.hit?1:0);
      const acc = hitArr.length ? mean(hitArr) : 0;
      const rt = rtArr.length ? mean(rtArr) : 0;

      // streaks
      let missStreak = 0;
      for(let i=ev.length-1;i>=0;i--){
        if(ev[i].hit) break;
        missStreak++;
      }
      let hitStreak = 0;
      for(let i=ev.length-1;i>=0;i--){
        if(!ev[i].hit) break;
        hitStreak++;
      }

      return {rtRecent:rt, accRecent:acc, missStreak, hitStreak};
    }

    return { push, predict, getRecent, kind:'heuristic' };
  }

  // ---------- ML weights logistic predictor ----------
  // expects file: js/ai/jd-ml-weights.json
  // schema:
  // { "bias": <number>, "weights": { "rtRecent":..., "accRecent":..., "missStreak":..., ... } }
  function makeMLWeights(modelJson){
    const bias = Number(modelJson?.bias)||0;
    const w = modelJson?.weights || {};
    const keys = Object.keys(w);

    function sigmoid(z){ return 1/(1+Math.exp(-z)); }

    function predict(features){
      let z = bias;
      for(const k of keys){
        const wk = Number(w[k])||0;
        z += wk * (Number(features[k])||0);
      }
      const p = sigmoid(z);
      // derive fatigue/flow roughly
      const fatigue = clamp((features.rtRecent||0)/450 + (features.missStreak||0)*0.08, 0, 1);
      const flow    = clamp((features.accRecent||0) - (features.missStreak||0)*0.03, 0, 1);
      let tip = '';
      if ((features.missStreak||0) >= 2) tip = 'timing';
      else if ((features.rtRecent||0) > 300) tip='anticipate';
      return { risk_miss_next:p, fatigue, flow, tip };
    }

    return { predict, kind:'ml-weights' };
  }

  // ---------- TFJS predictor (DL) ----------
  // If you want DL: include TFJS in HTML + add model files, then set mode=tfjs
  function makeTFJSPlaceholder(){
    let model = null;
    let ready = false;

    async function load(modelUrl){
      // You must include TFJS yourself:
      // <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js"></script>
      if(!WIN.tf || !WIN.tf.loadLayersModel) return false;
      try{
        model = await WIN.tf.loadLayersModel(modelUrl);
        ready = true;
        return true;
      }catch(_){
        model = null;
        ready = false;
        return false;
      }
    }

    function predict(features){
      if(!ready || !model || !WIN.tf) return null;

      // Example feature vector (keep in sync with training):
      // [rtRecent, accRecent, missStreak, hitStreak, speed, interval, boss, stability]
      const x = [
        Number(features.rtRecent||0),
        Number(features.accRecent||0),
        Number(features.missStreak||0),
        Number(features.hitStreak||0),
        Number(features.speed||0),
        Number(features.interval||0),
        Number(features.boss?1:0),
        Number(features.stability||100),
      ];

      try{
        const t = WIN.tf.tensor2d([x]);
        const y = model.predict(t);
        const p = y.dataSync()[0];
        t.dispose(); y.dispose();
        const risk = clamp(p, 0.001, 0.999);
        const fatigue = clamp((features.rtRecent||0)/450 + (features.missStreak||0)*0.08, 0, 1);
        const flow = clamp((features.accRecent||0) - (features.missStreak||0)*0.03, 0, 1);
        return { risk_miss_next:risk, fatigue, flow, tip: (risk>0.6?'timing':'') };
      }catch(_){
        return null;
      }
    }

    return { load, predict, kind:'tfjs' };
  }

  // ---------- public factory ----------
  WIN.JD_AI_PREDICTOR_FACTORY = {
    async create(mode){
      const heuristic = makeHeuristic();

      if(mode === 'ml-weights'){
        const json = await fetchJsonMaybe('js/ai/jd-ml-weights.json');
        if(json) return {
          kind:'ml-weights',
          push: heuristic.push,
          getRecent: heuristic.getRecent,
          predict: (features)=> makeMLWeights(json).predict(features)
        };
        return heuristic; // fallback
      }

      if(mode === 'tfjs'){
        const tfp = makeTFJSPlaceholder();
        // default path - you can change
        const ok = await tfp.load('js/ai/tfjs-model/model.json');
        if(ok){
          return {
            kind:'tfjs',
            push: heuristic.push,
            getRecent: heuristic.getRecent,
            predict: (features)=> tfp.predict(features) || heuristic.predict(features)
          };
        }
        return heuristic;
      }

      return heuristic;
    }
  };
})();