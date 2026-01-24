// === /herohealth/vr-groups/ml-pack12.js ===
// PACK 12 — DL Train/Val Split + Normalize/Clip + Group Confusion + Permutation Importance
//
// Needs:
//   - dataset JSONL in LS_DATA (same as Pack 9/10/11)
// Optional:
//   - GroupsVR.MLPack10.predictP(features) => probability for label (best)
// Uses:
//   - GroupsVR.MLPack11.buildSeqDataset(...) for sequence keys, but can run standalone

(function(root){
  'use strict';
  const DOC = root.document;
  const NS  = root.GroupsVR = root.GroupsVR || {};

  const LS_DATA = 'HHA_ML_GROUPS_DATASET_JSONL';

  const clamp = (v,a,b)=>{ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); };
  const safeParse = (s, fb)=>{ try{ return JSON.parse(s);}catch{ return fb; } };

  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0) || 1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function readJSONL(){
    let txt='';
    try{ txt = localStorage.getItem(LS_DATA) || ''; }catch(_){}
    if(!txt) return [];
    const lines = txt.split('\n').filter(Boolean);
    const out=[];
    for(const ln of lines){
      const o = safeParse(ln, null);
      if(o) out.push(o);
    }
    return out;
  }

  function downloadJSON(filename, obj){
    try{
      const text = JSON.stringify(obj, null, 2);
      const blob = new Blob([text], { type:'application/json;charset=utf-8' });
      const a = DOC.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(_){} }, 200);
      return true;
    }catch(_){ return false; }
  }

  // ---------- Extractors ----------
  function getT(r){
    const t = (r?.tSec!=null)?r.tSec : (r?.sec!=null)?r.sec : (r?.t!=null)?r.t : (r?.idx!=null)?r.idx : 0;
    return Number(t)||0;
  }

  function getGroupKey(r){
    // robust: feature field or top-level or quest
    const f = r?.f || {};
    const q = r?.quest || {};
    const k =
      f.groupKey ?? f.group ?? f.gk ??
      r.groupKey ?? r.group ?? q.groupKey ?? q.group ??
      null;
    return (k!=null) ? String(k) : 'unknown';
  }

  function buildFeatureKeys(sec){
    for(const r of sec){
      if(r && r.f && typeof r.f === 'object'){
        return Object.keys(r.f).sort();
      }
    }
    return [];
  }

  function featVec(r, keys){
    const f = (r?.f && typeof r.f==='object') ? r.f : {};
    const v = new Array(keys.length);
    for(let i=0;i<keys.length;i++){
      const x = Number(f[keys[i]]);
      v[i] = isFinite(x) ? x : 0;
    }
    return v;
  }

  // labels: choose one primary label for evaluation/importance
  // default: missNext5 if present, else failMiniNext10 if present
  function pickLabel(r, labelKey){
    const y = r?.y || {};
    const v = y[labelKey];
    if(v==null) return null;
    const n = Number(v);
    return isFinite(n) ? (n>0 ? 1 : 0) : null;
  }

  // Compute derived labels (same idea as Pack11) without depending on Pack11
  function getMiniTotals(r){
    const y = r?.y || {};
    const f = r?.f || {};
    const mt = (y.miniTotal!=null) ? y.miniTotal : (f.miniTotal!=null ? f.miniTotal : r?.miniTotal);
    const mc = (y.miniCleared!=null) ? y.miniCleared : (f.miniCleared!=null ? f.miniCleared : r?.miniCleared);
    return { miniTotal:Number(mt), miniCleared:Number(mc) };
  }
  function getPressure(r){
    const y = r?.y || {};
    const f = r?.f || {};
    const p = (y.pressureLevel!=null) ? y.pressureLevel : (f.pressureLevel!=null ? f.pressureLevel : r?.pressureLevel);
    return Number(p);
  }
  function computeDerivedLabels(sec, i, horizonSec){
    const cur = sec[i];
    const t0 = getT(cur);
    let j=i;
    while(j<sec.length && (getT(sec[j]) - t0) <= horizonSec) j++;

    // failMiniNext10
    let failMini = null;
    const a = getMiniTotals(cur);
    if(isFinite(a.miniTotal) && isFinite(a.miniCleared)){
      let maxT=a.miniTotal, maxC=a.miniCleared;
      for(let k=i+1;k<j;k++){
        const b = getMiniTotals(sec[k]);
        if(isFinite(b.miniTotal))   maxT = Math.max(maxT, b.miniTotal);
        if(isFinite(b.miniCleared)) maxC = Math.max(maxC, b.miniCleared);
      }
      const totalInc = maxT - a.miniTotal;
      const clearInc = maxC - a.miniCleared;
      failMini = (totalInc>0) ? (clearInc>0 ? 0 : 1) : 0;
    }

    // pressureSpikeNext10
    let spike = null;
    const p0 = getPressure(cur);
    if(isFinite(p0)){
      let pMax = p0;
      for(let k=i+1;k<j;k++){
        const pk = getPressure(sec[k]);
        if(isFinite(pk)) pMax = Math.max(pMax, pk);
      }
      spike = (pMax >= p0+1) ? 1 : 0;
    }

    return { failMiniNext10: failMini, pressureSpikeNext10: spike };
  }

  // ---------- Metrics ----------
  function aucFromScores(yTrue, yScore){
    // yTrue: 0/1, yScore: probability
    const arr=[];
    for(let i=0;i<yTrue.length;i++){
      const yt=yTrue[i], ys=yScore[i];
      if(yt==null || ys==null) continue;
      arr.push({yt, ys});
    }
    if(arr.length<8) return null;

    arr.sort((a,b)=>b.ys-a.ys);

    let P=0,N=0;
    for(const r of arr){ if(r.yt===1) P++; else N++; }
    if(P===0 || N===0) return null;

    let tp=0, fp=0;
    let prevScore=Infinity;
    let prevTPR=0, prevFPR=0;
    let area=0;

    for(const r of arr){
      if(r.ys!==prevScore){
        area += (prevFPR - fp/N) * (prevTPR + tp/P) * 0.5; // trapezoid step (reverse)
        prevScore = r.ys;
        prevTPR = tp/P;
        prevFPR = fp/N;
      }
      if(r.yt===1) tp++; else fp++;
    }
    // final
    area += (prevFPR - 1) * (prevTPR + 1) * 0.5;
    return Math.abs(area);
  }

  function logLoss(yTrue, yScore){
    const eps=1e-6;
    let s=0, c=0;
    for(let i=0;i<yTrue.length;i++){
      const y=yTrue[i], p=yScore[i];
      if(y==null || p==null) continue;
      const pp = clamp(p, eps, 1-eps);
      s += -( y*Math.log(pp) + (1-y)*Math.log(1-pp) );
      c++;
    }
    return c? (s/c) : null;
  }

  // ---------- Predictor ----------
  // Prefer MLPack10 model if exists; else heuristic.
  function predictP_fromModelOrHeuristic(keys, X){
    const M10 = NS.MLPack10 || null;

    if(M10 && typeof M10.predictP === 'function'){
      // assume predictP takes feature object or array?
      // we support both: if it wants obj => build {k:v}, else pass array.
      return X.map(vec=>{
        try{
          const p1 = M10.predictP(vec, keys); // allow (vec,keys)
          if(isFinite(p1)) return clamp(p1, 0, 1);
        }catch(_){}
        try{
          const obj={};
          for(let i=0;i<keys.length;i++) obj[keys[i]] = vec[i];
          const p2 = M10.predictP(obj); // allow obj
          if(isFinite(p2)) return clamp(p2, 0, 1);
        }catch(_){}
        return heuristicP(keys, vec);
      });
    }

    return X.map(vec=>heuristicP(keys, vec));
  }

  function heuristicP(keys, vec){
    // simple stress-risk heuristic from common features names (robust fallbacks)
    const get = (name, fb=0)=>{
      const idx = keys.indexOf(name);
      return (idx>=0) ? Number(vec[idx]||0) : fb;
    };

    const misses = get('misses', get('miss', 0));
    const combo  = get('combo', 0);
    const acc    = get('acc', get('accuracy', 0));
    const pressure = get('pressureLevel', get('pressure', 0));

    // Normalize roughly
    const z =
      0.35*clamp(misses/10, 0, 2) +
      0.45*clamp(pressure/3, 0, 2) +
      0.25*clamp((100-acc)/60, 0, 2) +
      0.20*clamp(1 - combo/10, 0, 1.5);

    const p = 1/(1+Math.exp(-(z*1.6 - 1.1)));
    return clamp(p, 0, 1);
  }

  // ---------- Normalize ----------
  function computeMeanStd(X){
    const n=X.length, d=X[0]?.length||0;
    const mean=new Array(d).fill(0);
    const varr=new Array(d).fill(0);

    for(const row of X){
      for(let j=0;j<d;j++) mean[j]+=row[j];
    }
    for(let j=0;j<d;j++) mean[j]/=Math.max(1,n);

    for(const row of X){
      for(let j=0;j<d;j++){
        const dv = row[j]-mean[j];
        varr[j]+=dv*dv;
      }
    }
    const std=new Array(d);
    for(let j=0;j<d;j++){
      std[j]=Math.sqrt(varr[j]/Math.max(1,n));
      if(!isFinite(std[j]) || std[j]<1e-8) std[j]=1.0;
    }
    return {mean,std};
  }

  function normalizeClip(X, mean, std, clipZ){
    const d=mean.length;
    const out=new Array(X.length);
    for(let i=0;i<X.length;i++){
      const row=X[i];
      const r=new Array(d);
      for(let j=0;j<d;j++){
        let z = (row[j]-mean[j])/std[j];
        z = clamp(z, -clipZ, clipZ);
        r[j]=z;
      }
      out[i]=r;
    }
    return out;
  }

  // ---------- Build tabular dataset from sec ----------
  // opts:
  //  labelKey: 'missNext5' | 'scoreDropNext5' | 'failMiniNext10' | 'pressureSpikeNext10'
  //  horizonSec: 10 (for derived labels)
  //  split: 0.2 (val ratio)
  //  seed: '...' or number
  //  clipZ: 3.0
  function buildDLTabular(opts){
    opts=opts||{};
    const labelKey = String(opts.labelKey || 'missNext5');
    const horizonSec = clamp(opts.horizonSec ?? 10, 5, 30);
    const valRatio = clamp(opts.split ?? 0.2, 0.05, 0.45);
    const clipZ = clamp(opts.clipZ ?? 3.0, 2.0, 6.0);
    const seedStr = String(opts.seed ?? 'groups-pack12');

    const all = readJSONL();
    const sec = all.filter(x=>x && x.kind==='sec').sort((a,b)=>getT(a)-getT(b));

    const keys = buildFeatureKeys(sec);
    if(keys.length===0) return { ok:false, reason:'no_features', labelKey };

    const X=[], y=[], meta=[];
    for(let i=0;i<sec.length;i++){
      const r = sec[i];

      // y: from existing y[labelKey], else derived ones
      let yy = pickLabel(r, labelKey);
      if(yy==null && (labelKey==='failMiniNext10' || labelKey==='pressureSpikeNext10')){
        const d = computeDerivedLabels(sec, i, horizonSec);
        const v = d[labelKey];
        yy = (v==null) ? null : (v>0?1:0);
      }
      if(yy==null) continue; // keep clean supervised rows only

      X.push(featVec(r, keys));
      y.push(yy);
      meta.push({
        tSec: getT(r),
        groupKey: getGroupKey(r),
        runMode: String(r?.runMode ?? r?.ctx?.runMode ?? ''),
      });
    }

    if(X.length<60) return { ok:false, reason:'too_few_rows', n:X.length, labelKey };

    // split
    const rng = makeRng(hashSeed(seedStr));
    const idx = Array.from({length:X.length}, (_,i)=>i);
    // Fisher–Yates shuffle deterministic
    for(let i=idx.length-1;i>0;i--){
      const j = (rng()*(i+1))|0;
      const tmp=idx[i]; idx[i]=idx[j]; idx[j]=tmp;
    }

    const nVal = Math.max(1, Math.round(X.length * valRatio));
    const valIdx = new Set(idx.slice(0, nVal));
    const Xtr=[], ytr=[], mtr=[];
    const Xva=[], yva=[], mva=[];
    for(let i=0;i<X.length;i++){
      if(valIdx.has(i)){ Xva.push(X[i]); yva.push(y[i]); mva.push(meta[i]); }
      else{ Xtr.push(X[i]); ytr.push(y[i]); mtr.push(meta[i]); }
    }

    const {mean,std} = computeMeanStd(Xtr);
    const XtrN = normalizeClip(Xtr, mean, std, clipZ);
    const XvaN = normalizeClip(Xva, mean, std, clipZ);

    // baseline eval using model/heuristic
    const pVa = predictP_fromModelOrHeuristic(keys, Xva); // note: use raw Xva for MLPack10 if it expects raw
    const auc = aucFromScores(yva, pVa);
    const ll  = logLoss(yva, pVa);

    // group confusion at threshold 0.5
    const thr=0.5;
    const grp = {};
    for(let i=0;i<yva.length;i++){
      const g = mva[i].groupKey || 'unknown';
      grp[g] = grp[g] || {tp:0,fp:0,tn:0,fn:0, n:0};
      const yT = yva[i];
      const yP = (pVa[i] >= thr) ? 1 : 0;
      grp[g].n++;
      if(yT===1 && yP===1) grp[g].tp++;
      else if(yT===0 && yP===1) grp[g].fp++;
      else if(yT===0 && yP===0) grp[g].tn++;
      else if(yT===1 && yP===0) grp[g].fn++;
    }

    // sort groups by FN (พลาดจริงแต่ทำนายไม่เจอ) แล้ว TP
    const groupReport = Object.entries(grp).map(([k,v])=>{
      const recall = (v.tp + v.fn) ? v.tp/(v.tp+v.fn) : null;
      const fpr    = (v.fp + v.tn) ? v.fp/(v.fp+v.tn) : null;
      return { groupKey:k, ...v, recall, fpr };
    }).sort((a,b)=>(b.fn-a.fn) || ((b.tp-a.tp)));

    return {
      ok:true,
      tag:'HHA-GroupsVR-DL-Tabular',
      version:'12.0.0',
      createdIso:new Date().toISOString(),
      labelKey, horizonSec, valRatio, clipZ, seed: seedStr,
      featureKeys: keys,
      shapes:{
        nTrain: XtrN.length, nVal: XvaN.length, nFeat: keys.length
      },
      normalizer:{ mean, std, clipZ },
      train:{ X: XtrN, y: ytr, meta: mtr },
      val:{ X: XvaN, y: yva, meta: mva, p_pred: pVa },
      eval:{ auc, logloss: ll, threshold: thr },
      groupConfusion: groupReport
    };
  }

  // ---------- Permutation importance ----------
  // metric: 'logloss' (default) or 'auc'
  function permutationImportance(ds, opts){
    opts=opts||{};
    const metric = String(opts.metric || 'logloss');
    const nPerm  = clamp(opts.nPerm ?? 1, 1, 5);

    if(!ds?.ok) return null;

    const keys = ds.featureKeys;
    const y = ds.val.y;
    // IMPORTANT: use raw X for permutation? we have only normalized in ds.val.X.
    // We'll use normalized X for stable importance, and build p using heuristic/model on *de-normalized?*
    // To keep consistent: use heuristic on normalized, and if model exists, fallback to heuristic for importance.
    const useModel = !!(NS.MLPack10 && typeof NS.MLPack10.predictP === 'function');

    function predictOnVal(Xn){
      // If model exists but expects raw, we'd mismatch. So for importance we DO:
      // - if model exists: still use heuristic (safe) unless you later add modelNormalizedPredictP
      if(useModel && opts.forceHeuristic!==true){
        return Xn.map(vec=>heuristicP(keys, vec));
      }
      return Xn.map(vec=>heuristicP(keys, vec));
    }

    const baseP = predictOnVal(ds.val.X);
    const baseAUC = aucFromScores(y, baseP);
    const baseLL  = logLoss(y, baseP);

    const imp=[];
    const X0 = ds.val.X;
    const n = X0.length;
    const d = keys.length;

    const rng = makeRng(hashSeed(String(opts.seed ?? (ds.seed+'::perm'))));

    for(let j=0;j<d;j++){
      let deltaSum=0;
      for(let r=0;r<nPerm;r++){
        // permute column j
        const permIdx = Array.from({length:n}, (_,i)=>i);
        for(let i=n-1;i>0;i--){
          const k=(rng()*(i+1))|0;
          const tmp=permIdx[i]; permIdx[i]=permIdx[k]; permIdx[k]=tmp;
        }

        const Xp = new Array(n);
        for(let i=0;i<n;i++){
          const row = X0[i].slice();
          row[j] = X0[permIdx[i]][j];
          Xp[i]=row;
        }

        const p = predictOnVal(Xp);

        let delta=0;
        if(metric==='auc'){
          const a = aucFromScores(y, p);
          if(a==null || baseAUC==null) delta=0;
          else delta = (baseAUC - a); // drop in auc (bigger=more important)
        }else{
          const ll = logLoss(y, p);
          if(ll==null || baseLL==null) delta=0;
          else delta = (ll - baseLL); // increase in loss (bigger=more important)
        }
        deltaSum += delta;
      }
      imp.push({ feature: keys[j], importance: deltaSum / nPerm });
    }

    imp.sort((a,b)=>b.importance-a.importance);
    return {
      metricUsed: metric,
      base: { auc: baseAUC, logloss: baseLL },
      nPerm,
      importance: imp.slice(0, 24) // top 24
    };
  }

  // ---------- Export ----------
  function exportDLTrainVal(opts){
    const ds = buildDLTabular(opts);
    if(!ds.ok){
      alert('PACK12: ทำ dataset ไม่ได้: ' + (ds.reason||'unknown'));
      return ds;
    }

    const imp = permutationImportance(ds, {
      metric: (opts && opts.metric) ? opts.metric : 'logloss',
      nPerm: 1,
      seed: String((opts && opts.seed) ? opts.seed : ds.seed),
      // forceHeuristic: true // เปิดได้ถ้าต้องการกัน mismatch model
    });

    ds.explain = imp;

    const name = `GroupsVR-DL-TRAINVAL-${ds.labelKey}-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    const ok = downloadJSON(name, ds);
    if(!ok) alert('Export Train/Val ไม่สำเร็จ');
    return ds;
  }

  NS.MLPack12 = { buildDLTabular, permutationImportance, exportDLTrainVal };

})(typeof window!=='undefined' ? window : globalThis);