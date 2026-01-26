// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — DEBUG-STRONG
// ✅ Shows real import error (SyntaxError / 404 / export mismatch)
// ✅ Keeps cache-bust via ?v=
// ✅ Tries multiple candidates

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

  async function probe(url){
    // ช่วยบอก 404/OK แบบชัดๆ
    try{
      const res = await fetch(url, { method:'GET', cache:'no-store' });
      return { ok: res.ok, status: res.status, ct: res.headers.get('content-type') || '' };
    }catch(e){
      return { ok:false, status:0, ct:'', err: e };
    }
  }

  function showFail(err, tried, probes){
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:980px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (REAL ERROR)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>

        <div style="margin:12px 0 8px 0;font-weight:800">Tried paths:</div>
        <ol style="line-height:1.65">
          ${tried.map((s,i)=>{
            const p = probes[i] || {};
            const badge = p.ok ? `✅ ${p.status} (${escapeHtml(p.ct||'')})` : `❌ ${p.status||'ERR'}`;
            return `<li><code>${escapeHtml(s)}</code> <span style="opacity:.85">— ${badge}</span></li>`;
          }).join('')}
        </ol>

        <div style="margin:12px 0 6px 0;font-weight:800">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>

        <div style="margin-top:10px;opacity:.9;line-height:1.5">
          <b>Hint:</b><br/>
          • ถ้าเห็น <code>404</code> = path ผิด/ไฟล์ไม่ถูก deploy<br/>
          • ถ้าเห็น <code>SyntaxError</code> = โค้ดไฟล์ใดไฟล์หนึ่งพัง (ดูบรรทัดใน stack)<br/>
          • ถ้าเห็น <code>does not provide an export named</code> = export/import ชื่อไม่ตรง
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  const candidates = [
    './hydration.safe.js',
    './hydration.safe.mjs',
    '../hydration.safe.js'
  ].map(withBust);

  (async()=>{
    const tried=[];
    const probes=[];
    let lastErr = null;

    for (const p of candidates){
      tried.push(p);
      probes.push(await probe(p));

      try{
        await import(p);
        return; // ✅ success
      }catch(e){
        lastErr = e;
        // ไม่กลืนทิ้งแล้ว
      }
    }
    showFail(lastErr || new Error('All candidate imports failed.'), tried, probes);
  })();
})();