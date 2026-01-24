// === /herohealth/vr-groups/ml-pack9.js ===
// PACK 9 — ML Dataset + Evaluation + Export (JSONL)
// ✅ Collects per-second features + labels (horizon=5s)
// ✅ Works in play/research/practice (prediction optional)
// ✅ Exposes:
//   - GroupsVR.MLPack9.getReport()
//   - GroupsVR.MLPack9.exportJSONL()
//   - GroupsVR.MLPack9.clearDataset()
//
// Storage:
//   LS_DATA = 'HHA_ML_GROUPS_DATASET_JSONL'   (string, JSON Lines)
//   LS_META = 'HHA_ML_GROUPS_DATASET_META'   (json: counts, lastWriteIso)
//
// Query:
//   ?ml=0  -> disable dataset collection
//   ?mlcap=20000  -> max lines cap (default 12000)

(function(root){
  'use strict';
  const DOC = root.document;
  const NS  = root.GroupsVR = root.GroupsVR || {};

  const LS_DATA = 'HHA_ML_GROUPS_DATASET_JSONL';
  const LS_META = 'HHA_ML_GROUPS_DATASET_META';

  const clamp = (v,a,b)=>{ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); };
  const nowMs = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }
  function safeParse(s, fb){ try{ return JSON.parse(s); }catch{ return fb; } }

  function enabledByQuery(){
    const v = String(qs('ml','1')||'1').toLowerCase();
    return !(v==='0' || v==='false' || v==='off');
  }

  const CAP_DEFAULT = 12000; // lines
  function getCap(){
    const c = Number(qs('mlcap', CAP_DEFAULT) || CAP_DEFAULT);
    return clamp(c, 2000, 40000)|0;
  }

  function downloadText(filename, text){
    try{
      const blob = new Blob([String(text||'')], { type:'text/plain;charset=utf-8' });
      const a = DOC.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(_){} }, 200);
      return true;
    }catch(_){ return false; }
  }

  // ---------- state ----------
  const S = {
    on: false,
    startedAtMs: nowMs(),
    t0Ms: nowMs(),

    // latest signals
    last: {
      left:0, score:0, combo:0, miss:0,
      acc:0, grade:'C',
      pressure:0,
      miniOn:false, miniLeft:0, miniNeed:0, miniNow:0,
      storm:false,
      groupKey:'', groupName:'',
      runMode:'play', diff:'normal', view:'mobile', seed:''
    },

    // timeline (per-second)
    secBuf: [],     // entries {tSec, snap...}
    predBuf: [],    // pending predictions for labeling

    // dataset lines count
    linesWritten: 0,

    // evaluation stats (for pMissNext5 and pScoreDropNext5)
    eval: {
      n:0,
      brier_miss:0,
      brier_drop:0,
      // threshold classification @0.65 default
      thr: 0.65,
      TPm:0, FPm:0, TNm:0, FNm:0,
      TPd:0, FPd:0, TNd:0, FNd:0
    }
  };

  function reset(){
    S.startedAtMs = nowMs();
    S.t0Ms = nowMs();
    S.secBuf = [];
    S.predBuf = [];
    S.eval = { n:0, brier_miss:0, brier_drop:0, thr:0.65, TPm:0,FPm:0,TNm:0,FNm:0, TPd:0,FPd:0,TNd:0,FNd:0 };
  }

  function tickSecond(){
    const t = nowMs();
    const tSec = Math.floor((t - S.t0Ms)/1000);

    const snap = {
      tSec,
      left: S.last.left|0,
      score: S.last.score|0,
      combo: S.last.combo|0,
      miss:  S.last.miss|0,
      acc:   S.last.acc|0,
      pressure: S.last.pressure|0,
      miniOn: S.last.miniOn?1:0,
      miniLeft: S.last.miniLeft|0,
      storm: S.last.storm?1:0
    };

    S.secBuf.push(snap);
    // keep last 40s for labeling
    const minT = tSec - 45;
    while(S.secBuf.length && S.secBuf[0].tSec < minT) S.secBuf.shift();

    // label pending predictions whose horizon reached
    labelPending(tSec);

    setTimeout(tickSecond, 220);
  }

  function deltaAt(tA, tB, key){
    // returns value(tB)-value(tA), where entries exist in secBuf
    let A=null,B=null;
    for(let i=S.secBuf.length-1;i>=0;i--){
      const e=S.secBuf[i];
      if(B===null && e.tSec===tB) B=e;
      if(A===null && e.tSec===tA) A=e;
      if(A&&B) break;
    }
    if(!A||!B) return null;
    return Number(B[key]||0) - Number(A[key]||0);
  }

  function labelPending(nowT){
    const H = 5; // seconds horizon
    for(let i=S.predBuf.length-1;i>=0;i--){
      const p = S.predBuf[i];
      if(nowT < p.tSec + H) continue;

      const dMiss  = deltaAt(p.tSec, p.tSec+H, 'miss');
      const dScore = deltaAt(p.tSec, p.tSec+H, 'score');

      if(dMiss===null || dScore===null){
        // cannot label -> drop old
        S.predBuf.splice(i,1);
        continue;
      }

      const yMiss = (dMiss >= 1) ? 1 : 0;
      const yDrop = (dScore < 0) ? 1 : 0;

      // write dataset line (JSONL)
      writeLine({
        kind: 'sec',
        horizonSec: H,
        tSec: p.tSec,
        // context
        runMode: S.last.runMode,
        diff: S.last.diff,
        view: S.last.view,
        seed: S.last.seed,
        groupKey: p.groupKey || S.last.groupKey,
        groupName: p.groupName || S.last.groupName,

        // features
        f: p.features || {},
        // preds (optional)
        pred: {
          risk01: p.risk01 ?? null,
          pMissNext5: p.pMissNext5 ?? null,
          pScoreDropNext5: p.pScoreDropNext5 ?? null
        },
        // labels
        y: { missNext5: yMiss, scoreDropNext5: yDrop }
      });

      // eval if predictions exist
      if(isFinite(p.pMissNext5) && isFinite(p.pScoreDropNext5)){
        updateEval(p.pMissNext5, yMiss, p.pScoreDropNext5, yDrop);
      }

      S.predBuf.splice(i,1);
    }
  }

  function updateEval(pMiss, yMiss, pDrop, yDrop){
    const E = S.eval;
    E.n++;

    // brier
    E.brier_miss += Math.pow(clamp(pMiss,0,1) - yMiss, 2);
    E.brier_drop += Math.pow(clamp(pDrop,0,1) - yDrop, 2);

    // threshold
    const thr = E.thr;
    const pm = (pMiss >= thr) ? 1 : 0;
    const pd = (pDrop >= thr) ? 1 : 0;

    if(pm===1 && yMiss===1) E.TPm++;
    else if(pm===1 && yMiss===0) E.FPm++;
    else if(pm===0 && yMiss===0) E.TNm++;
    else E.FNm++;

    if(pd===1 && yDrop===1) E.TPd++;
    else if(pd===1 && yDrop===0) E.FPd++;
    else if(pd===0 && yDrop===0) E.TNd++;
    else E.FNd++;
  }

  function prf(TP,FP,FN){
    const prec = TP / Math.max(1, TP+FP);
    const rec  = TP / Math.max(1, TP+FN);
    const f1   = (2*prec*rec) / Math.max(1e-9, (prec+rec));
    return { prec, rec, f1 };
  }

  function getReport(){
    const E = S.eval;
    const m = prf(E.TPm, E.FPm, E.FNm);
    const d = prf(E.TPd, E.FPd, E.FNd);

    return {
      enabled: S.on,
      linesWritten: S.linesWritten|0,
      cap: getCap(),
      eval: {
        n: E.n|0,
        thr: E.thr,
        brier_miss: (E.n? (E.brier_miss/E.n) : null),
        brier_drop: (E.n? (E.brier_drop/E.n) : null),
        miss: { TP:E.TPm|0, FP:E.FPm|0, TN:E.TNm|0, FN:E.FNm|0, ...m },
        drop: { TP:E.TPd|0, FP:E.FPd|0, TN:E.TNd|0, FN:E.FNd|0, ...d }
      }
    };
  }

  function writeLine(obj){
    try{
      const cap = getCap();
      const line = JSON.stringify(obj);

      let data = '';
      try{ data = localStorage.getItem(LS_DATA) || ''; }catch(_){}

      // append
      data += (data ? '\n' : '') + line;

      // cap lines (cheap cap)
      const parts = data.split('\n');
      if(parts.length > cap){
        const cut = parts.slice(parts.length - cap);
        data = cut.join('\n');
      }

      try{ localStorage.setItem(LS_DATA, data); }catch(_){}

      S.linesWritten = Math.min(cap, (parts.length>cap?cap:parts.length));

      try{
        localStorage.setItem(LS_META, JSON.stringify({
          lines: S.linesWritten,
          cap,
          lastWriteIso: new Date().toISOString()
        }));
      }catch(_){}
    }catch(_){}
  }

  function exportJSONL(){
    let data='';
    try{ data = localStorage.getItem(LS_DATA) || ''; }catch(_){}
    if(!data){ alert('ยังไม่มี dataset (JSONL)'); return; }

    const name =
      `GroupsVR-ML-${String(S.last.runMode||'run').toUpperCase()}-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.jsonl`;

    const ok = downloadText(name, data);
    if(!ok) alert('Export ไม่สำเร็จ');
  }

  function clearDataset(){
    try{ localStorage.removeItem(LS_DATA); }catch(_){}
    try{ localStorage.removeItem(LS_META); }catch(_){}
    S.linesWritten = 0;
    alert('ล้าง dataset แล้ว ✅');
  }

  // ---------- wiring ----------
  function wire(){
    if(S._wired) return;
    S._wired = true;

    root.addEventListener('hha:time', (ev)=>{
      S.last.left = Number(ev.detail?.left||0);
    }, {passive:true});

    root.addEventListener('hha:score', (ev)=>{
      const d = ev.detail||{};
      S.last.score = Number(d.score||0);
      S.last.combo = Number(d.combo||0);
      S.last.miss  = Number(d.misses||0);
    }, {passive:true});

    root.addEventListener('hha:rank', (ev)=>{
      const d = ev.detail||{};
      S.last.acc = Number(d.accuracy||0);
      S.last.grade = String(d.grade||'C');
    }, {passive:true});

    root.addEventListener('quest:update', (ev)=>{
      const d = ev.detail||{};
      S.last.groupKey  = String(d.groupKey||'');
      S.last.groupName = String(d.groupName||'');
      S.last.miniOn   = !!(d.miniTimeLeftSec>0);
      S.last.miniLeft = Number(d.miniTimeLeftSec||0);
      S.last.miniNeed = Number(d.miniTotal||0);
      S.last.miniNow  = Number(d.miniNow||0);
    }, {passive:true});

    root.addEventListener('groups:progress', (ev)=>{
      const d = ev.detail||{};
      if(d.kind==='pressure') S.last.pressure = Number(d.level||0);
      if(d.kind==='storm_on') S.last.storm = true;
      if(d.kind==='storm_off') S.last.storm = false;
    }, {passive:true});

    // receive ai predictions (optional)
    root.addEventListener('ai:pred', (ev)=>{
      const d = ev.detail||{};
      const t = nowMs();
      const tSec = Math.floor((t - S.t0Ms)/1000);

      // store pending pred for labeling in +5s
      S.predBuf.push({
        tSec,
        risk01: Number(d.risk01),
        pMissNext5: Number(d.pMissNext5),
        pScoreDropNext5: Number(d.pScoreDropNext5),
        features: d.features || {},
        groupKey: d.groupKey || '',
        groupName: d.groupName || ''
      });

      // keep pending list reasonable
      while(S.predBuf.length > 90) S.predBuf.shift();
    }, {passive:true});

    // attach report into end summary (lightweight hook)
    root.addEventListener('hha:end', ()=>{
      // also write a summary line
      writeLine({
        kind:'end',
        timestampIso: new Date().toISOString(),
        runMode: S.last.runMode,
        diff: S.last.diff,
        view: S.last.view,
        seed: S.last.seed,
        report: getReport()
      });
    }, {passive:true});
  }

  function startSessionMeta(meta){
    S.last.runMode = String(meta?.runMode||'play');
    S.last.diff = String(meta?.diff||'normal');
    S.last.view = String(meta?.view||'mobile');
    S.last.seed = String(meta?.seed||'');
  }

  // public API
  NS.MLPack9 = {
    start(meta){
      if(!enabledByQuery()) { S.on=false; return; }
      reset();
      S.on = true;
      startSessionMeta(meta||{});
      wire();
      tickSecond();
    },
    getReport,
    exportJSONL,
    clearDataset
  };

})(typeof window!=='undefined' ? window : globalThis);