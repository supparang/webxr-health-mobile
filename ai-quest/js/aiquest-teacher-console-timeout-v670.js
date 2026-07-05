/* CSAI2102 Teacher Console Sheets timeout bridge v6.7.2
   Extends Sheets read time and loads safe post-render helpers. */
(()=>{'use strict';
  const nativeFetch=window.fetch&&window.fetch.bind(window);
  if(!nativeFetch||window.__AIQUEST_TEACHER_TIMEOUT_V670__)return;
  window.__AIQUEST_TEACHER_TIMEOUT_V670__=true;
  const isTeacherConsole=url=>{
    const text=String(url||'');
    return text.indexOf('script.google.com/macros/')>=0 && /[?&]action=teacherConsole(?:&|$)/.test(text);
  };
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!isTeacherConsole(url))return nativeFetch(input,init);
    const options=Object.assign({},init||{});delete options.signal;
    let timer=null;const request=nativeFetch(input,options);
    const ceiling=new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new Error('Teacher Console timeout after 45 seconds');error.name='AbortError';reject(error);},45000);});
    return Promise.race([request,ceiling]).finally(()=>clearTimeout(timer));
  };
  const script=(id,src)=>{if(document.getElementById(id))return;const el=document.createElement('script');el.id=id;el.src=src;document.head.appendChild(el);};
  const loadHelpers=()=>{
    script('aiquestTeacherReflectionAuditV671','./js/aiquest-teacher-reflection-audit-v671.js?v=20260705-reflect-audit672');
    script('aiquestTeacherViewRecoveryV672','./js/aiquest-teacher-view-recovery-v672.js?v=20260705-view672');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadHelpers,{once:true});else loadHelpers();
  console.log('[AIQuest] Teacher Console timeout and View recovery active');
})();