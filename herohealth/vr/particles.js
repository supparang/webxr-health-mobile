// === /herohealth/vr/particles.js ===
// Simple FX layer: score pop + judgment text + burst (ใช้ได้ทุกเกม HeroHealth)
// รองรับทั้งเรียกตรงผ่าน window.Particles และยิง event 'hha:hit-ui' / 'hha:miss-ui'

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

  // ----- เป้าแตกกระจาย -----
  function burstAt(x, y, opts) {
    opts = opts || {};
    const layer = ensureLayer();
    const color = opts.color || '#22c55e';
    const count = (typeof opts.count === 'number' && opts.count > 0) ? opts.count : 14;

    for (let i = 0; i < count; i++) {
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
        boxShadow: '0 0 12px rgba(0,0,0,0.9)',
        opacity: '1',
        pointerEvents: 'none',
        transform: 'translate(0,0) scale(1)',
        transition: 'transform 0.5s ease-out, opacity 0.5s ease-out'
      });

      layer.appendChild(dot);

      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 40;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      requestAnimationFrame(function () {
        const scale = 0.6 + Math.random() * 0.4;
        dot.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')';
        dot.style.opacity = '0';
      });

      setTimeout(function () {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, 520);
    }
  }

  // ===== ฟัง event จาก GameEngine (เอา effect เป้ากลับมา) =====
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

    burstAt(x, y, {
      color: good ? '#22c55e' : '#f97316',
      count: good ? 18 : 12
    });

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
      count: 10
    });

    scorePop(x, y, 'MISS', {
      judgment: d.judgment || '',
      good: false
    });
  }

  // ลงทะเบียน listener (ถ้า GameEngine ยิง event เดิมอยู่ จะเห็น effect ทันที)
  root.addEventListener('hha:hit-ui', onHitUi);
  root.addEventListener('hha:miss-ui', onMissUi);

  // ===== Export API แบบ global =====
  const api = { scorePop: scorePop, burstAt: burstAt };
  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;
})(window);