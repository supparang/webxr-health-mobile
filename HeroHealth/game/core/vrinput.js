// === Hero Health Academy — core/vrinput.js (reticle + gaze dwell + XR toggle) ===
export const VRInput = (() => {
  let THREERef = null, engine = null, sfx = null;
  let xrSession = null, xrRefSpace = null;
  let reticle = null, dwellMs = 0, dwellStart = 0, dwellTarget = null;
  let isGaze = false, rafId = 0;

  function msNow(){ return performance?.now?.() || Date.now(); }
  function cfgDwell(){ 
    const v = parseInt(localStorage.getItem('hha_dwell_ms')||'',10);
    dwellMs = Number.isFinite(v) && v>=400 && v<=2000 ? v : 850;
  }

  function ensureReticle(){
    if (reticle) return reticle;
    const el = document.createElement('div');
    el.id='xrReticle';
    el.style.cssText = `
      position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
      width:26px;height:26px;border:3px solid #fff;border-radius:50%;
      box-shadow:0 0 12px #000a;z-index:9999;pointer-events:none;opacity:.0;transition:opacity .15s;
    `;
    const prog = document.createElement('div');
    prog.style.cssText = `
      position:absolute;inset:3px;border-radius:50%;background:conic-gradient(#7fffd4 0deg,#7fffd400 0deg);
      opacity:.9;mix-blend-mode:screen;transition:none;
    `;
    el.appendChild(prog);
    document.body.appendChild(el);
    reticle = { host: el, prog };
    return reticle;
  }
  function showReticle(on){ const r=ensureReticle(); r.host.style.opacity = on? '1' : '.0'; }
  function setReticlePct(p){ const r=ensureReticle(); const deg=Math.max(0,Math.min(360, p*360)); r.prog.style.background = `conic-gradient(#ffd54a ${deg}deg,#0000 ${deg}deg)`; }

  async function toggleVR(){
    try{
      if (xrSession){ await xrSession.end(); xrSession=null; xrRefSpace=null; isGaze=false; showReticle(false); cancelAnimationFrame(rafId); return; }
      if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-vr'))){
        // fallback: Gaze mode (no XR) — ใช้ dwell บน UI HTML
        isGaze = true; cfgDwell(); showReticle(true); loopGaze();
        return;
      }
      xrSession = await navigator.xr.requestSession('immersive-vr', { requiredFeatures:['local-floor'] });
      xrRefSpace = await xrSession.requestReferenceSpace('local-floor');
      isGaze = true; cfgDwell(); showReticle(true);
      xrSession.addEventListener('end', ()=>{ xrSession=null; xrRefSpace=null; isGaze=false; showReticle(false); cancelAnimationFrame(rafId); });
      loopGaze();
    }catch(e){ console.warn('[VRInput] toggle error', e); throw e; }
  }

  function loopGaze(){
    cancelAnimationFrame(rafId);
    const step = ()=>{
      if (!isGaze){ setReticlePct(0); return; }
      // ใช้จุดกึ่งกลางหน้าจอเป็นจุดเล็ง
      const x = innerWidth/2, y = innerHeight/2;
      const target = document.elementFromPoint(x,y);
      const clickable = target?.closest?.('button,.item,[data-action],[data-modal-open],[data-result]');
      const now = msNow();
      if (clickable){
        if (dwellTarget !== clickable){ dwellTarget = clickable; dwellStart = now; }
        const p = Math.min(1, (now - dwellStart)/dwellMs);
        setReticlePct(p);
        if (p>=1){
          // ยิงคลิก 1 ครั้ง
          clickable.click?.();
          sfx?.play?.('sfx-good');
          dwellTarget = null; dwellStart = now; setReticlePct(0);
        }
      }else{
        dwellTarget = null; setReticlePct(0);
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function init({ engine:engRef, sfx:sfxRef, THREE:threeRef }){
    engine = engRef||engine; sfx = sfxRef||sfx; THREERef = threeRef||THREERef;
  }
  function isXRActive(){ return !!xrSession; }
  function isGazeMode(){ return !!isGaze; }

  return { init, toggleVR, isXRActive, isGazeMode };
})();
