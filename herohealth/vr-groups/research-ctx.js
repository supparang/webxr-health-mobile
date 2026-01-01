/* === /herohealth/vr-groups/research-ctx.js ===
Build standardized research context from query string.
Expose: window.GroupsVR.getResearchCtx()
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  function qs(k, def=''){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function n(v, def=0){
    v = Number(v);
    return Number.isFinite(v) ? v : def;
  }

  function getResearchCtx(){
    // Common research fields (ถ้ามีในลิงก์ launcher/hub จะ passthrough มาเอง)
    const ctx = {
      studyId: qs('study','') || qs('studyId',''),
      phase: qs('phase',''),
      conditionGroup: qs('cg','') || qs('conditionGroup',''),
      sessionOrder: qs('order','') || qs('sessionOrder',''),
      blockLabel: qs('block','') || qs('blockLabel',''),
      siteCode: qs('site','') || qs('siteCode',''),
      schoolCode: qs('school','') || qs('schoolCode',''),
      studentKey: qs('student','') || qs('studentKey',''),

      // optional
      schoolYear: qs('sy','') || qs('schoolYear',''),
      semester: qs('sem','') || qs('semester',''),
      classRoom: qs('room','') || qs('classRoom',''),
      studentNo: qs('no','') || qs('studentNo',''),
      nickName: qs('nick','') || qs('nickName',''),
      gender: qs('gender',''),
      age: n(qs('age',''), null),
      gradeLevel: qs('grade','') || qs('gradeLevel',''),

      // device hints
      device: qs('device',''), // ถ้าอยากส่งเอง
      handedness: qs('hand','') || qs('handedness',''),
      visionIssue: qs('vision','') || qs('visionIssue',''),
      vrExperience: qs('vr','') || qs('vrExperience',''),
      gameFrequency: qs('freq','') || qs('gameFrequency','')
    };

    // ล้างคีย์ว่างมาก ๆ
    Object.keys(ctx).forEach(k=>{
      if (ctx[k] === '' || ctx[k] === undefined) delete ctx[k];
    });
    return ctx;
  }

  NS.getResearchCtx = getResearchCtx;

})(typeof window !== 'undefined' ? window : globalThis);