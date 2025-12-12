// === /herohealth/vr/particles.js ===
// Simple FX layer: score pop + judgment text + target burst (โคตรแตกกระจาย)
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

  // ----- คะแนนเด้ง + ข้อความตัดสิน (อยู่บรรทัดเดียวกัน) -----
  function scorePop(x, y, value, opts) {
    opts = opts || {};
    const layer = ensureLayer();
    const good = !!opts.good;
    const judgment = String(opts.judgment || '').toUpperCase();

    const wrap = doc.createElement('div');
    wrap.className = 'hha-fx-score';

    // ข้อความหลัก: "คะแนน คำตัดสิน" เช่น "+150 PERFECT"
    const parts = [];
    if (value !== undefined && value !== null && value !== '') {
      parts.push(String(value));
    }
    if (judgment) {
      parts.push(judgment);
    }
    wrap.textContent = parts.join(' ');

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
      transition: 'transform 0.45s ease-out, opacity 0.45s ease-out',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      letterSpacing: '.04em'
    });

    layer.appendChild(wrap);

    // trigger animation
    requestAnimationFrame(function () {
      wrap.style.transform = 'translate(-50%, -90%) scale(1.08)';
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

  // ----- helper เล็ก ๆ -----
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // ----- เป้าแตกกระจาย (หนักมาก) -----
  // opts: { color, good, count, radius }
  function burstAt(x, y, opts) {
    opts = opts || {};
    const layer = ensureLayer();
    const baseColor = opts.color || '#22c55e';
    const good = !!opts.good;

    // เพิ่มจำนวน/ระยะ ให้รู้สึกแตกแรงกว่าเดิม
    const baseCount  = (typeof opts.count === 'number' && opts.count > 0)
      ? opts.count
      : (good ? 26 : 18);
    const baseRadius = (typeof opts.radius === 'number' && opts.radius > 0)
      ? opts.radius
      : (good ? 90 : 70);

    // เศษหลัก + shard ยาวพุ่งออกไป
    for (let i = 0; i < baseCount; i++) {
      const ang = (i / baseCount) * Math.PI * 2 + rand(-0.3, 0.3);
      const distCore  = baseRadius * rand(0.45, 1.0);
      const distShard = baseRadius * rand(0.8, 1.4);

      // วงกลมสว่าง (core fragment)
      spawnFrag(layer, x, y, ang, distCore, {
        color: baseColor,
        sizeMin: 8,
        sizeMax: good ? 16 : 10,
        lifeMin: 520,
        lifeMax: 720,
        blur: 10,
        asShard: false
      });

      // shard ยาวแบบเส้นสปีด
      spawnFrag(layer, x, y, ang, distShard, {
        color: baseColor,
        sizeMin: 4,
        sizeMax: 7,
        lifeMin: 540,
        lifeMax: 760,
        blur: 4,
        asShard: true
      });
    }

    // วงแหวนกระแทก 2 ชั้น
    spawnRing(layer, x, y, baseColor, 52, 620, false);
    spawnRing(layer, x, y, baseColor, 80, 720, true);

    // flash ตรงกลาง “ตูม!” สั้น ๆ
    spawnFlash(layer, x, y, baseColor);
  }

  function spawnFrag(layer, x, y, ang, dist, cfg) {
    const el = doc.createElement('div');
    el.className = 'hha-fx-dot';

    const size = rand(cfg.sizeMin, cfg.sizeMax);
    const life = rand(cfg.lifeMin, cfg.lifeMax);

    const startLeft = x - size / 2;
    const startTop  = y - size / 2;
    el.style.position = 'absolute';
    el.style.left = startLeft + 'px';
    el.style.top  = startTop + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.borderRadius = '999px';
    el.style.opacity = '1';
    el.style.pointerEvents = 'none';
    el.style.boxShadow = '0 0 14px rgba(0,0,0,0.9)';
    el.style.filter = cfg.blur ? ('blur(' + cfg.blur + 'px)') : 'none';

    if (cfg.asShard) {
      el.style.background =
        'linear-gradient(90deg,' + cfg.color + ', rgba(15,23,42,0))';
    } else {
      el.style.background =
        'radial-gradient(circle,' + cfg.color + ', rgba(15,23,42,0))';
    }

    const baseScale = cfg.asShard ? rand(1.4, 1.9) : rand(1.0, 1.4);
    const angleDeg  = ang * 180 / Math.PI + (cfg.asShard ? rand(-18, 18) : rand(-35, 35));

    el.style.transform =
      'translate3d(0,0,0) scale(' + (baseScale * 0.5) + ') rotate(' + angleDeg + 'deg)';
    el.style.transition =
      'transform ' + life + 'ms cubic-bezier(0.18,0.88,0.3,1.2), ' +
      'opacity ' + life + 'ms ease-out';

    layer.appendChild(el);

    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist;

    requestAnimationFrame(function () {
      el.style.transform =
        'translate3d(' + dx + 'px,' + dy + 'px,0) ' +
        'scale(' + (cfg.asShard ? baseScale * 1.9 : baseScale * 1.4) + ') ' +
        'rotate(' + angleDeg + 'deg)';
      el.style.opacity = '0';
    });

    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, life + 80);
  }

  function spawnRing(layer, x, y, color, size, life, dashed) {
    const el = doc.createElement('div');
    el.className = 'hha-fx-ring';

    const s = size || 56;
    const L = life || 600;

    el.style.position = 'absolute';
    el.style.left = (x - s / 2) + 'px';
    el.style.top  = (y - s / 2) + 'px';
    el.style.width  = s + 'px';
    el.style.height = s + 'px';
    el.style.borderRadius = '999px';
    el.style.border = (dashed ? '2px dashed ' : '2px solid ') + color;
    el.style.boxShadow = '0 0 22px ' + color;
    el.style.background = 'transparent';
    el.style.opacity = '0.9';
    el.style.pointerEvents = 'none';
    el.style.transform = 'scale(0.4)';
    el.style.transition =
      'transform ' + L + 'ms ease-out, opacity ' + L + 'ms ease-out';

    layer.appendChild(el);

    requestAnimationFrame(function () {
      el.style.transform = 'scale(1.8)';
      el.style.opacity = '0';
    });

    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, L + 80);
  }

  function spawnFlash(layer, x, y, color) {
    const el = doc.createElement('div');
    el.className = 'hha-fx-flash';

    const s = 140;
    const L = 260;

    el.style.position = 'absolute';
    el.style.left = (x - s / 2) + 'px';
    el.style.top  = (y - s / 2) + 'px';
    el.style.width  = s + 'px';
    el.style.height = s + 'px';
    el.style.pointerEvents = 'none';
    el.style.borderRadius = '999px';
    el.style.background =
      'radial-gradient(circle, rgba(248,250,252,0.9), rgba(15,23,42,0))';
    el.style.boxShadow = '0 0 40px ' + color;
    el.style.opacity = '0';
    el.style.transform = 'scale(0.4)';
    el.style.transition =
      'transform ' + L + 'ms ease-out, opacity ' + L + 'ms ease-out';

    layer.appendChild(el);

    requestAnimationFrame(function () {
      el.style.opacity = '1';
      el.style.transform = 'scale(1.1)';
    });

    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'scale(1.4)';
    }, L - 80);

    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, L + 100);
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