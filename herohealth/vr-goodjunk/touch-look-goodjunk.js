export function attachTouchLook(cameraEl, opts = {}) {
  const sensitivity = Number(opts.sensitivity ?? 0.25);
  const areaEl = opts.areaEl || document.body;
  const onActiveChange = (typeof opts.onActiveChange === 'function') ? opts.onActiveChange : null;

  let active = false;
  let lastX = 0;
  let lastY = 0;
  let yaw = 0;
  let pitch = 0;

  function setActive(v){
    if (active === v) return;
    active = v;
    if (onActiveChange) onActiveChange(active);
  }

  function getRot(){
    const r = cameraEl.getAttribute('rotation') || { x:0,y:0,z:0 };
    return { x: Number(r.x)||0, y: Number(r.y)||0, z: Number(r.z)||0 };
  }

  function onStart(e){
    const t = e.touches ? e.touches[0] : null;
    if (!t) return;
    setActive(true);
    lastX = t.clientX;
    lastY = t.clientY;

    const r = getRot();
    pitch = r.x;
    yaw = r.y;
  }

  function onMove(e){
    if (!active) return;
    const t = e.touches ? e.touches[0] : null;
    if (!t) return;

    const dx = (t.clientX - lastX);
    const dy = (t.clientY - lastY);

    yaw   -= dx * sensitivity;
    pitch -= dy * sensitivity;

    pitch = Math.max(-80, Math.min(80, pitch));
    cameraEl.setAttribute('rotation', { x: pitch, y: yaw, z: 0 });

    lastX = t.clientX;
    lastY = t.clientY;
  }

  function onEnd(){
    setActive(false);
  }

  areaEl.addEventListener('touchstart', onStart, { passive:true });
  areaEl.addEventListener('touchmove', onMove, { passive:true });
  areaEl.addEventListener('touchend', onEnd, { passive:true });
  areaEl.addEventListener('touchcancel', onEnd, { passive:true });

  return ()=> {
    areaEl.removeEventListener('touchstart', onStart);
    areaEl.removeEventListener('touchmove', onMove);
    areaEl.removeEventListener('touchend', onEnd);
    areaEl.removeEventListener('touchcancel', onEnd);
  };
}
