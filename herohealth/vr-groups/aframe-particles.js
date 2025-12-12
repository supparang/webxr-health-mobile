// === /herohealth/vr/particles.js ===
// Simple FX layer: score pop + judgment text + target burst (แรงขึ้น)
// + Celebration FX สำหรับ Quest (Goal / Mini / All Complete)
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
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
    const n =
      typeof opts.count === 'number' && opts.count > 0
        ? opts.count
        : good
        ? 24
        : 16;

    for (let i = 0; i < n; i++) {
      const dot = doc.createElement('div');
      dot.className = 'hha-fx-dot';
      const size = good
        ? 6 + Math.random() * 6 // โดนดี → ใหญ่หน่อย
        : 4 + Math.random() * 4; // พลาด → เล็กลงนิดนึง

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

  // ===== Celebration helpers =====

  // --- ฉลองจบแต่ละภารกิจ (Goal / Mini) แสดง "กลางจอจริง ๆ" ---
  function celebrateQuestFX(kind, index, total, label) {
    const layer = ensureLayer();
    const cx = root.innerWidth / 2;
    const cy = root.innerHeight * 0.5; // กลางจอ

    const color = kind === 'goal' ? '#22c55e' : '#38bdf8';
    const title =
      kind === 'goal'
        ? 'GOAL ' + index + '/' + total
        : 'MINI ' + index + '/' + total;

    // แตกกระจายรอบ ๆ กลางจอ
    burstAt(cx, cy, { color: color, good: true, count: 28 });

    // ข้อความฉลองกลางจอ
    scorePop(cx, cy, 'MISSION CLEAR!', {
      judgment: title,
      good: true
    });

    // แบนด์แสงเล็ก ๆ ใต้ข้อความ (ยังอยู่กลางจอ)
    const bar = doc.createElement('div');
    Object.assign(bar.style, {
      position: 'absolute',
      left: '50%',
      top: '56%',
      transform: 'translateX(-50%)',
      width: '260px',
      height: '3px',
      borderRadius: '999px',
      background:
        kind === 'goal'
          ? 'linear-gradient(90deg,#22c55e,#bbf7d0)'
          : 'linear-gradient(90deg,#22d3ee,#a5b4fc)',
      boxShadow: '0 0 18px rgba(34,197,94,0.8)',
      opacity: '0',
      transition: 'opacity .25s ease-out, transform .25s ease-out'
    });
    layer.appendChild(bar);
    requestAnimationFrame(function () {
      bar.style.opacity = '1';
      bar.style.transform = 'translateX(-50%) translateY(-3px)';
    });
    setTimeout(function () {
      bar.style.opacity = '0';
      bar.style.transform = 'translateX(-50%) translateY(-8px)';
    }, 380);
    setTimeout(function () {
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }, 700);
  }

  // --- ฉลองใหญ่เมื่อทำครบทุกภารกิจ ---
  function celebrateAllQuestsFX(detail) {
    const layer = ensureLayer();
    const cx = root.innerWidth / 2;
    const cy = root.innerHeight * 0.32;

    // 3 wave แตกกระจาย
    const colors = ['#facc15', '#22c55e', '#38bdf8'];
    colors.forEach(function (c, idx) {
      setTimeout(function () {
        burstAt(cx, cy, { color: c, good: true, count: 30 });
      }, idx * 220);
    });

    // ป้าย ALL QUESTS CLEAR!
    const banner = doc.createElement('div');
    banner.textContent = 'ALL QUESTS CLEAR! 🌟';
    Object.assign(banner.style, {
      position: 'absolute',
      left: '50%',
      top: '30%',
      transform: 'translate(-50%, -50%) scale(0.88)',
      padding: '10px 18px',
      borderRadius: '999px',
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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

  // ----- auto ผูกกับ events ให้ทุกเกมใช้ได้เลย -----
  if (root && root.addEventListener) {
    // ตีเป้า: แตกกระจายกลางจอ (ตามคำตัดสิน)
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

    // ฉลองเคลียร์ Goal / Mini quest จาก GameEngine (เช่น GoodJunkVR)
    root.addEventListener('quest:celebrate', function (e) {
      try {
        const d = e.detail || {};
        const kind = d.kind || 'goal'; // 'goal' หรือ 'mini'
        const idx = (d.index || 0) | 0;
        const total = (d.total || 0) | 0;
        const label = d.label || '';
        celebrateQuestFX(kind, idx, total, label);
      } catch (err) {
        if (root.console && console.warn) {
          console.warn('[Particles] quest:celebrate handler error', err);
        }
      }
    });

    // ฉลองใหญ่เมื่อทำครบทุกภารกิจ (GameEngine ส่ง quest:all-complete)
    root.addEventListener('quest:all-complete', function (e) {
      try {
        const d = e.detail || {};
        celebrateAllQuestsFX(d || {});
      } catch (err) {
        if (root.console && console.warn) {
          console.warn('[Particles] quest:all-complete handler error', err);
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