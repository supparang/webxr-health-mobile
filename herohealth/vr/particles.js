// === /herohealth/vr/particles.js ===
// Hero Health VR Particles — burst + scorePop (single-line label)
// ใช้กับ GoodJunkVR / Hydration / Plate ฯลฯ
// ดีไซน์: เป้าแตกกระจายแรง ๆ + ตัวหนังสือเด้งขึ้น "บรรทัดเดียว"

(function (ns) {
  'use strict';

  const ROOT_ID = 'hha-particles-layer';
  let rootEl = null;
  let cssInjected = false;

  function ensureRoot() {
    if (rootEl && document.body.contains(rootEl)) return rootEl;
    rootEl = document.getElementById(ROOT_ID);
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = ROOT_ID;
      rootEl.style.position = 'fixed';
      rootEl.style.inset = '0';
      rootEl.style.pointerEvents = 'none';
      rootEl.style.zIndex = '9999';
      rootEl.style.overflow = 'hidden';
      document.body.appendChild(rootEl);
    }
    if (!cssInjected) {
      injectCSS();
      cssInjected = true;
    }
    return rootEl;
  }

  function injectCSS() {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.textContent = `
      #${ROOT_ID}{
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .hha-frag{
        position:absolute;
        width:6px;
        height:6px;
        border-radius:999px;
        background:#22c55e;
        opacity:0;
        transform:translate3d(0,0,0) scale(1);
        animation: hha-frag-fly 620ms ease-out forwards;
        will-change: transform, opacity;
      }
      @keyframes hha-frag-fly{
        0%{
          opacity:1;
          transform:translate3d(0,0,0) scale(1);
        }
        60%{
          opacity:1;
        }
        100%{
          opacity:0;
          transform:translate3d(var(--dx,0px),var(--dy,0px),0) scale(0.4);
        }
      }

      .hha-scorepop{
        position:absolute;
        transform:translate3d(-50%,-50%,0);
        padding:4px 9px;
        border-radius:999px;
        font-size:14px;
        font-weight:800;
        letter-spacing:.05em;
        white-space:nowrap;       /* <<< ตัวหนังสือบรรทัดเดียว */
        color:#fefce8;
        background:rgba(15,23,42,0.96);
        box-shadow:0 0 18px rgba(15,23,42,0.9);
        opacity:0;
        animation:hha-scorepop-rise 680ms cubic-bezier(.17,.89,.42,1.1) forwards;
        will-change: transform, opacity;
        border:1px solid rgba(250,250,250,0.2);
      }
      .hha-scorepop.judge{
        background:radial-gradient(circle at top left, rgba(250,204,21,0.30), transparent 45%),
                   rgba(15,23,42,0.98);
        border-color:rgba(250,250,250,0.4);
      }
      .hha-scorepop.judge-miss{
        background:radial-gradient(circle at top left, rgba(248,113,113,0.35), transparent 45%),
                   rgba(15,23,42,0.98);
        border-color:rgba(248,113,113,0.7);
      }
      .hha-scorepop.judge-perfect{
        background:radial-gradient(circle at top left, rgba(74,222,128,0.40), transparent 45%),
                   rgba(8,47,73,0.98);
        border-color:rgba(74,222,128,0.8);
      }

      @keyframes hha-scorepop-rise{
        0%{
          opacity:0;
          transform:translate3d(-50%,-10%,0) scale(0.85);
        }
        25%{
          opacity:1;
          transform:translate3d(-50%,-40%,0) scale(1.05);
        }
        60%{
          opacity:1;
          transform:translate3d(-50%,-52%,0) scale(1.0);
        }
        100%{
          opacity:0;
          transform:translate3d(-50%,-70%,0) scale(0.9);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- burstAt: เศษเป้าแตกกระจาย ----------
  function burstAt(x, y, opts = {}) {
    const root = ensureRoot();
    const count  = (typeof opts.count === 'number' ? opts.count : 18);
    const radius = (typeof opts.radius === 'number' ? opts.radius : 70);
    const color  = opts.color || '#22c55e';

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'hha-frag';
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.style.background = color;

      const ang = (i / count) * Math.PI * 2 + (Math.random() * 0.5);
      const dist = radius * (0.5 + Math.random() * 0.7);
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      el.style.setProperty('--dx', dx.toFixed(1) + 'px');
      el.style.setProperty('--dy', dy.toFixed(1) + 'px');

      root.appendChild(el);
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 700);
    }
  }

  // ---------- scorePop: แสดงข้อความบรรทัดเดียว ----------
  // text เช่น "+80 PERFECT" หรือ "-8 MISS"
  function scorePop(x, y, text, opts = {}) {
    const root = ensureRoot();
    const label = (text == null ? '' : String(text));
    if (!label) return;

    const el = document.createElement('div');
    el.className = 'hha-scorepop';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.textContent = label;

    const kind     = (opts.kind || '').toLowerCase(); // 'judge' / 'score'
    const judgment = (opts.judgment || '').toUpperCase();

    if (kind === 'judge') {
      el.classList.add('judge');
      if (judgment === 'MISS') {
        el.classList.add('judge-miss');
      } else if (judgment === 'PERFECT') {
        el.classList.add('judge-perfect');
      }
    }

    root.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 750);
  }

  const api = { burstAt, scorePop };

  // export ออกไปให้ GameEngine ใช้
  ns.Particles = api;
  if (typeof window !== 'undefined') {
    window.Particles = api;
  }

})(window.GAME_MODULES = window.GAME_MODULES || {});