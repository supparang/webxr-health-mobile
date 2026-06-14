
(function(){
  'use strict';

  const VERSION = 'v3.2.8-roadmap-b2-native';

  function toast(msg){
    try{
      if(typeof showToast === 'function') showToast(msg);
      else console.log('[AIQuest]', msg);
    }catch(e){ console.log('[AIQuest]', msg); }
  }

  function suppress(ms){
    try{
      sessionStorage.setItem('AIQUEST_SUPPRESS_AUTOSTART_UNTIL', String(Date.now() + (ms || 10000)));
      if(typeof window.AIQUEST_SUPPRESS_AUTOSTART === 'function') window.AIQUEST_SUPPRESS_AUTOSTART(ms || 10000);
    }catch(e){}
  }

  function isB2Context(){
    try{
      const qs = new URLSearchParams(location.search);
      if((qs.get('session')||'').toLowerCase()==='b2') return true;
      if((window.currentMission && window.currentMission.id)==='b2') return true;
      const t = document.body ? (document.body.innerText || '') : '';
      return /B2:\s*Search Arena Boss/i.test(t) || /Search Arena Boss/i.test(t);
    }catch(e){
      return false;
    }
  }

  function goRoadmap(){
    suppress(12000);
    try{
      if(typeof renderRoadmap === 'function'){
        renderRoadmap();
        return true;
      }
    }catch(e){}
    try{
      if(typeof showRoadmap === 'function'){
        showRoadmap();
        return true;
      }
    }catch(e){}
    try{
      if(typeof renderHome === 'function'){
        renderHome();
        return true;
      }
    }catch(e){}
    return false;
  }

  function patchSubmitButtons(){
    const btns = Array.from(document.querySelectorAll('button'));
    btns.forEach(btn=>{
      if(btn.__b2ReturnFixV321) return;
      const text = String(btn.innerText || btn.textContent || '').trim();
      if(!/บันทึก|ส่งผล|submit|save/i.test(text)) return;
      btn.__b2ReturnFixV321 = true;
      btn.setAttribute('data-no-roadmap-click','1');

      btn.addEventListener('click', function(){
        if(!isB2Context()) return;
        suppress(15000);
        setTimeout(function(){
          suppress(15000);
          const ok = goRoadmap();
          toast(ok ? 'บันทึก B2 แล้ว กลับหน้ารวมแล้ว' : 'บันทึก B2 แล้ว ไม่เริ่มรอบใหม่');
        }, 900);
        setTimeout(function(){
          suppress(15000);
          goRoadmap();
        }, 2200);
      }, true);
    });
  }

  function patchStartMission(){
    if(typeof window.startMission !== 'function' || window.startMission.__b2ReturnFixV321) return false;
    const original = window.startMission;
    window.startMission = function(id){
      try{
        const until = Number(sessionStorage.getItem('AIQUEST_SUPPRESS_AUTOSTART_UNTIL') || 0);
        if(Date.now() < until && String(id).toLowerCase()==='b2'){
          toast('บันทึกแล้ว: ไม่เริ่ม B2 รอบใหม่อัตโนมัติ');
          return;
        }
      }catch(e){}
      return original.apply(this, arguments);
    };
    window.startMission.__b2ReturnFixV321 = true;
    return true;
  }

  function observe(){
    patchSubmitButtons();
    patchStartMission();
    if(!window.__AIQUEST_B2_RETURN_OBSERVER_V321){
      window.__AIQUEST_B2_RETURN_OBSERVER_V321 = new MutationObserver(function(){
        patchSubmitButtons();
        patchStartMission();
      });
      window.__AIQUEST_B2_RETURN_OBSERVER_V321.observe(document.body || document.documentElement, {childList:true, subtree:true});
    }
  }

  window.AIQUEST_B2_SUBMIT_RETURN_FIX = {
    version: VERSION,
    suppress,
    goRoadmap,
    patchSubmitButtons,
    patchStartMission,
    refresh: observe
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
  else observe();

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_B2_SUBMIT_RETURN_FIX);
})();
