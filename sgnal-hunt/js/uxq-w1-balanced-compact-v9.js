/* CSAI2601 UX Quest • W1 Balanced Compact v9
 * Scope: W1 only.
 * Goal: fix v31 being too compressed while keeping cards inside the frame.
 * Keeps choices readable, balanced, and non-spoiler. Does not touch scoring/data-choice/reason/sheet sync.
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search || '');
  const NODE = String(params.get('node') || params.get('id') || '').toUpperCase();
  if (NODE !== 'W1') return;
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  function inject(){
    let style = $('#uxq-w1-balanced-compact-v9-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'uxq-w1-balanced-compact-v9-style';
      document.head.appendChild(style);
    }
    style.textContent = `
      body .shell{width:min(1180px,100%)!important;}
      body .question{
        padding:18px 20px!important;
        border-radius:20px!important;
      }
      body .question .options, body .verify .options{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:12px!important;
        align-items:stretch!important;
        margin-top:14px!important;
      }
      body .question .option, body .verify .option{
        min-height:92px!important;
        height:auto!important;
        max-height:none!important;
        padding:14px 14px!important;
        border-radius:16px!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:center!important;
        overflow:hidden!important;
        background:linear-gradient(150deg,rgba(8,24,52,.72),rgba(5,15,35,.74))!important;
      }
      body .question .option b, body .verify .option b{
        display:-webkit-box!important;
        -webkit-line-clamp:3!important;
        -webkit-box-orient:vertical!important;
        overflow:hidden!important;
        font-size:clamp(.88rem,1.05vw,.98rem)!important;
        line-height:1.28!important;
        margin:0!important;
        padding:0!important;
        overflow-wrap:break-word!important;
      }
      body .question .option span, body .verify .option span,
      body .question .option small, body .verify .option small,
      body .question .option p, body .verify .option p{
        display:none!important;
      }
      body .question .prompt{font-size:1.34rem!important;line-height:1.3!important;margin:0 0 7px!important;}
      body .question .instruction{font-size:.95rem!important;line-height:1.5!important;margin:0 0 10px!important;}
      body .question .hint{padding:10px 12px!important;line-height:1.38!important;min-height:0!important;}
      body .question .utility{margin-top:12px!important;align-items:stretch!important;}
      body .question .btn{min-height:44px!important;padding:10px 14px!important;}
      .uxqW1HardBadge{display:none!important;}
      .uxqW1BalancedBadge{display:inline-flex;width:max-content;max-width:100%;padding:6px 10px;margin:6px 0 10px;border-radius:999px;background:rgba(110,231,255,.12);border:1px solid rgba(110,231,255,.58);color:#dff9ff;font-weight:950;font-size:.74rem}
      @media(max-width:980px){body .question .options, body .verify .options{grid-template-columns:repeat(2,minmax(0,1fr))!important;}body .question .option, body .verify .option{min-height:86px!important;}}
      @media(max-width:640px){body .question .options, body .verify .options{grid-template-columns:1fr!important;}body .question .option, body .verify .option{min-height:auto!important;}}
    `;
    document.head.appendChild(style);
  }

  function apply(){
    const q = $('.question');
    if (!q) return;
    q.style.setProperty('padding','18px 20px','important');
    $$('.question .options, .verify .options').forEach((el)=>{
      el.style.setProperty('display','grid','important');
      el.style.setProperty('grid-template-columns','repeat(4,minmax(0,1fr))','important');
      el.style.setProperty('gap','12px','important');
      el.style.setProperty('align-items','stretch','important');
      el.style.setProperty('margin-top','14px','important');
    });
    $$('.question .option, .verify .option').forEach((el)=>{
      el.style.setProperty('min-height','92px','important');
      el.style.setProperty('height','auto','important');
      el.style.setProperty('max-height','none','important');
      el.style.setProperty('padding','14px 14px','important');
      el.style.setProperty('display','flex','important');
      el.style.setProperty('flex-direction','column','important');
      el.style.setProperty('justify-content','center','important');
      el.style.setProperty('overflow','hidden','important');
      const b = el.querySelector('b,strong');
      if (b) {
        b.style.setProperty('font-size','.94rem','important');
        b.style.setProperty('line-height','1.28','important');
        b.style.setProperty('margin','0','important');
        b.style.setProperty('overflow','hidden','important');
        b.style.setProperty('display','-webkit-box','important');
        b.style.setProperty('-webkit-line-clamp','3','important');
        b.style.setProperty('-webkit-box-orient','vertical','important');
      }
      el.querySelectorAll('span,small,p').forEach((x)=>x.style.setProperty('display','none','important'));
    });
    if (!$('.uxqW1BalancedBadge', q)) {
      const b = document.createElement('div');
      b.className = 'uxqW1BalancedBadge';
      b.textContent = '✅ W1 balanced compact • readable cards';
      const anchor = q.querySelector('.uxqW1HardBadge,.uxqW1DenseBadge,.uxqW1AutoBadge,.uxqW1CompactBadge,.uxqW1NoSubtextBadge,.uxqW1NoSpoilerBadge');
      if (anchor) anchor.insertAdjacentElement('afterend', b); else q.insertBefore(b, q.firstChild);
    }
  }

  let t = 0;
  function run(){ clearTimeout(t); t = setTimeout(()=>{ inject(); apply(); }, 15); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once:true }); else run();
  new MutationObserver(run).observe(document.documentElement, { childList:true, subtree:true, characterData:true, attributes:true });
})();
