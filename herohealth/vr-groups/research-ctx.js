// === /herohealth/vr-groups/research-ctx.js ===
// Research ctx passthrough (HHA Standard-ish)
// Exposes: window.GroupsVR.getResearchCtx()

(function(){
  'use strict';
  const W = window;
  const NS = W.GroupsVR = W.GroupsVR || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function norm(v){
    v = String(v ?? '').trim();
    return v.length ? v : undefined;
  }

  function getCtx(){
    const ctx = {
      studyId: norm(qs('studyId')),
      participantId: norm(qs('pid')) || norm(qs('participantId')),
      phase: norm(qs('phase')),
      conditionGroup: norm(qs('conditionGroup')),
      classId: norm(qs('classId')),
      school: norm(qs('school')),
      teacher: norm(qs('teacher')),
      device: norm(qs('device')),
      platform: norm(qs('platform')),
    };

    // remove undefined
    Object.keys(ctx).forEach(k=> (ctx[k]===undefined) && delete ctx[k]);
    return ctx;
  }

  NS.getResearchCtx = getCtx;
})();