// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — PRODUCTION (A+C)
// ✅ Fix: import failed diagnostics (shows real error + fetch status/MIME)
// ✅ Auto-detect view if no ?view= (PC/Mobile) BUT never override existing view
// ✅ Cardboard layers mapping via window.HHA_VIEW.layers
// ✅ Cache bust using ts/v when present

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  function isMobileUA(){
    try{
      const ua = navigator.userAgent || '';
      return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    }catch(_){ return false; }
  }

  // Respect existing view (do NOT override)
  function detectViewIfMissing(){
    const existing = String(q.get('view') || '').toLowerCase();
    if (existing) return existing;

    // Optional hints (from hub if you ever pass them)
    const hint = String(q.get('mode') || q.get('device') || '').toLowerCase();
    if (hint === 'cvr' || hint === 'cardboard' || hint === 'vr') return hint === 'vr' ? 'cvr' : hint;

    // Default detect: mobile -> mobile, else pc
    return isMobileUA() ? 'mobile' : 'pc';
  }

  const view = detectViewIfMissing();
  const body = document.body;

  function setBodyView(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');

    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }
  setBodyView();

  // Expose current view (useful for HUD copy)
  try{ window.HHA_VIEWMODE = view; }catch(_){}

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
    el.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:980px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (folder loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">Detected view: <b>${escapeHtml(view)}</b> (won't override existing ?view=)</div>

        <div style="margin:12px 0 8px 0;font-weight:800">Tried paths + fetch check:</div>
        <ol style="line-height:1.6">
          ${tried.map(t=>`
            <li>
              <code>${escapeHtml(t.path)}</code>
              <div style="opacity:.85;font-size:12px;margin-top:4px">
                fetch: ${escapeHtml(t.fetchInfo || '—')}
              </div>
            </li>
          `).join('')}
        </ol>

        <div style="margin:12px 0 6px 0;font-weight:800">Last Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>

        <div style="margin-top:12px;opacity:.9;font-size:12px;line-height:1.45">
          Tip: ถ้า fetch ได้ <b>200</b> แต่ content-type เป็น <b>text/html</b> แปลว่าโดน 404 แล้ว GH Pages ส่งหน้า HTML กลับมา (path หรือชื่อไฟล์ผิด/case-sensitive)
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  async function probeFetch(url){
    try{
      const r = await fetch(url, { method:'GET', cache:'no-store' });
      const ct = r.headers.get('content-type') || '';
      return `status=${r.status} ok=${r.ok} type=${ct}`;
    }catch(e){
      return `fetch-error: ${String(e && (e.message||e))}`;
    }
  }

  // Candidates (more robust)
  const candidates = [
    './hydration.safe.js',
    'hydration.safe.js',
    './hydration.safe.js?ts=' + encodeURIComponent(Date.now()),
  ].map(withBust);

  (async()=>{
    const tried=[];
    let lastErr=null;

    for (const p of candidates){
      const info =