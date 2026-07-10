/* CSAI2601 UX Quest • W1 Auto Height v6
 * Scope: W1 only.
 * Final layout pass after no-subtext: cards shrink to real text height.
 * Wide screens use 4 compact cards; medium screens use 2; mobile uses 1.
 * Visual/CSS only: preserves data-choice, reason values, score, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'').toUpperCase();
  if(node()!=='W1')return;
  function style(){
    if($('#uxq-w1-auto-height-v6-style'))return;
    const s=document.createElement('style');
    s.id='uxq-w1-auto-height-v6-style';
    s.textContent=`
      body .question .options{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:12px!important;
        align-items:start!important;
      }
      body .question .option,
      body .question .uxqMiniCard,
      body .question .uxqDragCard{
        min-height:0!important;
        height:auto!important;
        max-height:none!important;
        padding:12px 14px 14px!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:flex-start!important;
        gap:8px!important;
        overflow:visible!important;
      }
      body .question .option::before,
      body .question .uxqMiniCard::before,
      body .question .uxqDragCard::before{
        width:42px!important;
        min-width:42px!important;
        height:22px!important;
        min-height:22px!important;
        line-height:20px!important;
        margin:0!important;
        font-size:.8rem!important;
        align-self:flex-start!important;
      }
      body .question .option b,
      body .question .option strong,
      body .question .uxqMiniCard b,
      body .question .uxqMiniCard strong,
      body .question .uxqDragCard b,
      body .question .uxqDragCard strong{
        display:block!important;
        margin:0!important;
        padding:0!important;
        font-size:.98rem!important;
        line-height:1.32!important;
        letter-spacing:0!important;
        overflow-wrap:break-word!important;
        word-break:normal!important;
      }
      body .question .option small,
      body .question .option p,
      body .question .uxqMiniCard small,
      body .question .uxqMiniCard p,
      body .question .uxqDragCard small,
      body .question .uxqDragCard p{
        display:none!important;
      }
      body .verify .options{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:12px!important;
        align-items:start!important;
      }
      body .verify .option{
        min-height:0!important;
        height:auto!important;
        padding:12px 14px!important;
        display:flex!important;
        align-items:flex-start!important;
        justify-content:flex-start!important;
        overflow:visible!important;
      }
      body .verify .option b,
      body .verify .option strong{
        font-size:.96rem!important;
        line-height:1.32!important;
        margin:0!important;
        overflow-wrap:break-word!important;
      }
      body .verify .option small,
      body .verify .option p{
        display:none!important;
      }
      @media(max-width:1100px){
        body .question .options,body .verify .options{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
      }
      @media(max-width:680px){
        body .question .options,body .verify .options{grid-template-columns:1fr!important;}
      }
      .uxqW1CompactBadge{display:none!important;}
      .uxqW1AutoBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 10px;border-radius:999px;background:rgba(91,255,181,.10);border:1px solid rgba(91,255,181,.45);color:#dbffef;font-weight:900;font-size:.72rem}
    `;
    document.head.appendChild(s);
  }
  function badge(){
    const q=$('.question');
    if(!q||$('.uxqW1AutoBadge',q))return;
    const b=document.createElement('div');
    b.className='uxqW1AutoBadge';
    b.textContent='✅ W1 auto-height • compact grid';
    const a=q.querySelector('.uxqW1CompactBadge,.uxqW1NoSubtextBadge,.uxqW1NoSpoilerBadge,.uxqTwoColumnHardLockBadge,.uxqW1StageSpecificBadge');
    if(a)a.insertAdjacentElement('afterend',b);else q.insertBefore(b,q.firstChild);
  }
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();badge();},25)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
