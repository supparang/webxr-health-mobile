// === /herohealth/vr/particles.js ===
// FX layer กลางจอ: score pop + judgment + เป้าแตกกระจายอลังการ
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

    // บรรทัดล่าง = GOOD / PERFECT / MISS / FEVER ฯลฯ
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

  // ----- วงแหวนช็อคเวฟ -----
  function spawnRing(x, y, color) {
    const layer = ensureLayer();
    const ring = doc.createElement('div');
    ring.className = 'hha-fx-ring';

    const size = 40;
    Object.assign(ring.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      width: size + 'px',
      height: size + 'px',
      marginLeft: -(size / 2) + 'px',
      marginTop: -(size / 2) + 'px',
      borderRadius: '999px',
      border: '2px solid ' + (color || '#22c55e'),
      boxShadow: '0 0 16px rgba(0,0,0,0.8)',
      opacity: '0.9',
      transform: 'scale(0.2)',
      transition: 'transform 0.45s ease-out, opacity 0.45s ease-out'
    });

    layer.appendChild(ring);

    requestAnimationFrame(function () {
      ring.style.transform = 'scale(1.6)';
      ring.style.opacity = '0';
    });

    setTimeout(function () {
      if (ring.parentNode) ring.parentNode.removeChild(ring);
    }, 480);
  }

  // ----- เศษชิ้นส่วนเป้าแตก (shards) -----
  function spawnShards(x, y, opts) {
    opts = opts || {};
    const layer = ensureLayer();
    const baseColor = opts.color || '#22c55e';
    const n = (typeof opts.count === 'number' && opts.count > 0) ? opts.count : 16;
    const radiusBase = opts.radiusBase || 50;
    const radiusJitter = opts.radiusJitter || 40;

    for (let i = 0; i < n; i++) {
      const shard = doc.createElement('div');
      shard.className = 'hha-fx-shard';

      const w = 4 + Math.random() * 6;
      const h = 8 + Math.random() * 10;
      const ang = Math.random() * Math.PI * 2;
      const dist = radiusBase + Math.random() * radiusJitter;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const rot = (Math.random() * 140) - 70;

      const col = baseColor;

      Object.assign(shard.style, {
        position: 'absolute',
        left: x + 'px',
        top: y + 'px',
        width: w + 'px',
        height: h + 'px',
        borderRadius: '999px',
        background: col,
        boxShadow: '0 0 10px rgba(0,0,0,0.85)',
        opacity: '1',
        transformOrigin: 'center center',
        transform: 'translate(-50%, -50%) scale(0.6) rotate(0deg)',
        pointerEvents: 'none',
        transition: 'transform 0.5s ease-out, opacity 0.5s ease-out'
      });

      layer.appendChild(shard);

      requestAnimationFrame(function () {
        shard.style.transform =
          'translate(' + dx + 'px,' + dy + 'px) scale(1) rotate(' + rot + 'deg)';
        shard.style.opacity = '0';
      });

      setTimeout(function () {
        if (shard.parentNode) shard.parentNode.removeChild(shard);
      }, 520);
    }
  }

  // ----- เป้าแตกกระจายหลัก (ใช้ในทุกเกม) -----
  function burstAt(x, y, opts) {
    opts = opts || {};
    const good = !!opts.good;
    const color = opts.color || (good ? '#22c55e' : '#f97316');

    // 1) วงแหวนกลาง
    spawnRing(x, y, color);

    // 2) Shards รอบ ๆ
    spawnShards(x, y, {
      color: color,
      count: (typeof opts.count === 'number' && opts.count > 0) ? opts.count : (good ? 20 : 14),
      radiusBase: good ? 55 : 45,
      radiusJitter: good ? 45 : 35
    });
  }

  // ===== ฟัง event จาก GameEngine (hit / miss UI) =====
  function onHitUi(e) {
    const d = e.detail || {};
    const x = d.x;
    const y = d.y;
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const scoreDelta = (typeof d.scoreDelta === 'number' || typeof d.scoreDelta === 'string')
      ? d.scoreDelta
      : '';

    const judgment = d.judgment || '';
    const good = !!d.good;

    // เป้าแตกกระจาย
    burstAt(x, y, {
      color: good ? '#22c55e' : '#f97316',
      count: good ? 22 : 16,
      good: good
    });

    // คะแนนเด้ง + label
    scorePop(x, y, scoreDelta, {
      judgment: judgment,
      good: good
    });
  }

  function onMissUi(e) {
    const d = e.detail || {};
    const x = d.x;
    const y = d.y;
    if (typeof x !== 'number' || typeof y !== 'number') return;

    burstAt(x, y, {
      color: '#f97316',
      count: 14,
      good: false
    });

    scorePop(x, y, 'MISS', {
      judgment: d.judgment || '',
      good: false
    });
  }

  // ลงทะเบียน listener
  root.addEventListener('hha:hit-ui', onHitUi);
  root.addEventListener('hha:miss-ui', onMissUi);

  // ===== Export API แบบ global =====
  const api = {
    scorePop: scorePop,
    burstAt: burstAt
  };
  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;
})(window);