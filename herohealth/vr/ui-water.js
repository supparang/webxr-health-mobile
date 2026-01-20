// === /herohealth/vr/ui-water.js ===
// UI Water Gauge — PRODUCTION (LATEST)
// ✅ ensureWaterGauge(): เติม markup ถ้าไม่มี (optional)
// ✅ setWaterGauge(pct): อัปเดตแบบ "smooth" + กันค้าง/กัน NaN
// ✅ zoneFrom(pct): LOW/GREEN/HIGH (ใช้ร่วมกับเกม)
// ✅ Kids-friendly smoothing: ?kids=1 => นิ่ม/คุมง่ายขึ้น
// --------------------------------------------------------

(function(root){
  'use strict';
  const WIN = root || window;
  const DOC = WIN.document;
  if(!DOC) return;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>{ v = Number(v); if(!Number.isFinite(v)) v = 0; return v<a?a:(v>b?b:v); };

  const kidsQ = String(qs('kids','0')).toLowerCase();
  const KIDS = (kidsQ==='1' || kidsQ==='true' || kidsQ==='yes');

  // internal state (smooth animation)
  const W = {
    cur: 50,        // current rendered value
    target: 50,     // target value set by engine
    raf: 0,
    lastT: 0
  };

  // Zone thresholds (keep stable across all games)
  // NOTE: tweak here if you want wider GREEN for kids later
  function zoneFrom(pct){
    pct = clamp(pct, 0, 100);
    if (pct < 40) return 'LOW';
    if (pct > 70) return 'HIGH';
    return 'GREEN';
  }

  function ensureWaterGauge(){
    // If your RUN html already has these nodes, this does nothing.
    let bar = DOC.getElementById('water-bar');
    let pct = DOC.getElementById('water-pct');
    let zone = DOC.getElementById('water-zone');

    if (bar && pct && zone) return;

    // Try to mount minimal panel if missing (fallback only)
    let host = DOC.querySelector('.waterpanel') || DOC.getElementById('hud') || DOC.body;
    const wrap = DOC.createElement('div');
    wrap.className = 'waterpanel';
    wrap.style.cssText = 'position:fixed; right:12px; top:12px; z-index:80; pointer-events:none;';
    wrap.innerHTML = `
      <div class="water-head" style="display:flex;gap:10px;justify-content:space-between;align-items:baseline;">
        <div class="wtitle" style="font-weight:900;">Water</div>
        <div class="wzone" style="font-size:12px;opacity:.9;">Zone: <b id="water-zone">GREEN</b></div>
      </div>
      <div class="wbar" style="margin-top:8px;height:10px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.18);border:1px solid rgba(148,163,184,.10);">
        <div class="wfill" id="water-bar" style="height:100%;width:50%;border-radius:999px;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));"></div>
      </div>
      <div class="wpct" style="margin-top:6px;text-align:right;font-weight:900;font-size:12px;">
        <span id="water-pct">50</span>%
      </div>
    `;
    host.appendChild(wrap);
  }

  function applyToDOM(v){
    const bar = DOC.getElementById('water-bar');
    const pct = DOC.getElementById('water-pct');
    const zoneEl = DOC.getElementById('water-zone');

    const vv = clamp(v, 0, 100);
    const z = zoneFrom(vv);

    if (bar) bar.style.width = vv.toFixed(0) + '%';
    if (pct) pct.textContent = String(vv.toFixed(0));
    if (zoneEl) zoneEl.textContent = z;

    // Optional: body class hooks (for styling)
    try{
      DOC.body.classList.remove('zone-low','zone-green','zone-high');
      DOC.body.classList.add(
        z==='LOW' ? 'zone-low' : z==='HIGH' ? 'zone-high' : 'zone-green'
      );
    }catch(_){}
  }

  function tick(t){
    if (!W.lastT) W.lastT = t;
    const dt = Math.min(0.05, Math.max(0.001, (t - W.lastT)/1000));
    W.lastT = t;

    // Smooth factor:
    // - KIDS: นิ่มกว่า + ไปถึงเป้าเร็วพอ (ไม่หน่วง)
    // - NON-KIDS: เร็วขึ้นเล็กน้อย
    const k = KIDS ? 10.5 : 13.5; // higher = faster converge
    const alpha = 1 - Math.exp(-k * dt);

    // move current -> target
    W.cur = W.cur + (W.target - W.cur) * alpha;

    // Snap close enough to avoid "never reaches exactly" and prevent stuck feeling
    if (Math.abs(W.target - W.cur) < 0.15) W.cur = W.target;

    applyToDOM(W.cur);

    // continue if not settled
    if (Math.abs(W.target - W.cur) >= 0.05){
      W.raf = WIN.requestAnimationFrame(tick);
    } else {
      W.raf = 0;
      W.lastT = 0;
    }
  }

  function setWaterGauge(pct){
    // ✅ กัน bug “ไม่ลด/ค้าง”: รับได้ทั้ง number/string, clamp, กัน NaN
    const v = clamp(pct, 0, 100);

    // If called before DOM exists, just store value
    W.target = v;

    // First call: set cur immediately to avoid weird jump
    if (!Number.isFinite(W.cur)) W.cur = v;

    // If animation not running, start it
    if (!W.raf){
      // Slightly bias initial render to new target to feel responsive
      // (especially if updates are sparse)
      if (Math.abs(W.cur - v) > 8) W.cur = W.cur + Math.sign(v - W.cur) * 2.5;
      W.raf = WIN.requestAnimationFrame(tick);
    }
  }

  // expose (UMD-ish)
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // also export for module import compatibility (safe if ignored)
  try{
    WIN.GAME_MODULES = WIN.GAME_MODULES || {};
    WIN.GAME_MODULES.UIWater = { ensureWaterGauge, setWaterGauge, zoneFrom };
  }catch(_){}

})(typeof window !== 'undefined' ? window : globalThis);

// ESM named exports (for hydration.safe.js import)
// (If your environment ignores ESM in non-module, it’s fine.)
export function ensureWaterGauge(){ return window.ensureWaterGauge?.(); }
export function setWaterGauge(pct){ return window.setWaterGauge?.(pct); }
export function zoneFrom(pct){ return window.zoneFrom?.(pct); }