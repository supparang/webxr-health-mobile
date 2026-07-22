/* CSAI2601 UX Quest • Studio Binding Authority v1
 * Final front-end authority for Studio data binding and layout.
 * - Figma URLs may live only in figmaUrl.
 * - Restores Guided Studio if another patch exposes the raw long form.
 * - localStorage remains draft convenience only.
 */
(() => {
  'use strict';
  const ROOT=document.getElementById('uxqCanonicalNode')||document.body;
  const FIGMA=/^https:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|board|slides|make)\//i;
  const VERSION='20260722-STUDIO-BINDING-AUTHORITY-V1';
  let applying=false;

  const value=el=>String(el?.value||'').trim();
  const fire=el=>{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};

  function sanitize(artifact){
    const figma=artifact.querySelector('[data-studio-key="figmaUrl"]');
    if(!figma)return;
    let recovered='';
    artifact.querySelectorAll('[data-studio-key]').forEach(el=>{
      if(el===figma)return;
      const current=value(el);
      if(!FIGMA.test(current))return;
      recovered=recovered||current;
      el.value='';
      el.dataset.uxqUrlRemoved='1';
      fire(el);
    });
    if(recovered&&!FIGMA.test(value(figma))){figma.value=recovered;fire(figma)}

    artifact.querySelectorAll('[data-studio-key]:not([data-studio-key="figmaUrl"])').forEach(el=>{
      if(el.dataset.uxqStrictUrlGuard==='1')return;
      el.dataset.uxqStrictUrlGuard='1';
      const guard=()=>{
        const current=value(el);if(!FIGMA.test(current))return;
        if(!FIGMA.test(value(figma))){figma.value=current;fire(figma)}
        el.value='';el.setCustomValidity('ลิงก์ Figma ถูกย้ายไปช่อง Project / Evidence URL แล้ว');
        fire(el);el.reportValidity?.();setTimeout(()=>el.setCustomValidity(''),1600);
      };
      el.addEventListener('input',guard);el.addEventListener('change',guard);el.addEventListener('paste',()=>setTimeout(guard,0));
    });
  }

  function enforceWizard(artifact){
    if(!artifact.querySelector('.uxq-gs')){
      try{window.UXQGuidedStudioAll19V3?.build?.()}catch(_){}
    }
    const guide=artifact.querySelector('.uxq-gs');
    if(!guide)return;
    artifact.dataset.guidedAll19='1';
    Array.from(artifact.children).forEach(child=>{
      if(child===guide||child.classList.contains('studio-head'))return;
      if(child.matches('.studio-flow,.studio-policy,.studio-field,.studio-checks,.studio-validation,.actions,.w1-guide,.w1-figma-launcher,.uxq-wizard-progress,.uxq-wizard-panel,.uxq-wizard-nav'))child.style.setProperty('display','none','important');
    });
    guide.style.removeProperty('display');
    guide.querySelectorAll('.uxq-gs__panel').forEach((panel,index)=>{
      if(!panel.classList.contains('is-active')&&index===0&&!guide.querySelector('.uxq-gs__panel.is-active'))panel.classList.add('is-active');
    });
  }

  function apply(){
    if(applying)return;applying=true;
    try{
      ROOT.querySelectorAll('.artifact[data-studio-practice-v1]').forEach(artifact=>{sanitize(artifact);enforceWizard(artifact)});
    }finally{applying=false}
  }
  let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(apply,100)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(ROOT,{childList:true,subtree:true});
  ['uxq-mission-resume-studio','uxq-direct-studio-confirmed','uxq-progress-updated'].forEach(name=>window.addEventListener(name,schedule));
  window.UXQStudioBindingAuthorityV1=Object.freeze({apply,version:VERSION});
})();