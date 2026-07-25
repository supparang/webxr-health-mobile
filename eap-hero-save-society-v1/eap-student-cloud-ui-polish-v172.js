/* =========================================================
   EAP Hero • Student Cloud UI Polish v172
   - Removes legacy/local Sheet controls from the student view.
   - Clarifies that skill evidence messages apply to the current route.
   - Gives Recent Portfolio an explicit Cloud/Sheet empty state.
   - Never derives route, unlocks, scores, or completion locally.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_STUDENT_CLOUD_UI_POLISH_V172__)return;
  window.__EAP_STUDENT_CLOUD_UI_POLISH_V172__=true;

  var VERSION='20260725-EAP-STUDENT-CLOUD-UI-POLISH-V172';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var STYLE_ID='eap-student-cloud-ui-polish-v172-style';
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch(_){return{};}}
  function route(){var s=read(),v=clean(s.currentCloudRoute||s.currentRoute||'').toUpperCase();return /^(?:S(?:1[0-5]|[1-9])|B[1-5])$/.test(v)?v:'';}
  function visible(n){return !!(n&&n.isConnected&&n.offsetParent!==null);}
  function inject(){
    if(document.getElementById(STYLE_ID))return;
    var st=document.createElement('style');st.id=STYLE_ID;st.textContent=`
      .eap-v172-hide{display:none!important}
      .eap-v172-empty{padding:15px 14px!important;text-align:center!important;color:#d6e7f4!important;background:rgba(16,42,66,.72)!important;border:1px dashed rgba(122,211,198,.46)!important;border-radius:14px!important;font-weight:750!important;line-height:1.5!important}
      .eap-v172-scope{display:block!important;margin-top:5px!important;color:#8de8d7!important;font-size:12px!important;font-weight:850!important;line-height:1.35!important}
    `;document.head.appendChild(st);
  }
  function hideLegacySheetControls(){
    var tests=[
      /^Local Sheet log:\s*\d+\s*attempts/i,
      /ส่งผลล่าสุดเข้า\s*Sheet/i,
      /ส่งผลล่าสุด.*Sheet/i
    ];
    [...document.querySelectorAll('body *')].forEach(function(n){
      if(!visible(n))return;
      var t=clean(n.textContent);if(!tests.some(function(rx){return rx.test(t);})){return;}
      var target=n;
      for(var i=0;i<7&&target&&target!==document.body;i++,target=target.parentElement){
        var cs;try{cs=getComputedStyle(target);}catch(_){cs=null;}
        if((cs&&(/fixed|sticky/.test(cs.position)))||target.tagName==='BUTTON'||target.tagName==='A'){
          target.classList.add('eap-v172-hide');target.setAttribute('aria-hidden','true');return;
        }
      }
      n.classList.add('eap-v172-hide');n.setAttribute('aria-hidden','true');
    });
  }
  function clarifySkillScope(){
    var rid=route();if(!rid)return;
    [...document.querySelectorAll('#app *')].forEach(function(n){
      if(!visible(n)||n.children.length>4)return;
      var t=clean(n.textContent);
      if(!/(ยังไม่พบหลักฐาน|ยังไม่มีหลักฐาน|ไม่พบหลักฐาน)/i.test(t))return;
      if(!/(Reading|Writing|Listening|Speaking|Skill)/i.test(t))return;
      if(t.indexOf(rid)>=0)return;
      var mark=n.querySelector(':scope > .eap-v172-scope');
      if(!mark){mark=document.createElement('span');mark.className='eap-v172-scope';n.appendChild(mark);}
      mark.textContent='สถานะนี้เป็นหลักฐานของ '+rid+' เท่านั้น';
    });
  }
  function portfolioBox(){
    var h=[...document.querySelectorAll('#app h1,#app h2,#app h3,#app h4')].filter(visible).find(function(n){return /Recent Portfolio/i.test(clean(n.textContent));});
    return h?h.parentElement:null;
  }
  function polishPortfolio(){
    var box=portfolioBox();if(!box)return;
    var table=box.querySelector('table');
    var rows=table?[...table.querySelectorAll('tbody tr')].filter(function(r){return clean(r.textContent)!=='';}):[];
    var old=box.querySelector('.eap-v172-empty');
    if(rows.length){if(old)old.remove();return;}
    if(!old){old=document.createElement('div');old.className='eap-v172-empty';box.appendChild(old);}
    var rid=route();
    old.textContent=rid
      ?'ยังไม่มีหลักฐานรายทักษะของ '+rid+' ที่ยืนยันและแสดงได้จาก Google Sheet'
      :'ยังไม่มีหลักฐานรายทักษะที่ยืนยันและแสดงได้จาก Google Sheet';
    if(table)table.setAttribute('aria-label','Recent Portfolio — no verified Cloud records to display');
  }
  function render(){inject();hideLegacySheetControls();clarifySkillScope();polishPortfolio();document.documentElement.dataset.eapStudentCloudUiVersion=VERSION;}
  function schedule(){clearTimeout(timer);timer=setTimeout(render,90);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:resume-synced','eap:profile-changed'].forEach(function(n){window.addEventListener(n,schedule);});
  setTimeout(render,100);setTimeout(render,700);setInterval(render,2200);
})();
