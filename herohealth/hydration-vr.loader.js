// === /herohealth/hydration-vr.loader.js ===
// HydrationVR Loader — VIEW + IMPORT (PRODUCTION)
// ✅ view=pc | mobile | cardboard
// ✅ sets body classes: view-pc/view-mobile/cardboard
// ✅ sets window.HHA_VIEW.layers for L/R
// ✅ best-effort fullscreen + landscape lock for cardboard
// ✅ imports hydration.safe.js from correct path (root page)

'use strict';

(function () {
  const DOC = document;
  const q = new URLSearchParams(location.search);
  const view = String(q.get('view') || '').toLowerCase(); // pc | mobile | cardboard
  const v = q.get('v') || q.get('ts') || ''; // cache bust

  function withBust(p) {
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  function setBodyView() {
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','cardboard');
    if (view === 'mobile') b.classList.add('view-mobile');
    else if (view === 'cardboard') b.classList.add('cardboard');
    else if (view === 'pc') b.classList.add('view-pc');
    // default: ถ้าไม่ระบุ view → ไม่ทำอะไร (ให้ overlay เลือก)
  }

  function setHhaViewLayers() {
    window.HHA_VIEW = window.HHA_VIEW || {};
    if (view === 'cardboard') {
      window.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
      window.HHA_VIEW.playfieldId = 'cbPlayfield';
    } else {
      window.HHA_VIEW.layers = ['hydration-layer'];
      window.HHA_VIEW.playfieldId = 'playfield';
    }
  }

  async function tryFullscreenAndLock() {
    if (view !== 'cardboard') return;
    const el = DOC.documentElement;

    // fullscreen best-effort (ต้องมี user gesture; แต่เราพยายามรอบแรก แล้ว fallback ให้กดเองได้)
    try {
      if (!DOC.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch (_) {}

    // landscape lock best-effort
    try {
      const so = screen.orientation;
      if (so && so.lock) await so.lock('landscape');
    } catch (_) {}
  }

  // ถ้าต้องการปุ่ม “ENTER FULLSCREEN” ในโหมด cardboard แบบชัวร์:
  function addCardboardHintButton() {
    if (view !== 'cardboard') return;
    const hint = DOC.createElement('button');
    hint.textContent = '🕶️ ENTER FULLSCREEN (Cardboard)';
    hint.style.cssText = `
      position:fixed; left:50%; top:12px; transform:translateX(-50%);
      z-index:9999; padding:10px 12px; border-radius:14px;
      border:1px solid rgba(148,163,184,.25);
      background:rgba(2,6,23,.72); color:#e5e7eb;
      font:900 12px/1.1 system-ui; cursor:pointer;
    `;
    hint.addEventListener('click', async ()=>{
      await tryFullscreenAndLock();
      hint.remove();
    });
    DOC.body.appendChild(hint);
  }

  function showFail(err, tried) {
    const el = DOC.createElement('div');
    el.style.cssText = [
      'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;',
      'font-family:system-ui,Segoe UI,Roboto,Arial;padding:16px;overflow:auto'
    ].join('');
    el.innerHTML = `
      <div style="max-width:880px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(DOC.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s => `<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
      </div>
    `;
    DOC.body.appendChild(el);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  // ====== BOOT ======
  setBodyView();
  setHhaViewLayers();

  // Cardboard: พยายาม fullscreen/landscape (บางเครื่องต้องกดปุ่ม)
  if (view === 'cardboard') {
    setTimeout(tryFullscreenAndLock, 250);
    setTimeout(addCardboardHintButton, 700);
  }

  // import safe.js (root page: /herohealth/hydration-vr.html)
  const candidates = [
    './hydration-vr/hydration.safe.js', // ✅ root page structure
  ].map(withBust);

  (async () => {
    const tried = [];
    for (const p of candidates) {
      tried.push(p);
      try {
        await import(p);
        return;
      } catch (e) {}
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();