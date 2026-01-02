// === /herohealth/vr/recenter-calibration.js ===
// Minimal recenter controller for HHA (works with any game)
// Usage:
//   const RC = createRecenterController({ onRecenter: ()=>{ ...reset... } })
//   RC.enable() / RC.disable()

'use strict';

export function createRecenterController(opts = {}){
  const onRecenter = (typeof opts.onRecenter === 'function') ? opts.onRecenter : ()=>{};
  let enabled = false;

  function handler(){
    if (!enabled) return;
    try{ onRecenter(); }catch(_){}
  }

  function enable(){
    if (enabled) return;
    enabled = true;
    window.addEventListener('hha:recenter', handler, { passive:true });
  }

  function disable(){
    enabled = false;
    window.removeEventListener('hha:recenter', handler);
  }

  return { enable, disable };
}