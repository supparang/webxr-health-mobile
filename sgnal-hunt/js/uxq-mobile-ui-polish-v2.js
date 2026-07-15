/* CSAI2601 UX Quest • Mobile UI Polish v2
 * Final visual authority for phones. Loaded after all legacy layout scripts.
 * Presentation only: does not change scoring, answer logic, progress, or Sheet sync.
 */
(function(){
  'use strict';
  var VERSION='uxq-mobile-ui-polish-v2-20260715';
  var style=document.createElement('style');
  style.id='uxqMobileUiPolishV2';
  style.textContent=`
    @media (max-width:720px){
      :root{--uxq-pad:16px;--uxq-gap:12px}
      html,body{overflow-x:hidden!important;background:#061126!important}
      body{font-size:16px!important}
      #uxqCanonicalNode{padding:0!important;margin:0!important;width:100%!important}
      .shell,.game{width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
      .case{padding:24px var(--uxq-pad) 18px!important;background:linear-gradient(180deg,#142b53 0%,#0e2142 100%)!important;border-radius:0!important;border-left:0!important;border-right:0!important}
      .case .kicker{font-size:13px!important;letter-spacing:.14em!important;margin-bottom:10px!important;color:#9fb6df!important}
      .case h1{font-size:clamp(30px,9vw,42px)!important;line-height:1.08!important;letter-spacing:-.02em!important;margin:0 0 14px!important;max-width:100%!important}
      .case p{font-size:18px!important;line-height:1.55!important;margin:0!important;color:#bdcae4!important}

      .question,.verify,.artifact{margin:14px 12px!important;padding:18px!important;border-radius:24px!important;border:1px solid rgba(137,179,255,.24)!important;background:linear-gradient(180deg,rgba(19,42,78,.98),rgba(10,28,57,.98))!important;box-shadow:0 18px 45px rgba(0,0,0,.22)!important;overflow:visible!important}
      .question>[data-production-evidence-v2]{margin:-2px 0 16px!important;border-radius:16px!important;padding:12px 14px!important}
      .question .prompt{font-size:25px!important;line-height:1.2!important;margin:0 0 8px!important;letter-spacing:-.01em!important}
      .instruction{font-size:16px!important;line-height:1.5!important;margin:0 0 16px!important;color:#c2cfe8!important}

      .question .options,.verify .options,.options{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:12px!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:visible!important;transform:none!important}
      .options>button.option,.options>.option,button.option{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important;height:auto!important;margin:0!important;padding:16px 16px 15px!important;border-radius:18px!important;border:1px solid rgba(130,170,235,.30)!important;background:linear-gradient(180deg,#10284b,#0c203e)!important;box-shadow:none!important;overflow:visible!important;white-space:normal!important;transform:none!important;transition:transform .15s ease,border-color .15s ease,background .15s ease!important;text-align:left!important}
      .options>button.option:active,.options>.option:active{transform:scale(.985)!important}
      button.option b,.option b{display:block!important;font-size:18px!important;line-height:1.42!important;font-weight:800!important;letter-spacing:0!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;margin:0!important}
      button.option span,.option span{display:block!important;font-size:13px!important;line-height:1.35!important;margin-top:8px!important;color:#91a9cc!important;white-space:normal!important;overflow-wrap:anywhere!important}
      .option .letter,button.option .letter{margin-bottom:8px!important}
      button.option.selected,.option.selected{border-color:#ffd15b!important;background:linear-gradient(180deg,#2a3b58,#1b2d49)!important}
      button.option.correct,.option.correct{border-color:#55dfc5!important;background:linear-gradient(180deg,#143f49,#11313d)!important}
      button.option.wrong,.option.wrong{border-color:#ff7d92!important;background:linear-gradient(180deg,#47253b,#342039)!important}

      .verify{margin-top:12px!important}
      .verify h2,.verify h3{font-size:23px!important;line-height:1.25!important;margin:0 0 10px!important}
      .verify>p{font-size:17px!important;line-height:1.5!important;margin:0 0 14px!important}

      .utility{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:10px!important;margin-top:14px!important}
      .utility .hint{width:100%!important;max-width:100%!important;margin:0!important;padding:14px 15px!important;border-radius:16px!important;font-size:16px!important;line-height:1.45!important;box-sizing:border-box!important}
      .utility button,.question .utility button{width:100%!important;min-height:54px!important;border-radius:16px!important;font-size:18px!important;font-weight:900!important;margin:0!important}

      .feedback{border-radius:18px!important;padding:14px 16px!important;font-size:16px!important;line-height:1.5!important}
      .artifact textarea,.artifact input,.artifact select{width:100%!important;box-sizing:border-box!important;font-size:16px!important;border-radius:14px!important;padding:13px!important}
      .artifact button{width:100%!important;min-height:54px!important;border-radius:16px!important;font-size:17px!important;font-weight:900!important}

      .hud{padding:12px!important;gap:8px!important}
      .hud>*{min-width:0!important}
      .hud .meter{grid-column:1/-1!important}

      #uxqStaticMissionLogo{display:none!important}
      [data-global-anti-v3],[data-global-anti-v2],[data-global-anti-v1],[data-production-authority]{display:none!important}
      .question [style*="position: fixed"],.question [style*="position:fixed"]{display:none!important}
      .question::before{display:none!important;content:none!important}

      .w1HardBadge,.hardBadge,[data-hard-compact],[class*="hard-compact"],[class*="hardCompact"]{display:none!important}
      .question>*{max-width:100%!important;min-width:0!important}
    }
    @media (max-width:390px){
      :root{--uxq-pad:14px}
      .question,.verify,.artifact{margin:10px 8px!important;padding:15px!important;border-radius:20px!important}
      .case h1{font-size:32px!important}
      .case p{font-size:17px!important}
      .question .prompt{font-size:23px!important}
      button.option b,.option b{font-size:17px!important}
    }
  `;
  document.head.appendChild(style);

  function cleanDebug(){
    if(innerWidth>720)return;
    document.querySelectorAll('[data-global-anti-v3],[data-global-anti-v2],[data-global-anti-v1],[data-production-authority]').forEach(function(el){el.remove();});
    document.querySelectorAll('div,span').forEach(function(el){
      var t=String(el.textContent||'').trim();
      if(/W1 hard compact|4-card override|Anti-Guess v3 Stable/i.test(t)&&el.children.length<4){el.style.display='none';}
    });
  }
  function normalize(){
    if(innerWidth>720)return;
    document.documentElement.style.overflowX='hidden';
    document.body.style.overflowX='hidden';
    document.querySelectorAll('.options').forEach(function(g){
      g.style.setProperty('display','grid','important');
      g.style.setProperty('grid-template-columns','minmax(0,1fr)','important');
      g.style.setProperty('width','100%','important');
      g.style.setProperty('max-width','100%','important');
      g.style.setProperty('overflow','visible','important');
      g.style.removeProperty('grid-auto-flow');
      g.style.removeProperty('grid-auto-columns');
      g.scrollLeft=0;
    });
    document.querySelectorAll('button.option,.option').forEach(function(c){
      c.style.setProperty('width','100%','important');
      c.style.setProperty('max-width','100%','important');
      c.style.setProperty('min-width','0','important');
      c.style.setProperty('height','auto','important');
      c.style.setProperty('transform','none','important');
    });
    cleanDebug();
  }
  var raf=0;
  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(normalize);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',normalize,{once:true});else normalize();
  new MutationObserver(schedule).observe(document.getElementById('uxqCanonicalNode')||document.body,{childList:true,subtree:true});
  addEventListener('resize',schedule,{passive:true});
  window.UXQMobileUiPolishV2=Object.freeze({version:VERSION,normalize:normalize});
})();
