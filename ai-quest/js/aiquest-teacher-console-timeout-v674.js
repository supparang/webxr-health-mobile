/* CSAI2102 Teacher Console Fetch Bridge v6.8.1 */
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_FETCH_BRIDGE_V681__)return;
  window.__AIQUEST_TEACHER_FETCH_BRIDGE_V681__=true;
  const native=window.fetch&&window.fetch.bind(window);
  if(native){
    const target=url=>String(url||'').indexOf('script.google.com/macros/')>=0&&/[?&]action=teacherConsole(?:&|$)/.test(String(url||''));
    window.fetch=function(input,init){
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(!target(url))return native(input,init);
      const options=Object.assign({},init||{});delete options.signal;
      let timer=null;
      const request=native(input,options);
      const maxWait=new Promise((_,reject)=>{timer=setTimeout(()=>{const err=new Error('Teacher Console timeout after 45 seconds');err.name='AbortError';reject(err)},45000)});
      return Promise.race([request,maxWait]).finally(()=>clearTimeout(timer));
    };
  }
  const load=(id,src)=>{if(document.getElementById(id))return;const script=document.createElement('script');script.id=id;script.src=src;document.head.appendChild(script)};
  load('aiquestTeacherS2SkillPanelV675','./js/aiquest-teacher-s2-skill-panel-v675.js?v=20260706-s2skills675');
  load('aiquestTeacherS2ReplayAuditV679','./js/aiquest-teacher-s2-replay-audit-v679.js?v=20260706-replayaudit679');
  load('aiquestTeacherS2ReflectionEvidenceV681','./js/aiquest-teacher-s2-reflection-evidence-v681.js?v=20260706-evidence681');
  console.log('[AIQuest] Teacher Console fetch bridge v6.8.1 active');
})();