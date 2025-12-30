// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard (DUAL-ID COMPAT + VR OK STARTS)
// ✅ supports ids: gj-layer-l OR gj-layer (legacy)
// ✅ VR Hint OK triggers start
// ✅ shows boot errors on-screen (hudMeta)

'use strict';

function qp(name, fallback=null){
  try{
    const u = new URL(location.href);
    const v = u.searchParams.get(name);
    return (v==null || v==='') ? fallback : v;
  }catch(_){ return fallback; }
}
function toInt(v,d){ v=Number(v); return Number.isFinite(v)? (v|0) : d; }
function toStr(v,d){ v=String(v??'').trim(); return v? v : d; }

function el(id){ return document.getElementById(id); }
function firstId(...ids){
  for (const id of ids){
    const e = document.getElementById(id);
    if (e) return e;
  }
  return null;
}
function setHudMeta(t){
  const m = el('hudMeta');
  if (m) m.textContent = t;
  // optional: also print to startMeta if exists
  const sm = el('startMeta');
  if (sm) sm.textContent = t;
}
function showStart(){
  const o = el('startOverlay');
  if (o){ o.style.display='flex'; o.style.pointerEvents='auto'; }
}
function hideStart(){
  const o = el('startOverlay');
  if (o){ o.style.display='none'; o.style.pointerEvents='none'; }
}
function showVrHint(){
  const h = el('vrHint');
  if (h){ h.hidden = false; }
}
function hideVrHint(){
  const h = el('vrHint');
  if (h){ h.hidden = true; }
}

function isMobileLike(){
  const w = innerWidth || 360;
  const h = innerHeight || 640;
  const coarse = (matchMedia && matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
}

function setView(mode){
  document.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  document.body.classList.add(`view-${mode}`);

  // show/hide right eye (VR/cVR uses both eyes)
  const eyeR = el('eyeR');
  if (eyeR){
    const on = (mode==='vr' || mode==='cvr');
    eyeR.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
}

function hardFail(msg, err){
  console.error('[BOOT FAIL]', msg, err||'');
  setHudMeta(`❌ ${msg}${err ? ' | ' + (err.message || String(err)) : ''}`);
  showStart();
}

async function main(){
  // show runtime errors on-screen
  window.addEventListener('error', (e)=> hardFail('runtime error', e?.error || e?.message || e));
  window.addEventListener('unhandledrejection', (e)=> hardFail('unhandled promise', e?.reason || e));

  const v = qp('v', '') || String(Date.now());
  const diff = toStr(qp('diff','normal'),'normal').toLowerCase();
  const time = toInt(qp('time','80'), 80);
  const run  = toStr(qp('run', qp('runMode','play')),'play').toLowerCase();
  const endPolicy  = toStr(qp('end','time'),'time').toLowerCase();
  const challenge  = toStr(qp('challenge','rush'),'rush').toLowerCase();
  const viewParam  = toStr(qp('view',''), '').toLowerCase();

  // pick initial view
  if (['pc','mobile','vr','cvr'].includes(viewParam)) setView(viewParam);
  else setView(isMobileLike() ? 'mobile' : 'pc');

  // IMPORTANT: support both id styles
  const stageEl = el('gj-stage');
  const layerL  = firstId('gj-layer-l','gj-layer') || document.querySelector('.gj-layer');
  const layerR  = firstId('gj-layer-r');
  const crossL  = firstId('gj-crosshair-l','gj-crosshair') || document.querySelector('.gj-crosshair');
  const crossR  = firstId('gj-crosshair-r');
  const ringL   = firstId('atk-ring-l','atk-ring');
  const ringR   = firstId('atk-ring-r');
  const laserL  = firstId('atk-laser-l','atk-laser');
  const laserR  = firstId('atk-laser-r');
  const shootEl = el('btnShoot');

  if (!stageEl) return hardFail('missing #gj-stage');
  if (!layerL)  return hardFail('missing target layer (#gj-layer-l or #gj-layer)');

  setHudMeta(`[BOOT] import safe… v=${v}`);

  let safeMod;
  try{
    safeMod = await import(`./goodjunk.safe.js?v=${encodeURIComponent(v)}`);
  }catch(err){
    return hardFail('cannot import ./goodjunk.safe.js (path/cache/syntax)', err);
  }
  if (!safeMod || typeof safeMod.boot !== 'function'){
    return hardFail('goodjunk.safe.js has no exported boot()');
  }

  let started = false;

  const begin = (why)=>{
    if (started) return;
    started = true;

    hideVrHint();
    hideStart();
    setHudMeta(`[BOOT] starting (${why||'start'})`);

    try{
      safeMod.boot({
        diff, time, run,
        endPolicy, challenge,
        layerEl: layerL,
        layerElR: layerR,
        crosshairEl: crossL,
        crosshairElR: crossR,
        ringEl: ringL,
        ringElR: ringR,
        laserEl: laserL,
        laserElR: laserR,
        shootEl,
        safeMargins: { top: 128, bottom: 170, left: 18, right: 18 }
      });
      setHudMeta(`[BOOT] running • dual=${!!layerR} • v=${v}`);
    }catch(err){
      hardFail('safe.boot() crashed', err);
    }
  };

  // view buttons
  const btnPC  = el('btnViewPC');
  const btnMob = el('btnViewMobile');
  const btnVR  = el('btnViewVR');
  const btnCVR = el('btnViewCVR');
  const btnFS  = el('btnEnterFS');
  const btnEnterVR = el('btnEnterVR');

  if (btnPC)  btnPC.onclick  = ()=> setView('pc');
  if (btnMob) btnMob.onclick = ()=> setView('mobile');

  if (btnVR) btnVR.onclick = ()=>{
    setView('vr');
    showVrHint();
  };
  if (btnCVR) btnCVR.onclick = ()=>{
    setView('cvr');
    showVrHint();
  };

  if (btnFS) btnFS.onclick = async()=>{
    try{ if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); }catch(_){}
  };

  if (btnEnterVR) btnEnterVR.onclick = async()=>{
    // WebXR enter isn't guaranteed on all phones; we still show VR hint + fullscreen
    setView(isMobileLike() ? 'cvr' : 'vr');
    showVrHint();
    try{ if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); }catch(_){}
  };

  // Start overlay
  const btnStart = el('btnStart');
  if (btnStart){
    showStart();
    btnStart.onclick = ()=> begin('btnStart');
  } else {
    // if no start overlay, allow tapping stage to start
    begin('auto_no_startOverlay');
  }

  // VR hint OK must start
  const btnVrOk = el('btnVrOk');
  if (btnVrOk){
    btnVrOk.onclick = ()=>{
      try{ localStorage.setItem('GJ_VR_HINT_OK','1'); }catch(_){}
      begin('vrOk');
    };
  }

  // Also: tap anywhere on stage to start (failsafe)
  stageEl.addEventListener('pointerdown', ()=> begin('stageTap'), { passive:true });
  if (shootEl) shootEl.addEventListener('pointerdown', ()=> begin('shootTap'), { passive:true });

  // If already in view=vr/cvr, show hint first
  if (document.body.classList.contains('view-vr') || document.body.classList.contains('view-cvr')){
    showVrHint();
  }

  setHudMeta(`[BOOT] ready • diff=${diff} • run=${run} • time=${time}s • v=${v}`);
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}