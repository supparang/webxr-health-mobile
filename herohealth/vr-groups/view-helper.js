// === /herohealth/vr-groups/view-helper.js ===
// View Helper — PRODUCTION
// (12) fullscreen/orientation helper + view-cvr strict assist
// ✅ init({view})
// ✅ best-effort fullscreen
// ✅ best-effort landscape lock (mobile/cVR)
// ✅ tryImmersiveForCVR(): พยายาม enter VR (A-Frame) แบบสุภาพ (ไม่พังถ้าไม่ได้)
// ✅ safe CSS variables for viewport

(function(root){
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const ViewHelper = NS.ViewHelper = NS.ViewHelper || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function isMobile(){
    const ua = (navigator.userAgent||'').toLowerCase();
    return /android|iphone|ipad|ipod|mobile/.test(ua);
  }

  function setCssViewportVars(){
    try{
      const vw = Math.max(1, root.innerWidth||1);
      const vh = Math.max(1, root.innerHeight||1);
      DOC.documentElement.style.setProperty('--vw', vw+'px');
      DOC.documentElement.style.setProperty('--vh', vh+'px');
    }catch(_){}
  }

  function requestFs(el){
    try{
      el = el || DOC.documentElement;
      const f = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (f) return f.call(el);
    }catch(_){}
    return Promise.resolve();
  }

  async function lockLandscape(){
    try{
      const so = screen && screen.orientation;
      if (so && so.lock) await so.lock('landscape');
    }catch(_){}
  }

  function bindResize(){
    try{
      root.addEventListener('resize', setCssViewportVars, {passive:true});
      root.addEventListener('orientationchange', ()=>{
        setTimeout(setCssViewportVars, 80);
      }, {passive:true});
      setCssViewportVars();
    }catch(_){}
  }

  function ensureCVRStrict(){
    // “strict” ที่สำคัญของ cVR จริงๆ = ยิงจาก crosshair (vr-ui.js) + ปิด pointer events ของเป้า (ใน CSS ทำแล้ว)
    // ตรงนี้ช่วยแค่เรื่อง UX: แตะจอแล้วพยายาม fullscreen + lock landscape
    function onFirstTouch(){
      DOC.removeEventListener('touchstart', onFirstTouch, {passive:true});
      requestFs(DOC.documentElement);
      lockLandscape();
    }
    try{
      DOC.addEventListener('touchstart', onFirstTouch, {passive:true, once:true});
    }catch(_){}
  }

  function getAFrameScene(){
    try{
      // AFRAME.scenes[0] มักจะมีในหน้า run
      if (root.AFRAME && root.AFRAME.scenes && root.AFRAME.scenes.length) return root.AFRAME.scenes[0];
      const s = DOC.querySelector('a-scene');
      return s && s.object3D ? s : null;
    }catch(_){}
    return null;
  }

  async function tryImmersiveForCVR(){
    // best-effort: ไม่บังคับ, ถ้า browser/gesture ไม่อนุญาตก็เงียบ
    try{
      await requestFs(DOC.documentElement);
      await lockLandscape();
    }catch(_){}

    try{
      const scene = getAFrameScene();
      if (scene && typeof scene.enterVR === 'function'){
        // ต้องมี user gesture บางเครื่องถึงจะเข้าได้
        scene.enterVR();
      }
    }catch(_){}
  }

  function init(opts){
    opts = opts || {};
    const view = String(opts.view||'mobile').toLowerCase();

    bindResize();

    // mobile/cvr: ช่วยเรื่อง orientation
    if (view === 'mobile' || view === 'cvr'){
      if (isMobile()){
        // พยายาม lock landscape หลังมี gesture (บางเครื่องต้อง)
        DOC.addEventListener('touchstart', ()=> lockLandscape(), {passive:true, once:true});
      }
    }

    if (view === 'cvr'){
      ensureCVRStrict();
    }

    // ทำ marker class เผื่อ debug
    try{
      DOC.body && DOC.body.classList.add('vh-inited');
    }catch(_){}
  }

  ViewHelper.init = init;
  ViewHelper.requestFs = requestFs;
  ViewHelper.lockLandscape = lockLandscape;
  ViewHelper.tryImmersiveForCVR = tryImmersiveForCVR;
  ViewHelper.isMobile = isMobile;
})(window);