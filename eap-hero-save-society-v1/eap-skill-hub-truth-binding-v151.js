/* =========================================================
   EAP Hero • Skill Hub Truth Binding v151
   - Binds Session selector, detail panel, and Recent Portfolio to
     EAPProgressTruthResolver only.
   - Enforces sequential access: passed sessions + first incomplete session.
   - Blocks future Session clicks even when old local evidence exists.
   - Replaces legacy portfolio table with canonical truth records.
   - Does not change official Sheet authority or Boss unlock rules.
========================================================= */
(function(){
  'use strict';

  var VERSION='20260722-EAP-SKILL-HUB-TRUTH-BINDING-V151';
  var STYLE_ID='eap-skill-hub-truth-binding-v151-style';
  var PORTFOLIO_ID='eap-truth-portfolio-v151';
  var NOTICE_ID='eap-session-lock-notice-v151';
  var timer=0;
  var lastAllowed=1;
  var lastSelected=1;
  var PASS=60;
  var SKILLS=['Reading','Writing','Listening','Speaking'];

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function visible(n){return !!(n&&n.isConnected&&n.offsetParent!==null);}
  function esc(v){return clean(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function numFromSession(v){var m=clean(v).toUpperCase().match(/(?:SESSION\s*|\bS)(1[0-5]|[1-9])\b/);return m?Number(m[1]):0;}
  function score(r){var vals=[r&&r.bestScore,r&&r.latestScore,r&&r.score,r&&r.autoScore,r&&r.missionTaskScore];for(var i=0;i<vals.length;i++){var n=Number(vals[i]);if(Number.isFinite(n)&&n>=0&&n<=100)return n;}return 0;}
  function stamp(r){var vals=[r&&r.updatedAt,r&&r.latestAt,r&&r.completedAt,r&&r.createdAt,r&&r.clientTimestamp,r&&r.timestamp];for(var i=0;i<vals.length;i++){var d=new Date(vals[i]);if(vals[i]&&!isNaN(d.getTime()))return d;}return null;}
  function formatDate(r){var d=stamp(r);if(!d)return 'ล่าสุด';try{return new Intl.DateTimeFormat('th-TH',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}).format(d);}catch(_){return 'ล่าสุด';}}
  function output(r){var vals=[r&&r.studentOutput,r&&r.output,r&&r.answer,r&&r.response,r&&r.reflection,r&&r.summary];for(var i=0;i<vals.length;i++){var t=clean(vals[i]);if(t&&!/legacy evidence|browser-storage migration|pending sheet sync/i.test(t))return t;}return 'บันทึกหลักฐานการเรียนรู้แล้ว';}

  function truth(){
    var api=window.EAPProgressTruthResolver;
    if(!api)return null;
    var d=null;
    try{d=typeof api.diagnostics==='function'?api.diagnostics():null;}catch(_){d=null;}
    var progress=d&&d.sessionProgress||{};
    var records=(d&&d.records)||api.records||[];
    var firstIncomplete=16;
    for(var i=1;i<=15;i++){
      var row=progress['S'+i]||progress[String(i)]||{};
      if(row.passed!==true&&row.complete!==true){firstIncomplete=i;break;}
    }
    return {api:api,progress:progress,records:Array.isArray(records)?records:[],allowed:Math.min(firstIncomplete,15),allPassed:firstIncomplete===16};
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .eap151-session-locked{opacity:.48!important;filter:grayscale(.55)!important;cursor:not-allowed!important;position:relative!important}
      .eap151-session-locked::after{content:'🔒';position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:14px}
      .eap151-session-passed{box-shadow:inset 0 0 0 2px rgba(52,211,153,.42)!important}
      .eap151-session-current{box-shadow:inset 0 0 0 3px rgba(125,211,252,.85)!important}
      #${NOTICE_ID}{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;max-width:min(540px,calc(100vw - 28px));padding:13px 18px;border-radius:16px;background:#7f1d1d;color:#fff;font-weight:900;box-shadow:0 16px 36px rgba(0,0,0,.35);text-align:center}
      .eap151-legacy-portfolio{display:none!important}
      #${PORTFOLIO_ID}{display:grid;gap:9px;margin-top:10px}
      #${PORTFOLIO_ID} .eap151-row{display:grid;grid-template-columns:64px 105px 1fr auto;gap:10px;align-items:center;padding:11px 12px;border:1px solid rgba(148,163,184,.22);border-radius:14px;background:#213a53;color:#f8fafc}
      #${PORTFOLIO_ID} .eap151-session{font-weight:950;color:#a7f3d0}
      #${PORTFOLIO_ID} .eap151-skill{font-weight:850}
      #${PORTFOLIO_ID} .eap151-output{min-width:0;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
      #${PORTFOLIO_ID} .eap151-score{font-weight:950;color:#a7f3d0}
      #${PORTFOLIO_ID} .eap151-empty{padding:16px;border-radius:14px;background:#213a53;color:#cbd5e1;text-align:center}
      @media(max-width:760px){
        #${PORTFOLIO_ID} .eap151-row{grid-template-columns:48px 82px 1fr auto;padding:9px 10px;gap:7px}
        #${PORTFOLIO_ID} .eap151-output{display:none}
      }
    `;document.head.appendChild(s);
  }

  function sessionButtons(){
    var map={};
    [...document.querySelectorAll('#app button,#app a[href],#app [role="button"]')].forEach(function(n){
      if(!visible(n))return;
      var t=clean(n.textContent),m=t.match(/^S(1[0-5]|[1-9])(?:\s|$)/i);
      if(!m)return;
      var id=Number(m[1]);
      if(!map[id]||clean(n.textContent).length<clean(map[id].textContent).length)map[id]=n;
    });
    return map;
  }

  function showNotice(message){
    var old=document.getElementById(NOTICE_ID);if(old)old.remove();
    var n=document.createElement('div');n.id=NOTICE_ID;n.textContent=message;document.body.appendChild(n);
    setTimeout(function(){if(n.isConnected)n.remove();},2600);
  }

  function applySessionLocks(t){
    var buttons=sessionButtons();
    lastAllowed=t.allowed;
    Object.keys(buttons).forEach(function(k){
      var id=Number(k),b=buttons[id],row=t.progress['S'+id]||t.progress[String(id)]||{};
      var passed=row.passed===true||row.complete===true;
      var locked=id>t.allowed;
      b.dataset.eapSessionId='S'+id;
      b.dataset.eapTruthLocked=locked?'true':'false';
      b.classList.toggle('eap151-session-locked',locked);
      b.classList.toggle('eap151-session-passed',passed&&!locked);
      b.classList.toggle('eap151-session-current',id===t.allowed&&!passed);
      b.setAttribute('aria-disabled',locked?'true':'false');
      if(locked)b.setAttribute('title','ต้องผ่าน S'+t.allowed+' ก่อน');else b.removeAttribute('title');
    });

    var selected=[...document.querySelectorAll('#app button,#app a[href],#app [role="button"]')].find(function(n){
      return visible(n)&&/active|selected|current/i.test(String(n.className||'')+' '+String(n.getAttribute('aria-current')||''))&&numFromSession(n.textContent)>0;
    });
    var selectedId=selected?numFromSession(selected.textContent):0;
    if(selectedId)lastSelected=selectedId;
    if(selectedId>t.allowed&&buttons[t.allowed]){
      buttons[t.allowed].click();
      lastSelected=t.allowed;
      showNotice('Session นี้ยังล็อกอยู่ ระบบพากลับไป S'+t.allowed);
    }
  }

  function canonicalRecords(t){
    var map={};
    t.records.forEach(function(r){
      var id=numFromSession(r&&[r.sessionId,r.routeId,r.session,r.taskId].join(' '));
      var sk=SKILLS.find(function(s){return clean(r&&[r.skill,r.skillName,r.evidenceType,r.taskId].join(' ')).toLowerCase().indexOf(s.toLowerCase())>=0;})||'';
      var sc=score(r);
      if(!id||!sk||sc<=0||id>t.allowed)return;
      var key='S'+id+'|'+sk,old=map[key];
      if(!old||sc>score(old)||(sc===score(old)&&(stamp(r)||0)>(stamp(old)||0)))map[key]=r;
    });
    return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){
      var da=stamp(a),db=stamp(b);if(da&&db)return db-da;
      var sa=numFromSession(a&&[a.sessionId,a.routeId,a.session].join(' ')),sb=numFromSession(b&&[b.sessionId,b.routeId,b.session].join(' '));
      return sb-sa;
    });
  }

  function findPortfolioArea(){
    var heading=[...document.querySelectorAll('#app h1,#app h2,#app h3,#app h4')].find(function(n){return visible(n)&&/Recent Portfolio/i.test(clean(n.textContent));});
    if(!heading)return null;
    var host=heading.parentElement||heading;
    return {heading:heading,host:host};
  }

  function renderPortfolio(t){
    var area=findPortfolioArea();if(!area)return;
    [...area.host.querySelectorAll('table,.table-wrap,.eap142-summary,.eap-recent-portfolio-truth,.portfolio-table')].forEach(function(n){n.classList.add('eap151-legacy-portfolio');});
    var rows=canonicalRecords(t),box=document.getElementById(PORTFOLIO_ID);
    if(!box){box=document.createElement('div');box.id=PORTFOLIO_ID;area.host.appendChild(box);}
    if(!rows.length){box.innerHTML='<div class="eap151-empty">ยังไม่มีหลักฐานที่นับตามเส้นทางปัจจุบัน</div>';return;}
    box.innerHTML=rows.slice(0,15).map(function(r){
      var id=numFromSession([r.sessionId,r.routeId,r.session].join(' '));
      var sk=SKILLS.find(function(s){return clean([r.skill,r.skillName,r.evidenceType].join(' ')).toLowerCase().indexOf(s.toLowerCase())>=0;})||'-';
      return '<div class="eap151-row"><div class="eap151-session">S'+id+'</div><div class="eap151-skill">'+esc(sk)+'</div><div class="eap151-output">'+esc(formatDate(r)+' · '+output(r))+'</div><div class="eap151-score">'+score(r)+'/100</div></div>';
    }).join('');
  }

  function guardClick(e){
    var n=e.target&&e.target.closest&&e.target.closest('#app button,#app a[href],#app [role="button"]');
    if(!n)return;
    var id=Number((n.dataset&&n.dataset.eapSessionId||'').replace(/\D/g,''))||numFromSession(n.textContent);
    if(!id)return;
    var t=truth();if(!t)return;
    if(id>t.allowed){
      e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
      showNotice('S'+id+' ยังล็อกอยู่ กรุณาผ่าน S'+t.allowed+' ก่อน');
      var buttons=sessionButtons();if(buttons[t.allowed])buttons[t.allowed].scrollIntoView({behavior:'smooth',block:'center'});
      return false;
    }
    lastSelected=id;
  }

  function render(){
    injectStyle();
    var t=truth();if(!t)return;
    applySessionLocks(t);
    renderPortfolio(t);
    document.documentElement.dataset.eapSkillHubTruthBindingVersion=VERSION;
    window.EAPSkillHubTruthBinding={version:VERSION,allowedSession:t.allowed,refresh:render,diagnostics:function(){return{allowedSession:t.allowed,lastSelected:lastSelected,records:canonicalRecords(t)}}};
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(render,100);}
  document.addEventListener('click',guardClick,true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:progress-truth-updated','eap:resume-synced','eap:local-result-saved'].forEach(function(name){window.addEventListener(name,schedule);});
  setTimeout(render,100);setTimeout(render,800);setTimeout(render,1800);
})();