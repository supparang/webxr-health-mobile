// === /herohealth/hydration-vr.loader.js ===
// HydrationVR Loader — ROBUST
// ✅ Auto apply view classes
// ✅ Robust import candidates (root + folder)
// ✅ Shows real import error (stack) if fails
// ✅ Auto-start on first user gesture (prevents “HUD only”)

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const bust = q.get('v') || q.get('ts') || '';

  const withBust = (p)=>{
    if (!bust) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(bust);
  };

  const body = document.body;

  // ---- view class ----
  const view = String(q.get('view') || '').toLowerCase();
  function setBodyView(){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cardboard') body.classList.add('cardboard');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else body.classList.add('view-pc');
  }
  setBodyView();

  // ---- map layers for safe.js ----
  (function setLayers(){
    const cfg = window.HHA_VIEW || (window.HHA_VIEW = {});
    if (body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  })();

  // ---- helpers ----
  const esc = (s)=>String(s).replace(/[&<>"']/g, m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));

  function showFail(err, tried){
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:980px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${esc(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${esc(document.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:800">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${esc(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:800">Error (real):</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${esc(String(err && (err.stack || err.message || err)))}</pre>
        <div style="opacity:.9;margin-top:10px">
          ✅ ถ้าเห็นว่า 404 → path ผิด / ไฟล์ไม่อยู่ตำแหน่งนั้น<br/>
          ✅ ถ้าเห็นว่า “Failed to resolve module specifier ../vr/...” → ไฟล์ใน ../vr ยังไม่อยู่/ชื่อไม่ตรง
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  // ---- IMPORTANT: robust candidates ----
  // รองรับ 2 แบบยอดฮิต:
  // 1) hydration-vr.html อยู่ root /herohealth/ แล้ว safe อยู่ /herohealth/hydration-vr/
  // 2) hydration-vr.html อยู่ /herohealth/hydration-vr/ แล้ว safe อยู่ที่เดียวกัน
  const candidates = [
    './hydration.safe.js',
    './hydration-vr/hydration.safe.js',
    './hydration-vr/hydration.safe.js', // เผื่อ deploy ซ้ำ
    './hydration-vr/hydration.safe.mjs',
    './hydration.safe.mjs',
  ].map(withBust);

  // ---- autostart (first gesture) ----
  function armAutoStart(){
    let fired=false;
    const fire=()=>{
      if (fired) return;
      fired=true;
      try{ window.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
      cleanup();
    };
    const cleanup=()=>{
      window.removeEventListener('pointerdown', fire, true);
      window.removeEventListener('keydown', fire, true);
      window.removeEventListener('touchstart', fire, true);
    };
    window.addEventListener('pointerdown', fire, {capture:true, passive:true});
    window.addEventListener('touchstart', fire, {capture:true, passive:true});
    window.addEventListener('keydown', fire, {capture:true, passive:true});
  }

  (async()=>{
    const tried=[];
    let lastErr=null;

    for (const p of candidates){
      tried.push(p);
      try{
        console.log('[HydrationLoader] importing:', p);
        await import(p);
        console.log('[HydrationLoader] import OK:', p);

        // กันเคส “ยิง start เร็วไปก่อน safe.js ฟัง”
        requestAnimationFrame(()=>armAutoStart());
        return;
      }catch(err){
        lastErr = err;
        console.warn('[HydrationLoader] import FAIL:', p, err);
      }
    }

    showFail(lastErr || new Error('All candidate imports failed.'), tried);
  })();
})();
