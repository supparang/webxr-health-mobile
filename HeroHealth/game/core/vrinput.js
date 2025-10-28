// === Hero Health Academy — core/vrinput.js (Gaze reticle + dwell configurable + XR safe) ===
export const VRInput = (() => {
  let engine = null, sfx = null;
  let xrSession = null, _gaze = null, _dwell = null, _timer = 0, _target = null;
  let _cfg = {
    mode: 'auto',           // 'auto' | 'gaze'
    dwellMsDesktop: 700,
    dwellMsMobile: 900,
    dwellMsStandalone: 600
  };

  function isMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }

  function ensureReticle(){
    if (_gaze) return;
    _gaze = document.createElement('div');
    _gaze.id = 'gazeReticle';
    _gaze.innerHTML = `<i></i><b></b>`;
    _gaze.style.cssText = 'position:fixed;inset:0;display:none;pointer-events:none;z-index:120';
    document.body.appendChild(_gaze);

    _dwell = _gaze.querySelector('b');
  }

  function inGazeMode(){
    if (_cfg.mode === 'gaze') return true;
    // auto: ไม่มีเมาส์/นิ้วกำลังลาก และไม่มี XR -> ใช้ gaze เมื่อคลาส 'gaze-mode' ถูกตั้งจากปุ่ม VR
    return document.documentElement.classList.contains('hha-gaze');
  }

  function pickDwellMs(){
    // ถ้าอยู่ใน WebXR Immersive -> standalone
    if (isXRActive()) return _cfg.dwellMsStandalone|0 || 600;
    return isMobile() ? (_cfg.dwellMsMobile|0 || 900) : (_cfg.dwellMsDesktop|0 || 700);
  }

  function showReticle(show){
    ensureReticle();
    _gaze.style.display = show ? 'block' : 'none';
    if (!show){ _target = null; _timer = 0; if (_dwell) _dwell.style.width = '0%'; }
  }

  function raycastTarget(){
    // ในโหมด 2D UI เรา “gaze” กลางจอ: หา element .item ที่อยู่ตรงกลางจอมากที่สุด
    const cx = innerWidth/2, cy = innerHeight/2;
    let best=null, bestD=1e9;
    document.querySelectorAll('.item').forEach(el=>{
      const r = el.getBoundingClientRect();
      const x = r.left + r.width/2, y = r.top + r.height/2;
      const d = Math.hypot(x-cx, y-cy);
      if (d < bestD){ bestD=d; best=el; }
    });
    return best;
  }

  function loop(ts){
    if (!inGazeMode()){ showReticle(false); return; }
    showReticle(true);

    const dwell = pickDwellMs();
    const t = raycastTarget();

    if (t !== _target){ _target = t; _timer = 0; if (_dwell) _dwell.style.width='0%'; }

    if (_target){
      _timer += 16;
      const pct = Math.min(100, Math.round((_timer/dwell)*100));
      if (_dwell) _dwell.style.width = pct + '%';
      if (_timer >= dwell){
        // trigger click
        try{ _target.click(); }catch{}
        if (navigator.vibrate) try{ navigator.vibrate(12); }catch{}
        _timer = 0; if (_dwell) _dwell.style.width='0%';
      }
    }else{
      _timer = 0; if (_dwell) _dwell.style.width='0%';
    }
    requestAnimationFrame(loop);
  }

  // --- XR toggles ---
  async function toggleVR(){
    if (xrSession){
      await xrSession.end().catch(()=>{});
      xrSession = null;
      document.documentElement.classList.remove('hha-xr');
      return;
    }
    if (!navigator.xr || !(await navigator.xr.isSessionSupported?.('immersive-vr'))){
      // ไม่มี XR: เข้าสู่ Gaze mode แทน
      document.documentElement.classList.toggle('hha-gaze');
      return;
    }
    xrSession = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: [] });
    xrSession.addEventListener('end', ()=>{ xrSession=null; document.documentElement.classList.remove('hha-xr'); });
    document.documentElement.classList.add('hha-xr');
    // หมายเหตุ: engine จัดการ renderer.xr.enable/ setSession ที่ Engine แล้ว
    try{ engine?.enterXR?.(xrSession); }catch{}
  }

  function isXRActive(){ return !!xrSession; }
  function isGazeMode(){ return inGazeMode(); }

  // --- Public ---
  function init({ engine:eng, sfx:_sfx, config }){
    engine = eng; sfx = _sfx;
    _cfg = Object.assign(_cfg, config||{});
    ensureReticle();
    requestAnimationFrame(loop);
  }
  function setConfig(cfg){ _cfg = Object.assign(_cfg, cfg||{}); }

  return { init, toggleVR, isXRActive, isGazeMode, setConfig };
})();
