// === /herohealth/vr/vr-ui.js ===
(function(root){
  'use strict';
  if(root.__HHA_VRUI_READY) return;
  root.__HHA_VRUI_READY = true;

  const doc = document;

  // crosshair center lock
  function ensureCrosshair(){
    let ch = doc.querySelector('.gj-crosshair');
    if(ch) return;
    ch = doc.createElement('div');
    ch.className = 'gj-crosshair';
    doc.body.appendChild(ch);
  }

  // ENTER / EXIT / RECENTER (minimal)
  function mount(){
    ensureCrosshair();
    // tap to shoot
    doc.addEventListener('click', ()=>{
      root.dispatchEvent(new CustomEvent('hha:shoot'));
    }, {passive:true});
  }

  mount();
})(window);