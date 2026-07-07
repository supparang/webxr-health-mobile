/* CSAI2102 S2 Runtime Readability + Interaction Guard v6.8.8 */
(()=>{'use strict';
  if(window.__AIQUEST_S2_EVIDENCE_DROPDOWN_V686__)return;
  window.__AIQUEST_S2_EVIDENCE_DROPDOWN_V686__=true;

  const css=`
    #s2EvidenceCase{color-scheme:dark!important;background:#16253a!important;color:#f8fbff!important;border-color:rgba(56,189,248,.78)!important}
    #s2EvidenceCase option{background:#0f1d31!important;color:#f8fbff!important;font-weight:650!important}
    #s2EvidenceCase option:checked{background:#2563eb!important;color:#fff!important}
  `;
  const style=document.createElement('style');style.id='aiquestS2EvidenceDropdownStyleV686';style.textContent=css;document.head.appendChild(style);
  const tune=()=>{const el=document.getElementById('s2EvidenceCase');if(!el)return;el.style.colorScheme='dark';el.style.backgroundColor='#16253a';el.style.color='#f8fbff';[...el.options].forEach(opt=>{opt.style.backgroundColor='#0f1d31';opt.style.color='#f8fbff';opt.style.fontWeight='650'})};

  const ready=()=>!!(
    window.__AIQUEST_S2_ANSWER_ROTATION_V677__&&
    window.__AIQUEST_S2_REPLAY_AUDIT_DIRECT_V681__&&
    window.__AIQUEST_S2_MAP_ORDER_V682__&&
    window.__AIQUEST_S2_CHOICE_PARITY_V683__&&
    window.__AIQUEST_S2_DISTRACTOR_DEPTH_V684__&&
    window.__AIQUEST_S2_CHOICE_AUTHORSHIP_V685__&&
    window.__AIQUEST_S2_REFLECTION_EVIDENCE_V681__&&
    window.__AIQUEST_S2_EVIDENCE_CASE_PICKER_V687__
  );
  const startState=()=>{
    const button=document.getElementById('start');
    if(!button)return;
    if(!ready()){
      button.disabled=true;
      button.textContent='กำลังเตรียม S2 Deck…';
      button.setAttribute('aria-busy','true');
      return;
    }
    const open=String(document.getElementById('status')?.textContent||'').includes('พร้อมเริ่ม');
    button.disabled=!open;
    button.textContent='▶ สร้าง S2 Deck ใหม่';
    button.removeAttribute('aria-busy');
  };

  const hasFeedback=()=>!!document.getElementById('feedback')?.classList.contains('show');
  const restoreNext=()=>{
    const next=document.getElementById('next');
    if(!next||!hasFeedback())return;
    next.disabled=false;
    next.textContent=next.textContent.includes('สรุป')?'สรุปผลภารกิจ →':'เคสถัดไป →';
    next.style.opacity='1';
  };
  const retryTarget=target=>{
    if(!target||target.disabled||hasFeedback())return;
    if(typeof target.onclick==='function'){
      try{target.onclick.call(target,new Event('click',{bubbles:true,cancelable:true}));}catch(e){}
    }
    setTimeout(restoreNext,80);
  };
  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-choice],#checkMap');
    if(target)setTimeout(()=>{if(hasFeedback())restoreNext();else retryTarget(target)},130);
    const next=event.target?.closest?.('#next');
    if(next&&hasFeedback()&&next.disabled)restoreNext();
  },false);

  new MutationObserver(()=>{setTimeout(tune,0);setTimeout(startState,0);setTimeout(restoreNext,0)}).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(()=>{tune();startState();restoreNext()},180);
  tune();startState();
})();