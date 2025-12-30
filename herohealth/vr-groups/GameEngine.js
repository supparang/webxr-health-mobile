// ---- HHA Shared TapFire (Cardboard/cVR) ----
function installTapFire(){
  try{
    const TF = root.HHAVRTapFire;
    if(!TF || typeof TF.install !== 'function') return;

    TF.install({
      layerEl: engine.layerEl,
      selector: '.fg-target',
      lockPx: 120,
      isActive: ()=> engine.running && !engine.ended,
      hit: (el)=> hitTarget(el),
      // กันทับ HUD บน/ล่างให้ยิงไม่เพี้ยน (ปรับได้)
      margins: { top: 170, bottom: 220, side: 18 }
    });
  }catch(_){}
}