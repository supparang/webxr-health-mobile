/* CSAI2601 UX Quest • Mechanic Mode v2.6 PRESENTATION-ONLY
 * Layout/style helper for W1-W15 and B1-B4.
 * Canonical Content Final Authority is the sole owner of learner-facing prompt text.
 * This layer MUST NOT rewrite prompt text or remove/rebuild choice child nodes.
 * Answer truth, scoring, progress, gates and Sheet sync stay unchanged.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);

  function style(){
    if($('#uxq-mechanic-v2-style')) return;
    const s=document.createElement('style');
    s.id='uxq-mechanic-v2-style';
    s.textContent=`
      .uxqMechanicPanel{display:none!important}
      [data-w7-authority]{display:none!important}
      .question .options:first-of-type{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important}
      .question .options:first-of-type .option{min-height:112px!important;display:flex!important;flex-direction:column!important;justify-content:flex-start!important;padding:18px!important;overflow:visible!important}
      .question .options:first-of-type .option:before{display:none!important;content:none!important}
      .question .options:first-of-type .option>b{font-size:1rem!important;line-height:1.48!important}
      .question:not(.has-feedback) .options:first-of-type .option>span,
      .question:not(.has-feedback) .options:first-of-type .option>small,
      .question:not(.has-feedback) .options:first-of-type .option>p{display:none!important}
      .question>.prompt{margin:0 0 8px!important;line-height:1.25!important}
      .question>.instruction{margin:0 0 14px!important}
      .uxqMissionIdentity{margin:0!important;border-left:0!important;border-right:0!important;border-radius:0!important;padding:10px 16px!important;background:linear-gradient(90deg,rgba(110,231,255,.10),rgba(155,140,255,.10))!important}
      .uxqMissionIdentity .miIcon{font-size:1.25rem!important}
      .uxqMissionIdentity b{font-size:.96rem!important}
      .uxqMissionIdentity span{font-size:.84rem!important;line-height:1.3!important}
      .uxqMissionIdentity small{font-size:.76rem!important;margin-top:2px!important}
      @media(max-width:900px){
        .question .options:first-of-type{grid-template-columns:1fr!important}
        .question .options:first-of-type .option{min-height:0!important}
      }
    `;
    document.head.appendChild(s);
  }

  function decorate(){
    const q=$('.question');
    if(!q) return;
    const hasFeedback=!!q.querySelector('.feedback,.verify');
    q.classList.toggle('has-feedback',hasFeedback);
    q.dataset.mechanicPresentationOnly='true';
  }

  style();
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',decorate,{once:true});
  } else {
    decorate();
  }

  // Observe only structural replacement so styling state follows a newly-rendered question.
  // decorate() changes attributes only, which this observer does not watch, so no feedback loop occurs.
  let timer=0;
  new MutationObserver(records=>{
    if(!records.some(r=>r.type==='childList' && r.addedNodes.length)) return;
    clearTimeout(timer);
    timer=setTimeout(decorate,60);
  }).observe(document.documentElement,{childList:true,subtree:true});

  window.UXQMechanicModeV2=Object.freeze({
    version:'20260816-MECHANIC-V2.6-PRESENTATION-ONLY',
    promptOwner:'uxq-canonical-content-final-authority-v3'
  });
})();