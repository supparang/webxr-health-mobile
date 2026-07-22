/* =========================================================
   EAP Hero • Single Map + Direct Skill Flow v157
   - One Campus Map only.
   - Hide duplicate Learning Route / roadmap / duplicate session-card map.
   - Inside a Session, keep only title, official-route notice, skill choices,
     skill progress, portfolio/evidence and Boss state.
   - UI only. Google Sheet / Cloud Resume remains authority.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-SINGLE-MAP-SESSION-FLOW-V157';
  var STYLE_ID='eap-single-map-session-flow-v157-style';
  var timer=0;

  function text(n){return String(n&&n.textContent||'').replace(/\s+/g,' ').trim();}
  function visible(n){return !!(n&&n.isConnected&&n.offsetParent!==null);}
  function hide(n,reason){
    if(!n||n.dataset.eapSingleFlowHidden==='1')return;
    n.dataset.eapSingleFlowHidden='1';
    n.dataset.eapSingleFlowReason=reason||'';
    n.style.setProperty('display','none','important');
    n.setAttribute('aria-hidden','true');
  }
  function style(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;
    s.textContent='\
      body.eap-single-map-v157 #eap-student-15week-roadmap{display:none!important}\
      body.eap-single-map-v157 [data-eap-roadmap-card]{display:none!important}\
      body.eap-single-map-v157 .eap-single-flow-note{margin:10px 0 14px;padding:11px 14px;border:1px solid #2d6c88;border-radius:13px;background:#0d3147;color:#dff7ff;font:800 13px/1.45 system-ui}\
      body.eap-single-map-v157 .eap-single-flow-note b{color:#69f0d0}\
      body.eap-single-map-v157 .eap-single-flow-session-title{margin-bottom:10px!important}\
    ';
    document.head.appendChild(s);
  }
  function pageMode(){
    var app=document.getElementById('app');if(!app)return'other';
    var t=text(app);
    if(/Campus Map/i.test(t))return'map';
    if(/Session\s*:?\s*(1[0-5]|[1-9])\b/i.test(t)&&/(Reading|Writing|Listening|Speaking)/i.test(t))return'session';
    return'other';
  }
  function closestBlock(n){
    if(!n)return null;
    return n.closest('section,article,aside,.panel,.card,.box,.route-card,.roadmap,div');
  }
  function hideByHeading(rx,reason){
    document.querySelectorAll('#app h1,#app h2,#app h3,#app h4,#app strong').forEach(function(h){
      if(rx.test(text(h))){var b=closestBlock(h);if(b&&b.id!=='app')hide(b,reason);}
    });
  }
  function simplifyMap(){
    document.body.classList.add('eap-single-map-v157');
    var legacy=document.getElementById('eap-student-15week-roadmap');if(legacy)hide(legacy,'duplicate_roadmap');
    hideByHeading(/^Learning Route$/i,'duplicate_learning_route');
    hideByHeading(/EAP Hero 15-Week Learning Path/i,'duplicate_roadmap');

    /* Hide the second map made from large Session cards. Keep the compact
       five-zone Campus Map above it. */
    var cards=[].slice.call(document.querySelectorAll('#app [class*="session-card"],#app [data-session],#app [data-route-id]'));
    cards.forEach(function(c){
      var v=text(c);
      if(/^SESSION\s*(1[0-5]|[1-9])\b/i.test(v)&&/Session Passed|Session not passed|avg\s*\d+/i.test(v))hide(c,'duplicate_session_card_map');
    });
    var noteId='eap-single-map-note-v157';
    if(!document.getElementById(noteId)){
      var heading=[].slice.call(document.querySelectorAll('#app h1,#app h2')).find(function(n){return /^Campus Map$/i.test(text(n));});
      if(heading){
        var n=document.createElement('div');n.id=noteId;n.className='eap-single-flow-note';
        n.innerHTML='<b>แผนที่หลักเพียงอันเดียว</b> — กด Session ที่เปิดแล้วเพื่อเข้าไปเลือก Reading, Writing, Listening หรือ Speaking';
        heading.insertAdjacentElement('afterend',n);
      }
    }
  }
  function simplifySession(){
    document.body.classList.add('eap-single-map-v157');
    /* Remove presentation/game framing that duplicates the actual skill hub. */
    hideByHeading(/^(Rescue Plan|Save .* in 3 moves)$/i,'session_rescue_plan');
    hideByHeading(/^Mission Board$/i,'session_mission_board');
    document.querySelectorAll('#app *').forEach(function(n){
      if(!visible(n)||n.children.length>0)return;
      var v=text(n);
      if(/^(Scout|Build|Rescue|Focus Route|Support Route)$/i.test(v)){
        var b=closestBlock(n);if(b&&b.id!=='app')hide(b,'session_extra_flow');
      }
    });
    var title=[].slice.call(document.querySelectorAll('#app h1,#app h2')).find(function(n){return /Session\s*:?\s*(1[0-5]|[1-9])\b/i.test(text(n));});
    if(title)title.classList.add('eap-single-flow-session-title');
    var id='eap-single-session-note-v157';
    if(title&&!document.getElementById(id)){
      var n=document.createElement('div');n.id=id;n.className='eap-single-flow-note';
      n.innerHTML='<b>เลือก Skill ได้เลย</b> — ทำ Skill ที่กำหนดให้ครบ แล้วระบบจะบันทึกหลักฐานและปลด Boss ตามข้อมูลจาก Google Sheet';
      title.insertAdjacentElement('afterend',n);
    }
  }
  function reconcile(){
    style();
    var mode=pageMode();
    if(mode==='map')simplifyMap();
    if(mode==='session')simplifySession();
    document.documentElement.dataset.eapSingleMapSessionFlowVersion=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(reconcile,100);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:resume-synced'].forEach(function(e){window.addEventListener(e,schedule);});
  document.addEventListener('click',function(){setTimeout(reconcile,120);},true);
  setTimeout(reconcile,100);setTimeout(reconcile,900);setTimeout(reconcile,2200);
  window.EAPSingleMapSessionFlow={version:VERSION,reconcile:reconcile};
})();