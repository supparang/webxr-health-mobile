// === /herohealth/js/hha-path.inline.js ===
// HeroHealth inline path helper (non-module) — GitHub Pages safe
// v20260226-pathfix-inline
(function(){
  'use strict';

  var p = (location && location.pathname) ? location.pathname : '';
  var base = p.indexOf('/webxr-health-mobile/') === 0 ? '/webxr-health-mobile' : '';

  function withBase(path){
    if(!path) return base || '';
    path = String(path);
    if(/^https?:\/\//i.test(path)) return path;
    if(base && path.indexOf(base + '/') === 0) return path;
    if(path.charAt(0) === '/') return base + path;
    return base + '/' + path.replace(/^\.?\//,'');
  }

  function hub(){
    return withBase('/herohealth/hub.html');
  }

  function resolveHub(h){
    if(!h) return hub();

    try{
      var dec = decodeURIComponent(h);
      if(dec && dec !== h) h = dec;
    }catch(e){}

    h = String(h);

    if(/^https?:\/\//i.test(h)) return h;
    if(h.charAt(0) === '/') return withBase(h);

    var cleaned = h.replace(/^(\.\/)+/,'').replace(/^(\.\.\/)+/,'').trim();

    if(cleaned === 'hub.html') return hub();
    if(cleaned.indexOf('herohealth/') === 0) return withBase('/' + cleaned);

    return withBase('/' + cleaned);
  }

  // expose globals
  window.HHA_BASE = base;
  window.HHA_WITH_BASE = withBase;
  window.HHA_HUB = hub;
  window.HHA_RESOLVE_HUB = resolveHub;
})();
