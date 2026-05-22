/* =========================================================
   HeroHealth Groups Solo Patch Loader
   PATCH SET: v20260521-startfix07b
   File: /herohealth/patches/groups/groups-solo-patch-loader.js

   Purpose:
   - Load Groups Solo patches from the same folder as this loader
   - GitHub Pages safe path under /webxr-health-mobile/
   - Load patch 01–07 in strict order
   - Fix syntax issue when adding patch 07
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260521-groups-solo-patch-loader-startfix07b';

  if (window.__HHA_GROUPS_SOLO_PATCH_LOADER_STARTFIX07B__) return;
  window.__HHA_GROUPS_SOLO_PATCH_LOADER_STARTFIX07B__ = true;

  const VERSION = '20260521-startfix07b';

  const files = [
    '01-groups-solo-3view-stabilizer.js',
    '02-groups-solo-summary-mobile-final.js',
    '03-groups-solo-gameplay-mobile-cvr-final.js',
    '04-groups-solo-cooldown-flow-final.js',
    '05-groups-solo-save-log-final.js',
    '06-groups-solo-final-qa-gate.js',
    '07-groups-solo-start-button-fix.js'
  ];

  function currentBase(){
    const current =
      document.currentScript && document.currentScript.src ||
      Array.from(document.scripts)
        .map(function(s){ return s.src || ''; })
        .find(function(src){
          return src.includes('groups-solo-patch-loader.js');
        }) ||
      '';

    if (current) {
      return new URL('.', current).href;
    }

    return 'https://supparang.github.io/webxr-health-mobile/herohealth/patches/groups/';
  }

  const BASE = currentBase();

  function loadScript(src){
    return new Promise(function(resolve){
      const s = document.createElement('script');
      s.src = src;
      s.async = false;

      s.onload = function(){
        console.info('[Groups Solo Patch Loader] loaded:', src);
        resolve({
          ok: true,
          src: src
        });
      };

      s.onerror = function(){
        console.warn('[Groups Solo Patch Loader] failed:', src);
        resolve({
          ok: false,
          src: src
        });
      };

      document.head.appendChild(s);
    });
  }

  function installFallbackToast(){
    if (window.__HHA_GROUPS_PATCH_LOADER_TOAST_READY__) return;
    window.__HHA_GROUPS_PATCH_LOADER_TOAST_READY__ = true;

    const style = document.createElement('style');
    style.id = 'hha-groups-patch-loader-toast-style';
    style.textContent = `
      .hha-groups-patch-loader-toast{
        position:fixed;
        left:50%;
        bottom:calc(18px + env(safe-area-inset-bottom, 0px));
        transform:translateX(-50%) translateY(12px);
        z-index:999999;
        width:min(92vw, 520px);
        padding:11px 15px;
        border-radius:18px;
        background:rgba(21,48,74,.93);
        color:#fff;
        text-align:center;
        font:900 13px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 16px 36px rgba(0,0,0,.24);
        opacity:0;
        pointer-events:none;
        transition:.18s ease;
      }

      .hha-groups-patch-loader-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }
    `;
    document.head.appendChild(style);

    const box = document.createElement('div');
    box.className = 'hha-groups-patch-loader-toast';
    document.body.appendChild(box);

    let timer = null;

    window.addEventListener('hha:toast', function(ev){
      const msg =
        ev.detail && (ev.detail.message || ev.detail.text) ||
        '';

      if (!msg) return;

      box.textContent = msg;
      box.classList.add('show');

      clearTimeout(timer);
      timer = setTimeout(function(){
        box.classList.remove('show');
      }, 1800);
    });
  }

  function toast(message, type){
    try {
      window.dispatchEvent(new CustomEvent('hha:toast', {
        detail: {
          type: type || 'info',
          message: String(message || '')
        }
      }));
    } catch(e) {
      try {
        console.info('[Groups Solo Patch Loader]', message);
      } catch(err) {}
    }
  }

  function saveReport(report){
    window.HHA_GROUPS_SOLO_PATCH_LOADER_REPORT = report;

    try {
      sessionStorage.setItem(
        'HHA_GROUPS_SOLO_PATCH_LOADER_REPORT',
        JSON.stringify(report)
      );
    } catch(e) {}

    try {
      localStorage.setItem(
        'HHA_GROUPS_SOLO_PATCH_LOADER_REPORT',
        JSON.stringify(report)
      );
    } catch(e) {}
  }

  async function boot(){
    installFallbackToast();

    console.info('[Groups Solo Patch Loader]', PATCH_ID, {
      base: BASE,
      version: VERSION,
      files: files
    });

    const results = [];

    for (const f of files) {
      const url = BASE + f + '?v=' + VERSION;
      const result = await loadScript(url);

      results.push({
        file: f,
        ok: !!result.ok,
        url: result.src
      });
    }

    const failed = results.filter(function(x){
      return !x.ok;
    });

    const report = {
      patch: PATCH_ID,
      base: BASE,
      version: VERSION,
      results: results,
      failed: failed,
      ok: failed.length === 0,
      loadedAt: new Date().toISOString(),
      pageUrl: location.href
    };

    saveReport(report);

    if (failed.length) {
      console.warn('[Groups Solo Patch Loader] some patches failed', failed);

      toast(
        'โหลด patch บางไฟล์ไม่สำเร็จ: ' +
        failed.map(function(x){ return x.file; }).join(', '),
        'warn'
      );

      return;
    }

    console.info('[Groups Solo Patch Loader] all patches loaded', report);

    document.documentElement.classList.add('hha-groups-solo-patches-loaded');
    document.body.classList.add('hha-groups-solo-patches-loaded');

    toast('Groups Solo patches loaded', 'ok');

    try {
      window.dispatchEvent(new CustomEvent('hha:groups:solo-patches-loaded', {
        detail: report
      }));
    } catch(e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
