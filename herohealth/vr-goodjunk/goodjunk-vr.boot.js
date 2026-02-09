// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION (HHA Standard)
// ✅ Auto view detect (pc/mobile/vr/cvr) — no override unless ?view= provided
// ✅ Uses ../vr/vr-ui.js (ENTER VR/EXIT/RECENTER + crosshair + hha:shoot)
// ✅ Pass-through: hub/run/diff/time/seed/studyId/phase/conditionGroup/log/gate
// ✅ Gate flow: if ?gate=1 -> on hha:end => cooldown(20s) => hub
// ✅ Wires layers: #gj-layer (main) + #gj-layer-r (cVR right eye)
// ✅ Robust fatal overlay (#gj-fatal) if boot fails

'use strict';

import { boot as bootGame } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(){
  try{ return new URL(location.href).searchParams; }
  catch{ return new URLSearchParams(); }
}
const Q = qs();
const q  = (k, d='') => (Q.get(k) ?? d);
const qn = (k, d=0) => {
  const v = Number(q(k, d));
  return Number.isFinite(v) ? v : d;
};

function safeDecode(s){
  try{ return decodeURIComponent(String(s||'')); }catch{ return String(s||''); }
}

function pickView(){
  // explicit override wins
  const v = String(q('view','')||'').toLowerCase().trim();
  if(v) return v; // pc|mobile|vr|cvr

  // auto detect
  const w = Math.max(1, WIN.innerWidth||0);
  const h = Math.max(1, WIN.innerHeight||0);
  const isSmall = Math.min(w,h) <= 520;

  // If WebXR is present, let "vr" be default suggestion (user still clicks ENTER VR)
  const hasXR = !!(navigator && navigator.xr);

  if(hasXR && isSmall) return 'mobile';
  if(hasXR && !isSmall) return 'pc';
  return isSmall ? 'mobile' : 'pc';
}

function applyBodyView(view){
  DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'cvr') DOC.body.classList.add('view-cvr');
  else if(view === 'vr') DOC.body.classList.add('view-vr');
  else if(view === 'pc') DOC.body.classList.add('view-pc');
  else DOC.body.classList.add('view-mobile');
}

function setText(id, txt){
  const el = DOC.getElementById(id);
  if(el) el.textContent = String(txt ?? '');
}

function showFatal(err){
  const pre = DOC.getElementById('gj-fatal');
  if(!pre) return;
  pre.classList.remove('gj-hidden');
  pre.textContent =
    '[GoodJunkVR FATAL]\n' +
    (err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err);
}

function startCooldownAndGoHub(summary){
  const gate = String(q('gate','0')||'0');
  if(gate !== '1') return;

  const hubRaw = q('hub','');
  const hub = safeDecode(hubRaw);
  if(!hub) return;

  const cd = DOC.getElementById('gj-cooldown');
  const num = DOC.getElementById('gj-cooldown-num');

  let left = 20;
  if(cd){
    cd.setAttribute('aria-hidden','false');
    if(num) num.textContent = String(left);
  }

  const t = setInterval(()=>{
    left--;
    if(num) num.textContent = String(Math.max(0,left));
    if(left <= 0){
      clearInterval(t);
      // pass last summary as optional param
      try{
        const u = new URL(hub, location.href);
        if(summary){
          u.searchParams.set('last', encodeURIComponent(JSON.stringify(summary)));
        }
        location.href = u.toString();
      }catch(_){
        location.href = hub;
      }
    }
  }, 1000);
}

function bindEndListener(){
  WIN.addEventListener('hha:end', (ev)=>{
    const summary = ev && ev.detail ? ev.detail : null;

    // write last summary (redundant-safe; engine already writes too)
    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary||{})); }catch(_){}

    // gate->hub after 20s
    startCooldownAndGoHub(summary);
  }, { passive:true });
}

function attachVrUI(){
  // If vr-ui.js is included in HTML, this just configures its lockPx.
  // GoodJunk: slightly forgiving on mobile/cvr.
  WIN.HHA_VRUI_CONFIG = Object.assign({}, WIN.HHA_VRUI_CONFIG || {}, {
    lockPx: qn('lock', 28),
    cooldownMs: qn('cd', 90)
  });
}

function main(){
  const view = pickView();
  applyBodyView(view);

  // Expose view for CSS/HUD labels
  setText('gj-view', view.toUpperCase());

  // wire vr-ui config
  attachVrUI();

  // layers must exist
  const layerL = DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  // if not cVR, hide right layer safely
  if(view !== 'cvr' && layerR){
    try{ layerR.style.display = 'none'; }catch(_){}
  }else if(view === 'cvr' && layerR){
    try{ layerR.style.display = ''; }catch(_){}
  }

  // bind end->gate flow
  bindEndListener();

  // pass-through config
  const cfg = {
    view,
    run:  String(q('run','play')||'play').toLowerCase(),
    diff: String(q('diff','normal')||'normal').toLowerCase(),
    time: qn('time', 80),
    seed: q('seed', String(Date.now()))
  };

  // Start engine
  bootGame(cfg);
}

// Boot when DOM ready
try{
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', ()=>{ try{ main(); }catch(e){ showFatal(e); } }, { once:true });
  }else{
    main();
  }
}catch(e){
  showFatal(e);
}
