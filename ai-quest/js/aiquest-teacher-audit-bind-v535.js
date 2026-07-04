/* CSAI2102 AI Quest — Teacher Audit Refresh Binder v5.3.5 */
(function(){
  'use strict';
  const VERSION='v5.3.5-audit-refresh-binder';
  function bind(){
    const safe=window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532;
    const audit=window.AIQUEST_TEACHER_AUDIT_V534;
    const button=document.getElementById('refreshBtn');
    if(!safe||!audit||!button)return false;
    button.onclick=async function(){
      await safe.load();
      audit.patch();
    };
    setTimeout(()=>audit.patch(),0);
    return true;
  }
  function start(){
    if(bind())return;
    let tries=0;
    const retry=()=>{if(bind()||++tries>=20)return;setTimeout(retry,150);};
    retry();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0),{once:true});else start();
  window.AIQUEST_TEACHER_AUDIT_BIND_V535={VERSION,bind};
})();