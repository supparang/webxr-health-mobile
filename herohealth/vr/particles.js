// === /herohealth/vr/particles.js ===
// Global Particles FX สำหรับ VR (GoodJunk / Groups / Hydration / Plate)
// รองรับ:
//   - burstAt(x, y, { color, count, radius })
//   - scorePop(x, y, text, { kind: 'score'|'judge', judgment: 'PERFECT'|'GOOD'|'MISS'|'BONUS'|'BLOCK' })
//
// ใช้ร่วมกับ GameEngine: จะทำให้ "เป้าแตกกระจาย + คะแนนเด้งตรงเป้า" ทำงานครบ

(function (win, doc) {
  'use strict';

  // ----- inject CSS ถ้ายังไม่มี -----
  const STYLE_ID = 'hha-particles-style';

  function ensureStyle() {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #hha-particles-layer{
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:700; /* บนสุดกว่าฉาก VR แต่ไม่บัง HUD สำคัญ */
        overflow:hidden;
      }
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
        0%{ opacity:0; transform:translate3d(0,0,0) scale(.6); }
        10%{ opacity:1; }
        100%{ opacity:0; transform:translate3d(var(--tx,0),var(--ty,0),0) scale(.4); }
      }

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

      /* โทนสีแตกต่างสำหรับ score กับ judge */
      .hha-score-pop[data-kind="score"]{
        color:#bbf7d0;
      }
      .hha-score-pop[data-kind="score"][data-sign="-"]{
        color:#fed7aa;
      }

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

  // ----- layer หลัก -----
  let layer = null;
  function ensureLayer() {
    if (layer && layer.parentNode) return layer;
    layer = doc.createElement('div');
    layer.id = 'hha-particles-layer';
    doc.body.appendChild(layer);
    return layer;
  }

  // ----- fragment burst -----
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
      const ty = Math.sin(ang) * dist * 0.5; // ลอยไปด้านบนเล็กน้อย
      el.style.setProperty('--tx', tx + 'px');
      el.style.setProperty('--ty', ty + 'px');

      el.addEventListener('animationend', () => {
        el.remove();
      });

      root.appendChild(el);
    }
  }

  // ----- floating score / judge -----
  function scorePop(x, y, text, opts) {
    ensureStyle();
    const root = ensureLayer();
    if (!root) return;

    const kind = (opts && opts.kind) || 'score'; // 'score' หรือ 'judge'
    const judgment = (opts && opts.judgment) || '';

    const el = doc.createElement('div');
    el.className = 'hha-score-pop';
    el.dataset.kind = kind;

    if (kind === 'score') {
      const n = Number(text);
      if (!isNaN(n)) {
        el.dataset.sign = n < 0 ? '-' : '+';
      }
    } else if (kind === 'judge' && judgment) {
      el.dataset.judge = String(judgment).toUpperCase();
    }

    el.textContent = text;

    // ตำแหน่ง — ขยับขึ้นเล็กน้อยจากจุดเป้า
    const offsetY = -8;
    el.style.left = x + 'px';
    el.style.top  = (y + offsetY) + 'px';

    el.addEventListener('animationend', () => {
      el.remove();
    });

    root.appendChild(el);
  }

  // ----- export ไปยัง window.GAME_MODULES / window.Particles -----
  const api = { burstAt, scorePop };

  win.GAME_MODULES = win.GAME_MODULES || {};
  win.GAME_MODULES.Particles = api;

  // เผื่อโค้ดเก่าบางที่เรียก window.Particles ตรง ๆ
  if (!win.Particles) {
    win.Particles = api;
  }

})(window, document);