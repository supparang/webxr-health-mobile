// === /herohealth/vr-groups/ml-pack13.js ===
// PACK 13 — DL Sequence Export (Tensor-ready) + Normalize/Clip + Occlusion Explain (lite)
//
// Input: localStorage JSONL dataset in LS_DATA (same as Pack 9/10/11/12)
// Output: JSON file with train/val sequences: X: [N][T][F], y: [N]
//
// Uses: GroupsVR.MLPack11.buildSeqDataset if present, else standalone builder.
// Optional: GroupsVR.MLPack10.predictP for baseline eval (not required).

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

  function getT(r){
    const t = (r?.tSec!=null)?r.tSec : (r?.sec!=null)?r.sec : (r?.t!=null)?r.t : (r?.idx!=null)?r.idx : 0;
    return Number(t)||0;
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

  // --- Labels ---
  function pickLabel(r, labelKey){
    const y = r?.y || {};
    const v = y[labelKey];
    if(v==null) return null;
    const n = Number(v);
    return isFinite(n) ? (n>0 ? 1 : 0) : null;
  }

  // fallback derived label: failMiniNext10, pressureSpikeNext10
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
  function computeDerivedLabel(sec, i, labelKey, horizonSec){
    const cur = sec[i];
    const t0 = getT(cur);
    let j=i;
    while(j<sec.length && (getT(sec[j]) - t0) <= horizonSec) j++;

    if(labelKey==='failMiniNext10'){
      const a = getMiniTotals(cur);
      if(!(isFinite(a.miniTotal) && isFinite(a.miniCleared))) return null;
      let maxT=a.miniTotal, maxC=a.miniCleared;
      for(let k=i+1;k<j;k++){
        const b = getMiniTotals(sec[k]);
        if(isFinite(b.miniTotal))   maxT = Math.max(maxT, b.miniTotal);
        if(isFinite(b.miniCleared)) maxC = Math.max(maxC, b.miniCleared);
      }
      const totalInc = maxT - a.miniTotal;
      const clearInc = maxC - a.miniCleared;
      const failMini = (totalInc>0) ? (clearInc>0 ? 0 : 1) : 0;
      return failMini;
    }

    if(labelKey==='pressureSpikeNext10'){
      const p0 = getPressure(cur);
      if(!isFinite(p0)) return null;
      let pMax = p0;
      for(let k=i+1;k<j;k++){
        const pk = getPressure(sec[k]);
        if(isFinite(pk)) pMax = Math.max(pMax, pk);
      }
      return (pMax >= p0+1) ? 1 : 0;
    }

    return null;
  }

  // --- Normalize ---
  function computeMeanStd3D(X3){
    // X3: [N][T][F]
    const N=X3.length, T=X3[0]?.length||0, F=X3[0]?.[0]?.length||0;
    const mean=new Array(F).fill(0);
    const varr=new Array(F).fill(0);
    let count=0;

    for(let n=0;n<N;n++){
      for(let t=0;t<T;t++){
        const row=X3[n][t];
        for(let f=0;f<F;f++) mean[f]+=row[f];
        count++;
      }
    }
    count=Math.max(1,count);
    for(let f=0;f<F;f++) mean[f]/=count;

    for(let n=0;n<N;n++){
      for(let t=0;t<T;t++){
        const row=X3[n][t];
        for(let f=0;f<F;f++){
          const dv=row[f]-mean[f];
          varr[f]+=dv*dv;
        }
      }
    }
    const std=new Array(F);
    for(let f=0;f<F;f++){
      std[f]=Math.sqrt(varr[f]/count);
      if(!isFinite(std[f])||std[f]<1e-8) std[f]=1.0;
    }
    return {mean,std};
  }

  function normalizeClip3D(X3, mean, std, clipZ){
    const N=X3.length, T=X3[0]?.length||0, F=mean.length;
    const out=new Array(N);
    for(let n=0;n<N;n++){
      const seq=new Array(T);
      for(let t=0;t<T;t++){
        const row=X3[n][t];
        const z=new Array(F);
        for(let f=0;f<F;f++){
          let v = (row[f]-mean[f])/std[f];
          v = clamp(v, -clipZ, clipZ);
          z[f]=v;
        }
        seq[t]=z;
      }
      out[n]=seq;
    }
    return out;
  }

  // --- Build sequences (standalone) ---
  // Assumes sec is 1Hz-ish; if there are gaps, we forward-fill last row.
  function buildSequencesStandalone(sec, keys, opts){
    const seqLen = clamp(opts.seqLen ?? 20, 8, 60)|0;
    const stride = clamp(opts.stride ?? 1, 1, 10)|0;
    const labelKey = String(opts.labelKey || 'missNext5');
    const horizonSec = clamp(opts.horizonSec ?? 10, 5, 30);

    // map by integer second
    const bySec = new Map();
    for(const r of sec){
      const s = Math.round(getT(r));
      if(!bySec.has(s)) bySec.set(s, r);
    }
    const secs = Array.from(bySec.keys()).sort((a,b)=>a-b);
    if(secs.length < (seqLen+5)) return { X:[], y:[], meta:[] };

    // build contiguous list with forward-fill
    const rows=[];
    let last=null;
    let lastS=secs[0];
    for(let s=secs[0]; s<=secs[secs.length-1]; s++){
      const r = bySec.get(s);
      if(r){ last=r; lastS=s; }
      if(!last) continue;
      rows.push({ s, r:last });
    }

    const X=[], y=[], meta=[];
    for(let i=0; i + seqLen - 1 < rows.length; i += stride){
      const endIdx = i + seqLen - 1;
      const rEnd = rows[endIdx].r;

      // label at end of window
      let yy = pickLabel(rEnd, labelKey);
      if(yy==null && (labelKey==='failMiniNext10' || labelKey==='pressureSpikeNext10')){
        // need index in original sec close to rEnd
        // approximate by scanning sec for matching rounded time
        const tEnd = Math.round(getT(rEnd));
        let kBest=-1, dBest=1e9;
        for(let k=0;k<sec.length;k++){
          const d = Math.abs(Math.round(getT(sec[k])) - tEnd);
          if(d<dBest){ dBest=d; kBest=k; if(d===0) break; }
        }
        if(kBest>=0) yy = computeDerivedLabel(sec, kBest, labelKey, horizonSec);
      }
      if(yy==null) continue;

      const seq=new Array(seqLen);
      for(let t=0;t<seqLen;t++){
        seq[t]=featVec(rows[i+t].r, keys);
      }

      X.push(seq);
      y.push(yy);
      meta.push({ tEndSec: Math.round(getT(rEnd)) });
    }

    return { X, y, meta };
  }

  // --- Split deterministic ---
  function splitTrainVal(X, y, meta, valRatio, seedStr){
    const rng = makeRng(hashSeed(seedStr));
    const idx = Array.from({length:X.length}, (_,i)=>i);
    for(let i=idx.length-1;i>0;i--){
      const j = (rng()*(i+1))|0;
      const tmp=idx[i]; idx[i]=idx[j]; idx[j]=tmp;
    }
    const nVal = Math.max(1, Math.round(X.length * valRatio));
    const valSet = new Set(idx.slice(0,nVal));

    const tr={X:[], y:[], meta:[]};
    const va={X:[], y:[], meta:[]};
    for(let i=0;i<X.length;i++){
      if(valSet.has(i)){ va.X.push(X[i]); va.y.push(y[i]); va.meta.push(meta[i]); }
      else{ tr.X.push(X[i]); tr.y.push(y[i]); tr.meta.push(meta[i]); }
    }
    return {train:tr, val:va};
  }

  // --- Baseline scoring (optional) ---
  function baselinePredictP(keys, seq){
    // Use last timestep only (simple); can be replaced by real model later
    const last = seq[seq.length-1];
    const M10 = NS.MLPack10;
    if(M10 && typeof M10.predictP==='function'){
      // try array
      try{
        const p = M10.predictP(last, keys);
        if(isFinite(p)) return clamp(p,0,1);
      }catch(_){}
      // try object
      try{
        const obj={};
        for(let i=0;i<keys.length;i++) obj[keys[i]]=last[i];
        const p = M10.predictP(obj);
        if(isFinite(p)) return clamp(p,0,1);
      }catch(_){}
    }
    // heuristic: same style as Pack12
    const get=(name,fb=0)=>{
      const ix=keys.indexOf(name);
      return ix>=0 ? Number(last[ix]||0) : fb;
    };
    const misses=get('misses', get('miss',0));
    const combo=get('combo',0);
    const acc=get('acc', get('accuracy',0));
    const pressure=get('pressureLevel', get('pressure',0));
    const z =
      0.35*clamp(misses/10,0,2) +
      0.45*clamp(pressure/3,0,2) +
      0.25*clamp((100-acc)/60,0,2) +
      0.20*clamp(1-combo/10,0,1.5);
    return clamp(1/(1+Math.exp(-(z*1.6-1.1))), 0, 1);
  }

  function logLoss(yTrue, yScore){
    const eps=1e-6;
    let s=0,c=0;
    for(let i=0;i<yTrue.length;i++){
      const y=yTrue[i], p=yScore[i];
      if(y==null || p==null) continue;
      const pp = clamp(p, eps, 1-eps);
      s += -( y*Math.log(pp) + (1-y)*Math.log(1-pp) );
      c++;
    }
    return c? (s/c) : null;
  }

  // --- Occlusion explain (lite) ---
  // mask one timestep (set to 0 vector) OR one feature across all timesteps
  function occlusionExplain(ds, opts){
    opts=opts||{};
    if(!ds?.ok) return null;

    const maxSamples = clamp(opts.maxSamples ?? 80, 20, 250)|0;
    const seedStr = String(opts.seed ?? (ds.seed+'::occ'));
    const rng = makeRng(hashSeed(seedStr));

    const X = ds.val.X; // normalized
    const y = ds.val.y;
    const keys = ds.featureKeys;
    const T = X[0]?.length||0;
    const F = keys.length;

    const n = Math.min(maxSamples, X.length);
    const pickIdx=[];
    const used=new Set();
    while(pickIdx.length<n && used.size<X.length){
      const i=(rng()*X.length)|0;
      if(!used.has(i)){ used.add(i); pickIdx.push(i); }
    }

    const baseP = pickIdx.map(i=>baselinePredictP(keys, X[i])); // using normalized; ok for explanation
    const baseLL = logLoss(pickIdx.map(i=>y[i]), baseP);

    // timestep importance: pick 6 timesteps only (to keep fast)
    const stepK = clamp(opts.steps ?? 6, 3, Math.min(12,T))|0;
    const stepIdx=[];
    for(let k=0;k<stepK;k++){
      const s = Math.round((k/(stepK-1))*(T-1));
      stepIdx.push(s);
    }

    const stepImp=[];
    for(const s of stepIdx){
      const pMask=[];
      for(const i of pickIdx){
        const seq = X[i].map(row=>row.slice());
        // mask timestep s
        seq[s] = new Array(F).fill(0);
        pMask.push(baselinePredictP(keys, seq));
      }
      const ll = logLoss(pickIdx.map(i=>y[i]), pMask);
      stepImp.push({ tIndex:s, importance: (ll!=null && baseLL!=null) ? (ll-baseLL) : 0 });
    }
    stepImp.sort((a,b)=>b.importance-a.importance);

    // feature importance: top 10 only
    const topF = clamp(opts.topFeatures ?? 10, 6, 18)|0;
    const fImp=[];
    const fIdx = Array.from({length:F}, (_,i)=>i);
    // quick preselect: common keys first if found
    const priority = ['misses','combo','accuracy','acc','pressureLevel','pressure','timeLeft','leftSec'];
    fIdx.sort((a,b)=>{
      const ka=keys[a], kb=keys[b];
      const pa=priority.indexOf(ka), pb=priority.indexOf(kb);
      if(pa>=0 && pb<0) return -1;
      if(pb>=0 && pa<0) return 1;
      return a-b;
    });

    for(let u=0; u<Math.min(topF, F); u++){
      const f = fIdx[u];
      const pMask=[];
      for(const i of pickIdx){
        const seq = X[i].map(row=>row.slice());
        // mask feature f across all timesteps
        for(let t=0;t<T;t++) seq[t][f]=0;
        pMask.push(baselinePredictP(keys, seq));
      }
      const ll = logLoss(pickIdx.map(i=>y[i]), pMask);
      fImp.push({ feature: keys[f], importance: (ll!=null && baseLL!=null) ? (ll-baseLL) : 0 });
    }
    fImp.sort((a,b)=>b.importance-a.importance);

    return {
      method:'occlusion-lite',
      usedSamples: pickIdx.length,
      baseLogloss: baseLL,
      timestepImportance: stepImp,
      featureImportance: fImp
    };
  }

  // --- Main export ---
  function exportDLSequence(opts){
    opts=opts||{};
    const labelKey  = String(opts.labelKey || 'missNext5');
    const seqLen    = clamp(opts.seqLen ?? 20, 8, 60)|0;
    const stride    = clamp(opts.stride ?? 1, 1, 10)|0;
    const split     = clamp(opts.split ?? 0.2, 0.05, 0.45);
    const clipZ     = clamp(opts.clipZ ?? 3.0, 2.0, 6.0);
    const horizonSec= clamp(opts.horizonSec ?? 10, 5, 30);
    const seedStr   = String(opts.seed ?? ('groups-pack13-'+labelKey));

    const all = readJSONL();
    const sec = all.filter(x=>x && x.kind==='sec').sort((a,b)=>getT(a)-getT(b));

    const keys = buildFeatureKeys(sec);
    if(!keys.length){
      alert('PACK13: ไม่มี features (sec.f) ใน dataset');
      return { ok:false, reason:'no_features' };
    }
    if(sec.length < 80){
      alert('PACK13: dataset น้อยไป');
      return { ok:false, reason:'too_few_sec', n: sec.length };
    }

    // build sequences
    let built=null;
    if(NS.MLPack11 && typeof NS.MLPack11.buildSeqDataset === 'function'){
      // If your Pack11 returns {X,y,meta,keys} we can adapt; if not, fallback.
      try{
        const tmp = NS.MLPack11.buildSeqDataset({ labelKey, seqLen, stride, horizonSec });
        if(tmp && tmp.X && tmp.y && tmp.featureKeys){
          built = { X: tmp.X, y: tmp.y, meta: tmp.meta || [], keys: tmp.featureKeys };
        }
      }catch(_){}
    }
    if(!built){
      const tmp = buildSequencesStandalone(sec, keys, { labelKey, seqLen, stride, horizonSec });
      built = { X: tmp.X, y: tmp.y, meta: tmp.meta, keys };
    }

    if(built.X.length < 50){
      alert('PACK13: sequence ได้ไม่พอ (ต้องมี label ด้วย)');
      return { ok:false, reason:'too_few_sequences', n: built.X.length };
    }

    // split
    const sp = splitTrainVal(built.X, built.y, built.meta, split, seedStr);

    // normalize by train
    const norm = computeMeanStd3D(sp.train.X);
    const Xtr = normalizeClip3D(sp.train.X, norm.mean, norm.std, clipZ);
    const Xva = normalizeClip3D(sp.val.X,   norm.mean, norm.std, clipZ);

    // baseline eval (logloss) with simple predictor
    const pVa = Xva.map(seq=>baselinePredictP(built.keys, seq));
    const ll  = logLoss(sp.val.y, pVa);

    const ds = {
      ok:true,
      tag:'HHA-GroupsVR-DL-Sequence',
      version:'13.0.0',
      createdIso:new Date().toISOString(),
      labelKey,
      seqLen,
      stride,
      horizonSec,
      valRatio: split,
      clipZ,
      seed: seedStr,
      featureKeys: built.keys,
      shapes:{
        nTrain: Xtr.length, nVal: Xva.length, T: seqLen, F: built.keys.length
      },
      normalizer:{ mean:norm.mean, std:norm.std, clipZ },
      train:{ X: Xtr, y: sp.train.y, meta: sp.train.meta },
      val:{ X: Xva, y: sp.val.y, meta: sp.val.meta, p_pred: pVa },
      eval:{ logloss: ll }
    };

    // occlusion explain (lite)
    ds.explain = occlusionExplain(ds, {
      maxSamples: 80,
      steps: 6,
      topFeatures: 10,
      seed: seedStr
    });

    const name = `GroupsVR-DL-SEQ-${labelKey}-T${seqLen}-S${stride}-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    const ok = downloadJSON(name, ds);
    if(!ok) alert('Export DL Sequence ไม่สำเร็จ');
    return ds;
  }

  NS.MLPack13 = { exportDLSequence };

})(typeof window!=='undefined' ? window : globalThis);