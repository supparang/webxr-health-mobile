/* CSAI2601 UX Quest • Foundation Layout Fix v1
 * Fixes clipped/wrapped Thai text in W1-W7 + B1-B2 option/reason cards.
 * Also removes stale W7-only badges if they appear outside W7.
 * Visual-only patch: does not touch data-choice, data-reason, scoring, strict gate, or sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'W1').toUpperCase();
  const SCOPE=/^(W[1-7]|B[12])$/;
  function style(){
    if($('#uxq-foundation-layout-fix-style'))return;
    const s=document.createElement('style');
    s.id='uxq-foundation-layout-fix-style';
    s.textContent=`
      .question .option[data-foundation-quality="1"],
      .uxqMiniCard[data-foundation-quality="1"],
      .uxqDragCard[data-foundation-quality="1"]{
        min-height:168px!important;
        max-height:none!important;
        height:auto!important;
        overflow:visible!important;
        align-content:start!important;
        padding-bottom:18px!important;
      }
      .question .option[data-foundation-quality="1"] b,
      .question .option[data-foundation-quality="1"] strong,
      .uxqMiniCard[data-foundation-quality="1"] strong,
      .uxqDragCard[data-foundation-quality="1"] b{
        display:block!important;
        -webkit-line-clamp:unset!important;
        -webkit-box-orient:unset!important;
        overflow:visible!important;
        min-height:0!important;
        max-height:none!important;
        white-space:normal!important;
        word-break:break-word!important;
        overflow-wrap:anywhere!important;
      }
      .question .option[data-foundation-quality="1"] small[data-uxq-foundation-subtitle],
      .uxqMiniCard[data-foundation-quality="1"] small[data-uxq-foundation-subtitle],
      .uxqDragCard[data-foundation-quality="1"] small[data-uxq-foundation-subtitle]{
        display:block!important;
        -webkit-line-clamp:unset!important;
        -webkit-box-orient:unset!important;
        overflow:visible!important;
        min-height:0!important;
        max-height:none!important;
        white-space:normal!important;
        word-break:break-word!important;
        overflow-wrap:anywhere!important;
        line-height:1.42!important;
      }
      .verify .option[data-foundation-reason="1"]{
        min-height:150px!important;
        max-height:none!important;
        height:auto!important;
        overflow:visible!important;
        padding-bottom:18px!important;
      }
      .verify .option[data-foundation-reason="1"] b,
      .verify .option[data-foundation-reason="1"] small[data-uxq-foundation-reason-subtitle]{
        display:block!important;
        -webkit-line-clamp:unset!important;
        -webkit-box-orient:unset!important;
        overflow:visible!important;
        min-height:0!important;
        max-height:none!important;
        white-space:normal!important;
        word-break:break-word!important;
        overflow-wrap:anywhere!important;
        line-height:1.42!important;
      }
      @media(max-width:760px){
        .question .option[data-foundation-quality="1"],.verify .option[data-foundation-reason="1"]{min-height:0!important;}
      }
    `;
    document.head.appendChild(s);
  }
  function removeWrongW7Badges(){
    if(node()==='W7')return;
    $$('.uxqW7StageBadge,.uxqReadableBadge,.uxqFoundationQualityBadge').forEach(el=>{
      const t=text(el);
      if(/^✅?\s*W7\b/i.test(t)||/W7 stage-aware|W7 visual priority|W7 layout|W7 primary CTA|W7 mobile|W7 hierarchy/i.test(t)){
        el.remove();
      }
    });
  }
  function apply(){
    if(!SCOPE.test(node()))return;
    style();
    removeWrongW7Badges();
  }
  let t=0;
  function schedule(){clearTimeout(t);t=setTimeout(apply,80);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
