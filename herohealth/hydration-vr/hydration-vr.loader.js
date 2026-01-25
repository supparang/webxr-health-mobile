// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — DEBUG+ROBUST
// ✅ Applies view classes already set by hydration-vr.html (no override)
// ✅ Sets window.HHA_VIEW.layers for cardboard split
// ✅ Imports ./hydration.safe.js with cache-bust
// ✅ On failure: shows HTTP status + real import error (stack)

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  const body = document.body;

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

  function showFail(lastErr, tried){
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:980px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (folder loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>

        <div style="margin:12px 0 8px 0;font-weight:800">Tried:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>

        <div style="margin:12px 0 6px 0;font-weight:800">Last error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(lastErr && (lastErr.stack || lastErr.message || lastErr)))}</pre>

        <div style="margin-top:12px;opacity:.9;line-height:1.5">
          <b>เช็คด่วน:</b><br>
          1) ไฟล์ <code>hydration.safe.js</code> อยู่โฟลเดอร์เดียวกับ <code>hydration-vr.html</code> จริงไหม<br>
          2) ไฟล์ที่ import ต่อ เช่น <code>../vr/ui-water.js</code> และ <code>../vr/ai-coach.js</code> มีอยู่จริงไหม (สะกดตรงเป๊ะ)<br>
          3) เปิด DevTools → Network ดูว่าไฟล์ไหน 404
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  const candidates = [ './hydration.safe.js' ].map(withBust);

  (async()=>{
    const tried=[];
    let lastErr=null;

    for (const p of candidates){
      // preflight HTTP check (helps show 404/500 clearly)
      try{
        const r = await fetch(p, { cache:'no-store' });
        if (!r.ok){
          tried.push(`${p}  (HTTP ${r.status})`);
          continue;
        } else {
          tried.push(`${p}  (HTTP ${r.status})`);
        }
      }catch(e){
        tried.push(`${p}  (fetch error: ${e && e.message ? e.message : e})`);
        lastErr=e;
        continue;
      }

      // real dynamic import
      try{
        await import(p);
        return;
      }catch(e){
        lastErr=e;
        tried[tried.length-1] += `  (import error: ${e && e.message ? e.message : e})`;
      }
    }

    showFail(lastErr || new Error('All candidate imports failed.'), tried);
  })();
})();