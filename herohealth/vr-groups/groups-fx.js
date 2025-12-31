/* === /herohealth/vr-groups/groups-fx.js ===
GroupsVR FX Layer — FUN PACK (SAFE / VR-friendly)
✅ mini urgent pulse + subtle screen shake
✅ storm flash + background intensity
✅ clutch (last 10s) heartbeat
✅ hit feedback (good/bad/miss/boss)
No external deps.
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now = ()=> (root.performance && root.performance.now) ? root.performance.now() : Date.now();

  // --- tiny shaker (VR-safe) ---
  let shakeMsLeft = 0;
  let shakePow = 0;
  let shakeRAF = 0;
  let lastT = 0;

  function isCVR(){
    return DOC.body.classList.contains('view-cvr');
  }

  function addShake(pow, ms){
    // in cVR keep it subtle
    const k = isCVR() ? 0.55 : 1.0;
    shakePow = Math.max(shakePow, (Number(pow)||0) * k);
    shakeMsLeft = Math.max(shakeMsLeft, Number(ms)||0);
    if (!shakeRAF){
      lastT = now();
      shakeRAF = root.requestAnimationFrame(loopShake);
    }
  }

  function loopShake(){
    const t = now();
    const dt = Math.min(50, Math.max(0, t - lastT));
    lastT = t;

    shakeMsLeft = Math.max(0, shakeMsLeft - dt);

    const p = clamp(shakeMsLeft / 220, 0, 1);
    const amp = shakePow * p;

    // apply as a CSS variable to body (used by overlay if you want later)
    const dx = (Math.random()-0.5) * amp;
    const dy = (Math.random()-0.5) * amp;

    // We shake only HUD root a bit (not gameplay layer) => less nausea
    const hud = DOC.querySelector('.hud-root');
    if (hud){
      hud.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(var(--hudScale,1))`;
    }

    if (shakeMsLeft > 0){
      shakeRAF = root.requestAnimationFrame(loopShake);
    }else{
      shakePow = 0;
      shakeRAF = 0;
      if (hud){
        hud.style.transform = `scale(var(--hudScale,1))`;
      }
    }
  }

  // --- flash helper ---
  function flash(cls, ms){
    DOC.body.classList.add(cls);
    root.setTimeout(()=> DOC.body.classList.remove(cls), Math.max(60, ms||140));
  }

  // Create a lightweight full-screen FX layer (optional)
  function ensureFxLayer(){
    let el = DOC.querySelector('.groups-fx-layer');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'groups-fx-layer';
    el.style.cssText = `
      position:fixed; inset:0;
      pointer-events:none;
      z-index:7;
      opacity:0;
      transition: opacity .14s ease;
      background:
        radial-gradient(circle at center, rgba(255,255,255,.06), rgba(255,255,255,0) 55%),
        radial-gradient(circle at 10% 10%, rgba(34,211,238,.10), rgba(0,0,0,0) 60%),
        radial-gradient(circle at 90% 90%, rgba(167,139,250,.10), rgba(0,0,0,0) 60%);
      mix-blend-mode: screen;
    `;
    DOC.body.appendChild(el);
    return el;
  }

  function fxPop(ms){
    const el = ensureFxLayer();
    el.style.opacity = '1';
    root.setTimeout(()=> el.style.opacity = '0', Math.max(80, ms||140));
  }

  // --- mini urgent (<=3s) extra vibe ---
  let urgentPulseTimer = 0;
  function setMiniUrgent(on){
    DOC.body.classList.toggle('mini-urgent', !!on);
    if (on && !urgentPulseTimer){
      urgentPulseTimer = root.setInterval(()=>{
        // micro shake
        addShake(3.6, 140);
        fxPop(90);
      }, 520);
    }
    if (!on && urgentPulseTimer){
      root.clearInterval(urgentPulseTimer);
      urgentPulseTimer = 0;
    }
  }

  // --- clutch (<=10s) heartbeat ---
  let clutchTimer = 0;
  function setClutch(on){
    DOC.body.classList.toggle('clutch', !!on);
    if (on && !clutchTimer){
      clutchTimer = root.setInterval(()=>{
        if (isCVR()){
          addShake(2.2, 120);
        }else{
          addShake(3.8, 160);
        }
        fxPop(110);
      }, 900);
    }
    if (!on && clutchTimer){
      root.clearInterval(clutchTimer);
      clutchTimer = 0;
    }
  }

  // --- storm urgent pulse (last ~3s in engine adds class groups-storm-urgent already)
  let stormTimer = 0;
  function setStorm(on){
    DOC.body.classList.toggle('groups-storm', !!on);
    if (on && !stormTimer){
      stormTimer = root.setInterval(()=>{
        fxPop(120);
      }, 800);
    }
    if (!on && stormTimer){
      root.clearInterval(stormTimer);
      stormTimer = 0;
    }
  }

  // Listen events
  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};
    const tLeft = Number(d.miniTimeLeftSec||0);
    setMiniUrgent(tLeft > 0 && tLeft <= 3);
  }, { passive:true });

  root.addEventListener('hha:time', (ev)=>{
    const d = ev.detail||{};
    const left = Number(d.left||0);
    setClutch(left > 0 && left <= 10);
  }, { passive:true });

  root.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail||{};
    const kind = String(d.kind||'').toLowerCase();
    if (kind === 'storm_on') setStorm(true);
    if (kind === 'storm_off') setStorm(false);

    // optional: perfect switch pop
    if (kind === 'perfect_switch'){
      fxPop(140);
      addShake(2.6, 140);
    }
  }, { passive:true });

  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();

    // Use gentle feedback
    if (k === 'good'){
      fxPop(90);
    }else if (k === 'bad'){
      flash('fx-bad', 120);
      addShake(4.6, 160);
      fxPop(120);
    }else if (k === 'miss'){
      flash('fx-miss', 120);
      addShake(3.8, 150);
    }else if (k === 'boss'){
      flash('fx-boss', 140);
      addShake(5.2, 200);
      fxPop(140);
    }
  }, { passive:true });

  root.addEventListener('hha:end', ()=>{
    setMiniUrgent(false);
    setClutch(false);
    setStorm(false);
  }, { passive:true });

  // Add tiny CSS for flashes (injected)
  (function inject(){
    if (DOC.getElementById('groupsFxStyle')) return;
    const st = DOC.createElement('style');
    st.id = 'groupsFxStyle';
    st.textContent = `
      body.fx-bad .vignette{ opacity:.82 !important; }
      body.fx-miss .vignette{ opacity:.78 !important; }
      body.fx-boss .vignette{ opacity:.86 !important; }
    `;
    DOC.head.appendChild(st);
  })();

  // expose (optional)
  root.GroupsVR = root.GroupsVR || {};
  root.GroupsVR.FX = { addShake };

})(typeof window!=='undefined' ? window : globalThis);