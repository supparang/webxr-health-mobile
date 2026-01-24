/* === /herohealth/vr/ai-dataset.js ===
AI Dataset Collector (GroupsVR) — PRODUCTION SAFE
✅ Enabled only when: run=play AND ?ai=1 AND ?aidata=1
✅ Auto-disabled in research/practice
✅ Collects feature snapshots + delayed labels:
   - yMiss5s: miss occurs within next 5s
   - yMiniFail: mini fails when mini ends (only when mini active)
✅ Export: window.HHA_AI_DATASET.exportJSON()
*/

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!WIN || !DOC) return;
  if(WIN.__HHA_AI_DATASET_LOADED__) return;
  WIN.__HHA_AI_DATASET_LOADED__ = true;

  const qs=(k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const run = String(qs('run','play')||'play').toLowerCase();
  const enabled = (run==='play' && qs('ai','0')==='1' && qs('aidata','0')==='1');
  if(!enabled) return;

  const nowMs=()=> (WIN.performance && performance.now) ? performance.now() : Date.now();
  const clamp=(v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  // rolling event log
  const E = []; // {t, type}
  function pushEvt(type){
    const t = nowMs();
    E.push({t, type});
    // prune older than 20s
    const cut = t - 20000;
    while(E.length && E[0].t < cut) E.shift();
  }
  function hasEvtBetween(type, t0, t1){
    for(const e of E){
      if(e.t < t0) continue;
      if(e.t > t1) break;
      if(e.type === type) return true;
    }
    return false;
  }

  // dataset rows
  const rows = []; // {t, x:[...], yMiss5s, yMiniFail, meta:{}}
  const pending = []; // {t, x, meta} -> label later

  // current features (from ai-hooks signals + engine events)
  const F = {
    left:0, score:0, combo:0, misses:0,
    acc:0, pressure:0,
    miniOn:false, miniNeed:0, miniNow:0, miniForbidJunk:false,
    bad10s:0, miss10s:0, judged10s:0
  };

  // listen to existing signals
  WIN.addEventListener('hha:score', (ev)=>{
    const d=ev.detail||{};
    F.score=Number(d.score)||0;
    F.combo=Number(d.combo)||0;
    F.misses=Number(d.misses)||0;
  }, {passive:true});

  WIN.addEventListener('hha:time', (ev)=>{
    const d=ev.detail||{};
    F.left=Number(d.left)||0;
  }, {passive:true});

  WIN.addEventListener('hha:rank', (ev)=>{
    const d=ev.detail||{};
    F.acc = clamp((Number(d.accuracy)||0)/100, 0, 1);
  }, {passive:true});

  WIN.addEventListener('groups:progress', (ev)=>{
    const d=ev.detail||{};
    if(d.kind==='miss') pushEvt('miss');
    if(d.kind==='pressure') F.pressure = Number(d.level)||0;
    if(d.kind==='storm_on') pushEvt('storm_on');
    if(d.kind==='storm_off') pushEvt('storm_off');
    if(d.kind==='boss_spawn') pushEvt('boss_spawn');
    if(d.kind==='boss_down') pushEvt('boss_down');
  }, {passive:true});

  WIN.addEventListener('hha:judge', (ev)=>{
    const d=ev.detail||{};
    if(d.kind==='good') pushEvt('goodHit');
    else if(d.kind==='bad') pushEvt('badHit');
    else if(d.kind==='miss') pushEvt('miss'); // crosshair miss signal
  }, {passive:true});

  WIN.addEventListener('quest:update', (ev)=>{
    const d=ev.detail||{};
    const miniOn = (typeof d.miniTitle==='string') && d.miniTitle!=='—' && (Number(d.miniTotal)||0)>1;
    F.miniOn = !!miniOn;
    F.miniNeed = Number(d.miniTotal)||0;
    F.miniNow  = Number(d.miniNow)||0;
    F.miniForbidJunk = String(d.miniTitle||'').includes('ห้ามโดนขยะ');
  }, {passive:true});

  // if ai-hooks already emits pred, we use it (optional)
  WIN.addEventListener('groups:ai:pred', (ev)=>{
    const d=ev.detail||{};
    // lightweight proxy features
    // keep last risk + can derive bad window stats later if you wish
    // (not mandatory)
  }, {passive:true});

  // window stats (10s)
  function windowStats(){
    const t=nowMs();
    const t0=t-10000;
    let good=0, bad=0, miss=0;
    for(const e of E){
      if(e.t < t0) continue;
      if(e.type==='goodHit') good++;
      else if(e.type==='badHit') bad++;
      else if(e.type==='miss') miss++;
    }
    const judged = good+bad+miss;
    const badRate = judged>0 ? (bad+miss)/judged : 0;
    const missRate= judged>0 ? miss/judged : 0;
    return {badRate, missRate, judged};
  }

  // snapshot -> x vector (normalized)
  function makeX(){
    const W = windowStats();
    F.bad10s = W.badRate;
    F.miss10s= W.missRate;
    F.judged10s = W.judged;

    const comboN = clamp(F.combo/14, 0, 1);
    const missN  = clamp(F.misses/16, 0, 1);
    const pressN = clamp(F.pressure/3, 0, 1);
    const miniN  = F.miniOn ? 1 : 0;
    const miniGap= F.miniOn ? clamp((F.miniNeed - F.miniNow)/Math.max(1,F.miniNeed), 0, 1) : 0;

    return [
      clamp(F.acc,0,1),
      clamp(W.badRate,0,1),
      clamp(W.missRate,0,1),
      comboN,
      missN,
      pressN,
      miniN,
      miniGap,
      F.miniForbidJunk ? 1 : 0
    ];
  }

  // sampling loop
  const H = 5000; // label horizon for miss (5s)
  let lastSampleAt = 0;
  let lastMiniState = false;

  function tick(){
    const t = nowMs();
    if(t - lastSampleAt >= 1000){
      lastSampleAt = t;
      const x = makeX();
      pending.push({
        t,
        x,
        meta:{
          seed:String(qs('seed','')),
          diff:String(qs('diff','normal')),
          view:String(qs('view','')),
          left:F.left|0
        }
      });
    }

    // resolve pending labels whose horizon passed
    for(let i=pending.length-1;i>=0;i--){
      const p = pending[i];
      if(t >= p.t + H){
        const yMiss5s = hasEvtBetween('miss', p.t, p.t + H) ? 1 : 0;

        rows.push({
          t: p.t,
          x: p.x,
          yMiss5s,
          yMiniFail: null, // filled later when mini ends (if it was active)
          meta: p.meta
        });

        pending.splice(i,1);
      }
    }

    // mini end label (detect falling edge)
    if(lastMiniState && !F.miniOn){
      // mini just ended — determine success/fail from near-term signals
      // heuristic: if within last 1s we saw "badHit" a lot OR miss spike, tag as fail
      const t1 = t;
      const t0 = t - 1200;
      const fail = hasEvtBetween('miss', t0, t1) || hasEvtBetween('badHit', t0, t1);
      // back-fill the last few rows that were during mini
      for(let k=rows.length-1, c=0; k>=0 && c<8; k--, c++){
        if(rows[k].yMiniFail!==null) break;
        // if row meta says miniOn at that time? (we didn't store it; so approximate by recent rows)
        rows[k].yMiniFail = fail ? 1 : 0;
      }
    }
    lastMiniState = !!F.miniOn;

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  // export API
  WIN.HHA_AI_DATASET = {
    rows,
    exportJSON(){
      const payload = {
        schema:'HHA_AI_DATASET_v1',
        createdAt: new Date().toISOString(),
        game:'GroupsVR',
        horizonMs:H,
        features:['acc','bad10s','miss10s','comboN','missesN','pressureN','miniOn','miniGap','miniForbidJunk'],
        labels:['yMiss5s','yMiniFail'],
        rows
      };
      const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
      const a = DOC.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `groups-ai-dataset_${Date.now()}.json`;
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(_){} }, 250);
    }
  };

})();