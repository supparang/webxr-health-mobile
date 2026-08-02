/* =========================================================
   EAP Hero • Student Cloud UI Polish v173
   - Removes legacy/local Sheet controls from the student view.
   - Clarifies evidence scope for the current route.
   - Renders cloud-confirmed player_resume records directly into the
     canonical Recent Portfolio table after every other UI runtime.
   - Never derives route, unlocks, scores, or completion locally.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_STUDENT_CLOUD_UI_POLISH_V173__)return;
  window.__EAP_STUDENT_CLOUD_UI_POLISH_V173__=true;

  var VERSION='20260802-EAP-STUDENT-CLOUD-UI-POLISH-V173-PORTFOLIO';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var STYLE_ID='eap-student-cloud-ui-polish-v173-style';
  var timer=0;
  var SKILLS=['Reading','Writing','Listening','Speaking'];

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function esc(v){return clean(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function read(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch(_){return{};}}
  function route(){var s=read(),v=clean(s.currentCloudRoute||s.currentRoute||'').toUpperCase();return /^(?:S(?:1[0-5]|[1-9])|B[1-5])$/.test(v)?v:'';}
  function visible(n){return !!(n&&n.isConnected&&n.offsetParent!==null);}
  function sessionOf(v){var m=clean(v).toUpperCase().match(/(?:SESSION\s*:?\s*|\bS)(1[0-5]|[1-9])\b/);return m?'S'+Number(m[1]):'';}
  function skillOf(v){var t=clean(v).toLowerCase();for(var i=0;i<SKILLS.length;i++){if(t.indexOf(SKILLS[i].toLowerCase())>=0)return SKILLS[i];}return '';}
  function scoreOf(r){var vals=[r&&r.bestScore,r&&r.latestScore,r&&r.score,r&&r.autoScore,r&&r.missionTaskScore,r&&r.accuracy];for(var i=0;i<vals.length;i++){var n=Number(vals[i]);if(Number.isFinite(n)&&n>=0&&n<=100)return n;}return 0;}
  function stampOf(r){var vals=[r&&r.updatedAt,r&&r.submittedAt,r&&r.latestAt,r&&r.completedAt,r&&r.createdAt,r&&r.clientTimestamp,r&&r.timestamp];for(var i=0;i<vals.length;i++){if(!vals[i])continue;var d=new Date(vals[i]);if(!Number.isNaN(d.getTime()))return d.toISOString();}return '';}
  function dateTH(v){if(!v)return 'ไม่ระบุเวลา';var d=new Date(v);if(Number.isNaN(d.getTime()))return 'ไม่ระบุเวลา';return new Intl.DateTimeFormat('th-TH',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}).format(d);}

  function inject(){
    if(document.getElementById(STYLE_ID))return;
    var st=document.createElement('style');st.id=STYLE_ID;st.textContent=`
      .eap-v173-hide{display:none!important}
      .eap-v173-scope{display:block!important;margin-top:5px!important;color:#8de8d7!important;font-size:12px!important;font-weight:850!important;line-height:1.35!important}
      .eap-v173-verified{color:#86efac!important;font-weight:900!important}
      .eap-v173-empty{text-align:center!important;padding:16px!important;color:#d6e7f4!important}
    `;document.head.appendChild(st);
  }

  function hideLegacySheetControls(){
    var tests=[/^Local Sheet log:\s*\d+\s*attempts/i,/ส่งผลล่าสุดเข้า\s*Sheet/i,/ส่งผลล่าสุด.*Sheet/i];
    Array.from(document.querySelectorAll('body *')).forEach(function(n){
      if(!visible(n))return;var t=clean(n.textContent);if(!tests.some(function(rx){return rx.test(t);})){return;}
      var target=n;
      for(var i=0;i<7&&target&&target!==document.body;i++,target=target.parentElement){
        var cs;try{cs=getComputedStyle(target);}catch(_){cs=null;}
        if((cs&&(/fixed|sticky/.test(cs.position)))||target.tagName==='BUTTON'||target.tagName==='A'){target.classList.add('eap-v173-hide');target.setAttribute('aria-hidden','true');return;}
      }
      n.classList.add('eap-v173-hide');n.setAttribute('aria-hidden','true');
    });
  }

  function clarifySkillScope(){
    var rid=route();if(!rid)return;
    Array.from(document.querySelectorAll('#app *')).forEach(function(n){
      if(!visible(n)||n.children.length>4)return;var t=clean(n.textContent);
      if(!/(ยังไม่พบหลักฐาน|ยังไม่มีหลักฐาน|ไม่พบหลักฐาน)/i.test(t))return;
      if(!/(Reading|Writing|Listening|Speaking|Skill)/i.test(t))return;
      if(t.indexOf(rid)>=0)return;
      var mark=n.querySelector(':scope > .eap-v173-scope');if(!mark){mark=document.createElement('span');mark.className='eap-v173-scope';n.appendChild(mark);}mark.textContent='สถานะนี้เป็นหลักฐานของ '+rid+' เท่านั้น';
    });
  }

  function collectCloudRecords(){
    var s=read(),server=s.serverResume||{},rows=[];
    ['records','attempts','summaries','summary','skillRecords'].forEach(function(k){if(Array.isArray(server[k]))rows=rows.concat(server[k]);});
    var map={};
    rows.forEach(function(r){
      var session=sessionOf(r&&((r.sessionId||r.routeId||r.session||r.sessionCode||r.taskId)));
      var skill=skillOf(r&&((r.skill||r.skillName||r.evidenceType||r.type||r.taskId)));
      var score=scoreOf(r),timestamp=stampOf(r);
      if(!session||!skill||score<=0)return;
      if(r&&((r.legacyCompletion===true)||String(r.legacyCompletion).toUpperCase()==='TRUE'))return;
      var key=session+'|'+skill,old=map[key],rec={sessionId:session,skill:skill,score:score,timestamp:timestamp};
      if(!old||rec.score>old.score||(rec.score===old.score&&rec.timestamp>old.timestamp))map[key]=rec;
    });
    return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){if(a.timestamp&&b.timestamp&&a.timestamp!==b.timestamp)return b.timestamp.localeCompare(a.timestamp);return Number(b.sessionId.slice(1))-Number(a.sessionId.slice(1));}).slice(0,12);
  }

  function canonicalPortfolioTable(){
    var tables=Array.from(document.querySelectorAll('#app table'));
    return tables.find(function(table){var h=Array.from(table.querySelectorAll('thead th,tr:first-child th,tr:first-child td')).map(function(n){return clean(n.textContent).toLowerCase();}).join('|');return h.indexOf('session')>=0&&h.indexOf('skill')>=0&&h.indexOf('score')>=0&&(h.indexOf('output')>=0||h.indexOf('ผลลัพธ์')>=0);})||null;
  }

  function renderPortfolio(){
    var table=canonicalPortfolioTable();if(!table)return;
    var tbody=table.tBodies&&table.tBodies[0];if(!tbody){tbody=document.createElement('tbody');table.appendChild(tbody);}
    var rows=collectCloudRecords();
    if(!rows.length){tbody.innerHTML='<tr><td colspan="5" class="eap-v173-empty">ยังไม่มีผลการทำภารกิจที่ยืนยันจาก Google Sheet</td></tr>';return;}
    tbody.innerHTML=rows.map(function(r){return '<tr data-eap-cloud-verified="true"><td>'+esc(dateTH(r.timestamp))+'</td><td>'+esc(r.sessionId)+'</td><td>'+esc(r.skill)+'</td><td><strong>'+r.score+'/100</strong></td><td class="eap-v173-verified">ยืนยันจาก Google Sheet แล้ว</td></tr>';}).join('');
    table.dataset.eapPortfolioVersion=VERSION;
  }

  function render(){inject();hideLegacySheetControls();clarifySkillScope();renderPortfolio();document.documentElement.dataset.eapStudentCloudUiVersion=VERSION;}
  function schedule(){clearTimeout(timer);timer=setTimeout(render,90);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:resume-synced','eap:cloud-resume-applied','eap:live-sheet-authority-applied','eap:profile-changed'].forEach(function(n){window.addEventListener(n,schedule);});
  setTimeout(render,100);setTimeout(render,700);setInterval(render,1200);
})();
