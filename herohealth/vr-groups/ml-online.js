// === /herohealth/vr-groups/ml-online.js ===
// Online ML Predictor (LogReg SGD) — SAFE
// ✅ Enabled only when:
//    - run=play AND (?ml=1 OR ?ai=1)
// ✅ Disabled when run=research/practice (hard OFF)
// ✅ Listens: groups:mltrace {kind:'sample'|'event'}
// ✅ Emits: groups:risk {risk:0..1, level:0..3, reason}
// ✅ Stores weights in-memory (optional persist later)

(function(){
  'use strict';
  const WIN = window;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));

  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});

  // ---------------- enable rules ----------------
  function enabledFor(runMode){
    runMode = String(runMode||'play').toLowerCase();
    if (runMode === 'research') return false;
    if (runMode === 'practice') return false;
    const ml = String(qs('ml','0')||'0').toLowerCase();
    const ai = String(qs('ai','0')||'0').toLowerCase();
    return (ml==='1'||ml==='true'||ai==='1'||ai==='true');
  }

  // ---------------- math ----------------
  function sigmoid(z){
    // stable
    if (z >= 0) {
      const ez = Math.exp(-z);
      return 1 / (1 + ez);
    } else {
      const ez = Math.exp(z);
      return ez / (1 + ez);
    }
  }

  // ---------------- model ----------------
  // 32 features from dl-hooks (f0..f31) OR we can reconstruct from sample.
  const N = 32;
  let W = new Array(N).fill(0); // weights
  let B = 0;                    // bias
  let lr = 0.10;                // learning rate (online)
  let l2 = 0.0008;              // small regularization

  // calibration counters
  let seen = 0;
  let pos  = 0;                 // miss-ish count
  let neg  = 0;

  // delayed labeling: mark recent samples positive when miss occurs
  const ring = []; // [{tsMs, x[N], pred, tSec}]
  const RING_MAX = 40;           // keep last ~40 seconds
  const POS_WINDOW_MS = 2500;    // label positives back ~2.5s

  let active = false;
  let runModeNow = 'play';

  function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  function toXFromSample(s){
    // Prefer dl-hooks features if present in sample? (not)
    // We reconstruct the same 32 features "close enough" here,
    // using sample fields produced in 3A.

    const acc = clamp(s.accGoodPct, 0, 100) / 100;
    const misses = clamp(s.misses, 0, 30) / 30;
    const combo = clamp(s.combo, 0, 20) / 20;
    const score = clamp(s.score, 0, 2500) / 2500;

    const pressure = clamp(s.pressure, 0, 3) / 3;
    const storm = s.storm ? 1 : 0;

    const miniOn = s.miniOn ? 1 : 0;
    const miniNeed = clamp(s.miniNeed||0, 0, 10);
    const miniNow  = clamp(s.miniNow||0, 0, 10);
    const miniGap  = (miniOn && miniNeed>0) ? clamp((miniNeed-miniNow)/miniNeed, 0, 1) : 0;
    const miniLeft = clamp(s.miniTimeLeftSec||0, 0, 12) / 12;

    const spawnMs = clamp(s.spawnEveryMs||650, 250, 1200);
    const spawnFast = clamp((720 - spawnMs)/720, 0, 1);

    const leftSec = clamp(s.leftSec||0, 0, 180) / 180;

    // group one-hot
    const gk = String(s.groupKey||'');
    const keys = ['fruit','veg','protein','grain','dairy'];
    const g = keys.map(k=>k===gk?1:0);

    // deltas are approximated using last ring sample (not the same as dl-hooks but ok)
    let dAcc=0, dMiss=0, dCombo=0, dScore=0;
    const last = ring.length ? ring[ring.length-1]._raw : null;
    if (last){
      dAcc   = clamp(((s.accGoodPct||0)-(last.accGoodPct||0))/30, -1, 1);
      dMiss  = clamp(((s.misses||0)-(last.misses||0))/5, -1, 1);
      dCombo = clamp(((s.combo||0)-(last.combo||0))/10, -1, 1);
      dScore = clamp(((s.score||0)-(last.score||0))/400, -1, 1);
    }

    const x = new Array(N).fill(0);

    x[0]=acc;          x[1]=misses;        x[2]=combo;         x[3]=score;
    x[4]=pressure;     x[5]=storm;         x[6]=miniOn;        x[7]=miniGap;
    x[8]=miniLeft;     x[9]=spawnFast;     x[10]=leftSec;

    x[11]= clamp((s.hitGoodForAcc||0)/Math.max(1,(s.totalJudgedForAcc||1)),0,1);
    x[12]= clamp((s.hitGoodForAcc||0)/50,0,1);
    x[13]= clamp((s.totalJudgedForAcc||0)/60,0,1);
    x[14]= clamp((s.powerCharge||0)/Math.max(1,(s.powerThreshold||8)),0,1);
    x[15]= clamp((s.goalPct||0)/100,0,1);

    for(let i=0;i<5;i++) x[16+i]=g[i];

    x[21]= dAcc*0.5+0.5;
    x[22]= dMiss*0.5+0.5;
    x[23]= dCombo*0.5+0.5;
    x[24]= dScore*0.5+0.5;

    x[25]= clamp((s.goalNow||0)/Math.max(1,(s.goalTotal||1)),0,1);
    x[26]= clamp((s.miniCountCleared||0)/Math.max(1,(s.miniCountTotal||1)),0,1);
    x[27]= s.stormUrgent?1:0;
    x[28]= s.clutch?1:0;
    x[29]= (String(s.runMode||'')==='research')?1:0;
    x[30]= (String(s.runMode||'')==='play')?1:0;
    x[31]= (String(s.view||'')==='cvr')?1:0;

    // attach raw for deltas next time
    x._raw = s;
    return x;
  }

  function predict(x){
    let z = B;
    for(let i=0;i<N;i++) z += W[i]*x[i];
    return sigmoid(z);
  }

  function sgdUpdate(x, y){
    // y in {0,1}
    const p = predict(x);
    const err = (p - y);

    // bias
    B -= lr * err;

    // weights with tiny L2
    for(let i=0;i<N;i++){
      W[i] -= lr * (err * x[i] + l2 * W[i]);
    }

    seen++;
    if (y===1) pos++; else neg++;

    // mild lr decay after some samples
    if (seen === 50)  lr = 0.08;
    if (seen === 200) lr = 0.06;
    if (seen === 600) lr = 0.04;
  }

  function emitRisk(risk, why){
    // level mapping
    const r = clamp(risk, 0, 1);
    const level = (r>=0.82)?3 : (r>=0.62)?2 : (r>=0.42)?1 : 0;
    try{
      WIN.dispatchEvent(new CustomEvent('groups:risk', {
        detail:{
          risk:r,
          level,
          reason: String(why||''),
          seen, pos, neg
        }
      }));
    }catch(_){}
  }

  function addRing(tsMs, x, p, tSec){
    ring.push({ tsMs, x, pred:p, tSec, _raw:x._raw });
    if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
  }

  function markRecentPositive(tsMs){
    // any samples within window => y=1
    for(let i=ring.length-1;i>=0;i--){
      const r = ring[i];
      if ((tsMs - r.tsMs) > POS_WINDOW_MS) break;
      sgdUpdate(r.x, 1);
    }
  }

  function markRecentNegative(tsMs){
    // to avoid overfitting positives: teach a little negative on latest sample
    // (only 1 step to keep balance)
    const r = ring.length ? ring[ring.length-1] : null;
    if (!r) return;
    if ((tsMs - r.tsMs) <= 1200) sgdUpdate(r.x, 0);
  }

  // ---------------- wiring ----------------
  WIN.addEventListener('hha:start', (ev)=>{
    const d = ev.detail||{};
    runModeNow = String(d.runMode||'play').toLowerCase();
    active = enabledFor(runModeNow);

    // reset per run (keep weights in-memory for now; if you want persistent later, we add LS)
    ring.length = 0;
    seen = 0; pos = 0; neg = 0;
    // optional: soft reset weights for research purity
    if (!active){
      // do nothing
    }
  }, {passive:true});

  WIN.addEventListener('groups:mltrace', (ev)=>{
    if (!active) return;
    const d = ev.detail||{};

    if (d.kind === 'sample' && d.sample){
      const s = d.sample;
      const x = toXFromSample(s);
      const p = predict(x);

      addRing(nowMs(), x, p, s.tSec||0);

      // emit risk for UI every sample
      // add small “reason” hint
      let why = '';
      if (s.pressure>=2) why = 'pressure';
      else if (s.miniOn && (s.miniTimeLeftSec||0)<=3) why = 'mini_urgent';
      else if (s.storm) why = 'storm';
      else why = 'model';

      emitRisk(p, why);

      // gentle negative update (keeps model stable) when things look okay
      if ((s.pressure||0)===0 && (s.storm?1:0)===0 && (!s.miniOn)){
        // only sometimes
        if (Math.random() < 0.35) markRecentNegative(nowMs());
      }
    }

    if (d.kind === 'event'){
      const e = d.event || {};
      const t = String(d.eventType||e.type||'');
      const ts = nowMs();

      // miss-like events => positive label
      if (t.startsWith('miss') || t==='hit_wrong' || t==='hit_junk'){
        markRecentPositive(ts);
      }
    }
  }, {passive:true});

  // API for debugging
  NS.getMLModel = function(){
    return {
      weights: W.slice(),
      bias: B,
      lr, l2,
      seen, pos, neg
    };
  };

})();