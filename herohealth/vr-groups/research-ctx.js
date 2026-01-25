// === /herohealth/vr-groups/research-ctx.js ===
// Research Context — PRODUCTION
// ✅ Passthrough important params (studyId, conditionGroup, phase, etc.)
// ✅ Safe: never forces anything; just exposes ctx getter
// ✅ Intended for logging / summary merge

(function(){
  'use strict';
  const WIN = window;
  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }
  function norm(v){ return (v==null) ? '' : String(v); }

  NS.getResearchCtx = function(){
    const run = String(qs('run','play')||'play').toLowerCase();
    const ctx = {
      run: run,
      studyId: norm(qs('studyId','')),
      conditionGroup: norm(qs('conditionGroup','')),
      phase: norm(qs('phase','')),
      participantId: norm(qs('pid','')) || norm(qs('participantId','')),
      sessionId: norm(qs('sid','')) || norm(qs('sessionId','')),
      cohort: norm(qs('cohort','')),
      site: norm(qs('site','')),
    };

    // convenience: research mode flag
    ctx.isResearch = (run === 'research');
    return ctx;
  };

})();