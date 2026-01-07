// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — PRODUCTION
// ✅ Applies view classes (pc/mobile/cardboard/cvr)
// ✅ Maps layers for hydration.safe.js via window.HHA_VIEW.layers
// ✅ Cache-bust via ?v= using ts/v query
// ✅ Shows readable overlay on failure

'use strict';

(function(){
  const q = new URLSearchParams(location.search);

  // cache bust token (prefer ts, fallback v)
  const bust = String(q.get('ts') || q.get('v') || '').trim();

  function withBust(p){
    if (!bust) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(bust);
  }

  const view = String(q.get('view') || '').toLowerCase();
  const body = document.body;

  function setBodyView(){
    if (!body) return;
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');

    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }

  // map layers for hydration.safe.js
  function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    const isCardboard = body && body.classList.contains('cardboard');

    if (isCardboard){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function showFail(err, tried){
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed','inset:0','z-index:99999',
      'background:rgba(2,6,23,.92)','color:#e5e7eb',
      'font-family:system-ui','padding:16px','overflow:auto'
    ].join(';');

    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (folder loader)</h2>
        <div style="opacity:.92;margin-bottom:10px">
          URL: <code>${escapeHtml(location.href)}</code>
        </div>
        <div style="opacity:.92;margin-bottom:10px">
          baseURI: <code>${escapeHtml(document.baseURI)}</code>
        </div>
        <div style="opacity:.92;margin-bottom:10px">
          view: <code>${escapeHtml(view || '(none)')}</code> · bust: <code>${escapeHtml(bust || '(none)')}</code>
        </div>

        <div style="margin:12px 0 8px 0;font-weight:800">Tried paths:</div>
        <ol style="line-height:1.55">
          ${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}
        </ol>

        <div style="margin:12px 0 6px 0;font-weight:800">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>

        <div style="margin-top:10px;opacity:.9;line-height:1.45">
          <b>Tip:</b> ถ้าเห็น “Unexpected token &lt;” แปลว่า path ชี้ไปหน้า HTML/404 (GitHub Pages) — ตรวจชื่อไฟล์/โฟลเดอร์และตัวพิมพ์เล็ก–ใหญ่
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  function prep(){
    try{ setBodyView(); }catch(_){}
    try{ setLayers(); }catch(_){}
  }

  prep();

  const candidates = [
    './hydration.safe.js',
  ].map(withBust);

  (async()=>{
    const tried=[];
    for (const p of candidates){
      tried.push(p);
      try{
        await import(p);
        return;
      }catch(e){
        // keep trying
      }
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();