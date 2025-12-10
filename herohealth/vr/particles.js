// === /herohealth/vr/particles.js ===
// Simple FX layer: score pop + judgment text + burst (upgraded, reusable for all games)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // ---------- FX Layer ----------
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

  function clamp(v, min, max) {
    v = Number(v);
    if (isNaN(v)) v = min;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  // ---------- Score Pop (คะแนน + ข้อความตัดสิน) ----------
  /**
   * scorePop(x, y, value, opts)
   *  - value: ข้อความหลัก (เช่น "+50", "MISS", "Goal 1 สำเร็จ!")
   *  - opts.good (bool): true = เขียว, false = ส้ม/แดง
   *  - opts.judgment: ข้อความด้านล่าง เช่น "PERFECT", "GOOD", "MISS"
   *  - opts.kind: 'score' | 'judge' | 'both'
   *  - opts.duration: ms (ดีฟอลต์ 500)
   */
  function scorePop(x, y, value, opts) {
    const layer = ensureLayer();
    opts = opts || {};

    const good = !!opts.good;
    const judgment = (opts.judgment || '').toString();
    const kind = (opts.kind || 'both').toLowerCase();
    const duration = clamp(opts.duration != null ? opts.duration : 500, 300, 1500);

    const wrap = doc.createElement('div');
    wrap.className = 'hha-fx-score';

    const mainColor = good ? '#4ade80' : '#f97316';

    Object.assign(wrap.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      transform: 'translate(-50%, -50%) scale(0.9)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '18px',
      fontWeight: '700',
      color: mainColor,
      textShadow: '0 0 14px rgba(0,0,0,0.85)',
      padding: '4px 8px',
      borderRadius: '999px',
      background: 'rgba(15,23,42,0.95)',
      border: '1px solid rgba(148,163,184,0.35)',
      whiteSpace: 'nowrap',
      opacity: '1',
      transition:
        'transform ' + (duration / 1000) + 's ease-out,' +
        'opacity ' + (duration / 1000) + 's ease-out'
    });

    if (kind === 'score' || kind === 'both') {
      const lineMain = doc.createElement('div');
      lineMain.textContent = String(value || '');
      wrap.appendChild(lineMain);
    }

    if (judgment && (kind === 'judge' || kind === 'both')) {
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
      wrap.style.transform = 'translate(-50%, -90%) scale(1.0)';
      wrap.style.opacity = '0';
    });

    setTimeout(function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, duration + 80);
  }

  // ---------- Burst (อนุภาคแตกกระจาย) ----------
  /**
   * burstAt(x, y, opts)
   *  - opts.color: สีเม็ดอนุภาค
   *  - opts.count: จำนวนอนุภาค (ดีฟอลต์ 10)
   *  - opts.radius: ระยะกระจาย (ดีฟอลต์ 60)
   *  - opts.duration: ms (ดีฟอลต์ 500)
   *  - opts.sizeMin, opts.sizeMax: ขนาด pixel
   */
  function burstAt(x, y, opts) {
    const layer = ensureLayer();
    opts = opts || {};

    const color = opts.color || '#22c55e';
    const n = clamp(opts.count != null ? opts.count : 10, 4, 40);
    const radius = clamp(opts.radius != null ? opts.radius : 60, 20, 160);
    const duration = clamp(opts.duration != null ? opts.duration : 500, 250, 1500);
    const sizeMin = clamp(opts.sizeMin != null ? opts.sizeMin : 4, 2, 20);
    const sizeMax = clamp(opts.sizeMax != null ? opts.sizeMax : 8, sizeMin, 26);

    for (let i = 0; i < n; i++) {
      const dot = doc.createElement('div');
      dot.className = 'hha-fx-dot';
      const size = sizeMin + Math.random() * (sizeMax - sizeMin);

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
        transform: 'translate(0,0)',
        transition:
          'transform ' + (duration / 1000) + 's ease-out,' +
          'opacity ' + (duration / 1000) + 's ease-out'
      });

      layer.appendChild(dot);

      const ang = Math.random() * Math.PI * 2;
      const dist = radius * (0.6 + Math.random() * 0.6);
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      requestAnimationFrame(function () {
        dot.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        dot.style.opacity = '0';
      });

      setTimeout(function () {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, duration + 50);
    }
  }

  // ---------- Export ----------
  const api = { scorePop: scorePop, burstAt: burstAt };
  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;
})(window);