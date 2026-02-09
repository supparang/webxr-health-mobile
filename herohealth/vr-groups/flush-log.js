// === /herohealth/vr-groups/flush-log.js ===
// GroupsVR Flush Log — PRODUCTION (PATCH v20260208c)
// ✅ Flush-hardened: pagehide / beforeunload / visibilitychange(hidden)
// ✅ Also flush on hha:end (immediate) + tiny retry
// ✅ Safe no-op if GroupsVR.Telemetry missing
// ✅ Exposes: window.GroupsVR.FlushLog.bind(getSummaryFn)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};

  const S = {
    bound:false,
    lastFlushAt:0,
    lastReason:'',
    lastSummary:null
  };

  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function safeGetTelemetry(){
    try{
      const T = WIN.GroupsVR && WIN.GroupsVR.Telemetry;
      if (T && typeof T.flush === 'function') return T;
    }catch(_){}
    return null;
  }

  function safeCall(fn){
    try{ return fn(); }catch(_){ return null; }
  }

  function normalizeSummary(s){
    // keep it small + consistent
    if (!s || typeof s !== 'object') return null;

    const out = {};
    // allowlist common keys (don’t bloat)
    const keys = [
      'timestampIso','projectTag','gameTag','runMode','diff','style','view',
      'durationPlannedSec','startTimeIso','endTimeIso','seed',
      'reason','scoreFinal','miss','misses','shots','goodShots',
      'accuracyPct','accuracyGoodPct','grade','comboMax','maxCombo',
      'miniCleared','bossCleared',
      'pid','studyId','phase','conditionGroup','siteCode','schoolYear','semester','hub'
    ];
    for (const k of keys){
      if (k in s) out[k] = s[k];
    }

    // normalize some aliases
    if (out.miss == null && out.misses != null) out.miss = out.misses;
    if (out.accuracyPct == null && out.accuracyGoodPct != null) out.accuracyPct = out.accuracyGoodPct;
    if (out.comboMax == null && out.maxCombo != null) out.comboMax = out.maxCombo;

    return out;
  }

  function flush(reason, getSummaryFn){
    const t = nowMs();
    if ((t - S.lastFlushAt) < 220 && reason === S.lastReason) return false;
    S.lastFlushAt = t;
    S.lastReason = String(reason||'');

    const T = safeGetTelemetry();
    if (!T) return false;

    const summaryRaw = safeCall(()=> getSummaryFn ? getSummaryFn() : null);
    const summary = normalizeSummary(summaryRaw);
    S.lastSummary = summary;

    // telemetry.flush may accept summary; if not, it will ignore
    safeCall(()=> T.flush(summary));

    return true;
  }

  function bind(getSummaryFn){
    if (S.bound) return true;
    S.bound = true;

    // 1) pagehide — best for mobile/iOS
    WIN.addEventListener('pagehide', ()=>{
      flush('pagehide', getSummaryFn);
      // micro retry (some browsers drop the first async batch)
      setTimeout(()=>flush('pagehide_retry', getSummaryFn), 80);
    }, { passive:true });

    // 2) beforeunload — desktop fallback
    WIN.addEventListener('beforeunload', ()=>{
      flush('beforeunload', getSummaryFn);
    });

    // 3) visibilitychange — when app goes background
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden'){
        flush('hidden', getSummaryFn);
        setTimeout(()=>flush('hidden_retry', getSummaryFn), 120);
      }
    }, { passive:true });

    // 4) immediate on end — ensures final batch contains end summary
    WIN.addEventListener('hha:end', ()=>{
      flush('hha:end', getSummaryFn);
      // retry once after a short delay in case end overlay triggers navigation quickly
      setTimeout(()=>flush('hha:end_retry', getSummaryFn), 140);
    }, { passive:true });

    return true;
  }

  WIN.GroupsVR.FlushLog = { bind };

})();