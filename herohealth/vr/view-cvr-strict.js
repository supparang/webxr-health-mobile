// === /herohealth/vr/view-cvr.strict.js ===
// HHA view-cVR strict helper
// - In view-cvr: tap anywhere => emit hha:shoot
// - Prevent UI layers from blocking shot
// - Safe: does nothing in other views

'use strict';

(function(root){
  const DOC = root.document;
  if (!DOC) return;

  function isCVR(){ try{ return DOC.body.classList.contains('view-cvr'); }catch(_){ return false; } }

  // strict shooter: tap/click emits hha:shoot
  function onTap(ev){
    if (!isCVR()) return;
    // ignore clicks on explicit buttons/inputs
    const t = ev.target;
    if (t && (t.closest?.('button, a, input, textarea, select, [role="button"]'))) return;

    try{ root.dispatchEvent(new CustomEvent('hha:shoot')); }catch(_){}
  }

  // capture phase ensures we get it even if layer eats events
  DOC.addEventListener('pointerdown', onTap, { capture:true, passive:true });
  DOC.addEventListener('click', onTap, { capture:true, passive:true });

  // also: disable accidental drag scroll in cVR
  DOC.addEventListener('touchmove', (ev)=>{
    if (!isCVR()) return;
    try{ ev.preventDefault(); }catch(_){}
  }, { passive:false });

})(window);