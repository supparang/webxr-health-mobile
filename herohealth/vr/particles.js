// === /herohealth/vr/particles.js ===
// Global Particles FX สำหรับ VR (GoodJunk / Groups / Hydration / Plate)
//
// รองรับ:
//   - burstAt(x, y, { color, count, radius })
//       → เศษเป้าแตกกระจายรอบ ๆ ตำแหน่งตีเป้า
//   - scorePop(x, y, text, { kind: 'score'|'judge', judgment: 'PERFECT'|'GOOD'|'MISS'|'BONUS'|'BLOCK' })
//       → ตัวเลขคะแนนเด้ง + ป้ายคำตัดสิน (แยกจังหวะ / แยกตำแหน่ง)
//
// ใช้ร่วมกับ GameEngine:
//   const P = getParticles();
//   P.burstAt(...);
//   P.scorePop(...);

(function (win, doc) {
  'use strict';

  const STYLE_ID = 'hha-particles-style';

  // ===== ใส่ CSS ให้ effect ถ้ายังไม่มี =====
  function ensureStyle() {
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #hha-particles-layer{
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:654; /* อยู่เหนือฉาก VR + HUD แต่ต่ำกว่า countdown overlay */
        overflow:hidden;
      }

      /* เศษเป้าแตกกระจาย */
      .hha-frag{
        position:absolute;
        width:6px;
        height:6px;
        border-radius:999px;
        opacity:0;
        transform:translate3d(0,0,0) scale(1);
        animation:hha-frag-fly .65s ease-out forwards;
      }
      @keyframes hha-frag-fly{
        0%{
          opacity:0;
          transform:translate3d(0,0,0) scale(.6);
        }
        10%{
          opacity:1;
        }
        100%{
          opacity:0;
          transform:translate3d(var(--tx,0),var(--ty,0),0) scale(.4);
        }
      }

      /* ตัวเลขคะแนน / ป้ายคำตัดสินลอยขึ้น */
      .hha-score-pop{
        position:absolute;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:14px;
        font-weight:700;
        color:#e5e7eb;
        text-shadow:0 0 8px rgba(0,0,0,0.9);
        opacity:0;
        transform:translate3d(-50%,0,0) scale(1);
        white-space:nowrap;
        animation:hha-score-rise .9s ease-out forwards;
      }
      @keyframes hha-score-rise{
        0%{
          opacity:0;
          transform:translate3d(-50%,4px,0) scale(.9);
        }
        15%{
          opacity:1;
          transform:translate3d(-50%,-2px,0) scale(1.02);
        }
        60%{
          opacity:1;
          transform:translate3d(-50%,-26px,0) scale(1);
        }
        100%{
          opacity:0;
          transform:translate3d(-50%,-36px,0) scale(.96);
        }
      }

      /* โทนสีสำหรับคะแนน */
      .hha-score-pop[data-kind="score"]{
        color:#bbf7d0; /* เขียวอ่อน */
      }
      .hha-score-pop[data-kind="score"][data-sign="-"]{
        color:#fed7aa; /* ส้มอ่อนสำหรับคะแนนลบ */
      }

      /* โทนสำหรับป้ายคำตัดสิน */
      .hha-score-pop[data-kind="judge"]{
        font-size:13px;
        letter-spacing:.12em;
        text-transform:uppercase;
      }

      .hha-score-pop[data-judge="PERFECT"]{
        color:#4ade80;
      }
      .hha-score-pop[data-judge="GOOD"]{
        color:#a5f3fc;
      }
      .hha-score-pop[data-judge="LATE"]{
        color:#fde68a;
      }
      .hha-score-pop[data-judge="MISS"]{
        color:#fecaca;
      }
      .hha-score-pop[data-judge="BONUS"]{
        color:#facc15;
      }
      .hha-score-pop[data-judge="BLOCK"]{
        color:#bfdbfe;
      }
    `;
    doc.head.appendChild(style);
  }

  // ===== layer วาง effect =====
  let layer = null;
  function ensureLayer() {
    if (layer && layer.parentNode) return layer;
    layer = doc.createElement('div');
    layer.id = 'hha-particles-layer';
    doc.body.appendChild(layer);
    return layer;
  }

  // ===== เศษเป้าแตกกระจายรอบจุดที่ตีโดน =====
  function burstAt(x, y, opts) {
    ensureStyle();
    const root = ensureLayer();
    if (!root) return;

    const color  = (opts && opts.color)  || '#22c55e';
    const count  = (opts && opts.count)  || 12;
    const radius = (opts && opts.radius) || 60;

    for (let i = 0; i < count; i++) {
      const el = doc.createElement('div');
      el.className = 'hha-frag';
      el.style.background = color;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';

      const ang = (i / count) * Math.PI * 2;
      const dist = radius * (0.4 + Math.random() * 0.6);
      const tx = Math.cos(ang) * dist;
      const ty = Math.sin(ang) * dist * 0.5; // ให้กระเด็นออก + ลอยขึ้นนิดหน่อย

      el.style.setProperty('--tx', tx + 'px');
      el.style.setProperty('--ty', ty + 'px');

      el.addEventListener('animationend', () => {
        el.remove();
      });

      root.appendChild(el);
    }
  }

  // ===== คะแนนเด้ง + ป้ายตัดสินลอย =====
  function scorePop(x, y, text, opts) {
    ensureStyle();
    const root = ensureLayer();
    if (!root) return;

    const kind      = (opts && opts.kind)      || 'score';   // 'score' หรือ 'judge'
    const judgment  = (opts && opts.judgment)  || '';        // PERFECT / GOOD / MISS ฯลฯ

    const el = doc.createElement('div');
    el.className = 'hha-score-pop';
    el.dataset.kind = kind;

    // แยกสีสำหรับคะแนนลบ / บวก
    if (kind === 'score') {
      const n = Number(text);
      if (!isNaN(n)) {
        el.dataset.sign = n < 0 ? '-' : '+';
      }
    } else if (kind === 'judge' && judgment) {
      el.dataset.judge = String(judgment).toUpperCase();
    }

    el.textContent = text;

    // === แยกตำแหน่ง + timing ===
    // score: ใกล้จุดเป้า + ไม่มี delay
    // judge: สูงขึ้นอีกนิด + delay เพื่อไม่ให้โผล่พร้อมกันเป๊ะ
    let offsetY = -8;
    let delayMs = 0;

    if (kind === 'judge') {
      offsetY = -30;    // สูงกว่า score
      delayMs = 90;     // ดีเลย์ ~0.09 วินาที
    }

    el.style.left = x + 'px';
    el.style.top  = (y + offsetY) + 'px';

    if (delayMs > 0) {
      el.style.animationDelay = (delayMs / 1000) + 's';
    }

    el.addEventListener('animationend', () => {
      el.remove();
    });

    root.appendChild(el);
  }

  // ===== export ออกไปให้ GameEngine ใช้ =====
  const api = { burstAt, scorePop };

  win.GAME_MODULES = win.GAME_MODULES || {};
  win.GAME_MODULES.Particles = api;

  // เผื่อโค้ดเก่าเรียก window.Particles
  if (!win.Particles) {
    win.Particles = api;
  }

})(window, document);