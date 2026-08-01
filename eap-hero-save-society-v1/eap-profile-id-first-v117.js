/* =========================================================
   EAP Hero • ID-first Profile v119
   - Student enters Student ID + Section first.
   - Looks up the official name from Sheet via player_resume.
   - Slow or failed network responses never enable manual identity fallback.
   - Manual name is allowed only after the server successfully confirms
     that the Student ID is not present in Sheet.
   - Preserves EAPPlayerProfile player-scoped storage and resume flow.
========================================================= */
(function(){
  'use strict';

  var VERSION='20260801-EAP-ID-FIRST-PROFILE-V119-SHEET-AUTHORITY';
  var ENDPOINT=String((window.EAP_SHEET_CONFIG||{}).webAppUrl||'');
  var MODAL_ID='eap-profile-modal-v116';
  var STYLE_ID='eap-profile-id-first-v117-style';
  var LOOKUP_TIMEOUT_MS=45000;
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
  function status(node,message,kind){
    node.className='eap117-lookup-status'+(kind?' '+kind:'');
    node.textContent=message;
  }
  function resolveName(data){
    var direct=clean(data&&data.studentName);
    if(direct&&direct.toLowerCase()!=='student')return direct;
    var counts={},names=[];
    (Array.isArray(data&&data.records)?data.records:[]).forEach(function(row){
      var name=clean(row&&row.studentName);if(!name)return;
      if(!counts[name]){counts[name]=0;names.push(name);}counts[name]++;
    });
    names.sort(function(a,b){return counts[b]-counts[a];});
    return names[0]||'';
  }
  function retireCallback(callback){
    try{window[callback]=function(){return undefined;};}catch(_){}
    setTimeout(function(){try{delete window[callback];}catch(_){window[callback]=undefined;}},300000);
  }
  function lookup(studentId,section){
    return new Promise(function(resolve,reject){
      if(!ENDPOINT){reject(new Error('missing_endpoint'));return;}
      var callback='__eapIdentityLookup_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
      var script=document.createElement('script'),finished=false;
      var timeout=setTimeout(function(){
        if(finished)return;
        finished=true;
        retireCallback(callback);
        if(script.parentNode)script.parentNode.removeChild(script);
        reject(new Error('timeout_after_'+LOOKUP_TIMEOUT_MS+'ms'));
      },LOOKUP_TIMEOUT_MS);
      function finish(){
        if(finished)return false;
        finished=true;clearTimeout(timeout);
        if(script.parentNode)script.parentNode.removeChild(script);
        return true;
      }
      window[callback]=function(data){
        if(!finish())return;
        retireCallback(callback);
        resolve(data||{});
      };
      script.onerror=function(){
        if(!finish())return;
        retireCallback(callback);
        reject(new Error('network'));
      };
      var url=new URL(ENDPOINT,location.href);
      url.searchParams.set('action','player_resume');
      url.searchParams.set('studentId',studentId);
      url.searchParams.set('section',section);
      url.searchParams.set('callback',callback);
      url.searchParams.set('_',String(Date.now()));
      script.async=true;script.referrerPolicy='no-referrer';script.src=url.toString();
      document.head.appendChild(script);
    });
  }
  function saveAndContinue(profile,wrap,msg,button,fromSheet){
    try{
      var ok=window.EAPPlayerProfile&&typeof window.EAPPlayerProfile.save==='function'&&window.EAPPlayerProfile.save(profile);
      if(!ok){status(msg,'ไม่สามารถบันทึกข้อมูลในเบราว์เซอร์นี้ได้','error');button.disabled=false;button.textContent='เรียนต่อ';return;}
      status(msg,fromSheet?'พบข้อมูลแล้ว กำลังเปิดความคืบหน้าจาก Sheet…':'ยืนยันผู้เรียนใหม่แล้ว กำลังเข้าสู่เกม…','ok');
      setTimeout(function(){wrap.remove();location.reload();},450);
    }catch(err){
      status(msg,'เกิดข้อผิดพลาดขณะบันทึกข้อมูล กรุณาลองอีกครั้ง','error');
      button.disabled=false;button.textContent='เรียนต่อ';
    }
  }
  function enhance(){
    injectStyle();
    var wrap=document.getElementById(MODAL_ID);if(!wrap||wrap.dataset.eap117Ready==='true')return;
    var idEl=document.getElementById('eap-pid-v116');
    var nameEl=document.getElementById('eap-name-v116');
    var secEl=document.getElementById('eap-sec-v116');
    var button=document.getElementById('eap-profile-save-v116');
    var oldMsg=document.getElementById('eap-profile-msg-v116');
    if(!idEl||!nameEl||!secEl||!button||!oldMsg)return;
    wrap.dataset.eap117Ready='true';

    var manualAllowed=false;
    var label=nameEl.previousElementSibling;
    var nameWrap=document.createElement('div');nameWrap.className='eap117-name-wrap';nameWrap.hidden=true;
    if(label&&label.tagName==='LABEL')nameWrap.appendChild(label);
    nameEl.parentNode.insertBefore(nameWrap,nameEl);nameWrap.appendChild(nameEl);

    var found=document.createElement('div');found.className='eap117-found-name';found.hidden=true;
    nameWrap.parentNode.insertBefore(found,nameWrap);
    var help=document.createElement('p');help.className='eap117-help';help.textContent='กรอกรหัสนักศึกษาและ Section ก่อน ระบบจะค้นหาชื่อจาก Google Sheet ให้อัตโนมัติ';
    idEl.insertAdjacentElement('afterend',help);
    oldMsg.className='eap117-lookup-status';
    status(oldMsg,'พร้อมค้นหาข้อมูลผู้เรียนจาก Google Sheet','');

    function resetIdentity(){
      manualAllowed=false;
      found.hidden=true;found.textContent='';nameWrap.hidden=true;nameEl.value='';
      status(oldMsg,'พร้อมค้นหาข้อมูลผู้เรียนจาก Google Sheet','');
      button.disabled=false;button.textContent='เรียนต่อ';
    }
    function openManualForConfirmedMissing(){
      manualAllowed=true;
      found.hidden=true;found.textContent='';nameWrap.hidden=false;nameEl.value='';
      status(oldMsg,'Server ยืนยันแล้วว่าไม่พบรหัสนี้ใน Sheet กรุณากรอกชื่อเพื่อสร้างผู้เรียนใหม่ที่ S1','warn');
      button.disabled=false;button.textContent='สร้างผู้เรียนใหม่';
      setTimeout(function(){nameEl.focus();},50);
    }
    function showRetry(error){
      manualAllowed=false;
      found.hidden=true;found.textContent='';nameWrap.hidden=true;nameEl.value='';
      var detail=clean(error&&error.message||error);
      status(oldMsg,'ยังไม่ได้รับคำยืนยันจาก Google Sheet กรุณากด “ลองค้นหาอีกครั้ง” ระบบจะไม่ใช้ชื่อที่กรอกเองแทนข้อมูลจาก Sheet'+(detail?' · '+detail:''),'error');
      button.disabled=false;button.textContent='ลองค้นหาอีกครั้ง';
    }
    idEl.addEventListener('input',resetIdentity);
    secEl.addEventListener('input',resetIdentity);

    button.onclick=async function(event){
      event.preventDefault();
      var studentId=clean(idEl.value),section=clean(secEl.value||'122')||'122';
      if(!studentId){status(oldMsg,'กรุณากรอกรหัสนักศึกษา','error');idEl.focus();return;}
      if(!section){status(oldMsg,'กรุณากรอก Section','error');secEl.focus();return;}

      if(!nameWrap.hidden){
        if(!manualAllowed){showRetry(new Error('identity_not_verified'));return;}
        var manualName=clean(nameEl.value);
        if(!manualName){status(oldMsg,'กรุณากรอกชื่อ-นามสกุลหรือชื่อทดสอบ','error');nameEl.focus();return;}
        button.disabled=true;button.textContent='กำลังบันทึก…';
        saveAndContinue({studentId:studentId,studentName:manualName,section:section},wrap,oldMsg,button,false);
        return;
      }

      button.disabled=true;button.textContent='กำลังค้นหา…';
      status(oldMsg,'กำลังค้นหารหัส '+studentId+' ใน Google Sheet… กรุณารอการยืนยันจาก Server','');
      try{
        var data=await lookup(studentId,section);
        if(!data||data.ok!==true){throw new Error(clean(data&&data.error||'server_not_ok'));}
        var officialName=resolveName(data);
        var hasIdentity=!!officialName&&(
          data.identityFound===true||
          Number(data.recordCount||0)>0||
          Array.isArray(data.records)&&data.records.length>0
        );
        if(hasIdentity){
          manualAllowed=false;
          found.hidden=false;found.textContent='✓ '+officialName;
          nameEl.value=officialName;
          button.textContent='กำลังเปิด…';
          saveAndContinue({studentId:studentId,studentName:officialName,section:section},wrap,oldMsg,button,true);
          return;
        }
        openManualForConfirmedMissing();
      }catch(err){
        showRetry(err);
      }
    };
    document.documentElement.dataset.eapProfileFlowVersion=VERSION;
    document.documentElement.dataset.eapProfileLookupTimeout=String(LOOKUP_TIMEOUT_MS);
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(enhance,60);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',function(){enhance();setTimeout(enhance,800);});
  enhance();
})();