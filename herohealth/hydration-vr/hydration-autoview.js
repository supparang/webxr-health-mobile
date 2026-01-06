// === /herohealth/hydration-vr/hydration.auto-view.js ===
// Hydration Auto View Detector — PRODUCTION (NO OVERRIDE)
// ✅ Auto sets body classes: view-pc / view-mobile / cardboard / view-cvr
// ✅ Ignores ?view= (NO override)
// ✅ Remembers last auto-detected view (stability) but still adapts if device changes
// ✅ Provides window.HHA_VIEWMODE = { view, reason, isTouch, isSmall, isAndroid, isIOS }
// ✅ Works with hydration-vr.loader.js mapping layers

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_AUTOVIEW__) return;
  WIN.__HHA_HYDRATION_AUTOVIEW__ = true;

  const LS_KEY = 'HHA_HYDRATION_LAST_VIEW';
  const now = Date.now();

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function safeLower(s){ return String(s||'').toLowerCase(); }

  function uaInfo(){
    const ua = safeLower(navigator.userAgent || '');
    const isAndroid = /android/.test(ua);
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isMobileUA = /mobi|android|iphone|ipad|ipod/.test(ua);
    return { ua, isAndroid, isIOS, isMobileUA };
  }

  function screenInfo(){
    const w = Math.max(1, WIN.innerWidth || DOC.documentElement.clientWidth || 1);
    const h = Math.max(1, WIN.innerHeight|| DOC.documentElement.clientHeight|| 1);
    const min = Math.min(w,h);
    const max = Math.max(w,h);
    const isSmall = min <= 520;     // phones
    const isTabletish = (min > 520 && min <= 900);
    const isLandscape = w >= h;
    return { w,h,min,max,isSmall,isTabletish,isLandscape };
  }

  function touchInfo(){
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    return { isTouch };
  }

  function isProbablyCardboard(){
    // Heuristic:
    // - Android + touch + small screen + landscape -> likely in cardboard browser
    // - OR very narrow height (status bars hidden) + fullscreen suggests headset use
    const { isAndroid } = uaInfo();
    const { isSmall, isLandscape, h } = screenInfo();
    const { isTouch } = touchInfo();
    const isFS = !!DOC.fullscreenElement;

    if (isAndroid && isTouch && isSmall && isLandscape) return { yes:true, reason:'android+touch+small+landscape' };
    if (isAndroid && isTouch && isFS && h <= 520 && isLandscape) return { yes:true, reason:'fullscreen+landscape+shortH' };
    return { yes:false, reason:'no' };
  }

  function isProbablyCVR(){
    // cVR = strict crosshair shooting.
    // Heuristic: if cardboard-like AND touch -> prefer cVR (strict) to avoid touching targets in split.
    // But we keep "cardboard split" separate class; cVR is for single view strict crosshair.
    // Here we decide cVR when:
    // - touch + landscape + small + (user likely wants strict) AND NOT in split
    const { isAndroid } = uaInfo();
    const { isSmall, isLandscape } = screenInfo();
    const { isTouch } = touchInfo();
    if (isAndroid && isTouch && isSmall && isLandscape) return { yes:true, reason:'android small landscape => prefer cVR strict' };
    return { yes:false, reason:'no' };
  }

  function hardSetBody(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'cardboard') b.classList.add('cardboard');
    else if (view === 'cvr') b.classList.add('view-cvr');
    else if (view === 'mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');
  }

  function stableKeyForDevice(){
    const { isAndroid, isIOS, isMobileUA } = uaInfo();
    const { w,h } = screenInfo();
    const { isTouch } = touchInfo();
    return [isAndroid?'a':'x', isIOS?'i':'x', isMobileUA?'m':'x', isTouch?'t':'x', clamp(w,0,9999), clamp(h,0,9999)].join('|');
  }

  function loadLast(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.view) return null;
      // expire after 7 days
      if (obj.at && (now - obj.at) > 7*24*3600*1000) return null;
      return obj;
    }catch(_){ return null; }
  }

  function saveLast(view, reason){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify({
        view, reason, at: now,
        dev: stableKeyForDevice()
      }));
    }catch(_){}
  }

  function decide(){
    const U = uaInfo();
    const S = screenInfo();
    const T = touchInfo();

    // Base decision
    let view = 'pc';
    let reason = 'default';

    // If touch + mobile UA -> mobile
    if (T.isTouch && U.isMobileUA){
      view = 'mobile';
      reason = 'touch+mobileUA';
    }

    // If phone in landscape on Android => prefer cVR strict (better for cardboard-like usage)
    const cvr = isProbablyCVR();
    if (cvr.yes){
      view = 'cvr';
      reason = 'cvr:' + cvr.reason;
    }

    // If strongly looks like split-cardboard, use cardboard split
    // (split is visually obvious; use it when we are confident)
    const cb = isProbablyCardboard();
    if (cb.yes){
      view = 'cardboard';
      reason = 'cardboard:' + cb.reason;
    }

    // Tablet: keep mobile unless non-touch
    if (!T.isTouch && !U.isMobileUA){
      view = 'pc';
      reason = 'nonTouchDesktop';
    }

    // Stability: if same device key and last exists, keep last view
    const last = loadLast();
    if (last && last.dev === stableKeyForDevice()){
      // keep last view unless current strongly says split-cardboard
      if (view !== 'cardboard'){
        view = last.view;
        reason = 'stickLast:' + (last.reason || 'last');
      }
    }

    return { view, reason, ...U, ...S, ...T };
  }

  function apply(){
    const d = decide();
    hardSetBody(d.view);
    WIN.HHA_VIEWMODE = {
      view: d.view,
      reason: d.reason,
      isTouch: d.isTouch,
      isSmall: d.isSmall,
      isAndroid: d.isAndroid,
      isIOS: d.isIOS
    };
    saveLast(d.view, d.reason);
  }

  // Apply ASAP
  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', apply, { once:true });
  } else {
    apply();
  }

  // Re-evaluate on rotate/resize (but throttle)
  let t=null;
  function onChange(){
    if (t) clearTimeout(t);
    t = setTimeout(()=>apply(), 120);
  }
  WIN.addEventListener('resize', onChange, { passive:true });
  WIN.addEventListener('orientationchange', onChange, { passive:true });
})();