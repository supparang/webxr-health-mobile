// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — PRODUCTION (cVR shoot bridge)
// - Applies view classes + layers mapping
// - Imports ./hydration.safe.js
// - cVR: shoot from crosshair (hha:shoot + tap + keyboard) even when layer pointer-events:none
// - Shows readable overlay on failure

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const v = q.get('v') || q.get('ts') || '';
  const view = String(q.get('view') || '').toLowerCase();
  const lockPx = Math.max(12, Math.min(260, parseInt(q.get('lockPx') || '120', 10) || 120)); // aim assist radius for cVR
  const body = document.body;

  function withBust(p){
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  function setBodyView(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }
  setBodyView();

  // map layers for hydration.safe.js
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    if (body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
    cfg.view = body.classList.contains('view-cvr') ? 'cvr' :
               body.classList.contains('cardboard') ? 'cardboard' :
               body.classList.contains('view-mobile') ? 'mobile' : 'pc';
    cfg.lockPx = lockPx;
  })();

  // -------- cVR shoot bridge (no changes needed in hydration.safe.js) --------
  function centerPoint(){
    const x = Math.round(window.innerWidth / 2);
    const y = Math.round(window.innerHeight / 2);
    return { x, y };
  }

  function dist2(ax,ay,bx,by){
    const dx=ax-bx, dy=ay-by;
    return dx*dx + dy*dy;
  }

  function findClosestTargetNear(x, y, maxR){
    // Collect all current targets (spawned by hydration.safe.js)
    const targets = document.querySelectorAll('.hvr-target');
    if (!targets || !targets.length) return null;

    const maxD2 = maxR * maxR;
    let best = null;
    let bestD2 = Infinity;

    for (const el of targets){
      if (!el || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      // ignore offscreen / tiny
      if (r.width < 10 || r.height < 10) continue;

      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;

      const d2 = dist2(cx, cy, x, y);
      if (d2 <= maxD2 && d2 < bestD2){
        bestD2 = d2;
        best = el;
      }
    }
    return best;
  }

  function fireAtElement(el){
    if (!el) return false;
    try{
      // pointerdown is what hydration.safe.js listens to
      const ev = new PointerEvent('pointerdown', { bubbles:true, cancelable:true, pointerType:'touch' });
      el.dispatchEvent(ev);
      return true;
    }catch(_){
      try{
        el.dispatchEvent(new Event('pointerdown', { bubbles:true, cancelable:true }));
        return true;
      }catch(__){}
    }
    return false;
  }

  function installCVRBridge(){
    if (!body.classList.contains('view-cvr')) return;

    // 1) listen to hha:shoot from Universal VR UI (vr-ui.js) if present
    window.addEventListener('hha:shoot', (ev)=>{
      const d = (ev && ev.detail) || {};
      const p = centerPoint();
      const x = (typeof d.x === 'number') ? d.x : p.x;
      const y = (typeof d.y === 'number') ? d.y : p.y;
      const r = (typeof d.lockPx === 'number') ? Math.max(12, Math.min(260, d.lockPx)) : lockPx;

      const hit = findClosestTargetNear(x, y, r);
      if (hit) fireAtElement(hit);
    });

    // 2) tap anywhere -> shoot (mobile cardboard-style strict)
    const onTapShoot = (ev)=>{
      // prevent double triggers when clicking buttons/overlay
      const t = ev && ev.target;
      if (t && (t.closest && (t.closest('#startOverlay') || t.closest('#resultBackdrop')))) return;
      const p = centerPoint();
      const hit = findClosestTargetNear(p.x, p.y, lockPx);
      if (hit) fireAtElement(hit);
    };
    window.addEventListener('pointerdown', onTapShoot, { passive:true });

    // 3) keyboard support
    window.addEventListener('keydown', (ev)=>{
      if (!ev) return;
      const k = String(ev.key || '').toLowerCase();
      if (k === ' ' || k === 'spacebar' || k === 'enter'){
        const p = centerPoint();
        const hit = findClosestTargetNear(p.x, p.y, lockPx);
        if (hit) fireAtElement(hit);
      }
    });

    // helpful hint in console
    try{
      console.log('[HydrationVR Loader] cVR shoot bridge enabled. lockPx=', lockPx);
    }catch(_){}
  }
  installCVRBridge();

  // -------- failure overlay helpers --------
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
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (folder loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">view: <code>${escapeHtml(view || 'pc')}</code> lockPx: <code>${escapeHtml(String(lockPx))}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
      </div>
    `;
    document.body.appendChild(el);
  }

  // candidates (keep simple + robust)
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
      }catch(_){}
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();
})();