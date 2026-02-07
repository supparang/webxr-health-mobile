// === /herohealth/vr/hha-launch.js ===
// HHA Universal Launcher Redirect — v1.0.0
// ✅ auto-detect view, but NEVER override if ?view= exists
// ✅ redirect to runUrl with ctx passthrough

(function(){
  'use strict';
  const WIN = window;

  function getQS(){
    try{ return new URL(location.href).searchParams; }
    catch(_){ return new URLSearchParams(); }
  }

  function hasViewExplicit(){
    const q = getQS();
    const v = q.get('view');
    return !!(v && String(v).trim());
  }

  function detectView(){
    // ultra-simple heuristic:
    // - if WebXR supported and user is in VR session => 'vr'/'cvr' handled by run page anyway
    // - mobile => 'mobile'
    // - else 'pc'
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.innerWidth <= 860);
    return isMobile ? 'mobile' : 'pc';
  }

  // public: redirect(runHtmlPath)
  WIN.HHA_LAUNCH = {
    go: function(runUrl){
      if (!WIN.HHA_CTX || !WIN.HHA_CTX.buildUrl){
        // fallback: just go
        location.href = runUrl;
        return;
      }

      const extra = {};
      // IMPORTANT: view auto-detect ONLY if view not explicitly provided
      if (!hasViewExplicit()){
        extra.view = detectView();
      }

      const url = WIN.HHA_CTX.buildUrl(runUrl, extra);
      location.replace(url);
    }
  };
})();