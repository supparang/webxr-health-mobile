// === /herohealth/vr/ui-fever.js ===
// FEVER Gauge + Shield (Global HUD API for HeroHealth)
// รองรับ Hydration/GoodJunk/Plate/Groups ฯลฯ
// - bind ได้ทั้ง id แบบใหม่ (#hha-fever-*) และแบบเก่า (#fever-fill)
// - export API มาตรฐาน: ensureFeverBar, setFever, setFeverActive, setShield
// - คง API เก่า: add/reset/isActive/getValue (เผื่อไฟล์อื่นเรียกอยู่)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // ----- state -----
  const FEVER_MAX = 100;
  let fever = 0;
  let feverActive = false;
  let shield = 0;

  function clamp(v, min, max) {
    v = Number(v) || 0;
    return v < min ? min : (v > max ? max : v);
  }

  // ----- resolve elements (รองรับหลายหน้า) -----
  function getFillEl() {
    return (
      doc.getElementById('hha-fever-fill') ||
      doc.getElementById('fever-fill') ||
      doc.querySelector('.hha-fever-bar-inner') ||
      doc.querySelector('.fever-bar-fill') ||
      null
    );
  }

  function getPercentEl() {
    return (
      doc.getElementById('hha-fever-percent') ||
      doc.getElementById('fever-percent') ||
      null
    );
  }

  function getShieldEl() {
    return (
      doc.getElementById('hha-shield-count') ||
      doc.getElementById('shield-count') ||
      null
    );
  }

  // ----- ensure -----
  function ensureFeverBar() {
    // ถ้าหน้ามีอยู่แล้ว (Hydration layout) ก็แค่ bind
    let fill = getFillEl();
    if (fill) return fill;

    // fallback: สร้าง widget เล็ก ๆ ถ้าหน้าไม่มี fever bar เลย
    const wrap = doc.createElement('div');
    wrap.id = 'hha-fever-fallback';
    Object.assign(wrap.style, {
      position: 'fixed',
      left: '12px',
      bottom: '12px',
      width: '180px',
      padding: '10px',
      borderRadius: '14px',
      background: 'rgba(2,6,23,0.9)',
      border: '1px solid rgba(148,163,184,0.35)',
      zIndex: 9999,
      color: '#e5e7eb',
      fontFamily: 'system-ui,Segoe UI,sans-serif',
      fontSize: '12px'
    });

    const label = doc.createElement('div');
    label.textContent = '🔥 FEVER';
    label.style.marginBottom = '6px';

    const bar = doc.createElement('div');
    Object.assign(bar.style, {
      height: '8px',
      borderRadius: '999px',
      background: 'rgba(15,23,42,0.95)',
      overflow: 'hidden'
    });

    const inner = doc.createElement('div');
    inner.id = 'fever-fill';
    Object.assign(inner.style, {
      height: '100%',
      width: '0%',
      borderRadius: '999px',
      background: 'linear-gradient(90deg,#f97316,#fb923c,#facc15)',
      transition: 'width .2s ease-out'
    });

    bar.appendChild(inner);
    wrap.appendChild(label);
    wrap.appendChild(bar);
    doc.body.appendChild(wrap);

    return inner;
  }

  function applyUI() {
    const fill = getFillEl();
    if (fill) fill.style.width = clamp(fever, 0, FEVER_MAX) + '%';

    const pct = getPercentEl();
    if (pct) pct.textContent = clamp(fever, 0, FEVER_MAX).toFixed(0) + '%';

    const sh = getShieldEl();
    if (sh) sh.textContent = String(shield | 0);

    // ส่งสถานะให้ระบบอื่น (HUD/FX/Logger)
    try {
      root.dispatchEvent(new CustomEvent('hha:fever', {
        detail: {
          state: feverActive ? 'change' : 'change',
          value: fever,
          active: feverActive,
          shield
        }
      }));
    } catch {}
  }

  // ----- public API มาตรฐาน (ที่ hydration.safe.js เรียก) -----
  function setFever(v) {
    fever = clamp(v, 0, FEVER_MAX);
    applyUI();
  }

  function setFeverActive(on) {
    feverActive = !!on;
    if (feverActive && fever <= 0) fever = FEVER_MAX; // เผื่อเรียก active ก่อน set
    if (!feverActive && fever > 0 && fever >= FEVER_MAX) {
      // ปล่อยไว้ได้ แต่โดยปกติเกมจะ setFever(0) เองตอนจบ
    }

    try {
      root.dispatchEvent(new CustomEvent('hha:fever', {
        detail: { state: feverActive ? 'start' : 'end', value: fever, active: feverActive, shield }
      }));
    } catch {}

    applyUI();
  }

  function setShield(v) {
    shield = clamp(v, 0, 999) | 0;
    applyUI();
  }

  // ----- backward-compatible API เดิม -----
  function add(v) {
    if (feverActive) return;
    setFever(fever + (Number(v) || 0));
    if (fever >= FEVER_MAX) setFeverActive(true);
  }

  function reset() {
    fever = 0;
    feverActive = false;
    shield = 0;
    applyUI();
  }

  function isActive() { return !!feverActive; }
  function getValue() { return fever; }

  // init bind
  ensureFeverBar();
  applyUI();

  // expose
  const api = {
    ensureFeverBar,
    setFever,
    setFeverActive,
    setShield,
    add,
    reset,
    isActive,
    getValue
  };

  root.FeverUI = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = api;

})(window);
