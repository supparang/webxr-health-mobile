// === /herohealth/js/hha-path.js ===
// HeroHealth Path Resolver — GitHub Pages safe (project-site aware)
// v20260226-pathfix
'use strict';

// Detect base prefix for GitHub Pages project site
export function hhaBase(){
  const p = location.pathname || '';
  // If hosted under repo "webxr-health-mobile"
  if (p.startsWith('/webxr-health-mobile/')) return '/webxr-health-mobile';
  return ''; // local/custom domain root
}

// Join base + path, and normalize
export function withBase(path){
  const base = hhaBase();
  if(!path) return base || '';
  // absolute URL stays
  if(/^https?:\/\//i.test(path)) return path;
  // already contains base
  if(base && path.startsWith(base + '/')) return path;
  // absolute path at domain root
  if(path.startsWith('/')) return base + path;
  // relative path => treat as root-relative under /herohealth/ by default caller
  return base + '/' + path.replace(/^\.?\//,'');
}

// Canonical hub URL
export function hhaHub(){
  return withBase('/herohealth/hub.html');
}

// Canonical warmup gate URL
export function hhaWarmupGate(){
  return withBase('/herohealth/warmup-gate.html');
}

// Resolve hub param safely (accepts: full url, /herohealth/hub.html, hub.html, etc.)
export function resolveHub(h){
  if(!h) return hhaHub();
  // decode once if encoded
  try{
    const dec = decodeURIComponent(h);
    if(dec && dec !== h) h = dec;
  }catch(e){}

  if(/^https?:\/\//i.test(h)) return h;
  if(h.startsWith('/')) return withBase(h);

  // common cases: "hub.html", "./hub.html", "../hub.html"
  const cleaned = h.replace(/^(\.\/)+/,'').replace(/^(\.\.\/)+/,'');
  // if they passed "herohealth/hub.html" (no leading slash) make it absolute
  if(cleaned.startsWith('herohealth/')) return withBase('/' + cleaned);
  // if they passed just "hub.html" treat as /herohealth/hub.html
  if(cleaned === 'hub.html') return hhaHub();

  // fallback: base + "/" + cleaned
  return withBase('/' + cleaned);
