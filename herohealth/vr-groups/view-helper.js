/* === /herohealth/vr-groups/view-helper.js ===
GroupsVR View Helper
✅ cVR strict fallback shooter (center screen) if vr-ui doesn't emit hha:shoot
✅ try fullscreen + orientation lock for Cardboard
✅ iOS gyro permission helper (optional button)
Expose: window.GroupsVR.ViewHelper.{init, tryImmersiveForCVR}
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const DOC = root.document;
  if (!DOC) return;

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  function isIOS(){
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua);
  }

  async function enterFullscreen(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      return true;
    }catch(_){ return false; }
  }

  async function lockLandscape(){
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
        return true;
      }
    }catch(_){}
    return false;
  }

  // iOS gyro permission
  function needsGyroPermission(){
    return isIOS() && typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function';
  }

  function ensureGyroBtn(){
    let btn = DOC.getElementById('gyroBtn');
    if (btn) return btn;

    btn = DOC.createElement('button');
    btn.id = 'gyroBtn';
    btn.type = 'button';
    btn.textContent = '🧭 Enable Gyro';
    btn.style.cssText = `
      position:fixed; left:12px; bottom:12px;
      z-index:115;
      padding:10px 12px;
      border-radius:14px;
      border:1px solid rgba(148,163,184,.22);
      background: rgba(15,23,42,.65);
      color:#e5e7eb;
      font: 900 13px/1 system-ui;
      cursor:pointer;
      -webkit-tap-highlight-color: transparent;
    `;
    DOC.body.appendChild(btn);

    btn.addEventListener('click', async ()=>{
      try{
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === 'granted'){
          btn.remove();
        }else{
          btn.textContent = '⚠️ Gyro denied';
        }
      }catch(_){
        btn.textContent = '⚠️ Gyro failed';
      }
    });

    return btn;
  }

  // Detect if vr-ui exists in DOM
  function hasVrUi(){
    return !!DOC.querySelector('.hha-vr-ui, .hha-vrui, .hha-vrui-root, .vr-ui');
  }

  // fallback shooter for cVR
  function bindFallbackShoot(lockPx){
    if (bindFallbackShoot._done) return;
    bindFallbackShoot._done = true;

    let sawShootEvent = false;
    root.addEventListener('hha:shoot', ()=>{ sawShootEvent = true; }, {passive:true});

    // if vr-ui exists we usually don't need fallback
    const maybeSkip = hasVrUi();

    function fire(){
      // if vr-ui is present and events are flowing -> skip
      if (maybeSkip && sawShootEvent) return;

      const x = (root.innerWidth||360) * 0.5;
      const y = (root.innerHeight||640) * 0.5;
      try{
        root.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ x, y, lockPx } }));
      }catch(_){}
    }

    // For cVR, tapping anywhere triggers a shot from crosshair
    root.addEventListener('pointerdown', (e)=>{
      // ignore if end overlay is open
      const end = DOC.getElementById('endOverlay');
      if (end && !end.classList.contains('hidden')) return;
      // fire on any tap
      fire();
    }, {passive:true});
  }

  // Try immersive: fullscreen + landscape (first gesture)
  function tryImmersiveForCVR(){
    if (tryImmersiveForCVR._done) return;
    tryImmersiveForCVR._done = true;

    const once = async ()=>{
      try{
        await enterFullscreen();
        await lockLandscape();
      }catch(_){}
      root.removeEventListener('pointerdown', once, true);
      root.removeEventListener('keydown', once, true);
    };

    root.addEventListener('pointerdown', once, true);
    root.addEventListener('keydown', once, true);
  }

  function init(opts){
    opts = opts || {};
    const view = String(opts.view||'').toLowerCase();
    const lockPx = clamp((root.HHA_VRUI_CONFIG && root.HHA_VRUI_CONFIG.lockPx) ? root.HHA_VRUI_CONFIG.lockPx : 92, 40, 160);

    if (needsGyroPermission()){
      ensureGyroBtn();
    }

    if (view === 'cvr'){
      // strict fallback shooter
      bindFallbackShoot(lockPx);
      // try fullscreen/orientation
      tryImmersiveForCVR();
    }
  }

  NS.ViewHelper = { init, tryImmersiveForCVR };

})(typeof window !== 'undefined' ? window : globalThis);