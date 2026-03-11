// === /herohealth/launch/backhub.js ===
// Back-to-Hub + Last Summary + Session Log (PRODUCTION)
// ✅ Shows floating "Back to Hub" button if ?hub= exists
// ✅ Saves last summary to localStorage (HHA_LAST_SUMMARY)
// ✅ Appends session log to localStorage (HHA_SESSION_LOG)
// ✅ Emits hha:before-exit for engines to flush/stop audio/log if they listen
// ✅ Safe: if hub missing, button hidden

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function qsObj(){
    try{ return new URL(location.href).searchParams; }catch{ return new URLSearchParams(); }
  }

  function getHub(){
    const q = qsObj();
    const hub = q.get('hub');
    return hub && String(hub).trim() ? String(hub).trim() : '';
  }

  function nowISO(){
    try{ return new Date().toISOString(); }catch{ return ''; }
  }

  function loadSessionLog(){
    try{
      const s = localStorage.getItem('HHA_SESSION_LOG');
      const a = s ? JSON.parse(s) : [];
      return Array.isArray(a) ? a : [];
    }catch{ return []; }
  }

  function saveSessionLog(arr){
    try{ localStorage.setItem('HHA_SESSION_LOG', JSON.stringify(arr||[])); }catch(_){}
  }

  function appendSession(entry){
    const a = loadSessionLog();
    a.push(entry);
    if(a.length > 300) a.splice(0, a.length - 300);
    saveSessionLog(a);
  }

  function saveLastSummary(summary){
    try{
      const q = qsObj();
      const payload = Object.assign({
        savedAt: nowISO(),
        page: location.pathname,
        href: location.href,
        pid: q.get('pid') || '',
        run: q.get('run') || '',
        diff: q.get('diff') || '',
        time: q.get('time') || '',
        seed: q.get('seed') || '',
        studyId: q.get('studyId') || '',
        phase: q.get('phase') || '',
        conditionGroup: q.get('conditionGroup') || ''
      }, summary || {});

      if(!payload.gameId){
        payload.gameId = q.get('gameId') || '';
      }
      if(!payload.gameTitle){
        payload.gameTitle = q.get('gameTitle') || '';
      }

      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
      appendSession(payload);
    }catch(_){}
  }

  function emitBeforeExit(){
    try{
      const ev = new CustomEvent('hha:before-exit', {
        detail:{ href: location.href, at: Date.now() }
      });
      WIN.dispatchEvent(ev);
      DOC.dispatchEvent(ev);
    }catch(_){}
  }

  function goHub(){
    const hub = getHub();
    if(!hub) return;
    emitBeforeExit();
    setTimeout(()=>{ location.href = hub; }, 60);
  }

  WIN.HHA_BACKHUB = {
    setSummary: saveLastSummary,
    goHub
  };

  function mountBtn(){
    const hub = getHub();
    if(!hub) return;

    const btn = DOC.createElement('button');
    btn.type = 'button';
    btn.textContent = '← กลับ Hub';
    btn.setAttribute('aria-label', 'Back to Hub');
    btn.style.position = 'fixed';
    btn.style.left = '12px';
    btn.style.top = '12px';
    btn.style.zIndex = '99999';
    btn.style.padding = '10px 12px';
    btn.style.borderRadius = '14px';
    btn.style.border = '1px solid rgba(148,163,184,.22)';
    btn.style.background = 'rgba(2,6,23,.72)';
    btn.style.color = '#e5e7eb';
    btn.style.backdropFilter = 'blur(8px)';
    btn.style.webkitBackdropFilter = 'blur(8px)';
    btn.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans Thai, Arial';
    btn.style.fontWeight = '900';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 12px 40px rgba(0,0,0,.35)';
    btn.style.userSelect = 'none';

    btn.addEventListener('click', goHub);

    WIN.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape') goHub();
    });

    DOC.body.appendChild(btn);
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', mountBtn);
  }else{
    mountBtn();
  }
})();