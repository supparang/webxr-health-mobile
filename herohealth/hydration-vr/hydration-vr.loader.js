// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — PRODUCTION (HARDENED + BOOT CALL)
// ✅ Applies view classes
// ✅ Ensures playfield + layers exist (auto-create if missing)
// ✅ Imports ./hydration.safe.js (ESM) AND calls boot()
// ✅ Shows readable overlay on failure

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const bust = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!bust) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(bust);
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

  // ---- HARDEN: Ensure playfield/layers exist even if HTML/HUD got changed ----
  function ensureEl(tag, id, parent){
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement(tag);
    el.id = id;
    parent.appendChild(el);
    return el;
  }

  function ensurePlayfieldStructure(){
    // playfield base
    const pf = ensureEl('div','playfield', document.body);
    if (!pf.style.position){
      pf.style.position = 'fixed';
      pf.style.inset = '0';
      pf.style.zIndex = '10';
      pf.style.overflow = 'hidden';
      pf.style.touchAction = 'manipulation';
    }

    // cardboard base
    const cb = ensureEl('div','cbPlayfield', document.body);
    if (!cb.style.position){
      cb.style.position='fixed';
      cb.style.inset='0';
      cb.style.zIndex='10';
      cb.style.overflow='hidden';
      cb.style.display='none';
    }

    // main layer
    const main = ensureEl('div','hydration-layer', pf);
    if (!main.style.position){
      main.style.position='absolute';
      main.style.inset='0';
      main.style.pointerEvents='auto';
    }

    // cardboard halves
    let left = cb.querySelector('.cbHalf.left');
    if (!left){
      left = document.createElement('div');
      left.className = 'cbHalf left';
      cb.appendChild(left);
    }
    let right = cb.querySelector('.cbHalf.right');
    if (!right){
      right = document.createElement('div');
      right.className = 'cbHalf right';
      cb.appendChild(right);
    }
    if (!left.style.position){
      left.style.position='absolute'; left.style.top='0'; left.style.bottom='0'; left.style.left='0';
      left.style.width='50%'; left.style.overflow='hidden'; left.style.pointerEvents='auto';
    }
    if (!right.style.position){
      right.style.position='absolute'; right.style.top='0'; right.style.bottom='0'; right.style.right='0';
      right.style.width='50%'; right.style.overflow='hidden'; right.style.pointerEvents='auto';
    }

    const L = ensureEl('div','hydration-layerL', left);
    const R = ensureEl('div','hydration-layerR', right);
    if (!L.style.position){ L.style.position='absolute'; L.style.inset='0'; L.style.pointerEvents='auto'; }
    if (!R.style.position){ R.style.position='absolute'; R.style.inset='0'; R.style.pointerEvents='auto'; }

    // show/hide by body class
    if (body.classList.contains('cardboard')){
      pf.style.display = 'none';
      cb.style.display = 'block';
    } else {
      pf.style.display = 'block';
      cb.style.display = 'none';
    }
  }

  ensurePlayfieldStructure();

  // map layers for hydration.safe.js
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    cfg.layers = body.classList.contains('cardboard')
      ? ['hydration-layerL','hydration-layerR']
      : ['hydration-layer'];
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
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR loader failed</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(document.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
      </div>
    `;
    document.body.appendChild(el);
  }

  const candidates = [
    './hydration.safe.js',
  ].map(withBust);

  (async()=>{
    const tried=[];
    for (const p of candidates){
      tried.push(p);
      try{
        const mod = await import(p);

        // ✅ CRITICAL: call boot() if exported
        if (mod && typeof mod.boot === 'function'){
          await mod.boot();
        } else if (mod && typeof mod.default === 'function'){
          // allow default export boot
          await mod.default();
        } else {
          // ถ้าไม่มี boot() แปลว่า safe.js ต้อง auto-run เอง
          // แต่เพื่อกันนิ่งเกินไป เราจะแจ้งเตือนแบบไม่พัง
          console.warn('[HydrationVR] hydration.safe.js loaded but no boot() export found.');
        }
        return;
      }catch(e){
        // keep trying next candidate
      }
    }
    showFail(new Error('All candidate imports failed or boot() threw.'), tried);
  })();
})();