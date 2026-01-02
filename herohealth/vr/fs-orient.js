// === /herohealth/vr/fs-orient.js ===
// Fullscreen + Orientation helper (best-effort)
// - requestFullscreen from user gesture
// - try lock landscape on supported mobile
// - toggles body.is-fs

'use strict';

export async function enterFullscreen({ lockLandscape=true } = {}){
  try{
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen){
      await el.requestFullscreen({ navigationUI: 'hide' });
    }
  }catch(_){}

  try{
    if (lockLandscape && screen.orientation && screen.orientation.lock){
      await screen.orientation.lock('landscape');
    }
  }catch(_){}
}

export async function exitFullscreen(){
  try{
    if (document.fullscreenElement && document.exitFullscreen){
      await document.exitFullscreen();
    }
  }catch(_){}
}

export function bindFullscreenClass(){
  const b = document.body;
  if (!b) return;
  function sync(){
    try{ b.classList.toggle('is-fs', !!document.fullscreenElement); }catch(_){}
  }
  document.addEventListener('fullscreenchange', sync);
  sync();
}