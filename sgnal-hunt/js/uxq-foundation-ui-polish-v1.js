/* CSAI2601 UX Quest • Foundation UI Polish v1
 * Scope: W1-W7 + B1-B2.
 * Makes option/reason cards cleaner, less boxy, and removes visible generic helper text.
 * Visual-only: does not change data-choice, data-reason, scoring, strict gate, or sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'W1').toUpperCase();
  const SCOPE=/^(W[1-7]|B[12])$/;
  const GENERIC=/อ่านสถานการณ์|เลือกคำตอบที่มีเหตุผล|เลือกเหตุผลที่อธิบาย/i;
  function style(){
    if($('#uxq-foundation-ui-polish-style'))return;
    const s=document.createElement('style');
    s.id='uxq-foundation-ui-polish-style';
    s.textContent=`
      .question{max-width:1120px!important;margin-inline:auto!important}
      .question .options{gap:14px!important;align-items:stretch!important}
      @media(min-width:900px){.question .options{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
      @media(min-width:641px) and (max-width:899px){.question .options{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      .question .option[data-foundation-quality="1"],
      .uxqMiniCard[data-foundation-quality="1"],
      .uxqDragCard[data-foundation-quality="1"]{
        min-height:142px!important;
        height:auto!important;
        max-height:none!important;
        overflow:visible!important;
        padding:16px 16px 14px!important;
        border-radius:20px!important;
        background:linear-gradient(180deg,rgba(13,31,67,.98),rgba(8,24,52,.98))!important;
        border:1px solid rgba(102,202,255,.22)!important;
        box-shadow:0 14px 34px rgba(0,0,0,.16)!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:flex-start!important;
        gap:10px!important;
      }
      .question .option[data-foundation-quality="1"][aria-pressed="true"],
      .question .option[data-foundation-quality="1"].selected,
      .question .option[data-foundation-quality="1"]:focus-visible,
      .question .option[data-foundation-quality="1"]:hover{
        border-color:rgba(87,220,255,.92)!important;
        box-shadow:0 0 0 2px rgba(87,220,255,.10),0 18px 42px rgba(0,0,0,.22)!important;
        transform:translateY(-1px)!important;
      }
      .question .option[data-foundation-quality="1"]:before{
        content:attr(data-choice-tag)!important;
        width:34px!important;
        height:22px!important;
        min-height:22px!important;
        border-radius:999px!important;
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        background:rgba(91,221,255,.10)!important;
        border:1px solid rgba(91,221,255,.42)!important;
        color:#7ee8ff!important;
        font-size:.8rem!important;
        font-weight:900!important;
        margin:0 0 2px!important;
        position:static!important;
      }
      .question .option[data-foundation-quality="1"] b,
      .question .option[data-foundation-quality="1"] strong,
      .uxqMiniCard[data-foundation-quality="1"] strong,
      .uxqDragCard[data-foundation-quality="1"] b{
        font-size:1.05rem!important;
        line-height:1.32!important;
        font-weight:950!important;
        margin:0!important;
        display:block!important;
        min-height:0!important;
        white-space:normal!important;
        word-break:normal!important;
        overflow-wrap:break-word!important;
      }
      .question .option[data-foundation-quality="1"] span:not(.uxqMiniLane):not(.uxqDragLane),
      .uxqMiniCard[data-foundation-quality="1"] span:not(.uxqMiniLane):not(.uxqDragLane),
      .uxqDragCard[data-foundation-quality="1"] span:not(.uxqMiniLane):not(.uxqDragLane){
        display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;margin:0!important;padding:0!important;
      }
      .question .option[data-foundation-quality="1"] small[data-uxq-foundation-subtitle],
      .uxqMiniCard[data-foundation-quality="1"] small[data-uxq-foundation-subtitle],
      .uxqDragCard[data-foundation-quality="1"] small[data-uxq-foundation-subtitle]{
        display:block!important;
        color:#aecaef!important;
        font-weight:750!important;
        font-size:.91rem!important;
        line-height:1.42!important;
        margin-top:auto!important;
        opacity:.98!important;
        white-space:normal!important;
        word-break:normal!important;
        overflow-wrap:break-word!important;
      }
      .verify .option[data-foundation-reason="1"]{
        min-height:140px!important;
        height:auto!important;
        max-height:none!important;
        overflow:visible!important;
        padding:16px 18px!important;
        border-radius:20px!important;
        display:flex!important;
        flex-direction:column!important;
        gap:10px!important;
      }
      .verify .option[data-foundation-reason="1"] b{font-size:1.02rem!important;line-height:1.36!important;min-height:0!important;max-height:none!important;display:block!important;overflow:visible!important}
      .verify .option[data-foundation-reason="1"] span{display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;margin:0!important;padding:0!important}
      .verify .option[data-foundation-reason="1"] small[data-uxq-foundation-reason-subtitle],
      .verify .option[data-w7-reason-stage="1"] small[data-w7-reason-subtitle]{display:block!important;color:#aecaef!important;font-weight:750!important;line-height:1.42!important;margin-top:auto!important}
      .uxqFoundationQualityBadge,.uxqW7StageBadge{font-size:.74rem!important;padding:5px 8px!important;margin:4px 0 10px!important;white-space:normal!important;line-height:1.25!important}
      @media(max-width:640px){.question .options{grid-template-columns:1fr!important}.question .option[data-foundation-quality="1"]{min-height:0!important}}
    `;
    document.head.appendChild(s);
  }
  function cleanGenericText(){
    if(!SCOPE.test(node()))return;
    $$('.question .option[data-foundation-quality="1"] span:not(.uxqMiniLane):not(.uxqDragLane), .verify .option[data-foundation-reason="1"] span').forEach(sp=>{
      if(GENERIC.test(text(sp))){sp.setAttribute('hidden','hidden');sp.style.display='none';}
    });
  }
  function apply(){style();cleanGenericText();}
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(apply,90);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true});
})();
