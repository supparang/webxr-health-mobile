/* CSAI2601 UX Quest • W1 Dense Grid v7
 * Scope: W1 only.
 * Fixes over-tall two-column cards on laptop/desktop viewports.
 * Keeps choices clue-free while using a dense, readable 4-card grid whenever space allows.
 * Visual/CSS only: preserves scoring, data-choice, reason values, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'').toUpperCase();
  if(node()!=='W1')return;
  function style(){
    if($('#uxq-w1-dense-grid-v7-style'))return;
    const s=document.createElement('style');
    s.id='uxq-w1-dense-grid-v7-style';
    s.textContent=`
      body .question{max-width:1040px!important;margin-left:auto!important;margin-right:auto!important;}
      body .question .uxqMechanicPanel,
      body .question .uxqW1Panel,
      body .question .uxqCardShell{
        padding:14px 16px!important;
      }
      body .question .options,
      body .verify .options{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:10px!important;
        align-items:start!important;
      }
      body .question .option,
      body .question .uxqMiniCard,
      body .question .uxqDragCard,
      body .verify .option{
        min-height:76px!important;
        height:auto!important;
        max-height:none!important;
        padding:10px 12px!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:flex-start!important;
        gap:6px!important;
        overflow:hidden!important;
      }
      body .question .option::before,
      body .question .uxqMiniCard::before,
      body .question .uxqDragCard::before{
        width:38px!important;
        min-width:38px!important;
        height:20px!important;
        min-height:20px!important;
        line-height:18px!important;
        margin:0 0 2px!important;
        font-size:.76rem!important;
        align-self:flex-start!important;
      }
      body .question .option b,
      body .question .option strong,
      body .question .uxqMiniCard b,
      body .question .uxqMiniCard strong,
      body .question .uxqDragCard b,
      body .question .uxqDragCard strong,
      body .verify .option b,
      body .verify .option strong{
        margin:0!important;
        padding:0!important;
        display:block!important;
        font-size:.92rem!important;
        line-height:1.28!important;
        letter-spacing:0!important;
        overflow-wrap:break-word!important;
        word-break:normal!important;
      }
      body .question .option small,
      body .question .option p,
      body .question .uxqMiniCard small,
      body .question .uxqMiniCard p,
      body .question .uxqDragCard small,
      body .question .uxqDragCard p,
      body .verify .option small,
      body .verify .option p{display:none!important;}
      body .question .prompt,
      body .question h2,
      body .question h3{margin-bottom:8px!important;}
      body .question .instruction{margin:4px 0 8px!important;}
      @media(max-width:820px){
        body .question .options,body .verify .options{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
      }
      @media(max-width:560px){
        body .question .options,body .verify .options{grid-template-columns:1fr!important;}
      }
      .uxqW1AutoBadge{display:none!important;}
      .uxqW1DenseBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 8px;border-radius:999px;background:rgba(255,214,102,.10);border:1px solid rgba(255,214,102,.50);color:#fff1b8;font-weight:900;font-size:.72rem}
    `;
    document.head.appendChild(s);
  }
  function badge(){
    const q=$('.question');
    if(!q||$('.uxqW1DenseBadge',q))return;
    const b=document.createElement('div');
    b.className='uxqW1DenseBadge';
    b.textContent='✅ W1 dense grid • no clue text';
    const a=q.querySelector('.uxqW1AutoBadge,.uxqW1CompactBadge,.uxqW1NoSubtextBadge,.uxqW1NoSpoilerBadge,.uxqTwoColumnHardLockBadge,.uxqW1StageSpecificBadge');
    if(a)a.insertAdjacentElement('afterend',b);else q.insertBefore(b,q.firstChild);
  }
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();badge();},20)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
