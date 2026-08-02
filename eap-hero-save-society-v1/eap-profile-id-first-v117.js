/* =========================================================
   EAP Hero • Unified Identity Login v121
   - Uses eap_identity_lookup shared by Hero and Word Quest.
   - Official roster is eap_word_roster.
   - Alias lookup uses eap_identity_map.
   - profiles is legacy fallback only.
========================================================= */
(function(){
  'use strict';

  var VERSION='20260802-EAP-ID-FIRST-V121-UNIFIED-IDENTITY';
  var ENDPOINT=String((window.EAP_SHEET_CONFIG||{}).webAppUrl||'');
  var MODAL_ID='eap-profile-modal-v116';
  var STYLE_ID='eap-profile-id-first-v117-style';
  var LOOKUP_TIMEOUT_MS=15000;
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');style.id=STYLE_ID;
    style.textContent=`
      #${MODAL_ID} .eap117-name-wrap[hidden]{display:none!important}
      #${MODAL_ID} .eap117-lookup-status{margin-top:12px;padding:11px 12px;border-radius:12px;background:#eff6ff;color:#1e3a5f;font:800 13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
      #${MODAL_ID} .eap117-lookup-status.ok{background:#ecfdf5;color:#065f46}
      #${MODAL_ID} .eap117-lookup-status.warn{background:#fff7ed;color:#9a3412}
      #${MODAL_ID} .eap117-lookup-status.error{background:#fef2f2;color:#b42318}
      #${MODAL_ID} .eap117-found-name{margin-top:12px;padding:13px 14px;border:1px solid #86efac;border-radius:14px;background:#f0fdf4;color:#14532d;font:900 16px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
      #${MODAL_ID} .eap117-help{margin:7px 0 0;color:#64748b;font:700 12px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
      #${MODAL_ID} button[disabled]{opacity:.65;cursor:wait}
    `;
    document.head.appendChild(style);
  }
  function status(node,message,kind){node.className='eap117-lookup-status'+(kind?' '+kind:'');node.textContent=message;}
  function retireCallback(callback){
    try{window[callback]=function(){return undefined;};}catch(_){}
    setTimeout(function(){try{delete window[callback];}catch(_){window[callback]=undefined;}},60000);
  }
  function lookup(studentId,section){
    return new Promise(function(resolve,reject){
      if(!ENDPOINT){reject(new Error('missing_endpoint'));return;}
      var callback='__eapIdentityLookupV121_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
      var script=document.createElement('script'),finished=false;
      var timeout=setTimeout(function(){
        if(finished)return;finished=true;retireCallback(callback);
        if(script.parentNode)script.parentNode.removeChild(script);
        reject(new Error('timeout_after_'+LOOKUP_TIMEOUT_MS+'ms'));
      },LOOKUP_TIMEOUT_MS);
      function finish(){if(finished)return false;finished=true;clearTimeout(timeout);if(script.parentNode)script.parentNode.removeChild(script);return true;}
      window[callback]=function(data){if(!finish())return;retireCallback(callback);resolve(data||{});};
      script.onerror=function(){if(!finish())return;retireCallback(callback);reject(new Error('network'));};
      var url=new URL(ENDPOINT,location.href);
      url.searchParams.set('action','eap_identity_lookup');
      url.searchParams.set('studentId',studentId);
      url.searchParams.set('section',section);
      url.searchParams.set('callback',callback);
      url.searchParams.set('_',String(Date.now()));
      script.async=true;script.referrerPolicy='no-referrer';script.src=url.toString();
      document.head.appendChild(script);
    });
  }
  function saveAndContinue(profile,wrap,msg,button){
    try{
      var ok=window.EAPPlayerProfile&&typeof window.EAPPlayerProfile.save==='function'&&window.EAPPlayerProfile.save(profile);
      if(!ok){status(msg,'ไม่สามารถบันทึกข้อมูลในเบราว์เซอร์นี้ได้','error');button.disabled=false;button.textContent='เรียนต่อ';return;}
      status(msg,'ยืนยันตัวตนแล้ว กำลังโหลดความคืบหน้าจาก Sheet…','ok');
      setTimeout(function(){wrap.remove();location.reload();},450);
    }catch(err){status(msg,'เกิดข้อผิดพลาดขณะบันทึกข้อมูล กรุณาลองอีกครั้ง','error');button.disabled=false;button.textContent='เรียนต่อ';}
  }
  function enhance(){
    injectStyle();
    var wrap=document.getElementById(MODAL_ID);if(!wrap||wrap.dataset.eap117Ready==='true')return;
    var idEl=document.getElementById('eap-pid-v116'),nameEl=document.getElementById('eap-name-v116'),secEl=document.getElementById('eap-sec-v116'),button=document.getElementById('eap-profile-save-v116'),oldMsg=document.getElementById('eap-profile-msg-v116');
    if(!idEl||!nameEl||!secEl||!button||!oldMsg)return;
    wrap.dataset.eap117Ready='true';

    var label=nameEl.previousElementSibling;
    var nameWrap=document.createElement('div');nameWrap.className='eap117-name-wrap';nameWrap.hidden=true;
    if(label&&label.tagName==='LABEL')nameWrap.appendChild(label);
    nameEl.parentNode.insertBefore(nameWrap,nameEl);nameWrap.appendChild(nameEl);
    var found=document.createElement('div');found.className='eap117-found-name';found.hidden=true;nameWrap.parentNode.insertBefore(found,nameWrap);
    var help=document.createElement('p');help.className='eap117-help';help.textContent='ใช้รหัสนักศึกษาเดียวกันทั้ง EAP Vocabulary และ EAP Hero ระบบจะตรวจจากรายชื่อกลางของรายวิชา';idEl.insertAdjacentElement('afterend',help);
    oldMsg.className='eap117-lookup-status';status(oldMsg,'พร้อมตรวจสอบตัวตนจากรายชื่อกลาง','');

    function reset(){found.hidden=true;found.textContent='';nameWrap.hidden=true;nameEl.value='';status(oldMsg,'พร้อมตรวจสอบตัวตนจากรายชื่อกลาง','');button.disabled=false;button.textContent='เรียนต่อ';}
    function retry(error){found.hidden=true;nameWrap.hidden=true;nameEl.value='';var detail=clean(error&&error.message||error);status(oldMsg,'ยังไม่ได้รับคำยืนยันจาก Google Sheet กรุณากด “ลองค้นหาอีกครั้ง”'+(detail?' · '+detail:''),'error');button.disabled=false;button.textContent='ลองค้นหาอีกครั้ง';}
    idEl.addEventListener('input',reset);secEl.addEventListener('input',reset);

    button.onclick=async function(event){
      event.preventDefault();
      var requestedId=clean(idEl.value),section=clean(secEl.value||'122')||'122';
      if(!requestedId){status(oldMsg,'กรุณากรอกรหัสนักศึกษา','error');idEl.focus();return;}
      button.disabled=true;button.textContent='กำลังค้นหา…';status(oldMsg,'กำลังตรวจรหัส '+requestedId+' จากรายชื่อกลาง…','');
      try{
        var data=await lookup(requestedId,section);
        if(!data||data.ok!==true)throw new Error(clean(data&&data.error||'server_not_ok'));
        if(data.identityFound===true&&data.found===true&&clean(data.studentName)){
          var canonicalId=clean(data.canonicalStudentId||data.studentId)||requestedId;
          var officialName=clean(data.studentName);
          found.hidden=false;found.textContent='✓ '+officialName+(canonicalId!==requestedId?' · รหัสทางการ '+canonicalId:'');
          nameEl.value=officialName;button.textContent='กำลังเปิด…';
          saveAndContinue({studentId:canonicalId,studentName:officialName,section:clean(data.section)||section,requestedStudentId:requestedId,identitySource:clean(data.identitySource||data.sourceSheet)},wrap,oldMsg,button);return;
        }
        status(oldMsg,'ไม่พบรหัสนี้ในรายชื่อกลาง กรุณาติดต่อผู้สอนเพื่อตรวจสอบทะเบียนนักศึกษา','warn');
        button.disabled=false;button.textContent='ตรวจสอบอีกครั้ง';
      }catch(err){retry(err);}
    };

    document.documentElement.dataset.eapProfileFlowVersion=VERSION;
    document.documentElement.dataset.eapProfileLookupAction='eap_identity_lookup';
    document.documentElement.dataset.eapIdentityAuthority='eap_word_roster';
    document.documentElement.dataset.eapProfileLookupTimeout=String(LOOKUP_TIMEOUT_MS);
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(enhance,60);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',function(){enhance();setTimeout(enhance,800);});
  enhance();
})();