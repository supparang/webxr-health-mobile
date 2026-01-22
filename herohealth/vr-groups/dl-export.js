/* === /herohealth/vr-groups/dl-export.js ===
GroupsVR DL Export — SEQUENCE PACK (v6-35)
✅ Converts AIHooks.exportDataset() -> sequences (X:[N,T,F], y:[N])
✅ Feature order stable + stats (mean/std) for z-score normalization
✅ Deterministic split (train/val/test) by seed hash
✅ Supports label: miss_in_next_3s OR combo_break_in_next_3s

Usage:
  const ds = GroupsVR.AIHooks.exportDataset();
  const seq = GroupsVR.DLExport.toSequences(ds, { T:16, stride:1, label:'miss_in_next_3s', zscore:true });
  // seq.X, seq.y, seq.featureNames, seq.stats, seq.splits
*/

(function (root) {
  'use strict';

  const NS = root.GroupsVR = root.GroupsVR || {};

  // ---------- utils ----------
  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }

  function hash32(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rand01(u32){
    // deterministic pseudo-rand from u32 (xorshift-ish)
    let x = (u32 >>> 0) || 1;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  }

  function getFeatureNames(sample){
    // stable order based on sample.f keys (sorted) OR fixed whitelist if you prefer
    const f = (sample && sample.f) ? sample.f : {};
    return Object.keys(f).sort();
  }

  function vectorFrom(sample, featureNames){
    const f = (sample && sample.f) ? sample.f : {};
    const v = new Array(featureNames.length);
    for (let i=0;i<featureNames.length;i++){
      const k = featureNames[i];
      const x = Number(f[k] ?? 0);
      v[i] = isFinite(x) ? x : 0;
    }
    return v;
  }

  function labelFrom(sample, labelKey){
    const y = (sample && sample.y) ? sample.y : {};
    return Number(y[labelKey] ?? 0) ? 1 : 0;
  }

  function computeStats(X, featureNames){
    // X: [N][T][F]
    const F = featureNames.length;
    const mean = new Array(F).fill(0);
    const m2   = new Array(F).fill(0);
    let n = 0;

    for (let i=0;i<X.length;i++){
      const seq = X[i];
      for (let t=0;t<seq.length;t++){
        const row = seq[t];
        n++;
        for (let j=0;j<F;j++){
          const x = Number(row[j] ?? 0);
          const delta = x - mean[j];
          mean[j] += delta / n;
          const delta2 = x - mean[j];
          m2[j] += delta * delta2;
        }
      }
    }

    const varr = new Array(F).fill(0);
    const std  = new Array(F).fill(1);
    for (let j=0;j<F;j++){
      varr[j] = (n>1) ? (m2[j] / (n-1)) : 0;
      std[j]  = Math.sqrt(Math.max(1e-9, varr[j]));
    }
    return { nPoints:n, mean, std };
  }

  function applyZScore(X, stats){
    const mean = stats.mean, std = stats.std;
    for (let i=0;i<X.length;i++){
      for (let t=0;t<X[i].length;t++){
        for (let j=0;j<X[i][t].length;j++){
          X[i][t][j] = (X[i][t][j] - mean[j]) / std[j];
        }
      }
    }
  }

  function makeSplits(N, seedStr, ratios){
    // deterministic assignment using hash(seed + idx)
    const r = Object.assign({ train:0.8, val:0.1, test:0.1 }, ratios||{});
    const train = [], val = [], test = [];

    for (let i=0;i<N;i++){
      const u = rand01(hash32(seedStr + '::' + i));
      if (u < r.train) train.push(i);
      else if (u < r.train + r.val) val.push(i);
      else test.push(i);
    }
    return { ratios:r, train, val, test };
  }

  // ---------- main ----------
  function toSequences(dataset, opts){
    opts = opts || {};
    const data = (dataset && Array.isArray(dataset.data)) ? dataset.data : [];
    if (!data.length){
      return {
        ok:false,
        error:'dataset.data empty',
        featureNames:[],
        X:[], y:[],
        stats:null,
        splits:null,
        meta:(dataset && dataset.meta) ? dataset.meta : {}
      };
    }

    const T = clamp(opts.T ?? 16, 4, 64) | 0;           // 16 steps = 8s if step=500ms
    const stride = clamp(opts.stride ?? 1, 1, 8) | 0;
    const labelKey = String(opts.label || 'miss_in_next_3s');
    const zscore = (opts.zscore !== false);             // default true
    const splitRatios = opts.split || { train:0.8, val:0.1, test:0.1 };

    const featureNames = opts.featureNames && Array.isArray(opts.featureNames) && opts.featureNames.length
      ? opts.featureNames.slice(0)
      : getFeatureNames(data[0]);

    // Build sequences from windows
    const X = [];
    const y = [];

    for (let i = 0; i + T <= data.length; i += stride){
      const seq = new Array(T);
      for (let t = 0; t < T; t++){
        seq[t] = vectorFrom(data[i + t], featureNames);
      }

      // label at sequence end (last step)
      const y1 = labelFrom(data[i + T - 1], labelKey);

      X.push(seq);
      y.push(y1);
    }

    // Stats + normalize
    const stats = computeStats(X, featureNames);
    if (zscore) applyZScore(X, stats);

    // Deterministic split seed
    const seedStr =
      String((dataset && dataset.meta && dataset.meta.seed) ? dataset.meta.seed : '') +
      '::' + String(labelKey) +
      '::T' + String(T) +
      '::v6-35';

    const splits = makeSplits(X.length, seedStr, splitRatios);

    return {
      ok:true,
      schemaVersion:'hha-ai-seq-1.0',
      meta: Object.assign({}, (dataset && dataset.meta) ? dataset.meta : {}, {
        label: labelKey,
        T,
        stride,
        zscore,
        exportedAtIso: new Date().toISOString()
      }),
      featureNames,
      stats,         // mean/std for inference-time normalization
      shape: { N:X.length, T, F:featureNames.length },
      splits,        // indices for train/val/test
      X, y
    };
  }

  NS.DLExport = { toSequences };

})(typeof window !== 'undefined' ? window : globalThis);