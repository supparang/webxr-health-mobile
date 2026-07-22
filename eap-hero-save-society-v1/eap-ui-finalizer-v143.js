/* =========================================================
   EAP Hero • UI Finalizer v143
   - Tracks the latest clicked Session and corrects stale Session summary labels.
   - Replaces the legacy Recent Portfolio table with the canonical v142 card list.
   - Compacts desktop/mobile result pages by collapsing duplicate panels.
   - Hides local Sheet log on student UI.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-UI-FINALIZER-V143';
  var SELECTED_KEY='EAP_UI_SELECTED_SESSION_V143';
  var STYLE_ID='eap-ui-finalizer-v143-style';
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function sid(v){var m=clean(v).toUpperCase().match(/(?:SESSION\s*:?[ ]*|\bS)(1[0-5]|[1-9])\b/);return m?'S'+Number(m[1]):'';}
  function remember(v){var s=sid(v);if(!s)return;try{sessionStorage.setItem(SELECTED_KEY,s);}catch(_){ }window.EAPUISelectedSession=s;}
  function selected(){try{return window.EAPUISelectedSession||sessionStorage.getItem(SELECTED_KEY)||'';}catch(_){return window.EAPUISelectedSession||'';}}
  function inject(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .eap143-hide{display:none!important;visibility:hidden!important;pointer-events:none!important}
      .eap143-result-compact{max-width:1120px!important;margin:0 auto!important}
      .eap143-result-compact .eap143-collapse{display:none!important}
      .eap143-result-compact .eap143-actions{display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin:12px 0!important}
      .eap143-result-compact .eap143-actions>*{min-height:42px!important}
      .eap143-result-compact .eap143-reward{margin-top:12px!important;max-height:250px!important;overflow:auto!important}
      .eap143-portfolio-host>table{display:none!important}
      @media(max-width:760px){
        .eap143-result-compact{padding:8px!important}
        .eap143-result-compact .eap143-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .eap143-result-compact .eap143-reward{max-height:180px!important}
      }
    `;document.head.appendChild(s);
  }
  function hideSheetLog(){
    [...document.querySelectorAll('body *')].forEach(function(n){
      if(clean(n.textContent).indexOf('Local Sheet log:')<0)return;
      var p=n;
      for(var i=0;i<8&&p;i++,p=p.parentElement){
        var pos='';try{pos=getComputedStyle(p).position;}catch(_){ }
        if(pos==='fixed'||pos==='sticky'||/sheet-log|local-sheet/i.test(String(p.className||'')+' '+String(p.id||''))){p.classList.add('eap143-hide');p.style.setProperty('display','none','important');break;}
      }
      n.classList.add('eap143-hide');n.style.setProperty('display','none','important');
    });
  }
  function correctSessionSummary(){
    var s=selected();if(!s)return;
    var n=Number(s.slice(1));
    [...document.querySelectorAll('#app .eap-rs-summary')].forEach(function(box){
      box.dataset.session=String(n);
      var h=box.querySelector('h3');if(h)h.textContent='🎯 Skill บังคับของ Session '+n;
    });
    [...document.querySelectorAll('#app h1,#app h2')].forEach(function(h){
      var t=clean(h.textContent);
      if(/^Session\s+\d+\s*:/i.test(t)&&!new RegExp('^Session\\s+'+n+'\\s*:','i').test(t)){
        h.textContent=t.replace(/^Session\s+\d+/i,'Session '+n);
      }
    });
  }
  function replacePortfolio(){
    [...document.querySelectorAll('#app table')].forEach(function(table){
      var t=clean(table.innerText).toLowerCase();
      if(t.indexOf('session')<0||t.indexOf('skill')<0||t.indexOf('score')<0)return;
      var host=table.parentElement||table;host.classList.add('eap143-portfolio-host');
      table.classList.add('eap143-hide');table.style.setProperty('display','none','important');
      var summary=host.querySelector('.eap142-summary');
      if(summary){summary.style.setProperty('display','grid','important');summary.classList.remove('eap143-hide');}
    });
  }
  function compactResult(){
    var app=document.getElementById('app');if(!app)return;
    var t=clean(app.innerText||'');if(!/Evidence Saved/i.test(t))return;
    var root=app.querySelector('main,.wrap')||app.firstElementChild||app;root.classList.add('eap143-result-compact');
    [...app.querySelectorAll('section,div,article')].forEach(function(n){
      var x=clean(n.textContent);
      if(/AI Formative Rubric/i.test(x)&&x.length<2200)n.classList.add('eap143-collapse');
      if(/REWARD CHOICE|Mission complete\. Choose your support reward/i.test(x)&&x.length<2600)n.classList.add('eap143-reward');
    });
    var actions=[...app.querySelectorAll('button,a')].filter(function(n){return /Back to S\d+ Skills|Continue Map|My Learning Report|AI Learning Center|Boss Contract/i.test(clean(n.textContent));});
    if(actions.length){var host=actions[0].parentElement;if(host&&actions.every(function(n){return n.parentElement===host;}))host.classList.add('eap143-actions');}
  }
  function run(){inject();hideSheetLog();correctSessionSummary();replacePortfolio();compactResult();document.documentElement.dataset.eapUIFinalizerVersion=VERSION;}
  function schedule(){clearTimeout(timer);timer=setTimeout(run,100);}
  document.addEventListener('click',function(e){
    var n=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!n)return;
    var t=clean(n.textContent);if(/^S(?:1[0-5]|[1-9])(?:\s|$)/i.test(t)){remember(t);setTimeout(schedule,40);}
  },true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  addEventListener('load',function(){run();setTimeout(run,500);setTimeout(run,1500);});
  run();
})();