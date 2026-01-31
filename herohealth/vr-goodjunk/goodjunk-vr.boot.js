// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION
// ✅ Parses query params and starts goodjunk.safe.js boot()
// ✅ view auto -> best effort (pc/mobile/cvr/vr)
// ✅ Never crashes: global error trap

import { boot } from './goodjunk.safe.js';

const WIN = window;

const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

function detectView(){
  const forced = (qs('view','')||'').toLowerCase();
  if(forced && forced !== 'auto') return forced;

  // best effort: if WebXR immersive supported -> 'vr' else mobile/pc
  const ua = (navigator.userAgent||'').toLowerCase();
  const isMobile = /android|iphone|ipad|ipod/.test(ua);
  const isCardboard = (qs('view','')||'').toLowerCase() === 'cvr';

  if(isCardboard) return 'cvr';

  // If user is inside headset browser often has "oculus" etc.
  const isXRUA = /oculus|quest|vive|pico|webkitxr/.test(ua);
  if(isXRUA) return 'vr';

  return isMobile ? 'mobile' : 'pc';
}

function start(){
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = Number(qs('time','80')) || 80;

  const seed = qs('seed', null) || String(Date.now());
  const view = detectView();

  // body class for CSS hooks (cvr strict)
  try{
    document.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    if(view === 'pc') document.body.classList.add('view-pc');
    else if(view === 'vr') document.body.classList.add('view-vr');
    else if(view === 'cvr') document.body.classList.add('view-cvr');
    else document.body.classList.add('view-mobile');
  }catch(_){}

  boot({ view, run, diff, time, seed });
}

(function(){
  // basic global trap
  WIN.addEventListener('error', (e)=>{
    try{ console.error('[GoodJunkVR] error', e?.error || e?.message || e); }catch(_){}
  });
  WIN.addEventListener('unhandledrejection', (e)=>{
    try{ console.error('[GoodJunkVR] unhandled', e?.reason || e); }catch(_){}
  });

  // wait minimal DOM ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, { once:true });
  }else{
    start();
  }
})();