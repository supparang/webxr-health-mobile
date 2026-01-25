// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader (DIAGNOSTIC+)
// ✅ Applies view classes + layers mapping
// ✅ Imports ./hydration.safe.js
// ✅ Shows REAL error + fetch status (404/200) for each candidate

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

  async function fetchStatus(url){
    try{
      const r = await fetch(url, { method:'GET', cache:'no-store' });
      return { ok:r.ok, status:r.status, statusText:r.statusText || '' };
    }catch(e){
      return { ok:false, status:0, statusText:String(e && (e.message||e)) };
    }
  }

  function showFail(rows){
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:980px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: dynamic import failed</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>

        <div style="margin:12px 0 8px 0;font-weight:800">Candidates & diagnostics</div>
        <ol style="line-height:1.55">
          ${rows.map(r=>`
            <li style="margin-bottom:10px">
              <div><code>${escapeHtml(r.path)}</code></div>
              <div style="opacity:.9">fetch: <b>${escapeHtml(String(r.fetchStatus))}</b></div>
              <div style="opacity:.9">error:</div>
              <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(r.err||'—')}</pre>
            </li>
          `).join('')}
        </ol>

        <div style="opacity:.9;margin-top:8px">
          ✅ ถ้า fetch เป็น 404 = ไฟล์หาย/ชื่อไม่ตรง/พาธผิด<br/>
          ✅ ถ้า fetch เป็น 200 แต่ import error = ไฟล์นั้น import ต่อแล้วเจอ dependency หาย หรือมี syntax error
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  const candidates = [
    './hydration.safe.js',
  ].map(withBust);

  (async()=>{
    const rows=[];
    for (const p of candidates){
      const st = await fetchStatus(p);
      try{
        await import(p);
        return; // success
      }catch(e){
        rows.push({
          path: p,
          fetchStatus: st.status ? `${st.status} ${st.statusText||''}` : st.statusText,
          err: String(e && (e.stack || e.message || e))
        });
      }
    }
    showFail(rows.length ? rows : [{ path:'(none)', fetchStatus:'-', err:'All candidate imports failed.' }]);
  })();
})();
