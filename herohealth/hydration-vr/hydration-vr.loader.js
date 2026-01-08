// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Folder Loader — AUTO-DETECT (NO OVERRIDE) — PRODUCTION
// ✅ Detects: PC / Mobile / Cardboard(split) / cVR(crosshair strict)
// ✅ NO override: ignores ?view=... entirely
// ✅ Converts startOverlay into "detected mode + Start" (no mode menu)
// ✅ Best-effort fullscreen + landscape lock on first Start tap
// ✅ Maps layers to window.HHA_VIEW.layers for hydration.safe.js
// ✅ Imports ./hydration.safe.js with cache-bust support

'use strict';

(function(){
  const q = new URLSearchParams(location.search);
  const bust = q.get('v') || q.get('ts') || '';

  function withBust(p){
    if (!bust) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(bust);
  }

  const WIN = window;
  const DOC = document;
  const body = DOC.body;

  // ------------------ helpers ------------------
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const isMobileUA = ()=> /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
  const isTouch = ()=> ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
  const isLandscape = ()=> {
    try{
      if (WIN.matchMedia) return WIN.matchMedia('(orientation: landscape)').matches;
    }catch(_){}
    return (WIN.innerWidth > WIN.innerHeight);
  };

  async function canWebXRImmersiveVR(){
    try{
      if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
      return await navigator.xr.isSessionSupported('immersive-vr');
    }catch(_){ return false; }
  }

  async function enterFull(){
    // MUST be called from user gesture
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el.requestFullscreen){
        await el.requestFullscreen({ navigationUI:'hide' });
      }
    }catch(_){}
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  function setBodyMode(mode){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (mode === 'cardboard') body.classList.add('cardboard');
    else if (mode === 'cvr') body.classList.add('view-cvr');
    else if (mode === 'mobile') body.classList.add('view-mobile');
    else body.classList.add('view-pc');
  }

  function mapLayersByMode(mode){
    const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
    if (mode === 'cardboard'){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  }

  function humanMode(mode){
    if (mode === 'cardboard') return 'VR Cardboard (Split)';
    if (mode === 'cvr') return 'cVR (Crosshair ยิงกลางจอ)';
    if (mode === 'mobile') return 'Mobile';
    return 'PC';
  }

  // ------------------ NO OVERRIDE: decide mode only from environment ------------------
  // Rule of thumb (practical):
  // - If WebXR immersive-vr supported => prefer cVR (crosshair strict) on mobile/touch, else PC
  // - Else if mobile/touch:
  //    - if landscape already => assume Cardboard split (most common headset posture)
  //    - else => Mobile
  // - Else => PC
  async function detectMode(){
    const mobile = isMobileUA() || isTouch();
    const land = isLandscape();
    const xrVR = await canWebXRImmersiveVR();

    if (xrVR && mobile) return 'cvr';
    if (mobile && land) return 'cardboard';
    if (mobile) return 'mobile';
    return 'pc';
  }

  // ------------------ Start Overlay: keep only Start (no menu) ------------------
  function simplifyOverlay(mode){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return null;

    // show detected info
    try{
      const sub = ov.querySelector('.sub');
      if (sub){
        sub.textContent =
`ตรวจพบโหมดอัตโนมัติ: ${humanMode(mode)}
• แตะ Start เพื่อเริ่มเกม
• (Mobile/VR) ระบบจะพยายาม Fullscreen + ล็อกแนวนอนอัตโนมัติ`;
      }
    }catch(_){}

    // hide any old mode buttons if present
    try{
      const ids = ['btnPC','btnMobile','btnCardboard','btnCVR'];
      ids.forEach(id=>{
        const b = DOC.getElementById(id);
        if (b) b.style.display = 'none';
      });
    }catch(_){}

    // ensure we have a single Start button
    let startBtn = DOC.getElementById('btnStartAuto');
    if (!startBtn){
      try{
        const row = ov.querySelector('.btnRow') || ov;
        startBtn = DOC.createElement('button');
        startBtn.id = 'btnStartAuto';
        startBtn.className = 'btn primary';
        startBtn.textContent = '▶ Start';
        startBtn.style.pointerEvents = 'auto';
        row.insertBefore(startBtn, row.firstChild);
      }catch(_){}
    }

    return startBtn;
  }

  function startGame(){
    try{
      const ov = DOC.getElementById('startOverlay');
      if (ov) ov.classList.add('hide');
    }catch(_){}
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  // ------------------ import with better error overlay ------------------
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function showFail(err, tried){
    const el = DOC.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed (auto loader)</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${escapeHtml(location.href)}</code></div>
        <div style="opacity:.9;margin-bottom:10px">baseURI: <code>${escapeHtml(DOC.baseURI)}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Tried paths:</div>
        <ol style="line-height:1.55">${tried.map(s=>`<li><code>${escapeHtml(s)}</code></li>`).join('')}</ol>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${escapeHtml(String(err && (err.stack || err.message || err)))}</pre>
      </div>
    `;
    DOC.body.appendChild(el);
  }

  // ------------------ boot ------------------
  (async()=>{
    const mode = await detectMode();

    // apply mode + map layers (NO override)
    setBodyMode(mode);
    mapLayersByMode(mode);

    // simplify overlay => single Start
    const startBtn = simplifyOverlay(mode);

    // If overlay missing: auto start after tiny delay
    if (!startBtn){
      setTimeout(()=>startGame(), 120);
    } else {
      // Start gesture: best-effort fullscreen for mobile/cardboard/cvr
      startBtn.addEventListener('click', async ()=>{
        if (mode === 'mobile' || mode === 'cardboard' || mode === 'cvr'){
          await enterFull();
        }
        startGame();
      }, { passive:false });
    }

    // Import safe.js
    const candidates = [
      './hydration.safe.js',
    ].map(withBust);

    const tried = [];
    for (const p of candidates){
      tried.push(p);
      try{ await import(p); return; }catch(_){}
    }
    showFail(new Error('All candidate imports failed.'), tried);
  })();

})();