/* =========================================================
   EAP Hero • Unified Identity Login v124 FAST ROSTER CLIENT
   Canonical identity shared with EAP Vocabulary.

   Production policy:
   - eap_identity_lookup is the ONLY identity action.
   - eap_word_roster is the ONLY identity authority.
   - first request 15s; one retry 25s.
   - exact same verified ACTIVE_PLAYER may be reused only if
     the requested studentId + section match exactly.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_IDENTITY_LOGIN_V124__) return;
  window.__EAP_IDENTITY_LOGIN_V124__=true;

  var VERSION='20260810-EAP-IDENTITY-V124-FAST-ROSTER-CLIENT';
  var MODAL_ID='eap-profile-modal-v116';
  var STYLE_ID='eap-profile-id-first-v124-style';
  var ACTIVE_KEY='EAP_HERO_ACTIVE_PLAYER_V1';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var timer=0;
  var busy=false;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function readJSON(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){return {};}}
  function endpoint(){return clean((window.EAP_SHEET_CONFIG||{}).webAppUrl||'');}
  function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}

  function sameIdentity(profile,id,section){
    profile=profile||{};
    return clean(profile.studentId||profile.id)===clean(id) &&
      clean(profile.section||'122')===clean(section||'122') &&
      !!clean(profile.studentName||profile.name);
  }

  function cachedVerified(id,section){
    var candidates=[readJSON(ACTIVE_KEY),readJSON(PROFILE_KEY)];
    for(var i=0;i<candidates.length;i++){
      var p=candidates[i];
      if(sameIdentity(p,id,section)) return {
        ok:true,found:true,identityFound:true,
        studentId:clean(p.studentId||p.id),
        canonicalStudentId:clean(p.studentId||p.id),
        studentName:clean(p.studentName||p.name),
        section:clean(p.section||section||'122'),
        identitySource:i===0?'verified_active_player_cache':'verified_profile_cache',
        cachedVerified:true
      };
    }
    return null;
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=''
      +'#'+MODAL_ID+' .eap124-name-wrap[hidden]{display:none!important}'
      +'#'+MODAL_ID+' .eap124-status{margin-top:12px;padding:11px 12px;border-radius:12px;background:#eff6ff;color:#1e3a5f;font:800 13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}'
      +'#'+MODAL_ID+' .eap124-status.ok{background:#ecfdf5;color:#065f46}'
      +'#'+MODAL_ID+' .eap124-status.error{background:#fef2f2;color:#b42318}'
      +'#'+MODAL_ID+' .eap124-found{margin-top:12px;padding:13px 14px;border:1px solid #86efac;border-radius:14px;background:#f0fdf4;color:#14532d;font:900 16px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}'
      +'#'+MODAL_ID+' .eap124-help{margin:7px 0 0;color:#64748b;font:700 12px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}'
      +'#'+MODAL_ID+' button[disabled]{opacity:.65;cursor:wait}';
    document.head.appendChild(style);
  }

  function status(node,message,kind){
    node.className='eap124-status'+(kind?' '+kind:'');
    node.textContent=message;
  }

  function retireCallback(callback){
    try{delete window[callback];}catch(_){window[callback]=undefined;}
  }

  function jsonpOnce(studentId,section,timeoutMs,attempt){
    return new Promise(function(resolve,reject){
      var base=endpoint();
      if(!base){reject(new Error('missing_endpoint'));return;}

      var callback='__eapIdentityV124_'+Date.now()+'_'+attempt+'_'+Math.random().toString(36).slice(2,8);
      var script=document.createElement('script');
      var settled=false;
      var timeout;

      function finish(error,payload){
        if(settled)return;
        settled=true;
        clearTimeout(timeout);
        retireCallback(callback);
        try{script.remove();}catch(_){}
        if(error)reject(error);else resolve(payload||{});
      }

      window[callback]=function(payload){finish(null,payload);};
      script.onerror=function(){finish(new Error('network'));};

      try{
        var url=new URL(base,location.href);
        url.searchParams.set('action','eap_identity_lookup');
        url.searchParams.set('studentId',studentId);
        url.searchParams.set('section',section);
        url.searchParams.set('callback',callback);
        url.searchParams.set('_',String(Date.now()));
        url.searchParams.set('attempt',String(attempt));
        script.async=true;
        script.referrerPolicy='no-referrer';
        script.src=url.toString();
        timeout=setTimeout(function(){finish(new Error('timeout'));},timeoutMs);
        document.head.appendChild(script);
      }catch(err){finish(err);}
    });
  }

  async function lookup(studentId,section,onRetry){
    var lastError;
    for(var attempt=1;attempt<=2;attempt++){
      try{
        var data=await jsonpOnce(studentId,section,attempt===1?15000:25000,attempt);
        var found=data&&data.ok===true&&(data.identityFound===true||data.found===true);
        var officialName=clean(data&&data.studentName);
        if(found&&officialName){
          var canonicalId=clean(data.canonicalStudentId||data.studentId||studentId)||studentId;
          return {
            ok:true,
            found:true,
            identityFound:true,
            studentId:canonicalId,
            canonicalStudentId:canonicalId,
            studentName:officialName,
            section:clean(data.section||section||'122')||'122',
            identitySource:clean(data.identitySource||data.sourceSheet||'eap_word_roster'),
            cacheHit:data.cacheHit===true,
            elapsedMs:Number(data.elapsedMs||0)
          };
        }
        if(data&&data.ok===true&&(data.identityFound===false||data.found===false)){
          throw new Error('not_found_in_roster');
        }
        throw new Error(clean(data&&data.error)||'invalid_identity_response');
      }catch(err){
        lastError=err;
        if(clean(err&&err.message)==='not_found_in_roster') break;
        if(attempt<2){
          if(typeof onRetry==='function')onRetry();
          await wait(700);
        }
      }
    }

    var cached=cachedVerified(studentId,section);
    if(cached)return cached;
    throw lastError||new Error('identity_lookup_failed');
  }

  function saveAndContinue(profile,wrap,msg,button){
    try{
      var ok=window.EAPPlayerProfile&&typeof window.EAPPlayerProfile.save==='function'&&window.EAPPlayerProfile.save(profile);
      if(!ok){
        status(msg,'ไม่สามารถบันทึกข้อมูลในเบราว์เซอร์นี้ได้','error');
        button.disabled=false;button.textContent='เรียนต่อ';busy=false;return;
      }
      status(msg,'ยืนยันตัวตนแล้ว กำลังโหลดความคืบหน้าจาก Google Sheet…','ok');
      setTimeout(function(){wrap.remove();location.reload();},350);
    }catch(err){
      status(msg,'เกิดข้อผิดพลาดขณะบันทึกข้อมูล กรุณาลองอีกครั้ง','error');
      button.disabled=false;button.textContent='เรียนต่อ';busy=false;
    }
  }

  function enhance(){
    injectStyle();
    var wrap=document.getElementById(MODAL_ID);
    if(!wrap||wrap.dataset.eap124Ready==='true')return;

    var idEl=document.getElementById('eap-pid-v116');
    var nameEl=document.getElementById('eap-name-v116');
    var secEl=document.getElementById('eap-sec-v116');
    var button=document.getElementById('eap-profile-save-v116');
    var msg=document.getElementById('eap-profile-msg-v116');
    if(!idEl||!nameEl||!secEl||!button||!msg)return;
    wrap.dataset.eap124Ready='true';

    var label=nameEl.previousElementSibling;
    var nameWrap=document.createElement('div');
    nameWrap.className='eap124-name-wrap';nameWrap.hidden=true;
    if(label&&label.tagName==='LABEL')nameWrap.appendChild(label);
    nameEl.parentNode.insertBefore(nameWrap,nameEl);nameWrap.appendChild(nameEl);

    var found=document.createElement('div');
    found.className='eap124-found';found.hidden=true;
    nameWrap.parentNode.insertBefore(found,nameWrap);

    var help=document.createElement('p');
    help.className='eap124-help';
    help.textContent='ใช้รหัสนักศึกษาเดียวกันทั้ง EAP Vocabulary และ EAP Hero ระบบตรวจจาก eap_word_roster โดยตรง';
    idEl.insertAdjacentElement('afterend',help);
    status(msg,'พร้อมตรวจสอบตัวตนจากรายชื่อกลาง','');

    function reset(){
      found.hidden=true;found.textContent='';nameWrap.hidden=true;nameEl.value='';busy=false;
      status(msg,'พร้อมตรวจสอบตัวตนจากรายชื่อกลาง','');
      button.disabled=false;button.textContent='เรียนต่อ';
    }
    idEl.addEventListener('input',reset);
    secEl.addEventListener('input',reset);

    button.onclick=async function(event){
      event.preventDefault();event.stopPropagation();
      if(busy)return;

      var requestedId=clean(idEl.value);
      var section=clean(secEl.value||'122')||'122';
      if(!requestedId){status(msg,'กรุณากรอกรหัสนักศึกษา','error');idEl.focus();return;}

      busy=true;button.disabled=true;button.textContent='กำลังค้นหา…';
      status(msg,'กำลังตรวจรหัส '+requestedId+' จาก eap_word_roster…','');

      try{
        var data=await lookup(requestedId,section,function(){
          status(msg,'การเชื่อมต่อรอบแรกช้า กำลังลองอีกครั้ง…','');
        });
        var canonicalId=clean(data.canonicalStudentId||data.studentId)||requestedId;
        var officialName=clean(data.studentName);
        if(!officialName)throw new Error('missing_official_name');

        found.hidden=false;
        found.textContent='✓ '+officialName+(canonicalId!==requestedId?' · รหัสทางการ '+canonicalId:'');
        nameEl.value=officialName;

        if(data.cachedVerified===true){
          status(msg,'ใช้ตัวตนที่เคยยืนยันจาก Google Sheet บนเครื่องนี้ แล้วจะตรวจความคืบหน้าจาก Server ต่อ','ok');
        }else{
          status(msg,'พบรายชื่อใน eap_word_roster แล้ว'+(data.cacheHit===true?' · cache':'')+(data.elapsedMs?' · '+data.elapsedMs+' ms':''),'ok');
        }

        button.textContent='กำลังเปิด…';
        saveAndContinue({
          studentId:canonicalId,
          studentName:officialName,
          section:clean(data.section)||section,
          requestedStudentId:requestedId,
          identitySource:clean(data.identitySource||'eap_word_roster')
        },wrap,msg,button);
      }catch(err){
        found.hidden=true;nameWrap.hidden=true;nameEl.value='';busy=false;
        var code=clean(err&&err.message||err);
        status(
          msg,
          code==='not_found_in_roster'
            ? 'ไม่พบรหัส '+requestedId+' ใน eap_word_roster ของ Section '+section
            : 'ยังเชื่อมต่อ Google Sheet ไม่สำเร็จ · '+code,
          'error'
        );
        button.disabled=false;button.textContent='ลองค้นหาอีกครั้ง';
      }
    };

    document.documentElement.dataset.eapProfileFlowVersion=VERSION;
    document.documentElement.dataset.eapProfileLookupAction='eap_identity_lookup';
    document.documentElement.dataset.eapIdentityAuthority='eap_word_roster';
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(enhance,50);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',function(){enhance();setTimeout(enhance,500);});
  enhance();
})();
