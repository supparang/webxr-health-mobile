/* === /herohealth/vr-groups/research-ctx.js ===
Research Context — PRODUCTION
✅ getResearchCtx() reads url params (studyId, phase, conditionGroup, sessionOrder, blockLabel, siteCode, schoolCode, etc.)
✅ Does not assume any param exists (safe)
*/

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  function qsAll(){
    try { return new URL(location.href).searchParams; }
    catch { return new URLSearchParams(); }
  }

  function pick(params, key, def=''){
    const v = params.get(key);
    return (v == null) ? def : String(v);
  }

  function pickNum(params, key, def=0){
    const v = params.get(key);
    const n = Number(v);
    return isFinite(n) ? n : def;
  }

  function getResearchCtx(){
    const p = qsAll();

    // ✅ core research keys (match sheet schema if you want)
    const ctx = {
      runMode: pick(p,'run','play'),
      studyId: pick(p,'studyId',''),
      phase: pick(p,'phase',''),
      conditionGroup: pick(p,'conditionGroup',''),
      sessionOrder: pick(p,'sessionOrder',''),
      blockLabel: pick(p,'blockLabel',''),

      siteCode: pick(p,'siteCode',''),
      schoolYear: pick(p,'schoolYear',''),
      semester: pick(p,'semester',''),

      studentKey: pick(p,'studentKey',''),
      schoolCode: pick(p,'schoolCode',''),
      schoolName: pick(p,'schoolName',''),
      classRoom: pick(p,'classRoom',''),
      studentNo: pick(p,'studentNo',''),
      nickName: pick(p,'nickName',''),

      gender: pick(p,'gender',''),
      age: pickNum(p,'age',0),
      gradeLevel: pick(p,'gradeLevel',''),

      vrExperience: pick(p,'vrExperience',''),
      gameFrequency: pick(p,'gameFrequency',''),
      handedness: pick(p,'handedness',''),
      visionIssue: pick(p,'visionIssue',''),
      healthDetail: pick(p,'healthDetail',''),
      consentParent: pick(p,'consentParent','')
    };

    return ctx;
  }

  NS.getResearchCtx = getResearchCtx;

})(typeof window !== 'undefined' ? window : globalThis);