/* =========================================================
   EAP Hero • Mobile Skill Hub v138 Compact
   UI-only finalizer. Keeps original click handlers and game authority.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-MOBILE-SKILL-HUB-V138-COMPACT';
  var STYLE_ID='eap-mobile-skill-hub-v138-style';
  var NAV_ID='eap-mobile-session-strip-v138';
  var SKILL_ID='eap-mobile-skill-grid-v138';
  var timer=0;
  var SKILLS=['Reading','Listening','Writing','Speaking'];
  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function visible(n){return !!(n&&n.isConnected&&n.offsetParent!==null);}
  function style(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      @media(max-width:760px){
        body.eap-v138-mobile #app{padding:10px 10px 90px!important;overflow-x:hidden!important}
        body.eap-v138-mobile #${NAV_ID}{margin:10px 0 14px!important;padding:0!important}
        body.eap-v138-mobile .eap138-strip{display:flex!important;gap:9px!important;overflow-x:auto!important;scroll-snap-type:x mandatory!important;padding:3px 2px 9px!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important}
        body.eap-v138-mobile .eap138-strip::-webkit-scrollbar{display:none!important}
        body.eap-v138-mobile .eap138-session{flex:0 0 112px!important;min-width:112px!important;width:112px!important;height:64px!important;min-height:64px!important;padding:8px!important;margin:0!important;border-radius:15px!important;scroll-snap-align:start!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;font-size:18px!important;line-height:1.15!important;box-sizing:border-box!important}
        body.eap-v138-mobile .eap138-session.is-current{outline:3px solid rgba(89,230,205,.3)!important}
        body.eap-v138-mobile .eap138-original-session-host{display:none!important}
        body.eap-v138-mobile #${SKILL_ID}{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin:12px 0!important;padding:0!important}
        body.eap-v138-mobile #${SKILL_ID} .eap138-skill{min-width:0!important;width:100%!important;height:146px!important;min-height:146px!important;max-height:146px!important;margin:0!important;padding:12px 8px!important;border-radius:18px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;box-sizing:border-box!important;overflow:hidden!important}
        body.eap-v138-mobile #${SKILL_ID} .eap138-skill *{max-width:100%!important}
        body.eap-v138-mobile #${SKILL_ID} .eap138-skill button,
        body.eap-v138-mobile #${SKILL_ID} .eap138-skill a{width:100%!important;min-height:40px!important;margin-top:8px!important}
        body.eap-v138-mobile .eap138-duplicate-note{display:none!important}
        body.eap-v138-mobile .eap138-session-summary{padding:14px!important;margin:10px 0!important;border-radius:18px!important}
        body.eap-v138-mobile .eap138-session-summary h1,
        body.eap-v138-mobile .eap138-session-summary h2{font-size:27px!important;line-height:1.15!important;margin-bottom:6px!important}
        body.eap-v138-mobile .eap138-session-summary p{font-size:14px!important;line-height:1.45!important;margin:5px 0!important}
        body.eap-v138-mobile .eap138-portfolio-collapsed{max-height:66px!important;overflow:hidden!important;position:relative!important}
        body.eap-v138-mobile .eap138-portfolio-collapsed table{display:none!important}
        body.eap-v138-mobile .eap138-portfolio-toggle{width:100%!important;min-height:46px!important;margin-top:8px!important;border:1px solid rgba(130,180,220,.25)!important;border-radius:14px!important;background:#18334d!important;color:#fff!important;font-weight:900!important}
        body.eap-v138-mobile .eap138-sheet-log-hidden{display:none!important}
      }
      @media(max-width:390px){
        body.eap-v138-mobile #${SKILL_ID}{gap:8px!important}
        body.eap-v138-mobile #${SKILL_ID} .eap138-skill{height:138px!important;min-height:138px!important;max-height:138px!important;padding:10px 6px!important}
        body.eap-v138-mobile .eap138-session{flex-basis:102px!important;min-width:102px!important;width:102px!important}
      }
    `;document.head.appendChild(s);
  }
  function sessionNodes(){
    return [...document.querySelectorAll('#app button,#app a[href],#app [role="button"]')].filter(function(n){
      if(!visible(n)||n.closest('#'+NAV_ID))return false;
      return /^S(?:1[0-5]|[1-9])(?:\s|$)/i.test(clean(n.textContent));
    }).slice(0,15);
  }
  function commonHost(nodes){
    if(!nodes.length)return null;var h=nodes[0].parentElement;
    while(h&&h.id!=='app'){if(nodes.every(function(n){return h.contains(n);})){return h;}h=h.parentElement;}
    return null;
  }
  function buildStrip(){
    var nodes=sessionNodes();if(nodes.length<10)return;
    var host=commonHost(nodes);if(!host)return;
    var nav=document.getElementById(NAV_ID);
    if(!nav){nav=document.createElement('section');nav.id=NAV_ID;nav.innerHTML='<div class="eap138-strip"></div>';host.parentElement.insertBefore(nav,host);}
    var strip=nav.querySelector('.eap138-strip');strip.innerHTML='';
    nodes.forEach(function(node){
      node.classList.add('eap138-session');
      var active=/current|active|selected/i.test(node.className+' '+(node.getAttribute('aria-current')||''));
      node.classList.toggle('is-current',active);
      strip.appendChild(node);
    });
    host.classList.add('eap138-original-session-host');
  }
  function skillNodes(){
    var all=[...document.querySelectorAll('#app button,#app a[href],#app [role="button"],#app .skill-card,#app [data-skill]')].filter(function(n){return visible(n)&&!n.closest('#'+SKILL_ID);});
    var out=[];
    SKILLS.forEach(function(skill){
      var rx=new RegExp('\\b'+skill+'\\b','i');
      var candidates=all.filter(function(n){return rx.test(clean((n.dataset&&n.dataset.skill)||n.textContent));});
      candidates.sort(function(a,b){return clean(a.textContent).length-clean(b.textContent).length;});
      if(candidates[0])out.push(candidates[0]);
    });
    return out;
  }
  function buildSkills(){
    var nodes=skillNodes();if(nodes.length!==4||new Set(nodes).size!==4)return;
    var host=commonHost(nodes);if(!host)return;
    var grid=document.getElementById(SKILL_ID);
    if(!grid){grid=document.createElement('section');grid.id=SKILL_ID;var anchor=nodes[0];while(anchor.parentElement&&anchor.parentElement!==host)anchor=anchor.parentElement;anchor.parentElement.insertBefore(grid,anchor);}
    nodes.forEach(function(node){
      var card=node;while(card.parentElement&&card.parentElement!==host&&clean(card.parentElement.textContent).length<500)card=card.parentElement;
      card.classList.add('eap138-skill');grid.appendChild(card);
    });
    [...host.children].forEach(function(el){
      if(el===grid||grid.contains(el)||el.contains(grid))return;
      var t=clean(el.textContent);
      if(/ฝึกเพิ่มได้|ต้องผ่านอย่างน้อย\s*60\/100/i.test(t))el.classList.add('eap138-duplicate-note');
    });
  }
  function compactSummary(){
    var headings=[...document.querySelectorAll('#app h1,#app h2')].filter(visible);
    var h=headings.find(function(x){return /Session\s*\d+/i.test(clean(x.textContent));});
    if(h){var box=h.parentElement;while(box&&box.id!=='app'&&clean(box.textContent).length<1200)box=box.parentElement;if(box&&box.id!=='app')box.classList.add('eap138-session-summary');}
  }
  function compactPortfolio(){
    var heads=[...document.querySelectorAll('#app h1,#app h2,#app h3')].filter(visible);
    var h=heads.find(function(x){return /Recent Portfolio/i.test(clean(x.textContent));});if(!h)return;
    var box=h.parentElement;if(!box)return;box.classList.add('eap138-portfolio-collapsed');
    if(!box.querySelector('.eap138-portfolio-toggle')){
      var b=document.createElement('button');b.type='button';b.className='eap138-portfolio-toggle';b.textContent='ดู Portfolio';
      b.onclick=function(){var collapsed=box.classList.toggle('eap138-portfolio-collapsed');b.textContent=collapsed?'ดู Portfolio':'ซ่อน Portfolio';};box.appendChild(b);
    }
  }
  function hideSheetLog(){
    [...document.querySelectorAll('body *')].filter(function(n){return n.children.length===0&&/Local Sheet log:\s*\d+ attempts/i.test(clean(n.textContent));}).forEach(function(n){var p=n;for(var i=0;i<3&&p.parentElement;i++,p=p.parentElement){if(getComputedStyle(p).position==='fixed'){p.classList.add('eap138-sheet-log-hidden');break;}}});
  }
  function render(){
    if(innerWidth>760)return;style();document.body.classList.add('eap-v138-mobile');buildStrip();buildSkills();compactSummary();compactPortfolio();hideSheetLog();document.documentElement.dataset.eapMobileHubVersion=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(render,80);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('load',function(){render();setTimeout(render,500);setTimeout(render,1400);});
  addEventListener('resize',schedule);render();
})();