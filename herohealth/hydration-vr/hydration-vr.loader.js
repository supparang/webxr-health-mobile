// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST, Auto + NO override)
// ✅ Auto-detect view if ?view not provided (pc/mobile/cvr)
// ✅ NEVER override if ?view=... already exists (ตามที่สั่ง)
// ✅ Cardboard: ?cardboard=1 => body.cardboard + layers routing + show split
// ✅ Sets body classes: view-pc / view-mobile / view-cvr
// ✅ Exposes: window.HHA_VIEW = { view, cardboard, layers:[...] }
// ✅ Start overlay: tap/click start -> emits hha:start
// ✅ Safe full-screen hint for mobile/cvr
// ✅ Recenter button works via vr-ui.js (separate module)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function detectView(){
    // Simple + robust heuristic
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    // If not touch => pc
    if (!isTouch) return 'pc';

    // Touch devices:
    // - If landscape and wide enough => cVR (aim from center)
    // - else => mobile
    if (landscape && w >= 740) return 'cvr';
    return 'mobile';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase().trim();
    if (v === 'pc' || v === 'desktop') return 'pc';
    if (v === 'mobile' || v === 'm') return 'mobile';
    if (v === 'cvr' || v === 'vr' || v === 'cardboard') return 'cvr';
    return '';
  }

  function applyBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    b.classList.add(view === 'pc' ? 'view-pc' : view === 'cvr' ? 'view-cvr' : 'view-mobile');
  }

  function enableCardboard(cardboard){
    const b = DOC.body;
    b.classList.toggle('cardboard', !!cardboard);

    const cbWrap = DOC.getElementById('cbWrap');
    if (cbWrap){
      // NOTE: CSS ของคุณใช้ body.cardboard #cbWrap{display:block}
      // แต่เราคง hidden=false เพื่อความชัวร์
      cbWrap.hidden = !cardboard ? true : false;
    }
  }

  function setLayers(cardboard){
    // If cardboard => use L/R
    // else => single hydration-layer
    const main = DOC.getElementById('hydration-layer');
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');

    let layers = [];
    if (cardboard && L && R){
      layers = ['hydration-layerL','hydration-layerR'];
      // hide main layer interactions if needed
      if (main) main.style.display = 'none';
      if (L) L.style.display = '';
      if (R) R.style.display = '';
    } else {
      layers = ['hydration-layer'];
      if (main) main.style.display = '';
      if (L) L.style.display = '';
      if (R) R.style.display = '';
    }

    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
      view: DOC.body.classList.contains('view-cvr') ? 'cvr' :
            DOC.body.classList.contains('view-pc') ? 'pc' : 'mobile',
      cardboard: !!cardboard,
      layers
    });
  }

  function bestEffortFullscreen(){
    // only for user gesture contexts; loader just provides helper
    try{
      const el = DOC.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) req.call(el);
    }catch(_){}
  }

  function wireStartOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    const ovSub = DOC.getElementById('ovSub');

    if (!ov) {
      // no overlay => auto start
      setTimeout(()=> WIN.dispatchEvent(new CustomEvent('hha:start')), 60);
      return;
    }

    // text hints
    const view =
      DOC.body.classList.contains('view-cvr') ? 'cVR' :
      DOC.body.classList.contains('view-pc') ? 'PC' : 'Mobile';
    const isKids = String(qs('kids','0')).toLowerCase();
    const kids = (isKids==='1'||isKids==='true'||isKids==='yes');

    if (ovSub){
      ovSub.textContent = kids
        ? `โหมด ${view} — แตะ “เริ่ม!” แล้วลองยิง 💧 ให้คุมโซน GREEN นะ`
        : `โหมด ${view} — แตะ “เริ่ม!” เพื่อเริ่มเกม`;
    }

    function start(){
      // Hide overlay
      try{ ov.style.display = 'none'; ov.classList.add('hide'); }catch(_){}
      // Fullscreen hint for mobile/cvr (ไม่บังคับ)
      if (!DOC.body.classList.contains('view-pc')){
        // call only in user gesture
        bestEffortFullscreen();
      }
      // start event
      WIN.dispatchEvent(new CustomEvent('hha:start'));
    }

    // Button + overlay click
    btn?.addEventListener('click', (e)=>{ try{ e.preventDefault(); }catch(_){ } start(); }, {passive:false});
    ov.addEventListener('click', (e)=>{
      // allow clicking card buttons inside (pointer events already)
      const t = e.target;
      if (t && (t.closest && t.closest('button'))) return;
      start();
    }, {passive:true});

    // Safety auto-start if overlay already hidden by CSS (rare)
    setTimeout(()=>{
      const hidden = getComputedStyle(ov).display === 'none' || ov.classList.contains('hide');
      if (hidden) WIN.dispatchEvent(new CustomEvent('hha:start'));
    }, 700);
  }

  function init(){
    // IMPORTANT: "NO override" => ถ้ามี ?view= อยู่แล้ว ต้องใช้ตามนั้น
    const qvRaw = qs('view','');
    const qv = normalizeView(qvRaw);

    const view = qv || detectView();
    applyBodyView(view);

    const cardboard = String(qs('cardboard','0')).toLowerCase();
    const isCardboard = (cardboard==='1' || cardboard==='true' || cardboard==='yes');
    enableCardboard(isCardboard);
    setLayers(isCardboard);

    wireStartOverlay();

    // Expose small helper for debugging
    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
      detected: qv ? false : true,
      ua: navigator.userAgent || '',
      w: WIN.innerWidth||0,
      h: WIN.innerHeight||0
    });
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();