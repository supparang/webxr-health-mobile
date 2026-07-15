/* CSAI2601 UX Quest • Mobile Final Layout v1
 * Final responsive authority loaded last.
 * Ensures every main/reason choice is fully visible on narrow screens.
 * Does not rewrite question content or answer logic.
 */
(function(){
  'use strict';
  var VERSION='uxq-mobile-final-layout-v1-20260715';
  var style=document.createElement('style');
  style.id='uxqMobileFinalLayoutV1';
  style.textContent=`
    html,body{max-width:100%!important;overflow-x:hidden!important}
    #uxqCanonicalNode,.shell,.game,.case,.question,.verify,.artifact{
      width:100%!important;max-width:100%!important;min-width:0!important;
      box-sizing:border-box!important;overflow:visible!important;
    }
    .question .options,.verify .options,.options{
      display:grid!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      width:100%!important;max-width:100%!important;min-width:0!important;
      gap:12px!important;overflow:visible!important;
      transform:none!important;left:auto!important;right:auto!important;
    }
    .options>button.option,.options>.option,button.option{
      width:100%!important;max-width:100%!important;min-width:0!important;
      height:auto!important;min-height:96px!important;
      box-sizing:border-box!important;overflow:visible!important;
      white-space:normal!important;word-break:break-word!important;
      overflow-wrap:anywhere!important;transform:none!important;
    }
    button.option b,button.option span,.option b,.option span{
      display:block!important;max-width:100%!important;min-width:0!important;
      white-space:normal!important;word-break:break-word!important;
      overflow-wrap:anywhere!important;line-height:1.38!important;
    }
    [data-global-anti-v3],[data-production-authority],
    [data-global-anti-v2],[data-global-anti-v1]{
      max-width:calc(100vw - 24px)!important;
    }
    @media (max-width:720px){
      .case,.question,.verify,.artifact{padding-left:14px!important;padding-right:14px!important}
      .question .options,.verify .options,.options{
        grid-template-columns:minmax(0,1fr)!important;
        gap:10px!important;
      }
      .options>button.option,.options>.option,button.option{
        min-height:0!important;padding:14px!important;
      }
      .case h1{font-size:clamp(28px,8vw,42px)!important;line-height:1.12!important}
      .case p,.instruction{font-size:clamp(16px,4.5vw,22px)!important;line-height:1.5!important}
      .question .prompt{font-size:clamp(22px,6vw,30px)!important;line-height:1.25!important}
      button.option b,.option b{font-size:clamp(17px,4.8vw,22px)!important}
      button.option span,.option span{font-size:clamp(13px,3.7vw,17px)!important;margin-top:6px!important}
      .utility{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:10px!important}
      .utility .hint,.utility button{width:100%!important;max-width:100%!important}
    }
    @media (max-width:380px){
      .case,.question,.verify,.artifact{padding-left:10px!important;padding-right:10px!important}
      .options>button.option,.options>.option,button.option{padding:12px!important}
    }
  `;
  document.head.appendChild(style);

  function normalize(){
    document.documentElement.style.overflowX='hidden';
    document.body.style.overflowX='hidden';
    document.querySelectorAll('.options').forEach(function(group){
      group.style.removeProperty('grid-auto-flow');
      group.style.removeProperty('grid-auto-columns');
      group.style.removeProperty('display');
      group.style.removeProperty('width');
      group.style.removeProperty('min-width');
      group.scrollLeft=0;
    });
    document.querySelectorAll('button.option,.option').forEach(function(card){
      card.style.removeProperty('flex-basis');
      card.style.removeProperty('min-width');
      card.style.removeProperty('max-width');
      card.style.removeProperty('width');
      card.style.removeProperty('transform');
    });
  }
  function schedule(){cancelAnimationFrame(schedule.raf);schedule.raf=requestAnimationFrame(normalize);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',normalize,{once:true});else normalize();
  var root=document.getElementById('uxqCanonicalNode')||document.body;
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.UXQMobileFinalLayoutV1=Object.freeze({version:VERSION,normalize:normalize});
})();
