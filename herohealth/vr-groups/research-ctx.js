/* === /herohealth/vr-groups/research-ctx.js ===
Research Context — HHA Standard-ish
✅ getResearchCtx()
Reads: studyId, conditionGroup, phase, participantId, sessionId, run, diff, seed
*/
(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  NS.getResearchCtx = function(){
    const ctx = {
      studyId: String(qs('studyId','')||''),
      conditionGroup: String(qs('conditionGroup','')||''),
      phase: String(qs('phase','')||''),
      participantId: String(qs('participantId','')||''),
      sessionId: String(qs('sessionId','')||''),
      runMode: String(qs('run','play')||'play'),
      diff: String(qs('diff','normal')||'normal'),
      seed: String(qs('seed','')||'')
    };
    return ctx;
  };
})(typeof window!=='undefined' ? window : globalThis);