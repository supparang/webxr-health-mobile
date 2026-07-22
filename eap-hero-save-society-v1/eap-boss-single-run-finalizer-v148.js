/* =========================================================
   EAP Hero • Boss Single-Run Finalizer v148
   - The adaptive Reading/Listening/Writing/Speaking run IS the Boss Gate.
   - Prevents the extra legacy Boss Clash from starting after four skills.
   - Replaces "Enter Boss Clash" with a direct Boss Defeated summary.
   - Keeps existing Boss Completion Sync working via visible Boss Defeated text.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-BOSS-SINGLE-RUN-V148';
  var timer=0;
  var NAMES={1:'Detail Trap Spider',2:'Copy-Paste Zombie',3:'Broken Paragraph Beast',4:'Plagiarism Monster',5:'Final Academic Mission'};
  var NEXT={1:'S4',2:'S7',3:'S10',4:'S13',5:'Complete'};

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function gateFromPage(){
    var app=document.getElementById('app');
    var t=text(app&&app.innerText||'');
    var m=t.match(/Boss Gate\s*([1-5])/i);
    if(m)return Number(m[1]);
    var active=text(localStorage.getItem('EAP_HERO_ACTIVE_ROUTE')||localStorage.getItem('EAP_HERO_CURRENT_ROUTE')||'');
    m=active.match(/(?:B|GATE|BOSS\s*GATE)\s*([1-5])/i);
    return m?Number(m[1]):1;
  }
  function markLocal(gate){
    try{
      var key='EAP_HERO_PROGRESS_V3';
      var state=JSON.parse(localStorage.getItem(key)||'{}')||{};
      var rid='B'+gate,next=NEXT[gate];
      state.completedSessions=state.completedSessions||{};
      state.sessionProgress=state.sessionProgress||{};
      state.unlockedRoutes=state.unlockedRoutes||{};
      state.completedSessions[rid]=true;
      state.unlockedRoutes[rid]=true;
      state.sessionProgress[rid]=Object.assign({},state.sessionProgress[rid]||{}, {
        routeId:rid,sessionId:rid,complete:true,passed:true,
        required:['Reading','Listening','Writing','Speaking'],
        passedSkills:['Reading','Listening','Writing','Speaking'],
        updatedAt:new Date().toISOString(),source:'boss_single_run_v148'
      });
      if(next&&next!=='Complete'){
        state.unlockedRoutes[next]=true;
        state.currentRoute=next;
        state.currentCloudRoute=next;
      }
      state.lastBossSingleRun={gate:rid,nextRoute:next,at:new Date().toISOString(),version:VERSION};
      localStorage.setItem(key,JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('eap:boss-single-run-complete',{detail:{gate:rid,nextRoute:next,state:state,version:VERSION}}));
      window.dispatchEvent(new StorageEvent('storage',{key:key,newValue:JSON.stringify(state),storageArea:localStorage}));
    }catch(_){ }
  }
  function renderResult(gate){
    var app=document.getElementById('app');if(!app)return;
    var rid='B'+gate,boss=NAMES[gate]||rid,next=NEXT[gate]||'';
    app.innerHTML=''+
      '<main class="wrap" style="max-width:1100px;margin:auto;padding:20px">'+
      '<section class="panel" style="margin-top:18px;text-align:center;padding:28px">'+
      '<div style="font-size:72px;line-height:1">🏆</div>'+
      '<div class="badges" style="justify-content:center;margin:12px 0"><span class="pill">'+rid+' Boss Gate</span><span class="pill">Single Run Complete</span></div>'+
      '<h1 style="margin:8px 0">Boss Defeated!</h1>'+
      '<h3>'+boss+'</h3>'+
      '<p class="lead">คุณผ่าน Reading, Listening, Writing และ Speaking ครบใน Boss Gate รอบเดียวแล้ว</p>'+
      '<div class="grid four" style="margin:18px 0">'+
      '<div class="stat"><b>Reading</b><span>✓ Complete</span></div>'+
      '<div class="stat"><b>Listening</b><span>✓ Complete</span></div>'+
      '<div class="stat"><b>Writing</b><span>✓ Complete</span></div>'+
      '<div class="stat"><b>Speaking</b><span>✓ Complete</span></div></div>'+
      '<div class="panel light" style="margin:16px 0"><b>100% Accuracy</b><p class="mini-note">Boss Gate complete · ไม่ต้องเล่น Boss Clash ซ้ำ</p></div>'+
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">'+
      '<button type="button" class="btn primary" id="eap148Map">กลับแผนที่</button>'+
      '<button type="button" class="btn ghost" id="eap148Report">My Learning Report</button>'+
      '</div>'+
      (next&&next!=='Complete'?'<p class="mini-note" style="margin-top:14px">ด่านถัดไป: '+next+'</p>':'')+
      '</section></main>';
    markLocal(gate);
    setTimeout(function(){window.dispatchEvent(new CustomEvent('eap:boss-defeated-visible',{detail:{gate:rid,version:VERSION}}));},50);
    var map=document.getElementById('eap148Map');
    if(map)map.onclick=function(){if(window.EAPHero&&typeof window.EAPHero.home==='function')window.EAPHero.home();else location.reload();};
    var report=document.getElementById('eap148Report');
    if(report)report.onclick=function(){if(window.EAPHero&&typeof window.EAPHero.report==='function')window.EAPHero.report();};
  }
  function patchButton(){
    var old=document.getElementById('enterBossClash');
    if(!old||old.dataset.eap148==='true')return;
    var fresh=old.cloneNode(true);
    fresh.dataset.eap148='true';
    fresh.textContent='Finish Boss Gate';
    old.parentNode.replaceChild(fresh,old);
    fresh.addEventListener('click',function(event){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      renderResult(gateFromPage());
    },true);
  }
  function scan(){patchButton();document.documentElement.dataset.eapBossSingleRunVersion=VERSION;}
  function schedule(){clearTimeout(timer);timer=setTimeout(scan,60);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',function(){scan();setTimeout(scan,500);});
  scan();
})();