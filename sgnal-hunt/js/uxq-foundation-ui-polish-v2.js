/* CSAI2601 UX Quest • Foundation UI Polish v2
 * Scope: W1-W7 + B1-B2. Visual-only.
 * Tightens cards, badges, warning bar, and spacing after polish v1.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const txt=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const q=()=>new URLSearchParams(location.search||'');
  const node=()=>String(q().get('node')||q().get('id')||'W1').toUpperCase();
  if(!/^(W[1-7]|B[12])$/.test(node()))return;
  const names={W1:'W1 Friction',W2:'W2 HCD',W3:'W3 Psychology',W4:'W4 Research',W5:'W5 HMW',W6:'W6 Flow',W7:'W7 Wireframe',B1:'B1 Boss',B2:'B2 Boss'};
  function style(){
    if($('#uxqFoundationPolishV2'))return;
    const s=document.createElement('style');
    s.id='uxqFoundationPolishV2';
    s.textContent=`
      .question{max-width:1120px!important;margin-inline:auto!important;padding-top:6px!important}
      .question .uxqMechanicPanel{padding:14px 18px!important;margin-bottom:16px!important;border-radius:20px!important;box-shadow:0 12px 34px rgba(0,0,0,.16)!important}
      .question .uxqFoundationQualityBadge,.question .uxqW7StageBadge{font-size:.72rem!important;padding:5px 9px!important;margin:4px 0 12px!important;border-radius:999px!important;box-shadow:none!important;line-height:1.2!important;max-width:100%!important;width:max-content!important}
      .question .options{gap:14px!important;margin-top:12px!important;align-items:stretch!important}
      @media(min-width:960px){.question .options{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
      @media(min-width:680px) and (max-width:959px){.question .options{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      .question .option[data-foundation-quality="1"]{min-height:150px!important;max-height:none!important;height:auto!important;padding:14px 15px!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(11,35,74,.98),rgba(7,24,53,.98))!important;border:1px solid rgba(104,204,255,.24)!important;box-shadow:0 10px 26px rgba(0,0,0,.15)!important;transition:.14s ease!important}
      .question .option[data-foundation-quality="1"]:hover,.question .option[data-foundation-quality="1"].selected,.question .option[data-foundation-quality="1"][aria-pressed="true"]{border-color:rgba(103,226,255,.95)!important;box-shadow:0 0 0 2px rgba(103,226,255,.12),0 14px 32px rgba(0,0,0,.22)!important;transform:translateY(-1px)!important}
      .question .option[data-foundation-quality="1"]:before{width:42px!important;height:24px!important;margin-bottom:4px!important;border-radius:999px!important;font-size:.78rem!important;background:rgba(95,220,255,.10)!important;color:#86eeff!important}
      .question .option[data-foundation-quality="1"] b,.question .option[data-foundation-quality="1"] strong{font-size:1.02rem!important;line-height:1.34!important;letter-spacing:-.01em!important}
      .question .option[data-foundation-quality="1"] small[data-uxq-foundation-subtitle]{font-size:.86rem!important;line-height:1.38!important;color:#b8cbed!important;margin-top:auto!important}
      .question .option[data-foundation-quality="1"] span:not(.uxqMiniLane):not(.uxqDragLane){display:none!important;visibility:hidden!important;height:0!important;margin:0!important;padding:0!important}
      .verify .option[data-foundation-reason="1"]{border-radius:18px!important;padding:15px 16px!important;min-height:140px!important;background:linear-gradient(180deg,rgba(11,35,74,.98),rgba(7,24,53,.98))!important;border:1px solid rgba(104,204,255,.22)!important;box-shadow:0 10px 26px rgba(0,0,0,.14)!important}
      .verify .option[data-foundation-reason="1"] span{display:none!important}
      .verify .option[data-foundation-reason="1"] b{font-size:1rem!important;line-height:1.36!important}
      @media(max-width:679px){.question .options{grid-template-columns:1fr!important}.question .option[data-foundation-quality="1"]{min-height:0!important}}
    `;
    document.head.appendChild(s);
  }
  function badges(){
    $$('.uxqFoundationQualityBadge').forEach(b=>{b.textContent='✅ '+(names[node()]||node())+' • tuned';});
    if(node()!=='W7') $$('.uxqW7StageBadge').forEach(b=>b.remove());
  }
  function hintBar(){
    $$('.question *').forEach(el=>{
      if(/ยังไม่เฉลยเหตุผลใต้ตัวเลือก/.test(txt(el))){
        el.textContent='ยังไม่เฉลยเหตุผล • เลือกจากหลักฐานก่อน';
        el.style.cssText+=';display:inline-flex!important;width:max-content!important;max-width:100%!important;padding:7px 11px!important;border-radius:999px!important;font-size:.86rem!important;box-shadow:none!important;';
      }
    });
  }
  function apply(){style();badges();hintBar();}
  let t=0;function run(){clearTimeout(t);t=setTimeout(apply,120);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
