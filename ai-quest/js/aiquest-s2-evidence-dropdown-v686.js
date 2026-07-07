/* CSAI2102 S2 Evidence Dropdown Readability v6.8.6 */
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
  new MutationObserver(()=>setTimeout(tune,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(tune,300);tune();
})();