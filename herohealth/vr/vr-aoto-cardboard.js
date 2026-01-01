// === /herohealth/vr/vr-auto-cardboard.js ===
// GoodJunkVR-friendly: rotate => view-cvr (dual-eye) + optional 1-tap fullscreen/hint

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc) return;
  if(root.__HHA_AUTOCVR_BOUND__) return;
  root.__HHA_AUTOCVR_BOUND__ = true;

  const cfg = root.HHA_AUTOVR || { enabled:true };
  const isLandscape = () =>
    root.matchMedia?.("(orientation: landscape)")?.matches || (root.innerWidth > root.innerHeight);

  function setView(view){
    const b = doc.body;
    // ไม่ล้าง class อื่น ๆ เยอะ ให้คุมเฉพาะ view-*
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add(`view-${view}`);
  }

  function ensureOverlay(){
    let el = doc.querySelector('#hha-auto-cvr');
    if(el) return el;

    el = doc.createElement('div');
    el.id = 'hha-auto-cvr';
    el.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      display:none; align-items:center; justify-content:center;
      background:rgba(0,0,0,.55);
      padding:22px;
      color:#fff;
      font:1000 18px/1.25 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
      text-align:center;
    `;
    el.innerHTML = `
      <div style="max-width:520px;width:100%">
        <div style="font-size:22px;margin-bottom:10px">Cardboard พร้อมแล้ว</div>
        <div style="opacity:.9;margin-bottom:14px">
          โหมด 2 ตา (cVR) เปิดอัตโนมัติแล้ว<br/>
          แตะ 1 ครั้งเพื่อ “เต็มจอ/ล็อกแนวนอน” (ถ้ารองรับ)
        </div>
        <button id="hha-auto-cvr-btn" style="
          width:100%; padding:14px 16px; border:0; border-radius:14px;
          font:1000 18px/1 system-ui; cursor:pointer;
        ">แตะเพื่อจัดโหมด VR ให้เนียน</button>
        <div style="opacity:.75;margin-top:10px;font-size:13px">
          (บางเครื่องต้องแตะก่อนถึงจะ fullscreen/lock ได้)
        </div>
      </div>
    `;
    doc.body.appendChild(el);

    el.querySelector('#hha-auto-cvr-btn').addEventListener('click', async ()=>{
      if(cfg.autoFullscreen){
        try{ await doc.documentElement.requestFullscreen?.(); }catch(e){}
        try{ await screen.orientation?.lock?.('landscape'); }catch(e){}
      }
      el.style.display = 'none';
    }, { passive:true });

    return el;
  }

  function maybeHideHudOnCVR(){
    if(!cfg.hideHudOnCVR) return;
    const hud = doc.querySelector('.hha-hud');
    if(hud) hud.style.display = 'none';
    // peek ยังอยู่ได้ถ้าต้องการ (หรือซ่อนเพิ่มเอง)
  }

  function maybeShowHud(){
    const hud = doc.querySelector('.hha-hud');
    if(hud) hud.style.display = '';
  }

  function tick(){
    if(!cfg.enabled) return;

    if(isLandscape()){
      // เข้า Cardboard split (dual-eye)
      setView('cvr');
      maybeHideHudOnCVR();

      if(cfg.autoHint){
        const ov = ensureOverlay();
        ov.style.display = 'flex';
      }
    }else{
      // กลับมือถือปกติ
      setView('mobile');
      maybeShowHud();

      const ov = doc.querySelector('#hha-auto-cvr');
      if(ov) ov.style.display = 'none';
    }
  }

  root.addEventListener('orientationchange', tick, { passive:true });
  root.addEventListener('resize', tick, { passive:true });
  tick();

})(window);