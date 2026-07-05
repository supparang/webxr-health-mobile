/* UX Quest • Required Profile Gate v1
   Blocks mission start in classroom mode until learner ID, name and section are saved. */
(()=>{'use strict';
  let opening=false;
  const required=()=>String(window.UXQ_CLASSROOM_CONFIG?.classroomMode||'').toLowerCase()==='required';
  const complete=()=>{
    const api=window.UXQIdentity;
    try{return Boolean(api?.isComplete?.(api.get?.()));}catch(e){return false;}
  };
  const waitForIdentity=()=>new Promise(resolve=>{
    let tries=0;
    const timer=setInterval(()=>{tries++;if(window.UXQIdentity||tries>40){clearInterval(timer);resolve(window.UXQIdentity||null);}},25);
  });
  document.addEventListener('click',async event=>{
    const start=event.target instanceof Element?event.target.closest('#uxqStart'):null;
    if(!start||!required()||complete())return;
    event.preventDefault();event.stopImmediatePropagation();
    if(opening)return;
    opening=true;
    const api=window.UXQIdentity||await waitForIdentity();
    if(!api?.open){opening=false;return;}
    const profile=await api.open({title:'ก่อนเริ่มภารกิจ: ระบุตัวตนผู้เรียน'});
    opening=false;
    if(api.isComplete?.(profile))window.setTimeout(()=>start.click(),0);
  },true);
  window.UXQProfileRequiredGate=Object.freeze({version:'v1'});
})();