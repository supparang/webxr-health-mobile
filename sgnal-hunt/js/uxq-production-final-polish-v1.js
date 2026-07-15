/* CSAI2601 UX Quest • Production Final Polish v1.1
 * Safe final visual cleanup for W1-W15 + B1-B4.
 * Presentation only. Does not change scoring, answers, progress, or Sheet sync.
 */
(function(){
  'use strict';
  var VERSION='uxq-production-final-polish-v1.1-20260715';
  var style=document.createElement('style');
  style.id='uxqProductionFinalPolishV1';
  style.textContent=`
    :root{--uxq-shell:min(92vw,1440px)}
    html,body{overflow-x:hidden!important}
    #uxqStaticMissionLogo,[data-global-anti-v3],[data-global-anti-v2],[data-global-anti-v1],[data-production-authority]{display:none!important}
    .shell{width:var(--uxq-shell)!important;max-width:var(--uxq-shell)!important;margin:0 auto!important;padding-left:0!important;padding-right:0!important}
    .top{margin-bottom:14px!important}.top .pill{display:none!important}.panel{border-radius:26px!important;box-shadow:0 26px 70px rgba(0,0,0,.30)!important}.game{padding:0!important}
    .hud{grid-template-columns:minmax(0,1.8fr) repeat(3,minmax(118px,.42fr))!important;gap:10px!important;padding:12px 14px!important}.hud .meter{min-height:64px!important;padding:10px 12px!important}
    .case{padding:34px 32px 18px!important;margin:0!important}.case h1{font-size:clamp(2rem,3.3vw,3.25rem)!important;line-height:1.08!important;margin:0 0 10px!important}.case p{font-size:clamp(1rem,1.25vw,1.18rem)!important;line-height:1.55!important}
    .question{margin:0 32px 32px!important;padding:24px!important;border-radius:22px!important}.question .prompt{font-size:clamp(1.45rem,2vw,2rem)!important;line-height:1.28!important}.instruction{font-size:clamp(.98rem,1.15vw,1.08rem)!important;line-height:1.52!important;margin-bottom:16px!important}
    .options{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:1fr!important;gap:14px!important;align-items:stretch!important}
    .option,button.option{display:flex!important;flex-direction:column!important;justify-content:flex-start!important;height:100%!important;min-height:132px!important;padding:18px!important;border-radius:18px!important;box-shadow:0 8px 20px rgba(0,0,0,.12)!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease!important}
    .option:hover:not(:disabled),button.option:hover:not(:disabled){transform:translateY(-2px)!important;border-color:rgba(110,231,255,.75)!important;box-shadow:0 14px 28px rgba(0,0,0,.22)!important}
    .option b,button.option b{font-size:clamp(1rem,1.15vw,1.12rem)!important;line-height:1.42!important}.option span,button.option span{font-size:.86rem!important;line-height:1.42!important;margin-top:8px!important;color:#9fb1d2!important}
    .verify{margin:16px 0 0!important;padding:18px!important;border-radius:18px!important}.verify .options{margin-top:12px!important}.utility{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:12px!important;align-items:stretch!important;margin-top:16px!important}.utility .hint{display:flex!important;align-items:center!important;min-height:52px!important;padding:12px 16px!important;border-radius:14px!important}.utility button{min-width:132px!important;min-height:52px!important;border-radius:14px!important;font-weight:900!important}.feedback{border-radius:16px!important;padding:16px!important}.artifact{margin-top:18px!important;border-radius:20px!important;padding:20px!important}.briefs{gap:14px!important}.brief{min-height:112px!important;padding:18px!important;border-radius:18px!important}.actions{margin-top:4px!important}.actions .btn{min-height:52px!important;padding:14px 18px!important;border-radius:15px!important}
    .w1HardBadge,.hardBadge,[data-hard-compact],[class*="hard-compact"],[class*="hardCompact"]{display:none!important}
    @media(max-width:900px){:root{--uxq-shell:100%}.shell{padding:0!important}.panel{border-radius:0!important;border-left:0!important;border-right:0!important}.hud{grid-template-columns:1fr 1fr!important}.hud .meter:first-child{grid-column:1/-1!important}.case{padding:24px 18px 14px!important}.question{margin:0 12px 18px!important;padding:18px!important}.options{grid-template-columns:1fr!important;grid-auto-rows:auto!important}.option,button.option{min-height:0!important;height:auto!important;padding:16px!important}.utility{grid-template-columns:1fr!important}.utility button{width:100%!important}.briefs{grid-template-columns:1fr!important}.actions{display:grid!important;grid-template-columns:1fr!important}.actions .btn{width:100%!important;text-align:center!important}}
    @media(max-width:480px){.hud{grid-template-columns:1fr 1fr!important;padding:10px!important}.hud .meter{min-height:58px!important;padding:9px!important}.case h1{font-size:2rem!important}.case p{font-size:1rem!important}.question{margin:0 8px 14px!important;padding:15px!important;border-radius:18px!important}.question .prompt{font-size:1.35rem!important}.option b,button.option b{font-size:1rem!important}.option span,button.option span{font-size:.82rem!important}}
  `;
  document.head.appendChild(style);

  function cleanDebugBadges(){
    document.querySelectorAll('[data-global-anti-v3],[data-global-anti-v2],[data-global-anti-v1],[data-production-authority],.w1HardBadge,.hardBadge,[data-hard-compact],[class*="hard-compact"],[class*="hardCompact"]').forEach(function(el){
      el.style.setProperty('display','none','important');
    });
  }
  function cleanOptionSubtext(){
    document.querySelectorAll('.option span,button.option span').forEach(function(s){
      var t=String(s.textContent||'').replace(/\s+/g,' ').trim();
      if(!t)return;
      if(/^กับดัก\s*:/i.test(t)||/เชื่อมกับหลักฐานและ artifact/i.test(t)||/พิจารณาความสอดคล้องกับสถานการณ์.*เป้าหมาย.*ผู้ใช้/i.test(t))s.style.setProperty('display','none','important');
    });
  }
  function equalize(){
    if(innerWidth<=900)return;
    document.querySelectorAll('.options').forEach(function(group){
      var cards=Array.prototype.slice.call(group.querySelectorAll(':scope > .option,:scope > button.option'));
      if(!cards.length)return;
      cards.forEach(function(c){c.style.removeProperty('min-height');});
      var max=cards.reduce(function(m,c){return Math.max(m,c.scrollHeight);},0);
      if(max>0)cards.forEach(function(c){c.style.setProperty('min-height',Math.max(132,max)+'px','important');});
    });
  }
  function run(){cleanDebugBadges();cleanOptionSubtext();requestAnimationFrame(equalize);}
  var timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(run,60);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(schedule).observe(document.getElementById('uxqCanonicalNode')||document.body,{childList:true,subtree:true});
  addEventListener('resize',schedule,{passive:true});
  window.UXQProductionFinalPolishV1=Object.freeze({version:VERSION,run:run});
})();
