// core/platform.js
// Detect platform and attach appropriate input: mouse (PC), touch/gaze (Mobile), laser/controllers (VR)
(function(){
  function isMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
  function hasWebXR(){ return !!(navigator.xr); }

  // Called after a-scene is ready
  function initInputs(){
    const scene = document.querySelector('a-scene');
    const cameraRig = document.querySelector('a-entity[position] > a-camera')?.parentElement || document.querySelector('a-entity[position="0 1.6 0"]');
    const arena = document.getElementById('arena');
    if(!scene || !arena) return;

    // Create a reticle for desktop/mobile aiming
    const reticle = document.createElement('a-entity');
    reticle.setAttribute('position','0 0 -1');
    reticle.setAttribute('geometry','primitive: ring; radiusInner: 0.01; radiusOuter: 0.015; segmentsTheta: 32');
    reticle.setAttribute('material','color: #00d0ff; opacity: 0.85; shader: flat');
    cameraRig && cameraRig.appendChild(reticle);

    // Desktop mouse: rayOrigin: mouse
    // Mobile: fuse cursor (gaze) + tap to click
    const cursor = document.createElement('a-entity');
    cursor.classList.add('desktop-cursor');
    const isM = isMobile();
    if(isM){
      cursor.setAttribute('cursor','fuse: true; fuseTimeout: 700');
    }else{
      cursor.setAttribute('cursor','rayOrigin: mouse');
    }
    cursor.setAttribute('raycaster','objects: .clickable, .sb-target; far: 8');
    scene.appendChild(cursor);

    // Touch to click current intersection (mobile)
    if(isM){
      scene.addEventListener('click', (ev)=>{/* tap triggers standard click events on intersected entities */});
      const hint = document.createElement('div');
      hint.textContent = '👆 Tap / Gaze to hit (mobile)';
      hint.style.position='fixed'; hint.style.left='12px'; hint.style.bottom='12px';
      hint.style.padding='6px 10px'; hint.style.border='1px solid #1a2532'; hint.style.background='#0c131d'; hint.style.borderRadius='10px';
      hint.style.font='12px/1.2 ui-monospace, monospace'; hint.style.color='#8aa2b2'; hint.style.opacity='0.95';
      document.body.appendChild(hint);
      setTimeout(()=>hint.remove(), 3000);
    }

    // VR controllers already provided via: <a-entity laser-controls="hand: left/right">
    // Nothing else is required here. A-Frame will show "Enter VR" on supported devices (HTTPS).
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{
      const scene = document.querySelector('a-scene');
      if(scene){ scene.addEventListener('loaded', initInputs); } else { initInputs(); }
    });
  }else{
    const scene = document.querySelector('a-scene');
    if(scene){ scene.addEventListener('loaded', initInputs); } else { initInputs(); }
  }
  window.Platform = { initInputs };
})();
