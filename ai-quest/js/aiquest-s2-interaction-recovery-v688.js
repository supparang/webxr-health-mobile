/* CSAI2102 S2 Interaction Recovery v6.8.8
   - Retries a lost answer/check event once only when the engine did not render feedback.
   - Makes the next-step state explicit after an answer is processed.
   - Never advances a question without the original engine marking the answer.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_INTERACTION_RECOVERY_V688__)return;
  window.__AIQUEST_S2_INTERACTION_RECOVERY_V688__=true;
  const $=id=>document.getElementById(id);
  const answered=()=>!!$('feedback')?.classList.contains('show');
  const nextState=()=>{
    const next=$('next');
    if(!next||!answered())return;
    next.disabled=false;
    next.textContent=next.textContent.includes('สรุป')?'สรุปผลภารกิจ →':'เคสถัดไป →';
    next.style.opacity='1';
    next.style.filter='none';
  };
  const retry=(target)=>{
    if(!target||target.disabled||answered())return;
    const handler=target.onclick;
    if(typeof handler==='function'){
      try{handler.call(target,new Event('click',{bubbles:true,cancelable:true}));}catch(e){}
    }
    setTimeout(nextState,80);
  };
  document.addEventListener('click',event=>{
    const choice=event.target?.closest?.('[data-choice]');
    const check=event.target?.closest?.('#checkMap');
    const next=event.target?.closest?.('#next');
    if(choice||check){
      const target=choice||check;
      setTimeout(()=>{if(!answered())retry(target);else nextState();},120);
    }
    if(next&&answered()&&next.disabled){
      next.disabled=false;
      nextState();
    }
  },false);
  new MutationObserver(()=>setTimeout(nextState,0)).observe(document.body,{childList:true,subtree:true,characterData:true});
})();