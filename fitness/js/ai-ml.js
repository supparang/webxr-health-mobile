// === /fitness/js/ai-ml.js ===
// TFJS model loader + preprocess (offline)
'use strict';

(function(){
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const asNum = (v)=> (v==null || v==='') ? 0 : Number(v) || 0;

  const AI_ML = {
    ready:false,
    model:null,
    meta:null,
    _loading:false,

    async load(modelBaseUrl){
      if (this.ready || this._loading) return;
      this._loading = true;

      // Load tfjs (if not included)
      if (!window.tf) {
        await new Promise((resolve, reject)=>{
          const s=document.createElement('script');
          s.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js";
          s.onload=resolve; s.onerror=reject;
          document.head.appendChild(s);
        });
      }

      const metaRes = await fetch(modelBaseUrl + "/fatigue_preprocess.json", {cache:"no-store"});
      this.meta = await metaRes.json();

      this.model = await window.tf.loadLayersModel(modelBaseUrl + "/model.json");
      this.ready = true;
      this._loading = false;
    },

    // Build feature vector same order as training
    vectorize(session){
      const meta = this.meta;
      if (!meta) return null;

      const num = meta.num_cols.map(k => asNum(session[k]));
      const catCols = meta.cat_cols;
      const cats = meta.cat_categories;

      // one-hot in trained order
      let onehot = [];
      for (let i=0;i<catCols.length;i++){
        const col = catCols[i];
        const val = String(session[col] ?? '');
        const categories = cats[i] || [];
        for (const c of categories){
          onehot.push(val === String(c) ? 1 : 0);
        }
      }
      const vec = num.concat(onehot);
      return vec.map(v=>Number.isFinite(v)?v:0);
    },

    predictFatigue(session){
      if (!this.ready || !this.model || !this.meta) return { fatigueRisk: 0.0, ok:false };
      const vec = this.vectorize(session);
      if (!vec) return { fatigueRisk: 0.0, ok:false };

      const tf = window.tf;
      const x = tf.tensor2d([vec], [1, vec.length], "float32");
      const y = this.model.predict(x);
      const risk = y.dataSync()[0];
      x.dispose(); y.dispose();
      return { fatigueRisk: clamp(risk,0,1), ok:true };
    }
  };

  window.AI_ML = AI_ML;
})();