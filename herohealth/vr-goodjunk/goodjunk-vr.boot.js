// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — AUTO VIEW (pc/mobile), respects ?view if provided (pc/mobile/cvr/vr)

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function isMobileUA(){
  const ua = String(navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod/.test(ua);
}
function setBodyView(view){
  const b = DOC.body;
  b.classList.add('gj');
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
  DOC.body.dataset.view = view;

  const r = DOC.getElementById('gj-layer-r');
  if(r) r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');
}
function baseAutoView(){ return isMobileUA() ? 'mobile' : 'pc'; }

function hudSafeMeasure(){
  const root = DOC.documentElement;
  const px = (n)=> Math.max(0, Math.round(Number(n)||0)) + 'px';
  const h  = (el)=> { try{ return el ? el.getBoundingClientRect().height : 0; }catch{return 0;} };

  function update(){
    try{
      const cs = getComputedStyle(root);
      const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
      const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;

      const topbar  = DOC.querySelector('.gj-topbar');
      const hudTop  = DOC.getElementById('hud') || DOC.querySelector('.gj-hud-top');
      const hudBot  = DOC.querySelector('.gj-hud-bot');

      let topSafe = Math.max(h(topbar), h(hudTop) * 0.55) + 14 + sat;
      let botSafe = Math.max(h(hudBot), 80) + 16 + sab;

      if(DOC.body.classList.contains('hud-hidden')){
        topSafe = Math.max(h(topbar) + 10 + sat, 72 + sat);
        botSafe = Math.max(76 + sab, 70 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(botSafe));
    }catch(_){}
  }

  WIN.addEventListener('resize', update, { passive:true });
  WIN.addEventListener('orientationchange', update, { passive:true });
  WIN.addEventListener('click', (e)=>{
    if(e?.target?.id === 'btnHideHud' || e?.target?.id === 'btnHideHud2'){
      setTimeout(update, 30);
      setTimeout(update, 180);
      setTimeout(update, 420);
    }
  }, { passive:true });

  setTimeout(update, 0);
  setTimeout(update, 120);
  setTimeout(update, 350);
  setInterval(update, 1200);
}

function start(){
  // prefer ?view if valid, else auto
  const qv = String(qs('view','')||'').toLowerCase();
  const view =
    (qv==='pc'||qv==='mobile'||qv==='vr'||qv==='cvr') ? qv :
    baseAutoView();

  setBodyView(view);
  hudSafeMeasure();

  engineBoot({
    view,
    diff: qs('diff','normal'),
    run: qs('run','play'),
    time: qs('time','80'),
    seed: qs('seed', null),
  });
}

if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start);
else start();