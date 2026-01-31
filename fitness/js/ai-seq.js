// === /fitness/js/ai-seq.js ===
// Sequence DL predictor (TFJS) : predict upcoming miss risk
'use strict';

(function(){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const tanh=(x)=>Math.tanh(x);

  const JMAP = { perfect:0, great:1, good:2, miss:3 };
  const SEQ = {
    ready:false,
    model:null,
    meta:null,
    buf:[],           // [{vec:Float32Array, t:number}]
    seqLen:20,
    featureDim:null,
    _loading:false,
    lastRisk:0,
    lastUpdateMs:0,

    async load(modelBaseUrl){
      if (this.ready || this._loading) return;
      this._loading = true;

      // load tfjs if not present
      if (!window.tf) {
        await new Promise((resolve, reject)=>{
          const s=document.createElement('script');
          s.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js";
          s.onload=resolve; s.onerror=reject;
          document.head.appendChild(s);
        });
      }

      const metaRes = await fetch(modelBaseUrl + "/missrisk_seq_meta.json", {cache:"no-store"});
      this.meta = await metaRes.json();
      this.seqLen = this.meta.seq_len || 20;

      this.model = await window.tf.loadLayersModel(modelBaseUrl + "/model.json");
      // infer feature dim from model input
      const inShape = this.model.inputs[0].shape; // [null, seqLen, featureDim]
      this.featureDim = inShape[2] || null;

      this.ready = true;
      this._loading = false;
    },

    _oneHot(idx, size){
      const v = new Array(size).fill(0);
      if (idx>=0 && idx<size) v[idx]=1;
      return v;
    },

    // Build vec similar to training (keep same order!)
    vectorizeEvent(e){
      const judgment = String(e.judgment||'miss').toLowerCase();
      const lane = Math.max(0, Math.min(4, (e.lane|0)));
      const isBlank = e.event_type === 'blank-tap' ? 1 : 0;

      const raw = Number(e.raw_offset_s || 0) || 0;
      const ab  = Number(e.abs_offset_s || 0) || 0;
      const combo = Number(e.combo_after || 0) || 0;
      const hp = Number(e.hp_after || 100) || 100;
      const fever = Number(e.is_fever || 0) || 0;

      const combo_n = tanh(combo / 25);
      const hp_n = hp / 100;
      const raw_n = tanh(raw / 0.25);
      const abs_n = tanh(ab  / 0.25);

      const j = JMAP[judgment] ?? 3;
      const vec = []
        .concat([raw_n, abs_n, combo_n, hp_n, fever, isBlank])
        .concat(this._oneHot(j,4))
        .concat(this._oneHot(lane,5));

      return vec.map(x=>Number.isFinite(x)?x:0);
    },

    pushEvent(e){
      if (!this.ready) return;
      const vec = this.vectorizeEvent(e);
      // keep buffer
      this.buf.push({ vec, t: Number(e.song_time_s||0) || 0 });
      while (this.buf.length > this.seqLen) this.buf.shift();
    },

    // throttle prediction (avoid heavy)
    predictNow(){
      if (!this.ready || !this.model) return { ok:false, missRisk:0 };
      if (this.buf.length < this.seqLen) return { ok:false, missRisk:this.lastRisk };

      const now = performance.now();
      if (now - this.lastUpdateMs < 350) {
        return { ok:true, missRisk:this.lastRisk, throttled:true };
      }
      this.lastUpdateMs = now;

      const tf = window.tf;
      const seq = this.buf.map(x=>x.vec);
      const x = tf.tensor(seq, [1, this.seqLen, seq[0].length], "float32");
      const y = this.model.predict(x);
      const r = y.dataSync()[0];
      x.dispose(); y.dispose();

      this.lastRisk = clamp(r,0,1);
      return { ok:true, missRisk:this.lastRisk };
    }
  };

  window.AI_SEQ = SEQ;
})();