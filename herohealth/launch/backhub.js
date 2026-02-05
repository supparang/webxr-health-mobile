// === /herohealth/launch/backhub.js ===
// Back-to-Hub + Last Summary (PRODUCTION)
// ✅ Shows floating "Back to Hub" button if ?hub= exists
// ✅ Saves last summary to localStorage (HHA_LAST_SUMMARY)
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
  function safeJsonParse(s){
    try{ return JSON.parse(s); }catch{ return null; }
  }
  function nowISO(){
    try{ return new Date().toISOString(); }catch{ return ''; }
  }

  function saveLastSummary(summary){
    try{
      const payload = Object.assign({ savedAt: nowISO(), page: location.pathname }, summary||{});
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
    }catch(_){}
  }

  // Public API for game engines:
  // window.HHA_BACKHUB.setSummary({ gameId, scoreFinal, accuracyPct, miss, timePlayedSec, endReason, meta })
  WIN.HHA_BACKHUB = {
    setSummary: saveLastSummary,
    goHub: goHub
  };

  function emitBeforeExit(){
    try{
      const ev = new CustomEvent('hha:before-exit', { detail:{ href: location.href, at: Date.now() } });
      WIN.dispatchEvent(ev);
      DOC.dispatchEvent(ev);
    }catch(_){}
  }

  function goHub(){
    const hub = getHub();
    if(!hub) return;
    emitBeforeExit();
    // tiny delay for listeners to flush
    setTimeout(()=>{ location.href = hub; }, 60);
  }

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

    // ESC = back
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