// === /herohealth/vr-groups/dl-train.js ===
// Tiny MLP Trainer 32->16->1 (ReLU) with Adam
// ✅ Reads dataset from localStorage key: HHA_GROUPS_DL_DATASET_V1
// ✅ Can import CSV (same columns)
// ✅ Trains class-weighted BCE
// ✅ Computes Val AUC (approx) + Val Loss
// ✅ Stores weights to localStorage key: HHA_GROUPS_DL_W_V1

(function(){
  'use strict';
  const DOC = document;

  const LS_DATA = 'HHA_GROUPS_DL_DATASET_V1';
  const LS_W    = 'HHA_GROUPS_DL_W_V1';

  const $ = (id)=>DOC.getElementById(id);

  const logEl = $('log');
  const log = (s)=>{
    logEl.value += String(s||'') + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  };

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const rnd=(n)=>Math.round(n*1000)/1000;

  function loadLS(){
    try{ return JSON.parse(localStorage.getItem(LS_DATA)||'[]'); }catch{ return []; }
  }
  function clearLS(){
    try{ localStorage.removeItem(LS_DATA); }catch{}
  }
  function setInfo(rows){
    let pos=0;
    for(const r of rows) if ((r.y|0)===1) pos++;
    $('dsInfo').textContent = `key=${LS_DATA}`;
    $('vRows').textContent = String(rows.length);
    $('vPos').textContent  = String(pos);
  }

  function parseCSV(text){
    // minimal CSV parser (quoted supported)
    const lines = text.split(/\r?\n/).filter(l=>l.trim().length);
    if (lines.length<2) return [];
    const header = splitCSVLine(lines[0]);
    const idx = (k)=>header.indexOf(k);
    const out=[];
    for(let i=1;i<lines.length;i++){
      const cols = splitCSVLine(lines[i]);
      if (cols.length !== header.length) continue;
      const row={};
      for(let j=0;j<header.length;j++) row[header[j]] = cols[j];
      // normalize numeric
      for(let j=0;j<32;j++){
        const k='f'+j;
        row[k]=Number(row[k]||0);
      }
      row.y = Number(row.y||0)|0;
      out.push(row);
    }
    return out;
  }
  function splitCSVLine(line){
    const res=[];
    let cur='', q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if (q){
        if (ch === '"'){
          if (line[i+1]==='"'){ cur+='"'; i++; }
          else q=false;
        }else cur+=ch;
      }else{
        if (ch===','){ res.push(cur); cur=''; }
        else if (ch==='"'){ q=true; }
        else cur+=ch;
      }
    }
    res.push(cur);
    return res;
  }

  // ---------------- math ----------------
  function relu(v){ return v>0?v:0; }
  function drelu(v){ return v>0?1:0; }
  function sigmoid(z){
    if (z>=0){ const ez=Math.exp(-z); return 1/(1+ez); }
    const ez=Math.exp(z); return ez/(1+ez);
  }

  function zeros(r,c){
    const m=new Array(r);
    for(let i=0;i<r;i++){ m[i]=new Array(c).fill(0); }
    return m;
  }

  function randn(){
    // Box-Muller
    let u=0,v=0;
    while(u===0) u=Math.random();
    while(v===0) v=Math.random();
    return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
  }

  function initMLP(){
    const W1=zeros(16,32);
    const b1=new Array(16).fill(0);
    const W2=new Array(16).fill(0);
    let b2=0;

    // small random init
    for(let i=0;i<16;i++){
      for(let j=0;j<32;j++) W1[i][j]=randn()*0.06;
      b1[i]=0;
      W2[i]=randn()*0.08;
    }
    b2=0;

    return {W1,b1,W2,b2};
  }

  function forward(model, x){
    const z1=new Array(16).fill(0);
    const h =new Array(16).fill(0);
    for(let i=0;i<16;i++){
      let s=model.b1[i];
      const wi=model.W1[i];
      for(let j=0;j<32;j++) s += wi[j]*x[j];
      z1[i]=s;
      h[i]=relu(s);
    }
    let z2=model.b2;
    for(let i=0;i<16;i++) z2 += model.W2[i]*h[i];
    const yhat=sigmoid(z2);
    return {z1,h,z2,yhat};
  }

  function bce(y, yhat, wPos){
    // class-weighted
    yhat=clamp(yhat,1e-6,1-1e-6);
    const w = (y===1)?wPos:1;
    return -w*(y*Math.log(yhat) + (1-y)*Math.log(1-yhat));
  }

  function aucScore(pairs){
    // pairs: [{y, p}]
    // AUC via rank method
    const a=pairs.slice().sort((a,b)=>a.p-b.p);
    let nPos=0,nNeg=0;
    for(const t of a){ if (t.y===1) nPos++; else nNeg++; }
    if (nPos===0 || nNeg===0) return NaN;
    let rankSum=0;
    for(let i=0;i<a.length;i++){
      if (a[i].y===1) rankSum += (i+1);
    }
    // U = rankSum - nPos*(nPos+1)/2
    const U = rankSum - (nPos*(nPos+1))/2;
    return U / (nPos*nNeg);
  }

  // Adam optimizer state
  function initAdam(model){
    const m = { W1:zeros(16,32), b1:new Array(16).fill(0), W2:new Array(16).fill(0), b2:0 };
    const v = { W1:zeros(16,32), b1:new Array(16).fill(0), W2:new Array(16).fill(0), b2:0 };
    return {m,v,t:0};
  }

  function adamStep(model, grads, opt, lr){
    const beta1=0.9, beta2=0.999, eps=1e-8;
    opt.t++;

    // W1
    for(let i=0;i<16;i++){
      for(let j=0;j<32;j++){
        const g=grads.W1[i][j];
        opt.m.W1[i][j]=beta1*opt.m.W1[i][j]+(1-beta1)*g;
        opt.v.W1[i][j]=beta2*opt.v.W1[i][j]+(1-beta2)*g*g;
        const mh=opt.m.W1[i][j]/(1-Math.pow(beta1,opt.t));
        const vh=opt.v.W1[i][j]/(1-Math.pow(beta2,opt.t));
        model.W1[i][j]-=lr*mh/(Math.sqrt(vh)+eps);
      }
      // b1
      {
        const g=grads.b1[i];
        opt.m.b1[i]=beta1*opt.m.b1[i]+(1-beta1)*g;
        opt.v.b1[i]=beta2*opt.v.b1[i]+(1-beta2)*g*g;
        const mh=opt.m.b1[i]/(1-Math.pow(beta1,opt.t));
        const vh=opt.v.b1[i]/(1-Math.pow(beta2,opt.t));
        model.b1[i]-=lr*mh/(Math.sqrt(vh)+eps);
      }
      // W2
      {
        const g=grads.W2[i];
        opt.m.W2[i]=beta1*opt.m.W2[i]+(1-beta1)*g;
        opt.v.W2[i]=beta2*opt.v.W2[i]+(1-beta2)*g*g;
        const mh=opt.m.W2[i]/(1-Math.pow(beta1,opt.t));
        const vh=opt.v.W2[i]/(1-Math.pow(beta2,opt.t));
        model.W2[i]-=lr*mh/(Math.sqrt(vh)+eps);
      }
    }
    // b2
    {
      const g=grads.b2;
      opt.m.b2=beta1*opt.m.b2+(1-beta1)*g;
      opt.v.b2=beta2*opt.v.b2+(1-beta2)*g*g;
      const mh=opt.m.b2/(1-Math.pow(beta1,opt.t));
      const vh=opt.v.b2/(1-Math.pow(beta2,opt.t));
      model.b2-=lr*mh/(Math.sqrt(vh)+eps);
    }
  }

  function gradsZero(){
    return { W1:zeros(16,32), b1:new Array(16).fill(0), W2:new Array(16).fill(0), b2:0 };
  }

  function trainMLP(rows, cfg){
    const N=rows.length;
    if (N<40){ throw new Error('dataset น้อยเกิน (ต้องมีอย่างน้อย ~40 rows)'); }

    // shuffle
    const idx=[...Array(N)].map((_,i)=>i);
    for(let i=N-1;i>0;i--){
      const j=(Math.random()*(i+1))|0;
      [idx[i],idx[j]]=[idx[j],idx[i]];
    }

    const valN = Math.max(10, Math.round(N*(cfg.valPct/100)));
    const trN  = N - valN;

    const trIdx=idx.slice(0,trN);
    const vaIdx=idx.slice(trN);

    $('vSplit').textContent = `${trN} / ${valN}`;

    // class weight
    let pos=0;
    for(const i of trIdx) if ((rows[i].y|0)===1) pos++;
    const neg = trN - pos;
    const wPos = (pos>0)? clamp(neg/Math.max(1,pos), 1, 20) : 10;

    log(`Train rows=${trN}, Val rows=${valN}, pos=${pos}, neg=${neg}, wPos=${rnd(wPos)}`);

    const model=initMLP();
    const opt=initAdam(model);

    const getX=(r)=>{
      const x=new Array(32);
      for(let j=0;j<32;j++) x[j]=Number(r['f'+j]||0);
      return x;
    };

    let bestAuc=-1, best=null, bestEpoch=0;
    let noImprove=0;

    for(let ep=1; ep<=cfg.epochs; ep++){
      // mini-batch SGD
      for(let s=0; s<trN; s+=cfg.batch){
        const g=gradsZero();
        let bCount=0;
        const end=Math.min(trN, s+cfg.batch);
        for(let k=s;k<end;k++){
          const r=rows[trIdx[k]];
          const x=getX(r);
          const y=(r.y|0);

          const f=forward(model,x);
          const yhat=f.yhat;

          const w = (y===1)?wPos:1;
          // dL/dz2 for sigmoid+BCE = (yhat - y)
          const dz2 = w*(yhat - y);

          // W2, b2
          for(let i=0;i<16;i++){
            g.W2[i] += dz2 * f.h[i];
          }
          g.b2 += dz2;

          // back to hidden
          for(let i=0;i<16;i++){
            const dh = dz2 * model.W2[i];
            const dz1 = dh * drelu(f.z1[i]);
            g.b1[i] += dz1;
            for(let j=0;j<32;j++){
              g.W1[i][j] += dz1 * x[j];
            }
          }
          bCount++;
        }

        // average grads
        const inv=1/Math.max(1,bCount);
        for(let i=0;i<16;i++){
          g.b1[i]*=inv; g.W2[i]*=inv;
          for(let j=0;j<32;j++) g.W1[i][j]*=inv;
        }
        g.b2*=inv;

        adamStep(model,g,opt,cfg.lr);
      }

      // evaluate val
      let vLoss=0;
      const pairs=[];
      for(const ii of vaIdx){
        const r=rows[ii];
        const x=getX(r);
        const y=(r.y|0);
        const yhat=forward(model,x).yhat;
        vLoss += bce(y,yhat,wPos);
        pairs.push({y,p:yhat});
      }
      vLoss/=Math.max(1,valN);
      const auc=aucScore(pairs);
      $('vAuc').textContent = isFinite(auc) ? String(rnd(auc)) : '—';

      log(`Epoch ${ep}/${cfg.epochs} | valLoss=${rnd(vLoss)} | valAUC=${isFinite(auc)?rnd(auc):'NA'}`);

      // early stop on AUC
      const a = isFinite(auc)?auc:-1;
      if (a > bestAuc + 0.002){
        bestAuc=a;
        bestEpoch=ep;
        best = JSON.parse(JSON.stringify(model));
        noImprove=0;
      }else{
        noImprove++;
      }
      if (noImprove>=8){
        log(`Early stop: no improve 8 epochs (bestEpoch=${bestEpoch}, bestAUC=${rnd(bestAuc)})`);
        break;
      }
    }

    if (!best) best=model;

    // store best
    const weights = {
      W1: best.W1,
      b1: best.b1,
      W2: best.W2,
      b2: best.b2,
      meta:{
        trainedAtIso: new Date().toISOString(),
        rows: N,
        bestValAUC: bestAuc,
        bestEpoch: bestEpoch
      }
    };
    return weights;
  }

  function downloadText(filename, text){
    try{
      const blob = new Blob([text], {type:'application/json;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href=url; a.download=filename;
      DOC.body.appendChild(a);
      a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 800);
      return true;
    }catch(_){ return false; }
  }

  // ---------------- UI wiring ----------------
  let rows = [];

  function loadFromLS(){
    rows = loadLS();
    setInfo(rows);
    log(`Loaded from localStorage: rows=${rows.length}`);
  }

  $('btnLoadLS').addEventListener('click', loadFromLS);

  $('btnClearLS').addEventListener('click', ()=>{
    if(!confirm('ลบ dataset ใน localStorage?')) return;
    clearLS();
    rows=[];
    setInfo(rows);
    log('Cleared localStorage dataset ✅');
  });

  $('fileCsv').addEventListener('change', async (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    const text = await f.text();
    rows = parseCSV(text);
    setInfo(rows);
    log(`Imported CSV: rows=${rows.length}`);
  });

  let lastWeights = null;

  $('btnTrain').addEventListener('click', ()=>{
    try{
      if(!rows || rows.length===0){
        alert('ยังไม่มี dataset — ไปเก็บจากเกมด้วย ?dl=1 ก่อน');
        return;
      }
      logEl.value = '';
      const epochs = clamp($('inEpoch').value, 3, 200)|0;
      const batch  = clamp($('inBatch').value, 8, 256)|0;
      const lr     = clamp(parseFloat($('inLR').value), 0.0005, 0.2);
      const valPct = clamp($('inVal').value, 10, 40)|0;

      lastWeights = trainMLP(rows, {epochs,batch,lr,valPct});
      log(`DONE ✅ bestValAUC=${isFinite(lastWeights.meta.bestValAUC)?rnd(lastWeights.meta.bestValAUC):'NA'}`);
      log(`You can now: Apply Weights / Export JSON`);
    }catch(e){
      console.error(e);
      alert(String(e.message||e));
      log(`ERROR: ${String(e.message||e)}`);
    }
  });

  $('btnApplyW').addEventListener('click', ()=>{
    if(!lastWeights){
      // try apply existing stored weights
      try{
        const j = JSON.parse(localStorage.getItem(LS_W)||'null');
        if(j && j.W1 && j.b1 && j.W2){
          alert('มี weights อยู่แล้วใน localStorage (HHA_GROUPS_DL_W_V1) ✅');
          return;
        }
      }catch(_){}
      alert('ยังไม่มี weights — ให้ Train ก่อน');
      return;
    }
    try{
      localStorage.setItem(LS_W, JSON.stringify(lastWeights));
      alert('Apply weights แล้ว ✅ (กลับเกมเปิด ?mode=dl ได้เลย)');
      log('Applied weights to localStorage key: ' + LS_W);
    }catch(e){
      alert('Apply ไม่สำเร็จ');
    }
  });

  $('btnExportW').addEventListener('click', ()=>{
    let w = lastWeights;
    if(!w){
      try{
        w = JSON.parse(localStorage.getItem(LS_W)||'null');
      }catch(_){}
    }
    if(!w){ alert('ยังไม่มี weights'); return; }
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    const ok = downloadText(`groups_dl_weights_${stamp}.json`, JSON.stringify(w, null, 2));
    if(!ok) alert('Export ไม่สำเร็จ');
  });

  // initial
  loadFromLS();
})();