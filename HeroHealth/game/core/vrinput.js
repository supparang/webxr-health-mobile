// === Hero Health Academy — core/vrinput.js (v2.1 hardened; +cooldown +reticle style) ===
export const VRInput = (() => {
  let THREERef = null, engine = null, sfx = null;

  let xrSession = null, xrRefSpace = null;

  let reticle = null;
  let dwellMs = 850;
  let dwellStart = 0;
  let dwellTarget = null;

  // NEW: cooldown config + state
  let dwellCooldownMs = 350;
  let dwellCooldownUntil = 0;

  let isGaze = false;
  let paused = false;
  let rafId = 0;

  let aimHost = null;
  let aimOffset = { x: 0, y: 0 };

  let CLICK_SEL = 'button,.item,[data-action],[data-modal-open],[data-result]';

  // NEW: reticle style options
  let reticleStyle = {
    size: 28,
    border: '#fff',
    progress: '#ffd54a',
    shadow: '#000a'
  };

  const msNow = () => performance?.now?.() || Date.now();
  const clamp = (n,a,b)=> Math.max(a, Math.min(b,n));
  const cfgDwell = (ms) => {
    if (Number.isFinite(ms)) {
      dwellMs = clamp(ms|0, 400, 2000);
      try { localStorage.setItem('hha_dwell_ms', String(dwellMs)); } catch {}
      return;
    }
    const v = parseInt(localStorage.getItem('hha_dwell_ms')||'', 10);
    dwellMs = Number.isFinite(v) ? clamp(v, 400, 2000) : 850;
  };

  function ensureReticle(){
    if (reticle && document.body.contains(reticle.host)) return reticle;

    const host = document.createElement('div');
    host.id = 'xrReticle';
    host.style.cssText = `
      position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
      width:${reticleStyle.size}px;height:${reticleStyle.size}px;
      border:3px solid ${reticleStyle.border};border-radius:50%;
      box-shadow:0 0 12px ${reticleStyle.shadow};z-index:9999;
      pointer-events:none;opacity:.0;transition:opacity .15s;
    `;

    const prog = document.createElement('div');
    prog.className = 'xrReticle-progress';
    prog.style.cssText = `
      position:absolute;inset:3px;border-radius:50%;
      background:conic-gradient(${reticleStyle.progress} 0deg,#0000 0deg);
      opacity:.9;mix-blend-mode:screen;transition:none;pointer-events:none;
    `;

    host.appendChild(prog);
    document.body.appendChild(host);
    reticle = { host, prog };
    return reticle;
  }
  function showReticle(on){ ensureReticle().host.style.opacity = on ? '1' : '.0'; }
  function setReticlePct(p){
    const deg = clamp(p, 0, 1) * 360;
    ensureReticle().prog.style.background = `conic-gradient(${reticleStyle.progress} ${deg}deg,#0000 ${deg}deg)`;
  }
  // NEW: apply style live if reticle exists
  function applyReticleStyle(){
    if (!reticle) return;
    reticle.host.style.width  = `${reticleStyle.size}px`;
    reticle.host.style.height = `${reticleStyle.size}px`;
    reticle.host.style.border = `3px solid ${reticleStyle.border}`;
    reticle.host.style.boxShadow = `0 0 12px ${reticleStyle.shadow}`;
    setReticlePct(0);
  }

  async function toggleVR(){
    try{
      if (xrSession){ await xrSession.end(); return; }
      if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-vr'))){
        isGaze = true; cfgDwell(); paused = false; showReticle(true); loopGaze(); return;
      }
      xrSession = await navigator.xr.requestSession('immersive-vr', { requiredFeatures:['local-floor'] });
      xrRefSpace = await xrSession.requestReferenceSpace('local-floor');
      isGaze = true; paused = false; cfgDwell(); showReticle(true);
      xrSession.addEventListener('end', onXREnd, { once:true });
      loopGaze();
    }catch(e){
      console.warn('[VRInput] toggle error', e);
      isGaze = true; paused = false; cfgDwell(); showReticle(true); loopGaze();
    }
  }
  function onXREnd(){ xrSession = null; xrRefSpace = null; isGaze = false; showReticle(false); cancelAnimationFrame(rafId); }

  function aimCenter(){
    if (aimHost && aimHost.getBoundingClientRect){
      const r = aimHost.getBoundingClientRect();
      return { x: Math.round(r.left + r.width/2 + aimOffset.x),
               y: Math.round(r.top  + r.height/2 + aimOffset.y) };
    }
    return { x: (innerWidth>>1) + (aimOffset.x|0), y: (innerHeight>>1) + (aimOffset.y|0) };
  }

  function loopGaze(){
    cancelAnimationFrame(rafId);
    const step = ()=>{
      if (!isGaze || paused){ setReticlePct(0); return; }

      const { x, y } = aimCenter();
      const target = document.elementFromPoint(x, y);
      const clickable = target?.closest?.(CLICK_SEL) || null;

      const now = msNow();

      if (clickable){
        if (dwellTarget !== clickable){ dwellTarget = clickable; dwellStart = now; }
        const p = Math.min(1, (now - dwellStart) / dwellMs);
        setReticlePct(p);

        const cooled = now >= dwellCooldownUntil;
        if (p >= 1 && cooled){
          try { clickable.click?.(); sfx?.play?.('sfx-good'); } catch {}
          dwellCooldownUntil = now + dwellCooldownMs; // respect cooldown
          dwellTarget = null; dwellStart = now; setReticlePct(0);
        }
      } else {
        dwellTarget = null; setReticlePct(0);
      }

      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function onBlur(){ pause(true); }
  function onFocus(){ resume(true); }
  function onVis(){ document.hidden ? pause(true) : resume(true); }

  function init({ engine:engRef, sfx:sfxRef, THREE:threeRef } = {}){
    engine = engRef || engine;
    sfx    = sfxRef  || sfx;
    THREERef = threeRef || THREERef;
    cfgDwell();
    try {
      window.addEventListener('blur', onBlur, { passive:true });
      window.addEventListener('focus', onFocus, { passive:true });
      document.addEventListener('visibilitychange', onVis, { passive:true });
    } catch {}
  }

  function setDwellMs(ms){ cfgDwell(ms); }
  function setSelectors(css){ if (css && typeof css === 'string') CLICK_SEL = css; }
  function setAimHost(el){ aimHost = (el && el.getBoundingClientRect) ? el : null; }
  function calibrate(dx=0, dy=0){ aimOffset = { x: dx|0, y: dy|0 }; }

  // NEW: no-ops that main.js expects
  function setCooldown(ms){ if (Number.isFinite(ms)) dwellCooldownMs = Math.max(0, ms|0); }
  function setReticleStyle(opts={}){
    const o = opts||{};
    if (Number.isFinite(o.size)) reticleStyle.size = Math.max(12, o.size|0);
    if (o.border)   reticleStyle.border   = String(o.border);
    if (o.progress) reticleStyle.progress = String(o.progress);
    if (o.shadow)   reticleStyle.shadow   = String(o.shadow);
    applyReticleStyle();
  }

  function isXRActive(){ return !!xrSession; }
  function isGazeMode(){ return !!isGaze; }

  function pause(internal=false){
    if (paused) return;
    paused = true;
    setReticlePct(0);
    cancelAnimationFrame(rafId);
    if (!internal) console.debug('[VRInput] paused');
  }
  function resume(internal=false){
    if (!isGaze) return; 
    if (!paused) return;
    paused = false; loopGaze();
    if (!internal) console.debug('[VRInput] resumed');
  }

  function dispose(){
    pause();
    showReticle(false);
    try { reticle?.host?.remove(); } catch {}
    reticle = null;
    try {
      window.removeEventListener('blur', onBlur, { passive:true });
      window.removeEventListener('focus', onFocus, { passive:true });
      document.removeEventListener('visibilitychange', onVis, { passive:true });
    } catch {}
    if (xrSession){ try { xrSession.end(); } catch {} }
    xrSession = null; xrRefSpace = null; isGaze = false;
  }

  return {
    init, toggleVR, isXRActive, isGazeMode,
    setDwellMs, setSelectors, setAimHost, calibrate,
    // NEW:
    setCooldown, setReticleStyle,
    pause, resume, dispose
  };
})();
