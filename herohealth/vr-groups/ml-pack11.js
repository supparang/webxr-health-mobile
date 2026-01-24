// === /herohealth/vr-groups/ml-pack11.js ===
// PACK 11 — DL Sequences + New Labels + Lite Bundle
// Uses dataset from LS_DATA (JSONL) created by earlier packs.
//
// Exposes:
//   GroupsVR.MLPack11.buildSeqDataset(opts)
//   GroupsVR.MLPack11.exportDL(opts)
//   GroupsVR.MLPack11.exportLiteBundle(opts)

(function(root){
  'use strict';
  const DOC = root.document;
  const NS  = root.GroupsVR = root.GroupsVR || {};

  const LS_DATA = 'HHA_ML_GROUPS_DATASET_JSONL';
  const LS_LAST = 'HHA_LAST_SUMMARY';

  const clamp = (v,a,b)=>{ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); };

  function safeParse(s, fb){ try{ return JSON.parse(s); }catch{ return fb; } }

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

  // ---------- Time index (robust) ----------
  function getT(r){
    // prefer explicit second index keys if present
    if(r==null) return 0;
    const t =
      (r.tSec != null) ? r.tSec :
      (r.sec != null)  ? r.sec  :
      (r.idx != null)  ? r.idx  :
      (r.i != null)    ? r.i    :
      (r.t != null)    ? r.t    :
      0;
    return Number(t)||0;
  }

  // ---------- Feature extraction ----------
  // Expect r.f is an object of numeric features (as used in earlier packs)
  // We build a stable featureKeys list from the first sec record with f.
  function buildFeatureKeys(sec){
    for(const r of sec){
      if(r && r.f && typeof r.f === 'object'){
        return Object.keys(r.f).sort();
      }
    }
    return [];
  }

  function featVec(r, keys){
    const f = (r && r.f && typeof r.f==='object') ? r.f : {};
    const v = new Array(keys.length);
    for(let i=0;i<keys.length;i++){
      const x = Number(f[keys[i]]);
      v[i] = isFinite(x) ? x : 0;
    }
    return v;
  }

  // ---------- NEW LABELS (computed from logs, no engine changes needed) ----------
  // failMiniNextH:
  // If miniTotal increases within horizon and miniCleared does NOT increase => fail.
  // Works if your sec log includes y.miniTotal/miniCleared OR f.miniTotal/miniCleared OR top-level fields.
  function getMiniTotals(r){
    const y = r?.y || {};
    const f = r?.f || {};
    const mt = (y.miniTotal!=null) ? y.miniTotal : (f.miniTotal!=null ? f.miniTotal : r?.miniTotal);
    const mc = (y.miniCleared!=null) ? y.miniCleared : (f.miniCleared!=null ? f.miniCleared : r?.miniCleared);
    return { miniTotal: Number(mt), miniCleared: Number(mc) };
  }

  // pressureSpikeNextH:
  // If pressureLevel increases by >=1 within horizon.
  function getPressure(r){
    const y = r?.y || {};
    const f = r?.f || {};
    const p = (y.pressureLevel!=null) ? y.pressureLevel : (f.pressureLevel!=null ? f.pressureLevel : r?.pressureLevel);
    return Number(p);
  }

  function computeNewLabels(sec, i, horizonSec){
    const cur = sec[i];
    const t0 = getT(cur);

    // find range within horizon
    let j=i;
    while(j<sec.length && (getT(sec[j]) - t0) <= horizonSec) j++;

    // MINI fail label (nullable if no fields)
    let failMini = null;
    {
      const a = getMiniTotals(cur);
      if(isFinite(a.miniTotal) && isFinite(a.miniCleared)){
        let maxTotal = a.miniTotal, maxCleared = a.miniCleared;
        for(let k=i+1;k<j;k++){
          const b = getMiniTotals(sec[k]);
          if(isFinite(b.miniTotal))   maxTotal = Math.max(maxTotal, b.miniTotal);
          if(isFinite(b.miniCleared)) maxCleared = Math.max(maxCleared, b.miniCleared);
        }
        const totalInc = (maxTotal - a.miniTotal);
        const clearInc = (maxCleared - a.miniCleared);
        if(totalInc > 0){
          // mini happened
          failMini = (clearInc > 0) ? 0 : 1;
        }else{
          failMini = 0; // no mini occurred in horizon
        }
      }
    }

    // Pressure spike
    let spike = null;
    {
      const p0 = getPressure(cur);
      if(isFinite(p0)){
        let pMax = p0;
        for(let k=i+1;k<j;k++){
          const pk = getPressure(sec[k]);
          if(isFinite(pk)) pMax = Math.max(pMax, pk);
        }
        spike = (pMax >= p0 + 1) ? 1 : 0;
      }
    }

    return {
      failMiniNext10: failMini,
      pressureSpikeNext10: spike
    };
  }

  // ---------- Build sequences ----------
  // opts:
  //  winSec: 10 (window length in seconds)
  //  strideSec: 1
  //  horizonSec: 10 (for new labels, default 10)
  //  minSecLines: minimum records required
  function buildSeqDataset(opts){
    opts = opts || {};
    const winSec    = clamp(opts.winSec ?? 10, 5, 40);
    const strideSec = clamp(opts.strideSec ?? 1, 1, 10);
    const horizonSec= clamp(opts.horizonSec ?? 10, 5, 30);

    const all = readJSONL();
    const sec = all.filter(x=>x && x.kind==='sec');

    // sort by time index
    sec.sort((a,b)=>getT(a)-getT(b));

    const featureKeys = buildFeatureKeys(sec);
    if(featureKeys.length===0){
      return { ok:false, reason:'no_features', winSec, strideSec, horizonSec, featureKeys, X_seq:[], y:[], meta:{} };
    }

    // Create sequences assuming 1 record ~ 1 second.
    // If your logger uses real time, still okay because we use "index steps" by row count.
    const winLen = Math.max(3, Math.round(winSec));      // window length in steps
    const stride = Math.max(1, Math.round(strideSec));
    const N = sec.length;

    const X_seq = [];
    const Y = [];
    const meta = [];

    // Determine which existing labels exist (from r.y)
    function pickBaseY(r){
      const y = r?.y || {};
      // keep existing ones if present; else null
      return {
        missNext5: (y.missNext5!=null) ? Number(y.missNext5) : null,
        scoreDropNext5: (y.scoreDropNext5!=null) ? Number(y.scoreDropNext5) : null
      };
    }

    for(let i=0; i+winLen < N; i += stride){
      const endIdx = i + winLen - 1;
      const rEnd = sec[endIdx];

      // X window
      const win = [];
      for(let k=i; k<i+winLen; k++){
        win.push(featVec(sec[k], featureKeys));
      }

      // y at window end (supervised)
      const base = pickBaseY(rEnd);
      const extra = computeNewLabels(sec, endIdx, horizonSec);

      const y = Object.assign({}, base, extra);

      X_seq.push(win);
      Y.push(y);

      meta.push({
        t0: getT(sec[i]),
        t1: getT(rEnd),
        idx0: i,
        idx1: endIdx
      });
    }

    return {
      ok:true,
      tag:'HHA-GroupsVR-DL-SeqDataset',
      version:'11.0.0',
      createdIso:new Date().toISOString(),
      winSec, strideSec, horizonSec,
      featureKeys,
      shapes: { nSeq: X_seq.length, winLen, nFeat: featureKeys.length },
      X_seq,
      y: Y,
      meta
    };
  }

  function exportDL(opts){
    const ds = buildSeqDataset(opts);
    if(!ds.ok){
      alert('Export DL ไม่ได้: ' + (ds.reason||'unknown'));
      return ds;
    }
    const name = `GroupsVR-DL-SEQ-win${ds.winSec}-s${ds.strideSec}-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    const ok = downloadJSON(name, ds);
    if(!ok) alert('Export DL ไม่สำเร็จ');
    return ds;
  }

  // ---------- Lite bundle (no raw sec dump) ----------
  function exportLiteBundle(opts){
    opts = opts || {};
    const dl = buildSeqDataset(opts);

    let last = null;
    try{ last = safeParse(localStorage.getItem(LS_LAST)||'null', null); }catch(_){}

    // bring quick eval from MLPack10 if exists
    const M10 = NS.MLPack10 || null;
    let auc = null, calib = null;
    try{
      auc = M10 && M10.getAUC ? M10.getAUC() : null;
      calib = M10 && M10.getCalib ? M10.getCalib() : null;
    }catch(_){}

    const bundle = {
      bundleTag:'HHA-GroupsVR-LiteBundle',
      version:'11.0.0',
      createdIso:new Date().toISOString(),
      lastSummary:last,
      dlSeqDataset: dl,
      auc,
      calibration: calib
    };

    const name = `GroupsVR-LITE-BUNDLE-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    const ok = downloadJSON(name, bundle);
    if(!ok) alert('Export Lite Bundle ไม่สำเร็จ');
    return bundle;
  }

  NS.MLPack11 = { buildSeqDataset, exportDL, exportLiteBundle };

})(typeof window!=='undefined' ? window : globalThis);