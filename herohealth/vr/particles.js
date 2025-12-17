// === /herohealth/vr/particles.js ===
// Simple FX layer: score pop + judgment text + target burst
// + Celebration FX สำหรับ Quest (Goal / Mini / All Complete)
// ✅ PATCH v2: รองรับ hha:celebrate (type/kind) + all + judge fallback pos + กัน bind ซ้ำ

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // ✅ กัน bind ซ้ำ
  if (root.__HHA_PARTICLES_BOUND__) {
    root.GAME_MODULES = root.GAME_MODULES || {};
    root.GAME_MODULES.Particles = root.GAME_MODULES.Particles || root.Particles || {};
    return;
  }
  root.__HHA_PARTICLES_BOUND__ = true;

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

  function burstAt(x, y, opts) {
    opts = opts || {};
    const layer = ensureLayer();
    const color = opts.color || '#22c55e';
    const good = !!opts.good;

    const n =
      typeof opts.count === 'number' && opts.count > 0
        ? opts.count
        : good ? 32 : 20;

    for (let i = 0; i < n; i++) {
      const dot = doc.createElement('div');
      const size = good ? 7 + Math.random() * 7 : 5 + Math.random() * 5;

      Object.assign(dot.style, {
        position: 'absolute',
        left: x + 'px',
        top: y + 'px',
        width: size + 'px',
        height: size + 'px',
        borderRadius: '999px',
        background: color,
        boxShadow: '0 0 14px rgba(0,0,0,0.9)',
        opacity: '1',
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%) scale(0.9)',
        transition: 'transform 0.55s ease-out, opacity 0.55s ease-out'
      });

      layer.appendChild(dot);

      const ang = Math.random() * Math.PI * 2;
      const distBase = good ? 90 : 65;
      const dist = distBase + Math.random() * 50;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      requestAnimationFrame(function () {
        dot.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(0.98)';
        dot.style.opacity = '0';
      });

      setTimeout(function () {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, 580);
    }
  }

  function scorePop(x, y, value, opts) {
    opts = opts || {};
    const layer = ensureLayer();
    const good = !!opts.good;
    const judgment = String(opts.judgment || '').toUpperCase();

    const wrap = doc.createElement('div');
    const parts = [];
    if (value !== undefined && value !== null && value !== '') parts.push(String(value));
    if (judgment) parts.push(judgment);
    wrap.textContent = parts.join(' ');

    Object.assign(wrap.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      transform: 'translate(-50%, -50%) scale(0.9)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '20px',
      fontWeight: '800',
      color: good ? '#bbf7d0' : '#fed7aa',
      textShadow: '0 0 20px rgba(0,0,0,0.95)',
      padding: '4px 12px',
      borderRadius: '999px',
      background: 'rgba(15,23,42,0.98)',
      border: '1px solid rgba(148,163,184,0.5)',
      whiteSpace: 'nowrap',
      opacity: '0',
      transition: 'transform 0.45s ease-out, opacity 0.45s ease-out',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      letterSpacing: '.06em',
      textTransform: 'uppercase'
    });

    layer.appendChild(wrap);

    const burstColor = good ? '#22c55e' : '#f97316';
    burstAt(x, y, { color: burstColor, good: good });

    requestAnimationFrame(function () {
      wrap.style.transform = 'translate(-50%, -90%) scale(1.06)';
      wrap.style.opacity = '1';
    });
    setTimeout(function () {
      wrap.style.transform = 'translate(-50%, -135%) scale(0.98)';
      wrap.style.opacity = '0';
    }, 260);

    setTimeout(function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 520);
  }

  function celebrateQuestFX(kind, index, total, label) {
    ensureLayer();
    const cx = root.innerWidth / 2;
    const cy = root.innerHeight * 0.5;

    const k = String(kind || 'goal').toLowerCase();
    const color = (k === 'goal') ? '#22c55e' : '#38bdf8';
    const title = (k === 'goal')
      ? ('GOAL ' + (index || 1) + '/' + (total || 2))
      : ('MINI ' + (index || 1) + '/' + (total || 3));

    burstAt(cx, cy, { color: color, good: true, count: 32 });
    scorePop(cx, cy, 'MISSION CLEAR!', { judgment: title, good: true });

    if (label) {
      const layer = ensureLayer();
      const sub = doc.createElement('div');
      sub.textContent = String(label);
      Object.assign(sub.style, {
        position: 'absolute',
        left: '50%',
        top: '60%',
        transform: 'translate(-50%, -50%)',
        padding: '6px 12px',
        borderRadius: '999px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '13px',
        fontWeight: '700',
        color: '#e5e7eb',
        background: 'rgba(2,6,23,0.88)',
        border: '1px solid rgba(148,163,184,0.35)',
        textShadow: '0 0 18px rgba(0,0,0,0.9)',
        opacity: '0',
        transition: 'opacity .25s ease-out, transform .25s ease-out',
        maxWidth: '78vw',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      });
      layer.appendChild(sub);
      requestAnimationFrame(function () {
        sub.style.opacity = '1';
        sub.style.transform = 'translate(-50%, -50%) translateY(-2px)';
      });
      setTimeout(function () {
        sub.style.opacity = '0';
        sub.style.transform = 'translate(-50%, -50%) translateY(-10px)';
      }, 520);
      setTimeout(function () {
        if (sub.parentNode) sub.parentNode.removeChild(sub);
      }, 820);
    }
  }

  function celebrateAllQuestsFX() {
    ensureLayer();
    const cx = root.innerWidth / 2;
    const cy = root.innerHeight * 0.32;

    ['#facc15', '#22c55e', '#38bdf8'].forEach(function (c, idx) {
      setTimeout(function () {
        burstAt(cx, cy, { color: c, good: true, count: 34 });
      }, idx * 220);
    });

    const layer = ensureLayer();
    const banner = doc.createElement('div');
    banner.textContent = 'ALL QUESTS CLEAR! 🌟';
    Object.assign(banner.style, {
      position: 'absolute',
      left: '50%',
      top: '30%',
      transform: 'translate(-50%, -50%) scale(0.88)',
      padding: '10px 18px',
      borderRadius: '999px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '18px',
      fontWeight: '800',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: '#fef3c7',
      background:
        'radial-gradient(circle at top left, rgba(250,250,250,0.18), transparent 55%), rgba(8,47,73,0.96)',
      border: '1px solid rgba(250,204,21,0.85)',
      textShadow: '0 0 22px rgba(0,0,0,0.9)',
      boxShadow: '0 22px 60px rgba(15,23,42,0.95)',
      opacity: '0',
      transition: 'opacity .4s ease-out, transform .4s ease-out'
    });
    layer.appendChild(banner);

    requestAnimationFrame(function () {
      banner.style.opacity = '1';
      banner.style.transform = 'translate(-50%, -50%) scale(1)';
    });
    setTimeout(function () {
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%, -50%) scale(0.94)';
    }, 1100);
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 1500);
  }

  // ===== Auto-bind events =====
  if (root && root.addEventListener) {
    // hha:judge → ถ้าไม่มีตำแหน่ง ให้เด้งกลางจอ (อย่างน้อยเห็นเอฟเฟกต์)
    root.addEventListener('hha:judge', function (e) {
      try {
        const d = e.detail || {};
        const label = String(d.label || '').toUpperCase();
        if (!label) return;

        const x = (typeof d.x === 'number') ? d.x : (root.innerWidth / 2);
        const y = (typeof d.y === 'number') ? d.y : (root.innerHeight * 0.52);

        let good = false;
        let color = '#f97316';
        if (label === 'GOOD' || label === 'PERFECT' || label === 'HIT' || label === 'PERFECT!') {
          good = true; color = '#22c55e';
        } else if (label === 'FEVER') {
          good = true; color = '#facc15';
        } else if (label === 'MISS' || label === 'OOPS!' || label === 'OOPS') {
          good = false; color = '#f97316';
        }

        burstAt(x, y, { color, good });
      } catch (err) {
        console.warn('[Particles] hha:judge handler error', err);
      }
    });

    // ของเดิม
    root.addEventListener('quest:celebrate', function (e) {
      try {
        const d = e.detail || {};
        celebrateQuestFX(d.kind || 'goal', (d.index || 0) | 0, (d.total || 0) | 0, d.label || '');
      } catch (err) {
        console.warn('[Particles] quest:celebrate handler error', err);
      }
    });
    root.addEventListener('quest:all-complete', function () {
      try { celebrateAllQuestsFX(); } catch (err) {
        console.warn('[Particles] quest:all-complete handler error', err);
      }
    });

    // ✅ NEW: รองรับ event ใหม่ของเรา (type หรือ kind)
    root.addEventListener('hha:celebrate', function (e) {
      try {
        const d = e.detail || {};
        const t = String(d.type || d.kind || 'goal').toLowerCase();

        if (t === 'all') {
          celebrateAllQuestsFX();
          return;
        }

        const kind = (t === 'mini') ? 'mini' : 'goal';
        celebrateQuestFX(kind, (d.index || 1) | 0, (d.total || (kind === 'goal' ? 2 : 3)) | 0, d.label || '');
      } catch (err) {
        console.warn('[Particles] hha:celebrate handler error', err);
      }
    });
  }

  // Export API
  const api = { scorePop, burstAt, celebrateQuestFX, celebrateAllQuestsFX };
  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;

})(window);
