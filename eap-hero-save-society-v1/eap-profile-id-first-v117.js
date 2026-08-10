/* =========================================================
   EAP Hero • Unified Identity Login v122 MOBILE SAFE
   ---------------------------------------------------------
   Canonical identity is shared by EAP Hero + EAP Vocabulary.

   Lookup order:
   1) eap_identity_lookup       (unified roster authority)
   2) eap_hero_profile_lookup  (Hero Sheet fallback)
   3) previously verified ACTIVE_PLAYER for the exact same ID + Section

   Important:
   - Name is display-only; studentId + section are the identity key.
   - Never invent a learner name.
   - Never reuse a cached identity for a different ID/section.
========================================================= */
(function(){
  'use strict';

  if(window.__EAP_IDENTITY_LOGIN_V122__) return;
  window.__EAP_IDENTITY_LOGIN_V122__=true;

  var VERSION='20260810-EAP-IDENTITY-V122-MOBILE-SAFE';
  var MODAL_ID='eap-profile-modal-v116';
  var STYLE_ID='eap-profile-id-first-v122-style';
  var ACTIVE_KEY='EAP_HERO_ACTIVE_PLAYER_V1';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var LOOKUP_TIMEOUT_MS=12000;
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function readJSON(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){return {};}}
  function endpoint(){return clean((window.EAP_SHEET_CONFIG||{}).webAppUrl||'');}
  function sameIdentity(profile,id,section){
    profile=profile||{};
    return clean(profile.studentId||profile.id)===clean(id) &&
      clean(profile.section||'122')===clean(section||'122') &&
      !!clean(profile.studentName||profile.name);
  }
  function cachedVerified(id,section){
    var active=readJSON(ACTIVE_KEY);
    if(sameIdentity(active,id,section)) return {
      ok:true,found:true,identityFound:true,
      studentId:clean(active.studentId||active.id),
      canonicalStudentId:clean(active.studentId||active.id),
      studentName:clean(active.studentName||active.name),
      section:clean(active.section||section||'122'),
      identitySource:'verified_active_player_cache',
      cachedVerified:true
    };
    var direct=readJSON(PROFILE_KEY);
    if(sameIdentity(direct,id,section)) return {
      ok:true,found:true,identityFound:true,
      studentId:clean(direct.studentId||direct.id),
      canonicalStudentId:clean(direct.studentId||direct.id),
      studentName:clean(direct.studentName||direct.name),
      section:clean(direct.section||section||'122'),
      identitySource:'verified_profile_cache',
      cachedVerified:true
    };
    return null;
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=''
      +'#'+MODAL_ID+' .eap122-name-wrap[hidden]{display:none!important}'
      +'#'+MODAL_ID+' .eap122-lookup-status{margin-top:12px;padding:11px 12px;border-radius:12px;background:#eff6ff;color:#1e3a5f;font:800 13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}'
      +'#'+MODAL_ID+' .eap122-lookup-status.ok{background:#ecfdf5;color:#065f46}'
      +'#'+MODAL_ID+' .eap122-lookup-status.warn{background:#fff7ed;color:#9a3412}'
      +'#'+MODAL_ID+' .eap122-lookup-status.error{background:#fef2f2;color:#b42318}'
      +'#'+MODAL_ID+' .eap122-found-name{margin-top:12px;padding:13px 14px;border:1px solid #86efac;border-radius:14px;background:#f0fdf4;color:#14532d;font:900 16px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}'
      +'#'+MODAL_ID+' .eap122-help{margin:7px 0 0;color:#64748b;font:700 12px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}'
      +'#'+MODAL_ID+' button[disabled]{opacity:.65;cursor:wait}';
    document.head.appendChild(style);
  }
  function status(node,message,kind){
    node.className='eap122-lookup-status'+(kind?' '+kind:'');
    node.textContent=message;
  }
  function retireCallback(callback){
    try{window[callback]=function(){return undefined;};}catch(_){}
    setTimeout(function(){try{delete window[callback];}catch(_){window[callback]=undefined;}},30000);
  }

  function jsonp(action,studentId,section){
    return new Promise(function(resolve,reject){
      var base=endpoint();
      if(!base){reject(new Error('missing_endpoint'));return;}
      var callback='__eapIdentityV122_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
      var script=document.createElement('script');
      var finished=false;
      var timeout=setTimeout(function(){
        if(finished)return;
        finished=true;
        retireCallback(callback);
        if(script.parentNode)script.parentNode.removeChild(script);
        reject(new Error('timeout'));
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
      try{
        var url=new URL(base,location.href);
        url.searchParams.set('action',action);
        url.searchParams.set('studentId',studentId);
        url.searchParams.set('section',section);
        url.searchParams.set('callback',callback);
        url.searchParams.set('_',String(Date.now()));
        script.async=true;
        script.referrerPolicy='no-referrer';
        script.src=url.toString();
        document.head.appendChild(script);
      }catch(err){
        clearTimeout(timeout);retireCallback(callback);reject(err);
      }
    });
  }

  function normalizeResponse(data,requestedId,section){
    data=data||{};
    var found=data.identityFound===true || data.found===true;
    var name=clean(data.studentName||data.name);
    var id=clean(data.canonicalStudentId||data.studentId||requestedId);
    var sec=clean(data.section||section||'122')||'122';
    if(data.ok===true && found && name){
      return {
        ok:true,found:true,identityFound:true,
        studentId:id,canonicalStudentId:id,studentName:name,section:sec,
        identitySource:clean(data.identitySource||data.sourceSheet||data.service||'sheet')
      };
    }
    return null;
  }

  async function lookup(studentId,section){
    var errors=[];
    var actions=['eap_identity_lookup','eap_hero_profile_lookup'];
    for(var i=0;i<actions.length;i++){
      try{
        var data=await jsonp(actions[i],studentId,section);
        var normalized=normalizeResponse(data,studentId,section);
        if(normalized)return normalized;
        errors.push(actions[i]+':not_found');
      }catch(err){errors.push(actions[i]+':'+clean(err&&err.message||err));}
    }
    var cached=cachedVerified(studentId,section);
    if(cached)return cached;
    throw new Error(errors.join(' | ')||'identity_lookup_failed');
  }

  function saveAndContinue(profile,wrap,msg,button){
    try{
      var ok=window.EAPPlayerProfile && typeof window.EAPPlayerProfile.save==='function' && window.EAPPlayerProfile.save(profile);
      if(!ok){status(msg,'ไม่สามารถบันทึกข้อมูลในเบราว์เซอร์นี้ได้','error');button.disabled=false;button.textContent='เรียนต่อ';return;}
      status(msg,'ยืนยันตัวตนแล้ว กำลังโหลดความคืบหน้าจาก Google Sheet…','ok');
      setTimeout(function(){wrap.remove();location.reload();},350);
    }catch(err){
      status(msg,'เกิดข้อผิดพลาดขณะบันทึกข้อมูล กรุณาลองอีกครั้ง','error');
      button.disabled=false;button.textContent='เรียนต่อ';
    }
  }

  function enhance(){
    injectStyle();
    var wrap=document.getElementById(MODAL_ID);
    if(!wrap)return;
    if(wrap.dataset.eap122Ready==='true')return;

    var idEl=document.getElementById('eap-pid-v116');
    var nameEl=document.getElementById('eap-name-v116');
    var secEl=document.getElementById('eap-sec-v116');
    var button=document.getElementById('eap-profile-save-v116');
    var oldMsg=document.getElementById('eap-profile-msg-v116');
    if(!idEl||!nameEl||!secEl||!button||!oldMsg)return;
    wrap.dataset.eap122Ready='true';

    var label=nameEl.previousElementSibling;
    var nameWrap=document.createElement('div');
    nameWrap.className='eap122-name-wrap';nameWrap.hidden=true;
    if(label&&label.tagName==='LABEL')nameWrap.appendChild(label);
    nameEl.parentNode.insertBefore(nameWrap,nameEl);nameWrap.appendChild(nameEl);

    var found=document.createElement('div');
    found.className='eap122-found-name';found.hidden=true;
    nameWrap.parentNode.insertBefore(found,nameWrap);

    var help=document.createElement('p');
    help.className='eap122-help';
    help.textContent='ใช้รหัสนักศึกษาเดียวกันทั้ง EAP Vocabulary และ EAP Hero ระบบตรวจจากรายชื่อกลางของรายวิชา';
    idEl.insertAdjacentElement('afterend',help);

    status(oldMsg,'พร้อมตรวจสอบตัวตนจากรายชื่อกลาง','');

    function reset(){
      found.hidden=true;found.textContent='';nameWrap.hidden=true;nameEl.value='';
      status(oldMsg,'พร้อมตรวจสอบตัวตนจากรายชื่อกลาง','');
      button.disabled=false;button.textContent='เรียนต่อ';
    }
    idEl.addEventListener('input',reset);
    secEl.addEventListener('input',reset);

    button.onclick=async function(event){
      event.preventDefault();event.stopPropagation();
      var requestedId=clean(idEl.value);
      var section=clean(secEl.value||'122')||'122';
      if(!requestedId){status(oldMsg,'กรุณากรอกรหัสนักศึกษา','error');idEl.focus();return;}
      button.disabled=true;button.textContent='กำลังค้นหา…';
      status(oldMsg,'กำลังตรวจรหัส '+requestedId+' จาก Google Sheet…','');
      try{
        var data=await lookup(requestedId,section);
        var canonicalId=clean(data.canonicalStudentId||data.studentId)||requestedId;
        var officialName=clean(data.studentName);
        if(!officialName)throw new Error('missing_official_name');
        found.hidden=false;
        found.textContent='✓ '+officialName+(canonicalId!==requestedId?' · รหัสทางการ '+canonicalId:'');
        nameEl.value=officialName;
        if(data.cachedVerified===true){
          status(oldMsg,'ใช้ตัวตนที่เคยยืนยันจาก Google Sheet บนเครื่องนี้ แล้วจะตรวจความคืบหน้าจาก Server ต่อ','ok');
        }else{
          status(oldMsg,'พบรายชื่อใน Google Sheet แล้ว','ok');
        }
        button.textContent='กำลังเปิด…';
        saveAndContinue({
          studentId:canonicalId,
          studentName:officialName,
          section:clean(data.section)||section,
          requestedStudentId:requestedId,
          identitySource:clean(data.identitySource||'sheet')
        },wrap,oldMsg,button);
      }catch(err){
        found.hidden=true;nameWrap.hidden=true;nameEl.value='';
        status(oldMsg,'ยังยืนยันรหัสนี้จาก Google Sheet ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วกด “ลองค้นหาอีกครั้ง” · '+clean(err&&err.message||err),'error');
        button.disabled=false;button.textContent='ลองค้นหาอีกครั้ง';
      }
    };

    document.documentElement.dataset.eapProfileFlowVersion=VERSION;
    document.documentElement.dataset.eapProfileLookupAction='eap_identity_lookup+eap_hero_profile_lookup';
    document.documentElement.dataset.eapIdentityAuthority='shared-roster';
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(enhance,50);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',function(){enhance();setTimeout(enhance,500);});
  enhance();
})();
