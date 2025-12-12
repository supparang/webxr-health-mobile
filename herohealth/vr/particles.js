// === /herohealth/vr/particles.js ===
// Simple FX layer: score pop + judgment text + target burst (แรงขึ้น)
// ใช้ได้กับทุกเกม HeroHealth (GoodJunkVR, Hydration, Plate, Groups ฯลฯ)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // ----- สร้างเลเยอร์ FX กลางจอ -----
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

  // ----- คะแนนเด้ง +ข้อความตัดสิน -----
  function scorePop(x, y, value, opts) {
    opts = opts || {};
    const layer = ensureLayer();
    const good = !!opts.good;
    const judgment = String(opts.judgment || '').toUpperCase();

    const wrap = doc.createElement('div');
    wrap.className = 'hha-fx-score';

    Object.assign(wrap.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      transform: 'translate(-50%, -50%) scale(0.9)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '18px',
      fontWeight: '700',
      color: good ? '#4ade80' : '#f97316',
      textShadow: '0 0 14px rgba(0,0,0,0.85)',
      padding: '4px 10px',
      borderRadius: '999px',
      background: 'rgba(15,23,42,0.95)',
      border: '1px solid rgba(148,163,184,0.35)',
      whiteSpace: 'nowrap',
      opacity: '0',
      transition: 'transform 0.45s ease-out, opacity 0.45s ease-out'
    });

    // บรรทัดบน = คะแนน
    const lineMain = doc.createElement('div');
    lineMain.textContent = String(value || '');
    wrap.appendChild(lineMain);

    // บรรทัดล่าง = GOOD / PERFECT / MISS ฯลฯ
    if (judgment) {
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
    requestAnimationFrame(function () {
      wrap.style.transform = 'translate(-50%, -90%) scale(1.05)';
      wrap.style.opacity = '1';
    });
    setTimeout(function () {
      wrap.style.transform = 'translate(-50%, -120%) scale(0.96)';
      wrap.style.opacity = '0';
    }, 260);

    setTimeout(function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 520);
  }

  // ----- เป้าแตกกระจาย (จุดกลม ๆ หลายจุดพุ่งออกไป) -----
  function burstAt(x, y, opts) {
    opts = opts || {};
    const layer = ensureLayer();
    const color = opts.color || '#22c55e';
    const good = !!opts.good;

    // เพิ่มจำนวนเยอะขึ้น ให้รู้สึก “แตกกระจาย”
    const n = (typeof opts.count === 'number' && opts.count > 0)
      ? opts.count
      : (good ? 24 : 16);

    for (let i = 0; i < n; i++) {
      const dot = doc.createElement('div');
      dot.className = 'hha-fx-dot';
      const size = good
        ? 6 + Math.random() * 6   // โดนดี → ใหญ่หน่อย
        : 4 + Math.random() * 4;  // พลาด → เล็กลงนิดนึง

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
        transform: 'translate(-50%, -50%) scale(0.7)',
        transition: 'transform 0.5s ease-out, opacity 0.5s ease-out'
      });

      layer.appendChild(dot);

      const ang = Math.random() * Math.PI * 2;
      const distBase = good ? 70 : 50;
      const dist = distBase + Math.random() * 40;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      requestAnimationFrame(function () {
        dot.style.transform =
          'translate(' + dx + 'px,' + dy + 'px) scale(0.9)';
        dot.style.opacity = '0';
      });

      setTimeout(function () {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, 520);
    }
  }

  // ----- auto ผูกกับ hha:judge ให้ทุกเกมใช้ได้เลย -----
  if (root && root.addEventListener) {
    root.addEventListener('hha:judge', function (e) {
      try {
        const d = e.detail || {};
        const label = String(d.label || '').toUpperCase();
        if (!label) return;

        const cx = root.innerWidth / 2;
        const cy = root.innerHeight * 0.5;

        let good = false;
        let color = '#f97316';

        if (label === 'GOOD' || label === 'PERFECT' || label === 'HIT') {
          good = true;
          color = '#22c55e';
        } else if (label === 'FEVER') {
          good = true;
          color = '#facc15';
        }

        burstAt(cx, cy, { color: color, good: good });
      } catch (err) {
        // กัน error เล็ก ๆ ไม่ให้พังเกม
        if (root.console && console.warn) {
          console.warn('[Particles] hha:judge handler error', err);
        }
      }
    });
  }

  // ----- Export API แบบ global -----
  const api = { scorePop, burstAt };
  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;
})(window);