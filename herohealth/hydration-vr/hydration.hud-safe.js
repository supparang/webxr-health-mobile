// === /herohealth/hydration-vr/hydration.hud-safe.js ===
'use strict';
(function(){
  const DOC = document;
  if (!DOC || window.__HHA_HUD_TOGGLE__) return;
  window.__HHA_HUD_TOGGLE__ = true;

  function syncBtn(btn){
    const on = DOC.body.classList.contains('hud-collapsed');
    btn.textContent = on ? 'ขยาย' : 'พับ';
  }

  function boot(){
    const btn = DOC.getElementById('btnQuestToggle');
    if (!btn) return;

    btn.addEventListener('click', ()=>{
      DOC.body.classList.toggle('hud-collapsed');
      syncBtn(btn);
    });

    // initial label
    syncBtn(btn);

    // optional: double-tap on quest title toggles too
    const qp = DOC.getElementById('questPanel');
    qp?.addEventListener('dblclick', ()=>{
      DOC.body.classList.toggle('hud-collapsed');
      syncBtn(btn);
    });
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();
})();