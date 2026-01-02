// === /herohealth/vr/calibration.js ===
// HHA Calibration/Recenter Helper (Universal)
// - Cardboard & cVR: quick calibration overlay (tap to confirm neutral)
// - Emits: hha:recenter, hha:calibrated
// - Adds CSS var --vrui-top to keep HUD away from VR UI area
// - Default: lightweight, safe for all games

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  function qs(k, def = null) {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function emit(name, detail) {
    try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  const view = String(qs('view', '') || '').toLowerCase();
  const run  = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const keyStore = 'HHA_CALIBRATION_V1';

  // ---- HUD safe zone for VR UI ----
  // (กัน HUD ไปทับ ENTER VR/EXIT/RECENTER ของ vr-ui.js)
  function applyVRSafeZone() {
    // If vr-ui exists, it usually renders buttons near top. Reserve space.
    // You can tune 64–84 depending on your vr-ui layout.
    const reservePx = (view === 'cardboard' || view === 'cvr') ? 76 : 0;
    DOC.documentElement.style.setProperty('--vrui-top', reservePx ? (reservePx + 'px') : '0px');
  }
  applyVRSafeZone();

  // ---- Minimal UI ----
  function makeOverlay() {
    const wrap = DOC.createElement('div');
    wrap.id = 'hha-calibration';
    wrap.style.cssText = `
      position:fixed; inset:0; z-index:130;
      display:flex; align-items:center; justify-content:center;
      padding: calc(16px + env(safe-area-inset-top,0px)) calc(16px + env(safe-area-inset-right,0px))
               calc(16px + env(safe-area-inset-bottom,0px)) calc(16px + env(safe-area-inset-left,0px));
      background: rgba(2,6,23,.76);
      backdrop-filter: blur(10px);
      color:#e5e7eb;
      font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
    `;

    const card = DOC.createElement('div');
    card.style.cssText = `
      width:min(860px,100%);
      border-radius:22px;
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.70);
      box-shadow: 0 24px 90px rgba(0,0,0,.55);
      padding:16px;
    `;

    const title = DOC.createElement('div');
    title.style.cssText = 'font-weight:900;font-size:16px;letter-spacing:.2px;margin-bottom:10px;';
    title.textContent = (view === 'cardboard')
      ? '🕶️ Cardboard Calibration'
      : '🎯 cVR Calibration (ยิงกลางจอ)';

    const sub = DOC.createElement('div');
    sub.style.cssText = 'opacity:.92;font-size:13px;line-height:1.35;white-space:pre-line;';
    sub.textContent =
      (view === 'cardboard')
        ? `1) ใส่โทรศัพท์เข้ากล่อง VR ให้ตรงกลาง\n2) หันมองตรง (ท่าที่สบาย)\n3) แตะปุ่ม “พร้อมเล่น” เพื่อรีเซ็นเตอร์`
        : `1) ถือเครื่องให้มั่นคง / อยู่โหมดเต็มจอ\n2) มองตรงให้ crosshair อยู่กลางเป้า\n3) แตะ “พร้อมเล่น” เพื่อรีเซ็นเตอร์`;

    const dotWrap = DOC.createElement('div');
    dotWrap.style.cssText = `
      margin:14px 0 10px;
      height:160px;
      border-radius:18px;
      border:1px solid rgba(148,163,184,.16);
      background: radial-gradient(circle at center, rgba(34,211,238,.13), transparent 55%),
                  rgba(15,23,42,.52);
      display:flex; align-items:center; justify-content:center;
      position:relative; overflow:hidden;
    `;

    const dot = DOC.createElement('div');
    dot.style.cssText = `
      width:18px;height:18px;border-radius:999px;
      border:2px solid rgba(229,231,235,.88);
      box-shadow: 0 10px 24px rgba(0,0,0,.45);
      position:relative;
    `;
    const inner = DOC.createElement('div');
    inner.style.cssText = `
      position:absolute; left:50%; top:50%;
      transform:translate(-50%,-50%);
      width:4px;height:4px;border-radius:999px;
      background: rgba(34,211,238,.95);
    `;
    dot.appendChild(inner);
    dotWrap.appendChild(dot);

    const row = DOC.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;';

    function btn(label, cls) {
      const b = DOC.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = `
        appearance:none; cursor:pointer; user-select:none;
        border-radius:14px; padding:10px 12px; font-weight:900; font-size:13px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(15,23,42,.62);
        color:#e5e7eb;
      `;
      if (cls === 'primary') {
        b.style.borderColor = 'rgba(34,197,94,.26)';
        b.style.background = 'rgba(34,197,94,.16)';
      }
      if (cls === 'cyan') {
        b.style.borderColor = 'rgba(34,211,238,.26)';
        b.style.background = 'rgba(34,211,238,.12)';
      }
      return b;
    }

    const bReady = btn('✅ พร้อมเล่น (Recenter)', 'primary');
    const bSkip  = btn('ข้าม (ไม่ตั้งศูนย์)', '');
    const bHelp  = btn('ℹ️ วิธีใช้', 'cyan');

    const tip = DOC.createElement('div');
    tip.style.cssText = 'margin-top:10px;font-size:12px;opacity:.88;line-height:1.35;white-space:pre-line;';
    tip.textContent =
      `ทิป: ถ้ารู้สึก “เพี้ยน/เอียง/เล็งไม่ตรง” ให้กด RECENTER อีกครั้ง\n(เกมจะฟัง event hha:recenter)`;

    row.appendChild(bReady);
    row.appendChild(bSkip);
    row.appendChild(bHelp);

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(dotWrap);
    card.appendChild(row);
    card.appendChild(tip);
    wrap.appendChild(card);

    function saveCalibrated(skipped) {
      try {
        const obj = {
          ts: Date.now(),
          iso: new Date().toISOString(),
          view,
          run,
          skipped: !!skipped
        };
        localStorage.setItem(keyStore, JSON.stringify(obj));
      } catch (_) {}
    }

    function close() {
      try { wrap.remove(); } catch (_) {}
    }

    bReady.addEventListener('click', () => {
      saveCalibrated(false);
      emit('hha:recenter', { source:'calibration', view, run });
      emit('hha:calibrated', { view, run });
      close();
    });

    bSkip.addEventListener('click', () => {
      saveCalibrated(true);
      emit('hha:calibrated', { view, run, skipped:true });
      close();
    });

    bHelp.addEventListener('click', () => {
      tip.textContent =
        (view === 'cardboard')
          ? `✅ ใส่โทรศัพท์ให้ตรงกลางกล่อง\n✅ หันมองตรงในท่าที่สบาย\n✅ กด “พร้อมเล่น” เพื่อ RECENTER\n\nถ้า HUD ไปทับปุ่ม VR → โมดูลนี้จะเว้นช่องให้ (safe-zone) ให้แล้ว`
          : `✅ cVR = ยิงจาก crosshair กลางจอ\n✅ กด “พร้อมเล่น” เพื่อรีเซ็นเตอร์\n\nถ้าเล็งไม่ตรง ให้กด RECENTER อีกครั้ง`;
    });

    return wrap;
  }

  // show overlay only for cardboard/cvr (and only once per session unless forced)
  function shouldShow() {
    if (!(view === 'cardboard' || view === 'cvr')) return false;
    // optional: allow forcing via ?cal=1
    const force = String(qs('cal','')||'');
    if (force === '1') return true;

    // show if never calibrated before OR last time was skip
    try {
      const raw = localStorage.getItem(keyStore);
      if (!raw) return true;
      const obj = JSON.parse(raw);
      if (obj && obj.skipped) return true;
      // If calibrated within 7 days, don't spam
      const age = Date.now() - Number(obj.ts||0);
      if (age > 7*24*3600*1000) return true;
      return false;
    } catch(_) {
      return true;
    }
  }

  function init() {
    // Global key shortcut: press "R" to recenter (desktop debugging)
    root.addEventListener('keydown', (ev) => {
      if (!ev) return;
      const k = String(ev.key||'').toLowerCase();
      if (k === 'r') emit('hha:recenter', { source:'key', view, run });
    });

    // If VR UI has its own recenter button, it should emit hha:recenter already.
    // This module just guarantees the event exists.

    if (shouldShow()) {
      DOC.body.appendChild(makeOverlay());
    }
  }

  // run after DOM ready
  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

})(window);