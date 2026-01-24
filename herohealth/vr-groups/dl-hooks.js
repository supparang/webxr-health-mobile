// === /herohealth/vr-groups/dl-hooks.js ===
// DL Dataset Builder (online) — SAFE
// ✅ Builds dl.rows: [{tSec,label,f0..f31}] for deep learning training
// ✅ Label strategy (delayed):
//    - each sample starts label=0
//    - if a miss-like event occurs, mark recent samples within 2.5s as label=1
// ✅ Enabled:
//    - run=research => ON automatically
//    - run=play => ON only when ?dl=1 (or ?dl=true)
// ✅ Produces: window.GroupsVR.getDL() => { columns, rows }

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));

  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});
  let enabled = false;

  // dataset
  const COLS = (()=>{
    const cols = ['tSec','label'];
    for(let i=0;i<32;i++) cols.push('f'+i);
    return cols;
  })();

  const rows = []; // {tSec,label,f0..f31, _tsMs}
  let lastSample = null;

  function isEnabled(runMode){
    runMode = String(runMode||'play').toLowerCase();
    if (runMode === 'research') return true;
    if (runMode === 'practice') return false;
    const dl = String(qs('dl','0')||'0').toLowerCase();
    return (dl==='1' || dl==='true' || dl==='yes');
  }

  function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  function oneHotGroup(key){
    // groups in engine: fruit, veg, protein, grain, dairy
    const keys = ['fruit','veg','protein','grain','dairy'];
    return keys.map(k=> (k===key ? 1 : 0));
  }

  function buildFeatures(s){
    // Normalize/scale lightly to 0..1-ish
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

    // deltas (vs last sample)
    let dAcc=0, dMiss=0, dCombo=0, dScore=0;
    if (lastSample){
      dAcc   = clamp(((s.accGoodPct||0)-(lastSample.accGoodPct||0))/30, -1, 1); // -1..1
      dMiss  = clamp(((s.misses||0)-(lastSample.misses||0))/5, -1, 1);
      dCombo = clamp(((s.combo||0)-(lastSample.combo||0))/10, -1, 1);
      dScore = clamp(((s.score||0)-(lastSample.score||0))/400, -1, 1);
    }

    const g = oneHotGroup(String(s.groupKey||''));

    // 32 features total:
    // 0..15 core
    // 16..20 one-hot group
    // 21..31 reserved / extra stats
    const f = new Array(32).fill(0);

    f[0]=acc;          f[1]=misses;        f[2]=combo;         f[3]=score;
    f[4]=pressure;     f[5]=storm;         f[6]=miniOn;        f[7]=miniGap;
    f[8]=miniLeft;     f[9]=spawnFast;     f[10]=leftSec;

    f[11]= (s.hitGoodForAcc||0) / Math.max(1,(s.totalJudgedForAcc||1)); // same as acc but stable
    f[12]= clamp((s.hitGoodForAcc||0)/50,0,1);
    f[13]= clamp((s.totalJudgedForAcc||0)/60,0,1);
    f[14]= clamp((s.powerCharge||0)/Math.max(1,(s.powerThreshold||8)),0,1);
    f[15]= clamp((s.goalPct||0)/100,0,1);

    // group one-hot 5 dims -> f16..f20
    for(let i=0;i<5;i++) f[16+i]=g[i];

    // deltas -> f21..f24 (shifted to 0..1 by *0.5+0.5)
    f[21]= dAcc*0.5+0.5;
    f[22]= dMiss*0.5+0.5;
    f[23]= dCombo*0.5+0.5;
    f[24]= dScore*0.5+0.5;

    // extras
    f[25]= clamp((s.goalNow||0)/Math.max(1,(s.goalTotal||1)),0,1);
    f[26]= clamp((s.miniCountCleared||0)/Math.max(1,(s.miniCountTotal||1)),0,1);
    f[27]= clamp((s.stormUrgent?1:0),0,1);
    f[28]= clamp((s.clutch?1:0),0,1);
    f[29]= clamp((s.runMode==='research'?1:0),0,1);
    f[30]= clamp((s.runMode==='play'?1:0),0,1);
    f[31]= clamp((s.view==='cvr'?1:0),0,1);

    return f;
  }

  function pushRow(sample){
    const tSec = Number(sample.tSec||0);
    const ts = nowMs();
    const f = buildFeatures(sample);

    const row = { tSec, label: 0, _tsMs: ts };
    for(let i=0;i<32;i++) row['f'+i] = f[i];

    rows.push(row);
    // keep dataset not too huge in play (but research can be longer)
    if (rows.length > 4000) rows.splice(0, rows.length-4000);

    lastSample = sample;
  }

  function markRecentAsPositive(windowMs){
    const t = nowMs();
    for(let i=rows.length-1;i>=0;i--){
      const r = rows[i];
      if (!r || (t - r._tsMs) > windowMs) break;
      r.label = 1;
    }
  }

  function finalize(){
    // nothing required; labels default 0 already
    // strip internal field later on export
  }

  // API
  NS.getDL = function(){
    const outRows = rows.map(r=>{
      const o = { tSec:r.tSec, label:r.label };
      for(let i=0;i<32;i++) o['f'+i] = r['f'+i];
      return o;
    });
    return { columns: COLS.slice(), rows: outRows };
  };

  // wire
  WIN.addEventListener('hha:start', (ev)=>{
    const d = ev.detail||{};
    enabled = isEnabled(d.runMode);
    rows.length = 0;
    lastSample = null;
  }, {passive:true});

  WIN.addEventListener('groups:mltrace', (ev)=>{
    if (!enabled) return;
    const d = ev.detail||{};
    if (d.kind === 'sample' && d.sample){
      pushRow(d.sample);
    }
    // mark positives on miss-like events
    if (d.kind === 'event'){
      const t = String(d.eventType||'');
      if (t.startsWith('miss') || t==='hit_wrong' || t==='hit_junk'){
        markRecentAsPositive(2500); // last ~2.5s are positive
      }
    }
  }, {passive:true});

  WIN.addEventListener('hha:end', ()=>{
    if (!enabled) return;
    finalize();
  }, {passive:true});

})();