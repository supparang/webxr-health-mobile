/* =========================================================
   HeroHealth Groups Solo Patch Loader
   PATCH SET: v20260522-loader-clean-11
   File: /herohealth/patches/groups/groups-solo-patch-loader.js

   Purpose:
   - Clean loader with no duplicated VERSION declaration
   - Load Groups Solo patches 01–11 in strict order
   - GitHub Pages safe path under /webxr-health-mobile/
========================================================= */
(function(){
  'use strict';

  var LOADER_PATCH_ID = 'v20260522-groups-solo-patch-loader-clean-11';

  if (window.__HHA_GROUPS_SOLO_PATCH_LOADER_CLEAN_11__) return;
  window.__HHA_GROUPS_SOLO_PATCH_LOADER_CLEAN_11__ = true;

  var LOADER_VERSION = '20260522-loader-clean-11';

  var PATCH_FILES = [
    '01-groups-solo-3view-stabilizer.js',
    '02-groups-solo-summary-mobile-final.js',
    '03-groups-solo-gameplay-mobile-cvr-final.js',
    '04-groups-solo-cooldown-flow-final.js',
    '05-groups-solo-save-log-final.js',
    '06-groups-solo-final-qa-gate.js',
    '07-groups-solo-start-button-fix.js',
    '08-groups-solo-practice-mode.js',
    '09-groups-solo-mode-link-fix.js',
    '10-groups-solo-gameplay-nav-lock.js',
    '11-groups-solo-skip-intro-autostart.js'
  ];

  function currentBase(){
    var current = '';

    try {
      current =
        document.currentScript && document.currentScript.src ||
        Array.prototype.slice.call(document.scripts)
          .map(function(s){ return s.src || ''; })
          .find(function(src){
            return src.indexOf('groups-solo-patch-loader.js') >= 0;
          }) ||
        '';
    } catch(e) {}

    if (current) {
      return new URL('.', current).href;
    }

    return 'https://supparang.github.io/webxr-health-mobile/herohealth/patches/groups/';
  }

  var BASE = currentBase();

  function loadScript(src){
    return new Promise(function(resolve){
      var s = document.createElement('script');
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

    var style = document.createElement('style');
    style.id = 'hha-groups-patch-loader-toast-style';
    style.textContent = [
      '.hha-groups-patch-loader-toast{',
      'position:fixed;',
      'left:50%;',
      'bottom:calc(18px + env(safe-area-inset-bottom,0px));',
      'transform:translateX(-50%) translateY(12px);',
      'z-index:999999;',
      'width:min(92vw,520px);',
      'padding:11px 15px;',
      'border-radius:18px;',
      'background:rgba(21,48,74,.93);',
      'color:#fff;',
      'text-align:center;',
      'font:900 13px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      'box-shadow:0 16px 36px rgba(0,0,0,.24);',
      'opacity:0;',
      'pointer-events:none;',
      'transition:.18s ease;',
      '}',
      '.hha-groups-patch-loader-toast.show{',
      'opacity:1;',
      'transform:translateX(-50%) translateY(0);',
      '}'
    ].join('');

    document.head.appendChild(style);

    var box = document.createElement('div');
    box.className = 'hha-groups-patch-loader-toast';
    document.body.appendChild(box);

    var timer = null;

    window.addEventListener('hha:toast', function(ev){
      var msg =
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

  function addLoadedClasses(){
    try {
      document.documentElement.classList.add('hha-groups-solo-patches-loaded');
      document.body.classList.add('hha-groups-solo-patches-loaded');
    } catch(e) {}
  }

  async function boot(){
    installFallbackToast();

    console.info('[Groups Solo Patch Loader]', LOADER_PATCH_ID, {
      base: BASE,
      version: LOADER_VERSION,
      files: PATCH_FILES
    });

    var results = [];

    for (var i = 0; i < PATCH_FILES.length; i++) {
      var f = PATCH_FILES[i];
      var url = BASE + f + '?v=' + LOADER_VERSION;
      var result = await loadScript(url);

      results.push({
        file: f,
        ok: !!result.ok,
        url: result.src
      });
    }

    var failed = results.filter(function(x){
      return !x.ok;
    });

    var report = {
      patch: LOADER_PATCH_ID,
      base: BASE,
      version: LOADER_VERSION,
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

    addLoadedClasses();

    console.info('[Groups Solo Patch Loader] all patches loaded', report);

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
