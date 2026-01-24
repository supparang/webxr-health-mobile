// === /herohealth/vr-groups/ml-pack10.js ===
// PACK 10 — Bundle Export + Calibration (10-bin) + AUC (lightweight)
// Depends on: ml-pack9.js (uses same LS keys)
//
// Exposes:
//   GroupsVR.MLPack10.buildBundle()
//   GroupsVR.MLPack10.exportBundle()
//   GroupsVR.MLPack10.getCalib()
//   GroupsVR.MLPack10.getAUC()

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

  // ---------- Calibration ----------
  // bins=10 over [0,1). Each bin keeps:
  // count, avgPred, fracPos
  function calibBins(records, fieldPred, fieldLabel, bins=10){
    const B = [];
    for(let i=0;i<bins;i++){
      B.push({ bin:i, lo:i/bins, hi:(i+1)/bins, n:0, sumP:0, sumY:0, avgP:null, fracPos:null });
    }
    for(const r of records){
      const p = Number(r?.pred?.[fieldPred]);
      const y = Number(r?.y?.[fieldLabel]);
      if(!isFinite(p) || !isFinite(y)) continue;
      const pp = clamp(p,0,1);
      const bi = Math.min(bins-1, Math.max(0, Math.floor(pp*bins)));
      const b = B[bi];
      b.n++;
      b.sumP += pp;
      b.sumY += (y>0?1:0);
    }
    for(const b of B){
      if(b.n>0){
        b.avgP = b.sumP / b.n;
        b.fracPos = b.sumY / b.n;
      }
      delete b.sumP; delete b.sumY;
    }
    return B;
  }

  // ---------- AUC (rank-based) ----------
  // AUC = (sumRanksPos - nPos*(nPos+1)/2) / (nPos*nNeg)
  // using average ranks for ties
  function aucRank(records, fieldPred, fieldLabel){
    const arr=[];
    for(const r of records){
      const p = Number(r?.pred?.[fieldPred]);
      const y = Number(r?.y?.[fieldLabel]);
      if(!isFinite(p) || !isFinite(y)) continue;
      arr.push({ p: clamp(p,0,1), y: (y>0?1:0) });
    }
    if(arr.length<20) return null;

    let nPos=0, nNeg=0;
    for(const a of arr){ if(a.y===1) nPos++; else nNeg++; }
    if(nPos===0 || nNeg===0) return null;

    // sort by p asc
    arr.sort((a,b)=>a.p-b.p);

    // assign average ranks for ties
    let rank = 1;
    let sumRanksPos = 0;
    for(let i=0;i<arr.length;){
      let j=i+1;
      while(j<arr.length && arr[j].p===arr[i].p) j++;
      const count = j-i;
      const avgRank = (rank + (rank+count-1)) / 2;
      for(let k=i;k<j;k++){
        if(arr[k].y===1) sumRanksPos += avgRank;
      }
      rank += count;
      i = j;
    }

    const auc = (sumRanksPos - (nPos*(nPos+1))/2) / (nPos*nNeg);
    return clamp(auc,0,1);
  }

  // ---------- Bundle builder ----------
  function buildBundle(){
    const all = readJSONL();
    const sec = all.filter(x=>x && x.kind==='sec');
    const end = all.filter(x=>x && x.kind==='end');

    // last summary (UI summary) if exists
    let last = null;
    try{ last = safeParse(localStorage.getItem(LS_LAST)||'null', null); }catch(_){}

    // calibration + auc for 2 tasks (if preds exist)
    const calib = {
      missNext5: calibBins(sec, 'pMissNext5', 'missNext5', 10),
      scoreDropNext5: calibBins(sec, 'pScoreDropNext5', 'scoreDropNext5', 10)
    };
    const auc = {
      missNext5: aucRank(sec, 'pMissNext5', 'missNext5'),
      scoreDropNext5: aucRank(sec, 'pScoreDropNext5', 'scoreDropNext5')
    };

    // small dataset stats
    let nPred=0;
    for(const r of sec){
      const pm = Number(r?.pred?.pMissNext5);
      const pd = Number(r?.pred?.pScoreDropNext5);
      if(isFinite(pm) && isFinite(pd)) nPred++;
    }

    return {
      bundleTag: 'HHA-GroupsVR-MLBundle',
      version: '10.0.0',
      createdIso: new Date().toISOString(),
      counts: {
        totalLines: all.length,
        secLines: sec.length,
        endLines: end.length,
        predLabeledSec: nPred
      },
      lastSummary: last,
      endLines: end.slice(-5),     // keep last 5 end lines
      calibration: calib,
      auc,
      dataset: {
        format: 'JSONL-like in JSON array',
        sec   // ✅ ใส่เต็ม (ถ้าหนักไป เราทำ PACK 10B+ ให้เลือก “lite” ได้)
      }
    };
  }

  function exportBundle(){
    const b = buildBundle();
    const tag = (b?.lastSummary?.runMode || 'run').toUpperCase();
    const name = `GroupsVR-ML-BUNDLE-${tag}-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    const ok = downloadJSON(name, b);
    if(!ok) alert('Export bundle ไม่สำเร็จ');
    return b;
  }

  function getCalib(){
    const b = buildBundle();
    return b.calibration;
  }

  function getAUC(){
    const b = buildBundle();
    return b.auc;
  }

  NS.MLPack10 = { buildBundle, exportBundle, getCalib, getAUC };

})(typeof window!=='undefined' ? window : globalThis);