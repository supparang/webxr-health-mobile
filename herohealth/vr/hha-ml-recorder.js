// === /herohealth/vr/hha-ml-recorder.js ===
// HHA ML Recorder — FAIR S1 (Sequence telemetry for offline DL training)
// ✅ Listens: hha:ml:event, hha:ml:tick, hha:start, hha:end
// ✅ Stores sequence in localStorage (ring buffer) per sessionId
// ✅ Attaches compact seq into hha:end.detail.ml_seq_compact (if possible)
// ✅ No inference, no adaptive, no randomness added here

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_ML_RECORDER__) return;
  WIN.__HHA_ML_RECORDER__ = true;

  const MAX_SEQ = 260; // ~80s => ticks/sec ~1 => 80 + events; keep compact
  const LS_PREFIX = 'HHA_ML_SEQ_V1_';

  const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
  const now=()=>performance.now();
  const iso=()=>new Date().toISOString();

  function safeJsonParse(s, d){
    try{ return JSON.parse(s||'') ?? d; }catch(_){ return d; }
  }

  let sessionId = null;
  let projectTag = null;
  let runMode = null;
  let seed = null;
  let view = null;
  let diff = null;

  function key(){
    return sessionId ? (LS_PREFIX + sessionId) : null;
  }

  function loadSeq(){
    const k = key();
    if(!k) return [];
    return safeJsonParse(localStorage.getItem(k), []) || [];
  }

  function saveSeq(seq){
    const k = key();
    if(!k) return;
    try{
      localStorage.setItem(k, JSON.stringify(seq.slice(-MAX_SEQ)));
    }catch(_){}
  }

  function push(rec){
    if(!sessionId) return;
    const seq = loadSeq();
    seq.push(rec);
    saveSeq(seq);
  }

  function onStart(ev){
    const d = ev?.detail || {};
    sessionId = d.sessionId || d.sid || null;
    projectTag = d.projectTag || 'HHA';
    runMode = d.runMode || d.run || 'play';
    seed = d.seed || null;
    view = d.view || d.device || null;
    diff = d.diff || null;

    if(sessionId){
      // reset seq at start (fresh)
      try{ localStorage.removeItem(LS_PREFIX + sessionId); }catch(_){}
      push({ t:0, ty:'start', ts:iso(), run:runMode, diff, view, seed });
    }
  }

  // compact schema:
  // tick: {t, ty:'k', s, m, c, f, sh, st, b, bp, r}
  // hit : {t, ty:'h', k, rt, dm, ds, b, bp, r, st}
  // exp : {t, ty:'x', k:'good', dm:1}
  // boss: {t, ty:'b', on, hp, bp, r}
  function onMlTick(ev){
    const d = ev?.detail || {};
    if(!sessionId) return;
    push({
      t: Math.round(d.t||0),
      ty:'k',
      s: d.score|0,
      m: d.miss|0,
      c: d.combo|0,
      f: Math.round(clamp(d.fever||0,0,100)),
      sh: d.shield|0,
      st: d.storm?1:0,
      b: d.boss?1:0,
      bp: d.bossPhase|0,
      r: d.rage?1:0
    });
  }

  function onMlEvent(ev){
    const d = ev?.detail || {};
    if(!sessionId) return;

    const base = {
      t: Math.round(d.t||0),
      ty: d.ty || 'e'
    };

    // keep only fields we need for offline modeling
    if(d.ty==='h'){ // hit
      push(Object.assign(base, {
        k: d.k || 'good',
        rt: (d.rt==null?null:Math.round(d.rt)),
        dm: d.dm|0,         // delta miss
        ds: d.ds|0,         // delta score
        st: d.storm?1:0,
        b: d.boss?1:0,
        bp: d.bossPhase|0,
        r: d.rage?1:0
      }));
    }else if(d.ty==='x'){ // expire
      push(Object.assign(base, { k:d.k||'good', dm:d.dm|0 }));
    }else if(d.ty==='b'){ // boss state change
      push(Object.assign(base, { on:d.on?1:0, hp:d.hp|0, bp:d.bp|0, r:d.r?1:0 }));
    }else{
      // generic event
      push(Object.assign(base, d));
    }
  }

  function attachToEnd(ev){
    // try attach compact sequence to end detail
    try{
      const d = ev?.detail || {};
      const sid = d.sessionId || sessionId;
      if(!sid) return;
      const seq = safeJsonParse(localStorage.getItem(LS_PREFIX + sid), []) || [];
      // attach as string to avoid structured clone surprises
      d.ml_seq_compact = JSON.stringify(seq.slice(-MAX_SEQ));
      d.ml_meta = {
        ver:'S1',
        maxSeq: MAX_SEQ,
        storedKey: (LS_PREFIX + sid),
        projectTag, runMode, diff, view, seed
      };
    }catch(_){}
  }

  WIN.addEventListener('hha:start', onStart, {passive:true});
  DOC.addEventListener('hha:start', onStart, {passive:true});

  WIN.addEventListener('hha:ml:tick', onMlTick, {passive:true});
  DOC.addEventListener('hha:ml:tick', onMlTick, {passive:true});

  WIN.addEventListener('hha:ml:event', onMlEvent, {passive:true});
  DOC.addEventListener('hha:ml:event', onMlEvent, {passive:true});

  WIN.addEventListener('hha:end', attachToEnd, {passive:true});
  DOC.addEventListener('hha:end', attachToEnd, {passive:true});
})();