// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
import { boot as goodjunkBoot } from './goodjunk.safe.js';

function qs(name, def){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}

function bindStartOverlay(startFn){
  const ov = document.getElementById('startOverlay');
  const btn = document.getElementById('btnStart');
  const meta = document.getElementById('startMeta');

  const diff = String(qs('diff','normal'));
  const run  = String(qs('run','play'));
  const time = String(qs('time','80'));
  const view = String(qs('view','auto'));
  const end  = String(qs('end','time'));
  const challenge = String(qs('challenge','rush'));

  if (meta){
    meta.textContent = `diff=${diff} • run=${run} • time=${time}s • end=${end} • challenge=${challenge} • view=${view}`;
  }

  if (!btn){
    startFn();
    if (ov) ov.style.display = 'none';
    return;
  }

  btn.addEventListener('click', ()=>{
    if (ov) ov.style.display = 'none';
    startFn();
  });
}

window.addEventListener('DOMContentLoaded', ()=>{
  const layerEl = document.getElementById('gj-layer');
  const shootEl = document.getElementById('btnShoot');

  const sceneEl = document.getElementById('xrScene');
  const xrTargetsEl = document.getElementById('xrTargets');
  const xrCam = document.getElementById('xrCam');

  // Track XR session state -> add .xr-active on <html>
  if (sceneEl){
    sceneEl.addEventListener('enter-vr', ()=>{
      document.documentElement.classList.add('xr-active');
      try{ const hint = document.getElementById('xrHint'); if (hint) hint.setAttribute('visible', true); }catch(_){}
    });
    sceneEl.addEventListener('exit-vr', ()=>{
      document.documentElement.classList.remove('xr-active');
      try{ const hint = document.getElementById('xrHint'); if (hint) hint.setAttribute('visible', false); }catch(_){}
    });
  }

  const diff = String(qs('diff','normal'));
  const run  = String(qs('run','play'));
  const time = Number(qs('time','80')) || 80;

  const start = ()=>{
    goodjunkBoot({
      layerEl,
      shootEl,
      diff,
      run,
      time,
      // XR hooks
      sceneEl,
      xrTargetsEl,
      xrCam
    });
  };

  bindStartOverlay(start);
});