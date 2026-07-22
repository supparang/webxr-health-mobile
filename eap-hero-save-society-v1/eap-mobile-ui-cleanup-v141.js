/* =========================================================
   EAP Hero • Mobile UI Cleanup v141
   - Removes Local Sheet log overlay on mobile.
   - Rebuilds visible Skill options into a true 2x2 grid.
   - Hides repeated score/helper rows.
   - Compacts Skill result page and collapses duplicate formative panels.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-MOBILE-UI-CLEANUP-V141';
  var STYLE_ID='eap-mobile-ui-cleanup-v141-style';
  var GRID_ID='eap141-skill-grid';
  var timer=0;
  var SKILLS=['Reading','Writing','Listening','Speaking'];

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function visible(n){return !!(n&&n.isConnected&&n.offsetParent!==null);}
  function inject(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      @media(max-width:760px){
        body.eap141-mobile .eap141-force-hide{display:none!important;visibility:hidden!important;pointer-events:none!important}
        body.eap141-mobile #${GRID_ID}{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin:12px 0!important}
        body.eap141-mobile #${GRID_ID} .eap141-card{min-width:0!important;width:100%!important;height:145px!important;min-height:145px!important;max-height:145px!important;margin:0!important;padding:10px 8px!important;border-radius:18px!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;overflow:hidden!important}
        body.eap141-mobile #${GRID_ID} .eap141-card button,
        body.eap141-mobile #${GRID_ID} .eap141-card a{width:100%!important;min-height:40px!important;margin:0!important}
        body.eap141-mobile #${GRID_ID} .eap141-card .eap-rs-score{margin-top:7px!important;font-size:11px!important;line-height:1.25!important;text-align:center!important}
        body.eap141-mobile .eap-rs-summary{margin:10px 0!important;padding:12px!important;border-radius:16px!important}
        body.eap141-mobile .eap-rs-summary .eap-rs-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
        body.eap141-mobile .eap-rs-summary .eap-rs-chip{padding:8px!important;font-size:12px!important}
        body.eap141-mobile .eap-rs-summary .eap-rs-optional{font-size:11px!important;line-height:1.35!important;padding:8px!important}
        body.eap141-mobile.eap141-result-page #app{padding:8px 10px 88px!important;overflow-x:hidden!important}
        body.eap141-mobile.eap141-result-page .eap141-result-main{padding:12px!important;margin:0!important;border-radius:18px!important}
        body.eap141-mobile.eap141-result-page .eap141-result-main h1,
        body.eap141-mobile.eap141-result-page .eap141-result-main h2{font-size:28px!important;line-height:1.15!important;margin:6px 0 12px!important}
        body.eap141-mobile.eap141-result-page .eap141-metric-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
        body.eap141-mobile.eap141-result-page .eap141-metric{min-width:0!important;height:108px!important;min-height:108px!important;padding:10px 6px!important;margin:0!important;border-radius:15px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;text-align:center!important;box-sizing:border-box!important}
        body.eap141-mobile.eap141-result-page .eap141-metric strong,
        body.eap141-mobile.eap141-result-page .eap141-metric b{font-size:24px!important;line-height:1.1!important}
        body.eap141-mobile.eap141-result-page .eap141-metric span,
        body.eap141-mobile.eap141-result-page .eap141-metric p{font-size:11px!important;line-height:1.2!important;margin:3px 0 0!important}
        body.eap141-mobile.eap141-result-page .eap141-result-note{font-size:12px!important;line-height:1.4!important;margin:10px 0!important;padding:0 4px!important}
        body.eap141-mobile.eap141-result-page .eap141-collapsed-panel{display:none!important}
      }
      @media(max-width:390px){
        body.eap141-mobile #${GRID_ID}{gap:8px!important}
        body.eap141-mobile #${GRID_ID} .eap141-card{height:136px!important;min-height:136px!important;max-height:136px!important;padding:8px 6px!important}
        body.eap141-mobile.eap141-result-page .eap141-metric-grid{grid-template-columns:1fr!important}
        body.eap141-mobile.eap141-result-page .eap141-metric{height:86px!important;min-height:86px!important}
      }
    `;document.head.appendChild(s);
  }
  function hideSheetLog(){
    [...document.querySelectorAll('body *')].forEach(function(n){
      var t=clean(n.textContent);
      if(t.indexOf('Local Sheet log:')<0)return;
      var p=n;
      for(var i=0;i<8&&p;i++,p=p.parentElement){
        var pos='';try{pos=getComputedStyle(p).position;}catch(_){ }
        if(pos==='fixed'||pos==='sticky'||/sheet-log|local-sheet/i.test(String(p.className||'')+' '+String(p.id||''))){
          p.classList.add('eap141-force-hide');
          p.style.setProperty('display','none','important');
          break;
        }
      }
      n.classList.add('eap141-force-hide');
      n.style.setProperty('display','none','important');
    });
  }
  function skillButton(skill){
    var rx=new RegExp('\\b'+skill+'\\b','i');
    var nodes=[...document.querySelectorAll('#app button,#app a[href],#app [role="button"]')].filter(function(n){
      return visible(n)&&!n.closest('#'+GRID_ID)&&rx.test(clean(n.textContent));
    });
    nodes.sort(function(a,b){return clean(a.textContent).length-clean(b.textContent).length;});
    return nodes[0]||null;
  }
  function cardFor(node){
    if(!node)return null;
    var p=node;
    for(var i=0;i<5&&p.parentElement;i++,p=p.parentElement){
      var t=clean(p.textContent);
      if(t.length<260&&(/บังคับ|เสริม|ผ่านแล้ว|ต้องผ่าน|ฝึกเพิ่มได้/i.test(t)))return p;
    }
    return node.parentElement||node;
  }
  function buildGrid(){
    var cards=SKILLS.map(function(s){return cardFor(skillButton(s));});
    if(cards.some(function(x){return !x;})||new Set(cards).size!==4)return;
    var first=cards[0],grid=document.getElementById(GRID_ID);
    if(!grid){grid=document.createElement('section');grid.id=GRID_ID;first.parentElement.insertBefore(grid,first);}
    cards.forEach(function(card){card.classList.add('eap141-card');grid.appendChild(card);});
    [...document.querySelectorAll('#app .eap-rs-score')].forEach(function(n){
      if(!n.closest('#'+GRID_ID)&&/ฝึกเพิ่มได้|ต้องผ่านอย่างน้อย/i.test(clean(n.textContent)))n.classList.add('eap141-force-hide');
    });
  }
  function compactResult(){
    var app=document.getElementById('app');if(!app)return;
    var t=clean(app.innerText||'');
    var isResult=/Evidence Saved/i.test(t)&&/Auto Score/i.test(t);
    document.body.classList.toggle('eap141-result-page',isResult);
    if(!isResult)return;
    var main=app.querySelector('main,.wrap,.panel')||app.firstElementChild;
    if(main)main.classList.add('eap141-result-main');
    var metrics=[...app.querySelectorAll('div,section,article')].filter(function(n){
      if(!visible(n))return false;
      var x=clean(n.textContent);
      return (/^\d{1,3}\s*\/\s*100\s*Auto Score$/i.test(x)||/^\+?\d+\s*XP$/i.test(x)||/^\d+\s*Portfolio summaries$/i.test(x));
    });
    if(metrics.length>=3){
      var host=metrics[0].parentElement;
      if(metrics.every(function(n){return n.parentElement===host;})){host.classList.add('eap141-metric-grid');metrics.forEach(function(n){n.classList.add('eap141-metric');});}
    }
    [...app.querySelectorAll('p,div')].forEach(function(n){
      var x=clean(n.textContent);
      if(/คะแนนนี้เป็น auto-check เบื้องต้น/i.test(x))n.classList.add('eap141-result-note');
      if(/AI Formative Rubric|AI checklist 0%|formative, not a second grade/i.test(x)){
        var p=n;for(var i=0;i<4&&p.parentElement;i++,p=p.parentElement){if(clean(p.textContent).length<900){p.classList.add('eap141-collapsed-panel');break;}}
      }
    });
  }
  function render(){
    if(innerWidth>760)return;
    inject();document.body.classList.add('eap141-mobile');hideSheetLog();buildGrid();compactResult();document.documentElement.dataset.eapMobileCleanupVersion=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(render,90);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  addEventListener('load',function(){render();setTimeout(render,500);setTimeout(render,1400);});
  addEventListener('resize',schedule);render();
})();