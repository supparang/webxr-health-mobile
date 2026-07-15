/* CSAI2601 UX Quest • Responsive Production Layout v1.1
 * Safe presentation authority for intro, gameplay, reason, result, and artifact screens.
 * Does not modify answer logic, scoring, progress, or Sheet sync.
 */
(function(){
  'use strict';
  var VERSION='uxq-production-responsive-layout-v1.1-20260715';
  var style=document.createElement('style');
  style.id='uxqProductionResponsiveLayoutV1';
  style.textContent=`
    :root{--uxq-page-max:1180px;--uxq-edge:clamp(14px,3vw,28px)}
    html,body{max-width:100%!important;overflow-x:hidden!important}
    body{background:radial-gradient(circle at 8% 0%,#173968 0,transparent 28rem),radial-gradient(circle at 100% 0%,#3c2d78 0,transparent 30rem),#061126!important}
    #uxqStaticMissionLogo{display:none!important}
    [data-global-anti-v3],[data-global-anti-v2],[data-global-anti-v1],[data-production-authority]{display:none!important}
    .shell{width:min(var(--uxq-page-max),100%)!important;margin:0 auto!important;padding:22px var(--uxq-edge) 56px!important}
    .top{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;margin:0 0 18px!important}
    .brand{font-size:17px!important;letter-spacing:-.01em!important}.mark{flex:0 0 auto!important}.pill{display:none!important}
    .panel{border-radius:28px!important;border:1px solid rgba(151,187,255,.24)!important;background:linear-gradient(155deg,rgba(18,42,80,.96),rgba(7,22,48,.98))!important;box-shadow:0 28px 80px rgba(0,0,0,.30)!important}
    .hero{padding:clamp(28px,5vw,58px)!important;gap:20px!important}.hero .kicker{font-size:13px!important;letter-spacing:.14em!important}.hero .title{font-size:clamp(42px,6vw,72px)!important;line-height:.98!important;max-width:900px!important}.hero .lede{font-size:clamp(17px,1.8vw,21px)!important;line-height:1.55!important;max-width:860px!important}
    .briefs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px!important}.brief{padding:18px!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(7,22,49,.72),rgba(5,16,37,.72))!important;border:1px solid rgba(151,187,255,.22)!important;min-height:112px!important}.brief b{font-size:16px!important;margin-bottom:8px!important}.brief span{font-size:15px!important;line-height:1.55!important}
    .actions{display:grid!important;grid-template-columns:minmax(170px,220px) minmax(170px,220px)!important;gap:12px!important;margin-top:2px!important}.actions .btn{min-height:54px!important;display:grid!important;place-items:center!important;border-radius:16px!important;font-size:17px!important;text-align:center!important;padding:13px 18px!important}
    .game{padding:clamp(16px,3vw,34px)!important}.hud{border-radius:18px 18px 0 0!important}.case{padding:4px 0 18px!important;margin:0!important;background:transparent!important}.question,.verify,.artifact{max-width:100%!important;min-width:0!important}.options{width:100%!important;max-width:100%!important;min-width:0!important}.option{min-width:0!important;max-width:100%!important;overflow-wrap:anywhere!important}.option b,.option span{white-space:normal!important;overflow-wrap:anywhere!important}
    @media(max-width:820px){
      :root{--uxq-edge:16px}.shell{padding-top:14px!important;padding-bottom:36px!important}.top{margin-bottom:12px!important}.brand{font-size:15px!important}.mark{width:34px!important;height:34px!important;border-radius:11px!important}.panel{border-radius:24px!important}.hero{padding:24px 18px 22px!important;gap:16px!important}.hero .title{font-size:clamp(34px,10vw,48px)!important;line-height:1.02!important}.hero .lede{font-size:17px!important;line-height:1.5!important}.briefs{grid-template-columns:1fr!important;gap:10px!important}.brief{min-height:0!important;padding:15px 16px!important;border-radius:16px!important}.brief b{font-size:15px!important;margin-bottom:5px!important}.brief span{font-size:14px!important;line-height:1.5!important}.actions{grid-template-columns:1fr!important;gap:10px!important}.actions .btn{width:100%!important;min-height:56px!important;font-size:17px!important;border-radius:16px!important}.game{padding:14px 12px 24px!important}.hud{grid-template-columns:1fr 1fr!important;gap:8px!important;padding:10px!important}.hud .meter:first-child{grid-column:1/-1!important}.case h1{font-size:clamp(28px,8vw,40px)!important;line-height:1.08!important}.case p{font-size:16px!important;line-height:1.5!important}.question,.verify,.artifact{padding:17px!important;border-radius:20px!important}.question .prompt{font-size:23px!important;line-height:1.25!important}.instruction{font-size:15px!important;line-height:1.5!important}.options{grid-template-columns:1fr!important;gap:10px!important}.option{width:100%!important;min-height:0!important;height:auto!important;padding:15px!important;border-radius:16px!important}.option b{font-size:17px!important;line-height:1.42!important}.option span{font-size:13px!important;line-height:1.4!important}.utility{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}.utility .hint,.utility button{width:100%!important;max-width:100%!important}.results{padding:26px 16px!important}.result-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
    @media(max-width:420px){:root{--uxq-edge:10px}.shell{padding-left:0!important;padding-right:0!important}.top{padding:0 12px!important}.panel{border-left:0!important;border-right:0!important;border-radius:0!important}.hero{padding:22px 16px 20px!important}.hero .title{font-size:36px!important}.hero .lede{font-size:16px!important}.game{padding:12px 10px 22px!important}.question,.verify,.artifact{padding:15px!important;border-radius:18px!important}.result-grid{grid-template-columns:1fr 1fr!important;gap:8px!important}}
  `;
  document.head.appendChild(style);

  function normalize(){
    var staticLogo=document.getElementById('uxqStaticMissionLogo');
    if(staticLogo)staticLogo.style.setProperty('display','none','important');
    document.querySelectorAll('[data-global-anti-v3],[data-global-anti-v2],[data-global-anti-v1],[data-production-authority]').forEach(function(el){el.style.setProperty('display','none','important');});
    document.querySelectorAll('.options').forEach(function(g){
      g.style.removeProperty('grid-auto-flow');g.style.removeProperty('grid-auto-columns');g.style.removeProperty('min-width');g.scrollLeft=0;
    });
    document.querySelectorAll('.option,button.option').forEach(function(c){
      c.style.removeProperty('flex-basis');c.style.removeProperty('min-width');c.style.removeProperty('max-width');c.style.removeProperty('width');c.style.removeProperty('transform');
    });
  }
  var raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(normalize);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',normalize,{once:true});else normalize();
  new MutationObserver(schedule).observe(document.getElementById('uxqCanonicalNode')||document.body,{childList:true,subtree:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.UXQProductionResponsiveLayoutV1=Object.freeze({version:VERSION,normalize:normalize});
})();
