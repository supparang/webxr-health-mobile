// === /herohealth/js/hha-path.js ===
// HeroHealth Path Resolver — GitHub Pages safe (project-site aware)
// v20260226-pathfix
'use strict';

// Detect base prefix for GitHub Pages project site
export function hhaBase(){
  const p = location.pathname || '';
  // GitHub Pages project site for repo: webxr-health-mobile
  if (p.startsWith('/webxr-health-mobile/')) return '/webxr-health-mobile';
  return ''; // local/custom domain root
}

// Join base + path, normalize
export function withBase(path){
  const base = hhaBase();
  if(!path) return base || '';
  // absolute URL stays
  if(/^https?:\/\//i.test(path)) return path;
  // already contains base
  if(base && path.startsWith(base + '/')) return path;
  // absolute path at domain root
  if(path.startsWith('/')) return base + path;
  // relative -> base + / + relative
  return base + '/' + String(path).replace(/^\.?\//,'');
}

// Canonical hub URL
export function hhaHub(){
  return withBase('/herohealth/hub.html');
}

// Resolve hub param safely (accepts: full url, /herohealth/hub.html, hub.html, ./hub.html, ../hub.html, herohealth/hub.html)
export function resolveHub(h){
  if(!h) return hhaHub();

  // decode once if encoded
  try{
    const dec = decodeURIComponent(h);
    if(dec && dec !== h) h = dec;
  }catch(e){}

  h = String(h);

  // absolute URL stays
  if(/^https?:\/\//i.test(h)) return h;

  // absolute path -> attach base
  if(h.startsWith('/')) return withBase(h);

  // common relative patterns
  const cleaned = h
    .replace(/^(\.\/)+/,'')
    .replace(/^(\.\.\/)+/,'')
    .trim();

  if(cleaned === 'hub.html') return hhaHub();
  if(cleaned.startsWith('herohealth/')) return withBase('/' + cleaned);

  // fallback: treat as root-relative under base
  return withBase('/' + cleaned);
}
