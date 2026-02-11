// === /herohealth/launch/launcher-core.js ===
// HeroHealth Launcher Core — PRODUCTION v20260211a
// ✅ Auto-detect view (pc/mobile/cvr) BUT:
//    - DO NOT override if ?view= exists
// ✅ Pass-through params to target
// ✅ Apply defaults only if missing
// ✅ Keep hub/log seed research params intact

export function hhGo(targetUrl, opts = {}){
  const defaults = (opts && opts.defaults) ? opts.defaults : {};

  const src = safeURL(location.href);
  const sp = src.searchParams;

  // 1) decide view (ONLY if not provided)
  if (!sp.get('view')){
    const v = detectView_();
    sp.set('view', v);
  }

  // 2) apply defaults if missing
  for (const [k,v] of Object.entries(defaults)){
    if (!sp.get(k) || String(sp.get(k)).trim()===''){
      sp.set(k, String(v));
    }
  }

  // 3) normalize alias: sometimes people pass runMode
  if (!sp.get('mode') && sp.get('runMode')) sp.set('mode', sp.get('runMode'));

  // 4) keep only relevant params (optional: but safer to pass all)
  // We'll pass all current params as-is to allow future extensions.

  // 5) build target URL relative to current
  const out = safeURL(targetUrl, src);
  // Copy params (do NOT wipe existing params in target, merge instead)
  const outSP = out.searchParams;
  sp.forEach((val,key)=>{
    if (!outSP.get(key)) outSP.set(key, val);
  });

  // 6) redirect
  location.replace(out.toString());
}

function safeURL(url, base){
  try { return new URL(url, base); }
  catch { return new URL(String(url), location.href); }
}

function detectView_(){
  try{
    const ua = navigator.userAgent || '';
    const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const w = Math.min(window.innerWidth||0, document.documentElement.clientWidth||0, screen.width||9999);
    const h = Math.min(window.innerHeight||0, document.documentElement.clientHeight||0, screen.height||9999);
    const small = Math.min(w,h) <= 520;
    const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);

    // heuristic:
    // - small touch device -> cVR
    // - touch/mobile -> mobile
    // - else pc
    if ((touch || isMobileUA) && small) return 'cvr';
    if (touch || isMobileUA) return 'mobile';
    return 'pc';
  }catch(_){
    return 'pc';
  }
}