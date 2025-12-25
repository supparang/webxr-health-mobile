// === /herohealth/vr/particles.js ===
// HeroHealth — Global FX Layer (UNIVERSAL) — PATCH ULTIMATE
// ✅ scorePop(x,y,text,label)
// ✅ burstAt(x,y,kind)
// ✅ celebrate({kind,intensity})
// ✅ toast(text, ms)
// ✅ Listens: hha:celebrate, hha:judge
// ✅ Safe text sanitize (กันเลขยาว/กัน undefined) + anti-spam

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // -------------------- Utils --------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();

  function safeText(t) {
    t = String(t ?? '');
    // กันโดน timestamp / ตัวเลขยาว (เช่น 1766....) เข้ามาเป็น "text"
    if (/^\d{10,}$/.test(t)) return '✓';
    if (t.length > 26) return t.slice(0, 26) + '…';
    return t;
  }

  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';

    Object.assign(layer.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      right: '0',
      bottom: '0',
      zIndex: '999',
      pointerEvents: 'none',
      overflow: 'hidden'
    });

    // CSS injection (ครั้งเดียว)
    const st = doc.createElement('style');
    st.textContent = `
      .hha-fx-layer *{box-sizing:border-box}

      .hha-pop{
        position:absolute;
        left:0; top:0;
        transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(1);
        padding:8px 12px;
        border-radius:999px;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", sans-serif;
        font-weight:1000;
        letter-spacing:.2px;
        background: rgba(2,6,23,.70);
        border: 1px solid rgba(148,163,184,.22);
        color:#e5e7eb;
        backdrop-filter: blur(8px);
        box-shadow: 0 18px 44px rgba(0,0,0,.38);
        white-space:nowrap;
        will-change: transform, opacity;
        opacity: 0;
        animation: hhaPop 620ms ease-out forwards;
      }
      .hha-pop[data-kind="good"]{ border-color: rgba(34,197,94,.40); }
      .hha-pop[data-kind="bad"]{ border-color: rgba(251,113,133,.40); }
      .hha-pop[data-kind="gold"]{ border-color: rgba(250,204,21,.55); }
      .hha-pop[data-kind="trap"]{ border-color: rgba(147,51,234,.45); }
      .hha-pop[data-kind="boss"]{ border-color: rgba(248,113,113,.45); }
      .hha-pop[data-kind="power"]{ border-color: rgba(56,189,248,.45); }
      .hha-pop .sub{
        margin-left:8px;
        color: rgba(148,163,184,.96);
        font-weight: 1000;
        font-size: 12px;
      }
      @keyframes hhaPop{
        0%{ opacity:0; transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(.85); }
        20%{ opacity:1; transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(1.02); }
        100%{ opacity:0; transform:translate3d(var(--x,0px), calc(var(--y,0px) - 42px), 0) scale(1.0); }
      }

      .hha-burst{
        position:absolute;
        left:0; top:0;
        transform:translate3d(var(--x,0px), var(--y,0px), 0);
        width: 10px; height: 10px;
        border-radius: 999px;
        background: rgba(229,231,235,.18);
        box-shadow: 0 0 0 0 rgba(229,231,235,.0);
        opacity: 0;
        will-change: transform, opacity, box-shadow;
        animation: hhaBurst 420ms ease-out forwards;
      }
      .hha-burst[data-kind="good"]{
        background: rgba(34,197,94,.30);
        box-shadow: 0 0 0 10px rgba(34,197,94,.10), 0 0 44px rgba(34,197,94,.14);
      }
      .hha-burst[data-kind="bad"]{
        background: rgba(251,113,133,.28);
        box-shadow: 0 0 0 10px rgba(251,113,133,.10), 0 0 44px rgba(251,113,133,.14);
      }
      .hha-burst[data-kind="gold"]{
        background: rgba(250,204,21,.30);
        box-shadow: 0 0 0 12px rgba(250,204,21,.11), 0 0 54px rgba(250,204,21,.16);
      }
      .hha-burst[data-kind="trap"]{
        background: rgba(147,51,234,.28);
        box-shadow: 0 0 0 12px rgba(147,51,234,.11), 0 0 54px rgba(147,51,234,.16);
      }
      .hha-burst[data-kind="boss"]{
        background: rgba(248,113,113,.30);
        box-shadow: 0 0 0 14px rgba(248,113,113,.11), 0 0 62px rgba(248,113,113,.18);
      }
      .hha-burst[data-kind="power"]{
        background: rgba(56,189,248,.30);
        box-shadow: 0 0 0 12px rgba(56,189,248,.11), 0 0 56px rgba(56,189,248,.16);
      }
      @keyframes hhaBurst{
        0%{ opacity:0; transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(.60); }
        20%{ opacity:1; transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(1.0); }
        100%{ opacity:0; transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(1.75); }
      }

      .hha-center{
        position:absolute;
        left:50%; top:18%;
        transform: translate(-50%, 0);
        max-width:min(92vw, 720px);
        padding: 10px 14px;
        border-radius: 16px;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(148,163,184,.22);
        color: #e5e7eb;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", sans-serif;
        font-weight: 1100;
        font-size: 18px;
        letter-spacing:.2px;
        text-align:center;
        box-shadow: 0 22px 70px rgba(0,0,0,.45);
        backdrop-filter: blur(10px);
        opacity: 0;
        pointer-events:none;
        will-change: transform, opacity;
      }
      .hha-center.show{
        animation: hhaCenter 980ms ease-out forwards;
      }
      .hha-center[data-kind="gold"]{ border-color: rgba(250,204,21,.55); }
      .hha-center[data-kind="good"]{ border-color: rgba(34,197,94,.45); }
      .hha-center[data-kind="bad"]{ border-color: rgba(251,113,133,.45); }
      .hha-center[data-kind="boss"]{ border-color: rgba(248,113,113,.45); }
      .hha-center[data-kind="power"]{ border-color: rgba(56,189,248,.45); }
      @keyframes hhaCenter{
        0%{ opacity:0; transform: translate(-50%, 12px) scale(.96); }
        12%{ opacity:1; transform: translate(-50%, 0px) scale(1.00); }
        82%{ opacity:1; transform: translate(-50%, 0px) scale(1.00); }
        100%{ opacity:0; transform: translate(-50%, -6px) scale(.995); }
      }

      .hha-toast{
        position:absolute;
        left:50%; bottom: 16px;
        transform: translate(-50%, 0);
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(2,6,23,.76);
        border: 1px solid rgba(148,163,184,.22);
        color: rgba(229,231,235,.95);
        font-family: system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", sans-serif;
        font-weight: 1000;
        box-shadow: 0 18px 60px rgba(0,0,0,.42);
        backdrop-filter: blur(10px);
        opacity:0;
        pointer-events:none;
      }
      .hha-toast.show{ animation: hhaToast 1400ms ease-out forwards; }
      @keyframes hhaToast{
        0%{opacity:0; transform:translate(-50%, 10px) scale(.98);}
        12%{opacity:1; transform:translate(-50%, 0px) scale(1);}
        84%{opacity:1;}
        100%{opacity:0; transform:translate(-50%, -6px) scale(.995);}
      }
    `;
    doc.head.appendChild(st);

    doc.body.appendChild(layer);
    return layer;
  }

  // -------------------- Center banner (judge/celebrate) --------------------
  let centerEl = null;
  let lastCenterAt = 0;

  function ensureCenter(layer) {
    if (centerEl) return centerEl;
    centerEl = doc.createElement('div');
    centerEl.className = 'hha-center';
    centerEl.textContent = '';
    layer.appendChild(centerEl);
    return centerEl;
  }

  function showCenter(text, kind) {
    const t = now();
    // anti-spam: 120ms
    if (t - lastCenterAt < 120) return;
    lastCenterAt = t;

    const layer = ensureLayer();
    const el = ensureCenter(layer);
    el.dataset.kind = String(kind || 'good');
    el.textContent = safeText(text);

    el.classList.remove('show');
    // restart animation
    void el.offsetWidth;
    el.classList.add('show');
  }

  // -------------------- Pop + Burst --------------------
  let lastPopAt = 0;
  function scorePop(x, y, text, label) {
    const t = now();
    // anti-spam: 35ms
    if (t - lastPopAt < 35) return;
    lastPopAt = t;

    const layer = ensureLayer();
    const pop = doc.createElement('div');

    const sx = clamp(Number(x) || 0, 0, root.innerWidth);
    const sy = clamp(Number(y) || 0, 0, root.innerHeight);

    pop.className = 'hha-pop';
    pop.style.setProperty('--x', `${sx}px`);
    pop.style.setProperty('--y', `${sy}px`);

    const a = safeText(text);
    const b = safeText(label);

    // guess kind from text/label (ถ้าอยากบังคับ kind ให้ใช้ celebrate หรือ burstAt)
    let kind = 'good';
    const low = (a + ' ' + b).toLowerCase();
    if (low.includes('miss') || low.includes('bad') || low.includes('-')) kind = 'bad';
    if (low.includes('gold') || low.includes('⭐') || low.includes('goal') || low.includes('clear')) kind = 'gold';
    if (low.includes('trap')) kind = 'trap';
    if (low.includes('boss')) kind = 'boss';
    if (low.includes('power') || low.includes('slow') || low.includes('storm') || low.includes('shield')) kind = 'power';

    pop.dataset.kind = kind;

    pop.innerHTML = b
      ? `${a}<span class="sub">${b}</span>`
      : `${a}`;

    layer.appendChild(pop);
    setTimeout(() => { try { pop.remove(); } catch(_){} }, 800);
  }

  function burstAt(x, y, kind) {
    const layer = ensureLayer();
    const b = doc.createElement('div');

    const sx = clamp(Number(x) || 0, 0, root.innerWidth);
    const sy = clamp(Number(y) || 0, 0, root.innerHeight);

    b.className = 'hha-burst';
    b.dataset.kind = String(kind || 'good');
    b.style.setProperty('--x', `${sx}px`);
    b.style.setProperty('--y', `${sy}px`);

    layer.appendChild(b);
    setTimeout(() => { try { b.remove(); } catch(_){} }, 520);
  }

  // -------------------- Celebrate + Toast --------------------
  function celebrate(payload) {
    const kind = (payload && payload.kind) ? safeText(payload.kind) : 'GOOD!';
    const intensity = clamp(Number(payload && payload.intensity) || 1, 0.6, 2.2);

    // แปลง kind → color tag
    let k = 'gold';
    const low = String(kind).toLowerCase();
    if (low.includes('fail') || low.includes('bad') || low.includes('miss') || low.includes('game over')) k = 'bad';
    else if (low.includes('boss')) k = 'boss';
    else if (low.includes('power') || low.includes('slow') || low.includes('storm') || low.includes('shield')) k = 'power';
    else if (low.includes('good') || low.includes('perfect') || low.includes('hit')) k = 'good';

    showCenter(kind, k);

    // เสริม burst กลางจอ (ตาม intensity)
    const vw = root.innerWidth, vh = root.innerHeight;
    const cx = vw * 0.5, cy = vh * 0.45;
    const n = Math.round(2 + intensity * 2.2);
    for (let i = 0; i < n; i++) {
      const dx = (Math.random() - 0.5) * (120 + intensity * 90);
      const dy = (Math.random() - 0.5) * (90 + intensity * 70);
      burstAt(cx + dx, cy + dy, k);
    }
  }

  let toastEl = null;
  function toast(text, ms = 1400) {
    const layer = ensureLayer();
    if (!toastEl) {
      toastEl = doc.createElement('div');
      toastEl.className = 'hha-toast';
      layer.appendChild(toastEl);
    }
    toastEl.textContent = safeText(text);
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    setTimeout(() => { try { toastEl && toastEl.classList.remove('show'); } catch(_){} }, Math.max(800, ms|0));
  }

  // -------------------- Optional helpers --------------------
  function floatPop() {
    // alias: เผื่อโค้ดเก่าเรียก
    return scorePop.apply(null, arguments);
  }

  // -------------------- Listen global events --------------------
  root.addEventListener('hha:celebrate', (e) => {
    try { celebrate(e.detail || {}); } catch(_){}
  });

  root.addEventListener('hha:judge', (e) => {
    try {
      const label = e && e.detail && e.detail.label;
      if (!label) return;
      // judge จะแสดงสั้น ๆ กลางจอ
      const low = String(label).toLowerCase();
      let k = 'good';
      if (low.includes('miss') || low.includes('bad') || low.includes('fail')) k = 'bad';
      if (low.includes('boss')) k = 'boss';
      if (low.includes('power') || low.includes('slow') || low.includes('storm') || low.includes('shield')) k = 'power';
      if (low.includes('perfect')) k = 'gold';
      showCenter(label, k);
    } catch(_){}
  });

  // -------------------- Export to global --------------------
  const api = { scorePop, burstAt, celebrate, toast, floatPop };

  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;

})(typeof window !== 'undefined' ? window : globalThis);