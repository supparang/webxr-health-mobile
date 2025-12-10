// === /herohealth/vr/particles.js ===
// Simple FX layer: score pop + judgment text + burst

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

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

  function scorePop(x, y, value, opts = {}) {
    const layer = ensureLayer();
    const good = !!opts.good;
    const judgment = String(opts.judgment || '').toUpperCase();

    const wrap = doc.createElement('div');
    wrap.className = 'hha-fx-score';

    Object.assign(wrap.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      transform: 'translate(-50%, -50%)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '18px',
      fontWeight: '700',
      color: good ? '#4ade80' : '#f97316',
      textShadow: '0 0 14px rgba(0,0,0,0.85)',
      padding: '4px 8px',
      borderRadius: '999px',
      background: 'rgba(15,23,42,0.95)',
      border: '1px solid rgba(148,163,184,0.35)',
      whiteSpace: 'nowrap',
      opacity: '1',
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
    requestAnimationFrame(() => {
      wrap.style.transform = 'translate(-50%, -90%)';
      wrap.style.opacity = '0';
    });

    setTimeout(() => {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 500);
  }

  function burstAt(x, y, opts = {}) {
    const layer = ensureLayer();
    const color = opts.color || '#22c55e';
    const n = 10;

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
        transition: 'transform 0.5s ease-out, opacity 0.5s ease-out'
      });

      layer.appendChild(dot);

      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 40;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      requestAnimationFrame(() => {
        dot.style.transform = `translate(${dx}px, ${dy}px)`;
        dot.style.opacity = '0';
      });

      setTimeout(() => {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, 520);
    }
  }

  const api = { scorePop, burstAt };
  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;
})(window);