/* === /herohealth/vr-groups/fx-perf-badge.js ===
Optional: show FX level (debug=1)
*/
(function(root){
  'use strict';
  const DOC = root.document; if(!DOC) return;
  const q = new URL(location.href).searchParams;
  if (String(q.get('debug')||'0')!=='1') return;

  let el = DOC.createElement('div');
  el.style.cssText = `
    position:fixed; right:10px; bottom:90px; z-index:200;
    padding:8px 10px; border-radius:999px;
    background:rgba(2,6,23,.65); border:1px solid rgba(148,163,184,.22);
    color:#e5e7eb; font:900 12px/1 system-ui; backdrop-filter: blur(10px);
    pointer-events:none;
  `;
  DOC.body.appendChild(el);

  function upd(d){
    const lv = DOC.body.dataset.fxLevel || '2';
    const fps = d && d.fps ? ` • ${d.fps}fps` : '';
    el.textContent = `FX ${lv}${fps}`;
  }
  upd();

  root.addEventListener('groups:fxlevel', (ev)=>upd(ev.detail||{}), {passive:true});
})();