
(function(){
  'use strict';

  const VERSION = 'v4.1.3-s6-access-and-sync-loader';

  function text(el){ return String((el && (el.innerText || el.textContent)) || '').trim(); }
  function isTeacher(){
    try { return new URLSearchParams(location.search).get('teacher') === '1' || /Teacher Mode/i.test(document.body.innerText || ''); }
    catch(_) { return false; }
  }
  function passed(id){
    try { return !!(state.completed[id] || state.stars[id] || state.mastered[id] || Number(state.bestScore[id] || 0) >= 60); }
    catch(_) { return false; }
  }
  function phase1Ready(){ return ['m1','m2','b1','m3','m4','m5','b2'].every(passed); }

  function loadScript(id, src){
    if(document.getElementById(id)) return;
    const script=document.createElement('script');
    script.id=id;
    script.src=src;
    script.async=true;
    document.head.appendChild(script);
  }
  function loadS6Tools(){
    if(isTeacher()) return;
    loadScript('aiquestS6AccessGateV412','./js/aiquest-s6-access-gate-v412.js?v=20260701-s6access412');
    loadScript('aiquestS6ResultSyncV413','./js/aiquest-s6-result-sync-v413.js?v=20260701-s6sync413');
  }

  function normalizeRiskLabels(){
    if(!isTeacher()) return;
    Array.from(document.querySelectorAll('span, div, td, p, li')).forEach(el => {
      if(/^Misconception:\s*automation$/i.test(text(el))){
        el.textContent='Focus: automation';
        el.title='จุดทบทวนเล็กน้อย ไม่ใช่ความเสี่ยงรุนแรง';
      }
    });
  }

  function refresh(){ normalizeRiskLabels(); loadS6Tools(); }
  window.AIQUEST_PHASE1_FINAL_POLISH={version:VERSION,refresh,phase1Ready};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,350));
  else setTimeout(refresh,350);
  if(!window.__AIQUEST_PHASE1_FINAL_OBSERVER_V328){
    window.__AIQUEST_PHASE1_FINAL_OBSERVER_V328=new MutationObserver(()=>{
      clearTimeout(window.__AIQUEST_PHASE1_FINAL_TIMER_V328);
      window.__AIQUEST_PHASE1_FINAL_TIMER_V328=setTimeout(refresh,200);
    });
    window.__AIQUEST_PHASE1_FINAL_OBSERVER_V328.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }
  console.log('[AIQuest] '+VERSION+' loaded');
})();