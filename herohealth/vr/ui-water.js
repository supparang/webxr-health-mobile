// === /herohealth/vr/ui-water.js ===
// Water Gauge Helper — PRODUCTION (LATEST)
// ✅ ensureWaterGauge(): lazy bind DOM if present
// ✅ setWaterGauge(pct): set RAW pct 0..100 (engine drives this)
// ✅ Smooth display (no-stuck) + deadband tiny
// ✅ zoneFrom(pct): GREEN/WARN(LOW/HIGH) for Hydration
// ✅ Emits optional event: hha:water {raw, shown, zone}
// Notes: Designed to be called frequently (every frame OK)

(function(root){
  'use strict';

  const WIN = root || window;
  const DOC = WIN.document;
  if (!DOC) return;

  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // -------- Zone thresholds (kids-friendly) --------
  // ป.5: GREEN กว้างขึ้นนิด = เล่นสบาย ไม่หงุดหงิด
  // คุณสามารถปรับในอนาคตได้ด้วย window.HHA_WATER_CFG = { greenLo, greenHi, ... }
  const CFG = Object.assign({
    greenLo: 42,   // เดิมถ้าแคบไปจะหลุด GREEN ง่าย
    greenHi: 72,
    lowName: 'LOW',
    highName: 'HIGH',
    greenName: 'GREEN',

    // smoothing
    tauUpMs: 140,    // ขึ้นเร็ว (รู้สึก responsive)
    tauDownMs: 170,  // ลงนิ่มกว่าเล็กน้อย
    deadband: 0.35,  // กันสั่น แต่ไม่ทำให้ค้าง
    snapIfFar: 12,   // ถ้าต่างกันมาก ให้ snap เพื่อกัน “ตามไม่ทัน”
    maxStepPerTick: 8.0 // กันกระชาก (แต่ไม่ล็อค)
  }, WIN.HHA_WATER_CFG || {});

  // -------- DOM refs --------
  let bound = false;
  let elBar=null, elPct=null, elZone=null;

  // -------- state --------
  const S = {
    raw: 50,
    shown: 50,
    zone: CFG.greenName,
    lastAt: 0
  };

  function zoneFrom(pct){
    pct = clamp(pct,0,100);
    if (pct < CFG.greenLo) return CFG.lowName;
    if (pct > CFG.greenHi) return CFG.highName;
    return CFG.greenName;
  }

  function bind(){
    if (bound) return;
    elBar  = DOC.getElementById('water-bar');
    elPct  = DOC.getElementById('water-pct');
    elZone = DOC.getElementById('water-zone');
    bound = true;
  }

  function ensureWaterGauge(){
    bind();
    // no-op if elements missing (still keep logic)
    return { bar:elBar, pct:elPct, zone:elZone };
  }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function applyDOM(shown, zone){
    // Update width/text
    if (elBar) elBar.style.width = clamp(shown,0,100).toFixed(0) + '%';
    if (elPct) elPct.textContent = String(clamp(shown,0,100).toFixed(0));
    if (elZone) elZone.textContent = String(zone||'');
  }

  // dt-based smoothing (stable even if called every frame)
  function smoothStep(raw){
    const now = performance.now ? performance.now() : Date.now();
    const dtMs = S.lastAt ? clamp(now - S.lastAt, 8, 80) : 16;
    S.lastAt = now;

    raw = clamp(raw,0,100);

    const d = raw - S.shown;

    // deadband: if extremely small difference, just set to raw (prevents drift lock)
    if (Math.abs(d) <= CFG.deadband){
      S.shown = raw;
      return S.shown;
    }

    // if far away, snap (prevents "never catches up" feeling)
    if (Math.abs(d) >= CFG.snapIfFar){
      S.shown = raw;
      return S.shown;
    }

    // time constants
    const tau = (d > 0) ? CFG.tauUpMs : CFG.tauDownMs;
    const a = 1 - Math.exp(-dtMs / Math.max(40, tau));

    // step cap (avoid sudden jump yet keep moving)
    let step = d * a;
    step = clamp(step, -CFG.maxStepPerTick, CFG.maxStepPerTick);

    S.shown = clamp(S.shown + step, 0, 100);
    return S.shown;
  }

  function setWaterGauge(pct){
    bind();

    S.raw = clamp(pct,0,100);

    // smooth shown
    const shown = smoothStep(S.raw);

    // zone derived from RAW (important: gameplay logic uses raw zone, UI uses same)
    S.zone = zoneFrom(S.raw);

    // update DOM
    applyDOM(shown, S.zone);

    // optional event for debugging/telemetry
    emit('hha:water', { raw:S.raw, shown, zone:S.zone });

    return { raw:S.raw, shown, zone:S.zone };
  }

  // export for ESM import usage too (your hydration.safe.js imports these)
  // Support both classic script include and module import patterns.
  // If running as module, these exports may be ignored, but harmless.
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // Also expose via GAME_MODULES for consistency (optional)
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.WaterGauge = { ensureWaterGauge, setWaterGauge, zoneFrom };

  // If the page already has gauge DOM, bind now (safe)
  ensureWaterGauge();

  // ESM named exports compatibility: (ignored in non-module)
  // (We keep this file as classic script; hydration.safe.js imports from it as module path
  //  BUT your run html includes it with <script defer> too. That is OK because
  //  hydration.safe.js import will use module version if you have a separate ESM build.
})(typeof window !== 'undefined' ? window : globalThis);

// For ESM import in hydration.safe.js (if served as module file)
export function ensureWaterGauge(){ return window.ensureWaterGauge(); }
export function setWaterGauge(pct){ return window.setWaterGauge(pct); }
export function zoneFrom(pct){ return window.zoneFrom(pct); }