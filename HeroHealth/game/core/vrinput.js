// === Hero Health Academy — core/vrinput.js (WebXR + gaze dwell + DOM click bridge) ===
export const VRInput = (() => {
  let _eng = null, _sfx = null, _reticle = null, _inXR = false, _gazeMode = false;
  let _dwellMs = 900, _dwellT0 = 0, _dwellArmed = false, _rafId = 0, _xrSession = null;

  function center(){ return { x: innerWidth/2, y: innerHeight/2 }; }
  function elementAtCenter(){ const {x,y} = center(); return document.elementFromPoint(x,y); }
  function simulateClickAtCenter(){
    const el = elementAtCenter(); if(!el) return false;
    const hit = el.closest('.item,[data-action],button,.btn'); if(!hit) return false;
    const ev = { bubbles:true, cancelable:true, clientX:innerWidth/2, clientY:innerHeight/2 };
    ['pointerdown','mousedown','mouseup','pointerup','click'].forEach(t=>{ try{ hit.dispatchEvent(new MouseEvent(t,ev)); }catch{} });
    return true;
  }

  function ensureReticle(){
    if (_reticle && document.body.contains(_reticle)) return _reticle;
    const r = document.createElement('div');
    r.id='xrReticle';
    r.style.cssText = `
      position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
      width:28px;height:28px;border-radius:999px;
      box-shadow:inset 0 0 0 2px rgba(255,255,255,.9), 0 0 12px rgba(127,255,212,.55);
      z-index:200;pointer-events:none;opacity:0;transition:opacity .2s, transform .2s;`;
    document.body.appendChild(r);
    _reticle = r; return r;
  }
  function showReticle(v){ const r=ensureReticle(); r.style.opacity = v?'1':'0'; }
  function pulseReticle(){ const r=ensureReticle(); r.style.transform='translate(-50%,-50%) scale(.9)'; setTimeout(()=>r.style.transform='translate(-50%,-50%) scale(1)',120); }

  function resetDwell(){ _dwellT0 = performance.now(); _dwellArmed = true; }
  function dwellLoop(){
    if (!_inXR && !_gazeMode) return;
    const now = performance.now();
    if (_dwellArmed && now - _dwellT0 >= _dwellMs){
      _dwellArmed = false;
      const el = elementAtCenter();
      if (el && el.closest('.item,[data-action],button,.btn')){ pulseReticle(); simulateClickAtCenter(); }
      resetDwell();
    }
    _rafId = requestAnimationFrame(dwellLoop);
  }

  async function enterXR(){
    const ok = await navigator.xr?.isSessionSupported?.('immersive-vr');
    if (!ok) throw new Error('immersive-vr not supported');
    _eng?.renderer && (_eng.renderer.xr.enabled = true);
    _xrSession = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: [] });
    await _eng?.renderer?.xr?.setSession(_xrSession);
    _inXR = true; showReticle(true); resetDwell(); dwellLoop();
    _xrSession.addEventListener('end', onXREnd);
    _xrSession.addEventListener('select', onXRSelect);
  }
  function onXRSelect(){ pulseReticle(); simulateClickAtCenter(); resetDwell(); }
  function onXREnd(){ _inXR=false; _xrSession=null; _eng?.renderer && (_eng.renderer.xr.enabled=false); cleanupLoop(); showReticle(false); }
  function cleanupLoop(){ if (_rafId){ cancelAnimationFrame(_rafId); _rafId=0; } }

  async function init({engine=null, sfx=null, dwellMs=900}={}){
    _eng=engine||_eng; _sfx=sfx||_sfx; _dwellMs=Math.max(300,dwellMs|0);
    window.addEventListener('pointerdown', ()=>{ try{ _sfx?.unlock?.(); }catch{} }, { once:true, passive:true });
    window.addEventListener('touchstart', ()=>{ if (_inXR || _gazeMode){ simulateClickAtCenter(); resetDwell(); } }, { passive:true });
    ensureReticle(); showReticle(false);
  }
  async function toggleVR(){
    if (_inXR && _xrSession){ await _xrSession.end(); return; }
    if ('xr' in navigator){ try{ await enterXR(); return; } catch(e){ console.warn('[VRInput] XR failed → gaze fallback', e); } }
    _gazeMode = !_gazeMode; if (_gazeMode){ showReticle(true); resetDwell(); dwellLoop(); } else { showReticle(false); cleanupLoop(); }
  }
  const isXRActive = ()=>!!_inXR, isGazeMode = ()=>!!_gazeMode;
  return { init, toggleVR, isXRActive, isGazeMode };
})();
