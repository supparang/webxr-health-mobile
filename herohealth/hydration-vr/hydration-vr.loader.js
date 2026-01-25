// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader (DIAG+)
// - Applies view classes + layers mapping
// - Imports ./hydration.safe.js
// - If import fails: fetches text + shows tail snippet (helps catch truncation / bad quotes)

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  const view = String(q.get('view') || '').toLowerCase();
  const body = document.body;

  function setBodyView(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }
  setBodyView();

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

  async function fetchText(url){
    try{
      const res = await fetch(url, { cache:'no-store' });
      const text = await res.text();
      return { ok:res.ok, status:res.status, text };
    }catch(err){
      return { ok:false, status:0, text:'', err };
    }
  }

  function showFail(detail){
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:980px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: dynamic import failed</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>

        <div style="margin:12px 0 8px 0;font-weight:800">Candidates & diagnostics</div>
        ${detail.blocks || ''}

        <div style="margin:12px 0 6px 0;font-weight:800">Error</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(detail.errText || '')}</pre>

        <div style="margin-top:12px;opacity:.85;line-height:1.45">
          ✅ ถ้า fetch=404 → ชื่อไฟล์/พาธผิด<br/>
          ✅ ถ้า fetch=200 แต่ขึ้น SyntaxError/Unexpected end → ไฟล์ถูกตัด/มี string ไม่ปิด/backtick ไม่ปิด<br/>
          ✅ ถ้า fetch=200 แต่ import error → dependency ที่ import ต่อหาย/พาธผิด
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  const candidates = [
    './hydration.safe.js',
  ].map(withBust);

  (async()=>{
    const blocks = [];
    let lastErr = null;

    for (const p of candidates){
      // 1) try import
      try{
        await import(p);
        return;
      }catch(err){
        lastErr = err;

        // 2) fetch diagnostics (tail)
        const ft = await fetchText(p);
        const tail = (ft.text || '').slice(-420);
        const head = (ft.text || '').slice(0, 220);

        blocks.push(`
          <div style="margin:10px 0;padding:10px 12px;border:1px solid rgba(148,163,184,.18);border-radius:14px;background:rgba(15,23,42,.55)">
            <div><b>${escapeHtml(p)}</b></div>
            <div style="opacity:.85;margin-top:4px">fetch: ${ft.ok ? '200' : escapeHtml(String(ft.status || 'ERR'))}</div>
            <div style="opacity:.85;margin-top:4px">error: ${escapeHtml(String(err && (err.message || err)))}</div>
            <div style="margin-top:8px;font-weight:800">HEAD (first 220 chars)</div>
            <pre style="white-space:pre-wrap;background:rgba(2,6,23,.55);padding:10px;border-radius:12px;border:1px solid rgba(148,163,184,.14)">${escapeHtml(head)}</pre>
            <div style="margin-top:8px;font-weight:800">TAIL (last 420 chars)</div>
            <pre style="white-space:pre-wrap;background:rgba(2,6,23,.55);padding:10px;border-radius:12px;border:1px solid rgba(148,163,184,.14)">${escapeHtml(tail)}</pre>
          </div>
        `);
      }
    }

    showFail({
      blocks: blocks.join(''),
      errText: String(lastErr && (lastErr.stack || lastErr.message || lastErr) || 'All candidate imports failed.')
    });
  })();
})();