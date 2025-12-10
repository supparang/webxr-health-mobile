// === /herohealth/vr/particles.js ===
// Shared FX layer — ใช้กับทุกเกม Hero Health
// - scorePop(x, y, value, opts)
// - burstAt(x, y, opts)
// รองรับทั้ง DOM / VR games (GoodJunk, Hydration, Plate, Fitness ฯลฯ)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // ---------- สร้างเลเยอร์ FX กลาง ----------
  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      Object.assign(layer.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        zIndex: 700,
        overflow: 'hidden'
      });
      doc.body.appendChild(layer);
    }
    return layer;
  }

  // ---------- helper: เลือกสีตาม judgment / good ----------
  function resolveColor(opts) {
    const { color, good, judgment } = opts;
    if (color) return color;

    const j = String(judgment || '').toUpperCase();

    if (j === 'PERFECT') return '#4ade80';
    if (j === 'GOOD')    return '#22c55e';
    if (j === 'FEVER')   return '#facc15';
    if (j === 'BONUS')   return '#facc15';
    if (j === 'BLOCK')   return '#60a5fa';
    if (j === 'MISS' || j === 'LATE') return '#f97316';

    return good ? '#4ade80' : '#e5e7eb';
  }

  // ---------- ข้อความคะแนน + judgment ----------
  // ใช้ได้ 3 โหมด (ผ่าน opts.kind):
  //  - kind: 'score' (default)  → แสดงคะแนน และถ้ามี judgment จะเป็นบรรทัดล่าง
  //  - kind: 'judge'           → แสดงคำตัดสินคำเดียว (PERFECT, MISS ฯลฯ) ตัวใหญ่
  //  - kind: 'both'            → บรรทัดบน = value, บรรทัดล่าง = judgment
  function scorePop(x, y, value, opts = {}) {
    const layer = ensureLayer();
    const good = !!opts.good;
    const kind = opts.kind || 'score'; // 'score' | 'judge' | 'both'
    let judgment = String(opts.judgment || '').toUpperCase();

    const duration = (typeof opts.duration === 'number' ? opts.duration : 500);
    const offsetY  = (typeof opts.offsetY  === 'number' ? opts.offsetY  : 0);
    const color    = resolveColor({ color: opts.color, good, judgment });

    const wrap = doc.createElement('div');
    wrap.className = 'hha-fx-score';

    Object.assign(wrap.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      transform: `translate(-50%, calc(-50% + ${offsetY}px))`,
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '18px',
      fontWeight: '700',
      color,
      textShadow: '0 0 14px rgba(0,0,0,0.85)',
      padding: '4px 8px',
      borderRadius: '999px',
      background: 'rgba(15,23,42,0.95)',
      border: '1px solid rgba(148,163,184,0.35)',
      whiteSpace: 'nowrap',
      opacity: '1',
      transition: `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`
    });

    const hasValue = value !== undefined && value !== null && String(value) !== '';
    let showMain   = hasValue;
    let showJudge  = !!judgment;

    // ถ้าเป็นโหมด judge และ value ว่าง หรือ value == judgment → แสดงคำเดียวตัวใหญ่
    if (kind === 'judge' && showJudge && (!hasValue || String(value).toUpperCase() === judgment)) {
      showMain = true;
      showJudge = false;
      value = judgment;
      // ตัวเดียว แต่ขยายฟอนต์หน่อย
      wrap.style.fontSize = '20px';
      wrap.style.fontWeight = '800';
    }

    // บรรทัดบน
    if (showMain) {
      const lineMain = doc.createElement('div');
      lineMain.textContent = String(value);
      wrap.appendChild(lineMain);
    }

    // บรรทัดล่าง = GOOD / PERFECT / MISS / FEVER ฯลฯ
    if (showJudge && (kind === 'score' || kind === 'both')) {
      const lineJudge = doc.createElement('div');
      lineJudge.textContent = judgment;
      lineJudge.style.fontSize = '11px';
      lineJudge.style.marginTop = '1px';
      lineJudge.style.letterSpacing = '.12em';
      lineJudge.style.textTransform = 'uppercase';
      lineJudge.style.opacity = '0.9';
      wrap.appendChild(lineJudge);
    }

    layer.appendChild(wrap);

    // trigger animation
    requestAnimationFrame(() => {
      // ลอยขึ้นเล็กน้อยแล้วหาย
      wrap.style.transform = `translate(-50%, calc(-90% + ${offsetY}px))`;
      wrap.style.opacity = '0';
    });

    setTimeout(() => {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, duration + 40);
  }

  // ---------- Burst เม็ด ๆ รอบเป้า ----------
  // opts:
  //  - color  : สี (default เขียว)
  //  - count  : จำนวนเม็ด (default 10)
  //  - radius : รัศมี (default 40)
  //  - duration: ms (default 520)
  function burstAt(x, y, opts = {}) {
    const layer   = ensureLayer();
    const color   = opts.color || '#22c55e';
    const n       = Number.isFinite(opts.count)   ? opts.count   : 10;
    const radius  = Number.isFinite(opts.radius)  ? opts.radius  : 40;
    const dur     = Number.isFinite(opts.duration)? opts.duration: 520;

    for (let i = 0; i < n; i++) {
      const dot = doc.createElement('div');
      dot.className = 'hha-fx-dot';
      const size = 4 + Math.random() * 4;

      Object.assign(dot.style, {
        position: 'absolute',
        left: x + 'px',
        top: y + 'px',
        width: size + 'px',
        height: size + 'px',
        borderRadius: '999px',
        background: color,
        boxShadow: '0 0 10px rgba(0,0,0,0.9)',
        opacity: '1',
        pointerEvents: 'none',
        transition: `transform ${dur}ms ease-out, opacity ${dur}ms ease-out`
      });

      layer.appendChild(dot);

      const ang = Math.random() * Math.PI * 2;
      const dist = radius + Math.random() * radius;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      requestAnimationFrame(() => {
        dot.style.transform = `translate(${dx}px, ${dy}px)`;
        dot.style.opacity = '0';
      });

      setTimeout(() => {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, dur + 20);
    }
  }

  const api = { scorePop, burstAt };
  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;
})(window);