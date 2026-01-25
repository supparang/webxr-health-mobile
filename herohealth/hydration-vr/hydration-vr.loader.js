// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — PRODUCTION
// ✅ Auto-detect view if ?view= missing (NO override if exists)
// ✅ Applies body view classes + layers mapping
// ✅ Imports ./hydration.safe.js (cache-bust)
// ✅ Shows REAL import error (last error stack/message)

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  const body = document.body;

  function detectView(){
    // IMPORTANT: do not override if user already set ?view=
    const given = String(q.get('view') || '').toLowerCase();
    if (given) return given;

    const coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
    const w = Math.min(window.innerWidth||0, window.innerHeight||0);
    const landscape = (window.innerWidth||0) > (window.innerHeight||0);
    const isMobile = coarse || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');

    // Heuristic:
    // - Mobile portrait => mobile
    // - Mobile landscape (เหมือนใส่ Cardboard/cVR) => cvr (ยิงกลางจอ)
    // - If user appended ?cardboard=1 => cardboard
    if (String(q.get('cardboard')||'') === '1') return 'cardboard';
    if (isMobile && landscape && w <= 520) return 'cvr';
    if (isMobile) return 'mobile';
    return 'pc';
  }

  function setBodyView(view){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }

  const view = detectView();
  setBodyView(view);

  // map layers for safe.js
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    if (body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  })();

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function showFail(err, tried){
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed</h2>
        <div style="opacity:.9;margin-bottom:10px">Detected view: <code>${escapeHtml(view)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error (last):</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
        <div style="opacity:.85;margin-top:10px">Tip: ถ้าขึ้นว่า “Cannot find module …” แปลว่าไฟล์ path นั้นยังไม่มี/ชื่อไม่ตรง/ตัวพิมพ์เล็กใหญ่ไม่ตรง</div>
      </div>
    `;
    document.body.appendChild(el);
  }

  const candidates = [
    './hydration.safe.js',
  ].map(withBust);

  (async()=>{
    const tried=[];
    let lastErr = null;
    for (const p of candidates){
      tried.push(p);
      try{ await import(p); return; }
      catch(e){ lastErr = e; }
    }
    showFail(lastErr || new Error('All candidate imports failed.'), tried);
  })();
})();