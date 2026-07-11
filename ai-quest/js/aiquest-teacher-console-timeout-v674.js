/* CSAI2102 Teacher Console Fetch Bridge v7.1.3.2
   - one in-flight teacherConsole request shared by legacy/runtime loaders
   - clones Response for every consumer
   - keeps the bounded 45-second wait
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_FETCH_BRIDGE_V7132__)return;
  window.__AIQUEST_TEACHER_FETCH_BRIDGE_V7132__=true;
  const native=window.fetch&&window.fetch.bind(window);
  const inflight=new Map();
  if(native){
    const target=url=>String(url||'').indexOf('script.google.com/macros/')>=0&&/[?&]action=teacherConsole(?:&|$)/.test(String(url||''));
    const keyOf=url=>String(url||'').replace(/([?&])(t|loader)=[^&]*/g,'$1').replace(/[?&]+$/,'').replace('?&','?');
    window.fetch=function(input,init){
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(!target(url))return native(input,init);
      const key=keyOf(url);
      if(!inflight.has(key)){
        const options=Object.assign({},init||{});delete options.signal;
        let timer=null;
        const request=native(input,options);
        const maxWait=new Promise((_,reject)=>{timer=setTimeout(()=>{const err=new Error('Teacher Console timeout after 45 seconds');err.name='AbortError';reject(err)},45000)});
        const shared=Promise.race([request,maxWait]).finally(()=>{clearTimeout(timer);setTimeout(()=>inflight.delete(key),0)});
        inflight.set(key,shared);
      }
      return inflight.get(key).then(response=>response.clone());
    };
  }
  const load=(id,src)=>{if(document.getElementById(id))return;const script=document.createElement('script');script.id=id;script.src=src;document.head.appendChild(script)};
  load('aiquestTeacherS2SkillPanelV675','./js/aiquest-teacher-s2-skill-panel-v675.js?v=20260706-s2skills675');
  load('aiquestTeacherS2ReplayAuditV679','./js/aiquest-teacher-s2-replay-audit-v679.js?v=20260706-replayaudit679');
  load('aiquestTeacherS2ReflectionEvidenceV681','./js/aiquest-teacher-s2-reflection-evidence-v681.js?v=20260706-evidence681');
  console.log('[AIQuest] Teacher Console fetch bridge v7.1.3.2 active');
})();