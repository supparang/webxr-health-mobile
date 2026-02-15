// === /herohealth/plate/plate-logger-bridge.js ===
// PlateVR → Cloud Logger Bridge (SAFE) — v1.0 (ML-2)
// Captures: hha:start, hha:end, hha:features_1s, hha:labels, hha:judge
// Sends to: window.HHA_LOGGER / window.HHACloudLogger / window.HHA_CloudLogger (whatever exists)
// Never crashes if logger missing.
//
// Event schema (recommended):
//  - event_type: 'start'|'end'|'features_1s'|'labels'|'judge'|...
//  - game: 'plate'
//  - session_id: stable per run
//  - t_ms / t_sec (relative)
//  - payload: flattened safe subset + raw (optional)

'use strict';

(function(){
  const W = window;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  // ---- session identity (stable per run) ----
  const SID_KEY = 'HHA_PLATE_SESSION_ID_TMP';
  function newSid(){
    return `PLATE_${Date.now()}_${Math.random().toString(16).slice(2,8)}`;
  }
  function getSid(){
    try{
      const s = sessionStorage.getItem(SID_KEY);
      if(s) return s;
      const sid = newSid();
      sessionStorage.setItem(SID_KEY, sid);
      return sid;
    }catch{
      return newSid();
    }
  }
  function resetSid(){
    try{ sessionStorage.setItem(SID_KEY, newSid()); }catch{}
  }

  let SESSION = {
    sid: getSid(),
    t0: now(),
    started:false,
    ended:false,
    lastFeatureTs: 0,
    featureEveryMs: 1000, // rate-limit (1s)
    lastFlushTs: 0
  };

  // ---- find logger (supports multiple globals) ----
  function getLogger(){
    return W.HHA_LOGGER || W.HHACloudLogger || W.HHA_CloudLogger || W.HHACloud || null;
  }

  // ---- flexible logger call adapter ----
  function tryCall(L, fnNames, args){
    for(const fn of fnNames){
      if(L && typeof L[fn] === 'function'){
        try{ return L[fn].apply(L, args); }catch{}
      }
    }
    return null;
  }

  function logEvent(event_type, detail){
    const L = getLogger();

    const t_ms = Math.round(now() - SESSION.t0);
    const t_sec = Math.round(t_ms/100)/10;

    // sanitize a bit (avoid huge nesting)
    const d = detail || {};
    const base = {
      event_type,
      game: 'plate',
      session_id: SESSION.sid,
      t_ms,
      t_sec,
      ts: Date.now()
    };

    // flatten common fields if present (ML-friendly)
    const flat = {};
    if(typeof d.runMode === 'string') flat.runMode = d.runMode;
    if(typeof d.diff === 'string') flat.diff = d.diff;
    if(d.seed != null) flat.seed = Number(d.seed)||0;

    if(d.tPlayedSec != null) flat.tPlayedSec = d.tPlayedSec|0;
    if(d.timeLeftSec != null) flat.timeLeftSec = d.timeLeftSec|0;

    if(d.scoreNow != null) flat.scoreNow = d.scoreNow|0;
    if(d.scoreFinal != null) flat.scoreFinal = d.scoreFinal|0;

    if(d.comboNow != null) flat.comboNow = d.comboNow|0;
    if(d.comboMax != null) flat.comboMax = d.comboMax|0;

    if(d.missNow != null) flat.missNow = d.missNow|0;
    if(d.miss != null) flat.miss = d.miss|0;

    if(d.accNowPct != null) flat.accNowPct = Number(d.accNowPct)||0;
    if(d.accuracyPct != null) flat.accuracyPct = Number(d.accuracyPct)||0;

    if(typeof d.grade === 'string') flat.grade = d.grade;

    // vector fields
    if(Array.isArray(d.g) && d.g.length === 5){
      flat.g1 = d.g[0]|0; flat.g2 = d.g[1]|0; flat.g3 = d.g[2]|0; flat.g4 = d.g[3]|0; flat.g5 = d.g[4]|0;
    }else{
      if(d.g1!=null) flat.g1=d.g1|0;
      if(d.g2!=null) flat.g2=d.g2|0;
      if(d.g3!=null) flat.g3=d.g3|0;
      if(d.g4!=null) flat.g4=d.g4|0;
      if(d.g5!=null) flat.g5=d.g5|0;
    }

    if(d.groupImbalance01 != null) flat.groupImbalance01 = Number(d.groupImbalance01)||0;
    if(d.targetDensity != null) flat.targetDensity = Number(d.targetDensity)||0;
    if(d.spawnRatePerSec != null) flat.spawnRatePerSec = Number(d.spawnRatePerSec)||0;

    if(d.stormActive != null) flat.stormActive = d.stormActive ? 1 : 0;
    if(d.bossActive != null) flat.bossActive = d.bossActive ? 1 : 0;

    // Build final event record
    const record = Object.assign({}, base, flat, {
      // keep raw but bounded
      raw: d
    });

    // If no logger, fail silently (or console in debug)
    if(!L){
      if(/\bdebug=1\b/.test(location.search)){
        console.log('[PlateBridge] no logger, event=', event_type, record);
      }
      return;
    }

    // Try common APIs
    // 1) logEvent(type, payload)
    const r1 = tryCall(L, ['logEvent','event','pushEvent','addEvent'], [event_type, record]);
    if(r1 != null) return;

    // 2) log(payload) style
    const r2 = tryCall(L, ['log','push','add','track'], [record]);
    if(r2 != null) return;

    // 3) fallback: emit a custom event that logger might listen to
    try{
      W.dispatchEvent(new CustomEvent('hha:log', { detail: record }));
    }catch{}
  }

  async function flush(reason){
    const L = getLogger();
    if(!L) return;

    // rate-limit flush
    const t = Date.now();
    if(t - (SESSION.lastFlushTs||0) < 350) return;
    SESSION.lastFlushTs = t;

    const out =
      tryCall(L, ['flush','flushNow','flushAll'], [reason || 'flush']) ||
      tryCall(L, ['commit','sync'], [{ reason: reason||'flush' }]);

    // support promise
    try{
      if(out && typeof out.then === 'function'){
        await Promise.race([ out, new Promise(res=>setTimeout(res, 650)) ]);
      }
    }catch{}
  }

  // ---- capture events ----
  function onStart(e){
    SESSION.started = true;
    SESSION.ended = false;
    SESSION.t0 = now();

    // reset sid every new run start
    resetSid();
    SESSION.sid = getSid();

    logEvent('start', e?.detail || {});
  }

  function onEnd(e){
    SESSION.ended = true;
    logEvent('end', e?.detail || {});
    flush('end');
  }

  function onLabels(e){
    logEvent('labels', e?.detail || {});
  }

  function onJudge(e){
    // judge can be noisy but useful for sequence models
    logEvent('judge', e?.detail || {});
  }

  function onFeatures(e){
    // rate-limit
    const t = Date.now();
    if(t - (SESSION.lastFeatureTs||0) < SESSION.featureEveryMs - 10) return;
    SESSION.lastFeatureTs = t;

    logEvent('features_1s', e?.detail || {});
  }

  W.addEventListener('hha:start', onStart, { passive:true });
  W.addEventListener('hha:end', onEnd, { passive:true });
  W.addEventListener('hha:labels', onLabels, { passive:true });
  W.addEventListener('hha:judge', onJudge, { passive:true });
  W.addEventListener('hha:features_1s', onFeatures, { passive:true });

  // harden flush on exit paths
  W.addEventListener('beforeunload', ()=>{ try{ flush('beforeunload'); }catch{} });
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) try{ flush('hidden'); }catch{} }, {passive:true});
  W.addEventListener('pagehide', ()=>{ try{ flush('pagehide'); }catch{} }, {passive:true});

})();
