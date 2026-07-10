/* CSAI2601 UX Quest • W1 Compact Cards v5
 * Scope: W1 only.
 * Tightens empty-looking cards after no-subtext mode.
 * Keeps main options clue-free; makes reason choices compact and readable.
 * CSS/visual only: preserves all scoring, selected values, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'').toUpperCase();
  if(node()!=='W1')return;
  function style(){
    if($('#uxq-w1-compact-cards-v5-style'))return;
    const s=document.createElement('style');
    s.id='uxq-w1-compact-cards-v5-style';
    s.textContent=`
      body .question .options{
        gap:14px!important;
        align-items:stretch!important;
      }
      body .question .option,
      body .question .uxqMiniCard,
      body .question .uxqDragCard{
        min-height:92px!important;
        max-height:none!important;
        padding:16px 18px!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:flex-start!important;
        gap:10px!important;
      }
      body .question .option::before,
      body .question .uxqMiniCard::before,
      body .question .uxqDragCard::before{
        margin:0!important;
        flex:0 0 auto!important;
      }
      body .question .option b,
      body .question .option strong,
      body .question .uxqMiniCard b,
      body .question .uxqMiniCard strong,
      body .question .uxqDragCard b,
      body .question .uxqDragCard strong{
        margin:0!important;
        padding:0!important;
        display:block!important;
        max-width:100%!important;
        font-size:1.02rem!important;
        line-height:1.36!important;
        overflow-wrap:anywhere!important;
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
        gap:12px!important;
      }
      body .verify .option{
        min-height:82px!important;
        padding:15px 18px!important;
        display:flex!important;
        align-items:flex-start!important;
        justify-content:flex-start!important;
      }
      body .verify .option b,
      body .verify .option strong{
        font-size:1rem!important;
        line-height:1.34!important;
        margin:0!important;
        overflow-wrap:anywhere!important;
      }
      body .verify .option small,
      body .verify .option p{
        display:none!important;
      }
      .uxqW1CompactBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 10px;border-radius:999px;background:rgba(124,244,255,.10);border:1px solid rgba(124,244,255,.45);color:#dffbff;font-weight:900;font-size:.72rem}
    `;
    document.head.appendChild(s);
  }
  function badge(){
    const q=$('.question');
    if(!q||$('.uxqW1CompactBadge',q))return;
    const b=document.createElement('div');
    b.className='uxqW1CompactBadge';
    b.textContent='✅ W1 compact cards • clean layout';
    const a=q.querySelector('.uxqW1NoSubtextBadge,.uxqW1NoSpoilerBadge,.uxqTwoColumnHardLockBadge,.uxqW1StageSpecificBadge');
    if(a)a.insertAdjacentElement('afterend',b);else q.insertBefore(b,q.firstChild);
  }
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();badge();},30)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
