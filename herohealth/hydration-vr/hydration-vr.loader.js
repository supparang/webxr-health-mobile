// === hydration-vr.loader.js ===
'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const view = String(q.get('view')||'').toLowerCase();
  const body = document.body;

  // ----- set view class -----
  body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
  if (view==='mobile') body.classList.add('view-mobile');
  else if (view==='cardboard') body.classList.add('cardboard');
  else if (view==='cvr') body.classList.add('view-cvr');
  else body.classList.add('view-pc');

  // ----- map layers -----
  window.HHA_VIEW = window.HHA_VIEW || {};
  window.HHA_VIEW.layers = body.classList.contains('cardboard')
    ? ['hydration-layerL','hydration-layerR']
    : ['hydration-layer'];

  // ----- import engine -----
  const v = q.get('v') || q.get('ts') || '';
  const withBust = p => v ? `${p}?v=${encodeURIComponent(v)}` : p;

  import(withBust('./hydration.safe.js'))
    .catch(err=>{
      const el = document.createElement('pre');
      el.style.cssText='position:fixed;inset:0;background:#020617;color:#e5e7eb;padding:16px;z-index:99999;white-space:pre-wrap';
      el.textContent = '❌ HydrationVR import failed\n\n' + err.stack;
      document.body.appendChild(el);
    });
})();