// === /herohealth/vr/ui-water.js ===
// HHA Water UI — PRODUCTION (LATEST)
// ✅ ensureWaterGauge(): สร้าง/หา DOM gauge (ถ้าเกมไม่ใช้ก็ไม่พัง)
// ✅ setWaterGauge(pct, opts?): ตั้งค่า waterPercent 0..100 (พร้อม smoothing)
// ✅ zoneFrom(pct): คืนค่า 'LOW'|'GREEN'|'HIGH'
// ✅ Works with existing HUD elements: #water-bar #water-pct #water-zone
//
// FIXES:
// 1) "Gauge ค้าง/ไม่ลดลงไปอีก" -> แก้ด้วย render loop ที่อัปเดตจริง + clamp + epsilon
// 2) "ขึ้นลงยากมาก" -> smoothing แบบปรับได้ + deadzone + maxStep ต่อเฟรม (ไม่หน่วง/ไม่ดื้อ)
//
// URL controls (optional):
//   ?wgSmooth=0.22        smoothing 0..1 (สูง=หน่วงมาก) default 0.18
//   ?wgMaxStep=8          max change per tick (%) default 10
//   ?wgDead=0.35          deadzone (%) default 0.25
//   ?kids=1               kids-friendly -> ลด smoothing, เพิ่ม maxStep นิดให้ "ตามมือ"
// ------------------------------------------------------------

(function(root){
  'use strict';

  const WIN = root;
  const DOC = WIN.document;
  if(!DOC) return;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function zoneFrom(pct){
    pct = clamp(pct, 0, 100);
    if (pct < 40) return 'LOW';
    if (pct > 70) return 'HIGH';
    return 'GREEN';
  }

  // ------- Internal gauge state -------
  const KIDS = (String(qs('kids','0')).toLowerCase() === '1' || String(qs('kids','0')).toLowerCase()==='true');

  const CFG = {
    // smoothing factor: closer to 1 => smoother/slow; closer to 0 => snappy
    smooth: clamp(parseFloat(qs('wgSmooth', KIDS ? 0.12 : 0.18)), 0.00, 0.60),
    // maximum step per tick (in %)
    maxStep: clamp(parseFloat(qs('wgMaxStep', KIDS ? 12 : 10)), 1, 30),
    // ignore tiny delta (percent)
    dead: clamp(parseFloat(qs('wgDead', KIDS ? 0.20 : 0.25)), 0.00, 2.0),
  };

  const UI = {
    mounted:false,
    // target value (truth from game)
    target: 50,
    // displayed value (smoothed)
    shown: 50,
    // DOM refs (optional)
    elWrap:null,
    elRing:null,
    elFill:null,
    elText:null,
    // HUD refs (existing in hydration-vr.html)
    hudBar:null,
    hudPct:null,
    hudZone:null,
  };

  function ensureWaterGauge(){
    // grab HUD refs if present
    UI.hudBar = DOC.getElementById('water-bar') || UI.hudBar;
    UI.hudPct = DOC.getElementById('water-pct') || UI.hudPct;
    UI.hudZone = DOC.getElementById('water-zone') || UI.hudZone;

    // If there's already a gauge in DOM, just bind it. If not, create a minimal ring gauge (hidden by default)
    let wrap = DOC.getElementById('hhaWaterGauge');

    if(!wrap){
      // Only create if caller wants; but safe to create lightweight hidden element
      wrap = DOC.createElement('div');
      wrap.id = 'hhaWaterGauge';
      wrap.style.cssText = `
        position: fixed;
        right: calc(12px + env(safe-area-inset-right,0px));
        bottom: calc(12px + env(safe-area-inset-bottom,0px));
        width: 74px; height: 74px;
        z-index: 70;
        pointer-events: none;
        display: none; /* default hidden — hydration uses HUD bar already */
      `;
      wrap.innerHTML = `
        <div class="hha-wg-ring" style="
          width:100%; height:100%;
          border-radius:999px;
          border:1px solid rgba(148,163,184,.18);
          background: rgba(2,6,23,.55);
          backdrop-filter: blur(10px);
          box-shadow: 0 16px 60px rgba(0,0,0,.35);
          display:grid; place-items:center;
          position:relative;
          overflow:hidden;
        ">
          <div class="hha-wg-fill" style="
            position:absolute; inset:auto 0 0 0;
            height:50%;
            background: linear-gradient(180deg, rgba(34,211,238,.0), rgba(34,197,94,.65));
            transform-origin: bottom;
            transition: none;
          "></div>
          <div class="hha-wg-text" style="
            position:relative;
            font: 900 14px/1 system-ui;
            color: rgba(229,231,235,.92);
            text-shadow: 0 2px 0 rgba(0,0,0,.35);
          ">50%</div>
        </div>
      `;
      DOC.body.appendChild(wrap);
    }

    UI.elWrap = wrap;
    UI.elRing = wrap.querySelector('.hha-wg-ring');
    UI.elFill = wrap.querySelector('.hha-wg-fill');
    UI.elText = wrap.querySelector('.hha-wg-text');

    if(!UI.mounted){
      UI.mounted = true;
      // start render loop once
      requestAnimationFrame(tick);
    }
    return wrap;
  }

  function setGaugeVisual(p){
    // HUD bar (primary)
    if (UI.hudBar) UI.hudBar.style.width = p.toFixed(0) + '%';
    if (UI.hudPct) UI.hudPct.textContent = String(p|0);
    if (UI.hudZone) UI.hudZone.textContent = zoneFrom(p);

    // Optional ring gauge if shown
    if (UI.elFill){
      UI.elFill.style.height = clamp(p,0,100).toFixed(2) + '%';
    }
    if (UI.elText){
      UI.elText.textContent = (p|0) + '%';
    }
  }

  // The key: smoothing that never "stalls"
  function approach(current, target){
    const d = target - current;
    const ad = Math.abs(d);

    // deadzone: ignore micro jitter
    if (ad <= CFG.dead) return target; // snap when small => prevents “ค้างคา” feel

    // smoothing factor (low-pass) + max step cap
    // step = min(maxStep, ad * (1 - smooth))
    const step = Math.min(CFG.maxStep, Math.max(0.6, ad * (1 - CFG.smooth)));

    return current + Math.sign(d) * step;
  }

  let lastRAF = 0;
  function tick(t){
    const dt = Math.min(0.05, Math.max(0.001, (t - (lastRAF||t))/1000));
    lastRAF = t;

    // In case caller forgets to call ensureWaterGauge again after DOM update
    if (!UI.hudBar) UI.hudBar = DOC.getElementById('water-bar') || UI.hudBar;
    if (!UI.hudPct) UI.hudPct = DOC.getElementById('water-pct') || UI.hudPct;
    if (!UI.hudZone) UI.hudZone = DOC.getElementById('water-zone') || UI.hudZone;

    // Smoothly move shown -> target
    UI.shown = clamp(UI.shown, 0, 100);
    UI.target = clamp(UI.target, 0, 100);

    // “ค้าง” มักเกิดจาก: ad เล็กแต่ไม่ถึง deadzone + smooth สูง + maxStep ต่ำ
    // approach() จัดการ: ถ้าใกล้แล้ว snap เข้าที่ target เลย
    const next = approach(UI.shown, UI.target);

    // epsilon clamp to avoid float never reaching target
    UI.shown = (Math.abs(next - UI.target) < 0.12) ? UI.target : next;

    setGaugeVisual(UI.shown);

    requestAnimationFrame(tick);
  }

  function setWaterGauge(pct, opts){
    // pct = truth from engine (hydration.safe.js calls this)
    pct = clamp(pct, 0, 100);

    // allow per-call override (rare)
    if (opts && typeof opts === 'object'){
      if (opts.snap === true){
        UI.target = pct;
        UI.shown = pct;
        setGaugeVisual(pct);
        return;
      }
      if (typeof opts.smooth === 'number') CFG.smooth = clamp(opts.smooth, 0, 0.60);
      if (typeof opts.maxStep === 'number') CFG.maxStep = clamp(opts.maxStep, 1, 30);
      if (typeof opts.dead === 'number') CFG.dead = clamp(opts.dead, 0, 2);
    }

    // ensure gauge exists
    ensureWaterGauge();

    // set target (render loop will animate)
    UI.target = pct;
  }

  // Export to window + modules namespace (เหมือน particles.js แนว HHA)
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.WaterUI = { ensureWaterGauge, setWaterGauge, zoneFrom };

})(window);