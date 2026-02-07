// === /herohealth/vr/launcher-redirect.js ===
// HHA Universal Launcher Redirect — v1.0.0
// ✅ Redirect from ROOT launcher -> RUN page
// ✅ ctx passthrough via HHA_ResearchCtx.buildUrl()
// ✅ NO override: if URL already has ?view=, we keep it exactly
// ✅ optional auto view suggestion ONLY when view missing (launcher may choose)
// ✅ carry hub/log/studyId/phase/conditionGroup/pid/run/diff/time/seed/style
//
// Usage (in a launcher html):
//   <script src="./vr/research-ctx.js"></script>
//   <script src="./vr/launcher-redirect.js"></script>
//   <script>
//      HHA_LauncherRedirect.go('./vr-groups/groups-vr.html', { game:'groups' });
//   </script>

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function qsAll(){
    try { return new URL(location.href).searchParams; }
    catch(_){ return new URLSearchParams(); }
  }

  function hasParam(q, key){
    try{
      const v = q.get(key);
      return !(v === null || v === undefined);
    }catch(_){ return false; }
  }

  function pickViewAuto(){
    const R = WIN.HHA_ResearchCtx;
    if (R && typeof R.pickViewAuto === 'function') return R.pickViewAuto();
    const ua = (navigator.userAgent||'').toLowerCase();
    return (/android|iphone|ipad|ipod|mobile/.test(ua)) ? 'mobile' : 'pc';
  }

  function safeText(id, txt){
    const el = DOC.getElementById(id);
    if (el) el.textContent = String(txt);
  }

  function go(runUrl, opts){
    opts = opts || {};
    const q = qsAll();

    // If runUrl missing => fail loudly (but safe)
    if(!runUrl){
      safeText('fatal', 'Launcher error: runUrl missing');
      return;
    }

    const R = WIN.HHA_ResearchCtx;

    // Build final URL with passthrough
    let finalUrl = '';
    if (R && typeof R.buildUrl === 'function'){
      // Preserve existing params (including view if present)
      const overrides = Object.assign({}, (opts.overrides||{}));

      // "NO override" policy for view: only set view if missing
      if (!hasParam(q,'view') && overrides.view === undefined && opts.autoViewIfMissing){
        overrides.view = pickViewAuto();
      }

      finalUrl = R.buildUrl(runUrl, overrides);
    } else {
      // Fallback: copy query string as-is
      try{
        const u = new URL(runUrl, location.href);
        // carry all current params
        q.forEach((v,k)=> u.searchParams.set(k, v));
        // optional view suggestion if missing (still no override)
        if(!hasParam(q,'view') && opts.autoViewIfMissing){
          u.searchParams.set('view', pickViewAuto());
        }
        // overrides
        if (opts.overrides){
          for(const k of Object.keys(opts.overrides)){
            const v = opts.overrides[k];
            if(v===null||v===undefined||v==='') u.searchParams.delete(k);
            else u.searchParams.set(k, String(v));
          }
        }
        finalUrl = u.toString();
      }catch(_){
        finalUrl = String(runUrl);
      }
    }

    // HARDEN: avoid redirect loop
    try{
      if (location.href.split('#')[0] === finalUrl.split('#')[0]){
        // already here
        return;
      }
    }catch(_){}

    // Redirect
    location.replace(finalUrl);
  }

  WIN.HHA_LauncherRedirect = { go };
})();