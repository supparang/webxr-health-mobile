// === /herohealth/vr/calibration.js ===
// HHA Calibration + Recenter Helper (Cardboard/cVR friendly)
// - Provides: window.HHA_CAL = { state, apply, recenter, bindUI, setEnabled }
// - Strategy: simple, robust
//   * Maintains yawOffset (for gyro) and dragOffset (for touch look)
//   * Emits: hha:recenter with offsets
// - Safe: does nothing if your game does not use it

'use strict';

(function (root) {
  const DOC = root.document;
  if (!DOC) return;

  const qs = (k, d = null) => { try { return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } };
  const clamp = (v, a, b) => { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); };

  const state = {
    enabled: true,
    view: String(qs('view', 'pc')).toLowerCase(),
    // offsets (your engine can use these)
    yawOffsetDeg: 0,    // apply against device yaw
    pitchOffsetDeg: 0,  // optional
    dragX: 0,           // px-based manual offset (if you use it)
    dragY: 0,
    // sampled orientation at last recenter
    lastYawDeg: 0,
    lastPitchDeg: 0,
    lastAt: 0
  };

  function isCardboard() {
    try { return DOC.body.classList.contains('cardboard'); } catch { return false; }
  }
  function isCVR() {
    try { return DOC.body.classList.contains('view-cvr'); } catch { return false; }
  }

  // --- Read basic device orientation (best-effort) ---
  // Many browsers provide absolute-ish alpha/beta/gamma. We'll use alpha as yaw.
  const ORI = { alpha: null, beta: null, gamma: null, at: 0 };
  function onOri(e){
    if (!state.enabled) return;
    ORI.alpha = (typeof e.alpha === 'number') ? e.alpha : ORI.alpha;
    ORI.beta  = (typeof e.beta  === 'number') ? e.beta  : ORI.beta;
    ORI.gamma = (typeof e.gamma === 'number') ? e.gamma : ORI.gamma;
    ORI.at = performance.now();
  }
  try { root.addEventListener('deviceorientation', onOri, { passive:true }); } catch {}

  function currentYawPitch(){
    // yaw: alpha (0..360), pitch: beta (-180..180)
    const yaw = (typeof ORI.alpha === 'number') ? ORI.alpha : 0;
    const pit = (typeof ORI.beta  === 'number') ? ORI.beta  : 0;
    return { yawDeg: yaw, pitchDeg: pit, ok: (typeof ORI.alpha === 'number') };
  }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // Call this from your game loop if you want (optional)
  function apply(){
    // returns offsets to be consumed by your look/aim system
    return {
      yawOffsetDeg: state.yawOffsetDeg,
      pitchOffsetDeg: state.pitchOffsetDeg,
      dragX: state.dragX,
      dragY: state.dragY
    };
  }

  function recenter(reason='user'){
    if (!state.enabled) return;
    const now = performance.now();
    if (now - state.lastAt < 220) return; // debounce
    state.lastAt = now;

    const { yawDeg, pitchDeg, ok } = currentYawPitch();
    state.lastYawDeg = yawDeg;
    state.lastPitchDeg = pitchDeg;

    // “recenter” means: make current yaw become zero reference
    // your engine should subtract yawOffsetDeg from yaw
    state.yawOffsetDeg = yawDeg;
    state.pitchOffsetDeg = pitchDeg;

    // also reset drag offsets (if any)
    state.dragX = 0;
    state.dragY = 0;

    emit('hha:recenter', {
      reason,
      ok,
      yawOffsetDeg: state.yawOffsetDeg,
      pitchOffsetDeg: state.pitchOffsetDeg,
      t: Date.now()
    });
  }

  function setEnabled(on){
    state.enabled = !!on;
  }

  // Optional UI binder: if vr-ui.js creates a RECENTER button, hook it too.
  function bindUI(opts={}){
    const sel = opts.btnSelector || '[data-hha-recenter], .hha-btn-recenter, #hhaRecenterBtn';
    const btn = DOC.querySelector(sel);
    if (btn){
      btn.addEventListener('click', ()=>recenter('ui'));
      btn.addEventListener('pointerdown', (e)=>{ try{ e.preventDefault(); }catch{} }, {passive:false});
    }
  }

  root.HHA_CAL = { state, apply, recenter, bindUI, setEnabled, isCardboard, isCVR };
})(window);