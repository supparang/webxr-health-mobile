// === /herohealth/vr/effects-lite.js ===
// HHA Effects Lite — PRODUCTION
// ✅ Listens: hha:judge / hha:coach
// ✅ Uses window.Particles.popText if available
(function(){
  'use strict';
  const WIN = window, DOC = document;
  if(!WIN || !DOC || WIN.__HHA_EFFECTS_LITE__) return;
  WIN.__HHA_EFFECTS_LITE__ = true;

  const pop = (text, cls)=>{
    try{
      const P = WIN.Particles;
      if(!P || typeof P.popText !== 'function') return;

      const r = DOC.documentElement.getBoundingClientRect();
      const x = r.left + r.width/2;
      const y = r.top  + r.height*0.46;
      P.popText(x, y, text, cls || '');
    }catch(_){}
  };

  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev?.detail || {};
    const t = String(d.label || d.type || '').trim();
    if(!t) return;
    pop(t, 'hha-judge');
  }, { passive:true });

  WIN.addEventListener('hha:coach', (ev)=>{
    const d = ev?.detail || {};
    const msg = String(d.msg || '').trim();
    if(!msg) return;
    pop(msg, 'hha-coach');
  }, { passive:true });
})();