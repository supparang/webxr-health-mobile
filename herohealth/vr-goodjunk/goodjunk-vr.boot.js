// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Detect view + set body class (view-pc/view-mobile/view-cvr/view-vr)
// ✅ Calls goodjunk.safe.js boot()
// ✅ Hooks: hha:coach / hha:judge -> Particles feedback (if available)
// ✅ Hooks: logging passthrough (if HHA_CloudLogger loaded)
// ✅ Robust start (DOM ready + small defer)

'use strict';

import { boot as bootSafe } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

function isMobileUA(){
  try{
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  }catch(_){ return false; }
}

function setViewClass(view){
  const v = String(view||'mobile').toLowerCase();
  DOC.body.classList.remove('view-pc','view-mobile','view-cvr','view-vr');
  if(v === 'pc') DOC.body.classList.add('view-pc');
  else if(v === 'cvr') DOC.body.classList.add('view-cvr');
  else if(v === 'vr') DOC.body.classList.add('view-vr');
  else DOC.body.classList.add('view-mobile');
}

function chooseAutoView(){
  // do NOT override if user already set ?view=
  const v = qs('view', '');
  if(v) return v;
  // best-effort: mobile => mobile, desktop => pc
  return isMobileUA() ? 'mobile' : 'pc';
}

function attachFx(){
  // Coach tips -> top particles
  WIN.addEventListener('hha:coach', (ev)=>{
    try{
      const msg = ev?.detail?.msg || ev?.detail?.message || '';
      if(!msg) return;
      if(WIN.Particles && typeof WIN.Particles.popText === 'function'){
        const r = DOC.documentElement.getBoundingClientRect();
        WIN.Particles.popText(r.width/2, 130, String(msg).slice(0, 120), 'hha-coach');
      }
    }catch(_){}
  }, { passive:true });

  // Judge labels -> small burst near center
  WIN.addEventListener('hha:judge', (ev)=>{
    try{
      const label = ev?.detail?.label || '';
      if(!label) return;
      if(WIN.Particles && typeof WIN.Particles.popText === 'function'){
        const r = DOC.documentElement.getBoundingClientRect();
        WIN.Particles.popText(r.width/2, r.height*0.58, String(label).slice(0, 32), 'hha-judge');
      }
    }catch(_){}
  }, { passive:true });
}

function attachLogger(){
  // optional — if you loaded ../vr/hha-cloud-logger.js
  // We don't assume endpoint here; logger file may configure itself via ?log=
  const L = WIN.HHA_CloudLogger || WIN.HHA_Logger || null;
  if(!L) return;

  const safeCall = (fn, payload)=>{
    try{
      if(typeof L[fn] === 'function') L[fn](payload);
    }catch(_){}
  };

  WIN.addEventListener('hha:start', (ev)=>safeCall('onStart', ev.detail), { passive:true });
  WIN.addEventListener('hha:end',   (ev)=>safeCall('onEnd',   ev.detail), { passive:true });
  WIN.addEventListener('hha:score', (ev)=>safeCall('onScore', ev.detail), { passive:true });
  WIN.addEventListener('hha:time',  (ev)=>safeCall('onTime',  ev.detail), { passive:true });
}

function start(){
  // View setup
  const view = chooseAutoView();
  setViewClass(view);

  // Optional: tune VR UI crosshair lock
  WIN.HHA_VRUI_CONFIG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});

  attachFx();
  attachLogger();

  // Boot SAFE game
  bootSafe({
    view,
    run:  qs('run','play'),
    diff: qs('diff','normal'),
    time: qs('time','80'),
    seed: qs('seed', String(Date.now()))
  });
}

// Ensure DOM ready, then small defer so CSS/layout measures are stable
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', ()=>setTimeout(start, 30), { once:true });
}else{
  setTimeout(start, 30);
}