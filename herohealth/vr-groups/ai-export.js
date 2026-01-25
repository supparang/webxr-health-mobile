// === /herohealth/vr-groups/ai-export.js ===
// AI Export Buffer (Local-first)
// ✅ Collects groups:ai_feature / groups:ai_choice / groups:ai_dd
// ✅ Stores to localStorage: HHA_AI_LOG_HISTORY (cap 50)
// ✅ Attaches into HHA_LAST_SUMMARY on hha:end (if available)
// ✅ Play only (recommended) but safe to load always

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  const LS_AI_HIST = 'HHA_AI_LOG_HISTORY'; // array of runs (most recent first)
  const LS_AI_LAST = 'HHA_AI_LOG_LAST';    // single latest run

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowIso = ()=> new Date().toISOString();

  function safeParse(s, def){
    try{ return JSON.parse(s); }catch{ return def; }
  }
  function safeSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
  function safeGet(k,def){ try{ return safeParse(localStorage.getItem(k)||'', def); }catch{ return def; } }

  const BUF = {
    on:false,
    runId:'',
    startedIso:'',
    events:[],      // {tMs, type, ...payload}
    cap: 900        // cap events per run
  };

  function pushEv(type, payload){
    if(!BUF.on) return;
    const tMs = (root.performance && performance.now) ? Math.round(performance.now()) : Date.now();
    const ev = Object.assign({ tMs, type }, payload||{});
    BUF.events.push(ev);
    if(BUF.events.length > BUF.cap) BUF.events.shift();
  }

  function start(runId){
    BUF.on = true;
    BUF.runId = String(runId || ('groups-' + Date.now()));
    BUF.startedIso = nowIso();
    BUF.events = [];
    pushEv('meta', { startedIso: BUF.startedIso, runId: BUF.runId });
  }

  function stop(){
    BUF.on = false;
  }

  function snapshot(){
    return {
      runId: BUF.runId,
      startedIso: BUF.startedIso,
      endedIso: nowIso(),
      n: BUF.events.length,
      events: BUF.events.slice(0)
    };
  }

  function commit(runSummary){
    const pack = snapshot();

    // attach summary light
    pack.summary = Object.assign({}, runSummary||{});

    // save last + history
    safeSet(LS_AI_LAST, pack);
    const hist = safeGet(LS_AI_HIST, []);
    hist.unshift(pack);
    safeSet(LS_AI_HIST, hist.slice(0, 50));

    // broadcast
    try{
      root.dispatchEvent(new CustomEvent('groups:ai_export_ready', { detail: pack }));
    }catch(_){}
  }

  // -------- event listeners --------
  function onFeature(ev){ pushEv('feature', ev.detail||{}); }
  function onChoice(ev){ pushEv('choice',  ev.detail||{}); }
  function onDD(ev){     pushEv('dd',      ev.detail||{}); }

  root.addEventListener('groups:ai_feature', onFeature, {passive:true});
  root.addEventListener('groups:ai_choice',  onChoice,  {passive:true});
  root.addEventListener('groups:ai_dd',      onDD,      {passive:true});

  // When game ends: commit AI log + try attach into last summary
  root.addEventListener('hha:end', (ev)=>{
    const d = ev.detail || {};
    // commit AI regardless of mode if BUF.on
    if(BUF.on){
      commit({
        gameTag:'GroupsVR',
        runMode: d.runMode,
        diff: d.diff,
        seed: d.seed,
        scoreFinal: d.scoreFinal,
        grade: d.grade,
        accuracyGoodPct: d.accuracyGoodPct,
        misses: d.misses
      });
    }

    // also try attach into HHA_LAST_SUMMARY (if exists)
    try{
      const LS_LAST = 'HHA_LAST_SUMMARY';
      const last = safeGet(LS_LAST, null);
      const lastAI = safeGet(LS_AI_LAST, null);
      if(last && lastAI){
        last.aiLog = {
          runId: lastAI.runId,
          startedIso: lastAI.startedIso,
          endedIso: lastAI.endedIso,
          n: lastAI.n
        };
        safeSet(LS_LAST, last);
      }
    }catch(_){}
  }, {passive:true});

  // Export API
  NS.AIExport = {
    start,
    stop,
    snapshot,
    getLast: ()=> safeGet(LS_AI_LAST, null),
    getHistory: ()=> safeGet(LS_AI_HIST, []),
    reset: ()=>{
      safeSet(LS_AI_LAST, null);
      safeSet(LS_AI_HIST, []);
    }
  };

})(typeof window!=='undefined'?window:globalThis);