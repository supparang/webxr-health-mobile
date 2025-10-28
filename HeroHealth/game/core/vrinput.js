// === Hero Health Academy — core/vrinput.js ===
// WebXR toggle (ถ้ามี), Gaze cursor (DOM center raycast) + Dwell timer (config ได้)
// ใช้ได้ทั้ง PC/Mobile/VR โดยไม่พึ่ง framework อื่น

const LS = {
  get(key, def){ try{ const v = localStorage.getItem(key); return v==null?def:JSON.parse(v); }catch{ return def; } },
  set(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch{} },
};

let _engine = null;
let _sfx = null;

// ---- Gaze mode (DOM center) ----
let _gaze = {
  on: false,
  dwellMs:  LS.get('hha_gaze_ms', 750),
  lastEl: null,
  startAt: 0,
  rafId: 0,
  reticle: null,
};

function ensureReticle(){
  if (_gaze.reticle && document.body.contains(_gaze.reticle)) return;
  const r = document.createElement('div');
  r.id = 'hhaReticle';
  r.style.cssText = `
    position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
    width:22px;height:22px;border-radius:999px;border:2px solid #cfe9ff;opacity:.9;
    box-shadow:0 0 12px rgba(95,170,255,.6); pointer-events:none; z-index:12000;
  `;
  const fill = document.createElement('div');
  fill.style.cssText = `
    position:absolute;inset:3px;border-radius:999px; background:rgba(127,255,212,.2);
    transform: scale(0); transition: transform .08s linear;
  `;
  r.appendChild(fill);
  document.body.appendChild(r);
  _gaze.reticle = r;
  _gaze._fill = fill;
}

function setReticleProgress(pct){
  if (!_gaze._fill) return;
  const s = Math.max(0.01, Math.min(1, pct));
  _gaze._fill.style.transform = `scale(${s})`;
}

function isClickable(el){
  if (!el) return false;
  if (el.closest('[data-action]') || el.closest('[data-result]') || el.closest('[data-modal-open]') || el.closest('[data-modal-close]')) return true;
  if (el.classList && el.classList.contains('item')) return true;
  if (el.tagName === 'BUTTON') return true;
  return false;
}

function gazeLoop(){
  if (!_gaze.on) return;
  const cx = Math.floor(innerWidth/2), cy = Math.floor(innerHeight/2);
  const el = document.elementFromPoint(cx, cy);

  if (el !== _gaze.lastEl){
    _gaze.lastEl = el;
    _gaze.startAt = performance.now();
    setReticleProgress(0);
  }else{
    if (isClickable(el)){
      const t = performance.now() - _gaze.startAt;
      const pct = t / _gaze.dwellMs;
      setReticleProgress(pct);
      if (t >= _gaze.dwellMs){
        // trigger click once
        try{
          el.dispatchEvent(new Event('click', {bubbles:true}));
          if (_sfx) _sfx.play?.('sfx-good');
          navigator.vibrate?.(10);
        }catch{}
        _gaze.startAt = performance.now(); // reset for repeat
        setReticleProgress(0);
      }
    }else{
      setReticleProgress(0);
    }
  }
  _gaze.rafId = requestAnimationFrame(gazeLoop);
}

// ---- WebXR helpers (safe fallbacks) ----
let _inXR = false;
async function toggleVR(){
  try{
    // ถ้า engine รองรับ renderer.xr ก็เรียกของ three ได้
    if (_engine?.renderer?.xr){
      if (_inXR){
        await _engine.renderer.xr.getSession()?.end();
        _inXR = false;
      }else{
        const navxr = navigator.xr;
        if (navxr?.isSessionSupported){
          const ok = await navxr.isSessionSupported('immersive-vr');
          if (!ok) throw new Error('immersive-vr not supported');
        }
        const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures:['local-floor','bounded-floor'] });
        _engine.renderer.xr.setSession(session);
        _inXR = true;
      }
      return;
    }
    // ถ้าไม่มี XR จริง ให้สลับเป็นโหมด GAZE (จำลอง)
    setGazeMode(!_gaze.on);
  }catch(e){
    console.warn('[VRInput] toggleVR fallback to Gaze:', e);
    setGazeMode(!_gaze.on);
  }
}

function setGazeMode(on){
  _gaze.on = !!on;
  if (_gaze.on){
    ensureReticle();
    cancelAnimationFrame(_gaze.rafId);
    gazeLoop();
  }else{
    cancelAnimationFrame(_gaze.rafId);
    _gaze.rafId = 0;
    try{ _gaze.reticle?.remove(); }catch{}
    _gaze.reticle = null; _gaze._fill = null;
  }
}

export const VRInput = {
  init({engine, sfx}){
    _engine = engine||null; _sfx = sfx||null;
    // โหลด dwell config
    const ms = Number(LS.get('hha_gaze_ms', 750))||750;
    _gaze.dwellMs = ms;
    // ปุ่มปรับ dwell ผ่าน console:
    // localStorage.setItem('hha_gaze_ms', '650'); location.reload();
  },
  toggleVR,
  isXRActive(){ return !!_inXR; },
  isGazeMode(){ return !!_gaze.on; },
  setGaze(on){ setGazeMode(on); },
  setDwell(ms){ _gaze.dwellMs = Math.max(300, Math.min(2000, Number(ms)||750)); LS.set('hha_gaze_ms', _gaze.dwellMs); }
};
