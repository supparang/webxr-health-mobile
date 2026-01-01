// === /herohealth/vr/vr-auto-cardboard.js ===
// Auto prepare Cardboard on rotate + 1-tap enter VR (WebXR requires user gesture)

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc) return;

  if(root.__HHA_AUTOCVR_BOUND__) return;
  root.__HHA_AUTOCVR_BOUND__ = true;

  const cfg = root.HHA_AUTOVR || { enabled:true };
  const isLandscape = () =>
    root.matchMedia?.("(orientation: landscape)")?.matches || (root.innerWidth > root.innerHeight);

  function setCVR(on){
    const b = doc.body;
    b.classList.toggle('view-cvr', !!on);
    b.classList.toggle('view-mobile', !on);
  }

  function ensureOverlay(){
    let el = doc.querySelector('#hha-auto-vr');
    if(el) return el;

    el = doc.createElement('div');
    el.id = 'hha-auto-vr';
    el.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      display:none; align-items:center; justify-content:center;
      background:rgba(0,0,0,.55);
      padding:22px;
      color:#fff;
      font:900 18px/1.25 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
      text-align:center;
    `;
    el.innerHTML = `
      <div style="max-width:520px;width:100%">
        <div style="font-size:22px;margin-bottom:10px">พร้อมเข้า VR Cardboard</div>
        <div style="opacity:.9;margin-bottom:14px">แตะ 1 ครั้งเพื่อเข้าโหมด VR (WebXR)</div>
        <button id="hha-auto-vr-btn" style="
          width:100%; padding:14px 16px; border:0; border-radius:14px;
          font:1000 18px/1 system-ui; cursor:pointer;
        ">แตะเพื่อเข้า VR</button>
        <div style="opacity:.75;margin-top:10px;font-size:13px">
          หมายเหตุ: เบราว์เซอร์บังคับให้ต้อง “แตะ” ก่อนเริ่ม VR
        </div>
      </div>
    `;
    doc.body.appendChild(el);

    el.querySelector('#hha-auto-vr-btn').addEventListener('click', tryEnterVR, {passive:true});
    return el;
  }

  async function tryEnterVR(){
    // best-effort fullscreen
    try{ await doc.documentElement.requestFullscreen?.(); }catch(e){}
    // best-effort landscape lock
    try{ await screen.orientation?.lock?.('landscape'); }catch(e){}

    // Preferred: click the actual Enter VR button from vr-ui.js
    const btn = doc.querySelector('[data-vrui="enter-vr"]');
    if(btn) btn.click();

    // Backup: dispatch event
    root.dispatchEvent(new CustomEvent('hha:enter_vr'));

    const ov = doc.querySelector('#hha-auto-vr');
    if(ov) ov.style.display = 'none';
  }

  function tick(){
    if(!cfg.enabled) return;
    const ov = ensureOverlay();

    if(isLandscape()){
      setCVR(true);
      ov.style.display = 'flex';
    }else{
      setCVR(false);
      ov.style.display = 'none';
    }
  }

  root.addEventListener('orientationchange', tick, {passive:true});
  root.addEventListener('resize', tick, {passive:true});
  tick();

})(window);