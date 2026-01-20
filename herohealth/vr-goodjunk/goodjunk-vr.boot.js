// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Picks pack by ?style=fair|boss (default=fair)
// ✅ Sets body view classes (pc/mobile/vr/cvr)
// ✅ Passes ctx to safe modules
// ✅ No launcher needed, works direct

const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function normalizeView(v){
  v = String(v||'mobile').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='view-cvr') return 'cvr';
  if(v==='auto') return 'mobile';
  if(v==='pc' || v==='mobile' || v==='vr' || v==='cvr') return v;
  return 'mobile';
}
function normalizeStyle(s){
  s = String(s||'fair').toLowerCase();
  return s.includes('boss') ? 'boss' : 'fair';
}
function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  // strict cVR: disable pointer events on targets? (we keep clickable, but shooting via vr-ui can still work)
}

async function main(){
  const view = normalizeView(qs('view','mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = Number(qs('time','80')||80) || 80;
  const seed = qs('seed', null) ?? qs('ts', null) ?? String(Date.now());
  const hub  = qs('hub', null);
  const style = normalizeStyle(qs('style','fair'));

  setBodyView(view);

  const payload = { view, run, diff, time, seed, hub, style };

  // Load pack module
  const mod = (style === 'boss')
    ? await import('./goodjunk.safe.boss.js')
    : await import('./goodjunk.safe.js');

  if(mod && typeof mod.boot === 'function'){
    mod.boot(payload);
  }else{
    console.error('[GoodJunkVR] missing boot() in module pack:', style);
  }
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', ()=>main(), { once:true });
}else{
  main();
}