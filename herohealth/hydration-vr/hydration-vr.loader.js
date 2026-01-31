// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (FIX import path) — v2.2
// ✅ Always import hydration.safe.js from the SAME folder as this loader
// ✅ Robust candidate import + clear error UI
// ✅ Adds body classes for view: pc/mobile/vr/cvr + cardboard
// ✅ Optional: exposes window.HHA_VIEW = { layers:[...] } for SAFE to read

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if (v==='cvr' || v==='cardboard') return 'cvr';
    if (v==='vr') return 'vr';
    if (v==='mobile') return 'mobile';
    if (v==='pc' || v==='desktop') return 'pc';
    return '';
  }

  function ensureBootErrorBox(){
    let el = DOC.getElementById('bootError');
    if (el) return el;

    // Create minimal error box overlay
    el = DOC.createElement('pre');
    el.id = 'bootError';
    el.hidden = true;
    el.style.position = 'fixed';
    el.style.left = '12px';
    el.style.right = '12px';
    el.style.bottom = '12px';
    el.style.maxHeight = '45vh';
    el.style.overflow = 'auto';
    el.style.zIndex = '9999';
    el.style.padding = '12px';
    el.style.borderRadius = '14px';
    el.style.border = '1px solid rgba(239,68,68,.35)';
    el.style.background = 'rgba(2,6,23,.92)';
    el.style.color = '#fecaca';
    el.style.fontSize = '12px';
    el.style.lineHeight = '1.35';
    el.style.whiteSpace = 'pre-wrap';
    el.style.boxShadow = '0 18px 80px rgba(0,0,0,.55)';
    DOC.body.appendChild(el);
    return el;
  }

  function setErr(msg, extra){
    try{
      console.error(msg, extra||'');
      const el = ensureBootErrorBox();
      el.hidden = false;
      el.textContent = String(msg) + (extra ? '\n\n' + String(extra) : '');
    }catch(_){}
  }

  // ✅ CRITICAL: base must be the folder containing this loader
  // If this loader is at /herohealth/hydration-vr/hydration-vr.loader.js
  // then base becomes /herohealth/hydration-vr/
  function baseFolderURL(){
    try{
      const u = new URL(import.meta.url);
      u.hash = '';
      u.search = '';
      u.pathname = u.pathname.replace(/[^/]*$/, ''); // drop filename
      return u.toString();
    }catch(_){
      // Fallback: use script src
      const s = DOC.currentScript;
      if (s && s.src){
        const u = new URL(s.src, location.href);
        u.hash=''; u.search='';
        u.pathname = u.pathname.replace(/[^/]*$/, '');
        return u.toString();
      }
      return new URL('./', location.href).toString();
    }
  }

  async function tryImport(relPath){
    const base = baseFolderURL();
    const url = new URL(relPath, base);
    return import(url.toString());
  }

  function applyViewClass(){
    const v0 = normalizeView(qs('view',''));
    const b = DOC.body;
    if (!b) return;

    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr','cardboard');

    // NOTE: เราใช้ 'cvr' เป็นโหมดยิงกลางจอ (crosshair)
    if (v0==='cvr'){
      b.classList.add('view-cvr');
      // ถ้าต้องการ split แบบ cardboard จริง ๆ ให้ใช้ ?view=cardboard แยก (แต่ normalizeView จะ map มาเป็น cvr)
      // ดังนั้น: ถ้าต้องการ split ให้ใช้ flag เพิ่ม เช่น ?cb=1 หรือ ?view=cardboard&cb=1
      const cb = String(qs('cb','0')) === '1';
      if (cb) b.classList.add('cardboard');
      return;
    }

    if (v0==='vr'){
      b.classList.add('view-vr');
      return;
    }

    if (v0==='mobile'){
      b.classList.add('view-mobile');
      return;
    }

    b.classList.add('view-pc');
  }

  function exposeLayersHint(){
    // ให้ SAFE ใช้: window.HHA_VIEW.layers -> ['hydration-layer'] หรือ ['hydration-layerL','hydration-layerR']
    // Run page จะมี element เหล่านี้อยู่แล้ว
    try{
      const b = DOC.body;
      const isCardboard = b && b.classList.contains('cardboard');

      const layers = [];
      const main = DOC.getElementById('hydration-layer');
      const L = DOC.getElementById('hydration-layerL');
      const R = DOC.getElementById('hydration-layerR');

      if (isCardboard && L && R){
        layers.push('hydration-layerL','hydration-layerR');
      } else if (main){
        layers.push('hydration-layer');
      }

      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = layers;
    }catch(_){}
  }

  async function boot(){
    try{
      applyViewClass();
      exposeLayersHint();

      const v = Date.now();
      const candidates = [
        `./hydration.safe.js?v=${v}`,
        `./hydration.safe.js`
      ];

      let lastErr = null;
      for (const p of candidates){
        try{
          await tryImport(p);
          return; // success
        }catch(e){
          lastErr = e;
        }
      }

      const base = baseFolderURL();
      setErr(
        `❌ HydrationVR: import failed (loader)\nbase: ${base}\nTried:\n- ${candidates.join('\n- ')}`,
        lastErr && (lastErr.stack || lastErr.message || String(lastErr))
      );
    }catch(e){
      setErr('❌ HydrationVR: loader crashed', e && (e.stack || e.message || String(e)));
    }
  }

  boot();
})();