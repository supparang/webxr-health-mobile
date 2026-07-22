/* =========================================================
   EAP Hero • Mobile Skill Hub v139 Hard Fix
   - Forces compact horizontal session strip on mobile.
   - Forces four skill cards into 2x2 grid without moving handlers.
   - Hides repeated helper rows and Local Sheet log.
   - Collapses Recent Portfolio by default.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-MOBILE-SKILL-HUB-V139-HARD-FIX';
  var STYLE_ID='eap-mobile-skill-hub-v139-style';
  var STRIP_ID='eap-mobile-session-strip-v139';
  var timer=0;
  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function visible(n){return !!(n&&n.isConnected&&n.offsetParent!==null);}
  function inject(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      @media(max-width:760px){
        body.eap-v139-mobile #app{padding:8px 10px 88px!important;overflow-x:hidden!important}
        body.eap-v139-mobile #${STRIP_ID}{display:block!important;margin:8px 0 12px!important;overflow:hidden!important}
        body.eap-v139-mobile #${STRIP_ID} .eap139-strip{display:flex!important;gap:8px!important;overflow-x:auto!important;padding:2px 2px 8px!important;scroll-snap-type:x mandatory!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important}
        body.eap-v139-mobile #${STRIP_ID} .eap139-strip::-webkit-scrollbar{display:none!important}
        body.eap-v139-mobile #${STRIP_ID} .eap139-btn{flex:0 0 104px!important;width:104px!important;min-width:104px!important;max-width:104px!important;height:60px!important;min-height:60px!important;margin:0!important;padding:6px 8px!important;border-radius:14px!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;font-size:18px!important;line-height:1!important;scroll-snap-align:start!important;box-sizing:border-box!important}
        body.eap-v139-mobile #${STRIP_ID} .eap139-btn.is-current{outline:3px solid rgba(97,230,205,.32)!important}
        body.eap-v139-mobile .eap139-original-session-host{display:none!important}
        body.eap-v139-mobile .eap139-skill-host{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;align-items:stretch!important;margin:10px 0!important}
        body.eap-v139-mobile .eap139-skill-card{width:100%!important;min-width:0!important;height:150px!important;min-height:150px!important;max-height:150px!important;margin:0!important;padding:10px 8px!important;border-radius:18px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;box-sizing:border-box!important;overflow:hidden!important}
        body.eap-v139-mobile .eap139-skill-card>*{max-width:100%!important}
        body.eap-v139-mobile .eap139-skill-card button,
        body.eap-v139-mobile .eap139-skill-card a{width:100%!important;min-height:38px!important;margin-top:7px!important}
        body.eap-v139-mobile .eap139-hide{display:none!important}
        body.eap-v139-mobile .eap139-summary{padding:14px!important;margin:10px 0!important;border-radius:18px!important;max-height:none!important}
        body.eap-v139-mobile .eap139-summary h1,
        body.eap-v139-mobile .eap139-summary h2{font-size:26px!important;line-height:1.15!important;margin:0 0 6px!important}
        body.eap-v139-mobile .eap139-summary p{font-size:14px!important;line-height:1.4!important;margin:4px 0!important}
        body.eap-v139-mobile .eap139-portfolio table{display:none!important}
        body.eap-v139-mobile .eap139-portfolio.eap139-open table{display:table!important}
        body.eap-v139-mobile .eap139-portfolio-toggle{width:100%!important;min-height:44px!important;margin-top:8px!important;border:1px solid rgba(130,180,220,.25)!important;border-radius:13px!important;background:#18334d!important;color:#fff!important;font-weight:900!important}
      }
      @media(max-width:390px){
        body.eap-v139-mobile .eap139-skill-host{gap:8px!important}
        body.eap-v139-mobile .eap139-skill-card{height:140px!important;min-height:140px!important;max-height:140px!important;padding:8px 6px!important}
        body.eap-v139-mobile #${STRIP_ID} .eap139-btn{flex-basis:98px!important;width:98px!important;min-width:98px!important;max-width:98px!important}
      }
    `;document.head.appendChild(s);
  }
  function getSessionButtons(){
    var map={};
    [...document.querySelectorAll('#app button,#app a[href],#app [role="button"]')].forEach(function(n){
      if(!visible(n)||n.closest('#'+STRIP_ID))return;
      var m=clean(n.textContent).match(/^S(1[0-5]|[1-9])(?:\s|$)/i);if(!m)return;
      var id=Number(m[1]);if(!map[id])map[id]=n;
    });
    return Object.keys(map).map(Number).sort(function(a,b){return a-b;}).map(function(id){return [id,map[id]];});
  }
  function commonHost(nodes){
    if(!nodes.length)return null;var h=nodes[0].parentElement;
    while(h&&h.id!=='app'){if(nodes.every(function(n){return h.contains(n);})){return h;}h=h.parentElement;}
    return null;
  }
  function buildSessionStrip(){
    var entries=getSessionButtons();if(entries.length<10)return;
    var originals=entries.map(function(x){return x[1];});
    var host=commonHost(originals);if(!host)return;
    var stripRoot=document.getElementById(STRIP_ID);
    if(!stripRoot){stripRoot=document.createElement('section');stripRoot.id=STRIP_ID;stripRoot.innerHTML='<div class="eap139-strip"></div>';host.parentElement.insertBefore(stripRoot,host);}
    var strip=stripRoot.querySelector('.eap139-strip');strip.innerHTML='';
    entries.forEach(function(entry){
      var id=entry[0],orig=entry[1],clone=orig.cloneNode(true);
      clone.removeAttribute('id');clone.className='eap139-btn';
      var current=/current|active|selected/i.test(orig.className+' '+(orig.getAttribute('aria-current')||''));
      if(current)clone.classList.add('is-current');
      clone.addEventListener('click',function(e){e.preventDefault();orig.click();});
      strip.appendChild(clone);
    });
    host.classList.add('eap139-original-session-host');
    host.setAttribute('aria-hidden','true');
  }
  function directChildUnder(node,host){var n=node;while(n.parentElement&&n.parentElement!==host)n=n.parentElement;return n;}
  function buildSkillGrid(){
    var found=[];
    ['Reading','Listening','Writing','Speaking'].forEach(function(skill){
      var rx=new RegExp('\\b'+skill+'\\b','i');
      var candidates=[...document.querySelectorAll('#app button,#app a[href],#app [role="button"],#app .skill-card,#app [data-skill]')].filter(function(n){return visible(n)&&rx.test(clean((n.dataset&&n.dataset.skill)||n.textContent));});
      candidates.sort(function(a,b){return clean(a.textContent).length-clean(b.textContent).length;});
      if(candidates[0])found.push(candidates[0]);
    });
    if(found.length!==4||new Set(found).size!==4)return;
    var host=commonHost(found);if(!host)return;
    var cards=found.map(function(n){return directChildUnder(n,host);});
    if(new Set(cards).size!==4)return;
    host.classList.add('eap139-skill-host');
    cards.forEach(function(card){card.classList.add('eap139-skill-card');});
    [...host.children].forEach(function(el){
      if(cards.indexOf(el)>=0)return;
      var t=clean(el.textContent);
      if(/ฝึกเพิ่มได้|ต้องผ่านอย่างน้อย\s*60\/100|Skill\s*เสริม/i.test(t))el.classList.add('eap139-hide');
    });
  }
  function compactSummary(){
    var h=[...document.querySelectorAll('#app h1,#app h2')].filter(visible).find(function(n){return /Session\s*\d+/i.test(clean(n.textContent));});
    if(!h)return;var box=h.parentElement;while(box&&box.id!=='app'&&clean(box.textContent).length<1300)box=box.parentElement;if(box&&box.id!=='app')box.classList.add('eap139-summary');
  }
  function collapsePortfolio(){
    var h=[...document.querySelectorAll('#app h1,#app h2,#app h3')].filter(visible).find(function(n){return /Recent Portfolio/i.test(clean(n.textContent));});if(!h)return;
    var box=h.parentElement;if(!box)return;box.classList.add('eap139-portfolio');
    if(!box.querySelector('.eap139-portfolio-toggle')){
      var b=document.createElement('button');b.type='button';b.className='eap139-portfolio-toggle';b.textContent='ดู Portfolio';
      b.onclick=function(){var open=box.classList.toggle('eap139-open');b.textContent=open?'ซ่อน Portfolio':'ดู Portfolio';};box.appendChild(b);
    }
  }
  function hideSheetLog(){
    [...document.querySelectorAll('body *')].forEach(function(n){
      var t=clean(n.textContent);if(!/^Local Sheet log:\s*\d+ attempts/i.test(t))return;
      var p=n;for(var i=0;i<6&&p;i++,p=p.parentElement){
        var pos='';try{pos=getComputedStyle(p).position;}catch(_){ }
        if(pos==='fixed'||pos==='sticky'){p.classList.add('eap139-hide');p.style.setProperty('display','none','important');break;}
      }
      n.classList.add('eap139-hide');n.style.setProperty('display','none','important');
    });
  }
  function render(){
    if(window.innerWidth>760)return;inject();document.body.classList.add('eap-v139-mobile');buildSessionStrip();buildSkillGrid();compactSummary();collapsePortfolio();hideSheetLog();document.documentElement.dataset.eapMobileHubVersion=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(render,100);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',function(){render();setTimeout(render,500);setTimeout(render,1500);});
  window.addEventListener('resize',schedule);render();
})();